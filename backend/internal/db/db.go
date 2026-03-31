package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/EsakkiRajan18/geofence-tracker/internal/models"
)

type DB struct {
	conn *sql.DB
}

func New(connStr string) (*DB, error) {
	conn, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("opening db: %w", err)
	}
	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(5 * time.Minute)
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("pinging db: %w", err)
	}
	return &DB{conn: conn}, nil
}

func (d *DB) Close() error { return d.conn.Close() }

func (d *DB) Migrate() error {
	_, err := d.conn.Exec(schema)
	return err
}

const schema = `
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS geofences (
	id          BIGSERIAL PRIMARY KEY,
	name        VARCHAR(255) NOT NULL,
	category    VARCHAR(100) NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	boundary    GEOMETRY(POLYGON, 4326) NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geofences_boundary ON geofences USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_geofences_category ON geofences(category);

CREATE TABLE IF NOT EXISTS vehicles (
	id             BIGSERIAL PRIMARY KEY,
	vehicle_number VARCHAR(50) NOT NULL UNIQUE,
	driver_name    VARCHAR(255) NOT NULL,
	vehicle_type   VARCHAR(100) NOT NULL,
	phone          VARCHAR(20) NOT NULL,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_locations (
	id          BIGSERIAL PRIMARY KEY,
	vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
	position    GEOMETRY(POINT, 4326) NOT NULL,
	latitude    DOUBLE PRECISION NOT NULL,
	longitude   DOUBLE PRECISION NOT NULL,
	speed       DOUBLE PRECISION NOT NULL DEFAULT 0,
	heading     DOUBLE PRECISION NOT NULL DEFAULT 0,
	recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_position  ON vehicle_locations USING GIST(position);

CREATE TABLE IF NOT EXISTS vehicle_geofence_state (
	vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
	geofence_id BIGINT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
	entered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (vehicle_id, geofence_id)
);

CREATE TABLE IF NOT EXISTS geofence_events (
	id          BIGSERIAL PRIMARY KEY,
	vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
	geofence_id BIGINT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
	event_type  VARCHAR(10) NOT NULL CHECK (event_type IN ('entry','exit')),
	latitude    DOUBLE PRECISION NOT NULL,
	longitude   DOUBLE PRECISION NOT NULL,
	occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle_id  ON geofence_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_id ON geofence_events(geofence_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_occurred_at ON geofence_events(occurred_at);

CREATE TABLE IF NOT EXISTS alert_configs (
	id          BIGSERIAL PRIMARY KEY,
	geofence_id BIGINT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
	vehicle_id  BIGINT REFERENCES vehicles(id) ON DELETE CASCADE,
	event_type  VARCHAR(10) NOT NULL CHECK (event_type IN ('entry','exit','both')),
	is_active   BOOLEAN NOT NULL DEFAULT TRUE,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
	id         BIGSERIAL PRIMARY KEY,
	key_hash   VARCHAR(255) NOT NULL UNIQUE,
	name       VARCHAR(100) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// ── Geofences ──────────────────────────────────────────────────────────────

func (d *DB) CreateGeofence(req models.CreateGeofenceRequest) (*models.Geofence, error) {
	wkt := coordsToWKT(req.Coordinates)
	var g models.Geofence
	err := d.conn.QueryRow(`
		INSERT INTO geofences (name, category, description, boundary)
		VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))
		RETURNING id, name, category, description, created_at`,
		req.Name, req.Category, req.Description, wkt,
	).Scan(&g.ID, &g.Name, &g.Category, &g.Description, &g.CreatedAt)
	if err != nil {
		return nil, err
	}
	g.Coordinates = req.Coordinates
	return &g, nil
}

func (d *DB) ListGeofences(category string) ([]models.Geofence, error) {
	query := `
		SELECT id, name, category, description,
		       ST_AsGeoJSON(boundary)::text, created_at
		FROM geofences`
	args := []interface{}{}
	if category != "" {
		query += " WHERE category = $1"
		args = append(args, category)
	}
	query += " ORDER BY created_at DESC"

	rows, err := d.conn.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var geofences []models.Geofence
	for rows.Next() {
		var g models.Geofence
		var geoJSON string
		if err := rows.Scan(&g.ID, &g.Name, &g.Category, &g.Description, &geoJSON, &g.CreatedAt); err != nil {
			return nil, err
		}
		g.Coordinates = parseGeoJSONPolygon(geoJSON)
		geofences = append(geofences, g)
	}
	return geofences, rows.Err()
}

func (d *DB) GetGeofenceByID(id int64) (*models.Geofence, error) {
	var g models.Geofence
	var geoJSON string
	err := d.conn.QueryRow(`
		SELECT id, name, category, description,
		       ST_AsGeoJSON(boundary)::text, created_at
		FROM geofences WHERE id = $1`, id,
	).Scan(&g.ID, &g.Name, &g.Category, &g.Description, &geoJSON, &g.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	g.Coordinates = parseGeoJSONPolygon(geoJSON)
	return &g, nil
}

// ── Vehicles ───────────────────────────────────────────────────────────────

func (d *DB) CreateVehicle(req models.CreateVehicleRequest) (*models.Vehicle, error) {
	var v models.Vehicle
	err := d.conn.QueryRow(`
		INSERT INTO vehicles (vehicle_number, driver_name, vehicle_type, phone)
		VALUES ($1, $2, $3, $4)
		RETURNING id, vehicle_number, driver_name, vehicle_type, phone, created_at`,
		req.VehicleNumber, req.DriverName, req.VehicleType, req.Phone,
	).Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.CreatedAt)
	return &v, err
}

func (d *DB) ListVehicles() ([]models.Vehicle, error) {
	rows, err := d.conn.Query(`
		SELECT id, vehicle_number, driver_name, vehicle_type, phone, created_at
		FROM vehicles ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		if err := rows.Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.CreatedAt); err != nil {
			return nil, err
		}
		vehicles = append(vehicles, v)
	}
	return vehicles, rows.Err()
}

