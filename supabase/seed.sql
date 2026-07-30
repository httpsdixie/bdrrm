-- =============================================
-- Barangay DRRM — Full Seed Script
-- Run this in the Supabase SQL Editor
-- (Project: peklextkcmcjelcmrxbs)
-- =============================================

-- =============================================
-- SECTION 1: USERS
-- Password: admin1234  (change after first login)
-- =============================================
INSERT INTO users (username, password_hash, full_name, role) VALUES
  ('admin',    '$2b$12$0NwOe9qBQXHnV9BcYqglpua2W8YM1gLNnNzNu.NHyPfJTY15akQ/q', 'DRRM Administrator',    'admin'),
  ('officer1', '$2b$12$0NwOe9qBQXHnV9BcYqglpua2W8YM1gLNnNzNu.NHyPfJTY15akQ/q', 'Officer Juan Reyes',    'officer'),
  ('officer2', '$2b$12$0NwOe9qBQXHnV9BcYqglpua2W8YM1gLNnNzNu.NHyPfJTY15akQ/q', 'Officer Maria Santos',  'officer'),
  ('responder1','$2b$12$0NwOe9qBQXHnV9BcYqglpua2W8YM1gLNnNzNu.NHyPfJTY15akQ/q','Responder Ben Cruz',    'responder'),
  ('responder2','$2b$12$0NwOe9qBQXHnV9BcYqglpua2W8YM1gLNnNzNu.NHyPfJTY15akQ/q','Responder Ana Flores',  'responder')
ON CONFLICT (username) DO NOTHING;


-- =============================================
-- SECTION 2: HAZARD ZONES
-- =============================================
DELETE FROM hazard_zones WHERE name IN (
  'Linao Low-lying Flood Zone', 'Linao Hillside Landslide Zone',
  'Hz Flood Test', 'Hz Land Test'
);

INSERT INTO hazard_zones (name, type, risk_level, description, coordinates) VALUES
(
  'Linao Bao River Flood Zone', 'flood', 'high',
  'Low-lying floodplain along the Bao River tributary. Inundates within 2-3 hours of heavy rainfall. Affects approximately 45 households.',
  '[[124.5845,11.0135],[124.5875,11.0155],[124.5895,11.0148],[124.5910,11.0130],[124.5895,11.0112],[124.5865,11.0108],[124.5842,11.0120]]'::jsonb
),
(
  'Linao Barangay Center Flood Zone', 'flood', 'medium',
  'Low-elevation area near the barangay center. Susceptible to flash flooding during typhoon events. Affects road access to evacuation centers.',
  '[[124.5905,11.0175],[124.5935,11.0185],[124.5945,11.0165],[124.5925,11.0150],[124.5905,11.0158]]'::jsonb
),
(
  'Linao Eastern Hillside Landslide Zone', 'landslide', 'high',
  'Steep hillside terrain on the eastern boundary. History of soil erosion and debris flow during Typhoon Yolanda (2013). High risk during sustained rainfall > 50mm.',
  '[[124.5955,11.0220],[124.5985,11.0238],[124.6000,11.0225],[124.5990,11.0205],[124.5960,11.0200]]'::jsonb
),
(
  'Linao Northern Slope Erosion Zone', 'landslide', 'medium',
  'Moderate slope on the northern portion with loose soil composition. Secondary landslide risk, especially after prolonged rain events.',
  '[[124.5878,11.0250],[124.5910,11.0262],[124.5920,11.0248],[124.5900,11.0235],[124.5875,11.0238]]'::jsonb
)
ON CONFLICT DO NOTHING;


