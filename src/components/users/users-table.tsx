"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createUserAction,
  deleteUserAction,
  generatePasswordAction,
  resetUserPassword,
  setUserStatus,
  updateUserRole,
} from "@/actions/users";
import type { Profile, Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateIST } from "@/lib/utils";
import { Copy, KeyRound, Plus, RefreshCw, Trash2, UserCog } from "lucide-react";

const ROLES: Role[] = ["USER", "ADMIN", "MAIN_ADMIN"];

function statusVariant(status: Profile["status"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "DISABLED") return "destructive" as const;
  return "warning" as const;
}

export function UsersTable({
  initialUsers,
  canManageRoles = false,
}: {
  initialUsers: Profile[];
  canManageRoles?: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [credentials, setCredentials] = useState<{
    userId: string;
    password: string;
    name: string;
  } | null>(null);

  const [editRoleUser, setEditRoleUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<Role>("USER");
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);

  const [form, setForm] = useState({
    name: "",
    userId: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "USER" as Role,
    status: "ACTIVE" as Profile["status"],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  function resetCreateForm() {
    setForm({
      name: "",
      userId: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "USER",
      status: "ACTIVE",
    });
  }

  function generatePassword() {
    startTransition(async () => {
      const res = await generatePasswordAction();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setForm((f) => ({
        ...f,
        password: res.data.password,
        confirmPassword: res.data.password,
      }));
      toast.success("Secure password generated");
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createUserAction(form);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setUsers((prev) => [res.data.profile, ...prev]);
      setCreateOpen(false);
      setCredentials({
        userId: res.data.profile.userId,
        password: res.data.temporaryPassword,
        name: res.data.profile.name,
      });
      resetCreateForm();
      toast.success("User created");
    });
  }

  function onUpdateRole() {
    if (!editRoleUser) return;
    startTransition(async () => {
      const res = await updateUserRole(editRoleUser.id, editRole);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === res.data.id ? res.data : u)));
      setEditRoleUser(null);
      toast.success("Role updated");
    });
  }

  function onToggleStatus(user: Profile) {
    const next = user.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    startTransition(async () => {
      const res = await setUserStatus(user.id, next);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === res.data.id ? res.data : u)));
      toast.success(next === "DISABLED" ? "User disabled" : "User enabled");
    });
  }

  function onResetPassword(user: Profile) {
    startTransition(async () => {
      const res = await resetUserPassword(user.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCredentials({
        userId: user.userId,
        password: res.data.temporaryPassword,
        name: user.name,
      });
      toast.success("Password reset");
    });
  }

  function onDelete() {
    if (!deleteUser) return;
    startTransition(async () => {
      const res = await deleteUserAction(deleteUser.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setDeleteUser(null);
      toast.success("User deleted");
    });
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Unable to copy");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--muted)]/40">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">User ID</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2 font-medium">{user.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{user.userId}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{user.role.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    {formatDateIST(user.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {canManageRoles && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            setEditRoleUser(user);
                            setEditRole(user.role);
                          }}
                        >
                          <UserCog className="h-3.5 w-3.5" />
                          Edit role
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => onResetPassword(user)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Reset Password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => onToggleStatus(user)}
                      >
                        {user.status === "DISABLED" ? "Enable" : "Disable"}
                      </Button>
                      {canManageRoles && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => setDeleteUser(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              New accounts must change their password on first login.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={generatePassword}
                  disabled={pending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate Secure Password
                </Button>
              </div>
              <Input
                id="password"
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="text"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(canManageRoles ? ROLES : (["USER", "ADMIN"] as Role[])).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as Profile["status"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="DISABLED">DISABLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentials} onOpenChange={(o) => !o && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share credentials</DialogTitle>
            <DialogDescription>
              Copy these details and share them securely with {credentials?.name}.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3 font-mono text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>User ID: {credentials.userId}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText("User ID", credentials.userId)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span>Password: {credentials.password}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText("Password", credentials.password)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() =>
                  copyText(
                    "Credentials",
                    `User ID: ${credentials.userId}\nPassword: ${credentials.password}`
                  )
                }
              >
                <Copy className="h-4 w-4" />
                Copy both
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRoleUser} onOpenChange={(o) => !o && setEditRoleUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>
              Change role for {editRoleUser?.name} ({editRoleUser?.userId}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditRoleUser(null)}>
                Cancel
              </Button>
              <Button onClick={onUpdateRole} disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {deleteUser?.name} ({deleteUser?.userId}) and cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--destructive)] text-white hover:opacity-90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
