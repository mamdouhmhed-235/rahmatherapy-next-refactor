# C-FIELDWORK-EXPERIENCE — Capability-keyed fieldwork ergonomics — **PLAN**

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-FIELDWORK-EXPERIENCE-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-FIELDWORK-EXPERIENCE-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** `git status --short` empty. HEAD on `redesign/start-state`.
2. **Dev server reachable.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 baseline failures preserved).
4. **Static gates green.** `pnpm lint`, `npx tsc --noEmit` both 0 errors.
5. **Code surfaces unchanged from plan-writing snapshot:**

   ```bash
   # Confirm BookingDetailSidebar.tsx still has the tel: + maps patterns at the documented lines
   git grep -n 'href={`tel:' src/app/admin/bookings/[bookingId]/BookingDetailSidebar.tsx
   # Expected: line 142 (or close)

   git grep -n 'maps.google.com\|maps/search' src/app/admin/bookings/[bookingId]/BookingDetailSidebar.tsx
   # Expected: line 279 (or close)

   git grep -n 'getGreeting\|buildMapsHref\|buildAddressLines' src/app/admin/dashboard/TherapistDashboard.tsx
   # Expected: 6+ hits including line 1361 export
   ```

6. **DB verification — capability column populated:**

   ```sql
   SELECT email, name, can_take_bookings FROM staff_profiles ORDER BY can_take_bookings DESC, name;
   ```

   At least one Owner / Admin / Coord test account has `can_take_bookings=true` for the E2E dual-view test, plus the Therapist accounts. If not, identify which to flip and confirm with the user before Zone-2 update.

7. **Test fixture inventory:**
   - At least one assigned-to-Therapist test booking with a future date (for hero "Next visit" rendering).
   - At least one assigned-to-Owner test booking (for dual-view verification when Owner has `can_take_bookings=true`).
   - At least one cancelled booking that a Therapist was previously assigned to (for §5.4 edge case).
   - Test client with phone + address populated (so `tel:` and maps render fully).

8. **DO-NOT-TOUCH list:** Badar's `9d55ce2a` (cancelled, off-limits). Real customer bookings.

9. **C-B sequencing context:** C-04a and C-05 are recommended to ship before C-FIELDWORK in C-C order (per recommended C-B-DECISIONS §5 order). C-FIELDWORK doesn't hard-depend on either, but:
   - If C-04a is in HEAD: the hero "Mark complete" temporal guard can match the no_show button's pattern.
   - If C-05 is in HEAD: the practitioner-view test cases include cancelled-booking scenarios cleanly.
   - If neither: plan proceeds; cross-plan polish applies later.

If any pre-flight check fails, **stop** and surface to the user.

---

## 1 — Safe implementation order (4 phases, with verify-checkpoints)

### Phase A — Shared helpers + predicate (Step 1-3)

**Step 1 — Create `src/app/admin/dashboard/shared-helpers.ts`.**

New file. Lift the following from `TherapistDashboard.tsx` verbatim:

- `getGreeting()` (lines 89-100)
- `getFirstName(name: string)` (lines 102-104)
- `formatHours(minutes: number)` (lines 106-110)
- `buildAddressLines(booking)` (lines 119-128)
- `buildMapsHref(booking)` (line 130 + body)
- `FORMATTERS` const (lines 76-87) — locale-aware weekday + longDate formatters

Each exported. Plus add the new predicate:

```ts
export interface MinimalBookingForPredicate {
  booking_assignments: Array<{
    assigned_staff_id: string | null;
    status: string;
  }>;
}

