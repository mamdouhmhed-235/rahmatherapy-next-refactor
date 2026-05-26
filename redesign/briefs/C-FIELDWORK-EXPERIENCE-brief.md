# C-FIELDWORK-EXPERIENCE — Capability-keyed fieldwork ergonomics

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q10 + §3 C-FIELDWORK-EXPERIENCE (capability-keyed not role-keyed; rename from "Therapist Field Experience")
- `redesign/audits/C-A/R04-therapist-day.md` (B-164 mobile sidebar buries client info; B-165 no next-visit widget on dashboard; B-166 maps deep-link — already exists)
- `redesign/audits/C-A/04-bookings-detail-audit.md` §2 V-13 (mobile sidebar order issue confirmed in code)
- `redesign/audits/C-A/R05-therapist-fresh-day.md` §4 (pattern templates — `getGreeting`, "Need help?", empty-state copy)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-FIELDWORK-EXPERIENCE-plan.md`
- Progress: `redesign/per-page-progress/C-FIELDWORK-EXPERIENCE-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-FIELDWORK rebases the fieldwork experience on the **capability** (`staff_profiles.can_take_bookings`) rather than the **role** (`Therapist`). Owner / Admin / Coord with `can_take_bookings=true` taking a booking themselves get the same field-optimised UI as a Therapist. Two surfaces change:

1. **Booking detail page** — when the viewer is an assigned practitioner on this booking, the mobile sidebar reorders ABOVE the main panels so client phone + address + maps button are the first thing they see at 375 px. Admin-curator view (Coordinator triaging, Owner reviewing) keeps the current layout.
2. **Dashboard** — new `PractitionerTodaySection` drop-in component renders when `profile.can_take_bookings=true`. Shows today's visits + next visit + claimable section, all surfaced from the existing TherapistDashboard pattern. Renders in any dashboard variant (Business / Coordinator / Therapist).

**Plus three primitive lifts** to a shared helpers module:

- `getGreeting()` — already exists in `TherapistDashboard.tsx:89-100`. Lift to `dashboard/shared-helpers.ts` so all variants can use it (C-11 consumes during dashboard-variant extraction).
- `tel:` link pattern — already exists in `BookingDetailSidebar.tsx:142-147`. **No new primitive needed.** Documentation: this is the canonical pattern (44-style international handling via existing JSX, `min-h-11` tap target).
- `https://www.google.com/maps/search/?api=1&query=...` maps link — already exists in `BookingDetailSidebar.tsx:278-288`. **No new primitive needed.** Already a mobile-optimised CTA.

**Headline fix:** the mobile sidebar reorder at the booking detail page (B-164) — currently a Therapist arriving at a client's address on their phone scrolls past Status & payment, Notes, Participants, Assignment, Email activity before reaching the sidebar with the client phone. C-FIELDWORK fixes that for assigned practitioners.

---

## 1 — Why this plan exists (and what changed since the decisions doc)

### 1.1 The capability-key insight (decisions doc Q10)

`staff_profiles.can_take_bookings` is the canonical predicate — used in 20+ places already across the codebase (rbac.ts:103, availability.ts, assignment-eligibility.ts, bookings/new/page.tsx, etc.). Owner is bookable (per master plan scope clarification 1). Admin can be bookable. Coord can be bookable. Per-user, not per-role. C-FIELDWORK uses this as the truth.

**The predicate:**

```ts
export function isViewerAssignedPractitioner(
  booking: { booking_assignments: { assigned_staff_id: string | null; status: string }[] },
  viewerStaffId: string,
  viewerCanTakeBookings: boolean
): boolean {
  if (!viewerCanTakeBookings) return false;
  return booking.booking_assignments.some(
    (a) => a.assigned_staff_id === viewerStaffId &&
           a.status !== "unassigned" &&
           a.status !== "cancelled"
  );
}
```

This is the gate that switches the booking detail page between the **practitioner view** and the **admin-curator view**.

