"use client";

import { useState, useRef, useEffect } from "react";
import { Location } from "@/types/database";
import { MapPin, Search, ChevronDown, Check } from "lucide-react";

export default function SearchableLocationSelect({
  locations,
  value,
  onChange,
  placeholder = "Select Location...",
  className = "",
}: {
  locations: Location[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLocation = locations.find((l) => l.id === value);

  const filteredLocations = locations.filter((l) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q) ||
      (l.type === "fueling_site" ? "fueling site" : "head office").includes(q)
    );
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between hover:bg-slate-100 transition-all focus:ring-2 focus:ring-purple-600 focus:outline-none"
      >
        <div className="flex items-center gap-2 truncate">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          {selectedLocation ? (
            <span className="truncate font-bold text-[#0F172A]">
              {selectedLocation.name} ({selectedLocation.type === "fueling_site" ? "Fueling Site" : "Head Office"})
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 p-2 space-y-2">
          {/* Search Input Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search location by name, city, or type..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
            />
          </div>

          {/* Location List */}
          <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100">
            {filteredLocations.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">No matching locations found.</div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = loc.id === value;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      onChange(loc.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors pt-2 ${
                      isSelected
                        ? "bg-purple-50 text-purple-900 font-bold"
                        : "hover:bg-slate-50 text-slate-700 font-medium"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-[#0F172A]">{loc.name}</p>
                      <span className="text-[10px] text-slate-500">
                        {loc.city} • {loc.type === "fueling_site" ? "Fueling Site" : "Head Office"}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
