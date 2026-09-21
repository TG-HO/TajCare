import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SupervisedTicketsClient from "./SupervisedTicketsClient";
import { Ticket, Location, Profile } from "@/types/database";

export default async function SupervisedTicketsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations!location_id(name)")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role || "employee";
  const allowedRoles = ["supervisor", "admin"];
  if (!allowedRoles.includes(userRole)) {
    redirect("/admin");
  }

  // Query tickets taken over by this supervisor (or all supervised tickets if admin)
  let ticketsQuery = supabase
    .from("tickets")
    .select(`
      *,
      complainant:profiles!complainant_id(full_name, email, phone_number, role),
      assigned_responder:profiles!assigned_responder_id(full_name, email, is_on_leave),
      location:locations!location_id(id, name, type, city),
      issue_type:predefined_issues(*)
    `)
    .eq("supervisor_handled", true)
    .order("updated_at", { ascending: false });

  if (userRole === "supervisor") {
    ticketsQuery = ticketsQuery.eq("supervisor_handling_id", user.id);
  }

  const { data: ticketsData } = await ticketsQuery;

  // Fetch ticket logs for full history
  const { data: logsData } = await supabase
    .from("ticket_logs")
    .select("*, actor:profiles!actor_id(full_name, role)")
    .order("created_at", { ascending: true });

  const tickets: Ticket[] = (ticketsData || []).map((t) => ({
    ...t,
    ticket_logs: (logsData || []).filter((l) => l.ticket_id === t.id),
  })) as unknown as Ticket[];

  // Fetch locations
  const { data: locationsData } = await supabase.from("locations").select("*").order("name");

  // Fetch responders and supervisors for reassignment options
  const { data: respondersData } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "responder")
    .order("full_name");

  const { data: supervisorsData } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "supervisor")
    .order("full_name");

  return (
    <SupervisedTicketsClient
      tickets={tickets}
      locations={(locationsData as Location[]) || []}
      responders={(respondersData as Profile[]) || []}
      supervisors={(supervisorsData as Profile[]) || []}
      userRole={userRole}
      currentUserId={user.id}
    />
  );
}
