-- =============================================
-- Barangay DRRM — Supabase Database Schema
-- =============================================

-- Users table (managed by our FastAPI auth, not Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'responder', -- 'admin', 'officer', 'responder'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,          -- 'flood', 'fire', 'landslide', 'typhoon', 'medical', 'other'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'responding', 'resolved'
  severity VARCHAR(10) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  reported_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evacuation Centers table
CREATE TABLE IF NOT EXISTS evacuation_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'available', -- 'available', 'full', 'closed'
  contact_person VARCHAR(100),
  contact_number VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources / Equipment table
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,          -- 'rescue_boat', 'medical_kit', 'food_pack', 'tent', 'vehicle', 'other'
  quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  status VARCHAR(20) DEFAULT 'available', -- 'available', 'deployed', 'maintenance'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource Dispatch Log table
CREATE TABLE IF NOT EXISTS resource_dispatch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id),
  incident_id UUID REFERENCES incidents(id),
  quantity_dispatched INTEGER NOT NULL,
  dispatched_by UUID REFERENCES users(id),
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  notes TEXT
);

-- =============================================
-- Seed: Default admin user
-- Password: admin1234
-- Change this after first login!
-- =============================================
INSERT INTO users (username, password_hash, full_name, role)
VALUES (
  'admin',
  '$2b$12$0NwOe9qBQXHnV9BcYqglpua2W8YM1gLNnNzNu.NHyPfJTY15akQ/q',
  'DRRM Administrator',
  'admin'
) ON CONFLICT (username) DO NOTHING;

-- =============================================
-- GIS Map Layers (added in Feature Update 1)
-- =============================================

-- Hazard Zones (flood/landslide polygons, editable by officers)
CREATE TABLE IF NOT EXISTS hazard_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL,          -- 'flood', 'landslide'
  risk_level VARCHAR(10) DEFAULT 'high', -- 'low', 'medium', 'high'
  description TEXT,
  -- GeoJSON polygon stored as JSONB: [[lng,lat],[lng,lat],...]
  coordinates JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hospitals (static markers)
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  contact_number VARCHAR(30),
  services TEXT,                      -- brief description of services
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- First Responder Stations (static markers)
CREATE TABLE IF NOT EXISTS responder_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,          -- 'bdrrmc', 'fire_station', 'police', 'bhs', 'coast_guard', 'other'
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  contact_number VARCHAR(30),
  personnel_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Road Closures (officers add/remove during events)
CREATE TABLE IF NOT EXISTS road_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  reason VARCHAR(50) NOT NULL,        -- 'flood', 'landslide', 'road_work', 'accident', 'other'
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  reported_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- =============================================
-- Seed: Barangay Linao area data
-- =============================================

-- Seed: Flood hazard zone
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates)
VALUES (
  'Linao Low-lying Flood Zone',
  'flood',
  'high',
  'Low-lying area near river channel, high flood risk during typhoons and heavy rainfall',
  '[[124.5850,11.0140],[124.5900,11.0150],[124.5910,11.0125],[124.5860,11.0115]]'::jsonb
) ON CONFLICT DO NOTHING;

-- Seed: Landslide zone
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates)
VALUES (
  'Linao Hillside Landslide Zone',
  'landslide',
  'medium',
  'Sloped terrain on the eastern portion, risk of soil erosion and landslide during prolonged rain',
  '[[124.5910,11.0225],[124.5960,11.0235],[124.5950,11.0210],[124.5900,11.0200]]'::jsonb
) ON CONFLICT DO NOTHING;

-- Seed: Hospital
INSERT INTO hospitals (name, address, latitude, longitude, contact_number, services)
VALUES (
  'Barangay Linao Health Station (BHS)',
  'Main Street, Brgy Linao, Ormoc City',
  11.0185, 124.5940,
  '(053) 561-2244',
  'First Aid, Triage, Maternal Care'
) ON CONFLICT DO NOTHING;

-- Seed: Responder station
INSERT INTO responder_stations (name, type, address, latitude, longitude, contact_number, personnel_count)
VALUES (
  'Barangay Linao BDRRMC Office',
  'bdrrmc',
  'Barangay Hall, Linao, Ormoc City',
  11.0168, 124.5918,
  '0917-123-4567',
  18
) ON CONFLICT DO NOTHING;

-- =============================================
-- Reports Feature (Feature Update 2)
-- New columns on incidents table
-- Run these ALTER statements in Supabase SQL Editor
-- =============================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS people_involved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS human_resources TEXT,
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- =============================================
-- Improved Hazard Zone Seeds for Barangay Linao
-- Based on CPDO Hazard Map coordinates
-- Run this to replace/update existing seed data
-- =============================================

-- Delete old placeholder seeds first
DELETE FROM hazard_zones WHERE name IN (
  'Linao Low-lying Flood Zone',
  'Linao Hillside Landslide Zone',
  'Hz Flood Test', 'Hz Land Test'
);

-- Flood Zone 1: Low-lying area along Bao River tributary
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Bao River Flood Zone',
  'flood', 'high',
  'Low-lying floodplain along the Bao River tributary. Inundates within 2-3 hours of heavy rainfall. Affects approximately 45 households.',
  '[[124.5845,11.0135],[124.5875,11.0155],[124.5895,11.0148],[124.5910,11.0130],[124.5895,11.0112],[124.5865,11.0108],[124.5842,11.0120]]'::jsonb
);

-- Flood Zone 2: Coastal low area near barangay center
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Barangay Center Flood Zone',
  'flood', 'medium',
  'Low-elevation area near the barangay center. Susceptible to flash flooding during typhoon events. Affects road access to evacuation centers.',
  '[[124.5905,11.0175],[124.5935,11.0185],[124.5945,11.0165],[124.5925,11.0150],[124.5905,11.0158]]'::jsonb
);

