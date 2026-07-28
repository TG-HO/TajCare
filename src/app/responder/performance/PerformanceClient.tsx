"use client";

import { useState } from "react";
import { Ticket, Profile, PointsTransaction, ResponderMonthlyPoints } from "@/types/database";
import { Wrench, Award, Star, ArrowLeft, CalendarDays, Hourglass, BadgeCheck, TrendingUp, Calculator } from "lucide-react";
import Link from "next/link";
import { formatDate, getTicketConfirmedPoints } from "@/lib/utils";
import PointsAuditModal from "@/components/PointsAuditModal";
import RefreshButton from "@/components/RefreshButton";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PerformanceClient({
  profile,
  tickets,
  monthlyHistory,
  transactions,
}: {
  profile: Profile;
  tickets: Ticket[];
  monthlyHistory: ResponderMonthlyPoints[];
  transactions: PointsTransaction[];
}) {
  const [selectedTicketForAudit, setSelectedTicketForAudit] = useState<Ticket | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const closedTickets = tickets.filter(
    (t) => t.status === "Closed" || t.status === "Permanently Closed"
  );

  const totalConfirmedAllTime = closedTickets.reduce(
    (sum, t) => sum + getTicketConfirmedPoints(t),
    0
  );

  const currentMonthTickets = closedTickets.filter((t) => {
    const d = t.closed_at ? new Date(t.closed_at) : (t.updated_at ? new Date(t.updated_at) : null);
    if (!d) return false;
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const currentMonthConfirmedPts = currentMonthTickets.reduce(
    (sum, t) => sum + getTicketConfirmedPoints(t),
    0
  );

  const currentPendingPts = tickets
    .filter((t) => (t.status === "Issue Resolved" || t.status === "Reopened" || t.status === "Awaiting Admin Approval"))
    .reduce((sum, t) => sum + (t.points_pending || 0), 0);

  const currentClosed = currentMonthTickets.length;
  const totalPendingAllTime = currentPendingPts;

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
        {/* Hero Banner */}
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
                Points are Pending when marked resolved and become Confirmed after Admin approval.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Hourglass className="w-4 h-4 text-amber-300" />
                  <span className="text-[10px] font-semibold text-slate-300 uppercase">Pending</span>
                </div>
                <div className="text-2xl font-extrabold text-amber-300">{totalPendingAllTime} pts</div>
                <p className="text-[10px] text-slate-400 mt-0.5">Awaiting confirmation</p>
              </div>

              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <BadgeCheck className="w-4 h-4 text-emerald-300" />
                  <span className="text-[10px] font-semibold text-slate-300 uppercase">Confirmed</span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-300">{totalConfirmedAllTime} pts</div>
                <p className="text-[10px] text-slate-400 mt-0.5">All time total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Month Highlight */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-[#0F172A] text-sm uppercase tracking-wider">
              {MONTH_NAMES[currentMonth]} {currentYear} — Current Month
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Hourglass className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 uppercase">Pending Points</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-700">{currentPendingPts}</div>
              <p className="text-[11px] text-amber-600 mt-1">Awaiting SM / Admin review</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <BadgeCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase">Confirmed Points</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700">{currentMonthConfirmedPts}</div>
              <p className="text-[11px] text-emerald-600 mt-1">Permanently credited</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Award className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold text-slate-700 uppercase">Closed Complaints</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-700">{currentClosed}</div>
              <p className="text-[11px] text-slate-500 mt-1">This month</p>
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
            <div className="mt-2 text-2xl font-extrabold text-emerald-600">{slaComplianceRate}%</div>
            <p className="text-[11px] text-slate-400 mt-1">{slaBreachedCount} breaches recorded</p>
          </div>
        </div>

        {/* Ticket Points Breakdown Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-[#0F172A] text-sm">Complaint Points Breakdown & Audit Math</h3>
            <span className="text-xs text-slate-500">Click any row to inspect full calculation formula</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Ticket</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Rating</th>
                  <th className="p-3.5">Pending Pts</th>
                  <th className="p-3.5">Confirmed Pts</th>
                  <th className="p-3.5 text-right">Audit Math</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No assigned tickets in history.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
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
                      <td className="p-3.5">
                        {(t.points_pending ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                            <Hourglass className="w-3 h-3" />
                            {t.points_pending} pts
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {getTicketConfirmedPoints(t) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <BadgeCheck className="w-3 h-3" />
                            {getTicketConfirmedPoints(t)} pts
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
                  ))
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
