"use client";

import { useState } from "react";
import { Location, Profile, PredefinedIssue } from "@/types/database";
import { adminCreateTicketAction } from "@/app/tickets/actions";
import { toast } from "sonner";
import { Loader2, Send, Clock } from "lucide-react";
import SearchableLocationSelect from "@/components/SearchableLocationSelect";
import { useRouter } from "next/navigation";

export default function AdminTicketCreateForm({
  locations,
  responders,
  issues,
}: {
  locations: Location[];
  responders: Profile[];
  issues: PredefinedIssue[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [responderId, setResponderId] = useState(responders[0]?.id || "");
  const [issueTypeId, setIssueTypeId] = useState(issues[0]?.id || "");
  const [customTitle, setCustomTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionHours, setResolutionHours] = useState<number>(
    issues[0]?.resolution_time_hours ?? 24
  );
  const [resolutionMinutes, setResolutionMinutes] = useState<number>(
    issues[0]?.resolution_time_minutes ?? 0
  );

  function handleIssueChange(id: string) {
    setIssueTypeId(id);
    const selected = issues.find((iss) => iss.id === id);
    if (selected) {
      setResolutionHours(selected.resolution_time_hours ?? 24);
      setResolutionMinutes(selected.resolution_time_minutes ?? 0);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !locationId) {
      toast.error("Please select a location and provide a detailed description.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("location_id", locationId);
    formData.append("assigned_responder_id", responderId);
    formData.append("issue_type_id", issueTypeId);
    formData.append("custom_resolution_hours", String(resolutionHours));
    formData.append("custom_resolution_minutes", String(resolutionMinutes));
    if (issueTypeId === "OTHER") {
      formData.append("custom_issue_title", customTitle);
    }
    formData.append("description", description);

    const result = await adminCreateTicketAction(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      router.push("/admin/tickets");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-bold text-[#0F172A] uppercase mb-1">
            Target Site / Location *
          </label>
          <SearchableLocationSelect
            locations={locations}
            value={locationId}
            onChange={(id) => setLocationId(id)}
          />
        </div>

        <div>
          <label className="block font-bold text-[#0F172A] uppercase mb-1">
            Assigned IT Responder *
          </label>
          <select
            value={responderId}
            onChange={(e) => setResponderId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-purple-600 focus:outline-none"
          >
            {responders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name} ({r.email}) {r.is_on_leave ? "— ON LEAVE" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block font-bold text-[#0F172A] uppercase mb-1">
          Problem Category / Predefined Issue *
        </label>
        <select
          value={issueTypeId}
          onChange={(e) => handleIssueChange(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-purple-600 focus:outline-none"
        >
          {issues.map((iss) => (
            <option key={iss.id} value={iss.id}>
              [{iss.category}] {iss.issue_title} ({iss.complexity} • {iss.base_points} pts • {iss.resolution_time_hours ?? 24}h {iss.resolution_time_minutes ?? 0}m SLA)
            </option>
          ))}
          <option value="OTHER">Other Custom Issue</option>
        </select>
      </div>

      {/* Target Resolution Time SLA */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-bold text-[#0F172A] uppercase flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-purple-600" />
            Target Resolution Time (SLA)
          </label>
          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            {resolutionHours}h {resolutionMinutes}m duration
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
                min={0}
                max={720}
                value={resolutionHours}
                onChange={(e) => setResolutionHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#0F172A] focus:ring-2 focus:ring-purple-600 focus:outline-none pr-8"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 pointer-events-none">
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
                min={0}
                max={59}
                value={resolutionMinutes}
                onChange={(e) => setResolutionMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#0F172A] focus:ring-2 focus:ring-purple-600 focus:outline-none pr-8"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 pointer-events-none">
                mins
              </span>
            </div>
          </div>
        </div>
      </div>

      {issueTypeId === "OTHER" && (
        <div>
          <label className="block font-bold text-[#0F172A] uppercase mb-1">
            Custom Issue Title *
          </label>
          <input
            type="text"
            required
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Specify custom issue title..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="block font-bold text-[#0F172A] uppercase mb-1">
          Detailed Description of Issue *
        </label>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe symptoms, hardware/software errors, or site context..."
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
        />
      </div>

      <div className="pt-3 flex justify-end border-t border-slate-100">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-emerald-400" />}
          Log & Assign Complaint
        </button>
      </div>
    </form>
  );
}
