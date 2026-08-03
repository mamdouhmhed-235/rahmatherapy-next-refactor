# C-16 Phase A — admin list inventory (Step 1 deliverable)

**Built:** 2026-08-03 at HEAD `74ed6ed` · **Method:** six parallel read-only source lenses (§2.8a fan-out), each covering a disjoint set of surfaces and each instructed to test the 2026-07-16 audit's claims against today's code rather than inherit them.
**Regions found: 69**, across all 32 `/admin/*` pages.

**Detail lives in the six per-area files; this document is the index, the diff against the brief, and the punch list.**

| Area | File | Regions |
|---|---|---|
| Bookings (list, detail, new, series) | `inventory-bookings.md` | 9 |
| Clients + enquiries | `inventory-clients-enquiries.md` | 9 |
| Logs (emails, templates, operations, audit) | `inventory-logs.md` | 6 |
| Privacy, staff, password requests | `inventory-privacy-staff.md` | 13 |
| Roles, services, settings, availability, me | `inventory-roles-config.md` | 15 |
| Dashboard, calendar, reports, search, nav | `inventory-dashboard-calendar.md` | 17 |

**Method deviation, logged:** the plan says this walk is "Playwright-assisted". No agent can authenticate (protocol §3b), so the inventory is derived from source rather than from a browser walk. The deliverable is unchanged — every row cites `file:line` for the actual query, which is stronger evidence than an observed render. Visual confirmation of the roles page at 375/1280 remains genuinely Owner-performed and is the one item that needs a browser.

**Why row counts cannot be used as evidence here.** Production today: bookings 15 · clients 15 · enquiries 3 · email_delivery_events 43 · audit_logs 121 · operational_events 1 · client_privacy_requests 1 · staff_profiles 12 · services 5. The database is pre-launch. **Every unbounded query in this inventory looks perfectly healthy right now.** Every verdict below is reasoned from query shape and the brief's §1.1 five-year projections, never from observed speed.

---

## 1 — Diff against the brief's §1.1 expected table

### 1.1 Confirmed as written

| Surface | Brief said | Verified at HEAD |
|---|---|---|
| bookings list | ALL rows every visit, then in-memory filter | **True** — `bookings-list-data.ts:283-293`, `filterBookings` at `page.tsx:57-202,329` |
| clients list | ALL rows | **True**, and worse — see §1.2 |
| enquiries | ALL rows | **True** — `enquiries-data.ts:121-152`, pagination-ready but unwired |
| emails delivery | newest 100, hard stop | **True** — `emails-data.ts:351-406` |
| operations | newest 300, hard stop | **True** — `operations-data.ts:40,70-103` |
| roles/services/staff | static, fine as data | **True as data.** Roles' *visual* sprawl is real but already largely mitigated — see §1.3 |

### 1.2 Corrections — the brief/audit was wrong or incomplete

