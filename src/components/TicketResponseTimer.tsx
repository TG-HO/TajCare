"use client";

import { useEffect, useState, useRef } from "react";
import { Clock, AlertTriangle, Flame, CheckCircle2, ShieldAlert, Lock } from "lucide-react";
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
  // 1. ALL HOOKS CALLED AT TOP LEVEL UNCONDITIONALLY (Strict compliance with React Rule of Hooks)
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [hasTriggeredEscalation, setHasTriggeredEscalation] = useState<boolean>(false);
  const triggerRef = useRef<boolean>(false);

  const isPending = ticket.status === "Pending";
  const currentLevel = ticket.escalation_level || 0;

  // Predefined issue SLAs calculation
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

  const baseCreatedAt = new Date(ticket.reassigned_at || ticket.created_at || Date.now()).getTime();

  // Target deadline calculation
  let targetDeadline = baseCreatedAt + responderMins * 60 * 1000;
  let stageName = isResponderView ? "Time to Respond" : "Responder Window";
  let nextStage = "Supervisor";

  if (currentLevel === 1) {
    const baseTime = ticket.last_escalated_at
      ? new Date(ticket.last_escalated_at).getTime()
      : baseCreatedAt + responderMins * 60 * 1000;
    targetDeadline = baseTime + supervisorMins * 60 * 1000;
    stageName = "Supervisor Window";
    nextStage = "Line Manager";
  } else if (currentLevel === 2) {
    const baseTime = ticket.last_escalated_at
      ? new Date(ticket.last_escalated_at).getTime()
      : baseCreatedAt + (responderMins + supervisorMins) * 60 * 1000;
    targetDeadline = baseTime + lineManagerMins * 60 * 1000;
    stageName = "Line Mgr Window";
    nextStage = "HOD & Admin";
  } else if (currentLevel >= 3) {
    stageName = "HOD & Admin Escalated";
  }

  const remainingMs = targetDeadline - now;
  const isOverdue = remainingMs <= 0;

  // Hook 1: Mounting and interval tick
  useEffect(() => {
    setMounted(true);
    if (!isPending || currentLevel >= 3) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isPending, currentLevel]);

  // Hook 2: Trigger background escalation on expiration (Called unconditionally before any returns)
  useEffect(() => {
    if (!mounted || !isPending) return;
    if (isOverdue && currentLevel < 3 && !triggerRef.current && !hasTriggeredEscalation) {
      triggerRef.current = true;
      setHasTriggeredEscalation(true);
      fetch("/api/cron/escalations", { method: "POST" })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => {
            triggerRef.current = false;
          }, 60000);
        });
    }
  }, [mounted, isPending, isOverdue, currentLevel, hasTriggeredEscalation]);

  // 2. CONDITIONAL RENDERS (Only after all hooks have been declared)

  // A. Level 3 Escalated - HOD has no response timer (Render static status immediately)
  if (currentLevel >= 3) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 bg-red-950 text-red-100 rounded-xl text-xs font-bold shadow-sm border border-red-800 ${className}`}
      >
        <Flame className="w-3.5 h-3.5 text-amber-400" />
        <span>Level 3 (HOD & Admin Escalated)</span>
      </div>
    );
  }

  // B. Server-Side / Pre-hydration placeholder
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

  // C. Responded / Handled state (Status is not Pending)
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

  // C2. Locked for responder state
  if (isResponderView && ticket.locked_for_responder) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 ${className}`}
      >
        <Lock className="w-3 h-3 text-amber-600" />
        Locked by Supervisor
      </span>
    );
  }

  // Format HH:MM:SS
  const absDiff = Math.abs(remainingMs);
  const totalSeconds = Math.floor(absDiff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // D. Overdue / Auto-escalating
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

  // E. Warning (<30 mins remaining)
  const isWarning = remainingMs <= 30 * 60 * 1000;
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

  // F. Normal Countdown
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