-- Landslide Zone 1: Eastern hillside
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Eastern Hillside Landslide Zone',
  'landslide', 'high',
  'Steep hillside terrain on the eastern boundary of Barangay Linao. History of soil erosion and debris flow during Typhoon Yolanda (2013). High risk during sustained rainfall > 50mm.',
  '[[124.5955,11.0220],[124.5985,11.0238],[124.6000,11.0225],[124.5990,11.0205],[124.5960,11.0200]]'::jsonb
);

-- Landslide Zone 2: Northern slope
INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES (
  'Linao Northern Slope Erosion Zone',
  'landslide', 'medium',
  'Moderate slope on the northern portion with loose soil composition. Secondary landslide risk, especially after prolonged rain events.',
  '[[124.5878,11.0250],[124.5910,11.0262],[124.5920,11.0248],[124.5900,11.0235],[124.5875,11.0238]]'::jsonb
);

-- =============================================
-- Emergency Directory (Feature Update 3)
-- =============================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  agency VARCHAR(100) NOT NULL,        -- e.g. BFP, PNP, CDRRMO
  category VARCHAR(50) NOT NULL,       -- 'emergency', 'medical', 'disaster', 'police', 'fire', 'other'
  hotline VARCHAR(100) NOT NULL,       -- primary number
  secondary_number VARCHAR(100),
  address TEXT,
  email VARCHAR(150),
  available_24h BOOLEAN DEFAULT TRUE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Seed: Ormoc City & Barangay Linao Hotlines
-- =============================================

INSERT INTO emergency_contacts (name, agency, category, hotline, secondary_number, address, available_24h, sort_order) VALUES
('Ormoc City CDRRMO',           'CDRRMO',            'disaster',   '(053) 255-2830', '0917-123-4567', 'City Hall, Ormoc City',                         TRUE,  1),
('Barangay Linao BDRRMO',       'BDRRMO',            'disaster',   '0917-234-5678',  NULL,             'Barangay Hall, Linao, Ormoc City',              TRUE,  2),
('Ormoc City Fire Station',     'BFP',               'fire',       '(053) 255-2114', '0998-888-1000',  'Ormoc City Fire Station',                       TRUE,  3),
('Ormoc City Police Station',   'PNP',               'police',     '(053) 255-2333', '0917-888-2000',  'PNP Station, Ormoc City',                       TRUE,  4),
('Philippine Coast Guard Ormoc','Coast Guard',       'emergency',  '(053) 255-3524', '0917-888-3000',  'Port Area, Ormoc City',                         TRUE,  5),
('Ormoc Philippine Red Cross',  'Philippine Red Cross','medical',  '(053) 561-1234', '0917-123-9999',  'Red Cross Chapter, Ormoc City',                 TRUE,  6),
('NDRRMC Operations Center',    'NDRRMC',            'disaster',   '(02) 8911-5061', '0918-912-2665',  'Camp Aguinaldo, Quezon City',                   TRUE,  7),
('Ormoc District Hospital',     'DOH',               'medical',    '(053) 255-2604', NULL,             'Ormoc City, Leyte',                             TRUE,  8),
('Ormoc City DSWDO',            'DSWDO',             'emergency',  '(053) 255-3456', NULL,             'City Hall, Ormoc City',                         FALSE, 9),
('Barangay Linao Health Station','BHS',              'medical',    '(053) 561-2244', NULL,             'Main St, Brgy Linao, Ormoc City',               FALSE, 10)
ON CONFLICT DO NOTHING;

-- =============================================
-- Incident Tracking Upgrade (Feature Update 4)
-- Run in Supabase SQL Editor
-- =============================================

-- New columns for enhanced incident intake
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS parties_involved TEXT,
  ADD COLUMN IF NOT EXISTS casualty_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casualty_status VARCHAR(20) DEFAULT 'none',
  -- casualty_status: 'none', 'injured', 'missing', 'dead', 'mixed'
  ADD COLUMN IF NOT EXISTS casualties_dead INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casualties_injured INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casualties_missing INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reporter_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reporter_contact VARCHAR(50),
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Supabase Storage bucket (run this separately in Supabase Storage settings)
-- Bucket name: incident-photos
-- Public: false (authenticated access only)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- =============================================
-- Standardized Data Input Protocol (Feature Update 5)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS consciousness_status VARCHAR(20) DEFAULT 'unknown',
  -- 'conscious', 'unconscious', 'mixed', 'unknown', 'not_applicable'
  ADD COLUMN IF NOT EXISTS root_cause VARCHAR(50) DEFAULT 'unknown',
  -- 'natural_hazard', 'human_induced', 'infrastructure_failure', 'animal_related', 'unknown'
  ADD COLUMN IF NOT EXISTS root_cause_detail TEXT,
  ADD COLUMN IF NOT EXISTS geolocation_verified BOOLEAN DEFAULT FALSE;
  -- TRUE = officer confirmed pin placement is accurate

-- =============================================
-- Resources Category Column (Feature Update 7)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';
  -- 'disaster', 'fire', 'police', 'medical', 'emergency', 'other'

-- Update existing rows to infer category from type
UPDATE resources SET category = 'disaster'  WHERE type = 'rescue_boat'  AND (category IS NULL OR category = 'other');
UPDATE resources SET category = 'medical'   WHERE type = 'medical_kit'  AND (category IS NULL OR category = 'other');
UPDATE resources SET category = 'emergency' WHERE type IN ('tent','vehicle') AND (category IS NULL OR category = 'other');

