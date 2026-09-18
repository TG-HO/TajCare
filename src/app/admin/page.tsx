import { createClient } from "@/lib/supabase/server";
import { Ticket, Task, Profile } from "@/types/database";
import AdminDashboardClient from "./AdminDashboardClient";
import { redirect } from "next/navigation";
import { getAssignedResponderIds } from "@/lib/hierarchy";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role || "employee";
  const adminRoles = ["admin", "hod", "line_manager", "supervisor"];
  if (!adminRoles.includes(userRole)) {
    redirect(userRole === "responder" ? "/responder" : "/dashboard");
  }

  // Get assigned responder IDs for scoped administrative roles
  const assignedResponderIds = await getAssignedResponderIds(supabase, profile as Profile);
  const isScopedRole = assignedResponderIds !== null;

  // Build queries
  let ticketsQuery = supabase
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
    .order("updated_at", { ascending: false });

  if (isScopedRole) {
    if (assignedResponderIds.length > 0) {
      ticketsQuery = ticketsQuery.in("assigned_responder_id", assignedResponderIds);
    } else {
      // No assigned responders yet -> show empty
      ticketsQuery = ticketsQuery.eq("assigned_responder_id", "00000000-0000-0000-0000-000000000000");
    }
  }

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
    isScopedRole
      ? Promise.resolve({ count: assignedResponderIds.length })
      : supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "responder"),
    supabase.from("locations").select("*", { count: "exact", head: true }),
    supabase.from("predefined_issues").select("*", { count: "exact", head: true }),
    ticketsQuery,
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
      userRole={userRole}
      isScopedRole={isScopedRole}
    />
  );
}
