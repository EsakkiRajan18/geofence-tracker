package websocket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/EsakkiRajan18/geofence-tracker/internal/models"
)

// ── Hub unit tests ─────────────────────────────────────────────────────────

func TestHubStartsEmpty(t *testing.T) {
	h := NewHub()
	if h.ClientCount() != 0 {
		t.Errorf("expected 0 clients, got %d", h.ClientCount())
	}
}

func TestHubBroadcastToConnectedClients(t *testing.T) {
	h := NewHub()

	// Start a test WebSocket server
	server := httptest.NewServer(http.HandlerFunc(h.ServeWS))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	received := make(chan models.WSAlertMessage, 1)

	// Connect a client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Give hub time to register
	time.Sleep(50 * time.Millisecond)

	if h.ClientCount() != 1 {
		t.Errorf("expected 1 client, got %d", h.ClientCount())
	}

	// Listen for messages
	go func() {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var alert models.WSAlertMessage
		json.Unmarshal(msg, &alert)
		received <- alert
	}()

	// Broadcast a test alert
	alert := models.WSAlertMessage{
		EventID:   42,
		EventType: "entry",
		Timestamp: time.Now(),
	}
	alert.Vehicle.VehicleID = 1
	alert.Vehicle.VehicleNumber = "KA01AB1234"
	alert.Geofence.GeofenceID = 1
	alert.Geofence.GeofenceName = "Zone A"
	alert.Location.Latitude = 12.97
	alert.Location.Longitude = 77.59

	h.Broadcast(alert)

	select {
	case got := <-received:
		if got.EventID != 42 {
			t.Errorf("expected EventID=42, got %d", got.EventID)
		}
		if got.EventType != "entry" {
			t.Errorf("expected entry, got %s", got.EventType)
		}
		if got.Vehicle.VehicleNumber != "KA01AB1234" {
			t.Errorf("unexpected vehicle number: %s", got.Vehicle.VehicleNumber)
		}
	case <-time.After(2 * time.Second):
		t.Error("timeout waiting for broadcast message")
	}
}

func TestHubClientDeregistersOnClose(t *testing.T) {
	h := NewHub()
	server := httptest.NewServer(http.HandlerFunc(h.ServeWS))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}

	time.Sleep(50 * time.Millisecond)
	if h.ClientCount() != 1 {
		t.Fatalf("expected 1 client before close")
	}

	conn.Close()

	// Wait for deregistration
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if h.ClientCount() == 0 {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Errorf("expected 0 clients after close, got %d", h.ClientCount())
}

func TestHubConcurrentBroadcast(t *testing.T) {
	h := NewHub()
	server := httptest.NewServer(http.HandlerFunc(h.ServeWS))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect 5 clients
	const nClients = 5
	var conns []*websocket.Conn
	for i := 0; i < nClients; i++ {
		c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("dial client %d: %v", i, err)
		}
		conns = append(conns, c)
	}
	defer func() {
		for _, c := range conns { c.Close() }
	}()

	time.Sleep(100 * time.Millisecond)
	if h.ClientCount() != nClients {
		t.Fatalf("expected %d clients, got %d", nClients, h.ClientCount())
	}

	// Count received messages across all clients
	var mu sync.Mutex
	received := 0
	var wg sync.WaitGroup
	for _, c := range conns {
		wg.Add(1)
		go func(conn *websocket.Conn) {
			defer wg.Done()
			conn.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, _, err := conn.ReadMessage()
			if err == nil {
				mu.Lock()
				received++
				mu.Unlock()
			}
		}(c)
	}

	h.Broadcast(models.WSAlertMessage{EventID: 99, EventType: "exit"})
	wg.Wait()

	if received != nClients {
		t.Errorf("expected %d clients to receive, got %d", nClients, received)
	}
}

func TestHubBroadcastWithNoClients(t *testing.T) {
	// Should not panic
	h := NewHub()
	h.Broadcast(models.WSAlertMessage{EventID: 1, EventType: "entry"})
}