-- =============================================
-- Seed: Barangay Linao DRRM Resource Inventory
-- Run in Supabase SQL Editor if inventory is empty
-- =============================================

INSERT INTO resources (name, type, category, quantity, available_quantity, location, status) VALUES
  ('Inflatable Rescue Rubber Boat (Engine-Powered)',     'rescue_boat', 'disaster',  4,   4,   'Barangay Operations Center Storage',    'available'),
  ('Emergency First Aid Trauma Kit',                    'medical_kit', 'medical',   25,  25,  'Barangay Health Station (BHS)',          'available'),
  ('Family Relief Food Pack (5-Day Supply)',             'food_pack',   'emergency', 200, 200, 'Barangay Multi-Purpose Warehouse',      'available'),
  ('Emergency Temporary Shelter Tent (10-Person)',       'tent',        'emergency', 30,  30,  'Evacuation Center Depot',               'available'),
  ('BDRRMC Emergency Patrol Utility Vehicle',           'vehicle',     'emergency', 2,   2,   'Barangay Hall Parking Area',            'available'),
  ('Life Jackets / Personal Flotation Devices',         'other',       'disaster',  50,  50,  'Barangay Operations Center Storage',    'available'),
  ('Portable Water Purification Unit',                  'other',       'emergency', 3,   3,   'Evacuation Center Depot',               'available'),
  ('BFP Fire Extinguisher (ABC Dry Chemical 10kg)',     'other',       'fire',      15,  15,  'Barangay Hall Fire Cabinet',            'available'),
  ('Police Crowd Control Barrier (Metal Fence)',        'other',       'police',    20,  20,  'Brgy Hall Storage Area',                'available'),
  ('Portable Electric Generator (5kVA)',                'other',       'emergency', 3,   3,   'Evacuation Center Depot',               'available'),
  ('Chainsaw (for Fallen Tree Clearing)',               'other',       'disaster',  2,   2,   'Barangay Operations Center Storage',    'available'),
  ('Megaphone / Bullhorn (Emergency Announcement)',     'other',       'emergency', 5,   5,   'Barangay Hall',                         'available'),
  ('Stretcher / Medical Transport Board',               'other',       'medical',   8,   8,   'Barangay Health Station (BHS)',          'available'),
  ('Emergency Lighting Tower (LED, Portable)',          'other',       'emergency', 2,   2,   'Evacuation Center Depot',               'available'),
  ('Sandbag (Flood Barrier, Bundle of 50)',             'other',       'disaster',  100, 100, 'Barangay Operations Center Storage',    'available')
ON CONFLICT DO NOTHING;

-- =============================================
-- Seed: Barangay Linao Evacuation Centers
-- Run in Supabase SQL Editor if table is empty
-- =============================================

INSERT INTO evacuation_centers (name, address, latitude, longitude, capacity, current_occupancy, status, contact_person, contact_number) VALUES
  ('Tambulilid Covered Court',            'Sitio Tambulilid, Brgy Linao, Ormoc City',  11.0235, 124.5885, 350, 45,  'available', 'Brgy Capt. Ramirez',    '0917-123-4567'),
  ('Linao Elementary School Gymnasium',  'Main Street, Brgy Linao, Ormoc City',        11.0145, 124.5905, 500, 0,   'available', 'Principal V. Torres',   '0918-987-6543'),
  ('Barangay Multi-Purpose Complex',     'Barangay Center, Brgy Linao, Ormoc City',    11.0168, 124.5918, 150, 150, 'full',      'Kagawad B. Flores',     '0920-555-8899'),
  ('Purok 4 Sitio Relief Center',        'Purok 4, Brgy Linao, Ormoc City',            11.0210, 124.5945, 100, 12,  'available', 'Tanod Leader M. Delos', '0915-333-7721'),
  ('Ormoc Disaster Shelter West',        'National Highway, Brgy Linao, Ormoc City',   11.0190, 124.5870, 200, 0,   'available', 'CDRRMO Liaison',         '(053) 255-2830')
ON CONFLICT DO NOTHING;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'validated', 'invalidated'
  ADD COLUMN IF NOT EXISTS invalidation_reason VARCHAR(50),
  -- 'duplicate', 'misinformation', 'test_entry', 'other'
  ADD COLUMN IF NOT EXISTS invalidation_notes TEXT,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- =============================================
-- Seed: Demo Incident Data for Capstone Defense
-- Run in Supabase SQL Editor
-- Uses the admin user UUID — replace if yours differs
-- =============================================

-- Get admin user id first:
-- SELECT id FROM users WHERE username = 'admin';
-- Then replace 'ADMIN_USER_ID' below with the actual UUID, e.g.:
-- DO $$ DECLARE admin_id UUID; BEGIN SELECT id INTO admin_id FROM users WHERE username='admin'; ...

