"use client";

import { useState } from "react";
import { Ticket, Profile, Task } from "@/types/database";
import { adminApproveRatingAction } from "@/app/tickets/actions";
import { toast } from "sonner";
import {
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  X,
  Loader2,
  Award,
  Users,
  MapPin,
  Ticket as TicketIcon,
  Plus,
  RotateCw,
  BadgeCheck,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import TicketDetailDrawer from "@/components/TicketDetailDrawer";
import RefreshButton from "@/components/RefreshButton";
import TicketResponseTimer from "@/components/TicketResponseTimer";
import { TICKET_POLICY } from "@/lib/config";

export default function AdminDashboardClient({
  totalUsers,
  responderCount,
  locationCount,
  issueCount,
  awaitingApprovalTickets,
  pendingTickets = [],
  recentTasks,
  userRole = "admin",
  isScopedRole = false,
  responders = [],
  supervisors = [],
}: {
  totalUsers: number;
  responderCount: number;
  locationCount: number;
  issueCount: number;
  awaitingApprovalTickets: Ticket[];
  pendingTickets?: Ticket[];
  recentTasks: Task[];
  userRole?: string;
  isScopedRole?: boolean;
  responders?: Profile[];
  supervisors?: Profile[];
}) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [approvingTicket, setApprovingTicket] = useState<Ticket | null>(null);
  const [finalRating, setFinalRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const isManagementOverviewRole = userRole === "line_manager" || userRole === "hod" || userRole === "admin";
  const canRateAndClose = userRole === "supervisor";

  function handleOpenApproveModal(t: Ticket) {
    if (userRole !== "supervisor") {
      toast.error("Only Field Supervisors can rate and permanently close complaints (not even Admins).");
      return;
    }
    const ratedAt = t.site_manager_rated_at || t.closed_at || t.updated_at;
    const hoursElapsed = ratedAt ? (Date.now() - new Date(ratedAt).getTime()) / (1000 * 60 * 60) : 999;
    if (hoursElapsed < TICKET_POLICY.REOPEN_WINDOW_HOURS) {
      const hoursLeft = Math.ceil(TICKET_POLICY.REOPEN_WINDOW_HOURS - hoursElapsed);
      toast.error(`Reopen window active (${hoursLeft}h remaining). Rating unlocks once the ${TICKET_POLICY.REOPEN_WINDOW_HOURS}-hour window expires without being re-opened.`);
      return;
    }

    setApprovingTicket(t);
    setFinalRating(t.supervisor_rating || t.site_manager_rating || t.closure_rating || 5);
    setRemarks(t.supervisor_remarks || "");
  }

  async function handleApproveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!approvingTicket) return;

    setLoading(true);
    const result = await adminApproveRatingAction(approvingTicket.id, finalRating, remarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setApprovingTicket(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-[#0F172A] to-slate-800 text-white rounded-2xl p-8 shadow-md border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-medium mb-3">
            <BadgeCheck className="w-3.5 h-3.5" />
            {isScopedRole
              ? `${userRole.toUpperCase()} PORTAL • TEAM AUDIT`
              : "Operations & Quality Assurance Control"}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isScopedRole
              ? `${userRole === "supervisor" ? "Field Supervisor" : userRole === "line_manager" ? "Line Manager" : "HOD"} Operations Desk`
              : "Taj Care Operations Control Center"}
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            {isScopedRole
              ? "Monitoring complaints, SLA resolution durations, and visits for your assigned responders."
              : "Review ratings, approve confirmed points, dispatch operational tasks, and log admin complaints."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RefreshButton className="bg-white/10 text-white border-white/20 hover:bg-white/20" />

          <Link
            href="/admin/tickets/new"
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-[#0F172A] text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Log Admin Complaint
          </Link>

          {userRole !== "supervisor" && (
            <Link
              href="/admin/tasks"
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Assign Operational Task
            </Link>
          )}
        </div>
      </div>

      {/* Live Complaint Response Monitor (Hierarchy & Responders) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Live Complaint Response SLA Monitor ({pendingTickets.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live second-by-second countdown for assigned responders and escalation hierarchy. Unresponded tickets auto-escalate upon expiry.
            </p>
          </div>

          <Link
            href="/admin/tickets?status=Pending"
            className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all inline-flex items-center gap-1.5"
          >
            View Master Queue →
          </Link>
        </div>

        {pendingTickets.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-slate-200 rounded-xl bg-slate-50">
            ✓ All active complaints have been responded to by responders!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTickets.map((ticket) => {
              const responderName = ticket.assigned_responder?.full_name || "Unassigned";
              const title =
                ticket.issue_type?.issue_title || ticket.custom_issue_title || "IT Support Ticket";

              return (
                <div
                  key={ticket.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-indigo-300 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-[#0F172A]">
                          #{ticket.ticket_number}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-amber-100 text-amber-800 rounded border border-amber-200">
                          {ticket.status}
                        </span>
                        {ticket.escalation_level && ticket.escalation_level > 0 ? (
                          <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-rose-100 text-rose-800 rounded border border-rose-200">
                            Lvl {ticket.escalation_level}
                          </span>
                        ) : null}
                      </div>

                      <span className="text-[10px] text-slate-400">
                        {formatDate(ticket.created_at)}
                      </span>
                    </div>

                    <h4 className="font-bold text-[#0F172A] text-xs line-clamp-1">{title}</h4>
                    <p className="text-[11px] text-slate-600">
                      Resp: <strong className="text-slate-800">{responderName}</strong> • Site:{" "}
                      <strong>{ticket.location?.name}</strong>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <TicketResponseTimer ticket={ticket} />
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ratings Awaiting Supervisor Approval Management Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              {isManagementOverviewRole
                ? `Complaints Awaiting Field Supervisor Rating (Overview Only) (${awaitingApprovalTickets.length})`
                : userRole === "supervisor"
                ? `Complaints Awaiting Field Supervisor Rating & Closure (${awaitingApprovalTickets.length})`
                : `Complaints Awaiting Rating & Closure (${awaitingApprovalTickets.length})`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isManagementOverviewRole
                ? "Line Managers and HODs have executive overview access. Only Field Supervisors (or Admins) can rate and permanently close complaints."
                : "Review Site Manager feedback, provide Field Supervisor evaluation, and permanently close complaints with confirmed flat points."}
            </p>
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
            {awaitingApprovalTickets.length} Pending
          </span>
        </div>

        {awaitingApprovalTickets.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-slate-200 rounded-xl bg-slate-50">
            No complaints currently awaiting rating review.
          </div>
        ) : (
          <div className="space-y-3">
            {awaitingApprovalTickets.map((ticket) => {
              const responderName = ticket.assigned_responder?.full_name || "Unassigned";
              const title =
                ticket.issue_type?.issue_title || ticket.custom_issue_title || "IT Support Ticket";

              const ratedAt = ticket.site_manager_rated_at || ticket.closed_at || ticket.updated_at;
              const hoursElapsed = ratedAt
                ? (Date.now() - new Date(ratedAt).getTime()) / (1000 * 60 * 60)
                : 999;
              const isReopenWindowPassed = hoursElapsed >= TICKET_POLICY.REOPEN_WINDOW_HOURS;
              const hoursRemaining = Math.max(0, TICKET_POLICY.REOPEN_WINDOW_HOURS - hoursElapsed);

              return (
                <div
                  key={ticket.id}
                  className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-[#0F172A]">
                        #{ticket.ticket_number}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-purple-100 text-purple-800 rounded border border-purple-200">
                        {ticket.status === "Awaiting Supervisor Approval"
                          ? "Awaiting Supervisor Rating"
                          : ticket.status}
                      </span>
                      <span className="text-xs font-bold text-amber-700 flex items-center gap-1 bg-amber-100/60 px-2 py-0.5 rounded border border-amber-200">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        SM Rating: {ticket.site_manager_rating || ticket.closure_rating || 5} Stars
                      </span>
                      {ticket.supervisor_rating && (
                        <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 bg-indigo-100/60 px-2 py-0.5 rounded border border-indigo-200">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          Supervisor: {ticket.supervisor_rating} Stars
                        </span>
                      )}
                      {!isReopenWindowPassed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-700" />
                          Reopen Window: {Math.ceil(hoursRemaining)}h left
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-[#0F172A] text-sm">{title}</h4>
                    <p className="text-xs text-slate-600">
                      Responder: <strong>{responderName}</strong> • Site:{" "}
                      <strong>{ticket.location?.name}</strong>
                    </p>
                    {(ticket.site_manager_remarks || ticket.closure_remarks) && (
                      <p className="text-xs italic text-slate-600 bg-white p-2 rounded border border-amber-100 mt-1">
                        Site Manager: &quot;{ticket.site_manager_remarks || ticket.closure_remarks}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedTicket(ticket)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Timeline
                    </button>
                    {userRole === "supervisor" ? (
                      isReopenWindowPassed ? (
                        <button
                          onClick={() => handleOpenApproveModal(ticket)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Rate & Close Forever
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={`Rating unlocks after the ${TICKET_POLICY.REOPEN_WINDOW_HOURS}-hour reopening window passes without being re-opened (${Math.ceil(hoursRemaining)}h remaining).`}
                          className="px-3.5 py-2 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Unlocks in {Math.ceil(hoursRemaining)}h
                        </button>
                      )
                    ) : (
                      <span className="px-3 py-2 bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        {userRole === "admin" ? "Overview Only (Supervisor Action)" : "Overview Only"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Operations Quick Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isScopedRole ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Assigned Team</span>
              <div className="p-2.5 rounded-xl border bg-blue-50 text-blue-700 border-blue-200">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#0F172A]">{responderCount}</div>
              <p className="text-xs text-slate-500 mt-1">Assigned Responders Under Oversight</p>
            </div>
          </div>
        ) : (
          <Link
            href="/admin/users"
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Users</span>
              <div className="p-2.5 rounded-xl border bg-blue-50 text-blue-700 border-blue-200">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#0F172A]">{totalUsers}</div>
              <p className="text-xs text-slate-500 mt-1">Staff, Managers & Responders</p>
            </div>
          </Link>
        )}

        {isScopedRole ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Assigned Responders</span>
              <div className="p-2.5 rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-200">
                <BadgeCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#0F172A]">{responderCount}</div>
              <p className="text-xs text-slate-500 mt-1">Active field responders</p>
            </div>
          </div>
        ) : (
          <Link
            href="/admin/users?role=responder"
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">IT Responders</span>
              <div className="p-2.5 rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-200">
                <BadgeCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#0F172A]">{responderCount}</div>
              <p className="text-xs text-slate-500 mt-1">Multi-site responders</p>
            </div>
          </Link>
        )}

        <Link
          href="/admin/locations"
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Locations & Sites</span>
            <div className="p-2.5 rounded-xl border bg-purple-50 text-purple-700 border-purple-200">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#0F172A]">{locationCount}</div>
            <p className="text-xs text-slate-500 mt-1">Karachi Fueling Sites & HO</p>
          </div>
        </Link>

        <Link
          href="/admin/tasks"
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Tasks</span>
            <div className="p-2.5 rounded-xl border bg-amber-50 text-amber-700 border-amber-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#0F172A]">{recentTasks.length}</div>
            <p className="text-xs text-slate-500 mt-1">Operational assignments</p>
          </div>
        </Link>
      </div>

      {/* Rating Approval Modal */}
      {approvingTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                Field Supervisor Rating: #{approvingTicket.ticket_number}
              </h3>
              <button onClick={() => setApprovingTicket(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Site Manager Reference Card */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-800">
                Site Manager Evaluation (Reference)
              </span>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-amber-900 text-xs">
                  {approvingTicket.site_manager_rating || approvingTicket.closure_rating || 5} Stars
                </span>
                <span className="text-xs text-amber-800 italic">
                  &quot;{approvingTicket.site_manager_remarks || approvingTicket.closure_remarks || "No feedback remarks"}&quot;
                </span>
              </div>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-center font-bold text-slate-700 uppercase mb-2">
                  Field Supervisor Evaluation Star Rating
                </label>
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFinalRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          (hoverRating || finalRating) >= star
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center font-bold text-slate-600 mt-1">
                  {finalRating === 5 && "⭐ 5 Stars — Excellent Resolution"}
                  {finalRating === 4 && "👍 4 Stars — Good Support"}
                  {finalRating === 3 && "😐 3 Stars — Satisfactory"}
                  {finalRating === 2 && "👎 2 Stars — Needs Improvement"}
                  {finalRating === 1 && "⚠️ 1 Star — Unsatisfactory"}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Field Supervisor Closure Remarks
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Final quality audit and permanent closure notes..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              {/* Points calculation preview: flat points with multiplier eliminated */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Points Crediting (Multiplier Eliminated)
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span>Base Points (Complexity):</span>
                  <span className="font-bold">
                    +{approvingTicket.issue_type?.base_points || approvingTicket.points_pending || 20} pts
                  </span>
                </div>
                {approvingTicket.sla_breached && (
                  <div className="flex items-center justify-between text-xs text-rose-600">
                    <span>SLA Breach Penalty:</span>
                    <span className="font-bold">-15 pts</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700 pt-1 border-t border-slate-200">
                  <span>Confirmed Points:</span>
                  <span>
                    +{Math.max(
                      0,
                      (approvingTicket.issue_type?.base_points || approvingTicket.points_pending || 20) -
                        (approvingTicket.sla_breached ? 15 : 0)
                    )} pts
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApprovingTicket(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Rate & Permanently Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Drawer */}
      {selectedTicket && (
        <TicketDetailDrawer
          ticket={selectedTicket}
          userRole={userRole}
          responders={responders}
          supervisors={supervisors}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
