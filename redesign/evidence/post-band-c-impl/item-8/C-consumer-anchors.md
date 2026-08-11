# C — `allowed_cities` consumer re-location and drift report

Read-only verification. Repo: `rahmatherapy-next-refactor`. All greps run with ripgrep via the
Grep tool, repo-wide, no path restriction unless noted. Every line number below was confirmed by
reading the file directly (Read tool), not by trusting grep's line-number column alone.

## 1. TRUE file count and list — case-sensitive `allowed_cities` in `src/`

Command: `rg "allowed_cities" src/` (case-sensitive, no glob restriction).

**Result: exactly 12 files.** The plan's claimed count of 12 is CONFIRMED, and the claimed file
list is CONFIRMED — no additions, no removals, no substitutions.

1. `src/lib/booking/availability.ts`
2. `src/lib/booking/__tests__/availability-options.test.ts`
3. `src/lib/booking/__tests__/working-hours-segments.test.ts`
4. `src/lib/booking/__tests__/override-windows.test.ts`
5. `src/lib/booking/__tests__/staff-recurring-windows.test.ts`
6. `src/app/admin/settings/settings-data.ts`
7. `src/app/admin/settings/page.tsx`
8. `src/app/admin/settings/actions.ts`
9. `src/app/admin/settings/SettingsForm.tsx`
10. `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`
11. `src/app/admin/bookings/new/page.tsx`
12. `src/app/admin/bookings/new/ManualBookingForm.tsx`

A trap worth flagging: a **case-insensitive** repo grep for `allowed_cities` returns 54 files
inside `src/` + docs, not 52/12. The 2 extra src-tree hits are false positives:
`src/features/booking/schemas/booking-schema.ts:5` (`export const BOOKING_ALLOWED_CITIES = [...]`)
and `src/features/booking/components/AboutYouStep.tsx` (imports/uses `BOOKING_ALLOWED_CITIES`).
That constant is a **separate, hardcoded client-side town list** used for public-booking-form
copy/validation — it has nothing to do with the `business_settings.allowed_cities` DB column and
must NOT be touched by a rename of the column/field. Confirmed by reading both files: neither
contains the literal string `allowed_cities` (lowercase with underscore) anywhere; the only
overlap is the substring inside the identifier `BOOKING_ALLOWED_CITIES`, which a case-insensitive
grep — but not a case-sensitive one — flags.

## 2. Claimed anchors — actual line vs. claim

All 12 files, every sub-anchor read directly and compared.

### `src/lib/booking/availability.ts`
| Claim | Actual | Drift |
|---|---|---|
| `BusinessSettingsRecord` field :58 | L58: `allowed_cities: unknown;` | NONE |
| select literal in `loadSettings` :433 | L433: `"booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled"` | NONE |
| gate read in `loadContextRest` :454 | L454: `if (!isCityAllowed(input.city, getAllowedCities(settings.allowed_cities))) {` | NONE |

### `src/app/admin/settings/settings-data.ts`
| Claim | Actual | Drift |
|---|---|---|
| `BusinessSettingsRow.allowed_cities` :47 | L47: `allowed_cities: string[];` (inside the `BusinessSettingsRow` interface, L39–49) | NONE |

### `src/app/admin/settings/page.tsx`
| Claim | Actual | Drift |
|---|---|---|
| `fallbackSettings.allowed_cities` :19 | L19: `allowed_cities: ["Luton", "Dunstable", "Houghton Regis"],` (inside `fallbackSettings` object, L12–22) | NONE |

### `src/app/admin/settings/actions.ts`
| Claim | Actual | Drift |
|---|---|---|
| formData parse :49 | L48–50: `const allowedCities = parseAllowedCities(\n    String(formData.get("allowed_cities") ?? "")\n  );` — literal key is on L49 | NONE |
| fieldErrors :68 | L67–68: `if (allowedCities.length === 0) {\n    fieldErrors.allowed_cities = "Enter at least one allowed service area.";` — key assignment on L68 | NONE |
| upsert payload key :92 | L92: `allowed_cities: allowedCities,` | NONE |
| `requireSettingsManager` :24 | L22–25: function is declared L22 (`async function requireSettingsManager() {`); the `requirePermission(PERMISSIONS.MANAGE_SETTINGS, supabase)` call the claim is pointing at is on L24 | NONE — claim points at the call line, which is correct, not the declaration line |
| min-one-entry check :67-68 | L67–68 exactly, see above | NONE |

