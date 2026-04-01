package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/EsakkiRajan18/geofence-tracker/internal/db"
	"github.com/EsakkiRajan18/geofence-tracker/internal/models"
	ws "github.com/EsakkiRajan18/geofence-tracker/internal/websocket"
)

type Handler struct {
	db  *db.DB
	hub *ws.Hub
}

func NewHandler(database *db.DB, hub *ws.Hub) *Handler {
	return &Handler{db: database, hub: hub}
}

// ── helpers ────────────────────────────────────────────────────────────────

func (h *Handler) respond(w http.ResponseWriter, start time.Time, status int, data interface{}, errMsg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	resp := models.APIResponse{
		Success: errMsg == "",
		TimeNS:  time.Since(start).Nanoseconds(),
	}
	if errMsg != "" {
		resp.Error = errMsg
	} else {
		resp.Data = data
	}
	json.NewEncoder(w).Encode(resp)
}

func parseIntQuery(r *http.Request, key string) (*int64, error) {
	s := r.URL.Query().Get(key)
	if s == "" {
		return nil, nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid %s", key)
	}
	return &v, nil
}

// ── Geofences ──────────────────────────────────────────────────────────────

func (h *Handler) CreateGeofence(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req models.CreateGeofenceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid request body: "+err.Error())
		return
	}

	// Validation
	if req.Name == "" {
		h.respond(w, start, http.StatusBadRequest, nil, "geofence_name is required")
		return
	}
	if len(req.Coordinates) < 4 {
		h.respond(w, start, http.StatusBadRequest, nil, "polygon requires at least 4 points")
		return
	}
	// Closed polygon check
	first := req.Coordinates[0]
	last := req.Coordinates[len(req.Coordinates)-1]
	if first[0] != last[0] || first[1] != last[1] {
		h.respond(w, start, http.StatusBadRequest, nil, "polygon must be closed (first and last point must be equal)")
		return
	}
	// Coordinate range check
	for _, c := range req.Coordinates {
		if len(c) < 2 || c[0] < -180 || c[0] > 180 || c[1] < -90 || c[1] > 90 {
			h.respond(w, start, http.StatusBadRequest, nil, "coordinates out of valid lat/lon range")
			return
		}
	}

	g, err := h.db.CreateGeofence(req)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, "failed to create geofence: "+err.Error())
		return
	}
	h.respond(w, start, http.StatusCreated, g, "")
}

func (h *Handler) ListGeofences(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	category := r.URL.Query().Get("category")
	geofences, err := h.db.ListGeofences(category)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, err.Error())
		return
	}
	if geofences == nil {
		geofences = []models.Geofence{}
	}
	h.respond(w, start, http.StatusOK, geofences, "")
}

func (h *Handler) DeleteGeofence(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vars := mux.Vars(r)
	geofenceID, err := strconv.ParseInt(vars["geofence_id"], 10, 64)
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid geofence_id")
		return
	}

	// Check if geofence exists
	geofence, err := h.db.GetGeofenceByID(geofenceID)
	if err != nil || geofence == nil {
		h.respond(w, start, http.StatusNotFound, nil, "geofence not found")
		return
	}

	// Delete the geofence
	if err := h.db.DeleteGeofence(geofenceID); err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, "failed to delete geofence: "+err.Error())
		return
	}

	h.respond(w, start, http.StatusOK, map[string]string{"message": "geofence deleted"}, "")
}

// ── Vehicles ───────────────────────────────────────────────────────────────

func (h *Handler) CreateVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req models.CreateVehicleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid request body: "+err.Error())
		return
	}
	if req.VehicleNumber == "" || req.DriverName == "" {
		h.respond(w, start, http.StatusBadRequest, nil, "vehicle_number and driver_name are required")
		return
	}

	v, err := h.db.CreateVehicle(req)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, "failed to create vehicle: "+err.Error())
		return
	}
	h.respond(w, start, http.StatusCreated, v, "")
}

func (h *Handler) ListVehicles(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vehicles, err := h.db.ListVehicles()
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, err.Error())
		return
	}
	if vehicles == nil {
		vehicles = []models.Vehicle{}
	}
	h.respond(w, start, http.StatusOK, vehicles, "")
}

