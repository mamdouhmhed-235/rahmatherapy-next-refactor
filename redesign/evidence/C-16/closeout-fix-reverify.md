# C-16 — closeout fix re-verification

**VERDICT: PASS**

Fix under test: `d22ab37` (7 files, all under `src/app/admin/clients/**`), re-verifying against the two prior FAILs (`closeout-static-gates.md` §3.2, `closeout-adversarial-review.md` Finding 1) and the implementer's own self-flagged gap in `lifetimeBookings` wiring. Read-only throughout; only write is this file. No client note content or client identifiers are reproduced below — all sample strings used to test the critical-note regex were authored by me, not read from the database.

---

## CHECK 1 — does every LIFETIME consumer actually receive `lifetimeBookings`, not the capped rail? (the implementer's own flagged gap)

**Settled: yes, for every consumer named in the dispatch.** Read `src/app/admin/clients/[clientId]/page.tsx` end to end.

The fetcher returns two independent booking arrays (`client-detail-data.ts:439-452`): `bookingHistory` (capped rail, `CLIENT_BOOKING_HISTORY_LIMIT`/`_VIEW_ALL_CAP`) and `lifetimeBookings` (whole-history PII-free projection, capped only at `CLIENT_LIFETIME_SCAN_CAP` = 2000). `page.tsx:445-447` reduces each through the same `summariseClientBookingHistory` into two named locals:

```
const lifetime = summariseClientBookingHistory(lifetimeBookings);  // line 445
const rail = summariseClientBookingHistory(bookingHistory);        // line 447
```

Per named consumer:

| Consumer | Source | Evidence |
|---|---|---|
| LTV ribbon | `lifetimeBookings` directly | `page.tsx:721-725` — `<ClientLtvRibbon bookings={lifetimeBookings} .../>`. `ClientLtvRibbon.tsx:65` recomputes its own metrics via `getClientLifetimeMetrics(clientId, bookings)` over that same prop — never sees `bookingHistory`. |
| Client-summary panel (`StatsPanel`) | `lifetime.*` | `page.tsx:448-452` (`upcomingCount = lifetime.upcomingCount`, `completedCount = lifetime.completedCount`, `totalSpend = lifetime.totalSpend`, `lastVisit = lifetime.lastVisit`) feed `StatsPanel` props at `page.tsx:734-744`; `bookingCount={lifetimeScanned}` where `lifetimeScanned = lifetime.total` (`page.tsx:537`). |
| Tab counts | `lifetime.*` | `page.tsx:470-474` — `tabCounts = { upcoming: lifetime.upcomingCount, past: lifetime.pastCount, all: lifetime.total }`. |
| Lifecycle badge | `lifetime.total` | `page.tsx:457` — `lifecycleBadge(lifetime.total)`. |
| "Next visit" strip | `lifetime.nextVisit` | `page.tsx:498` — `const nextVisit = lifetime.nextVisit;`, consumed at `page.tsx:648-690`. |

The only consumer of `rail` (i.e., the capped `bookingHistory`) is `bookingsForTab` (`page.tsx:475-480`, `rail.upcoming`/`rail.past`) — the actual rendered list of booking cards, which is *supposed* to be capped; that's the rail's job. `HealthContextPanel` also deliberately reads `bookingHistory` (`page.tsx:754`), but it is explicitly commented as a display convenience, never a lifetime figure and never the safety control (`criticalNote`, which has its own dedicated uncapped-relative-to-display query).

No consumer of a lifetime figure reads the capped array. **The implementer's self-flagged gap does not exist in the shipped code.**

Caveat, not a defect: `lifetimeBookings` is itself bounded at `CLIENT_LIFETIME_SCAN_CAP` (2000 — "~38 years of weekly visits for ONE client," `client-detail-data.ts:130-137`). When that ceiling binds, `StatsPanel` discloses it (`page.tsx:1128-1133`): `historyTotal > lifetimeScanned` fires the "Counted over the {lifetimeScanned} most recent of {historyTotal} bookings" line — verified this condition can only be true when the true count exceeds the 2000-row scan cap, never when only the display rail (50/500) is short. See CHECK 4 for the shared-scope proof behind `historyTotal`.

---

## CHECK 2 — readout truthfulness on `/admin/clients` (defect 1)

All verified independently against `src/app/admin/clients/clients-list-data.ts` and `page.tsx`.

