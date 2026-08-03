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

## 5.1 — Phase C Step 8 — `2f376f9` — tier FULL — **PASS** — clients + enquiries

**Model: `opus`.** Justification: the plan called this "same pattern, simpler" and it is not — the clients surface needed a redesign, not a `.range()`.

**The clients redesign.** `clients-list-data.ts` used to select **every row of `bookings`** to build a client→bookings map, with a 50-row in-memory pager on top making the UI look solved. It now reads a **six-column scalar projection** (`client_id, booking_date, status, total_price, amount_due, amount_paid`, no joins) and reduces it to one summary per client **inside** the cached fetcher — so what crosses the cache boundary and lives in page memory is O(clients), not O(bookings). Only the window's 25 clients are then read in full.

**⚠️ Residual, and it is Owner-actionable, not a defect.** That one query still scans `bookings` server-side. It cannot become a grouped `max()/count()`: **PostgREST aggregates are disabled on this project** — `{"code":"PGRST123","message":"Use of aggregate functions is not allowed"}` — with no view or aggregate RPC available. Both the implementer and the verifier probed the live endpoint independently and got the same refusal. Enabling aggregates, or adding a view / RPC / derived column, is a migration or project-config change, i.e. **Zone-2** — correctly not taken. This is the one thing standing between the clients list and a fully bounded query.

**Count/rows agreement is stronger here than elsewhere:** `total` is the length of the resolved ordered array and `rows` is a slice of that same array (`clients-list-data.ts:930-940`), so they cannot disagree even under concurrent writes.

**The three traps, all closed:** C-06's deleted-clients toggle now reaches SQL (`:443`) so the candidate query, the total and `countClients` finally agree — previously it was an in-memory filter while `countClients` scoped in SQL, i.e. they disagreed; clients' search moved to SQL and composes with the range; and **enquiries' sort moved into the query** with an `id` tiebreak, so page 2 is the tail of the whole order rather than a re-sorted block. Two sort divergences were verified against live schema rather than assumed: `enquiries.updated_at` is `NOT NULL DEFAULT now()` so the old `updated_at ?? created_at` fallback was unreachable, and DB collation is `en_US.UTF-8` (low-risk divergence from `localeCompare`).

Enquiries' badges/stats now issue five head-counts through the shared filter builder, each scoped by the same day bounds as the link it sits on — so a stat can no longer disagree with its own destination. **`getClientsListData` was deleted** (dead after the change; zero live references confirmed) rather than left as an unbounded helper in the tree.

**Sabotage-proven:** removing the `deleted_at` push-down failed 5 clients tests; flipping `oldest` to descending failed 3 enquiries tests including *"page 2 is the tail of the WHOLE order"*.

## 7 — Phase D — Steps 9–12

| Step | Commit | Tier | Result |
|---|---|---|---|
| 9–10 emails + privacy | `dc26dc0` | FULL / TARGETED | **FAIL** → fixed `6faf895` → **PASS** |
| 11–12 operations + password requests | `66e9391` | FULL / TARGETED | **FAIL** → fixed `6fa19ce` → **PASS** |

**Step 9 — emails.** 100-cap → real pager; the placeholder `data-redesign-backend="FAKE"` bar removed; `countEmailDeliveryEvents` taught the same filters as the rows query. **A pre-existing defect had to be fixed for the step to be correct at all:** `resolveDeliveryDateBounds` put **millisecond-precision `Date.now()`** into the `unstable_cache` key, so the delivery feed's cache had **never hit** and minted an entry per request — and once a count query joined the rows query, the two would resolve milliseconds apart and disagree. Bounds are now resolved once per request and floored to a day.

**⚠️ The FAIL: that fix shipped with an off-by-one.** It kept a `- day` offset that no longer belonged, so `"today"` resolved to the start of **yesterday** and the "Today" filter returned ~48 hours — worse than the rolling window it replaced. **The accompanying test was vacuous**: it asserted only that two calls agreed with each other, so it would pass with any wrong-but-stable value. Fixed at `6faf895`: all three ranges now mean "N calendar days up to and including today" (`today` → `todayStart`, 7 days → `-6*day`, 30 → `-29*day`), pinned with `vi.setSystemTime` and hardcoded expected ISO strings, sabotage-proven.

