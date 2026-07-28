"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

export default function RefreshButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleRefresh() {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      title="Refresh data"
      className={`px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${className}`}
    >
      <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
      <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
    </button>
  );
}
