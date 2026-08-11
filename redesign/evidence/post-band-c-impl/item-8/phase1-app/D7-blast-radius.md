# Item 8 Phase 1 (App) — D7: Repo-wide blast-radius sweep

Read-only sweep. No files under `src/`, `scripts/`, `e2e/`, `supabase/`, or the repo root
were touched. This report is the only file this pass wrote.

Context held while running this: the DB half of Phase 1 has shipped (`e8a2faf`).
`business_settings` has 12 columns; `allowed_cities` and `free_travel_cities` both
currently hold `["Luton","Dunstable"]`; `mileage_origin` exists and is `NULL`.
Decision 9 (expand-contract, not rename) governs everything below: app code must
**read** `free_travel_cities` but the write path must **dual-write both columns**
until the SQL gate (`create_booking_request`) is migrated off `allowed_cities` in a
later phase.

---

## 1. `allowed_cities` — case-sensitive, whole repo

Command: `rg` (case-sensitive) for `allowed_cities`, no path restriction.
Raw result: **351 occurrences across 57 files.**

Classified:

| Class | Files | Occurrences |
|---|---|---|
| (a) `src/` code | 12 | 22 |
| (b) SQL under `supabase/` | 7 | 18 |
| (c) `e2e/` | 0 | 0 |
| (d) `scripts/` | 0 | 0 |
| (e) docs under `redesign/` or `implementation-plans/` | 38 | 311 |
| **Total** | **57** | **351** |

22 + 18 + 0 + 0 + 311 = 351, and 12+7+0+0+38 = 57 — the classification accounts
for every hit and every file the raw command reported.

**Warning honored**: class (e) is 311 of the 351 hits (89%) and is planning/evidence
prose (the plan itself, HANDOFF docs, `plan-deepening/*`, `per-page-*`,
`briefs/*`, prior evidence files including this task's own sibling reports
`A-rename-hazard.md`, `C-consumer-anchors.md`, `R1-refute-rename.md`, which
themselves quote `allowed_cities` repeatedly while discussing it). None of that
is a code consumer. The number the caller actually needs is class (a): **12
files, 22 occurrences** — that is the real blast radius in application code.
One doc-adjacent SQL file, `redesign/evidence/C-06/create_booking_request-BEFORE.sql`,
is a historical snapshot (a `.sql` file, but living under `redesign/evidence/`,
not `supabase/migrations/`) — folded into class (e), not (b), since it is not a
migration that runs.

**Class (a) — full list, `src/` code (12 files, 22 hits):**

| File | Hits | Nature |
|---|---|---|
| `src/lib/booking/availability.ts` | 3 | live booking-availability read + gate check |
| `src/lib/booking/__tests__/override-windows.test.ts` | 2 | mock fixture key |
| `src/lib/booking/__tests__/working-hours-segments.test.ts` | 1 | mock fixture key |
| `src/lib/booking/__tests__/staff-recurring-windows.test.ts` | 1 | mock fixture key |
| `src/lib/booking/__tests__/availability-options.test.ts` | 1 | mock fixture key |
| `src/app/admin/bookings/new/page.tsx` | 2 | `.select("allowed_cities")` + destructure |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | 1 | doc comment only, no code reference |
| `src/app/admin/settings/page.tsx` | 1 | `fallbackSettings.allowed_cities` |
| `src/app/admin/settings/settings-data.ts` | 1 | `BusinessSettingsRow.allowed_cities` type field |
| `src/app/admin/settings/actions.ts` | 3 | parse form field, validate, write into upsert payload |
| `src/app/admin/settings/SettingsForm.tsx` | 5 | prop type, state init, dirty-check, error key, hidden input `name` |
| `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` | 1 | `data.set("allowed_cities", ...)` test helper |

**Class (b) — full list, SQL under `supabase/` (7 files, 18 hits):**

| File | Hits | Nature |
|---|---|---|
| `supabase/migrations/20260811200000_item8_phase1a_free_travel_cities.sql` | 8 | the already-applied expand migration itself (comments + backfill) |
| `supabase/migrations/20260502160000_phase6_seed_business_settings_and_global_availability.sql` | 5 | original column creation/seed |
| `supabase/migrations/20260802122636_c02_recurring_bookings.sql` | 1 | comment (`-- * No allowed_cities check.`) |
| `supabase/migrations/20260727120000_c06_client_crud_hardening.sql` | 1 | historical migration reference |
| `supabase/migrations/20260513120100_update_create_booking_request_per_participant_services.sql` | 1 | `create_booking_request` body reads `v_settings.allowed_cities` |
| `supabase/migrations/20260503150000_phase2_booking_atomic_snapshots.sql` | 1 | historical migration reference |
| `supabase/migrations/20260502052540_phase2_group6_settings_and_audit.sql` | 1 | historical migration reference |

