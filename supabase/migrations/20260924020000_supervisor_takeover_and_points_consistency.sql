-- ==============================================================================
-- TAJ CARE: SUPERVISOR TAKEOVER RESPONDER ASSIGNMENT & POINTS CONSISTENCY
-- Migration: 20260924020000_supervisor_takeover_and_points_consistency.sql
-- ==============================================================================

-- 1. Ensure any supervisor-handled tickets are assigned to the handling supervisor as responder
UPDATE public.tickets
SET 
    reassigned_from_id = assigned_responder_id,
    reassigned_at = COALESCE(reassigned_at, updated_at, NOW()),
    assigned_responder_id = supervisor_handling_id
WHERE supervisor_handled = true 
  AND supervisor_handling_id IS NOT NULL
  AND assigned_responder_id != supervisor_handling_id;

-- 2. Clear points_pending for any unresolved/open tickets (points are only pending once resolved)
UPDATE public.tickets
SET points_pending = 0
WHERE status IN ('Pending', 'In Progress', 'Visit Date Scheduled', 'Visited');

-- 3. Ensure resolved tickets awaiting confirmation have proper points_pending
UPDATE public.tickets
SET points_pending = COALESCE(
    points_awarded,
    (SELECT base_points FROM public.predefined_issues WHERE id = tickets.issue_type_id),
    20
)
WHERE status IN ('Issue Resolved', 'Awaiting Supervisor Approval', 'Awaiting Admin Approval')
  AND (points_pending IS NULL OR points_pending = 0);

-- 4. Clean and synchronize responder_monthly_points with actual ticket data
-- Recalculate confirmed points and closed complaints from permanently closed/closed tickets
WITH ticket_confirmed_summary AS (
    SELECT 
        assigned_responder_id AS responder_id,
        EXTRACT(MONTH FROM COALESCE(closed_at, updated_at))::INT AS month,
        EXTRACT(YEAR FROM COALESCE(closed_at, updated_at))::INT AS year,
        COALESCE(SUM(confirmed_points), 0)::INT AS total_confirmed,
        COUNT(*)::INT AS total_closed
    FROM public.tickets
    WHERE status IN ('Closed', 'Permanently Closed')
      AND assigned_responder_id IS NOT NULL
    GROUP BY assigned_responder_id, EXTRACT(MONTH FROM COALESCE(closed_at, updated_at)), EXTRACT(YEAR FROM COALESCE(closed_at, updated_at))
)
INSERT INTO public.responder_monthly_points (responder_id, month, year, confirmed_points, closed_complaints, pending_points)
SELECT 
    responder_id,
    month,
    year,
    total_confirmed,
    total_closed,
    0
FROM ticket_confirmed_summary
ON CONFLICT (responder_id, month, year) DO UPDATE SET
    confirmed_points = EXCLUDED.confirmed_points,
    closed_complaints = EXCLUDED.closed_complaints,
    updated_at = NOW();

-- Recalculate pending points for the current month from currently active awaiting-confirmation tickets
WITH ticket_pending_summary AS (
    SELECT 
        assigned_responder_id AS responder_id,
        EXTRACT(MONTH FROM NOW())::INT AS month,
        EXTRACT(YEAR FROM NOW())::INT AS year,
        COALESCE(SUM(points_pending), 0)::INT AS total_pending
    FROM public.tickets
    WHERE status IN ('Issue Resolved', 'Awaiting Supervisor Approval', 'Awaiting Admin Approval', 'Reopened')
      AND assigned_responder_id IS NOT NULL
    GROUP BY assigned_responder_id
)
INSERT INTO public.responder_monthly_points (responder_id, month, year, pending_points, confirmed_points, closed_complaints)
SELECT 
    responder_id,
    month,
    year,
    total_pending,
    0,
    0
FROM ticket_pending_summary
ON CONFLICT (responder_id, month, year) DO UPDATE SET
    pending_points = EXCLUDED.pending_points,
    updated_at = NOW();

-- Set pending_points = 0 for any responder without active awaiting-confirmation tickets this month
UPDATE public.responder_monthly_points rmp
SET pending_points = 0
WHERE month = EXTRACT(MONTH FROM NOW())::INT
  AND year = EXTRACT(YEAR FROM NOW())::INT
  AND responder_id NOT IN (
      SELECT DISTINCT assigned_responder_id 
      FROM public.tickets 
      WHERE status IN ('Issue Resolved', 'Awaiting Supervisor Approval', 'Awaiting Admin Approval', 'Reopened')
        AND assigned_responder_id IS NOT NULL
  );
