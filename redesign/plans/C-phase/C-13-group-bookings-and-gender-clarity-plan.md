# C-13 — Group-booking surface + gender-clarity chips + composite identity + per-participant progress — **PLAN**

**Type:** Band C plan-writing output (post-C-B amendment, 2026-05-26)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-13-group-bookings-and-gender-clarity-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-13-group-bookings-and-gender-clarity-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

This plan covers the "how" — execution order, verify-checkpoints, files touched, verification gate, risks + undo. Read the brief first.

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** `git status --short` empty. HEAD on `master` (post-C-B amendment commits).
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 baseline failures preserved). Verify the C-04a + C-05 amendments' new specs are passing if those have shipped already.
4. **Static gates green.** `pnpm lint`, `npx tsc --noEmit` both 0 errors.
5. **Recommended C-C dependencies.** Verify which of these have shipped:
   - `git log --oneline | grep -iE "(C-04a|C-05|C-FIELDWORK|C-08|C-11)"`
   - If C-04a + C-05 are in HEAD → `_helpers.ts` exists; C-13 extends.
   - If C-FIELDWORK is in HEAD → `PractitionerTodaySection` exists; verify its card shape so C-13's `BookingCard` is a clean superset.
   - If C-08 is in HEAD → `staff_claim` + `booking_confirmed_client` template renderers exist; C-13's Phase G is additive.
   - If C-11 is in HEAD → `dashboard/blocks/` shared library exists; verify whether it already imports a `BookingCard` — should not (per C-11 plan §1 Step 1 the shared blocks library list does not include BookingCard, leaving room for C-13).
6. **Codebase verification queries:**
   ```bash
   # Confirm the booking row JSX still lives at bookings/page.tsx around lines 800-930
   git grep -n "BookingRowActions" src/app/admin/bookings/page.tsx
   # Confirm dashboard-cards.tsx AssignmentChip is still the chip site
   git grep -n "AssignmentChip" src/app/admin/dashboard/dashboard-cards.tsx
   # Confirm calendar tile rendering — locate the JSX for an event tile
   git grep -n "booking\.id\|event\.\|tile" src/app/admin/calendar/
   # Confirm email template renderers exist
   git grep -n "renderStaffAssignmentEmail\|renderBookingConfirmationEmail" src/lib/email/
   ```
7. **DB introspection** via `mcp__supabase__execute_sql`:
   ```sql
   -- (a) Verify booking_participants schema is as expected
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'booking_participants' AND column_name IN
     ('participant_gender', 'required_therapist_gender', 'is_main_contact', 'display_name');
   -- expect 4 rows

   -- (b) Find a test group booking to use for E2E
   SELECT b.id, b.contact_full_name, COUNT(p.id) AS participant_count
   FROM bookings b
   LEFT JOIN booking_participants p ON p.booking_id = b.id
   WHERE b.contact_full_name ILIKE '%Phase10%' OR b.contact_full_name ILIKE '%Audit Test%'
   GROUP BY b.id, b.contact_full_name
   HAVING COUNT(p.id) > 1
   ORDER BY b.booking_date DESC LIMIT 5;
   -- expect at least one row — if none, create via ManualBookingForm during pre-flight

   -- (c) Find a mixed-gender group booking (for §5.2 verification)
   SELECT b.id, COUNT(*) FILTER (WHERE p.participant_gender = 'female') AS female,
          COUNT(*) FILTER (WHERE p.participant_gender = 'male') AS male
   FROM bookings b JOIN booking_participants p ON p.booking_id = b.id
   GROUP BY b.id
   HAVING COUNT(*) FILTER (WHERE p.participant_gender = 'female') > 0
      AND COUNT(*) FILTER (WHERE p.participant_gender = 'male') > 0
   LIMIT 5;
   -- expect ≥ 1 row OR create via ManualBookingForm
   ```

8. **Test fixture inventory.** Confirm:
   - At least one **single** booking (participant count = 1) for the single-row regression check.
   - At least one **group same-gender** booking (e.g., 3 female participants) for §5.1 + Phase B verification.
   - At least one **mixed-gender** group for §5.2.
   - At least one **fully-assigned** group for §5.4 + Q9.1 verification.
   - At least one **unassigned** group for the gender chip + fraction badge verification.

   If any fixture missing, create via Owner Playwright sweep of `/admin/bookings/new` (Zone-2 — explicit user confirmation for DB writes during pre-flight if needed).

9. **Test data DO-NOT-TOUCH list:** Badar's `9d55ce2a` (cancelled, real email). Any client whose email isn't `*.example.test` / `Phase10*` / `Audit Test*` / unicode-RTL stress.

10. **Bundle baseline capture** — run `node scripts/measure-admin-bundles.mjs` and save to progress file. C-13 budget +5 kB across `/admin/bookings/*` (BookingCard extraction adds bytes; helper additions trivial; calendar tile changes minimal).

If any pre-flight step fails or reveals unexpected state, **stop** and surface to the user.

---

## 1 — Safe implementation order (8 phases, 7 changes, with verify-checkpoints)

Each phase is committable independently. Verify-checkpoints between phases.

### Phase A — Gender-clarity chip helper (Change 1)

**Step 1 — Implement `composeGenderRequirementChip` in `_helpers.ts`.**

Edit `src/app/admin/bookings/_helpers.ts` (file created by C-04a/C-05 amendments — extend it). Add at module scope:

