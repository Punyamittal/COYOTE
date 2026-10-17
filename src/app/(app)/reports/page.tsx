import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can, isAdminOrAbove, isMainAdmin } from "@/lib/permissions";
import { OdExportButton } from "@/components/reports/od-export-button";
import { OdReviewPanel } from "@/components/reports/od-review-panel";
import { ReportsPanel } from "@/components/reports/reports-panel";

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user, "reports:read")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Reports</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Daily, range, location, person, and time-slot utilization reports. Export builds a CSV
            download in the browser.
          </p>
        </div>
        {isAdminOrAbove(user) ? <OdExportButton /> : null}
      </div>
      {isMainAdmin(user) ? <OdReviewPanel /> : null}
      <ReportsPanel />
    </div>
  );
}
