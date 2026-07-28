-- TAJ CARE: POINTS CALCULATION SYNC & TICKET OVERRIDE MIGRATION
-- File: supabase/migrations/20260728000000_fix_points_sync_and_override.sql

-- ============================================================
-- 1. EXTEND TICKETS STATUS ENUM TO INCLUDE 'Cancelled'
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
        'Permanently Closed',
        'Cancelled'
    )
);

-- ============================================================
-- 2. RECALCULATE & FIX ALL EXISTING CLOSED TICKETS CONFIRMED POINTS
-- ============================================================
UPDATE public.tickets SET
    confirmed_points = GREATEST(0, ROUND(
        COALESCE(
            (SELECT base_points FROM public.predefined_issues WHERE id = issue_type_id),
            points_pending,
            20
        ) *
        (CASE COALESCE(closure_rating, 5)
            WHEN 5 THEN 1.5
            WHEN 4 THEN 1.25
            WHEN 3 THEN 1.0
            WHEN 2 THEN 0.8
            WHEN 1 THEN 0.5
            ELSE 1.0
        END) -
        (CASE WHEN COALESCE(sla_breached, false) THEN 15 ELSE 0 END)
    )::INT),
    points_awarded = GREATEST(0, ROUND(
        COALESCE(
            (SELECT base_points FROM public.predefined_issues WHERE id = issue_type_id),
            points_pending,
            20
        ) *
        (CASE COALESCE(closure_rating, 5)
            WHEN 5 THEN 1.5
            WHEN 4 THEN 1.25
            WHEN 3 THEN 1.0
            WHEN 2 THEN 0.8
            WHEN 1 THEN 0.5
            ELSE 1.0
        END) -
        (CASE WHEN COALESCE(sla_breached, false) THEN 15 ELSE 0 END)
    )::INT)
WHERE status IN ('Closed', 'Permanently Closed') AND closure_rating IS NOT NULL;


-- ============================================================
-- 3. RE-AGGREGATE responder_monthly_points FROM ACTUAL TICKETS
-- ============================================================
DELETE FROM public.responder_monthly_points;

INSERT INTO public.responder_monthly_points (responder_id, month, year, pending_points, confirmed_points, closed_complaints)
SELECT 
    assigned_responder_id AS responder_id,
    EXTRACT(MONTH FROM COALESCE(closed_at, updated_at, NOW()))::INT AS month,
    EXTRACT(YEAR FROM COALESCE(closed_at, updated_at, NOW()))::INT AS year,
    0 AS pending_points,
    SUM(COALESCE(confirmed_points, 0))::INT AS confirmed_points,
    COUNT(*)::INT AS closed_complaints
FROM public.tickets
WHERE assigned_responder_id IS NOT NULL 
  AND status IN ('Closed', 'Permanently Closed')
GROUP BY assigned_responder_id, EXTRACT(MONTH FROM COALESCE(closed_at, updated_at, NOW())), EXTRACT(YEAR FROM COALESCE(closed_at, updated_at, NOW()));

-- Done!
