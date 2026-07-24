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

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch all tickets with full relations
  const { data: ticketsData } = await supabase
    .from("tickets")
    .select(`
      *,
      complainant:profiles!complainant_id(full_name, email, phone_number, role),
      assigned_responder:profiles!assigned_responder_id(full_name, email, is_on_leave),
      location:locations!location_id(id, name, type, city),
      issue_type:predefined_issues(id, issue_title, category, base_points)
    `)
    .order("created_at", { ascending: false });

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
  const { data: respondersData } = await supabase.from("profiles").select("*").eq("role", "responder");

  return (
    <MasterTicketsClient
      tickets={tickets}
      locations={(locationsData as Location[]) || []}
      responders={(respondersData as Profile[]) || []}
    />
  );
}
