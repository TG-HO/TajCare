import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Trophy,
  Award,
  Star,
  ShieldCheck,
  ArrowLeft,
  Fuel,
  Hourglass,
  BadgeCheck,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { getTicketConfirmedPoints } from "@/lib/utils";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface LeaderboardEntry {
  responder_id: string;
  full_name: string;
  email: string;
  confirmed_points: number;
  pending_points: number;
  avg_rating: number;
  total_resolved: number;
  total_assigned: number;
  sla_breaches: number;
  sla_compliance_rate: number;
  bound_locations_count: number;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string; view?: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();

  const selectedMonth = parseInt(searchParams.month || String(defaultMonth));
  const selectedYear = parseInt(searchParams.year || String(defaultYear));
  const viewMode = searchParams.view || "monthly"; // "monthly" | "alltime"

  // Fetch current user profile role for back button routing
  const { data: currentUserProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isUserAdmin = currentUserProfile?.role === "admin";
  const isUserResponder = currentUserProfile?.role === "responder";
  const dashboardHref = isUserAdmin ? "/admin" : isUserResponder ? "/responder" : "/dashboard";

  // Fetch responder profiles
  const { data: responders } = await supabase
    .from("profiles")
    .select("*, responder_locations(location_id)")
    .eq("role", "responder");

  // Fetch monthly points snapshot for selected period
  const { data: monthlyPoints } = await supabase
    .from("responder_monthly_points")
    .select("*")
    .eq("month", selectedMonth)
    .eq("year", selectedYear);

  // Fetch all-time tickets for SLA, rating, and dynamic points computation
  const { data: rawAllTickets } = await supabase
    .from("tickets")
    .select("*, issue_type:predefined_issues(*)");

  const allTickets = (rawAllTickets || []) as unknown as any[];

  // Filter tickets for selected month
  const monthlyTickets = allTickets.filter((t) => {
    const closedDate = t.closed_at ? new Date(t.closed_at) : (t.updated_at ? new Date(t.updated_at) : null);
    if (!closedDate) return false;
    return closedDate.getMonth() + 1 === selectedMonth && closedDate.getFullYear() === selectedYear;
  });

  const leaderboardMap = new Map<string, LeaderboardEntry>();

  (responders || []).forEach((resp) => {
    leaderboardMap.set(resp.id, {
      responder_id: resp.id,
      full_name: resp.full_name,
      email: resp.email,
      confirmed_points: 0,
      pending_points: 0,
      avg_rating: 0,
      total_resolved: 0,
      total_assigned: 0,
      sla_breaches: 0,
      sla_compliance_rate: 100,
      bound_locations_count: resp.responder_locations?.length || 0,
    });
  });

  const targetTickets = viewMode === "monthly" ? monthlyTickets : allTickets;

  const ratingsSumMap = new Map<string, number>();
  const ratedCountMap = new Map<string, number>();

  targetTickets.forEach((t) => {
    if (!t.assigned_responder_id) return;
    const entry = leaderboardMap.get(t.assigned_responder_id);
    if (!entry) return;

    entry.total_assigned += 1;
    if (t.sla_breached) entry.sla_breaches += 1;

    if (t.status === "Closed" || t.status === "Permanently Closed") {
      entry.total_resolved += 1;
      entry.confirmed_points += getTicketConfirmedPoints(t);
    }

    if (t.status === "Issue Resolved" || t.status === "Reopened" || t.status === "Awaiting Admin Approval") {
      entry.pending_points += t.points_pending || 0;
    }

    if (t.closure_rating) {
      const sum = (ratingsSumMap.get(t.assigned_responder_id) || 0) + t.closure_rating;
      const cnt = (ratedCountMap.get(t.assigned_responder_id) || 0) + 1;
      ratingsSumMap.set(t.assigned_responder_id, sum);
      ratedCountMap.set(t.assigned_responder_id, cnt);
    }
  });

  leaderboardMap.forEach((entry) => {
    const ratedCount = ratedCountMap.get(entry.responder_id) || 0;
    const ratingSum = ratingsSumMap.get(entry.responder_id) || 0;
    entry.avg_rating = ratedCount > 0 ? parseFloat((ratingSum / ratedCount).toFixed(1)) : 5.0;
    entry.sla_compliance_rate =
      entry.total_assigned > 0
        ? Math.max(0, Math.round(((entry.total_assigned - entry.sla_breaches) / entry.total_assigned) * 100))
        : 100;
  });

  // Sort by confirmed points descending
  const leaderboardList: LeaderboardEntry[] = Array.from(leaderboardMap.values()).sort(
    (a, b) => b.confirmed_points - a.confirmed_points
  );

  // Generate month options for the selector (last 12 months)
  const monthOptions: { label: string; month: number; year: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(defaultYear, defaultMonth - 1 - i, 1);
    monthOptions.push({
      label: `${MONTH_NAMES[d.getMonth() + 1]} ${d.getFullYear()}`,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shadow-md">
            <Fuel className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-[#0F172A] text-base leading-tight">
              Taj Care Leaderboard
            </h1>
            <p className="text-xs text-slate-500">IT Responder Performance Rankings</p>
          </div>
        </div>

        <Link
          href={dashboardHref}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isUserAdmin ? "Back to Admin Panel" : "My Dashboard"}
        </Link>
      </header>

      {/* Main Content */}
      <main className="p-8 max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#0F172A] to-slate-800 text-white rounded-2xl p-8 shadow-md border border-slate-700 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-3">
              <Trophy className="w-4 h-4 text-amber-400" /> Gamification & SLA Leaderboard
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {viewMode === "monthly"
                ? `${MONTH_NAMES[selectedMonth]} ${selectedYear} Rankings`
                : "All-Time Rankings"}
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Only <strong>confirmed points</strong> (from Site Manager–closed tickets) count toward the ranking. Pending points are shown separately.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">View:</span>
            <Link
              href={`/leaderboard?view=monthly&month=${selectedMonth}&year=${selectedYear}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "monthly"
                  ? "bg-[#0F172A] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
              Monthly
            </Link>
            <Link
              href="/leaderboard?view=alltime"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "alltime"
                  ? "bg-[#0F172A] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Time
            </Link>
          </div>

          {viewMode === "monthly" && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs font-semibold text-slate-600">Month:</span>
              <div className="flex gap-1 flex-wrap">
                {monthOptions.slice(0, 6).map((opt) => (
                  <Link
                    key={`${opt.month}-${opt.year}`}
                    href={`/leaderboard?view=monthly&month=${opt.month}&year=${opt.year}`}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      opt.month === selectedMonth && opt.year === selectedYear
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {MONTH_NAMES[opt.month].slice(0, 3)} &apos;{String(opt.year).slice(2)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">Rank</th>
                  <th className="p-4">Responder</th>
                  <th className="p-4">
                    <span className="inline-flex items-center gap-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> Confirmed Pts
                    </span>
                  </th>
                  <th className="p-4">
                    <span className="inline-flex items-center gap-1">
                      <Hourglass className="w-3.5 h-3.5 text-amber-500" /> Pending Pts
                    </span>
                  </th>
                  <th className="p-4">CSAT Rating</th>
                  <th className="p-4">Resolved</th>
                  <th className="p-4">SLA Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {leaderboardList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No active responders found.
                    </td>
                  </tr>
                ) : (
                  leaderboardList.map((entry, index) => {
                    const rank = index + 1;
                    return (
                      <tr
                        key={entry.responder_id}
                        className={`transition-colors ${
                          rank === 1
                            ? "bg-amber-50/50 hover:bg-amber-50"
                            : rank === 2
                            ? "bg-slate-50/80"
                            : rank === 3
                            ? "bg-orange-50/30"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-4">
                          {rank === 1 && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-400 text-slate-900 shadow-sm">
                              🥇 #1 Gold
                            </span>
                          )}
                          {rank === 2 && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-300 text-slate-900">
                              🥈 #2 Silver
                            </span>
                          )}
                          {rank === 3 && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                              🥉 #3 Bronze
                            </span>
                          )}
                          {rank > 3 && (
                            <span className="font-bold text-slate-400 pl-3">#{rank}</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#0F172A] text-white font-bold flex items-center justify-center text-xs">
                              {entry.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-[#0F172A]">{entry.full_name}</p>
                              <p className="text-[11px] text-slate-500">{entry.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-extrabold text-sm">
                            <BadgeCheck className="w-4 h-4 text-emerald-600" />
                            {entry.confirmed_points} Pts
                          </div>
                        </td>

                        <td className="p-4">
                          {entry.pending_points > 0 ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold text-xs">
                              <Hourglass className="w-3 h-3" />
                              {entry.pending_points} pts
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-1 text-slate-800 font-bold">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span>{entry.avg_rating} / 5.0</span>
                          </div>
                        </td>

                        <td className="p-4 font-semibold text-slate-800">
                          {entry.total_resolved} closed
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              entry.sla_compliance_rate >= 90
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {entry.sla_compliance_rate}% SLA
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <BadgeCheck className="w-4 h-4 text-emerald-600" />
            <strong>Confirmed Pts</strong> — Points credited after Site Manager closes & rates ticket
          </div>
          <div className="flex items-center gap-1.5">
            <Hourglass className="w-4 h-4 text-amber-500" />
            <strong>Pending Pts</strong> — Awaiting Site Manager confirmation; not counted in ranking
          </div>
        </div>
      </main>
    </div>
  );
}
