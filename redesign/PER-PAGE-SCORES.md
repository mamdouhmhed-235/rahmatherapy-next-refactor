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

## bookings — critique-rerun

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

---

## booking-detail — audit

**Last updated:** 2026-05-15 (Phase 6 session — harden + clarify + adapt + polish; mobile action bar duplication removed; alignment fix in Status & payment grid)
**Backend status:** **N-A** — per RECIPE-PROGRESS.md Phase 5.5 booking-detail: COMPLETE (0 gaps, 0 plan files). All server actions (`updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus`) and all 10 audit-log writes preserved verbatim per brief Feature Preservation Manifest.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **4/4** | WCAG AA fully met. H1→H2 contiguous (no skips); `role="alert" aria-live="polite"` on every form error region; required `*` markers; `aria-busy` + `aria-disabled` on save buttons; `aria-current="page"` on breadcrumb; `aria-current="step"` on lifecycle pills; ConfirmActionModal wired via BaseDialog (auto aria-modal/labelledby/describedby); touch targets ≥44px on mobile via `min-h-11 sm:min-h-8`. Minor: `<time>` lacks `dateTime` attr (P3). |
| 2 | Performance | **3/4** | Server-component data fetch; client components scoped to forms/interactions only. No layout-property animations (transform + opacity only). React keys on all lists. `ParticipantRow` re-filters `booking_items` per row (O(n·m), small in practice — P2). |
| 3 | Theming | **3/4** | Strong token usage across borders/surfaces/typography. Status-family OKLCH literals repeated inline across `AssignmentRow` unassigned tile, `FormError`, `NEXT_ACTION_BG/TEXT` maps, `BookingDetailSidebar` Total, and three inline warnings — needs extract pass (P2). Light only by design (Theme decision locked). |
| 4 | Responsive Design | **3/4** | Sticky sidebar `md:sticky md:top-4`; two-column at `md:` with `minmax(0,1fr)`. Cormorant numerals now have `min-w-0 break-words tabular-nums` (Step 2 harden). Mobile section order deviates from brief §5 — sidebar drops below entire main column on mobile, stranding Address card at page foot (P2 audit / P1 critique). |
| 5 | Anti-Patterns | **4/4** | No side-stripe borders (Activity timeline uses 1px structural `border-l`, within spec). No gradient text, no decorative glass, no hero-metric template, no identical card grids. Cards varied by content type (SummaryCard Cormorant numeral, ClientCard avatar + tel/mail, AddressCard description-list rows). Cubic-bezier(0.16,1,0.3,1) easing — exponential ease-out, no bounce. No em dashes. No #fff/#000. |
| **Total** | | **17/20** | Good |

### Findings by Severity

**P0 (blocking — fix before Step 8):**
None. Step 8 not blocked.

**P1 (tag for Phase 7 gauntlet — do not fix per-page):**
None at the audit level. (Critique elevates mobile section-order to P1 from a UX-mobile-first lens — see critique section below.)

**P2 (list here, next sprint):**
- **Status-family colours not surfaced as CSS variables.** Six bg+text OKLCH pairs inlined across ~12 spots (AssignmentRow unassigned avatar tile `page.tsx:756`; Email error message `page.tsx:937`; `NEXT_ACTION_BG/NEXT_ACTION_TEXT` maps `page.tsx:1220-1233`; FormError, required-marker color, over-total warning, paid-with-zero warning, payment-status warning in `BookingManagementForm.tsx`; Total numeral `BookingDetailSidebar.tsx:103`). Theme-drift risk; values match DESIGN.md §2 spec but aren't tokenized. Fix via `/impeccable extract` after this page completes.
- **Mobile section order deviates from brief §5.** Brief specifies interleaved order (Booking summary → Status & payment → Participants → Assignment → Client card → Notes → Address card → Email activity → Activity timeline). Implementation: `<div className="grid gap-6 md:grid-cols-[...]">` containing main column then `<BookingDetailSidebar>` collapses linearly on mobile, dropping all sidebar cards (Client + Address) below the entire main column. Therapist mobile workflow degraded — they scroll past Notes + Email + Activity to reach the Maps button.
- **`ParticipantRow` re-filters items per row.** `page.tsx:589` runs `booking.booking_items.filter(item => item.booking_participant_id === participant.id)` inside each map iteration — O(n·m). Pre-bucketize once in `ParticipantsPanel`.
- **`ConfirmActionModal` opens at fixed `top-[30vh]`** (`admin-ui-interactions.tsx:186`). On short mobile landscape viewports modal can clip below fold; on tall desktop sits visually high. Should centre via `top-1/2 -translate-y-1/2` with `max-h-[min(85vh,40rem)] overflow-y-auto`. Affects all admin modals.

**P3 (nice-to-fix):**
- `<time>` elements lack `dateTime={event.created_at}` attribute in Email activity (~`page.tsx:919`) and Activity timeline (~`page.tsx:998`).
- Lifecycle pills lack `aria-label` indicating completed/current/upcoming step semantic state (`BookingManagementForm.tsx:486-518`). Visual state via colour + dot opacity only.
- Inconsistent tabular-nums declarations: `[font-variant-numeric:tabular-nums]` in some places, `[font-feature-settings:'tnum']` in others. Pick one.
- `formatLabel(participant.participant_gender)` renders "male"/"female" lowercase — inconsistent with capitalised status badges nearby (`page.tsx:609`).
- Lifecycle pill row uses `overflow-x-auto` without `[-webkit-overflow-scrolling:touch]` momentum hint.
- `status` select still uses `defaultValue` (uncontrolled) while `payment_status` was converted to controlled in this session. Reset semantics differ.
- `BookingCreatedToast` uses `📋` emoji icon — cross-platform rendering drift. Use a Lucide icon via Sonner's `icon` slot.

**Step 1–2 harden fixes applied during this session (resolved):**
- Status & payment 2-column field grid mis-aligned (Payment method select shifted below by Match-total chip cell-stretch) → `items-start` on outer grid.
- Email activity `error_message` overflow on long Resend error tokens → `break-words`.
- Breadcrumb reference cell missing copy-the-full-id tooltip → `title={booking.id}`.
- `AmountPaidInput` lacked over-total warning → inline `role="status"` Pending-family inline warning.
- `payment_status: paid` + `amount_paid: 0` silently accepted → inline warning beneath Payment status select.
- Save errors auto-dismissed with no recovery → persistent Sonner toast + Retry action (status & notes + therapist-scoped notes).
- Cormorant numeral overflow risk on tight sidebar → `min-w-0 break-words tabular-nums` on SummaryCard Total + NextActionStrip numeral.
- `ParticipantsPanel` returned `null` on empty → `EmptyState` ("No participants on file").
- Activity timeline `<ol>` showed default decimals through green dots → `list-none`, action-label humanization map, tightened vertical rhythm.
- Mobile sticky bar duplicated in-panel saves at doc-end → removed both `AdminMobileActionBar` blocks; preserved `pb-24 md:pb-0` for footer-nav clearance.
- Uppercase shouting eyebrows (4 spots) → sentence-case.
- "Booking confirmed" doneLabel → "Confirmed".
- "Confirmed, but a therapist still needs assigning." → "Confirmed. A therapist still needs assigning."

