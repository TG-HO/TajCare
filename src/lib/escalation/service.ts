import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/service";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hrs = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hrs} hrs ${remMin} mins` : `${hrs} hour${hrs > 1 ? "s" : ""}`;
}

export interface EscalationResult {
  checkedCount: number;
  escalatedCount: number;
  details: {
    ticketNumber: number;
    level: number;
    targetRole: string;
    elapsedMinutes: number;
    thresholdMinutes: number;
  }[];
}

/**
 * Evaluates pending tickets against the Execution Hierarchy SLA:
 * Hierarchy: Responder -> Supervisor -> Line Manager -> HOD & Super Admin
 * Triggered automatically on ticket viewing or via cron API.
 */
export async function checkAndProcessEscalations(): Promise<EscalationResult> {
  const adminClient = createAdminClient();

  // 1. Fetch pending tickets that haven't reached maximum escalation level 3
  const { data: tickets, error: fetchError } = await adminClient
    .from("tickets")
    .select(`
      id,
      ticket_number,
      status,
      created_at,
      escalation_level,
      last_escalated_at,
      assigned_responder_id,
      complainant_id,
      issue_type:predefined_issues(
        id,
        issue_title,
        resolution_time_hours,
        resolution_time_minutes,
        responder_response_hours,
        responder_response_minutes,
        supervisor_response_hours,
        supervisor_response_minutes,
        line_manager_response_hours,
        line_manager_response_minutes
      ),
      assigned_responder:profiles!assigned_responder_id(
        id,
        full_name,
        email,
        supervisor_id,
        line_manager_id,
        hod_id
      )
    `)
    .eq("status", "Pending")
    .lt("escalation_level", 3);

  if (fetchError || !tickets || tickets.length === 0) {
    return { checkedCount: 0, escalatedCount: 0, details: [] };
  }

  // 2. Fetch all administrative profiles for fallback notifications
  const { data: adminProfiles } = await adminClient
    .from("profiles")
    .select("id, role, full_name, email, line_manager_id, hod_id")
    .in("role", ["supervisor", "line_manager", "hod", "admin"]);

  const supervisors = (adminProfiles || []).filter((p) => p.role === "supervisor");
  const lineManagers = (adminProfiles || []).filter((p) => p.role === "line_manager");
  const hods = (adminProfiles || []).filter((p) => p.role === "hod");
  const admins = (adminProfiles || []).filter((p) => p.role === "admin");

  const results: EscalationResult["details"] = [];
  const now = Date.now();

  for (const ticket of tickets) {
    // Check if responder has made any log activity for this ticket
    const { count: responderLogCount } = await adminClient
      .from("ticket_logs")
      .select("*", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("actor_id", ticket.assigned_responder_id || "none");

    if ((responderLogCount || 0) > 0) {
      // Responder has taken action/logged a remark on this ticket
      continue;
    }

    // Determine target resolution SLA minutes
    const issue = ticket.issue_type as any;
    const resHours = issue?.resolution_time_hours ?? 24;
    const resMins = issue?.resolution_time_minutes ?? 0;
    const totalResolutionMinutes = resHours * 60 + resMins;

    // Default step if hierarchy times not configured
    const defaultStepMinutes =
      totalResolutionMinutes <= 240
        ? Math.max(15, Math.floor(totalResolutionMinutes / 4))
        : 120; // 2 hours

    // Specific hierarchy response time windows (in minutes)
    const responderStepMins =
      issue?.responder_response_hours !== undefined && issue?.responder_response_hours !== null
        ? (issue.responder_response_hours * 60 + (issue.responder_response_minutes ?? 0))
        : defaultStepMinutes;

    const supervisorStepMins =
      issue?.supervisor_response_hours !== undefined && issue?.supervisor_response_hours !== null
        ? (issue.supervisor_response_hours * 60 + (issue.supervisor_response_minutes ?? 0))
        : defaultStepMinutes;

    const lineManagerStepMins =
      issue?.line_manager_response_hours !== undefined && issue?.line_manager_response_hours !== null
        ? (issue.line_manager_response_hours * 60 + (issue.line_manager_response_minutes ?? 0))
        : defaultStepMinutes;

    const createdAt = new Date(ticket.created_at).getTime();
    const elapsedMinutes = Math.floor((now - createdAt) / (60 * 1000));
    const currentLevel = ticket.escalation_level || 0;
    const responder = ticket.assigned_responder as any;
    const responderName = responder?.full_name || "Assigned Responder";

    let targetLevel = currentLevel;
    let targetRoleName = "";
    let recipientIds: string[] = [];
    let currentThresholdMinutes = responderStepMins;

    // Cumulative thresholds
    const stage1Threshold = responderStepMins;
    const stage2Threshold = responderStepMins + supervisorStepMins;
    const stage3Threshold = responderStepMins + supervisorStepMins + lineManagerStepMins;

    // Stage 3: Elapsed >= stage3Threshold -> HOD & Super Admin
    if (elapsedMinutes >= stage3Threshold && currentLevel < 3) {
      targetLevel = 3;
      targetRoleName = "HOD & Admin";
      currentThresholdMinutes = stage3Threshold;

      let hodId = responder?.hod_id;
      if (!hodId && responder?.line_manager_id) {
        const lm = lineManagers.find((m) => m.id === responder.line_manager_id);
        hodId = lm?.hod_id;
      }

      if (hodId) {
        recipientIds.push(hodId);
      } else if (hods.length > 0) {
        recipientIds.push(...hods.map((h) => h.id));
      }
      recipientIds.push(...admins.map((a) => a.id));
    }
    // Stage 2: Elapsed >= stage2Threshold -> Line Manager
    else if (elapsedMinutes >= stage2Threshold && currentLevel < 2) {
      targetLevel = 2;
      targetRoleName = "Line Manager";
      currentThresholdMinutes = stage2Threshold;

      let lmId = responder?.line_manager_id;
      if (!lmId && responder?.supervisor_id) {
        const sup = supervisors.find((s) => s.id === responder.supervisor_id);
        lmId = sup?.line_manager_id;
      }

      if (lmId) {
        recipientIds.push(lmId);
      } else if (lineManagers.length > 0) {
        recipientIds = lineManagers.map((m) => m.id);
      } else {
        recipientIds = admins.map((a) => a.id);
      }
    }
    // Stage 1: Elapsed >= stage1Threshold -> Supervisor
    else if (elapsedMinutes >= stage1Threshold && currentLevel < 1) {
      targetLevel = 1;
      targetRoleName = "Supervisor";
      currentThresholdMinutes = stage1Threshold;

      if (responder?.supervisor_id) {
        recipientIds.push(responder.supervisor_id);
      } else if (supervisors.length > 0) {
        recipientIds = supervisors.map((s) => s.id);
      } else if (lineManagers.length > 0) {
        recipientIds = lineManagers.map((m) => m.id);
      } else {
        recipientIds = admins.map((a) => a.id);
      }
    }

    if (targetLevel > currentLevel && recipientIds.length > 0) {
      // Remove duplicates
      const uniqueRecipients = Array.from(new Set(recipientIds));

      const formattedThreshold = formatDuration(currentThresholdMinutes);
      const title =
        targetLevel === 1
          ? `⚠️ Response SLA Warning (Level 1) - Ticket #${ticket.ticket_number}`
          : targetLevel === 2
          ? `🚨 Hierarchy Escalation (Level 2) - Ticket #${ticket.ticket_number}`
          : `🔥 Critical Escalation (Level 3) - Ticket #${ticket.ticket_number}`;

      const message =
        targetLevel === 1
          ? `Responder ${responderName} has not responded to Ticket #${ticket.ticket_number} within ${formattedThreshold}. Action required by Supervisor.`
          : targetLevel === 2
          ? `Ticket #${ticket.ticket_number} remains unresponded after ${formattedThreshold}. Escalated to Line Manager for intervention.`
          : `CRITICAL: Ticket #${ticket.ticket_number} has exceeded ${formattedThreshold} without responder activity. Escalated to HOD & System Admin.`;

      // 1. Send notifications to target recipients
      for (const recId of uniqueRecipients) {
        await createNotification({
          userId: recId,
          actorId: ticket.assigned_responder_id || ticket.complainant_id,
          title,
          message,
          type: "ticket",
          referenceId: ticket.id,
        });
      }

      // 2. Insert audit entry into ticket_logs
      await adminClient.from("ticket_logs").insert({
        ticket_id: ticket.id,
        actor_id: ticket.assigned_responder_id || ticket.complainant_id,
        previous_status: "Pending",
        new_status: "Pending",
        remarks: `[ESCALATION LEVEL ${targetLevel}] Responder unresponded after ${formattedThreshold}. Escalated to ${targetRoleName}.`,
      });

      // 3. Update ticket escalation level
      await adminClient
        .from("tickets")
        .update({
          escalation_level: targetLevel,
          last_escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      results.push({
        ticketNumber: ticket.ticket_number,
        level: targetLevel,
        targetRole: targetRoleName,
        elapsedMinutes,
        thresholdMinutes: currentThresholdMinutes,
      });
    }
  }

  return {
    checkedCount: tickets.length,
    escalatedCount: results.length,
    details: results,
  };
}