### `src/app/admin/settings/SettingsForm.tsx`
| Claim | Actual | Drift |
|---|---|---|
| interface field :27 | L27: `allowed_cities: string[];` (inside a settings-shape interface, L20–29) | NONE |
| useState init :59 | L59: `const [cities, setCities] = useState<string[]>(settings.allowed_cities);` | NONE |
| dirty baseline :76 | L76: `cities: settings.allowed_cities,` (inside the `initial` `useMemo` baseline object) | NONE |
| error prop :388 | L388: `error={state.fieldErrors?.allowed_cities}` | NONE |
| hidden input `name=` :395 | L395: `name="allowed_cities"` (input at L393–397) | NONE |
| `ServiceAreaField` start ~:674 | L674: `function ServiceAreaField({` | NONE |
| copy strings :378, :708-711, :718 | see byte-for-byte quotes in §3 below | NONE |

### `src/app/admin/bookings/new/page.tsx`
| Claim | Actual | Drift |
|---|---|---|
| `.select("allowed_cities")` :75 | L75: `.select("allowed_cities")` | NONE |
| destructure :84 | L84: `const allowedCities = (settingsResult.data?.allowed_cities ?? []) as string[];` | NONE (this is an optional-chained property read + cast, not a destructuring pattern in the strict JS sense — the claim's word "destructure" is loose but the line and target are exactly right) |

### `src/app/admin/bookings/new/ManualBookingForm.tsx`
| Claim | Actual | Drift |
|---|---|---|
| doc comment :547 | L547–549: `/** C-07 Step 5 (W02-E-1) — business_settings.allowed_cities, for the\n   * inline (non-blocking) city warning below; create_booking_request still\n   * enforces this server-side. */` | NONE |
| `allowedCities` prop default :529 | L529: `allowedCities = [],` (destructured prop default) | NONE |
| typed :550 | L550: `allowedCities?: string[];` | NONE |

Note: this file never contains the literal snake_case string `allowed_cities` except inside the
L547 comment — the runtime prop is camelCase `allowedCities` throughout (also read at L1689,
L1690, L1727 for the inline city-warning UI, not separately claimed but consistent).

### Test-fixture files (`src/lib/booking/__tests__/*`)
| File | Claim | Actual | Drift |
|---|---|---|---|
| `updateBusinessSettings.test.ts` | `data.set` :83 | L83: `data.set("allowed_cities", overrides.allowed_cities ?? "Luton, Dunstable");` | NONE |
| `availability-options.test.ts` | mock key :49 | L49: `allowed_cities: ["Luton"],` (inside `business_settings.data`, L44–51) | NONE |
| `working-hours-segments.test.ts` | mock key :288 | L288: `allowed_cities: ["Luton"],` | NONE |
| `override-windows.test.ts` | mock keys :84 and :379 | L84: `allowed_cities: ["Luton"],`; L379: `allowed_cities: ["Luton"],` | NONE |
| `staff-recurring-windows.test.ts` | mock key :70 | L70: `allowed_cities: ["Luton"],` | NONE |

**Summary: every claimed anchor in the plan is accurate. Zero drift across all 12 files / ~24
sub-anchors.**

## 3. Verification of the four specific claims

### Claim 1 — `fake-supabase-admin.ts:21` types `data` as `unknown`

Read `src/lib/cache/__tests__/fake-supabase-admin.ts` L20–24:

```ts
export interface FakeQueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}
```

**CONFIRMED.** L21 is exactly `data?: unknown;`. All four `lib/booking/__tests__` fixtures import
`createFakeAdminClient` from this file (confirmed in `availability-options.test.ts:19`:
`import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";`, and the same
import shape recurs in the other three fixtures). Because `FakeQueryResult.data` is `unknown`, a
mock object like `{ business_settings: { data: { allowed_cities: [...] } } }` type-checks
regardless of what keys `allowed_cities` is renamed to or away from — `tsc` cannot flag a stale
mock key here. This is a real blind spot: if `allowed_cities` is renamed in the schema/select and
these four mocks are not updated, `tsc --noEmit` will pass anyway. The tests would still fail at
runtime (the renamed field would be `undefined` in the mock, so `getAllowedCities(undefined)`
would need to be checked against `availability.ts`'s actual handling of a missing/undefined value)
— but the failure surfaces only via `vitest`, not `tsc`.

### Claim 2 — none of the four fixtures asserts on the city gate itself

Read all four files in full for any city-gate-related assertion (grepped for
`Location is outside`, `reason`, `isCityAllowed`, and all occurrences of `city`/`Luton`/`Dunstable`):

- `availability-options.test.ts`: `city: "Luton"` (L37) always paired with `allowed_cities: ["Luton"]` (L49). The only `reason` assertions in the file are for a different gate — `"Online booking is currently paused."` (L163) and `expect(result.reason).toBeUndefined()` (L190) for the happy path. No assertion mentions the city gate or a rejected/mismatched city.
- `working-hours-segments.test.ts`: `allowed_cities: ["Luton"]` (L288), `city: "Luton"` (L333). No gate-rejection assertion anywhere in the file.
- `override-windows.test.ts`: two mock blocks, `allowed_cities: ["Luton"]` at L84 and L379, paired with `city: "Luton"` at L160 and L426 respectively. No gate-rejection assertion.
- `staff-recurring-windows.test.ts`: `allowed_cities: ["Luton"]` (L70), `city: "Luton"` (L126). No gate-rejection assertion.

**CONFIRMED for all four files.** In every case the mock's `allowed_cities` list and the test
input's `city` are the same literal `"Luton"` — the gate always passes, and its rejection branch
(`reason: "Location is outside the service area."` in `availability.ts:455`) is never exercised or
asserted on by these fixtures. They use Luton purely as a safe pass-through so the test can reach
the availability logic under test. Renaming the key is therefore safe from a *test-assertion*
standpoint in these four files — but per Claim 1, it is only caught by `vitest`, not `tsc`, if the
mock key is missed.

### Claim 3 — byte-for-byte SettingsForm copy strings

**L378** (`AdminPanelHeader description` prop):
```
Cities and towns where the team will travel. Customers booking outside these areas see a helpful message instead of a closed door.
```

**L708–711** (empty-state message, JSX text node, original line wrapping preserved):
```
No service areas yet. The booking form will currently turn every
customer away. Add at least one city below.
```

**L718** (`title` attribute on each city chip's `<span>`):
```
Service area. Customers within this area can book.
```

All three quoted exactly as they appear in the file at the time of this report.

### Claim 4 — every other file referencing `allowed_cities` or `free_travel_cities`, repo-wide

Command: `rg "allowed_cities"` and `rg "free_travel_cities"`, repo root, no path restriction,
case-sensitive (a separate case-insensitive pass was also run and is reconciled in §1 above — it
adds no real hits, only the `BOOKING_ALLOWED_CITIES` false positives already explained).

**`allowed_cities` — case-sensitive, 52 files total.** Beyond the 12 `src/` files in §1:

*SQL — live schema/DDL (6 files):*
- `supabase/migrations/20260502052540_phase2_group6_settings_and_audit.sql:9` — column definition: `allowed_cities jsonb not null default '[]'::jsonb,`
- `supabase/migrations/20260502160000_phase6_seed_business_settings_and_global_availability.sql:9,29,30,31,32` — seed/upsert `on conflict` logic keyed on `allowed_cities`
- `supabase/migrations/20260503150000_phase2_booking_atomic_snapshots.sql:178` — `create_booking_request` function body: `from jsonb_array_elements_text(v_settings.allowed_cities) as allowed(city)`
- `supabase/migrations/20260513120100_update_create_booking_request_per_participant_services.sql:310` — same unnest pattern, in a `CREATE OR REPLACE FUNCTION` that supersedes the previous body
- `supabase/migrations/20260727120000_c06_client_crud_hardening.sql:405` — same unnest pattern, in the current/latest `CREATE OR REPLACE FUNCTION create_booking_request`
- `supabase/migrations/20260802122636_c02_recurring_bookings.sql:187` — a **comment**, not code: `--   * No allowed_cities check. The address is a snapshot of an existing client`

These are the ones that actually matter for the rename's blast radius beyond `src/`: the RPC
function `create_booking_request` reads `v_settings.allowed_cities` server-side (Postgres), and its
current live definition is whichever migration ran last (`20260727120000_c06_client_crud_hardening.sql`
per migration-file ordering) — but all three versions in migration history reference the column
name literally, so a rename requires a new migration that also updates this function, not just the
TypeScript select-string in `availability.ts:433`.

*Non-live SQL evidence copy (1 file):*
- `redesign/evidence/C-06/create_booking_request-BEFORE.sql` — a saved snapshot of the function body from a prior audit, not executed, not a live consumer.

*Planning/evidence docs (33 files under `redesign/` and `implementation-plans/`):* these are
markdown planning artifacts (briefs, plans, per-page progress notes, audits, handoffs) that mention
`allowed_cities` in prose. None of them is executable code; they are out of scope for "consumers"
but are real hits for a literal-string repo grep, so listed here for completeness:
`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`, `redesign/HANDOFF-2026-08-11-IMPLEMENTATION.md`,
`redesign/HANDOFF-2026-08-11-PLANNING.md`, `redesign/evidence/plan-deepening/00-front.md`,
`redesign/evidence/plan-deepening/draft-item-04-bookings-indexes.md`,
`redesign/evidence/plan-deepening/draft-item-08a-settings-gates.md`,
`redesign/evidence/plan-deepening/draft-item-08b-fee-recurring-comms.md`,
`redesign/evidence/plan-deepening/01-preflight.md`,
`redesign/evidence/plan-deepening/x4-verification-commands.md`,
`redesign/evidence/plan-deepening/x2-collisions-ordering.md`,
`redesign/evidence/plan-deepening/item-07b-literals.md`,
`redesign/evidence/plan-deepening/x3-tests-and-baselines.md`,
`redesign/evidence/plan-deepening/item-08b-fee-recurring-comms.md`,
`redesign/evidence/plan-deepening/x1-shared-surfaces.md`,
`redesign/evidence/plan-deepening/item-08a-settings-gates.md`,
`redesign/evidence/plan-deepening/item-04-bookings-indexes.md`,
`redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md`,
`redesign/per-page-progress/C-23-admin-availability-calendar-progress.md`,
`redesign/per-page-progress/C-07-routing-and-per-role-defaults-progress.md`,
`redesign/briefs/C-07-routing-and-per-role-defaults-brief.md`,
`redesign/plans/C-phase/C-07-routing-and-per-role-defaults-plan.md`,
`redesign/per-page-scope/settings-scope.md`, `redesign/per-page-recipes/settings-recipe.md`,
`redesign/briefs/settings-brief.md`, `redesign/briefs/C-09-cache-invalidation-filter-cleanup-brief.md`,
`redesign/backend-plans/BUILD-postcode-lookup-client.md`,
`redesign/audits/C-A/W10-settings-downstream-impact-flow.md`,
`redesign/audits/C-A/W02-new-booking-end-to-end-flow.md`, `redesign/RECIPE-PROGRESS.md`,
`redesign/RECON.md`, `redesign/PER-PAGE-SCORES.md`, `implementation-plans/implementation_plan3.md`,
`implementation-plans/IMPLEMENTATION_PLAN.md`.

`e2e/` and `scripts/` were grepped separately (both case-sensitive and case-insensitive): **zero
hits in either directory.** No `supabase/functions/` directory exists in this repo
(`Glob supabase/functions/**/*` → no files found), so there are no edge functions to check.

**`free_travel_cities` — 7 files, all planning docs, zero code hits:**
`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`, `redesign/evidence/plan-deepening/99-tail.md`,
`redesign/evidence/plan-deepening/draft-item-08a-settings-gates.md`,
`redesign/evidence/plan-deepening/x4-verification-commands.md`,
`redesign/evidence/plan-deepening/x2-collisions-ordering.md`,
`redesign/evidence/plan-deepening/x3-tests-and-baselines.md`,
`redesign/evidence/plan-deepening/item-08a-settings-gates.md`. This string does not exist anywhere
in `src/`, `e2e/`, `scripts/`, or `supabase/` — it is purely a proposed future name in the plan's
own prose, not a live identifier anywhere yet.

### Claim 5 — any dynamic reference to the string `"allowed_cities"`?

Checked for: computed/bracket property access (`obj["allowed" + "_cities"]`, `obj[someVar]`),
`formData.get(<non-literal>)`, `Object.keys`/`Object.entries` spreads over a settings object that
would silently carry the key through a generic loop, and JSON fixture files.

- `rg` for `allowed_cities` inside `*.json` anywhere in the repo → **no matches.** No JSON fixture
  or snapshot file encodes the key.
- Every real consumer in `src/` uses the literal string `"allowed_cities"` (or, for the SQL
  functions, the literal identifier `allowed_cities`) — confirmed line-by-line in §2. None builds
  the key by concatenation, template interpolation, or a variable.
- `src/app/admin/settings/actions.ts` has one `Object.keys(...)` call (L71:
  `Object.keys(fieldErrors).length > 0`) — this only checks whether *any* field error exists; it
  does not construct or iterate over the `allowed_cities` key dynamically. All reads/writes of
  `fieldErrors.allowed_cities` elsewhere in the file are literal property access
  (`fieldErrors.allowed_cities = ...` at L68, `state.fieldErrors?.allowed_cities` in
  `SettingsForm.tsx:388`).
- The `payload` object in `actions.ts` (L83–94) and the `BusinessSettingsRecord` select string in
  `availability.ts:433` are both static, hand-written literals — not built from a shared
  field-list constant that a rename could miss one branch of.

**CONFIRMED: no dynamic reference exists anywhere in the repo.** A rename is a pure literal-string
substitution problem, not a "search harder for the sneaky computed key" problem — but it must span
four layers a naive `sed` on `src/` would miss: (a) the 12 `src/` files, (b) the live Postgres
column definition and the current `create_booking_request` function body in
`supabase/migrations/20260727120000_c06_client_crud_hardening.sql`, (c) the two now-superseded
`CREATE OR REPLACE FUNCTION` bodies in earlier migrations (historical, but part of migration
history/replay), and (d) the seed-data migration's `on conflict` clause. None of (b)-(d) live under
`src/`, so a grep scoped only to `src/` — as the plan's 12-file claim is — will correctly find every
TypeScript consumer but will miss every SQL one; the plan's "12 files" claim is accurate for its own
scope (TypeScript consumers) but is not a complete blast-radius count for a DDL rename.
