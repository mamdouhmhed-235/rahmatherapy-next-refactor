"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageAllBookings,
  canResendBookingEmails,
  canViewAllBookings,
  getStaffProfile,
} from "@/lib/auth/rbac";
import {
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
  sendBookingConfirmedClientEmail,
  sendBookingCreatedEmails,
  sendBookingReminderEmail,
  sendStaffAssignmentEmail,
  sendStaffUnassignmentEmail,
} from "@/lib/email/notifications";
import { recordOperationalEvent } from "@/lib/ops/operational-events";
import { TAGS } from "@/lib/cache/tag-taxonomy";

function canManageEmails(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  return canResendBookingEmails(profile);
}

export async function sendManualBookingReminder(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !canManageEmails(profile)) {
    return;
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  if (!bookingId) return;

  const adminClient = createSupabaseAdminClient();

  // H11 middle-path scope check. If the actor can't see all bookings
  // (Therapist-class with resend permission), the booking must have an
  // assignment to them. Refuses silently — matches the existing silent-
  // refuse pattern when permission gates fail above. Logs an operational
  // event so the attempt is traceable.
  const canSeeAllBookings = canViewAllBookings(profile) || canManageAllBookings(profile);
  if (!canSeeAllBookings) {
    const { count } = await adminClient
      .from("booking_assignments")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("assigned_staff_id", profile.id);
    if (!count || count === 0) {
      await recordOperationalEvent(adminClient, {
        eventType: "failed_reminder_attempt",
        severity: "warning",
        summary:
          "Staff attempted to resend a booking reminder for a booking they aren't assigned to.",
        bookingId,
        staffId: profile.id,
        safeContext: { route: "/admin/emails", reason: "out_of_scope_assignment" },
      }).catch(() => undefined);
      return;
    }
  }

  try {
    await sendBookingReminderEmail(bookingId, adminClient);
    await adminClient.from("audit_logs").insert({
      actor_staff_id: profile.id,
      action_type: "manual_booking_reminder_sent",
      target_type: "bookings",
      target_id: bookingId,
      after_state: { manual: true },
    });
  } catch (error) {
    await recordOperationalEvent(adminClient, {
      eventType: "failed_reminder_attempt",
      severity: "error",
      summary: "Manual booking reminder failed.",
      bookingId,
      staffId: profile.id,
      safeContext: {
        route: "/admin/emails",
        error_class: error instanceof Error ? error.name : "UnknownError",
      },
    }).catch(() => undefined);
    return;
  }

  updateTag(TAGS.EMAILS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/emails");
  revalidatePath("/admin/dashboard");
}

// ─── C-08 Phase C — per-row Resend (brief §2.6, plan §1 Steps 8/9) ─────────

const RESEND_RATE_LIMIT_SECONDS = 60;

export interface ResendEmailResult {
  ok: boolean;
  newEventId?: string;
  error?: string;
}

interface DeliveryEventRow {
  id: string;
  booking_id: string | null;
  event_type: string;
  recipient_email: string | null;
  recipient_role: string | null;
  delivery_status: string;
  staff_id: string | null;
  created_at: string;
}

export async function resendEmail(formData: FormData): Promise<ResendEmailResult> {
  // Same auth-check idiom as sendManualBookingReminder above (getStaffProfile
  // + the file's own canManageEmails alias) rather than the plan sketch's
  // requirePermission/PermissionError — matches this file's real style
  // (orchestrator-directed deviation, C-08 Phase C progress notes §3 item 1).
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !canManageEmails(profile)) {
    return { ok: false, error: "Insufficient permissions." };
  }

  const deliveryEventId = String(formData.get("delivery_event_id") ?? "").trim();
  if (!deliveryEventId) return { ok: false, error: "Delivery event is required." };

  const adminClient = createSupabaseAdminClient();

  const { data: original, error: fetchErr } = await adminClient
    .from("email_delivery_events")
    .select(
      "id, booking_id, event_type, recipient_email, recipient_role, delivery_status, staff_id, created_at"
    )
    .eq("id", deliveryEventId)
    .maybeSingle<DeliveryEventRow>();

  if (fetchErr || !original) {
    return { ok: false, error: "Delivery event not found." };
  }

  if (original.delivery_status === "skipped") {
    return { ok: false, error: "Skipped events have no content to resend." };
  }

  if (!original.recipient_email) {
    // Structurally shouldn't happen — sendTrackedEmail always marks a
    // missing-recipient send as `skipped` (caught above) — but the column is
    // nullable, so guard rather than assume.
    return { ok: false, error: "This event has no recipient to resend to." };
  }

  // H11 middle-path scope check — same pattern as sendManualBookingReminder
  // above. `resend_booking_emails` is held by Owner, Admin, Coordinator AND
  // Therapist, but a flat permission check has no concept of *which*
  // booking: a Therapist holding a delivery-event id could otherwise resend
  // mail for a booking they aren't assigned to. This matters more now the
  // RLS policy on email_delivery_events has been tightened (e91c09c) —
  // application-level scoping here is the only remaining gate.
  const canSeeAllBookings = canViewAllBookings(profile) || canManageAllBookings(profile);
  if (!canSeeAllBookings) {
    let count = 0;
    if (original.booking_id) {
      const result = await adminClient
        .from("booking_assignments")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", original.booking_id)
        .eq("assigned_staff_id", profile.id);
      count = result.count ?? 0;
    }
    // A null booking_id (a future non-booking-linked event type, e.g. Phase
    // D's enquiry_logged) has no assignment a scoped actor could ever prove
    // — `count` stays 0 and the actor is refused outright rather than
    // queried for, so a null booking_id can never silently pass an
    // unscoped actor.
    if (count === 0) {
      await recordOperationalEvent(adminClient, {
        eventType: "failed_resend_attempt",
        severity: "warning",
        summary:
          "Staff attempted to resend an email for a booking they aren't assigned to.",
        bookingId: original.booking_id,
        staffId: profile.id,
        safeContext: {
          route: "/admin/emails",
          reason: "out_of_scope_assignment",
          delivery_event_id: deliveryEventId,
        },
      }).catch(() => undefined);
      return {
        ok: false,
        error: "You can only resend emails for bookings assigned to you.",
      };
    }
  }

  // Rate-limit: the same (booking, event_type, recipient) tuple resent
  // within the window is rejected. `booking_id` is nullable on this table —
  // `.eq("booking_id", null)` compiles to `= NULL`, which never matches any
  // row in Postgres (NULL comparisons are always unknown), so a null
  // booking_id needs its own `.is()` branch or this check would silently
  // never catch a repeat resend of a non-booking-linked event.
  const cutoff = new Date(
    Date.now() - RESEND_RATE_LIMIT_SECONDS * 1000
  ).toISOString();
  let recentQuery = adminClient
    .from("email_delivery_events")
    .select("id")
    .eq("event_type", original.event_type)
    .eq("recipient_email", original.recipient_email)
    .gte("created_at", cutoff)
    .limit(1);
  recentQuery = original.booking_id
    ? recentQuery.eq("booking_id", original.booking_id)
    : recentQuery.is("booking_id", null);
  const { data: recent } = await recentQuery.maybeSingle();
  if (recent) {
    return {
      ok: false,
      error: `Recently sent. Try again in ${RESEND_RATE_LIMIT_SECONDS} seconds.`,
    };
  }

  try {
    await dispatchResend(
      original.event_type,
      original.booking_id,
      original.recipient_email,
      original.staff_id,
      adminClient
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Resend failed.",
    };
  }

  // Fetch the newest matching event row — the resend above just wrote it.
  // Filtered by recipient_email too: some sends fan out to several
  // recipients under the same (booking_id, event_type) — e.g.
  // staff_booking_change notifies every assigned staff member — so this is
  // what disambiguates which of the new rows corresponds to this resend.
  // Same null-booking_id handling as the rate-limit query above.
  let newestQuery = adminClient
    .from("email_delivery_events")
    .select("id")
    .eq("event_type", original.event_type)
    .eq("recipient_email", original.recipient_email)
    .order("created_at", { ascending: false })
    .limit(1);
  newestQuery = original.booking_id
    ? newestQuery.eq("booking_id", original.booking_id)
    : newestQuery.is("booking_id", null);
  const { data: newest } = await newestQuery.maybeSingle<{ id: string }>();

  if (newest) {
    // C-08 Phase D Step 13 landed `email_delivery_events.metadata` — stamp
    // the resend linkage on the new row now that the column exists (the
    // audit_logs row below was the sole linkage record until now).
    await adminClient
      .from("email_delivery_events")
      .update({ metadata: { resent_from_event_id: deliveryEventId } })
      .eq("id", newest.id);

    await adminClient.from("audit_logs").insert({
      actor_staff_id: profile.id,
      action_type: "email_resent",
      target_type: "email_delivery_events",
      target_id: newest.id,
      after_state: {
        resent_from: deliveryEventId,
        event_type: original.event_type,
        recipient_email: original.recipient_email,
      },
    });
  }

  updateTag(TAGS.EMAILS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/emails");
  return { ok: true, newEventId: newest?.id };
}

/**
 * Re-sends the given event type using only what the delivery row itself
 * carries (booking_id, recipient_email, staff_id). Event types whose
 * original context isn't recoverable from the row — `claim`'s claiming
 * staff member, `client_assigned_therapist`'s assigned therapist — return a
 * structured error rather than silently sending nothing or guessing.
 */
async function dispatchResend(
  eventType: string,
  bookingId: string | null,
  recipientEmail: string,
  staffId: string | null,
  supabase: SupabaseClient
): Promise<void> {
  if (!bookingId) {
    throw new Error(
      `Resend isn't supported for "${eventType}" — no booking is linked to this event.`
    );
  }

  switch (eventType) {
    case "booking_confirmation":
      await sendBookingCreatedEmails(bookingId, supabase);
      return;
    case "booking_cancellation_customer":
    case "booking_cancellation_admin":
      await sendBookingCancellationEmails(bookingId, supabase, {
        initiatedBy: "admin",
      });
      return;
    case "booking_reminder":
      await sendBookingReminderEmail(bookingId, supabase);
      return;
    case "staff_assignment":
      // staffId is optional here — sendStaffAssignmentEmail only needs it to
      // tag the new delivery row; the send itself uses recipientEmail.
      await sendStaffAssignmentEmail(
        bookingId,
        recipientEmail,
        supabase,
        staffId ?? undefined
      );
      return;
    case "staff_booking_change":
      // No stored copy of the original change summary — a fresh, honest
      // resend message, not a guess at the original wording.
      await sendAssignedStaffBookingChangeEmails(
        bookingId,
        supabase,
        "Resent change notification."
      );
      return;
    case "booking_confirmed_client":
      await sendBookingConfirmedClientEmail(bookingId, supabase);
      return;
    case "staff_unassignment":
      if (!staffId) {
        throw new Error(
          "Resend isn't supported for this event — the unassigned staff member isn't recorded on it."
        );
      }
      await sendStaffUnassignmentEmail(bookingId, staffId, supabase);
      return;
    case "claim":
      throw new Error(
        "Resend isn't supported for claim notifications — the claiming staff member isn't recorded on this event."
      );
    case "client_assigned_therapist":
      throw new Error(
        "Resend isn't supported for this event yet — the assigned therapist isn't recorded on it."
      );
    default:
      throw new Error(`Cannot resend event type: ${eventType}`);
  }
}
