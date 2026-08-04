-- =============================================
-- Barangay DRRM — Clean Database Script
-- Wipes all operational records, logs, and extra accounts
-- Retains ONLY the primary 'admin' user account.
-- Run this script in the Supabase SQL Editor.
-- =============================================

-- 1. Wipe all operational activity logs, incidents, resources, shelters, and GIS features
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

-- 2. Remove all secondary user accounts while retaining the primary admin
DELETE FROM users WHERE username != 'admin';

-- 3. Verify clean state summary
SELECT 'users' AS table_name, COUNT(*) AS count FROM users
UNION ALL
SELECT 'incidents', COUNT(*) FROM incidents
UNION ALL
SELECT 'evacuation_centers', COUNT(*) FROM evacuation_centers
UNION ALL
SELECT 'resources', COUNT(*) FROM resources
UNION ALL
SELECT 'resource_dispatch', COUNT(*) FROM resource_dispatch;
