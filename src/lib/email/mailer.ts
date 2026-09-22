import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { buildEscalationEmailHtml, buildGeneralNotificationEmailHtml } from "./templates";

/**
 * SMTP Configuration
 * Can be customized via .env.local
 */
const SMTP_HOST = process.env.SMTP_HOST || "mail.tajcorporation.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

const SMTP_USER = process.env.SMTP_USER || "no-reply@tajcorporation.com";
const SMTP_PASS = process.env.SMTP_PASS || "PnCFjR6Wf4IYvI5";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

/**
 * STAGING OVERRIDE:
 * While in testing, all outgoing escalation emails route to usman.khan@tajgasoline.com.
 * To enable direct production routing to individual recipients (HOD, Line Manager, Supervisor, etc.),
 * simply set EMAIL_OVERRIDE_TO="" in your environment variables.
 */
export function getEmailOverride(): string | null {
  if (process.env.EMAIL_OVERRIDE_TO !== undefined) {
    const val = process.env.EMAIL_OVERRIDE_TO.trim();
    return val.length > 0 ? val : null;
  }
  // Default to usman.khan@tajgasoline.com per requirements
  return "usman.khan@tajgasoline.com";
}

let transporterInstance: Transporter | null = null;

export function getMailTransporter(): Transporter {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        // Prevent rejection on self-signed or corporately issued certificates
        rejectUnauthorized: false,
      },
    });
  }
  return transporterInstance;
}

export interface SendEscalationParams {
  ticket: {
    id: string;
    ticket_number: number;
    issue_type?: {
      issue_title?: string;
      category?: string;
    } | null;
    location?: {
      name?: string;
    } | null;
    complainant?: {
      full_name?: string;
      phone?: string;
    } | null;
    assigned_responder?: {
      full_name?: string;
      email?: string;
    } | null;
  };
  recipient: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  level: number;
  targetRole: string;
  thresholdDuration: string;
}

export async function sendEscalationEmail(params: SendEscalationParams): Promise<{
  success: boolean;
  recipientEmail: string;
  actualDeliveredTo: string;
  isOverridden: boolean;
  error?: string;
}> {
  const { ticket, recipient, level, targetRole, thresholdDuration } = params;

  const overrideEmail = getEmailOverride();
  const isOverridden = Boolean(overrideEmail && overrideEmail.length > 0);
  const targetEmail = isOverridden ? (overrideEmail as string) : recipient.email;

  if (!targetEmail) {
    return {
      success: false,
      recipientEmail: recipient.email,
      actualDeliveredTo: "",
      isOverridden,
      error: "No recipient email address available.",
    };
  }

  const issueTitle = ticket.issue_type?.issue_title || "Unspecified Complaint";
  const category = ticket.issue_type?.category || "General IT";
  const locationName = ticket.location?.name || "Main Office / Site";
  const responderName =
    ticket.assigned_responder?.full_name || "Unassigned Responder";
  const complainantName = ticket.complainant?.full_name || "Staff Member";

  const levelPrefix =
    level === 1
      ? "⚠️ [LEVEL 1 WARNING]"
      : level === 2
      ? "🚨 [LEVEL 2 ESCALATION]"
      : "🔥 [LEVEL 3 CRITICAL]";

  const subject = isOverridden
    ? `${levelPrefix} [STAGING -> For ${recipient.full_name} (${recipient.role.toUpperCase()})] Ticket #${ticket.ticket_number}: ${issueTitle}`
    : `${levelPrefix} Ticket #${ticket.ticket_number}: ${issueTitle} (${locationName})`;

  const html = buildEscalationEmailHtml({
    ticketNumber: ticket.ticket_number,
    level,
    targetRole,
    recipientName: recipient.full_name,
    recipientRole: recipient.role,
    intendedEmail: recipient.email,
    issueTitle,
    category,
    locationName,
    responderName,
    complainantName,
    thresholdDuration,
    isOverride: isOverridden,
    overrideEmail: overrideEmail || "",
  });

  const text = `
TAJ CARE • ESCALATION ALERT (Level ${level})
===============================================
Ticket: #${ticket.ticket_number}
Issue: ${issueTitle}
Location: ${locationName}
Responder: ${responderName}
Target Role: ${targetRole}
SLA Threshold: Exceeded ${thresholdDuration}
Intended Recipient: ${recipient.full_name} (${recipient.role}) <${recipient.email}>
${isOverridden ? `NOTE: Sent to ${overrideEmail} due to staging override.` : ""}
`.trim();

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from: SMTP_FROM,
      to: targetEmail,
      subject,
      text,
      html,
    });

    return {
      success: true,
      recipientEmail: recipient.email,
      actualDeliveredTo: targetEmail,
      isOverridden,
    };
  } catch (err: any) {
    console.error(`[SMTP Error] Failed sending escalation email to ${targetEmail}:`, err?.message || err);
    return {
      success: false,
      recipientEmail: recipient.email,
      actualDeliveredTo: targetEmail,
      isOverridden,
      error: err?.message || "Unknown SMTP delivery error",
    };
  }
}

export interface SendGeneralNotificationParams {
  to: string;
  recipientName: string;
  recipientRole: string;
  title: string;
  message: string;
  type?: string;
  referenceId?: string | null;
}

export async function sendGeneralNotificationEmail(params: SendGeneralNotificationParams): Promise<{
  success: boolean;
  recipientEmail: string;
  actualDeliveredTo: string;
  isOverridden: boolean;
  error?: string;
}> {
  const { to, recipientName, recipientRole, title, message, type = "info", referenceId } = params;

  const overrideEmail = getEmailOverride();
  const isOverridden = Boolean(overrideEmail && overrideEmail.length > 0);
  const targetEmail = isOverridden ? (overrideEmail as string) : to;

  if (!targetEmail) {
    return {
      success: false,
      recipientEmail: to,
      actualDeliveredTo: "",
      isOverridden,
      error: "No recipient email address available.",
    };
  }

  const subject = isOverridden
    ? `[STAGING -> For ${recipientName} (${recipientRole.toUpperCase()})] ${title}`
    : `[Taj Care] ${title}`;

  const html = buildGeneralNotificationEmailHtml({
    title,
    message,
    type,
    recipientName,
    recipientRole,
    intendedEmail: to,
    referenceId,
    isOverride: isOverridden,
    overrideEmail: overrideEmail || "",
  });

  const text = `
TAJ CARE • NOTIFICATION
===============================================
${title}

${message}

Intended Recipient: ${recipientName} (${recipientRole}) <${to}>
${isOverridden ? `NOTE: Delivered to ${overrideEmail} due to staging override.` : ""}
`.trim();

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from: SMTP_FROM,
      to: targetEmail,
      subject,
      text,
      html,
    });

    return {
      success: true,
      recipientEmail: to,
      actualDeliveredTo: targetEmail,
      isOverridden,
    };
  } catch (err: any) {
    console.error(`[SMTP Error] Failed sending notification email to ${targetEmail}:`, err?.message || err);
    return {
      success: false,
      recipientEmail: to,
      actualDeliveredTo: targetEmail,
      isOverridden,
      error: err?.message || "Unknown SMTP delivery error",
    };
  }
}

