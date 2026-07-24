"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createUserAction(formData: FormData) {
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;
  const locationId = (formData.get("location_id") as string) || null;
  const rawLocationIds = formData.getAll("location_ids") as string[];
  const phoneNumber = (formData.get("phone_number") as string) || null;

  if (!fullName || !email || !password || !role) {
    return { error: "Full Name, Email, Password, and Role are required." };
  }

  // Combine locationId and rawLocationIds into a clean set of location IDs
  const locationIdSet = new Set<string>();
  if (locationId) locationIdSet.add(locationId);
  rawLocationIds.forEach((id) => {
    if (id && id.trim().length > 0) locationIdSet.add(id.trim());
  });
  const allLocationIds = Array.from(locationIdSet);
  const primaryLocationId = locationId || (allLocationIds.length > 0 ? allLocationIds[0] : null);

  const adminClient = createAdminClient();

  // Create user in Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (authError) {
    return { error: `Auth Error: ${authError.message}` };
  }

  const userId = authData.user.id;

  // Insert profile record
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    role,
    location_id: primaryLocationId,
    phone_number: phoneNumber || null,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    return { error: `Profile Error: ${profileError.message}` };
  }

  // If role is responder or location bindings provided, insert into responder_locations
  if (role === "responder" || allLocationIds.length > 0) {
    if (allLocationIds.length > 0) {
      const bindingRows = allLocationIds.map((locId) => ({
        responder_id: userId,
        location_id: locId,
      }));

      await adminClient.from("responder_locations").upsert(bindingRows, { onConflict: "responder_id,location_id" });
    }
  }

  revalidatePath("/admin/users");
  return { success: true, message: `User ${fullName} created successfully with assigned location(s)!` };
}

export async function bulkCreateUsersAction(usersList: Array<{
  full_name: string;
  email: string;
  role: string;
  location_name?: string;
  phone_number?: string;
}>) {
  if (!usersList || usersList.length === 0) {
    return { error: "No users provided for import." };
  }

  const adminClient = createAdminClient();

  // Fetch all locations to map location_name -> location_id
  const { data: locations } = await adminClient.from("locations").select("id, name");
  const locationMap = new Map<string, string>();
  locations?.forEach((loc) => {
    locationMap.set(loc.name.trim().toLowerCase(), loc.id);
  });

  let createdCount = 0;
  const errors: string[] = [];

  for (const userRow of usersList) {
    const email = userRow.email?.trim();
    const fullName = userRow.full_name?.trim();
    const role = (userRow.role?.trim().toLowerCase() || "employee");

    if (!email || !fullName) {
      errors.push(`Skipped row: missing email or full_name`);
      continue;
    }

    const defaultPassword = "TajCareTempPassword123!";
    const locId = userRow.location_name
      ? locationMap.get(userRow.location_name.trim().toLowerCase()) || null
      : null;

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

    let userId: string | undefined = authData?.user?.id;

    if (authError) {
      // If user already exists, update profile
      if (authError.message.includes("already")) {
        const { data: existingProfiles } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();

        if (existingProfiles) {
          userId = existingProfiles.id;
          await adminClient.from("profiles").update({
            full_name: fullName,
            role,
            location_id: locId,
            phone_number: userRow.phone_number || null,
          }).eq("id", userId);
          createdCount++;
        } else {
          errors.push(`User ${email}: Auth exists but profile update failed.`);
          continue;
        }
      } else {
        errors.push(`User ${email}: ${authError.message}`);
        continue;
      }
    } else {
      // Insert profile
      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        email,
        role,
        location_id: locId,
        phone_number: userRow.phone_number || null,
      });

      if (profileError) {
        errors.push(`Profile error for ${email}: ${profileError.message}`);
        continue;
      } else {
        createdCount++;
      }
    }

    // Auto-bind responder location if specified
    if (userId && locId && role === "responder") {
      await adminClient.from("responder_locations").upsert({
        responder_id: userId,
        location_id: locId,
      }, { onConflict: "responder_id,location_id" });
    }
  }

  revalidatePath("/admin/users");
  return {
    success: true,
    createdCount,
    totalCount: usersList.length,
    errors,
    message: `Successfully created/updated ${createdCount} of ${usersList.length} users. ${
      errors.length > 0 ? `(${errors.length} skipped/errored)` : ""
    }`,
  };
}

export async function updateResponderBindingAction(
  responderId: string,
  isOnLeave: boolean,
  backupResponderId: string | null,
  locationIds: string[]
) {
  const adminClient = createAdminClient();

  const primaryLoc = locationIds && locationIds.length > 0 ? locationIds[0] : null;

  // Update profile leave status, backup, and primary location
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      is_on_leave: isOnLeave,
      backup_responder_id: backupResponderId || null,
      location_id: primaryLoc,
      updated_at: new Date().toISOString(),
    })
    .eq("id", responderId);

  if (profileError) {
    return { error: profileError.message };
  }

  // Delete existing bindings
  await adminClient
    .from("responder_locations")
    .delete()
    .eq("responder_id", responderId);

  // Insert new bindings
  if (locationIds && locationIds.length > 0) {
    const rows = locationIds.map((locId) => ({
      responder_id: responderId,
      location_id: locId,
    }));

    const { error: bindError } = await adminClient
      .from("responder_locations")
      .insert(rows);

    if (bindError) {
      return { error: `Binding error: ${bindError.message}` };
    }
  }

  revalidatePath("/admin/users");
  return { success: true, message: "Responder bindings and leave status updated successfully!" };
}

export async function deleteUserAction(userId: string) {
  const adminClient = createAdminClient();

  try {
    // Delete dependent references first
    await adminClient.from("ticket_logs").delete().eq("actor_id", userId);
    await adminClient.from("tickets").delete().eq("complainant_id", userId);
    await adminClient.from("tickets").update({ assigned_responder_id: null }).eq("assigned_responder_id", userId);
    await adminClient.from("responder_locations").delete().eq("responder_id", userId);
    await adminClient.from("ticket_drafts").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);

    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error && !error.message.includes("User not found")) {
      return { error: error.message };
    }

    revalidatePath("/admin/users");
    return { success: true, message: "User deleted successfully." };
  } catch (err: any) {
    return { error: err.message || "Failed to delete user." };
  }
}
