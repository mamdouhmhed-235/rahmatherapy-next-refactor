# C-16 Phase C Step 8 — verification (tier FULL)

**VERDICT: PASS**

Commit verified: `2f376f9910902950751352c1784c45d8945bc0989` — "feat(redesign): C-16 Phase C Step 8 — clients aggregate + pager, enquiries server sort + pager". Verified read-only against `master` via `git show`/`git diff`, plus a read-only REST probe against the live Supabase project and `information_schema`/`pg_database` SELECTs. No writes were made anywhere except this file. No `checkout`/`stash`/`switch`/`restore` used.

---

## Check 1 — the central claim (aggregate design + stats scoping)

**Confirmed correct in every part.**

1. **Projection is genuinely narrow.** `SUMMARY_BOOKING_SELECT` (`clients-list-data.ts:165-166`) = `"client_id, booking_date, status, total_price, amount_due, amount_paid"` — exactly six scalar columns, no joins, no `booking_items(...)` embed, no contact fields. Matches the commit message's claim precisely.

2. **Reduction is genuinely inside the cached fetcher.** `getClientBookingSummaries` (`clients-list-data.ts:597-612`):
   ```ts
   const cached = unstable_cache(async (): Promise<ClientBookingSummaryIndex> => {
     const { data } = await createSupabaseAdminClient().from("bookings")
       .select(SUMMARY_BOOKING_SELECT).returns<SummarisableBooking[]>();
     return summariseClientBookings(data ?? [], today);   // <-- reduced INSIDE the callback
   }, [...], { revalidate: 60, tags: [TAGS.BOOKINGS] });
   ```
   `summariseClientBookings` runs inside the `unstable_cache` callback, so the raw booking rows never leave the callback; only the reduced `Record<clientId, ClientBookingSummary>` (O(clients)) is cached and returned. A reduction placed after `cached()` returned would have put O(bookings) back into cache/page memory — that is not what happens here. Failure scenario this rules out: at the brief's 5-year projection (~10-15k bookings), a misplaced reduction would mean every request carries ~15k full/partial rows through the cache layer instead of a few thousand summary records.

3. **PostgREST aggregates are independently confirmed disabled.** I made a live, read-only GET request against the project's REST endpoint (service-role key, `select=count()` on `bookings`):
   ```
   GET https://twzutkfgqclqurvkmvqz.supabase.co/rest/v1/bookings?select=count()
   → HTTP 400
   → {"code":"PGRST123","details":null,"hint":null,"message":"Use of aggregate functions is not allowed"}
   ```
   This is the exact code and message cited in the file header (`clients-list-data.ts:46-47`). A normal head-count request (`Prefer: count=exact`) on the same table succeeded (200, `Content-Range: 0-14/15`), confirming the failure is specific to aggregate functions, not a broader auth/permissions problem. **The claim is accurate: a true grouped `max()`/`count()` is not available on this project without a migration/view/RPC**, so the residual (a full scalar scan of `bookings`, reduced server-side) is a legitimate, disclosed trade-off, not an oversight. I did not find a workaround they missed.

4. **No `Set`/`Map`/`Date` crosses `unstable_cache`.** `ClientBookingSummaryIndex` is a plain `Record` (`clients-list-data.ts:199`, tested at `clients-list-data.test.ts:109-112` — `JSON.parse(JSON.stringify(index))` round-trips). `uniqueIds()` (`clients-list-data.ts:467-473`) builds a `Set` internally but returns `Array.from(seen)` — the `Set` never crosses the boundary. `today` is a caller-supplied `YYYY-MM-DD` string (`ClientListContext.today`), never a `Date`. Confirmed by reading every `unstable_cache`-wrapped function in the file.

