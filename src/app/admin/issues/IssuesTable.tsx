"use client";

import { useState } from "react";
import { PredefinedIssue } from "@/types/database";
import { getComplexityBadgeColor } from "@/lib/utils";
import { Search, Filter, AlertTriangle, Award, Edit, Trash2 } from "lucide-react";
import { deleteIssueAction } from "./actions";
import { toast } from "sonner";
import IssueModals from "./IssueModals";

export default function IssuesTable({
  initialIssues,
}: {
  initialIssues: PredefinedIssue[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingIssue, setEditingIssue] = useState<PredefinedIssue | null>(null);

  const categories = Array.from(
    new Set(initialIssues.map((item) => item.category))
  );

  const filteredIssues = initialIssues.filter((issue) => {
    const matchesSearch =
      issue.issue_title?.toLowerCase().includes(search.toLowerCase()) ||
      issue.category?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || issue.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    const result = await deleteIssueAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issue title or category..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Category:</span>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          >
            <option value="all">All Categories ({initialIssues.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Edit Modal Controller */}
      {editingIssue && (
        <IssueModals
          editingIssue={editingIssue}
          onCloseEdit={() => setEditingIssue(null)}
        />
      )}

      {/* Issues Datatable */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4">Issue Category</th>
                <th className="p-4">Issue Title</th>
                <th className="p-4">Complexity</th>
                <th className="p-4">Base SLA Points</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No predefined issues found.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {issue.category}
                      </span>
                    </td>

                    <td className="p-4 font-bold text-[#0F172A]">
                      {issue.issue_title}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase border font-bold ${getComplexityBadgeColor(
                          issue.complexity
                        )}`}
                      >
                        {issue.complexity}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        {issue.base_points} Pts
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingIssue(issue)}
                          className="p-1.5 text-slate-400 hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(issue.id, issue.issue_title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
