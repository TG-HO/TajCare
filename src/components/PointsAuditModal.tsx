"use client";

import { X, Award, Star, AlertTriangle, Calculator, ShieldCheck } from "lucide-react";
import { Ticket, PointsTransaction } from "@/types/database";

export default function PointsAuditModal({
  ticket,
  transaction,
  onClose,
}: {
  ticket?: Ticket | null;
  transaction?: PointsTransaction | null;
  onClose: () => void;
}) {
  const basePoints = ticket?.issue_type?.base_points || transaction?.base_points || ticket?.points_awarded || 20;
  const rating = ticket?.closure_rating || 5;
  const slaBreached = ticket?.sla_breached || false;

  const ratingMultipliers: Record<number, number> = {
    5: 1.5,
    4: 1.25,
    3: 1.0,
    2: 0.8,
    1: 0.5,
  };

  const multiplier = transaction?.rating_multiplier || ratingMultipliers[rating] || 1.0;
  const subtotal = Math.round(basePoints * multiplier);
  const slaPenalty = transaction?.sla_penalty ?? (slaBreached ? 15 : 0);
  const finalPoints = transaction?.final_points ?? Math.max(0, subtotal - slaPenalty);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-[#0F172A] text-base">Points Audit & Calculation Formula</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <span className="text-slate-400 font-semibold uppercase">Item Reference</span>
          <p className="font-bold text-[#0F172A]">
            {ticket ? `Complaint #${ticket.ticket_number} — ${ticket.issue_type?.issue_title || ticket.custom_issue_title}` : "Points Transaction Entry"}
          </p>
        </div>

        {/* Math Calculation Table */}
        <div className="bg-slate-900 text-white rounded-xl p-4 text-xs space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">1. Base Points (Complexity)</span>
            <span className="font-bold text-white">+{basePoints} pts</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">2. Star Rating Multiplier ({rating}★)</span>
            <span className="font-bold text-amber-400">× {multiplier}x</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-bold text-blue-400">= {subtotal} pts</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">3. 24-Hour SLA Breach Penalty</span>
            <span className={slaPenalty > 0 ? "font-bold text-rose-400" : "font-bold text-slate-500"}>
              -{slaPenalty} pts
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 text-sm">
            <span className="font-bold text-amber-300">Final Confirmed Points</span>
            <span className="font-extrabold text-amber-300 text-base">+{finalPoints} pts</span>
          </div>
        </div>

        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 leading-relaxed">
          <p className="font-bold mb-0.5">ℹ️ Transparency Note:</p>
          <p>
            Example: A 35 base point ticket rated 4 Stars (1.25x) becomes <code>Math.round(35 × 1.25) = 44 points</code>.
          </p>
        </div>

        <div className="pt-2 flex justify-end border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
