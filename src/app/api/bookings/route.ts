import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BookingCreationError,
  createBookingTransaction,
} from "./createBookingTransaction";
import { sendBookingCreatedEmails } from "@/lib/email/notifications";

const genderInputSchema = z.union([z.enum(["male", "female"]), z.literal("")]);

const bookingRequestSchema = z.object({
  selectedPackageIds: z.array(z.string().trim().min(1)).min(1).max(3),
  details: z.object({
    fullName: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.email(),
    notes: z.string(),
    healthNotes: z.string(),
    clientGender: genderInputSchema,
    numberOfPeople: z.coerce.number().int().min(1).max(10),
    participantGenders: z.array(genderInputSchema),
    consentAcknowledged: z.literal(true),
    postcode: z.string().trim().min(3),
    address: z.string().trim().min(5),
    city: z.string().trim().min(2),
    area: z.string().trim().min(2),
  }),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
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

  const parsed = bookingRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid booking request.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await createBookingTransaction(parsed.data, supabase);

    await sendBookingCreatedEmails(result.bookingId, supabase).catch((error) => {
      console.error("Unable to send booking creation emails.", error);
    });

    return NextResponse.json({
      status: "submitted",
      message: "Booking request submitted.",
      ...result,
    });
  } catch (error) {
    if (error instanceof BookingCreationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Unable to submit booking request." },
      { status: 500 }
    );
  }
}
