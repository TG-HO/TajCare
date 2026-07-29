"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications/service";

/**
 * Step 1: Admin Creates Task with First Visit Date (Due Date optional)
 */
export async function createTaskAction(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const locationId = formData.get("location_id") as string;
  const priority = (formData.get("priority") as string) || "Medium";
  const firstVisitDate = (formData.get("first_visit_date") as string) || null;
  const dueDate = (formData.get("due_date") as string) || null;
  const basePoints = parseInt((formData.get("base_points") as string) || "30", 10);
  const responderIds = formData.getAll("responder_ids") as string[];

  if (!title || !description || !locationId) {
    return { error: "Please provide task title, description, and target site location." };
  }

  if (!firstVisitDate) {
    return { error: "Please assign a First Visit Date for this operational task." };
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

  const initialStatus = dueDate ? "Due Date Assigned" : "First Visit Assigned";

  // Create task
  const { data: task, error: taskError } = await adminClient
    .from("tasks")
    .insert({
      title,
      description,
      location_id: locationId,
      created_by: user.id,
      priority,
      status: initialStatus,
      first_visit_date: new Date(firstVisitDate).toISOString(),
      current_visit_number: 1,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
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

  // Insert Visit #1 in task_visits
  await adminClient.from("task_visits").insert({
    task_id: task.id,
    visit_number: 1,
    assigned_visit_date: new Date(firstVisitDate).toISOString(),
    status: "Scheduled",
    admin_action: "first_visit_created",
  });

  // Insert initial task log
  await adminClient.from("task_logs").insert({
    task_id: task.id,
    actor_id: user.id,
    previous_status: null,
    new_status: initialStatus,
    remarks: `Operational Task #${task.task_number} created by Admin. First Visit assigned for ${new Date(firstVisitDate).toLocaleString()}.`,
  });

  // Notify each assigned responder
  for (const rId of responderIds) {
    await createNotification({
      userId: rId,
      actorId: user.id,
      title: "New Operational Task Assigned",
      message: `Task #${task.task_number}: "${title}". First Visit Date: ${new Date(firstVisitDate).toLocaleDateString()}.`,
      type: "task",
      referenceId: task.id,
    });
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Operational Task #${task.task_number} created! First Visit scheduled.` };
}

/**
 * Step 2 & 3: IT Responder Marks Visit Completed ("Visited")
 */
export async function responderMarkVisitedAction(
  taskId: string,
  remarks: string,
  attachments: string[] = []
) {
  if (!remarks || remarks.trim().length === 0) {
    return { error: "Visit remarks are mandatory when marking site visit completed." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: task } = await adminClient
    .from("tasks")
    .select("status, current_visit_number, task_number, created_by")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };

  const visitNum = task.current_visit_number || 1;

  // Update active visit record in task_visits
  await adminClient
    .from("task_visits")
    .update({
      actual_visit_date: new Date().toISOString(),
      responder_id: user.id,
      status: "Visited",
      remarks,
      attachments,
      updated_at: new Date().toISOString(),
    })
    .eq("task_id", taskId)
    .eq("visit_number", visitNum);

  // Update task status to Visited
  const prevStatus = task.status;
  await adminClient
    .from("tasks")
    .update({
      status: "Visited",
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  // Task log
  await adminClient.from("task_logs").insert({
    task_id: taskId,
    actor_id: user.id,
    previous_status: prevStatus,
    new_status: "Visited",
    remarks: `Visit #${visitNum} completed by IT Responder. Remarks: ${remarks}`,
  });

  // Notify Admin
  await createNotification({
    userId: task.created_by,
    actorId: user.id,
    title: `Task #${task.task_number} — Visit #${visitNum} Completed`,
    message: `IT Responder marked Visit #${visitNum} as Visited. Remarks: ${remarks}`,
    type: "task",
    referenceId: taskId,
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Visit #${visitNum} marked as Completed ("Visited")!` };
}

/**
 * Step 4 & 5A: Admin Option A — Assign Next Visit Date (Cycle N+1)
 */
export async function adminScheduleNextVisitAction(
  taskId: string,
  nextVisitDate: string,
  adminRemarks: string
) {
  if (!nextVisitDate) {
    return { error: "Please select a valid Next Visit Date." };
  }

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

  const nextVisitNum = (task.current_visit_number || 1) + 1;
  const visitStatus = `Next Visit Assigned`;

  // Update task
  await adminClient
    .from("tasks")
    .update({
      status: visitStatus,
      current_visit_number: nextVisitNum,
      next_visit_date: new Date(nextVisitDate).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  // Insert Visit #N+1 into task_visits
  await adminClient.from("task_visits").insert({
    task_id: taskId,
    visit_number: nextVisitNum,
    assigned_visit_date: new Date(nextVisitDate).toISOString(),
    status: "Scheduled",
    admin_action: "next_visit_assigned",
  });

  // Log
  await adminClient.from("task_logs").insert({
    task_id: taskId,
    actor_id: user.id,
    previous_status: task.status,
    new_status: visitStatus,
    remarks: `Admin scheduled Visit #${nextVisitNum} for ${new Date(nextVisitDate).toLocaleString()}. ${adminRemarks || ""}`,
  });

  // Notify assignees
  const assignees = task.assignees || [];
  for (const a of assignees) {
    await createNotification({
      userId: a.responder_id,
      actorId: user.id,
      title: `Task #${task.task_number} — Visit #${nextVisitNum} Scheduled`,
      message: `Admin scheduled Visit #${nextVisitNum} for ${new Date(nextVisitDate).toLocaleDateString()}.`,
      type: "task",
      referenceId: taskId,
    });
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Visit #${nextVisitNum} scheduled for ${new Date(nextVisitDate).toLocaleDateString()}!` };
}

/**
 * Step 4 & 5B: Admin Option B — Assign Final Due Date
 */
export async function adminAssignDueDateAction(
  taskId: string,
  dueDate: string,
  adminRemarks: string
) {
  if (!dueDate) {
    return { error: "Please select a valid Due Date." };
  }

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

  // Update task to Due Date Assigned
  await adminClient
    .from("tasks")
    .update({
      status: "Due Date Assigned",
      due_date: new Date(dueDate).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  // Log
  await adminClient.from("task_logs").insert({
    task_id: taskId,
    actor_id: user.id,
    previous_status: task.status,
    new_status: "Due Date Assigned",
    remarks: `Admin assigned Due Date (${new Date(dueDate).toLocaleString()}). Complete Task button is now active. ${adminRemarks || ""}`,
  });

  // Notify assignees
  const assignees = task.assignees || [];
  for (const a of assignees) {
    await createNotification({
      userId: a.responder_id,
      actorId: user.id,
      title: `Task #${task.task_number} — Due Date Assigned`,
      message: `Due Date assigned: ${new Date(dueDate).toLocaleDateString()}. You can now complete this task.`,
      type: "task",
      referenceId: taskId,
    });
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Due Date assigned! Responders can now mark task completed.` };
}

/**
 * Step 6: IT Responder Completes Task (Only allowed after Due Date Assigned)
 */
export async function responderCompleteTaskAction(
  taskId: string,
  remarks: string,
  attachments: string[] = []
) {
  if (!remarks || remarks.trim().length === 0) {
    return { error: "Completion remarks are mandatory when finishing an operational task." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: task } = await adminClient
    .from("tasks")
    .select("status, due_date, base_points, task_number, created_by")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };

  if (task.status !== "Due Date Assigned" && !task.due_date) {
    return { error: "Task cannot be completed yet. Admin must assign a Due Date first." };
  }

  const prevStatus = task.status;
  await adminClient
    .from("tasks")
    .update({
      status: "Completed",
      points_pending: task.base_points || 30,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  // Log
  await adminClient.from("task_logs").insert({
    task_id: taskId,
    actor_id: user.id,
    previous_status: prevStatus,
    new_status: "Completed",
    remarks: `Task marked Completed by IT Responder. Remarks: ${remarks}`,
  });

  // Notify Admin
  await createNotification({
    userId: task.created_by,
    actorId: user.id,
    title: `Task #${task.task_number} Marked Completed`,
    message: `IT Responder marked Task #${task.task_number} completed. Pending Admin final closure and rating.`,
    type: "task",
    referenceId: taskId,
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Task #${task.task_number} marked Completed! Awaiting Admin final closure & rating.` };
}

/**
 * Step 7: Admin Final Closure & Rating (Points Released)
 */
export async function adminCloseTaskAction(
  taskId: string,
  rating: number,
  closureRemarks: string
) {
  if (!rating || rating < 1 || rating > 5) {
    return { error: "Please select a valid star rating (1-5 stars)." };
  }

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

  const ratingMultipliers: Record<number, number> = {
    5: 1.5,
    4: 1.25,
    3: 1.0,
    2: 0.8,
    1: 0.5,
  };

  const multiplier = ratingMultipliers[rating] || 1.0;
  const basePts = task.base_points || 30;
  const finalConfirmedPoints = Math.max(0, Math.round(basePts * multiplier));

  // Update task to Closed
  const { error } = await adminClient
    .from("tasks")
    .update({
      status: "Closed",
      closure_rating: rating,
      closure_remarks: closureRemarks,
      confirmed_points: finalConfirmedPoints,
      points_pending: 0,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  // Record points transaction & update monthly ledger for each assignee
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
      rating_multiplier: multiplier,
      sla_penalty: 0,
      final_points: finalConfirmedPoints,
      actor_id: user.id,
      remarks: `Operational Task #${task.task_number} closed & rated ${rating}★ by Admin.`,
    });

    // Monthly snapshot upsert
    await adminClient.from("responder_monthly_points").upsert({
      responder_id: respId,
      month,
      year,
      confirmed_points: finalConfirmedPoints,
      closed_complaints: 1,
    }, { onConflict: "responder_id,month,year" });

    // Notify responder
    await createNotification({
      userId: respId,
      actorId: user.id,
      title: "Task Closed — Points Released!",
      message: `Task #${task.task_number} closed & rated ${rating}★ by Admin. +${finalConfirmedPoints} confirmed points credited!`,
      type: "points",
      referenceId: taskId,
    });
  }

  // Insert log
  await adminClient.from("task_logs").insert({
    task_id: taskId,
    actor_id: user.id,
    previous_status: task.status,
    new_status: "Closed",
    remarks: `Task closed by Admin. Final Rating: ${rating} Stars. ${closureRemarks || ""}`,
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/responder/tasks");
  revalidatePath("/responder");

  return { success: true, message: `Task #${task.task_number} closed & rated ${rating}★! +${finalConfirmedPoints} points released.` };
}
