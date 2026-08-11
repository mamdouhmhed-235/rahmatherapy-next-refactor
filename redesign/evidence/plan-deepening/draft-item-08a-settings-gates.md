## ITEM 8 — Travel-charge model: free-travel areas + manually-set mileage fee

*(Added 2026-08-11. Owner-decided design. Research: three parallel code reviews + a feasibility study that rejected full automation — see §8.11. Deepened 2026-08-11: every file:line below was re-read directly and cross-checked live against Supabase project `twzutkfgqclqurvkmvqz`. **Locate by symbol first; if the line differs, that is the anchor drifting, not a reason to distrust the symbol.**)*

### 8.1 What the Owner decided

1. **`allowed_cities` inverts its meaning.** It stops being a *gate* ("who may book") and becomes the **free-travel zone** ("where we travel at no charge"). Addresses outside it remain **bookable**.
2. **The fee is set by hand, per booking, by an admin** — no distance API, no automated calculation.
3. **A new setting names where mileage is measured from** — an origin **chosen freely by the Owner**, not constrained to the free-travel towns.
4. **No hard outer boundary in code.** A far-away request simply arrives as `pending`; the admin declines it. **Admin discretion is the boundary.**
5. **The one-click confirm chip must be hidden** when an address is outside the free-travel zone and no fee is set.
6. **Recurring series repeat the same charge** — the fee from the first booking applies to every occurrence, not just one.
7. Consistency is the point: **change the towns in admin, and the booking page, admin alert and emails all follow.**
8. **Only the Owner role may edit the mileage origin.** Other settings stay Admin-editable.
9. **The free-travel list must keep its minimum of one entry.** An empty list is not a valid state.
10. **The fee may not be edited once a booking is `completed` or fully paid.**
11. **Series-level travel charge is in scope** — set on the series, applying to every occurrence.

### 8.2 The contradiction this also fixes

The town list exists in **three places that disagree**, which is why a Harpenden customer gets a green "covered" tick and then an empty calendar:

| # | Enforcement point | Allows | Behaviour |
|---|---|---|---|
| 1 | `src/features/booking/schemas/booking-schema.ts:5-11` (`BOOKING_ALLOWED_CITIES`) | **5 towns**, hardcoded | `validateServiceArea` (`:139-164`, wired at `:174`) raises a zod issue; `BookingExperience.tsx:429` `goToTime` then **refuses to advance past step 2** |
| 2 | `src/lib/booking/availability.ts:454` `isCityAllowed()` | **2 towns**, from `business_settings` | Returns **no slots** — the empty calendar |
| 3 | `create_booking_request` — `supabase/migrations/20260727120000_c06_client_crud_hardening.sql:399-410` | **2 towns** | `raise exception 'Location is outside the service area'` |

**Re-verified live, 2026-08-11:** `create_booking_request` is still the **only** DB function referencing `allowed_cities` (`SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` → one row), and **no RLS policy** references it (`pg_policies` → empty). `business_settings.allowed_cities` is `jsonb` and currently holds exactly `["Luton","Dunstable"]` — **this is the §8.9.G reversibility snapshot; it is recorded here so it cannot be lost.** Match is exact-or-contains (`lower(city) like '%luton%'`), so *"Houghton Regis"* fails. Gate 3 sits **after** `end if; -- end IF NOT p_override_availability`, so **admins cannot bypass it either** — there is currently no way to create an out-of-area booking anywhere in the product.

**A fourth place speaks the old meaning to a user**, and the previous revision missed it: `src/app/admin/bookings/new/ManualBookingForm.tsx` consumes an `allowedCities` prop, derives `isCityKnown`, and renders *"…is outside our current service area. We deliver to: …"*. It is **advisory only** — `isCityKnown` is read exactly once, for display, and blocks nothing — so item 8 needs no behavioural change there. But the **copy becomes false** the moment this item ships, and that line also carries item 7's #1 literal. See §8.8 and §10.1.

`create_recurring_booking_series` (`20260802122636_c02_recurring_bookings.sql:187`) deliberately never checked the city. **Leave it alone** — and note it, so nobody "fixes" it by adding a check that then has to be removed.

