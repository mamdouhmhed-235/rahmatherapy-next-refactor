# C-14 — Granular working hours (breaks) + customer booking-window date guard — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none hard (self-contained). Soft serialization: C-23 Phase B recommended BEFORE C-14 (both edit `src/lib/booking/availability.ts`; whichever runs second re-verifies line anchors) — check with the CODE-level probe `grep -n "ignoreBookingWindow\|ignorePublicPause" src/lib/booking/availability.ts` (non-empty = C-23 Phase B's options bag has landed) plus `git log --oneline --grep="feat(redesign): C-23"` for its other commits — a bare `--grep="C-23"` is unreliable: the 2026-07-26 refinement DOCS commits already match it (final-sweep fix 2026-07-26). If Phase B has landed, re-grep every `availability.ts` anchor in this plan before editing.
> Decisions: C-B-DECISIONS.md — no C-14 entries. Owner resolutions 2026-07-26: D11 (Phase D → verify + optional follow-ups) + D12 (Phase C atomic co-deploy + assignment-eligibility + duplicate-date guard) applied. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (post-C-B amendment, 2026-05-26)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-14-granular-working-hours-breaks-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

This plan covers the "how" — execution order, verify-checkpoints, files touched, verification gate, risks + undo. Read the brief first.

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** On `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/ supabase/` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted .playwright-mcp logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 baseline failures preserved).
4. **Static gates green.** `npx tsc --noEmit` 0 errors. `pnpm lint`: no NEW errors vs the 59-error baseline (55 from untracked `design_handoff_area_pages/prototype/*.jsx` + 4 pre-existing in `src/features/booking/`).
5. **DB introspection** via `mcp__supabase__execute_sql` (re-confirm the 2026-05-26 findings):
   ```sql
   -- (a) recurring tables have NO day-uniqueness (segments are free)
   SELECT rel.relname, con.conname, pg_get_constraintdef(con.oid)
   FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
   WHERE rel.relname IN ('availability_rules','staff_availability_rules') AND con.contype IN ('u','p');
   -- expect: PK on id only, no unique on day_of_week

   -- (b) global override unique to drop in Phase C
   SELECT indexname, indexdef FROM pg_indexes
   WHERE tablename = 'availability_overrides' AND indexdef ILIKE '%unique%';
   -- expect: availability_overrides_override_date_key

   -- (c) staff override unique (verify before Phase C)
   SELECT rel.relname, con.conname, pg_get_constraintdef(con.oid)
   FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
   WHERE rel.relname = 'staff_availability_overrides' AND con.contype IN ('u','p');
   -- if a (staff_id, override_date) unique exists → drop it in the Phase C migration
   ```
6. **Capture the current RPC/save behaviour.** Read `availability/actions.ts` `saveAvailabilityRule` + the staff equivalent before changing the save contract. *(Refined 2026-07-26 — C14-F09: global `saveAvailabilityRule` is update-by-rule-id-or-insert at `src/app/admin/availability/actions.ts:76-83`, not an upsert. The staff recurring-rule writes live in `src/app/admin/staff/actions.ts` — `createStaffAvailabilityRule` (L446) + `deleteStaffAvailabilityRule` (L499); `staff/[staffId]/availability/actions.ts` holds only blocked-date + override actions.)*
7. **Capture the slot-engine override application.** Read `availability.ts` around `:488-516` (override fetches) + `resolveStaffWindows` + wherever the global override window is applied, so Phase C's widening is precise. *(Refined 2026-07-26 — C14-F08: current anchors — override fetches now `availability.ts:580-596` inside `loadDayRecords`, per-date bucketing L646-690; `normalizeWindows` L204-213, `containsWindow` L215-217, `getRuleWindowsForDay` L275-282, `resolveStaffWindows` L284-317; `isDateInBusinessWindow` moved to `src/lib/time/london.ts:97-110`. Re-grep before editing — C-23 Phase B may have shifted lines.)*
8. **Test fixture inventory.** Confirm a test day/staff/override exists to exercise breaks against. Confirm `business_settings.booking_window_days` + `minimum_notice_hours` current values for Phase D testing.

```
DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.
```