- **Pager total** = `selected.length` (`clients-list-data.ts:1059`, `const total = selected.length;`), and `rows` is `selected.slice(from, to+1)` (`:1063`) — the same array. Never an inflated figure; a "Showing 1–25 of 5,000" over a capped read cannot occur, because `total` is capped alongside the rows by construction.
- **"N of M clients"**: `M` = `totalClientCount = listPage.totalInScope` (`page.tsx:187`) = `context.includeDeleted ? allClients : liveClients` (`clients-list-data.ts:1035`), sourced from `countClients(true)`/`countClients(false)` — real head-counts (`:781-797`), exact regardless of the candidate cap.
- **Stats line**: `statsAreCapped = listPage.statsBasis < totalClientCount` (`page.tsx:235`) gates "Counted over the first {statsBasis} of {totalInScope} clients" (`page.tsx:385-390`). `statsBasis = roster.length` (`clients-list-data.ts:1109`), where `roster` is read under the *scope-only* plan (deleted-toggle only, no search/lifecycle/payment narrowing) at the same `cap`. Traced the logic: when nothing narrows the list, `roster` and `totalInScope` describe the identical WHERE clause, so `roster.length` can only fall short of `totalInScope` when the candidate ceiling itself bound — the condition fires exactly then and not otherwise.
- **Banner order** `cappedOut → hidden → viewingAll → none`: confirmed in `resolveClientCandidateBannerState` (`clients-list-data.ts:851-869`) — `cappedOut` branch checked first, `hidden` second, `viewingAll` third. Identical branch order to `resolveClientBookingHistoryBannerState`, `resolveClientNotesBannerState`, `resolveClientSensitiveNotesBannerState` (all four resolvers checked, all identical shape).
- **`buildViewAllHref`** (`page.tsx:830-852`): explicitly `if (key === "all") continue;` while rebuilding params, then `if (next) params.set("all", "1");` — drops and re-sets from `next`, confirmed. Every *other* href builder on the page — `buildClearLinkHref` (`:706`), `buildSortHref` (`:729`), `buildFilterHref` (`:750`), `buildPageHref` (`:775`), `buildShowDeletedHref` (`:798`) — iterates `filterValues` entries with no exclusion for the `all` key, so each carries it through unchanged. Narrowing a filter, changing sort, paging, or toggling deleted clients cannot silently re-shrink an active view-all read.
- **No extra head request on the default view**: `candidateTotal = scopeIsPlan ? totalInScope : await countClientCandidates(plan)` (`clients-list-data.ts:1046-1048`) — `scopeIsPlan` is true exactly when the active filter plan equals the scope-only plan (no search/lifecycle/payment/location/source active), in which case `totalInScope` (already fetched via `countClients`) is reused and `countClientCandidates` is never called. Confirmed by reading the ternary and its guard (`:1041-1042`).

---

## CHECK 3 — the critical-note regex, per branch (defect 3)

Final pattern (`client-detail-data.ts:205`): `/\b(allerg|anaphyla|epipen|contraindic|urgent|warning|avoid|do not\b)/i`.

**Independently tested in Node** (not just read) against the false-positive claim and the branch set:

```
OK [do nothing]   expected=false actual=false
OK [do notice]    expected=false actual=false
OK [do note]      expected=false actual=false
OK [do not use oils] expected=true actual=true
OK [insurgent]    expected=false actual=false   (leading \b guard intact)
OK [anaphylactic] expected=true  actual=true
OK [contraindicated] expected=true actual=true
OK [allergen/allergy] expected=true actual=true
OK [avoiding/avoidance/avoidant] expected=true actual=true
OK [urgently/warnings/epipen] expected=true actual=true
ALL PASS (17/17)
```

Then ran the real suite: `npx vitest run "src/app/admin/clients/[clientId]/__tests__/client-detail-data.test.ts"` → **108/108 passed**, including the dedicated `"do not" branch does not fire on benign prose` block (8 negative cases: "do nothing," "do notice," "do note," "Do noting," etc. — all correctly non-matching) and `"still matches ... the prohibition itself is untouched"` (6 positive cases for the real instruction, including "Instruction is clear: do not.").

