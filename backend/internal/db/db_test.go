package db

import (
	"strings"
	"testing"
)

// ── coordsToWKT ────────────────────────────────────────────────────────────

func TestCoordsToWKT(t *testing.T) {
	coords := [][]float64{
		{77.5946, 12.9716},
		{77.6246, 12.9716},
		{77.6246, 12.9916},
		{77.5946, 12.9916},
		{77.5946, 12.9716},
	}
	wkt := coordsToWKT(coords)

	if !strings.HasPrefix(wkt, "POLYGON((") {
		t.Errorf("expected POLYGON(( prefix, got %q", wkt[:20])
	}
	if !strings.HasSuffix(wkt, "))") {
		t.Errorf("expected )) suffix, got %q", wkt[len(wkt)-5:])
	}
	// Should contain lng lat pairs
	if !strings.Contains(wkt, "77.594600 12.971600") {
		t.Errorf("expected coordinate pair in WKT, got %q", wkt)
	}
}

func TestCoordsToWKT_SinglePoint(t *testing.T) {
	coords := [][]float64{{10.0, 20.0}}
	wkt := coordsToWKT(coords)
	if !strings.Contains(wkt, "10.000000 20.000000") {
		t.Errorf("unexpected WKT: %q", wkt)
	}
}

// ── parseGeoJSONPolygon ────────────────────────────────────────────────────

func TestParseGeoJSONPolygon(t *testing.T) {
	// Typical PostGIS ST_AsGeoJSON output
	geoJSON := `{"type":"Polygon","coordinates":[[[77.5946,12.9716],[77.6246,12.9716],[77.6246,12.9916],[77.5946,12.9716]]]}`

	coords := parseGeoJSONPolygon(geoJSON)
	if len(coords) != 4 {
		t.Fatalf("expected 4 coords, got %d", len(coords))
	}
	if coords[0][0] != 77.5946 {
		t.Errorf("expected lng=77.5946, got %v", coords[0][0])
	}
	if coords[0][1] != 12.9716 {
		t.Errorf("expected lat=12.9716, got %v", coords[0][1])
	}
}

func TestParseGeoJSONPolygon_Invalid(t *testing.T) {
	// Should return nil gracefully on malformed input
	coords := parseGeoJSONPolygon(`{"type":"Point","coordinates":[1,2]}`)
	if coords != nil {
		t.Errorf("expected nil for non-polygon GeoJSON, got %v", coords)
	}
}

func TestParseGeoJSONPolygon_Empty(t *testing.T) {
	coords := parseGeoJSONPolygon("")
	if coords != nil {
		t.Errorf("expected nil for empty string")
	}
}

// ── Round-trip: coordsToWKT -> parse ──────────────────────────────────────
// We can't test the full DB round-trip without PostGIS, but we can verify
// our WKT output format is consistent.

func TestWKTFormat(t *testing.T) {
	coords := [][]float64{{1.0, 2.0}, {3.0, 2.0}, {3.0, 4.0}, {1.0, 2.0}}
	wkt := coordsToWKT(coords)

	// Count coordinate pairs (separated by comma)
	inner := strings.TrimPrefix(wkt, "POLYGON((")
	inner = strings.TrimSuffix(inner, "))")
	pairs := strings.Split(inner, ",")
	if len(pairs) != 4 {
		t.Errorf("expected 4 coordinate pairs, got %d: %v", len(pairs), pairs)
	}
}
