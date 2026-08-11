# D1b — Independent read of `src/app/admin/settings/actions.ts`

Read-only derivation. File read in full (120 lines) on 2026-08-11. Cross-checked
against `src/lib/auth/rbac.ts`, `src/lib/cache/tag-taxonomy.ts`,
`src/lib/supabase/admin.ts`, `src/app/admin/settings/settings-data.ts`,
`src/app/admin/settings/page.tsx`, and
`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`. No file was
written except this report; no git-mutating command, build, or SQL was run.

---

## Q1 — Complete control flow of `updateBusinessSettings`

Signature (lines 27–30):

```ts
export async function updateBusinessSettings(
  _previousState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
```

Return type is `SettingsActionState`, defined verbatim at lines 9–13:

```ts
export interface SettingsActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}
```

There are exactly **four** return points, in this order:

1. **Permission failure (lines 31–36)** — first statement in the function body.
   ```ts
   let actor;
   try {
     actor = await requireSettingsManager();
   } catch {
     return { error: "Insufficient permissions." };
   }
   ```
   `requireSettingsManager()` (lines 22–25) calls
   `requirePermission(PERMISSIONS.MANAGE_SETTINGS, supabase)`, which (per
   `src/lib/auth/rbac.ts` lines 401–421) throws a `PermissionError` with one of
   three distinct codes — `"UNAUTHENTICATED"` (no session), `"INACTIVE"`
   (profile inactive), `"FORBIDDEN"` (missing the permission) — carrying a
   specific message for each. The bare `catch {}` here discards the error
   object entirely (doesn't even bind it to a variable) and collapses all
   three into one generic string. **Return shape:** `{ error: string }` only
   — `fieldErrors` and `success` are absent (`undefined`).

2. **Field-validation failure (lines 38–73)** — no early return per field;
   every field is parsed and every check runs unconditionally, so multiple
   errors can accumulate in one pass:
   ```ts
   const fieldErrors: Record<string, string> = {};
   const companyName = String(formData.get("company_name") ?? "").trim();
   const contactEmail = String(formData.get("contact_email") ?? "").trim();
   const contactPhone = String(formData.get("contact_phone") ?? "").trim();
   const bookingWindowDays = Number(formData.get("booking_window_days"));
   const bufferTimeMins = Number(formData.get("buffer_time_mins"));
   const minimumNoticeHours = Number(formData.get("minimum_notice_hours"));
   const cancellationCutoffHours = Number(
     formData.get("customer_cancellation_cutoff_hours")
   );
   const allowedCities = parseAllowedCities(
     String(formData.get("allowed_cities") ?? "")
   );

   if (!companyName) fieldErrors.company_name = "Company name is required.";
   if (!Number.isInteger(bookingWindowDays) || bookingWindowDays <= 0) {
     fieldErrors.booking_window_days = "Enter a booking window above 0 days.";
   }
   if (!Number.isInteger(bufferTimeMins) || bufferTimeMins < 0) {
     fieldErrors.buffer_time_mins = "Enter a buffer time of 0 minutes or more.";
   }
   if (!Number.isInteger(minimumNoticeHours) || minimumNoticeHours < 0) {
     fieldErrors.minimum_notice_hours =
       "Enter a minimum notice of 0 hours or more.";
   }
   if (!Number.isInteger(cancellationCutoffHours) || cancellationCutoffHours < 0) {
     fieldErrors.customer_cancellation_cutoff_hours =
       "Enter a cancellation cutoff of 0 hours or more.";
   }
   if (allowedCities.length === 0) {
     fieldErrors.allowed_cities = "Enter at least one allowed service area.";
   }

   if (Object.keys(fieldErrors).length > 0) {
     return { fieldErrors };
   }
   ```
   Note `contact_email`/`contact_phone` have **no validation at all** — any
   string, including garbage, passes. **Return shape:** `{ fieldErrors: Record<string,string> }`
   only — `error` and `success` are absent. There is no combined
   `error`+`fieldErrors` case anywhere in the file.

3. **Upsert failure (lines 75–102)**:
   ```ts
   const adminClient = createSupabaseAdminClient();

   const { data: beforeState } = await adminClient
     .from("business_settings")
     .select("*")
     .eq("id", 1)
     .single();

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

   if (error) return { error: error.message };
   ```
   **Return shape:** `{ error: string }` where the string is the raw
   PostgREST/Postgres error message, passed through unmodified (unlike the
   permission path, this one is NOT genericized — it leaks whatever the DB
   driver says). The prior `.select("*")` read's own `error` is never checked
   — if that read fails, `beforeState` is silently `undefined` and execution
   continues into the upsert anyway.

4. **Success (lines 104–118)** — reached only if the upsert produced no error:
   ```ts
   await adminClient.from("audit_logs").insert({
     actor_staff_id: actor.id,
     action_type: "business_settings_updated",
     target_type: "business_settings",
     before_state: beforeState,
     after_state: data,
   });

   updateTag(TAGS.SETTINGS);
   updateTag(TAGS.AUDIT);
   // B-149 fix (brief §2.2): resource-tag invalidation is additive — the
   // comprehensive revalidatePath below stays as defence-in-depth for surfaces
   // that read business_settings without going through unstable_cache.
   revalidatePath("/admin/settings");
   return { success: true };
   ```
   The `audit_logs` insert's own `{ error }` is **never destructured or
   checked** — if the audit insert fails, the function still proceeds to
   invalidate caches and returns `{ success: true }`. **Return shape:**
   `{ success: true }` only — `error` and `fieldErrors` absent.

**Summary table:**

| Path | Trigger | Return value |
|---|---|---|
| 1 | `requireSettingsManager()` throws (any reason) | `{ error: "Insufficient permissions." }` |
| 2 | any field fails validation | `{ fieldErrors: {...} }` |
| 3 | `.upsert(...)` returns `error` | `{ error: error.message }` (raw DB message) |
| 4 | upsert succeeds | `{ success: true }` |

This matches the existing test file's expectations exactly (`updateBusinessSettings.test.ts` lines 100 and 117), which is corroborating evidence, not independent proof — the mocked `stubAdminClient()` in that test does not model real Postgres `ON CONFLICT` semantics (see Q3).

---

## Q2 — Does the action read the existing row before writing?

**YES.** Exact quote, lines 77–81:

```ts
  const { data: beforeState } = await adminClient
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .single();
```

Caveats a naive implementer would miss:
- Only `data` is destructured (renamed to `beforeState`); the read's `error`
  is discarded — a failed read does not abort the action, it just makes
  `beforeState` `undefined`.
- This read exists **solely to populate `audit_logs.before_state`** (used at
  line 108). It is **not** merged into the write `payload` — the payload
  (lines 83–94) is built entirely from parsed `formData`, independent of
  `beforeState`. So this is not a read-modify-write pattern from the
  application's point of view; column preservation for fields absent from the
  payload depends entirely on Postgres `ON CONFLICT DO UPDATE` semantics (see
  Q3), not on anything this file does with `beforeState`.

---

## Q3 — upsert vs update vs insert; does it target id=1; what happens to unnamed columns

It is an **`.upsert()`**, quoted exactly, lines 96–100:

```ts
  const { data, error } = await adminClient
    .from("business_settings")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
```

**Targets id=1**: not via a `.eq("id", 1)` filter on the upsert chain (there
is none) — instead the payload itself carries `id: 1` (line 84,
`payload = { id: 1, ... }`), and `onConflict: "id"` tells PostgREST to match
on that column.

**Client is real `@supabase/supabase-js`, not a wrapper.**
`createSupabaseAdminClient()` (`src/lib/supabase/admin.ts` lines 11–27) calls
`createClient(url, serviceRoleKey, {...})` from `@supabase/supabase-js`
directly — service-role key, RLS bypassed. So standard PostgREST upsert
semantics apply, not some custom merge logic.

**Payload has exactly 10 keys** (lines 83–94): `id, company_name,
contact_email, contact_phone, booking_window_days, buffer_time_mins,
minimum_notice_hours, customer_cancellation_cutoff_hours, allowed_cities,
booking_status_enabled`. Per the task's live-schema context,
`business_settings` has 12 columns total; the two absent from this payload
are exactly `free_travel_cities` and `mileage_origin`.

**What happens to columns not in the payload — definitive answer:** They are
**preserved, not reset/defaulted**, given the current live state of the
table. PostgREST's `.upsert(payload, { onConflict: "id" })` compiles to
`INSERT INTO business_settings (<payload columns>) VALUES (...) ON CONFLICT
(id) DO UPDATE SET <payload columns except id> = excluded.<column>`. Only
columns present in `payload` appear in either the `INSERT` column list or the
`DO UPDATE SET` clause. Since row `id=1` already exists (per this task's
verified live-schema snapshot: `business_settings` has one row, populated,
with `allowed_cities` and `free_travel_cities` both holding
`["Luton","Dunstable"]` and `mileage_origin` = `NULL`), every real call to
this action takes the `DO UPDATE` branch — the `INSERT` branch (where
defaults would apply) is dead code for practical purposes. Columns absent
from the payload — `free_travel_cities`, `mileage_origin` — are therefore left
**completely untouched** by every call this action makes today; their
current stored values persist unchanged.

**Confidence caveat (be explicit about this, since it directly answers the
caller's stated worry):** this is standard, well-documented PostgREST/Postgres
`ON CONFLICT DO UPDATE` behavior, not something I executed against the live
DB (SQL execution is out of scope for this read-only task) — and I want to
flag that the repo's own test coverage cannot corroborate it either. The unit
test (`updateBusinessSettings.test.ts`, `stubAdminClient()` lines 34–69) mocks
`.upsert()` with a hand-rolled fake that just pushes the payload object and
echoes it straight back as `data` — it does not model column preservation,
`ON CONFLICT`, or defaults at all, so it would pass identically whether or not
this semantic is true. My answer rests on reading the actual `.upsert(...)`
call site and knowing the target ORM/driver's real behavior, not on any test
in this repo. If the orchestrator wants empirical proof, that requires either
a live Postgres check or a targeted integration test against a real (or
`pg-mem`-style) Postgres instance — mocked-client unit tests as currently
written cannot settle it.

---

## Q4 — Cache tags/paths invalidated

Exact quote, lines 112–117:

```ts
  updateTag(TAGS.SETTINGS);
  updateTag(TAGS.AUDIT);
  // B-149 fix (brief §2.2): resource-tag invalidation is additive — the
  // comprehensive revalidatePath below stays as defence-in-depth for surfaces
  // that read business_settings without going through unstable_cache.
  revalidatePath("/admin/settings");
```

Resolved literal values, from `src/lib/cache/tag-taxonomy.ts` lines 20–21:

```ts
  SETTINGS: "settings",
  AUDIT: "audit",
```

So concretely: `updateTag("settings")`, `updateTag("audit")`,
`revalidatePath("/admin/settings")`. Only invoked on the success path (path
4 in Q1) — never on permission failure, field-validation failure, or upsert
failure. This is directly asserted by the existing test
(`updateBusinessSettings.test.ts` line 119:
`expect(updateTag).not.toHaveBeenCalled();` on a validation-failure run).

---

## Q5 — `parseAllowedCities`, byte-exact, and where defined

Defined in this same file, `src/app/admin/settings/actions.ts`, lines 15–20,
module-private (no `export` keyword):

```ts
function parseAllowedCities(value: string) {
  return value
    .split(/[\n,]/)
    .map((city) => city.trim())
    .filter(Boolean);
}
```

Behavior: splits the input string on either a newline or a comma (regex
`/[\n,]/`, so `"\r\n"` leaves a leading `\r` on the following token that then
gets trimmed away — `.trim()` strips `\r` too, so that's harmless), trims
whitespace off each resulting piece, then drops any falsy (empty-string)
entries via `.filter(Boolean)`. It is a single-purpose, unexported helper
used exactly once, at its only call site, lines 48–50:

```ts
  const allowedCities = parseAllowedCities(
    String(formData.get("allowed_cities") ?? "")
  );
```

Confirmed via repo-wide grep for `parseAllowedCities` — the only two hits are
its definition (line 15) and this one call site (line 48). No duplicate or
client-side equivalent exists elsewhere (e.g. `SettingsForm.tsx` does not
reimplement this parsing — it manages a `string[]` of cities in component
state instead and serializes them into the same `allowed_cities` form field
some other way not covered by this file).

---

## Q6 — Empty-string vs null for a hypothetical new nullable `mileage_origin` text field, based on how `contact_email`/`contact_phone` are handled today

Parsing (lines 40–41):

```ts
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
```

Payload construction (lines 86–87):

```ts
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
  ```

The pattern is: read the raw form value (or `""` if the key is missing from
`formData` entirely), `.trim()` it, then in the payload use `<value> || null`
— i.e. an empty string (falsy) becomes `null`, any non-empty trimmed string
is stored as-is. Neither field has a validation rule in the `fieldErrors`
block (unlike `company_name`, which requires non-empty), so both are
genuinely optional and both empty-string and whitespace-only input are
normalized to `null` before hitting the DB.

**Implication for a new `mileage_origin` field, if added by mechanically
copying this pattern:**
```ts
const mileageOrigin = String(formData.get("mileage_origin") ?? "").trim();
// ...
mileage_origin: mileageOrigin || null,
```
would give the same empty-string→`null` normalization, appropriate for a
`text, nullable` column. **This is not automatic** — it only holds if the
new field's parsing/payload-construction code explicitly follows the
`contact_email`/`contact_phone` idiom (`.trim()` then `value || null`). A
naive implementer who instead does `formData.get("mileage_origin") as string`
without the `|| null` fallback (mirroring, say, `company_name`'s handling,
which stores the trimmed string directly with no null-coalescing because it's
required and validated non-empty) would end up writing `""` instead of `NULL`
for a blank field — semantically different in a nullable column (empty
string is a valid non-null value; `NULL` means "not set"), and would also
silently violate Decision 9's implication that `mileage_origin` starts life
`NULL` and should presumably be able to return to that state if cleared.

**Also relevant to Decision 9:** whatever field is added for `mileage_origin`
must be added to the `payload` object (lines 83–94) for it to be written at
all — per Q3, any column not explicitly listed in `payload` is left
untouched by the upsert, so simply adding a form input without adding the
corresponding payload key would silently do nothing.

---

## Q7 — Assumptions a naive implementer would make that are FALSE

1. **"It's an `.update()`."** False — it's `.upsert(payload, { onConflict:
   "id" })` (lines 96–100). There is no `.update()` call anywhere in this
   file.

2. **"There's no read before the write, so this is fire-and-forget."** False
   — there's a `select("*").eq("id",1).single()` read at lines 77–81, but it
   exists purely to snapshot `before_state` for the audit log, not to inform
   the write.

3. **"An upsert with a partial payload will reset/null out columns not in
   the payload."** False for this call shape, given the row at id=1 already
   exists — see Q3. Standard PostgREST `ON CONFLICT DO UPDATE` only touches
   listed columns; `free_travel_cities` and `mileage_origin` (today, absent
   from the payload) are left completely alone by every call. (It would be
   true only on a fresh `INSERT`, which is not the live situation here.)

4. **"Dual-writing `free_travel_cities` under Decision 9 is just a matter of
   renaming the `allowed_cities` key in `payload`."** False and dangerous —
   per the task's Decision 9, `allowed_cities` must **keep** being written
   (the live `create_booking_request` SQL function still gates on it) while
   `free_travel_cities` is written too. Renaming the payload key would stop
   writing `allowed_cities`, silently breaking the booking gate. Both keys
   need to be present in `payload`, presumably with the same array value.

5. **"This action enforces the DB's `manage_travel_origin` (Owner-only)
   permission for anything settings-related, including a future
   `mileage_origin` field."** False — the only gate here is
   `requireSettingsManager()` → `requirePermission(PERMISSIONS.MANAGE_SETTINGS,
   ...)` (lines 22–25), and `MANAGE_SETTINGS` is granted to **both** Admin
   and Owner per this task's context. Moreover, **`PERMISSIONS` in
   `src/lib/auth/rbac.ts` (lines 6–50) has no `MANAGE_TRAVEL_ORIGIN` entry at
   all** — the DB-seeded `manage_travel_origin` permission is not yet wired
   into the TypeScript permission-constant map anywhere in `src/`, confirmed
   by repo-wide grep. If `mileage_origin` is meant to be Owner-only writable
   (as its `risk_level=high`, Owner-only grant suggests), this file's current
   single blanket permission check does not achieve that, and the constant
   doesn't even exist yet for a new check to reference.

6. **"The permission-failure error message tells you why access was
   denied."** False — `requirePermission` throws three distinct
   `PermissionError` codes/messages (`UNAUTHENTICATED`, `INACTIVE`,
   `FORBIDDEN`, rbac.ts lines 401–421), but the bare `catch {}` here (lines
   34–36) discards the caught value entirely and always returns the same
   generic `"Insufficient permissions."` string.

7. **"If the upsert or audit insert fails partway, nothing is
   half-committed."** Partially false — the upsert's `error` **is** checked
   and short-circuits (line 102), but the subsequent `audit_logs.insert(...)`
   at lines 104–110 has its `{ error }` result completely discarded (not even
   destructured). A failed audit-log write is invisible: the function still
   proceeds to `updateTag`/`revalidatePath` and returns `{ success: true }`
   as if everything succeeded.

8. **"Editing this file alone is enough to add `mileage_origin` support to
   the settings page."** False, out of this file's scope but material: the
   read side (`src/app/admin/settings/settings-data.ts`
   `BusinessSettingsRow`, lines 39–49) and `src/app/admin/settings/page.tsx`
   (`fallbackSettings`, lines 12–22) both currently type/hardcode only the
   pre-Decision-9 column set (`allowed_cities`, no `free_travel_cities` or
   `mileage_origin` anywhere) — confirmed by grep across
   `src/app/admin/settings/`. Wiring a new field all the way through requires
   touching those files and `SettingsForm.tsx` too, not just `actions.ts`.

9. **"The success return includes the updated row / new settings data for
   the client."** False — `{ success: true }` is a bare boolean flag (line
   118); the fetched `data` from the upsert's `.select().single()` is used
   only for the audit log's `after_state`, never returned to the caller. Any
   UI that needs the fresh values must re-fetch (e.g. via the `unstable_cache`
   read path in `settings-data.ts`, which is exactly what the tag/path
   invalidation in this action is priming).

10. **"Field validation short-circuits on the first bad field."** False —
    every field is parsed and every validation check executes unconditionally
    (lines 52–69); `fieldErrors` can and does accumulate multiple keys in one
    submission, and the function only returns once at the end of that block
    (line 71–73).

---

## Additional note: existing test coverage as corroboration, not proof

`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` already
covers the return-shape claims in Q1 (success returns `{ success: true }`,
line 100; validation failure sets `fieldErrors` and never calls `updateTag`,
lines 117–119) and the exact tag-invalidation order (`["settings", "audit"]`,
lines 102–105) — this corroborates my reading of the source but is not
independent verification, since I derived both from the same source text.
Where I could not corroborate from tests — notably the upsert
column-preservation claim in Q3 — I've said so explicitly, because the
mocked `stubAdminClient()` (lines 34–69 of that test file) fakes `.upsert()`
in a way that cannot distinguish "preserves unlisted columns" from "resets
them," so that claim rests on PostgREST/Postgres semantics knowledge, not on
anything runnable in this repo today.