```ts
export type GenderRequirementChip = {
  label: string;
  visible: boolean;
};

export function composeGenderRequirementChip(
  participants: Array<{ required_therapist_gender: string | null }>,
  assignmentStatus: "unassigned" | "partially_assigned" | "fully_assigned"
): GenderRequirementChip {
  if (assignmentStatus === "fully_assigned") return { label: "", visible: false };

  const female = participants.filter(p => p.required_therapist_gender === "female").length;
  const male = participants.filter(p => p.required_therapist_gender === "male").length;

  if (female === 0 && male === 0) return { label: "", visible: false };

  if (participants.length === 1) {
    return {
      label: female === 1 ? "Needs female therapist" : "Needs male therapist",
      visible: true,
    };
  }

  if (female > 0 && male === 0) {
    return {
      label: `Needs ${female} female therapist${female > 1 ? "s" : ""}`,
      visible: true,
    };
  }
  if (male > 0 && female === 0) {
    return {
      label: `Needs ${male} male therapist${male > 1 ? "s" : ""}`,
      visible: true,
    };
  }

  return {
    label: `Needs ${female} female + ${male} male`,
    visible: true,
  };
}
```

**Step 1b — Vitest spec** — new file `src/app/admin/bookings/__tests__/composeGenderRequirementChip.test.ts`:

- Empty participants → `{ visible: false }`
- All participants with `required_therapist_gender = null` → `{ visible: false }`
- Single female-required → `"Needs female therapist"`
- Single male-required → `"Needs male therapist"`
- 2 female-required → `"Needs 2 female therapists"`
- 3 female-required → `"Needs 3 female therapists"`
- 1 female + 1 male → `"Needs 1 female + 1 male"`
- 2 female + 1 male → `"Needs 2 female + 1 male"`
- assignmentStatus = "fully_assigned" → `{ visible: false }` regardless of participants

Verify: `npx tsc --noEmit` green. `pnpm vitest run composeGenderRequirementChip` passes 9 cases.

**Step 2 — Wire into `bookings/page.tsx`.**

Replace lines 837-843:

```tsx
// Before:
const requiresGenderMatch = booking.booking_participants.some(...)
// ...
{requiresGenderMatch ? (
  <span title="Client asked for a same-gender therapist" ...>
    Same-gender required
  </span>
) : null}

// After:
const genderChip = composeGenderRequirementChip(
  booking.booking_participants,
  booking.assignment_status
);
// ...
{genderChip.visible ? (
  <span
    title={genderChip.label}
    className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-restricted-bg)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--admin-restricted)]"
  >
    {genderChip.label}
  </span>
) : null}
```

Remove the now-unused `requiresGenderMatch` variable.

**Step 3 — Wire into `[bookingId]/page.tsx`.**

The detail page has two chip sites:
- Page-header gender chip at `:660-674` (the `sameGenderRequired` ternary inside `ParticipantCard`).
- Possibly another at the top-level header if present (grep `Same-gender required` to find all).

For `ParticipantCard` at `:629-674`, since the function deals with one participant at a time, use the helper with a single-element array:

```tsx
const genderChip = composeGenderRequirementChip(
  [{ required_therapist_gender: participant.required_therapist_gender }],
  // pass any status — participant-level chip doesn't hide on fully-assigned
  "unassigned"
);
{genderChip.visible ? (
  <AdminStatusBadge tone="restricted" value={genderChip.label} compact />
) : null}
```

Drop the muted `"Therapist: female"` fallback (the new chip is clearer).

**Step 4 — Wire into `dashboard-cards.tsx`.**

Replace `:583-590`:

```ts
const sameGenderRequired = isUnassigned && Boolean(appointment.requiredGender);
const assignmentLabel = sameGenderRequired
  ? "Unassigned · same-gender required"
  : "Unassigned";
```

With:

```ts
const requiredGender = isUnassigned ? appointment.requiredGender : null;
const assignmentLabel = requiredGender
  ? `Unassigned · Needs ${requiredGender} therapist`
  : "Unassigned";
```

For mixed-group case (where `appointment.requiredGender` is null/mixed-marker), apply the §5.11 collapse:

```ts
// If dashboard data layer collapses mixed-gender groups to a marker like 'mixed'
// (TBD during impl — verify the data-layer shape):
const requiredGender = appointment.requiredGender;
const assignmentLabel = !requiredGender
  ? "Unassigned"
  : requiredGender === "mixed"
    ? "Unassigned · Mixed group"
    : `Unassigned · Needs ${requiredGender} therapist`;
```

If the data layer doesn't expose mixed marker, drop the mixed branch and document follow-up in §5.11.

**Phase A verify checkpoint:**
- `npx tsc --noEmit` green
- `pnpm vitest run bookings` — new tests pass; existing tests still pass
- Playwright manual: navigate to `/admin/bookings` and verify single-gender bookings show specific gender chip; group bookings show count + gender.

### Phase B — Group cards as first-class — nested layout (Change 2)

**Step 5 — Extract `BookingCard` component.**

Create new file `src/app/admin/bookings/BookingCard.tsx`:

