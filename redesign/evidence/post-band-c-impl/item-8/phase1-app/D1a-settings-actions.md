# D1a — `src/app/admin/settings/actions.ts` (read-only derivation)

Target file read in full: `src/app/admin/settings/actions.ts` (119 lines, entire file — confirmed at line 119 `EOF`).
Supporting trace: `src/lib/auth/rbac.ts` (full file, 434 lines).
Context-only peeks (not the assigned target, flagged as downstream risk, not audited line-by-line): `src/app/admin/settings/SettingsForm.tsx`, `src/app/admin/settings/settings-data.ts`, `src/app/admin/settings/page.tsx`, `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`.

---

## 1. Full text of `updateBusinessSettings`

Export line is **27**, closing brace is **119**. Quoted byte-exact, broken into the logical blocks the caller will need to edit.

### 1a. Signature (lines 27–30)

```
27	export async function updateBusinessSettings(
28	  _previousState: SettingsActionState,
29	  formData: FormData
30	): Promise<SettingsActionState> {
```

### 1b. Auth gate (lines 31–36)

```
31	  let actor;
32	  try {
33	    actor = await requireSettingsManager();
34	  } catch {
35	    return { error: "Insufficient permissions." };
36	  }
37	
```

### 1c. Field parsing (lines 38–50)

```
38	  const fieldErrors: Record<string, string> = {};
39	  const companyName = String(formData.get("company_name") ?? "").trim();
40	  const contactEmail = String(formData.get("contact_email") ?? "").trim();
41	  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
42	  const bookingWindowDays = Number(formData.get("booking_window_days"));
43	  const bufferTimeMins = Number(formData.get("buffer_time_mins"));
44	  const minimumNoticeHours = Number(formData.get("minimum_notice_hours"));
45	  const cancellationCutoffHours = Number(
46	    formData.get("customer_cancellation_cutoff_hours")
47	  );
48	  const allowedCities = parseAllowedCities(
49	    String(formData.get("allowed_cities") ?? "")
50	  );
```

### 1d. Validation / fieldErrors block (lines 52–73)

```
52	  if (!companyName) fieldErrors.company_name = "Company name is required.";
53	  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays <= 0) {
54	    fieldErrors.booking_window_days = "Enter a booking window above 0 days.";
55	  }
56	  if (!Number.isInteger(bufferTimeMins) || bufferTimeMins < 0) {
57	    fieldErrors.buffer_time_mins = "Enter a buffer time of 0 minutes or more.";
58	  }
59	  if (!Number.isInteger(minimumNoticeHours) || minimumNoticeHours < 0) {
60	    fieldErrors.minimum_notice_hours =
61	      "Enter a minimum notice of 0 hours or more.";
62	  }
63	  if (!Number.isInteger(cancellationCutoffHours) || cancellationCutoffHours < 0) {
64	    fieldErrors.customer_cancellation_cutoff_hours =
65	      "Enter a cancellation cutoff of 0 hours or more.";
66	  }
67	  if (allowedCities.length === 0) {
68	    fieldErrors.allowed_cities = "Enter at least one allowed service area.";
69	  }
70	
71	  if (Object.keys(fieldErrors).length > 0) {
72	    return { fieldErrors };
73	  }
74	
```

### 1e. `beforeState` read (lines 75–81) — SEE FINDING §3, this DOES exist today

```
75	  const adminClient = createSupabaseAdminClient();
76	
77	  const { data: beforeState } = await adminClient
78	    .from("business_settings")
79	    .select("*")
80	    .eq("id", 1)
81	    .single();
82	
```

### 1f. Upsert payload (lines 83–94)

