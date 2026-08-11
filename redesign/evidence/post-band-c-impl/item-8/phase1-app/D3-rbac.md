# D3 — `src/lib/auth/rbac.ts` and permission plumbing

Target file: `src/lib/auth/rbac.ts` (434 lines total, verified by direct read on 2026-08-11).
Read-only derivation. No files under `src/`, `scripts/`, `e2e/`, `supabase/`, or repo root were
touched. One read-only test run was executed (`npx vitest run src/lib/auth/admin-access.test.ts`)
to pin down the exact current baseline precisely, per the task's "be precise" instruction.

---

## 1. The `PERMISSIONS` object — byte-exact, in full

```ts
6	export const PERMISSIONS = {
7	  VIEW_DASHBOARD: "view_dashboard",
8	  VIEW_BOOKINGS_ALL: "view_bookings_all",
9	  VIEW_BOOKINGS_ASSIGNED: "view_bookings_assigned",
10	  MANAGE_BOOKINGS_ALL: "manage_bookings_all",
11	  MANAGE_BOOKINGS_ASSIGNED: "manage_bookings_assigned",
12	  ASSIGN_BOOKINGS: "assign_bookings",
13	  CLAIM_ASSIGNMENTS: "claim_assignments",
14	  VIEW_REPORTS_OWN: "view_reports_own",
15	  EXPORT_REPORTS_OWN: "export_reports_own",
16	  VIEW_REPORTS_OPERATIONAL: "view_reports_operational",
17	  VIEW_REPORTS_REVENUE: "view_reports_revenue",
18	  EXPORT_REPORTS_REVENUE: "export_reports_revenue",
19	  VIEW_REPORTS_BUSINESS: "view_reports_business",
20	  VIEW_CLIENTS_ASSIGNED: "view_clients_assigned",
21	  VIEW_CLIENTS_ALL: "view_clients_all",
22	  VIEW_CLIENT_CONTACT_DETAILS: "view_client_contact_details",
23	  VIEW_CLIENT_HEALTH_NOTES_ASSIGNED: "view_client_health_notes_assigned",
24	  CREATE_CLIENT_SESSION_NOTES: "create_client_session_notes",
25	  MANAGE_CLIENTS_ALL: "manage_clients_all",
26	  MANAGE_SENSITIVE_CLIENT_NOTES: "manage_sensitive_client_notes",
27	  MANAGE_CLIENT_IDENTITY_FIELDS: "manage_client_identity_fields",
28	  MANAGE_CLIENT_DESTRUCTIVE_OPS: "manage_client_destructive_ops",
29	  VIEW_STAFF: "view_staff",
30	  MANAGE_STAFF_PROFILES: "manage_staff_profiles",
31	  ASSIGN_STAFF_ROLES: "assign_staff_roles",
32	  MANAGE_PERMISSION_OVERRIDES: "manage_permission_overrides",
33	  MANAGE_ROLE_TEMPLATES: "manage_role_templates",
34	  VIEW_EMAIL_LOGS: "view_email_logs",
35	  RESEND_BOOKING_EMAILS: "resend_booking_emails",
36	  MANAGE_EMAIL_SETTINGS: "manage_email_settings",
37	  MANAGE_EMAIL_TEMPLATES: "manage_email_templates",
38	  MANAGE_ENQUIRIES: "manage_enquiries",
39	  MANAGE_SERVICES: "manage_services",
40	  MANAGE_SETTINGS: "manage_settings",
41	  MANAGE_AVAILABILITY_GLOBAL: "manage_availability_global",
42	  MANAGE_AVAILABILITY_OWN: "manage_availability_own",
43	  MANAGE_AUDIT_LOGS: "manage_audit_logs",
44	  MANAGE_PRIVACY_OPERATIONS: "manage_privacy_operations",
45	  // Constant kept as MANAGE_ACCOUNT_PASSWORD_REQUESTS for legibility; the
46	  // value maps to the DB-seeded `manage_account_requests` system permission
47	  // (assigned to Owner + Admin via migration 20260521090000). Renaming the
48	  // value rather than the DB row preserves the audit/seed history.
49	  MANAGE_ACCOUNT_PASSWORD_REQUESTS: "manage_account_requests",
50	} as const;
```

(Line numbers shown are the file's actual line numbers, not a re-count — confirmed by direct
`Read` of the file, not by grep/heuristic.)

### Where `MANAGE_ROLE_TEMPLATES` sits

