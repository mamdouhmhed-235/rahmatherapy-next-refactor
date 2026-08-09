# C-14 — Granular working hours (breaks) + customer booking-window date guard — PROGRESS

**Plan:** `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md`
**Brief:** `redesign/briefs/C-14-granular-working-hours-breaks-brief.md`
**Programme:** Band C, C-C implementation — §4 order position 21, after C-23.
**Predecessor HEAD at plan start:** `ecc1d0d`.
**Migrations:** up to two, both ⛔ Zone-2. **Commits so far:** 1.

---

## 0 — Pre-flight (2026-08-09)

| # | Check | Result |
|---|---|---|
| 1 | branch `master`; `ea97932` ancestor | ✅ |
| 1 | tree clean over `src/`/`supabase/` | ✅ except the standing `src/lib/maintenance.ts` |
| 2 | dev server | ✅ up, Owner-run |
| 3–4 | baseline gates | ✅ **by identity** (the plan's "485/491, 6 failures" is a frozen 2026-05 snapshot and is SUPERSEDED) |
| — | **serialization: C-23 Phase B before C-14** | ✅ **satisfied** — `grep -n "ignoreBookingWindow\|ignorePublicPause" src/lib/booking/availability.ts` non-empty. Per the plan's own instruction, **every `availability.ts` anchor was therefore re-grepped before editing**; all recorded line numbers were stale |
| 5 | **DB introspection — re-confirm the 2026-05-26 findings** | ✅ **no unexpected state — see §0.1** |
| 8 | live `business_settings` | `booking_window_days = 29`, `minimum_notice_hours = 4`, `buffer_time_mins = 30`, `booking_status_enabled = true`, `allowed_cities = [Luton, Dunstable]` |

### 0.1 — Pre-flight #5 results, verbatim (these define the Phase C migration)

- **(a) Recurring tables have NO day-uniqueness.** `availability_rules` and `staff_availability_rules` each carry **only** a `PRIMARY KEY (id)`. The segments storage model therefore needs **zero schema change** for Phases A and B, exactly as brief §2.1 assumed. Premise re-verified, not taken on trust.
- **(b) Global override unique — present:** `availability_overrides_override_date_key`, `UNIQUE (override_date)`.
- **(c) Staff override unique — present:** `staff_availability_overrides_staff_id_override_date_key`, `UNIQUE (staff_id, override_date)`. The plan flagged this as conditional ("if it exists"); **it exists**, so the Phase C migration must drop both.

## 0.2 — ⛔ HARD-STOP forecast (§2.9e) — two migration gates, both Owner-approval

**Gate 1 — Phase A/B RPC. May not be needed at all.** Fires only if the segments save is implemented as an RPC (`save_availability_day` / `save_staff_availability_day`) rather than delete-then-insert. Given §0.1(a), nothing in the schema forces it — the question is purely atomicity of the day's delete+insert. To be raised only if the implementer's analysis calls for it.

**Gate 2 — Phase C. Unavoidable, and it MUST ship atomically with its code (D12).**

```sql
DROP INDEX IF EXISTS public.availability_overrides_override_date_key;
ALTER TABLE public.staff_availability_overrides
  DROP CONSTRAINT IF EXISTS staff_availability_overrides_staff_id_override_date_key;
```

**Why it cannot be split from the code:** `createAvailabilityOverride` uses `.upsert(…, { onConflict: "override_date" })`. **PostgREST's `ON CONFLICT` errors at runtime the moment the matching unique index is gone**, so dropping the constraint without the rewrite breaks every global override save immediately. A second, quieter casualty: `addStaffAvailabilityOverride` relies on catching `PG_UNIQUE_VIOLATION` to show its "That date already has an adjustment" message — that guard silently stops working and needs replacing in the same commit.

---

## 1 — Phase D (Steps 1–5) — `4583573`, `opus` — IMPLEMENTED, awaiting independent verification

**Opus justification (§5):** edits the shared slot engine's window guard and the live public booking flow.

**Files:** `src/lib/time/london.ts` (+`getBookingDateBounds`, `isDateInBusinessWindow` refactored) · `london.test.ts` (+9) · **NEW** `src/lib/booking/booking-window-settings.ts` · `DatePickerField.tsx` (+bounds props) · **NEW** `DatePickerField.test.tsx` (+6) · `ScheduleStep.tsx` · `BookingExperience.tsx` · `BookingExperienceLoader.tsx` · **`src/app/(public)/layout.tsx`**.

### 1.1 — Boundary semantics, and the live proof they match the server

- `latest = addBusinessDays(getBusinessDate(now), bookingWindowDays)` — **inclusive**. With window 29 and today 2026-08-09 → **`2026-09-07`**.
- `earliest = getBusinessDate(now + minimumNoticeHours)`. At 09:00 with 4h notice → today; at 22:30 → tomorrow.
- `isDateInBusinessWindow` calls the helper with notice **omitted (0)**, so its lower bound stays `today` — **deliberately not notice-aware**, or same-day evening slots would break. Fine-grained notice remains in `isOutsideMinimumNotice`.

**Live proof against the running server (read-only, no booking created):** `/api/availability` accepts **`2026-09-07` → 23 slots** and rejects **`2026-09-08` → "Date is outside the booking window."** (and `2026-08-08` likewise). The picker test pins 09-07 enabled / 09-08 disabled. **The picker's last clickable date equals the last date the server accepts** — which is the entire point of the phase, and the off-by-one it exists to prevent.

The refactor is **proven behaviour-preserving** by a sweep test that re-implements the pre-refactor algorithm inline and compares across 5 instants (BST, London/UTC rollover, the BST→GMT change, GMT, year-end) × 5 window values × 36 date offsets — identical throughout. **Six mutants, all killed** (window −1, exclusive upper bound, notice floor dropped, `after` matcher removed, upper +1, lower −1).

### 1.2 — Step 5: admin picker confirmed untouched (cross-plan hazard cleared)

C-23 had just replaced the admin date inputs with the availability calendar, so the risk was C-14 leaking a window bound into it. Verified quoted from source — `AvailabilityCalendarField.tsx:231` is `disabled={[{ before: minDate }]}`, `minDate ← calendarMin = today`, **no `after` bound, no C-14 import anywhere near it**. C-23's brief finding 3 ("informs, never blocks") is intact. **No cross-plan regression.**

### 1.3 — ⚠️ Deviation: `src/app/(public)/layout.tsx` was edited, and it was NOT on the files list

**Rule 6(b) says a required change outside the files-touched list is a STOP.** The implementer did not stop — it proceeded and flagged. That is the process failing; recorded as a deviation, not excused.

**On the merits the change is accepted.** Step 4's premise is factually false in current reality (finding C14-F13): the booking dialog has **no server entry** — it mounts client-only via `BookingExperienceLoader` (`ssr:false`) from the public layout — so there was no existing prop chain to extend. The plan pre-authorises exactly this remedy ("settings threading requires a layout-level fetch or API-returned bounds"), and API-returned bounds cannot close the loading-window gap Step 3 exists to close.

**The risk it introduces, and why it is low:** `(public)` had **zero server data reads** before this, and `PublicLayout` is now `async`. The read uses **`createSupabaseAdminClient()` — service-role, no `cookies()`/`headers()` — inside `unstable_cache`** (60s, `TAGS.SETTINGS`). It is `cookies()` that forces dynamic rendering, not being async, so the standard static-safe pattern holds. It is `try/catch → null` and every bound is optional, so a failed read leaves the picker behaving exactly as before. **SHARED-NOTES §15 audited explicitly:** only two **numbers** cross the cache boundary, and the dates are derived on the **visitor's** clock inside `ScheduleStep`, so a prerendered page can never bake in a stale "today".

**⚠️ NAMED CHECK FOR THE SINGLE END-OF-PROGRAMME BUILD:** confirm the public routes still **prerender** and the build stays clean against the recorded baseline (**54/54 static**). This could not be checked here — builds are banned for agents, and the orchestrator's one allowance is reserved for last. **If that build shows public pages turning dynamic, revert `layout.tsx` + `booking-window-settings.ts`; Steps 1/2/3/5 remain intact without them.**

**Second deviation, accepted:** `getBookingDateBounds` lives in `src/lib/time/london.ts:111`, not the plan's `src/lib/booking/date-bounds.ts`, because the plan's location would make `london.ts ↔ date-bounds.ts` circular (the helper needs `getBusinessDate`/`addBusinessDays`).

**Untested seam, disclosed:** the `layout.tsx → ScheduleStep` threading has no unit test; it is covered by `tsc`, code reading, and a live RSC-payload check confirming `/services/` carries `bookingWindowDays: 29`, `minimumNoticeHours: 4`.

### 1.4 — Orchestrator process note

The implementer observed **HEAD moving under it mid-run** and an unexpected dirty file (`AddressAutocompleteField.test.tsx`, C-20's in-flight work). Both were the orchestrator's: C-20 bookkeeping commits and a concurrent C-20 fix landed while C-14 Phase D was implementing. Disjoint and harmless, but it is the same class of thing drift checkpoint #4 rated BLOCKING — **an implementer should see a still tree.** Bookkeeping commits should be batched until the in-flight implementer returns.

---

### 1.5 — Independent FULL verification — **PASS**, zero BLOCKING — `redesign/evidence/C-14/phase-d-verify-full.md`

- **Boundary independently re-derived, then confirmed live in both directions.** The verifier computed `addBusinessDays("2026-08-09", 29)` → `2026-09-07` from the code without relying on the implementer's figure, then probed the running server read-only: `2026-08-08` and `2026-09-08` **rejected** with *"Date is outside the booking window."*; `2026-08-09` and `2026-09-07` **accepted**. Picker bound and server bound agree exactly — the off-by-one this phase exists to prevent is genuinely absent.
- **The sweep test's baseline was audited, not assumed** — this was the check most worth making, because a sweep against a *wrong* "pre-refactor algorithm" proves nothing. The verifier quoted the real pre-refactor `isDateInBusinessWindow` from `git show 4583573^:src/lib/time/london.ts` against the test's inline `legacy` function: identical logic. The equivalence claim stands.
- **Notice semantics confirmed:** `isDateInBusinessWindow` passes no notice argument (lower bound stays `today`), and the per-slot 4-hour check remains in `isOutsideMinimumNotice` (`availability.ts:735-743`), untouched. Had the refactor accidentally made the server guard notice-aware, same-day evening slots would have broken — it did not.
- **Step 5 cross-plan hazard clear:** `AvailabilityCalendarField.tsx:231` is `disabled={[{ before: minDate }]}`, no `after`, no C-14 import — the file is **not even in the commit's diff**.
- **Both mutants killed:** exclusive upper bound → 2 tests failed; +1-day off-by-one → 6 failed.
- **Both deviations audited and upheld on the merits.** Deviation 1: no `cookies()`/`headers()` anywhere in the path, `unstable_cache`-wrapped, `try/catch → null`, all bounds optional, only two JSON-safe numbers cross the cache boundary, and `ScheduleStep` is confirmed `"use client"` deriving dates **without** `now` — so no "today" can be baked into a prerendered page. Deviation 2: the circular-import claim is **real** — `london.ts` uniquely exports `getBusinessDate`/`addBusinessDays` and already holds `isDateInBusinessWindow`, so the plan's location would have created a direct two-file cycle.
- **Informational:** the verifier's live probe returned 24 slots on 2026-09-07 vs the implementer's 23 — a different service/gender combination, not a boundary discrepancy. Recorded so a later reader does not mistake it for drift.

**Non-blocking, carried forward:** the `layout.tsx` edit remains an unexcused rule 6(b) halt violation (self-flagged, §1.3), and **the 54/54-static prerender check is genuinely unverified** until the single end-of-programme build.

---

## 2 — Phase A (Steps 6–9) — IMPLEMENTED + MIGRATION APPLIED

| Commit | What | Model |
|---|---|---|
| `17aade6` | Steps 6–7 — `working-hours-segments.ts` (+24 tests) and `WorkingHoursDayEditor.tsx` (+13 tests), **imported by nothing** | `opus` |
| `d9d252a` | Steps 8–9 — segments-aware `saveAvailabilityDay`, editor wired into `AvailabilityRulesManager`, migration file written | `opus` |
| *(applied)* | `c14_save_availability_day` — **applied to production 2026-08-09 under Owner approval** | orchestrator |

**Opus justification (§5):** RPC/transaction design and the segments contract feeding the live availability engine.

### 2.1 — Steps 6–7 were split from 8–9 deliberately, and it mattered

Steps 6–7 shipped **wired to nothing** (verified by grep across `src/`, `e2e/`, `scripts/`). Wiring the editor before the segments-aware save existed would have let staff enter a break, see it accepted, and have it **silently discarded** by a save path that still wrote one row per day. Steps 8 and 9 then shipped in **one** commit for the same reason. The cost of that choice is stated plainly: between `d9d252a` and the migration being applied, "Save hours" called an RPC that did not exist and failed loudly. **A loud failure is strictly better than silent data loss** — that is the trade, made on purpose.

### 2.2 — The engine premise was proven by execution, not asserted

The whole segments design rests on `getRuleWindowsForDay` already returning an **array** of windows and `containsWindow` booking only slots that fit inside one — which is why breaks need **zero engine change**. Rather than assert shape compatibility, the implementer fed real `scheduleToRows` output through the **real `calculateAvailableSlots`** (only the Supabase data layer faked): an 08:00–20:00 Monday broken 12:30–15:00 offered 11:30 and 15:00, **nothing** at 12:00/12:30/13:00/13:30/14:00/14:30, ending 19:00 — with a no-break control and a closed-day control alongside. The verifier independently confirmed that test imports the real engine rather than a stub, and that `availability.ts` is untouched by both commits.

### 2.3 — The privilege trap that did NOT fire, and why

Protocol §3b lists `staff_availability_rules` as still lacking `service_role` **UPDATE**, warning that tsc, lint and vitest are all blind to a missing GRANT while this codebase's habit of discarding the Supabase `error` makes it fail silently — the trap that cost C-04a a full verification cycle. Checked live before implementing:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `availability_rules` | ✓ | ✓ | ✓ | ✓ |
| `staff_availability_rules` | ✓ | ✓ | **✗** | ✓ |

**The segments model routes around it by construction** — delete-then-insert never updates. So Phase B is not blocked either. An argument in the storage model's favour that nobody had made.

### 2.4 — ⛔ Migration applied, and the post-apply verification

**Owner approved in chat, 2026-08-09**, after an adversarial SQL review returned PASS with zero blocking findings. That review re-derived the concurrency race independently (under READ COMMITTED a concurrent DELETE's EvalPlanQual recheck revisits only tuples it originally found, never rescanning for freshly-INSERTed rows — so two unlocked concurrent saves of one day really can leave **both** schedules present) and re-verified every claim in the migration header against live read-only queries.

**Applied. Verified live immediately after:**

| Function | `SECURITY DEFINER` | `search_path` | service_role | authenticated | anon |
|---|---|---|---|---|---|
| `assert_availability_day_segments(int, jsonb)` | **false** | `public` | ✓ | ✗ | ✗ |
| `save_availability_day(int, jsonb)` | **false** | `public` | ✓ | ✗ | ✗ |
| `save_staff_availability_day(uuid, int, jsonb)` | **false** | `public` | ✓ | ✗ | ✗ |

`SECURITY INVOKER` throughout (not DEFINER — `service_role` already holds every privilege the bodies need, so DEFINER would add an escalation surface for nothing). `search_path` pinned regardless, to satisfy the `function_search_path_mutable` advisor and match the existing idiom. EXECUTE granted to `service_role` **only**.

**Design points recorded so they are not re-litigated:** the advisory lock is load-bearing, not decoration; the empty-array guard is the single most important check in the file (without it a save could delete a day's rows and insert none, leaving **zero rows, which the engine reads as CLOSED** — silent and customer-facing); and `save_staff_availability_day` is a **separate** function rather than one with a nullable `p_staff_id` meaning "global", because a NULL-means-everyone overload turns one forgotten argument into an unnoticed rewrite of the clinic-wide schedule.

**Rollback if ever needed:** `DROP FUNCTION` ×3. Applying altered **no data** — the `DELETE`s live inside the functions and run only when someone saves a day, always paired with their INSERT in the same transaction.

### 2.5 — ⛔ NOT DONE: the Phase A verify checkpoint needs a SECOND approval

The plan's Phase A checkpoint is a live round-trip: set Monday to 08:00–20:00 with a 12:30–15:00 break, save, confirm the DB holds **2** `is_working_day = true` Monday rows, then confirm customer slots appear either side of the break and none across it.

**Not performed.** It writes to `availability_rules` — the clinic's **real global schedule** — and would immediately stop customers booking Monday afternoons until reverted. The Owner approved *applying the migration*, not *changing the live rota*; per-action approval does not carry forward. **This is the largest outstanding item on the plan and needs its own ⛔.**

A lower-risk variant worth offering: call `save_availability_day(1, <Monday's CURRENT segments>)`, which exercises the RPC end-to-end and is semantically a no-op (it re-inserts identical hours). It still churns row ids and is still a production write, so it still needs approval — but it proves the function works without altering what customers see.

**Also unverifiable until such a round-trip runs:** every SQL-level `RAISE EXCEPTION` path (only their TypeScript mirrors in `validateSchedule` are tested), atomicity and the advisory lock in practice, and `save_staff_availability_day`, which has no caller until Phase B Step 10.

### 2.6 — Noted, left alone (rule 6a)

- Pre-existing hardcoded `oklch(...)` literals in `AvailabilityRulesManager.tsx` (~4 sites), including a **light** day-row background pair in a dark-default admin theme. Predates C-14.
- `audit_logs` inserts in `availability/actions.ts` do not check their own error — pre-existing across every action in that file.
- `deleteAvailabilityRule` is now an orphaned export (no UI caller since the segments editor replaced the per-row delete flow). Harmless today; **if ever re-wired it would need the same advisory lock**.
- "Save hours" issues **seven** RPC calls, one per day. Each *day* is atomic; the seven together are not. Unchanged in kind (it was seven row-writes before) and the plan scopes atomicity to the day — flagged so it is not mistaken for a new guarantee.

---

## 3 — ▶ Position

**Phase D ✅ implemented and FULL-verified. Phase A ✅ implemented, FULL-verified, migration applied** — except its live round-trip checkpoint (§2.5), which needs its own ⛔.
**Phase B not started** (Steps 10–11 — reuse the editor for per-staff rules; the RPC it needs is already deployed). **Phase C not started** — needs the second ⛔ migration in §0.2.

---

# ▶▶ PROGRAMME INTERRUPT CHECKPOINT — 2026-08-09 — READ FIRST ON RESUME

**Everything still open is blocked on an Owner decision. No agent is running; nothing is mid-flight; the tree is clean apart from the standing `maintenance.ts`.**

| Field | Value |
|---|---|
| Last-good commit | **`4611ee7`** (this checkpoint commit follows it) |
| Files mid-flight | **NONE.** Only `src/lib/maintenance.ts` (standing Owner change — never stage) |
| Master-plan rows | **20 of 23 ✅.** Remaining: **C-20** (implementation complete, held on one decision), **C-14** (Phase D done; A/B/C blocked on ⛔), **C-10** (not started, and correctly so) |
| Drift checkpoint #4 | **DONE** — `DRIFT-CHECKPOINT-4-FORMAL.md`, verdict FAIL, all three findings remediated or logged |
| Baseline BY IDENTITY | tsc **0** · vitest failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 (totals at `4583573`: **5 failed / 2070 passed / 2075**) · eslint **59E/7W** in exactly the six baseline files |

### The four Owner decisions that unblock everything

1. **C-20 consent classification** — Maps as *functional-on-interaction* or *consent-gated*? Unblocks Step 9's registry half, the last thing between C-20 and ✅. Bumps `CONSENT_BANNER_VERSION` (re-prompts returning visitors).
2. **C-14 Phase C migration (⛔)** — the two `DROP`s in §0.2, shipping atomically with the `createAvailabilityOverride` rewrite.
3. **C-23's two gate rulings** (§3.4b of the C-23 progress file) — recommendation: accept the code-level proof.
4. **The recurring-series email defect** (`OWNER-ACTION-BACKLOG.md`) — a ~4-line fix no remaining plan owns.

### Why C-10 has NOT been started, deliberately

C-10 measures **final** page heights, and C-14's remaining phases add the working-hours editor to the admin availability pages. Cataloguing now would record geometry C-14 then invalidates — precisely the failure C-10's own pre-flight #4 warns about for C-16. **C-10 must run after C-14 completes.** It needs the dev server plus an Owner admin session, both currently available.

### EXACT NEXT ACTIONS, in order

1. Get decision #1 → implement C-20 Step 9's registry half + `CONSENT_BANNER_VERSION` bump → re-verify → flip C-20 to ✅.
2. C-14 Phase A Steps 6–8 (`working-hours-segments.ts`, `WorkingHoursDayEditor`, wire into `AvailabilityRulesManager`) — **no ⛔ until Step 9's RPC choice**; §0.1(a) shows the schema does not force an RPC.
3. C-14 Phase B, then Phase C behind decision #2.
4. C-10 Phases A and B last.
5. **The single orchestrator build, last of all** — and it must specifically confirm **54/54 static** (§1.3's named check) plus C-20's +3 kB and C-23's +6 kB bundle ceilings, none of which any agent could measure.
6. Restore `src/lib/maintenance.ts` to `MAINTENANCE_MODE = true` **before any deploy**, and state its state in the final report.

**Gates by identity at `4583573`:** tsc 0 · vitest **5 failed / 2070 passed (2075)**, the five inherited by name · lint **59E/7W** in exactly the six baseline files. Build NOT RUN (banned).
