import { NextResponse } from "next/server";
import { sendEscalationEmail, getEmailOverride, getMailTransporter } from "@/lib/email/mailer";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testLevel = parseInt(searchParams.get("level") || "1", 10);
    const testRole = searchParams.get("role") || (testLevel === 1 ? "Supervisor" : testLevel === 2 ? "Line Manager" : "HOD");

    // Optional verify transport connection first
    const transporter = getMailTransporter();
    let verifyResult: string = "unverified";
    try {
      await transporter.verify();
      verifyResult = "verified_ok";
    } catch (vErr: any) {
      verifyResult = `connection_error: ${vErr.message}`;
    }

    // Send a mock escalation test email
    const result = await sendEscalationEmail({
      ticket: {
        id: "00000000-0000-0000-0000-000000000001",
        ticket_number: 9999,
        issue_type: {
          issue_title: "Dispenser Automation & POS Communication Failure",
          category: "IT Hardware / Automation",
        },
        location: {
          name: "Site #101 - Shahrah-e-Faisal",
        },
        complainant: {
          full_name: "Kamran Akmal (Site Manager)",
          phone: "+92 300 3333333",
        },
        assigned_responder: {
          full_name: "Bilal Khan (IT Responder)",
          email: "responder@tajgasoline.com",
        },
      },
      recipient: {
        id: "00000000-0000-0000-0000-000000000002",
        full_name: "Test Recipient (" + testRole + ")",
        email: "target-recipient@tajgasoline.com",
        role: testRole.toLowerCase(),
      },
      level: testLevel,
      targetRole: testRole,
      thresholdDuration: "2 hours",
    });

    return NextResponse.json({
      message: "Test escalation email processed",
      smtpTransportStatus: verifyResult,
      emailResult: result,
      currentEmailOverride: getEmailOverride(),
      notes:
        "To switch to production auto-routing to individual emails, set EMAIL_OVERRIDE_TO='' in your environment variables.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process test email",
        stack: error?.stack,
      },
      { status: 500 }
    );
  }
}
