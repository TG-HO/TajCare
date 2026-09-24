"use client";

import { useState } from "react";
import { Ticket, Profile, PointsTransaction, ResponderMonthlyPoints, Task } from "@/types/database";
import {
  Wrench,
  Award,
  Star,
  ArrowLeft,
  CalendarDays,
  Hourglass,
  BadgeCheck,
  TrendingUp,
  Calculator,
  Calendar,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { formatDate, getTicketConfirmedPoints, isTicketPendingPoints } from "@/lib/utils";
import PointsAuditModal from "@/components/PointsAuditModal";
import RefreshButton from "@/components/RefreshButton";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PerformanceClient({
  profile,
  tickets,
  tasks = [],
  monthlyHistory = [],
  transactions = [],
}: {
  profile: Profile;
  tickets: Ticket[];
  tasks?: Task[];
  monthlyHistory: ResponderMonthlyPoints[];
  transactions: PointsTransaction[];
}) {
  const [selectedTicketForAudit, setSelectedTicketForAudit] = useState<Ticket | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  // 1. Build list of unique months available from history and records
  const monthKeySet = new Set<string>();
  monthKeySet.add(currentMonthKey);

  (monthlyHistory || []).forEach((m) => {
    if (m.year && m.month) {
      monthKeySet.add(`${m.year}-${String(m.month).padStart(2, "0")}`);
    }
  });

  tickets.forEach((t) => {
    const d = t.closed_at ? new Date(t.closed_at) : (t.created_at ? new Date(t.created_at) : null);
    if (d && !isNaN(d.getTime())) {
      monthKeySet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  });

  (tasks || []).forEach((tk) => {
    const d = tk.closed_at ? new Date(tk.closed_at) : (tk.created_at ? new Date(tk.created_at) : null);
    if (d && !isNaN(d.getTime())) {
      monthKeySet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  });

  const sortedMonthKeys = Array.from(monthKeySet).sort().reverse();

  const monthTabs = [
    { key: "all", label: "All-Time", fullLabel: "All-Time Overview" },
    ...sortedMonthKeys.map((mk) => {
      const [yStr, mStr] = mk.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const isCurrent = mk === currentMonthKey;
      return {
        key: mk,
        label: `${MONTH_NAMES[m]?.slice(0, 3)} ${y}${isCurrent ? " (Current)" : ""}`,
        fullLabel: `${MONTH_NAMES[m]} ${y}`,
        year: y,
        month: m,
      };
    }),
  ];

  // Default to current month or "all"
  const [selectedTab, setSelectedTab] = useState<string>("all");

  // 2. All-Time Calculations
  const closedTickets = tickets.filter(
    (t) => t.status === "Closed" || t.status === "Permanently Closed"
  );
  const closedTasks = (tasks || []).filter(
    (tk) => tk.status === "Closed" || tk.status === "Approved"
  );

  const ticketPtsAllTime = closedTickets.reduce((sum, t) => sum + getTicketConfirmedPoints(t), 0);
  const taskPtsAllTime = closedTasks.reduce((sum, tk) => sum + (tk.confirmed_points || 0), 0);
  const totalConfirmedAllTime = ticketPtsAllTime + taskPtsAllTime;

  // Active pending points: only tickets currently in an awaiting-confirmation status
  const totalPendingAllTime = tickets.reduce((sum, t) => sum + isTicketPendingPoints(t), 0);

  // 3. Tab-Specific Calculations
  let displayedTickets: Ticket[] = [];
  let displayedConfirmedPts = 0;
  let displayedPendingPts = 0;
  let displayedClosedCount = 0;
  let periodTitle = "All-Time Total Performance";

  if (selectedTab === "all") {
    displayedTickets = tickets;
    displayedConfirmedPts = totalConfirmedAllTime;
    displayedPendingPts = totalPendingAllTime;
    displayedClosedCount = closedTickets.length;
    periodTitle = "All-Time Total Performance";
  } else {
    const [selYearStr, selMonthStr] = selectedTab.split("-");
    const selYear = parseInt(selYearStr, 10);
    const selMonth = parseInt(selMonthStr, 10);
    const isCurrent = selectedTab === currentMonthKey;

    periodTitle = `${MONTH_NAMES[selMonth]} ${selYear} Performance`;

    // Filter tickets relevant to this month
    displayedTickets = tickets.filter((t) => {
      // If closed, check closed_at date
      if (t.status === "Closed" || t.status === "Permanently Closed") {
        const d = t.closed_at ? new Date(t.closed_at) : (t.updated_at ? new Date(t.updated_at) : null);
        if (!d) return false;
        return d.getMonth() + 1 === selMonth && d.getFullYear() === selYear;
      }
      // If open/pending and this is current month, include it
      if (isCurrent) {
        return true;
      }
      // If past month, check if created in that month
      const d = t.created_at ? new Date(t.created_at) : null;
      if (!d) return false;
      return d.getMonth() + 1 === selMonth && d.getFullYear() === selYear;
    });

    const monthClosedTickets = displayedTickets.filter(
      (t) => t.status === "Closed" || t.status === "Permanently Closed"
    );
    const monthClosedTasks = closedTasks.filter((tk) => {
      const d = tk.closed_at ? new Date(tk.closed_at) : (tk.updated_at ? new Date(tk.updated_at) : null);
      if (!d) return false;
      return d.getMonth() + 1 === selMonth && d.getFullYear() === selYear;
    });

    const monthTicketConfirmed = monthClosedTickets.reduce((sum, t) => sum + getTicketConfirmedPoints(t), 0);
    const monthTaskConfirmed = monthClosedTasks.reduce((sum, tk) => sum + (tk.confirmed_points || 0), 0);
    displayedConfirmedPts = monthTicketConfirmed + monthTaskConfirmed;

    // Pending points only exist in active (current) period
    displayedPendingPts = isCurrent
      ? displayedTickets.reduce((sum, t) => sum + isTicketPendingPoints(t), 0)
      : 0;

    displayedClosedCount = monthClosedTickets.length;
  }

  // Ratings for displayed tickets
  const ratedTickets = displayedTickets.filter(
    (t) => t.site_manager_rating || t.closure_rating || t.supervisor_rating
  );
  const ratingSum = ratedTickets.reduce(
    (sum, t) => sum + (t.supervisor_rating || t.site_manager_rating || t.closure_rating || 0),
    0
  );
  const avgRating = ratedTickets.length > 0 ? (ratingSum / ratedTickets.length).toFixed(1) : "5.0";

  const slaBreachedCount = displayedTickets.filter((t) => t.sla_breached).length;
  const slaComplianceRate =
    displayedTickets.length > 0
      ? Math.max(0, Math.round(((displayedTickets.length - slaBreachedCount) / displayedTickets.length) * 100))
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

        <div className="flex items-center gap-3">
          <RefreshButton />
          <Link
            href="/responder"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Queue
          </Link>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto space-y-6">
        {/* Hero Banner with Clear All-Time Breakdown */}
        <div className="bg-gradient-to-r from-[#0F172A] to-slate-800 text-white rounded-2xl p-8 shadow-md border border-slate-700">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                Gamification & KPI Scorecard
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight mt-1">
                Your Performance Summary
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-lg">
                Points are <strong>Pending</strong> once marked resolved (awaiting Site Manager rating & Field Supervisor closure) and become <strong>Confirmed</strong> upon final closure.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 text-center min-w-[130px]">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Hourglass className="w-4 h-4 text-amber-300" />
                  <span className="text-[10px] font-semibold text-slate-300 uppercase">Pending</span>
                </div>
                <div className="text-2xl font-extrabold text-amber-300">{totalPendingAllTime} pts</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Awaiting Confirmation</p>
              </div>

              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 text-center min-w-[130px]">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <BadgeCheck className="w-4 h-4 text-emerald-300" />
                  <span className="text-[10px] font-semibold text-slate-300 uppercase">Confirmed</span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-300">{totalConfirmedAllTime} pts</div>
                <p className="text-[10px] text-slate-400 mt-0.5">All-Time Credited</p>
              </div>
            </div>
          </div>
        </div>

        {/* Month Tabs Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2 flex items-center gap-1 shrink-0">
            <Calendar className="w-4 h-4 text-indigo-600" /> Period:
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {monthTabs.map((tab) => {
              const isActive = selectedTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    isActive
                      ? "bg-[#0F172A] text-white shadow-md scale-105"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Period Highlight Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-[#0F172A] text-sm uppercase tracking-wider">
                {periodTitle}
              </h2>
            </div>
            {selectedTab !== "all" && (
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                Monthly Breakdown
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Hourglass className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 uppercase">Pending Points</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-700">{displayedPendingPts} pts</div>
              <p className="text-[11px] text-amber-600 mt-1">Awaiting SM / Sup review</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <BadgeCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase">Confirmed Points</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700">{displayedConfirmedPts} pts</div>
              <p className="text-[11px] text-emerald-600 mt-1">Permanently credited</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Award className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold text-slate-700 uppercase">Closed Complaints</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-700">{displayedClosedCount}</div>
              <p className="text-[11px] text-slate-500 mt-1">In this period</p>
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
              {displayedClosedCount} of {displayedTickets.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Period queue volume</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">SLA Compliance Rate</span>
            <div className="mt-2 text-2xl font-extrabold text-emerald-600">{slaComplianceRate}%</div>
            <p className="text-[11px] text-slate-400 mt-1">{slaBreachedCount} breaches recorded</p>
          </div>
        </div>

        {/* Ticket Points Breakdown Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Complaint Points Breakdown & Audit Math ({displayedTickets.length})
            </h3>
            <span className="text-xs text-slate-500">Click any row to inspect calculation formula</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Ticket</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Rating</th>
                  <th className="p-3.5">Pending Pts</th>
                  <th className="p-3.5">Confirmed Pts</th>
                  <th className="p-3.5 text-right">Audit Math</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      No complaints found for the selected period ({periodTitle}).
                    </td>
                  </tr>
                ) : (
                  displayedTickets.map((t) => {
                    const ticketPending = isTicketPendingPoints(t);
                    const ticketConfirmed = getTicketConfirmedPoints(t);
                    const ticketDate = t.closed_at || t.updated_at || t.created_at;

                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-bold text-[#0F172A]">#{t.ticket_number}</td>
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">
                          {ticketDate ? formatDate(ticketDate) : "—"}
                        </td>
                        <td className="p-3.5">{t.location?.name}</td>
                        <td className="p-3.5 font-semibold">{t.status}</td>
                        <td className="p-3.5">
                          {t.site_manager_rating || t.closure_rating || t.supervisor_rating ? (
                            <div className="flex flex-col gap-0.5 text-xs">
                              {(t.site_manager_rating || t.closure_rating) && (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  SM: {t.site_manager_rating || t.closure_rating}★
                                </span>
                              )}
                              {t.supervisor_rating && (
                                <span className="inline-flex items-center gap-1 text-indigo-700 font-bold">
                                  <Star className="w-3.5 h-3.5 fill-indigo-400 text-indigo-500" />
                                  Sup: {t.supervisor_rating}★
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Unrated</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {ticketPending > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Hourglass className="w-3 h-3" />
                              {ticketPending} pts
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {ticketConfirmed > 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <BadgeCheck className="w-3 h-3" />
                              {ticketConfirmed} pts
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedTicketForAudit(t)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 flex items-center gap-1 ml-auto"
                          >
                            <Calculator className="w-3 h-3" /> Formula Math
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Audit Modal */}
      {selectedTicketForAudit && (
        <PointsAuditModal
          ticket={selectedTicketForAudit}
          onClose={() => setSelectedTicketForAudit(null)}
        />
      )}
    </div>
  );
}
