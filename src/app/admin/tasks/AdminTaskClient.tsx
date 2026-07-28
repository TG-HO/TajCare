"use client";

import { useState } from "react";
import { Location, Profile, Task } from "@/types/database";
import { createTaskAction, approveTaskAction } from "./actions";
import { toast } from "sonner";
import { Plus, CheckCircle2, Clock, AlertTriangle, Calendar, Users, MapPin, X, Loader2, Eye, Award } from "lucide-react";
import { formatDate } from "@/lib/utils";
import AuditTimeline from "@/components/AuditTimeline";

export default function AdminTaskClient({
  locations,
  responders,
  tasks,
}: {
  locations: Location[];
  responders: Profile[];
  tasks: Task[];
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [basePoints, setBasePoints] = useState("30");
  const [selectedResponders, setSelectedResponders] = useState<string[]>([]);

  // Approval modal state
  const [approvingTask, setApprovingTask] = useState<Task | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");

  function toggleResponder(id: string) {
    setSelectedResponders((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !locationId) {
      toast.error("Please fill in task title, description, and target location.");
      return;
    }

    if (selectedResponders.length === 0) {
      toast.error("Please select at least one IT Responder.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("location_id", locationId);
    formData.append("priority", priority);
    formData.append("due_date", dueDate);
    formData.append("base_points", basePoints);
    selectedResponders.forEach((rId) => formData.append("responder_ids", rId));

    const result = await createTaskAction(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setSelectedResponders([]);
    }
  }

  async function handleApproveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!approvingTask) return;

    setLoading(true);
    const result = await approveTaskAction(approvingTask.id, approvalRemarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setApprovingTask(null);
      setApprovalRemarks("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats & Create Task Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">Tasks Queue:</span>
          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-extrabold text-xs rounded-xl border border-purple-200">
            {tasks.length} Total Tasks
          </span>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-extrabold text-xs rounded-xl border border-amber-200">
            {tasks.filter((t) => t.status === "Completed").length} Awaiting Approval
          </span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Assign Operational Task
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            No operational tasks created yet. Click &quot;Assign Operational Task&quot; to assign site setups or maintenance duties.
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
                          ? "bg-amber-50 text-amber-700 border-amber-200 font-extrabold animate-pulse"
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
                  <div className="space-y-1.5 max-w-xl">
                    <h3 className="font-bold text-[#0F172A] text-base">{task.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-semibold">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        Assigned Responders ({assignees.length}):
                        {assignees.map((a) => (a.responder as any)?.full_name).join(", ") || "None"}
                      </span>

                      {task.due_date && (
                        <span className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Due: {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Timeline
                    </button>

                    {task.status === "Completed" && (
                      <button
                        onClick={() => setApprovingTask(task)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
                      >
                        <Award className="w-3.5 h-3.5" />
                        Review & Approve Completion
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" /> Create Operational Task
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Clifton Site Dispenser Router Replacement"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed instructions for responders..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">Target Location *</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">Base Points</label>
                  <input
                    type="number"
                    value={basePoints}
                    onChange={(e) => setBasePoints(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Select Responders (Multi-select) */}
              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">
                  Assign IT Responder(s) * (Select one or multiple)
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {responders.map((r) => {
                    const selected = selectedResponders.includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => toggleResponder(r.id)}
                        className={`w-full p-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between border transition-all ${
                          selected
                            ? "bg-purple-50 border-purple-300 text-purple-900"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>{r.full_name} ({r.email})</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  Assign Task
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
              <h3 className="font-bold text-[#0F172A] text-base">Task #{selectedTask.task_number} Activity Audit</h3>
              <button onClick={() => setSelectedTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <AuditTimeline logs={selectedTask.task_logs} />
          </div>
        </div>
      )}

      {/* Approve Task Modal */}
      {approvingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base">Approve Task #{approvingTask.task_number}</h3>
              <button onClick={() => setApprovingTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveTask} className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Review completion for &quot;{approvingTask.title}&quot;. Approving will credit +{approvingTask.base_points || 30} confirmed points to all assignees.
              </p>

              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">Approval Remarks</label>
                <textarea
                  rows={3}
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Optional review remarks..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApprovingTask(null)}
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
                  Approve Completion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
