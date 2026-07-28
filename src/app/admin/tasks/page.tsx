import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShieldCheck, Plus, CheckCircle2, Clock, AlertTriangle, Calendar, Users, MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import RefreshButton from "@/components/RefreshButton";
import AdminTaskClient from "./AdminTaskClient";

export default async function AdminTasksPage() {
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

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch locations
  const { data: locations } = await supabase.from("locations").select("*").order("name");

  // Fetch responders
  const { data: responders } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "responder")
    .order("full_name");

  // Fetch tasks
  const { data: tasksData } = await supabase
    .from("tasks")
    .select(`
      *,
      location:locations(*),
      creator:profiles!created_by(*),
      task_assignees(responder:profiles(*)),
      task_logs(*, actor:profiles(*))
    `)
    .order("created_at", { ascending: false });

  const tasks = tasksData || [];

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Admin Control Panel
            </span>
            <span className="text-xs font-bold text-slate-500">Operational Task Assignments</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Non-Complaint IT Tasks Module
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assign site setup, hardware deployment, network installation, and preventive maintenance tasks to IT Responders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton />
          <Link
            href="/admin"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin Overview
          </Link>
        </div>
      </div>

      {/* Main Client Module */}
      <AdminTaskClient
        locations={locations || []}
        responders={responders || []}
        tasks={tasks}
      />
    </div>
  );
}
