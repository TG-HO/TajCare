import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MasterTicketsClient from "./MasterTicketsClient";
import { Ticket, Location, Profile } from "@/types/database";

export default async function AdminMasterTicketsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const adminRoles = ["admin", "hod", "line_manager", "supervisor"];
  if (!adminRoles.includes(profile?.role || "")) {
    redirect("/dashboard");
  }

  const { getAssignedResponderIds } = await import("@/lib/hierarchy");
  const assignedResponderIds = await getAssignedResponderIds(supabase, profile as Profile);
  const isScoped = assignedResponderIds !== null;

  // Fetch tickets with full relations
  let ticketsQuery = supabase
    .from("tickets")
    .select(`
      *,
      complainant:profiles!complainant_id(full_name, email, phone_number, role),
      assigned_responder:profiles!assigned_responder_id(full_name, email, is_on_leave),
      location:locations!location_id(id, name, type, city),
      issue_type:predefined_issues(*)
    `)
    .order("created_at", { ascending: false });

  if (isScoped) {
    if (assignedResponderIds.length > 0) {
      ticketsQuery = ticketsQuery.in("assigned_responder_id", assignedResponderIds);
    } else {
      ticketsQuery = ticketsQuery.eq("assigned_responder_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { data: ticketsData } = await ticketsQuery;

  // Fetch ticket logs for full history
  const { data: logsData } = await supabase
    .from("ticket_logs")
    .select("*, actor:profiles!actor_id(full_name, role)")
    .order("created_at", { ascending: true });

  // Combine logs into tickets
  const tickets: Ticket[] = (ticketsData || []).map((t) => ({
    ...t,
    ticket_logs: (logsData || []).filter((l) => l.ticket_id === t.id),
  })) as unknown as Ticket[];

  // Fetch locations and responders for filter dropdowns
  const { data: locationsData } = await supabase.from("locations").select("*").order("name");

  let respondersQuery = supabase.from("profiles").select("*").eq("role", "responder");
  if (isScoped) {
    if (assignedResponderIds.length > 0) {
      respondersQuery = respondersQuery.in("id", assignedResponderIds);
    } else {
      respondersQuery = respondersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }
  const { data: respondersData } = await respondersQuery;

  // Fetch supervisors for reassignment options (for line managers / admin)
  const { data: supervisorsData } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "supervisor")
    .order("full_name");

  return (
    <MasterTicketsClient
      tickets={tickets}
      locations={(locationsData as Location[]) || []}
      responders={(respondersData as Profile[]) || []}
      supervisors={(supervisorsData as Profile[]) || []}
      userRole={profile?.role || "admin"}
      isScoped={isScoped}
    />
  );
}
