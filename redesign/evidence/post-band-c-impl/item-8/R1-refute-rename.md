# R1 — Adversarial refutation of A-rename-hazard.md

Target: the rename-hazard report for `alter table public.business_settings rename column allowed_cities to free_travel_cities;`
Method: independently re-ran every catalog sweep (SELECT-only, project `twzutkfgqclqurvkmvqz`), re-read the full `create_booking_request` body via `pg_get_functiondef`, and grepped `src/` for the same column name. No DDL was executed; `apply_migration` was never invoked.

## Verdict summary

The report's **central technical claim holds up**: `public.create_booking_request` is confirmed, independently, as the sole database object of any kind referencing `allowed_cities`, and the rename would break it exactly as described. I could not refute that chain.

However, the report **should not be read as "safe to ship as recommended."** I found two material problems that the report understated or missed:

1. The report's own file list for the application-code blast radius is significantly incomplete — it omits a second, independent break point (`src/lib/booking/availability.ts`) that is *not* fixed by bundling the DB migration alone, and that arguably fails more visibly than the RPC it did analyze.
2. The claim that bundling the two DDL statements in one Supabase migration guarantees atomicity is **asserted, not verified** — I could not test it directly (invoking `apply_migration` is prohibited under this task's rules), and no documentation surfaced during search that states it explicitly. The inference is well-supported by indirect evidence, not proven.

Both are detailed below.

## 1. Independent re-verification of the DB-only sweep (re-run myself, not trusted from the report)

| Sweep | Query | Result | Matches report? |
|---|---|---|---|
| Functions, `prosrc ILIKE '%allowed_cities%'` | all schemas | `public.create_booking_request` only | Yes |
| Functions, `pg_get_functiondef(oid) ILIKE '%allowed_cities%'` (independent code path from prosrc; excludes aggregates via `prokind in ('f','p')`) | all schemas | `public.create_booking_request` only | Yes |
| Functions, `prosrc ILIKE '%allowed%'` (bare word, catches split/obfuscated identifiers) | all schemas | `create_booking_request` + `storage.protect_delete` (unrelated — matches "is not **allowed**", a Supabase-internal storage-delete guard with no reference to `business_settings`) | Consistent |
| Functions, `prosrc ILIKE '%allowed%cities%'` / `'%cities%allowed%'` (wildcard, catches concatenated/quoted identifier construction) | all schemas | `create_booking_request` only | Consistent |
| Functions, dynamic SQL check: `prosrc ILIKE '%business_settings%'` AND (`ILIKE '%execute %'` OR `ILIKE '%format(%'`) | all schemas | zero rows | No dynamic-SQL hazard exists anywhere touching this table |
| **All** functions referencing `business_settings` at all (broadest possible net, not just `allowed_cities`) | all schemas | `create_booking_request` only | `create_booking_request` is the *only* function in the entire database that touches `business_settings` in any way — rules out any other `SELECT *`-into-record-then-positional-read hazard elsewhere, since there is no "elsewhere" |
| Views/matviews, definition ILIKE `%allowed_cities%` or `%business_settings%` | `pg_views`, `pg_matviews` | zero rows | Yes |
| RLS policies, qual/with_check ILIKE `%allowed_cities%` or `%business_settings%` | `pg_policies` | zero rows | Yes |
| Rules | `pg_rules` | zero rows | Yes |
| Indexes | `pg_indexes.indexdef ILIKE '%allowed_cities%'` | zero rows | Yes |
| Constraints on `business_settings` | `pg_constraint` | 6 total: 5 CHECKs (booking_window_days, buffer_time_mins, minimum_notice_hours, customer_cancellation_cutoff_hours, id) + 1 PK; none reference `allowed_cities` | Yes, exact match |
| FKs pointing at `business_settings` | `pg_constraint` where `confrelid` | zero rows | Yes |
| Column defaults / generated columns anywhere | `information_schema.columns` | zero rows | Yes |
| Publications with column lists on `business_settings` | `pg_publication_tables` | zero rows | Yes |
| Column identity | `pg_attribute` | `attnum = 8`, `atthasdef = true` | Yes, exact match |
| Triggers whose function body references `allowed_cities`/`business_settings` | `pg_trigger` joined to `pg_proc.prosrc` | zero rows | Yes |
| **Total non-internal triggers in the DB** | `pg_trigger` | **16** | **Report says 15 — off by one.** All 16 are generic (`update_updated_at_column` ×9, `bookings_set_completed_at`, `clear_account_password_request_payload`, two `storage.protect_delete` triggers, `storage.update_objects_updated_at`, `realtime.subscription_check_filters`); none touch `business_settings`. The miscount does not change the conclusion (no trigger references the column either way), but it means the report's supporting counts were not all re-verified as precisely as claimed. |

**Conclusion for the DB sweep: I could not refute that `create_booking_request` is the sole DB-side hazard.** The one factual slip found (16 vs. 15 triggers) is immaterial to the outcome.

## 2. Full function body re-read (not trusted from the report's excerpt)

Pulled `pg_get_functiondef` for `create_booking_request` directly. Confirmed:
- `v_settings public.business_settings%rowtype;` declared, `select * into v_settings from public.business_settings limit 1;` fetched (whole-row, unaffected by rename).
- The `allowed_cities` check (`jsonb_array_elements_text(v_settings.allowed_cities)`) sits **after** the availability-check block and **before** every `insert` (clients → bookings → booking_participants/items/assignments) and is **not** gated by `p_override_availability` or any other flag — unconditionally reached on every well-formed call. Confirmed.

**One precision issue with the report's wording**: the report calls `v_settings.allowed_cities` "the SOLE named field access." That is imprecise — `v_settings.booking_window_days` is also accessed by name earlier in the function (`if p_booking_date > v_today + v_settings.booking_window_days then`). This does not change the rename-hazard conclusion (`booking_window_days` is not being renamed), but "sole named field access" is an overstatement; it should have read "sole access to the field being renamed."

## 3. Application-code blast radius — the report's list is materially incomplete

The report flags this as "out of DB scope" and names four files: `settings-data.ts`, `actions.ts`, `SettingsForm.tsx`, and "its test." I grepped `src/` independently for `allowed_cities`/`allowedCities` and found **12 files**, not 4:

```
src/lib/booking/availability.ts                                   <- MISSING from report, and the most severe
src/lib/booking/__tests__/working-hours-segments.test.ts          <- MISSING
src/lib/booking/__tests__/staff-recurring-windows.test.ts         <- MISSING
src/lib/booking/__tests__/override-windows.test.ts (x2 lines)     <- MISSING
src/lib/booking/__tests__/availability-options.test.ts            <- MISSING
src/app/admin/bookings/new/page.tsx                                <- MISSING
src/app/admin/bookings/new/ManualBookingForm.tsx                   <- MISSING
src/app/admin/settings/__tests__/updateBusinessSettings.test.ts    <- named only as "its test," singular
src/app/admin/settings/SettingsForm.tsx                            <- named
src/app/admin/settings/settings-data.ts                            <- named
src/app/admin/settings/actions.ts                                  <- named
src/app/admin/settings/page.tsx                                    <- MISSING
```

**The important one is `src/lib/booking/availability.ts`.** It queries the column directly via PostgREST, independent of the RPC the report analyzed:

```ts
// line 429-436
async function loadSettings(supabase: SupabaseClient) {
  const settingsResult = await supabase
    .from("business_settings")
    .select(
      "booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled"
    )
    .eq("id", 1)
    .single<BusinessSettingsRecord>();

  return settingsResult.error || !settingsResult.data ? null : settingsResult.data;
}
```

If the DB column is renamed and this file is not updated in the same deploy, PostgREST returns an error for the unknown column, `loadSettings` returns `null`, and every caller treats that as "Booking settings unavailable":

```ts
// line 825-829 and 904-907
const settings = await loadSettings(supabase);
if (!settings) {
  return emptyResult(input, 0, requiredStaffByGender, "Booking settings unavailable.");
  // (second call site: return unavailable("Booking settings unavailable.");)
}
```

This is a **second, independent failure mode that the report's recommended fix does not address**. "Ship the `ALTER TABLE RENAME COLUMN` and `CREATE OR REPLACE FUNCTION create_booking_request` in the same migration/transaction" — even if executed perfectly — does nothing for `availability.ts`, because that file is deployed with the Next.js app, on its own release cadence, not inside the Supabase migration. If the DB migration ships before (or without being coordinated with) an app deploy that also updates `availability.ts`, every date/slot availability check across the site returns "unavailable," which is arguably **more visible and more damaging** than the RPC error the report focused on: it can block customers from even seeing bookable slots, not just from submitting a completed booking.

The report's own §7 caveat ("flagged, not verified as part of this DB-only task") is a reasonable scope boundary for *analysis*, but the specific file list it gave is wrong by omission in a way that matters: it undercounts the coordination the Owner needs to plan for, and it omits the one file whose breakage is worse than the one the report spent the most effort analyzing.

## 4. Transaction behaviour of `apply_migration` — could not verify directly; here is the safe assumption

I could not invoke `apply_migration` to test this (prohibited — DDL, and this task is SELECT-only). No Supabase documentation surfaced via `search_docs` states explicitly whether a single `apply_migration` call is guaranteed atomic across multiple semicolon-separated statements in its one `query` string.

What I *can* say, from evidence gathered without running any DDL:

- `apply_migration`'s own schema takes exactly one `query` string per call (`{project_id, name, query}`) — i.e., a migration is submitted as a single unit, not a list of independently-executed statements. This is consistent with (but does not prove) atomic execution.
- Standard, long-documented PostgreSQL behavior: when multiple statements are sent in a single simple-query protocol message, they execute as one implicit transaction unless the text itself contains explicit `BEGIN`/`COMMIT` boundaries or a statement that cannot run inside a transaction block (e.g. `CREATE INDEX CONCURRENTLY`, `VACUUM`). Neither `ALTER TABLE ... RENAME COLUMN` nor `CREATE OR REPLACE FUNCTION` falls into that excluded category, so *if* the tool sends the whole `query` string as one message, atomicity follows from ordinary Postgres behavior — this part is well-established, not Supabase-specific speculation.
- **Strong local precedent in this exact repository**: `supabase/migrations/20260503150000_phase2_booking_atomic_snapshots.sql` already does exactly this pattern — `alter table` (adding/altering columns, adding constraints) followed by `create or replace function public.create_booking_request(...)` referencing those same altered columns, all in one migration file, already applied successfully to this database. This is the established convention in this codebase, not a novel or untested approach.

None of this is a substitute for directly confirming the MCP tool's internal transaction semantics, which I was not able to do. **Safe assumption**: treat single-call atomicity as likely but unconfirmed. The lowest-risk path that does not depend on this assumption at all is to write the migration text with explicit `begin;` / `commit;` wrapping both statements — this makes atomicity a property of the SQL text itself (guaranteed by Postgres regardless of how the surrounding tool sends it), rather than a property that has to be trusted about the tool.

## Answers to the specific questions posed

- **Re-ran the sweeps myself**: yes, all of them, using several independent strategies (prosrc ILIKE, `pg_get_functiondef` ILIKE, bare-word `%allowed%`, wildcard `%allowed%cities%`, broadest-possible "any reference to business_settings at all"). Result: confirmed, with one immaterial miscount (triggers: 16 actual vs. 15 claimed).
- **Dynamic SQL check**: confirmed clean. Zero functions combine `business_settings` with `EXECUTE`/`format(`. Since `create_booking_request` is the *only* function referencing `business_settings` at all, there is no other function anywhere that could be doing a `SELECT *`-into-record-then-positional/dynamic read either.
- **Positional/record-read hazard elsewhere**: none exists, because no other function touches `business_settings` in any form.
- **Ordering safety**: the DDL-bundling recommendation is well-supported for the *database* side but is **not sufficient on its own** — a second, independent, unaddressed break point exists in application code (`src/lib/booking/availability.ts`) that must ship in the same coordinated release, or the site's availability-checking codepath fails for 100% of visitors regardless of how well the DB migration is bundled.
- **Transaction behaviour of `apply_migration`**: not verified directly (could not test without running prohibited DDL). Best available evidence (tool schema shape, standard Postgres protocol semantics, and this repo's own precedent) points toward single-call atomicity, but this is an informed inference, not a confirmed fact. Recommend explicit `begin;`/`commit;` in the migration text so correctness does not depend on the assumption.

## Would I let this migration run against the live booking system today?

**Not as currently scoped.** The DB-only migration (rename + `create_booking_request` replacement, bundled in one file) is technically sound and I could not find a flaw in that specific piece — if it ships alone, with nothing else touching `allowed_cities`, it is safe. But "ship this migration" was framed as the unit of risk, and it isn't: `src/lib/booking/availability.ts` reads the same column by name, outside the DB, on a separate deploy cadence, and its failure mode (booking calendar shows no availability at all) is worse than the one the report analyzed in depth. Shipping the DB migration without a coordinated app deploy that also fixes `availability.ts` (and the admin `ManualBookingForm.tsx`/`page.tsx` paths) would break the site even with a perfectly atomic migration.

## Single change that would most reduce risk

Expand the migration package from "one DB migration" to "one DB migration + one coordinated app-code diff," and land both in the same release. Concretely: add the `free_travel_cities` rename to the same PR/deploy that updates `src/lib/booking/availability.ts` (both the `.select()` string and the `settings.allowed_cities` reference), plus the four admin-settings files already identified, plus `src/app/admin/bookings/new/page.tsx` and `ManualBookingForm.tsx`. Within the migration file itself, wrap both DDL statements in explicit `begin; ... commit;` so atomicity does not depend on an unverified assumption about how the migration tool sends multi-statement SQL.
