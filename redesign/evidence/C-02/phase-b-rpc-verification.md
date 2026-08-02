# C-02 Phase B — RPC verification evidence

**Date:** 2026-08-02 · **HEAD at capture:** `8ce98f4` · **Method:** SELECT-only `mcp__supabase__execute_sql` against production `twzutkfgqclqurvkmvqz`, run by the orchestrator (protocol §1 rule 2 — no INSERT/UPDATE/DELETE/DDL was issued at any point).

Phase B is a **verification phase, not a code phase.** Its two steps ask for tests of two PL/pgSQL functions that Phase A already applied. Step 4 is discharged here in full and then some; Step 5 cannot be discharged by any agent and is escalated to the Owner — see §5.

---

## 0 — Applied-object identity (drift guard)

Phase A recorded an md5 of the applied `create_recurring_booking_series` so later suspicion could be settled by comparison rather than argument. Re-checked at the top of Phase B:

| Object | Signature args | Returns | md5 of `pg_get_functiondef` | Length |
|---|---|---|---|---|
| `compute_occurrence_dates` | `p_first_date date, p_cadence text, p_horizon_end date, p_end_type text, p_end_count integer, p_end_date date` | `date[]` | `6a395875dced53296f9931b7dcf44b8e` | 1181 |
| `create_recurring_booking_series` | 20 params (9 required, 11 defaulted) | `jsonb` | **`2aefd9d4b0b042eafbc5689b1319343f`** | 11855 |

**The create-RPC md5 and length are byte-identical to Phase A's record.** Nothing has altered the applied function since it landed at `59ccb27`.

Baseline row counts at capture: `recurring_booking_templates` = **0**, `bookings WHERE recurring_template_id IS NOT NULL` = **0**, `bookings` total = **15** — unchanged from Phase A, confirming this phase wrote nothing.

---

## 1 — `compute_occurrence_dates`: exhaustive behaviour (Step 4)

The function is `IMMUTABLE` and pure date arithmetic, so it can be verified exhaustively rather than sampled. Every result below is a live query result, not a prediction.

### 1.1 — Occurrence counts are anchor-independent

Replayed across **all 366 first-dates of 2026** × 3 cadences, with the shipped horizon convention (`horizon = first + 12*7 − 1`):

| Cadence | Anchors tested | min | max | First date ≠ anchor | Longest span (days) |
|---|---|---|---|---|---|
| weekly | 366 | **12** | **12** | 0 | 77 |
| fortnightly | 366 | **6** | **6** | 0 | 70 |
| monthly | 366 | **3** | **3** | 0 | 62 |

**min = max on every row**, so the counts are a property of the function, not of a lucky anchor. This independently reconfirms Phase A's 12 · 6 · 3 finding and its conclusion that the old header's "monthly yields 4" was never true.

### 1.2 — End-condition semantics

Anchor `2026-09-04` (a Friday), horizon `2026-11-26`:

| Scenario | Result | Reading |
|---|---|---|
| `after_count = 5`, weekly | 5 dates → `09-04, 09-11, 09-18, 09-25, 10-02` | count wins when below the horizon batch |
| `after_count = 30`, weekly | **12** dates | **horizon truncates the count** — the remainder is the cron's job, not an error |
| `after_count = 6`, fortnightly | 6 dates → `09-04 … 11-13` | matches the plan's own named case |
| `until_date = +30d` | 5 dates | end date wins when inside the horizon |
| `until_date = +400d` | **12** dates | horizon wins when the end date is beyond it |
| `until_date` exactly on an occurrence (+28d) | includes that date | **`until_date` is INCLUSIVE** |
| `until_date` before the first date | `{}` (empty) | returns empty, does not raise |
| `after_count = 0` | empty | returns empty, does not raise |
| invalid cadence | raises `Invalid cadence: %` | guard works |

Both "returns empty" cases matter: an empty occurrence set is **not** an error at this level. It is caught one layer up — `create_recurring_booking_series` raises `That cadence and end condition produce no visits` (§2), so no template can be created with zero visits.

### 1.3 — Why the ≤28 day-of-month CHECK exists, demonstrated

The loop advances iteratively (`v_dt := v_dt + interval`), not from a fixed origin, so once Postgres clamps a month-end the anchor day is **permanently lost**:

| First date | Result |
|---|---|
| `2026-12-28` (day 28 — the maximum allowed) | `2026-12-28, 2027-01-28, 2027-02-28` — anchor day held |
| `2026-01-31` (day 31 — rejected upstream) | `2026-01-31, 2026-02-28, **2026-03-28**` — drifts to day 28 and never returns to 31 |

This is concrete justification for the RPC's `Monthly recurrence requires a day between 1 and 28` guard, and it confirms the plan's Step-4 case 3 resolution ("compute is pure; the RPC rejects").

### 1.4 — Reconciling the plan's "~14"

Plan Step 4's first case (`first=2026-05-29, horizon=2026-08-29`) returns **14**, exactly as the plan predicted. That does not contradict the 12 above: 14 is what a 92-day horizon yields, while the shipped convention is `anchor + 83`, which yields 12 for the same anchor. Both are correct for their own horizon; only the horizon convention changed in Phase A. Recorded so a future reader does not "fix" one into the other.

---

## 2 — `create_recurring_booking_series`: contract (Step 5, static portion)

### 2.1 — Caller guard, verified live

```
IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION '... may only be called with the service role' USING errcode = '42501';
```

Probed live with deliberately triple-invalid arguments (non-service-role caller, all-zero client id, past first date). Result:

```
ERROR: 42501: create_recurring_booking_series may only be called with the service role
CONTEXT: PL/pgSQL function create_recurring_booking_series(...) line 32 at RAISE
```

Two consequences, both load-bearing:
1. **The security control works.** `anon` and `authenticated` cannot reach it, matching Phase A's REVOKE verification.
2. **`execute_sql` runs as `postgres`, not `service_role`**, so this RPC is *structurally incapable* of writing anything through the orchestrator's SQL path — the guard fires on line 32, before any validation and long before any INSERT. That is what made the probe above safe to run, and it is also why Step 5 cannot be discharged from here (§5).

### 2.2 — Validation surface: 21 guarded failure paths

Enumerated from the applied definition, in execution order:

| # | Condition | Errcode |
|---|---|---|
| 1 | caller is not `service_role` | 42501 |
| 2 | no first occurrence date | — |
| 3 | no start time | — |
| 4 | participant gender / required therapist gender missing | — |
| 5 | invalid cadence | — |
| 6 | invalid end type | — |
| 7 | horizon < 1 week | — |
| 8 | `after_count` without a positive count | — |
| 9 | `until_date` without an end date | — |
| 10 | end date before first occurrence | — |
| 11 | first occurrence in the past | — |
| 12 | monthly anchor outside 1–28 | — |
| 13 | service not available | P0002 |
| 14 | `allow_recurrence` false for that service | — |
| 15 | service unsuitable for the participant (gender restrictions) | — |
| 16 | booking would not finish the same day | — |
| 17 | client missing **or soft-deleted** | P0002 |
| 18 | client has no name | P0001 |
| 19 | client has no phone | P0001 |
| 20 | acting staff profile missing | P0002 |
| 21 | bound therapist missing / inactive / gender mismatch | P0002 + 2 plain |
| 22 | cadence + end condition produce **no visits** | — |

Note #17 carries the `deleted_at IS NULL` guard added in Phase A (defect 5), and #15 enforces `services.gender_restrictions` — validation the brief's original sketch performed nowhere.

### 2.3 — Write surface: 6 tables, in order

`recurring_booking_templates` → `bookings` → `booking_participants` → `booking_items` → `booking_assignments` → `audit_logs`.

This matches Step 5's assertion list exactly (template row, bookings with `recurring_template_id` + `booking_source='recurring'`, one participant row, per-service items, assignments, and a `recurring_series_created` audit row). What is **not** verified is that each write carries the right *values* — that requires executing it (§5).

---

## 3 — ⚠️ Phase G cron trap: numerically demonstrated

Progress file §1.4 warned that Plan Step 19 and brief §2.5 both sketch resuming the horizon walk from `horizon_through_date`. Proven wrong here with live numbers, weekly series anchored `2026-09-04` (Friday):

