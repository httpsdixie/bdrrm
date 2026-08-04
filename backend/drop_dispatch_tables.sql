-- Migration: Drop responder/dispatch related tables (destructive)
-- Run this using Supabase SQL editor or psql connected to the target database.
-- IMPORTANT: This permanently deletes data. Ensure backups were taken before running.

BEGIN;

-- Drop dispatch records
DROP TABLE IF EXISTS responder_dispatch CASCADE;
DROP TABLE IF EXISTS resource_dispatch CASCADE;

-- Drop responder registry / station tables (if present)
DROP TABLE IF EXISTS responder_stations CASCADE;
DROP TABLE IF EXISTS responder_registry CASCADE;

-- If your schema uses different table names for responder lists, add DROP TABLE IF EXISTS <table> CASCADE;

COMMIT;

-- End of migration