### 1.2 The R04 mobile finding (B-164)

The booking detail page at 375 px reads in this order today:

```
Header
Next-action strip
Status & payment form
Booking notes
Participants
Assignment (with claim/complete buttons)
Email activity
Audit log
─── (scroll WAY down) ───
Sidebar:
  Summary (date, time, price)
  Client (name, phone, email)
  Address (street, postcode, area, maps button)
```

For a Therapist about to drive to the client's house, the most critical info (phone + address + maps button) is at the bottom of a 5-panel scroll. **R04 elevated this to a "headline workflow blocker"**. C-FIELDWORK fixes it for assigned practitioners.

### 1.3 Discovery during plan-writing: tel: and maps primitives already exist

Verified at code level:

- `BookingDetailSidebar.tsx:142-147` — `<a href="tel:${phone}">` with `min-h-11 sm:min-h-0` mobile tap target. Already the right shape.
- `BookingDetailSidebar.tsx:278-288` — `<a href="https://www.google.com/maps/search/?api=1&query=${encoded}">` with "View on Maps" CTA, `h-11 sm:h-10` mobile-sticky-style button.

**C-FIELDWORK does NOT introduce new tel: / maps primitives.** They're already shipped. The brief acknowledges them as the lift target — same patterns used in `PractitionerTodaySection`.

The R04 audit's framing ("no Open in maps affordance") was wrong for the booking detail page. R04 was likely referring to `/admin/me` (Therapist home), which doesn't currently surface assignment addresses with a maps CTA. **`PractitionerTodaySection` brings the maps CTA into the dashboard surface** — that's where the affordance was missing.

### 1.4 What's NOT in C-FIELDWORK (out-of-scope checks)

Per decisions doc Q10 + master plan:
- **B-166 (Open in maps on `/admin/me`)** — `/admin/me` is the Therapist's "home" page (performance + history-focused). Adding maps CTAs there is separate. C-FIELDWORK adds maps to the dashboard's PractitionerTodaySection, NOT to `/admin/me`. The `/admin/me` polish is C-12+.
- **B-167 (default `/admin/bookings` tab for practitioners)** — routing concern, deferred to C-07.
- **B-168 (assignment vs booking auto-promote)** — already in C-04a.
- **B-169 (session-note draft persistence)** — explicit out-of-scope per decisions doc.
- Pull-to-refresh — already in TherapistDashboard via existing mobile gesture tip; not adding it to Business / Coord variants (could feel out-of-place for admin-curator workflows). C-12+ if requested.
- Offline cache / PWA / native app / push notifications / real-time location — explicit out-of-scope per decisions doc.

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-FIELDWORK-EXPERIENCE)

C-FIELDWORK ships 4 changes plus a primitive lift.

### 2.1 The predicate + shared helpers lift (change 1)

**New file `src/app/admin/dashboard/shared-helpers.ts`** — extract from `TherapistDashboard.tsx`:

```ts
// Lifted verbatim from TherapistDashboard.tsx:89-130 + line 1361 export.
// C-11 will eventually consume these from each variant file (Business / Coordinator / Therapist).
export function getGreeting(): string;
export function getFirstName(name: string): string;
export function formatHours(minutes: number): string;
export function buildAddressLines(booking: BookingForFieldwork): string[];
export function buildMapsHref(booking: BookingForFieldwork): string | null;
```

Plus the new predicate:

```ts
export function isViewerAssignedPractitioner(
  booking: { booking_assignments: Array<{ assigned_staff_id: string | null; status: string }> },
  viewerStaffId: string,
  viewerCanTakeBookings: boolean
): boolean;
```

`TherapistDashboard.tsx` keeps the functions importable for backward compat (re-exports from `shared-helpers.ts` at line 1361, no behavioural change).

### 2.2 Booking detail dual-view (change 2 — the headline fix)

In `src/app/admin/bookings/[bookingId]/page.tsx`:

**At the page's server-component body, derive the predicate:**