If any pre-flight reveals unexpected state (e.g., a day-uniqueness constraint that wasn't there 2026-05-26), **stop** and surface to the user.

---

## 1 — Design decision recorded: segments over a breaks table

The brief (§2.1) chose the **segments** storage model. Recorded here for the implementer because it's load-bearing:

- A break = the gap between two bookable segment rows in the **existing** `availability_rules` / `staff_availability_rules` / `availability_overrides` tables.
- **No new tables, no break columns, no slot-engine change for recurring rules** — `getRuleWindowsForDay` already returns an array of windows and `containsWindow` already books only slots that fit inside one window (verified `availability.ts:144-222`). *(Anchors refreshed 2026-07-26 on `master` @ `ea97932`: `normalizeWindows` L204-213, `containsWindow` L215-217, `getRuleWindowsForDay` L275-282 — premise re-verified, still multi-window; C14-F08.)*
- Alternative (explicit breaks tables + a subtract step in the engine) was rejected: it adds 3–4 tables + touches the RECON-sensitive slot engine at 3–4 points, for no benefit now that breaks are hidden from customers.

If during impl the segments model proves unworkable for a surface, **stop and re-evaluate with the user** before introducing break tables.

---

## 2 — Safe implementation order (4 phases, with verify checkpoints)

### Phase D — Customer booking-window date guard (ship first — independent, highest-visibility)

> ✅ **VERIFY-ALREADY-IMPLEMENTED (2026-07-26)** — the build at `ea97932` already implements this phase's outcome (D11; C14-F06/F07 confirmed): the customer picker is availability-aware — `ScheduleStep.tsx:94-104` POSTs `/api/availability/month` and `DatePickerField.tsx` disables past + `hasSlots:false` days (L36-51, L65, rendered "Fully booked"); `calculateAvailableDays` marks out-of-window days `hasSlots:false` (`availability.ts:896-904`) and minimum-notice filters slots (L734-743); the admin `ManualBookingForm` date input stays unbounded (`min` = today only, no max — L1630).
> Executor: VERIFY the behaviour instead of re-implementing — with `booking_window_days=30`, open the customer picker: day 31+ renders unclickable once month data loads; with `minimum_notice_hours` high enough to rule out today, today yields no slots; the admin manual-booking picker still accepts far dates. Capture evidence to `redesign/evidence/C-14/`. Original step text preserved below for reference.
>
> **OPTIONAL follow-ups (recorded per D11 — slim residual gaps; not deleted, not required for C-14 completion):**
> 1. *Loading-window clickability:* while `monthDays` is null (month data loading / API failure) out-of-window future dates ARE clickable (C14-F07) — static client bounds would close this.
> 2. *Distinct outside-window affordance:* out-of-window months show "No available days this month" with no distinct visual treatment vs a genuinely full month (C14-F07).
> 3. *Date-bounds helper + 365-caller alignment:* `isDateInBusinessWindow` now lives at `src/lib/time/london.ts:97-110` (imported by `availability.ts:6`, called at L818-826 slots + L896-904 days) and has a second caller — `src/features/booking/schemas/booking-schema.ts:179` with hardcoded `bookingWindowDays: 365` — any shared `getBookingDateBounds` consolidation must include it (C14-F05). If built, compose the string-based `london.ts` helpers (`getBusinessDate`, `addBusinessDays`) — the `toLondon`/`startOfLondonDay`/`addHours`/`addDays` imports in Step 1's pseudocode do not exist (C14-F14).
> 4. If any follow-up is picked up: the picker's `disabled` prop is now an ARRAY — `[{ before: today }, ...fullDates]` (`DatePickerField.tsx:65`); Step 3's object-form literal would drop the fullDates disabling (C14-F07). And no "booking-experience server entry" exists — the dialog mounts client-only via `BookingExperienceLoader` (`ssr:false`) at `(public)/layout.tsx:28`; settings threading requires a layout-level fetch or API-returned bounds (C14-F13).

Ordered first because it's independent of the breaks work, customer-facing, and small.

**Step 1 — Shared date-bounds helper.** New `src/lib/booking/date-bounds.ts`:

```ts
import { /* london helpers */ } from "@/lib/time/london";

export function getBookingDateBounds(opts: {
  now: Date;
  bookingWindowDays: number;
  minimumNoticeHours: number;
}): { earliest: Date; latest: Date } {
  const londonNow = toLondon(opts.now);
  const earliest = startOfLondonDay(addHours(londonNow, opts.minimumNoticeHours));
  const latest = startOfLondonDay(addDays(londonNow, opts.bookingWindowDays));
  return { earliest, latest };
}
```

Unit test `src/lib/booking/__tests__/date-bounds.test.ts`: window=30 → latest = today+30; notice=36h → earliest = day-after-tomorrow (or per exact math); BST/GMT boundary cases via `vi.setSystemTime`.

**Step 2 — Refactor `isDateInBusinessWindow` to derive from the helper.** In `availability.ts`, make `isDateInBusinessWindow` call `getBookingDateBounds` and check `earliest <= date <= latest`. This guarantees the picker (Step 3) and the server agree. **RECON note:** `availability.ts` is the slot engine; this is a behaviour-preserving refactor of an existing guard (same window semantics, single source). Keep it minimal; cover with the existing slot tests + a new boundary test.

**Step 3 — Picker upper + lower bound.** `DatePickerField.tsx`:
```tsx
disabled={{ before: earliestBookable, after: latestBookable }}
```
Accept `earliestBookable` + `latestBookable` as props (or a `bounds` prop). `ScheduleStep.tsx` computes them via `getBookingDateBounds` from the threaded settings.

**Step 4 — Thread settings to the client tree.** Pass `booking_window_days` + `minimum_notice_hours` from the booking-experience server entry into `ScheduleStep` → `DatePickerField`. The schedule step already references the window — confirm the prop chain + extend.

**Step 5 — Admin picker stays unbounded.** Verify the admin `ManualBookingForm` date picker does NOT receive these bounds (admins book any date). No change there.

**Phase D verify checkpoint:**
- Lint + tsc green; new date-bounds test passes; existing slot tests pass.
- Playwright: customer picker with `booking_window_days=30` → day 31+ greyed + unclickable; last clickable date == last date the slots API accepts (cross-check via a slots call). Admin picker still allows far dates.

### Phase A — Global recurring breaks (`availability_rules`)

**Step 6 — Segments conversion + validation helper.** New `src/lib/booking/working-hours-segments.ts` with `rowsToSchedule`, `scheduleToRows`, `validateSchedule` (brief §2.2). Unit test `__tests__/working-hours-segments.test.ts`:
- single window → `{ opens, closes, breaks: [] }` round-trips.
- one break → 2 segment rows → round-trips.
- two breaks → 3 rows → round-trips.
- closed → one `is_working_day=false` row.
- validation: break outside [opens,closes] → error; overlapping breaks → error; opens≥closes → error; tiny segment → warning.

**Step 7 — `WorkingHoursDayEditor` component.** New `src/app/admin/availability/WorkingHoursDayEditor.tsx` (brief §4.1). Presentational: takes a `DaySchedule` + onChange; renders Opens / Break rows (+Add / Remove) / Closes + live "Bookable:" line + inline validation. Mobile-first 375.

**Step 8 — Wire into `AvailabilityRulesManager`.** Replace `DayRow`'s single Opens/Closes with `WorkingHoursDayEditor`. `buildInitialState` → `rowsToSchedule(rules.filter(day))`. "Copy Monday to Tue–Sat" copies the full schedule (incl. breaks).

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: ONLY IF the RPC option is chosen in Step 9 (or Step 10's staff variant) — apply migration `<ts>_c14_save_availability_day.sql` creating RPC `save_availability_day` (and/or `save_staff_availability_day`) to production project twzutkfgqclqurvkmvqz.
> Exact SQL / change: the CREATE FUNCTION statement drafted at impl per the step body below — show it verbatim to the user before applying.
> Post-action verification: `SELECT proname FROM pg_proc WHERE proname LIKE 'save%availability%';` → the new function name(s) listed; a save round-trip via the editor succeeds.
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 9 — Save action → segments (transactional).** Convert `saveAvailabilityRule` (one-row upsert) to `saveAvailabilityDay`: for each day, `scheduleToRows` → **delete the day's rows + insert the new segment rows atomically.** Prefer a small RPC `save_availability_day(p_day_of_week int, p_segments jsonb)` for atomicity (Zone-2 — but it's a new function, not a schema change to existing tables; confirm with user as a migration). If an RPC is overkill, do delete+insert with careful error handling and document the non-atomic window. Audit-log the change (existing pattern).

**Phase A verify checkpoint:**
- Helper tests pass. Lint + tsc green.
- Playwright: set Monday opens 08:00 / break 12:30–15:00 / closes 20:00 → save → reopen → round-trips. DB shows 2 `is_working_day=true` Monday rows.
- Customer slots on that Monday: offered in 08:00–12:30 + 15:00–20:00; none in/over 12:30–15:00. (Confirms zero-engine-change claim.)

### Phase B — Per-staff recurring breaks (`staff_availability_rules`)

**Step 10 — Reuse the editor in `StaffAvailabilityRulesForm`.** Same `WorkingHoursDayEditor` + `rowsToSchedule`/`scheduleToRows`. Staff save action → delete-day + insert-segments on `staff_availability_rules` (mirror Step 9; per-staff RPC variant `save_staff_availability_day` or shared parametrised RPC).
   *Executability (2026-07-26, C14-F09): the staff recurring-rule save actions live in `src/app/admin/staff/actions.ts` — `createStaffAvailabilityRule` (L446) + `deleteStaffAvailabilityRule` (L499) — NOT in `staff/[staffId]/availability/actions.ts` (blocked-date + override actions only). Verify: `grep -n "StaffAvailabilityRule" src/app/admin/staff/actions.ts` → both symbols. Step 9's HARD-STOP applies to the staff RPC variant too.*

**Step 11 — Verify `resolveStaffWindows` consumes multiple rows.** Read `availability.ts` `resolveStaffWindows`. Confirm it normalizes **all** of a staff's rows for the day into windows (not just the first). If it takes one row, change to the array/normalizeWindows path. Likely already fine (it reads `staff_availability_rules` which is filtered by day) — verify + test.
   *Executability (2026-07-26): `resolveStaffWindows` sits at `availability.ts:284-317`; staff recurring rows reach it via `loadDayRecords`. Verify with a two-row staff day fixture: slots must reflect both windows.*

**Phase B verify checkpoint:**
- Staff on `custom` with a break → their slots reflect it.
- Staff on `use_global` → inherits the global breaks (no staff rows).
- Mode toggle unchanged.

### Phase C — Override breaks (`availability_overrides` + `staff_availability_overrides`)

Highest-risk phase — the only schema + slot-engine change. Ship last.

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: apply migration `<ts>_c14_override_breaks.sql` (drop `availability_overrides_override_date_key` + the staff `(staff_id, override_date)` unique `staff_availability_overrides_staff_id_override_date_key`) to production project twzutkfgqclqurvkmvqz.
> Exact SQL / change: verbatim in the step body below (confirm exact index/constraint names via pre-flight 5(b)+(c) first).
> Post-action verification: re-run the pre-flight 5(b)+(c) queries → the dropped unique index/constraint no longer listed; the Step 12a save-path rewrites are in the SAME commit/deploy (see below).
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 12 — Migration (Zone-2).** New `supabase/migrations/<ts>_c14_override_breaks.sql`:
```sql
BEGIN;
-- Allow multiple windows per override date (segments)
DROP INDEX IF EXISTS public.availability_overrides_override_date_key;
-- (verify name first via pre-flight 5b)

-- Staff override: drop the per-staff-per-date unique if it exists (verify name in pre-flight 5c)
-- ALTER TABLE public.staff_availability_overrides DROP CONSTRAINT IF EXISTS <staff_override_unique_name>;
COMMIT;
```
Confirm exact constraint/index names from pre-flight before applying. Zone-2 — explicit user confirmation.

**Step 12a — Atomic co-deploy: save-path rewrites MUST land with the migration (D12; C14-F12).** `createAvailabilityOverride` uses `.upsert(…, { onConflict: "override_date" })` at `src/app/admin/availability/actions.ts:250-258` — ON CONFLICT without a matching unique index errors at runtime, so the moment the Step 12 unique drops, the global override save breaks. The migration and the following code changes ship in the SAME commit/deploy:
- Rewrite `createAvailabilityOverride` from upsert-by-date to the delete-date's-rows + insert-segments pattern (Step 14's save shape).
- Staff overrides: `addStaffAvailabilityOverride` (`src/app/admin/staff/[staffId]/availability/actions.ts:182-201`) relies on `PG_UNIQUE_VIOLATION` for its duplicate-date UX guard ("That date already has an adjustment…") — silently lost after the drop. Add a replacement guard: pre-check for an existing row on that staff+date and return the same fieldError when the save is not an intentional multi-segment write (C14-F03/F12).
- Verify: after deploy, saving a global override succeeds (no PostgREST ON CONFLICT error); adding a duplicate-date staff override still surfaces the duplicate-date fieldError.

