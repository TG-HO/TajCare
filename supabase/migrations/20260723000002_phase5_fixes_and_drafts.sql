-- TAJ CARE: COMPREHENSIVE SCHEMA FIXES & DATABASE TICKET DRAFTS MIGRATION
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. ADD TARGET LOCATION TYPE TO PREDEFINED ISSUES
ALTER TABLE predefined_issues 
ADD COLUMN IF NOT EXISTS target_location_type TEXT CHECK (target_location_type IN ('fueling_site', 'head_office', 'both')) DEFAULT 'both';

-- Update existing issues with relevant target location types
UPDATE predefined_issues SET target_location_type = 'fueling_site' WHERE category IN ('Dispenser Hardware', 'Printer/POS');
UPDATE predefined_issues SET target_location_type = 'head_office' WHERE category IN ('Software/ERP', 'Network/Router');

-- Insert additional specific Head Office & Fueling Site issues
INSERT INTO predefined_issues (category, issue_title, complexity, base_points, target_location_type) VALUES
('Hardware/Desktop', 'Head Office PC / Monitor Power Failure', 'Medium', 20, 'head_office'),
('Software/ERP', 'Email / Outlook Account Authentication Error', 'Low', 10, 'head_office'),
('Dispenser Hardware', 'Fuel Pump Auto-Cut Sensor Malfunction', 'Critical', 50, 'fueling_site'),
('Printer/POS', 'Fueling Site Station Master Terminal Failure', 'High', 35, 'fueling_site')
ON CONFLICT DO NOTHING;

-- 2. TICKET DRAFTS TABLE (DATABASE DRAFT STORAGE SEPARATE PER USER)
CREATE TABLE IF NOT EXISTS ticket_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    issue_type_id UUID REFERENCES predefined_issues(id) ON DELETE SET NULL,
    custom_issue_title TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ticket_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_drafts_policy" ON ticket_drafts;
CREATE POLICY "user_drafts_policy" ON ticket_drafts FOR ALL TO authenticated 
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. FIX TICKETS TABLE RLS POLICIES FOR INSERT & UPDATE (CRITICAL FIX FOR SITE MANAGERS & EMPLOYEES)
DROP POLICY IF EXISTS "insert_tickets" ON tickets;
CREATE POLICY "insert_tickets" ON tickets FOR INSERT TO authenticated 
WITH CHECK (complainant_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "update_tickets" ON tickets;
CREATE POLICY "update_tickets" ON tickets FOR UPDATE TO authenticated 
USING (complainant_id = auth.uid() OR assigned_responder_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_tickets_all" ON tickets;
CREATE POLICY "admin_tickets_all" ON tickets FOR ALL TO authenticated 
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_read_own_tickets" ON tickets;
CREATE POLICY "user_read_own_tickets" ON tickets FOR SELECT TO authenticated USING (
    complainant_id = auth.uid() OR assigned_responder_id = auth.uid() OR public.is_admin(auth.uid())
);

-- 4. FIX PROFILES RLS FOR ALL OPERATIONS (FIXES ADMIN & PROFILE ACTIONS)
DROP POLICY IF EXISTS "admin_profiles_all" ON profiles;
CREATE POLICY "admin_profiles_all" ON profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "read_profiles" ON profiles;
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
