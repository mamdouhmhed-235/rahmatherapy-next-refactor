# B — Idioms to mirror (verbatim), item 1

Method: every symbol below was re-located by name via `Read` against the working tree, not
assumed from the plan. Line numbers are what `Read` reported just now.

**Commit identity check (first thing verified):** the task brief says "as of commit 33f895f".
Actual `HEAD` right now is `91a5864538d33b98c64d6bfc064de0034131b329` (2026-08-11 19:28:41 +0100).
`33f895f` is real and 2 commits back:

```
$ git log --oneline -3 33f895f
33f895f docs(redesign): record the end-of-programme build result and the bundle-gate gap
aca7c18 docs(redesign): C-20, C-14, C-10 shipped — progress + master-plan checklist
a224fd7 docs(redesign): C-23 owner items closed + verification evidence for C-14/C-20/C-10
```

```
$ git diff --stat 33f895f HEAD -- src/lib/email/notifications.ts src/app/admin/emails/actions.ts \
  src/app/admin/emails/emails-data.ts src/app/admin/emails/ReminderResendForm.tsx \
  src/app/admin/emails/page.tsx src/app/api/cron/review-emails/route.ts src/app/admin/audit/format.ts
(empty output)
```

**Result: zero drift.** All 7 files this report quotes from are byte-identical between `33f895f`
and current `HEAD`. The intervening commits are docs-only. Every line number below is safe to
use as-is by the implementer.

---

## 1. `sendReviewRequestEmail` — `src/lib/email/notifications.ts`, lines 1356–1444

Signature:
```ts
export async function sendReviewRequestEmail(
  bookingId: string,
  supabase: SupabaseClient
): Promise<{ sent: boolean; reason?: "no_email" | "already_sent" | "send_failed" }>
```
- Return type: `Promise<{ sent: boolean; reason?: "no_email" | "already_sent" | "send_failed" }>`
- Type of the `reason` field: `"no_email" | "already_sent" | "send_failed" | undefined` (optional
  string-literal union — no other reason values exist today).

Whole function, verbatim (lines 1348–1444, doc comment included since it documents the
idempotency contract the cooldown guard must not violate):

```ts
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

  // C-C fix round (F-6) — resolve overrides and pick the 3-of-5 review
  // samples ONCE, then pass the same selection into both legs. Previously
  // each leg independently called resolveTemplateOverrides + Math.random-based
  // pickReviewMessages, so on ~90% of sends the HTML part listed three
  // review samples and the plain-text part listed a different three in the
  // same email — and because resolveTemplateOverrides swallows errors and
  // returns {}, a first-read success paired with a second-read failure (or
  // vice versa) could show edited copy in one leg but factory defaults in
  // the other.
  const overrides = await resolveTemplateOverrides("review_request_client");
  const variants = pickReviewMessages({ groupCategory, city, overrides });
  const html = await renderReviewRequestEmail(reviewInput, overrides, variants);
  const text = renderReviewRequestPlainText(reviewInput, variants, overrides);

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "review_request_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: resolveSubject(
      "review_request_client",
      overrides,
      buildVarMap(reviewInput, {
        city: city ?? "",
        service_name: input.participants[0]?.services?.[0] ?? "appointment",
      })
    ),
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
```

The `ReviewEmailBookingRow` interface it reads against (lines 1335–1342, needed to know what
columns are already in hand for a cooldown check without a second query):
```ts
interface ReviewEmailBookingRow {
  id: string;
  contact_email: string | null;
  completed_at: string | null;
  review_email_sent_at: string | null;
  status: string;
  clients: { email: string | null; city: string | null } | null;
}
```

---

## 2. `resendEmail` H11 middle-path scope check — `src/app/admin/emails/actions.ts`, lines 159–201

This is the branch inside `resendEmail` (whole function at lines 120–289) that runs when the
actor lacks `canViewAllBookings`/`canManageAllBookings` and must be confirmed as assigned via
`booking_assignments`. Verbatim, including the comment block above it:

```ts
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
```