/**
 * Capability-keyed predicate: is the viewer an actively-assigned practitioner
 * on this booking? Used by the booking detail page to switch between
 * admin-curator view and practitioner view (mobile sidebar reorder, etc.)
 *
 * Returns false when:
 *   - viewer lacks can_take_bookings capability
 *   - viewer has no assignment row on this booking
 *   - viewer's assignment status is 'unassigned' (slot existed but never claimed)
 *   - viewer's assignment status is 'cancelled' (no longer active)
 *
 * Returns true for: 'assigned', 'completed', 'no_show' assignment statuses
 *   — i.e., the viewer was actively the practitioner for this booking.
 *   Including 'completed' / 'no_show' so retrospective viewing of one's own
 *   work still gets the field-optimised layout (e.g., to follow up).
 */
export function isViewerAssignedPractitioner(
  booking: MinimalBookingForPredicate,
  viewerStaffId: string,
  viewerCanTakeBookings: boolean
): boolean {
  if (!viewerCanTakeBookings) return false;
  return booking.booking_assignments.some(
    (a) =>
      a.assigned_staff_id === viewerStaffId &&
      a.status !== "unassigned" &&
      a.status !== "cancelled"
  );
}
```

**Brief §5 + Q9.2 design note inside the docstring:** the predicate includes `completed` / `no_show` (not just `assigned`). Brief §9.2 originally said "exclude completed" but plan revises: a practitioner reviewing their own historical work needs the client phone too. **Plan locks the inclusive predicate.**

This is a deviation from brief Q9.2; the plan is the source of truth.

**Step 2 — Wire `TherapistDashboard.tsx` to re-export from `shared-helpers.ts`.**

Edit `src/app/admin/dashboard/TherapistDashboard.tsx`:

```ts
// Replace local definitions with imports + re-exports
import {
  getGreeting,
  getFirstName,
  formatHours,
  buildAddressLines,
  buildMapsHref,
  FORMATTERS,
} from "./shared-helpers";

// Keep the line-1361 re-export for backward compat with any external callers
export { getGreeting, getFirstName, formatHours, FORMATTERS };
```

Remove the now-duplicate definitions (lines 76-130 — the function bodies). The rest of TherapistDashboard's render logic uses these symbols unchanged.

**Step 3 — Vitest specs for predicate + helpers.**

New file: `src/app/admin/dashboard/__tests__/shared-helpers.test.ts`.

Coverage:
- `getGreeting()` — mock `Date` for 09:00, 14:00, 20:00; expect "Good morning", "Good afternoon", "Good evening".
- `getFirstName("Sara Mohamed")` → "Sara"; `getFirstName("")` → "".
- `formatHours(60)` → "1h"; `formatHours(120)` → "2h"; `formatHours(45)` → "0.7h" (or similar — match existing behaviour).
- `buildAddressLines` — booking with all 3 fields populated, with one missing, with all missing.
- `buildMapsHref` — booking with address → URL; booking without → null.
- `isViewerAssignedPractitioner`:
  - viewer has `can_take_bookings=false` → false (regardless of assignment).
  - viewer assigned with status='assigned' → true.
  - viewer assigned with status='completed' → true (per plan inclusive predicate).
  - viewer assigned with status='no_show' → true.
  - viewer assigned with status='cancelled' → false.
  - viewer assigned with status='unassigned' → false.
  - viewer not assigned at all → false.

**Phase A verify checkpoint:**
- `pnpm lint` + `tsc` green
- `pnpm vitest run dashboard` — new helpers tests pass; existing TherapistDashboard tests still pass (no behavioural change from the re-export).

### Phase B — Booking detail dual-view (Step 4-6)

**Step 4 — Derive `viewerIsPractitioner` in booking detail page.**

Edit `src/app/admin/bookings/[bookingId]/page.tsx`. Near the top of the server-component body (where `booking` is fetched and `profile` is in scope):

```ts
import { isViewerAssignedPractitioner } from "@/app/admin/dashboard/shared-helpers";
// ... existing imports ...

