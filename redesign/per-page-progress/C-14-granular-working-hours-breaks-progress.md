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

## 2 — ▶ Position

**Phase D implemented (`4583573`), not yet independently verified.** Phases A, B and C **not started** — both remaining phases run into the ⛔ gates in §0.2.

**Gates by identity at `4583573`:** tsc 0 · vitest **5 failed / 2070 passed (2075)**, the five inherited by name · lint **59E/7W** in exactly the six baseline files. Build NOT RUN (banned).