`recordOperationalEvent` call, isolated (this is the security-critical shape to mirror):
- `eventType: "failed_resend_attempt"`
- `severity: "warning"`
- `summary: "Staff attempted to resend an email for a booking they aren't assigned to."`
- `bookingId: original.booking_id`
- `staffId: profile.id`
- `safeContext: { route: "/admin/emails", reason: "out_of_scope_assignment", delivery_event_id: deliveryEventId }`
- Fire-and-forget: `.catch(() => undefined)` — a logging failure must never mask/replace the
  refusal response.

Sibling shape in `sendManualBookingReminder` (item 3 below) uses `eventType:
"failed_reminder_attempt"` and `safeContext: { route: "/admin/emails", reason:
"out_of_scope_assignment" }` (no `delivery_event_id`, since a reminder send has no delivery-event
row yet) — same `severity: "warning"`, same refusal-then-log order, same `.catch(() => undefined)`.

---

## 3. `sendManualBookingReminder` — `src/app/admin/emails/actions.ts`, lines 31–97

RECON-UNTOUCHABLE per the task brief. Whole function, verbatim:

```ts
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
```

Structural template to copy for the new sibling action, step by step, from this function:
1. `const supabase = await createSupabaseServerClient();`
2. `const profile = await getStaffProfile(supabase);` then the 3-part guard
   `if (!profile || !profile.active || !canManageEmails(profile)) { return; }` (or the
   `{ ok: false, error }` variant `resendEmail` uses if the sibling needs a return value).
3. Pull identifying id(s) from `formData` via `String(formData.get(...) ?? "").trim()`, bail on
   empty.
4. `const adminClient = createSupabaseAdminClient();` — admin client created AFTER the profile
   check, not before (matches both `sendManualBookingReminder` and `resendEmail`).
5. H11 scope check (item 2 above), gated behind
   `canViewAllBookings(profile) || canManageAllBookings(profile)`.
6. `try { ...do the thing...; await adminClient.from("audit_logs").insert({...}) } catch (error) { recordOperationalEvent(...).catch(() => undefined); return; }`.
7. On success: `updateTag(TAGS.EMAILS); updateTag(TAGS.AUDIT); revalidatePath("/admin/emails");`
   (+ `revalidatePath("/admin/dashboard")` only in this function, not in `resendEmail`).

The file-level auth alias both actions share (lines 25–29):
```ts
function canManageEmails(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  return canResendBookingEmails(profile);
}
```

---

## 4. `RESEND_RATE_LIMIT_SECONDS` recent-send check — `src/app/admin/emails/actions.ts`

Constant (line 101):
```ts
const RESEND_RATE_LIMIT_SECONDS = 60;
```

Exact query and comparison (lines 203–228), verbatim including the comment explaining the
`.is()`-vs-`.eq(null)` null-handling:

```ts
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
```

Note for the implementer: this cooldown keys on `(event_type, recipient_email, booking_id)` and a
rolling `created_at >= cutoff` window — it does not read/write a dedicated sentinel column. The
review-request cooldown item 1 is adding is a DIFFERENT idiom (`review_email_sent_at` sentinel
check, already inside `sendReviewRequestEmail` itself, lines 1372–1374 and 1429–1435 above) — this
block is the pattern to mirror only if the new `ignoreClientCooldown` guard is meant to look and
feel like a time-windowed re-send throttle rather than a one-shot sentinel. Flagging the
distinction rather than picking for you.

---

## 5. `emails-data.ts` reminders query block — `src/app/admin/emails/emails-data.ts`, lines 128–254

Whole `getEmailsPageData` function, verbatim (this is the shape a new sibling export must match:
`unstable_cache` wrapper, cache key built via `cacheKeyPart({...})`, `revalidate: 60`, `tags:
[TAGS.EMAILS]`, and `createSupabaseAdminClient()` called INSIDE the cached callback):

```ts
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
```

Shape summary for the sibling export:
- Cache key: `["emails-page", cacheKeyPart({ ...every param that affects the query result... })]`
  — a two-element array, first element a literal string tag, second element `cacheKeyPart(...)`
  over an object containing every input that changes the returned rows.