```ts
const viewerIsPractitioner = isViewerAssignedPractitioner(
  booking,
  profile.id,
  profile.can_take_bookings
);
```

**The parent grid (currently at line 467):**

```tsx
<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
```

Stays the same on `md+` (sidebar is column 2, sticky). On mobile, the existing default order is "main content first, sidebar below". For practitioner view, **wrap the children with order-toggle classes**:

```tsx
<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
  <div className={viewerIsPractitioner ? "order-2 md:order-1" : "order-1"}>
    {/* main content panels — Status, Notes, Participants, Assignment, Email activity, Audit */}
  </div>
  <BookingDetailSidebar
    booking={booking}
    clientId={booking.client_id}
    showFinancials={showFinancials}
    showClientLink={showClientLink}
    className={viewerIsPractitioner ? "order-1 md:order-2" : "order-2"}
  />
</div>
```

Wait — `BookingDetailSidebar` currently doesn't accept a `className` prop. Plan needs to extend its signature OR wrap it in a `<div>` carrying the order class.

**Recommended pattern (plan locks):** wrap the sidebar in a `<div>` carrying the order class:

```tsx
<div className={viewerIsPractitioner ? "order-1 md:order-2" : "order-2"}>
  <BookingDetailSidebar … />
</div>
```

This avoids modifying the sidebar's interface.

**Result at mobile (375):**
- Practitioner view: sidebar (client + address + maps) FIRST, main panels second.
- Admin-curator view: main panels first (unchanged).

At `md` and above: sidebar is column 2 (sticky) regardless. The reorder only applies in single-column mobile layout.

### 2.3 PractitionerTodaySection drop-in component (change 3)

**New file `src/app/admin/dashboard/PractitionerTodaySection.tsx`** — extract today + next-appointment rendering from TherapistDashboard's existing logic and parameterise:

```tsx
interface PractitionerTodaySectionProps {
  // Capability-keyed: parent must check profile.can_take_bookings before rendering
  staffName: string;
  todayAppointments: ReportData["bookings"];
  nextAppointment: ReportData["bookings"][number] | null;
  // Optional claimable section — null hides it
  claimableCount?: number;
  // Mobile tip rendering (e.g., "Pull down to refresh") — opt-in per variant
  showMobileTip?: boolean;
}

export function PractitionerTodaySection(props: PractitionerTodaySectionProps): JSX.Element {
  // Layout: hero "Next visit at HH:MM" card with client name + service + address +
  //         tel: + maps CTA + Mark complete shortcut. Followed by today list.
}
```

Inside the component:
- **"Next visit" hero card** — large card with the next upcoming appointment for this practitioner. Includes:
  - Service + time
  - Client name (link to client profile if RBAC permits)
  - Address (street + postcode + area)
  - `tel:` link with phone (same pattern as `BookingDetailSidebar.tsx:142-147`)
  - "Open in Maps" CTA (same pattern as `BookingDetailSidebar.tsx:278-288`)
  - "Mark complete" button — only enabled when current time ≥ start_time
- **"Today's visits" list** — remaining today appointments below the hero.
- **Empty state** — narrative copy lifted from TherapistDashboard's empty-state pattern (per R05 PE-1).
- **Claimable section** — optional. When `claimableCount > 0`, renders "Open to claim ({N}) → Browse claimable work" link.

The component takes data via props (server-side fetched) and renders fully client-side hydration-safe (no useEffect timers; everything derived from props).

### 2.4 Mount the section in all 3 variants (change 4)

In `src/app/admin/dashboard/page.tsx`:

**Therapist variant** (already heavy — `TherapistDashboard.tsx` renders today + next appointment). **Refactor TherapistDashboard to consume `PractitionerTodaySection`** in place of the current inline logic. This is the canonical mount.

**Business variant** (Owner + Admin currently — the inline branch in `page.tsx`). After the existing tile grid + headline strips, render:

```tsx
{profile.can_take_bookings && (todayAppointments.length > 0 || nextAppointment) ? (
  <PractitionerTodaySection
    staffName={profile.name}
    todayAppointments={todayAppointments}
    nextAppointment={nextAppointment}
    claimableCount={claimableCount}
  />
) : null}
```

Position: above the "Recent Activity" panel (so practitioner-mode Owner sees their own work prominently).

**Coordinator variant** — similar pattern. Coordinators don't typically take bookings, but if a specific Coord has `can_take_bookings=true`, the section renders.

**Data fetch:** the dashboard page already computes `todayAppointments` + `nextAppointment` in the `variant === 'therapist'` branch. Extend the fetch to compute these for `profile.can_take_bookings` users regardless of variant. Add to `dashboard-data.ts` if a new query is needed.

### 2.5 Vitest specs

- `isViewerAssignedPractitioner` — predicate matrix coverage (true, false cases).
- `PractitionerTodaySection` — renders next-visit hero correctly, falls back to empty-state when no appointments, omits claimable section when count is 0.
- Booking detail page — assertion that `viewerIsPractitioner` derives correctly. (Probably via the existing page-level tests.)

---

## 3 — RBAC matrix (C-FIELDWORK behaviour × roles)

| Action / View | Owner (no can_take_bookings) | Owner (can_take_bookings) | Therapist | Coordinator (no can_take_bookings) | Coordinator (can_take_bookings) |
|---|---|---|---|---|---|
| Booking detail — admin-curator view | ✅ default | ✅ when NOT assigned to this booking | ❌ Therapist view only | ✅ default | ✅ when NOT assigned to this booking |
| Booking detail — practitioner view (mobile reorder) | n/a | ✅ when assigned | ✅ when assigned | n/a | ✅ when assigned |
| Dashboard — PractitionerTodaySection | ❌ not rendered | ✅ rendered | ✅ (existing TherapistDashboard logic) | ❌ not rendered | ✅ rendered |
| `tel:` + maps CTA in sidebar | ✅ (existing) | ✅ (existing) | ✅ (existing) | ✅ (existing) | ✅ (existing) |

No new permissions. No RBAC matrix changes. Pure capability-key + UI dual-view.

---

## 4 — Layout strategy

### 4.1 Booking detail mobile reorder (practitioner view)

**Before (Therapist at 375 — current):**

```
┌─────────────────────────────────────┐
│ Header — "#DA6912D5"                │
│ Next-action strip                   │
│ ─────────────────────────────────── │
│ Status & payment form               │ ← admin focus, not relevant
│ ─────────────────────────────────── │
│ Booking notes                       │
│ ─────────────────────────────────── │
│ Participants                        │
│ ─────────────────────────────────── │
│ Assignment (claim/complete buttons) │
│ ─────────────────────────────────── │
│ Email activity                      │
│ ─────────────────────────────────── │
│ Audit log                           │
│ ─────────────────────────────────── │
│ ╔═════════════════════════════════╗ │ ← what the therapist actually needs
│ ║ Summary (date · time · price)   ║ │
│ ║ ─────────────────────────────── ║ │
│ ║ Client name                     ║ │
│ ║ 📞 07700 900 456                ║ │
│ ║ ✉️  sarah@example.com           ║ │
│ ║ ─────────────────────────────── ║ │
│ ║ 123 Main St                     ║ │
│ ║ LU1 1AA                         ║ │
│ ║ [ View on Maps ]                ║ │
│ ╚═════════════════════════════════╝ │
└─────────────────────────────────────┘
```

**After (practitioner view at 375):**

