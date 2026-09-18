-- ==============================================================================
-- TAJ CARE: HIERARCHY ROLES, ESCALATION TRACKING & RESOLUTION SLA MIGRATION
-- File: 20260917000000_hierarchy_roles_and_sla.sql
-- Run this in your Supabase SQL Editor to apply database schema updates.
-- ==============================================================================

-- 1. UPDATE PROFILES ROLE CHECK CONSTRAINT
-- Adds 'supervisor', 'line_manager', 'hod' roles alongside existing roles.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('employee', 'site_manager', 'responder', 'supervisor', 'line_manager', 'hod', 'admin'));

-- 2. ADD HIERARCHICAL REPORTING COLUMNS TO PROFILES
-- Allows linking a responder to their Supervisor, Line Manager, and HOD
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hod_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor_id ON profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_line_manager_id ON profiles(line_manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hod_id ON profiles(hod_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3. ADD SLA RESOLUTION DURATION TO PREDEFINED ISSUES
-- Stores the resolution time duration in hours and minutes
ALTER TABLE predefined_issues
  ADD COLUMN IF NOT EXISTS resolution_time_hours INT NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS resolution_time_minutes INT NOT NULL DEFAULT 0;

-- Backfill existing predefined issues with standard operational durations
UPDATE predefined_issues SET 
  resolution_time_hours = CASE 
    WHEN complexity = 'Critical' THEN 2
    WHEN complexity = 'High' THEN 12
    WHEN complexity = 'Medium' THEN 24
    WHEN complexity = 'Low' THEN 4
    ELSE 24
  END,
  resolution_time_minutes = 0
WHERE resolution_time_hours IS NULL OR resolution_time_hours = 24;

-- 4. ADD ESCALATION LEVEL & AUDIT TRACKING TO TICKETS
-- Tracks which hierarchy stage has been notified (0: None, 1: Supervisor, 2: Line Manager, 3: HOD/Super Admin)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS escalation_level INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_tickets_escalation ON tickets(status, escalation_level, created_at);

-- 5. UPDATE RLS SAFE HELPER FUNCTION FOR ADMINISTRATIVE ACCESS
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role IN ('admin', 'hod', 'line_manager', 'supervisor')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update RLS on tickets to allow administrative roles (Supervisor, Line Manager, HOD, Super Admin)
DROP POLICY IF EXISTS "admin_tickets_all" ON tickets;
CREATE POLICY "admin_tickets_all" ON tickets 
  FOR ALL TO authenticated 
  USING (public.is_admin_or_manager(auth.uid()));

-- Update RLS on profiles so managers can view profiles
DROP POLICY IF EXISTS "read_profiles" ON profiles;
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO authenticated USING (
    id = auth.uid() 
    OR public.is_admin_or_manager(auth.uid()) 
    OR role IN ('responder', 'supervisor', 'line_manager', 'hod')
);

COMMENT ON COLUMN profiles.supervisor_id IS 'Direct supervisor for this responder/user';
COMMENT ON COLUMN profiles.line_manager_id IS 'Line manager overseeing the supervisor or responder';
COMMENT ON COLUMN profiles.hod_id IS 'Head of Department overseeing the reporting unit';
COMMENT ON COLUMN predefined_issues.resolution_time_hours IS 'Target resolution SLA time in hours';
COMMENT ON COLUMN predefined_issues.resolution_time_minutes IS 'Target resolution SLA time in minutes';
COMMENT ON COLUMN tickets.escalation_level IS 'Current hierarchy escalation level (0=Normal, 1=Supervisor, 2=Line Manager, 3=HOD & Admin)';
