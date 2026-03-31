package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ── Rate limiter ───────────────────────────────────────────────────────────

func TestRateLimiter_AllowsUnderLimit(t *testing.T) {
	rl := NewRateLimiter(10, 10) // 10 rps, burst 10
	for i := 0; i < 10; i++ {
		if !rl.Allow("127.0.0.1") {
			t.Errorf("request %d should be allowed", i)
		}
	}
}

func TestRateLimiter_BlocksOverBurst(t *testing.T) {
	rl := NewRateLimiter(1, 3) // 1 rps, burst 3
	allowed := 0
	for i := 0; i < 10; i++ {
		if rl.Allow("10.0.0.1") {
			allowed++
		}
	}
	// Burst of 3 means first 3 allowed, rest blocked
	if allowed != 3 {
		t.Errorf("expected 3 allowed, got %d", allowed)
	}
}

func TestRateLimiter_RefillsOverTime(t *testing.T) {
	rl := NewRateLimiter(10, 2) // 10 rps, burst 2
	// Exhaust burst
	rl.Allow("1.2.3.4")
	rl.Allow("1.2.3.4")
	if rl.Allow("1.2.3.4") {
		t.Error("third request should be blocked immediately after burst")
	}
	// Wait for refill (100ms at 10 rps = 1 token)
	time.Sleep(120 * time.Millisecond)
	if !rl.Allow("1.2.3.4") {
		t.Error("request should be allowed after refill")
	}
}

func TestRateLimiter_IsolatesIPs(t *testing.T) {
	rl := NewRateLimiter(1, 1) // Very tight: burst 1
	if !rl.Allow("ip-a") {
		t.Error("ip-a first request should be allowed")
	}
	if !rl.Allow("ip-b") {
		t.Error("ip-b first request should be allowed — different IP bucket")
	}
	// ip-a should now be blocked
	if rl.Allow("ip-a") {
		t.Error("ip-a second request should be blocked")
	}
}

func TestRateLimiter_Middleware_Returns429(t *testing.T) {
	rl := NewRateLimiter(1, 1)

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request: OK
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	// Second request: rate limited
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))
	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", rr.Code)
	}
}

func TestRateLimiter_ConcurrentSafety(t *testing.T) {
	rl := NewRateLimiter(1000, 500)
	var wg sync.WaitGroup
	var allowed int64
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if rl.Allow("shared-ip") {
				atomic.AddInt64(&allowed, 1)
			}
		}()
	}
	wg.Wait()
	// Should not panic; exact count depends on timing but ≤ 500 (burst cap)
	if allowed > 500 {
		t.Errorf("allowed %d exceeds burst capacity of 500", allowed)
	}
}

// ── API key hashing ────────────────────────────────────────────────────────

func TestHashKey_Deterministic(t *testing.T) {
	h1 := hashKey("my-secret")
	h2 := hashKey("my-secret")
	if h1 != h2 {
		t.Error("same key should produce same hash")
	}
}

func TestHashKey_Unique(t *testing.T) {
	h1 := hashKey("key-a")
	h2 := hashKey("key-b")
	if h1 == h2 {
		t.Error("different keys should produce different hashes")
	}
}

func TestHashKey_Length(t *testing.T) {
	h := hashKey("any-key")
	// SHA-256 hex = 64 chars
	if len(h) != 64 {
		t.Errorf("expected 64-char hex hash, got length %d", len(h))
	}
}

// ── realIP ─────────────────────────────────────────────────────────────────

func TestRealIP_XForwardedFor(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.5, 10.0.0.1")
	ip := realIP(req)
	if ip != "203.0.113.5" {
		t.Errorf("expected 203.0.113.5, got %q", ip)
	}
}

func TestRealIP_RemoteAddr(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.100:55000"
	ip := realIP(req)
	if ip != "192.168.1.100:55000" {
		t.Errorf("expected RemoteAddr fallback, got %q", ip)
	}
}
