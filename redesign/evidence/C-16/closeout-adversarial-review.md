# C-16 — Adversarial full-diff review (drift checkpoint #3 → HEAD)

**VERDICT: FAIL**

Range swept: `git diff 74ed6ed..HEAD` (74ed6ed = drift checkpoint #3, immediately before C-16 opened; HEAD = `4a9bef9`). 71 source files, ~12,950 insertions / ~1,210 deletions under `src/app/admin/**` + `src/lib/pagination.ts`, plus `redesign/evidence/C-16/**` and the C-16 progress file. Commit list cross-checked via `git log --oneline --reverse 74ed6ed..HEAD` (20 commits). Read-only throughout; no writes made anywhere except this file.

The FAIL is driven by Finding 1: two unbounded, unmitigated table reads survive on this plan's own flagship surfaces — `/admin/clients` (Phase C Step 8, the plan's second "heavy hitter") and the client-detail page (touched twice more in this same range by the Owner-approved N6 extension). Both directly contradict the plan's own standing rule text ("no unbounded list queries, **ever**") and the brief's acceptance criterion (§10.2: "clients... lists query only the visible page"). This is not a hypothetical: I independently re-read both query sites end-to-end (not merely trusted the evidence file that first surfaced them) and confirmed the caller-side gap that leaves them unbounded in production today. Everything else below is ranked beneath that.

---

## Finding 1 (BLOCKING) — Unbounded queries survive on the plan's own flagship pages

A separate closeout gate-runner already produced `redesign/evidence/C-16/closeout-static-gates.md` (§3.2, VERDICT: FAIL, 39-row full sweep) — currently **uncommitted** in the working tree, so it is evidence I read directly from disk, not from git history. I independently re-derived its two most severe rows from source rather than taking the file's word for it:

**1a. `/admin/clients`'s own candidate query is fully unbounded.** `src/app/admin/clients/clients-list-data.ts:625-644` (`getClientCandidates`):
```ts
const { data } = await applyClientPredicates(
  createSupabaseAdminClient().from("clients").select(CLIENT_CANDIDATE_SELECT),
  plan.steps
).order("full_name").order("id").returns<ClientCandidate[]>();
return data ?? [];
```
No `.range()`, no `.limit()`, no defensive cap of any kind — every `clients` row matching the SQL-expressible predicate plan is read (id/full_name/created_at only — a narrow projection, but full row count, not O(page size)). The progress file's own §5.1 text ("That one query still scans `bookings` server-side... **this is the one thing** standing between the clients list and a fully bounded query") is factually incomplete: it names only `getClientBookingSummaries`'s `bookings` scan as the residual and states there is exactly one. `getClientCandidates`'s `clients` scan is a second, undocumented one. **Failure scenario:** at the brief's own 5-year projection (~3–6k clients), any filter/search matching a large slice of the table (e.g. a common surname, or the default "active" lifecycle filter matching most of the base) reads thousands of rows into a server render before the page-window slice happens — precisely the growth-cliff class this entire plan exists to close. Because `total = candidates.length` and `rows` is a slice of that same array, the "Showing X–Y of Z" readout stays *honest* (no truthfulness bug) — this is a scale/architecture violation of the plan's own standing rule, not a UI lie.