func (h *Handler) DeleteVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vars := mux.Vars(r)
	vehicleID, err := strconv.ParseInt(vars["vehicle_id"], 10, 64)
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid vehicle_id")
		return
	}

	// Check if vehicle exists
	vehicle, err := h.db.GetVehicleByID(vehicleID)
	if err != nil || vehicle == nil {
		h.respond(w, start, http.StatusNotFound, nil, "vehicle not found")
		return
	}

	// Delete the vehicle
	if err := h.db.DeleteVehicle(vehicleID); err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, "failed to delete vehicle: "+err.Error())
		return
	}

	h.respond(w, start, http.StatusOK, map[string]string{"message": "vehicle deleted"}, "")
}

// ── Location ───────────────────────────────────────────────────────────────

func (h *Handler) UpdateVehicleLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req models.UpdateLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid request body: "+err.Error())
		return
	}
	if req.VehicleID == 0 {
		h.respond(w, start, http.StatusBadRequest, nil, "vehicle_id is required")
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid latitude or longitude")
		return
	}

	vehicle, err := h.db.GetVehicleByID(req.VehicleID)
	if err != nil || vehicle == nil {
		h.respond(w, start, http.StatusNotFound, nil, "vehicle not found")
		return
	}

	// Store location
	if _, err := h.db.InsertLocation(req); err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, "failed to store location: "+err.Error())
		return
	}

	// Geofence detection
	currentGeofences, err := h.db.GetGeofencesContaining(req.Latitude, req.Longitude)
	if err != nil {
		log.Printf("geofence detection error: %v", err)
	}

	prevState, err := h.db.GetPreviousGeofenceState(req.VehicleID)
	if err != nil {
		log.Printf("prev state error: %v", err)
	}

	currentIDs := make([]int64, 0, len(currentGeofences))
	currentMap := map[int64]models.Geofence{}
	for _, g := range currentGeofences {
		currentIDs = append(currentIDs, g.ID)
		currentMap[g.ID] = g
	}

	// Detect entries and exits — broadcast asynchronously
	go h.processGeofenceEvents(vehicle, req, prevState, currentMap, currentIDs)

	// Update state
	if err := h.db.UpdateGeofenceState(req.VehicleID, currentIDs); err != nil {
		log.Printf("update state error: %v", err)
	}

	type locResponse struct {
		VehicleID       int64            `json:"vehicle_id"`
		Latitude        float64          `json:"latitude"`
		Longitude       float64          `json:"longitude"`
		ActiveGeofences []models.Geofence `json:"active_geofences"`
	}
	if currentGeofences == nil {
		currentGeofences = []models.Geofence{}
	}
	h.respond(w, start, http.StatusOK, locResponse{
		VehicleID:       req.VehicleID,
		Latitude:        req.Latitude,
		Longitude:       req.Longitude,
		ActiveGeofences: currentGeofences,
	}, "")
}

func (h *Handler) processGeofenceEvents(
	vehicle *models.Vehicle,
	req models.UpdateLocationRequest,
	prevState map[int64]bool,
	currentMap map[int64]models.Geofence,
	currentIDs []int64,
) {
	// Entry events
	for id, g := range currentMap {
		if !prevState[id] {
			h.fireEvent(vehicle, g, "entry", req.Latitude, req.Longitude)
		}
	}
	// Exit events
	for id := range prevState {
		if _, still := currentMap[id]; !still {
			gf, err := h.db.GetGeofenceByID(id)
			if err != nil || gf == nil {
				continue
			}
			h.fireEvent(vehicle, *gf, "exit", req.Latitude, req.Longitude)
		}
	}
}

func (h *Handler) fireEvent(vehicle *models.Vehicle, g models.Geofence, eventType string, lat, lng float64) {
	eventID, err := h.db.RecordGeofenceEvent(vehicle.ID, g.ID, eventType, lat, lng)
	if err != nil {
		log.Printf("record event error: %v", err)
		return
	}

	// Check if any alert configs match
	configs, err := h.db.GetMatchingAlertConfigs(vehicle.ID, g.ID, eventType)
	if err != nil {
		log.Printf("alert config error: %v", err)
	}
	if len(configs) == 0 {
		return
	}

	msg := models.WSAlertMessage{
		EventID:   eventID,
		EventType: eventType,
		Timestamp: time.Now(),
	}
	msg.Vehicle.VehicleID = vehicle.ID
	msg.Vehicle.VehicleNumber = vehicle.VehicleNumber
	msg.Vehicle.DriverName = vehicle.DriverName
	msg.Geofence.GeofenceID = g.ID
	msg.Geofence.GeofenceName = g.Name
	msg.Geofence.Category = g.Category
	msg.Location.Latitude = lat
	msg.Location.Longitude = lng

	h.hub.Broadcast(msg)
}

