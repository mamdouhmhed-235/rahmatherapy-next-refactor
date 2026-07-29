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

*Checkpoint #2 due after plan #10.*
