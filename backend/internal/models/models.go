package models

import "time"

// Geofence represents a polygonal geographic boundary
type Geofence struct {
	ID          int64      `json:"geofence_id" db:"id"`
	Name        string     `json:"geofence_name" db:"name"`
	Category    string     `json:"category" db:"category"`
	Description string     `json:"description,omitempty" db:"description"`
	Coordinates [][]float64 `json:"coordinates"` // [[lng, lat], ...] closed polygon
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// Vehicle represents a registered vehicle
type Vehicle struct {
	ID            int64     `json:"vehicle_id" db:"id"`
	VehicleNumber string    `json:"vehicle_number" db:"vehicle_number"`
	DriverName    string    `json:"driver_name" db:"driver_name"`
	VehicleType   string    `json:"vehicle_type" db:"vehicle_type"`
	Phone         string    `json:"phone" db:"phone"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// VehicleLocation represents a vehicle's current or historical location
type VehicleLocation struct {
	ID         int64     `json:"id" db:"id"`
	VehicleID  int64     `json:"vehicle_id" db:"vehicle_id"`
	Latitude   float64   `json:"latitude" db:"latitude"`
	Longitude  float64   `json:"longitude" db:"longitude"`
	Speed      float64   `json:"speed,omitempty" db:"speed"`
	Heading    float64   `json:"heading,omitempty" db:"heading"`
	RecordedAt time.Time `json:"recorded_at" db:"recorded_at"`
}

// AlertConfig represents a configured alert rule
type AlertConfig struct {
	ID          int64     `json:"alert_id" db:"id"`
	GeofenceID  int64     `json:"geofence_id" db:"geofence_id"`
	VehicleID   *int64    `json:"vehicle_id,omitempty" db:"vehicle_id"`
	EventType   string    `json:"event_type" db:"event_type"` // entry, exit, both
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	// Joined fields
	GeofenceName string `json:"geofence_name,omitempty" db:"geofence_name"`
	VehicleNumber string `json:"vehicle_number,omitempty" db:"vehicle_number"`
}

// GeofenceEvent represents a historical entry/exit event
type GeofenceEvent struct {
	ID          int64     `json:"event_id" db:"id"`
	VehicleID   int64     `json:"vehicle_id" db:"vehicle_id"`
	GeofenceID  int64     `json:"geofence_id" db:"geofence_id"`
	EventType   string    `json:"event_type" db:"event_type"` // entry, exit
	Latitude    float64   `json:"latitude" db:"latitude"`
	Longitude   float64   `json:"longitude" db:"longitude"`
	OccurredAt  time.Time `json:"occurred_at" db:"occurred_at"`
	// Joined fields
	VehicleNumber string `json:"vehicle_number,omitempty" db:"vehicle_number"`
	DriverName    string `json:"driver_name,omitempty" db:"driver_name"`
	GeofenceName  string `json:"geofence_name,omitempty" db:"geofence_name"`
	Category      string `json:"category,omitempty" db:"category"`
}

// WSAlertMessage is the WebSocket broadcast payload
type WSAlertMessage struct {
	EventID   int64     `json:"event_id"`
	EventType string    `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
	Vehicle   struct {
		VehicleID     int64  `json:"vehicle_id"`
		VehicleNumber string `json:"vehicle_number"`
		DriverName    string `json:"driver_name"`
	} `json:"vehicle"`
	Geofence struct {
		GeofenceID   int64  `json:"geofence_id"`
		GeofenceName string `json:"geofence_name"`
		Category     string `json:"category"`
	} `json:"geofence"`
	Location struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"location"`
}

// API request/response types

type CreateGeofenceRequest struct {
	Name        string      `json:"geofence_name"`
	Category    string      `json:"category"`
	Description string      `json:"description"`
	Coordinates [][]float64 `json:"coordinates"`
}

type CreateVehicleRequest struct {
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
	VehicleType   string `json:"vehicle_type"`
	Phone         string `json:"phone"`
}

type UpdateLocationRequest struct {
	VehicleID int64   `json:"vehicle_id"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Speed     float64 `json:"speed,omitempty"`
	Heading   float64 `json:"heading,omitempty"`
}

type ConfigureAlertRequest struct {
	GeofenceID int64  `json:"geofence_id"`
	VehicleID  *int64 `json:"vehicle_id,omitempty"`
	EventType  string `json:"event_type"` // entry, exit, both
}

type VehicleLocationResponse struct {
	Vehicle          Vehicle           `json:"vehicle"`
	CurrentLocation  *VehicleLocation  `json:"current_location"`
	ActiveGeofences  []Geofence        `json:"active_geofences"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	TimeNS  int64       `json:"time_ns"`
}

type APIKey struct {
	ID        int64     `json:"id" db:"id"`
	KeyHash   string    `json:"-" db:"key_hash"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
