import { createClient } from "@/lib/supabase/server";
import { Users, MapPin, AlertTriangle, ShieldCheck, UserCheck, Fuel, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch metrics in parallel
  const [
    { count: totalUsers },
    { count: responderCount },
    { count: locationCount },
    { count: issueCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "responder"),
    supabase.from("locations").select("*", { count: "exact", head: true }),
    supabase.from("predefined_issues").select("*", { count: "exact", head: true }),
  ]);

  const cards = [
    {
      title: "Total System Users",
      value: totalUsers || 0,
      description: "Employees, Site Managers & Admins",
      icon: Users,
      color: "bg-blue-50 text-blue-700 border-blue-200",
      href: "/admin/users",
    },
    {
      title: "Active Responders",
      value: responderCount || 0,
      description: "Bound to multi-location duties",
      icon: UserCheck,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      href: "/admin/users?role=responder",
    },
    {
      title: "Locations & Sites",
      value: locationCount || 0,
      description: "Fueling Sites & Head Office Floors",
      icon: MapPin,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      href: "/admin/locations",
    },
    {
      title: "Predefined Issues",
      value: issueCount || 0,
      description: "Categorized with SLA complexity",
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-700 border-amber-200",
      href: "/admin/issues",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-slate-800 text-white rounded-2xl p-8 shadow-md border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-medium mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Phase 1 Foundation Active
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Taj Care Admin Control Panel
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Configure system users, assign responder locations, setup site metadata, and adjust SLA complexity settings.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-[#0F172A] text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Manage Users
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl border ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  {card.value}
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                  <span>{card.description}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#0F172A] transition-colors" />
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Admin Operations Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#0F172A] text-base">User Management & CSV Import</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Create single users or bulk import staff members via CSV. Configure responder multi-location bindings and set on-leave backup responders.
          </p>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 pt-2"
          >
            Open Users Portal →
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#0F172A] text-base">Location & Site Setup</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Add Taj Fueling Sites across Karachi and Head Office floors. Sites map directly to user profiles and ticket routing.
          </p>
          <Link
            href="/admin/locations"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-800 pt-2"
          >
            Manage Locations →
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#0F172A] text-base">Predefined Issues & Points</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Catalog IT issue categories, titles, complexity tiers (Low, Medium, High, Critical), and base gamification points.
          </p>
          <Link
            href="/admin/issues"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-800 pt-2"
          >
            Manage Issue Catalog →
          </Link>
        </div>
      </div>
    </div>
  );
}
