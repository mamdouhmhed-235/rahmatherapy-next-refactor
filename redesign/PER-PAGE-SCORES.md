# Per-Page Scores — Phase 6

Scores appended after each page session completes audit + critique.

**Routing rules:**
- P0 → STOP before Step 8. Fix first.
- P1 → tag for Phase 7 gauntlet (do not fix per-page).
- P2/P3 → listed here, deferred to next sprint.
- AI slop regressed vs baseline → STOP, re-run bolder/distill.

---

## 00-shared-components — audit

**Last updated:** 2026-05-13 (Phase 6 full session — nav redesign, primitives, RBAC fixes, harden, adapt, clarify)
**Backend status:** N-A — RECIPE-PROGRESS.md confirms 0 backend gaps, 0 plan files for this page. Note: `manage_account_password_requests` permission DB assignment is a dependency for session 12 (account-password-requests), not session 1.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **3/4** | Focus rings, skip link, aria-current, focus restoration on sheet close all correct. P1 gap: `role="menu"` declared without arrow-key navigation; section group labels use role="presentation" (not announced to AT). |
| 2 | Performance | **3/4** | CSS-only animations (transform + opacity), proper useEffect cleanup, 120ms debounced search. P3: `Bell` and `LayoutGrid` Lucide icons imported but unused — negligible bundle impact, tree-shaken at build. |
| 3 | Theming | **3/4** | Near-complete OKLCH token system. One hex drift (`#fff8ec`) found and fixed during verification → `var(--brand-warm-surface)`. P2: active nav pill uses `oklch(90%_0.028_155)` — diverges from DESIGN.md `surface-selected` `oklch(92%_0.022_155)` (live-session accepted value). |
| 4 | Responsive Design | **4/4** | 375/768/1440 all Playwright-verified. Bottom tab bar height 57px. No horizontal scroll at 375px. `safe-area-inset-bottom` applied. Landscape mode collapses tab bar to 44px and hides labels. Touch targets ≥44px throughout. |
| 5 | Anti-Patterns | **4/4** | Deterministic scan: `[]` — zero findings. Zero border-l-4, gradient text, bg-black, rgba shadows, hero-metric, identical card grids. Clinic Green / warm ivory palette is distinctive; six status families are principled. |
| **Total** | | **17/20** | Good |

### Findings by Severity

**P0 (blocking — fix before Step 8):**
None. Step 8 not blocked.

**Step 7 device-review fix (resolved before commit):**
Nav link text and user menu trigger contrast failure discovered on physical device review. Root cause: `site-parity.css` global `a { color: inherit; }` defeated opacity-based white text utilities on `<a>` elements; Safari rendered default button background on the user menu trigger. Fixed by: `text-white` on brand `<Link>` + `<nav>` (scoped, no cascade to dropdown); inactive nav links changed to full `text-white`; trigger button given `bg-transparent appearance-none`. See HARDEN-RECS entry H7.

**P1 (tag for Phase 7 gauntlet — do not fix per-page):**
- `role="menu"` declared on UserMenuButton dropdown without arrow-key (↑/↓) navigation. WCAG SC 4.1.2 — declared role doesn't match interaction model. `AdminCommandSearch` already implements arrow nav — same pattern needed in UserMenuButton. File: `src/app/admin/components/AdminTopNav.tsx`.

**P2 (list here, next sprint):**
- Dropdown + mobile sheet section group labels use `role="presentation"` on `<p>` elements — visual groups not conveyed to AT. Should be `role="group" aria-label`. Both `UserMenuButton` (line ~480) and `UserMenuSheet` (line ~745) affected.
- `UserMenuButton` dropdown does not close on Tab-out. Only Escape + click-outside handled; keyboard users tabbing past last item leave dropdown open.
- Active nav pill token mismatch: `oklch(90%_0.028_155)` (live-accepted) vs DESIGN.md `surface-selected` `oklch(92%_0.022_155)`.
- "Sign out" uses Cancelled/red family — correct semantically, but reads as alarming for a routine action. Consider Soft Slate muted treatment.

**P3 (nice-to-fix):**
- Remove unused `Bell` and `LayoutGrid` Lucide imports from `AdminTopNav.tsx` (lines 10, 16).
- Multiple OKLCH status colour values written inline as Tailwind arbitrary values rather than CSS custom properties — Phase 8 extract pass sweep.
- User menu dropdown close has no exit animation (instant conditional unmount). Enter is 160ms ease-gentle; exit is instant. Add delayed unmount + opacity:0 transition in animate pass.

---

## 00-shared-components — critique

