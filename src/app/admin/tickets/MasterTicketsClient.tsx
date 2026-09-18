"use client";

import { useState } from "react";
import { Ticket, Location, Profile } from "@/types/database";
import { getStatusBadgeColor, formatDate } from "@/lib/utils";
import {
  Search,
  Filter,
  Eye,
  Ticket as TicketIcon,
  MapPin,
  ShieldCheck,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Calendar,
  RotateCw,
  Zap,
  X,
  Lock,
} from "lucide-react";
import TicketDetailDrawer from "@/components/TicketDetailDrawer";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import TicketResponseTimer from "@/components/TicketResponseTimer";

export default function MasterTicketsClient({
  tickets,
  locations,
  responders,
  supervisors = [],
  userRole = "admin",
  isScoped = false,
}: {
  tickets: Ticket[];
  locations: Location[];
  responders: Profile[];
  supervisors?: Profile[];
  userRole?: string;
  isScoped?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [responderFilter, setResponderFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [drawerTicket, setDrawerTicket] = useState<Ticket | null>(null);

  // Date filtering logic
  function matchesDate(dateStr?: string): boolean {
    if (!dateStr || datePreset === "all") return true;
    const ticketDate = new Date(dateStr);
    const now = new Date();

    if (datePreset === "today") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return ticketDate >= todayStart;
    }
    if (datePreset === "yesterday") {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return ticketDate >= yesterdayStart && ticketDate < todayStart;
    }
    if (datePreset === "last7") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return ticketDate >= sevenDaysAgo;
    }
    if (datePreset === "last30") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return ticketDate >= thirtyDaysAgo;
    }
    if (datePreset === "this_month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return ticketDate >= monthStart;
    }
    if (datePreset === "custom") {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (ticketDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (ticketDate > end) return false;
      }
      return true;
    }
    return true;
  }

  function handleResetDates() {
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
  }

  async function handleRunEscalationAudit() {
    setEscalating(true);
    try {
      const res = await fetch("/api/cron/escalations");
      const json = await res.json();
      setEscalating(false);
      if (json.success) {
        toast.success(json.message);
        router.refresh();
      } else {
        toast.error(json.error || "Failed to process hierarchy escalations.");
      }
    } catch (err: any) {
      setEscalating(false);
      toast.error(err.message || "Failed to connect to escalation service.");
    }
  }

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

    const matchesDateFilter = matchesDate(t.created_at);

    return matchesSearch && matchesStatus && matchesLocation && matchesResponder && matchesDateFilter;
  });

  const roleTitle =
    userRole === "admin"
      ? "Super Admin"
      : userRole === "hod"
      ? "HOD"
      : userRole === "line_manager"
      ? "Line Manager"
      : "Supervisor";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-2">
            <TicketIcon className="w-4 h-4 text-indigo-400" />
            {isScoped
              ? `${roleTitle} Portal • Assigned Team Responders Scope`
              : "System-Wide Master Ticket Audit"}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Master Complaints & Dispatches Monitor ({tickets.length})
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Real-time monitoring of complaints, assigned responders, scheduled visits, and hierarchy response escalations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunEscalationAudit}
            disabled={escalating}
            title="Check unresponded tickets and trigger hierarchy escalations (Supervisor -> Line Manager -> HOD)"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {escalating ? (
              <RotateCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Zap className="w-4 h-4 text-amber-300" />
            )}
            Audit Response Escalations
          </button>
        </div>
      </div>

      {/* Advanced Filter Bar (Status, Location, Responder & Date-wise Filter) */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm space-y-3">
        {/* Row 1: Search, Status, Location, Responder */}
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
              <option value="all">All Responders ({responders.length})</option>
              <option value="unassigned">Unassigned Only</option>
              {responders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date-wise Filter Bar for all Administrative Roles */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Date Filter:</span>
            </div>

            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-xs focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>

            {datePreset === "custom" && (
              <div className="flex items-center gap-2 animate-in fade-in">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  placeholder="From"
                />
                <span className="text-slate-400 font-semibold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                  placeholder="To"
                />
              </div>
            )}

            {datePreset !== "all" && (
              <button
                onClick={handleResetDates}
                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold"
              >
                <X className="w-3 h-3" /> Clear Date
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="font-bold text-[#0F172A]">{filteredTickets.length}</span> of {tickets.length} complaints
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
                <th className="p-4">SLA & Escalation</th>
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
                  const issue = t.issue_type;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-[#0F172A]">#{t.ticket_number}</span>
                            {t.attachments && t.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                <Camera className="w-2.5 h-2.5 text-purple-600" /> {t.attachments.length} Photo{t.attachments.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
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
                            <div
                              className={`text-[10px] font-bold flex items-center gap-1 ${
                                visitPassed ? "text-rose-600" : "text-indigo-600"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(t.scheduled_visit_date)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          {/* SLA Resolution Time Info */}
                          {issue && (
                            <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Target: {issue.resolution_time_hours ?? 24}h {issue.resolution_time_minutes ?? 0}m</span>
                            </div>
                          )}

                          {/* Live Response SLA Countdown */}
                          <div>
                            <TicketResponseTimer ticket={t} />
                          </div>

                          {/* Breach or On-Time Status */}
                          {t.sla_breached ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" /> SLA Breached
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> SLA Active
                            </span>
                          )}

                          {/* Execution Hierarchy Escalation Badges */}
                          {t.locked_for_responder && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                <Lock className="w-2.5 h-2.5 text-amber-700" /> Supervised (Locked)
                              </span>
                            </div>
                          )}
                          {t.escalation_level === 1 && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                ⚠️ Escalated: Supervisor
                              </span>
                            </div>
                          )}
                          {t.escalation_level === 2 && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-300">
                                🚨 Escalated: Line Manager
                              </span>
                            </div>
                          )}
                          {t.escalation_level === 3 && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-300 animate-pulse">
                                🔥 Escalated: HOD & Admin
                              </span>
                            </div>
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
          userRole={userRole}
          responders={responders}
          supervisors={supervisors}
          onClose={() => setDrawerTicket(null)}
        />
      )}
    </div>
  );
}
