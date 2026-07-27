-- TAJ CARE: COMPLAINT LIFECYCLE & POINTS MANAGEMENT OVERHAUL
-- Migration: 20260727000000_resolution_workflow_and_points.sql
-- Run this in your Supabase SQL Editor AFTER all prior migrations.

-- ============================================================
-- 1. EXTEND tickets TABLE
-- ============================================================

-- Add points_pending: set when responder marks Issue Resolved (awaiting SM confirmation)
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS points_pending INT DEFAULT 0;

-- Add confirmed_points: set ONLY when Site Manager closes and rates the ticket
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS confirmed_points INT DEFAULT 0;

-- Add closed_at: timestamp of closure, used for 3-day grace window & monthly filtering
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- 2. EXTEND tickets STATUS ENUM (Drop old constraint, add new)
-- ============================================================

ALTER TABLE public.tickets
    DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_status_check CHECK (
        status IN (
            'Pending',
            'In Progress',
            'Visit Date Scheduled',
            'Visited',
            'Issue Resolved',
            'Closed',
            'Reopened',
            'Permanently Closed'
        )
    );

-- ============================================================
-- 3. RESPONDER MONTHLY POINTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.responder_monthly_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year >= 2020),
    pending_points INT NOT NULL DEFAULT 0,
    confirmed_points INT NOT NULL DEFAULT 0,
    closed_complaints INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(responder_id, month, year)
);

ALTER TABLE public.responder_monthly_points ENABLE ROW LEVEL SECURITY;

