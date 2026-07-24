import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEMO_USERS = [
  { email: "admin@tajgasoline.com", name: "Zayn Malik (System Admin)", role: "admin", pass: "TajAdmin123!" },
  { email: "responder@tajgasoline.com", name: "Bilal Khan (IT Responder)", role: "responder", pass: "TajResp123!" },
  { email: "sitemanager@tajgasoline.com", name: "Kamran Akmal (Site Manager)", role: "site_manager", pass: "TajSite123!" },
  { email: "employee@tajgasoline.com", name: "Sara Ahmed (HO Staff)", role: "employee", pass: "TajEmp123!" },
];

export async function GET() {
  try {
    const adminClient = createAdminClient();

    // 1. Ensure Locations exist
    let { data: hoLoc } = await adminClient
      .from("locations")
      .select("id")
      .eq("type", "head_office")
      .maybeSingle();

    if (!hoLoc) {
      const { data: newHo } = await adminClient
        .from("locations")
        .insert({ name: "Head Office - 3rd Floor", type: "head_office", city: "Karachi" })
        .select("id")
        .single();
      hoLoc = newHo;
    }

    let { data: siteLoc } = await adminClient
      .from("locations")
      .select("id")
      .eq("type", "fueling_site")
      .maybeSingle();

    if (!siteLoc) {
      const { data: newSite } = await adminClient
        .from("locations")
        .insert({ name: "Clifton Site #101", type: "fueling_site", city: "Karachi" })
        .select("id")
        .single();
      siteLoc = newSite;
    }

    const results: string[] = [];

    // Safely list users
    let existingAuthUsers: any[] = [];
    try {
      const { data: usersList, error: listErr } = await adminClient.auth.admin.listUsers();
      if (!listErr && usersList?.users) {
        existingAuthUsers = usersList.users;
      }
    } catch (e: any) {
      console.warn("Could not list auth users:", e?.message);
    }

    // 2. Process each demo user via official Supabase Auth Admin API
    for (const demo of DEMO_USERS) {
      const locationId = demo.role === "site_manager" ? siteLoc?.id : hoLoc?.id;
      const existingUser = existingAuthUsers.find((u) => u.email?.toLowerCase() === demo.email);

      let userId: string | undefined = existingUser?.id;

      if (existingUser) {
        try {
          // Attempt to delete corrupted user or update password
          const { error: delErr } = await adminClient.auth.admin.deleteUser(existingUser.id);
          if (delErr) {
            // Fallback: update existing user
            await adminClient.auth.admin.updateUserById(existingUser.id, {
              password: demo.pass,
              email_confirm: true,
              user_metadata: { full_name: demo.name, role: demo.role },
            });
            results.push(`Updated password & metadata for existing user ${demo.email}`);
          } else {
            results.push(`Cleaned up stale auth user ${demo.email}`);
            userId = undefined;
          }
        } catch (delExc: any) {
          console.warn(`Delete error for ${demo.email}:`, delExc?.message);
        }
      }

      if (!userId) {
        // Create user via official Supabase Auth API
        const { data: authRes, error: createErr } = await adminClient.auth.admin.createUser({
          email: demo.email,
          password: demo.pass,
          email_confirm: true,
          user_metadata: { full_name: demo.name, role: demo.role },
        });

        if (authRes?.user?.id) {
          userId = authRes.user.id;
          results.push(`Successfully created & configured ${demo.email}`);
        } else if (createErr) {
          // If already exists, find profile
          const { data: prof } = await adminClient.from("profiles").select("id").eq("email", demo.email).maybeSingle();
          if (prof?.id) {
            userId = prof.id;
            await adminClient.auth.admin.updateUserById(userId!, {
              password: demo.pass,
              email_confirm: true,
              user_metadata: { full_name: demo.name, role: demo.role },
            });
            results.push(`Updated existing auth user for ${demo.email}`);
          } else {
            results.push(`Error creating ${demo.email}: ${createErr.message}`);
          }
        }
      }

      if (userId) {
        // Upsert profile
        await adminClient.from("profiles").upsert({
          id: userId,
          full_name: demo.name,
          email: demo.email,
          role: demo.role,
          location_id: locationId || null,
        });

        if (demo.role === "responder" && siteLoc?.id) {
          await adminClient.from("responder_locations").upsert({
            responder_id: userId,
            location_id: siteLoc.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "All 4 demo users processed via official Supabase API!",
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
