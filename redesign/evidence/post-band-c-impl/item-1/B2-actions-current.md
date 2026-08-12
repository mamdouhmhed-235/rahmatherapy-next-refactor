# B2 — `src/app/admin/emails/actions.ts` current-state evidence (Item 1 Batch B)

Read in full (365 lines, `wc -l` confirmed) on HEAD 530d154, tree dirty only at
` M src/lib/maintenance.ts` (untouched by this session). All line numbers below
are what I actually read just now, not copied from any plan.

## 1. Full current export list + import block (verbatim)

Exports (grepped `^export` — 3 hits, nothing else exported):

```
31:export async function sendManualBookingReminder(formData: FormData) {
103:export interface ResendEmailResult {
120:export async function resendEmail(formData: FormData): Promise<ResendEmailResult> {
```

`dispatchResend` (line 298) and `canManageEmails` (line 25) are **not** exported —
both are file-local helpers.

Import block, verbatim (lines 1–23):

```ts
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
```

Note: `sendReviewRequestEmail` (the function a manual review-request send would
actually need) is **not currently imported** — it exists in
`@/lib/email/notifications.ts` but this file doesn't pull it in yet (see §5/§7 below).

## 2. Symbol locations — plan claims vs verified reality

| Symbol | Plan claim | Verified actual | Drift |
|---|---|---|---|
| `resendEmail` | `:120` | **line 120** (`export async function resendEmail(formData: FormData): Promise<ResendEmailResult> {`) | **none** |
| H11 scope check inside `resendEmail` | `:159-201` | **lines 159–201** (comment opens 159, `if (!canSeeAllBookings) { … }` closes 201) | **none** |
| `RESEND_RATE_LIMIT_SECONDS` | `:101` | **line 101** (`const RESEND_RATE_LIMIT_SECONDS = 60;`) | **none** |
| `sendManualBookingReminder` | not stated in the 3 claims given, but derivable | **lines 31–97** | n/a |
| `dispatchResend` | not stated | **lines 298–365** (to EOF) | n/a |
| `canManageEmails` | not stated | **lines 25–29** | n/a |

**All three explicitly-flagged plan claims verify correct.** This breaks the
run of prior-session failures — worth flagging to the orchestrator explicitly
rather than silently confirming, since the task brief primed me to expect
another drift.

## 3. `resendEmail`'s H11 middle-path scope check, verbatim (lines 159–201)

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

`sendManualBookingReminder` has the same idiom at lines 48–67, but built off a
`booking_id` taken straight from `formData` (not from a fetched row), and it
returns `undefined` (bare `return;`) on refusal instead of an `{ ok, error }`
object.

## 4. `RESEND_RATE_LIMIT_SECONDS` recent-send check, verbatim (lines 203–228)

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

**Tuple it keys on:** `(event_type, recipient_email, booking_id, created_at >= cutoff)`
against the `email_delivery_events` table, where `event_type`/`recipient_email`/
`booking_id` all come from `original` — the row fetched earlier in `resendEmail`
by `deliveryEventId` (lines 136–146). It is a "was this exact row already
resent in the last 60s" check, not a general dedupe.

**Is it reusable as-is for a review-request send? No, not verbatim.** A manual
review-request send has no `delivery_event_id` / `original` row to seed
`event_type` and `recipient_email` from — there's nothing to resend, it's a
fresh send keyed off a `booking_id` from the new form. To reuse this *pattern*
for a review-request send you'd need to:
- hard-code `event_type = "review_request_client"` (the literal used at
  `src/lib/email/notifications.ts:1598` inside `sendReviewRequestEmail`), and
- derive `recipient_email` by first fetching the booking, exactly as
  `sendReviewRequestEmail` itself already does internally: `booking.contact_email
  || booking.clients?.email` (`src/lib/email/notifications.ts:1544`, inside the
  function body, not something the caller passes in).

