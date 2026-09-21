import { createClient } from "@supabase/supabase-js";

/** Server-only admin client. Never import from client components. */
export function createServiceClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase service role configuration (set SUPABASE_SERVICE_ROLE_KEY in .env.local)"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
