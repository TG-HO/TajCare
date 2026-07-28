"use client";

import { TicketLog, TaskLog } from "@/types/database";
import { formatDate, getRoleBadgeColor, getStatusBadgeColor } from "@/lib/utils";
import { Clock, User, ShieldCheck, CheckCircle2, ArrowDown, MessageSquare } from "lucide-react";

interface AuditTimelineProps {
  logs?: (TicketLog | TaskLog)[];
}

export default function AuditTimeline({ logs }: AuditTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
        No activity logs recorded yet.
      </div>
    );
  }

  // Sort chronologically ascending
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
  );

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
        <Clock className="w-4 h-4 text-indigo-600" /> Activity Timeline & Audit Trail
      </h4>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {sortedLogs.map((log, index) => {
          const actor = log.actor;
          const actorName = actor?.full_name || "System User";
          const actorRole = actor?.role || "user";
          const createdAt = log.created_at;

          // Compute time elapsed since previous log entry
          let timeElapsed = "";
          if (index > 0 && sortedLogs[index - 1].created_at && createdAt) {
            const prevTime = new Date(sortedLogs[index - 1].created_at!).getTime();
            const currTime = new Date(createdAt).getTime();
            const diffMinutes = Math.max(0, Math.floor((currTime - prevTime) / (1000 * 60)));

            if (diffMinutes < 1) {
              timeElapsed = "< 1 min after";
            } else if (diffMinutes < 60) {
              timeElapsed = `+${diffMinutes} mins after`;
            } else {
              const diffHours = (diffMinutes / 60).toFixed(1);
              timeElapsed = `+${diffHours} hrs after`;
            }
          }

          return (
            <div key={log.id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center shadow-sm">
                <div className="w-2 h-2 rounded-full bg-indigo-600" />
              </div>

              {/* Content Box */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-slate-300 transition-all space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#0F172A]">{actorName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getRoleBadgeColor(
                        actorRole
                      )}`}
                    >
                      {actorRole.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {timeElapsed && (
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                        {timeElapsed}
                      </span>
                    )}
                    <span>{formatDate(createdAt)}</span>
                  </div>
                </div>

                {/* Transition Status */}
                <div className="flex items-center gap-2 text-xs">
                  {log.previous_status && (
                    <>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {log.previous_status}
                      </span>
                      <ArrowDown className="w-3 h-3 -rotate-90 text-slate-400" />
                    </>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeColor(
                      log.new_status
                    )}`}
                  >
                    {log.new_status}
                  </span>
                </div>

                {/* Remarks */}
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>{log.remarks}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