```tsx
"use client";
// ... or server component if no client interactivity in card; verify during impl

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminStatusBadge } from "@/app/admin/components/admin-status-badge";
import { BookingRowActions } from "./BookingRowActions";
import {
  composeGenderRequirementChip,
  composeBookingIdentity,
  inertRowClassNames,
} from "./_helpers";
import type { BookingRecord, StaffProfile, BookingAssignment } from "./types";

export type BookingCardProps = {
  booking: BookingRecord;
  profile: StaffProfile;
  role: "full" | "therapist";
  canViewAll: boolean;
  ownBooking: boolean;
  claimableAssignment: BookingAssignment | null;
  showSensitiveDetails: boolean;
  animationDelay?: number;
  today: string;
};

export function BookingCard(props: BookingCardProps) {
  const { booking, today } = props;
  const isGroup = booking.booking_participants.length > 1;
  const identity = composeBookingIdentity(booking);
  const genderChip = composeGenderRequirementChip(
    booking.booking_participants,
    booking.assignment_status
  );
  const { isInert, rowClass, titleClass } = inertRowClassNames(booking, today);

  if (isGroup) {
    return <GroupBookingCard {...props} identity={identity} genderChip={genderChip} rowClass={rowClass} titleClass={titleClass} isInert={isInert} />;
  }
  return <SingleBookingCard {...props} identity={identity} genderChip={genderChip} rowClass={rowClass} titleClass={titleClass} isInert={isInert} />;
}

function SingleBookingCard({ booking, identity, genderChip, rowClass, titleClass, ... }) {
  // Existing JSX shape from bookings/page.tsx:804-927 lifted verbatim
  // with genderChip swap-in and identity.primary as headline
}

function GroupBookingCard({ booking, identity, genderChip, rowClass, titleClass, ... }) {
  // New nested layout — see Step 6
}
```

**Step 6 — Implement `GroupBookingCard` JSX.**

```tsx
function GroupBookingCard({ booking, identity, genderChip, rowClass, titleClass, profile, role, ... }: GroupBookingCardInternalProps) {
  const assignedCount = booking.booking_assignments.filter(
    a => a.assigned_staff_id && a.status !== "unassigned"
  ).length;
  const totalAssignments = booking.booking_assignments.length;
  const progressLabel = `${assignedCount} of ${totalAssignments} therapists assigned`;
  const progressTone = assignedCount === 0 ? "warning"
    : assignedCount < totalAssignments ? "warning"
    : "success";

  return (
    <article
      className={cn(
        "rahma-row-enter grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-5 transition-shadow duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:shadow-[var(--admin-shadow-subtle)] sm:p-6",
        rowClass  // C-05 isInertRow class
      )}
      data-group-booking="true"
    >
      {/* Headline row with Users icon + composite identity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <div className={cn("flex items-center gap-2", titleClass)}>
              <Users
                className="size-4 shrink-0 text-[var(--admin-text-muted)]"
                aria-hidden="true"
              />
              <p className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)] break-words sm:text-lg">
                {identity.primary}
              </p>
            </div>
            <p className={cn("mt-1 text-sm text-[var(--admin-text-muted)] break-words", titleClass)}>
              {formatDate(booking.booking_date)} · {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
              {/* service names */}
            </p>
          </Link>

          {/* Status chip row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge value={formatLabel(booking.status)} tone={statusTone(booking.status)} />
            <AdminStatusBadge value={progressLabel} tone={progressTone} compact />
            {genderChip.visible ? (
              <span
                title={genderChip.label}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-restricted-bg)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--admin-restricted)]"
              >
                {genderChip.label}
              </span>
            ) : null}
            {/* customer-cancelled chip + reschedule chip preserved from single layout */}
          </div>
        </div>
      </div>

      {/* Nested per-participant sub-rows */}
      <ul className="grid gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3">
        {booking.booking_participants.map((participant, idx) => (
          <ParticipantSubRow
            key={participant.id}
            participant={participant}
            assignment={booking.booking_assignments.find(a => a.participant_id === participant.id) ?? null}
            index={idx}
            isInert={isInert}
          />
        ))}
      </ul>

      {/* Footer — address + actions (lifted from single layout) */}
      <div className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* address row + BookingRowActions */}
      </div>
    </article>
  );
}

function ParticipantSubRow({ participant, assignment, index, isInert }: {
  participant: BookingParticipant;
  assignment: BookingAssignment | null;
  index: number;
  isInert: boolean;
}) {
  const name = participant.display_name || `Person ${index + 1}`;
  const genderIcon = participant.participant_gender === "female" ? "♀" : "♂";
  const genderLabel = participant.participant_gender === "female" ? "female participant" : "male participant";
  const assignedTherapistName = assignment?.assigned_staff_id
    ? assignment.staff_profiles?.name ?? "Assigned"
    : null;
  const stateLabel = assignedTherapistName
    ? assignedTherapistName
    : assignment?.required_therapist_gender
      ? `Open — needs ${assignment.required_therapist_gender} therapist`
      : "Open";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[var(--admin-body)] break-words">{name}</span>
        {participant.is_main_contact ? (
          <span className="text-xs font-medium text-[var(--admin-text-muted)]">(main)</span>
        ) : null}
        <span aria-label={genderLabel} className="text-[var(--admin-text-muted)]">
          {genderIcon}
        </span>
      </div>
      <span className={cn(
        "shrink-0 text-xs",
        assignedTherapistName
          ? "text-[var(--admin-body)]"
          : "text-[var(--admin-warning)]"
      )}>
        {stateLabel}
      </span>
    </li>
  );
}
```

**Step 7 — Replace inline `<article>` block in `bookings/page.tsx`.**

In `bookings/page.tsx`, find the `<article>` block at lines 804-927 (where `BookingRow` or similar wraps the JSX). Replace with:

```tsx
<BookingCard
  booking={booking}
  profile={profile}
  role={role}
  canViewAll={canViewAll}
  ownBooking={ownBooking}
  claimableAssignment={claimableAssignment}
  showSensitiveDetails={showSensitiveDetails}
  animationDelay={animationDelay}
  today={today}
/>
```