- **`do not\b` is the only re-narrowed branch** — confirmed by reading the pattern literal and the file's own comment (`:193-203`): every other branch keeps prefix matching.
- **`allerg`/`anaphyla`/`contraindic` still prefix-match** — confirmed empirically ("allergen," "anaphylactic," "contraindicated" all match).
- **Judgment on keeping `avoid` as a prefix**: I agree with the implementer. Narrowing to `avoid\b` would stop matching "avoiding the left shoulder" and "avoidance of pressure" — real, common clinical phrasing (also pinned by the suite's dedicated `"the other branches keep their Owner-authorised prefix match"` block). I could not find a purely benign English word beginning with "avoid" that isn't itself semantically about avoidance (`avoidant`, `avoidance`, `avoiding`) — the softer widening the adversarial review flagged is real but narrow, and a false negative on a patient-safety banner is the worse failure of the two, consistent with the file's own stated ranking.
- **Other prefix branches** (`allerg`, `urgent`, `warning`, `epipen`): no benign false-positive found by reasoning or by my test list — no common English word other than clinically-relevant extensions (allergen/allergist, urgently, warnings) begins with any of these four stems.
- **Mechanical superset guard**: the parser in the test file (`extractFlatAlternationBranches`, using `^\\b\(([^()]*)\)$` against `CRITICAL_NOTE_PATTERN.source`) still succeeds because the reintroduced `\b` on the `do not` branch sits *inside* the outer group with no literal `(`/`)` characters — it does not break the flat-alternation shape the parser expects. Verified this is not just a hand-trace: the actual test run (`108/108` passing) includes `"parses into a flat, non-nested alternation of literal branches"` (passes) and the `it.each(branches)` per-branch coverage tests, which enumerate all **8** branches (`allerg`, `anaphyla`, `epipen`, `contraindic`, `urgent`, `warning`, `avoid`, `"do not\b"`) and confirm each is still matched by the pattern and still contains a `CRITICAL_NOTE_KEYWORDS` substring — the 8th branch's literal source text `do not\b` contains the `"do not"` keyword as a prefix substring, so coverage holds.

---

## CHECK 4 — the booking-history rail (defect 2)

`CLIENT_BOOKING_HISTORY_LIMIT` = 50, `_VIEW_ALL_CAP` = 500 (`client-detail-data.ts:121,129`), `CLIENT_LIFETIME_SCAN_CAP` = 2000 (`:138`).

- **Full-access path** (`client-detail-data.ts:513-545`): `bookingHistory`, `bookingHistoryTotal` (head-count), and `lifetimeBookings` are all issued in one `Promise.all`, all scoped by the identical `.eq("client_id", clientId)` — no divergence possible.
- **Therapist path** (`:568-593`): the same three reads, all additionally narrowed by `.in("id", assignedBookingIds)` using the *same* `assignedBookingIds` array computed once at `:551-557` — confirmed the head-count (`assignedCountResult`) shares the `.in(...)` scope with both the rail and the lifetime read, which a standalone `countClientBookings` companion function could not do (that function, `:773-788`, has no assignment-narrowing and is explicitly noted as unused by the page).
- **Dead `limit`/`offset` plumbing is gone**: grepped `client-detail-data.ts` — the only surviving occurrence of "offset" is a comment describing the *removed* mechanism (`:32`). `ClientDetailParams` (`:409-430`) has no `limit`/`offset` fields, only `historyViewAll`. `page.tsx`'s only call site (`:411-420`) passes no such fields.
- **`CLIENT_LIFETIME_SCAN_CAP` disclosure**: `page.tsx:1128-1133` renders "Counted over the {lifetimeScanned} most recent of {historyTotal} bookings" exactly when `historyTotal > lifetimeScanned`, i.e., when the true (shared-scope) booking count exceeds the 2000-row lifetime scan — proven above to share scope on both paths, so this cannot misfire from a rail-only shortfall.

---

## CHECK 5 — nothing previously verified was lost

All confirmed present and unchanged in shape by direct read:

- Step 8's shared predicate plan / total-rows single-source property: `total = selected.length`, `rows` sliced from the same `selected` array (`clients-list-data.ts:1059-1063`).
- Deleted-clients SQL push-down: `buildClientPredicatePlan` step 1, `.is("deleted_at", null)` in SQL (`:552-553`), not an in-memory filter.
- SQL search: step 2, `.ilike` predicates built in SQL (`:556-568`).
- Notes rails' caps/head-counts/`cappedOut` ordering: `resolveClientNotesBannerState`/`resolveClientSensitiveNotesBannerState` (`client-detail-data.ts:837-895`), both `cappedOut`-before-`hidden`, both with independent head-counts (`regularNotesCountQuery`/`sensitiveNotesCountQuery`, `:641-667`).
- `criticalNote`'s decoupling from the display cap: dedicated `criticalNoteCandidatesQuery` (`:674-684`), its own SQL-side `.or(CRITICAL_NOTE_KEYWORD_OR_FILTER)` scan, independent of `sensitiveNotesQuery`'s display cap.

---

## CHECK 6 — housekeeping

- `git show d22ab37 --stat`: exactly 7 files, all under `src/app/admin/clients/**`. Confirmed.
- `git log --oneline -3`: `d22ab37` → `4a9bef9` (HEAD at the time both prior gates FAILed) → `ed9d31b`. Exactly one new commit since the FAIL'd closeout; history is sane.
- `git status --porcelain`: only `M src/lib/maintenance.ts` (Owner-owned, untouched, not reported further per instruction) plus pre-existing untracked evidence/screenshot paths outside `src/app/admin/clients`. Nothing unexpected.
- Cache keys: read every `cacheKeyPart(...)` call in both changed data files — all plain objects/booleans/strings/numbers/arrays of plain predicate-step objects; `today` is a `YYYY-MM-DD` string (`new Date().toISOString().slice(0,10)`, day-precision, not `Date.now()`); no `Set`/`Map`/`Date` crosses an `unstable_cache` boundary. The new caps (`cap`, `historyViewAll`, `notesViewAll`, `sensitiveNotesViewAll`) are all present inside the respective cache keys.
- No `border-l-4` in `src/app/admin/clients/` (grep empty). No `revalidateTag` (grep empty); `updateTag` used throughout. `createSupabaseAdminClient()` is called only after `getStaffProfile()` in both `clients/page.tsx` (`:122` then `:162`) and `clients/[clientId]/page.tsx` (`:374` then `:411`). No new hardcoded `oklch(...)` literal introduced by the `d22ab37` diff (`git diff d22ab37~1 d22ab37 -- src/app/admin/clients | grep "^\+.*oklch("` → empty).
- Sabotage claims: read (not re-run) `clients-list-page.test.ts` — it asserts `limitOn(candidateQuery())` equals `CLIENT_CANDIDATE_CAP` and separately pins `candidateShown`, `candidateTotal`, `total`, `pageCount`, `totalInScope`, `statsBasis` as distinct values off a directory sized `CLIENT_CANDIDATE_CAP + 5` — dropping `.limit(cap)` would break each of these independently, consistent with the claimed failure count. Not exhaustively mutation-tested, per instruction to read rather than re-run.

---

## CHECK 7 — gates

- `npx tsc --noEmit` → **exit 0, 0 errors.** Matches inherited baseline.
- `npx vitest run` → **2 test files failed (186 passed of 188), 5 tests failed (1812 passed of 1817).** Failing titles, verbatim:
  - `src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated`
  - `src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent`

  **Identical by identity** to the inherited baseline (same 2 files, same 5 titles, same 2+3 split). The higher pass count (1812 vs. baseline 1760) is the new test coverage this fix round added (`client-detail-data.test.ts`, `clients-list-page.test.ts`, `clients-page-param.test.tsx`), not a baseline drift. PASS by identity.
- `npx eslint .` → **59 errors / 7 warnings**, confined to exactly the same six files as baseline: `design_handoff_area_pages/prototype/area-page.jsx` (48E/1W), `.../shared.jsx` (2E/5W), `.../site-chrome.jsx` (5E/0W), `src/features/booking/BookingExperience.tsx` (3E/0W), `BookingExperienceLoader.tsx` (1E/0W), `utils/returning-customer.ts` (0E/1W). Matches inherited baseline exactly by identity.

---

## Summary

Both prior FAILs are cleared: the two unbounded queries (`/admin/clients` candidate read, client-detail booking-history rail) are now bounded with honest head-counted disclosure, and the critical-note regex's benign false-positive class ("do nothing"/"do notice"/"do note") is closed without reopening the two previously-dead branches (`anaphyla`/`contraindic`) or weakening `avoid`'s intentional false-negative protection. The implementer's own self-flagged risk — that no test proves the component body wires `lifetimeBookings` rather than `bookingHistory` into the lifetime figures — does not hold up under direct reading: every named consumer (LTV ribbon, client-summary panel, tab counts, lifecycle badge, "Next visit" strip) traces to `lifetimeBookings` by `file:line`, and only the actually-rendered booking-card list uses the capped rail, as intended. All three gates match their inherited baselines by identity. No new findings. C-16's closeout and the programme-wide freeze are cleared.
