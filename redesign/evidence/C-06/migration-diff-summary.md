# C-06 migration — what changes vs the live database

**Migration file:** `supabase/migrations/20260727120000_c06_client_crud_hardening.sql`
**Status:** ⛔ **WRITTEN, NOT APPLIED.** Applying it is a protocol §1 rule-2 HARD-STOP — orchestrator-only, after explicit Owner approval in chat.
**Baseline capture:** `redesign/evidence/C-06/create_booking_request-BEFORE.sql`
**Captured:** 2026-07-27, read-only (`SELECT pg_get_functiondef('public.create_booking_request'::regproc)`).

---

## 0 — How fidelity was proved (not asserted)

The RPC's live body is 14,686 characters. It was not retyped.

1. `SELECT length(...)`, `SELECT md5(...)` → `14686`, `b44229fac5da168afb60fbd742565164`.
2. The body was written to `create_booking_request-BEFORE.sql`. `wc -c` → **14686**; `md5sum` → **b44229fac5da168afb60fbd742565164**. **Byte-identical to the live function.**
3. The replacement body was produced **from that file by a script** (`build_rpc.py`, scratchpad) that applies five exact string replacements and **asserts each matches exactly once**. Every byte outside those five regions is carried over untouched — there is no opportunity for a validation to be silently dropped.
4. `diff -u BEFORE.sql rpc-after.sql` → **five hunks, all intended** (reproduced in §1).
5. The function region was re-extracted from the finished migration file and diffed against the verified body → **identical**.

---

## 1 — The five edits to the function

### 1. Signature — three appended parameters (1 line changed)

```diff
-... p_override_availability boolean DEFAULT false, p_area text DEFAULT NULL::text)
+... p_override_availability boolean DEFAULT false, p_area text DEFAULT NULL::text, p_client_id uuid DEFAULT NULL::uuid, p_confirm_duplicate boolean DEFAULT false, p_raise_on_duplicate boolean DEFAULT false)
```

All 20 existing parameters keep their names, types, order and defaults. The three new ones are appended and defaulted.

### 2. DECLARE — one new variable (1 line added)

```diff
   v_client_id uuid;
+  v_existing_client_id uuid;
   v_booking_id uuid;
```

### 3. Email validation — format-only when a value is present

```diff
-  if v_normalized_email = '' or v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
+  if v_normalized_email is not null and v_normalized_email <> ''
+    and v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
     raise exception 'A valid contact email is required';
   end if;
```

The regex itself is unchanged. See **§3 decision 1** — this is required for branch 3 to be reachable and is behaviourally inert until Phase F ships.

### 4. Client resolution — the headline fix

The `insert into public.clients … on conflict (email) do update set full_name=…, phone=…, address=…, postcode=…, city=…, area=…, notes=…, updated_at=now()` block (25 lines) is replaced by a four-outcome branch:

| Branch | Condition | Behaviour |
|---|---|---|
| 1 | `p_client_id is not null` | `select id … where id = p_client_id and deleted_at is null`. Null → `P0002` *"Specified client does not exist or has been deleted"*. Email irrelevant. |
| 2 | email present | Dedup on email. `duplicate_client_exists` raised **only when `p_raise_on_duplicate` and not `p_confirm_duplicate`**. Then `on conflict (email) **do nothing**` + re-fetch. |
| 2a | email present, held by a soft-deleted client | `client_record_removed` (P0001) with a customer-safe HINT. |
| 3 | email absent | Dedup on phone; `duplicate_client_exists` unless `p_confirm_duplicate`; else insert a client with `email = null` and capture the id directly. |

**`do update` → `do nothing` is the destructive-overwrite kill.** It applies to *both* callers; `p_raise_on_duplicate` only decides whether the admin gets warned first.

### 5. `bookings.contact_email` — empty string persists as NULL (1 line changed)

```diff
     v_clean_name,
-    v_normalized_email,
+    nullif(v_normalized_email, ''),
     v_clean_phone,
```

### Everything else is byte-identical

Unchanged and verified so by diff: the `service_role` gate; full-name / phone validations; `business_settings` load; date-bounds and future-time checks; service lookup and count check; the two gender-restriction `exists` checks; required-gender tallies; total price; `v_end_time` and the same-day check; start/end minute maths; the entire `if not p_override_availability` availability block (advisory lock, blocked dates, global + per-staff overrides, custom/global availability rules, busy-overlap check, male/female capacity checks); city required + allowed-cities check; the whole `insert into public.bookings` column and value list apart from edit 5; the participant / booking_items / booking_assignments loop; and the `return jsonb_build_object(...)` shape.

`RETURNS jsonb`, `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path TO 'public', 'app_private'` — all unchanged.

---

## 2 — The other statements

| # | Statement | Live state verified before writing |
|---|---|---|
| 1 | `alter table public.clients add column if not exists deleted_at timestamptz` | column absent |
| 1 | `alter table public.bookings add column if not exists deleted_at timestamptz` | column absent |
| 1b | `alter table public.bookings alter column contact_email drop not null` | `is_nullable = NO` |
| 2 | insert 2 permissions, `on conflict (name) do nothing` | neither row exists; `permissions_name_key` is UNIQUE |
| 3 | grant both to `Owner` + `Admin`, `on conflict (role_id, permission_id) do nothing` | both roles exist; `role_permissions_pkey` is `(role_id, permission_id)` |
| 4 | `drop function` (20-arg) + `create or replace` (23-arg) + `grant execute … to service_role` | exactly 1 overload (20 args, 6 defaults); `pg_depend` reports no dependent objects; ACL `{=X/postgres,postgres=X/postgres,service_role=X/postgres}` |

