"use client";

import { useState } from "react";
import { updateProfileInfoAction, updatePasswordAction } from "../actions";
import { toast } from "sonner";
import { User, Lock, Loader2, Save } from "lucide-react";

export default function ProfileSettingsForm({ profile }: { profile: any }) {
  const [infoLoading, setInfoLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInfoLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateProfileInfoAction(formData);
    setInfoLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPassLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await updatePasswordAction(formData);
    setPassLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message);
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <>
      {/* Profile Details Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <User className="w-5 h-5 text-[#0F172A]" />
          <h2 className="text-base font-bold text-[#0F172A]">Personal Information</h2>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="full_name"
              defaultValue={profile?.full_name || ""}
              required
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#0F172A] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address (Read-only)
            </label>
            <input
              type="email"
              disabled
              value={profile?.email || ""}
              className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Phone Number
            </label>
            <input
              type="text"
              name="phone_number"
              defaultValue={profile?.phone_number || ""}
              placeholder="+92 300 1234567"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#0F172A] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={infoLoading}
              className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow transition-all flex items-center gap-1.5 disabled:opacity-70"
            >
              {infoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Lock className="w-5 h-5 text-[#0F172A]" />
          <h2 className="text-base font-bold text-[#0F172A]">Security & Password</h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              New Password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#0F172A] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={6}
              placeholder="Re-enter password"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#0F172A] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={passLoading}
              className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow transition-all flex items-center gap-1.5 disabled:opacity-70"
            >
              {passLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Update Password
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