**Step 10 — privacy.** The plan's "25-cap → pager" premise was wrong and Phase A had already corrected it: the **request queue** (never bounded at all, GDPR-facing) got the pager; the **sensitive-notes rail** — where `PRIVACY_NOTES_LIMIT = 25` actually lives — got cap+view-all with the true total surfaced. Stat tiles were independently verified to have moved to **whole-table aggregates**, not page-scoped slices.

**Step 11 — operations.** The Owner's locked verdict (§1 row 1) was honoured: real pager at `LOG_PAGE_SIZE`. `countOperationalEvents` taught the same filters. **The nested per-column "Load more" was removed** — it only ever revealed rows already fetched and hidden, so beside a real server pager it was a second "more" control with different semantics. A `multiPage` prop stops the global-sounding "Nothing open / The clinic is humming" copy appearing when it is only true of the current page.

**Step 12 — password requests.** Was fully unbounded *and* uncached; now capped (100, 500 via view-all), `unstable_cache`d on `[AUDIT, STAFF]`, with a real uncapped total and an exact cap-independent `pendingCount`. Verdict cap+view-all rather than a pager, justified by slow growth, pending self-bounding at 24h, and five tabs each sorting a different column.

**⚠️ The FAIL, and it was the SECOND instance of one defect shape.** The banner computed `hasHiddenRequests = totalCount > rows.length` without distinguishing which cap produced the row count — so in view-all mode above 500 it claimed "100 most recent" while showing 500, and offered a "view all" link pointing at the current URL. **The identical bug had just been fixed on privacy's notes rail two commits earlier**, independently reproduced by a different implementer on a different surface. Fixed at `6fa19ce` as a four-state discriminated union with `cappedOut` evaluated before `hidden`, matching privacy's branch order and its honesty principle. **A shape-level sweep of every admin surface found no third instance** — the shared pager (`clampPage`/`pageRange`/`PaginationBar`) and audit's cursor are structurally immune; the construct existed only on those two surfaces. Independently spot-checked by the re-verifier.

## 7.1 — Process deviation, logged

**Write-pipelining dropped mid-plan.** §2.9(b) permits the next batch's implementation to start once the previous batch's self-gates pass. Twice in Phase D a verify-FAIL arrived while a new implementer was already in flight, forcing a choice between §2.9(b)'s freeze ("no further commits anywhere") and §1 rule 1 ("never two write-tasks in flight", run-ending). Both times it was resolved the same way — let the in-flight agent finish, because killing it mid-write leaves a dirty plan-scope tree that §3's ungraceful-loss rule warns against. Hitting it twice indicated the pipelining was too aggressive for this defect rate, so **from Phase D onward no implementer starts until the previous batch's verification returns.** §2.9 permits what was given up, so this is logged as a deliberate deviation rather than a silent one.

## 8 — Phase E — Steps 13–15

| Step | Commit | Tier | Result |
|---|---|---|---|
| 14 — the five folded-in surfaces | `e822e12` | FULL | **FAIL** → fixed `f27a9da` → **PASS** |
| (Owner-authorised) critical-note widening | `ed9d31b` | TARGETED | narrowed at closeout — see below |
| 13 + 15 — roles verify-and-polish, standing rule | `4a9bef9` | TARGETED | **PASS**, zero code changes |

**Step 14** bounded services usage counts (narrow projection reduced in-cache — a grouped aggregate is impossible, PostgREST aggregates are disabled), clinic and per-staff blocked-dates/overrides, the client notes rail, and the staff assigned-bookings panel. It also fixed a live bug in passing: the "Show all assignments" link emitted `?staffId=`, a param `/admin/bookings` never reads, so it silently showed nothing staff-specific.