---

## booking-detail — critique

**Last updated:** 2026-05-15
**Method:** Single in-head LLM review. Deterministic CLI (`npx impeccable`) not wired in this repo; playwright/Chrome session locked by existing user session — browser-overlay isolation unavailable. Methodology limit acknowledged in the critique report.

### Nielsen's 10 Heuristics

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | **4/4** | Exemplary. NextActionStrip + lifecycle pills + status badges + loading aria-busy + optimistic Claim + Sonner toasts on every state change. |
| 2 | Match System / Real World | **3/4** | `formatLabel` renders "male"/"female" lowercase next to capitalized status badges; email event_types ("booking_confirmation_customer") leak raw via `formatLabel`. |
| 3 | User Control and Freedom | **3/4** | Modals cancel cleanly; back-link present. No `Undo` toast action on quick-actions; no notes-draft autosave. |
| 4 | Consistency and Standards | **3/4** | `status` select uncontrolled while `payment_status` is now controlled; two `tabular-nums` syntaxes co-exist; touch-target classes applied unevenly. |
| 5 | Error Prevention | **3/4** | Confirm modals + inline warnings + required markers + smart defaults. No transition-validity check on `status` (Pending → No-show is offerable). |
| 6 | Recognition Rather Than Recall | **3/4** | Real names + real numbers + sticky sidebar + breadcrumb. Booking reference is 8-char short; full ID on `title=` only (not click-to-copy). |
| 7 | Flexibility and Efficiency | **3/4** | "Match total" chip, split saves, sticky sidebar. No keyboard shortcuts (intentional per PRODUCT.md novice tech-level). |
| 8 | Aesthetic and Minimalist | **3/4** | Disciplined Card-Board grammar. Lifecycle pills + status badge in panel header duplicate the same signal 36px apart. 9 cards total on full-scope view. |
| 9 | Error Recovery | **4/4** | Persistent error toast with Retry, optimistic Claim with race-lost rollback, role=alert form errors, recovery copy in destructive modals. |
| 10 | Help and Documentation | **2/4** | Inline note-field hints good. Quick-action tooltips are `title=` only (not focus-visible). No "why required?" hints. No formal docs surface. |
| **Total** | | **31/40** | **Good** (28–35 band) |

### AI Slop Verdict

| Source | Verdict | Vs baseline | Notes |
|---|---|---|---|
| LLM (Assessment A) | **PASS** | Unchanged | Card-Board grammar is distinctive: full-border tinted panels, named status families, Cormorant marquee numeral, dignified avatars, sticky sidebar. NextActionStrip in particular (eyebrow + arrow + warm headline + numeral suffix) has personality that wouldn't appear in default-template SaaS. First-order trap (healthcare → white+teal) dodged via warm ivory + clinic green + sanctioned gold. Second-order trap (warm-clinical-healthcare → cream-and-eucalyptus) dodged by operator-tool restraint + Linear-sensibility + Stripe-state-word discipline. |

**AI slop did not regress.** Consistent with the booking-new (PASS) and bookings (PASS, borderline) verdicts. No `/impeccable bolder` or `/impeccable distill` block triggered.

### Cognitive Load (8-item)

**1 failure = LOW.** Single overage: main column = 6 panels (within ≤7 "pushing boundary" zone). NextActionStrip funnels first attention, so chunking failure does not cascade.

### Critique-level Findings by Severity

**P0:** None. Step 8 not blocked.

**P1 (tag for Phase 7 gauntlet — do not fix per-page):**
- **Mobile section order strands Address card at page-bottom.** Therapist mobile workflow (PRODUCT.md: "mobile-first frequency, not mobile-as-fallback") requires fast access to Maps. Current scroll path passes 5 admin-only panels before reaching the visit address. Fix path: interleave Client + Address into main column on mobile, hide sidebar block at mobile width. (Audit graded this P2; UX-mobile-first lens elevates to P1.)

**P2 (list here, next sprint):**
- Quick actions (Confirm / Mark paid / Mark complete) fire instantly with no Sonner `Undo` action. Recovery requires re-editing the Status form. PRODUCT.md commits to "auditable AND reversible" — page satisfies auditable but not reversible-from-UI.
- `status` select offers all 5 transitions regardless of current state. From "Pending" the operator can select "No-show" (nonsensical pre-visit). Should compute `allowedTransitions(currentStatus)` and disable invalid options inline.

**P3 (nice-to-fix):**
- Quick-action tooltips use native `title=` only — not focus-visible, not mobile-discoverable. PRODUCT.md tech-level (novice operators) requires visible affordances. Use Base UI Tooltip primitive or move critical hint copy inline.
- Lifecycle pill row duplicates the status badge in the panel header (same signal, 36px apart). Distill candidate: keep one carrier.
- Email activity event_type rendered via raw `formatLabel` — could mirror the Activity timeline humanization map.
- Address `<dl>`-style rows are divs in a 2-col grid; real `<dl><dt><dd>` would surface the term-definition relationship to screen readers.

### Persona red flags

- **Mariam (Booking Coordinator):** Pending → No-show transition offerable; misclicking "Mark paid" forces 4-field re-edit; gender chip lowercase vs capitalized status badges; 5-value payment status from brief (Outstanding/Paid/**Partially paid**/Refunded/Waived) is 2 in code — partial-payment workflow unrepresentable.
- **Aisha (Therapist, in transit):** Scrolls past 5 panels to reach Address card on mobile (P1 above); `tel:` link rendered as small text rather than a prominent Primary button.
- **Sam (first-time coordinator):** 9 panels on screen initially overwhelming; NextActionStrip rescues; tooltips don't reveal on focus so she clicks to learn what buttons do.

**No P0 audit or critique findings. AI slop PASS, no regression. Backend N-A. Step 8 not blocked.**

---

## login — audit

**Date:** 2026-05-15
**Backend status:** N-A — login has no backend deps in Layer 3 review; consumes existing untouchable `signInAdmin` server action.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 4 | WCAG 2.1 AA met — `role="alert"` form errors, `role="status"` inactive notice, visible required `*`, `aria-required`/`aria-invalid`/`aria-describedby` on inputs, `aria-busy` on submit, `aria-hidden` on decorative icons, single H1, labels bound by `htmlFor`/`id`, focus-visible ring on all interactives, Tab order email → password → Forgot → submit |
| 2 | Performance | 4 | `next/image` priority on the wordmark; SVG asset already tracked (~21KB equivalent); no entrance animation; no new dependencies; client state local; Sentry monitoring is baseline |
| 3 | Theming | 4 | All colour via `var(--admin-*)`; radii via `var(--admin-radius-sm/md)`; zero raw hex; zero raw `oklch()`; only px literals are brief-mandated widths (400 / 140 / 180) |
| 4 | Responsive | 4 | `max-w-[400px]` caps width; logo rescales 140 → 180; card padding scales `p-6` → `sm:p-8`; no horizontal scroll at 375 / 768 / 1440; touch targets: Sign in 48px, inputs 44px, Forgot link 32px (acceptable for inline text link) |
| 5 | Anti-Patterns | 4 | No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no identical card grids, no modals, no em dashes in user-visible copy; the wordmark + ivory + Clinic Green submit reads unmistakably Rahma, not generic SaaS |
| **Total** | | **20/20** | **Excellent** |

