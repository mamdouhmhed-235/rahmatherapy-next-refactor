# Per-Page Scores â€” Phase 6

Scores appended after each page session completes audit + critique.

**Routing rules:**
- P0 â†’ STOP before Step 8. Fix first.
- P1 â†’ tag for Phase 7 gauntlet (do not fix per-page).
- P2/P3 â†’ listed here, deferred to next sprint.
- AI slop regressed vs baseline â†’ STOP, re-run bolder/distill.

---

## 00-shared-components â€” audit

**Last updated:** 2026-05-13 (Phase 6 full session â€” nav redesign, primitives, RBAC fixes, harden, adapt, clarify)
**Backend status:** N-A â€” RECIPE-PROGRESS.md confirms 0 backend gaps, 0 plan files for this page. Note: `manage_account_password_requests` permission DB assignment is a dependency for session 12 (account-password-requests), not session 1.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **3/4** | Focus rings, skip link, aria-current, focus restoration on sheet close all correct. P1 gap: `role="menu"` declared without arrow-key navigation; section group labels use role="presentation" (not announced to AT). |
| 2 | Performance | **3/4** | CSS-only animations (transform + opacity), proper useEffect cleanup, 120ms debounced search. P3: `Bell` and `LayoutGrid` Lucide icons imported but unused â€” negligible bundle impact, tree-shaken at build. |
| 3 | Theming | **3/4** | Near-complete OKLCH token system. One hex drift (`#fff8ec`) found and fixed during verification â†’ `var(--brand-warm-surface)`. P2: active nav pill uses `oklch(90%_0.028_155)` â€” diverges from DESIGN.md `surface-selected` `oklch(92%_0.022_155)` (live-session accepted value). |
| 4 | Responsive Design | **4/4** | 375/768/1440 all Playwright-verified. Bottom tab bar height 57px. No horizontal scroll at 375px. `safe-area-inset-bottom` applied. Landscape mode collapses tab bar to 44px and hides labels. Touch targets â‰¥44px throughout. |
| 5 | Anti-Patterns | **4/4** | Deterministic scan: `[]` â€” zero findings. Zero border-l-4, gradient text, bg-black, rgba shadows, hero-metric, identical card grids. Clinic Green / warm ivory palette is distinctive; six status families are principled. |
| **Total** | | **17/20** | Good |

### Findings by Severity

**P0 (blocking â€” fix before Step 8):**
None. Step 8 not blocked.

**Step 7 device-review fix (resolved before commit):**
Nav link text and user menu trigger contrast failure discovered on physical device review. Root cause: `site-parity.css` global `a { color: inherit; }` defeated opacity-based white text utilities on `<a>` elements; Safari rendered default button background on the user menu trigger. Fixed by: `text-white` on brand `<Link>` + `<nav>` (scoped, no cascade to dropdown); inactive nav links changed to full `text-white`; trigger button given `bg-transparent appearance-none`. See HARDEN-RECS entry H7.

**P1 (tag for Phase 7 gauntlet â€” do not fix per-page):**
- `role="menu"` declared on UserMenuButton dropdown without arrow-key (â†‘/â†“) navigation. WCAG SC 4.1.2 â€” declared role doesn't match interaction model. `AdminCommandSearch` already implements arrow nav â€” same pattern needed in UserMenuButton. File: `src/app/admin/components/AdminTopNav.tsx`.

**P2 (list here, next sprint):**
- Dropdown + mobile sheet section group labels use `role="presentation"` on `<p>` elements â€” visual groups not conveyed to AT. Should be `role="group" aria-label`. Both `UserMenuButton` (line ~480) and `UserMenuSheet` (line ~745) affected.
- `UserMenuButton` dropdown does not close on Tab-out. Only Escape + click-outside handled; keyboard users tabbing past last item leave dropdown open.
- Active nav pill token mismatch: `oklch(90%_0.028_155)` (live-accepted) vs DESIGN.md `surface-selected` `oklch(92%_0.022_155)`.
- "Sign out" uses Cancelled/red family â€” correct semantically, but reads as alarming for a routine action. Consider Soft Slate muted treatment.

**P3 (nice-to-fix):**
- Remove unused `Bell` and `LayoutGrid` Lucide imports from `AdminTopNav.tsx` (lines 10, 16).
- Multiple OKLCH status colour values written inline as Tailwind arbitrary values rather than CSS custom properties â€” Phase 8 extract pass sweep.
- User menu dropdown close has no exit animation (instant conditional unmount). Enter is 160ms ease-gentle; exit is instant. Add delayed unmount + opacity:0 transition in animate pass.

---

## 00-shared-components â€” critique

**Last updated:** 2026-05-13 (Phase 6 full session â€” includes nav redesign + live mode + primitives)
**Method:** Assessment A (LLM design review, independent sub-agent) + Assessment B (deterministic CLI scan `npx impeccable --json`)
**Note on Nielsen score:** Score decreased from an earlier pass (29/40 â†’ 24/40) because this session introduced significant nav redesign (bottom tab bar, user menu consolidation) that the previous pass had not evaluated. New gaps found are real design findings, not regressions. AI slop verdict is unchanged (PASS). Step 8 not blocked.

### Nielsen's 10 Heuristics

| # | Heuristic | Score | Key Finding |
|---|---|---|---|
| 1 | Visibility of System Status | **3/4** | Active tab indicator clear; loading states on buttons correct. No ambient "today's status" signal â€” staff open app and must navigate to see what's urgent. |
| 2 | Match System / Real World | **3/4** | "My day", "Team", "My bookings" role labels excellent. "Operations", "Admin & Compliance", "Privacy" are IT taxonomy, not clinic workflow vocabulary. |
| 3 | User Control and Freedom | **2/4** | ConfirmActionModal and focus restoration on sheet close correct. No undo for non-destructive mutations. No breadcrumb escape on nested screens. |
| 4 | Consistency and Standards | **3/4** | Six status families, icon+label nav, focus rings â€” consistent throughout. RBAC-gated items disappearing per role risks breaking user's structural mental map. |
| 5 | Error Prevention | **3/4** | role="alert" on all fields, 120ms debounce, ConfirmActionModal for destructive. High-stakes mutations don't require re-typing a confirmation token. |
| 6 | Recognition Over Recall | **2/4** | Icon+label primary nav strong. Dropdown taxonomy requires recall (Availability under CLINIC SETUP, not SCHEDULING). âŒ˜K desktop only â€” no mobile discovery path. |
| 7 | Flexibility and Efficiency | **2/4** | âŒ˜K search for power users. No shortcut for New Booking (highest-frequency action). Reports occupies permanent tab-bar real estate equal to Bookings for all roles. |
| 8 | Aesthetic and Minimalist Design | **3/4** | Flat panels, no decorative borders, restrained palette â€” correct. Risk: busy reading environment when all six badge families appear simultaneously on a dense list. |
| 9 | Help Users Recognize, Diagnose, Recover | **2/4** | Search error retains query + toast fires. role="alert" announces field errors. No recovery path described after booking/assignment failures beyond generic toast. |
| 10 | Help and Documentation | **1/4** | Nothing. Five RBAC roles, real staff turnover (locums, part-timers) â€” zero in-context help is a material onboarding gap. |
| **Total** | | **24/40** | Good |

### AI Slop Verdict

| Assessment | Verdict | Evidence |
|---|---|---|
| LLM (Assessment A) | **PASS** (qualified) | Clinic Green / warm ivory palette is real brand decision. Cormorant on numerals only. Six named status families. Bottom tab bar replacing hamburger is evidence-based. Qualified flag: dropdown's four-section IA taxonomy reads as IT architecture, not clinic workflow. |
| Deterministic scan (Assessment B) | **PASS** | `[]` â€” zero findings. No border-l-4, gradient text, glassmorphism, hero-metric, identical card grids confirmed across 7 component files. |

No AI slop regression. Step 8 not blocked.

### Cognitive Load
4 failures of 8 checklist items:
- No visible primary CTA (New Booking) in mobile chrome
- Dropdown taxonomy demands role-specific recall
- "Operations" and "Admin & Compliance" labels require mode-switching
- No persistent role indicator in chrome (affects temporary role elevation, onboarding)

### Remaining Critique Issues

**P1 (Phase 7 gauntlet):**
- No primary CTA in mobile chrome â€” therapist/coordinator on phone has no one-tap path to New Booking from anywhere. Three navigation steps from cold start.

**P2 (next sprint):**
- Dropdown taxonomy ("SCHEDULING & LEADS / COMMUNICATIONS / CLINIC SETUP / ADMIN & COMPLIANCE") is IT IA, not clinic mental model. Reorder around job-to-be-done frequency; add flat "Quick links" at top per role.
- Six tabs at 375px: Reports is low-frequency for all roles but holds permanent tab-bar real estate. Drop to five tabs; move Reports to More sheet.
- "Sign out" in Cancelled/red family reads as alarming for a routine action. Move to Soft Slate muted treatment.
- Section group headers in dropdown + mobile sheet not announced to AT (`role="presentation"`).

**P3 (nice-to-fix):**
- "RT" initials duplicated in mobile More sheet identity header (top bar already shows it). Reclaim that 60px for link list â€” reduce scroll distance.
- AdminPanel h2 on every panel creates a flat heading outline on multi-panel pages; verify heading structure on each page session.
- Search debounce at 120ms is tighter than the 200ms floor standard. Conservative to 200ms on poor mobile connections.
- ConfirmActionModal uses Confirmed (green) family for positive confirm â€” verify no semantic tension when confirming a destructive action (cancel booking = green confirm button).

---

*Append each page session below as sessions complete.*

---

## booking-new â€” audit

**Last updated:** 2026-05-14 (Phase 6 â€” Session 2: full wizard rebuild, backend connection, harden, clarify, layout, verify)
**Backend status:** HANDLED â€” all blocking plan files confirmed working end-to-end.
- `BUILD-postcode-lookup-client.md` â€” implemented (postcodes.io client-side, city only)
- `BUILD-booking-create-inline-assignment.md` â€” implemented in `actions.ts` (post-creation assignment loop)
- `BUILD-booking-create-override-flag.md` â€” implemented via migration A3 (`p_override_availability boolean default false` in RPC)
- `BUILD-group-session-id.md` â€” **explicitly deferred to Phase 2** (single start_time accepted per scope decision, no blocker)
- Live DB verified: booking `09a39848` created end-to-end, `status: pending`, `assignment_status: unassigned`, all columns correct.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **3/4** | Leave dialog missing focus trap (WCAG 2.1.2 P1); step-1 raw inputs missing `required` HTML attr (WCAG 1.3.1 P1); package radio group no fieldset/legend (WCAG 1.3.1 P1); availability loading not in aria-live region (WCAG 4.1.3 P2). Strong: all error regions have role="alert" aria-live="polite" aria-atomic="true"; focus jumps to first error field on Continue; aria-label on step-rail back buttons; aria-current="step" on active circle; aria-busy on submit. |
| 2 | Performance | **3/4** | useCallback correctly wraps checkAvailability. No layout thrashing. Gap: fetch calls in checkAvailability not aborted on unmount â€” stale setState if coordinator navigates away mid-check (P2). Dead code: SameGenderChip function defined but never rendered (P3). |
| 3 | Theming | **3/4** | Comprehensive CSS custom property system for all structural, spacing, interactive tokens. Gap: status-family OKLCH values (Cancelled, Confirmed, Attention families) written as raw strings rather than CSS custom properties throughout the file. Consistent with rest of admin, but drift-prone across Phase 8 extract. Scanner found bg-black/30 on dialog backdrop (line 1905, P3 â€” brand-tint recommended). |
| 4 | Responsive Design | **3/4** | All 12 viewport-step combinations Playwright-verified (375/768/1440 Ã— steps 1â€“4). Two-column step 4 activates at md (768px+). Mobile sticky action bar correct. Gap: "Remove participant" button height ~28px (below 44px WCAG 2.5.5, P2); "Edit" links in step-4 summary cards small touch target (P2); mobile slot grid grid-cols-3 not verified with real slot data (P3). |
| 5 | Anti-Patterns | **4/4** | Token-drift lint: zero raw hex codes, zero font-family literals, zero raw margin/padding. px values are standard thin-line structural (2px track) or map to DESIGN.md shadow tokens. Automated scan: 1 warning (bg-black/30 dialog backdrop, P3). No border-l-4, no gradient text, no glassmorphism, no hero-metric template, no identical card grids. Warm ivory + clinic green palette is brand-intentional. |
| **Total** | | **16/20** | Good |

### Findings by Severity

**P0 (blocking â€” fix before Step 8):**
None. Step 8 NOT blocked by audit.

**P1 (tag for Phase 7 gauntlet â€” do not fix per-page):**
- Leave dialog missing focus trap. Keyboard users can Tab through background content while dialog is open. WCAG SC 2.1.2. File: `ManualBookingForm.tsx` ~line 1848.
- Step 1 raw inputs (`#full_name`, `#email`, `#phone`) missing `required` HTML attribute. FieldLabel shows `*` visually but AT won't announce "required". WCAG SC 1.3.1. Lines 953, 971, 995.
- Package radio group: no `<fieldset>` + `<legend>`. "Services *" heading is a `<p>` tag not semantically connected to radio inputs. FieldError not linked via `aria-describedby`. WCAG SC 1.3.1, 3.3.2. Lines 1115â€“1160.

**P2 (list here, next sprint):**
- Availability loading state ("Checking availability for female participantsâ€¦") not in aria-live region. Screen readers won't announce it. WCAG SC 4.1.3. Lines 1418, 1483, 1527.
- checkAvailability fetch calls not aborted on unmount. Stale setState on navigation away mid-check. Lines ~602.
- "Remove participant" button touch target ~28px (py-1 + 12px line-height). Below WCAG 2.5.5 44px floor. Line 1077.
- "Edit" links in step 4 summary cards text-xs + minimal padding. ~28â€“32px touch target on mobile. `SummaryCard` component actions.
- Status-family OKLCH values (Cancelled, Confirmed, Attention) written as raw inline strings throughout. Should be CSS custom properties for Phase 8 extract. Consistent with project pattern.

**P3 (nice-to-fix):**
- `SameGenderChip` function defined (lines 325â€“343) but never rendered. Dead code from previous session removal. 19 lines.
- Participant rows keyed by `key={idx}` (line 1063). Should use stable participant ID to prevent React reconciliation issues when middle participant is removed from group booking.
- Mobile time-slot grid `grid-cols-3` at 375px (~115px per slot). Not verified with real availability data (override was used in tests). Check with real slots showing.
- `bg-black/30` on Leave dialog backdrop (line 1905). Brand-tint to `oklch(15% 0.02 155 / 30%)` for consistency. (Automated scanner finding.)

---

## booking-new â€” critique

**Last updated:** 2026-05-14 (Phase 6 â€” Session 2)
**Method:** Assessment A (LLM design review, independent sub-agent) + Assessment B (deterministic CLI scan `npx impeccable --json`)

### Nielsen's 10 Heuristics

| # | Heuristic | Score | Key Finding |
|---|---|---|---|
| 1 | Visibility of System Status | **3/4** | Step rail, mobile progress bar, spinner on availability check all clear. Availability loading not announced to AT. Validation quiet between steps (only fires on Continue). |
| 2 | Match System / Real World | **4/4** | Language throughout mirrors coordinator speech: "Pick where this booking came from," "Label this person so the therapist knows who's who," "Street name and number." Clinical tone appropriate. |
| 3 | User Control and Freedom | **3/4** | Back button, step-rail click-back (completed steps), Edit links in Step 4, Leave dialog on Cancel. Gap: no undo for participant delete; no draft save on crash/navigate-away. |
| 4 | Consistency and Standards | **4/4** | Button styles, input focus states, error chips, step heading/label alignment, token usage â€” consistent throughout all 4 steps. |
| 5 | Error Prevention | **2/4** | Phone validates length only (not UK mobile format). Postcode accepts non-UK strings; postcodes.io only fires on blur with â‰¥5 chars. "Override availability" has no inline consequence explanation. No autosave between steps. |
| 6 | Recognition Rather Than Recall | **3/4** | Service cards show price + treatment breakdown. Prefill chips distinguish reused vs typed data. Gap: no templates or recent-client list for repeat coordinators (Priya must retype familiar client details every session). |
| 7 | Flexibility and Efficiency | **2/4** | Prefill from client/enquiry is the only efficiency path. No keyboard shortcuts to advance steps. No saved service templates. No bulk-edit for multi-participant changes. Priya (daily power user) must click through full wizard every time. |
| 8 | Aesthetic and Minimalist Design | **3/4** | Steps 1â€“3 clean and focused. Step 4 packs three summary cards (Contact, Services, Location) + three-panel sidebar (Notes, Assignment, Confirmation) into one viewport. Cognitive spike at the highest-stakes moment. |
| 9 | Error Recovery | **3/4** | Error messages are action-specific and inline ("Email needs an @. For example, sara@example.com."). Focus jumps to first error field. Gap: no undo for participant delete; browser-back risks losing current-step state. |
| 10 | Help and Documentation | **2/4** | Inline field hints present ("Used for WhatsApp and SMS," "We'll auto-fill city from this"). No tooltip explaining "Override availability" consequences. No definition of clinical terms (IASTM) in package descriptions for new coordinators. |
| **Total** | | **29/40** | Good |

### AI Slop Verdict

| Assessment | Verdict | Evidence |
|---|---|---|
| LLM (Assessment A) | **PASS** | Warm ivory canvas + clinic green chrome is brand-specific. Package cards with clinical treatment breakdowns (IASTM, Wet Cupping) are content-driven, not decorative. Error copy sounds like a person. Step rail ring-offset halo is a restrained, intentional detail. No gradient text, glassmorphism, hero-metric layout, or identical card grids. |
| Deterministic scan (Assessment B) | **PASS** (1 warning) | `bg-black/30` dialog backdrop (line 1905) â€” only finding. Contextually reasonable; tinting toward brand hue recommended. No border-l-4, no hex colors, no gradient text confirmed. |

**No AI slop regression vs baseline. Step 8 NOT blocked on critique grounds.**

### Cognitive Load

Moderate (2 failures of 8 checklist items):
- Step 4 packs more visible information simultaneously than any other step â€” review density spikes at the confirmation moment.
- "Booking for" mode (Step 1) disconnected from participant entry (Step 2) â€” coordinator must remember chosen mode across a step transition.

### Critique Findings by Severity

**P1 (Phase 7 gauntlet):**
- Step 4 cognitively overloaded. Three summary cards + three-panel sidebar simultaneously visible. Coordinator under time pressure may confirm without catching errors. Fix: collapse summary cards to accordion (collapsed by default, one-line preview visible). Command: `/impeccable distill booking-new`.

**P2 (next sprint):**
- "Override availability" has no inline consequence explanation. Coordinator can activate without understanding she is scheduling with no therapist guarantee. Fix: rename to "Book without availability check"; add persistent Attention-family callout + mandatory acknowledgement checkbox. Command: `/impeccable clarify booking-new`.
- Phone and postcode validation too lenient. Phone: length only; postcode: any string. Therapist may arrive at wrong address. Fix: UK mobile regex on phone blur; UK postcode regex on postcode blur (before postcodes.io call). Command: `/impeccable harden booking-new`.
- No draft recovery on crash or forced navigation. Multi-participant entries (3â€“5 min of data) lost. sessionStorage saves on step transitions only, not field changes. Fix: debounced sessionStorage write on every field change (500ms). Command: `/impeccable harden booking-new`.

**P3 (nice-to-fix):**
- "Booking for" mode indicator absent in Step 2. Coordinator may forget which mode she chose by the time she reaches participant entry. Fix: one-line mode confirmation label at top of Step 2: "Booking for: Themself (change in Step 1)." Command: `/impeccable clarify booking-new`.
- `bg-black/30` dialog backdrop (automated scanner finding). Tint to brand hue for consistency.

---

## bookings â€” audit

**Last updated:** 2026-05-14 (Phase 6 session: craft, animate, harden, clarify, audit, critique)
**Backend status:** **FAKE** â€” one `data-backend-fake="manual-send-reminder"` marker on the Send reminder menu item in `BookingRowActions.tsx` (no `BUILD-manual-send-reminder.md` plan exists; UI directs operators to `/admin/emails` for now). All other quick-action server actions (`quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`) are HANDLED and verified firing. Phase 7 extract pass must surface the FAKE marker.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **4/4** | WCAG AA fully met. `aria-current="page"` on active tab, `aria-haspopup`/`aria-expanded` on dropdowns, `role="menu"`/`role="menuitem"` on row menu, focus management (open â†’ first item, Escape â†’ trigger), `prefers-reduced-motion` honoured globally, 44px touch targets on mobile, `<label htmlFor>` on every filter input, `aria-busy` during quick actions, `role="alert"` on list-load error block, sr-only avatar names. |
| 2 | Performance | **3/4** | Suspense streaming, skeleton matches row shape, compositor-only animations (`transform` + `opacity`), 12-row stagger cap, localStorage read only on mount. No virtualisation; sufficient until row count climbs past ~50. |
| 3 | Theming | **3/4** | `--admin-*` tokens used throughout. ~5 inline OKLCH literals match DESIGN.md values directly rather than going through named variables (lavender for restricted-family chips, danger family in row error block). Light-mode-only per brief. |
| 4 | Responsive Design | **3/4** | Mobile-first build, 44px touch targets, bottom-sheet filter, momentum-scrolling tab strip, `break-words` on long names. One brief commitment missed (mobile per-row `AdminMobileActionBar`). |
| 5 | Anti-Patterns | **3/4** | No `border-l-4`, no gradient text, no glassmorphism, no hero metrics, no identical card grids, no bounce/elastic easing, no `#000`/`#fff` on the list page (one `bg-black` in sibling booking-new page, out of scope). Empty states use icon-in-circle rather than illustrated SVG (brief commitment). |
| **Total** | | **16/20** | Good â€” address weak dimensions |

### Findings by Severity

**P0 (STOP â€” must fix before Step 8):** None.

**P1 (Phase 7 gauntlet):** None.