-- =============================================
-- SECTION 3: HOSPITALS
-- =============================================
INSERT INTO hospitals (name, address, latitude, longitude, contact_number, services) VALUES
  ('Barangay Linao Health Station (BHS)', 'Main Street, Brgy Linao, Ormoc City', 11.0185, 124.5940, '(053) 561-2244', 'First Aid, Triage, Maternal Care'),
  ('Ormoc District Hospital',            'Ormoc City, Leyte',                   11.0062, 124.6078, '(053) 255-2604', 'Emergency Care, Surgery, Inpatient, ICU'),
  ('Ormoc Bethany Hospital',             'Ormoc City, Leyte',                   11.0075, 124.6055, '(053) 255-5577', 'General Medicine, Maternity, X-ray, Laboratory')
ON CONFLICT DO NOTHING;

-- =============================================
-- SECTION 4: RESPONDER STATIONS
-- =============================================
INSERT INTO responder_stations (name, type, address, latitude, longitude, contact_number, personnel_count) VALUES
  ('Barangay Linao BDRRMC Office',  'bdrrmc',       'Barangay Hall, Linao, Ormoc City',       11.0168, 124.5918, '0917-123-4567',  18),
  ('Ormoc City Fire Station',       'fire_station', 'Ormoc City Fire Station',                11.0059, 124.6080, '(053) 255-2114', 35),
  ('Ormoc City Police Station',     'police',       'PNP Station, Ormoc City',                11.0048, 124.6090, '(053) 255-2333', 60),
  ('Philippine Coast Guard Ormoc',  'coast_guard',  'Port Area, Ormoc City',                  11.0025, 124.6120, '(053) 255-3524', 22),
  ('Ormoc Barangay Health Station', 'bhs',          'Main St, Brgy Linao, Ormoc City',        11.0185, 124.5940, '(053) 561-2244', 5)
ON CONFLICT DO NOTHING;


-- =============================================
-- SECTION 5: EMERGENCY CONTACTS / DIRECTORY
-- =============================================
INSERT INTO emergency_contacts (name, agency, category, hotline, secondary_number, address, available_24h, sort_order) VALUES
  ('Ormoc City CDRRMO',            'CDRRMO',               'disaster',  '(053) 255-2830', '0917-123-4567', 'City Hall, Ormoc City',                  TRUE,  1),
  ('Barangay Linao BDRRMO',        'BDRRMO',               'disaster',  '0917-234-5678',  NULL,            'Barangay Hall, Linao, Ormoc City',       TRUE,  2),
  ('Ormoc City Fire Station',      'BFP',                  'fire',      '(053) 255-2114', '0998-888-1000', 'Ormoc City Fire Station',                TRUE,  3),
  ('Ormoc City Police Station',    'PNP',                  'police',    '(053) 255-2333', '0917-888-2000', 'PNP Station, Ormoc City',                TRUE,  4),
  ('Philippine Coast Guard Ormoc', 'Coast Guard',          'emergency', '(053) 255-3524', '0917-888-3000', 'Port Area, Ormoc City',                  TRUE,  5),
  ('Ormoc Philippine Red Cross',   'Philippine Red Cross', 'medical',   '(053) 561-1234', '0917-123-9999', 'Red Cross Chapter, Ormoc City',          TRUE,  6),
  ('NDRRMC Operations Center',     'NDRRMC',               'disaster',  '(02) 8911-5061', '0918-912-2665', 'Camp Aguinaldo, Quezon City',            TRUE,  7),
  ('Ormoc District Hospital',      'DOH',                  'medical',   '(053) 255-2604', NULL,            'Ormoc City, Leyte',                      TRUE,  8),
  ('Ormoc City DSWDO',             'DSWDO',                'emergency', '(053) 255-3456', NULL,            'City Hall, Ormoc City',                  FALSE, 9),
  ('Barangay Linao Health Station','BHS',                  'medical',   '(053) 561-2244', NULL,            'Main St, Brgy Linao, Ormoc City',        FALSE, 10),
  ('MDRRMO Leyte',                 'MDRRMO',               'disaster',  '(053) 321-2222', '0917-888-5500', 'Capitol Building, Tacloban City',        TRUE,  11),
  ('Ormoc DSWD Satellite Office',  'DSWD',                 'emergency', '(053) 255-9988', NULL,            'Ormoc City',                             FALSE, 12)
