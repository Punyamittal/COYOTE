import { redirect } from "next/navigation";
import { loadOdReview } from "@/actions/od";
import { getSessionUser } from "@/lib/auth/session";
import { can, isAdminOrAbove, isMainAdmin } from "@/lib/permissions";
import { OdExportButton } from "@/components/reports/od-export-button";
import { OdReviewPanel } from "@/components/reports/od-review-panel";
import { ReportsPanel } from "@/components/reports/reports-panel";

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user, "reports:read")) redirect("/dashboard");
  const review = isMainAdmin(user) ? await loadOdReview() : null;

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
      {review ? (
        <OdReviewPanel
          requests={review.success ? review.data.requests : []}
          events={review.success ? review.data.events : []}
          loadError={review.success ? null : review.error}
        />
      ) : null}
      <ReportsPanel />
    </div>
  );
}
