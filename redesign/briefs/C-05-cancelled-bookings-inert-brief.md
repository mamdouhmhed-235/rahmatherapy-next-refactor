# C-05 — Lock cancelled / no_show / past-dated bookings inert (the lockdown)

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q1 + §3 C-05 (locked scope — 7 edit points + `ensureBookingActive` centralised helper)
- `redesign/audits/C-A/W05-assignment-claim-reassign-flow.md` §0+§10 (6 edit points + W04 §0 correction + recommended helper shape)
- `redesign/audits/C-A/04-bookings-detail-audit.md` (B-15: 3 detail-page UI predicate sites)
- `redesign/audits/C-A/02-bookings-list-audit.md` (B-04: claimBookingAssignment server-action gate + the in-memory view filter)
- `redesign/audits/C-A/R05-therapist-fresh-day.md` (B-171: past-dated claimable bookings — the 7th edit point)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-05-cancelled-bookings-inert-plan.md`
- Progress: `redesign/per-page-progress/C-05-cancelled-bookings-inert-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-05 is the smallest C-B plan by scope and the **defensive complement to C-04a**. It says: *cancelled, no_show, and past-dated bookings are inert for all roles*. To act on them, the actor must first restore via C-04a's Restore button. The lockdown is implemented via one centralised server-side helper (`ensureBookingActive`) plus UI-layer defense-in-depth at 6 predicate sites.

**The 7 edit points** (consolidated from W05 §10 + R05 B-171):

| # | Site | Layer | Today's gap |
|---|---|---|---|
| 1 | `bookings/actions.ts:269-275` — `claimBookingAssignment()` SELECT booking + guard | server | Booking SELECT doesn't load `status`; no status check |
| 2 | `bookings/[bookingId]/page.tsx:787-791` — `canClaim` predicate | UI | No booking-status check |
| 3 | `bookings/[bookingId]/page.tsx:794 + 798-801` — `isOwn` + `canPromptForSessionNote` (mark-complete + mark-no-show buttons) | UI | No booking-status check |
| 4 | `bookings/[bookingId]/page.tsx:883-890` — `canReassignBookings` (AssignmentManager) | UI | Computed upstream — no booking-status check |
| 5 | `bookings/page.tsx:114-122` — `claimableRows` SQL fetch | SQL | No JOIN to filter cancelled bookings (masked by in-memory filter — defense gap) |
| 6 | `bookings/access.ts:24-33` — `hasClaimableAssignment` predicate | predicate (foundational) | No booking-status check |
| **7** | **Same helper** — past-date guard | predicate + server | **NEW** — no temporal guard; past-dated bookings can be claimed (B-171) |

**The shape:** one helper, applied centrally at the server action layer for primary defense; the 6 UI predicate sites add a multiplied `isBookingActive` factor so the affordances disappear cleanly.

**Sequencing:** **C-05 ships AFTER or WITH C-04a.** The lockdown is only survivable when admins have the Restore button.

---

## 1 — Why this plan exists

### 1.1 The master-plan vantage was inverted (B-130 resolved)

W05 B-130 surfaced the unresolved vantage: master plan said "cancelled bookings can't be claimed/assigned", but the data layer disagreed — Owner CAN claim/reassign cancelled bookings today. The Therapist's claimable-tab view was UI-filtered, hiding the gap.

C-B-DECISIONS Q1 resolved it: **lock down** (interpretation #1). Cancelled and no_show are inert for ALL roles. To act on a cancelled booking, the actor must first restore it via C-04a. Clean state machine. Explicit workflow. Accurate audit trail.

### 1.2 W04 §0 corrected W04 B-124

W04 originally claimed cancelled bookings appeared in the Claimable tab. W05 §0 corrected: the in-memory view filter at `bookings/page.tsx:175-177` DOES exclude cancelled/no_show from the LIST. The actual leak is via:

- **Direct URL access:** therapist deep-links / bookmarks a now-cancelled booking → `canOpenBookingRecord` (`access.ts:35-42`) checks `hasClaimableAssignment` which doesn't filter cancelled. Detail page opens. Claim button renders (no booking-status check at line 787-791). Click → server action runs (no booking-status check at 269-275). Booking gets claimed.

- **Server-side direct invocation:** any caller that hits `claimBookingAssignment` with a valid `assignment_id` belonging to a cancelled booking succeeds, because the SELECT at line 269-275 only fetches `id, booking_date, start_time, end_time` — no `status`.

C-05 closes the leak at every layer.

### 1.3 Past-dated claimable bookings (B-171)

R05 surfaced live: `/admin/bookings?view=claimable` showed a booking dated `2026-05-24` while the session date was `2026-05-25`. The Therapist-Fresh first-day landed on a phantom yesterday booking. The view filter at `page.tsx:175-177` checks status but not `booking_date >= today`. C-05 adds the temporal guard to the same helper so all three predicate-types are gated.

### 1.4 Independent state-machines (B-129) — out of C-05 scope, noted for context

W05 B-129 flagged that `bookings.status` and `booking_assignments.status` are independent. C-04a's auto-promote (when all assignments are terminal) addresses one side of this. C-05 doesn't unify the state machines; it just asks "is the parent booking actively bookable?" — a single boolean predicate that uses `bookings.status` as the authoritative signal.

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-05)

