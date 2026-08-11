# ITEM 8, Phases 1–2 — settings + the 3-way gate contradiction — deepening report

Audited: `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 981–1057 (§8.1–§8.5).
Context read in full: `redesign/HANDOFF-2026-08-11-PLANNING.md`.
Repo state verified at HEAD (`86b8b22`); `src/` confirmed byte-identical to 33f895f per the task brief, re-verified anchors by symbol below anyway.
Supabase project: `twzutkfgqclqurvkmvqz`, read-only `execute_sql` only.

**Headline: the plan is right about the three gates and the SQL, but it undercounts the blast radius by roughly 2x.** Three separate front-end files independently reimplement the exact same "is this city covered" check the plan only tracks once (`booking-schema.ts`). Two of those three (`AboutYouStep.tsx`, `ManualBookingForm.tsx`) are not in the plan's file list at all, and one of them (`AboutYouStep.tsx`) has a 297-line dedicated test file, also absent from the plan, that hard-asserts on copy this change must retire. The "~8 files" consumer count for the column rename is also short by at least 5 (four `src/lib/booking/__tests__/*.test.ts` fixtures plus `updateBusinessSettings.test.ts`, none of which will fail `tsc --noEmit` if missed — the fake-client mock types `data` as `unknown`, so a stale field name compiles clean and just silently stops doing anything).

---

## 1. Claims tested

| # | Claim (plan line) | Verdict | Evidence |
|---|---|---|---|
| 1 | `BOOKING_ALLOWED_CITIES` = 5 hardcoded towns, `booking-schema.ts:5-11` (§8.2 row 1) | CONFIRMED | `src/features/booking/schemas/booking-schema.ts:5-11` — exactly `["luton","dunstable","houghton regis","harpenden","st albans"]`. |
| 2 | `validateServiceArea` at `:139-164`, wired at `:174` (§8.2 row 1) | **PARTIAL** | Function body is `:139-161`. Line `164` is itself a **second wire point** (`bookingLocationSchema = bookingLocationFieldsSchema.superRefine(validateServiceArea)`), not part of the function. `:174` is a **third** occurrence, wiring `bookingDetailsSchema`. So `validateServiceArea` is wired **twice** (lines 164 and 174), not once — see §2 below. |
| 3 | `BookingExperience.tsx:429 goToTime` refuses to advance (§8.2 row 1) | CONFIRMED (off by one) | `goToTime` function starts at line **428**; the `bookingDetailsSchema.safeParse(...)` call is at **429**. Symbol `goToTime` is correct and stable. |
| 4 | `availability.ts:454 isCityAllowed()` → empty calendar (§8.2 row 2) | CONFIRMED | Line 454: `if (!isCityAllowed(input.city, getAllowedCities(settings.allowed_cities))) { return { reason: ... }; }` inside `loadContextRest`. |
| 5 | Nothing else in `loadContextRest` reads `city` (§8.5) | CONFIRMED | Read `loadContextRest` (lines 449-559) in full. After the city check at 454-456, it reads only `serviceIds`, `participantGenders` (services, gender eligibility, staff, permissions, weekly rules). No other `input.city` reference in the function. |
| 6 | SQL gate `c06…sql:399-410` (§8.2 row 3) | CONFIRMED, exact | Lines 399–410 verbatim: `if v_clean_city = '' then raise exception 'City is required'; end if;` (399-401) then the `not exists (select 1 from jsonb_array_elements_text(v_settings.allowed_cities) ...) then raise exception 'Location is outside the service area';` block (403-409), closed by `end if;` at 410. |
| 7 | `create_booking_request` is the only DB function referencing `allowed_cities`; no RLS policy does | CONFIRMED, live | `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` → **one row**: `create_booking_request`. `SELECT ... FROM pg_policies WHERE qual ILIKE '%allowed_cities%' OR with_check ILIKE '%allowed_cities%'` → **zero rows**. |
| 8 | Gate 3 sits after `end if; -- end IF NOT p_override_availability`, so admins can't bypass it (§8.2) | CONFIRMED | Line 397 is `end if; -- end IF NOT p_override_availability`; the city block (399-410) is unconditional after it. |
| 9 | `create_recurring_booking_series` never checked city, deliberately (§8.2) | CONFIRMED | `20260802122636_c02_recurring_bookings.sql:187`: `-- * No allowed_cities check. The address is a snapshot of an existing client record, which passed that check when it was created.` |
| 10 | ~8 consumer files for the column rename (§8.4) | **FALSE — undercounted** | 12 files in `src/` textually reference `allowed_cities`, not counting the 2 files that reference the JS constant `BOOKING_ALLOWED_CITIES` separately, not counting `AboutYouStep.test.tsx` (which asserts on the resulting copy without using either literal name). Full list in §3. |
| 11 | Rationale: renaming (not redefining) matches ITEM 7's defect class; audit logs correctly keep the old name | CONFIRMED (design reasoning, not independently falsifiable) | `settings/actions.ts:104-110` writes `before_state`/`after_state` verbatim from the DB row into `audit_logs`, so a renamed column naturally produces old-named history before the change and new-named history after — consistent with the plan's stated rationale. |
| 12 | `settings/actions.ts:24` gates the whole form with `MANAGE_SETTINGS` | CONFIRMED, exact | Line 24: `return requirePermission(PERMISSIONS.MANAGE_SETTINGS, supabase);` inside `requireSettingsManager()`, called from `updateBusinessSettings` at line 33. |
| 13 | `manage_settings` held by Admin AND Owner; `manage_role_templates` Owner-only | CONFIRMED, live SQL | See §4 — exact query and rows below. |
| 14 | `actions.ts:67-69` "at least one" validation | CONFIRMED (67-68 is the logic, message on 68) | `if (allowedCities.length === 0) { fieldErrors.allowed_cities = "Enter at least one allowed service area."; }` — lines 67-68. |
| 15 | `SettingsForm.tsx` copy at `:378`, `:709-710`, `:718` | CONFIRMED, exact quotes | See §5 — all three quoted verbatim, byte-for-byte matches. |
| 16 | `booking-window-settings.ts` caching: `unstable_cache`, key `["public-booking-window"]`, `revalidate: 60`, `tags:[TAGS.SETTINGS]` | CONFIRMED, exact | `src/lib/booking/booking-window-settings.ts:34-59`. |
| 17 | `settings/actions.ts:112` invalidates `TAGS.SETTINGS` | CONFIRMED, exact | Line 112: `updateTag(TAGS.SETTINGS);`. `TAGS.SETTINGS = "settings"` (`src/lib/cache/tag-taxonomy.ts:20`). |
| 18 | Prop path `(public)/layout.tsx:21,42-44` → `BookingExperienceLoader.tsx:23-26,89-93` → `BookingExperience.tsx` → `AboutYouStep` | CONFIRMED (layout.tsx props are 42-43, not 42-44 — line 44 is the closing tag; trivial) | Traced all four hops; see §6. |
| 19 | `BookingExperience.tsx` / `BookingExperienceLoader.tsx` are 2 of the 6 lint-baseline files | CONFIRMED, and material — see §7 | `npx eslint` on both files reproduces exactly the pre-existing violations; the planned Item-8 edits do not touch any of the violating lines. |
| 20 | `booking-schema.test.ts:39-47` — "rejects unsupported service areas" | CONFIRMED, exact | Full path `src/features/booking/schemas/booking-schema.test.ts`. Test spans lines 39-47 exactly, uses **`bookingLocationSchema`** (the line-164 wire point, not the line-174 one the plan cites — see §2). |

---

## 2. Correction: `validateServiceArea` is wired **twice**, not once

`src/features/booking/schemas/booking-schema.ts`:

```ts
139  function validateServiceArea(
...
161  }
162
163  export const bookingLocationSchema =
164    bookingLocationFieldsSchema.superRefine(validateServiceArea);   // wire point #1
...
174    .superRefine(validateServiceArea)                              // wire point #2, on bookingDetailsSchema
```

The plan's phrasing ("wired at `:174`") only names the second site. The test that must flip — `booking-schema.test.ts:39-47`, "rejects unsupported service areas before time selection" — exercises **`bookingLocationSchema`**, i.e. wire point #1 at line 164, not the one the plan names. Both call sites reference the same function, so deleting/no-op'ing `validateServiceArea`'s body (or removing both `.superRefine` calls) fixes both, but an implementer following "wired at :174" literally could miss line 164 and the exported `bookingLocationSchema` would keep rejecting when called directly (as the test does, and as `AboutYouStep.tsx`'s comments imply it might be in the future). **Fix both wire points, lines 164 and 174.**

---

## 3. Full consumer enumeration (supersedes the "~8 files" claim)

Command used: `grep -rn "allowed_cities" --include="*.ts" --include="*.tsx" -not -path node_modules` (via the Grep tool, `src/` only, no glob restriction on top of that) plus a separate pass for the JS constant `BOOKING_ALLOWED_CITIES`.

### 3a. Column name `allowed_cities` (12 files)

| File | Lines | What | Rename-affected? |
|---|---|---|---|
| `src/lib/booking/availability.ts` | 58, 433, 454 | `BusinessSettingsRecord.allowed_cities` interface field; select string; gate read | Yes — rename + repurpose |
| `src/app/admin/settings/settings-data.ts` | 47 | `BusinessSettingsRow.allowed_cities` interface field | Yes |
| `src/app/admin/settings/page.tsx` | 19 | `fallbackSettings.allowed_cities` | Yes |
| `src/app/admin/settings/actions.ts` | 49, 68, 92 | form parse, fieldErrors key, upsert payload key | Yes |
| `src/app/admin/settings/SettingsForm.tsx` | 27, 59, 76, 388, 395 | interface field, `useState`, dirty-check baseline, error prop, **hidden `<input name="allowed_cities">`** | Yes — see §3c, form-field-name decision |
| `src/app/admin/bookings/new/page.tsx` | 75, 84 | `.select("allowed_cities")`, destructure | Yes |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | 547 (comment), 550, 1687-1693, 1725-1727 | doc comment; **camelCase `allowedCities` prop** feeding an independent `isCityKnown` duplicate-gate check and an error-styled inline warning | **NOT in the plan's file list at all** — see §3b |
| `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` | 83 | `FormData.set("allowed_cities", ...)` | Only if the form field `name` is renamed too — see §3c |
| `src/lib/booking/__tests__/availability-options.test.ts` | 49 | fake-DB mock key | Yes, but **silent** — see below |
| `src/lib/booking/__tests__/working-hours-segments.test.ts` | 288 | fake-DB mock key | Yes, silent |
| `src/lib/booking/__tests__/override-windows.test.ts` | 84, 379 | fake-DB mock key ×2 | Yes, silent |
| `src/lib/booking/__tests__/staff-recurring-windows.test.ts` | 70 | fake-DB mock key | Yes, silent |

**"Silent" is the important word.** `src/lib/cache/__tests__/fake-supabase-admin.ts` types `FakeQueryResult.data` as `unknown` (line 21). A mock literal like `{ allowed_cities: ["Luton"], ... }` type-checks fine regardless of what `availability.ts` actually selects — `tsc --noEmit` will **not** catch a stale field name here. If the column is renamed to `free_travel_cities` and these 4 fixtures are not updated, `settings.free_travel_cities` is `undefined` at runtime in every one of these tests; `getAllowedCities(undefined)` returns `[]`, and if the gate logic is repurposed into a returned `isFreeTravelZone` flag (as §8.5 suggests), that flag would be silently wrong (always `false`) in all 4 specs without any test failure, because none of them currently assert on the city gate itself — they use `"Luton"` purely as a safe pass-through value for unrelated assertions (staff windows, overrides, segments). **This is a correctness trap, not a compile error** — flag it explicitly as a checklist item, not something `tsc` will catch for you.

### 3b. `BOOKING_ALLOWED_CITIES` (JS constant) — 2 files, but a *third* file duplicates its logic independently

`grep -rn "BOOKING_ALLOWED_CITIES" src` → exactly:
- `src/features/booking/schemas/booking-schema.ts:5` (definition), `:148` (use in `validateServiceArea`)
- `src/features/booking/components/AboutYouStep.tsx:18` (import), `:56-57` (`COVERED_TOWNS` derived list), `:127` (`isCovered` check)

**`AboutYouStep.tsx` is completely absent from the plan's §8.4/§8.5 file list**, despite independently reimplementing the exact same "is this city covered" predicate the plan tracks in `booking-schema.ts`:

```tsx
// AboutYouStep.tsx:123-131
const normalizedCity = city.trim().toLowerCase();
const hasCityValue = normalizedCity.length > 1;
const isCovered =
  hasCityValue &&
  BOOKING_ALLOWED_CITIES.some(
    (allowed) => normalizedCity === allowed || normalizedCity.includes(allowed)
  );
const isOutsideCoverage = hasCityValue && !isCovered;
```

This drives three pieces of UI that must change semantics, not just data source, once out-of-zone stops meaning "rejected":
- `COVERED_TOWNS` (line 56-58) — click-to-fill chips, currently derived from the hardcoded constant, would need to derive from the settings-driven list (thread as a prop, same mechanism as `bookingWindowDays`).
- The "Covered area" notice (lines 510-518) — fine as-is conceptually, but the label needs to stop implying the alternative is a rejection.
- **The "Outside current home visit area" notice (lines 520-528) is now false and must be rewritten**: `"Outside current home visit area: We currently cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans. Use a covered town before choosing a time."` — this literally instructs the customer to change their answer to proceed, which after Item 8 Phase 1-2 is no longer true (out-of-zone is bookable; `goToTime` no longer blocks on it). Left unedited, this is a customer-facing regression: the UI will keep telling people they are blocked when they are not.

A third, separate reimplementation exists in the **admin** manual-booking form, also absent from the plan:

```tsx
// ManualBookingForm.tsx:1680-1693, 1725-1728
// C-07 Step 5 (W02-E-1) — mirrors create_booking_request's own check ...
const isCityKnown =
  cityTrimmed.length === 0 ||
  allowedCities.length === 0 ||
  allowedCities.some((allowed) => { ... });
...
{!isCityKnown ? (
  <p className="text-xs text-[oklch(26%_0.14_25)]" role="alert">
    &ldquo;{cityTrimmed}&rdquo; is outside our current service area. We deliver to: {allowedCities.join(", ")}.
  </p>
) : null}
```

This is non-blocking today (no `disabled` tied to `isCityKnown` — confirmed by grep, the only other use of the symbol is the JSX above), so removing the SQL gate does not break submission here. But the copy is an `role="alert"` red-text notice that reads as a rejection ("is outside our current service area") when after Item 8 it no longer is one — the admin is the exact audience Owner decision #5 ("hide the one-click confirm chip when a fee is needed") targets, so this component is very likely where that Phase-3 UI attaches. **At minimum for Phase 1-2, this copy and its `allowedCities` prop must be renamed/reworded for consistency; it should not be left describing a rejection that no longer happens.**

### 3c. Open decision the plan does not resolve: does the HTML form field name change too?

`SettingsForm.tsx:395` — `<input type="hidden" name="allowed_cities" value={cities.join("\n")} />` — and `actions.ts:49` reads `formData.get("allowed_cities")`. This is a same-origin server-action POST, not a public API, so nothing external depends on the literal string `"allowed_cities"`. The plan's own rationale ("a column named 'allowed' that means 'free' is the exact defect class ITEM 7 exists to clean up") argues for renaming it everywhere including the form contract — but the plan never says so explicitly, and this has a concrete test consequence either way:

- **If the form field name is renamed** (e.g. to `free_travel_cities`) to match: `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts:83` (`data.set("allowed_cities", ...)`) must be updated to the new key, or the "invalidates the settings and audit resource tags" test breaks — it currently relies on that field being non-empty to pass the "at least one" validation and reach `success: true`.
- **If the form field name is left as `allowed_cities`** (an internal HTML attribute, decoupled from the DB column): the test needs no change, but the codebase keeps one place where "allowed" language survives, slightly undercutting the plan's own stated rationale.

**This needs an explicit Owner/plan decision, not an implementer's guess** — recommend adding it to the plan text directly (see §9 proposed additions).

---

## 4. Permission model — live verification

```sql
SELECT r.name AS role_name, p.name AS permission_name
FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
WHERE p.name IN ('manage_settings','manage_role_templates') ORDER BY p.name, r.name;
```
Result:
```
manage_role_templates | Owner
manage_settings        | Admin
manage_settings        | Owner
```
Confirms the plan's claim exactly: `manage_settings` → Admin + Owner; `manage_role_templates` → Owner only.

Full row for the precedent to copy:
```sql
SELECT * FROM permissions WHERE name = 'manage_role_templates';
-- id: 6a3342fc-b20c-4c62-8acf-4df58081645c
-- name: manage_role_templates
-- description: Edit default role permission templates.
-- category: staff | scope: operational | risk_level: high | is_system: true | active: true
```
Better precedent by *category* (settings-domain, not staff-domain) — `manage_settings` itself:
```sql
SELECT * FROM permissions WHERE name = 'manage_settings';
-- id: b09a5557-9a4d-495c-af25-9675b290a1ca
-- category: settings | scope: operational | risk_level: high | is_system: true | active: true
```
Roles table (for the grant migration):
```sql
SELECT id, name FROM roles ORDER BY name;
-- Admin                9f746458-a342-49ae-8b24-ff1a9068f422
-- Booking Coordinator  0bd2abca-9522-405a-a53a-4f0a8af7eb49
-- Inactive             ea0c5101-51c1-42d0-8395-abcfa5c19266
-- Owner                2d5295c3-5d45-4c96-ab49-d5f87e0464b5
-- Therapist            c30bd264-7f50-454d-9ba4-c393af0ce618
```
`permissions` table schema (for the INSERT shape):
```
id uuid default gen_random_uuid(), name text not null, description text,
created_at timestamptz default now(), category text default 'system',
scope text default 'global', risk_level text default 'medium',
is_system boolean default true, active boolean default true
```
`role_permissions` schema: `role_id uuid not null, permission_id uuid not null` (join table, no surrogate key).

**Recommended enforcement code** (mirrors `hasPermission`, non-throwing, for the field-level error the plan requires):
```ts
// settings/actions.ts, inside updateBusinessSettings, after requireSettingsManager()
const mileageOriginChanged = mileageOrigin !== (beforeState?.mileage_origin ?? "");
if (mileageOriginChanged && !actor.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)) {
  fieldErrors.mileage_origin = "Only the practice owner can change the mileage origin.";
}
```
`requirePermission`/`hasPermission` signatures verified at `src/lib/auth/rbac.ts:401-423` and `:428-433`; `actor` returned by `requireSettingsManager()` is a full `StaffProfile` with `.permissions: Set<string>`, so `actor.permissions.has(...)` is available with no new fetch.

---

## 5. `business_settings` — live row snapshot (for reversibility, as the plan requires)

```sql
SELECT * FROM business_settings WHERE id = 1;
```
```json
{
  "id": 1,
  "company_name": "Rahma Therapy",
  "contact_email": null,
  "contact_phone": null,
  "booking_window_days": 29,
  "buffer_time_mins": 30,
  "minimum_notice_hours": 4,
  "allowed_cities": ["Luton", "Dunstable"],
  "booking_status_enabled": true,
  "customer_cancellation_cutoff_hours": 12
}
```
Confirms §8.2's "2 towns" claim for gate #2 exactly (`["Luton","Dunstable"]`).

`business_settings` full column list (for the migration and for confirming `mileage_origin` does not exist yet):
```
id integer, company_name text default 'Rahma Therapy', contact_email text, contact_phone text,
booking_window_days integer default 30, buffer_time_mins integer default 30,
minimum_notice_hours integer default 24, allowed_cities jsonb not null default '[]'::jsonb,
booking_status_enabled boolean default true, customer_cancellation_cutoff_hours integer default 24
```
No `mileage_origin` column exists today — confirmed clean add, no naming collision.

`SettingsForm.tsx` copy — exact quotes (all three CONFIRMED byte-for-byte against source):
- Line 378: `description="Cities and towns where the team will travel. Customers booking outside these areas see a helpful message instead of a closed door."`
- Lines 708-711: `"No service areas yet. The booking form will currently turn every customer away. Add at least one city below."`
- Line 718: `title="Service area. Customers within this area can book."`

All three are false or misleading after Item 8 (outside-area customers are not turned away; the field no longer gates who "can book").

---

## 6. Prop path — traced hop by hop

1. `src/app/(public)/layout.tsx:21` — `const bookingWindow = MAINTENANCE_MODE ? null : await getPublicBookingWindow();`
2. `src/app/(public)/layout.tsx:41-45` — `<BookingExperienceLoader bookingWindowDays={bookingWindow?.bookingWindowDays} minimumNoticeHours={bookingWindow?.minimumNoticeHours} />` (props on lines 42-43; plan's `:42-44` includes the closing `/>` — trivial drift, not worth correcting in the plan text).
3. `src/features/booking/BookingExperienceLoader.tsx:23-26` — destructures `{ bookingWindowDays, minimumNoticeHours }: BookingExperienceProps = {}`; lines 89-93 pass both straight through to the dynamically-imported `<BookingExperience>`.
4. `src/features/booking/BookingExperience.tsx:81-82` (interface `BookingExperienceProps`), `:86-88` (destructure), `:704-705` — passes `bookingWindowDays`/`minimumNoticeHours` into `<AboutYouStep ... bookingWindowDays={bookingWindowDays} minimumNoticeHours={minimumNoticeHours} />`.

Confirmed mechanical and extensible exactly as the plan describes — but note `AboutYouStep.tsx` **does not currently accept or use** `bookingWindowDays`/`minimumNoticeHours` at all (its own props interface, lines 26-30, is `{ form, prefilled, onClearPrefill }` only) — those two values pass through `BookingExperience` to something else (verified: they are consumed by the date-picker step, not `AboutYouStep`). **The plan's claim that the chain ends at `AboutYouStep` is therefore aspirational, not a description of an existing pattern for that specific component** — a new `freeTravelCities` (or similar) prop would be the *first* prop `AboutYouStep` receives via this chain, not a continuation of an existing one. Worth stating precisely in the deepened plan so an implementer doesn't go looking for existing `AboutYouStep` prop-plumbing that isn't there.

---

## 7. Lint baseline risk — BookingExperience.tsx / BookingExperienceLoader.tsx

Ran directly (read-only, no repo mutation):
```
npx eslint src/features/booking/BookingExperience.tsx src/features/booking/BookingExperienceLoader.tsx src/features/booking/utils/returning-customer.ts
```
Result — 4 errors, 1 warning, reproducing the baseline exactly:

| File | Line | Rule | Description |
|---|---|---|---|
| `BookingExperience.tsx` | 201 | `react-hooks/set-state-in-effect` | `setSummarySheetOpen(false)` inside an effect (`[open, currentStep]`) |
| `BookingExperience.tsx` | 253/386 | `react-hooks/immutability` | `applyFormIssues` used before declaration |
| `BookingExperience.tsx` | 340 | `react-hooks/set-state-in-effect` | `setPrefilled(true)` inside the prefill effect |
| `BookingExperienceLoader.tsx` | 34 | `react-hooks/set-state-in-effect` | `setShouldLoad(true)` inside the deep-link effect |
| `returning-customer.ts` | 61 | `@typescript-eslint/no-unused-vars` | `_savedAt` unused (warning) |

**None of these four violating lines is anywhere near the planned Item-8 edits.** The prop-threading required (§6) is a pure addition — a new prop added to `BookingExperienceProps`, destructured, and passed one level deeper — touching none of lines 201, 253, 340, or 386, and no new effect/setState pattern is introduced by prop-drilling alone. **Conclusion: Item 8 Phase 1-2's planned edits to these two files should not move the 59/7 lint baseline**, provided the implementer does exactly a prop-add-and-forward and does not touch `goToTime`, the prefill effect, or the deep-link effect while in the file.

Cross-check: `AboutYouStep.tsx`, `booking-schema.ts`, and `availability.ts` — the other three files carrying real logic changes — are independently lint-clean today (`npx eslint <those 3 files>` → zero output, zero problems), so edits there start from a clean baseline; any new violation introduced in them **would** be a genuine regression (not masked by a pre-existing baseline) and should fail CI/lint checks normally.

---

## 8. `booking/manage/` — the known trap, checked explicitly

Per instructions, `src/app/booking/manage/` sits outside both `(public)` and `admin` and is a known trap for "shared UI primitive" surprises. Checked with a case-insensitive search across the whole directory:
```
grep -rin "city|booking-schema|BOOKING_ALLOWED_CITIES|allowed_cities|travel_fee|mileage" src/app/booking/manage
```
→ **zero matches** across `actions.ts`, `ManageBookingForms.tsx`, `page.tsx`. **Proven clean for Phase 1-2** — this directory does not import `booking-schema.ts`, does not reference `allowed_cities`/`BOOKING_ALLOWED_CITIES`, and has no city-gating logic of its own. (It may become relevant for Phase 3's travel-fee display, which is out of this report's scope — see the companion Phase 3 report if one exists.)

---

## 9. e2e and downstream tests — full enumeration

```
grep -rn "allowed_cities|BOOKING_ALLOWED_CITIES|outside our current|Manchester|service area|isCityAllowed|isCityKnown" e2e
```
→ one hit: `e2e/booking-public.spec.ts:7` — test named *"booking page exposes the service step and can show unsupported service area feedback"*. Read the full spec (20 lines): **the test body does not actually exercise area-rejection** — it clicks through to step 2 and asserts on the "who is this for" heading only, never entering a city or checking any coverage copy. It is unaffected functionally, but its **name becomes misleading** after Item 8 (there is no more "unsupported service area feedback" to show, in the blocking sense the name implies). Low priority; a docs/naming cleanup, not a test-breakage risk.

**`src/features/booking/components/AboutYouStep.test.tsx` — 297 lines, entirely absent from the plan, and the single largest test-impact surface for this item:**

Found via `grep -rn "bookingLocationSchema|bookingDetailsSchema|validateServiceArea|BOOKING_ALLOWED_CITIES" src` → this file imports none of those symbols directly, but its fixtures and assertions are built entirely around the current 5-town list and its blocking framing:

- Fixture comment (line 57-58): `"Outside the five covered towns (Luton, Dunstable, Houghton Regis, Harpenden, St Albans)."`
- Test `"fills address, city, area and postcode from one confirmed selection, and the covered-area notice follows"` (lines 166-210) — asserts `expect(screen.getByText("Covered area:")).toBeTruthy();` (line 201).
- Test `"surfaces the outside-coverage notice when the selected address is out of area"` (lines 263-280) — asserts `expect(screen.getByText("Outside current home visit area:")).toBeTruthy();` (line 278) and `expect(screen.queryByText("Covered area:")).toBeNull();` (line 279). **This exact copy is what §8.5 must retire per §3b above.**
- Test-harness comments explicitly describe the very gate being removed: line 192-193, `"What the About -> Time hard gate reads (bookingDetailsSchema.safeParse runs against form.getValues() in BookingExperience)"`; line 275-276, `"The city that the About -> Time gate will reject is the one now in form state — a selection reaches the gate exactly as typing does."` Both comments will be **factually false** once Phase 2 lands (out-of-zone no longer gets rejected).
- The test harness (`renderStep`, lines 99-120) renders `<AboutYouStep form={form} />` with **no other props**. If `AboutYouStep` switches from importing `BOOKING_ALLOWED_CITIES` to receiving a `freeTravelCities` prop (the mechanical extension §8.5 calls for), **all 5 `it()` blocks in this file** need the harness updated to supply that prop (or a sensible default), or `COVERED_TOWNS` renders empty and every coverage assertion (not just the two explicit ones above) breaks silently-different, not just the two visibly-named ones.

**Required plan addition:** `src/features/booking/components/AboutYouStep.test.tsx` must be added to Item 8 Phase 2's file list, with an explicit instruction to (a) update the harness to pass the new prop, (b) rewrite the two coverage-copy assertions to match the new (non-blocking, fee-oriented) messaging, and (c) refresh the two comments that describe "the About → Time hard gate" as a still-blocking mechanism.

`booking-schema.test.ts` — confirmed full path `src/features/booking/schemas/booking-schema.test.ts` (co-located, not in a nested `__tests__/`), test spans lines 39-47 exactly as quoted in §1 row 20, uses `bookingLocationSchema` (see §2 correction).

---

## 10. Generated types / RPC callers — proven not affected

- **No generated Supabase types file exists in this repo.** Searched `find . -iname "*database.types*" -o -iname "*supabase.types*"` (excluding `node_modules`) → zero results. Nothing to regenerate or hand-edit for the rename.
- **RPC callers of `create_booking_request` / `create_recurring_booking_series` are unaffected.** `grep -l "create_booking_request\|create_recurring_booking_series" src` → 11 files; cross-checked all 9 not already covered above (`createRecurringSeries.test.ts`, `recurring-actions.ts`, `admin/clients/[clientId]/page.tsx`, `actions.test.ts`, `admin/bookings/new/ManualBookingForm.tsx` [already covered separately], `admin/bookings/new/page.tsx` [already covered], `cron/extend-recurring-horizons/route.ts`, `createManualBooking-optional-email.test.ts`, `createBookingTransaction.test.ts`, `route.test.ts`, `createBookingTransaction.ts`) for the literal string `allowed_cities` → **zero matches**. They call the RPC by function name with named parameters (`p_city`, etc.), never by column name, so a column rename entirely internal to the PL/pgSQL function body cannot affect them. Command: `grep -l "allowed_cities" <9 files>` → exit code 1 (no match), confirmed twice.
- **Historical migrations that reference `v_settings.allowed_cities` and must NOT be touched** (per the plan's own "do not edit historical migrations" rule, and consistent with it): `20260513120100_update_create_booking_request_per_participant_services.sql:310` and `20260503150000_phase2_booking_atomic_snapshots.sql:178` are earlier `create or replace function create_booking_request` bodies, superseded by `20260727120000_c06_client_crud_hardening.sql`'s later `create or replace` — confirmed only **one** live function exists (`pg_proc` probe, §1 row 7). `20260502160000_phase6_seed_business_settings_and_global_availability.sql` (seed/upsert) and `20260502052540_phase2_group6_settings_and_audit.sql` (original column definition) are likewise historical and untouched by design. `redesign/evidence/C-06/create_booking_request-BEFORE.sql:288` is an evidence snapshot file, not a migration — irrelevant to execution, worth leaving as-is for historical accuracy.
- One comment will go slightly stale and is acceptable to leave: `20260802122636_c02_recurring_bookings.sql:187`'s `-- * No allowed_cities check.` — after the rename this technically should read `free_travel_cities`, but it's a comment in an already-applied historical migration; editing applied migrations is explicitly out of scope per the plan's own rule, so leave it. Low priority, purely cosmetic staleness.

---

## 11. Exact migration SQL (both migrations, plus rollback)

### Migration A — `business_settings` schema change

```sql
-- supabase/migrations/<timestamp>_item8_free_travel_settings.sql
alter table business_settings rename column allowed_cities to free_travel_cities;
alter table business_settings add column mileage_origin text;
```

Rollback (reverse order):
```sql
alter table business_settings drop column mileage_origin;
alter table business_settings rename column free_travel_cities to allowed_cities;
```

### Migration B — SQL gate removal + `manage_travel_origin` permission

```sql
-- supabase/migrations/<timestamp>_item8_permission_and_gate.sql

-- 1. Stop create_booking_request from raising on out-of-zone city.
--    (Full function body must be pulled from the LIVE definition — pg_proc
--    confirms exactly one function named create_booking_request — and
--    `create or replace function`'d with the block at the OLD lines 399-410
--    changed from a raise to a no-op / boolean computation, and every
--    `v_settings.allowed_cities` reference renamed to `v_settings.free_travel_cities`
--    to match Migration A. Do not attempt to patch in place with DDL other than
--    create-or-replace; Postgres has no partial-function-body ALTER.)

insert into permissions (name, description, category, scope, risk_level, is_system, active)
values (
  'manage_travel_origin',
  'Edit the mileage-charge origin point on business settings.',
  'settings',
  'operational',
  'high',
  true,
  true
);

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.name = 'Owner'
  and p.name = 'manage_travel_origin';
```

Rollback:
```sql
delete from role_permissions
where permission_id = (select id from permissions where name = 'manage_travel_origin');

delete from permissions where name = 'manage_travel_origin';

-- create_booking_request: create-or-replace back to the pre-Item-8 body
-- (the current c06_client_crud_hardening.sql definition), which still
-- references free_travel_cities post-Migration-A unless Migration A is
-- also rolled back first — ORDER MATTERS, see §13.
```

**Irreversibility note:** `alter table ... rename column` is metadata-only and instantly reversible with no data loss (unlike a `drop`/recreate), so Migration A's rollback is cheap. The `create or replace function` in Migration B is also fully reversible (Postgres keeps no history, but the plan/PR diff does — reapply the prior `create or replace` body). The genuinely irreversible part is **not** in Phase 1-2 at all — it's Phase 3's `bookings.travel_fee` folding into `total_price`/`amount_due` (out of this report's scope).

---

## 12. File list per phase, ordered (supersedes/extends the plan's §8.4/§8.5 lists)

**Phase 1 — settings (must land together, before Phase 2):**
1. Migration A (§11) — column rename + `mileage_origin` column. ⛔ Zone-2, Owner-approved.
2. Migration B, permission half only (§11) — `manage_travel_origin` insert. ⛔ Zone-2, Owner-approved.
3. `src/app/admin/settings/settings-data.ts` — rename `BusinessSettingsRow.allowed_cities` → `free_travel_cities`; add `mileage_origin: string | null`.
4. `src/app/admin/settings/page.tsx` — rename `fallbackSettings` key; add `mileage_origin` fallback.
5. `src/app/admin/settings/actions.ts` — rename parse/payload keys; reword the "at least one" message; add the `manage_travel_origin` partial-save-safe check (§4).
6. `src/app/admin/settings/SettingsForm.tsx` — rename interface field/state/dirty-check; **resolve the form-field-name decision (§3c)** before editing line 395; reword the three copy strings at §5; add the mileage-origin field, gated in the UI by whether the current user holds `manage_travel_origin` (presentation-only — server is the real gate).
7. `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` — update only if §3c's decision renames the form field.

**Phase 2 — remove the three gates, one source of truth (depends on Phase 1's column existing):**
8. `supabase/migrations/<new>` — Migration B's SQL-gate half (§11): stop raising in `create_booking_request`, keep the "city required" check, rename the internal variable reference to `free_travel_cities`.
9. `src/lib/booking/availability.ts` — rename `BusinessSettingsRecord.allowed_cities` field and the select string; delete or repurpose the `loadContextRest` block at (old) line 454-456 into a non-blocking `isFreeTravelZone` computation; `getAllowedCities`/`isCityAllowed` may be kept and renamed.
10. `src/features/booking/schemas/booking-schema.ts` — delete `BOOKING_ALLOWED_CITIES`; delete `validateServiceArea`; remove **both** `.superRefine(validateServiceArea)` call sites (lines 164 **and** 174 — §2 correction).
11. `src/features/booking/schemas/booking-schema.test.ts` — invert the Manchester test (lines 39-47) to assert success, not rejection.
12. `src/lib/booking/booking-window-settings.ts` (or a sibling file following its exact pattern) — extend/add a cached fetch for the free-travel list, same `unstable_cache` + `TAGS.SETTINGS` pattern.
13. `src/app/(public)/layout.tsx` — fetch the new list, pass as a new prop through `BookingExperienceLoader`.
14. `src/features/booking/BookingExperienceLoader.tsx` — thread the new prop (pure addition, does not touch the line-34 lint violation — §7).
15. `src/features/booking/BookingExperience.tsx` — thread the new prop into `AboutYouStep` (pure addition, does not touch lines 201/253/340/386 — §7). Note per §6: this is a *new* prop for `AboutYouStep`, not a continuation of an existing `bookingWindowDays`-style chain into that specific component.
16. `src/features/booking/components/AboutYouStep.tsx` — **NEWLY REQUIRED, not in the plan today** (§3b): remove the `BOOKING_ALLOWED_CITIES` import; derive `COVERED_TOWNS` from the new prop; rewrite `isOutsideCoverage`'s notice copy (lines 520-528) to reflect "bookable, may carry a manually-set travel charge" instead of "use a covered town before choosing a time."
17. `src/features/booking/components/AboutYouStep.test.tsx` — **NEWLY REQUIRED, not in the plan today** (§9): update the harness to pass the new prop; rewrite the two coverage-copy assertions; refresh the two stale "hard gate" comments.
18. `src/app/admin/bookings/new/ManualBookingForm.tsx` — **NEWLY REQUIRED, not in the plan today** (§3b): reword the `isCityKnown` inline alert (lines 1725-1728) away from "is outside our current service area" framing; consider renaming `allowedCities` prop for consistency (non-blocking today, so this is copy-only for Phase 2 — the confirm-chip-hiding behaviour from Owner decision #5 is Phase 3+).
19. `src/app/admin/bookings/new/page.tsx` — rename the `.select("allowed_cities")` column reference and the destructure at line 84.
20. `src/lib/booking/__tests__/availability-options.test.ts`, `working-hours-segments.test.ts`, `override-windows.test.ts`, `staff-recurring-windows.test.ts` — **rename the mock fixture key in all 4 files** (§3a) — `tsc` will not catch a miss here, only a manual check or a new assertion on the free-travel flag would.

---

## 13. Ordering / prerequisites relative to the other 7 items

- Phase 1 (settings/permission) must land before Phase 2 (gate removal) — Phase 2's SQL and TS changes reference `free_travel_cities`, which Migration A must have created first. Migration A before Migration B, always — Migration B's SQL gate rewrite reads `v_settings.free_travel_cities`.
- No other numbered item (1-7) touches `business_settings`, `booking-schema.ts`, `availability.ts`, `AboutYouStep.tsx`, `SettingsForm.tsx`, `settings/actions.ts`, or `ManualBookingForm.tsx` per this report's search — Item 8 Phase 1-2 has no file-level collision with Items 1-7. (Item 7, admin colour/contrast, may independently touch `SettingsForm.tsx`'s literal-colour classNames if it reaches `/admin/settings` in its per-area sweep — coordinate on that one file if both are in flight simultaneously, to avoid a merge conflict on adjacent lines, not a semantic conflict.)
- `AboutYouStep.tsx` / `BookingExperience.tsx` / `BookingExperienceLoader.tsx` are also touched by nothing else in the 8-item plan as of this read — safe to sequence independently.

---

## 14. Verification commands, per batch

**After Phase 1 (settings + permission, before touching any gate):**
```bash
npx tsc --noEmit                         # MUST stay at 0
npx vitest run src/app/admin/settings    # updateBusinessSettings.test.ts — must still pass (or its 1 edit from §3c applied)
```
Must NOT move: `pnpm lint` baseline (59/7) — none of the Phase-1 files are lint-baseline files.

**After Phase 2 (gate removal + prop threading + UI rewrite):**
```bash
npx tsc --noEmit                                                   # MUST stay at 0
npx vitest run src/features/booking src/lib/booking                # booking-schema.test.ts Manchester assertion MUST now expect success;
                                                                     # AboutYouStep.test.tsx's 2 coverage-copy assertions MUST match new copy;
                                                                     # the 4 availability __tests__ fixtures MUST use the new field name
node scripts/measure-admin-contrast.mjs .                          # UNRELATED — run only to confirm Item 8 edits did not perturb it (should be a no-op diff)
npx eslint src/features/booking/BookingExperience.tsx src/features/booking/BookingExperienceLoader.tsx src/features/booking/utils/returning-customer.ts
                                                                     # MUST still report exactly 4 errors / 1 warning at the SAME 5 locations
                                                                     # (lines 201, 253/386, 340, 34, 61) — any new location is a regression
```
Must move: `npx vitest run` total pass count for the Manchester test flip (was rejecting → now accepting) and for the 2 rewritten `AboutYouStep.test.tsx` assertions.
Must NOT move: the `59 errors / 7 warnings` `pnpm lint` baseline identity (same 6 files, same rule mix) — verified reproducible pre-change in §7.

**Live SQL re-check before executing Migration B (per the plan's own §A instruction, reproduced here for this sub-item):**
```sql
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%';   -- must still be exactly 1 row: create_booking_request
SELECT * FROM pg_policies WHERE qual ILIKE '%allowed_cities%' OR with_check ILIKE '%allowed_cities%';  -- must still be 0 rows
```
If either count has changed since this report, stop and re-plan (a second consumer function or a new RLS policy would change the migration's shape).

---

## 15. Stop conditions

- If `pg_proc` now shows a second function referencing `allowed_cities` (re-run the probe in §14) — stop, the SQL migration's blast radius has grown.
- If `tsc --noEmit` is non-zero after any Phase-1 or Phase-2 edit — stop; the rename touched a consumer not in §12's list.
- If `pnpm lint` moves off 59/7, or the eslint spot-check in §14 reports a violation at a line other than the 5 named in §7 — stop; something touched the lint-baseline files beyond pure prop-threading.
- If the Owner has not answered §3c (form-field-name rename) before Phase 1 lands — stop and ask; guessing either way has a concrete, different test-breakage consequence.
- If `business_settings` row's live `allowed_cities` value has changed from `["Luton","Dunstable"]` (re-run the SELECT in §5) between this audit and execution — not itself a stop condition, but re-snapshot before Migration A so the reversibility record in this report stays accurate.
- Before writing `AboutYouStep.tsx`'s new out-of-zone copy: confirm the exact wording with the Owner (is it "may include a travel charge", "outside our free-travel area", something else) — this is customer-facing text and the plan has not specified it verbatim; do not invent final copy unilaterally.

## 16. Rollback

- Migration A: metadata-only rename + column add — rollback is the two-line `alter table` shown in §11, no data loss, instant.
- Migration B (permission half): two `delete` statements, §11 — no data loss (the `role_permissions` row and the `permissions` row are pure additions with no other table referencing `manage_travel_origin` yet).
- Migration B (SQL gate half): `create or replace function` back to the current (pre-Item-8) `create_booking_request` body — the current body is preserved verbatim in `20260727120000_c06_client_crud_hardening.sql` and in this report's §1 row 6 quote; reapply it as a new migration if rollback is needed (never edit the applied historical file).
- TS/TSX edits: standard `git revert` of the Phase 1/2 commits — nothing here is a one-way door once past the two migrations above.
- **Rollback ordering**: if both migrations must be rolled back, roll back Migration B first (drop the permission, restore the raising function body — the restored function body references `free_travel_cities`, which must still exist at that point), **then** Migration A (rename the column back). Rolling back Migration A first would leave the restored `create_booking_request` function referencing a column that no longer exists.
