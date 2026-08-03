# C-16 — §3 verification gate — closeout (static gates + unbounded-query sweep)

**VERDICT: FAIL**

Run at HEAD `4a9bef9` (master), read-only, by a gate-runner subagent. Every command below was actually executed in this repo; no result is inferred or assumed.

**Why FAIL, precisely:** §3.1 (tsc/vitest/eslint/build) and §3.4 (parity spec) all pass, matching the inherited baseline exactly by identity. §3.2 — "the gate that matters most for this plan" per dispatch — does **not** pass: the sweep below found multiple list-backed queries under `src/app/admin/**` that carry neither `.range(` nor a justified `.limit(`, outside the three exclusions the Owner has already ruled on. Two are load-bearing: the `/admin/clients` list's own core candidate query, and the client-detail page's booking-history rail — both squarely inside this plan's stated purpose. §3.1's bundle sub-check is honestly recorded as NOT RUN (script cannot answer the question), not counted toward the verdict either way. §3.3/§3.5 are Owner-performed by necessity per SUBAGENT-RULES rule 10, not run by this agent, not counted toward the verdict.

---

## §3.1 — Static gates

### 1. `npx tsc --noEmit`

Exit 0. **0 errors**, 0 output lines. Matches inherited baseline exactly.

### 2. `npx vitest run`

Exit 1 (expected — baseline carries known failures).

```
 Test Files  2 failed | 186 passed (188)
      Tests  5 failed | 1760 passed (1765)
```

Failures, by file and title (all five, verbatim):

- `src/lib/auth/admin-access.test.ts`
  1. `admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated`
  2. `admin access matrix > gives Admin broad operational access without role template management`
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx`
  3. `ManualBookingForm > renders step 1 on first load`
  4. `ManualBookingForm > moves focus to the first invalid field when continuing with errors`
  5. `ManualBookingForm > shows the consent error when trying to create booking without consent`

**Matches the inherited baseline exactly by identity** — same two files, same five titles, same 2+3 split. No swapped-in new failure. PASS by identity.

### 3. `npx eslint .`

Exit 1 (expected — baseline carries known lint debt).

```
✖ 66 problems (59 errors, 7 warnings)
```

Per-file breakdown (computed by isolating real problem lines from ESLint's react-compiler codeframe restatements, which otherwise double as false "file header" lines in a naive line count):

| File | Errors | Warnings |
|---|---|---|
| `design_handoff_area_pages/prototype/area-page.jsx` | 48 | 1 |
| `design_handoff_area_pages/prototype/shared.jsx` | 2 | 5 |
| `design_handoff_area_pages/prototype/site-chrome.jsx` | 5 | 0 |
| `src/features/booking/BookingExperience.tsx` | 3 | 0 |
| `src/features/booking/BookingExperienceLoader.tsx` | 1 | 0 |
| `src/features/booking/utils/returning-customer.ts` | 0 | 1 |
| **Total** | **59** | **7** |

**Matches the inherited baseline exactly** — 59E/7W confined to exactly these six files, no others. PASS by identity.

### 4. `npx next build`

Exit 0. Clean.

```
✓ Compiled successfully in 10.5s
✓ Completed runAfterProductionCompile in 1450ms
  Finished TypeScript in 21.3s ...