ON CONFLICT DO NOTHING;


-- =============================================
-- SECTION 6: EVACUATION CENTERS
-- =============================================
INSERT INTO evacuation_centers (
  name, address, latitude, longitude, capacity, current_occupancy,
  status, contact_person, contact_number,
  facilities, status_remarks,
  has_water, has_electricity, has_first_aid, has_food, has_sanitation
) VALUES
(
  'Tambulilid Covered Court',
  'Sitio Tambulilid, Brgy Linao, Ormoc City', 11.0235, 124.5885, 350, 45, 'available',
  'Brgy Capt. Ramirez', '0917-123-4567',
  'Clean Water, Generator Power, First Aid Kits, Sleeping Mats',
  'Partially occupied. Relief distribution ongoing.',
  TRUE, TRUE, TRUE, FALSE, TRUE
),
(
  'Linao Elementary School Gymnasium',
  'Main Street, Brgy Linao, Ormoc City', 11.0145, 124.5905, 500, 0, 'available',
  'Principal V. Torres', '0918-987-6543',
  'Restrooms, Emergency Community Kitchen, Triage Room',
  'On standby — pre-positioned supplies in place.',
  TRUE, FALSE, TRUE, TRUE, TRUE
),
(
  'Barangay Multi-Purpose Complex',
  'Barangay Center, Brgy Linao, Ormoc City', 11.0168, 124.5918, 150, 150, 'full',
  'Kagawad B. Flores', '0920-555-8899',
  'Command Desk, Solar Power, Radio Communications',
  'At full capacity. Overflow being routed to Tambulilid.',
  TRUE, TRUE, TRUE, FALSE, FALSE
),
(
  'Purok 4 Sitio Relief Center',
  'Purok 4, Brgy Linao, Ormoc City', 11.0210, 124.5945, 100, 12, 'available',
  'Tanod Leader M. Delos', '0915-333-7721',
  'Sleeping Mats, Drinking Water',
  'Low occupancy. Accepting new evacuees.',
  TRUE, FALSE, FALSE, FALSE, TRUE
),
(
  'Ormoc Disaster Shelter West',
  'National Highway, Brgy Linao, Ormoc City', 11.0190, 124.5870, 200, 0, 'available',
  'CDRRMO Liaison', '(053) 255-2830',
  'Water, Generator Power, First Aid Kits, Sleeping Mats, Food Station, Sanitation Facilities',
  'Fully equipped, awaiting activation.',
  TRUE, TRUE, TRUE, TRUE, TRUE
)
ON CONFLICT DO NOTHING;


