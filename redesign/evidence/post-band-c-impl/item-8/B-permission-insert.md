# B — Permission insert verification: `manage_travel_origin`

Project: `twzutkfgqclqurvkmvqz` (SELECT-only queries; no writes were made to the DB).
Repo files read: `src/lib/auth/rbac.ts`, `src/lib/auth/admin-access.ts`,
`src/lib/auth/admin-access.test.ts`, `src/lib/auth/rbac.test.ts`,
`src/lib/auth/rbac-client-permissions.test.ts`, `src/app/admin/roles/__tests__/toggleRolePermission.test.ts`.

Proposed SQL under test:
```sql
insert into permissions (name, description, category, scope, risk_level, is_system, active)
values ('manage_travel_origin', 'Edit the mileage-charge origin point on business settings.', 'settings', 'operational', 'high', true, true);
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p where r.name = 'Owner' and p.name = 'manage_travel_origin';
```

## 1. Does `manage_travel_origin` already exist?

```sql
select count(*) as cnt from permissions where name = 'manage_travel_origin';
```
Result: `{"cnt":0}`. Does not exist. First `insert` will not violate `UNIQUE(name)`.

## 2. Distinct existing category / scope / risk_level values (full sets, with counts)

`category` (11 distinct values, 39 rows total):
| category | count |
|---|---|
| clients | 10 |
| bookings | 7 |
| reports | 6 |
| staff | 5 |
| emails | 3 |
| availability | 2 |
| system | 2 |
| audit | 1 |
| privacy | 1 |
| services | 1 |
| **settings** | **1** |

`scope` (3 distinct values):
| scope | count |
|---|---|
| operational | 23 |
| global | 9 |
| scoped | 7 |

`risk_level` (4 distinct values):
| risk_level | count |
|---|---|
| standard | 24 |
| elevated | 8 |
| high | 6 |
| medium | 1 |

Total rows in `permissions`: **39** (confirmed via `select count(*) from permissions`).

**Verdict on the proposed values — all three are real, precedented values, not invented:**
- `category = 'settings'` — matches the one existing row in that category, which is `manage_settings` itself (the exact category precedent, verbatim).
- `scope = 'operational'` — the majority scope (23/39 rows) and matches both `manage_settings` and `manage_role_templates` exactly.
- `risk_level = 'high'` — matches both `manage_settings` and `manage_role_templates` exactly (one of only 6 `high`-risk rows in the table).

No CHECK constraints exist on `permissions` (confirmed below in §4-equivalent check), so an invented value would have inserted silently — but in this case the proposed values are not invented; they mirror the closest precedent exactly.

## 3. Full existing rows for `manage_settings` and `manage_role_templates`

```sql
select * from permissions where name in ('manage_settings','manage_role_templates') order by name;
```
```json
[
  {
    "id": "6a3342fc-b20c-4c62-8acf-4df58081645c",
    "name": "manage_role_templates",
    "description": "Edit default role permission templates.",
    "created_at": "2026-05-09 14:52:31.680912+00",
    "category": "staff",
    "scope": "operational",
    "risk_level": "high",
    "is_system": true,
    "active": true
  },
  {
    "id": "b09a5557-9a4d-495c-af25-9675b290a1ca",
    "name": "manage_settings",
    "description": "Edit global business settings.",
    "created_at": "2026-05-02 05:24:39.365911+00",
    "category": "settings",
    "scope": "operational",
    "risk_level": "high",
    "is_system": true,
    "active": true
  }
]
```

`manage_settings` is the exact precedent for category/scope/risk_level (`settings`/`operational`/`high`) — proposed values match it verbatim.

## 4. `role_permissions` shape, constraints, and duplicate/violation risk

Columns (`information_schema.columns`):
| column | type | nullable | default |
|---|---|---|---|
| role_id | uuid | NO | (none) |
| permission_id | uuid | NO | (none) |

Constraints (`pg_constraint`):
- `role_permissions_pkey` — **PRIMARY KEY (role_id, permission_id)**
- `role_permissions_role_id_fkey` — FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
- `role_permissions_permission_id_fkey` — FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE

Indexes: `role_permissions_pkey` (unique btree on role_id, permission_id) and `role_permissions_permission_id_idx` (non-unique, on permission_id).

Also confirmed on `permissions` itself: only `permissions_name_key` (UNIQUE (name)) and `permissions_pkey` (PRIMARY KEY (id)) — **no CHECK constraints**, consistent with the task's premise.

**Duplicate/violation risk:** none, for a single correct run. `roles.name` and `permissions.name` are both UNIQUE, so `where r.name = 'Owner' and p.name = 'manage_travel_origin'` resolves to exactly one `(role_id, permission_id)` pair — and since `manage_travel_origin` does not exist yet (§1), that `permission_id` cannot already have a `role_permissions` row for Owner. The only way to hit the PK would be re-running the second `insert` after it already succeeded once (ordinary re-run/idempotency hazard, not a design flaw in the SQL as given).

