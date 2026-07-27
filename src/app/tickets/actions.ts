"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  // Auto-assign default location if profile location is missing
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

  // Fetch base points from predefined issue if selected
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

  // 24 hour SLA default
  const slaDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Resolve assigned responder for location or fallback
  let assignedResponderId: string | null = null;

  // 1. Query responder_locations bindings for this locationId
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
    // If all bound responders are on leave without backups, pick first bound responder
    if (!assignedResponderId && bindings[0]?.responder_id) {
      assignedResponderId = bindings[0].responder_id;
    }
  }

  // 2. Fallback: Query profiles table for active responders
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

  // Insert ticket — points_pending and confirmed_points both start at 0
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
      points_awarded: basePoints,   // legacy column: store base for reference
    })
    .select()
    .single();

  if (error) {
    return { error: `Failed to log complaint: ${error.message}` };
  }

  // Insert initial ticket log
  await supabase.from("ticket_logs").insert({
    ticket_id: ticket.id,
    actor_id: user.id,
    previous_status: null,
    new_status: "Pending",
    remarks: "Complaint submitted and automatically queued for IT Responder.",
  });

  revalidatePath("/dashboard");
  return {
    success: true,
    message: `Complaint #${ticket.ticket_number} submitted successfully! Auto-assigned to IT Responder.`,
    ticketId: ticket.id,
  };
}

/**
 * Site Manager rates and closes a ticket.
 * Points are confirmed ONLY here via the atomic RPC.
 */
export async function rateAndCloseTicketAction(
  ticketId: string,
  rating: number,
  remarks: string
) {
  if (!rating || rating < 1 || rating > 5) {
    return { error: "Please select a valid rating between 1 and 5 stars." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: ticket } = await adminClient
    .from("tickets")
    .select("status, points_pending, sla_breached, scheduled_visit_date")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return { error: "Ticket not found." };
  }

  // Only allow closing tickets that the responder has explicitly marked as resolved
  if (ticket.status !== "Issue Resolved" && ticket.status !== "Reopened") {
    return {
      error:
        "This ticket cannot be closed yet. The IT Responder must first mark it as 'Issue Resolved' before you can rate and close it.",
    };
  }

  // Call the atomic RPC — handles points confirmation + monthly snapshot + ticket log
  const { data: rpcResult, error: rpcError } = await adminClient.rpc(
    "fn_close_ticket_and_confirm_points",
    {
      p_ticket_id: ticketId,
      p_actor_id: user.id,
      p_rating: rating,
      p_remarks: remarks || "",
    }
  );

  if (rpcError) {
    return { error: rpcError.message };
  }

  const result = rpcResult as { error?: string; success?: boolean; confirmed_points?: number };
  if (result?.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/responder");
  revalidatePath("/responder/performance");

  return {
    success: true,
    message: `Ticket closed! ${result?.confirmed_points || 0} points confirmed and credited to the responder.`,
  };
}

/**
 * Site Manager reopens a ticket.
 * Works for:
 *  - "Issue Resolved" status (pre-close reopen, no 72h restriction)
 *  - "Closed" status (post-close reopen, within 72h of closed_at)
 * Reverts confirmed_points to 0; restores pending points.
 */
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

  if (!ticket) {
    return { error: "Ticket not found." };
  }

  if (ticket.status !== "Issue Resolved" && ticket.status !== "Closed") {
    return {
      error: `Only tickets in "Issue Resolved" or "Closed" status can be re-opened. Current status: ${ticket.status}`,
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

  // Call the atomic RPC — handles point reversion + monthly snapshot update + log
  const { data: rpcResult, error: rpcError } = await adminClient.rpc(
    "fn_reopen_ticket",
    {
      p_ticket_id: ticketId,
      p_actor_id: user.id,
      p_remarks: remarks,
    }
  );

  if (rpcError) {
    return { error: rpcError.message };
  }

  const result = rpcResult as { error?: string; success?: boolean; reopened_count?: number };
  if (result?.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/responder");
  revalidatePath("/responder/performance");

  return {
    success: true,
    message: "Ticket re-opened. The responder's points have been reverted to Pending and the complaint is back in their queue.",
  };
}

/**
 * Auto-expire closed tickets that have surpassed the 72-hour re-open window.
 * Called server-side on dashboard render.
 */
export async function permanentlyCloseExpiredTicketsAction(ticketIds: string[]) {
  if (!ticketIds || ticketIds.length === 0) return { success: true };

  const adminClient = createAdminClient();

  // Batch permanently close all expired tickets
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
  revalidatePath("/responder");

  return { success: true };
}