// In the page body, after booking is loaded:
const viewerIsPractitioner = isViewerAssignedPractitioner(
  booking,
  profile.id,
  profile.can_take_bookings
);
```

**Step 5 — Apply mobile order classes to the parent grid children.**

In the same file, around line 467 (the parent grid):

```tsx
<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
  <div className={viewerIsPractitioner ? "order-2 md:order-1" : "md:order-1"}>
    {/* Existing main content panels: Status, Notes, Participants, Assignment, etc. */}
  </div>
  <div className={viewerIsPractitioner ? "order-1 md:order-2" : "md:order-2"}>
    <BookingDetailSidebar
      booking={booking}
      clientId={booking.client_id}
      showFinancials={showFinancials}
      showClientLink={showClientLink}
    />
  </div>
</div>
```

**Important verification points:**
- The existing structure may have the main content unwrapped (direct children of the grid). Confirm during impl whether the main content is a single element or multiple siblings. If multiple, wrap them in a `<div>` for the order-class to apply atomically.
- At `md+`, the grid's `md:grid-cols-*` defines column positions — `md:order-1` and `md:order-2` ensure the sidebar stays in column 2 regardless of mobile reorder.

**Step 6 — Comment-document the predicate decision.**

Above the grid, add a code comment:

```tsx
// C-FIELDWORK: assigned-practitioner view reorders the sidebar (client phone,
// address, maps) ABOVE the main panels on mobile so the on-the-road practitioner
// gets the critical info first. Admin-curator view (Coord triaging, Owner
// reviewing) keeps the default order. Predicate excludes cancelled / unassigned
// assignment statuses but includes completed + no_show — retrospective viewing
// of own work still gets the field layout. See plan §1 Step 1 design note.
```

Cross-plan link: this works orthogonally to C-05's action-button gating. The reorder applies to cancelled bookings too if the viewer was previously assigned.

**Phase B verify checkpoint:**
- `pnpm lint` + `tsc` green
- Manual Playwright at 375 px:
  - Sign in as Therapist with an assignment → navigate to that booking's detail → verify sidebar (client phone + address) appears at the top of mobile scroll.
  - Sign in as Owner (without can_take_bookings, OR not assigned to that booking) → navigate to same booking → verify main panels appear first (current behaviour).
  - At 1280 px → both views identical (sidebar in column 2).

### Phase C — `PractitionerTodaySection` component (Step 7-9)

**Step 7 — Build the component.**

New file: `src/app/admin/dashboard/PractitionerTodaySection.tsx`.

Structure:

```tsx
"use client"; // for the relative-time wrapper; see Step 8

import Link from "next/link";
import { Clock, MapPin, Phone } from "lucide-react";
import { AdminPanel } from "../components/admin-ui";
import {
  buildAddressLines,
  buildMapsHref,
  formatHours,
  FORMATTERS,
} from "./shared-helpers";
import type { ReportData } from "../reports/reporting";
import { RelativeTimeDisplay } from "./RelativeTimeDisplay"; // Step 8

interface PractitionerTodaySectionProps {
  staffName: string;
  todayAppointments: ReportData["bookings"];
  nextAppointment: ReportData["bookings"][number] | null;
  claimableCount?: number;
}

export function PractitionerTodaySection({
  staffName,
  todayAppointments,
  nextAppointment,
  claimableCount = 0,
}: PractitionerTodaySectionProps) {
  const hasAnyAppt = todayAppointments.length > 0 || nextAppointment;

  if (!hasAnyAppt && claimableCount === 0) {
    return (
      <EmptyDayCard />
    );
  }

  return (
    <>
      {nextAppointment ? (
        <NextVisitHero appointment={nextAppointment} />
      ) : null}
      {todayAppointments.length > 1 ? (
        <TodayList appointments={todayAppointments.slice(0, 5)} />
      ) : null}
      {claimableCount > 0 ? (
        <ClaimableStrip count={claimableCount} />
      ) : null}
    </>
  );
}

