-- ==============================================================================
-- TAJ CARE: CONFIGURABLE REOPENING WINDOW & EXCLUSIVE SUPERVISOR RATING
-- Migration: 20260924010000_reopen_window_and_supervisor_exclusive_rating.sql
-- ==============================================================================

-- 1. SYSTEM SETTINGS TABLE FOR EASY CONFIGURATION
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default reopening window is 24 hours (reduced from 72 hours)
INSERT INTO public.system_settings (key, value, description)
VALUES (
    'reopen_window_hours',
    '24',
    'Duration in hours of the reopening window after Site Manager rating before Field Supervisor can rate and close forever'
)
ON CONFLICT (key) DO UPDATE SET value = '24', updated_at = NOW();

-- 2. HELPER FUNCTION TO GET REOPEN WINDOW HOURS
CREATE OR REPLACE FUNCTION public.fn_get_reopen_window_hours()
RETURNS INT AS $$
DECLARE
    v_val TEXT;
BEGIN
    SELECT value INTO v_val FROM public.system_settings WHERE key = 'reopen_window_hours';
    IF v_val IS NOT NULL AND v_val ~ '^[0-9]+$' THEN
        RETURN v_val::INT;
    END IF;
    RETURN 24;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. UPDATE fn_submit_site_manager_rating
