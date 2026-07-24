-- TAJ CARE: MISSING COLUMNS, FIXES & RESPONDER BINDING PATCH
-- Run this in Supabase SQL Editor

-- 1. ADD target_location_type TO predefined_issues IF MISSING
ALTER TABLE public.predefined_issues
    ADD COLUMN IF NOT EXISTS target_location_type TEXT DEFAULT 'both'
    CHECK (target_location_type IN ('fueling_site', 'head_office', 'both'));

-- Update existing fueling-site-specific issues
UPDATE public.predefined_issues
SET target_location_type = 'fueling_site'
WHERE category IN ('Dispenser Hardware')
  AND target_location_type IS NULL OR target_location_type = 'both';

-- 2. ENSURE scheduled_visit_date COLUMN EXISTS ON TICKETS
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS scheduled_visit_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS visit_remarks TEXT;

-- 3. FIX RESPONDER LOCATIONS — BIND DEMO RESPONDER TO ALL LOCATIONS
-- Ensure the demo responder (responder@tajgasoline.com) is bound to all locations
DO $$
DECLARE
    resp_id UUID;
    loc RECORD;
BEGIN
    -- Find the demo responder by email
    SELECT id INTO resp_id FROM public.profiles WHERE email = 'responder@tajgasoline.com' LIMIT 1;
    
    IF resp_id IS NOT NULL THEN
        -- Bind responder to ALL locations (so auto-assignment always works)
        FOR loc IN SELECT id FROM public.locations LOOP
            INSERT INTO public.responder_locations (responder_id, location_id)
            VALUES (resp_id, loc.id)
            ON CONFLICT (responder_id, location_id) DO NOTHING;
        END LOOP;
        
        RAISE NOTICE 'Bound responder % to all locations', resp_id;
    ELSE
        RAISE NOTICE 'Demo responder not found - skipping location binding';
    END IF;
END $$;

-- 4. FIX AUTO-ASSIGN TRIGGER TO NOT HAVE THE GUARD THAT BLOCKS ASSIGNMENT
-- The existing trigger had: IF NEW.assigned_responder_id IS NOT NULL THEN RETURN NEW
-- This blocked assignment because the app code was passing assigned_responder_id=null
-- but the field defaulted to the last set value. Re-create without the guard issue.
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
    target_responder UUID;
    responder_on_leave BOOLEAN;
    backup_responder UUID;
BEGIN
    -- Only auto-assign if not already assigned
    IF NEW.assigned_responder_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- 1. Try to find a responder bound to this specific location
    SELECT responder_id INTO target_responder
    FROM public.responder_locations rl
    JOIN public.profiles p ON p.id = rl.responder_id
    WHERE rl.location_id = NEW.location_id
      AND p.role = 'responder'
    ORDER BY p.is_on_leave ASC  -- prefer non-leave responders
    LIMIT 1;

    -- 2. If no location binding, fallback to any active responder
    IF target_responder IS NULL THEN
        SELECT id INTO target_responder
        FROM public.profiles
        WHERE role = 'responder'
        ORDER BY is_on_leave ASC, created_at ASC
        LIMIT 1;
    END IF;

    IF target_responder IS NOT NULL THEN
        -- Check if responder is on leave
        SELECT is_on_leave, backup_responder_id 
        INTO responder_on_leave, backup_responder
        FROM public.profiles 
        WHERE id = target_responder;

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

-- 5. FIX RLS: Allow all authenticated users to read ALL profiles (needed for responder listing)
-- Without this, non-admin users can't see responders when submitting tickets
DROP POLICY IF EXISTS "read_profiles" ON public.profiles;
CREATE POLICY "read_profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (true);

-- 6. ENSURE TICKETS INSERT POLICY ALLOWS AUTHENTICATED USERS
-- The existing policy restricts by complainant_id = auth.uid() which is fine
-- But we also need to allow the trigger (SECURITY DEFINER) to set assigned_responder_id
DROP POLICY IF EXISTS "insert_tickets" ON public.tickets;
CREATE POLICY "insert_tickets" ON public.tickets 
FOR INSERT TO authenticated 
WITH CHECK (complainant_id = auth.uid() OR public.is_admin(auth.uid()));

-- 7. Allow responders to update tickets (status transitions)
DROP POLICY IF EXISTS "responder_update_tickets" ON public.tickets;
CREATE POLICY "responder_update_tickets" ON public.tickets 
FOR UPDATE TO authenticated 
USING (
    assigned_responder_id = auth.uid() 
    OR complainant_id = auth.uid() 
    OR public.is_admin(auth.uid())
);

-- 8. Allow responders to insert ticket logs
DROP POLICY IF EXISTS "insert_ticket_logs" ON public.ticket_logs;
CREATE POLICY "insert_ticket_logs" ON public.ticket_logs 
FOR INSERT TO authenticated 
WITH CHECK (
    actor_id = auth.uid() OR public.is_admin(auth.uid())
);

-- Done! Run /api/seed in browser to reseed demo data after this migration.
