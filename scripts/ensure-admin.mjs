/**
 * Creates or repairs the Main Admin from INITIAL_ADMIN_* in .env.local
 * (syncs auth password + profiles row).
 *
 * Usage: node scripts/ensure-admin.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function loadEnv() {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const adminUser = process.env.INITIAL_ADMIN_USER;
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
const adminEmail =
  process.env.INITIAL_ADMIN_EMAIL ||
  (adminUser ? `${adminUser}@institution.local` : undefined);

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!adminUser || !adminPassword || !adminEmail) {
  console.error("Set INITIAL_ADMIN_USER, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_EMAIL in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUser() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return (
    data.users.find(
      (u) =>
        u.email?.toLowerCase() === adminEmail.toLowerCase() ||
        u.user_metadata?.user_id === adminUser
    ) ?? null
  );
}

async function main() {
  console.log("Supabase:", url);
  console.log("Admin login id:", adminUser);
  console.log("Admin email:", adminEmail);

  let authUser = await findAuthUser();

  if (!authUser) {
    console.log("Creating auth user…");
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
    if (error) throw error;
    authUser = data.user;
    console.log("Created auth user:", authUser.id);
  } else {
    console.log("Updating auth user password…", authUser.id);
    const { error } = await admin.auth.admin.updateUserById(authUser.id, {
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        ...authUser.user_metadata,
        name: "Main Admin",
        user_id: adminUser,
        role: "MAIN_ADMIN",
        force_password_change: true,
      },
    });
    if (error) throw error;
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: authUser.id,
      name: "Main Admin",
      user_id: adminUser,
      email: adminEmail,
      role: "MAIN_ADMIN",
      status: "ACTIVE",
      force_password_change: true,
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error: signInError } = await anon.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (signInError) {
    console.error("Sign-in test failed:", signInError.message);
    process.exit(1);
  }

  console.log("\nDone. Sign in at /login with:");
  console.log("  Username:", adminUser);
  console.log("  Password:", adminPassword);
}

async function checkReachable() {
  const healthUrl = `${url.replace(/\/$/, "")}/auth/v1/health`;
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`Warning: health check returned ${res.status}`);
    }
  } catch (err) {
    const cause = err.cause ?? err;
    console.error("\nCannot reach Supabase at:", url);
    console.error("Network error:", cause.message || err.message);
    if (cause.code === "ENOTFOUND") {
      console.error(
        "\nDNS could not resolve the project hostname. In Supabase Dashboard → Project Settings → API,\n" +
          "copy the Project URL again and update NEXT_PUBLIC_SUPABASE_URL in .env.local.\n" +
          "The project may have been deleted, paused, or the URL may be mistyped."
      );
    }
    process.exit(1);
  }
}

checkReachable()
  .then(() => main())
  .catch((err) => {
    const cause = err.cause ?? err;
    console.error(cause.message || err.message || err);
    if (cause.code === "ENOTFOUND") {
      console.error(
        "\nFix: set the correct NEXT_PUBLIC_SUPABASE_URL in .env.local from your Supabase dashboard."
      );
    }
    process.exit(1);
  });
