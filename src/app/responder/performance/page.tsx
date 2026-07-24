import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Wrench, Award, Star, Clock, ShieldCheck, ArrowLeft, Fuel, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

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

  // Fetch tickets assigned to this responder
  const { data: ticketsData } = await supabase
    .from("tickets")
    .select("*, location:locations(*), issue_type:predefined_issues(*)")
    .eq("assigned_responder_id", user.id)
    .order("updated_at", { ascending: false });

  const tickets = ticketsData || [];

  const closedTickets = tickets.filter((t) => t.status === "Closed" || t.status === "Issue Resolved");
  const totalPoints = closedTickets.reduce((sum, t) => sum + (t.points_awarded || 0), 0);

  const ratedTickets = tickets.filter((t) => t.closure_rating);
  const ratingSum = ratedTickets.reduce((sum, t) => sum + (t.closure_rating || 0), 0);
  const avgRating = ratedTickets.length > 0 ? (ratingSum / ratedTickets.length).toFixed(1) : "5.0";

  const slaBreachedCount = tickets.filter((t) => t.sla_breached).length;
  const slaComplianceRate =
    tickets.length > 0
      ? Math.max(0, Math.round(((tickets.length - slaBreachedCount) / tickets.length) * 100))
      : 100;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-[#0F172A] text-base leading-tight">
              Responder Performance Scorecard
            </h1>
            <p className="text-xs text-slate-500">{profile?.full_name} • IT Operations</p>
          </div>
        </div>

        <Link
          href="/responder"
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Queue
        </Link>
      </header>

      {/* Main Content */}
      <main className="p-8 max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#0F172A] to-slate-800 text-white rounded-2xl p-8 shadow-md border border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
              Gamification Scorecard
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight mt-1">
              Your Performance Summary
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-lg">
              Track points earned from resolved complaints, star rating feedback, and SLA compliance metrics.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 text-center">
            <span className="text-xs font-semibold text-slate-300 uppercase block">Total Points</span>
            <div className="text-3xl font-extrabold text-amber-400 flex items-center justify-center gap-1.5 mt-1">
              <Award className="w-6 h-6 text-amber-400" />
              {totalPoints} Pts
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Avg Star Rating</span>
            <div className="mt-2 flex items-center gap-2">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              <span className="text-2xl font-extrabold text-[#0F172A]">{avgRating} / 5.0</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">From {ratedTickets.length} rated tickets</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Resolved Complaints</span>
            <div className="mt-2 text-2xl font-extrabold text-[#0F172A]">
              {closedTickets.length} of {tickets.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total assigned queue</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">SLA Compliance Rate</span>
            <div className="mt-2 text-2xl font-extrabold text-emerald-600">
              {slaComplianceRate}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{slaBreachedCount} breaches recorded</p>
          </div>
        </div>

        {/* Points Breakdown Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-[#0F172A] text-sm">Points & Rating History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Ticket</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Rating</th>
                  <th className="p-3.5">Points Awarded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      No assigned tickets in history.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold text-[#0F172A]">#{t.ticket_number}</td>
                      <td className="p-3.5">{t.location?.name}</td>
                      <td className="p-3.5 font-semibold">{t.status}</td>
                      <td className="p-3.5">
                        {t.closure_rating ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {t.closure_rating} Stars
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unrated</span>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-amber-700">
                        +{t.points_awarded || 0} pts
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
