# C-14 — Granular working hours (breaks) + customer booking-window date guard — **PLAN**

**Type:** Band C plan-writing output (post-C-B amendment, 2026-05-26)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-14-granular-working-hours-breaks-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

This plan covers the "how" — execution order, verify-checkpoints, files touched, verification gate, risks + undo. Read the brief first.

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** `git status --short` empty. HEAD on `master`.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 baseline failures preserved).
4. **Static gates green.** `pnpm lint`, `npx tsc --noEmit` both 0 errors.
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
6. **Capture the current RPC/save behaviour.** Read `availability/actions.ts` `saveAvailabilityRule` + the staff equivalent before changing the save contract.
7. **Capture the slot-engine override application.** Read `availability.ts` around `:488-516` (override fetches) + `resolveStaffWindows` + wherever the global override window is applied, so Phase C's widening is precise.
8. **Test fixture inventory.** Confirm a test day/staff/override exists to exercise breaks against. Confirm `business_settings.booking_window_days` + `minimum_notice_hours` current values for Phase D testing.

If any pre-flight reveals unexpected state (e.g., a day-uniqueness constraint that wasn't there 2026-05-26), **stop** and surface to the user.

---

## 1 — Design decision recorded: segments over a breaks table

The brief (§2.1) chose the **segments** storage model. Recorded here for the implementer because it's load-bearing:

- A break = the gap between two bookable segment rows in the **existing** `availability_rules` / `staff_availability_rules` / `availability_overrides` tables.
- **No new tables, no break columns, no slot-engine change for recurring rules** — `getRuleWindowsForDay` already returns an array of windows and `containsWindow` already books only slots that fit inside one window (verified `availability.ts:144-222`).
- Alternative (explicit breaks tables + a subtract step in the engine) was rejected: it adds 3–4 tables + touches the RECON-sensitive slot engine at 3–4 points, for no benefit now that breaks are hidden from customers.

If during impl the segments model proves unworkable for a surface, **stop and re-evaluate with the user** before introducing break tables.

---

## 2 — Safe implementation order (4 phases, with verify checkpoints)

### Phase D — Customer booking-window date guard (ship first — independent, highest-visibility)

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

**Step 9 — Save action → segments (transactional).** Convert `saveAvailabilityRule` (one-row upsert) to `saveAvailabilityDay`: for each day, `scheduleToRows` → **delete the day's rows + insert the new segment rows atomically.** Prefer a small RPC `save_availability_day(p_day_of_week int, p_segments jsonb)` for atomicity (Zone-2 — but it's a new function, not a schema change to existing tables; confirm with user as a migration). If an RPC is overkill, do delete+insert with careful error handling and document the non-atomic window. Audit-log the change (existing pattern).

**Phase A verify checkpoint:**
- Helper tests pass. Lint + tsc green.
- Playwright: set Monday opens 08:00 / break 12:30–15:00 / closes 20:00 → save → reopen → round-trips. DB shows 2 `is_working_day=true` Monday rows.
- Customer slots on that Monday: offered in 08:00–12:30 + 15:00–20:00; none in/over 12:30–15:00. (Confirms zero-engine-change claim.)

### Phase B — Per-staff recurring breaks (`staff_availability_rules`)

**Step 10 — Reuse the editor in `StaffAvailabilityRulesForm`.** Same `WorkingHoursDayEditor` + `rowsToSchedule`/`scheduleToRows`. Staff save action → delete-day + insert-segments on `staff_availability_rules` (mirror Step 9; per-staff RPC variant `save_staff_availability_day` or shared parametrised RPC).

**Step 11 — Verify `resolveStaffWindows` consumes multiple rows.** Read `availability.ts` `resolveStaffWindows`. Confirm it normalizes **all** of a staff's rows for the day into windows (not just the first). If it takes one row, change to the array/normalizeWindows path. Likely already fine (it reads `staff_availability_rules` which is filtered by day) — verify + test.

**Phase B verify checkpoint:**
- Staff on `custom` with a break → their slots reflect it.
- Staff on `use_global` → inherits the global breaks (no staff rows).
- Mode toggle unchanged.

### Phase C — Override breaks (`availability_overrides` + `staff_availability_overrides`)

Highest-risk phase — the only schema + slot-engine change. Ship last.

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

**Step 13 — Slot-engine override widening.** In `availability.ts`:
- Global override fetch (`:488-492`): `.maybeSingle<DateOverrideRecord>()` → `.returns<DateOverrideRecord[]>()`. Feed the rows through `normalizeWindows` and apply as the day's windows (replacing the recurring rule windows for that date, as today — but now multiple windows = breaks).
- Staff override (`:504-509`): already an array across staff; ensure `resolveStaffWindows` groups **all** rows for a given staff+date into multiple windows (not first-only). For `override_type` blocking rows, keep the existing full-day-closure behaviour (no windows).
- Cover with new slot tests: a date with a custom-hours override + break → correct segmented windows.

