import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { Fuel, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import DashboardClient from "./DashboardClient";
import RealtimeNotificationBell from "@/components/RealtimeNotificationBell";
import { Ticket } from "@/types/database";

export default async function DashboardPage() {
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

  // Fetch tickets filed by this complainant
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
    .eq("complainant_id", user.id)
    .order("created_at", { ascending: false });

  const tickets: Ticket[] = (ticketsData || []) as unknown as Ticket[];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shadow-md">
            <Fuel className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-[#0F172A] text-base leading-tight">Taj Care Portal</h1>
            <p className="text-xs text-slate-500">{profile?.location?.name || "General User"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <RealtimeNotificationBell userId={user.id} />
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
        <DashboardClient profile={profile} tickets={tickets} />
      </main>
    </div>
  );
}
