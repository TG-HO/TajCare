import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const adminClient = createAdminClient();

    // Query pending tickets created over 24 hours ago that haven't been flagged as breached yet
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: breachedTickets, error: fetchError } = await adminClient
      .from("tickets")
      .select("id, ticket_number, complainant_id, assigned_responder_id")
      .eq("status", "Pending")
      .eq("sla_breached", false)
      .lt("created_at", twentyFourHoursAgo);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!breachedTickets || breachedTickets.length === 0) {
      return NextResponse.json({
        message: "No SLA breaches detected.",
        processedCount: 0,
      });
    }

    const breachedIds = breachedTickets.map((t) => t.id);

    // Update tickets to sla_breached = TRUE
    const { error: updateError } = await adminClient
      .from("tickets")
      .update({
        sla_breached: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", breachedIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Insert log entries for each breached ticket
    const logRows = breachedTickets.map((t) => ({
      ticket_id: t.id,
      actor_id: t.assigned_responder_id || t.complainant_id,
      previous_status: "Pending",
      new_status: "Pending",
      remarks: "⚠️ AUTOMATED SLA BREACH: Ticket remained pending >24 hours without responder activity. -15 pts penalty flagged.",
    }));

    await adminClient.from("ticket_logs").insert(logRows);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${breachedTickets.length} SLA breach(es).`,
      processedCount: breachedTickets.length,
      tickets: breachedTickets.map((t) => `#${t.ticket_number}`),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
