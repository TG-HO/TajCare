"use client";

import { useState } from "react";
import { Location } from "@/types/database";
import { Search, Filter, MapPin, Building, Fuel, Edit, Trash2 } from "lucide-react";
import { deleteLocationAction } from "./actions";
import { toast } from "sonner";
import LocationModals from "./LocationModals";

export default function LocationsTable({
  initialLocations,
}: {
  initialLocations: Location[];
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const filteredLocations = initialLocations.filter((loc) => {
    const matchesSearch =
      loc.name?.toLowerCase().includes(search.toLowerCase()) ||
      loc.city?.toLowerCase().includes(search.toLowerCase()) ||
      loc.address?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || loc.type === typeFilter;

    return matchesSearch && matchesType;
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;

    const result = await deleteLocationAction(id);
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
            placeholder="Search site by name, city, address..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Type:</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          >
            <option value="all">All Types ({initialLocations.length})</option>
            <option value="fueling_site">Fueling Sites</option>
            <option value="head_office">Head Office</option>
          </select>
        </div>
      </div>

      {/* Edit Modal Controller */}
      {editingLocation && (
        <LocationModals
          editingLocation={editingLocation}
          onCloseEdit={() => setEditingLocation(null)}
        />
      )}

      {/* Grid view */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLocations.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-400">
            No locations found.
          </div>
        ) : (
          filteredLocations.map((loc) => (
            <div
              key={loc.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      loc.type === "head_office"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {loc.type === "head_office" ? (
                      <Building className="w-5 h-5" />
                    ) : (
                      <Fuel className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0F172A] text-sm">{loc.name}</h3>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {loc.type.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingLocation(loc)}
                    className="p-1.5 text-slate-400 hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(loc.id, loc.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-slate-800">{loc.city}</span>
                </div>
                {loc.address && (
                  <p className="text-[11px] text-slate-500 pl-5 line-clamp-2">
                    {loc.address}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
