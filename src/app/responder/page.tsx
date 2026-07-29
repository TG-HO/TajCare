import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { Wrench, LogOut, Settings, Trophy } from "lucide-react";
import Link from "next/link";
import ResponderClient from "./ResponderClient";
import RealtimeNotificationBell from "@/components/RealtimeNotificationBell";
import { Ticket } from "@/types/database";

export default async function ResponderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, responder_locations(location_id, locations(name))")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "responder" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch tickets assigned to this responder
  const { data: ticketsData } = await supabase
    .from("tickets")
    .select(`
      *,
      location:locations(*),
      issue_type:predefined_issues(*),
      complainant:profiles!complainant_id(*),
      assigned_responder:profiles!assigned_responder_id(*),
      ticket_logs(*, actor:profiles(*))
    `)
    .eq("assigned_responder_id", user.id)
    .order("created_at", { ascending: false });

  const tickets: Ticket[] = (ticketsData || []) as unknown as Ticket[];

  // Fetch tasks assigned to this responder for banner points
  const { data: assignees } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("responder_id", user.id);

  const taskIds = (assignees || []).map((a) => a.task_id);

  let tasks: any[] = [];
  if (taskIds.length > 0) {
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .in("id", taskIds);
    tasks = tasksData || [];
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-[#0F172A] text-base leading-tight">
              Taj Care Responder Portal
            </h1>
            <p className="text-xs text-slate-500">{profile?.full_name} • IT Responder Queue</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <RealtimeNotificationBell userId={user.id} />
          <Link
            href="/responder/performance"
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            My Scorecard
          </Link>
          <Link
            href="/profile/settings"
            className="p-2 text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Settings className="w-4 h-4" />
            Profile
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 max-w-6xl mx-auto">
        <ResponderClient profile={profile} tickets={tickets} tasks={tasks as any} />
      </main>
    </div>
  );
}
