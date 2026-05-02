import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { calculateAvailableSlots } from "@/lib/booking/availability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const availabilityRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceIds: z.array(z.string().trim().min(1)).min(1).max(3),
  participantGenders: z.array(z.enum(["male", "female"])).min(1).max(10),
  city: z.string().trim().min(2),
});

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