-- =============================================
-- SECTION 7: RESOURCES / EQUIPMENT INVENTORY
-- =============================================
INSERT INTO resources (name, type, category, quantity, available_quantity, location, status, ownership_tier) VALUES
  ('Inflatable Rescue Rubber Boat (Engine-Powered)',      'rescue_boat',  'disaster',  4,   4,   'Barangay Operations Center Storage', 'available',   'barangay'),
  ('Emergency First Aid Trauma Kit',                     'medical_kit',  'medical',   25,  25,  'Barangay Health Station (BHS)',       'available',   'barangay'),
  ('Family Relief Food Pack (5-Day Supply)',              'food_pack',    'emergency', 200, 200, 'Barangay Multi-Purpose Warehouse',   'available',   'barangay'),
  ('Emergency Temporary Shelter Tent (10-Person)',        'tent',         'emergency', 30,  30,  'Evacuation Center Depot',            'available',   'barangay'),
  ('BDRRMC Emergency Patrol Utility Vehicle',            'vehicle',      'emergency', 2,   2,   'Barangay Hall Parking Area',         'available',   'barangay'),
  ('Life Jackets / Personal Flotation Devices (Adult)',  'other',        'disaster',  50,  50,  'Barangay Operations Center Storage', 'available',   'barangay'),
  ('Life Jackets (Child)',                               'other',        'disaster',  20,  20,  'Barangay Operations Center Storage', 'available',   'barangay'),
  ('Portable Water Purification Unit',                   'other',        'emergency', 3,   3,   'Evacuation Center Depot',            'available',   'barangay'),
  ('BFP Fire Extinguisher (ABC Dry Chemical 10kg)',      'other',        'fire',      15,  15,  'Barangay Hall Fire Cabinet',         'available',   'barangay'),
  ('Police Crowd Control Barrier (Metal Fence)',         'other',        'police',    20,  20,  'Brgy Hall Storage Area',             'available',   'barangay'),
  ('Portable Electric Generator (5kVA)',                 'other',        'emergency', 3,   3,   'Evacuation Center Depot',            'available',   'barangay'),
  ('Chainsaw (for Fallen Tree Clearing)',                'other',        'disaster',  2,   2,   'Barangay Operations Center Storage', 'available',   'barangay'),
  ('Megaphone / Bullhorn (Emergency Announcement)',      'other',        'emergency', 5,   5,   'Barangay Hall',                      'available',   'barangay'),
  ('Stretcher / Medical Transport Board',                'other',        'medical',   8,   8,   'Barangay Health Station (BHS)',      'available',   'barangay'),
  ('Emergency Lighting Tower (LED, Portable)',           'other',        'emergency', 2,   2,   'Evacuation Center Depot',            'available',   'barangay'),
  ('Sandbag (Flood Barrier, Bundle of 50)',              'other',        'disaster',  100, 100, 'Barangay Operations Center Storage', 'available',   'barangay'),
  ('BDRRMC Rescue Ambulance Unit 1',                    'ambulance',    'medical',   1,   1,   'Barangay Hall Parking Area',         'available',   'barangay'),
  ('BFP Ormoc Fire Truck (Liaison Unit)',                'fire_truck',   'fire',      1,   1,   'BFP Ormoc Station (On-Call)',         'available',   'cdrrmo'),
  ('Diesel Fuel Reserve (20L Containers)',               'fuel',         'emergency', 10,  10,  'Barangay Hall Bodega',               'available',   'barangay'),
  ('Gasoline Fuel Reserve (20L Containers)',             'fuel',         'emergency', 5,   5,   'Barangay Hall Bodega',               'available',   'barangay'),
  ('BDRRMC Patrol Motorcycle',                           'vehicle',      'emergency', 3,   3,   'Barangay Hall Parking Area',         'available',   'barangay'),
  ('Portable Stretcher',                                 'other',        'medical',   6,   6,   'Barangay Health Station (BHS)',      'available',   'barangay')
ON CONFLICT DO NOTHING;


