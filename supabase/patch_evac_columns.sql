-- =============================================
-- Patch: Add missing columns to evacuation_centers
-- Run this in the Supabase SQL Editor
-- =============================================

ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS year_established INTEGER,
  ADD COLUMN IF NOT EXISTS floor_area_sqm NUMERIC,
  ADD COLUMN IF NOT EXISTS lot_area TEXT,
  ADD COLUMN IF NOT EXISTS type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS personnel_directory JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS facilities_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS camp_layout_filename TEXT,
  ADD COLUMN IF NOT EXISTS contingency_plan TEXT,
  ADD COLUMN IF NOT EXISTS prepared_by JSONB,
  ADD COLUMN IF NOT EXISTS approved_by JSONB,
  ADD COLUMN IF NOT EXISTS structural_integrity_report TEXT,
  ADD COLUMN IF NOT EXISTS jmc2_checklist JSONB,
  ADD COLUMN IF NOT EXISTS jmc2_score NUMERIC,
  ADD COLUMN IF NOT EXISTS jmc2_last_assessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS jmc2_inspector VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status_remarks TEXT,
  ADD COLUMN IF NOT EXISTS facilities TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS last_updated_by_name VARCHAR(100);

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
