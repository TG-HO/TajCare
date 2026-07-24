"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const DEMO_USERS: Record<
  string,
  { name: string; role: "admin" | "responder" | "site_manager" | "employee"; pass: string }
> = {
  "admin@tajgasoline.com": { name: "Zayn Malik (System Admin)", role: "admin", pass: "TajAdmin123!" },
  "responder@tajgasoline.com": { name: "Bilal Khan (IT Responder)", role: "responder", pass: "TajResp123!" },
  "sitemanager@tajgasoline.com": { name: "Kamran Akmal (Site Manager)", role: "site_manager", pass: "TajSite123!" },
  "employee@tajgasoline.com": { name: "Sara Ahmed (HO Staff)", role: "employee", pass: "TajEmp123!" },
};

function extractErrorMessage(err: any): string {
  if (!err) return "Invalid email or password.";
  if (typeof err === "string" && err.trim().length > 0 && err !== "{}" && err !== "[object Object]") {
    return err;
  }
  if (typeof err === "object") {
    if (typeof err.message === "string" && err.message.trim().length > 0) {
      return err.message;
    }
    if (typeof err.error_description === "string" && err.error_description.trim().length > 0) {
      return err.error_description;
    }
  }
  return "Invalid email or password.";
}

export async function loginAction(formData: FormData) {
  try {
    const email = (formData.get("email") as string)?.trim()?.toLowerCase();
    const password = (formData.get("password") as string)?.trim();

    if (!email || !password) {
      return { error: "Email and password are required." };
    }

    const supabase = await createClient();

    let { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Auto-fix / sync demo user password if attempted login with valid demo credentials fails
    if (error && DEMO_USERS[email] && password === DEMO_USERS[email].pass) {
      try {
        const adminClient = createAdminClient();
        const demoConfig = DEMO_USERS[email];

        // Ensure default location exists
        let { data: loc } = await adminClient.from("locations").select("id").limit(1).maybeSingle();
        if (!loc) {
          const { data: newLoc } = await adminClient
            .from("locations")
            .insert({
              name: demoConfig.role === "site_manager" ? "Clifton Site #101" : "Head Office - 3rd Floor",
              type: demoConfig.role === "site_manager" ? "fueling_site" : "head_office",
              city: "Karachi",
            })
            .select("id")
            .single();
          loc = newLoc;
        }

        // Check if profile exists (which gives us the exact auth user ID)
        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        let userId = existingProfile?.id;

        if (userId) {
          // Update password for existing user in Supabase Auth
          const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: { full_name: demoConfig.name, role: demoConfig.role },
          });

          if (updateErr) {
            console.error("updateUserById error:", updateErr.message);
          }
        } else {
          // Create new user in Supabase Auth
          const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: demoConfig.name, role: demoConfig.role },
          });

          if (createErr && createErr.message.includes("already")) {
            // Fallback: list users to find ID
            const { data: usersList } = await adminClient.auth.admin.listUsers();
            const foundUser = usersList?.users?.find((u) => u.email?.toLowerCase() === email);
            if (foundUser) {
              userId = foundUser.id;
              await adminClient.auth.admin.updateUserById(userId, {
                password,
                email_confirm: true,
              });
            }
          } else {
            userId = newUser?.user?.id;
          }
        }

        if (userId) {
          // Ensure profile is synced
          await adminClient.from("profiles").upsert({
            id: userId,
            full_name: demoConfig.name,
            email,
            role: demoConfig.role,
            location_id: loc?.id || null,
          });

          if (demoConfig.role === "responder" && loc?.id) {
            await adminClient.from("responder_locations").upsert({
              responder_id: userId,
              location_id: loc.id,
            });
          }

          // Retry sign in
          const retryRes = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          error = retryRes.error;
        }
      } catch (syncErr: any) {
        console.error("Demo user sync error:", syncErr);
      }
    }

    if (error) {
      return { error: extractErrorMessage(error) };
    }

    // Retrieve user session & role
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Failed to retrieve user session." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role || user.user_metadata?.role;

    let targetPath = "/dashboard";
    if (role === "admin") {
      targetPath = "/admin";
    } else if (role === "responder") {
      targetPath = "/responder";
    }

    return { success: true, redirectUrl: targetPath };
  } catch (err: any) {
    return { error: extractErrorMessage(err) };
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
