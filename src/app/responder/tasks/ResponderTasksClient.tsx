"use client";

import { useState } from "react";
import { Task, TaskStatus } from "@/types/database";
import { updateTaskStatusAction } from "@/app/admin/tasks/actions";
import { toast } from "sonner";
import { CheckCircle2, Clock, Eye, X, Loader2, Wrench, AlertTriangle, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import AuditTimeline from "@/components/AuditTimeline";

export default function ResponderTasksClient({ tasks }: { tasks: Task[] }) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updatingTask, setUpdatingTask] = useState<Task | null>(null);
  const [targetStatus, setTargetStatus] = useState<"In Progress" | "Completed" | "Cancelled">("In Progress");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  function handleOpenUpdateModal(t: Task, newStatus: "In Progress" | "Completed" | "Cancelled") {
    setUpdatingTask(t);
    setTargetStatus(newStatus);
    setRemarks("");
  }

  async function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!updatingTask) return;

    if (!remarks.trim()) {
      toast.error("Transition remarks are mandatory!");
      return;
    }

    setLoading(true);
    const result = await updateTaskStatusAction(updatingTask.id, targetStatus, remarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setUpdatingTask(null);
    }
  }

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs shadow-sm">
          No operational tasks assigned to you currently.
        </div>
      ) : (
        tasks.map((task) => {
          const assignees = task.task_assignees || [];
          return (
            <div
              key={task.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-[#0F172A]">
                    Task #{task.task_number}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                      task.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : task.status === "Completed"
                        ? "bg-amber-50 text-amber-700 border-amber-200 font-extrabold"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {task.status}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    Priority: {task.priority}
                  </span>
                </div>

                <span className="text-[11px] text-slate-400">
                  Location: <strong>{task.location?.name}</strong>
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <h3 className="font-bold text-[#0F172A] text-base">{task.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>
                  {task.due_date && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Due: {formatDate(task.due_date)}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Timeline
                  </button>

                  {task.status === "Pending" && (
                    <button
                      onClick={() => handleOpenUpdateModal(task, "In Progress")}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow"
                    >
                      Start Work
                    </button>
                  )}

                  {(task.status === "Pending" || task.status === "In Progress") && (
                    <button
                      onClick={() => handleOpenUpdateModal(task, "Completed")}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Task Update Modal */}
      {updatingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base">
                Update Task #{updatingTask.task_number} → {targetStatus}
              </h3>
              <button onClick={() => setUpdatingTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">
                  Transition Remarks (Mandatory) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Provide progress updates or equipment completion notes..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdatingTask(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white font-bold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details / Timeline Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base">Task #{selectedTask.task_number} Timeline</h3>
              <button onClick={() => setSelectedTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <AuditTimeline logs={selectedTask.task_logs} />
          </div>
        </div>
      )}
    </div>
  );
}
