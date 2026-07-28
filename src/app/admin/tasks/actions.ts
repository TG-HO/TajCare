"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications/service";

export async function createTaskAction(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const locationId = formData.get("location_id") as string;
  const priority = (formData.get("priority") as string) || "Medium";
  const dueDate = (formData.get("due_date") as string) || null;
  const expectedCompletionDate = (formData.get("expected_completion_date") as string) || null;
  const basePoints = parseInt((formData.get("base_points") as string) || "30", 10);
  const responderIds = formData.getAll("responder_ids") as string[];

  if (!title || !description || !locationId) {
    return { error: "Please provide task title, description, and target site location." };
  }

  if (!responderIds || responderIds.length === 0) {
    return { error: "Please select at least one IT Responder for task assignment." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  // Create task
  const { data: task, error: taskError } = await adminClient
    .from("tasks")
    .insert({
      title,
      description,
      location_id: locationId,
      created_by: user.id,
      priority,
      status: "Pending",
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      expected_completion_date: expectedCompletionDate ? new Date(expectedCompletionDate).toISOString() : null,
      base_points: basePoints,
      points_pending: 0,
      confirmed_points: 0,
    })
    .select()
    .single();

  if (taskError || !task) {
    return { error: `Failed to create operational task: ${taskError?.message}` };
  }

  // Insert assignees bindings
  const assigneeRecords = responderIds.map((rId) => ({
    task_id: task.id,
    responder_id: rId,
  }));

  const { error: assigneeError } = await adminClient.from("task_assignees").insert(assigneeRecords);
  if (assigneeError) {
    return { error: `Task created but failed to bind assignees: ${assigneeError.message}` };
  }

  // Insert initial log
  await adminClient.from("task_logs").insert({
    task_id: task.id,
    actor_id: user.id,
    previous_status: null,
    new_status: "Pending",
    remarks: `Operational task created by Admin. Assigned to ${responderIds.length} IT Responder(s).`,
  });

  // Notify each assigned responder
  for (const rId of responderIds) {
    await createNotification({
      userId: rId,
      actorId: user.id,
      title: "New Operational Task Assigned",
      message: `You were assigned Task #${task.task_number}: "${title}".`,
      type: "task",
      referenceId: task.id,
    });
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Operational Task #${task.task_number} created and assigned successfully!` };
}

export async function updateTaskStatusAction(
  taskId: string,
  newStatus: "In Progress" | "Completed" | "Cancelled",
  remarks: string
) {
  if (!remarks || remarks.trim().length === 0) {
    return { error: "Transition remarks are mandatory for every task status update." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: task } = await adminClient
    .from("tasks")
    .select("status, base_points, task_number, created_by")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };

  const prevStatus = task.status;
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "Completed") {
    updateData.points_pending = task.base_points || 30;
  }

  const { error } = await adminClient.from("tasks").update(updateData).eq("id", taskId);

  if (error) return { error: error.message };

  // Insert log
  await adminClient.from("task_logs").insert({
    task_id: taskId,
    actor_id: user.id,
    previous_status: prevStatus,
    new_status: newStatus,
    remarks,
  });

  // Notify creator / admins
  await createNotification({
    userId: task.created_by,
    actorId: user.id,
    title: `Task #${task.task_number} Updated`,
    message: `Task #${task.task_number} status updated to "${newStatus}". Remarks: ${remarks}`,
    type: "task",
    referenceId: taskId,
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Task status updated to "${newStatus}"!` };
}

export async function approveTaskAction(taskId: string, remarks: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: task } = await adminClient
    .from("tasks")
    .select("*, assignees:task_assignees(responder_id)")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };

  if (task.status !== "Completed") {
    return { error: "Only completed tasks can be approved." };
  }

  const basePts = task.base_points || 30;

  // Update task to Approved and confirm points
  const { error } = await adminClient
    .from("tasks")
    .update({
      status: "Approved",
      confirmed_points: basePts,
      points_pending: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  // Record points transaction and update monthly snapshot for each assignee
  const assignees = task.assignees || [];
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  for (const a of assignees) {
    const respId = a.responder_id;

    // Transaction log
    await adminClient.from("points_transactions").insert({
      task_id: taskId,
      responder_id: respId,
      event_type: "TASK_CONFIRMED",
      base_points: basePts,
      rating_multiplier: 1.0,
      sla_penalty: 0,
      final_points: basePts,
      actor_id: user.id,
      remarks: `Operational Task #${task.task_number} approved by Admin.`,
    });

    // Direct monthly points upsert
    await adminClient.from("responder_monthly_points").upsert({
      responder_id: respId,
      month,
      year,
      confirmed_points: basePts,
      closed_complaints: 1,
    }, { onConflict: "responder_id,month,year" });

    // Notify responder
    await createNotification({
      userId: respId,
      actorId: user.id,
      title: "Task Approved & Points Confirmed",
      message: `Task #${task.task_number} approved by Admin. +${basePts} confirmed points credited!`,
      type: "points",
      referenceId: taskId,
    });
  }

  // Insert log
  await adminClient.from("task_logs").insert({
    task_id: taskId,
    actor_id: user.id,
    previous_status: "Completed",
    new_status: "Approved",
    remarks: remarks || "Operational task approved by Admin.",
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Task #${task.task_number} approved! Points confirmed for assignees.` };
}