**1b. Client-detail's booking-history rail is unconditionally unbounded in production.** `src/app/admin/clients/[clientId]/client-detail-data.ts:399-408` (and the assigned-only variant at ~429-438):
```ts
let bookingsQuery = adminClient.from("bookings").select(bookingSelect)
  .eq("client_id", clientId).order("booking_date", { ascending: false }).order("start_time", { ascending: false });
if (limit !== undefined) {
  const start = offset ?? 0;
  bookingsQuery = bookingsQuery.range(start, start + limit - 1);
}
```
The `.range()` call is conditional on a `limit` parameter the function accepts. I checked the only call site — `src/app/admin/clients/[clientId]/page.tsx:339-347`, the `getClientDetailData({...})` call — and it passes `clientId, staffId, hasAllClientAccess, accessWithoutAssignment, accessWithAssignment, notesViewAll, sensitiveNotesViewAll`. **No `limit` or `offset` field is passed.** Every client-detail page render therefore reads that client's entire booking history with zero bound. **Failure scenario:** a long-tenured weekly client (the brief's own worked example of "why this plan exists") accumulates hundreds of booking rows over 5 years; every time any staff member opens that client's profile, the full history is read, unbounded. This is on the **same page** the Owner-approved N6 extension (e822e12, f27a9da) already modified in this exact range to add cap+view-all to the *notes* rail sitting right next to this query — the notes rail got fixed; the booking-history rail two fields over did not, and is not named in the N2–N7 amendment table (progress file §2) or logged as a conscious exclusion anywhere.

Neither 1a nor 1b is covered by the Owner's three named exclusions (`reporting.ts`/dashboard/calendar per decision 2; `audit/queries.ts`; the `booking_items`/`bookings` aggregate-disabled residuals in `clients-list-data.ts`/`services-data.ts`, both explicitly self-documented). They are silent gaps, not conscious deferrals.

**Recommendation:** give `getClientCandidates` the same treatment `bookings`' scoped-practitioner path already got (`SCOPED_BRANCH_ROW_CAP` + code comment) — a defensive ceiling with a comment explaining why, at minimum, until a real architectural fix lands. For the booking-history rail, either wire `limit`/`offset` through from the page (it's already plumbed as far as the data-layer signature) or add the same defensive cap pattern used everywhere else in this diff (`AVAILABILITY_UPCOMING_DEFENSIVE_CAP`, `CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP`, etc.) — the precedent is already established in the very same file for the notes rails.

---

## Finding 2 — The Owner-authorised critical-note regex widening introduces a new false-positive class it does not test for

`ed9d31b` (Owner-authorised per dispatch — not reported as scope creep) widened `CRITICAL_NOTE_PATTERN` (`src/app/admin/clients/[clientId]/client-detail-data.ts:142`) from
`/\b(allerg(y|ic|ies)|anaphyla|epipen|contraindic|urgent|warning|do not|avoid)\b/i`
to
`/\b(allerg|anaphyla|epipen|contraindic|urgent|warning|do not|avoid)/i`
(dropped the trailing `\b`). The stated, tested intent is narrow: fix `anaphyla`/`contraindic`, which were dead branches because "anaphylactic"/"contraindicated" never appear as standalone words. But dropping the trailing boundary loosens **every** branch, not just those two — including the two-word `"do not"` branch and the single-word `"avoid"` branch, both of which worked correctly before and did not need widening.

Empirically verified (node, the actual `CRITICAL_NOTE_PATTERN` literal copied verbatim from the shipped file):
```
"Client asked to do nothing more than light stretching this week." => true
"Please do notice the change in posture."                          => true
"Plan: continue current exercises, do nothing new this week."      => true
```
These are ordinary, clinically-plausible notes with no allergy/contraindication content, and all three now trip the "Critical note" patient-safety banner (`client-detail-data.ts:406-407`, `find()` over the affected rail). `"avoid"` also now matches `"avoidance"`/`"avoidant"` as prefixes, a softer but related widening.

The commit's own test additions (`__tests__/client-detail-data.test.ts`, added by `ed9d31b`) cover: 8 previously-dead-branch positives (anaphylactic, contraindicated, etc.), 5 "no regression" positives, and exactly 2 negative cases (`"insurgent"` — an embedded-substring check on the **leading** boundary that the widening deliberately preserved — and one clean sentence with no keyword substring at all). **No test exercises the blast radius of removing the *trailing* boundary on the two branches that didn't need widening** (`"do not"`, `"avoid"`), so this gap shipped with green tests.

