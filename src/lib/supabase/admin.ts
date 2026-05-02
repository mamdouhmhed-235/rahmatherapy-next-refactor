// SERVER ONLY — never import this in client components or expose to the browser.
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client.
 * Uses the service role key — bypasses RLS.
 * Restricted to trusted server-side operations only (Route Handlers, Server Actions).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check your .env.local file."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
