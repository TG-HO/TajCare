"use client";

import { useState, useEffect } from "react";
import { createIssueAction, updateIssueAction } from "./actions";
import { toast } from "sonner";
import { AlertTriangle, Plus, X, Loader2, Award, Clock, Hourglass } from "lucide-react";
import { PredefinedIssue, Complexity } from "@/types/database";

export default function IssueModals({
  editingIssue,
  onCloseEdit,
}: {
  editingIssue?: PredefinedIssue | null;
  onCloseEdit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complexity, setComplexity] = useState<Complexity>(
    editingIssue?.complexity || "Medium"
  );
  const [basePoints, setBasePoints] = useState<number>(
    editingIssue?.base_points || 20
  );
  const [resolutionHours, setResolutionHours] = useState<number>(
    editingIssue?.resolution_time_hours ?? 24
  );
  const [resolutionMinutes, setResolutionMinutes] = useState<number>(
    editingIssue?.resolution_time_minutes ?? 0
  );

  // Hierarchy response times (Time to respond before auto-escalation)
  const [responderHours, setResponderHours] = useState<number>(
    editingIssue?.responder_response_hours ?? 2
  );
  const [responderMinutes, setResponderMinutes] = useState<number>(
    editingIssue?.responder_response_minutes ?? 0
  );
  const [supervisorHours, setSupervisorHours] = useState<number>(
    editingIssue?.supervisor_response_hours ?? 2
  );
  const [supervisorMinutes, setSupervisorMinutes] = useState<number>(
    editingIssue?.supervisor_response_minutes ?? 0
  );
  const [lineManagerHours, setLineManagerHours] = useState<number>(
    editingIssue?.line_manager_response_hours ?? 2
  );
  const [lineManagerMinutes, setLineManagerMinutes] = useState<number>(
    editingIssue?.line_manager_response_minutes ?? 0
  );

  // Sync state if editingIssue changes
  useEffect(() => {
    if (editingIssue) {
      setComplexity(editingIssue.complexity || "Medium");
      setBasePoints(editingIssue.base_points || 20);
      setResolutionHours(editingIssue.resolution_time_hours ?? 24);
      setResolutionMinutes(editingIssue.resolution_time_minutes ?? 0);
      setResponderHours(editingIssue.responder_response_hours ?? 2);
      setResponderMinutes(editingIssue.responder_response_minutes ?? 0);
      setSupervisorHours(editingIssue.supervisor_response_hours ?? 2);
      setSupervisorMinutes(editingIssue.supervisor_response_minutes ?? 0);
      setLineManagerHours(editingIssue.line_manager_response_hours ?? 2);
      setLineManagerMinutes(editingIssue.line_manager_response_minutes ?? 0);
    }
  }, [editingIssue]);

  const isEditing = !!editingIssue;
  const isModalVisible = open || isEditing;

  function handleClose() {
    setOpen(false);
    if (onCloseEdit) onCloseEdit();
  }

  function handleComplexityChange(val: Complexity) {
    setComplexity(val);
    // Auto suggest base points and resolution SLA based on complexity
    switch (val) {
      case "Low":
        setBasePoints(10);
        setResolutionHours(4);
        setResolutionMinutes(0);
        break;
      case "Medium":
        setBasePoints(20);
        setResolutionHours(12);
        setResolutionMinutes(0);
        break;
      case "High":
        setBasePoints(35);
        setResolutionHours(24);
        setResolutionMinutes(0);
        break;
      case "Critical":
        setBasePoints(50);
        setResolutionHours(2);
        setResolutionMinutes(0);
        break;
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let result;

    if (isEditing && editingIssue) {
      result = await updateIssueAction(editingIssue.id, formData);
    } else {
      result = await createIssueAction(formData);
    }

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      handleClose();
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all flex items-center gap-2"
      >
        <Plus className="w-4 h-4 text-emerald-400" />
        Add Predefined Issue
      </button>

      {isModalVisible && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                {isEditing ? "Edit Predefined Issue" : "Add Predefined Issue"}
              </h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Issue Category *
                  </label>
                <select
                  name="category"
                  required
                  defaultValue={editingIssue?.category || "Dispenser Hardware"}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                >
                  <option value="Dispenser Hardware">Dispenser Hardware</option>
                  <option value="Network/Router">Network/Router</option>
                  <option value="Printer/POS">Printer/POS</option>
                  <option value="Software/ERP">Software/ERP</option>
                  <option value="General Hardware">General Hardware</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Issue Title *
                </label>
                <input
                  type="text"
                  name="issue_title"
                  required
                  defaultValue={editingIssue?.issue_title || ""}
                  placeholder="e.g. Fuel Dispenser Nozzle Leakage"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Complexity *
                  </label>
                  <select
                    name="complexity"
                    required
                    value={complexity}
                    onChange={(e) => handleComplexityChange(e.target.value as Complexity)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none font-semibold"
                  >
                    <option value="Low">Low (10 pts)</option>
                    <option value="Medium">Medium (20 pts)</option>
                    <option value="High">High (35 pts)</option>
                    <option value="Critical">Critical (50 pts)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" /> Base Points
                  </label>
                  <input
                    type="number"
                    name="base_points"
                    required
                    value={basePoints}
                    onChange={(e) => setBasePoints(parseInt(e.target.value, 10) || 0)}
                    min={1}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none font-bold text-amber-700"
                  />
                </div>
              </div>

              {/* Time Duration Box for Resolution Time */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Target Resolution Time (SLA) *
                  </label>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {resolutionHours}h {resolutionMinutes}m total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Hours
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="resolution_time_hours"
                        required
                        min={0}
                        max={720}
                        value={resolutionHours}
                        onChange={(e) => setResolutionHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        placeholder="Hours"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none pr-8"
                      />
                      <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-medium pointer-events-none">
                        hrs
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Minutes
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="resolution_time_minutes"
                        required
                        min={0}
                        max={59}
                        value={resolutionMinutes}
                        onChange={(e) => setResolutionMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        placeholder="Minutes"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none pr-8"
                      />
                      <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-medium pointer-events-none">
                        mins
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Target duration before SLA breach occurs.
                </p>
              </div>

              {/* Hierarchy-wise Response Times (Time to Respond) */}
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Hourglass className="w-4 h-4 text-indigo-600" />
                    Hierarchy Response SLAs (Time to Respond)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Active countdown timer on everyone's dashboard. Once the timer expires without responder activity, the issue automatically escalates to the next role in the hierarchy.
                  </p>
                </div>

                {/* 1. Responder Window */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> 1. Responder Response Window
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {responderHours}h {responderMinutes}m
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        name="responder_response_hours"
                        min={0}
                        max={720}
                        value={responderHours}
                        onChange={(e) => setResponderHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-[#0F172A] focus:outline-none pr-7"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 pointer-events-none">hrs</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        name="responder_response_minutes"
                        min={0}
                        max={59}
                        value={responderMinutes}
                        onChange={(e) => setResponderMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-[#0F172A] focus:outline-none pr-8"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 pointer-events-none">mins</span>
                    </div>
                  </div>
                </div>

                {/* 2. Supervisor Window */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span> 2. Supervisor Escalation Window
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {supervisorHours}h {supervisorMinutes}m
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        name="supervisor_response_hours"
                        min={0}
                        max={720}
                        value={supervisorHours}
                        onChange={(e) => setSupervisorHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-[#0F172A] focus:outline-none pr-7"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 pointer-events-none">hrs</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        name="supervisor_response_minutes"
                        min={0}
                        max={59}
                        value={supervisorMinutes}
                        onChange={(e) => setSupervisorMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-[#0F172A] focus:outline-none pr-8"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 pointer-events-none">mins</span>
                    </div>
                  </div>
                </div>

                {/* 3. Line Manager Window */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span> 3. Line Manager Escalation Window
                    </span>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {lineManagerHours}h {lineManagerMinutes}m
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        name="line_manager_response_hours"
                        min={0}
                        max={720}
                        value={lineManagerHours}
                        onChange={(e) => setLineManagerHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-[#0F172A] focus:outline-none pr-7"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 pointer-events-none">hrs</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        name="line_manager_response_minutes"
                        min={0}
                        max={59}
                        value={lineManagerMinutes}
                        onChange={(e) => setLineManagerMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-[#0F172A] focus:outline-none pr-8"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 pointer-events-none">mins</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Action Buttons Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-70 transition-colors"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Issue"}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}
    </>
  );
}