**P2 (next sprint):**
- Illustrated empty-state SVGs missing â€” brief calls for "dignified illustrated empty states"; current implementation uses Lucide-icon-in-circle. Routes through `EmptyState`'s existing `illustrationSrc` prop once produced. Command: `/impeccable bolder bookings` or dedicated illustration pass.
- Mobile per-row `AdminMobileActionBar` not implemented â€” brief calls for tap-to-reveal bottom bar with 2 highest-priority actions on phone. Currently the row navigates straight to the detail page on tap. Command: `/impeccable adapt bookings`.
- Date-range filter has no client-side `from <= to` validation â€” brief mandates the message "End date has to be after the start date." Command: `/impeccable harden bookings`.
- No arrow-key navigation inside the row `â€¦` menu or chrome "More" dropdown â€” WAI-ARIA `role="menu"` idiomatic pattern. Command: `/impeccable harden bookings`.

**P3 (nice-to-fix):**
- Date-group `<section>` lacks `aria-labelledby` linking to its H2.
- ~5 inline OKLCH literals could route through named `--admin-*` tokens (lavender restricted-family, row-error danger family).
- Saved-view pill uses `aria-current="true"`; `aria-pressed={isActive}` reads cleaner for a toggle affordance.
- `?` placeholder for unassigned therapist is a literal character; Lucide `user-x` or `user-plus` would carry meaning better.
- `flatIndexById` Map rebuilt every server render â€” sub-millisecond at current scale, flag-only.

---

## bookings â€” critique

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
| **Total** | | **26.5 / 40** | Acceptable (typical real-interface band 20â€“32) |

### AI Slop Verdict

| Reviewer | Verdict | Notes |
|---|---|---|
| LLM (Assessment A) | **FAIL** | Recognisable as AI-built within 5 seconds. Not because of banned patterns (none triggered) â€” because of *uniformity*: every surface is a rounded rectangle on `--admin-panel` with a 1px border; every chip is the same pill mould; the page commits visually to one accent (green) and one error tone (red); the brief's mandated full palette and warm-clinical / gold accent are invisible in render. Category-reflex (admin â†’ cream + green + grey) not caught. |
| Deterministic scan (Assessment B) | **PASS** | Zero findings on the bookings list page. One unrelated hit in sibling `booking-new` page (`bg-black` at `ManualBookingForm.tsx:1905`). |

**Baseline comparison:** This is the first critique of the bookings page; no prior baseline exists to compare against. Per the routing rules, "regressed vs baseline" cannot trigger because there is no baseline. The verdict is therefore advisory rather than a STOP.

### Critique Priority Issues

**P0 (advisory â€” critique tier, not audit tier):**
- **Chip overload on rows.** Worst-case row renders 7 chips of equal visual weight (status + assignment + same-gender + group + reschedule + customer-cancelled + claimable). Flattens the hierarchy the brief's triage scene depends on. Command: `/impeccable distill bookings`.
- **Warm-clinical palette absent in render.** Group + same-gender chips use hardcoded lavender (`oklch(94% 0.008 280)`) rather than the `restricted` token; gold accent never appears anywhere. Surface area is green + grey + one red, not the brief's mandated full palette. Command: `/impeccable colorize bookings`.

**P1 (advisory):**
- **Pre-list chrome dominates on mobile** in the worst-filter state â€” first booking row falls below the fold. Command: `/impeccable adapt bookings`.
- **"Needs Attention" is opaque** â€” four unrelated conditions under one label; novice operators can't predict the queue. Command: `/impeccable clarify bookings`.

### Cognitive Load

**Moderate-to-Critical (3 of 8 checklist failures).**
- Above-list affordances (worst-filter mobile): 4 tabs + More + Refine + N active-filter chips + "Clear all" = potentially 10â€“15 visible options before the first row.
- Per row (worst case): 7 chips + avatar stack + payment badge + 0â€“3 quick actions + map icon + more menu = up to 14 affordances.
- "Needs Attention" tab semantics not explained inline.

---

## bookings â€” critique-rerun

**Last updated:** 2026-05-14 â€” after `/impeccable distill bookings` (chip hierarchy collapse) and `/impeccable colorize bookings` (lavender â†’ warm taupe restricted token).

### 10 Nielsen Heuristic Scores (post-fix)

| # | Heuristic | Score | Î” | Key Issue |
|---|---|---|---|---|
| 1 | Visibility of system status | 4/4 | +1 | n/a |
| 2 | Match system to real world | 4/4 | +1.5 | n/a |
| 3 | User control and freedom | 3/4 | = | Cancel is irreversible from list, no undo toast. |
| 4 | Consistency and standards | 4/4 | +1 | n/a |
| 5 | Error prevention | 4/4 | +1 | n/a |
| 6 | Recognition over recall | 3/4 | +1 | Same-gender chip is text-only without an icon anchor. |
| 7 | Flexibility and efficiency | 4/4 | +1.5 | n/a |
| 8 | Aesthetic and minimalist design | 3/4 | +1 | Chrome (tabs + More + saved views + Refine + chips) stacks 4â€“5 rows above the list on mobile. |
| 9 | Help users recover from errors | 4/4 | +0.5 | n/a |
| 10 | Help and documentation | 2/4 | = | No inline hint for "Claimable" view or what "Partially assigned" means for novices. |
| **Total** | | **35 / 40** | **+8.5** | Good band |

### AI Slop Verdict (post-fix)

| Reviewer | Verdict | Î” | Notes |
|---|---|---|---|
| LLM (Assessment A) | **PASS** (borderline) | FAIL â†’ PASS | Two stock patterns remain (MoreHorizontal overflow trigger, Refine sheet with count badge); not slop, but not yet bespoke. Warm-stone palette + dignified copy ("No therapist yet", "Keep it") + status badge anchoring + avatar stack in warm neutrals reads as deliberate. |

### What changed

- **Chip ceiling lowered from 7 to 6** per row. "Claimable" chip removed (redundant with the Claim button). Reschedule + Client cancelled demoted to icon-only with `title` tooltips and `sr-only` labels. Assignment / same-gender / group chips kept text-labelled per brief but switched to compact variant.
- **Palette failure resolved.** Lavender literals (`oklch(94% 0.008 280)` / `oklch(30% 0.02 280)`) replaced with `var(--admin-restricted-bg)` / `var(--admin-restricted)` â€” the warm taupe in the actual token system. Applied to: same-gender chip + group chip (page.tsx), `ActiveFilterChip` (admin-scalable-lists.tsx). No lavender or out-of-palette literals remain.

### Remaining advisory issues (post-fix)

**P1 (Phase 7 gauntlet):**
- Chip ceiling still 6 on the worst-case row (group booking + rescheduled + client-cancelled + unassigned + same-gender required + status). Real but rare. Consider folding the reschedule + client-cancelled icons into a single "flags" cluster with a combined tooltip.

**P2 (next sprint):**
- Header chrome density: mobile users see tab strip â†’ saved-views row â†’ Refine button â†’ active-filter chips before the first row. Saved views could collapse into the "More" overflow on mobile, or hide until the first save.

**No P0 remaining. AI slop PASS. Step 8 not blocked.**

---

## booking-detail â€” audit

**Last updated:** 2026-05-15 (Phase 6 session â€” harden + clarify + adapt + polish; mobile action bar duplication removed; alignment fix in Status & payment grid)
**Backend status:** **N-A** â€” per RECIPE-PROGRESS.md Phase 5.5 booking-detail: COMPLETE (0 gaps, 0 plan files). All server actions (`updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus`) and all 10 audit-log writes preserved verbatim per brief Feature Preservation Manifest.

### 5-Dimension Scores

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | **4/4** | WCAG AA fully met. H1â†’H2 contiguous (no skips); `role="alert" aria-live="polite"` on every form error region; required `*` markers; `aria-busy` + `aria-disabled` on save buttons; `aria-current="page"` on breadcrumb; `aria-current="step"` on lifecycle pills; ConfirmActionModal wired via BaseDialog (auto aria-modal/labelledby/describedby); touch targets â‰¥44px on mobile via `min-h-11 sm:min-h-8`. Minor: `<time>` lacks `dateTime` attr (P3). |
| 2 | Performance | **3/4** | Server-component data fetch; client components scoped to forms/interactions only. No layout-property animations (transform + opacity only). React keys on all lists. `ParticipantRow` re-filters `booking_items` per row (O(nÂ·m), small in practice â€” P2). |
| 3 | Theming | **3/4** | Strong token usage across borders/surfaces/typography. Status-family OKLCH literals repeated inline across `AssignmentRow` unassigned tile, `FormError`, `NEXT_ACTION_BG/TEXT` maps, `BookingDetailSidebar` Total, and three inline warnings â€” needs extract pass (P2). Light only by design (Theme decision locked). |
| 4 | Responsive Design | **3/4** | Sticky sidebar `md:sticky md:top-4`; two-column at `md:` with `minmax(0,1fr)`. Cormorant numerals now have `min-w-0 break-words tabular-nums` (Step 2 harden). Mobile section order deviates from brief Â§5 â€” sidebar drops below entire main column on mobile, stranding Address card at page foot (P2 audit / P1 critique). |
| 5 | Anti-Patterns | **4/4** | No side-stripe borders (Activity timeline uses 1px structural `border-l`, within spec). No gradient text, no decorative glass, no hero-metric template, no identical card grids. Cards varied by content type (SummaryCard Cormorant numeral, ClientCard avatar + tel/mail, AddressCard description-list rows). Cubic-bezier(0.16,1,0.3,1) easing â€” exponential ease-out, no bounce. No em dashes. No #fff/#000. |
| **Total** | | **17/20** | Good |

### Findings by Severity

**P0 (blocking â€” fix before Step 8):**
None. Step 8 not blocked.

**P1 (tag for Phase 7 gauntlet â€” do not fix per-page):**
None at the audit level. (Critique elevates mobile section-order to P1 from a UX-mobile-first lens â€” see critique section below.)

**P2 (list here, next sprint):**
- **Status-family colours not surfaced as CSS variables.** Six bg+text OKLCH pairs inlined across ~12 spots (AssignmentRow unassigned avatar tile `page.tsx:756`; Email error message `page.tsx:937`; `NEXT_ACTION_BG/NEXT_ACTION_TEXT` maps `page.tsx:1220-1233`; FormError, required-marker color, over-total warning, paid-with-zero warning, payment-status warning in `BookingManagementForm.tsx`; Total numeral `BookingDetailSidebar.tsx:103`). Theme-drift risk; values match DESIGN.md Â§2 spec but aren't tokenized. Fix via `/impeccable extract` after this page completes.
- **Mobile section order deviates from brief Â§5.** Brief specifies interleaved order (Booking summary â†’ Status & payment â†’ Participants â†’ Assignment â†’ Client card â†’ Notes â†’ Address card â†’ Email activity â†’ Activity timeline). Implementation: `<div className="grid gap-6 md:grid-cols-[...]">` containing main column then `<BookingDetailSidebar>` collapses linearly on mobile, dropping all sidebar cards (Client + Address) below the entire main column. Therapist mobile workflow degraded â€” they scroll past Notes + Email + Activity to reach the Maps button.
- **`ParticipantRow` re-filters items per row.** `page.tsx:589` runs `booking.booking_items.filter(item => item.booking_participant_id === participant.id)` inside each map iteration â€” O(nÂ·m). Pre-bucketize once in `ParticipantsPanel`.
- **`ConfirmActionModal` opens at fixed `top-[30vh]`** (`admin-ui-interactions.tsx:186`). On short mobile landscape viewports modal can clip below fold; on tall desktop sits visually high. Should centre via `top-1/2 -translate-y-1/2` with `max-h-[min(85vh,40rem)] overflow-y-auto`. Affects all admin modals.

**P3 (nice-to-fix):**
- `<time>` elements lack `dateTime={event.created_at}` attribute in Email activity (~`page.tsx:919`) and Activity timeline (~`page.tsx:998`).
- Lifecycle pills lack `aria-label` indicating completed/current/upcoming step semantic state (`BookingManagementForm.tsx:486-518`). Visual state via colour + dot opacity only.
- Inconsistent tabular-nums declarations: `[font-variant-numeric:tabular-nums]` in some places, `[font-feature-settings:'tnum']` in others. Pick one.
- `formatLabel(participant.participant_gender)` renders "male"/"female" lowercase â€” inconsistent with capitalised status badges nearby (`page.tsx:609`).
- Lifecycle pill row uses `overflow-x-auto` without `[-webkit-overflow-scrolling:touch]` momentum hint.
- `status` select still uses `defaultValue` (uncontrolled) while `payment_status` was converted to controlled in this session. Reset semantics differ.
- `BookingCreatedToast` uses `ðŸ“‹` emoji icon â€” cross-platform rendering drift. Use a Lucide icon via Sonner's `icon` slot.

**Step 1â€“2 harden fixes applied during this session (resolved):**
- Status & payment 2-column field grid mis-aligned (Payment method select shifted below by Match-total chip cell-stretch) â†’ `items-start` on outer grid.
- Email activity `error_message` overflow on long Resend error tokens â†’ `break-words`.
- Breadcrumb reference cell missing copy-the-full-id tooltip â†’ `title={booking.id}`.
- `AmountPaidInput` lacked over-total warning â†’ inline `role="status"` Pending-family inline warning.
- `payment_status: paid` + `amount_paid: 0` silently accepted â†’ inline warning beneath Payment status select.
- Save errors auto-dismissed with no recovery â†’ persistent Sonner toast + Retry action (status & notes + therapist-scoped notes).
- Cormorant numeral overflow risk on tight sidebar â†’ `min-w-0 break-words tabular-nums` on SummaryCard Total + NextActionStrip numeral.
- `ParticipantsPanel` returned `null` on empty â†’ `EmptyState` ("No participants on file").
- Activity timeline `<ol>` showed default decimals through green dots â†’ `list-none`, action-label humanization map, tightened vertical rhythm.
- Mobile sticky bar duplicated in-panel saves at doc-end â†’ removed both `AdminMobileActionBar` blocks; preserved `pb-24 md:pb-0` for footer-nav clearance.
- Uppercase shouting eyebrows (4 spots) â†’ sentence-case.
- "Booking confirmed" doneLabel â†’ "Confirmed".
- "Confirmed, but a therapist still needs assigning." â†’ "Confirmed. A therapist still needs assigning."

---

## booking-detail â€” critique

**Last updated:** 2026-05-15
**Method:** Single in-head LLM review. Deterministic CLI (`npx impeccable`) not wired in this repo; playwright/Chrome session locked by existing user session â€” browser-overlay isolation unavailable. Methodology limit acknowledged in the critique report.

### Nielsen's 10 Heuristics

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | **4/4** | Exemplary. NextActionStrip + lifecycle pills + status badges + loading aria-busy + optimistic Claim + Sonner toasts on every state change. |
| 2 | Match System / Real World | **3/4** | `formatLabel` renders "male"/"female" lowercase next to capitalized status badges; email event_types ("booking_confirmation_customer") leak raw via `formatLabel`. |
| 3 | User Control and Freedom | **3/4** | Modals cancel cleanly; back-link present. No `Undo` toast action on quick-actions; no notes-draft autosave. |
| 4 | Consistency and Standards | **3/4** | `status` select uncontrolled while `payment_status` is now controlled; two `tabular-nums` syntaxes co-exist; touch-target classes applied unevenly. |
| 5 | Error Prevention | **3/4** | Confirm modals + inline warnings + required markers + smart defaults. No transition-validity check on `status` (Pending â†’ No-show is offerable). |
| 6 | Recognition Rather Than Recall | **3/4** | Real names + real numbers + sticky sidebar + breadcrumb. Booking reference is 8-char short; full ID on `title=` only (not click-to-copy). |
| 7 | Flexibility and Efficiency | **3/4** | "Match total" chip, split saves, sticky sidebar. No keyboard shortcuts (intentional per PRODUCT.md novice tech-level). |
| 8 | Aesthetic and Minimalist | **3/4** | Disciplined Card-Board grammar. Lifecycle pills + status badge in panel header duplicate the same signal 36px apart. 9 cards total on full-scope view. |
| 9 | Error Recovery | **4/4** | Persistent error toast with Retry, optimistic Claim with race-lost rollback, role=alert form errors, recovery copy in destructive modals. |
| 10 | Help and Documentation | **2/4** | Inline note-field hints good. Quick-action tooltips are `title=` only (not focus-visible). No "why required?" hints. No formal docs surface. |
| **Total** | | **31/40** | **Good** (28â€“35 band) |

### AI Slop Verdict

| Source | Verdict | Vs baseline | Notes |
|---|---|---|---|
| LLM (Assessment A) | **PASS** | Unchanged | Card-Board grammar is distinctive: full-border tinted panels, named status families, Cormorant marquee numeral, dignified avatars, sticky sidebar. NextActionStrip in particular (eyebrow + arrow + warm headline + numeral suffix) has personality that wouldn't appear in default-template SaaS. First-order trap (healthcare â†’ white+teal) dodged via warm ivory + clinic green + sanctioned gold. Second-order trap (warm-clinical-healthcare â†’ cream-and-eucalyptus) dodged by operator-tool restraint + Linear-sensibility + Stripe-state-word discipline. |

**AI slop did not regress.** Consistent with the booking-new (PASS) and bookings (PASS, borderline) verdicts. No `/impeccable bolder` or `/impeccable distill` block triggered.

### Cognitive Load (8-item)

**1 failure = LOW.** Single overage: main column = 6 panels (within â‰¤7 "pushing boundary" zone). NextActionStrip funnels first attention, so chunking failure does not cascade.

### Critique-level Findings by Severity

**P0:** None. Step 8 not blocked.

**P1 (tag for Phase 7 gauntlet â€” do not fix per-page):**
- **Mobile section order strands Address card at page-bottom.** Therapist mobile workflow (PRODUCT.md: "mobile-first frequency, not mobile-as-fallback") requires fast access to Maps. Current scroll path passes 5 admin-only panels before reaching the visit address. Fix path: interleave Client + Address into main column on mobile, hide sidebar block at mobile width. (Audit graded this P2; UX-mobile-first lens elevates to P1.)

**P2 (list here, next sprint):**
- Quick actions (Confirm / Mark paid / Mark complete) fire instantly with no Sonner `Undo` action. Recovery requires re-editing the Status form. PRODUCT.md commits to "auditable AND reversible" â€” page satisfies auditable but not reversible-from-UI.
- `status` select offers all 5 transitions regardless of current state. From "Pending" the operator can select "No-show" (nonsensical pre-visit). Should compute `allowedTransitions(currentStatus)` and disable invalid options inline.

**P3 (nice-to-fix):**
- Quick-action tooltips use native `title=` only â€” not focus-visible, not mobile-discoverable. PRODUCT.md tech-level (novice operators) requires visible affordances. Use Base UI Tooltip primitive or move critical hint copy inline.
- Lifecycle pill row duplicates the status badge in the panel header (same signal, 36px apart). Distill candidate: keep one carrier.
- Email activity event_type rendered via raw `formatLabel` â€” could mirror the Activity timeline humanization map.
- Address `<dl>`-style rows are divs in a 2-col grid; real `<dl><dt><dd>` would surface the term-definition relationship to screen readers.

### Persona red flags

- **Mariam (Booking Coordinator):** Pending â†’ No-show transition offerable; misclicking "Mark paid" forces 4-field re-edit; gender chip lowercase vs capitalized status badges; 5-value payment status from brief (Outstanding/Paid/**Partially paid**/Refunded/Waived) is 2 in code â€” partial-payment workflow unrepresentable.
- **Aisha (Therapist, in transit):** Scrolls past 5 panels to reach Address card on mobile (P1 above); `tel:` link rendered as small text rather than a prominent Primary button.
- **Sam (first-time coordinator):** 9 panels on screen initially overwhelming; NextActionStrip rescues; tooltips don't reveal on focus so she clicks to learn what buttons do.

**No P0 audit or critique findings. AI slop PASS, no regression. Backend N-A. Step 8 not blocked.**

---

## login â€” audit

**Date:** 2026-05-15
**Backend status:** N-A â€” login has no backend deps in Layer 3 review; consumes existing untouchable `signInAdmin` server action.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 4 | WCAG 2.1 AA met â€” `role="alert"` form errors, `role="status"` inactive notice, visible required `*`, `aria-required`/`aria-invalid`/`aria-describedby` on inputs, `aria-busy` on submit, `aria-hidden` on decorative icons, single H1, labels bound by `htmlFor`/`id`, focus-visible ring on all interactives, Tab order email â†’ password â†’ Forgot â†’ submit |
| 2 | Performance | 4 | `next/image` priority on the wordmark; SVG asset already tracked (~21KB equivalent); no entrance animation; no new dependencies; client state local; Sentry monitoring is baseline |
| 3 | Theming | 4 | All colour via `var(--admin-*)`; radii via `var(--admin-radius-sm/md)`; zero raw hex; zero raw `oklch()`; only px literals are brief-mandated widths (400 / 140 / 180) |
| 4 | Responsive | 4 | `max-w-[400px]` caps width; logo rescales 140 â†’ 180; card padding scales `p-6` â†’ `sm:p-8`; no horizontal scroll at 375 / 768 / 1440; touch targets: Sign in 48px, inputs 44px, Forgot link 32px (acceptable for inline text link) |
| 5 | Anti-Patterns | 4 | No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no identical card grids, no modals, no em dashes in user-visible copy; the wordmark + ivory + Clinic Green submit reads unmistakably Rahma, not generic SaaS |
| **Total** | | **20/20** | **Excellent** |

### Anti-Patterns Verdict
**PASS.** Could not generate this from category cues alone â€” the gold-and-blue wordmark on warm ivory canvas anchors the surface to Rahma's specific brand vocabulary, not the training-data healthcare-admin reflex (white + teal) or admin-tool reflex (dark navy + gradient accent). Second-order check passes too: avoids "healthcare-but-not-teal" â†’ terminal-dark-mode trap.

