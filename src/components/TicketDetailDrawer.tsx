"use client";

import { useState, useEffect, useCallback } from "react";
import { Ticket, Profile, TicketStatus, TicketLog } from "@/types/database";
import { getStatusBadgeColor, formatDate } from "@/lib/utils";
import {
  X,
  MapPin,
  User,
  Clock,
  Award,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Wrench,
  Camera,
  Lock,
  RotateCcw,
  CheckCircle2,
  Send,
  Loader2,
  ShieldCheck,
  UserCheck,
  MessageSquarePlus,
  RefreshCw,
  Star,
} from "lucide-react";
import AuditTimeline from "@/components/AuditTimeline";
import ImageLightboxModal from "@/components/ImageLightboxModal";
import {
  supervisorTakeoverOrVisitAction,
  reassignTicketAction,
  addTicketCommentAction,
} from "@/app/admin/tickets/actions";
import { supervisorRateAndCloseAction } from "@/app/tickets/actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { TICKET_POLICY } from "@/lib/config";

interface TicketDetailDrawerProps {
  ticket: Ticket;
  onClose: () => void;
  userRole?: string;
  responders?: Profile[];
  supervisors?: Profile[];
}

export default function TicketDetailDrawer({
  ticket,
  onClose,
  userRole = "admin",
  responders = [],
  supervisors = [],
}: TicketDetailDrawerProps) {
  const router = useRouter();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Live real-time logs state
  const [logs, setLogs] = useState<TicketLog[]>(ticket.ticket_logs || []);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Available assignees state (fallback to fetched profiles if props are empty)
  const [availableResponders, setAvailableResponders] = useState<Profile[]>(responders);
  const [availableSupervisors, setAvailableSupervisors] = useState<Profile[]>(supervisors);

  // Action Modals State
  const [activeModal, setActiveModal] = useState<"visit" | "reassign" | "comment" | "supervisor_rate" | null>(null);
  const [supervisorRatingVal, setSupervisorRatingVal] = useState(5);
  const [targetStatus, setTargetStatus] = useState<TicketStatus>("Visit Date Scheduled");
  const [visitDate, setVisitDate] = useState(
    ticket.scheduled_visit_date
      ? new Date(ticket.scheduled_visit_date).toISOString().slice(0, 16)
      : ""
  );
  const [reassignUserId, setReassignUserId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const issueTitle =
    ticket.issue_type?.issue_title || ticket.custom_issue_title || "General Issue";

  const isClosed = ticket.status === "Closed" || ticket.status === "Permanently Closed";
  const isSuperAdmin = userRole === "admin";
  const isSupervisorRole = userRole === "supervisor";
  const isLineManagerRole = userRole === "line_manager";
  const isHodRole = userRole === "hod";

  // Actions based on strict hierarchy rules:
  // - Supervisor & Super Admin can take operational actions (Schedule Visit, Mark Visited, Mark Resolved)
  // - HOD and Line Manager only have Reassign and Comment options (no operational visit/resolution)
  const canSupervisorAct = (isSupervisorRole || isSuperAdmin) && !isClosed;
  const canLineManagerOrHodAct = (isLineManagerRole || isHodRole || isSuperAdmin || isSupervisorRole) && !isClosed;
  const canComment = ["supervisor", "line_manager", "hod", "admin"].includes(userRole);

  // 1. Fetch fresh logs & Realtime subscription
  const fetchFreshLogs = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ticket_logs")
        .select("*, actor:profiles!actor_id(full_name, role)")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setLogs(data as TicketLog[]);
      }
    } catch (e) {
      console.error("Error fetching fresh logs:", e);
    }
  }, [ticket.id]);

  useEffect(() => {
    fetchFreshLogs();

    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-logs-drawer-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_logs",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        () => {
          fetchFreshLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.id, fetchFreshLogs]);

  // 2. Fetch assignees if empty
  useEffect(() => {
    async function loadAssignees() {
      const supabase = createClient();
      if (availableResponders.length === 0) {
        const { data: resData } = await supabase
          .from("profiles")
          .select("*")
          .eq("role", "responder")
          .order("full_name");
        if (resData) setAvailableResponders(resData as Profile[]);
      }

      if (availableSupervisors.length === 0) {
        const { data: supData } = await supabase
          .from("profiles")
          .select("*")
          .eq("role", "supervisor")
          .order("full_name");
        if (supData) setAvailableSupervisors(supData as Profile[]);
      }
    }
    loadAssignees();
  }, [availableResponders.length, availableSupervisors.length]);

  // Handlers
  async function handleSupervisorVisitSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!remarks.trim()) {
      toast.error("Transition remarks are mandatory!");
      return;
    }

    setSubmitting(true);
    const res = await supervisorTakeoverOrVisitAction(
      ticket.id,
      targetStatus,
      remarks,
      visitDate || null
    );
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setActiveModal(null);
      setRemarks("");
      await fetchFreshLogs();
      router.refresh();
      onClose();
    }
  }

  async function handleReassignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reassignUserId) {
      toast.error("Please select a user to reassign to!");
      return;
    }
    if (!remarks.trim()) {
      toast.error("Reassignment reason/remarks are mandatory!");
      return;
    }

    setSubmitting(true);
    const res = await reassignTicketAction(ticket.id, reassignUserId, remarks);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setActiveModal(null);
      setRemarks("");
      setReassignUserId("");
      await fetchFreshLogs();
      router.refresh();
      onClose();
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!remarks.trim()) {
      toast.error("Comment cannot be empty!");
      return;
    }

    setSubmitting(true);
    const res = await addTicketCommentAction(ticket.id, remarks);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setActiveModal(null);
      setRemarks("");
      await fetchFreshLogs();
      router.refresh();
    }
  }

  const ratedAtTimestamp = ticket.site_manager_rated_at || ticket.closed_at || ticket.updated_at;
  const hoursElapsed = ratedAtTimestamp
    ? (Date.now() - new Date(ratedAtTimestamp).getTime()) / (1000 * 60 * 60)
    : 999;
  const isReopenWindowPassed = hoursElapsed >= TICKET_POLICY.REOPEN_WINDOW_HOURS;
  const hoursRemaining = Math.max(0, TICKET_POLICY.REOPEN_WINDOW_HOURS - hoursElapsed);

  async function handleSupervisorRateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (userRole !== "supervisor") {
      toast.error("Only Field Supervisors can rate and permanently close complaints (not even Admins).");
      return;
    }
    if (!isReopenWindowPassed) {
      toast.error(
        `Reopening window is active (${Math.ceil(hoursRemaining)}h remaining). Rating unlocks once the ${TICKET_POLICY.REOPEN_WINDOW_HOURS}-hour window expires without being re-opened.`
      );
      return;
    }

    setSubmitting(true);
    const res = await supervisorRateAndCloseAction(ticket.id, supervisorRatingVal, remarks);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message);
      setActiveModal(null);
      await fetchFreshLogs();
      router.refresh();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-extrabold text-[#0F172A] tracking-wider uppercase">
                Ticket #{ticket.ticket_number}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeColor(
                  ticket.status
                )}`}
              >
                {ticket.status}
              </span>
              {ticket.escalation_level && ticket.escalation_level > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  Level {ticket.escalation_level} Escalated
                </span>
              ) : null}
            </div>
            <h2 className="text-lg font-bold text-[#0F172A] leading-snug">
              {issueTitle}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar for Administrative Roles */}
        {!isClosed && (canSupervisorAct || canLineManagerOrHodAct || canComment) && (
          <div className="px-6 py-3 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Actions ({userRole.replace("_", " ").toUpperCase()}):</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Supervisor & Super Admin Operational Actions */}
              {canSupervisorAct && (
                <>
                  <button
                    onClick={() => {
                      setTargetStatus("Visit Date Scheduled");
                      setActiveModal("visit");
                      setRemarks("");
                    }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" /> Schedule Visit
                  </button>

                  <button
                    onClick={() => {
                      setTargetStatus("Visited");
                      setActiveModal("visit");
                      setRemarks("");
                    }}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Mark Visited
                  </button>

                  <button
                    onClick={() => {
                      setTargetStatus("Issue Resolved");
                      setActiveModal("visit");
                      setRemarks("");
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                  </button>
                </>
              )}

              {/* Reassign Action (Supervisor: Responders only; Line Manager / HOD / Admin: Responders or Supervisors) */}
              {canLineManagerOrHodAct && (
                <button
                  onClick={() => {
                    setActiveModal("reassign");
                    setRemarks("");
                    setReassignUserId("");
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                >
                  <UserCheck className="w-3 h-3" /> Reassign
                </button>
              )}

              {/* Add Comment */}
              {canComment && (
                <button
                  onClick={() => {
                    setActiveModal("comment");
                    setRemarks("");
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                >
                  <MessageSquarePlus className="w-3 h-3 text-slate-500" /> Comment
                </button>
              )}

              {/* Field Supervisor Permanent Close & Rate Action */}
              {(ticket.status === "Awaiting Supervisor Approval" || ticket.status === "Awaiting Admin Approval") && (
                userRole === "supervisor" ? (
                  isReopenWindowPassed ? (
                    <button
                      onClick={() => {
                        setActiveModal("supervisor_rate");
                        setSupervisorRatingVal(5);
                        setRemarks("");
                      }}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                    >
                      <Star className="w-3 h-3 fill-white" /> Rate & Close Forever
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-700" /> Reopen Window ({Math.ceil(hoursRemaining)}h left)
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 bg-slate-200/80 text-slate-600 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-500" />
                    {userRole === "admin" ? "Overview Only (Supervisor Only Action)" : "Overview Only"}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Lockout Notice Banner */}
          {ticket.locked_for_responder && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-950">
              <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-extrabold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  Locked for Responder (Supervisor Handled)
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  This complaint has been escalated and operational action has been taken by a Supervisor. IT Responder controls are locked, previous pending points have been reversed, and an SLA penalty was applied.
                </p>
              </div>
            </div>
          )}

          {/* Metadata Badges & Site Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Location</span>
              <div className="flex items-center gap-1.5 font-bold text-[#0F172A] mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{ticket.location?.name}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Category / Points</span>
              <div className="flex items-center gap-1.5 font-bold text-amber-700 mt-0.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>{ticket.points_awarded || 20} Points</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Complainant</span>
              <div className="flex items-center gap-1.5 font-medium text-slate-800 mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{ticket.complainant?.full_name || "Staff User"}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Assigned Handler</span>
              <div className="flex items-center gap-1.5 font-medium text-slate-800 mt-0.5">
                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {ticket.assigned_responder?.full_name || "Unassigned"}
                  {ticket.locked_for_responder ? " (Supervised)" : ""}
                </span>
              </div>
            </div>

            {ticket.scheduled_visit_date && (
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Scheduled Visit Date</span>
                <div className="flex items-center gap-1.5 font-bold text-indigo-700 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{formatDate(ticket.scheduled_visit_date)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Description Section */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> Issue Description
            </h3>
            <div className="p-4 bg-white border border-slate-200 rounded-xl leading-relaxed text-slate-800 whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          {/* Photo Evidence / Attachments Section */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-purple-600" /> Photo Evidence / Attachments ({ticket.attachments.length})
              </h3>
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {ticket.attachments.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxUrl(imgUrl)}
                    className="relative w-28 h-28 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all group block text-left"
                  >
                    <img
                      src={imgUrl}
                      alt={`Attachment ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px]">
                      View Image
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Separated Ratings Section: Site Manager & Field Supervisor */}
          {(ticket.site_manager_rating || ticket.closure_rating || ticket.supervisor_rating || ticket.status === "Awaiting Supervisor Approval" || ticket.status === "Awaiting Admin Approval") && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h3 className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> Quality & Service Evaluation
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Site Manager Rating */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Site Manager Rating</span>
                    {ticket.site_manager_rated_at && (
                      <span className="text-[10px] text-slate-400">{formatDate(ticket.site_manager_rated_at)}</span>
                    )}
                  </div>
                  {ticket.site_manager_rating || ticket.closure_rating ? (
                    <div>
                      <div className="flex items-center gap-1 text-amber-600 font-extrabold text-sm">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span>{ticket.site_manager_rating || ticket.closure_rating} / 5 Stars</span>
                      </div>
                      {(ticket.site_manager_remarks || ticket.closure_remarks) && (
                        <p className="text-xs text-slate-600 italic mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                          &quot;{ticket.site_manager_remarks || ticket.closure_remarks}&quot;
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Not rated by Site Manager yet</p>
                  )}
                </div>

                {/* Field Supervisor Rating */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-indigo-600">Field Supervisor Rating</span>
                    {ticket.supervisor_rated_at && (
                      <span className="text-[10px] text-slate-400">{formatDate(ticket.supervisor_rated_at)}</span>
                    )}
                  </div>
                  {ticket.supervisor_rating ? (
                    <div>
                      <div className="flex items-center gap-1 text-indigo-700 font-extrabold text-sm">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        <span>{ticket.supervisor_rating} / 5 Stars (Permanently Closed)</span>
                      </div>
                      {ticket.supervisor_remarks && (
                        <p className="text-xs text-slate-600 italic mt-1 bg-indigo-50/50 p-2 rounded border border-indigo-100">
                          &quot;{ticket.supervisor_remarks}&quot;
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-0.5">
                      <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {!isReopenWindowPassed
                          ? `Reopen window active (${Math.ceil(hoursRemaining)}h left) • Rating unlocks soon`
                          : "Pending Field Supervisor Evaluation"}
                      </p>
                      {userRole === "supervisor" && !isClosed && (
                        isReopenWindowPassed ? (
                          <button
                            onClick={() => {
                              setActiveModal("supervisor_rate");
                              setSupervisorRatingVal(5);
                              setRemarks("");
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all flex items-center gap-1"
                          >
                            <Award className="w-3 h-3" /> Rate & Permanently Close
                          </button>
                        ) : (
                          <button
                            disabled
                            title={`Rating unlocks after the ${TICKET_POLICY.REOPEN_WINDOW_HOURS}-hour reopening window passes without being re-opened (${Math.ceil(hoursRemaining)}h remaining).`}
                            className="px-3 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-[11px] font-semibold cursor-not-allowed flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3 text-slate-400" /> Unlocks in {Math.ceil(hoursRemaining)}h
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ticket Logs & Remarks Activity History with Real-Time Updates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Live Timeline ({logs.length} events)
              </span>
              <button
                onClick={fetchFreshLogs}
                title="Refresh audit timeline"
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <AuditTimeline logs={logs} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Escalation Level: <strong>{ticket.escalation_level ?? 0}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0F172A] text-[#F8FAFC] text-xs font-semibold rounded-lg shadow hover:bg-slate-800 transition-all"
          >
            Close Panel
          </button>
        </div>
      </div>

      {/* MODAL 1: Supervisor Operational Action (Visit / Resolution) */}
      {activeModal === "visit" && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Supervisor Action: {targetStatus}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSupervisorVisitSubmit} className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                ⚠️ <strong>Lockout Notice:</strong> Taking supervisor action will permanently lock this complaint from the IT Responder, reverse their pending points, and apply an SLA penalty (-15 pts).
              </div>

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
                  Supervisor Remarks & Plan of Action *
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
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Confirm & Lock Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reassign Complaint Modal */}
      {activeModal === "reassign" && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                Reassign Complaint #{ticket.ticket_number}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                ⚠️ <strong>Points & Penalty:</strong> Pending points will be reversed from the current handler and an SLA penalty (-15 pts) will be applied. The new assignee&apos;s response timer will start fresh.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select New Assignee *
                </label>
                <select
                  required
                  value={reassignUserId}
                  onChange={(e) => setReassignUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                >
                  <option value="">-- Choose New Assignee --</option>
                  <optgroup label="IT Responders">
                    {availableResponders
                      .filter((r) => r.id !== ticket.assigned_responder_id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} ({r.email}) {r.is_on_leave ? "— [ON LEAVE]" : ""}
                        </option>
                      ))}
                  </optgroup>

                  {/* Line Manager, HOD & Admin can also select from Supervisors */}
                  {!isSupervisorRole && availableSupervisors.length > 0 && (
                    <optgroup label="Supervisors">
                      {availableSupervisors
                        .filter((s) => s.id !== ticket.assigned_responder_id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            Supervisor: {s.full_name} ({s.email})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                {isSupervisorRole && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Field Supervisors can reassign complaints to IT Responders only.
                  </p>
                )}
                {!isSupervisorRole && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Line Managers, HODs, and Super Admins can reassign to either an IT Responder or a Supervisor.
                  </p>
                )}
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
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Administrative Comment */}
      {activeModal === "comment" && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-slate-700" />
                Add Comment to Ticket #{ticket.ticket_number}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
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
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Post Comment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Field Supervisor Rating & Permanent Closure Modal */}
      {activeModal === "supervisor_rate" && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                Field Supervisor Rating & Permanent Closure
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Site Manager Reference Card */}
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-amber-800">
                Site Manager Feedback Reference
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-900">
                  {ticket.site_manager_rating || ticket.closure_rating || 5} Stars
                </span>
                <span className="text-slate-600 italic">
                  &quot;{ticket.site_manager_remarks || ticket.closure_remarks || "No remarks"}&quot;
                </span>
              </div>
            </div>

            <form onSubmit={handleSupervisorRateSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-center font-bold text-slate-700 uppercase mb-2">
                  Field Supervisor Evaluation Star Rating
                </label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSupervisorRatingVal(star)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          supervisorRatingVal >= star
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center font-bold text-slate-600 mt-1">
                  {supervisorRatingVal === 5 && "⭐ 5 Stars — Excellent Resolution"}
                  {supervisorRatingVal === 4 && "👍 4 Stars — Good Support"}
                  {supervisorRatingVal === 3 && "😐 3 Stars — Satisfactory"}
                  {supervisorRatingVal === 2 && "👎 2 Stars — Needs Improvement"}
                  {supervisorRatingVal === 1 && "⚠️ 1 Star — Unsatisfactory"}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Field Supervisor Remarks
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Final quality audit and permanent closure notes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Points Crediting (Multiplier Eliminated)
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span>Base Points:</span>
                  <span className="font-bold">+{ticket.issue_type?.base_points || ticket.points_pending || 20} pts</span>
                </div>
                {ticket.sla_breached && (
                  <div className="flex items-center justify-between text-xs text-rose-600">
                    <span>SLA Penalty:</span>
                    <span className="font-bold">-15 pts</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700 pt-1 border-t border-slate-200">
                  <span>Confirmed Points:</span>
                  <span>
                    +{Math.max(
                      0,
                      (ticket.issue_type?.base_points || ticket.points_pending || 20) -
                        (ticket.sla_breached ? 15 : 0)
                    )} pts
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                  Rate & Permanently Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full screen image lightbox preview modal */}
      {lightboxUrl && (
        <ImageLightboxModal
          imageUrl={lightboxUrl}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </div>
  );
}
