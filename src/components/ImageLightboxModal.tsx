"use client";

import { useEffect } from "react";
import { X, Download, ZoomIn, Image as ImageIcon } from "lucide-react";

export default function ImageLightboxModal({
  imageUrl,
  title = "Evidence Photo",
  onClose,
}: {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  function handleDownload() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `taj-care-evidence-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
    >
      {/* Top Action Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl flex items-center justify-between py-3 px-4 bg-slate-900/90 border border-slate-800 rounded-2xl text-white mb-3 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold tracking-wide">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[80vh] flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl"
      >
        <img
          src={imageUrl}
          alt={title}
          className="max-w-full max-h-[80vh] object-contain rounded-xl select-none"
        />
      </div>

      <p className="text-[11px] text-slate-400 mt-3 font-medium">
        Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono border border-slate-700">ESC</kbd> or click outside to close
      </p>
    </div>
  );
}