Also worth noting as fact, not recommendation: `sendReviewRequestEmail` already
has its own idempotency guard independent of this rate-limit pattern — the
`review_email_sent_at` sentinel on `bookings`, written with
`.is("review_email_sent_at", null)` (notifications.ts:1615–1621) to survive a
parallel cron tick. So a 60-second rate-limit copy may be solving a problem
`sendReviewRequestEmail` already half-solves differently (booking-level
one-shot sentinel vs. this file's tuple-based cooldown window) — worth a design
decision, not something I'm resolving here.

## 5. `recordOperationalEvent`'s real signature

File: `src/lib/ops/operational-events.ts`, lines 6–25 (whole function). Full
text:

```ts
// SERVER ONLY - stores safe operational summaries, never raw payloads.
import type { SupabaseClient } from "@supabase/supabase-js";

type OperationalSeverity = "info" | "warning" | "error";

export async function recordOperationalEvent(
  supabase: SupabaseClient,
  input: {
    eventType: string;
    summary: string;
    severity?: OperationalSeverity;
    bookingId?: string | null;
    staffId?: string | null;
    safeContext?: Record<string, string | number | boolean | null>;
  }
) {
  await supabase.from("operational_events").insert({
    event_type: input.eventType,
    severity: input.severity ?? "warning",
    summary: input.summary.slice(0, 500),
    booking_id: input.bookingId ?? null,
    staff_id: input.staffId ?? null,
    safe_context: input.safeContext ?? {},
  });
}
```

`eventType` is typed as plain `string` — **not** a union/enum. Nothing at the
type level constrains the literal.

Every `eventType:` literal in `src/` (grepped `eventType:\s*["']`, 20 hits total
across 5 files):

| File | Line | Literal |
|---|---|---|
| `src/lib/email/notifications.ts` | 462 | `failed_email_send` |
| `src/lib/email/notifications.ts` | 648 | `booking_confirmation` |
| `src/lib/email/notifications.ts` | 663 | `admin_booking_notification` |
| `src/lib/email/notifications.ts` | 726 | `booking_cancellation_customer` |
| `src/lib/email/notifications.ts` | 742 | `booking_cancellation_admin` |
| `src/lib/email/notifications.ts` | 790 | `booking_restored_client` |
| `src/lib/email/notifications.ts` | 855 | `recurring_series_created_client` |
| `src/lib/email/notifications.ts` | 922 | `recurring_series_cancelled_client` |
| `src/lib/email/notifications.ts` | 972 | `booking_reschedule_request_admin` |
| `src/lib/email/notifications.ts` | 1000 | `staff_assignment` |
| `src/lib/email/notifications.ts` | 1030 | `staff_booking_change` |
| `src/lib/email/notifications.ts` | 1063 | `booking_reminder` |
| `src/lib/email/notifications.ts` | 1098 | `booking_confirmed_client` |
| `src/lib/email/notifications.ts` | 1142 | `staff_unassignment` |
| `src/lib/email/notifications.ts` | 1198 | `claim` |
| `src/lib/email/notifications.ts` | 1246 | `client_assigned_therapist` |
| `src/lib/email/notifications.ts` | 1327 | `enquiry_logged` |
| `src/lib/email/notifications.ts` | 1598 | `review_request_client` |
| `src/app/api/cron/scheduled-emails/route.ts` | 164 | `failed_email_send` |
| `src/app/booking/manage/actions.ts` | 71, 122, 204 | `failed_customer_manage_action` |
| `src/app/api/bookings/route.ts` | 135, 151 | `failed_booking_creation` |
| `src/app/admin/emails/actions.ts` | 57, 80 | `failed_reminder_attempt` |
| `src/app/admin/emails/actions.ts` | 184 | `failed_resend_attempt` |

(`src/app/admin/operations/__tests__/operations-data.test.ts` also has two
`eventType:` hits, but that's an unrelated column-filter object on
`getOperationsPageData`, not a `recordOperationalEvent` call — not counted
above as a real literal.)

**Convention observed:** most of these are the `sendTrackedEmail`/delivery
`event_type` values (booking_confirmation, staff_assignment, etc. — what gets
written to `email_delivery_events.event_type`, reused as the *label*, not a
failure marker). The actual **failure-event** naming convention, scoped to
this file's neighbourhood, is `failed_<feature>_attempt`:
`failed_reminder_attempt` (this file, for the reminder action) and
`failed_resend_attempt` (this file, for the resend action) sit right next to
each other. Elsewhere it's `failed_<feature>` without `_attempt`
(`failed_email_send`, `failed_booking_creation`,
`failed_customer_manage_action`) — so the convention isn't perfectly uniform
codebase-wide, but *within this file specifically* both existing failure
events use the `failed_<feature>_attempt` shape. A new review-send failure
event staying consistent with this file's own two siblings would be
`failed_review_attempt` or `failed_review_request_attempt` — not
`failed_resend_attempt` (that name is resend-specific and already means
something else: an out-of-scope resend attempt).

## 6. Is `eventType` constrained by a DB CHECK or TS enum?

**No CHECK constraint on `event_type`.** Grepped all 5 migrations that mention
`operational_events`
(`20260521160000_create_notification_state.sql`,
`20260509143000_granular_rbac_consolidation.sql`,
`20260503220000_phase8_operational_visibility.sql`,
`20260503231000_phase9_revoke_operational_event_auth_writes.sql`,
`20260504091000_phase10_e2e_cleanup_service_grants.sql`) for `CHECK` — only
hits are on `severity` and `status`, not `event_type`. The table definition
(`20260503220000_phase8_operational_visibility.sql`, lines 10–27), verbatim:

```sql
create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'error')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  summary text not null,
  safe_context jsonb not null default '{}'::jsonb,
  booking_id uuid references public.bookings(id) on delete set null,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`event_type text not null` — any non-null string is accepted at the DB layer.
No TS enum either (§5: typed as plain `string`). **A brand-new `eventType`
literal cannot fail at runtime from a CHECK violation** — the naming-convention
risk in §5 is a code-quality/consistency concern, not a correctness/runtime-
failure one. (I state this because the task brief specifically flagged it as
something that "matters" and could "fail at runtime only" — verified that
particular risk does not apply here.)

## 7. Return-shape convention: which to mirror

- `sendManualBookingReminder` (lines 31–97): returns nothing — every early
  exit is a bare `return;` (lines 35, 39, 65, 90), and the happy path falls
  off the end of the function after the `revalidatePath` calls. Its own
  caller, `ReminderResendForm.tsx`, documents this as a known wart it has to
  work around (verbatim, `src/app/admin/emails/ReminderResendForm.tsx:21-26`):
  > `sendManualBookingReminder` (untouchable per RECON §5) returns void on
  > both success and failure paths. The client can't distinguish them from the
  > returned value alone, so the optimistic state below treats action
  > completion as success unless the action throws.
  The component marks its own catch branch `FAKE-FAILURE-PATH` because the
  action never actually throws — it swallows errors into
  `recordOperationalEvent` and returns void regardless.

- `resendEmail` (lines 120–289) returns `Promise<ResendEmailResult>` where
  (lines 103–107):
  ```ts
  export interface ResendEmailResult {
    ok: boolean;
    newEventId?: string;
    error?: string;
  }
  ```
  Its consumer, `ResendButton.tsx` (lines 32–50), does exactly
  `if (!result.ok) { toast.error(result.error ?? "Resend failed."); ... } else
  { toast.success(...) }` — a direct, non-hacky read of the return value.

**The new `sendManualReviewRequest` action should mirror `resendEmail`'s
`{ ok, error }` shape**, not `sendManualBookingReminder`'s void. The task's own
framing — "the new UI is a form component that wants to toast success/failure"
— is precisely the `ResendButton.tsx` pattern, and `ReminderResendForm.tsx`'s
own inline comments treat the void-return contract as a legacy wart it has to
paper over with a `FAKE-FAILURE-PATH`, not a pattern to replicate. Also worth
noting: `sendReviewRequestEmail` (the function that would actually be called)
already returns a structured `{ sent: boolean; reason?: ... }` — see §... below
— which maps naturally onto `{ ok, error }` at the action boundary rather than
being swallowed into a void return.

## 8. Module-level directives + revalidate/updateTag idiom

**Module-level directive:** exactly one, `"use server";` at line 1 — the only
directive in the file. No `import "server-only"` anywhere in this file.

**End-of-action idiom, `sendManualBookingReminder`** (lines 93–96):
```ts
  updateTag(TAGS.EMAILS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/emails");
  revalidatePath("/admin/dashboard");
```

**End-of-action idiom, `resendEmail`** (lines 285–288):
```ts
  updateTag(TAGS.EMAILS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/emails");
  return { ok: true, newEventId: newest?.id };
```

Both call `updateTag(TAGS.EMAILS)` then `updateTag(TAGS.AUDIT)`, then
`revalidatePath("/admin/emails")`. Only `sendManualBookingReminder` additionally
revalidates `/admin/dashboard`; `resendEmail` doesn't. Tag constants
(`src/lib/cache/tag-taxonomy.ts:21-22`, verbatim): `AUDIT: "audit"`,
`EMAILS: "emails"`.

## Extra finding, in scope of "derive from the current file" but outside the
## 8 numbered questions — flagging because it's load-bearing for Batch B

`src/lib/email/notifications.ts` already exports a fully-built
`sendReviewRequestEmail(bookingId, supabase, options)` (lines 1518–1630,
JSDoc at 1499–1517) — **not currently imported into `actions.ts`**. Its doc
comment (verbatim, lines 1513–1516):

> `ignoreClientCooldown` is for the manual admin send only: a human choosing
> to ask this client now overrides the frequency heuristic. It does NOT
> bypass the per-booking `review_email_sent_at` sentinel — one review request
> per booking, always.

Signature (lines 1518–1525):
```ts
export async function sendReviewRequestEmail(
  bookingId: string,
  supabase: SupabaseClient,
  options: { ignoreClientCooldown?: boolean } = {}
): Promise<{
  sent: boolean;
  reason?: "no_email" | "already_sent" | "send_failed" | "client_recently_asked";
}>
```

This function was evidently already written with the manual admin send in
mind (`ignoreClientCooldown` has no other caller in the codebase as of this
read — not verified exhaustively here, out of this file's scope, but the
JSDoc names this exact use case explicitly). A new `sendManualReviewRequest`
action in `actions.ts` most plausibly wraps this function (auth check → call
`sendReviewRequestEmail(bookingId, adminClient, { ignoreClientCooldown: true
})` → map `{ sent, reason }` onto `{ ok, error }` → audit log → updateTag/
revalidatePath), the same shape as `resendEmail` wrapping `dispatchResend`.
I'm flagging this as a fact discovered while reading the neighbourhood, not
asserting it as the implementation plan — that decision is out of this
derivation task's scope.

## Open questions / not verified in this pass

- Whether any *other* file in the repo (outside `src/`, or generated types)
  constrains `event_type` — I only grepped `src/` and `supabase/migrations/`
  as instructed. Supabase generated TS types (if any exist) were not checked.
- Whether `ignoreClientCooldown` truly has zero other callers — I did not run
  an exhaustive repo-wide grep for `sendReviewRequestEmail(` call sites; that
  is `notifications.ts` territory, outside "YOUR AREA" for this task.
- The exact form-field name(s) the new `/admin/emails` tab's UI would submit
  (e.g. `booking_id`) — not derivable from `actions.ts` alone; that's a UI
  file this task didn't touch.