- Tags: `[TAGS.EMAILS]` (from `@/lib/cache/tag-taxonomy`).
- `revalidate: 60`.
- `createSupabaseAdminClient()` is called **inside** the `unstable_cache` callback, not outside it
  — every other fetcher in this file (`countEmailDeliveryEvents` lines 421–455,
  `getFilteredDeliveryEvents` lines 462–506) follows the same placement.
- The outer (non-cached) function signature resolves defaults (`limit ?? EMAILS_PAGE_SIZE`,
  `offset ?? 0`) BEFORE constructing the cache key, so the resolved values — not `undefined` — are
  what's hashed into the key.

---

## 6. `ReminderResendForm.tsx` — `src/app/admin/emails/ReminderResendForm.tsx`, lines 1–135 (whole file)

RECON-UNTOUCHABLE hidden `booking_id` input contract per the task brief. Whole component,
verbatim:

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { firstName } from "./format";
import { sendManualBookingReminder } from "./actions";

interface ReminderResendFormProps {
  bookingId: string;
  contactFullName: string | null;
  hasRecipient: boolean;
}

// The hidden `booking_id` input and the `<form action={sendManualBookingReminder}>`
// wire-up are RECON §6.4 untouchable contracts — they MUST stay verbatim. The
// optimistic state is layered around the form, never replaces it.
//
// Note: `sendManualBookingReminder` (untouchable per RECON §5) returns void on
// both success and failure paths. The client can't distinguish them from the
// returned value alone, so the optimistic state below treats action completion
// as success unless the action throws. A thrown action triggers the failure
// toast — wired here for completeness even though the current server contract
// swallows the throw. Marked FAKE-FAILURE-PATH for the same reason.
export function ReminderResendForm({
  bookingId,
  contactFullName,
  hasRecipient,
}: ReminderResendFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle"
  );
  const formRef = useRef<HTMLFormElement>(null);
  const name = firstName(contactFullName);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setOutcome("sending");
    startTransition(async () => {
      try {
        const data = new FormData(form);
        await sendManualBookingReminder(data);
        setOutcome("sent");
        toast.success(`Reminder sent to ${name}.`);
        // Brief §6: "Last reminder" sub-line updates without a full reload.
        // revalidatePath inside the server action invalidates the route cache,
        // and router.refresh() re-fetches the server-rendered data so the
        // "Last reminder" line on this row picks up the new event.
        router.refresh();
      } catch {
        // FAKE-FAILURE-PATH: the untouchable server action does not currently
        // throw — it swallows errors via the operational-events log. When that
        // contract evolves (or a network failure surfaces), this branch fires.
        setOutcome("failed");
        toast.error(
          `Couldn't send to ${name}. Try again or check the email address.`,
          {
            duration: Number.POSITIVE_INFINITY,
            action: {
              label: "Retry",
              onClick: () => formRef.current?.requestSubmit(),
            },
          }
        );
      }
    });
  };

  // Missing-recipient row: the brief specifies the resend button is hidden and
  // an Attention chip replaces it (rendered by the parent). Keep the form
  // mounted so the booking_id contract test still finds the hidden input.
  if (!hasRecipient) {
    return (
      <form
        ref={formRef}
        action={sendManualBookingReminder}
        className="hidden"
        aria-hidden="true"
      >
        <input type="hidden" name="booking_id" value={bookingId} />
      </form>
    );
  }

  const sending = isPending || outcome === "sending";
  const sent = outcome === "sent";

  return (
    <form
      ref={formRef}
      action={sendManualBookingReminder}
      onSubmit={handleSubmit}
      className="w-full sm:w-auto"
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={sending}
        aria-busy={sending || undefined}
        aria-label={`Send reminder to ${name}`}
        title={`Send the reminder template to ${name}`}
        className={cn(
          "inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold outline-none transition-colors duration-150 sm:w-auto",
          "focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
          sent
            ? "bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)] border border-[oklch(70%_0.10_155)]"
            : "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-hover)]",
          sending && "cursor-progress opacity-90"
        )}
      >
        {sending ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            <span>Sending…</span>
          </>
        ) : sent ? (
          <>
            <Send className="size-4 shrink-0" aria-hidden="true" />
            <span>Sent</span>
          </>
        ) : (
          <>
            <Send className="size-4 shrink-0" aria-hidden="true" />
            <span>Send reminder</span>
          </>
        )}
      </button>
    </form>
  );
}
```

The contract: `<input type="hidden" name="booking_id" value={bookingId} />` appears in BOTH
branches (the hidden-form no-recipient branch at line 85, and the visible form at line 100) with
identical `name="booking_id"`; the `<form action={sendManualBookingReminder}>` prop wiring is
identical in both branches too (lines 81 and 96). A sibling form component for the new action
should reproduce this same two-branch shape (hidden hidden-form-only path vs. visible
interactive path) rather than editing this file.

---

## 7. `page.tsx` — `src/app/admin/emails/page.tsx`

### `TabKey` (line 78)
```ts
type TabKey = "delivery" | "reminders" | "templates";
```

### `resolveTab` (lines 80–88)
```ts
function resolveTab(
  raw: string | undefined,
  canSeeDelivery: boolean
): TabKey {
  if (raw === "delivery" && canSeeDelivery) return "delivery";
  if (raw === "reminders") return "reminders";
  if (raw === "templates") return "templates";
  return canSeeDelivery ? "delivery" : "reminders";
}
```

### tabs array (lines 263–291)
```ts
  const tabs: { key: TabKey; label: string; badge?: BadgeDescriptor; visible: boolean }[] = [
    {
      key: "delivery",
      label: "Delivery",
      visible: canSeeDelivery,
      badge:
        failedRecent > 0
          ? { value: failedRecent, tone: "danger", title: `${failedRecent} failed in the last 24 hours` }
          : undefined,
    },
    {
      key: "reminders",
      label: "Reminders",
      visible: canResend,
      badge:
        canResend && upcomingBookings.length > 0
          ? {
              value: upcomingBookings.length,
              tone: "muted",
              title: `${upcomingBookings.length} upcoming bookings without a reminder yet`,
            }
          : undefined,
    },
    {
      key: "templates",
      label: "Templates",
      visible: true,
    },
  ];
