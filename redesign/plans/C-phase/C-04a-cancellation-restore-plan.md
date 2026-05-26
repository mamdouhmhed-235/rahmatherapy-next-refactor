# C-04a — Cancellation restore + auto-promote + hygiene tail — **PLAN**

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-04a-cancellation-restore-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-04a-cancellation-restore-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

This plan covers the "how" — execution order, verify-checkpoints, files touched, verification gate, risks + undo. Read the brief first.

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** `git status --short` empty. HEAD on `redesign/start-state`.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 baseline failures preserved).
4. **Static gates green.** `pnpm lint`, `npx tsc --noEmit` both 0 errors.
5. **DB introspection.** Confirm via `mcp__supabase__execute_sql`:

   ```sql
   -- (a) Verify audit_logs.action_type has no CHECK constraint
   SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
   JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'audit_logs' AND c.contype = 'c';
   -- expect: 0 rows OR no constraint involving action_type

   -- (b) Verify email_delivery_events.event_type column type
   SELECT data_type, udt_name FROM information_schema.columns
   WHERE table_name = 'email_delivery_events' AND column_name = 'event_type';
   -- if text → no migration needed for the new event_type value
   -- if enum (USER-DEFINED) → one-line migration to ADD VALUE

   -- (c) Verify no existing 'booking_restored' or 'booking_auto_promoted_completed' rows
   SELECT action_type, COUNT(*) FROM audit_logs
   WHERE action_type IN ('booking_restored', 'booking_auto_promoted_completed', 'booking_quick_no_show')
   GROUP BY action_type;
   -- expect 0 rows for all three
   ```

