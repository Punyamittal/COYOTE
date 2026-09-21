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
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-[var(--border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Schedule<span className="text-[var(--accent)]">Hub</span>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3">
          <div className="mb-2 truncate px-2 text-xs text-white/60">
            {user.name}
            <div className="text-white/40">{user.role.replace("_", " ")}</div>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-white/70 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)]/90 px-4 backdrop-blur print:hidden">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 text-sm text-[var(--muted-foreground)]">
            Event & Activity Scheduling
          </div>
          {can(user, "events:create") && (
            <Button asChild size="sm">
              <Link href="/events/new">
                <Plus className="h-4 w-4" />
                Add Event
              </Link>
            </Button>
          )}
          {isMainAdmin(user) && (
            <span className="hidden rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 sm:inline">
              Main Admin
            </span>
          )}
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