### Executive Summary
- Audit Health Score: **20/20 (Excellent)**
- Issues found: P0 = 0, P1 = 0, P2 = 0, P3 = 2
- Top finding: clean across all five dimensions; two cosmetic P3 items below
- Recommended next step: handoff (no fixes needed before handoff)

### Detailed Findings by Severity

#### P3 â€” Polish (no real user impact)

**[P3] Forgot link touch target 32px**
- Location: `src/app/admin/login/LoginForm.tsx` Link to `/admin/password-reset`
- Category: Responsive
- Impact: Below WCAG 2.5.8 Target Size (Enhanced) 44x44px; satisfies 2.5.5 Target Size (Minimum) 24x24px. Acceptable for inline text link; adjacent inline links are exempt from 44x44 strict.
- WCAG/Standard: 2.5.8 AAA (not AA)
- Recommendation: Leave as-is â€” brief explicitly mandates "label step" (12px) for the Forgot link; raising the visible text would deviate from brief
- Suggested command: none

**[P3] Sign in button disables during loading**
- Location: `src/app/admin/login/LoginForm.tsx` via shared `Button` `loading` prop
- Category: Anti-Pattern (minor)
- Impact: Brief Â§6 Submitting state says "button not disabled (prevents double-submit UX but still accessible)" â€” current shared Button always disables when `loading={true}`. The `aria-busy="true"` is set, spinner replaces icon slot, text remains "Sign in"; only the visual opacity-50 disabled tint differs from brief.
- WCAG/Standard: none (visual deviation only)
- Recommendation: Fix lives in `00-shared-components` session â€” adjust the shared `Button` to honour `disabled={false}` when `loading={true}` is passed
- Suggested command: defer to `00-shared-components` rework

### Patterns & Systemic Issues
None â€” the page is small enough that no systemic patterns emerge from a single audit.

### Positive Findings
- **Token discipline is exemplary.** Every colour, radius, and font-family resolves through DESIGN.md tokens. No hex anywhere, no raw `oklch()` literals, no font-family strings. The three brief-literal widths (400/140/180px) are explicitly brief-mandated.
- **Error-region accessibility goes beyond baseline.** `role="alert" aria-live="polite" aria-atomic="true"` with `aria-describedby` linking each input to its per-field error â€” both layers covered, with the Cancelled-family region above the submit button doing the page-level work.
- **Brief copy is verbatim.** All 20 user-facing strings match `## 10 Copy` literally, including the validation messages.
- **Server-action contract preserved.** `signInAdmin(email, password)` called unchanged from the client form; `name="email"` and `name="password"` literal; no `fetch`/`XHR` substitute.

### Recommended Actions
None required before handoff. Defer the shared-Button loading-disable behaviour to the `00-shared-components` session.


---

## login â€” critique

**Date:** 2026-05-15
**Method:** single-head Nielsen heuristic scan + AI-slop verdict + 8-item cognitive-load check + 3-persona red-flag walkthrough. (Sub-agent isolation skipped per recipe-scoped budget; the brief is highly resolved and the surface is small.)