**Step 13 — Slot-engine override widening.** In `availability.ts`:

> **C-23 coordination (updated 2026-07-26 — supersedes the 2026-07-16 conditional note; C14-F02 confirmed):** the `redesign/start-state` engine refactor is ALREADY on `master` via merge `ea97932`, unconditionally and without C-23 executing: the file is structured as `loadSettings` (L421) → `loadContextRest` (L441) → `loadDayRecords(dates[])` (L563, batched multi-date) → `computeDaySlots` (L696, pure). C-23's options bag (`ignoreBookingWindow`/`ignorePublicPause`) has NOT landed — `calculateAvailableSlots` (L796) and `calculateAvailableDays` (L867) take `options: { now?: Date }` only. The old "if C-23 has landed first / if C-14 lands first" conditional is moot; C-23's Phase A port is superseded (collapsed to verify on its side). Serialization (sequencing decision 2026-07-26): C-23 Phase B (small, additive options bag) is recommended to land BEFORE C-14 Phase C; whichever runs second re-verifies every `availability.ts` line anchor. Because the fetch is batched multi-date, the widening below must preserve the per-date grouping (`Map<date, …>`), not assume a single row for a single date.
>
> **Shared-surface coordination (collision map, 2026-07-26):** "The `redesign/start-state → master` merge (ea97932) has already landed. C-23's Phase A port is a no-op — collapse it to a single verify step (assert `git diff master redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/` is empty) rather than executing the checkout. `/api/availability/month` is a live public customer endpoint today — treat any change to it or the underlying engine as a production-booking-flow change requiring the same care as any other public-surface edit. C-14's Phase C override-uniqueness drop must add a verify checkpoint for `src/app/admin/bookings/assignment-eligibility.ts:162-166` (currently `.maybeSingle()`, will error on multi-row dates) — this file is missing from C-14's files-touched list and its Zone-2 migration must not ship without it." *(Files-touched + Phase C verify checkpoint updated accordingly — Steps 12a/13a below.)* Re-grep for the current anchor before editing; prior Band C plans may have shifted line positions; expect C-23 Phase B's edits in this region.
- Global override fetch — **already an array** (rewritten 2026-07-26, C14-F01: the `.maybeSingle<DateOverrideRecord>()` at the old `:488-492` no longer exists — comment-only trace at L557-561; array fetch at L580-584). The single-row assumption now lives in `loadDayRecords`'s per-date bucketing — first-row-per-date-wins at L651-656 — and in `resolveStaffWindows` L314 (`normalizeWindows([globalOverride])`). Widen THERE: bucket ALL rows per date (`Map<date, GlobalOverrideRow[]>`), feed the full array through `normalizeWindows`, and apply as the day's windows (replacing the recurring rule windows for that date, as today — but now multiple windows = breaks).
- Staff override (fetch now L591-596): already an array across staff, but the grouping happens in `loadDayRecords` L662-672, which keeps only the FIRST row per staff+date in a `Map<string, StaffDateOverrideRecord>` (L640); `resolveStaffWindows` L305-307 then normalizes that single record (rewritten 2026-07-26, C14-F04). The widening must change the bucketing loop + the Map value type (record → record[]) + `resolveStaffWindows`'s consumption — not `resolveStaffWindows` alone — so **all** rows for a given staff+date become multiple windows. For `override_type` blocking rows, keep the existing full-day-closure behaviour (no windows).
- Cover with new slot tests: a date with a custom-hours override + break → correct segmented windows.