`MANAGE_ROLE_TEMPLATES: "manage_role_templates",` is at **line 33**, inside the staff/roles group
(`VIEW_STAFF` line 29 → `MANAGE_STAFF_PROFILES` 30 → `ASSIGN_STAFF_ROLES` 31 →
`MANAGE_PERMISSION_OVERRIDES` 32 → `MANAGE_ROLE_TEMPLATES` 33), immediately before the email group
starts at line 34.

### Formatting / ordering convention

- **Not alphabetical.** E.g. `VIEW_DASHBOARD` (7) precedes `VIEW_BOOKINGS_ALL` (8); within the
  bookings group the order is view-all, view-assigned, manage-all, manage-assigned, assign, claim —
  a deliberate read→write→delegate progression, not alpha sort.
- **Grouped by feature/domain**, in the same order the admin nav/pages are organised: dashboard →
  bookings → reports → clients → staff/roles → email → enquiries/services/settings → availability →
  audit/privacy → account requests.
- **Two-space indent**, one entry per line, `KEY: "value",` — every entry, including the last
  substantive one before `MANAGE_ACCOUNT_PASSWORD_REQUESTS`, carries a **trailing comma**. The
  object literal itself has no trailing comma after the closing `}` (it's followed by `as const;`).
- Key name is `SCREAMING_SNAKE_CASE` derived directly from the string value's `snake_case` (mostly
  1:1 uppercase-and-underscore mapping). The one documented exception is
  `MANAGE_ACCOUNT_PASSWORD_REQUESTS` → `"manage_account_requests"`, explained by the inline comment
  at lines 45–48 (constant name kept human-legible; DB value is what migration
  `20260521090000` actually seeded).
- No blank lines separate the groups — the grouping is conveyed by ordering and naming only, not by
  whitespace or per-group comments (contrast with the file's one substantive exception, the
  MANAGE_ACCOUNT_PASSWORD_REQUESTS comment block, which is documenting a name/value mismatch, not a
  group boundary).

### Exact insertion point for `MANAGE_TRAVEL_ORIGIN`

