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
| A | — | Shared building-blocks library + specs | not started |
| B | — | `BusinessDashboard.tsx` extraction (3a verbatim → 3b compose) + V-01 | not started |
| C | — | `CoordinatorDashboard.tsx` extraction + B-01 parens fix | not started |
| D | — | `TherapistDashboard.tsx` refactor onto shared blocks | not started |
| E | — | Dark-mode infrastructure (⛔ Zone-2 migration at Step 10) | not started |
| F | — | Motion-reduce sweep (VERIFY-ALREADY-IMPLEMENTED wrapper; optional per D8) | not started |
| G | — | End-to-end verification | not started |

---

*Pre-flight recorded 2026-07-30. Implementation begins once the Owner resolves the item-2 dev-server stop.*