**⚠️ Step 14's FAIL was safety-adjacent.** The `sensitiveNotes` list feeding the **"Critical note" allergy-scan banner** was capped at 300 most-recent-first with **no head-count and no signal** — a flagged note beyond the cap would drop out of the scan silently — while in-code comments called that cap "never truncated". Fixed at `f27a9da` by giving the banner **its own query** (an ILIKE keyword superset in SQL, refined by the exact regex in JS), so its correctness no longer depends on any display cap. The rail itself gained a real head-count and the standard `cappedOut` state machine.

**Step 13 changed nothing, correctly.** The roles page's tier grouping, inactive-role disclosure, category-grouped sticky headers, filter strip and internal `max-h-[70vh]` scroll cap already existed and already bounded the page frame; `git log 74ed6ed..HEAD -- src/app/admin/roles/` was empty, so nothing had drifted. Real shape: 5 roles, 39 active permissions in 11 categories, 94 role-permission rows; Owner at 39/39 is the worst case. Deliverable is `redesign/evidence/C-16/roles-visual-checklist.md` for the Owner's 375/1280 pass, which needs a login no agent may perform.

**Step 15 found a real discrepancy.** The standing rule was present and correctly worded but lived in **Part 6**, not Part 0 — while the plan and brief both cite it as "the Part 0 standing rule". A plan following Part 0 would never have seen it. **Fixed at closeout:** the rule is now in Part 0's hard-rules list, with its two C-16 corollaries (a cap is only honest if the true total is surfaced and the cap actually in force is named; a "view all" must never become a dead link — `cappedOut` before `hidden`) and an explicit note of what it knowingly does **not** cover (`reporting.ts`, `audit/queries.ts`).

## 9 — ⚠️ The patient-safety defect, and the mistake made fixing it

`CRITICAL_NOTE_PATTERN`'s trailing `\b` applied to the whole alternation group, so `anaphyla` and `contraindic` matched **only as standalone words** — which they never are. *"severe anaphylactic reaction"* and *"massage contraindicated due to DVT"* did **not** raise the Critical-note banner. Those two branches had been dead since `d7c8d0f`, **before the programme began**, and they are the most clinically specific terms in the list.

Raised to the Owner rather than fixed unilaterally (rule 6a — pre-existing), since widening detection on a clinical pattern is a false-positive judgement the Owner owns. **Owner authorised the fix in chat on 2026-08-03** after the orchestrator confirmed containment: `CRITICAL_NOTE_PATTERN` appears in exactly three files, all already in C-16's approved scope, and **no other C-phase plan or brief mentions it at all**.

**The orchestrator then got the fix shape wrong.** The proposed form dropped the trailing `\b` from *every* branch, and `do not` therefore prefix-matched `"do nothing"`, `"do notice"`, `"do note"` — benign notes tripping a clinical banner. The commit added no blast-radius test. **Caught by the closeout adversarial review**, narrowed at `d22ab37` to `do not\b` — the only branch whose prefix match inverts its meaning. `allerg`, `anaphyla`, `contraindic` keep prefix matching, which was the authorised intent. `avoid` was **considered and deliberately kept** as a prefix: `avoid\b` would stop matching "avoiding the left shoulder" / "avoidance of pressure", and a false negative on a safety banner is the worse failure.

Durable protection: a mechanical guard parses `CRITICAL_NOTE_PATTERN.source` at test time to derive the **live** branch list and asserts each branch is covered by a `CRITICAL_NOTE_KEYWORDS` entry — so the SQL superset can never silently stop covering the regex. Restoring the trailing `\b` fails 15 tests.

