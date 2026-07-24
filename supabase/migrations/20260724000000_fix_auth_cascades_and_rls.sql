-- TAJ CARE: MASTER SCHEMA FIXES, TICKET DRAFTS, CASCADES & AUTO-ASSIGN MIGRATION

-- 1. FIX FOREIGN KEY CONSTRAINTS WITH ON DELETE CASCADE
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_complainant_id_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_complainant_id_fkey 
    FOREIGN KEY (complainant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_logs DROP CONSTRAINT IF EXISTS ticket_logs_actor_id_fkey;
ALTER TABLE public.ticket_logs ADD CONSTRAINT ticket_logs_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. TICKET DRAFTS TABLE FOR SAVING COMPLAINT DRAFTS
CREATE TABLE IF NOT EXISTS public.ticket_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    issue_type_id UUID REFERENCES public.predefined_issues(id) ON DELETE SET NULL,
    custom_issue_title TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ticket_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_drafts_policy" ON public.ticket_drafts;
CREATE POLICY "user_drafts_policy" ON public.ticket_drafts FOR ALL TO authenticated 
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. AUTOMATIC PROFILE SYNC TRIGGER FOR NEW USERS (SUPABASE DASHBOARD / API)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_loc_id UUID;
    user_role TEXT;
    user_full_name TEXT;
BEGIN
    SELECT id INTO default_loc_id FROM public.locations LIMIT 1;
    
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, full_name, email, role, location_id)
    VALUES (
        NEW.id,
        user_full_name,
        NEW.email,
        user_role,
        default_loc_id
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        role = COALESCE(public.profiles.role, EXCLUDED.role);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. AUTO ASSIGNMENT TRIGGER FUNCTION FOR COMPLAINTS
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
    target_responder UUID;
    responder_on_leave BOOLEAN;
    backup_responder UUID;
BEGIN
    IF NEW.assigned_responder_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Query responder bound to the ticket location
    SELECT responder_id INTO target_responder
    FROM public.responder_locations
    WHERE location_id = NEW.location_id
    LIMIT 1;

    -- If no location binding found, fallback to primary responder
    IF target_responder IS NULL THEN
        SELECT id INTO target_responder
        FROM public.profiles
        WHERE role = 'responder'
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF target_responder IS NOT NULL THEN
        SELECT is_on_leave, backup_responder_id INTO responder_on_leave, backup_responder
        FROM public.profiles WHERE id = target_responder;

        IF responder_on_leave = TRUE AND backup_responder IS NOT NULL THEN
            NEW.assigned_responder_id := backup_responder;
        ELSE
            NEW.assigned_responder_id := target_responder;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_assign_ticket ON public.tickets;
CREATE TRIGGER trigger_auto_assign_ticket
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_ticket();

-- 5. RLS POLICIES FOR PROFILES, TICKETS, AND TICKET LOGS
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT TO authenticated 
WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE TO authenticated 
USING (id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "insert_tickets" ON public.tickets;
CREATE POLICY "insert_tickets" ON public.tickets FOR INSERT TO authenticated 
WITH CHECK (complainant_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "insert_ticket_logs" ON public.ticket_logs;
CREATE POLICY "insert_ticket_logs" ON public.ticket_logs FOR INSERT TO authenticated 
WITH CHECK (actor_id = auth.uid() OR public.is_admin(auth.uid()));

-- 6. CLEAN UP STALE SQL AUTH USERS
DELETE FROM auth.users WHERE instance_id = '00000000-0000-0000-0000-000000000000';
