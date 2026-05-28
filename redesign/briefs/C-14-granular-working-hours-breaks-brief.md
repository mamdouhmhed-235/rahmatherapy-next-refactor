# C-14 — Granular working hours (breaks) + customer booking-window date guard

**Type:** Band C plan-writing brief (post-C-B amendment, 2026-05-26)
**Date written:** 2026-05-26
**Predecessors:**
- User direction 2026-05-26 — working hours should support breaks (open / break / break / close) across all days going forward, for global + per-staff + per-date overrides; customer date picker should disable dates beyond the booking window.
- `redesign/audits/C-A/15-availability-global-audit.md` (availability surface)
- `redesign/audits/C-A/12-staff-availability-audit.md` (per-staff availability)
- `src/lib/booking/availability.ts` (slot engine — already multi-window)

**Companion files:**
- Plan: `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md`
- Progress: `redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-14 makes the clinic's working hours **granular** — each working day (and each custom override date) can carry an open time, a close time, and **one or more breaks** in between (e.g., opens 08:00, break 12:30–15:00, break 17:00–17:30, closes 20:00). It also fixes a **customer-facing booking-window bug**: the public date picker lets customers click dates beyond the configured advance-booking window even though the server rejects them.

Five surfaces, **4 phases (A–D)**:

1. **Global recurring breaks** — the clinic-wide "Working hours" section (`availability_rules`). Per-day editor: Opens / Break(s) / Closes with "+ Add break". Affects all days going forward.
2. **Per-staff recurring breaks** — `staff_availability_rules`. Same editor on the staff availability page. Rides the existing `use_global` / `custom` mode toggle — staff on global inherit global breaks; staff on custom set their own.
3. **Override breaks** — per-date custom hours (`availability_overrides` global + `staff_availability_overrides` staff) gain breaks too.
4. **Customer date-picker window guard** — the public `DatePickerField` disables dates beyond `booking_window_days` (and before the `minimum_notice_hours` floor), matching the server's existing `isDateInBusinessWindow` enforcement so out-of-window dates are no longer clickable.

**Storage model: segments (no new tables).** A break is the *gap between two bookable segments*. A day with one break = two rows in the existing rules table. Verified: the recurring tables have **no day-uniqueness constraint** (multiple rows per day already allowed), and the slot engine **already handles multiple windows per day** (`getRuleWindowsForDay` → `containsWindow`). So Phases A+B need **zero schema change and zero slot-engine change**. The UI presents Opens/Breaks/Closes and converts to/from segments on save/load.

**Migration:** only Phase C — drop the `availability_overrides_override_date_key` unique index (+ verify/drop the staff-override equivalent) so a date can hold multiple windows. Phases A, B, D: no migration.

**Customer-facing rule:** breaks are **hidden** from customers — they simply see no slots across a break (falls out of the slot engine automatically). No "we're on break" label.

**Sequencing:** independent of the other 13 plans. Touches `availability.ts` (RECON-sensitive slot engine) only in Phase C (contained: global override fetch widens from single-row to multi-row). Phase D (picker) is independent + the most visible customer win — can ship first.

---

## 1 — Why this plan exists

### 1.1 Working hours are a single block per day — no breaks (HEADLINE)

`availability_rules` stores one row per weekday: `day_of_week, start_time, end_time, is_working_day`. The "Working hours" editor (`AvailabilityRulesManager.tsx`) is one Opens/Closes pair per day. A clinic that closes for lunch (or has a mid-afternoon gap) can't express it — they'd have to either accept bookings through lunch or close the whole afternoon. The user wants: opens 08:00, break 12:30–15:00, closes 20:00, **plus the freedom to add more breaks**.

This is the recurring clinic-wide schedule (all days going forward), distinct from the per-specific-date "Hour adjustments" override section that already exists.

### 1.2 Per-staff schedules have the same limitation

`staff_availability_rules` mirrors the global shape (one block per day). A therapist who works evenings with a prayer-time gap, or a part-timer with a split shift, can't express breaks either. The staff availability page already has a `use_global` / `custom` mode toggle (`AvailabilityModeSelector.tsx`): on global they follow the clinic hours; on custom they set their own. Per user direction, custom staff hours should support breaks the same way the global hours do.

### 1.3 Per-date overrides have the same limitation

`availability_overrides` (global) + `staff_availability_overrides` (staff) set different hours for a specific date — but each is a single window. Per user direction, a specific date should also be able to carry a break (e.g., "this Saturday we open but close 1–2pm").

### 1.4 Customers can click dates beyond the booking window

`DatePickerField.tsx:26` uses `disabled={{ before: today }}` — it greys out past dates but has **no upper bound**. The server already enforces the window (`calculateAvailableSlots` → `isDateInBusinessWindow`, returning "Date is outside the booking window" for anything past `booking_window_days`), so a customer who clicks a too-far date just gets an empty result. The user wants those dates **non-clickable** so customers only ever interact with genuinely bookable dates. The `minimum_notice_hours` setting has the symmetric gap at the lower bound (today stays clickable even if a minimum notice rules it out).

---

## 2 — Scope

C-14 ships across **4 phases**. Phases A–C share one storage model + one UI editor component. Phase D is independent.

### 2.1 The storage model — segments (shared by Phases A–C)

A **break is the gap between two bookable segments**. The existing rules/override tables store segments directly; no new tables, no break columns.

- **Working day with no breaks** → 1 row (exactly like today): `[opens, closes]`, `is_working_day=true`.
- **Working day with breaks** → N rows, one per bookable segment, all `is_working_day=true`:
  - opens 08:00, break 12:30–15:00, closes 20:00 → two rows: `[08:00, 12:30]` + `[15:00, 20:00]`.
  - add break 17:00–17:30 → three rows: `[08:00, 12:30]` + `[15:00, 17:00]` + `[17:30, 20:00]`.
- **Closed day** → 1 row, `is_working_day=false` (preserves the last-used hours so toggling back on restores them; the slot engine ignores `is_working_day=false` rows).

**Why this works with zero engine change (recurring):** verified in `availability.ts` —
- `getRuleWindowsForDay` filters rows by `day_of_week` + `is_working_day` and returns an **array** of windows.
- `containsWindow` books a slot only if it fits inside **one** window.
- A 12:00–13:00 slot against `[08:00–12:30]` + `[15:00–20:00]` fits neither → not bookable. The break behaviour falls out for free.

**Verified constraints:** `availability_rules` and `staff_availability_rules` have **only a PK on `id`** — no unique on `(day_of_week)` / `(staff_id, day_of_week)`. Multiple rows per day are already permitted. **No migration for Phases A–B.**

### 2.2 The shared editor — `WorkingHoursDayEditor` + conversion helper

**New helper `src/lib/booking/working-hours-segments.ts`:**

```ts
export interface DaySchedule {
  isWorkingDay: boolean;
  opens: string;        // "08:00"
  closes: string;       // "20:00"
  breaks: Array<{ start: string; end: string }>;  // sorted, non-overlapping
}