function NextVisitHero({ appointment }: { appointment: ReportData["bookings"][number] }) {
  const addressLines = buildAddressLines(appointment);
  const mapsHref = buildMapsHref(appointment);
  const phone = appointment.contact_phone || appointment.clients?.phone || null;
  const clientName = appointment.clients?.full_name || appointment.contact_full_name || "Client";
  // … render hero card with tel: + maps + Mark complete (temporal guard)
}

function TodayList({ appointments }: { appointments: ReportData["bookings"] }) {
  // … list of cards, time + service + client name + area
}

function ClaimableStrip({ count }: { count: number }) {
  return (
    <Link
      href="/admin/bookings?view=claimable"
      className="…inline-flex…"
    >
      Open to claim — {count} available · Browse claimable work →
    </Link>
  );
}

function EmptyDayCard() {
  return (
    <AdminPanel>
      <p className="…">Nothing scheduled today.</p>
      <p className="…">Quiet day. Take care of yourself.</p>
    </AdminPanel>
  );
}
```

(Detailed JSX styling lifts the existing patterns from TherapistDashboard.tsx — find them by searching for `hero` / `next visit` / `Open to claim` in that file.)

**Step 8 — RelativeTimeDisplay sub-component.**

New file: `src/app/admin/dashboard/RelativeTimeDisplay.tsx`.

```tsx
"use client";

import { useEffect, useState } from "react";

interface RelativeTimeDisplayProps {
  targetISO: string;
}

/**
 * Renders "in 1h 12m" etc. relative to the target datetime.
 *
 * Renders an empty string on SSR + first hydration to avoid hydration mismatch,
 * then computes and updates on mount + every minute.
 */
export function RelativeTimeDisplay({ targetISO }: RelativeTimeDisplayProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    const update = () => setText(computeRelative(targetISO));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [targetISO]);

  return <>{text}</>;
}

function computeRelative(targetISO: string): string {
  const target = new Date(targetISO);
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return "now"; // appointment is at-or-past start time
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours > 0) return `in ${hours}h ${remainingMins}m`;
  return `in ${mins}m`;
}
```

Mitigates the hydration risk flagged in brief §5.8.

**Step 9 — Mark complete button — lift the existing `BookingActionButton`.**

The hero's "Mark complete" CTA uses the existing `BookingActionButton` component from `src/app/admin/bookings/[bookingId]/...` (search for it; probably colocated with the assignment row). Import + render:

```tsx
<BookingActionButton
  assignmentId={appointment.booking_assignments?.[0]?.id}
  action="assignment_completed"
  variant="primary"
  disabled={now < startTime}
>
  Mark complete
</BookingActionButton>
```

If `BookingActionButton` doesn't accept `disabled` cleanly, wrap it conditionally:

```tsx
{now >= startTime ? (
  <BookingActionButton ... >Mark complete</BookingActionButton>
) : (
  <button disabled title={`Available at ${formatTime(appointment.start_time)}`} className="...">
    Mark complete
  </button>
)}
```

Plan locks the wrapper-button approach since it doesn't require modifying `BookingActionButton`'s interface.

**Phase C verify checkpoint:**
- `pnpm lint` + `tsc` green
- New PractitionerTodaySection tests pass (see Step 11).
- Standalone preview: render the component in an isolated route or via vitest+RTL snapshot.

### Phase D — Mount in dashboard variants (Step 10-12)

**Step 10 — Refactor TherapistDashboard.tsx to consume PractitionerTodaySection.**

In `TherapistDashboard.tsx`, identify the existing inline today + next-appointment rendering (look for usage of `todayAppointments` + `nextAppointment` props in the JSX). **Replace** that block with:

```tsx
<PractitionerTodaySection
  staffName={staffName}
  todayAppointments={todayAppointments}
  nextAppointment={nextAppointment}
  claimableCount={data.claimableCount /* if available */}
