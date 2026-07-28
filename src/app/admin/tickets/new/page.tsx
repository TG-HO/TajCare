import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Ticket, ShieldCheck } from "lucide-react";
import Link from "next/link";
import AdminTicketCreateForm from "./AdminTicketCreateForm";

export default async function AdminNewTicketPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const [
    { data: locations },
    { data: responders },
    { data: issues },
  ] = await Promise.all([
    supabase.from("locations").select("*").order("name"),
    supabase.from("profiles").select("*").eq("role", "responder").order("full_name"),
    supabase.from("predefined_issues").select("*").order("category"),
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 max-w-3xl mx-auto space-y-6">
      {/* Top Header */}
      <div>
        <Link
          href="/admin/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F172A] mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Master Tickets
        </Link>
        <div className="flex items-center gap-2">
          <Ticket className="w-6 h-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Admin Log & Assign Complaint
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Initiate a complaint directly for any fueling site or head office location, with manual IT Responder assignment.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <AdminTicketCreateForm
          locations={locations || []}
          responders={responders || []}
          issues={issues || []}
        />
      </div>
    </div>
  );
}