6. **Test fixture inventory.** Confirm via `mcp__supabase__execute_sql`:
   - At least one cancelled test booking exists (NOT Badar's `9d55ce2a`). If none, locate one or document the gap; some E2E paths will exercise restore against newly-created cancellations during the sweep.
   - At least one completed test booking exists for the reopen-guard test.
   - At least one confirmed past-dated test booking exists for the no_show quick-action test.

7. **Capture pre-state for hygiene-tail safety net:**
   ```sql
   -- Capture current completedRevenue baseline (W09 B-148 fix changes this number)
   SELECT
     COUNT(*) FILTER (WHERE status='completed') AS completed_count,
     SUM(amount_paid) FILTER (WHERE status='completed') AS sum_paid,
     SUM(total_price) FILTER (WHERE status='completed') AS sum_price
   FROM bookings;
   ```
   If any completed booking has `amount_paid = 0`, the `??` fix will reduce `completedRevenue`. Document the delta in the progress file.

8. **Test data DO-NOT-TOUCH list:** Badar's booking `9d55ce2a` (cancelled, real email `avonrk@hotmail.co.uk`). Any client with non-`*.example.test` / non-`Phase10*` / non-`Audit Test*` email — real customer.

If any pre-flight step fails or reveals unexpected state, **stop** and surface to the user.

---

## 1 — Safe implementation order (4 phases, 9 changes, with verify-checkpoints)

Each phase is committable independently. Verify-checkpoints between phases.

### Phase A — Restore primitive (changes 1-3 from brief)

**Step 1 — `restoreBooking` server action.**
- Edit `src/app/admin/bookings/actions.ts`. Insert new exported function after `quickUpdateBooking` (~line 447):

```ts
const RESTORE_TARGET_STATUSES = ["confirmed", "pending"] as const;
type RestoreTargetStatus = (typeof RESTORE_TARGET_STATUSES)[number];

export async function restoreBooking(formData: FormData): Promise<BookingUpdateState> {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) return { error: "Insufficient permissions." };

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const targetStatus = String(formData.get("target_status") ?? "confirmed") as RestoreTargetStatus;
  const forceCompleted = formData.get("force_completed_reversal") === "on";
  const reason = String(formData.get("reason") ?? "").trim();

  if (!bookingId) return { error: "Booking is required." };
  if (!RESTORE_TARGET_STATUSES.includes(targetStatus)) {
    return { fieldErrors: { target_status: "Choose a valid restore target." } };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!beforeState) return { error: "Booking not found." };

  // Restore semantics: only valid for inert statuses (cancelled, no_show) OR
  // a completed reopen with explicit force flag.
  const isInertSource = beforeState.status === "cancelled" || beforeState.status === "no_show";
  const isCompletedReopen = beforeState.status === "completed";

  if (!isInertSource && !isCompletedReopen) {
    return { error: "Only cancelled, no-show, or completed bookings can be restored." };
  }

  if (isCompletedReopen) {
    if (!forceCompleted || reason.length < 5) {
      return {
        error: "Reopening a completed booking requires confirmation and a reason.",
        fieldErrors: forceCompleted
          ? { reason: "Provide a reason (min 5 chars)." }
          : { force_completed_reversal: "Confirm via the modal." },
      };
    }
  }

  // Forward-looking C-06 dependency (null-safe — column may not yet exist)
  if (beforeState.clients?.deleted_at) {
    return {
      error: "This booking's client has been deleted. Restore the client first, then the booking.",
    };
  }

  const updatePayload: Record<string, unknown> = {
    status: targetStatus,
  };
  // Clear stale customer-cancellation fields on transition out of cancelled (W04 B-125)
  if (beforeState.status === "cancelled") {
    updatePayload.customer_cancelled_at = null;
    updatePayload.customer_cancellation_note = null;
  }

  const { data: updatedBooking, error } = await adminClient
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_restored",
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: {
      ...updatedBooking,
      restore_from_status: beforeState.status,
      restore_target_status: targetStatus,
      force_completed: forceCompleted || undefined,
      reason: reason || undefined,
    },
  });

  // Client email — wrapped so a delivery failure doesn't roll back the restore
  await sendBookingRestoredClientEmail(bookingId, adminClient, {
    fromStatus: beforeState.status as BookingStatus,
  }).catch((emailError) => {
    console.error("Unable to send restore email to client.", emailError);
  });

  // Assigned staff awareness
  await sendAssignedStaffBookingChangeEmails(
    bookingId,
    adminClient,
    `Booking restored from ${beforeState.status} to ${targetStatus}.`
  ).catch((emailError) => {
    console.error("Unable to send assigned-staff restore email.", emailError);
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}
```

- Verify: `npx tsc --noEmit` green. Action not yet wired to UI (Step 2). Unit test in Step 1b below.

**Step 1b — Vitest spec for `restoreBooking`.** New file `src/app/admin/bookings/__tests__/restoreBooking.test.ts`:
- Cancelled → confirmed: status flips, audit row written, customer_cancelled_at/note cleared, both emails called.
- No_show → confirmed: status flips, audit row, both emails called.
- Completed → confirmed without force flag: returns structured error, no DB change.
- Completed → confirmed with force flag + reason ≥ 5 chars: status flips, audit row records reason.
- Already-confirmed booking → returns "Only cancelled, no-show, or completed bookings can be restored.".
- Client deleted (mock clients.deleted_at non-null): refuse.
- Therapist actor: insufficient permissions.
- Email failure mocked: restore still succeeds; error logged.

Pattern: lift the existing test scaffolding from `clients/__tests__/updateClient.test.ts` (when C-06 lands) or from any existing booking-action test file. Use vi.fn() for the `createSupabaseAdminClient` factory.

**Step 2 — Replace misleading hint + add Restore button on detail page.**

- Edit `src/app/admin/bookings/[bookingId]/page.tsx`:

At the `NextAction` interface (~line 1150-1162), extend:

```ts
interface NextActionTrigger {
  kind: "restore_booking" | "mark_no_show" | "reopen_completed";
  label: string;
  targetStatus?: BookingStatus;
}

interface NextAction {
  tone: NextActionTone;
  icon: React.ElementType;
  headline: string;
  hint?: string;
  numeral?: { value: string; suffix?: string };
  action?: NextActionTrigger; // NEW
}
```

Update the cancelled branch (~line 1164-1171):

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

Update the no_show branch (~line 1174-1180):

```ts
if (booking.status === "no_show") {
  return {
    tone: "warning",
    icon: AlertCircle,
    headline: "Marked as no-show.",
    hint: "Recorded. Restore if the client did attend.",
    action: { kind: "restore_booking", targetStatus: "confirmed", label: "Restore booking" },
  };
}
```

For confirmed + past-dated (the no_show button placement — comes in Phase C):

```ts
if (booking.status === "confirmed" && isBookingDatePastOrToday(booking.booking_date)) {
  return {
    tone: "info",
    icon: CalendarCheck2,
    headline: "Ready to mark complete.",
    hint: `The booking starts at ${formatTime(booking.start_time)}.`,
    action: { kind: "mark_no_show", label: "Mark no-show" },
    // Secondary action: Mark complete (existing path)
  };
}
```

Render the action button in the next-action strip component. Find the existing JSX (~line 350-450 search for `next-action-strip` or where `NextAction` is rendered). Wrap the button in a `<form action={restoreBookingFormAction}>` with hidden inputs for `booking_id` + `target_status` + `kind`. Use `useActionState` + `ConfirmActionModal` per brief §4.1 copy.

If the button is in a server component (the page is server-rendered), lift the action UI into a small client component `NextActionButton.tsx` colocated:

```ts
// src/app/admin/bookings/[bookingId]/NextActionButton.tsx
"use client";
// Imports useActionState, ConfirmActionModal, calls restoreBooking from actions
```

- Verify: lint + tsc green. Manual visual check at `http://localhost:3000/admin/bookings/<a-cancelled-test-booking>` after Phase A commit.

**Step 3 — `sendBookingRestoredClientEmail` send function + template.**

- Edit `src/lib/email/templates.ts`. Add new render function near `renderBookingCancellationEmail` (search for it):

```ts
export function renderBookingRestoredEmail(input: BookingTemplateInput & { fromStatus: string }): string {
  // Same HTML structure as renderBookingConfirmationEmail.
  // Copy:
  //   "Good news — your booking with {companyName} on {date} at {time}
  //   has been restored. We're sorry for the earlier cancellation;
  //   everything is back on. Reply to this email or call {phone} if you
  //   have any questions."
  // Use the same hero / details / CTA pattern as confirmation email.
}
```

- Edit `src/lib/email/notifications.ts`. Add after `sendBookingCancellationEmails` (~line 429):

```ts
export async function sendBookingRestoredClientEmail(
  bookingId: string,
  supabase: SupabaseClient,
  options: { fromStatus: BookingStatus } = { fromStatus: "cancelled" }
) {
  const { booking, settings, input } = await getBookingTemplateInput(bookingId, supabase);
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    throw new Error("Booking client has no email address.");
  }

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

- Import in `src/app/admin/bookings/actions.ts` (added at line 7-12 — extend the existing email notifications import).

- Verify: `npx tsc --noEmit` green. The send function will only actually fire end-to-end after Step 1 + Phase A wiring is fully done.

**Phase A verify checkpoint:**
- `pnpm lint` 0 errors
- `npx tsc --noEmit` 0 errors
- `pnpm vitest run bookings` — new restoreBooking specs pass; existing booking tests still pass
- Playwright manual: navigate to a cancelled test booking → Restore button visible with new copy → click → confirm modal → confirm → status flips → audit row written. **Reset the test booking back to cancelled afterward for repeatability.**

### Phase B — State-machine guard (change 4)

**Step 4 — Add `completed → *` guard to `updateBookingManagement`.**

- Edit `src/app/admin/bookings/actions.ts` between lines 175 (after `if (!beforeState) return ...`) and 177 (before `const payload = { status, ... }`):

```ts
// State-machine guard: completed → non-completed requires explicit force + reason
if (beforeState.status === "completed" && status !== "completed") {
  const forceFlag = formData.get("force_completed_reversal") === "on";
  const reason = String(formData.get("completed_reversal_reason") ?? "").trim();
  if (!forceFlag) {
    return {
      error: "Reopening a completed booking requires confirmation.",
      fieldErrors: { status: "Use Restore on the next-action strip — or confirm via the modal." },
    };
  }
  if (reason.length < 5) {
    return {
      error: "Reopening a completed booking requires a reason.",
      fieldErrors: { completed_reversal_reason: "Provide a reason (min 5 chars)." },
    };
  }
  // Audit log records the reason via the after_state augmentation
}
```

- Edit the audit log INSERT (lines 204-211) to fold in the reason when present:

```ts
await adminClient.from("audit_logs").insert({
  actor_staff_id: actor.id,
  action_type: "booking_management_updated",
  target_type: "bookings",
  target_id: bookingId,
  before_state: beforeState,
  after_state: {
    ...data,
    ...(formData.get("completed_reversal_reason")
      ? { completed_reversal_reason: String(formData.get("completed_reversal_reason")) }
      : {}),
  },
});
```

**Step 4b — Confirm modal in the Status form.**

The Status form lives somewhere on `bookings/[bookingId]/page.tsx` or a colocated component. Locate the form rendering the status `<select>` (grep for `name="status"` inside that file). Wrap the Save button with a conditional `ConfirmActionModal` when the form's pending status is non-`completed` AND the booking's current status IS `completed`.

The modal's confirm-on-submit injects two hidden inputs into the form via DOM manipulation OR (cleaner) the form has those hidden inputs pre-rendered as `<input type="hidden" name="force_completed_reversal" value="off" />` + `<input type="hidden" name="completed_reversal_reason" value="" />` and the modal updates their values before re-submission.

UI copy per brief §4.3.

- Verify: lint + tsc green. Manual: open a completed test booking → change status to confirmed via the Status form → click Save → modal opens → cancel → no DB change. Re-do → confirm with reason → status flips, audit row records reason.

**Phase B verify checkpoint:**
- `pnpm vitest run bookings` — existing tests pass; ideally add 2 new tests for the guard (no-force + with-force paths).
- Playwright manual: completed → confirmed transition via Status form must require modal.

### Phase C — No-show quick action (change 5)

**Step 5 — Extend `quickUpdateBooking` to accept `no_show`.**

- Edit `src/app/admin/bookings/actions.ts:387-403`:

```ts
const todayISO = new Date().toISOString().slice(0, 10);
const bookingDate = String(beforeState.booking_date ?? "").slice(0, 10);
const isFutureDated = bookingDate > todayISO;

const payload =
  action === "confirm"
    ? { status: "confirmed" as BookingStatus }
    : action === "mark_paid"
      ? {
          payment_status: "paid" as PaymentStatus,
          payment_method: beforeState.payment_method ?? ("cash" as PaymentMethod),
          amount_paid: amountDue,
          paid_at: beforeState.paid_at ?? new Date().toISOString(),
        }
      : action === "cancel"
        ? { status: "cancelled" as BookingStatus }
        : action === "complete"
          ? isFutureDated
            ? null
            : { status: "completed" as BookingStatus }
          : action === "no_show"
            ? isFutureDated
              ? null
              : { status: "no_show" as BookingStatus }
            : null;

if (!payload) {
  if (isFutureDated && (action === "complete" || action === "no_show")) {
    return { error: "This booking is in the future. Mark complete or no-show after the appointment time." };
  }
  return { error: "Unsupported booking action." };
}
```

Audit log: action_type becomes `booking_quick_no_show` automatically via the existing template-string `booking_quick_${action}`.

Email behaviour: the existing branch at lines 423-437 handles status transitions — `no_show` falls through to the `else if` (since it's not a transition TO cancelled) and fires `sendAssignedStaffBookingChangeEmails`. **Customer is intentionally NOT notified** per brief §4.2 (no-show is not customer-facing).

**Step 5b — Add Mark no-show button to next-action strip.**

In `bookings/[bookingId]/page.tsx`, the `deriveNextAction` function gets a new branch for `confirmed + past-dated`. Update per Step 2 sketch.

The button submits a `<form>` to `quickUpdateBooking` with `action=no_show` + `booking_id`. Wrap in `ConfirmActionModal` per brief §4.2 copy.

- Verify: lint + tsc green. Manual: a confirmed past-dated test booking → Mark no-show button visible → click → confirm → status flips → no client email → staff email sent.

**Phase C verify checkpoint:**
- New unit test for `quickUpdateBooking` action=`no_show` path (future-dated rejected; past-dated succeeds).
- Playwright manual.

### Phase D — Auto-promote (change 6)

**Step 6 — `autoPromoteBookingFromAssignments` helper + hook.**

- Edit `src/app/admin/bookings/actions.ts`. Add new helper alongside `recomputeBookingAssignmentStatus` (~line 116):

```ts
async function autoPromoteBookingFromAssignments(
  bookingId: string,
  triggeringActorStaffId: string,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ promoted: boolean; error?: string }> {
  // Fetch current assignment statuses + booking status atomically-enough
  const [{ data: assignments }, { data: bookingNow }] = await Promise.all([
    adminClient
      .from("booking_assignments")
      .select("status, assigned_staff_id")
      .eq("booking_id", bookingId),
    adminClient
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single(),
  ]);

  if (!assignments || !bookingNow) return { promoted: false };

  // Predicate: all assignments are terminal (completed or no_show), none missing assigned_staff_id
  const allTerminal = assignments.length > 0 && assignments.every(
    (a) => a.assigned_staff_id && (a.status === "completed" || a.status === "no_show")
  );
  if (!allTerminal) return { promoted: false };

  // Predicate: current booking is not already terminal
  if (bookingNow.status === "completed" || bookingNow.status === "cancelled") {
    return { promoted: false };
  }

  // Atomic UPDATE with WHERE guard (race-safe)
  const { data: promoted, error } = await adminClient
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId)
    .not("status", "in", '("completed","cancelled")')
    .select("status")
    .single();

  if (error || !promoted) {
    // Either errored OR the race-condition WHERE returned 0 rows — both treat as "didn't promote"
    return { promoted: false, error: error?.message };
  }

  // Audit log — only fires when the UPDATE actually changed a row
  await adminClient.from("audit_logs").insert({
    actor_staff_id: triggeringActorStaffId,
    action_type: "booking_auto_promoted_completed",
    target_type: "bookings",
    target_id: bookingId,
    before_state: { status: bookingNow.status },
    after_state: {
      status: "completed",
      trigger: "all_assignments_terminal",
      assignment_statuses: assignments.map((a) => a.status),
    },
  });

  // Staff awareness email (no client email — auto-promote follows a real visit)
  await sendAssignedStaffBookingChangeEmails(
    bookingId,
    adminClient,
    `Booking auto-completed — all assignments are complete.`
  ).catch((emailError) => {
    console.error("Unable to send auto-promote staff email.", emailError);
  });

  return { promoted: true };
}
```

**Step 6b — Hook into `updateOwnAssignmentStatus`.**

- Edit `src/app/admin/bookings/actions.ts:564-625`. After `recomputeBookingAssignmentStatus` call (line 602-606) and BEFORE the existing audit log INSERT, add:

```ts
// Auto-promote: if this update terminalised the assignment, check if all are terminal
let autoPromoteResult: { promoted: boolean; error?: string } = { promoted: false };
if (status === "completed" || status === "no_show") {
  autoPromoteResult = await autoPromoteBookingFromAssignments(
    updatedAssignment.booking_id,
    actor.id,
    adminClient
  );
  if (autoPromoteResult.error) {
    console.error("Auto-promote failed.", autoPromoteResult.error);
    // Non-fatal: assignment update still succeeded
  }
}
```

Optional: extend the function's return to include `autoPromoted: autoPromoteResult.promoted` so the UI can show the "Auto-completed" toast.

**Step 6c — Hook into `updateBookingAssignment` (admin-side reassignment).**

Find `updateBookingAssignment` around line 449. If it has a code path that sets an assignment to `completed` (it might not — the admin flow is mostly assign/reassign/unassign), add the same hook. If the function only does assign/unassign, no hook needed.

**Verify autopromote hook scope:** grep `src/app/admin/bookings` for `status: "completed"` or `.update({ status: "completed" })` on `booking_assignments` table to identify all sites.

```bash
git grep -nE "booking_assignments|\\.update\\(.*status.*completed" src/app/admin/bookings/
```

For each match: assess whether the call sets an assignment to `completed`. If yes, add the auto-promote hook.

**Step 6d — Vitest spec for `autoPromoteBookingFromAssignments`.** New file `src/app/admin/bookings/__tests__/autoPromoteBookingFromAssignments.test.ts`:
- All assignments terminal (mix of completed + no_show), booking pending: promotes to completed.
- All assignments terminal, booking already completed: no-op.
- All assignments terminal, booking cancelled: no-op (can't auto-promote a cancelled booking).
- One assignment still active (unassigned/assigned): no-op.
- Empty assignments array: no-op.
- Concurrent promote (mock the WHERE-guard returning 0 rows): returns promoted=false, no audit row written.

**Step 6e — Render the "Auto-completed" banner on detail page.**

Compute in the page's server component:

```ts
const autoPromoteEvent = booking.audit_logs?.find(
  (row) => row.action_type === "booking_auto_promoted_completed"
    && Date.now() - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000
);
```

If present, render the banner per brief §4.4. No DB state — just a derived view.

**Phase D verify checkpoint:**
- New unit tests pass.
- Playwright manual: as the Therapist test account, mark the last assignment on a test booking complete → booking auto-flips to completed → audit log shows `booking_auto_promoted_completed` row → detail page banner appears.

### Phase E — Hygiene tail (change 9 — multi-file but trivial)

**Step 7 — Remove dead `refunded` + `waived` from reports filter UI.**

- Edit `src/app/admin/reports/reports-helpers.ts:28-34`:

```ts
export const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any payment" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Outstanding" },
];
```

- Edit `src/app/admin/reports/__tests__/reports-helpers.test.ts:45-55`. Find the "4 real payment statuses" test (line 47). Change:

```ts
it("covers the 2 real payment statuses (paid, unpaid)", () => {
  expect(PAYMENT_OPTIONS.map((option) => option.value)).toEqual([
    "",
    "paid",
    "unpaid",
  ]);
});
```

**Step 8 — Remove `hasRefund` + `refund_issued` from clients list.**

- Edit `src/app/admin/clients/page.tsx`:
  - Line 155: delete the `hasRefund` helper function (3-4 lines).
  - Lines 300-303: remove the conditional `if (payment === "refund_issued" && !refunded) return false;` AND the `if (payment === "in_good_standing" && (outstanding > 0 || refunded)) return false;` — needs to lose the `|| refunded` part.
  - Wherever the filter dropdown renders `refund_issued` as an option: remove. Grep `src/app/admin/clients/page.tsx` for `refund_issued`.
  - Grep also `src/app/admin/clients/ClientRowMenu.tsx` and any filter component for `refund_issued` to ensure no orphans.

- Edit `src/app/admin/clients/[clientId]/page.tsx:318` — the `case "refunded":` branch. Delete the branch entirely. The function it's in (probably a badge-tone mapper) falls through to default.

**Step 9 — `reporting.ts:438` — `||` → `??`.**

- Edit `src/app/admin/reports/reporting.ts`. Single character change:

```ts
// Line 438:
if (booking.status === "completed") {
  completedRevenue += amount(booking.amount_paid ?? booking.total_price);
}
```

- Add a unit test (or extend existing reporting test) covering: a completed booking with `amount_paid = 0` and `total_price = 80` — assert `completedRevenue` includes `0`, not `80`. New file `src/app/admin/reports/__tests__/completedRevenue-refund-correctness.test.ts` if no existing reporting.test.ts is present, otherwise append.

**Phase E verify checkpoint:**
- `pnpm lint` + `tsc` + `vitest run` all green
- Re-run the pre-flight `completed_count / sum_paid / sum_price` query — if `completedRevenue` calculation in production data changes, the change is correct (was a bug). Document the delta in progress.

---

## 2 — Files touched (final list)

### NEW (3 files)
| File | Purpose |
|---|---|
| `src/app/admin/bookings/__tests__/restoreBooking.test.ts` | Vitest coverage for restore action |
| `src/app/admin/bookings/__tests__/autoPromoteBookingFromAssignments.test.ts` | Vitest coverage for auto-promote helper |
| `src/app/admin/bookings/[bookingId]/NextActionButton.tsx` | (conditional — if Next.js server-component constraints force a client wrapper for the form) |

(Optionally also `src/app/admin/reports/__tests__/completedRevenue-refund-correctness.test.ts` if no existing test file exists at that boundary.)

### EDITED (~10 files)
| File | Change summary |
|---|---|
| `src/app/admin/bookings/actions.ts` | + `restoreBooking`, + `autoPromoteBookingFromAssignments` helper, + `no_show` in `quickUpdateBooking`, + state-machine guard in `updateBookingManagement`, + hook in `updateOwnAssignmentStatus` (+ `updateBookingAssignment` if needed) |
| `src/app/admin/bookings/[bookingId]/page.tsx` | `NextAction` type extension, replace misleading hint, render Restore/no-show action buttons, render Auto-completed banner, modal for reopen-completed via Status form |
| `src/lib/email/notifications.ts` | + `sendBookingRestoredClientEmail` |
| `src/lib/email/templates.ts` | + `renderBookingRestoredEmail` template |
| `src/app/admin/clients/[clientId]/page.tsx` | + `AUDIT_PHRASING` entries for `booking_restored`, `booking_auto_promoted_completed`, `booking_quick_no_show`; − `case "refunded":` branch |
| `src/app/admin/reports/reports-helpers.ts` | − `refunded` + `waived` from `PAYMENT_OPTIONS` |
| `src/app/admin/reports/reporting.ts` | line 438 `||` → `??` (RECON §5 untouchable exception approved per C-B-DECISIONS Q8) |
| `src/app/admin/reports/__tests__/reports-helpers.test.ts` | Update "4 statuses" test to "2 statuses" |
| `src/app/admin/clients/page.tsx` | − `hasRefund` helper, − `refund_issued` filter logic |

### CONDITIONAL (only if email_event_type is enum)
| File | Change |
|---|---|
| `supabase/migrations/<ts>_c04a_booking_restored_email_event.sql` | `ALTER TYPE ... ADD VALUE 'booking_restored_client'` |

### UNCHANGED (do NOT touch)
- `reporting.ts` core exports — only line 438 is the explicit one-char exception. All other exports stay untouched.
- `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- `manage/actions.ts` (customer-facing cancel path).
- `quickUpdateBooking` actions `confirm`/`cancel`/`complete`/`mark_paid` (unchanged — only `no_show` added).
- C-06's `clients/actions.ts` work (separate plan).