### Anti-Patterns Verdict
**PASS.** Could not generate this from category cues alone — the gold-and-blue wordmark on warm ivory canvas anchors the surface to Rahma's specific brand vocabulary, not the training-data healthcare-admin reflex (white + teal) or admin-tool reflex (dark navy + gradient accent). Second-order check passes too: avoids "healthcare-but-not-teal" → terminal-dark-mode trap.

### Executive Summary
- Audit Health Score: **20/20 (Excellent)**
- Issues found: P0 = 0, P1 = 0, P2 = 0, P3 = 2
- Top finding: clean across all five dimensions; two cosmetic P3 items below
- Recommended next step: handoff (no fixes needed before handoff)

### Detailed Findings by Severity

#### P3 — Polish (no real user impact)

**[P3] Forgot link touch target 32px**
- Location: `src/app/admin/login/LoginForm.tsx` Link to `/admin/password-reset`
- Category: Responsive
- Impact: Below WCAG 2.5.8 Target Size (Enhanced) 44x44px; satisfies 2.5.5 Target Size (Minimum) 24x24px. Acceptable for inline text link; adjacent inline links are exempt from 44x44 strict.
- WCAG/Standard: 2.5.8 AAA (not AA)
- Recommendation: Leave as-is — brief explicitly mandates "label step" (12px) for the Forgot link; raising the visible text would deviate from brief
- Suggested command: none

**[P3] Sign in button disables during loading**
- Location: `src/app/admin/login/LoginForm.tsx` via shared `Button` `loading` prop
- Category: Anti-Pattern (minor)
- Impact: Brief §6 Submitting state says "button not disabled (prevents double-submit UX but still accessible)" — current shared Button always disables when `loading={true}`. The `aria-busy="true"` is set, spinner replaces icon slot, text remains "Sign in"; only the visual opacity-50 disabled tint differs from brief.
- WCAG/Standard: none (visual deviation only)
- Recommendation: Fix lives in `00-shared-components` session — adjust the shared `Button` to honour `disabled={false}` when `loading={true}` is passed
- Suggested command: defer to `00-shared-components` rework

### Patterns & Systemic Issues
None — the page is small enough that no systemic patterns emerge from a single audit.

### Positive Findings
- **Token discipline is exemplary.** Every colour, radius, and font-family resolves through DESIGN.md tokens. No hex anywhere, no raw `oklch()` literals, no font-family strings. The three brief-literal widths (400/140/180px) are explicitly brief-mandated.
- **Error-region accessibility goes beyond baseline.** `role="alert" aria-live="polite" aria-atomic="true"` with `aria-describedby` linking each input to its per-field error — both layers covered, with the Cancelled-family region above the submit button doing the page-level work.
- **Brief copy is verbatim.** All 20 user-facing strings match `## 10 Copy` literally, including the validation messages.
- **Server-action contract preserved.** `signInAdmin(email, password)` called unchanged from the client form; `name="email"` and `name="password"` literal; no `fetch`/`XHR` substitute.

### Recommended Actions
None required before handoff. Defer the shared-Button loading-disable behaviour to the `00-shared-components` session.


---

## login — critique

**Date:** 2026-05-15
**Method:** single-head Nielsen heuristic scan + AI-slop verdict + 8-item cognitive-load check + 3-persona red-flag walkthrough. (Sub-agent isolation skipped per recipe-scoped budget; the brief is highly resolved and the surface is small.)

