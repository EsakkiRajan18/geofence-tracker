package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/EsakkiRajan18/geofence-tracker/internal/api"
	"github.com/EsakkiRajan18/geofence-tracker/internal/db"
	"github.com/EsakkiRajan18/geofence-tracker/internal/middleware"
	ws "github.com/EsakkiRajan18/geofence-tracker/internal/websocket"
)

func main() {
	// ── Config from env ────────────────────────────────────────────────────
	connStr := getEnv("DATABASE_URL",
		"postgres://postgres:postgres@localhost:5432/geofence?sslmode=disable")
	port := getEnv("PORT", "8080")
	apiKey := getEnv("SEED_API_KEY", "dev-secret-key-change-me")

	// ── Database ───────────────────────────────────────────────────────────
	database, err := db.New(connStr)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer database.Close()

	if err := database.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("database ready")

	// Seed default API key
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(apiKey)))
	if err := database.SeedAPIKey(hash, "default"); err != nil {
		log.Printf("seed api key: %v", err)
	}
	log.Printf("API key seeded (use X-API-Key: %s)", apiKey)

	// ── WebSocket hub ──────────────────────────────────────────────────────
	hub := ws.NewHub()

	// ── Router ─────────────────────────────────────────────────────────────
	h := api.NewHandler(database, hub)
	rl := middleware.NewRateLimiter(10, 30) // 10 req/s, burst 30

	r := mux.NewRouter()
	r.Use(corsMiddleware)

	// Public
	r.HandleFunc("/health", h.Health).Methods(http.MethodGet, http.MethodOptions)
	r.HandleFunc("/ws/alerts", hub.ServeWS)

	// Protected API routes
	protected := r.PathPrefix("").Subrouter()
	protected.Use(middleware.APIKeyAuth(database))
	protected.Use(rl.Middleware)

	protected.HandleFunc("/geofences", h.CreateGeofence).Methods(http.MethodPost, http.MethodOptions)
	protected.HandleFunc("/geofences", h.ListGeofences).Methods(http.MethodGet, http.MethodOptions)

	protected.HandleFunc("/vehicles", h.CreateVehicle).Methods(http.MethodPost, http.MethodOptions)
	protected.HandleFunc("/vehicles", h.ListVehicles).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/vehicles/location", h.UpdateVehicleLocation).Methods(http.MethodPost, http.MethodOptions)
	protected.HandleFunc("/vehicles/location/{vehicle_id}", h.GetVehicleLocation).Methods(http.MethodGet, http.MethodOptions)

	protected.HandleFunc("/alerts/configure", h.ConfigureAlert).Methods(http.MethodPost, http.MethodOptions)
	protected.HandleFunc("/alerts", h.ListAlerts).Methods(http.MethodGet, http.MethodOptions)

	protected.HandleFunc("/violations/history", h.ListViolations).Methods(http.MethodGet, http.MethodOptions)

	// ── Server ─────────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("server listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Println("server stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers for all requests
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization")

		// Handle preflight OPTIONS requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
