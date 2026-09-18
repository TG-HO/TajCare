import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";
import { Location, Profile } from "@/types/database";
import UsersPageClient from "./UsersPageClient";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Complete Admin Panel (User Management) is restricted to Super Admin only
  if (currentProfile?.role !== "admin") {
    redirect("/admin");
  }

  // Fetch users with primary location, backup responder, and reporting hierarchy
  const { data: usersData } = await supabase
    .from("profiles")
    .select(`
      *,
      location:locations!location_id(*),
      backup_responder:profiles!backup_responder_id(full_name),
      supervisor:profiles!supervisor_id(full_name),
      line_manager:profiles!line_manager_id(full_name),
      hod:profiles!hod_id(full_name)
    `)
    .order("created_at", { ascending: false });

  // Fetch responder locations bindings for each responder
  const { data: bindingsData } = await supabase
    .from("responder_locations")
    .select("responder_id, location_id, locations(*)");

  // Map bindings onto profiles
  const users: Profile[] = (usersData || []).map((u) => {
    const userBindings = (bindingsData || [])
      .filter((b) => b.responder_id === u.id)
      .map((b) => b.locations)
      .filter(Boolean) as unknown as Location[];

    return {
      ...u,
      responder_locations: userBindings,
    };
  });

  // Fetch all locations for modal dropdowns
  const { data: locationsData } = await supabase
    .from("locations")
    .select("*")
    .order("name", { ascending: true });

  const locations: Location[] = locationsData || [];
  const responders: Profile[] = users.filter((u) => u.role === "responder");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0F172A]" />
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              User Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create single users, bulk import staff via CSV, and bind responders to sites
          </p>
        </div>
      </div>

      {/* Client wrapper that handles modal state sharing */}
      <UsersPageClient
        users={users}
        locations={locations}
        responders={responders}
      />
    </div>
  );
}