/>
```

Preserve everything else (Profile completion nudge, Personal stripe, Highlight or tip, Recent clients, Quick help panel, Need help section, mobile pull-to-refresh tip).

**Step 11 — Mount conditionally in Business + Coord variants of `page.tsx`.**

Edit `src/app/admin/dashboard/page.tsx`. After computing `today` / `data` / variant routing logic:

```tsx
// Around line 638 where TherapistDashboard is rendered:
if (plan.variant === "therapist") {
  return <TherapistDashboard {...therapistProps} />;
}

// Business variant (Owner + Admin) — currently inline. After existing rendering,
// add the conditional PractitionerTodaySection:
return (
  <AdminPageScaffold>
    {/* existing Business variant content */}

    {profile.can_take_bookings && (
      <PractitionerTodaySection
        staffName={profile.name}
        todayAppointments={businessTodayAppointments}  // computed alongside the data fetch
        nextAppointment={businessNextAppointment}
        claimableCount={businessClaimableCount}
      />
    )}

    {/* rest of existing content (e.g., recent activity) */}
  </AdminPageScaffold>
);
```

**Coordinator variant** — same pattern. Wherever the Coord-specific content is rendered (look for `isCoordinatorVariant`), add the conditional mount.

**Step 12 — Extend `dashboard-data.ts` if data fetch needs new fields.**

The existing fetch may not surface `todayAppointments` + `nextAppointment` for non-Therapist variants. Verify:

```bash
git grep -n "todayAppointments\|nextAppointment" src/app/admin/dashboard/dashboard-data.ts
```

If those are Therapist-only currently, extend the fetch to compute them for all `can_take_bookings=true` viewers:

```ts
// Inside getDashboardData() — extend for can_take_bookings viewers
if (profile.can_take_bookings) {
  // Fetch today's assignments for this staff
  // Compute nextAppointment (closest future) + claimableCount
  // Return alongside other fields
}
```

If the data is already computed elsewhere (e.g., `getRecentClientsForTherapist` references), see if it can be reused. Plan locks: prefer extending existing helpers over duplicating queries.

**Vitest specs for PractitionerTodaySection:**

New file `src/app/admin/dashboard/__tests__/PractitionerTodaySection.test.tsx`:
- Renders next-visit hero when `nextAppointment` is provided.
- Renders today list when `todayAppointments.length > 1`.
- Caps today list at 5 items + "View all" link.
- Renders empty card with R05 PE-1 copy when no appointments + no claimable.
- Renders claimable strip when `claimableCount > 0`.
- Mark complete button disabled when current time < start_time, enabled at/after.
- tel: link renders only when phone is non-null.
- Maps button renders only when address is non-null.

**Phase D verify checkpoint:**
- `pnpm lint` + `tsc` green
- All new component tests pass
- Existing dashboard tests still pass
- Playwright: Therapist dashboard renders identically (refactor is behaviour-preserving)
- Playwright: Owner with `can_take_bookings=true` sees PractitionerTodaySection mounted in Business variant

---

## 2 — Files touched (final list)

### NEW (4 files)
| File | Purpose |
|---|---|
| `src/app/admin/dashboard/shared-helpers.ts` | Lifted utils + new predicate |
| `src/app/admin/dashboard/PractitionerTodaySection.tsx` | Drop-in component |
| `src/app/admin/dashboard/RelativeTimeDisplay.tsx` | Hydration-safe relative time |
| `src/app/admin/dashboard/__tests__/shared-helpers.test.ts` | Helpers + predicate coverage |
| `src/app/admin/dashboard/__tests__/PractitionerTodaySection.test.tsx` | Component coverage |

### EDITED (~4 files)
| File | Change summary |
|---|---|
| `src/app/admin/dashboard/TherapistDashboard.tsx` | Replace inline today + next-appt logic with PractitionerTodaySection; import helpers from shared-helpers.ts; preserve backward-compat re-exports at line 1361 |
| `src/app/admin/dashboard/page.tsx` | Conditional mount of PractitionerTodaySection in Business + Coord variants (after existing content) |
| `src/app/admin/dashboard/dashboard-data.ts` | (if needed) Extend fetch to compute today + nextAppointment + claimableCount for can_take_bookings viewers across all variants |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Import isViewerAssignedPractitioner; derive viewerIsPractitioner; wrap parent grid children with conditional order classes |

### UNCHANGED (do NOT touch)
- `BookingDetailSidebar.tsx` — no interface change. Reorder lives in the parent grid via wrapping `<div>`s.
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- `bookings/actions.ts` — Mark complete button uses existing `quickUpdateBooking` / `updateOwnAssignmentStatus` server actions. No server changes.
- Email templates / notifications — no impact.

---

## 3 — Verification gate (commands + pass criteria)

### 3.1 Static gates

```bash
pnpm lint                       # 0 errors
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline failures preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget for C-FIELDWORK:**
- New `PractitionerTodaySection` (~3 kB client) + `RelativeTimeDisplay` (~0.5 kB client) + shared-helpers (~1 kB shared between server + client).
- TherapistDashboard refactor is bytes-neutral (re-import vs inline).
- Booking detail dual-view: 0 net bytes (conditional CSS class strings).
- **Plan ceiling: +5 kB cumulative across `/admin/dashboard/*` bundle. 0 net change on `/admin/bookings/[id]` bundle.**

