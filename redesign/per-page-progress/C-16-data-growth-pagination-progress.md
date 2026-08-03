# C-16 — Data growth: pagination standard + bounded lists — PROGRESS

**Plan:** `redesign/plans/C-phase/C-16-data-growth-pagination-plan.md`
**Brief:** `redesign/briefs/C-16-data-growth-pagination-brief.md`
**Programme:** Band C, C-C implementation — plan **#16 of 22** (§4 order).
**Predecessor:** C-07, final commit `f038b4f` (closeout `435472a`); drift checkpoint #3 `74ed6ed`.
**Dependencies:** C-05, C-06, C-09 — all shipped and verified present at pre-flight.
**Migration:** none. C-16 is not among the ledger's 9 migration-bearing plans. **No Zone-2 actions.**

---

## 0 — Pre-flight (2026-08-03, at `74ed6ed`)

- `git branch --show-current` → `master`. `git merge-base --is-ancestor ea97932 HEAD` → exit 0. ✅
- `git status --porcelain` over all nine of the plan's named paths → **empty**. ✅ The wider tree is intentionally dirty (241 deleted `.playwright-mcp/*`, 17 deleted `design_handoff_public_pages/*`, untracked design/photo dirs) and `src/lib/maintenance.ts` carries the standing Owner-owned change — never staged.
- Dependency commits confirmed for C-05, C-06, C-09. ✅
- **Inherited baseline — BY IDENTITY** (supersedes the plan's own §0/§3.1 text, which is a plan-writing-time snapshot from 2026-07-16 naming a 6th `createBookingTransaction` failure that C-06 fixed): tsc **0 errors** · vitest failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 · eslint **59E/7W** in exactly six files · build clean. Independently re-measured at `435472a` by two separate agents during drift checkpoint #3.
- **Row-count baseline (SELECT-only, 2026-08-03):** bookings 15 · clients 15 · enquiries 3 · email_delivery_events 43 · audit_logs 121 · operational_events 1 · client_privacy_requests 1 · staff_profiles 12 · services 5. **The database is pre-launch — every unbounded query in this plan's scope looks healthy today.** Every verdict is reasoned from query shape, never from observed speed. The plan's §3.3 approach (prove multi-page behaviour with a temporary page-size-3 override, never by seeding production) is therefore the only workable one — confirmed rather than assumed.

**Verification tiers, declared in advance per §2.9c:**

| Phase | Tier | Why |
|---|---|---|
| A — inventory | FULL | Every later phase derives from it; a wrong verdict propagates silently. |
| B — shared primitives | FULL | Clamp/range math is off-by-one territory and every surface consumes it. |
| C Steps 5–7 — bookings | FULL | Mandatory: shared file + correctness parity against an in-memory oracle. |
| C Step 8 — clients/enquiries | FULL | Same query-shape change class; several named traps. |
| D Step 9 — emails | FULL | Date-group headers + C-08's Resend buttons interact with the page boundary. |
| D Steps 10, 12 | TARGETED | Mechanical cap→pager. |
| D Step 11 — operations | FULL | Verdict-gated (see §1). |
| E Steps 13–15 | TARGETED | Density/disclosure + bookkeeping. |

**Model routing (§5):** C-16 is a `sonnet` plan. **Exception — Phase C Steps 5–7 route to `opus`:** translating 11 view predicates into SQL against an in-memory oracle, keeping a count-query and a range-query's WHERE clauses in exact sync, is a correctness-critical semantic port where a silent mismatch shows staff the wrong bookings. All verifiers and reviewers `sonnet`.

---

## 1 — ⛔ Phase A Step 2 — HARD-STOP user checkpoint: **ANSWERED 2026-08-03**

The plan requires the Phase A inventory and the Q9.4 operations verdict to be confirmed by the Owner in chat before Phase C, and **Step 11 explicitly refuses to re-decide the operations verdict if this record is missing.** All four questions were put in chat and answered. Recorded here for Step 11's use.

| # | Question | **Owner's answer (2026-08-03)** |
|---|---|---|
| 1 | **Q9.4 — operations: pager or documented cap?** | **PAGER at 100/page (LOG_PAGE_SIZE).** Decisive evidence: nothing in the codebase links to a specific operational-event row (every `/admin/operations` reference was grepped), so eviction never breaks a link — **but the original event detail (`safe_context`) is NOT duplicated into `audit_logs`**, only status-transition metadata is. Today's 300-row cap therefore destroys the only copy of older event detail. Step 11 implements a pager; it does not re-decide. |
| 2 | **`reporting.ts` (finding N1) — grant a Part 0 exception?** | **NO — log it, do not touch.** `getReportData` reads 6 of 9 tables with no date filter and no limit on every dashboard/calendar/reports render, including `email_delivery_events` (50–100k rows projected). It is genuinely load-bearing across three surfaces and a mistake there costs more than the current zero-and-slow-growing cost. **C-16 must NOT claim "no unbounded list queries" without naming this exclusion** — see §2. |
| 3 | **Six unbounded surfaces outside the plan's §2 files-touched list (N2–N7)** | **FOLD ALL SIX INTO C-16.** Rationale accepted: C-16 establishes the standing Part 0 rule every later plan will cite, so shipping it with six known-unbounded surfaces excluded would undercut the rule at the moment it is set. This is an **Owner-approved extension of the plan's files-touched list** — recorded here so it is not later read as scope creep. See §2 for the amended list. |
| 4 | **Punch list confirmation + Phase E scope** | **CONFIRMED. Phase E Step 13 = verify-and-polish, not rebuild.** The roles page's tier grouping, inactive-role `<details>` disclosure, category-grouped sticky headers, filter strip and internal `max-h-[70vh]` scroll cap already exist and already bound the page frame. Step 13 verifies at 375/1280 with before/after screenshots instead of re-deriving them. |

---

## 2 — Amended scope (Owner-approved at the Step 2 checkpoint)

**Added to the plan's §2 files-touched list** under decision 3 above:

| Surface | Finding | Verdict |
|---|---|---|
| `src/app/admin/services/page.tsx` | N2 — fetches **every row of `booking_items`** (no filter, no limit) to compute per-service usage via in-memory reduce; `booking_items` scales with bookings (10–15k projected) | `restructure` — SQL aggregate. Nothing to paginate. |
| `src/app/admin/availability/page.tsx` | N3 — `BlockedDatesManager` + `AvailabilityOverridesManager` fetch full tables, render every row inline; 0 rows today, ~50–150 and ~25–100 over 5 years | `restructure` / `cap+view-all` |
| staff `[staffId]` availability tab | N4 — `staff_blocked_dates` + `staff_availability_overrides`, no query bound at all | `cap+view-all` |
| `src/app/admin/account-password-requests` | N5 — entire table unbounded, 5 status tabs filtered in memory, not cache-wrapped | `paginate` or `cap+view-all` |
| client-detail notes rail (`client-detail-data.ts:342-350`) | N6 — completely unbounded; **separate from** `PRIVACY_NOTES_LIMIT`, which bounds a different rail | `cap+view-all` |
| staff `[staffId]` assigned-bookings panel | N7 — caps at 16+8 with a "Show all assignments" link reaching **upcoming only**; past assignments beyond the cap have no path | `cap+view-all` |

**Explicit exclusion that must be stated wherever C-16's standing rule is cited:** `reporting.ts`'s unfiltered reads (N1) are **knowingly out of scope** by Owner decision. The Part 0 rule as C-16 establishes it covers list *surfaces*; it does not yet cover the shared reporting aggregate layer. Recording this prevents a future reader from concluding the sweep was exhaustive when it was deliberately not.

**Logged, not fixed (rule 6a) — surfaced by the inventory, outside even the amended scope:**
- **The audit log's UI has the unbounded-DOM defect the brief attributes to everything else.** `AuditLoadMoreButton.tsx` is a forward-only *append* control with no Prev, and day-group headers apply only to the initial SSR page — every Load-More batch renders flat. `audit/queries.ts` internals are DO-NOT-TOUCH and the audit UI files are not on the files-touched list, so C-16 leaves it. **Phase B must therefore design `PaginationBar`'s cursor mode from the plan's spec (`{prevHref?, nextHref?}`, no total), NOT by copying the shipped audit UI** — the brief's premise that audit is the working reference is wrong.
- Three further instances of the "bounded query defeats a wider-window in-memory filter" defect C-07 A3 fixed: `nextSevenDays` feeding the Business dashboard header stat and Coordinator's `weekCount` prop (both silently read "0 in the next 7 days" on the default view), and the Therapist "Recent clients · Last 30 days" strip, which has no wider-window fetch backing its 30-day claim.
- Two nav-notification id-lookup queries lack `ORDER BY` before `LIMIT` — soft growth risk, not a confirmed defect.

---

## 3 — Phase A

| Step | Commit | Result |
|---|---|---|
| 1 — inventory (69 regions, 32 pages) | `437c186` | Built by six parallel read-only source lenses (§2.8a). **8 audit/brief premises corrected**, 8 unlisted unbounded surfaces found. Deliverable: `redesign/evidence/C-16/c-16-list-inventory.md` + six per-area files. |
| 2 — ⛔ user checkpoint | (this file) | **ANSWERED** — §1 above. |

**Method deviation, logged:** the plan specifies a "Playwright-assisted" walk. No agent can authenticate (§3b), so the inventory was derived from source. Each row cites `file:line` for the actual query, which is stronger evidence than an observed render. The one item genuinely needing a browser — visual confirmation of the roles page at 375/1280 — is Owner-performed and carried into Phase E Step 13.

---

## 3.1 — Second Owner scope decision (2026-08-03): component files

Raised at Phase C Step 6 and answered in chat. The plan's files-touched list names **pages** (`bookings/page.tsx`, `operations/page.tsx`, `roles/page.tsx` …), but several of the lists it must fix render in **sibling component files the list never mentions** — the page/component split post-dates the plan's July authorship. Under rule 6b each would have been its own blocking stop.

**Owner ruling: grant the extension once.** The files-touched list is read as covering each named page **plus the component files that render that page's lists**. Every such file is logged here explicitly so the diff stays auditable and this is never mistaken for scope creep:

| Component file | Why | Step |
|---|---|---|
| `src/app/admin/bookings/BookingsChrome.tsx` | renders the view chips Step 6 adds counts to; also owns C-07's saved views, which must not re-apply a stale `?page=` | C Step 6–7 |
| `src/app/admin/operations/operations-board.tsx` | owns the nested per-column "Load more" that Step 11's server pager replaces | D Step 11 |
| (further files as Phases D–E reach them — each appended to this table before it is touched) | | |

## 4 — Phase B (Steps 3–4) — `080279b` — tier FULL — **PASS**

`src/lib/pagination.ts` (`LIST_PAGE_SIZE` 25, `LOG_PAGE_SIZE` 100 — confirmed byte-equal to the existing `AUDIT_PAGE_SIZE` at `audit/queries.ts:12` — `PaginatedResult<T>`, `clampPage`, `pageRange`) + `src/app/admin/components/PaginationBar.tsx`, each with a co-located spec. 28 tests. No surface consumes them yet, by design.

The generic `paginateListQuery` wrapper was **deliberately not built** — the plan is explicit that Supabase builders don't compose generically without type loss. Its absence is correct; its presence would have been the defect.

**Verification re-derived the arithmetic independently rather than reading the tests.** `clampPage` was hand-traced for `undefined`, `null`, `"0"`, `"-3"`, `"abc"`, `"1e9"`, `"2.7"`, `0`, over-range values and `pageCount = 0`, then cross-checked by executing the function body standalone: **no input yields `0`, `NaN`, or a value above `pageCount`**. `pageRange` confirmed as `to = from + pageSize - 1`, matching Supabase's inclusive-both-ends `.range()` — the off-by-one that would silently fetch an extra row per page. Report: `redesign/evidence/C-16/phase-b-verify-full.md`.

**Non-blocking finding, recorded:** `pagination.test.ts:37-46`'s "never returns 0 when pageCount itself is 0" test pre-floors `pageCount` to 1 in its own body, so it never exercises the code's own defence. A coverage gap, not a behavioural one — the implementation was verified correct directly.

**Cursor mode was designed from the plan's spec, not copied from the audit log** — per §2's logged finding that the shipped audit UI is a forward-only append control with no Prev. It renders nothing when both hrefs are absent, the cursor equivalent of the offset mode's `pageCount <= 1` rule.

**Model:** implementer `sonnet`, verifier `sonnet` (routine new-file work against an explicit spec).

## 5 — Phase C Step 5 — `ca0cc21` — tier FULL — bookings view predicates into SQL

**Model: `opus`.** Justification (§5 capability routing): translating 11 view predicates into SQL against an in-memory oracle, while keeping a count query and a range query's WHERE clauses in exact agreement, is a correctness-critical semantic port where a silent mismatch shows staff the wrong bookings.

`buildBookingPredicatePlan` (`bookings-list-data.ts:270-390`) covers all 11 views, with the C-05 archive rule (`status not.in.(cancelled,no_show)`) applied ahead of every view unless the view is `cancelled`/`all`/`series` or the operator explicitly picked a cancelled status. `filterBookings` **stays** as the semantic oracle and still serves the therapist-scoped path.

**Divergence between the count and range queries was made structurally impossible, not merely tested.** One `BookingPredicateContext` — including a snapshot of the resolved search client-ids, so the two queries cannot race on it — is resolved once by `getBookingsListPage` and passed to both `getBookingsListData` and `countBookings`; `applyBookingPredicates` is the only code that consumes a predicate step, so there is no second place a predicate can be written. The context reaches **both** cache keys via `cacheKeyPart`, JSON-safe throughout (strings, booleans, `string[]` — no `Set`/`Map`/`Date`).

**Four distinct embed aliases, not one**, because two filters sharing a PostgREST alias must both hold on the *same* joined row. `view=assigned` combined with `assigned_staff=<someone else>` is the case that proves it, pinned as parity case 23.

**The parity spec was sabotage-tested, and the fifth sabotage found a hole in the spec itself.** Dropping claimable's gender match, breaking the C-05 archive opt-in, collapsing `assigned_staff` onto the view's alias, and removing the joined-client search arm each failed the spec as they should. But removing `status != completed` from `upcoming` **passed** — every completed fixture was also past-dated, so the date clause masked the missing clause. A future-dated completed fixture (B14) was added and the sabotage now fails. **That gap would have shipped undetected**, and it is the reason sabotage-testing a parity spec is worth more than reading its green output.

**Two pinned narrowings vs the oracle**, both inherent to SQL, both pinned as failing-if-changed tests rather than left silent:
1. **Partial booking-id search no longer matches.** Postgres has no `uuid ILIKE text` and PostgREST rejects `id::text` in a filter — both errors verified directly against the live project. `audit/queries.ts:129-134` hit the same wall and answered it identically with full-UUID equality. **⚠️ Note the booking detail page renders a *short* id (`#3C0E12AB`, `[bookingId]/page.tsx:1269`), so a pasted short id is the realistic loser.** Raised to the Owner in chat at Step 5's close.
2. A search or location term straddling two fields' boundary in the oracle's `join(" ")` no longer matches.

**Also recorded:** `getSearchClientIds` caps the client-id lookup at 200 — a search matching more clients under-matches on the joined-client arm only, since the booking's own `contact_*` snapshot columns still match. `.order("id")` was added as a tiebreak per plan §4's stable-sort mitigation, required for correct offset paging. The therapist-scoped branch kept its in-memory merge and took the prescribed defensive `.limit(200)` per branch; its `.in("id", ids)` list is still unbounded, which is pre-existing (C-09) and a URL-length risk rather than a row-count one.

**Interim state, by design and now closed by Steps 6–7:** between `ca0cc21` and Step 7, `getBookingsListPage` defaults to `LIST_PAGE_SIZE` with `offset: 0`, so the clinic-wide list shows at most 25 rows with no pager. Invisible at today's 15 bookings.

---

## 6 — ▶ Position

Phase A ✅ · Phase B ✅ (`080279b`, verified) · Phase C Step 5 ✅ (`ca0cc21`, verification in flight) · **Steps 6–7 in flight** (`opus` — chip counts must reuse Step 5's predicate builder or they silently lie; saved views must not re-apply a stale `page`). Then Phase D (Steps 9–12, operations = **pager**, per §1) and Phase E (Steps 13–15, Step 13 reduced to verify-and-polish).

**Cadence note:** the plan's §7 table makes all of Phase C bookings one commit. It is landing as two (`ca0cc21` Step 5, then Steps 6–7) — finer-grained than the table, deliberately, so the correctness-critical predicate port is isolated in its own reviewable commit.
