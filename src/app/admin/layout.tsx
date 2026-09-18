import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import Link from "next/link";
import {
  Fuel,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import AdminNavLinks from "./AdminNavLinks";
import RealtimeNotificationBell from "@/components/RealtimeNotificationBell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations!location_id(name)")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = profile?.role || user.user_metadata?.role;
  const adminRoles = ["admin", "hod", "line_manager", "supervisor"];

  if (!adminRoles.includes(userRole)) {
    redirect(userRole === "responder" ? "/responder" : "/dashboard");
  }

  const roleLabel =
    userRole === "admin"
      ? "System Admin"
      : userRole === "hod"
      ? "HOD (Head of Dept)"
      : userRole === "line_manager"
      ? "Line Manager"
      : "Field Supervisor";

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F8FAFC] flex flex-col md:flex-row">
      {/* Sidebar Navigation - Fixed Completely */}
      <aside className="w-full md:w-64 h-auto md:h-screen bg-[#0F172A] text-white flex-shrink-0 flex flex-col justify-between border-r border-slate-800 z-20">
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* Logo Header */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-[#0F172A] flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-white tracking-tight leading-tight">
                Taj Care
              </h1>
              <span className="text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
                {userRole === "admin" ? "Super Admin Panel" : "Management Portal"}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-4 flex-1">
            <AdminNavLinks userRole={userRole} />
          </div>
        </div>

        {/* User Info & Sign Out Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-[#0F172A] flex items-center justify-center font-bold text-xs flex-shrink-0">
                {profile?.full_name?.charAt(0) || "A"}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">
                  {profile?.full_name}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <ShieldCheck className="w-3 h-3" /> {roleLabel}
                </span>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Admin Area - Scrollable Content Only */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm flex-shrink-0 z-10">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Taj Gasoline IT Operations
            </span>
            <h2 className="text-xl font-bold text-[#0F172A]">Management Portal</h2>
          </div>

          <div className="flex items-center gap-3">
            <RealtimeNotificationBell userId={user.id} />
            <Link
              href="/profile/settings"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              My Settings
            </Link>
          </div>
        </header>

        {/* Page Body - Independently Scrollable */}
        <main className="flex-1 p-8 overflow-y-auto min-h-0 bg-[#F8FAFC]">
          {children}
        </main>
      </div>
    </div>
  );
}