### 3.2 Playwright role sweep (4 roles × 4 viewports, with capability variations)

**Pre-sweep DB prep (Zone-2 — confirm with user):** ensure at least one Owner / Admin / Coord test account has `can_take_bookings=true` + at least one active assignment.

```sql
-- Check current state
SELECT email, role_name, can_take_bookings FROM staff_profiles ORDER BY email;

-- If no non-Therapist has the capability, flip one:
-- UPDATE staff_profiles SET can_take_bookings = true WHERE email = 'rahmatherapy@outlook.com';
-- (Restore post-test if needed.)
```

Per role:

1. Sign in.
2. Navigate to `/admin/dashboard`.
3. Verify variant rendering matches expectation per RBAC + capability.
4. If `can_take_bookings=true` AND has appointments: verify `PractitionerTodaySection` renders with hero + today list + claimable strip per data.
5. If `can_take_bookings=false` OR no data: verify section NOT rendered (no empty card cluttering Business variant).
6. Navigate to an assigned booking detail.
7. At 375 px, verify mobile reorder (sidebar above main panels) per predicate.
8. At 1280 px, verify 2-column layout unchanged.
9. Sign out.

**Specific scenarios:**

a. **Owner with `can_take_bookings=true` + an assignment** — Business dashboard + section visible + hero card. Booking detail (their assigned booking) at 375 → sidebar above panels. Booking detail (a non-assigned booking) at 375 → main panels above sidebar (admin-curator view).

b. **Therapist (default `can_take_bookings=true`)** — TherapistDashboard renders identically to pre-C-FIELDWORK. Mark complete button on hero, disabled before start_time. Booking detail at 375 → sidebar above (practitioner view).

c. **Coord with `can_take_bookings=false` (default)** — Coord dashboard, section NOT rendered. Booking detail at 375 → admin-curator view (main panels above).

d. **Therapist-Fresh** — TherapistDashboard with empty-state copy ("Quiet day. Take care of yourself.").

### 3.3 Pre/post DB capture

```sql
-- Capture which accounts have can_take_bookings=true at sweep start
SELECT email, can_take_bookings FROM staff_profiles WHERE can_take_bookings = true;

-- After sweep: confirm no accidental flips (the sweep doesn't modify the column)
-- Should match pre-sweep.
```

### 3.4 Screenshot evidence

