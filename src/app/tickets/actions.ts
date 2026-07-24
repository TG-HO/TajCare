"use server";

import { createClient } from "@/lib/supabase/server";
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

  // Insert ticket
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

  const { data: ticket } = await supabase
    .from("tickets")
    .select("status, points_awarded, sla_breached, scheduled_visit_date")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return { error: "Ticket not found." };
  }

  // Allow closing "Issue Resolved" OR "Visit Date Scheduled" when visit date has passed OR "Visited"
  const visitPassed = ticket.scheduled_visit_date
    ? new Date() >= new Date(ticket.scheduled_visit_date)
    : false;

  const canClose =
    ticket.status === "Issue Resolved" ||
    ticket.status === "Visited" ||
    (ticket.status === "Visit Date Scheduled" && visitPassed);

  if (!canClose) {
    return {
      error:
        ticket.status === "Visit Date Scheduled"
          ? "Cannot close yet — the scheduled visit date has not passed."
          : "Only resolved or visited tickets can be closed and rated.",
    };
  }

  // Formula: Total Points = (Base Points * Rating Multiplier) - SLA Penalty
  const basePoints = ticket.points_awarded || 20;
  const ratingMultipliers: Record<number, number> = {
    5: 1.5,
    4: 1.25,
    3: 1.0,
    2: 0.8,
    1: 0.5,
  };

  const multiplier = ratingMultipliers[rating] || 1.0;
  const slaPenalty = ticket.sla_breached ? 15 : 0;
  const finalPoints = Math.max(0, Math.round(basePoints * multiplier - slaPenalty));

  // Update status to Closed & set final awarded points
  const { error } = await supabase
    .from("tickets")
    .update({
      status: "Closed",
      closure_rating: rating,
      closure_remarks: remarks || null,
      points_awarded: finalPoints,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    return { error: error.message };
  }

  // Log action
  await supabase.from("ticket_logs").insert({
    ticket_id: ticketId,
    actor_id: user.id,
    previous_status: ticket.status,
    new_status: "Closed",
    remarks: `Ticket closed with ${rating}-Star rating. Final Points Awarded: ${finalPoints} pts. Remarks: ${
      remarks || "No remarks"
    }`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return {
    success: true,
    message: `Ticket closed! Awarded ${finalPoints} points to responder based on your rating.`,
  };
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

  const { data: ticket } = await supabase
    .from("tickets")
    .select("status, updated_at, reopened_count")
    .eq("id", ticketId)
    .single();

  if (!ticket || (ticket.status !== "Issue Resolved" && ticket.status !== "Visited")) {
    return { error: "Only resolved or visited tickets can be re-opened." };
  }

  // Verify 72 hour rule
  const resolvedAt = new Date(ticket.updated_at).getTime();
  const now = Date.now();
  const hoursElapsed = (now - resolvedAt) / (1000 * 60 * 60);

  if (hoursElapsed > 72) {
    return { error: "Re-open window expired (72 hours elapsed since resolution)." };
  }

  // Re-open ticket -> set back to Pending
  const newReopenedCount = (ticket.reopened_count || 0) + 1;
  const { error } = await supabase
    .from("tickets")
    .update({
      status: "Pending",
      reopened_count: newReopenedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    return { error: error.message };
  }

  // Log action
  await supabase.from("ticket_logs").insert({
    ticket_id: ticketId,
    actor_id: user.id,
    previous_status: "Issue Resolved",
    new_status: "Pending",
    remarks: `Re-opened by complainant (${newReopenedCount}x). Reason: ${remarks}`,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Ticket re-opened and returned to responder queue." };
}
