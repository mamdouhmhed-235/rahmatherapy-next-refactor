# C-11 — Dashboard variants + design system + dark mode — PROGRESS

**Plan:** `redesign/plans/C-phase/C-11-dashboard-variants-design-system-plan.md`
**Brief:** `redesign/briefs/C-11-dashboard-variants-design-system-brief.md`
**Programme:** Band C, C-C implementation — plan **#8 of 22** (§4 order).
**Predecessor closed at:** `229b29b` (C-01 second fix round + Cloudflare decision bookkeeping)

> ## ⏳ STATUS: PRE-FLIGHT COMPLETE — GO-WITH-CAVEATS. Implementation not yet started.
> Pre-flight run read-only at HEAD `229b29b` on 2026-07-30 by a single delegated read-only agent (protocol §2.1), plus two orchestrator-run SELECTs to close a gap the plan's own item-10 query could not answer.
>
> **One pre-flight item FAILED: item 2, dev server unreachable** (`curl http://localhost:3000/admin/login/` → `000`). Plan §0 closes with "If any pre-flight check fails, **stop** and surface to user" — surfaced in chat, awaiting Owner.

---

## 0 — Pre-flight (2026-07-30, HEAD `229b29b`)

| # | Check | Result |
|---|---|---|
| 1 | Branch + path-scoped tree | **PASS (known exception)** — `master`; `merge-base --is-ancestor ea97932 HEAD` exit 0; `git status --porcelain -- src/ supabase/migrations/` shows exactly ` M src/lib/maintenance.ts`, the standing deliberate Owner change (protocol §3b). Nothing else dirty in scope. |
| 2 | Dev server | **FAIL** — `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/login/` → `000`. Owner must run `pnpm dev`. Blocks browser verification only; Phase A is provably browser-independent. |
| 3+4 | Baselines | **PASS — exact identity match** against the inherited list (the plan's own "485/491" text is a stale plan-writing-time snapshot, superseded per protocol §0 precedence). tsc **0**; lint **59E/7W** (55 in `design_handoff_area_pages/prototype/*.jsx`, 4 in `src/features/booking/`); vitest **5 failed / 829 passed (834)** — admin-access ×2, ManualBookingForm ×3; build clean. **`createBookingTransaction` confirmed ABSENT** — C-06's expected shrinkage still holds. |
| 5 | C-FIELDWORK dependency (HARD) | **PASS** — 8 C-FIELDWORK commits in HEAD; both `PractitionerTodaySection.tsx` and `shared-helpers.ts` exist. |
| 6 | DB greenfield | **PASS** — `staff_profiles.theme_preference` → 0 rows. |
| 7 | animate-spin inventory | **PASS w/ drift** — actual **62 instances / 40 files, 61 unguarded** (plan's frozen C11-F5 figure: 60/39/59). Only `audit/AuditPageActions.tsx:80` guarded, unchanged. |
| 7b | Hardcoded-color inventory | **PASS w/ drift** — **103 files** matching oklch/hex (plan: 98); **532** `oklch(` lines (plan: 520); 5 hex, 6 rgb/rgba. |
| 7c | Admin surface inventory | **PASS w/ 3 corrections** — see contradictions §0.1 below. |
| 8 | Theme infrastructure absence | **PASS — genuinely 0 hits.** Greenfield confirmed twice. |
| 9 | Bundle baseline | **PASS** — `/admin/dashboard` first-load JS **480.84 kB gzip**, CSS **39.85 kB gzip**. Captured to scratchpad `c11-pre-bundle.txt` (NOT `/tmp` — that path in the plan is a Unix-ism). |
| 10 | Fixture inventory | **PASS** — see table below. |

### Item 10 — fixture inventory (orchestrator-run; the plan's own query could not answer its own question)

Plan §0 item 6(b) selects only `email, can_take_bookings`, which cannot confirm "at least one account per role is active". The delegated agent correctly flagged this rather than fabricating confirmation. Orchestrator ran one additional SELECT (`staff_profiles` ⋈ `roles`):

| Role | Active account | `can_take_bookings` |
|---|---|---|
| Owner | `rahmatherapy@outlook.com` ✅ active | `true` |
| Admin | `test.admin@rahmatherapy.example.test` ✅ active | `true` |
| Booking Coordinator | `test.coordinator@rahmatherapy.example.test` ✅ active | `false` |
| Therapist | `test.therapist@…` + `test.therapist.fresh@…` ✅ active | `true` |
| Inactive | `test.inactive@…` — `active=false` **by design** (middleware-block fixture) | `false` |

All roles covered. Note `test.coordinator` has `can_take_bookings=false`, which is exactly the fixture plan §3.2 needs to verify `PractitionerTodaySection` does NOT render for a non-practitioner.

### 0.1 — Contradictions between plan text and reality (carry into every C-11 dispatch)

1. **`PractitionerTodaySection` props table is materially incomplete — highest-risk item.** Plan lines 217–250 document only `practitionerNextAppointment` and `practitionerClaimableCount`, under names that do not match the real interface. The real `PractitionerTodaySectionProps` (`PractitionerTodaySection.tsx:37-64`) has **7 props**: `staffName` (required), `todayAppointments` (required), `nextAppointment` (required), `claimableCount` (default `0`), `nextAppointmentAssignmentId` (default `null`), `serviceLookup` (default empty `Map`), `showClaimableStrip` (default `true`). Current mounts: `TherapistDashboard.tsx:400-408` passes all 7 incl. `showClaimableStrip={false}`; `dashboard/page.tsx:1010-1017` passes 6, relying on the `true` default. **An implementer following the plan's table gets a compile error at best and a silent regression at worst** — omitting `nextAppointmentAssignmentId` hides the Mark-complete control, omitting `serviceLookup` degrades every service name to "Visit", and mis-setting `showClaimableStrip` either duplicates or drops the claimable strip. Read the real interface, never the plan's table.
2. **The dark-flip trap is real and confirmed.** `src/styles/tokens.css` has exactly ONE `:root` block (lines 1–216): public `--rahma-*`/shadcn tokens at 2–60, the `--admin-*` family at **61–196** (matches the plan's citation), more shared tokens at 197–216. It resolves to `<html>` for every route. A naive dark-at-`:root` implementation **would dark-flip the entire public marketing site**. `admin-theme.css` does not exist; `globals.css:4` imports tokens.css. Plan Step 11 is correctly marked SUPERSEDED — Step 11a is the only safe path, and dark overrides must name ONLY `--admin-*` variables.
3. **`src/app/admin/layout.tsx` is a nested layout** owning no `<html>`/`<body>` — it returns `<AdminTopNav …>{children}</AdminTopNav>`, mounted at line 59. Confirms plan corrections C11-F10 / D10: `beforeInteractive` is unusable; the FOUC script must be a plain inline `<script dangerouslySetInnerHTML>` at the top of the returned JSX. Do not touch the root layout.
4. **Admin surface list (§0 item 7c) has 3 errors.** Missing: `/admin/password-reset` (+ `/[token]`) and `/admin/signout` — both real, both in the build route table. Not a route at all: `components/`, which a naive `ls -d src/app/admin/*/` surfaces; it must not be treated as a themeable surface in the Phase G walk. Bare `/admin` and `/admin/reports/export` also exist unlisted.
5. **Frozen inventory counts have drifted** (animate-spin 60→62/39→40/59→61; colors 98→103 files, 520→532 lines). Small, but Phase E/F must re-derive working file lists live rather than copying the plan's pasted numbers.
6. **`globals.css` admin-selector line numbers have all shifted** — re-located by selector name per rule 9: `.admin-shell::before` **27** (oklch gradient 35), `.admin-nav-surface` **221** (`#ffffff` 222), `.admin-action-primary` **257** (`#ffffff !important` 266), `.admin-action-outline` **275** (`#ffffff` 284), `.admin-nav-link` block **336–351** (`rgba(209,234,223,.84)` 341–342, `.84`/`.72` variants, `#ffffff` actives). Plan cited L266/L284/L222/L338/L342-350/L33-37.

### 0.2 — Correction to the orchestrator's own dispatch

The pre-flight briefing told the agent to expect a real hit for `prefers-color-scheme` because `globals.css` carries a `prefers-reduced-motion` rule near line 437. Those are different media features; the grep correctly returns **zero** hits. The greenfield gate holds cleanly — there is no pre-existing theme infrastructure anywhere in `src/`. Recorded so no later reader treats the mistaken expectation as evidence of anything.

---

## 1 — Phase ledger

| Phase | Commit(s) | What | Verify result |
|---|---|---|---|
| A | `4e18fa9` | Shared building-blocks library — 10 blocks + `index.ts` barrel + 10 co-located specs (31 tests) under `src/app/admin/dashboard/blocks/`. 21 files created, **0 edited** — blocks are dormant, `page.tsx`/`TherapistDashboard.tsx` provably untouched. | **PASS first time**, zero blocking findings. Model: `sonnet` (logged §5 downgrade, see §1.1). |
| B | `bdbe64f` (3a) + `93c3f08` (3b) | **3a** verbatim extraction of the Business+Coordinator branch into `BusinessDashboard.tsx` — `page.tsx` **1101 → 401 lines**. **3b** composes from `blocks/` + V-01 reconciliation. | **PASS / PASS**, both sub-steps first time, no fix round. Model: `opus` (routed model kept, see §1.1). |
| C | `b95e2ea` (6a) + `5ffcbba` (6b) | **6a** verbatim split of the Coordinator variant out of `BusinessDashboard.tsx` into `CoordinatorDashboard.tsx` + new `dashboard-variant-shared.tsx`; `page.tsx` becomes the variant router. **6b** composes from `blocks/` + B-01 fix. Final sizes: `page.tsx` 410, `BusinessDashboard` 376, `CoordinatorDashboard` 514, shared 437. | **PASS / PASS**, both first time, no fix round. Model: `opus`. **B-01's root cause was NOT what the plan said — see §1.4.** |
| D | `75d42c4` | `TherapistDashboard.tsx` re-pointed at the `blocks/` barrel (`DashboardHeader`, `QuickHelpPanel`); C-FIELDWORK's backward-compat helper re-export retired and its one external consumer re-pointed at `shared-helpers.ts`. Diff is **6 insertions / 5 deletions, entirely in the import block + trailing re-export** — not one line of JSX or derivation touched. | **PASS first time**, no fix round. Model: `opus`. See §1.6. |
| E | migration `f95c828` · E1 `faaedc2` + `e2031de` | **Migration APPLIED + verified** (Owner-approved). **E1 (Step 11a token scoping) implemented but FAILED verification TWICE → protocol §2.3 STOP.** See §1.9. E2 (sweep) and E3 (provider/toggle/FOUC) NOT started. | ⛔ **STOPPED — awaiting Owner decision.** |
| F | — | Motion-reduce sweep (VERIFY-ALREADY-IMPLEMENTED wrapper; optional per D8) | not started |
| G | — | End-to-end verification | not started |

### 1.1 — Model-routing log (protocol §5)

C-11 is an **`opus`-routed** plan ("system-wide theming; public-flip risk lives here").

| Phase | Model | Reason |
|---|---|---|
| A | `sonnet` — **DOWNGRADE, logged** | §5's phase-level granularity names "file extractions" and "test-file authoring" as legitimately Sonnet-able. Phase A creates new render-only files that stay dormant; touches no migration, no live surface, no schema, and is not the plan's headline complexity. |
| B | `opus` — routed model kept | Not purely mechanical: mutates `dashboard/page.tsx` (~400 lines out) — the most-used admin surface, where a bad extraction is a live render regression — AND carries the V-01 information-architecture reconciliation, which is a design judgement, not a move. "When in doubt, keep the routed model." |
| E | `opus` — **never downgrade** | Migration + the public-flip risk. De-escalation ban applies. |

### 1.2 — Phase A findings that no per-phase verifier could catch

Phase A's verifier correctly confirmed **zero new colour literals in the files Phase A created**. Both findings below are about files Phase A did *not* touch, so they were structurally outside its remit. The orchestrator found them by re-deriving the reuse graph after the phase closed.

**(a) ⚠️ CARRY INTO PHASE E — `components/admin-ui.tsx` is a theme hole the D9 trim does not cover.**
Six of the ten blocks are deliberate **re-exports** rather than re-lifts (correct per the plan's own C11-F8 note, and better than duplicating ~130 lines): `DashboardHeader` → `dashboard-header.tsx`; `EmptyState` → `components/EmptyState.tsx` (26 consumers admin-wide, moving it was rightly out of scope); `QuickHelpPanel` → existing, already had the `links` prop; `MobileStickyActionBar` → existing; `PendingBookingsStripe` → `dashboard-cards.tsx`'s `UrgentAttentionPanel` renamed per brief Q9.1; `EnquiriesTodoStripe` → `dashboard-cards.tsx`'s `ActiveEnquiriesCard`.

Consequence: the blocks are theme-clean *themselves* but render **through** shared primitives that are not. Verified by the orchestrator:
- `src/app/admin/components/admin-ui.tsx` → **46 `oklch(` literals**, imported by 4 new blocks (`ClaimQueueStripe`, `RecentActivityStripe`, `RevenueStripe`, `ScheduleGapStripe`) for their `AdminIconBadge`/`AdminPanelHeader`/`AdminStatusBadge` tone maps.
- `src/app/admin/dashboard/dashboard-cards.tsx` → 5 `oklch(` literals. **This file IS in D9's trimmed list.**

**`admin-ui.tsx` is NOT named in D9's trimmed Phase E sweep** (which enumerates `dashboard/page.tsx`, `TherapistDashboard.tsx`, the new `blocks/` + variant files, `dashboard-cards.tsx`, `dashboard-filters-client.tsx`, chart-fill/LTV helpers). Left as-is, the entire new blocks library renders stuck-light in dark mode despite containing no literals of its own — protocol rule 6(b): a file outside the plan's enumerated list that the plan genuinely requires.

**✅ OWNER DECISION 2026-07-30: ADD `src/app/admin/components/admin-ui.tsx` TO PHASE E'S SWEEP.** Presented in chat with the alternatives (keep D9's trim and ship dark mode with known stuck-light badges/panel-headers, logged for C-12+; or defer the call until the diff was visible). Owner approved the scope extension. **Phase E's trimmed sweep is therefore D9's list PLUS `admin-ui.tsx`'s 46 `oklch(` literals.** This is an Owner-authorised widening of the plan's files-touched list — record it in the closeout and in any C-12+ handoff, since D9's original text still reads as the narrower scope.

**(b) LOG-ONLY — two "Recent activity" idioms will coexist.** The implementer built `RecentActivityStripe` fresh after grepping and confirming no Recent Activity panel exists in `dashboard/page.tsx` — **claim independently verified as accurate**. But a pre-existing `src/app/admin/components/ActivityTimeline.tsx` renders a panel titled "Recent activity" (consumed by `clients/[clientId]` and `PerformanceSurface`). Different data shape (client/staff activity events vs. dashboard `NotificationItem`/`buildNotifications()`) and a different shell (`AdminPanel` vs. `AdminDashboardPanel` + `AdminPanelHeader`), so this is not duplication of the same thing — but Phase B should eyeball the two side by side when it wires the stripe, to avoid shipping two visually divergent "Recent activity" looks in one product. Same applies to `RevenueStripe`, also built fresh: the plan's cited "revenue tile cluster" does not exist verbatim in `dashboard-cards.tsx` (closest relative `PaymentHealthCard` has a different Booked/Collected/Outstanding shape and was correctly left alone).

### 1.3 — Phase B notes

**The verbatim proof is the reason 3a is trustworthy.** Rather than retyping ~700 lines, the implementer applied line-range splices guarded by 10 exact-text anchor assertions, then ran a second script that re-extracts each moved region from the *committed blob* (`a633d3b:…/page.tsx`) and requires it to appear contiguously and in order in `BusinessDashboard.tsx` — plus the reverse check that every non-moved original line is still present in `page.tsx`, in order. Seven regions verified OK. The independent verifier re-derived this itself and confirmed byte-identical text. This is the standard later extraction phases should meet.

**One logged deviation in 3a, accepted.** `page.tsx`'s local `type StaffProfile = NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>` became `import type { StaffProfile } from "@/lib/auth/rbac"`. Provably the identical type (`rbac.ts:324` declares `getStaffProfile(): Promise<StaffProfile | null>`), and it avoids importing a server-auth function into a render-only component. It is the only non-byte-identical line in the entire move.

**Boundary decision (3a).** The split point is exactly the last data fetch: `getScopedBookingIds(profile)` and all three `getDashboardData` calls stay in `page.tsx`; the pure-derivation block and the return JSX moved. Module-level helpers used *exclusively* by the moved branch moved with it (verified one call site each) — leaving them behind would have forced `BusinessDashboard` to import from a route module, creating a cycle. `formatRangeLabel` correctly stayed, since it is called before the Therapist early-return.

**V-01 shipped, all three parts** — Snapshot folded into `DashboardHeader`; "Needs your attention" promoted to `PendingBookingsStripe`; Operations Health demoted into a native `<details>` "Health check", **collapsed by default** (no `open` attribute), keyboard-operable, with `focus-visible` ring and `motion-reduce:transition-none`, styled entirely from `--admin-*` variables.

**⚠️ Outstanding, Owner-performed:** plan Phase B's checkpoint "Playwright sweep: Owner + Admin → BusinessDashboard renders identically" **was NOT run and is not recorded as done** — it needs admin sign-in, which no agent may perform (protocol §3b). Substitute evidence only: dev server up, and an unauthenticated GET of `/admin/dashboard/` returns `307 → /admin/login/?redirectTo=…`, proving the new module graph compiles and loads without a render-time crash. **The authenticated identical-render check for Owner / Admin / Coordinator at 375 and 1280 remains outstanding** — folded into Phase G's role sweep and the Owner backlog. This matters more than usual: 3a claims byte-identical rendering, and only a human-eye pass can close that claim.

### 1.4 — ⚠️ B-01 was never a code bug. The plan's prescribed fix targets a mechanism that does not exist.

**This is a plan-vs-reality contradiction and was surfaced to the Owner in chat.**

Plan §1 Phase C Step 6 says: *"the literal '()' rendering bug per audit #01. Find the source in the lifted JSX — likely a parenthetical wrapping a falsy value"*, and prescribes `{secondaryValue ? <span>({secondaryValue})</span> : null}`. **No such parenthetical exists anywhere in the render path.** Two hypotheses were disproved with evidence before the real cause was found:

- **`TodayCoordinatorSubLine`** — read and ruled out by the orchestrator during scouting.
- **`formatRangeLabel` (`page.tsx:61-64`)** — the orchestrator's own scouting lead, since it wraps formatted dates in literal parens (`` `Today (${formatWeekday(from)})` ``), which would collapse to `Today ()` on an empty formatter. **Disproved:** `parseReportFilters` (`reports/reporting.ts:259`) does `customFrom || defaults.from`, and `getRangeDefaults('today')` returns `{from: today, to: today}` — `from` can never be empty, so that string can never collapse. The orchestrator's lead was wrong; recorded so nobody re-runs it.

**The real mechanism is typographic, not logical.** `dashboard-cards.tsx:279-283` is the only branch that drops the hero marquee to `clamp(1.5rem, 2.5vw, 1.875rem)` (24–30px), and it fires exactly when `useCoordinatorHeading && heroCount === 0` — Coordinator, range=today, zero bookings, which is precisely the state the audit screenshot captured. The rendered value (`dashboard-cards.tsx:321`, `{heroCount}`) is a correct `0`. But that `<p>` carries `.admin-display` = **Cormorant Garamond 600**, an extreme-contrast serif. At 24–30px its `0` loses the hairline apex and base to antialiasing, leaving only the two thick side stems — **which read as `()`**.

Evidence gathered (not asserted): in-browser canvas raster of the actually-loaded webfont measured centre-column darkness of the apex/base at **169/255 and 84/255 at 30px, 130/255 at 24px**, versus **255/255 at 50px** and 226–255 at 72px; Work Sans at 30px measures 255/255. That matches the audit's own observation that Owner/Admin — whose marquee runs 44–72px — show no parens. A pixel-level re-crop of the original audit screenshot at 14× zoom confirms **one glyph, not two**: the bowl IS closed, in pale grey.

**Fix applied (`dashboard-cards.tsx:294` + `:312-316`):** keep the deliberate V-1 zero-state downsize, but render that single state in the UI sans face — `const marqueeUsesDisplayFace = !(useCoordinatorHeading && heroCount === 0)`. Business/Admin is provably unaffected: `marqueeUsesDisplayFace` is statically true whenever `unassignedFirst` is falsy, and `cn()` emits a byte-identical class string on that path.

**✅ OWNER DECISION 2026-07-30: KEEP THE SANS SWAP AS SHIPPED.** Presented in chat with the two alternatives (raise the zero-state floor size to ~44px+ to keep Cormorant legible, or revert and accept the illusion). Owner chose to keep it. **B-01 is closed** — one state only (Coordinator / today / zero bookings); every other surface keeps Cormorant.

### 1.5 — Phase C method + logged deviations

**Verbatim proof exceeded Phase B's standard.** Two scratchpad scripts (outside the repo): the splice generator sourced the original from the *committed blob* `2112f3b:…/BusinessDashboard.tsx` (not the working tree, making it idempotently re-runnable) and asserted **140 exact-text anchors at exact line numbers**; the independent proof script re-extracted every declared region from that same blob, applied only the declared normalisations, and required each to appear contiguously with strictly increasing offsets. Result: **56 regions OK, 787 / 951 original lines relocated verbatim, declared-not-moved 164 == actual-not-moved 164.**

Deviations, all declared and mechanically re-checked: file-header comments updated (they claimed to own the Coordinator path); import blocks rewritten (unavoidable when splitting one module into three — no cycle, confirmed by tsc + build); `BusinessDashboardProps` renamed `DashboardVariantProps` and moved to the shared module with all 32 member lines byte-verbatim; eight declarations gained an `export` prefix; four comments naming the *other* variant shortened; `unassignedFirst={isCoordinatorVariant}` → bare `unassignedFirst` (statically true there; bare boolean is the repo convention — only 5 `={true}` occurrences exist in all of `src/`); uniform whitespace dedent on un-nested regions; `page.tsx` now spreads one `variantProps` object, which is the shape plan §1 Step 7 and brief §2.5 actually specify.

**Deliberately NOT done, flagged forward:** `CoordinatorDashboard` still carries `showPaymentsReadiness = plan.variant !== "coordinator"` (statically false there) and `showOperationsHealth = plan.variant !== "therapist"` (statically true there). Both are still *used*, so protocol rule 3 does not orphan them, and collapsing them would have exceeded the pure-split brief. Safe, but they read oddly in a variant-specific file — worth collapsing in a later tidy if one occurs.

### 1.6 — Phase D: the plan's text was stale, and the real surface was smaller still

Plan Step 8 lists four components to extract from `TherapistDashboard.tsx`. Re-grepping by symbol found it imported only **two** of them directly (`DashboardHeader`, `QuickHelpPanel`). It does **not** import `components/EmptyState` at all — C-FIELDWORK removed the local `HeroEmptyState` when `PractitionerTodaySection` took over — and it does **not** render `MobileStickyActionBar`; `page.tsx:296` owns that for the Therapist branch, outside `PullToRefresh`. So the honest remaining work was two import re-points plus the re-export retirement.

**Plan Step 8's "~250-400 lines after" target was deliberately NOT met** (file is 973 lines, +1). Everything still inline is Therapist-specific with no `blocks/` analogue — `ProfileCompletionNudge`, `PersonalContributionStripe`, `HighlightOrTipStrip`, `DateRangeChips`, `ClaimableStrip`, `RecentClientsStrip`, `MyWeekDisclosure`. Hoisting single-consumer Therapist UI into a *shared* library to hit a line-count estimate would have been actively wrong, and the verifier was specifically instructed to treat that as a finding if it happened.

**Helper re-export retired safely.** `export { getGreeting, getFirstName, formatHours, FORMATTERS }` removed after grep found exactly one external importer — `components/PerformanceHeader.tsx:10` — re-pointed at `shared-helpers.ts`, the canonical definition site the re-export was forwarding to anyway (identical function objects, zero behaviour change). Side benefit: `PerformanceHeader` no longer drags the whole `TherapistDashboard` module graph into its own. All four symbols remain used inside `TherapistDashboard`, so no orphan imports were created.

**⚠️ Files-touched widening, declared (protocol rule 6):** `src/app/admin/components/PerformanceHeader.tsx` is **not** on plan §2's EDITED list. Retiring the re-export is impossible without re-pointing it, and the orchestrator's dispatch explicitly directed that re-point. One-line import-path change, zero behaviour change — recorded here rather than passing silently.

**Also comment-only:** `blocks/index.ts` and `blocks/QuickHelpPanel.tsx` headers carried directives this phase falsified ("do not import this barrel from … TherapistDashboard.tsx yet"; "its sole consumer … keeps importing the original path"). Corrected per rule 3 — statements the change itself invalidated. Noted-not-fixed: `blocks/DashboardHeader.tsx`'s header comment is also stale (`page.tsx` stopped importing it in Phase B/C), but that staleness is pre-existing, so it was left alone.

**⚠️ Outstanding, Owner-performed:** plan Step 9's Playwright sweep at 375/768/1280/1440 as the Therapist **was not run and is not recorded as done** — admin sign-in is prohibited for agents (protocol §3b). Substitute evidence supplied: a component-by-component render trace re-read at HEAD confirming all 13 render sites keep identical guarding conditions, plus the fact that the diff contains no JSX at all. Queued for Phase G / the Owner backlog.

### 1.7 — ✅ OWNER DECISION 2026-07-30: restore the hero eyebrow, NOT the "Then …" preview

C-FIELDWORK's progress §3 flagged two dropped elements for C-11, while C-11 plan §2's UNCHANGED list says `PractitionerTodaySection.tsx` must not be modified. Those directly conflict; the Owner resolved it in chat.

**Decision: restore the dynamic eyebrow only.** Add an optional `eyebrow?` prop to `PractitionerTodaySection` and re-derive the label in `TherapistDashboard`. The **"Then [next visit after this one]" preview stays dropped** — not restored, and no `thenVisit?` prop is to be added. Business/Coordinator omit the prop and fall back to the static "Next visit", so they are unaffected.

**This authorises modifying `PractitionerTodaySection.tsx`, overriding plan §2's UNCHANGED entry for this one additive prop.** Record in the closeout — plan §2's text still reads as do-not-modify.

The original derivation is recoverable verbatim from `git show 29ab66e:src/app/admin/dashboard/TherapistDashboard.tsx:257-270` — `heroIsToday` / `isMondayMorning` (UTC day 1) / `lastVisitWasFriday` (last `completedThisWeek` entry, UTC day 5) → `"First visit back"` on a Monday following a Friday visit, `"Tomorrow's first visit"` when the next appointment is not today, else `"Next visit"`. Its render site was a badge `<p>` at `:594` using `--status-confirmed-bg`/`--status-confirmed-text`.

### 1.8 — Phase D follow-up: eyebrow restored (`4d09e45`), and two pre-existing quirks it exposed

**Restored verbatim, not reinvented.** All seven derivation lines are byte-identical to `29ab66e:…/TherapistDashboard.tsx:257-270`. Each of the four inputs was re-verified to still exist and still mean the same thing at HEAD — `nextAppointment` (:92), `today` (:88), `todayDate` (:105, identical `T12:00:00Z` construction), `completedThisWeek` (:163, diffed against `29ab66e:186` and confirmed character-identical including the weekStart/weekEnd IIFEs). Zero substitutions invented. `eyebrow?: string` defaults to `"Next visit"`, so every other caller — including the Business/Coordinator mount — is untouched. The **"Then …" preview was NOT restored**, per the Owner's decision: no `thenVisit` prop, no `nextAfterNext`, no "Then" JSX, verified absent.

Baseline after: **5 failed / 868 passed (873)** — +5 new specs, same five inherited failures.

**Quirk 1 — the "Tomorrow's first visit" label is wrong for most of its range.** The label says tomorrow, but the guard is only `!heroIsToday`, so it fires for ANY non-today next appointment — three weeks out included. Restored as-is per instruction, and deliberately *pinned* by a test assertion using a ~3-weeks-out booking, so the quirk is visible in the test record rather than silently preserved. Also flagged in a code comment above the derivation.

**Quirk 2 — "First visit back" is effectively dead code, and was equally dead before C-FIELDWORK. Independently confirmed by the orchestrator.** `lastVisitWasFriday` reads the last entry of `completedThisWeek`, which is bounded below by `weekStartDate`. `weekStartDate` (TherapistDashboard.tsx:151-157) computes `daysFromMonday = dow === 0 ? 6 : dow - 1` — so **on a Monday, `daysFromMonday` is 0 and `weekStartDate` IS that Monday**, while `completedThisWeek` filters `booking_date >= weekStartDate` (:166). The *previous* Friday therefore falls outside the window. The branch can only fire when a booking dated the **coming** Friday already carries status `completed` — a future-dated completed booking, which does not occur in normal operation. The spec that covers this branch has to use the same-week Friday (2026-05-29) to reach it at all, and says so in a comment.

**Neither quirk was "fixed"** — both are pre-existing original behaviour and fixing them is a behaviour change outside this task's authorisation. **For the Owner:** if the intent was "first visit after the weekend", the fix is to look at the previous calendar week rather than `completedThisWeek`.

Honest test-quality note recorded by the implementer rather than dressed up: the "default is Next visit when omitted" spec **cannot** fail against pre-change code (the literal was already `"Next visit"`) — it is a backward-compat guard, not a red-first test. The other three were verified genuinely failing at `75be734` before implementation (3 failed / 16 passed), all 19 green after.

## 2 — ⛔ PHASE E1 STOP (protocol §2.3: failed verify → one fix round → still failing → STOP)

### 2.1 — Migration: APPLIED and verified (`f95c828`)
Owner approved in chat 2026-07-31. Remote version `20260731095039`. Post-apply: column present (`text`, nullable); `staff_profiles_theme_preference_check` present with clause `((theme_preference IS NULL) OR (theme_preference = ANY (ARRAY['dark','light','system'])))`; 12 rows / 0 non-null preferences (no backfill, as designed); **`has_table_privilege('service_role','staff_profiles','UPDATE')` → TRUE**, so the C-04a class of silent 42501 failure does not apply and no companion GRANT migration is needed.

### 2.2 — E1's implementation is strong. Its *claim* is what failed.
`faaedc2` added 255 lines to `tokens.css`: `[data-theme="dark"]`, `[data-theme="light"]` and an `@media print` arm, each 63 declarations, **all `--admin-*`-prefixed, zero non-admin tokens** — verified five independent ways including a headless-Chrome computed-style diff across no-attribute/dark/light × screen/print showing zero movement in 28 sampled public/shadcn/shared tokens. All 76 `--admin-*` declarations accounted for (63 themed + 8 `var()` aliases that track automatically + 5 theme-neutral radii). **34 contrast pairs computed, 0 dark failures** — heading-on-bg 17.03, body-on-bg 14.19, muted-on-panel 7.51, primary-on-panel 8.17, all status tones ≥ 6.53, focus-vs-canvas 8.55. The calculator was validated against this repo's own documented figures first.

### 2.3 — ⛔ The BLOCKING finding, independently confirmed by the orchestrator
**"Only admin surfaces can respond to `data-theme`" is FALSE.** Shared shadcn primitives consume `--admin-*` tokens directly and are rendered on customer-facing routes:

- `src/components/ui/input.tsx:25-38` styles **every** `<Input>` in the codebase with `--admin-radius-control`, `--admin-surface-input`, `--admin-border-form`, `--admin-body`, `--admin-text-muted`, `--admin-focus`. The `var()` fallbacks never fire, because those properties are always defined in `:root`.
- `src/app/booking/manage/ManageBookingForms.tsx:89-105` renders two such `<Input>`s (`preferred_date`, `preferred_time`) with **no className override**.
- `src/app/booking/manage/page.tsx:47` resolves the booking purely from a URL token via `getCustomerManageBooking(token)` — **no staff session**. It sits outside `src/app/admin/**` and outside the `(public)` route group, inheriting the single root `<html>` — the same element the theme attribute is planned to live on.
- Companion (SHOULD-FIX): `src/components/ui/badge.tsx:55-60`'s `default`/`secondary`/`outline` variants use `--admin-primary`/`--admin-panel-muted`/`--admin-body`/`--admin-border`. `/booking/manage` renders one, safe **only incidentally** because `twMerge` drops the earlier conflicting utilities in favour of the `--rahma-*` overrides passed via `className`. Any future bare `<Badge>` on a public page inherits admin theming.

**Not a regression introduced by E1** — the coupling predates C-11. E1 converts it from dormant to live by making those tokens theme-variable. It is currently inert (nothing sets `data-theme` yet) and **detonates when E3 ships**.

**Blast radius, stated honestly:** a customer never has `data-theme` set — only the admin layout will set it. The realistic path is a staff member client-side-navigating from `/admin/*` to `/booking/manage` in one SPA session, where the attribute persists on `<html>`. So this is staff-visible breakage on a customer page, not customer-visible breakage. That narrows severity but does not make the phase's safety claim true.

### 2.4 — The fix round did not fix it
`e2031de` ("correct overclaimed public-safety guarantee") is **comment-only**. `git diff faaedc2^..HEAD --stat -- src/` shows exactly one file changed across the whole Phase E range: `src/styles/tokens.css`. `input.tsx` and `badge.tsx` were last touched pre-C-11. The re-verifier caught this rather than accepting the claim — correct behaviour.

### 2.4a — ✅ OWNER DECISION 2026-07-31: scope `data-theme` to the ADMIN WRAPPER, not `<html>`

Presented in chat with three alternatives (split the shared primitives; keep `<html>` and accept the risk; prepare both diffs first). **Owner chose: set the theme attribute on the admin layout's own wrapper element instead of `document.documentElement`.** Public routes then structurally cannot inherit it, regardless of which tokens they consume — this closes the class of defect, not just the two known instances.

**This overrides plan Steps 12 and 15**, which lock `document.documentElement.dataset.theme`. Record in the closeout: the plan text still says `documentElement`.

Consequences for the remaining work:
- **`tokens.css` needs no selector change.** `[data-theme="dark"]` is an attribute selector that matches any element, and custom properties inherit to descendants — so declaring them on the admin wrapper themes the admin subtree and nothing else. Only the file's explanatory comments need correcting.
- **FOUC largely disappears.** The admin layout already fetches `profile.theme_preference`, so it can render `data-theme` **server-side** on its wrapper. For `dark`/`light` there is then no flash at all — strictly better than the plan's inline-script approach. Only `system` still needs client-side resolution, since the server cannot know the OS preference.
- **⚠️ Portals are the non-obvious hazard.** Radix dropdowns/dialogs and Sonner toasts mount into `document.body`, i.e. OUTSIDE the admin wrapper — they would render with light tokens while the rest of the admin is dark. E3 must handle this deliberately (e.g. the provider also marking the portal container while the admin tree is mounted, with cleanup on unmount so nothing leaks after navigating away) and verify it, rather than discovering it as a visual bug later.

### 2.5 — Orchestrator note: dev server was down
The E1 dispatch asserted the dev server was running (it was, at pre-flight and again at the Phase A/B/C dispatches) but it had stopped by E1; the implementer measured `000` and said so instead of quietly skipping the check, substituting a headless-Chrome computed-style diff that is strictly stronger than the prescribed "load a public page and eyeball it". Good call, recorded so the substitution is not mistaken for the original check having run.

---

*Pre-flight 2026-07-30; Phase A `4e18fa9`; Phase B `bdbe64f`+`93c3f08`; Phase C `b95e2ea`+`5ffcbba`; Phase D `75d42c4` + eyebrow `4d09e45`; Phase E migration `f95c828`, E1 `faaedc2`+`e2031de`. **STOPPED at E1 pending an Owner decision on how to scope `data-theme` (see §2.3).***