**Why this matters more than an ordinary false positive:** this is the same "Critical note" banner this plan's own history already shipped a *silent-miss* version of (`e822e12` → fixed `f27a9da`, both already Owner-acknowledged and out of scope to re-report). A banner that now over-fires on benign phrasing degrades staff trust in the same signal that under-fired three commits earlier — alarm fatigue on a clinical-safety control is a real, if different-shaped, instance of the "truthfulness of UI" defect class the dispatch asked me to hunt hardest for.

**Recommendation:** scope the trailing-boundary removal to only the two branches that actually needed it — e.g. `/\b(allerg\b|anaphyla|epipen|contraindic|urgent\b|warning\b|do not\b|avoid\b)/i` (re-adding `\b` after every branch except `anaphyla`/`contraindic`, and widening `allerg` deliberately per its own comment) — and add negative tests for `"do nothing"`, `"do notice"`, `"avoidance"`, `"avoidant"` so the next widening can't reopen this silently.

---

## Finding 3 — Master-plan checklist row never flipped, contrary to the plan's own hand-off text

`redesign/plans/C-phase/BAND-C-MASTER-PLAN.md:461` (untouched by any commit in `74ed6ed..HEAD` — confirmed via `git diff 74ed6ed..HEAD -- redesign/plans/C-phase/BAND-C-MASTER-PLAN.md`, zero output) still reads:
> `⏳ (brief + plan ✅) · **PRE-FLIGHT PREP DONE 2026-08-03 — see the note directly below this table**` … `Implementation ⏳ pending.`

This directly contradicts:
- Plan §7 cadence table, commit 8: *"Verification — screenshots + progress file + master plan checklist → ✅."*
- Plan §8 hand-off, item 5: *"Final commit flips the master-plan C-16 row → ✅."*

The final commit in range, `4a9bef9`, touched only `redesign/evidence/C-16/roles-visual-checklist.md` (`git show --stat 4a9bef9`). The standing-rule *text* in Part 0 (`BAND-C-MASTER-PLAN.md:429`) was already present before `74ed6ed` (confirmed via `git log -- BAND-C-MASTER-PLAN.md`, landed at `bd1182e`, pre-range) — so Step 15's rule-wiring half is genuinely done; only the "tick it in C-16's own gate" half (the row status) is outstanding. **Concrete risk:** the next reader of the master plan — human or agent — sees "Implementation ⏳ pending" for a plan that is, per every other artifact in this range, fully shipped and verified, and may re-plan or re-dispatch work that's already done.

---

## Finding 4 — Progress file stops documenting after Phase D; Phase E and the regex incident are absent from it

`redesign/per-page-progress/C-16-data-growth-pagination-progress.md` was last committed at `3bd82d7` (`git log --oneline -- <file>`; working tree matches HEAD exactly, `git status --porcelain` empty for this path). Its own §8 "Position" section still reads *"Phase C Step 5 ✅ ... **Steps 6–7 in flight**"* — stale relative to its own §7, which already documents both Phase D batches complete two sections earlier. More materially: **the file contains no Phase E section at all** — Step 13 (roles), Step 14 (the five-surface sweep, `e822e12`/`f27a9da`), and the critical-note regex incident (`ed9d31b`) are undocumented in the one file whose job is to be "read in FULL first" as the record of "every Owner decision and every deviation already reasoned about." A reader relying on this file alone (as I was instructed to) would not learn Phase E happened, that Step 14 failed verification once (the clinical-safety scan gap, `e822e12` → `f27a9da`), or that the regex was subsequently widened — only `git log` surfaces those.

---

## Finding 5 — Step-14 and gate-runner closeout evidence exists only in the uncommitted working tree

