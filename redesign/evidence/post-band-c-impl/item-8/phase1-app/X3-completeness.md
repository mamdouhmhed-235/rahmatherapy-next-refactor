# X3 — Completeness Review of D1a–D7 (item-8 phase1-app)

Adversarial pass. Lens: **what is missing** — files, consumers, types, tests, and
UI surfaces the seven derivation reports (D1a, D1b, D2, D3, D4, D5, D6, D7) did
not touch, or touched by filename only without reading. Every claim below was
independently re-derived from source, not copied from the prior reports.

## 1. The 12-file `allowed_cities` consumer list — RE-DERIVED, CONFIRMED COMPLETE

Fresh repo-wide search (`allowed_cities`, scoped to `src/`, no extension
filter) returns exactly these 12 files, matching D7's list byte-for-byte:

```
src/lib/booking/availability.ts
src/lib/booking/__tests__/override-windows.test.ts
src/lib/booking/__tests__/staff-recurring-windows.test.ts
src/lib/booking/__tests__/working-hours-segments.test.ts
src/app/admin/bookings/new/ManualBookingForm.tsx
src/lib/booking/__tests__/availability-options.test.ts
src/app/admin/bookings/new/page.tsx
src/app/admin/settings/page.tsx
src/app/admin/settings/settings-data.ts
src/app/admin/settings/__tests__/updateBusinessSettings.test.ts
src/app/admin/settings/actions.ts
src/app/admin/settings/SettingsForm.tsx
```

A parallel search for `free_travel_cities|mileage_origin` across `src/`
returns **zero** matches — independently confirms the app layer is fully
untouched by Phase 1a/1b, exactly as every prior report stated. No 13th file
exists today. This is a positive confirmation, not a gap.

## 2. NEW — the admin audit-trail rendering surface was never opened by any of the 7 reports

The task brief specifically asked whether `src/app/admin/audit/format.ts` (or
any settings-audit renderer) hardcodes a field-name label that would show the
Owner a stale/wrong name once `free_travel_cities`/`mileage_origin` start
appearing in `audit_logs.before_state`/`after_state`. None of D1a/D1b/D2/D3/D4/D5/D6/D7
mention `src/app/admin/audit/format.ts`, `AuditEventCard.tsx`, or
`redaction.ts` anywhere in their findings. I read all three in full.

**Verdict: this is a false alarm — the surface needs zero changes and poses zero risk.**

- `format.ts`'s `ACTIONS` map (lines 22-98) labels **action types only**, one
  entry: `business_settings_updated: { phrase: "updated business settings", ... }`
  (line 73). There is no per-field label anywhere in this map — it only ever
  describes the *event*, never the *fields that changed*.
- `AuditEventCard.tsx`'s "Show before / after" panel (lines 223-257) renders
  `before_state`/`after_state` via `prettyJson()` (line 81-85), which is
  `JSON.stringify(redactStatePayload(value), null, 2)` — a **raw JSON dump**.
  Whatever keys exist in the DB row snapshot appear verbatim, with their real
  column names. Once `actions.ts`'s upsert payload/select gains
  `free_travel_cities`/`mileage_origin`, they will appear in this JSON dump
  automatically and correctly labelled — no code change needed in this file.
- `redaction.ts`'s `REDACTION_REGEX = /note|health|treatment|consent|token|secret|key|payload|body/i`
  (line 3) does not match `allowed_cities`, `free_travel_cities`, or
  `mileage_origin` (checked char-by-char) — neither new column is at risk of
  being accidentally redacted, nor was ever a candidate for it.

This closes one of the task's explicit "what's missing" questions definitively:
the audit surface is safe and required no report to have flagged it as a risk,
but it also received **zero verification from any of the 7 agents** before now.

## 3. NEW — `src/lib/email/notifications.ts` has its own unlisted `BusinessSettings` interface

None of the 7 reports name this file's own type declaration (D7 lists
`notifications.ts` only as one of the 8 `business_settings`-reading files, by
filename, in its blast-radius count — nobody opened it to check what it reads).

```ts
// notifications.ts:117-121
interface BusinessSettings {
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
```
and its query, `notifications.ts:180`:
```ts
    .select("company_name, contact_email, contact_phone")
```