The new DB permission (`manage_travel_origin`, category=`settings`, scope=`operational`,
risk_level=`high` — confirmed verbatim in migration
`supabase/migrations/20260811200100_item8_phase1b_manage_travel_origin_permission.sql`, whose own
comment states the category/scope/risk_level "values below are a verbatim match to the live
`manage_settings` row"). Given the file's domain-grouping convention, and that `manage_settings` is
the permission it's most conceptually adjacent to (and DB-verbatim-matched against), the correct
slot is **immediately after line 40 (`MANAGE_SETTINGS`), before line 41
(`MANAGE_AVAILABILITY_GLOBAL`)** — i.e. inserted as the new line 41, pushing everything from the old
line 41 down by one.

Exact text to insert (2-space indent, trailing comma, matching every other entry):

```
  MANAGE_TRAVEL_ORIGIN: "manage_travel_origin",
```

Resulting lines 39–43 after insertion would read:

```
  MANAGE_SERVICES: "manage_services",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_TRAVEL_ORIGIN: "manage_travel_origin",
  MANAGE_AVAILABILITY_GLOBAL: "manage_availability_global",
  MANAGE_AVAILABILITY_OWN: "manage_availability_own",
```

No other file needs to change for the constant itself to exist and be usable — see §4 and §6 below
for why nothing derived breaks.

---

## 2. `requirePermission` and `hasPermission` — byte-exact, actual line numbers

**Plan claim:** `requirePermission` at :401–423, `hasPermission` at :428–433.
**Verification: both claims are CORRECT**, confirmed by direct file read (not grep-inferred).

```ts
401	export async function requirePermission(
402	  permission: Permission,
403	  supabase: SupabaseClient
404	): Promise<StaffProfile> {
405	  const profile = await getStaffProfile(supabase);
406	
407	  if (!profile) {
408	    throw new PermissionError("UNAUTHENTICATED", "No authenticated staff session.");
409	  }
410	
411	  if (!profile.active) {
412	    throw new PermissionError("INACTIVE", "This account is inactive.");
413	  }
414	
415	  if (!profile.permissions.has(permission)) {
416	    throw new PermissionError(
417	      "FORBIDDEN",
418	      `Permission "${permission}" is required for this action.`
419	    );
420	  }
421	
422	  return profile;
423	}
```

```ts
428	export function hasPermission(
429	  profile: StaffProfile | null,
430	  permission: Permission
431	): boolean {
432	  return profile?.permissions.has(permission) ?? false;
433	}
```

Both take a `Permission`-typed parameter (the union derived from `PERMISSIONS`, see §4) — a raw
string cannot be passed without a TS error, so any new permission check must go through
`PERMISSIONS.MANAGE_TRAVEL_ORIGIN` once added; there is no way to bypass the constant.

---

## 3. The `StaffProfile` type — byte-exact

```ts
254	export interface StaffProfile {
255	  id: string;
256	  auth_user_id: string;
257	  name: string;
258	  email: string;
259	  role_id: string;
260	  role_name: string;
261	  gender: string;
262	  active: boolean;
263	  can_take_bookings: boolean;
264	  availability_mode: string;
265	  profile_photo_path?: string | null;
266	  phone?: string | null;
267	  show_phone_on_profile?: boolean;
268	  short_bio?: string | null;
269	  specialties?: string[];
270	  languages?: string[];
271	  service_areas?: string[];
272	  profile_completed_at?: string | null;
273	  /** Admin dark-mode choice — 'dark' | 'light' | 'system'. NULL means the user
274	   *  never chose, which the admin layout resolves to the dark default. */
275	  theme_preference?: string | null;
276	  /** C-08 Phase D — personal address for business alerts. NULL/empty falls
277	   *  back to the login email at send time. Owner/Admin only, self-set via
278	   *  /admin/me. */
279	  notification_email?: string | null;
280	  /** C-08 Phase D — opt-in + per-type alert preferences, consumed by
281	   *  `resolveBusinessNotificationRecipients` (lib/email/notifications.ts).
282	   *  NULL means never opted in. A `types` key absent for a given alert type
283	   *  defaults that type ON — the resolver's rule, reproduced wherever this
284	   *  field is read. */
285	  business_notification_prefs?: {
286	    enabled?: boolean;
287	    types?: Record<string, boolean>;
288	  } | null;
289	  permissions: Set<string>;
290	}
```

**`.permissions` is `Set<string>` (line 289)** — a `Set`, not an array, and typed as `Set<string>`
(not `Set<Permission>`). This is load-bearing in two ways relevant to item 8:

1. Every lookup in the file uses `.has(...)`, e.g. `hasPermission` (line 432:
   `profile?.permissions.has(permission) ?? false`) and `hasAnyPermission` (line 62:
   `permissions.some((permission) => profile?.permissions.has(permission))`). Membership
   checks are O(1), and because it's typed `Set<string>` (not `Set<Permission>`), the *checking*
   side is permission-name-agnostic — adding `MANAGE_TRAVEL_ORIGIN` needs no change to the `Set`
   type itself.
2. The set is populated purely from DB data (`resolvePermissions`, lines 298–334, reading
   `role_permissions` then applying `staff_permission_overrides`) — it is never constructed from
   the `PERMISSIONS` constant. So a staff member's live `.permissions` Set will contain
   `"manage_travel_origin"` automatically once the DB migration (already applied, per the task's
   given context) grants it to their role — no application code change is needed for the *data* to
   flow through; only for something to *check* it.

---

## 4. Does adding a `PERMISSIONS` key change any derived type, and would it break an exhaustive switch/lookup?

**Yes, one derived type changes; no, nothing breaks.**

Line 52:
```ts
52	export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
```
`Permission` is a string-literal union of every value in `PERMISSIONS` (currently 39 members:
`"view_dashboard" | "view_bookings_all" | ... | "manage_account_requests"`). Adding
`MANAGE_TRAVEL_ORIGIN: "manage_travel_origin"` mechanically adds `"manage_travel_origin"` to that
union — this is `keyof typeof` derivation, so it happens automatically, no other line needs editing
for the type to widen.

Searched the whole `src/` tree for anything that could break from a wider `Permission` union:

- **`Record<Permission, ...>`** — no matches anywhere in `src/`.
- **`switch (permission)` / `switch(permission)`** — no matches anywhere in `src/`.
- **`Object.values(PERMISSIONS)` / `Object.keys(PERMISSIONS)` / `Object.entries(PERMISSIONS)`** — no
  matches anywhere in `src/`.
- The only other place a local type named `Permission` exists is
  `src/app/admin/staff/[staffId]/StaffPermissionOverridesForm.tsx:14`, but that's an **unrelated,
  locally-scoped `interface Permission { id; name; description; category; scope; risk_level }`**
  describing a DB row shape for the override-editor UI — a naming coincidence, not the same type,
  and not imported from `rbac.ts`. It is driven by whatever rows the `permissions` table query
  returns (see §6), not by the `PERMISSIONS` const, so it needs no change either.
- The one place that *is* keyed by a closed set derived from a `typeof X` array is
  `src/lib/auth/admin-access.ts:238` (`ADMIN_PAGE_RULES … satisfies Record<AdminPageKey,
  AdminPageRule>`), but `AdminPageKey` is derived from `ADMIN_PAGE_KEYS` (a fixed list of admin page
  names: `"dashboard" | "bookings" | ...`), **not** from `Permission`. Unaffected.

**Conclusion:** adding the key is a pure, additive widening of the `Permission` union. Nothing in
`src/` exhaustively switches or indexes on that union, so nothing breaks at compile time or runtime
from the constant addition alone.

---

## 5. Tests asserting on `PERMISSIONS` shape/size or a role's full permission set

Searched every `*.test.ts` file referencing `PERMISSIONS.` (34 files) for shape/size assertions
(`Object.keys/values/entries(PERMISSIONS)`, `.length`/`.size` checks tied to a permission list).
**None exist.** Every test file that builds a role's permission set does so via a hand-curated array
of explicit `PERMISSIONS.XXX` references — never derived from the full `PERMISSIONS` object, and
never asserted against its size. Confirmed by reading each candidate file in full:

- `src/lib/auth/rbac.test.ts` — per-scenario 1–3 item arrays (e.g. `profile([PERMISSIONS
  .MANAGE_ROLE_TEMPLATES, PERMISSIONS.MANAGE_PERMISSION_OVERRIDES])`). No full-set assertion.
- `src/lib/auth/rbac-client-permissions.test.ts` — same pattern, plus one literal-value pin
  (`expect(PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS).toBe("manage_client_identity_fields")`) —
  unaffected by an unrelated new key.
- `src/app/admin/staff/team-access.test.ts`, `profile-access.test.ts`,
  `src/app/admin/shell-variant.test.ts`, `src/app/admin/clients/access.test.ts`,
  `src/app/admin/bookings/assignment-eligibility.test.ts` — all use small explicit arrays of
  `PERMISSIONS.XXX`, none exhaustive.
- **`src/lib/auth/admin-access.test.ts`** (read in full, 307 lines) — this is the file most likely
  to look "exhaustive" because it builds `OWNER_PERMISSIONS` (34 entries, lines 35–71) and
  `ADMIN_PERMISSIONS` (28 entries, lines 73–102) as flat arrays of `PERMISSIONS.XXX` references. But
  these are **hand-typed literal arrays**, not `Object.values(PERMISSIONS)` — adding a new key to
  the `PERMISSIONS` const does not add it to `OWNER_PERMISSIONS`/`ADMIN_PERMISSIONS`; that only
  happens if a human edits those arrays. `admin-access.ts`'s `ADMIN_PAGE_RULES` (the logic under
  test) also never references `PERMISSIONS.MANAGE_TRAVEL_ORIGIN` — it isn't wired to any admin page
  rule yet.

