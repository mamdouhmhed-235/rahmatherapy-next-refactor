# C-16 Phase E Step 14 — FULL verification — commit `e822e12`

**VERDICT: FAIL**

Blocking on **Check 1**: the client-notes rail's `sensitiveNotes` cap is described as "never truncated," but it is a genuine truncation (`.limit(300)`, most-recent-first) with **zero observability** — no head-count query, no banner, no log line — on the exact list a patient-safety banner scans for allergy/urgent flags. The prompt for this verification is explicit that this shape is blocking "regardless of how unlikely the row count is," so it is reported as a FAIL even though today's measured maximum is 2 sensitive notes per client (see Check 1 evidence). Every other check (2 through 11) passed on the evidence gathered below; Check 2 is judged a conscious, defensible verdict, not a defaulted one, though it shares the same observability gap in a lower-severity form (see Check 2).

---

## CHECK 1 — the safety-adjacent claim (client notes rail, N6)

**What the banner scans.** `src/app/admin/clients/[clientId]/page.tsx:406-407`:
```
const criticalNote =
  sensitiveNotes.find((note) => CRITICAL_NOTE_PATTERN.test(note.note)) ?? null;
```
`CRITICAL_NOTE_PATTERN` (`page.tsx:103`) matches `allerg(y|ic|ies)|anaphyla|epipen|contraindic|urgent|warning|do not|avoid`. `sensitiveNotes` is the entire input to this scan — there is no separate "critical notes" query; the banner is a `.find()` over whatever `sensitiveNotes` happens to contain.

**What bounds `sensitiveNotes`.** `src/app/admin/clients/[clientId]/client-detail-data.ts:406-415`:
```ts
const sensitiveNotesQuery = clientAccess.canViewSensitiveNoteQueue
  ? adminClient
      .from("client_notes")
      .select("id, note, is_sensitive, created_at, staff_profiles(name)")
      .eq("client_id", clientId)
      .eq("is_sensitive", true)
      .order("created_at", { ascending: false })
      .limit(CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP)   // = 300, line 83
      .returns<ClientNoteRecord[]>()
  : Promise.resolve({ data: [] as ClientNoteRecord[] });
```
This is a hard `LIMIT 300` ordered newest-first. **If a client accumulates more than 300 sensitive notes, the 301st-oldest and beyond are never fetched, and if the flagged note is among them, `criticalNote` is `null` and the banner never renders — with no error, no partial-data notice, nothing.** That is a truncation. The file header (`client-detail-data.ts:47-58`) and the page comment (`page.tsx:403-405`) both describe this set as "ALWAYS complete" / "never truncated" — that description is not accurate as a hard guarantee; it is accurate only below 300 sensitive notes per client.

**Is there any signal to the user if it happens?** No. Compare with `regularNotes`, which has a real head-count (`regularNotesCountQuery`, `client-detail-data.ts:399-403`) feeding `resolveClientNotesBannerState` so a "hidden notes" banner can render. **`sensitiveNotes` has no equivalent count query at all** — nothing in `ClientDetailData` reports the true sensitive-note total, so there is no way for `page.tsx`, an operator, or an engineer inspecting the running app to detect that the cap has ever been hit. This is a silent, defense-in-depth-free truncation, in contrast to the honesty principle ("cappedOut before hidden," a true total always surfaced) that this exact commit applies correctly to `regularNotes`, N3, N4, and N7.

**Is 300 reachable in practice?** SELECT-only probe against the live project (2026-08-03), scoped to a count only, no client identifiers or note content read:
```sql
SELECT MAX(cnt) FROM (
  SELECT client_id, COUNT(*) cnt FROM client_notes WHERE is_sensitive = true GROUP BY client_id
) t;
```
Result: **2** (maximum sensitive notes on any one client, project-wide). 300 is nowhere close to reachable today. There is also no bulk-insert path for `client_notes` — notes are created one at a time through a form (not verified line-by-line as it's outside this step's diff, but no batch-note action exists in the touched files).

