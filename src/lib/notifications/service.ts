import { createAdminClient } from "@/lib/supabase/admin";

export async function createNotification({
  userId,
  actorId,
  title,
  message,
  type = "info",
  referenceId,
}: {
  userId: string;
  actorId?: string | null;
  title: string;
  message: string;
  type?: string;
  referenceId?: string | null;
}) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from("notifications").insert({
      user_id: userId,
      actor_id: actorId || null,
      title,
      message,
      type,
      reference_id: referenceId || null,
    });
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
}: {
  role: "admin" | "responder" | "site_manager";
  actorId?: string | null;
  title: string;
  message: string;
  type?: string;
  referenceId?: string | null;
}) {
  try {
    const adminClient = createAdminClient();
    const { data: users } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", role);

    if (users && users.length > 0) {
      const records = users.map((u) => ({
        user_id: u.id,
        actor_id: actorId || null,
        title,
        message,
        type,
        reference_id: referenceId || null,
      }));
      await adminClient.from("notifications").insert(records);
    }
  } catch (err) {
    console.error("Failed to insert role notifications:", err);
  }
}