### The two known pre-existing failures — re-verified live

Ran (read-only): `npx vitest run src/lib/auth/admin-access.test.ts` → **6 tests, 2 failed, 4
passed**, matching the task's stated baseline exactly. Actual failure detail (not previously
documented in the task prompt, captured here for precision):

1. **"gives Owner broad access while keeping owner-only role actions permission-gated"** fails at
   `admin-access.test.ts:191` (`expect(getVisibleAdminPages(owner)).toEqual(EXPECTED_PAGE_KEYS)`) —
   `getVisibleAdminPages(owner)` is missing `"accountRequests"` from its result. Root cause: the
   `OWNER_PERMISSIONS` test fixture array (lines 35–71) does **not** include
   `PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS`, so `getAdminPageAccess(owner, "accountRequests")`
   evaluates to denied.
2. **"gives Admin broad operational access without role template management"** fails at
   `admin-access.test.ts:222` on the same `accountRequests` page — `access: false` /
   `dataScope: "none"` received vs. `access: true` / `dataScope: "all"` expected. Same root cause:
   `ADMIN_PERMISSIONS` (lines 73–102) also omits `PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS`.

**Both failures are entirely about `MANAGE_ACCOUNT_PASSWORD_REQUESTS` / the `accountRequests` page —
zero relationship to `MANAGE_TRAVEL_ORIGIN` or `manage_settings`.** Adding
`MANAGE_TRAVEL_ORIGIN: "manage_travel_origin"` to the `PERMISSIONS` const:

- **Does not change either failure** — neither fixture array gains the new key automatically (they
  are literal, not derived), and `admin-access.ts` has no rule referencing the new permission.
- **Does not add a third failure** — no existing assertion in this file depends on the size or
  full contents of `PERMISSIONS`, and `getVisibleAdminPages`/`getAdminPageAccess` are keyed on
  `AdminPageKey` (a fixed 20-entry page list, `ADMIN_PAGE_KEYS`), not on `Permission`.
