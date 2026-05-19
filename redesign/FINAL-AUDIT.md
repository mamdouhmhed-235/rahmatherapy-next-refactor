# Final Technical Audit — Rahma Admin (Phase 7 Gate 1)

**Date:** 2026-05-19
**Phase:** Phase 7 — Pre-Ship Gauntlet · Gate 1 (`/impeccable audit admin`)
**Method:** Dual pass —
- **Static code audit** (parallel sub-agent): grep / glob / read across `src/app/admin/` for the 5 audit dimensions plus baseline-finding resolution; cited file:line throughout.
- **Live Playwright walk** against `http://localhost:3000` with the redesigned Phase 6 code (branch `redesign/start-state`, head commit `256d87c`), exercising 12 representative admin routes at desktop 1440×900 and dashboard at mobile 375×812, then a role-switch sweep across Owner / Therapist / Coordinator / Admin-PM / Inactive.

**Baseline document:** `/redesign/BASELINE-AUDIT.md` (12/20 Acceptable; pre-redesign).
**Contract:** every dimension must equal-or-beat baseline. AI-slop verdict must move FAIL → PASS.

---

## Audit Health Score (post-redesign)

| # | Dimension | Score | Δ vs baseline | Key Finding |
|---|---|---|---|---|
| 1 | Accessibility | **4/4** | **+2** | 74 `role="alert"` regions in admin; 31 `aria-current` callsites; location filter wired through `FilterField label htmlFor` (live-confirmed `hasLabel: true`); all baseline H1→H3 skips eliminated (settings / staff / availability / staff-detail clean H1→H2 chain at runtime); shared `FieldLabel` renders required `*` in Cancelled-family colour with `aria-hidden="true"` |
| 2 | Performance | **3/4** | ±0 | AdminTopNav scroll listener removed; zero `useLayoutEffect`; Recharts `minHeight={288}` confirmed at runtime (no CLS). **Regression risk:** `backdrop-blur` grew from 5 → 22 callsites (every new modal/sheet reused the backdrop recipe); notification-bell localStorage waterfall unfixed (P1-P2 carry-forward, eslint-disable still on line 81) |
| 3 | Theming | **3/4** | **+1** | Zero raw `bg-gray-*`/`text-gray-*`/`border-orange-200`/`border-red-200`; panel-tone borders now OKLCH literals (`admin-ui.tsx:51-60`); but 51 `bg-white` callsites in 15 files remain; `ReportsCharts.tsx:33-62` hard-codes 4 brand hex values (`#e8dfd2`/`#30463f`/`#2f7d6d`/`#c27803`) where neighbour `demand-trend-client.tsx` uses `var(--admin-accent)` correctly; 3× `#ffffff` literals in `AvailabilityModeSelector` |
| 4 | Responsive Design | **3/4** | ±0 | Mobile 375×812 dashboard: no horizontal scroll; document scrollWidth=360 (clean). **Regression risk unfixed:** `min-h-9` (36px) still on dashboard CTAs at `dashboard-cards.tsx:176/181/188` and `attention-group-client.tsx:210/220`; `notification-bell.tsx:196` raw `w-[26rem]` overrides `AdminPopover` safe `w-[min(calc(100vw-1rem),26rem)]` default and overflows < 416px |
| 5 | Anti-Patterns | **4/4** | **+2** | Zero `border-l-4` (was 3 baseline absolute-ban hits); zero `animate-bounce`; zero `bg-clip-text text-transparent`; baseline `bg-black` violation at `attention-group-client.tsx:144` now `bg-[oklch(12%_0.014_155)]/35`. One residual `bg-black/30` literal on the leave-confirmation modal backdrop at `ManualBookingForm.tsx:1905` (every other modal overlay uses `bg-[oklch(12%_0.01_165)]/35`) — P2 polish, not absolute-ban |
| **Total** | | **17/20** | **+5** | **Good — minor work in Theming, Responsive, Performance** |