func (d *DB) GetVehicleByID(id int64) (*models.Vehicle, error) {
	var v models.Vehicle
	err := d.conn.QueryRow(`
		SELECT id, vehicle_number, driver_name, vehicle_type, phone, created_at
		FROM vehicles WHERE id = $1`, id,
	).Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &v, err
}

// ── Location ───────────────────────────────────────────────────────────────

// InsertLocation stores a location record and returns the new row ID.
func (d *DB) InsertLocation(req models.UpdateLocationRequest) (int64, error) {
	var id int64
	err := d.conn.QueryRow(`
		INSERT INTO vehicle_locations (vehicle_id, position, latitude, longitude, speed, heading)
		VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326), $2, $3, $4, $5)
		RETURNING id`,
		req.VehicleID, req.Latitude, req.Longitude, req.Speed, req.Heading,
	).Scan(&id)
	return id, err
}

// GetLatestLocation returns the most recent location for a vehicle.
func (d *DB) GetLatestLocation(vehicleID int64) (*models.VehicleLocation, error) {
	var l models.VehicleLocation
	err := d.conn.QueryRow(`
		SELECT id, vehicle_id, latitude, longitude, speed, heading, recorded_at
		FROM vehicle_locations
		WHERE vehicle_id = $1
		ORDER BY recorded_at DESC LIMIT 1`, vehicleID,
	).Scan(&l.ID, &l.VehicleID, &l.Latitude, &l.Longitude, &l.Speed, &l.Heading, &l.RecordedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &l, err
}

// GetGeofencesContaining returns geofences whose boundary contains the given point.
func (d *DB) GetGeofencesContaining(lat, lng float64) ([]models.Geofence, error) {
	rows, err := d.conn.Query(`
		SELECT id, name, category, description,
		       ST_AsGeoJSON(boundary)::text, created_at
		FROM geofences
		WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint($2, $1), 4326))`,
		lat, lng)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.Geofence
	for rows.Next() {
		var g models.Geofence
		var geoJSON string
		if err := rows.Scan(&g.ID, &g.Name, &g.Category, &g.Description, &geoJSON, &g.CreatedAt); err != nil {
			return nil, err
		}
		g.Coordinates = parseGeoJSONPolygon(geoJSON)
		result = append(result, g)
	}
	return result, rows.Err()
}

// GetPreviousGeofenceState returns the set of geofence IDs a vehicle was last inside.
func (d *DB) GetPreviousGeofenceState(vehicleID int64) (map[int64]bool, error) {
	rows, err := d.conn.Query(`
		SELECT geofence_id FROM vehicle_geofence_state WHERE vehicle_id = $1`, vehicleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	state := map[int64]bool{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		state[id] = true
	}
	return state, rows.Err()
}

// UpdateGeofenceState replaces the vehicle's current geofence membership.
func (d *DB) UpdateGeofenceState(vehicleID int64, geofenceIDs []int64) error {
	tx, err := d.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM vehicle_geofence_state WHERE vehicle_id = $1`, vehicleID); err != nil {
		return err
	}
	for _, gid := range geofenceIDs {
		if _, err := tx.Exec(`
			INSERT INTO vehicle_geofence_state (vehicle_id, geofence_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, vehicleID, gid); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// RecordGeofenceEvent stores an entry/exit event and returns its ID.
func (d *DB) RecordGeofenceEvent(vehicleID, geofenceID int64, eventType string, lat, lng float64) (int64, error) {
	var id int64
	err := d.conn.QueryRow(`
		INSERT INTO geofence_events (vehicle_id, geofence_id, event_type, latitude, longitude)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		vehicleID, geofenceID, eventType, lat, lng,
	).Scan(&id)
	return id, err
}

// GetActiveGeofencesForVehicle returns geofences the vehicle is currently inside.
func (d *DB) GetActiveGeofencesForVehicle(vehicleID int64) ([]models.Geofence, error) {
	rows, err := d.conn.Query(`
		SELECT g.id, g.name, g.category, g.description,
		       ST_AsGeoJSON(g.boundary)::text, g.created_at
		FROM geofences g
		JOIN vehicle_geofence_state s ON s.geofence_id = g.id
		WHERE s.vehicle_id = $1`, vehicleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.Geofence
	for rows.Next() {
		var g models.Geofence
		var geoJSON string
		if err := rows.Scan(&g.ID, &g.Name, &g.Category, &g.Description, &geoJSON, &g.CreatedAt); err != nil {
			return nil, err
		}
		g.Coordinates = parseGeoJSONPolygon(geoJSON)
		result = append(result, g)
	}
	return result, rows.Err()
}

// ── Alerts ─────────────────────────────────────────────────────────────────

func (d *DB) CreateAlertConfig(req models.ConfigureAlertRequest) (*models.AlertConfig, error) {
	var a models.AlertConfig
	err := d.conn.QueryRow(`
		INSERT INTO alert_configs (geofence_id, vehicle_id, event_type)
		VALUES ($1, $2, $3)
		RETURNING id, geofence_id, vehicle_id, event_type, is_active, created_at`,
		req.GeofenceID, req.VehicleID, req.EventType,
	).Scan(&a.ID, &a.GeofenceID, &a.VehicleID, &a.EventType, &a.IsActive, &a.CreatedAt)
	return &a, err
}

func (d *DB) ListAlertConfigs(geofenceID, vehicleID *int64) ([]models.AlertConfig, error) {
	query := `
		SELECT ac.id, ac.geofence_id, ac.vehicle_id, ac.event_type, ac.is_active, ac.created_at,
		       g.name as geofence_name,
		       COALESCE(v.vehicle_number, '') as vehicle_number
		FROM alert_configs ac
		JOIN geofences g ON g.id = ac.geofence_id
		LEFT JOIN vehicles v ON v.id = ac.vehicle_id
		WHERE 1=1`
	args := []interface{}{}
	i := 1
	if geofenceID != nil {
		query += fmt.Sprintf(" AND ac.geofence_id = $%d", i)
		args = append(args, *geofenceID)
		i++
	}
	if vehicleID != nil {
		query += fmt.Sprintf(" AND ac.vehicle_id = $%d", i)
		args = append(args, *vehicleID)
		i++
	}
	query += " ORDER BY ac.created_at DESC"

	rows, err := d.conn.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []models.AlertConfig
	for rows.Next() {
		var a models.AlertConfig
		if err := rows.Scan(&a.ID, &a.GeofenceID, &a.VehicleID, &a.EventType, &a.IsActive, &a.CreatedAt, &a.GeofenceName, &a.VehicleNumber); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

// GetMatchingAlertConfigs returns alert configs that match a vehicle+geofence+event combination.
func (d *DB) GetMatchingAlertConfigs(vehicleID, geofenceID int64, eventType string) ([]models.AlertConfig, error) {
	rows, err := d.conn.Query(`
		SELECT id, geofence_id, vehicle_id, event_type, is_active, created_at
		FROM alert_configs
		WHERE is_active = TRUE
		  AND geofence_id = $1
		  AND (vehicle_id IS NULL OR vehicle_id = $2)
		  AND (event_type = $3 OR event_type = 'both')`,
		geofenceID, vehicleID, eventType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.AlertConfig
	for rows.Next() {
		var a models.AlertConfig
		if err := rows.Scan(&a.ID, &a.GeofenceID, &a.VehicleID, &a.EventType, &a.IsActive, &a.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

// ── Violations History ─────────────────────────────────────────────────────

type ViolationFilter struct {
	VehicleID  *int64
	GeofenceID *int64
	From       *time.Time
	To         *time.Time
	Page       int
	PageSize   int
}

func (d *DB) ListGeofenceEvents(f ViolationFilter) ([]models.GeofenceEvent, int, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 || f.PageSize > 100 {
		f.PageSize = 20
	}

	where := []string{"1=1"}
	args := []interface{}{}
	i := 1

	if f.VehicleID != nil {
		where = append(where, fmt.Sprintf("e.vehicle_id = $%d", i))
		args = append(args, *f.VehicleID)
		i++
	}
	if f.GeofenceID != nil {
		where = append(where, fmt.Sprintf("e.geofence_id = $%d", i))
		args = append(args, *f.GeofenceID)
		i++
	}
	if f.From != nil {
		where = append(where, fmt.Sprintf("e.occurred_at >= $%d", i))
		args = append(args, *f.From)
		i++
	}
	if f.To != nil {
		where = append(where, fmt.Sprintf("e.occurred_at <= $%d", i))
		args = append(args, *f.To)
		i++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	if err := d.conn.QueryRow(
		fmt.Sprintf(`SELECT COUNT(*) FROM geofence_events e WHERE %s`, whereClause),
		args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (f.Page - 1) * f.PageSize
	args = append(args, f.PageSize, offset)

	rows, err := d.conn.Query(fmt.Sprintf(`
		SELECT e.id, e.vehicle_id, e.geofence_id, e.event_type,
		       e.latitude, e.longitude, e.occurred_at,
		       v.vehicle_number, v.driver_name,
		       g.name, g.category
		FROM geofence_events e
		JOIN vehicles v  ON v.id = e.vehicle_id
		JOIN geofences g ON g.id = e.geofence_id
		WHERE %s
		ORDER BY e.occurred_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, i, i+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var events []models.GeofenceEvent
	for rows.Next() {
		var e models.GeofenceEvent
		if err := rows.Scan(
			&e.ID, &e.VehicleID, &e.GeofenceID, &e.EventType,
			&e.Latitude, &e.Longitude, &e.OccurredAt,
			&e.VehicleNumber, &e.DriverName,
			&e.GeofenceName, &e.Category,
		); err != nil {
			return nil, 0, err
		}
		events = append(events, e)
	}
	return events, total, rows.Err()
}

// ── API Keys ───────────────────────────────────────────────────────────────

func (d *DB) GetAPIKeyByHash(hash string) (*models.APIKey, error) {
	var k models.APIKey
	err := d.conn.QueryRow(`
		SELECT id, key_hash, name, created_at FROM api_keys WHERE key_hash = $1`, hash,
	).Scan(&k.ID, &k.KeyHash, &k.Name, &k.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &k, err
}

func (d *DB) SeedAPIKey(hash, name string) error {
	_, err := d.conn.Exec(`
		INSERT INTO api_keys (key_hash, name)
		VALUES ($1, $2) ON CONFLICT DO NOTHING`, hash, name)
	return err
}

// ── Helpers ────────────────────────────────────────────────────────────────

// coordsToWKT converts [[lng,lat],...] to a WKT POLYGON string.
func coordsToWKT(coords [][]float64) string {
	parts := make([]string, len(coords))
	for i, c := range coords {
		parts[i] = fmt.Sprintf("%f %f", c[0], c[1])
	}
	return fmt.Sprintf("POLYGON((%s))", strings.Join(parts, ","))
}

// parseGeoJSONPolygon extracts coordinates from a PostGIS GeoJSON polygon string.
// Returns [[lng,lat],...].
func parseGeoJSONPolygon(geoJSON string) [][]float64 {
	// Fast manual parse to avoid import cycles; GeoJSON looks like:
	// {"type":"Polygon","coordinates":[[[lng,lat],...]]}
	start := strings.Index(geoJSON, "[[[")
	end := strings.LastIndex(geoJSON, "]]]")
	if start == -1 || end == -1 {
		return nil
	}
	inner := geoJSON[start+3 : end]
	pairs := strings.Split(inner, "],[")
	coords := make([][]float64, 0, len(pairs))
	for _, p := range pairs {
		var lng, lat float64
		fmt.Sscanf(strings.TrimSpace(p), "%f,%f", &lng, &lat)
		coords = append(coords, []float64{lng, lat})
	}
	return coords
}
