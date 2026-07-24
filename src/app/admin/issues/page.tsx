import { createClient } from "@/lib/supabase/server";
import IssueModals from "./IssueModals";
import IssuesTable from "./IssuesTable";
import { AlertTriangle } from "lucide-react";
import { PredefinedIssue } from "@/types/database";

export default async function AdminIssuesPage() {
  const supabase = await createClient();

  const { data: issuesData } = await supabase
    .from("predefined_issues")
    .select("*")
    .order("category", { ascending: true });

  const issues: PredefinedIssue[] = issuesData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#0F172A]" />
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Predefined Issues Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure cataloged IT problem types, complexity ratings, and base points
          </p>
        </div>

        <IssueModals />
      </div>

      {/* Issues Datatable */}
      <IssuesTable initialIssues={issues} />
    </div>
  );
}
