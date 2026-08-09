# C-14 Phase A — Independent FULL verification

**VERDICT: PASS**

**Scope:** commits `17aade6` (Steps 6–7) and `d9d252a` (Steps 8–9). Migration `supabase/migrations/20260809120000_c14_save_availability_day.sql` reviewed as **written, not applied** — no DDL/DML executed by this verification; `execute_sql` used SELECT-only against project `twzutkfgqclqurvkmvqz`.

Zero BLOCKING findings. Two NON-BLOCKING observations, both pre-existing and out of scope for C-14 (see §Findings).

---

## Part 1 — the migration SQL

### 1. Atomicity

**Yes — each function's delete+insert is genuinely one transaction; no partial write is possible.** A PL/pgSQL function body executes as part of the calling statement's transaction; there is no internal `COMMIT`, and PostgREST's `rpc()` call is itself a single statement. If the `INSERT` fails for any reason after the `DELETE` has run (constraint violation, cast failure, etc.), the whole function invocation rolls back, restoring the day's original rows. The one guard that makes this matter — `assert_availability_day_segments` rejecting empty arrays — runs *before* the delete/insert pair even begins (see #4). Verified by reading the function bodies (`save_availability_day` lines 267–317, `save_staff_availability_day` lines 334–402) — no early return, no exception handler that would let a partial state escape.

### 2. The advisory lock

**The reasoning is correct, and the lock genuinely prevents it.**

Re-derived independently rather than taken on trust: under READ COMMITTED, transaction B's `DELETE ... WHERE day_of_week = X` builds its candidate row set from a snapshot taken when the statement starts. If B's DELETE blocks on row locks held by a concurrent A (because both statements matched A's original rows) and A then commits, PostgreSQL's EvalPlanQual mechanism rechecks *only the specific tuples B had already found* against their latest committed version. Since A deleted those rows and committed, the latest version is "gone" — B's DELETE simply matches nothing for that batch. EvalPlanQual does **not** re-scan the table for rows freshly INSERTed by A after A's DELETE (those are new tuples B's statement never encountered). So B's DELETE affects 0 rows, B's INSERT then adds B's own segments on top of A's already-committed segments — the day ends up holding both schedules. This is standard, documented Postgres MVCC behaviour for the delete-then-insert-replace pattern, not a hypothetical.

`pg_advisory_xact_lock(hashtextextended('save_availability_day:' || day::text, 0))` is acquired **before** the `SELECT`/`DELETE`/`INSERT` sequence (line 282, before line 286). If A holds it, B blocks at the lock call itself — before B's DELETE statement ever starts — so B's DELETE only runs after A's transaction has fully committed, sees a fresh snapshot including A's new rows, and correctly deletes all of them. No double-schedule is possible. The staff variant mirrors this with a `staff_id`-scoped key (line 361–366).

**Hash collisions:** `hashtextextended` returns a 64-bit value fed into the single-argument `pg_advisory_xact_lock(bigint)` overload, which shares one keyspace with every other `pg_advisory_xact_lock(bigint)` call in the project (e.g. `create_recurring_booking_series`'s per-client lock). A collision between, say, `'save_availability_day:1'` and an unrelated lock string is astronomically unlikely (birthday bound on a 64-bit space) and, critically, **even if it happened it could only cause extra, harmless serialisation** — two unrelated operations would needlessly block each other — never a *missed* lock. Advisory locks cannot fail open from a collision; they can only fail conservative. Not a correctness risk.

Confirmed live: the editor's "Save hours" button (`AvailabilityRulesManager.performSave`) does `Promise.all` over all seven days (`AvailabilityRulesManager.tsx:161-170`), each calling `saveAvailabilityDay` for a different `day_of_week` — seven different lock keys, so the header's claim "never contends" on the parallel save the editor actually performs is directly verified against the calling code, not just asserted.

### 3. Security

**`SECURITY INVOKER` is correct, and the grants are exactly right — independently re-verified live, not taken from the header's own claims:**

```
role_table_grants (project twzutkfgqclqurvkmvqz, read-only SELECT):
  availability_rules        service_role: SELECT, INSERT, UPDATE, DELETE (+ REFERENCES/TRIGGER/TRUNCATE)
  staff_availability_rules  service_role: SELECT, INSERT, DELETE          (no UPDATE — matches header exactly)
  staff_profiles            service_role: SELECT, INSERT, UPDATE, DELETE
  authenticated: SELECT only on all three. anon: nothing on any of the three.
  service_role.rolbypassrls = true; anon/authenticated = false.
```

This matches the header's table verbatim, including the one asymmetry (`staff_availability_rules` missing `UPDATE` for `service_role`) — a detail that would be easy to get wrong if merely copied rather than actually checked, and it checks out. Because `authenticated`/`anon` hold no INSERT/DELETE on either table, a caller under those roles would 42501 on the table grant alone if EXECUTE were ever mistakenly widened — RLS doesn't even need to be reached. `pg_default_acl` for functions in `public` owned by `postgres` is `{postgres=X/postgres}` (re-queried live) — confirms the "GRANT TRAP": a bare `CREATE OR REPLACE FUNCTION` here would leave `service_role` with **no** EXECUTE, and the "Save hours" button would 42501 on first use without statement 4. All three functions currently return zero rows from `pg_proc` (greenfield, confirmed live) — the migration is genuinely unapplied.

**Schema-qualification:** every table/function reference in the body is `public.`-qualified (`public.availability_rules`, `public.staff_availability_rules`, `public.staff_profiles`, `public.assert_availability_day_segments`). `SET search_path TO 'public'` is set on all three functions. Matches the project's existing idiom exactly — independently confirmed by reading `compute_occurrence_dates` (`20260802122636_c02_recurring_bookings.sql:404-414`, `SET search_path TO 'public'`), `update_updated_at_column` (`20260502122835_..._search_path.sql`, `set search_path = public`) and `clear_account_password_request_payload` (`20260521150000_...trigger.sql`, `set search_path to 'public'`) — all three of the header's named comparisons check out.

**Could REVOKE/GRANT leave an unintended caller with access?** No. `REVOKE ALL ... FROM PUBLIC, anon, authenticated` then `GRANT EXECUTE ... TO service_role` on all three functions, repeated per-function. Re-runnable (REVOKE from a role holding nothing is a no-op). No wildcard grants, no `GRANT ... TO PUBLIC` anywhere.

### 4. The empty-array guard

**Confirmed load-bearing, exactly as claimed.** `getRuleWindowsForDay` (via `normalizeWindows`/`containsWindow`, `availability.ts:204-217`) treats "no rows for this day" identically to "no bookable windows" — there is no separate "unknown/no data" state in the engine. If `p_segments` were `[]` and the guard didn't exist, the `DELETE` would remove the day's rows and the `INSERT ... SELECT ... FROM jsonb_array_elements('[]'::jsonb)` would insert zero rows, leaving the day with 0 rows — which `getRuleWindowsForDay` reads as CLOSED. `assert_availability_day_segments` raises on `jsonb_array_length(p_segments) = 0` (line 204-207) before the lock is even acquired, so this path is unreachable through the RPC. On the JS side this is additionally unreachable in practice — `scheduleToRows` on a working day with `closes > cursor` always emits at least the tail segment, and `validateSchedule` independently rejects (as a hard error, "no bookable time left") any schedule whose `scheduleToRows` output would be empty — but the SQL check is the correct backstop for a server action that is, per its own comment, "a public endpoint" receiving "untrusted" payloads regardless of what the TS type says.

### 5. Time handling

**Identical acceptance, cross-checked byte-for-byte across all three definitions:**
- SQL: `^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$`
- `working-hours-segments.ts:50`: `/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/`
- `availability.ts:175` (`TIME_PATTERN`, feeding `timeToMinutes`): `/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/`

All three accept `HH:MM` or `HH:MM:SS` for `00:00`–`23:59[:59]` and reject `24:00` identically (first-digit branch is `[01]x` or `2[0-3]`, never `24`). No divergence found.

### 6. Idempotency / re-runnability

**Safe to re-run**, and it matches the project's idiom precisely. `CREATE OR REPLACE FUNCTION` on all three; `REVOKE`/`GRANT` are naturally idempotent; the whole file is one `BEGIN...COMMIT` so a mid-file failure leaves nothing half-applied. Directly comparable to `20260802122636_c02_recurring_bookings.sql`, which uses the identical shape: `CREATE OR REPLACE FUNCTION` for functions, an explicit "IDEMPOTENCY" header note, the same `REVOKE ALL ... FROM PUBLIC, anon, authenticated` / `GRANT EXECUTE ... TO service_role` two-step, and the same `pg_advisory_xact_lock(hashtextextended('<name>:' || param, 0))` idiom for `create_recurring_booking_series`'s per-client lock. The C-14 migration is stylistically and mechanically consistent with the most recent precedent in the same directory.

### 7. Anything the header claims that the SQL doesn't do

None found. Every specific, checkable claim in the header was independently re-verified against either the SQL body itself, the live database (read-only), or the calling TypeScript, and all checked out:
- Live grants table (§3) — matches exactly, including the `staff_availability_rules` UPDATE asymmetry.
- `pg_default_acl` for functions and `create_recurring_booking_series`'s ACL shape (§3) — matches exactly.
- `availability_rules`: 7 rows, one per `day_of_week`, Sunday closed — matches exactly (re-queried).
- `staff_availability_rules`: 0 rows — matches exactly (re-queried).
- PK-only on both tables, no day-uniqueness — matches exactly (re-queried, same query as pre-flight #5a).
- `save_availability_day` / `save_staff_availability_day` / `assert_availability_day_segments`: 0 existing — matches (re-queried).
- `containsWindow` uses `.some()` (§"NOT VALIDATED" block) — matches `availability.ts:216`.
- "the editor... saving all seven weekdays in parallel" — matches `AvailabilityRulesManager.tsx:161-170`.
- TIME_PATTERN mirror claim — matches byte-for-byte (§5 above).

**My verdict on the migration SQL specifically: I would be comfortable running this against production.** The atomicity argument is sound and independently re-derived, not just trusted. The concurrency defect it fixes is real Postgres behaviour, correctly reasoned about, and the fix (advisory lock acquired before the read/write sequence) actually closes it. The security posture (INVOKER + explicit grants + pinned search_path) was checked against live privilege data rather than the migration's own prose, and every number matched. The one thing I cannot verify without applying it is the function actually compiling and running end-to-end (see "Checks I could not run").

---

## Part 2 — the TypeScript

### 8. `working-hours-segments.ts` — round-trips

All required cases present and passing in `src/lib/booking/__tests__/working-hours-segments.test.ts`:
- 1 window → `{opens, closes, breaks: []}` round-trips (line 39-45).
- 1 break → 2 rows, round-trips (line 47-53).
- 2 breaks → 3 rows, round-trips (line 55-70), including a test that breaks are sorted before splitting regardless of input order (line 87-102).
- Closed day → one `is_working_day:false` row that preserves the last hours (line 72-85).
- Zero-length segments dropped (breaks butting against opens/closes/each other) — line 104-118; whole-day-swallowed → `[]` — line 120-124.
- Validation: break outside `[opens,closes]` → error (line 160-174); overlapping breaks → error (line 176-187); `opens >= closes` → error (line 189-196, both `>` and `==` cases); tiny (<30min) bookable stretch → **warning**, not error (line 242-256), with a boundary test confirming exactly-30-min does **not** warn (line 258-269).

### 9. `scheduleToRows` output against the real engine

**Confirmed genuine, not a stub.** `src/lib/booking/__tests__/working-hours-segments.test.ts:13` imports `calculateAvailableSlots` directly from `"../availability"` (the real module path, `src/lib/booking/availability.ts`) — no mock of the engine itself. The only thing faked is the Supabase data layer (`createFakeAdminClient`, a shared fixture from `@/lib/cache/__tests__/fake-supabase-admin` used elsewhere in the suite), which returns fixture rows for `availability_rules`, `services`, `staff_profiles`, etc. The three tests at lines 352-380 feed real `scheduleToRows(MONDAY_WITH_A_BREAK)` output as the `availability_rules` fixture data and assert against the actual slot times `calculateAvailableSlots` returns: slots on either side of the break, none crossing it (12:00–14:30 blocked), and zero slots on a closed day. This is exactly the "prove zero-engine-change" test the plan calls for.

`git show d9d252a --stat` / `17aade6 --stat` (re-run by me, not re-quoted from the implementer): **`src/lib/booking/availability.ts` does not appear in either diff.** Confirmed unedited by Phase A, as the plan requires (§2.3 "No slot-engine change").

### 10. `saveAvailabilityDay`

- `createSupabaseAdminClient()` (line 100) is called only after `actor = await requireGlobalAvailabilityManager()` succeeds (line 76) — and `requireGlobalAvailabilityManager` → `requirePermission` → `getStaffProfile` (`src/lib/auth/rbac.ts:401-405`), so the ordering rule is honoured through the actual call chain, not just superficially.
- `updateTag(tag)` used throughout (`report-data`, `dashboard-data`, `TAGS.STAFF`, `TAGS.BOOKINGS`, `TAGS.AUDIT`) — no `revalidateTag` call anywhere in the file.
- Audit-logged: `audit_logs` insert with `before_state`/`after_state` built from the RPC's single-snapshot `{before, after}` response (lines 108-124), matching the file's existing pattern.
- The **primary** write error is surfaced, not swallowed: `const { data, error } = await adminClient.rpc(...); if (error) return { error: error.message };` (lines 101-106), and `actions.test.ts:279-292` ("surfaces an RPC failure instead of reporting success") independently exercises this path.
- **Non-blocking observation:** the `audit_logs` insert itself (line 115) is not error-checked (`await adminClient.from("audit_logs").insert({...});` with no `{error}` destructuring). I confirmed via `git show d9d252a -- src/app/admin/availability/actions.ts` that this is **pre-existing** — the old `saveAvailabilityRule` had the identical unchecked audit insert before Steps 8-9, and every other action in this file (`deleteAvailabilityRule`, `createBlockedDate`, `deleteBlockedDate`, `createAvailabilityOverride`, `deleteAvailabilityOverride`) shares the same pattern. Not introduced by C-14; not a regression. See Findings.

### 11. `AvailabilityRulesManager`

- Editor wired: `DayRow` renders `WorkingHoursDayEditor` per day (line 352-356), replacing the old inline Opens/Closes inputs entirely (confirmed via diff — the old input JSX, including its `oklch` border literals, was deleted, not left dead).
- `buildInitialState` (line 60-73) reads **all** of a day's rows via `initialRules.filter((rule) => rule.day_of_week === day)` then `rowsToSchedule(rows)` — not `.find()`. Independently confirmed by mutation (see Part 3, mutant 2).
- "Copy Monday to Tue–Sat" (`copyMondayToWeekdays`, line 123-150) copies the whole schedule including breaks, and **each target day gets its own break array**: `breaks: monday.schedule.breaks.map((entry) => ({...entry}))` is evaluated fresh inside the `for (const target of [2,3,4,5,6])` loop body (line 128-139) — each iteration calls `.map()` again, producing six independently-owned arrays of six independently-owned break objects, never a shared reference. Confirmed by the dedicated test "gives each copied day its own break objects" (`AvailabilityRulesManager.test.tsx:96-114`, mutating Tuesday's break and asserting Monday's is untouched) and independently by mutation (Part 3).

### 12. Tokens

- `src/app/admin/availability/WorkingHoursDayEditor.tsx` (the new Phase A component): grepped for `oklch(`, `#[0-9a-f]{3,8}`, `rgb(`, `rgba(`, `hsl(` — **zero matches**. Every colour reference is `var(--admin-*)` (`--admin-radius-control`, `--admin-border-form`, `--admin-surface-input`, `--admin-body`, `--admin-focus`, `--admin-text-muted`, `--admin-panel-muted`, `--admin-border`, `--admin-canvas`, `--admin-danger`, `--admin-danger-bg`, `--admin-warning`, `--admin-warning-bg`), all of which are real tokens defined in `src/styles/tokens.css` and used across the existing admin surface (16 files reference `--admin-danger`/`--admin-warning` alone).
- `AvailabilityRulesManager.tsx`'s pre-existing `oklch(...)` literals (form-error banner, day-row working/closed background, per-day error text) are confirmed **untouched** by this change: `grep -n "oklch"` on `git show d9d252a -- .../AvailabilityRulesManager.tsx` shows the two row-background literals appearing only as unchanged context lines (no `+`/`-`), and the form-error-banner / per-day-error-text `oklch` literals do not appear anywhere in the diff at all (they sit in regions the commit never touched). Not reported as new, per the dispatch's explicit instruction.

---

## Part 3 — mutation testing (run by me, on the tracked files, reverted after each)

Per the dispatch's "known constraint" note, I mutated the two named targets directly in `src/` (vitest's `include: src/**` requires this to exercise the real specs against the real implementation), captured the failing test names, then reverted each file to its exact original content and re-verified with `diff` before moving on. Backups were kept in the scratchpad (outside the repo) as a safety net, not used.

**Mutant 1 — "make the save drop all but the first segment."**
`src/app/admin/availability/actions.ts:91`, changed `scheduleToRows(normalized)` → `scheduleToRows(normalized).slice(0, 1)`.
Ran `pnpm vitest run src/app/admin/availability/__tests__/actions.test.ts`: **1 failed / 11 passed.**
Failing test: `saveAvailabilityDay — segments > sends every segment of the day, so a break survives the save` — the assertion diff shows the RPC call missing the `15:00–20:00` segment, exactly the injected defect.
Reverted; `diff` against the pre-mutation copy: identical.

**Mutant 2 — "make `buildInitialState` read only the first row."**
`src/app/admin/availability/AvailabilityRulesManager.tsx:63`, changed the day filter to `.filter(...).slice(0, 1)`.
Ran `pnpm vitest run src/app/admin/availability/AvailabilityRulesManager.test.tsx`: **5 failed / 2 passed** (of 7).
Failing tests, by name:
- `AvailabilityRulesManager — loading a day's segments > reads every row of a day, so a stored break comes back as a break`
- `AvailabilityRulesManager — copy Monday > copies Monday's breaks, not just its opens and closes`
- `AvailabilityRulesManager — copy Monday > gives each copied day its own break objects`
- `AvailabilityRulesManager — saving > sends the whole schedule of a broken-up day, not just its first segment`
- `AvailabilityRulesManager — saving > blocks the save while a day's breaks are invalid`

Reverted; `diff` against the pre-mutation copy: identical.

**Post-mutation verification:** `git status --porcelain -- src/ supabase/` → only `M src/lib/maintenance.ts` (the standing Owner change). Re-ran both affected spec files clean: `2 passed / 19 passed` total, confirming full restoration.

Both mutants killed hard by the existing test suite — no gap found.

---

## Gates by identity

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors.** Clean run, no output. |
| `pnpm vitest run` | **5 failed / 2120 passed / 2125 total.** Failures by name, exactly: `admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated`, `admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management`, `ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load`, `ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors`, `ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent`. No seventh failure, no C-14 file in the failure list. Matches the inherited baseline by identity.
| `pnpm lint` | **59 errors / 7 warnings**, in exactly six files: `design_handoff_area_pages/prototype/area-page.jsx`, `design_handoff_area_pages/prototype/shared.jsx`, `design_handoff_area_pages/prototype/site-chrome.jsx`, `src/features/booking/BookingExperience.tsx`, `src/features/booking/BookingExperienceLoader.tsx`, `src/features/booking/utils/returning-customer.ts`. No seventh file; none of the C-14 files (`working-hours-segments.ts`, `WorkingHoursDayEditor.tsx`, `AvailabilityRulesManager.tsx`, `actions.ts`) appear.
| `pnpm build` | **NOT RUN** — banned for agents per the dispatch; recorded, not attempted. |

---

## Findings

**BLOCKING: none.**

**NON-BLOCKING:**

1. `src/app/admin/availability/actions.ts` — every action in the file (`saveAvailabilityDay` line 115, `deleteAvailabilityRule` line 159, `createBlockedDate` line 203, `deleteBlockedDate` line 244, `createAvailabilityOverride` line 303, `deleteAvailabilityOverride` line 344) inserts into `audit_logs` without checking the returned `error`. Confirmed pre-existing (present in the old `saveAvailabilityRule` before commit `d9d252a`; not introduced by C-14). Flagged per SUBAGENT-RULES rule 4(a) — an unrelated issue noticed, not fixed, not required by C-14's steps.
2. `src/app/admin/availability/actions.ts:135` — `deleteAvailabilityRule` is now unreachable from any UI: it is exported and covered only by its own test (`actions.test.ts:146-154`); `AvailabilityRulesManager.tsx` no longer imports it (the old per-row delete UI was replaced by the segments editor in Steps 8-9). Not a live concurrency risk today since nothing calls it, but worth noting for whoever eventually removes dead code — it does not take the new advisory lock, so if it were ever re-wired to a UI it would need the same lock discipline as `save_availability_day` to stay race-safe against the segments save.

---

## Checks I could not run

Everything that requires the migration to actually be applied (which it must not be, per this dispatch's hard constraint):
- The three functions compiling and executing without syntax/runtime error (`CREATE FUNCTION` was never run).
- The POST-APPLY VERIFICATION queries in the migration's own header (`pg_proc` row count, `has_function_privilege` checks, the UI round-trip).
- A live `save_availability_day` / `save_staff_availability_day` RPC call — confirming `adminClient.rpc("save_availability_day", ...)` actually resolves against a real deployed function (currently untestable; `pg_proc` confirms zero matching functions exist yet).
- Any concurrency behaviour under real simultaneous saves (the advisory-lock reasoning is verified analytically against documented Postgres MVCC semantics, not against a live race).
- `pnpm build` (banned for agents; the orchestrator's single end-of-programme build is the only place this runs).
- Playwright/browser verification of the editor UI (not required for this dispatch — no browser needed).

---

**Model:** Sonnet 5 (model id `claude-sonnet-5`), FULL-tier verification.
