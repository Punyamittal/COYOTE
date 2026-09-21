import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can, isMainAdmin } from "@/lib/permissions";
import { listUsers } from "@/actions/users";
import { UsersTable } from "@/components/users/users-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user, "users:manage") && !isMainAdmin(user)) {
    redirect("/dashboard");
  }

  const result = await listUsers();
  const users = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Users</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Create accounts, manage roles and status, and reset passwords.
        </p>
      </div>

      {!result.success ? (
        <Card>
          <CardContent className="py-8 text-center text-[var(--muted-foreground)]">
            {result.error}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <UsersTable initialUsers={users} canManageRoles={isMainAdmin(user)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
