import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { calculateAvailableSlots } from "@/lib/booking/availability";
import {
  AVAILABILITY_RATE_LIMIT,
  RATE_LIMITED_AVAILABILITY_MESSAGE,
  checkRateLimit,
} from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const availabilityRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceIds: z.array(z.string().trim().min(1)).min(1).max(3),
  participantGenders: z.array(z.enum(["male", "female"])).min(1).max(10),
  city: z.string().trim().min(2),
});

export async function POST(request: Request) {
  // C-22 Step 4a (D23): public, unauthenticated, service-role read endpoint —
  // same per-IP limiter as the booking POST, at far higher thresholds because
  // the booking dialog calls this per day-pick.
  if (!(await checkRateLimit(request, "availability", AVAILABILITY_RATE_LIMIT))) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMITED_AVAILABILITY_MESSAGE },
      { status: 429 }
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

  const parsed = availabilityRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid availability request.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const result = await calculateAvailableSlots(parsed.data, supabase);

  return NextResponse.json(result);
}
