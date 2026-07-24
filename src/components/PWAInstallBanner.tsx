"use client";

import { useState, useEffect } from "react";
import { Download, X, Fuel } from "lucide-react";

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-[#0F172A] text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-[#0F172A] flex items-center justify-center font-bold flex-shrink-0">
          <Fuel className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-xs">Install Taj Care App</h4>
          <p className="text-[11px] text-slate-300">Add to Home Screen for quick access</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-[#0F172A] text-xs font-bold rounded-lg transition-all flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button
          onClick={() => setVisible(false)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
