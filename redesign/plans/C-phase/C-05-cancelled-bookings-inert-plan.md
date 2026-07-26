# C-05 — Lock cancelled / no_show / past-dated bookings inert + status-aware filter + cancelled-row strikethrough — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: C-04a (`git log --oneline --grep="C-04a" | grep -q "feat(redesign): C-04a"`), C-06 (`git log --oneline --grep="C-06" | grep -q "feat(redesign): C-06"` — HARD gate per Checkpoint D4/finding F4; additionally verify `bookings.deleted_at` + `clients.deleted_at` columns exist via a read-only `information_schema.columns` query before Phase A Step 1).
> Decisions: C-B-DECISIONS.md §2 Q1 + §3 C-05; Checkpoint D4 (decisions-resolved.md). Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-05-cancelled-bookings-inert-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-05-cancelled-bookings-inert-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** ~~`git status --short` empty. HEAD on `redesign/start-state`.~~ **UPDATED 2026-07-26 (F1):** on `master`; HEAD at or descended from `ea97932`; verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/app/admin/bookings/ src/app/admin/clients/` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted `.playwright-mcp/` logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 baseline failures preserved — ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1).
4. **Static gates green.** **UPDATED 2026-07-26 (F2):** `npx tsc --noEmit` — 0 errors. `pnpm lint` — no NEW lint errors vs the 59-error baseline (55 from untracked `design_handoff_area_pages/prototype/*.jsx`, 4 pre-existing in `src/features/booking/`).
5. **C-04a must be merged.** Verify: `git log --oneline | grep -i "C-04a"` returns the C-04a implementation commits. If C-04a is not in HEAD, **stop** — sequencing constraint requires Restore button before lockdown.
6. **C-06 must be merged — HARD gate (promoted 2026-07-26 per Checkpoint D4 / finding F4).** ~~Not a hard dependency, but if C-06 is in HEAD, `bookings.deleted_at` column exists. The helper's SELECT can include it; otherwise the helper omits the field and the deleted_at branch becomes a no-op. The plan handles both cases (see Step 1 conditional).~~ Verify via read-only query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'deleted_at';` and the same for `table_name = 'clients'`. Both must return a row. If either is absent, C-06's migration has not landed — **stop** and surface to the user before starting Phase A Step 1. Phase A Step 1's helper SELECT is unconditional (single code path, no try/catch fallback) and requires both columns to exist.
7. **DB introspection.** Confirm via `mcp__supabase__execute_sql`:

   ```sql
   -- (a) Confirm no test booking is in a state that would mask the C-05 fix
   SELECT id, status, booking_date FROM bookings
   WHERE status IN ('cancelled', 'no_show') OR booking_date < CURRENT_DATE
   ORDER BY booking_date DESC LIMIT 20;
   ```
   At least one cancelled + one past-dated booking should exist for the E2E sweep. If not, create via C-04a's Cancel action against a test booking; a past-dated fixture requires a SQL date back-date.

   > ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
   > An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
   > Action: back-date a test booking's `booking_date` via SQL to create a past-dated fixture for the E2E sweep.
   > Exact SQL / change: `UPDATE bookings SET booking_date = '<past-date>' WHERE id = '<test-booking-id>'` — target must be a test booking per the DO-NOT-TOUCH block below (never Badar's `9d55ce2a`).
   > Post-action verification: re-run the SELECT above; the target row now shows the back-dated `booking_date`.
   > Never auto-apply. Approval is per-action and does not carry forward.

8. **Capture pre-state for the claimable race scenario:**
   ```sql
   -- Find any booking_assignments with unassigned + matching a real Therapist's gender
   -- (these are the rows that would surface in /admin/bookings?view=claimable for that Therapist)
   SELECT ba.id, ba.booking_id, b.status, b.booking_date, b.start_time
   FROM booking_assignments ba
   JOIN bookings b ON b.id = ba.booking_id
   WHERE ba.status = 'unassigned' AND ba.assigned_staff_id IS NULL
   ORDER BY b.booking_date DESC LIMIT 20;
   ```

9. **Test data DO-NOT-TOUCH list:** Badar's `9d55ce2a` and any non-test client. The C-05 sweep will create/use cancelled test bookings — never Badar's.

   > DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.

If any pre-flight check fails (especially #5 C-04a sequencing, or #6 C-06 sequencing), **stop** and surface to the user.

---

## 1 — Safe implementation order (4 phases, 9 edits, with verify-checkpoints)

Phases A–C are the original C-05 body (edit points 1–7). Phase D was added in the 2026-05-26 amendment (edit points 8–9 + cross-surface strikethrough).

### Phase A — The helper + foundational predicate (edit points 6 + 7)

**Step 1 — Implement `ensureBookingActive` helper.**

> **Shared-surface coordination note (rubric §10, verbatim from collision-map.md):** *"`_helpers.ts`'s `ensureBookingActive` SELECT includes `deleted_at` / `clients(deleted_at)`, columns that only exist after C-06's migration — confirm C-06 has landed (not just C-04a) before this Phase A step, or gate the SELECT."* **Resolved 2026-07-26 per Checkpoint D4:** confirm-before-proceeding wins — pre-flight Step 6 is now a HARD gate; the SELECT below is not conditionally gated.

- Edit `src/app/admin/bookings/access.ts`. Add at the bottom (after `canAccessBooking`):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingActivityCheck =
  | {
      active: true;
      booking: {
        id: string;
        status: string;
        booking_date: string;
        start_time: string;
      };
    }
  | {
      active: false;
      reason: "not_found" | "cancelled" | "no_show" | "past_dated" | "client_deleted";
      message: string;
    };

function getLondonToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function ensureBookingActive(
  bookingId: string,
  supabase: SupabaseClient,
  options: { allowToday?: boolean } = {}
): Promise<BookingActivityCheck> {
  const allowToday = options.allowToday ?? true;

  // SELECT shape: unconditional — pre-flight Step 6 hard-gates on C-06's migration
  // having landed (2026-07-26, Checkpoint D4 / finding F4), so deleted_at and
  // clients(deleted_at) always exist by the time this helper runs.
  const selectColumns = "id, status, booking_date, start_time, deleted_at, clients(deleted_at)";

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(selectColumns)
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    return { active: false, reason: "not_found", message: "Booking not found." };
  }

  // (Forward-looking C-06) Booking soft-deleted
  if ((booking as { deleted_at?: string | null }).deleted_at) {
    return {
      active: false,
      reason: "not_found",
      message: "Booking not found.",
    };
  }

  // (Forward-looking C-06) Parent client soft-deleted
  const clientsRow = (booking as { clients?: { deleted_at?: string | null } | null }).clients;
  if (clientsRow?.deleted_at) {
    return {
      active: false,
      reason: "client_deleted",
      message: "This booking's client has been deleted.",
    };
  }

  if (booking.status === "cancelled") {
    return {
      active: false,
      reason: "cancelled",
      message: "This booking is cancelled. Restore it from the booking detail page first.",
    };
  }

  if (booking.status === "no_show") {
    return {
      active: false,
      reason: "no_show",
      message: "This booking is marked no-show. Restore it from the booking detail page first.",
    };
  }

  const today = getLondonToday();
  const minDate = allowToday ? today : addDaysISO(today, 1);
  if (booking.booking_date < minDate) {
    return {
      active: false,
      reason: "past_dated",
      message: "This booking is in the past. Actions are no longer available.",
    };
  }

  return {
    active: true,
    booking: {
      id: booking.id,
      status: booking.status,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
    },
  };
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
```

**UPDATED 2026-07-26 (Checkpoint D4 / finding F4):** the "conditional pre-C-06" behaviour and the `try/catch` fallback described below were never implemented in the code above and are now superseded — C-06 is a HARD pre-flight gate (Step 6). The SELECT shown above is unconditional and is the ONLY code path. Do not implement a conditional column set or a `try/catch` fallback. If pre-flight Step 6's `information_schema` check fails, **stop** before writing this helper.

~~**Conditional behaviour pre-C-06:** if `bookings.deleted_at` column doesn't exist yet, the SELECT will fail with a PostgREST error. **Pre-flight Step 6 dictates the SELECT shape:**~~

~~- If C-06 is in HEAD → SELECT includes `deleted_at` + `clients(deleted_at)` as shown.~~
~~- If C-06 is NOT in HEAD → SELECT only `id, status, booking_date, start_time` (drop the forward-looking branches).~~

~~Given the recommended C-B order has C-06 → C-04a → C-05 and the C-C ship order will respect plan dependencies, by the time C-05's C-C work runs, C-06 should be merged. Plan locks the full SELECT and adds a small `try/catch` fallback: if the SELECT errors on `deleted_at`, retry with the minimal column set.~~

**Step 2 — Update `hasClaimableAssignment` predicate (edit point 6).**

In the same file:

```ts
export function hasClaimableAssignment(
  booking: BookingRecord,
  profile: StaffProfile,
  todayISO?: string
) {
  if (!canClaimAssignments(profile)) return false;

  // Lockdown (C-05): cancelled / no_show / past-dated are inert
  if (booking.status === "cancelled" || booking.status === "no_show") return false;
  const today = todayISO ?? getLondonToday();
  if (booking.booking_date < today) return false;

  return booking.booking_assignments.some(
    (assignment) =>
      assignment.status === "unassigned" &&
      !assignment.assigned_staff_id &&
      assignment.required_therapist_gender === profile.gender
  );
}
```

Lift `getLondonToday()` into a helper at module scope (shared with `ensureBookingActive`). Callers (`bookings/page.tsx:177`, `:759`, `canOpenBookingRecord:40`) all gain access without signature change — the `todayISO` param is optional.

**Step 2b — `canOpenBookingRecord` posture decision.**

`canOpenBookingRecord` (`access.ts:35-42`) is currently:

```ts
return canManageAllBookings(profile) || canViewAllBookings(profile) ||
       isOwnBooking(booking, profile) || hasClaimableAssignment(booking, profile);
```

With the new lockdown logic in `hasClaimableAssignment`, a Therapist who only had a (now-cancelled) claimable assignment is suddenly locked out of opening that booking's detail page. **That's wrong** — they should still be able to view the page for audit purposes (per brief §3 — Therapist who was previously assigned to a now-cancelled booking can still navigate to the detail).

**Mitigation:** the existing `isOwnBooking` branch already covers the previously-assigned case (the assignment row still has `assigned_staff_id = profile.id`). For a brand-new Therapist who NEVER had a relationship with the now-cancelled booking, they wouldn't have been able to open it before C-05 either — `hasClaimableAssignment` already returned false (they couldn't claim a cancelled-then-cancelled-again booking through any normal flow).

Actually, the pre-C-05 case was: Therapist opens the claimable-LIST → cancelled booking not visible → never finds the deep link. The detail-page-via-deep-link case is the unsanctioned route. C-05 closes that route.

**Locked decision:** the `canOpenBookingRecord` posture stands as-is. Therapists previously assigned remain in via `isOwnBooking`. Therapists with no prior relationship can't open cancelled bookings (correct — they have no business there). Document this in the plan but don't change the function.

**Step 3 — Vitest spec for the helper + predicate.**

New file `src/app/admin/bookings/__tests__/ensureBookingActive.test.ts`:
- Active booking (confirmed, today) → returns `{ active: true, booking: {...} }`
- Cancelled booking → returns `{ active: false, reason: 'cancelled', message: '...' }`
- No_show booking → returns `{ active: false, reason: 'no_show' }`
- Past-dated booking → returns `{ active: false, reason: 'past_dated' }`
- `booking_date === today` with `allowToday: true` → active
- `booking_date === today` with `allowToday: false` → past_dated
- Non-existent bookingId → returns `{ active: false, reason: 'not_found' }`
- (forward-looking) `bookings.deleted_at !== null` → not_found
- (forward-looking) `clients.deleted_at !== null` → client_deleted

Extend `bookings/__tests__/access.test.ts` (if exists) with `hasClaimableAssignment` cases:
- Active booking + unassigned slot + matching gender → true
- Cancelled booking + matching slot → false
- No_show booking + matching slot → false
- Past-dated booking + matching slot → false
- Active booking + unassigned slot + non-matching gender → false (existing case)

**Phase A verify checkpoint:**
- `npx tsc --noEmit` green
- `pnpm vitest run bookings` — new tests pass; existing tests still pass

### Phase B — Server-action defense (edit point 1 + extension to reassign action)

**Step 4 — Hook `ensureBookingActive` into `claimBookingAssignment`.**

In `bookings/actions.ts:239-365`. Replace lines 269-273 (current SELECT — `data`/`from`/`select`/`eq`/`single`; **corrected 2026-07-26, F6:** line 274 is blank, line 275 is the `if (!booking)` check, which the replacement snippet below also needs to keep/adapt — not part of the SELECT itself) with:

```ts
const activityCheck = await ensureBookingActive(assignment.booking_id, adminClient);
if (!activityCheck.active) {
  return { error: activityCheck.message };
}
const booking = activityCheck.booking;
```

Remove the existing `.select("id, booking_date, start_time, end_time")` block. The helper's SELECT covers the same fields except `end_time`. If `end_time` is referenced downstream (line 277-287 `getClaimAssignmentEligibility` call), extend the helper's SELECT OR re-fetch downstream when needed.

Actually checking `getClaimAssignmentEligibility` signature in `assignment-eligibility.ts` — it accepts `booking: { id, booking_date, start_time, end_time }`. So end_time IS needed. **Adjust the helper:** add `end_time` to its SELECT and to the success-branch return shape:

```ts
booking: {
  id: string;
  status: string;
  booking_date: string;
  start_time: string;
  end_time: string;
};
```

**Step 5 — Hook into `updateBookingAssignment` (admin reassign path).**

In `bookings/actions.ts:449-562`. Near the top of the function body (after RBAC checks, before any UPDATE):

```ts
const activityCheck = await ensureBookingActive(bookingId, adminClient);
if (!activityCheck.active) {
  return { error: activityCheck.message };
}
```

The `bookingId` comes from somewhere in formData / lookup. Verify the variable name in context.

**Step 6 — `updateOwnAssignmentStatus` — explicitly NOT gated.**

Per brief §2.2 + Q9.1. Add a code comment at line 564:

```ts
// C-05 design: this server action is INTENTIONALLY NOT gated by ensureBookingActive.
// Practitioners can mark their own assignment complete/no_show on a cancelled
// booking — forensic edge case (visit happened before cancellation propagated).
// Auto-promote (C-04a's autoPromoteBookingFromAssignments) is conditional on
// booking.status NOT IN ('cancelled', 'completed'), so the parent booking stays
// cancelled. See brief §5.1.
export async function updateOwnAssignmentStatus(formData: FormData) {
```

No behavioural change here; just documentation against future regressions.

**Step 7 — Server-action unit-test additions.**

In `bookings/__tests__/actions.test.ts` (or equivalent — verify existence):
- `claimBookingAssignment` on cancelled booking → returns structured error, no DB write.
- `claimBookingAssignment` on past-dated booking → same.
- `claimBookingAssignment` on no_show booking → same.
- `updateBookingAssignment` (assign action) on cancelled → same.
- `updateOwnAssignmentStatus` on cancelled → succeeds (per design); auto-promote does NOT fire.

**Phase B verify checkpoint:**
- New + existing tests pass.
- Manual Playwright: as Therapist, attempt to claim a cancelled test booking via direct URL `/admin/bookings/[id]` → Claim button gone (after Phase C); inspect network to verify the helper's error surfaces if the POST is sent directly.

### Phase C — UI defense-in-depth + list filtering (edit points 2-5)

**Step 8 — Lift `getTodayIsoDate` to a shared util.**

The function exists in `bookings/page.tsx:139-146` and now needs to be used by `[bookingId]/page.tsx`. Options:
- (a) Lift to `src/lib/date-utils.ts` or a colocated `src/app/admin/bookings/_helpers.ts`. Cleaner.
- (b) Duplicate inline. Quick.

Going with (a). Create `src/app/admin/bookings/_helpers.ts` with the lifted util + re-export from `page.tsx`.

**Step 9 — Top-level `isBookingActive` derivation on detail page.**

Edit `src/app/admin/bookings/[bookingId]/page.tsx`. Near the top of the page's server-component body (where `booking` is fetched), add:

```ts
const today = getTodayIsoDate();
const isBookingActive =
  booking.status !== "cancelled" &&
  booking.status !== "no_show" &&
  booking.booking_date >= today;
const inactivityReason: "cancelled" | "no_show" | "past_dated" | null =
  !isBookingActive
    ? booking.status === "cancelled" ? "cancelled"
    : booking.status === "no_show" ? "no_show"
    : "past_dated"
    : null;
```

Pass `isBookingActive` + `inactivityReason` through to any child component that renders the assignment list.

**Step 10 — Multiply through UI predicates.**

In the same file:

- Line 787-791 (`canClaim`): prepend `isBookingActive &&`.
- Line 794 (`isOwn`): unchanged (informational). But the buttons it gates (lines 864-872 + 873-881) get a wrapping condition `{isOwn && isBookingActive ? ... : null}`.
- Line 798-801 (`canPromptForSessionNote`): prepend `isBookingActive &&`.
- **Derivation site (corrected 2026-07-26, F5):** `canReassignBookings` is derived once at `[bookingId]/page.tsx:319` — `const canReassignBookings = fullScope && canAssignBookings(profile);` — NOT at `883-890`, which is only the usage site (rendering `AssignmentManager`). Append `&& isBookingActive` to the line-319 derivation. Re-grep before editing — prior Band C plans may have shifted line positions since this was verified (2026-07-26 pass).

**Step 11 — Inline notice block in the assignments section.**

Above the assignments `<ul>` rendering, conditionally render:

```tsx
{!isBookingActive && (
  <div role="status" aria-live="polite" className="rahma-pop-in rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-3 text-sm">
    <div className="flex gap-2.5">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium text-[var(--admin-body)]">
          {inactivityReason === "cancelled" && "This booking is cancelled."}
          {inactivityReason === "no_show" && "This booking is marked no-show."}
          {inactivityReason === "past_dated" && "This booking is in the past."}
        </p>
        <p className="mt-1 leading-6 text-[var(--admin-text-muted)]">
          {/* S7 coordination (2026-07-16, C-04a amendment): when the 28-day restore
              window has passed (isRestoreWindowExpired from _helpers.ts), the
              cancelled variant reads the expired copy instead — restore is gone. */}
          {inactivityReason === "cancelled" &&
            (restoreWindowExpired
              ? "The 28-day restore window has passed — this cancellation is permanent."
              : "Restore it before claiming, reassigning, or marking work complete.")}
          {inactivityReason === "no_show" && "Restore it if the client did attend."}
          {inactivityReason === "past_dated" && "Editing past bookings should go through support."}
        </p>
      </div>
    </div>
  </div>
)}
```

Place between the next-action strip (from C-04a) and the assignment list. Verify with C-04a's Restore button card that the two cards don't visually fight — adjust spacing or merge if needed (the next-action card already says "This booking is cancelled. Restore it..." — the inline notice could be redundant; consider rendering only when there are practitioners who would have seen affordances).

**Decision (during plan-writing):** render the inline notice **only when there's an assignments section AND the actor has practitioner-role affordances** (`canClaim || isOwn || canReassignBookings would-be-true-if-active`). Reduces redundancy with C-04a's next-action card for non-practitioners.

**Step 12 — SQL `claimableRows` JOIN (edit point 5).**

Edit `bookings/page.tsx:114-122`. Replace:

```ts
const claimableRows = canClaimAssignments(profile)
  ? (
      await adminClient
        .from("booking_assignments")
        .select("booking_id, bookings!inner(status, booking_date)")
        .eq("status", "unassigned")
        .is("assigned_staff_id", null)
        .eq("required_therapist_gender", profile.gender)
        .not("bookings.status", "in", '("cancelled","no_show")')
        .gte("bookings.booking_date", todayISO)
    ).data ?? []
  : [];