- 375 + 1280: booking detail in practitioner view (sidebar above)
- 375 + 1280: booking detail in admin-curator view (main panels above)
- 375: PractitionerTodaySection hero card with Next visit + tel + maps + Mark complete
- 375: empty-state card ("Quiet day...")
- 1280: Business dashboard with PractitionerTodaySection mounted for Owner with can_take_bookings=true
- 1280: Coord dashboard with section NOT rendered (can_take_bookings=false)

Store in `redesign/audits/C-A/screenshots-01-dashboard/c-fieldwork-after/`.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Hydration mismatch on "in 1h 12m" relative time | medium | low | `RelativeTimeDisplay` renders empty on SSR + computes on mount (Step 8). |
| Parent grid wrap breaks the existing `md:sticky md:top-4` sidebar | low | medium | Wrap with `<div>` (Step 5) — sticky still applies inside the wrapper. Verify at 1280 + 1440 that sidebar is sticky. |
| Re-exporting `getGreeting` etc. from TherapistDashboard.tsx breaks an external caller | low | low | The re-export at line 1361 is preserved. Verify by grep: any other file importing these symbols from TherapistDashboard.tsx still works. |
| Business variant data fetch adds latency for non-practitioner Owners | low | low | Gate the new query behind `if (profile.can_take_bookings)` so non-practitioners pay no cost. |
| Therapist refactor accidentally drops a feature (Profile nudge, Quick help, etc.) | low | medium | Pre/post comparison via Playwright + the existing TherapistDashboard tests. Refactor is bytes-neutral; structure preserved. |
| Mark complete button bypasses C-04a's auto-promote | very low | low | Button uses the existing `updateOwnAssignmentStatus` server action — C-04a's auto-promote hook runs there. Cross-plan synergy confirmed. |
| Capability flip on a test account leaks into production | low | medium | Plan §6 + §3 pre-sweep prompt explicit Zone-2 confirmation. Restore post-test. |
| `BookingActionButton` doesn't render disabled state cleanly | low | low | Step 9 wraps the disabled case in a plain `<button disabled>` (don't modify BookingActionButton's interface). |
| Empty PractitionerTodaySection mounts in Business variant for Owner with capability but no appointments | low | low | Conditional render (§4.3 in brief) — section omits entirely when no data. Verify Playwright. |
| C-11 will refactor dashboard variants — C-FIELDWORK mounts may shift | medium | low | C-11 plan §3 documents that C-FIELDWORK's PractitionerTodaySection is the lift target. C-11 inherits the mount; no conflict. |

### 4.1 Real risk: predicate behaviour on inactive staff