```
┌─────────────────────────────────────┐
│ Header — "#DA6912D5"                │
│ Next-action strip                   │
│ ─────────────────────────────────── │
│ ╔═════════════════════════════════╗ │ ← above the fold, on first scroll
│ ║ Summary (date · time · price)   ║ │
│ ║ ─────────────────────────────── ║ │
│ ║ Client name                     ║ │
│ ║ 📞 07700 900 456 (tap to call) ║ │
│ ║ ✉️  sarah@example.com           ║ │
│ ║ ─────────────────────────────── ║ │
│ ║ 123 Main St                     ║ │
│ ║ LU1 1AA                         ║ │
│ ║ [ View on Maps ]                ║ │
│ ╚═════════════════════════════════╝ │
│ ─────────────────────────────────── │
│ Status & payment (limited fields)   │ ← still visible if scrolled
│ ─────────────────────────────────── │
│ Booking notes                       │
│ ─────────────────────────────────── │
│ Participants                        │
│ ─────────────────────────────────── │
│ Assignment (Mark complete prominent)│
│ ─────────────────────────────────── │
│ Email activity                      │
│ ─────────────────────────────────── │
│ Audit log                           │
└─────────────────────────────────────┘
```

At `md+`: layout unchanged — 2-column grid with main + sidebar. The reorder only applies in single-column mobile.

### 4.2 Dashboard — `PractitionerTodaySection`

For a practitioner with one appointment today and one tomorrow:

```
┌─────────────────────────────────────────┐
│ Good morning, Sara.                     │ ← shared getGreeting()
│ Thursday, 26 May.                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Your next visit · in 1h 12m             │ ← hero card
│                                          │
│ 11:00 · Hijama Package · 1h             │
│ Fatima Ahmed                            │
│ 📞 07700 900 456                        │
│ 12 Park Lane, Luton LU1 3AA            │
│                                          │
│ [ Open in Maps ]  [ Mark complete ]    │ ← Mark complete enabled at start_time
└─────────────────────────────────────────┘

Today's visits (1 more)
┌─────────────────────────────────────────┐
│ 14:00 · Massage Therapy · 1h           │
│ Mahmoud Hassan · Bury Park             │
└─────────────────────────────────────────┘

Open to claim — 2 available
[ Browse claimable work → ]
```

For a practitioner with no appointments today:

```
┌─────────────────────────────────────────┐
│ Good morning, Sara.                     │
│ Thursday, 26 May.                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Nothing scheduled today.                │
│ Quiet day. Take care of yourself.      │ ← R05 PE-1 lifted copy
│                                          │
│ Open to claim — 1 available             │
│ [ Browse claimable work → ]            │
└─────────────────────────────────────────┘
```

For a practitioner with no work at all:

```
┌─────────────────────────────────────────┐
│ Nothing scheduled today.                │
│ No claimable work right now either.    │
└─────────────────────────────────────────┘
```

### 4.3 Empty state in Business / Coord variants

When a practitioner-mode Owner has NO assigned appointments and NO claimable work, the section is **omitted** (rather than rendering an empty card). The variant's other content (KPI tiles, recent activity) carries the dashboard. Avoids visual noise.

This is the conditional in the variant rendering:

```tsx
{profile.can_take_bookings && (todayAppointments.length > 0 || nextAppointment || claimableCount > 0) ? (
  <PractitionerTodaySection ... />
) : null}
```

For TherapistDashboard, the existing "Quiet day. Take care of yourself." rendering covers the truly-empty case (per R05 PE-1). C-FIELDWORK preserves that pattern.

---

## 5 — States & edge cases

### 5.1 Owner is `can_take_bookings=true` but has no assignments

The dashboard renders the standard Business variant; `PractitionerTodaySection` is omitted (per §4.3 condition). When the Owner gets their first assignment, the section appears automatically on next page load.

### 5.2 Practitioner viewing a booking detail they're NOT assigned to

E.g., Coordinator (with `can_take_bookings=true` and an assignment elsewhere) reviewing a different booking they're triaging. The predicate returns false → admin-curator view. No mobile reorder.

### 5.3 Practitioner viewing a booking detail they WERE assigned to but the assignment was reassigned away

