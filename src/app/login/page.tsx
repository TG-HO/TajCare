"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";
import { ShieldCheck, Fuel, Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = (await loginAction(formData)) as {
        error?: string;
        success?: boolean;
        redirectUrl?: string;
      };

      if (result?.error) {
        let msg = "Invalid credentials.";
        if (typeof result.error === "string" && result.error !== "{}" && result.error !== "[object Object]") {
          msg = result.error;
        } else if (result.error && (result.error as any).message) {
          msg = String((result.error as any).message);
        }
        toast.error(msg);
        setLoading(false);
      } else if (result?.success && result?.redirectUrl) {
        toast.success("Login successful! Redirecting...");
        window.location.href = result.redirectUrl;
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to log in.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      {/* Branding Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0F172A] text-white mb-4 shadow-lg shadow-slate-900/10">
          <Fuel className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Taj Care
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          IT Ticket & Support Portal • Taj Gasoline
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#0F172A]">Sign in to your account</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Enter your employee email and password to access the portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                name="email"
                required
                placeholder="name@tajgasoline.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Taj Gasoline IT Operations. All rights reserved.
      </div>
    </div>
  );
}
