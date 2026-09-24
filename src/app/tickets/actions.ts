"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createNotification, createRoleNotifications } from "@/lib/notifications/service";
import { TICKET_POLICY } from "@/lib/config";

export async function createTicketAction(formData: FormData) {
  const rawIssueTypeId = (formData.get("issue_type_id") as string) || null;
  const issueTypeId = rawIssueTypeId && rawIssueTypeId !== "OTHER" ? rawIssueTypeId : null;
  const customIssueTitle = (formData.get("custom_issue_title") as string) || null;
  const description = formData.get("description") as string;

  if (!description) {
    return { error: "Please provide a detailed description of the issue." };
  }

  if (!issueTypeId && !customIssueTitle) {
    return { error: "Please select a predefined issue or specify a custom issue title." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized. Please log in." };
  }

  // Get user profile location
  let { data: profile } = await supabase
    .from("profiles")
    .select("location_id")
    .eq("id", user.id)
    .maybeSingle();

  let locationId = profile?.location_id;

  if (!locationId) {
    const { data: defaultLoc } = await supabase
      .from("locations")
      .select("id")
      .limit(1)
      .single();

    if (defaultLoc) {
      locationId = defaultLoc.id;
      await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          email: user.email!,
          role: user.user_metadata?.role || "employee",
          location_id: locationId,
        });
    } else {
      return { error: "No system locations found. Please contact Admin." };
    }
  }

  let basePoints = 20;
  let totalSlaMinutes = 24 * 60;
  if (issueTypeId) {
    const { data: issue } = await supabase
      .from("predefined_issues")
      .select("base_points, resolution_time_hours, resolution_time_minutes")
      .eq("id", issueTypeId)
      .maybeSingle();

    if (issue) {
      basePoints = issue.base_points;
      const h = issue.resolution_time_hours ?? 24;
      const m = issue.resolution_time_minutes ?? 0;
      totalSlaMinutes = h * 60 + m;
    }
  }

  const slaDueAt = new Date(Date.now() + totalSlaMinutes * 60 * 1000).toISOString();
  let assignedResponderId: string | null = null;
  const adminClient = createAdminClient();

  // 1. Check responder_locations bindings for this location
  const { data: bindings } = await adminClient
    .from("responder_locations")
    .select("responder_id, responder:profiles!responder_id(id, full_name, role, is_on_leave, backup_responder_id)")
    .eq("location_id", locationId);

  if (bindings && bindings.length > 0) {
    for (const b of bindings) {
      const resp = b.responder as any;
      // Must have role 'responder' and MUST NOT be the complainant themselves
      if (resp && resp.role === "responder" && resp.id !== user.id) {
        if (resp.is_on_leave && resp.backup_responder_id && resp.backup_responder_id !== user.id) {
          assignedResponderId = resp.backup_responder_id;
          break;
        } else if (!resp.is_on_leave) {
          assignedResponderId = resp.id;
          break;
        }
      }
    }
  }

  // 2. Fallback: If no location-bound responder found, pick the first active responder (never the complainant)
  if (!assignedResponderId) {
    const { data: responders } = await adminClient
      .from("profiles")
      .select("id, is_on_leave, backup_responder_id")
      .eq("role", "responder")
      .neq("id", user.id);

    if (responders && responders.length > 0) {
      const activeResp = responders.find((r) => !r.is_on_leave);
      if (activeResp) {
        assignedResponderId = activeResp.id;
      } else {
        const firstResp = responders[0];
        assignedResponderId = (firstResp.backup_responder_id && firstResp.backup_responder_id !== user.id)
          ? firstResp.backup_responder_id
          : firstResp.id;
      }
    }
  }

  const rawAttachments = (formData.get("attachments_data") as string) || "[]";
  let attachments: string[] = [];
  try {
    attachments = JSON.parse(rawAttachments);
  } catch (e) {
    attachments = [];
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      complainant_id: user.id,
      location_id: locationId,
      issue_type_id: issueTypeId || null,
      custom_issue_title: customIssueTitle || null,
      description,
      status: "Pending",
      assigned_responder_id: assignedResponderId,
      sla_due_at: slaDueAt,
      points_awarded: basePoints,
      points_pending: basePoints,
      attachments,
    })
    .select()
    .single();

  if (error) {
    return { error: `Failed to log complaint: ${error.message}` };
  }

  await supabase.from("ticket_logs").insert({
    ticket_id: ticket.id,
    actor_id: user.id,
    previous_status: null,
    new_status: "Pending",
    remarks: "Complaint submitted and automatically queued for IT Responder.",
  });

  if (assignedResponderId) {
    await createNotification({
      userId: assignedResponderId,
      actorId: user.id,
      title: "New Complaint Assigned",
      message: `Complaint #${ticket.ticket_number} assigned to your location queue.`,
      type: "ticket",
      referenceId: ticket.id,
    });
  }

  // Confirmation email & notification to complainant
  await createNotification({
    userId: user.id,
    actorId: user.id,
    title: `Complaint #${ticket.ticket_number} Submitted Successfully`,
    message: `Your complaint #${ticket.ticket_number} has been logged and queued for IT support.`,
    type: "ticket",
    referenceId: ticket.id,
  });

  revalidatePath("/dashboard");
  return {
    success: true,
    message: `Complaint #${ticket.ticket_number} submitted successfully! Auto-assigned to IT Responder.`,
    ticketId: ticket.id,
  };
}