Whole file is wrapped in `begin; … commit;`.

---

## 3 — Three points where this file goes beyond the plan's literal SQL

Each is called out here because the Owner reviews the migration verbatim and can strike any of them.

### Decision 1 — `drop function` before the replacement ⚠️ **most important**

The plan's Step 12 shows a bare `CREATE OR REPLACE FUNCTION` with the three new parameters appended. **That alone does not replace the existing function.** PostgreSQL identifies a function by name **plus argument types**; adding parameters creates a **second, independent function**. Consequences of omitting the drop:

- the 20-argument version — **with the destructive `on conflict (email) do update` still in it** — stays live in production, which is precisely the bug C-06 exists to remove; and
- any 20-argument call becomes ambiguous between two candidates (`42725`, *"function is not unique"*), since both accept 14–20 arguments once defaults are counted.

Verified live before writing: exactly one overload exists (20 args, 6 defaults) and `pg_depend` reports no dependent objects, so the drop is safe. Dropping resets the ACL, so `grant execute … to service_role` follows the create; PUBLIC EXECUTE is Postgres' built-in default and returns on its own, reproducing the current ACL exactly. This is the same class of plan defect as the two already corrected on 2026-07-27 (progress file §3) and warrants the same Owner sign-off.

### Decision 2 — email validation relaxed (edit 3)

The plan's Step 12 body comment says the existing validations are "UNCHANGED", but the same Step 12 requires **branch 3 (email absent)** — and the current validation raises `'A valid contact email is required'` on an empty email, making branch 3 unreachable. The plan also commits Phase F (Step 13) to being **code-only**, with "its DB pieces folded into the Step 12 migration". Both statements can only be true if the validation relaxes here.

**Behaviourally inert on the day it lands:** both callers still require an email in their own Zod (`route.ts` `z.email()`, `manualBookingSchema.email` — Phase F relaxes only the admin one later), so no path can currently send an empty email. The alternative — leaving it strict — would force a second migration against the band's riskiest surface on a database with no backup.

*To revert this one:* restore the single line `if v_normalized_email = '' or v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then`. Branch 3 then becomes dead code until a later migration.

### Decision 3 — `category` / `scope` / `risk_level` on the new permission rows

The plan inserts `(name, description)` only. Those three columns are `NOT NULL` with defaults `'system'` / `'global'` / `'medium'`, and `/admin/roles/[roleId]` **groups permissions by `category` and filters by `risk_level`** — so the plan's form would file two client permissions under "System". Set explicitly to `('clients', 'operational', 'elevated')` and `('clients', 'operational', 'high')`, matching the sibling rows (`view_client_contact_details`, `manage_sensitive_client_notes`, …). *To revert:* drop the three columns from the insert.

---

## 4 — Post-apply verification (for the orchestrator, after Owner approval)

```sql
-- exactly one overload, now 23 args
SELECT oid::regprocedure, pronargs, pronargdefaults, proacl::text
FROM pg_proc WHERE proname = 'create_booking_request';

-- new body live, old destructive block gone
SELECT position('on conflict (email) do nothing' IN pg_get_functiondef('public.create_booking_request'::regproc)) > 0 AS has_do_nothing,
       position('do update' IN pg_get_functiondef('public.create_booking_request'::regproc))               = 0 AS overwrite_gone,
       position('client_record_removed' IN pg_get_functiondef('public.create_booking_request'::regproc))   > 0 AS has_clash_guard;

-- columns + constraint
SELECT table_name, column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'clients'  AND column_name = 'deleted_at')
    OR (table_name = 'bookings' AND column_name IN ('deleted_at', 'contact_email')));

-- permissions + grants (progress file §4.2 — plan §3.4 omits this)
SELECT name, category, scope, risk_level FROM public.permissions
WHERE name IN ('manage_client_identity_fields', 'manage_client_destructive_ops');   -- expect 2 rows

SELECT r.name AS role, p.name AS permission
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.name IN ('manage_client_identity_fields', 'manage_client_destructive_ops')
ORDER BY r.name, p.name;   -- expect Admin ×2 and Owner ×2 only
```

**Rollback source:** `create_booking_request-BEFORE.sql` is the exact original — plan §5.1's rollback can `\i` it rather than reconstruct it. This is the mitigation the Owner accepted in place of a database backup.

> The committed blob is 14,686 bytes with LF endings (`git show :redesign/evidence/C-06/create_booking_request-BEFORE.sql | md5sum` → `b44229fac5da168afb60fbd742565164`). This repo has no `.gitattributes` and `core.autocrlf=true`, so a fresh Windows checkout materialises it with CRLF and the working-copy checksum will not match. The SQL is unaffected — Postgres does not care — but compare against the **blob**, not the checked-out file.
