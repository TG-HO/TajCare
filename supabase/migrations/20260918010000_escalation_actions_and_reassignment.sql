-- TAJ CARE: POST-ESCALATION ACTIONS, LOCKOUT & REASSIGNMENT WORKFLOW
-- Migration: 20260918010000_escalation_actions_and_reassignment.sql
-- Run this migration in Supabase SQL Editor.

-- ============================================================
-- 1. EXTEND tickets TABLE FOR POST-ESCALATION ACTIONS & LOCKOUT
-- ============================================================

-- Add locked_for_responder: True when Supervisor or higher level takes over/acts on the complaint
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS locked_for_responder BOOLEAN DEFAULT FALSE;

-- Add supervisor_handled: Flag indicating supervisor has taken operational ownership
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS supervisor_handled BOOLEAN DEFAULT FALSE;

-- Add supervisor_handling_id: Specific supervisor profile who is handling this ticket
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS supervisor_handling_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add reassigned_from_id: Profile ID of the previous assignee (responder or supervisor) before reassignment
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS reassigned_from_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add reassigned_at: Timestamp of the most recent reassignment (used to start fresh timer for new assignee)
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- 2. EXTEND points_transactions EVENT TYPE CHECK CONSTRAINT
-- ============================================================

-- Drop old event_type constraint if exists
ALTER TABLE public.points_transactions
    DROP CONSTRAINT IF EXISTS points_transactions_event_type_check;

-- Add extended constraint supporting penalties & reversals
ALTER TABLE public.points_transactions
    ADD CONSTRAINT points_transactions_event_type_check CHECK (
        event_type IN (
            'RESOLVED_PENDING',
            'ADMIN_CONFIRMED',
            'REOPENED_REVERTED',
            'ADMIN_MODIFIED',
            'TASK_CONFIRMED',
            'ESCALATION_PENALTY',
            'REASSIGNMENT_PENALTY',
            'POINTS_REVERSED'
        )
    );

-- ============================================================
-- 3. SCHEMA CACHE RELOAD
-- ============================================================
NOTIFY pgrst, 'reload schema';
