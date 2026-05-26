# C-13 — Group-booking surface + gender-clarity chips + composite identity + per-participant progress

**Type:** Band C plan-writing brief (post-C-B amendment, 2026-05-26)
**Date written:** 2026-05-26
**Predecessors:**
- User direction 2026-05-26 — booking-card gender clarity + group booking visual prominence
- `redesign/HANDOFF-2026-05-26-POST-C-B.md` §5.11 (cancelled-booking amendment context — same surfaces touched)
- `redesign/audits/C-A/02-bookings-list-audit.md` (row card structure)
- `redesign/audits/C-A/04-bookings-detail-audit.md` (booking detail surface)
- `redesign/audits/C-A/W05-assignment-claim-reassign-flow.md` (per-participant assignment data model — already correct)
- `redesign/audits/C-A/09-calendar-audit.md` (calendar tile structure)

**Companion files:**
- Plan: `redesign/plans/C-phase/C-13-group-bookings-and-gender-clarity-plan.md`
- Progress: `redesign/per-page-progress/C-13-group-bookings-and-gender-clarity-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-13 fixes a long-standing UX gap: group bookings (multi-participant visits) and gender-required bookings render with generic, information-thin chips that lose the actionable detail an admin or therapist needs to triage / claim / assign correctly. **Seven targeted changes** across **8 phases (A–H)**:

1. **Gender-clarity chips** — replace generic `"Same-gender required"` chip with phrasing keyed off `booking_participants.required_therapist_gender` counts. Single: `"Needs female therapist"`. Group same-gender: `"Needs 2 female therapists"`. Group mixed: `"Needs 1 female + 1 male"`. Same logic on detail page + dashboard attention cards.
2. **Group cards as first-class** — option (c) nested layout: list row for a group booking renders **per-participant sub-rows** with each person's identity + gender + assigned-therapist state. Spatially larger; subtle group-tinted background; Users icon prefix on headline.
3. **Composite identity for groups** — row headline + detail header + dashboard card render `"{main_contact} + {N} others"` instead of just the contact name.
4. **Per-participant assignment progress** — replace generic `"Partially assigned"` badge with `"1 of 2 therapists assigned"` for group bookings (single bookings keep the existing 3-state vocabulary).
5. **Calendar surface treatment** — calendar event tile gains a small `"Group · 2"` chip + Users icon when `participantCount > 1`.
6. **Booking detail surface refinement** — detail header gets composite identity; AssignmentRow participant-name context already exists (verified); detail-page participant cards already render correctly (verified during audit).
7. **Email templates** — `staff_assignment` + `staff_claim` + `booking_confirmed_client` emails extended with group-booking context block when `participantCount > 1`.

**Zero migrations, zero new permissions, zero new server actions.** Pure UI render work spanning 4 surfaces (list, detail, dashboard, calendar) + 3 email templates. The data model (`booking_participants` per-row + `booking_assignments` per-participant) is already correct — claim/assign per-participant works today.

**Sequencing:** Independent of all other plans by data model. Soft sequencing: ships **after C-FIELDWORK** + **before C-11** so the new `BookingCard` shape is what C-11's shared-blocks library lifts. Touches the same `bookings/page.tsx` row card as C-05 Edit Point 9 (strikethrough) — coordinate via shared `_helpers.ts` + class-composition pattern.

---

## 1 — Why this plan exists

### 1.1 The generic "Same-gender required" chip is information-lossy (HEADLINE)

`bookings/page.tsx:837-843` renders one chip text — `"Same-gender required"` — whenever ANY participant has `required_therapist_gender` set:

```ts
const requiresGenderMatch = booking.booking_participants.some(
  (participant) => Boolean(participant.required_therapist_gender)
);
```

For a single booking with one female participant needing a female therapist, the chip says "Same-gender required" — leaving the admin / therapist to click into the detail page to learn it's a **female** therapist that's needed. For a group booking with 1 female + 1 male participant both needing same-gender therapists, the chip ALSO says "Same-gender required" — losing the more-important "you need ONE of each gender" information. The screenshot the user supplied (Phase10 E2E Claim Client booking on 24 May 2026) is exactly this case.

The fix: render the chip dynamically from `booking_participants` requirements, surfacing both the count and the gender directly on the list row + detail header + dashboard cards.

### 1.2 Group bookings are visually indistinguishable from single bookings

`bookings/page.tsx:845-852` renders a small `"Group · N"` pill alongside other status chips. Same size, weight, and tone as the unassigned-status chip — the eye can miss it. For a clinic where a 3-person group visit is operationally very different from a single visit (multi-therapist coordination, longer prep, larger payment, scheduling implications), the visual de-emphasis is wrong.

Per audit of `[bookingId]/page.tsx:455-456`, the detail page already calls out group bookings with an `AdminStatusBadge tone="restricted" value="Group booking"`. List row should match that level of prominence — and go further (per user direction — option c: nested layout with per-participant sub-rows directly on the list row).

### 1.3 The main-contact name hides group composition

The list row headline shows `booking.contact_full_name || booking.clients?.full_name` — i.e., the main contact's name. A 3-person group reads as if it were a single appointment for one person. Group composition only appears via the small `Group · 3` chip and on the detail page.

The fix: composite identity at headline level — `"Aisha Khan + 2 others"` for a group of 3, `"Aisha Khan + 1 other"` for a group of 2. Single bookings keep `clientName` as today.

### 1.4 Assignment progress is binary, not fractional

The `assignment_status` enum is `unassigned | partially_assigned | fully_assigned` (rolled up in `actions.ts:315-323`). The list-row badge surfaces this as `"Partially assigned"` — accurate but not actionable. For a group of 2 with 1 therapist assigned, the admin / therapist wants to know **how close to fully crewed**: `"1 of 2 therapists assigned"`.

The fix: extend the assignment badge to show the fraction for group bookings (`{assignedCount} of {participantCount} therapists assigned`). Single bookings keep the existing 3-state vocabulary unchanged.

### 1.5 Calendar has no group / gender treatment

Verified via `grep` on `calendar/page.tsx` — no references to `group_booking`, `participantCount`, or `booking_participants`. Group bookings render on the calendar grid as a single tile with no indication that multiple therapists need to be assigned. For weekly schedule planning, this is a meaningful blind spot.

The fix: small `Group · N` chip on calendar event tiles when `participantCount > 1` + Users icon prefix.

### 1.6 Dashboard attention cards have the same generic chip

`dashboard-cards.tsx:583-590` renders `"Unassigned · same-gender required"` as a static string — same information loss as the list-row chip. The Owner / Admin / Coord dashboard surfaces attention-worthy bookings; chip phrasing should match the new list-row clarity. The dashboard's data-layer collapses participant gender requirements into a single `appointment.requiredGender` field per `SnapshotAppointment`, so the dashboard chip rephrase is independent of the multi-gender group case (single-axis fix).

### 1.7 Email templates lack group context

`sendStaffAssignmentEmail` / `sendClaimNotificationEmail` (per C-08 plan) / `sendBookingConfirmationEmail` produce a single per-recipient email when a participant in a group is assigned / claimed / confirmed. The email body doesn't tell the practitioner / client that this is part of a multi-person visit. For groups, the practitioner needs: "you're assigned to Person 2 (male); 1 of 2 therapists assigned so far." For the client: "we've confirmed bookings for all 3 of you, here's the full list".

The fix: extend the relevant email templates with a conditional group-context block rendered when `participantCount > 1`.

---

## 2 — Scope

C-13 ships **7 changes across 8 phases (A–H)**. Each phase is committable independently.

### 2.1 Change 1 — Gender-clarity chip helper (Phase A)

**New helper `composeGenderRequirementChip` in `src/app/admin/bookings/_helpers.ts`** (file already created by C-04a + C-05 amendments — this extends it):

```ts
export type GenderRequirementChip = {
  label: string;       // human-readable phrasing
  visible: boolean;    // false if no requirements OR fully assigned
};