## 5. Roles currently holding `manage_settings` and `manage_role_templates`

```sql
select r.name, r.active from role_permissions rp
join roles r on r.id = rp.role_id
join permissions p on p.id = rp.permission_id
where p.name = 'manage_settings' order by r.name;
```
→ `Admin` (active), `Owner` (active).

```sql
... where p.name = 'manage_role_templates' order by r.name;
```
→ `Owner` (active) only.

All roles in the table for reference: Admin, Booking Coordinator, Inactive, Owner, Therapist (all `active=true`, all `is_system=true`).

So `manage_role_templates` is Owner-exclusive today; the proposed insert (granting `manage_travel_origin` to Owner only) follows that narrower precedent, not the broader `manage_settings` (Owner+Admin) precedent. This is a scope choice for the plan owner to confirm — the SQL as given only grants Owner, not Admin.

## 6. `src/lib/auth/rbac.ts` — PERMISSIONS constant and required TS mirror

`PERMISSIONS` is a `const` object literal (`as const`) mapping SCREAMING_SNAKE_CASE keys to the exact DB `permissions.name` strings; `Permission` is `(typeof PERMISSIONS)[keyof typeof PERMISSIONS]`. Full quote of the two relevant lines (rbac.ts:33, rbac.ts:40):
```ts
MANAGE_ROLE_TEMPLATES: "manage_role_templates",
...
MANAGE_SETTINGS: "manage_settings",
```

**Does adding a DB permission require a matching TS constant?** Not for the string to reach `profile.permissions` — `resolvePermissions()` (rbac.ts:298-334) builds the runtime `Set<string>` purely from `role_permissions` → `permissions.name` joined at query time; it never reads the `PERMISSIONS` constant. So after the two inserts, `manage_travel_origin` would already be present in an Owner's resolved `profile.permissions` Set with zero TS changes.

But it **does** require a matching TS constant (and a call site that uses it) for the app to *act* on it. Every existing permission is enforced by an explicit `hasPermission(profile, PERMISSIONS.X)` / `canX(profile)` check somewhere (e.g. `admin-access.ts` gates the `settings` page on `PERMISSIONS.MANAGE_SETTINGS`). A confirmed grep of `src/` for `manage_travel_origin`, `travel_origin`, `travel-origin`, and `mileage` returns **zero matches** — there is no code anywhere that reads this permission today. Inserting the DB row alone makes it inert: it will sit in `profile.permissions` unused, and nothing in the running app changes behavior because of it.

Exact literal line to add to `PERMISSIONS` (mirroring `MANAGE_ROLE_TEMPLATES`), if/when the app is wired up:
```ts
MANAGE_TRAVEL_ORIGIN: "manage_travel_origin",
```
That alone is still not sufficient — a call site (e.g. gating the mileage-origin field in the business-settings page/action, analogous to how `settings: (profile) => hasPermission(profile, PERMISSIONS.MANAGE_SETTINGS) ? ... : allowed("none")` gates the whole settings page in `admin-access.ts:331-334`) has to be written and does not exist yet.

## 7. Runtime permission loading — no cache, no materialized view

`getStaffProfile()` (rbac.ts:340-384) calls `resolvePermissions()` (rbac.ts:298-334) on every invocation:
```ts
const [rolePermsResult, overridesResult] = await Promise.all([
  supabase.from("role_permissions").select("permissions(name)").eq("role_id", roleId),
  supabase.from("staff_permission_overrides").select("permissions(name), is_granted").eq("staff_id", staffId),
]);
```
This is a fresh Supabase query pair (join) executed each time `getStaffProfile` is called — no `unstable_cache`, no React `cache()` wrapper, no materialized view anywhere in `src/lib/auth/`. `getStaffProfile` is imported and called directly across 79 files (pages, route handlers, server actions) with no shared memoization layer found. Resolution order is role permissions ∪ granted overrides, minus revoked overrides.

**Conclusion:** a newly inserted `role_permissions` row is live on the very next request that resolves that staff member's profile — there is no cache to invalidate and no server restart required.

## 8. Tests that assert on the complete permission set or an exact role list

Searched `src/lib/auth/**` and adjacent RBAC-consuming tests (`admin-access.test.ts`, `rbac.test.ts`, `rbac-client-permissions.test.ts`, `src/app/admin/roles/__tests__/toggleRolePermission.test.ts`) plus a repo-wide grep for `Object.values(PERMISSIONS)`/`Object.keys(PERMISSIONS)`/exact-count assertions on `permissions`/`role_permissions`.

