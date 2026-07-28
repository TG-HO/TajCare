"use client";

import { useState } from "react";
import { Ticket, Profile, TicketStatus } from "@/types/database";
import { getStatusBadgeColor, formatDate, getTicketConfirmedPoints } from "@/lib/utils";
import { updateTicketStatusAction } from "./actions";
import { toast } from "sonner";
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  Eye,
  X,
  Loader2,
  AlertTriangle,
  Hourglass,
  BadgeCheck,
  Lock,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import TicketDetailDrawer from "@/components/TicketDetailDrawer";
import RefreshButton from "@/components/RefreshButton";

export default function ResponderClient({
  profile,
  tickets,
}: {
  profile: Profile;
  tickets: Ticket[];
}) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [targetStatus, setTargetStatus] = useState<TicketStatus | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawerTicket, setDrawerTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });

  // Stats for the banner
  const pendingPts = tickets.reduce((s, t) => s + (t.points_pending ?? 0), 0);
  const confirmedPts = tickets.reduce((s, t) => s + getTicketConfirmedPoints(t), 0);

  function handleOpenActionModal(ticket: Ticket, newStatus: TicketStatus) {
    setSelectedTicket(ticket);
    setTargetStatus(newStatus);
    setVisitDate(
      ticket.scheduled_visit_date
        ? new Date(ticket.scheduled_visit_date).toISOString().slice(0, 16)
        : ""
    );
    setRemarks("");
  }

  async function handleSubmitAction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket || !targetStatus) return;

    if (!remarks.trim()) {
      toast.error("Transition remarks are mandatory!");
      return;
    }

    setLoading(true);
    const result = await updateTicketStatusAction(
      selectedTicket.id,
      targetStatus,
      remarks,
      visitDate || null
    );
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setSelectedTicket(null);
      setTargetStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Responder Status Banner */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
              IT Responder Queue
            </span>
            {profile.is_on_leave ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-[#0F172A]">
                ON LEAVE (Backup Active)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-[#0F172A]">
                ON DUTY
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Assigned Complaints Queue ({tickets.length})
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Schedule fueling site visits, update ticket resolution status, and submit mandatory remarks.
          </p>
        </div>

        {/* Points Summary & Task Navigation */}
        <div className="flex gap-3 flex-wrap items-center">
          <Link
            href="/responder/tasks"
            className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-4 py-3 text-center min-w-[110px] transition-all"
          >
            <div className="flex items-center justify-center gap-1 text-purple-300 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold uppercase">Tasks</span>
            </div>
            <div className="text-sm font-extrabold text-white">Operational Tasks →</div>
          </Link>

          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center min-w-[100px]">
            <div className="flex items-center justify-center gap-1.5 text-amber-300 mb-1">
              <Hourglass className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold uppercase">Pending</span>
            </div>
            <div className="text-xl font-extrabold text-amber-300">{pendingPts} pts</div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center min-w-[100px]">
            <div className="flex items-center justify-center gap-1.5 text-emerald-300 mb-1">
              <BadgeCheck className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold uppercase">Confirmed</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-300">{confirmedPts} pts</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 border border-slate-200 rounded-2xl shadow-sm gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          >
            <option value="all">All Assigned ({tickets.length})</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Visit Date Scheduled">Visit Scheduled</option>
            <option value="Visited">Visited</option>
            <option value="Issue Resolved">Resolved (Awaiting SM)</option>
            <option value="Awaiting Admin Approval">Awaiting Admin Approval</option>
            <option value="Reopened">Reopened</option>
            <option value="Closed">Closed</option>
            <option value="Permanently Closed">Permanently Closed</option>
          </select>
        </div>

        <RefreshButton />
      </div>

      {/* Queue List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm text-slate-400">
            No complaints found for selected filter.
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isHeadOffice = ticket.location?.type === "head_office";
            const title =
              ticket.issue_type?.issue_title || ticket.custom_issue_title || "IT Support Request";

            const visitPassed =
              ticket.scheduled_visit_date && new Date() >= new Date(ticket.scheduled_visit_date);

            const isPermanentlyClosed = ticket.status === "Permanently Closed";
            const isReopened = ticket.status === "Reopened";

            return (
              <div
                key={ticket.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4 ${
                  isReopened
                    ? "border-rose-200 bg-rose-50/20"
                    : isPermanentlyClosed
                    ? "border-slate-300 opacity-75"
                    : "border-slate-200"
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs font-extrabold text-[#0F172A]">
                      #{ticket.ticket_number}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeColor(
                        ticket.status
                      )}`}
                    >
                      {isPermanentlyClosed && <Lock className="w-2.5 h-2.5 mr-1" />}
                      {ticket.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {isHeadOffice ? "Head Office" : "Fueling Site"}
                    </span>

                    {/* Reopened badge */}
                    {isReopened && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <RotateCcw className="w-2.5 h-2.5" />
                        Re-opened ({ticket.reopened_count}x) — Re-resolve required
                      </span>
                    )}

                    {/* SLA breach */}
                    {ticket.status === "Visit Date Scheduled" && visitPassed && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Visit Time Passed (Late SLA)
                      </span>
                    )}

                    {/* Pending points badge */}
                    {(ticket.status === "Issue Resolved" || isReopened) &&
                      (ticket.points_pending ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                          <Hourglass className="w-2.5 h-2.5" />
                          {ticket.points_pending} pts Pending
                        </span>
                      )}

                    {/* Confirmed points badge */}
                    {(ticket.status === "Closed" || isPermanentlyClosed) &&
                      (ticket.confirmed_points ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          <BadgeCheck className="w-2.5 h-2.5" />
                          {ticket.confirmed_points} pts Confirmed
                        </span>
                      )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Location: <strong>{ticket.location?.name}</strong>
                  </span>
                </div>

                {/* Body */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <h3 className="font-bold text-[#0F172A] text-base">{title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{ticket.description}</p>
                    {ticket.scheduled_visit_date && (
                      <div
                        className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          visitPassed
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" /> Scheduled Visit:{" "}
                        {formatDate(ticket.scheduled_visit_date)}
                      </div>
                    )}

                    {/* Awaiting SM notice */}
                    {ticket.status === "Issue Resolved" && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Hourglass className="w-3 h-3" /> Awaiting Site Manager to Close & Rate
                      </div>
                    )}
                  </div>

                  {/* Actions & State Transitions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setDrawerTicket(ticket)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Timeline
                    </button>

                    {/* Skip actions for closed/permanently-closed */}
                    {!isPermanentlyClosed && ticket.status !== "Closed" && (
                      <>
                        {/* HEAD OFFICE WORKFLOW */}
                        {isHeadOffice && (
                          <>
                            {ticket.status === "Pending" && (
                              <button
                                onClick={() => handleOpenActionModal(ticket, "In Progress")}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-all"
                              >
                                Mark In Progress
                              </button>
                            )}
                            {(ticket.status === "Pending" || ticket.status === "In Progress") && (
                              <button
                                onClick={() => handleOpenActionModal(ticket, "Issue Resolved")}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all"
                              >
                                Mark Resolved
                              </button>
                            )}
                            {/* Re-resolve for Reopened tickets */}
                            {isReopened && (
                              <button
                                onClick={() => handleOpenActionModal(ticket, "Issue Resolved")}
                                className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Re-Resolve Issue
                              </button>
                            )}
                          </>
                        )}

                        {/* FUELING SITE WORKFLOW */}
                        {!isHeadOffice && (
                          <>
                            {ticket.status === "Pending" && (
                              <button
                                onClick={() => handleOpenActionModal(ticket, "Visit Date Scheduled")}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Schedule Visit
                              </button>
                            )}

                            {ticket.status === "Visit Date Scheduled" && visitPassed && (
                              <button
                                onClick={() => handleOpenActionModal(ticket, "Visit Date Scheduled")}
                                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Reschedule (Late)
                              </button>
                            )}

                            {ticket.status === "Visit Date Scheduled" && (
                              <button
                                onClick={() => handleOpenActionModal(ticket, "Visited")}
                                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow transition-all"
                              >
                                Mark Visited
                              </button>
                            )}

                            {(ticket.status === "Visited" ||
                              ticket.status === "Visit Date Scheduled") && (
                              <button
                                onClick={() => handleOpenActionModal(ticket, "Issue Resolved")}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all"
                              >
                                Mark Resolved
                              </button>
                            )}

                            {/* Re-resolve for Reopened tickets */}
                            {isReopened && (
                              <>
                                <button
                                  onClick={() =>
                                    handleOpenActionModal(ticket, "Visit Date Scheduled")
                                  }
                                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  Reschedule Visit
                                </button>
                                <button
                                  onClick={() => handleOpenActionModal(ticket, "Issue Resolved")}
                                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Re-Resolve Issue
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action & Remarks Modal */}
      {selectedTicket && targetStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#0F172A]" /> Update Ticket #{selectedTicket.ticket_number}
              </h2>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAction} className="space-y-4 pt-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="text-slate-400 uppercase font-semibold">Target Status Transition</span>
                <p className="font-bold text-[#0F172A] text-sm">
                  {selectedTicket.status} →{" "}
                  <span className="text-emerald-600">{targetStatus}</span>
                </p>
              </div>

              {/* Note for Issue Resolved transition */}
              {targetStatus === "Issue Resolved" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <p className="font-semibold mb-0.5">⏳ Points will move to Pending</p>
                  <p>
                    Points will not be confirmed until the Site Manager closes and rates this ticket.
                  </p>
                </div>
              )}

              {/* Visit Date Input if Scheduling or Rescheduling Visit */}
              {targetStatus === "Visit Date Scheduled" && (
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">
                    Scheduled Visit Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  />
                  {selectedTicket.status === "Visit Date Scheduled" && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Note: Rescheduling after the visit date has passed will mark the ticket as SLA Breached.
                    </p>
                  )}
                </div>
              )}

              {/* Mandatory Transition Remarks */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">
                  Transition Remarks (Mandatory) *
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required
                  rows={4}
                  placeholder="Mandatory notes regarding site visit, hardware inspection, or resolution details..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Status Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Drawer */}
      {drawerTicket && (
        <TicketDetailDrawer ticket={drawerTicket} onClose={() => setDrawerTicket(null)} />
      )}
    </div>
  );
}