---

## 3 — Verification gate (commands + pass criteria)

Run after Phase E lands. Every command must pass.

### 3.1 Static gates

```bash
pnpm lint                       # 0 errors
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline failures preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget for C-04a:** new client component for next-action button (~2 kB) + template renderer additions (~1 kB). Plan ceiling: **+5 kB cumulative** across `/admin/bookings/*`. Hygiene-tail deletions are net-negative bytes.

### 3.2 Playwright role sweep (4 roles × 4 viewports)

Recipe per role:

1. Sign in via the standard pattern. Wait 2-3s.
2. Navigate to a cancelled test booking detail (NOT Badar's). Verify next-action card shows new copy + Restore button per RBAC matrix.
3. (Owner/Admin/Coord) Click Restore → confirm modal → confirm → status flips → toast → audit log shows `booking_restored`.
4. (Owner/Admin/Coord) Navigate to a confirmed past-dated test booking. Verify Mark no-show button visible. Click → confirm → status flips to no_show → audit log shows `booking_quick_no_show`.
5. (Owner/Admin/Coord) Navigate to a completed test booking. Open Status form. Change status to confirmed. Click Save. Verify confirm modal opens. Cancel → no DB change. Re-do → confirm with reason → DB updates, audit log records reason.
6. (Therapist/Therapist-Fresh) Navigate to an assigned booking. Mark own assignment complete via the existing assignment-status form. If this is the last open assignment, observe auto-promote: detail page reloads, booking status now `completed`, "Auto-completed" banner visible.
7. (All roles) Navigate to `/admin/reports`. Verify payment filter dropdown shows 3 options (Any / Paid / Outstanding). No Refunded, no Waived.
8. (All roles) Navigate to `/admin/clients`. Verify the payment-status filter no longer offers "Refund issued".
9. Sign out via `fetch('/admin/signout', ...)`.

**Pre/post DB queries via `mcp__supabase__execute_sql`:**

```sql
-- Before sweep
SELECT id, status, customer_cancelled_at FROM bookings WHERE id = '<test-cancelled-booking>';

-- After Restore action
SELECT id, status, customer_cancelled_at FROM bookings WHERE id = '<same>';
-- Expected: status='confirmed', customer_cancelled_at IS NULL

-- Audit log
SELECT action_type, before_state->>'status' AS from_status,
       after_state->>'restore_target_status' AS to_status,
       after_state->>'reason' AS reason
FROM audit_logs
WHERE target_id = '<test-cancelled-booking>'
  AND action_type IN ('booking_restored', 'booking_auto_promoted_completed', 'booking_quick_no_show')
ORDER BY created_at DESC;
-- Expected: rows for each tested action

-- Email delivery
SELECT event_type, recipient_role, created_at
FROM email_delivery_events
WHERE booking_id = '<test-cancelled-booking>'
  AND event_type = 'booking_restored_client';
-- Expected: 1 row after Restore
```

**Reports correctness check (B-148 fix):**

```sql
-- Find any completed booking with amount_paid = 0 (the case the fix addresses)
SELECT COUNT(*) FROM bookings
WHERE status = 'completed' AND (amount_paid = 0 OR amount_paid IS NULL);
```

If non-zero, verify `/admin/reports` `completedRevenue` reads lower than the pre-fix baseline by exactly the sum of those bookings' `total_price`s.

### 3.3 Screenshot evidence

Capture PNGs:

- 375 + 1280: cancelled booking detail next-action card with new copy + Restore button
- 375 + 1280: Mark no-show button on confirmed past-dated booking
- 375 + 1280: Reopen-completed confirm modal with reason input
- 375: Auto-completed banner on booking that just promoted
- 1280: /admin/reports payment filter (3 options visible)

Store in `redesign/audits/C-A/screenshots-04-bookings-detail/c-04a-after/` (or new directory per C-C convention).

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| `reporting.ts:438` `||→??` changes production revenue figures unexpectedly | low | medium | Pre-flight captures baseline; post-fix compares. Decisions doc Q8 explicitly approves the change. Tax-compliance-correct. |
| Auto-promote race condition (two practitioners completing simultaneously) | low | low | UPDATE WHERE-guard (`NOT IN ('completed','cancelled')`) is atomic at PG level. Audit row only written when UPDATE affected ≥ 1 row. |
| State-machine guard breaks an existing E2E flow that legitimately needs to reopen completed bookings | low | medium | Confirm modal provides escape hatch with reason. Any legitimate flow needs ≤ 5 keystrokes to bypass. Existing flows reopening completed bookings are RARE (1 completed quick row in production audit log per pre-flight). |
| Restore email fails (Resend outage) — restore is rolled back unintentionally | low | low | Email send is wrapped in try/catch; restore proceeds regardless. Pattern mirrors `sendBookingCancellationEmails` invocations. |
| Hygiene-tail removal breaks an existing report URL with `?payment=refunded` query | low | low | The PAYMENT_OPTIONS removal causes the filter to ignore the unknown value (treated as no-filter). No 500 error. Existing URLs may render an empty filter strip. Acceptable. |
| `no_show` quick action fires on a future-dated booking via direct API | low | low | Server-side temporal guard catches it. UI button is conditional on past-dated. |
| Auto-promote on a booking whose status was just manually set to cancelled (race) | low | low | UPDATE WHERE clause includes `NOT IN ('cancelled')`. Cancellation wins; auto-promote no-ops. |
| Restore on a no_show booking that should have stayed no_show (admin misclick) | low | low | Confirm modal requires explicit user action. Restore is reversible (admin can re-cancel via Status form). |
| `email_event_type` is an enum and the new value fails | medium | low | Pre-flight Step 5(b) detects it; conditional migration prepared. |
| Removing `hasRefund` from `clients/page.tsx` breaks a unit test | low | low | grep for usages first; remove all sites in one commit. |

### 4.1 Specific real risk: `reporting.ts` RECON §5

The line 438 change is approved per C-B-DECISIONS Q8 as an explicit one-char exception. Bookkeeping: the RECON §5 doc should be amended after this commit to document the exception. Plan §11 lists this as a deviation.

---

## 5 — Undo procedure

### 5.1 Undo code (Phases A-E)

Each phase is a self-contained git commit. Revert in reverse order:
1. `git revert <phase-E-hygiene-tail-commit>` — reinstates dead refunded/waived references + reverts `||→??` (production reports go back to overstating completedRevenue)
2. `git revert <phase-D-auto-promote-commit>` — removes auto-promote hook + helper
3. `git revert <phase-C-no-show-commit>` — removes `no_show` from `quickUpdateBooking`
4. `git revert <phase-B-state-machine-commit>` — removes the completed-reopen guard (Status form goes back to free-form transitions)
5. `git revert <phase-A-restore-commit>` — removes `restoreBooking` action + Restore button + email — reinstates the misleading "Restore from audit log" copy

If only one phase needs to be undone, revert just that phase's commit. Phases are independent enough.

### 5.2 Undo migration (if email_event_type was migrated)

If a CHECK constraint or enum was modified to allow `booking_restored_client`:

```sql
-- If enum:
-- (PG doesn't support REMOVE VALUE — would need to recreate the enum)
-- Leaving the value in place is safe (no rows reference it if Phase A is reverted).

-- If CHECK constraint was modified:
ALTER TABLE email_delivery_events DROP CONSTRAINT <constraint_name>;
ALTER TABLE email_delivery_events ADD CONSTRAINT <constraint_name> CHECK (event_type IN (<original list>));
```

The leftover enum value is harmless if no rows reference it. Document as a non-issue in the rollback path.

### 5.3 Undo DB state

Restored test bookings can be reset:

```sql
UPDATE bookings
SET status = 'cancelled',
    customer_cancelled_at = '<original timestamp>',  -- from pre-flight capture
    customer_cancellation_note = '<original>'
WHERE id IN ('<test-restored-booking-ids>');
```

Auto-promoted bookings should be left as-is (they were correctly promoted; the audit log records the promotion). Undoing them requires SQL forensics + understanding which assignments were already at terminal states.

---

## 6 — Test fixture guidance (what to use, what NOT to touch)

**Safe for any C-04a E2E walk:**
- Cancelled test bookings (NOT `9d55ce2a`) — create via Owner/Admin "Cancel" quick action against `Audit Test Client 1..5` bookings during pre-flight, OR locate existing ones from prior audit phases.
- Confirmed past-dated test bookings — create by manually setting `booking_date` via SQL to yesterday on a test booking (Zone-2 — explicit user confirmation).
- Completed test bookings — exercise the reopen-guard.

**DO NOT touch:**
- **Badar's `9d55ce2a`** (cancelled, real email `avonrk@hotmail.co.uk`). The handoff flagged this explicitly. Even the Restore button verification must NOT click it.
- Any client whose email matches a real customer pattern.

**Pre-deletion / pre-restore verification SQL:**
```sql
SELECT id, contact_full_name, contact_email, status FROM bookings WHERE id = '<id>';
```
Verify against the safe-fixture list before clicking.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — `restoreBooking` action + Next-action button + email send-fn + template |
| 2 | Phase B — State-machine guard + Status form confirm modal |
| 3 | Phase C — `no_show` quick action + Mark no-show button |
| 4 | Phase D — Auto-promote helper + hooks + banner |
| 5 | Phase E — Hygiene tail (filter UI cleanup + `||→??` fix + test updates) |
| 6 | (conditional) Migration for `email_event_type` if enum-constrained |
| 7 | Verification gate — Playwright screenshots + progress file + master plan checklist row → ✅ |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-04a {phase}` prefix during C-C. Master plan checklist + progress file edits use `chore(redesign): ...`.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. Run §0 Pre-flight in full. Confirm migration-or-no-migration on `email_event_type`.
3. Execute Phase A → B → C → D → E in order.
4. Migration (if needed) is Zone-2 — explicit user confirmation before invoking `mcp__supabase__apply_migration`.
5. Verification gate (§3) non-negotiable.
6. Update `redesign/per-page-progress/C-04a-cancellation-restore-progress.md` as each phase lands.
7. Final commit updates the master plan checklist C-04a row from `⏳` to `✅` with shipped date + commit SHA.
8. After C-04a ships, **C-05 is unblocked** — the lockdown can land next.

---

## 9 — Open questions remaining (for plan-reviewer / user)

Surfaced during plan-writing — not blocking, but worth noting:

1. **Restore button tone visual** — brief Q9.1 went with "outline button inside danger card". Visual designer (you) may want to revise during impl.

2. **Reopen-completed reason length** — set at min-5-chars. Could be 10. Trivial knob — adjust at impl time if 5 feels too lenient.

3. **Auto-promote feedback toast for the practitioner** — the helper returns `{ promoted: true }` but `updateOwnAssignmentStatus` currently doesn't surface this to the form. Optional: extend the action's return to carry the promote flag so the form can show "Booking auto-completed!" toast in addition to the standard "Assignment updated." Decided during impl.

4. **`AUDIT_PHRASING` map location** — currently in `clients/[clientId]/page.tsx:127-138`. The new entries (`booking_restored`, etc.) would more naturally live in `bookings/[bookingId]/page.tsx`. Decide during impl whether to:
   - (a) Add to both files (duplication)
   - (b) Extract to a shared `src/lib/audit-log-phrasing.ts`
   - (c) Keep in `clients/[clientId]` since that's where the client's audit history renders

5. **C-04a progress file pre-creation** — convention from C-06: progress file is filled during C-C, not now. Empty placeholder file is optional during C-B plan-writing.

---

*End of C-04a plan. Brief: `redesign/briefs/C-04a-cancellation-restore-brief.md`. Progress: `redesign/per-page-progress/C-04a-cancellation-restore-progress.md` (filled during C-C).*
