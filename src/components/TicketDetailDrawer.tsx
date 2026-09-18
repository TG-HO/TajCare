"use client";

import { useState } from "react";
import { Ticket, Profile, TicketStatus } from "@/types/database";
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
} from "lucide-react";
import AuditTimeline from "@/components/AuditTimeline";
import ImageLightboxModal from "@/components/ImageLightboxModal";
import {
  supervisorTakeoverOrVisitAction,
  reassignTicketAction,
  addTicketCommentAction,
} from "@/app/admin/tickets/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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

  // Action Modals State
  const [activeModal, setActiveModal] = useState<"visit" | "reassign" | "comment" | null>(null);
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

  const logs = ticket.ticket_logs || [];

  const isClosed = ticket.status === "Closed" || ticket.status === "Permanently Closed";
  const isSupervisorRole = userRole === "supervisor";
  const isLineManagerRole = userRole === "line_manager";
  const isAdminOrHod = userRole === "admin" || userRole === "hod";

  // Allowed actions based on hierarchy
  const canSupervisorAct = (isSupervisorRole || isAdminOrHod) && !isClosed;
  const canLineManagerAct = (isLineManagerRole || isAdminOrHod) && !isClosed;
  const canComment = ["supervisor", "line_manager", "hod", "admin"].includes(userRole);

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
      router.refresh();
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
              {ticket.escalation_level && ticket.escalation_level > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  Level {ticket.escalation_level} Escalated
                </span>
              )}
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
        {!isClosed && (canSupervisorAct || canLineManagerAct || canComment) && (
          <div className="px-6 py-3 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Escalation Actions ({userRole.replace("_", " ").toUpperCase()}):</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Supervisor Operational Actions */}
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

              {/* Reassign Action (Supervisor can reassign to responder; Line Manager / Admin to responder or supervisor) */}
              {(canSupervisorAct || canLineManagerAct) && (
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

          {/* Ticket Logs & Remarks Activity History */}
          <AuditTimeline logs={logs} />
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
                    {responders
                      .filter((r) => r.id !== ticket.assigned_responder_id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} ({r.email}) {r.is_on_leave ? "— [ON LEAVE]" : ""}
                        </option>
                      ))}
                  </optgroup>
                  {/* Line Manager & Admin can also reassign to Supervisors */}
                  {(isLineManagerRole || isAdminOrHod) && supervisors.length > 0 && (
                    <optgroup label="Supervisors">
                      {supervisors
                        .filter((s) => s.id !== ticket.assigned_responder_id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            Supervisor: {s.full_name} ({s.email})
                          </option>
                        ))}
                    </optgroup>
                  )}
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
