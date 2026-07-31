// SERVER ONLY - do not import from client components.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import {
  extractEmailAddress,
  getFromEmail,
  sendEmail,
} from "./client";
import {
  renderAdminBookingNotificationEmail,
  renderAdminBookingCancellationEmail,
  renderAdminRescheduleRequestEmail,
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderBookingConfirmedClientEmail,
  renderBookingConfirmedClientPlainText,
  renderBookingPlainText,
  renderBookingReminderEmail,
  renderBookingRestoredEmail,
  renderClaimNotificationEmail,
  renderClaimNotificationPlainText,
  renderClientAssignedTherapistEmail,
  renderClientAssignedTherapistPlainText,
  renderReviewRequestEmail,
  renderReviewRequestPlainText,
  renderStaffAssignmentEmail,
  renderStaffBookingChangeEmail,
  renderStaffUnassignmentEmail,
  renderStaffUnassignmentPlainText,
  pickReviewMessages,
  resolveTemplateOverrides,
  type BookingEmailTemplateInput,
  type EmailParticipant,
  type ReviewRequestEmailInput,
} from "./templates";
import { recordOperationalEvent } from "@/lib/ops/operational-events";

type ParticipantGender = "male" | "female";

interface BookingClient {
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface BookingParticipant {
  id: string;
  participant_gender: ParticipantGender;
  required_therapist_gender: ParticipantGender;
  is_main_contact: boolean;
  display_name: string | null;
}

interface BookingItem {
  id: string;
  booking_participant_id: string | null;
  service_name_snapshot: string;
  service_price_snapshot: number | string;
  service_duration_snapshot: number;
}

interface BookingAssignment {
  id: string;
  participant_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: ParticipantGender;
  status: string;
  staff_profiles: { name: string } | null;
}

interface AssignedStaffEmailRecord {
  assigned_staff_id: string | null;
  staff_profiles: { email: string | null } | null;
}

interface BookingEmailRecord {
  id: string;
  contact_full_name: string;
  contact_email: string;
  contact_phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number | string | null;
  group_booking: boolean;
  service_address_line1: string | null;
  service_address_line2: string | null;
  service_city: string | null;
  service_postcode: string | null;
  access_notes: string | null;
  customer_notes: string | null;
  clients: BookingClient | null;
  booking_participants: BookingParticipant[];
  booking_items: BookingItem[];
  booking_assignments: BookingAssignment[];
}

interface BusinessSettings {
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

const BOOKING_EMAIL_SELECT = `
  id,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_date,
  start_time,
  end_time,
  total_price,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  customer_notes,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, display_name),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

function getAddressLines(booking: BookingEmailRecord) {
  return [
    booking.service_address_line1,
    booking.service_address_line2,
    booking.service_city,
    booking.service_postcode,
    booking.access_notes ? `Access notes: ${booking.access_notes}` : null,
  ].filter((value): value is string => Boolean(value));
}

function getParticipantRows(booking: BookingEmailRecord): EmailParticipant[] {
  return booking.booking_participants.map((participant, index) => {
    const services = booking.booking_items
      .filter((item) => item.booking_participant_id === participant.id)
      .map((item) => item.service_name_snapshot);
    const assignment = booking.booking_assignments.find(
      (item) => item.participant_id === participant.id
    );

    return {
      label: participant.display_name
        ?? (participant.is_main_contact ? `Main contact` : `Participant ${index + 1}`),
      participantGender: participant.participant_gender,
      requiredTherapistGender: participant.required_therapist_gender,
      services,
      assignedStaffName: assignment?.staff_profiles?.name ?? null,
    };
  });
}

async function getBusinessSettings(
  supabase: SupabaseClient
): Promise<BusinessSettings> {
  const { data } = await supabase
    .from("business_settings")
    .select("company_name, contact_email, contact_phone")
    .eq("id", 1)
    .maybeSingle<BusinessSettings>();

  return {
    company_name: data?.company_name ?? "Rahma Therapy",
    contact_email: data?.contact_email ?? null,
    contact_phone: data?.contact_phone ?? null,
  };
}

async function getBookingEmailRecord(
  bookingId: string,
  supabase: SupabaseClient,
  { requireCustomerEmail = true }: { requireCustomerEmail?: boolean } = {}
) {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_EMAIL_SELECT)
    .eq("id", bookingId)
    .single<BookingEmailRecord>();

  if (error || !data) {
    throw new Error("Unable to load booking email context.");
  }

  // Since C-06, `bookings.contact_email` is nullable — an admin can book a
  // phone-only client. Callers that treat that as an expected state rather
  // than a failure opt out of this throw and skip the send themselves.
  if (requireCustomerEmail && !data.contact_email && !data.clients?.email) {
    throw new Error("Booking has no contact email address.");
  }

  return data;
}

async function getBookingTemplateInput(
  bookingId: string,
  supabase: SupabaseClient,
  options: {
    includeManageUrl?: boolean;
    manageUrl?: string;
    requireCustomerEmail?: boolean;
  } = {}
) {
  const [booking, settings] = await Promise.all([
    getBookingEmailRecord(bookingId, supabase, {
      requireCustomerEmail: options.requireCustomerEmail,
    }),
    getBusinessSettings(supabase),
  ]);
  const manageUrl = options.manageUrl
    ?? (options.includeManageUrl
      ? await ensureBookingManageUrl(booking, supabase)
      : undefined);

  const input: BookingEmailTemplateInput = {
    companyName: settings.company_name ?? "Rahma Therapy",
    clientName: booking.contact_full_name || booking.clients?.full_name || "Client",
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    addressLines: getAddressLines(booking),
    totalPrice: Number(booking.total_price ?? 0),
    participantCount: booking.booking_participants.length,
    participants: getParticipantRows(booking),
    manageUrl,
    customerNotes: booking.customer_notes,
    contactEmail: settings.contact_email,
    contactPhone: settings.contact_phone,
  };

  return { booking, settings, input };
}

function getAdminRecipient(settings: BusinessSettings) {
  return settings.contact_email ?? extractEmailAddress(getFromEmail());
}

function getProviderMessageId(data: unknown) {
  return typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string"
    ? data.id
    : null;
}

async function recordEmailDeliveryEvent(
  supabase: SupabaseClient,
  input: {
    bookingId: string;
    eventType: string;
    recipientEmail: string | null;
    recipientRole: string;
    deliveryStatus: "accepted" | "failed" | "skipped";
    staffId?: string | null;
    providerMessageId?: string | null;
    errorMessage?: string | null;
  }
) {
  await supabase.from("email_delivery_events").insert({
    booking_id: input.bookingId,
    staff_id: input.staffId ?? null,
    event_type: input.eventType,
    recipient_email: input.recipientEmail,
    recipient_role: input.recipientRole,
    delivery_status: input.deliveryStatus,
    provider_message_id: input.providerMessageId ?? null,
    error_message: input.errorMessage ?? null,
  });

  if (input.deliveryStatus === "failed") {
    await recordOperationalEvent(supabase, {
      eventType: "failed_email_send",
      severity: "error",
      summary: `Email ${input.eventType} failed for ${input.recipientRole}.`,
      bookingId: input.bookingId,
      staffId: input.staffId ?? null,
      safeContext: {
        event_type: input.eventType,
        recipient_role: input.recipientRole,
        delivery_status: input.deliveryStatus,
      },
    }).catch(() => undefined);
  }
}

async function sendTrackedEmail(
  supabase: SupabaseClient,
  input: {
    bookingId: string;
    eventType: string;
    recipientRole: string;
    staffId?: string | null;
    to: string | null;
    subject: string;
    html: string;
    text: string;
    /**
     * C-04a Change 13 — when > 0, nothing is sent now. The rendered email is
     * parked in `email_delivery_events` with `delivery_status = 'queued'` and a
     * `scheduled_for` this many seconds out, for the scheduled-emails cron to
     * pick up. That gap is what the admin's 10-second Undo lives in.
     */
    delaySeconds?: number;
  }
) {
  if (!input.to) {
    await recordEmailDeliveryEvent(supabase, {
      bookingId: input.bookingId,
      eventType: input.eventType,
      recipientEmail: null,
      recipientRole: input.recipientRole,
      deliveryStatus: "skipped",
      staffId: input.staffId ?? null,
      errorMessage: "Missing recipient email.",
    }).catch(() => undefined);
    return { status: "skipped" as const };
  }

  if (input.delaySeconds && input.delaySeconds > 0) {
    // The queued row IS the delivery event — the cron flips it to sent/failed
    // rather than writing a second one, so /admin/emails shows one row per
    // email either way. Unlike the immediate path below, a failure here is
    // thrown, not swallowed: a queue write that silently no-ops would drop the
    // customer's cancellation email entirely, with nothing left to retry from.
    const scheduledFor = new Date(
      Date.now() + Math.max(0, input.delaySeconds) * 1000
    ).toISOString();
    const { error } = await supabase.from("email_delivery_events").insert({
      booking_id: input.bookingId,
      event_type: input.eventType,
      recipient_email: input.to,
      recipient_role: input.recipientRole,
      staff_id: input.staffId ?? null,
      to_email: input.to,
      subject: input.subject,
      html_payload: input.html,
      text_payload: input.text,
      scheduled_for: scheduledFor,
      // Requires the extended delivery_status CHECK from C-04a's Phase F
      // migration; before that lands this insert is rejected by the database.
      delivery_status: "queued",
    });
    if (error) {
      const reason = `Failed to queue scheduled email: ${error.message}`;
      // Record before throwing. Every caller wraps this function in a bare
      // `.catch(console.error)`, so a rejected queue insert used to leave no
      // trace at all — no delivery-events row, no operational event, nothing on
      // /admin/emails, /admin/operations or the nav failure counter. Same
      // recorder and same shape as the immediate-send failure path below.
      //
      // Swallowed on its own account: the likeliest reason the queue insert
      // failed is that this very table is unreachable, in which case this write
      // fails too — and its error must not mask the original.
      await recordEmailDeliveryEvent(supabase, {
        bookingId: input.bookingId,
        eventType: input.eventType,
        recipientEmail: input.to,
        recipientRole: input.recipientRole,
        deliveryStatus: "failed",
        staffId: input.staffId ?? null,
        errorMessage: reason,
      }).catch(() => undefined);
      throw new Error(reason);
    }
    return { status: "queued" as const, scheduledFor };
  }

  try {
    const data = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    await recordEmailDeliveryEvent(supabase, {
      bookingId: input.bookingId,
      eventType: input.eventType,
      recipientEmail: input.to,
      recipientRole: input.recipientRole,
      deliveryStatus: "accepted",
      staffId: input.staffId ?? null,
      providerMessageId: getProviderMessageId(data),
    }).catch(() => undefined);
    return { status: "accepted" as const };
  } catch (error) {
    await recordEmailDeliveryEvent(supabase, {
      bookingId: input.bookingId,
      eventType: input.eventType,
      recipientEmail: input.to,
      recipientRole: input.recipientRole,
      deliveryStatus: "failed",
      staffId: input.staffId ?? null,
      errorMessage: error instanceof Error ? error.message : "Email failed.",
    }).catch(() => undefined);
    return { status: "failed" as const };
  }
}

async function getAssignedStaffEmails(bookingId: string, supabase: SupabaseClient) {
  const { data } = await supabase
    .from("booking_assignments")
    .select("assigned_staff_id, staff_profiles(email)")
    .eq("booking_id", bookingId)
    .not("assigned_staff_id", "is", null)
    .returns<AssignedStaffEmailRecord[]>();

  const records = new Map<string, { staffId: string; email: string }>();
  for (const assignment of data ?? []) {
    if (!assignment.assigned_staff_id || !assignment.staff_profiles?.email) {
      continue;
    }
    records.set(assignment.staff_profiles.email, {
      staffId: assignment.assigned_staff_id,
      email: assignment.staff_profiles.email,
    });
  }

  return [...records.values()];
}

export async function sendBookingCreatedEmails(
  bookingId: string,
  supabase: SupabaseClient,
  options: { manageUrl?: string } = {}
) {
  const { booking, settings, input } = await getBookingTemplateInput(
    bookingId,
    supabase,
    {
      includeManageUrl: true,
      manageUrl: options.manageUrl,
      requireCustomerEmail: false,
    }
  );
  // A phone-only admin booking has no address to confirm to. That is the
  // intended state, not a failure — skip silently instead of throwing, so the
  // caller isn't handed an error for a booking that was created correctly.
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    return { manageUrl: input.manageUrl ?? null };
  }

  // C-08 Phase B — each leg reads its own template's overrides (booking_confirmation
  // for the customer, admin_booking_notification for the admin); the plain-text
  // fallback shares the same resolved overrides as its HTML sibling so a
  // footer_contact edit applies identically to both legs.
  const [customerOverrides, adminOverrides] = await Promise.all([
    resolveTemplateOverrides("booking_confirmation"),
    resolveTemplateOverrides("admin_booking_notification"),
  ]);

  await Promise.all([
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "booking_confirmation",
      recipientRole: "customer",
      to: customerEmail,
      subject: `${input.companyName} booking request received`,
      html: renderBookingConfirmationEmail(input, customerOverrides),
      text: renderBookingPlainText("Booking request received", input, customerOverrides),
    }),
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "admin_booking_notification",
      recipientRole: "admin",
      to: getAdminRecipient(settings),
      subject: `New booking request - ${input.clientName}`,
      html: renderAdminBookingNotificationEmail({
        ...input,
        bookingId: booking.id,
        clientEmail: booking.contact_email || booking.clients?.email || null,
        clientPhone: booking.contact_phone || booking.clients?.phone || null,
      }, adminOverrides),
      text: renderBookingPlainText("New booking request", input, adminOverrides),
    }),
  ]);

  return { manageUrl: input.manageUrl ?? null };
}

export async function sendBookingCancellationEmails(
  bookingId: string,
  supabase: SupabaseClient,
  options: {
    initiatedBy: "customer" | "admin";
    cancellationNote?: string | null;
    /**
     * C-04a Change 14 — delays ONLY the customer leg, so an admin misclick can
     * be undone before the client hears about it. The admin and assigned-staff
     * legs below stay immediate: internal recipients want real-time notice.
     */
    delaySeconds?: number;
  } = { initiatedBy: "admin" }
) {
  const { booking, settings, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  // C-08 Phase B — resolved here, at call time, not at drain time: `delaySeconds`
  // only defers the customer leg's *delivery* inside sendTrackedEmail (the row is
  // queued and a cron drains it later); the HTML/text below are rendered now, up
  // front, and the finished payload is what gets parked in the queued row. There
  // is no later render step for the C-04a delayed-cancellation path to intercept.
  const [customerOverrides, adminOverrides] = await Promise.all([
    resolveTemplateOverrides("booking_cancellation_client"),
    resolveTemplateOverrides("admin_booking_cancellation"),
  ]);

  await Promise.all([
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "booking_cancellation_customer",
      recipientRole: "customer",
      to: customerEmail,
      subject: `${input.companyName} booking cancelled`,
      html: renderBookingCancellationEmail(input, customerOverrides),
      text: renderBookingPlainText("Booking cancelled", input, customerOverrides),
      delaySeconds: options.delaySeconds,
    }),
    sendTrackedEmail(supabase, {
      bookingId,
      eventType: "booking_cancellation_admin",
      recipientRole: "admin",
      to: getAdminRecipient(settings),
      subject: `Booking cancelled - ${input.clientName}`,
      html: renderAdminBookingCancellationEmail({
        ...input,
        bookingId,
        initiatedBy: options.initiatedBy,
        cancellationNote: options.cancellationNote,
      }, adminOverrides),
      text: renderBookingPlainText("Booking cancelled", input, adminOverrides),
    }),
    sendAssignedStaffBookingChangeEmails(
      bookingId,
      supabase,
      "An assigned booking has been cancelled."
    ),
  ]);
}

/**
 * C-04a — a restore used to be silent to the client: they heard the
 * cancellation and then nothing (B-120). `fromStatus` is what the booking is
 * being restored out of; the template only apologises when that was a
 * cancellation.
 */
export async function sendBookingRestoredClientEmail(
  bookingId: string,
  supabase: SupabaseClient,
  options: { fromStatus: string } = { fromStatus: "cancelled" }
) {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  // C-08 Phase B — "booking_restored_client" has no templates-data.ts entry
  // (never was one of the admin-editable templates), so no override row can
  // exist for it via the UI today; this resolves to {} and is a no-op until a
  // future plan registers the template. Included for consistency with every
  // other send fn and so the wiring is already correct if that lands.
  const overrides = await resolveTemplateOverrides("booking_restored_client");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_restored_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: `${input.companyName} — your booking is back on`,
    html: renderBookingRestoredEmail({ ...input, fromStatus: options.fromStatus }, overrides),
    text: renderBookingPlainText("Booking restored", input, overrides),
  });
}

export async function sendBookingCancellationEmail(
  bookingId: string,
  supabase: SupabaseClient
) {
  await sendBookingCancellationEmails(bookingId, supabase, {
    initiatedBy: "admin",
  });
}

export async function sendBookingRescheduleRequestEmails(
  bookingId: string,
  supabase: SupabaseClient,
  input: {
    requestedDate: string;
    requestedTime: string;
    requestNote: string | null;
  }
) {
  const { settings, input: templateInput } = await getBookingTemplateInput(
    bookingId,
    supabase
  );

  const overrides = await resolveTemplateOverrides("admin_reschedule_request");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_reschedule_request_admin",
    recipientRole: "admin",
    to: getAdminRecipient(settings),
    subject: `Reschedule request - ${templateInput.clientName}`,
    html: renderAdminRescheduleRequestEmail({
      ...templateInput,
      bookingId,
      requestedDate: input.requestedDate,
      requestedTime: input.requestedTime,
      requestNote: input.requestNote,
    }, overrides),
    text: renderBookingPlainText("Reschedule request", templateInput, overrides),
  });
}

export async function sendStaffAssignmentEmail(
  bookingId: string,
  staffEmail: string | null,
  supabase: SupabaseClient,
  staffId?: string | null
) {
  const { input } = await getBookingTemplateInput(bookingId, supabase);
  const overrides = await resolveTemplateOverrides("staff_assignment");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "staff_assignment",
    recipientRole: "staff",
    staffId: staffId ?? null,
    to: staffEmail,
    subject: `${input.companyName} booking assignment`,
    html: renderStaffAssignmentEmail(input, overrides),
    text: renderBookingPlainText("Booking assignment", input, overrides),
  });
}

export async function sendAssignedStaffBookingChangeEmails(
  bookingId: string,
  supabase: SupabaseClient,
  changeSummary: string
) {
  const [staffEmails, { input }, overrides] = await Promise.all([
    getAssignedStaffEmails(bookingId, supabase),
    getBookingTemplateInput(bookingId, supabase),
    resolveTemplateOverrides("staff_booking_change"),
  ]);

  await Promise.all(
    staffEmails.map((staff) =>
      sendTrackedEmail(supabase, {
        bookingId,
        eventType: "staff_booking_change",
        recipientRole: "staff",
        staffId: staff.staffId,
        to: staff.email,
        subject: `${input.companyName} assigned booking changed`,
        html: renderStaffBookingChangeEmail({
          ...input,
          changeSummary,
        }, overrides),
        text: renderBookingPlainText("Assigned booking changed", input, overrides),
      })
    )
  );
}

export async function sendBookingReminderEmail(
  bookingId: string,
  supabase: SupabaseClient
) {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  const overrides = await resolveTemplateOverrides("booking_reminder");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_reminder",
    recipientRole: "customer",
    to: customerEmail,
    subject: `${input.companyName} booking reminder`,
    html: renderBookingReminderEmail(input, overrides),
    text: renderBookingPlainText("Booking reminder", input, overrides),
  });
}

/**
 * C-08 — sent when an admin moves a booking from pending → confirmed
 * (quickUpdateBooking / updateBookingManagement).
 */
export async function sendBookingConfirmedClientEmail(
  bookingId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase, {
    includeManageUrl: true,
  });
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  const html = await renderBookingConfirmedClientEmail(input);
  const overrides = await resolveTemplateOverrides("booking_confirmed_client");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_confirmed_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: "Your booking is confirmed", // SUBJECTS map authoritative
    html,
    text: renderBookingConfirmedClientPlainText(input, overrides),
  });
}

/**
 * C-08 — sent to the therapist previously assigned to a booking when that
 * assignment is removed (unassigned, or reassigned to someone else) via
 * updateBookingAssignment. A staff row with no email is a valid state (not
 * every practitioner has one on file) — skip and log rather than throw, so a
 * missing staff email can never break the reassignment it's reporting on.
 */
export async function sendStaffUnassignmentEmail(
  bookingId: string,
  previousStaffId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { input } = await getBookingTemplateInput(bookingId, supabase, {
    requireCustomerEmail: false,
  });

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("email, name")
    .eq("id", previousStaffId)
    .maybeSingle<{ email: string | null; name: string }>();

  if (!staff?.email) {
    console.warn(
      `sendStaffUnassignmentEmail: staff ${previousStaffId} has no email; skipping notification.`
    );
    return;
  }

  const unassignInput = { ...input, therapistName: staff.name };
  const html = await renderStaffUnassignmentEmail(unassignInput);
  const overrides = await resolveTemplateOverrides("staff_unassignment");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "staff_unassignment",
    recipientRole: "staff",
    staffId: previousStaffId,
    to: staff.email,
    subject: "Booking assignment removed", // SUBJECTS map authoritative
    html,
    text: renderStaffUnassignmentPlainText(unassignInput, overrides),
  });
}

/**
 * C-08 — sent to the admin recipient when a practitioner claims an
 * unassigned slot, wired into claimBookingAssignment.
 *
 * NOTE (2026-07-16): `getAdminRecipient` here is Phase-A-interim only.
 * Phase D Step 15 reroutes this send through
 * `resolveBusinessNotificationRecipients` (multi-recipient, per-type prefs
 * keyed `slot_claimed`, skip-self via the claiming staff id) — this
 * single-admin-recipient call is a placeholder until then.
 */
export async function sendClaimNotificationEmail(
  bookingId: string,
  claimingStaffId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { settings, input } = await getBookingTemplateInput(bookingId, supabase, {
    requireCustomerEmail: false,
  });

  const adminRecipient = getAdminRecipient(settings);
  if (!adminRecipient) return; // no admin email configured — opted out

  const { data: claimingStaff } = await supabase
    .from("staff_profiles")
    .select("name")
    .eq("id", claimingStaffId)
    .maybeSingle<{ name: string }>();
  const therapistName = claimingStaff?.name ?? "(unknown)";

  const claimInput = { ...input, therapistName };
  const html = await renderClaimNotificationEmail(claimInput);
  const overrides = await resolveTemplateOverrides("claim");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "claim",
    recipientRole: "admin",
    to: adminRecipient,
    subject: `Slot claimed: ${therapistName} → ${input.bookingDate}`,
    html,
    text: renderClaimNotificationPlainText(claimInput, overrides),
  });
}

/**
 * C-08 — sent to the client whenever their assignment changes (assign,
 * reassign, or claim), so they always know who is coming. Wired into
 * claimBookingAssignment and updateBookingAssignment.
 */
export async function sendClientAssignedTherapistEmail(
  bookingId: string,
  assignedStaffId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase, {
    includeManageUrl: true,
  });
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

  const { data: assignedStaff } = await supabase
    .from("staff_profiles")
    .select("name")
    .eq("id", assignedStaffId)
    .maybeSingle<{ name: string }>();
  const therapistName = assignedStaff?.name ?? "your therapist";

  const assignedInput = { ...input, therapistName };
  const html = await renderClientAssignedTherapistEmail(assignedInput);
  const overrides = await resolveTemplateOverrides("client_assigned_therapist");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "client_assigned_therapist",
    recipientRole: "customer",
    to: customerEmail,
    subject: `Your therapist for ${input.bookingDate}`,
    html,
    text: renderClientAssignedTherapistPlainText(assignedInput, overrides),
  });
}

interface ReviewEmailBookingRow {
  id: string;
  contact_email: string | null;
  completed_at: string | null;
  review_email_sent_at: string | null;
  status: string;
  clients: { email: string | null; city: string | null } | null;
}

interface BookingItemGroupCategoryRow {
  services: { group_category: string | null } | null;
}

/**
 * C-01 — sends the "leave us a review" email once a booking has sat
 * `completed` for 2+ hours (the cron route enforces the delay; this function
 * only renders, sends and marks the sentinel). Idempotent via
 * `review_email_sent_at`: a no-email booking is marked as handled so the cron
 * never retries it forever, and the closing UPDATE is guarded by
 * `.is("review_email_sent_at", null)` to survive a parallel cron tick.
 */
export async function sendReviewRequestEmail(
  bookingId: string,
  supabase: SupabaseClient
): Promise<{ sent: boolean; reason?: "no_email" | "already_sent" | "send_failed" }> {
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, contact_email, completed_at, review_email_sent_at, status, clients(email, city)")
    .eq("id", bookingId)
    .maybeSingle<ReviewEmailBookingRow>();

  if (bookingErr || !booking) {
    throw new Error(`sendReviewRequestEmail: booking ${bookingId} not found.`);
  }
  if (booking.status !== "completed") {
    return { sent: false, reason: "send_failed" }; // status flipped between cron read and now
  }
  if (booking.review_email_sent_at) {
    return { sent: false, reason: "already_sent" };
  }

  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    // Mark as "handled" — don't keep retrying a no-email booking.
    await supabase
      .from("bookings")
      .update({ review_email_sent_at: new Date().toISOString() })
      .eq("id", bookingId);
    return { sent: false, reason: "no_email" };
  }

  const { input } = await getBookingTemplateInput(bookingId, supabase);
  const groupCategory = await deriveGroupCategoryForBooking(bookingId, supabase);
  const city = booking.clients?.city ?? null;

  const reviewInput: ReviewRequestEmailInput = {
    ...input,
    groupCategory,
    city,
  };

  const html = await renderReviewRequestEmail(reviewInput);
  const overrides = await resolveTemplateOverrides("review_request_client");
  const variants = pickReviewMessages({ groupCategory, city, overrides });
  const text = renderReviewRequestPlainText(reviewInput, variants, overrides);

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "review_request_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: "Thank you for visiting Rahma Therapy", // SUBJECTS map authoritative
    html,
    text,
  });

  // Mark sentinel — guarded by WHERE review_email_sent_at IS NULL as defense
  // against a parallel cron tick sending twice.
  const { data: marked } = await supabase
    .from("bookings")
    .update({ review_email_sent_at: new Date().toISOString() })
    .eq("id", bookingId)
    .is("review_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (!marked) {
    // Parallel cron tick already marked the sentinel first. The email may
    // have been double-sent; log for monitoring but don't fail the request.
    console.warn(`sendReviewRequestEmail: sentinel race for booking ${bookingId}`);
  }

  return { sent: true };
}

async function deriveGroupCategoryForBooking(
  bookingId: string,
  supabase: SupabaseClient
): Promise<"massage" | "cupping" | null> {
  const { data: items } = await supabase
    .from("booking_items")
    .select("services(group_category)")
    .eq("booking_id", bookingId)
    .returns<BookingItemGroupCategoryRow[]>();

  const categories = new Set(
    (items ?? [])
      .map((item) => item.services?.group_category)
      .filter((cat): cat is string => cat === "massage" || cat === "cupping")
  );

  if (categories.size === 1) {
    return categories.has("massage") ? "massage" : "cupping";
  }
  // Mixed or unknown → null (variant picker falls back to massage pool).
  return null;
}
