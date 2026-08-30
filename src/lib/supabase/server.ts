import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";
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

  return createServerClient<Database>(
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
              // ⛔ supabase-ssr's DEFAULT_COOKIE_OPTIONS sets no `secure` flag
              // at all, so the session cookie was eligible to travel over plain
              // http — and the site answers http:// before redirecting, so an
              // old bookmark on cafe wi-fi could send it in the clear once.
              // Same expression the password-reset cookies already use
              // (src/app/admin/password-reset/actions.ts), so local http
              // development keeps working.
              // ⚠️ `httpOnly` is deliberately NOT forced on: supabase-ssr sets
              // it false by design because the browser client reads this cookie
              // to restore the session. Forcing it would break sign-in.
              cookieStore.set(name, value, {
                ...options,
                secure: process.env.NODE_ENV === "production",
              });
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