**Plain statement.** The "never truncated" description is **not accurate as written** — it is a large, currently-unreachable, but real silent truncation dressed as a guarantee. Given the consequence (a clinical safety banner can miss a flagged allergy/urgent note with zero indication to staff), and per this check's explicit instruction that such a shape is blocking regardless of row-count unlikelihood, **this is the report's blocking finding.** A minimal fix (out of scope for this read-only verification to prescribe in detail) would be a cheap `count`-only query on `is_sensitive = true` mirroring `regularNotesCountQuery`, surfaced as a distinct "no signal is not the same as no risk" banner or at minimum a server-side alert/log if the cap is ever hit — the same defense-in-depth pattern already used for `regularNotes`, N3, N4, and N7 in this very commit.

Test coverage confirms the gap is real, not just theoretical: `src/app/admin/clients/[clientId]/__tests__/client-detail-data.test.ts:231-243` asserts `sensitiveNotes` length is unaffected by `notesViewAll`, but **no test exercises the >300 case or asserts any signal when it happens** — because no such signal exists to assert.

---

## CHECK 2 — N3/N4 "upcoming needs no view-all" judgement

**The verdict as shipped.** `src/app/admin/availability/availability-data.ts:44-47` (clinic-wide) and `src/app/admin/staff/[staffId]/availability/lib.ts:70-73` (per-staff) both define `..._UPCOMING_DEFENSIVE_CAP = 500`, applied via `.limit(500)` on `blocked_date >= today` / `override_date >= today` (`availability/page.tsx:179-183, 200-205`; staff `availability/page.tsx:121-127, 140-146`), with **no head-count query and no view-all path** for the upcoming bucket in either tree.