Remove inline `clientName`, `serviceNames`, `assignedTherapists`, `distinctTherapists`, `requiresGenderMatch`, `participantCount`, `isGroup`, `addressParts`, `mapUrl`, `claimableAssignment` derivations — all live inside `BookingCard` now.

**Phase B verify checkpoint:**
- Lint + tsc green.
- Playwright manual at 375 / 768 / 1280 / 1440: single bookings render unchanged; group bookings render nested layout with sub-rows + Users icon + group tint.
- Snapshot test for `BookingCard` (single + group variants) — add to `__tests__/BookingCard.test.tsx` if vitest can render the component (server-component edge case — fall back to render via Playwright if vitest can't).

### Phase C — Composite identity helper (Change 3)

**Step 8 — Implement `composeBookingIdentity` in `_helpers.ts`.**

```ts
export function composeBookingIdentity(booking: {
  contact_full_name: string | null;
  clients?: { full_name: string | null } | null;
  booking_participants: Array<{
    display_name: string | null;
    is_main_contact: boolean | null;
  }>;
}): { primary: string; participantCount: number } {
  const mainContactName =
    booking.booking_participants.find(p => p.is_main_contact)?.display_name ||
    booking.contact_full_name ||
    booking.clients?.full_name ||
    "Unknown client";

  const otherCount = booking.booking_participants.filter(p => !p.is_main_contact).length;

  if (otherCount === 0) {
    return { primary: mainContactName, participantCount: booking.booking_participants.length };
  }
  if (otherCount === 1) {
    return { primary: `${mainContactName} + 1 other`, participantCount: 2 };
  }
  return {
    primary: `${mainContactName} + ${otherCount} others`,
    participantCount: 1 + otherCount,
  };
}
```

**Step 8b — Vitest spec** — new file `src/app/admin/bookings/__tests__/composeBookingIdentity.test.ts`:

- Single participant with display_name → primary = display_name
- Single participant without display_name → primary = contact_full_name
- 2 participants (main + 1 other) → primary = "Aisha Khan + 1 other"
- 3 participants → primary = "Aisha Khan + 2 others"
- No `is_main_contact = true` participant → fallback to `contact_full_name`
- Empty `booking_participants` → primary = "Unknown client" or `contact_full_name` if present

**Step 9 — Wire composite identity into:**

- `BookingCard` headline (already done in Phase B Step 6).
- `[bookingId]/page.tsx` page header — locate the title block, replace direct `contact_full_name` reference with `composeBookingIdentity(booking).primary`. Remove the standalone `"Group booking"` badge at `:455-456` (composite identity + fraction badge now signal group-ness).
- `dashboard-cards.tsx` — `appointment.title` is set upstream; verify data layer. If `appointment.title` is set from `contact_full_name`, patch the data layer (or render composite identity at the card level using the count). Verify scope during impl.
- Calendar event tile tooltip (Phase E).
- Booking detail `<title>` HTML tag (Q9.10) — `Booking — {identity.primary}`.

**Phase C verify checkpoint:**
- Group booking list row, detail page, browser tab title, all show `"Aisha Khan + 2 others"`.
- Single booking unchanged.

### Phase D — Per-participant assignment progress (Change 4)

Already integrated into Phase B Step 6 (`progressLabel` derivation in `GroupBookingCard`). No standalone phase — verified in Phase B.

**Phase D verify checkpoint:**
- Group with 1 of 2 assigned: badge reads `"1 of 2 therapists assigned"` with warning tone.
- Group with 3 of 3 assigned: badge reads `"3 of 3 therapists assigned"` with success tone (per Q9.1 locked).
- Single booking: badge unchanged (`Unassigned` / `Partially assigned` / hidden when fully).

### Phase E — Calendar surface (Change 5)

**Step 10 — Locate calendar tile rendering.**

Grep `src/app/admin/calendar/` for the JSX that renders a booking on the grid. Likely candidates:
- Inline in `calendar/page.tsx`
- Colocated component (e.g., `CalendarEventCard.tsx`, `WeekGrid.tsx`, etc.)

```bash
git grep -nE "booking\.contact_full_name|booking\.start_time" src/app/admin/calendar/
```

**Step 11 — Add group indicator to calendar tile.**

Once located, extend the tile:

```tsx
const isGroup = booking.booking_participants.length > 1;
const identity = composeBookingIdentity(booking);
// ... existing tile rendering
{isGroup ? (
  <span
    title={`${identity.primary} — ${booking.booking_participants.length} participants`}
    className="inline-flex items-center gap-0.5 rounded-full bg-[var(--admin-restricted-bg)] px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--admin-restricted)]"
  >
    <Users className="size-3" aria-hidden="true" />
    <span>{booking.booking_participants.length}</span>
  </span>
) : null}
```

Composite identity in `title` attribute for hover tooltip. Status-based tile background preserved (no group tint per Q9.4).

**Step 12 — Verify booking_participants is fetched by calendar data layer.**

If `calendar/page.tsx`'s booking SELECT doesn't include `booking_participants(*)`, extend the query. Otherwise the count is unavailable.

**Phase E verify checkpoint:**
- Calendar in week + day + range views shows Users icon + count chip on group bookings.
- Single bookings on calendar unchanged.
- Hover tooltip surfaces composite identity.
- Tile width at tight days (week view, packed Friday): icon-only fallback verified.

### Phase F — Booking detail surface refinement (Change 6)

**Step 13 — Detail page header.**

Apply `composeBookingIdentity` to the page title block in `[bookingId]/page.tsx`. Also patch `<title>` via `generateMetadata` if used:

```tsx
export async function generateMetadata({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await fetchBookingForMetadata(bookingId);
  if (!booking) return { title: "Booking — Admin" };
  const identity = composeBookingIdentity(booking);
  return { title: `${identity.primary} — Booking` };
}
```

**Step 14 — Remove redundant "Group booking" badge.**

At `[bookingId]/page.tsx:455-456`, remove the standalone `"Group booking"` AdminStatusBadge. The composite identity + fraction badge surface the same information more clearly.

**Step 15 — Refactor `ParticipantCard` chip.**

In `[bookingId]/page.tsx:629-674`, replace the `sameGenderRequired` ternary + fallback `"Therapist: female"` chip with the new helper:

```tsx
const participantChip = composeGenderRequirementChip(
  [{ required_therapist_gender: participant.required_therapist_gender }],
  "unassigned"  // participant-level chip always shows (booking-level fully_assigned doesn't hide individual requirements)
);
{participantChip.visible ? (
  <AdminStatusBadge tone="restricted" value={participantChip.label} compact />
) : null}
```

**Phase F verify checkpoint:**
- Detail page header shows composite identity for group bookings.
- Standalone "Group booking" badge gone.
- Per-participant chips read "Needs female therapist" / "Needs male therapist".

### Phase G — Email templates (Change 7)

**Step 16 — Implement `renderGroupContextBlock` in `templates.ts`.**

In `src/lib/email/templates.ts`, add a new function:

```ts
type GroupContextBlockInput = {
  participants: Array<{
    display_name: string | null;
    is_main_contact: boolean | null;
    participant_gender: string;
  }>;
  assignments: Array<{
    participant_id: string | null;
    assigned_staff_id: string | null;
    assigned_staff_name: string | null;  // joined upstream
  }>;
  participantCount: number;
  assignedCount: number;
};

export function renderGroupContextBlockHtml(input: GroupContextBlockInput): string {
  if (input.participantCount <= 1) return "";

  const rows = input.participants.map((p, idx) => {
    const name = p.display_name || `Person ${idx + 1}`;
    const mainTag = p.is_main_contact ? " (main contact)" : "";
    const genderLabel = p.participant_gender;
    const assignment = input.assignments.find(a => a.participant_id === (p as { id?: string }).id);
    const stateLabel = assignment?.assigned_staff_name
      ? `assigned to ${assignment.assigned_staff_name}`
      : "open";
    return `<li>${name}${mainTag} (${genderLabel}) — ${stateLabel}</li>`;
  }).join("");

  return `
    <div style="border-left: 3px solid #999; padding-left: 12px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600;">
        This booking is part of a ${input.participantCount}-person group:
      </p>
      <ul style="margin: 0; padding-left: 20px;">${rows}</ul>
      <p style="margin: 8px 0 0 0; color: #666;">
        ${input.assignedCount} of ${input.participantCount} therapists assigned so far.
      </p>
    </div>
  `;
}

export function renderGroupContextBlockText(input: GroupContextBlockInput): string {
  if (input.participantCount <= 1) return "";
  // Plain-text version of the above
  // ...
}
```

**Step 17 — Wire into existing template renderers.**

Find the relevant renderer functions in `templates.ts`:
- `renderStaffAssignmentEmail` (or whatever the staff-assignment email renderer is named)
- `renderBookingClaimEmail` (introduced by C-08)
- `renderBookingConfirmationEmail`

For each, accept the new payload and insert the group context block:

```ts
export function renderStaffAssignmentEmail(input: StaffAssignmentInput) {
  // ... existing body
  const groupBlock = renderGroupContextBlockHtml({
    participants: input.participants,
    assignments: input.assignments,
    participantCount: input.participants.length,
    assignedCount: input.assignedCount,
  });
  // insert groupBlock into the HTML body at an appropriate location
}
```

**Step 18 — Thread payload from `notifications.ts` to template renderers.**

In `src/lib/email/notifications.ts`, `sendStaffAssignmentEmail` and downstream send functions need to fetch `booking_participants` + `booking_assignments` (with joined `staff_profiles.name`) and pass into the template renderer. The existing `getBookingTemplateInput` helper may already include this; if not, extend.

```ts
export async function sendStaffAssignmentEmail(bookingId: string, ...) {
  const { booking, settings, input } = await getBookingTemplateInput(bookingId, supabase);
  // input gains participants + assignments via the SELECT extension
  await sendTrackedEmail(supabase, {
    // ...
    html: renderStaffAssignmentEmail({ ...input, participants: booking.booking_participants, ... }),
  });
}
```

**Step 19 — Vitest spec for the renderer.**

New file `src/lib/email/__tests__/renderGroupContextBlock.test.ts`:
- `participantCount = 1` → returns empty string
- `participantCount = 2`, 1 assigned → HTML contains "2-person group", "1 of 2 therapists"
- `participantCount = 3`, 0 assigned → all rows show "open"
- Plain-text variant matches HTML semantically

**Phase G verify checkpoint:**
- Trigger a staff assignment for a group-booking participant (via Owner UI). Verify email in `email_delivery_events`:
  ```sql
  SELECT html_payload FROM email_delivery_events
  WHERE booking_id = '<group-test-booking>' AND event_type = 'staff_assignment'
  ORDER BY created_at DESC LIMIT 1;
  ```
- Confirm HTML contains the group context block with correct names + counts.

### Phase H — Integration polish + dashboard data layer (Change 8 + §5.11)

**Step 20 — Verify dashboard data layer for mixed-group case.**

In `src/app/admin/dashboard/dashboard-data.ts` (or wherever `SnapshotAppointment` is constructed):
- Grep for `requiredGender` derivation.
- If it's derived from `booking_participants[0].required_therapist_gender` (first-participant only), document this as a known limitation and apply §5.11 (b) collapse: when mixed-group is detected, set `requiredGender = "mixed"` and render `"Unassigned · Mixed group"`.
- If the data layer doesn't have access to participant counts, defer to C-12+ and leave dashboard chip generic ("Unassigned").

**Step 21 — Final cleanup + audit.**

- Search for any remaining `"Same-gender required"` literal strings: `git grep -n "Same-gender required" src/` — should return 0 hits.
- Search for any remaining `"same-gender required"`: same expectation.
- Verify no `border-l-4` introduced anywhere (DESIGN.md ban).
- Verify `prefers-reduced-motion` respected on any new animations (none expected, but check).
- Bundle delta measurement: `node scripts/measure-admin-bundles.mjs`. Target: +5 kB cumulative across `/admin/bookings/*`. Document in progress file.

**Phase H verify checkpoint:**
- Static gates all green.
- No literal "Same-gender required" strings remain in src/.
- Bundle delta within budget.
- Master plan checklist row for C-13 flipped to ✅.

---

## 2 — Files touched (final list)

### NEW (3-4 files)

| File | Purpose |
|---|---|
| `src/app/admin/bookings/BookingCard.tsx` | Extracted shared component — single + group variants |
| `src/app/admin/bookings/__tests__/composeGenderRequirementChip.test.ts` | Helper vitest (Phase A) |
| `src/app/admin/bookings/__tests__/composeBookingIdentity.test.ts` | Helper vitest (Phase C) |
| `src/lib/email/__tests__/renderGroupContextBlock.test.ts` | Template fragment vitest (Phase G) |
| `src/app/admin/bookings/__tests__/BookingCard.test.tsx` | (Optional, if vitest can render the server component) Snapshot test |

### EDITED (~9 files)

| File | Change summary |
|---|---|
| `src/app/admin/bookings/_helpers.ts` | + `composeGenderRequirementChip` (Phase A) + `composeBookingIdentity` (Phase C). Extends helper created by C-04a/C-05 amendments. |
| `src/app/admin/bookings/page.tsx` | Replace inline `<article>` block (lines 804-927) with `<BookingCard />`. Remove now-unused derivations. |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Detail header → composite identity. Remove `"Group booking"` AdminStatusBadge at `:455-456`. `ParticipantCard` chip → helper-derived. `generateMetadata` (or equivalent) → composite identity in `<title>`. |
| `src/app/admin/dashboard/dashboard-cards.tsx` | `AssignmentChip` label → helper-derived dynamic gender phrasing + mixed-group collapse (§5.11 b). |
| `src/app/admin/dashboard/dashboard-data.ts` | (Phase H Step 20) Verify `requiredGender` derivation; apply mixed-group marker if data layer supports, else document deferral. |
| `src/app/admin/calendar/page.tsx` | Calendar event tile → Users icon + Group chip + composite identity tooltip when `participantCount > 1`. SELECT extended with `booking_participants` count if missing. |
| `src/lib/email/templates.ts` | + `renderGroupContextBlockHtml` + `renderGroupContextBlockText`. Conditional inclusion in `renderStaffAssignmentEmail`, `renderBookingClaimEmail` (C-08), `renderBookingConfirmationEmail`. |
| `src/lib/email/notifications.ts` | `getBookingTemplateInput` (or relevant fetch) SELECT extended with `booking_participants` + `booking_assignments(staff_profiles(name))` if not already included. Threaded into template renderers. |
| `src/app/admin/bookings/types.ts` | (Possibly) extend `BookingCardProps` shared types. Verify during impl. |

### UNCHANGED (do NOT touch)

- DB schema (`booking_participants`, `booking_assignments`, `bookings`)
- `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus` server actions (per-participant semantics already correct)
- RBAC matrix, middleware, build configs
- `reporting.ts`, `dashboard-helpers.ts` core exports (RECON §5)
- `manage/actions.ts` (customer-facing — out of scope)

---

## 3 — Verification gate (commands + pass criteria)

Run after Phase H lands. Every command must pass.

### 3.1 Static gates

```bash
pnpm lint                       # 0 errors
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline failures preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget for C-13:** BookingCard extraction adds ~3 kB (component file). Helper functions add ~0.5 kB. Calendar tile addition ~0.5 kB. Email template fragment is server-only (no bundle impact). **Plan ceiling: +5 kB cumulative across `/admin/bookings/*` + `/admin/calendar/*`.**

### 3.2 Playwright role sweep (4 roles × 4 viewports)

Recipe per role:

1. Sign in via standard pattern.
2. Navigate to `/admin/bookings`. Verify:
   - At least one single booking renders with single-row layout (unchanged shape).
   - At least one group booking renders with nested layout: Users icon, composite identity headline, per-participant sub-rows, fraction badge, gender chip with count.
   - Sub-row content: name + main tag + gender icon + assignment state.
3. Click into a group booking detail page. Verify:
   - Header shows composite identity (`"Aisha Khan + 2 others"`).
   - No standalone "Group booking" badge.
   - Per-participant cards show gender-specific chip (`"Needs female therapist"`).
   - Assignment panel rows show participant names + per-participant claim/assign affordances (existing behaviour).
   - Browser tab title contains composite identity.
4. Navigate to `/admin/dashboard`. Verify:
   - Attention card for an unassigned group / gender-required booking shows gender-specific chip.
   - Mixed-group case (if present) shows `"Mixed group"` collapse.
5. Navigate to `/admin/calendar` (day + week view). Verify:
   - Group bookings show Users icon + count chip on tiles.
   - Hover tooltip surfaces composite identity.
   - Single bookings unchanged.
6. (Owner / Admin / Coord) Trigger a staff assignment on a participant in a group booking. Verify via `mcp__supabase__execute_sql`:
   ```sql
   SELECT html_payload, text_payload FROM email_delivery_events
   WHERE booking_id = '<group-booking-id>'
     AND event_type = 'staff_assignment'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Confirm group-context block present with correct participant names + counts.
7. (Therapist) View a group booking where they're assigned to one participant. Verify they see:
   - The full sub-row list (read-only for non-own assignments).
   - Their own assignment row has actionable affordances.
   - Composite identity in headline.
8. Sign out via `fetch('/admin/signout', ...)`.

### 3.3 Pre/post DB queries

```sql
-- Pre-sweep: capture a group booking's pre-state
SELECT b.id, b.contact_full_name, b.assignment_status,
       (SELECT COUNT(*) FROM booking_participants p WHERE p.booking_id = b.id) AS participant_count,
       (SELECT COUNT(*) FROM booking_assignments a WHERE a.booking_id = b.id AND a.assigned_staff_id IS NOT NULL) AS assigned_count
FROM bookings b WHERE id = '<test-group-id>';

-- Post-sweep: confirm no booking data was mutated by C-13's UI changes
-- Expected: identical to pre-state. C-13 is pure render; no server actions invoked.
```

### 3.4 Screenshot evidence

Capture PNGs (store in `redesign/audits/C-A/screenshots-02-bookings-list/c-13-after/`):

- 375 + 1280 — single booking list row (regression baseline)
- 375 + 1280 — group booking list row (nested layout)
- 375 + 1280 — group booking detail page (composite identity)
- 1280 — calendar week view with at least one group tile
- 1280 — dashboard attention card with gender chip
- Email rendered HTML (capture via Resend test mode or local rendering script) — group context block visible

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| `BookingCard` extraction introduces a subtle regression in single-booking rendering | low | medium | Phase B verify checkpoint includes manual visual sweep at 4 viewports. Snapshot test for single + group variants. |
| Calendar tile too narrow for Group chip at week view tight days | medium | low | Phase E icon-only fallback per §5.10 brief. Tooltip preserves info. |
| Dashboard data layer doesn't expose mixed-group marker | medium | low | §5.11 (b) collapse documented; if data layer is bare, defer to C-12+ and leave dashboard chip generic for mixed groups. |
| Email template renderer fetches don't include `booking_participants` | medium | low | Phase G Step 18 explicit; verify during impl. If not, extend SELECT in `getBookingTemplateInput`. |
| Composite identity with very long contact name overflows on mobile | low | low | `break-words` class on the headline; ellipsis fallback on the row's compact contexts. |
| Gender Unicode glyphs (♀ ♂) render inconsistently across email clients (if used in email) | low | low | Email uses text labels ("female participant", "male participant") not Unicode glyphs. Glyphs only in the in-app sub-rows. |
| Fraction badge tone confuses users when fully assigned for group (success-coloured success) | low | low | Q9.1 locked: keep the badge as informational signal; success tone explicitly chosen to differentiate from partial. |
| Existing `Group · N` chip and new fraction badge appear together briefly during phased rollout | low | low | Phase B replaces both — the old chips are removed in the same commit. No dual-render window. |
| `[bookingId]/page.tsx` Group booking AdminStatusBadge removal regresses screen-reader announcement | low | low | Composite identity in `<title>` + `<h1>` preserves group signal. Aria-label on Users icon adds further context. |
| Calendar tile change ships before C-02's recurring badge (which also lives on calendar tiles) | low | low | Both additions are additive chip slots. Coordinate during C-02 impl. |
| Email group block ships before C-08's new templates | low | low | Phase G coordinates: if C-08 hasn't shipped, only `renderStaffAssignmentEmail` gains the block. C-08 picks up the pattern for its new templates. |
| Participant order in sub-rows / email differs from creation order | low | low | Order by `is_main_contact DESC, created_at ASC` (or whatever the SELECT default is) for determinism. Document during impl. |
| `_helpers.ts` import circularity with C-04a/C-05 utilities | low | low | All helpers are pure functions with no internal imports. Safe to colocate. |

---

## 5 — Undo procedure

### 5.1 Undo code (Phases A–H)

Each phase is a self-contained git commit. Revert in reverse order:

1. `git revert <phase-H-cleanup-commit>` — restores any literal `"Same-gender required"` strings that were caught + dashboard data layer changes.
2. `git revert <phase-G-email-templates-commit>` — removes group context block from emails. Templates render as today.
3. `git revert <phase-F-detail-page-commit>` — restores `"Group booking"` standalone badge + detail page header to its pre-C-13 shape.
4. `git revert <phase-E-calendar-commit>` — removes Users icon + Group chip from calendar tiles.
5. `git revert <phase-C-composite-identity-commit>` — restores direct `contact_full_name` references in headlines + page titles.
6. `git revert <phase-B-bookingcard-commit>` — restores inline `<article>` block in `bookings/page.tsx`; deletes `BookingCard.tsx`. **This is the largest revert** — all subsequent UI work falls back.
7. `git revert <phase-A-gender-chip-commit>` — restores static `"Same-gender required"` chip.

Phases A + C are leaf helpers (no upstream deps); reverting them independently is safe. Phase B is the load-bearing extraction; reverting it cascades through all downstream phases that consume `BookingCard`. Recommended: keep all 8 commits together for clean rollback semantics; revert as a unit if needed.

### 5.2 Undo DB state

**None.** C-13 has no migrations + no server-action invocations. No DB state to undo.

### 5.3 Test data restoration

If any group test bookings were created during pre-flight to populate fixtures, they can remain — they don't pollute production beyond standard test-fixture practice.

---

## 6 — Test fixture guidance (what to use, what NOT to touch)

**Safe for any C-13 E2E walk:**
- Group bookings with `Phase10*` / `Audit Test*` clients — visible in pre-flight DB query.
- Single bookings with same client patterns — for regression checks.
- Create new test groups via `/admin/bookings/new` if no suitable fixtures exist. ManualBookingForm at `/admin/bookings/new` supports adding participants via the form UI.

**DO NOT touch:**
- Badar's `9d55ce2a` (cancelled, real email).
- Any non-test client booking.

**Pre-flight SQL check before any state mutation:**
```sql
SELECT id, contact_full_name, contact_email, status,
       (SELECT COUNT(*) FROM booking_participants p WHERE p.booking_id = bookings.id) AS pc
FROM bookings WHERE id = '<id>';
```
Cross-reference against safe-fixture list before clicking.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — `composeGenderRequirementChip` helper + vitest + wire into list, detail, dashboard |
| 2 | Phase B — `BookingCard.tsx` extraction + `GroupBookingCard` nested layout + `ParticipantSubRow` |
| 3 | Phase C — `composeBookingIdentity` helper + vitest + wire into list (BookingCard), detail header, page title |
| 4 | Phase D — fraction badge (already integrated into Phase B; folded into commit 2 OR a small follow-up commit if extracted) |
| 5 | Phase E — calendar tile Group chip + Users icon |
| 6 | Phase F — booking detail surface refinement (remove standalone Group badge, ParticipantCard chip refactor, metadata) |
| 7 | Phase G — email templates `renderGroupContextBlockHtml` + wire into staff assignment / claim / confirmation renderers + threading payload from `notifications.ts` |
| 8 | Phase H — dashboard data layer mixed-group collapse + final cleanup audit + bundle measurement + master plan ✅ flip |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-13 {phase}` prefix during C-C. Master plan checklist + progress file edits use `chore(redesign): ...`.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. Run §0 Pre-flight in full. Verify `_helpers.ts` exists (from C-04a/C-05). Verify a test group booking exists.
3. Execute Phase A → B → C → D → E → F → G → H in order. Some phases can ship together (A+C are pure helpers; B integrates both).
4. No migration — Zone-2 not required.
5. Verification gate (§3) non-negotiable.
6. Update `redesign/per-page-progress/C-13-group-bookings-and-gender-clarity-progress.md` per phase.
7. Final commit updates master plan checklist C-13 row from `⏳` to `✅` with shipped date + commit SHA.
8. After C-13 ships, **C-11's shared blocks library can adopt `BookingCard`** if C-11 hasn't already shipped. Coordinate with C-11 impl session.

---

## 9 — Open questions remaining (for plan-reviewer / user)

Surfaced during plan-writing — not blocking, but worth noting:

1. **Calendar tile JSX location** — needs to be located during impl (grep approach in Phase E Step 10). If colocated in a `CalendarEventCard.tsx` component, edit there; if inline, extract during the change.

2. **Dashboard data layer mixed-group marker** — Phase H Step 20 verifies. If absent, the mixed-group case shows generic "Unassigned" on dashboard. Acceptable; C-12+ improvement.

3. **`BookingCard` server vs client component** — extraction should preserve current server-rendering. Verify during impl that the component is server-renderable (no `useState`, etc.); client interactions remain in `BookingRowActions.tsx` as today.

4. **Snapshot testing for `BookingCard`** — vitest's ability to render server components is limited. Fallback to Playwright visual regression if vitest can't snapshot.

5. **Composite identity in audit log entries** — should audit log rows referencing a group booking show composite identity in the readable `target_label` field? Currently uses booking id + contact name. Out of scope; defer.

6. **Performance: per-row helper invocation** — `composeGenderRequirementChip` + `composeBookingIdentity` run per booking row in lists. For 50-100 bookings/page, negligible. If lists scale to 500+, consider memoization. Not a current concern.

7. **Email RTL languages** — composite identity strings include "+ N others" — for RTL email recipients, ordering may need adjustment. Out of programme scope unless QA flags.

8. **Aria-live announcements** — when a group booking's fraction badge changes (e.g., another therapist claims), should an aria-live region announce? Currently the row simply re-renders via revalidate. Polish for C-12+.

9. **`is_main_contact` data integrity** — what if 0 or >1 participants are flagged as `is_main_contact`? Helper handles 0 case (fallback to `contact_full_name`). For >1 (data anomaly), `.find` returns the first. Document in tests + flag as a data-integrity check in C-12+ if needed.

10. **Group booking calendar tile click target** — single tile click-through navigates to detail page. For a group, all participants point to the same detail page. No per-participant deep-link from the tile. Acceptable.

---

*End of C-13 plan. Brief: `redesign/briefs/C-13-group-bookings-and-gender-clarity-brief.md`. Progress: `redesign/per-page-progress/C-13-group-bookings-and-gender-clarity-progress.md` (filled during C-C).*
