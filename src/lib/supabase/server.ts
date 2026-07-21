import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Single-tenant app — no user auth/session, so there's no cookie-based
 * server client to distinguish from the browser one. Kept as its own
 * (async-shaped) export so server call sites don't need to change.
 */
export async function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
