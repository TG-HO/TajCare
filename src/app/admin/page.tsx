import { createClient } from "@/lib/supabase/server";
import { Ticket, Task } from "@/types/database";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch parallel stats & tickets awaiting rating approval
  const [
    { count: totalUsers },
    { count: responderCount },
    { count: locationCount },
    { count: issueCount },
    { data: awaitingApprovalData },
    { data: recentTasksData },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "responder"),
    supabase.from("locations").select("*", { count: "exact", head: true }),
    supabase.from("predefined_issues").select("*", { count: "exact", head: true }),
    supabase
      .from("tickets")
      .select(`
        *,
        location:locations(*),
        issue_type:predefined_issues(*),
        complainant:profiles!complainant_id(*),
        assigned_responder:profiles!assigned_responder_id(*),
        ticket_logs(*, actor:profiles(*))
      `)
      .in("status", ["Awaiting Admin Approval", "Issue Resolved"])
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select(`
        *,
        location:locations(*),
        creator:profiles!created_by(*),
        task_assignees(responder:profiles(*))
      `)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const awaitingApprovalTickets = (awaitingApprovalData || []) as unknown as Ticket[];
  const recentTasks = (recentTasksData || []) as unknown as Task[];

  return (
    <AdminDashboardClient
      totalUsers={totalUsers || 0}
      responderCount={responderCount || 0}
      locationCount={locationCount || 0}
      issueCount={issueCount || 0}
      awaitingApprovalTickets={awaitingApprovalTickets}
      recentTasks={recentTasks}
    />
  );
}
