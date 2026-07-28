import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Task } from "@/types/database";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import ResponderTasksClient from "./ResponderTasksClient";

export default async function ResponderTasksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "responder" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch tasks assigned to this responder via task_assignees
  const { data: assignees } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("responder_id", user.id);

  const taskIds = (assignees || []).map((a) => a.task_id);

  let tasks: Task[] = [];
  if (taskIds.length > 0) {
    const { data: tasksData } = await supabase
      .from("tasks")
      .select(`
        *,
        location:locations(*),
        creator:profiles!created_by(*),
        task_assignees(responder:profiles(*)),
        task_logs(*, actor:profiles(*))
      `)
      .in("id", taskIds)
      .order("created_at", { ascending: false });

    tasks = (tasksData || []) as unknown as Task[];
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              IT Operations
            </span>
            <span className="text-xs font-bold text-slate-500">My Operational Tasks</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Assigned Non-Complaint Tasks ({tasks.length})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Site setups, equipment deployments, network upgrades, and maintenance assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton />
          <Link
            href="/responder"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Queue
          </Link>
        </div>
      </div>

      <ResponderTasksClient tasks={tasks} />
    </div>
  );
}
