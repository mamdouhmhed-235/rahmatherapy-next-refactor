import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Use only inside "use client" components.
 * Uses the anon key — RLS is enforced by Supabase.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
