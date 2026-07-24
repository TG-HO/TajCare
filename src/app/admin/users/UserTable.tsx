"use client";

import { useState } from "react";
import { Profile, Location } from "@/types/database";
import { getRoleBadgeColor, formatDate } from "@/lib/utils";
import { Search, Filter, Wrench, Trash2, MapPin, AlertCircle, ShieldCheck } from "lucide-react";
import { deleteUserAction } from "./actions";
import { toast } from "sonner";

export default function UserTable({
  initialUsers,
  locations,
  onEditResponder,
}: {
  initialUsers: Profile[];
  locations: Location[];
  onEditResponder?: (user: Profile) => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredUsers = initialUsers.filter((u) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone_number?.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Are you sure you want to delete user ${name}?`)) return;

    const result = await deleteUserAction(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
    }
  }

  function handleOpenResponder(user: Profile) {
    onEditResponder?.(user);
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
            placeholder="Search by name, email or phone..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
          >
            <option value="all">All Roles ({initialUsers.length})</option>
            <option value="employee">Employees</option>
            <option value="site_manager">Site Managers</option>
            <option value="responder">Responders</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* Users Datatable */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Primary Location</th>
                <th className="p-4">Responder Bindings / Status</th>
                <th className="p-4">Joined</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No users found matching filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0F172A] text-white font-bold flex items-center justify-center text-xs">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A]">{user.full_name}</p>
                          <p className="text-[11px] text-slate-500">{user.email}</p>
                          {user.phone_number && (
                            <p className="text-[10px] text-slate-400">{user.phone_number}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td className="p-4">
                      {user.location ? (
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{user.location.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="p-4">
                      {user.role === "responder" ? (
                        <div className="space-y-1">
                          {user.is_on_leave ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertCircle className="w-3 h-3" /> ON LEAVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3" /> Active Duty
                            </span>
                          )}

                          {user.responder_locations && user.responder_locations.length > 0 ? (
                            <p className="text-[10px] text-slate-500">
                              Bound to {user.responder_locations.length} site(s)
                            </p>
                          ) : (
                            <p className="text-[10px] text-amber-600 italic">No locations bound</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="p-4 text-slate-500 text-[11px]">
                      {formatDate(user.created_at)}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.role === "responder" && (
                          <button
                            onClick={() => handleOpenResponder(user)}
                            title="Edit Responder & Multi-Location Bindings"
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                          >
                            <Wrench className="w-3 h-3 text-amber-600" />
                            Binding & Leave
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(user.id, user.full_name)}
                          title="Delete User"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