-- Easiest approach: run the INSERT with a subquery for reported_by
INSERT INTO incidents (
  title, description, type, status, severity,
  latitude, longitude, location_address,
  people_involved, action_taken, human_resources,
  casualty_count, casualty_status, casualties_dead, casualties_injured,
  consciousness_status, root_cause, reporter_name, reporter_contact,
  validation_status, reported_by
)
SELECT
  title, description, type, status, severity,
  latitude, longitude, location_address,
  people_involved, action_taken, human_resources,
  casualty_count, casualty_status, casualties_dead, casualties_injured,
  consciousness_status, root_cause, reporter_name, reporter_contact,
  validation_status,
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (VALUES
  (
    'Linao Bao River Surge & Coastal Inundation',
    'Rising sea tide and river overflow inundating lower residential structures in Sitio 2 coastal area. Approximately 15 households affected with standing water reaching knee level.',
    'flood', 'responding', 'high',
    11.0125, 124.5865, 'Sitio 2 Shoreline, Barangay Linao, Ormoc City',
    15, 'Dispatched 4 BDRRMC responders and 1 rubber boat to transport affected families to Tambulilid Covered Court. BHS medic on standby.',
    '4 BDRRMC Responders, 2 Barangay Tanods, 1 BHS Medic',
    2, 'injured', 0, 2,
    'conscious', 'natural_hazard', 'Capt. Ramirez (BDRRMC)', '0917-123-4567',
    'validated'
  ),
  (
    'Purok 2 Hillside Soil Erosion & Landslide',
    'Minor soil movement and debris falling onto the primary access road following sustained heavy rainfall. Road partially blocked with loose earth and tree branches.',
    'landslide', 'active', 'medium',
    11.0210, 124.5925, 'Purok 2 Hillside Access Road, Barangay Linao',
    8, 'Cordoned off the affected road section. Deployed tanods for traffic control. Chainsaw team notified.',
    '3 Barangay Tanods, 1 BDRRMC Monitor',
    0, 'none', 0, 0,
    'not_applicable', 'natural_hazard', 'Patrol Signal / Resident Report', '0928-555-0192',
    'validated'
  ),
  (
    'Residential Electrical Fire Risk — Overloaded Transformer',
    'Overloaded distribution transformer post near wooden residential roofing sparked and produced visible smoke. Nearby households evacuated as precaution.',
    'fire', 'active', 'critical',
    11.0185, 124.5940, 'Main Street near Barangay Hall, Barangay Linao',
    5, 'Notified Ormoc Electric Cooperative (ORECO) and BFP Ormoc City. Evacuated 3 households within 15-meter radius.',
    '2 BDRRMC Responders, 1 Kagawad',
    0, 'none', 0, 0,
    'not_applicable', 'infrastructure_failure', 'Elena Santos', '0909-444-1122',
    'validated'
  ),
  (
    'Tricycle Slip & Minor Collision Near School Zone',
    'Passenger tricycle skidded on wet pavement near the school entrance and collided with a parked motorcycle. Driver sustained minor abrasions.',
    'road_accident', 'resolved', 'low',
    11.0145, 124.5905, 'Linao Elementary School Zone, Barangay Linao',
    3, 'First aid rendered by BHS medic on duty. Vehicles cleared from road. Police substation notified.',
    '1 BHS Medic, 1 Tanod',
    1, 'injured', 0, 1,
    'conscious', 'human_induced', 'BHS Medic On-Duty', '(053) 561-2244',
    'validated'
  ),
  (
    'Fallen Mahogany Branch Blocking Alley Access Road',
    'Heavy wind from tropical depression snapped a large mahogany tree limb across a 2-meter community alleyway near Purok 3. No injuries reported.',
    'other', 'resolved', 'low',
    11.0225, 124.5955, 'Purok 3 Community Alley, Barangay Linao',
    0, 'Deployed chainsaw team. Sawed and removed all timber debris from pathway. Area cleared within 45 minutes.',
    '2 BDRRMC Responders, Chainsaw Team',
    0, 'none', 0, 0,
    'not_applicable', 'natural_hazard', 'Tanod V. Cruz', '0915-888-3311',
    'validated'
  ),
  (
    'Medical Emergency — Hypertensive Crisis (Elderly Resident)',
    'Elderly resident (72F) reported acute chest pain and elevated blood pressure at home. Family requested emergency medical assistance.',
    'medical', 'resolved', 'high',
    11.0168, 124.5918, 'Purok 1, Near Barangay Hall, Barangay Linao',
    2, 'BHS nurse dispatched. Vital signs stabilized. Patient transported to Ormoc District Hospital by barangay vehicle.',
    '1 BHS Nurse, 1 Barangay Kagawad',
    1, 'injured', 0, 1,
    'conscious', 'natural_hazard', 'Family of Patient', '0917-999-0011',
    'validated'
  ),
  (
    'Flash Flood — Low-lying Coastal Road Inundation',
    'Coastal access road near fish landing area inundated with approximately 0.8m of floodwater due to storm surge during Tropical Storm activity. Road impassable.',
    'flood', 'resolved', 'high',
    11.0115, 124.5850, 'Coastal Fish Landing Access Road, Brgy Linao',
    22, 'Deployed rescue boat. Assisted 22 residents to evacuate to Linao Elementary School. Road closure marker placed.',
    '5 BDRRMC Responders, 3 Tanods, 1 Coast Guard Liaison',
    0, 'none', 0, 0,
    'not_applicable', 'natural_hazard', 'Sitio Leader A. Vergara', '0916-777-4422',
    'validated'
  ),
  (
    'Request for Emergency Assistance — Stranded Fishermen',
    'Three fishermen reported stranded offshore near Linao coastal waters due to engine failure during moderate sea conditions. Families requested BDRRMC assistance.',
    'assistance', 'resolved', 'high',
    11.0110, 124.5845, 'Linao Coastal Waters, Offshore Area',
    3, 'Coordinated with Philippine Coast Guard Ormoc. Rubber boat deployed. All 3 fishermen retrieved safely within 2 hours.',
    '3 BDRRMC Responders, 2 Coast Guard Personnel',
    0, 'none', 0, 0,
    'conscious', 'human_induced', 'Family Caller / Dispatch Radio', '0918-212-3344',
    'validated'
  ),
  (
    'Suspected Food Poisoning — Community Gathering',
    'Seven residents reported nausea, vomiting and abdominal pain following a community gathering at Purok 4. Suspected contaminated food preparation.',
    'medical', 'resolved', 'medium',
    11.0210, 124.5950, 'Purok 4 Community Hall, Barangay Linao',
    7, 'BHS team dispatched. All 7 patients given oral rehydration therapy. 2 referred to Ormoc District Hospital for observation.',
    '2 BHS Staff, 1 BDRRMC Responder',
    7, 'injured', 0, 7,
    'conscious', 'human_induced', 'Kagawad M. Palanca', '0920-654-3219',
    'pending'
  ),
  (
    'Debris & Garbage Burning Causing Air Quality Risk',
    'Unattended burning of household waste and agricultural debris near residential area producing thick smoke. Risk to elderly and children with respiratory conditions.',
    'other', 'resolved', 'low',
    11.0195, 124.5935, 'Sitio 3 Agricultural Zone Boundary, Brgy Linao',
    0, 'Tanod responded and extinguished fire. Property owner warned. Brgy ordinance reminder issued.',
    '1 Barangay Tanod',
    0, 'none', 0, 0,
    'not_applicable', 'human_induced', 'Neighbor Complaint / Anonymous', NULL,
    'validated'
  )
) AS data (
  title, description, type, status, severity,
  latitude, longitude, location_address,
  people_involved, action_taken, human_resources,
  casualty_count, casualty_status, casualties_dead, casualties_injured,
  consciousness_status, root_cause, reporter_name, reporter_contact,
  validation_status
)
ON CONFLICT DO NOTHING;

