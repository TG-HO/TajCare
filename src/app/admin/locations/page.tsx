import { createClient } from "@/lib/supabase/server";
import LocationModals from "./LocationModals";
import LocationsTable from "./LocationsTable";
import { MapPin } from "lucide-react";
import { Location } from "@/types/database";

export default async function AdminLocationsPage() {
  const supabase = await createClient();

  const { data: locationsData } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: false });

  const locations: Location[] = locationsData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-[#0F172A]" />
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Location & Site Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure Taj Fueling Sites and Head Office floors for ticket dispatching
          </p>
        </div>

        <LocationModals />
      </div>

      {/* Locations Datatable & Cards */}
      <LocationsTable initialLocations={locations} />
    </div>
  );
}