Confirmed: no city/travel field, so this file needs **no change** for Decision
9. But it means the repo now has **five**, not four, independently-declared
"BusinessSettings"-shaped interfaces with zero shared source of truth:
`settings-data.ts` (`BusinessSettingsRow`), `SettingsForm.tsx`
(`BusinessSettings`), `availability.ts` (`BusinessSettingsRecord`),
`customer-manage.ts` (`BusinessSettingsRecord`, D4's finding), and now
`notifications.ts` (`BusinessSettings`). Reported for completeness of the
blast-radius map; confirmed benign for this specific change only because
`notifications.ts`'s copy has no city field to go stale.

## 4. NEW — a 6th test file touches `business_settings` and was not in D6's inventory

D6's report frames its coverage as "five target test files." Independently
found and read in full a 6th: `src/app/admin/settings/__tests__/settings-data.test.ts`
(77 lines), which exercises `getSettingsPageData()` against a hand-built
`business_settings` fixture:

```ts
// settings-data.test.ts:26-38
function stubClient() {
  return createFakeAdminClient({
    business_settings: {
      data: { company_name: "Rahma Therapy", booking_window_days: 30 },
      error: null,
    },
    ...
```

The fixture never sets `allowed_cities`, and none of the four `it()` blocks
assert on it — the file is about cache-tag invalidation behaviour, not field
content. **Confirmed unaffected by Decision 9 either way.** Flagged purely as
a test-inventory completeness gap (a business_settings consumer test that no
report named), not as a risk.

## 5. NEW — the exact, zero-friction assertion that would prove the dual-write

D6 correctly observed "there is no existing precedent for asserting on the
CONTENTS of an upsert row" but stopped short of showing it's trivial. I read
`stubAdminClient()` in `updateBusinessSettings.test.ts` in full:

```ts
// updateBusinessSettings.test.ts:57-64
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row);
        return {
          select: () => ({
            single: async () => ({ data: row, error: null }),
          }),
        };
      },
```

`upserts` captures the **entire, unfiltered row object** passed to
`.upsert(row)` — no column allowlist, no shape coercion. A dual-write proof
test needs **zero stub changes**:

```ts
expect(stub.upserts[0]).toMatchObject({
  allowed_cities: ["Luton", "Dunstable"],
  free_travel_cities: ["Luton", "Dunstable"],
});
```

This directly answers the task's "does the existing test infrastructure
support asserting that" question: **yes, trivially**, via `stub.upserts[0]` —
this is new, actionable information beyond what D6 reported (D6 flagged the
gap; this pins the exact one-line fix with a byte-exact code path).

## 6. NEW — an Owner-only-gate precedent exists that D2/D5 missed

D2 states: "SettingsForm.tsx has ZERO per-field permission concept... a
mileage_origin field's Owner-only gating pattern must be invented from
scratch here." D5 repeats this as a risk. Both searched only
`SettingsForm.tsx` and `rbac.ts`'s `PERMISSIONS` object. The migration file's
own header (`20260811200100_item8_phase1b_manage_travel_origin_permission.sql`,
lines 3-7, quoted below) already points at a precedent that none of the 7
reports followed up on:

> "The mileage origin is Owner-editable only; every other business setting
> stays Admin-editable. This codebase has exactly one other Owner-exclusive
> gate (manage_role_templates) and it is permission-based, not a role-name
> check — so this follows that precedent rather than inventing a second
> mechanism."

Independently traced `MANAGE_ROLE_TEMPLATES`. `rbac.ts` has an established,
repo-wide convention of small `canX(profile): boolean` helpers that wrap
`hasPermission`:

```ts
// rbac.ts:213-215
export function canManageRoleTemplates(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_ROLE_TEMPLATES);
}
```

Consumed as a page-level gate in three files (`admin/roles/page.tsx:109`,
`admin/roles/[roleId]/page.tsx:63`, `admin/me/page.tsx:97`), and unit-tested
with a lightweight fixture helper in `rbac.test.ts:19-33`:

```ts
function profile(permissions: string[]): StaffProfile {
  return {
    id: "staff-a", auth_user_id: "auth-a", name: "Staff A",
    email: "staff-a@example.test", role_id: "role-a", role_name: "Therapist",
    gender: "female", active: true, can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}
```
and exercised at `rbac.test.ts:43-59` with exactly the Owner-vs-Admin split
D6 says `updateBusinessSettings.test.ts`'s `ACTOR` fake currently cannot do
(that fake is `{ id: "staff-owner", name: "Owner" }` with no `permissions`
Set, cast `as never`).

**This is the ready-made template** for two things the other reports flagged
as needing invention: (a) `canManageTravelOrigin` in `rbac.ts`, sibling to
`canManageRoleTemplates`; (b) the "Admin vs Owner" tests D6 says are blocked —
`rbac.test.ts`'s `profile()` helper is directly reusable as a model for a
similar helper in `updateBusinessSettings.test.ts`.

**Caveat, so this isn't overstated**: `canManageRoleTemplates` gates a whole
*page*, not one field inside a shared form. D2's narrower claim — that no
existing pattern shows "most fields open, one field Owner-locked, inside the
same form" — still stands; there is no in-form precedent, only an in-page one.

## 7. NEW — the migration's own comment shows this is a concept change, not just a rename

D2 found the three "become false" copy strings in `SettingsForm.tsx` are
*currently* still true and would only go stale "if this panel is later
repointed to display `free_travel_cities`." That is correct but understates
what "repointed" will actually require. The already-applied migration
(`20260811200000_item8_phase1a_free_travel_cities.sql`, lines 3-5, quoted
verbatim) states the field's *meaning* is changing, not just its column name:

> "`allowed_cities` stops being a gate ("who may book") and becomes the
> free-travel zone ("where we travel at no charge"). Addresses outside it stay
> bookable, at a fee an admin sets by hand."

So the eventual correct copy for this panel is not a find-and-replace of the
word "allowed" for "free travel" while keeping the same eligibility-gate
phrasing — it needs to describe a fee-based coverage concept ("free within
these towns, a fee applies outside them") rather than a hard yes/no gate. This
is a copy-writing/product implication no report surfaced, worth flagging to
whoever eventually rewrites `SettingsForm.tsx`'s copy (out of Phase 1's
literal scope, since Phase 1 per Decision 9 only dual-writes and keeps
`allowed_cities` as the live gate — but relevant to anyone reading D2's
"still true today" conclusion as "and will still be true after a rename").

## 8. NEW — a real customer-facing "service area" UI exists, confirmed rendered, confirmed disconnected from the DB

The task asked: "Does any UI surface display the service-area list to a user
that nobody has listed?" D7 lists `AboutYouStep.tsx` as one of two files using
`BOOKING_ALLOWED_CITIES`, but does not describe what it renders. I read the
JSX:

```tsx
// AboutYouStep.tsx:491-494
      <div className={styles.stepBlock}>
        <h3 className={styles.blockTitle}>Where should we visit?</h3>
        <div className={styles.chipRow}>
          {COVERED_TOWNS.map((town) => {
```

This is a real, rendered set of clickable town chips shown to the **customer**
during public booking (`COVERED_TOWNS` = the 5 towns in `BOOKING_ALLOWED_CITIES`,
title-cased). It is completely disconnected from `business_settings`
(confirmed — `booking-schema.ts` and `AboutYouStep.tsx` have zero
`business_settings` references). So today, and after Decision 9's dual-write
ships, the customer-facing chips will keep showing 5 towns (Luton, Dunstable,
Houghton Regis, Harpenden, St Albans) while the DB-driven admin gate and
audit-visible settings currently hold only 2 (Luton, Dunstable). This is a
**pre-existing inconsistency, untouched by and unrelated to Decision 9's
scope** — not a regression this work introduces — but it is the actual answer
to "does a UI surface show a service-area list nobody described": yes, and
its divergence from the DB value was never called out as a UX fact, only
implied as "an unrelated hardcoded constant."

## 9. Confirmed clean — the public `/areas` SEO pages have zero connection to `business_settings`

Also asked by the task. `src/content/pages/areaPages.ts` and everything under
`src/components/area-pages/` were grepped directly for `business_settings`,
`allowed_cities`, `free_travel_cities` — zero matches. These are fully static
marketing content (per project memory: 6 SEO service-area pages, Luton hub +
5 spokes) and correctly out of scope. Closing this off explicitly since the
task asked for it by name.

## 10. Field-level (not just file-level) verification of the other 4 `business_settings` consumer files

D7 counted "9 live `.from('business_settings')` call sites across 8 files,"
naming them by filename only. I independently opened the 4 files in that list
that are *not* among the 12 `allowed_cities` files, to confirm at the
column-list level (not just "this file mentions the table") that none of them
touch city/travel columns and therefore need zero changes for Decision 9:

- `assignment-eligibility.ts:183-186` — `.select("buffer_time_mins")` only.
- `customer-manage.ts:255-258` — `.select("company_name, contact_email, contact_phone, customer_cancellation_cutoff_hours")` only.
- `booking-window-settings.ts:39-40` — `.select("booking_window_days, minimum_notice_hours")` only.
- `notifications.ts:179-180` — `.select("company_name, contact_email, contact_phone")` only.

None reference `allowed_cities`, `free_travel_cities`, or `mileage_origin`.
This fully closes the loop D7 opened but did not finish: the 12-file and
8-file lists have no hidden overlap or missed consumer.

## 11. Independently re-confirmed (not just trusted) two D3/D4 claims

- **Live SQL gate, quoted byte-exact** (no report quoted the actual SQL text
  verbatim — only line numbers). `supabase/migrations/20260727120000_c06_client_crud_hardening.sql:403-409`,
  confirmed as the latest of 3 `create_booking_request` definitions
  (`20260503150000`, `20260513120100`, `20260727120000` — searched all
  migrations for `create (or replace) function public.create_booking_request`,
  three hits, `20260727120000` is chronologically last):
  ```sql
  if not exists (
    select 1
    from jsonb_array_elements_text(v_settings.allowed_cities) as allowed(city)
    where lower(v_clean_city) = lower(trim(allowed.city))
       or lower(v_clean_city) like '%' || lower(trim(allowed.city)) || '%'
  ) then
    raise exception 'Location is outside the service area';
  ```
  Minor, non-blocking wording note: the SQL's exception text ("Location is
  outside the service area", no trailing period) differs slightly from
  `availability.ts:455`'s app-side message ("Location is outside the service
  area.", with a period) — pre-existing, cosmetic, unrelated to Decision 9.

- **Zero `Object.keys/values/entries(PERMISSIONS)` usage repo-wide** —
  re-ran the grep independently (`Object\.(keys|values|entries)\(PERMISSIONS\)|PERMISSIONS\)\.length`
  across `src/`): zero matches. Corroborates D3's "adding
  `MANAGE_TRAVEL_ORIGIN` is purely additive" conclusion from a fresh search
  rather than accepting D3's own grep on faith.

- **Role/permission-override editors read live from the DB, not from the TS
  const** — confirmed directly: `admin/roles/[roleId]/page.tsx:94-97` runs
  `.from("permissions").select("id, name, description, category, scope, risk_level, active").eq("active", true)`
  — an unfiltered, name-agnostic query. `manage_travel_origin` (active=true
  per the task's given DB state) will appear in this UI with zero code
  change, exactly as D3 claimed.

## Summary of what was genuinely missing before this pass

| Area | Status before X3 | Status after X3 |
|---|---|---|
| Admin audit rendering (`format.ts`, `AuditEventCard.tsx`, `redaction.ts`) | Not opened by any of 7 reports | Opened, read in full, confirmed zero risk/zero changes needed |
| `notifications.ts`'s own `BusinessSettings` interface | Named only as a filename in D7's count | Read, confirmed benign (no city field) |
| `settings-data.test.ts` (6th business_settings test) | Not in D6's test inventory | Read in full, confirmed unaffected |
| Concrete dual-write test assertion | D6 flagged the gap, no worked example | Exact one-line `toMatchObject` assertion given, zero stub changes needed |
| `canManageRoleTemplates` as an Owner-gate precedent | D2/D5 said "must invent from scratch" | Precedent found, traced to 3 usages + a test fixture helper; caveat noted (page-level, not field-level) |
| Migration's "concept change, not rename" framing | Not surfaced by any report | Quoted verbatim; flagged as a copy-writing implication beyond a literal find-replace |
| Customer-facing town chips (`AboutYouStep.tsx`) | Named as an unrelated file by D7 | Confirmed as a real rendered UI surface, divergence from DB values made explicit |
| `/areas` SEO pages | Not checked by any report | Confirmed zero connection to `business_settings` |
| Field-level check of the "other 4" business_settings readers | Asserted by filename only (D7) | Verified column-by-column; confirmed zero city-field exposure |
| Live SQL gate exact text | Referenced by line number only | Quoted byte-exact |
