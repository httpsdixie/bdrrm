-- =============================================
-- Barangay DRRM — Map Population Seed
-- Populates all GIS map layers for Barangay Linao, Ormoc City
-- Run this in the Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. HAZARD ZONES (Flood & Landslide polygons)
-- =============================================

-- Clear existing hazard zones first to avoid duplicates
DELETE FROM hazard_zones WHERE name IN (
  'Linao Bao River Flood Zone',
  'Linao Barangay Center Flood Zone',
  'Linao Eastern Hillside Landslide Zone',
  'Linao Northern Slope Erosion Zone',
  'Linao Low-lying Flood Zone',
  'Linao Hillside Landslide Zone',
  'Hz Flood Test', 'Hz Land Test'
);

-- Flood Zone 1: Low-lying area along Bao River tributary (western side)
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Bao River Flood Zone',
  'flood', 'high',
  'Low-lying floodplain along the Bao River tributary. Inundates within 2–3 hours of heavy rainfall. Affects approximately 45 households in Puroks 1–3.',
  '[[124.5845,11.0135],[124.5875,11.0155],[124.5895,11.0148],[124.5910,11.0130],[124.5895,11.0112],[124.5865,11.0108],[124.5842,11.0120]]'::jsonb
);

-- Flood Zone 2: Barangay center low-elevation area
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Barangay Center Flood Zone',
  'flood', 'medium',
  'Low-elevation area near the barangay center. Susceptible to flash flooding during typhoon events. Affects road access to evacuation centers.',
  '[[124.5905,11.0175],[124.5935,11.0185],[124.5945,11.0165],[124.5925,11.0150],[124.5905,11.0158]]'::jsonb
);

-- Landslide Zone 1: Eastern hillside (high risk)
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Eastern Hillside Landslide Zone',
  'landslide', 'high',
  'Steep hillside terrain on the eastern boundary of Barangay Linao. History of soil erosion and debris flow during Typhoon Yolanda (2013). High risk during sustained rainfall > 50 mm.',
  '[[124.5955,11.0220],[124.5985,11.0238],[124.6000,11.0225],[124.5990,11.0205],[124.5960,11.0200]]'::jsonb
);

-- Landslide Zone 2: Northern slope (medium risk)
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Northern Slope Erosion Zone',
  'landslide', 'medium',
  'Moderate slope on the northern portion with loose soil composition. Secondary landslide risk, especially after prolonged rain events exceeding 30 mm.',
  '[[124.5878,11.0250],[124.5910,11.0262],[124.5920,11.0248],[124.5900,11.0235],[124.5875,11.0238]]'::jsonb
);


-- =============================================
-- 2. EVACUATION CENTERS
-- =============================================

DELETE FROM evacuation_centers WHERE name IN (
  'Tambulilid Covered Court',
  'Linao Elementary School Gymnasium',
  'Barangay Multi-Purpose Hall',
  'Barangay Multi-Purpose Complex',
  'Purok 4 Sitio Relief Center',
  'Ormoc Disaster Shelter West',
  'San Isidro Covered Court',
  'Linao Covered Basketball Court'
);

INSERT INTO evacuation_centers (name, address, latitude, longitude, status, capacity, current_occupancy) VALUES
(
  'Linao Covered Basketball Court',
  'Purok 2, Barangay Linao, Ormoc City',
  11.0146, 124.5895,
  'available', 400, 0
),
(
  'Linao Elementary School Gymnasium',
  'Purok 5, Barangay Linao, Ormoc City',
  11.0158, 124.5910,
  'available', 600, 0
),
(
  'Barangay Multi-Purpose Hall',
  'Purok 6, Barangay Linao, Ormoc City',
  11.0175, 124.5920,
  'available', 250, 0
),
(
  'Tambulilid Covered Court',
  'Tambulilid, Ormoc City (near Linao boundary)',
  11.0202, 124.5870,
  'available', 350, 0
),
(
  'Purok 11 Community Hall',
  'Purok 11, Barangay Linao, Ormoc City',
  11.0163, 124.5930,
  'available', 120, 0
);


-- =============================================
-- 3. HOSPITALS & HEALTH FACILITIES
-- =============================================

DELETE FROM hospitals WHERE name IN (
  'Barangay Linao Health Station (BHS)',
  'Barangay Linao Health Station',
  'Ormoc District Hospital',
  'Ormoc City Health Center',
  'Linao BHS Satellite Clinic'
);

INSERT INTO hospitals (name, address, latitude, longitude, contact_number, services) VALUES
(
  'Barangay Linao Health Station (BHS)',
  'Purok 3, Barangay Linao, Ormoc City',
  11.0185, 124.5940,
  '(053) 561-2244',
  'First Aid, Triage, Maternal Care, Immunization, Dental'
),
(
  'Ormoc District Hospital (OMVH)',
  'Brgy. Cogon, Ormoc City, Leyte',
  11.0048, 124.6078,
  '(053) 255-2604',
  'Emergency, Surgery, ICU, Pediatrics, Obstetrics, Radiology'
),
(
  'Ormoc City Health Center',
  'City Hall Complex, Ormoc City',
  11.0062, 124.6070,
  '(053) 255-3456',
  'Primary Care, Maternal Health, TB-DOTS, Dental'
),
(
  'Philippine Red Cross Ormoc Chapter',
  'Ormoc City, Leyte',
  11.0055, 124.6065,
  '(053) 561-1234',
  'Blood Banking, First Aid, Disaster Response, Ambulance'
);


