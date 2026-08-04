// C-23 Phase B, Step 4 — the admin month-availability endpoint.
//
// Same engine as the public month route, different policy. The public route
// inherits two customer-facing guards from calculateAvailableDays that are
// wrong for staff (brief §3):
//   - booking_status_enabled — with public booking paused the admin calendar
//     would show a blank month while therapists are demonstrably free;
//   - the customer booking window — beyond it staff legitimately take
//     bookings, and the engine would report hasSlots: false for genuinely
//     open days.
// Both are lifted here via the additive options bag (Step 3), so there is one
// engine and two policies rather than a duplicated availability calculation.
//
// DELIBERATELY NOT RATE-LIMITED. C-22 (D23) added checkRateLimit to the
// PUBLIC /api/availability and /api/availability/month routes because they are
// unauthenticated and run on the service-role client — anyone on the internet
// can spend ~30 day-calculations per request there. This route is behind a
// staff session and a manage_bookings_all check before it ever reaches the
// admin client, so it is not in that limiter's threat model and the C-23 plan
// states it is not covered by it. Please do not "fix" this by adding the
// public limiter: it would throttle staff browsing months on
// /admin/bookings/new against a budget sized for anonymous traffic.

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { canManageAllBookings, getStaffProfile } from "@/lib/auth/rbac";
import { calculateAvailableDays } from "@/lib/booking/availability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Mirrors src/app/api/availability/month/route.ts's schema exactly — the admin
// calendar sends the same payload as the public one; only the policy differs.
const monthAvailabilityRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  serviceIds: z.array(z.string().trim().min(1)).min(1).max(3),
  participantGenders: z.array(z.enum(["male", "female"])).min(1).max(10),
  city: z.string().trim().min(2),
});

// Kept local rather than shared with the public route: exporting a non-handler
// symbol from a Next route module to save eight lines of date arithmetic would
// mean editing a live customer-facing file for no behavioural reason.
function datesOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

export async function POST(request: Request) {
  // Session first, service-role client only after the permission check passes.
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile) {
    return NextResponse.json(
      { error: "Not signed in." },
      { status: 401 }
    );
  }

  // Mirrors the gate on /admin/bookings/new itself (page.tsx uses
  // canManageAllBookings): whoever can open the create-booking form can read
  // this calendar, and nobody else.
  if (!profile.active || !canManageAllBookings(profile)) {
    return NextResponse.json(
      { error: "You don't have access to admin availability." },
      { status: 403 }
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = monthAvailabilityRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid availability request.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    );
  }

  const { month, serviceIds, participantGenders, city } = parsed.data;
  const adminClient = createSupabaseAdminClient();
  const result = await calculateAvailableDays(
    { dates: datesOfMonth(month), serviceIds, participantGenders, city },
    adminClient,
    { ignoreBookingWindow: true, ignorePublicPause: true }
  );

  return NextResponse.json({ month, ...result });
}
