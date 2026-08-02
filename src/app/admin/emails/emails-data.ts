// SERVER ONLY — cached data helper for /admin/emails (C-09 Phase C Step 5).
//
// Permissions are resolved upstream in page.tsx and passed in: they decide
// WHICH queries run, and they are part of the cache key, so a coordinator-
// resend-only caller can never be served an entry built for someone with full
// email-log access. `staffId` is in the key too, because the therapist-scoped
// reminders path filters by the caller's own assignments.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `events`, `reminderBookings`, `templateStaff` are plain row arrays.
//  - `templateOverrideSummaries` is a Record of string fields.
//  - `deliveryError` is `{ message } | null` — already a plain object; kept in
//    that shape because DeliveryTab renders the message.
//  - TRANSFORM APPLIED: `templateStaff` is returned as an ARRAY of {id,name},
//    not the `Map` page.tsx builds from it (a Map re-hydrates as {}). page.tsx
//    also builds `lastReminderByBooking` from `events` — both Maps live on the
//    consumer side of the cache boundary.
//  - `businessDate` is passed IN as a `YYYY-MM-DD` string rather than being
//    computed inside the fetcher, so the "upcoming bookings" day boundary is
//    part of the cache key instead of being frozen for the revalidate window.
// No Set / Map / Date crosses the boundary.
//
// Tag: `emails`, per the plan's Step 5 table. The Reminders tab's upcoming-
// bookings list rides in the same entry, so a booking change that does not
// also set the emails tag can leave it trailing by at most the 60s revalidate
// window.
//
// PAGINATION-READY (C-16): optional `limit` + `offset` bound the delivery feed
// and flow into BOTH the query and the cache key, so page 2 can never be
// served page 1's rows. `limit` defaults to EMAILS_PAGE_SIZE (100) — the
// ceiling the page already used — so behaviour is unchanged.
// `countEmailDeliveryEvents` is the cheap head-count companion for C-16's
// "Showing X–Y of Z" readout; it is not called by the page today.
//
// FILTERS: the delivery feed is still fetched unfiltered and narrowed in
// memory by page.tsx, exactly as before. Moving that narrowing into the query
// is C-09 Phase D Step 11.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { getTemplateOverrideSummaries } from "@/lib/email/templates";

export const EMAILS_PAGE_SIZE = 100;

const DELIVERY_SELECT =
  "id, booking_id, staff_id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at";

