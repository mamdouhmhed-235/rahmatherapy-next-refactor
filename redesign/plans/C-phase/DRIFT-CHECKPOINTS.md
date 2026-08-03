# Band C — Programme Drift Checkpoints

Durable record of the 4 programme-wide drift checkpoints required by protocol §2.6 (after plans #5, #10, #15, #20). Each runs one `opus` adversarial reviewer diffing the full range since programme start (`7fe8b4f`) against Part 0 conventions and the baseline-gate history, hunting cross-plan drift no single-plan review can see. This file is read at §0 bootstrap alongside the other standing-state files.

---

## Checkpoint #1 — after plan #5 (C-05), run 2026-07-29

**Range:** `7fe8b4f..8682f3b` — 128 files, +17,508/−402, 78 commits, 3 migrations. Plans covered: C-21, C-22, C-06, C-04a, C-05.

**Verdict: PASS.** No blocking findings, no fix round, no STOP. Full independent gate re-run at HEAD confirmed clean: tsc 0 · lint 59E/7W (six files, exact per-file counts) · vitest 5 failed/773 passed/778, identity-exact.

### Advisory findings (logged, not fixed — none blocking)

- **D1 — copied compatibility shim, now doubly dead.** `MISSING_COLUMN_CODES`/`hasErrorCode` exist byte-identically in `clients/actions.ts` (C-06) and `bookings/actions.ts` (C-04a) — a knowing copy (C-04a's own comment cites C-06's version). Both are pre-migration guards that died once their own migration applied; C-04a logged its copy as dead, C-06's copy (killed by C-04a's migration, not its own) was never logged anywhere. Inert today. **Action for whichever of C-02/C-08/C-14 next needs this shape: share one helper, retire both copies.**
- **D2 — three "today in London" implementations on one surface.** Canonical `getBusinessDate` (`src/lib/time/london.ts`, 45 call sites) + C-05's `getTodayIsoDate` (legitimately lifted, pre-existing) + a **new** `getLondonToday` (`bookings/access.ts`, C-05 Phase A) all coexist; `addDaysISO` duplicates `addBusinessDays`. Not a bug today (all correct for date-only, non-DST-boundary use), but a maintenance hazard if the three drift. **No action mandated; flag for whoever next touches `bookings/access.ts`.**
- **D3 — UI/server predicate split `_helpers.ts` exists to prevent.** C-05's `isBookingActive` (`[bookingId]/page.tsx`) hand-inlines a mirror of `ensureBookingActive` rather than sharing it, and the mirror is already incomplete (doesn't check `deleted_at` on either table). Unreachable today — C-06's cascade forces soft-deleted bookings to `cancelled`/`completed`, both already inert by the mirror's own status check — but wrong the instant something produces a soft-deleted booking in another status. **No action mandated; watch if C-02/C-09/C-16 touch this file.**

### Part 0 convention compliance: clean
Zero new `border-l-4`, zero `revalidateTag(`, all `createSupabaseAdminClient()` sites properly gated, zero `Set`/`Map`/`Date` through `unstable_cache` (zero new `unstable_cache` usage at all in range). One standing, already-logged (C-22 §6.1) Part 0 rule-11 deviation carried forward, not new: the booking-form honeypot's Tailwind-utility className in an otherwise CSS-module tree, plan-mandated not improvised.

### Sonnet/Opus divergence: sample too small to be conclusive, no action
§5 model routing didn't exist until 2026-07-28 (commit `ce459f1`) — C-21/C-22/C-06 shipped, and C-04a was mid-flight, before it landed. All of C-21/C-22/C-06/C-04a actually ran on **Opus** (commit trailers confirm); only C-05 ran on **Sonnet** (the first plan run entirely under §5). So this checkpoint's real Sonnet-vs-Opus sample is n=1, not the expected mix. On that n=1: no jarring divergence — C-05's code is idiomatically indistinguishable from the surrounding Opus work (matching comment-header conventions, matching test-scaffolding patterns down to specific reused phrasing). **Re-assess properly at checkpoint #2**, once more Sonnet-routed plans (C-01, C-FIELDWORK, C-08, C-15, C-13, C-09, C-03, C-07, C-16 are all Sonnet per §5) have landed alongside the opus-routed C-02/C-11.

