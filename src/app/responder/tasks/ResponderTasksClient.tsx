"use client";

import { useState } from "react";
import { Task, TaskVisit } from "@/types/database";
import { responderMarkVisitedAction, responderCompleteTaskAction } from "@/app/admin/tasks/actions";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Eye,
  X,
  Loader2,
  MapPin,
  Calendar,
  AlertTriangle,
  History,
  Lock,
  Send,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import AuditTimeline from "@/components/AuditTimeline";

export default function ResponderTasksClient({ tasks }: { tasks: Task[] }) {
  const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState<Task | null>(null);
  
  // Visit Modal State
  const [visitingTask, setVisitingTask] = useState<Task | null>(null);
  const [visitRemarks, setVisitRemarks] = useState("");
  
  // Complete Modal State
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleMarkVisitedSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!visitingTask) return;

    if (!visitRemarks.trim()) {
      toast.error("Visit remarks are mandatory when marking site visit completed.");
      return;
    }

    setLoading(true);
    const result = await responderMarkVisitedAction(visitingTask.id, visitRemarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setVisitingTask(null);
      setVisitRemarks("");
    }
  }

  async function handleCompleteTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completingTask) return;

    if (!completionRemarks.trim()) {
      toast.error("Completion remarks are mandatory when finishing an operational task.");
      return;
    }

    setLoading(true);
    const result = await responderCompleteTaskAction(completingTask.id, completionRemarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setCompletingTask(null);
      setCompletionRemarks("");
    }
  }

  return (
    <div className="space-y-4 text-xs">
      {tasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs shadow-sm">
          No operational tasks assigned to you currently.
        </div>
      ) : (
        tasks.map((task) => {
          const visits = task.task_visits || [];
          const isDueDateAssigned = task.status === "Due Date Assigned" || Boolean(task.due_date);
          const isClosed = task.status === "Closed" || task.status === "Approved";
          const isCompleted = task.status === "Completed";
          const isVisited = task.status === "Visited";

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
                      isClosed
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isCompleted
                        ? "bg-amber-50 text-amber-700 border-amber-300 font-extrabold"
                        : isVisited
                        ? "bg-purple-50 text-purple-700 border-purple-300 font-extrabold"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {task.status}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    Visit Cycle #{task.current_visit_number || 1}
                  </span>
                </div>

                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Site: <strong>{task.location?.name}</strong>
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <h3 className="font-bold text-[#0F172A] text-base">{task.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
                    {task.first_visit_date && (
                      <span className="flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" /> First Visit: {formatDate(task.first_visit_date)}
                      </span>
                    )}

                    {task.due_date ? (
                      <span className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Due: {formatDate(task.due_date)}
                      </span>
                    ) : (
                      <span className="text-[11px] italic text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" /> Complete Task button active after Admin assigns Due Date
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedTaskForTimeline(task)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    Visit History ({visits.length})
                  </button>

                  {/* CASE 1: Status is Due Date Assigned -> Show ONLY Complete Task button (No Mark Visited) */}
                  {!isCompleted && !isClosed && task.status === "Due Date Assigned" && (
                    <button
                      onClick={() => setCompletingTask(task)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 animate-pulse"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Complete Task
                    </button>
                  )}

                  {/* CASE 2: Status is Active Visit Cycle (First Visit Assigned / Next Visit Assigned / Pending) -> Show Mark Visited Button */}
                  {!isCompleted && !isClosed && task.status !== "Due Date Assigned" && (
                    isVisited ? (
                      <button
                        disabled
                        title="Visit marked. Awaiting Admin to schedule Next Visit or Assign Due Date."
                        className="px-3.5 py-2 bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-not-allowed opacity-80"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                        Visit #{task.current_visit_number || 1} Marked (Awaiting Admin)
                      </button>
                    ) : (
                      <button
                        onClick={() => setVisitingTask(task)}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Mark Visited (Cycle #{task.current_visit_number || 1})
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Mark Visited Modal */}
      {visitingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600" />
                Mark Visit Completed (Cycle #{visitingTask.current_visit_number || 1})
              </h3>
              <button onClick={() => setVisitingTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMarkVisitedSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-purple-700">Task Summary</span>
                <p className="font-bold text-[#0F172A]">{visitingTask.title}</p>
                <p className="text-slate-600">Location: {visitingTask.location?.name}</p>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">
                  Site Visit Remarks (Mandatory) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={visitRemarks}
                  onChange={(e) => setVisitRemarks(e.target.value)}
                  placeholder="Describe site conditions, work performed, findings, or equipment status..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVisitingTask(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Visit Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      {completingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Complete Operational Task #{completingTask.task_number}
              </h3>
              <button onClick={() => setCompletingTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteTaskSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-700">Final Task Submission</span>
                <p className="font-bold text-[#0F172A]">{completingTask.title}</p>
                <p className="text-slate-600">
                  Submitting completion sends task to Admin for final closure, rating, and points release.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">
                  Completion Remarks & Deliverables Summary *
                </label>
                <textarea
                  required
                  rows={4}
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  placeholder="Summarize final resolution, tested hardware/software, and operational handover notes..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Task Completion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Visit History Timeline Modal */}
      {selectedTaskForTimeline && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-600" />
                  Task #{selectedTaskForTimeline.task_number} Visit History & Audit
                </h3>
                <p className="text-xs text-slate-500">{selectedTaskForTimeline.title}</p>
              </div>
              <button onClick={() => setSelectedTaskForTimeline(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visit Cycles Timeline */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                Visit History Timeline ({(selectedTaskForTimeline.task_visits || []).length} visits)
              </h4>

              {(selectedTaskForTimeline.task_visits || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl">No visits recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {(selectedTaskForTimeline.task_visits || []).map((v) => (
                    <div key={v.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#0F172A] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          Visit #{v.visit_number} — Assigned: {formatDate(v.assigned_visit_date)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                            v.status === "Visited"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>

                      {v.actual_visit_date && (
                        <p className="text-[11px] text-slate-600">
                          Actual Visit Completed: <strong>{formatDate(v.actual_visit_date)}</strong>
                        </p>
                      )}

                      {v.remarks && (
                        <p className="text-xs italic text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1">
                          &quot;{v.remarks}&quot;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Task Activity Log */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">Activity Audit Log</h4>
              <AuditTimeline logs={selectedTaskForTimeline.task_logs} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
