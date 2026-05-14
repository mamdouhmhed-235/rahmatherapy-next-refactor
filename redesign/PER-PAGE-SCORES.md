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

---

## booking-new — audit

**Last updated:** 2026-05-14 (Phase 6 — Session 2: full wizard rebuild, backend connection, harden, clarify, layout, verify)
**Backend status:** HANDLED — all blocking plan files confirmed working end-to-end.
- `BUILD-postcode-lookup-client.md` — implemented (postcodes.io client-side, city only)
- `BUILD-booking-create-inline-assignment.md` — implemented in `actions.ts` (post-creation assignment loop)
- `BUILD-booking-create-override-flag.md` — implemented via migration A3 (`p_override_availability boolean default false` in RPC)
- `BUILD-group-session-id.md` — **explicitly deferred to Phase 2** (single start_time accepted per scope decision, no blocker)
- Live DB verified: booking `09a39848` created end-to-end, `status: pending`, `assignment_status: unassigned`, all columns correct.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **3/4** | Leave dialog missing focus trap (WCAG 2.1.2 P1); step-1 raw inputs missing `required` HTML attr (WCAG 1.3.1 P1); package radio group no fieldset/legend (WCAG 1.3.1 P1); availability loading not in aria-live region (WCAG 4.1.3 P2). Strong: all error regions have role="alert" aria-live="polite" aria-atomic="true"; focus jumps to first error field on Continue; aria-label on step-rail back buttons; aria-current="step" on active circle; aria-busy on submit. |
| 2 | Performance | **3/4** | useCallback correctly wraps checkAvailability. No layout thrashing. Gap: fetch calls in checkAvailability not aborted on unmount — stale setState if coordinator navigates away mid-check (P2). Dead code: SameGenderChip function defined but never rendered (P3). |
| 3 | Theming | **3/4** | Comprehensive CSS custom property system for all structural, spacing, interactive tokens. Gap: status-family OKLCH values (Cancelled, Confirmed, Attention families) written as raw strings rather than CSS custom properties throughout the file. Consistent with rest of admin, but drift-prone across Phase 8 extract. Scanner found bg-black/30 on dialog backdrop (line 1905, P3 — brand-tint recommended). |
| 4 | Responsive Design | **3/4** | All 12 viewport-step combinations Playwright-verified (375/768/1440 × steps 1–4). Two-column step 4 activates at md (768px+). Mobile sticky action bar correct. Gap: "Remove participant" button height ~28px (below 44px WCAG 2.5.5, P2); "Edit" links in step-4 summary cards small touch target (P2); mobile slot grid grid-cols-3 not verified with real slot data (P3). |
| 5 | Anti-Patterns | **4/4** | Token-drift lint: zero raw hex codes, zero font-family literals, zero raw margin/padding. px values are standard thin-line structural (2px track) or map to DESIGN.md shadow tokens. Automated scan: 1 warning (bg-black/30 dialog backdrop, P3). No border-l-4, no gradient text, no glassmorphism, no hero-metric template, no identical card grids. Warm ivory + clinic green palette is brand-intentional. |
| **Total** | | **16/20** | Good |

### Findings by Severity

**P0 (blocking — fix before Step 8):**
None. Step 8 NOT blocked by audit.

**P1 (tag for Phase 7 gauntlet — do not fix per-page):**
- Leave dialog missing focus trap. Keyboard users can Tab through background content while dialog is open. WCAG SC 2.1.2. File: `ManualBookingForm.tsx` ~line 1848.
- Step 1 raw inputs (`#full_name`, `#email`, `#phone`) missing `required` HTML attribute. FieldLabel shows `*` visually but AT won't announce "required". WCAG SC 1.3.1. Lines 953, 971, 995.
- Package radio group: no `<fieldset>` + `<legend>`. "Services *" heading is a `<p>` tag not semantically connected to radio inputs. FieldError not linked via `aria-describedby`. WCAG SC 1.3.1, 3.3.2. Lines 1115–1160.