**Step 14 — Override editor UI.** `AvailabilityOverridesManager.tsx` + `StaffAvailabilityOverridesManager.tsx`: render `WorkingHoursDayEditor` for custom-hours overrides; hide the breaks editor for blocking-type overrides. Save → delete-date's-rows + insert-segments.

**Phase C verify checkpoint:**
- Migration applied; `generate_typescript_types` refreshed.
- A global override date with a break → slots reflect it on that date only.
- A staff override date with a break → same, per staff.
- Blocking-type overrides + `blocked_dates` unchanged (full-day closures).
- Recurring days (Phases A/B) unaffected by the override changes.

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
| `src/features/booking/components/DatePickerField.tsx` | `disabled={{ before: earliest, after: latest }}` (Phase D) |
| `src/features/booking/components/ScheduleStep.tsx` | Compute + pass bounds (Phase D) |
| booking-experience server entry (ScheduleStep's parent) | Thread `booking_window_days` + `minimum_notice_hours` (Phase D) |
| `src/lib/booking/availability.ts` | Phase D: `isDateInBusinessWindow` → shared helper. Phase C: global override fetch single→array + window normalize; verify staff-override multi-row. **No change for Phases A/B.** |
| `src/app/admin/availability/AvailabilityRulesManager.tsx` | `WorkingHoursDayEditor` integration (Phase A) |
| `src/app/admin/availability/actions.ts` | `saveAvailabilityRule` → `saveAvailabilityDay` segments save (Phase A) |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityRulesForm.tsx` | Editor integration (Phase B) |
| staff availability save action | Segments save (Phase B) |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | Override editor (Phase C) |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | Staff override editor (Phase C) |

### UNCHANGED (do NOT touch)
- `blocked_dates` / `staff_blocked_dates` — full-day closures.
- `availability.ts` recurring windowing (`getRuleWindowsForDay`, `normalizeWindows`, `containsWindow`) — already multi-window.
- Admin `ManualBookingForm` date picker — window-unbounded for admins.
- RECON §5 untouchables beyond the contained `availability.ts` changes flagged above.

---

## 4 — Verification gate

### 4.1 Static gates
```bash
pnpm lint                       # 0 errors
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
- Picker: out-of-window dates unclickable; last clickable == last API-accepted; minimum-notice floor; admin unbounded (Phase D).

### 4.3 Slot-engine regression (critical)
For each phase, run a before/after slots API comparison on a control date with NO breaks → identical results (proves no regression to the core engine). Then the break date → segmented results.

### 4.4 Screenshot evidence
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
| Phase C override-date unique drop breaks an upsert elsewhere | medium | medium | grep callers of `availability_overrides` upsert; the save action moves from upsert-by-date to delete+insert. Verify no other code relies on the unique. |
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
| 1 | Phase D — `date-bounds` helper + `isDateInBusinessWindow` refactor + picker bounds + settings threading |
| 2 | Phase A — `working-hours-segments` helper + `WorkingHoursDayEditor` + global rules editor + segments save |
| 3 | Phase B — per-staff editor + segments save + `resolveStaffWindows` verification |
| 4 | Phase C — override migration + slot-engine override widening + override editors |
| 5 | Verification gate — Playwright + screenshots + progress file + master plan checklist row → ✅ |

`feat(redesign): C-14 {phase}` prefix during C-C. Migrations: `chore(supabase): C-14 migration applied`. Stage files explicitly.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. Run §0 pre-flight (re-confirm the constraint findings — they're load-bearing for the segments model).
3. Recommended order: **Phase D first** (independent customer win), then A → B → C.
4. Phase C migration is Zone-2 — show the user the SQL + confirm constraint names first.
5. `availability.ts` changes (Phase C + D) are the RECON-sensitive touch — keep minimal, test with §4.3 before/after comparison, document the exception in the progress file.
6. Verification gate (§4) non-negotiable.
7. Update the progress file per phase; final commit flips the master plan C-14 row to ✅.

---

## 9 — Open questions remaining

1. **Atomic save: RPC vs delete+insert** (Step 9/10). Prefer RPC; decide at impl based on the existing action shape. If RPC, it's a new function (Zone-2 confirm) — not a schema change to existing tables.
2. **Staff override multi-row handling** (Step 11/13). Verify `resolveStaffWindows` at impl; likely a small change.
3. **Tiny-segment threshold** — warn under 30 min (slot step) or under the shortest active service duration. Confirm at impl.
4. **Minimum-notice picker floor granularity** — day-level (this plan) vs hour-level. Day-level is the coarse gate; server slot filter is fine. Revisit only if QA flags.
5. **Booking-experience server entry location** — Phase D Step 4 threads settings; confirm the exact server component that owns the booking client tree during impl.

---

*End of C-14 plan. Brief: `redesign/briefs/C-14-granular-working-hours-breaks-brief.md`. Progress: `redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md` (filled during C-C).*