**Rating band:** 14–17 Good (address weak dimensions). Three points off the Excellent band (18–20) — none of the three weakest dimensions has a P0; all three carry P1/P2/P3 items routed to Gates 4–7.

---

## Baseline-finding resolution (line-by-line vs `/redesign/BASELINE-AUDIT.md`)

| # | Baseline finding | Status | Evidence |
|---|---|---|---|
| **P0-A1** | Form errors missing `role="alert"` on all admin forms | **RESOLVED** | 74 `role="alert"` callsites across 42 admin files — shared `FieldError` primitive `(ManualBookingForm.tsx:367-381)` reused; spot-check live on `/admin/clients/new`, `/admin/settings`, `/admin/bookings/[id]`, `/admin/login` |
| **P0-A2** | `/admin/clients` location filter no accessible name | **RESOLVED** | Live probe on `/admin/clients`: `input[name=location]` returns `hasLabel: true`, placeholder `"City or area"`; static: `clients/page.tsx:702-708, :1193-1199` route through `FilterField label="Location" htmlFor="location"` |
| **P1-A3** | H1→H3 heading skips on 4 pages | **RESOLVED** | Live probes: `/admin/settings` H1→H2 only (no skip); `/admin/staff` member names now H2; `/admin/availability` H1→H2→H3 nested correctly; `/admin/roles` role names H2 (was `<p>` baseline) |
| **P1-A4** | Required-field markers invisible | **RESOLVED** | Live `/admin/settings` returned `requiredMarker: 5/5`; `/admin/bookings/new` returned `4/4`; shared `FieldLabel` adds `<span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">*</span>` |
| **P1-A5** | `statusToneClasses.muted` color-only | **RESOLVED** | `admin-ui.tsx:31` `muted: "bg-[var(--admin-panel-muted)]"`; `:42` `text-[var(--admin-text-muted)]` — token-bound, paired with text labels at every callsite |
| **P1-AP1** | 3× `border-l-4` absolute-ban hits | **RESOLVED** | Zero `border-l-4` in admin/. `dashboard-cards.tsx:140-144` rewritten as full-border + `bg-[oklch(95.5%_0.028_20)]/30` tint; same pattern at `:1040-1043`; notification-bell rewritten. Live probes returned `borderL4: 0` on every page swept. |
| **P1-AP2** | `backdrop-blur-sm` on dialog backdrops | **NOT-RESOLVED** | Still present at `admin-ui-interactions.tsx:80/185`, `AdminCommandSearch.tsx:126`, `ServiceFormDialog.tsx:84`, `DeleteServiceButton.tsx:86`, `TemplatesTab.tsx:303`, `RejectModal.tsx:81`, `ApproveModal.tsx:83`, `DangerZonePanel.tsx:161`, `PermissionRow.tsx:218`, `ManualSendSheet.tsx:187/401`, `AdminTopNav.tsx:690/845`, `BlockedDatesManager.tsx:185`, `StaffBlockedDatesManager.tsx:393`. Count rose from 5 → 22 — borderline glassmorphism is now the standard backdrop recipe. **Tag → Gate 7 polish (or accept-and-document).** |
| **P1-AP3** | `bg-black` in attention group | **RESOLVED** | `attention-group-client.tsx:144` now `bg-[oklch(12%_0.014_155)]/35`. Live probes returned `bg_black: 0` on every page. |
| **P1-T1** | Panel-tone borders raw Tailwind palette | **RESOLVED** | `admin-ui.tsx:51-60` all OKLCH literals; zero raw `border-(orange|red|emerald|sky|violet|amber|green|yellow|blue)-200` in admin |
| **P1-T2** | 10+ `bg-white` → `var(--admin-panel)` | **PARTIAL** | 51 `bg-white` in 15 files; ~16 are in `dashboard-cards.tsx` alone on cards/chips that should use `--admin-panel` (#fffefa). **Tag → Gate 7 polish.** |
| **P1-P1** | AdminTopNav scroll listener | **RESOLVED** | Zero `addEventListener.*scroll`/`onScroll` anywhere in admin |
| **P1-P2** | notification-bell localStorage waterfall | **NOT-RESOLVED** | `notification-bell.tsx:77-87` still post-mount `useEffect` with `eslint-disable react-hooks/set-state-in-effect`. **Tag → Gate 4 optimize.** |
| **P2-R1** | Notification popover 26rem overflow < 375px | **NOT-RESOLVED** | `notification-bell.tsx:196` overrides `AdminPopover` safe default with raw `w-[26rem]` — defeats responsive cap. **Tag → Gate 5 adapt.** |
| **P2-R2** | `min-h-9` touch targets < 44px | **NOT-RESOLVED** | `dashboard-cards.tsx:176/181/188` and `attention-group-client.tsx:210/220` still 36px. Live mobile probe confirmed 40px height on the dashboard date-preset filter pills. **Tag → Gate 5 adapt.** WCAG 2.5.5 (AA). |
| **P2-T3/T4** | Raw gray + hex literals | **PARTIAL** | Raw gray = 0 hits ✓; hex count fell from 24 → ~7 (`#ffffff` ×3 in `AvailabilityModeSelector` + `availability/page.tsx:234`; `#e8dfd2`/`#30463f`/`#2f7d6d`/`#c27803` ×6 in `ReportsCharts.tsx`). **Tag → Gate 7 polish.** |
| **W-1** | Recharts width/height warnings on `/admin/reports` | **RESOLVED** | Live probe on `/admin/reports`: 0 console warnings (baseline = 6); chart containers measure 288px height as expected |

---

## Anti-Patterns Verdict

**PASS.** All four baseline absolute-ban violations are resolved at the rendered DOM level:

- `border-l-4` → **zero** hits in `src/app/admin/`; live probes returned `borderL4: 0` on dashboard / bookings / clients / settings / staff / reports / calendar / availability / audit / roles / services / privacy / emails / staff-detail.
- `bg-black` → baseline dashboard hit replaced with `bg-[oklch(12%_0.014_155)]/35`; live probes returned `bg_black: 0` on every page swept.
- Gradient text → zero `bg-clip-text` matches.
- `animate-bounce`, hero-metric stacks, identical card grids, nested shadcn `<Card>` — zero hits.

**One residual literal** flagged P2 (not absolute-ban): `bg-black/30` on the unsaved-changes leave-confirmation modal backdrop at `ManualBookingForm.tsx:1905`. Every other admin overlay uses the tinted-neutral recipe. → Gate 7 polish.

**AI-slop verdict shift vs baseline:** **FAIL → PASS.** Brand identity already present in baseline (warm ivory, deep clinic green, Cormorant numerals); the absolute-ban hits that overrode BORDERLINE → FAIL are gone.

---

## Executive Summary

- Audit Health Score: **17/20 (Good)** — up from **12/20 (Acceptable)**. +5 net.
- AI-slop verdict: **PASS** (was FAIL).
- **Per-dimension comparison: zero regressions.** All five dimensions are equal-or-beat baseline. Performance and Responsive carry the same score (3/4) but with a different mix of fixes and new debt — net neutral on the score, real items routed to Gates 4 and 5.
- Issue counts:
  - **P0: 0** (gate not blocked)
  - **P1: 2** (backdrop-blur proliferation; notification-bell hydration waterfall — both inherited from baseline P1-AP2 / P1-P2)
  - **P2: 8** (touch targets; notification popover width; bg-white; ReportsCharts hex; `#ffffff` literals; `bg-black/30` modal backdrop; `transition-all` proliferation; **NEW hydration mismatch on /admin/clients**)
  - **P3: 2** (notification badge `text-white` colour-law spread; remaining minor polish)
- Top blockers: **none.** Phase 7 Gate 1 is **CLEARED** subject to Gate 2 (no P0 a11y outstanding).

---

## Per-role live observations

| Role | Surface verified | Result |
|---|---|---|
| **Owner** (rahmatherapy@outlook.com) | Desktop sweep across 12 admin routes + mobile dashboard | All headings clean; all baseline a11y fixes confirmed at runtime; 1 console error (see [P2-NEW1] below); 0 anti-patterns rendered |
| **Therapist** (test.therapist@…) | Mobile 375×812 dashboard | RBAC-narrowed nav ("My day / My bookings / Team"); voice anchor H1 "Good morning, Test."; "No upcoming visit" + "Open to claim" panels; **Casey #4 dashed-border empty state baseline finding RESOLVED** (`dashedBorders: 0` on the page); no horizontal scroll |
| **Coordinator** (test.coordinator@…) | Desktop dashboard | RBAC-narrowed nav ("Dashboard / Bookings / Clients / Enquiries / Team" — no Reports, no Staff config); Tier 1 Today + Urgent Attention + Tier 2 "Active queues" disclosure (Active enquiries + Operations health). Brief 07 surface honoured. |
| **Admin/PM** (test.admin@…) | Desktop dashboard + `/admin/audit` + `/admin/settings` + `/admin/roles` | `/admin/roles` correctly renders Denied surface with H1 "Roles access limited" and **no raw permission-name leak** (baseline `manage_role_templates` leak resolved). `/admin/audit` and `/admin/settings` render full content for this test fixture — consistent with the fixture's permission grants, not a deny-page regression. |
| **Inactive** (test.inactive@…) | Login attempt | Blocked at login with `/admin/login/?reason=inactive` URL; banner "Account inactive — This staff account is inactive. Contact an owner or manager to restore access" + "Sign out" button. Login-brief honoured. |

---

## Detailed Findings by Severity

### P0 — Blocking (immediate, before Gate 2)

**None.** Gate 2 is not blocked.

### P1 — Major (Gate 4 / Gate 7)

**[P1-AP2-CARRY] `backdrop-blur` proliferation across modals/sheets**
- **Location:** `admin-ui-interactions.tsx:80/185`, `AdminCommandSearch.tsx:126`, `ServiceFormDialog.tsx:84`, `DeleteServiceButton.tsx:86`, `RejectModal.tsx:81`, `ApproveModal.tsx:83`, `DangerZonePanel.tsx:161`, `PermissionRow.tsx:218`, `ManualSendSheet.tsx:187/401`, `AdminTopNav.tsx:690/845`, `BlockedDatesManager.tsx:185`, `StaffBlockedDatesManager.tsx:393`, `TemplatesTab.tsx:303` (22 callsites total, up from 5 baseline)
- **Category:** Anti-Pattern / Performance
- **Impact:** Borderline glassmorphism became the de-facto modal backdrop recipe across Phase 6 sessions. Each modal recomputes the blur on scroll/resize — paint cost on mid-range Android. Brand law is "rare and purposeful" not "default".
- **Recommendation:** Either (a) accept and document as an admin convention in DESIGN.md (the user has confirmed glassmorphism on overlay-separation in earlier phases — borderline acceptable here), or (b) replace with solid `bg-[oklch(12%_0.01_165)]/50` overlay in one sweep.
- **Suggested gate:** **Gate 7 polish** (decision-pending; sweep is mechanical once the call is made).

**[P1-P2-CARRY] `notification-bell.tsx` localStorage hydration waterfall**
- **Location:** `src/app/admin/components/notification-bell.tsx:77-87` (eslint-disable `react-hooks/set-state-in-effect` still on line 81)
- **Category:** Performance
- **Impact:** Server renders one state, client re-renders after localStorage read. The eslint-disable indicates the team is aware and chose not to fix during Phase 6.
- **Recommendation:** Initialise state with a function that reads localStorage at the top of the component, or move to `useSyncExternalStore` with a server-side fallback.
- **Suggested gate:** **Gate 4 optimize.**

### P2 — Minor (Gate 5 / Gate 7)

**[P2-NEW1] Hydration mismatch on `/admin/clients` (NEW REGRESSION)**
- **Location:** `src/app/admin/clients/page.tsx` → `ClientRow` avatar span (the deterministic-tint avatar SVG's text content differs between server and client render — diff in the React warning shows `李�` characters versus the same with a different replacement). Likely cause: the initial letter token derives from `String.fromCodePoint(...)` or `slice(0,1)` on a string containing a CJK character + surrogate pair, and Node's text-encoding differs from the browser's.
- **Category:** Performance / Accessibility (regenerates the subtree on the client → CLS risk + flicker)
- **Impact:** Phase 6 contract was zero NEW errors or warnings vs baseline. Baseline had 0 console errors. This page now logs 1 error on every load. Mitigates to a single re-render rather than a crash, but it's a contract violation.
- **WCAG:** Indirect — content reflow risk
- **Recommendation:** Normalise the avatar initial extraction to use Unicode-safe segmentation (`[...name][0]` or `Array.from(name)[0]`) instead of `name[0]` / `slice(0,1)`. Add a unit test for CJK + emoji + diacritic display names.
- **Suggested gate:** **Gate 3 harden.**

**[P2-R2-CARRY] `min-h-9` touch targets on dashboard CTAs**
- **Location:** `dashboard-cards.tsx:176, 181, 188`; `attention-group-client.tsx:210, 220`; date-preset filter pills at 40px height (live-measured at 375px viewport)
- **Category:** Responsive Design
- **WCAG:** 2.5.5 Target Size (AA) — 44×44px minimum
- **Recommendation:** `min-h-11 sm:min-h-9` recipe.
- **Suggested gate:** **Gate 5 adapt.**

**[P2-R3-CARRY] Notification popover width override**
- **Location:** `components/notification-bell.tsx:196` raw `w-[26rem]` overrides `admin-popover.tsx:50` safe `w-[min(calc(100vw-1rem),26rem)]` default
- **Category:** Responsive Design
- **Impact:** Overflows < 416px viewport (iPhone SE etc.).
- **Recommendation:** Remove the override; let `AdminPopover` cap.
- **Suggested gate:** **Gate 5 adapt.**

**[P2-T2-CARRY] 51× `bg-white` callsites should be `var(--admin-panel)`**
- **Location:** 15 admin files including `dashboard-cards.tsx` (16 hits on cards/chips at `:140/361/586/829/1042/1224/1348/1367/1393/1589` plus others)
- **Category:** Theming
- **Recommendation:** Surgical sweep: replace on cards/chips (not on `<input>`s which contractually use `--admin-panel-input`).
- **Suggested gate:** **Gate 7 polish.**

**[P2-T8-NEW] ReportsCharts hard-codes 4 brand hex values**
- **Location:** `src/app/admin/reports/ReportsCharts.tsx:33, 38, 39, 40, 58, 62` — `#e8dfd2`, `#30463f`, `#2f7d6d`, `#c27803`
- **Category:** Theming
- **Impact:** Token escape on the highest-visibility analytics surface; neighbour `demand-trend-client.tsx:45,49` shows the correct `var(--admin-accent)` pattern.
- **Recommendation:** Replace with tokens.
- **Suggested gate:** **Gate 7 polish.**

**[P2-T9-NEW] `#ffffff` literals in availability mode selector**
- **Location:** `availability/AvailabilityModeSelector.tsx:171, 191`; `availability/page.tsx:234`
- **Category:** Theming
- **Recommendation:** `text-white` (or `text-[oklch(99%_0.005_165)]` near-white).
- **Suggested gate:** **Gate 7 polish.**

**[P2-AP4-NEW] `bg-black/30` on leave-confirmation modal backdrop**
- **Location:** `src/app/admin/bookings/new/ManualBookingForm.tsx:1905`
- **Category:** Anti-Pattern (tinted-neutral law)
- **Recommendation:** Replace with `bg-[oklch(12%_0.01_165)]/35` to match every other admin overlay.
- **Suggested gate:** **Gate 7 polish.**

**[P2-P3-NEW] `transition-all` proliferation**
- **Location:** 15 callsites across `dashboard-filters-client.tsx` ×4, `dashboard-cards.tsx` ×2, `notification-bell.tsx` ×1, `ManualBookingForm.tsx` ×8
- **Category:** Performance
- **Impact:** Triggers paint on every property change; prefer scoped `transition-colors`/`transition-shadow`/`transition-transform`.
- **Suggested gate:** **Gate 4 optimize.**

### P3 — Polish (Gate 7)

**[P3-A6-CARRY] Notification badge `text-white` colour-law spread**
- **Location:** `notification-bell.tsx:413`, `attention-group-client.tsx:267`, multiple `bg-white/20 text-white` chip patterns
- **Category:** Theming / Accessibility (no functional WCAG failure on the dark backgrounds these sit on)
- **Recommendation:** `text-[oklch(99%_0.005_165)]` near-white.
- **Suggested gate:** **Gate 7 polish.**

**[P3-T6-CARRY] No dark-mode support** (accepted single-mode design per PRODUCT.md).

---

## Findings routed by gate

| Finding | Gate | Why |
|---|---|---|
| (none) | **Gate 2 clarify** | No copy / labelling P0–P1 found at the audit pass. Any copy concerns surface in `critique` (next pass), not `audit`. |
| [P2-NEW1] Hydration mismatch `/admin/clients` | **Gate 3 harden** | Error state; Phase 6 zero-new-error contract violation. |
| [P1-P2-CARRY] notification-bell waterfall | **Gate 4 optimize** | Performance. |
| [P2-P3-NEW] `transition-all` proliferation | **Gate 4 optimize** | Performance. |
| ~~[P2-R2-CARRY] `min-h-9` touch targets~~ | **Gate 5 adapt — HANDLED 2026-05-19** | Mobile WCAG 2.5.5. `min-h-11 sm:min-h-9` recipe applied at 9 callsites + global CSS `.admin-action-primary` / `.admin-action-outline` bumped to `min-height: 2.75rem` (mobile) / `2.5rem` (sm:). Live-verified at 375: every named CTA ≥ 44 px. See `redesign/ADAPT-PASS.md`. |
| ~~[P2-R3-CARRY] notification popover width override~~ | **Gate 5 adapt — HANDLED 2026-05-19** | Mobile overflow < 416 px. `notification-bell.tsx:287` raw `w-[26rem]` className removed; `AdminPopover` safe default `w-[min(calc(100vw-1rem),26rem)]` now applies. See `redesign/ADAPT-PASS.md`. |
| (none) | **Gate 6 onboard** | No weak empty-state regressions found; Therapist Casey #4 dashed-border is resolved; other empty states use the shared `EmptyState` component. |
| [P1-AP2-CARRY] `backdrop-blur` proliferation | **Gate 7 polish** | Decision pending (accept-and-document vs. sweep). |
| [P2-T2-CARRY] 51× `bg-white` | **Gate 7 polish** | Token discipline. |
| [P2-T8-NEW] ReportsCharts hex literals | **Gate 7 polish** | Token discipline. |
| [P2-T9-NEW] `#ffffff` literals | **Gate 7 polish** | Token discipline. |
| [P2-AP4-NEW] `bg-black/30` modal backdrop | **Gate 7 polish** | Tinted-neutral law. |
| [P3-A6-CARRY] `text-white` colour-law spread | **Gate 7 polish** | Brand colour law. |

---

## Patterns & Systemic Issues

1. **One systemic accessibility gap closed; one perf gap remains.** `role="alert"` parity reached 100% on the surfaces probed; `FieldError`/`FieldLabel` primitives are the proper systemic fix. The single open Performance carry-forward (notification-bell waterfall) is known and eslint-disabled.

2. **`backdrop-blur` is the de-facto modal recipe** — count grew from 5 → 22 in Phase 6. Either accept the convention (and document in DESIGN.md) or sweep once in Gate 7. **This is the single largest decision pending.**

3. **`bg-white` and a handful of hex literals are the last token escapes.** Mostly localised in `dashboard-cards.tsx` and `ReportsCharts.tsx`; both can be closed in one mechanical Gate-7 pass.

4. **Touch-target floor not enforced.** `min-h-9` (36px) still on dashboard CTAs — the highest-traffic mobile surface for therapists. Adopt the `min-h-11 sm:min-h-9` recipe across the dashboard primary/secondary button strip.

5. **NEW: hydration mismatch on `/admin/clients`** — Phase 6 contract was "zero new errors or warnings"; this regresses the contract on one page. Avatar-initial extraction is Unicode-unsafe.

---

## Positive Findings

- Skip link preserved with proper `sr-only` + focus reveal (`AdminTopNav.tsx:217-222`).
- 598 `aria-hidden` decorations on icons — decorative-icon discipline retained.
- 31 `aria-current` callsites — every primary nav, tab strip, calendar day cell, breadcrumb, and stepper has correct programmatic state (`aria-current="page"` / `"step"` / `"date"`).
- `next/image` universal; zero plain `<img>` in admin.
- Zero `useLayoutEffect`, zero `will-change`, zero layout-property transitions.
- Recharts CLS solved: `minHeight={288}` confirmed live at the rendered DOM on `/admin/reports` (all three chart containers measure 288px height).
- `ConfirmActionModal`-pattern adopted in 14 destructive paths — the orphan from baseline is now widely consumed.
- Shared `FieldError` / `FieldLabel` primitives — the proper systemic fix for the baseline P0-A1 + P1-A4.
- OKLCH-only colour tokens in `admin-ui.tsx` (six tone maps).
- RBAC denied surfaces strip raw permission names — `/admin/roles` for Admin/PM renders H1 "Roles access limited" with no `manage_role_templates` leak (baseline cited this exact leak).
- Therapist mobile dashboard: voice anchor H1 ("Good morning, Test."), Casey #4 dashed-border empty state resolved, no horizontal scroll at 375px.
- Inactive login blocked with the brief's exact banner copy.

---

## Recommended Actions (priority order)

1. **[P2] Gate 3 harden — `/impeccable harden admin clients`** — fix the hydration mismatch on `/admin/clients` (Unicode-safe avatar-initial extraction). Single-file fix; closes the only contract-violating new error in the audit.
2. **[P1+P2] Gate 4 optimize — `/impeccable optimize admin`** — resolve notification-bell localStorage waterfall; sweep `transition-all` → scoped transitions.
3. **[P2] Gate 5 adapt — `/impeccable adapt admin`** — `min-h-11 sm:min-h-9` on dashboard CTAs; remove notification-popover width override.
4. **(none) Gate 6 onboard — skip** — no weak empty states found in this audit. (Critique pass may surface more.)
5. **[P1+P2+P3] Gate 7 polish — `/impeccable polish admin`** — runs last per gauntlet rule. `backdrop-blur` decision (accept-and-document vs sweep); `bg-white` → `var(--admin-panel)`; ReportsCharts hex → tokens; `#ffffff` literals → `text-white`/near-white; `bg-black/30` modal backdrop → tinted-neutral; notification-badge `text-white` → near-white.

End with `/impeccable polish admin` as the final step per gauntlet rule.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit admin` after fixes to see your score improve.
