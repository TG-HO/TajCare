"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveDatabaseDraftAction(data: {
  issue_type_id?: string | null;
  custom_issue_title?: string | null;
  description?: string | null;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Unauthorized" };
    }

    // Sanitize issue_type_id ("OTHER" -> null for UUID column)
    const rawIssueTypeId = data.issue_type_id;
    const sanitizedIssueTypeId = rawIssueTypeId && rawIssueTypeId !== "OTHER" ? rawIssueTypeId : null;

    const { error } = await supabase.from("ticket_drafts").upsert(
      {
        user_id: user.id,
        issue_type_id: sanitizedIssueTypeId,
        custom_issue_title: data.custom_issue_title || null,
        description: data.description || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      if (error.message?.includes("ticket_drafts") || error.code === "PGRST204" || error.code === "42P01") {
        return { error: "Drafts table missing in database. Please run the master migration script in Supabase SQL Editor." };
      }
      return { error: error.message };
    }

    revalidatePath("/tickets/new");
    return { success: true, message: "Draft saved to database for your account!" };
  } catch (err: any) {
    return { error: err.message || "Failed to save draft." };
  }
}

export async function loadDatabaseDraftAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("ticket_drafts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function clearDatabaseDraftAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("ticket_drafts").delete().eq("user_id", user.id);
    revalidatePath("/tickets/new");
  } catch {
    // Ignore clear errors
  }
}