The predicate checks `status !== 'unassigned' && status !== 'cancelled'`. A reassigned-away assignment has the new staff_id (not the viewer's). Predicate returns false. Admin-curator view.

### 5.4 Booking is cancelled but practitioner was previously assigned

Per C-05 brief §3 + plan §1 Step 2b — `canOpenBookingRecord` preserves access for `isOwnBooking`. The practitioner can still view the detail page. But the C-05 lockdown removes all action buttons. The mobile reorder still applies (the practitioner needs the client phone to communicate about the cancellation if relevant). Confirmed: C-FIELDWORK's reorder is orthogonal to C-05's action gating.

### 5.5 Practitioner has 5+ appointments today

`PractitionerTodaySection` renders the next-visit hero + the remaining today list. If the today list is long, the component caps at first 5 visits + "View all today's visits →" link routing to `/admin/bookings?view=today`. Plan locks this cap.

### 5.6 Practitioner's phone is null on the client record

`tel:` link doesn't render (existing logic). Email link still renders. Address card still renders. Pattern matches `BookingDetailSidebar.tsx:140-148`.

### 5.7 Server-side render: greeting timezone

`getGreeting()` uses `Intl.DateTimeFormat` with `timeZone: 'Europe/London'`. Server-rendering in a different timezone returns the London-time greeting. Acceptable.

### 5.8 Hydration mismatch on "Your next visit · in 1h 12m"

The "in 1h 12m" relative-time string depends on `Date.now()`. Server-side render may show "in 1h 12m"; client-side hydration 200ms later shows "in 1h 11m". React 19 hydration generally tolerates this as innerText diff but may log a warning. **Mitigation:** render relative time client-side only (via small client component for that text node) OR use a coarse-grained "in 1 hour" (rounded) that's hydration-stable for a few minutes.

Plan locks: **client-side relative time** wrapped in a small client component. Initial SSR renders just "Your next visit" without the duration; client component fills in "· in 1h 12m" on mount.

### 5.9 Mark complete button on the hero card

When `current_time < start_time`, the button reads "Mark complete" but is disabled with tooltip "Available at 11:00". When `current_time >= start_time`, button is enabled. Mirrors C-04a's no_show button temporal guard pattern.

---

## 6 — Migration footprint

**None.** C-FIELDWORK is pure code:
- New helper module + new component
- Booking detail page render branching
- Dashboard page render branching

No schema changes. No new permissions. `staff_profiles.can_take_bookings` already exists and is populated.

---

## 7 — Files touched (preview — full list in plan)

### NEW (3 files)
- `src/app/admin/dashboard/shared-helpers.ts` — lifted utils + new predicate
- `src/app/admin/dashboard/PractitionerTodaySection.tsx` — drop-in component
- `src/app/admin/dashboard/__tests__/PractitionerTodaySection.test.tsx` — vitest coverage
- (and) `src/app/admin/dashboard/__tests__/isViewerAssignedPractitioner.test.ts` — predicate tests

### EDITED (~5 files)
- `src/app/admin/dashboard/TherapistDashboard.tsx` — refactor today + next-appointment rendering to consume `PractitionerTodaySection`; re-export helpers from `shared-helpers.ts` for backward compat
- `src/app/admin/dashboard/page.tsx` — mount `PractitionerTodaySection` in Business + Coord variants conditionally; extend data fetch if needed
- `src/app/admin/dashboard/dashboard-data.ts` — (if needed) extend the data shape to surface `todayAppointments` + `nextAppointment` + `claimableCount` for non-Therapist variants
- `src/app/admin/bookings/[bookingId]/page.tsx` — derive `viewerIsPractitioner`; wrap grid children with order classes conditionally
- `src/app/admin/dashboard/__tests__/...` — extend existing dashboard tests

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix.
- `BookingDetailSidebar.tsx` — no signature change; the reorder lives in the parent grid via wrapping `<div>` (per §2.2).
- C-04a / C-05 / C-06 modifications — orthogonal.

---

## 8 — Sequencing and dependencies

**No hard dependencies.** C-FIELDWORK ships independently. But:

- **C-11 consumes `PractitionerTodaySection`** during the dashboard-variant-extraction work (Business / Coordinator separate files). C-FIELDWORK's drop-in design is intentional — C-11 just imports and mounts. Decisions doc §4 + Q11 confirm.
- **C-05 lockdown is orthogonal** — the booking detail mobile reorder applies to cancelled bookings too (per §5.4). The practitioner can still see client phone for follow-up communication; action buttons are gated by C-05.
- **C-04a auto-promote** — the "Mark complete" hero button uses the existing `quickUpdateBooking` action; no new server action. Auto-promote logic in C-04a means the practitioner's hero "Mark complete" might trigger the booking-level auto-promote if it terminalises the last assignment. Cross-plan synergy.
- **Per-role default tab on `/admin/bookings`** (B-167) — deferred to C-07. C-FIELDWORK doesn't change `/admin/bookings` default tab.

**Recommended sequencing in C-C:** C-FIELDWORK can ship anywhere in C-C order; doesn't gate or get gated by other plans. The recommended C-B order put it after C-01 (plan-writing-only ordering — doesn't bind C-C ship order).

