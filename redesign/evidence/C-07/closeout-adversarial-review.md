# C-07 — Closeout adversarial review

**Reviewer:** read-only adversarial subagent, Band C programme.
**Range reviewed:** `git diff d3b5c90..HEAD` (`d3b5c90` = C-03's final commit → `f038b4f`, HEAD).
**Method:** `git log --oneline` + `git diff --stat` for the whole range, then every substantive hunk read in full (all 15 non-doc code/test files touched), cross-checked line-by-line against the plan's Steps 1–16, the brief's §2/§4/§10, and the progress file's §1.1–§1.8/§2/§3. Docs-only commits (`redesign/**`) were read for claims, not held to code style rules, per dispatch.

---

## VERDICT: PASS

No scope creep, no lost steps beyond the Owner-accepted deviations already recorded, no style-rule violations, no weakened or gameable tests, and no sixth instance of the programme's "two things that should be one thing" defect class. Two informational notes below (documentation fidelity, commit cadence) — neither is a defect and neither requires action.

---

## Findings

### 1. (Informational, no action needed) Plan/brief cite a file that never existed — `BookingDetailToasts.tsx`

The plan (lines 4, 26, 221, 686) and brief (lines 137, 454, 477) all name `src/app/admin/bookings/[bookingId]/BookingDetailToasts.tsx` as "the C-03 component" to extend for Step 4's just-created toast. That file has never existed in git history (`git log --all -- "**/BookingDetailToasts.tsx"` returns nothing). C-03's actual toast component, created in `7886084` ("C-03 Phase D steps 12-14 — Origin panel + conversion toasts"), is `BookingCreatedToast.tsx`. The implementer correctly located and extended the real file — `5b07851`/`b8f2f5d` touch `BookingCreatedToast.tsx` throughout, and it is exactly the file C-03 built. There is no functional consequence.

The only reason this is worth recording at all: the plan already carries four explicit "✅ CORRECTION" annotations (C07-F1 through C07-F4) for exactly this class of plan-vs-reality drift (wrong path, wrong data structure), and this fifth instance was never given the same treatment — it's the one plan/reality mismatch in this plan that the implementer silently routed around rather than the progress file calling out with an explicit correction note. Purely a documentation-completeness observation; no code changed as a result and none should.

### 2. (Informational, no action needed) Commit cadence diverged from §7's table, transparently and for good reason

Plan §7 recommends one commit per phase (9 total, ending in a single "Verification" commit). Actual, in order: `526733f`(A1) → `5b07851`(A2) → `8f76fc6`(A3) → `b8f2f5d`(A-fix) → `4603340`(A4) → `ed99e6a`(A-progress) → `4e23053`(B1) → `94cb96a`(B1-progress) → `ef1d4b6`(B1-fix) → `c6c1ec4`(B2) → `dd5b497`(B2-fix) → `838d049`(B3) → `c52942c`(interrupt checkpoint, docs) → `e022be6`(B3 placeholder re-run, docs) → `822441d`(B4 gap analysis, docs) → `e8b3bb0`/`3d6b3d3`/`bd1182e`(programme-level docs: drift checkpoint groundwork, backlog surfacing, C-16 pre-flight — not C-07 scope) → `6b1628b`(SUBAGENT-RULES/execution-protocol update, docs) → `f038b4f`(B4 in-place fix).

Three phases (A3, B1, B2) got an extra "-fix" commit beyond the plan's one-per-phase cadence. Each is transparently a real, verifier-caught defect fix, self-documented in its own commit message and the progress file (§1.2, §1.5/ef1d4b6, §1.6) — not a silent squash or an undocumented split. The programme-level docs commits interleaved between B3 and the final B4 fix (drift checkpoint, C-16 prep, backlog index) are outside C-07's own scope but match the dispatch's own instruction to treat docs-only commits as background record rather than plan violations. No squash hid a defect; no split obscures what changed.

---

## Swept and clean

- **§2 files-touched list, NEW section:** `QuickLinks.tsx`, `DashboardScopeToggle.tsx`, and both their test files exist exactly as specified. `saved-filters.ts`, `SavedFiltersBar.tsx`, and its test file are absent — correctly, per Owner ruling (known deviation #4).
- **§2 files-touched list, EDITED section:** every listed file that should have changed, changed; every one the progress file says was correctly left alone (`clients/[clientId]/page.tsx`) has zero diff in the range — confirmed via `git diff d3b5c90..HEAD -- "src/app/admin/clients/[clientId]/page.tsx"` (empty) and a live grep showing the three `?clientId=` hrefs still in the file (396, 461, 732 today), consistent with the "third renders null, wires the `b` shortcut" explanation.
- **`reporting.ts`, `dashboard-helpers.ts`, and all of `src/lib/`** — confirmed zero diff in range (untouchables list, RECON §5). Only `src/app/admin/reports/PersonalTeamToggle.tsx` (+2/-2, a label swap) and its test changed under `reports/`.
- **`src/lib/maintenance.ts`** — untouched by this range (not part of the diff at all); the standing Owner change is elsewhere in the working tree, as expected.
- **Booking `9d55ce2a` / Owner account / non-`*.example.test` clients** — no `execute_sql`/DB-touching test fixtures appear in any new spec; all new tests use in-memory/jsdom fakes (`fake-unstable-cache`, hand-rolled Supabase query-builder stand-in), not live data.
- **Code rules:** `border-l-4` — zero occurrences in actual code (only appears inside a docs commit quoting the rule itself). `revalidateTag` — same, zero in code. `createSupabaseAdminClient()` ordering — both call sites touched by the diff (`bookings/new/page.tsx`, `dashboard/page.tsx`) have the admin-client call in its pre-existing position, already after `getStaffProfile()`; C-07 didn't move it. `unstable_cache` key — `dashboard-data.ts`'s new 4-part key is `["dashboard-data", profile.id, JSON.stringify(filters), scope]`, all strings — no `Set`/`Map`/`Date`. `prefers-reduced-motion` — `DashboardScopeToggle`'s new transition classes include `motion-reduce:transition-none`.
- **Repeat-defect sweep (5 known instances: §1.2, §1.3, §1.6 ×2, §1.8):** read every write-path in `dashboard-filters-client.tsx` (`buildPresetHref`, `handleSheetSubmit`, `buildPillRemoveHref`, `handleCustomSubmit`, the inline pill-row "Clear all", and the fixed `handleClearAll`) — all six now build from `new URLSearchParams(searchParams.toString())` before mutating; no seventh param-dropping instance remains in that file. Checked `DashboardScopeToggle`'s own `setScope` — same current-params-first pattern. No new in-memory-filter-over-bounded-array pattern found outside the two already fixed (A3's claimable window, B2's narrowing — both use separately-bounded fetches / SQL `WHERE`, not in-memory re-filtering of an already-bounded array).
- **Weakened-test sweep:** read `filterBookings.test.ts`'s full diff (10 call-site signature updates + 2 new specs), `BookingCreatedToast.test.tsx` (new, asserts exact single-toast-fires call counts), `savedViews.test.ts` (new, 8 specs covering round-trip/isolation/corrupt-data/legacy-purge), `DashboardScopeToggle.test.tsx` (new, asserts param-preservation by parsing the actual pushed URL), `QuickLinks.test.tsx` (new), `dashboard-filters-client.test.tsx` (new, 155 lines covering both the B1 and B2 clear-all fixes), `PersonalTeamToggle.test.tsx` (2-line label-text update only), `TherapistDashboardHeroEyebrow.test.tsx` (mechanical new-prop addition only). None loosen an assertion; none would pass with the underlying feature removed — each test that exists to pin a fix asserts the fixed behaviour specifically (e.g., exact toast call count, exact preserved URL params, exact filtered id set).
- **Mobile-first / 375px:** `QuickLinks` grid is `grid-cols-1 md:grid-cols-2` pattern per plan; `DashboardScopeToggle` and the manage-page footer use flex/inline-flex with no fixed pixel widths.
- **Bundle budget / static gates:** not independently re-run by this review (read-only, no code execution requested); progress file §1.5/§3 records tsc/lint/vitest/build all green at HEAD with the identity-matched baseline failures (5 pre-existing: `admin-access` ×2, `ManualBookingForm` ×3) — taken as the authoritative record per dispatch, not re-verified here.

---

*End of review. No writes made to any file other than this one.*