func (h *Handler) GetVehicleLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vars := mux.Vars(r)
	vehicleID, err := strconv.ParseInt(vars["vehicle_id"], 10, 64)
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid vehicle_id")
		return
	}

	vehicle, err := h.db.GetVehicleByID(vehicleID)
	if err != nil || vehicle == nil {
		h.respond(w, start, http.StatusNotFound, nil, "vehicle not found")
		return
	}

	loc, err := h.db.GetLatestLocation(vehicleID)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, err.Error())
		return
	}

	active, err := h.db.GetActiveGeofencesForVehicle(vehicleID)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, err.Error())
		return
	}
	if active == nil {
		active = []models.Geofence{}
	}

	h.respond(w, start, http.StatusOK, models.VehicleLocationResponse{
		Vehicle:         *vehicle,
		CurrentLocation: loc,
		ActiveGeofences: active,
	}, "")
}

// ── Alerts ─────────────────────────────────────────────────────────────────

func (h *Handler) ConfigureAlert(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req models.ConfigureAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid request body: "+err.Error())
		return
	}
	if req.GeofenceID == 0 {
		h.respond(w, start, http.StatusBadRequest, nil, "geofence_id is required")
		return
	}
	if req.EventType != "entry" && req.EventType != "exit" && req.EventType != "both" {
		h.respond(w, start, http.StatusBadRequest, nil, "event_type must be entry, exit, or both")
		return
	}

	a, err := h.db.CreateAlertConfig(req)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, "failed to configure alert: "+err.Error())
		return
	}
	h.respond(w, start, http.StatusCreated, a, "")
}

func (h *Handler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	geofenceID, err := parseIntQuery(r, "geofence_id")
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, err.Error())
		return
	}
	vehicleID, err := parseIntQuery(r, "vehicle_id")
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, err.Error())
		return
	}

	alerts, err := h.db.ListAlertConfigs(geofenceID, vehicleID)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, err.Error())
		return
	}
	if alerts == nil {
		alerts = []models.AlertConfig{}
	}
	h.respond(w, start, http.StatusOK, alerts, "")
}

func (h *Handler) DeleteAlert(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	vars := mux.Vars(r)
	alertID, err := strconv.ParseInt(vars["alert_id"], 10, 64)
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, "invalid alert_id")
		return
	}

	// Delete the alert
	if err := h.db.DeleteAlertConfig(alertID); err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, "failed to delete alert: "+err.Error())
		return
	}

	h.respond(w, start, http.StatusOK, map[string]string{"message": "alert deleted"}, "")
}

// ── Violations ─────────────────────────────────────────────────────────────

func (h *Handler) ListViolations(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	vehicleID, err := parseIntQuery(r, "vehicle_id")
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, err.Error())
		return
	}
	geofenceID, err := parseIntQuery(r, "geofence_id")
	if err != nil {
		h.respond(w, start, http.StatusBadRequest, nil, err.Error())
		return
	}

	var from, to *time.Time
	if s := r.URL.Query().Get("from"); s != "" {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			h.respond(w, start, http.StatusBadRequest, nil, "invalid 'from' date; use RFC3339")
			return
		}
		from = &t
	}
	if s := r.URL.Query().Get("to"); s != "" {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			h.respond(w, start, http.StatusBadRequest, nil, "invalid 'to' date; use RFC3339")
			return
		}
		to = &t
	}

	page := 1
	pageSize := 20
	if s := r.URL.Query().Get("page"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			page = v
		}
	}
	if s := r.URL.Query().Get("page_size"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			pageSize = v
		}
	}

	filter := db.ViolationFilter{
		VehicleID:  vehicleID,
		GeofenceID: geofenceID,
		From:       from,
		To:         to,
		Page:       page,
		PageSize:   pageSize,
	}

	events, total, err := h.db.ListGeofenceEvents(filter)
	if err != nil {
		h.respond(w, start, http.StatusInternalServerError, nil, err.Error())
		return
	}
	if events == nil {
		events = []models.GeofenceEvent{}
	}

	totalPages := total / pageSize
	if total%pageSize != 0 {
		totalPages++
	}

	h.respond(w, start, http.StatusOK, models.PaginatedResponse{
		Data:       events,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, "")
}

// ── Health ─────────────────────────────────────────────────────────────────

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	h.respond(w, start, http.StatusOK, map[string]string{
		"status":     "ok",
		"ws_clients": strconv.Itoa(h.hub.ClientCount()),
	}, "")
}
