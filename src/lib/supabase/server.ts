import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env/server";

/**
 * Server-only Supabase client.
 * Safe for Server Components, Server Actions, and Route Handlers.
 * Uses the anon key — RLS is enforced by Supabase.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check server runtime environment variables."
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll called from a Server Component — cookies cannot be set.
            // Middleware handles session refresh; this is expected.
          }
        },
      },
    }
  );
}
