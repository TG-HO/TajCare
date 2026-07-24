-- TAJ CARE: PHASE 1 DATABASE MIGRATION SCRIPT
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('head_office', 'fueling_site')),
    city TEXT NOT NULL DEFAULT 'Karachi',
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PROFILES TABLE (Extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('employee', 'site_manager', 'responder', 'admin')),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    phone_number TEXT,
    is_on_leave BOOLEAN DEFAULT FALSE,
    backup_responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. RESPONDER LOCATION BINDINGS (Many-to-Many)
CREATE TABLE IF NOT EXISTS responder_locations (
    responder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (responder_id, location_id)
);

-- 5. PREDEFINED ISSUES TABLE
CREATE TABLE IF NOT EXISTS predefined_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    issue_title TEXT NOT NULL,
    complexity TEXT NOT NULL CHECK (complexity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    base_points INT NOT NULL DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TICKETS TABLE BASELINE
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number SERIAL UNIQUE,
    complainant_id UUID NOT NULL REFERENCES profiles(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    issue_type_id UUID REFERENCES predefined_issues(id),
    custom_issue_title TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Visit Date Scheduled', 'Visited', 'Issue Resolved', 'Closed')) DEFAULT 'Pending',
    assigned_responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scheduled_visit_date TIMESTAMP WITH TIME ZONE,
    visit_remarks TEXT,
    closure_rating INT CHECK (closure_rating BETWEEN 1 AND 5),
    closure_remarks TEXT,
    points_awarded INT DEFAULT 0,
    sla_due_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    sla_breached BOOLEAN DEFAULT FALSE,
    reopened_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SECURITY DEFINER FUNCTION FOR RLS SAFE ADMIN CHECK (Prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. ENABLE ROW LEVEL SECURITY
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE predefined_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- 9. RLS POLICIES

-- LOCATIONS POLICIES
DROP POLICY IF EXISTS "read_locations" ON locations;
CREATE POLICY "read_locations" ON locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_locations_all" ON locations;
CREATE POLICY "admin_locations_all" ON locations FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- PREDEFINED ISSUES POLICIES
DROP POLICY IF EXISTS "read_predefined_issues" ON predefined_issues;
CREATE POLICY "read_predefined_issues" ON predefined_issues FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_issues_all" ON predefined_issues;
CREATE POLICY "admin_issues_all" ON predefined_issues FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- PROFILES POLICIES
DROP POLICY IF EXISTS "read_profiles" ON profiles;
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO authenticated USING (
    id = auth.uid() OR public.is_admin(auth.uid()) OR role = 'responder'
);

DROP POLICY IF EXISTS "admin_profiles_all" ON profiles;
CREATE POLICY "admin_profiles_all" ON profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- RESPONDER LOCATIONS POLICIES
DROP POLICY IF EXISTS "read_responder_locations" ON responder_locations;
CREATE POLICY "read_responder_locations" ON responder_locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_responder_locations_all" ON responder_locations;
CREATE POLICY "admin_responder_locations_all" ON responder_locations FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- TICKETS POLICIES
DROP POLICY IF EXISTS "admin_tickets_all" ON tickets;
CREATE POLICY "admin_tickets_all" ON tickets FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_read_own_tickets" ON tickets;
CREATE POLICY "user_read_own_tickets" ON tickets FOR SELECT TO authenticated USING (
    complainant_id = auth.uid() OR assigned_responder_id = auth.uid() OR public.is_admin(auth.uid())
);

-- 10. SEED INITIAL DATA FOR PREDEFINED ISSUES AND LOCATIONS
INSERT INTO locations (name, type, city, address) VALUES
('Head Office - 3rd Floor', 'head_office', 'Karachi', 'Main Boulevard, Clifton, Karachi'),
('Clifton Site #101', 'fueling_site', 'Karachi', 'Block 5, Clifton, Karachi'),
('Gulshan Site #102', 'fueling_site', 'Karachi', 'Main University Road, Gulshan-e-Iqbal, Karachi'),
('DHA Site #103', 'fueling_site', 'Karachi', 'Khayaban-e-Ittehad, DHA Phase 6, Karachi')
ON CONFLICT DO NOTHING;

INSERT INTO predefined_issues (category, issue_title, complexity, base_points) VALUES
('Dispenser Hardware', 'Fuel Dispenser Nozzle Leakage / Jammed', 'High', 35),
('Dispenser Hardware', 'Flow Meter Calibration Error', 'Critical', 50),
('Network/Router', 'Site Main Router Offline / No Internet', 'Critical', 50),
('Network/Router', 'Wi-Fi Access Point Disconnected', 'Low', 10),
('Printer/POS', 'Receipt Printer Paper Jam / Cutter Error', 'Low', 10),
('Printer/POS', 'POS Terminal Touchscreen Unresponsive', 'Medium', 20),
('Software/ERP', 'Fuel Automation Software Sync Timeout', 'High', 35),
('Software/ERP', 'Inventory Shift Reconciliation Error', 'Medium', 20)
ON CONFLICT DO NOTHING;