`git status --porcelain` shows three `redesign/evidence/C-16/*.md` files as untracked (`??`): `step14-verify-full.md`, `step14-fix-reverify.md`, and `closeout-static-gates.md` (the file Finding 1 draws on). Every other phase's verify-full/fix-reverify pair in this plan **was** committed (`phase-b-verify-full.md`, `step5-verify-full.md`, `steps67-verify-full.md`, `step8-verify-full.md`, `steps910-verify.md`, `step9-fix-reverify.md`, `steps1112-verify.md`, `step12-fix-reverify.md` — all present via `git show HEAD:...`). Step 14's pair and the static-gates closeout break that pattern. This likely reflects a closeout process still in flight at the moment of this review (the static-gates file is itself dated to a run against this same HEAD) rather than abandonment — but as delivered at `4a9bef9`, this evidence would be lost on any tree-cleaning operation, unlike every sibling artifact.

---

## Finding 6 — Unlogged cadence deviation: Step 8 landed after Phase D, contrary to the plan's explicit ordering

`git log --oneline --reverse 74ed6ed..HEAD` shows Phase C Step 8 (`2f376f9`, clients + enquiries) landing **after** both Phase D batches (`dc26dc0` Steps 9–10, `66e9391` Steps 11–12, and Step 9's fix `6faf895`) — not before them, as plan §7's cadence table (Step 8 = commit 4, before commits 5–6) and plan §8 hand-off ("B → C → D → E **in order**") both specify. The progress file's only recorded process deviation (§7.1, "write-pipelining dropped mid-plan") describes a different issue — commit *pipelining within* Phase D — not this cross-phase reordering, so this specific deviation is unlogged anywhere. Practical impact is low (Step 8's surfaces are independent of Phase D's, and it was still verified at tier FULL per progress §5.1), but it is exactly the class of thing a single-phase reviewer would not see, and the plan's own text treats phase order as a hand-off requirement, not a suggestion.

---

## Swept and clean (checked, found nothing)

**A — UI truthfulness (the plan's "defining defect class"), beyond Finding 2:**
- All "Showing X–Y of Z" readouts (bookings, clients, enquiries, emails, operations, privacy-queue) route through the single shared `PaginationBar` (`src/app/admin/components/PaginationBar.tsx:74-75`) — `from`/`to` formula (`Math.min(page*pageSize, total)`) and `pageCount<=1 → render nothing` verified by direct read, not sampled.
- Every cap+view-all "hidden rows" banner-state resolver in the diff — `resolvePasswordRequestsBannerState`, `resolveAvailabilityBannerState`, `resolveStaffAvailabilityBannerState`, `resolveClientNotesBannerState`, `resolveClientSensitiveNotesBannerState` — checked byte-for-byte: identical 4-state shape (`none`/`hidden`/`cappedOut`/`viewingAll`), identical `cappedOut`-before-`hidden` branch order (the bug shape that shipped twice already on this plan, `6faf895`/`6fa19ce`). No third or fourth instance of that specific ordering bug found.
- `operations-board.tsx`'s `multiPage` prop correctly gates the "Nothing open / clinic is humming" global-sounding copy so it can't claim page-scoped emptiness is clinic-wide (`operations-board.tsx:367-371`); the old per-column client-side "Load more" cap was fully removed, not left as a dead second affordance (`operations-board.tsx:378-392`).
- Staff assigned-bookings panel's simpler binary `hasHiddenAssignments` check (vs. the 4-state union elsewhere) is correct, not a regression: its "view all" link (`staff/[staffId]/page.tsx:552,617`) now points at the fully-paginated `/admin/bookings?assigned_staff=...&view=all`, which has no secondary cap to fall into — the `cappedOut` state doesn't apply here by construction.
- Count/rows single-source-of-truth confirmed for every paginated surface by reading the shared predicate-application function each count and rows query both call: `applyBookingPredicates` (bookings), `applyClientPredicates` (clients), `applyEnquiryFilters` (enquiries, both call sites at `enquiries-data.ts:269,328`), `applyDeliveryPredicates` (emails), `applyOperationsPredicates` (operations), `applyPrivacyRequestFilters` (privacy, both call sites at `privacy-data.ts:187,300`).
- No additional millisecond-precision `Date.now()`-into-cache-key instance beyond the one already fixed in `emails-data.ts:353` (grepped `Date.now()`/`new Date()` across every touched file; all other occurrences are either comments, client-side ids, non-cached render-time diffs, or already-day-floored strings via `toIsoDate(new Date())`/`.slice(0,10)`).

**B — Scope creep:** none found beyond what's already Owner-recorded. Every touched file traces to a plan step or one of the four recorded extensions (operations verdict, `reporting.ts` exclusion, the six N2–N7 surfaces, the component-file extension).

**C — Lost steps:** all 15 plan steps have code, a conscious verdict, or a recorded deferral — see Findings 3–4 for the two bookkeeping gaps (checklist flip, progress-file currency) and Finding 1 for where Step 8 and the N6 extension's own acceptance bar (query-boundedness) is not actually met despite being marked done.

**D — Style drift:** no `border-l-4`; no `revalidateTag` (`updateTag` used throughout, grepped project-wide across the diff); `createSupabaseAdminClient()` consistently called after `getStaffProfile()`/the permission gate in all 12 page.tsx files checked. The two new `oklch(...)` literal lines (`AvailabilityOverridesManager.tsx`, `BlockedDatesManager.tsx`, identical delete-button hover style) are exact duplicates of a pattern already present in the same files before this range (`git show 74ed6ed:...BlockedDatesManager.tsx` line 352) — correct "match existing style," not new drift. The two new `transition-transform` additions (chevron rotation on new disclosure toggles) are automatically covered by the pre-existing global `prefers-reduced-motion` rule at `src/app/globals.css:437-446` (`*, *::before, *::after { transition-duration: 0.01ms !important; ... }` under the media query) — no per-component work was missing.

**E — Weakened/vacuous tests:** the two largest, highest-risk new specs — `view-predicates-parity.test.ts` (965 lines, 35 cases) and `clients-list-page.test.ts` (547 lines) — were read in depth. Both build a faithful interpreter of the recorded PostgREST filter calls (throws on an unrecognised operator rather than silently no-op'ing) rather than a mock that ignores predicates, and both carry an explicit self-aware design comment stating exactly this design goal. `resolveDeliveryDateBounds`'s correctness test uses `vi.setSystemTime` + hardcoded ISO-string expectations (not the older self-referential "two calls agree" pattern, which was correctly kept separately for cache-stability testing only). I did not exhaustively read all ~4,800 lines of new/changed test code (e.g. did not deep-audit `booking-view-counts.test.ts` or every `it.each` block elsewhere) — this section's coverage is risk-sampled on the largest/newest files, not exhaustive, and I am not claiming otherwise.

**F — Cross-surface consistency:** `clampPage`/`pageRange`/`pageCount = Math.max(1, Math.ceil(total/pageSize))` verified byte-identical across all 6 call sites (bookings, clients, emails, enquiries, operations, privacy). Page-reset-on-filter-change confirmed by construction for bookings (`BookingsChrome.tsx:110` explicit `params.delete("page")`, plus the C-07 saved-view page-free comparison at `:285-289`) and clients (`buildPageHref`, `clients/page.tsx:695-713`, builds fresh params from a filters object that structurally excludes `page`); the other four surfaces use the analogous rebuild-from-filters pattern at their respective `makeHref` call sites, checked but not traced as deeply link-by-link as bookings/clients.

**G — Commit cadence:** all fix-round commits (`241d668`, `24889f4`, `6faf895`, `6fa19ce`, `f27a9da`, `ed9d31b`) map cleanly to documented verify-FAIL → fix → re-verify cycles; no undisclosed rework or squash found. One real deviation from the plan's explicit ordering found and reported as Finding 6.

---

*Written by a read-only reviewer subagent per `redesign/plans/C-phase/SUBAGENT-RULES.md`. Only write: this file. No client note content or client identifiers are reproduced above.*
