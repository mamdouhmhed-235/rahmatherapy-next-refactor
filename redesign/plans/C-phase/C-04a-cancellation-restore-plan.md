# C-04a — Cancellation restore + delayed-email infra + row-level affordances + auto-promote + hygiene tail — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none hard — C-04a runs second in the Band C main chain, after C-06, whose outputs it does not require (the `clients?.deleted_at` guard in Step 1 is null-safe). Cron dispatch is order-agnostic with C-01 (D3 — Step 12). Downstream: C-05 and C-13 depend on this plan's `_helpers.ts` exports; they verify C-04a landed with `git log --oneline --grep="C-04a" | grep -q "feat(redesign): C-04a"`.
> Decisions: C-B-DECISIONS.md §Q8 (split C-04a / `||`→`??` exception), §Q10 (auto-promote). Refinement resolutions applied: D2, D3, D26. Findings applied: C04a-1..C04a-7 — see refinement changelog.

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Amended:** 2026-07-16 — S7 refinement (user direction): 28-day restore window keyed to the cancellation moment. New `bookings.cancelled_at` column + backfill in the Step 10 migration; guard in `restoreBooking` (step 3.6); stamping in both admin cancel paths; UI hides Restore + distinct copy when expired. Brief §1.11 / §2.1 S7 / §5.12 / §6 are the spec source.
**Brief:** `redesign/briefs/C-04a-cancellation-restore-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-04a-cancellation-restore-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

This plan covers the "how" — execution order, verify-checkpoints, files touched, verification gate, risks + undo. Read the brief first.

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** *(Amended 2026-07-26 — post-merge premise, C04a-6.)* On `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/app/admin/bookings/ src/app/admin/reports/ src/app/admin/clients/ src/lib/email/ src/app/api/cron/ worker-entrypoint.ts wrangler.jsonc supabase/migrations/ src/types/supabase.ts` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted `.playwright-mcp` logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 pre-existing failures in 3 files — ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1 — baseline preserved; not regressions). *(Baseline breakdown added 2026-07-26, rubric §2.)*
4. **Static gates green.** *(Amended 2026-07-26 — C04a-7.)* `pnpm lint` shows no NEW errors vs the 59-error baseline (55 from untracked `design_handoff_area_pages/prototype/*.jsx`, 4 pre-existing in `src/features/booking/`); `npx tsc --noEmit` 0 errors.
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

   -- (d) AMENDMENT 2026-05-26 — verify Change 13 columns don't already exist
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'email_delivery_events'
     AND column_name IN ('scheduled_for', 'html_payload', 'text_payload', 'to_email', 'subject');
   -- expect: 0 rows (all 5 columns to be added by the migration)

   -- (e) AMENDMENT 2026-05-26 — verify BookingRowActions component exists with current shape
   -- (cheap grep, not DB — done via the codebase)
   -- expect: BookingRowAction union at BookingRowActions.tsx:17-22 with 5 actions

   -- (f) ADDED 2026-07-26 (Appendix B schema premise) — delivery_status CHECK constraint.
   SELECT c.conname, pg_get_constraintdef(c.oid) FROM pg_constraint c
   JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'email_delivery_events' AND c.contype = 'c';
   -- expect: one CHECK limiting delivery_status to (accepted, failed, skipped).
   -- Record the conname — Step 10's migration must DROP/re-ADD it extended with the
   -- new lifecycle values (queued, sent, cancelled_by_restore, cancelled_manual),
   -- otherwise every queue insert / status flip this plan performs fails at runtime.
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

8. **Test data DO-NOT-TOUCH list:** Badar's booking `9d55ce2a` (cancelled, real email `avonrk@hotmail.co.uk`). Any client with non-`*.example.test` / non-`Phase10*` / non-`Audit Test*` email — real customer. *(Amended 2026-07-26, rubric §9:)* also the Owner account `rahmatherapy@outlook.com` in email-test paths.

If any pre-flight step fails or reveals unexpected state, **stop** and surface to the user.

---

## 1 — Safe implementation order (8 phases, 14 changes, with verify-checkpoints)

Each phase is committable independently. Verify-checkpoints between phases. Phases A–E are the original C-04a body; Phases F–H were added in the 2026-05-26 amendment (Changes 10–14 + S3/S6 refinements).

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

  // S6 amendment 2026-05-26: past-datetime guard
  // Reject restore when now() > booking_date + start_time (Europe/London zoning).
  // Stricter than C-05's date-only lockdown — see brief §5.8.
  if (isInertSource) {
    const bookingMoment = computeBookingMomentLondon(
      beforeState.booking_date,
      beforeState.start_time
    );
    if (Date.now() > bookingMoment.getTime()) {
      return {
        error: "This booking's appointment time has already passed and cannot be restored.",
      };
    }
  }

  // S7 amendment 2026-07-16: 28-day restore window (cancelled sources only).
  // Keyed to the CANCELLATION moment (S6 is keyed to the appointment moment; both
  // must pass). Unknown cancellation time = expired (fail-closed). no_show sources
  // skip this — they're already dead via S6. Brief §5.12.
  // isRestoreWindowExpired + RESTORE_WINDOW_DAYS live in _helpers.ts (Step 2
  // amendments) — single source shared with the detail-page + row-menu predicates.
  if (beforeState.status === "cancelled" && isRestoreWindowExpired(beforeState)) {
    return {
      error: "This booking was cancelled more than 28 days ago and can no longer be restored.",
    };
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
  // Clear stale cancellation fields on transition out of cancelled (W04 B-125;
  // cancelled_at clearing added by S7 2026-07-16)
  if (beforeState.status === "cancelled") {
    updatePayload.customer_cancelled_at = null;
    updatePayload.customer_cancellation_note = null;
    updatePayload.cancelled_at = null;
  }

  const { data: updatedBooking, error } = await adminClient
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    .select()
    .single();

  if (error) return { error: error.message };

  // Change 13 integration (amendment 2026-05-26): cancel any queued cancellation email
  // for this booking. If matched, the cancellation never left the system — suppress the
  // restore email too, since the client never saw the round-trip.
  const { count: cancelledQueuedCount } = await adminClient
    .from("email_delivery_events")
    .update({ delivery_status: "cancelled_by_restore" }, { count: "exact" })
    .eq("booking_id", bookingId)
    .eq("event_type", "booking_cancellation_customer") // existing constant (notifications.ts) — D2 2026-07-26
    .eq("delivery_status", "queued")
    .gt("scheduled_for", new Date().toISOString());

  const suppressRestoreEmail = (cancelledQueuedCount ?? 0) > 0;

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
      cancelled_queued_email: suppressRestoreEmail,  // Change 14 forensic
    },
  });

  // Client email — skip if the cancel email was killed within its undo window
  // (client never saw the cancellation; no round-trip "restored" message needed).
  if (!suppressRestoreEmail) {
    await sendBookingRestoredClientEmail(bookingId, adminClient, {
      fromStatus: beforeState.status as BookingStatus,
    }).catch((emailError) => {
      console.error("Unable to send restore email to client.", emailError);
    });
  }

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
- **S6 — Past-datetime cancelled booking** (`booking_date+start_time` < now): returns `"This booking's appointment time has already passed and cannot be restored."`. No DB write. No emails.
- **S6 — Same-day morning cancelled, viewed in the afternoon** (`booking_date=today AND start_time < now()`): same rejection. C-05 considers this active for date-only checks; restore is stricter.
- **S6 — Today's afternoon cancelled, viewed in the morning** (`booking_date=today AND start_time > now()`): restore succeeds (datetime in future).
- **S7 (2026-07-16) — Cancelled 27 days ago, appointment next month:** restore succeeds (inside window, future appointment).
- **S7 — Cancelled 29 days ago, appointment next month:** returns `"This booking was cancelled more than 28 days ago and can no longer be restored."`. No DB write. No emails.
- **S7 — Boundary: cancelled exactly 28×24h ago:** restore succeeds; one millisecond past → rejected (strict `>` comparison).
- **S7 — Unknown cancellation time** (`cancelled_at` AND `customer_cancelled_at` both null): rejected with the S7 error (fail-closed).
- **S7 — Customer-cancelled booking (only `customer_cancelled_at` set):** coalesce covers it — window computed from `customer_cancelled_at`.
- **S7 — Completed-reopen 40 days after completion:** NOT windowed — proceeds through the force+reason path (deliberate exemption, brief §5.12).
- **Change 13/14 — Queued cancellation email exists** (`scheduled_for > now() AND delivery_status='queued'`): `cancelled_queued_email=true` in audit; `sendBookingRestoredClientEmail` NOT called; queued row updated to `delivery_status='cancelled_by_restore'`.
- **Change 13/14 — Queued cancellation email already sent** (race: cron fired in the gap): `scheduled_for <= now()` so the UPDATE matches 0 rows; `cancelled_queued_email=false` in audit; `sendBookingRestoredClientEmail` called normally (client gets cancel-then-restore round trip).
- **Change 13/14 — No queued email at all** (natural late restore — hours after cancel): `cancelled_queued_email=false`; restore email sent.

Pattern: lift the existing test scaffolding from `clients/__tests__/updateClient.test.ts` (when C-06 lands) or from any existing booking-action test file. Use vi.fn() for the `createSupabaseAdminClient` factory. For datetime mocking, use `vi.setSystemTime`.

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

**Step 2 amendments (S3 + S6 — 2026-05-26; S7 — 2026-07-16):**

**S6 + S7 — hide the `action` field on past-datetime OR expired-window cancelled/no_show bookings.** In the same branches above, wrap the `action` property with both checks (S7 added 2026-07-16):

```ts
if (booking.status === "cancelled") {
  const bookingMomentPassed = isBookingMomentPastLondon(booking);  // see Phase A helper
  const restoreWindowExpired = isRestoreWindowExpired(booking);    // S7 — see helper below
  return {
    tone: "danger",
    icon: ShieldX,
    headline: "This booking is cancelled.",
    hint: bookingMomentPassed
      ? "The appointment time has already passed — restore is no longer available. The audit log preserves the record."
      : restoreWindowExpired
        ? `Cancelled on ${formatDate(booking.cancelled_at ?? booking.customer_cancelled_at)} — the 28-day restore window has passed. The audit log preserves the record.`
        : "Restore it if it was cancelled by mistake — the client will be notified.",
    action: bookingMomentPassed || restoreWindowExpired
      ? undefined
      : { kind: "restore_booking", targetStatus: "confirmed", label: "Restore booking" },
  };
}
```

Same pattern for `no_show` branch — hide action when past-datetime (S7 check moot there; S6 always fires first).

**S7 helper** — alongside `isBookingMomentPastLondon` in `src/app/admin/bookings/_helpers.ts`:

```ts
export const RESTORE_WINDOW_DAYS = 28; // S7 2026-07-16 — tunable

export function isRestoreWindowExpired(booking: {
  cancelled_at: string | null;
  customer_cancelled_at: string | null;
}): boolean {
  const raw = booking.cancelled_at ?? booking.customer_cancelled_at;
  if (!raw) return true; // unknown cancellation time = expired (fail-closed)
  return Date.now() - new Date(raw).getTime() > RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
```

Single source: the server action (Step 1 guard 3.6), this UI predicate, and the row-menu condition (Change 12) all use `isRestoreWindowExpired`. For unknown-time rendering, the hint falls back to the generic "the 28-day restore window has passed" copy without a date.

Helper `isBookingMomentPastLondon(booking)` lives in `src/app/admin/bookings/_helpers.ts` (the same shared util C-05 introduces — see C-05 plan Step 8). Implementation:

```ts
export function isBookingMomentPastLondon(booking: {
  booking_date: string;
  start_time: string;
}): boolean {
  // booking_date is "YYYY-MM-DD", start_time is "HH:MM:SS"
  // Construct as Europe/London local time, compare to now()
  // Use date-fns-tz if available, else manual offset (BST/GMT switching)
  const moment = computeBookingMomentLondon(booking.booking_date, booking.start_time);
  return Date.now() > moment.getTime();
}
```

Lifting / cross-coordinating with C-05 — if C-05 ships first, this helper already exists; if C-04a ships first, C-04a creates it and C-05 imports.

> **Coordination note (2026-07-26, rubric §10):** This plan creates `src/app/admin/bookings/_helpers.ts` (it does not exist on `master` @ `ea97932`). C-05 and C-13 both extend it — land this plan first, and do not remove/rename any exported helper C-05/C-13's plans reference by name (`isBookingMomentPastLondon`, `computeBookingMomentLondon`, `isRestoreWindowExpired`, `RESTORE_WINDOW_DAYS`).

**S3 — Restore confirm modal shows prior cancellation reason.** The `NextActionButton` client component composes the modal body from booking context:

```tsx
function buildRestoreConfirmBody(booking: BookingRecord, auditLogs?: AuditLog[]): React.ReactNode {
  const customerNote = booking.customer_cancellation_note;
  const lastCancelAudit = auditLogs?.find(
    (row) =>
      row.target_id === booking.id &&
      row.action_type === "booking_management_updated" &&
      (row.after_state as { status?: string })?.status === "cancelled"
  );
  return (
    <div className="space-y-2">
      <p>Restore this booking?</p>
      {customerNote ? (
        <p className="text-sm text-[var(--admin-text-muted)]">
          Customer's note: "{customerNote}"
        </p>
      ) : lastCancelAudit ? (
        <p className="text-sm text-[var(--admin-text-muted)]">
          Cancelled by {lastCancelAudit.actor_name ?? "unknown"} on{" "}
          {formatDate(lastCancelAudit.created_at)}.
        </p>
      ) : null}
      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--admin-text-muted)]">
        <li>Status will change from cancelled to confirmed.</li>
        <li>The client will be emailed: "your booking is back on".</li>
        <li>Assigned staff will be notified.</li>
        <li>Audit log records the restore.</li>
      </ul>
    </div>
  );
}
```

`actor_name` requires a join on `staff_profiles.name` — fetch with the booking's audit log SELECT (the page already SELECTs audit_logs for the audit-log section). Verify the SELECT shape includes `actor_staff_id` and join to staff_profiles inline OR cache the join in a helper.

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
- `pnpm lint` no NEW errors vs the 59-error baseline (see §0 step 4 — 2026-07-26 consistency fix)
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

### Phase F — Delayed-email infrastructure (Change 13 — amendment 2026-05-26)

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: apply the C-04a scheduled-emails + `bookings.cancelled_at` migration to production project twzutkfgqclqurvkmvqz via `mcp__supabase__apply_migration`
> Exact SQL / change: the full migration SQL in the Step 10 body below (plus the `delivery_status` CHECK extension in the schema-premise note beneath it) — show it to the user verbatim before invoking. Backfill 2 depends on the `audit_logs.after_state` JSON shape verified at pre-flight §0.5; do not apply until that verification has been shown.
> Post-action verification: the two queries in Step 10's "Verify via" block (5 columns present; stamped/unstamped coverage counts reported to the user) + `pg_get_constraintdef` shows the extended `delivery_status` CHECK
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 10 — Migration: add scheduled-email columns + index.**

Zone-2 — explicit user confirmation before applying.

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

COMMENT ON COLUMN email_delivery_events.scheduled_for IS
  'When set, this row is queued for a scheduled-emails cron tick. NULL = immediate send (legacy semantics).';
COMMENT ON COLUMN email_delivery_events.html_payload IS
  'Rendered HTML body stored alongside scheduled_for so the cron can dispatch without re-rendering.';

-- S7 amendment 2026-07-16: 28-day restore window needs a unified cancellation timestamp.
ALTER TABLE bookings ADD COLUMN cancelled_at timestamptz;
COMMENT ON COLUMN bookings.cancelled_at IS
  'When the booking was last cancelled (any path). Cleared on restore. S7 restore-window key; customer_cancelled_at remains the customer-flow-specific record.';

-- S7 Backfill 1: customer-cancelled rows carry their own timestamp already.
UPDATE bookings SET cancelled_at = customer_cancelled_at
WHERE status = 'cancelled' AND customer_cancelled_at IS NOT NULL;

-- S7 Backfill 2 (best-effort): admin-cancelled rows from the latest cancel audit row.
-- Pre-flight MUST verify the after_state JSON shape before trusting this (adjust the
-- path if the cancel flow stores a different key). Rows neither backfill reaches stay
-- NULL → treated as window-expired (fail-closed, brief §5.12).
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

**Schema premise (added 2026-07-26 — Appendix B, production snapshot 2026-07-25):** `email_delivery_events.delivery_status` is NOT free-form — it carries `CHECK (delivery_status IN ('accepted','failed','skipped'))`. Of the lifecycle values this plan writes, `'queued'` (Step 11 insert), `'sent'` (Step 12 cron flip), `'cancelled_by_restore'` (Step 1 suppression), and `'cancelled_manual'` (§5.1/§5.2 rollback) all violate that CHECK — only `'failed'` is already allowed. The migration MUST therefore also extend the CHECK; include this DDL in the same migration file and surface it at the HARD-STOP alongside the block above (pre-flight §0.5(f) records the constraint name):

```sql
ALTER TABLE email_delivery_events DROP CONSTRAINT <conname from pre-flight §0.5(f)>;
ALTER TABLE email_delivery_events ADD CONSTRAINT email_delivery_events_delivery_status_check
  CHECK (delivery_status IN ('accepted','failed','skipped','queued','sent','cancelled_by_restore','cancelled_manual'));
```

File path: `supabase/migrations/<ts>_c04a_scheduled_emails.sql`. Generate timestamp via `date +%Y%m%d%H%M%S`.

Apply via `mcp__supabase__apply_migration` with `project_id='twzutkfgqclqurvkmvqz'`. Verify via:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'email_delivery_events'
  AND column_name IN ('scheduled_for', 'html_payload', 'text_payload', 'to_email', 'subject');
-- expect 5 rows

-- S7: column present + backfill coverage snapshot
SELECT COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL) AS stamped,
       COUNT(*) FILTER (WHERE cancelled_at IS NULL) AS unstamped_will_be_unrestorable
FROM bookings WHERE status = 'cancelled';
-- Report both numbers to the user post-migration.
```

Run `mcp__supabase__generate_typescript_types` after, save to `src/types/supabase.ts`.

**Step 11 — Extend `sendTrackedEmail` with `delaySeconds`.**

*(Rewritten 2026-07-26 — C04a-5/C04a-3/D2: the previous sketch assumed an exported function with a narrower input and a raw-insert immediate path, and introduced a non-existent event-type string; reconciled against the real `notifications.ts` @ `ea97932`.)*

> **Coordination note (2026-07-26, rubric §10 / D26):** re-grep for the current anchor before editing; prior Band C plans may have shifted line positions; expect C-08's edits in this region — `sendBookingCancellationEmails` may already contain admin-leg (admin-recipient) changes when this step runs. C-01, C-02 and C-13 also touch `notifications.ts`. Landing order keeps C-04a first, but never assume it.

Edit `src/lib/email/notifications.ts`. Current reality (verified 2026-07-26): `sendTrackedEmail` is a **private (non-exported)** function at `notifications.ts:262` with an inline input type `{ bookingId: string; eventType: string; recipientRole: string; staffId?: string | null; to: string | null; subject: string; html: string; text: string }`. Its body: missing `to` → `recordEmailDeliveryEvent(..., deliveryStatus: "skipped")`; otherwise `sendEmail(...)` then `recordEmailDeliveryEvent(...)` with `accepted`/`failed`. Keep it private — no caller outside this module needs it (restore-side suppression operates on `email_delivery_events` rows, not on this function).

Extend the existing inline input type with `delaySeconds?: number` and insert the queue branch AFTER the missing-recipient skip guard and BEFORE the immediate-send try/catch:

```ts
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
    delaySeconds?: number; // NEW — Change 13
  }
) {
  if (!input.to) {
    // ... existing "skipped" recordEmailDeliveryEvent path — UNCHANGED
  }

  // NEW — Change 13 queue branch
  if (input.delaySeconds && input.delaySeconds > 0) {
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
      delivery_status: "queued", // requires Step 10's CHECK extension
    });
    if (error) throw new Error(`Failed to queue scheduled email: ${error.message}`);
    return { status: "queued" as const, scheduledFor };
  }

  // ... existing immediate-send path (sendEmail + recordEmailDeliveryEvent) — UNCHANGED
}
```

The queue branch writes the delivery-event row directly (the queued row IS the delivery event — the Step 12 cron later flips it to `sent`/`failed`); the immediate path keeps using `recordEmailDeliveryEvent`. The new `"queued"` return variant is non-breaking — existing callers ignore the return value (confirm with `git grep -n "sendTrackedEmail(" src/lib/email/`).

**Diff-review checkpoint** *(added 2026-07-26 — review gap):* this is an edit inside a real ~55-line function, not a green-field paste. Before committing, run `git diff src/lib/email/notifications.ts` and confirm the skip guard, the `sendEmail` call, both `recordEmailDeliveryEvent` legs, and the `staffId` threading are all still present and unchanged.

Extend `sendBookingCancellationEmails` (`notifications.ts:385` — re-grep the anchor) by ADDING `delaySeconds` to its EXISTING options — do NOT replace the options type. The function currently takes `options: { initiatedBy: "customer" | "admin"; cancellationNote?: string | null } = { initiatedBy: "admin" }` and sends three legs in a `Promise.all`: customer (`eventType: "booking_cancellation_customer"` — the existing constant, kept per D2), admin (`booking_cancellation_admin`, rendered with `initiatedBy`/`cancellationNote`), and `sendAssignedStaffBookingChangeEmails`. All of that behaviour stays:

```ts
export async function sendBookingCancellationEmails(
  bookingId: string,
  supabase: SupabaseClient,
  options: {
    initiatedBy: "customer" | "admin";
    cancellationNote?: string | null;
    delaySeconds?: number; // NEW — Change 14 undo window
  } = { initiatedBy: "admin" }
) {
  // ... existing body UNCHANGED except ONE line: the customer-leg
  // sendTrackedEmail call (eventType "booking_cancellation_customer") gains
  //     delaySeconds: options.delaySeconds,
  // The admin leg and the assigned-staff leg stay immediate — the undo
  // window exists to spare the CUSTOMER a round-trip; internal recipients
  // keep real-time notice (brief §5.9 covers the race semantics).
}
```

Existing callers (`actions.ts:214-216`, `actions.ts:424-426`, and `manage/actions.ts`) pass `{ initiatedBy: ... }` and compile unchanged — the extension is additive. Phase H's call sites must keep passing `initiatedBy` alongside the new `delaySeconds` (see Step 14), since `initiatedBy` remains required whenever an options object is supplied.

- Verify *(added 2026-07-26, rubric §7)*: `npx tsc --noEmit` green; `git grep -n "booking_cancellation_customer" src/lib/email/notifications.ts src/app/admin/bookings/actions.ts` shows both the send site and (after Step 1) the restore-suppression filter using the same string — the Change 13/14 suppression path depends on this exact match (D2).

**Step 12 — Cron route + worker registration.**

New file `src/app/api/cron/scheduled-emails/route.ts` — copy the verify-secret pattern from `src/app/api/cron/booking-reminders/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resend, senderAddress } from "@/lib/email/resend";

export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: queued, error } = await supabase
    .from("email_delivery_events")
    .select("*")
    .lte("scheduled_for", nowIso)
    .eq("delivery_status", "queued")
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!queued?.length) return NextResponse.json({ sent: 0, total: 0 });

  let sent = 0;
  const failures: string[] = [];

  for (const row of queued) {
    try {
      await resend.emails.send({
        from: senderAddress,
        to: row.to_email!,
        subject: row.subject!,
        html: row.html_payload!,
        text: row.text_payload!,
      });
      await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "sent" })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      failures.push(`${row.id}: ${(err as Error).message}`);
      await supabase
        .from("email_delivery_events")
        .update({ delivery_status: "failed" })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ sent, total: queued.length, failures });
}
```

Register in `worker-entrypoint.ts` *(rewritten 2026-07-26 — C04a-1/C04a-2/D3)*:

Current reality (verified 2026-07-26 @ `ea97932`): `worker-entrypoint.ts` (103 lines) has a single unconditional `scheduled()` handler — `ctx.waitUntil(fireBookingReminders(env))` at lines 91-99. There is NO dispatch switch, routing table, `handle()`, or `handleScheduledTask()` anywhere in the file, and `wrangler.jsonc` has exactly ONE cron trigger: `"0 8 * * *"` (booking-reminders, daily 08:00 UTC). C-01's review-emails cron does not exist yet.

**Order-agnostic instruction (D3):** if `scheduled()` still has no cron-dispatch switch when this step runs (the current state), BUILD it — dispatch on `event.cron` (the `ScheduledControllerLike.cron` field, which carries the triggering cron expression exactly as written in `wrangler.jsonc` `triggers.crons`). If C-01 (or C-02) landed first and a switch already exists, ADD one case. Neither this plan nor C-01 may assume the other landed. Re-grep for the current `scheduled()` body before editing; prior Band C plans may have shifted line positions; expect C-01/C-02's edits in this region (rubric §10).

```ts
// worker-entrypoint.ts — scheduled() body becomes a dispatch on the firing cron:
async scheduled(
  event: ScheduledControllerLike,
  env: CronEnv,
  ctx: ExecutionCtxLike
): Promise<void> {
  switch (event.cron) {
    case "0 8 * * *": // booking-reminders (existing daily cron)
      ctx.waitUntil(fireBookingReminders(env));
      break;
    case "* * * * *": // scheduled-emails (C-04a — every minute)
      ctx.waitUntil(fireScheduledEmails(env));
      break;
    default:
      // Unknown cron (e.g. registered by a plan that landed after this file
      // was last edited) — log, never throw.
      console.error(`[scheduled] no handler for cron "${event.cron}"`);
  }
}
```

`fireScheduledEmails(env)` mirrors `fireBookingReminders` (same `WORKER_SELF_REFERENCE.fetch` + `CRON_SECRET` guard + logging), targeting `https://internal.invalid/api/cron/scheduled-emails`. **Consistency check:** the existing booking-reminders pattern is POST + `X-Cron-Secret` header, while the route sketch above shows GET + `Authorization: Bearer` — pick ONE pair and keep the worker call and the new route's secret check consistent (copying the booking-reminders POST + `X-Cron-Secret` pattern verbatim is the lower-friction choice).

Add to `wrangler.jsonc` cron triggers — APPEND to whatever the array currently holds (do not rewrite entries other plans may have added):

```jsonc
{
  "triggers": {
    // Today the array is ["0 8 * * *"] (booking-reminders). After this step it
    // also contains "* * * * *" (scheduled-emails). C-01's review-emails cron
    // may or may not be present — leave any other entry untouched.
    "crons": ["0 8 * * *", "* * * * *"]
  }
}
```

- Verify *(added 2026-07-26, rubric §7)*: `npx tsc --noEmit` green (the worker file is in the tsc pass); `git grep -n "event.cron\|fireScheduledEmails" worker-entrypoint.ts` shows the switch + the new handler; `grep -n "crons" wrangler.jsonc` shows both entries. The new cron only fires after the next Cloudflare deploy — until then, drain queued rows via the manual `curl` in the Phase F checkpoint.

**Phase F verify checkpoint:**
- Migration applied; columns exist; index exists.
- `npx tsc --noEmit` green after types regen.
- New unit test for the cron route's queued-row handling (mock Resend; assert status flip).
- Manual cron-fire test via `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/scheduled-emails` — should return `{ sent: 0, total: 0 }` when no queued rows exist.
- *(Added 2026-07-26 — Appendix B premise)* `pg_get_constraintdef` on `email_delivery_events` shows the extended `delivery_status` CHECK admitting `queued`/`sent`/`cancelled_by_restore`/`cancelled_manual`.
- *(Added 2026-07-26 — review gap)* **End-to-end suppression proof** (runs once Phase H's `delaySeconds: 10` wiring is in — schedule it before final sign-off, not necessarily inside Phase F's commit): cancel a test booking (queues the customer email), restore it within 10s, then assert the suppression path actually matched a real row — the queued row's `delivery_status` = `'cancelled_by_restore'` AND the `booking_restored` audit row has `after_state.cancelled_queued_email = true` (i.e. `cancelledQueuedCount > 0`). This proves Step 1's filter (`event_type = 'booking_cancellation_customer'`) matches the send-site constant end-to-end and guards against silent event-type drift (C04a-4).

### Phase G — Row-level Restore + status-aware row menu (Changes 10-12 — amendment 2026-05-26)

**Step 13 — Extend `BookingRowAction` union + `quickUpdateBooking` delegation.**

Edit `src/app/admin/bookings/BookingRowActions.tsx:17-22`:

```ts
export type BookingRowAction =
  | "confirm"
  | "mark_paid"
  | "cancel"
  | "complete"
  | "no_show"   // (from Change 5 — Phase C)
  | "restore"   // NEW Change 10
  | "send_reminder";
```

Edit `src/app/admin/bookings/actions.ts:quickUpdateBooking` — at the top of the function body, before the existing `action` switch, add:

```ts
if (action === "restore") {
  // Change 11: delegate to the full restoreBooking semantics
  return restoreBooking(formData);
}
```

The remaining switch handles `confirm | mark_paid | cancel | complete | no_show | send_reminder` as before.

**Step 13b — `runQuickAction` restore case + status-aware menu.**

In `BookingRowActions.tsx`, extend the `runQuickAction` switch (~lines 117-155):

```tsx
async function runQuickAction(action: BookingRowAction) {
  // ... existing send_reminder + concurrency guards

  if (action === "restore") {
    // S6 guard short-circuit
    if (isBookingMomentPastLondon({ booking_date: bookingDate, start_time: startTime })) {
      toast.error("This booking's appointment time has already passed.");
      return;
    }
    setPendingAction(action);
    try {
      const formData = new FormData();
      formData.set("booking_id", bookingId);
      formData.set("action", "restore");
      const result = await quickUpdateBooking(formData);
      if (result.error) {
        toast.error(friendlyError(result.error, "quick"));
        return;
      }
      toast.success("Booking restored. The client has been notified.");
      router.refresh();
    } catch (error) {
      console.error("[bookings] restore failed", { bookingId, error });
      toast.error("Couldn't restore that booking. Try again.");
    } finally {
      setPendingAction(null);
    }
    return;
  }

  // ... rest of existing switch
}
```

**Step 13c — Status-aware menu rendering.**

In the JSX where the menu items are rendered (find the popover content area), wrap the action set in a status branch:

```tsx
{(status === "cancelled" || status === "no_show") ? (
  isBookingMomentPastLondon({ booking_date: bookingDate, start_time: startTime }) ? (
    <button
      type="button"
      role="menuitem"
      disabled
      className="..."
    >
      No actions available (appointment time has passed)
    </button>
  ) : isRestoreWindowExpired({ cancelled_at: cancelledAt, customer_cancelled_at: customerCancelledAt }) ? (
    /* S7 amendment 2026-07-16 — distinct expired-window reason */
    <button
      type="button"
      role="menuitem"
      disabled
      className="..."
    >
      No actions available (28-day restore window has passed)
    </button>
  ) : (
    <button
      type="button"
      role="menuitem"
      onClick={() => runQuickAction("restore")}
      className="..."
    >
      <RotateCcw className="size-4" aria-hidden="true" /> Restore booking
    </button>
  )
) : (
  <>
    {/* Existing menu items — Confirm, Mark paid, Cancel, Complete, Mark no-show, Send reminder */}
    {/* No change to this block */}
  </>
)}
```

Pass `booking_date` + `start_time` + (S7) `cancelled_at` + `customer_cancelled_at` through Props (extend the `Props` type at lines 24-33 with `bookingDate: string; startTime: string; cancelledAt: string | null; customerCancelledAt: string | null;`). The list-page component at `page.tsx:916` passes them through.

> **Coordination note (2026-07-26, rubric §10):** `admin/bookings/page.tsx` is edited by C-05 (`filterBookings`, :148-258), C-16 (pagination, :438-446) and C-13 (extracts the row `<article>` block :804-927 — after C-13 lands, the `BookingRowActions` call site moves into `BookingCard.tsx`). Re-grep for the current call site (`git grep -n "<BookingRowActions" src/app/admin/bookings/`) before threading the new props; prior Band C plans may have shifted line positions; expect C-05/C-16/C-13's edits in this region.

**Step 13d — Vitest spec for `quickUpdateBooking` action=restore.**

New file `src/app/admin/bookings/__tests__/quickUpdateBookingRestore.test.ts`:
- action=restore on cancelled booking: delegates to `restoreBooking`, returns success.
- action=restore on past-datetime cancelled booking: returns S6 error.
- action=restore on booking cancelled >28 days ago: returns S7 error (2026-07-16).
- action=restore on confirmed booking: returns "Only cancelled, no-show, or completed bookings can be restored."
- action=restore without booking_id: error.

**Phase G verify checkpoint:**
- Lint + tsc green.
- Playwright manual: at `/admin/bookings?status=cancelled` (after C-05 N1 lands — see soft co-ship note in brief §8), find a cancelled row → click overflow menu → only "Restore booking" visible → click → confirm modal → confirm → row re-renders as confirmed.
- Past-datetime cancelled row's overflow menu shows the "No actions available" disabled item.

### Phase H — Cancel-with-Undo toast (Change 14 — amendment 2026-05-26)

**Step 14 — Wire delaySeconds=10 into cancellation paths (+ S7 `cancelled_at` stamping).**

Edit `src/app/admin/bookings/actions.ts`. In `updateBookingManagement` (~line 213-227 — the existing cancellation email broadcast):

```ts
if (data.status === "cancelled" && beforeState.status !== "cancelled") {
  await sendBookingCancellationEmails(bookingId, adminClient, {
    initiatedBy: "admin", // existing argument at this call site — KEEP (C04a-3, 2026-07-26)
    delaySeconds: 10,  // NEW — Change 14 undo window
  });
}
```

In `quickUpdateBooking` action=cancel branch (~line 423-437), similarly:

```ts
if (action === "cancel" && beforeState.status !== "cancelled") {
  await sendBookingCancellationEmails(bookingId, adminClient, {
    initiatedBy: "admin", // existing argument at this call site — KEEP (C04a-3, 2026-07-26)
    delaySeconds: 10,
  });
}
```

**S7 stamping (2026-07-16):** in BOTH branches above, the UPDATE payload that sets `status = 'cancelled'` additionally sets `cancelled_at: new Date().toISOString()`. (The customer cancel path in `manage/actions.ts` stays untouched — it already stamps `customer_cancelled_at`, covered by the guard's coalesce.) Re-cancelling after a restore re-stamps, restarting the window (brief §5.12). If Phase H is implemented after Phase A in the same window (expected), the stamping can land with Phase A's action edits instead — implementer's call; either way both admin cancel paths stamp before C-05 ships.

**Step 14b — Toast Undo affordance on list-row cancel.**

In `BookingRowActions.tsx:runQuickAction` case `cancel` (~line 145-147), replace the current `toast.success("Booking cancelled. The client has been notified.")` with:

```tsx
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
        toast.success("Cancellation undone.");
      }
      router.refresh();
    },
  },
  duration: 10_000,
});
```

**Step 14c — Toast Undo on detail-page Status form cancel.**

In `bookings/[bookingId]/page.tsx` (the Status form's success handler — find the `useActionState` consumer for `updateBookingManagement`), apply the same toast pattern when the form transitions a booking to `cancelled`. The form's response state needs a flag indicating "this was a cancellation transition" so the toast logic can differentiate from other status changes:

```ts
// In updateBookingManagement return value:
return {
  success: true,
  cancelledWithUndoWindow: data.status === "cancelled" && beforeState.status !== "cancelled",
};
```

Client-side:

```tsx
useEffect(() => {
  if (state?.success && state?.cancelledWithUndoWindow) {
    toast.success("Booking cancelled. The client will be notified in 10 seconds.", {
      action: { label: "Undo", onClick: () => restoreFromForm(bookingId) },
      duration: 10_000,
    });
  } else if (state?.success) {
    toast.success("Booking updated.");
  }
}, [state]);
```

**Step 14d — Edge-case handling.**

Per brief §5.9 — if `restoreBooking` finds the queued email has already fired (race: cron processed within the gap), the audit `cancelled_queued_email=false`. The Undo toast should NOT chain into a follow-up "client got the email anyway" toast; the standard "Cancellation undone." messaging is sufficient. The client will receive a "your booking is back on" email automatically (Change 1 step 8) since `suppressRestoreEmail` is false in that case — honest round-trip.

**Step 14e — Vitest spec extension.**

In `bookings/__tests__/quickUpdateBookingCancel.test.ts` (extend existing or create):
- cancel → email_delivery_events row inserted with `scheduled_for ≈ now()+10s`, `delivery_status='queued'`, payload columns populated.
- cancel + immediate restore via action=restore → queued row updated to `delivery_status='cancelled_by_restore'`.
- cancel + wait 10s + manually call scheduled-emails cron → queued row flips to `delivery_status='sent'`; Resend send fn called.

**Phase H verify checkpoint:**
- Lint + tsc green.
- Playwright manual: cancel a row → success toast with Undo button → click Undo within 10s → status reverts → "Cancellation undone." → verify no email in `email_delivery_events` with `delivery_status='sent'` for this booking.
- Same flow but let toast expire → wait ≥ 60s → verify cron fired the email (`delivery_status='sent'`).

---

## 2 — Files touched (final list)

### NEW (6 files)
| File | Purpose |
|---|---|
| `src/app/admin/bookings/__tests__/restoreBooking.test.ts` | Vitest coverage for restore action (incl. S6 datetime guard + S7 window guard + queued-email cancellation paths) |
| `src/app/admin/bookings/__tests__/autoPromoteBookingFromAssignments.test.ts` | Vitest coverage for auto-promote helper |
| `src/app/admin/bookings/__tests__/quickUpdateBookingRestore.test.ts` | Vitest for Change 11 (action=restore delegation) |
| `src/app/admin/bookings/[bookingId]/NextActionButton.tsx` | (conditional — if Next.js server-component constraints force a client wrapper for the form) |
| `src/app/api/cron/scheduled-emails/route.ts` | NEW cron entrypoint (Change 13c) |
| `supabase/migrations/<ts>_c04a_scheduled_emails.sql` | Zone-2 migration (Change 13a) |

(Optionally also `src/app/admin/reports/__tests__/completedRevenue-refund-correctness.test.ts` if no existing test file exists at that boundary.)

### EDITED (~14 files)
| File | Change summary |
|---|---|
| `src/app/admin/bookings/actions.ts` | + `restoreBooking` (with S6 datetime guard + S7 28-day window guard + queued-email cancellation), + `autoPromoteBookingFromAssignments` helper, + `no_show` + `restore` in `quickUpdateBooking`, + state-machine guard in `updateBookingManagement`, + `delaySeconds: 10` wiring + S7 `cancelled_at` stamping in both cancellation branches, + hook in `updateOwnAssignmentStatus` (+ `updateBookingAssignment` if needed) |
| `src/app/admin/bookings/[bookingId]/page.tsx` | `NextAction` type extension, replace misleading hint, render Restore/no-show action buttons (S6-conditional), render Auto-completed banner, modal for reopen-completed via Status form with S3 reason display, wire Undo toast on Status-form cancel |
| `src/app/admin/bookings/BookingRowActions.tsx` | + `restore` in `BookingRowAction` union, + `runQuickAction` restore case, + status-aware menu rendering (Change 12), + Undo toast on cancel (Change 14) |
| `src/app/admin/bookings/_helpers.ts` | + `isBookingMomentPastLondon` + `computeBookingMomentLondon` (shared with C-05 — see C-05 plan Step 8) + `isRestoreWindowExpired` + `RESTORE_WINDOW_DAYS` (S7 2026-07-16) |
| `src/lib/email/notifications.ts` | + `sendBookingRestoredClientEmail`; + `delaySeconds` on `sendTrackedEmail` + `sendBookingCancellationEmails` |
| `src/lib/email/templates.ts` | + `renderBookingRestoredEmail` template |
| `src/app/admin/clients/[clientId]/page.tsx` | + `AUDIT_PHRASING` entries for `booking_restored`, `booking_auto_promoted_completed`, `booking_quick_no_show`; − `case "refunded":` branch |
| `src/app/admin/reports/reports-helpers.ts` | − `refunded` + `waived` from `PAYMENT_OPTIONS` |
| `src/app/admin/reports/reporting.ts` | line 438 `||` → `??` (RECON §5 untouchable exception approved per C-B-DECISIONS Q8) |
| `src/app/admin/reports/__tests__/reports-helpers.test.ts` | Update "4 statuses" test to "2 statuses" |
| `src/app/admin/clients/page.tsx` | − `hasRefund` helper, − `refund_issued` filter logic |
| `worker-entrypoint.ts` | Build the `event.cron` dispatch switch if absent, else add a case (D3 2026-07-26 — order-agnostic with C-01); add `fireScheduledEmails` targeting `/api/cron/scheduled-emails` (Change 13c) |
| `wrangler.jsonc` | Add `* * * * *` cron schedule — appended to the existing `["0 8 * * *"]` array (Change 13c; C04a-2 2026-07-26) |
| `src/types/supabase.ts` | Regenerated post-migration via `mcp__supabase__generate_typescript_types` |

### CONDITIONAL (only if email_event_type is enum)
| File | Change |
|---|---|
| `supabase/migrations/<ts>_c04a_booking_restored_email_event.sql` | `ALTER TYPE ... ADD VALUE 'booking_restored_client'` |

*(2026-07-26 — Appendix B: `event_type` is verified free text with no CHECK, so this conditional migration is expected NOT to be needed. If pre-flight §0.5(b) contradicts that, applying it is likewise Zone-2 — reuse the ⛔ HARD-STOP gate format from Step 10.)*

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
pnpm lint                       # no NEW errors vs the 59-error baseline (C04a-7, 2026-07-26)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline failures preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget for C-04a:** new client component for next-action button (~2 kB) + template renderer additions (~1 kB) + amendment 2026-05-26 additions (BookingRowActions extensions ~1.5 kB + cron route is server-only, no bundle impact). Plan ceiling: **+7 kB cumulative** across `/admin/bookings/*`. Hygiene-tail deletions are net-negative bytes.

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
9. **(Owner/Admin/Coord) Row-level Restore via list (Phase G)** — Navigate to `/admin/bookings?status=cancelled` (requires C-05 N1 to be merged first; if not, force-navigate to any view that shows cancelled rows). On a cancelled row, open the overflow menu. Verify ONLY "Restore booking" is visible (Change 12 status-aware menu). Click → confirm modal opens with the prior cancellation reason (S3) → confirm → row updates to confirmed status. Verify via DB:
    ```sql
    SELECT status FROM bookings WHERE id = '<test-cancelled-id>';
    -- Expected: 'confirmed'
    SELECT action_type FROM audit_logs WHERE target_id = '<test-cancelled-id>'
      AND created_at > now() - interval '1 minute';
    -- Expected: includes 'booking_restored'
    ```
10. **(Owner/Admin/Coord) Cancel-with-Undo toast (Phase H)** — On a confirmed row, click Cancel via overflow menu. Verify success toast appears with "Booking cancelled. The client will be notified in 10 seconds." + Undo button. Click Undo within 10s. Verify "Cancellation undone." toast. Verify via DB:
    ```sql
    SELECT delivery_status FROM email_delivery_events
    WHERE booking_id = '<test-booking>' AND event_type = 'booking_cancellation_customer' -- D2 2026-07-26
    ORDER BY created_at DESC LIMIT 1;
    -- Expected: 'cancelled_by_restore'
    ```
11. **(Owner/Admin/Coord) Cancel + let toast expire** — Cancel another confirmed booking; do not click Undo. Wait ≥ 65s (one full cron tick). Verify:
    ```sql
    SELECT delivery_status, scheduled_for FROM email_delivery_events
    WHERE booking_id = '<test-booking-2>' AND event_type = 'booking_cancellation_customer' -- D2 2026-07-26
    ORDER BY created_at DESC LIMIT 1;
    -- Expected: delivery_status='sent', scheduled_for in the past
    ```
12. **(Owner) Past-datetime restore disallowed (S6)** — Back-date a test booking via SQL to yesterday with a morning start_time. Cancel it. Attempt restore via row-level menu — verify menu shows "No actions available (appointment time has passed)" (disabled). Attempt restore via detail-page next-action card — verify card has no Restore button. Direct POST to `restoreBooking` with the booking_id returns structured error. No DB change.
12b. **(Owner, S7 2026-07-16) Expired-window restore disallowed** — On a FUTURE-dated cancelled test booking, back-date `cancelled_at` via SQL to 29 days ago. Verify: row menu shows "No actions available (28-day restore window has passed)" (disabled); detail card shows the "Cancelled on {date} — the 28-day restore window has passed" hint with no button; direct POST returns the S7 structured error; no DB change. Reset `cancelled_at` to 5 days ago → Restore button reappears and restore succeeds (proves the boundary is the window, not the fixture).
13. **(Owner) Scheduled-emails cron route** — Manually invoke via `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/scheduled-emails`. With no queued rows: `{ sent: 0, total: 0 }`. With one queued row past scheduled_for: `{ sent: 1, total: 1 }` + row's `delivery_status` flips to 'sent'.
14. Sign out via `fetch('/admin/signout', ...)`.

**Pre/post DB queries via `mcp__supabase__execute_sql`:**

```sql
-- Before sweep
SELECT id, status, customer_cancelled_at FROM bookings WHERE id = '<test-cancelled-booking>';

-- After Restore action
SELECT id, status, customer_cancelled_at FROM bookings WHERE id = '<same>';
-- Expected: status='confirmed', customer_cancelled_at IS NULL, cancelled_at IS NULL (S7)

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

Store in `redesign/evidence/C-04a/` *(evidence convention 2026-07-26, rubric §8 / D15 — never write into `redesign/audits/**`; the old `redesign/audits/C-A/screenshots-...` target is superseded)*.

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
| **Scheduled-emails cron route fails to register** (worker dispatch misroute) | low | medium | Phase F verify checkpoint includes manual `curl` test before relying on the cron. If misrouted, queued emails accumulate; the `idx_email_delivery_events_scheduled_pending` index helps catch this via `SELECT COUNT(*) WHERE delivery_status='queued' AND scheduled_for < now() - interval '5 min'`. |
| **Undo-window race** — user clicks Undo at 9.9s, cron fires at 10.05s | low | low | Brief §5.9 + Step 14d documents the audit-log fork. `cancelled_queued_email=false` in audit; user sees correct state; client gets honest round-trip email. |
| **Migration adds columns to a table touched by C-08** | medium | low | C-08 plan §6 documents that `email_delivery_events.metadata` may need an ALTER if absent. C-04a's migration is independent (5 new columns, none colliding). Migrations stack cleanly. Pre-flight Step 5(d) verifies. |
| **`scheduled_for` set in the past at insert time** (clock skew) | low | low | Cron handler's `WHERE scheduled_for <= now()` picks up any past-due row on its next tick. Send-fn doesn't reject negative delays; floored to 0 (immediate-equivalent) via Math.max in `Date.now() + Math.max(0, delaySeconds) * 1000`. |
| **Cancel email payload size** (storing rendered HTML in `html_payload`) | very low | low | Cancellation email HTML is ~5-10 kB rendered. 5/day × 365 = ~1.8 MB/year row storage. Negligible. Optional GC: post-send `UPDATE ... SET html_payload=NULL` to reclaim. Out of C-04a scope. |
| **(S7 2026-07-16) Backfill 2's audit-log JSON path doesn't match reality** — legacy admin-cancelled rows stay NULL and become unrestorable | medium | low | Pre-flight verifies the `after_state` shape before the migration; the post-migration coverage query reports stamped/unstamped counts to the user. NULL→expired is fail-closed by design — worst case is an old cancellation that can't be restored, which matches the window's intent. |
| **(S7 2026-07-16) A cancel path misses the `cancelled_at` stamp** (future code adds a new cancel route) | low | medium | Guard's coalesce falls back to `customer_cancelled_at`; if both absent the booking locks (fail-closed — visible, not silent). C-02 (series cascade) + C-06 (delete cascade) carry explicit stamping notes. |
| **`computeBookingMomentLondon` BST/GMT switching edge case** | low | low | Plan Step 2 amendments calls out date-fns-tz if available; otherwise a manual offset table. Vitest spec covers both seasons explicitly. Same helper used by C-05 — shared bug-class. |
| **Row-level Restore renders for Therapists** (RBAC leak) | low | medium | `BookingRowActions` Props already includes `role` (`"full" | "therapist"`). The status-aware menu branch must check `role === "full"` before rendering the Restore item. Add explicit check + unit test. |

### 4.1 Specific real risk: `reporting.ts` RECON §5

The line 438 change is approved per C-B-DECISIONS Q8 as an explicit one-char exception. Bookkeeping: the RECON §5 doc should be amended after this commit to document the exception. Plan §11 lists this as a deviation.

---

## 5 — Undo procedure

### 5.1 Undo code (Phases A-H)

Each phase is a self-contained git commit. Revert in reverse order:
1. `git revert <phase-H-undo-toast-commit>` — removes Undo affordance on cancel; `delaySeconds: 10` wiring reverts; cancel emails fire immediately again. **No queued-email backlog risk** — toast UX is purely client-side; revert is safe.
2. `git revert <phase-G-row-level-restore-commit>` — removes row-level Restore action + status-aware menu; full active-state menu re-renders for cancelled rows (those rows will route through the cancel action again, harmless since C-05 lockdown holds at the server level).
3. `git revert <phase-F-scheduled-emails-commit>` — removes cron route + worker registration + `sendTrackedEmail.delaySeconds` extension. **Pre-revert step:** flush any queued rows via one cron invocation OR `UPDATE email_delivery_events SET delivery_status='cancelled_manual' WHERE delivery_status='queued'`. Otherwise queued emails are orphaned.
4. `git revert <phase-E-hygiene-tail-commit>` — reinstates dead refunded/waived references + reverts `||→??` (production reports go back to overstating completedRevenue)
5. `git revert <phase-D-auto-promote-commit>` — removes auto-promote hook + helper
6. `git revert <phase-C-no-show-commit>` — removes `no_show` from `quickUpdateBooking`
7. `git revert <phase-B-state-machine-commit>` — removes the completed-reopen guard (Status form goes back to free-form transitions)
8. `git revert <phase-A-restore-commit>` — removes `restoreBooking` action + Restore button + email — reinstates the misleading "Restore from audit log" copy

If only one phase needs to be undone, revert just that phase's commit. Phases F–H interlock (Phase H requires Phase F's `delaySeconds` infra); revert H before F to avoid broken intermediate state.

### 5.2 Undo migration

**Phase F migration (Change 13 — scheduled-email columns):**

```sql
-- Reverse the column adds + index
DROP INDEX IF EXISTS idx_email_delivery_events_scheduled_pending;
ALTER TABLE email_delivery_events
  DROP COLUMN IF EXISTS scheduled_for,
  DROP COLUMN IF EXISTS html_payload,
  DROP COLUMN IF EXISTS text_payload,
  DROP COLUMN IF EXISTS to_email,
  DROP COLUMN IF EXISTS subject;

-- S7 (2026-07-16): drops the unified cancellation timestamp. Loses admin-cancel
-- timestamps recorded since the migration (customer_cancelled_at is untouched —
-- customer timestamps survive). Revert the S7 code first or the guard reads a
-- missing column.
ALTER TABLE bookings DROP COLUMN IF EXISTS cancelled_at;
```

**Pre-revert step:** ensure no queued rows exist that depend on the columns. Run:

```sql
SELECT COUNT(*) FROM email_delivery_events WHERE delivery_status = 'queued';
-- Expected: 0 (run the cron route or manually flip status first)
```

*(Added 2026-07-26 — Appendix B premise)* If the applied migration extended the `delivery_status` CHECK (Step 10 schema-premise note), the undo migration must also restore the original CHECK — and that re-ADD fails while any row still carries a new lifecycle value. Confirm first: `SELECT DISTINCT delivery_status FROM email_delivery_events;` returns only `accepted`/`failed`/`skipped` (re-map or clean up test rows otherwise).

**Phase A migration (event_type, if it was needed):**

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
    customer_cancellation_note = '<original>',
    cancelled_at = '<original timestamp>'            -- S7 (2026-07-16)
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
| 1 | Phase A — `restoreBooking` action (with S6 + S7 window guard + queued-email cancellation) + Next-action button (S6/S7-conditional) + email send-fn + template + S3 confirm modal reason display + S7 helper in `_helpers.ts` (S7 stamping + migration land with Phase F's migration commit) |
| 2 | Phase B — State-machine guard + Status form confirm modal |
| 3 | Phase C — `no_show` quick action + Mark no-show button |
| 4 | Phase D — Auto-promote helper + hooks + banner |
| 5 | Phase E — Hygiene tail (filter UI cleanup + `||→??` fix + test updates) |
| 6 | Phase F — Migration (scheduled-email columns + index) + `sendTrackedEmail` delaySeconds + cron route + worker registration |
| 7 | Phase G — Row-level Restore action + quickUpdateBooking restore case + status-aware row menu (Change 12) |
| 8 | Phase H — Undo toast on cancel paths + `delaySeconds: 10` wiring in `updateBookingManagement` + `quickUpdateBooking` |
| 9 | (conditional) Migration for `email_event_type` if enum-constrained |
| 10 | Verification gate — Playwright screenshots + progress file + master plan checklist row → ✅ |

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

6. **(amendment 2026-05-26) `computeBookingMomentLondon` shared helper ownership** — both C-04a (S6 guard) and C-05 (datetime-aware UI) want this util. Plan §1 Step 2 amendments has C-04a create it in `src/app/admin/bookings/_helpers.ts`. If C-05 ships first (against recommended order), C-05 creates it and C-04a imports. Either way, the helper is single-source.
7. **(S7 2026-07-16) Window configurability** — `RESTORE_WINDOW_DAYS = 28` ships as a code constant. Exposing it as a business-settings field (like `customer_cancellation_cutoff_hours`) is a C-12+ option if the owner wants to tune it without a developer. Sequencing note: S7's guard ordering (after S6, cancelled-only) and the fail-closed NULL rule are user-locked 2026-07-16 — don't soften at impl time.

7. **(amendment 2026-05-26) Scheduled-emails cron generalisation** — Change 13's infrastructure could replace C-01's status-trigger model entirely (uniform `scheduled_for` semantics). Out of C-04a scope; flagged in handoff §5 as a C-12+ refactor candidate.

8. **(amendment 2026-05-26) Worker-entrypoint dispatch mechanism** — `worker-entrypoint.ts` may use cron-expression matching, a routing table, or a switch on event metadata to dispatch incoming cron events to the right route. Plan Step 12 sketches "case 'scheduled-emails'" but the exact pattern must be verified during impl. Cheap grep at pre-flight time: `git grep -n "scheduledTime\|cron" worker-entrypoint.ts`.

   **(RESOLVED 2026-07-26 — C04a-1/D3.)** Verified: NO dispatch mechanism exists — `scheduled()` is a single unconditional `fireBookingReminders(env)` call. Step 12 was rewritten order-agnostically: build the `event.cron` switch if absent, else add a case. The hedge above no longer needs impl-time discovery; the pre-flight grep remains useful to detect whether C-01/C-02 built the switch first.

9. **(amendment 2026-05-26) Reliable Undo race detection in audit logs** — brief §5.9 + Q9.10 surfaces the audit-fork forensics. If real-world misclick rate is high, a C-12+ improvement could surface "undid within X seconds" badge on the booking detail page for transparency. Out of C-04a scope.

---

*End of C-04a plan. Brief: `redesign/briefs/C-04a-cancellation-restore-brief.md`. Progress: `redesign/per-page-progress/C-04a-cancellation-restore-progress.md` (filled during C-C).*
