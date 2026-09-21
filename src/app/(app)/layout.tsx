import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { ChangePasswordGate } from "@/components/auth/change-password-gate";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/login");

  return (
    <AppShell user={user}>
      {user.forcePasswordChange ? <ChangePasswordGate /> : children}
    </AppShell>
  );
}
