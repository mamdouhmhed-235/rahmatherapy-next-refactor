# X2 — What Actually Breaks (adversarial review of D1a/D1b/D2/D3/D4/D5/D6/D7)

Scope: given the exact change set (a)-(f) in the task, independently re-read every source
file the change touches (`actions.ts`, `SettingsForm.tsx`, `rbac.ts`, `availability.ts`,
`settings-data.ts`, `settings/page.tsx`, `bookings/new/page.tsx`,
`updateBusinessSettings.test.ts`, the 4 availability fixture tests, the live
`create_booking_request` SQL) directly — not by trusting the seven prior reports — and
re-ran the currently-passing tests and lint read-only to pin exact baselines. All line
numbers below were re-verified against the files as they exist right now (2026-08-11),
not copied from the prior reports.

Findings are ranked most severe first.

---

## #1 (CRITICAL — data/availability integrity) Naive "rename" in the upsert payload silently freezes the live booking gate

**Mechanism.** The live `create_booking_request` Postgres function (confirmed by direct
read of `supabase/migrations/20260727120000_c06_client_crud_hardening.sql:405`, the most
recent migration that touches it) still does:

```sql
from jsonb_array_elements_text(v_settings.allowed_cities) as allowed(city)
```

`actions.ts`'s upsert payload today is a single flat object literal (lines 83-94) with
exactly one city-array key: `allowed_cities: allowedCities` (line 92). The task's change
set (c) requires this to become a **dual-write** — both `allowed_cities: allowedCities`
and `free_travel_cities: allowedCities` present in the *same* payload object passed to the
*same* single `.upsert(payload, { onConflict: "id" })` call (lines 96-100).

**Why this is fragile in practice.** Every symbol touched by this change (form input
`name`, `formData.get(...)` key, `fieldErrors` key, the TS interface field name) is
literally the string `allowed_cities` today and needs to become `free_travel_cities`
almost everywhere *except* this one payload line, where it needs to become *two* keys
instead of one. A mechanical find-and-replace refactor (the single most natural way to
"rename a field end to end") will, by construction, turn line 92 into
`free_travel_cities: allowedCities` and leave no `allowed_cities` key at all. Nothing
catches this:

- **tsc**: the admin client (`src/lib/supabase/admin.ts:11-27`) is created via
  `createClient(url, serviceRoleKey, {...})` with **no `Database` generic argument** —
  confirmed by direct read, zero type parameter passed. The upsert payload's shape is
  therefore untyped (effectively `any`); tsc cannot flag a missing/extra key.
- **The existing test**: `updateBusinessSettings.test.ts` only asserts
  `expect(stub.upserts).toHaveLength(1)` (lines 101/118) — it never inspects the *keys*
  inside `stub.upserts[0]`. A payload with `free_travel_cities` but no `allowed_cities`
  passes this test identically to a payload with both.
- **The upsert itself**: since row `id=1` already exists (live schema, per task context),
  PostgREST compiles this to `ON CONFLICT (id) DO UPDATE SET <only the listed columns>`.
  Any column *not* in the payload is left completely untouched — not reset, not defaulted
  — so `allowed_cities` doesn't error, doesn't null out, doesn't even show up as changed in
  the audit log's `after_state` diff (it would just silently carry forward its last value
  forever). The save reports `{ success: true }`, the UI shows the new city list, and
  everything *looks* correct.

**Failure scenario.** An Owner adds "Leighton Buzzard" to the service-area list post-Phase-1.
The form saves fine, `free_travel_cities` correctly gains "Leighton Buzzard", the UI and
`availability.ts`'s client-side calendar check (once switched to read `free_travel_cities`,
per change (a)) both agree the city is bookable. But `create_booking_request` still reads
the frozen `allowed_cities` (which never got "Leighton Buzzard") and rejects the booking at
the database layer — a customer sees an available slot, fills the whole form, and gets
rejected only at final submission, with a generic "outside service area" server error that
contradicts what the UI just told them was fine. This is silent in every automated check
the repo currently has.

