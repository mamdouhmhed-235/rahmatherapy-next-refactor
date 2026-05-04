import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BookingCreationError,
  createBookingTransaction,
} from "./createBookingTransaction";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { sendBookingCreatedEmails } from "@/lib/email/notifications";
import { recordOperationalEvent } from "@/lib/ops/operational-events";

const genderInputSchema = z.union([z.enum(["male", "female"]), z.literal("")]);

const bookingRequestSchema = z.object({
  selectedPackageIds: z.array(z.string().trim().min(1)).min(1).max(3),
  details: z.object({
    bookingFor: z.enum(["self", "someone_else", "group"]),
    fullName: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.email(),
    notes: z.string(),
    healthNotes: z.string(),
    clientGender: genderInputSchema,
    numberOfPeople: z.coerce.number().int().min(1).max(10),
    participantGenders: z.array(genderInputSchema),
    participantNames: z.array(z.string()),
    participantNotes: z.array(z.string()),
    consentAcknowledged: z.literal(true),
    paymentAcknowledged: z.literal(true),
    manageAcknowledged: z.literal(true),
    postcode: z.string().trim().min(3),
    address: z.string().trim().min(5),
    city: z.string().trim().min(2),
    area: z.string().trim().min(2),
    accessNotes: z.string(),
    parkingNotes: z.string(),
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
    let manageUrl: string | null = null;

    try {
      manageUrl = await ensureBookingManageUrl(
        {
          id: result.bookingId,
          booking_date: parsed.data.preferredDate,
        },
        supabase
      );
    } catch (error) {
      console.error("Unable to create booking manage link.", error);
    }

    const emailResult = await sendBookingCreatedEmails(result.bookingId, supabase, {
      manageUrl: manageUrl ?? undefined,
    }).catch((error) => {
      console.error("Unable to send booking creation emails.", error);
      return null;
    });

    return NextResponse.json({
      status: "submitted",
      message: "Booking request submitted.",
      ...result,
      manageUrl: manageUrl ?? emailResult?.manageUrl ?? null,
    });
  } catch (error) {
    const supabase = createSupabaseAdminClient();
    if (error instanceof BookingCreationError) {
      await recordOperationalEvent(supabase, {
        eventType: "failed_booking_creation",
        severity: error.status >= 500 ? "error" : "warning",
        summary: "Public booking creation failed validation or capacity checks.",
        safeContext: {
          status_code: error.status,
          error_class: "BookingCreationError",
        },
      }).catch(() => undefined);

      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    await recordOperationalEvent(supabase, {
      eventType: "failed_booking_creation",
      severity: "error",
      summary: "Public booking creation failed unexpectedly.",
      safeContext: {
        status_code: 500,
        error_class: error instanceof Error ? error.name : "UnknownError",
      },
    }).catch(() => undefined);

    return NextResponse.json(
      { error: "Unable to submit booking request." },
      { status: 500 }
    );
  }
}
