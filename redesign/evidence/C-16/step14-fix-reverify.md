# C-16 Phase E Step 14 — fix re-verification — commit `f27a9da`

**VERDICT: PASS**

Re-verifies the fix for the blocking finding in `step14-verify-full.md` Check 1
(commit `e822e12` FAILED: the "Critical note" safety banner shared its bound
with the capped `sensitiveNotes` display list, so a flagged note could age
past `LIMIT 300` with zero signal). Fix commit `f27a9da` decouples the banner
into its own query. All checks below pass; the freeze is cleared.

---

## CHECK 1 — the decoupling, and whether the new query can under-match

### Branch-by-branch superset table

`CRITICAL_NOTE_PATTERN` = `/\b(allerg(y|ic|ies)|anaphyla|epipen|contraindic|urgent|warning|do not|avoid)\b/i`
(`client-detail-data.ts:129-130`)
`CRITICAL_NOTE_KEYWORDS` (`client-detail-data.ts:114-123`) = `["allerg", "anaphyla", "epipen", "contraindic", "urgent", "warning", "do not", "avoid"]`

| # | Regex branch | Strings it can match (mod. pre-existing `\b` gap, see note) | Covering keyword | Substring holds? |
|---|---|---|---|---|
| 1 | `allerg(y|ic|ies)` | allergy, allergic, allergies | `allerg` | Yes — one keyword covers all three suffixes |
| 2 | `anaphyla` | anaphyla (standalone word only — pre-existing `\b` gap, not in scope) | `anaphyla` | Yes — trivial, identical string |
| 3 | `epipen` | epipen | `epipen` | Yes |
| 4 | `contraindic` | contraindic (standalone word only — pre-existing `\b` gap, not in scope) | `contraindic` | Yes — trivial, identical string |
| 5 | `urgent` | urgent | `urgent` | Yes |
| 6 | `warning` | warning | `warning` | Yes |
| 7 | `do not` | "do not" (literal space) | `do not` | Yes — keyword is the literal phrase including the space |
| 8 | `avoid` | avoid | `avoid` | Yes |

8 alternation branches, 8 keywords, exact 1:1 mapping — no branch is uncovered. Per the dispatch's instruction, branches 2 and 4's pre-existing `\b` gap (missing "anaphylaxis"/"contraindicated") is **not re-checked for correctness here** — only whether the keyword list covers what the regex *actually* matches today, which it does (the keyword is a trivial substring of the exact word the regex matches). **The fix does not make the pre-existing gap worse**: the SQL scan is still a superset of the regex's real (buggy) matching set, branch for branch.

Since `is_sensitive`/ILIKE matching is case-insensitive on both sides (Postgres `ILIKE`, regex `/i` flag) and every keyword is a plain substring with no regex metacharacters, the superset property holds mechanically: any string containing the regex's matched text necessarily contains its covering keyword as a substring too. Over-inclusion (e.g. SQL matching "avoided" via `%avoid%` where the regex's `\bavoid\b` would not) is safe by design — the JS regex is re-applied over the SQL result (`client-detail-data.ts:542-544`) to pick the exact match, so SQL-side false positives are filtered out, never SQL-side false negatives.

**Test-level confirmation**: `__tests__/client-detail-data.test.ts` has a dedicated `describe("CRITICAL_NOTE_KEYWORDS stays a superset of CRITICAL_NOTE_PATTERN")` block (added in this fix) with 10 `it.each` cases — one realistic sample sentence per branch, including `"do not"` and all three `allerg(y|ic|ies)` suffixes — asserting both `CRITICAL_NOTE_PATTERN.test(sample) === true` and that a `CRITICAL_NOTE_KEYWORDS` entry is a case-insensitive substring. This is a live regression guard on the exact property this check verifies by hand.

### `"do not"` — the space, and `.or()` parsing