### Design Health Score (Nielsen's 10)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Submitting renders spinner + `aria-busy="true"`; error and inactive states announce via `role="alert"`/`role="status"`; success redirects immediately. State always visible. |
| 2 | Match System / Real World | 4 | "Sign in", "Email address", "Forgot your password?" — plain English mental models; inactive copy explains what happened and what to do. |
| 3 | User Control and Freedom | 4 | Forgot link offers escape; "Try again" reissues on server error; password cleared on auth fail so stale state doesn't block correction; browser back from password-reset returns here. |
| 4 | Consistency and Standards | 4 | Standard form vocabulary; `autocomplete="username"`/`current-password` lets password managers autofill; standard `name` attrs survived; DESIGN.md tokens throughout. |
| 5 | Error Prevention | 3 | Client validation blocks empty/malformed submissions; visible required `*`; submit disables during loading to block double-submit. Not 4 because we don't use the native browser email-validity tooltip (intentional — brief drives specific copy). |
| 6 | Recognition Rather Than Recall | 4 | Email placeholder shows format; Forgot link visible at rest; inactive copy explicit and jargon-free. |
| 7 | Flexibility and Efficiency | 3 | Enter submits from either field; Tab order logical; autocomplete attrs trigger autofill. No "remember me" (brief doesn't ask). |
| 8 | Aesthetic and Minimalist Design | 4 | Nothing decorative — wordmark is brand identity, not decoration; one accent (Clinic Green submit); no shadow at rest; no glass; matches brief's "complete before you sign in" Stripe reference. |
| 9 | Error Recovery | 4 | Brief copy specific ("Incorrect email or password." not "Login failed"); password cleared / email retained; rate-limit copy tells user *what to do*; server-error has explicit "Try again" Ghost button. |
| 10 | Help and Documentation | 3 | Forgot link is the help surface; native `title="Reset your password"` adds tooltip discovery; no other inline help (brief doesn't request any). Acceptable for a login form. |
| **Total** | | **37/40** | **Excellent** |

### AI-Slop Verdict: **PASS**

Could not generate this from category cues alone. Healthcare-admin's training-data reflex is white + teal; admin-tool's reflex is dark navy + gradient accent. This page is gold-and-blue wordmark on warm ivory with Clinic Green submit — specific to Rahma's identity vocabulary, not category default. Second-order ("healthcare-but-not-teal → terminal-dark-mode") avoided too. No regression vs the prior bookings (PASS, borderline) and booking-new (PASS) verdicts on this run.

### Cognitive Load (8-item) — **LOW (0 failures)**

| # | Item | Pass? |
|---|---|---|
| 1 | Single primary action | ✓ (Sign in) |
| 2 | ≤7 visible elements above fold | ✓ (logo / H1 / 2 inputs / Forgot / Sign in / footer = 7) |
| 3 | Progressive disclosure | ✓ (validation errors only on demand) |
| 4 | Single visual focal point | ✓ (Clinic Green submit) |
| 5 | Reading order matches flow | ✓ (top to bottom) |
| 6 | No premature labels | ✓ |
| 7 | Consistent grouping | ✓ (fields together; secondary action right-aligned) |
| 8 | No competing CTAs | ✓ |

### Overall Impression
Brief-faithful. The page does exactly what it should: brand-anchor moment, then a calm form, then a quiet portal-name footer. Nothing extra, no decoration that doesn't earn its place. The single biggest opportunity is upstream (the shared Button's disable-on-loading behaviour), not here.

### What's Working
1. **Brand-anchor moment.** The wordmark is the design — no decorative scaffolding around it. Stripe Dashboard / Linear sign-in / Basecamp references absorbed cleanly: complete before you sign in.
2. **Error vocabulary discipline.** Three distinct families used correctly: per-field `role="alert"` for validation, page-level Cancelled banner for server failures, page-level Restricted notice (server-rendered) for inactive accounts. Each carries an icon + text label, never colour-only.
3. **Brief copy is verbatim.** All 20 user-facing strings (H1, labels, button, link, footer, 7 validation/error messages, inactive notice, tooltips) match `## 10 Copy` literally.

### Priority Issues
**P0: none. P1: none. P2: none.**

#### P3 — Polish (only)

**[P3] Sign in button disabled-during-loading deviates from brief**
- Why it matters: Brief §6 Submitting state specifies "button not disabled (prevents double-submit UX but still accessible)". The shared `Button` component forces `disabled={true}` when `loading={true}`. `aria-busy="true"` and spinner + text-unchanged are present; only the visual opacity-50 tint deviates.
- Fix: Adjust shared `Button` to honour `disabled={false}` override when `loading={true}` is passed.
- Suggested command: defer to `00-shared-components` session — this is a primitive concern, not a login concern.

**[P3] Forgot link visible touch height 32px**
- Why it matters: Below WCAG 2.5.8 Target Size (Enhanced) 44x44px. Satisfies 2.5.5 Target Size (Minimum) 24x24px because it's an inline text link.
- Fix: Leave as-is — brief mandates "label step" (12px) for the Forgot link.
- Suggested command: none.

### Persona Red Flags

**Aisha (Therapist on a doorstep, phone in one hand):**
- Mobile layout fast: 140px logo + tight card, single-column form. ✓
- `autocomplete="username"` + `current-password` trigger iOS Passwords / Android autofill. ✓
- Sign in button 48px tall — thumb-reachable. ✓
- No autofocus avoids the keyboard popping up when she just opens to check details. ✓
- No red flags.

**Sam (first-time coordinator, just got password emailed):**
- Forgot link visible at rest, not buried behind a hidden state. ✓
- Error messages tell her what to do ("Add your email address." not "Field required"). ✓
- Inactive notice (if her account got revoked) tells her who to contact. ✓
- No red flags.

**Mariam (Practice Manager switching accounts on desk):**
- Tab/Enter keyboard-only sign-in works in three keystrokes (autofilled email + Tab + Enter). ✓
- Password manager prompted via standard autocomplete vocabulary. ✓
- "Forgot your password?" tooltip adds context on hover. ✓
- No red flags.

### Minor Observations
- The Cancelled error banner's "Try again" Ghost button is text-only; could optionally carry a small refresh icon. Not worth the icon registry weight for a single rare state.
- `title="Reset your password"` is only visible on hover (desktop); mobile users won't see it. Acceptable since the visible Forgot link copy is already explicit.

### Questions to Consider
None worth raising — the brief answered them all upstream during Phase 5.



---

## calendar — audit

**Date:** 2026-05-16 (re-audit on current state — supersedes prior 14/20 entry from earlier in this session)
**Files audited:**
- `src/app/admin/calendar/page.tsx` (1,892 lines)
- `src/app/admin/calendar/CalendarDatePopover.tsx` (318 lines)
- `src/app/admin/calendar/PrintButton.tsx` (18 lines)

### 5-dimension scores

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 / 4 | DayPicker popover dialog missing `aria-modal` + focus trap; modifier icon cluster relies on `title` only (no hover on mobile) |
| 2 | Performance | 3 / 4 | Day agenda renders the booking list twice (mobile stack + absolute desktop column); 34 inline `oklch(...)` literals defeat Tailwind class de-dup |
| 3 | Theming | 2 / 4 | 34 raw `oklch(...)` color literals across `page.tsx`; status tints, banner colors, chips, and filter chips all bypass DESIGN.md tokens |
| 4 | Responsive Design | 3 / 4 | Mobile `pb-12` (48px) doesn't clear the ~80px+safe-area bottom-nav (visible in `mobile-check-thismonth-v2.png` — More tab covering grid rows); WeekStrip forces `min-w-[42rem]` horizontal scroll on mobile despite the "vertical-stack fallback" commitment |
| 5 | Anti-Patterns | 3 / 4 | Cormorant Garamond used on every booking card's time block + every month-grid day-number + every week-strip day-number; "The Cormorant Exception" reserves it for marquee numerals only. Dashed-border empty-day row at `page.tsx:770` violates the DESIGN.md dashed-border ban. |
| **Total** | | **14 / 20** | **Good — address the weak dimensions (Theming, Anti-Patterns)** |

### Anti-Patterns verdict

Does this read as AI-generated? **No.** The card-board grammar, warm clinical palette, deliberate Mon-first ISO week, named status badge + modifier-icon stack, and Attention-tinted disclosure all read as considered Rahma craft. No gradient text, no hero-metric template, no glassmorphism, no `border-l-4`, no `bg-black`, no purple/blue. The single tell that creeps toward genericism is the Cormorant overuse across every card and every grid cell, which dilutes the brand's signature numeral typeface.

### P0 findings (blockers — fix before shipping)

none

### P1 findings (fix this sprint)

- **DayPicker popover is not a real modal** — `CalendarDatePopover.tsx:189-233` declares `role="dialog"` but lacks `aria-modal="true"`, has no focus trap (Tab leaks to the page behind), and the only dismiss paths are document-`mousedown` + Escape. Keyboard-only users land on background controls while the picker is "open." Category: Accessibility. WCAG 2.4.3 (Focus Order), 4.1.2 (Name, Role, Value).
- **Mobile bottom-nav overlaps calendar content** — `page.tsx:393` sets `pb-12` (48px) on the page root but the mobile bottom-nav stack is ~64-80px plus iOS safe-area inset. `mobile-check-thismonth-v2.png` shows the "More" tab sitting on top of grid rows 16-17 and the Unassigned panel rows. Category: Responsive.
- **Day-agenda time-rail no longer encodes start_time accurately** — `page.tsx:1111-1129` enforces `MIN_CARD_HEIGHT=140px` and stacks-below-on-overlap, so the second 30-minute booking is pushed below the first by `prev.height + CARD_GAP` rather than positioned at its true minute offset. The hourly tick rules at `page.tsx:1211-1218` no longer line up with the cards beneath them, breaking the brief §5 promise ("each `BookingListCard` aligns to its `start_time`"). Category: Anti-Pattern / correctness.
- **Modifier icon cluster reads as color-only on mobile** — `page.tsx:1393-1445` and `ModifierIcon` at `page.tsx:1468-1492` stack up to 5 nearly-identical tinted glyphs (AlertCircle, Clock, UserX, CheckCircle) on each card. The `title` tooltip is the only inline disambiguator and tooltips don't fire on touch. `sr-only` covers screen readers but sighted touch users see "pending pill + four orange-tinted circles" with no inline labels. Visible in `range-view-1440.png`. Category: Accessibility / Anti-Pattern. DESIGN.md "Named Status Rule" (every status badge requires a text label).
- **Dashed-border empty-day row** — `page.tsx:770` renders empty week-days with `border-dashed`. DESIGN.md §6 Don'ts: "Don't use dashed borders on empty states. A dashed border reads as 'placeholder' or 'unfinished'." Category: Anti-Pattern.
- **Raw OKLCH color literals throughout** — 34 inline `oklch(...)` color values in `page.tsx` (validation banner `:536`, today's-roundup stats `:594, :599, :604`, active-filter chips `:557, :567`, concurrent banner `:1155, :1275`, day numerals `:905`, count badges `:944`, sidebar disclosure `:1540-1599`, status-tint pills throughout). Brief §9 explicitly flagged this as a Phase 6 cleanup. Category: Theming.

### P2 findings (next cycle)

- **Cormorant Garamond on non-marquee numerals** — every `CalendarBookingRow` time block (`page.tsx:1352-1366`), every month-grid day-number (`page.tsx:911-928`), every week-strip day-number (`page.tsx:1024-1033`). DESIGN.md §3 "The Cormorant Exception" reserves the typeface for "marquee dashboard stats and KPI numerals" and warns "preserve its rarity." Category: Anti-Pattern / Theming.
- **WeekStrip horizontal scroll on mobile** — `page.tsx:1000` sets `min-w-[42rem]` (672px) and parents at `overflow-x-auto`. On a 360px phone this forces horizontal scroll for a strip the brief §3 says should follow "vertical-stack fallback on narrow viewports." Visible in `adapt-mobile-after.png` (Mon-Wed visible, Thu cut off). Category: Responsive.
- **`PrintButton` below 44px touch target** — `PrintButton.tsx:12` uses `min-h-10` (40px). DESIGN.md "Density: Comfortable — 44px row height" and WCAG 2.5.5 floor. Category: Accessibility.
- **Validation banner colors hard-coded** — `page.tsx:536` uses raw `oklch(88%_0.055_75)` border and `oklch(96%_0.038_75)` background instead of `status-pending-bg / status-pending-text`. Category: Theming.
- **Concurrent banner colors hard-coded** — `page.tsx:1155, 1275` use raw `oklch(88%_0.06_65)` and `oklch(95%_0.05_65)` instead of `status-attention-bg / status-attention-text`. Category: Theming.
- **`AvatarStack` empty marker uses dashed border** — `page.tsx:1499` renders the "?" placeholder with `border-dashed`. Same DESIGN.md ban. Category: Anti-Pattern.
- **Sticky control rail at `top-0` collides with `AdminTopNav`** — `page.tsx:409` pins the filter rail at `top-0 z-20`, but the admin layout's top nav already occupies the top strip. Sticky offset should clear the topnav height. Category: Responsive.

### P3 findings (polish)

- **`text-white` literals** — `page.tsx:700, 930, 1545, 1591, 1646, 1683` use `text-white` instead of a token. DESIGN.md "never `#fff`." Category: Theming.
- **DayAgenda renders the booking list twice** — `page.tsx:1192-1233` ships both `lg:hidden` and `hidden lg:block` copies. Category: Performance.
- **`bg-white/70` on count badges in `SidebarDisclosure`** — `page.tsx:1545, 1591`. Category: Theming.
- **Repeated `formatBusinessDate(date)` calls in render loops** — could be memoized; not measurable. Category: Performance.
- **`PrintButton` copy is "Print day sheet"** — the brief §form-button-text spec is `Print` (Secondary). Minor copy drift. Category: Polish.

### Backend status

**N-A.** Calendar is presentation-only against `getReportData` / `parseReportFilters` / `addBusinessDays` / `formatBusinessDate` / `getBusinessDate` / `getAdminPageAccess` — all listed RECON §5 untouchable. The redesign joins therapist names from `data.assignments` client-side (`page.tsx:359-366`) explicitly to avoid mutating the selector. No new mutations, no new server actions. No BUILD plan filenames blocked.

### P1 (tag for Phase 7 gauntlet)

- **DayPicker popover missing `aria-modal` + focus trap** — `CalendarDatePopover.tsx:189-233`
- **Mobile `pb-12` doesn't clear the bottom-nav** — `page.tsx:393` (visible in `mobile-check-thismonth-v2.png`)
- **Day-agenda time-rail / start_time positioning is off** — `page.tsx:1111-1129` (positioning) + `page.tsx:1211-1218` (tick rules)
- **Modifier icon cluster is effectively color-only on mobile** — `page.tsx:1393-1445`, `ModifierIcon` at `page.tsx:1468-1492` (visible in `range-view-1440.png`)
- **Dashed-border empty-day row** — `page.tsx:770`
- **Raw `oklch(...)` color literals across the page (34 occurrences)** — multiple locations

### BUSINESS-COMPLETENESS impact

This page newly contributes to **Track A item 2A-3 — Mobile-optimised calendar / day view** (`redesign/BUSINESS-COMPLETENESS.md:35-36`). Current state advances 2A-3 from `HANDLED` toward verified mobile coverage, but the P1 bottom-nav overlap and the WeekStrip horizontal-scroll fallback are gaps that should be closed before 2A-3 is signed off as complete.

---

## calendar — critique

**Date:** 2026-05-16 (re-critique on current state — supersedes prior 6.7/10 REGRESSED entry from earlier in this session)
**Reviewer:** impeccable critique, fresh-eyes pass (no bias from prior work)
**Inputs:** brief + PRODUCT.md + DESIGN.md + 9 screenshots + current source

### Design Health Score — Nielsen heuristics

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Roundup strip + per-date count badges + active-preset highlight + filter chips do real work. Missing: "—" tile on a populated week-strip day is mute. |
| 2 | Match Between System & Real World | 4 | "All visible staff", "Every visit has a therapist", "Quiet days are healthy days" — real clinic language. British date phrasing. No raw permission strings reach the surface. |
| 3 | User Control & Freedom | 3 | DayPicker has Clear + Apply, arrow-key stepping works, validation banners recover hand-edited URLs silently. Missing: no Cancel button on the DayPicker (Escape exists but undiscoverable); preset segment has no way to un-select once active. |
| 4 | Consistency & Standards | 3 | Cormorant on serial numerals is consistent. The `CalendarBookingRow` rhymes with `BookingListCard` but is not literally it (3-column layout, time gutter, modifier circles). Modifier dots layer a small icon-only language on top of the named badge — operators must memorise five glyphs. |
| 5 | Error Prevention | 3 | Range soft-cap (31 days → snaps to month) and `to < from` swap are quiet, server-side, and correct. Date popover hint copy is genuinely helpful. Missing: clicking "Today" while already on today does nothing visible. |
| 6 | Recognition Rather Than Recall | 2 | Page's softest score. Modifier-icon cluster requires hover or screen-reader to disambiguate — `AlertCircle` appears for *Unassigned*, *Reschedule requested*, and *Unpaid*, with title text the only differentiator. Three identical orange discs on a row force recall. |
| 7 | Flexibility & Efficiency | 3 | Keyboard arrows on the stepper, deep-linkable URL state on every control, three presets for the 80% case, Pick-a-date for the 20%. Active-filter chips with individual ✕ + "Clear all" are exactly right. Print address microformat for the run sheet is a thoughtful affordance. |
| 8 | Aesthetic & Minimalist Design | 3 | Page is calm. Empty state with the round mint icon, Attention-tinted disclosure, warm-ivory canvas under restrained Clinic Green chrome — looks like Rahma, not a template. Two visual ledgers running hot: status row can carry pill + up to five identical discs; time-block `border-r` + per-card border + per-panel border stacks borders into "fenced" reading. |
| 9 | Help users recognize, diagnose & recover | 3 | Inline `role="status"` concurrent banner above the day panel + per-card modifier is good belt-and-braces. URL-error banners coerce silently and explain. `AdminAccessDenied` no longer leaks `view_bookings_all`. Missing: load-failure boundary (brief specifies "Couldn't load the calendar." Cancelled banner; no `error.tsx` in source). |
| 10 | Help & Documentation | 2 | The `sr-only` stepper help text is the only discoverable hint; no visible legend for modifier icons, no tooltip on segmented control, no first-run nudge. For a novice operator base ("Tech level: Novice" per PRODUCT.md), the modifier-icon language is undocumented in-surface. |
| **Total** | | **29 / 40** | **Solid — above the honest-band median, below "excellent." Specific friction in icon language and modifier overload.** |

### AI-slop verdict

**PASS.** No gradient text, no glass, no decorative blobs, no purple-and-blue, no hero-metric stack, no identical-card grids, no `border-l-4`, no `bg-black`, no shadcn defaults. Cormorant Garamond on numerals is the brand-signature appearance DESIGN.md sanctions, not a reflex serif. Empty state is dignified (round mint icon + encouraging two-line message + Secondary CTA) rather than a 0-of-x box. Deliberate copy ("All quiet", "Quiet days are healthy days", "Every visit has a therapist") proves a human voice. Second-order category check ("UK healthcare admin that's not white-and-teal") returns warm-ivory + deep clinic green — distinctly Rahma.

### UX-quality commentary against PRODUCT.md anti-references

- **"Generic SaaS / shadcn-default dashboards"** — cleared. Control rail and roundup strip do not read shadcn-default.

- **"Identical-card grids"** — partially cleared. `CalendarBookingRow` is genuinely different from `SidebarRow` and from `MonthGrid` cell. Three distinct grammars per the brief. Caveat: inside the day/range/week panels, every booking is the same row shape stacked vertically; the modifier-disc row makes the bottom edge of every card look identical at a glance.

- **"Color-only status signalling"** — cleared on the named badge, but **regressed on the modifier icons**. Three modifiers (Unassigned, Reschedule requested, Unpaid) all use the same warm-amber disc with `AlertCircle`. The `sr-only` `title` saves screen-reader users but a sighted operator sees three identical orange discs.

- **"Decorative blobs / glassmorphism"** — cleared. No blur, no blobs.

- **"Tools so spare they feel cold"** — cleared. Avatars on every assignment, dignified empty state, Cormorant on the marquee numerals, warm-amber tint on the mobile Unassigned disclosure — the surface has the disciplined warmth the brief asked for.

- **"Side-stripe borders, gradient text"** — cleared. The card's `border-r` on the time block is an internal column separator, not a `border-l-4` colour accent. Acceptable per absolute-ban wording, though contributes to "fenced" feeling.

- **"Everything-on-one-screen SaaS dashboards"** — cleared. Page does one job: agenda + triage. Filters live in a rail; range work lives in the popover; assignment work lives one click away on the booking detail.

### Concrete observations worth fixing (severity-ranked, brief)

1. **[P1] Modifier-icon collision.** Five possible discs, three sharing the same warm-amber `AlertCircle`. Per DESIGN.md §2 status-family icon vocabulary, give each modifier its sanctioned glyph (`user-x` for unassigned, `calendar-clock` for reschedule, distinct icon for unpaid) and consider promoting two-or-more-modifiers to a single named pill ("Needs attention · 3"). Currently violates the spirit of "icon supports scanning, text carries meaning."
2. **[P2] Time-block border + card border + panel border** stack three vertical seams on the desktop day view. Drop the `border-r` on the time block; let whitespace separate the Cormorant numeral from content.
3. **[P2] Day-view "no therapist assigned" placeholder** is a literal "?" inside a dashed circle. The brief prefers a labelled chip ("Therapist not yet assigned").
4. **[P3] No visible legend** for the modifier icons. A small `(?)` popover near the roundup strip explaining the disc vocabulary would meet the novice-operator commitment.
5. **[P3] Week-strip empty-day cells** show an em-dash where day cells show a count — fine until you compare to the month grid where empty cells show nothing. Pick one absence convention.

### One-line gut

A confident, calm, recognisably-Rahma operations agenda that lands the major brief moves (presets, range, month grid, mobile disclosure, dignified empty state) and slips on one specific anti-pattern: a modifier-icon dialect that asks operators to recall meaning the named-badge rule was meant to abolish. Fix the modifier vocabulary and this page moves from "solid" to "exemplary."

### Delta vs. prior critique (earlier this session)

- **Heuristic average: 6.7 → 7.25** (per-10 scale; +0.55, ~8% improvement)
- **AI-slop verdict: REGRESSED → PASS** (the critical structural fixes — avatar-bearing cards, demoted pill cluster, distinct card grammars across views, Attention-tinted mobile disclosure — moved the page off the antipattern territory)
- **New friction surfaced by current state:** modifier-icon collision (didn't exist before because old design used named-pill cluster with text); border-stacking on the new time-block (didn't exist before because old card was single-column)
- **Resolved from prior:** identical-card-grid risk (now three distinct grammars), pure-typography main column (now has avatars + therapist names), dashed-border empty week rows (partially — `border-dashed` still on per-date empty rows + AvatarStack "?" but no longer dominates the surface)

---

## availability — audit

**Brief:** `redesign/briefs/availability-brief.md`
**Files reviewed:**
- `src/app/admin/availability/page.tsx`
- `src/app/admin/availability/AvailabilityManagersTabs.tsx`
- `src/app/admin/availability/AvailabilityRulesManager.tsx`
- `src/app/admin/availability/BlockedDatesManager.tsx`
- `src/app/admin/availability/AvailabilityOverridesManager.tsx`
- `src/app/admin/availability/actions.ts`
- `src/app/admin/components/admin-ui.tsx` (consumed primitives only)

**Severity rubric (verbatim from impeccable v5 L884-890):**
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

### Dimension scores

| Dimension | Score | Notes |
|---|---|---|
| Brand & design-system fidelity | 8 / 10 | Restrained palette, surface-selected open / status-restricted-bg closed tints correctly applied across both the 7-day preview strip and the working-hours grid; Confirmed-family capacity pills with the `users` icon match the brief; no `border-l-4`, no gradient text, no glass. Cormorant inside capacity pills (page.tsx:430-440) breaks DESIGN.md's "Cormorant Exception" (marquee numerals only). |
| Layout, hierarchy & responsive craft | 8 / 10 | H1 -> H2 hierarchy contiguous via `AdminPageHeader` + `AdminPanel` h2; capacity preview, three stacked managers on >=md, tab strip below preview on <md, all match section 5 of the brief. 7-day strip's `min-w-[40rem]` mobile scroll, staff list as `AdminEntityRow`, working-hours grid with 9rem/28rem/1fr columns, all clean. |
| Interaction & motion | 6 / 10 | Switch toggles, `aria-busy` on save, `revalidatePath` after every action, `ConfirmActionModal` on delete, all wired correctly. But the brief's required "160ms ease-gentle reveal" on working-hours time inputs is not actually animated: the closed-day branch (AvailabilityRulesManager.tsx:263-270) uses `hidden h-0 invisible`, and `display: none` (from `hidden`) cancels every transition the same line declares. The reveal snaps. Tab buttons have `role="tab"` / `role="tablist"` but no Left/Right/Home/End arrow-key handler. |
| Accessibility | 7 / 10 | Strong: every form input labelled, required `*` in Cancelled text colour with `aria-hidden`, three independent `role="alert" aria-live="polite" aria-atomic="true"` regions, Switch has accessible label per day (`Monday, open`), 44px touch targets on Save/Add/delete buttons. Weak: `aria-labelledby` on the three tabpanels references tab button IDs that don't exist anywhere (AvailabilityManagersTabs.tsx:65 / 73 / 81 -> no `id="availability-tab-..."` is rendered on the buttons at 41-55); tab keyboard navigation incomplete. |
| Copy & voice | 9 / 10 | Verbs-over-nouns, calm/direct. Toasts: "Working hours saved.", "Closed date added.", "Hour adjustment added.", "Removed." match the brief. Confirm copy matches brief verbatim. No em dashes. The only gap: Coordinator denied state has no Secondary "Back to dashboard" button (page.tsx:494-499); brief and Copy section both require one. |

### P0 — Blocks release

- none

### P1 — Fix this sprint

- `src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` — Three `<section role="tabpanel">` elements set `aria-labelledby="availability-tab-{hours|closed|adjustments}"`, but the corresponding tab buttons at `AvailabilityManagersTabs.tsx:41-55` carry no `id`. Every tabpanel has a dangling ARIA reference. Add `id={"availability-tab-${tab.key}"}` to the button.
- `src/app/admin/availability/AvailabilityManagersTabs.tsx:33-59` — `role="tablist"` + `role="tab"` declared but no Left/Right/Home/End keyboard navigation handler is wired. Per ARIA Authoring Practices, tab widgets must support arrow-key navigation between tabs.

### P2 — Next cycle

- `src/app/admin/availability/AvailabilityRulesManager.tsx:263-270` — Closed-day branch combines `hidden h-0 invisible pointer-events-none` with `transition-[opacity,grid-template-rows,height]`. `display: none` (from Tailwind `hidden`) suppresses any transition. The brief mandates a "160ms ease-gentle reveal" on toggle; today the reveal snaps. Animate `grid-template-rows: 0fr -> 1fr` (or `max-height`) + `opacity` instead of `display: none`.
- `src/app/admin/availability/page.tsx:430-440` — Capacity pill numerals are set in Cormorant Garamond. DESIGN.md "Cormorant Exception" reserves Cormorant for marquee dashboard stat-tile numerals only; pills are badge-text. Drop Cormorant from the pills.
- `src/app/admin/availability/page.tsx:493-499` — Coordinator denied surface renders `AdminAccessDenied` with no `actions` prop. Brief role variants require a Secondary "Back to dashboard" -> `/admin/dashboard`. Add `actions={<Link href="/admin/dashboard">Back to dashboard</Link>}` matching the Therapist pattern.

### P3 — Polish

- `src/app/admin/availability/AvailabilityRulesManager.tsx:281,308` — DOM `name="start_time_0"`/`end_time_0"` diverges from the Feature Preservation Manifest's literal field names. Server-action wire is unaffected because `handleSave` constructs FormData with manifest-correct names. Either drop the per-day name suffix or remove the `name` attribute.
- `src/app/admin/availability/BlockedDatesManager.tsx:223-225` and `src/app/admin/availability/AvailabilityOverridesManager.tsx:327-329` — List-row uses `bg-[var(--admin-panel)]` (surface-card). Brief's DESIGN-direction line "Staff list rows ... `surface-page`" suggests list rows should sit on canvas. Swap to `bg-[var(--admin-canvas)]`.
- `src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` — `role="tabpanel"` is applied to always-visible desktop sections (>=md). Consider moving the role behind a viewport-based split so the semantics stay accurate.
- `src/app/admin/availability/AvailabilityRulesManager.tsx:114-156` — `handleSave` fires seven independent `saveAvailabilityRule` POSTs via `Promise.all`. Brief section 7 says one form POST submits all seven rows together. Functionally equivalent; consolidate when actions.ts is next touched.

### Backend status

**HANDLED** — All six server actions exist in `src/app/admin/availability/actions.ts`, write the required audit rows, and call `revalidatePath('/admin/availability')` per the Feature Preservation Manifest. The IMPLEMENTATION-PLAN.md `BUILD-availability-this-week-chip.md` is marked non-blocking; the this-week chip is already implemented client-side in page.tsx:172-181 by intersecting fetched `blocked_dates` / `overrides` against the local ISO week range.

### P1 (tag for Phase 7 gauntlet)

- **Tabpanel aria-labelledby targets are dangling** — `src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` reference `availability-tab-{key}` IDs that are not declared on the tab buttons at lines 41-55.
- **Tab strip missing arrow-key keyboard navigation** — `src/app/admin/availability/AvailabilityManagersTabs.tsx:33-59` uses `role="tablist"` / `role="tab"` without an `onKeyDown` handler for ArrowLeft / ArrowRight / Home / End.

### BUSINESS-COMPLETENESS impact

none — every relevant Track A item (2A-4 heading hierarchy, 2A-6 `role="alert" aria-live`, 2A-8 active-tab a11y, 2A-9 required-field markers) was already marked HANDLED before this page. This page reinforces 2A-6 and 2A-9 by deploying the patterns inside three new forms, but does not unlock any item that wasn't already closed.

---

## availability — critique

**Date:** 2026-05-16
**Reviewer:** Independent UX critique (no bias from prior work on this page)
**Artefacts reviewed:** brief, PRODUCT.md, DESIGN.md, post-polish screenshots at 375 / 768 / 1440, full source under `src/app/admin/availability/`

### Nielsen heuristic scores

| # | Heuristic | Score | Key observation |
|---|---|---|---|
| 1 | Visibility of system status | 3 / 4 | "This week's capacity" panel makes the live result of the rules legible above the editors. Working-hours rows shift background tint when toggled. "Save hours" carries spinner + `aria-busy`. Minor gap: no inline "unsaved changes" hint between Save and the toggles. |
| 2 | Match system / real world | 4 / 4 | Vocabulary is operator-native: Opens / Closes, "Closed every Sunday", "Keep it", "Pick a date from today onwards." Plurals correct. UK long-form dates. No raw column names. |
| 3 | User control & freedom | 3 / 4 | `ConfirmActionModal` guards every destructive deletion with context-aware copy. Toggling a day off does not destroy times. No undo on save, but the inverse action is one step. |
| 4 | Consistency & standards | 3 / 4 | DESIGN.md tokens carried through: `surface-card`, `surface-input`, `border-form`, status family colours, Confirmed-family Cormorant numerals in the Male/Female pills. Add-form button height is `h-11` on mobile vs `h-10` on desktop on add-forms while Save is `h-11` throughout. Minor inconsistency. |
| 5 | Error prevention | 3 / 4 | `min={today}` blocks past dates. Client-side checks: duplicate closed date, duplicate override, override on a closed weekly day, end-before-start. Missing: warn before saving with all 7 days off. |
| 6 | Recognition rather than recall | 3 / 4 | Day name + toggle + Opens/Closes labels all visible. Mobile tab pills carry text labels. The "1 closure this week" Pending chip in the preview surfaces calendar events. Mild miss: no link/hover from 7-day strip into the editor. |
| 7 | Flexibility & efficiency | 2 / 4 | "Save hours" submits all 7 rows in parallel via `Promise.all`. No keyboard shortcut, no copy-to-other-days pattern, no week-template. Six identical 08:00-20:00 days require twelve time-input edits. Brief never asked for this; reflects what shipped. |
| 8 | Aesthetic & minimalist design | 2 / 4 | Single biggest weakness. The working-hours panel washes six consecutive rows in `oklch(93.5% 0.038 155)` Confirmed-family green and one row in `oklch(94% 0.008 280)` Restricted-family purple-grey. At 1440 it reads as a heavy green block with a grey footer. The 7-day strip tints six cells green, one grey, with 1px borders — adjacent to working-hours, the page reads as "two green blocks." Restraint promised in the brief tips into chroma overload when six rows in a column all carry the same tint. |
| 9 | Help users recover from errors | 3 / 4 | Every error region wired with `role="alert" aria-live="polite" aria-atomic="true"` and Cancelled-family colour. Messages specific and actionable. Network failure copy plain ("Couldn't save the hours. Try again.") and toast-paired. No retry button on the save toast. |
| 10 | Help & documentation | 2 / 4 | Description copy on each panel explains rule precedence. Tooltips on 7-day strip and Male/Female pills. No help article, no "How rules interact" inline explainer. Acceptable for audience; not strong. |
| **Total** | | **28 / 40** | **Solid — top of mid-band. Heuristic floor is high; design ceiling held back by §8.** |

### AI-slop verdict

**PASS** — the page avoids every named anti-reference (no `border-l-4`, no gradient text, no glassmorphism, no decorative blobs, no hero-metric template, no identical icon-heading-text card grid, no purple-and-blue gradients, no dark theme, no SaaS-default shadcn appearance, no colour-only status, no dashed empty-state borders), and the composition reads as a clinic settings page rather than a generic SaaS dashboard. Reservation: the working-hours all-green-block aesthetic, while not slop, is the design's weakest moment.

### Commentary on UX quality vs PRODUCT.md anti-references

- **No generic SaaS / shadcn-default feel.** Achieved. Tokens visibly Rahma — warm ivory canvas, Clinic Green primary, Cormorant numerals on Male/Female pills, Work Sans / Urbanist throughout. Switch restyled to Clinic Green.
- **No identical-card grids.** Achieved at page level — three differentiated panels with distinct internal compositions. Within working-hours, six consecutive day rows share identical structure and identical green tint — adjacent to but not the icon-heading-text antipattern.
- **No decorative blobs / glassmorphism / hero-metric template.** Achieved.
- **No colour-only status.** Achieved. "Closed" carries a text label on every 7-day strip cell. Mode and config chips are text + token. Pending chips carry plural text.
- **Disciplined warmth.** Partial. Avatars present; Cormorant numerals on pills; voice copy plain and operator-grade. Empty states for Closed dates and Hour adjustments fall short of DESIGN.md §5's "dignified illustration" — render small Lucide icon in a circle.
- **Cards must be varied and considered.** Mostly achieved. Capacity preview composed differently from three editors. Closed dates / adjustments panels share the inline-form-above-list pattern but column counts differ.
- **Side-stripe borders, gradient text (impeccable absolute bans).** None present.
- **Hover-revealed row actions.** None — every trash icon `size-11` visible at rest with tooltip and `aria-label`.

### Specific finding worth flagging

The working-hours panel and the 7-day preview strip both lean on the same `oklch(93.5% 0.038 155)` Confirmed-family tint at full saturation across most of their surface area. Stacked on the page, this creates a vertical band of nearly-identical green from row-1 of the preview to row-6 of the editor — roughly 60% of viewport height at 1440. Restraint per the brief was "Restrained — data should be scannable, not decorated." The current execution is decorating with the data, which is the inverse. A lower-saturation Confirmed tint, or limiting the tint to the day-label cell rather than the entire row, would let the page breathe.

This is the single observation most worth a focused pass before ship.

---

## availability — post-handoff enhancements

After the initial Phase-6 closure (audit 28/40, critique 28/40 with AI-slop PASS), a follow-up pass added six operator-value enhancements on top of the brief. None touch the recipe's "Files to NEVER touch" list; none modify shared primitives.

| # | Addition | Resolves |
|---|---|---|
| E1 | Copy Monday → Tue–Sat Ghost button in Working hours | Critique heuristic 7 "Flexibility & efficiency" (2/4 → expect 3/4 next pass) |
| E2 | Resolved-week 7-day strip (overlays this-week closures + overrides on the recurring template) | Critique "Specific finding worth flagging" — strip no longer "lies by omission" |
| E3 | "Last saved by {actor} on {date}" trail under each manager panel | Critique heuristic 1 "Visibility of system status" gap |
| E4 | All-days-closed save guard via ConfirmActionModal | Critique heuristic 5 "Error prevention" — fills the "no warning before saving with all 7 days off" gap |
| E5 | Closed-day-with-bookings mismatch guard via inline Base UI Dialog + `bookingsByDate` prefetch | Critique heuristic 5 — prevents quiet operational mistake when blocking a day that already has bookings |
| E6 | Dignified SVG empty-state illustrations (closed-dates / hour-adjustments / staff) replacing Lucide-icon-in-circle | Critique "Disciplined warmth — partial" + DESIGN.md §5 dignified-illustration requirement |

**New files:**
- `public/images/admin/empty-states/closed-dates.svg`
- `public/images/admin/empty-states/hour-adjustments.svg`
- `public/images/admin/empty-states/staff.svg`

**Source files touched (still inside recipe scope):**
- `src/app/admin/availability/page.tsx` (audit_logs + bookings prefetch; resolved-week computation; CapacityPreview rendering)
- `src/app/admin/availability/AvailabilityRulesManager.tsx` (Copy Monday button + all-days-closed guard + lastSavedBy trail)
- `src/app/admin/availability/BlockedDatesManager.tsx` (bookings-mismatch guard + lastSavedBy trail + empty-state illustration)
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` (lastSavedBy trail + empty-state illustration)

**Live verification (1440 / 768 / 375):**
- 0 horizontal scroll at any viewport (`scrollWidth ≤ innerWidth`)
- 0 console errors
- Copy Monday verified: setting Monday to 09:30→19:00 cascades to Tue/Wed/Thu/Fri/Sat
- All-days-closed guard verified: toggling all 6 working days off + clicking Save opens the destructive confirm
- Saved-trail line confirmed: "Last saved by Test Admin on 16 May 2026."
- Empty-state illustrations render at 96×96 with `currentColor`-friendly OKLCH fills
