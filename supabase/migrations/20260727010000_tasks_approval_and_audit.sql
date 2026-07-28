-- TAJ CARE: TASKS MODULE, RATING APPROVAL WORKFLOW & POINTS AUDIT MIGRATION
-- File: supabase/migrations/20260727010000_tasks_approval_and_audit.sql

-- ============================================================
-- 1. EXTEND TICKETS STATUS ENUM
-- ============================================================
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (
    status IN (
        'Pending',
        'In Progress',
        'Visit Date Scheduled',
        'Visited',
        'Issue Resolved',
        'Awaiting Admin Approval',
        'Closed',
        'Reopened',
        'Permanently Closed'
    )
);

-- ============================================================
-- 2. TASKS MODULE TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number SERIAL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    status TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Approved', 'Cancelled')) DEFAULT 'Pending',
    due_date TIMESTAMP WITH TIME ZONE,
    expected_completion_date TIMESTAMP WITH TIME ZONE,
    base_points INT NOT NULL DEFAULT 0,
    points_pending INT NOT NULL DEFAULT 0,
    confirmed_points INT NOT NULL DEFAULT 0,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_assignees (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (task_id, responder_id)
);

CREATE TABLE IF NOT EXISTS public.task_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    remarks TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. POINTS AUDIT TRANSACTIONS LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('RESOLVED_PENDING', 'ADMIN_CONFIRMED', 'REOPENED_REVERTED', 'ADMIN_MODIFIED', 'TASK_CONFIRMED')
    ),
    base_points INT NOT NULL DEFAULT 0,
    rating_multiplier NUMERIC DEFAULT 1.0,
    sla_penalty INT DEFAULT 0,
    final_points INT NOT NULL DEFAULT 0,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. PERSISTENT NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info', -- 'ticket', 'task', 'rating', 'points'
    reference_id UUID,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES FOR NEW TABLES
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Tasks Policies
DROP POLICY IF EXISTS "read_tasks" ON public.tasks;
CREATE POLICY "read_tasks" ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_tasks_all" ON public.tasks;
CREATE POLICY "admin_tasks_all" ON public.tasks FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Task Assignees Policies
DROP POLICY IF EXISTS "read_task_assignees" ON public.task_assignees;
CREATE POLICY "read_task_assignees" ON public.task_assignees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_task_assignees_all" ON public.task_assignees;
CREATE POLICY "admin_task_assignees_all" ON public.task_assignees FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Task Logs Policies
DROP POLICY IF EXISTS "read_task_logs" ON public.task_logs;
CREATE POLICY "read_task_logs" ON public.task_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_task_logs" ON public.task_logs;
CREATE POLICY "insert_task_logs" ON public.task_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR public.is_admin(auth.uid()));

-- Points Transactions Policies
DROP POLICY IF EXISTS "read_points_transactions" ON public.points_transactions;
CREATE POLICY "read_points_transactions" ON public.points_transactions FOR SELECT TO authenticated USING (
    responder_id = auth.uid() OR public.is_admin(auth.uid())
);

-- Notifications Policies
DROP POLICY IF EXISTS "read_own_notifications" ON public.notifications;
CREATE POLICY "read_own_notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
CREATE POLICY "insert_notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- 5. RPC: fn_submit_site_manager_rating
--    Site Manager rates ticket -> status changes to 'Awaiting Admin Approval'
--    Points remain PENDING.
-- ============================================================
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
BEGIN
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    IF v_ticket.status NOT IN ('Issue Resolved', 'Reopened') THEN
        RETURN json_build_object('error', 'Only tickets in "Issue Resolved" status can be rated.');
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RETURN json_build_object('error', 'Rating must be between 1 and 5 stars.');
    END IF;

    v_prev_status := v_ticket.status;

    -- Update ticket status to 'Awaiting Admin Approval'
    UPDATE public.tickets SET
        status = 'Awaiting Admin Approval',
        closure_rating = p_rating,
        closure_remarks = p_remarks,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Insert log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_prev_status, 'Awaiting Admin Approval',
        'Site Manager rated ' || p_rating || ' stars. Awaiting Admin Approval. Remarks: ' || COALESCE(p_remarks, 'None')
    );

    -- Notify admins
    INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
    SELECT id, p_actor_id, 'Rating Awaiting Approval', 'Ticket #' || v_ticket.ticket_number || ' rated ' || p_rating || ' stars by Site Manager — awaiting your review.', 'rating', p_ticket_id
    FROM public.profiles WHERE role = 'admin';

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- 6. RPC: fn_admin_approve_rating
--    Admin approves or modifies rating -> status changes to 'Closed'
--    Calculates points, updates monthly record, writes transaction audit log.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_admin_approve_rating(
    p_ticket_id UUID,
    p_actor_id UUID,
    p_final_rating INT,
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
    SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Ticket not found.');
    END IF;

    IF v_ticket.status != 'Awaiting Admin Approval' AND v_ticket.status != 'Issue Resolved' THEN
        RETURN json_build_object('error', 'Ticket is not awaiting admin approval.');
    END IF;

    IF p_final_rating < 1 OR p_final_rating > 5 THEN
        RETURN json_build_object('error', 'Rating must be between 1 and 5 stars.');
    END IF;

    v_prev_status := v_ticket.status;
    v_base_points := COALESCE(v_ticket.points_pending, 20);

    -- Rating Multiplier Formula
    v_multiplier := CASE p_final_rating
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

    -- Update ticket to Closed
    UPDATE public.tickets SET
        status = 'Closed',
        closure_rating = p_final_rating,
        closure_remarks = COALESCE(p_remarks, closure_remarks),
        confirmed_points = v_final_points,
        points_pending = 0,
        points_awarded = v_final_points,
        closed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Update monthly snapshot
    INSERT INTO public.responder_monthly_points (responder_id, month, year, pending_points, confirmed_points, closed_complaints)
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
        p_ticket_id, v_ticket.assigned_responder_id, 'ADMIN_CONFIRMED', v_base_points, v_multiplier, v_sla_penalty, v_final_points, p_actor_id,
        'Rating approved by Admin (' || p_final_rating || ' Stars). ' || COALESCE(p_remarks, '')
    );

    -- Insert log
    INSERT INTO public.ticket_logs (ticket_id, actor_id, previous_status, new_status, remarks)
    VALUES (
        p_ticket_id, p_actor_id, v_prev_status, 'Closed',
        'Admin approved rating (' || p_final_rating || ' Stars). Confirmed ' || v_final_points || ' pts. Remarks: ' || COALESCE(p_remarks, 'Approved')
    );

    -- Notify Responder
    IF v_ticket.assigned_responder_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, reference_id)
        VALUES (
            v_ticket.assigned_responder_id, p_actor_id, 'Rating Approved & Points Confirmed',
            'Ticket #' || v_ticket.ticket_number || ' rating approved (' || p_final_rating || '★). +' || v_final_points || ' confirmed points credited.',
            'points', p_ticket_id
        );
    END IF;

    RETURN json_build_object('success', true, 'confirmed_points', v_final_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Done!