**Last updated:** 2026-05-13 (Phase 6 full session — includes nav redesign + live mode + primitives)
**Method:** Assessment A (LLM design review, independent sub-agent) + Assessment B (deterministic CLI scan `npx impeccable --json`)
**Note on Nielsen score:** Score decreased from an earlier pass (29/40 → 24/40) because this session introduced significant nav redesign (bottom tab bar, user menu consolidation) that the previous pass had not evaluated. New gaps found are real design findings, not regressions. AI slop verdict is unchanged (PASS). Step 8 not blocked.

### Nielsen's 10 Heuristics

| # | Heuristic | Score | Key Finding |
|---|---|---|---|
| 1 | Visibility of System Status | **3/4** | Active tab indicator clear; loading states on buttons correct. No ambient "today's status" signal — staff open app and must navigate to see what's urgent. |
| 2 | Match System / Real World | **3/4** | "My day", "Team", "My bookings" role labels excellent. "Operations", "Admin & Compliance", "Privacy" are IT taxonomy, not clinic workflow vocabulary. |
| 3 | User Control and Freedom | **2/4** | ConfirmActionModal and focus restoration on sheet close correct. No undo for non-destructive mutations. No breadcrumb escape on nested screens. |
| 4 | Consistency and Standards | **3/4** | Six status families, icon+label nav, focus rings — consistent throughout. RBAC-gated items disappearing per role risks breaking user's structural mental map. |
| 5 | Error Prevention | **3/4** | role="alert" on all fields, 120ms debounce, ConfirmActionModal for destructive. High-stakes mutations don't require re-typing a confirmation token. |
| 6 | Recognition Over Recall | **2/4** | Icon+label primary nav strong. Dropdown taxonomy requires recall (Availability under CLINIC SETUP, not SCHEDULING). ⌘K desktop only — no mobile discovery path. |
| 7 | Flexibility and Efficiency | **2/4** | ⌘K search for power users. No shortcut for New Booking (highest-frequency action). Reports occupies permanent tab-bar real estate equal to Bookings for all roles. |
| 8 | Aesthetic and Minimalist Design | **3/4** | Flat panels, no decorative borders, restrained palette — correct. Risk: busy reading environment when all six badge families appear simultaneously on a dense list. |
| 9 | Help Users Recognize, Diagnose, Recover | **2/4** | Search error retains query + toast fires. role="alert" announces field errors. No recovery path described after booking/assignment failures beyond generic toast. |
| 10 | Help and Documentation | **1/4** | Nothing. Five RBAC roles, real staff turnover (locums, part-timers) — zero in-context help is a material onboarding gap. |
| **Total** | | **24/40** | Good |

### AI Slop Verdict

| Assessment | Verdict | Evidence |
|---|---|---|
| LLM (Assessment A) | **PASS** (qualified) | Clinic Green / warm ivory palette is real brand decision. Cormorant on numerals only. Six named status families. Bottom tab bar replacing hamburger is evidence-based. Qualified flag: dropdown's four-section IA taxonomy reads as IT architecture, not clinic workflow. |
| Deterministic scan (Assessment B) | **PASS** | `[]` — zero findings. No border-l-4, gradient text, glassmorphism, hero-metric, identical card grids confirmed across 7 component files. |

No AI slop regression. Step 8 not blocked.

### Cognitive Load
4 failures of 8 checklist items:
- No visible primary CTA (New Booking) in mobile chrome
- Dropdown taxonomy demands role-specific recall
- "Operations" and "Admin & Compliance" labels require mode-switching
- No persistent role indicator in chrome (affects temporary role elevation, onboarding)

### Remaining Critique Issues

**P1 (Phase 7 gauntlet):**
- No primary CTA in mobile chrome — therapist/coordinator on phone has no one-tap path to New Booking from anywhere. Three navigation steps from cold start.

**P2 (next sprint):**
- Dropdown taxonomy ("SCHEDULING & LEADS / COMMUNICATIONS / CLINIC SETUP / ADMIN & COMPLIANCE") is IT IA, not clinic mental model. Reorder around job-to-be-done frequency; add flat "Quick links" at top per role.
- Six tabs at 375px: Reports is low-frequency for all roles but holds permanent tab-bar real estate. Drop to five tabs; move Reports to More sheet.
- "Sign out" in Cancelled/red family reads as alarming for a routine action. Move to Soft Slate muted treatment.
- Section group headers in dropdown + mobile sheet not announced to AT (`role="presentation"`).

**P3 (nice-to-fix):**
- "RT" initials duplicated in mobile More sheet identity header (top bar already shows it). Reclaim that 60px for link list — reduce scroll distance.
- AdminPanel h2 on every panel creates a flat heading outline on multi-panel pages; verify heading structure on each page session.
- Search debounce at 120ms is tighter than the 200ms floor standard. Conservative to 200ms on poor mobile connections.
- ConfirmActionModal uses Confirmed (green) family for positive confirm — verify no semantic tension when confirming a destructive action (cancel booking = green confirm button).

---

*Append each page session below as sessions complete.*
