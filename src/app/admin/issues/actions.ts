"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createIssueAction(formData: FormData) {
  const category = formData.get("category") as string;
  const issueTitle = formData.get("issue_title") as string;
  const complexity = formData.get("complexity") as string;
  const basePoints = parseInt((formData.get("base_points") as string) || "20", 10);
  const resolutionHours = parseInt((formData.get("resolution_time_hours") as string) || "24", 10);
  const resolutionMinutes = parseInt((formData.get("resolution_time_minutes") as string) || "0", 10);

  // Hierarchy response times (Time to respond before auto-escalation)
  const responderHours = parseInt((formData.get("responder_response_hours") as string) || "2", 10);
  const responderMinutes = parseInt((formData.get("responder_response_minutes") as string) || "0", 10);
  const supervisorHours = parseInt((formData.get("supervisor_response_hours") as string) || "2", 10);
  const supervisorMinutes = parseInt((formData.get("supervisor_response_minutes") as string) || "0", 10);
  const lineManagerHours = parseInt((formData.get("line_manager_response_hours") as string) || "2", 10);
  const lineManagerMinutes = parseInt((formData.get("line_manager_response_minutes") as string) || "0", 10);

  if (!category || !issueTitle || !complexity) {
    return { error: "Category, Issue Title, and Complexity are required." };
  }

  const supabase = await createClient();
  let { error } = await supabase.from("predefined_issues").insert({
    category,
    issue_title: issueTitle,
    complexity,
    base_points: basePoints,
    resolution_time_hours: Math.max(0, resolutionHours),
    resolution_time_minutes: Math.min(59, Math.max(0, resolutionMinutes)),
    responder_response_hours: Math.max(0, responderHours),
    responder_response_minutes: Math.min(59, Math.max(0, responderMinutes)),
    supervisor_response_hours: Math.max(0, supervisorHours),
    supervisor_response_minutes: Math.min(59, Math.max(0, supervisorMinutes)),
    line_manager_response_hours: Math.max(0, lineManagerHours),
    line_manager_response_minutes: Math.min(59, Math.max(0, lineManagerMinutes)),
  });

  // If table does not have hierarchy response columns yet, fall back to core fields
  if (error && (error.message.includes("schema cache") || error.message.includes("column"))) {
    const fallback = await supabase.from("predefined_issues").insert({
      category,
      issue_title: issueTitle,
      complexity,
      base_points: basePoints,
      resolution_time_hours: Math.max(0, resolutionHours),
      resolution_time_minutes: Math.min(59, Math.max(0, resolutionMinutes)),
    });
    if (!fallback.error) {
      error = null;
    }
  }

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
  const resolutionHours = parseInt((formData.get("resolution_time_hours") as string) || "24", 10);
  const resolutionMinutes = parseInt((formData.get("resolution_time_minutes") as string) || "0", 10);

  const responderHours = parseInt((formData.get("responder_response_hours") as string) || "2", 10);
  const responderMinutes = parseInt((formData.get("responder_response_minutes") as string) || "0", 10);
  const supervisorHours = parseInt((formData.get("supervisor_response_hours") as string) || "2", 10);
  const supervisorMinutes = parseInt((formData.get("supervisor_response_minutes") as string) || "0", 10);
  const lineManagerHours = parseInt((formData.get("line_manager_response_hours") as string) || "2", 10);
  const lineManagerMinutes = parseInt((formData.get("line_manager_response_minutes") as string) || "0", 10);

  if (!id || !category || !issueTitle || !complexity) {
    return { error: "Missing required fields." };
  }

  const supabase = await createClient();
  let { error } = await supabase
    .from("predefined_issues")
    .update({
      category,
      issue_title: issueTitle,
      complexity,
      base_points: basePoints,
      resolution_time_hours: Math.max(0, resolutionHours),
      resolution_time_minutes: Math.min(59, Math.max(0, resolutionMinutes)),
      responder_response_hours: Math.max(0, responderHours),
      responder_response_minutes: Math.min(59, Math.max(0, responderMinutes)),
      supervisor_response_hours: Math.max(0, supervisorHours),
      supervisor_response_minutes: Math.min(59, Math.max(0, supervisorMinutes)),
      line_manager_response_hours: Math.max(0, lineManagerHours),
      line_manager_response_minutes: Math.min(59, Math.max(0, lineManagerMinutes)),
    })
    .eq("id", id);

  // If table does not have hierarchy response columns yet, fall back to core fields
  if (error && (error.message.includes("schema cache") || error.message.includes("column"))) {
    const fallback = await supabase
      .from("predefined_issues")
      .update({
        category,
        issue_title: issueTitle,
        complexity,
        base_points: basePoints,
        resolution_time_hours: Math.max(0, resolutionHours),
        resolution_time_minutes: Math.min(59, Math.max(0, resolutionMinutes)),
      })
      .eq("id", id);
    if (!fallback.error) {
      error = null;
    }
  }

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