/**
 * Admin logs complaint directly with site & manual responder selection.
 */
export async function adminCreateTicketAction(formData: FormData) {
  const locationId = formData.get("location_id") as string;
  const responderId = (formData.get("assigned_responder_id") as string) || null;
  const rawIssueTypeId = (formData.get("issue_type_id") as string) || null;
  const issueTypeId = rawIssueTypeId && rawIssueTypeId !== "OTHER" ? rawIssueTypeId : null;
  const customIssueTitle = (formData.get("custom_issue_title") as string) || null;
  const description = (formData.get("description") as string)?.trim();

  if (!description || !locationId) {
    return { error: "Please select site location and provide issue description." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  let basePoints = 20;
  let totalSlaMinutes = 24 * 60;

  const formHours = formData.get("custom_resolution_hours");
  const formMinutes = formData.get("custom_resolution_minutes");

  if (issueTypeId) {
    const { data: issue } = await adminClient
      .from("predefined_issues")
      .select("base_points, resolution_time_hours, resolution_time_minutes")
      .eq("id", issueTypeId)
      .maybeSingle();

    if (issue) {
      basePoints = issue.base_points;
      const h = issue.resolution_time_hours ?? 24;
      const m = issue.resolution_time_minutes ?? 0;
      totalSlaMinutes = h * 60 + m;
    }
  }

  if (formHours !== null && formHours !== "") {
    const h = parseInt(formHours as string, 10) || 0;
    const m = parseInt((formMinutes as string) || "0", 10) || 0;
    if (h > 0 || m > 0) {
      totalSlaMinutes = h * 60 + m;
    }
  }

  const slaDueAt = new Date(Date.now() + totalSlaMinutes * 60 * 1000).toISOString();

  // Override check: cancel any existing open site complaint for the same location & issue
  let existingQuery = adminClient
    .from("tickets")
    .select("id, ticket_number, status")
    .eq("location_id", locationId)
    .in("status", ["Pending", "In Progress", "Visit Date Scheduled", "Visited", "Issue Resolved", "Awaiting Admin Approval", "Reopened"]);

  if (issueTypeId) {
    existingQuery = existingQuery.eq("issue_type_id", issueTypeId);
  } else if (customIssueTitle) {
    existingQuery = existingQuery.eq("custom_issue_title", customIssueTitle);
  }

  const { data: existingTickets } = await existingQuery;

  if (existingTickets && existingTickets.length > 0) {
    for (const oldT of existingTickets) {
      await adminClient
        .from("tickets")
        .update({ status: "Cancelled", updated_at: new Date().toISOString() })
        .eq("id", oldT.id);

      await adminClient.from("ticket_logs").insert({
        ticket_id: oldT.id,
        actor_id: user.id,
        previous_status: oldT.status,
        new_status: "Cancelled",
        remarks: "Existing site complaint overridden by Admin Priority Complaint.",
      });
    }
  }

  const rawAttachments = (formData.get("attachments_data") as string) || "[]";
  let attachments: string[] = [];
  try {
    attachments = JSON.parse(rawAttachments);
  } catch (e) {
    attachments = [];
  }

  const { data: ticket, error } = await adminClient
    .from("tickets")
    .insert({
      complainant_id: user.id,
      location_id: locationId,
      issue_type_id: issueTypeId || null,
      custom_issue_title: customIssueTitle || null,
      description,
      status: "Pending",
      assigned_responder_id: responderId || null,
      sla_due_at: slaDueAt,
      points_awarded: basePoints,
      points_pending: basePoints,
      attachments,
    })
    .select()
    .single();

  if (error || !ticket) {
    return { error: `Failed to log admin complaint: ${error?.message}` };
  }

  await adminClient.from("ticket_logs").insert({
    ticket_id: ticket.id,
    actor_id: user.id,
    previous_status: null,
    new_status: "Pending",
    remarks: `Complaint logged directly by Admin. ${responderId ? "Assigned to IT Responder." : "Unassigned."}`,
  });

  if (responderId) {
    await createNotification({
      userId: responderId,
      actorId: user.id,
      title: "New Complaint Assigned by Admin",
      message: `Admin assigned Complaint #${ticket.ticket_number} to you.`,
      type: "ticket",
      referenceId: ticket.id,
    });
  }

  if (ticket.complainant_id && ticket.complainant_id !== user.id) {
    await createNotification({
      userId: ticket.complainant_id,
      actorId: user.id,
      title: `Admin Complaint #${ticket.ticket_number} Logged`,
      message: `A priority complaint #${ticket.ticket_number} has been logged for your location by System Admin.`,
      type: "ticket",
      referenceId: ticket.id,
    });
  }

  revalidatePath("/admin/tickets");
  revalidatePath("/admin");
  revalidatePath("/responder");

  return {
    success: true,
    message: `Admin Complaint #${ticket.ticket_number} created and assigned!`,
    ticketId: ticket.id,
  };
}

/**
 * Site Manager rates ticket -> status becomes "Awaiting Supervisor Approval"
 */
export async function submitRatingAction(ticketId: string, rating: number, remarks: string) {
  if (!rating || rating < 1 || rating > 5) {
    return { error: "Please select a valid rating between 1 and 5 stars." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: rpcResult, error: rpcError } = await adminClient.rpc(
    "fn_submit_site_manager_rating",
    {
      p_ticket_id: ticketId,
      p_actor_id: user.id,
      p_rating: rating,
      p_remarks: remarks || "",
    }
  );

  if (rpcError) return { error: rpcError.message };

  const result = rpcResult as { error?: string; success?: boolean };
  if (result?.error) return { error: result.error };

  // Notify Field Supervisors that a rating is awaiting review and permanent closure
  const { data: ticket } = await adminClient
    .from("tickets")
    .select("ticket_number, assigned_responder_id, assigned_responder:profiles!assigned_responder_id(supervisor_id)")
    .eq("id", ticketId)
    .single();

  if (ticket) {
    const directSupId = (ticket.assigned_responder as any)?.supervisor_id;
    if (directSupId) {
      await createNotification({
        userId: directSupId,
        actorId: user.id,
        title: `Rating Awaiting Supervisor Review: #${ticket.ticket_number}`,
        message: `Complaint #${ticket.ticket_number} was rated ${rating}★ by Site Manager — awaiting your Field Supervisor review and permanent closure.`,
        type: "rating",
        referenceId: ticketId,
      });
    }

    await createRoleNotifications({
      role: "supervisor",
      actorId: user.id,
      title: `Rating Awaiting Supervisor Review: #${ticket.ticket_number}`,
      message: `Complaint #${ticket.ticket_number} was rated ${rating}★ by Site Manager — awaiting Field Supervisor review and permanent closure.`,
      type: "rating",
      referenceId: ticketId,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/supervised");
  revalidatePath("/responder");

  return {
    success: true,
    message: `Rating submitted! Complaint is now "Awaiting Supervisor Approval". Field Supervisor will review and close it permanently.`,
  };
}

/**
 * Field Supervisor rates ticket -> ticket becomes "Permanently Closed" & flat points confirmed.
 * STRICT ENFORCEMENT:
 * - Only role 'supervisor' (Field Supervisor) can rate (NOT even Admin, Line Manager, or HOD).
 * - Only unlocked after the reopening window (default 24h) has expired.
 */
export async function supervisorRateAndCloseAction(
  ticketId: string,
  finalRating: number,
  remarks: string
) {
  if (!finalRating || finalRating < 1 || finalRating > 5) {
    return { error: "Please select a rating between 1 and 5 stars." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  // Role validation: ONLY supervisor (not even admin)
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "supervisor") {
    return {
      error: "Only Field Supervisors can rate and permanently close complaints (not even Admins, Line Managers, or HODs).",
    };
  }

  // Verify ticket reopening window has expired
  const { data: targetTicket } = await adminClient
    .from("tickets")
    .select("site_manager_rated_at, closed_at, updated_at, status")
    .eq("id", ticketId)
    .single();

  const ratedAt = targetTicket?.site_manager_rated_at || targetTicket?.closed_at || targetTicket?.updated_at;
  if (ratedAt) {
    const hoursElapsed = (Date.now() - new Date(ratedAt).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < TICKET_POLICY.REOPEN_WINDOW_HOURS) {
      const hoursLeft = Math.ceil(TICKET_POLICY.REOPEN_WINDOW_HOURS - hoursElapsed);
      return {
        error: `Reopening window is still active (${hoursLeft}h remaining). Field Supervisor can only rate and permanently close this complaint after the ${TICKET_POLICY.REOPEN_WINDOW_HOURS}-hour reopening window has passed without re-opening.`,
      };
    }
  }

  const { data: rpcResult, error: rpcError } = await adminClient.rpc(
    "fn_supervisor_rate_and_close_ticket",
    {
      p_ticket_id: ticketId,
      p_actor_id: user.id,
      p_supervisor_rating: finalRating,
      p_remarks: remarks || "",
    }
  );

  if (rpcError) return { error: rpcError.message };

  const result = rpcResult as { error?: string; success?: boolean; confirmed_points?: number };
  if (result?.error) return { error: result.error };

  // Notify responder of confirmed points & notify complainant of permanent ticket closure
  const { data: ticket } = await adminClient
    .from("tickets")
    .select("ticket_number, assigned_responder_id, complainant_id")
    .eq("id", ticketId)
    .single();

  if (ticket) {
    if (ticket.assigned_responder_id) {
      await createNotification({
        userId: ticket.assigned_responder_id,
        actorId: user.id,
        title: `Complaint Permanently Closed & Points Credited`,
        message: `Complaint #${ticket.ticket_number} was permanently closed by Field Supervisor (${finalRating}★). +${result?.confirmed_points || 0} confirmed points credited!`,
        type: "points",
        referenceId: ticketId,
      });
    }

    if (ticket.complainant_id) {
      await createNotification({
        userId: ticket.complainant_id,
        actorId: user.id,
        title: `Complaint #${ticket.ticket_number} Permanently Closed`,
        message: `Your complaint #${ticket.ticket_number} has been reviewed and permanently closed by Field Supervisor with a ${finalRating}★ rating.${remarks ? ` Remarks: ${remarks}` : ""}`,
        type: "ticket",
        referenceId: ticketId,
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/supervised");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/responder");
  revalidatePath("/responder/performance");

  return {
    success: true,
    message: `Complaint permanently closed! ${result?.confirmed_points || 0} points confirmed and credited to the responder.`,
  };
}

/**
 * Backward compatibility alias
 */
export async function adminApproveRatingAction(
  ticketId: string,
  finalRating: number,
  remarks: string
) {
  return supervisorRateAndCloseAction(ticketId, finalRating, remarks);
}

export async function rateAndCloseTicketAction(
  ticketId: string,
  rating: number,
  remarks: string
) {
  return submitRatingAction(ticketId, rating, remarks);
}

export async function reopenTicketAction(ticketId: string, remarks: string) {
  if (!remarks) {
    return { error: "Please provide a reason for re-opening the ticket." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: ticket } = await adminClient
    .from("tickets")
    .select("status, closed_at, site_manager_rated_at, reopened_count, ticket_number, assigned_responder_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: "Ticket not found." };

  if (ticket.status === "Permanently Closed") {
    return {
      error: "This complaint was permanently closed by the Field Supervisor and cannot be re-opened.",
    };
  }

  if (
    ticket.status !== "Issue Resolved" &&
    ticket.status !== "Closed" &&
    ticket.status !== "Awaiting Admin Approval" &&
    ticket.status !== "Awaiting Supervisor Approval"
  ) {
    return {
      error: `Only tickets in "Issue Resolved", "Awaiting Supervisor Approval", or "Closed" status can be re-opened. Current status: ${ticket.status}`,
    };
  }

  if (ticket.status === "Closed" || ticket.status === "Awaiting Supervisor Approval" || ticket.status === "Awaiting Admin Approval") {
    const timestamp = ticket.closed_at || ticket.site_manager_rated_at;
    if (timestamp) {
      const hoursElapsed = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
      if (hoursElapsed > TICKET_POLICY.REOPEN_WINDOW_HOURS) {
        return {
          error: `Re-open window has expired. Tickets can only be re-opened within ${TICKET_POLICY.REOPEN_WINDOW_HOURS} hours of closure.`,
        };
      }
    }
  }

  const { data: rpcResult, error: rpcError } = await adminClient.rpc("fn_reopen_ticket", {
    p_ticket_id: ticketId,
    p_actor_id: user.id,
    p_remarks: remarks,
  });

  if (rpcError) return { error: rpcError.message };

  const result = rpcResult as { error?: string; success?: boolean; reopened_count?: number };
  if (result?.error) return { error: result.error };

  // Notify assigned responder of re-opened complaint (triggers in-app + email)
  if (ticket.assigned_responder_id) {
    await createNotification({
      userId: ticket.assigned_responder_id,
      actorId: user.id,
      title: `Complaint #${ticket.ticket_number} Re-Opened`,
      message: `Complaint #${ticket.ticket_number} was re-opened by Site Manager (Count: ${result?.reopened_count || 1}). Reason: ${remarks}. Please re-attend promptly.`,
      type: "ticket",
      referenceId: ticketId,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/responder");
  revalidatePath("/responder/performance");

  return {
    success: true,
    message: "Ticket re-opened. The responder's points have been reverted to Pending and the complaint is back in their queue.",
  };
}

export async function permanentlyCloseExpiredTicketsAction(ticketIds: string[]) {
  if (!ticketIds || ticketIds.length === 0) return { success: true };

  const adminClient = createAdminClient();

  const results = await Promise.allSettled(
    ticketIds.map((id) =>
      adminClient.rpc("fn_permanently_close_ticket", { p_ticket_id: id })
    )
  );

  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message);

  if (errors.length > 0) {
    console.error("Failed to permanently close some tickets:", errors);
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/responder");

  return { success: true };
}
