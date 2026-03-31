package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yourusername/geofence-tracker/internal/models"
)

// ── Helpers ────────────────────────────────────────────────────────────────

func decodeResponse(t *testing.T, body *bytes.Buffer) models.APIResponse {
	t.Helper()
	var resp models.APIResponse
	if err := json.NewDecoder(body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

func postJSON(t *testing.T, handler http.HandlerFunc, path string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler(rr, req)
	return rr
}

// ── Geofence validation tests (no DB needed) ───────────────────────────────

func TestValidateGeofenceRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     models.CreateGeofenceRequest
		wantErr string
	}{
		{
			name:    "missing name",
			req:     models.CreateGeofenceRequest{Coordinates: closedSquare()},
			wantErr: "geofence_name is required",
		},
		{
			name: "too few points",
			req: models.CreateGeofenceRequest{
				Name:        "Test",
				Coordinates: [][]float64{{0, 0}, {1, 0}, {0, 0}},
			},
			wantErr: "polygon requires at least 4 points",
		},
		{
			name: "not closed",
			req: models.CreateGeofenceRequest{
				Name:        "Test",
				Coordinates: [][]float64{{0, 0}, {1, 0}, {1, 1}, {0, 1}}, // 4 pts but not closed
			},
			wantErr: "polygon must be closed",
		},
		{
			name: "longitude out of range",
			req: models.CreateGeofenceRequest{
				Name:        "Test",
				Coordinates: [][]float64{{-181, 0}, {1, 0}, {1, 1}, {0, 1}, {-181, 0}},
			},
			wantErr: "coordinates out of valid lat/lon range",
		},
		{
			name: "latitude out of range",
			req: models.CreateGeofenceRequest{
				Name:        "Test",
				Coordinates: [][]float64{{0, 91}, {1, 0}, {1, 1}, {0, 1}, {0, 91}},
			},
			wantErr: "coordinates out of valid lat/lon range",
		},
		{
			name:    "valid",
			req:     models.CreateGeofenceRequest{Name: "Zone A", Coordinates: closedSquare()},
			wantErr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateGeofenceRequest(tt.req)
			if tt.wantErr == "" {
				if err != "" {
					t.Errorf("expected no error, got %q", err)
				}
				return
			}
			if err == "" {
				t.Errorf("expected error %q, got none", tt.wantErr)
				return
			}
			if err != tt.wantErr {
				t.Errorf("expected error %q, got %q", tt.wantErr, err)
			}
		})
	}
}

// validateGeofenceRequest mirrors the inline logic in CreateGeofence handler.
// Extracted so it can be tested without a DB.
func validateGeofenceRequest(req models.CreateGeofenceRequest) string {
	if req.Name == "" {
		return "geofence_name is required"
	}
	if len(req.Coordinates) < 4 {
		return "polygon requires at least 4 points"
	}
	first := req.Coordinates[0]
	last := req.Coordinates[len(req.Coordinates)-1]
	if first[0] != last[0] || first[1] != last[1] {
		return "polygon must be closed (first and last point must be equal)"
	}
	for _, c := range req.Coordinates {
		if len(c) < 2 || c[0] < -180 || c[0] > 180 || c[1] < -90 || c[1] > 90 {
			return "coordinates out of valid lat/lon range"
		}
	}
	return ""
}

func closedSquare() [][]float64 {
	return [][]float64{{0, 0}, {1, 0}, {1, 1}, {0, 1}, {0, 0}}
}

// ── Location validation tests ──────────────────────────────────────────────

func TestValidateLocationRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     models.UpdateLocationRequest
		wantErr string
	}{
		{name: "missing vehicle_id", req: models.UpdateLocationRequest{Latitude: 12.9, Longitude: 77.5}, wantErr: "vehicle_id is required"},
		{name: "lat too low",  req: models.UpdateLocationRequest{VehicleID: 1, Latitude: -91, Longitude: 0}, wantErr: "invalid latitude or longitude"},
		{name: "lat too high", req: models.UpdateLocationRequest{VehicleID: 1, Latitude: 91, Longitude: 0}, wantErr: "invalid latitude or longitude"},
		{name: "lng too low",  req: models.UpdateLocationRequest{VehicleID: 1, Latitude: 0, Longitude: -181}, wantErr: "invalid latitude or longitude"},
		{name: "lng too high", req: models.UpdateLocationRequest{VehicleID: 1, Latitude: 0, Longitude: 181}, wantErr: "invalid latitude or longitude"},
		{name: "valid",        req: models.UpdateLocationRequest{VehicleID: 1, Latitude: 12.97, Longitude: 77.59}, wantErr: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateLocationRequest(tt.req)
			if err != tt.wantErr {
				t.Errorf("expected %q got %q", tt.wantErr, err)
			}
		})
	}
}

func validateLocationRequest(req models.UpdateLocationRequest) string {
	if req.VehicleID == 0 {
		return "vehicle_id is required"
	}
	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		return "invalid latitude or longitude"
	}
	return ""
}

// ── Alert config validation ────────────────────────────────────────────────

func TestValidateAlertConfig(t *testing.T) {
	tests := []struct {
		name    string
		req     models.ConfigureAlertRequest
		wantErr string
	}{
		{name: "missing geofence", req: models.ConfigureAlertRequest{EventType: "entry"}, wantErr: "geofence_id is required"},
		{name: "bad event type",   req: models.ConfigureAlertRequest{GeofenceID: 1, EventType: "blah"}, wantErr: "event_type must be entry, exit, or both"},
		{name: "valid entry",      req: models.ConfigureAlertRequest{GeofenceID: 1, EventType: "entry"}, wantErr: ""},
		{name: "valid exit",       req: models.ConfigureAlertRequest{GeofenceID: 1, EventType: "exit"}, wantErr: ""},
		{name: "valid both",       req: models.ConfigureAlertRequest{GeofenceID: 1, EventType: "both"}, wantErr: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAlertConfig(tt.req)
			if err != tt.wantErr {
				t.Errorf("expected %q got %q", tt.wantErr, err)
			}
		})
	}
}

func validateAlertConfig(req models.ConfigureAlertRequest) string {
	if req.GeofenceID == 0 {
		return "geofence_id is required"
	}
	if req.EventType != "entry" && req.EventType != "exit" && req.EventType != "both" {
		return "event_type must be entry, exit, or both"
	}
	return ""
}

// ── APIResponse shape ──────────────────────────────────────────────────────

func TestAPIResponseAlwaysHasTimeNS(t *testing.T) {
	// A response struct should always serialize time_ns
	resp := models.APIResponse{
		Success: true,
		Data:    "hello",
		TimeNS:  12345,
	}
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := m["time_ns"]; !ok {
		t.Error("time_ns field missing from API response")
	}
}

func TestAPIResponseErrorShape(t *testing.T) {
	resp := models.APIResponse{Success: false, Error: "something went wrong", TimeNS: 999}
	b, _ := json.Marshal(resp)
	var m map[string]interface{}
	json.Unmarshal(b, &m)

	if m["success"] != false {
		t.Error("expected success=false")
	}
	if m["error"] != "something went wrong" {
		t.Error("expected error field")
	}
}