export function composeGenderRequirementChip(
  participants: Array<{ required_therapist_gender: string | null }>,
  assignmentStatus: "unassigned" | "partially_assigned" | "fully_assigned"
): GenderRequirementChip {
  // Once fully assigned, the requirement is fulfilled — no action signal needed
  if (assignmentStatus === "fully_assigned") return { label: "", visible: false };

  const female = participants.filter(p => p.required_therapist_gender === "female").length;
  const male = participants.filter(p => p.required_therapist_gender === "male").length;

  if (female === 0 && male === 0) return { label: "", visible: false };

  // Single-participant booking
  if (participants.length === 1) {
    return {
      label: female === 1 ? "Needs female therapist" : "Needs male therapist",
      visible: true,
    };
  }

  // Group same-gender (female only)
  if (female > 0 && male === 0) {
    return {
      label: `Needs ${female} female therapist${female > 1 ? "s" : ""}`,
      visible: true,
    };
  }
  // Group same-gender (male only)
  if (male > 0 && female === 0) {
    return {
      label: `Needs ${male} male therapist${male > 1 ? "s" : ""}`,
      visible: true,
    };
  }
  // Mixed group
  return {
    label: `Needs ${female} female + ${male} male`,
    visible: true,
  };
}
```

**Render sites:**
- `bookings/page.tsx:837-843` — replace `requiresGenderMatch` boolean + static text with `composeGenderRequirementChip(...)`.
- `[bookingId]/page.tsx:660-665` — same replacement on detail page header.
- `dashboard-cards.tsx:583-590` — rephrase the static "Unassigned · same-gender required" with the new helper (dashboard data layer collapses participants — single-axis rephrase to `"Unassigned · Needs {gender} therapist"`).

**Edge case (locked):** fully-assigned bookings hide the chip — the requirement is fulfilled, no action signal needed.

### 2.2 Change 2 — Group cards as first-class (Phase B — nested layout, option c)

**New shared component `BookingCard` in `src/app/admin/bookings/BookingCard.tsx`** — extracted from the inline JSX at `bookings/page.tsx:804-927`. Props:

```ts
type BookingCardProps = {
  booking: BookingRecord;
  role: "full" | "therapist";
  showSensitiveDetails: boolean;
  canViewAll: boolean;
  ownBooking: boolean;
  claimableAssignment: BookingAssignment | null;
  animationDelay?: number;
  today: string;
};
```

**Render variants:**
- `isGroup === false` (single participant): renders the existing single-row layout, with the new gender chip from §2.1 swapped in.
- `isGroup === true` (≥2 participants): renders the nested layout:

```
┌─────────────────────────────────────────────────────────────┐
│  [Users icon]  Aisha Khan + 2 others                        │
│                Sun 24 May · 10:00–11:00 · Hijama Package    │
│                [confirmed] [1 of 3 therapists assigned]     │
│                [Needs 2 female + 1 male]                    │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Aisha Khan (main)   ♀  ·  Assigned to Layla     │       │
│  │ Yusuf Khan          ♂  ·  Open — needs male     │       │
│  │ Maryam Khan         ♀  ·  Open — needs female   │       │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
│  [Map / address row]                  [⋯ row actions]         │
└─────────────────────────────────────────────────────────────┘
```

**Visual emphasis:**
- Subtle group-tinted background — `bg-[var(--admin-panel-muted)]` or a new `--admin-group-tint` token (decide during impl — coordinate with C-11 design-system pass).
- Users icon (`Users` from lucide-react) as headline prefix.
- Nested sub-rows in their own inner panel with `border border-[var(--admin-border)] bg-[var(--admin-panel)]`.
- Spatial: slightly more padding (`p-5 sm:p-6` vs `p-4 sm:p-5` for single).

**Per-participant sub-row content:**
- Participant `display_name` OR fallback `"Person {index + 1}"`.
- `"main"` tag if `is_main_contact`.
- Gender chip (♀ / ♂ — small, compact).
- Assignment state: `"Assigned to {therapist_name}"` (if `assigned_staff_id` set) OR `"Open — needs {gender} therapist"` (if unassigned).

**Mobile reflow (375):**
- Nested sub-rows stack vertically (already the natural flow).
- Sub-row's right-side "Assigned to / Open" wraps below the participant name + gender.
- Group-tinted background preserved; padding tightens.

**Calendar treatment uses a slimmer variant** — see §2.5.

### 2.3 Change 3 — Composite identity helper (Phase C)

**New helper `composeBookingIdentity` in `_helpers.ts`:**

```ts
export function composeBookingIdentity(booking: {
  contact_full_name: string | null;
  clients?: { full_name: string | null } | null;
  booking_participants: Array<{ id: string; display_name: string | null; is_main_contact: boolean | null }>;
}): { primary: string; secondary: string | null } {
  const mainContact =
    booking.booking_participants.find(p => p.is_main_contact)?.display_name ||
    booking.contact_full_name ||
    booking.clients?.full_name ||
    "Unknown client";

  const otherCount = booking.booking_participants.filter(p => !p.is_main_contact).length;

  if (otherCount === 0) {
    return { primary: mainContact, secondary: null };
  }
  if (otherCount === 1) {
    return { primary: `${mainContact} + 1 other`, secondary: null };
  }
  return { primary: `${mainContact} + ${otherCount} others`, secondary: null };
}
```

**Render sites:**
- `BookingCard` headline (replaces `clientName` derivation at the current `bookings/page.tsx:763-764`).
- Booking detail header (`[bookingId]/page.tsx` — find the page title block; current renders `booking.contact_full_name` directly).
- Dashboard attention card headline (if applicable — verify during impl whether `SnapshotAppointment.title` already encodes group composition).
- Calendar event tile (slimmer variant — see §2.5).

**Edge case (locked):** if no participant has `is_main_contact = true`, fallback to `booking.contact_full_name`. If `booking_participants` is empty (shouldn't happen post-create but defensive), fallback to `"Unknown client"`.

### 2.4 Change 4 — Per-participant assignment progress (Phase D)

In `BookingCard`, the assignment-status badge gains a fraction display for groups:

```ts
const assignedCount = booking.booking_assignments.filter(
  a => a.assigned_staff_id && a.status !== "unassigned"
).length;
const totalAssignmentCount = booking.booking_assignments.length;

