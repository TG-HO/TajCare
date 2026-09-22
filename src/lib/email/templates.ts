/**
 * Taj Care - Escalation Email HTML Templates
 */

interface EscalationEmailParams {
  ticketNumber: number;
  level: number;
  targetRole: string;
  recipientName: string;
  recipientRole: string;
  intendedEmail: string;
  issueTitle: string;
  category?: string;
  locationName?: string;
  responderName?: string;
  complainantName?: string;
  thresholdDuration: string;
  elapsedDuration?: string;
  appUrl?: string;
  isOverride?: boolean;
  overrideEmail?: string;
}

export function buildEscalationEmailHtml(params: EscalationEmailParams): string {
  const {
    ticketNumber,
    level,
    targetRole,
    recipientName,
    recipientRole,
    intendedEmail,
    issueTitle,
    category = "IT Hardware / Network",
    locationName = "Site Location",
    responderName = "Assigned Responder",
    complainantName = "Branch Staff",
    thresholdDuration,
    appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    isOverride = false,
    overrideEmail = "",
  } = params;

  // Visual theming based on escalation severity
  const levelTheme =
    level === 1
      ? {
          title: "SLA Warning (Level 1)",
          badgeBg: "#fef3c7",
          badgeColor: "#92400e",
          badgeBorder: "#f59e0b",
          primaryColor: "#d97706",
          icon: "⚠️",
          subheading: "Field Supervisor Intervention Required",
          description: `The assigned IT Responder has not responded to this ticket within the configured threshold (${thresholdDuration}). As Field Supervisor, your review and intervention are requested.`,
        }
      : level === 2
      ? {
          title: "Hierarchy Escalation (Level 2)",
          badgeBg: "#ffedd5",
          badgeColor: "#9a3412",
          badgeBorder: "#f97316",
          primaryColor: "#ea580c",
          icon: "🚨",
          subheading: "Line Manager Direct Intervention Required",
          description: `This ticket remains unresolved and unresponded after ${thresholdDuration}, exceeding Supervisor response window. Escalated to Line Manager for operational reassignment or escalation.`,
        }
      : {
          title: "Critical Escalation (Level 3)",
          badgeBg: "#fee2e2",
          badgeColor: "#991b1b",
          badgeBorder: "#ef4444",
          primaryColor: "#b91c1c",
          icon: "🔥",
          subheading: "HOD & System Executive Alert",
          description: `CRITICAL: Ticket #${ticketNumber} has breached SLA hierarchy limits without responder activity. Escalated directly to Head of Department (HOD) & System Administration.`,
        };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Taj Care Escalation Alert - Ticket #${ticketNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2); border: 1px solid #334155;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; border-bottom: 3px solid ${levelTheme.primaryColor}; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px; color: #10b981; margin-bottom: 4px;">
                      TAJ CARE • IT HELPDESK SYSTEM
                    </div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                      ${levelTheme.icon} ${levelTheme.title}
                    </h1>
                    <div style="font-size: 13px; font-weight: 600; color: #94a3b8; margin-top: 4px;">
                      ${levelTheme.subheading}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <div style="display: inline-block; background-color: ${levelTheme.badgeBg}; color: ${levelTheme.badgeColor}; border: 1px solid ${levelTheme.badgeBorder}; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                      Ticket #${ticketNumber}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 32px;">

              ${
                isOverride
                  ? `
              <!-- Staging / Dev Override Callout -->
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align: top; width: 24px; font-size: 16px; line-height: 1;">🧪</td>
                    <td style="font-size: 12px; color: #92400e; line-height: 1.5; padding-left: 8px;">
                      <strong>STAGING ROUTE ACTIVE:</strong> This update was routed to <code>${overrideEmail}</code>.<br/>
                      <strong>Intended Recipient:</strong> ${recipientName} (${recipientRole.toUpperCase()}) &bull; <code>${intendedEmail}</code><br/>
                      <span style="color: #b45309; font-size: 11px;">(In production, clearing <code>EMAIL_OVERRIDE_TO</code> will dispatch directly to each user's official email address).</span>
                    </td>
                  </tr>
                </table>
              </div>
              `
                  : ""
              }

              <!-- Greeting & Explanation -->
              <p style="font-size: 15px; color: #1e293b; line-height: 1.6; margin-top: 0; margin-bottom: 12px;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 0; margin-bottom: 20px;">
                ${levelTheme.description}
              </p>

              <!-- Ticket Summary Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="6">
                  <tr>
                    <td style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 140px;">
                      Issue Title:
                    </td>
                    <td style="font-size: 14px; font-weight: 700; color: #0f172a;">
                      ${issueTitle}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      Category:
                    </td>
                    <td style="font-size: 13px; color: #334155;">
                      ${category}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      Site / Location:
                    </td>
                    <td style="font-size: 13px; font-weight: 600; color: #0f172a;">
                      📍 ${locationName}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      Assigned Responder:
                    </td>
                    <td style="font-size: 13px; font-weight: 600; color: #4338ca;">
                      👤 ${responderName}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      Reported By:
                    </td>
                    <td style="font-size: 13px; color: #334155;">
                      ${complainantName}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      SLA Threshold:
                    </td>
                    <td style="font-size: 13px; font-weight: 700; color: ${levelTheme.primaryColor};">
                      Exceeded ${thresholdDuration}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      Escalated To:
                    </td>
                    <td style="font-size: 13px; font-weight: 800; color: #0f172a;">
                      ${targetRole}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/admin/tickets" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center;">
                      Open Ticket #${ticketNumber} in Taj Care →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Explanatory Note -->
              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; text-align: center;">
                You can review, lock, or reassign this ticket directly from the Taj Care Operations Center.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0;">
                Taj Gasoline (Pvt.) Ltd. &bull; Taj Care IT Operations &bull; Automated System Dispatch<br/>
                This is a transactional operational notification regarding Ticket #${ticketNumber}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export interface GeneralNotificationEmailParams {
  title: string;
  message: string;
  type?: string;
  recipientName: string;
  recipientRole: string;
  intendedEmail: string;
  referenceId?: string | null;
  appUrl?: string;
  isOverride?: boolean;
  overrideEmail?: string;
}

