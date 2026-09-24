-- ==============================================================================
-- TAJ CARE: SEPARATED RATINGS & FIELD SUPERVISOR PERMANENT CLOSURE WORKFLOW
-- Migration: 20260924000000_separate_ratings_and_supervisor_closure.sql
-- ==============================================================================

-- 1. ADD SEPARATED RATING COLUMNS TO tickets
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS site_manager_rating INT CHECK (site_manager_rating BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS site_manager_remarks TEXT,
    ADD COLUMN IF NOT EXISTS site_manager_rated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS supervisor_rating INT CHECK (supervisor_rating BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS supervisor_remarks TEXT,
    ADD COLUMN IF NOT EXISTS supervisor_rated_at TIMESTAMP WITH TIME ZONE;

-- 2. UPDATE tickets STATUS CHECK CONSTRAINT
-- Supports 'Awaiting Supervisor Approval' alongside existing statuses
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (
    status IN (
        'Pending',
        'In Progress',
        'Visit Date Scheduled',
        'Visited',
        'Issue Resolved',
        'Awaiting Admin Approval',
        'Awaiting Supervisor Approval',
        'Closed',
        'Reopened',
        'Permanently Closed',
        'Cancelled'
    )
);

-- 3. BACKFILL EXISTING TICKETS WITH SEPARATE RATINGS
UPDATE public.tickets
SET
    site_manager_rating = COALESCE(site_manager_rating, closure_rating),
    site_manager_remarks = COALESCE(site_manager_remarks, closure_remarks),
    site_manager_rated_at = COALESCE(site_manager_rated_at, closed_at, updated_at)
WHERE closure_rating IS NOT NULL AND site_manager_rating IS NULL;

-- 4. RPC: fn_submit_site_manager_rating
-- Site Manager rates ticket -> status transitions to 'Awaiting Supervisor Approval'
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
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Insert audit log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_prev_status, 'Awaiting Supervisor Approval',
        'Site Manager closed with ' || p_rating || ' stars. Awaiting Field Supervisor rating and permanent closure. Remarks: ' || COALESCE(p_remarks, 'None')
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
            'Complaint Awaiting Supervisor Rating',
            'Complaint #' || v_ticket.ticket_number || ' rated ' || p_rating || '★ by Site Manager — awaiting your Field Supervisor review and permanent closure.',
            'rating', p_ticket_id
        );
    END IF;

    -- Also notify all supervisors and admins
    INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
    SELECT id, p_actor_id,
           'Complaint Awaiting Supervisor Rating',
           'Complaint #' || v_ticket.ticket_number || ' rated ' || p_rating || '★ by Site Manager — awaiting your Field Supervisor review and permanent closure.',
           'rating', p_ticket_id
    FROM public.profiles
    WHERE role IN ('supervisor', 'admin')
      AND id != COALESCE(v_supervisor_id, '00000000-0000-0000-0000-000000000000'::UUID);

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5. RPC: fn_supervisor_rate_and_close_ticket
-- Field Supervisor rates ticket -> permanently closes it forever & awards flat points (multiplier eliminated)
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
BEGIN
    -- Verify actor role: skip line manager and hod completely
    SELECT * INTO v_actor FROM public.profiles WHERE id = p_actor_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Actor profile not found.');
    END IF;

    IF v_actor.role IN ('line_manager', 'hod') THEN
        RETURN json_build_object('error', 'Line Managers and HODs have overview-only access and cannot rate or close complaints.');
    END IF;

    IF v_actor.role NOT IN ('supervisor', 'admin') THEN
        RETURN json_build_object('error', 'Only Field Supervisors (or Admins) can rate and permanently close complaints.');
    END IF;

    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    IF v_ticket.status NOT IN ('Awaiting Supervisor Approval', 'Awaiting Admin Approval', 'Issue Resolved') THEN
        RETURN json_build_object('error', 'Ticket is not awaiting supervisor rating.');
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
    -- Final points = Base Points - SLA Penalty (if breached)
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

        -- Create Points Transaction Ledger Entry (multiplier recorded as 1.0)
        INSERT INTO public.points_transactions (
            ticket_id, responder_id, event_type, base_points, rating_multiplier, sla_penalty, final_points, actor_id, remarks
        ) VALUES (
            p_ticket_id, v_ticket.assigned_responder_id, 'ADMIN_CONFIRMED', v_base_points, 1.0, v_sla_penalty, v_final_points, p_actor_id,
            'Permanently closed by Field Supervisor (' || p_supervisor_rating || ' Stars). Site Manager Rating: ' || COALESCE(v_ticket.site_manager_rating, v_ticket.closure_rating, 0) || ' Stars. ' || COALESCE(p_remarks, '')
        );

        -- Notify Responder
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
        VALUES (
            v_ticket.assigned_responder_id, p_actor_id,
            'Complaint Permanently Closed & Points Credited',
            'Complaint #' || v_ticket.ticket_number || ' closed permanently by Field Supervisor (' || p_supervisor_rating || '★). +' || v_final_points || ' confirmed points credited.',
            'points', p_ticket_id
        );
    END IF;

    -- Notify Complainant / Site Manager
    IF v_ticket.complainant_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
        VALUES (
            v_ticket.complainant_id, p_actor_id,
            'Complaint Permanently Closed',
            'Complaint #' || v_ticket.ticket_number || ' has been reviewed and permanently closed by Field Supervisor (' || p_supervisor_rating || '★).',
            'ticket', p_ticket_id
        );
    END IF;

    -- Insert Audit Log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_prev_status, 'Permanently Closed',
        'Field Supervisor rated ' || p_supervisor_rating || ' stars and permanently closed the complaint. (Site Manager Rating: ' || COALESCE(v_ticket.site_manager_rating, v_ticket.closure_rating, 0) || '★). Confirmed ' || v_final_points || ' pts. Remarks: ' || COALESCE(p_remarks, 'None')
    );

    RETURN json_build_object('success', true, 'confirmed_points', v_final_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 6. KEEP fn_admin_approve_rating AS ALIAS / BACKWARD COMPATIBLE CALLER
CREATE OR REPLACE FUNCTION public.fn_admin_approve_rating(
    p_ticket_id UUID,
    p_actor_id UUID,
    p_final_rating INT,
    p_remarks TEXT
)
RETURNS JSON AS $$
BEGIN
    RETURN public.fn_supervisor_rate_and_close_ticket(p_ticket_id, p_actor_id, p_final_rating, p_remarks);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. SCHEMA CACHE RELOAD
NOTIFY pgrst, 'reload schema';