### 8.3 The model in one line

> **Two settings → one source of truth → three surfaces.**
> Free-travel areas + mileage origin, read by the booking page, the admin booking view, and the emails.

---

### 8.4 Phase 1 — Settings

**Rename the column** `allowed_cities` → `free_travel_cities` via `alter table business_settings rename column allowed_cities to free_travel_cities`. **Do not edit the historical migrations** — `20260502052540_phase2_group6_settings_and_audit.sql` (original column), `20260502160000_phase6_seed_business_settings_and_global_availability.sql` (seed), and the two now-superseded `create_booking_request` bodies (`20260503150000_phase2_booking_atomic_snapshots.sql:178`, `20260513120100_update_create_booking_request_per_participant_services.sql:310`) all stay untouched by design; only the live `create_booking_request` definition in `20260727120000_c06_client_crud_hardening.sql` needs a `create or replace`.

**Consumers of the column — 12 files, not ~8.** *(Corrected: the earlier count named 6 by path and estimated "~8"; the real number, confirmed by grep with no glob restriction, is 12. The six it missed are exactly: `ManualBookingForm.tsx` and five test files — see below.)*

| File | Symbol / line | Change |
|---|---|---|
| `src/lib/booking/availability.ts` | `BusinessSettingsRecord` interface field, line 58; select-string literal, `loadSettings` line 433; gate read, `loadContextRest` line 454 | rename + repurpose (§8.5) |
| `src/app/admin/settings/settings-data.ts` | `BusinessSettingsRow.allowed_cities`, line 47 | rename |
| `src/app/admin/settings/page.tsx` | `fallbackSettings.allowed_cities`, line 19 | rename |
| `src/app/admin/settings/actions.ts` | form-data parse line 49 (`String(formData.get("allowed_cities") ...)`); `fieldErrors.allowed_cities` line 68; upsert payload key line 92 | rename; reword message (below) |
| `src/app/admin/settings/SettingsForm.tsx` | interface field line 27; `useState` init line 59; dirty-check baseline line 76; error prop line 388; **hidden `<input name="allowed_cities">`** line 395 | rename; **the `name="allowed_cities"` HTML attribute is a separate decision — see "Open decision" below** |
| `src/app/admin/bookings/new/page.tsx` | `.select("allowed_cities")` line 75; destructure `settingsResult.data?.allowed_cities` line 84 | rename |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | doc comment line 547 (`business_settings.allowed_cities`); `allowedCities` prop, default `= []` at line 529, typed at line 550 | **was entirely absent from the file list — add it.** The prop name (`allowedCities`, camelCase) does not itself need to change, only the doc comment and the copy it feeds (§8.5) |
| `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` | `data.set("allowed_cities", ...)` line 83 | only if the HTML form-field name is renamed too — see "Open decision" |
| `src/lib/booking/__tests__/availability-options.test.ts` | fake-DB mock key, line 49 | rename — **silent if missed, see below** |
| `src/lib/booking/__tests__/working-hours-segments.test.ts` | fake-DB mock key, line 288 | rename — silent if missed |
| `src/lib/booking/__tests__/override-windows.test.ts` | fake-DB mock key, lines 84 and 379 | rename — silent if missed |
| `src/lib/booking/__tests__/staff-recurring-windows.test.ts` | fake-DB mock key, line 70 | rename — silent if missed |

**"Silent if missed" is load-bearing, not decoration.** `src/lib/cache/__tests__/fake-supabase-admin.ts:21` types `FakeQueryResult.data` as `unknown`. A mock literal like `{ allowed_cities: ["Luton"], ... }` compiles fine forever, regardless of what `availability.ts` actually selects — `tsc --noEmit` will not catch a stale key here. None of the four fixtures assert on the city gate itself today (they use `"Luton"` purely as a safe pass-through for staff-window/override/segment assertions unrelated to city), so a missed rename does not fail a test — it just makes `settings.free_travel_cities` `undefined` at runtime in those specs, silently. Rename all four in the same commit as the migration; do not treat them as optional cleanup.

