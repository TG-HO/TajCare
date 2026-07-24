"use client";

import { useState } from "react";
import { createLocationAction, updateLocationAction } from "./actions";
import { toast } from "sonner";
import { MapPin, Plus, X, Loader2 } from "lucide-react";
import { Location } from "@/types/database";

export default function LocationModals({
  editingLocation,
  onCloseEdit,
}: {
  editingLocation?: Location | null;
  onCloseEdit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingLocation;
  const isModalVisible = open || isEditing;

  function handleClose() {
    setOpen(false);
    if (onCloseEdit) onCloseEdit();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    let result;

    if (isEditing && editingLocation) {
      result = await updateLocationAction(editingLocation.id, formData);
    } else {
      result = await createLocationAction(formData);
    }

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      handleClose();
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all flex items-center gap-2"
      >
        <Plus className="w-4 h-4 text-emerald-400" />
        Add Location / Site
      </button>

      {isModalVisible && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600" />
                {isEditing ? "Edit Location" : "Add New Location / Site"}
              </h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingLocation?.name || ""}
                  placeholder="e.g. Clifton Site #105 or Head Office - 4th Floor"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Location Type *
                  </label>
                  <select
                    name="type"
                    required
                    defaultValue={editingLocation?.type || "fueling_site"}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  >
                    <option value="fueling_site">Fueling Site</option>
                    <option value="head_office">Head Office</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    defaultValue={editingLocation?.city || "Karachi"}
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Physical Address
                </label>
                <textarea
                  name="address"
                  rows={2}
                  defaultValue={editingLocation?.address || ""}
                  placeholder="Full street address..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-70"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isEditing ? "Save Changes" : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
