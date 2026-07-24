import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileSettingsForm from "./ProfileSettingsForm";
import { User, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations!location_id(name)")
    .eq("id", user.id)
    .single();

  const dashboardLink = profile?.role === "admin" ? "/admin" : profile?.role === "responder" ? "/responder" : "/dashboard";

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={dashboardLink}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F172A] mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Account Settings
          </h1>
          <p className="text-sm text-slate-500">
            Manage your profile details and security settings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Info Summary Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xl font-bold mb-3 shadow-md">
              {profile?.full_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <h3 className="font-bold text-[#0F172A] text-base">{profile?.full_name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                {profile?.role}
              </span>
              {profile?.location?.name && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {profile.location.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Forms Container */}
        <div className="md:col-span-2 space-y-6">
          <ProfileSettingsForm profile={profile} />
        </div>
      </div>
    </div>
  );
}