**Add the origin setting** — `business_settings.mileage_origin text`, nullable, no default. Confirmed no naming collision (current `business_settings` columns: `id, company_name, contact_email, contact_phone, booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled, customer_cancellation_cutoff_hours`). It is free-form and descriptive only — nothing computes from it.

**✅ DECIDED — the mileage origin is Owner-only** (handoff §4 item 13). Implement it through a **new permission**, not a role-name check — this codebase has exactly one other Owner-exclusive gate (`manage_role_templates`) and it is permission-based, confirmed live:

```sql
SELECT r.name, p.name FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
WHERE p.name IN ('manage_settings','manage_role_templates');
-- manage_role_templates | Owner
-- manage_settings        | Admin
-- manage_settings        | Owner
```

`settings/actions.ts:24` (`requireSettingsManager`) gates the whole form with `PERMISSIONS.MANAGE_SETTINGS`. Add `manage_travel_origin`, granted to Owner only, and check it **specifically for the origin field** inside the existing action — the form keeps its single `MANAGE_SETTINGS` gate for everything else.

- **Server-side enforcement is the real gate.** Hiding the field in the UI is presentation only; an Admin who crafts the request must be rejected by the action, with a field-level error, not a 500.
- **Partial-save must succeed.** Compare the submitted `mileage_origin` against the stored value and only enforce the permission when it actually changed, or Admins cannot save any other setting either:
  ```ts
  // settings/actions.ts, inside updateBusinessSettings, after requireSettingsManager()
  const mileageOriginChanged = mileageOrigin !== (beforeState?.mileage_origin ?? "");
  if (mileageOriginChanged && !actor.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)) {
    fieldErrors.mileage_origin = "Only the practice owner can change the mileage origin.";
  }
  ```
  `requirePermission`/`hasPermission` are at `src/lib/auth/rbac.ts:401-423` and `:428-433`; `requireSettingsManager()` already returns a full `StaffProfile` with `.permissions: Set<string>`, so this needs no extra fetch.
- ⛔ **Needs a migration** (insert into `permissions`, insert into `role_permissions`) — Zone-2, Owner-approved. Exact SQL:
  ```sql
  insert into permissions (name, description, category, scope, risk_level, is_system, active)
  values ('manage_travel_origin', 'Edit the mileage-charge origin point on business settings.',
          'settings', 'operational', 'high', true, true);

  insert into role_permissions (role_id, permission_id)
  select r.id, p.id from roles r, permissions p
  where r.name = 'Owner' and p.name = 'manage_travel_origin';
  ```
  Rollback: `delete from role_permissions where permission_id = (select id from permissions where name = 'manage_travel_origin'); delete from permissions where name = 'manage_travel_origin';` — both pure additions, no other table references the new permission yet, so this is a clean, instant, no-data-loss rollback.
- Roles table for the migration (live, confirmed): `Admin 9f746458-a342-49ae-8b24-ff1a9068f422`, `Owner 2d5295c3-5d45-4c96-ab49-d5f87e0464b5` (full 5-row set also confirmed live if needed).

**✅ DECIDED — the free-travel list keeps its minimum of one entry.** `actions.ts:67-68`'s existing check stays:
```ts
if (allowedCities.length === 0) {
  fieldErrors.allowed_cities = "Enter at least one allowed service area.";
}
```
Rename the key (`fieldErrors.free_travel_cities` if the form field is also renamed — see below) and reword the message, e.g. *"Enter at least one free-travel area."*

**Rewrite the settings copy.** `SettingsForm.tsx`'s `ServiceAreaField` (component starts ~line 674) has three strings that become actively false once out-of-zone addresses are bookable — confirmed byte-for-byte:
- Line 378: *"Cities and towns where the team will travel. Customers booking outside these areas see a helpful message instead of a closed door."*
- Lines 708–711: *"No service areas yet. The booking form will currently turn every customer away. Add at least one city below."*
- Line 718: *"Service area. Customers within this area can book."*

All three describe a gate that Phase 2 removes. Replace with free-travel framing (e.g. "areas we travel to at no charge"; addresses outside are still bookable, at a manually-set fee).