-- =============================================
-- Evacuation Center Upgrade (Feature Update 8)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS status_remarks TEXT,
  -- Free-text remarks on influx, resource distribution, special conditions
  ADD COLUMN IF NOT EXISTS facilities TEXT;
  -- e.g. "Water, Generator, First Aid Kits, Sleeping Mats"

-- Update existing seed data with remarks
UPDATE evacuation_centers
  SET facilities = 'Clean Water, Generator Power, First Aid Kits, Sleeping Mats'
  WHERE name = 'Tambulilid Covered Court';

UPDATE evacuation_centers
  SET facilities = 'Restrooms, Emergency Community Kitchen, Triage Room'
  WHERE name = 'Linao Elementary School Gymnasium';

UPDATE evacuation_centers
  SET facilities = 'Command Desk, Solar Power, Radio Communications'
  WHERE name = 'Barangay Multi-Purpose Complex';

-- =============================================
-- Evacuation Center Resource Indicators (Feature Update 9)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS has_water       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_electricity BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_first_aid   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_food        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_sanitation  BOOLEAN DEFAULT FALSE;

-- Update existing seeds with realistic resource availability
UPDATE evacuation_centers SET
  has_water=TRUE, has_electricity=TRUE, has_first_aid=TRUE, has_food=FALSE, has_sanitation=TRUE
  WHERE name = 'Tambulilid Covered Court';

UPDATE evacuation_centers SET
  has_water=TRUE, has_electricity=FALSE, has_first_aid=TRUE, has_food=TRUE, has_sanitation=TRUE
  WHERE name = 'Linao Elementary School Gymnasium';

UPDATE evacuation_centers SET
  has_water=TRUE, has_electricity=TRUE, has_first_aid=TRUE, has_food=FALSE, has_sanitation=FALSE
  WHERE name = 'Barangay Multi-Purpose Complex';

UPDATE evacuation_centers SET
  has_water=TRUE, has_electricity=FALSE, has_first_aid=FALSE, has_food=FALSE, has_sanitation=TRUE
  WHERE name = 'Purok 4 Sitio Relief Center';

UPDATE evacuation_centers SET
  has_water=TRUE, has_electricity=TRUE, has_first_aid=TRUE, has_food=TRUE, has_sanitation=TRUE
  WHERE name = 'Ormoc Disaster Shelter West';

-- =============================================
-- Evacuation Center Tracking (Feature Update 10)
-- Run in Supabase SQL Editor
-- Full occupant demographics + relief supply status
-- =============================================

