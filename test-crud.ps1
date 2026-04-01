#!/usr/bin/env pwsh
# CRUD Testing Script for Geofence Tracker

$apiKey = "dev-secret-key-change-me"
$baseUrl = "http://localhost/api"

Write-Host "`n=== GEOFENCE CRUD TESTS ===" -ForegroundColor Cyan

# Test CREATE Geofence
Write-Host "`n[1] Testing CREATE Geofence..." -ForegroundColor Yellow
$geoPayload = @{
    geofence_name = "Test Geofence $(Get-Random 1000)"
    category = "commercial"
    description = "CRUD Test"
    coordinates = @(@(77.58, 12.89), @(77.65, 12.89), @(77.65, 12.95), @(77.58, 12.95), @(77.58, 12.89))
} | ConvertTo-Json

$createGeo = curl.exe -s -X POST "$baseUrl/geofences" -H "X-API-Key: $apiKey" -H "Content-Type: application/json" -d $geoPayload | ConvertFrom-Json
$geoId = $createGeo.data.geofence_id

if ($createGeo.success -and $geoId) {
    Write-Host "✓ Created geofence ID: $geoId" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create geofence" -ForegroundColor Red; exit 1
}

# Test READ Geofences
Write-Host "`n[2] Testing READ Geofences..." -ForegroundColor Yellow
$readGeo = curl.exe -s "$baseUrl/geofences" -H "X-API-Key: $apiKey" | ConvertFrom-Json
$found = $readGeo.data | Where-Object { $_.geofence_id -eq $geoId }

if ($found) {
    Write-Host "✓ Geofence found: $($found.geofence_name)" -ForegroundColor Green
} else {
    Write-Host "✗ Geofence not found in list" -ForegroundColor Red; exit 1
}

# Test DELETE Geofence
Write-Host "`n[3] Testing DELETE Geofence..." -ForegroundColor Yellow
$deleteGeo = curl.exe -s -X DELETE "$baseUrl/geofences/$geoId" -H "X-API-Key: $apiKey" | ConvertFrom-Json

if ($deleteGeo.success) {
    Write-Host "✓ Geofence deleted" -ForegroundColor Green
} else {
    Write-Host "✗ Delete failed: $($deleteGeo.error)" -ForegroundColor Red; exit 1
}

# Verify deletion
$verifyGeo = curl.exe -s "$baseUrl/geofences" -H "X-API-Key: $apiKey" | ConvertFrom-Json
$stillFound = $verifyGeo.data | Where-Object { $_.geofence_id -eq $geoId }

if (!$stillFound) {
    Write-Host "✓ Deletion verified" -ForegroundColor Green
} else {
    Write-Host "✗ Geofence still exists" -ForegroundColor Red; exit 1
}

# ============================================================================

Write-Host "`n=== VEHICLE CRUD TESTS ===" -ForegroundColor Cyan

# Test CREATE Vehicle
Write-Host "`n[1] Testing CREATE Vehicle..." -ForegroundColor Yellow
$vehPayload = @{
    vehicle_number = "TST-TEST-$(Get-Random 1000)"
    driver_name = "Test Driver"
    vehicle_type = "Car"
    phone = "9876543210"
} | ConvertTo-Json

$createVeh = curl.exe -s -X POST "$baseUrl/vehicles" -H "X-API-Key: $apiKey" -H "Content-Type: application/json" -d $vehPayload | ConvertFrom-Json
$vehId = $createVeh.data.vehicle_id

if ($createVeh.success -and $vehId) {
    Write-Host "✓ Created vehicle ID: $vehId" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create vehicle" -ForegroundColor Red; exit 1
}

# Test READ Vehicles
Write-Host "`n[2] Testing READ Vehicles..." -ForegroundColor Yellow
$readVeh = curl.exe -s "$baseUrl/vehicles" -H "X-API-Key: $apiKey" | ConvertFrom-Json
$found = $readVeh.data | Where-Object { $_.vehicle_id -eq $vehId }

if ($found) {
    Write-Host "✓ Vehicle found: $($found.vehicle_number)" -ForegroundColor Green
} else {
    Write-Host "✗ Vehicle not found in list" -ForegroundColor Red; exit 1
}

