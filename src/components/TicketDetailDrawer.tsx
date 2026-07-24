"use client";

import { Ticket } from "@/types/database";
import { getStatusBadgeColor, getComplexityBadgeColor, formatDate } from "@/lib/utils";
import { X, MapPin, User, Clock, Award, Calendar, AlertTriangle, MessageSquare, ShieldCheck, Wrench } from "lucide-react";

export default function TicketDetailDrawer({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
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

          {/* Ticket Logs & Remarks Activity History */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Action & Remarks Timeline ({logs.length})
            </h3>

            {logs.length === 0 ? (
              <p className="text-slate-400 italic">No activity logs recorded yet.</p>
            ) : (
              <div className="relative pl-4 border-l-2 border-slate-200 space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="relative group">
                    {/* Circle Dot */}
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#0F172A] border-2 border-white ring-2 ring-slate-100" />

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#0F172A]">
                          {log.actor?.full_name || "System"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(log.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-200 text-[#0F172A] font-bold text-[10px]">
                          → {log.new_status}
                        </span>
                        {log.visit_date && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            Visit: {formatDate(log.visit_date)}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                        {log.remarks}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold rounded-lg shadow"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
