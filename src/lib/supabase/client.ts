import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient(options?: { persistSession?: boolean }) {
  const rememberSession = options?.persistSession ?? true;

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // SSR auth needs the session in cookies in both modes. The cookie
        // lifetime below controls whether it survives closing the browser.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      cookieOptions: rememberSession ? { maxAge: 60 * 60 * 24 * 30 } : {},
    },
  );
}