```

Hoist `todayISO = getTodayIsoDate()` to before line 107 so it's in scope for the helper call.

**Step 13 — In-memory view filter past-date defense (edit point 5b).**

Edit `bookings/page.tsx:175-177` (the claimable view filter):

```ts
(view === "claimable" &&
  !["cancelled", "no_show"].includes(booking.status) &&
  booking.booking_date >= today &&
  hasClaimableAssignment(booking, profile, today)) ||
```

Pass `today` into `hasClaimableAssignment` as the explicit param (Step 2 added the optional param).

**Phase C verify checkpoint:**
- Lint + tsc green.
- Playwright manual at 4 viewports:
  - Cancelled test booking detail → no Claim, no Mark complete, no AssignmentManager, no Mark no-show. Inline notice rendered (if actor has practitioner role).
  - Past-dated test booking detail → same shape, with "past" copy.
  - Active test booking detail → all affordances visible.
  - `/admin/bookings?view=claimable` as Therapist → no cancelled, no past-dated rows.

### Phase D — Status-aware filter + cancelled-row strikethrough (edit points 8 + 9 — amendment 2026-05-26)

**Step 14 — Refactor `filterBookings` to be status-aware (edit point 8).**

Edit `src/app/admin/bookings/page.tsx:148-258`. The current shape unconditionally excludes cancelled/no_show in most views, then applies status filter after (line 195) — net effect: status=cancelled returns 0 rows on default view. The fix:

```ts
function filterBookings(
  bookings: BookingRecord[],
  query: Record<string, string | string[] | undefined>,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  const view = (getQueryValue(query.view) || "attention") as BookingViewKey;
  const search = getQueryValue(query.search)?.trim().toLowerCase() ?? "";
  const status = getQueryValue(query.status) ?? "";
  // ... existing other-filter parsing
  const today = getTodayIsoDate();

  // AMENDMENT 2026-05-26 (S1b + Edit Point 8): detect explicit user opt-in to inert statuses
  const userWantsInertStatus = status === "cancelled" || status === "no_show";

  return bookings.filter((booking) => {
    // (Edit Point 8 — amendment) Early-return for views that normally hide cancelled/no_show
    // unless user explicitly picked one of those statuses
    const viewIsArchive = view === "cancelled" || view === "all";
    if (!viewIsArchive && !userWantsInertStatus &&
        ["cancelled", "no_show"].includes(booking.status)) {
      return false;
    }

    const matchesView =
      view === "all" ||
      (view === "attention" && (
        booking.status === "pending" ||
        booking.assignment_status !== "fully_assigned" ||
        booking.reschedule_status === "requested" ||
        Boolean(booking.customer_cancelled_at)
      )) ||
      (view === "assigned" && isOwnBooking(booking, profile)) ||
      // CLAIMABLE stays unconditionally strict — cancelled NEVER claimable
      (view === "claimable" &&
        !["cancelled", "no_show"].includes(booking.status) &&
        booking.booking_date >= today &&
        hasClaimableAssignment(booking, profile, today)) ||
      // For TODAY / UPCOMING / UNASSIGNED / PARTIALLY_ASSIGNED, the inert-status
      // exclusion was lifted in the early-return above; the matchesView check is
      // simplified to pure view membership.
      (view === "today" && booking.booking_date === today) ||
      (view === "upcoming" && booking.booking_date >= today && booking.status !== "completed") ||
      (view === "unassigned" && booking.assignment_status === "unassigned") ||
      (view === "partially_assigned" && booking.assignment_status === "partially_assigned") ||
      (view === "completed" && booking.status === "completed") ||
      (view === "cancelled" && ["cancelled", "no_show"].includes(booking.status));

    if (!matchesView) return false;
    if (status && booking.status !== status) return false;
    // ... existing other-filter logic unchanged
  });
}
```

**Key invariants preserved:**
- `view=claimable` keeps unconditional cancelled/no_show exclusion (C-05 lockdown invariant).
- `view=cancelled` continues to filter `["cancelled","no_show"]` only.
- `view=all` shows everything (including cancelled by default — debatable; but unchanged from current).

**Step 14b — Vitest spec for the refactored filter.** New file `src/app/admin/bookings/__tests__/filterBookings.test.ts`:

- `view=attention, status=""` (defaults): cancelled rows excluded.
- `view=attention, status="cancelled"`: cancelled rows included (subject to other-filter pass).
- `view=attention, status="no_show"`: no_show rows included.
- `view=upcoming, status="cancelled"`: cancelled future-dated rows included.
- `view=today, status="cancelled"`: cancelled today rows included.
- `view=claimable, status="cancelled"`: 0 rows (invariant preserved).
- `view=claimable, status=""`: only active claimable rows (unchanged).
- `view=cancelled, status=""`: shows cancelled + no_show (unchanged).
- `view=cancelled, status="cancelled"`: shows only cancelled (status filter narrows).
- `view=all, status=""`: shows everything including cancelled (unchanged).

Pattern: lift fixture-creation helpers from existing booking-tests; mock `getQueryValue` + `getTodayIsoDate` only if needed.

**Step 15 — Cancelled-row strikethrough on the bookings list (edit point 9).**

Edit `src/app/admin/bookings/page.tsx` row card rendering (search for the `<article>` block before `<BookingRowActions>` — around line 850-928 per audit reference). Add `isInertRow` derivation + class composition:

```tsx
const isInertRow =
  ["cancelled", "no_show"].includes(booking.status) ||
  booking.booking_date < today;