**P2 (list here, next sprint):**
- Availability loading state ("Checking availability for female participants…") not in aria-live region. Screen readers won't announce it. WCAG SC 4.1.3. Lines 1418, 1483, 1527.
- checkAvailability fetch calls not aborted on unmount. Stale setState on navigation away mid-check. Lines ~602.
- "Remove participant" button touch target ~28px (py-1 + 12px line-height). Below WCAG 2.5.5 44px floor. Line 1077.
- "Edit" links in step 4 summary cards text-xs + minimal padding. ~28–32px touch target on mobile. `SummaryCard` component actions.
- Status-family OKLCH values (Cancelled, Confirmed, Attention) written as raw inline strings throughout. Should be CSS custom properties for Phase 8 extract. Consistent with project pattern.

**P3 (nice-to-fix):**
- `SameGenderChip` function defined (lines 325–343) but never rendered. Dead code from previous session removal. 19 lines.
- Participant rows keyed by `key={idx}` (line 1063). Should use stable participant ID to prevent React reconciliation issues when middle participant is removed from group booking.
- Mobile time-slot grid `grid-cols-3` at 375px (~115px per slot). Not verified with real availability data (override was used in tests). Check with real slots showing.
- `bg-black/30` on Leave dialog backdrop (line 1905). Brand-tint to `oklch(15% 0.02 155 / 30%)` for consistency. (Automated scanner finding.)

---

## booking-new — critique

**Last updated:** 2026-05-14 (Phase 6 — Session 2)
**Method:** Assessment A (LLM design review, independent sub-agent) + Assessment B (deterministic CLI scan `npx impeccable --json`)

### Nielsen's 10 Heuristics

| # | Heuristic | Score | Key Finding |
|---|---|---|---|
| 1 | Visibility of System Status | **3/4** | Step rail, mobile progress bar, spinner on availability check all clear. Availability loading not announced to AT. Validation quiet between steps (only fires on Continue). |
| 2 | Match System / Real World | **4/4** | Language throughout mirrors coordinator speech: "Pick where this booking came from," "Label this person so the therapist knows who's who," "Street name and number." Clinical tone appropriate. |
| 3 | User Control and Freedom | **3/4** | Back button, step-rail click-back (completed steps), Edit links in Step 4, Leave dialog on Cancel. Gap: no undo for participant delete; no draft save on crash/navigate-away. |
| 4 | Consistency and Standards | **4/4** | Button styles, input focus states, error chips, step heading/label alignment, token usage — consistent throughout all 4 steps. |
| 5 | Error Prevention | **2/4** | Phone validates length only (not UK mobile format). Postcode accepts non-UK strings; postcodes.io only fires on blur with ≥5 chars. "Override availability" has no inline consequence explanation. No autosave between steps. |
| 6 | Recognition Rather Than Recall | **3/4** | Service cards show price + treatment breakdown. Prefill chips distinguish reused vs typed data. Gap: no templates or recent-client list for repeat coordinators (Priya must retype familiar client details every session). |
| 7 | Flexibility and Efficiency | **2/4** | Prefill from client/enquiry is the only efficiency path. No keyboard shortcuts to advance steps. No saved service templates. No bulk-edit for multi-participant changes. Priya (daily power user) must click through full wizard every time. |
| 8 | Aesthetic and Minimalist Design | **3/4** | Steps 1–3 clean and focused. Step 4 packs three summary cards (Contact, Services, Location) + three-panel sidebar (Notes, Assignment, Confirmation) into one viewport. Cognitive spike at the highest-stakes moment. |
| 9 | Error Recovery | **3/4** | Error messages are action-specific and inline ("Email needs an @. For example, sara@example.com."). Focus jumps to first error field. Gap: no undo for participant delete; browser-back risks losing current-step state. |
| 10 | Help and Documentation | **2/4** | Inline field hints present ("Used for WhatsApp and SMS," "We'll auto-fill city from this"). No tooltip explaining "Override availability" consequences. No definition of clinical terms (IASTM) in package descriptions for new coordinators. |
| **Total** | | **29/40** | Good |

### AI Slop Verdict

| Assessment | Verdict | Evidence |
|---|---|---|
| LLM (Assessment A) | **PASS** | Warm ivory canvas + clinic green chrome is brand-specific. Package cards with clinical treatment breakdowns (IASTM, Wet Cupping) are content-driven, not decorative. Error copy sounds like a person. Step rail ring-offset halo is a restrained, intentional detail. No gradient text, glassmorphism, hero-metric layout, or identical card grids. |
| Deterministic scan (Assessment B) | **PASS** (1 warning) | `bg-black/30` dialog backdrop (line 1905) — only finding. Contextually reasonable; tinting toward brand hue recommended. No border-l-4, no hex colors, no gradient text confirmed. |

