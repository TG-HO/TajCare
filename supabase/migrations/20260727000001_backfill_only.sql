-- TAJ CARE: ONLY RUN THIS IF THE MAIN MIGRATION (20260727000000) ALREADY PARTIALLY RAN
-- This completes the backfill that failed due to schema search path issues.
-- Run in Supabase SQL Editor.

-- Backfill closed_at for any existing Closed tickets
UPDATE tickets
SET closed_at = updated_at
WHERE status = 'Closed' AND closed_at IS NULL;

-- Verify the new columns exist on tickets
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'tickets'
  AND column_name IN ('points_pending', 'confirmed_points', 'closed_at')
ORDER BY column_name;

-- Verify the new table exists
SELECT COUNT(*) as monthly_points_rows FROM responder_monthly_points;

-- Verify the functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'fn_%'
ORDER BY routine_name;
