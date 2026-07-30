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
| C | — | `CoordinatorDashboard.tsx` extraction + B-01 parens fix | not started |
| D | — | `TherapistDashboard.tsx` refactor onto shared blocks | not started |
| E | — | Dark-mode infrastructure (⛔ Zone-2 migration at Step 10) | not started |
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

**`admin-ui.tsx` is NOT named in D9's trimmed Phase E sweep** (which enumerates `dashboard/page.tsx`, `TherapistDashboard.tsx`, the new `blocks/` + variant files, `dashboard-cards.tsx`, `dashboard-filters-client.tsx`, chart-fill/LTV helpers). Left as-is, the entire new blocks library renders stuck-light in dark mode despite containing no literals of its own. **This needs an Owner scope decision at Phase E** — it is a change to a file outside the plan's enumerated list that Phase E genuinely requires (protocol rule 6(b)). Raised in chat at Phase A closeout; formal ⏸ at Phase E.

**(b) LOG-ONLY — two "Recent activity" idioms will coexist.** The implementer built `RecentActivityStripe` fresh after grepping and confirming no Recent Activity panel exists in `dashboard/page.tsx` — **claim independently verified as accurate**. But a pre-existing `src/app/admin/components/ActivityTimeline.tsx` renders a panel titled "Recent activity" (consumed by `clients/[clientId]` and `PerformanceSurface`). Different data shape (client/staff activity events vs. dashboard `NotificationItem`/`buildNotifications()`) and a different shell (`AdminPanel` vs. `AdminDashboardPanel` + `AdminPanelHeader`), so this is not duplication of the same thing — but Phase B should eyeball the two side by side when it wires the stripe, to avoid shipping two visually divergent "Recent activity" looks in one product. Same applies to `RevenueStripe`, also built fresh: the plan's cited "revenue tile cluster" does not exist verbatim in `dashboard-cards.tsx` (closest relative `PaymentHealthCard` has a different Booked/Collected/Outstanding shape and was correctly left alone).

### 1.3 — Phase B notes

**The verbatim proof is the reason 3a is trustworthy.** Rather than retyping ~700 lines, the implementer applied line-range splices guarded by 10 exact-text anchor assertions, then ran a second script that re-extracts each moved region from the *committed blob* (`a633d3b:…/page.tsx`) and requires it to appear contiguously and in order in `BusinessDashboard.tsx` — plus the reverse check that every non-moved original line is still present in `page.tsx`, in order. Seven regions verified OK. The independent verifier re-derived this itself and confirmed byte-identical text. This is the standard later extraction phases should meet.

**One logged deviation in 3a, accepted.** `page.tsx`'s local `type StaffProfile = NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>` became `import type { StaffProfile } from "@/lib/auth/rbac"`. Provably the identical type (`rbac.ts:324` declares `getStaffProfile(): Promise<StaffProfile | null>`), and it avoids importing a server-auth function into a render-only component. It is the only non-byte-identical line in the entire move.

**Boundary decision (3a).** The split point is exactly the last data fetch: `getScopedBookingIds(profile)` and all three `getDashboardData` calls stay in `page.tsx`; the pure-derivation block and the return JSX moved. Module-level helpers used *exclusively* by the moved branch moved with it (verified one call site each) — leaving them behind would have forced `BusinessDashboard` to import from a route module, creating a cycle. `formatRangeLabel` correctly stayed, since it is called before the Therapist early-return.

**V-01 shipped, all three parts** — Snapshot folded into `DashboardHeader`; "Needs your attention" promoted to `PendingBookingsStripe`; Operations Health demoted into a native `<details>` "Health check", **collapsed by default** (no `open` attribute), keyboard-operable, with `focus-visible` ring and `motion-reduce:transition-none`, styled entirely from `--admin-*` variables.

**⚠️ Outstanding, Owner-performed:** plan Phase B's checkpoint "Playwright sweep: Owner + Admin → BusinessDashboard renders identically" **was NOT run and is not recorded as done** — it needs admin sign-in, which no agent may perform (protocol §3b). Substitute evidence only: dev server up, and an unauthenticated GET of `/admin/dashboard/` returns `307 → /admin/login/?redirectTo=…`, proving the new module graph compiles and loads without a render-time crash. **The authenticated identical-render check for Owner / Admin / Coordinator at 375 and 1280 remains outstanding** — folded into Phase G's role sweep and the Owner backlog. This matters more than usual: 3a claims byte-identical rendering, and only a human-eye pass can close that claim.

---

*Pre-flight recorded 2026-07-30; Phase A `4e18fa9`; Phase B `bdbe64f` + `93c3f08`. Next: Phase C (CoordinatorDashboard extraction + B-01 parens fix, `opus`).*
