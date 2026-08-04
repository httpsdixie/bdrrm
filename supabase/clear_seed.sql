-- =============================================
-- Barangay DRRM — Wipe All Data (Preserves Admin User)
-- Paste and run this in Supabase SQL Editor
-- =============================================

TRUNCATE TABLE
  resource_logs,
  asset_units,
  evac_history_log,
  evacuation_tracking,
  resource_dispatch,
  incident_audit_trail,
  incidents,
  resources,
  evacuation_centers,
  emergency_contacts,
  road_closures,
  responder_stations,
  hospitals,
  hazard_zones
RESTART IDENTITY CASCADE;

-- Delete all secondary user accounts except 'admin'
DELETE FROM users WHERE username != 'admin';

-- Re-seed essential institutional emergency hotlines so directory is never empty
INSERT INTO emergency_contacts (name, agency, category, hotline, secondary_number, address, available_24h, sort_order)
VALUES
  ('Barangay Linao BDRRMC Command Center', 'BDRRMC', 'command', '(053) 561-2345 / 0917-123-4567', '0917-123-4567', 'Barangay Hall, Sitio 1, Linao, Ormoc City', true, 1),
  ('CDRRMO Ormoc Emergency Operations Center', 'CDRRMO', 'command', '(053) 561-8888 / 911', '911', 'City Hall Compound, Ormoc City', true, 2),
  ('Ormoc City Fire Station (BFP)', 'BFP', 'fire', '(053) 561-2222 / 0928-555-1199', '0928-555-1199', 'Aunubing St., Ormoc City', true, 3),
  ('Ormoc City PNP Central Police Station', 'PNP', 'fire', '(053) 561-3333 / 0998-598-8123', '0998-598-8123', 'Lilia Ave, Ormoc City', true, 4),
  ('Barangay Linao Health Station', 'City Health', 'medical', '0917-888-4321', NULL, 'Purok 3, Barangay Linao, Ormoc City', true, 5),
  ('Ormoc District Hospital (OMVH)', 'DOH / OMVH', 'medical', '(053) 561-4444', NULL, 'Brgy. Cogon, Ormoc City', true, 6);
