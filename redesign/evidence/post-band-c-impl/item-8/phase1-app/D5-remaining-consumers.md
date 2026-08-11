# D5 — Remaining `allowed_cities` app-code consumers (Phase 1, item 8)

Read-only verification pass. Repo: `rahmatherapy-next-refactor`. All line numbers below were
re-derived by opening the files fresh (not trusted from the plan). Decision 9 (expand-contract,
dual-write, no rename) held throughout — see the "Decision 9 implications" note at the end of
each file section.

**Headline: all four claimed anchors in this batch are ACCURATE (no drift).** That is unusual
given the plan's track record (29 + 6 prior failures) — treat it as a genuinely verified fact,
not an assumption carried over from the plan text.

---

## 1. `src/app/admin/settings/settings-data.ts`

### Claimed anchor: `BusinessSettingsRow.allowed_cities` at :47
**Actual line: 47. Drift: NONE.**

```
47	  allowed_cities: string[];
```

### The full `BusinessSettingsRow` interface (lines 39–49)

```
39	export interface BusinessSettingsRow {
40	  company_name: string;
41	  contact_email: string | null;
42	  contact_phone: string | null;
43	  booking_window_days: number;
44	  buffer_time_mins: number;
45	  minimum_notice_hours: number;
46	  customer_cancellation_cutoff_hours: number;
47	  allowed_cities: string[];
48	  booking_status_enabled: boolean;
49	}
```

Neither `mileage_origin` nor `free_travel_cities` is present. Per Decision 9, the app must READ
`free_travel_cities` (not `allowed_cities`) — so this interface needs `free_travel_cities:
string[];` added, and `mileage_origin: string | null;` added for the Owner-only origin field.
Whether `allowed_cities` itself should stay in this interface depends on whether any Phase-1
read path in this file still needs it — see the select-string finding below, which shows it
currently doesn't need to (this file selects `"*"`).

### THE SELECT STRING — the single most important fact in this file

```
94	export async function getSettingsPageData(): Promise<SettingsPageData> {
95	  const cached = unstable_cache(
96	    async (): Promise<SettingsPageData> => {
97	      const admin = createSupabaseAdminClient();
98	      const [{ data: settings }, lastChange] = await Promise.all([
99	        admin
100	          .from("business_settings")
101	          .select("*")
102	          .eq("id", 1)
103	          .single<BusinessSettingsRow>(),
104	        loadLastChange(),
105	      ]);
106	      return { settings: settings ?? null, lastChange };
107	    },
108	    ["settings-page"],
109	    { revalidate: 60, tags: [TAGS.SETTINGS] }
110	  );
111	  return cached();
112	}
```

**This is `select("*")`, not an explicit column list.** Consequence: `free_travel_cities` and
`mileage_origin` will arrive in the raw row **for free at runtime** — no query change is needed
here. The only gap is the TypeScript side: `.single<BusinessSettingsRow>()` types the row using
the interface above, which is missing both new columns, so `settings.free_travel_cities` /
`settings.mileage_origin` would be typed `any`/nonexistent until `BusinessSettingsRow` is
extended. This is a type-only fix in this file, not a query fix.

### Full data-loading function
The function shown above (`getSettingsPageData`, lines 94–112) is the complete data-loading
function in this file (the plan doesn't name a second one, and grep confirms there is no other
`business_settings` query here). `loadLastChange` (lines 56–92) queries `audit_logs` /
`staff_profiles`, not `business_settings`, and never touches `allowed_cities`.