| Quantity | Value |
|---|---|
| Anchor | `2026-09-04` (**Fri**) |
| `horizon_through_date` | `2026-11-26` |
| Last occurrence of the first batch | `2026-11-20` |
| **Horizon overshoots the last real occurrence by** | **6 days** |
| Extension if resumed from the horizon (**the trap**) | `2026-11-26` — a **Thu** |
| Extension walked from the anchor (**correct**) | `2026-11-27` — a **Fri** |

Every extended visit would land on the wrong weekday, permanently, and the duplicate check keyed on `(client, date, start_time)` cannot catch it because the dates genuinely differ. There is no error anywhere — the series simply drifts a day at the first extension and stays drifted.

**Binding instruction for Phase G: walk from the series anchor (or `max(booking_date)` of the series), never from `horizon_through_date`.**

---

## 4 — Why Phase B ships no code

Three independently-verified facts settle plan §9.2's open question ("vitest-against-DB OR pure mock — decide at impl time"):

1. **No vitest spec in this codebase talks to a real database or network.** Every one of ~40 Supabase-touching specs injects a hand-built stub. The only live-credential test surface is Playwright E2E, a different runner that `vitest.config.ts` explicitly excludes.
2. **Vitest never loads `.env`.** There is no `setupFiles`, no `dotenv`, no `loadEnv`. A DB-backed spec would have to load production credentials itself and would be the first ever to do so.
3. **Step 4's literal suggestion — "call the function via `mcp__supabase__execute_sql` from a vitest spec" — is not implementable.** MCP tools exist only in the agent harness, not in a Node test process. Committing such a spec would also make every future `pnpm test` depend on live production access, which protocol §1 rule 2 forbids as a standing dependency.

A "pure mock" test of `compute_occurrence_dates` would test a TypeScript re-implementation, not the deployed function — weaker than what §1 above achieves, plus a new divergence hazard. Phase E was checked for a client-side occurrence preview that might justify such a mirror; it has none (`RecurringSectionProps` carries no count).

**Conclusion: the strongest available verification of a pure, immutable SQL function is exhaustive SQL replay, which §1 performs.** Phase B therefore closes with evidence rather than a spec, and the plan's cadence-table commit 2 is a documentation commit.

---

## 5 — ⛔ Step 5 NOT RUN — escalated to the Owner

Step 5 asks for a live integration test that creates a template plus 12 bookings and asserts their contents. **This has not been run and must not be recorded as passing.**

It cannot be discharged by any agent:

- Through `execute_sql` it is impossible — the `service_role` guard rejects the call (§2.1).
- Through the real client it requires the production service-role key and would write **1 template + 12 bookings + 12 participants + 12 items + 12 assignments + 1 audit row into the live database** — a Zone-2 data mutation under protocol §1 rule 2, orchestrator-only and per-action approved.

Three routes are open, for the Owner to choose:

| Route | Cost | Verdict |
|---|---|---|
| **(a) Defer to the Owner UI sweep** | none now | Matches programme precedent — every role sweep is Owner-performed because agents cannot authenticate. The series-creation path gets exercised for real at Phase I, through the admin form, which also covers Phases C/E in one pass. |
| **(b) Supabase dev branch** | a real branch, cost-bearing, Zone-2 | The only way to run Step 5 *as written* with zero production impact: a real Postgres with the migration applied, where 12 test bookings cost nothing and pollute nothing. |
| **(c) Approve production writes on test fixtures** | live rows to clean up afterwards | Plan §6 supplies the cleanup SQL, but it leaves cancelled test bookings in a 15-booking production table permanently. |

**Recommendation: (a)**, with (b) if the Owner wants Step 5 discharged literally. Route (a) loses nothing that Phase I does not already cover, and §2 above pins the RPC's contract statically in the meantime.

---

## 6 — Phase B verdict

| Step | Status |
|---|---|
| Step 4 — `compute_occurrence_dates` | ✅ **COMPLETE, exceeded** — exhaustive replay over 366 anchors × 3 cadences plus 10 end-condition edge cases, versus the plan's 3 sampled cases |
| Step 5 — `create_recurring_booking_series` integration | ⛔ **NOT RUN** — agent-impossible; contract verified statically (§2); Owner decision required (§5) |
| Drift guard | ✅ applied function md5-identical to Phase A |
| Phase G trap | ✅ re-proven numerically (§3) |
| Writes issued | **none** — row counts unchanged (0 / 0 / 15) |
