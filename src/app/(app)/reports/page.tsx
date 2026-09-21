import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { ReportsPanel } from "@/components/reports/reports-panel";

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user, "reports:read")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Reports</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Daily, range, location, person, and time-slot utilization reports. Export builds a CSV
          download in the browser.
        </p>
      </div>
      <ReportsPanel />
    </div>
  );
}
