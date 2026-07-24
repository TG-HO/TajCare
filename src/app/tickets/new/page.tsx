import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TicketCreateForm from "./TicketCreateForm";
import { ArrowLeft, Ticket } from "lucide-react";
import Link from "next/link";

export default async function NewTicketPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations!location_id(*)")
    .eq("id", user.id)
    .single();

  // Admins and responders should not file complaints
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "responder") redirect("/responder");

  const { data: issuesData } = await supabase
    .from("predefined_issues")
    .select("*")
    .order("category", { ascending: true });

  const issues = issuesData || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 max-w-3xl mx-auto">
      {/* Top Bar */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F172A] mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Ticket className="w-6 h-6 text-[#0F172A]" />
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Log New IT Complaint
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Submit an issue ticket to Taj IT Operations for auto-assignment & dispatch
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <TicketCreateForm profile={profile} issues={issues} />
      </div>
    </div>
  );
}
