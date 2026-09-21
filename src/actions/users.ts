"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { can, isMainAdmin } from "@/lib/permissions";
import { createUserSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { generateSecurePassword } from "@/lib/utils";
import type { Profile, Role } from "@/types";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function mapProfile(row: {
  id: string;
  name: string;
  user_id: string;
  email: string | null;
  role: Role;
  status: Profile["status"];
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    name: row.name,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    status: row.status,
    forcePasswordChange: row.force_password_change,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUsers(): Promise<ActionResult<Profile[]>> {
  try {
    const user = await requireUser();
    if (!can(user, "users:manage") && !isMainAdmin(user)) {
      throw new Error("FORBIDDEN");
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { success: true, data: (data ?? []).map(mapProfile) };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to load users." };
  }
}

export async function createUserAction(
  raw: unknown
): Promise<ActionResult<{ profile: Profile; temporaryPassword: string }>> {
  try {
    const actor = await requireUser();
    if (!can(actor, "users:manage")) throw new Error("FORBIDDEN");

    const parsed = createUserSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const values = parsed.data;

    if (values.role === "MAIN_ADMIN" && !isMainAdmin(actor)) {
      return { success: false, error: "Only Main Admin can create Main Admin accounts." };
    }

    const email = values.email || `${values.userId}@institution.local`;
    const admin = createServiceClient();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: values.password,
      email_confirm: true,
      user_metadata: {
        name: values.name,
        user_id: values.userId,
        role: values.role,
        force_password_change: true,
      },
    });
    if (authError || !authData.user) {
      console.error(authError);
      return { success: false, error: authError?.message ?? "Failed to create user." };
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        name: values.name,
        user_id: values.userId,
        email,
        role: values.role,
        status: values.status,
        force_password_change: true,
      })
      .select("*")
      .single();

    if (profileError) throw profileError;

    await writeAuditLog({
      userId: actor.id,
      action: "created user",
      entityType: "user",
      entityId: profile.id,
      newData: { userId: values.userId, role: values.role },
    });

    revalidatePath("/users");
    revalidatePath("/admin");
    return {
      success: true,
      data: {
        profile: mapProfile(profile),
        temporaryPassword: values.password,
      },
    };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to create user." };
  }
}

export async function generatePasswordAction(): Promise<ActionResult<{ password: string }>> {
  try {
    await requireUser();
    return { success: true, data: { password: generateSecurePassword() } };
  } catch {
    return { success: false, error: "Unauthorized" };
  }
}

async function countMainAdmins(): Promise<number> {
  const admin = createServiceClient();
  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "MAIN_ADMIN")
    .eq("status", "ACTIVE");
  return count ?? 0;
}

export async function updateUserRole(
  profileId: string,
  role: Role
): Promise<ActionResult<Profile>> {
  try {
    const actor = await requireUser();
    if (!isMainAdmin(actor)) throw new Error("FORBIDDEN");

    const admin = createServiceClient();
    const { data: target } = await admin.from("profiles").select("*").eq("id", profileId).single();
    if (!target) return { success: false, error: "User not found." };

    if (target.role === "MAIN_ADMIN" && role !== "MAIN_ADMIN") {
      const mains = await countMainAdmins();
      if (mains <= 1) {
        return { success: false, error: "Cannot demote the final Main Admin." };
      }
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", profileId)
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      userId: actor.id,
      action: "changed role",
      entityType: "user",
      entityId: profileId,
      oldData: { role: target.role },
      newData: { role },
    });

    revalidatePath("/users");
    return { success: true, data: mapProfile(data) };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to change role." };
  }
}

export async function setUserStatus(
  profileId: string,
  status: Profile["status"]
): Promise<ActionResult<Profile>> {
  try {
    const actor = await requireUser();
    if (!can(actor, "users:manage")) throw new Error("FORBIDDEN");

    const admin = createServiceClient();
    const { data: target } = await admin.from("profiles").select("*").eq("id", profileId).single();
    if (!target) return { success: false, error: "User not found." };

    if (target.role === "MAIN_ADMIN" && status === "DISABLED") {
      const mains = await countMainAdmins();
      if (mains <= 1) {
        return { success: false, error: "Cannot disable the final Main Admin." };
      }
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ status })
      .eq("id", profileId)
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      userId: actor.id,
      action: status === "DISABLED" ? "disabled user" : "enabled user",
      entityType: "user",
      entityId: profileId,
    });

    revalidatePath("/users");
    return { success: true, data: mapProfile(data) };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to update user status." };
  }
}

export async function resetUserPassword(
  profileId: string,
  newPassword?: string
): Promise<ActionResult<{ temporaryPassword: string }>> {
  try {
    const actor = await requireUser();
    if (!can(actor, "users:manage")) throw new Error("FORBIDDEN");

    const password = newPassword || generateSecurePassword();
    const admin = createServiceClient();
    const { error } = await admin.auth.admin.updateUserById(profileId, {
      password,
    });
    if (error) throw error;

    await admin
      .from("profiles")
      .update({ force_password_change: true })
      .eq("id", profileId);

    await writeAuditLog({
      userId: actor.id,
      action: "reset password",
      entityType: "user",
      entityId: profileId,
    });

    return { success: true, data: { temporaryPassword: password } };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to reset password." };
  }
}

export async function deleteUserAction(profileId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireUser();
    if (!isMainAdmin(actor)) throw new Error("FORBIDDEN");
    if (actor.id === profileId) {
      return { success: false, error: "You cannot delete your own account." };
    }

    const admin = createServiceClient();
    const { data: target } = await admin.from("profiles").select("*").eq("id", profileId).single();
    if (!target) return { success: false, error: "User not found." };

    if (target.role === "MAIN_ADMIN") {
      const mains = await countMainAdmins();
      if (mains <= 1) {
        return { success: false, error: "Cannot delete the final Main Admin." };
      }
    }

    const { error } = await admin.auth.admin.deleteUser(profileId);
    if (error) throw error;

    await writeAuditLog({
      userId: actor.id,
      action: "deleted user",
      entityType: "user",
      entityId: profileId,
      oldData: { userId: target.user_id, role: target.role },
    });

    revalidatePath("/users");
    return { success: true, data: { id: profileId } };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to delete user." };
  }
}