`CRITICAL_NOTE_KEYWORD_OR_FILTER` (`client-detail-data.ts:147-149`) builds one `note.ilike."%<escaped keyword>%"` arm per keyword, joined by `,`, via `quoteOrValue` wrapping each operand in double quotes. For `"do not"`: `escapeLike("do not")` leaves it untouched (no `\`, `%`, `_`), then `quoteOrValue` produces `"%do not%"` (quoted). The resulting arm is `note.ilike."%do not%"`.

Verified this is safe three ways:
1. **Code-level**: `postgrest-js@2.104.1`'s `.or()` implementation (`PostgrestFilterBuilder.ts:1941-1951`) does `this.url.searchParams.append(key, `(${filters})`)` — i.e. the raw filter string (spaces, quotes and all) is handed to `URLSearchParams.append`, which percent-encodes it automatically before it hits the wire. The space inside the quoted value is never naively concatenated into a URL; it round-trips through standard encode/decode, so the string PostgREST receives is byte-identical to what was built, quotes intact.
2. **Live probe** (non-sensitive table, no client data): `GET .../rest/v1/staff_profiles?select=id&or=(name.ilike."%do not%")` and an 8-arm version mirroring the exact `CRITICAL_NOTE_KEYWORD_OR_FILTER` shape both returned `HTTP 401 {"code":"42501", message: "permission denied for table staff_profiles"}` — i.e. RLS rejected the query, which only happens *after* PostgREST successfully parses the filter grammar. A malformed `.or()` string returns a distinct `400 PGRSTxxx` parse error instead (as independently confirmed for a different filter shape in the original `e822e12` verify report, Check 4). Getting to the permission check is proof the space-containing quoted value parsed correctly.
3. **Convention match**: `escapeLike`/`quoteOrValue` in `client-detail-data.ts:132-142` are byte-identical to the established, already-in-production pair in `src/app/admin/emails/emails-data.ts:280-301`, which builds multi-arm `.or()` ILIKE filters the same way and is exercised by the Delivery tab's search today.

### The 300-cap on the keyword-narrowed subset

`criticalNoteCandidatesQuery` (`client-detail-data.ts:512-522`) filters `is_sensitive = true` AND the keyword `.or()` **before** applying `.limit(CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP)` (300), ordered newest-first — filter-then-cap, not cap-then-filter, which is the property the fix round exists to establish. This is **not** an unbounded read: if a single client accumulated more than 300 sensitive notes that *each* also contain a critical keyword, a keyword-matching note older than the 300th-most-recent such note could still silently miss the scan.

Reasoned about reachability: the live baseline (per the original verify-full report, SELECT-only probe against `client_notes`) shows the current maximum sensitive-note count for any one client is **2**. Reaching 300 *keyword-matching* sensitive notes requires at minimum 300 total sensitive notes (likely more, since not every sensitive note will contain one of these keywords) on a single client, with no bulk-insert path anywhere in the touched files or their sibling `actions.ts` (single-row `.insert()` per form submission is the only write path, same finding the original report made for `blocked_dates`/`availability_overrides`). This is markedly *less* reachable than the original bug's trigger condition (300 sensitive notes of any kind), which was itself already judged implausible at 150x the observed maximum.

**This residual is real but not blocking**, for the same reason Check 2 in the original `e822e12` report was accepted as a conscious, non-blocking judgement rather than a defaulted one: it is a defensive ceiling on an already-narrow, business-reality-bounded subset, not a truly unbounded read, and it is far harder to hit than the condition this very fix round closes. Flagged here for the record — no count/signal exists if this narrower cap is ever hit — but it does not block this re-verification, which is scoped to the property that failed (`criticalNote` independent of the `sensitiveNotes` **display** cap), and that property now holds.

**Check 1 verdict: PASS.** No alternation branch is uncovered; the space-containing `"do not"` arm parses correctly (verified three independent ways); the new cap-after-filter shape is a defensible, dramatically-less-reachable residual, not a repeat of the original defect.

---

## CHECK 2 — the rail, and the comment

- **`sensitiveNotesTotal` head-count added**: `client-detail-data.ts:479-483` mirrors `regularNotesCountQuery` exactly, same `.eq("client_id", clientId).eq("is_sensitive", true)` predicate as `sensitiveNotesQuery` (`:489-498`) minus the cap — confirmed matching predicate, no divergence.
- **`resolveClientSensitiveNotesBannerState`** (`client-detail-data.ts:680-696` in the current file) implements the full `cappedOut`/`hidden`/`viewingAll`/`none` state machine, `CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP = 3000` (`:98`). Branch order read directly:
  ```
  if (viewAll && sensitiveTotal > CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP) return cappedOut;
  if (sensitiveTotal > sensitiveShown) return hidden;
  if (viewAll && sensitiveTotal > CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP) return viewingAll;
  return none;
  ```
  **`cappedOut` is evaluated before `hidden`** — confirmed. Matches `resolveClientNotesBannerState`'s order exactly (same shape, same reasoning).
- **Two-rail href preservation** (`page.tsx:441-471` region). `notesBaseHref` is built once; each of the four hrefs (`notesAllHref`, `notesRecentHref`, `sensitiveNotesAllHref`, `sensitiveNotesRecentHref`) double-wraps `withNotesParam`: first re-applies the **other** rail's current toggle state unchanged, then flips only its own param. Traced all four:
  - `notesAllHref`/`notesRecentHref` preserve `sensitiveNotes` param at its current `sensitiveNotesViewAll` state, only setting/clearing `notes`.
  - `sensitiveNotesAllHref`/`sensitiveNotesRecentHref` preserve `notes` param at its current `notesViewAll` state, only setting/clearing `sensitiveNotes`.
  Confirmed in the rendering JSX (`page.tsx:1112-1141` for the `notes` rail, `:1146-1175` for the `sensitiveNotes` rail): both rails independently follow `cappedOut → recentHref`, `hidden → allHref`, `viewingAll → recentHref` — since each href only ever flips its *own* toggle and carries the other rail's live state through, neither link can ever point at the URL already active. No dead-link risk found in either rail or their interaction.
- **False comment removed**: the old `client-detail-data.ts` file-header claim ("split into TWO queries... `sensitiveNotes`... DEFENSIVE CAP ONLY... never truncated") and the old `page.tsx` comment ("`sensitiveNotes` from the fetcher is ALWAYS complete... this safety scan is unaffected") are both gone. Replaced with an accurate three/four-query description (`client-detail-data.ts:38-74`) and an accurate `page.tsx:420-423` comment stating `criticalNote` now comes from its own dedicated query. Confirmed no remaining "never truncated"/"ALWAYS complete" language anywhere in the diff or current file (`grep -n "never truncated\|ALWAYS complete"` → no matches).

**Check 2 verdict: PASS.**

---

## CHECK 3 — files-touched scope

`git show f27a9da --stat` → exactly **nine** files:
```
availability/AvailabilityOverridesManager.tsx
availability/BlockedDatesManager.tsx
availability/page.tsx
clients/[clientId]/__tests__/client-detail-data.test.ts
clients/[clientId]/client-detail-data.ts
clients/[clientId]/page.tsx
staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx
staff/[staffId]/availability/StaffBlockedDatesManager.tsx
staff/[staffId]/availability/page.tsx
```
All nine are within the permitted set (the N6 fix's own three files, plus the N3/N4 secondary-item's six files). Confirmed absent from the stat output (and thus untouched): `src/lib/maintenance.ts`, `src/lib/pagination.ts`, `PaginationBar.tsx`, `audit/queries.ts`, `reporting.ts`, `dashboard-helpers.ts`, `bookings/**`, `emails/**`, `privacy/**`, `operations/**`, `account-password-requests/**`, `clients/page.tsx`, `clients-list-data.ts`, `enquiries/**`, `availability-data.ts`, `staff/[staffId]/availability/lib.ts`, `staff-detail-data.ts`, `staff/[staffId]/page.tsx`. **PASS.**

---

## CHECK 4 — nothing `e822e12` got right was lost

- `CLIENT_NOTES_LIMIT = 25` / `CLIENT_NOTES_VIEW_ALL_CAP = 200` (`client-detail-data.ts:87-88`) — unchanged values, still exported.
- `resolveClientNotesBannerState` (`client-detail-data.ts:642-665` region) — diff shows **only comment text changed**, no logic lines touched; branch order (`cappedOut` → `hidden` → `viewingAll`) intact, confirmed by direct read.
- `regularNotesTotal`/`regularNotes` query pair (`:471-483`) unchanged from `e822e12`.
- The four availability/staff-availability `cappedOut`/`hidden`/`viewingAll` instances (N3 clinic blocked dates, N3 clinic overrides, N4 staff blocked dates, N4 staff overrides): diffs for all four Manager components show the change is confined to the badge `<span>` text (adding the `upcomingTotal > upcoming.length` conditional); the surrounding past-bucket cap/view-all banner blocks are untouched. `grep -c cappedOut` across the four Manager files returns 8 total occurrences (2 each), consistent with their pre-existing shape.
- N7 (`staff-detail-data.ts`, `staff/[staffId]/page.tsx`) is not in this commit's file list at all — fully untouched, `hasHiddenStaffAssignments` and its live-bug-fix link from `e822e12` are preserved by construction.

**Check 4 verdict: PASS.**

---

## CHECK 5 — the secondary item (`upcomingTotal` badges)

Head-count queries added, predicate-matched to their sibling upcoming query in every case:
- `availability/page.tsx:190-193` (`blocked_dates`, `.gte("blocked_date", today)`) matches `:180-185`'s predicate.
- `availability/page.tsx:218-221` (`availability_overrides`, `.gte("override_date", today)`) matches `:210-215`'s predicate.
- `staff/[staffId]/availability/page.tsx:132-136` (`staff_blocked_dates`, `.eq("staff_id", staffId).gte("blocked_date", today)`) matches its sibling.
- `staff/[staffId]/availability/page.tsx:150-154`-region (`staff_availability_overrides`, same shape) matches its sibling.

Badge condition, identical across all four Manager components (`BlockedDatesManager.tsx`, `AvailabilityOverridesManager.tsx`, `StaffBlockedDatesManager.tsx`, `StaffAvailabilityOverridesManager.tsx`):
```
{upcomingTotal > upcoming.length ? `${upcoming.length} of ${upcomingTotal} upcoming` : `${upcoming.length} upcoming`}
```
Since `upcoming.length === min(realCount, cap)`, `upcomingTotal > upcoming.length` is true **iff and only if** the cap was actually hit — under the cap, the two are equal and the plain form renders; at/above the cap, the "X of Y" form renders. Exactly the condition requested — not always-on noise, not silently missing. **PASS.**

---

## CHECK 6 — the test file, sabotage precision

Read `__tests__/client-detail-data.test.ts` in full (post-fix, 300+ lines).

**Sabotage 1 — revert `criticalNote` to `sensitiveNotes.find(...)`.** Traced against the new `describe("getClientDetailData — criticalNote decoupled from the sensitiveNotes cap")` block (3 tests):
- *"fires even when the flagged note fell outside the capped display list"* — stubs `sensitiveNotes` (display rail) with only an unrelated recent note, and `criticalNoteCandidatesQuery`'s result with the flagged allergy note; asserts `criticalNote?.id === "n-old-allergy"` while also asserting that id is **not** in `sensitiveNotes`. Under the reverted (`sensitiveNotes.find`) implementation this note is absent from the searched list → `criticalNote` would be `null` → **fails**.
- *"is null when no candidate matches the exact pattern"* — both stubbed lists are non-matching/empty; both implementations independently return `null` → does not distinguish, passes either way (correctly not counted as a discriminating test).
- *"picks the most recent matching candidate when several match"* — `sensitiveNotes` (display rail) stubbed **empty**, both matching candidates only exist in `criticalNoteCandidatesQuery`'s result; asserts `criticalNote?.id === "n-newer"`. Reverted implementation searches the empty `sensitiveNotes` → `null` → **fails**.

Two of three tests fail under the revert, matching the implementer's "2 targeted failures" claim exactly. Also confirmed no other test in the file incidentally flips: the base-fixture and `canViewSensitiveNoteQueue=false` tests both have `criticalNote` as `null` under either implementation (base fixture's `criticalNoteCandidatesQuery` stub is `[]`, and its lone `sensitiveNotes` row's text doesn't match the pattern either).

**Is the decoupling test genuine, not vacuous?** Yes. Test 1 explicitly constructs the exact scenario the original FAIL described — a flagged note absent from the capped `sensitiveNotes` display list but present in the safety scan's own query result — and asserts on both halves (`not.toContain` on the display list, `toBe` on `criticalNote`). It is a unit-level simulation (via mocked query results) of "a note aged past the display cap," not a literal 301-row fixture, which is the right level for this function boundary — the property under test is "does `criticalNote` derive from the dedicated query, independent of `sensitiveNotes`," and the test pins exactly that.

**Sabotage 2 — swap `cappedOut`/`hidden` order in `resolveClientSensitiveNotesBannerState`.** Traced against the new `describe("resolveClientSensitiveNotesBannerState")` block (4 tests): the `"none"`, `"hidden"` (via default-cap truncation, `viewAll: false`), and `"viewingAll"` tests all use inputs where a hidden-first check produces the identical branch as the shipped cappedOut-first check (either `viewAll` is false, so `cappedOut`'s guard is unreachable regardless of order, or `hidden`'s condition is false so it falls through identically). Only the test explicitly marked `"SABOTAGE TARGET"` (`sensitiveTotal: VIEW_ALL_CAP+25, sensitiveShown: VIEW_ALL_CAP, viewAll: true`) sits in the ambiguous zone where both conditions hold simultaneously — under the shipped order it correctly returns `cappedOut`; under a hidden-first swap it would return `hidden`. Exactly 1 test fails, matching the implementer's claim.

**Check 6 verdict: PASS** — both sabotage claims verified precise by direct trace, not accidental; the decoupling test genuinely exercises the property that failed.

---

## CHECK 7 — mechanical rules

- **`border-l-4`**: `git show f27a9da | grep border-l-4` → no matches.
- **`revalidateTag`**: `git show f27a9da | grep revalidateTag` → no matches.
- **New hardcoded `oklch(...)`**: `git show f27a9da | grep "^+.*oklch("` → no matches.
- **`updateTag` vs `revalidateTag`**: no cache-invalidation code was added by this commit (it only adds read queries); no `updateTag`/`revalidateTag` calls appear in the diff.
- **`createSupabaseAdminClient()` only after `getStaffProfile()`**: verified call order in all three touched page-level entry points — `clients/[clientId]/page.tsx` (`getStaffProfile` at `:304`; the fetcher's own `createSupabaseAdminClient()` calls at `client-detail-data.ts:368,613` only execute once `getClientDetailData` is invoked from `page.tsx`, after `:304`), `availability/page.tsx` (`getStaffProfile:128`, `createSupabaseAdminClient():250` — the new count queries at `:190-193,218-221` use the pre-existing `supabase` server client, same as their sibling queries, not the admin client, so this doesn't change the ordering surface at all), `staff/[staffId]/availability/page.tsx` (`getStaffProfile:43`, `createSupabaseAdminClient():98` — the new count queries at `:132-136` and their overrides sibling also ride the existing `supabase`/`adminClient` split unchanged). All correct order, no new admin-client call sites introduced ahead of profile resolution.
- **Cache keys JSON-safe, no `Set`/`Map`/`Date`, no ms `Date.now()`**: `cacheKeyPart({...})` at `client-detail-data.ts:584-595` now also includes `sensitiveNotesViewAll` — a boolean, same as its sibling `notesViewAll`. No `Set`/`Map`/`Date`/`Date.now()` added anywhere in the diff (`git show f27a9da | grep "Date.now()"` → no matches in added lines).

**Check 7 verdict: PASS** on every item.

---

## CHECK 8 — baselines by identity

- **`npx tsc --noEmit`** → no output, exit clean. **0 errors — matches baseline.**
- **`npx vitest run`** → `Test Files 2 failed | 186 passed (188)`, `Tests 5 failed | 1728 passed (1733)`. Failing tests by name:
  - `src/lib/auth/admin-access.test.ts` — "gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management" (2)
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx` — "renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent" (3)

  **Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 — matches the inherited baseline BY IDENTITY.** (Passed-test count rose from 1709→1728, +19, consistent with this fix's ~19 new test cases across the sync/decoupling/banner-state/head-count describe blocks; failed-file count and failed-test identities are unchanged.)
- **`npx eslint .`** → `✖ 66 problems (59 errors, 7 warnings)`, in exactly six files: `design_handoff_area_pages/prototype/area-page.jsx`, `.../shared.jsx`, `.../site-chrome.jsx`, `src/features/booking/BookingExperience.tsx`, `src/features/booking/BookingExperienceLoader.tsx`, `src/features/booking/utils/returning-customer.ts`. **59 errors / 7 warnings in exactly six files — matches baseline BY IDENTITY.**

**Check 8 verdict: PASS** on all three, by identity.

---

## Summary

| Check | Result |
|---|---|
| 1 — superset claim, escaping, 300-cap-on-subset reachability | **PASS** (branch table complete 8/8; `"do not"` space verified 3 ways; residual keyword-subset cap noted, non-blocking, far less reachable than the original defect) |
| 2 — real head-count, cappedOut-before-hidden, two-rail href preservation, comment fixed | **PASS** |
| 3 — files-touched scope | **PASS** (exactly 9 files, all permitted) |
| 4 — `e822e12`'s wins preserved | **PASS** |
| 5 — secondary item, badge condition correctness | **PASS** (fires iff cap actually hit, all 4 surfaces) |
| 6 — test file, sabotage precision | **PASS** (2-test and 1-test sabotage claims both verified exact by trace; decoupling test is genuine) |
| 7 — mechanical rules | **PASS** |
| 8 — baselines by identity | **PASS** (tsc 0, vitest identity, eslint identity) |

**Overall: PASS.** The blocking defect from `step14-verify-full.md` Check 1 is fixed: `criticalNote` now derives from a dedicated, keyword-filtered query that is a verified superset of `CRITICAL_NOTE_PATTERN` and is evaluated before capping, so it can no longer silently miss a flagged note that aged past the `sensitiveNotes` display cap. The `sensitiveNotes` rail itself now carries an honest head-count and cap+view-all signal matching the plan's established pattern. One residual, non-blocking observation is on record (Check 1): the new `criticalNoteCandidatesQuery` still has its own 300-row cap on the keyword-narrowed subset, with no additional signal if that narrower cap is ever hit — reachability requires a client with several hundred sensitive notes that mostly also contain a critical keyword, against an observed live maximum of 2, with no bulk-insert path. This is not a repeat of the defect this fix closes and does not block clearing the freeze.

This re-verification clears the programme-wide freeze imposed under §2.9(b).
