import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TicketStatus } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getComplexityBadgeColor(complexity: string) {
  switch (complexity) {
    case "Low":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Medium":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "High":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Critical":
      return "bg-rose-50 text-rose-700 border-rose-200 font-semibold";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function getRoleBadgeColor(role: string) {
  switch (role) {
    case "admin":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "responder":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "site_manager":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "employee":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function getStatusBadgeColor(status: TicketStatus | string) {
  switch (status) {
    case "Pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "In Progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Visit Date Scheduled":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Visited":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Issue Resolved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold";
    case "Closed":
      return "bg-slate-100 text-slate-700 border-slate-300";
    case "Reopened":
      return "bg-rose-50 text-rose-700 border-rose-300 font-semibold";
    case "Permanently Closed":
      return "bg-slate-800 text-slate-100 border-slate-700 font-semibold";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}
