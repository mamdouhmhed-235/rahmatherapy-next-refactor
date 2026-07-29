# C-05 — Cancelled-bookings lockdown + filter-correctness + strikethrough — PROGRESS

**Plan:** `redesign/plans/C-phase/C-05-cancelled-bookings-inert-plan.md`
**Brief:** `redesign/briefs/C-05-cancelled-bookings-inert-brief.md`
**Programme:** Band C, C-C implementation — plan **#5 of 22** (§4 order).
**Predecessor closed at:** `73590d8` (C-04a shipped)

> ## ✅ STATUS: SHIPPED — all 4 phases implemented + independently verified, closeout gate passed clean (one in-flight fix round at Phase C), master-plan checklist flipped.
> **Final commit:** `61be354` · bookkeeping in this file's commit + the checklist-flip commit.
>
> **§3.2 (4-role × 4-viewport Playwright sweep) and §3.4 (screenshot evidence) NOT RUN — Owner-performed by necessity, not deferred by choice.** No agent may authenticate (password entry prohibited). Checklist below, ready whenever the Owner runs it. Same standing policy already established at C-06/C-22/C-04a — not re-litigated per plan, per protocol §3b.

---

## 0 — Pre-flight (2026-07-29)

Run read-only against HEAD `73590d8`.

- Branch `master`; `git merge-base --is-ancestor ea97932 HEAD` → OK.
- Path-scoped tree clean: `git status --porcelain -- src/app/admin/bookings/ src/app/admin/clients/` → empty.
- Dependency check: C-04a shipped (`73590d8`) ✓; C-06 HARD gate — `information_schema.columns` confirms `bookings.deleted_at` and `clients.deleted_at` both present in production ✓.
- DB introspection: existing cancelled fixture `eaafbb1a` (past-dated, safe test client) and existing past-dated **active** fixture `1d503d3b` ("Phase10 E2E Claim Client", confirmed, `2026-05-24`, with a live unassigned claimable assignment row) — this is the exact B-171 phantom-yesterday repro case, still reproducible in production. **No back-date HARD-STOP was needed** — existing fixtures covered every phase's implementation needs. Both of the plan's ⛔ HARD-STOP blocks (§0 Step 7, §6) were never triggered; confirmed absent from the shipped diff by the adversarial reviewer (no SQL migration, no data-mutating SQL anywhere in the 5 commits).
- DO-NOT-TOUCH: Badar `9d55ce2a` — confirmed zero references anywhere in the diff (grepped by the adversarial reviewer).

