"use client";

import { useState } from "react";
import { Ticket } from "@/types/database";
import { getStatusBadgeColor, getComplexityBadgeColor, formatDate } from "@/lib/utils";
import { X, MapPin, User, Clock, Award, Calendar, AlertTriangle, MessageSquare, ShieldCheck, Wrench, Camera } from "lucide-react";
import AuditTimeline from "@/components/AuditTimeline";
import ImageLightboxModal from "@/components/ImageLightboxModal";

export default function TicketDetailDrawer({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const issueTitle =
    ticket.issue_type?.issue_title || ticket.custom_issue_title || "General Issue";

  const logs = ticket.ticket_logs || [];

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

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
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
              <span className="text-[10px] uppercase font-semibold text-slate-400">Assigned Responder</span>
              <div className="flex items-center gap-1.5 font-medium text-slate-800 mt-0.5">
                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                <span>{ticket.assigned_responder?.full_name || "Unassigned"}</span>
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

          {/* Photo Evidence / Attachments Section (Rendered ONLY if images exist) */}
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0F172A] text-[#F8FAFC] text-xs font-semibold rounded-lg shadow"
          >
            Close Panel
          </button>
        </div>
      </div>

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