If a Therapist whose `active=false` is loaded as the viewer (shouldn't happen — middleware blocks), the predicate would still evaluate based on `can_take_bookings`. **Belt-and-braces:** the predicate's first check is `can_take_bookings` not `active`. If `active=false` but `can_take_bookings=true`, the predicate returns true. Acceptable — `active=false` viewers shouldn't reach the booking detail page in the first place (middleware blocks at `/admin`). If they somehow do, the practitioner-view layout is benign.

---

## 5 — Undo procedure

### 5.1 Undo code (4 phases)

Revert in reverse:
1. `git revert <phase-D-mount>` — Business + Coord variants stop rendering the section. TherapistDashboard reverts to inline today + next-appt rendering.
2. `git revert <phase-C-component>` — Removes PractitionerTodaySection + RelativeTimeDisplay files.
3. `git revert <phase-B-booking-detail>` — Removes the parent-grid order classes; booking detail mobile order returns to current (main panels above sidebar regardless).
4. `git revert <phase-A-helpers>` — Removes shared-helpers.ts; TherapistDashboard re-inlines its helpers.

If only Phase B (booking detail reorder) needs to be undone, revert just that commit. Phases are independent.

### 5.2 Undo DB state

C-FIELDWORK doesn't modify schema. If `can_take_bookings` was flipped on a test account for E2E, restore:

```sql
UPDATE staff_profiles SET can_take_bookings = false WHERE email = '<test-account>';
```

---

## 6 — Test fixture guidance

**Safe for C-FIELDWORK E2E:**
- Test bookings assigned to test Therapist accounts (`test.therapist@rahmatherapy.example.test`).
- Test bookings assigned to a flipped-capability Owner/Admin test account.
- Test clients with phone + address populated.

**DO NOT touch:**
- Badar's `9d55ce2a` (cancelled, real email).
- Any real customer booking.

**Capability flip (Zone-2 — explicit user confirmation):**

```sql
-- Pre-test: capture current state
SELECT email, can_take_bookings FROM staff_profiles
WHERE email IN ('rahmatherapy@outlook.com', 'test.admin@rahmatherapy.example.test', 'test.coordinator@rahmatherapy.example.test');

-- Flip one (Owner) for dual-view E2E
UPDATE staff_profiles SET can_take_bookings = true WHERE email = 'rahmatherapy@outlook.com';

-- Post-test: restore (or leave on if user prefers dogfooding)
UPDATE staff_profiles SET can_take_bookings = false WHERE email = 'rahmatherapy@outlook.com';
```

Plan locks: ask user before flipping; capture before-state; document the flip in the progress file.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — shared-helpers.ts + predicate + TherapistDashboard re-import + tests |
| 2 | Phase B — Booking detail dual-view (parent grid order classes) |
| 3 | Phase C — PractitionerTodaySection + RelativeTimeDisplay components + tests |
| 4 | Phase D — Mount in TherapistDashboard refactor + Business + Coord variants + data-fetch extension |
| 5 | Verification — Playwright screenshots + progress file + master plan checklist → ✅ |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-FIELDWORK {phase}` prefix during C-C.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. Run §0 Pre-flight in full.
3. Execute Phase A → B → C → D in order.
4. No migration needed.
5. Verification gate (§3) non-negotiable.
6. Update `redesign/per-page-progress/C-FIELDWORK-EXPERIENCE-progress.md` per phase.
7. Final commit updates master plan checklist C-FIELDWORK row from `⏳` to `✅` with shipped date + commit SHA.
8. **C-11 inherits the lift surface** — when C-11 ships the dashboard-variant extraction, it imports + mounts `PractitionerTodaySection` from this plan's output. No coordination needed beyond filename.

---

## 9 — Open questions remaining

1. **Predicate inclusion of `completed` / `no_show` assignment statuses.** Brief Q9.2 said exclude completed; **plan §1 Step 1 design note overrides** with inclusion. Rationale: retrospective viewing of own work needs phone+address access. User can flip during C-C impl if preferred.

2. **`dashboard-data.ts` fetch extension** — Step 12 conditional. If existing helpers already surface today + next-appt for non-Therapist viewers, no extension needed. Verify during impl.

3. **Mark complete button styling** — Step 9 wraps disabled state. If `BookingActionButton` is later extended to accept `disabled` cleanly, refactor the wrapper away. C-12+ polish.

4. **Capability flip on Owner test account** — §6 + §3 pre-sweep. User should confirm whether to leave the Owner flipped post-test for ongoing dogfooding OR restore.

5. **PractitionerTodaySection in Coordinator variant — UX appropriateness.** Coord rarely takes bookings; the section appears small/empty for most Coords. Section is conditional (omits when no data) — no clutter. But the visual placement (above what?) needs C-C judgment. Plan locks: mount above "Recent activity" / similar admin sections.

6. **`profile.gender` requirement for hero "Mark complete"** — gender is required for `canClaimAssignments`, but `updateOwnAssignmentStatus` (used by Mark complete) doesn't check gender. Mark complete works for any assigned practitioner. Plan documents.

---

*End of C-FIELDWORK plan. Brief: `redesign/briefs/C-FIELDWORK-EXPERIENCE-brief.md`. Progress: `redesign/per-page-progress/C-FIELDWORK-EXPERIENCE-progress.md` (filled during C-C).*