**Step 13a — Widen the admin assignment-eligibility consumer (D12; C14-F03).** `src/app/admin/bookings/assignment-eligibility.ts:162-166` does `.maybeSingle()` on `availability_overrides` for the booking date — after the Step 12 drop, a date holding 2+ rows makes PostgREST return a query error that is silently swallowed (no `.error` check at L203: `globalOverride` becomes undefined → incorrect eligibility computation). Widen to an array fetch + `normalizeWindows` (mirror Step 13); its staff-override `Map` bucketing (L208-210, last-row-wins per staff) needs the same record → record[] widening. Ships in the same commit/deploy as Steps 12/12a. Verify: with a 2-row override date, admin booking assignment for that date computes eligibility without error and honours both windows.

**Step 14 — Override editor UI.** `AvailabilityOverridesManager.tsx` + `StaffAvailabilityOverridesManager.tsx`: render `WorkingHoursDayEditor` for custom-hours overrides; hide the breaks editor for blocking-type overrides. Save → delete-date's-rows + insert-segments.

**Phase C verify checkpoint:**
- Migration applied; `generate_typescript_types` refreshed.
- A global override date with a break → slots reflect it on that date only.
- A staff override date with a break → same, per staff.
- Blocking-type overrides + `blocked_dates` unchanged (full-day closures).
- Recurring days (Phases A/B) unaffected by the override changes.
- **Admin assignment-eligibility (Step 13a):** on a date with 2+ override rows, `/admin/bookings` staff assignment for a booking on that date computes eligibility without a swallowed PostgREST error and honours both windows (D12; C14-F03).
- **Atomic co-deploy (Step 12a):** global override save works post-migration; staff duplicate-date guard still fires (D12; C14-F12).

