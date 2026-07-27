import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { calculateAvailableDays } from "@/lib/booking/availability";
import {
  AVAILABILITY_RATE_LIMIT,
  RATE_LIMITED_AVAILABILITY_MESSAGE,
  checkRateLimit,
} from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const monthAvailabilityRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  serviceIds: z.array(z.string().trim().min(1)).min(1).max(3),
  participantGenders: z.array(z.enum(["male", "female"])).min(1).max(10),
  city: z.string().trim().min(2),
});

function datesOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

export async function POST(request: Request) {
  // C-22 Step 4a (D23): a month sweep costs ~30 day calculations on the
  // service-role client, so the same per-IP limiter guards it. Its own counter
  // scope, so calendar browsing never eats the day endpoint's budget.
  if (
    !(await checkRateLimit(request, "availability-month", AVAILABILITY_RATE_LIMIT))
  ) {
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
  const supabase = createSupabaseAdminClient();
  const result = await calculateAvailableDays(
    { dates: datesOfMonth(month), serviceIds, participantGenders, city },
    supabase
  );

  return NextResponse.json({ month, ...result });
}