### Where the result flows
`getSettingsPageData()` is called from `src/app/admin/settings/page.tsx:41`
(`const { settings, lastChange } = await getSettingsPageData();`), and `settings` is passed
straight into `<SettingsForm settings={settings ?? fallbackSettings} .../>` at page.tsx:50-53.
The doc comment at settings-data.ts:34-37 states the interface is declared standalone
"because SettingsForm's copy is module-private; the shapes are structurally identical, which is
what the assignment in page.tsx relies on." **This means `SettingsForm.tsx` has its own
module-private copy of a settings-row type that must be kept structurally identical.** That file
is outside this task's four targets, but grep confirms it independently references
`allowed_cities` in 5 places (a local type field, two `useState`/payload reads, and two form
field bindings — lines 27, 59, 76, 388, 395). Flagging this only as context: Phase 1 work on
`settings-data.ts`'s interface will need a matching update in `SettingsForm.tsx`'s
structurally-identical type or the "structurally identical" invariant the code comment relies on
breaks silently (TS will still compile if the shapes merely happen to overlap, but the new
fields won't be visible to the form).

### Decision 9 implications
No write path exists in this file — it is read-only (`getSettingsPageData`). Nothing here needs
a dual-write; that lives in the settings *save* action (not one of the four target files, not
inspected here). This file only needs: (a) add `free_travel_cities` and `mileage_origin` to
`BusinessSettingsRow`, (b) nothing else, since `select("*")` already returns both columns.

---

## 2. `src/app/admin/settings/page.tsx`

### Claimed anchor: `fallbackSettings.allowed_cities` at :19
**Actual line: 19. Drift: NONE.**

```
19	  allowed_cities: ["Luton", "Dunstable", "Houghton Regis"],
```

Note the fallback's city list ("Luton", "Dunstable", "Houghton Regis") does not match the live
DB value for either `allowed_cities` or `free_travel_cities` (both currently `["Luton",
"Dunstable"]` per the task's live-schema note) — this fallback is a hardcoded literal, not
synced to any table, and is only used when the settings row is `null`.

### Full `fallbackSettings` object (lines 12–22)

```
12	const fallbackSettings = {
13	  company_name: "Rahma Therapy",
14	  contact_email: null,
15	  contact_phone: null,
16	  booking_window_days: 30,
17	  buffer_time_mins: 30,
18	  minimum_notice_hours: 24,
19	  allowed_cities: ["Luton", "Dunstable", "Houghton Regis"],
20	  booking_status_enabled: true,
21	  customer_cancellation_cutoff_hours: 24,
22	};
```

This object has no `free_travel_cities` or `mileage_origin` key. If `SettingsForm`'s prop type
is widened to require `free_travel_cities`/`mileage_origin`, this literal must gain matching
keys or the `settings={settings ?? fallbackSettings}` assignment at line 51 will fail to
typecheck (fallbackSettings is an inferred object literal, not typed against
`BusinessSettingsRow`, so today it silently gets away with being narrower — TS structural typing
means adding required fields to the target type will surface this immediately as an error at the
call site, which is a good forcing function).

### Full page component (lines 1–56)

```
1	import { redirect } from "next/navigation";
2	import { createSupabaseServerClient } from "@/lib/supabase/server";
3	import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
4	import { AdminAccessDenied, AdminPageHeader } from "../components/admin-ui";
5	import { SettingsForm } from "./SettingsForm";
6	import { getSettingsPageData } from "./settings-data";
7	
8	export const metadata = {
9	  title: "Settings - Rahma Therapy Admin",
10	};
11	
12	const fallbackSettings = {
13	  company_name: "Rahma Therapy",
14	  contact_email: null,
15	  contact_phone: null,
16	  booking_window_days: 30,
17	  buffer_time_mins: 30,
18	  minimum_notice_hours: 24,
19	  allowed_cities: ["Luton", "Dunstable", "Houghton Regis"],
20	  booking_status_enabled: true,
21	  customer_cancellation_cutoff_hours: 24,
22	};
23	
24	export default async function SettingsPage() {
25	  const supabase = await createSupabaseServerClient();
26	  const profile = await getStaffProfile(supabase);
27	
28	  if (!profile || !profile.active) {
29	    redirect("/admin/login");
30	  }
31	
32	  if (!profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)) {
33	    return (
34	      <AdminAccessDenied
35	        title="Settings access limited"
36	        message="Settings are restricted to the practice owner. Ask the owner if you need a policy changed."
37	      />
38	    );
39	  }
40	
41	  const { settings, lastChange } = await getSettingsPageData();
42	
43	  return (
44	    <div>
45	      <AdminPageHeader
46	        title="Settings"
47	        description="Booking window, service areas, buffers, and the intake switch the customer-facing form reads."
48	      />
49	
50	      <SettingsForm
51	        settings={settings ?? fallbackSettings}
52	        lastChange={lastChange}
53	      />
54	    </div>
55	  );
56	}
```

`settings` (or the fallback) is passed to `SettingsForm` via exactly two props: `settings` and
`lastChange` (lines 50–53). No third prop carries permissions or profile data today.

### Are the actor's permissions already fetched here? YES — but only checked for one permission.
`profile` is fetched at line 26 (`getStaffProfile(supabase)`), and `profile.permissions` is a
`Set<string>` (confirmed in `src/lib/auth/rbac.ts:289`, `permissions: Set<string>;`). It is
checked once, at line 32:

```
32	  if (!profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)) {
```

**Gap found:** `PERMISSIONS` (from `src/lib/auth/rbac.ts:6-50`) has no `MANAGE_TRAVEL_ORIGIN`
(or similarly named) key — only `MANAGE_SETTINGS: "manage_settings"` exists among
settings-related permissions. The task context states the DB permission
`manage_travel_origin` (category=settings, scope=operational, risk_level=high, is_system=true)
already exists and is granted to Owner only. **The app-side `PERMISSIONS` constant has not
caught up to it.** Before the mileage-origin field can be gated Owner-only in the UI, Phase 1 (or
whichever phase owns this) needs to add e.g. `MANAGE_TRAVEL_ORIGIN: "manage_travel_origin"` to
the `PERMISSIONS` object in `src/lib/auth/rbac.ts` (not one of this task's four target files —
flagging as a dependency, not fixing it here).

Also note: even once that constant exists, `profile`/its permissions are never passed down to
`SettingsForm` (only `settings` and `lastChange` are, per the JSX above). If the Owner-only gate
needs to happen client-side inside `SettingsForm` (as opposed to page-level), `page.tsx` will
need a new prop, e.g. `canManageTravelOrigin={profile.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)}`,
added to the `<SettingsForm ... />` call.

### Decision 9 implications
This file is read-only display wiring; no dual-write concern here. The concern for Phase 1 is
purely: (a) fallback object needs new keys if the settings type gains required fields, (b) the
Owner-only permission constant doesn't exist yet in `rbac.ts`, (c) no plumbing currently exists
to pass permission state to `SettingsForm` for a UI-level hide of the origin field.

---

## 3. `src/app/admin/bookings/new/page.tsx`

### Claimed anchors: `.select("allowed_cities")` at :75, read at :84
**Actual: line 75 (select) and line 84 (read). Drift: NONE for both.**

```
75	        .select("allowed_cities")
```

```
84	  const allowedCities = (settingsResult.data?.allowed_cities ?? []) as string[];
```

### THE SELECT STRING — full query block (lines 71–78, the 5th element of the `Promise.all` array)

```
71	      // C-07 Step 5 (W02-E-1) — the whitelist create_booking_request checks
72	      // server-side; fetched here so the form can warn inline before submit.
73	      adminClient
74	        .from("business_settings")
75	        .select("allowed_cities")
76	        .eq("id", 1)
77	        .single(),
78	    ]);
```

**This is an explicit single-column select — `select("allowed_cities")`, NOT `select("*")`.**
Consequence (this is the important one): unlike `settings-data.ts`, `free_travel_cities` will
**NOT** arrive for free here. Per Decision 9, this app code must READ `free_travel_cities` (the
new column is the one the UI should reflect going forward), while the live
`create_booking_request` SQL function still gates bookings on `allowed_cities` server-side (per
the comment at lines 71-72, confirmed still true by the task context). So this select string
needs to become something like `.select("free_travel_cities")` (if only the new column is
needed for the inline client-side warning) — it does **not** need `allowed_cities` added back
here, because this file only reads for a non-blocking UI hint; it doesn't write, so Decision 9's
dual-write requirement does not apply to this file. The actual booking-gate enforcement stays in
the DB function reading `allowed_cities`, untouched by this file.

### Full destructuring / consumption
```
80	  const services = servicesResult.data ?? [];
81	  const prefillClient = prefillClientResult.data ?? null;
82	  const enquiry = enquiryResult.data ?? null;
83	  const assignableStaff = assignableStaffResult.data ?? [];
84	  const allowedCities = (settingsResult.data?.allowed_cities ?? []) as string[];
```

`allowedCities` then flows to `<ManualBookingForm ... allowedCities={allowedCities} />` at line
128 of this file:

```
115	      <ManualBookingForm
116	        services={services}
117	        prefillClient={prefillClient}
118	        enquiry={enquiry}
119	        matchedServiceSlug={matchedServiceSlug}
120	        prefillFailed={prefillFailed}
121	        canAssign={canAssign}
122	        assignableStaff={assignableStaff as Array<{ id: string; name: string; gender: string; can_take_bookings: boolean }>}
123	        currentUserId={profile.id}
124	        currentUserGender={profile.gender ?? ""}
125	        currentUserName={profile.name ?? ""}
126	        currentUserIsBookable={currentUserIsBookable}
127	        allowRecurrenceMap={allowRecurrenceMap}
128	        allowedCities={allowedCities}
129	      />
```

The prop is still named `allowedCities` (camelCase, JS-side identifier) even though it should
source from `free_travel_cities` post-change — the prop name itself doesn't need to change for
Phase 1 (that's a naming/copy concern deferred to Phase 2 per the task's scope note on
`ManualBookingForm.tsx`), only the column it's read from does.

### Decision 9 implications
Read-only query, no write path in this file. Only the `.select()` argument needs to change from
`"allowed_cities"` to `"free_travel_cities"` and the field access on line 84 from
`settingsResult.data?.allowed_cities` to `settingsResult.data?.free_travel_cities`.

---

## 4. `src/app/admin/bookings/new/ManualBookingForm.tsx`

### Claimed anchors: doc comment :547-549, prop default :529, typed :550
**Actual: doc comment 547-549, prop default 529, type 550. Drift: NONE for all three.**

### Prop declarations block (lines 517–551) — byte-exact

```
517	export function ManualBookingForm({
518	  prefillClient,
519	  enquiry,
520	  matchedServiceSlug = null,
521	  prefillFailed = false,
522	  canAssign = false,
523	  assignableStaff = [],
524	  currentUserId = "",
525	  currentUserGender = "",
526	  currentUserName = "",
527	  currentUserIsBookable = false,
528	  allowRecurrenceMap = {},
529	  allowedCities = [],
530	}: {
531	  services: ServiceOption[];
532	  prefillClient: PrefillClient | null;
533	  enquiry: EnquiryPrefill | null;
534	  /** C-03 Phase B/C — fuzzy-matched service slug from the enquiry's
535	   * service_interest text. Seeds the first participant's service selection
536	   * and drives the hint/success banner in step 2 (Phase C Step 9). */
537	  matchedServiceSlug?: string | null;
538	  prefillFailed?: boolean;
539	  canAssign?: boolean;
540	  assignableStaff?: AssignableStaffMember[];
541	  currentUserId?: string;
542	  currentUserGender?: string;
543	  currentUserName?: string;
544	  currentUserIsBookable?: boolean;
545	  /** C-02 Phase E — service slug → services.allow_recurrence. */
546	  allowRecurrenceMap?: Record<string, boolean>;
547	  /** C-07 Step 5 (W02-E-1) — business_settings.allowed_cities, for the
548	   * inline (non-blocking) city warning below; create_booking_request still
549	   * enforces this server-side. */
550	  allowedCities?: string[];
551	}) {
```

The doc comment at 547-549 is the **only** thing Phase 1 should touch in this file per the
task's explicit scope note — it names `business_settings.allowed_cities` as the source column,
which becomes stale once the read path (in `bookings/new/page.tsx`) switches to
`free_travel_cities`. The prop name `allowedCities` (529, 550) and everything else — variable
names, JSX copy — is explicitly Phase 2 (user-facing copy rewrite), not touched here.

### JSX consumer block (lines 1680–1730) — byte-exact

```
1680	  // C-07 Step 5 (W02-E-1) — mirrors create_booking_request's own check
1681	  // (`lower(v_clean_city) like '%' || lower(trim(allowed.city)) || '%'`):
1682	  // the entered city must equal or contain an allowed city, case-insensitive.
1683	  // Kept permissive to match the server exactly — a stricter client check
1684	  // would warn on cities the server actually accepts.
1685	  const cityTrimmed = city.trim();
1686	  const cityNormalised = cityTrimmed.toLowerCase();
1687	  const isCityKnown =
1688	    cityTrimmed.length === 0 ||
1689	    allowedCities.length === 0 ||
1690	    allowedCities.some((allowed) => {
1691	      const allowedNormalised = allowed.trim().toLowerCase();
1692	      return allowedNormalised === cityNormalised || cityNormalised.includes(allowedNormalised);
1693	    });
1694	
1695	  const step3 = (
1696	    <div className={step === 3 ? "grid gap-4" : "hidden"} aria-hidden={step !== 3}>
1697	      {step === 3 && multiErrorBanner}
1698	      <AdminPanel title="Location">
1699	        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
1700	          {/* Postcode first — auto-fills city + area */}
1701	          <AdminInput
1702	            id="postcode"
1703	            label="Postcode"
1704	            required
1705	            placeholder="LU1 1AA"
1706	            maxLength={10}
1707	            value={postcode}
1708	            error={stepErrors.postcode || postcodeLookupError || undefined}
1709	            className={cn("sm:col-span-1", isPrefilled("postcode") ? "[&_input]:bg-[var(--admin-selected-sky)]" : "")}
1710	            onChange={(e) => { setPostcode(e.target.value); markEdited("postcode"); setPostcodeLookupError(""); }}
1711	            onBlur={handlePostcodeBlur}
1712	          />
1713	          <div className="grid gap-1.5">
1714	            <AdminInput
1715	              id="city"
1716	              label="City"
1717	              required
1718	              placeholder="Luton"
1719	              maxLength={60}
1720	              value={city}
1721	              error={stepErrors.city}
1722	              className={isPrefilled("city") ? "[&_input]:bg-[var(--admin-selected-sky)]" : ""}
1723	              onChange={(e) => { setCity(e.target.value); markEdited("city"); setBookingDate(""); setStartTime(""); setAvailChecked(false); setAvailSlots([]); setFemaleAvailChecked(false); setMaleAvailChecked(false); }}
1724	            />
1725	            {!isCityKnown ? (
1726	              <p className="text-xs text-[oklch(26%_0.14_25)]" role="alert">
1727	                &ldquo;{cityTrimmed}&rdquo; is outside our current service area. We deliver to: {allowedCities.join(", ")}.
1728	              </p>
1729	            ) : null}
1730	          </div>
```

Per the task's explicit instruction, no copy changes are proposed here — this is reported as-is.
Note only: this JSX reads `allowedCities` (the prop, camelCase) not the DB column directly, so it
requires no change itself; whatever `bookings/new/page.tsx` passes in as `allowedCities` is what
renders. Once that page's select switches to `free_travel_cities`, this JSX's behavior changes
automatically with no edit needed here — only the doc comment at 547-549 needs the column name
correction.

### Other `allowed_cities` references in this file
None. `grep -n "allowed_cities"` against this file returns exactly one hit: line 547 (the doc
comment, quoted above). All other occurrences in this file are the camelCase prop/variable
`allowedCities` (lines 529, 550, 1689, 1690, 1727), which is a JS identifier, not the DB column
name, and is unaffected by the column rename/dual-write.

### Decision 9 implications
This file has no query and no write path — it's presentation-only. Nothing here dual-writes.
The only Phase-1-scoped change is the doc-comment column name (547-549); everything else is
correctly deferred to Phase 2 per the task's own instruction.

---

## Summary table

| File | Claimed anchor | Actual line | Drift |
|---|---|---|---|
| settings-data.ts | `BusinessSettingsRow.allowed_cities` :47 | 47 | NONE |
| settings/page.tsx | `fallbackSettings.allowed_cities` :19 | 19 | NONE |
| bookings/new/page.tsx | `.select("allowed_cities")` :75 | 75 | NONE |
| bookings/new/page.tsx | read `.allowed_cities` :84 | 84 | NONE |
| ManualBookingForm.tsx | doc comment :547-549 | 547-549 | NONE |
| ManualBookingForm.tsx | prop default :529 | 529 | NONE |
| ManualBookingForm.tsx | typed :550 | 550 | NONE |

**All 7 claimed anchors across the 4 target files verified accurate — zero drift in this batch.**

## Select-string verdict (the critical finding)

| File | Select string | Explicit or `*` | Needs `free_travel_cities` added? |
|---|---|---|---|
| settings-data.ts:101 | `.select("*")` | `*` (wildcard) | No — arrives for free at runtime. Only the TS interface (`BusinessSettingsRow`, lines 39-49) needs `free_travel_cities` and `mileage_origin` added so the typed access works. |
| bookings/new/page.tsx:75 | `.select("allowed_cities")` | Explicit, single column | **Yes** — must change to `.select("free_travel_cities")` (or add it) or the new column will be `undefined` when read at line 84. |

## Gaps found beyond the four files (flagged, not fixed — out of this task's write scope)

1. `src/lib/auth/rbac.ts` `PERMISSIONS` object (lines 6-50) has no `MANAGE_TRAVEL_ORIGIN` /
   `manage_travel_origin` entry, even though the DB permission of that name already exists
   (per task context) and is granted Owner-only. This constant must be added before any
   Owner-only UI gate for the mileage-origin field can be written.
2. `src/app/admin/settings/page.tsx` fetches `profile` and checks
   `profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)` (line 32) but never passes
   `profile`/permissions down to `<SettingsForm>` (only `settings` and `lastChange` are passed,
   lines 50-53). A new prop will be needed if the Owner-only gate for the origin field is meant
   to happen inside `SettingsForm` rather than by hiding the whole page.
3. `src/app/admin/settings/SettingsForm.tsx` (not a target file) independently references
   `allowed_cities` in 5 places and, per `settings-data.ts`'s own doc comment, keeps a
   "structurally identical" module-private copy of the settings-row shape. Extending
   `BusinessSettingsRow` in `settings-data.ts` without a matching update there will silently
   leave the new fields invisible to the form (TS won't error, since the mismatch is a subset
   relationship, not a conflict).
