-- Insert sample geofence
INSERT INTO geofences (name, category, description, boundary) VALUES (
  'Downtown Area', 
  'Zone', 
  'Downtown commercial zone',
  ST_GeomFromText('POLYGON((78.5 20.5, 78.6 20.5, 78.6 20.6, 78.5 20.6, 78.5 20.5))', 4326)
);

-- Insert sample vehicles
INSERT INTO vehicles (vehicle_number, driver_name, vehicle_type, phone) VALUES 
  ('DL-01-AB-1234', 'Raj Kumar', 'Sedan', '9876543210'),
  ('DL-02-CD-5678', 'Priya Singh', 'Truck', '9988776655'),
  ('DL-03-EF-9012', 'Arjun Patel', 'Bus', '9855443322');

-- Insert sample vehicle locations
INSERT INTO vehicle_locations (vehicle_id, position, latitude, longitude, speed, heading) VALUES
  (1, ST_GeomFromText('POINT(78.55 20.55)', 4326), 20.55, 78.55, 45.5, 90),
  (2, ST_GeomFromText('POINT(78.45 20.45)', 4326), 20.45, 78.45, 60.0, 180),
  (3, ST_GeomFromText('POINT(78.65 20.65)', 4326), 20.65, 78.65, 30.0, 45);

SELECT 'Sample data created!' as status;
