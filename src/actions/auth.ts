"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { loginSchema, changePasswordSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { ViewerAccess } from "@/lib/access";

export type AuthResult = { success: true } | { success: false; error: string };

export type { ViewerAccess } from "@/lib/access";

export async function getViewerAccess(): Promise<ViewerAccess> {
  const user = await getSessionUser();
  return {
    canCreateEvents: can(user, "events:create"),
    canEditEvents: can(user, "events:update"),
    canDeleteEvents: can(user, "events:delete"),
    canImportEvents: can(user, "events:import"),
    canManageUsers: can(user, "users:manage"),
  };
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

export async function loginAction(raw: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const userId = parsed.data.userId.trim();
  const password = parsed.data.password;
  if (!checkRateLimit(userId.toLowerCase())) {
    return { success: false, error: "Too many login attempts. Try again later." };
  }

  try {
    const admin = createServiceClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, status, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      return {
        success: false,
        error: "Invalid username or password.",
      };
    }
    if (profile.status === "DISABLED") {
      return { success: false, error: "Your account has been disabled." };
    }

    const email = profile.email ?? `${profile.user_id}@local.invalid`;
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: "Invalid username or password." };
    }

    await writeAuditLog({
      userId: profile.id,
      action: "logged in",
      entityType: "auth",
      entityId: profile.id,
    });

    return { success: true };
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: message.includes("Supabase")
        ? message
        : `Unable to sign in: ${message}`,
    };
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePasswordAction(raw: unknown): Promise<AuthResult> {
  try {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });
    if (error) {
      return { success: false, error: "Unable to change password." };
    }

    await supabase
      .from("profiles")
      .update({ force_password_change: false })
      .eq("id", user.id);

    await writeAuditLog({
      userId: user.id,
      action: "changed password",
      entityType: "auth",
      entityId: user.id,
    });

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to change password." };
  }
}

/**
 * First-run setup: create MAIN_ADMIN from env vars if none exists.
 * Requires SUPABASE_SERVICE_ROLE_KEY and INITIAL_ADMIN_* env vars.
 */
export async function setupInitialAdmin(): Promise<AuthResult & { userId?: string }> {
  try {
    const adminUser = process.env.INITIAL_ADMIN_USER;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const adminEmail =
      process.env.INITIAL_ADMIN_EMAIL ||
      (adminUser ? `${adminUser}@institution.local` : undefined);

    if (!adminUser || !adminPassword || !adminEmail) {
      return {
        success: false,
        error: "Set INITIAL_ADMIN_USER, INITIAL_ADMIN_PASSWORD (and optionally INITIAL_ADMIN_EMAIL).",
      };
    }

    const admin = createServiceClient();

    const { data: existingLogin } = await admin
      .from("profiles")
      .select("id, user_id")
      .eq("user_id", adminUser)
      .maybeSingle();

    if (existingLogin) {
      return {
        success: false,
        error: `Account "${adminUser}" already exists. Use the password from INITIAL_ADMIN_PASSWORD in .env.local, or run npm run ensure-admin.`,
      };
    }

    const { data: authList, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) {
      return { success: false, error: `Could not reach Supabase Auth: ${listError.message}` };
    }

    let authUser = authList.users.find(
      (u) =>
        u.email?.toLowerCase() === adminEmail.toLowerCase() ||
        u.user_metadata?.user_id === adminUser
    );

    if (authUser) {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          name: "Main Admin",
          user_id: adminUser,
          role: "MAIN_ADMIN",
          force_password_change: true,
        },
      });
      if (updateError) {
        return { success: false, error: `Failed to update admin auth user: ${updateError.message}` };
      }
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          name: "Main Admin",
          user_id: adminUser,
          role: "MAIN_ADMIN",
          force_password_change: true,
        },
      });

      if (error || !data.user) {
        console.error(error);
        return {
          success: false,
          error: error?.message
            ? `Failed to create Main Admin: ${error.message}`
            : "Failed to create Main Admin.",
        };
      }
      authUser = data.user;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: authUser.id,
      name: "Main Admin",
      user_id: adminUser,
      email: adminEmail,
      role: "MAIN_ADMIN",
      status: "ACTIVE",
      force_password_change: true,
    });

    if (profileError) {
      console.error(profileError);
      return {
        success: false,
        error: `User created but profile failed: ${profileError.message}`,
      };
    }

    return { success: true, userId: adminUser };
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: `Setup failed: ${message}`,
    };
  }
}