return (
  <article
    key={booking.id}
    className={cn(
      "group rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4",
      isInertRow && "opacity-75"
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className={cn(
        "min-w-0 flex-1",
        isInertRow && "line-through decoration-[var(--admin-text-muted)] decoration-1"
      )}>
        <p className="text-base font-semibold text-[var(--admin-heading)]">
          {formatDate(booking.booking_date)} · {formatTime(booking.start_time)}
        </p>
        <p className="mt-1 text-sm text-[var(--admin-body)]">
          {/* existing service-name rendering */}
        </p>
      </div>
      {/* Status badge — NOT struck through */}
      <AdminStatusBadge value={formatLabel(booking.status)} ... />
    </div>
    {/* ... rest of card unchanged */}
    <BookingRowActions {...rowActionsProps} />  {/* not struck through */}
  </article>
);
```

**Treatment rules** (locked per S2 + brief §2.8):
- `line-through` applies only to the date + service-name `<div>` wrapper.
- `decoration-1` (thin stroke) for legibility at 375 mobile.
- `decoration-[var(--admin-text-muted)]` for low-contrast emphasis (not harsh red).
- Overall `opacity-75` reinforces the inactive state subtly.
- Status badge stays visually intact (classification label).
- `BookingRowActions` button stays visually intact (action affordance).

**Step 16 — Cross-surface strikethrough on `clients/[clientId]/page.tsx` BookingHistoryCard.**

Edit `src/app/admin/clients/[clientId]/page.tsx` (~line 1397-1500 — the `BookingHistoryCard` function). Apply the same `isInertRow` derivation + class composition. The card shape differs slightly from the list-page row, but the strikethrough principle applies identically. Concrete edits:

```tsx
function BookingHistoryCard({ booking }: { booking: ClientBookingRecord }) {
  // ... existing logic
  const isInertRow =
    ["cancelled", "no_show"].includes(booking.status) ||
    booking.booking_date < today;  // 'today' may need to be passed in as prop

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className={cn(
        "block rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors hover:border-[var(--admin-primary)]/40 hover:shadow-[var(--admin-shadow-hover)]",
        isInertRow && "opacity-75"
      )}
    >
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        <div className={cn(
          "min-w-0 flex-1",
          isInertRow && "line-through decoration-[var(--admin-text-muted)] decoration-1"
        )}>
          <p className="text-base font-semibold leading-tight text-[var(--admin-heading)]">
            {formatDate(booking.booking_date)} · {formatTime(booking.start_time)}
          </p>
          <p className="mt-1 text-sm text-[var(--admin-body)]">
            {serviceNames.join(", ") || "No service recorded"}
          </p>
          {/* ... locationLine */}
        </div>
        {/* badge column — unchanged */}
      </div>
    </Link>
  );
}
```

`today` needs to be threaded into `BookingHistoryCard` (parent computes via `getTodayIsoDate()` and passes as prop, OR card computes inline — pick the cleaner option during impl).

**Optional refactor:** lift `isInertRow` + class composition into a shared util (`_helpers.ts`):

```ts
export function inertRowClassNames(booking: { status: string; booking_date: string }, today: string) {
  const isInert = ["cancelled", "no_show"].includes(booking.status) || booking.booking_date < today;
  return {
    isInert,
    rowClass: isInert ? "opacity-75" : "",
    titleClass: isInert ? "line-through decoration-[var(--admin-text-muted)] decoration-1" : "",
  };
}
```

Decide during impl: shared helper if both surfaces converge cleanly; duplicate inline if shapes diverge enough to make the helper awkward.

**Phase D verify checkpoint:**
- Lint + tsc green.
- New `filterBookings.test.ts` passes 10 cases.
- Playwright manual:
  - `/admin/bookings?status=cancelled` (any default view): cancelled rows render with strikethrough.
  - `/admin/bookings` (no filter): cancelled rows do NOT appear (defaults to attention view, "Any status" = active-only).
  - `/admin/bookings?view=claimable&status=cancelled`: 0 rows (invariant).
  - `/admin/clients/<id>` with cancelled bookings in history: cards render with strikethrough.
  - Visual QA at 375 / 768 / 1280 / 1440 — line-through legible at all sizes.

---

## 2 — Files touched (final list)

### NEW (3 files)
| File | Purpose |
|---|---|
| `src/app/admin/bookings/__tests__/ensureBookingActive.test.ts` | Vitest coverage for the helper |
| `src/app/admin/bookings/__tests__/filterBookings.test.ts` | **Amendment 2026-05-26** — vitest for status-aware view filter (Edit Point 8); covers 10 view×status combinations |
| `src/app/admin/bookings/_helpers.ts` | Lifted `getTodayIsoDate` + (amendment) `isBookingMomentPastLondon` + `computeBookingMomentLondon` + (optional) `inertRowClassNames`. **Shared with C-04a's S6 guard.** |

### EDITED (~6 files)
| File | Change summary |
|---|---|
| `src/app/admin/bookings/access.ts` | + `ensureBookingActive` helper + types; modify `hasClaimableAssignment` with status + past-date guards |
| `src/app/admin/bookings/actions.ts` | Hook `ensureBookingActive` into `claimBookingAssignment` (replace SELECT lines 269-275) + `updateBookingAssignment` (top-of-function); add design-note comment on `updateOwnAssignmentStatus` |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Top-level `isBookingActive` + `inactivityReason`; multiply through `canClaim`, isOwn-derived buttons, `canPromptForSessionNote`, `canReassignBookings`; render inline notice |
| `src/app/admin/bookings/page.tsx` | SQL JOIN in `claimableRows`; in-memory filter past-date; thread `today` to `hasClaimableAssignment`. **Amendment 2026-05-26:** refactor `filterBookings` to be status-aware (Edit Point 8 — Step 14); row card gains `isInertRow` class composition for strikethrough (Edit Point 9 — Step 15). |
| `src/app/admin/clients/[clientId]/page.tsx` | **Amendment 2026-05-26 (Step 16)** — `BookingHistoryCard` gains `isInertRow` class composition for cross-surface strikethrough consistency. |
| `src/app/admin/bookings/__tests__/actions.test.ts` | (or equivalent) New cases for the gated paths; assert `updateOwnAssignmentStatus` cancelled-allowed |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- `canOpenBookingRecord` — explicit no-change per Step 2b.
- `updateOwnAssignmentStatus` body — explicit no-change per Step 6.
- `manage/actions.ts` (customer-facing) — out of scope.
- Email templates / notifications — C-05 doesn't fire emails.

---

## 3 — Verification gate (commands + pass criteria)

Run after Phase C lands. Every command must pass.

### 3.1 Static gates

```bash
pnpm lint                       # UPDATED 2026-07-26 (F3): no NEW errors vs the 59-error baseline (55 untracked design_handoff_area_pages/prototype JSX + 4 pre-existing in src/features/booking/)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline failures preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget for C-05:** ~1 kB additive (one helper function + a few predicate multiplications) + amendment 2026-05-26 additions (~0.5 kB for `filterBookings` refactor + ~0.5 kB for class composition + cross-surface application). Deletions are net-negative (the existing SELECT in `claimBookingAssignment` shrinks). **Plan ceiling: +3 kB across `/admin/bookings/*` + `/admin/clients/*`.** No new components, no new routes.

### 3.2 Playwright role sweep (4 roles × 4 viewports — 16 walks minimum)

Recipe per role:

1. Sign in via standard pattern.
2. Navigate to a CANCELLED test booking detail (NOT Badar's). Verify:
   - Claim button absent (where it would otherwise render — e.g., Therapist with unassigned slot)
   - Mark complete + Mark no-show buttons absent on own assignments
   - AssignmentManager absent
   - Inline notice rendered (for actor with practitioner-role affordances)
   - Detail page renders without errors; audit log + history accessible
3. Navigate to a PAST-DATED active test booking detail. Verify:
   - Same affordances absent
   - Inline notice copy reads "past" variant
4. Navigate to an ACTIVE confirmed test booking detail. Verify:
   - All expected affordances visible per role
5. Navigate to `/admin/bookings?view=claimable`. Verify:
   - No cancelled rows
   - No no_show rows
   - No past-dated rows (the B-171 repro from R05 is clean — no `2026-05-24` row from session 2026-05-25)
6. (Therapist only) Attempt to claim a CANCELLED booking via direct POST to the server action (via `browser_evaluate` issuing a fetch). Verify structured error response.
7. (Therapist only) Mark own assignment complete on a CANCELLED booking → succeeds per §2.2 design note. Audit row written for assignment; auto-promote does NOT fire (booking.status stays cancelled).
8. (Owner) Restore the cancelled test booking via C-04a's Restore button. Re-navigate to detail. Verify affordances reappear. Verify booking shows in the active filter views.
9. **(amendment 2026-05-26)** Navigate to `/admin/bookings?status=cancelled` (default view=attention). Verify cancelled rows appear with **strikethrough** on date + service-name lines. Status badge stays normal. Action button stays normal. Row opacity-75. Verified at 375 / 768 / 1280 / 1440.
10. **(amendment 2026-05-26)** Navigate to `/admin/bookings` (no filter). Verify cancelled rows do NOT appear (S1b: "Any status" = active-only).
11. **(amendment 2026-05-26)** Navigate to `/admin/bookings?view=upcoming&status=cancelled`. Verify future-dated cancelled rows appear with strikethrough.
12. **(amendment 2026-05-26)** (Therapist) Navigate to `/admin/bookings?view=claimable&status=cancelled`. Verify 0 rows (invariant preserved).
13. **(amendment 2026-05-26)** Navigate to a client detail page whose booking history includes cancelled bookings. Verify `BookingHistoryCard` renders cancelled rows with strikethrough.
14. **(amendment 2026-05-26)** Open bookings list overflow menu ("More") → click "Cancelled / No-show". Verify the dedicated tab still works.
15. **(amendment 2026-05-26 — co-ship with C-04a Phase G)** On a cancelled row in `/admin/bookings?status=cancelled`, open overflow menu → verify it shows ONLY "Restore booking" (C-04a Change 12). Click → restore round-trip completes.
16. Sign out.

### 3.3 Pre/post DB queries

```sql
-- Before sweep
SELECT id, status, booking_date FROM bookings WHERE id = '<cancelled-test-booking>';

-- After attempted server-side claim
SELECT id, status, assigned_staff_id FROM booking_assignments
WHERE booking_id = '<cancelled-test-booking>';
-- Expected: assigned_staff_id IS NULL (claim was blocked)

-- After Therapist marks own assignment complete on cancelled booking
SELECT id, status FROM booking_assignments
WHERE assigned_staff_id = '<therapist-id>' AND booking_id = '<cancelled-booking>';
-- Expected: status = 'completed' (per §2.2 design note)

-- Verify auto-promote DID NOT fire
SELECT status FROM bookings WHERE id = '<cancelled-test-booking>';
-- Expected: status STAYS 'cancelled' (per C-04a auto-promote predicate)

-- Audit log check
SELECT action_type, created_at FROM audit_logs
WHERE target_id = '<cancelled-test-booking>'
  AND action_type IN ('booking_assignment_completed', 'booking_auto_promoted_completed');
-- Expected: 'booking_assignment_completed' row exists, 'booking_auto_promoted_completed' DOES NOT
```

### 3.4 Screenshot evidence

- 375 + 1280: cancelled booking detail (Owner view) — no affordances + inline notice
- 375 + 1280: past-dated booking detail (Therapist view) — inline notice "past" variant
- 375: cancelled booking detail (Therapist with assignment) — affordances gone but assignment row still visible
- 1280: `/admin/bookings?view=claimable` (Therapist) — no cancelled/past-dated rows

Store in `redesign/evidence/C-05/` (rubric §8 evidence convention, 2026-07-26 — supersedes ~~`redesign/audits/C-A/screenshots-04-bookings-detail/c-05-after/`~~; `redesign/audits/**` is read-only historical record).

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Helper SELECT fails when `deleted_at` column doesn't exist (pre-C-06 sequencing) | low | medium | **UPDATED 2026-07-26 (D4/F4):** Pre-flight Step 6 is now a HARD gate (`information_schema` check) — C-06 must be merged before Phase A Step 1 runs. Single unconditional SELECT; no try/catch fallback. |
| Therapist previously assigned to cancelled booking loses detail-page access | low | medium | `canOpenBookingRecord` keeps `isOwnBooking` branch unchanged (Step 2b). Verified in plan §1. |
| `ensureBookingActive` adds latency to every claim/reassign action | very low | low | Single extra SELECT (~10ms). Negligible. |
| SQL JOIN at edit point 5 changes claimable count visibly mid-sweep | low | low | Expected behaviour. Document the count delta in progress file. |
| Race condition: claim succeeds milliseconds before booking is cancelled | low | low | §5.2 in brief — acceptable. Auto-promote correctly skips. Mark complete via §2.2 design note. |
| `getTodayIsoDate` lift creates a circular import | low | low | Co-locate in `access.ts` or use a new minimal helpers file. Verify import graph during impl. |
| Test fixture pre-flight finds no cancelled bookings | low | low | Create on-the-fly via C-04a's Cancel action against `Audit Test Client 1..5` bookings during pre-flight. |
| Inline notice + C-04a next-action card duplicate "this is cancelled" copy | medium | low | Step 11 design — inline notice rendered only when there are practitioner-affordance-paths. Reduces duplication. Manual visual QA during impl. |
| `updateOwnAssignmentStatus` allowing cancelled-completion confuses admins via audit log | low | low | §2.2 + Q9.1 + code comment in Step 6. Documented design. |
| **(amendment) `filterBookings` refactor breaks an existing view** | low | medium | New `filterBookings.test.ts` has 10 cases covering view×status combinations. Run before commit. Manual Playwright sweep of every view (attention/today/upcoming/claimable/assigned/unassigned/partially_assigned/completed/cancelled/all) confirms no regression. |
| **(amendment) Strikethrough is illegible at 375 mobile** | low | low | `decoration-1` (thin) instead of default thicker line; tested visually at 375 in Phase D verify checkpoint. Adjust during impl if visual QA flags. |
| **(amendment) Status filter UI dropdown order confuses users** ("Cancelled" is now functional but used to silently fail) | low | low | Existing dropdown order unchanged (`BookingsChrome.tsx:511-518`). Empty-state copy handles the "0 cancelled in this view" case. Documentation via release-note line. |
| **(amendment) Cross-surface `BookingHistoryCard` styling diverges from list row** | low | low | Step 16 acknowledges shape differences; either lift `inertRowClassNames` helper or duplicate inline. Visual QA at impl time. |
| **(amendment) "view=all" still shows cancelled rows in mixed list** | low | low | Documented as "unchanged from current behaviour". `view=all` is explicit user opt-in to seeing everything. Acceptable. |

### 4.1 Real risk: `canReassignBookings` derivation location

**UPDATED 2026-07-26 (F5):** confirmed via this pass's grep — `canReassignBookings` is derived once, at `[bookingId]/page.tsx:319` (`const canReassignBookings = fullScope && canAssignBookings(profile);`), not at the `883-890` usage site cited in Step 10's original text. Still re-verify at impl time — `git grep -n "canReassignBookings" src/app/admin/bookings/` — since intervening Band C plans may shift line positions before C-05 executes. If it's computed in multiple places, add `isBookingActive &&` to each.

---

## 5 — Undo procedure

### 5.1 Undo code (3 phases)

Phases are commits in order. Revert in reverse:
1. `git revert <phase-C-ui-commit>` — UI predicates revert; cancelled bookings show affordances again. SQL JOIN reverts (claimable list shows cancelled). Inline notice removed.
2. `git revert <phase-B-server-commit>` — server actions no longer gated. Direct claim attempts on cancelled bookings succeed again.
3. `git revert <phase-A-helper-commit>` — `ensureBookingActive` + `hasClaimableAssignment` past-date filter removed.

If only phase C is reverted but A + B stay, the system has server-side defense + foundational-predicate defense, but UI shows stale affordances. Functional but ugly. **Recommend keeping all 3 phases together** for clean rollback semantics.

### 5.2 Test data restoration

Any cancelled test bookings used in E2E should be restored via C-04a's Restore button at the end of the sweep:

```sql
-- Or via SQL if Restore button isn't accessible during rollback:
UPDATE bookings SET status = 'confirmed' WHERE id IN ('<test-cancelled-ids>');
```

Document the round-trip in the progress file.

### 5.3 No DB rollback

C-05 has no migrations. No DB state to undo.

---

## 6 — Test fixture guidance

**Safe for any C-05 E2E walk:**
- Cancelled test bookings — create via C-04a Cancel action against `Audit Test Client *` bookings during pre-flight.
- Past-dated active test bookings — manually back-date `booking_date` via SQL.

  > ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
  > An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
  > Action: back-date a test booking's `booking_date` via SQL to create/refresh a past-dated fixture.
  > Exact SQL / change: `UPDATE bookings SET booking_date = '<past-date>' WHERE id = '<test-booking-id>'` — target must be a safe test booking (see DO-NOT-TOUCH block in §0; never Badar's `9d55ce2a`).
  > Post-action verification: `SELECT id, booking_date FROM bookings WHERE id = '<test-booking-id>'` returns the new date.
  > Never auto-apply. Approval is per-action and does not carry forward.
- No_show test bookings — create via C-04a's new no_show quick action against test bookings.

**DO NOT touch:**
- Badar's `9d55ce2a` (real email `avonrk@hotmail.co.uk`) — explicitly off-limits.
- Any non-test client booking.

**Pre/post SQL check before any state mutation:**
```sql
SELECT id, contact_full_name, contact_email, status, booking_date FROM bookings WHERE id = '<id>';
```
Cross-reference against the safe-fixture list before clicking.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — `ensureBookingActive` helper + `hasClaimableAssignment` update + tests + shared `_helpers.ts` (incl. `isBookingMomentPastLondon` for C-04a co-share) |
| 2 | Phase B — server action hooks (claimBookingAssignment + updateBookingAssignment) + design-note comment on updateOwnAssignmentStatus + test additions |
| 3 | Phase C — UI predicates + inline notice + SQL JOIN + in-memory filter past-date defense |
| 4 | Phase D — `filterBookings` status-aware refactor (Edit Point 8) + `filterBookings.test.ts` + cancelled-row strikethrough on list (Edit Point 9) + cross-surface strikethrough on `BookingHistoryCard` |
| 5 | Verification gate — Playwright screenshots + progress file + master plan checklist row → ✅ |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-05 {phase}` prefix during C-C.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. **Verify C-04a is merged** before starting (pre-flight Step 5). C-04a's Restore button is the lockdown's survival path.
3. Run §0 Pre-flight in full.
4. Execute Phase A → B → C in order.
5. No migration needed — purely code changes.
6. Verification gate (§3) non-negotiable.
7. Update `redesign/per-page-progress/C-05-cancelled-bookings-inert-progress.md` per phase.
8. Final commit updates master plan checklist C-05 row from `⏳` to `✅` with shipped date + commit SHA.
9. After C-05 ships, **C-04a + C-05 together complete the cancellation/restore lifecycle hardening.** Next plan in the recommended C-B order: C-01.

---

## 9 — Open questions remaining

Surfaced during plan-writing:

1. **`canReassignBookings` derivation site verification** — §4.1. Grep at impl time to confirm single derivation point.

2. **Inline notice vs next-action card overlap** — Step 11 + §4 table. Visual QA at impl time may merge them or adjust spacing.

3. ~~`bookings.deleted_at` SELECT conditional handling — Step 1 + pre-flight Step 6. If C-06 ships after C-05 (against recommended order), the helper SELECT needs a fallback. Plan handles both cases.~~ **RESOLVED 2026-07-26 (Checkpoint D4 / finding F4):** C-06 is now a hard pre-flight gate (Step 6); the helper ships a single unconditional SELECT, no fallback. If C-06 ships out of order, pre-flight Step 6 stops execution before Phase A begins.

4. **`canOpenBookingRecord` posture** — Step 2b documents the decision (keep as-is). Reviewer (you) may want stricter gating; trade-off is breaking Therapist's audit-trail access to their previously-assigned bookings.

5. **Test fixture creation Zone-2 prompts** — back-dating bookings for past-date testing requires SQL writes. Pre-flight Step 7 + §6 flag the need for user confirmation per back-date.

6. **(amendment 2026-05-26) `_helpers.ts` ownership shared with C-04a** — both C-04a (S6 datetime guard) and C-05 (date-level past guard + datetime guard for strikethrough cross-surface) want shared utilities. Per recommended C-B order, C-04a ships Phase A before C-05 ships Phase A; the helper module lands in C-04a first and C-05 imports. If order flips, C-05 creates and C-04a imports. Either way single-source.

7. **(amendment 2026-05-26) Cancelled-tab promotion declined** — Q9.8 documents the audit-driven decision: top-tier tab stays forward-looking; cancelled fits the archive overflow grouping. If user later requests promotion (or if traffic data shows the dedicated tab is the dominant path), re-open as a C-12+ chrome polish item.

8. **(amendment 2026-05-26) `view=all` mixed display** — Phase D §4 risk-table notes that `view=all` continues to show cancelled rows by default (unchanged behaviour). Debatable whether `view=all` should also exclude cancelled when status filter is unset; current design assumes "All" really means all. Revisit if user feedback indicates noise.

9. **(amendment 2026-05-26) Empty-state copy enrichment** — brief Q9.10 flags a small UX polish: when `status=cancelled` returns 0 rows in a view (e.g., user on today + filter=cancelled but no cancelled-today bookings), a hint like "Try the Cancelled / No-show tab for the full archive" could help. Out of C-05 scope unless QA finds it materially confusing.

---

*End of C-05 plan. Brief: `redesign/briefs/C-05-cancelled-bookings-inert-brief.md`. Progress: `redesign/per-page-progress/C-05-cancelled-bookings-inert-progress.md` (filled during C-C).*