```
83	  const payload = {
84	    id: 1,
85	    company_name: companyName,
86	    contact_email: contactEmail || null,
87	    contact_phone: contactPhone || null,
88	    booking_window_days: bookingWindowDays,
89	    buffer_time_mins: bufferTimeMins,
90	    minimum_notice_hours: minimumNoticeHours,
91	    customer_cancellation_cutoff_hours: cancellationCutoffHours,
92	    allowed_cities: allowedCities,
93	    booking_status_enabled: formData.get("booking_status_enabled") === "on",
94	  };
95	
```

### 1g. Upsert call + error return (lines 96–102)

```
96	  const { data, error } = await adminClient
97	    .from("business_settings")
98	    .upsert(payload, { onConflict: "id" })
99	    .select()
100	    .single();
101	
102	  if (error) return { error: error.message };
103	
```

### 1h. Audit write (lines 104–110)

```
104	  await adminClient.from("audit_logs").insert({
105	    actor_staff_id: actor.id,
106	    action_type: "business_settings_updated",
107	    target_type: "business_settings",
108	    before_state: beforeState,
109	    after_state: data,
110	  });
111	
```

### 1i. Cache invalidation footer + return (lines 112–119)

```
112	  updateTag(TAGS.SETTINGS);
113	  updateTag(TAGS.AUDIT);
114	  // B-149 fix (brief §2.2): resource-tag invalidation is additive — the
115	  // comprehensive revalidatePath below stays as defence-in-depth for surfaces
116	  // that read business_settings without going through unstable_cache.
117	  revalidatePath("/admin/settings");
118	  return { success: true };
119	}
```

---

## 2. `requireSettingsManager` — declaration, return type, and the `.permissions: Set<string>` claim

Exact declaration, lines 22–25:

```
22	async function requireSettingsManager() {
23	  const supabase = await createSupabaseServerClient();
24	  return requirePermission(PERMISSIONS.MANAGE_SETTINGS, supabase);
25	}
```

It is a thin, unexported (module-private) wrapper with no explicit return type annotation — TypeScript infers it from `requirePermission`'s signature. Traced into `src/lib/auth/rbac.ts`:

```
401	export async function requirePermission(
402	  permission: Permission,
403	  supabase: SupabaseClient
404	): Promise<StaffProfile> {
```

`requirePermission` throws (`PermissionError`, code `UNAUTHENTICATED` | `INACTIVE` | `FORBIDDEN`) or resolves to `StaffProfile`. `StaffProfile.permissions` is declared at rbac.ts line 289:

```
289	  permissions: Set<string>;
290	}
```

and is populated by `resolvePermissions(...)` (rbac.ts lines 298–334), which returns `Promise<Set<string>>` built from `role_permissions` plus per-staff overrides.

**Plan claim: "`requireSettingsManager()` already returns a full `StaffProfile` with `.permissions: Set<string>`, so this needs no extra fetch" — CONFIRMED.**
`requireSettingsManager()`'s inferred return type is `Promise<StaffProfile>` (identical to `requirePermission`'s explicit return type, since `requireSettingsManager` just returns that call directly with no transformation), and `StaffProfile.permissions` is exactly `Set<string>`. In `updateBusinessSettings`, `actor` (line 33, `actor = await requireSettingsManager();`) is therefore a full `StaffProfile`, and `actor.permissions.has("manage_travel_origin")` would type-check and work at runtime with no extra DB round-trip.