**Class (c) `e2e/` and (d) `scripts/`: zero hits, confirmed with a path-scoped
re-run of the same pattern against each directory individually** (not inferred
from the global list's absence — see command in §6/§4 below).

---

## 2. `free_travel_cities` and `mileage_origin` — case-sensitive, whole repo

Both confirmed **absent from `src/` today** (expected, since Phase 1 app code
has not landed yet). Full hit list, by class:

- **`free_travel_cities`**: 2 SQL hits (`supabase/migrations/20260811200000_item8_phase1a_free_travel_cities.sql`,
  the applied expand migration), remainder (≈35 hits) all in `redesign/` planning/evidence
  docs. Zero in `src/`, `e2e/`, `scripts/`.
- **`mileage_origin`**: 5 SQL hits split across
  `supabase/migrations/20260811200000_item8_phase1a_free_travel_cities.sql` (adds the
  column) and `supabase/migrations/20260811200100_item8_phase1b_manage_travel_origin_permission.sql`
  (comment reference), remainder all in `redesign/` docs. Zero in `src/`, `e2e/`, `scripts/`.

Confirmed by direct path-scoped searches:
- `rg "free_travel_cities|mileage_origin" src/` → **No matches.**
- `rg "free_travel_cities|mileage_origin" e2e/` → **No matches.**
- `rg "free_travel_cities|mileage_origin" scripts/` → **No matches.**

**Additional finding, not asked for but load-bearing**: `PERMISSIONS.MANAGE_TRAVEL_ORIGIN`
(or any casing/spelling of `manage_travel_origin`) also does **not exist anywhere
in `src/`** — `rg "MANAGE_TRAVEL_ORIGIN|manage_travel_origin" src/` → no matches.
The DB-side permission row exists (per the task's stated context) but nothing in
`src/lib/auth/rbac.ts` or elsewhere references it yet. Whoever implements the
Owner-only `mileage_origin` gate in `actions.ts` is starting from zero on the
application side — there is no existing constant to extend, one must be added.

---

## 3. `business_settings` — every read and write in application code

Command: `rg "business_settings"` restricted to `src/`, `scripts/`, `e2e/`.
`scripts/` and `e2e/` both returned **zero matches** (confirmed directly, not
inferred). All real table access is in `src/`, in exactly **9 call sites across
8 files** (plus several test files that reference the string only as a mock
table-name key, not a live client call — listed separately below so the two are
not conflated).

**Authoritative list — every live `.from("business_settings")` call:**

| # | File:Line | Verb | Exact call | Columns |
|---|---|---|---|---|
| 1 | `src/app/admin/bookings/new/page.tsx:74-77` | READ | `.select("allowed_cities")` | explicit — `allowed_cities` only |
| 2 | `src/app/admin/bookings/assignment-eligibility.ts:182-186` | READ | `.select("buffer_time_mins")` | explicit — `buffer_time_mins` only, no city column |
| 3 | `src/lib/email/notifications.ts:178-182` | READ | `.select("company_name, contact_email, contact_phone")` | explicit, no city column |
| 4 | `src/app/admin/settings/settings-data.ts:99-103` | READ | `.select("*")` | `"*"` |
| 5 | `src/lib/booking/booking-window-settings.ts:38-45` | READ | `.select("booking_window_days, minimum_notice_hours")` | explicit, no city column |
| 6 | `src/lib/booking/availability.ts:430-436` | READ | `.select("booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled")` | explicit — includes `allowed_cities`, feeds the app-side city gate at `:454` |
| 7 | `src/lib/booking/customer-manage.ts:254-258` | READ | `.select("company_name, contact_email, contact_phone, customer_cancellation_cutoff_hours")` | explicit, no city column |
| 8 | `src/app/admin/settings/actions.ts:77-81` | READ | `.select("*")` (audit `beforeState`) | `"*"` |
| 9 | `src/app/admin/settings/actions.ts:96-100` | **WRITE** | `.upsert(payload, { onConflict: "id" }).select().single()` | payload is an explicit object (below) — **THE ONLY WRITER** |

Exact write-path text (`src/app/admin/settings/actions.ts:83-100`), byte-for-byte:

```
  const payload = {
    id: 1,
    company_name: companyName,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
    booking_window_days: bookingWindowDays,
    buffer_time_mins: bufferTimeMins,
    minimum_notice_hours: minimumNoticeHours,
    customer_cancellation_cutoff_hours: cancellationCutoffHours,
    allowed_cities: allowedCities,
    booking_status_enabled: formData.get("booking_status_enabled") === "on",
  };

  const { data, error } = await adminClient
    .from("business_settings")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
```

**This payload does not currently include `free_travel_cities` or
`mileage_origin` at all.** This is the exact spot the dual-write must be added
to (`allowed_cities: allowedCities, free_travel_cities: allowedCities,` at
minimum, plus wiring for `mileage_origin` once the Owner-only gate exists — see
§4/§2's `MANAGE_TRAVEL_ORIGIN` finding).

**Two of the 9 call sites (#6 `availability.ts` and #1 `page.tsx`) are the ones
that read `allowed_cities` for logic that matters** — #6 feeds the app-side
`isCityAllowed` pre-check, #1 feeds an inline warning on the manual-booking
form. Per Decision 9 both should move to reading `free_travel_cities` once it's
populated; #6's read does **not** replace the SQL gate (`create_booking_request`
still enforces `allowed_cities` independently at the DB layer per the task's
context) — it is a separate, redundant app-side check, so moving it to the new
column does not by itself change what the DB ultimately allows.

**Not the same set as the plan's 12-file `allowed_cities` list.** The
`business_settings` table has 8 consumer files; the `allowed_cities` string has
12 consumer files (§1a). The 4 extra are pure test-fixture files
(`src/lib/booking/__tests__/*.test.ts` ×4 minus one already counted, plus
`updateBusinessSettings.test.ts`) that reference the literal string without a
live `.from("business_settings")` call, and `ManualBookingForm.tsx`, which only
has a doc comment. Do not substitute one list for the other.

**Mock-only references** (string used as a key inside a hand-rolled mock
Supabase client, not a live call — excluded from the table above, listed here
for completeness since the caller asked for "every read and write... anywhere
in application code" and these are easy to mistake for real access):
`src/app/admin/bookings/__tests__/assignment-eligibility-overrides.test.ts`,
`src/app/admin/bookings/__tests__/quickUpdateBookingCancel.test.ts`,
`src/app/admin/settings/__tests__/settings-data.test.ts`,
`src/lib/booking/__tests__/{working-hours-segments,staff-recurring-windows,override-windows,availability-options}.test.ts`,
and nine `src/lib/email/__tests__/send*.test.ts` files (mock-table dispatch on
`table === "business_settings"`). None of these write anything; they only stub
what a `.select()` should return in-memory.

---

## 4. Any writer of `business_settings` other than `src/app/admin/settings/actions.ts`?

**No. Definitively.** Evidence:

- `rg "business_settings" scripts/` → **zero matches** (no seed script, no cron,
  nothing under `scripts/*.mjs`/`*.py` touches this table at all).
- `rg "business_settings" e2e/` → **zero matches** (no Playwright helper writes
  to it directly; e2e exercises the app through the UI/API only).
- Within `src/`, all 9 live call sites were individually read (§3's table) —
  exactly one (`actions.ts:96-100`) is a mutation (`.upsert`). The other 8 are
  reads. There is no API route under `src/app/api/` touching this table (the
  `src/` search covers `src/app/api/**` too — nothing matched there).
- The only other place `business_settings` is written is inside already-applied
  SQL migrations (`supabase/migrations/20260502160000_..._seed_business_settings...sql`
  for the original seed, and the Phase 1a migration's backfill `UPDATE`
  statement) — neither is application code, and the Phase 1a migration is the
  one that already made both columns consistent as a one-time backfill, not an
  ongoing writer.

So: **one writer, one file, one call site.** Dual-writing there is sufficient;
no second location needs the same fix.

---

## 5. `BOOKING_ALLOWED_CITIES` — confirmed separate, hardcoded, Phase 2's problem

`rg "BOOKING_ALLOWED_CITIES"` restricted to `src/` → exactly 2 files:

- **`src/features/booking/schemas/booking-schema.ts:5-11`** — the definition:
  ```
  export const BOOKING_ALLOWED_CITIES = [
    "luton",
    "dunstable",
    "houghton regis",
    "harpenden",
    "st albans",
  ] as const;
  ```
  Also used at `:148` inside `validateServiceArea`.
- **`src/features/booking/components/AboutYouStep.tsx`** — imported at `:18`,
  used at `:56` (`const COVERED_TOWNS = BOOKING_ALLOWED_CITIES.map(...)`) and
  `:127` (`isCovered` check inside the "is this city covered" logic).

This is a **five-town hardcoded client-side list**, structurally unrelated to
`business_settings.allowed_cities`/`free_travel_cities` (which today holds only
`["Luton","Dunstable"]`, two towns, sourced from the DB). Confirmed zero overlap
in code path: neither of these two files imports from `settings-data.ts`,
`actions.ts`, or reads `business_settings` in any way. Phase 1 must not touch
either file — this is exactly what the task instructions and the plan's own
evidence (`redesign/evidence/plan-deepening/item-08a-settings-gates.md:81-95`)
already concluded, and this pass independently re-confirms it by reading the
two files directly rather than trusting the prior doc.

---

## 6. e2e/ — does any spec depend on the settings form or `name="allowed_cities"`?

**No spec submits the settings form, and no spec depends on the hidden input's
`name` attribute. Confirmed definitively**, not inferred:

- `rg "allowed_cities|free_travel_cities|mileage_origin" e2e/` → **zero matches**
  across all 6 files in `e2e/` (`helpers.ts`, `admin-roles.spec.ts`,
  `booking-claiming.spec.ts`, `booking-public.spec.ts`,
  `admin-contrast-helpers.ts`, `admin-contrast.spec.ts`).
- `rg -i "settings|service area" e2e/` → 3 files. Read all three matches:
  - `e2e/admin-roles.spec.ts` (lines 44, 70, 94, 116) — the string `"Settings"`
    appears only inside `expectVisibleNavigation`/`expectHiddenNavigation`
    arrays, asserting the **nav link label** is shown/hidden per role. It never
    navigates into `/admin/settings`, never touches the form, never reads
    `allowed_cities`.
  - `e2e/booking-public.spec.ts:7` — test name contains the phrase "unsupported
    service area feedback", but the test body (read in full) only clicks
    through to step 2 and asserts a heading (`/who is this for|.../`) is
    visible. It never enters a city, never asserts on coverage/rejection copy.
    Renaming or dual-writing the settings column has **zero effect** on this
    test either way.
  - `e2e/admin-contrast-helpers.ts` — unrelated (contrast-audit tooling), the
    match is coincidental on the word "settings" inside comments/config, not
    the business_settings feature.

**Conclusion: a hidden-input rename from `name="allowed_cities"` to
`name="free_travel_cities"` (or an additive dual-name approach) would not break
any existing Playwright spec.** No spec would silently pass-but-lie either —
none of them assert on that field at all.

---

## 7. JSON fixtures, snapshots, MSW handlers

- `rg "allowed_cities|free_travel_cities|mileage_origin" --glob "*.json"` (whole
  repo) → **no files found.**
- `rg -rn "msw|rest\.handler|http\.get\(|setupServer" src/` (case-insensitive)
  → **no files found** — this codebase does not use MSW; test doubles are
  hand-rolled mock Supabase clients (see §3's "mock-only references" list).
- `**/__snapshots__/**` glob → **no files found** — no Vitest/Jest snapshot
  files exist in this repo at all.

Nothing encodes these keys outside TypeScript source, test fixtures already
covered in §1/§3, and SQL/docs.

---

## 8. `git status --porcelain` (read-only, captured before this report was written)

278 lines total, all pre-existing and unrelated to this sweep (this session made
zero writes before capturing this). Summarized:

- ~250 `D` (deleted) entries under `.playwright-mcp/console-*.log` and
  `.playwright-mcp/page-*.yml`, plus `D` entries under `design_handoff_public_pages/*`
  — pre-existing deletions, not touched this session.
- `M src/lib/maintenance.ts` — pre-existing modification, **not made by this
  session** (this session performed zero writes under `src/`).
- Untracked (`??`): `design_handoff_area_pages/`, `photos-rahma-therapy/`,
  13 files under `redesign/evidence/C-21/*.png`, `test-results/` — all
  pre-existing.

After this report is written, the only *new* change to the tree will be one
untracked file: `redesign/evidence/post-band-c-impl/item-8/phase1-app/D7-blast-radius.md`.
No file under `src/`, `scripts/`, `e2e/`, `supabase/`, or repo root was created,
edited, or deleted by this pass.

---

## Summary for the caller

1. **Real app-code blast radius for `allowed_cities` is 12 files / 22 hits** —
   the other 335 hits (SQL history + docs) are not consumers to update.
2. **`business_settings` has exactly 9 live call sites in 8 files: 8 reads, 1
   write.** The single write (`src/app/admin/settings/actions.ts:96-100`) is
   the only place the dual-write needs to be added — confirmed no other writer
   exists anywhere in `src/`, `scripts/`, or `e2e/`.
3. **`free_travel_cities` and `mileage_origin` are both 100% absent from `src/`
   today** — Phase 1 app code has not started. `MANAGE_TRAVEL_ORIGIN` is also
   absent from `src/lib/auth/rbac.ts` — the Owner-only gate has no existing
   constant to hook into; one must be created from scratch.
4. **`BOOKING_ALLOWED_CITIES` is confirmed structurally separate** (hardcoded
   5-town client constant, two files, zero code-path overlap with
   `business_settings`) — out of Phase 1 scope, independently re-verified.
5. **No e2e spec breaks from a settings-form field rename/dual-write** — none
   references `allowed_cities`, `free_travel_cities`, or `mileage_origin`, and
   the one spec whose *name* mentions "service area" doesn't assert on it.
6. **No JSON fixtures, snapshots, or MSW handlers exist for any of these keys**
   — this repo has no snapshot testing and no MSW usage at all.