C-05 ships:

### 2.1 The centralised helper

**New helper `ensureBookingActive(bookingId, supabase)` in `src/app/admin/bookings/access.ts` (or a colocated helpers file).**

```ts
export type BookingActivityCheck =
  | { active: true; booking: { id: string; status: string; booking_date: string; start_time: string } }
  | { active: false; reason: "not_found" | "cancelled" | "no_show" | "past_dated"; message: string };

export async function ensureBookingActive(
  bookingId: string,
  supabase: SupabaseClient,
  options: { allowToday?: boolean } = { allowToday: true }
): Promise<BookingActivityCheck> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, status, booking_date, start_time")
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    return { active: false, reason: "not_found", message: "Booking not found." };
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

  // Temporal guard (B-171) — past-dated bookings are inert
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const minDate = options.allowToday ? today : addDaysISO(today, 1);
  if (booking.booking_date < minDate) {
    return {
      active: false,
      reason: "past_dated",
      message: "This booking is in the past. Actions are no longer available.",
    };
  }

  return { active: true, booking };
}
```

Pattern note: returns a discriminated union rather than throwing. Allows callers to surface the structured reason to the UI for a precise error message. Server actions wrap the call:

```ts
const activityCheck = await ensureBookingActive(bookingId, adminClient);
if (!activityCheck.active) {
  return { error: activityCheck.message };
}
```

### 2.2 Edit point 1 — server action `claimBookingAssignment`

In `bookings/actions.ts:269-275`, replace the existing SELECT (currently `.select("id, booking_date, start_time, end_time")`) with a call to `ensureBookingActive(assignment.booking_id, adminClient)`. If not active, return the structured error. The existing `getClaimAssignmentEligibility` runs after (eligibility logic for busy/blocked/window — orthogonal).

Same hook in:
- `updateBookingAssignment` (admin reassign path, line ~459) — before any UPDATE.
- `updateOwnAssignmentStatus` (line 564) — should the practitioner be able to mark their assignment complete on a cancelled booking? **Decided as YES** during plan-writing — see §9 Q9.1. Reason: a practitioner who was assigned and then the booking got cancelled still needs to be able to mark the visit no_show / completed for forensic accuracy (e.g., they arrived before the cancellation propagated). Gate only by `bookings.deleted_at` (once C-06 lands) not by `bookings.status`. The auto-promote helper in C-04a is conditional on booking not being cancelled, so the practitioner's completion doesn't propagate. Clean.

### 2.3 Edit points 2-4 — booking detail UI predicates

In `src/app/admin/bookings/[bookingId]/page.tsx`, derive a top-level boolean once and multiply through:

```ts
const today = getTodayIsoDate();  // function already exists in bookings/page.tsx; lift to shared util
const isBookingActive =
  booking.status !== "cancelled" &&
  booking.status !== "no_show" &&
  booking.booking_date >= today;
```

Update predicates:
- Line 787-791 (`canClaim`): `canClaim = isBookingActive && isUnassigned && canClaimAssignments(profile) && assignment.required_therapist_gender === profile.gender && claimPreview?.eligible === true`.
- Line 794 (`isOwn`): unchanged behaviour for assignment-state tracking, but **mark-complete + mark-no-show buttons** at lines 864-872 + 873-881 get a new wrapping condition `{isOwn && isBookingActive ? <BookingActionButton ...> : null}`. Practitioners still see the assignment was ever assigned, but can't act once the parent booking is cancelled.
- Line 798-801 (`canPromptForSessionNote`): same multiplier — `canPromptForSessionNote = isBookingActive && isAssignedToActor && canCreateSessionNotes(profile) && Boolean(booking.client_id)`.
- Line 883-890 (`canReassignBookings`): wherever this is derived (look for `canReassignBookings = canManageBookings(...) && canAssignBookings(...)` at top of file), append `&& isBookingActive`. AssignmentManager disappears for inert bookings.

