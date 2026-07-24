"use client";

import { useState } from "react";
import { Ticket, Location, Profile } from "@/types/database";
import { getStatusBadgeColor, formatDate } from "@/lib/utils";
import { Search, Filter, Eye, Ticket as TicketIcon, MapPin, User, ShieldCheck, Clock, Star, AlertTriangle, CheckCircle2 } from "lucide-react";
import TicketDetailDrawer from "@/components/TicketDetailDrawer";

export default function MasterTicketsClient({
  tickets,
  locations,
  responders,
}: {
  tickets: Ticket[];
  locations: Location[];
  responders: Profile[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [responderFilter, setResponderFilter] = useState("all");
  const [drawerTicket, setDrawerTicket] = useState<Ticket | null>(null);

  const filteredTickets = tickets.filter((t) => {
    const title = t.issue_type?.issue_title || t.custom_issue_title || "";
    const matchesSearch =
      t.ticket_number?.toString().includes(search) ||
      title.toLowerCase().includes(search.toLowerCase()) ||
      t.complainant?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.location?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.assigned_responder?.full_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesLocation = locationFilter === "all" || t.location_id === locationFilter;
    const matchesResponder =
      responderFilter === "all" ||
      (responderFilter === "unassigned" ? !t.assigned_responder_id : t.assigned_responder_id === responderFilter);

    return matchesSearch && matchesStatus && matchesLocation && matchesResponder;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-2">
            <TicketIcon className="w-4 h-4 text-indigo-400" /> System-Wide Master Ticket Audit
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Master Complaints & Dispatches Monitor ({tickets.length})
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Real-time monitoring of all site complaints, assigned responders, scheduled visits, and transition remarks.
          </p>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, name, site..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
            >
              <option value="all">All Statuses ({tickets.length})</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Visit Date Scheduled">Visit Scheduled</option>
              <option value="Visited">Visited</option>
              <option value="Issue Resolved">Issue Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
            >
              <option value="all">All Locations ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.city})
                </option>
              ))}
            </select>
          </div>

          {/* Responder Filter */}
          <div>
            <select
              value={responderFilter}
              onChange={(e) => setResponderFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
            >
              <option value="all">All Responders</option>
              <option value="unassigned">Unassigned Only</option>
              {responders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Master Datatable */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4">Ticket</th>
                <th className="p-4">Complainant & Location</th>
                <th className="p-4">Assigned Responder</th>
                <th className="p-4">Status & Visit Date</th>
                <th className="p-4">SLA & CSAT</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No tickets match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const title = t.issue_type?.issue_title || t.custom_issue_title || "General IT Request";
                  const visitPassed = t.scheduled_visit_date && new Date() >= new Date(t.scheduled_visit_date);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div>
                          <span className="font-extrabold text-[#0F172A]">#{t.ticket_number}</span>
                          <p className="font-bold text-slate-800 text-xs mt-0.5 max-w-xs truncate">{title}</p>
                          <span className="text-[10px] text-slate-400">{formatDate(t.created_at)}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-slate-800">{t.complainant?.full_name || "Unknown"}</p>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{t.location?.name || "Unassigned Location"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        {t.assigned_responder ? (
                          <div>
                            <p className="font-semibold text-[#0F172A] flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              {t.assigned_responder.full_name}
                            </p>
                            {t.assigned_responder.is_on_leave && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                On Leave
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-600 italic font-medium">Unassigned</span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeColor(
                              t.status
                            )}`}
                          >
                            {t.status}
                          </span>
                          {t.scheduled_visit_date && (
                            <div className={`text-[10px] font-bold flex items-center gap-1 ${
                              visitPassed ? "text-rose-600" : "text-indigo-600"
                            }`}>
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(t.scheduled_visit_date)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          {t.sla_breached ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" /> SLA Breached
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> On Time
                            </span>
                          )}

                          {t.closure_rating ? (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span>{t.closure_rating} / 5</span>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => setDrawerTicket(t)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Audit History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Detail Drawer */}
      {drawerTicket && (
        <TicketDetailDrawer
          ticket={drawerTicket}
          onClose={() => setDrawerTicket(null)}
        />
      )}
    </div>
  );
}