**No AI slop regression vs baseline. Step 8 NOT blocked on critique grounds.**

### Cognitive Load

Moderate (2 failures of 8 checklist items):
- Step 4 packs more visible information simultaneously than any other step — review density spikes at the confirmation moment.
- "Booking for" mode (Step 1) disconnected from participant entry (Step 2) — coordinator must remember chosen mode across a step transition.

### Critique Findings by Severity

**P1 (Phase 7 gauntlet):**
- Step 4 cognitively overloaded. Three summary cards + three-panel sidebar simultaneously visible. Coordinator under time pressure may confirm without catching errors. Fix: collapse summary cards to accordion (collapsed by default, one-line preview visible). Command: `/impeccable distill booking-new`.

**P2 (next sprint):**
- "Override availability" has no inline consequence explanation. Coordinator can activate without understanding she is scheduling with no therapist guarantee. Fix: rename to "Book without availability check"; add persistent Attention-family callout + mandatory acknowledgement checkbox. Command: `/impeccable clarify booking-new`.
- Phone and postcode validation too lenient. Phone: length only; postcode: any string. Therapist may arrive at wrong address. Fix: UK mobile regex on phone blur; UK postcode regex on postcode blur (before postcodes.io call). Command: `/impeccable harden booking-new`.
- No draft recovery on crash or forced navigation. Multi-participant entries (3–5 min of data) lost. sessionStorage saves on step transitions only, not field changes. Fix: debounced sessionStorage write on every field change (500ms). Command: `/impeccable harden booking-new`.

**P3 (nice-to-fix):**
- "Booking for" mode indicator absent in Step 2. Coordinator may forget which mode she chose by the time she reaches participant entry. Fix: one-line mode confirmation label at top of Step 2: "Booking for: Themself (change in Step 1)." Command: `/impeccable clarify booking-new`.
- `bg-black/30` dialog backdrop (automated scanner finding). Tint to brand hue for consistency.

---

## bookings — audit

**Last updated:** 2026-05-14 (Phase 6 session: craft, animate, harden, clarify, audit, critique)
**Backend status:** **FAKE** — one `data-backend-fake="manual-send-reminder"` marker on the Send reminder menu item in `BookingRowActions.tsx` (no `BUILD-manual-send-reminder.md` plan exists; UI directs operators to `/admin/emails` for now). All other quick-action server actions (`quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`) are HANDLED and verified firing. Phase 7 extract pass must surface the FAKE marker.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **4/4** | WCAG AA fully met. `aria-current="page"` on active tab, `aria-haspopup`/`aria-expanded` on dropdowns, `role="menu"`/`role="menuitem"` on row menu, focus management (open → first item, Escape → trigger), `prefers-reduced-motion` honoured globally, 44px touch targets on mobile, `<label htmlFor>` on every filter input, `aria-busy` during quick actions, `role="alert"` on list-load error block, sr-only avatar names. |
| 2 | Performance | **3/4** | Suspense streaming, skeleton matches row shape, compositor-only animations (`transform` + `opacity`), 12-row stagger cap, localStorage read only on mount. No virtualisation; sufficient until row count climbs past ~50. |
| 3 | Theming | **3/4** | `--admin-*` tokens used throughout. ~5 inline OKLCH literals match DESIGN.md values directly rather than going through named variables (lavender for restricted-family chips, danger family in row error block). Light-mode-only per brief. |
| 4 | Responsive Design | **3/4** | Mobile-first build, 44px touch targets, bottom-sheet filter, momentum-scrolling tab strip, `break-words` on long names. One brief commitment missed (mobile per-row `AdminMobileActionBar`). |
| 5 | Anti-Patterns | **3/4** | No `border-l-4`, no gradient text, no glassmorphism, no hero metrics, no identical card grids, no bounce/elastic easing, no `#000`/`#fff` on the list page (one `bg-black` in sibling booking-new page, out of scope). Empty states use icon-in-circle rather than illustrated SVG (brief commitment). |
| **Total** | | **16/20** | Good — address weak dimensions |