const assignmentBadgeLabel = isGroup
  ? `${assignedCount} of ${totalAssignmentCount} therapists assigned`
  : booking.assignment_status === "unassigned"
    ? "Unassigned"
    : booking.assignment_status === "partially_assigned"
      ? "Partially assigned"
      : null;  // hide for fully_assigned single bookings (current behaviour preserved)
```

**Tone:**
- `assignedCount === 0` → `warning` (red/amber)
- `assignedCount > 0 && assignedCount < totalAssignmentCount` → `warning` (amber)
- `assignedCount === totalAssignmentCount` (fully assigned group) → `success` (green) — informational
- Single booking fully_assigned → no badge (current behaviour)

The fraction badge appears in the same chip-row location as today's status badges, between the booking status and the gender chip.

### 2.5 Change 5 — Calendar surface treatment (Phase E)

`/admin/calendar` event tiles (rendered somewhere downstream from `calendar/page.tsx` — find the tile component during impl, likely `CalendarEventCard` or inline JSX) gain:

- A small `"Group · N"` chip with Users icon when `participantCount > 1`.
- Subtle distinct tile background — `bg-[var(--admin-group-tint)]` or muted variant (same token as `BookingCard`).
- Tooltip on hover with composite identity (`"Aisha Khan + 2 others — 3 participants"`).
- For unassigned slots, the existing "Unassigned" indicator can include the fraction (e.g., "1 of 3 assigned") if space allows; otherwise just the count.

**Constraint:** calendar tiles are dense; treatment must remain readable at 1280 grid resolution (tile widths can drop to ~60-80px on tight days). Default to icon-only when space is tight, with full label on hover.

### 2.6 Change 6 — Booking detail page refinement (Phase F)

The detail page already does most of the right work (`[bookingId]/page.tsx` participant cards at `:620-708` render per-participant gender + same-gender-required correctly). What needs to change:

- **Page header** (~`[bookingId]/page.tsx` — find the section that renders the page title with booking date/time/client name) — apply `composeBookingIdentity` to surface `"Aisha Khan + 2 others"`.
- **AssignmentRow participant labelling** (`:759-815`) — already shows participant `display_name` (`participant?.display_name ? participant.display_name : ...`). Verified correct.
- **`ParticipantCard` chip rephrase** (`:660-674`) — replace `"Same-gender required"` with the per-participant clarity: `"Needs female therapist"` or `"Needs male therapist"` based on `participant.required_therapist_gender`. Today's logic at `:639-640` only checks `participant.required_therapist_gender === participant.participant_gender`; refactor to use the new helper convention.

### 2.7 Change 7 — Email templates with group context (Phase G — email surface)

Three templates gain a conditional group-context block:

**(a) `staff_assignment` email** — when a practitioner is assigned to a participant in a group, the email body gets:

```
This is part of a group booking:
  • Aisha Khan (female) — you are assigned
  • Yusuf Khan (male) — assigned to {other_therapist} or "open"
  • Maryam Khan (female) — open

