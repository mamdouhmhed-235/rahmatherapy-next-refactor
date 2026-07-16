# C-04a — Cancellation restore + delayed-email infra + row-level affordances + auto-promote + hygiene tail

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Amended:** 2026-07-16 — S7 refinement (user direction): 28-day restore window. Cancelled bookings are restorable only within 28 days of cancellation; new `bookings.cancelled_at` column (admin paths stamp it; customer path already has `customer_cancelled_at` — guard reads the coalesce). See §1.11, §2.1 S7, §5.12, §6.
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q8 + Q10 + §3 C-04a (locked scope)
- `redesign/audits/C-A/W04-cancellation-and-restore-flow.md` §1+§2+§3 (B-120, B-121, B-122 — restore-path gaps)
- `redesign/audits/C-A/W03-booking-lifecycle-flow.md` §2 (B-117 no-show quick action + B-118 same notification gap)
- `redesign/audits/C-A/W09-refund-payment-correction-flow.md` §2 (B-143 dead vocab + B-148 reports correctness — hygiene tail)
- `redesign/audits/C-A/R04-therapist-day.md` §3 (B-168 auto-promote pattern)
- `redesign/audits/C-A/04-bookings-detail-audit.md` (next-action strip; Status form layout)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md`
- Progress: `redesign/per-page-progress/C-04a-cancellation-restore-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-04a fixes the booking lifecycle's restore path and is **load-bearing for C-05** (which locks cancelled/no_show inert — admins must have a restore path before lockdown lands). Fourteen targeted changes:

1. **Explicit Restore button** on `/admin/bookings/[id]` next-action strip — replaces the current "Restore from audit log" UX lie (B-121). Hidden when `now() > booking_date + start_time` (past-datetime guard — see §2.1 S6 refinement).
2. **`restoreBooking` server action** — separates restore semantics from the generic `updateBookingManagement` status dropdown (cleaner audit + email + cache invalidation contract). Server-side past-datetime reject.
3. **`sendBookingRestoredClientEmail`** — currently restore is silent to the client; they hear cancellation then nothing (B-120).
4. **State-machine guard** — block `completed → pending/confirmed` without an explicit force flag + audit reason (B-122). Defensive; surfaced via confirm modal.
5. **`no_show` quick action** — extend `quickUpdateBooking` so admins don't have to open the full Status form for a common day-of scenario (B-117).
6. **Assigned-practitioner auto-promote** — when ALL assignments on a booking are marked `completed`, auto-flip `booking.status` to `completed` (B-168). Capability-keyed naming per C-B-DECISIONS Q10 (renamed from "therapist auto-promote").
7. **New audit-log action_type `booking_restored`** — first-class forensic row, not buried under `booking_management_updated`.
8. **New email_event_type `booking_restored_client`** — first-class delivery-log entry.
9. **Hygiene tail:** remove dead `refunded` + `waived` payment-status filter UI references (B-143) and apply the one-char `||` → `??` fix in `reporting.ts:438` (B-148 — explicit exception to RECON §5 untouchable, approved per C-B-DECISIONS Q8).
10. **Row-level Restore action** on `/admin/bookings` list — extend `BookingRowAction` union with `"restore"`, render conditional on `booking.status === 'cancelled'`. Pairs with C-05's filter-correctness fix (N1) which makes cancelled rows visible in the list to begin with.
11. **`quickUpdateBooking` gains `restore` case** — server endpoint for the row-level affordance + symmetric with existing `cancel` quick action. Wraps `restoreBooking` semantics.
12. **Status-aware row menu** — when `booking.status === 'cancelled'`, the `BookingRowActions` menu surfaces **only Restore**, hiding Cancel / Confirm / Mark paid / Complete / Send reminder. Defense-in-depth for C-05's lockdown at the list-action layer.
13. **Delayed-email infrastructure** — new `email_delivery_events.scheduled_for timestamptz` column (Zone-2 migration) + new Cloudflare Worker cron route `/api/cron/scheduled-emails` at `* * * * *` polling queued sends. Independent from C-01's `*/15` review-emails cron (different mechanism — scheduled-time vs status-trigger).
14. **Cancel + Undo toast** — after a cancel succeeds, the success toast surfaces an "Undo" button for 10 seconds. The cancellation email is queued via the Change 13 infra with `scheduled_for = now() + 10s`. Undo within the window cancels the queued email and restores the booking silently — client never sees a round trip. Worst-case actual email delay 10–70s (cron cadence) which is invisible to the user.

**Refinements folded into existing changes:**

- **(S3) Change 2 modal copy:** the Restore confirm modal surfaces the prior `customer_cancellation_note` (or admin cancel reason from audit log) so the admin sees what they're undoing.
- **(S6) Change 1 + Change 2 past-datetime guard:** restore is disallowed when `now() > booking.booking_date + booking.start_time`. UI hides the Restore button (detail strip + row menu); server action returns structured error `"This booking's appointment time has already passed and cannot be restored."` if invoked anyway. **Stricter than C-05's lockdown** (which uses date-only `booking_date < today`) — intentional: a booking whose moment has truly passed shouldn't be resurrected. See §5.8.
- **(S7 — amendment 2026-07-16) 28-day restore window:** a cancelled booking is restorable only within **28 days of the cancellation moment** (`RESTORE_WINDOW_DAYS = 28`, tunable code constant). Second cutoff alongside S6 — S6 bounds by the *appointment* moment, S7 by the *cancellation* moment; both must pass. Bites the case S6 misses: booked far ahead, cancelled early, sitting restorable for weeks. New `bookings.cancelled_at` column (Zone-2 migration addition); guard reads `cancelled_at ?? customer_cancelled_at`; unknown cancellation time counts as **expired** (fail-closed). UI hides Restore; server rejects with `"This booking was cancelled more than 28 days ago and can no longer be restored."`. Completed-reopen is deliberately NOT windowed (mistake-correction path with its own force + reason friction). See §1.11, §2.1 S7, §5.12.

Net effect: an admin can restore a mistakenly cancelled booking with one click from either the detail page or directly from the list row; cancelled-by-mistake errors carry a 10s undo window during which no email is sent at all; the client is informed cleanly when the restore lands legitimately; the audit log is honest; the booking's lifecycle reaches `completed` automatically when practitioners do their job; bookings whose appointment time has passed — or whose cancellation is older than 28 days — are inert at the restore layer; and the codebase no longer carries dead payment-status references.

**Sequencing constraint:** C-04a MUST ship before or with C-05 (Restore is what makes the lockdown survivable). The Change 13 cron infrastructure is independent from C-01's review-emails cron — both can ship in any order.

---

## 1 — Why this plan exists

### 1.1 The "Restore from audit log" UX lie (B-121)

`bookings/[bookingId]/page.tsx:1164-1171` returns a `NextAction` for cancelled bookings:

```ts
if (booking.status === "cancelled") {
  return {
    tone: "danger",
    icon: ShieldX,
    headline: "This booking is cancelled.",
    hint: "Restore it from the audit log if it was cancelled by mistake.",
  };
}
```