### Deviation-pattern accumulation — three signals worth carrying forward
1. **Un-runnable-gate backlog is growing unbounded.** Role×viewport Playwright sweeps are structurally agent-impossible (no authentication). 5 plans in, ~20 discrete Owner action items live across 5 separate progress-file appendices, with 17 plans still to come. See "Owner Action Backlog" below — consolidated per this checkpoint's recommendation.
2. **The Cloudflare deploy keeps growing.** Already three-in-one (C-22 DO migration + cron activation + the only C-04a queue drain). C-01 (plan #6, next) adds cron work too, making it four-in-one before it's ever applied. **Recommendation: apply it before C-01 starts, once Owner-approved** — every plan it stays pending, the bundle gets harder to reason about and more of the shipped work sits functionally inert in production.
3. **Cross-plan hand-off notes have no protocol-mandated carrier and can get silently narrowed or mis-diagnosed across a hand-off.** Two live instances found and corrected in `C-05-cancelled-bookings-inert-progress.md` §5 (2026-07-29 addendum): a hand-off item from C-04a's notes that C-05's actual Owner-approved plan never scoped (not a drop, a stale forward-reference); a hand-off item from C-06's notes narrowed from 11 sites to 2 without an explicit re-scoping decision (currently harmless — unreachable in practice). Also: C-05's own progress file was initially missing the "baseline identity AFTER" section every prior plan carried — added retroactively by this checkpoint. **No protocol change made** (that's an Owner-level call, not this checkpoint's to unilaterally impose) — but going forward, each plan's pre-flight should read the immediately-preceding plan's progress-file closing section for any hand-off notes addressed to it, not just the plan/brief text.

### Recommendations status
1. Offer the Cloudflare deploy before C-01 — **presented to Owner in chat 2026-07-29, still awaiting explicit approval; not re-litigated here.**
2. Write C-05's missing baseline-identity block — **done**, same commit as this file.
3. Consolidate the Owner backlog into one running file — **done**, see `redesign/per-page-progress/OWNER-ACTION-BACKLOG.md`.
4. Fold cross-plan hand-off reading into plan-start practice — **adopted as standing orchestrator practice going forward** (not a protocol-file edit — Owner's call if they want it formalized there).
5. Share/retire the D1 shim — **logged for whichever plan next needs the shape (C-02/C-08/C-14 candidates).**
6. One Owner ruling on the evidence-PNG convention — **not urgent; C-21's existing reasoned decision stands as the de facto default (don't commit large screenshot sets) unless the Owner says otherwise.**

---

## Checkpoint #2 — after plan #10 (C-15), run 2026-08-01 on `opus` — **FAIL**

Range `7fe8b4f..0bb356d`: 162 commits, 239 files, +36,666/−4,036, 7 migrations, 10 plans. Independent gate re-run at HEAD: **lint 59E/7W in exactly the six inherited files · vitest 5 failed / 1107 passed (1112), identity-exact.**

### What held up

**Part 0 conventions: clean.** Zero `border-l-4` repo-wide. Zero `revalidateTag`. Every new `createSupabaseAdminClient()` site gated behind `getStaffProfile()` (or `CRON_SECRET` on the cron routes). Zero new `unstable_cache` usage. No fixed-pixel widths added. C-22's honeypot Tailwind exception is still the *only* one in `src/features/booking` — it did not become a pattern.

**The eslint-accumulation worry was wrong, and measurably so.** Total suppressions in `src/` went **45 → 37** across the programme: +9 added, −17 removed (C-15 Phase F's deletions), net **−8**. Of the 24 files carrying suppressions, 19 pre-date the programme. `exhaustive-deps` already had 13 pre-existing suppressions, so C-15's justification-by-idiom holds for both rules it touched, not just the one its narrative argued.

**Baseline discipline is the strongest part of the run.** The five failures are identity-exact at HEAD, unchanged in character. **No test was skipped, weakened or deleted to keep a gate green** — zero `.skip`/`.todo`/`xit`/`xdescribe` in `src/`, `e2e/` untouched across the whole range. All six modified pre-existing specs were read diff-by-diff: five purely additive; `createBookingTransaction.test.ts` was **strengthened** (its exact-equality assertion gained six keys rather than degrading to `objectContaining`) — that is C-06's expected shrinkage, correctly earned. The two deleted spec files went with the two unwired dashboard blocks C-11 removed under Owner approval.

**Sonnet vs Opus: no substantive divergence.** The likeliest fault line — server-action error handling — turned out to show rule 11 working: C-06 (Opus) throws, C-08 (Sonnet) returns a result object, and *each matches its own file's pre-existing idiom*, with C-08 saying so in-line. Test structure was indistinguishable between C-04a (Opus) and C-08 (Sonnet). Where they differ is narrative confidence in progress files, not code — and that cuts both ways (see F-5 below, and a C-11 Opus-authored grep claim that was not freshly re-run).

**Migrations: 7 applied, 7 committed files, 7 approval records — no orphans in either direction.** `maintenance.ts` exactly as §3b requires: working copy `false`, HEAD `true`, last touched by pre-programme `35bf817`, never staged.

**Email subsystem, audited across the four plans that reshaped it:** no `template_id`/`eventType` mismatch anywhere (all 16 traced); `escapeHtml(substituteVars(...))` ordering intact at all 60 escape sites — no injection vector; no earlier plan's fix undone by a later one; C-15's test-send recipient lock and draft-preview auth both correct.

### Findings

**F-1 — BLOCKING (process, orchestrator-owned).** Plan #11's Phase A was dispatched **while this checkpoint was running**, mutating the shared tree mid-audit. The checkpoint inferred an unauthorised second session; **it was the orchestrator**, over-parallelising after an Owner request to use workflows for speed. Its gate runs predated the writes, so the measurements above are clean-HEAD — by luck, not design. The work is committed under its own plan id (`af273e8`) and independently verified PASS. **Correction adopted: drift checkpoints complete before the next plan's implementation begins. Read-only prep may still run in parallel; writes may not.** §2.8(c) already said this; it was misapplied.

**F-2 — BLOCKING (product).** **Every already-delivered "Manage this booking" link dies when a newer email goes out.** `ensureBookingManageUrl` mints a fresh UUID and overwrites the single `manage_token_hash`; validation is an exact hash match on that one column, so only one token is ever live. Send sites requesting a manage URL went **1 → 3** in range (independently re-counted: `includeManageUrl: true` = 1 at `7fe8b4f`, 3 at HEAD), the two new ones added by C-08 Phase A in `sendBookingConfirmedClientEmail` and `sendClientAssignedTherapistEmail` — the latter firing on *every* assign, reassign and claim. A customer opening the oldest email in the thread gets an invalid-link page for a valid booking, silently. **Invisible from inside C-08**, whose review this passed: C-08 added send sites, while the rotation lives in `manage-token.ts`, a file it never touched. No remaining plan owns that file, so absent a fix it ships at the end-of-programme deploy. Raised with the Owner 2026-08-01.

> **✅ F-2 and F-6 FIXED 2026-08-01 — `34e45da`, Owner-authorised in chat ("yes go ahead and fix them, so long as we aren't removing anything unnecessarily"), independently verified PASS with zero findings.**
>
> **F-2:** the pre-C-08 invariant is restored — the manage token is minted **once at booking creation** and no notification send rotates it. The two C-08 Phase A paths now route through a new non-rotating `getExistingBookingManageUrl()`. Booking creation still mints at all three creation sites (`sendBookingCreatedEmails`, `api/bookings/route.ts`, `admin/bookings/actions.ts`), all untouched. **Stated trade-off:** `booking_confirmed_client` and `client_assigned_therapist` lose their "Manage this booking" CTA — correct, since the alternative is continuing to kill the link in the email customers actually keep. All four affected renderers degrade cleanly (`input.manageUrl ? … : ""`), so no dangling button or orphaned label. The two pre-existing specs were **strengthened, not relaxed**: `ensureBookingManageUrl` is now mocked to *reject*, so any future reintroduction of `includeManageUrl: true` on a notification path fails loudly. **Follow-up logged, not attempted:** supporting multiple concurrently valid tokens needs a schema change (a lookup-able token table) and is out of scope for a fix round.
>
> **F-6:** `sendReviewRequestEmail` now calls `pickReviewMessages` and `resolveTemplateOverrides` **once each** and passes both into the HTML and plain-text legs, so the two MIME parts can no longer disagree. `renderReviewRequestEmail` gained an optional `providedVariants` mirroring C-15's `providedOverrides` seam; both other callers pass nothing and are unaffected. The regression spec asserts **values**, not call counts — it captures the real picked variants and asserts each appears in both bodies, so a second independent pick fails it even if the count coincidentally stayed at 1. **Deliberately not widened:** the same double-fetch shape survives on five other templates and stays logged below.
>
> Gate at `34e45da`: tsc 0 · lint 59E/7W same six files · vitest **5 failed / 1121 passed (1126)**, the five inherited by identity · build clean · render-parity 13/13 with its fixture byte-for-byte unedited.

**F-3 — NON-BLOCKING.** Resend has no status awareness and can resurrect a cancellation that C-04a's Undo deliberately suppressed: the button renders on `cancelled_by_restore` rows, and `dispatchResend` re-sends the customer leg plus the staff fan-out with no booking-status check.

**F-4 — NON-BLOCKING.** C-15 added **9 hardcoded light-only colour literals** to three brand-new admin files (`TokenTextField`, `LivePreview`, `TemplateEditor`) after C-11 made admin dark-capable — including `border-[oklch(40%_0.14_25)]`, verbatim the *light* arm of `--admin-danger-solid`. Dark is the default (all 12 staff rows have `theme_preference = NULL`), so a subject-overrun error renders at roughly 1.2:1 against the panel. Note C-15's own Phase E file is genuinely token-clean, making this an inconsistency *within one plan*. The six literals inside `FIXED_PART_OUTLINE_CSS` are correctly excluded — they target the deliberately-light email iframe.

**F-5 — NON-BLOCKING.** C-15's closeout undercounts its own suppressions: it states four, the true count is **seven** (`LivePreview` 1, `TemplateEditor` 4, `TemplateGallery` 2), and the file contradicts itself two sections apart. The three `exhaustive-deps` suppressions were never individually argued.

**F-6 — NON-BLOCKING but customer-visible.** The double `resolveTemplateOverrides` fetch survives on all six templates — C-15 built the `providedOverrides?` seam and never passed it from a send site. Worse for `review_request_client`: `pickReviewMessages` shuffles 3-of-5 with `Math.random` and runs **twice**, so on ~90% of sends the HTML part and the plain-text part list *different* review samples. And because `resolveTemplateOverrides` swallows errors and returns `{}`, a first-read failure with a second-read success yields an email whose subject and text part carry edited copy while the visible HTML body carries factory defaults.

**F-7 — NON-BLOCKING.** `booking_plain_text` is a fully editable, resettable, "Customised"-badgeable gallery card that reaches **no email** — all nine plain-text legs render with their sibling HTML template's overrides. Edit its footer, watch the preview update and the badge flip, and every real send keeps the old text.

**F-8 — NON-BLOCKING.** Five event types have a Resend button that can never work (`review_request_client`, `booking_restored_client`, `admin_booking_notification`, `booking_reschedule_request_admin`, `enquiry_logged`). Compounded for review requests: `sendReviewRequestEmail` discards the send status and stamps `review_email_sent_at` regardless, so the cron never retries — a hard-bounced review request is unrecoverable, and the only visible affordance is a button that errors.

**F-9 — NON-BLOCKING, conditional.** Four migration files carry filename versions absent from the live ledger (normal `apply_migration` behaviour). Unreachable today — no `supabase/config.toml`, no CI — but the Owner's stated route is a GitHub push at end of programme, where a `db push` would try to re-apply C-06's 698-line DDL.

**F-10 — NON-BLOCKING.** `OWNER-ACTION-BACKLOG.md` is a C-08-era snapshot; ~42 deferred items across ten progress files are missing, C-15 contributed none, three rows are mis-routed at C-15, and one row nominates booking `d8a61721` as a sweep fixture while another asks the Owner to delete that same booking.

### For checkpoint #3 (after plan #15)

1. Whether F-1 recurs — re-run `git status` at checkpoint start *and* end and diff them.
2. `notifications.ts` shared-surface pressure: +877 lines in range, four plans deep, with C-13/C-02/C-09 still queued behind it.
3. Whether the F-6 `providedOverrides` seam ever gets used, or whether C-13/C-02 copy the current double-fetch shape — the textbook copied-deviation-becomes-pattern, one plan away.
4. F-4's trajectory: C-13 touches `dashboard-cards.tsx` and the bookings list, both inside C-11's deferred colour remainder. Tokens or literals decides whether dark mode converges.
5. Backlog decay rate — measure the delta, don't re-enumerate.
6. **C-09 is the first genuinely retroactive plan** (its tag sweep covers all prior plans' actions) — the first chance for a plan to undo earlier plans' fixes at scale. No prior checkpoint could see this shape.
7. Post-deploy-only checks accumulating with no owner: C-22's four limiter checks, C-08's histogram, C-21's Search Console items, the maintenance-flag restore. One un-rehearsed window, now larger than checkpoint #1 flagged, uncosted.

---

## Checkpoint #3 — GROUNDWORK ONLY, run 2026-08-03 at HEAD `822441d`

**⏳ NOT THE FORMAL CHECKPOINT.** C-07 (plan #15) is 7/8 phases, paused at a HARD-STOP on Phase B4 awaiting an Owner decision. §2.6 places the checkpoint *after* plan #15 ships, so this is the expensive read-only analysis done in advance; the checkpoint completes once B4 resolves and C-07 closes out. Five read-only lenses, no writes. Every conclusion below is marked where B4's outcome could still move it — for almost all of them it cannot, since B4 concerns `localStorage` saved views and touches none of these surfaces.

**Range:** `7fe8b4f..HEAD` — 248 commits, 350 files, +57,756/−5,976. New ground since checkpoint #2 (`0bb356d`): plans #11–15 — C-13, C-02, C-09, C-03, C-07(partial).

**Gates independently re-run at HEAD by three separate lenses, agreeing:** tsc 0 · lint **59E/7W in exactly six files** · build clean · vitest **5 failed / 1485 passed (1490)**, failures identity-exact. **F-1 did not recur** — `git status --porcelain` snapshotted at both ends of the session, byte-identical at 277 lines, HEAD unmoved. Unlike checkpoint #2, this analysis ran against a genuinely halted programme rather than a moving tree.

### Checkpoint #2's seven follow-up items — answered

1. **F-1 recurrence** — no, see above.
2. **`notifications.ts` pressure** — grew **+185** (1282 → 1467) versus the prior window's **+877**, and structurally cleaner: no new logic was woven into an existing function's control flow; C-02's two additions are appended and self-contained. **C-09 never touched the file at all**, so checkpoint #2's "C-13/C-02/C-09 queued behind it" prediction was overstated by a third. Still unowned; C-16/C-17/C-18 are next.
3. **The `providedOverrides` seam** — *neither* risk materialised. It is still unwired on five templates (F-6 unchanged), **but C-02 did not copy the double-fetch shape**: both new send fns call `resolveTemplateOverrides` once and thread one object into both legs, and the new renderers take `overrides` as a required parameter with no internal fetch, citing "the C-01 lesson" in-comment. The copied-deviation-becomes-pattern risk did not occur.
4. **F-4 colour literals — the framing was too narrow, and this is the most significant correction.** Checkpoint #2 scoped it to "three new C-15 files". In fact the light-only `oklch(...)` literal pair is present in **68 files repo-wide at programme start (`7fe8b4f`)**, including `src/components/ui/badge.tsx` — and **C-11's "admin-wide dark mode" pass never touched them**. C-13's new `BookingCard.tsx` carries them only because rule 11 required matching the file it was extracted from (verified byte-identical at `0bb356d`). So this is not C-13/C-15 drift; it is large, old, ambient debt that no plan owns, and every new admin file re-plants it.
5. **Backlog decay** — reversed. 54 → 79 lines; **all four new plans added their own rows** (C-13 ×3, C-02 ×5, C-03, C-09 ×2), the practice F-10 criticised C-15 for. But F-10's *backward* gap — ~42 older deferred items missing from the C-08-era snapshot — was never addressed and remains open.
6. **C-09 as the first retroactive plan** — the prediction was directionally right, the outcome better than feared: **nothing earlier was undone.** Instead C-09 *introduced* three defects and caught all three in its own closeout (the Bookable filter losing its `active` conjunct; a malformed date 500-ing two pages; PostgREST `.or()` escaping silently returning zero rows). One was found only by re-running a lens that had returned a one-word stub verdict.
7. **Post-deploy-only checks** — grew. C-02 added four cron-dependent checks on top of C-22's four limiter checks, C-08's histogram, C-21's Search Console items and the maintenance-flag restore. C-13/C-03/C-09 added none. Still no single consolidated "run these N once the deploy lands" list.

### Part 0 conventions — clean, including the one checkpoint #2 flagged hardest

Zero `border-l-4`. Zero `revalidateTag(`. Zero fixed-pixel width additions. **All 15–16 of C-09's new/extended `*-data.ts` files were read individually**, not trusted from their own headers: every page resolves `getStaffProfile`/`getAdminPageAccess` before invoking its helper, and where the admin client lives inside the cached closure the auth-derived scalars gating the query are threaded as explicit params **baked into the cache key**, so no RBAC-scoped result can leak between callers.

**JSON-safety across `unstable_cache`: zero violations across all 16 wraps**, verified by reading actual return paths rather than declared types. Every `Set`/`Map` is consumed into an array and every `Date` is stringified before crossing the boundary. This was the single hazard checkpoint #2 most wanted watched, and it held under a 13-wrap expansion.

### The duplicate-logic inventory — the defining pattern of plans #11–15

| Instance | State at HEAD |
|---|---|
| Three today-in-London helpers (D2) | **Still unreconciled** — but *not worsened*. Both C-02 and C-07 B1 explicitly declined to add a fourth, each citing the existing helper. Vigilance held; nobody merged the three. `access.ts:85-92` and `_helpers.ts:198-205` are now byte-identical. |
| Duplicate `MISSING_COLUMN_CODES`/`hasErrorCode` shims (D1) | **Still unreconciled, byte-identical, doubly dead.** Checkpoint #1 assigned it to "whichever of C-02/C-08/C-14 next needs the shape" — C-02 and C-08 have both passed without needing it. **Only C-14 remains as a candidate owner.** |
| Two default-view computations | **✅ RECONCILED** by C-07 B3 (`838d049`) — and it was a live production bug for the whole programme. |
| Allow-list param preserver vs its delete-based siblings | **✅ RECONCILED** by C-07 B2 (`dd5b497`), after losing `from`/`to` once and `scope` the next time — "the same hole, twice", now documented in-code. |
| **Client preset map vs server range resolver** | **⚠️ STILL DIVERGENT — genuinely live.** `buildPresets()` knows `yesterday` and `last_30`; `getRangeDefaults()` in `reporting.ts` knows neither. **C-07's B1 fix MASKED this rather than removing it** — by always forwarding explicit `from`/`to` it made correctness independent of the server knowing the key, which is robust, but the two maps still disagree. `reporting.ts` is a Part 0 untouchable, so closing it properly needs an Owner decision. |

**The honest conclusion on the pattern:** five instances in five plans is not coincidence, but neither is it evidence of a structural fix waiting to be applied. Three were reconciled *within* the plans that found them; two survive specifically because the reconciliation would touch protected or unowned files. Per-plan vigilance is currently working — C-02 and C-07 both *declined* to add a fourth date helper unprompted — and inventing an abstraction to prevent the class would itself be unrequested scope. **Recommendation: keep the vigilance, and give D1/D2 an owner rather than a framework.**

### For the formal checkpoint, once C-07 ships

1. Re-run the gates at the true final HEAD and confirm identity holds through B4's resolution.
2. Fold in whatever B4 produces (see C-07 progress §1.8a — the recommendation is close-after-scoped-fix, with a genuine privacy gap in the shared-browser saved-views key).
3. Decide an owner for the 68-file colour-literal debt, or record explicitly that it stays unowned into C-12+.
4. Decide whether the client/server preset divergence is worth an Owner-approved `reporting.ts` exception.
5. Consider consolidating the post-deploy-only checks into one list before the deploy, since they now span five plans.

---

### Appendix — C-16 pre-flight prep (2026-08-03, read-only under §2.8c)

Recorded here because it answers a cross-plan question no single plan's review could: **did C-09 actually keep the pagination-readiness promise it made to C-16?**

**Yes.** All 16 wraps were read directly. Every applicable helper takes `limit?`/`offset?`, and each reaches **both the query and the cache key** through `cacheKeyPart`. **The page-2-serves-page-1 defect does not exist** — that was the one failure mode that would have made C-16 substantially larger, and it is the same shape as the `scope` cache-key risk in C-07 B2, so it is worth recording that the pattern was *not* repeated here.

**Four gaps C-16 must close, none of them C-09's fault:**
1. The params exist but **no page passes them** — every helper carries a `// PAGINATION-READY (C-16)` comment stating "not called by the page today". Wiring is entirely C-16's work.
2. The count companions for **enquiries and emails take no filter arguments** and always count the whole table, so a filtered list would read "Showing 1–25 of «unfiltered total»".
3. `bookings-list-data.ts` honours `limit`/`offset` **only on the `canViewAll` branch**; the therapist-scoped branch has no range, documented as deliberately deferred.
4. `staff-list-data.ts` has no range at all — its FPM-preserved builder type exposes no `.range`. **This is C-09's own recorded hand-off:** if `/admin/staff` ever gains a bound, its in-memory `q` and workload filters would then filter only the current page.

**Two corrections to C-16's audit premises, both strengthening its case** — and both now in `OWNER-ACTION-BACKLOG.md`: the privacy **request queue has never had any cap** (the audit's "25" is the sensitive-notes rail), and the **clients list makes two unbounded reads** while a 50-row in-memory pager makes it look solved. Bookings and enquiries are unbounded as claimed; the audit log is confirmed correct and is the house cursor pattern to copy.

**C-16 carries a HARD-STOP at Phase A Step 2** — its inventory must be confirmed in chat before Phase C, and Step 11 explicitly refuses to re-decide the operations verdict if that checkpoint record is missing.

---

*Checkpoint #3 groundwork complete 2026-08-03; formal checkpoint run same day — see below. Checkpoint #4 due after plan #20.*

---

## Checkpoint #3 — FORMAL, run 2026-08-03 at HEAD `435472a` (after plan #15, C-07) — **PASS-WITH-FINDINGS**

Run as one `opus` adversarial reviewer (§5) plus four supporting read-only lenses (§2.8a fan-out), each writing to its own file. Full reports: `DRIFT-CHECKPOINT-3-FORMAL.md` (the reviewer) and `redesign/evidence/checkpoint-3/{baseline-erosion-audit, final-head-gates, post-deploy-runbook, unowned-debt-inventory}.md`. The groundwork section above did the expensive full-range analysis in advance; the lenses were aimed deliberately at what it could NOT close, so this is not a repeat of it.

**Gates at final HEAD, independently re-measured by two separate lenses — IDENTITY: MATCH.** tsc 0 · vitest **5 failed / 1494 passed (1499)**, failures exactly `admin-access` ×2 + `ManualBookingForm` ×3 · eslint 59E/7W in the same six files · build clean, 52 pages · 277 working-tree entries, every one classified as known intentional dirt. `git diff --stat f038b4f..HEAD` is `redesign/**` docs only, so C-07's closeout gates remain the authoritative code measurement.

### ⚠️ The reviewer's headline finding was investigated by the orchestrator and REFUTED — recorded because the refutation is itself the finding

The reviewer observed that **every implementer commit from C-15 onward carries a `Co-Authored-By: Claude Opus 5` trailer**, though §5 routes five of those six plans to `sonnet`, and concluded either that routing was not being honoured or that implementers had stopped committing their own work. That would have meant five plans implemented on the wrong model, so the orchestrator tested it before recording it.

**It does not hold.** The trailer tallies across `7fe8b4f..HEAD` are: **Opus 5 ×188, Sonnet 5 ×30, Fable 5 ×12, Opus 4.7 ×1.** Fable 5 and Opus 4.7 appear in **no routing table and no dispatch anywhere in the programme** — `6b1628b`, a protocol-edit commit, carries the Fable trailer. Fable and Opus trailers interleave across the same dates, and the Sonnet trailers stop on **2026-07-31**, precisely the `/model` switch at plan #8 recorded in §5. The trailer therefore reflects the **orchestrating session's configured model string**, not the dispatched subagent's model. Confirmed from the other side in this session: the B4 implementer ran on `sonnet` (it said so in its return) and its commit `f038b4f` carries **no trailer at all**.

**The real finding, which stands:** *git carries no trustworthy record of which model implemented what.* Progress files are the only record — which is exactly why §5 mandates logging the model per dispatch. C-07 does this per phase; earlier plans are patchier. **Action: keep logging it in progress files; never again treat a commit trailer as evidence of the implementing model.** Any future audit of routing compliance must read progress files, not `git log`.

### Job 1 — Sonnet/Opus idiom divergence: a rigorous null result

§2.6 names this explicitly and checkpoint #1 called the sample too small. It is now large, and comparing only where progress files and trailers agree (Sonnet-certain 8,424 added lines; Opus-certain 20,232):

- **Comment density and test granularity are plan-driven, not model-driven.** Sonnet's C-05 runs 13% comments against Opus's C-02 at 10%; the highest test density in the range is Sonnet's C-FIELDWORK and the lowest is Opus's C-11.
- **All 13 data-only Supabase destructures were read in both corpora** — every null explicitly handled, no swallowed `error` in either. Given protocol §3b documents this codebase's habit of discarding `error`, that is the check most worth having run.
- All 6 Opus `TODO`s are intra-plan phase markers; 5 already resolved.
- **On the sharpest available test — the same file touched by both models —** `notifications.ts:880-883` holds an Opus-written function stating in-code that it "mirrors `sendStaffUnassignmentEmail`'s posture", a **Sonnet-authored** function. Rule 11's match-existing-style requirement is doing the normalising §5 predicted.

No manufactured finding. The honest answer is no meaningful divergence.

### Job 2 — nine groundwork claims re-verified; eight hold, one is wrong

Zero `border-l-4`, zero `revalidateTag(`, JSON-safety across every `unstable_cache` wrap (verified by reading actual return paths, not declared types — `reporting.ts:145-149` still carries an in-code tombstone from the last time a `Set` crossed that boundary), D1/D2 byte-identity, zero skipped tests, lint suppressions **down** 45→37.

**The "68 files carry light-only `oklch(…)` literals" figure does not reproduce** and should not be quoted again — see Decision A.

### Job 3 — baseline erosion: none, and the count drift is fully explained

HEAD's five failures are a strict **subset** of programme start's six. `ManualBookingForm.test.tsx` *was* edited across five commits, but the diff is +298/−1 with the single deletion being an import line — **no failing test body was ever touched**, confirmed by a targeted run. C-20's plan text says outright "do not 'fix' them here": these failures were never owned, by design, and that is a deliberate decision rather than neglect.

**The pass-count drift is mechanical and benign — but only because gates are judged by identity.** Root cause: **C-09 and C-03 are the only two plans of fifteen that never recorded a final post-implementation gate table.** C-09's Owner-approved addenda added 29 test cases across 6 files *after* the number its master-plan row cites (`git diff --stat 880809e 08cba8c`), C-03 added 2, and nothing re-counted until C-07's closeout. **Action for the remaining seven plans: every plan records a final gate table at closeout, including any post-closeout addendum work.**

**Correction to a figure this programme has been repeating.** The bundle-budget gate has not been missed by "three" or "four" plans. The audit identified **nine**: C-04a, C-05, C-FIELDWORK, C-08, C-15, C-13, C-02, C-03, C-07. The internal tallies disagreed with each other and undercounted. Every instance was honestly recorded as NOT RUN rather than falsely passed — the reporting was sound, the arithmetic was not.

**Structural fragility worth naming: 55 of the 59 lint errors (93%) come from `design_handoff_area_pages/`, which `git ls-files` confirms is entirely untracked.** Only 4 come from tracked `src/` files. The programme's lint baseline is not reproducible from a fresh clone — it depends on an untracked fixture directory persisting in this working tree.

### Job 4 — the groundwork's five held items, closed

1. **Gates at true final HEAD** — done above, IDENTITY: MATCH, two independent lenses agreeing.
2. **B4 folded in.** Its outcome *strengthens* the groundwork's "keep the vigilance, don't invent a framework" recommendation: the sixth instance of the duplicate-logic pattern was caught by **a subagent refusing a plan instruction**, not by an abstraction. One correction to C-07's own framing: namespacing the saved-views key fixes **UI visibility, not data residency** — the previous user's rows are purged, but the mechanism is client-side storage either way, so brief §2.12's "cleared on logout" is **partially** met, not fully. Recorded rather than reopened.
3. **Colour-literal debt** → Decision A below.
4. **Preset divergence** → Decision B below, and it is worse than the groundwork thought.
5. **Post-deploy checks** → consolidated into a **13-item ordered runbook**, `redesign/evidence/checkpoint-3/post-deploy-runbook.md`.

### 📋 DECISION A for the Owner — the `oklch(…)` colour debt

**Question: does this get an owner, or is it explicitly recorded as unowned into C-12+?**

Corrected facts, measured at HEAD:
- The long-quoted **"68 files" figure does not reproduce under any of five grep methodologies** (range 54–98). The defensible count is **98 files / 679 occurrences** of hardcoded, theme-blind `oklch(...)` literals — 3 files/33 occurrences in `src/components/ui/` (`badge.tsx`, `button.tsx`, `input.tsx`), 95 files/646 in `src/app/admin/`, **zero in the public site**.
- **11 brand-new files created during this programme carry the debt from their first commit** (verified with `git cat-file -e 7fe8b4f:<path>`), each citing rule 11's match-the-source requirement. The pattern is actively being replanted.
- **A correction to the groundwork:** "C-11 never touched them" is wrong. C-11's progress file shows it ran a deliberate, Owner-approved, narrowly-scoped sweep and explicitly logged the ~90-file remainder as known and deferred. This is a recorded deferral, not an oversight.
- **The decisive new fact: the dark-mode-correct token values already exist in `tokens.css`** (e.g. `--admin-status-cancelled-text`) and are **byte-identical** to the hardcoded literals. The bulk of this is a mechanical find-and-replace, not new design work.
- **Worst concrete offender: `src/components/ui/input.tsx:116,143`** — the shared form-field error text and required-asterisk render directly on the dark panel with a ~4-point lightness gap. That is functionally **invisible**, not merely low-contrast, and it is a shared primitive, so it appears wherever admin forms do. Dark is the default for every staff account (all 12 rows have `theme_preference = NULL`).

**Recommendation:** a one-sentence Part 0 exception permitting token substitution when a file is already being edited, rather than a dedicated retrofit plan — with `input.tsx` fixed on its own merits, since a shared primitive with invisible error text is a live usability defect rather than debt.

### 📋 DECISION B for the Owner — client preset map vs server range resolver

**Question: does `reporting.ts` — a Part 0 untouchable — get an explicit exception to add two missing cases?**

**The groundwork said C-07 B1's fix "masked" this. It does not fully mask it — there is a live hole.** `/admin/me`, `/admin/staff/[staffId]/performance`, and `/admin/reports`/`export` all call `parseReportFilters` on raw, undefaulted searchParams. (`/admin/dashboard` is safe only because of an unrelated pre-programme `?? today` fallback.) A hand-typed or bookmarked `?range=yesterday` on those three surfaces silently falls through to the catch-all and returns **current-month-to-+30-business-days** — the same window as the default month view, so it looks like it worked. Worse, two of them auto-generate onward links (`me/page.tsx:156`, `performance-helpers.ts:125,128`) that **re-propagate the bad key with no dates**.

Fix (i) add two cases to `reporting.ts`: smaller and safer long-term, needs the Part 0 exception. Fix (ii) guard at 4+ call sites: avoids the exception but recreates the exact duplicate-logic pattern this checkpoint tracks. **Recommendation: (i).** Supporting fact from the reviewer: `reporting.ts:966-969` shows this function **already shipped this exact class of bug once**, caught by an audit.

### Two further corrections worth not losing

- **D1's presumed owner is wrong.** The duplicate `MISSING_COLUMN_CODES`/`hasErrorCode` shims were assigned to "whichever of C-02/C-08/C-14 next needs the shape"; C-02 and C-08 have both passed. **C-14 does not need it either** — it uses an atomic co-deploy migration strategy, the opposite of the tolerate-a-missing-column pattern D1 exists for. D1 will remain unclaimed after C-14 ships unless someone claims it deliberately.
- **Two post-deploy items are already obsolete:** C-08's "expect 14" histogram target is stale (C-02 registered two more email event types afterwards), and the `d8a61721` fixture recommended for C-04a's queue-drain check is unusable for it, because `sendTrackedEmail` (`notifications.ts:493-504`) skips the queue insert entirely when the recipient email is null — and that fixture has both email fields NULL.

### Recommendations for checkpoint #4 (after plan #20)

1. **Re-audit model routing from progress files, never from git trailers.** Confirm every plan since C-07 logged its per-dispatch model and one-line opus justification.
2. **Verify the final-gate-table rule held** — that no plan after C-07 closed without recording one, including addendum work.
3. **Re-measure the `oklch` count** to see whether Decision A's disposition actually stopped the replanting, or whether the 11-new-files trend continued through C-16→C-20.
4. **Check the untracked-lint-baseline fragility** hasn't become load-bearing for a gate decision.
5. Re-check D1/D2 for an owner, and whether the post-deploy runbook has drifted from the plans it was compiled from.
6. Watch C-23 and C-14 specifically — both edit the **live public availability engine**, the highest-blast-radius surfaces remaining, and both are presumptively `opus`.

---

*Checkpoint #3 formal complete 2026-08-03 at `435472a`. Verdict PASS-WITH-FINDINGS: no blocking defect, no baseline erosion, no model-idiom divergence; two Owner decisions open (A and B above), one refuted headline finding recorded for its refutation, and four figures corrected. Checkpoint #4 due after plan #20.*
