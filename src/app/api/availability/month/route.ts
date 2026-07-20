import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { calculateAvailableDays } from "@/lib/booking/availability";
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
