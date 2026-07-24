"use client";

import { useState, useRef } from "react";
import { Camera, Image as ImageIcon, X, Paperclip } from "lucide-react";

export default function PhotoAttachmentPicker({
  onAttachmentsChange,
}: {
  onAttachmentsChange?: (files: File[]) => void;
}) {
  const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newItems = selectedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    const updated = [...attachments, ...newItems].slice(0, 3); // Max 3 attachments
    setAttachments(updated);

    if (onAttachmentsChange) {
      onAttachmentsChange(updated.map((item) => item.file));
    }
  }

  function handleRemove(index: number) {
    const updated = attachments.filter((_, i) => i !== index);
    setAttachments(updated);
    if (onAttachmentsChange) {
      onAttachmentsChange(updated.map((item) => item.file));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
          Photo Evidence / Attachments (Max 3)
        </label>
        <span className="text-[11px] text-slate-400">
          Attach images of dispenser leaks, POS error codes, etc.
        </span>
      </div>

      {/* Attachment Previews */}
      <div className="flex flex-wrap items-center gap-3">
        {attachments.map((item, idx) => (
          <div
            key={idx}
            className="relative w-24 h-24 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm group"
          >
            <img
              src={item.preview}
              alt={`Attachment ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-90 hover:opacity-100 shadow transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {attachments.length < 3 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 border-2 border-dashed border-slate-300 hover:border-[#0F172A] bg-slate-50 hover:bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-[#0F172A] transition-all"
          >
            <Camera className="w-6 h-6 mb-1 text-slate-400" />
            <span className="text-[10px] font-bold">Add Photo</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