UI feedback: when `!isBookingActive` AND the actor would otherwise see actionable affordances, surface an inline notice at the top of the assignments section:

```
ℹ️ This booking is cancelled. Restore it to assign or complete work.
```

For past-dated:

```
ℹ️ This booking is in the past. Reach out to support if a record needs correcting.
```

### 2.4 Edit point 5 — list fetch SQL query

`bookings/page.tsx:114-122` (`claimableRows`): the query fetches `booking_assignments` rows directly (matching unassigned/null/gender) — it doesn't join `bookings` table. Adding the JOIN via PostgREST embedded resource:

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

(PostgREST `!inner` join applies the `not.in` filter as a constraint on the booking row, so cancelled bookings drop from the join result. `bookings.booking_date >= today` is the temporal guard.)

The in-memory view filter at `:175-177` keeps its existing cancelled/no_show check **and adds a past-date check** for defense-in-depth:

```ts
(view === "claimable" &&
  !["cancelled", "no_show"].includes(booking.status) &&
  booking.booking_date >= today &&
  hasClaimableAssignment(booking, profile))
```

### 2.5 Edit point 6 — foundational predicate `hasClaimableAssignment`

`access.ts:24-33`: the predicate currently checks only assignment-side fields. It doesn't have access to booking.status today (signature takes `BookingRecord` which DOES include `status`). Simple fix:

```ts
export function hasClaimableAssignment(booking: BookingRecord, profile: StaffProfile) {
  if (!canClaimAssignments(profile)) return false;
  if (booking.status === "cancelled" || booking.status === "no_show") return false;
  // Past-date check requires a `today` parameter — see plan §1 Step 3 for the signature change.

  return booking.booking_assignments.some(
    (assignment) =>
      assignment.status === "unassigned" &&
      !assignment.assigned_staff_id &&
      assignment.required_therapist_gender === profile.gender
  );
}
```

The signature gains an optional `todayISO?: string` parameter for the temporal guard. Callers that already compute `today` (e.g., the list-page filter at line 164) pass it through. Callers that don't (e.g., `canOpenBookingRecord`) compute it inline.

### 2.6 Edit point 7 (NEW) — past-date guard

Folded into the helper + the foundational predicate. The detail-page top-level `isBookingActive` boolean already includes the check.

**Explicit policy:** "past-dated" means `booking_date < today` (Europe/London midnight). A booking happening LATER today (e.g., start_time = 14:00 and now = 10:00) is still active. A booking at TODAY 09:00 when current time is 13:00 is **still considered active by the helper** — the helper is date-level, not time-level. Time-level guard belongs in C-04a's auto-promote / no_show flow. The Therapist-Fresh phantom-claimable case in R05 was about a yesterday booking, which this guard catches.

---

## 3 — RBAC matrix (C-05 enforcement × roles)

C-05 does not introduce new permissions. It tightens existing gates uniformly:

| Action on cancelled / no_show / past-dated booking | Owner | Admin | Coord | Therapist |
|---|---|---|---|---|
| Claim an unassigned slot | ❌ blocked | ❌ blocked | ❌ blocked | ❌ blocked |
| Reassign / unassign an assignment | ❌ blocked | ❌ blocked | ❌ blocked | n/a |
| Mark own assignment complete/no_show | ✅ allowed (see §2.2 design note) | ✅ allowed | ✅ allowed | ✅ allowed |
| View booking detail (read-only) | ✅ | ✅ | ✅ | ✅ if previously assigned |
| Open `/admin/bookings` filtered to claimable | ✅ but shows nothing if no active claimable | same | same | same |

Therapist who was previously assigned to a now-cancelled booking can still navigate to the detail (`canOpenBookingRecord` uses `isOwnBooking` which doesn't filter status — that's intentional, audit-trail-preserving). They just can't take any forward action. The detail page surfaces the inline notice explaining the lockdown.

---

## 4 — Layout strategy

C-05 is mostly a behavioural lockdown. UX changes are minimal:

### 4.1 Disappeared affordances