-- =============================================
-- SECTION 8: INCIDENTS (10 demo records)
-- =============================================
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
    'Rising sea tide and river overflow inundating lower residential structures in Sitio 2. ~15 households affected with standing water at knee level.',
    'flood', 'responding', 'high', 11.0125, 124.5865,
    'Sitio 2 Shoreline, Barangay Linao, Ormoc City',
    15, 'Dispatched 4 BDRRMC responders + 1 rubber boat. BHS medic on standby.',
    '4 BDRRMC Responders, 2 Tanods, 1 BHS Medic',
    2, 'injured', 0, 2, 'conscious', 'natural_hazard', 'Capt. Ramirez (BDRRMC)', '0917-123-4567', 'validated'
  ),(
    'Purok 2 Hillside Soil Erosion & Landslide',
    'Minor soil movement and debris onto primary access road after sustained heavy rain. Road partially blocked with loose earth and tree branches.',
    'landslide', 'active', 'medium', 11.0210, 124.5925,
    'Purok 2 Hillside Access Road, Barangay Linao',
    8, 'Cordoned off affected road. Deployed tanods for traffic control. Chainsaw team notified.',
    '3 Barangay Tanods, 1 BDRRMC Monitor',
    0, 'none', 0, 0, 'not_applicable', 'natural_hazard', 'Patrol Signal / Resident Report', '0928-555-0192', 'validated'
  ),(
    'Residential Electrical Fire Risk — Overloaded Transformer',
    'Overloaded transformer post near wooden residential roofing sparked and produced smoke. Nearby households evacuated as precaution.',
    'fire', 'active', 'critical', 11.0185, 124.5940,
    'Main Street near Barangay Hall, Barangay Linao',
    5, 'Notified ORECO and BFP Ormoc City. Evacuated 3 households within 15-meter radius.',
    '2 BDRRMC Responders, 1 Kagawad',
    0, 'none', 0, 0, 'not_applicable', 'infrastructure_failure', 'Elena Santos', '0909-444-1122', 'validated'
  ),(
    'Tricycle Slip & Minor Collision Near School Zone',
    'Passenger tricycle skidded on wet pavement near school entrance and collided with a parked motorcycle. Driver sustained minor abrasions.',
    'road_accident', 'resolved', 'low', 11.0145, 124.5905,
    'Linao Elementary School Zone, Barangay Linao',
    3, 'First aid rendered by BHS medic. Vehicles cleared. Police substation notified.',
    '1 BHS Medic, 1 Tanod',
    1, 'injured', 0, 1, 'conscious', 'human_induced', 'BHS Medic On-Duty', '(053) 561-2244', 'validated'
  ),(
    'Fallen Mahogany Branch Blocking Alley Access Road',
    'Heavy wind snapped a large mahogany limb across a community alleyway near Purok 3. No injuries reported.',
    'other', 'resolved', 'low', 11.0225, 124.5955,
    'Purok 3 Community Alley, Barangay Linao',
    0, 'Deployed chainsaw team. All timber debris removed. Area cleared within 45 minutes.',
    '2 BDRRMC Responders, Chainsaw Team',
    0, 'none', 0, 0, 'not_applicable', 'natural_hazard', 'Tanod V. Cruz', '0915-888-3311', 'validated'
  ),(
    'Medical Emergency — Hypertensive Crisis (Elderly Resident)',
    'Elderly resident (72F) reported acute chest pain and elevated blood pressure at home.',
    'medical', 'resolved', 'high', 11.0168, 124.5918,
    'Purok 1, Near Barangay Hall, Barangay Linao',
    2, 'BHS nurse dispatched. Vital signs stabilized. Transported to Ormoc District Hospital.',
    '1 BHS Nurse, 1 Barangay Kagawad',
    1, 'injured', 0, 1, 'conscious', 'natural_hazard', 'Family of Patient', '0917-999-0011', 'validated'
  ),(
    'Flash Flood — Low-lying Coastal Road Inundation',
    'Coastal access road near fish landing inundated with ~0.8m of floodwater during Tropical Storm activity. Road impassable.',
    'flood', 'resolved', 'high', 11.0115, 124.5850,
    'Coastal Fish Landing Access Road, Brgy Linao',
    22, 'Deployed rescue boat. Assisted 22 residents to evacuate to Linao Elementary School.',
    '5 BDRRMC Responders, 3 Tanods, 1 Coast Guard Liaison',
    0, 'none', 0, 0, 'not_applicable', 'natural_hazard', 'Sitio Leader A. Vergara', '0916-777-4422', 'validated'
  ),(
    'Request for Emergency Assistance — Stranded Fishermen',
    'Three fishermen stranded offshore near Linao coastal waters due to engine failure during moderate sea conditions.',
    'assistance', 'resolved', 'high', 11.0110, 124.5845,
    'Linao Coastal Waters, Offshore Area',
    3, 'Coordinated with PCG Ormoc. Rubber boat deployed. All 3 retrieved safely within 2 hours.',
    '3 BDRRMC Responders, 2 Coast Guard Personnel',
    0, 'none', 0, 0, 'conscious', 'human_induced', 'Family Caller / Dispatch Radio', '0918-212-3344', 'validated'
  ),(
    'Suspected Food Poisoning — Community Gathering',
    'Seven residents reported nausea, vomiting and abdominal pain following a community gathering at Purok 4.',
    'medical', 'resolved', 'medium', 11.0210, 124.5950,
    'Purok 4 Community Hall, Barangay Linao',
    7, 'BHS team dispatched. ORT given to all 7 patients. 2 referred to Ormoc District Hospital.',
    '2 BHS Staff, 1 BDRRMC Responder',
    7, 'injured', 0, 7, 'conscious', 'human_induced', 'Kagawad M. Palanca', '0920-654-3219', 'pending'
  ),(
    'Debris & Garbage Burning Causing Air Quality Risk',
    'Unattended burning of household waste near residential area producing thick smoke. Risk to elderly and children.',
    'other', 'resolved', 'low', 11.0195, 124.5935,
    'Sitio 3 Agricultural Zone Boundary, Brgy Linao',
    0, 'Tanod responded and extinguished fire. Property owner warned. Ordinance reminder issued.',
    '1 Barangay Tanod',
    0, 'none', 0, 0, 'not_applicable', 'human_induced', 'Neighbor Complaint / Anonymous', NULL, 'validated'
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
-- SECTION 9: EVACUATION TRACKING (during phase)
-- =============================================
INSERT INTO evacuation_tracking (
  center_id, phase,
  demo_pwd, demo_pregnant, demo_children, demo_youth, demo_senior, demo_ip,
  sector_breakdown,
  relief_food, relief_water, relief_clothing,
  water_system, electricity, internet_signal,
  camp_manager, camp_manager_contact, assigned_official
)
SELECT
  ec.id, 'during',
  2, 3, 18, 8, 7, 0,
  '[{"sector":"Sitio 2","count":25},{"sector":"Purok 1","count":20}]'::jsonb,
  'limited', 'adequate', 'none',
  'operational', 'generator', 'weak',
  'Kagawad B. Flores', '0920-555-8899', 'Brgy Capt. Ramirez'
FROM evacuation_centers ec WHERE ec.name = 'Tambulilid Covered Court' LIMIT 1
ON CONFLICT (center_id, phase) DO NOTHING;

INSERT INTO evacuation_tracking (
  center_id, phase,
  demo_pwd, demo_pregnant, demo_children, demo_youth, demo_senior, demo_ip,
  sector_breakdown,
  relief_food, relief_water, relief_clothing,
  water_system, electricity, internet_signal,
  camp_manager, camp_manager_contact, assigned_official
)
SELECT
  ec.id, 'during',
  0, 0, 0, 0, 0, 0,
  '[]'::jsonb,
  'adequate', 'adequate', 'none',
  'operational', 'unavailable', 'good',
  'Principal V. Torres', '0918-987-6543', 'Officer Juan Reyes'
FROM evacuation_centers ec WHERE ec.name = 'Linao Elementary School Gymnasium' LIMIT 1
ON CONFLICT (center_id, phase) DO NOTHING;

-- =============================================
-- SECTION 10: HISTORICAL UTILIZATION LOG
-- =============================================
INSERT INTO evac_history_log (
  center_id, event_name, event_type, event_date,
  peak_occupancy, total_served, duration_days,
  bottlenecks, structural_notes, reliability_rating, lessons_learned
)
SELECT ec.id,
  'Typhoon Odette (2021)', 'typhoon', '2021-12-16',
  320, 420, 7,
  'Food packs depleted by Day 3. Generator fuel ran out on Day 5.',
  'Minor roof damage on east wing. Floor held well. No structural failure.',
  'good',
  'Pre-position 500 food packs minimum. Keep generator fuel for 7 days.'
FROM evacuation_centers ec WHERE ec.name = 'Tambulilid Covered Court' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO evac_history_log (
  center_id, event_name, event_type, event_date,
  peak_occupancy, total_served, duration_days,
  bottlenecks, structural_notes, reliability_rating, lessons_learned
)
SELECT ec.id,
  'Typhoon Odette (2021)', 'typhoon', '2021-12-16',
  480, 650, 7,
  'Toilet facilities overwhelmed by Day 2. Water supply disrupted.',
  'Gymnasium roof intact. Some window damage. Drainage adequate.',
  'good',
  'Install additional portable toilets. Coordinate with LWUA for backup water.'
FROM evacuation_centers ec WHERE ec.name = 'Linao Elementary School Gymnasium' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO evac_history_log (
  center_id, event_name, event_type, event_date,
  peak_occupancy, total_served, duration_days,
  bottlenecks, structural_notes, reliability_rating, lessons_learned
)
SELECT ec.id,
  'Typhoon Yolanda (2013)', 'typhoon', '2013-11-08',
  148, 280, 14,
  'Severely overcrowded. No food for first 72 hours. No generator.',
  'Building sustained moderate damage. Has since been repaired.',
  'fair',
  'Upgrade generator capacity. Establish emergency food pre-positioning.'
FROM evacuation_centers ec WHERE ec.name = 'Barangay Multi-Purpose Complex' LIMIT 1
ON CONFLICT DO NOTHING;

-- =============================================
-- SECTION 11: ASSET UNITS (serialized tracking)
-- =============================================
INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2023-0001', 'YAMAHA-RB-2023-001', 'good',       'available',   '2023-06-15', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Rescue%Boat%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2023-0002', 'YAMAHA-RB-2023-002', 'good',       'available',   '2023-06-15', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Rescue%Boat%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2023-0003', 'YAMAHA-RB-2023-003', 'fair',       'maintenance', '2023-06-15', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Rescue%Boat%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0001', 'HUSQVARNA-CS-2024-01', 'good',     'available',   '2024-02-10', 'LGU Ormoc City Procurement'
FROM resources r WHERE r.name ILIKE '%Chainsaw%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0002', 'HUSQVARNA-CS-2024-02', 'good',     'available',   '2024-02-10', 'LGU Ormoc City Procurement'
FROM resources r WHERE r.name ILIKE '%Chainsaw%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0003', 'HONDA-GEN-2024-01',    'good',     'available',   '2024-03-20', 'BDRRMC Capital Outlay FY2024'
FROM resources r WHERE r.name ILIKE '%Generator%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0004', 'HONDA-GEN-2024-02',    'new',      'available',   '2024-04-01', 'BDRRMC Capital Outlay FY2024'
FROM resources r WHERE r.name ILIKE '%Generator%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, serial_number, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0005', 'MPHILSAN-MP-2024-01',  'good',     'available',   '2024-01-05', 'Donated by Ormoc Rotary Club'
FROM resources r WHERE r.name ILIKE '%Megaphone%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0006', 'good', 'available', '2024-03-25', 'CDRRMO Emergency Grant 2024'
FROM resources r WHERE r.name ILIKE '%Lighting Tower%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0007', 'good', 'available', '2024-01-10', 'CDRRMO Emergency Grant 2023'
FROM resources r WHERE r.name ILIKE '%Life Jacket%' AND r.name ILIKE '%Adult%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0008', 'good', 'available', '2024-03-01', 'BHS Procurement FY2024'
FROM resources r WHERE r.name ILIKE '%First Aid%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

INSERT INTO asset_units (resource_id, property_code, condition, status, acquisition_date, acquisition_source)
SELECT r.id, 'BRG-2024-0009', 'good', 'available', '2024-02-15', 'BHS Procurement FY2024'
FROM resources r WHERE r.name ILIKE '%Stretcher%' LIMIT 1 ON CONFLICT (property_code) DO NOTHING;

-- =============================================
-- END OF SEED SCRIPT
-- =============================================
