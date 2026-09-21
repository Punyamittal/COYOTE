import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can, isAdminOrAbove, isMainAdmin, DEFAULT_PERMISSIONS } from "@/lib/permissions";
import {
  getSettings,
  listAuditLogs,
  listCategories,
  listLocations,
  listTimeSlots,
} from "@/actions/admin";
import { LocationsManager } from "@/components/admin/locations-manager";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { SystemSettingsForm } from "@/components/admin/system-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_TIME_SLOTS } from "@/lib/time-slots";
import type { Role } from "@/types";
import { CalendarPlus, Users } from "lucide-react";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdminOrAbove(user)) redirect("/dashboard");

  const mainAdmin = isMainAdmin(user);

  const [locationsRes, categoriesRes, settingsRes, slotsRes, auditRes] = await Promise.all([
    can(user, "locations:manage") ? listLocations() : Promise.resolve(null),
    can(user, "categories:manage") ? listCategories() : Promise.resolve(null),
    mainAdmin ? getSettings() : Promise.resolve(null),
    listTimeSlots(),
    mainAdmin || can(user, "audit:read") ? listAuditLogs(80) : Promise.resolve(null),
  ]);

  const timeSlots = slotsRes.success ? slotsRes.data : DEFAULT_TIME_SLOTS.map((s) => ({ ...s, active: true }));
  const fromDb = slotsRes.success && slotsRes.data.some((s) => s.id === "morning-1");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">
          Admin Control Center
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Configure users, venues, categories, permissions, and system settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </CardTitle>
            <CardDescription>Create accounts and manage roles.</CardDescription>
          </CardHeader>
          <CardContent>
            {can(user, "users:manage") ? (
              <Button asChild>
                <Link href="/users">Open user management</Link>
              </Button>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                Only Main Admin can manage users.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              Events
            </CardTitle>
            <CardDescription>
              Create and edit events. Bulk import/export is available from the events and Excel
              tools when you have import/export permission.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/events">Open events</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/events/new">Add event</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Slots</CardTitle>
          <CardDescription>
            Institutional periods used for classification and timetable columns.
            {fromDb
              ? " Loaded from the database (seeded from DEFAULT_TIME_SLOTS)."
              : " Showing DEFAULT_TIME_SLOTS fallback — seed the time_slots table for DB-backed config."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {timeSlots
              .filter((s) => !s.category.startsWith("HALF") && s.category !== "FULL_DAY")
              .map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span>{slot.label}</span>
                  <Badge variant="outline">{slot.category}</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {can(user, "locations:manage") && locationsRes?.success && (
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationsManager initialLocations={locationsRes.data} />
          </CardContent>
        </Card>
      )}

      {can(user, "categories:manage") && categoriesRes?.success && (
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoriesManager initialCategories={categoriesRes.data} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>
            Default role permissions (DEFAULT_PERMISSIONS). Database overrides are reserved for
            future use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            {(Object.keys(DEFAULT_PERMISSIONS) as Role[]).map((role) => (
              <div key={role} className="rounded-md border border-[var(--border)] p-3">
                <h3 className="mb-2 text-sm font-semibold">{role.replace("_", " ")}</h3>
                <ul className="space-y-1">
                  {DEFAULT_PERMISSIONS[role].map((p) => (
                    <li key={p} className="font-mono text-xs text-[var(--muted-foreground)]">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {mainAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Institution branding and calendar defaults.</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsRes?.success ? (
              <SystemSettingsForm initial={settingsRes.data} />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                {settingsRes && !settingsRes.success
                  ? settingsRes.error
                  : "Unable to load settings."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(mainAdmin || can(user, "audit:read")) && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>Recent administrative and auth activity.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditRes?.success ? (
              <AuditLogTable logs={auditRes.data} />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                {auditRes && !auditRes.success ? auditRes.error : "Unable to load audit logs."}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