## 10 — Closeout gate (2026-08-04, at `d22ab37`)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **5 failed / 1812 passed (1817)** — identity exact (`admin-access` ×2, `ManualBookingForm` ×3) |
| `npx eslint .` | **59E / 7W**, same six files |
| `npx next build` | clean, **53 routes** |
| §3.4 parity spec | **35/35** (grown from the plan's "20-case" text by two hardening rounds) |
| §3.2 no-unbounded-queries | **FAIL → fixed `d22ab37` → PASS** |
| Adversarial full-range review | **FAIL → fixed `d22ab37` → PASS** |
| Bundle budget | **NOT RUN** — tenth plan hit by the same tooling gap |
| §3.3 multi-page proof · §3.5 role sweep | **Owner-performed by necessity** (admin sign-in; no agent may authenticate) |

**The closeout FAIL was substantive and worth the round.** The sweep went beyond the plan's three named files to every `.from(` under `src/app/admin/**` and found that **`/admin/clients`' own core query had no ceiling** — the plan's flagship surface, still reading every matching client row per load — and that the **client-detail booking-history rail** was unbounded despite Phase A verdicting it `paginate` (its helper accepted `limit`/`offset`; the caller never passed them). That second one is a genuine lost step, and it is the orchestrator's: the Step 14 dispatch scoped N6 to the notes rail and asked only that the rail tension be *reported*.

Both fixed at `d22ab37`: the candidate query capped at 1000 (6000 via view-all) with an exact head-count and honest copy — *"Read the first N of M matching clients. The count, the stats and every page here cover only those"* — and the history rail bounded to 50/500 with the **LTV ribbon given its own whole-history read**, so a lifetime figure can never silently become "value of the last 50 visits". A verifier confirmed by direct read that all five lifetime consumers take the uncapped array.

**Why capped rather than paginated:** the lifecycle, payment-standing and last-visit sort derive from a per-client bookings summary computed in memory. Pushing them into SQL needs an aggregate; **PostgREST aggregates are disabled on this project** (`PGRST123`, independently confirmed by four separate agents), `reporting.ts` is untouchable, and a view/RPC/derived column is a migration — Zone-2, which C-16 must not take. Cap+view-all is the standing rule's own second clause, chosen consciously and recorded.

## 11 — Deviations, all logged

1. **Write-pipelining dropped mid-plan** (§7.1 above) — deliberate, after two verify-FAILs collided with in-flight implementers.
2. **⚠️ Phase C Step 8 landed chronologically AFTER Phase D**, contrary to the plan's ordering. The orchestrator went Steps 5→6–7→Phase D and only then noticed Step 8 existed. Caught before Phase E, nothing shipped on top of the gap, and Step 8 was implemented and FULL-verified in full — but it is a real sequencing error, recorded here because it was previously only acknowledged in chat.
3. **Phase A's inventory was source-derived, not Playwright-assisted** as the plan specifies — no agent may authenticate. Every row cites `file:line` for the actual query, which is stronger evidence than an observed render.
4. **Commit cadence finer than §7's table** — the correctness-critical predicate port was isolated in its own commit, and fix rounds took their own.
5. **Bundle gate NOT RUN** (tenth occurrence programme-wide).

## 12 — ▶ Position

**✅ C-16 SHIPPED 2026-08-04 — all five phases, final commit `d22ab37`.** Working tree clean within C-16's scope; the only modification inside `src/` is the standing deliberate `src/lib/maintenance.ts`.

**➡️ INHERITED BASELINE FOR THE NEXT PLAN — BY IDENTITY:**
- tsc → 0 errors · build → clean, 53 routes.
- vitest → failures are exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3. **Judge by identity, never by count** — this programme's recorded counts have drifted repeatedly while the identities stayed exact.
- eslint → 59 errors / 7 warnings confined to exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. **93% of those errors live in an untracked directory** (drift checkpoint #3) — the lint baseline is not reproducible from a fresh clone.
- No expected shrinkage outstanding.

**Outstanding Owner actions from C-16** (all in `OWNER-ACTION-BACKLOG.md`): the §3.5 4-role × 4-viewport sweep · the §3.3 multi-page proof via a temporary `LIST_PAGE_SIZE = 3` override · the roles visual pass at 375/1280 (`roles-visual-checklist.md`) · the `bookings` index migration before real volume arrives · enabling PostgREST aggregates (or a view/RPC) if `/admin/clients` is ever to be truly paginated rather than capped · the remaining unbounded internal id-lookups.

**Next:** plan #17 — **C-17, co-shipping with C-18** (§4: "back to back" means no context reset between them, NOT a merged closeout — each gets its own pre-flight, phase loop, closeout gate, adversarial review and progress file).
