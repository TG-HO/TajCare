"use client";

import { useEffect, useState, useRef } from "react";
import { Clock, AlertTriangle, Flame, CheckCircle2, ShieldAlert } from "lucide-react";
import { Ticket } from "@/types/database";

interface TicketResponseTimerProps {
  ticket: Ticket;
  isResponderView?: boolean;
  className?: string;
}

export default function TicketResponseTimer({
  ticket,
  isResponderView = false,
  className = "",
}: TicketResponseTimerProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [hasTriggeredEscalation, setHasTriggeredEscalation] = useState<boolean>(false);
  const triggerRef = useRef<boolean>(false);

  // If ticket is already responded/handled, response phase is over
  const isPending = ticket.status === "Pending";

  useEffect(() => {
    setMounted(true);
    if (!isPending) return;

    // Update every second
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isPending]);

  if (!isPending) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 ${className}`}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Responded
      </span>
    );
  }

  // Predefined issue SLAs
  const issue = ticket.issue_type as any;
  const resHours = issue?.resolution_time_hours ?? 24;
  const resMins = issue?.resolution_time_minutes ?? 0;
  const totalResolutionMinutes = resHours * 60 + resMins;

  const defaultStep =
    totalResolutionMinutes <= 240
      ? Math.max(15, Math.floor(totalResolutionMinutes / 4))
      : 120; // 2 hours default

  const responderMins =
    issue?.responder_response_hours !== undefined && issue?.responder_response_hours !== null
      ? issue.responder_response_hours * 60 + (issue.responder_response_minutes ?? 0)
      : defaultStep;

  const supervisorMins =
    issue?.supervisor_response_hours !== undefined && issue?.supervisor_response_hours !== null
      ? issue.supervisor_response_hours * 60 + (issue.supervisor_response_minutes ?? 0)
      : defaultStep;

  const lineManagerMins =
    issue?.line_manager_response_hours !== undefined && issue?.line_manager_response_hours !== null
      ? issue.line_manager_response_hours * 60 + (issue.line_manager_response_minutes ?? 0)
      : defaultStep;

  const createdAt = new Date(ticket.created_at || Date.now()).getTime();
  const currentLevel = ticket.escalation_level || 0;

  // Calculate target deadline for current level
  let targetDeadline = createdAt + responderMins * 60 * 1000;
  let stageName = isResponderView ? "Time to Respond" : "Responder Window";
  let nextStage = "Supervisor";

  if (currentLevel === 1) {
    const baseTime = ticket.last_escalated_at
      ? new Date(ticket.last_escalated_at).getTime()
      : createdAt + responderMins * 60 * 1000;
    targetDeadline = baseTime + supervisorMins * 60 * 1000;
    stageName = "Supervisor Window";
    nextStage = "Line Manager";
  } else if (currentLevel === 2) {
    const baseTime = ticket.last_escalated_at
      ? new Date(ticket.last_escalated_at).getTime()
      : createdAt + (responderMins + supervisorMins) * 60 * 1000;
    targetDeadline = baseTime + lineManagerMins * 60 * 1000;
    stageName = "Line Mgr Window";
    nextStage = "HOD & Admin";
  } else if (currentLevel >= 3) {
    stageName = "HOD & Admin Escalated";
  }

  const remainingMs = targetDeadline - now;
  const isOverdue = remainingMs <= 0;

  // Trigger background escalation when timer hits zero
  useEffect(() => {
    if (isOverdue && currentLevel < 3 && !triggerRef.current && !hasTriggeredEscalation) {
      triggerRef.current = true;
      setHasTriggeredEscalation(true);
      fetch("/api/cron/escalations", { method: "POST" })
        .catch(() => {})
        .finally(() => {
          // Re-enable after 60s if needed
          setTimeout(() => {
            triggerRef.current = false;
          }, 60000);
        });
    }
  }, [isOverdue, currentLevel, hasTriggeredEscalation]);

  // Format HH:MM:SS
  const absDiff = Math.abs(remainingMs);
  const totalSeconds = Math.floor(absDiff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // Before mounting on client, render a stable server representation to prevent hydration mismatch
  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-xs font-bold ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[11px] font-medium text-slate-500">{stageName}:</span>
        <span className="font-mono font-extrabold text-slate-600" suppressHydrationWarning>--:--:--</span>
      </div>
    );
  }

  // Visual Themes
  if (currentLevel >= 3) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 bg-red-900/90 text-white rounded-xl text-xs font-bold shadow-sm border border-red-700 animate-pulse ${className}`}
      >
        <Flame className="w-3.5 h-3.5 text-amber-300" />
        <span>Level 3 (HOD Alert)</span>
        <span className="font-mono text-red-200" suppressHydrationWarning>+{formattedTime}</span>
      </div>
    );
  }

  if (isOverdue) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold ${className}`}
      >
        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
        <span>{stageName} Expired</span>
        <span className="font-mono font-extrabold text-rose-800" suppressHydrationWarning>
          Escalating to {nextStage}...
        </span>
      </div>
    );
  }

  const isWarning = remainingMs <= 30 * 60 * 1000; // Under 30 mins

  if (isWarning) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold shadow-sm ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
        <span className="text-[11px] font-medium">{stageName}:</span>
        <span className="font-mono font-extrabold text-amber-900" suppressHydrationWarning>{formattedTime}</span>
        <span className="text-[10px] text-amber-600 font-semibold">(Expiring soon)</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold ${className}`}
    >
      <Clock className="w-3.5 h-3.5 text-indigo-600" />
      <span className="text-[11px] font-medium text-indigo-700">{stageName}:</span>
      <span className="font-mono font-extrabold text-indigo-950 tracking-wider" suppressHydrationWarning>
        {formattedTime}
      </span>
    </div>
  );
}
