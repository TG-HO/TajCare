/**
 * Taj Care - Corporate Transactional Email Notification System
 */

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmailNotification(payload: EmailPayload) {
  // Console log payload & simulate transactional dispatch
  console.log(`[EMAIL NOTIFICATION SENT] To: ${payload.to} | Subject: ${payload.subject}`);
  return { success: true, messageId: `msg_${Date.now()}` };
}

export function buildEmailTemplate(title: string, bodyContent: string, actionUrl?: string, actionText?: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; color: #0F172A; margin: 0; padding: 20px; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; }
          .header { background: #0F172A; color: #ffffff; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; tracking-tight; }
          .content { padding: 32px 24px; font-size: 14px; line-height: 1.6; }
          .btn { display: inline-block; background: #0F172A; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
          .footer { background: #F8FAFC; padding: 16px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Taj Care • IT Ticket Portal</h1>
          </div>
          <div class="content">
            <h2 style="margin-top: 0; color: #0F172A;">${title}</h2>
            ${bodyContent}
            ${
              actionUrl && actionText
                ? `<p><a href="${actionUrl}" class="btn">${actionText}</a></p>`
                : ""
            }
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Taj Gasoline IT Operations. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendNewTicketEmail(responderEmail: string, ticketNumber: number, complainantName: string, locationName: string, description: string) {
  const html = buildEmailTemplate(
    `New Ticket #${ticketNumber} Assigned`,
    `<p>A new IT support complaint has been submitted and assigned to your queue:</p>
     <ul>
       <li><strong>Complainant:</strong> ${complainantName}</li>
       <li><strong>Location:</strong> ${locationName}</li>
       <li><strong>Description:</strong> ${description}</li>
     </ul>`,
    `http://localhost:3000/responder`,
    "Open Responder Portal"
  );

  return sendEmailNotification({
    to: responderEmail,
    subject: `[Taj Care] New Ticket #${ticketNumber} Assigned - ${locationName}`,
    html,
  });
}

export async function sendVisitScheduledEmail(complainantEmail: string, ticketNumber: number, visitDate: string, remarks: string) {
  const html = buildEmailTemplate(
    `Site Visit Scheduled for Ticket #${ticketNumber}`,
    `<p>Your IT Responder has scheduled a site visit for your complaint:</p>
     <ul>
       <li><strong>Scheduled Visit:</strong> ${visitDate}</li>
       <li><strong>Responder Remarks:</strong> ${remarks}</li>
     </ul>`,
    `http://localhost:3000/dashboard`,
    "View Complaint Status"
  );

  return sendEmailNotification({
    to: complainantEmail,
    subject: `[Taj Care] Site Visit Scheduled - Ticket #${ticketNumber}`,
    html,
  });
}

export async function sendIssueResolvedEmail(complainantEmail: string, ticketNumber: number, remarks: string) {
  const html = buildEmailTemplate(
    `Issue Resolved - Ticket #${ticketNumber}`,
    `<p>Your IT support request has been marked <strong>Issue Resolved</strong>.</p>
     <p><strong>Resolution Remarks:</strong> ${remarks}</p>
     <p>Please log in to your dashboard to rate the service quality and close the ticket.</p>`,
    `http://localhost:3000/dashboard`,
    "Rate & Close Ticket"
  );

  return sendEmailNotification({
    to: complainantEmail,
    subject: `[Taj Care] Action Required: Rate & Close Ticket #${ticketNumber}`,
    html,
  });
}