# Test DELETE Vehicle
Write-Host "`n[3] Testing DELETE Vehicle..." -ForegroundColor Yellow
$deleteVeh = curl.exe -s -X DELETE "$baseUrl/vehicles/$vehId" -H "X-API-Key: $apiKey" | ConvertFrom-Json

if ($deleteVeh.success) {
    Write-Host "✓ Vehicle deleted" -ForegroundColor Green
} else {
    Write-Host "✗ Delete failed: $($deleteVeh.error)" -ForegroundColor Red; exit 1
}

# Verify deletion
$verifyVeh = curl.exe -s "$baseUrl/vehicles" -H "X-API-Key: $apiKey" | ConvertFrom-Json
$stillFound = $verifyVeh.data | Where-Object { $_.vehicle_id -eq $vehId }

if (!$stillFound) {
    Write-Host "✓ Deletion verified" -ForegroundColor Green
} else {
    Write-Host "✗ Vehicle still exists" -ForegroundColor Red; exit 1
}

# ============================================================================

Write-Host "`n=== ALERT CRUD TESTS ===" -ForegroundColor Cyan

# Get existing geofence for alert test
$geos = curl.exe -s "$baseUrl/geofences" -H "X-API-Key: $apiKey" | ConvertFrom-Json
if (!$geos.data -or $geos.data.Count -eq 0) {
    Write-Host "⚠ No geofences available - skipping alert tests" -ForegroundColor Yellow
} else {
    $testGeoId = $geos.data[0].geofence_id

    # Test CREATE Alert
    Write-Host "`n[1] Testing CREATE Alert..." -ForegroundColor Yellow
    $alertPayload = @{
        geofence_id = $testGeoId
        event_type = "both"
    } | ConvertTo-Json

    $createAlert = curl.exe -s -X POST "$baseUrl/alerts/configure" -H "X-API-Key: $apiKey" -H "Content-Type: application/json" -d $alertPayload | ConvertFrom-Json
    
    if ($createAlert.success -and $createAlert.data.alert_id) {
        $alertId = $createAlert.data.alert_id
        Write-Host "✓ Created alert ID: $alertId" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to create alert" -ForegroundColor Red; exit 1
    }

    # Test READ Alerts
    Write-Host "`n[2] Testing READ Alerts..." -ForegroundColor Yellow
    $readAlert = curl.exe -s "$baseUrl/alerts" -H "X-API-Key: $apiKey" | ConvertFrom-Json
    $found = $readAlert.data | Where-Object { $_.alert_id -eq $alertId }

    if ($found) {
        Write-Host "✓ Alert found in list" -ForegroundColor Green
    } else {
        Write-Host "✗ Alert not found in list" -ForegroundColor Red; exit 1
    }

    # Test DELETE Alert
    Write-Host "`n[3] Testing DELETE Alert..." -ForegroundColor Yellow
    $deleteAlert = curl.exe -s -X DELETE "$baseUrl/alerts/$alertId" -H "X-API-Key: $apiKey" | ConvertFrom-Json

    if ($deleteAlert.success) {
        Write-Host "✓ Alert deleted" -ForegroundColor Green
    } else {
        Write-Host "✗ Delete failed: $($deleteAlert.error)" -ForegroundColor Red; exit 1
    }

    # Verify deletion
    $verifyAlert = curl.exe -s "$baseUrl/alerts" -H "X-API-Key: $apiKey" | ConvertFrom-Json
    $stillFound = $verifyAlert.data | Where-Object { $_.alert_id -eq $alertId }

    if (!$stillFound) {
        Write-Host "✓ Deletion verified" -ForegroundColor Green
    } else {
        Write-Host "✗ Alert still exists" -ForegroundColor Red; exit 1
    }
}

Write-Host "`n$([char]27)[92m✓ ALL CRUD TESTS PASSED!$([char]27)[0m" -ForegroundColor Green
Write-Host "✓ Geofences: CREATE ✓ READ ✓ DELETE" -ForegroundColor Green
Write-Host "✓ Vehicles: CREATE ✓ READ ✓ DELETE" -ForegroundColor Green
Write-Host "✓ Alerts: CREATE ✓ READ ✓ DELETE" -ForegroundColor Green
Write-Host ""