Total: 3 participants, 1 of 3 therapists assigned so far.
```

**(b) `staff_claim` email** (when another practitioner claims a slot — informational) — same group-context block; helps assigned practitioners track when colleagues join.

**(c) `booking_confirmed_client` email** (C-08 scope) — when a group booking is confirmed, the client confirmation email body includes:

```
This booking includes 3 people:
  • Aisha Khan
  • Yusuf Khan
  • Maryam Khan

We'll send a confirmation when each person's therapist is assigned.
```

**Implementation:** new template-fragment renderer `renderGroupContextBlock(booking)` in `src/lib/email/templates.ts`. Conditional inclusion in the existing renderers. Plain-text fallback included.

**Coordination with C-08:** C-08 (email template expansion) introduces 4 new templates; C-13 extends 3 of them (assignment + claim + confirmed) with the group-context block. **Ship order: C-08 → C-13** so the templates exist before C-13 extends them. Alternatively, C-13 can ship before C-08 with the group-context block applied only to the existing `staff_assignment` template; C-08 then picks up the pattern for its new templates. **Locked:** ship C-08 → C-13 to avoid double-touching the same renderer files.

### 2.8 Change 8 — `BookingCard` extraction + shared `BookingRow` (Phase H, integration polish)

**Refactor target:** the inline `<article>` block at `bookings/page.tsx:804-927` is ~120 lines of JSX inside `BookingsListSection`. Extracting it into a standalone `BookingCard.tsx` component achieves:

- C-11's shared-blocks library has a clean import target.
- C-FIELDWORK's `PractitionerTodaySection` can reuse the same component (if its today-card uses the same shape).
- Easier testing (component-level vitest possible).
- Variant rendering (`single` vs `group`) lives in one file.

The refactor is **additive only** — the component renders the same output for single bookings as today (with the chip/identity helpers from §§2.1+2.3 baked in). Group bookings get the new nested layout.

---

## 3 — RBAC matrix

C-13 introduces no new permissions; chip visibility / sub-row content follow existing RBAC.

| Affordance | Owner | Admin | Coord | Therapist |
|---|---|---|---|---|
| See group composition + per-participant sub-rows on list | ✅ | ✅ | ✅ | ✅ if booking visible (own + claimable) |
| See gender chip (any role) | ✅ | ✅ | ✅ | ✅ |
| See composite identity headline | ✅ | ✅ | ✅ | ✅ |
| See assignment progress fraction | ✅ | ✅ | ✅ | ✅ |
| See calendar group chip | ✅ | ✅ | ✅ | ❌ (Therapist has no calendar access — current state) |
| See email group-context block | ✅ on staff_assignment + staff_claim sends | ✅ | ✅ if `can_take_bookings` + assigned | ✅ if assigned |
| Client receives group block on `booking_confirmed_client` | n/a | n/a | n/a | n/a (client-facing) |

Therapist's view of per-participant sub-rows respects existing scope: they see participants whose assignments they own or could claim. Other participants' details (display_name, gender) are visible but health_notes / participant_notes stay scoped to the assigned therapist per existing predicate work.

---

## 4 — Layout strategy

### 4.1 List row — single booking (current shape, refined)

```
┌─────────────────────────────────────────────────┐
│ Aisha Khan                                       │
│ Sun 24 May · 10:00–11:00 · Hijama Package        │
│ [confirmed] [Unassigned] [Needs female therapist]│
│                                                   │
│ ? No therapist yet      [unpaid · £45.00]   [⋯] │
└─────────────────────────────────────────────────┘
```

Difference from today: chip phrasing is now gender-specific.

### 4.2 List row — group booking (NEW nested layout per option c)

```
┌────────────────────────────────────────────────────────────────┐
│ 👥 Aisha Khan + 2 others                                        │
│    Sun 24 May · 10:00–11:00 · Hijama Package                    │
│    [confirmed] [1 of 3 therapists assigned] [Needs 2♀ + 1♂]    │
│    ╔════════════════════════════════════════════════════╗      │
│    ║ Aisha Khan (main)  ♀   Layla Hassan                ║      │
│    ║ Yusuf Khan         ♂   Open — needs male           ║      │
│    ║ Maryam Khan        ♀   Open — needs female         ║      │
│    ╚════════════════════════════════════════════════════╝      │
│    [📍 Luton, LU1]                          [⋯ actions]         │
└────────────────────────────────────────────────────────────────┘
```

- Background: subtle group tint (`--admin-panel-muted` or new `--admin-group-tint` token).
- Headline: Users icon prefix; composite identity primary.
- Status chip row: status + fraction badge + dynamic gender chip.
- Inner panel (per-participant sub-rows): own border + lighter background; each row = name + main-tag + gender icon + assignment state.
- Outer footer: address / actions / etc. (unchanged from single layout).

### 4.3 Mobile reflow (375)

Sub-rows stay vertical (natural stacking). Inner panel keeps its border but tighter padding (`p-3`). Long therapist names truncate with ellipsis. Hover tooltip on truncated names shows full name.

### 4.4 Booking detail header

Today (per audit `[bookingId]/page.tsx`):

```
Booking — Aisha Khan
Sun 24 May 2026 · 10:00 — 11:00 · Hijama Package
[confirmed] [Group booking] [Same-gender required]
```

After C-13:

```
Booking — Aisha Khan + 2 others
Sun 24 May 2026 · 10:00 — 11:00 · Hijama Package
[confirmed] [1 of 3 therapists assigned] [Needs 2 female + 1 male]
```

(`Group booking` chip becomes redundant once composite identity + fraction badge render; remove for tidiness.)

### 4.5 Dashboard attention card

Today: `"Unassigned · same-gender required"` static text.

After C-13: `"Unassigned · Needs female therapist"` (or male). Dashboard data layer (`SnapshotAppointment`) collapses participant gender to a single field; for groups, falls back to `"Unassigned · {N} therapists needed"` if mixed-gender (dashboard scope keeps things compact).

### 4.6 Calendar event tile

Today: a single tile, no group/gender treatment.

After C-13:
```
┌──────────────────────────┐
│ Aisha Khan + 2 others  👥│
│ 10:00–11:00              │
│ [1/3 assigned]           │
└──────────────────────────┘
```

Users icon in top-right; fraction badge if unassigned slots exist; tile background distinct.

### 4.7 Email group-context block (plain-text + HTML)

```
This booking is part of a 3-person group:
  • Aisha Khan (main contact, female) — assigned to Layla Hassan
  • Yusuf Khan (male) — open
  • Maryam Khan (female) — open

