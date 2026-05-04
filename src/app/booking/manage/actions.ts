"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getCustomerManageBooking } from "@/lib/booking/customer-manage";
import {
  sendBookingCancellationEmails,
  sendBookingRescheduleRequestEmails,
} from "@/lib/email/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordOperationalEvent } from "@/lib/ops/operational-events";

export interface CustomerManageActionState {
  error?: string;
  success?: string;
}

const noteSchema = z.string().trim().max(1000);
const rescheduleSchema = z.object({
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  note: noteSchema,
});

function getFormToken(formData: FormData) {
  return String(formData.get("token") ?? "").trim();
}

function timestampedNote(note: string) {
  return `[${new Date().toISOString()}] ${note}`;
}

function appendCustomerNote(current: string | null, note: string) {
  return [current, timestampedNote(note)].filter(Boolean).join("\n\n");
}

async function insertCustomerAudit(
  bookingId: string,
  actionType: string,
  beforeState: unknown,
  afterState: unknown
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("audit_logs").insert({
    actor_staff_id: null,
    action_type: actionType,
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: afterState,
  });
}

export async function addCustomerManageNote(
  _previousState: CustomerManageActionState,
  formData: FormData
): Promise<CustomerManageActionState> {
  const token = getFormToken(formData);
  const noteResult = noteSchema.min(1, "Enter a note before saving.").safeParse(
    String(formData.get("note") ?? "")
  );

  if (!noteResult.success) {
    return { error: noteResult.error.issues[0]?.message ?? "Enter a valid note." };
  }

  const supabase = createSupabaseAdminClient();
  const booking = await getCustomerManageBooking(token, supabase);
  if (!booking) {
    await recordOperationalEvent(supabase, {
      eventType: "failed_customer_manage_action",
      summary: "Customer manage note failed because the token was invalid or expired.",
      safeContext: { action: "add_note" },
    }).catch(() => undefined);
    return { error: "This manage link is invalid or expired." };
  }

  const nextNotes = appendCustomerNote(
    booking.customerManageNotes,
    noteResult.data
  );
  const { data, error } = await supabase
    .from("bookings")
    .update({
      customer_manage_notes: nextNotes,
      last_customer_manage_action_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .select("id, customer_manage_notes, last_customer_manage_action_at")
    .single();

  if (error) return { error: error.message };

  await insertCustomerAudit(
    booking.id,
    "customer_manage_note_added",
    { customer_manage_notes: booking.customerManageNotes },
    data
  );

  revalidatePath("/booking/manage");
  revalidatePath(`/admin/bookings/${booking.id}`);

  return { success: "Your note has been added." };
}

export async function requestCustomerCancellation(
  _previousState: CustomerManageActionState,
  formData: FormData
): Promise<CustomerManageActionState> {
  const token = getFormToken(formData);
  const noteResult = noteSchema.safeParse(String(formData.get("note") ?? ""));

  if (!noteResult.success) {
    return { error: "Enter a shorter cancellation note." };
  }

  const supabase = createSupabaseAdminClient();
  const booking = await getCustomerManageBooking(token, supabase);
  if (!booking) {
    await recordOperationalEvent(supabase, {
      eventType: "failed_customer_manage_action",
      summary: "Customer cancellation failed because the token was invalid or expired.",
      safeContext: { action: "cancel" },
    }).catch(() => undefined);
    return { error: "This manage link is invalid or expired." };
  }
  if (!booking.cancellation.allowed) {
    return {
      error:
        booking.cancellation.reason ??
        "This booking can no longer be cancelled from this link.",
    };
  }

  const now = new Date().toISOString();
  const nextNotes = noteResult.data
    ? appendCustomerNote(booking.customerManageNotes, noteResult.data)
    : booking.customerManageNotes;
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      customer_cancelled_at: now,
      customer_cancellation_note: noteResult.data || null,
      customer_manage_notes: nextNotes,
      last_customer_manage_action_at: now,
    })
    .eq("id", booking.id)
    .in("status", ["pending", "confirmed"])
    .select("id, status, customer_cancelled_at, customer_cancellation_note")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Unable to cancel this booking." };
  }

  await insertCustomerAudit(
    booking.id,
    "customer_booking_cancelled",
    {
      status: booking.status,
      customer_cancelled_at: booking.customerCancelledAt,
      customer_cancellation_note: booking.customerCancellationNote,
    },
    data
  );

  await sendBookingCancellationEmails(booking.id, supabase, {
    initiatedBy: "customer",
    cancellationNote: noteResult.data || null,
  }).catch((error) => {
    console.error("Unable to send customer cancellation emails.", error);
  });

  revalidatePath("/booking/manage");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${booking.id}`);
  revalidatePath("/admin/dashboard");

  return { success: "Your cancellation request has been recorded." };
}

export async function requestCustomerReschedule(
  _previousState: CustomerManageActionState,
  formData: FormData
): Promise<CustomerManageActionState> {
  const token = getFormToken(formData);
  const parsed = rescheduleSchema.safeParse({
    preferredDate: String(formData.get("preferred_date") ?? ""),
    preferredTime: String(formData.get("preferred_time") ?? ""),
    note: String(formData.get("note") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Choose a valid preferred date and time." };
  }

  const supabase = createSupabaseAdminClient();
  const booking = await getCustomerManageBooking(token, supabase);
  if (!booking) {
    await recordOperationalEvent(supabase, {
      eventType: "failed_customer_manage_action",
      summary: "Customer reschedule failed because the token was invalid or expired.",
      safeContext: { action: "reschedule" },
    }).catch(() => undefined);
    return { error: "This manage link is invalid or expired." };
  }
  if (!["pending", "confirmed"].includes(booking.status)) {
    return { error: "This booking can no longer be rescheduled from this link." };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("bookings")
    .update({
      reschedule_requested_at: now,
      reschedule_preferred_date: parsed.data.preferredDate,
      reschedule_preferred_time: parsed.data.preferredTime,
      reschedule_note: parsed.data.note || null,
      reschedule_status: "requested",
      last_customer_manage_action_at: now,
    })
    .eq("id", booking.id)
    .select(
      "id, reschedule_requested_at, reschedule_preferred_date, reschedule_preferred_time, reschedule_note, reschedule_status"
    )
    .single();

  if (error) return { error: error.message };

  await insertCustomerAudit(
    booking.id,
    "customer_reschedule_requested",
    {
      reschedule_requested_at: booking.rescheduleRequestedAt,
      reschedule_preferred_date: booking.reschedulePreferredDate,
      reschedule_preferred_time: booking.reschedulePreferredTime,
      reschedule_note: booking.rescheduleNote,
      reschedule_status: booking.rescheduleStatus,
    },
    data
  );

  await sendBookingRescheduleRequestEmails(booking.id, supabase, {
    requestedDate: parsed.data.preferredDate,
    requestedTime: parsed.data.preferredTime,
    requestNote: parsed.data.note || null,
  }).catch((error) => {
    console.error("Unable to send reschedule request email.", error);
  });

  revalidatePath("/booking/manage");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${booking.id}`);
  revalidatePath("/admin/dashboard");

  return { success: "Your reschedule request has been sent." };
}
