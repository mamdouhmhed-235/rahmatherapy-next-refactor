import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-only Supabase client.
 * Safe for Server Components, Server Actions, and Route Handlers.
 * Uses the anon key — RLS is enforced by Supabase.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
