import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { ChangePasswordGate } from "@/components/auth/change-password-gate";
import { ViewerAccessProvider } from "@/components/auth/viewer-access";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/login");

  return (
    <ViewerAccessProvider
      value={{
        canCreateEvents: can(user, "events:create"),
        canEditEvents: can(user, "events:update"),
        canDeleteEvents: can(user, "events:delete"),
        canImportEvents: can(user, "events:import"),
        canManageUsers: can(user, "users:manage"),
      }}
    >
      <AppShell user={user}>
        {user.forcePasswordChange ? <ChangePasswordGate /> : children}
      </AppShell>
    </ViewerAccessProvider>
  );
}
