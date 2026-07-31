-- TAJ CARE: ADD ATTACHMENTS COLUMN TO TICKETS TABLE
-- File: supabase/migrations/20260731000000_add_ticket_attachments.sql

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