```

### Where `ReminderResendForm` is rendered, and how its tab's data is awaited / `canResend` gates it

Data is awaited once, unconditionally, at the top of the page (lines 159–173):
```ts
  const {
    events: allEvents,
    deliveryError,
    reminderBookings: upcomingBookings,
    templateOverrideSummaries,
    templateStaff,
  } = await getEmailsPageData({
    canSeeDelivery,
    canResend,
    canSeeAllBookings,
    staffId: profile.id,
    businessDate: getBusinessDate(),
    includeTemplates: activeTab === "templates",
    limit: PAGE_SIZE,
  });
```
(`canResend` — `canResendBookingEmails(profile)`, computed at line 120 — is passed into
`getEmailsPageData` itself, so a caller without resend permission gets `reminderBookings: []`
from inside the cached fetcher, not just a hidden tab.)

Tab-body gate (lines 319–324):
```tsx
      {activeTab === "reminders" && canResend ? (
        <RemindersTab
          bookings={upcomingBookings}
          lastReminderByBooking={lastReminderByBooking}
        />
      ) : null}
```

Inside `RemindersTab` → `ReminderRow` (lines 924–929), where `ReminderResendForm` actually
renders, one per booking row:
```tsx
      <div className="col-span-2 justify-self-stretch sm:col-span-1 sm:justify-self-end">
        <ReminderResendForm
          bookingId={booking.id}
          contactFullName={booking.contact_full_name}
          hasRecipient={hasRecipient}
        />
      </div>
