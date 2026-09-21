"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MapPin,
  AlertTriangle,
  BarChart3,
  Trophy,
  Ticket,
  CheckCircle2,
  Wrench,
} from "lucide-react";

export default function AdminNavLinks({ userRole = "admin" }: { userRole?: string }) {
  const pathname = usePathname();
  const isSuperAdmin = userRole === "admin";
  const isSupervisorOrAdmin = userRole === "supervisor" || userRole === "admin";

  const allLinks = [
    {
      name: "Dashboard Overview",
      href: "/admin",
      icon: LayoutDashboard,
      exact: true,
      superAdminOnly: false,
      supervisorOnly: false,
    },
    {
      name: "My Handled Tickets",
      href: "/admin/supervised",
      icon: Wrench,
      superAdminOnly: false,
      supervisorOnly: true,
    },
    {
      name: "Master Tickets Monitor",
      href: "/admin/tickets",
      icon: Ticket,
      superAdminOnly: false,
      supervisorOnly: false,
    },
    {
      name: "Operational Tasks",
      href: "/admin/tasks",
      icon: CheckCircle2,
      superAdminOnly: false,
      supervisorOnly: false,
    },
    {
      name: "User Management",
      href: "/admin/users",
      icon: Users,
      superAdminOnly: true,
      supervisorOnly: false,
    },
    {
      name: "Locations & Sites",
      href: "/admin/locations",
      icon: MapPin,
      superAdminOnly: true,
      supervisorOnly: false,
    },
    {
      name: "Predefined Issues",
      href: "/admin/issues",
      icon: AlertTriangle,
      superAdminOnly: true,
      supervisorOnly: false,
    },
    {
      name: "Performance Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      superAdminOnly: true,
      supervisorOnly: false,
    },
    {
      name: "Monthly Leaderboard",
      href: "/leaderboard",
      icon: Trophy,
      superAdminOnly: false,
      supervisorOnly: false,
    },
  ];

  const links = allLinks.filter((link) => {
    if (link.superAdminOnly && !isSuperAdmin) return false;
    if (link.supervisorOnly && !isSupervisorOrAdmin) return false;
    return true;
  });

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isActive
                ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
