"use client";

import { useState } from "react";
import { Ticket, Location, Profile, TicketStatus } from "@/types/database";
import { getStatusBadgeColor, formatDate } from "@/lib/utils";
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  Eye,
  X,
  Loader2,
  AlertTriangle,
  Lock,
  Send,
  UserCheck,
  MessageSquarePlus,
  ShieldCheck,
  Search,
  Filter,
} from "lucide-react";
import TicketDetailDrawer from "@/components/TicketDetailDrawer";
import RefreshButton from "@/components/RefreshButton";
import TicketResponseTimer from "@/components/TicketResponseTimer";
import {
  supervisorTakeoverOrVisitAction,
  reassignTicketAction,
  addTicketCommentAction,
} from "@/app/admin/tickets/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SupervisedTicketsClientProps {
  tickets: Ticket[];
  locations: Location[];
  responders: Profile[];
  supervisors: Profile[];
  userRole?: string;
  currentUserId: string;
}

export default function SupervisedTicketsClient({
  tickets,
  locations,
  responders,
  supervisors,
  userRole = "supervisor",
  currentUserId,
}: SupervisedTicketsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerTicket, setDrawerTicket] = useState<Ticket | null>(null);

  // Quick Action Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [actionType, setActionType] = useState<"visit" | "reassign" | "comment" | null>(null);
  const [targetStatus, setTargetStatus] = useState<TicketStatus>("Visit Date Scheduled");
  const [visitDate, setVisitDate] = useState("");
  const [reassignUserId, setReassignUserId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      search === "" ||
      t.ticket_number.toString().includes(search) ||
      (t.issue_type?.issue_title || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.location?.name || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPI counts
  const totalHandled = tickets.length;
  const visitScheduledCount = tickets.filter((t) => t.status === "Visit Date Scheduled").length;
  const visitedCount = tickets.filter((t) => t.status === "Visited").length;
  const resolvedCount = tickets.filter((t) => t.status === "Issue Resolved").length;

  function openVisitModal(ticket: Ticket, newStatus: TicketStatus) {
    setSelectedTicket(ticket);
    setActionType("visit");
    setTargetStatus(newStatus);
    setVisitDate(
      ticket.scheduled_visit_date
        ? new Date(ticket.scheduled_visit_date).toISOString().slice(0, 16)
        : ""
    );
    setRemarks("");
  }

  function openReassignModal(ticket: Ticket) {
    setSelectedTicket(ticket);
    setActionType("reassign");
    setReassignUserId("");
    setRemarks("");
  }

  function openCommentModal(ticket: Ticket) {
    setSelectedTicket(ticket);
    setActionType("comment");
    setRemarks("");
  }

  async function handleVisitSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!remarks.trim()) {
      toast.error("Transition remarks are mandatory!");
      return;
    }

    setLoading(true);
    const res = await supervisorTakeoverOrVisitAction(
      selectedTicket.id,
      targetStatus,
      remarks,
      visitDate || null
    );
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setSelectedTicket(null);
      setActionType(null);
      router.refresh();
    }
  }

  async function handleReassignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!reassignUserId) {
      toast.error("Please select an assignee!");
      return;
    }
    if (!remarks.trim()) {
      toast.error("Reassignment reason is mandatory!");
      return;
    }

    setLoading(true);
    const res = await reassignTicketAction(selectedTicket.id, reassignUserId, remarks);
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setSelectedTicket(null);
      setActionType(null);
      router.refresh();
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!remarks.trim()) {
      toast.error("Comment cannot be empty!");
      return;
    }

    setLoading(true);
    const res = await addTicketCommentAction(selectedTicket.id, remarks);
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setSelectedTicket(null);
      setActionType(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Field Supervisor Command Center
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white">
              Supervised Queue
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            My Handled Complaints ({totalHandled})
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Complaints escalated and taken over by you. Monitor scheduled fueling site visits, update progress, and resolve issues.
          </p>
        </div>

        {/* Quick KPI Badges */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-center min-w-[90px]">
            <span className="text-[10px] font-semibold text-slate-300 uppercase block">Total</span>
            <span className="text-lg font-extrabold text-white">{totalHandled}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-center min-w-[90px]">
            <span className="text-[10px] font-semibold text-indigo-300 uppercase block">Visits</span>
            <span className="text-lg font-extrabold text-indigo-300">{visitScheduledCount}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-center min-w-[90px]">
            <span className="text-[10px] font-semibold text-purple-300 uppercase block">Visited</span>
            <span className="text-lg font-extrabold text-purple-300">{visitedCount}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-center min-w-[90px]">
            <span className="text-[10px] font-semibold text-emerald-300 uppercase block">Resolved</span>
            <span className="text-lg font-extrabold text-emerald-300">{resolvedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ticket #, issue, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          >
            <option value="all">All Handled ({tickets.length})</option>
            <option value="Pending">Pending</option>
            <option value="Visit Date Scheduled">Visit Scheduled</option>
            <option value="Visited">Visited</option>
            <option value="Issue Resolved">Issue Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <RefreshButton />
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm text-slate-400 text-xs">
            No complaints currently taken over by you matching the selected filters.
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const title =
              ticket.issue_type?.issue_title || ticket.custom_issue_title || "IT Support Request";
            const visitPassed =
              ticket.scheduled_visit_date && new Date() >= new Date(ticket.scheduled_visit_date);
            const isClosed = ticket.status === "Closed" || ticket.status === "Permanently Closed";

            return (
              <div
                key={ticket.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4"
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
                      {ticket.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      <Lock className="w-2.5 h-2.5 text-amber-700" /> Supervised by You
                    </span>
                    {ticket.location?.name && (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {ticket.location.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <TicketResponseTimer ticket={ticket} />
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <h3 className="font-bold text-[#0F172A] text-base">{title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{ticket.description}</p>

                    {ticket.scheduled_visit_date && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          visitPassed
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" /> Scheduled Visit:{" "}
                        {formatDate(ticket.scheduled_visit_date)}
                        {visitPassed && " (Time Passed)"}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setDrawerTicket(ticket)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Details & Audit
                    </button>

                    {!isClosed && (
                      <>
                        {/* Schedule Visit */}
                        <button
                          onClick={() => openVisitModal(ticket, "Visit Date Scheduled")}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {ticket.status === "Visit Date Scheduled" ? "Reschedule" : "Schedule Visit"}
                        </button>

                        {/* Mark Visited */}
                        {ticket.status === "Visit Date Scheduled" && (
                          <button
                            onClick={() => openVisitModal(ticket, "Visited")}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Visited
                          </button>
                        )}

                        {/* Mark Resolved */}
                        {(ticket.status === "Visit Date Scheduled" ||
                          ticket.status === "Visited" ||
                          ticket.status === "Pending") && (
                          <button
                            onClick={() => openVisitModal(ticket, "Issue Resolved")}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Resolved
                          </button>
                        )}

                        {/* Reassign to IT Responder */}
                        <button
                          onClick={() => openReassignModal(ticket)}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Reassign
                        </button>

                        {/* Comment */}
                        <button
                          onClick={() => openCommentModal(ticket)}
                          className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5 text-slate-500" />
                          Comment
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Action Modal: Visit/Resolution */}
      {selectedTicket && actionType === "visit" && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Update Ticket #{selectedTicket.ticket_number}: {targetStatus}
              </h3>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVisitSubmit} className="space-y-4 mt-4 text-xs">
              {targetStatus === "Visit Date Scheduled" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Scheduled Visit Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Supervisor Remarks *
                </label>
                <textarea
                  required
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter details of your visit or resolution steps..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTicket(null);
                    setActionType(null);
                  }}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Save Status Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Action Modal: Reassign */}
      {selectedTicket && actionType === "reassign" && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                Reassign Ticket #{selectedTicket.ticket_number}
              </h3>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                ⚠️ Reassigning will restart the countdown timer for the new assignee.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select IT Responder *
                </label>
                <select
                  required
                  value={reassignUserId}
                  onChange={(e) => setReassignUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                >
                  <option value="">-- Choose IT Responder --</option>
                  {responders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} ({r.email}) {r.is_on_leave ? "— [ON LEAVE]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Reassignment *
                </label>
                <textarea
                  required
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Explain why this complaint is being reassigned..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTicket(null);
                    setActionType(null);
                  }}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Action Modal: Comment */}
      {selectedTicket && actionType === "comment" && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-slate-700" />
                Add Comment to Ticket #{selectedTicket.ticket_number}
              </h3>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCommentSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Comment / Operational Note *
                </label>
                <textarea
                  required
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks, directions, or notes for the audit timeline..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTicket(null);
                    setActionType(null);
                  }}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Post Comment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Drawer */}
      {drawerTicket && (
        <TicketDetailDrawer
          ticket={drawerTicket}
          userRole={userRole}
          responders={responders}
          supervisors={supervisors}
          onClose={() => setDrawerTicket(null)}
        />
      )}
    </div>
  );
}
