"use client";

import { useState } from "react";
import { rateAndCloseTicketAction, reopenTicketAction } from "@/app/tickets/actions";
import { toast } from "sonner";
import { Star, RotateCcw, X, Loader2, CheckCircle2 } from "lucide-react";
import { Ticket } from "@/types/database";

export default function TicketRatingModal({
  ticket,
  onClose,
  mode,
}: {
  ticket: Ticket;
  onClose: () => void;
  mode: "rate" | "reopen";
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await rateAndCloseTicketAction(ticket.id, rating, remarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      onClose();
    }
  }

  async function handleReopenSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await reopenTicketAction(ticket.id, remarks);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            {mode === "rate" ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Close & Rate Ticket #{ticket.ticket_number}
              </>
            ) : (
              <>
                <RotateCcw className="w-5 h-5 text-amber-600" />
                Re-Open Ticket #{ticket.ticket_number}
              </>
            )}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === "rate" ? (
          <form onSubmit={handleRateSubmit} className="space-y-5 pt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 text-center">
                How satisfied are you with the resolution?
              </label>
              <div className="flex items-center justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        (hoverRating || rating) >= star
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-center text-xs font-bold text-slate-600 mt-1">
                {rating === 5 && "⭐ Excellent Service"}
                {rating === 4 && "👍 Good Support"}
                {rating === 3 && "😐 Acceptable"}
                {rating === 2 && "👎 Below Expectations"}
                {rating === 1 && "⚠️ Unsatisfactory"}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Feedback Remarks (Optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Share any feedback about the IT responder's service..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Close Ticket
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReopenSubmit} className="space-y-4 pt-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <p className="font-bold">Re-Open Complaint</p>
              <p className="text-[11px] leading-relaxed">
                This will return the ticket to <strong>Reopened</strong> status and notify the IT Responder to re-attend. The responder&apos;s earned points will revert to <strong>Pending</strong> until you close and rate again.
              </p>
              {ticket.status === "Closed" && (
                <p className="text-[11px] leading-relaxed font-semibold text-amber-800">
                  ⚠️ Post-Closure: You are reopening within the 72-hour grace window. Any confirmed points will be reverted to Pending.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Reason for Re-Opening *
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required
                rows={3}
                placeholder="Describe why the issue is not resolved..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Re-Open Complaint
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