**However — a separate, unclaimed gap found while tracing this**: `PERMISSIONS` (rbac.ts lines 6–50) has **no `MANAGE_TRAVEL_ORIGIN` (or any `travel_origin`) entry**. A repo-wide grep of `src/` for `manage_travel_origin`, `MANAGE_TRAVEL_ORIGIN`, `mileage_origin`, and `free_travel_cities` returned **zero matches outside this report** — none of those strings exist anywhere in application code today, only in the DB (per the task's live-schema note). Any code that wants to gate on the `manage_travel_origin` permission will need to either add a `PERMISSIONS.MANAGE_TRAVEL_ORIGIN: "manage_travel_origin"` constant to rbac.ts first, or call `actor.permissions.has("manage_travel_origin")` with the raw string literal. This is app-code scaffolding the plan does not appear to account for and should be flagged, not assumed away.

---

## 3. Does a `beforeState` read already exist?

**Yes — it already exists today**, at lines 77–81 (quoted in §1e above):

```
  const { data: beforeState } = await adminClient
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .single();
```

It runs *after* validation passes (line 74's early return) and *before* the upsert (line 96), using `.select("*")` — i.e. it already fetches every column on the row, including whatever new columns (`free_travel_cities`, `mileage_origin`) exist in the live schema, with zero changes required to this read itself. `beforeState` is consumed once, at line 108 (`before_state: beforeState`) in the audit insert.

**Plan-snippet claim check**: the plan's suggested snippet references `beforeState?.mileage_origin` — this is directly supported by the existing `.select("*")` beforeState read; no new fetch, no column allowlist to edit here. **Nothing needs to be added for the beforeState mechanism itself.** What *would* need to be added is only in the parse/validate/payload sections (§4–5) — a `mileageOrigin` parse from `formData`, an optional validation rule if one is wanted, and a `mileage_origin` (and `free_travel_cities` dual-write, per the DECISION 9 expand-contract note) key in the `payload` object at lines 83–94. The audit row shape itself (`before_state`/`after_state`, both `beforeState`/`data` whole-row snapshots) needs **no structural change** — it already captures whatever columns exist on the row via `select("*")` and via the upsert's own `.select().single()` return (line 99), so two new fields simply ride along automatically once they're in `payload`.

---

## 4. Byte-exact quoted blocks requested

### `parseAllowedCities` (lines 15–20)

```
15	function parseAllowedCities(value: string) {
16	  return value
17	    .split(/[\n,]/)
18	    .map((city) => city.trim())
19	    .filter(Boolean);
20	}
```

### fieldErrors block

Already quoted in full in §1d (lines 52–73) — it is one continuous block, not split.

### upsert payload object (lines 83–94)

Already quoted in full in §1f — reproduced here for convenience:

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
```

### revalidate/updateTag footer (lines 112–118)

```
  updateTag(TAGS.SETTINGS);
  updateTag(TAGS.AUDIT);
  // B-149 fix (brief §2.2): resource-tag invalidation is additive — the
  // comprehensive revalidatePath below stays as defence-in-depth for surfaces
  // that read business_settings without going through unstable_cache.
  revalidatePath("/admin/settings");
  return { success: true };
```

---

## 5. Every other field the form parses and writes

From the parse block (lines 39–50) and payload (lines 83–94), the full field list is:

| Form-data key | Parsed as | Payload key | Notes |
|---|---|---|---|
| `company_name` | `String(...).trim()` | `company_name` | required, validated non-empty (line 52) |
| `contact_email` | `String(...).trim()` | `contact_email` (`\|\| null`) | optional, no format validation |
| `contact_phone` | `String(...).trim()` | `contact_phone` (`\|\| null`) | optional, no format validation |
| `booking_window_days` | `Number(...)` | `booking_window_days` | validated integer > 0 |
| `buffer_time_mins` | `Number(...)` | `buffer_time_mins` | validated integer ≥ 0 |
| `minimum_notice_hours` | `Number(...)` | `minimum_notice_hours` | validated integer ≥ 0 |
| `customer_cancellation_cutoff_hours` | `Number(...)` | `customer_cancellation_cutoff_hours` | validated integer ≥ 0 |
| `allowed_cities` | `parseAllowedCities(String(...))` → `string[]` | `allowed_cities` | validated non-empty array (line 67) |
| `booking_status_enabled` | `formData.get(...) === "on"` | `booking_status_enabled` | boolean checkbox idiom, parsed inline in the payload object itself, not hoisted to a named const like the others |

There is also `id: 1` in the payload — a literal constant, not read from `formData` (this row is a singleton keyed `id = 1`).

A new `mileage_origin` field would most naturally follow the `contact_email`/`contact_phone` idiom (optional text, `String(...).trim() || null`, no dedicated validation rule) — that is the closest existing precedent for an optional free-text setting field. A new `free_travel_cities` dual-write would reuse `allowedCities` (the already-parsed array) rather than re-parsing, per DECISION 9.

---

## 6. Audit-trail write

Lines 104–110 (quoted in full in §1h):

- `action_type`: the literal string `"business_settings_updated"` — a single generic action type, not per-field.
- `target_type`: literal string `"business_settings"`.
- `before_state`: the whole-row `beforeState` object from the `.select("*")` read at lines 77–81.
- `after_state`: `data`, the whole-row object returned by the upsert's own `.select().single()` (line 99).

**Does adding two new fields change this shape?** No. Both `before_state` and `after_state` are captured via `select("*")`/`.select().single()` whole-row snapshots, not explicit field lists. Once `free_travel_cities` and `mileage_origin` are included in the `payload` object (and hence written to the row), they will automatically appear in both `before_state` (on the *next* edit, once the row already has them) and `after_state` (immediately, since `after_state` reflects the just-written row) with zero code changes to the audit block itself. The `action_type` string stays a single generic `"business_settings_updated"` unless the plan wants a more granular audit taxonomy, which nothing in this file currently supports or requires.

---

## 7. Import block (lines 1–7)

```
1	"use server";
2	
3	import { revalidatePath, updateTag } from "next/cache";
4	import { createSupabaseAdminClient } from "@/lib/supabase/admin";
5	import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
6	import { createSupabaseServerClient } from "@/lib/supabase/server";
7	import { TAGS } from "@/lib/cache/tag-taxonomy";
```

Note: no blank line between `"use server";` (line 1) and the first import (line 3) other than the single blank at line 2 — reproduced exactly above, do not add/remove whitespace here if editing.

---

## 8. What breaks if the form field key `allowed_cities` is renamed to `free_travel_cities`, with the upsert dual-writing both DB columns

Walking every occurrence of the literal string `"allowed_cities"` in this file (5 occurrences: lines 48, 49 combined region, 68, 92 — see exact list below) plus the one DB-column write:

1. **Line 48–50** — `formData.get("allowed_cities")`: this reads the **form field name**. If the `<input name="...">` in `SettingsForm.tsx` (out of scope for this file, but confirmed present at `SettingsForm.tsx:395`, `name="allowed_cities"`) is renamed to `free_travel_cities` and this `.get(...)` key is not updated in lockstep, the parse will silently receive `""` (line 49's `?? ""` fallback triggers), `parseAllowedCities("")` returns `[]`, and validation at line 67 (`allowedCities.length === 0`) will **always fail** with `"Enter at least one allowed service area."` — the settings form would become permanently unsavable for the cities field. **This form-data key and the JSX `name` attribute must change together, in the same commit.**
2. **Line 68** — `fieldErrors.allowed_cities = "..."`: this is the **key in the `fieldErrors` record**, which `SettingsForm.tsx` reads back via `state.fieldErrors?.allowed_cities` (confirmed at `SettingsForm.tsx:388`). If this key is renamed here but not in the form component's error-display lookup (or vice versa), the validation message will silently stop rendering next to the field even though the error state object still carries it under whatever key was chosen. Must stay in sync with whatever key the `<Field error={...}>` prop reads.
3. **Line 92** — `allowed_cities: allowedCities` in the upsert `payload`: this is the **DB column name** being written. Per DECISION 9 (expand-contract, not rename), this must **NOT** become `free_travel_cities: allowedCities` alone — `create_booking_request` (the live SQL function) still reads `allowed_cities` as its booking gate, so this line must remain (or a twin must be added) so `allowed_cities` keeps being written, i.e. the payload needs **both** `allowed_cities: allowedCities` and `free_travel_cities: allowedCities` as separate keys pointing at the same parsed array, not a rename of this one key.
4. **Local variable name `allowedCities`** (declared line 48, used lines 67–68, 92): this is just an internal identifier, not a wire-format string — renaming *it* (e.g. to `freeTravelCities`) is cosmetic and safe on its own, but doing so without also handling points 1–3 above accomplishes nothing toward the actual dual-write requirement.
5. **`parseAllowedCities` function name** (line 15): purely internal; renaming it is cosmetic-only and independent of the form-field-key question. No external caller of this file imports it (it is not exported).
6. **The read side is untouched by this file**: `updateBusinessSettings` never *reads* `free_travel_cities` for display — that would be `settings-data.ts`/`page.tsx`'s job (out of scope here, flagged only). This action is write-only relative to those columns; it reads the pre-image only for the audit row (`beforeState`, §3), which is a `select("*")` and needs no key-specific change to pick up either column.

**Exact list of the literal string `"allowed_cities"` occurrences in this file** (for a caller doing a mechanical find-and-decide pass):

```
Line 49:    String(formData.get("allowed_cities") ?? "")
Line 68:    fieldErrors.allowed_cities = "Enter at least one allowed service area.";
Line 92:    allowed_cities: allowedCities,
```

(Line 48 is `const allowedCities = parseAllowedCities(` — the identifier, not the string literal; included above only as context since it spans the same statement as line 49.)

**Summary risk**: the highest-risk single-point-of-failure is line 92, because DECISION 9 explicitly forbids treating this as a rename. A naive find-and-replace of `allowed_cities` → `free_travel_cities` across this file would satisfy points 1–2 (form plumbing) correctly if done consistently with `SettingsForm.tsx`, but would **break the live booking gate** at line 92 if it also replaced the DB payload key instead of adding a second key beside it.

---

## Claims tested — summary table

| Claim | Verdict | Evidence |
|---|---|---|
| `requireSettingsManager()` returns a full `StaffProfile` with `.permissions: Set<string>` | CONFIRMED | rbac.ts:401-404 (`requirePermission` returns `Promise<StaffProfile>`), rbac.ts:289 (`permissions: Set<string>`), actions.ts:22-25 (`requireSettingsManager` returns that call directly, untransformed) |
| A `beforeState` read already exists in `updateBusinessSettings` | CONFIRMED (plan under-claimed uncertainty here — it does exist) | actions.ts:77-81, whole-row `select("*")`, consumed at actions.ts:108 |
| (Unclaimed, found during trace) App code has any existing reference to `manage_travel_origin`, `mileage_origin`, or `free_travel_cities` | FAILED / ABSENT | Repo-wide grep of `src/` for all four strings returned zero matches; `PERMISSIONS` const (rbac.ts:6-50) has no `MANAGE_TRAVEL_ORIGIN` entry |

## Anchors — claimed vs actual line numbers

No specific line numbers were pre-claimed by the plan for this file in the task prompt (the task asked me to locate everything fresh), so this table records what I located, for the caller's use in future edits:

| Symbol | File | Actual line |
|---|---|---|
| `updateBusinessSettings` (export) | actions.ts | 27 |
| `updateBusinessSettings` (closing brace) | actions.ts | 119 |
| `requireSettingsManager` | actions.ts | 22 |
| `parseAllowedCities` | actions.ts | 15 |
| `beforeState` read | actions.ts | 77 |
| upsert `payload` object | actions.ts | 83 |
| upsert call | actions.ts | 96 |
| audit_logs insert | actions.ts | 104 |
| updateTag/revalidatePath footer | actions.ts | 112 |
| `requirePermission` | rbac.ts | 401 |
| `StaffProfile.permissions: Set<string>` | rbac.ts | 289 |
| `PERMISSIONS` object | rbac.ts | 6 |
| `PERMISSIONS.MANAGE_SETTINGS` | rbac.ts | 40 |