---

## 3 — Files touched (final list)

### NEW
| File | Purpose |
|---|---|
| `src/lib/booking/working-hours-segments.ts` | `rowsToSchedule` / `scheduleToRows` / `validateSchedule` |
| `src/lib/booking/__tests__/working-hours-segments.test.ts` | Helper coverage |
| `src/lib/booking/date-bounds.ts` | `getBookingDateBounds` (picker + server) |
| `src/lib/booking/__tests__/date-bounds.test.ts` | Bounds coverage |
| `src/app/admin/availability/WorkingHoursDayEditor.tsx` | Shared Opens/Breaks/Closes editor |
| `supabase/migrations/<ts>_c14_override_breaks.sql` | Phase C unique-index/constraint drops |
| (optional) `supabase/migrations/<ts>_c14_save_availability_day.sql` | Atomic save RPC(s) if chosen (Step 9/10) |

### EDITED
| File | Change |
|---|---|
| `src/features/booking/components/DatePickerField.tsx` | `disabled={{ before: earliest, after: latest }}` (Phase D) — *wrapped per D11: edit only if the optional follow-up is built; `disabled` is now an ARRAY `[{ before: today }, ...fullDates]` at L65 (C14-F07)* |
| `src/features/booking/components/ScheduleStep.tsx` | Compute + pass bounds (Phase D) — *wrapped per D11 (already POSTs `/api/availability/month`, L94-104)* |
| booking-experience server entry (ScheduleStep's parent) | Thread `booking_window_days` + `minimum_notice_hours` (Phase D) — *does not exist: the dialog mounts client-only via `BookingExperienceLoader` (`ssr:false`) at `(public)/layout.tsx:28`; row applies only if the optional Phase D follow-up is built (C14-F13/D11)* |
| `src/lib/booking/availability.ts` | Phase D: `isDateInBusinessWindow` → shared helper *(optional follow-up only per D11; the function now lives in `src/lib/time/london.ts:97-110` — C14-F05)*. Phase C: per-date/per-staff override bucketing in `loadDayRecords` record→record[] + `resolveStaffWindows` multi-row *(fetches already arrays — C14-F01/F04)*. **No change for Phases A/B.** |
| `src/app/admin/availability/AvailabilityRulesManager.tsx` | `WorkingHoursDayEditor` integration (Phase A) |
| `src/app/admin/availability/actions.ts` | `saveAvailabilityRule` → `saveAvailabilityDay` segments save (Phase A); Phase C: `createAvailabilityOverride` upsert → delete+insert (Step 12a; C14-F12) |
| `src/app/admin/bookings/assignment-eligibility.ts` | Phase C: override `.maybeSingle()` → array + staff Map record[] widening (Step 13a; D12/C14-F03) |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityRulesForm.tsx` | Editor integration (Phase B) |
| staff availability save action — `src/app/admin/staff/actions.ts` (`createStaffAvailabilityRule` L446 / `deleteStaffAvailabilityRule` L499 — C14-F09) | Segments save (Phase B) |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | Override editor (Phase C) |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | Staff override editor (Phase C) |
| `src/app/admin/staff/[staffId]/availability/actions.ts` | Phase C: `addStaffAvailabilityOverride` replacement duplicate-date guard (Step 12a; D12/C14-F12) |

### UNCHANGED (do NOT touch)
- `blocked_dates` / `staff_blocked_dates` — full-day closures.
- `availability.ts` recurring windowing (`getRuleWindowsForDay`, `normalizeWindows`, `containsWindow`) — already multi-window.
- Admin `ManualBookingForm` date picker — window-unbounded for admins.
- RECON §5 untouchables beyond the contained `availability.ts` changes flagged above.

---

## 4 — Verification gate

### 4.1 Static gates
```bash
pnpm lint                       # no NEW errors vs the 59-error baseline (55 untracked design_handoff_area_pages/prototype JSX + 4 pre-existing src/features/booking/)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new segment + date-bounds + slot specs pass; baseline preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # delta within budget
```
**Bundle budget:** `WorkingHoursDayEditor` (~3 kB) on the availability bundles; helper files are shared/server. Picker change is net-zero. **Ceiling: +5 kB across `/admin/availability/*` + `/admin/staff/*`.**

### 4.2 Functional sweep (per brief §10 acceptance)
- Global breaks round-trip + customer slots respect them (Phase A).
- Per-staff breaks, custom + use_global (Phase B).
- Override breaks, global + staff (Phase C).
- Closed-day round-trip; existing single-window days unaffected.
- Picker: out-of-window dates unclickable; last clickable == last API-accepted; minimum-notice floor; admin unbounded (Phase D). *(Phase D wrapped per D11 — this line is a VERIFY of existing behaviour once month data loads, not new work.)*

### 4.3 Slot-engine regression (critical)
For each phase, run a before/after slots API comparison on a control date with NO breaks → identical results (proves no regression to the core engine). Then the break date → segmented results.

*Concrete procedure (added 2026-07-26 — this checkpoint was unverifiable as written): before and after each phase's commit, capture `curl -s -X POST http://localhost:3000/api/availability -H "Content-Type: application/json" -d '{"date":"<control-date>","serviceIds":["<service-id>"],"participantGenders":["female"],"city":"Luton"}'` to `redesign/evidence/C-14/slots-<phase>-{before,after}.json` and `diff` the pair — byte-identical for the control date; segmented for the break date. (Request shape per `src/app/api/availability/route.ts:6-11` `availabilityRequestSchema`.)*

### 4.4 Screenshot evidence

All captures go to `redesign/evidence/C-14/` (never `redesign/audits/**`).
- 375 + 1280: `WorkingHoursDayEditor` with two breaks (global).
- 375 + 1280: staff custom hours with a break.
- 1280: override editor with a break.
- Customer picker showing greyed out-of-window dates.

---

## 5 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Segments model regresses the slot engine | low | HIGH | §4.3 before/after control-date comparison per phase. Recurring path is verified zero-change; Phase C override change is contained + tested. |
| Non-atomic delete+insert leaves a half-saved day | low | medium | Step 9/10 prefer an atomic RPC; else error-recover + document. A failed save shows the prior day state on reload. |
| Phase C override-date unique drop breaks an upsert elsewhere | medium | medium | Verified 2026-07-26 — two concrete dependents found: `createAvailabilityOverride` `.upsert(onConflict:"override_date")` (`availability/actions.ts:250-258`, errors at runtime post-drop) and `assignment-eligibility.ts:162-166` `.maybeSingle()` (errors on 2+ rows). Steps 12a + 13a bind their rewrites to the migration (same commit/deploy); staff duplicate-date guard replaced (C14-F03/F12; D12). |
| Staff override `resolveStaffWindows` only reads first row | medium | medium | Step 11/13 explicit verification + test with two rows for one staff+date. |
| Picker upper bound drifts from server window | low | medium | Both derive from `getBookingDateBounds` (single source). §5.7 brief + a QA cross-check assert equality. |
| Minimum-notice day floor too aggressive (disables a bookable today) | low | low | Day-level floor is conservative; server slot filter is the fine gate. Tune if QA flags. |
| `availability.ts` RECON change scrutiny | low | medium | Phase C + Phase D changes are minimal + behaviour-preserving (window semantics unchanged; just multi-row + single-source). Flag the RECON exception in the progress file. |
| Tiny-segment confusion (a 15-min gap nobody can book) | low | low | Soft warning in the editor (§4.2 brief); not blocking. |

---

## 6 — Undo procedure

### 6.1 Undo code (Phases A–D)
Revert per-phase commits in reverse. Phases A/B/D are code-only (safe `git revert`). Phase C has a migration (§6.2).
1. `git revert <phase-C-override-commit>` then apply the Phase C migration rollback (§6.2).
2. `git revert <phase-B-staff-commit>`
3. `git revert <phase-A-global-commit>`
4. `git revert <phase-D-picker-commit>`

Phases A/B change the save contract (segments). After reverting, the editor returns to single-window — but **existing multi-row days remain in the DB**. The old save action reads `.find(day)` (first row), which would silently ignore the extra segment rows. **Before reverting A/B, collapse any multi-segment days back to single rows** (take the earliest open + latest close per day) to avoid orphaned segment rows confusing the reverted reader.

### 6.2 Undo migration (Phase C)
```sql
BEGIN;
-- Re-add the global override unique (requires deduping to one row per date first)
-- DELETE duplicate override rows per date, keeping the widest window, THEN:
CREATE UNIQUE INDEX availability_overrides_override_date_key ON public.availability_overrides (override_date);
-- Re-add the staff override unique if it was dropped (dedupe first)
COMMIT;
```
**Caveat:** re-adding the unique fails if multiple override rows per date exist (created during the breaks window). Dedupe first. **Recommended on rollback: leave the unique dropped** — reverting the UI + save action restores single-window behaviour for new edits; the relaxed constraint is harmless.

### 6.3 No data loss
No tables/columns dropped. Segments are rows in existing tables; collapsing them to single windows is the only cleanup.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase D — `date-bounds` helper + `isDateInBusinessWindow` refactor + picker bounds + settings threading *(2026-07-26: now verify-only per D11 — evidence capture, no code unless the optional follow-ups are approved)* |
| 2 | Phase A — `working-hours-segments` helper + `WorkingHoursDayEditor` + global rules editor + segments save |
| 3 | Phase B — per-staff editor + segments save + `resolveStaffWindows` verification |
| 4 | Phase C — override migration + slot-engine override widening + override editors *(incl. Step 12a `createAvailabilityOverride` rewrite + duplicate-date guard + Step 13a assignment-eligibility widening — atomic with the migration; D12)* |
| 5 | Verification gate — Playwright + screenshots + progress file + master plan checklist row → ✅ |

`feat(redesign): C-14 {phase}` prefix during C-C. Migrations: `chore(supabase): C-14 migration applied`. Stage files explicitly.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. Run §0 pre-flight (re-confirm the constraint findings — they're load-bearing for the segments model).
3. Recommended order: **Phase D first** (independent customer win) *(2026-07-26: Phase D is now a verify-only pass per D11 — run its capture whenever convenient)*, then A → B → C.
4. Phase C migration is Zone-2 — show the user the SQL + confirm constraint names first.
5. `availability.ts` changes (Phase C + D) are the RECON-sensitive touch — keep minimal, test with §4.3 before/after comparison, document the exception in the progress file.
6. Verification gate (§4) non-negotiable.
7. Update the progress file per phase; final commit flips the master plan C-14 row to ✅.

---

## 9 — Open questions remaining

1. **Atomic save: RPC vs delete+insert** (Step 9/10). Prefer RPC; decide at impl based on the existing action shape. If RPC, it's a new function (Zone-2 confirm) — not a schema change to existing tables.
2. **Staff override multi-row handling** (Step 11/13). Verify `resolveStaffWindows` at impl; likely a small change. *(Answered 2026-07-26 — `loadDayRecords` L662-672 keeps only the first row per staff+date; the widening spans the bucketing loop + Map value type + `resolveStaffWindows`, not `resolveStaffWindows` alone — C14-F04.)*
3. **Tiny-segment threshold** — warn under 30 min (slot step) or under the shortest active service duration. Confirm at impl.
4. **Minimum-notice picker floor granularity** — day-level (this plan) vs hour-level. Day-level is the coarse gate; server slot filter is fine. Revisit only if QA flags.
5. **Booking-experience server entry location** — Phase D Step 4 threads settings; confirm the exact server component that owns the booking client tree during impl. *(Resolved 2026-07-26 — no such server component exists: the dialog mounts client-only via `BookingExperienceLoader` (`ssr:false`) at `(public)/layout.tsx:28`; threading would require a layout-level fetch or API-returned bounds. Moot unless the optional Phase D follow-up is built — C14-F13/D11.)*

---

*End of C-14 plan. Brief: `redesign/briefs/C-14-granular-working-hours-breaks-brief.md`. Progress: `redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md` (filled during C-C).*