- **`admin-access.test.ts`** defines hand-maintained fixture arrays `OWNER_PERMISSIONS`, `ADMIN_PERMISSIONS`, `BOOKING_COORDINATOR_PERMISSIONS`, `THERAPIST_PERMISSIONS` (lines 35-130) built from `PERMISSIONS.*` constants and used only as **inputs** to construct a `StaffProfile` fixture (`permissions: new Set(permissions)`) — the test never re-derives these lists from the DB or from `Object.values(PERMISSIONS)`, and never asserts "this Set equals the complete set of permissions for role X." It asserts on `getAdminPageAccess`/`getVisibleAdminPages` *outputs* (access booleans, dataScope, action flags) given those fixed inputs. Since neither the DB insert nor (if later added) a new `PERMISSIONS.MANAGE_TRAVEL_ORIGIN` constant would automatically appear in these hand-written arrays, **this file's tests do not break from the SQL insert alone.**
  - Per the repo's recorded baseline (`redesign/evidence/.../reference_repo_gates_and_baselines` memory, HEAD `0863573`), `admin-access.test.ts` already has **2 known-failing tests**: `"gives Owner broad access while keeping owner-only role actions permission-gated"` and `"gives Admin broad operational access without role template management"`. These failures are driven by whatever currently causes `getAdminPageAccess`/`getVisibleAdminPages` output to diverge from the hand-written `OWNER_PERMISSIONS`/`ADMIN_PERMISSIONS` fixtures' expectations — not by the total permission count or any DB state. **The proposed SQL insert (a DB-only change, touching neither `rbac.ts` nor this test file) does not change the failure identity of these two tests** — same two `it()` names, same underlying cause, since the fixture arrays and the code under test are both untouched by the SQL.
  - Caveat: if a *follow-up* step (not in the given SQL) adds `PERMISSIONS.MANAGE_TRAVEL_ORIGIN` to `rbac.ts` **and** also adds it to the `OWNER_PERMISSIONS` fixture array in this test file, that edit itself wouldn't change pass/fail identity either (the fixture is just a bigger input Set) — but if the DB permission were also wired into an `ADMIN_PAGE_RULES` predicate, that could change `getAdminPageAccess` output and would need re-verification against these two already-failing tests.
- **`rbac.test.ts`** has a migration-content test (`"keeps the canonical migration CRUD-ready for roles and permissions"`, lines 92-104) that greps a *specific, historical* migration file (`supabase/migrations/20260509143000_granular_rbac_consolidation.sql`) for fixed column-name strings (`display_label`, `sort_order`, `category`, `scope`, `risk_level`, the temp-table name). It does not reference `manage_travel_origin` or any permission count, and a **new** migration file for this insert would not touch that specific historical file. Unaffected.
- **`rbac-client-permissions.test.ts`** only asserts two specific permission-name string values equal fixed literals (`MANAGE_CLIENT_IDENTITY_FIELDS`, `MANAGE_CLIENT_DESTRUCTIVE_OPS`); unrelated to `manage_travel_origin`. Unaffected.
- **`src/app/admin/roles/__tests__/toggleRolePermission.test.ts`** asserts on mocked-stub call counts (`stub.inserts`/`stub.deletes` `toHaveLength(1)`) for a single toggle action, not on the total permission catalog. Unaffected.
- No file in `src/` was found asserting `Object.values(PERMISSIONS).length`, an exact `permissions` row count, or an exact per-role permission-count equality against DB truth.

**Net for §8:** no test in the repo asserts on the complete permission catalog or does a DB-truth-vs-fixture completeness check. The SQL insert, in isolation, changes nothing in the vitest gate — the 2 known `admin-access.test.ts` failures remain exactly as they are (same names, same cause), and no new failures are introduced.

## Summary

| Check | Result |
|---|---|
| 1. Already exists? | No — 0 rows. Safe against `UNIQUE(name)`. |
| 2. category/scope/risk_level real values? | Yes — all three proposed values (`settings`/`operational`/`high`) match the `manage_settings` row exactly, not invented. |
| 3. Precedent rows | `manage_settings`: settings/operational/high, Owner+Admin. `manage_role_templates`: staff/operational/high, Owner only. |
| 4. `role_permissions` shape | PK(role_id, permission_id), FK→roles/permissions ON DELETE CASCADE. No duplicate/violation risk on a single run. |
| 5. Current holders | `manage_settings` → Admin, Owner. `manage_role_templates` → Owner only. Proposed insert grants Owner only (mirrors the narrower precedent). |
| 6. TS mirror required? | Not for the string to land in `profile.permissions` (DB-driven), but **yes** for the app to ever act on it — zero existing code references `manage_travel_origin`/`mileage`/`travel_origin`. Line to add: `MANAGE_TRAVEL_ORIGIN: "manage_travel_origin",` — but that's necessary, not sufficient; a gating call site still needs to be written. |
| 7. Runtime loading | No cache, no materialized view — fresh Supabase join per `getStaffProfile()` call. New row is live on the next request. |
| 8. Tests affected | None break from the SQL alone. `admin-access.test.ts`'s 2 known-baseline failures are untouched in name and cause. |
