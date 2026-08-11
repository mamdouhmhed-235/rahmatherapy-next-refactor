# D4 — `src/lib/booking/availability.ts` — Phase 1 app-side read-only recon

Read-only verification pass. Target file: `src/lib/booking/availability.ts` (970 lines total, confirmed by `Read`).

Decision 9 in force: this is expand-contract. Application reads `free_travel_cities`; the settings write path must dual-write both columns; `allowed_cities` stays live in the DB (read by `create_booking_request`) until Phase 2/Step Z.

---

## 1. `BusinessSettingsRecord` interface — claimed line 58 for the field

**Verdict: line claim CONFIRMED.** The interface starts at line 54, and `allowed_cities` is exactly at line 58.

Byte-exact quote (lines 54–60):

```
interface BusinessSettingsRecord {
  booking_window_days: number;
  buffer_time_mins: number;
  minimum_notice_hours: number;
  allowed_cities: unknown;
  booking_status_enabled: boolean;
}
```

Not exported (no `export` keyword) — see item 6.

---

## 2. `loadSettings` — claimed select string at line 433

**Verdict: line claim CONFIRMED.** Function spans lines 429–441; the select-string literal is exactly on line 433.

Byte-exact quote (lines 429–441):

```
async function loadSettings(supabase: SupabaseClient) {
  const settingsResult = await supabase
    .from("business_settings")
    .select(
      "booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled"
    )
    .eq("id", 1)
    .single<BusinessSettingsRecord>();

  return settingsResult.error || !settingsResult.data
    ? null
    : settingsResult.data;
}
```

**How the select string is written:** it is **one single string literal**, not concatenated (`+`) and not a template literal. The multi-line layout is pure formatting — Prettier put the 105-character literal on its own line (line 433) because `.select("...")` all on one line would exceed the print width. There is no line break, escape, or concatenation operator inside the string itself. An edit that changes `allowed_cities` → `free_travel_cities` inside this literal is a single in-string substring replacement on line 433; it does not touch lines 432 or 434 (the `.select(` and closing `)` stay put), and the result is 5 characters longer (`free_travel_cities` is 5 chars longer than `allowed_cities`), which may or may not push the literal over the print-width threshold that caused it to be split in the first place — not something I changed or verified against Prettier, flagging only as something a formatter pass could reflow.

---

## 3. `getAllowedCities` and `isCityAllowed` — claimed lines 243–257

**Verdict: line claim CONFIRMED.** Both functions occupy exactly lines 243–257.

Byte-exact quote (lines 243–257):

```
function getAllowedCities(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((city): city is string => typeof city === "string")
        .map((city) => city.trim().toLowerCase())
    : [];
}

function isCityAllowed(city: string, allowedCities: string[]) {
  const normalizedCity = city.trim().toLowerCase();
  return allowedCities.some(
    (allowedCity) =>
      normalizedCity === allowedCity || normalizedCity.includes(allowedCity)
  );
}
```