The audit log is **read-only** (per C-A.1 #04 V-12). A new admin clicks "Audit log" expecting a Restore button — finds nothing actionable. The actual restore mechanism is hidden inside the multi-field Status & payment form at the bottom of the page: change the status dropdown from `cancelled` to `confirmed`, click Save. **The hint never mentions this.** Discoverability is broken.

### 1.2 Silent restore (B-120)

`updateBookingManagement` (`actions.ts:213-227`) only fires the cancellation broadcast when `before.status !== "cancelled" && after.status === "cancelled"` (transitions TO cancelled). A restore (transition FROM cancelled) falls through to `sendAssignedStaffBookingChangeEmails` — **assigned staff get an email; the client gets nothing**. Real failure: client books → confirmation email → cancellation email → silence → no-show on Saturday.

### 1.3 No state-machine guard (B-122)

`updateBookingManagement` accepts any value from `BOOKING_STATUSES`. A completed-and-billed booking can be reverted to `pending` with no business-rule guard. Combined with W03-E-3 (no idempotency on the C-01 review email yet — that's C-01's problem), bookings can ricochet between states. C-04a adds the defensive guard.

### 1.4 No "Mark no-show" quick action (B-117)

`quickUpdateBooking` (`actions.ts:367-447`) handles `confirm | mark_paid | cancel | complete`. `no_show` is in `BOOKING_STATUSES` (line 38-44) but has no shortcut. Day-of-appointment workflow — therapist arrives, client doesn't show, therapist tells admin — admin has to open the full Status form. Friction at the worst moment.

### 1.5 Assignment-vs-booking semantic gap (B-168)

`updateOwnAssignmentStatus` (`actions.ts:564-625`) lets a practitioner mark their own assignment `completed`. The booking-level `status` doesn't move. An admin has to come along later and manually run `quickUpdateBooking` action=`complete`. The practitioner's mental model says "I completed it"; the system says "your row is done but the parent booking is still confirmed". W05 B-129 documented the gap; R04 B-168 elevated it to a workflow blocker. Auto-promote fixes it: when ALL assignments on a booking are `completed`, flip `booking.status` to `completed` in the same transaction.

### 1.6 Dead payment-status vocabulary (B-143)

`PAYMENT_STATUSES = ["paid", "unpaid"]` (`actions.ts:45`) is the canonical 2-value enum. But four surfaces reference 4 values:

- `reports-helpers.ts:32-33` — `PAYMENT_OPTIONS` includes `refunded` + `waived`.
- `clients/page.tsx:155` — `hasRefund` helper checks `payment_status === "refunded"`.
- `clients/page.tsx:300-303` — `payment === "refund_issued"` filter option uses `hasRefund`.
- `reports/__tests__/reports-helpers.test.ts:47-52` — test description "covers the 4 real payment statuses".

C-04b (refund modal) was DROPPED per C-B-DECISIONS Q8 because payment is in-person (no in-app refund tracking). So the four dead references are just clutter — admins clicking "Refunded" or "Waived" filters will always see zero results. Remove them.

### 1.7 Reports overstatement (B-148)

`reporting.ts:438`: `completedRevenue += amount(booking.amount_paid || booking.total_price)`.

`||` falls through on `0` — so a completed booking with `amount_paid = 0` (was refunded out-of-band) still counts at `total_price`. **Reports overstate collected revenue.** The one-char fix is `??` (nullish-coalescing — falls through only on `null`/`undefined`).

`reporting.ts` is RECON §5 untouchable for **core exports**. C-B-DECISIONS Q8 explicitly approves this exception: a one-line correctness fix to `summarizeReports` (a non-core helper). The change is subtractive of behaviour (lower revenue numbers), but tax-compliance-correct.

### 1.8 No row-level Restore affordance (amendment 2026-05-26)

Once C-05's filter-correctness fix (N1) lands and cancelled bookings appear in the list under the Cancelled filter / Cancelled-No-show tab, admins still have to click into the detail page to find the Restore button. The row-level Cancel action already exists (`BookingRowActions.tsx:17-22` — `cancel` is one of the five `BookingRowAction` union members). The cancel ↔ restore symmetry is broken: restoring is one extra hop. The fix lifts the restore primitive (Change 1) into the row-action surface via Change 10 (BookingRowAction union extension) + Change 11 (`quickUpdateBooking` gains `restore`) + Change 12 (status-aware menu — when `status='cancelled'`, only Restore is shown).

This pairs with the user's "ease and accessibility" framing — once a cancelled booking is discoverable in the list, restoring it should match the discoverability of cancelling it.

### 1.9 No "undo last cancel" path (amendment 2026-05-26)

`quickUpdateBooking` action=`cancel` fires the cancellation email immediately on commit (`actions.ts:367-447`, downstream to `sendBookingCancellationEmails` at `notifications.ts:385`). There's no window during which a misclick or hasty cancel can be reverted without the client receiving — and then needing a counter-email about — the round trip.

Real failure mode: admin clicks Cancel on the wrong row in a busy list view. The client receives the cancellation email within seconds. By the time the admin realises and restores, the client is already messaging asking what happened. Per the user's "ease" requirement, the cancel button should support an undo window where no email leaves the system.

The fix (Change 13 + Change 14) introduces a delayed-email infrastructure (`email_delivery_events.scheduled_for` + `* * * * *` cron) which makes the cancellation email's send deferred by 10 seconds; the success toast offers an "Undo" affordance during that window; undo cancels the queued email and reverts the status silently.

The infrastructure is generic — future plans needing a deferred-send pattern can reuse it (potential C-12+ unification with C-01's status-trigger model).

### 1.10 Past-datetime cancelled-bookings restore gap (amendment 2026-05-26)

The original Change 1 + Change 2 spec accepts restore on any `cancelled` or `no_show` booking regardless of when the booking was scheduled. A cancelled booking whose appointment time has already passed (e.g., cancelled before a 14:00 visit, viewed at 16:00) was restorable by the original spec — which would put the booking back into `confirmed` for a moment that no longer exists, send the client a "your booking is back on" email about an appointment they can't attend, and pollute the active-booking working set.

Per user direction (S6): if `now() > booking.booking_date + booking.start_time` the booking is not restorable. UI: Restore button hidden (both detail-page next-action strip and the new row-level menu); confirm modal not reachable. Server: `restoreBooking` rejects with structured error if invoked directly. This is **intentionally stricter than C-05's lockdown** (which uses date-only `booking_date < today` — so today's morning bookings viewed in the afternoon are still considered active per C-05 but **not restorable** per the C-04a guard). The two precisions coexist for different purposes.

---

### 1.11 Unbounded restore window (amendment 2026-07-16)

As specced pre-amendment, a cancelled booking with a future appointment stayed restorable indefinitely up to its appointment moment (S6). User direction 2026-07-16: restoring a cancellation after weeks makes no operational sense — the slot has moved on, the client's intent is stale. A **28-day window from the cancellation moment** closes it. Audit fact motivating the schema addition: admin-initiated cancels stamp NO timestamp on the booking row (`customer_cancelled_at` is customer-flow-only; the audit log alone records admin cancels) — so the window requires a unified `bookings.cancelled_at`.

## 2 — Scope (lifted from C-B-DECISIONS §3 C-04a + amendment 2026-05-26)

C-04a ships 14 changes. The plan groups them into 8 phases (A–H).

### 2.1 The restore primitive (changes 1-3)

**Change 1 — New server action `restoreBooking`.** In `src/app/admin/bookings/actions.ts`:

```ts
export async function restoreBooking(formData: FormData): Promise<BookingUpdateState> {
  // 1. RBAC: requireBookingManager + canManageAllBookings
  // 2. Parse formData: booking_id (required), target_status ('confirmed' | 'pending'),
  //    force_completed (boolean, default false), reason (string, optional)
  // 3. SELECT current booking. Reject if booking not found OR status NOT IN
  //    ('cancelled', 'no_show', 'completed'). Restore only applies to inert states.
  // 3.5 Past-datetime guard (S6 amendment): if now() > (booking.booking_date + booking.start_time)
  //     reject with { error: "This booking's appointment time has already passed and
  //     cannot be restored." }. Stricter than C-05's date-only lockdown — see §5.8.
  //     Comparison uses Europe/London zoning. UI is expected to hide the Restore button
  //     in this case (Change 2 + Change 10) but the server enforces independently.
  // 3.6 Restore-window guard (S7 amendment 2026-07-16): applies to cancelled sources only.
  //     const cancelledAt = booking.cancelled_at ?? booking.customer_cancelled_at;
  //     if (!cancelledAt || now() - cancelledAt > RESTORE_WINDOW_DAYS * 86_400_000)
  //     reject with { error: "This booking was cancelled more than 28 days ago and can
  //     no longer be restored." }. RESTORE_WINDOW_DAYS = 28 (tunable code constant).
  //     Unknown cancellation time (both fields null — legacy admin cancels) = expired,
  //     fail-closed. no_show sources skip 3.6 (already dead via 3.5 — see §5.12).
  // 4. State-machine guard: if before.status === 'completed' AND !force_completed,
  //    return { error: 'Reopening a completed booking requires confirmation.' }
  //    The UI surfaces a confirm modal that re-submits with force_completed=true.
  //    Deliberately NOT S7-windowed — see §5.12.
  // 5. UPDATE bookings SET status = target_status, customer_cancelled_at = NULL,
  //    customer_cancellation_note = NULL, cancelled_at = NULL (clear stale
  //    cancellation fields on transition out of cancelled — addresses W04 B-125
  //    as a bonus; cancelled_at clearing added by S7)
  // 6. Cancel any queued cancellation email for this booking (Change 13 integration):
  //    UPDATE email_delivery_events SET delivery_status = 'cancelled_by_restore'
  //    WHERE booking_id = $1 AND event_type = 'booking_cancellation_client'
  //      AND delivery_status = 'queued' AND scheduled_for > now()
  //    Returns count; if > 0, the restore was an undo-window operation — set a flag
  //    suppress_restore_email so the client doesn't get a confusing "restored" email
  //    after never receiving the "cancelled" email.
  // 7. Audit log row: action_type='booking_restored', before_state=full row,
  //    after_state={ target_status, force_completed, reason, cleared_customer_cancellation,
  //    cancelled_queued_email: (boolean from step 6) }
  // 8. Fire sendBookingRestoredClientEmail (change 3 below) UNLESS suppress_restore_email is true
  // 9. Fire sendAssignedStaffBookingChangeEmails (existing — staff awareness)
  // 10. Cache invalidation: updateTag('report-data') + updateTag('dashboard-data') +
  //     revalidatePath calls (same as updateBookingManagement)
}
```

**Change 2 — Replace the misleading next-action hint.** In `bookings/[bookingId]/page.tsx:1164-1171`:

```ts
if (booking.status === "cancelled") {
  return {
    tone: "danger",
    icon: ShieldX,
    headline: "This booking is cancelled.",
    hint: "Restore it if it was cancelled by mistake — the client will be notified.",
    action: { kind: "restore_booking", targetStatus: "confirmed", label: "Restore booking" },
  };
}
```

`NextAction` type extended with optional `action?: NextActionTrigger`. New `NextActionTrigger` renders an inline button connected to a `<form action={restoreBooking}>` with hidden inputs. The button uses the existing `cancelled` tone styling for danger consistency or a fresh "success" tone — to be decided during impl (see §9 Q9.1).

Apply the same pattern for `no_show` cancelled-state at line 1174-1180 — also restorable.

**S6 refinement (past-datetime guard):** the `action` field is only emitted when `now() <= booking.booking_date + booking.start_time` (Europe/London). On past-datetime cancelled bookings, the next-action card renders the headline + hint but no Restore button:

```
┌─────────────────────────────────────────────────────────┐
│ 🛡  This booking is cancelled.                          │
│    The appointment time has already passed — restore    │
│    is no longer available. The audit log preserves      │
│    the record.                                          │
└─────────────────────────────────────────────────────────┘
```

Server-side enforcement in Change 1 step 3.5 is the authority; this UI condition is for affordance hygiene.

**S7 refinement (28-day restore window — amendment 2026-07-16):** the `action` field is additionally only emitted when the cancellation is within the window: `(cancelled_at ?? customer_cancelled_at)` non-null AND ≤ 28 days old. Expired-window cancelled bookings render headline + a distinct hint, no button:

```
┌─────────────────────────────────────────────────────────┐
│ 🛡  This booking is cancelled.                          │
│    Cancelled on {date} — the 28-day restore window      │
│    has passed. The audit log preserves the record.      │
└─────────────────────────────────────────────────────────┘
```

**Stamping (S7):** the two admin cancel paths (`quickUpdateBooking` action=`cancel` + `updateBookingManagement` status→cancelled) gain `cancelled_at = now()` in their UPDATE payloads. The customer cancel path (`manage/actions.ts`) is NOT touched — it already stamps `customer_cancelled_at`, which the guard's coalesce covers. Cross-plan: C-02's cancel-series cascade and C-06's delete-client cascade also set cancelled and must stamp `cancelled_at` (one-line notes added to both plans).

**S3 refinement (prior-cancellation reason on the confirm modal):** the Restore confirm modal (`ConfirmActionModal` invocation in the Restore button click handler) is augmented to surface the booking's prior cancellation context. Two sources, in order of priority:

1. `booking.customer_cancellation_note` — if non-null, this was a customer-initiated cancel; display verbatim under a "Customer's note:" label.
2. Otherwise, look up the most recent `audit_logs` row with `target_id = bookingId AND action_type = 'booking_management_updated'` whose `after_state.status = 'cancelled'`. If found, extract the actor name (joined to `staff_profiles`) + the audit row's `created_at` and display "Cancelled by {name} on {date}." Optional `after_state.reason` if the cancel flow captured one (today it does not — flag in §9 Q9.7).

Modal copy with reason injected:

> "Restore this booking?
>
> Previously cancelled by {actor} on {date}.
> Customer's note: "{customer_cancellation_note}" *(if present)*
>
> · Status will change from cancelled to confirmed.
> · The client will be emailed: "your booking is back on".
> · Assigned staff will be notified.
> · Audit log records the restore."
>
> [Cancel] [Restore booking]

**Change 3 — `sendBookingRestoredClientEmail`.** In `src/lib/email/notifications.ts` after `sendBookingCancellationEmails` (line 385):

```ts
export async function sendBookingRestoredClientEmail(
  bookingId: string,
  supabase: SupabaseClient,
  options: { fromStatus: BookingStatus } = { fromStatus: "cancelled" }
) {
  const { booking, settings, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) throw new Error("Booking client has no email address.");

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_restored_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: `${input.companyName} — your booking is back on`,
    html: renderBookingRestoredEmail({ ...input, fromStatus: options.fromStatus }),
    text: renderBookingPlainText("Booking restored", input),
  });
}
```

New template renderer `renderBookingRestoredEmail(input)` in `src/lib/email/templates.ts` — mirrors `renderBookingConfirmationEmail` structure with restoration-specific copy:

> "Good news — your booking with {companyName} on {date} at {time} has been restored. We're sorry for the earlier cancellation; everything is back on. If you have any questions, reply to this email or call {phone}."

`booking_restored_client` added to the email_event_type enum in DB if it's a check-constrained text column (verify in pre-flight; likely not constrained — current event types are convention).

### 2.2 The state-machine guard (change 4)

**Change 4 — Guard `completed → *` transitions in `updateBookingManagement`.**

In `actions.ts:177-193` (payload construction), before the UPDATE:

```ts
if (beforeState.status === "completed" && status !== "completed") {
  const forceFlag = formData.get("force_completed_reversal") === "on";
  const reason = String(formData.get("completed_reversal_reason") ?? "").trim();
  if (!forceFlag || reason.length < 5) {
    return {
      error: "Reopening a completed booking requires confirmation and a reason.",
      fieldErrors: forceFlag ? { completed_reversal_reason: "Provide a reason (min 5 chars)." } : {},
    };
  }
  // Inject reason into audit_log after_state
}
```

UI: the Status & payment form gains a conditional confirm modal — when the admin changes status FROM `completed` TO another value and clicks Save, a `ConfirmActionModal` opens asking for a reason. On confirm, the modal re-submits the form with `force_completed_reversal=on` + `completed_reversal_reason=<text>` injected via hidden inputs.

The same guard applies to `quickUpdateBooking` — but `quickUpdateBooking` doesn't currently expose any "reopen" action, so this is defensive (no UI path triggers it). Add the same precondition for symmetry.

### 2.3 No-show quick action (change 5)

**Change 5 — Extend `quickUpdateBooking` to handle `no_show`.**

In `actions.ts:387-401`:

```ts
const payload =
  action === "confirm" ? { status: "confirmed" as BookingStatus } :
  action === "mark_paid" ? { /* existing */ } :
  action === "cancel" ? { status: "cancelled" as BookingStatus } :
  action === "complete" ? { status: "completed" as BookingStatus } :
  action === "no_show" ? { status: "no_show" as BookingStatus } : null;
```

The audit log type becomes `booking_quick_no_show`. Email behaviour: `no_show` is NOT a customer-facing event — fires `sendAssignedStaffBookingChangeEmails` only. Add a "Mark no-show" button to the next-action strip on `bookings/[bookingId]/page.tsx` for state `confirmed` AND `booking_date <= today`.

Temporal guard (W03-E-2): also reject `complete` AND `no_show` when `booking_date > today` — server-side. Surfaces as `"This booking is in the future. Mark complete after it happens."`

### 2.4 Assigned-practitioner auto-promote (change 6)

**Change 6 — Auto-promote `booking.status` to `completed` when ALL assignments are completed.**

New helper alongside `recomputeBookingAssignmentStatus` (`actions.ts:86-116`):

```ts
async function autoPromoteBookingFromAssignments(
  bookingId: string,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ promoted: boolean; error?: string }> {
  // 1. SELECT all booking_assignments for booking_id
  // 2. SELECT current booking.status
  // 3. If ALL assignments have status='completed' AND none missing assigned_staff_id
  //    AND current booking.status !== 'completed' AND current booking.status !== 'cancelled':
  //      - UPDATE bookings SET status='completed' WHERE id = bookingId AND status NOT IN ('completed','cancelled')
  //        (the WHERE clause prevents the race-condition double-promote)
  //      - INSERT audit_logs: action_type='booking_auto_promoted_completed',
  //        before_state={ status: prevStatus }, after_state={ status: 'completed',
  //        trigger: 'all_assignments_completed' }
  //      - Return { promoted: true }
  // 4. Otherwise return { promoted: false }
}
```

**Call sites** (3 places where an assignment's status changes to `completed`):

1. `updateOwnAssignmentStatus` (line 564-625) — after `recomputeBookingAssignmentStatus`, when the incoming status is `completed`. **The primary path** — therapists self-complete here.
2. `updateBookingAssignment` (admin-side reassignment) — line ~459+. Less common but if admin sets an assignment to `completed`, same hook.
3. Any future admin-side "Mark this assignment complete" action — none today, but add the hook in `recomputeBookingAssignmentStatus`'s caller chain so future paths inherit it.

After the call, if `promoted: true`, **also fire `sendAssignedStaffBookingChangeEmails`** so all assigned staff (including the one who triggered the promote) see the booking-level state change. The client is NOT emailed on auto-promote — auto-promote follows a real visit; the customer already knows.

Capability-keyed naming (C-B-DECISIONS Q10): the helper name uses "assigned-practitioner" not "therapist". The logic is keyed off assignment status, not role — Owner/Admin/Coord with `can_take_bookings=true` who take a booking themselves trigger the same auto-promote.

### 2.5 Audit + email event types (changes 7 + 8)

**Change 7 — New audit log action_type `booking_restored`.**

`audit_logs.action_type` is a free-text column (no CHECK constraint per the schema query in C-06 pre-flight). New action_types are just code-level constants — no migration. Already enumerated in code at the audit-log INSERT call in `restoreBooking` (change 1). Document in `clients/[clientId]/page.tsx:127-138 AUDIT_PHRASING` map for human-readable rendering:

```ts
booking_restored: "Booking restored",
booking_auto_promoted_completed: "Booking auto-completed (all assignments complete)",
booking_quick_no_show: "Marked no-show",
```

**Change 8 — New `email_event_type` value `booking_restored_client`.**

Verify in pre-flight whether `email_delivery_events.event_type` has a CHECK constraint. The 7 active values today are convention-only. If constrained, migration needed (add `booking_restored_client` to the allowed set). If free-text, just code constant.

### 2.6 Hygiene tail (change 9)

**Change 9a — Remove dead `refunded` + `waived` from `reports-helpers.ts:28-34`.**

```ts
export const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any payment" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Outstanding" },
  // Removed: refunded, waived (C-04a — see C-B-DECISIONS Q8)
];
```

**Change 9b — Update test description + assertions** in `reports/__tests__/reports-helpers.test.ts:47-52`. Change "4 real payment statuses" → "2 real payment statuses". Remove `refunded` and `waived` from the test array.

**Change 9c — Remove `hasRefund` helper + `refund_issued` filter option from `clients/page.tsx`.**

- Line 155 (`hasRefund` helper): delete.
- Lines 300-303 (`payment === "refund_issued"` filter logic): remove the conditional.
- Wherever the filter UI renders `refund_issued` as an option: remove.

**Change 9d — Remove `case "refunded":` branch in `clients/[clientId]/page.tsx:318`.**

The case probably maps payment_status to a badge tone. Since `refunded` is unreachable, the branch is dead code.

**Change 9e — `reporting.ts:438` — `||` → `??`.**

```ts
// Before:
completedRevenue += amount(booking.amount_paid || booking.total_price);
// After:
completedRevenue += amount(booking.amount_paid ?? booking.total_price);
```

`reporting.ts` is RECON §5 untouchable for **core exports**. This is **inside `summarizeReports`** which is not in the core-exports list; the fix is approved per C-B-DECISIONS Q8 as a one-char correctness exception. The change is **subtractive of revenue numbers** for any historical booking with `amount_paid=0` AND `status='completed'`. In production today: 0 such rows visible. Risk: low. Reporting calibration may shift slightly in newly-completed bookings if any go through the refund-out-of-band path — and that's the intended behavior (it was a bug).

### 2.7 Row-level affordances + status-aware menu (changes 10-12 — amendment 2026-05-26)

**Change 10 — Extend `BookingRowAction` union with `"restore"`.**

In `src/app/admin/bookings/BookingRowActions.tsx:17-22`:

```ts
export type BookingRowAction =
  | "confirm"
  | "mark_paid"
  | "cancel"
  | "complete"
  | "no_show"   // (from Change 5)
  | "restore"   // NEW
  | "send_reminder";
```

The `runQuickAction` switch (~line 117-155) gains a `restore` case:

```ts
} else if (action === "restore") {
  // S6 guard: short-circuit before server call if past-datetime
  if (isBookingDatePastDatetime(booking)) {
    toast.error("This booking's appointment time has already passed.");
    return;
  }
  // Confirm modal (S3 — surfaces prior cancellation reason)
  const confirmed = await confirmActionModal({
    title: "Restore this booking?",
    body: buildRestoreConfirmBody(booking),  // composes prior cancel reason
    confirmLabel: "Restore booking",
  });
  if (!confirmed) return;
  const result = await quickUpdateBooking(formData);  // action=restore — see Change 11
  if (result.error) {
    toast.error(friendlyError(result.error, "quick"));
    return;
  }
  toast.success("Booking restored. The client has been notified.");
  router.refresh();
}
```

**Change 11 — `quickUpdateBooking` gains `restore` case.**

In `actions.ts:387-401` (action-payload switch). Rather than building a new payload, `restore` delegates to `restoreBooking`:

```ts
if (action === "restore") {
  // Reuse the full restoreBooking semantics — audit log + email + cache + S6 guard
  return restoreBooking(formData);  // formData already has booking_id; target_status defaults to 'confirmed'
}
```

The branch lives before the existing payload-construction switch so the function exits early with the canonical restore behaviour. No duplicate audit log / email side effects.

**Change 12 — Status-aware row menu.**

In `BookingRowActions.tsx`, the menu items become conditional on `booking.status`:

```tsx
{booking.status === "cancelled" || booking.status === "no_show" ? (
  // Locked menu — only Restore visible (or nothing if past-datetime per S6)
  isBookingDatePastDatetime(booking) ? (
    <MenuItem disabled>No actions available (appointment time has passed)</MenuItem>
  ) : (
    <MenuItem onClick={() => runQuickAction("restore")}>
      <RotateCcw aria-hidden="true" /> Restore booking
    </MenuItem>
  )
) : (
  // Active-state menu (current behaviour)
  <>
    {booking.status !== "confirmed" && <MenuItem onClick={() => runQuickAction("confirm")}>Confirm</MenuItem>}
    {booking.payment_status === "unpaid" && <MenuItem onClick={() => runQuickAction("mark_paid")}>Mark paid</MenuItem>}
    <MenuItem onClick={() => runQuickAction("cancel")} tone="destructive">Cancel</MenuItem>
    {/* etc — existing items */}
  </>
)}
```

**Defense-in-depth for C-05's lockdown:** Change 12 hides destructive actions at the menu layer even for cancelled rows that somehow slip through any list-level filter. Combined with C-05's `ensureBookingActive` server-action gate, every layer rejects.

### 2.8 Delayed-email infrastructure + Cancel-with-Undo toast (changes 13-14 — amendment 2026-05-26)

**Change 13 — Delayed-email infrastructure.**

Three coordinated pieces:

**(a) Migration** — extend `email_delivery_events` with two columns:

```sql
ALTER TABLE email_delivery_events
  ADD COLUMN scheduled_for timestamptz,
  ADD COLUMN html_payload text,
  ADD COLUMN text_payload text,
  ADD COLUMN to_email text,
  ADD COLUMN subject text;
-- scheduled_for: NULL = send immediately (current behaviour); set = queued for cron pickup
-- html_payload/text_payload/to_email/subject: store the rendered content so the cron can
--   pick up the row and call Resend without re-rendering. Columns are nullable for existing
--   non-queued rows. Only queued rows populate them.

CREATE INDEX idx_email_delivery_events_scheduled_pending
  ON email_delivery_events (scheduled_for)
  WHERE scheduled_for IS NOT NULL AND delivery_status = 'queued';
```

Zone-2 migration. Existing rows have `scheduled_for = NULL` (preserves immediate-send semantics for everything that's not the cancellation flow).

**Schema check at pre-flight:** verify whether `email_delivery_events` already has any of these column names (likely not). The migration is purely additive.

**(b) Send-fn wrapper** — extend `sendTrackedEmail` in `src/lib/email/notifications.ts` to accept an optional `delaySeconds`:

```ts
export async function sendTrackedEmail(
  supabase: SupabaseClient,
  input: SendTrackedEmailInput & { delaySeconds?: number }
) {
  if (input.delaySeconds && input.delaySeconds > 0) {
    // Queue: write a row with scheduled_for, status='queued', no actual Resend call yet
    const scheduledFor = new Date(Date.now() + input.delaySeconds * 1000).toISOString();
    await supabase.from("email_delivery_events").insert({
      booking_id: input.bookingId,
      event_type: input.eventType,
      recipient_role: input.recipientRole,
      to_email: input.to,
      subject: input.subject,
      html_payload: input.html,
      text_payload: input.text,
      scheduled_for: scheduledFor,
      delivery_status: "queued",
    });
    return { queued: true, scheduledFor };
  }
  // Existing immediate-send path (unchanged)
  // ...
}
```

Storage adds bytes per queued row — acceptable for the low volume (only cancellations go through the delay path; ~1-5 per day max). Successfully-sent rows could optionally `null` out the payload columns post-send to reclaim space; out of C-04a scope.

**(c) Cron route** — new `src/app/api/cron/scheduled-emails/route.ts` modelled on `src/app/api/cron/booking-reminders/route.ts`:

```ts
export async function GET(request: Request) {
  await verifyCronSecret(request);  // existing pattern
  const supabase = createSupabaseAdminClient();

  const { data: queued } = await supabase
    .from("email_delivery_events")
    .select("*")
    .lte("scheduled_for", new Date().toISOString())
    .eq("delivery_status", "queued")
    .limit(50);

  if (!queued?.length) return Response.json({ sent: 0 });

  let sent = 0;
  for (const row of queued) {
    try {
      await resend.emails.send({
        from: senderAddress,
        to: row.to_email,
        subject: row.subject,
        html: row.html_payload,
        text: row.text_payload,
      });
      await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "sent", scheduled_for: null })
        .eq("id", row.id);
      sent++;
    } catch (error) {
      await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "failed" })
        .eq("id", row.id);
    }
  }

  return Response.json({ sent, total: queued.length });
}
```

Register in `worker-entrypoint.ts` cron dispatch + `wrangler.jsonc` cron schedule `* * * * *` (every minute). Worst-case actual email delay from `scheduled_for` to send: 60s (one cron tick). For a 10s undo window, perceived delay is 10–70s from cancel click to email arriving — invisible to the user since they have no expectation about send timing (only the toast offers a 10s undo).

**Change 14 — Cancel-with-Undo toast UX.**

In `BookingRowActions.tsx:runQuickAction` case `cancel` (~line 145-147), wrap the cancel side-effect with the Undo affordance:

```ts
} else if (action === "cancel") {
  // Server-side: bookings.status flips to 'cancelled' immediately;
  // the cancellation email is QUEUED with scheduled_for = now() + 10s.
  const result = await quickUpdateBooking(formData);
  if (result.error) { /* ... */ }
  toast.success("Booking cancelled. The client will be notified in 10 seconds.", {
    action: {
      label: "Undo",
      onClick: async () => {
        const undoFormData = new FormData();
        undoFormData.set("booking_id", bookingId);
        undoFormData.set("action", "restore");
        const undoResult = await quickUpdateBooking(undoFormData);
        if (undoResult.error) {
          toast.error("Couldn't undo: " + friendlyError(undoResult.error, "quick"));
        } else {
          toast.success("Cancellation undone.");  // No "client notified" — the email was never sent
        }
        router.refresh();
      },
    },
    duration: 10_000,  // sonner toast duration matches the email's scheduled_for delay
  });
  router.refresh();
}
```

**Server-side wiring** — `updateBookingManagement` (line 213-227, the existing cancellation broadcast) and `quickUpdateBooking` action=`cancel` both switch from immediate `sendBookingCancellationEmails` to the delayed-queue variant:

```ts
// Inside the cancellation branch of updateBookingManagement / quickUpdateBooking:
if (afterStatus === "cancelled" && beforeStatus !== "cancelled") {
  await sendBookingCancellationEmails(bookingId, adminClient, {
    delaySeconds: 10,  // NEW — queues instead of sending immediately
  });
}
```

`sendBookingCancellationEmails` (`notifications.ts:385`) gains the `options.delaySeconds` parameter, threaded down to `sendTrackedEmail`.

**Customer-side cancel path:** `manage/actions.ts` (the customer-facing cancellation) is **out of scope** for the delay — customer cancels are intentional and shouldn't have an admin-style undo window. They still fire `sendBookingCancellationEmails` immediately (no `delaySeconds`). Change 14 only changes admin-initiated cancels.

**Detail-page Cancel button:** the existing detail-page Status form's "Cancel" path also goes through `updateBookingManagement` — picks up the delay automatically. The form's success toast pattern needs the same Undo affordance treatment as the list-row variant. Coordinate in plan Phase H.

---

## 3 — RBAC matrix (C-04a actions × roles)

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| Restore booking — detail-page button (Change 2) | ✅ | ✅ | ✅ (via `canManageAllBookings`) | ❌ |
| Restore booking — row-level menu (Change 10–12) | ✅ | ✅ | ✅ | ❌ |
| Restore on **past-datetime** cancelled booking (S6) | ❌ blocked (button hidden + server reject) | ❌ | ❌ | ❌ |
| Restore on booking **cancelled >28 days ago** (S7 — 2026-07-16) | ❌ blocked (button hidden + server reject) | ❌ | ❌ | ❌ |
| Undo cancel — 10s toast affordance (Change 14) | ✅ if actor cancelled | ✅ | ✅ | n/a (no cancel rights) |
| `no_show` quick action | ✅ | ✅ | ✅ | ❌ |
| Force-reopen completed booking | ✅ | ✅ | ✅ | ❌ |
| Mark own assignment complete (triggers auto-promote) | ✅ if `can_take_bookings` + assigned | ✅ if `can_take_bookings` + assigned | ✅ if `can_take_bookings` + assigned | ✅ if assigned |
| View next-action strip on cancelled booking | ✅ | ✅ | ✅ | ❌ (predicate fails at detail-page entry) |
| See `Marked no-show` next-action card | ✅ | ✅ | ✅ | ✅ if assigned (read-only) |

Auto-promote is **capability-keyed**, not role-keyed: any practitioner (Owner / Admin / Coord with `can_take_bookings` + Therapist) who completes their assignment can trigger it.

The row-level Restore (Changes 10–12) inherits the detail-page Restore RBAC via `quickUpdateBooking` → `restoreBooking` delegation. No new permission needed.

---

## 4 — Layout strategy

### 4.1 Next-action strip on cancelled booking

Current state (`bookings/[bookingId]/page.tsx:1164-1171`):

```
┌─────────────────────────────────────────────────────────┐
│ 🛡  This booking is cancelled.                          │
│    Restore it from the audit log if it was              │
│    cancelled by mistake.                                │
└─────────────────────────────────────────────────────────┘
```

After C-04a:

```
┌─────────────────────────────────────────────────────────┐
│ 🛡  This booking is cancelled.                          │
│    Restore it if it was cancelled by mistake — the      │
│    client will be notified.                             │
│                                                          │
│                                      [ Restore booking ]│
└─────────────────────────────────────────────────────────┘
```

Restore button styling: `outline` tone (not destructive — restore is a positive action). Confirm-on-click via `ConfirmActionModal`:

> "Restore this booking?
>
> · Status will change from cancelled to confirmed.
> · The client will be emailed: "your booking is back on".
> · Assigned staff will be notified.
> · Audit log records the restore."
>
> [Cancel] [Restore booking]

Same pattern for `no_show` state — Restore button visible with copy "Restore this booking?".

### 4.2 No-show button on confirmed bookings

In the same next-action strip, when state is `confirmed` AND `booking_date <= today`, add a secondary action:

```
┌─────────────────────────────────────────────────────────┐
│ 🕓  Ready to mark complete.                             │
│    The booking starts at 10:00.                         │
│                                                          │
│              [ Mark no-show ]  [ Mark complete ]        │
└─────────────────────────────────────────────────────────┘
```

`Mark no-show` opens a confirm modal:

> "Mark this booking as no-show?
>
> · Status changes to no_show.
> · Recorded for your records and reports.
> · Assigned staff are notified.
> · The client is NOT emailed."
>
> [Cancel] [Mark no-show]

### 4.3 Reopen completed booking — confirm modal

When the Status form's status dropdown is changed from `completed` to anything else and the user clicks Save, `ConfirmActionModal` opens:

> "Reopen this completed booking?
>
> Reopening a completed booking is unusual. The audit log will show why. Provide a brief reason."
>
> ┌──────────────────────────────────────────────────┐
> │ Reason for reopening: ___________________________│
> │ (min 5 chars — e.g. "client returned for retreat")│
> └──────────────────────────────────────────────────┘
>
> [Cancel] [Reopen booking]

On confirm, re-submits the form with `force_completed_reversal=on` + `completed_reversal_reason=<text>` hidden inputs.

### 4.4 Auto-promote silent feedback

Auto-promote happens server-side during `updateOwnAssignmentStatus`. The practitioner sees the assignment update toast as usual. Then on next page load (or via `revalidatePath`), the booking-level status now reads `completed`. A subtle, post-action banner appears on the detail page for 24h via a derived flag from audit log:

```
✓ Auto-completed when all assignments were marked complete · 2 mins ago
```

Located just below the page title, before the panels. Removed naturally after 24h (no DB state — just a `>` comparison on the audit row's `created_at`).

### 4.5 Payment filter UI cleanup (hygiene tail)

Before / after on `/admin/reports` payment filter:

```
Before:           After:
[ Any payment ]   [ Any payment ]
[ Paid ]          [ Paid ]
[ Outstanding ]   [ Outstanding ]
[ Refunded ]      ✗ (removed)
[ Waived ]        ✗ (removed)
```

Same on `/admin/clients` — the `refund_issued` filter option disappears.

No DB migration needed for these — pure UI/code cleanup.

### 4.6 Row-level Restore — list row visual (Changes 10-12, amendment 2026-05-26)

On `/admin/bookings` list rows, once C-05's N1 fix lands and cancelled rows are visible (with strikethrough per C-05's S2 treatment), the row's overflow menu (currently rendered via `BookingRowActions.tsx`) becomes status-aware:

```
Active booking row menu (current):    Cancelled booking row menu (new):
[ ⋯ ]                                  [ ⋯ ]
 ├─ Confirm                             └─ ↺ Restore booking
 ├─ Mark paid
 ├─ Cancel (destructive)
 ├─ Complete                          Past-datetime cancelled row menu:
 ├─ Mark no-show                       [ ⋯ ]
 └─ Send reminder                       └─ (disabled) No actions available
```

The Restore menu item uses the `RotateCcw` icon (lucide-react) and an outline tone (not destructive — restore is recovery). On click, the same `ConfirmActionModal` from §4.1 opens with the §2.1 S3 reason-aware copy.

### 4.7 Cancel-with-Undo toast (Change 14, amendment 2026-05-26)

After an admin-initiated cancel succeeds, the success toast surfaces an Undo button for 10 seconds:

```
┌──────────────────────────────────────────────────────────┐
│ ✓  Booking cancelled. The client will be notified         │
│    in 10 seconds.                                         │
│                                                  [ Undo ] │
└──────────────────────────────────────────────────────────┘
```

Behaviour:
- The toast persists for exactly 10 seconds (sonner `duration: 10_000`).
- During this window, the cancellation email is **queued** (`scheduled_for = now() + 10s`) but not yet sent.
- Clicking Undo within the window calls `quickUpdateBooking` with `action=restore`. `restoreBooking` then UPDATEs the queued email row to `delivery_status = 'cancelled_by_restore'` (Change 1 step 6). No cancel email leaves the system; no restore email is sent either (suppress_restore_email flag — Change 1 step 8).
- If the toast expires without Undo, the cron picks up the queued email at the next tick (60s cadence). Worst-case actual email delay: 10–70s.
- The toast is announced via `aria-live="polite"` (sonner default for `toast.success`) — keyboard users can focus Undo via the toast's focus management.

Toast copy variations:
- Standard: `"Booking cancelled. The client will be notified in 10 seconds."`
- After Undo: `"Cancellation undone."` (no "client notified" — the email never left)
- After 10s passes: no follow-up toast (the user has moved on; the email send is silent)

Detail-page Cancel button (`bookings/[bookingId]/page.tsx` Status form) gets the same Undo treatment. Coordinate the toast invocation in the form's success handler.

---

## 5 — States & edge cases

### 5.1 Restoring a booking with no assigned email

Edge case: `booking.contact_email` and `booking.clients.email` are both null. `sendBookingRestoredClientEmail` throws `"Booking client has no email address."`. The restore itself MUST still succeed (booking status + audit log are the source of truth). Wrap the email send in `try/catch` and log the error — match the pattern of `sendBookingCancellationEmails` invocations elsewhere.

### 5.2 Restoring a cancelled booking whose client has been deleted (C-06 dependency)

If C-06 has already shipped and a client's row has `deleted_at IS NOT NULL`, the restore action should refuse with:

> "This booking's client has been deleted. Restore the client first, then the booking."

Implementation: `restoreBooking` SELECTs `clients.deleted_at` for the booking's client; rejects if non-null. Plan documents this as a forward-looking dependency check; safe to ship even before C-06 lands (the check is null-safe — `deleted_at` column doesn't exist pre-C-06; the SELECT silently coerces).

### 5.3 Restoring a no_show booking

`no_show` is also inert per C-05 lockdown. The Restore button on a `no_show` booking transitions to `confirmed` (or `pending` — admin chooses via a dropdown next to the button if needed). Same email + audit log flow.

### 5.4 Auto-promote race condition (concurrent assignment updates)

Two practitioners marking their assignments complete simultaneously. Both call `updateOwnAssignmentStatus` → both call `autoPromoteBookingFromAssignments`. Without a guard, both could try to UPDATE the booking and one wastes a row.

Mitigation: the UPDATE includes `WHERE id = bookingId AND status NOT IN ('completed','cancelled')`. The second caller's UPDATE affects 0 rows. The helper returns `{ promoted: false }` cleanly. Worst case: two audit rows written (`booking_auto_promoted_completed`) — but the second's WHERE on the audit-insert SELECT also returns 0 rows, so only one audit row is written.

Actually re-reading: the audit INSERT doesn't condition on the UPDATE's rowcount. **Add a check** — only INSERT the audit row if the UPDATE affected ≥ 1 row. Standard idempotency pattern.

### 5.5 State-machine guard bypass via direct SQL

If an Owner manually edits `bookings.status` via Supabase MCP / SQL console, the guard doesn't apply. Acceptable risk — Zone-2 SQL is already gated by the user-confirmation discipline.

### 5.6 Reopening a `completed` booking that already fired the C-01 review email

C-01 isn't shipped yet (planned later in C-B order). When C-01 ships with the `review_email_sent_at` sentinel, reopening a `completed` booking should leave that sentinel alone — so when the booking is re-completed later, the C-01 send-fn's sentinel check correctly blocks a duplicate review email. Document this as a C-01-side concern; C-04a doesn't touch `review_email_sent_at`.

### 5.7 `no_show` for future-dated bookings

Server-side guard rejects: "This booking is in the future. Mark no-show after the appointment time has passed." Same guard applies to `complete`.

### 5.8 Past-datetime restore is disallowed (S6 amendment)

Per user direction, restore is blocked when `now() > booking.booking_date + booking.start_time` (Europe/London zoning). The condition coexists with C-05's date-only lockdown:

| Time scenario | C-05 lockdown (date-only) | C-04a restore (datetime) |
|---|---|---|
| Tomorrow 14:00, currently 10:00 today | Active (date is future) | Restorable |
| Today 14:00, currently 10:00 today | Active (date is today) | Restorable |
| Today 09:00, currently 14:00 today | Active (date is today) | **Not restorable** (datetime passed) |
| Yesterday 14:00, currently 14:00 today | Inert (date is past) | **Not restorable** |

The asymmetry is intentional: C-05 lets practitioners with `can_take_bookings` mark their own assignment complete on today's bookings even after start time has passed (forensic completion edge case — see C-05 §5.1). But the **booking-level** restore is stricter: once the appointment moment is gone, the booking should stay in its terminal state. Auditing past cancellations remains possible (detail page renders read-only).

### 5.9 Undo-window race conditions (Change 14 amendment)

The 10-second window between cancel and email send is the canonical race surface:

- **User clicks Undo at t=9.9s, server commits at t=10.05s.** The `restoreBooking` UPDATE on `email_delivery_events` runs WHERE `delivery_status='queued' AND scheduled_for > now()`. If the cron runs in that gap, the row's status flips to `'sent'` and the UPDATE matches 0 rows. The booking still restores (status flips back to confirmed), but the cancel email already went out. `restoreBooking` returns `cancelled_queued_email: false` in the audit log — caller can detect and surface a clarifying toast: `"Booking restored, but the client got the earlier cancel email — sending a follow-up."` and fire `sendBookingRestoredClientEmail` explicitly. Documented in plan Phase H.
- **Two admins cancel simultaneously.** Both fire queue inserts; one row's `scheduled_for` is earlier than the other by milliseconds. Cron picks up both; both fire. The client gets two cancellation emails. Mitigation: race is extremely unlikely (same booking, two admin sessions) and the side effect is duplicate emails not data loss. Out of C-04a scope.
- **User closes tab during the 10s window.** The toast disappears with the tab; the cancel still commits server-side; the queued email fires on the next cron tick. Correct behaviour (the cancel was intentional from the server's POV).
- **User navigates away (router push) within the 10s window.** Sonner toasts persist across client-side route changes; Undo remains clickable from the new page. Verify during impl. If it doesn't persist, that's acceptable — the toast expired naturally and the email goes out.

### 5.10 Status-aware menu — race with status changes (Change 12 amendment)

If a row's status changes server-side between page load and menu interaction (e.g., another admin cancels the booking while the current admin's list page is open), the menu items are computed at render time from stale data. Click → `quickUpdateBooking` runs → `restoreBooking` rejects with `"Only cancelled, no-show, or completed bookings can be restored."` if the row is now confirmed/pending, or accepts cleanly if it's now cancelled. Either way no data corruption. Acceptable; UX can be improved with realtime later.

### 5.11 Natural cancel-then-restore (not undo window)

User cancels a booking at 10:00, doesn't click Undo. Email fires at 10:01. At 14:00 the same day, user realises they cancelled the wrong booking and clicks Restore via Change 10 / Change 2. The restore proceeds normally:

- `restoreBooking` step 6 finds 0 queued emails (the cancel email already went out and is now `delivery_status='sent'`).
- `suppress_restore_email` stays false.
- The client receives a `booking_restored_client` email (Change 3) — the round-trip is honest: client got cancel email earlier, now gets "your booking is back on".

This is the **canonical happy path for non-undo restore** — preserved from the pre-amendment design. Change 14's Undo path is a parallel codepath, not a replacement.

### 5.12 28-day restore window semantics (S7 — amendment 2026-07-16)

- **Composition with S6:** both guards must pass — appointment moment in the future (S6) AND cancellation ≤ 28 days old (S7). Either failing hides the button and rejects server-side with its own distinct message.
- **Boundary:** strictly more than `28 × 24h` after the cancellation moment = expired. UTC-millisecond arithmetic (no London-zoning subtleties — the window is a duration, not a calendar date).
- **Unknown cancellation time** (`cancelled_at` AND `customer_cancelled_at` both null — possible for legacy admin cancels the backfill can't resolve): treated as **expired**. Fail-closed: if stamping ever regresses, old cancellations lock rather than staying restorable forever.
- **no_show:** S7 is moot — no_show is only markable on past bookings (§5.7), so S6 already blocks all no_show restores. Documented, not guarded twice.
- **Completed-reopen: exempt.** Reopening a completed booking is mistake-correction with its own friction (force flag + typed reason ≥5 chars). Windowing it would block legitimate forensic fixes. User-confirmed 2026-07-16.
- **Undo path (Change 14):** unaffected — undo operates seconds after cancel, always inside the window.
- **Cancel-then-re-cancel:** each new cancellation re-stamps `cancelled_at`, restarting the window. Correct: the latest cancellation is the operative one.
- **Configurability:** fixed code constant for now; exposing it as a business-settings field is a C-12+ option if the owner ever wants to tune it without a developer.

---

## 6 — Migration footprint

**One Zone-2 migration required** (amendment 2026-05-26 — for Change 13 delayed-email infrastructure). Verify in pre-flight:

1. `audit_logs.action_type` is text — no CHECK constraint. New action_types (`booking_restored`, `booking_auto_promoted_completed`, `booking_quick_no_show`) are code constants only.
2. `email_delivery_events.event_type` — verify whether it's CHECK-constrained. If yes, a 1-line migration:
   ```sql
   ALTER TYPE email_event_type ADD VALUE 'booking_restored_client';
   -- (or ALTER TABLE...ADD CONSTRAINT if it's a text+check rather than enum)
   ```
   Per handoff §5.6, `email_delivery_events.event_type` is **free-text** (no CHECK constraint) — confirmed during C-08 plan-writing. So no migration here.
3. **`email_delivery_events` table — new columns** (Change 13):
   ```sql
   ALTER TABLE email_delivery_events
     ADD COLUMN scheduled_for timestamptz,
     ADD COLUMN html_payload text,
     ADD COLUMN text_payload text,
     ADD COLUMN to_email text,
     ADD COLUMN subject text;

   CREATE INDEX idx_email_delivery_events_scheduled_pending
     ON email_delivery_events (scheduled_for)
     WHERE scheduled_for IS NOT NULL AND delivery_status = 'queued';
   ```
   Additive, nullable columns. Existing rows unaffected (immediate-send semantics preserved). Pre-flight should verify none of these column names already exist (cheap query: `SELECT column_name FROM information_schema.columns WHERE table_name='email_delivery_events'`).
4. **`bookings.cancelled_at timestamptz` — new column + backfill** (S7 amendment 2026-07-16, same migration):
   ```sql
   ALTER TABLE bookings ADD COLUMN cancelled_at timestamptz;

   -- Backfill 1: customer-cancelled rows carry their own timestamp already.
   UPDATE bookings SET cancelled_at = customer_cancelled_at
   WHERE status = 'cancelled' AND customer_cancelled_at IS NOT NULL;

   -- Backfill 2 (best-effort): admin-cancelled rows from the latest cancel audit row.
   UPDATE bookings b SET cancelled_at = a.latest
   FROM (
     SELECT target_id::uuid AS booking_id, MAX(created_at) AS latest
     FROM audit_logs
     WHERE action_type = 'booking_management_updated'
       AND after_state->>'status' = 'cancelled'
     GROUP BY target_id
   ) a
   WHERE b.id = a.booking_id AND b.status = 'cancelled' AND b.cancelled_at IS NULL;
   ```
   Rows neither backfill reaches stay NULL → S7 treats them as expired (fail-closed, §5.12). Pre-flight verifies the audit-log `after_state` shape before trusting Backfill 2 (adjust the JSON path if the cancel path stores a different key).
5. Soft-delete `deleted_at` on bookings comes from C-06 (already in flight). C-04a's restore doesn't depend on it pre-C-06.

**No new permissions** — existing `manage_bookings_all` covers restore + reopen + no_show + row-level restore + undo. Capability gate for auto-promote is `can_take_bookings` (already in `staff_profiles`).

**New cron route** (Change 13c) — `src/app/api/cron/scheduled-emails/route.ts` runs at `* * * * *` (every minute). Registered in `wrangler.jsonc` cron triggers + `worker-entrypoint.ts` dispatch. Independent from C-01's `*/15 * * * *` review-emails cron (different mechanism; same Cloudflare Workers infrastructure).

---

## 7 — Files touched (preview — full list in plan)

### NEW (5 files)
- `src/app/admin/bookings/__tests__/restoreBooking.test.ts` — vitest coverage for restore action (including S6 datetime guard + queued-email cancellation paths)
- `src/app/admin/bookings/__tests__/autoPromoteBookingFromAssignments.test.ts` — vitest coverage for auto-promote helper
- **`src/app/api/cron/scheduled-emails/route.ts`** — NEW cron entrypoint (Change 13c)
- **`src/app/admin/bookings/__tests__/quickUpdateBookingRestore.test.ts`** — vitest coverage for Change 11 (quickUpdateBooking action=restore)
- **`supabase/migrations/<ts>_c04a_scheduled_emails.sql`** — Zone-2 migration (Change 13a)

### EDITED (~12 files)
- `src/app/admin/bookings/actions.ts` — `restoreBooking` (with S6 datetime guard + S7 window guard + queued-email cancellation), `autoPromoteBookingFromAssignments`, `quickUpdateBooking` extension for `no_show` + `restore` (Change 11) + `cancelled_at` stamping in the `cancel` case (S7), `updateBookingManagement` state-machine guard + delayed-email queueing + `cancelled_at` stamping in cancellation branch (S7)
- `src/app/admin/bookings/[bookingId]/page.tsx` — `NextAction` type extension, replace "restore from audit log" hint, render Restore button + Mark no-show button (S6-conditional), render confirm modal for reopen-completed with S3 reason display, wire Undo toast on Status-form cancel
- **`src/app/admin/bookings/BookingRowActions.tsx`** — extend `BookingRowAction` union with `"restore"`, add `runQuickAction` case, status-aware menu rendering (Change 12), Undo toast on cancel (Change 14)
- `src/lib/email/notifications.ts` — `sendBookingRestoredClientEmail` send function; `sendTrackedEmail` gains optional `delaySeconds`; `sendBookingCancellationEmails` threads `options.delaySeconds`
- `src/lib/email/templates.ts` — new `renderBookingRestoredEmail` function (additive)
- `src/app/admin/clients/[clientId]/page.tsx` — `AUDIT_PHRASING` map gets new entries
- `src/app/admin/reports/reports-helpers.ts` — remove `refunded` + `waived` from `PAYMENT_OPTIONS`
- `src/app/admin/reports/reporting.ts` — line 438 `||` → `??`
- `src/app/admin/reports/__tests__/reports-helpers.test.ts` — update "4 statuses" test
- `src/app/admin/clients/page.tsx` — remove `hasRefund`, `refund_issued` filter
- `src/app/admin/clients/[clientId]/page.tsx` — remove `case "refunded":` branch
- **`worker-entrypoint.ts`** — register `/api/cron/scheduled-emails` in cron dispatch
- **`wrangler.jsonc`** — add `* * * * *` cron schedule for scheduled-emails route
- (optional, if email_event_type is enum) `supabase/migrations/<ts>_c04a_booking_restored_email_event.sql`

### UNCHANGED (do NOT touch)
- `reporting.ts` core exports (`summarizeReports` is touched only at line 438 — the explicit one-char exception per C-B-DECISIONS Q8). All other exports stay.
- `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- `quickUpdateBooking` action flow for `confirm`/`cancel`/`mark_paid`/`complete` (unchanged — only `no_show` is added).
- `manage/actions.ts` (customer-facing cancel path) — out of scope. **(S7 note 2026-07-16: stays out of scope — it already stamps `customer_cancelled_at`, which the S7 guard's coalesce covers; no unified-column write needed there.)**

---

## 8 — Sequencing and dependencies

**Hard requirement:** C-04a ships **before or with C-05**. C-05's lockdown (cancelled/no_show inert at 7 edit points) is only survivable if admins have a one-click restore path. If C-05 lands first, admins are stuck on mistakenly cancelled bookings with no way out except SQL.

**No dependency on C-06.** C-04a doesn't touch `clients.deleted_at` or any C-06 server actions. The forward-looking check in §5.2 ("client deleted? refuse restore") is safe to add even when `deleted_at` doesn't yet exist — null-safe SELECT.

**No dependency on C-08.** C-04a creates `sendBookingRestoredClientEmail` directly; doesn't rely on C-08's template overrides infrastructure (which other plans use).

**No dependency on C-01.** C-04a doesn't touch `review_email_sent_at` or `completed_at`. Change 13's `scheduled-emails` cron is **independent** from C-01's `review-emails` cron — different mechanisms (scheduled-time vs status-trigger), different cadences (`* * * * *` vs `*/15 * * * *`), different worker routes. Both can ship in any order; both register on the same Cloudflare Workers cron infrastructure. C-12+ could unify them if a generic scheduled-send abstraction emerges — out of C-04a scope.

**Coordination with C-05 (N1 filter fix):** the row-level Restore from Change 10 is only discoverable on the list once C-05's N1 fix makes cancelled rows visible. C-04a is technically independent (the row menu code lands regardless), but the user-facing affordance only materialises after the C-05 ship. Both plans should ship together if possible — handoff §6 lists this as a soft co-ship preference.

**Capability-keyed coordination (per C-B-DECISIONS Q10):** auto-promote uses `assigned-practitioner` naming. Aligned with the cross-cutting capability-keyed discipline. C-FIELDWORK + C-11 + C-08 also reference this — same shared concept.

---

## 9 — Open questions

Decisions surfaced during plan-writing:

**Q9.1 — Restore button tone.** The current cancelled next-action card uses `tone: "danger"` (red). Adding a Restore button inside a danger-toned card with positive (green/blue) styling clashes visually. Options:
- (a) Keep card `danger` tone, button is an outline-style with neutral text. **Recommended** — preserves the "this is cancelled, here's the corrective action" signal.
- (b) Switch card to `info` or new `recoverable` tone when restore is offered.
- → Going with (a). Easy to revisit during impl.

**Q9.2 — Confirm-modal copy for restore.** Locked as drafted in §4.1. Tested for clarity at 6th-grade reading level. Adjust if user feedback during impl flags a clearer phrasing.

**Q9.3 — Auto-promote on partial completion.** Spec says ALL assignments must be `completed`. Open: what if some assignments are `no_show` and the rest `completed`? The system today doesn't have a "mixed final state". Decision: treat `no_show` as a terminal state alongside `completed` for auto-promote purposes — booking moves to `completed` if every assignment is in `{completed, no_show}`. Rationale: no-show is also "this assignment is done with"; booking owner gets the parent-level closure.

**Q9.4 — Should auto-promote fire the C-01 review email (when C-01 lands)?** Yes per W03 §11 — completion-by-auto-promote is still completion. The C-01 scheduler picks it up like any other `status='completed'` transition. C-04a sets the precedent; C-01 plan inherits.

**Q9.5 — `email_event_type` constraint check.** Plan §6 says verify in pre-flight. If constrained, one-line migration. Brief flags this as the only possible migration; plan handles it conditionally.

**Q9.6 — Should the auto-promote audit row include the practitioner who triggered it?** Yes — the `before_state.triggering_actor_staff_id` field captures the practitioner who marked the last assignment. Helps forensics ("who's been completing bookings via the auto-promote path?").

**Q9.7 — (amendment 2026-05-26) Does the cancel flow capture a reason today, and if not should it?**

Today's `updateBookingManagement` cancellation branch doesn't prompt for or capture a cancellation reason from the admin. `customer_cancellation_note` is only populated by the customer-facing cancel path. The S3 confirm-modal display falls back to "Cancelled by {actor} on {date}" with no reason text — operationally fine but the modal would be more useful if admin cancellations also captured a reason.

**Locked decision:** out of C-04a scope. Adding a cancel-reason prompt is a separate UX expansion (could fold into C-04a Phase H or defer to C-12+). The S3 modal renders whatever's available — empty reason if none captured.

**Q9.8 — (amendment 2026-05-26) `scheduled-emails` cron cadence — every minute vs every 30s?**

`* * * * *` (every minute) is the finest Cloudflare Workers cron resolution. Sub-minute requires either:
- (a) The worker self-spawning a setTimeout after the cron tick (fragile across worker restarts).
- (b) A short-poll loop on the client side (rejected for unrelated reasons).
- (c) A different platform (out of scope).

**Locked decision:** `* * * * *`. Worst-case 70s delay is acceptable for cancellation emails. If real-world feedback says clients are receiving delayed cancellations too late, we can shorten the undo window from 10s → 5s (toast still gives the user a meaningful moment) without changing the cron.

**Q9.9 — (amendment 2026-05-26) Should the Undo toast persist across route changes?**

Sonner's default behaviour: toasts persist for their configured `duration` regardless of route changes (the Toaster mounts at the layout level). Verify during impl that the Undo onClick handler still works from a different route (it should — it's a closure over `bookingId` + `quickUpdateBooking`).

If the user navigates to a route that re-fetches data and the booking now appears in their view, the Undo still works — `quickUpdateBooking` operates on the booking ID, not the visible row.

**Locked decision:** persist by default; revisit if QA finds an edge case.

**Q9.10 — (amendment 2026-05-26) What does the audit log show for an Undo-window cancel that was undone?**

Two events fire: the original cancellation audit row (action_type=`booking_quick_cancel` or `booking_management_updated`), then the restore audit row (action_type=`booking_restored`). The audit log honestly records the round trip — both events visible. The `restore` audit row's `after_state.cancelled_queued_email=true` field flags that the email was killed (vs. the natural cancel-then-restore path §5.11 where it's false).

A future C-12+ improvement could collapse "rapid cancel + undo within 10s" into a single soft-canceled-then-resumed event for cleaner audit reading, but that's polish — out of C-04a scope.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-04a implementation is complete when:

1. **Restore button works end-to-end** at `/admin/bookings/[id]` for a cancelled OR no_show booking. Click → confirm modal → confirm → status flips, client email sends, staff email sends, audit row written with `booking_restored`.
2. **The misleading "Restore from audit log" copy is gone** — replaced with the new actionable next-action card.
3. **Mark no-show quick action works** for confirmed past-dated bookings. Future-dated rejection works.
4. **Reopen-completed guard works** — direct status dropdown change from `completed` triggers the confirm modal; submit without the modal returns the structured error.
5. **Auto-promote works** — practitioner marks the last assignment complete → booking auto-flips to `completed`. Audit log shows `booking_auto_promoted_completed`.
6. **Auto-promote with `no_show` mixed** works — assignments in `{completed, no_show}` set trigger promotion (per Q9.3).
7. **Dead payment statuses are gone** from UI:
   - `/admin/reports` payment filter shows 3 options (Any / Paid / Outstanding).
   - `/admin/clients` filter no longer offers "Refund issued".
   - `clients/[clientId]/page.tsx:318 case "refunded"` branch removed.
   - `reports/__tests__/reports-helpers.test.ts` test updated.
8. **`reporting.ts:438` `||` → `??`** — verified by running `pnpm vitest run reporting` and confirming any test asserting on `completedRevenue` for a refunded scenario still passes (likely no such test today — new test added covering the case).
9. **Row-level Restore (Change 10)** — on `/admin/bookings` list with `status=cancelled` filter, a cancelled row's overflow menu shows ONLY "Restore booking" (per Change 12). Click → confirm modal with prior cancellation reason (per S3) → confirm → status flips, email sends, audit row written. Verified for all 3 roles with restore permission.
10. **`quickUpdateBooking` action=restore (Change 11)** — server endpoint accepts `restore`, delegates to `restoreBooking`, returns same shape. Direct invocation test passes.
11. **Status-aware menu (Change 12)** — confirmed-status row shows full active-state menu; cancelled-status row shows only Restore; past-datetime cancelled row shows "No actions available". Verified at all 4 viewports.
12. **Cancel-with-Undo toast (Change 14)** — clicking Cancel on a row surfaces a success toast with Undo button for 10 seconds. Clicking Undo within 10s reverts the status, kills the queued email (`email_delivery_events.delivery_status='cancelled_by_restore'`), and shows "Cancellation undone." No client email sent. Letting the toast expire results in the cron firing the email within 60s.
13. **Delayed-email infrastructure (Change 13)** — `email_delivery_events` table has the new columns (`scheduled_for`, `html_payload`, `text_payload`, `to_email`, `subject`). Cron route `/api/cron/scheduled-emails` returns `{ sent: N }` when invoked with `verifyCronSecret`. Registered in `wrangler.jsonc` + `worker-entrypoint.ts`.
14. **Past-datetime restore disallowed (S6)** — restoring a cancelled booking with `now() > booking_date + start_time` is impossible from the UI (button hidden in detail strip + row menu disabled). Direct server invocation returns structured error. Verified with a back-dated test booking.
14b. **(2026-07-16) Expired-window restore disallowed (S7)** — restoring a booking cancelled >28 days ago is impossible from the UI (button hidden, distinct "window has passed" hint); direct server invocation returns the S7 structured error. Admin cancel paths stamp `cancelled_at`; restore clears it; a booking with unknown cancellation time is unrestorable. Verified with an SQL-backdated `cancelled_at` on a test booking (within-window sibling restores normally).
15. **Prior cancellation reason on confirm modal (S3)** — modal renders the prior `customer_cancellation_note` if present, otherwise "Cancelled by {actor} on {date}" from audit log.
16. **All static gates pass:** lint, tsc, vitest, build, bundle delta within budget.
17. **Playwright role sweep at 375 / 768 / 1280 / 1440 passes** for all 4 roles.
18. **Badar's `9d55ce2a` booking is untouched** — verified pre/post via DB query.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q8 + §3 C-04a | 9-step scope (locked) + drop of C-04b + hygiene tail approval |
| `C-B-DECISIONS.md` §2 Q10 | Capability-keyed naming (assigned-practitioner) for auto-promote |
| `W04-cancellation-and-restore-flow.md` §1+§2+§3 | B-120 silent restore, B-121 UX lie, B-122 no state-machine — the core gaps |
| `W03-booking-lifecycle-flow.md` §2 | B-117 no-show quick action, W03-E-2 temporal guard, R03 status-machine context |
| `W09-refund-payment-correction-flow.md` §2 | B-143 dead vocab, B-148 reports correctness one-char fix |
| `R04-therapist-day.md` §3 | B-168 assignment-vs-booking gap; auto-promote pattern recommendation |
| `04-bookings-detail-audit.md` | Next-action strip + Status form layout context (B-16 + V-12 + E-12) |
| `bookings/actions.ts:118-237` | `updateBookingManagement` — where state-machine guard hooks in + cancellation branch where delay-queue wiring lands |
| `bookings/actions.ts:367-447` | `quickUpdateBooking` — where `no_show` + `restore` are added |
| `bookings/actions.ts:564-625` | `updateOwnAssignmentStatus` — where auto-promote hooks in |
| `bookings/[bookingId]/page.tsx:1164-1209` | Next-action strip implementation |
| `bookings/BookingRowActions.tsx:17-22` | `BookingRowAction` union extension point (Change 10) |
| `bookings/BookingRowActions.tsx:117-155` | `runQuickAction` switch — restore case + cancel-toast-undo wiring |
| `lib/email/notifications.ts:341-429` | Email send-fn pattern to lift + delaySeconds wiring point |
| `lib/email/notifications.ts:385` | `sendBookingCancellationEmails` — gains `options.delaySeconds` |
| `app/api/cron/booking-reminders/route.ts` | Pattern for the new scheduled-emails cron route |
| `worker-entrypoint.ts` | Cron-dispatch registration site |
| `wrangler.jsonc` | Cron-schedule declaration site |
| `reporting.ts:438` | The one-char fix site |
| `reports-helpers.ts:32-33` | Dead payment options |

---

## 12 — Out of scope (explicit non-goals)

- **First-class refund modal / refund tracking** — C-04b is dropped per C-B-DECISIONS Q8.
- **`payment_status` enum extension** — payment stays `paid` | `unpaid`. No `refunded` or `waived` reintroduction.
- **`paid_at` cleanup when amount_paid=0** — W09 B-144, deferred to C-12+ data hygiene.
- **`amount_paid` upper-bound check** — W09 E-2, deferred to C-12+.
- **Customer-cancellation forensic audit row** — W04 B-123, deferred to C-12+ (defensive).
- **"Recently restored" badge for 72h** — W04 V-1, polish for C-12+.
- **Session-note draft persistence** — R04 B-169, deferred to C-FIELDWORK.
- **Email "Resend" button on `/admin/emails`** — per-row Resend lands in C-08.
- **Customer-side cancellation token reuse audit** — W04 E-2, deferred.
- **B-119 audit log initiator distinction** — W03 forensic improvement, deferred.
- **Admin cancellation-reason prompt** — Q9.7 amendment. Today's cancel path doesn't capture a reason; adding the prompt is a separate UX expansion. Defer to C-12+.
- **Unifying scheduled-emails cron with C-01's review-emails cron** — Q9.8 amendment. Different mechanisms; abstraction not required for C-04a. Defer to C-12+ if a generic scheduled-send pattern emerges.
- **Bulk cancel-with-Undo across multi-select** — Change 14 covers single-row cancel only. Bulk operations land in C-06's scope (bulk delete) and could be extended later.
- **Sub-minute cron cadence for tighter delay control** — Q9.8 amendment. Cloudflare Workers minimum is 1 minute; sub-minute requires platform change. Out of scope.

---

*End of C-04a brief. Plan file follows: `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md`.*