CREATE TABLE IF NOT EXISTS evacuation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES evacuation_centers(id) ON DELETE CASCADE,

  -- Demographic breakdown
  demo_pwd         INTEGER DEFAULT 0,  -- Persons with Disability
  demo_pregnant    INTEGER DEFAULT 0,
  demo_children    INTEGER DEFAULT 0,  -- 0–17 years
  demo_youth       INTEGER DEFAULT 0,  -- 18–24 years
  demo_senior      INTEGER DEFAULT 0,  -- 60+ years
  demo_ip          INTEGER DEFAULT 0,  -- Indigenous People

  -- Sector / Purok breakdown (free text JSON: [{"sector":"Sitio 2","count":25},...])
  sector_breakdown JSONB DEFAULT '[]'::jsonb,

  -- Relief supply status
  relief_food         VARCHAR(20) DEFAULT 'none',    -- 'adequate','limited','none'
  relief_food_remarks TEXT,
  relief_water        VARCHAR(20) DEFAULT 'none',
  relief_water_remarks TEXT,
  relief_clothing     VARCHAR(20) DEFAULT 'none',
  relief_clothing_remarks TEXT,

  -- Utility & connectivity status
  water_system    VARCHAR(20) DEFAULT 'unknown',   -- 'operational','disrupted','unavailable','unknown'
  electricity     VARCHAR(20) DEFAULT 'unknown',   -- 'operational','generator','unavailable','unknown'
  internet_signal VARCHAR(20) DEFAULT 'unknown',   -- 'good','weak','none','unknown'

  -- Equipment & consumables (free text remarks)
  equipment_notes TEXT,

  -- Camp management
  camp_manager       VARCHAR(100),
  camp_manager_contact VARCHAR(50),
  assigned_official  VARCHAR(100),  -- barangay official in charge

  -- Needs evaluation
  resources_needed TEXT,   -- free text: what is needed / requested

  -- Metadata
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One tracking record per center (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_evac_tracking_center
  ON evacuation_tracking(center_id);

-- =============================================
-- Evacuation Tracking Phase Support (Feature Update 11)
-- Run in Supabase SQL Editor
-- =============================================

-- Add phase column to support Before/During/After tracking
ALTER TABLE evacuation_tracking
  ADD COLUMN IF NOT EXISTS phase VARCHAR(10) DEFAULT 'during';
  -- 'before', 'during', 'after'

-- Before phase specific fields
ALTER TABLE evacuation_tracking
  ADD COLUMN IF NOT EXISTS pre_capacity_check     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_inventory_notes    TEXT,
  ADD COLUMN IF NOT EXISTS pre_resource_position  TEXT,
  ADD COLUMN IF NOT EXISTS pre_staff_deployed     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_readiness_level    VARCHAR(20) DEFAULT 'not_assessed';
  -- 'ready','partially_ready','not_ready','not_assessed'

-- After phase specific fields
ALTER TABLE evacuation_tracking
  ADD COLUMN IF NOT EXISTS post_damage_notes      TEXT,
  ADD COLUMN IF NOT EXISTS post_resources_used    TEXT,
  ADD COLUMN IF NOT EXISTS post_replenishment_needed TEXT,
  ADD COLUMN IF NOT EXISTS post_total_served      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_center_condition  VARCHAR(20) DEFAULT 'unknown';
  -- 'good','minor_damage','major_damage','unknown'

-- Drop the unique constraint to allow one record per center per phase
DROP INDEX IF EXISTS idx_evac_tracking_center;
CREATE UNIQUE INDEX IF NOT EXISTS idx_evac_tracking_center_phase
  ON evacuation_tracking(center_id, phase);

-- =============================================
-- Evacuation Center Historical Utilization Log (Feature Update 12)
-- Run in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS evac_history_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id        UUID REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  event_name       VARCHAR(150) NOT NULL,   -- e.g. "Typhoon Odette 2021"
  event_type       VARCHAR(50)  NOT NULL,   -- 'typhoon','flood','earthquake','other'
  event_date       DATE         NOT NULL,
  peak_occupancy   INTEGER      DEFAULT 0,
  total_served     INTEGER      DEFAULT 0,
  duration_days    INTEGER      DEFAULT 1,
  bottlenecks      TEXT,                    -- resource bottlenecks observed
  structural_notes TEXT,                    -- damage/resilience notes
  reliability_rating VARCHAR(10) DEFAULT 'good', -- 'excellent','good','fair','poor'
  lessons_learned  TEXT,
  logged_by        UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evac_history_center ON evac_history_log(center_id);

-- Seed: Sample historical data for demo
INSERT INTO evac_history_log (center_id, event_name, event_type, event_date, peak_occupancy, total_served, duration_days, bottlenecks, structural_notes, reliability_rating, lessons_learned)
SELECT
  ec.id,
  'Typhoon Odette (2021)',
  'typhoon',
  '2021-12-16',
  320, 420, 7,
  'Food packs depleted by Day 3. Generator fuel ran out on Day 5.',
  'Minor roof damage on east wing. Floor held well. No structural failure.',
  'good',
  'Pre-position 500 food packs minimum. Keep generator fuel for 7 days.'
FROM evacuation_centers ec WHERE ec.name = 'Tambulilid Covered Court' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO evac_history_log (center_id, event_name, event_type, event_date, peak_occupancy, total_served, duration_days, bottlenecks, structural_notes, reliability_rating, lessons_learned)
SELECT
  ec.id,
  'Typhoon Odette (2021)',
  'typhoon',
  '2021-12-16',
  480, 650, 7,
  'Toilet facilities overwhelmed by Day 2. Water supply disrupted.',
  'Gymnasium roof intact. Some window damage. Drainage adequate.',
  'good',
  'Install additional portable toilets. Coordinate with LWUA for backup water.'
FROM evacuation_centers ec WHERE ec.name = 'Linao Elementary School Gymnasium' LIMIT 1
ON CONFLICT DO NOTHING;

-- =============================================
-- Extended Resource Types Seed (Feature Update 13)
-- Run in Supabase SQL Editor
-- =============================================

INSERT INTO resources (name, type, category, quantity, available_quantity, location, status) VALUES
  ('BDRRMC Rescue Ambulance Unit 1',         'ambulance',  'medical',   1, 1, 'Barangay Hall Parking Area',         'available'),
  ('BFP Ormoc Fire Truck (Liaison Unit)',    'fire_truck', 'fire',      1, 1, 'BFP Ormoc Station (On-Call)',         'available'),
  ('Diesel Fuel Reserve (20L Containers)',   'fuel',       'emergency', 10, 10, 'Barangay Hall Bodega',              'available'),
  ('Gasoline Fuel Reserve (20L Containers)', 'fuel',       'emergency', 5,  5,  'Barangay Hall Bodega',              'available'),
  ('Heavy-Duty Chainsaw (Husqvarna)',        'chainsaw',   'disaster',  2,  2,  'Barangay Operations Center Storage','available'),
  ('BDRRMC Patrol Motorcycle',               'vehicle',    'emergency', 3,  3,  'Barangay Hall Parking Area',        'available'),
  ('Life Jackets (Adult)',                   'other',      'disaster',  30, 30, 'Barangay Operations Center Storage','available'),
  ('Life Jackets (Child)',                   'other',      'disaster',  20, 20, 'Barangay Operations Center Storage','available'),
  ('Portable Stretcher',                     'other',      'medical',   6,  6,  'Barangay Health Station (BHS)',     'available'),
  ('Megaphone / Bullhorn',                   'other',      'emergency', 5,  5,  'Barangay Hall',                    'available'),
  ('BFP Fire Extinguisher (10kg ABC)',       'other',      'fire',      15, 15, 'Barangay Hall Fire Cabinet',       'available'),
  ('Police Crowd Barrier (Metal)',           'other',      'police',    20, 20, 'Brgy Hall Storage',                'available'),
  ('Portable Generator (5kVA)',              'other',      'emergency', 3,  3,  'Evacuation Center Depot',          'available'),
  ('Sandbags (Bundle of 50)',                'other',      'disaster',  80, 80, 'Barangay Operations Center Storage','available')
ON CONFLICT DO NOTHING;


-- =============================================
-- Resource Ownership Tier (Feature Update 14)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS ownership_tier VARCHAR(20) DEFAULT 'barangay';
  -- 'barangay', 'private', 'cdrrmo', 'ngo'

UPDATE resources SET ownership_tier = 'barangay' WHERE ownership_tier IS NULL;

-- =============================================
-- Serialized Asset Tracking (Feature Update 11)
-- Run in Supabase SQL Editor
-- =============================================

-- Add ownership_tier column to resources if not yet present
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS ownership_tier VARCHAR(20) DEFAULT 'barangay';
  -- 'barangay', 'private'

-- Serialized asset units table
-- Each row = one physical unit of a non-consumable resource
CREATE TABLE IF NOT EXISTS asset_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,

  -- Identification
  property_code VARCHAR(50) UNIQUE NOT NULL,
  -- Auto-generated format: BRG-YYYY-XXXX  (e.g. BRG-2024-0001)
  -- Or manually entered manufacturer serial number

  serial_number VARCHAR(100),
  -- Manufacturer serial number (optional, separate from property code)

  -- Unit details
  condition VARCHAR(20) DEFAULT 'good',
  -- 'new', 'good', 'fair', 'poor', 'condemned'

  status VARCHAR(20) DEFAULT 'available',
  -- 'available', 'deployed', 'maintenance', 'retired'

  acquisition_date DATE,
  acquisition_source TEXT,
  -- e.g. 'CDRRMO Grant 2024', 'LGU Procurement', 'Donated by X'

  notes TEXT,

  -- Tracking
  last_deployed_incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  last_deployed_at TIMESTAMPTZ,
  last_maintained_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by property code
CREATE INDEX IF NOT EXISTS idx_asset_units_property_code ON asset_units(property_code);
CREATE INDEX IF NOT EXISTS idx_asset_units_resource_id   ON asset_units(resource_id);
CREATE INDEX IF NOT EXISTS idx_asset_units_status        ON asset_units(status);

-- Seed: sample asset units for existing resources
-- (run after resources table is populated)
-- Replace resource IDs below with actual UUIDs from your DB,
-- or run the dynamic seed below which looks them up by name.

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2023-0001', 'YAMAHA-RB-2023-001', 'good', 'available', '2023-06-15', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Rescue%Boat%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2023-0002', 'YAMAHA-RB-2023-002', 'good', 'available', '2023-06-15', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Rescue%Boat%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2023-0003', 'YAMAHA-RB-2023-003', 'fair', 'maintenance', '2023-06-15', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Rescue%Boat%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0001', 'HUSQVARNA-CS-2024-01', 'good', 'available', '2024-02-10', 'LGU Ormoc City Procurement'
FROM resources r WHERE r.name ILIKE '%Chainsaw%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0002', 'HUSQVARNA-CS-2024-02', 'good', 'available', '2024-02-10', 'LGU Ormoc City Procurement'
FROM resources r WHERE r.name ILIKE '%Chainsaw%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0003', 'HONDA-GEN-2024-01', 'good', 'available', '2024-03-20', 'BDRRMC Capital Outlay FY2024'
FROM resources r WHERE r.name ILIKE '%Generator%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0004', 'MPHILSAN-MP-2024-01', 'good', 'available', '2024-01-05', 'Donated by Ormoc Rotary Club'
FROM resources r WHERE r.name ILIKE '%Megaphone%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

-- =============================================
-- Serialized Asset Seeds — All Inventory Types
-- Extends Feature Update 11 seeds to cover
-- consumable and non-consumable items
-- =============================================

-- Life Jackets (consumable-adjacent, tracked individually)
INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0005', 'good', 'available', '2024-01-10', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Life Jacket%' OR r.name ILIKE '%Flotation%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0006', 'good', 'available', '2024-01-10', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Life Jacket%' OR r.name ILIKE '%Flotation%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

-- Emergency First Aid Kits
INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0007', 'good', 'available', '2024-03-01', 'BHS Procurement FY2024'
FROM resources r WHERE r.name ILIKE '%First Aid%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0008', 'fair', 'available', '2024-03-01', 'BHS Procurement FY2024'
FROM resources r WHERE r.name ILIKE '%First Aid%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

-- Stretchers
INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0009', 'good', 'available', '2024-02-15', 'BHS Procurement FY2024'
FROM resources r WHERE r.name ILIKE '%Stretcher%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

-- Portable Generator
INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0010', 'HONDA-GEN-2024-02', 'new', 'available', '2024-04-01', 'BDRRMC Capital Outlay FY2024'
FROM resources r WHERE r.name ILIKE '%Generator%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

-- Sandbag bundle
INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0011', 'good', 'available', '2024-01-20', 'LGU Ormoc City Procurement'
FROM resources r WHERE r.name ILIKE '%Sandbag%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

-- Emergency Lighting Tower
INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0012', 'good', 'available', '2024-03-25', 'CDRRMO Emergency Grant 2024'
FROM resources r WHERE r.name ILIKE '%Lighting Tower%' LIMIT 1
ON CONFLICT (property_code) DO NOTHING;

-- =============================================
-- Serialized Asset Fields on resources table
-- (Feature Update 12 — replaces asset_units approach)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS property_code  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS serial_number  VARCHAR(100);

-- Make property_code unique where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_property_code
  ON resources(property_code)
  WHERE property_code IS NOT NULL;

-- Back-fill existing seed data with property codes (PostgreSQL compliant subqueries, idempotent)
UPDATE resources SET property_code = 'BRG-2023-0001' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Rescue%Boat%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2023-0001');
UPDATE resources SET property_code = 'BRG-2023-0002' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%First Aid%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2023-0002');
UPDATE resources SET property_code = 'BRG-2023-0003' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Food Pack%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2023-0003');
UPDATE resources SET property_code = 'BRG-2023-0004' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Tent%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2023-0004');
UPDATE resources SET property_code = 'BRG-2023-0005' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Patrol%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2023-0005');
UPDATE resources SET property_code = 'BRG-2024-0001' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Life Jacket%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0001');
UPDATE resources SET property_code = 'BRG-2024-0002' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Water Purification%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0002');
UPDATE resources SET property_code = 'BRG-2024-0003' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Fire Extinguisher%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0003');
UPDATE resources SET property_code = 'BRG-2024-0004' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Crowd Control%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0004');
UPDATE resources SET property_code = 'BRG-2024-0005' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Generator%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0005');
UPDATE resources SET property_code = 'BRG-2024-0006' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Chainsaw%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0006');
UPDATE resources SET property_code = 'BRG-2024-0007' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Megaphone%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0007');
UPDATE resources SET property_code = 'BRG-2024-0008' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Stretcher%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0008');
UPDATE resources SET property_code = 'BRG-2024-0009' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Lighting Tower%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0009');
UPDATE resources SET property_code = 'BRG-2024-0010' WHERE ctid = (SELECT ctid FROM resources WHERE name ILIKE '%Sandbag%' AND property_code IS NULL LIMIT 1) AND NOT EXISTS (SELECT 1 FROM resources WHERE property_code = 'BRG-2024-0010');

-- =============================================
-- Dispatch Log Upgrade — Equipment Borrowing
-- (Feature Update 13)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE resource_dispatch
  ADD COLUMN IF NOT EXISTS ticket_id       VARCHAR(20),
  -- Auto-generated format: DSP-YYYY-NNNN (e.g. DSP-2025-0042)
  ADD COLUMN IF NOT EXISTS borrower_name   VARCHAR(100),
  -- Who borrowed the equipment (free text for now, dropdown later)
  ADD COLUMN IF NOT EXISTS borrower_contact VARCHAR(50),
  -- Optional contact number of borrower
  ADD COLUMN IF NOT EXISTS purpose         TEXT,
  -- Purpose / reason for borrowing
  ADD COLUMN IF NOT EXISTS due_date        DATE,
  -- Expected return date (optional)
  ADD COLUMN IF NOT EXISTS dispatched_at_precise TIMESTAMPTZ DEFAULT NOW();
  -- Full timestamp with seconds (replaces dispatched_at for display)

-- Index for fast lookup by ticket
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatch_ticket_id
  ON resource_dispatch(ticket_id)
  WHERE ticket_id IS NOT NULL;

-- =============================================
-- Resource Activity Log (Feature Update 15)
-- Run in Supabase SQL Editor
-- Tracks all resource events: added, dispatched,
-- returned, restocked, status changed, archived
-- =============================================

CREATE TABLE IF NOT EXISTS resource_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id  UUID REFERENCES resources(id) ON DELETE SET NULL,
  resource_name VARCHAR(150),           -- denormalized so log survives deletion
  resource_type VARCHAR(50),            -- denormalized type
  event_type   VARCHAR(30) NOT NULL,    -- 'added','dispatched','returned','restocked','status_changed','archived'
  qty_change   INTEGER DEFAULT 0,       -- positive = stock increase, negative = stock decrease
  qty_before   INTEGER,                 -- available_quantity before event
  qty_after    INTEGER,                 -- available_quantity after event
  new_status   VARCHAR(20),             -- resulting status after event
  reference_id UUID,                    -- dispatch ticket id, restock batch id, etc.
  description  TEXT,                    -- human-readable summary of what happened
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(100),       -- denormalized full name
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_logs_resource_id ON resource_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_logs_event_type  ON resource_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_resource_logs_created_at  ON resource_logs(created_at DESC);

-- =============================================
-- Dispatch Destination + Maintenance Notes (Feature Update 15b)
-- Run in Supabase SQL Editor
-- =============================================

ALTER TABLE resource_dispatch
  ADD COLUMN IF NOT EXISTS destination TEXT;
  -- Where the equipment is being deployed (e.g. "Sitio 2 Riverbank")

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS maintenance_notes TEXT;
  -- Description/notes set when status is changed to maintenance/damaged/unavailable

-- Extend resources status column to support new values
-- (VARCHAR has no enum restriction in Postgres — already accepts any string)
-- Document accepted values here for reference:
-- 'available', 'deployed', 'maintenance', 'damaged', 'unavailable'

COMMENT ON COLUMN resources.status IS
  'available | deployed | maintenance | damaged | unavailable';