On a cancelled / no_show / past-dated booking detail:
- "Claim" button → not rendered.
- "Mark complete" + "Mark no-show" buttons (for own assignments) → not rendered on the assignment row (but still allowed via direct invocation per §2.2 design note — UI hides; server allows for the forensic-completion edge case).
- AssignmentManager block → not rendered.

The page reads coherently — the next-action strip (from C-04a) tells the user "This booking is cancelled. Restore it..." and the assignment rows show their state without action buttons.

### 4.2 Inline notice in the assignments section

When the actor has UI rights that would otherwise produce affordances:

```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  This booking is cancelled.                          │
│    Restore it before claiming, reassigning, or          │
│    marking work complete.                                │
└─────────────────────────────────────────────────────────┘
```

For past-dated:
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  This booking is in the past.                        │
│    Editing past bookings should go through support.     │
└─────────────────────────────────────────────────────────┘
```

For no_show:
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  This booking is marked no-show.                     │
│    Restore it if the client did attend.                 │
└─────────────────────────────────────────────────────────┘
```

Placement: between the page header and the assignments section. The next-action strip from C-04a already does some of this work — coordinate copy so the two cards don't repeat the same hint.

### 4.3 Claimable list — no past-dated rows visible

`/admin/bookings?view=claimable` is consistent: never shows rows where the parent booking is cancelled, no_show, or past-dated. Therapist-Fresh's first-day phantom-yesterday case is gone.

### 4.4 Server error messages

When a server action fails the `ensureBookingActive` check:
- `"This booking is cancelled. Restore it from the booking detail page first."`
- `"This booking is marked no-show. Restore it from the booking detail page first."`
- `"This booking is in the past. Actions are no longer available."`
- `"Booking not found."`

These surface as toast / form-banner errors via the existing `{ error: ... }` action-state pattern.

---

## 5 — States & edge cases

### 5.1 Therapist marks own assignment complete on a just-cancelled booking

**Locked decision (per §2.2 + Q9.1):** allowed. The practitioner might have completed the visit before the cancellation propagated (e.g., admin cancelled at 13:00; practitioner arrived at 13:15 and the work happened). They mark their assignment complete for forensic accuracy. The booking-level status stays cancelled. Auto-promote (C-04a) does NOT fire because auto-promote's predicate excludes `bookings.status === 'cancelled'`.

### 5.2 Race condition — cancellation lands DURING a claim attempt

Admin clicks Cancel at 13:00:00.500. Therapist clicks Claim at 13:00:00.510. Race:
- `ensureBookingActive` runs first → returns `active=true` (read happens before the cancel commits).
- `claimBookingAssignment` proceeds → UPDATE on `booking_assignments` succeeds.
- Booking status flips to `cancelled` 1ms later.

Result: a cancelled booking with a newly-assigned therapist. Acceptable race window — the auto-promote / Restore flow handles it cleanly: practitioner can mark complete (§5.1); admin can either Restore the booking or accept it as a cancelled-but-assigned record.

If the race feels too sloppy, add an additional check after the assignment UPDATE: re-fetch booking.status; if it's now cancelled, roll back the assignment. Heavier; out of C-05 scope unless a concrete bug is observed.

### 5.3 Booking flips from `confirmed` to `cancelled` while a user is on the detail page

UI state is stale; user sees outdated "Mark complete" button. Click → server returns `"This booking is cancelled. ..."` toast. User refreshes → buttons disappear. Acceptable. The page can add a polling watcher in a future plan; out of C-05 scope.

### 5.4 Past-dated booking that's still `pending` or `confirmed`

Per the policy in §2.6: blocked. C-04a's `no_show` quick action is the migration path — if a confirmed past-dated booking exists and the client didn't show, admin marks no-show; otherwise the auto-promote logic from C-04a brings it to completed. The temporal guard in C-05 prevents NEW claim/reassign/complete activity on stale rows.

### 5.5 Cancelled-then-restored booking — should past-status be remembered?

C-04a's audit log captures the round-trip (`booking_restored` row with `before_state.status='cancelled'`). C-05 has nothing to remember — once `bookings.status` is `confirmed` again, `isBookingActive` returns true. The forensic trail lives in audit_logs.

---

## 6 — Migration footprint

**None.** C-05 is pure code — no schema changes, no new permissions, no new audit/email types.

The helper + predicate edits are all in TypeScript. The SQL query change at edit point 5 is a PostgREST inner-join, not a migration.

---

## 7 — Files touched (preview — full list in plan)