**Behavior on `undefined`/`null` input:** `Array.isArray(undefined)` and `Array.isArray(null)` are both `false`, so `getAllowedCities` returns `[]` (the ternary's else branch) — no throw, no `undefined` propagation.

**Behavior on a non-array input** (e.g. a string, object, number): same path — `Array.isArray` is `false`, returns `[]`.

**Why this matters concretely (confirmed, not hypothetical):** `isCityAllowed(city, [])` calls `.some()` on an empty array, which is always `false` for any `city`. So if `settings.free_travel_cities` is `undefined` at runtime (e.g. a test fixture still keyed `allowed_cities` after the field is renamed in the code that reads it), every city gets rejected and `loadContextRest` returns `{ reason: "Location is outside the service area.", durationMins: 0 }` unconditionally — a silent, no-crash failure mode. I confirmed this is not theoretical: see item 7, four existing test files currently supply the fixture under the key `allowed_cities` and would hit exactly this path if `availability.ts` is switched to read `free_travel_cities` without updating those fixtures in the same change.

---

## 4. `loadContextRest`'s city gate — claimed lines 454–456

**Verdict: line claim CONFIRMED.** The gate is exactly at lines 454–456.

Byte-exact quote with ~10 lines of context either side (lines 443–464):

```
/**
 * Loads everything that does not depend on the requested date: city and
 * service checks, eligible staff (with booking permissions), and the global
 * and per-staff weekly availability rules. Reason strings mirror the
 * original single-date implementation exactly.
 */
async function loadContextRest(
  supabase: SupabaseClient,
  settings: BusinessSettingsRecord,
  input: { serviceIds: string[]; participantGenders: TherapistGender[]; city: string }
): Promise<AvailabilityContext | ContextFailure> {
  if (!isCityAllowed(input.city, getAllowedCities(settings.allowed_cities))) {
    return { reason: "Location is outside the service area.", durationMins: 0 };
  }

  const serviceResult = await supabase
    .from("services")
    .select("slug, duration_mins, gender_restrictions")
    .in("slug", input.serviceIds)
    .eq("is_active", true)
    .eq("is_visible_on_frontend", true)
    .returns<ServiceRecord[]>();
```

**Minimal Phase-1-only edit, confirmed:** the gate *logic* (the `if (!isCityAllowed(...)) return { reason: ... }` shape, the reason string, the early return) is unchanged in Phase 1 — only the field name read on line 454 changes, from `settings.allowed_cities` to `settings.free_travel_cities`. The gate itself (i.e. removing this `if` block so out-of-zone cities become bookable-with-a-fee instead of rejected) is explicitly Phase 2 work, not Phase 1 — consistent with the task's framing that Phase 1 only renames the read. The three-line edit surface for Phase 1 is: line 58 (interface field name), line 433 (string literal substring), line 454 (`settings.allowed_cities` → `settings.free_travel_cities`).

---

## 5. Every other reference to `allowed_cities` in this file

**Verdict: 3 is the complete count**, confirmed by `Grep -n "allowed_cities"` scoped to this file only:

| Line | Context |
|---|---|
| 58 | `allowed_cities: unknown;` — interface field |
| 433 | inside the `.select(...)` string literal |
| 454 | `settings.allowed_cities` — the gate read |

No other occurrence exists anywhere else in the 970-line file (no comments, no other functions, no re-exports).

---

## 6. Does anything else in `src/` import from this file in a way that depends on `BusinessSettingsRecord`'s field names?

**Verdict: No.** `BusinessSettingsRecord` (line 54) has **no `export` keyword** — it is module-private to `availability.ts`. TypeScript cannot import a non-exported interface, so nothing in `src/` can have a compile-time dependency on its field names via an import from this file.

Confirmed by checking what this file actually exports and who consumes it. Exported symbols from `availability.ts`: `TherapistGender`, `AvailabilityMode`, `CalculateAvailableSlotsInput`, `AvailableSlot`, `AvailableSlotsResult`, `CalculateAvailableDaysInput`, `AvailableDaySummary`, `AvailableDaysResult`, `calculateAvailableSlots`, `calculateAvailableDays`, `businessTimeForAvailability`. None of these expose `allowed_cities`/`free_travel_cities`.

Consumers found by grep (`from "../availability"` / `from "@/lib/booking/availability"`):
- `src/lib/booking/__tests__/working-hours-segments.test.ts` — imports `calculateAvailableSlots`
- `src/lib/booking/__tests__/staff-recurring-windows.test.ts` — imports `calculateAvailableSlots`
- `src/lib/booking/__tests__/override-windows.test.ts` — imports `calculateAvailableSlots`
- `src/lib/booking/__tests__/availability-options.test.ts` — imports `calculateAvailableDays`, `AvailableDaysResult`, `CalculateAvailableDaysInput`
- `src/app/api/availability/route.ts:3` — imports `calculateAvailableSlots`
- `src/app/api/availability/route.test.ts:7` — imports `calculateAvailableSlots`, `calculateAvailableDays` (and immediately `vi.mock`s the whole module — never touches real settings)
- `src/app/api/availability/month/route.ts:3` — imports `calculateAvailableDays`
- `src/app/api/admin/availability/month/route.ts:27` — imports `calculateAvailableDays`
- `src/app/admin/bookings/new/use-month-availability.ts:14` — imports the `TherapistGender` type only

**Caveat worth surfacing (not an import dependency, but adjacent):** `src/lib/booking/customer-manage.ts:62` independently declares its **own**, differently-named `interface BusinessSettingsRecord` — a coincidental name collision, not a shared type. Its fields are `company_name`, `contact_email`, `contact_phone`, `customer_cancellation_cutoff_hours` only — no `allowed_cities` field at all. It is unrelated to this change and requires no edit.

Separately (out of scope for this file, flagged for completeness only): several other `src/` files reference the **raw `allowed_cities` column name directly** against `business_settings`, independent of anything in `availability.ts` — `src/app/admin/settings/settings-data.ts`, `src/app/admin/settings/page.tsx`, `src/app/admin/settings/actions.ts`, `src/app/admin/settings/SettingsForm.tsx`, `src/app/admin/bookings/new/page.tsx`, `src/app/admin/bookings/new/ManualBookingForm.tsx` (comment only), and `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`. These are separately-typed readers/writers, not consumers of `availability.ts`'s `BusinessSettingsRecord` — but they are directly relevant to item 8 below.

---

## 7. Is there an existing test file for `availability.ts`? The plan claims none exists.

**Verdict: FALSE PREMISE — tests exist, plural, and the plan itself (§8.4, §8.12) correctly documents them.** I did not find any statement in `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` claiming no test exists for `availability.ts`; on the contrary the plan's own §8.4 consumer table explicitly lists four test-fixture files that must change in lockstep with this file, with a dedicated warning that a missed rename "fails silently." Whatever the source of the "none exists" claim, it does not match the plan text I could find, and it does not match the repository.

Confirmed by `Glob` + `Grep`, four test files directly exercise `calculateAvailableSlots`/`calculateAvailableDays` from this file **and** supply a `business_settings` fixture keyed `allowed_cities`:

| File | Import | `allowed_cities` fixture line(s) |
|---|---|---|
| `src/lib/booking/__tests__/availability-options.test.ts` | `calculateAvailableDays` | 49 |
| `src/lib/booking/__tests__/working-hours-segments.test.ts` | `calculateAvailableSlots` | 288 |
| `src/lib/booking/__tests__/staff-recurring-windows.test.ts` | `calculateAvailableSlots` | 70 |
| `src/lib/booking/__tests__/override-windows.test.ts` | `calculateAvailableSlots` | 84 **and** 379 (two separate fixtures in one file) |

Plus `src/app/api/availability/route.test.ts`, which imports both exported functions but `vi.mock("@/lib/booking/availability", ...)`s the entire module at the top of the file — it stubs `calculateAvailableSlots`/`calculateAvailableDays` directly and never constructs a `business_settings` fixture, so it is unaffected by this change (confirmed by reading the full 178-line file).

One more file, `src/lib/booking/__tests__/service-fuzzy-match.test.ts`, lives in the same `__tests__` directory but does **not** reference `availability` or `business_settings` at all (confirmed by grep, zero matches) — irrelevant here.

**Concrete mechanism, confirmed by reading `src/lib/cache/__tests__/fake-supabase-admin.ts`** (the shared fake client all four fixture files use): every chain method including `.select(...)` is a no-op passthrough (`chain[method] = () => chain`) — the fake client returns the **entire registered `data` object verbatim**, completely ignoring the select-column-list argument. This means:
- The select-string edit (item 2) has **zero effect** on these four tests either way — they never look at the select string.
- But the fixture object's **key name** matters enormously: today it is `allowed_cities: ["Luton"]`. Once `availability.ts` reads `settings.free_travel_cities` (post-edit), a fixture still keyed `allowed_cities` produces `settings.free_travel_cities === undefined` at runtime.
- `undefined` → `getAllowedCities(undefined)` → `[]` (item 3) → `isCityAllowed(city, [])` → `false` for every city → `loadContextRest` returns the "Location is outside the service area." failure for every test in all four files.
- This is exactly the "silent if missed" failure the plan's §8.4 already calls out — I independently confirmed the mechanism by reading the fake client's source, not just by trusting the plan's prose.

**Net:** editing `availability.ts` alone, without renaming the fixture key in these same four files, will break every existing test that exercises `calculateAvailableSlots`/`calculateAvailableDays` with a real (non-mocked) settings fixture. This is in-scope risk for whoever executes the Phase 1 app edit, even though the fixture files themselves are outside this report's target file.

---

## 8. RISK CHECK — other writers of `business_settings` that could desync `allowed_cities` from `free_travel_cities`

**Verdict: YES — found exactly one writer in `src/`, and as of this read it does NOT dual-write. This is a live, current desync risk, not a hypothetical.**

Repo-wide search method: `Grep "allowed_cities"` with no path/glob restriction across the whole repo (not just `src/`), plus a targeted search of `supabase/` and `scripts/` for writes.

**The one writer:** `src/app/admin/settings/actions.ts`, function `updateBusinessSettings` (the only server action that touches `business_settings`; confirmed no other `src/` file calls `.from("business_settings").upsert(...)`/`.insert(...)`/`.update(...)` — the only other `business_settings` references in `src/` are `.select(...)` reads, listed in item 6's closing paragraph). Byte-exact quote of the write path (lines 83–100 of `actions.ts`):

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

**This payload writes `allowed_cities` only. It does not include `free_travel_cities` anywhere.** A PostgREST `upsert` only touches the columns present in the payload's `ON CONFLICT DO UPDATE SET` clause — columns absent from the payload (here, `free_travel_cities` and `mileage_origin`) are left untouched on an existing row. So today, every time an admin saves the settings form, `allowed_cities` updates but `free_travel_cities` does not move — it stays frozen at whatever the Phase 1a migration's one-time backfill set it to.

**This is not my inference alone — the shipped migration says the same thing, in its own comments,** confirming this is known, expected, not-yet-done work rather than a surprise: `supabase/migrations/20260811200000_item8_phase1a_free_travel_cities.sql` (lines 53–56):
```
-- Backfill, guarded so a re-run can never clobber values the application has
-- since written. Once free_travel_cities holds anything but the default, this
-- is a no-op -- which matters because the application dual-writes both columns
-- from the moment Phase 1's code ships.
```
That comment describes the **intended end state**, not the current one — I read `actions.ts` directly (above) and it does not yet dual-write. The plan (`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` line 94 and lines 2553/2557) also names `settings/actions.ts`'s upsert payload (line 92) as needing the dual-write edit, and separately requires the field-name rename in the same file (form-parse line 49, `fieldErrors` line 68, payload key line 92) — so the same file needs both a rename (`allowed_cities` → stays as the DB write key, is NOT dropped) and an addition (`free_travel_cities: allowedCities` added to the same payload) plus the two are the same array of strings written twice under two keys.

**Other candidate writers checked and ruled out:**
- `scripts/` — `Grep "allowed_cities"` under `scripts/`, **zero matches**. No seed/CLI script writes this column.
- `supabase/migrations/` — five migrations reference `allowed_cities`, all either the original column definition (`20260502052540_...`), a one-time seed with a guarded `UPDATE` that only fires `when ... = '[]'::jsonb` (`20260502160000_...`), or `SELECT`-only reads inside `create_booking_request`'s PL/pgSQL body (`20260503150000_...:178`, `20260513120100_...:310`, `20260727120000_c06_client_crud_hardening.sql:405`) — none of these are ongoing/repeatable writers that could run again post-deploy and desync the two columns; they are historical, already-applied, one-time migrations.
- No admin tool, cron, or edge function under `src/` other than `actions.ts` touches `business_settings` for writes (confirmed by the `business_settings` files_with_matches list in item 6 — every other hit is a `.select()`/type-only reference).

**Conclusion for the risk check:** the *only* path that can desync the two columns going forward is `src/app/admin/settings/actions.ts`'s `updateBusinessSettings` upsert, and as of this read it is a single-column writer (`allowed_cities` only). Until that file's payload is changed to also set `free_travel_cities: allowedCities`, any admin edit to the service-area list will silently stop being reflected in whichever column the app is reading from at that time — this is the exact hazard the task's setup paragraph and the migration's own comments describe, and I've now confirmed it is still open as of the current `actions.ts` source, not yet closed. Fixing it is outside this report's target file (`availability.ts`) but is a hard prerequisite: switching `availability.ts` to read `free_travel_cities` without this fix ships correctly only because the one-time migration backfill happens to make the two columns equal *today* — the first admin settings save after that point would silently freeze `free_travel_cities` while `allowed_cities` (and the SQL gate reading it) kept moving, or vice versa once `availability.ts` is the one reading the frozen column.

---

## Summary of line-claim verification (target file only)

| Claim | Claimed line(s) | Actual line(s) | Verdict |
|---|---|---|---|
| `BusinessSettingsRecord.allowed_cities` | 58 | 58 | CONFIRMED |
| `loadSettings` select string | 433 | 433 | CONFIRMED |
| `getAllowedCities`/`isCityAllowed` | 243–257 | 243–257 | CONFIRMED |
| `loadContextRest` city gate | 454–456 | 454–456 | CONFIRMED |

All four line claims specific to `availability.ts` in the task brief check out exactly. The material findings in this report are not about drifted line numbers but about (a) the exact single-literal shape of the select string, (b) `getAllowedCities`'s undefined/non-array fallback to `[]` and its silent-failure consequence, (c) confirming — by reading the fake client's source, not by assumption — that four existing test files will break silently if their fixture key isn't renamed alongside this file, and (d) confirming that the one real writer of `business_settings` (`actions.ts`) does not yet dual-write, which is the live version of the risk the task asked me to check for.
