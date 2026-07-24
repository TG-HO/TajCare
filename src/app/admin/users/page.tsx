import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";
import { Location, Profile } from "@/types/database";
import UsersPageClient from "./UsersPageClient";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Fetch users with primary location and backup responder
  const { data: usersData } = await supabase
    .from("profiles")
    .select(`
      *,
      location:locations!location_id(*),
      backup_responder:profiles!backup_responder_id(full_name)
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
