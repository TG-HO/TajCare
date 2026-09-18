-- ==============================================================================
-- TAJ CARE: HIERARCHY-WISE RESPONSE TIMES CONFIGURATION
-- File: 20260918000000_hierarchy_response_times.sql
-- Run this in your Supabase SQL Editor to apply database schema updates.
-- ==============================================================================

-- 1. Ensure public.predefined_issues table exists
CREATE TABLE IF NOT EXISTS public.predefined_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    issue_title TEXT NOT NULL,
    complexity TEXT NOT NULL CHECK (complexity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    base_points INT NOT NULL DEFAULT 20,
    resolution_time_hours INT DEFAULT 24,
    resolution_time_minutes INT DEFAULT 0,
    responder_response_hours INT DEFAULT 2,
    responder_response_minutes INT DEFAULT 0,
    supervisor_response_hours INT DEFAULT 2,
    supervisor_response_minutes INT DEFAULT 0,
    line_manager_response_hours INT DEFAULT 2,
    line_manager_response_minutes INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add columns if table already exists
ALTER TABLE public.predefined_issues 
  ADD COLUMN IF NOT EXISTS resolution_time_hours INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS resolution_time_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responder_response_hours INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS responder_response_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supervisor_response_hours INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS supervisor_response_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_manager_response_hours INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS line_manager_response_minutes INT DEFAULT 0;

-- 3. Validation constraint for minute ranges (0-59) and non-negative hours
ALTER TABLE public.predefined_issues DROP CONSTRAINT IF EXISTS predefined_issues_response_minutes_check;
ALTER TABLE public.predefined_issues ADD CONSTRAINT predefined_issues_response_minutes_check 
  CHECK (
    (responder_response_minutes >= 0 AND responder_response_minutes <= 59) AND
    (supervisor_response_minutes >= 0 AND supervisor_response_minutes <= 59) AND
    (line_manager_response_minutes >= 0 AND line_manager_response_minutes <= 59) AND
    (responder_response_hours >= 0) AND
    (supervisor_response_hours >= 0) AND
    (line_manager_response_hours >= 0)
  );

-- 4. Enable Row Level Security (RLS) safely
ALTER TABLE public.predefined_issues ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'predefined_issues' 
      AND policyname = 'Allow read for all authenticated users'
  ) THEN
    CREATE POLICY "Allow read for all authenticated users"
      ON public.predefined_issues
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'predefined_issues' 
      AND policyname = 'Allow admin write to predefined issues'
  ) THEN
    CREATE POLICY "Allow admin write to predefined issues"
      ON public.predefined_issues
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- 5. Safe cleanup: only attempt to clean responder_locations if the table exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'responder_locations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    DELETE FROM public.responder_locations 
    WHERE responder_id IN (
      SELECT id FROM public.profiles WHERE role != 'responder'
    );
  END IF;
END $$;

-- 6. Reload PostgREST schema cache so newly added columns are immediately recognized
NOTIFY pgrst, 'reload schema';
