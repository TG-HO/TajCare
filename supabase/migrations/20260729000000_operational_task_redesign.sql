-- TAJ CARE: OPERATIONAL TASK WORKFLOW REDESIGN & VISIT TIMELINE MIGRATION
-- File: supabase/migrations/20260729000000_operational_task_redesign.sql

-- ============================================================
-- 1. EXTEND TASKS STATUS CHECK CONSTRAINT
-- ============================================================
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (
    status IN (
        'Pending',
        'First Visit Assigned',
        'Visited',
        'Second Visit Assigned',
        'Next Visit Assigned',
        'Due Date Assigned',
        'Completed',
        'Closed',
        'Approved',
        'Cancelled'
    )
);

-- ============================================================
-- 2. ADD VISIT AND CLOSURE COLUMNS TO TASKS TABLE
-- ============================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS first_visit_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS current_visit_number INT DEFAULT 1;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS next_visit_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS closure_rating INT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS closure_remarks TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- 3. CREATE TASK VISITS TIMELINE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    visit_number INT NOT NULL DEFAULT 1,
    assigned_visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_visit_date TIMESTAMP WITH TIME ZONE,
    responder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('Scheduled', 'Visited', 'Cancelled')) DEFAULT 'Scheduled',
    remarks TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    admin_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on task_visits
ALTER TABLE public.task_visits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select task visits
CREATE POLICY "Allow authenticated read task_visits" ON public.task_visits
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert task visits
CREATE POLICY "Allow authenticated insert task_visits" ON public.task_visits
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update task visits
CREATE POLICY "Allow authenticated update task_visits" ON public.task_visits
    FOR UPDATE TO authenticated USING (true);

-- Done!
