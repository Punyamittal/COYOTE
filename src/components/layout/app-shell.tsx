"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Table2,
  CalendarPlus,
  Users,
  FileBarChart,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/auth";
import type { SessionUser } from "@/types";
import { can, isAdminOrAbove, isMainAdmin } from "@/lib/permissions";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, show: () => true },
  { href: "/timetable", label: "Timetable", icon: Table2, show: () => true },
  { href: "/events", label: "Events", icon: CalendarPlus, show: () => true },
  {
    href: "/users",
    label: "Users",
    icon: Users,
    show: (u: SessionUser) => can(u, "users:manage"),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileBarChart,
    show: (u: SessionUser) => can(u, "reports:read"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    show: () => true,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    show: (u: SessionUser) => isAdminOrAbove(u),
  },
];

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = nav.filter((n) => n.show(user));

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[var(--background)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-dvh w-64 flex-col bg-[var(--background)] transition-transform lg:static lg:h-full lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="glass-strong m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] p-3">
          <div className="mb-4 flex items-center justify-between px-2 pt-2">
            <Link href="/dashboard" className="text-lg font-extrabold tracking-tight">
              Schedule<span className="text-[#3B82F6]">Hub</span>
            </Link>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto scrollbar-none">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all",
                    active
                      ? "glass-inset text-[var(--primary)]"
                      : "text-[var(--muted-foreground)] hover:bg-white/25 hover:text-[var(--foreground)]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl",
                      active ? "bg-white/50" : "neu-raised-sm"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="glass-inset mt-3 rounded-2xl p-3">
            <div className="mb-2 truncate text-xs font-semibold">
              {user.name}
              <div className="font-medium text-[var(--muted-foreground)]">
                {user.role.replace("_", " ")}
              </div>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" size="sm" className="w-full justify-start">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-[#1e2f4d]/25 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass z-20 mx-3 mt-3 flex h-14 shrink-0 items-center gap-3 rounded-2xl px-4 print:hidden">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 text-sm font-medium text-[var(--muted-foreground)]">
            Event & Activity Scheduling
          </div>
          {can(user, "events:create") && (
            <Button asChild size="sm" variant="accent">
              <Link href="/events/new">
                <Plus className="h-4 w-4" />
                Add Event
              </Link>
            </Button>
          )}
          {isMainAdmin(user) && (
            <span className="hidden rounded-full neu-inset px-3 py-1 text-xs font-bold text-[var(--primary)] sm:inline">
              Main Admin
            </span>
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-none md:p-6">{children}</main>
      </div>
    </div>
  );
}