1 of 3 therapists assigned so far.
```

Rendered in HTML as a left-bordered callout block (existing template pattern) and in plain-text as the bulleted list above.

---

## 5 — States & edge cases

### 5.1 Group with all participants needing same gender

Most common case (e.g., 3-person hijama family booking — all female). Chip: `"Needs 3 female therapists"`. Sub-rows: each has female gender icon + "Open — needs female" until assigned.

### 5.2 Mixed-gender group

Less common but supported per ManualBookingForm. Chip: `"Needs 2 female + 1 male"`. Sub-rows: each shows their own gender + matching requirement. Assignment is per-participant — a male therapist claiming the male slot does NOT make a female slot eligible.

### 5.3 Group with no gender requirements

Chip hidden (no gender required). Sub-rows still render (group structure is the headline value). Composite identity + assignment progress chips apply.

### 5.4 Fully assigned group

Composite identity preserved. Fraction chip shows `"3 of 3 therapists assigned"` with success tone (or hidden — see Q9.1). Gender chip hidden per §2.1 locked decision.

### 5.5 Cancelled group booking (interaction with C-05)

C-05's Edit Point 9 strikethrough applies to the outer card (date + composite identity). Sub-rows inherit the strikethrough naturally via the parent's class. Row menu shows only Restore (C-04a Change 12). Sub-rows still render for context but their assignment-state text is muted.

### 5.6 Restored group booking (interaction with C-04a)

C-04a's Restore button restores the booking, which restores all participants' assignments back to their pre-cancel state. The booking-level email (`booking_restored_client`) fires once for the main contact; assigned-staff emails fire per assigned therapist (existing C-04a behaviour). C-13's group-context block in the restore email mentions all participants if `participantCount > 1`.

### 5.7 Solo participant flagged as `group_booking = true` (data anomaly)

Per `bookings/page.tsx:778-781` comment: `group_booking` can be true with one participant during draft states. `isGroup = participantCount > 1` is the authoritative check. C-13 preserves this — the flag is ignored in favour of participant count. Composite identity for a single-participant booking is just the client name, no `"+ 0 others"` artefact.

### 5.8 Empty `booking_participants` (defensive)

Shouldn't happen post-create (the form enforces ≥1). If it does (data integrity violation), `BookingCard` falls back to `booking.contact_full_name` and renders as a single booking. Log a warning to the console for visibility.

### 5.9 Practitioner assigned to one participant in a mixed group

Per existing per-assignment claim semantics. The practitioner's detail-page view shows the full participant list (read-only context); their own assignment row has the actionable affordances. Email group-context block surfaces that other participants are pending or assigned to colleagues.

### 5.10 Calendar tile space constraints

At week / month views with many tiles per day, the Users icon + count chip may not fit. Fallback: render only the Users icon (no count). On hover, the tooltip surfaces the full composite identity + count. At day view (single-day, wider tiles), full chip renders.

### 5.11 Dashboard attention card mixed-gender collapse

The dashboard `SnapshotAppointment` type collapses participant data into a single `requiredGender` field. For mixed-gender groups, this loses the information. Two options:
- (a) Surface participant count in dashboard data layer (`fetchDashboardData` returns participant count + per-gender breakdown). Lift required; out of C-13 scope.
- (b) Show generic `"Mixed group — open assignments"` on the dashboard chip when the booking is mixed-gender + group. Drop-in.

**Locked decision:** (b) for C-13. (a) is a C-12+ improvement once dashboard data needs more depth.

---

## 6 — Migration footprint

**None.** C-13 is pure UI render work. No DB changes, no new permissions, no new server actions, no new email_event_types (existing templates extend).

`booking_participants` + `booking_assignments` schemas are already correct (per audit). The `participant_id` link on `booking_assignments` already powers per-participant claim semantics.

---

## 7 — Files touched

### NEW (3 files)

| File | Purpose |
|---|---|
| `src/app/admin/bookings/BookingCard.tsx` | Extracted shared component — single + group variants |
| `src/app/admin/bookings/__tests__/composeGenderRequirementChip.test.ts` | Vitest coverage for the helper (single / group same-gender / group mixed / fully-assigned hide cases) |
| `src/app/admin/bookings/__tests__/composeBookingIdentity.test.ts` | Vitest coverage for composite identity helper (single / 2-person / 3+ / no-main-contact fallback) |

### EDITED (~9 files)

| File | Change summary |
|---|---|
| `src/app/admin/bookings/_helpers.ts` | + `composeGenderRequirementChip` (Phase A) + `composeBookingIdentity` (Phase C). Already created by C-04a/C-05 amendments — this extends it. |
| `src/app/admin/bookings/page.tsx` | Replace inline `<article>` block (~lines 804-927) with `<BookingCard />` usage. Threading helpers in via props or import. Cancelled-row strikethrough class composition (from C-05) preserved on the outer card. |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Detail header composite identity; ParticipantCard chip rephrase via `composeGenderRequirementChip` (single-participant call). Remove now-redundant `"Group booking"` AdminStatusBadge at `:455-456`. |
| `src/app/admin/dashboard/dashboard-cards.tsx` | Rephrase `AssignmentChip` label via new helper. `appointment.requiredGender` already passed through. Apply (b) mixed-group collapse per §5.11. |
| `src/app/admin/calendar/page.tsx` | Calendar tile gains Users icon + Group chip + composite identity tooltip. Find the tile-render JSX during impl; likely inline. |
| `src/lib/email/templates.ts` | + `renderGroupContextBlock(booking)` helper. Conditional inclusion in `renderStaffAssignmentEmail`, `renderClaimNotificationEmail` (C-08), `renderBookingConfirmationEmail`. |
| `src/lib/email/notifications.ts` | Pass `participantCount` + `booking_participants` data into the template renderers. No new send functions. |
| `src/app/admin/bookings/types.ts` | (Possibly) extend any shared types if `BookingCard` introduces new prop shapes. Verify during impl. |
| `src/app/admin/bookings/__tests__/access.test.ts` | (If exists) extend with group-booking visibility tests where relevant. |

### UNCHANGED (do NOT touch)

- `booking_participants` / `booking_assignments` SCHEMA — already correct.
- `claimBookingAssignment` / `updateBookingAssignment` server actions — per-participant semantics already correct.
- RBAC matrix, middleware, build configs.
- `reporting.ts` / `dashboard-helpers.ts` core exports (RECON §5).
- Customer-facing `manage/actions.ts` (out of scope).

---

## 8 — Sequencing and dependencies

### Hard dependencies

**None.** C-13 has no hard sequencing — the data model is already correct, and the changes are purely render-layer.

### Soft sequencing (recommended order)

- **After C-FIELDWORK** — `PractitionerTodaySection` from C-FIELDWORK renders booking cards too; C-13's `BookingCard` extraction should land first so C-FIELDWORK consumes the canonical shape, OR C-FIELDWORK ships its simpler card variant first and C-13 lifts both into one component during extraction. **Recommendation:** C-FIELDWORK first (its card is simpler), then C-13 extracts the canonical.
- **Before C-11** — C-11's shared-blocks library at `dashboard/blocks/` is a natural home for `BookingCard`. Land C-13 first so C-11 imports rather than reinvents.
- **After C-05** — C-05's Edit Point 9 (cancelled-row strikethrough) touches the same row card. C-05 ships the class-composition pattern (`isInertRow` derivation); C-13's `BookingCard` preserves and consumes it.
- **After C-08** — Phase G (email templates) extends `staff_assignment` + `staff_claim` + `booking_confirmed_client` renderers. C-08 introduces the latter two; C-13 plugs in the group-context block. **Coordination:** if C-08 ships first, C-13's Phase G is a clean extension. If C-13 ships before C-08, Phase G applies only to existing `staff_assignment` template; C-08 then picks up the pattern. Either order works; cleaner to ship C-08 → C-13.

### Recommended C-C insertion point

Per current handoff §6.2 order: `C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-02 → C-09 → C-03 → C-07 → C-10`.

**C-13 insertion:** between **C-08** and **C-02**, OR between **C-11** and **C-08** if email-template ordering is flipped. Cleanest: **after C-08** so all email-template renderers exist before C-13 extends them.

Updated order: `C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → **C-13** → C-02 → C-09 → C-03 → C-07 → C-10`.

### No dependency on C-02

C-02's recurring bookings produce booking rows like any other. Group + recurring is a future composition (a recurring group booking), already supported by the data model. C-13's BookingCard treats it identically.

### No dependency on C-06

C-06's `deleteClient` cascade affects bookings + assignments; doesn't touch participant/gender data. Independent.

---

## 9 — Open questions

### Q9.1 — Fully-assigned group: hide fraction chip or show "3 of 3"?

Two options:
- (a) Hide once fully assigned (the chip is an action signal; no action needed when crewed). Matches single-booking behaviour where `fully_assigned` shows no badge.
- (b) Show `"3 of 3 therapists assigned"` with success tone — informational; reinforces "this group is fully crewed".

**Locked:** (b) — informational value > silence for groups. The fraction tells a viewer "I see a group with 3 therapists confirmed" even at a glance. Single bookings keep (a) — minimal chrome.

### Q9.2 — Gender icons (♀ ♂) vs text in sub-rows?

Compact icon glyphs (♀ ♂) read at a glance but rely on Unicode. Lucide icons (User-with-skirt-style indicator) are more controllable. Text ("female" / "male") is unambiguous but verbose.

**Locked:** Unicode glyphs (♀ ♂) for compactness in sub-rows. Text labels remain in the main gender chip for accessibility. Aria-label on the glyph provides screen-reader equivalent (`aria-label="female participant"`).

### Q9.3 — `--admin-group-tint` token or reuse existing `--admin-panel-muted`?

A new token gives precise design control + future theming flexibility (especially for C-11 dark mode). Reusing `--admin-panel-muted` is zero new tokens but couples group treatment to whatever else uses that token.

**Locked:** introduce `--admin-group-tint` as a new token in C-11's design-system pass. C-13's Phase B can use `bg-[var(--admin-panel-muted)]` interim if C-11 hasn't shipped yet; swap to `--admin-group-tint` post-C-11. Plan documents the bridge.

### Q9.4 — Group tile background on calendar — distinct or same as single?

Calendar tiles already use status-based tinting (claimable / confirmed / pending). Adding a group tint on top creates layered styling — risk of muddy contrast.

**Locked:** keep calendar tile background unchanged. Group identification on calendar is via the Users icon + chip only. Status tinting wins for the tile background.

### Q9.5 — Email group-context block: render in all roles or only group bookings?

The block only renders when `participantCount > 1`. Single bookings get no extra section. Confirmed locked.

### Q9.6 — Therapist's email when assigned to a single participant in a group: include other participants' health_notes?

No. Other participants' health_notes are RBAC-scoped to their assigned therapist (existing predicate). The email block lists names + genders + assignment state only. No clinical detail leaks across participants.

### Q9.7 — Composite identity for therapists with limited visibility

A Therapist viewing a group booking where they're assigned to one participant: do they see the composite headline `"Aisha Khan + 2 others"` or only their assigned participant's name? Today's row-card headline shows `clientName` = main contact regardless of who's viewing. C-13 preserves that — composite identity is the same for all roles. The sub-rows show what they can see (their own assignment is actionable; others are read-only context).

**Locked:** same composite identity for all roles. RBAC governs sub-row content depth, not headline composition.

### Q9.8 — What if a group has 10+ participants? (Stress test)

ManualBookingForm doesn't appear to cap participants. A 10-person group would render 10 sub-rows on the list card — visually heavy. Consider a collapse-after-3 pattern with `"Show all (10)"` expand affordance.

**Locked for C-13:** render all sub-rows by default. Add collapse at impl time only if QA finds a 5+ booking in production. C-12+ polish if needed.

### Q9.9 — `BookingCard` extraction scope: full extraction or just variant logic?

Two options:
- (a) Full extraction — `bookings/page.tsx` becomes thinner; `BookingCard.tsx` owns all booking-row rendering. Cleaner long-term.
- (b) Variant logic only — `BookingCard.tsx` is just the group nested-layout; single bookings stay inline. Smaller blast radius.

**Locked:** (a) — full extraction. Enables C-11 reuse, C-FIELDWORK consumption, and component-level testing.

### Q9.10 — Composite identity in URLs / breadcrumbs

Breadcrumbs / page titles currently use the booking's contact name. Should they use composite identity for groups too?

**Locked:** yes — apply `composeBookingIdentity` to breadcrumbs + `<title>` tag for booking detail pages. Lightweight change; visible in browser tabs.

---

## 10 — Acceptance criteria

A C-13 implementation is complete when:

1. **Gender chip on list row shows specific gender + count.** Single booking with female participant: `"Needs female therapist"`. Group with 2 female + 1 male needing same-gender: `"Needs 2 female + 1 male"`. Verified for all 4 cases (single F, single M, group same-gender F, group same-gender M, group mixed).
2. **Gender chip hides on fully-assigned bookings.** Verified via a fully-assigned test booking.
3. **Group cards render nested per-participant sub-rows** on `/admin/bookings` list at 375 / 768 / 1280 / 1440. Sub-rows show name + gender icon + assignment state. Each sub-row visible without click-through.
4. **Composite identity** — group bookings render `"{main_contact} + {N} others"` on:
   - Bookings list row headline
   - Booking detail page header
   - Calendar event tile tooltip
   - Dashboard attention card (if dashboard `appointment.title` is patched)
   - Browser tab `<title>` for booking detail
5. **Per-participant assignment progress** — group bookings show `"1 of 3 therapists assigned"` badge instead of generic `"Partially assigned"`. Single bookings unchanged.
6. **Calendar group treatment** — Users icon + Group chip render on tiles when `participantCount > 1`. Composite identity in hover tooltip.
7. **Dashboard attention cards** — chip text uses specific gender phrasing.
8. **Email staff assignment** to a participant in a group includes the group-context block listing all participants + their assignment state.
9. **Email staff claim** notification includes the group-context block.
10. **Email booking_confirmed_client** (post-C-08) includes the group-context block for groups.
11. **BookingCard component** is extracted and used by `bookings/page.tsx`. No regressions vs current single-booking render (snapshot test passes).
12. **Group booking with cancelled status** (C-05 interaction) — strikethrough applies to the outer card; sub-rows inherit naturally; row menu shows only Restore.
13. **Past-datetime group booking** (C-04a Change 12 interaction) — row menu disabled; sub-rows render but no action affordances.
14. **All static gates pass:** lint, tsc, vitest, build, bundle delta within budget.
15. **Playwright role sweep at 4 viewports** passes for all 4 roles.
16. **Badar's `9d55ce2a` booking is untouched** during E2E testing.

---

## 11 — References

| Source | What it gives |
|---|---|
| `bookings/page.tsx:837-852` | Today's chip rendering (replace target — single + group chips) |
| `bookings/page.tsx:774-781` | Today's `requiresGenderMatch` + `participantCount` + `isGroup` derivation |
| `bookings/page.tsx:763-764` | `clientName` derivation (replace with `composeBookingIdentity`) |
| `bookings/page.tsx:804-927` | Inline `<article>` block — extract target for `BookingCard.tsx` |
| `[bookingId]/page.tsx:455-456` | Detail page Group booking badge (remove post-composite-identity) |
| `[bookingId]/page.tsx:620-708` | `ParticipantCard` component — chip rephrase target |
| `[bookingId]/page.tsx:639-640` | `sameGenderRequired` derivation per participant |
| `[bookingId]/page.tsx:712-815` | `AssignmentPanel` + `AssignmentRow` — participant-name context already correct |
| `actions.ts:240-356` | `claimBookingAssignment` — per-participant claim semantics verified |
| `actions.ts:315-323` | Assignment-status rollup logic (no change) |
| `dashboard-cards.tsx:583-590` | Dashboard `sameGenderRequired` string — rephrase target |
| `dashboard-cards.tsx:672-695` | `AssignmentChip` component — extend with dynamic label |
| `calendar/page.tsx` | Calendar tile JSX — locate during impl |
| `lib/email/templates.ts` | Email renderers — extend with group-context block |
| `lib/email/notifications.ts:341-429` | `sendStaffAssignmentEmail` — extend payload with participant data |
| `_helpers.ts` (C-04a + C-05 introduce) | Location for new compose helpers |
| `new/ManualBookingForm.tsx:656-680` | Mixed-gender group form logic — reference only |
| `redesign/audits/C-A/02-bookings-list-audit.md` | Row card structure context |
| `redesign/audits/C-A/04-bookings-detail-audit.md` | Booking detail surface context |
| `redesign/audits/C-A/09-calendar-audit.md` | Calendar tile context |
| `redesign/audits/C-A/W05-assignment-claim-reassign-flow.md` | Per-participant assignment data model — already correct |

---

## 12 — Out of scope (explicit non-goals)

- **Dashboard data layer changes** — `SnapshotAppointment` stays as today's shape. Mixed-group dashboard chip collapses to generic per §5.11. Future C-12+ improvement if dashboard depth is needed.
- **Realtime sub-row updates** — sub-rows reflect last-fetched state. Stale-UI race acceptable.
- **Calendar tile redesign** — only the small Group chip + Users icon + tooltip. Larger tile rework belongs in C-11 design-system pass.
- **Customer-facing booking page** (`/booking/[id]` / `/manage/[token]`) — group composition exposure to customers is a separate UX question. Out of C-13.
- **Inline group editing** (add / remove participants from existing booking) — operationally rare; complex; out of scope. Deletes flow through booking-level cancel.
- **Group bulk operations** (cancel all participants' assignments at once) — overlaps C-06 bulk-delete scope; defer to C-12+.
- **Per-participant email preferences** — every participant uses the booking-level `contact_email` today (data model has one email per booking). Per-participant email targeting is a C-12+ feature.
- **Participant-level audit timeline** — audit logs are booking-level. Per-participant audit is a forensic improvement; defer.
- **Group calendar tile expand-to-show-all-participants** — hover tooltip is the limit. Click-through to detail page for full view.
- **Group SMS / WhatsApp notifications** — out of programme scope.

---

*End of C-13 brief. Plan file follows: `redesign/plans/C-phase/C-13-group-bookings-and-gender-clarity-plan.md`.*
