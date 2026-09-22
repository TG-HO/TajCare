import { createAdminClient } from "@/lib/supabase/admin";
import { sendGeneralNotificationEmail } from "@/lib/email/mailer";

export async function createNotification({
  userId,
  actorId,
  title,
  message,
  type = "info",
  referenceId,
  skipEmail = false,
}: {
  userId: string;
  actorId?: string | null;
  title: string;
  message: string;
  type?: string;
  referenceId?: string | null;
  skipEmail?: boolean;
}) {
  try {
    const adminClient = createAdminClient();
    
    // 1. Insert in-app notification
    await adminClient.from("notifications").insert({
      user_id: userId,
      actor_id: actorId || null,
      title,
      message,
      type,
      reference_id: referenceId || null,
    });

    // 2. Dispatch email notification via SMTP
    if (!skipEmail) {
      try {
        const { data: recipientProfile } = await adminClient
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("id", userId)
          .single();

        if (recipientProfile && recipientProfile.email) {
          sendGeneralNotificationEmail({
            to: recipientProfile.email,
            recipientName: recipientProfile.full_name || "User",
            recipientRole: recipientProfile.role || "user",
            title,
            message,
            type,
            referenceId,
          }).catch((err) => {
            console.error(`[Notification Mailer] Error sending to ${recipientProfile.email}:`, err);
          });
        }
      } catch (profileErr) {
        console.error("[Notification Mailer] Failed fetching recipient profile for email:", profileErr);
      }
    }
  } catch (err) {
    console.error("Failed to insert notification:", err);
  }
}

export async function createRoleNotifications({
  role,
  actorId,
  title,
  message,
  type = "info",
  referenceId,
  skipEmail = false,
}: {
  role: "admin" | "responder" | "site_manager" | "supervisor" | "line_manager" | "hod" | "employee";
  actorId?: string | null;
  title: string;
  message: string;
  type?: string;
  referenceId?: string | null;
  skipEmail?: boolean;
}) {
  try {
    const adminClient = createAdminClient();
    const { data: users } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", role);

    if (users && users.length > 0) {
      for (const u of users) {
        await createNotification({
          userId: u.id,
          actorId,
          title,
          message,
          type,
          referenceId,
          skipEmail,
        });
      }
    }
  } catch (err) {
    console.error("Failed to insert role notifications:", err);
  }
}