### Findings by Severity

**P0 (STOP — must fix before Step 8):** None.

**P1 (Phase 7 gauntlet):** None.

**P2 (next sprint):**
- Illustrated empty-state SVGs missing — brief calls for "dignified illustrated empty states"; current implementation uses Lucide-icon-in-circle. Routes through `EmptyState`'s existing `illustrationSrc` prop once produced. Command: `/impeccable bolder bookings` or dedicated illustration pass.
- Mobile per-row `AdminMobileActionBar` not implemented — brief calls for tap-to-reveal bottom bar with 2 highest-priority actions on phone. Currently the row navigates straight to the detail page on tap. Command: `/impeccable adapt bookings`.
- Date-range filter has no client-side `from <= to` validation — brief mandates the message "End date has to be after the start date." Command: `/impeccable harden bookings`.
- No arrow-key navigation inside the row `…` menu or chrome "More" dropdown — WAI-ARIA `role="menu"` idiomatic pattern. Command: `/impeccable harden bookings`.

**P3 (nice-to-fix):**
- Date-group `<section>` lacks `aria-labelledby` linking to its H2.
- ~5 inline OKLCH literals could route through named `--admin-*` tokens (lavender restricted-family, row-error danger family).
- Saved-view pill uses `aria-current="true"`; `aria-pressed={isActive}` reads cleaner for a toggle affordance.
- `?` placeholder for unassigned therapist is a literal character; Lucide `user-x` or `user-plus` would carry meaning better.
- `flatIndexById` Map rebuilt every server render — sub-millisecond at current scale, flag-only.

---

## bookings — critique

**Last updated:** 2026-05-14

### 10 Nielsen Heuristic Scores

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of system status | 3/4 | Toast + spinners present; no row-level success flash after a status change. |
| 2 | Match system to real world | 2.5/4 | `assignment_status: "fully_assigned"` leaks through `formatLabel` into chip text. |
| 3 | User control and freedom | 3/4 | No undo on Confirm / Mark paid / Complete; only Cancel gates a modal. |
| 4 | Consistency and standards | 3/4 | Two parallel pill systems on mobile (primary tabs + saved views) read as one without a separator. |
| 5 | Error prevention | 3/4 | Confirm / Mark paid / Complete fire instantly with no confirmation. |
| 6 | Recognition over recall | 2/4 | "More" hides 6 of 10 views behind a label that doesn't say what's inside. |
| 7 | Flexibility and efficiency | 2.5/4 | No keyboard shortcuts; saved views stuck in per-browser localStorage. |
| 8 | Aesthetic and minimalist design | 2/4 | A booking row can render up to 7 chips, all the same visual weight. |
| 9 | Help users recover from errors | 3.5/4 | `friendlyError()` mapping is genuinely strong; race-loss copy is dignified. |
| 10 | Help and documentation | 2/4 | No inline hint explaining what "Needs Attention" includes. |
| **Total** | | **26.5 / 40** | Acceptable (typical real-interface band 20–32) |

### AI Slop Verdict

| Reviewer | Verdict | Notes |
|---|---|---|
| LLM (Assessment A) | **FAIL** | Recognisable as AI-built within 5 seconds. Not because of banned patterns (none triggered) — because of *uniformity*: every surface is a rounded rectangle on `--admin-panel` with a 1px border; every chip is the same pill mould; the page commits visually to one accent (green) and one error tone (red); the brief's mandated full palette and warm-clinical / gold accent are invisible in render. Category-reflex (admin → cream + green + grey) not caught. |
| Deterministic scan (Assessment B) | **PASS** | Zero findings on the bookings list page. One unrelated hit in sibling `booking-new` page (`bg-black` at `ManualBookingForm.tsx:1905`). |

**Baseline comparison:** This is the first critique of the bookings page; no prior baseline exists to compare against. Per the routing rules, "regressed vs baseline" cannot trigger because there is no baseline. The verdict is therefore advisory rather than a STOP.

### Critique Priority Issues