-- =============================================
-- 4. RESPONDER STATIONS (Police, Fire, BDRRMC)
-- =============================================

DELETE FROM responder_stations WHERE name IN (
  'Barangay Linao BDRRMC Office',
  'Barangay Linao BDRRMC Command Center',
  'Ormoc City Fire Station',
  'Ormoc City PNP Police Station',
  'Linao Purok Police Outpost',
  'Philippine Coast Guard Ormoc',
  'Ormoc City Police Sub-Station',
  'BFP Ormoc Station'
);

INSERT INTO responder_stations (name, type, address, latitude, longitude, contact_number, personnel_count) VALUES
(
  'Barangay Linao BDRRMC Command Center',
  'bdrrmc',
  'Barangay Hall, Purok 6, Linao, Ormoc City',
  11.0168, 124.5918,
  '0917-123-4567',
  18
),
(
  'Linao Purok Police Outpost',
  'police',
  'Purok 4, Barangay Linao, Ormoc City',
  11.0157, 124.5907,
  '(053) 561-3333',
  6
),
(
  'Ormoc City PNP Central Station',
  'police',
  'Lilia Ave, Ormoc City, Leyte',
  11.0058, 124.6068,
  '(053) 255-2333',
  85
),
(
  'Ormoc City Fire Station (BFP)',
  'fire_station',
  'Aunubing St., Ormoc City, Leyte',
  11.0060, 124.6060,
  '(053) 255-2114',
  40
),
(
  'Philippine Coast Guard Ormoc Sub-Station',
  'coast_guard',
  'Port Area, Ormoc City, Leyte',
  11.0045, 124.6050,
  '(053) 255-3524',
  22
),
(
  'Linao Barangay Health Station (BHS)',
  'bhs',
  'Purok 3, Barangay Linao, Ormoc City',
  11.0185, 124.5940,
  '(053) 561-2244',
  5
);


-- =============================================
-- 5. EMERGENCY CONTACTS (Hotlines widget)
-- =============================================

DELETE FROM emergency_contacts WHERE name IN (
  'Barangay Linao BDRRMC Command Center',
  'Barangay Linao BDRRMC Command',
  'CDRRMO Ormoc Emergency Operations Center',
  'CDRRMO Ormoc Emergency Operations',
  'Ormoc City Fire Station (BFP)',
  'Ormoc City PNP Central Police Station',
  'Ormoc City Police Station',
  'Barangay Linao Health Station',
  'Ormoc District Hospital (OMVH)',
  'Philippine Coast Guard Ormoc',
  'Ormoc Philippine Red Cross',
  'NDRRMC Operations Center',
  'Ormoc City CDRRMO',
  'Barangay Linao BDRRMO',
  'Ormoc City DSWDO',
  'Barangay Linao Health Station (BHS)'
);

INSERT INTO emergency_contacts (name, agency, category, hotline, secondary_number, address, available_24h, sort_order) VALUES
('Barangay Linao BDRRMC Command Center', 'BDRRMC',         'command',  '(053) 561-2345',  '0917-123-4567', 'Barangay Hall, Linao, Ormoc City',           TRUE,  1),
('CDRRMO Ormoc Emergency Operations',    'CDRRMO',         'command',  '(053) 255-2830',  '911',           'City Hall Compound, Ormoc City',             TRUE,  2),
('Ormoc City Fire Station (BFP)',         'BFP',            'fire',     '(053) 255-2114',  '0928-555-1199', 'Aunubing St., Ormoc City',                   TRUE,  3),
('Ormoc City PNP Central Station',        'PNP',            'police',   '(053) 255-2333',  '0998-598-8123', 'Lilia Ave, Ormoc City',                      TRUE,  4),
('Philippine Coast Guard Ormoc',          'PCG',            'emergency','(053) 255-3524',  '0917-888-3000', 'Port Area, Ormoc City',                      TRUE,  5),
('Ormoc District Hospital (OMVH)',        'DOH/OMVH',       'medical',  '(053) 255-2604',  NULL,            'Brgy. Cogon, Ormoc City',                    TRUE,  6),
('Philippine Red Cross Ormoc',            'Red Cross',      'medical',  '(053) 561-1234',  '0917-123-9999', 'Ormoc City, Leyte',                          TRUE,  7),
('Barangay Linao Health Station (BHS)',   'City Health',    'medical',  '(053) 561-2244',  NULL,            'Purok 3, Barangay Linao, Ormoc City',        FALSE, 8),
('NDRRMC Operations Center',             'NDRRMC',         'command',  '(02) 8911-5061',  '0918-912-2665', 'Camp Aguinaldo, Quezon City',                TRUE,  9),
('Ormoc City DSWDO',                     'DSWDO',          'emergency','(053) 255-3456',  NULL,            'City Hall, Ormoc City',                      FALSE, 10);


-- =============================================
-- Verify populated data
-- =============================================
SELECT 'hazard_zones'        AS layer, COUNT(*) AS count FROM hazard_zones
UNION ALL
SELECT 'evacuation_centers'  AS layer, COUNT(*) AS count FROM evacuation_centers
UNION ALL
SELECT 'hospitals'           AS layer, COUNT(*) AS count FROM hospitals
UNION ALL
SELECT 'responder_stations'  AS layer, COUNT(*) AS count FROM responder_stations
UNION ALL
SELECT 'emergency_contacts'  AS layer, COUNT(*) AS count FROM emergency_contacts;
