import type { PermissionKey, Role, SessionUser } from "@/types";

export const DEFAULT_PERMISSIONS: Record<Role, PermissionKey[]> = {
  MAIN_ADMIN: [
    "events:create",
    "events:read",
    "events:update",
    "events:delete",
    "events:update_own",
    "events:delete_own",
    "events:export",
    "events:import",
    "events:bulk",
    "users:manage",
    "settings:manage",
    "audit:read",
    "conflicts:override",
    "locations:manage",
    "categories:manage",
    "timeslots:manage",
    "reports:read",
  ],
  ADMIN: [
    "events:create",
    "events:read",
    "events:update",
    "events:delete",
    "events:update_own",
    "events:delete_own",
    "events:export",
    "events:import",
    "events:bulk",
    "conflicts:override",
    "locations:manage",
    "categories:manage",
    "reports:read",
  ],
  USER: [
    "events:create",
    "events:read",
    "events:update_own",
    "events:delete_own",
    "events:export",
    "reports:read",
  ],
};

export function roleHasPermission(role: Role, permission: PermissionKey): boolean {
  return DEFAULT_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function can(user: SessionUser | null | undefined, permission: PermissionKey): boolean {
  if (!user || user.status !== "ACTIVE") return false;
  return roleHasPermission(user.role, permission);
}

export function canEditEvent(
  user: SessionUser | null | undefined,
  eventCreatedBy: string | null
): boolean {
  if (!user) return false;
  if (can(user, "events:update")) return true;
  if (can(user, "events:update_own") && eventCreatedBy === user.id) return true;
  return false;
}

export function canDeleteEvent(
  user: SessionUser | null | undefined,
  eventCreatedBy: string | null
): boolean {
  if (!user) return false;
  if (can(user, "events:delete")) return true;
  if (can(user, "events:delete_own") && eventCreatedBy === user.id) return true;
  return false;
}

export function isMainAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === "MAIN_ADMIN";
}

export function isAdminOrAbove(user: SessionUser | null | undefined): boolean {
  return user?.role === "MAIN_ADMIN" || user?.role === "ADMIN";
}