// Storage rows (segments) -> editor schedule
export function rowsToSchedule(rows: Array<{ start_time: string; end_time: string; is_working_day: boolean }>): DaySchedule;

// Editor schedule -> storage rows (segments)
export function scheduleToRows(s: DaySchedule): Array<{ start_time: string; end_time: string; is_working_day: boolean }>;

// Validation: breaks inside [opens,closes], non-overlapping, opens<closes,
// each resulting segment > 0; returns structured errors + warnings (tiny-segment warn)
export function validateSchedule(s: DaySchedule): { errors: string[]; warnings: string[] };
```

`rowsToSchedule`: gather a day's rows → if none `is_working_day` → closed; else sort by start, `opens = first.start`, `closes = last.end`, `breaks = gaps between consecutive segments`.
`scheduleToRows`: closed → one `is_working_day=false` row; else build `[opens, b1.start], [b1.end, b2.start], …, [bN.end, closes]` → one `is_working_day=true` row each.

**New component `src/app/admin/availability/WorkingHoursDayEditor.tsx`** — the Opens / Break(s) / Closes editor for one day (see §4.1 mockup). Reused by global recurring (Phase A), per-staff recurring (Phase B), and overrides (Phase C). Pure presentational; parent owns state + save.

### 2.3 Phase A — Global recurring breaks (`availability_rules`)

- `AvailabilityRulesManager.tsx`: each `DayRow` becomes the `WorkingHoursDayEditor` (open + breaks + close + "+ Add break"). `buildInitialState` switches from `.find(day)` to `rowsToSchedule(rows.filter(day))`.
- Save action (`availability/actions.ts`): `saveAvailabilityRule` (one-row upsert) becomes `saveAvailabilityDay` — **delete the day's rows + insert the segment rows in a transaction** (or an RPC for atomicity). Same for the "Copy Monday to Tue–Sat" helper (copies the whole schedule incl. breaks).
- No schema change. No slot-engine change.

### 2.4 Phase B — Per-staff recurring breaks (`staff_availability_rules`)

- `StaffAvailabilityRulesForm.tsx`: same `WorkingHoursDayEditor` integration.
- Staff save action: same delete-day + insert-segments pattern on `staff_availability_rules`.
- The `use_global` / `custom` mode toggle (`AvailabilityModeSelector`) is unchanged — it already selects which rule set applies. Staff on `custom` get the breaks editor; staff on `use_global` inherit the global schedule (incl. breaks) via the slot engine's existing global-fallback path.
- No schema change. No slot-engine change (`resolveStaffWindows` already consumes `staff_availability_rules` windows; multiple rows per day flow through the same array logic — verify during impl).

### 2.5 Phase C — Override breaks (`availability_overrides` + `staff_availability_overrides`)

This phase has the only schema + slot-engine changes.

- **Schema (Zone-2 migration):**
  - Drop `availability_overrides_override_date_key` (the unique on `override_date`) so a date can hold multiple windows.
  - Verify + drop the `staff_availability_overrides` `(staff_id, override_date)` unique constraint if present (staff overrides already fetch as an array, but per-staff-per-date is likely unique today).
- **Slot engine (`availability.ts`):**
  - The **global** override fetch (`:488-492`) uses `.maybeSingle()` (assumes one override per date). Widen to `.returns<DateOverrideRecord[]>()` and feed the rows through `normalizeWindows` so override breaks subtract correctly.
  - The **staff** override fetch (`:504-509`) already returns an array; verify `resolveStaffWindows` treats multiple rows for one staff+date as multiple windows (it likely takes one — needs a small change to normalize all rows for that staff+date).
  - `override_type` (staff overrides) — only `custom-hours` overrides get segments/breaks; `blocked`/`closed` overrides stay full-day closures (no breaks). Global overrides have no `override_type` (blocking is done via `blocked_dates`), so all global override rows are custom-hours windows.
- **UI:** `AvailabilityOverridesManager.tsx` + `StaffAvailabilityOverridesManager.tsx` gain the `WorkingHoursDayEditor` for the override's hours. Save → delete-date's-rows + insert-segments.

### 2.6 Phase D — Customer booking-window date guard (independent)

- **`DatePickerField.tsx`:** add an upper + notice-aware lower bound to the `disabled` matcher:
  ```tsx
  disabled={{ before: earliestBookable, after: latestBookable }}
  ```
- **New shared helper `src/lib/booking/date-bounds.ts`:**
  ```ts
  export function getBookingDateBounds(opts: {
    now: Date;
    bookingWindowDays: number;
    minimumNoticeHours: number;
  }): { earliest: Date; latest: Date };  // both in Europe/London, start-of-day
  ```
  `latest = startOfLondonDay(now) + bookingWindowDays`. `earliest = startOfLondonDay(now + minimumNoticeHours)` (so a 24h+ notice pushes the first clickable day forward).
- **The server's `isDateInBusinessWindow` is refactored to derive from the same helper** so the picker's clickable range and the server's accepted range can't drift (an inclusive/exclusive or timezone mismatch would let a date be clickable-but-rejected).
- **Thread `booking_window_days` + `minimum_notice_hours`** from `business_settings` into the booking-experience client tree (the schedule step already references the window — short prop chain).
- **Admin manual-booking picker is NOT bounded** — admins book any date (phone bookings, special cases). Phase D is customer-flow only.

---

## 3 — RBAC / scope matrix

C-14 introduces no new permissions.

| Surface | Who edits | Notes |
|---|---|---|
| Global working hours + breaks | Owner / Admin (existing `/admin/availability` gate) | Affects all days going forward |
| Per-staff hours + breaks (custom mode) | Owner / Admin; staff self-view per existing staff-availability RBAC | Rides existing `use_global`/`custom` toggle |
| Override breaks (global + staff) | Same as the existing override managers | Per-date |
| Customer date-picker guard | n/a (customer-facing) | Read-only consumption of `booking_window_days` + `minimum_notice_hours` |

---

## 4 — Layout strategy

### 4.1 The per-day editor (Phases A–C, shared component)

```
┌─ Monday ───────────────────────────────────── [● open] ─┐
│                                                           │
│   Opens          [ 08:00 ]                                │
│                                                           │
│   Break 1        [ 12:30 ] – [ 15:00 ]       [ Remove ]   │
│   Break 2        [ 17:00 ] – [ 17:30 ]       [ Remove ]   │
│                  [ + Add break ]                          │
│                                                           │
│   Closes         [ 20:00 ]                                │
│                                                           │
│   Bookable:  08:00–12:30 · 15:00–17:00 · 17:30–20:00      │
└───────────────────────────────────────────────────────────┘
```

- "+ Add break" appends a break row; each break has a Remove. Unlimited breaks.
- A live "Bookable:" line shows the resulting segments so the editor sees exactly what customers can book.
- Toggle off → collapses to "Closed" (same animation as today's `DayRow`).
- "Copy Monday to Tue–Sat" copies the full schedule incl. breaks.
- 375 mobile: break rows stack; start/end times wrap; touch targets ≥ 44px.

### 4.2 Validation surface

- Inline error under a break when it falls outside [opens, closes] or overlaps another break.
- Inline error when opens ≥ closes.
- Soft **warning** (not blocking) on a sub-30-min bookable segment between two breaks ("This 15-minute gap is too short for most services to book.").
- Save blocked only on hard errors.

### 4.3 Customer date picker (Phase D)

```
Before:  every future date clickable (server then rejects out-of-window)
After:   dates after [today + booking_window_days] greyed out + unclickable;
         dates before the minimum-notice floor greyed out + unclickable.