- If a later part of item 8 also wires `MANAGE_TRAVEL_ORIGIN` into `admin-access.ts`'s `settings`
  rule (e.g. a new `AdminActionFlags` sub-flag gating the mileage-origin field specifically), *that*
  change — not the constant addition — is what could require updating this test file. That is out
  of scope for D3 (rbac.ts plumbing only) and is flagged here as a risk for whoever implements the
  settings-page gating, not something this report should fix.

---

## 6. Hardcoded permission-name lists elsewhere in `src/` that would need `MANAGE_TRAVEL_ORIGIN` added for consistency

Searched for seeds, UI pickers, and role-template editors that enumerate permission names outside
`rbac.ts`.

- **`src/app/admin/roles/[roleId]/page.tsx`** (role-template editor UI, read in full) — the
  permission list rendered here (lines 91–98) is a live DB query:
  `supabase.from("permissions").select("id, name, description, category, scope, risk_level, active")
  .eq("active", true)...` — **not** sourced from the `PERMISSIONS` TS const. Since the DB row for
  `manage_travel_origin` already exists (per the task's given context — migration
  `20260811200100_item8_phase1b_manage_travel_origin_permission.sql`, applied), this page will
  already display and allow toggling `manage_travel_origin` on any role **without any code change**.
  Nothing to add here for consistency.
- **`src/app/admin/staff/[staffId]/StaffPermissionOverridesForm.tsx`** (per-staff override editor) —
  same story: its `permissions: Permission[]` prop (local `Permission` interface, §4) is populated
  by whatever the parent server component queries from the `permissions` table — DB-driven, not
  const-driven. No hardcoded list to update.
- **`src/app/admin/roles/actions.ts`** — the only hardcoded permission-name collection outside
  `rbac.ts` is `CRITICAL_ROLE_PERMISSIONS` (lines 9–12):
  ```ts
  const CRITICAL_ROLE_PERMISSIONS = new Set<string>([
    PERMISSIONS.MANAGE_STAFF_PROFILES,
    PERMISSIONS.ASSIGN_STAFF_ROLES,
  ]);
  ```
  This gates "you can't revoke this from Owner / from your own role" (lockout prevention) — it is
  intentionally a short, curated list of *lockout-risk* permissions, not an exhaustive permission
  registry. `manage_travel_origin` is a single narrow settings field, not a staff/role-assignment
  permission, so it does **not** belong in this set for consistency; no change needed.
- No other seed script, constants file, or UI picker under `src/` was found enumerating permission
  names. (Search covered `Object.values/keys/entries(PERMISSIONS)`, `Record<Permission`, and a
  file-name/content sweep for "permission" across `src/`; the DB-driven pages above were the only
  UI surfaces rendering a permission list.)

---

## Summary for the implementer

1. Insert `  MANAGE_TRAVEL_ORIGIN: "manage_travel_origin",` as the new line 41 (immediately after
   `MANAGE_SETTINGS` on line 40), in `src/lib/auth/rbac.ts`.
2. `requirePermission` (401–423) and `hasPermission` (428–433) need no changes — both already accept
   any `Permission`, and the new value flows through automatically once added to `PERMISSIONS`.
3. `StaffProfile.permissions` is `Set<string>` (line 289), populated from the DB — no change needed
   for a staff member's Owner-role grant of `manage_travel_origin` to appear there.
4. The `Permission` union (line 52) widens automatically; nothing in `src/` exhaustively switches or
   indexes on it, so this is safe.
5. No test in the repo asserts on the full shape/size of `PERMISSIONS` or of a role's full
   permission set in a way this addition would perturb. The two pre-existing `admin-access.test.ts`
   failures are about `MANAGE_ACCOUNT_PASSWORD_REQUESTS`/`accountRequests`, unrelated to
   `MANAGE_TRAVEL_ORIGIN`, and remain exactly as-is (still 2 failed / 4 passed) after this addition.
6. No hardcoded permission-name list elsewhere in `src/` needs updating — the role-template editor
   and staff-override editor are both DB-driven and will pick up `manage_travel_origin`
   automatically since its DB row already exists.
7. Out of scope for this report but worth flagging: the constant alone changes nothing the app
   enforces (per the migration's own header comment) — a caller must still add a
   `hasPermission(profile, PERMISSIONS.MANAGE_TRAVEL_ORIGIN)` check somewhere on the settings write
   path (and, per the DECISION 9 dual-write requirement given in this task's context, keep writing
   both `allowed_cities` and `free_travel_cities` on that same path) for the permission to have any
   effect. That check site is outside `rbac.ts` and was not located as part of this D3 pass.