-- Responders can read their own monthly records; admins can read all
DROP POLICY IF EXISTS "read_monthly_points" ON public.responder_monthly_points;
CREATE POLICY "read_monthly_points" ON public.responder_monthly_points
    FOR SELECT TO authenticated
    USING (
        responder_id = auth.uid() OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "admin_monthly_points_all" ON public.responder_monthly_points;
CREATE POLICY "admin_monthly_points_all" ON public.responder_monthly_points
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- Service role (used by admin client / RPC functions) can do all
DROP POLICY IF EXISTS "service_monthly_points_all" ON public.responder_monthly_points;
CREATE POLICY "service_monthly_points_all" ON public.responder_monthly_points
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 4. RPC: fn_mark_issue_resolved
--    Called when responder marks a ticket as Issue Resolved.
--    Sets points_pending; does NOT set confirmed_points.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_mark_issue_resolved(
    p_ticket_id UUID,
    p_actor_id UUID,
    p_remarks TEXT,
    p_visit_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_base_points INT;
    v_prev_status TEXT;
BEGIN
    -- Fetch ticket
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    -- Validate allowed transitions
    IF v_ticket.status NOT IN ('Pending', 'In Progress', 'Visit Date Scheduled', 'Visited', 'Reopened') THEN
        RETURN json_build_object('error', 'Ticket cannot be marked as resolved from status: ' || v_ticket.status);
    END IF;

    v_prev_status := v_ticket.status;

    -- Resolve base points from predefined issue or default
    v_base_points := COALESCE(
        (SELECT base_points FROM public.predefined_issues WHERE id = v_ticket.issue_type_id),
        v_ticket.points_awarded,
        20
    );

    -- Update ticket: status -> Issue Resolved, set pending points, clear confirmed
    UPDATE public.tickets SET
        status = 'Issue Resolved',
        points_pending = v_base_points,
        confirmed_points = 0,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Upsert monthly pending points (increment pending, clear confirmed for this ticket's entry)
    -- We use current date for the pending month tracking
    INSERT INTO public.responder_monthly_points (responder_id, month, year, pending_points)
    VALUES (
        v_ticket.assigned_responder_id,
        EXTRACT(MONTH FROM NOW())::INT,
        EXTRACT(YEAR FROM NOW())::INT,
        v_base_points
    )
    ON CONFLICT (responder_id, month, year) DO UPDATE SET
        pending_points = public.responder_monthly_points.pending_points + v_base_points,
        updated_at = NOW();

    -- Insert ticket log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks, visit_date)
    VALUES (p_ticket_id, p_actor_id, v_prev_status, 'Issue Resolved', p_remarks, p_visit_date);

    RETURN json_build_object('success', true, 'pending_points', v_base_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 5. RPC: fn_close_ticket_and_confirm_points
--    Called when Site Manager rates and closes a ticket.
--    Atomically: closes ticket, calculates final points,
--    confirms points into responder monthly record.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_close_ticket_and_confirm_points(
    p_ticket_id UUID,
    p_actor_id UUID,
    p_rating INT,
    p_remarks TEXT
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_base_points INT;
    v_multiplier NUMERIC;
    v_sla_penalty INT;
    v_final_points INT;
    v_prev_status TEXT;
    v_month INT;
    v_year INT;
BEGIN
    -- Lock the ticket row
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    -- Only allow closing Issue Resolved or Reopened (after re-resolution)
    IF v_ticket.status NOT IN ('Issue Resolved', 'Reopened') THEN
        RETURN json_build_object('error', 'Only tickets in "Issue Resolved" status can be closed and rated.');
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RETURN json_build_object('error', 'Rating must be between 1 and 5.');
    END IF;

    v_prev_status := v_ticket.status;
    v_base_points := COALESCE(v_ticket.points_pending, 20);

    -- Rating multiplier
    v_multiplier := CASE p_rating
        WHEN 5 THEN 1.5
        WHEN 4 THEN 1.25
        WHEN 3 THEN 1.0
        WHEN 2 THEN 0.8
        WHEN 1 THEN 0.5
        ELSE 1.0
    END;

    v_sla_penalty := CASE WHEN v_ticket.sla_breached THEN 15 ELSE 0 END;
    v_final_points := GREATEST(0, ROUND(v_base_points * v_multiplier - v_sla_penalty)::INT);

    v_month := EXTRACT(MONTH FROM NOW())::INT;
    v_year := EXTRACT(YEAR FROM NOW())::INT;

    -- Update ticket
    UPDATE public.tickets SET
        status = 'Closed',
        closure_rating = p_rating,
        closure_remarks = p_remarks,
        confirmed_points = v_final_points,
        points_pending = 0,
        points_awarded = v_final_points,   -- keep legacy column in sync
        closed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Upsert monthly points: move from pending → confirmed
    INSERT INTO public.responder_monthly_points (responder_id, month, year, pending_points, confirmed_points, closed_complaints)
    VALUES (
        v_ticket.assigned_responder_id,
        v_month, v_year,
        0, v_final_points, 1
    )
    ON CONFLICT (responder_id, month, year) DO UPDATE SET
        -- Subtract the pending points that were added on resolve
        pending_points = GREATEST(0, public.responder_monthly_points.pending_points - COALESCE(v_ticket.points_pending, 0)),
        confirmed_points = public.responder_monthly_points.confirmed_points + v_final_points,
        closed_complaints = public.responder_monthly_points.closed_complaints + 1,
        updated_at = NOW();

    -- Insert ticket log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_prev_status, 'Closed',
        'Ticket closed with ' || p_rating || '-star rating. Confirmed Points: ' || v_final_points || ' pts. Remarks: ' || COALESCE(p_remarks, 'No remarks')
    );

    RETURN json_build_object('success', true, 'confirmed_points', v_final_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 6. RPC: fn_reopen_ticket
--    Called by Site Manager to reopen.
--    Works on: Issue Resolved (pre-close) and Closed (post-close, within 72h).
--    On reopen: reverts confirmed_points to 0, keeps points_pending.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_reopen_ticket(
    p_ticket_id UUID,
    p_actor_id UUID,
    p_remarks TEXT
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_hours_since_close NUMERIC;
    v_month INT;
    v_year INT;
BEGIN
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    -- Validate: must be in Issue Resolved or Closed
    IF v_ticket.status NOT IN ('Issue Resolved', 'Closed') THEN
        RETURN json_build_object('error', 'Only "Issue Resolved" or "Closed" tickets can be re-opened.');
    END IF;

    -- If Closed, enforce 72h window from closed_at
    IF v_ticket.status = 'Closed' THEN
        IF v_ticket.closed_at IS NULL THEN
            RETURN json_build_object('error', 'Closure timestamp not found. Cannot verify re-open window.');
        END IF;

        v_hours_since_close := EXTRACT(EPOCH FROM (NOW() - v_ticket.closed_at)) / 3600;
        IF v_hours_since_close > 72 THEN
            RETURN json_build_object('error', 'Re-open window expired. 72 hours have elapsed since ticket closure.');
        END IF;

        -- Revert confirmed points in monthly record for the closure month
        v_month := EXTRACT(MONTH FROM v_ticket.closed_at)::INT;
        v_year := EXTRACT(YEAR FROM v_ticket.closed_at)::INT;

        UPDATE public.responder_monthly_points SET
            confirmed_points = GREATEST(0, confirmed_points - COALESCE(v_ticket.confirmed_points, 0)),
            -- Restore pending points
            pending_points = pending_points + COALESCE(v_ticket.points_pending, 0),
            closed_complaints = GREATEST(0, closed_complaints - 1),
            updated_at = NOW()
        WHERE responder_id = v_ticket.assigned_responder_id
          AND month = v_month AND year = v_year;
    END IF;

    -- Update ticket: revert to Reopened, clear confirmed_points, restore pending
    UPDATE public.tickets SET
        status = 'Reopened',
        confirmed_points = 0,
        closed_at = NULL,
        closure_rating = NULL,
        closure_remarks = NULL,
        reopened_count = COALESCE(reopened_count, 0) + 1,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Insert log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_ticket.status, 'Reopened',
        'Re-opened by Site Manager (count: ' || (COALESCE(v_ticket.reopened_count, 0) + 1) || '). Reason: ' || p_remarks
    );

    RETURN json_build_object('success', true, 'reopened_count', COALESCE(v_ticket.reopened_count, 0) + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 7. RPC: fn_permanently_close_ticket
--    Called server-side when 72h window has expired for Closed tickets.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_permanently_close_ticket(
    p_ticket_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
BEGIN
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    IF v_ticket.status != 'Closed' THEN
        RETURN json_build_object('error', 'Only Closed tickets can be permanently closed.');
    END IF;

    IF v_ticket.closed_at IS NULL OR EXTRACT(EPOCH FROM (NOW() - v_ticket.closed_at)) / 3600 < 72 THEN
        RETURN json_build_object('error', 'Re-open window has not expired yet.');
    END IF;

    UPDATE public.tickets SET
        status = 'Permanently Closed',
        updated_at = NOW()
    WHERE id = p_ticket_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 8. UPDATE RLS: Allow site managers to reopen their own tickets
-- ============================================================

DROP POLICY IF EXISTS "site_manager_reopen_tickets" ON public.tickets;
CREATE POLICY "site_manager_reopen_tickets" ON public.tickets
    FOR UPDATE TO authenticated
    USING (
        complainant_id = auth.uid()
        OR assigned_responder_id = auth.uid()
        OR public.is_admin(auth.uid())
    );

-- ============================================================
-- 9. BACKFILL: Set closed_at for existing Closed tickets (use updated_at as proxy)
-- ============================================================

UPDATE public.tickets
SET closed_at = updated_at
WHERE status = 'Closed' AND closed_at IS NULL;

-- ============================================================
-- Done!
-- ============================================================
