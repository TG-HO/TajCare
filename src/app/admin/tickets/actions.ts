"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/service";
import { revalidatePath } from "next/cache";

/**
 * Supervisor Operational Actions (Schedule Visit, Mark Visited, Mark Resolved)
 * Once performed, locks the complaint for the responder, reverses responder pending points,
 * and records a penalty.
 */
export async function supervisorTakeoverOrVisitAction(
  ticketId: string,
  newStatus: string,
  remarks: string,
  visitDate?: string | null
) {
  if (!remarks || remarks.trim().length === 0) {
    return { error: "Transition remarks are mandatory for every action." };
  }

  if ((newStatus === "Visit Date Scheduled" || newStatus === "Rescheduled") && !visitDate) {
    return { error: "Please select a scheduled visit date and time." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  // Verify caller's role
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["supervisor", "admin"];
  if (!allowedRoles.includes(callerProfile?.role || "")) {
    return { error: "Only Supervisors or Super Admins can take operational visit/resolution actions." };
  }

  // Fetch ticket details
  const { data: ticket, error: ticketError } = await adminClient
    .from("tickets")
    .select(`
      id,
      ticket_number,
      status,
      assigned_responder_id,
      points_pending,
      locked_for_responder,
      supervisor_handled,
      issue_type_id,
      assigned_responder:profiles!assigned_responder_id(id, full_name, email)
    `)
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    return { error: "Ticket not found." };
  }

  const prevStatus = ticket.status;
  const targetStatus = newStatus === "Rescheduled" ? "Visit Date Scheduled" : newStatus;
  const wasAlreadyLocked = ticket.locked_for_responder;
  const prevResponder = ticket.assigned_responder as any;

  // 1. Points Reversal & Penalty on IT Responder (if not already locked by supervisor)
  if (!wasAlreadyLocked && ticket.assigned_responder_id) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Revert pending points from monthly record if any were added
    if ((ticket.points_pending ?? 0) > 0) {
      await adminClient
        .from("responder_monthly_points")
        .update({
          pending_points: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("responder_id", ticket.assigned_responder_id)
        .eq("month", currentMonth)
        .eq("year", currentYear);
    }

    // Insert penalty entry into points_transactions
    await adminClient.from("points_transactions").insert({
      ticket_id: ticket.id,
      responder_id: ticket.assigned_responder_id,
      event_type: "ESCALATION_PENALTY",
      base_points: 0,
      rating_multiplier: 1.0,
      sla_penalty: 15,
      final_points: -15,
      actor_id: user.id,
      remarks: `⚠️ Supervisor Takeover: Ticket #${ticket.ticket_number} escalated and locked by ${callerProfile?.full_name} (${callerProfile?.role}). Responder pending points reversed and -15 pts penalty applied.`,
    });

    // Notify the responder of the lockout and penalty
    await createNotification({
      userId: ticket.assigned_responder_id,
      actorId: user.id,
      title: `Complaint #${ticket.ticket_number} Locked by Supervisor`,
      message: `Supervisor ${callerProfile?.full_name} has taken over Complaint #${ticket.ticket_number}. Your pending points have been reversed and a -15 pts SLA penalty was applied.`,
      type: "ticket",
      referenceId: ticket.id,
    });
  }

  // 2. Handle status transition
  if (targetStatus === "Issue Resolved") {
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "fn_mark_issue_resolved",
      {
        p_ticket_id: ticketId,
        p_actor_id: user.id,
        p_remarks: `[SUPERVISOR RESOLUTION] ${remarks}`,
        p_visit_date: visitDate ? new Date(visitDate).toISOString() : null,
      }
    );

    if (rpcError) {
      return { error: rpcError.message };
    }

    // Mark as locked and supervisor handled
    await adminClient
      .from("tickets")
      .update({
        locked_for_responder: true,
        supervisor_handled: true,
        supervisor_handling_id: user.id,
        sla_breached: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);
  } else {
    const updateData: Record<string, unknown> = {
      status: targetStatus,
      locked_for_responder: true,
      supervisor_handled: true,
      supervisor_handling_id: user.id,
      sla_breached: true,
      updated_at: new Date().toISOString(),
    };

    if (visitDate) {
      updateData.scheduled_visit_date = new Date(visitDate).toISOString();
    }

    if (targetStatus === "Visit Date Scheduled" || targetStatus === "Visited") {
      updateData.visit_remarks = remarks;
    }

    const { error: updateError } = await adminClient
      .from("tickets")
      .update(updateData)
      .eq("id", ticketId);

    if (updateError) {
      return { error: updateError.message };
    }

    // Insert log entry
    await adminClient.from("ticket_logs").insert({
      ticket_id: ticketId,
      actor_id: user.id,
      previous_status: prevStatus,
      new_status: targetStatus,
      remarks: `[SUPERVISOR ACTION by ${callerProfile?.full_name}] Status changed to "${targetStatus}". Ticket locked for responder (${prevResponder?.full_name || "Responder"}).\nRemarks: ${remarks}`,
      visit_date: visitDate ? new Date(visitDate).toISOString() : null,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  revalidatePath("/responder");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Supervisor action applied: "${targetStatus}". Ticket is now locked for the responder.`,
  };
}

/**
 * Reassign Ticket Action (Supervisor or Line Manager or Admin)
 * - Supervisor can reassign to an IT Responder.
 * - Line Manager & Admin can reassign to an IT Responder OR a Supervisor.
 * - Previous handler (responder or supervisor) has points reversed and penalty applied.
 * - New assignee's timer restarts fresh with their respective response window.
 */
export async function reassignTicketAction(
  ticketId: string,
  newAssigneeId: string,
  remarks: string
) {
  if (!remarks || remarks.trim().length === 0) {
    return { error: "Reassignment remarks/reason are mandatory." };
  }

  if (!newAssigneeId) {
    return { error: "Please select a user to reassign the complaint to." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  // 1. Verify caller profile
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  const callerRole = callerProfile?.role || "";
  const allowedRoles = ["supervisor", "line_manager", "hod", "admin"];
  if (!allowedRoles.includes(callerRole)) {
    return { error: "Unauthorized to reassign complaints." };
  }

  // 2. Verify target assignee
  const { data: targetProfile, error: targetError } = await adminClient
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", newAssigneeId)
    .single();

  if (targetError || !targetProfile) {
    return { error: "Target assignee profile not found." };
  }

  // Role permissions check:
  // - Supervisor can only reassign to a 'responder'
  if (callerRole === "supervisor" && targetProfile.role !== "responder") {
    return { error: "Supervisors can only reassign complaints to IT Responders." };
  }

  // - Line Manager, HOD, and Admin can reassign to 'responder' or 'supervisor'
  if (
    ["line_manager", "hod", "admin"].includes(callerRole) &&
    !["responder", "supervisor"].includes(targetProfile.role)
  ) {
    return { error: "Complaints can only be reassigned to IT Responders or Supervisors." };
  }

  // 3. Fetch current ticket details
  const { data: ticket, error: ticketError } = await adminClient
    .from("tickets")
    .select(`
      id,
      ticket_number,
      status,
      assigned_responder_id,
      supervisor_handled,
      supervisor_handling_id,
      points_pending,
      points_awarded,
      issue_type_id,
      issue_type:predefined_issues(base_points),
      assigned_responder:profiles!assigned_responder_id(id, role, full_name)
    `)
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    return { error: "Ticket not found." };
  }

  // 4. Determine previous handler to penalize and reverse points
  const prevHandlerId = ticket.supervisor_handled && ticket.supervisor_handling_id
    ? ticket.supervisor_handling_id
    : ticket.assigned_responder_id;

  const prevAssignee = ticket.assigned_responder as any;
  const prevAssigneeName = prevAssignee?.full_name || "Previous Assignee";
  const nowIso = new Date().toISOString();

  if (prevHandlerId && prevHandlerId !== newAssigneeId) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Revert pending points from monthly record if any
    if ((ticket.points_pending ?? 0) > 0) {
      await adminClient
        .from("responder_monthly_points")
        .update({
          pending_points: 0,
          updated_at: nowIso,
        })
        .eq("responder_id", prevHandlerId)
        .eq("month", currentMonth)
        .eq("year", currentYear);
    }

    // Apply -15 pts penalty to previous handler
    await adminClient.from("points_transactions").insert({
      ticket_id: ticket.id,
      responder_id: prevHandlerId,
      event_type: "REASSIGNMENT_PENALTY",
      base_points: 0,
      rating_multiplier: 1.0,
      sla_penalty: 15,
      final_points: -15,
      actor_id: user.id,
      remarks: `⚠️ Reassigned by ${callerProfile?.full_name} (${callerRole}): Ticket #${ticket.ticket_number} was reassigned to ${targetProfile.full_name}. Points reversed and -15 pts penalty applied.`,
    });

    // Notify previous assignee
    await createNotification({
      userId: prevHandlerId,
      actorId: user.id,
      title: `Complaint #${ticket.ticket_number} Reassigned`,
      message: `Complaint #${ticket.ticket_number} was reassigned to ${targetProfile.full_name} by ${callerProfile?.full_name}. Pending points reversed and -15 pts penalty recorded.`,
      type: "ticket",
      referenceId: ticket.id,
    });
  }

  // 5. Calculate base points for new assignee
  const issue = ticket.issue_type as any;
  const basePoints = issue?.base_points || ticket.points_awarded || 20;

  // 6. Update ticket to new assignee
  const isTargetSupervisor = targetProfile.role === "supervisor";

  const updateData: Record<string, unknown> = {
    assigned_responder_id: newAssigneeId,
    reassigned_from_id: prevHandlerId,
    reassigned_at: nowIso,
    last_escalated_at: isTargetSupervisor ? nowIso : null,
    escalation_level: isTargetSupervisor ? 1 : 0,
    locked_for_responder: isTargetSupervisor,
    supervisor_handled: isTargetSupervisor,
    supervisor_handling_id: isTargetSupervisor ? newAssigneeId : null,
    points_pending: basePoints,
    points_awarded: basePoints,
    sla_breached: true,
    updated_at: nowIso,
  };

  const { error: updateError } = await adminClient
    .from("tickets")
    .update(updateData)
    .eq("id", ticketId);

  if (updateError) {
    return { error: updateError.message };
  }

  // 7. Insert audit log
  await adminClient.from("ticket_logs").insert({
    ticket_id: ticketId,
    actor_id: user.id,
    previous_status: ticket.status,
    new_status: ticket.status,
    remarks: `[REASSIGNED by ${callerProfile?.full_name} (${callerRole})] Reassigned from ${prevAssigneeName} to ${targetProfile.full_name} (${targetProfile.role}). Penalty (-15 pts) applied to previous handler.\nReason: ${remarks}`,
  });

  // 8. Notify new assignee
  await createNotification({
    userId: newAssigneeId,
    actorId: user.id,
    title: `New Complaint Reassigned to You`,
    message: `Complaint #${ticket.ticket_number} has been reassigned to you by ${callerProfile?.full_name}. Reason: ${remarks}`,
    type: "ticket",
    referenceId: ticket.id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  revalidatePath("/responder");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Ticket #${ticket.ticket_number} successfully reassigned to ${targetProfile.full_name} (${targetProfile.role}).`,
  };
}

/**
 * Add Administrative / Operational Comment Action
 */
export async function addTicketCommentAction(
  ticketId: string,
  remarks: string
) {
  if (!remarks || remarks.trim().length === 0) {
    return { error: "Comment text cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  const { data: ticket } = await adminClient
    .from("tickets")
    .select("status, ticket_number, assigned_responder_id, complainant_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return { error: "Ticket not found." };
  }

  const roleLabel = callerProfile?.role
    ? callerProfile.role.replace("_", " ").toUpperCase()
    : "STAFF";

  await adminClient.from("ticket_logs").insert({
    ticket_id: ticketId,
    actor_id: user.id,
    previous_status: ticket.status,
    new_status: ticket.status,
    remarks: `[COMMENT by ${callerProfile?.full_name || "User"} (${roleLabel})]: ${remarks}`,
  });

  // Send notification to responder if comment by supervisor/admin
  if (ticket.assigned_responder_id && ticket.assigned_responder_id !== user.id) {
    await createNotification({
      userId: ticket.assigned_responder_id,
      actorId: user.id,
      title: `New Comment on Ticket #${ticket.ticket_number}`,
      message: `${callerProfile?.full_name} commented: "${remarks.slice(0, 100)}"`,
      type: "ticket",
      referenceId: ticketId,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  revalidatePath("/responder");
  revalidatePath("/dashboard");

  return { success: true, message: "Comment added to ticket history." };
}
