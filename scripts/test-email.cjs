/**
 * Taj Care - SMTP Email Diagnostic CLI Utility
 * Run anytime using: npm run test:email
 */

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ Error: .env.local file not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
});

const host = env.SMTP_HOST || "mail.tajcorporation.com";
const port = parseInt(env.SMTP_PORT || "587", 10);
const user = env.SMTP_USER || "no-reply@tajcorporation.com";
const pass = env.SMTP_PASS || "";
const from = env.SMTP_FROM || user;
const target = env.EMAIL_OVERRIDE_TO || user;

console.log("\n=======================================================");
console.log("   TAJ CARE • SMTP EMAIL SERVICE DIAGNOSTIC TOOL");
console.log("=======================================================");
console.log(`📡 Host:             ${host}`);
console.log(`🔌 Port:             ${port} (STARTTLS)`);
console.log(`👤 User / Sender:    ${user}`);
console.log(`🔑 Password Length:  ${pass.length} characters`);
console.log(`🎯 Delivery Target:  ${target}`);
console.log("=======================================================\n");

async function run() {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    process.stdout.write("1. Verifying SMTP connection and credentials... ");
    await transporter.verify();
    console.log("✅ OK");

    process.stdout.write(`2. Dispatching test email to ${target}... `);
    const info = await transporter.sendMail({
      from,
      to: target,
      subject: "✅ [Taj Care] SMTP Escalation Email System Verified",
      text: `Taj Care Escalation Mailer is ONLINE!\n\nHost: ${host}:${port}\nSender: ${from}\nDelivered To: ${target}\nTime: ${new Date().toLocaleString()}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background-color: #0f172a; padding: 20px 24px; border-bottom: 3px solid #10b981;">
            <span style="font-size: 11px; font-weight: 800; color: #10b981; letter-spacing: 1.5px; text-transform: uppercase;">TAJ CARE HELP DESK</span>
            <h2 style="color: #ffffff; margin: 6px 0 0 0; font-size: 20px;">✅ SMTP Email System Verified</h2>
          </div>
          <div style="padding: 24px;">
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">
              Your Microsoft Exchange SMTP configuration has authenticated and successfully dispatched an operational test message!
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0;">
              <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 140px;">Server:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${host}:${port}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold;">Sender Account:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${from}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold;">Delivered To:</td>
                  <td style="padding: 6px 0; color: #4338ca; font-weight: bold;">${target}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold;">Timestamp:</td>
                  <td style="padding: 6px 0;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
              Whenever an SLA response time threshold breaches (Level 1 Supervisor, Level 2 Line Manager, Level 3 HOD & Admin), this system will automatically trigger notification emails.
            </p>
          </div>
        </div>
      `,
    });

    console.log("✅ OK");
    console.log(`\n🎉 Message delivered successfully! Message ID: ${info.messageId}\n`);
    process.exit(0);
  } catch (err) {
    console.log("❌ FAILED");
    console.error("\n[Error Details]:", err.message);
    console.log("\nTroubleshooting tips:");
    console.log("1. Check that SMTP_PASS in .env.local matches your email password.");
    console.log("2. Ensure the sender has Exchange Send-As permissions.");
    process.exit(1);
  }
}

run();
