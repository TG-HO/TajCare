export type Role = 'employee' | 'site_manager' | 'responder' | 'admin';
export type LocationType = 'head_office' | 'fueling_site';
export type Complexity = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketStatus =
  | 'Pending'
  | 'In Progress'
  | 'Visit Date Scheduled'
  | 'Visited'
  | 'Issue Resolved'
  | 'Awaiting Admin Approval'
  | 'Closed'
  | 'Reopened'
  | 'Permanently Closed';

export type TaskStatus =
  | 'Pending'
  | 'First Visit Assigned'
  | 'Visited'
  | 'Second Visit Assigned'
  | 'Third Visit Assigned'
  | 'Next Visit Assigned'
  | 'Due Date Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Closed'
  | 'Approved'
  | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

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
  points_pending?: number;
  confirmed_points?: number;
  sla_due_at?: string;
  sla_breached?: boolean;
  reopened_count?: number;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined relations
  complainant?: Profile | null;
  location?: Location | null;
  issue_type?: PredefinedIssue | null;
  assigned_responder?: Profile | null;
  ticket_logs?: TicketLog[];
}

export interface Task {
  id: string;
  task_number: number;
  title: string;
  description: string;
  location_id: string;
  created_by: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  first_visit_date?: string | null;
  current_visit_number?: number;
  next_visit_date?: string | null;
  expected_completion_date?: string | null;
  closure_rating?: number | null;
  closure_remarks?: string | null;
  closed_at?: string | null;
  base_points?: number;
  points_pending?: number;
  confirmed_points?: number;
  attachments?: string[];
  created_at?: string;
  updated_at?: string;
  // Joined relations
  location?: Location | null;
  creator?: Profile | null;
  assignees?: Profile[];
  task_assignees?: { responder?: Profile | null }[];
  task_logs?: TaskLog[];
  task_visits?: TaskVisit[];
}

export interface TaskVisit {
  id: string;
  task_id: string;
  visit_number: number;
  assigned_visit_date: string;
  actual_visit_date?: string | null;
  responder_id?: string | null;
  status: 'Scheduled' | 'Visited' | 'Cancelled';
  remarks?: string | null;
  attachments?: string[];
  admin_action?: string | null;
  created_at?: string;
  updated_at?: string;
  responder?: Profile | null;
}

export interface TaskAssignee {
  task_id: string;
  responder_id: string;
  assigned_at?: string;
  responder?: Profile | null;
}

export interface TaskLog {
  id: string;
  task_id: string;
  actor_id: string;
  previous_status?: string | null;
  new_status: string;
  remarks: string;
  created_at?: string;
  actor?: Profile | null;
}

export interface PointsTransaction {
  id: string;
  ticket_id?: string | null;
  task_id?: string | null;
  responder_id: string;
  event_type: 'RESOLVED_PENDING' | 'ADMIN_CONFIRMED' | 'REOPENED_REVERTED' | 'ADMIN_MODIFIED' | 'TASK_CONFIRMED';
  base_points: number;
  rating_multiplier?: number;
  sla_penalty?: number;
  final_points: number;
  actor_id?: string | null;
  remarks?: string | null;
  created_at?: string;
  actor?: Profile | null;
  ticket?: Ticket | null;
  task?: Task | null;
}

export interface SystemNotification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  title: string;
  message: string;
  type: string;
  reference_id?: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile | null;
}

export interface ResponderMonthlyPoints {
  id: string;
  responder_id: string;
  month: number;
  year: number;
  pending_points: number;
  confirmed_points: number;
  closed_complaints: number;
  created_at?: string;
  updated_at?: string;
  responder?: Profile | null;
}
