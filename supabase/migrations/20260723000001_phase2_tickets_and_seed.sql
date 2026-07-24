-- TAJ CARE: PHASE 2 DATABASE MIGRATION SCRIPT & DEMO SEED DATA
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. TICKET REMARKS / WORKFLOW LOGS TABLE
CREATE TABLE IF NOT EXISTS ticket_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES profiles(id),
    previous_status TEXT,
    new_status TEXT NOT NULL,
    remarks TEXT NOT NULL,
    visit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS FOR TICKET LOGS
ALTER TABLE ticket_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_ticket_logs" ON ticket_logs;
CREATE POLICY "read_ticket_logs" ON ticket_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ticket_logs" ON ticket_logs;
CREATE POLICY "insert_ticket_logs" ON ticket_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- 2. AUTO ASSIGNMENT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
    target_responder UUID;
    responder_on_leave BOOLEAN;
    backup_responder UUID;
BEGIN
    -- Query responder bound to the ticket location
    SELECT responder_id INTO target_responder
    FROM responder_locations
    WHERE location_id = NEW.location_id
    LIMIT 1;

    -- If no location binding found, fallback to any unassigned/primary responder
    IF target_responder IS NULL THEN
        SELECT id INTO target_responder
        FROM profiles
        WHERE role = 'responder'
        LIMIT 1;
    END IF;

    IF target_responder IS NOT NULL THEN
        SELECT is_on_leave, backup_responder_id INTO responder_on_leave, backup_responder
        FROM profiles WHERE id = target_responder;

        IF responder_on_leave = TRUE AND backup_responder IS NOT NULL THEN
            NEW.assigned_responder_id := backup_responder;
        ELSE
            NEW.assigned_responder_id := target_responder;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_assign_ticket ON tickets;
CREATE TRIGGER trigger_auto_assign_ticket
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION auto_assign_ticket();


-- 3. DEMO USERS SEED SCRIPT (PL/pgSQL Block)
DO $$
DECLARE
    loc_ho_id UUID;
    loc_site_id UUID;
    admin_uid UUID := gen_random_uuid();
    responder_uid UUID := gen_random_uuid();
    site_mgr_uid UUID := gen_random_uuid();
    employee_uid UUID := gen_random_uuid();
BEGIN
    -- Enable pgcrypto
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

    -- Fetch default locations
    SELECT id INTO loc_ho_id FROM public.locations WHERE type = 'head_office' LIMIT 1;
    SELECT id INTO loc_site_id FROM public.locations WHERE type = 'fueling_site' LIMIT 1;

    -- A. ADMIN USER (admin@tajgasoline.com / TajAdmin123!)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@tajgasoline.com') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            admin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'admin@tajgasoline.com', crypt('TajAdmin123!', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"System Admin","role":"admin"}', NOW(), NOW()
        );

        INSERT INTO public.profiles (id, full_name, email, role, location_id, phone_number)
        VALUES (admin_uid, 'Zayn Malik (System Admin)', 'admin@tajgasoline.com', 'admin', loc_ho_id, '+92 300 1111111');
    END IF;

    -- B. RESPONDER USER (responder@tajgasoline.com / TajResp123!)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'responder@tajgasoline.com') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            responder_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'responder@tajgasoline.com', crypt('TajResp123!', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Bilal Khan - IT Responder","role":"responder"}', NOW(), NOW()
        );

        INSERT INTO public.profiles (id, full_name, email, role, location_id, phone_number, is_on_leave)
        VALUES (responder_uid, 'Bilal Khan (IT Responder)', 'responder@tajgasoline.com', 'responder', loc_ho_id, '+92 300 2222222', false);

        IF loc_site_id IS NOT NULL THEN
            INSERT INTO public.responder_locations (responder_id, location_id)
            VALUES (responder_uid, loc_site_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- C. SITE MANAGER USER (sitemanager@tajgasoline.com / TajSite123!)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sitemanager@tajgasoline.com') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            site_mgr_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'sitemanager@tajgasoline.com', crypt('TajSite123!', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Kamran Akmal - Site Manager","role":"site_manager"}', NOW(), NOW()
        );

        INSERT INTO public.profiles (id, full_name, email, role, location_id, phone_number)
        VALUES (site_mgr_uid, 'Kamran Akmal (Site Manager)', 'sitemanager@tajgasoline.com', 'site_manager', loc_site_id, '+92 300 3333333');
    END IF;

    -- D. EMPLOYEE USER (employee@tajgasoline.com / TajEmp123!)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'employee@tajgasoline.com') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            employee_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'employee@tajgasoline.com', crypt('TajEmp123!', gen_salt('bf')), NOW(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Sara Ahmed - Staff","role":"employee"}', NOW(), NOW()
        );

        INSERT INTO public.profiles (id, full_name, email, role, location_id, phone_number)
        VALUES (employee_uid, 'Sara Ahmed (HO Staff)', 'employee@tajgasoline.com', 'employee', loc_ho_id, '+92 300 4444444');
    END IF;

END $$;

-- 4. LINK AUTH IDENTITIES FOR ALL USERS (POPUlATES 'email' PROVIDER COLUMN IN SUPABASE AUTH)
INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    u.id::text,
    u.id,
    json_build_object('sub', u.id::text, 'email', u.email),
    'email',
    NOW(),
    NOW(),
    NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM auth.identities)
ON CONFLICT DO NOTHING;
