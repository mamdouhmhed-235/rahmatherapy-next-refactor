# C-A.1 #01 — `/admin/dashboard` audit

**Surface:** `/admin/dashboard` (all role variants — therapist / coordinator / business)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `8bcb09d` clean. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline` (credentials, MCPs, hard rules).
**Source code surveyed:** `src/app/admin/dashboard/page.tsx` (1018 LOC, read in full) + 19 colocated production files surveyed by Explore subagent (~9k LOC total).
**Roles swept:** Owner / Admin / Coordinator / Therapist / Therapist-Fresh at 1280 + Owner at 375 / 768 / 1280 / 1440. Inactive role not swept because middleware blocks before dashboard renders (per HANDOFF §1.0 + RBAC matrix). Per master-plan Part-1, "Inactive role at middleware" is a separate cross-cutting check.
**Screenshots:** `redesign/audits/C-A/screenshots-01-dashboard/` — 8 PNGs.

---

## 1 — Bugs found

### B-01 — Coordinator Snapshot card renders literal "()" between "Today" heading and "0 next 7 days"
**Severity:** medium (visible cosmetic; suggests an unfilled interpolation)
**Repro:** Sign in as Coordinator → land on `/admin/dashboard` → Snapshot card.
**Evidence:** `screenshots-01-dashboard/coordinator-1280.png` — the line below the "Today" heading reads `( )` then `0 next 7 days` on the next line.
**Suspected source:** `dashboard-cards.tsx` (TodayAtAGlanceCard) renders a parenthesised secondary value alongside the count — likely a city/location/sub-count that resolves to empty string for Coordinator variant when count is zero. Owner/Admin variants do not show the empty parens, so the issue is either coordinator-specific styling or an empty-fallback that should be conditional. The Owner variant shows the count "0" directly with "next 7 days" subtitle — no parens.
**Diagnostic for C-B plan:** grep `dashboard-cards.tsx` for `\\(` to find the parenthetical render branch; check whether the value is `null` or `""` when coordinator-variant + zero-count is the input.

### B-02 — Sentry monitoring beacons do a wasted 308 redirect on every send
**Severity:** low (perf, not correctness — extra RTT per error/perf beacon)
**Repro:** Any dashboard load. Network panel shows `POST /monitoring?...` returns `308 Permanent Redirect`, immediately followed by `POST /monitoring/?...` returning 200. Repeats per beacon (saw 4 such pairs in a single page-load).
**Evidence:** initial Owner network capture, 4 `308 → 200` pairs on the `/monitoring` tunnel endpoint.
**Suspected source:** `next.config.*` or Sentry config defines `tunnelRoute: '/monitoring'` (no trailing slash) but Next 16 / middleware normalises to `/monitoring/` causing a one-hop redirect. Should be fixable with `tunnelRoute: '/monitoring/'` or with `trailingSlash` handling.

### B-03 — `dashboard-filters-client.tsx` loading spinners lack `prefers-reduced-motion` guard
**Severity:** low (accessibility — animation continues regardless of OS setting)
**Source:** `src/app/admin/dashboard/dashboard-filters-client.tsx:372`, `:473`, `:521` — three `<Loader2 className="size-4 animate-spin" />` instances rendered without reduced-motion conditional.
**Precedent in same dir:** `PullToRefresh.tsx:142` gates with `reducedMotion ? "size-4" : "size-4 animate-spin"` — pattern exists, just not applied here.
**Hard-rule reference:** master-plan Part 0 / SHARED-NOTES discipline — every animated component must honour `prefers-reduced-motion`.

---

## 2 — Visual issues

### V-01 — Three semantically overlapping urgency representations stack on every Business-variant dashboard
**Surface:** Owner + Admin dashboard at 1440 / 1280 / 768 / 375.
**Pattern:** four headings render in vertical order:
1. **Snapshot · Today** — center column shows count + readiness chips (Confirmations / Coverage / Payments).
2. **Needs your attention** — right column. Shows top severity signals with "All clear: …" closing line listing the dimensions that are clean.
3. **Operations Health** — full-width panel. Shows "N active issues / Overall status: needs attention" + per-dimension rows + "All clear: …" closing line.

**Issue:** the same signal ("Staff gaps 1") appears in **both** "Needs your attention" (top right) and "Operations Health" (bottom). The two "All clear: …" trailing lines list the same dimensions in different orders ("Client confirmation emails · Open operations" vs "Emails · Operations"). Cognitive overhead is high — a user scanning the page sees three nearly-identical visual surfaces but has to recognise they're conceptually distinct.

This was carried over from the post-Band-B audit (Part 3 of master plan); confirmed in C-A.1 sweep.

### V-02 — Zero quick-add CTAs anywhere on the dashboard
**Confirmed via DOM scan:** no `<a>` / `<button>` matches `add booking | new booking | add client | new client | add enquiry | new enquiry`.
**Roles:** verified Owner + Admin + Coordinator + Therapist. Therapist's "Need help?" panel has 4 navigational links but no creation affordance.
**Industry baseline:** every CRM in the post-Band-B comparison set puts a "+ New booking" affordance in the header.
**Carried over from:** master-plan Part 3.

### V-03 — Header subtitle "Luton" is redundant for an Owner / Coordinator at a Luton-only clinic
**Source:** `page.tsx:438` — `subtitle: \`${formattedDate} · Luton\`` hardcoded for business + coordinator variants.
**Severity:** very low (polish). Single-location clinic; the location is not adding context.
**Decision:** likely accept as-is; flag for C-B copy pass if any subtitle redesign happens.

### V-04 — Therapist header omits "Luton" subtitle while other roles include it
**Source:** `page.tsx:434` — therapist variant subtitle is `\`${formattedDate} · Your work\``.
**Severity:** very low (inconsistency, not a bug). Note when discussing V-03.

---

## 3 — Empty / edge states

### E-01 — Therapist vs Therapist-Fresh are visually indistinguishable on the dashboard when current week is empty
**Repro:** sign in as `test.therapist@…` → Dashboard renders identically to `test.therapist.fresh@…` because both have zero bookings/visits in the "this week" Personal Stripe window. Both show: "No upcoming visit" / "Open to claim: Nothing open right now" / "My week (no activity yet)".
**Differentiator that exists but is invisible on dashboard:** Therapist has historical data (past bookings + LTV) that's only surfaced under `/admin/me` or `/admin/staff/[staffId]/performance`. Therapist-Fresh has zero across all time.
**Implication for C-09 (pagination + scale-aware):** the dashboard's "this week" framing collapses two qualitatively different account states into the same render. Consider a "Recent activity" or "Last visit" mini-block to differentiate "actively-working therapist on a quiet week" from "new therapist who hasn't worked yet".

### E-02 — Owner with zero bookings today/this-week renders MobileStickyActionBar absent (correctly null)
**Repro:** Owner at 375 viewport, today = quiet day, `stripeStickyAction` returns null per the fallback ladder in `dashboard-helpers-b5.ts`.
**Status:** **correct behaviour** per code comments. Per scope clarification 1 of the master plan ("Owner takes bookings too"), an all-zeros state is a true-zero, not a bug. Just noting the sticky-bar slot is empty.

### E-03 — Coordinator "Needs your attention" empty state copy is friendly
**Render:** "All caught up — Nothing needs your attention right now." Good empty state. ✅ Accept.

### E-04 — Therapist "Today / Nothing scheduled / Quiet day. Take care of yourself." is appropriately warm
**Render:** therapist empty-day copy hits a different register (care-focused) than business-variant copy. ✅ Accept.

### E-05 — Therapist `ProfileCompletionNudge` actively renders on first session
**Render:** amber banner "Welcome, Test. Finish your profile. Five quick fields…" with primary CTA "Open my profile →".
**Audit note:** displays *every* dashboard load until `profile_completed_at` is set. No dismiss action visible — confirm whether the brief intends this (likely yes — it's a soft block on production-readiness).

---

## 4 — Cross-role inconsistencies

### CR-01 — Nav label divergence: "Staff" (Owner/Admin) vs "Team" (Coordinator) vs "Team" (Therapist)
**Source:** RBAC-driven; depends on `canViewStaff` predicate. Coordinator + Therapist both see "Team" because their access to the staff page is narrower.
**Audit note:** acceptable per RBAC discipline, but worth surfacing in C-07 (proper routing between pages) — users may search for "Staff" in nav and not find it. Could be aliased with breadcrumbs or visual cue.

### CR-02 — Coordinator dashboard surfaces an "Active queues" disclosure that Business variant does not
**Source:** `page.tsx:936` — coordinator variant renders `<BusinessOverviewDisclosure>` wrapper around an `<ActiveEnquiriesCard>` + `<OperationsHealthCard>` pair.
**Status:** **intended** — coordinator-specific UX. Accept.

### CR-03 — Therapist dashboard is fully bifurcated from business/coordinator variants (different layout, different headings)
**Source:** `page.tsx:633` — therapist variant returns early into `<TherapistDashboard>`.
**Status:** **intended** — worker-app UX. Accept.

### CR-04 — Personal Stripe period picker has only 3 options (Today / This week / This month) while the page filter strip has 5 (Today / This week / This month / Last 30 days / Custom)
**Source:** `PersonalContributionStripe.tsx` (stripe range) vs `dashboard-filters-client.tsx` (date-range chip strip).
**Status:** likely intended — the Personal Stripe represents *your* contribution for short timeframes; longer windows don't make sense. Accept but note for any future stripe redesign.

---

## 5 — Cross-viewport issues

### CV-01 — Date Range chip strip overflows at 375; horizontal scroll active
**Source:** `dashboard-filters-client.tsx` (chip strip container has `inline-flex … snap-x snap-mandatory overflow-x-auto`).
**Measurement:** `scrollWidth = 494px`, `clientWidth = 303px`. "Last 30 days" + "Custom" chips truncated until user scrolls horizontally.
**Status:** **acceptable** — horizontal-scroll snap is an intentional mobile pattern.
**UX caveat:** no visible scroll affordance (no fade/shadow on the right edge, no overflow indicator). Users may not realise additional chips exist. Flag for C-B polish — a `mask-image` fade or a small chevron would surface the affordance.

### CV-02 — Mobile bottom nav is `position: fixed; bottom: 0` with `h: 56.6px`
**Owner @ 375:** the AdminShell mobile nav sits at `y: 755.5`. `AdminPageScaffold` adds `pb-24` (96px) on mobile to clear it.
**Status:** **clears correctly** — 96px bottom padding > 56.6px nav. ~40px breathing room.
**C-10 implication:** "footer overlap" item likely concerns surfaces where this `pb-24 md:pb-8` discipline is not applied. Dashboard is OK; other surfaces need verifying.

### CV-03 — Personal Stripe stacks correctly at 375 (B-5 fix landed)
**Render:** 2x2 grid of stripe tiles on mobile; 4-tile row on desktop.
**Status:** **clean** — verified the B-5 follow-up fix is in place.

---

## 6 — Console / network issues

### CN-01 — Zero errors, zero warnings across all 4 viewports for Owner
**Capture:** `browser_console_messages` returns 0 errors and 0 warnings at 1280 / 1440 / 768 / 375 for the Owner dashboard.

### CN-02 — Sentry tunnel double-hop documented under B-02
*(See bugs section.)*

### CN-03 — No failed requests detected
**Network capture:** 99 static + 9 monitoring requests on initial Owner dashboard load; all 2xx (except the `308` documented in B-02 which is the expected outbound side of the redirect).

---

## 7 — Pre-existing items the audit accepts

### PE-01 — Personal Contribution Stripe shows all-zeros for Owner this week
**Status:** **CORRECT BEHAVIOUR** per master-plan scope clarification 1. Owner takes bookings; this Owner just has 0 in the current period. Do **not** redesign the Stripe to assume a "non-treating Owner" — that's a misread of the scope.

### PE-02 — Therapist greeting shows "Good evening, Test."
**Status:** correct — Europe/London local time during audit was 17:39-18:46, so "Good evening" is right. Accept.

### PE-03 — C-A.1 didn't trigger the `caret-color: transparent` hydration warning that HANDOFF §1.10 documents for the bookings list
**Status:** that warning is bookings-list-specific (browser-autofill on filter inputs). The dashboard has no autofill-target inputs, so it doesn't repro here. Accept; will re-audit at surface #02.

### PE-04 — `AdminPageScaffold className="… pb-24 md:pb-8"` is the correct mobile-bottom-padding pattern
**Status:** the page.tsx explicitly applies the discipline. Accept.

### PE-05 — Production DB hygiene (test-data showing up in lists)
**Status:** not visible on dashboard (no client/booking lists rendered here). Flag deferred to surface #02 `/admin/bookings` audit.

---

## 8 — Items for plans

These are the audit's recommendations to the user when C-B planning happens.

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | V-01 — three urgency representations | Consolidate or differentiate visually. Options: (a) merge "Needs your attention" + "Operations Health" into one panel; (b) keep both but visually subordinate one. | C-12+ (audit-surfaced — user decides during C-B) |
| 2 | V-02 — no quick-add CTAs | Add `+ New booking / + Add client / + New enquiry` header-level affordances per RBAC. | C-12+ |
| 3 | B-01 — Coordinator Snapshot "()" empty parens | Fix the empty-string fallback in `dashboard-cards.tsx` parenthetical render. | C-12+ (fast fix) |
| 4 | B-02 — Sentry monitoring 308 redirect | Set `tunnelRoute: '/monitoring/'` or equivalent next-config fix. | C-12+ (fast fix, perf polish) |
| 5 | B-03 — three unguarded `animate-spin` spinners | Wrap with `useReducedMotion` like `PullToRefresh.tsx:142` does. | C-12+ (fast a11y fix; pairs with C-11 dark-mode pass which is a design-system pass anyway) |
| 6 | E-01 — Therapist vs Therapist-Fresh indistinguishable | Add a "Last visit" or "Recent activity" mini-block to TherapistDashboard. | C-09 (pagination + scale-aware) or C-12+ |
| 7 | CR-01 — Nav label "Staff" vs "Team" | Consider explicit aliasing or breadcrumb hint. | C-07 (proper routing between pages) |
| 8 | CV-01 — Date Range chip strip overflow affordance | Add a fade or chevron to indicate scrollable. | C-12+ (mobile polish) |

**Items confirmed NOT to fix in any band:** PE-01 (zero-state Owner Stripe — correct per scope), PE-02 (greeting), PE-04 (pb-24 discipline), CR-02/CR-03 (variant-specific UX is intended), CR-04 (period picker scope difference is intended), V-04 (therapist subtitle is intended).

---

## 9 — Hand-off

**State at end of audit:**
- 8 screenshots captured in `screenshots-01-dashboard/`.
- 0 code changes (audit-only).
- Session signed out cleanly.
- All 5 roles swept; Inactive verified via code-level RBAC (middleware-blocked, did not need browser sweep).

**Next surface:** `/admin/bookings` (list) — master plan surface #02. Per recommended order: Bookings list → Bookings/[id] → Privacy.

**Diagnostic shortcuts surfaced for C-B:**
- B-01 "()" — grep `dashboard-cards.tsx` for `\\(` interpolation.
- B-02 Sentry — check `next.config.*` / `sentry.client.config.*` for `tunnelRoute`.
- B-03 spinners — three `animate-spin` instances in `dashboard-filters-client.tsx`.

**No regressions vs Part 1 baseline:** the post-Band-B `✅ READY` verdict for `/admin/dashboard` remains valid. All findings are polish + Part-3 carryovers + minor bugs; none invalidate the production-ready posture.

*End of dashboard audit.*