```

### What wiring a new tab requires — exact steps, derived from the above

1. Add the new key to the `TabKey` union (line 78).
2. Extend `resolveTab` (lines 80–88) with an `if (raw === "<newkey>") return "<newkey>";` branch,
   ordered consistently with the existing three (before the final default-fallback line).
3. Add an entry to the `tabs` array (lines 263–291) with `key`, `label`, `visible` (a permission
   boolean computed earlier in the function body, mirroring `canSeeDelivery`/`canResend`), and
   optionally `badge`.
4. Fetch whatever data the new tab needs — either add it to `getEmailsPageData`'s return shape
   (if it belongs in the shared cached read, gated by a new param the way `includeTemplates`
   gates the templates-only queries) or call a new sibling fetcher from `emails-data.ts`, awaited
   in the same top-of-function block as `getEmailsPageData` (lines 159–173) alongside the
   existing destructure.
5. Add the tab-body gate: `{activeTab === "<newkey>" && <permission> ? (<NewTab .../>) : null}`,
   placed in the JSX in the same position as the existing three gates (lines 302–331), reusing
   the `AdminPageHeader` / `TabStrip` wrapper already rendered above them (lines 293–300) — do
   not duplicate that wrapper.
6. If the new tab needs a resend-like form, add it as its own component file (sibling to
   `ReminderResendForm.tsx`, per item 6's note), imported and rendered inside the new tab's own
   row component — not inside `ReminderResendForm.tsx` itself.

---

## 8. Audit-row write in the cron route — `src/app/api/cron/review-emails/route.ts`, lines 131–140

Verbatim, including `after_state`:

```ts
        const auditResult = await supabase.from("audit_logs").insert({
          action_type: "review_email_sent",
          target_type: "bookings",
          target_id: candidate.id,
          after_state: {
            booking_id: candidate.id,
            automated: true,
            cron_trigger: "review-emails-15min",
          },
        });
        if (auditResult.error) {
          Sentry.captureException(auditResult.error);
        }
```

Context — this sits inside the `for (const candidate of candidates ?? [])` loop (lines 123–158),
directly after `if (result.sent) { summary.sent++; ... }` (lines 126–128), so the audit row is
written only on the branch where `sendReviewRequestEmail` actually reports `{ sent: true }`.
Compare with `manual_booking_reminder_sent`'s write in item 3 above: this cron path has no
`actor_staff_id` field (there is no staff actor — `automated: true` is the disambiguator inside
`after_state` instead) and it does not `.catch()` the insert — it checks `auditResult.error` and
reports to Sentry, rather than swallowing.

---

## 9. `ACTIONS['manual_booking_reminder_sent']` — `src/app/admin/audit/format.ts`, line 86

Verbatim:
```ts
  manual_booking_reminder_sent: { phrase: "sent a booking reminder", family: "operations_and_email", chip: "pending" },
```

Map's value shape (`ActionEntry`, lines 16–20):
```ts
interface ActionEntry {
  phrase: string;
  family: ActionFamily;
  chip: ChipTone;
}
```
`family` is one of the 8 `ActionFamily` string-literal values (lines 4–12); `chip` is one of
`ChipTone` (line 14): `"confirmed" | "pending" | "cancelled" | "restricted" | "none"`.

Generic fallback when an `action_type` is absent from the map — `describeAction` (lines 100–110):
```ts
export function describeAction(actionType: string): ActionEntry {
  const known = ACTIONS[actionType];
  if (known) return known;
  // Defensive fallback for action types added between brief and runtime.
  // Renders the raw label without underscores so the UI stays legible.
  return {
    phrase: actionType.replace(/_/g, " "),
    family: "operations_and_email",
    chip: "none",
  };
}
```
So a new `action_type` the implementer introduces for item 1's manual-send action does not
strictly require a map entry to render — `describeAction` falls back to
`actionType.replace(/_/g, " ")` as the phrase, `family: "operations_and_email"`, `chip: "none"` —
but skipping the entry means the audit timeline shows an un-curated phrase and no colored chip,
and it is excluded from `ACTION_TYPES_BY_FAMILY`'s family-filter list (lines 115–130, built by
iterating `Object.entries(ACTIONS)` — an action type absent from the map contributes to no
family's filter bucket, so it would never surface when a user filters the audit log by "Operations
& email").
