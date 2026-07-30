"use client";

import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  createUserAction,
  bulkCreateUsersAction,
  updateResponderBindingAction,
} from "./actions";
import {
  UserPlus,
  FileSpreadsheet,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  MapPin,
} from "lucide-react";
import { Location, Profile } from "@/types/database";

export default function UserModals({
  locations,
  responders,
  responderToEdit,
  onResponderEditClose,
}: {
  locations: Location[];
  responders: Profile[];
  responderToEdit?: Profile | null;
  onResponderEditClose?: () => void;
}) {
  const [singleOpen, setSingleOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Single User Form State
  const [selectedRole, setSelectedRole] = useState("employee");
  const [createLocationIds, setCreateLocationIds] = useState<string[]>([]);
  const [singleLoading, setSingleLoading] = useState(false);

  // CSV Bulk Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsed, setCsvParsed] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Responder Edit State — driven by parent via responderToEdit prop
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [backupResponderId, setBackupResponderId] = useState<string>("");
  const [boundLocationIds, setBoundLocationIds] = useState<string[]>([]);
  const [responderLoading, setResponderLoading] = useState(false);

  // Sync state when responderToEdit changes from parent
  useEffect(() => {
    if (responderToEdit) {
      setIsOnLeave(responderToEdit.is_on_leave || false);
      setBackupResponderId(responderToEdit.backup_responder_id || "");
      const existingLocIds =
        responderToEdit.responder_locations?.map((l) => l.id) || [];
      setBoundLocationIds(existingLocIds);
    }
  }, [responderToEdit]);

  async function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSingleLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await createUserAction(formData);
    setSingleLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setSingleOpen(false);
      setSelectedRole("employee");
      setCreateLocationIds([]);
      (e.target as HTMLFormElement).reset();
    }
  }

  function handleCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvParsed(results.data);
        toast.info(`Parsed ${results.data.length} rows from CSV`);
      },
      error: (err) => {
        toast.error(`CSV Parsing Error: ${err.message}`);
      },
    });
  }

  async function handleBulkSubmit() {
    if (csvParsed.length === 0) {
      toast.error("No valid CSV rows parsed.");
      return;
    }

    setBulkLoading(true);
    const result = await bulkCreateUsersAction(csvParsed);
    setBulkLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      setBulkOpen(false);
      setCsvFile(null);
      setCsvParsed([]);
    }
  }

  async function handleResponderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!responderToEdit) return;

    setResponderLoading(true);
    const result = await updateResponderBindingAction(
      responderToEdit.id,
      isOnLeave,
      backupResponderId || null,
      boundLocationIds
    );
    setResponderLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      onResponderEditClose?.();
    }
  }

  function toggleLocationBinding(locationId: string) {
    setBoundLocationIds((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    );
  }

  return (
    <>
      {/* Top Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setSingleOpen(true)}
          className="px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          Add Single User
        </button>

        <button
          onClick={() => setBulkOpen(true)}
          className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          CSV Bulk Import
        </button>
      </div>

      {/* 1. SINGLE USER CREATION MODAL */}
      {singleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" /> Create New User
              </h2>
              <button
                onClick={() => setSingleOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="full_name"
                  required
                  placeholder="e.g. Tariq Ahmed"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="tariq@tajgasoline.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    User Role *
                  </label>
                  <select
                    name="role"
                    required
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  >
                    <option value="employee">Employee</option>
                    <option value="site_manager">Site Manager</option>
                    <option value="responder">IT Responder</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Primary Location
                  </label>
                  <select
                    name="location_id"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  >
                    <option value="">-- Select Primary Site --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedRole === "responder" && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-900 uppercase">
                      Bound Locations / Fueling Sites ({createLocationIds.length} selected)
                    </label>
                    <span className="text-[10px] text-amber-700 font-medium">Multi-select binding</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2 border border-amber-200 rounded-lg">
                    {locations.map((loc) => {
                      const isChecked = createLocationIds.includes(loc.id);
                      return (
                        <label key={loc.id} className="flex items-center justify-between p-1.5 hover:bg-slate-50 text-xs font-medium cursor-pointer rounded">
                          <span className="text-slate-800">{loc.name} ({loc.city})</span>
                          <input
                            type="checkbox"
                            name="location_ids"
                            value={loc.id}
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateLocationIds((prev) => [...prev, loc.id]);
                              } else {
                                setCreateLocationIds((prev) => prev.filter((id) => id !== loc.id));
                              }
                            }}
                            className="w-4 h-4 accent-[#0F172A]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phone_number"
                  placeholder="+92 300 1234567"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSingleOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={singleLoading}
                  className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-70"
                >
                  {singleLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CSV BULK IMPORT MODAL */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> CSV Bulk User Import
              </h2>
              <button
                onClick={() => setBulkOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5">
                <p className="font-semibold">CSV Column Formatting Instructions:</p>
                <p>Ensure your CSV contains header fields: <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">full_name, email, role, location_name, phone_number</code></p>
                <p className="text-emerald-700">Supported Roles: <code>employee</code>, <code>site_manager</code>, <code>responder</code>, <code>admin</code></p>
                <div className="pt-2 border-t border-emerald-200 flex items-center gap-2 font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-300 shadow-sm">
                  <span className="text-base">🔑</span>
                  <span>Default Account Password: <code className="bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded font-mono text-xs font-extrabold">Taj@1234</code>. Share these initial credentials (User Email & Taj@1234) with imported employees.</span>
                </div>
              </div>

              {/* Upload Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">
                  {csvFile ? csvFile.name : "Click to select or drop CSV file"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">.csv files up to 5MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileSelect}
                  className="hidden"
                />
              </div>

              {/* Parsed Preview Table */}
              {csvParsed.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Parsed CSV Rows Preview ({csvParsed.length} entries)</span>
                    <span className="text-emerald-600 font-bold">Ready to import</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                        <tr>
                          <th className="p-2 border-b">Full Name</th>
                          <th className="p-2 border-b">Email</th>
                          <th className="p-2 border-b">Role</th>
                          <th className="p-2 border-b">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {csvParsed.slice(0, 50).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-medium">{row.full_name || "-"}</td>
                            <td className="p-2">{row.email || "-"}</td>
                            <td className="p-2 uppercase text-[10px] font-bold">{row.role || "employee"}</td>
                            <td className="p-2 text-slate-500">{row.location_name || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkSubmit}
                  disabled={bulkLoading || csvParsed.length === 0}
                  className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {bulkLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Execute Bulk Import ({csvParsed.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. EDIT RESPONDER & MULTI-LOCATION BINDING MODAL */}
      {responderToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" /> Responder Settings: {responderToEdit.full_name}
              </h2>
              <button
                onClick={onResponderEditClose}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResponderSubmit} className="space-y-5 pt-4">
              {/* On Leave Toggle & Backup Selection */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-amber-900 block">
                      Responder &quot;On Leave&quot; Status
                    </label>
                    <p className="text-[11px] text-amber-700">
                      When enabled, incoming tickets will automatically route to the assigned backup responder.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isOnLeave}
                    onChange={(e) => setIsOnLeave(e.target.checked)}
                    className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                  />
                </div>

                {isOnLeave && (
                  <div className="pt-2 border-t border-amber-200">
                    <label className="block text-xs font-semibold text-amber-900 uppercase mb-1">
                      Assigned Backup Responder *
                    </label>
                    <select
                      value={backupResponderId}
                      onChange={(e) => setBackupResponderId(e.target.value)}
                      required={isOnLeave}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Choose Backup Responder --</option>
                      {responders
                        .filter((r) => r.id !== responderToEdit.id)
                        .map((resp) => (
                          <option key={resp.id} value={resp.id}>
                            {resp.full_name} ({resp.email})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Multi-Location Bindings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Bound Fueling Sites & Locations ({boundLocationIds.length} selected)
                  </label>
                  <span className="text-[11px] text-slate-500">Check all sites responder oversees</span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50">
                  {locations.map((loc) => {
                    const isChecked = boundLocationIds.includes(loc.id);
                    return (
                      <label
                        key={loc.id}
                        onClick={() => toggleLocationBinding(loc.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                          isChecked
                            ? "bg-white border-[#0F172A] text-[#0F172A] shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className={`w-3.5 h-3.5 ${isChecked ? "text-emerald-600" : "text-slate-400"}`} />
                          <span>{loc.name}</span>
                          <span className="text-[10px] text-slate-400">({loc.city})</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by container onClick
                          className="w-4 h-4 accent-[#0F172A]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onResponderEditClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={responderLoading}
                  className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {responderLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Responder Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