---

## 9 — Open questions

**Q9.1 — `PractitionerTodaySection` scope: today-only or today + tomorrow?**

Locked: **today + next visit** (which may be later today OR tomorrow). The R04 finding (B-165) was specifically "no Next visit widget". Adding tomorrow's preview is the natural extension. Cap at 1 + remaining today list (per §5.5).

**Q9.2 — Should the booking-detail mobile reorder apply when an `assigned-but-completed` practitioner views the booking?**

A practitioner who completed an assignment days ago opens the booking detail for reference. Predicate: `status === 'completed'` — currently rejected by `isViewerAssignedPractitioner` (per §1.1 — the predicate excludes 'completed' status assignments). **Locked decision:** keep them excluded. They've finished; admin-curator view is appropriate for retrospective viewing. Counter-argument: they may need the client phone to follow up. Mitigation: the sidebar (with phone + maps) is still accessible — just below the main panels. Acceptable trade-off.

**Alternative considered:** treat 'completed' assignments as still-practitioner-view-eligible. Rejected — bloats the "active visit" framing.

**Q9.3 — Pull-to-refresh on Business / Coord variants?**

Locked: **no**. TherapistDashboard's pull-to-refresh + mobile-gesture tip are appropriate for the worker-on-the-road context. Owner/Admin/Coord doing admin work shouldn't have a pull-to-refresh gesture (could conflict with browser navigation). C-12+ if requested.

**Q9.4 — `claimableCount` for practitioner-mode Owner: scoped to gender match or global?**

Locked: **gender-matched, same as Therapist logic**. Owner with `can_take_bookings=true` claiming a slot must match the gender filter same as anyone else. `claimableCount` uses the existing `getScopedBookingIds` logic per `bookings/page.tsx:107-133`.

**Q9.5 — Mark complete button on the hero card or just a link to the booking?**

Locked: **inline Mark complete button** with the same temporal guard as C-04a's no_show button (current_time ≥ start_time). One tap. Mirror the "next-action-strip" CTA pattern from C-04a (the Restore button design).

**Q9.6 — `getGreeting` rendered server-side: stale-cache risk?**

`getGreeting` uses `Date()` which is server-time at SSR. If the page is cached for 10 minutes around 12:00 boundary, "Good morning" stays cached when it should now read "Good afternoon". **Mitigation:** the dashboard route is dynamic (no static caching). And the variance is cosmetic. Acceptable.

If cosmetic correctness matters: wrap the greeting in a small client component that re-renders on mount. Out of scope unless requested.

**Q9.7 — Component name `PractitionerTodaySection` — too long?**

Locked: as named. The "Today" disambiguates from a generic "PractitionerSection". The "Section" suffix clarifies it's a dashboard primitive. Acceptable.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-FIELDWORK implementation is complete when:

1. **Predicate function `isViewerAssignedPractitioner` exists** in `shared-helpers.ts` with vitest coverage.
2. **Booking detail mobile reorder** — verified at 375 px: practitioner view shows sidebar above main panels; admin-curator view shows main panels first. Verified for all 4 roles (Owner with/without bookings, Therapist with assignment, Coord with/without bookings).
3. **`PractitionerTodaySection` renders** in Business + Coord + Therapist dashboard variants when `can_take_bookings=true` AND there's data to show.
4. **Hero "Next visit" card** shows time + service + client name + phone (with `tel:`) + address + maps CTA + Mark complete button.
5. **Today's visits list** caps at 5 + "View all" link.
6. **Empty state** — copy from R05 PE-1 lifted ("Nothing scheduled. Quiet day. Take care of yourself.").
7. **Mark complete temporal guard** — disabled before start_time, enabled at/after.
8. **`getGreeting` + maps + tel:** primitives confirmed working (already existed; lift confirms no regression).
9. **No regressions** on TherapistDashboard — existing "Welcome, complete your profile" + "Need help?" + Personal Stripe + claimable section all render identically post-refactor.
10. **Static gates pass** — lint, tsc, vitest, build, bundle delta within budget.
11. **Playwright role sweep at 375 / 768 / 1280 / 1440** passes for all 4 roles.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q10 + §3 C-FIELDWORK-EXPERIENCE | Capability-keyed framing + drop-in component design |
| `R04-therapist-day.md` §3 B-164 | Mobile sidebar buries client info (the headline gap) |
| `R04-therapist-day.md` §3 B-165 | No next-visit widget on dashboard |
| `R05-therapist-fresh-day.md` §1 + §4 PE-1 | Empty-state copy pattern to lift |
| `04-bookings-detail-audit.md` §2 V-13 | Confirms the sidebar-order issue in code |
| `bookings/[bookingId]/page.tsx:467` | Parent grid where order classes apply |
| `BookingDetailSidebar.tsx:142-147` | Existing `tel:` link pattern |
| `BookingDetailSidebar.tsx:278-288` | Existing maps CTA pattern |
| `TherapistDashboard.tsx:89-130` | `getGreeting`, `buildAddressLines`, `buildMapsHref` to extract |
| `TherapistDashboard.tsx:1361` | Existing export of shared helpers |
| `rbac.ts:100-106` | `canClaimAssignments` checks `can_take_bookings` — confirms capability-keyed precedent |

---

## 12 — Out of scope (explicit non-goals)

- **Offline cache / PWA / native app / push notifications / real-time location sharing** — per decisions doc Q10 explicit out-of-scope.
- **`/admin/me` Open in maps affordance** — separate surface. C-FIELDWORK adds maps to the dashboard's PractitionerTodaySection, not to `/admin/me`. C-12+ if requested.
- **Default `/admin/bookings` tab for practitioners** (B-167) — routing concern, C-07.
- **Session-note draft persistence** (B-169) — C-12+ per R04 disposition.
- **Voice-to-text on session notes** (R04 §2 friction) — speculative; out of scope.
- **Mobile-sticky action bar on booking detail** — the existing `min-h-11` tap targets are sufficient. A separate sticky bar would conflict with the sidebar reorder. C-12+ if needed.
- **Pull-to-refresh on Business / Coord variants** — Q9.3.
- **Per-variant time-of-day greeting copy variations** — locked at universal `getGreeting()`. Variant-specific (e.g., "Good morning, Owner") is C-12+.
- **Practitioner-mode Owner sees a stripped-down dashboard** — out of scope. The Business variant continues to render its full content; the new section is additive.
- **"Recently restored" badge on detail** (W04 V-1) — defer to C-12+.

---

*End of C-FIELDWORK brief. Plan file follows: `redesign/plans/C-phase/C-FIELDWORK-EXPERIENCE-plan.md`.*