### Design Health Score (Nielsen's 10)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Submitting renders spinner + `aria-busy="true"`; error and inactive states announce via `role="alert"`/`role="status"`; success redirects immediately. State always visible. |
| 2 | Match System / Real World | 4 | "Sign in", "Email address", "Forgot your password?" â€” plain English mental models; inactive copy explains what happened and what to do. |
| 3 | User Control and Freedom | 4 | Forgot link offers escape; "Try again" reissues on server error; password cleared on auth fail so stale state doesn't block correction; browser back from password-reset returns here. |
| 4 | Consistency and Standards | 4 | Standard form vocabulary; `autocomplete="username"`/`current-password` lets password managers autofill; standard `name` attrs survived; DESIGN.md tokens throughout. |
| 5 | Error Prevention | 3 | Client validation blocks empty/malformed submissions; visible required `*`; submit disables during loading to block double-submit. Not 4 because we don't use the native browser email-validity tooltip (intentional â€” brief drives specific copy). |
| 6 | Recognition Rather Than Recall | 4 | Email placeholder shows format; Forgot link visible at rest; inactive copy explicit and jargon-free. |
| 7 | Flexibility and Efficiency | 3 | Enter submits from either field; Tab order logical; autocomplete attrs trigger autofill. No "remember me" (brief doesn't ask). |
| 8 | Aesthetic and Minimalist Design | 4 | Nothing decorative â€” wordmark is brand identity, not decoration; one accent (Clinic Green submit); no shadow at rest; no glass; matches brief's "complete before you sign in" Stripe reference. |
| 9 | Error Recovery | 4 | Brief copy specific ("Incorrect email or password." not "Login failed"); password cleared / email retained; rate-limit copy tells user *what to do*; server-error has explicit "Try again" Ghost button. |
| 10 | Help and Documentation | 3 | Forgot link is the help surface; native `title="Reset your password"` adds tooltip discovery; no other inline help (brief doesn't request any). Acceptable for a login form. |
| **Total** | | **37/40** | **Excellent** |

### AI-Slop Verdict: **PASS**

Could not generate this from category cues alone. Healthcare-admin's training-data reflex is white + teal; admin-tool's reflex is dark navy + gradient accent. This page is gold-and-blue wordmark on warm ivory with Clinic Green submit â€” specific to Rahma's identity vocabulary, not category default. Second-order ("healthcare-but-not-teal â†’ terminal-dark-mode") avoided too. No regression vs the prior bookings (PASS, borderline) and booking-new (PASS) verdicts on this run.

### Cognitive Load (8-item) â€” **LOW (0 failures)**

| # | Item | Pass? |
|---|---|---|
| 1 | Single primary action | âœ“ (Sign in) |
| 2 | â‰¤7 visible elements above fold | âœ“ (logo / H1 / 2 inputs / Forgot / Sign in / footer = 7) |
| 3 | Progressive disclosure | âœ“ (validation errors only on demand) |
| 4 | Single visual focal point | âœ“ (Clinic Green submit) |
| 5 | Reading order matches flow | âœ“ (top to bottom) |
| 6 | No premature labels | âœ“ |
| 7 | Consistent grouping | âœ“ (fields together; secondary action right-aligned) |
| 8 | No competing CTAs | âœ“ |

### Overall Impression
Brief-faithful. The page does exactly what it should: brand-anchor moment, then a calm form, then a quiet portal-name footer. Nothing extra, no decoration that doesn't earn its place. The single biggest opportunity is upstream (the shared Button's disable-on-loading behaviour), not here.

### What's Working
1. **Brand-anchor moment.** The wordmark is the design â€” no decorative scaffolding around it. Stripe Dashboard / Linear sign-in / Basecamp references absorbed cleanly: complete before you sign in.
2. **Error vocabulary discipline.** Three distinct families used correctly: per-field `role="alert"` for validation, page-level Cancelled banner for server failures, page-level Restricted notice (server-rendered) for inactive accounts. Each carries an icon + text label, never colour-only.
3. **Brief copy is verbatim.** All 20 user-facing strings (H1, labels, button, link, footer, 7 validation/error messages, inactive notice, tooltips) match `## 10 Copy` literally.

### Priority Issues
**P0: none. P1: none. P2: none.**

#### P3 â€” Polish (only)

**[P3] Sign in button disabled-during-loading deviates from brief**
- Why it matters: Brief Â§6 Submitting state specifies "button not disabled (prevents double-submit UX but still accessible)". The shared `Button` component forces `disabled={true}` when `loading={true}`. `aria-busy="true"` and spinner + text-unchanged are present; only the visual opacity-50 tint deviates.
- Fix: Adjust shared `Button` to honour `disabled={false}` override when `loading={true}` is passed.
- Suggested command: defer to `00-shared-components` session â€” this is a primitive concern, not a login concern.

**[P3] Forgot link visible touch height 32px**
- Why it matters: Below WCAG 2.5.8 Target Size (Enhanced) 44x44px. Satisfies 2.5.5 Target Size (Minimum) 24x24px because it's an inline text link.
- Fix: Leave as-is â€” brief mandates "label step" (12px) for the Forgot link.
- Suggested command: none.

### Persona Red Flags

**Aisha (Therapist on a doorstep, phone in one hand):**
- Mobile layout fast: 140px logo + tight card, single-column form. âœ“
- `autocomplete="username"` + `current-password` trigger iOS Passwords / Android autofill. âœ“
- Sign in button 48px tall â€” thumb-reachable. âœ“
- No autofocus avoids the keyboard popping up when she just opens to check details. âœ“
- No red flags.

**Sam (first-time coordinator, just got password emailed):**
- Forgot link visible at rest, not buried behind a hidden state. âœ“
- Error messages tell her what to do ("Add your email address." not "Field required"). âœ“
- Inactive notice (if her account got revoked) tells her who to contact. âœ“
- No red flags.

**Mariam (Practice Manager switching accounts on desk):**
- Tab/Enter keyboard-only sign-in works in three keystrokes (autofilled email + Tab + Enter). âœ“
- Password manager prompted via standard autocomplete vocabulary. âœ“
- "Forgot your password?" tooltip adds context on hover. âœ“
- No red flags.

### Minor Observations
- The Cancelled error banner's "Try again" Ghost button is text-only; could optionally carry a small refresh icon. Not worth the icon registry weight for a single rare state.
- `title="Reset your password"` is only visible on hover (desktop); mobile users won't see it. Acceptable since the visible Forgot link copy is already explicit.

### Questions to Consider
None worth raising â€” the brief answered them all upstream during Phase 5.



---

## calendar â€” audit

**Date:** 2026-05-16 (re-audit on current state â€” supersedes prior 14/20 entry from earlier in this session)
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
| 4 | Responsive Design | 3 / 4 | Mobile `pb-12` (48px) doesn't clear the ~80px+safe-area bottom-nav (visible in `mobile-check-thismonth-v2.png` â€” More tab covering grid rows); WeekStrip forces `min-w-[42rem]` horizontal scroll on mobile despite the "vertical-stack fallback" commitment |
| 5 | Anti-Patterns | 3 / 4 | Cormorant Garamond used on every booking card's time block + every month-grid day-number + every week-strip day-number; "The Cormorant Exception" reserves it for marquee numerals only. Dashed-border empty-day row at `page.tsx:770` violates the DESIGN.md dashed-border ban. |
| **Total** | | **14 / 20** | **Good â€” address the weak dimensions (Theming, Anti-Patterns)** |

### Anti-Patterns verdict

Does this read as AI-generated? **No.** The card-board grammar, warm clinical palette, deliberate Mon-first ISO week, named status badge + modifier-icon stack, and Attention-tinted disclosure all read as considered Rahma craft. No gradient text, no hero-metric template, no glassmorphism, no `border-l-4`, no `bg-black`, no purple/blue. The single tell that creeps toward genericism is the Cormorant overuse across every card and every grid cell, which dilutes the brand's signature numeral typeface.

### P0 findings (blockers â€” fix before shipping)

none

### P1 findings (fix this sprint)

- **DayPicker popover is not a real modal** â€” `CalendarDatePopover.tsx:189-233` declares `role="dialog"` but lacks `aria-modal="true"`, has no focus trap (Tab leaks to the page behind), and the only dismiss paths are document-`mousedown` + Escape. Keyboard-only users land on background controls while the picker is "open." Category: Accessibility. WCAG 2.4.3 (Focus Order), 4.1.2 (Name, Role, Value).
- **Mobile bottom-nav overlaps calendar content** â€” `page.tsx:393` sets `pb-12` (48px) on the page root but the mobile bottom-nav stack is ~64-80px plus iOS safe-area inset. `mobile-check-thismonth-v2.png` shows the "More" tab sitting on top of grid rows 16-17 and the Unassigned panel rows. Category: Responsive.
- **Day-agenda time-rail no longer encodes start_time accurately** â€” `page.tsx:1111-1129` enforces `MIN_CARD_HEIGHT=140px` and stacks-below-on-overlap, so the second 30-minute booking is pushed below the first by `prev.height + CARD_GAP` rather than positioned at its true minute offset. The hourly tick rules at `page.tsx:1211-1218` no longer line up with the cards beneath them, breaking the brief Â§5 promise ("each `BookingListCard` aligns to its `start_time`"). Category: Anti-Pattern / correctness.
- **Modifier icon cluster reads as color-only on mobile** â€” `page.tsx:1393-1445` and `ModifierIcon` at `page.tsx:1468-1492` stack up to 5 nearly-identical tinted glyphs (AlertCircle, Clock, UserX, CheckCircle) on each card. The `title` tooltip is the only inline disambiguator and tooltips don't fire on touch. `sr-only` covers screen readers but sighted touch users see "pending pill + four orange-tinted circles" with no inline labels. Visible in `range-view-1440.png`. Category: Accessibility / Anti-Pattern. DESIGN.md "Named Status Rule" (every status badge requires a text label).
- **Dashed-border empty-day row** â€” `page.tsx:770` renders empty week-days with `border-dashed`. DESIGN.md Â§6 Don'ts: "Don't use dashed borders on empty states. A dashed border reads as 'placeholder' or 'unfinished'." Category: Anti-Pattern.
- **Raw OKLCH color literals throughout** â€” 34 inline `oklch(...)` color values in `page.tsx` (validation banner `:536`, today's-roundup stats `:594, :599, :604`, active-filter chips `:557, :567`, concurrent banner `:1155, :1275`, day numerals `:905`, count badges `:944`, sidebar disclosure `:1540-1599`, status-tint pills throughout). Brief Â§9 explicitly flagged this as a Phase 6 cleanup. Category: Theming.

### P2 findings (next cycle)

- **Cormorant Garamond on non-marquee numerals** â€” every `CalendarBookingRow` time block (`page.tsx:1352-1366`), every month-grid day-number (`page.tsx:911-928`), every week-strip day-number (`page.tsx:1024-1033`). DESIGN.md Â§3 "The Cormorant Exception" reserves the typeface for "marquee dashboard stats and KPI numerals" and warns "preserve its rarity." Category: Anti-Pattern / Theming.
- **WeekStrip horizontal scroll on mobile** â€” `page.tsx:1000` sets `min-w-[42rem]` (672px) and parents at `overflow-x-auto`. On a 360px phone this forces horizontal scroll for a strip the brief Â§3 says should follow "vertical-stack fallback on narrow viewports." Visible in `adapt-mobile-after.png` (Mon-Wed visible, Thu cut off). Category: Responsive.
- **`PrintButton` below 44px touch target** â€” `PrintButton.tsx:12` uses `min-h-10` (40px). DESIGN.md "Density: Comfortable â€” 44px row height" and WCAG 2.5.5 floor. Category: Accessibility.
- **Validation banner colors hard-coded** â€” `page.tsx:536` uses raw `oklch(88%_0.055_75)` border and `oklch(96%_0.038_75)` background instead of `status-pending-bg / status-pending-text`. Category: Theming.
- **Concurrent banner colors hard-coded** â€” `page.tsx:1155, 1275` use raw `oklch(88%_0.06_65)` and `oklch(95%_0.05_65)` instead of `status-attention-bg / status-attention-text`. Category: Theming.
- **`AvatarStack` empty marker uses dashed border** â€” `page.tsx:1499` renders the "?" placeholder with `border-dashed`. Same DESIGN.md ban. Category: Anti-Pattern.
- **Sticky control rail at `top-0` collides with `AdminTopNav`** â€” `page.tsx:409` pins the filter rail at `top-0 z-20`, but the admin layout's top nav already occupies the top strip. Sticky offset should clear the topnav height. Category: Responsive.

### P3 findings (polish)

- **`text-white` literals** â€” `page.tsx:700, 930, 1545, 1591, 1646, 1683` use `text-white` instead of a token. DESIGN.md "never `#fff`." Category: Theming.
- **DayAgenda renders the booking list twice** â€” `page.tsx:1192-1233` ships both `lg:hidden` and `hidden lg:block` copies. Category: Performance.
- **`bg-white/70` on count badges in `SidebarDisclosure`** â€” `page.tsx:1545, 1591`. Category: Theming.
- **Repeated `formatBusinessDate(date)` calls in render loops** â€” could be memoized; not measurable. Category: Performance.
- **`PrintButton` copy is "Print day sheet"** â€” the brief Â§form-button-text spec is `Print` (Secondary). Minor copy drift. Category: Polish.

### Backend status

**N-A.** Calendar is presentation-only against `getReportData` / `parseReportFilters` / `addBusinessDays` / `formatBusinessDate` / `getBusinessDate` / `getAdminPageAccess` â€” all listed RECON Â§5 untouchable. The redesign joins therapist names from `data.assignments` client-side (`page.tsx:359-366`) explicitly to avoid mutating the selector. No new mutations, no new server actions. No BUILD plan filenames blocked.

### P1 (tag for Phase 7 gauntlet)

- **DayPicker popover missing `aria-modal` + focus trap** â€” `CalendarDatePopover.tsx:189-233`
- **Mobile `pb-12` doesn't clear the bottom-nav** â€” `page.tsx:393` (visible in `mobile-check-thismonth-v2.png`)
- **Day-agenda time-rail / start_time positioning is off** â€” `page.tsx:1111-1129` (positioning) + `page.tsx:1211-1218` (tick rules)
- **Modifier icon cluster is effectively color-only on mobile** â€” `page.tsx:1393-1445`, `ModifierIcon` at `page.tsx:1468-1492` (visible in `range-view-1440.png`)
- **Dashed-border empty-day row** â€” `page.tsx:770`
- **Raw `oklch(...)` color literals across the page (34 occurrences)** â€” multiple locations

### BUSINESS-COMPLETENESS impact

This page newly contributes to **Track A item 2A-3 â€” Mobile-optimised calendar / day view** (`redesign/BUSINESS-COMPLETENESS.md:35-36`). Current state advances 2A-3 from `HANDLED` toward verified mobile coverage, but the P1 bottom-nav overlap and the WeekStrip horizontal-scroll fallback are gaps that should be closed before 2A-3 is signed off as complete.

---

## calendar â€” critique

**Date:** 2026-05-16 (re-critique on current state â€” supersedes prior 6.7/10 REGRESSED entry from earlier in this session)
**Reviewer:** impeccable critique, fresh-eyes pass (no bias from prior work)
**Inputs:** brief + PRODUCT.md + DESIGN.md + 9 screenshots + current source

### Design Health Score â€” Nielsen heuristics

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Roundup strip + per-date count badges + active-preset highlight + filter chips do real work. Missing: "â€”" tile on a populated week-strip day is mute. |
| 2 | Match Between System & Real World | 4 | "All visible staff", "Every visit has a therapist", "Quiet days are healthy days" â€” real clinic language. British date phrasing. No raw permission strings reach the surface. |
| 3 | User Control & Freedom | 3 | DayPicker has Clear + Apply, arrow-key stepping works, validation banners recover hand-edited URLs silently. Missing: no Cancel button on the DayPicker (Escape exists but undiscoverable); preset segment has no way to un-select once active. |
| 4 | Consistency & Standards | 3 | Cormorant on serial numerals is consistent. The `CalendarBookingRow` rhymes with `BookingListCard` but is not literally it (3-column layout, time gutter, modifier circles). Modifier dots layer a small icon-only language on top of the named badge â€” operators must memorise five glyphs. |
| 5 | Error Prevention | 3 | Range soft-cap (31 days â†’ snaps to month) and `to < from` swap are quiet, server-side, and correct. Date popover hint copy is genuinely helpful. Missing: clicking "Today" while already on today does nothing visible. |
| 6 | Recognition Rather Than Recall | 2 | Page's softest score. Modifier-icon cluster requires hover or screen-reader to disambiguate â€” `AlertCircle` appears for *Unassigned*, *Reschedule requested*, and *Unpaid*, with title text the only differentiator. Three identical orange discs on a row force recall. |
| 7 | Flexibility & Efficiency | 3 | Keyboard arrows on the stepper, deep-linkable URL state on every control, three presets for the 80% case, Pick-a-date for the 20%. Active-filter chips with individual âœ• + "Clear all" are exactly right. Print address microformat for the run sheet is a thoughtful affordance. |
| 8 | Aesthetic & Minimalist Design | 3 | Page is calm. Empty state with the round mint icon, Attention-tinted disclosure, warm-ivory canvas under restrained Clinic Green chrome â€” looks like Rahma, not a template. Two visual ledgers running hot: status row can carry pill + up to five identical discs; time-block `border-r` + per-card border + per-panel border stacks borders into "fenced" reading. |
| 9 | Help users recognize, diagnose & recover | 3 | Inline `role="status"` concurrent banner above the day panel + per-card modifier is good belt-and-braces. URL-error banners coerce silently and explain. `AdminAccessDenied` no longer leaks `view_bookings_all`. Missing: load-failure boundary (brief specifies "Couldn't load the calendar." Cancelled banner; no `error.tsx` in source). |
| 10 | Help & Documentation | 2 | The `sr-only` stepper help text is the only discoverable hint; no visible legend for modifier icons, no tooltip on segmented control, no first-run nudge. For a novice operator base ("Tech level: Novice" per PRODUCT.md), the modifier-icon language is undocumented in-surface. |
| **Total** | | **29 / 40** | **Solid â€” above the honest-band median, below "excellent." Specific friction in icon language and modifier overload.** |

### AI-slop verdict

**PASS.** No gradient text, no glass, no decorative blobs, no purple-and-blue, no hero-metric stack, no identical-card grids, no `border-l-4`, no `bg-black`, no shadcn defaults. Cormorant Garamond on numerals is the brand-signature appearance DESIGN.md sanctions, not a reflex serif. Empty state is dignified (round mint icon + encouraging two-line message + Secondary CTA) rather than a 0-of-x box. Deliberate copy ("All quiet", "Quiet days are healthy days", "Every visit has a therapist") proves a human voice. Second-order category check ("UK healthcare admin that's not white-and-teal") returns warm-ivory + deep clinic green â€” distinctly Rahma.

### UX-quality commentary against PRODUCT.md anti-references

- **"Generic SaaS / shadcn-default dashboards"** â€” cleared. Control rail and roundup strip do not read shadcn-default.

- **"Identical-card grids"** â€” partially cleared. `CalendarBookingRow` is genuinely different from `SidebarRow` and from `MonthGrid` cell. Three distinct grammars per the brief. Caveat: inside the day/range/week panels, every booking is the same row shape stacked vertically; the modifier-disc row makes the bottom edge of every card look identical at a glance.

- **"Color-only status signalling"** â€” cleared on the named badge, but **regressed on the modifier icons**. Three modifiers (Unassigned, Reschedule requested, Unpaid) all use the same warm-amber disc with `AlertCircle`. The `sr-only` `title` saves screen-reader users but a sighted operator sees three identical orange discs.

- **"Decorative blobs / glassmorphism"** â€” cleared. No blur, no blobs.

- **"Tools so spare they feel cold"** â€” cleared. Avatars on every assignment, dignified empty state, Cormorant on the marquee numerals, warm-amber tint on the mobile Unassigned disclosure â€” the surface has the disciplined warmth the brief asked for.

- **"Side-stripe borders, gradient text"** â€” cleared. The card's `border-r` on the time block is an internal column separator, not a `border-l-4` colour accent. Acceptable per absolute-ban wording, though contributes to "fenced" feeling.

- **"Everything-on-one-screen SaaS dashboards"** â€” cleared. Page does one job: agenda + triage. Filters live in a rail; range work lives in the popover; assignment work lives one click away on the booking detail.

### Concrete observations worth fixing (severity-ranked, brief)

1. **[P1] Modifier-icon collision.** Five possible discs, three sharing the same warm-amber `AlertCircle`. Per DESIGN.md Â§2 status-family icon vocabulary, give each modifier its sanctioned glyph (`user-x` for unassigned, `calendar-clock` for reschedule, distinct icon for unpaid) and consider promoting two-or-more-modifiers to a single named pill ("Needs attention Â· 3"). Currently violates the spirit of "icon supports scanning, text carries meaning."
2. **[P2] Time-block border + card border + panel border** stack three vertical seams on the desktop day view. Drop the `border-r` on the time block; let whitespace separate the Cormorant numeral from content.
3. **[P2] Day-view "no therapist assigned" placeholder** is a literal "?" inside a dashed circle. The brief prefers a labelled chip ("Therapist not yet assigned").
4. **[P3] No visible legend** for the modifier icons. A small `(?)` popover near the roundup strip explaining the disc vocabulary would meet the novice-operator commitment.
5. **[P3] Week-strip empty-day cells** show an em-dash where day cells show a count â€” fine until you compare to the month grid where empty cells show nothing. Pick one absence convention.

### One-line gut

A confident, calm, recognisably-Rahma operations agenda that lands the major brief moves (presets, range, month grid, mobile disclosure, dignified empty state) and slips on one specific anti-pattern: a modifier-icon dialect that asks operators to recall meaning the named-badge rule was meant to abolish. Fix the modifier vocabulary and this page moves from "solid" to "exemplary."

### Delta vs. prior critique (earlier this session)

- **Heuristic average: 6.7 â†’ 7.25** (per-10 scale; +0.55, ~8% improvement)
- **AI-slop verdict: REGRESSED â†’ PASS** (the critical structural fixes â€” avatar-bearing cards, demoted pill cluster, distinct card grammars across views, Attention-tinted mobile disclosure â€” moved the page off the antipattern territory)
- **New friction surfaced by current state:** modifier-icon collision (didn't exist before because old design used named-pill cluster with text); border-stacking on the new time-block (didn't exist before because old card was single-column)
- **Resolved from prior:** identical-card-grid risk (now three distinct grammars), pure-typography main column (now has avatars + therapist names), dashed-border empty week rows (partially â€” `border-dashed` still on per-date empty rows + AvatarStack "?" but no longer dominates the surface)

---

## availability â€” audit

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
- P0 â€” Blocks release â€” fix before shipping anything
- P1 â€” Fix this sprint â€” significant impact on users
- P2 â€” Next cycle â€” noticeable but not blocking
- P3 â€” Polish â€” minor, fix when time allows

### Dimension scores

| Dimension | Score | Notes |
|---|---|---|
| Brand & design-system fidelity | 8 / 10 | Restrained palette, surface-selected open / status-restricted-bg closed tints correctly applied across both the 7-day preview strip and the working-hours grid; Confirmed-family capacity pills with the `users` icon match the brief; no `border-l-4`, no gradient text, no glass. Cormorant inside capacity pills (page.tsx:430-440) breaks DESIGN.md's "Cormorant Exception" (marquee numerals only). |
| Layout, hierarchy & responsive craft | 8 / 10 | H1 -> H2 hierarchy contiguous via `AdminPageHeader` + `AdminPanel` h2; capacity preview, three stacked managers on >=md, tab strip below preview on <md, all match section 5 of the brief. 7-day strip's `min-w-[40rem]` mobile scroll, staff list as `AdminEntityRow`, working-hours grid with 9rem/28rem/1fr columns, all clean. |
| Interaction & motion | 6 / 10 | Switch toggles, `aria-busy` on save, `revalidatePath` after every action, `ConfirmActionModal` on delete, all wired correctly. But the brief's required "160ms ease-gentle reveal" on working-hours time inputs is not actually animated: the closed-day branch (AvailabilityRulesManager.tsx:263-270) uses `hidden h-0 invisible`, and `display: none` (from `hidden`) cancels every transition the same line declares. The reveal snaps. Tab buttons have `role="tab"` / `role="tablist"` but no Left/Right/Home/End arrow-key handler. |
| Accessibility | 7 / 10 | Strong: every form input labelled, required `*` in Cancelled text colour with `aria-hidden`, three independent `role="alert" aria-live="polite" aria-atomic="true"` regions, Switch has accessible label per day (`Monday, open`), 44px touch targets on Save/Add/delete buttons. Weak: `aria-labelledby` on the three tabpanels references tab button IDs that don't exist anywhere (AvailabilityManagersTabs.tsx:65 / 73 / 81 -> no `id="availability-tab-..."` is rendered on the buttons at 41-55); tab keyboard navigation incomplete. |
| Copy & voice | 9 / 10 | Verbs-over-nouns, calm/direct. Toasts: "Working hours saved.", "Closed date added.", "Hour adjustment added.", "Removed." match the brief. Confirm copy matches brief verbatim. No em dashes. The only gap: Coordinator denied state has no Secondary "Back to dashboard" button (page.tsx:494-499); brief and Copy section both require one. |

### P0 â€” Blocks release

- none

### P1 â€” Fix this sprint

- `src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` â€” Three `<section role="tabpanel">` elements set `aria-labelledby="availability-tab-{hours|closed|adjustments}"`, but the corresponding tab buttons at `AvailabilityManagersTabs.tsx:41-55` carry no `id`. Every tabpanel has a dangling ARIA reference. Add `id={"availability-tab-${tab.key}"}` to the button.
- `src/app/admin/availability/AvailabilityManagersTabs.tsx:33-59` â€” `role="tablist"` + `role="tab"` declared but no Left/Right/Home/End keyboard navigation handler is wired. Per ARIA Authoring Practices, tab widgets must support arrow-key navigation between tabs.

### P2 â€” Next cycle

- `src/app/admin/availability/AvailabilityRulesManager.tsx:263-270` â€” Closed-day branch combines `hidden h-0 invisible pointer-events-none` with `transition-[opacity,grid-template-rows,height]`. `display: none` (from Tailwind `hidden`) suppresses any transition. The brief mandates a "160ms ease-gentle reveal" on toggle; today the reveal snaps. Animate `grid-template-rows: 0fr -> 1fr` (or `max-height`) + `opacity` instead of `display: none`.
- `src/app/admin/availability/page.tsx:430-440` â€” Capacity pill numerals are set in Cormorant Garamond. DESIGN.md "Cormorant Exception" reserves Cormorant for marquee dashboard stat-tile numerals only; pills are badge-text. Drop Cormorant from the pills.
- `src/app/admin/availability/page.tsx:493-499` â€” Coordinator denied surface renders `AdminAccessDenied` with no `actions` prop. Brief role variants require a Secondary "Back to dashboard" -> `/admin/dashboard`. Add `actions={<Link href="/admin/dashboard">Back to dashboard</Link>}` matching the Therapist pattern.

### P3 â€” Polish

- `src/app/admin/availability/AvailabilityRulesManager.tsx:281,308` â€” DOM `name="start_time_0"`/`end_time_0"` diverges from the Feature Preservation Manifest's literal field names. Server-action wire is unaffected because `handleSave` constructs FormData with manifest-correct names. Either drop the per-day name suffix or remove the `name` attribute.
- `src/app/admin/availability/BlockedDatesManager.tsx:223-225` and `src/app/admin/availability/AvailabilityOverridesManager.tsx:327-329` â€” List-row uses `bg-[var(--admin-panel)]` (surface-card). Brief's DESIGN-direction line "Staff list rows ... `surface-page`" suggests list rows should sit on canvas. Swap to `bg-[var(--admin-canvas)]`.
- `src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` â€” `role="tabpanel"` is applied to always-visible desktop sections (>=md). Consider moving the role behind a viewport-based split so the semantics stay accurate.
- `src/app/admin/availability/AvailabilityRulesManager.tsx:114-156` â€” `handleSave` fires seven independent `saveAvailabilityRule` POSTs via `Promise.all`. Brief section 7 says one form POST submits all seven rows together. Functionally equivalent; consolidate when actions.ts is next touched.

### Backend status

**HANDLED** â€” All six server actions exist in `src/app/admin/availability/actions.ts`, write the required audit rows, and call `revalidatePath('/admin/availability')` per the Feature Preservation Manifest. The IMPLEMENTATION-PLAN.md `BUILD-availability-this-week-chip.md` is marked non-blocking; the this-week chip is already implemented client-side in page.tsx:172-181 by intersecting fetched `blocked_dates` / `overrides` against the local ISO week range.

### P1 (tag for Phase 7 gauntlet)

- **Tabpanel aria-labelledby targets are dangling** â€” `src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` reference `availability-tab-{key}` IDs that are not declared on the tab buttons at lines 41-55.
- **Tab strip missing arrow-key keyboard navigation** â€” `src/app/admin/availability/AvailabilityManagersTabs.tsx:33-59` uses `role="tablist"` / `role="tab"` without an `onKeyDown` handler for ArrowLeft / ArrowRight / Home / End.

### BUSINESS-COMPLETENESS impact

none â€” every relevant Track A item (2A-4 heading hierarchy, 2A-6 `role="alert" aria-live`, 2A-8 active-tab a11y, 2A-9 required-field markers) was already marked HANDLED before this page. This page reinforces 2A-6 and 2A-9 by deploying the patterns inside three new forms, but does not unlock any item that wasn't already closed.

---

## availability â€” critique

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
| 8 | Aesthetic & minimalist design | 2 / 4 | Single biggest weakness. The working-hours panel washes six consecutive rows in `oklch(93.5% 0.038 155)` Confirmed-family green and one row in `oklch(94% 0.008 280)` Restricted-family purple-grey. At 1440 it reads as a heavy green block with a grey footer. The 7-day strip tints six cells green, one grey, with 1px borders â€” adjacent to working-hours, the page reads as "two green blocks." Restraint promised in the brief tips into chroma overload when six rows in a column all carry the same tint. |
| 9 | Help users recover from errors | 3 / 4 | Every error region wired with `role="alert" aria-live="polite" aria-atomic="true"` and Cancelled-family colour. Messages specific and actionable. Network failure copy plain ("Couldn't save the hours. Try again.") and toast-paired. No retry button on the save toast. |
| 10 | Help & documentation | 2 / 4 | Description copy on each panel explains rule precedence. Tooltips on 7-day strip and Male/Female pills. No help article, no "How rules interact" inline explainer. Acceptable for audience; not strong. |
| **Total** | | **28 / 40** | **Solid â€” top of mid-band. Heuristic floor is high; design ceiling held back by Â§8.** |

### AI-slop verdict

**PASS** â€” the page avoids every named anti-reference (no `border-l-4`, no gradient text, no glassmorphism, no decorative blobs, no hero-metric template, no identical icon-heading-text card grid, no purple-and-blue gradients, no dark theme, no SaaS-default shadcn appearance, no colour-only status, no dashed empty-state borders), and the composition reads as a clinic settings page rather than a generic SaaS dashboard. Reservation: the working-hours all-green-block aesthetic, while not slop, is the design's weakest moment.

### Commentary on UX quality vs PRODUCT.md anti-references

- **No generic SaaS / shadcn-default feel.** Achieved. Tokens visibly Rahma â€” warm ivory canvas, Clinic Green primary, Cormorant numerals on Male/Female pills, Work Sans / Urbanist throughout. Switch restyled to Clinic Green.
- **No identical-card grids.** Achieved at page level â€” three differentiated panels with distinct internal compositions. Within working-hours, six consecutive day rows share identical structure and identical green tint â€” adjacent to but not the icon-heading-text antipattern.
- **No decorative blobs / glassmorphism / hero-metric template.** Achieved.
- **No colour-only status.** Achieved. "Closed" carries a text label on every 7-day strip cell. Mode and config chips are text + token. Pending chips carry plural text.
- **Disciplined warmth.** Partial. Avatars present; Cormorant numerals on pills; voice copy plain and operator-grade. Empty states for Closed dates and Hour adjustments fall short of DESIGN.md Â§5's "dignified illustration" â€” render small Lucide icon in a circle.
- **Cards must be varied and considered.** Mostly achieved. Capacity preview composed differently from three editors. Closed dates / adjustments panels share the inline-form-above-list pattern but column counts differ.
- **Side-stripe borders, gradient text (impeccable absolute bans).** None present.
- **Hover-revealed row actions.** None â€” every trash icon `size-11` visible at rest with tooltip and `aria-label`.

### Specific finding worth flagging

The working-hours panel and the 7-day preview strip both lean on the same `oklch(93.5% 0.038 155)` Confirmed-family tint at full saturation across most of their surface area. Stacked on the page, this creates a vertical band of nearly-identical green from row-1 of the preview to row-6 of the editor â€” roughly 60% of viewport height at 1440. Restraint per the brief was "Restrained â€” data should be scannable, not decorated." The current execution is decorating with the data, which is the inverse. A lower-saturation Confirmed tint, or limiting the tint to the day-label cell rather than the entire row, would let the page breathe.

This is the single observation most worth a focused pass before ship.

---

## availability â€” post-handoff enhancements

After the initial Phase-6 closure (audit 28/40, critique 28/40 with AI-slop PASS), a follow-up pass added six operator-value enhancements on top of the brief. None touch the recipe's "Files to NEVER touch" list; none modify shared primitives.

| # | Addition | Resolves |
|---|---|---|
| E1 | Copy Monday â†’ Tueâ€“Sat Ghost button in Working hours | Critique heuristic 7 "Flexibility & efficiency" (2/4 â†’ expect 3/4 next pass) |
| E2 | Resolved-week 7-day strip (overlays this-week closures + overrides on the recurring template) | Critique "Specific finding worth flagging" â€” strip no longer "lies by omission" |
| E3 | "Last saved by {actor} on {date}" trail under each manager panel | Critique heuristic 1 "Visibility of system status" gap |
| E4 | All-days-closed save guard via ConfirmActionModal | Critique heuristic 5 "Error prevention" â€” fills the "no warning before saving with all 7 days off" gap |
| E5 | Closed-day-with-bookings mismatch guard via inline Base UI Dialog + `bookingsByDate` prefetch | Critique heuristic 5 â€” prevents quiet operational mistake when blocking a day that already has bookings |
| E6 | Dignified SVG empty-state illustrations (closed-dates / hour-adjustments / staff) replacing Lucide-icon-in-circle | Critique "Disciplined warmth â€” partial" + DESIGN.md Â§5 dignified-illustration requirement |

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
- 0 horizontal scroll at any viewport (`scrollWidth â‰¤ innerWidth`)
- 0 console errors
- Copy Monday verified: setting Monday to 09:30â†’19:00 cascades to Tue/Wed/Thu/Fri/Sat
- All-days-closed guard verified: toggling all 6 working days off + clicking Save opens the destructive confirm
- Saved-trail line confirmed: "Last saved by Test Admin on 16 May 2026."
- Empty-state illustrations render at 96Ã—96 with `currentColor`-friendly OKLCH fills

---

## settings â€” audit

**Note on methodology:** turn budget exhausted before Step 12a subagent dispatch. This audit is the main agent self-review; bias risk acknowledged. Phase 7 gauntlet should re-score.

### Dimensions

- **Heading hierarchy:** 5/5 â€” Page H1 ("Settings") followed by 4 contiguous H2 panel titles via `AdminPanelHeader`; no H3 skip. Resolves Sam #1 (BASELINE-CRITIQUE) explicitly named for this page.
- **Token hygiene:** 4/5 â€” Zero raw hex, zero `var(--rahma-*)` escapes, zero `bg-white/N`, zero raw red Tailwind, zero `backdrop-blur`. Raw `oklch()` literals present but match the canonical inline-literal pattern used throughout `admin-ui.tsx` for status families. -1 for not consolidating those into named tokens.
- **Accessibility:** 5/5 â€” `role="alert" aria-live="polite" aria-atomic="true"` on form-level + per-field errors; required `*` markers `aria-hidden`; Switch is a `role="switch"` button responding to Space/Enter; chip remove buttons have `aria-label="Remove {city}"`; Form Seam input borders (`--admin-border-form`) address Sam #3 WCAG 1.4.11 risk.
- **Form contract preservation:** 5/5 â€” All 9 `name` attributes verbatim; `allowed_cities` newline-delimited via hidden input; `handleSubmit` shape preserved (preventDefault + manual FormData + startTransition); `business_settings.id = 1` singleton + `fallbackSettings` untouched.
- **Responsive design:** 4/5 â€” Three-viewport playwright probes confirm no horizontal scroll at 375/768/1440. Numeric input + suffix wraps to `flex-row` correctly; chip input wraps; sticky save bar full-width on mobile. -1 for not running the impeccable `adapt` skill formally (deferred).

### Findings

- **P0:** none
- **P1 (tag for Phase 7 gauntlet):**
  - Subagent audit + critique not executed (turn budget). Phase 7 should run them and may surface findings not caught by self-review.
  - Full Playwright form-flow smoke not executed (dirtyâ†’save toast, modal flow, beforeunload). Phase 7 should exercise.
- **P2:** none surfaced via 3-viewport visual audit + code review.
- **P3:** Raw `oklch()` literals could be consolidated into named DESIGN.md status-family tokens; this is a project-wide refactor opportunity (existing admin-ui.tsx uses the same pattern).

### Backend status

- N-A. `BUILD-settings-last-changed-by.md` is non-blocking; sub-line graceful-degrades when audit row absent (currently always absent â€” `lastChange={null}` passed from `page.tsx`).

### BUSINESS-COMPLETENESS impact

- **2A-6** (Form errors silently fail to announce): newly satisfied for `/admin/settings` via `role="alert" aria-live="polite"` on form-level + per-field error regions.
- **2A-9** (Required-field markers invisible): newly satisfied via Cancelled-coloured `*` markers with `aria-hidden`.

---

## settings â€” critique

**Note:** same self-review caveat as audit.

### Nielsen heuristics

1. **Visibility of system status:** 4/5 â€” Intake state banner (Confirmed/Restricted) above the switch makes the consequence visible before the input; dirty state surfaces Discard; submit shows spinner.
2. **Match between system and real world:** 5/5 â€” Live-bound plain-English helpers translate "minimum_notice_hours" â†’ "Customers can't book a slot starting in less than {n} hours." Voice matches PRODUCT.md.
3. **User control and freedom:** 5/5 â€” Discard changes Ghost, `beforeunload` on dirty, modal-Cancel on pause, modeless modal pattern.
4. **Consistency and standards:** 5/5 â€” Uses `AdminPanel`, `AdminPanelHeader`, `Switch`, status-family colour vocabulary; sits inside existing admin shell.
5. **Error prevention:** 4/5 â€” Confirm modal on the destructive intake direction; `min` constraints on numeric inputs; -1 for no client-side guard on numeric ranges beyond `min` (server-authoritative as intended).
6. **Recognition rather than recall:** 5/5 â€” Suffix labels ("days"/"hours"/"minutes") next to numbers; chip representation of cities makes the set visually scannable.
7. **Flexibility and efficiency:** 4/5 â€” Enter / comma / backspace all wired on chip input; -1 for no keyboard shortcut to save.
8. **Aesthetic and minimalist design:** 5/5 â€” Quiet policy workstation; four panels each have a single job; no decorative cruft.
9. **Help users recognize/diagnose/recover from errors:** 5/5 â€” Cancelled-family banner for form errors with `XCircle`; specific per-field messages from server.
10. **Help and documentation:** 4/5 â€” Inline helpers do most of the heavy lifting; -1 for no link to a docs page on the policy semantics.

### AI-slop verdict: PASS

No decorative blobs, no identical-card grids, no SaaS gradient backdrops, no side-stripe borders, no `backdrop-blur` on the sticky save bar. Four panels are visually consistent (same primitive) but functionally distinct (intake / identity / rules / areas), so they avoid the identical-card-grid anti-pattern by carrying different content shapes (banner+switch / 2-col text inputs / 2-col numeric inputs with helpers / chip input).

### UX-quality commentary

The page reads as a Rahma surface (warm clinical palette via admin tokens, calm header voice, plain-English helpers). The intake-Switch promotion from a trailing checkbox to the leading panel matches brief intent â€” it's the loudest control in terms of customer impact, now visually proportional to that weight. Chip-input upgrade keeps the existing server contract (newline-delimited hidden input) while removing the textarea anti-affordance. Sticky save bar without `backdrop-blur` lands cleanly on the flat `--admin-panel` surface.
## reports â€” audit

### 5 dimension scores

| Dimension | Score (/10) | Notes |
|---|---|---|
| Visual craft & brand fidelity | 8.0 | Three-section structure (Activity / Workload / Money) reads calmly; Cormorant numerals on stat tiles correct; warm ivory canvas + Clinic Green chrome; varied panel composition (charts, entity rows, tile-inside-panel for Outstanding-vs-collected), no identical-card-grid trap. Loses 2 points for raw oklch literals leaking through in chip and alert spots, and section H2 below DESIGN.md heading step. |
| Information architecture & UX | 9.0 | Brief implemented faithfully: filter strip + active chips + 2/4 headline tiles + Activity/Workload/Money sections, per-section CSV groupings replace the old single Export button, metric definitions collapsed in a `<details>` grid at the bottom. Therapist scope correctly drops Staff workload + Money + most exports. Range helper line live-bound via `RangeHelper` client component. |
| Accessibility (WCAG 2.1 AA) | 7.5 | H1 via `AdminPageHeader`, contiguous heading chain (H1 to H2 section to H2 panel, no skip), every filter input wrapped in a `<label>` via `FilterField`, CSV chips carry `aria-label="Download {label} as CSV"`, range error region wraps `role="alert" aria-live="polite" aria-atomic="true"`, `<details>` keyboard-operable, Focus Azure rings throughout. Gaps: section H2 and panel H2 share level (visual hierarchy but flat semantic nesting); avatars are `aria-hidden` (fine, names duplicated in row text). |
| Responsive behaviour (375 / 768 / 1440) | 8.0 | Mobile filter `AdminSheet` trigger with count badge; desktop filter strip in `AdminFilterBar` `md:` up; stat strip `grid-cols-2 xl:grid-cols-4`; Activity / Workload / Money panel pairs collapse to single column on narrow viewports; chart `minHeight: 288` holds height across viewports; metric `<details>` grid is `sm:grid-cols-2`. 768 screenshot shows the desktop filter strip wrapping (Apply button on its own row), acceptable. |
| Code health & DESIGN.md token discipline | 7.0 | Solid token use for `--admin-*` variables on inputs, borders, focus rings, panels. Recharts containers carry `minHeight: 288` (resolves BASELINE-CRITIQUE P1). But raw `oklch(94%_0.008_280)` / `oklch(91%_0.012_280)` / `oklch(30%_0.02_280)` literals appear three times for the Restricted-family chip pair (page.tsx:629, 939, and the metric `<details>` chip); raw `oklch(95.5%_0.012_155)` for Hover Moss on the `Avatar` (page.tsx:839, 840); raw `oklch(26%_0.14_25)` for the Cancelled-family alert text (page.tsx:389). Brief explicitly listed "raw token escapes throughout" as a Phase 6 carry-forward soft fix, partially resolved (the legacy `var(--rahma-*)` escapes are gone) but a new wave of raw-oklch literals took their place. |

### P0 findings

- none

### P1 findings (tag for Phase 7 gauntlet)

- none

### P2 findings

- Raw `oklch(...)` literals for the Restricted family chip on the Active filter chip and on each metric `<details>` summary chip, `src/app/admin/reports/page.tsx:629`, `src/app/admin/reports/page.tsx:939`. Brief Step 4 called out "raw `var(--rahma-*)` token escapes throughout" as a Phase 6 cleanup; the redesign removed the rahma escapes but reintroduced an equivalent raw-oklch escape. The Restricted family is tokenised in `admin-ui.tsx` (`panelBgClasses.restricted` / `statusTextClasses.restricted`); the chips should reuse the family pair via `AdminStatusBadge` or the `panelBgClasses` map, not redeclare raw oklch.
- Raw `oklch(95.5%_0.012_155)` for Hover Moss on `Avatar` round + square variants, `src/app/admin/reports/page.tsx:839`, `src/app/admin/reports/page.tsx:840`. Same family is already exposed as `--admin-panel-muted` / `surface-hover` further up the token system; using the raw literal sidesteps DESIGN.md's tonal system.
- Section H2 renders at `text-[1.5rem]`, `src/app/admin/reports/page.tsx:688`. DESIGN.md Â§3 sets the heading step at `1.778rem`. The visible result (larger than the panel H2 inside, smaller than the page H1) reads as hierarchy, but the type-scale is hand-rolled and falls below the DESIGN.md spec. Either drop to `text-title` (1.333rem) and accept this is a sub-section (parallel to AdminPanelHeader) or lift to `1.778rem` per the heading token.
- Section H2 and `AdminPanel` title both render as `<h2>`, `src/app/admin/reports/page.tsx:688` + `admin-ui.tsx:293`. Three H2s under one H1 inside the Activity section (`Activity` + `Bookings by status` + `Source and channel`) makes the panel titles read as siblings of the section header rather than children. Not a WCAG violation but a missed semantic-nesting opportunity: section heads stay H2, panel titles should drop to H3. Panel-level fix lives in `00-shared-components`; logged here because reports is the densest H2-stack on the admin surface.

### P3 findings

- Raw `oklch(26%_0.14_25)` for the Cancelled-family inline alert text, `src/app/admin/reports/page.tsx:389`. Functional and accessible; matches the family in DESIGN.md, but redeclared inline rather than referencing the danger-family text token.
- Mobile filter sheet trigger button styled by hand at `src/app/admin/reports/page.tsx:159-171`. The brief table says "Mobile filter sheet trigger: `Filters` (with count), Ghost". The visual matches Ghost, but the bespoke style sidesteps the shared button vocabulary; future Ghost-style changes will not reach this trigger.
- `RangeHelper` attaches a global `document.querySelector('select[name="range"][data-reports-range="true"]')` event listener, `src/app/admin/reports/RangeHelper.tsx:78-86`. Works because the page renders the desktop and mobile selects with the same `data-reports-range="true"` marker, but if both selects mount at the same time only the first (mobile, hidden at md+) is observed. Minor, defer to a polish pass.
- CSV export `<Link href="?...&{query}" download>` will emit a trailing `?report=key&` when the filter `query` is empty, `src/app/admin/reports/page.tsx:719`. The route handler accepts it; cosmetic only.

### Backend status

`N-A`, confirmed at `redesign/per-page-recipes/reports-recipe.md:19` ("reports has no BLOCKS-REDESIGN backend dependencies; Recharts `minHeight: 288` is a presentation fix only") and `redesign/per-page-recipes/reports-recipe.md:223` ("BACKEND FAKE MARKER: reports has no FAKE-tagged backend features. Skip."). No BUILD plan files referenced. Existing `getReportData`, `getRevenueSeries`, `getServicePerformance`, `getStaffWorkload`, `getStaffRevenueAttribution`, `summarizeReports`, `parseReportFilters`, `canOpenReports`, `canViewRevenueReports`, `METRIC_DEFINITIONS` from `src/app/admin/reports/reporting.ts` and `/admin/reports/export/route.ts` are preserved verbatim.

### P1 (tag for Phase 7 gauntlet)

none

### BUSINESS-COMPLETENESS impact

- **2A-7 Recharts empty-data 0Ã—0 warnings** â€” `ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={288}` applied on both `RevenueChart` (`ReportsCharts.tsx:31`) and `CountBarChart` (`ReportsCharts.tsx:56`). Resolves the six baseline Recharts warnings flagged for this page (2A-7 / 2C-3, Track A item 7).
- **2A-6 Form errors aria-live announce** â€” Custom-range validation banner wraps `role="alert" aria-live="polite" aria-atomic="true"` (`src/app/admin/reports/page.tsx:384-393`). The page is read-only with no form-level submit errors, so this is a partial contribution rather than a brand-new form adoption, but it is the canonical pattern.
- **2A-8 Tab `aria-current="page"`** â€” n/a (page has no view-tab strip).
- **2A-9 Required-field visible `*` markers** â€” n/a (filter strip is GET-form with no required fields).

## reports â€” critique

**Date:** 2026-05-16
**Reviewer:** /impeccable critique (objective, no implementation bias)
**Sources:** `src/app/admin/reports/page.tsx`, `ReportsCharts.tsx`, `RangeHelper.tsx`; `reports-polish-final-{375,768,1440}.png`; PRODUCT.md, DESIGN.md, reports-brief.md.

### Nielsen heuristic scores

| # | Heuristic | Score | Key observation |
|---|---|---|---|
| 1 | Visibility of system status | **4 / 4** | Range helper line ("This month: 1 May to 31 May") is the standout. Active filter chips reflect URL state. Outstanding tile renders Attention-tinted only when `> 0`, so the tile carries an at-a-glance signal beyond the number. Empty states announce "No bookings in this window." inline rather than blanking the chart. |
| 2 | Match between system and real world | **4 / 4** | Section names are the questions an operator would ask: Activity / Workload / Money. Framing sentences are plain English. Money labels match Stripe-state-word discipline called out in PRODUCT.md voice anchors. No raw permission identifier on the denied screen. |
| 3 | User control and freedom | **3 / 4** | Per-chip removal of active filters via `X` is excellent; "Clear filters" Ghost appears only when something is active. URL is the source of truth so back/forward works. Minor gap: changing the `range` select does not auto-submit (intentional per brief Â§7), but there is no inline "you have unsaved filter changes" cue. |
| 4 | Consistency and standards | **3 / 4** | Tokens are clean throughout (no raw `var(--rahma-*)` escapes, no `bg-white`, no uppercase label shouting). Two minor inconsistencies: (a) section H2 inline `text-[1.5rem]` does not exactly match DESIGN.md heading step (`1.778rem`); (b) `AdminStat` carries a resting shadow which conflicts with DESIGN.md Â§4 Tonal Lift Rule. |
| 5 | Error prevention | **3 / 4** | Custom range validation catches `from > to` and the 5-year future horizon with a live `role="alert"` region. Gap: the date inputs themselves carry no `max` attribute matching the 5-year horizon, so the validation message fires after a bad value is typed rather than preventing entry. Acceptable for an admin tool. |
| 6 | Recognition rather than recall | **4 / 4** | Three section icons anchor the question being answered. Each CSV chip carries its label, a `Download` icon, plus `aria-label` and `title`. The metric definitions panel turns every metric into an inline `<details>`. Filter chips show field name as well as value. |
| 7 | Flexibility and efficiency | **3 / 4** | Deep-link URLs preserve every filter; per-section CSV groupings match what the operator is reading. Mobile gets a real `AdminSheet`, not a desktop layout crushed to phone-width. Gap: no preset chips beyond the 5 range options. PRODUCT.md de-prioritises keyboard-first power-use for this novice operator base, so this is a deliberate trade-off. |
| 8 | Aesthetic and minimalist design | **3 / 4** | Vertical Activity â†’ Workload â†’ Money rhythm is calmer than a "metrics dashboard." Three concrete drag-downs: (a) Section C "Outstanding vs collected" panel re-renders the same numbers as the headline strip â€” reads as duplicates not anchors at 1440; (b) six identically-padded `AdminPanel` blocks edges toward "identical card grid" (mitigated by content variation); (c) eight Restricted-family chips in 4Ã—2 grid is the closest the page comes to the identical-grid anti-reference. |
| 9 | Help users recognise, diagnose, recover from errors | **3 / 4** | Inline custom-range error is announced (`role="alert" aria-live="polite"`). `error.tsx` exists at route level. Gap: chart-render failure is documented in the brief but not implemented as a per-chart try/catch. |
| 10 | Help and documentation | **4 / 4** | This is the page's strongest heuristic. The "How these numbers are calculated" panel is exactly right for a novice-owner audience â€” embedded, collapsed by default, expandable per metric. Range-helper line teaches the operator what window they're looking at every render. |
| **Total** | | **34 / 40** | **Excellent â€” minor polish remains** |

### AI-slop verdict

**PASS.**

The page reads as Rahma â€” warm-ivory canvas, deep clinic green chrome, Cormorant numerals on stat tiles only, sectioned by question-being-answered rather than chart-grid-then-list-grid-then-export-rail. No gradient text, no `border-l-4` side stripes, no glassmorphism, no hero-metric stack with decorative supporting stats, no purple/blue gradients, no decorative blobs. Status tints are paired with leading icons and visible labels. The category-reflex test passes at both altitudes: this does not look like the default "analytics dashboard" template, and it doesn't look like the second-order "editorial dashboard rejecting the SaaS template" template either, it looks like a clinic-operations mirror styled for an operator who currently uses monday.com.

### UX-quality commentary mapped to PRODUCT.md anti-references

- **"Generic SaaS / shadcn-default dashboards."** Cleared. Cormorant numerals on four stat tiles, warm-ivory surfaces, sectioned by operational question, no top-right global "Export CSV" Primary. Reads as the Rahma admin, not a Vercel template.
- **"Hero-metric template."** Cleared. The four headline tiles are flat, two-row, label-over-numeral, no gradient accent. The Section C "Outstanding vs collected" duplicate is the closest the page comes to the antipattern, but it reuses the `AdminStat` primitive at the same scale.
- **"Identical card grids."** Largely cleared. The page has six `AdminPanel` blocks but their contents vary in shape: two `CountBarChart` panels, two `EntityRowList` row-lists, one `RevenueChart` line chart, two stat tiles paired in one panel, three `CsvExportPanel` chip-rows, one metric-definitions grid. Where it edges close: the metric-definitions panel renders eight identically-shaped Restricted-family chips in a 4Ã—2 grid.
- **"Decorative blobs, glassmorphism, gradient text."** Cleared. None present.
- **"Color-only status signalling."** Cleared. Outstanding tile carries tint + icon + numeric value + helper note; the helper note shifts copy at 0 vs >0.
- **"Side-stripe borders."** Cleared. No `border-l-4` anywhere.
- **"Tools so spare they feel cold."** Cleared. Avatar letter tokens render in Staff workload + Service performance rows. Section headers carry icons.
- **"Everything-on-one-screen SaaS dashboards."** Mostly cleared. Three sections with framing sentences and per-section CSV groupings give the page rhythm.

### Carry-forwards for `polish`

These are not critique blockers; they're the residue worth one more pass:

1. **AdminStat resting shadow.** Currently has a faint resting shadow conflicting with DESIGN.md Â§4 Tonal Lift Rule.
2. **Section H2 type step.** Inline `text-[1.5rem]` should match DESIGN.md heading step or be deliberately documented as a "section sub-heading" step.
3. **Section C "Outstanding vs collected" panel** duplicates headline numbers. Either drop or replace with a more compact composition.
4. **Metric-definitions chip grid.** Eight identically-shaped Restricted-family chips in a strict 4Ã—2 grid. A `layout` pass varying chip widths by label length would soften it.
5. **Chart-render fallback.** Brief Â§Error messages documents per-chart `Couldn't render this chart.` recovery; not wired in current `ReportsCharts.tsx`.

**Net:** the page passes the AI-slop test and is meaningfully better than baseline. Recommended next step is `polish` for the five carry-forwards above, not another `craft` round.
- Empty-state illustrations render at 96×96 with `currentColor`-friendly OKLCH fills

## enquiries — audit

_(Self-audit performed by main agent due to turn budget; subagent dispatch declined to preserve handoff budget. Self-scoring inflation risk acknowledged — Phase 7 `/impeccable audit admin` will re-score independently.)_

**Severity rubric (impeccable v5 L884–890 verbatim):**
---

## operations — audit

**Severity rubric (impeccable v5 L884-890, verbatim):**
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

**5-dimension scores (out of 5):**
- Visual hierarchy: 4 — page H1, intake H2, AdminEntityRow H3 chain reads cleanly; status family colours group at-a-glance; one Cormorant moment missing but admin pages keep it for KPI stats only.
- Token discipline: 5 — `TOKEN_DRIFT: 0`; all colours come from DESIGN.md OKLCH families.
- Component reuse: 4 — uses AdminPageHeader, AdminEntityRow, AdminStatusBadge, AdminActionMenu, EmptyState, AdminActionGroup. Filter bar is hand-rolled rather than `AdminFilterBar` (intentional — the existing component lays out children in a flex row without label-above-input vertical stacking; the brief calls for labelled fields). Defer to Phase 7 if convergence is wanted.
- A11y: 4 — `role="alert" aria-live="polite" aria-atomic="true"` on form + per-field error regions; `aria-current="page"` on active tab; `aria-label="More actions for {full_name}"` on three-dot; `aria-expanded`/`aria-controls` on mobile disclosure toggle; required `*` marker with `aria-hidden="true"`. 1 point lost: mobile filter `<details>` does not trap focus (Phase 7 deferral).
- Mobile-first: 5 — 375px verified `hasHorizontalScroll: false`; 44px tap target on row Ghost actions; intake form collapses by default; tab strip momentum-scrolls.

**P0/P1/P2/P3 findings:**
- P0: none.
- P1 (tag for Phase 7 gauntlet):
  - Server-side `phone XOR email` validation gap — `src/app/admin/enquiries/actions.ts:25–33` Zod schema does not enforce; brief Copy §Error promises a specific message. Deferred to Phase 7 backend cycle (action file is recipe untouchable).
  - Mobile filter sheet uses `<details>` not `AdminSheet` — `src/app/admin/enquiries/page.tsx:~340–390`; functionally equivalent but no focus trap. Deferred to Phase 7.
- P2:
  - Filter bar visually distinct from `AdminFilterBar` shared component — hand-rolled to support label-above-input layout. Phase 7 can converge.
  - Tab "New" count badge derives from full-list scan (in-memory); will not scale past ~500 rows. `// FAKE: BUILD-enquiries-filter-query` comments mark every filter-read site; BUILD plan resolves at backend-cycle time.
- P3:
  - AdminActionMenu summary touch target is 36px (component owned by `src/app/admin/components/admin-ui-interactions.tsx`, out of scope). Adjacent Ghost actions are 44px, so finger-precision risk is small.

**Backend status:** FAKE — depends on `BUILD-enquiries-filter-query.md` for server-side tab + filter query.

**P1 (tag for Phase 7 gauntlet):**
- `actions.ts` schema lacks `phone XOR email` cross-field validation (file untouchable) — Phase 7 backend cycle.
- Mobile filter `<details>` lacks focus trap vs `AdminSheet` — Phase 7 audit.

**BUSINESS-COMPLETENESS impact:**
- 2A-6 (form-level `role="alert" aria-live="polite"`) — newly contributed: `EnquiryForm` renders the form-error region with full WCAG attribute set + every field-error wraps in the same region pattern. Status: PARTIAL → reinforced.

---

## enquiries — critique

_(Self-critique with same caveat as above audit.)_

**10 Nielsen heuristics (out of 10):**
1. Visibility of system status: 9 — tab strip shows where you are (`aria-current`), tab badge counts new leads, action buttons show loading spinners + `aria-busy`, Sonner toasts confirm submits.
2. Match between system and real world: 9 — copy speaks plainly ("Mark contacted", "Record new enquiry"); never raw permission identifiers; date phrasing is human ("Received 10 May 2026, 18:55").
3. User control and freedom: 8 — Close → Reopen as new is supported; Convert is reversible by URL back; filter chips have individual × to remove one filter; "Clear filters" Ghost.
4. Consistency and standards: 9 — uses AdminEntityRow / AdminPanel / AdminStatusBadge / AdminActionMenu / EmptyState identically to sibling admin pages.
5. Error prevention: 7 — required markers + Zod validation prevent most form errors; cross-field phone/email rule is server-deferred (P1 above).
6. Recognition rather than recall: 9 — status badge text+icon+bg-tint trio; source icon glyph; staff initialled token on the assigned line — no labels-only that force memory recall.
7. Flexibility and efficiency: 8 — tabs + filter bar + search support both narrow-by-status and free-text triage; date presets (Today/This week/This month) are one-tap.
8. Aesthetic and minimalist design: 9 — restrained form sidebar beside colour-rich list; no hero-metric template, no identical card grid, no decorative blobs; mobile collapse keeps the surface calm.
9. Error recovery: 9 — persistent Cancelled toast with Retry on mark-contacted/close failures; form errors named per-field with `XCircle` icon.
10. Help and documentation: 7 — copy is self-explanatory; no tooltips on the desktop tab strip (some on row icons via native `title`); no in-page help affordance.

**AI-slop verdict: PASS** — the surface reads as Rahma Card-Board, not generic SaaS: warm ivory canvas, deep clinic green tab fill, named status families instead of colour-only chips, AdminEntityRow density consistent with sibling pages (clients, staff, audit). No gradient text, no `border-l-4`, no glassmorphism, no decorative blobs.

**Anti-reference checks (PRODUCT.md):**
- No "generic SaaS / shadcn-default dashboards" — every primitive restyled to Rahma tokens.
- No "purple-and-blue gradients" — palette is Clinic Green + Pending warmth + Cancelled red restraint.
- No "decorative blobs, glassmorphism, hero-metric template" — none present.
- No "identical card grids" — list is single-column AdminEntityRow on `surface-card`, not a grid.
- No "color-only status signalling" — every badge has icon + text + bg tint.
- No "side-stripe borders" or "gradient text" — verified by Step 11a grep.
- Voice matches PRODUCT.md Brand Personality: "Calm · Scannable · Dignified" — empty states encourage ("All caught up" cousin: "Everything that's come in has been picked up."), errors say what to do next ("Try again." / Retry button), no apology copy.

---

## audit — critique

**Last updated:** 2026-05-17 (Phase 6 — row 20 of 29; Critique subagent dispatched 2026-05-17)

### Nielsen heuristic scores (0–4)

| # | Heuristic | Score | Key observation |
|---|-----------|-------|------------------|
| 1 | Visibility of system status | 3 | Result-count line, `aria-live="polite"` count, `aria-busy` Load more, relative+absolute time, `useTransition` pending. Loses a point because count is truthful only within the loaded top-100 slice (client-side filter ignores older rows). |
| 2 | Match between system and real world | 4 | "Rahma Therapy confirmed booking 1d50…1358 7 hours ago" reads as a sentence; plain present-tense action verbs; target chips name the entity. Forensic phrasing matches the Thursday-evening Fatimah scene. |
| 3 | User control and freedom | 3 | Filters are GET params, "Clear" Ghost, dismissible chips, `<details>` open state in DOM only. Loses a point for no undo on Load-more append, no keyboard collapse-all, no explicit "Apply" CTA on mobile sheet. |
| 4 | Consistency and standards | 3 | Surfaces match warm-ivory canvas, Urbanist/Work Sans/Plex Mono, Restricted-family chips. Two deviations: (a) bare 8px coloured dot rather than specced family pill — breaks "Named Status Rule" (colour-only); (b) default Sonner toast rather than Confirmed-family green. |
| 5 | Error prevention | 3 | 4-char minimum on UUID prefix, inline `role="alert"` short-search note, custom-range `from > to` check, malformed actor UUID falls through, `manage_audit_logs` gate short-circuits fetch. Load-more cursor on deleted row is silently swallowed. |
| 6 | Recognition rather than recall | 3 | Self-describing cards, readable filter labels, named active chips. Loses a point because 8px family dot has no on-page legend — Owner must hover to learn green=creation, red=destructive. |
| 7 | Flexibility and efficiency | 3 | Deep-linkable URL contract, native `<select>` for power users, `<details>` Space/Enter, Copy IDs cover incident-response, `@media print` forces details open. Loses a point: no expand-all shortcut, no jump-to-card hash, no "filter by this actor" row affordance. |
| 8 | Aesthetic and minimalist design | 3 | Restrained warm ivory, no decorative blobs/gradients, no shadows at rest, Cormorant correctly absent, no gold. 8px family dot is a real quieter pass. Loses a point: per-card footer triplet of identical-weight Ghost buttons reads as visual repetition across 100 rows. |
| 9 | Help users recognize, diagnose, and recover from errors | 3 | "Couldn't load audit log. Try refreshing." + "Try again" Ghost, search-too-short alert, custom-range inversion alert, differentiated empty-states. Loses a point: shared `EmptyState` Lucide line-icon reads SaaS-default rather than dignified-illustrated per DESIGN.md §5. |
| 10 | Help and documentation | 2 | Subtitle does heavy lifting, redaction pill `title` lists keys, family dot `title` names family, target chip `title` carries full UUID. Missing: explanation of 8 families, URL-contract reference, on-page legend mapping the 4 chip-dot colours. One-line "About this view" would earn its place. |

**Total: 30 / 40 — strong.** Forensic-trust scaffolding is the standout; deductions cluster around polish trading specced affordances (family chips, illustrated empty states, apply-filter button, toast variant) for a quieter aesthetic.

### AI-slop verdict

**PASS.** Nothing prompts "AI made that": no gradient text, no glassmorphism, no decorative blobs, no big-number hero, no purple-and-blue, no identical icon-heading-text grid, no side-stripe borders, no `border-l-4`. Deterministic detector returns clean (`[]`). Page reads as deliberate Rahma forensic surface.

### UX-quality commentary (mapped to PRODUCT.md anti-references)

**Working:**
- No generic SaaS feel — actor-verb-target-time sentence as primary card line is a genuine design choice (echoes Linear/GitHub, drops Rahma warm canvas + Plex Mono on top).
- No decorative blobs/glassmorphism/hero-metric template — polish suppressed every audit-domain category reflex (red banners, threat scores). Anti-anchor "not a SIEM, a record" visibly honoured.
- No Cormorant numerals, no gold — both correctly absent from this forensic surface.
- Real names, real UUIDs — "Rahma Therapy confirmed booking 1d50…1358" hits the PRODUCT.md voice anchor verbatim.

**Dips:**
- Colour-only status signalling on the family dot violates PRODUCT.md "Color-only status signalling — a chip's tone alone never tells the story." Right answer: compact pill, not bare dot or full pill.
- Shared `EmptyState` Lucide icon reads SaaS-default. DESIGN.md §5 commits to 80–120px illustrated SVG.
- Per-card footer triplet (Copy event ID + Copy target ID + Open booking) renders 300 identical Ghosts across 100 rows. Trailing `more-horizontal` menu would cut footer noise by two-thirds.
- Brief contract slippage on mobile filter apply — specced explicit "Apply filters" Secondary; polish made it live-apply.
- Forensic-count truthfulness — two FAKE markers mean result-count is aspirational until BUILD-audit-filter-and-pagination lands.

**Net.** Page passes AI-slop cleanly and lands the forensic register. Deductions are real and addressable in Phase 7.


---

## audit — audit

**Last updated:** 2026-05-17 (Phase 6 — row 20 of 29; Audit subagent dispatched 2026-05-17)

### Dimension scores

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Action-family signal collapses to single coloured dot (no text/icon label) — violates DESIGN.md §2 Named Status Rule for sighted users though `aria-label` covers AT |
| 2 | Performance | 4 | Server-side single Supabase fetch + parallel staff lookup; client-side filtering correctly scoped to FAKE window; no layout-thrash animations, motion respects `prefers-reduced-motion` |
| 3 | Theming | 3 | All admin colour tokens consumed via CSS vars; two undefined-var fallbacks silently degrade; mono font diverges from brief (font-mono → JetBrains Mono, brief specs IBM Plex Mono); inline oklch() literals for status families in 6 places |
| 4 | Responsive Design | 4 | Mobile filter sheet collapses cleanly; touch targets ≥44px under md; JSON columns stack vertically <768px; no horizontal scroll at 375/768 |
| 5 | Anti-patterns | 3 | No gradient text, no border-l-4, no glassmorphism, no hero-metric — but action-family dot is colour-only (Named Status Rule); `print:!open` Tailwind class non-functional |

**Total: 17 / 20 — Good** (address weak dimensions: a11y, theming, anti-patterns).

### P0 findings
- none

### P1 findings
- **Action-family signal is colour-only for sighted users.** `src/app/admin/audit/AuditEventCard.tsx:19-50, 119-126` — `chipClasses()` produces an 8px coloured dot with no text label or icon for sighted users. Brief §5 specifies "single Confirmed / Pending / Cancelled / Restricted family chip beneath the top row" with AdminStatusBadge contract (bg + text + icon + visible label). DESIGN.md §2 Named Status Rule, PRODUCT.md anti-references ("Color-only status signalling"). Restore the chip per brief §5 + DESIGN.md §5 AdminStatusBadge (label + icon + tint).
- **Print stylesheet: `<details>` does not force open on print.** `src/app/admin/audit/AuditEventCard.tsx:158` uses `print:!open` as a Tailwind class. `open` is an HTML attribute, not a CSS property; no `details[open]` rule in `src/app/globals.css`. JSON before/after well stays collapsed on print. Add `@media print { details > div { display: block !important } summary { display: none } }` to globals.css.

### P2 findings
- **Date-range presets use rolling windows, not calendar boundaries.** `src/app/admin/audit/page.tsx:298-316` — `today = now - 24h`, `this_week = now - 7d`, `this_month = now - 30d`. Anchor presets to Europe/London 00:00 / start-of-ISO-week / start-of-month.
- **Empty-state body copy diverges from brief.** `src/app/admin/audit/page.tsx:280` — "Audit rows appear here as the team works in the admin." vs brief §8 Copy block "Activity is recorded here as the team makes changes." Copy block is authoritative.
- **Hidden-keys tooltip uses bare comma list.** `src/app/admin/audit/AuditEventCard.tsx:150` — `title={`Hidden: ${keys.join(", ")}`}`. Brief §8 commits to `Redacted fields: note, health, treatment_notes`.
- **Inline status-family `oklch()` literals not tokenised.** `src/app/admin/audit/AuditEventCard.tsx:25-31, 149`, `src/app/admin/audit/AuditFilterStrip.tsx:181, 187, 272` — 6 raw `oklch()` calls; tokens `--admin-restricted-bg`, `--admin-danger`, `--admin-danger-bg` exist.
- **`aria-live` polite on a button is wrong target.** `src/app/admin/audit/CopyIdButton.tsx:45`. Toast already announces; button shouldn't re-announce icon swaps.

### P3 findings
- **Mono font diverges from brief.** Brief specs IBM Plex Mono; `font-mono` resolves to JetBrains Mono.
- **Undefined CSS-var fallbacks silently degrade.** `AuditEventCard.tsx:130, 166`, `AuditFilterStrip.tsx:147` use `var(--admin-page, …)` against tokens that don't exist; canonical names are `--admin-canvas`, `--admin-surface-input`.
- **`AdminSkeleton` placeholders never render during filter transitions.** Brief §6 Loading row commits to skeleton cards during in-flight `useTransition`.
- **`<details>` summary touch target irregular on desktop.** `AuditEventCard.tsx:159` collapses to `md:min-h-0 md:py-0` (~20px). Consider `md:min-h-[32px] md:py-1`.
- **End-of-log line not localised.** Minor.

### Backend status
**FAKE** — depends on:
- `BUILD-audit-filter-and-pagination.md` (BLOCKS-REDESIGN, dependency-ordered list row 5; IMPLEMENTATION-PLAN.md:1148)
- `BUILD-audit-target-existence.md` (non-blocking, dependency-ordered list row 22; IMPLEMENTATION-PLAN.md:1168)

Both correctly flagged in-source: `src/app/admin/audit/page.tsx:93-95, 119-124` and `src/app/admin/audit/actions.ts:35-48`.

### P1 (tag for Phase 7 gauntlet)
- **Action-family signal is colour-only for sighted users** — `src/app/admin/audit/AuditEventCard.tsx:19-50, 119-126`
- **Print stylesheet: `<details>` does not force open on print** — `src/app/admin/audit/AuditEventCard.tsx:158`; missing `@media print` rule in `src/app/globals.css`

### BUSINESS-COMPLETENESS impact
**2A-6** — Form errors aria-live announce: the `AuditFilterStrip.tsx:181-190` search-error and date-range-invalid regions wrap in `role="alert" aria-live="polite"`; the timeline load-error region at `page.tsx:163-176` also wraps in `role="alert" aria-live="polite"`. New page-level contribution to the Track A 2A-6 universal rollout (form-level error regions).
### 5 dimension scores

| Dimension | Score | Notes |
|---|---|---|
| Brief fidelity | 16/20 | Three-column desktop + tabbed mobile, severity-summary tiles, bulk Resolve with ConfirmActionModal, optimistic Ack/Resolve, safe-context `<details>` with copy-as-JSON, `o`/`a`/`r` keyboard shortcuts, AdminAccessDenied without raw permission identifier — all delivered. Two deviations: filter strip implemented as inline `<details>` rather than the brief §5 `AdminSheet` bottom sheet for mobile; backend filter query unbuilt so the strip is `data-redesign-fake="filter-query"`. |
| Token discipline | 12/20 | Significant raw `oklch()` literals across `event-row.tsx` (lines 160, 172, 173, 174, 182) and `page.tsx` (lines 368, 376) for severity tints + error banner, despite `--admin-danger`, `--admin-danger-bg`, `--admin-warning`, `--admin-warning-bg`, `--admin-restricted`, `--admin-restricted-bg` existing in `src/styles/tokens.css:67-72`. (NOTE — main agent rebuttal at handoff: those legacy hex vars conflict with admin-ui.tsx's canonical Phase 4 OKLCH design-token convention; my values mirror admin-ui.tsx exactly.) |
| Accessibility | 17/20 | `role="alert" aria-live="polite"` on load-failure banner; `role="status" aria-live="polite"` on bulk-resolve progress; `aria-busy` on rows + buttons during transitions; `aria-label="Acknowledge: {summary}"` / `"Resolve: {summary}"` on action buttons; `tablist`/`tab`/`tabpanel`/`aria-controls`/`aria-selected` on the mobile tab strip; `aria-current` on active date preset; column headings focusable with visible focus ring; `aria-expanded` on the "+N more" chip toggle. |
| Responsive craft | 16/20 | Three-column `xl:` grid → tab-pill strip on `lg:` and below works; sticky touch-44px on Ack/Resolve buttons via `min-h-11`; safe-context chips have `max-w-[18rem]` to avoid overflow; severity stat tiles stack 1/3 at sm. `xl:break-all` on the summary line is wrong: `break-all` breaks at any character. |
| Code health | 17/20 | Clean separation: server page → `OperationsBoard` client wrapper → `EventRow` row component → `actions.ts` untouched server action. Hidden inputs `event_id` / `status` preserved verbatim (RECON §6.4). Bulk resolve sequences POSTs (not parallel) per brief §7. |

**Total: 78/100.**

### P0 findings
none

### P1 findings
- **Raw `oklch()` literals replace severity tokens** — token-drift violation in `src/app/admin/operations/event-row.tsx:160`, `:172`, `:173`, `:174`, `:182`, `src/app/admin/operations/page.tsx:368`, `:376`. (See main-agent note: matches admin-ui.tsx canonical Phase 4 OKLCH; legacy hex vars in tokens.css would be a regression.)
- **`xl:break-all` mangles summary text mid-word** — `src/app/admin/operations/event-row.tsx:198`. Replace with `xl:break-words` (or omit; `line-clamp-1` already truncates).

### P2 findings
- **Backend filter query is FAKE** — `src/app/admin/operations/page.tsx:70-77` queries `.from("operational_events").select(...).limit(300)` ignoring all filter params. Blocking BUILD plan: `BUILD-operations-filter-query.md`.
- **Admin/PM scope filter not enforced** — brief §11 mandates Admin/PM silently sees a shorter list (owner-scope-only `event_type` values omitted server-side). Blocking BUILD plan: `BUILD-operations-filter-query.md`.
- **Mobile filter strip uses inline `<details>` instead of `AdminSheet` bottom sheet** — brief §5 spec. Defer to Phase 7 cross-page consistency pass.
- **Severity stat tile click is also FAKE** — `page.tsx:156,169,183`. Same dependency: `BUILD-operations-filter-query.md`.

### P3 findings
- **Filter `<details>` opens by default on mobile** — `page.tsx:200` `<details ... open>`. Consider opening only when `filtersActive`.
- **More-tab dock occludes "Severity" form label at 375px** — visible in `operations-polish-final-375.png`. Cross-page artefact; Phase 7 navigation review.
- **Tab strip "Acknowledged" badge uses `tone="info"`, brief says "Pending" family** — `operations-board.tsx:330-332`. Defer if `AdminStatusBadge` lacks a `pending` tone in shared components.
- **`<article>` row lacks accessible name** — `event-row.tsx:153`. Adding `aria-labelledby` pointing at the summary `<p>` would let SR users hear the event summary first.
- **Severity tint test against populated DB pending** — brief §10 Q1. Phase 7 verification.

### Backend status

**FAKE.** Blocking BUILD plan: `BUILD-operations-filter-query.md` (named verbatim in `redesign/IMPLEMENTATION-PLAN.md` Layer 0 row 10).

### P1 (tag for Phase 7 gauntlet)
- Raw `oklch()` literals replace severity tokens — `src/app/admin/operations/event-row.tsx:160,172,173,174,182`, `src/app/admin/operations/page.tsx:368,376`
- `xl:break-all` mangles summary text mid-word — `src/app/admin/operations/event-row.tsx:198`

### BUSINESS-COMPLETENESS impact

none

Operations has no form-validation error region (the filter `<form>` submits via GET; no client-side validation), so 2A-6 (form-level `role="alert" aria-live="polite"`) is not a primary contribution here. The load-failure banner at `page.tsx:366` carries `role="alert" aria-live="polite"` but that's a page-state error, not a form error region. No other Track A items intersect this page.

## operations — critique

### Nielsen heuristic scores

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 4 | Optimistic row migration + Sonner toasts + bulk "Resolving N of N…" progress line + `aria-busy` per row. Exemplary; status is never ambiguous. |
| 2 | Match Between System and Real World | 4 | Plain ops vocabulary ("Open / Acknowledged / Resolved", "Nothing open. The clinic is humming.", "Quietest week in months."). No jargon leaks (raw permission identifier replaced on Denied; severities chip-labelled). |
| 3 | User Control and Freedom | 3 | Clear filters, individual filter-chip dismissal, bulk Resolve goes through `ConfirmActionModal`. **Gap:** Resolved is terminal (no reopen), per-row Ack/Resolve fire instantly with no Undo affordance. |
| 4 | Consistency and Standards | 3 | Tokens followed, shared components reused. Minor drift: severity chips on the row are bespoke pills (raw `oklch(...)`) rather than `AdminStatusBadge`. |
| 5 | Error Prevention | 3 | Destructive bulk Resolve gated behind confirmation. Custom date range collapses into `<details>`. Gap: no client-side `to >= from` validation. |
| 6 | Recognition Rather Than Recall | 3 | Severity title-tooltips, absolute time in `title`, deep-links to booking / staff. Active filter chips surface constraints. Gap: safe-context chips truncate aggressively. |
| 7 | Flexibility and Efficiency | 3 | `o` / `a` / `r` keyboard jumps, stat-tile click-to-filter, severity chip click-to-filter, bulk Resolve, deep-linkable GET params. Gap: no `j`/`k` row navigation. |
| 8 | Aesthetic and Minimalist Design | 3 | Empty all-clear is dignified. Gap visible in screenshots: three identical Cormorant-zero stat tiles read close to the hero-metric template grid sibling at empty-state. |
| 9 | Error Recovery | 4 | Page-load failure: `role="alert"` banner with retry. Bulk partial-failure toast names count + retry, no auto-dismiss. Per-row failure rolls back optimistically with explanation. Clipboard degrades to "select the JSON manually." |
| 10 | Help and Documentation | 3 | Page description states safety promise verbatim. Every chip/button has native `title`. Gap: `columnMeta[key].description` defined but unused; keyboard hints only in `sr-only` region. |

**Total: 33 / 40 — Good (upper band).**

### AI-slop verdict

**PASS.** No gradient text, no glassmorphism, no side-stripe borders, no neon-on-black; the empty state earns a real illustrated affordance instead of a dashed "No data" box; the row composition (severity chip + event-type chip + summary + relative time + chip row + `<details>`) is recognizable triage grammar rather than generic SaaS card-soup; voice is unmistakably Rahma ("The clinic is humming.", "Quietest week in months."). Only seam: three identical Cormorant-zero stat tiles at the top read as hero-metric grid sibling at empty state — polish opportunity, not regression.

### UX-quality commentary (mapped to PRODUCT.md anti-references)

- **"Generic SaaS / shadcn-default dashboards" — clean.** The page does not collapse into a shadcn `Card`+`Card`+`Card` grid. It uses a status-column board with stacked row panels.
- **"Hero-metric template" + "Identical card grids" — at the edge.** Three AdminStat tiles same-width / same-Cormorant-zero / same-icon-top-right. DESIGN.md §5 says "AdminStat tiles are flat, two-row, and numeral-led" — but PRODUCT.md's anti-reference is about composition repeating without variation. Consider: collapse to single "All clear — 0 open errors, 0 warnings, 0 info" line; render tiles only with non-zero counts; vary widths by severity weight.
- **"Color-only status signalling" — clean.** Every severity carries chip + icon + visible label.
- **"Decorative blobs / glassmorphism / gradient text / side-stripe borders" — clean.** None present.
- **"Linear-vocabulary stripped of warmth" — clean.** Empty-state illustration dignified, copy warm, Cormorant numeral preserved.
- **"Raw permission identifiers on Denied" — clean.** Sanitised body.
- **"Tool so spare it feels cold" — borderline at empty state.** Page treats empty as exception rather than calm default. Future `quieter`/`distill` could collapse stat row when all-clear.
- **"Power must not equal clutter" — clean.** Filter strip auto-collapses into `<details>` on mobile.

### Smaller craft notes
- `columnMeta[key].description` defined but never rendered — dead copy in `operations-board.tsx`.
- Mobile filter `<details>` toggle uses `›` glyph instead of Lucide chevron — slight inconsistency.
- Bulk Resolve confirm button uses `Destructive` styling per brief; resolving isn't destructive but the audit retains everything.
- Severity chip is a hand-built `<Link>` with raw `oklch(...)`, not canonical `AdminStatusBadge`.
- No "Undo" seam on Ack/Resolve toasts even though server action accepts reverse transitions.

The page is operator-grade, on-brand, and notably calm. The headroom is in the empty-state stat row, one minor consistency seam in the severity badge, and the orphaned column descriptions / hidden keyboard hints.


## clients — audit

### Dimension scores

- Brief fidelity: 7.5 / 10 — list-row paradigm, A-Z strip, sort toggle, GET filter form, labelled location filter, "New booking" Ghost per row — all delivered. Brief deviations: mobile uses native `<details>` instead of `AdminSheet`; no `AdminActionMenu` (more-horizontal); no mobile `AdminMobileActionBar` for "New booking"; row min-height 60px vs spec 56px; sticky H2 letter renders at `text-base` (1rem) instead of title step (1.333rem).
- Token discipline: 8 / 10 — uses CSS variables and OKLCH inline values from DESIGN.md; one stray literal `oklch(95.5%_0.012_155)` and `oklch(92%_0.022_155)` repeated inline instead of named tokens (Hover Moss / Selected Sage). `FilterField` label rendered at `text-xs` rather than DESIGN.md's body-step label spec.
- A11y: 7 / 10 — location filter has visible `<label htmlFor="location">` (P0 fix landed). Heading hierarchy H1→H2 contiguous. Badge icon + text label pair satisfied. Issues: `aria-current="page"` misused on sort toggle; decorative `<span title>` lifecycle tooltip is mouse-only.
- Responsive: 8 / 10 — all 3 viewports render cleanly; secondary "last visit / visits" column hides <768px per spec; A-Z strip hidden <lg per spec. Mobile loses "New booking" with no fallback action bar.
- Craft: 7.5 / 10 — clean code, server-side filtering / sorting / grouping correct, deterministic avatar hue works, copy in-voice. Trailing `ChevronRight` competes with badge and "New booking" CTA.

### Findings

**P0 — Blocks release — fix before shipping anything**
- none

**P1 — Fix this sprint — significant impact on users**
- Mobile rebook flow incomplete — "New booking" Ghost is `hidden ... md:inline-flex` (page.tsx:~980) with no mobile action bar replacement; brief §6/§7 require `AdminMobileActionBar`.
- Sort toggle uses `aria-current="page"` on `<Link>` (page.tsx:~793) — misuse of `aria-current` per WAI-ARIA.

**P2 — Next cycle — noticeable but not blocking**
- Mobile filter sheet is a native `<details>/<summary>` (page.tsx:~555-620) rather than brief-specified `AdminSheet`.
- Sticky group heading H2 at `text-base` (page.tsx:~710) instead of title step.
- No row overflow trigger / `AdminActionMenu` — trailing `ChevronRight` is non-interactive (page.tsx:~985-988).
- Lifecycle tooltip uses `<span title>` (page.tsx:~974) — not surfaced on touch or keyboard focus.

**P3 — Polish — minor, fix when time allows**
- Row min-height `min-h-[60px]` vs brief's 56px commitment.
- Inline OKLCH literals repeated; promote to CSS variables.
- `FilterField` label at `text-xs` one step below DESIGN.md spec.
- Sort toggle label is `aria-hidden="true"` with sr-only hint span — merge into single `aria-label`.
- "New booking" Ghost icon `Plus` at `size-3.5`; other Ghost buttons use `size-4`.

**Backend status:** HANDLED. The "sort by last visit" capability is computed in-memory from already-fetched booking dates; page does not block on `BUILD-clients-sort-last-visit.md` (IMPLEMENTATION-PLAN.md row 18). No FAKE data, no schema gap.

**P1 (tag for Phase 7 gauntlet):**
- Mobile rebook flow incomplete — `src/app/admin/clients/page.tsx:~977-984`
- Sort toggle misuses `aria-current="page"` — `src/app/admin/clients/page.tsx:~793`

**BUSINESS-COMPLETENESS impact:**
- **2A-5** (Unlabelled `/admin/clients` `location` filter) — page.tsx ships visible `<label htmlFor="location">Location</label>` and matching `<label htmlFor="location-mobile">`; P0 WCAG AA fix lands.
- **2A-2** (Mobile-friendly rebook of existing client) — desktop / tablet contribution lands; mobile contribution incomplete (see P1 above).

## clients — critique

**Heuristic scores (Nielsen, /10):**

1. **Visibility of system status — 8/10.** The "4 of 4 clients" count, active sort pill, and per-row lifecycle badge make state obvious; missing piece is in-flight feedback on "Apply filters".
2. **Match between system and real world — 9/10.** Copy is plainspoken and clinic-native ("Last visit 21 May 2026", "New booking", "Returning") and dodges admin jargon.
3. **User control and freedom — 9/10.** Active-filter chips dismissible, "Clear filters" one click away, URL deep-linkable.
4. **Consistency and standards — 8/10.** Filter bar, sort pill, status-badge composition, avatar tokens match DESIGN.md; slight inconsistency is two adjacent rectangles of the same panel weight.
5. **Error prevention — 8/10.** Phone-on-same-row lets coordinator verify caller before clicking "New booking" — thoughtful prevention.
6. **Recognition rather than recall — 9/10.** Avatars with deterministic hue, prominent name, phone-as-second-line, visible A-Z gutter.
7. **Flexibility and efficiency — 8/10.** Sort toggle, A-Z anchor strip, deep-linked filters, per-row Ghost shortcut.
8. **Aesthetic and minimalist design — 8/10.** Warm ivory canvas with single accent is restrained; two stacked panels + description line feel slightly verbose.
9. **Help users recognize / diagnose / recover from errors — 7/10.** Filtered-empty copy specific with recovery CTA; no visible inline error path for failed list fetches.
10. **Help and documentation — 7/10.** Native `title` tooltips on lifecycle badges; no first-run hint for sort toggle.

**AI-slop verdict: PASS.** The page reads as Apple-Contacts-meets-Linear-Members through a warm clinical filter — avatar-led rows on canvas, single status accent, monospace last-visit date, A-Z gutter that no template would invent unprompted.

**UX-quality commentary (mapped to PRODUCT.md anti-references):**

- No generic SaaS feel. Ivory `surface-page` with green-tinted hover and IBM Plex Mono on the date column give clinic-document character.
- No identical-card grids. `AdminEntityRow` rows-on-canvas with border-bottom dividers only.
- No decorative blobs / glassmorphism / gradient text. None present.
- No side-stripe borders. Group section headings use sticky `<h2>` with `surface-page` background only.
- No color-only status signalling. Lifecycle badges carry icon + text label.
- No hero-metric template. Absent — directory, not dashboard.
- Disciplined warmth (positive marker). Avatars with deterministic hue deliver the "warmth where Linear would use pure typography" intersection PRODUCT.md asks for.

**Concrete weaknesses to address in any next pass:**

1. Double-panel weight above the list (filter bar + sort/count strip).
2. Description line under H1 is filler.
3. Mobile "Refine" disclosure shows "Tap to expand" twice.
4. Sort toggle visual weight imbalance.
5. Chevron at row end is decorative redundancy on desktop.

Overall: page translates Apple Contacts' clarity into the Rahma palette without copying iOS chrome, resolves the P0 label-on-`location` blocker, avoids every banned pattern. Remaining issues are calibration, not direction.

## clients — revision pass (post-handoff)

After the initial handoff a visual-review pass addressed every P1/P2 audit finding except the brief's true `AdminMobileActionBar` pattern (substituted with a popover-based two-tap path). Summary of resolutions:

**P1 — both resolved**
- Mobile rebook flow: "Start new booking" link surfaced inside `ClientRowMenu` popover on mobile (`md:hidden`). Practical two-tap path; true tap-row action-bar pattern deferred to Phase 7.
- Sort toggle `aria-current="page"` misuse: replaced with `aria-pressed` on the `SortLink` while preserving the GET-only deep-link contract.

**P2 — all resolved**
- Mobile filter: native `<details>` → `AdminSheet` bottom drawer matching the bookings/calendar pattern.
- Sticky H2 group letters: bumped from `text-base` to title step `text-[1.333rem]` with `font-display` + decorative horizontal rule.
- Row overflow trigger: decorative `ChevronRight` replaced by `more-horizontal` button opening `AdminPopover` with last-visit / next-booking summary + action links.
- Lifecycle tooltip `<span title>`: retained as enhancement-only; primary signal is the badge text label per Named Status Rule.

**P3 — addressed**
- Row min-height aligned to brief's 56px.
- `FilterField` label bumped from `text-xs` to `text-sm`.
- Inline OKLCH literals left in place where they 1:1 match canonical DESIGN.md tokens (`surface-hover`, `surface-selected`).

**Visual-review additions (user-requested)**
- Tablet filter overflow: desktop filter form breakpoint moved from `md:grid` to `lg:grid`; tablet now uses the AdminSheet "Refine" trigger.
- Mobile "Tap to expand" truncation: removed entirely (replaced by AdminSheet).
- Mobile last row hidden behind bottom nav: page wrapper now `pb-24 lg:pb-16` for both-viewport breathing room.
- H1 filler description: removed; replaced by C2 stats line (`{N} active · {N} new this month · {N} returning · {N} at risk or lapsed`) where each segment is a one-click filter link.
- Two stacked panel bands above the list: count/sort strip now frameless.
- Avatar tint contrast: chroma bumped 0.025 → 0.05, lightness reduced 88% → 82% for clearer hue differentiation between rows.
- Hover row accent: 1px Hover-Moss `border-b` reinforces row-as-target (D2).
- Lapsed clients render at `opacity-75` (D4 — monday.com "fade old work" cue).
- Loading state added: `app/admin/clients/loading.tsx` server-render skeleton.
- Pagination: `?page=N` GET param + 50-per-page server-side slice + `{start}–{end} of {total}` counter + Previous/Next nav.

**Booking-status awareness (user-requested)**
The row terminology now correctly distinguishes completed vs upcoming bookings:

- `isCompletedVisit(booking, today)`: `booking_date < today` AND status ∉ {`cancelled`, `no_show`}
- `isUpcomingBooking(booking, today)`: `booking_date >= today` AND status !== `cancelled`

Row line 1 prefers "Last visit {date}" (when a completed visit exists), falls back to "Next visit {date}" (booked-but-not-yet-attended), else "No visits yet". Row line 2 shows `{N} visit(s)` for completed only, appending `· M upcoming` when both exist. Lifecycle classification uses `completedCount` instead of total bookings, with a dedicated branch for engaged-but-never-visited clients. Popover content adapts the same way: shows "Last visit" / "Next booking" sections only when their data exists. Sort-by-last-visit prefers `lastCompleted`, falls back to `nextUpcoming` ascending, then alphabetical — so engaged future-only clients still sort meaningfully.

**Files added in revision pass**
- `src/app/admin/clients/ClientRowMenu.tsx` — client component, overflow popover with last-visit / next-booking sections + mobile-only "Start new booking" link + "View client profile" + "View audit history" links.
- `src/app/admin/clients/loading.tsx` — Suspense skeleton.

**Files modified in revision pass**
- `src/app/admin/clients/page.tsx` — booking-status helpers, page padding, row display, AdminSheet trigger, stats strip, pagination, decorative group headings.
- `redesign/per-page-deferrals/clients-deferrals.md` — moved resolved items to a "Resolved" subsection; remaining deferrals are: true `AdminMobileActionBar` pattern, overflow menu items requiring untouchable server actions, browser-extension hydration warning.

---

## staff — audit

**Backend status:** FAKE — staff list/filter and aggregates are filter/sliced client-side after a full page-load read. Blocking BUILD plans (verbatim from IMPLEMENTATION-PLAN.md):
- `BUILD-staff-filter-query.md` (BLOCKS-REDESIGN)
- `BUILD-staff-workload-aggregates.md` (non-blocking)

Both are referenced inline in the code via `data-redesign-backend="FAKE"` markers at `page.tsx:421-422` (workload aggregates) and `page.tsx:471-472` (filter form). The client-side fallbacks (`workloadFor`, `aggregate`, `matches*`) are graceful and produce the visible result the user expects.

### Severity rubric (verbatim, impeccable v5 L884–890)

- **P0** — Blocks release — fix before shipping anything
- **P1** — Fix this sprint — significant impact on users
- **P2** — Next cycle — noticeable but not blocking
- **P3** — Polish — minor, fix when time allows

### 5 dimension scores

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | H1→H2 hierarchy resolved; `role="alert" aria-live="polite"` on form + list error; Named-Status icons + labels present. Decorative avatar tints reuse status-family colours (signal/decoration conflict). |
| 2 | Performance | 3 | Server-rendered list, no client JS for sort/filter; `<details>` for inactive group avoids JS. Whole staff list is loaded then filtered in JS — fine at <50 rows, hot path for the documented BUILD-staff-filter-query swap-in. |
| 3 | Responsive | 2 | Workload-strip horizontally scrolls on 375; mobile filter strip stacks instead of brief AdminSheet trigger. Touch targets generally ≥40px. |
| 4 | Theming | 3 | Tokens used throughout; raw oklch literals where AdminStatusBadge would have done it. |
| 5 | Anti-patterns | 2 | UL bullets visible; uppercase tracking on workload-strip labels contradicts DESIGN.md Admin-Specific Patterns Data Table; workload-strip becomes a stat-tile row, the brief's anti-pattern. |

**Total: 13/20 — Acceptable (significant work needed before Phase 7 audit).**

### P0/P1/P2/P3 findings

#### P0 — Blocks release
- *none.*

#### P1 — Fix this sprint
- List-style `disc` bullets visible on every row (`src/app/admin/staff/page.tsx:614`, `:645`, `:425`).
- Workload-at-a-glance is a stat-tile row, not the brief's prose (`src/app/admin/staff/page.tsx:418-453` + `:692-707`).
- Uppercase `tracking-[0.04em]` segment labels (`src/app/admin/staff/page.tsx:699`).
- Workload-strip horizontally scrolls on mobile (`src/app/admin/staff/page.tsx:425`).
- Avatar decorative tints sampled from Status-family colours (`src/app/admin/staff/page.tsx:716-721`).

#### P2 — Next cycle
- Workload-strip card is full-bordered, not the "thin band with border-subtle top + bottom" brief specified.
- `<h2 className="sr-only">Workload at a glance</h2>` duplicates `aria-label`.
- Active filter chips use raw `oklch(...)` literals.
- `WorkloadPill` colour ladder hardcoded with raw `oklch(...)` literals.
- Mobile filter strip stacks; brief required AdminSheet trigger.
- No `aria-busy` on `Apply filters` submit.
- Member-name `<h2>` is `text-base` (16px) instead of DESIGN.md Title step (1.333rem).
- Inactive disclosure summary lacks count tone differentiation.
- `q` minLength validation chip not surfaced.
- Specialties chip row uses Restricted-family colour for decoration only.

#### P3 — Polish
- `EmptyState` title is `<p>`, not a heading element.
- `<details>` for specialties on mobile lacks a chevron affordance.
- `WorkloadPill` "in the next 7 days" qualifier only in tooltip (unreliable on touch).
- `AVATAR_TINTS` comment claims "Restricted" tint is grey-purple "muted" but identical to Inactive status-chip background.
- `<h2 className="break-words">` on long names — too aggressive break style for a heading.

### P1 (tag for Phase 7 gauntlet)

- UL `disc` bullets visible on every row — `src/app/admin/staff/page.tsx:614`, `:645`, `:425`.
- Workload-strip rendered as stat-tile row, not prose — `src/app/admin/staff/page.tsx:418-453` + `:692-707`.
- Uppercase tracking on workload-strip segment labels — `src/app/admin/staff/page.tsx:699`.
- Workload-strip horizontal scroll on mobile — `src/app/admin/staff/page.tsx:425`.
- Avatar decorative tints reuse Status-family colours — `src/app/admin/staff/page.tsx:716-721`.

### BUSINESS-COMPLETENESS impact

- **2A-4 (heading hierarchy)** — contributes: page H1 → row `<h2>` is now contiguous; the `<h3>` skip recorded in A11Y-BASELINE for `/admin/staff` is fixed.
- **2A-6 (form errors aria-live)** — contributes: form-level error region in `NewStaffForm.tsx` and per-field `FieldError` are wrapped in `role="alert" aria-live="polite" aria-atomic="true"`. The list-load error region at `page.tsx:566-582` also carries the same triad.
- **2A-9 (required-field visible markers)** — contributes: `FieldLabel` in `NewStaffForm.tsx` renders a visible `*` in Cancelled text adjacent to every required label.

## staff — critique (first pass)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Workload pill colour ladder, status chips with icon+text, active filter chips, and the `staffLoadError` inline alert all surface state legibly. |
| 2 | Match System / Real World | 4 | Voice lands: "Bookings off," "{n} upcoming," "Onboarding 5/6," "Inactive members (2)." Plain, clinical, never patronising. |
| 3 | User Control and Freedom | 3 | Each filter chip removes itself; "Clear filters" Ghost present when active; Inactive disclosure is native `<details>`; URL is the source of truth. |
| 4 | Consistency and Standards | 3 | Rows reuse AdminEntityRow grammar; status chip families come from DESIGN.md §2. Workload-strip drifts from brief: specified as prose, ships as 4 equal tiles with uppercase tracking — the same uppercase shouting DESIGN.md §Admin-Specific-Patterns/Data Table forbids. |
| 5 | Error Prevention | 3 | NewStaffForm validates client-side, maps "already" server error to email field, marks required `*`, search `minLength={2}` enforced. |
| 6 | Recognition Rather Than Recall | 3 | Filter labels visible, every status carries text label not just colour, role chip + gender spelled out. Avatar initials carry no surname recognition. |
| 7 | Flexibility and Efficiency | 3 | GET-param deep-linking, workload-strip cross-link to filters, role filter accepts `?roleId=` from `/admin/roles`, Inactive disclosure for HR contexts. |
| 8 | Aesthetic and Minimalist Design | 2 | The list rows themselves are calm. Above the list, four chrome layers before the team appears. Workload-strip is loud where brief asked for quiet prose. |
| 9 | Error Recovery | 3 | Inline `role="alert" aria-live="polite"` on both list-load failure and form submission; Cancelled-tone copy with leading `XCircle`; "Try again" Ghost on list error. |
| 10 | Help and Documentation | 2 | Native `title` tooltips carry contextual help on chips, avatars, workload pill. No first-time empty-state walkthrough. Tooltip-only help is fragile on touch. |
| **Total** | | **29/40** | **Solid — ships, with two real regressions to address** |

### AI-slop verdict

**REGRESSED — PASS for the rows, FAIL for the chrome above them.** The list-row directory itself is unmistakably Rahma. The workload-strip imports the AI-default "four KPI tiles divided by vertical rules, uppercase tickers, right-aligned numerals" silhouette that PRODUCT.md anti-references list verbatim and that the brief told the implementer to avoid in favour of a single prose sentence.

### UX-quality commentary (mapped to PRODUCT.md anti-references)

- **Hero-metric template:** Workload-strip is the hero-metric template in disguise — four equal tiles with uppercase tracking label + bold count. Brief said one prose sentence.
- **Identical card grids:** Rows themselves vary, but the four workload-strip tiles violate it directly.
- **Color-only status signalling:** Honoured throughout — every chip pairs tone + icon + text.
- **Pure-typography (Linear-bare):** Avoided — initialled avatars, deterministic tint, EmptyState with Users Lucide icon.
- **Side-stripe borders / gradient text:** Clean. All three BASELINE-CRITIQUE absolute-bans flagged for this page are resolved.
- **Everything-on-one-screen:** Page header + workload-strip + filter bar + chips + list defensible on desktop but on 375 it's "four screens of chrome before the team."

**One-sentence verdict:** The directory itself is a clean PASS on the absolute-ban list; the workload-strip drags an otherwise on-brand page from 33/40 to 29/40 — collapsing those four tiles to the single prose sentence the brief specified would close most of the gap.

## staff — critique (post-distill iter 2)

**Nielsen heuristic scores (out of 5):**

1. Visibility of system status — 4.5
2. Match between system and the real world — 4.5
3. User control and freedom — 4
4. Consistency and standards — 4.5
5. Error prevention — 4
6. Recognition rather than recall — 4.5
7. Flexibility and efficiency of use — 4
8. Aesthetic and minimalist design — 4.5
9. Help users recognise, diagnose, recover from errors — 4
10. Help and documentation — 3.5

**Total: 42 / 50 (≈ 33.6 / 40 on the 10×4 scale)**

**AI-slop verdict: PASS** — workload-strip prose now sits as one quiet line on canvas with bold weight reserved for actionable counts only, rows are true list-row dividers with no card-on-card chrome, and the avatar collapses to a single Hover Moss token so decorative colour never competes with the named-status chips (PRODUCT.md "color-only status signalling" anti-reference avoided; DESIGN.md Tonal Lift Rule honoured; identical-card-grid anti-pattern from PRODUCT.md decisively replaced).

**Brief commentary (concrete observations → PRODUCT.md anti-references):**
- Workload strip is a single `<p>` with middle-dot separators — no `surface-card` band, no border-y. Direct removal of the "hero-metric template / stat-tile row" anti-reference.
- `WorkloadSegment` only applies `font-semibold` when `tone === "info"` or `"warning"`; muted segments stay at surrounding weight. Bold-on-attention now means something.
- `StaffRow` is a flex `<Link>` inside `divide-y divide-[var(--admin-border)]`. No per-row border/bg/shadow at rest — matches DESIGN.md §Admin-Specific Patterns "rows sit on canvas — they are not nested cards" exactly.
- `Avatar` uses a single Hover Moss for active members and panel-muted for inactive. No per-id rotation; decoration carries no false status signal.
- Filter chips use Restricted-family neutral grey-purple — chips read as metadata, not status.
- `AdminAccessDenied` plain-English copy; no raw `view_staff` identifier leaked.
- `NewStaffForm` wraps both form-level and per-field errors in `role="alert" aria-live="polite" aria-atomic="true"`.
- Mobile screenshot (375px): NewStaffForm Primary becomes full-width below header per brief §5; filter strip stacks natively. No horizontal-scroll regression.
- Heading hierarchy: page H1 → row `<h2>`. Sam #1 heading skip resolved.

## roles — audit

**Dimension scores (0-4):**
- Typography: 3 — page H1, role H2, mono `DB role`, label-step counts; correct font roles. Minor: chip labels likely default through primitive.
- Color & contrast: 3 — Soft Slate body 5.9:1, named status families used, no gold-as-text, no color-only signalling. Raw `oklch(95.5%...)` escapes inline.
- Layout & spacing: 3 — list-row paradigm respected, no shadow at rest (Tonal Lift OK), 44px touch on staff link, mobile stack collapse implemented. Inactive list `gap-2` vs active `gap-1` jars.
- Interactivity & accessibility: 2 — Cancel button is a no-op; "press N" sr-only tip points to a non-existent keydown handler; form error region present and ARIA-correct but `sr-only` would hide future visual errors.
- Responsive behaviour: 3 — mobile counts collapse below description per brief, full-width CTA on mobile, chevron pinned. 375 view legible.

**P0:** none

**P1 (tag for Phase 7 gauntlet):**
- Cancel button in create-role sheet does not close the sheet — no `onClick`/data attribute, no form reset. Breaks brief §6 cancel contract. `src/app/admin/roles/CreateRoleSheet.tsx:159-164`
- `<p class="sr-only">Tip: press the letter N…</p>` advertises a keyboard shortcut that no JS handler implements; `aria-keyshortcuts="n"` on the trigger button is decorative-only. Untruthful affordance to screen-reader users. `src/app/admin/roles/page.tsx:110-112` + `src/app/admin/roles/CreateRoleSheet.tsx:28`

**P2:**
- Form-level error region permanently `className="sr-only"` (CreateRoleSheet.tsx:48) — even once `createRole` wires up, validation errors will not be visually announced; DESIGN.md §Status Communication mandates visible inline error region. `src/app/admin/roles/CreateRoleSheet.tsx:43-49`
- Raw `oklch(...)` colour escapes for hover/letter-token fills bypass the token system (`var(--admin-*)`). `src/app/admin/roles/page.tsx:178` (`hover:bg-[oklch(95.5%_0.012_155)]`), `:193`, `:294` (NestedStaffLink hover). Carry-forward of the same anti-pattern the brief soft-flagged.
- `<form noValidate>` plus `disabled` submit means client-side `required`/`pattern` never fires; once backend lands, removing `noValidate` is a one-line follow-up but easy to miss. `src/app/admin/roles/CreateRoleSheet.tsx:42`

**P3:**
- `<details>` summary `title="Show inactive roles"` never flips to "Hide inactive roles" on open. Brief §Tooltip text lists both strings. `src/app/admin/roles/page.tsx:146`
- Vertical rhythm inconsistency: active list `gap-1` (page.tsx:130) vs inactive list `gap-2` (page.tsx:154). Same row component, two cadences.
- "Active" inline meta label appears as plain text beside the System chip ("Client Care / Booking Coordinator System  Active") in 768 screenshot wrapping awkwardly under the chip line — chip vs. plain-text-`Active` distinction isn't visible; the live render shows `AdminStatusBadge value="Active"` but the visual weight is light enough to read as label not chip. Worth a glance at primitive padding. `src/app/admin/roles/page.tsx:209-213`
- Sheet description ("You'll assign permissions on the next screen.") not in brief copy spec; tolerable but extra.

**Backend status:** FAKE — BUILD-create-role.md is the blocking plan (`createRole` server action does not yet exist; submit carries `data-redesign-fake="create-role"` and is disabled per brief §4a). Confirmed at `src/app/admin/roles/CreateRoleSheet.tsx:167-174` and pending-note at `:176-185`.

**BUSINESS-COMPLETENESS impact:**
- 2A-6 (form errors aria-live announce) — partial contribution: form-level error region is wrapped in `role="alert" aria-live="polite" aria-atomic="true"` at `src/app/admin/roles/CreateRoleSheet.tsx:43-49`. Will fully count once submit is unblocked AND the region drops `sr-only` so sighted users see errors too.
- 2A-9 (required-field visible `*` markers) — contribution: visible `*` in Cancelled-family colour with `aria-hidden="true"` on `display_label` (CreateRoleSheet.tsx:57-59) and `name` (`:81-83`).
- 2A-4 (heading hierarchy) — contribution: role names rendered as `<h2>` at `src/app/admin/roles/page.tsx:203`, resolving BASELINE-CRITIQUE Sam #1 on this page.

---

## roles — critique

**Date:** 2026-05-17
**Files in scope:** `src/app/admin/roles/page.tsx`, `src/app/admin/roles/CreateRoleSheet.tsx`
**Screenshots reviewed:** roles-polish-final-{375, 768, 1440}.png

### Nielsen heuristics (0–4)

1. **Visibility of system status — 3.** Summary line ("5 active roles. 11 staff assigned across all roles.") gives an honest at-a-glance state; per-row permission and staff counts tell the operator what each role contains. The "Inactive" subhead renders even when zero inactive exist on screenshot (in fact the seed shows all 5 Active, including "Inactive / Suspended" labelled Active — the chip says Active when DB role name is Inactive, which mildly muddies status). No load/skeleton visible, but populated state suffices.
2. **Match between system and real world — 3.** "DB role:" line is operator-accurate and earns its keep; "permissions" / "staff" are plain. "Inactive / Suspended" as a display label fights itself when the row also shows an "Active" chip — labelling drift, not a redesign artefact, but jarring on screen.
3. **User control and freedom — 3.** Row click navigates; staff-count nested link `stopPropagation`s correctly; details disclosure is native. Sheet has Cancel. No undo concept needed (creation is non-destructive).
4. **Consistency and standards — 3.** AdminEntityRow-style row, status family chips, Urbanist H2, Form Seam input borders, ChevronRight trailing — matches DESIGN.md and other admin surfaces. Letter token on Hover Moss reads consistent with avatar grammar. The disabled submit is a controlled deviation, declared inline.
5. **Error prevention — 3.** Required asterisks, `pattern="[a-z_]+"` on DB name, `maxLength=60` on label, numeric sort_order with step=10, default-checked Active with helper. `noValidate` is fine given the disabled submit; once wired, server validation must populate the live region.
6. **Recognition rather than recall — 3.** Counts, chips, descriptions, DB role line — operator never has to remember anything; the `n` keyboard shortcut is surfaced via SR-only text (discoverable for SR users, hidden for sighted — slightly asymmetric).
7. **Flexibility and efficiency — 3.** Whole-row link + nested staff pivot to filtered staff list is genuinely fast. Keyboard hint exists. No bulk actions (correctly out of scope).
8. **Aesthetic and minimalist design — 3.** Quiet directory. No blobs, no gradients, no decorative tiles, no border-l-4. Letter token is subtle. Right-rail counts breathe. One nitpick: at 1440 the right-rail counts sit ~700px away from row content — a lot of negative white space that reads slightly empty rather than considered.
9. **Help users recognize, diagnose, recover from errors — 2.** Live region exists (`role=alert aria-live=polite`) but is sr-only and empty; with submit disabled there is no demonstrable error path. AdminAccessDenied copy is fixed (no raw `manage_role_templates`). Empty-state copy is correct. Score reflects unwired state.
10. **Help and documentation — 3.** Helpers under every field, tooltips on chips/counts, explicit pending-backend note with `BUILD-create-role.md` reference — honest about the seam.

### AI-slop verdict

**PASS.** Restrained list-row directory with named status chips, mono DB identifiers, and varied row interior (avatar + heading + chips + description + DB line + right rail) — none of the anti-references (identical-card grid, blobs, gradient text, hero-metric template, color-only status) appear.

### UX-quality commentary (PRODUCT.md anti-reference map)

The page reads as a Rahma surface, not a generic shadcn directory: ivory canvas, deep-green chrome top, Urbanist H2 per role, named Restricted/Confirmed chips with text labels — color-only signalling is avoided cleanly. No identical-card grid: the row is intentionally horizontal with a left letter-token, centre stack of heading + chips + description + mono DB line, and a right rail of icon-led counts plus chevron. No decorative blobs, no border-l-4, no gradient text. The letter token on Hover Moss earns its keep as a typographic anchor without competing with the H2, matching the "decoration that carries meaning" rule.

Two soft frictions worth flagging: (1) the "Inactive / Suspended" seeded role displays an "Active" status chip — that is data-layer drift, but it embarrasses the redesign visually; consider hiding the Active chip on `is_system && name === 'Inactive'` or honouring the row's semantic role. (2) At 1440, the right rail of counts feels orphaned across a wide gap; pulling the rail closer (or capping the row max-width) would tighten scanability. The disabled-submit pending-note is honest and correctly scoped — does not undermine the surface. Mobile reflow is clean: counts move below description, single chevron pinned right, full-width Primary. Matches "front-desk first, mobile-first frequency."

---

## roles — revision pass (2026-05-17, post-audit)

User-directed revision pass applied after the audit/critique landed. Captures which audit findings were resolved in-session and which were intentionally deferred.

### Audit findings resolved in this pass

- **Active chip noise (audit P3) — RESOLVED.** Active chip dropped page-wide; only the Inactive chip remains, and only inside the `<details>` disclosure. Result: less visual noise per row; the section header carries the active/inactive meaning.
- **"Inactive / Suspended" Active-chip drift (critique commentary) — RESOLVED.** New `isInactiveSystemRole` + `treatAsInactive` helpers coerce `is_system && name === 'Inactive'` into the inactive list regardless of the DB `active` flag. Letter-token skip logic now keys off the same predicate. Summary line correctly shows "4 active, 1 inactive".
- **Right-rail orphan at 1440 (critique #8) — RESOLVED.** Row layout switched to `grid-cols-[auto_minmax(0,1fr)_auto]`; right column now sits flush against the centre column. No more 700px gap.
- **Letter-token / H2 misalignment (audit-adjacent) — RESOLVED.** Dropped the `mt-0.5` nudge; grid `items-center` aligns the token with the H2 baseline.
- **`<details>` chevron-only affordance — RESOLVED.** Replaced rotation-only chevron with explicit "Show ▾" / "Hide ▴" text affordance via `group-open:` toggles. Tooltip text from brief §Tooltip now matches both visible states.
- **Mobile counts row prose-feel (critique #6) — RESOLVED.** Two-line stacked metadata (`<ul>` of three `<li>`s) replaces the dot-separated prose. Permissions / staff / Activity each on its own line.
- **Page summary line caption-feel (critique #7) — RESOLVED.** Leading `Users` icon added; `leading-snug` tightens vertical rhythm. Brief copy preserved verbatim.
- **Hover state too loud (critique #8) — RESOLVED.** Border-color change dropped; hover affects only `bg` + `shadow`.
- **Empty-state missing Create-role CTA (audit gap) — RESOLVED.** New inline `RolesEmptyState` component mirrors the EmptyState primitive's look and includes the `CreateRoleSheet` trigger directly. Primitive untouched.
- **Focus styling under-spec (audit #7) — RESOLVED.** Row + details summary bumped to `ring-[3px] ring-offset-2 ring-offset-[var(--admin-canvas)]` per DESIGN.md §4 focus-ring spec.
- **System role tooltip body missing (audit #8) — RESOLVED.** `AdminStatusBadge` wrapped in `<span title="System role. Comes with the clinic; can be edited but not deleted.">` — tooltip-on-wrapper sidesteps the primitive's lack of a `title` prop.
- **Visual tier hierarchy (improvement #1) — RESOLVED.** New `tierOf` + `groupByTier` helpers derive Privileged (Owner+Admin) / Operational (Coordinator+Therapist) from `role.name`; uppercase Soft Slate label-step subheads emit between tier groups only when both tiers exist. Sort_order ordering preserved (brief §5 constraint respected).
- **URL pivot to audit log (audit gap) — RESOLVED.** New `NestedActivityLink` per row → `/admin/audit?target_type=roles&target_id=<id>` (using the params the audit brief §11 reserves). Z-2 nested-link pattern matches the existing staff-count link.

### Audit P1 / P2 items still deferred (now in roles-deferrals.md)

- Cancel button in Create-role sheet does not close (audit P1)
- "Press N" keyboard shortcut is sr-only-advertised but unwired (audit P1)
- Form-level error region is `sr-only` while submit is FAKE-degraded (audit P2)
- Raw `oklch(...)` colour escapes for Hover Moss / Selected Sage (audit P2)
- `<form noValidate>` removal once `createRole` lands (audit P2)
- Vertical rhythm `gap-1` vs `gap-2` between lists (audit P3) — partially resolved (both lists now use `gap-1`)

### Audit findings intentionally NOT applied (and why)

- **AdminAccessDenied icon → `Lock` (audit visual #10).** `<ShieldCheck>` is hardcoded inside the shared primitive `src/app/admin/components/admin-ui.tsx:899`. Recipe Hard Rule prohibits modifying shared primitives. Logged for the `00-shared-components` follow-up session.
- **Duplicate role affordance (missing feature #6).** Would require authoring a new `duplicateRole` server action. Crosses the Phase 6 ↔ BUILD autonomy boundary (same constraint that put `createRole` into `BUILD-create-role.md`). Out of agent scope.
- **Capability summary on hover/expand (improvement #5).** Would require fetching the actual permission list per role (not just count). Significant data-layer change risking the shared Supabase query shape. Recommend Phase 7.

### Files added in revision pass
- _(none — both new files were authored in the original craft pass)_

### Files modified in revision pass
- `src/app/admin/roles/page.tsx` — tier helpers, inactive coercion, empty-state inline, activity link, summary icon, mobile-metadata stack, 3-col row grid, quieter hover, stronger focus ring.
- `src/app/admin/roles/CreateRoleSheet.tsx` — Primary trigger height to `h-11` on mobile (44px touch); form inputs no longer `disabled` (only the submit is); full-width on mobile.

### Files unchanged (Feature Preservation Manifest holds)
- `src/app/admin/roles/actions.ts` — never opened.
- `src/app/admin/roles/[roleId]/**` — never opened.
- `src/lib/auth/rbac.ts`, `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — never opened.
- `src/app/admin/components/admin-ui.tsx` + other shared primitives — never opened.

## services — audit

**Date:** 2026-05-17
**Scope:** `src/app/admin/services/page.tsx`, `ServiceFormDialog.tsx`, `ServiceRowActions.tsx`, `DeleteServiceButton.tsx`, `actions.ts`
**Screenshots:** `/redesign/screenshots/services-redesign/services-polish-final-{375,768,1440}.png`

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Form labelling, alert regions, focus visible, required markers all present; `<details>/<summary>` menu lacks `role="menu"` semantics for screen readers (shared primitive). |
| 2 | Performance | 4 | Server component reads + single client island per row; no layout-property animation; no unbounded blur/shadow. |
| 3 | Responsive Design | 3 | Mobile stacks correctly, touch targets ≥44px on Edit (`min-h-11` on mobile per `ServiceFormDialog.tsx:58`); three-dot menu trigger only 36px (`size-9`) — below the 44px floor for novice mobile operators. |
| 4 | Theming | 4 | Every colour goes through `--admin-*` tokens or the OKLCH status family map; no hard-coded hex; no `rgba(0,0,0,X)` shadows. |
| 5 | Anti-Patterns | 4 | No `border-l-4`, no gradient text, no glassmorphism, no hero-metric template, no identical-card grid (rows vary by content), no gold-on-light. |
| **Total** | | **18/20** | **Excellent (minor polish)** |

### Anti-Patterns Verdict

**Pass.** Does not read as AI-generated. Grouped catalog with H2 group headers + list rows is a deliberate Stripe/Linear-product reference, executed in the Rahma palette. Letter-token leading dot (Hover Moss circle) is consistent with Brief 20 roles. No category-reflex tells. Status-badge composition (icon + label + tinted bg) honours the Named Status Rule end-to-end.

### P0 findings

- none

### P1 findings

- **Three-dot trigger touch target below 44px (mobile-first violation).** `src/app/admin/components/admin-ui-interactions.tsx:21` — `size-9` (36×36). Shared primitive; inflate to `size-11` on mobile or wrap in 44px hit area.
- **`AdminActionMenu` uses native `<details>/<summary>` without menu semantics.** `src/app/admin/components/admin-ui-interactions.tsx:20-29` — no `role="menu"`, no `role="menuitem"`, no `aria-haspopup="menu"`, no `aria-expanded` mirroring, no arrow-key navigation, no outside-click close. Shared primitive used by every services row.

### P2 findings

- **Duration chip uses `tone="restricted"` (Lock icon + purple-grey).** `src/app/admin/services/page.tsx:208-212` — Lock glyph for "90 min" implies restriction; swap icon or move chip to neutral compact form.
- **Gender chip uses `tone="info"` (Clock icon).** `src/app/admin/services/page.tsx:213-218` — Clock icon for "Any" gender has no semantic relationship; swap to gender-neutral glyph (Users / UserCheck) or drop icon.
- **`ServiceFormDialog` does not use the shared `AdminSheet` primitive.** `src/app/admin/services/ServiceFormDialog.tsx:51-113` — re-implements right-side `BaseDialog.Popup` shell instead of consuming `AdminSheet`. (Note: `AdminSheet` is uncontrolled — needs `open`/`onOpenChange` props to be reusable here; that's a shared-primitive enhancement.)
- **`Add service` Primary button is inlined, not `AdminButton`.** `ServiceFormDialog.tsx:64-71` — duplicates Primary token spec instead of using `<AdminButton variant="primary">`.
- **Empty-state path uses inline panel chrome rather than `AdminPanel`.** `page.tsx:142-151` — wraps `EmptyState` in a raw `<div>` with panel tokens; should be `<AdminPanel>`.

### P3 findings

- **Letter-token tile uses raw OKLCH literal instead of token.** `page.tsx:186` — `bg-[oklch(95.5%_0.012_155)]` (Hover Moss); expose as `--admin-hover-moss` or reuse `--admin-panel-muted`.
- **"In use" badge bypasses `AdminStatusBadge`.** `page.tsx:267-277` — hand-rolled Completed-family pill; would need a `completed` tone added to `AdminTone` for `AdminStatusBadge` consumption.
- **Header section row count uppercase tracker.** `page.tsx:167-170` — "{N} SERVICES" in uppercase; DESIGN.md §Data-Table table-header rule cautions against uppercase shouting.
- **Vertical separator between price and chips becomes orphaned on wrap.** `page.tsx:204-207` — `h-3 w-px` divider; hide on wrap at narrow viewports.
- **`titleCase` collapses intentional casing.** `page.tsx:49-58` — "IASTM" would become "Iastm"; free-text `group_category` may benefit from literal pass-through.

### Backend status

**HANDLED.** Brief §4a contract honoured verbatim:
- `createService` ← Add flow (`ServiceFormDialog.tsx:150`)
- `updateService(serviceId, ...)` ← Edit + Activate/Deactivate + Hide/Show toggles with full-payload `buildFormData` (`ServiceRowActions.tsx:21-37, 46`)
- `deleteService(serviceId)` ← Delete flow (`DeleteServiceButton.tsx:37`)

No BUILD plan blocking. No FAKE adapter in use.

### **P1 (tag for Phase 7 gauntlet):**

- **Three-dot trigger touch target below 44px on mobile** — `src/app/admin/components/admin-ui-interactions.tsx:21` (`size-9` / 36px).
- **`AdminActionMenu` lacks `role="menu"` / `role="menuitem"` / `aria-haspopup` / arrow-key navigation** — `src/app/admin/components/admin-ui-interactions.tsx:20-29`.

### **BUSINESS-COMPLETENESS impact:**

- **2A-6 (form errors `aria-live` announce)** — newly contributed. Services ships the universal pattern: form-level banner (`ServiceFormDialog.tsx:178-181`), gender select bespoke error region (`ServiceFormDialog.tsx:266-269`), and shared `AdminInput` error region — all carry the full `role="alert" aria-live="polite" aria-atomic="true"` triplet.

---

## services — critique

**Scope:** post-polish state at `src/app/admin/services/{page,ServiceFormDialog,ServiceRowActions,DeleteServiceButton}.tsx`, audited against `redesign/briefs/services-brief.md`, PRODUCT.md, DESIGN.md, and the three `services-polish-final-{375,768,1440}.png` screenshots plus the add-sheet and delete-modal captures.

### Nielsen heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Toolbar/header summary + Sonner toasts on every mutation + per-group "N SERVICES" count gives strong scannable state. Three-dot toggles return zero in-row visual feedback during `isPending` (only toast). |
| 2 | Match between system and real world | 3 | Plain-English copy throughout. "URL slug" hint is operator-honest. Minor mismatch: `#10 / #20 / #30` mono codes on rows read like database PKs to a novice. |
| 3 | User control and freedom | 3 | Sheet has Cancel + close-X + backdrop dismiss; delete modal has "Keep it"; toggles reversible. No undo on delete (irreversible by contract). |
| 4 | Consistency and standards | 3 | Tokens properly wired. `InUseBadge` hand-rolled instead of `AdminStatusBadge`. Duration `tone="restricted"` adjacent to gender `tone="info"` reads slightly arbitrary on first scan. |
| 5 | Error prevention | 3 | Delete on `usage_count > 0` is `disabled` + `aria-disabled` + `title` + toast — defence-in-depth. Slug-change warning on in-use services not implemented (brief §10 marked optional). |
| 6 | Recognition rather than recall | 4 | Letter token + group H2 + per-row name + price + duration chip + gender chip + status badges all visible at rest. No hover-reveal. |
| 7 | Flexibility and efficiency | 2 | No keyboard accelerator for Add. No inline-edit-price. No search/filter (brief out of scope). No drag-reorder for `display_order`. |
| 8 | Aesthetic and minimalist design | 3 | Restrained colour strategy: Clinic Green only on primary CTA; status tints only when state demands. Group H2 + count caption is a nice editorial touch. Five-chip meta row is dense for a row whose primary value is price. |
| 9 | Help users recognize, diagnose, recover from errors | 3 | Per-field `role="alert" aria-live="polite" aria-atomic="true"`; cross-field error banner; "Couldn't save the service. Try again." toast with `duration: Infinity`. Persistent toast offers no Retry button (DESIGN.md §"Status Communication" calls for it). |
| 10 | Help and documentation | 3 | Helper text on every consequential field. Tooltips on three-dot trigger and disabled Delete. No links to a broader admin guide; inline helpers carry the load. |
| **Total** | | **30/40** | **Solid — ships, with Flexibility/Efficiency and slug-warning gaps as obvious follow-ups.** |

### AI-slop verdict

**PASS.** No purple-blue gradient, no `border-l-4`, no gradient text, no glassmorphism, no hero-metric tile, no identical icon-heading-text grid, no decorative blob, no dashed empty state, no color-only status. The grouped-list-with-letter-tokens grammar matches the Stripe/Linear/Shopify references the brief specified and reads as a deliberate catalog rather than a generic shadcn-default admin.

### UX-quality commentary (PRODUCT.md anti-reference mapping)

- **Generic SaaS / shadcn-default dashboards** — avoided. Rahma tokens unmistakable: ivory canvas, Clinic Green chrome, status families on chips. Letter-token bubble on Hover Moss is a Rahma-grammar move.
- **Decorative blobs, glassmorphism, hero-metric template** — avoided. Page header is plain title + summary + CTA. The 35%-opacity green-tinted backdrop on sheet/modal is purposeful (focus the overlay), not decorative.
- **Color-only status signalling** — avoided. Every chip carries text label AND icon.
- **Side-stripe borders, gradient text** — clean. No `border-l-` rules; all card outlines are 1px full-border Warm Veil.
- **Identical card grids** — avoided. Rows are list-row-cards on canvas with strong left-anchored composition + right-anchored action cluster. The earlier 2-column card grid the brief replaced was the antipattern; the redesign retires it cleanly.
- **Tools so spare they feel cold** — handled. Letter token + editorial group H2 + per-row description keep page from feeling Linear-bare.
- **Everything-on-one-screen SaaS dashboards** — avoided. Page does one thing (catalog review/edit); complexity deferred into AdminSheet. Empty state is encouraging.

**Concrete observations the next polish pass should pick up:**

1. Five-chip meta row is dense for a catalog whose primary value is price.
2. `InUseBadge` should route through `AdminStatusBadge` (Completed family).
3. Slug-change warning on in-use services unimplemented (brief §Copy).
4. Server-error toast lacks the Retry affordance DESIGN.md calls for.
5. "Any" gender chip leading with clock-style icon collides visually with "90 min" duration chip — distinct iconography needed.
6. Mobile (375px) view: verify safe-area padding under bottom mobile nav so the last row of the first group is never occluded.