1. **⚠️ The audit log is NOT "the one surface done right", and it is not the pattern Phase B can copy.** The brief's central premise for Phase B's cursor mode. At HEAD the shipped UI is a forward-only **append** "Load more" (`AuditLoadMoreButton.tsx:23-45`) with **no Prev control at all** — precisely the unbounded-DOM-growth pattern the brief's own Q9.3 rejects elsewhere. Its cursor is a compound `{created_at,id}` tuple with no backward query support. Day-group headers apply only to the initial SSR page; every Load-More batch renders flat and ungrouped (`AuditLoadMoreButton.tsx:49-65`). **Only `queries.ts`'s internals are DO-NOT-TOUCH — the UI files are not**, so Phase B must decide between true replace-based Prev/Next and today's accumulate-only behaviour, rather than generalising something that already works.
2. **⚠️ The privacy "25-cap" was two different things conflated.** Confirmed against `git show 9b53902^`: the **request queue** (`privacy-data.ts:124-151`) has never carried any bound → `paginate`. The 25 (`PRIVACY_NOTES_LIMIT`, line 44) belongs to the **sensitive-notes rail** (`privacy-data.ts:153-161`), which **silently hides notes past the 25th-newest** with no total and no view-all → `cap+view-all`. Two regions, two verdicts. GDPR-facing.
3. **⚠️ The clients list is `restructure`, not `paginate`.** `clients-list-data.ts:146-151` unconditionally selects **every `bookings` row** on every load — no filter, no limit, and no range parameter exists in `ClientsListParams` at all — to build a client→bookings map, while `clients/page.tsx:50,423-429` layers a 50-row in-memory pager on top that makes the UI look solved. **The map is not reducible to per-page fetching:** lifecycle/payment/source filters, the "last visit" sort and the stats line all run over the *entire* client set before the page slice. Needs an aggregate query or a computed column.
4. **Phase C is smaller than the plan assumes on bookings, and larger on everything else.** C-09 already built `limit`/`offset` params, cache-key inclusion and a `countBookings()` head-count helper — all unit-tested, none called by any page. Wiring plus SQL translation, not building pagination.
5. **Phase C Step 6 is greenfield.** The brief reads as though tab badges exist and need cheaper queries. `BookingsChrome.tsx` renders plain-text nav pills with **no counts at all**. Same for enquiries' tab badges, which additionally scan the full unfiltered table in JS.
6. **The email-templates gallery holds 18 templates, not 16** (file's own header comment). Static either way → `already-correct`.
7. **Admin search is already bounded** — `search-actions.ts` caps `searchBookings` and `searchClients` at `.limit(8)` each, sliced to 12 combined → `already-correct`. The brief's worry does not materialise.
8. **The calendar's date-window bound is real and named:** `RANGE_SOFT_CAP_DAYS = 31` clamps a hand-typed `to` back to month view; month is a fixed 42-cell grid, week 7, day 1. No unbounded path exists → `already-correct`.

### 1.3 Surfaces the brief never listed, found unbounded

| # | Finding | Evidence | Verdict |
|---|---|---|---|
| N1 | **`reporting.ts:getReportData` fetches 8 of its 9 tables with no date filter and no limit** — `booking_assignments`, `booking_items`, `clients`, `enquiries`, `email_delivery_events`, `operational_events` read in full on every render. Only `bookings` is date-bound. Used directly by `calendar-data.ts` and `reports-data.ts`, and mirrored structurally by `dashboard-data.ts`. | `reporting.ts` (Part 0 **untouchable**) | **⛔ see §3 — Owner decision** |
| N2 | `services/page.tsx:118-120` fetches **every row of `booking_items`** (no filter, no limit) to compute per-service usage via in-memory reduce. A static ≤30-row page full-table-scanning a table projected at 10–15k rows. | `services/page.tsx:118-120` | `restructure` (SQL aggregate; nothing to paginate) |
| N3 | `availability/page.tsx:124-131` — `BlockedDatesManager` + `AvailabilityOverridesManager` fetch full tables, no limit, every row rendered inline. 0 rows today (which is what masks it); ~50–150 and ~25–100 over 5 years. | `availability/page.tsx:124-131` | `restructure` / `cap+view-all` |
| N4 | `staff_blocked_dates` + `staff_availability_overrides` on the staff detail availability tab — no query bound at all; full history every render, contained only by a closed-by-default disclosure. | staff detail availability tab | `cap+view-all` |
| N5 | `/admin/account-password-requests` fetches the entire table unbounded, filters 5 status tabs in memory, and is not cache-wrapped (unlike privacy/staff). | `account-password-requests` | `paginate` or `cap+view-all` |
| N6 | Client-detail **per-client notes rail** is completely unbounded — separate from, and not covered by, `PRIVACY_NOTES_LIMIT`. | `client-detail-data.ts:342-350` | `cap+view-all` |
| N7 | Staff detail's assigned-bookings panel caps at 16+8 with a "Show all assignments" link that reaches **upcoming only** — past assignments beyond the cap have no path to them. | staff `[staffId]` detail | `cap+view-all` |
| N8 | Operations has a **second, nested** client-side pager: the 300 fetched rows split into 3 kanban columns, each with its own "Load more" revealing rows already fetched and hidden. | `operations-board.tsx:65-102,296-298,386-399` | folded into Step 11 |

### 1.4 Traps that would ship silently if a `.range()` were added naively

These are not verdicts; they are landmines for Phases C–D, each independently found.

- **C-06's deleted-clients toggle never reaches SQL** — pure in-memory filter. Adding `.range()` to the clients query without pushing `.is("deleted_at", null)` down corrupts page and count math, and `countClients()` already does it correctly, so the two would silently disagree.
- **Enquiries' sort is still a JS pass after fetch** — oldest/name/activity would mis-order across pages the moment the query is bounded.
- **Clients' search is in-memory only** (no `.ilike()` anywhere) — won't compose with a range until moved to SQL. Enquiries' search is already server-side and composes cleanly.
- **`/admin/staff`'s in-memory `q`/workload/onboarding filters** would apply to one page only if a bound were ever added; `team-access.ts:37-47`'s builder type exposes no `.range`/`.limit` at all today, which is what has prevented it.
- **Emails' day-group headers bucket in memory over the fetched set** (`DayGroupedFeed`, `page.tsx:525-534`) — a group split across a page boundary renders as two partial groups. The audit log already exhibits this exact defect live.
- **Bookings' count-query and `.range()`-query WHERE clauses must stay in exact sync** — worst for `search`, which spans bookings, joined clients, and a raw id match. All 11 view predicates ARE expressible in SQL (`payment_status` is a plain scalar column, not derived); the risk is divergence, not expressibility.
- **The therapist-scoped bookings branch merges two `.in(id)` reads in JS**; the code's own comment explains why a naive per-query `.range()` breaks it — the plan's defensive `.limit(200)` call is still correct.
- **The LTV ribbon vs the booking-history rail** on client detail: one needs the whole history, the other wants pagination. One query cannot serve both once bounded.

### 1.5 Three more instances of the "bounded query defeats a wider-window in-memory filter" defect

Same shape as the live bug C-07 A3 fixed. `weekCount` was already logged; these are additional:
- `nextSevenDays` feeding the Business dashboard's header stat, and the same value passed as Coordinator's `weekCount` prop — both silently read "0 in the next 7 days" on the default dashboard view.
- The Therapist "Recent clients · Last 30 days" strip (`getRecentClientsForTherapist`) has **no separate wider-window fetch** backing its 30-day claim, unlike the sibling "open to claim" path that was fixed.

---

## 2 — Consolidated punch list

**`paginate` (7):** bookings list `canViewAll` branch · enquiries list · privacy request queue · emails delivery · operations *(pending the Q9.4 verdict)* · account-password-requests *(or cap+view-all)* · client-detail booking-history rail.

**`restructure` (5):** clients list + client→bookings map (aggregate, not a pager) · services usage counts (N2) · availability blocked-dates + overrides (N3) · enquiries tab badges / at-a-glance stats · bookings chip counts *(greenfield, Step 6)*.

**`cap+view-all` (5):** privacy sensitive-notes rail · client-detail notes rail (N6) · staff blocked-dates/overrides (N4) · staff assigned-bookings past half (N7) · operations *(if the Owner picks cap over pager)*.

**`already-correct` (≈49):** roles list and detail, services catalogue, settings, `/admin/me`, staff directory, calendar (date-window), admin search, nav notifications, dashboard stripes and insights (render-capped), reports rankings (render-capped), bookings detail rails, C-02's series page, email-templates gallery, `/admin/password-reset` (not a list surface at all) — each recorded with its explicit reason, never defaulted, per the Part 0 standing rule.

**Phase E scope reduction:** the roles page's grouping, disclosure and density work **already exists** (tier grouping + inactive `<details>` on the list; category-grouped sticky headers, filter strip, and an internal `max-h-[70vh]` scroll cap on the detail page). Step 13 becomes **verify-and-polish at 375/1280 with screenshots** rather than a rebuild.

---

## 3 — ⛔ Items requiring the Owner's decision at Phase A Step 2

**Q9.4 — the operations verdict (pager vs documented cap).** Evidence gathered: nothing anywhere in the codebase links to a specific operational-event row, so an evicted row is inconvenient, never a broken link. The resolved-column copy ("Stay on the audit log for the record") shows the product already treats operations as a working queue. **But that is only partly true** — the original event detail (`safe_context`) is **not** duplicated into `audit_logs`; only status-transition metadata is. So evicting an old operational event does lose information that exists nowhere else.

**N1 — `reporting.ts` is the largest unbounded read in the system, and the plan forbids touching it.** C-16's entire purpose is "no unbounded list queries", and `getReportData` reads six tables in full on every dashboard, calendar and reports render — including `email_delivery_events`, projected at 50–100k rows within five years. `reporting.ts` is a Part 0 untouchable and is on C-16's own explicit DO-NOT-TOUCH list. This cannot be resolved by an implementer's judgement.

**N2–N7 — six surfaces outside the plan's §2 files-touched list.** The plan's EDITED list does not include `services/page.tsx`, `availability/page.tsx`, the staff detail availability tab, or the client-detail notes rail. Under protocol rule 6b, work required outside a plan's files-touched list is a STOP, not a quiet widening — so these need either explicit inclusion or explicit deferral.
