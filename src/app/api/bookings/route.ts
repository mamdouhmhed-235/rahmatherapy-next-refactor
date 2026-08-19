import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  FREE_TEXT_MAX,
  NAME_MAX,
  SHORT_TEXT_MAX,
} from "@/features/booking/schemas/booking-schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BookingCreationError,
  createBookingTransaction,
} from "./createBookingTransaction";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { sendBookingCreatedEmails } from "@/lib/email/notifications";
import { recordOperationalEvent } from "@/lib/ops/operational-events";
import {
  BOOKING_RATE_LIMIT,
  RATE_LIMITED_BOOKING_MESSAGE,
  checkRateLimit,
} from "@/lib/rate-limit";

// F5 (2026-08-17): hard ceiling on the request body, enforced before parsing.
// 256 KB — orders of magnitude above any legitimate booking, so it can only
// ever be hit by abuse.
const MAX_BOOKING_BODY_BYTES = 256 * 1024;

const genderInputSchema = z.union([z.enum(["male", "female"]), z.literal("")]);

const bookingRequestSchema = z.object({
  selectedPackageIds: z.array(z.string().trim().min(1)).min(1).max(3),
  details: z.object({
    bookingFor: z.enum(["self", "someone_else", "group"]),
    fullName: z.string().trim().min(1).max(NAME_MAX),
    phone: z.string().trim().min(1),
    email: z.email(),
    // D1 (2026-08-17): THIS is the schema a direct POST is validated against.
    // booking-schema.ts is client-only and imported by no server module, so
    // capping it alone left the actual attack surface unbounded.
    notes: z.string().max(FREE_TEXT_MAX),
    healthNotes: z.string().max(FREE_TEXT_MAX),
    clientGender: genderInputSchema,
    numberOfPeople: z.coerce.number().int().min(1).max(10),
    participantGenders: z.array(genderInputSchema),
    participantNames: z.array(z.string().max(NAME_MAX)),
    participantNotes: z.array(z.string().max(FREE_TEXT_MAX)),
    consentAcknowledged: z.literal(true),
    paymentAcknowledged: z.literal(true),
    manageAcknowledged: z.literal(true),
    postcode: z.string().trim().min(3).max(SHORT_TEXT_MAX),
    address: z.string().trim().min(5).max(SHORT_TEXT_MAX),
    city: z.string().trim().min(2).max(SHORT_TEXT_MAX),
    area: z.string().trim().min(2).max(SHORT_TEXT_MAX),
    accessNotes: z.string().max(FREE_TEXT_MAX),
    parkingNotes: z.string().max(FREE_TEXT_MAX),
  }),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export async function POST(request: Request) {
  // C-22: per-IP rate limit, before the body is even parsed — no Supabase
  // client, no RPC and no email work happens for a rejected attempt. Fails
  // open without CF-Connecting-IP or the Durable Object binding.
  if (!(await checkRateLimit(request, "bookings", BOOKING_RATE_LIMIT))) {
    return NextResponse.json(
      { ok: false, error: RATE_LIMITED_BOOKING_MESSAGE },
      { status: 429 }
    );
  }

  // F5 (2026-08-17): reject an oversized body before it reaches the JSON parser
  // or the database.
  //
  // ⛔ D2 (2026-08-17): the first version of this trusted `content-length`. That
  // was fail-OPEN and trivially bypassed — an absent header (chunked or HTTP/2)
  // read as 0 and passed, a garbage header gave NaN and passed, and a hostile
  // client could simply lie. It stopped only honest oversized bodies, which is
  // the exact opposite of the point.
  //
  // Measure the body we actually received instead. 256 KB is orders of magnitude
  // above any legitimate booking (a full group with notes is well under 10 KB),
  // so this can only ever be reached by abuse.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Byte length, not string length — a multi-byte character counts once as a
  // JS char but can be four bytes on the wire.
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BOOKING_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large." },
      { status: 413 }
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  // C-22: honeypot. A filled decoy means a bot. Return a success-shaped
  // response so the operator learns nothing, but do no work: no booking,
  // no emails. `company_website` is deliberately absent from the schema
  // below, so a filled value can never reach the RPC either.
  const rawPayload = payload as Record<string, unknown> | null;
  if (
    typeof rawPayload?.company_website === "string" &&
    rawPayload.company_website.trim() !== ""
  ) {
    console.warn("[C-22] honeypot tripped", { at: new Date().toISOString() });
    return NextResponse.json({
      status: "submitted",
      message: "Booking request submitted.",
      bookingId: crypto.randomUUID(),
      participantCount: 1,
      itemCount: 1,
      assignmentCount: 1,
      manageUrl: null,
    });
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
