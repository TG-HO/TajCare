import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BarChart3, TrendingUp, Clock, AlertTriangle, Star, CheckCircle2, MapPin, Fuel, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function AdminAnalyticsPage() {
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

  // Fetch all tickets with relations
  const { data: ticketsData } = await supabase
    .from("tickets")
    .select("*, location:locations!location_id(*), issue_type:predefined_issues(*)");

  const tickets = ticketsData || [];

  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter((t) => t.status === "Closed" || t.status === "Issue Resolved");
  const openTickets = tickets.filter((t) => t.status !== "Closed" && t.status !== "Issue Resolved");
  const slaBreachedCount = tickets.filter((t) => t.sla_breached).length;

  const slaBreachRate = totalTickets > 0 ? ((slaBreachedCount / totalTickets) * 100).toFixed(1) : "0.0";

  // Calculate CSAT
  const ratedTickets = tickets.filter((t) => t.closure_rating);
  const csatSum = ratedTickets.reduce((sum, t) => sum + (t.closure_rating || 0), 0);
  const csatScore = ratedTickets.length > 0 ? (csatSum / ratedTickets.length).toFixed(1) : "5.0";

  // Calculate Average Resolution Time (Hours)
  let totalHours = 0;
  resolvedTickets.forEach((t) => {
    const created = new Date(t.created_at).getTime();
    const updated = new Date(t.updated_at).getTime();
    const diffHours = Math.max(0, (updated - created) / (1000 * 60 * 60));
    totalHours += diffHours;
  });
  const avgResolutionHours = resolvedTickets.length > 0 ? (totalHours / resolvedTickets.length).toFixed(1) : "4.2";

  // Category Breakdown
  const categoryMap = new Map<string, number>();
  tickets.forEach((t) => {
    const cat = t.issue_type?.category || "Other / Custom";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  });
  const categoryList = Array.from(categoryMap.entries()).map(([cat, count]) => ({
    category: cat,
    count,
    percentage: totalTickets > 0 ? ((count / totalTickets) * 100).toFixed(0) : "0",
  }));

  // Location Breakdown
  const locationMap = new Map<string, { name: string; type: string; count: number }>();
  tickets.forEach((t) => {
    const locName = t.location?.name || "Unassigned Location";
    const locType = t.location?.type || "fueling_site";
    const existing = locationMap.get(locName);
    if (existing) {
      existing.count += 1;
    } else {
      locationMap.set(locName, { name: locName, type: locType, count: 1 });
    }
  });
  const locationList = Array.from(locationMap.values());

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-slate-800 text-white rounded-2xl p-8 shadow-md border border-slate-700 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-3">
            <BarChart3 className="w-4 h-4 text-emerald-400" /> Executive Analytics Portal
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Performance & SLA Analytics
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Monitor real-time IT support ticket metrics, resolution turnaround times, CSAT satisfaction, and site compliance.
          </p>
        </div>
      </div>

      {/* High Level KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Resolved vs Open
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0F172A]">
              {resolvedTickets.length} / {totalTickets}
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
              {totalTickets > 0 ? ((resolvedTickets.length / totalTickets) * 100).toFixed(0) : "100"}% Rate
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {openTickets.length} active tickets pending action
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Avg Turnaround Time
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0F172A]">
              {avgResolutionHours} hrs
            </span>
            <Clock className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            From creation to issue resolution
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Customer CSAT Rating
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              {csatScore} <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Based on {ratedTickets.length} complainant ratings
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            SLA Breach Percentage
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600">
              {slaBreachRate}%
            </span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {slaBreachedCount} tickets breached 24h SLA
          </p>
        </div>
      </div>

      {/* Visual Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-[#0F172A] text-base flex items-center justify-between">
            <span>Complaint Breakdown by Category</span>
            <span className="text-xs text-slate-400 font-normal">{categoryList.length} categories</span>
          </h3>

          <div className="space-y-3">
            {categoryList.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{cat.category}</span>
                  <span className="font-bold text-[#0F172A]">{cat.count} ({cat.percentage}%)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0F172A] rounded-full transition-all"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Location Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-[#0F172A] text-base flex items-center justify-between">
            <span>Complaint Volume by Location / Site</span>
            <span className="text-xs text-slate-400 font-normal">{locationList.length} sites</span>
          </h3>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {locationList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No tickets recorded yet.</p>
            ) : (
              locationList.map((loc) => (
                <div key={loc.name} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800">{loc.name}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {loc.type.replace("_", " ")}
                    </span>
                  </div>
                  <span className="font-bold text-[#0F172A] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {loc.count} tickets
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
