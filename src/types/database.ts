export type Role = 'employee' | 'site_manager' | 'responder' | 'admin';
export type LocationType = 'head_office' | 'fueling_site';
export type Complexity = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketStatus = 'Pending' | 'In Progress' | 'Visit Date Scheduled' | 'Visited' | 'Issue Resolved' | 'Closed';

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  city: string;
  address?: string | null;
  created_at?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  location_id?: string | null;
  phone_number?: string | null;
  is_on_leave?: boolean;
  backup_responder_id?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined relation fields
  location?: Location | null;
  backup_responder?: Profile | null;
  responder_locations?: Location[];
}

export interface PredefinedIssue {
  id: string;
  category: string;
  issue_title: string;
  complexity: Complexity;
  base_points: number;
  target_location_type?: 'fueling_site' | 'head_office' | 'both';
  created_at?: string;
}

export interface TicketDraft {
  id: string;
  user_id: string;
  issue_type_id?: string | null;
  custom_issue_title?: string | null;
  description?: string | null;
  updated_at?: string;
}

export interface TicketLog {
  id: string;
  ticket_id: string;
  actor_id: string;
  previous_status?: string | null;
  new_status: string;
  remarks: string;
  visit_date?: string | null;
  created_at?: string;
  actor?: Profile | null;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  complainant_id: string;
  location_id: string;
  issue_type_id?: string | null;
  custom_issue_title?: string | null;
  description: string;
  status: TicketStatus;
  assigned_responder_id?: string | null;
  scheduled_visit_date?: string | null;
  visit_remarks?: string | null;
  closure_rating?: number | null;
  closure_remarks?: string | null;
  points_awarded?: number;
  sla_due_at?: string;
  sla_breached?: boolean;
  reopened_count?: number;
  created_at?: string;
  updated_at?: string;
  // Joined relations
  complainant?: Profile | null;
  location?: Location | null;
  issue_type?: PredefinedIssue | null;
  assigned_responder?: Profile | null;
  ticket_logs?: TicketLog[];
}