-- Ensure closed_at is stamped when Site Manager closes with rating so window starts cleanly
CREATE OR REPLACE FUNCTION public.fn_submit_site_manager_rating(
    p_ticket_id UUID,
    p_actor_id UUID,
    p_rating INT,
    p_remarks TEXT
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_prev_status TEXT;
    v_supervisor_id UUID;
BEGIN
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    IF v_ticket.status NOT IN ('Issue Resolved', 'Reopened', 'Pending') THEN
        RETURN json_build_object('error', 'Only resolved tickets can be closed and rated by the Site Manager.');
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RETURN json_build_object('error', 'Rating must be between 1 and 5 stars.');
    END IF;

    v_prev_status := v_ticket.status;

    -- Update ticket with Site Manager's rating & transition to 'Awaiting Supervisor Approval'
    UPDATE public.tickets SET
        status = 'Awaiting Supervisor Approval',
        site_manager_rating = p_rating,
        site_manager_remarks = p_remarks,
        site_manager_rated_at = NOW(),
        closure_rating = p_rating,
        closure_remarks = p_remarks,
        closed_at = COALESCE(closed_at, NOW()),
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Insert audit log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_prev_status, 'Awaiting Supervisor Approval',
        'Site Manager closed with ' || p_rating || ' stars. Reopening window active (' || public.fn_get_reopen_window_hours() || 'h). Awaiting Field Supervisor rating. Remarks: ' || COALESCE(p_remarks, 'None')
    );

    -- Find direct supervisor for the assigned responder
    IF v_ticket.assigned_responder_id IS NOT NULL THEN
        SELECT supervisor_id INTO v_supervisor_id 
        FROM public.profiles 
        WHERE id = v_ticket.assigned_responder_id;
    END IF;

    -- Notify the assigned supervisor specifically if mapped
    IF v_supervisor_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
        VALUES (
            v_supervisor_id, p_actor_id,
            'Complaint Rated by Site Manager',
            'Complaint #' || v_ticket.ticket_number || ' rated ' || p_rating || '★ by Site Manager. Field Supervisor rating unlocks after the ' || public.fn_get_reopen_window_hours() || 'h reopening window.',
            'rating', p_ticket_id
        );
    END IF;

    -- Also notify all supervisors
    INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
    SELECT id, p_actor_id,
           'Complaint Rated by Site Manager',
           'Complaint #' || v_ticket.ticket_number || ' rated ' || p_rating || '★ by Site Manager. Field Supervisor rating unlocks after the ' || public.fn_get_reopen_window_hours() || 'h reopening window.',
           'rating', p_ticket_id
    FROM public.profiles
    WHERE role = 'supervisor'
      AND id != COALESCE(v_supervisor_id, '00000000-0000-0000-0000-000000000000'::UUID);

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. UPDATE fn_supervisor_rate_and_close_ticket
-- STRICT ENFORCEMENT:
-- 1) ONLY role 'supervisor' can mark rating (NOT EVEN ADMIN)
-- 2) ONLY once the reopening window (default 24h) has passed
CREATE OR REPLACE FUNCTION public.fn_supervisor_rate_and_close_ticket(
    p_ticket_id UUID,
    p_actor_id UUID,
    p_supervisor_rating INT,
    p_remarks TEXT
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_actor RECORD;
    v_base_points INT;
    v_sla_penalty INT;
    v_final_points INT;
    v_prev_status TEXT;
    v_month INT;
    v_year INT;
    v_reopen_window_hours INT;
    v_rated_at TIMESTAMP WITH TIME ZONE;
    v_hours_elapsed NUMERIC;
BEGIN
    -- Verify actor role: ONLY supervisor (not even admin)
    SELECT * INTO v_actor FROM public.profiles WHERE id = p_actor_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Actor profile not found.');
    END IF;

    IF v_actor.role != 'supervisor' THEN
        RETURN json_build_object('error', 'Only Field Supervisors can rate and permanently close complaints (not even Admins, Line Managers, or HODs).');
    END IF;

    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    IF v_ticket.status NOT IN ('Awaiting Supervisor Approval', 'Awaiting Admin Approval', 'Issue Resolved') THEN
        RETURN json_build_object('error', 'Ticket is not awaiting supervisor rating.');
    END IF;

    -- Verify reopening window has expired
    v_reopen_window_hours := public.fn_get_reopen_window_hours();
    v_rated_at := COALESCE(v_ticket.site_manager_rated_at, v_ticket.closed_at, v_ticket.updated_at);

    IF v_rated_at IS NOT NULL THEN
        v_hours_elapsed := EXTRACT(EPOCH FROM (NOW() - v_rated_at)) / 3600;
        IF v_hours_elapsed < v_reopen_window_hours THEN
            RETURN json_build_object(
                'error',
                'Reopening window is still active (' || CEIL(v_reopen_window_hours - v_hours_elapsed)::TEXT || 'h remaining). Rating unlocks only after ' || v_reopen_window_hours || ' hours have passed without re-opening.'
            );
        END IF;
    END IF;

    IF p_supervisor_rating < 1 OR p_supervisor_rating > 5 THEN
        RETURN json_build_object('error', 'Supervisor rating must be between 1 and 5 stars.');
    END IF;

    v_prev_status := v_ticket.status;
    v_base_points := COALESCE(
        v_ticket.points_pending,
        (SELECT base_points FROM public.predefined_issues WHERE id = v_ticket.issue_type_id),
        v_ticket.points_awarded,
        20
    );

    -- Multiplier effect eliminated: Multiplier is strictly 1.0
    v_sla_penalty := CASE WHEN v_ticket.sla_breached THEN 15 ELSE 0 END;
    v_final_points := GREATEST(0, v_base_points - v_sla_penalty);

    v_month := EXTRACT(MONTH FROM NOW())::INT;
    v_year := EXTRACT(YEAR FROM NOW())::INT;

    -- Permanently Close Ticket Forever
    UPDATE public.tickets SET
        status = 'Permanently Closed',
        supervisor_rating = p_supervisor_rating,
        supervisor_remarks = COALESCE(p_remarks, supervisor_remarks),
        supervisor_rated_at = NOW(),
        closure_rating = p_supervisor_rating,
        closure_remarks = COALESCE(p_remarks, closure_remarks),
        confirmed_points = v_final_points,
        points_pending = 0,
        points_awarded = v_final_points,
        closed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Update monthly snapshot for assigned responder
    IF v_ticket.assigned_responder_id IS NOT NULL THEN
        INSERT INTO public.responder_monthly_points (
            responder_id, month, year, pending_points, confirmed_points, closed_complaints
        )
        VALUES (
            v_ticket.assigned_responder_id,
            v_month, v_year,
            0, v_final_points, 1
        )
        ON CONFLICT (responder_id, month, year) DO UPDATE SET
            pending_points = GREATEST(0, public.responder_monthly_points.pending_points - COALESCE(v_ticket.points_pending, 0)),
            confirmed_points = public.responder_monthly_points.confirmed_points + v_final_points,
            closed_complaints = public.responder_monthly_points.closed_complaints + 1,
            updated_at = NOW();

        -- Create Points Transaction Ledger Entry
        INSERT INTO public.points_transactions (
            ticket_id, responder_id, event_type, base_points, rating_multiplier, sla_penalty, final_points, actor_id, remarks
        ) VALUES (
            p_ticket_id, v_ticket.assigned_responder_id, 'ADMIN_CONFIRMED', v_base_points, 1.0, v_sla_penalty, v_final_points, p_actor_id,
            'Permanently closed by Field Supervisor (' || p_supervisor_rating || ' Stars) after ' || v_reopen_window_hours || 'h reopen window passed. Site Manager Rating: ' || COALESCE(v_ticket.site_manager_rating, v_ticket.closure_rating, 0) || ' Stars. ' || COALESCE(p_remarks, '')
        );

        -- Notify Responder
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
        VALUES (
            v_ticket.assigned_responder_id, p_actor_id,
            'Complaint Permanently Closed & Points Credited',
            'Complaint #' || v_ticket.ticket_number || ' permanently closed by Field Supervisor (' || p_supervisor_rating || '★). +' || v_final_points || ' confirmed points credited.',
            'points', p_ticket_id
        );
    END IF;

    -- Notify Complainant / Site Manager
    IF v_ticket.complainant_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
        VALUES (
            v_ticket.complainant_id, p_actor_id,
            'Complaint Permanently Closed',
            'Complaint #' || v_ticket.ticket_number || ' has been evaluated and permanently closed by Field Supervisor (' || p_supervisor_rating || '★).',
            'ticket', p_ticket_id
        );
    END IF;

    -- Insert Audit Log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_prev_status, 'Permanently Closed',
        'Field Supervisor rated ' || p_supervisor_rating || ' stars and permanently closed the complaint after ' || v_reopen_window_hours || 'h reopening window passed. (Site Manager Rating: ' || COALESCE(v_ticket.site_manager_rating, v_ticket.closure_rating, 0) || '★). Confirmed ' || v_final_points || ' pts. Remarks: ' || COALESCE(p_remarks, 'None')
    );

    RETURN json_build_object('success', true, 'confirmed_points', v_final_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. UPDATE fn_permanently_close_ticket TO USE CONFIGURABLE WINDOW
CREATE OR REPLACE FUNCTION public.fn_permanently_close_ticket(
    p_ticket_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_reopen_window_hours INT;
BEGIN
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    IF v_ticket.status NOT IN ('Closed', 'Awaiting Supervisor Approval') THEN
        RETURN json_build_object('error', 'Only Closed tickets can be permanently closed.');
    END IF;

    v_reopen_window_hours := public.fn_get_reopen_window_hours();

    IF v_ticket.closed_at IS NULL OR EXTRACT(EPOCH FROM (NOW() - v_ticket.closed_at)) / 3600 < v_reopen_window_hours THEN
        RETURN json_build_object('error', 'Re-open window has not expired yet.');
    END IF;

    UPDATE public.tickets SET
        status = 'Permanently Closed',
        updated_at = NOW()
    WHERE id = p_ticket_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. SCHEMA CACHE RELOAD
NOTIFY pgrst, 'reload schema';
