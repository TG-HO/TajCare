"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateTicketStatusAction(
  ticketId: string,
  newStatus: string,
  remarks: string,
  visitDate?: string | null
) {
  if (!remarks || remarks.trim().length === 0) {
    return { error: "Transition remarks are mandatory for every status update." };
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

  const { data: ticket } = await adminClient
    .from("tickets")
    .select("status, scheduled_visit_date, sla_breached, location:locations(type), issue_type_id, points_pending")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return { error: "Ticket not found." };
  }

  const prevStatus = ticket.status;
  let isRescheduling = false;
  let isLateBreach = false;

  // Check if this is a reschedule action
  if (ticket.status === "Visit Date Scheduled" && (newStatus === "Visit Date Scheduled" || newStatus === "Rescheduled")) {
    isRescheduling = true;
    if (ticket.scheduled_visit_date) {
      const scheduledTime = new Date(ticket.scheduled_visit_date).getTime();
      const currentTime = Date.now();
      if (currentTime > scheduledTime) {
        isLateBreach = true;
      }
    }
  }

  const targetStatus = newStatus === "Rescheduled" ? "Visit Date Scheduled" : newStatus;

  // --- ISSUE RESOLVED: Use the dedicated RPC for atomic pending points ---
  if (targetStatus === "Issue Resolved") {
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "fn_mark_issue_resolved",
      {
        p_ticket_id: ticketId,
        p_actor_id: user.id,
        p_remarks: remarks,
        p_visit_date: visitDate ? new Date(visitDate).toISOString() : null,
      }
    );

    if (rpcError) {
      return { error: rpcError.message };
    }

    const result = rpcResult as { error?: string; success?: boolean; pending_points?: number };
    if (result?.error) {
      return { error: result.error };
    }

    revalidatePath("/responder");
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    revalidatePath("/admin/tickets");

    return {
      success: true,
      message: `Ticket marked as Resolved! ${result?.pending_points || 0} pts are now Pending — will be confirmed once Site Manager closes and rates the ticket.`,
    };
  }

  // --- ALL OTHER STATUS TRANSITIONS ---
  const updateData: Record<string, unknown> = {
    status: targetStatus,
    updated_at: new Date().toISOString(),
  };

  if (visitDate) {
    updateData.scheduled_visit_date = new Date(visitDate).toISOString();
  }

  if (targetStatus === "Visit Date Scheduled" || targetStatus === "Visited") {
    updateData.visit_remarks = remarks;
  }

  if (isLateBreach) {
    updateData.sla_breached = true;
  }

  const { error } = await adminClient
    .from("tickets")
    .update(updateData)
    .eq("id", ticketId);

  if (error) {
    return { error: error.message };
  }

  // Build transition remarks string
  let logRemarks = remarks;
  if (isRescheduling) {
    logRemarks = `[RESCHEDULED] Visit date updated to ${new Date(visitDate!).toLocaleString()}.${isLateBreach ? " (SLA BREACH - Rescheduled after original visit time passed)" : ""}\nRemarks: ${remarks}`;
  }

  // Insert log
  await adminClient.from("ticket_logs").insert({
    ticket_id: ticketId,
    actor_id: user.id,
    previous_status: prevStatus,
    new_status: targetStatus,
    remarks: logRemarks,
    visit_date: visitDate ? new Date(visitDate).toISOString() : null,
  });

  revalidatePath("/responder");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/admin/tickets");

  return { success: true, message: `Ticket status updated to "${targetStatus}"!` };
}
