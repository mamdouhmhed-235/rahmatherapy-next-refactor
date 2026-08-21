// SERVER ONLY — which services may currently be BOOKED (D-033, PR-011).
//
// ── The rule this exists to enforce ───────────────────────────────────────
//
// Owner ruling D-033, verbatim: *"if a service is hidden from the admin site
// then it shouldnt be bookable from the customer create booking page at all,
// its cards and info may still show on the frontend customer facing pages but
// not in the create booking page itself and it should not show nor be bookable.
// … should not be bookable in the admin pages create booking page either. once
// its hidden then it should stay actually hidden properly."*
//
// So `services.is_visible_on_frontend` now means **bookable**. The marketing
// pages (`/services`, `/services/[slug]`) deliberately keep rendering from
// `@/content/pages/packagePages` and are NOT filtered by this — a hidden
// service keeps its page and its Google ranking (the Owner chose that
// explicitly), it simply cannot be booked.
//
// ── Why this file had to exist at all ─────────────────────────────────────
//
// ⛔ The customer booking dialog's package list was a HARDCODED array in
// `src/features/booking/data/booking-packages.ts`, so "Hide from website" — a
// button reporting *"Hidden from the website."* — still OFFERED the service in
// the booking form. See FIND-03-B.
//
// ⚠️ CORRECTION after an independent audit: an earlier version of this comment
// added "and stayed bookable", which OVERSTATED it. `src/lib/booking/
// availability.ts` does read `services` on both flags, on the PUBLIC
// `/api/availability` path, so a hidden service already returned zero time
// slots and a customer could not complete a booking through the form. The real
// exposure was a direct `POST /api/bookings` (which never re-checks
// availability) and the recurring path, both closed in `da5f91e`.
//
// ── ⛔ WHICH WAY THIS FAILS, AND WHY ──────────────────────────────────────
//
// This read FAILS OPEN: on any error it returns `null`, and the caller shows
// the full package list exactly as before. That is deliberate. A transient
// database problem must not take the booking form down; and the UI list is
// cosmetic, not the guard.
//
// ⛔ THE GUARD IS SERVER-SIDE AND FAILS CLOSED — `assertServicesBookable`
// below, called from both booking entry points before anything is written. A
// direct POST that names a hidden slug is refused there, so the fail-open UI
// cannot be used to sneak a booking through.
//
// The cached UI read mirrors `booking-window-settings.ts` in shape and cache
// reasoning: `unstable_cache` forbids `cookies()`, so it runs on the admin
// client, and it exposes nothing an anonymous visitor cannot already infer from
// the public services pages. ⚠️ The GUARD does not build a client of its own —
// it uses the one the booking is being written with, passed in by the caller.

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";

interface ServiceSlugRow {
  slug: string;
}

/**
 * The slugs a customer or a member of staff may book right now.
 *
 * `null` means "could not be determined" — NOT "none". Callers rendering a UI
 * should fall back to showing everything; callers about to WRITE must refuse.
 */
export async function getBookableServiceSlugs(): Promise<string[] | null> {
  const cached = unstable_cache(
    async (): Promise<string[] | null> => {
      try {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin
          .from("services")
          .select("slug")
          .eq("is_active", true)
          .eq("is_visible_on_frontend", true)
          .returns<ServiceSlugRow[]>();

        // ⛔ An error and an empty table are NOT the same thing, and collapsing
        // them would be the difference between "show everything" and "show
        // nothing". Only a genuine failure returns null.
        if (error) return null;
        return (data ?? []).map((row) => row.slug);
      } catch {
        return null;
      }
    },
    ["bookable-service-slugs"],
    { revalidate: 60, tags: [TAGS.SERVICES] }
  );

  return cached();
}

/** Thrown when a booking names a service that may not be booked. */
export class ServiceNotBookableError extends Error {
  readonly slugs: string[];
  constructor(slugs: string[]) {
    super(
      slugs.length === 1
        ? "That service is not available to book."
        : "Those services are not available to book."
    );
    this.name = "ServiceNotBookableError";
    this.slugs = slugs;
  }
}

/**
 * ⛔ THE ACTUAL GUARD. Refuses if any requested slug is not bookable.
 *
 * ⛔ FAILS CLOSED, unlike the UI read above: it queries directly rather than
 * through the cached helper, so a stale 60-second cache entry can never let a
 * just-hidden service through, and a database failure raises rather than
 * silently permitting the write. A booking cannot succeed while the database
 * is unreachable anyway, so failing closed here costs nothing real.
 */
export async function assertServicesBookable(
  slugs: readonly string[],
  client: SupabaseClient
): Promise<void> {
  const requested = [...new Set(slugs.filter((slug) => slug.trim().length > 0))];
  if (requested.length === 0) return;

  // ⛔ Uses the SAME client the booking itself will be written with, rather
  // than building a second admin client of its own. A hidden dependency inside
  // a function that already receives a client is both worse design and
  // invisible to the callers' tests — which is exactly how a guard ends up
  // untested.
  const { data, error } = await client
    .from("services")
    .select("slug")
    .in("slug", requested)
    .eq("is_active", true)
    .eq("is_visible_on_frontend", true)
    .returns<ServiceSlugRow[]>();

  if (error) {
    throw new Error(`Could not verify service availability: ${error.message}`);
  }

  const bookable = new Set((data ?? []).map((row) => row.slug));
  const refused = requested.filter((slug) => !bookable.has(slug));
  if (refused.length > 0) throw new ServiceNotBookableError(refused);
}
