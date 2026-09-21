import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isMainAdmin } from "@/lib/permissions";
import { getSettings } from "@/actions/admin";
import { SystemSettingsForm } from "@/components/admin/system-settings-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const mainAdmin = isMainAdmin(user);
  const settingsRes = mainAdmin ? await getSettings() : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Account security
          {mainAdmin ? " and institution configuration" : ""}.
        </p>
      </div>

      {mainAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Institution settings</CardTitle>
            <CardDescription>
              Visible only to Main Admin. Changes apply across ScheduleHub.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settingsRes?.success ? (
              <SystemSettingsForm initial={settingsRes.data} />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                {settingsRes && !settingsRes.success
                  ? settingsRes.error
                  : "Unable to load institution settings."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Update the password for your signed-in account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
