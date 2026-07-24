"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTicketAction } from "../actions";
import {
  saveDatabaseDraftAction,
  loadDatabaseDraftAction,
  clearDatabaseDraftAction,
} from "../draftActions";
import { toast } from "sonner";
import { Loader2, Send, MapPin, User, Calendar, Save, Trash2, Database } from "lucide-react";
import { Profile, PredefinedIssue } from "@/types/database";
import PhotoAttachmentPicker from "@/components/PhotoAttachmentPicker";

export default function TicketCreateForm({
  profile,
  issues,
}: {
  profile: Profile;
  issues: PredefinedIssue[];
}) {
  const router = useRouter();
  const [selectedIssueId, setSelectedIssueId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isOther, setIsOther] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Filter issues based on user's location type (Fueling Site vs Head Office)
  const userLocationType = profile?.location?.type || "fueling_site";
  const relevantIssues = issues.filter(
    (issue) =>
      !issue.target_location_type ||
      issue.target_location_type === "both" ||
      issue.target_location_type === userLocationType
  );

  useEffect(() => {
    async function checkDraft() {
      const draft = await loadDatabaseDraftAction();
      if (draft && (draft.description || draft.issue_type_id || draft.custom_issue_title)) {
        setHasDraft(true);
      }
    }
    checkDraft();
  }, []);

  async function handleRestoreDraft() {
    const draft = await loadDatabaseDraftAction();
    if (draft) {
      setSelectedIssueId(draft.issue_type_id || "");
      setCustomTitle(draft.custom_issue_title || "");
      setDescription(draft.description || "");
      setIsOther(draft.issue_type_id === "OTHER");
      toast.success("Database ticket draft restored!");
    }
  }

  async function handleSaveDraft() {
    const res = await saveDatabaseDraftAction({
      issue_type_id: selectedIssueId,
      custom_issue_title: customTitle,
      description,
    });

    if (res.error) {
      toast.error(res.error);
    } else {
      setHasDraft(true);
      toast.success(res.message);
    }
  }

  async function handleClearDraft() {
    await clearDatabaseDraftAction();
    setHasDraft(false);
    setSelectedIssueId("");
    setCustomTitle("");
    setDescription("");
    setIsOther(false);
    toast.info("Database draft cleared.");
  }

  function handleIssueChange(val: string) {
    setSelectedIssueId(val);
    setIsOther(val === "OTHER");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await createTicketAction(formData);

      if (result?.error) {
        toast.error(result.error);
        setLoading(false);
      } else if (result?.success) {
        await clearDatabaseDraftAction();
        toast.success(result.message || "Complaint submitted successfully!");
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit complaint.");
      setLoading(false);
    }
  }

  const currentDate = new Date().toLocaleDateString("en-PK", {
    dateStyle: "full",
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Saved Database Draft Banner */}
      {hasDraft && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-700" />
            <span className="font-medium">Saved database draft found for your account.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-all"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="p-1 text-amber-700 hover:text-rose-600 rounded"
              title="Clear Draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Auto-Fetched Complainant Details Header */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Complainant</span>
          <div className="flex items-center gap-1.5 font-bold text-[#0F172A] mt-0.5 text-xs">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{profile?.full_name || "Employee"}</span>
          </div>
        </div>

        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Location / Site</span>
          <div className="flex items-center gap-1.5 font-bold text-[#0F172A] mt-0.5 text-xs">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>{profile?.location?.name || "General Office"}</span>
          </div>
        </div>

        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Current Date</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-700 mt-0.5 text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentDate}</span>
          </div>
        </div>
      </div>

      {/* Predefined Issue Selection (Filtered by Site vs HO) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Select IT Problem Category / Issue *
          </label>
          <span className="text-[11px] text-slate-500 font-medium">
            Showing issues for: <span className="font-bold text-emerald-700 uppercase">{userLocationType.replace("_", " ")}</span>
          </span>
        </div>
        <select
          name="issue_type_id"
          value={selectedIssueId}
          onChange={(e) => handleIssueChange(e.target.value)}
          required={!isOther}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
        >
          <option value="">-- Choose Relevant Issue --</option>
          {relevantIssues.map((issue) => (
            <option key={issue.id} value={issue.id}>
              [{issue.category}] {issue.issue_title} ({issue.complexity} • {issue.base_points} pts)
            </option>
          ))}
          <option value="OTHER">⚠️ Other (Custom Issue Not Listed)</option>
        </select>
      </div>

      {/* Custom Issue Title if OTHER selected */}
      {isOther && (
        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
          <label className="block text-xs font-bold text-amber-900 uppercase">
            Specify Custom Issue Title *
          </label>
          <input
            type="text"
            name="custom_issue_title"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            required={isOther}
            placeholder="e.g. Unexplained error on POS terminal keyboard..."
            className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
      )}

      {/* Detailed Description */}
      <div>
        <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">
          Detailed Description of Issue *
        </label>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          placeholder="Describe what happened, when it started, and steps to reproduce..."
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
        />
      </div>

      {/* Photo Attachment Picker */}
      <PhotoAttachmentPicker />

      {/* Action Buttons */}
      <div className="pt-4 flex items-center justify-between border-t border-slate-100">
        <button
          type="button"
          onClick={handleSaveDraft}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          Save Draft to DB
        </button>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting Complaint...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 text-emerald-400" />
              Submit Ticket
            </>
          )}
        </button>
      </div>
    </form>
  );
}
