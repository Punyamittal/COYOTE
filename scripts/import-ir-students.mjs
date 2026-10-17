/**
 * Create Coyote USER accounts from the IR credentials workbook.
 * Login ID = registration number, role = USER, password from the sheet.
 *
 * Usage: node scripts/import-ir-students.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const text = readFileSync(join(root, ".env.local"), "utf8");
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

if (!url || !serviceKey) {
  console.error("Missing Supabase URL or service role key in .env.local");
  process.exit(1);
}

const workbook = XLSX.read(
  readFileSync(join(root, "IR Student List and Details 2026 - Login Credentials.xlsx"))
);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Credentials, { defval: "" });

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
    page += 1;
  }
  return users;
}

async function main() {
  const existing = await listAllUsers();
  const byEmail = new Map(existing.map((u) => [u.email?.toLowerCase(), u]));
  const byLogin = new Map(
    existing
      .filter((u) => u.user_metadata?.user_id)
      .map((u) => [String(u.user_metadata.user_id).toLowerCase(), u])
  );

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const userId = String(row["Login ID (username)"] || row["Registration Number"] || "").trim();
    const name = String(row.Name || "").trim();
    const password = String(row.Password || "");
    const email = String(row["VIT email ID"] || "").trim().toLowerCase();

    if (!userId || !name || !password || !email) {
      console.error("SKIP missing fields:", userId || name);
      failed += 1;
      continue;
    }

    const metadata = {
      name,
      user_id: userId,
      role: "USER",
      force_password_change: false,
    };

    let authUser = byEmail.get(email) ?? byLogin.get(userId.toLowerCase());

    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error || !data.user) {
        console.error("FAIL create", userId, error?.message ?? "unknown");
        failed += 1;
        continue;
      }
      authUser = data.user;
      created += 1;
      console.log("CREATED", userId, email);
    } else {
      const { error } = await admin.auth.admin.updateUserById(authUser.id, {
        email,
        password,
        email_confirm: true,
        user_metadata: { ...authUser.user_metadata, ...metadata },
      });
      if (error) {
        console.error("FAIL update", userId, error.message);
        failed += 1;
        continue;
      }
      updated += 1;
      console.log("UPDATED", userId, email);
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: authUser.id,
        name,
        user_id: userId,
        email,
        role: "USER",
        status: "ACTIVE",
        force_password_change: false,
      },
      { onConflict: "id" }
    );
    if (profileError) {
      console.error("FAIL profile", userId, profileError.message);
      failed += 1;
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} failed=${failed} total=${rows.length}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  const cause = err.cause ?? err;
  console.error(cause.message || err.message || err);
  if (cause.code === "ENOTFOUND") {
    console.error("Supabase hostname does not resolve. Check NEXT_PUBLIC_SUPABASE_URL in .env.local.");
  }
  process.exit(1);
});
