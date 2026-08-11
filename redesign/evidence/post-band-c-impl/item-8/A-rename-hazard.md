# Item 8 Phase 1 — rename hazard: `business_settings.allowed_cities` → `free_travel_cities`

Verification target: `alter table business_settings rename column allowed_cities to free_travel_cities;`
Method: SELECT-only SQL against Supabase project `twzutkfgqclqurvkmvqz` (no DDL executed — the rename was never run). Every claim below is the literal query output, not a paraphrase.

## 1. Functions referencing `allowed_cities`

```sql
SELECT n.nspname, p.proname, p.oid::regprocedure AS signature
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosrc ILIKE '%allowed_cities%'
ORDER BY 1,2;
```
Result (all schemas, no namespace filter):
```json
[{"nspname":"public","proname":"create_booking_request",
  "signature":"create_booking_request(text[],text,text,text,text,text,boolean,text,text,text,text,date,time without time zone,staff_gender_type[],text[],text[],text,text[],boolean,text,uuid,boolean,boolean)"}]
```
Re-run joined to `pg_language` to also surface any SQL-language or C-language function whose `prosrc` might not be plpgsql text — same single hit, `lanname = plpgsql`, `prokind = 'f'` (plain function, not agg/window/procedure):
```json
[{"nspname":"public","proname":"create_booking_request","lanname":"plpgsql","prokind":"f"}]
```
**The plan's claim is confirmed exactly as stated: `create_booking_request` is the only function in the entire database (any schema) whose body references `allowed_cities`.**

## 2. Views / materialized views

```sql
SELECT schemaname, viewname, 'view' FROM pg_views WHERE definition ILIKE '%allowed_cities%'
UNION ALL
SELECT schemaname, matviewname, 'matview' FROM pg_matviews WHERE definition ILIKE '%allowed_cities%';
```
Result: `[]` — zero hits.

## 3. RLS policies

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE qual ILIKE '%allowed_cities%' OR with_check ILIKE '%allowed_cities%';
```
Result: `[]` — zero hits.

## 4. Triggers, indexes, constraints, defaults, generated columns

- **Indexes**: `SELECT * FROM pg_indexes WHERE indexdef ILIKE '%allowed_cities%'` → `[]`.
- **Constraints on `business_settings`** (`pg_constraint` via `pg_get_constraintdef`): six constraints total — `business_settings_booking_window_days_check`, `_buffer_time_mins_check`, `_customer_cancellation_cutoff_hours_check`, `_id_check`, `_minimum_notice_hours_check`, and the PK (`PRIMARY KEY (id)`). None reference `allowed_cities`.
- **Column defaults / generated columns** (`information_schema.columns` where `column_default` or `generation_expression` ILIKE `%allowed_cities%`, whole schema) → `[]`. The column's own default is `'[]'::jsonb` (a literal, not a self-reference) — see §5.
- **Triggers** (`pg_trigger` non-internal, whole database): 15 triggers exist; all are generic (`update_updated_at_column`, `bookings_set_completed_at`, `clear_account_password_request_payload`, storage/realtime internals). None touch `allowed_cities` or even reference `business_settings`.
- **Rules** (`pg_rules` where `definition ILIKE '%allowed_cities%'`) → `[]`.
- **Publications with explicit column lists** (`pg_publication_tables` for `business_settings`) → `[]` (no publication entries at all for this table).
- **Foreign keys pointing at `business_settings`** (`pg_constraint` where `confrelid = business_settings`) → `[]` — nothing references this table by FK, so no cross-table cascade risk either.

## 5. `pg_depend` sweep on the column itself

```sql
SELECT a.attrelid::regclass, a.attname, a.attnum FROM pg_attribute a WHERE a.attname='allowed_cities';
-- -> business_settings.allowed_cities, attnum 8 (only occurrence of the name in pg_attribute)

SELECT d.classid::regclass, d.objid, d.refobjid::regclass, d.refobjsubid, d.deptype,
       pg_describe_object(d.classid, d.objid, d.objsubid)