**Open decision — does the HTML form field name change too?** (Not previously surfaced; genuinely undecided, and it changes what Phase 1 must edit.) `SettingsForm.tsx:395` posts a hidden input `name="allowed_cities"`; `actions.ts:49` reads `formData.get("allowed_cities")`. This is a same-origin server action, not a public API, so nothing external depends on the literal string.
- **If renamed** to match the column: `updateBusinessSettings.test.ts:83` (`data.set("allowed_cities", ...)`) must change too, or the test's "at least one" validation never sees a value and the test fails.
- **If left as `allowed_cities`**: no test change, but the form keeps one internal trace of "allowed" language the rename's own stated rationale (§8.2) argues against.

This is a two-line decision either way — **flag it to the Owner before Phase 1 lands**, don't guess; the two answers produce different, concrete file lists.

### 8.5 Phase 2 — Remove the three gates, create one source of truth

**Prerequisite: Phase 1's column rename must be applied first.** Phase 2's SQL and TS both read `free_travel_cities`, which does not exist until Migration A runs.

| Gate | Change |
|---|---|
| SQL `c06…sql:399-410` | **Stop raising.** Keep the city-**required** check at `:399-401` (`if v_clean_city = '' then raise exception 'City is required'; end if;`). Replace the `not exists (...) raise exception 'Location is outside the service area'` block (`:403-409`) with, at most, a boolean computed for reporting — never a raise. Rename every `v_settings.allowed_cities` reference to `v_settings.free_travel_cities` in the same `create or replace`, to match Migration A. Postgres has no partial-function-body ALTER — this must be a full `create or replace function`, sourced from the live definition (confirmed the only live function referencing the column via `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` → exactly one row, `create_booking_request`; **re-run this probe immediately before writing the migration** — if it now returns more than one row, stop, the blast radius has grown) |
| `availability.ts:454-456` | **Delete the block.** Confirmed nothing else in `loadContextRest` (lines 449-559) reads `input.city` after this — only `serviceIds` and `participantGenders` follow. `getAllowedCities`/`isCityAllowed` (`:243-257`) may be retained, renamed, and repurposed to compute a non-blocking `isFreeTravelZone` flag returned alongside the slots |
| `booking-schema.ts` | **Stop failing submission on city.** See the exact wire points below — there are two, not one |