export function buildGeneralNotificationEmailHtml(params: GeneralNotificationEmailParams): string {
  const {
    title,
    message,
    type = "info",
    recipientName,
    recipientRole,
    intendedEmail,
    appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    isOverride = false,
    overrideEmail = "",
  } = params;

  const badgeTheme =
    type === "ticket"
      ? { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", label: "Complaint Update" }
      : type === "task"
      ? { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff", label: "Operational Task" }
      : { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", label: "System Notification" };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); border: 1px solid #334155;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 28px; border-bottom: 3px solid #10b981; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px; color: #10b981; margin-bottom: 4px;">
                      TAJ CARE • IT HELPDESK
                    </div>
                    <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                      ${title}
                    </h1>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <div style="display: inline-block; background-color: ${badgeTheme.bg}; color: ${badgeTheme.text}; border: 1px solid ${badgeTheme.border}; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                      ${badgeTheme.label}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px;">

              ${
                isOverride
                  ? `
              <!-- Staging / Dev Override Callout -->
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 12px 14px; margin-bottom: 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align: top; width: 22px; font-size: 15px; line-height: 1;">🧪</td>
                    <td style="font-size: 12px; color: #92400e; line-height: 1.5; padding-left: 8px;">
                      <strong>STAGING ROUTE ACTIVE:</strong> Delivered to <code>${overrideEmail}</code>.<br/>
                      <strong>Intended Recipient:</strong> ${recipientName} (${recipientRole.toUpperCase()}) &bull; <code>${intendedEmail}</code><br/>
                      <span style="color: #b45309; font-size: 11px;">(In production, clearing <code>EMAIL_OVERRIDE_TO</code> dispatches directly to official user emails).</span>
                    </td>
                  </tr>
                </table>
              </div>
              `
                  : ""
              }

              <p style="font-size: 15px; color: #1e293b; line-height: 1.6; margin-top: 0; margin-bottom: 12px;">
                Hello <strong>${recipientName}</strong>,
              </p>

              <!-- Main Notification Message Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px 20px; margin: 18px 0 24px 0;">
                <p style="font-size: 14px; color: #1e293b; line-height: 1.6; margin: 0; white-space: pre-wrap;">
                  ${message}
                </p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/dashboard" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center;">
                      View in Taj Care Portal →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; text-align: center;">
                You received this notification as part of your role (${recipientRole.toUpperCase()}) in Taj Care.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0;">
                Taj Gasoline (Pvt.) Ltd. &bull; Taj Care IT Operations &bull; Automated System Dispatch
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