FROM pg_depend d
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE a.attrelid = 'public.business_settings'::regclass AND a.attname = 'allowed_cities';
```
Result: exactly one row — `pg_attrdef` / "default value for column allowed_cities of table business_settings", `deptype = 'a'` (automatic).

This is the column's own default expression, `'[]'::jsonb`, `NOT NULL`. It is **not a hazard**: `pg_attrdef` dependencies are keyed by `attnum` (8), not by `attname`. `ALTER TABLE ... RENAME COLUMN` only rewrites `pg_attribute.attname`; it does not touch `attnum` or the attrdef row, so the default survives the rename untouched and still applies under the new name.

Nothing else appears in `pg_depend` for this column — which is expected and consistent with the task's own premise: PL/pgSQL function bodies are opaque text (`prosrc`) to the catalog, so Postgres never records a `pg_depend` edge from `create_booking_request` to `business_settings.allowed_cities` in the first place. The `pg_depend` graph is structurally blind to this hazard; only the `prosrc ILIKE` text sweep in §1 can find it. That sweep is exhaustive (no schema filter, confirmed twice, cross-checked by language/kind).

**Conclusion for questions 1–5: `create_booking_request` is the only database object of any kind — function, view, matview, RLS policy, trigger, index, constraint, rule, publication, default, or generated column — anywhere in this database that references `allowed_cities`.**

## 6. The decisive question — what breaks, and how visibly

Full definition of `create_booking_request` was pulled via `pg_get_functiondef`. The reference is a single site, quoted verbatim:

Declaration (`%ROWTYPE` binds to the table's current row type, not a snapshot of column names):
```sql
v_settings public.business_settings%rowtype;
```
Fetch (whole-row assignment — matches by tuple structure/position, not by name, so this line does **not** fail after the rename):
```sql
select * into v_settings from public.business_settings limit 1;
```
The one and only named field access, reached unconditionally on every legitimate booking attempt, well before any `insert`:
```sql
if v_clean_city = '' then
    raise exception 'City is required';
end if;

if not exists (
    select 1
    from jsonb_array_elements_text(v_settings.allowed_cities) as allowed(city)
    where lower(v_clean_city) = lower(trim(allowed.city))
       or lower(v_clean_city) like '%' || lower(trim(allowed.city)) || '%'
  ) then
    raise exception 'Location is outside the service area';
  end if;