✓ Generating static pages using 23 workers (52/52) in 588ms
```

Route table reports **53 routes** total (pages + API routes; static ○, SSG ● with `generateStaticParams`, dynamic ƒ) — one middleware/proxy warning only ("middleware" convention deprecated in favour of "proxy", pre-existing, not a build error). PASS — clean build.

### 5. Bundle budget — `node scripts/measure-admin-bundles.mjs`

Ran successfully (exit 0), output captured in full. **The script cannot answer C-16's own §3.1 question ("+4 kB shared, ~net-zero per page") and is recorded as NOT RUN for that purpose, per instruction.**

Confirmed limitation, by inspection of `scripts/measure-admin-bundles.mjs`'s hardcoded `ROUTES` list (line 31):

```
/admin/dashboard, /admin/reports, /admin/clients/[clientId],
/admin/staff/[staffId], /admin/me, /admin/staff/[staffId]/performance
```

**None** of C-16's actually-touched pages appear in this list — not `/admin/bookings`, not `/admin/clients` (the list page — only the `[clientId]` detail route is measured), not `/admin/enquiries`, `/admin/emails`, `/admin/privacy`, `/admin/operations`, or `/admin/roles`. The script's only baseline (`redesign/baselines/bundle-pre-B1.json`, captured 2026-05-24 at `d2e6512`) predates Band B entirely, so every `delta_vs_pre_B1_kb` figure it does report (23.61 kB dashboard, 21.7 kB reports, 2.32 kB `clients/[clientId]`, 1.4 kB `staff/[staffId]`) is cumulative drift since Band B across many plans, not attributable to C-16 specifically — consistent with the drift-checkpoint-#3 finding cited in the dispatch. **What it CAN measure as an absolute:** shared baseline chunk is 7 chunks / 571,248 raw bytes / 173,726 gzip bytes (169.65 kB) at this HEAD — a real number, just not one that isolates C-16's contribution. Recorded as **NOT RUN** for the plan's actual question; not scored as pass or fail.

---

## §3.2 — No-unbounded-queries sweep (the decisive gate)

### Plan's own three-file grep

```
grep -rn "from(\"bookings\")\|from(\"clients\")\|from(\"enquiries\")" src/app/admin/bookings/page.tsx src/app/admin/clients/page.tsx src/app/admin/enquiries/page.tsx
```

**Zero matches.** Expected and correct — C-09 already extracted these three pages' queries into dedicated `*-data.ts` helpers (`bookings-list-data.ts`, `clients-list-data.ts`, `enquiries-data.ts`), so the plan's literal three-file grep finds nothing by construction. The real check has to follow the queries into those helpers, done below.

### Full sweep table

Every `.from(` call found under `src/app/admin/**` that plausibly backs a rendered list, with its bound status. "Downstream-capped" means the query itself is unbounded but everything it produces feeds into a later `.in("id", …)` fetch that IS capped.

| # | Query | File:line | Bound | Notes |
|---|---|---|---|---|
| 1 | `bookings` (canViewAll path) | `bookings-list-data.ts:698` | `.range(` (when `limit` set) | `getBookingsListPage` always passes `limit`/`offset` — production-bound. |
| 2 | `bookings` (assigned branch) | `bookings-list-data.ts:720` | `.limit(SCOPED_BRANCH_ROW_CAP)` (200) | Justified — code comment: "one person's live work can't legitimately approach this." |
| 3 | `bookings` (claimable branch) | `bookings-list-data.ts:734` | `.limit(SCOPED_BRANCH_ROW_CAP)` (200) | Same justification. |
| 4 | `bookings` (count, head) | `bookings-list-data.ts:786` | head-count, no rows | Fine by construction. |
| 5 | `clients` (search-by-needle id lookup) | `bookings-list-data.ts:819` | `.limit(SEARCH_CLIENT_ID_CAP)` | Bounded. |
| 6 | `booking_assignments` (`assignedRows`, one staff's own assignments) | `bookings-list-data.ts:518` | **NEITHER** | Feeds `scopedIds.assignedIds`, itself unbounded, but the downstream `bookings` fetch by those ids IS capped at 200 (#2). The id-lookup itself has no cap — for a very long-tenured therapist this table read grows with their full assignment history. |
| 7 | `booking_assignments` (`claimableRows`, clinic-wide unassigned + gender + future-dated) | `bookings-list-data.ts:530` | **NEITHER** | Not staff-scoped — grows with clinic-wide claimable volume. Downstream `bookings` fetch is capped (#3), but this id-lookup is not. |
| 8 | `enquiries` (list) | `enquiries-data.ts:270` | `.range(` (when `limit` set) | `getEnquiriesListPage` always passes `limit`/`offset` — production-bound. |
| 9 | `enquiries` (count, head) | `enquiries-data.ts:330` | head-count | Fine. |
| 10 | `clients` (candidate list — **the core `/admin/clients` query**) | `clients-list-data.ts:633` (`getClientCandidates`) | **NEITHER** | **Load-bearing finding.** Reads every `clients` row matching the SQL-expressible predicate plan, ordered, with no `.range()`, `.limit()`, or defensive cap of any kind. Feeds `total`, sort, and the page-window slice for `/admin/clients` itself — this is C-16's own primary target page. Architecturally explained (needs the full filtered set to apply in-memory lifecycle/payment narrowing before an accurate total+slice), but the file's own header comment only justifies why `bookings` isn't `.range()`'d — it never justifies the absence of a ceiling on `clients` itself, unlike the bookings scoped-practitioner path which got an explicit 200-cap + comment for the analogous problem. |
| 11 | `clients` (page-window rows, by id) | `clients-list-data.ts:666` | `.in("id", ids)` where `ids` is already page-sliced | Bounded by construction (≤ page size). |
| 12 | `bookings` (page-window rows, by client ids) | `clients-list-data.ts:671` | `.in("id", ids)` | Bounded by construction. |
| 13 | `clients` (count, head) | `clients-list-data.ts:699` | head-count | Fine. |
| 14 | `bookings` (`getClientBookingSummaries`, six-column projection) | `clients-list-data.ts:603` | **NEITHER — known, deliberate exclusion** | See exclusions below. |
| 15 | `operational_events` (list) | `operations-data.ts:129` | `.range(` | Bounded (page.tsx passes `pageSize={LOG_PAGE_SIZE}`). |
| 16 | `email_delivery_events` (list) | `emails-data.ts:476` | `.range(` | Bounded (page.tsx passes `limit: PAGE_SIZE`). |
| 17 | `client_privacy_requests` (list) | `privacy-data.ts:189` | `.range(` (when `limit` set) | page.tsx passes `pageSize={LIST_PAGE_SIZE}` — bound. |
| 18 | `client_notes` (sensitive rail) | `privacy-data.ts:207` | `.limit(PRIVACY_NOTES_LIMIT / VIEW_ALL_CAP)` | Bounded, cap+view-all. |
| 19 | `account_password_requests` (list) | `password-requests-data.ts:108` | `.limit(limit)` | Bounded — cap+view-all pattern (`PASSWORD_REQUESTS_LIMIT`/`_VIEW_ALL_CAP`). |
| 20 | `client_notes` (client-detail, regular rail) | `client-detail-data.ts:485` | `.limit(regularCap)` | Bounded. |
| 21 | `client_notes` (client-detail, sensitive rail) | `client-detail-data.ts:504` | `.limit(sensitiveCap)` | Bounded. |
| 22 | `client_notes` (client-detail, critical/keyword rail) | `client-detail-data.ts:527` | `.limit(CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP)` | Bounded (N6, fixed). |
| 23 | `bookings` (client-detail booking-history rail, no-assignment path) | `client-detail-data.ts:400` | **NEITHER, in practice** | `limit`/`offset` params exist and gate a `.range()` call (line 408), but the only caller — `clients/[clientId]/page.tsx:339` — never passes them. Every client-detail render reads that client's ENTIRE booking history, unbounded, with no defensive cap. Not listed in the Owner-approved N2–N7 amendment; not one of the three named exclusions. A long-tenured weekly client accumulates exactly the kind of row count this plan's own methodology projects as a growth risk. |
| 24 | `bookings` (client-detail booking-history rail, assigned-only path) | `client-detail-data.ts:435` | **NEITHER, in practice** | Same gap as #23, on the therapist-scoped variant; also gated by the unpassed `limit`/`offset` (line 443). |
| 25 | `booking_assignments` (client-detail RBAC assignment check) | `client-detail-data.ts:422` | **NEITHER** | Reads one staff member's entire assignment history to build an id-membership set; downstream `bookings` fetch (#24) is filtered `.in("id", …)` by this set but not independently capped. |
| 26 | `client_privacy_requests` (client-detail rail) | `client-detail-data.ts:562` | **NEITHER** | All privacy requests for one client — likely small in practice (most clients: 0–1), but no cap exists. |
| 27 | `audit_logs` (client-detail rail) | `client-detail-data.ts:576` | `.limit(10)` | Bounded. |
| 28 | `bookings` (count, head) | `client-detail-data.ts:628` | head-count | Fine. |
| 29 | `audit_logs` (audit page, cursor reference) | `audit/queries.ts:104` | `.limit(AUDIT_PAGE_SIZE)` | Bounded — DO-NOT-TOUCH reference implementation, untouched, correctly bounded. |
| 30 | `booking_items` (services usage count) | `services-data.ts:68` | **NEITHER — known, deliberate exclusion** | Same PGRST123 pattern as #14; see exclusions below. Self-documented in the file's own header (finding N2). |
| 31 | `services` (services page listing) | `services/page.tsx:113` | none | Small reference table (~5 rows today); static-class per brief, not a pagination candidate. |
| 32 | `blocked_dates` / `availability_overrides` (upcoming/past/week buckets, ×6 queries) | `availability/page.tsx:170–231` | `.limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP / PAST_CAP / PAST_VIEW_ALL_CAP)`, plus a naturally-≤7-row week query | Bounded (N3, fixed) — restructure + defensive caps as verdicted. |
| 33 | `bookings` (availability page capacity scan: all future, non-cancelled) | `availability/page.tsx:262` | **NEITHER** | Reads every future non-cancelled booking (`select("booking_date")` only) to compute weekly capacity coverage. Narrow projection, but no cap — grows with future booking volume, which includes recurring-series horizons extended by the cron job. |
| 34 | `staff_availability_rules` / `staff_blocked_dates` / `staff_availability_overrides` (`select staff_id` only, per-staff indicator) | `availability/page.tsx:244–246` | **NEITHER** | Reads whole tables to build a "which staff have custom entries" set. Narrow single-column projection; low severity given current row counts, but no ceiling. |
| 35 | `staff_blocked_dates` / `staff_availability_overrides` (per-staff, upcoming/past/week) | `staff/[staffId]/availability/page.tsx:129–195` | `.limit(STAFF_AVAILABILITY_*_CAP)` | Bounded (N4, fixed). |
| 36 | `booking_assignments` (staff-detail assigned-bookings panel) | `staff-detail-data.ts:235` | `.limit(assignmentLimit)` (default `STAFF_DETAIL_ASSIGNMENT_LIMIT`) | Bounded (N7) — query itself passes the sweep's test; whether the "Show all" affordance fully reaches past assignments is a UX-completeness question outside this query-boundedness check. |
| 37 | `audit_logs` (staff-detail rail) | `staff-detail-data.ts:253` | `.limit(auditLimit)` | Bounded. |
| 38 | `roles`, `permissions`, `role_permissions`, `staff_profiles` (roles pages) | `roles/page.tsx:119`, `roles/[roleId]/page.tsx:84,94,100,104` | none | Small fixed-cardinality reference tables (role/permission catalogue is closed-set, not user-growth-driven). Correctly out of scope — Phase E restructure (density/disclosure), never pagination, matches plan intent. |
| 39 | `nav-notifications.ts` (×8 id-lookup queries) | `nav-notifications.ts:151,160,178,196,209,327,341,350` | `.limit(10)` each | Bounded, but **no `ORDER BY` before `LIMIT`** on at least two — already logged as a known, non-blocking soft risk in the progress file (§2, "Logged, not fixed"); not re-litigated here. |

### Named exclusions — confirmed real, reported as excluded not failures

1. **`reporting.ts`'s unfiltered reads (Owner ruling, N1 — "log, do not touch").** Confirmed by inspection: `reporting.ts`'s `getReportData` makes 10 `.from(` calls; only the `audit_logs` one (line 1562, `.limit(limit)`) is bounded. The other nine — `bookings`, `booking_assignments`, `booking_items`, `clients`, `staff_profiles`, `staff_availability_rules`, `enquiries`, `email_delivery_events`, `operational_events` — carry no filter/limit at all. **This exclusion, by the Owner's own recorded language ("no date filter and no limit on every dashboard/calendar/reports render"), extends to the parallel query sets in `dashboard-data.ts`** (`/admin/dashboard`; independently confirmed: `booking_assignments` ×3, `bookings`, `clients`, `staff_profiles`, `staff_availability_rules`, `enquiries`, `email_delivery_events`, `operational_events` — all unbounded except the date-range-filtered `getBookings`) **and `calendar-data.ts`** (`/admin/calendar`; 2 `.from(` calls, 0 bounded) — the three surfaces the Owner's own ruling text names together. Not re-litigated as new findings; recorded here so a reader doesn't conclude they were missed.
2. **`audit/queries.ts`** — the cursor reference implementation. Confirmed bounded (`.limit(AUDIT_PAGE_SIZE)`, item #29 above) and untouched — on C-16's DO-NOT-TOUCH list, correctly left alone.
3. **`clients-list-data.ts`'s `getClientBookingSummaries`** (item #14, six-column `bookings` projection). Confirmed unbounded by design: header comment (lines 43–50) states plainly it "still scans `bookings` server-side" because PostgREST aggregate functions are disabled on this project (`PGRST123 "Use of aggregate functions is not allowed"`), independently confirmed per the file's own comment. Bounded in what it *transfers and caches* — reduced to O(clients) inside the cached fetcher before crossing into page memory — but the underlying table scan is real. Reported as the known residual, not a miss. **A third, identically-shaped instance exists and is self-documented the same way:** `services-data.ts`'s `booking_items` scan (item #30) — same PGRST123 justification, same narrow-projection-reduced-in-cache shape, explicitly written up in that file's own header as finding N2's residual.

### What this sweep found beyond the three named exclusions

Items **#6, #7, #10, #23, #24, #25, #26, #33, #34** carry neither `.range(` nor a justified `.limit(`, and are **not** covered by any Owner ruling or the plan's amended scope (N2–N7). Of these, **#10** (the `/admin/clients` list's own core candidate query) and **#23/#24** (the client-detail page's booking-history rail, gated by parameters the only caller never passes) are the most material — both are list-backed, both sit inside pages this plan explicitly rewired, and neither carries even a defensive cap of the kind applied everywhere else in this codebase (e.g. `SCOPED_BRANCH_ROW_CAP`, `AVAILABILITY_UPCOMING_DEFENSIVE_CAP`). The rest (#6, #7, #25 — internal id-lookups whose final row output IS capped downstream; #26, #33, #34 — narrow-projection or currently-small-table reads) are lower severity but still fail the sweep's literal test and are named per the dispatch's instruction to name every query carrying neither.

---

## §3.4 — Correctness parity

```
npx vitest run src/app/admin/bookings/__tests__/view-predicates-parity.test.ts
 Test Files  1 passed (1)
      Tests  35 passed (35)
```

**35/35 passing.** Note: the plan's own text (§1 Step 5, §3.4) describes this as a "20-case fixture set." The dispatch flags that the spec was hardened by two post-verification fix rounds after four views were found whose fixtures couldn't distinguish the shipped predicate from a strictly weaker one — the observed 35 is consistent with that hardening, not a discrepancy to chase. Hard gate: PASS.

---

## What was NOT run, and why

- **§3.1 bundle ceiling** ("+4 kB shared, ~net-zero per page"): the measurement script ran (exit 0) but its route list contains none of C-16's touched pages and its only baseline predates Band B. Recorded as **NOT RUN** for the question the plan actually asks; not scored as pass or fail. This is the ninth plan recorded as unable to answer its own bundle question with this script (per the dispatch).
- **§3.3 — Multi-page behaviour via temporary `LIST_PAGE_SIZE = 3` override**: requires a live dev session and admin sign-in to walk Prev/Next, clamp, and filter-reset behaviour interactively. **No agent may authenticate** (SUBAGENT-RULES rule 10). **Owner-performed by necessity** — not pending, not passed, not run by this agent.
- **§3.5 — 4-role × 4-viewport sweep + roles before/after screenshots**: same constraint — requires admin sign-in as each of four role logins. **Owner-performed by necessity** — not pending, not passed, not run by this agent. (Evidence directory `redesign/evidence/C-16/screenshots-c-16/` was not inspected as part of this closeout; its presence or absence doesn't change this gate's status since the walk itself cannot be re-run by a subagent.)

No check in this report was claimed without being actually executed and its real output captured.

---

*Generated by a read-only gate-runner subagent per `redesign/plans/C-phase/SUBAGENT-RULES.md`. Only write: this file.*