**Fix.** Never let the payload key change from `allowed_cities` — only *add*
`free_travel_cities: allowedCities` beside it, keeping `allowed_cities: allowedCities` as a
literal second line, permanently (until the plan's final DROP COLUMN phase). If this is
implemented, add a same-commit test assertion:
`expect(stub.upserts[0]).toMatchObject({ allowed_cities: [...], free_travel_cities: [...] })`
— this closes the exact hole the current test suite has (D6 independently flagged the
suite has *no* precedent for asserting upsert-row contents; I confirm this is more than a
"nice to have" — it's the only thing that would have caught this class of bug).

---

## #2 (CRITICAL — availability integrity, exhaustive analysis) NULL-vs-"" makes `mileageOriginChanged` evaluate `true` on essentially every save, and the consequence differs catastrophically between production and the test suite

This is the bug the task flagged as most likely. I traced it to ground truth on both sides.

### 2a. The exact condition, traced precisely

Live schema (task context, unverified further by me per read-only constraints):
`mileage_origin` is `text`, nullable, currently `NULL` on the one live row (`id=1`).

The only sane way to gate this field, given the codebase's *only* existing permission
idiom (`actor.permissions.has(PERMISSIONS.X)`, confirmed at `rbac.ts:415` inside
`requirePermission` and used nowhere else in this file except via
`requireSettingsManager()`), is something shaped like:

```ts
const mileageOriginChanged = mileageOrigin !== beforeState?.mileage_origin;
if (mileageOriginChanged && !actor.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)) {
  return { error: "Only the practice owner can change the mileage origin." };
}
```

The critical question is **what type is `mileageOrigin` at the point of comparison.**
Look at the file's own precedent for the *only* two other nullable-text fields it already
handles, `contact_email`/`contact_phone` (lines 40-41, 86-87):

```ts
const contactEmail = String(formData.get("contact_email") ?? "").trim();   // line 40
...
contact_email: contactEmail || null,                                       // line 86
```

Note the shape: the null-coercion (`|| null`) happens **only inline, at the point the
payload object literal is built** — there is no separate named variable anywhere in this
file that ever holds a null-coerced value. Every other variable in the function
(`companyName`, `contactEmail`, `contactPhone`, `allowedCities`, the four numeric fields)
is a raw parsed value; `|| null` (or the numeric equivalent) is applied *only* at
payload-construction time, never earlier. A `mileageOrigin` field implemented in the file's
own idiom will therefore almost certainly be declared as a **raw trimmed string**
(`const mileageOrigin = String(formData.get("mileage_origin") ?? "").trim();`), with
`mileage_origin: mileageOrigin || null` appearing only in the payload literal — i.e., *the
only* named variable available for the "changed" comparison is the un-coerced string, not
a null-coerced one.

If the comparison reuses that same raw variable — the path of least resistance and the one
consistent with this file's existing style — the comparison becomes:

```ts
mileageOriginRaw !== beforeState?.mileage_origin
//     ""         !==        null                →  true   (always, when unset)
```

`""` and `null` are different types; `!==` never coerces; `"" !== null` is `true` in every
JS engine, unconditionally. **`mileageOriginChanged` evaluates `true` for every single save,
by anyone, as long as `mileage_origin` remains unset — which is the DB's live state right
now.**

### 2b. Production consequence: total, permanent Admin lockout — invisible to Owner testing

- **Owner** saves: `mileageOriginChanged` is (spuriously) `true`, but the Owner *has*
  `MANAGE_TRAVEL_ORIGIN` (DB-seeded Owner-only grant, per task context), so the gate passes
  silently. The Owner sees no symptom at all. **Anyone testing this change as the Owner
  will conclude it works.**
- **Admin** saves: `MANAGE_SETTINGS` is granted to Admin too (task context), so today
  Admins can save the whole settings page. Under this bug, the very first time an Admin
  submits the form — to do something completely unrelated, e.g. flip the "Accept new
  bookings" switch or fix a typo in `company_name` — `mileageOriginChanged` is still `true`
  (the Admin's form almost certainly never renders/submits `mileage_origin` at all, since
  it's Owner-gated; `formData.get("mileage_origin")` returns `null` → `String(null ?? "")` →
  `""`), the permission check fails, and **the entire save is rejected** with a generic
  permission error that visibly has nothing to do with anything the Admin touched.
- **This is not self-healing after the Owner sets a real value either.** Once an Owner sets
  `mileage_origin` to a real non-empty string, an Admin's *subsequent* save still submits
  `""` (their form never includes the field, or if rendered `disabled`, browsers exclude
  `disabled` inputs from `FormData` entirely — confirmed general HTML/`FormData` behavior,
  not file-specific). `"" !== "<real address>"` is still `true`. **Every Admin save is
  blocked forever**, not just while the column is NULL. This is a full, permanent
  regression of a capability Admins currently have (they can save settings today; nothing
  in the current file gates any field by anything other than `MANAGE_SETTINGS`).

This is exactly the "partial-save regression the plan warns about," and I can now say
definitively that under the idiom-consistent implementation, it is not a partial
regression — it is a **total, permanent lockout**, and it is structurally invisible to
whoever implements and tests this as the Owner.

### 2c. Test-suite consequence: a crash, not a red assertion — and it will be misdiagnosed

I read `updateBusinessSettings.test.ts` in full and independently re-ran it
(`npx vitest run src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` →
**2 passed**, confirming today's clean baseline).

The `ACTOR` fixture (line 32): `{ id: "staff-owner", name: "Owner" }`, force-cast
`as never` at the mock site (line 90: `vi.mocked(requirePermission).mockResolvedValue(ACTOR as never)`).
**It has no `permissions` property at all.** `requirePermission` itself is fully mocked
(lines 27-30, `vi.mock("@/lib/auth/rbac", ...)` overrides only `requirePermission`), so
nothing about the real permission-resolution path runs in this test file, and the `as never`
cast means **tsc will not catch the missing `.permissions`** either — it's erased.

`stubAdminClient()`'s hardcoded `beforeState` read-back (line 52):
```ts
data: { id: 1, company_name: "Rahma Therapy", booking_window_days: 14 }
```
has no `mileage_origin` key at all (not even `null` — the key is *absent*, so
`beforeState?.mileage_origin` is `undefined`, not `null`, inside this specific test).

Trace test 1 ("invalidates the settings and audit resource tags", lines 94-106), which
uses the default `formData()` helper (no `mileage_origin` override):
- `mileageOriginRaw` = `""` (field absent from `formData()`, line 71-86 confirms no
  `mileage_origin` key is set anywhere in the helper).
- `beforeState?.mileage_origin` = `undefined`.
- `"" !== undefined` → `true` → `mileageOriginChanged` is `true`.
- The gate then evaluates `!actor.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)`.
- `actor.permissions` is `undefined` on this fixture.
- **`undefined.has(...)` throws `TypeError: Cannot read properties of undefined (reading 'has')`.**

This is an *uncaught exception* thrown from inside the Server Action body (this code runs
well after the `try { actor = await requireSettingsManager(); } catch {...}` block at
lines 32-36 — that `catch` only wraps the permission-fetch call, not the new gate logic).
`await updateBusinessSettings(...)` in the test will reject with this `TypeError` instead
of resolving to `{ success: true }`.

**Why this is worth flagging as a misdiagnosis trap specifically:** the test's stated
purpose (docstring, lines 7-12) is about cache-tag invalidation, and its assertions are
about `result` shape and `updateTag` calls. A developer seeing this test suddenly throw a
`TypeError` deep in `actions.ts`, with a stack trace pointing at a `.has()` call inside
what *looks* like ordinary field-validation code, has every reason to assume they broke the
mileage-origin *validator* (off-by-one in string parsing, wrong null check, etc.) — not
that the *test's own actor fixture* is missing a property that was never required before
this change. The actual fix is two lines in the test file
(`const ACTOR = { id: "staff-owner", name: "Owner", permissions: new Set([PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.MANAGE_TRAVEL_ORIGIN]) };`),
not anything in the validation logic — but nothing in the failure signature points there.

Test 2 ("never calls updateTag when validation fails", lines 108-120) is **unaffected**:
it supplies `booking_window_days: "0"`, which fails the numeric-field check at lines 53-55,
and the function returns `{ fieldErrors }` at line 72 — *before* the `beforeState` fetch
(line 77) or the new gate ever runs. This test stays green regardless of the bug, so the
"1 of 2 tests in this file suddenly throws while the other stays green" pattern is itself a
clue an implementer could use to work backward to the real cause, but only if they think to
look at what differs between the two test bodies (whether `fieldErrors` short-circuits
before reaching the new code) rather than assuming both are exercising the same code paths.

### 2d. Correct fix (both sides)

```ts
const mileageOriginRaw = String(formData.get("mileage_origin") ?? "").trim();
const mileageOrigin = mileageOriginRaw || null;
const currentMileageOrigin = (beforeState?.mileage_origin as string | null | undefined) ?? null;
const mileageOriginChanged = mileageOrigin !== currentMileageOrigin;
```
Normalizing **both** sides to `string | null` (never comparing a raw string against a
possibly-null/undefined DB value) is the only way `""` vs `NULL` compares equal when
nothing actually changed. And in the test file, `ACTOR` must gain a real
`permissions: Set<string>` so the fixture matches the `StaffProfile` shape
`requirePermission` is typed to return (`rbac.ts:289`, `Promise<StaffProfile>` at
`rbac.ts:404`) — otherwise this exact crash reappears the moment `mileageOriginChanged`
is ever legitimately `true` in a test (e.g. a deliberate "Admin tries to change it" test
case), even after the NULL-normalization fix.

---

## #3 (HIGH — data loss, distinct from #2) Even a correctly-gated write can silently wipe the Owner's mileage_origin on every Admin save

This is a sibling bug to #2, not the same bug — fixing #2 does **not** fix this by itself.

`actions.ts`'s payload (lines 83-94) is a single flat object where **every** field is
unconditionally included on **every** save by **any** actor with `MANAGE_SETTINGS` — there
is no existing concept anywhere in this file of "some fields are actor-conditional." If
`mileage_origin` is added to the payload the same way every other field is
(`mileage_origin: mileageOrigin` or `mileage_origin: mileageOrigin || null`, unconditionally),
then even once #2's gate is fixed so it no longer *blocks* the Admin's save, the payload
still literally writes `mileage_origin: null` (Admin's form never submits the field, so
`mileageOriginRaw` is always `""` → `null`) into the row on every Admin save — **silently
overwriting whatever real value the Owner configured**, with no gate to stop it, no error,
and a `{ success: true }` response.

**Fix.** The payload must resolve `mileage_origin` conditionally on the actor's permission,
not just gate the "changed" check:
```ts
mileage_origin: canManageOrigin ? mileageOrigin : currentMileageOrigin,
```
This is new *shape* of logic this file has never needed before (every other field is
actor-blind); flag it explicitly to whoever implements this rather than assuming "add a
gate" alone is a complete fix.

---

## #4 (HIGH, already directionally flagged by D4/D6, independently re-confirmed) Availability fixture tests break wholesale if not renamed in the same commit as `availability.ts`

Independently re-grepped and confirmed byte-exact (not trusting the prior reports' line
numbers):
```
src/lib/booking/__tests__/working-hours-segments.test.ts:288:        allowed_cities: ["Luton"],
src/lib/booking/__tests__/availability-options.test.ts:49:        allowed_cities: ["Luton"],
src/lib/booking/__tests__/staff-recurring-windows.test.ts:70:        allowed_cities: ["Luton"],
src/lib/booking/__tests__/override-windows.test.ts:84:        allowed_cities: ["Luton"],
src/lib/booking/__tests__/override-windows.test.ts:379:          allowed_cities: ["Luton"],
```
Independently read `src/lib/cache/__tests__/fake-supabase-admin.ts` — confirmed `select`
(and every other query-builder method) is `chain[method] = () => chain;` (line 73), a
parameterless no-op passthrough; the select-string content is ignored entirely, only the
mock object's own key names matter. Independently read `availability.ts`:
`getAllowedCities` (lines 243-249) returns `[]` for any non-array/`undefined` input;
`isCityAllowed("Luton", [])` (lines 251-257) is always `false`.

If change (a) flips `availability.ts:454`'s `settings.allowed_cities` read to
`settings.free_travel_cities` without the fixture literals above being renamed in the
same change, `settings.free_travel_cities` is `undefined` in every one of these tests →
`getAllowedCities(undefined)` → `[]` → every `city: "Luton"` check in these suites fails →
`loadContextRest` returns `{ reason: "Location is outside the service area." }` for every
scenario, and the resulting test failures read as "expected N available slots, got 0" /
"expected day open, got closed" — plausible to misdiagnose as "the availability engine
logic regressed" rather than "the fixture's column key wasn't renamed," since the message
in each failure is a real, semantically-meaningful business rule (not a type error).

**Fix.** This specific edit is *only* safe as a single atomic commit touching
`availability.ts` and all 4 fixture files' literal keys together — task's change set (f)
already accounts for this by including the fixture files in scope; flagging here only to
confirm the mechanism is real and I traced it independently, not assumed.

---

## #5 (MEDIUM) Lint baseline: independently re-verified all 12 touched files are lint-clean today; a 7th flagged file is a real but avoidable risk

Ran `npx eslint` (read-only, no `--fix`) directly against all 7 source files in the change
set plus all 5 target test files:
```
npx eslint src/app/admin/settings/actions.ts src/app/admin/settings/SettingsForm.tsx \
  src/app/admin/settings/settings-data.ts src/app/admin/settings/page.tsx \
  src/lib/auth/rbac.ts src/lib/booking/availability.ts src/app/admin/bookings/new/page.tsx
→ (no output — 0 errors, 0 warnings)

npx eslint src/app/admin/settings/__tests__/updateBusinessSettings.test.ts \
  src/lib/booking/__tests__/working-hours-segments.test.ts \
  src/lib/booking/__tests__/availability-options.test.ts \
  src/lib/booking/__tests__/staff-recurring-windows.test.ts \
  src/lib/booking/__tests__/override-windows.test.ts
→ (no output — 0 errors, 0 warnings)
```
All 12 files are 100% clean today. The repo's stated baseline ("lint 59E/7W in six files")
lies entirely outside this change set's footprint — none of these files are among the
six already-flagged files, so any new violation this change introduces would necessarily
be a genuinely new 7th (or more) flagged file, not an addition to an existing one.

Checked `eslint.config.mjs` (root config, standard `eslint-config-next` core-web-vitals +
typescript preset — no custom rule overrides, `redesign/**` itself is globally ignored so
this evidence directory is never linted). Concrete, specific ways this change set could
trip it, given the actual rule set in play:
- `@typescript-eslint/no-unused-vars`: if the fix for #2/#2d above introduces a
  `mileageOriginRaw` *and* a separately-declared `mileageOrigin`/`currentMileageOrigin` and
  one is left unused after a partial edit; or an unused `hasPermission` import from
  `rbac.ts` if the implementer imports it but then uses `actor.permissions.has(...)`
  directly instead (both are valid idioms in this codebase — importing both and using only
  one is an easy slip).
- `react-hooks/exhaustive-deps` (warn, part of `core-web-vitals`): only a risk if
  `SettingsForm.tsx` gains a *new* `useMemo`/`useEffect` for mileage-origin-specific
  client-side logic with a manually-authored dependency array; the existing `initial`
  `useMemo` (lines 73-86) already depends on `[settings]` as a whole object, so adding
  `mileageOrigin: settings.mileage_origin ?? ""` inside it needs no new dependency and is
  not at risk.

No evidence either of these will definitely happen — this is a named, concrete risk list
for review, not a predicted failure.

---

## #6 (MEDIUM) Upsert-resets-unnamed-columns is a false premise — but don't let that make you complacent about the omission risk

Contrary to what the phrasing "the dual-write being silently dropped by an upsert shape
that resets unnamed columns" might suggest, I confirmed (consistent with D1b's Q3, and
independently reasoned from standard PostgREST semantics — **not** independently verified
via live SQL, which is out of scope for this read-only pass) that `.upsert(payload, { onConflict: "id" })`
against an **already-existing** row (`id=1`, confirmed live per task context) compiles to
`ON CONFLICT (id) DO UPDATE SET <only the listed columns>` — columns absent from `payload`
are left **completely untouched**, not reset to their column `DEFAULT`. The `DEFAULT`-reset
scenario only applies on a fresh `INSERT` (row not yet existing), which is not today's
situation and won't become it as long as nothing deletes row `id=1`.

So: the real risk is not "upsert resets things" — it's the much more mundane "if
`mileage_origin` is parsed from the form but the implementer forgets to actually add the
key to the `payload` object literal (lines 83-94), the value the Owner typed is silently
discarded (never persisted anywhere), while the UI still reports `Settings saved.` (line
175, `toast.success("Settings saved.")`, fires unconditionally on any non-error/non-fieldErrors
result) with no error of any kind." This is a plain omission bug, not an upsert-semantics
bug — worth stating clearly since the task's phrasing invites diagnosing the wrong
mechanism.

---

## #7 (LOW, coupling risk — mitigated if change set (c)+(d) land atomically) String-keyed coupling across files

Already extensively catalogued by D1a/D2/D5/D7 (form `name` attribute ↔ `formData.get(...)`
key ↔ `fieldErrors` key ↔ `state.fieldErrors?.X` read, spanning `actions.ts` and
`SettingsForm.tsx`). I independently re-read both files in full and confirm every specific
line citation from those reports is byte-exact against the current file contents (e.g.
`actions.ts:49` `formData.get("allowed_cities")`, `actions.ts:68`
`fieldErrors.allowed_cities`, `actions.ts:92` `allowed_cities: allowedCities`,
`SettingsForm.tsx:388` `error={state.fieldErrors?.allowed_cities}`,
`SettingsForm.tsx:395` `name="allowed_cities"`). Under the task's exact change set, (c) and
(d) are specified to rename all of these *together*, which resolves this class of risk **if
and only if** they land in the same deploy — flagging only as a deployment-ordering
caveat, not a bug in the fully-applied change set itself.

One additional, not-previously-flagged coupling point: `SettingsForm.tsx`'s `FieldRow`
component's `value` prop is typed as plain `string` (line 535, `{ ... value: string; ... }`),
not `string | null`. Every existing nullable-text field coerces at the `useState`
call site (`contact_phone ?? ""` at line 70, `contact_email ?? ""` at line 71) — a new
`mileage_origin` field must follow the identical `settings.mileage_origin ?? ""` pattern at
its `useState` declaration or it fails to typecheck against `FieldRow`'s prop type. This
is a compile-time gate (tsc), so it fails loudly, not silently — lowest-severity item in
this report for that reason.

---

## Summary table

| # | Severity | What breaks | Silent or loud? | Caught by existing tests/tsc/lint? |
|---|----------|-------------|------------------|-------------------------------------|
| 1 | Critical | Naive rename (vs. dual-write) in the upsert payload freezes `allowed_cities`, live SQL booking gate goes stale | Silent | No |
| 2 | Critical | `"" !== null` makes `mileageOriginChanged` always true → permanent Admin lockout in prod; `TypeError` crash in the existing test (actor fixture has no `.permissions`) | Prod: silent-ish (generic permission error, invisible to Owner testing). Test: loud crash, but misdiagnosable | Test: yes (crashes), but for the wrong apparent reason. Prod: no |
| 3 | High | Unconditional payload write of `mileage_origin` silently wipes Owner's value on every Admin save, even after #2 is fixed | Silent | No |
| 4 | High | Renaming `availability.ts`'s read without renaming the 4 fixture files' literal keys breaks ~all availability tests | Loud, but misdiagnosable as a business-logic regression | Yes (tests fail) |
| 5 | Medium | New lint violation in previously-clean files | Loud (lint gate) | Yes, if lint is run |
| 6 | Medium | Forgetting to add `mileage_origin` to the payload object (plain omission, not an upsert-reset) | Silent | No |
| 7 | Low | String-key coupling (form name / fieldErrors key / error-prop) breaks only if (c)/(d) land non-atomically | Loud (broken save or vanished error display) | No, unless partially applied |

---

## Verification performed (read-only)

- Direct `Read` of `actions.ts`, `SettingsForm.tsx`, `rbac.ts` (PERMISSIONS block,
  `StaffProfile.permissions`, `requirePermission`, `hasPermission`), `availability.ts`
  (`BusinessSettingsRecord`, `getAllowedCities`, `isCityAllowed`, `loadSettings`,
  `loadContextRest`), `settings-data.ts`, `settings/page.tsx`,
  `src/lib/supabase/admin.ts`, `updateBusinessSettings.test.ts`,
  `fake-supabase-admin.ts` — all line numbers in this report are from these direct reads,
  not copied from prior agents' reports.
- `grep -n "allowed_cities" bookings/new/page.tsx` and the four availability fixture test
  files — confirmed exact matches.
- `grep` across `supabase/migrations/*.sql` for `allowed_cities` inside
  `create_booking_request` — confirmed the live function (migration `20260727120000`,
  line 405) still reads `v_settings.allowed_cities`.
- `npx eslint` (read-only) against all 7 touched source files and all 5 touched test files
  — 0 errors/warnings on all 12, confirming today's clean baseline for this specific
  change's footprint.
- `npx vitest run src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`
  (read-only, no `--update`) — 2/2 passing today, confirming the pre-change baseline the
  bugs above would regress from.

## Caveats

- The upsert-preserves-unlisted-columns claim (#6) rests on standard PostgREST/Postgres
  `ON CONFLICT ... DO UPDATE` semantics plus confirming the admin client is unwrapped
  `@supabase/supabase-js` (`src/lib/supabase/admin.ts`) — not on executing SQL against the
  live database, which is out of scope for this read-only pass.
- The exact shape of the `mileageOriginChanged` comparison and the payload's conditional
  write in #2/#2d/#3 is inferred from (a) the task's stated spec ("guarded by a new
  MANAGE_TRAVEL_ORIGIN permission enforced ONLY when the value actually changed") and (b)
  this file's own established coding idiom for its only two comparable nullable-text
  fields (`contact_email`/`contact_phone`) — not from reading code that has been written
  yet, since none of this exists in the repo today (confirmed: zero matches for
  `mileage_origin` or `MANAGE_TRAVEL_ORIGIN` anywhere in `src/`, consistent with every
  other agent's grep in this evidence set).