**Baseline identity (inherited from C-04a, supersedes the plan's own stale "485/491" text):** tsc **0** · lint **59 errors / 7 warnings** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience,BookingExperienceLoader}.tsx` + `src/features/booking/utils/returning-customer.ts` · vitest **5 failed** (`admin-access.test.ts` ×2, `ManualBookingForm.test.tsx` ×3) among 754 total at plan start, growing only via new passing specs through each phase.

---

## 1 — Phase ledger

| Phase | Commit(s) | What | Verify result |
|---|---|---|---|
| A | `a81c322` | `ensureBookingActive` helper + `BookingActivityCheck` type + `hasClaimableAssignment` status/past-date guards + 9-case + 4-case vitest specs | PASS (independent re-run) |
| B | `1688967` | Hooked `ensureBookingActive` into `claimBookingAssignment` + `updateBookingAssignment`; design-note comment on `updateOwnAssignmentStatus`; extended helper SELECT with `end_time` (needed by `assignment-eligibility.ts` consumers); 4 new server-action specs | PASS (independent re-run) |
| C | `a8853c1` + fix `fa54966` | Top-level `isBookingActive`/`inactivityReason`; multiplied through `canClaim`/`isOwn`-buttons/`canPromptForSessionNote`/`canReassignBookings`; inline notice; claimable SQL JOIN + in-memory past-date filter | **FAIL → FIXED → PASS** (see §2) |
| D | `61be354` | Status-aware `filterBookings` (the "Cancelled filter is a UX lie" fix) + 10-case vitest spec; cancelled-row strikethrough on the list + cross-surface on `BookingHistoryCard` via new shared `inertRowClassNames` helper | PASS (independent re-run) |

**Closeout gate (2026-07-29):** independent static-gate re-run PASS (lint/tsc/vitest/build all identity-exact) + adversarial review of the full `73590d8..HEAD` diff — REVIEW PASS, zero blocking findings, all 16 plan steps confirmed present, both invariants (claimable strict / any-status hides inert) confirmed holding in shipped code, both ⛔ HARD-STOPs confirmed never triggered, no scope creep, no placeholders, DO-NOT-TOUCH clean.

---

## 2 — The one fix round: Phase C inline-notice gating

Independent Phase C verification found a real, reachable bug: the inline "this booking is inactive" notice was suppressed for ALL `fullScope` actors (Owner/Admin/**Coordinator** — confirmed via live RBAC query that Coordinator carries `manage_bookings_all`, so `fullScope` is not Owner/Admin-only as the implementer's first-draft reasoning assumed) regardless of *why* the booking was inactive. `deriveNextAction` (C-04a's next-action strip) is reason-complete for `cancelled` (incl. the S7 "permanent" copy) and `no_show`, but has **no date-awareness** on its `pending`/`confirmed` unassigned branches — so a fullScope actor viewing a **past-dated** booking that's still `pending`/`confirmed` got told "pick from eligible therapists in the Assignment panel below" while the panel was correctly hidden (Phase C's own change) and nothing explained why. Actively misleading, not just silent.

**Fixed in `fa54966`:** suppression now keys off `inactivityReason`, not a blanket `!fullScope` — `cancelled`/`no_show` stay suppressed for fullScope actors (their next-action-strip copy is genuinely equivalent); `past_dated` shows the notice for any actor with a practitioner-role relationship, fullScope included. Also wired up `canReassignBookingsRole`, which the first draft had computed but never used (dead code sitting next to the bug). A minor non-blocking side-note (a wasted `claimEligibility` fetch on inert bookings for fullScope actors, introduced by the same variable split) was fixed in the same commit — confirmed behavior-neutral (only removes a redundant round-trip; `canClaim` already independently required `isBookingActive`).

Independently re-verified after the fix: all 8 of the fresh verifier's checks passed, including re-reading `deriveNextAction`'s `cancelled`/`no_show` branches directly (not taking the fix's self-report on faith) to confirm they really are reason-complete.

---

## 3 — §3.2 / §3.4 Owner-performed checklist (handed over, not run by any agent)

Per plan §3.2 (16-item, 4 roles × 4 viewports) and §3.4 (screenshot evidence), condensed to the load-bearing checks:

1. **Cancelled test booking detail** (use `eaafbb1a`, NOT Badar's `9d55ce2a`) as each of the 4 roles: Claim button absent, Mark-complete/Mark-no-show absent, AssignmentManager absent, inline notice shown for Therapist (per the `fa54966` fix, Owner/Admin/Coordinator instead see the equivalent next-action-strip copy — confirm both are actually true in a real browser, not just in code).
2. **Past-dated active booking** (`1d503d3b`, the B-171 repro): same affordances absent; confirm the `fa54966` fix — Owner/Admin/Coordinator should now see the inline "in the past" notice too (this is the specific gap the fix round closed; if it's silent for a fullScope role, that's a real regression, not a nitpick).
3. `/admin/bookings?view=claimable` as Therapist: `1d503d3b` must NOT appear (confirms the B-171 fix landed in the live app, not just in tests).
4. `/admin/bookings?status=cancelled` (any default view): cancelled rows now render with strikethrough — this is the headline user-reported bug fix ("if the filter is there it should obviously work"). Confirm visually.
5. `/admin/bookings` (no filter): cancelled rows do NOT appear (S1(b) — "Any status" stays active-only).
6. `/admin/bookings?view=claimable&status=cancelled`: 0 rows (claimable invariant, even with explicit status opt-in).
7. `/admin/clients/<id-with-cancelled-history>`: `BookingHistoryCard` shows strikethrough on cancelled rows.
8. Screenshots per plan §3.4 at 375/1280, stored in `redesign/evidence/C-05/`.
9. (Therapist) Mark own assignment complete on a cancelled booking → succeeds (§2.2 design decision), auto-promote does NOT fire — booking stays cancelled.
10. Restore the cancelled fixture via C-04a's Restore button → all affordances reappear.

**Safe fixtures for this sweep:** `eaafbb1a` (cancelled, both email fields present but it's a test-client identity — verify no real email before any action that could send mail), `1d503d3b` (Phase10 E2E, confirmed test pattern). **Never** `9d55ce2a` (Badar).

---

## 4 — Deviations and judgment calls (all reasoned, none unresolved)

- **Phase B:** extended `ensureBookingActive`'s SELECT/return shape with `end_time` rather than re-fetching at each call site — genuinely needed by both `getClaimAssignmentEligibility` and `getStaffAssignmentPreviews`. In-scope follow-on to a Phase A file, not creep.
- **Phase B:** Step 6's design comment corrected to name all three terminal statuses (`completed`/`cancelled`/`no_show`) matching the real `TERMINAL_BOOKING_STATUS_FILTER`, rather than the plan's stale two-status text.
- **Phase C → fix round:** see §2.
- **Phase D:** `filterBookings` exported directly from `page.tsx` rather than extracted to `_helpers.ts`, because it transitively depends on `access.ts`'s `createSupabaseAdminClient` (explicitly "SERVER ONLY" per its own file comment) while `_helpers.ts` is imported by client components (`BookingRowActions.tsx`, `BookingManagementForm.tsx`) and carries its own pre-existing C-04a docstring committing it to staying free of server-only imports. Verified sound by the closeout-independent Phase D verifier.
- **Phase D:** `inertRowClassNames` added as a new shared pure helper in `_helpers.ts`, used by both row-card surfaces — the plan explicitly left shared-vs-duplicate as an implementer call; the two row shapes converged cleanly.
- **Bundle-budget gate (plan §3.1, +3kB ceiling across `/admin/bookings/*` + `/admin/clients/*`):** `scripts/measure-admin-bundles.mjs` does not measure either route family — confirmed by every phase that touched it and by the closeout re-verifier. The script runs clean but cannot actually confirm this specific budget claim. Same pre-existing tooling gap already logged against C-04a's closeout (§0k of that progress file) — not new, not fixed here, flagged again for whoever eventually extends that script's route list.

## 5 — Log-only (noticed, not this plan's to fix)

- `redesign/evidence/C-21/` PNGs are untracked even though `redesign/evidence/` is a committed convention elsewhere (C-04a, C-06) and C-21 shows shipped in git log. **Correction (drift checkpoint #1, 2026-07-29):** this is NOT an accident — C-21's own progress file §5.6 records it as a deliberate, reasoned decision (15 PNGs, ~25 MB; committing at that rate compounds to ~0.5 GB across 22 plans). Struck from "noticed" status; the earlier framing above was itself a mis-diagnosis of a previous plan's documented call. Not actioned, correctly.
- **Two orphaned cross-plan hand-off items, surfaced by drift checkpoint #1 (2026-07-29), NOT in C-05's actual Owner-approved plan scope — logged for a future plan, not fixed here:**
  1. C-04a's progress file §0c speculated *"C-05's remit is exactly this, with a shared helper across all seven edit points"* re: the residual `cancelled → confirmed` / `cancelled → no_show` / `X → X` server-side transitions (reachable only via a hand-crafted POST, no live UI affordance). C-05's actual Owner-approved plan+brief (read in full at this plan's start, verified against by the adversarial closeout reviewer) never scoped this — it's a stale forward-reference in a sibling plan's notes, not a requirement C-05 dropped. `ensureBookingActive` covers 2 of the informally-implied 7 sites (the ones actually reachable through claim/reassign). The other 5 direct-POST paths remain unguarded server-side, same as before C-05.
  2. C-06's progress file §8 assigned a "soft-deleted booking stays mutable" sweep (11 `bookings/actions.ts` sites) to C-05. `ensureBookingActive` reached the 2 sites its own plan named (`claimBookingAssignment`, `updateBookingAssignment`); `updateBookingManagement`, `quickUpdateBooking`, and `respondToCustomerReschedule` never consult `bookings.deleted_at`. **Currently unreachable in practice** — C-06's cascade forces every soft-deleted booking's status to `cancelled`/`completed`, both already inert via `ensureBookingActive`'s status check — but the assignment was narrowed silently across the hand-off, not re-scoped by decision.

## 6 — Baseline identity AFTER (added retroactively by drift checkpoint #1, 2026-07-29 — independently re-run, not copied from §0/§1)

`npx tsc --noEmit` → **0 errors**. `pnpm lint` → **59 errors / 7 warnings**, same six files, per-file exact: `area-page.jsx` 48E/1W · `shared.jsx` 2E/5W · `site-chrome.jsx` 5E/0W · `BookingExperience.tsx` 3E/0W · `BookingExperienceLoader.tsx` 1E/0W · `returning-customer.ts` 0E/1W. `pnpm vitest run` → **5 failed / 773 passed / 778**, the five inherited names unchanged. **This is the baseline C-01 (plan #6) inherits.**

---

*C-05 shipped. Next in §4 order: C-01 (review-request email infrastructure).*
