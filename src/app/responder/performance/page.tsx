import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Wrench, Award, Star, Clock, ArrowLeft, CalendarDays, Hourglass, BadgeCheck, TrendingUp, Calculator } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import PerformanceClient from "./PerformanceClient";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function ResponderPerformancePage() {
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

  if (profile?.role !== "responder" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch all tickets assigned to this responder
  const { data: ticketsData } = await supabase
    .from("tickets")
    .select("*, location:locations(*), issue_type:predefined_issues(*)")
    .eq("assigned_responder_id", user.id)
    .order("updated_at", { ascending: false });

  const tickets = ticketsData || [];

  // Fetch monthly points history
  const { data: monthlyData } = await supabase
    .from("responder_monthly_points")
    .select("*")
    .eq("responder_id", user.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  const monthlyHistory = monthlyData || [];

  // Fetch points transactions audit log
  const { data: transactionsData } = await supabase
    .from("points_transactions")
    .select("*, ticket:tickets(*)")
    .eq("responder_id", user.id)
    .order("created_at", { ascending: false });

  const transactions = transactionsData || [];

  return (
    <PerformanceClient
      profile={profile}
      tickets={tickets}
      monthlyHistory={monthlyHistory}
      transactions={transactions}
    />
  );
}