**Is it genuinely bounded?** The reasoning documented in `availability-data.ts:13-28` and `lib.ts:54-63` is that "business reality bounds future scheduling." I checked whether that reasoning holds against the scenarios the check names:
- **Recurring closures / a therapist blocking a year of Fridays:** every insert is a single manual row. `src/app/admin/availability/actions.ts:169-173` (`createBlockedDate`) and `src/app/admin/staff/[staffId]/availability/actions.ts:63-72` (staff blocked dates) both do a single-object `.insert({...})` per form submission — there is no date-range, recurring-rule, or bulk-insert action anywhere in the touched files or their sibling `actions.ts`. A year of Fridays is ~52 rows; reaching 501 future rows on either table requires roughly ten straight years of every-Friday closures never pruned, entered one submit at a time, for one clinic (N3) or accumulated similarly per-therapist (N4) — implausible for an operationally live clinic, not impossible in the abstract.
- **A long sabbatical:** entered day-by-day (no date-range bulk add exists), a multi-month closure is on the order of 90-180 rows — well under 500.
- Current data is far below any of this: pre-launch row counts (per the plan's §0 baseline) are effectively zero for both tables.

**What does the user see at 501?** Nothing distinguishing it from 500. `BlockedDatesManager.tsx:193-195` renders `{upcoming.length} upcoming` straight from the capped array — there is no `upcomingTotal` head-count anywhere in `availability/page.tsx` or `staff/[staffId]/availability/page.tsx` to compare against, so a truncation at row 501 is as silent as Check 1's. This is the same observability gap as Check 1, in a lower-severity form: nothing here feeds a clinical safety scan, it only feeds a numeric "X upcoming" badge, and the row count required to trigger it (501 individually-typed future entries with no automation path) is far less plausible than Check 1's scenario (a client's sensitive-note history simply aging past 300 entries over years of ordinary documentation).

**Verdict on the verdict.** This reads as a **conscious "already correct" call, not a defaulted one**: it is documented with explicit reasoning, cites the same precedent used elsewhere in this plan (`SCOPED_BRANCH_ROW_CAP` / `PRIVACY_NOTES_VIEW_ALL_CAP` — "a defensive ceiling, not a truly unbounded read"), and is grounded in a real, verified constraint of the actual UI (one row per manual submission, no bulk path). It satisfies Part 0's "conscious, not defaulted" bar. I flag, but do not treat as independently blocking, that it has the same zero-observability characteristic as Check 1 — if a bulk-import or recurring-closure feature is ever added later, this cap would fail exactly as silently as the sensitive-notes cap does today, with even less excuse since the badge is entirely cosmetic and a cheap `count`-only query (mirroring the `past` bucket's) would close the gap at negligible cost.

---

## CHECK 3 — files-touched scope

`git show e822e12 --stat` shows exactly 19 files, matching the Owner-approved extension recorded at `redesign/per-page-progress/C-16-data-growth-pagination-progress.md` §1 row 3 / §2 verbatim (N2 services, N3 availability + BlockedDatesManager + AvailabilityOverridesManager, N4 staff availability + its two Manager components + `lib.ts`, N6 client-detail-data.ts + page.tsx, N7 staff-detail-data.ts + page.tsx), plus each surface's co-located `__tests__` file. Confirmed untouched (absent from `git show e822e12 --stat` output): `src/lib/maintenance.ts`, `src/lib/pagination.ts`, `PaginationBar.tsx`, `audit/queries.ts`, `reporting.ts`, `dashboard-helpers.ts`, `bookings/**`, `emails/**`, `privacy/**`, `operations/**`, `account-password-requests/**`, `clients/page.tsx`, `clients-list-data.ts`, `enquiries/**`. **PASS.**

---

## CHECK 4 — N2 reduction inside the cache

`src/app/admin/services/services-data.ts:64-77`:
```ts
export async function getServiceUsageCounts(): Promise<ServiceUsageCounts> {
  const cached = unstable_cache(
    async (): Promise<ServiceUsageCounts> => {
      const { data } = await createSupabaseAdminClient()
        .from("booking_items")
        .select("service_id")
        .returns<UsageRow[]>();
      return summariseServiceUsage(data ?? []);   // reduced INSIDE the cached callback
    },
    ["services-usage-counts"],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}
```
The reduction (`summariseServiceUsage`) runs and returns before the `unstable_cache` boundary — only the resulting `Record<string, number>` (O(services), confirmed 5 services in the live baseline) crosses into the cache and into page memory, not the O(booking_items) rows. `src/app/admin/services/page.tsx:120` calls this helper directly and does no further in-memory reduction of `booking_items` itself (grepped — no other `booking_items` reference in `page.tsx`).

**Tag correctness:** `TAGS.BOOKINGS` (`services-data.ts:74`). `src/app/admin/bookings/actions.ts` (untouched by this commit) calls `updateTag(TAGS.BOOKINGS)` at 8 separate mutation sites (lines 569, 720, 902, 1108, 1255, 1344, 1412, 1710), so a booking mutation invalidates this cache.

**PostgREST aggregate unavailability, independently confirmed.** I ran my own SELECT-only HTTP probe (not the SQL tool, which talks to Postgres directly and would not exercise PostgREST's aggregate gate) against the live Data API using the project's public anon key:
```
GET https://twzutkfgqclqurvkmvqz.supabase.co/rest/v1/booking_items?select=service_id.count()
→ HTTP 400 {"code":"PGRST123","message":"Use of aggregate functions is not allowed"}
```
This reproduces the exact error the implementer and Phase C Step 8's verifier reported, confirming it independently rather than taking the prior claim on faith. `pg_roles.rolconfig` for `anon`/`authenticated`/`authenticator`/`service_role` shows no `pgrst.db_aggregates_enabled` override, consistent with the platform default (disabled) being in effect. **PASS.**

---

## CHECK 5 — N7 live bug fix

`src/app/admin/staff/[staffId]/page.tsx:552` and `:617` now emit `` `/admin/bookings?assigned_staff=${staffId}&view=all` `` (both the footer link and the "hidden assignments" banner link).

**`/admin/bookings` genuinely reads `assigned_staff`, verified by reading the page's own param handling, not assumed:**
- In-memory oracle: `src/app/admin/bookings/page.tsx:79` — `const assignedStaff = getQueryValue(query.assigned_staff) ?? "";`, applied at `:164-171` (`booking.booking_assignments.some(a => a.assigned_staff_id === assignedStaff)`).
- SQL predicate path: `src/app/admin/bookings/bookings-list-data.ts:215` (`assignedStaff?: string` on the filter type), `:372` (`if (ctx.assignedStaff) eq(...assigned_staff_id, ctx.assignedStaff)`), `:504` (`assignedStaff: value("assigned_staff")` — reads the actual query param into the SQL predicate context).

**`view=all` is a real view key:** `bookings-list-data.ts:307` has `case "all":` in the predicate switch, and `page.tsx:113` has `view === "all"` as an unconditional match in the in-memory oracle — both paths recognize it, they are not silently falling through to a default.

**Destination is fully paginated:** `page.tsx:16,22,327,374,505-512` import and use `LIST_PAGE_SIZE` and `PaginationBar` around `getBookingsListPage`, confirming C-16 Phase C's pager (not the old 25-row-unpaged interim state) backs this destination — every assignment reachable, so N7 correctly needs no second cap of its own. **PASS.**

---

## CHECK 6 — cap+view-all states, every instance, per-instance verdict

Five live `cappedOut`/`hidden`/`viewingAll` instances found (N7 does not use this shape — see below):

| # | Surface | Resolver | Branch order (file:line) | `cappedOut` href target | `hidden` href target | Same-URL risk |
|---|---|---|---|---|---|---|
| 1 | N6 client regular notes | `resolveClientNotesBannerState` (`client-detail-data.ts:519-543`) | `cappedOut` (533) → `hidden` (536) → `viewingAll` (539) | `notesRecentHref` (clears `notes=all`) — `page.tsx:1062` | `notesAllHref` (sets `notes=all`) — `page.tsx:1071` | None — `withNotesParam` (`page.tsx:152-159`) always flips the param relative to current state |
| 2 | N3 clinic blocked dates | `resolveAvailabilityBannerState` (`availability-data.ts:63-79`) | cappedOut (69) → hidden (72) → viewingAll (75) | `pastRecentHref` — `BlockedDatesManager.tsx:384` | `pastAllHref` — `:393` | None — `buildAvailabilityHref` toggles the one param |
| 3 | N3 clinic overrides | same resolver | same order, `AvailabilityOverridesManager.tsx:390-408` | `pastRecentHref` | `pastAllHref` | None |
| 4 | N4 staff blocked dates | `resolveStaffAvailabilityBannerState` (`lib.ts:89-105`) | cappedOut (95) → hidden (98) → viewingAll (101) | `pastRecentHref` — `StaffBlockedDatesManager.tsx:329/347` | `pastAllHref` — `:338` | None |
| 5 | N4 staff overrides | same resolver | same order, `StaffAvailabilityOverridesManager.tsx:420-441` | `pastRecentHref` | `pastAllHref` | None |

**N7 is structurally different, correctly so.** `hasHiddenStaffAssignments` (`staff-detail-data.ts:356-364`) is a single boolean, not a three-state union — because its only affordance is one link to `/admin/bookings?assigned_staff=...&view=all`, an external, fully-paginated destination (Check 5), not an in-page toggle. There is no "already viewing all, still capped" state to get wrong here since the destination has no cap of its own. **Verdict: all five instances correctly evaluate `cappedOut` before `hidden`; no instance renders a link to the current URL. PASS.**

(Check 1's finding is that `sensitiveNotes` has **no** cap+view-all state at all where the honest thing would have been at least a count/log signal — noted there, not double-counted here since it isn't one of this shape's five instances.)

---

## CHECK 7 — counts agree with their lists

- N6: `regularNotesCountQuery` (`client-detail-data.ts:399-403`) carries `.eq("client_id", clientId).eq("is_sensitive", false)` — identical predicate to `regularNotesQuery` (`:391-398`). Confirmed matching.
- N3: `blockedPastCountResult`/`overridesPastCountResult` (`availability/page.tsx:190-193, 212-215`) both use `.lt("blocked_date"/"override_date", today)` — identical to the `past` rows queries (`:184-189, 206-211`).
- N4: same pattern, `staff/[staffId]/availability/page.tsx:135-139, 154-158` vs. `:128-134, 147-153`.
- N7: `assignmentsTotal` count query (`staff-detail-data.ts:247-250`) uses `.eq("assigned_staff_id", staffId)` — identical scope to the capped `assignments` query (`:234-243`).

No predicate divergence found on any of the four counted surfaces. **PASS.**

---

## CHECK 8 — bounds in the query, not in memory

- N2: no `.limit()` by design (verdict is "restructure," not "cap" — PostgREST aggregates unavailable, Check 4) — the whole `booking_items.service_id` column is read server-side every time, but the *shape crossing into memory* is bounded by the in-cache reduction, which is what Check 4 verifies. Not a "`.slice()` after an unbounded fetch" defect because nothing is sliced — the full read is real and documented as the accepted residual.
- N3: `.limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP)` / `.limit(closedPastViewAll ? ... : ...)` are on the Supabase builder (`availability/page.tsx:183, 189, 205, 211`), not post-fetch array slicing.
- N4: same, `staff/[staffId]/availability/page.tsx:127, 134, 146, 153`.
- N6: `.limit(regularCap)` / `.limit(CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP)` on the builder (`client-detail-data.ts:397, 413`).
- N7: `.limit(assignmentLimit)` on the builder (`staff-detail-data.ts:243`). The only in-memory `.slice()` found, `visiblePastAssignments = pastAssignments.slice(0, 8)` (`staff/[staffId]/page.tsx:277`), operates over the already-query-capped 16-row `assignments` array, not an unbounded fetch — not a violation of this check's concern.

**PASS**, with N2 noted as a different (and correctly identified) case than the other four.

---

## CHECK 9 — test files, sabotage precision

Read `client-detail-data.test.ts`, `staff-detail-data.test.ts`, `availability-data.test.ts`, `lib.test.ts` (staff availability), `services-data.test.ts` in full.

- **`resolveClientNotesBannerState` branch-order sabotage** (`client-detail-data.test.ts:290-302`): input `{regularTotal: 225, regularShown: 200, viewAll: true}` — under the shipped order this is `cappedOut`; under a `hidden`-first swap it would wrongly report `hidden`. I traced the other four tests in that `describe` block against the same swap: none of their inputs fall in the ambiguous zone (`viewAll && total > VIEW_ALL_CAP` never simultaneously true with a different expected branch), so the swap flips exactly this one test — matching the implementer's "1 targeted failure" claim.
- **`hasHiddenStaffAssignments` `||`-narrowing sabotage** (`staff-detail-data.test.ts:211-225`): input `{assignmentsTotal: 12, fetchedCount: 12, pastCount: 12, visiblePastCount: 8}` returns `true` only via the second (`pastCount > visiblePastCount`) disjunct. Traced the other two tests in that block: `{40,16,5,5}` trips the first disjunct regardless; `{3,3,2,2}` trips neither regardless. Narrowing the `||` to the first disjunct alone flips exactly this one test — matches the "1 targeted failure" claim.
- `availability-data.test.ts` additionally carries an explicit non-sabotage test (`:54-64`, "cappedOut takes priority even when hidden's condition also holds") that asserts the ordering directly, which is a stronger pin than the swap-and-count method alone.

**Judgement: precise pinning, not thin coverage.** In both cases the sabotage-relevant input was deliberately chosen to sit in the exact ambiguous region where the two implementations (correct vs. sabotaged) diverge, and I independently confirmed no other test in the same file incidentally also flips — meaning the "1 failure" outcome is by design, not by accident of a sparse suite. This is the same standard the earlier phases of this plan applied to the identical bug shape (privacy notes, password requests) and it holds here too.

**PASS**, with the caveat already stated in Check 1: this precision covers `regularNotes`/`hasHiddenStaffAssignments`/N3/N4 correctly, but there is no equivalent test (because there is no equivalent code) asserting anything about `sensitiveNotes` exceeding its cap.

---

## CHECK 10 — mechanical rules

- **`border-l-4`:** `git show e822e12 | grep border-l-4` → no matches. **Clean.**
- **`updateTag` vs `revalidateTag`:** `git show e822e12 | grep revalidateTag` → no matches; all cache invalidation in the touched files' surrounding `actions.ts` (untouched by this commit) already uses `updateTag`. **Clean.**
- **`createSupabaseAdminClient()` only after `getStaffProfile()`:** verified call order in all five page-level entry points — `availability/page.tsx` (getStaffProfile:128, admin client:234), `staff/[staffId]/availability/page.tsx` (43, 98), `staff/[staffId]/page.tsx` (134, admin client created inside `getStaffDetailData` called at 195), `clients/[clientId]/page.tsx` (290, admin client created inside `getClientDetailData` called at 323), `services/page.tsx` (97, admin client created inside `getServiceUsageCounts` called at 120). All correct order.
- **Cache keys JSON-safe, no `Set`/`Map`/`Date`, no ms `Date.now()`:** `cacheKeyPart({...})` calls in `client-detail-data.ts:462-473` and `staff-detail-data.ts:324-340` pass only strings/booleans/numbers/plain objects (`accessWithoutAssignment`, `accessWithAssignment` are plain flag objects). No `Date.now()` anywhere in either cache-key construction (`git show e822e12 | grep "Date.now()"` → no matches in added lines).
- **No new hardcoded `oklch(...)`:** `git show e822e12 | grep "^+.*oklch("` found two `+` lines, both in `BlockedDatesManager.tsx`/`AvailabilityOverridesManager.tsx` reusing the literal `hover:bg-[oklch(95.5%_0.028_20)] hover:text-[oklch(26%_0.14_25)]`. Checked the pre-commit blob (`git show e822e12^:.../BlockedDatesManager.tsx`) — this exact literal already existed at the old line 352 (the `ClosureRow` delete button); the diff shows it as delete+re-add only because the surrounding component was reindented/relocated during the upcoming/past restructure, not because a new color was introduced. **No new hardcoded color.**
- **Clean at 375px:** **not independently verified — no credentials or live render available to this subagent.** Structural read only: all touched components reuse the same responsive utility classes (`sm:`, `-mx-4 overflow-x-auto`, flex-wrap patterns) already present elsewhere in these same files pre-commit; no new fixed-width elements were introduced in the diff. This is a structural judgement, not a live check, and should not be read as a substitute for one.

**PASS** on every mechanically-checkable item; 375px item explicitly not run.

---

## CHECK 11 — baselines by identity

- **`npx tsc --noEmit`** → 0 output, exit clean. **0 errors — matches baseline.**
- **`npx vitest run`** → `Test Files 2 failed | 186 passed (188)`, `Tests 5 failed | 1709 passed (1714)`. Failing tests by name:
  - `src/lib/auth/admin-access.test.ts` — "gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management" (2)
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx` — "renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent" (3)
  
  **Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 — matches the inherited baseline BY IDENTITY, no swapped-in failure.**
- **`npx eslint .`** → `✖ 66 problems (59 errors, 7 warnings)`, in exactly six files: `design_handoff_area_pages/prototype/area-page.jsx`, `.../shared.jsx`, `.../site-chrome.jsx`, `src/features/booking/BookingExperience.tsx`, `src/features/booking/BookingExperienceLoader.tsx`, `src/features/booking/utils/returning-customer.ts`. **59 errors / 7 warnings in exactly six files — matches baseline BY IDENTITY.**

**PASS** on all three, by identity.

---

## Summary

| Check | Result |
|---|---|
| 1 — client notes safety claim | **FAIL (blocking)** — "never truncated" is inaccurate; silent, unsignalled truncation on a safety-scanned list |
| 2 — N3/N4 upcoming judgement | Conscious, defensible verdict; same observability gap in lower-severity form, noted not blocking |
| 3 — files-touched scope | PASS |
| 4 — N2 cache-boundary reduction | PASS (independently re-confirmed PGRST123) |
| 5 — N7 live bug fix | PASS |
| 6 — cap+view-all states | PASS (5/5 instances correct order, no same-URL links) |
| 7 — counts agree with lists | PASS |
| 8 — bounds in query not memory | PASS |
| 9 — test precision | PASS (precise pinning, not thin) |
| 10 — mechanical rules | PASS (375px not independently verified — no credentials) |
| 11 — baselines by identity | PASS (tsc 0, vitest identity, eslint identity) |

**Overall: FAIL**, on Check 1 alone. Every other check passed on the evidence gathered. Recommended remediation (for whoever picks this up next, not implemented here): add a cheap `count`-only query for `is_sensitive = true` mirroring `regularNotesCountQuery`, and surface it — at minimum as a server-side log/alert if `sensitiveNotesTotal > CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP`, ideally as a visible banner — so the "never truncated" claim becomes true rather than aspirational.