```

No "break" markers on the customer side — break gaps simply yield no time slots in the existing slot list.

---

## 5 — States & edge cases

### 5.1 Existing single-window days are already valid

A day with no breaks is one `is_working_day=true` row — identical to today's storage. **No data migration for Phases A–B.** `rowsToSchedule` of a single row → `{ opens, closes, breaks: [] }`.

### 5.2 Closed day round-trip

Toggle off → `scheduleToRows` writes one `is_working_day=false` row carrying the last opens/closes. Toggle back on → those hours restore. The slot engine ignores `is_working_day=false` rows (existing filter).

### 5.3 Booking sitting inside what becomes a break

Breaks are forward-looking defaults. An existing booking already scheduled in a newly-created break window **stays put** (the slot engine only governs *new* slot offers). Flag in the editor: "Existing bookings in this window aren't affected."

### 5.4 Tiny segment between two breaks

Allowed but warned (§4.2). The slot engine simply won't offer slots that don't fit — a 15-min segment yields no 60-min-service slots, which is correct.

### 5.5 Staff on `use_global` with global breaks

They inherit the global schedule including breaks. No staff rows needed. Switching to `custom` seeds the editor from their last custom rows (or a sensible default).

### 5.6 Override breaks vs blocked dates

A `blocked`/`closed` override (staff `override_type`) or a `blocked_dates` row is a full-day closure — no breaks. Breaks only apply to custom-hours override rows. The override UI hides the breaks editor for blocking-type overrides.

### 5.7 Picker upper bound vs server window (Phase D)

The picker's `latest` and the server's accepted range **must** be identical. Both derive from `getBookingDateBounds` — single source. Off-by-one risk (inclusive vs exclusive day count, timezone) is eliminated by sharing the helper. A QA case asserts: the last clickable date == the last date the slots API accepts.

### 5.8 Minimum notice pushes the earliest day (Phase D)

If `minimum_notice_hours = 36`, "today" and possibly "tomorrow morning" are unbookable. `earliest = startOfLondonDay(now + 36h)`. The picker disables earlier days. (Same-day partial-notice nuance — where today is bookable for evening slots but not morning — is still handled by the server slot filter; the picker uses the conservative day-level floor.)

### 5.9 DST / Europe/London boundaries (Phase D)

`getBookingDateBounds` computes in Europe/London (via `src/lib/time/london.ts`) so the picker and server agree across BST/GMT transitions.

---

## 6 — Migration footprint

| Phase | Migration |
|---|---|
| A — global recurring | **None** (no day-uniqueness constraint; multiple rows already allowed) |
| B — per-staff recurring | **None** |
| C — overrides | **Zone-2:** `DROP INDEX availability_overrides_override_date_key`; verify + drop `staff_availability_overrides` `(staff_id, override_date)` unique if present |
| D — picker | **None** (client + shared helper only) |

No new tables. No new columns. No new permissions.

---

## 7 — Files touched (preview — full list in plan)

### NEW
- `src/lib/booking/working-hours-segments.ts` — `rowsToSchedule` / `scheduleToRows` / `validateSchedule` + tests
- `src/lib/booking/date-bounds.ts` — `getBookingDateBounds` (shared by picker + server) + tests
- `src/app/admin/availability/WorkingHoursDayEditor.tsx` — shared Opens/Breaks/Closes editor
- `supabase/migrations/<ts>_c14_override_breaks.sql` — Phase C unique-index drops

### EDITED
- `src/app/admin/availability/AvailabilityRulesManager.tsx` — multi-segment editor (Phase A)
- `src/app/admin/availability/actions.ts` — `saveAvailabilityDay` (delete+insert segments, transactional)
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityRulesForm.tsx` — Phase B editor
- staff availability save action — Phase B segments save
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` + `StaffAvailabilityOverridesManager.tsx` — Phase C override editor
- `src/lib/booking/availability.ts` — **Phase C only:** widen global override fetch (`:488-492` `.maybeSingle()` → array) + normalize override windows; verify staff-override multi-row handling. **Phases A/B require no change here.** **Phase D:** refactor `isDateInBusinessWindow` to derive from `getBookingDateBounds`.
- `src/features/booking/components/DatePickerField.tsx` — `disabled={{ before: earliest, after: latest }}` (Phase D)
- `src/features/booking/components/ScheduleStep.tsx` — thread bounds to the picker (Phase D)
- booking-experience server entry — pass `booking_window_days` + `minimum_notice_hours` into the client tree (Phase D)

### UNCHANGED (do NOT touch)
- `blocked_dates` / `staff_blocked_dates` — full-day closures, no time component, no breaks.
- The admin `ManualBookingForm` date picker — admins stay window-unbounded (Phase D is customer-only).
- `availability.ts` recurring-rule windowing (`getRuleWindowsForDay`, `containsWindow`) — already multi-window; untouched by Phases A/B.

---

## 8 — Sequencing and dependencies

**No hard dependencies.** C-14 is self-contained.

- **Phase D (picker) is fully independent** and the most visible customer-facing fix — recommend shipping it first (or even as a standalone quick win) since it touches none of the breaks work.
- **Phases A → B → C** in order: A proves the segments model + editor; B reuses both for staff; C adds the schema + engine change last (highest risk).
- **`availability.ts` is RECON-sensitive** (booking slot engine). Phases A/B touch it **not at all** (verified multi-window support). Phase C touches it in a contained way (override fetch widening). Flag the RECON exception for Phase C in the plan; keep the change minimal + well-tested.
- No overlap with the other 13 C-NN plans' files.

**Recommended C-C position:** flexible. Phase D can slot anywhere early. The breaks phases can land after the data-integrity headline plans (C-06/C-04a/C-05) since they're additive UX, not data-integrity fixes.

---

## 9 — Open questions

### Q9.1 — Atomicity of the delete-day + insert-segments save

Segments storage means each save replaces the day's rows. To avoid a half-saved day (rows deleted, insert fails), wrap in a transaction — either a small RPC (`save_availability_day(day, segments[])`) or a Supabase transaction. **Locked:** prefer an RPC for true atomicity; fall back to delete+insert with error recovery if an RPC is overkill. Decide at impl based on the existing action's shape.

### Q9.2 — "Copy Monday to Tue–Sat" with breaks

Copies the full schedule (opens + all breaks + closes). Confirmed — the existing button's intent extends naturally.

### Q9.3 — Staff override multi-row handling in `resolveStaffWindows`

The staff override fetch already returns an array (multiple staff). Per-staff-per-date is likely one row today. Phase C must verify `resolveStaffWindows` normalizes **all** rows for a given staff+date into windows (not just the first). Flagged for impl-time code read.

### Q9.4 — Same-day minimum-notice nuance (Phase D)

The picker uses a day-level floor from `minimum_notice_hours`. The finer "today is bookable for 6pm but not 9am" case stays handled by the server slot filter (the picker can't express partial-day disabling cleanly). Acceptable — the picker is a coarse gate; the slot list is the fine gate.

### Q9.5 — Should the booking page show *why* a far date is unavailable?

No — per user direction, customers see only bookable dates; out-of-window dates are simply greyed (react-day-picker default). No explanatory tooltip. Keep it clean.

### Q9.6 — Minimum bookable-segment length threshold

The tiny-segment **warning** fires under 30 min (the slot step). Not a hard block — a clinic might want a 20-min express service later. Confirm the 30-min threshold or make it the shortest active service duration.

---

## 10 — Acceptance criteria

1. **Global working hours support breaks.** Set Monday: opens 08:00, break 12:30–15:00, closes 20:00 → save → reopen editor → the break round-trips. DB shows two `is_working_day=true` rows for Monday.
2. **Multiple breaks per day.** Add a second break → three segment rows → round-trips.
3. **Customer slots respect breaks.** On that Monday, the public booking page offers slots in 08:00–12:30 and 15:00–20:00 but **none** spanning or inside 12:30–15:00. Verified at the slot API + the UI.
4. **Per-staff breaks (custom mode).** A staff on `custom` sets a break → their slots reflect it; a staff on `use_global` inherits the global breaks.
5. **Override breaks.** A specific date with a custom-hours override + a break → slots reflect the break on that date only.
6. **Closed day round-trips.** Toggle a day off → one `is_working_day=false` row → toggle on → hours restore.
7. **Existing single-window days unaffected.** Days without breaks behave exactly as before; no data migration needed.
8. **(Phase D) Out-of-window dates non-clickable.** With `booking_window_days = 30`, the customer picker disables day 31+. The last clickable date equals the last date the slots API accepts.
9. **(Phase D) Minimum-notice floor.** With `minimum_notice_hours` set high enough to rule out today, today is non-clickable.
10. **(Phase D) Admin picker unbounded.** The admin manual-booking date picker still allows any future date.
11. **All static gates pass:** lint, tsc, vitest (incl. new segment + date-bounds specs), build, bundle delta within budget.
12. **Playwright sweep** at 375/768/1280/1440 for the availability editors + the customer picker.
13. **No regression** in existing availability behaviour (single-window days, blocked dates, overrides without breaks).

---

## 11 — References

| Source | What it gives |
|---|---|
| `availability/AvailabilityRulesManager.tsx` | Global working-hours editor (Phase A target) |
| `availability/actions.ts` `saveAvailabilityRule` | Save action to convert to segments |
| `staff/[staffId]/availability/StaffAvailabilityRulesForm.tsx` | Per-staff editor (Phase B) |
| `staff/[staffId]/availability/AvailabilityModeSelector.tsx` | Existing use_global/custom toggle (no change) |
| `availability/AvailabilityOverridesManager.tsx` + staff equivalent | Override editors (Phase C) |
| `lib/booking/availability.ts:144-222` | `normalizeWindows` + `getRuleWindowsForDay` + `containsWindow` — multi-window engine (verified) |
| `lib/booking/availability.ts:488-509` | Global (single) + staff (array) override fetches — Phase C widening |
| `lib/booking/availability.ts:390-398` | `isDateInBusinessWindow` — Phase D shared-helper refactor |
| `features/booking/components/DatePickerField.tsx:26` | The picker missing an upper bound (Phase D) |
| `lib/time/london.ts` | Europe/London helpers for date-bounds |
| DB (verified 2026-05-26) | recurring tables: PK only (no day-uniqueness); `availability_overrides`: unique on `override_date` (Phase C drop) |

---

## 12 — Out of scope (explicit non-goals)

- **New break tables** — segments reuse the existing rules/override tables. (Alternative considered + rejected; see plan §1.)
- **Customer-facing "on break" labelling** — breaks are hidden; customers see only bookable slots.
- **Breaks on full-day closures** (`blocked_dates`, blocking-type overrides) — closures have no time component.
- **Per-service break exceptions** — breaks are clinic/staff/date-level, not per-service.
- **Recurring break patterns distinct from the weekly schedule** (e.g., "first Monday of the month") — out of scope; the weekly recurring + per-date override cover the need.
- **Admin booking-window bound** — admins stay unbounded (Phase D is customer-only).
- **Same-day partial-notice picker disabling** — the picker is a day-level gate; the slot list handles intra-day notice.

---

*End of C-14 brief. Plan file follows: `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md`.*