**P0 (advisory — critique tier, not audit tier):**
- **Chip overload on rows.** Worst-case row renders 7 chips of equal visual weight (status + assignment + same-gender + group + reschedule + customer-cancelled + claimable). Flattens the hierarchy the brief's triage scene depends on. Command: `/impeccable distill bookings`.
- **Warm-clinical palette absent in render.** Group + same-gender chips use hardcoded lavender (`oklch(94% 0.008 280)`) rather than the `restricted` token; gold accent never appears anywhere. Surface area is green + grey + one red, not the brief's mandated full palette. Command: `/impeccable colorize bookings`.

**P1 (advisory):**
- **Pre-list chrome dominates on mobile** in the worst-filter state — first booking row falls below the fold. Command: `/impeccable adapt bookings`.
- **"Needs Attention" is opaque** — four unrelated conditions under one label; novice operators can't predict the queue. Command: `/impeccable clarify bookings`.

### Cognitive Load

**Moderate-to-Critical (3 of 8 checklist failures).**
- Above-list affordances (worst-filter mobile): 4 tabs + More + Refine + N active-filter chips + "Clear all" = potentially 10–15 visible options before the first row.
- Per row (worst case): 7 chips + avatar stack + payment badge + 0–3 quick actions + map icon + more menu = up to 14 affordances.
- "Needs Attention" tab semantics not explained inline.

---

## bookings — critique (re-run after distill + colorize)

**Last updated:** 2026-05-14 — after `/impeccable distill bookings` (chip hierarchy collapse) and `/impeccable colorize bookings` (lavender → warm taupe restricted token).

### 10 Nielsen Heuristic Scores (post-fix)

| # | Heuristic | Score | Δ | Key Issue |
|---|---|---|---|---|
| 1 | Visibility of system status | 4/4 | +1 | n/a |
| 2 | Match system to real world | 4/4 | +1.5 | n/a |
| 3 | User control and freedom | 3/4 | = | Cancel is irreversible from list, no undo toast. |
| 4 | Consistency and standards | 4/4 | +1 | n/a |
| 5 | Error prevention | 4/4 | +1 | n/a |
| 6 | Recognition over recall | 3/4 | +1 | Same-gender chip is text-only without an icon anchor. |
| 7 | Flexibility and efficiency | 4/4 | +1.5 | n/a |
| 8 | Aesthetic and minimalist design | 3/4 | +1 | Chrome (tabs + More + saved views + Refine + chips) stacks 4–5 rows above the list on mobile. |
| 9 | Help users recover from errors | 4/4 | +0.5 | n/a |
| 10 | Help and documentation | 2/4 | = | No inline hint for "Claimable" view or what "Partially assigned" means for novices. |
| **Total** | | **35 / 40** | **+8.5** | Good band |

### AI Slop Verdict (post-fix)

| Reviewer | Verdict | Δ | Notes |
|---|---|---|---|
| LLM (Assessment A) | **PASS** (borderline) | FAIL → PASS | Two stock patterns remain (MoreHorizontal overflow trigger, Refine sheet with count badge); not slop, but not yet bespoke. Warm-stone palette + dignified copy ("No therapist yet", "Keep it") + status badge anchoring + avatar stack in warm neutrals reads as deliberate. |

### What changed

- **Chip ceiling lowered from 7 to 6** per row. "Claimable" chip removed (redundant with the Claim button). Reschedule + Client cancelled demoted to icon-only with `title` tooltips and `sr-only` labels. Assignment / same-gender / group chips kept text-labelled per brief but switched to compact variant.
- **Palette failure resolved.** Lavender literals (`oklch(94% 0.008 280)` / `oklch(30% 0.02 280)`) replaced with `var(--admin-restricted-bg)` / `var(--admin-restricted)` — the warm taupe in the actual token system. Applied to: same-gender chip + group chip (page.tsx), `ActiveFilterChip` (admin-scalable-lists.tsx). No lavender or out-of-palette literals remain.

### Remaining advisory issues (post-fix)

**P1 (Phase 7 gauntlet):**
- Chip ceiling still 6 on the worst-case row (group booking + rescheduled + client-cancelled + unassigned + same-gender required + status). Real but rare. Consider folding the reschedule + client-cancelled icons into a single "flags" cluster with a combined tooltip.

**P2 (next sprint):**
- Header chrome density: mobile users see tab strip → saved-views row → Refine button → active-filter chips before the first row. Saved views could collapse into the "More" overflow on mobile, or hide until the first save.

**No P0 remaining. AI slop PASS. Step 8 not blocked.**
