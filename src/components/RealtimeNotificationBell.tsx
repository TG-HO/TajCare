"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Ticket } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function RealtimeNotificationBell({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to realtime changes on tickets table
    const channel = supabase
      .channel("realtime-ticket-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          const payloadNew = payload.new as any;
          const newStatus = payloadNew?.status;
          const ticketNum = payloadNew?.ticket_number;

          const notif: NotificationItem = {
            id: String(Date.now()),
            title: `Ticket #${ticketNum || "Update"}`,
            message: `Status updated to "${newStatus || "Modified"}"`,
            timestamp: new Date().toISOString(),
            read: false,
          };

          setNotifications((prev) => [notif, ...prev]);
          toast.info(`🔔 ${notif.title}: ${notif.message}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition-all focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-[#0F172A]" />
              <span className="font-bold text-xs text-[#0F172A]">Live Notifications</span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] font-semibold text-emerald-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Ticket className="w-6 h-6 mx-auto mb-2 opacity-50" />
                No new notifications. Realtime listener active.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 space-y-0.5 transition-colors ${
                    n.read ? "bg-white text-slate-600" : "bg-emerald-50/40 text-slate-900 font-medium"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#0F172A]">{n.title}</span>
                    <span className="text-[10px] text-slate-400">{formatDate(n.timestamp)}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
