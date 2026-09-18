"use client";

import { useState } from "react";
import { createIssueAction, updateIssueAction } from "./actions";
import { toast } from "sonner";
import { AlertTriangle, Plus, X, Loader2, Award, Clock } from "lucide-react";
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                {isEditing ? "Edit Predefined Issue" : "Add Predefined Issue"}
              </h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
                  Target duration before SLA breach occurs. Escalation notifications trigger if unresponded within the first interval.
                </p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-70"
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