export interface EmailEvent {
  id: string;
  booking_id: string | null;
  staff_id: string | null;
  event_type: string;
  recipient_email: string | null;
  recipient_role: string | null;
  delivery_status: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ReminderBooking {
  id: string;
  booking_date: string;
  start_time: string;
  contact_full_name: string | null;
  contact_email: string | null;
  status: string;
}

export interface EmailTemplateStaffName {
  id: string;
  name: string;
}

export interface EmailsPageParams {
  /** `canViewEmailLogs(profile)` — gates the delivery feed. */
  canSeeDelivery: boolean;
  /** `canResendBookingEmails(profile)` — gates the reminders queue. */
  canResend: boolean;
  /** Owner/Admin/Coordinator see the whole clinic queue; a therapist does not. */
  canSeeAllBookings: boolean;
  /** Caller's staff id — scopes the therapist reminders path. */
  staffId: string;
  /** London business date (`YYYY-MM-DD`) — the upcoming-bookings floor. */
  businessDate: string;
  /** Only the Templates tab needs the override + staff-name lookups. */
  includeTemplates: boolean;
  limit?: number;
  offset?: number;
}

export interface EmailsPageData {
  events: EmailEvent[];
  deliveryError: { message: string } | null;
  reminderBookings: ReminderBooking[];
  templateOverrideSummaries: Record<
    string,
    { updatedAt: string; updatedBy: string | null }
  >;
  templateStaff: EmailTemplateStaffName[];
}

export async function getEmailsPageData(
  params: EmailsPageParams
): Promise<EmailsPageData> {
  const {
    canSeeDelivery,
    canResend,
    canSeeAllBookings,
    staffId,
    businessDate,
    includeTemplates,
  } = params;
  const limit = params.limit ?? EMAILS_PAGE_SIZE;
  const offset = params.offset ?? 0;

  const cached = unstable_cache(
    async (): Promise<EmailsPageData> => {
      const adminClient = createSupabaseAdminClient();

      type DeliveryResult = {
        data: EmailEvent[] | null;
        error?: { message: string } | null;
      };
      const deliveryPromise: Promise<DeliveryResult> = canSeeDelivery
        ? (adminClient
            .from("email_delivery_events")
            .select(DELIVERY_SELECT)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)
            .returns<EmailEvent[]>() as unknown as Promise<DeliveryResult>)
        : Promise.resolve({ data: [] });

      // Reminders scope (H11 middle path). A therapist with
      // resend_booking_emails but only assigned-bookings view is scoped to
      // their own assignments — keeps client contact PII bounded to bookings
      // they're actually working on.
      let allowedReminderBookingIds: string[] | null = null;
      if (canResend && !canSeeAllBookings) {
        const { data: ownAssignments } = await adminClient
          .from("booking_assignments")
          .select("booking_id")
          .eq("assigned_staff_id", staffId)
          .limit(200);
        allowedReminderBookingIds = Array.from(
          new Set((ownAssignments ?? []).map((a) => a.booking_id).filter(Boolean))
        );
      }

      const remindersPromise = (() => {
        if (!canResend) return Promise.resolve({ data: [] as ReminderBooking[] });
        if (
          allowedReminderBookingIds !== null &&
          allowedReminderBookingIds.length === 0
        ) {
          return Promise.resolve({ data: [] as ReminderBooking[] });
        }
        let q = adminClient
          .from("bookings")
          .select(
            "id, booking_date, start_time, contact_full_name, contact_email, status"
          )
          .gte("booking_date", businessDate)
          .in("status", ["pending", "confirmed"])
          .order("booking_date")
          .order("start_time")
          .limit(20);
        if (allowedReminderBookingIds !== null) {
          q = q.in("id", allowedReminderBookingIds);
        }
        return q.returns<ReminderBooking[]>();
      })();

      // C-15 Phase E, Step 17 — gallery badge data. ONE grouped query plus one
      // companion query resolving `updated_by` ids to display names.
      const templateOverrideSummariesPromise = includeTemplates
        ? getTemplateOverrideSummaries()
        : Promise.resolve(
            {} as Record<string, { updatedAt: string; updatedBy: string | null }>
          );
      const templateStaffNamesPromise: Promise<{
        data: EmailTemplateStaffName[] | null;
      }> = includeTemplates
        ? (adminClient
            .from("staff_profiles")
            .select("id, name")
            .returns<EmailTemplateStaffName[]>() as unknown as Promise<{
            data: EmailTemplateStaffName[] | null;
          }>)
        : Promise.resolve({ data: [] });

      const [
        deliveryResult,
        remindersResult,
        templateOverrideSummaries,
        templateStaffNamesResult,
      ] = await Promise.all([
        deliveryPromise,
        remindersPromise,
        templateOverrideSummariesPromise,
        templateStaffNamesPromise,
      ]);

      return {
        events: deliveryResult.data ?? [],
        deliveryError:
          "error" in deliveryResult ? deliveryResult.error ?? null : null,
        reminderBookings: remindersResult.data ?? [],
        templateOverrideSummaries,
        templateStaff: templateStaffNamesResult.data ?? [],
      };
    },
    [
      "emails-page",
      cacheKeyPart({
        canSeeDelivery,
        canResend,
        canSeeAllBookings,
        staffId,
        businessDate,
        includeTemplates,
        limit,
        offset,
      }),
    ],
    { revalidate: 60, tags: [TAGS.EMAILS] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. Not used by the page yet.
 */
export async function countEmailDeliveryEvents(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("email_delivery_events")
        .select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    ["emails-delivery-count"],
    { revalidate: 60, tags: [TAGS.EMAILS] }
  );
  return cached();
}
