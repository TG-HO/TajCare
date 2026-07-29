"use client";

import { useState } from "react";
import { Location, Profile, Task, TaskVisit } from "@/types/database";
import {
  createTaskAction,
  adminScheduleNextVisitAction,
  adminAssignDueDateAction,
  adminCloseTaskAction,
} from "./actions";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  MapPin,
  X,
  Loader2,
  Eye,
  Award,
  Star,
  ArrowRight,
  History,
  Paperclip,
  Lock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import AuditTimeline from "@/components/AuditTimeline";
import SearchableLocationSelect from "@/components/SearchableLocationSelect";

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
  const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState<Task | null>(null);
  const [decisionTask, setDecisionTask] = useState<Task | null>(null);
  const [closingTask, setClosingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  // Create Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [priority, setPriority] = useState("Medium");
  const [firstVisitDate, setFirstVisitDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [basePoints, setBasePoints] = useState("30");
  const [selectedResponders, setSelectedResponders] = useState<string[]>([]);

  // Admin Decision state (Option A vs Option B)
  const [decisionMode, setDecisionMode] = useState<"next_visit" | "due_date">("next_visit");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [adminDecisionRemarks, setAdminDecisionRemarks] = useState("");

  // Final Rating Closure state
  const [finalRating, setFinalRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [closureRemarks, setClosureRemarks] = useState("");

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

    if (!firstVisitDate) {
      toast.error("Please assign a First Visit Date for this operational task.");
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
    formData.append("first_visit_date", firstVisitDate);
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
      setFirstVisitDate("");
      setDueDate("");
      setSelectedResponders([]);
    }
  }

  async function handleAdminDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decisionTask) return;

    setLoading(true);
    let result: { error?: string; message?: string };

    if (decisionMode === "next_visit") {
      result = await adminScheduleNextVisitAction(decisionTask.id, nextVisitDate, adminDecisionRemarks);
    } else {
      result = await adminAssignDueDateAction(decisionTask.id, assignDueDate, adminDecisionRemarks);
    }
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setDecisionTask(null);
      setNextVisitDate("");
      setAssignDueDate("");
      setAdminDecisionRemarks("");
    }
  }

  async function handleCloseTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!closingTask) return;

    setLoading(true);
    const result = await adminCloseTaskAction(closingTask.id, finalRating, closureRemarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setClosingTask(null);
      setClosureRemarks("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">Operational Queue:</span>
          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-extrabold text-xs rounded-xl border border-purple-200">
            {tasks.length} Total Tasks
          </span>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-extrabold text-xs rounded-xl border border-amber-200">
            {tasks.filter((t) => t.status === "Completed" || t.status === "Visited").length} Needs Action
          </span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Register Operational Task
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            No operational tasks created yet. Click &quot;Register Operational Task&quot; to assign site setups or maintenance duties.
          </div>
        ) : (
          tasks.map((task) => {
            const assignees = task.task_assignees || [];
            const visits = task.task_visits || [];
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
                        task.status === "Closed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : task.status === "Completed"
                          ? "bg-amber-50 text-amber-700 border-amber-300 font-extrabold animate-pulse"
                          : task.status === "Visited"
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

                  <span className="text-[11px] text-slate-500">
                    Site: <strong>{task.location?.name}</strong>
                  </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <h3 className="font-bold text-[#0F172A] text-base">{task.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-semibold">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        Assignees:
                        {assignees.map((a) => (a.responder as any)?.full_name).join(", ") || "None"}
                      </span>

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
                        <span className="text-[11px] italic text-slate-400">Due Date Not Assigned Yet</span>
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

                    {/* Decision Action: Enabled ONLY when responder has marked status as Visited */}
                    {!isCompleted && task.status !== "Closed" && task.status !== "Approved" && (
                      isVisited ? (
                        <button
                          onClick={() => {
                            setDecisionTask(task);
                            setDecisionMode("next_visit");
                          }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 animate-pulse"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Next Visit / Assign Due Date
                        </button>
                      ) : (
                        <button
                          disabled
                          title="Awaiting IT Responder to complete site visit and mark Visited."
                          className="px-4 py-2 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-not-allowed opacity-75"
                        >
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          Next Visit (Awaiting Visit #{task.current_visit_number || 1})
                        </button>
                      )
                    )}

                    {/* Final Closure Action */}
                    {isCompleted && (
                      <button
                        onClick={() => {
                          setClosingTask(task);
                          setFinalRating(5);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
                      >
                        <Award className="w-3.5 h-3.5" />
                        Rate & Close Operational Task
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Operational Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" /> Register Operational Task
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
                  placeholder="e.g., Dispenser Router Setup & Network Testing"
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
                  placeholder="Detailed operational instructions..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">Target Location *</label>
                  <SearchableLocationSelect
                    locations={locations}
                    value={locationId}
                    onChange={(id) => setLocationId(id)}
                  />
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
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">First Visit Date *</label>
                  <input
                    type="datetime-local"
                    required
                    value={firstVisitDate}
                    onChange={(e) => setFirstVisitDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-semibold text-indigo-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">Final Due Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Can be assigned later after visit review</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">Base Points (Complexity)</label>
                <input
                  type="number"
                  value={basePoints}
                  onChange={(e) => setBasePoints(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-bold text-amber-700"
                />
              </div>

              {/* Select Responders */}
              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">
                  Assign IT Responder(s) * (Multi-select)
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
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
                  Register & Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Decision Modal (Option A vs Option B) */}
      {decisionTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-purple-600" />
                Admin Action: Task #{decisionTask.task_number}
              </h3>
              <button onClick={() => setDecisionTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminDecisionSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-purple-700">Current Task State</span>
                <p className="font-bold text-[#0F172A]">{decisionTask.title}</p>
                <p className="text-slate-600">
                  Status: <strong>{decisionTask.status}</strong> • Active Visit Cycle: #{decisionTask.current_visit_number || 1}
                </p>
              </div>

              {/* Radio Selection: Option A vs Option B */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-2">Select Admin Workflow Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisionMode("next_visit")}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      decisionMode === "next_visit"
                        ? "bg-purple-600 text-white border-purple-700 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="font-extrabold">Option A</span>
                    <span className="text-[11px]">Assign Next Visit Date</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecisionMode("due_date")}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      decisionMode === "due_date"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="font-extrabold">Option B</span>
                    <span className="text-[11px]">Assign Final Due Date</span>
                  </button>
                </div>
              </div>

              {decisionMode === "next_visit" ? (
                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">
                    Next Visit Date (Visit #{(decisionTask.current_visit_number || 1) + 1}) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={nextVisitDate}
                    onChange={(e) => setNextVisitDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-semibold text-purple-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Schedules another site visit cycle for the responder.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-[#0F172A] uppercase mb-1">
                    Final Task Due Date *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none font-semibold text-indigo-700"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Activating Due Date unlocks the <strong>&quot;Complete Task&quot;</strong> button for the IT Responder.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">Admin Decision Remarks</label>
                <textarea
                  rows={2}
                  value={adminDecisionRemarks}
                  onChange={(e) => setAdminDecisionRemarks(e.target.value)}
                  placeholder="Notes for responders regarding next steps..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDecisionTask(null)}
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
                  Submit Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Final Closure & Rating Modal */}
      {closingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                Final Closure & Rating: Task #{closingTask.task_number}
              </h3>
              <button onClick={() => setClosingTask(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseTaskSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-700">Completion Review</span>
                <p className="font-bold text-[#0F172A]">{closingTask.title}</p>
                <p className="text-slate-600">Base Points: <strong>{closingTask.base_points || 30} pts</strong></p>
              </div>

              <div>
                <label className="block text-center font-bold text-slate-700 uppercase mb-2">
                  Rate Work Quality & Release Points
                </label>
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFinalRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          (hoverRating || finalRating) >= star
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center font-bold text-slate-600 mt-1">
                  {finalRating === 5 && `⭐ 5 Stars (1.5x) → ${Math.round((closingTask.base_points || 30) * 1.5)} Points`}
                  {finalRating === 4 && `👍 4 Stars (1.25x) → ${Math.round((closingTask.base_points || 30) * 1.25)} Points`}
                  {finalRating === 3 && `😐 3 Stars (1.0x) → ${Math.round((closingTask.base_points || 30) * 1.0)} Points`}
                  {finalRating === 2 && `👎 2 Stars (0.8x) → ${Math.round((closingTask.base_points || 30) * 0.8)} Points`}
                  {finalRating === 1 && `⚠️ 1 Star (0.5x) → ${Math.round((closingTask.base_points || 30) * 0.5)} Points`}
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] uppercase mb-1">Final Closure Remarks</label>
                <textarea
                  rows={3}
                  value={closureRemarks}
                  onChange={(e) => setClosureRemarks(e.target.value)}
                  placeholder="Operational closure notes..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClosingTask(null)}
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
                  Close Task & Release Points
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
