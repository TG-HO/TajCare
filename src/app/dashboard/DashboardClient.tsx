"use client";

import { useState } from "react";
import { Ticket, Profile } from "@/types/database";
import { getStatusBadgeColor, formatDate } from "@/lib/utils";
import { Ticket as TicketIcon, Plus, Clock, CheckCircle2, RotateCcw, Eye, MapPin, User, Star, Award, AlertTriangle } from "lucide-react";
import Link from "next/link";
import TicketRatingModal from "@/components/TicketRatingModal";
import TicketDetailDrawer from "@/components/TicketDetailDrawer";

export default function DashboardClient({
  profile,
  tickets,
}: {
  profile: Profile;
  tickets: Ticket[];
}) {
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [modalMode, setModalMode] = useState<"rate" | "reopen" | null>(null);
  const [drawerTicket, setDrawerTicket] = useState<Ticket | null>(null);

  const activeTickets = tickets.filter((t) => t.status !== "Closed");
  const completedTickets = tickets.filter((t) => t.status === "Closed");

  const displayList = activeTab === "active" ? activeTickets : completedTickets;

  function canReopen(ticket: Ticket) {
    if (ticket.status !== "Issue Resolved" && ticket.status !== "Visited") return false;
    const resolvedAt = new Date(ticket.updated_at || ticket.created_at || "").getTime();
    const hoursElapsed = (Date.now() - resolvedAt) / (1000 * 60 * 60);
    return hoursElapsed <= 72;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Action */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
            {profile?.location?.name || "Taj Gasoline Portal"}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome back, {profile?.full_name}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Log IT support requests, monitor responder dispatch progress, and rate issue resolution.
          </p>
        </div>

        <Link
          href="/tickets/new"
          className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-[#0F172A] text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Log New Complaint
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "active"
                ? "bg-[#0F172A] text-white shadow"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Active Complaints ({activeTickets.length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "completed"
                ? "bg-[#0F172A] text-white shadow"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Closed History ({completedTickets.length})
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {displayList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <TicketIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#0F172A]">No {activeTab} complaints</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === "active"
                ? "You currently have no open IT tickets. Click 'Log New Complaint' above to submit a support request."
                : "Your closed ticket history is clean."}
            </p>
          </div>
        ) : (
          displayList.map((ticket) => {
            const title =
              ticket.issue_type?.issue_title || ticket.custom_issue_title || "General IT Complaint";
            
            const isVisitPassed = ticket.scheduled_visit_date ? new Date() >= new Date(ticket.scheduled_visit_date) : false;
            const isSiteManager = profile?.role === "site_manager";
            
            // Show rating/close button for:
            // - Issue Resolved or Visited tickets (all roles)
            // - Visit Date Scheduled tickets when visit date has passed (site managers & employees)
            const showRatingButton =
              ticket.status === "Issue Resolved" ||
              ticket.status === "Visited" ||
              (ticket.status === "Visit Date Scheduled" && isVisitPassed);

            const showReopenButton = canReopen(ticket);

            return (
              <div
                key={ticket.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-[#0F172A]">
                      #{ticket.ticket_number}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusBadgeColor(
                        ticket.status
                      )}`}
                    >
                      {ticket.status}
                    </span>
                    {ticket.reopened_count && ticket.reopened_count > 0 ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Re-opened ({ticket.reopened_count}x)
                      </span>
                    ) : null}
                    {isVisitPassed && ticket.status !== "Closed" && ticket.status !== "Issue Resolved" && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Visit Date Reached - Ready to Close
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Logged: {formatDate(ticket.created_at)}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <h3 className="font-bold text-[#0F172A] text-base">{title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{ticket.description}</p>
                    {ticket.scheduled_visit_date && (
                      <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        isVisitPassed ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}>
                        <Clock className="w-3.5 h-3.5" /> Scheduled Visit: {formatDate(ticket.scheduled_visit_date)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setDrawerTicket(ticket)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Timeline
                    </button>

                    {showRatingButton && (
                      <button
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setModalMode("rate");
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5 fill-white" />
                        Close & Rate Resolution
                      </button>
                    )}

                    {showReopenButton && (
                      <button
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setModalMode("reopen");
                        }}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        Re-Open Ticket (72h)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals & Drawers */}
      {selectedTicket && modalMode && (
        <TicketRatingModal
          ticket={selectedTicket}
          mode={modalMode}
          onClose={() => {
            setSelectedTicket(null);
            setModalMode(null);
          }}
        />
      )}

      {drawerTicket && (
        <TicketDetailDrawer
          ticket={drawerTicket}
          onClose={() => setDrawerTicket(null)}
        />
      )}
    </div>
  );
}