5. **Stats are correctly NOT page-scoped, and I confirmed what they describe.** In `getClientsListPage` (`clients-list-data.ts:861-958`), `scopeContext` (869-875) carries only `includeDeleted`/`sort`/`today`/`canViewContactDetails` — none of `q`/`lifecycle`/`payment`/`location`/`source`. `scopePlan` is built from that (879-882), and `roster` (895-898) is either the same array as `candidates` (when the two plans produce an identical WHERE clause, compared via `cacheKeyPart` equality) or a second query issued with the narrowing filters stripped. `stats: computeLifecycleStats(roster, ...)` (956) and `totalInScope: roster.length` (954) are therefore always computed over "current deleted-scope, before search/lifecycle/payment/location/source" — exactly as documented, and exercised by the test `"computes the stats over the deleted-scope, not over the filtered result"` (`clients-list-page.test.ts:364-384`), which asserts `searched.stats` (with `q: "Bilal"` narrowing to 1 result) equals `unfiltered.stats`. Failure scenario this rules out: a stats line reading "5 active clients" while the page shows 1-of-10 filtered rows — the defect class this step exists to remove.

---

## Check 2 — commit scope

`git show 2f376f9 --stat`: exactly the nine files named in the dispatch, nothing else.
`git diff --stat 2f376f9~1 2f376f9 -- src/app/admin/account-password-requests src/app/admin/bookings src/app/admin/emails src/app/admin/privacy src/app/admin/operations src/lib/pagination.ts src/app/admin/components/PaginationBar.tsx` → empty output (no changes).
`git diff --stat 2f376f9~1 2f376f9 -- "src/app/admin/clients"` → only the 5 expected clients files; `clients/[clientId]/**` untouched.
**PASS** — no out-of-scope files, no collision with the concurrently-edited `account-password-requests/**`.

---

## Check 3 — `getClientsListData` deletion

`grep -rn "getClientsListData"` across the tree returns 4 hits, all documentation/comments, zero live code:
- `clients-list-data.test.ts` (a comment noting the fetch "no longer exists")
- `redesign/per-page-progress/OWNER-ACTION-BACKLOG.md`, `redesign/evidence/C-16/inventory-clients-enquiries.md`, `redesign/plans/C-phase/C-09-cache-invalidation-filter-cleanup-plan.md` — historical planning docs.

No import, no call site anywhere in `src/`. `clients/page.tsx`'s import list (`page.tsx:19-25`) only pulls `clientListContextFromQuery`/`getClientsListPage`/types from `./clients-list-data` — the old entry point is gone from both the module and every caller. Behaviour is relocated, not lost: every derivation the old function provided (lifecycle, visit counts, outstanding balance, search/filter, sort, paging) is now produced by `getClientsListPage` and its helpers, which the test suite exercises directly (`clients-list-page.test.ts`, 547 lines). **PASS.**

---

## Check 4 — count/rows agreement

