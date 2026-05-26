# C-04a — Cancellation restore (explicit button + email + state-machine + auto-promote + hygiene tail)

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
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

C-04a fixes the booking lifecycle's restore path and is **load-bearing for C-05** (which locks cancelled/no_show inert — admins must have a restore path before lockdown lands). Nine targeted changes:

1. **Explicit Restore button** on `/admin/bookings/[id]` next-action strip — replaces the current "Restore from audit log" UX lie (B-121).
2. **`restoreBooking` server action** — separates restore semantics from the generic `updateBookingManagement` status dropdown (cleaner audit + email + cache invalidation contract).
3. **`sendBookingRestoredClientEmail`** — currently restore is silent to the client; they hear cancellation then nothing (B-120).
4. **State-machine guard** — block `completed → pending/confirmed` without an explicit force flag + audit reason (B-122). Defensive; surfaced via confirm modal.
5. **`no_show` quick action** — extend `quickUpdateBooking` so admins don't have to open the full Status form for a common day-of scenario (B-117).
6. **Assigned-practitioner auto-promote** — when ALL assignments on a booking are marked `completed`, auto-flip `booking.status` to `completed` (B-168). Capability-keyed naming per C-B-DECISIONS Q10 (renamed from "therapist auto-promote").
7. **New audit-log action_type `booking_restored`** — first-class forensic row, not buried under `booking_management_updated`.
8. **New email_event_type `booking_restored_client`** — first-class delivery-log entry.
9. **Hygiene tail:** remove dead `refunded` + `waived` payment-status filter UI references (B-143) and apply the one-char `||` → `??` fix in `reporting.ts:438` (B-148 — explicit exception to RECON §5 untouchable, approved per C-B-DECISIONS Q8).

Net effect: an admin can restore a mistakenly cancelled booking with one click, the client is informed, the audit log is honest, the booking's lifecycle reaches `completed` automatically when practitioners do their job, and the codebase no longer carries dead payment-status references.

**Sequencing constraint:** C-04a MUST ship before or with C-05 (Restore is what makes the lockdown survivable).

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

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-04a)

C-04a ships 9 changes. The plan groups them into 4 phases.

### 2.1 The restore primitive (changes 1-3)

**Change 1 — New server action `restoreBooking`.** In `src/app/admin/bookings/actions.ts`:

```ts
export async function restoreBooking(formData: FormData): Promise<BookingUpdateState> {
  // 1. RBAC: requireBookingManager + canManageAllBookings
  // 2. Parse formData: booking_id (required), target_status ('confirmed' | 'pending'),
  //    force_completed (boolean, default false), reason (string, optional)
  // 3. SELECT current booking. Reject if booking not found OR status NOT IN
  //    ('cancelled', 'no_show', 'completed'). Restore only applies to inert states.
  // 4. State-machine guard: if before.status === 'completed' AND !force_completed,
  //    return { error: 'Reopening a completed booking requires confirmation.' }
  //    The UI surfaces a confirm modal that re-submits with force_completed=true.
  // 5. UPDATE bookings SET status = target_status, customer_cancelled_at = NULL,
  //    customer_cancellation_note = NULL (clear stale customer-cancellation fields
  //    on transition out of cancelled — addresses W04 B-125 as a bonus)
  // 6. Audit log row: action_type='booking_restored', before_state=full row,
  //    after_state={ target_status, force_completed, reason, cleared_customer_cancellation }
  // 7. Fire sendBookingRestoredClientEmail (change 3 below)
  // 8. Fire sendAssignedStaffBookingChangeEmails (existing — staff awareness)
  // 9. Cache invalidation: updateTag('report-data') + updateTag('dashboard-data') +
  //    revalidatePath calls (same as updateBookingManagement)
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

---

## 3 — RBAC matrix (C-04a actions × roles)

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| Restore booking (Restore button) | ✅ | ✅ | ✅ (via `canManageAllBookings`) | ❌ |
| `no_show` quick action | ✅ | ✅ | ✅ | ❌ |
| Force-reopen completed booking | ✅ | ✅ | ✅ | ❌ |
| Mark own assignment complete (triggers auto-promote) | ✅ if `can_take_bookings` + assigned | ✅ if `can_take_bookings` + assigned | ✅ if `can_take_bookings` + assigned | ✅ if assigned |
| View next-action strip on cancelled booking | ✅ | ✅ | ✅ | ❌ (predicate fails at detail-page entry) |
| See `Marked no-show` next-action card | ✅ | ✅ | ✅ | ✅ if assigned (read-only) |

Auto-promote is **capability-keyed**, not role-keyed: any practitioner (Owner / Admin / Coord with `can_take_bookings` + Therapist) who completes their assignment can trigger it.

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

---

## 6 — Migration footprint

**Likely none.** Verify in pre-flight:

1. `audit_logs.action_type` is text — no CHECK constraint. New action_types (`booking_restored`, `booking_auto_promoted_completed`, `booking_quick_no_show`) are code constants only.
2. `email_delivery_events.event_type` — verify whether it's CHECK-constrained. If yes, a 1-line migration:
   ```sql
   ALTER TYPE email_event_type ADD VALUE 'booking_restored_client';
   -- (or ALTER TABLE...ADD CONSTRAINT if it's a text+check rather than enum)
   ```
3. No new columns needed. Soft-delete `deleted_at` on bookings comes from C-06 (already in flight). C-04a's restore doesn't depend on it pre-C-06.

**No new permissions** — existing `manage_bookings_all` covers restore + reopen + no_show. Capability gate for auto-promote is `can_take_bookings` (already in `staff_profiles`).

---

## 7 — Files touched (preview — full list in plan)

### NEW (3 files)
- `src/lib/email/templates.ts` — new `renderBookingRestoredEmail` function (additive, same file)
- `src/app/admin/bookings/__tests__/restoreBooking.test.ts` — vitest coverage for restore action
- `src/app/admin/bookings/__tests__/autoPromoteBookingFromAssignments.test.ts` — vitest coverage for auto-promote helper

### EDITED (~10 files)
- `src/app/admin/bookings/actions.ts` — `restoreBooking`, `autoPromoteBookingFromAssignments`, `quickUpdateBooking` extension for `no_show`, `updateBookingManagement` state-machine guard, `updateOwnAssignmentStatus` auto-promote hook
- `src/app/admin/bookings/[bookingId]/page.tsx` — `NextAction` type extension, replace "restore from audit log" hint, render Restore button + Mark no-show button, render confirm modal for reopen-completed
- `src/lib/email/notifications.ts` — `sendBookingRestoredClientEmail` send function
- `src/app/admin/clients/[clientId]/page.tsx` — `AUDIT_PHRASING` map gets new entries
- `src/app/admin/reports/reports-helpers.ts` — remove `refunded` + `waived` from `PAYMENT_OPTIONS`
- `src/app/admin/reports/reporting.ts` — line 438 `||` → `??`
- `src/app/admin/reports/__tests__/reports-helpers.test.ts` — update "4 statuses" test
- `src/app/admin/clients/page.tsx` — remove `hasRefund`, `refund_issued` filter
- `src/app/admin/clients/[clientId]/page.tsx` — remove `case "refunded":` branch
- (optional, if email_event_type is enum) `supabase/migrations/<ts>_c04a_booking_restored_email_event.sql`

### UNCHANGED (do NOT touch)
- `reporting.ts` core exports (`summarizeReports` is touched only at line 438 — the explicit one-char exception per C-B-DECISIONS Q8). All other exports stay.
- `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- `quickUpdateBooking` action flow for `confirm`/`cancel`/`mark_paid`/`complete` (unchanged — only `no_show` is added).
- `manage/actions.ts` (customer-facing cancel path) — out of scope.

---

## 8 — Sequencing and dependencies

**Hard requirement:** C-04a ships **before or with C-05**. C-05's lockdown (cancelled/no_show inert at 7 edit points) is only survivable if admins have a one-click restore path. If C-05 lands first, admins are stuck on mistakenly cancelled bookings with no way out except SQL.

**No dependency on C-06.** C-04a doesn't touch `clients.deleted_at` or any C-06 server actions. The forward-looking check in §5.2 ("client deleted? refuse restore") is safe to add even when `deleted_at` doesn't yet exist — null-safe SELECT.

**No dependency on C-08.** C-04a creates `sendBookingRestoredClientEmail` directly; doesn't rely on C-08's template overrides infrastructure (which other plans use).

**No dependency on C-01.** C-04a doesn't touch `review_email_sent_at` or `completed_at`.

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
9. **All static gates pass:** lint, tsc, vitest, build, bundle delta within budget.
10. **Playwright role sweep at 375 / 768 / 1280 / 1440 passes** for all 4 roles.
11. **Badar's `9d55ce2a` booking is untouched** — verified pre/post via DB query.

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
| `bookings/actions.ts:118-237` | `updateBookingManagement` — where state-machine guard hooks in |
| `bookings/actions.ts:367-447` | `quickUpdateBooking` — where `no_show` is added |
| `bookings/actions.ts:564-625` | `updateOwnAssignmentStatus` — where auto-promote hooks in |
| `bookings/[bookingId]/page.tsx:1164-1209` | Next-action strip implementation |
| `lib/email/notifications.ts:341-429` | Email send-fn pattern to lift |
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

---

*End of C-04a brief. Plan file follows: `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md`.*
