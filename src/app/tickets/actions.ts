"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications/service";

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
  if (issueTypeId) {
    const { data: issue } = await supabase
      .from("predefined_issues")
      .select("base_points")
      .eq("id", issueTypeId)
      .maybeSingle();

    if (issue) {
      basePoints = issue.base_points;
    }
  }

  const slaDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let assignedResponderId: string | null = null;

  const { data: bindings } = await supabase
    .from("responder_locations")
    .select("responder_id, responder:profiles!responder_id(id, is_on_leave, backup_responder_id)")
    .eq("location_id", locationId);

  if (bindings && bindings.length > 0) {
    for (const b of bindings) {
      const resp = b.responder as any;
      if (resp) {
        if (resp.is_on_leave && resp.backup_responder_id) {
          assignedResponderId = resp.backup_responder_id;
          break;
        } else if (!resp.is_on_leave) {
          assignedResponderId = resp.id;
          break;
        }
      }
    }
    if (!assignedResponderId && bindings[0]?.responder_id) {
      assignedResponderId = bindings[0].responder_id;
    }
  }

  if (!assignedResponderId) {
    const { data: responders } = await supabase
      .from("profiles")
      .select("id, is_on_leave, backup_responder_id")
      .eq("role", "responder");

    if (responders && responders.length > 0) {
      const activeResp = responders.find((r) => !r.is_on_leave);
      if (activeResp) {
        assignedResponderId = activeResp.id;
      } else {
        const firstResp = responders[0];
        assignedResponderId = firstResp.backup_responder_id || firstResp.id;
      }
    }
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
  if (issueTypeId) {
    const { data: issue } = await adminClient
      .from("predefined_issues")
      .select("base_points")
      .eq("id", issueTypeId)
      .maybeSingle();

    if (issue) basePoints = issue.base_points;
  }

  const slaDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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
 * Site Manager rates ticket -> status becomes "Awaiting Admin Approval"
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

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/responder");

  return {
    success: true,
    message: `Rating submitted! Complaint is now "Awaiting Admin Approval". Points will be confirmed after Admin review.`,
  };
}

/**
 * Admin approves or modifies rating -> ticket becomes "Closed" & points confirmed.
 */
export async function adminApproveRatingAction(
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

  const { data: rpcResult, error: rpcError } = await adminClient.rpc(
    "fn_admin_approve_rating",
    {
      p_ticket_id: ticketId,
      p_actor_id: user.id,
      p_final_rating: finalRating,
      p_remarks: remarks || "",
    }
  );

  if (rpcError) return { error: rpcError.message };

  const result = rpcResult as { error?: string; success?: boolean; confirmed_points?: number };
  if (result?.error) return { error: result.error };

  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/responder");
  revalidatePath("/responder/performance");

  return {
    success: true,
    message: `Rating approved! ${result?.confirmed_points || 0} points confirmed and credited to the responder.`,
  };
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
    .select("status, closed_at, reopened_count")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: "Ticket not found." };

  if (
    ticket.status !== "Issue Resolved" &&
    ticket.status !== "Closed" &&
    ticket.status !== "Awaiting Admin Approval"
  ) {
    return {
      error: `Only tickets in "Issue Resolved", "Awaiting Admin Approval", or "Closed" status can be re-opened. Current status: ${ticket.status}`,
    };
  }

  if (ticket.status === "Closed") {
    if (!ticket.closed_at) {
      return { error: "Closure timestamp missing. Cannot verify re-open window." };
    }
    const hoursElapsed = (Date.now() - new Date(ticket.closed_at).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 72) {
      return {
        error: "Re-open window has expired. Tickets can only be re-opened within 72 hours of closure.",
      };
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
