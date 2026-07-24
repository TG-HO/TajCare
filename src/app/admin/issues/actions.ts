"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createIssueAction(formData: FormData) {
  const category = formData.get("category") as string;
  const issueTitle = formData.get("issue_title") as string;
  const complexity = formData.get("complexity") as string;
  const basePoints = parseInt((formData.get("base_points") as string) || "20", 10);

  if (!category || !issueTitle || !complexity) {
    return { error: "Category, Issue Title, and Complexity are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("predefined_issues").insert({
    category,
    issue_title: issueTitle,
    complexity,
    base_points: basePoints,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/issues");
  return { success: true, message: `Predefined Issue "${issueTitle}" created!` };
}

export async function updateIssueAction(id: string, formData: FormData) {
  const category = formData.get("category") as string;
  const issueTitle = formData.get("issue_title") as string;
  const complexity = formData.get("complexity") as string;
  const basePoints = parseInt((formData.get("base_points") as string) || "20", 10);

  if (!id || !category || !issueTitle || !complexity) {
    return { error: "Missing required fields." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("predefined_issues")
    .update({
      category,
      issue_title: issueTitle,
      complexity,
      base_points: basePoints,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/issues");
  return { success: true, message: `Predefined Issue "${issueTitle}" updated!` };
}

export async function deleteIssueAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("predefined_issues")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/issues");
  return { success: true, message: "Issue removed from predefined catalog." };
}