### NEW (1 file)
- `src/app/admin/bookings/__tests__/ensureBookingActive.test.ts` — vitest coverage for the helper

### EDITED (~5 files)
- `src/app/admin/bookings/access.ts` — `hasClaimableAssignment` adds booking-status + temporal-guard; export new `ensureBookingActive` helper (or colocate in a new file — see plan §1).
- `src/app/admin/bookings/actions.ts` — `ensureBookingActive` call at top of `claimBookingAssignment` + `updateBookingAssignment`; `updateOwnAssignmentStatus` left as-is per §2.2.
- `src/app/admin/bookings/[bookingId]/page.tsx` — `isBookingActive` top-level derivation; multiply through `canClaim`, `isOwn`-derived buttons, `canPromptForSessionNote`, `canReassignBookings`. Add inline notice block.
- `src/app/admin/bookings/page.tsx` — `claimableRows` SQL JOIN; in-memory filter adds past-date check; lift `getTodayIsoDate()` to shared util OR inline.
- `src/app/admin/bookings/__tests__/access.test.ts` — extend existing tests (if present) with cancelled/no_show/past-dated cases.

### UNCHANGED
- `manage/actions.ts` (customer-facing) — out of scope; customer can't claim/reassign anyway.
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix (no changes).
- All email templates / notifications — no new emails.

---

## 8 — Sequencing and dependencies

**Hard dependency:** **C-04a must ship first** (or simultaneously). The lockdown without a Restore button strands admins on mistakenly cancelled bookings.

**No dependency on C-06.** C-05 doesn't touch `clients.deleted_at`. The forward-looking `bookings.deleted_at` check (added by C-06) could be folded into `ensureBookingActive` as an additional reason: a booking whose parent client is soft-deleted is also inert. **Decided at plan-writing time:** ship the basic 3-reason helper in C-05; C-06 (which lands first by recommended order) adds the `deleted_at` check via a small follow-up to `ensureBookingActive`. The helper's discriminated-union return type makes that an additive change.

Actually, given the recommended C-B order is C-06 → C-04a → C-05, by the time C-05's C-C work runs, C-06's `bookings.deleted_at` is in place. **Plan §1 adds the deleted_at reason from day one** — null-safe pre-C-06.

**No dependency on C-09 (cache).** The new SQL JOIN at edit point 5 doesn't add a cache tag — it's part of the page's existing fetch chain. C-09's tag retrofit covers it later.

---

## 9 — Open questions

**Q9.1 — Should `updateOwnAssignmentStatus` be gated by `ensureBookingActive`?**

Locked in §2.2: **NO**. Practitioner can still mark their own assignment complete/no_show on a cancelled booking — for the forensic edge case where the visit happened before cancellation propagated. The auto-promote helper from C-04a doesn't fire (it checks booking-not-cancelled), so no parent-level state pollution.

Counter-argument considered: if the booking was cancelled days ago and the practitioner now marks their assignment complete by mistake, that creates a confusing audit trail. Mitigation: the assignment row's audit log captures the mistake; admin can correct via direct DB / staff conversation. Low-frequency edge case.

**If the user prefers stricter gating**, flip to: gate `updateOwnAssignmentStatus` by `ensureBookingActive` AND add a Restore button for the practitioner to surface the path. Heavier; rejected for C-05.

**Q9.2 — Should past-dated bookings allow READ-ONLY view of the detail page?**

Locked: **yes**. The detail page renders; only action affordances disappear. Audit log + history is preserved.

**Q9.3 — `ensureBookingActive` location: `access.ts` or a new `bookings-active-helper.ts`?**

Decided in plan §1: colocate in `access.ts` since it shares the `canOpenBookingRecord` import surface. Single file for booking-level predicates.

**Q9.4 — Should the helper accept an optional `purpose` param for telemetry?**

Speculative. Skipped. If we want to know "which path called ensureBookingActive and got blocked", the existing server action error message + audit_logs is sufficient.

**Q9.5 — Past-dated policy boundary: include today or not?**

Locked: **include today** (`booking_date >= today` is allowed). The Therapist arriving on the same day to claim a last-minute open slot is a real workflow. The helper's `options.allowToday` defaults to true. Server actions all use the default.

**Q9.6 — Cross-cutting with C-04a's no_show quick action.**

C-04a adds `no_show` to `quickUpdateBooking` with its own temporal guard (rejects future-dated). C-05's `ensureBookingActive` rejects past-dated. The two guards are independent and non-overlapping. Both ship.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-05 implementation is complete when:

1. **Claim attempt on cancelled booking fails server-side** with structured error message. Verify: as Therapist with permission, post to `claimBookingAssignment` with an `assignment_id` of a cancelled booking → returns `{ error: "This booking is cancelled. ..." }`. No DB mutation.
2. **Reassign attempt on cancelled booking fails server-side** with structured error. Verify: as Owner, post `updateBookingAssignment` with assign-to-staff payload on cancelled booking → returns error.
3. **`updateOwnAssignmentStatus` still works on cancelled booking** per §2.2 design note. Verify: as Therapist with assignment on a cancelled booking, mark assignment complete → DB updates, audit row written, auto-promote does NOT fire.
4. **Claim button hidden** on cancelled / no_show / past-dated booking detail. Verify visually at 4 viewports.
5. **Mark complete / Mark no-show buttons hidden** on own assignment of cancelled / no_show / past-dated booking. (Server still allows per §2.2.)
6. **AssignmentManager hidden** on cancelled / no_show / past-dated booking detail.
7. **Inline notice rendered** explaining the lockdown reason.
8. **Claimable list excludes** cancelled / no_show / past-dated bookings — at both SQL fetch (edit point 5) and in-memory filter (defense-in-depth).
9. **Therapist-Fresh no longer sees the phantom past-dated booking** in `/admin/bookings?view=claimable`. The B-171 reproduction repeats clean.
10. **Restore via C-04a flips the booking back to active** — claim/reassign/complete-buttons reappear immediately after restore.
11. **All static gates pass:** lint, tsc, vitest, build, bundle delta within budget.
12. **Playwright role sweep at 375 / 768 / 1280 / 1440 passes** for all 4 roles.
13. **Badar's `9d55ce2a` cancelled booking is untouched** during E2E testing.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q1 + §3 C-05 | Lockdown decision + 7-edit-point list |
| `W05-assignment-claim-reassign-flow.md` §0+§10 | Edit-point inventory + W04 §0 correction + helper-recommended shape |
| `R05-therapist-fresh-day.md` §3 B-171 | Past-dated case (7th edit point) |
| `04-bookings-detail-audit.md` B-15 | 3 detail-page UI predicate sites |
| `02-bookings-list-audit.md` B-04 | claimBookingAssignment server-action gate (edit point 1) |
| `bookings/actions.ts:239-365` | `claimBookingAssignment` body — where helper hooks in |
| `bookings/actions.ts:449-562` | `updateBookingAssignment` body — second helper hook |
| `bookings/actions.ts:564-625` | `updateOwnAssignmentStatus` — explicitly NOT gated (§2.2) |
| `bookings/[bookingId]/page.tsx:787-891` | 3 UI predicate sites |
| `bookings/page.tsx:114-122` | claimableRows SQL — edit point 5 |
| `bookings/page.tsx:175-177` | In-memory view filter — defense-in-depth past-date |
| `bookings/access.ts:24-33` | `hasClaimableAssignment` predicate |
| `BAND-C-MASTER-PLAN.md` Part 0 | Operating discipline |

---

## 12 — Out of scope (explicit non-goals)

- **Time-of-day temporal guard** — C-05's past-date check is date-level, not time-level. C-04a handles the future-date guard on `complete` / `no_show`.
- **State-machine unification** (bookings.status vs booking_assignments.status) — W05 B-129, deferred.
- **Per-role override permission** (e.g., Owner can override the lockdown) — rejected during plan-writing. The Restore-first workflow is the override path; explicit + audited.
- **`updateOwnAssignmentStatus` lockdown** — §2.2 design note keeps it open.
- **Polling/realtime sync** on detail page state — out of scope; stale-UI race acceptable.
- **`bookings.deleted_at` integration** with `ensureBookingActive` beyond the basic null-safe check — C-06 owns the deleted-row read-filter sweep; C-05 just adds the column to the helper's SELECT.
- **Audit log "lockdown_attempt" entries** — speculative; no entry written when the helper blocks. The existing server-action error path is sufficient (caller's error toast renders the structured reason).
- **`canOpenBookingRecord` filtering** — preserved (cancelled bookings remain navigable for audit purposes). Only forward actions are gated.

---

*End of C-05 brief. Plan file follows: `redesign/plans/C-phase/C-05-cancelled-bookings-inert-plan.md`.*
