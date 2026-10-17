import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { MyOdPanel } from "@/components/od/my-od-panel";

export default async function MyOdPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">My OD</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          How many OD you applied for, including calendar events, and how many were approved or
          rejected.
        </p>
      </div>
      <MyOdPanel />
    </div>
  );
}