**Clients.** `clients-list-data.ts:909-913`:
```ts
const total = selected.length;
const pageCount = Math.max(1, Math.ceil(total / pageSize));
const page = clampPage(params.page, pageCount);
const { from, to } = pageRange(page, pageSize);
const pageIds = selected.slice(from, to + 1).map((candidate) => candidate.id);
```
`total` is `selected.length` and `pageIds` is sliced from that same `selected` array — confirmed exactly as claimed (dispatch cited `:930-940`; current file has this at `:909-913` — re-located by content, not by the stale line number, per SUBAGENT-RULES §7's principle). They cannot disagree by construction, including under concurrent writes between the candidate read and the page-rows read, because both numbers come from one already-materialised array, not two separate queries.

**Enquiries.** `applyEnquiryFilters` (`enquiries-data.ts:169-199`) is the single WHERE-clause writer. `getEnquiriesPageData` (250-310) and `countEnquiries` (320-344) both run it. `getEnquiriesListPage` (356-382) calls `countEnquiries(filters)` first, clamps `page` against the real `pageCount`, then calls `getEnquiriesPageData` with the same `filters` plus `limit`/`offset`. Confirmed by the test `"sends the count query the same predicates as the row query"` (`enquiries-list-page.test.ts:316-325`), which asserts `predicateCalls(countQuery())` deep-equals `predicateCalls(rowQuery())`. **PASS.**

---

## Check 5 — Trap 1: deleted-clients toggle reaches SQL

`buildClientPredicatePlan` (`clients-list-data.ts:495-548`), step 1 (501-502):
```ts
if (!context.includeDeleted) steps.push({ op: "isNull", column: "deleted_at" });
```
(Dispatch cited `:443` — that line is inside `getBookingLocationClientIds` in the current file; the toggle predicate itself is at `:501-502`. Re-located by symbol, not by the stale line number.)

This plan feeds the one candidate query (`getClientCandidates`, 626-646) via `applyClientPredicates`. `countClients` (694-710) applies the identical `.is("deleted_at", null)` rule independently but consistently. Verified both states with the test group `"the deleted-clients toggle reaches SQL"` (`clients-list-page.test.ts:271-317`):
- toggle off: `is("deleted_at", null)` is sent, `total`=10, all 10 live clients, `deletedCount`=2.
- toggle on: no `is` predicate sent, `total`=12 (10 live + 2 deleted), `c11` (a deleted id) is present in the rows.
- head-counts (`countClients(true)`/`countClients(false)`) agree with the candidate query's scope in both cases.

This is precisely the bug being fixed: before this step, `deleted_at` was a pure in-memory `.filter()` never reaching SQL while `countClients` already scoped in SQL — the two could disagree (e.g. a stale/optimistic UI reading a total that didn't reflect the in-memory filter). Now all three (candidate query, `total`, `countClients`) draw from the same predicate. **PASS.**

---

## Check 6 — Trap 2: clients' search moved to SQL, composes with the range

`buildClientPredicatePlan` step 2 (506-517) pushes an `.or(...)` on `full_name`/`phone`/`email` (permission-gated) into the same plan the candidate query runs. Confirmed by test `"a search narrowing to 3 is ONE page, not an empty page 2"` (`clients-list-page.test.ts:388-399`): `q: "trio"` narrows 10 candidates to 3, `page: "2"` is requested, and the result clamps to `page: 1` with all 3 rows — not an empty page 2. This works because `total`/`pageCount` are recomputed from the narrowed `selected` array before `clampPage` runs, so a stale `?page=2` from a wider unfiltered view cannot survive a search that shrinks the result set. **PASS.**

---

## Check 7 — Trap 3: enquiries' sort is globally correct (the subtle one)

`applyEnquirySort` (`enquiries-data.ts:228-248`) puts all four orders (`oldest`/`name`/`activity`/default-`newest`) into the query builder, and **every branch ends with `.order("id", {...})`** as a tiebreak — confirmed by reading all four `case`s.

**Global-order proof.** Test `"oldest-first page 2 is the tail of the WHOLE order, not a re-sorted block"` (`enquiries-list-page.test.ts:228-247`) uses a 30-row fixture and asserts oldest-first page 2 (rows 26-30) is the five **newest** rows overall — the correct tail of a globally-ordered set — and explicitly notes what the bug would have produced instead (`e05…e01`, a re-sorted second block of a newest-first fetch). This is exactly the trap the dispatch describes, and the test is constructed to distinguish the two outcomes rather than merely checking in-page order. **PASS.**

**`id` tiebreak against duplicate-row-across-pages.** Every sort branch appends `.order("id", {ascending: matches primary direction})`, so two rows sharing the primary sort value (e.g. two enquiries with the same `created_at` second) get a total, stable order — a row cannot land on both page N and page N+1 because the ORDER BY is now a total order, not merely a partial one. I did not find a scenario in the fixtures/tests exercising a genuine primary-key tie, but the mechanism (`id` as a universally-unique, monotonic secondary key on every branch) is structurally sufficient — PostgREST/Postgres will not reorder ties across two separately-issued `.range()` calls once the ORDER BY is total.

**`activity` / `updated_at` fallback.** Independently confirmed via `information_schema`:
```sql
SELECT column_name, is_nullable, column_default FROM information_schema.columns
WHERE table_name='enquiries' AND column_name IN ('updated_at','created_at');
→ updated_at: is_nullable=NO, column_default=now()
```
`updated_at` is indeed `NOT NULL DEFAULT now()`, so the old `updated_at ?? created_at` JS fallback was unreachable — moving to `order("updated_at", ...)` alone changes nothing observable. **Confirmed independently, matches the implementer's claim exactly.**

**`name` / collation.** Independently confirmed the database's collation: `datcollate = "en_US.UTF-8"` (via `pg_database`). This is a locale-aware collation (not byte-order `C`), so for ASCII/English-alphabet names it produces materially the same order as `localeCompare(…, {sensitivity:"base"})`. It can differ from the old JS comparator on accented characters or on case-adjacent ties (locale collation and `sensitivity:"base"` don't handle case/diacritics identically in all edge cases). For this clinic's realistic name set this is a low-risk, disclosed behavioural change, not a defect — judged acceptable.

---

## Check 8 — enquiries badges/stats cannot disagree with their destination

`getEnquiryOverviewCounts` (`enquiries-data.ts:411-432`) issues five `countEnquiries(...)` calls (all `count:"exact",head:true` through `applyEnquiryFilters`), and `page.tsx`'s `AtAGlanceStrip`/tab-badge links (`page.tsx:744-796`, `327-361`) build their `href`s from the *same* `todayPresetRange`/`weekPresetRange`/`monthPresetRange` values passed into `getEnquiryOverviewCounts` (`page.tsx:202-215`). Both the stat and its link are built from one shared day-bound object per range, so they cannot diverge. Confirmed further by the test `"asks for counts, never rows, and scopes each one like its own link"` (`enquiries-list-page.test.ts:406-425`), which checks all 5 queries are `head:true` (no rows transferred) and the counts match the fixture's known distribution. **PASS.**

---

## Check 9 — page-param behaviour, both surfaces

**Clients** (`clients-list-data.ts` + `page.tsx`): `clampPage` (`pagination.ts`) clamps a stale `page` against the real `pageCount` — confirmed by test `"clamps a stale ?page=99 to the last page"` (`clients-list-page.test.ts:428-437`, clamps to page 3) and `"clamps junk, zero and absent to page 1"` (439-448, for `"0"`, `"-4"`, `"abc"`, `undefined`). I enumerated every href builder in `clients/page.tsx` (629-738): `buildClearLinkHref`, `buildSortHref`, `buildFilterHref`, `buildShowDeletedHref` all rebuild from `filterValues` (203-211), which carries no `page` key — `buildPageHref` is the *only* one that writes `page`, and only for `next > 1` (712). The two GET filter forms (desktop 364-426, mobile 245-305) have no `page` field, so a form submit also resets to page 1. Pager-renders-nothing-at-one-page confirmed by `clients-page-param.test.tsx:76-89`. Page size confirmed moved from the old hardcoded `PAGE_SIZE = 50` (pre-commit, `git show 2f376f9~1:.../page.tsx:50`) to `LIST_PAGE_SIZE` = 25 (`pagination.ts:7`).

**Enquiries** (`enquiries-data.ts` + `page.tsx`): `buildEnquiryUrlParams` (`page.tsx:98-111`) is the canonical query-string builder and structurally never reads `params.page` — confirmed by reading the function body (it destructures `tab`/`source`/`assigned_staff`/`from`/`to`/`q`/`sort` only) and by test `"drops ?page= while keeping every filter that narrows the list"` (`enquiries-page-param.test.tsx:40-61`, which passes `page:"7"` into the input and asserts it does not survive). `buildEnquiryPageHref` (114-123) is the only writer, dropping `page` for `page<=1`. The sort-select client component also resets page on change — confirmed by `"pushes a URL with the new sort and no page, from a page-3 request"` (`enquiries-page-param.test.tsx:90-104`). Pager-renders-nothing-at-one-page confirmed at `enquiries-page-param.test.tsx:106-119`.

**PASS on both surfaces** — I found no href-building path on either page that carries a stale `page` value.

---

## Check 10 — test-stand-in faithfulness (highest-risk item, judged carefully)

Two distinct stand-ins exist and they are **not equally faithful** — this matters for how much weight each test file's passing carries:

1. **`src/lib/cache/__tests__/fake-supabase-admin.ts`** (used by `clients-list-data.test.ts`) is a pure passthrough: every filter/order/range method returns `this` unconditionally, and `.then()` always resolves to one fixed registered result regardless of what predicates were built. This mock is **vacuous for row-selection correctness** — it would pass even if every predicate were deleted. However, I checked what `clients-list-data.test.ts` actually asserts against it, and every assertion is either a pure-function unit test (`summariseClientBookings`, `clientLifecycle`, `clientListContextFromQuery`) or a **cache call-count** assertion (`createSupabaseAdminClient` called N times) — never a row-selection assertion. Used this way, the passthrough mock's lack of teeth is not a problem; it's the right tool for what it's testing.

2. **The stand-ins in `clients-list-page.test.ts` and `enquiries-list-page.test.ts`** (defined locally in each file, not shared) are materially more faithful: they record every `.is/.in/.eq/.or/.not/.gte/.lte/.order/.range` call per query and *replay* them against a fixture table (`applyRecorded`/`matchesOrArm`/`splitOrArms`) — actually filtering, actually sorting (stable, respecting recorded `.order()` direction and precedence), actually slicing on `.range()`. I traced this logic by hand against the fixtures (12 clients / 8 bookings; 30 enquiries) and it correctly reproduces PostgREST semantics for the specific operators this code emits (confirmed the `or()` arm parser matches the exact `col.ilike."%x%"` / `col.eq."x"` / `id.in.(a,b)` shapes `buildClientPredicatePlan`/`applyEnquiryFilters` actually produce — not a generic PostgREST grammar, but sufficient for what's under test). This is a genuine, non-vacuous fixture DB — a predicate or order that stops reaching the query changes what these tests observe.

**Mutation-style corroboration (analytical, not executed — read-only constraints forbid editing source to run this live):**
- **Enquiries — "flip `oldest` to descending".** I manually traced which assertions in `enquiries-list-page.test.ts` depend on `oldest` being ascending: (a) `"oldest-first page 2 is the tail of the WHOLE order"` (228) — would observe `e05…e01` instead of `e26…e30`, FAILS; (b) `"puts the order in the query, ahead of the window"` (302) — asserts `args: ["created_at", {ascending: true}]` literally, FAILS; (c) `"search composes with paging"` (341) — both `q:"trio"` and `q:"person28@"` sub-assertions use `sort:"oldest"` and assert specific row-id order, FAILS. `"clamps a stale ?page=99"` (368) also uses `sort:"oldest"` but only asserts `page`/row-count, not order — unaffected. **That is exactly 3 failing tests**, matching the implementer's reported "3 enquiries tests failed" precisely.
- **Clients — "remove the `deleted_at` push-down"** (i.e., delete `clients-list-data.ts:501-502`'s `if` block entirely, so deleted clients leak into every result unconditionally). Tracing through `clients-list-page.test.ts`'s 15 `it` blocks by hand, I found **4** that would definitely fail: `"scopes the candidate query, and the total and the rows agree with it"` (272, the `is` assertion + total=10 assertion), `"computes the stats over the deleted-scope, not over the filtered result"` (364, `totalInScope`/`atRiskLapsed` would shift), `"clamps a stale ?page=99 to the last page"` (428, page 3 would gain 2 extra rows), and `"selects by payment standing from the summed balance"` (462, `good.total` would be 11 not 9, since the two deleted fixture clients carry no bookings and so read as in-good-standing). I could not independently reproduce the reported 5th failure without actually running the mutation, which I did not do (read-only scope forbids editing `clients-list-data.ts`, even temporarily). **This is a partial, not a full, corroboration** — the direction and magnitude (multiple tests break, not zero) is confirmed; the exact count is not.

**Judgement:** the parity/page-level test files are non-vacuous and have real teeth against the two named regression classes; the simpler cache-behaviour file uses a vacuous mock but only for assertions where that's appropriate. Net: the test design is sound. Flagging the unreproduced 5th-failure count as a minor, disclosed gap rather than a blocking finding — it doesn't change the conclusion that the toggle's SQL push-down is well-covered.

---

## Check 11 — code rules

- **`border-l-4`:** none in any of the 4 non-test changed files (`clients-list-data.ts`, `clients/page.tsx`, `enquiries-data.ts`, `enquiries/page.tsx`).
- **`updateTag` not `revalidateTag`:** no `revalidateTag` anywhere in `src/app/admin/clients` or `src/app/admin/enquiries`. Existing `updateTag(...)` calls (in `actions.ts`, untouched by this commit) are pre-existing and correct.
- **`createSupabaseAdminClient()` only after `getStaffProfile()`:** neither `page.tsx` calls `createSupabaseAdminClient` directly — both call it only inside the data-layer (`clients-list-data.ts`/`enquiries-data.ts`), which is invoked from `page.tsx` only after `getStaffProfile()` (clients: `page.tsx:117` then access checks, then `getClientsListPage` at 157; enquiries: `page.tsx:159` then access check, then `getEnquiriesListPage` at 209).
- **No new hardcoded `oklch(...)`:** `git show 2f376f9 -- src/app/admin/clients/page.tsx src/app/admin/enquiries/page.tsx` filtered to added lines (`^+`) containing `oklch(` returned nothing new.
- **`Set`/`Map`/`Date` never cross `unstable_cache`:** re-confirmed under Check 1.4 above.
- **Clean at 375px:** **not independently verified live** — this dispatch did not include admin login credentials, and SUBAGENT-RULES §10 forbids inventing accounts, so I could not authenticate to load `/admin/clients` or `/admin/enquiries` in a browser. As a partial substitute I reviewed the JSX structurally: both pages already use mobile-first patterns consistent with the rest of the admin surface (`AdminSheet` bottom-drawer for filters on `<lg`/`<md`, `overflow-x-auto` + scroll-fade mask on the enquiries tab strip, `min-w-0`/`truncate` throughout). `clients/page.tsx:307-312` carries an explicit comment describing and fixing a 375px overflow bug (`grid-cols-[minmax(0,1fr)]` pinning the track so the sticky bulk-action bar doesn't push past the right edge) — evidence the implementer did consider this viewport, but I have not rendered the page myself to confirm the fix works. **Flagging as unverified, not failed.**

---

## Check 12 — static gates

**`npx tsc --noEmit`** → clean, 0 errors.

**`npx vitest run`** → tail:
```
Test Files  2 failed | 183 passed (185)
     Tests  5 failed | 1682 passed (1687)
```
Failing tests, by identity:
```
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
**Exact identity match to the inherited baseline** (`admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, 5 total). No new failures — all 5 new/expanded C-16 test files (`clients-list-data.test.ts`, `clients-list-page.test.ts`, `clients-page-param.test.tsx`, `enquiries-list-page.test.ts`, `enquiries-page-param.test.tsx`) pass in full.

**`npx eslint .`** → `✖ 66 problems (59 errors, 7 warnings)`. Files with any error/warning, confirmed by unique-file listing:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
**Exact identity match to the inherited baseline** (59/7, same six files). No new lint errors from this commit's files.

---

## Summary

All 12 checks ran. Check 1 (the central claim) holds in full, including the two sub-claims most likely to be wrong: the reduction is genuinely inside the cache boundary (not after it), and PostgREST aggregates being disabled is independently confirmed live against the project (`PGRST123`), not merely asserted. Traps 1-3 are each covered by a test specifically shaped to catch the regression they name, and I traced the "oldest→descending" sabotage by hand to the exact 3-test failure count reported. The clients "remove deleted_at push-down" sabotage count (5) could only be partially corroborated (4 confirmed, read-only constraints prevented running the actual mutation) — noted as a minor gap, not a blocker. The only unverified item is live 375px rendering, blocked on missing credentials in this dispatch rather than any code concern. No out-of-scope files touched, `getClientsListData` is cleanly removed with no dangling references, and all three static gates (tsc/vitest/eslint) match the inherited baseline by identity with zero regressions.