**Correction: `validateServiceArea` is wired twice, not once.** The function body is `booking-schema.ts:139-161` (not `:139-164` as previously stated — line 161 is the closing brace). It is then wired at **two** separate call sites:
```ts
// :163-164 — wire point #1
export const bookingLocationSchema =
  bookingLocationFieldsSchema.superRefine(validateServiceArea);

// :174 — wire point #2, on bookingDetailsSchema
  .superRefine(validateServiceArea)
```
Both must be removed (or the function deleted and both `.superRefine` calls dropped) — removing only line 174 leaves `bookingLocationSchema` (line 164's export) still rejecting out-of-zone cities whenever it is called directly. **This matters concretely: `booking-schema.test.ts:39-47`'s existing test calls `bookingLocationSchema.safeParse(...)`, i.e. wire point #1, not #2** — so an implementer who reads only "wired at :174" and fixes only that site will watch this specific test keep failing for a reason that looks unrelated.

**Feed the real list to the public form.** Delete `BOOKING_ALLOWED_CITIES` (`booking-schema.ts:5-11`). Copy the existing proven pattern: `src/lib/booking/booking-window-settings.ts`'s `getPublicBookingWindow` (lines 34-59) already reads `business_settings` through `unstable_cache`, key `["public-booking-window"]`, `revalidate: 60`, tag `TAGS.SETTINGS` (`src/lib/cache/tag-taxonomy.ts:20`) — the exact tag `settings/actions.ts:112` already invalidates on save, so cache correctness is free. It uses the admin client (no `cookies()`, so `unstable_cache` stays legal) and fails safe to `null`.

**Prop path — traced hop by hop, confirmed mechanical but with one correction.**
1. `src/app/(public)/layout.tsx:21` — `const bookingWindow = MAINTENANCE_MODE ? null : await getPublicBookingWindow();`
2. `src/app/(public)/layout.tsx:42-43` — props on `<BookingExperienceLoader bookingWindowDays={...} minimumNoticeHours={...} />` (the closing `/>` is line 44 — trivial, not worth tracking separately).
3. `src/features/booking/BookingExperienceLoader.tsx:23-26` destructures both; lines 89-93 pass them straight into `<BookingExperience>`.
4. `src/features/booking/BookingExperience.tsx` interface `BookingExperienceProps` (`:81-82`), destructure (`:86-88`), passed to `<AboutYouStep ... bookingWindowDays={...} minimumNoticeHours={...} />` (`:704-705`).

**Correction: this chain does not currently reach `AboutYouStep`.** `AboutYouStepProps` (`AboutYouStep.tsx:26-30`) is `{ form, prefilled, onClearPrefill }` only — `bookingWindowDays`/`minimumNoticeHours` pass through `BookingExperience` to the date-picker step, not to `AboutYouStep`. A new `freeTravelCities` (or similarly-named) prop is therefore the **first** prop `AboutYouStep` receives via this chain, not a continuation of an existing one for that specific component — mechanically identical to add, but don't go looking for existing `AboutYouStep` prop-plumbing; there isn't any yet.

⚠️ **The zod schema is a pure module and cannot fetch.** Once out-of-zone stops being rejected, the town list is needed only for *display* (in `AboutYouStep`), so it arrives as a prop there, and the schema's refine is deleted outright rather than parameterized.

**`AboutYouStep.tsx` — confirmed present in this plan (§8.8), but its Phase 2 vs Phase 5 split needs to be explicit, not implicit.** *(Corrected: an earlier audit pass called this file "completely absent from the plan." It is not — §8.8 names it and quotes its exact lines. The real, narrower gap is a sequencing one: §8.8's copy rewrite is written as Phase 5 content, but the prop-threading and the blocking behaviour it displays are Phase 2 content, and nothing said what `AboutYouStep` should show in between.)* Resolve it like this — Phase 2 does both of the following in the same commit as the gate removal, so there is no window where the UI still says something false:
- Remove the `BOOKING_ALLOWED_CITIES` import; derive `COVERED_TOWNS` (`:56-58`) from the new prop instead of the constant; `isCovered`/`isOutsideCoverage` (`:123-131`) read the prop the same way.
- The `isOutsideCoverage` block (`:520-528`) currently renders `styles.noticeError` (red) with *"Outside current home visit area: We currently cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans. Use a covered town before choosing a time."* The **instruction to change the answer must go in Phase 2** — it is false the moment the gate is removed, regardless of whether the fee/origin copy is ready. Switch the notice to the same neutral treatment as the covered case (`:510-518`) with interim wording that does not depend on Phase 3/5 concepts, e.g. *"This address is outside our usual free-travel areas — it can still be booked."* **Phase 5 (§8.8) then finalizes the wording** to mention the travel charge and the mileage origin once those exist and the Owner has confirmed exact copy (see Stop conditions). Do not invent the final fee-mentioning copy in Phase 2.

**`ManualBookingForm.tsx` — add to Phase 2's file list; it independently reimplements the same check.** *(Confirmed genuinely absent from the plan until now — zero references to `isCityKnown` or `allowedCities` anywhere in the plan text before this draft.)* `isCityKnown` (`:1687-1693`) mirrors `create_booking_request`'s own predicate by design (see the file's own comment at `:1680-1684`), and renders a `role="alert"` red-text notice (`:1725-1729`): *"is outside our current service area. We deliver to: {allowedCities.join(", ")}."* Confirmed **non-blocking today** — `isCityKnown` has no `disabled` wiring anywhere in the file, only this JSX consumer. Required for Phase 2: reword the copy away from "outside our current service area" framing (it is no longer a rejection) and rename the doc comment at `:547-549`. The prop itself (`allowedCities`, `:529,550`) does not need renaming for Phase 2 — only its doc comment references the DB column name. **Do not wire a `disabled` gate here** — that is Owner decision #5 ("hide the confirm chip when a fee is needed"), which is Phase 3+ territory once `travel_fee` exists.

**`booking-schema.test.ts:39-47`** — *"rejects unsupported service areas before time selection"*, using `bookingLocationSchema` (wire point #1, confirmed by direct read). Invert it to assert success for the Manchester case; **this is the canonical proof the client gate is gone.**

---

### Full blast radius

**Proven affected** (every reader of the town list, or of money fields the rename could silently break, that this phase must touch):
- The 12-file `allowed_cities` consumer list above (§8.4 table).
- `booking-schema.ts` (both wire points), `booking-schema.test.ts`.
- `AboutYouStep.tsx` + `AboutYouStep.test.tsx` (below).
- `ManualBookingForm.tsx` (copy only, this phase).
- `availability.ts`, `(public)/layout.tsx`, `BookingExperienceLoader.tsx`, `BookingExperience.tsx` (prop threading).
- `booking-window-settings.ts` or a sibling module built on its exact pattern, for the new cached fetch.

**Proven NOT affected** (checked explicitly, command shown, do not re-check by hand unless one of these commands' output changes):
- **`src/app/booking/manage/`** — the known shared-surface trap. `grep -rin "city|booking-schema|BOOKING_ALLOWED_CITIES|allowed_cities|travel_fee|mileage" src/app/booking/manage` → **zero matches** across `actions.ts`, `ManageBookingForms.tsx`, `page.tsx`. This directory does not import `booking-schema.ts` and has no city-gating logic. It becomes relevant only for Phase 3's travel-fee display, out of this phase's scope.
- **No generated Supabase types file exists in this repo.** `find . -iname "*database.types*" -o -iname "*supabase.types*"` (excluding `node_modules`) → zero results. Nothing to regenerate.
- **RPC callers of `create_booking_request` / `create_recurring_booking_series` are unaffected by the rename.** 11 files reference either function by name; of the 9 not already in the tables above (`recurring-actions.ts`, `admin/clients/[clientId]/page.tsx`, `cron/extend-recurring-horizons/route.ts`, plus 6 test files), `grep -l "allowed_cities"` across all 9 → zero matches, exit code 1. They call the RPC with named parameters (`p_city`, etc.), never by column name, so an internal column rename inside the function body cannot reach them.
- **e2e**: `grep -rn "allowed_cities|BOOKING_ALLOWED_CITIES|outside our current|Manchester|service area|isCityAllowed|isCityKnown" e2e` → one hit, `e2e/booking-public.spec.ts:7`, whose test body never enters a city or asserts on coverage copy (it only checks the step-2 heading renders). Its **name** becomes slightly misleading after this phase (no more "unsupported service area feedback" to show) — cosmetic, not a breakage, fix opportunistically or leave for a docs pass.
- **Item 7 (admin colour/contrast)**: no file-level collision with any file in this phase, confirmed by grep — except `SettingsForm.tsx`, which Item 7's per-area literal sweep may independently touch for unrelated `className` literals. Coordinate on that one file if both are in flight at once; it is a merge-adjacency risk, not a semantic conflict.
- **Items 1–6**: none reference `business_settings`, `booking-schema.ts`, `availability.ts`, `AboutYouStep.tsx`, `SettingsForm.tsx`, `settings/actions.ts`, or `ManualBookingForm.tsx`.

---

### Ordering and prerequisites vs. the other items

- Within Item 8: **Phase 1 before Phase 2**, always — Phase 2 reads `free_travel_cities`, which Migration A creates.
- Within Migration A/B: rename column before the SQL-gate `create or replace`, since the gate rewrite references `v_settings.free_travel_cities`.
- Relative to the rest of the plan: Items 1–6 have zero file overlap with Phase 1–2. Item 7 shares only `SettingsForm.tsx`, and only incidentally (unrelated literal colours) — no ordering dependency, just a merge-adjacency note.
- Relative to Item 8's own later phases: Phase 3 (the fee itself, `bookings.travel_fee`) and Phase 5 (final customer/admin copy, emails) both build on Phase 2's prop and gate removal — they cannot start before Phase 2 lands. The plan's top-level table currently runs Item 7 before Item 8; that ordering defect is tracked at the plan's cross-cutting-facts level and does not change anything inside Phase 1–2 itself.

---

### Tests to add

All in existing files/directories, following this repo's established conventions (component → sibling `.test.tsx`; schema/lib module → co-located or `__tests__/`).

1. **`src/features/booking/schemas/booking-schema.test.ts`** — invert the existing Manchester case: rename or rewrite the `it()` currently titled `"rejects unsupported service areas before time selection"` to `"accepts an out-of-zone city and lets the customer continue to time selection"`, asserting `bookingLocationSchema.safeParse(...)` now returns `success: true` for Manchester. Confirmed this test currently calls `bookingLocationSchema` (wire point #1), so the assertion must exercise that same export, not `bookingDetailsSchema`.
2. **`src/features/booking/schemas/booking-schema.test.ts`** — new: `it("no longer exports BOOKING_ALLOWED_CITIES or a service-area refine")`, or equivalent — a lightweight anti-drift guard (same idiom as `src/content/site/__tests__/canonical-domain.test.ts`) so a future edit can't silently reintroduce the gate.
3. **`src/features/booking/components/AboutYouStep.test.tsx`** — update the harness (`renderStep`, lines 99-119) to pass the new prop (e.g. `freeTravelCities`) with a sensible default so `COVERED_TOWNS` doesn't render empty for every existing assertion.
4. **`src/features/booking/components/AboutYouStep.test.tsx`** — rewrite the assertion in `"fills address, city, area and postcode from one confirmed selection, and the covered-area notice follows"` (currently asserts `screen.getByText("Covered area:")`, line 201) only if the covered-case label text changes; otherwise leave it — confirm against the final copy.
5. **`src/features/booking/components/AboutYouStep.test.tsx`** — rename and rewrite `"surfaces the outside-coverage notice when the selected address is out of area"` (lines 263-280) to something like `"surfaces an informational (not blocking) notice when the selected address is out of area"`, asserting the new neutral copy renders and that the old red-alert framing ("Use a covered town before choosing a time") does **not**.
6. **`src/features/booking/components/AboutYouStep.test.tsx`** — refresh the two stale inline comments (lines 192-193, 275-276) that describe "the About → Time hard gate" as still-blocking; they become factually wrong once Phase 2 lands.
7. **`src/lib/booking/availability.test.ts`** (co-locate next to `availability.ts`, following the module's existing test file if one exists, else new file per convention) — `it("returns slots for a city outside the free-travel list instead of an empty result")`, replacing whatever test currently exercises the old rejecting behaviour of `loadContextRest`'s city check, if one exists (check first — none was found by symbol search at the time of this audit, so this may be a net-new test rather than a rewrite).
8. **`src/lib/booking/__tests__/availability-options.test.ts`, `working-hours-segments.test.ts`, `override-windows.test.ts`, `staff-recurring-windows.test.ts`** — rename the mock fixture key from `allowed_cities` to `free_travel_cities` in all four (lines 49, 288, 84+379, 70 respectively). No new assertions required — these are pass-through fixtures — but confirm each file's existing tests still pass after the rename, since a missed rename fails silently (see §8.4).
9. **`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`** — update line 83's `data.set(...)` key only if the Owner decides to rename the HTML form field (§8.4 open decision); otherwise no change needed here.
10. **`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`** — new: `it("rejects a mileage-origin change from an Admin, but still saves the Admin's other edits")` and `it("allows an Admin to resubmit the form with the mileage origin unchanged")` — the two partial-save edge cases the plan calls out explicitly.
11. **`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`** — new: `it("allows the Owner to change the mileage origin")`.

---

### Per-batch verification

**After Phase 1 (settings + permission, before touching any gate):**
```
npx tsc --noEmit
npx vitest run src/app/admin/settings
```
MUST stay at: `tsc` → 0. `pnpm lint` baseline (59 errors / 7 warnings, same six files) must not move — no Phase-1 file is one of the six.

**Live re-check, immediately before writing Migration B (re-run, don't trust the numbers already in this document):**
```sql
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%';   -- must still be exactly 1 row: create_booking_request
SELECT * FROM pg_policies WHERE qual ILIKE '%allowed_cities%' OR with_check ILIKE '%allowed_cities%';  -- must still be 0 rows
```
If either has changed, stop — the migration's blast radius has grown since this document was written.

**After Phase 2 (gate removal + prop threading + UI rewrite):**
```
npx tsc --noEmit
npx vitest run src/features/booking src/lib/booking src/app/admin/bookings/new
npx eslint src/features/booking/BookingExperience.tsx src/features/booking/BookingExperienceLoader.tsx src/features/booking/utils/returning-customer.ts
```
- `tsc` MUST stay at 0.
- The Manchester assertion in `booking-schema.test.ts` MUST flip from failing-to-parse to `success: true`.
- The 4 `src/lib/booking/__tests__/*.test.ts` fixtures MUST still pass using the renamed key.
- `AboutYouStep.test.tsx`'s coverage-copy assertions MUST match the new copy, not the old one.
- The `eslint` spot-check MUST still report exactly 4 errors / 1 warning, at the same five locations (lines 201, 253/386, 340 in `BookingExperience.tsx`; 34 in `BookingExperienceLoader.tsx`; 61 in `returning-customer.ts`) — any different location means prop-threading touched more than intended. This is a real risk worth naming precisely: `BookingExperience.tsx`/`BookingExperienceLoader.tsx` are two of the six files carrying the plan's whole-repo lint baseline, and Item 8's own edits to `SettingsForm.tsx`/`BookingManagementForm.tsx` elsewhere in the plan already shift line numbers for other files' baseline errors — compare this spot-check by the **{file, ruleId} multiset**, not by line number, consistent with the plan's stated lint-identity rule.
- `pnpm lint` full-repo baseline (59/7) must not move.
- `node scripts/measure-admin-contrast.mjs .` — unrelated to this phase; run once to confirm a no-op diff, not as a required gate (the script exits 0 regardless of failure count unless `--max-failures` is passed).

---

### Stop conditions

1. `pg_proc` shows a second function referencing `allowed_cities` when re-probed before Migration B — the SQL migration's shape has changed since this document was written.
2. `tsc --noEmit` is non-zero after any Phase-1 or Phase-2 edit — the rename touched a consumer not in the 12-file list above.
3. `pnpm lint` moves off 59/7, or the targeted eslint spot-check reports a violation at a line other than the five named above — something touched a lint-baseline file beyond pure prop-threading.
4. The Owner has not answered the form-field-name question (§8.4) before Phase 1 lands — guessing either way has a concrete, different test-file consequence.
5. Before writing `AboutYouStep.tsx`'s Phase 5 final copy (the version that names the travel charge and the mileage origin): confirm exact wording with the Owner. This is customer-facing text the plan has never specified verbatim — do not invent it unilaterally. (Phase 2's interim neutral copy is not subject to this — it only needs to stop being false, not be final.)
6. The live `business_settings` row's `allowed_cities` value has changed from `["Luton","Dunstable"]` since this document was written — not itself a stop condition, but re-snapshot before Migration A so the rollback record stays accurate.

---

### Rollback

Nothing in Phase 1–2 is irreversible.

- **Migration A** (column rename + `mileage_origin` add): metadata-only, instant, no data loss. Rollback: `alter table business_settings drop column mileage_origin; alter table business_settings rename column free_travel_cities to allowed_cities;`
- **Migration B, permission half**: two pure-addition rows. Rollback: `delete from role_permissions where permission_id = (select id from permissions where name = 'manage_travel_origin'); delete from permissions where name = 'manage_travel_origin';`
- **Migration B, SQL-gate half**: `create or replace function` back to the current (pre-Item-8) `create_booking_request` body, preserved verbatim in the live `20260727120000_c06_client_crud_hardening.sql`. Never edit the applied historical file — reapply its body as a new migration if rollback is needed.
- **Rollback ordering, if both migrations must be undone**: Migration B first (drop the permission, restore the raising function — the restored body references `free_travel_cities`, which must still exist at that point), **then** Migration A. Reversing that order leaves the restored `create_booking_request` referencing a column that no longer exists.
- **TS/TSX edits**: standard `git revert` of the Phase 1/2 commits. Nothing here reads or writes production data.