```

**Does it throw at CALL time, not rename time?** Yes. `ALTER TABLE ... RENAME COLUMN` only edits catalog metadata (`pg_attribute.attname`); Postgres never inspects `create_booking_request`'s body during the rename, so the `ALTER TABLE` statement itself succeeds with no warning. PL/pgSQL function bodies are parsed/compiled lazily — the first time a given backend executes the function after the row type's catalog entry changes (which every backend's next call will see, since the rename sends a shared-cache invalidation for the table that forces plpgsql to recompile on next invocation). At that point PL/pgSQL resolves `v_settings.allowed_cities` by looking up the field name `allowed_cities` against the row descriptor of `business_settings`. After the rename that name no longer exists, and PL/pgSQL raises its own error for an unresolvable row-variable field (the well-documented PL/pgSQL pattern is `record "v_settings" has no field "allowed_cities"`, SQLSTATE `42703`/undefined_column-family). **I did not execute the rename** (prohibited by task rules — there is no test database), so I cannot paste the literal error text this specific backend would emit; the mechanism above is standard, extensively documented PL/pgSQL behavior, not a guess about this function's logic — but the exact wording is an inference, not an observed fact, and should be flagged as such to the Owner.

**Is this reachable on every real customer attempt, or an edge case?** Every real attempt. `v_clean_city = ''` only rejects an empty city, and the public route's Zod schema (`city: z.string().trim().min(2)`) already guarantees a non-empty city before the RPC is even called (`src/app/api/bookings/route.ts:38`). So the `allowed_cities` check is unconditionally reached by 100% of well-formed submissions, on both the public and admin booking paths (both call the same RPC — confirmed by grep: `src/app/api/bookings/createBookingTransaction.ts`, `src/app/admin/bookings/new/page.tsx`, `src/app/admin/bookings/new/ManualBookingForm.tsx`, `src/app/admin/bookings/recurring-actions.ts`). This is not a rare corner case — it is the normal path for every booking.

**Would a customer trying to book get an error? Trace the flow.**
1. `createBookingTransaction` (`src/app/api/bookings/createBookingTransaction.ts:140-166`) calls `supabase.rpc("create_booking_request", ...)`.
2. The RPC throws the PL/pgSQL error described above. It is not `P0001` with a `duplicate_client_exists`/`client_record_removed` prefix (those are the only two special-cased error branches), so execution falls through to the generic branch at line 191-196:
   ```ts
   if (error || !data || typeof data !== "object") {
     throw new BookingCreationError(
       error?.message ?? "Unable to create booking request.",
       error?.code === "42501" ? 403 : 400
     );
   }
   ```
   The raw Postgres error message is used verbatim as the thrown message, and the status is **400** (not 403 — `42501` is the actor-role check, a different SQLSTATE).
3. `route.ts`'s catch block (`src/app/api/bookings/route.ts:131-148`) catches `BookingCreationError` and returns it to the browser unmodified: `NextResponse.json({ error: error.message }, { status: 400 })`.
4. **Net effect: a real customer submitting the live booking form gets a 400 response whose `error` field is the raw internal Postgres/PL/pgSQL error text** (something like `record "v_settings" has no field "allowed_cities"`) instead of a normal validation message. This is highly visible — booking submission fails outright, 100% of the time, for every customer and every admin-created booking, immediately after the rename ships (not after a delay — the catalog invalidation is broadcast to all sessions on commit).
5. Because the failure happens *before* any `insert` statement in the function body (see the ordering in §6's quoted excerpt — the city check precedes client/booking/participant/assignment inserts), the whole RPC call aborts cleanly with **zero partial writes**. No orphaned client rows, no half-created bookings, no assignment rows left dangling. It is a hard, atomic failure, not silent data corruption.

## 7. Can Phase 1's rename ship alone?

**No.** The rename and the `create_booking_request` replacement (updating the single field-access site from `v_settings.allowed_cities` to `v_settings.free_travel_cities`) **must ship in the same migration/transaction**. `ALTER TABLE ... RENAME COLUMN` and `CREATE OR REPLACE FUNCTION` are both transactional DDL in Postgres, so bundling them in one migration file (one implicit transaction, as Supabase migrations run) guarantees there is never a committed state where the column has the new name and the function still says the old one. Splitting them into two migrations — even seconds apart — creates a window (from the first migration's commit to the second migration's commit) where every booking attempt, public and admin, fails with the raw Postgres error described in §6. Given Supabase migrations apply sequentially and typically without an enforced delay between them, this window would likely be short in a controlled deploy — but "likely short" is not a guarantee, and there is no reason to accept even a small non-zero probability of a fully broken booking flow when a single-transaction migration removes the risk entirely.

**Safest ordering**, all inside one migration file (one transaction):
1. `alter table business_settings rename column allowed_cities to free_travel_cities;`
2. `create or replace function create_booking_request(...) ... v_settings.free_travel_cities ...` — the full existing function body with the one field reference updated, `CREATE OR REPLACE` preserving the existing signature/OID so no `DROP FUNCTION` + re-grant dance is needed.
3. (Out of DB scope, but flagged for the Owner/orchestrator: application code also references `allowed_cities` as a field/column name — `src/app/admin/settings/settings-data.ts`, `src/app/admin/settings/actions.ts`, `src/app/admin/settings/SettingsForm.tsx`, `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`, plus historical migration files that seed/alter it. These are TypeScript, not DB objects, so they were out of this task's SELECT-only scope, but they must be updated in lockstep with the DB migration or the admin settings page will read/write the wrong field name. This is a call-out, not a verified finding — flagging so it isn't dropped between Phase 1 and whatever phase touches the app layer.)

Within step 1+2, order between them doesn't matter for correctness (both DDL statements are transactional and only take effect at commit), but doing the rename first then the function replacement mirrors dependency direction and is the more conventional migration style.

## 8. Reversibility

**Yes — fully and cleanly reversible if caught before Phase 2/3 work builds on the new name.** `ALTER TABLE ... RENAME COLUMN` only rewrites `pg_attribute.attname`; it does not move data, rebuild storage, touch `attnum`, or affect the column's default/constraints (per §5, the default is keyed by `attnum`, not name, and survives either direction of the rename automatically). A follow-up `alter table business_settings rename column free_travel_cities to allowed_cities;` fully restores the prior catalog state with no data loss.

The only real-world cost of shipping the rename without the function update (per §6) is **failed booking attempts during the broken window** — every customer/admin who tries to book gets a 400 error and no booking is created. That is a lost-conversion/support-burden problem, not a data-integrity problem: because the failure occurs before any `insert` in `create_booking_request`, no partial or orphaned rows are ever written, so there is nothing to clean up in the `clients`/`bookings`/`booking_participants`/`booking_items`/`booking_assignments` tables from the broken window itself. Reverting the column name (or shipping the function fix) immediately restores full functionality with no residual state to repair.

## Answers to the structured-output fields (summary)

- **Functions referencing the column**: exactly one — `public.create_booking_request`, single field-access site (`v_settings.allowed_cities`) inside the service-area check, reached on every well-formed booking call before any writes.
- **Views**: none.
- **RLS policies**: none.
- **Other objects**: none — no triggers, indexes, non-PK/check constraints, generated columns, rules, publications, or FKs reference `allowed_cities`. The column's own default (`'[]'::jsonb`) is name-independent (keyed by `attnum`) and is unaffected by the rename.
- **Breaks if shipped alone**: yes. Every booking submission (public + admin) fails with a raw Postgres error surfaced as an HTTP 400 to the caller, effective essentially immediately (catalog invalidation is broadcast on commit).
- **Safest ordering**: rename + `create or replace function` (with the field reference updated) in the same migration/transaction; app-layer TS references (admin settings page) updated in the same deploy, though that's outside DB scope.
- **Reversible**: yes, cleanly — rename-back fully restores the schema with zero data loss; the interim breakage produces failed requests only, never partial/orphaned rows, because the failure point precedes every `insert` in the function.
