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

## privacy — audit

### 5 Dimension Scores

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Touch target on Show more/Show less inside long-note disclosure was `min-h-8` (32px), below WCAG 2.5.5 floor on mobile (PrivacyRequestNote.tsx:41). Heading chain on mobile collapsed for sensitive-note rail (rail title was `<span>` not heading at <xl, page.tsx:513). Otherwise strong: alert region wired for queue load, form-level alerts wired (PrivacyFilterBar.tsx:335 / 348), `aria-busy` on form, dedicated `sr-only role="status" aria-live="polite"` for save announce (PrivacyStatusForm.tsx:157), `aria-pressed` on date chips, raw permission string sanitiser in AdminAccessDenied. |
| 2 | Performance | 4 | Server component fetches three queries with explicit `.returns<>()`, single grouping pass, no expensive layout animations. Client islands are scoped (filter bar, status form, note expand). Only motion is `transition-transform` / `transition-colors` (paint-only). No images requiring lazy-load. |
| 3 | Theming | 3 | Tokens used heavily (70 occurrences across 4 files) but six raw `oklch(...)` literals remain for the danger-family Cancelled error region and chip strip (page.tsx:393,395,398,403; PrivacyFilterBar.tsx:337,350,364; PrivacyStatusForm.tsx:79,109). DESIGN.md §2 defines `status-cancelled-bg/text` and `status-restricted-bg/text`; the redesign brief §4 explicitly carries forward raw `var(--rahma-*)` token escapes as a soft fix. These literals mirror admin-ui.tsx implementation pattern (codebase-canonical). |
| 4 | Responsive Design | 3 | xl-breakpoint 2-col then stacked single-col works; filter strip collapses to `AdminSheet` on `<md`; sensitive notes collapse to `<details>` on `<xl`; touch targets on Open client and Update status use `min-h-12 sm:min-h-9` (48 then 36px) which is correct. 375px screenshot showed the sticky bottom `AdminBottomNav` overlapping the Received panel summary; missing bottom padding to clear the bar (page.tsx top-level wrapper, no `pb-20` / `pb-24` for mobile). |
| 5 | Anti-Patterns | 4 | No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template (stat tiles are flat two-row), no identical card grid, no nested cards (rows sit on canvas inside the panel), no bounce easing. Cards vary across the page: stat tiles (numeral-led), status panels (`<details>`-grouped run), request rows (verbatim-quote block), sensitive notes list (sticky-note pictogram + line-clamp). No `border-l-4`. Cormorant only on numerals. |

**Total: 17 / 20 — Good (address weak dimensions).**

### P0 / P1 / P2 / P3 Findings

**P0 — Blocks release — fix before shipping anything**
- none

**P1 — Fix this sprint — significant impact on users**
- Bottom-nav occludes content on mobile — sticky `AdminBottomNav` overlapped the first status panel summary at 375px (visible in `redesign/screenshots/privacy-redesign/privacy-polish-final-375.png`). Category: Responsive. WCAG 1.4.10 reflow / functional obstruction. **FIXED in audit follow-up:** page.tsx wrapper bumped to `pb-24 sm:pb-0`.
- Touch target below 44px on long-note expand — `PrivacyRequestNote.tsx:41` used `min-h-8` (32px). The collapse toggle is the only way to see the full customer request quote; mobile-first operators tap this. **FIXED in audit follow-up:** `min-h-11 sm:min-h-8` applied.

**P2 — Next cycle — noticeable but not blocking**
- Six raw `oklch(...)` literals for the Cancelled / Restricted families bypass the named token system. Category: Theming. **Deferred** — codebase-canonical pattern mirrors admin-ui.tsx implementation; tokenisation is a tokens.css concern outside this page's scope.
- Sensitive-notes rail title was not a heading on mobile/tablet — page.tsx:513 rendered as `<span>` inside `<details><summary>`, breaking the H1 then H2 then H3 chain on `<xl` viewports. **FIXED in audit follow-up:** `<h2>` applied to mobile rail title.
- Single-letter `<li>` bullet on row markers — screenshots showed a bullet glyph leading each row (default `<ul>` style leak). Redundant with the type chip. **FIXED in audit follow-up:** `list-none pl-0` applied to both `<ul>`s.

**P3 — Polish — minor, fix when time allows**
- Update status `<details>` summary uses `min-h-12 sm:min-h-9` (correct); chevron rotation reads inverted to the eye (closed = -90deg right, open = 0deg down). The brief and pattern are correct.
- Quote pictogram in `PrivacyRequestNote.tsx:22` uses `float-left` for the icon next to a `whitespace-pre-wrap blockquote`. Works but floats are fragile alongside `line-clamp`; a CSS grid `[auto_1fr]` layout would be more robust.
- `PrivacyFilterBar.tsx:413-415` uses `<details><summary>` for the multi-select dropdown without `role="listbox"` / `aria-multiselectable` semantics. Functional via native disclosure.

### Backend status

**FAKE** — `BUILD-privacy-filter-query.md` (per `redesign/IMPLEMENTATION-PLAN.md` BLOCKS-REDESIGN entry for privacy). The filter bar is wired end-to-end (URL params, chips, mobile sheet) and the page reads the params, but the queue server query at `page.tsx:201-208` orders by `created_at` desc and applies no `request_type` / `status` / `from` / `to` / `q` predicates. Filter strip is marked `data-redesign-fake="filter-query"` at `PrivacyFilterBar.tsx:152`. The stat-tile filter shortcuts (page.tsx:286-288) likewise build URLs the server currently ignores.

### P1 (tag for Phase 7 gauntlet)

- none (both P1s closed in audit follow-up: page wrapper `pb-24 sm:pb-0` added; long-note expand toggle `min-h-11 sm:min-h-8` applied).

### BUSINESS-COMPLETENESS impact

- **2A-6** (form errors silently fail to announce — `aria-live` missing). The page newly contributes a form-level alert region on the filter strip (`PrivacyFilterBar.tsx:332-341` for short-query errors and `:343-354` for invalid date-range), and the page-level queue load failure wires `role="alert" aria-live="polite"` (page.tsx:391-392). PrivacyStatusForm's inline error path surfaces via Sonner persistent retry per brief §6 (intentional pattern divergence). Counts as a 2A-6 contribution across three form/error surfaces.

## privacy — critique

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Status panels, badges, relative-time, pending toast and `aria-busy` all present; the four "Empty" labels stacked down the right side restate what each panel header already says (count badge `0` + "No X requests"), which is over-signalling rather than informing. |
| 2 | Match System / Real World | 4 | "Received / Reviewing / Completed / Declined", "Awaiting longest", "These notes don't enter exports or operational logs" — plain regulator language, no jargon, no raw `manage_privacy_operations` leak. |
| 3 | User Control and Freedom | 3 | Per-row `<details>` form, confirm modal on Complete/Decline, retry toast, URL-driven filters, `expand=all` escape hatch — all good. No undo on a wrong status mutation though (and the action is audit-logged but not reversible from the row). |
| 4 | Consistency and Standards | 3 | Status family colours, badge vocabulary, AdminPanel chrome consistent with the rest of the admin. Two breaks: the bare `<li>` bullet showing as a default browser disc in front of "Data export 6 days ago" (visible on every viewport — addressed in audit follow-up), and the warning-tinted Date preset for "Today" — a chosen-pill in primary green sits next to neutral-pills, but the cream-peach stat tiles use a different warning shade than the Received badge dot, so the eye doesn't bind them as the same status family. |
| 5 | Error Prevention | 4 | Destructive transitions gated by `ConfirmActionModal`; non-finalising ones (Received / Reviewing) are instant — correct asymmetry. Search < 3 chars and inverted date range each render a `role="alert"` line. Contact-detail line silently omitted when permission is absent (no "hidden" hint to leak the gate). |
| 6 | Recognition Rather Than Recall | 3 | Request_type chip on every row, request-note quoted in a tinted well, last-actor on badge tooltip — recognition-first. Tooltip-only metadata (oldest-request client name, last-actor) is a recall trap for users who don't hover. |
| 7 | Flexibility and Efficiency | 3 | Stat-tile shortcuts to filters, URL-deeplinkable filters, `expand=all`, active-chip dismiss, mobile filter sheet, keyboard-native `<details>` — solid. No bulk actions, no keyboard shortcut row, no saved filter — fine for clinic scale per PRODUCT.md ("avoid power-user keyboard shortcuts as a primary path"). |
| 8 | Aesthetic and Minimalist Design | 3 | Tinted neutrals, Cormorant numerals, restrained palette, single warm accent on open-queue tiles, sensitive notes a quiet rail — on-brief. Drag: the three-up stat strip with Cormorant `1 / 6d / 0` is one millimetre away from the hero-metric template; the default-data view (one Received row + three empty panels stacked) makes the page look thinner than it is and pushes the eye onto the warning tiles. |
| 9 | Error Recovery | 3 | Persistent failure toast with explicit Retry; queue-load failure path renders a Cancelled-family `role="alert"` region with "Try again" link. Concurrent-edit ("That request was just updated by {actor}") copy specified in the brief but not implemented in the visible code path (deferred to Phase 7 per `redesign/per-page-deferrals/privacy-deferrals.md`). |
| 10 | Help and Documentation | 3 | Page description, panel description on the sensitive-note rail, modal copy that explains *why* (ICO escalation, audit integrity), tooltips on chips/times/badges. No "what is a deletion review?" inline explainer for a novice operator who hits the page for the first time, but PRODUCT.md positions this surface as senior-only, so the bar is correctly set lower. |
| **Total** | | **32 / 40** | **Solid — production-ready with a few visible drags** |

### AI-slop verdict: **PASS (with caveats)**

The surface reads as a calm regulator workstation with deliberate copy and a real composition (queue + quiet review rail), not a templated dashboard; the most generic surfaces — gradient text, decorative blobs, glassmorphism, side-stripe borders, identical icon-heading-text card grids — are all absent. **Caveat**: the three-tile stat strip is the closest thing on the page to AI default, and the Cormorant `1 / 6d / 0` reads more like the banned hero-metric template than it should — on richer real data it will look distinctive, on the empty dev fixture it borrows the silhouette. (Note: three-tile strip is brief §5 mandated — `'Open requests' / 'Awaiting longest' / 'Sensitive notes reviewed this month'` — can't drop without contradicting the brief.)

### UX-quality commentary against PRODUCT.md anti-references

- **"Generic SaaS / shadcn-default dashboards"** — avoided. The status-grouped queue with `<details>` panels, the quoted request-note well with a single Quote glyph, and the sensitive-note rail are all specific to this page, not boilerplate.
- **"Hero-metric template (big number / small label / supporting stats stacked decoratively)"** — *brushed*. Three stat tiles in a row, each a label + Cormorant numeral + sub-note + icon, is the exact silhouette PRODUCT.md names. Mitigations are real (two of three are warning-tinted, the third stays neutral; values are clickable filter shortcuts with real semantics; the "All caught up" empty-state replaces "0d" on the middle tile). But on the as-shipped screenshot, the three-up reads template-shaped.
- **"Identical card grids"** — avoided in spirit, brushed in the stat strip. Status panels are uniform-by-design (the user needs to scan four buckets in the same shape — a *list of panels* is the correct affordance), but the three stat tiles are functionally identical cards with different numerals.
- **"Decorative blobs, glassmorphism, gradient text, side-stripe borders"** — all absent. The Quote glyph in the request-note well is the only decorative shape and it carries meaning ("verbatim customer words"). Tick.
- **"Color-only status signalling"** — avoided. Each status panel pairs colour with a text label + count badge + chevron; the request-type chip is always text-first.
- **"Loud palettes, dense admin defaults, table-of-everything home pages"** — avoided. Tinted neutrals dominate; the only saturated surfaces are the two open-queue stat tiles and the green Date preset pill when active. Density is appropriately low for a regulator queue.
- **"Tools so spare they feel cold"** — avoided. The Cormorant numerals, the quoted-note well, the StickyNote pictogram on the rail, the human relative-times all add the "disciplined warmth" PRODUCT.md asks for without ornament.
- **"Everything-on-one-screen SaaS dashboards — 30 cards, no hierarchy"** — avoided. Hierarchy is honest: stats → filters → status-grouped queue → quiet review rail.
- **"Cards must be varied and considered"** — partial. Status panels are intentionally uniform (they earn it); the stat-tile row earns less but is brief-mandated.

### Concrete drags surfaced (status after critique follow-up)

1. **Default browser bullet `•`** on the request row — **FIXED in audit follow-up:** `list-none pl-0` on both `<ul>`s.
2. **Three-up stat strip** — brief §5 mandates three tiles verbatim; cannot drop without contradicting brief. Acknowledged as a structural drag held by the brief.
3. **Mobile nav overlay** — **FIXED in audit follow-up:** `pb-24 sm:pb-0` on page wrapper.
4. **Four-times "Empty" caption** redundancy — **FIXED in critique follow-up:** caption now renders only when panel has rows (Show {N} / Hide {N}); empty panels show count badge `0` + inline "No X requests." line only.
5. **`bg-[oklch(94%_0.008_280)]`** raw OKLCH escapes — codebase-canonical pattern (mirrors admin-ui.tsx status-family implementation). Deferred to Phase 7 tokenisation pass.

## privacy — post-handoff improvements

User requested the top-5 recommendations from the post-handoff visual review be applied surgically before commit. Landed as the final pass:

| # | Improvement | Implementation |
|---|-------------|----------------|
| #20 | Avatar / initial token next to client name | Added `initials()` + `avatarTint()` helpers in `page.tsx` (deterministic hue from client id, oklch 88% bg + oklch 26% text). 40px tinted chip leads the request-row header. Mirrors `BookingDetailSidebar.tsx` `ClientAvatar` pattern. |
| #1 | Varied stat-tile composition | Three-up identical-card strip replaced with anchor numeral tile (Open requests, Cormorant) + 2-row context panel ("Awaiting longest: 6d · Client" / "Sensitive notes this month: N reviewed"). Closes the "hero-metric template" silhouette flagged by critique without breaking brief §5 stat-tile labels. |
| #10 | Subtle motion | Panel chevrons → `transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]` (ease-out-quart). Status panels → `transition-shadow duration-200 ease-out hover:shadow-[0_2px_8px_oklch(23%_0.073_155_/_0.06)]`. Anchor stat tile + Awaiting-longest link → `hover:shadow-md` + opacity-fade-in `→` arrow. Honours global `prefers-reduced-motion`. |
| #6 | Note authorship caption | Added `staff_profiles` lookup (resolves `created_by_staff_id` → name). Caption below the quoted note well reads `From the customer directly.` (when `created_by_staff_id` is null) or `Transcribed by {Name}.` (when staff transcribed). Italic Soft Slate. |
| #5 | Copy-ID + mailto / tel | New client wrapper `src/app/admin/privacy/CopyIdButton.tsx` — clipboard copy of full UUID with Sonner success toast + Copy → Check icon swap. Email + phone in the contact line now render as `mailto:` / `tel:` anchors with hover-underline. |

**New file:** `src/app/admin/privacy/CopyIdButton.tsx` (in scope; net-new client wrapper under `src/app/admin/privacy/`).

**Files updated:** `src/app/admin/privacy/page.tsx` (avatar helpers + staff lookup + stat-strip rework + row composition + motion tokens).

**Files unchanged in this pass:** `PrivacyStatusForm.tsx`, `PrivacyFilterBar.tsx`, `PrivacyRequestNote.tsx`, `actions.ts` (Feature Preservation Manifest holds).

## dashboard-owner-admin — audit

Audit date: 2026-05-17 · Auditor: independent reviewer (no implementation context)
Files reviewed: src/app/admin/dashboard/page.tsx, dashboard-header.tsx, dashboard-filters-client.tsx, dashboard-cards.tsx, attention-group-client.tsx, demand-trend-client.tsx, src/app/admin/components/notification-bell.tsx
Screenshots reviewed: dashboard-owner-admin-polish-final-{375,768,1440}.png

### Severity rubric (impeccable v5 L884-890, verbatim)

## role-detail — critique

**Date:** 2026-05-18
**Reviewer:** independent critic (no implementation context)
**Screenshots reviewed:** 1440 / 768 / 375 + critical-risk modal

### Nielsen heuristic scores (0–4)

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 4 | Granted-count badge + footer + per-row Granted/Off label + filter "Showing X of Y" + sticky category counts. Pending state on Switch with spinner + "saving". |
| 2 | Match between system and real world | 3 | Plain English throughout ("Grant", "Revoke", "Reassign N staff first"). Slight leak: mono `manage_audit_logs` identifier sits on every row — operator-relevant but borders on jargon for novice users. |
| 3 | User control and freedom | 3 | Optimistic toggle rolls back on failure with persistent Cancelled toast + Retry. Confirm modal cancellable. No undo on grant after toast dismiss, but the toggle itself is the undo. |
| 4 | Consistency and standards | 3 | Letter token + breadcrumb + AdminPanel + AdminStatusBadge match brief 20 vocabulary. One inconsistency: confirm dialog uses ad-hoc Base UI Dialog instead of the shared `ConfirmActionModal` the brief specified ("standardise the destructive pattern"). |
| 5 | Error prevention | 4 | Risk-tiered confirms (critical always, high on grant, Owner always) + Delete guarded behind staff_count=0 + system-role lockdown + visible "Reassign N staff first" inline note before user can even try. |
| 6 | Recognition rather than recall | 3 | Risk + scope chips on every row, tooltips on risk meaning, sticky category headers, granted-state label paired with switch. Filter chips show aria-pressed state but lack the "active filter chip" pattern from DESIGN.md (filters live as buttons only). |
| 7 | Flexibility and efficiency of use | 3 | URL-persistent multi-select filters, free-text search, granted-only toggle, deep-linkable. No bulk actions (out-of-scope per brief). Search is form-submit (Enter), not live — minor friction. |
| 8 | Aesthetic and minimalist design | 3 | Calm ivory canvas, restrained chips, flat list rows replace nested cards as briefed. Triple-chip row (scope + risk + mono name + description) starts to feel busy at mobile widths — the mono identifier on every row competes with description. |
| 9 | Help users recognise, diagnose, recover from errors | 3 | Toast carries server message + Retry; form has `role="alert"` region; staff-blocker explains the count. The FAKE delete banner inside the confirm modal exposes implementation language ("BUILD-delete-role.md", `<code>` token) to the operator. |
| 10 | Help and documentation | 3 | Rich `title` tooltips on chips, switch states, DB-role line, system-role note. No inline help link / docs surface — acceptable for an Owner-only page. |

**Total: 32 / 40**

### AI-slop verdict: **PASS**

The page reads as a deliberate, role-specific workstation — risk-tiered confirms, grouped sticky categories, and a calm two-column rhythm — not a generic shadcn permissions grid.

### UX-quality commentary

Against PRODUCT.md anti-references this surface holds: no `border-l-4`, no hero-metric template, no gradient text, the decorative `ShieldCheck` tile has retired, and status is never colour-only (every chip pairs tone with text). The risk-tiered confirm flow embodies the "auditable and reversible" principle directly. Three regressions to flag: (1) the per-row mono permission identifier doubles every row's vertical weight and edges toward the "raw permission identifier on user-facing surface" anti-reference DESIGN.md §6 explicitly bans on access-denied screens — defensible here for audit traceability but visually loud; (2) the confirm modal is a hand-rolled Base UI Dialog rather than the `ConfirmActionModal` the brief mandated, fracturing the "standardise the destructive pattern" commitment; (3) the FAKE-delete amber banner inside the confirm modal leaks build-process language to the Owner, violating the plain-English voice anchor.

## role-detail — audit

### Severity rubric (verbatim, impeccable v5 L884-890)
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

### 5 dimension scores (out of 4 each, total /20)

| Dimension | Score | Note |
|---|---|---|
| Brief fidelity | 1 / 4 | Marquee Cormorant numeral absent; Today panel shows a time-rail visualisation, not the compressed BookingListCard list the brief specifies; Urgent Attention panel lacks the mandated Pending-family background tint; Tier 2 ships a 3-tile row + a separate BusinessPulseCard instead of the 2x2 grid; right-rail header carries unspecified Reports/Calendar/Settings buttons; H2 reads "Today at a glance" not "Today"; Export Ghost was not gated on view_reports_revenue (now fixed in-session). |
| Design system adherence | 2 / 4 | border-l-4 and bg-black cleared; avatar tints tokenised; Recharts minHeight 288 applied. But legacy AdminEmptyState used throughout instead of consolidated EmptyState (2A-17), raw oklch literals in classNames bypass the token layer. |
| Accessibility | 2 / 4 | aria-current="page" on date presets; dialog has aria-labelledby; disclosure has aria-expanded + aria-controls; presets in fieldset/legend. But zero role="alert" aria-live="polite" instances anywhere in src/app/admin/dashboard/ (brief §6 + BUSINESS-COMPLETENESS 2A-6 unmet); date-preset momentum strip on mobile clips Custom off-screen. |
| Visual quality | 2 / 4 | Header rhythm, status palette, chip group read calmly at 1440. But mobile bottom-nav z-index occludes Day readiness on 375; marquee numeral rendered as Urbanist 24px not 3.157rem Cormorant; Urgent Attention panel lacks warm Pending tint. |
| Code quality | 2 / 4 | canExport gate added in-session; BusinessOverviewDisclosure ships hidden=!hydrated?!false:!expanded confusing dead syntax; demand-trend raw ms arithmetic ignores BST/GMT timezone; redirect logic, error boundaries, RBAC preserved. |

Total: 9 / 20

### P0 findings

- FIXED in-session: src/app/admin/dashboard/dashboard-cards.tsx empty-state border-dashed removed; replaced with solid border.
- FIXED in-session: src/app/admin/dashboard/page.tsx added viewReportsRevenue field to PermissionAccess, imported canViewRevenueReports, threaded canExport={permissionAccess.viewReportsRevenue}.

### P1 findings (tag for Phase 7 gauntlet)

- src/app/admin/dashboard/dashboard-cards.tsx:220-225 — H2 "Today at a glance" not "Today"; marquee numeral not Cormorant 3.157rem
- src/app/admin/dashboard/dashboard-cards.tsx:397-415 — UrgentAttentionPanel missing Pending-family tint + status-pending border
- src/app/admin/dashboard/page.tsx:683-742 — Tier 2 ships 3-tile row + separate BusinessPulseCard, not the brief's 2x2 grid
- src/app/admin/dashboard/dashboard-header.tsx:70-104 — header rail scope creep (Reports/Calendar/Settings)
- No role="alert" aria-live="polite" anywhere in src/app/admin/dashboard/** — brief §6 + 2A-6 unmet
- Mobile bottom-nav overlap on Today panel Day readiness — shell-level (per deferrals)

### P2 findings

- src/app/admin/dashboard/dashboard-filters-client.tsx:339-341 — active-filter count uses warning tone not Pending family
- src/app/admin/dashboard/dashboard-cards.tsx:914-1022 — BusinessPulseCard ships 24-bar conic-gradient + stacked-bar legend not in brief
- src/app/admin/dashboard/dashboard-filters-client.tsx:555 — hidden=!hydrated?!false:!expanded double-negation
- src/app/admin/dashboard/demand-trend-client.tsx:32-35 — raw ms arithmetic ignores BST/GMT
- Legacy AdminEmptyState imports throughout (2A-17 regression)
- Mobile date-preset chips clip Custom without scroll-affordance

### P3 findings

- src/app/admin/dashboard/dashboard-cards.tsx:133-135, 423-425 — raw oklch literals in classNames; should use status family CSS vars
- src/app/admin/dashboard/page.tsx:529-533 — lastChecked rendered as if it were a freshness signal
- src/app/admin/dashboard/dashboard-cards.tsx:713 — "+12% vs last week" hardcoded stub string
- src/app/admin/dashboard/dashboard-header.tsx:65-68 — "Last synced" Clock chip duplicates lastChecked

### Backend status

N-A — read-only Server Component. No server actions, no audit log writes, no mutations. dashboard-data.ts untouched per Files-to-NEVER-touch. No BUILD plan blocks this page.

### P1 (tag for Phase 7 gauntlet)

- H2 + marquee numeral spec drift — src/app/admin/dashboard/dashboard-cards.tsx:220-225 (and MetricMini L341-348)
- UrgentAttentionPanel Pending-family tint — src/app/admin/dashboard/dashboard-cards.tsx:397-415
- Tier 2 structure mismatch — src/app/admin/dashboard/page.tsx:683-742
- Header rail scope creep — src/app/admin/dashboard/dashboard-header.tsx:70-104
- Missing role="alert" aria-live="polite" — entire src/app/admin/dashboard/**
- Mobile bottom-nav overlap — shell-level (per deferrals)

### BUSINESS-COMPLETENESS impact

none — this page newly contributes to no Track A items. 2A-6 not advanced (Grep: 0 matches under src/app/admin/dashboard/). 2A-7 (Recharts minHeight 288) was previously HANDLED. 2A-8 (aria-current="page") inherits from shared-components.

## dashboard-owner-admin — critique

Date: 2026-05-17
Reviewed: redesign/screenshots/dashboard-owner-admin-redesign/dashboard-owner-admin-polish-final-{375,768,1440}.png, page.tsx + dashboard-header.tsx + dashboard-filters-client.tsx + dashboard-cards.tsx + attention-group-client.tsx + demand-trend-client.tsx + notification-bell.tsx

### Nielsen heuristic scores (out of 5 each, total /50)

| # | Heuristic | Score | Notes |
|---|---|---|---|
| 1 | Visibility of system status | 4 / 5 | Live date subtitle, "Last synced 18:54", aria-current on active preset, aria-busy on filter strip, role badge in header, attention count tied to dialog title. Half-point off: empty Urgent Attention panel still surfaces a saturated primary-green "Review signals" CTA even when every signal reads "All clear". |
| 2 | Match between system and real world | 4 / 5 | H1 "Today at Rahma" voice-anchored; copy is plain. Half off: "High priority signals that may need your action" is engineery; an operator would say "Anything that needs you". |
| 3 | User control and freedom | 4 / 5 | Disclosure persists per user via localStorage; date filter set is GET-driven so deep links survive; More filters sheet has Apply + Clear all; Custom range exposes From/To. Loses a point because attention dialog has no visible Cancel/Close beyond small ×. |
| 4 | Consistency and standards | 3 / 5 | Tokens wired, border-l-4 + bg-black removed, deterministic avatar tints replace 12 hex strings. But header right rail breaks navigation grammar: at 1440 it carries cmd-K chip + Last synced clock + Reports + Calendar + Bell + Settings adjacent to AdminTopNav which already owns global search + bell + avatar. ⌘K appears twice. Bell appears twice. Cormorant marquee numeral the brief designates as the panel signature is replaced with a sans `text-xl`. |
| 5 | Error prevention | 4 / 5 | Custom date submit guards against from>to silently, aria-busy blocks pointer events while routing, attention links pre-gated by getAccessibleAttentionHref. Could gain a point with an inline validation message on date misorder. |
| 6 | Recognition rather than recall | 3 / 5 | Active preset chip is high-contrast green-filled, active-filters badge shows numeric count. But header rail's trailing icon buttons land as unlabelled cluster at 1440; the Urgent Attention zero-state stacks three rows that all look identical — identical-card-grid failure mode applied to a list. |
| 7 | Flexibility and efficiency of use | 3.5 / 5 | Disclosure remembers preference; cmd-K still reachable; presets one click; export carries current filter state. Loses points because Today panel has no quick path to specific bookings on empty state and duplicates bell/search/Reports/Calendar between top nav and header rail. |
| 8 | Aesthetic and minimalist design | 2.5 / 5 | Most-regressed heuristic. (a) Header right rail is loud — cmd-K chip + Last synced clock + Reports + Calendar + Bell + Settings cog beside three more icons in top nav; brief specified Bell + cmd-K chip + role badge. (b) "Today at a glance" panel is internally subdivided into 0/0 stat strip, two CTAs, empty-state card, and three-tile Day Readiness strip — five visual zones in one tier-1 card. (c) Urgent Attention panel renders three identical icon-circle + heading + text + 0 + dotted-meter rows — exact identical-card-grid antipattern PRODUCT.md + DESIGN.md §6 ban. (d) Cormorant marquee numeral absent. The page reads competent and tidy but generic; does not yet read as Rahma. |
| 9 | Help users recognize, diagnose, recover | 3.5 / 5 | AdminErrorBoundary wraps each major section; attention rows have impact lines; custom date submit silently bails when invalid — that's the diagnose-and-recover miss. Tile-level "Couldn't load this section. Try refreshing." copy per brief not visible in happy-path screenshots. |
| 10 | Help and documentation | 3 / 5 | Tooltips on cmd-K chip, Export, role badge, and disclosure are present. The brief lists native title tooltips on date presets, marquee numeral, attention icons and demand-trend bars — most aren't wired. No in-page hint that the disclosure persists. |

Total: 34.5 / 50

### AI-slop verdict

REGRESSED.

Reasoning: structurally the page hits brief targets (two-tier surface, disclosure, preset chips, absolute bans removed, deterministic avatar tints) but visually it has slid into three named PRODUCT.md anti-patterns simultaneously — an icon+heading+text identical-row grid inside Urgent Attention, a header right rail that has expanded into a second navbar with duplicated controls, and the absence of the Cormorant marquee numeral that was the panel's named brand signature. Calm and dignified became neat and generic.

### UX-quality commentary — mapping to PRODUCT.md anti-references

- "No identical card grids" — Urgent Attention zero-state shows three rows with identical composition (round-bg icon + bold heading + grey subtitle + "0" + "All clear" + dotted progress meter). Day Readiness sub-strip inside Today panel does the same in miniature.
- "No generic SaaS feel" — 1440 header right rail reads as SaaS dashboard chrome bar. Dotted 5-pip "progress meter" on each Attention row at 0/0 reads as SaaS metric widget.
- "AdminStat tiles are flat, two-row, numeral-led" — Today panel "0 today / 0 this week" pair is small hero-metric in sans, not the Cormorant-led marquee numeral the brief explicitly named.
- "Don't expose more than two card tiers simultaneously" — respected at page level but Today panel internally hosts five zones and Urgent Attention hosts four.
- "Decoration that carries meaning" — dotted 5-pip meters on each Urgent Attention row at value 0 carry no information.
- "Voice anchors — verbs over nouns" — "Enjoy a quiet day. Great time for admin and planning." nails it. "High priority signals that may need your action" doesn't.
- Mobile (375) overlap — bottom mobile tab nav overlaps lower half of Today panel.

Highest-leverage fixes (deferred to Phase 7 — see deferrals file): (1) restore Cormorant marquee numeral on Today panel; (2) collapse header rail to bell + role badge + cmd-K chip per brief; (3) replace three identical icon-heading-text-0-meter rows in Urgent Attention zero-state with single "All caught up" empty state; (4) fix mobile bottom-tab overlap.

## dashboard-owner-admin — critique (re-run)

Source verified: src/app/admin/dashboard/page.tsx, dashboard-header.tsx, dashboard-filters-client.tsx, dashboard-cards.tsx, attention-group-client.tsx, demand-trend-client.tsx, src/app/admin/components/notification-bell.tsx
Screenshots reviewed: dashboard-owner-admin-final-{375,768,1280,1440}.png and dashboard-owner-admin-polish-final-{375,768,1440}.png

Fix verification (vs prior REGRESSED critique):
- Header rail collapsed to brief §5 spec — Bell + ⌘K chip + role badge only; Reports/Calendar/Settings + Last synced removed. VERIFIED in source + screenshots.
- TodayAtAGlanceCard H2 reads "Today" (dashboard-cards.tsx:223) per brief §8. VERIFIED.
- Cormorant marquee numeral wired via admin-display + clamp(2.75rem, 4.5vw, 3.157rem). Renders as Cormorant italic serif across all four final screenshots. VERIFIED.
- This-week stat demoted to text-base font-semibold with vertical divider — supporting role. VERIFIED.
- UrgentAttentionPanel allClear branch collapses 3 identical rows to single AdminEmptyState; Review signals CTA hidden. VERIFIED across 375/768/1280/1440 screenshots.
- Tier 2 sub-tile titles verbatim brief: "Staff capacity", "Payment health", "Operations health". VERIFIED.

### Nielsen heuristic scores (out of 5 each, total /50)

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 4.5 / 5 | Active preset aria-current+green fill; aria-busy on filter strip; Day readiness line states current status at a glance. Half-off: disclosure-disabled state may still show expanded children if localStorage was previously true. |
| 2 | Match between system and real world | 4.5 / 5 | H1 "Today at Rahma" + Sunday-date subtitle reads like an operator's morning briefing; empty-state copy ("Quiet day…", "All caught up") is plain-English encouraging. |
| 3 | User control and freedom | 4.5 / 5 | Five date presets + Custom + More-filters sheet; Clear-all one click; URL deep-linkable; ESC + outside-click close attention dialog. |
| 4 | Consistency and standards | 4 / 5 | AdminDashboardPanel + AdminStatusBadge + AdminEmptyState + AdminIconBadge consistently applied. Minor: Demand trend H3 is a p tag (demand-trend-client.tsx:47), heading hierarchy slip; Operations health uses 4 identical AdminHealthTile in 2x2 grid — pre-existing antipattern, not new. |
| 5 | Error prevention | 4.5 / 5 | Custom-date submit guards from>to silently; restricted attention items render a Restricted pill instead of dead link; severity tints preview destructive routes before click. Half-off: silent return on date misorder, no role=alert. |
| 6 | Recognition rather than recall | 5 / 5 | Role badge explicit; preset chips show absolute ranges via title; ⌘K chip shows modifier; status families pair tint+icon+label per Named Status Rule. |
| 7 | Flexibility and efficiency | 4 / 5 | Preset chips, sheet, localStorage disclosure, deep-linkable URLs, ⌘K. Lost half on disclosure transition feeling mechanical; lost half on Export not previewing row count. |
| 8 | Aesthetic and minimalist design | 4 / 5 | Tier 1 honours brief: marquee numeral large+serif, this-week supporting, right-rail single quiet illustration, header rail spare. Day readiness inside Today (3 icon-heading-text items) and Operations health (4-tile 2x2) edge toward identical-card-grid antipattern — pre-existing, not new regressions. |
| 9 | Help users recognize, diagnose, recover | 3.5 / 5 | AdminErrorBoundary wraps filters + notifications; restricted attention rows show Restricted affordance. Per-tile "Couldn't load this section. Try refreshing." inline not visibly implemented; date validation silent. |
| 10 | Help and documentation | 3.5 / 5 | Tooltips on Export + ⌘K chip; aria-label on bell. Brief's tooltip set for Staff Capacity bars, Demand Trend bars, Payment Health outstanding figure not implemented. |

Total: 42 / 50

### AI-slop verdict

PASS — all three concrete findings from the prior REGRESSED critique are resolved at source and visible across all four final screenshots; residual issues (identical-card-grid inside Operations health, demand-trend heading-level slip, disabled-disclosure edge) are pre-existing or out of scope of the distill/bolder axes the agent ran, not new degradations.

### UX-quality commentary mapped to PRODUCT.md anti-references

- Identical card grids anti-reference: Urgent Attention zero state no longer hits this; collapses to one quiet illustration. Operations health (4-tile 2x2) and Day readiness row (3 icon-label-value) still echo the antipattern. Pre-existing, limits ceiling, scored at 4 on heuristic 8.
- Hero-metric template anti-reference: Today header is on the right side of this line. Saved by the readiness row sitting in a separate inset card and the marquee numeral being deliberately serif/restrained.
- Everything-on-one-screen SaaS dashboards: Tier 1/Tier 2 split honours discipline. Tier 1 alone is calm above the fold at 1440 and 1280.
- Side-stripe borders / gradient text (impeccable absolute bans): none observed.
- PRODUCT.md Calm/Scannable/Dignified: final screenshots read as a quiet operational tool. Cormorant numeral + single all-clear illustration deliver the "quietly competent" voice.
- Empty states encourage, never apologise: "All caught up" / "Quiet day. Great time for admin and planning." all hit the voice anchor.

Net: the cycle is a genuine recovery from REGRESSED. Remaining work is incremental, not corrective.

## dashboard-owner-admin — audit (final)

### Dimension scores (out of 4 each, total /20)

- **Brief fidelity: 4/4** — Every brief commitment (read against §1-10 + §11 amendments) is honoured: Tier 1 / Tier 2 disclosure, filter-strip with 5 presets + More-filters sheet, aria-current="page" on active preset, NotificationBell lifted into shell (no longer floating in dashboard), border-l-4 removed, bg-black replaced with oklch(12% 0.014 155) (attention-group-client.tsx:144), Recharts height={288} (demand-trend-client.tsx:38, 41), 12 hardcoded staff-avatar hexes replaced by deterministic oklch(85% 0.035 ${hue}) utility (dashboard-cards.tsx:87-101). Range-aware Snapshot, condensed Day-readiness ribbon, Operations Health priority list, demoted Mix snapshot all match §11 amendments verbatim. Custom-date validation + URL-driven todayView toggle also match.
- **Design system adherence: 3/4** — Tokens dominate (--admin-* CSS vars, status families, Cormorant via .admin-display). Carry-forward absolute-bans clean (border-l-4, bg-black, raw hex chart colours: zero matches via Grep). One deduction: severity tint OKLCH literals at dashboard-cards.tsx:133-134, 760-763 and notification-bell.tsx:189, 251, 434-435 bypass --admin-{danger,warning}-bg tokens (already deferred per dashboard-owner-admin-deferrals.md — not a new finding, but it remains drift).
- **Accessibility: 3/4** — Strong: skip-link preserved, focus-visible rings on every interactive control, aria-current="page" on preset chips (dashboard-filters-client.tsx:339) and todayView toggle, aria-expanded + aria-controls on disclosure, role="alert" aria-live="polite" on custom-date error (dashboard-filters-client.tsx:377, 526), aria-label on pill remove links (line 561), aria-busy on pending state. Weak: heading hierarchy gap (see P1) and several <section> landmarks without accessible names (Tier 1 Today panel, all Tier 2 sub-tiles, filter strip).
- **Visual quality: 4/4** — Spacing-fix screenshot shows calm two-tier rhythm, gold accent rule under H1, Cormorant marquee numeral, severity-tinted attention rows with proper breathing room (mt-5 border-t pt-3 separators), sticky filter strip with active-pill row, scope-summary line all reading as one editorial unit. 375px screenshot stacks cleanly, no horizontal scroll, status pill drops below time line as specified.
- **Code quality: 3/4** — Strong typing, no any, clear separation between server page.tsx and client cards, useMemo where appropriate, deterministic avatar tint algorithm documented. Weak: dashboard-cards.tsx is 1527 lines (signature component density warrants a split); two dead unused helpers (MetricMini, AppointmentMobileRow at 642-685); assignedOnly local at page.tsx:546 is computed but never read.

**Total: 17 / 20**

### P0 findings

none

### P1 findings

- **Heading-hierarchy gap on Tier 1 + Tier 2 tiles.** PRODUCT.md and brief §8 require Tier 1 panel titles (H2) and Tier 2 sub-tile titles (H3). Only UrgentAttentionPanel renders an H2 (via AdminPanelHeader, dashboard-cards.tsx:735-740). TodayAtAGlanceCard (eyebrow at line 254-256), StaffCapacityCard (line 865-867), PaymentHealthCard (line 1040-1042), OperationsHealthCard (line 1241-1243), DemandTrendCard (line 1472-1474), BusinessPulseCard (line 1378-1380) all set their titles as <p> eyebrows.
- **Section landmarks lacking accessible names.** AdminDashboardPanel is rendered as <section> and accepts ariaLabel, but every dashboard-cards.tsx call site omits ariaLabel. AT users land on six unnamed <section> landmarks.

### P2 findings

- dashboard-cards.tsx size (1527 lines) — six exported components in one file.
- Filter-strip <section> has no aria-label/aria-labelledby (dashboard-filters-client.tsx:314).
- SnapshotViewToggle uses aria-current="page" — semantically tab-like; consider role="tablist" + aria-selected.

### P3 findings

- Dead code: MetricMini (dashboard-cards.tsx:642-649) and AppointmentMobileRow (lines 651-685) unreferenced after rebuild.
- Unused variable: assignedOnly (page.tsx:546).
- getDashboardCopy coordinator/therapist branches dead under current routing.
- Sparkline uses var(--admin-success) stroke — reads as success semantically; consider neutral.

### Backend status

N-A — read-only page; dashboard-data.ts untouched per "Files to NEVER touch" list; all data aggregation preserved verbatim.

### P1 (tag for Phase 7 gauntlet)

- Heading hierarchy on Tier 1 + Tier 2 tiles — addressed in-session via direct H2/H3 elevation on each panel's eyebrow (post-audit fix; see "P1 fixes applied in-session" note below).
- Unnamed <section> landmarks — addressed in-session via ariaLabel prop threading (post-audit fix).
- Severity-tint OKLCH literals — confirmed still present; remains in deferrals.

### BUSINESS-COMPLETENESS impact

No Track A regressions. All preserved: GET filter name attributes verbatim, RBAC gates (getAdminPageAccess, canViewRevenueReports, canManageOperations), JS hooks (admin-main, admin-command-search, attention-dialog-title, linearGradient#demandGradient), POST /admin/signout, GET /admin/reports/export?… deep-link with current filterQuery, custom-range bookmark survival. New (post-brief) capability: range-aware Snapshot + scope-summary line + active-filter pill row + URL-driven List/Timeline toggle.

### P1 fixes applied in-session (post-audit)

After the audit returned, the two P1 findings (heading hierarchy + unnamed section landmarks) were addressed in-session as they were within the 7-file scope:
- Snapshot panel eyebrow promoted to <h2> with sr-only visible-text variant + visible eyebrow.
- Each Tier 2 tile eyebrow promoted to <h3>.
- Filter strip <section> gained aria-label="Dashboard filters".
- Dead MetricMini / AppointmentMobileRow / assignedOnly removed.

## dashboard-owner-admin — critique (final)

**Verdict — AI-slop:** PASS. The final state is grounded in role-specific operations vocabulary (Snapshot/Ready/Needs your attention/Mix snapshot), uses varied card compositions per content type, and earns its visual weight through the Cormorant marquee + sparkline + scope summary triplet rather than another wall of identical KPI tiles. The page reads as the Rahma admin, not a "next.js starter with shadcn cards."

### Nielsen heuristic scores (out of 5 each — total 44/50)

1. **Visibility of system status — 5.** Scope summary (10 bookings · 5 attention · £430 outstanding · 11 clients) plus the right-rail THIS MONTH (MAY 2026) pill plus the Updated <relative-time> caption make the active lens unambiguous. Filter strip uses aria-busy + opacity dim during transitions; aria-current="page" on the active preset.
2. **Match between system and real world — 5.** Voice is clinic-operator vernacular ("All caught up", "Quiet day", "Needs your attention", "£X outstanding", "Confirmations / Coverage / Payments"). No "Trigger notification" / "Status: NULL" residue. Stripe state-word discipline honoured.
3. **User control and freedom — 4.** Disclosure is localStorage-persisted per user; date presets + custom-range escape hatch are linkable; advanced filters in a dismissable sheet with Clear all and per-pill removal. Missing: ESC-to-clear customDateError (must blur/submit) and no "Reset to Today" link when in a deep custom range.
4. **Consistency and standards — 5.** Eyebrow + Cormorant marquee + supporting line pattern applied uniformly across Snapshot/Staff/Payment/Status/Demand; all four Tier 2 tiles enforce min-h-[22rem]; all chips are full-radius 40px tall with consistent press-feedback; tabular-nums everywhere numbers appear.
5. **Error prevention — 4.** Custom date misorder is caught client-side with role="alert"; sheet uses GET semantics so deep links survive; disclosure is disabled when hasActivity === false. Minus: a coordinator-without-revenue still sees an outstanding-£ ScopeStat unless revenueAllowed flag fires (it does — verified at filter line 540, so this is well-handled).
6. **Recognition rather than recall — 5.** Avatars, named status pills (icon + bg + text), readiness chips and severity-tinted attention rows all make state recognisable at a glance. The cmd-K hint lives in the global AdminTopNav (correct), not duplicated here.
7. **Flexibility and efficiency — 4.** Power-user paths exist (URL-driven todayView toggle, deep-link filter pills, drill-down links carrying filterQuery). One soft spot: every drill-down opens in same tab; no batch-action affordances on the dashboard (intentional per brief — dashboard = triage surface).
8. **Aesthetic and minimalist design — 5.** Single hero numeral per tier, restrained gold (one accent rule, dot on unconfirmed, sparkline stroke), warm gradient on filter strip rather than decoration, no glass/blob. Mix snapshot is properly demoted to a thin strip so Tier 2 retains primacy. Cormorant lives only on numerals per the DESIGN.md exception.
9. **Help users recognise/diagnose/recover — 4.** Per-tile AdminErrorBoundary; "All clear: …" footer consolidates negative space; staff-gap row falls back to "Staff gap" status pill not a raw NULL. Deferred (acknowledged): AdminErrorBoundary fallback lacks role="alert" — shared infra, Phase 7. Tile-error copy is generic rather than brief-verbatim "Couldn't load this section."
10. **Help and documentation — 3.** Inline tooltips on the marquee numeral, readiness chips, severity meter, and pills are good for an internal tool. No explicit "What is this?" affordance on Tier 2 tiles, no first-run hint for the disclosure or todayView toggle — fine for novice operators only because the labels are plain English.

**Total: 44 / 50**

### Anti-reference mapping (PRODUCT.md)

- **Generic SaaS / shadcn-default** — avoided. Filter strip is a backdrop-blurred warm gradient; chips are bordered + lift-on-hover, not flat shadcn pills.
- **Identical card grids** — avoided. Original 3-tile readiness grid and 2×2 AdminHealthTile block were both rebuilt (now inline ribbon + severity-weighted priority list); Tier 2 tiles vary internally (progress bars vs. priority list vs. Recharts).
- **Decorative blobs / glassmorphism** — none present.
- **Hero-metric template** — partially watched: each Tier 2 tile follows eyebrow + numeral + sub-line, which is the same pattern four times. It works because the bodies differ.
- **Side-stripe border-l-4** — fully removed (verified in dashboard-cards.tsx; severity tone now communicated by full border + tinted background).
- **Colour-only status** — every status carries icon + text + tint (rows + pills + severity meters).
- **Two card tiers simultaneously** — honoured: Tier 1 default-on, Tier 2 disclosure, Mix snapshot demoted to subordinate footnote band.

**Net read:** the surface is calm, scannable, dignified, and recognisably Rahma rather than recognisably "AI dashboard". Remaining friction is largely Phase-7 shared-infra debt (AdminErrorBoundary ARIA, severity OKLCH literals, Intl.PluralRules) — not new findings.
## client-detail — audit

**Dimension scores (/4):**
- Visual hierarchy: 3.5 — H1 + lifecycle/source row + sidebar/main split read cleanly; only weakness is the mobile-nav overlap on the Contact panel at 375.
- Token compliance: 3 — uses CSS vars consistently, but two raw `oklch(...)` literals appear in `ClientDetailForms.tsx:78,90,105,178,190,205` (Cancelled tokens hardcoded instead of a `--admin-status-cancelled-*` var).
- Accessibility: 3.5 — `role="alert" aria-live="polite" aria-atomic="true"` present, `aria-current="page"`, visible `*` required markers, labelled inputs, `aria-busy`. Lose 0.5 for `StatCell` uppercase tracked label fighting the design rule.
- Responsive behaviour: 2.5 — mobile reorder per brief §5 correct, but `client-detail-final-375.png` shows the sticky AdminTopNav visually overlapping the Contact header (chrome bug surfaced by this page; no padding-top safe zone).
- Brief fidelity: 3.5 — all conditional sections, tabs, expandable note, empty states, Cancel/Save, "New booking" RBAC gate match brief. Drift: "Back to clients" link (lines 438-444) — brief §7 says "No explicit back-link needed".

**Findings (file:line):**
- **P0** — None.
- **P1** — Mobile AdminTopNav overlaps page content at 375px; chrome-wide bug exposed because the header lacks top spacing. `page.tsx:437`.
- **P1** — Raw `oklch(...)` literals for Cancelled/error states bypass token layer: `ClientDetailForms.tsx:78,90,105,115,178,190,205,221`. Should use `--admin-status-cancelled-bg/text` tokens.
- **P2** — "Back to clients" Ghost link `page.tsx:438-444` is brief drift; brief §7 says omit.
- **P2** — `StatCell` uppercase + letter-spacing label violates DESIGN.md "Never uppercase shouting".
- **P2** — `BookingHistoryCard` has no staff avatar and no gender-match chip; DESIGN.md §5 BookingListCard mandates both.
- **P2** — Privacy "Submit request" uses a `Save` icon; semantically a submission, not a save — Send icon better.
- **P3** — Source chip flat metadata blob beside strong status badge.
- **P3** — `Client since {formatDateTime}` includes time-of-day; only date is meaningful.
- **P3** — `HealthContextPanel` slices to 6 with no "See all" affordance.
- **P3** — Note timestamp duplicates the visible text in `title` attribute.
- **P3** — Tab counts always render including `0`; reads redundant next to the empty state.

**Backend status:** N/A — server-action wiring (`addClientNote`, `createClientPrivacyRequest`), select shapes, RBAC gating, and `name` attributes all preserved verbatim per brief Feature Preservation Manifest.

**P1 (tag for Phase 7 gauntlet):**
- Mobile AdminTopNav overlap with first-card content at 375.
- Hardcoded `oklch(...)` Cancelled literals in `ClientDetailForms.tsx` — extend `--admin-status-cancelled-*` tokens and migrate.

**BUSINESS-COMPLETENESS impact (2A-6, 2A-9):**
- **2A-6 (form errors announced):** PASS — both forms wrap form-level + field-level errors in `role="alert" aria-live="polite" aria-atomic="true"` (`ClientDetailForms.tsx:73-83, 109-120, 172-183, 215-226`). Adds 1 page contribution.
- **2A-9 (visible required markers):** PASS — `<span aria-hidden="true">*</span>` in Cancelled colour adjacent to required Note and Request-type labels (`ClientDetailForms.tsx:90-92, 190-192`). Adds 1 page contribution.

## client-detail — critique

**Nielsen heuristics (/10):**
1. Visibility of system status — 9
2. Match between system and real world — 9
3. User control and freedom — 8
4. Consistency and standards — 7
5. Error prevention — 8
6. Recognition over recall — 8
7. Flexibility and efficiency of use — 7
8. Aesthetic and minimalist design — 7
9. Help users recognise/diagnose/recover from errors — 9
10. Help and documentation — 7

**Total: 79/100**

**AI-slop verdict: PASS.** No gradient text, no `border-l-4`, no glassmorphism, no purple/blue, no hero-metric template, no identical-card-grid; varied panel shapes (Contact dl / Stats 2×3 / Notes list / Privacy list+form). Distinctly Rahma rather than shadcn-default.

**PRODUCT.md anti-reference mapping:**
- "Color-only status signalling" — avoided: every badge has icon + label + tint.
- "Side-stripe borders, gradient text" — avoided.
- "Cards… icon + heading + text repeated thoughtlessly" — partially avoided; sidebar runs five icon-circled `AdminPanelHeader` panels in a row. Worth varying one panel (drop the icon circle on Audit, or compress Health into Notes when health is empty).
- "Tools so spare they feel cold" — avoided; warm ivory, status colour, mint-tinted icon halos.
- "Everything-on-one-screen SaaS dashboards" — borderline; 1440 screenshot shows heavy sidebar against near-empty main when client has zero upcoming bookings. Brief permits this (reference vs operational columns) but visual weight asymmetry is striking.

Caveat: only Owner default state was screenshotted in audit window; Therapist / Coordinator / Access-denied variants not visually verified in this session.

## client-detail — critique (independent)

**Heuristic scores (out of 10):**
1. Visibility of system status — 9/10. Active "Upcoming" tab Clinic Green fill + count chip; lifecycle + source chips at H1; nit: no inline toast after note save.
2. Match between system and real world — 9/10. Plain operator language ("Book this client in when they're ready"); "Repeat: No/Yes" reads natural.
3. User control and freedom — 8/10. Back-link, explicit Cancel, URL-param tabs are browser-back compatible.
4. Consistency and standards — 9/10. AdminPanel/AdminPanelHeader uniform; AdminStatusBadge icon+label+tint.
5. Error prevention — 8/10. `coerceTab` silent fallback; required `*` markers in Cancelled colour; `aria-invalid`.
6. Recognition rather than recall — 9/10. Sidebar reference column keeps contact + stats visible while scanning history.
7. Flexibility and efficiency — 7/10. Deep-linkable tabs and pre-filled clientId; no keyboard shortcuts.
8. Aesthetic and minimalist design — 9/10. Warm ivory canvas + varied card compositions; Cormorant absent because no marquee numeral — restraint earned.
9. Help users recognise/diagnose/recover from errors — 8/10. `role="alert" aria-live="polite"` regions on both forms; `aria-describedby` per-field.
10. Help and documentation — 7/10. Native `title` tooltips on chips and CTAs; no inline help for "Sensitive"/"Restricted" meaning.

**Total: 83/100**

**AI-slop verdict: PASS.** No `border-l-4`, no gradient text, no purple/blue gradient, no glassmorphism, status badges pair icon + label + tint (never colour-only), six distinct card compositions avoid the identical-grid anti-pattern. Reads as Rahma surface, not generic SaaS — disciplined warmth via ivory canvas + deep-green chrome + dignified empty-state illustration + operator-voice copy.

**Commentary:**
- 1440 layout: booking-history panel on a 0/1 client is mostly whitespace beside a tall left rail — empty-state illustration is the only anchor, leaving the surface lopsided until history fills in.
- Mobile (375): brief order correct (Booking History → Contact), but "New booking" Primary CTA stacks above the booking panel on its own row, repeating the affordance twice within one screen-height (header CTA + empty-state "Book now").
- Notes-added: Sensitive badge correctly carries lock icon + label; real staff name + IBM Plex Mono timestamp; audit row at bottom (`client note created · 18 May 2026, 06:47`) closes auditable loop visibly on the same surface.
- `StatCell` uses uppercase 0.04em-tracked labels — reads "dashboard SaaS" against rest of page's sentence-case voice. Brief does not require uppercase; DESIGN.md §3 specifies sentence-case for label step.
- Notes panel mixes free-text `client.notes` blob (legacy column) above structured `clientNotes` list — on a populated client this stacks two visually different note treatments. Could confuse operators about which surface "Add note" writes to.
- Tab list uses `role="tablist"` with `<Link role="tab">` + `aria-selected` but no `tabpanel` element with `aria-labelledby` — half-applied ARIA pattern. Cleaner as plain `<nav>` with `aria-current="page"` (which it also sets), making `role="tab"` redundant.

## client-detail — audit (v2)

> Supersedes the v1 audit above. Re-run after second-round polish (avatar disc, next-visit hero band, critical-note system, profile-note callout, status+service URL filters, common-services chips, recent-activity balance card, booking-card layout cleanup, WhatsApp, Print, keyboard shortcuts, Send icon).

**Scope:** `src/app/admin/clients/[clientId]/page.tsx` + `src/app/admin/clients/[clientId]/ClientDetailForms.tsx`. Post second-round polish.

### Dimension scores (out of 4)

- **Visual hierarchy: 3.5** — Avatar disc + H1 + lifecycle pill + Next-visit/Critical bands give the header strong scan-down rhythm; Booking-history main column reads as primary; sidebar carries reference cards in correct order.
- **Token compliance: 3.5** — Heavy use of `var(--admin-*)` tokens. Hard-coded `oklch()` lives only inside status-family palettes (Confirmed/Cancelled/Pending tints) which is sanctioned. One stray: pinned-sensitive-note callout uses Pending-65 tones, not the Restricted lavender pair documented in DESIGN.md §2.
- **Accessibility: 3** — Tabs carry `aria-current="page"` + `aria-selected` + `role="tab"`. Forms wrap errors in `role="alert" aria-live="polite" aria-atomic="true"`. Required `*` markers visible. Gaps below.
- **Responsive behaviour: 3** — Sidebar/main column reorder at lg works; 375 chrome-overlap is shell-scoped (Phase 7 deferred).
- **Brief fidelity: 3.5** — Header CTA, tabs, EmptyState per tab, expandable note form, privacy form, ClientDetailShortcuts, print, WhatsApp deep-link, status/service filter chips, critical-note banner, next-visit band — all present and wired.

### Findings

**P0 — Blocks release — fix before shipping anything**
- none

**P1 — Fix this sprint — significant impact on users**
- Critical-note banner used non-standard `role="note"` — **fixed in same pass**, now `role="region" aria-label="Critical client note"` (`src/app/admin/clients/[clientId]/page.tsx:645`).
- 375px header right-cluster could clip "New booking" if Print is forced to keep its label. **Mitigated**: Print button already hides its label below sm via `hidden sm:inline` (ClientDetailForms.tsx PrintRecordButton); not currently clipping in the v3 375 screenshot.

**P2 — Next cycle — noticeable but not blocking**
- Tab strip declares `role="tablist"`/`role="tab"` but the booking list below is not wrapped in a `role="tabpanel"` with matching `aria-labelledby`. Either complete the tablist contract or drop the roles in favour of nav links. `page.tsx:778-792`.
- Pinned-sensitive-note callout uses Pending-family tints; DESIGN.md §2 Restricted family (lavender) is the documented home for sensitive/restricted content. Cross-family drift. `page.tsx:1091-1098`.
- `EmptyTab` and `EmptyFilteredState` titles are `<p>` styled as headings — semantic gap; should be `<h3>` (or `<h4>`) inside the `AdminPanel` H2. `page.tsx:854, 1347`.
- Active-tab count badge over Clinic Green: verify 3:1 for non-text-UI contrast on the 30% white wash + ring-white/35 combo. `page.tsx:806`.

**P3 — Polish — minor, fix when time allows**
- `digitsOnly` + `whatsappHref` normalises a leading `0` to `44` but does not validate UK shape — non-UK numbers prefixed with `0` will be mangled silently. `page.tsx:144`.
- "First visit booked" lifecycle chip currently uses Pending (`info`) tone — reads as a warning to a glancing eye; a Confirmed-family tone would say "this is a state, not an alert".
- Notes panel shows plain "No notes yet" paragraph instead of a dignified `EmptyState`. `page.tsx:1106-1108`.
- `getInitials` returns `?` when full_name is blank; avatar is `aria-hidden` so harmless, but worth a single-letter fallback for visual polish.
- `RecentActivityBalanceCard` duplicates `AuditPanel` rendering; extract a shared list component to halve maintenance surface.

### Backend status

**HANDLED.** `addClientNote` and `createClientPrivacyRequest` are wired verbatim from `../actions` per IMPLEMENTATION-PLAN row 6; no FAKE shim, no BUILD plan dependency. RBAC scopes all flow through `getClientDataAccess` and `getAdminPageAccess`. Therapist scoped query via `booking_assignments` preserved. Audit log query uses real `audit_logs` table.

### P1 (tag for Phase 7 gauntlet)

- `role="note"` — fixed in same pass; now compliant.
- Live remaining P1 items: **none**. All other surface items dropped to P2/P3 after second-round polish.

### BUSINESS-COMPLETENESS impact

- **2A-2** — Mobile-friendly rebook flow: contributes "New booking" Primary in header + Book-now CTA on empty Upcoming tab with `?clientId=` pre-fill.
- **2A-4** — Heading hierarchy: all sidebar section titles render through `AdminPanelHeader` (H2); no shadcn `Card`/`CardTitle` H3 skips.
- **2A-6** — Form-level errors wrapped in `role="alert" aria-live="polite" aria-atomic="true"` on both forms (ClientDetailForms.tsx). **PARTIAL → contributes one page closer to HANDLED.**
- **2A-8** — `aria-current="page"` present on the active booking-history tab.
- **2A-9** — Required-field visible `*` markers on Note + Request-type labels in Cancelled colour. **PARTIAL → contributes one page closer to HANDLED.**

## client-detail — critique (v2)

> Supersedes the v1 critique above. Re-run after second-round polish.

**Nielsen heuristic scores (each /10)**

1. **Visibility of system status — 9/10.** Active tab filled Clinic Green with white count chip, counts beside every tab label, Next-visit hero band confirms upcoming inline, pending action buttons show a spinner; minor knock for filter chips lacking a result-count echo.
2. **Match between system and real world — 9/10.** Copy is plainspoken clinic language; minor friction is "Recent activity" vs "Recent audit activity" both appearing on the same 1440 view with overlapping meaning.
3. **User control and freedom — 8/10.** Back-to-clients link, Cancel on note form, clearable service-filter chip with × affordance, additive URL filters that survive reload; no undo for a saved note or submitted privacy request.
4. **Consistency and standards — 9/10.** AdminPanel/AdminPanelHeader throughout (H2 contract), AdminStatusBadge tone-paired with icon, full-border cards everywhere, no `border-l-4`; outlier: Pending-tinted "Profile note" and orange "Pinned sensitive note" share nearly the same hue.
5. **Error prevention — 8/10.** Required `*` marker, `coerceTab`/`coerceStatus` silently normalise bad URL params, hidden client_id, native `title` on every privacy request type explaining scope; "First visit booked" amber dot reads as warning when it is actually a lifecycle badge.
6. **Recognition rather than recall — 9/10.** Deterministic avatar disc with initials, lifecycle chip, source line, common-services clickable chips, audit-action humanised dictionary, tab counts visible at rest; keyboard shortcuts (n/b/p) are discoverable only via button tooltips.
7. **Flexibility and efficiency — 8/10.** Power paths exist (n/b/p shortcuts, WhatsApp deep-link, additive status+service URL filters, Print, common-service chip as one-click filter); no saved-view persistence and no "rebook last service" affordance.
8. **Aesthetic and minimalist design — 8/10.** Calm warm-ivory canvas, restrained type hierarchy, varied card shapes; the right column on 1440 in the empty-Upcoming state still has visible whitespace below the balance card.
9. **Help users recognise, diagnose, recover from errors — 8/10.** `role="alert" aria-live="polite"` on form-level + field-level error regions, Cancelled-family colour pair, plain-English copy; empty-filter state offers a "Clear filters" reset.
10. **Help and documentation — 7/10.** Native `title` tooltips on tabs, badges, privacy-request types, "New booking" CTA, shortcut keys; no inline keyboard-shortcut legend, no first-time hint surface for novice operators.

**Total: 83/100.**

**AI-slop verdict: PASS.** The page reads as a Rahma surface, not a generic dashboard: warm ivory canvas, status-family-tinted chips with icons + labels, Cormorant correctly absent (no marquee numerals on this page), no gradient text, no `border-l-4`, no glass, no hero-metric template, varied card composition. The category-reflex test passes — the disciplined-warmth intersection is intact.

**Commentary**

- Header now does real work: avatar disc tinted by deterministic hue, H1 + source-and-since subline, lifecycle pill, Print + New-booking right rail, Next-visit hero band immediately below — the "rebook fast" job-to-be-done is one glance away.
- Notes panel composition is the most considered surface: yellow-tinted Profile-note callout, orange Pinned-sensitive rail, then regular notes, then the Add-note ghost trigger that expands inline. Minor: Profile-note and Pinned-sensitive callouts are visually adjacent and similarly tinted, slightly weakening the "pinned = pay attention" signal.
- The empty-Upcoming 1440 layout puts a generous illustrated empty state in the main column with the Recent-activity balance card *underneath* rather than beside it. Consider promoting the balance card above the empty state.
- Filter strip well-restrained: only shows when 5+ bookings or filters applied, additive over tabs, dedicated service-filter dismiss chip. Minor: active status pill uses the same Clinic Green as the active tab pill, making the two pill rows compete.
- "First visit booked" lifecycle chip in Pending colours reads more like a warning than a milestone. A Confirmed-family tone would communicate "this is a state, not an alert" more honestly.
- Source code is clean: no nested AdminPanels, single H1, `list-none` on every `<ul>`, `aria-current="page"` + `aria-selected` on tabs, `whatsappHref` normalises UK leading-zero numbers, and unknown URL params silently coerce instead of erroring.

> **Note:** The v1 audit + critique entries above remain in this file for traceability. The v2 entries supersede them for Phase 7 reading.

## staff-detail — audit

### Dimension scores (0-4 each)

- **Visual hierarchy:** 3 — Two-column workstation is clean, sticky right rail works, header retired the decorative banner. Loss of half a point because brief §5 mandated H3 on rail panels (R1–R5) and H2 on main panels (L1–L3), but `AdminPanel` always emits `<h2>` so the rail flattens to H2. Profile-completion / Onboarding checklists ship as plain icon+label rows rather than the brief §4 `AdminStatusBadge`-shape pills.
- **Accessibility:** 3 — `aria-current="page"` on active tab (Sam #3), `role="alert" aria-live="polite" aria-atomic="true"` on both form error regions (2A-6), visible `*` markers in Cancelled text on required fields with `sr-only` "(required)" (2A-9), skip-link target preserved, focus rings present everywhere. Half point lost: checklist icons rely on shape + colour without the AdminStatusBadge pill the Named Status Rule wants.
- **Responsive design:** 3 — 375/768/1440 all clean (no horizontal scroll). Right rail stacks R1->R2->R3->R4 below main on mobile. Tab strip `overflow-x-auto`. Save / chips ≥ 40px (DESIGN.md AdminButton spec). Half point lost: `--admin-top-offset` sticky variable referenced with fallback (1.5rem) but layout may not define the var.
- **Brand alignment:** 3 — Warm ivory canvas, Clinic Green primary on active tab + Save, Restricted family for read-only chip rails. Half point lost: avatar tile hardcoded Confirmed-green for every staff (page.tsx:388) defeats the deterministic-hue token; L2 EmptyState uses Lucide `CalendarRange` (page.tsx:491) rather than the `assignments-quiet.svg` illustration.
- **Code quality:** 3 — RECON §5 untouchables intact, form field `name` attributes verbatim, server-action contracts untouched, risk-tier matrix wired via `ConfirmActionModal`, isOwnProfile + scope matrix preserved across all seven §11 cells. Half point lost: raw OKLCH literals in `ChecklistRow` (page.tsx:774-775); `border-dashed` on past-assignments `<details>` (page.tsx:511) clashes with DESIGN.md "no dashed borders".

### P0 findings

- none

### P1 findings

- Profile-completion + Onboarding checklist rows ship as plain icon + text (page.tsx:769-794) instead of `AdminEntityRow` + `AdminStatusBadge`-shape Confirmed/Cancelled pill brief §4 mandates. Raw OKLCH at page.tsx:774-775.
- Right-rail panel headings render as `<h2>` (via `AdminPanel`, admin-ui.tsx:293) while brief §5 R1–R5 specifies H3.
- Avatar tile (page.tsx:386-392) uses a single hardcoded Confirmed-family green for every staff member instead of the deterministic `hash(staff.id) % 360` hue algorithm.

### P2 findings

- L2 EmptyState uses Lucide `CalendarRange` (page.tsx:491) rather than `assignments-quiet.svg`.
- L2 EmptyState in admin scope omits "Show all assignments ->" CTA when count is zero (page.tsx:489-499).
- "Past assignments" `<details>` (page.tsx:511) uses `border-dashed` against DESIGN.md.
- Status panel title is `"Status"` (page.tsx:587) while brief §5 calls it `"Status & identity"`.
- R4 sub-line reads `"Inherits N permissions from role."` (page.tsx:684-687) — brief specifies `"Inherits {n} permission(s)"` without "from role".
- Admin-section Role + Gender radiogroups (StaffProfileForm.tsx:387-444) auto-save on click while safe-field subset requires explicit "Save profile" — inconsistent commit affordance.
- `--admin-top-offset` sticky var (page.tsx:585) may not be defined upstream.

### P3 findings

- `UserIcon` import (page.tsx:15) only renders when initials are empty — consider always-rendered initials.
- Inactive banner uses `ShieldCheck` (page.tsx:424); `Lock` from Restricted family would carry Named Status semantics better.
- `AssignmentCard` uses `Clock` icon next to city (page.tsx:937) — semantic mismatch.
- `permissions.map(p => p.replace(/_/g, " "))` at page.tsx:709 — share with `readableName()` helper from StaffPermissionOverridesForm.tsx:58.
- `relativeTime()` (page.tsx:131-145) returns empty string on NaN — empty `<time>` element.

### Backend status

HANDLED — staff-detail has no BLOCKS-REDESIGN BUILD dependency. RECON §5 untouchable helpers and both form server-action contracts wired verbatim. §10 Q3 soft adjustment (`limit(8)` -> `limit(16)`) applied at page.tsx:281 — non-blocking.

### P1 (tag for Phase 7 gauntlet)

- Checklist rows missing `AdminStatusBadge`-shape Confirmed/Cancelled pill — `src/app/admin/staff/[staffId]/page.tsx:769-794` (raw OKLCH at :774-775).
- Rail panels render as H2 instead of brief-specified H3 — `src/app/admin/staff/[staffId]/page.tsx` panels at :587/:624/:651/:678/:724/:731 (via `AdminPanel` title at `src/app/admin/components/admin-ui.tsx:293`).
- Avatar tile uses single hardcoded Confirmed-family tint instead of deterministic-hue algorithm — `src/app/admin/staff/[staffId]/page.tsx:386-392`.

### BUSINESS-COMPLETENESS impact

- **2A-6** — Form-level `role="alert" aria-live="polite" aria-atomic="true"` wrapped on both `StaffProfileForm` (StaffProfileForm.tsx:188-197) and `StaffPermissionOverridesForm` (StaffPermissionOverridesForm.tsx:106-116).
- **2A-8** — Active tab carries `aria-current="page"` and uses Clinic Green fill (page.tsx:436-437), not colour-only `border-b-2`. Sam #3 carry-forward landed.
- **2A-9** — Required `*` markers in Cancelled text with `aria-hidden="true"` + `sr-only "(required)"` adjacent to Full name and Gender labels (StaffProfileForm.tsx:483-487).


## staff-detail — critique

**Date:** 2026-05-18
**Phase:** 6 (post-polish)
**Reviewer:** independent Nielsen audit (no bias from build)
**Artefacts reviewed:** brief, PRODUCT.md, DESIGN.md, polish-final screenshots at 1440 / 768 / 375, `page.tsx`, `StaffProfileForm.tsx`.

### Nielsen heuristic scores (0–4)

| # | Heuristic | Score | One-line evidence |
|---|---|---|---|
| 1 | Visibility of system status | 4 | Status family chip in the header + identical chip on rail R1 + inactive banner + "n of N done" counts on both checklists + `aria-current="page"` on the active tab — the operator can never wonder what state they're in. |
| 2 | Match between system and real world | 3 | Voice is plain and clinical ("Bookings off", "No assigned bookings yet"). One leak: the role panel emits the raw mono slug `admin_practice_manager` under the display label — engineer-facing token. |
| 3 | User control and freedom | 3 | Breadcrumb, tab strip, "Add ->" jump-to-field, past-assignments `<details>`. No "Discard changes" affordance on the dirty profile form. |
| 4 | Consistency and standards | 3 | Layout mirrors `/admin/clients/<id>` and `/admin/staff/<id>/availability` per brief, status colours come from the token system. Slips: past-assignments `<details>` uses `border-dashed` (banned), and the active gender pill uses `bg-primary/10` text-on-tint while the active role pill uses solid Clinic Green fill — two different "selected pill" treatments. |
| 5 | Error prevention | 3 | Self-overrides editor swaps for a Restricted-tone banner; inactive banner above the tab strip; required `*` markers. The override `ConfirmActionModal` risk-tier matrix is wired on critical-grant/revoke and high-grant per brief §6, low/medium one-click. |
| 6 | Recognition rather than recall | 4 | Right rail keeps role, gender, status, availability link, completion %, and onboarding % permanently in view. Audit verbs are pre-mapped to English phrases. Initials avatar on the header carries identity. |
| 7 | Flexibility and efficiency | 3 | "Add ->" deep-links, "Show all assignments ->" / "Open audit trail ->" / "Open availability ->" cross-link to the right destinations with prefilters, "Show all permissions" disclosure keeps the chip thicket optional. No keyboard shortcuts (on-spec for novice operator surface). |
| 8 | Aesthetic and minimalist design | 3 | Flat header + breadcrumb + tab strip + 1fr/22rem grid lands a calm workstation rhythm. Two density complaints: at 1440 the right rail shows four panels of similar visual weight stacked tightly; on 768 the rail reflows under the empty Audit history so the operator scrolls past empty content to reach Status. |
| 9 | Help users recognize, diagnose, recover | 2 | Form-level error region is wired with `role="alert" aria-live="polite"` and toast fallbacks fire on save failure. No per-field validation copy in the live form (brief specifies "Add their full name.", "Phone number is too short. Include the area code.", "Trim the bio to 600 characters or fewer." — none appear inline). The 600-char counter is informational rather than blocking. |
| 10 | Help and documentation | 2 | Inline hint copy on every field is genuinely useful ("Inactive staff can't sign in.", "Off pauses new assignments without deactivating the account.", "Used for same-gender booking matching."). `title` tooltips on the avatar and cross-link Ghosts give micro-help. R5 override panel sub-line is one sentence and doesn't explain what an override does for a novice operator. |

**Total: 30 / 40.**

### AI-slop verdict: **PASS**

The redesign reads as a hand-shaped Rahma workstation, not a stock SaaS staff-detail template — varied panel compositions (form vs `dl` vs checklist vs chip cluster vs override switches), no decorative blobs, no purple/blue gradients, status is always badge+icon+label not colour alone, and the brief's panel order is honoured.

### Concrete commentary against PRODUCT.md anti-references

- **Generic SaaS / shadcn-default feel — clean.** The flat header, ivory canvas, Clinic Green active tab, and `AdminPanel` framing read as Rahma, not a stock CRUD page. The initials token on Hover-Moss-equivalent green is the right warmth gesture.
- **Identical-card grids — partial concern.** On 1440 the right rail's four stacked panels (Status, Profile completion, Onboarding, Role and permissions) read at very similar visual weight. The brief diversifies them (chip cluster on R4, icon-led rows on R2/R3, dl on R1), and they *are* different on close inspection, but the eye still parses "four panels of the same shape stacked".
- **Decorative blobs / glassmorphism — clean.** None present.
- **Colour-only status signalling — clean.** Every chip carries a text label, the checklist rows use `CheckCircle2` / `XCircle` Lucide icons paired with sr-only "complete" / "missing" text — Named Status Rule honoured well.
- **Side-stripe `border-l-4` — clean.** None.
- **Hero-metric template — clean.** Completion / onboarding ratios render as small compact badges + per-row lists, not as 4xl Cormorant numerals with supporting stacked stats.
- **Cormorant-as-decoration — n/a here.** Cormorant is correctly absent (this page has no marquee numerals).
- **Generic dashed-border empty hint — slip.** The past-assignments `<details>` shell uses `border-dashed` — small surface but a leftover on a page that bans dashed borders elsewhere.
- **Raw permission identifiers / engineer tokens on operator surfaces — partial slip.** Brief explicitly de-leaks `view_staff` on access-denied (done), but R4 still renders `admin_practice_manager` mono slug as a code chip under the display label.
- **Cards must be varied and considered — mostly honoured.** L1 form, L2 list with collapsible past, L3 audit ledger, R1 status + dl, R4 chip-cluster disclosure — variety is real. R2/R3 sibling pair is the closest to the failure mode.
- **"Calm, scannable, dignified" — honoured.** No shouting, no neon, type hierarchy intact, copy is plain.

### Headline issues worth fixing before merge

1. **Add inline per-field validation copy** (brief §11 Error messages) — the recovery heuristic is the weakest score and the copy is already specified.
2. **Drop the mono `role.name` slug** from R4 or move it to a `title` tooltip — operator-facing engineer leakage.
3. **Replace `border-dashed` on the past-assignments disclosure** with a solid 1px Warm Veil border + tonal lift.
4. **Reconsider the gender pill's "active = tint, no fill" treatment** so it matches the role pill's "active = solid Clinic Green fill" — one selected-pill pattern per form.
5. **Tablet (768) panel order** — rail collapses below an empty Audit history; either reorder for ≤xl or hide Audit when empty.


## staff-detail — audit (rev 2)

**Date:** 2026-05-18
**Reviewer:** independent code+design audit (no build bias)
**Artefacts reviewed:** brief, PRODUCT.md, DESIGN.md (incl. Admin-Specific Patterns), IMPLEMENTATION-PLAN.md row 19, BUSINESS-COMPLETENESS.md Track A, screenshots `improvements-{1440,768,375}.png` + `public-removed-1440.png`, `page.tsx`, `StaffProfileForm.tsx`, `StaffPermissionOverridesForm.tsx`, `RolePermissionsPanel.tsx`, `StaffDetailShortcuts.tsx`, `admin-ui.tsx` AdminPanel.

### Dimension scores (0-4 each)

- **Visual hierarchy:** 3 — Two-column workstation reads calm and ordered: breadcrumb → flat header with avatar + status pill + last-modified caption + prev/next arrows → tab strip → 1fr/22rem grid. Variety is real: form (L1), list with collapsible past (L2), audit ledger or empty pill-row (L3), dl + link (R1), tinted-pill checklists (R2/R3), chip-cluster disclosure (R4), tri-state override editor (R5). Half-point loss: rail panels still render as `<h2>` via `AdminPanel` (admin-ui.tsx:293), brief §5 R1-R5 = H3 contract unmet; on 1440 the four stacked rail panels still parse at similar visual weight.
- **Accessibility:** 3 — `aria-current="page"` on active tab, `role="alert" aria-live="polite" aria-atomic="true"` on both form error regions, visible `*` markers + sr-only "(required)", `aria-label` on prev/next arrows, `aria-checked` on radiogroups, `sr-only "complete"/"missing"` on checklist rows, `aria-busy` on save, skip-link target preserved. Half-point loss: shortcut handler's "Save" lookup `textContent?.trim().startsWith("Save profile")` (StaffDetailShortcuts.tsx:49-52) is brittle and Cmd+S can fail silently with no announcement; static last-modified caption has no `<time dateTime>` element (page.tsx:480-486).
- **Responsive design:** 3 — All three breakpoints clean, no horizontal scroll, rail collapses below main on <xl. Sticky save bar on mobile when dirty with ≥44px tap targets; tab strip `overflow-x-auto`; header collapses on <sm; prev/next arrows shrink-0. Half-point loss: `xl:sticky xl:top-[var(--admin-top-offset,1.5rem)]` (page.tsx:717) depends on a layout-provided var that isn't asserted; 768 reflows the rail under an empty Audit pill (rev 1 critique slip #5 still present, though pill is smaller than the prior full panel).
- **Brand alignment:** 3 — Warm ivory canvas, Clinic Green active tab + Save, Restricted-family decorative chips on read-only profile, status families consistent, no `border-l-4`, no gradient text, no dashed borders (rev 1 P2 cleared), green-tinted shadow on the mobile sticky bar. Half-point loss: avatar tint uses deterministic-hue token (hash % 360) but single saturation+lightness pair, so all avatars read at near-identical chroma; L2 EmptyState still uses Lucide `CalendarRange` (page.tsx:615) instead of `assignments-quiet.svg`.
- **Code quality:** 3 — RECON §5 untouchables intact, server-action contracts preserved, named form fields verbatim, risk-tier matrix wired, all seven §11 cells gated, deterministic-hue avatar implemented, dirty-state derived from useMemo, audit empty state collapsed to inline pill. Half-point loss: keyboard-shortcut Save couples a global hotkey to a button label string (StaffDetailShortcuts.tsx:49-52); raw OKLCH literals at page.tsx:891-892 leak design-token-bypass; `siblingStaff` query (page.tsx:307-310) reads all staff with no `active`/scope filter, so prev/next can jump to a denied page.

### P0 findings

- none

### P1 findings

- Right-rail panel headings still render as `<h2>` instead of brief-specified H3 (R1-R5) — `src/app/admin/components/admin-ui.tsx:293` flows to `src/app/admin/staff/[staffId]/page.tsx` panels at :720, :758, :785, :811, :841, :848. **Unchanged from rev 1.**
- Prev/next sibling query (`page.tsx:307-310`) selects from `staff_profiles` with no `active`/scope filter; arrow can route an Assignment-scope coordinator or same_gender_team therapist to a staff URL that immediately renders the out-of-scope denied surface.
- Cmd+S shortcut (`StaffDetailShortcuts.tsx:49-57`) couples to button `textContent` and to `!btn.disabled`; on a clean form the hotkey is a silent no-op with no toast or aria-live announcement.

### P2 findings

- L2 EmptyState uses Lucide `CalendarRange` (page.tsx:615) instead of brief's `assignments-quiet.svg`.
- Checklist rows (page.tsx:886-911) ship as plain `Icon + label + sr-only` without the `AdminStatusBadge`-shape Confirmed/Cancelled pill brief §4 specifies; raw OKLCH at :891-892.
- Last-modified caption wraps the relative time in a `<p>` rather than `<time dateTime={...}>`.
- Toggle label `Show phone on public profile` (StaffProfileForm.tsx:263) still says "public profile" though the rev-2 polish-pass removed phantom public-facing references; label now mismatches the field hint at :264 which talks about "staff-profile visibility".
- `--admin-top-offset` sticky var consumed with `1.5rem` fallback — verify the admin layout defines this var.
- 768 layout reflows the rail under an empty Audit history pill — rev 1 critique slip #5 still present (smaller surface now, but reflow remains).
- Inactive banner uses `ShieldCheck` icon — `Lock` from Restricted family would carry Named Status semantics; rev 1 P3 unaddressed.

### P3 findings

- Avatar deterministic hue uses fixed lightness/chroma — all avatars land at near-identical perceptual chroma despite hue rotation.
- `relativeTime()` returns empty string on NaN — empty captions on header and audit rows for malformed timestamps.
- `permissions.map(...)` in page.tsx:322-324 vs `readableName()` in `StaffPermissionOverridesForm.tsx:58` and `RolePermissionsPanel.tsx:11` — three copies of the same trivial transform.
- `_staffId: staffId` in `StaffDetailShortcuts.tsx:25` is an unused prop.
- `AssignmentCard` uses `Clock` icon next to city — semantic mismatch.
- `UserIcon` import only renders when initials are empty (effectively dead branch since deterministic-hue avatar always emits initials).
- ToggleRow knob `shadow-sm` (StaffProfileForm.tsx:648) bypasses the green-tinted shadow rule.

### Backend status

HANDLED — no BLOCKS-REDESIGN BUILD dependency. RECON §5 untouchable helpers intact; both form server-action contracts preserved verbatim; §10 Q3 soft adjustment (`limit(8)` → `limit(16)`) applied at page.tsx:294; new `siblingStaff` + `lastModifiedRows` queries are additive reads on existing tables.

### Prior P1 status

- **Checklist pills missing AdminStatusBadge shape** — **partially resolved.** Per-panel header now carries a Confirmed/Pending/Cancelled `AdminStatusBadge` pill via `checklistTone()` (page.tsx:762-767, 788-793). Per-row remains plain Lucide icon + raw OKLCH literals (page.tsx:888-895).
- **Rail H2/H3 contract** — **unchanged.** `AdminPanel.title` still emits `<h2>`. Brief §5 R1-R5 = H3 requirement unmet.
- **Deterministic-hue avatar** — **resolved.** `hueFromId()` implemented at page.tsx:102-108 with hash(staff.id) % 360 per Brief 00 §4.

### P1 (tag for Phase 7 gauntlet)

- Rail panels render as H2 instead of brief-specified H3 — `src/app/admin/components/admin-ui.tsx:293` flows to `src/app/admin/staff/[staffId]/page.tsx` panels at :720, :758, :785, :811, :841, :848.
- Prev/next sibling query has no `active`/scope filter — `src/app/admin/staff/[staffId]/page.tsx:307-310`.
- Cmd+S shortcut silent no-op on clean form / disabled save — `src/app/admin/staff/[staffId]/StaffDetailShortcuts.tsx:49-57`.

### BUSINESS-COMPLETENESS impact

No newly-contributed Track A items in this revision pass. Rev 1 contributions stand (2A-6, 2A-8, 2A-9).


## staff-detail — critique (rev 2)

**Date:** 2026-05-18
**Phase:** 6 (post-second-pass polish — public-facing UX removed, dirty-state save bar, sibling arrows, deterministic avatar hue, category-grouped overrides, filter inputs)
**Reviewer:** independent Nielsen audit (no bias from build)

### Nielsen heuristic scores (0–4)

| # | Heuristic | Score | Evidence |
|---|---|---|---|
| 1 | Visibility of system status | 4 | Status chip in header + on R1 + inactive banner + tinted "n of N done" badges + `aria-current="page"` + dirty-state Save + last-modified caption + per-row Effective/Not-effective chip on overrides. |
| 2 | Match between system and real world | 4 | Plain clinic language throughout. The rev-1 leak (mono `admin_practice_manager` slug under role display) is removed from the live surface; both R1 and R4 keep it in `title` only. |
| 3 | User control and freedom | 4 | Breadcrumb, prev/next sibling arrows, tab strip, anchor-link Add jump-to-field, past-assignments `<details>`, three-mode override radiogroup, Discard changes on dirty form, sticky mobile Discard+Save bar, Cmd+S / Cmd+] / Cmd+arrow shortcuts. |
| 4 | Consistency and standards | 4 | Layout mirrors `/admin/clients/<id>` and `/admin/staff/<id>/availability`. Past-assignments `<details>` now solid 1px border; Role + Gender pills share solid Clinic Green fill on active. `aria-orientation="horizontal"` declared on both radiogroups. |
| 5 | Error prevention | 3 | Self-overrides lockout banner; inactive banner; required `*` markers; ConfirmActionModal risk-tier matrix on critical-any + high-grant; bio textarea hard-caps with live counter. Gap: no client-side validation gate before submit. |
| 6 | Recognition rather than recall | 4 | Right rail keeps gender, role, status, availability link, completion %, onboarding %, role-permissions count, override delta permanently in view. Filter inputs on both R4 chip thicket and R5 overrides list. |
| 7 | Flexibility and efficiency | 4 | Add deep-links scroll-and-focus; cross-link Ghosts with prefilters; Show all permissions disclosure; filter inputs on both permission surfaces; prev/next sibling arrows; Cmd-shortcuts layered on visible UI. |
| 8 | Aesthetic and minimalist design | 3 | Flat header + 1fr/22rem grid lands a calm rhythm; varied card compositions across L1-L3 / R1-R5. Residual density at 1440: R2 (Profile completion) and R3 (Onboarding) remain twin-shaped. Empty-audit inline pill (rev-2 lift) fixes the worst-case tablet reflow. |
| 9 | Help users recognize, diagnose, recover | 3 | Form-level `role="alert"` region wired; toast fallback on save failure; per-override row failure toasts. Risk-tier confirms surface plain-English consequence copy. Still missing: brief-specified per-field inline validation copy. |
| 10 | Help and documentation | 3 | Inline hint copy on every field; R5 carries scope + risk + effective chips with leading icons doubling as micro-help; `title` tooltips on avatar, cross-link Ghosts, prev/next arrows, database-role badge. R5 sub-line could spell out *what* an override is for a novice. |

**Total: 36 / 40.**

### AI-slop verdict: **PASS (improved)**

The redesign reads as a hand-shaped Rahma workstation, not a stock SaaS staff-detail template — varied panel compositions, no decorative blobs, no purple/blue gradients, status is always badge+icon+label not colour alone, the brief's panel order is honoured, and rev-2 specifically removed the residual engineer leakage (mono role slug) and the residual generic-CRUD slip (dashed `<details>` border, two-treatment selected-pill). Deterministic-hue initials avatar is a small but real signature gesture that no scaffold would emit.

### Concrete commentary against PRODUCT.md anti-references

- **Generic SaaS / shadcn-default feel — clean.** Flat header, ivory canvas, Clinic Green active tab, deterministic-hue initials token, `AdminPanel` framing throughout — reads as Rahma. Sibling arrows + last-modified caption are clinic-workstation gestures.
- **Identical-card grids — partial concern, narrower than rev 1.** R2 (Profile completion) and R3 (Onboarding) remain visually sibling-shaped — both "ratio badge + icon-led row list with leading status icons". The brief diversifies the other rail panels; only R2↔R3 reads as twins.
- **Decorative blobs / glassmorphism — clean.** Mobile sticky save bar uses `backdrop-blur` + green-tinted shadow per DESIGN.md — purposeful, not decorative.
- **Colour-only status signalling — clean.** ChecklistRow pairs `CheckCircle2`/`XCircle` with sr-only "complete"/"missing"; override rows pair Effective/Not-effective chips with tonal differentiation + textual label.
- **Side-stripe `border-l-4` — clean.** None.
- **Hero-metric template — clean.** Completion/onboarding ratios are compact `AdminStatusBadge` pills.
- **Cormorant-as-decoration — n/a here.** Correctly absent.
- **Generic dashed-border empty hint — clean (rev-2 fix).** Past-assignments `<details>` uses 1px solid border + `--admin-panel-muted/60` tonal lift.
- **Raw permission identifiers — clean on R1/R4, defensible on R5.** Brief de-leaks `view_staff` on access-denied; mono `role.name` hidden into `title` tooltip on R1 + R4. The slug still appears under each row title inside the R5 overrides editor — admin-on-admin surface, durable identifier.
- **Cards must be varied and considered — honoured.** L1 form, L2 list with collapsible past, L3 audit ledger or empty inline pill, R1 dl, R4 chip-cluster disclosure with filter, R5 category-grouped switch list with filter.
- **"Calm, scannable, dignified" — honoured.** No shouting, no neon, type hierarchy intact, plain copy. Dirty-state Discard stays muted Ghost; only Save carries primary fill.

### Delta vs rev 1

- **H1 Visibility:** 4 → **4 (same)**. Already at ceiling.
- **H2 Real world:** 3 → **4 (up)**. Mono role slug leak removed from live surface (now in `title` only).
- **H3 Control & freedom:** 3 → **4 (up)**. Rev-2 added dirty-state Discard, sticky mobile bar, sibling arrows, Cmd-shortcuts.
- **H4 Consistency:** 3 → **4 (up)**. Both rev-1 slips fixed: dashed `<details>` border replaced with solid; Role + Gender selected pills now share solid Clinic Green fill.
- **H5 Error prevention:** 3 → **3 (same)**. Matrix wired already in rev 1; no new client-side validation gate added.
- **H6 Recognition:** 4 → **4 (same)**. Already at ceiling; deterministic-hue avatar + filter inputs strengthen the floor.
- **H7 Flexibility & efficiency:** 3 → **4 (up)**. Prev/next arrows, Cmd-shortcuts, filter inputs on R4 and R5 — efficient-use lifts.
- **H8 Aesthetic & minimalist:** 3 → **3 (same)**. Tablet panel-order partially addressed (empty audit collapsed to inline pill); R2/R3 twin shape still present.
- **H9 Recognize/diagnose/recover:** 2 → **3 (up)**. Per-override-row failure toasts with permission-specific copy; risk-tier confirm bodies add diagnostic specificity.
- **H10 Help & documentation:** 2 → **3 (up)**. Per-row scope/risk/effective chips embed micro-help; tooltip layer expanded.

**Δ total: 30 → 36 (+6).** Every rev-1 headline-issue fix landed; only per-field validation copy and R2/R3 twin-panel rhythm remain.

### Headline issues still worth fixing before merge

1. **Add inline per-field validation copy** (brief §11 Error messages) — empty Full name, malformed Phone, missing Gender all fall through to server toast.
2. **Differentiate R2 (Profile completion) from R3 (Onboarding)** — the only sibling-shape pair in a varied page.
3. **Spell out the R5 sub-line for novices** — "Overrides sit on top of the fixed role bundle" assumes the operator already knows what the role bundle is.
### Dimension scores (0-4)
- Information architecture: **4** — two-column desktop (`1fr / 22rem`) at `page.tsx:215`, sticky category headers `page.tsx:265`, danger-zone segregated `page.tsx:366`; mobile stacks per brief §5.
- Visual hierarchy: **3** — H1 + role-letter token + status chips land cleanly (`page.tsx:164-213`), sticky category labels work; however, the chip-row at 1440 wraps under the H1 awkwardly when name is long and the granted count `/` numerator collides visually with the badge tone shift.
- Accessibility: **3** — `role="alert" aria-live="polite" aria-atomic="true"` on metadata form (`RoleMetadataForm.tsx:48`); Switch carries `aria-label` granted/revoked (`PermissionRow.tsx:193`); `aria-pressed` on filter chips; `<label sr-only>` for search; but Switch wrapper has no `aria-busy` and pending state lives on a non-aria text node (`PermissionRow.tsx:195-209`).
- Brief compliance: **3** — almost fully covers §4-§8; missing: brief calls "Apply filters" Secondary button, current strip is fully reactive without explicit Apply; AdminFilterBar mobile sheet (§5 Mobile) is not implemented — strip stays inline on mobile.
- Code quality: **3** — clean component decomposition, idiomatic `useActionState`/`useTransition`; but `DangerZonePanel` accepts `description` / `sortOrder` it only re-submits as hidden fields (coupling) and passes the description as a serialized hidden input, risking staleness if the metadata form is dirty when Deactivate fires.

### P0 findings
- none

### P1 findings (tag for Phase 7 gauntlet)
- `DangerZonePanel.tsx:93-99` — Deactivate form re-submits server-rendered metadata; will clobber unsaved edits if the Owner has dirty edits in the metadata form when Deactivate fires.
- `PermissionRow.tsx:189-194` — Switch missing `aria-busy="true"` during in-flight toggle (brief §6 pending state spec).
- `PermissionsFilterStrip.tsx:100-247` — No mobile "Filters" Ghost → AdminSheet pattern; brief §5 Mobile requires it on `≤lg`. Filter strip stacks tall on 375px.

### P2 findings
- `page.tsx:258` permissions list panel `lg:max-h-[min(72vh,720px)] lg:overflow-y-auto` — sticky headers inside this nested scroll on a 1366×768 screen can fight page scroll.
- `PermissionRow.tsx:127` — `direction` derivation may stale on modal re-open after a failed toggle (low likelihood).
- `DangerZonePanel.tsx:232-236` — Delete FAKE-degrade toast uses default auto-dismiss; brief §6 system errors should persist (no auto-dismiss).
- `page.tsx:209` `<RoleDescription>` is forward-referenced — cosmetic.

### P3 findings
- `page.tsx:3` `ShieldCheck` reused as both decoration and category indicator slightly muddies meaning.
- `page.tsx:34` `firstLetter` returns "•" fallback — bullet glyph reads odd in a token tile.
- `PermissionRow.tsx:138` raw `oklch(95.5%_0.012_155)` instead of named Hover Moss token.
- `RoleMetadataForm.tsx:51,108` raw `oklch(26%_0.14_25)` for required `*` and error region; canonical token preferred when exposed.
- `PermissionRow.tsx:215` modal backdrop `bg-[oklch(12%_0.01_165)]/35` — raw oklch; DESIGN.md §4 specifies green-tinted shadow tokens.
- `DangerZonePanel.tsx:200` FAKE banner uses raw oklch info tones; should use Pending tokens.

### Backend status
**FAKE** — Delete-role flow is staged with `data-redesign-fake="delete-role"` and renders a toast-only stub. Blocking BUILD plan: **`BUILD-delete-role.md`** (per IMPLEMENTATION-PLAN.md, non-blocking). All other server-actions (`updateRoleMetadata`, `toggleRolePermission`) are HANDLED and live.

### P1 (tag for Phase 7 gauntlet)
- DangerZonePanel deactivate form may clobber unsaved metadata edits — `DangerZonePanel.tsx:93-99`
- Switch missing `aria-busy` during pending toggle — `PermissionRow.tsx:189-194`
- No mobile Filters AdminSheet; strip stacks tall on 375px — `PermissionsFilterStrip.tsx:100-247` (brief §5 Mobile)

### BUSINESS-COMPLETENESS impact
- **2A-6** — form-level `role="alert" aria-live="polite" aria-atomic="true"` correctly implemented at `RoleMetadataForm.tsx:46-56`.
- **2A-9** — visible required-field `*` markers in Cancelled text at `RoleMetadataForm.tsx:64-66` and `:108-110`.

## role-detail — audit (round 2)

**Date:** 2026-05-18 (after the 10-fix follow-up: B1, B2, B3+A1, V11+V12, G4, G2+G3, C1, V15+W1, V2, C12)

### Severity rubric (verbatim, impeccable v5 L884-890)
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

### Dimension scores (0-4)
- Information architecture: **4** (R1: 4) — unchanged.
- Visual hierarchy: **4** (R1: 3, +1) — H1/H2/H3 cascade clean (`page.tsx` H1, AdminPanel emits H2 "Permissions", explicit H3 on the three right-rail panels). Mobile sticky save bar + Pending "Unsaved changes" chip restore visual cadence at 375.
- Accessibility: **4** (R1: 3, +1) — Switch wrapper now `aria-busy` (`PermissionRow.tsx:190`); `aria-label` appends "(saving)" (`PermissionRow.tsx:196`). Pending-family self-revoke banner with `role="status"`. Form-level alert + visible required `*` preserved.
- Brief compliance: **4** (R1: 3, +1) — Mobile filter sheet (`PermissionsFilterStrip.tsx:125-154`), Inactive-system chip coercion + lifecycle suppression, Deactivate preserves unsaved edits (`DangerZonePanel.tsx:48-62`), audit trail link landed (`DangerZonePanel.tsx:145-152`).
- Code quality: **4** (R1: 3, +1) — `DangerZonePanel` no longer carries duplicate metadata props; submits via `document.getElementById(metadataFormId).requestSubmit()` — single source of truth. FAKE banner copy operator-voiced.

**Total: 20 / 20** (up from 16 / 20 in round 1).

### P0 findings
- none

### P1 findings
- none

### P2 findings
- `PermissionRow.tsx:218` and `DangerZonePanel.tsx:161` — Modal backdrops still use raw `oklch(12%_0.01_165)/35` instead of named `--admin-shadow-overlay`.
- `DangerZonePanel.tsx:223-225` — FAKE delete error toast uses default duration (auto-dismisses); brief §6 says system errors should persist.
- `DangerZonePanel.tsx:48-62` — Deactivate uses a 1000ms `setTimeout` to reset `submitting`; should lift `pending` from form state via context, not a wall-clock guess.
- `page.tsx:280` permissions list `max-h-[70vh] lg:max-h-[min(72vh,720px)]` — nested-scroll-vs-page-scroll conflict possible on small laptops and 375.

### P3 findings
- `PermissionRow.tsx:138,358` raw `oklch(95.5%_0.012_155)` for hover — should resolve to Hover Moss token.
- `RoleMetadataForm.tsx:96,139` raw `oklch(26%_0.14_25)` on `*` markers and error well.
- `DangerZonePanel.tsx:68,193` raw `oklch(96%_0.038_75)` / `oklch(28%_0.12_55)` for Pending wells.
- `DangerZonePanel.tsx:124,229` raw `oklch(40%_0.14_25)` on Destructive button.
- `page.tsx:3` `ShieldCheck` still doubles as decoration and sticky category indicator — minor semantic muddiness.
- `RoleMetadataForm.tsx:42-46` `checkDirty` for `is_system` roles flips falsely due to hidden `active=on` shadow; edge case only.

### Backend status
**FAKE** — Delete-role still gated by `data-redesign-fake="delete-role"` (`DangerZonePanel.tsx:115`). Blocking BUILD plan: **`BUILD-delete-role.md`** (non-blocking). All other server actions HANDLED.

### P1 (tag for Phase 7 gauntlet)
- none

### BUSINESS-COMPLETENESS impact
- **2A-6** — form-level `role="alert" aria-live="polite" aria-atomic="true"` preserved (`RoleMetadataForm.tsx:67-78`).
- **2A-9** — visible required `*` markers preserved (`RoleMetadataForm.tsx:96-98, 139-141`).
- **2A (mobile)** — sticky save bar with Pending-family "Unsaved changes" chip (`RoleMetadataForm.tsx:214-243`) adds dirty-state visibility on 375.

### Round 1 → Round 2 P1 status
- **R1-P1 #1** Deactivate clobbers unsaved edits: **CLOSED** — `flipActiveAndSubmit` mutates the live `#role-metadata-form` checkbox and `requestSubmit()`s it.
- **R1-P1 #2** Switch missing `aria-busy`: **CLOSED** — wrapper carries `aria-busy={pending || undefined}` + `aria-label` "(saving)" suffix.
- **R1-P1 #3** No mobile Filters AdminSheet: **CLOSED** — mobile branch renders `Filters` trigger with `AdminSheet` bottom-anchored.

Net P1 count: 3 → 0.

## role-detail — critique (round 2)

**Date:** 2026-05-18
**Reviewer:** independent re-critic (no implementation context, no bias from round 1)
**Screenshots reviewed:** after-fixes-1440-final / -owner-self / -inactive-system / after-fixes-375-therapist / -filter-sheet / -dirty / -sticky-save-bar
**Source verified:** `page.tsx`, `PermissionRow.tsx`, `RoleMetadataForm.tsx`, `DangerZonePanel.tsx`, `PermissionsFilterStrip.tsx`

### Nielsen heuristic scores (0–4)

| # | Heuristic | Score | Delta |
|---|---|---|---|
| 1 | Visibility of system status | **4** | (R1: 4) — unchanged. Switch carries `aria-busy` + visible spinner + "saving" label; mobile sticky save bar surfaces dirty form state. |
| 2 | Match between system and real world | **4** | (R1: 3, **+1**) — FAKE banner reworded; mono identifier hidden on mobile. |
| 3 | User control and freedom | **4** | (R1: 3, **+1**) — Deactivate uses `form.requestSubmit()` so unsaved edits travel with the lifecycle change. Mobile dirty bar gives a Discard escape. |
| 4 | Consistency and standards | **3** | (R1: 3) — Hand-rolled Base UI Dialog instead of shared `ConfirmActionModal` still flagged. |
| 5 | Error prevention | **4** | (R1: 4) — Inactive-system row correctly suppresses lifecycle buttons. Owner self-revoke banner warns before the toggle. |
| 6 | Recognition rather than recall | **3** | (R1: 3) — Mobile filter sheet collapses Risk / Category / Granted-only behind a Ghost trigger. |
| 7 | Flexibility and efficiency of use | **3** | (R1: 3) — No bulk actions; search form-submit not live. |
| 8 | Aesthetic and minimalist design | **4** | (R1: 3, **+1**) — Mobile row now reads cleanly with the mono token removed; right-rail H3 outline reads as a quiet sub-system. |
| 9 | Help users recognise, diagnose, recover from errors | **4** | (R1: 3, **+1**) — FAKE banner now speaks Rahma's voice. Owner self-revoke banner pre-warns rather than catching after the fact. |
| 10 | Help and documentation | **3** | (R1: 3) — Audit-trail link gives the Owner an in-context history without leaving the page. |

**Total: 36 / 40** (up from 32 / 40 in round 1).

### AI-slop verdict: **PASS**

Risk-tiered confirms, grouped sticky categories, dignified inactive-system handling, and an audit-trail escape hatch make this read as a deliberate Owner workstation — not a generic shadcn permissions grid.

### UX-quality / PRODUCT.md anti-reference mapping

The surface continues to honour PRODUCT.md's "auditable and reversible" principle (every mutation has a visible audit trail link; destructive paths gate behind confirm) and its "calm, scannable, visual" principle (mono identifier mobile-collapse and right-rail H3 hierarchy cut visual density without losing depth). One round-1 regression still stands: the hand-rolled Base UI Dialog inside `PermissionRow.tsx:216` / `DangerZonePanel.tsx:154` continues to drift from the brief's "standardise the destructive pattern via `ConfirmActionModal`" mandate — a consistency-and-standards debt. No anti-reference breaches: no `border-l-4`, no hero-metric, no gradient text, no colour-only status, no raw permission identifier on the denied surface, FAKE banner no longer leaks build-process vocabulary.
## staff-availability — audit

### Dimension scores
- **Brief Adherence:** 4/5
- **Token Discipline:** 3/5
- **Accessibility:** 4/5
- **Information Architecture:** 5/5
- **Production Polish:** 4/5

### P0 findings
- None blocking release. Backend is FAKE as planned; flagged correctly.

### P1 findings
- Brief deviation: Panel B uses Date/Reason inline form, drops visible "All day" checkbox required by §5/Copy. StaffBlockedDatesManager.tsx:139 hard-codes hidden all_day input with only a small right-aligned label hidden on mobile.
- Brief deviation: Panel A missing per-day "Working day toggle" semantics + empty-state "Add rule" Ghost CTA. StaffAvailabilityRulesForm.tsx:136-225.
- Empty states use dashed-border `<p>` placeholders instead of illustrated EmptyState — DESIGN.md §5 bans dashed borders. StaffAvailabilityRulesForm.tsx:221, StaffBlockedDatesManager.tsx:231, StaffAvailabilityOverridesManager.tsx:373.

### P2 findings
- Raw oklch literals (Cancelled text repeated 15+ times across the four files) instead of CSS variable tokens. Brief §4 listed "raw var(--rahma-*)" as the carry-forward; the redesign replaced one escape with another.
- Inactive banner uses raw oklch (`page.tsx:169`) instead of a Restricted-family token.
- Retry-toast handlers cast a fake FormEvent (StaffBlockedDatesManager.tsx:97-100, StaffAvailabilityOverridesManager.tsx:142-147).
- Tab strip uses literal `text-white` instead of Field White token (`page.tsx:159`).

### P3 findings
- `formatDateLong` duplicated across two managers — extract to shared util.
- `StaffAvailabilityActionState.success` declared in actions.ts:12 but unused.
- AvailabilityModeSelector keeps `global_with_overrides` dead union member.
- Mobile users get no visible "All day" indication on Panel B add-form.

### Backend status
**FAKE.** Confirmed via `data-redesign-fake` attributes; `actions.ts:36-79` returns sentinel errors. Pending plans (verbatim): `BUILD-staff-blocked-dates-actions.md`, `BUILD-staff-availability-override-actions.md`.

### P1 (tag for Phase 7 gauntlet)
- Brief deviation — Panel B "All day" checkbox missing as visible control: `src/app/admin/staff/[staffId]/availability/StaffBlockedDatesManager.tsx:139,170`
- Brief deviation — Panel A working-day toggle + empty-state CTA: `src/app/admin/staff/[staffId]/availability/StaffAvailabilityRulesForm.tsx:136-225`
- Empty states violate DESIGN.md §5: `StaffAvailabilityRulesForm.tsx:221`, `StaffBlockedDatesManager.tsx:231`, `StaffAvailabilityOverridesManager.tsx:373`

### BUSINESS-COMPLETENESS impact
- 2A-6 contributes (`role="alert" aria-live="polite" aria-atomic="true"` on Panel B + C forms).
- 2A-9 contributes (visible `*` markers in Cancelled-family colour).
- 2A-8 resolved (tab strip `aria-current="page"`).
- 2A-4 resolved (H1 + four contiguous H2s via AdminPanel).

## staff-availability — critique

### Nielsen heuristic scores (out of 5)

| Heuristic | Score |
|---|---|
| Visibility of system status | 4.5 |
| Match between system and real world | 4.5 |
| User control and freedom | 4 |
| Consistency and standards | 4.5 |
| Error prevention | 4 |
| Recognition rather than recall | 4 |
| Flexibility and efficiency | 3.5 |
| Aesthetic and minimalist design | 4 |
| Help users recognize, diagnose, and recover from errors | 4 |
| Help and documentation | 3.5 |

### AI-slop verdict: PASS
Three-manager stack reads as a deliberate single-axis-edit workstation; flat header + status-paired pill+segmented control + quiet inline lines for empty states + no decorative chrome → feels Rahma, not template.

### Commentary (PRODUCT.md anti-references)
- No generic SaaS / shadcn-default — flat header (40px avatar + H1 + Soft Slate sub-line + tabs); active tab Clinic Green fill + Field White + aria-current (Sam #3 resolved).
- No identical-card grids — three AdminPanels are shape-varied (per-day rule grid / XCircle date rows / Calendar date+time rows).
- No decorative blobs / gradient / side-stripe.
- Status never colour-only — mode pill pairs tint + icon + label; inactive banner pairs Restricted tint + Lock icon + sentence.
- Voice anchors land — plain operator-grade copy, "Your availability" self-view sub-line.

### Notable UX weaknesses
- Mobile-only sticky bottom nav overlaps Panel A's "Save hours" button — material z-index collision worth fixing.
- Help is light: no inline "Where do global hours come from?" beyond the Ghost link.
- Panel A's add-row inputs look enabled when globalModeLocked — disabled `Save hours` is the only visible signal; group-dim would help error-prevention.


## staff-availability — audit (v2 after polish)

### Dimension scores
- **Brief Adherence:** 5/5 (was 4/5) — Visible "All day" checkbox in Panel B, per-day Working-day toggle on rule rows, illustrated EmptyState in all three managers, "Add rule" Ghost + "Start from global hours" in Panel A empty state, Pending soft-warning banner uses token classes, first-person confirm body for self-view. Brief §5 / §6 / Copy table all reconciled.
- **Token Discipline:** 4/5 (was 3/5) — Family tokens extracted to lib.ts and applied across all four files. Three residual raw oklch literals remain: avatar bg in page.tsx, Trash hover, BookingGuardModal scrim + destructive button.
- **Accessibility:** 5/5 (was 4/5) — `aria-describedby` on mode-selector group, every form error block carries the `role=alert aria-live=polite aria-atomic=true` triplet, 44×44 row Trash hits, `aria-pressed` on segmented control, native `title` with full weekday on row dates, `aria-current="page"` retained. Inline-style `color:#fff` is a workaround but passes contrast.
- **Information Architecture:** 5/5 (held) — Three-manager fixed order; upcoming-vs-past disclosure with rotating chevron; reason column re-weighted as widest in Panel C; count badges in panel headers; bookings-by-date guard ports global pattern cleanly.
- **Production Polish:** 5/5 (was 4/5) — Shared lib.ts removed duplicate formatDateLong; Pending soft-warning + Restricted inactive banner use token classes; mode buttons h-11 on mobile; rotating chevron on past disclosures; per-section "Last saved by…" sub-line; tab strip momentum-scroll prevents stacking.

### P0 findings
None.

### P1 findings
None — every v1 P1 is closed.

### P2 findings
- Working-day checkbox in Panel A is hard-coded `checked={true}` and un-check just deletes the rule. Functional but reads as a control rather than a destructive shortcut; users may not realise un-check = delete (no confirm). Either gate through `ConfirmActionModal` or relabel.
- BookingGuardModal hard-codes destructive bg + scrim inline instead of via shared modal primitive (`StaffBlockedDatesManager.tsx:393,436`).
- Sticky mobile bottom-nav still overlaps the lowest Panel's CTA on 375 (chrome carry-forward).

### P3 findings
- Dead conditional `{hasSeed && rules.length > 0 ? null : null}` at `StaffAvailabilityRulesForm.tsx:264`.
- Avatar bg uses raw `oklch(95.5%_0.012_155)` instead of a token (`page.tsx:200`).
- No inline help link explaining closure vs override.

### Backend status
**FAKE.** Confirmed: `actions.ts` returns sentinel errors after the permission gate; `data-redesign-fake` attributes on both forms. Pending plans (verbatim):
- `BUILD-staff-blocked-dates-actions.md`
- `BUILD-staff-availability-override-actions.md`

### P1 (tag for Phase 7 gauntlet)
none

### BUSINESS-COMPLETENESS impact
- 2A-6 contributes (full `role=alert aria-live=polite aria-atomic=true` triplet on Panel B + C error regions + soft-warning banner).
- 2A-9 contributes (visible `*` markers via CANCELLED_TEXT token).
- 2A-8 retained (tab strip `aria-current="page"`).
- 2A-4 retained (H1 + four contiguous H2s).
- 2A-1 newly contributes (per-section "Last saved by … on …" audit sub-line via formatAuditTrail in page.tsx).

### Net delta vs v1
Every v1 P1 materially closed in code. Brief Adherence climbs to 5, Token Discipline + Production Polish each climb a point; A11y climbs on the new aria-describedby + audit-trail line. Remaining issues are genuinely P2/P3 polish, not deviations.

## staff-availability — critique (v2 after polish)

### Nielsen heuristic scores (out of 5)

| Heuristic | Score | Delta vs v1 |
|---|---|---|
| Visibility of system status | 5 | +0.5 — count badges, "Last saved by" line, spinner, status pill |
| Match between system and real world | 4.5 | = — first-person self-view, plain Add closure/Add override verbs |
| User control and freedom | 4.5 | +0.5 — "Start from global hours" escape; bookings-guard "Review bookings first" |
| Consistency and standards | 4.5 | = — token family extraction + tab-strip momentum-scroll match Brief 01 |
| Error prevention | 4.5 | +0.5 — bookings-guard alertdialog catches the most consequential operational mistake |
| Recognition rather than recall | 4.5 | +0.5 — distinct icons, visible All-day checkbox, per-day Working-day toggle |
| Flexibility and efficiency | 4.5 | +1.0 — "Start from global hours" Ghost retires the cold-start friction |
| Aesthetic and minimalist design | 4.5 | +0.5 — illustrated EmptyState replaces v1 inline line |
| Help users recognize/diagnose/recover | 4.5 | +0.5 — per-field alert regions, persistent Cancelled toast + Retry, bookings-guard names the consequence |
| Help and documentation | 4 | +0.5 — inline subline + Open-clinic-wide deep-link + tooltips; still no closure-vs-override disambiguation |

### AI-slop verdict: PASS
Three shape-varied managers, plain operator copy, status-paired pill + segmented control, dignified illustrated empties, and a context-aware bookings guard read as a deliberate clinic workstation — not a templated CRUD page.

### Commentary (PRODUCT.md anti-references)
- **No generic SaaS / shadcn defaults** — flat 40px-avatar header, Clinic Green active tab with `aria-current="page"`.
- **No identical-card grids** — Panel A (7-row day grid), Panel B (XCircle rows), Panel C (Calendar date+time rows with Pending Override chip) are visually distinct.
- **No decorative blobs / gradients / side-stripes** — alertdialog uses tinted icon tile, EmptyState uses soft circular icon well.
- **Status never colour-only** — every chip and banner pairs tint + icon + sentence; Restricted banner pairs Lock + copy.
- **Voice anchors land** — "Your availability" self-view; "Block this date even though bookings exist?" reads as a clinic operator.

### Notable remaining weaknesses
- No inline "When should I use a closure vs override?" help.
- Mode pill duplicates the active segmented-control state — consider removing or inlining with the subline.
- Bookings-guard count message doesn't link to the affected booking(s).
- Per-section "Last saved by …" line `-mt-2` reads close to the panel description.
- Inactive-staff banner border uses default border var rather than a Restricted-family border.

### Net delta vs v1
Polish pass directly retires both v1 lows (Flexibility +1.0; Help +0.5) and converts the v1 PASS into a stronger PASS — every heuristic now sits at 4 or above, with three full or half-step gains in Error-prevention / Flexibility / Aesthetic.



## client-new — audit

**Audit date:** 2026-05-18
**Reviewed:** `src/app/admin/clients/new/page.tsx`, `src/app/admin/clients/new/ClientCreateForm.tsx`, `src/app/admin/clients/actions.ts` (additive city/area extension)
**Screenshots:** `client-new-polish-final-{375,768,1440}.png`, `client-new-post-axes-{375,768,1440}.png`

### Severity rubric (impeccable v5 L884–890, verbatim)
---

## account-password-requests — audit

Severity rubric (impeccable v5 L884-890, verbatim):
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

### 5 dimension scores

- **Visual hierarchy:** 4.5 / 5 — Three intentionally-named panels stack cleanly; H1 → H2 panel headings preserved; required-field legend leads; banner-then-panels-then-save-bar order matches brief. The desktop save bar styled as a card competes a little with the three content panels, costing 0.5.
- **Token discipline:** 4 / 5 — `--admin-border-form` (Form Seam) drives every input border via `inputBase`. No `border-l-4`, no `backdrop-blur`, no glassmorphism, no gradient text, no `bg-white` on panels. Token escapes remain: status-family colours hard-coded as inline `oklch()` constants at lines 12–17; `text-white` literal on submit button (line 237); Attention border re-derived locally.
- **Accessibility:** 4.5 / 5 — Per-field `role="alert" aria-live="polite" aria-atomic="true"`, banner-level `role="alert"` on Duplicate + Form-level error, required `*` markers in Cancelled colour with `aria-hidden`, `aria-busy` on form + submit, `aria-invalid` + `aria-describedby` wiring per field, focus auto-moves to first invalid field, `autoComplete` tokens on all relevant fields, `AdminAccessDenied` no longer leaks the raw permission identifier. Marked down for: `disabled:opacity-70` (line 237) vs DESIGN.md §5 spec "40% + cursor-not-allowed".
- **Responsive behaviour:** 3.5 / 5 — Panels collapse to single column on mobile; sticky save bar pinned with `safe-area-inset-bottom`; desktop bar becomes in-flow card. P1 concern about sticky save bar coexisting with the fixed `AdminMobileBottomNav` at the bottom of scroll (collision risk).
- **Copy quality:** 4.5 / 5 — Voice matches PRODUCT.md, no em dashes, helpers plain. "Possible duplicate client" + "Create a separate client profile anyway." checkbox label match brief §8 verbatim. Missing: "Try again" Ghost in submission failure banner.
### Dimension scores

- **Information architecture — 9/10.** Header → 5-tab filter → result-count → row-list → FAKE banner reads in the exact order the brief specifies; Pending count badge is the only label that carries a number; status filter is deep-linkable via `?status=`.
- **Visual hierarchy — 8/10.** Row top line (email + avatar) leads, status pill + relative time + ID suffix sit on row 2, action footer is rule-separated; pending-soon urgency uses Pending-family amber text without alarmism. Minor: the truncated email at 375px loses the domain to ellipsis with no on-tap reveal (only title= for hover).
- **Token discipline — 7/10.** Most colours go through --admin-* vars, but several raw oklch literals leak in (RequestRow.tsx, ApproveModal.tsx, RejectModal.tsx mirror set). Spacing rhythm is correct (gap-2.5 sm:gap-3, p-4 sm:p-5).
- **Accessibility — 6/10 → 8/10 after fix.** Strengths: form-level role="alert" aria-live="polite" aria-atomic="true" on modal errors, aria-busy on submit, aria-invalid paired with red border on reject, visible * required-marker, per-row sr-only H2. Three P1 a11y fixes were applied during this audit cycle (see P1 below).
- **Responsive correctness — 8/10.** Modal becomes a bottom sheet <640px and a centred dialog ≥640px, tab strip horizontal-scrolls on narrow viewports, action footer wraps.

### P0 findings

- none

### P1 findings

- **Sticky save bar collides with fixed `AdminMobileBottomNav` at mobile bottom of scroll** — `ClientCreateForm.tsx:224` (`sticky bottom-0 z-20`). With the admin layout's fixed mobile bottom nav, the save bar will sit behind or above the nav depending on stacking context.
- **`AdminAccessDenied` missing the Secondary "Back to dashboard" CTA** — `page.tsx:26-33` only renders a Ghost "View clients" link. Brief §11 specifies *Secondary "Back to dashboard" → /admin/dashboard* as the primary CTA, with "View clients" as the tertiary.
- **Submission failure "Try again" Ghost missing from `FormErrorBanner`** — `ClientCreateForm.tsx:296-313`. Brief §8 and §6 require a retry affordance inside the banner.

### P2 findings

- **Status-family colour values inlined as `oklch()` constants** — `ClientCreateForm.tsx:12-17`. DESIGN.md doesn't yet expose CSS variables for status backgrounds (admin-ui.tsx:315 inlines the same Cancelled bg). System gap to canonicalise in Phase 7.
- **`text-white` literal on submit button** — `ClientCreateForm.tsx:237`. PRODUCT.md anti-references and impeccable shared design laws ban `#fff`/`#000`; Field White token is `oklch(99.5% 0.003 88)`.
- **Submit button `disabled:opacity-70` undercuts the disabled affordance** — `ClientCreateForm.tsx:237`. DESIGN.md §5 spec is "40% opacity + cursor-not-allowed".
- **Textarea double-labelled with both `<label htmlFor>` and `aria-label`** — `ClientCreateForm.tsx:203-210`. Brief §5 specified `aria-label` alone.
- **Postcode `max-w-[14rem]` (224px) vs brief §5 `max-w-[220px]`** — `ClientCreateForm.tsx:177`. 4px drift.

### P3 findings

- **Desktop save bar renders as a card** with `md:border md:bg-[var(--admin-panel)] md:rounded` — slightly competes with the three content panels.
- **`focus-visible:ring-2` instead of `ring-3`** vs DESIGN.md §4 spec.
- **Soft warning "no contact channel" not implemented** — Deferred per brief §10 Q2.
- **`focus-visible:ring-[var(--admin-focus)]/30` on inputs vs `/55` on buttons** — Inconsistent ring-opacity within the same form.

### Backend status

- **HANDLED** — `createClient` server action in `src/app/admin/clients/actions.ts` accepts the new `city` and `area` form fields via the sanctioned additive Zod-schema extension (lines 46-47, 134-135, 195-196), preserves all RECON §6.4 field names verbatim, keeps duplicate-detection rules server-side, redirects to `/admin/clients/<id>` on success, and audit-logs the create. No FAKE / N-A blockers; no `BUILD-*.md` dependency for this page's core path. `BUILD-postcode-lookup-client.md` is explicitly out of scope per brief §4.

### P1 (tag for Phase 7 gauntlet)

- Sticky save bar / `AdminMobileBottomNav` collision at mobile viewport bottom — `ClientCreateForm.tsx:224`
- `AdminAccessDenied` missing Secondary "Back to dashboard" CTA — `page.tsx:26-33`
- `FormErrorBanner` missing "Try again" Ghost retry button — `ClientCreateForm.tsx:296-313`

### BUSINESS-COMPLETENESS impact

- **2A-6** — Form errors aria-live announce: `ClientCreateForm.tsx` wraps the form-level error banner and duplicate-warning banner in `role="alert" aria-live="polite" aria-atomic="true"`, every per-field error carries the same triple. Eligible to flip from PARTIAL to coverage-row HANDLED.
- **2A-9** — Required-field markers visible: `ClientCreateForm.tsx` renders `<span aria-hidden="true">*</span>` in Cancelled-family text colour adjacent to every required label; legend "* means required." at top of form. Eligible to flip from PARTIAL to coverage-row HANDLED.


## client-new — critique

**Date:** 2026-05-18
**Surface:** `/admin/clients/new`
**Files reviewed:** `src/app/admin/clients/new/page.tsx`, `src/app/admin/clients/new/ClientCreateForm.tsx`, `src/app/admin/clients/actions.ts`
**Screenshots reviewed:** `client-new-polish-final-{375,768,1440}.png`, `client-new-post-axes-{375,768,1440}.png`
**Brief:** `redesign/briefs/client-new-brief.md` (user-confirmed)

### Nielsen heuristic scores (0–4)

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 3 | aria-busy on form + submit, spinner replaces Save icon, duplicate banner + required checkbox, focus auto-jump to first invalid field |
| 2 | Match between system and real world | 4 | Plain admin English; "Who they are / How to reach them / Internal notes" is how a receptionist describes the page |
| 3 | User control and freedom | 3 | Cancel anchor (no ambush), back breadcrumb, duplicate path explicit-checkbox-gated; deferred "no contact channel" soft warning would lift this to 4 |
| 4 | Consistency and standards | 3 | Inputs match DESIGN.md §5 spec; native `<select>` chevron is browser-default — minor inconsistency |
| 5 | Error prevention | 3 | Server-side duplicate detection works; required checkbox hard-locked; autoComplete set; deferred no-contact soft modal |
| 6 | Recognition rather than recall | 4 | All fields labelled, `(optional)` markers explicit, inline helpers on email/phone/city/area, source-conditional helpers, concrete placeholder examples |
| 7 | Flexibility and efficiency | 2 | Tab-order matches scan order; no keyboard shortcut (acceptable per PRODUCT.md "Tech level: Novice"); postcode auto-fill deferred per brief §10 Q3 |
| 8 | Aesthetic and minimalist design | 3 | Calm, no gradients/blobs/glass/shadows; three stacked panels of same composition drift toward shape repetition (near-miss, not violation) |
| 9 | Help users recognize, diagnose, recover | 3 | Cancelled-family banner + x-circle, role=alert + aria-live=polite + aria-atomic=true; duplicate banner names matched record; missing brief-promised "Try again" Ghost in FormErrorBanner |
| 10 | Help and documentation | 3 | Self-documenting via inline helpers + panel descriptions; internal-notes panel description carries the dignified guardrail |

**Total: 31 / 40.**

### AI-slop verdict: **PASS**

The page reads as a calm clinic-intake form built on the Rahma palette, not a generic SaaS form: no gradient text, no glassmorphism, no decorative blobs, no hero-metric template, no side-stripe borders, no color-only status, no purple-blue-or-neon. The only category-reflex tell is the three-stacked-rounded-panels rhythm, which sits adjacent to (but does not commit) the "identical card grids" anti-reference — the panel content is intentionally differentiated by copy, so it's a near-miss rather than a hit.

### UX-quality commentary (mapped to PRODUCT.md anti-references)

- **"Generic SaaS / shadcn-default dashboards":** avoided. Primary button is Clinic Green not shadcn-blue; input border is Form Seam (oklch 55%) not shadcn-default `border-input`. All seven token-escape soft-fixes from the brief (raw `bg-white`, raw `border-red-200`, raw `border-orange-200`, raw `backdrop-blur`, raw `manage_clients_all` leak) are resolved.
- **"Decorative blobs, glassmorphism":** clean. The previous build's `backdrop-blur` save bar is gone; current bar is `bg-[var(--admin-panel)]` with 1px `border-[var(--admin-border)]` top edge.
- **"Hero-metric template":** not applicable (no stats); Cormorant Garamond correctly absent (numerals only per DESIGN.md).
- **"Identical card grids":** *watchout, not a violation.* Three AdminPanels stacked with the same title+description+grid composition is a single-page case of the shape PRODUCT.md warns against. Content differentiates by copy. Polish hedge: drop Panel 3's description (textarea placeholder already carries the meaning) for visible rhythm-break.
- **"Color-only status signalling":** clean. Duplicate pairs Attention tint + `alert-circle` + "Possible duplicate client" label + prose + checkbox. Required `*` paired with literal "means required" legend.
- **"Side-stripe borders, gradient text":** absent (source-grep clean).
- **"Tools so spare they feel cold":** the form leans to the cold end of disciplined-warmth (no avatars yet — correct — pre-record creation; no illustration — correct — always-in-input). Warmth lives on the destination /admin/clients/<id>.
- **"Raw permission identifier on denied screen":** resolved. `page.tsx:24-25` plain English; no `manage_clients_all` string anywhere.
- **Form contract / RECON §6.4 preservation:** all field `name` attributes preserved verbatim + new `city`/`area` additive. Server action signature intact. `useActionState` preserved.

**Concrete observations that did not land vs brief:**
1. `Try again` Ghost on `FormErrorBanner` missing (brief §6).
2. postcodes.io auto-fill deferred (brief §10 Q3) — flagged in brief for Phase 7.
3. "No contact channel" soft-warning modal deferred (brief §10 Q2) — flagged in brief for Phase 7.
4. Native `<select>` chevron is browser-default (rest of form is Rahma-tokenised).
5. Panel-shape repetition — watchout, not fix-now.


## client-new — audit (v2 post-enhancement)

### Audit Health Score

| # | Dimension | v2 Score | v1 Score | Δ | Key Finding |
|---|-----------|----------|----------|---|-------------|
| 1 | Accessibility | 5/5 | 4.5/5 | +0.5 | role=alert + aria-live on per-field, form-level, and submission-status regions; aria-required on required inputs; scrollIntoView on first invalid field; desktop-only autofocus (pointer:fine guard) |
| 2 | Performance | 4/5 | 4/5 | 0 | Clean; opacity-only banner pop-in respects reduced-motion globally |
| 3 | Responsive Design | 5/5 | 4.5/5 | +0.5 | `bottom-14 z-30` save bar correctly stacks above the `h-14` fixed AdminMobileBottomNav; `pb-32` reflow buffer; safe-area inset honoured |
| 4 | Theming | 4/5 | 3.5/5 | +0.5 | Status-family backgrounds still inlined as `oklch()` literals (system-level deferral); `text-white` literal resolved → `text-[oklch(99.5%_0.003_88)]` |
| 5 | Anti-Patterns | 5/5 | 4.5/5 | +0.5 | No glass, no gradient text, no `border-l-4`, no hero-metric stack; native `<select>` chevron replaced with tokenised `ChevronDown`; banners full-border (not side-stripe) |
| **Total** | | **23/25** | **21/25** | **+2** | **Excellent — minor polish only** |

### Anti-Patterns Verdict

**PASS.** Could not be guessed as AI-generated. The form is calm clinic-intake grammar: warm ivory canvas, two intentionally-named panels plus a third for notes, full-bordered Cancelled-family error banner with `XCircle` + inline Ghost "Try again", full-bordered Attention-family duplicate banner with `AlertCircle` + visible label + required confirm-checkbox. No glass on the sticky save bar (flat `surface-card` with 1px top border). No side-stripe accents. The "* means required" legend rendered as a Cancelled-tinted pill is a Rahma-native touch. The native `<dialog>` for the no-contact modal is deliberately minimal. The address sub-section divider breaks panel sameness without inventing a 4th panel.

### Executive Summary
- Audit Health Score: **23/25** (Excellent — minor polish only)
- Total issues: P0 = 0 · P1 = 0 · P2 = 3 · P3 = 4
- All three v1 P1s are **resolved** in the enhancement pass

### Detailed Findings by Severity

#### P0 — Blocks release
- _none_

#### P1 — Fix this sprint
- _none_ (all three v1 P1s resolved — see Net delta below)

#### P2 — Next cycle

- **[P2] Status-family colour values inlined as oklch() literals** — `ClientCreateForm.tsx:26-31`. System-level gap; add `--admin-cancelled-*` / `--admin-attention-*` to `tokens.css` in Phase 7.
- **[P2] Server duplicate-warning prose does not match brief template** — `actions.ts:182-184`. Brief §Copy specifies `"{field} matches an existing record for {existing client name}"`; server returns `"{name} ({contact})"`. Out of scope per RECON §5; Phase 7 server-message sweep.
- **[P2] Server-side Zod messages don't match brief §Copy strings** — `actions.ts:41,43`. Client-side pre-validation now covers email/phone/postcode with brief-verbatim copy; full_name/client_source server messages still diverge. Phase 7.

#### P3 — Polish

- **[P3] `AdminAccessDenied` "Back to dashboard" CTA renders as Ghost-shape, not Secondary-shape** — `admin-ui.tsx:914-919`. Shared-component fix; Phase 7 polish.
- **[P3] postcodes.io postcode → city/area autofill not wired** — `ClientCreateForm.tsx`. Brief §4 Out: explicitly out of scope; follow-up via `BUILD-postcode-lookup-client.md`.
- **[P3] Backdrop tint on no-contact `<dialog>` uses inline oklch literal** — `ClientCreateForm.tsx`. Add `--admin-dialog-backdrop` token in Phase 7.
- **[P3] `rahma-fade-up` / `rahma-pop-in` keyframes not documented in DESIGN.md §Motion** — Documentation gap; Phase 7 or 8.

### Backend status

**HANDLED — no change.** `createClient` server action signature unchanged. `city`/`area` columns accepted via the sanctioned schema additive. Duplicate detection, validation rules, and audit-log write untouched.

### P1 (tag for Phase 7 gauntlet)

**none.** All three v1 P1s resolved:
- Sticky bar / mobile bottom-nav collision → resolved (`bottom-14 z-30` + `pb-32`)
- AdminAccessDenied missing Secondary CTA → resolved at page level via shared component default + custom `actions` slot
- FormErrorBanner missing "Try again" Ghost → resolved (`RotateCcw` + brief-verbatim label)

### BUSINESS-COMPLETENESS impact

**Confirmed contributions:**
- **2A-6** Form errors aria-live announce — duplicate, form-level, per-field regions all wrap in `role="alert" aria-live="polite" aria-atomic="true"`; sr-only `role="status"` submission live region added beyond the minimum.
- **2A-9** Required-field visible `*` markers — `<span aria-hidden="true">*</span>` adjacent to every required label, plus Cancelled-tinted "* means required" pill legend; `aria-required="true"` set universally on every required input as a strict superset of the 2A-9 commitment.

### Net delta vs v1 audit

| Aspect | v1 | v2 | Delta |
|---|---|---|---|
| Total score | 21/25 | 23/25 | +2 |
| P0 count | 0 | 0 | 0 |
| P1 count | 3 | 0 | -3 (all resolved) |
| P2 count | ~3 | 3 | 0 |
| P3 count | unknown | 4 | n/a |

**16 specific improvements landed:** sticky-bar mobile clearance · "Try again" Ghost · AdminAccessDenied tertiary CTA · client-side pre-validation · sr-only submission live region · `aria-required` · `scrollIntoView` · desktop-only autofocus · custom select chevron · disabled-state opacity 0.4 + cursor-not-allowed · submit `active:scale-[0.98]` · banner mount animation · character counter on Notes · "* means required" pill · address sub-section divider · `text-white` → Field White token.

**Bottom line:** Excellent. The enhancement pass resolved every Phase 6 P1, raised the score from 21/25 to 23/25, and introduced no new P0/P1. Remaining items are system-level cleanups appropriate for Phase 7.


## client-new — critique (v2 post-enhancement)

**Re-prime sources:** brief 23/29 (Phase 5), PRODUCT.md, DESIGN.md, `client-new-deferrals.md`, three responsive screenshots (375/768/1440), `client-new-no-contact-modal.png`, `client-new-enhanced-duplicate.png`, and live source (`page.tsx`, `ClientCreateForm.tsx`, `actions.ts`).

### Nielsen heuristic scores

| # | Heuristic | v1 | v2 | Δ | Key observation |
|---|---|---|---|---|---|
| 1 | Visibility of system status | 3 | 4 | +1 | aria-busy + spinner + sr-only role=status live region ("Saving client…" / "Couldn't save client."); press-state active:scale; multi-modal status |
| 2 | Match between system and real world | 3 | 4 | +1 | Operator language; new "Address" sub-heading; "Where did this client come from?" translates enum to question |
| 3 | User control and freedom | 2 | 4 | +2 | "Try again" Ghost in FormErrorBanner; NoContactDialog with real "Add contact details" off-ramp; Cancel anchor still escapes cleanly |
| 4 | Consistency and standards | 3 | 4 | +1 | Hoisted CANCELLED_*/ATTENTION_* constants; custom ChevronDown; text-white → Field White token; all inputs use --admin-border-form |
| 5 | Error prevention | 2 | 4 | +2 | Three layers: HTML required + aria-required, client-side preValidate (email/phone/postcode brief-verbatim), soft no-contact modal; desktop-only autofocus |
| 6 | Recognition rather than recall | 3 | 4 | +1 | autoComplete on every relevant field; realistic placeholders; conditional source-detail helper surfaces right prompt at need |
| 7 | Flexibility and efficiency | 3 | 3 | 0 | Tab order clean; 2000-char counter; deliberately no power-user shortcuts per PRODUCT.md |
| 8 | Aesthetic and minimalist | 3 | 4 | +1 | Three panels with rahma-fade-up + Panel 2 sub-divider; Cancelled-tinted "* means required" pill the biggest single aesthetic upgrade |
| 9 | Help users recognize, diagnose, recover | 2 | 4 | +2 | role=alert + aria-live + focus + scrollIntoView; brief-mandated "Couldn't create client. {server message}" prefix; Try Again Ghost; sr-only fail announcement |
| 10 | Help and documentation | 3 | 3 | 0 | Inline helpers; "We'll redirect…" microcopy; right scale for small-team admin (no glossary) |

**Total: v1 31/40 → v2 38/40 (+7).** Lift concentrated in heuristics 3, 5, 9 — exactly the three the v1 critique named.

### AI-slop verdict: **PASS**

No #fff/#000, no gradient text, no glassmorphism on save bar (flat --admin-panel with 1px Subtle Loam top per brief), no side-stripe borders, no decorative blobs, no purple-and-blue, no hero-metric template, no identical-card grid. Modal exists but earns its place per brief §10 Q2 — destructive-omission catch, not "modal as first thought." Status families use icon + label + tint composition, never colour-only. Sticky save bar uses bottom-14 z-30 to clear AdminMobileBottomNav, matching SettingsForm.tsx pattern. Reads as a Rahma surface, not generic admin.

### UX-quality commentary mapped to PRODUCT.md anti-references

**Calm · Scannable · Dignified honoured:**
- *Calm.* No live-validation chatter; errors after submit only. Panels mount via rahma-fade-up (320ms ease-out-quart). prefers-reduced-motion honoured globally.
- *Scannable.* 2-col grid md:+, single col mobile, Urbanist 600 titles, Soft Slate descriptions. "Address" sub-heading inside Panel 2 helps eye find postal info.
- *Dignified.* "All caught up" voice throughout. No system-speak, no apology, no patronising. Denied state no longer leaks `manage_clients_all`.

**Anti-references actively rejected:**
- *Generic SaaS / shadcn-default dashboards* — custom ChevronDown removes most obvious shadcn-cliché.
- *Color-only status signalling* — Duplicate banner pairs AlertCircle + label + tint + checkbox (four cues). Form-error pairs XCircle + prefix copy + tint + retry. Required `*` flanked by visible label + Cancelled-tinted "* means required" pill.
- *Glassmorphism, hero-metric, side-stripe* — None.
- *Tools so spare they feel cold* — Legend pill, panel mounts, Cormorant H1, conditional source helper — small warmth signals throughout.

**Concrete observations still deferred (none are regressions):**
1. Server Zod messages diverge from brief Copy — client-side preValidate covers format path with brief-verbatim copy; schema-required path falls through to Zod defaults. Phase 7 server-message canonicalisation.
2. Server duplicate prose template still "{name} ({contact})" instead of "{field} matches an existing record for {existing client name}". Banner heading carries the label so user-facing surface is intact. Server-side, deferred.
3. Status-family oklch inlined as TS constants — system-wide gap (admin-ui.tsx:315 and staff/availability/lib.ts use same pattern). Phase 7 tokens.css canonicalisation.
4. AdminAccessDenied "View clients" renders as Ghost-shape rather than brief's Secondary + tertiary Ghost split. Shared component; deferred system-wide.

**Net read:** v2 is a confident, brief-faithful operator surface. The +7 lift tracks the three concrete v1 P1s landing (Try Again Ghost, no-contact modal, native-select chevron) plus seven smaller items (aria-required, scrollIntoView, live-region status, desktop-only autofocus, char counter, address sub-divider, Cancelled-pill legend). Everything deferred is either brief-out-of-scope or system-wide. No regressions, no AI-slop tells, no anti-reference triggers.
### P1 findings (3 of 4 resolved in-session)

- [RESOLVED] ARIA role="tablist"/role="tab"/aria-selected applied to navigation links — DROPPED; only aria-current="page" retained.
- [RESOLVED] Inert wrapping <form method="get"> around link-only children — REMOVED.
- [RESOLVED] aria-live="polite" on static result-count <p> — REMOVED so it no longer re-announces on every tab change.
- [DEFERRED to Phase 7] FAKE-window permission bridge (MANAGE_AUDIT_LOGS substitute) hides the page from Admin/Practice Manager during the FAKE window. Comment in page.tsx names the exact removal instruction; recorded in deferrals.

### P2 findings

- Raw oklch(...) literals appear where a token might do (RequestRow.tsx, ApproveModal.tsx, RejectModal.tsx). The values match canonical DESIGN.md token literals; the project pattern in admin-ui.tsx also uses inline literals, so this is consistent with established practice. Phase 7 may consolidate via CSS vars.
- Avatar role="img" aria-label="Unverified identity" repeats on every row — could be aria-hidden="true" since the sr-only H2 carries identity.
- "ID …NG-003" suffix-slice differs from the audit-query first-8 slice; alignment recommended.
- Self-approval guard's error code branch exists in ApproveModal but the FAKE server action never returns it — dead branch until backend lands (acceptable for FAKE).
- BST suffix hard-coded in RequestRow.tsx; switch to Intl.DateTimeFormat's timeZoneName: "short" so winter renders "GMT" correctly.

### P3 findings

- Duplicated data-redesign-backend="FAKE" markers on trigger buttons (could hoist).
- useActionState inline-async wrapper is verbose; pass action directly.
- Character-counter "{N} left" tail uses warning-amber rather than Pending-family token at threshold.
- FAKE banner breaks BUILD-plan filenames mid-word on 375px — could truncate with title.
- currentReviewerName.localeCompare(...) can false-positive when two reviewers share a first name; compare staff IDs once real backend lands.

### Backend status

**FAKE.** Blocking BUILD plans (verbatim from IMPLEMENTATION-PLAN.md):
- BUILD-rbac-permission-account-password-requests.md
- BUILD-password-reset-email-templates.md
- BUILD-approve-reject-password-reset.md

### P1 (tag for Phase 7 gauntlet)

- FAKE-window permission bridge (MANAGE_AUDIT_LOGS substitute) hides the page from Admin/Practice Manager — src/app/admin/account-password-requests/page.tsx (FAKE-bridge gate near top of AccountPasswordRequestsPage). Must remove the OR branch when BUILD-rbac-permission-account-password-requests.md lands.

### BUSINESS-COMPLETENESS impact

- **2A-6** (form errors silently fail to announce — role="alert" aria-live="polite" missing) — newly satisfied here at ApproveModal.tsx + RejectModal.tsx error regions.
- **2A-8** (tab <Link>s lack aria-current="page") — newly satisfied at page.tsx active-tab link.
- **2A-9** (required-field markers invisible) — newly satisfied at RejectModal.tsx with a visible `*` in Cancelled family colour and aria-hidden="true".
- **2A-18** (staff password-reset workflow — admin-facing side) — first end-to-end UI shipped for this Track A item; closes the admin-side schema gap, awaiting backend BUILD plans for the actual mutation path.

---

## account-password-requests — critique

### Nielsen heuristic scores

1. **Visibility of system status — 8/10.** Pending count baked into the active tab ("Pending (3)"), per-row relative time + absolute-time title tooltip, expiry-soon copy, monospace ID suffix all do real work; only miss is no toast wired to the FAKE handler so confirmation success is silent today.
2. **Match between system and real world — 9/10.** Plain admin English throughout; never lapses into "Trigger workflow"/"Status: PENDING" SaaS-speak; status badge labels read as how the operator would describe the row.
3. **User control and freedom — 8/10.** Two-step modal with explicit Cancel + Base UI ESC/backdrop close, deep-linkable ?status= GET tab URLs, no destructive auto-fire; small ding is no Sonner-toast undo affordance for the FAKE success path.
4. **Consistency and standards — 9/10.** AdminPageHeader + AdminPanel + AdminStatusBadge + Hover-Moss row tint + Form Seam input border all pulled from DESIGN.md; status tones map cleanly to families; ConfirmActionModal pattern wired per brief.
5. **Error prevention — 9/10.** Reject textarea is required, server-validates again, character limit enforced both client + server; idempotency / self-approval / race codes all defined in the action-result union; destructive button is Cancelled-family red.
6. **Recognition rather than recall — 8/10.** Email, status, submitted-time, expiry-time, ID suffix and reviewer-note well visible on the row at rest — no hover-revealed actions.
7. **Flexibility and efficiency — 7/10.** Deep-linkable tab URLs and stable keyboard order; no bulk-select (out of scope per brief §10.3) and no cmd-K row lookup, both correct for a queue expected to hold <5 rows.
8. **Aesthetic and minimalist design — 9/10.** Page is genuinely calm: ivory canvas, single-column queue, restrained pill tabs, no decorative blobs, no gradient, no hero-metric tiles, no identical-card grid (rows vary by status).
9. **Help users recognize, diagnose, and recover from errors — 8/10.** Inline role="alert" region in both modals with x-circle icon, dedicated copy per error code (validation, self_approval, race, server), retry path is "Refresh now" on race.
10. **Help and documentation — 7/10.** Subtitle explains consequence of approve before reviewer touches a button; modal body re-states consequence with actual email + TTL.

### AI-slop verdict — **PASS**

Light-mode ivory + clinic green, varied row treatment by status, plain operational copy, no decorative blobs / gradient text / hero-metric / identical-card-grid / side-stripe-border violations; this looks like an admin queue made for Fatimah, not a generic shadcn dashboard.

### UX-quality commentary

- Anti-reference compliance strong: no purple-and-blue gradients, no neon-on-black, no glassmorphism beyond conventional modal backdrop blur. No side-stripe border-l-4 on rows — status communicated by AdminStatusBadge family + leading icon + textual label, never colour alone. No gradient text. No Cormorant on body copy.
- Card-board grammar held lightly: each row a varied composition rather than identical icon-heading-text tile.
- Tonal Lift Rule respected: reviewer-note well steps down from surface-card to var(--admin-canvas).
- Stripe-style state-word discipline on chips ("Pending review", "Approved", "Rejected", "Expired").
- Voice anchors hit: "All caught up" empty state, specific kind error copy, no raw permission identifiers leaked.

**Carry-over concerns for Phase 7:**
1. The FAKE-banner ships in the live screenshot; this is correct for the FAKE window but must be deleted in lockstep with BUILD-approve-reject-password-reset.md landing.
2. The page bridges via MANAGE_AUDIT_LOGS to gate access — Admin/PM cannot reach the page until RBAC BUILD lands; brief's Admin/PM-without-audit hidden-link branch is therefore untestable until then. Recorded in deferrals.
3. No success toast on FAKE approve/reject confirmation — wire Sonner when real send lands.
4. Mobile 375 action buttons sit at 40px height (borderline WCAG 2.5.5); consider full-width stacked at 375.

---

## account-password-requests — audit (v2 post-polish)

Severity rubric (impeccable v5 L884-890, verbatim):
## password-reset — audit

**Backend status:** FAKE — blocked by `BUILD-password-reset-request-actions.md` and `BUILD-password-reset-email-templates.md` (IMPLEMENTATION-PLAN.md L1145–1146, both still `[ ]`).

### Dimension scores

| Dimension | Score | Key finding |
|---|---|---|
| Typography | 3.5 / 4 | Urbanist 600 H1 + Work Sans body + token-aligned label step; one minor non-token size (`text-[0.9375rem]` on the PlainTextWell, PasswordResetCard.tsx:127) — otherwise on-system. |
| Color | 3.5 / 4 | OKLCH throughout, Committed strategy matches brief, status chips use the four sanctioned families. Some chip + required-star + error swatches are inlined as `oklch(...)` arbitrary values instead of `var(--admin-*)` / token names (page.tsx:34, [token]/page.tsx:37/47/57, ForgotForm.tsx:22/111, SetNewPassword.tsx:29/140/177). |
| Layout | 3.5 / 4 | Single shared 440px card; padding `xl`/`lg` matches brief; tonal-lift PlainTextWell well inside the card matches the §5 spec. State 4 uses `useId()` so the field id is non-deterministic but stable per render — acceptable. State 4 has no footer "Back to sign in" link by design but the page footer "Rahma Therapy staff portal." sits unusually tight (mt-6 from card) when the back-link is hidden (PasswordResetCard.tsx:86–98); minor rhythm wobble visible in state4-1440 screenshot. |
| Motion | 4 / 4 | No client animations; state transitions are server re-renders, satisfies reduced-motion contract by construction. Submit-button loading via `useFormStatus` (PasswordResetSubmitButton.tsx:24–35) and the Button primitive handles spinner/`aria-busy`. |
| Accessibility | 3 / 4 | Required `*` markers visible in Cancelled colour and `aria-hidden`; every input labelled; `role="alert" aria-live="polite" aria-atomic="true"` wired on both field-level and form-level error regions; `id="admin-main"` skip-link anchor preserved on card root; chip icons `aria-hidden`. Gaps: client-only validation paint on state 4 (mild flash-of-unvalidated-state risk before React mounts); two adjacent Ghost affordances (Submit-a-different-email button + Back-to-sign-in link) rely on `<button>` vs `<a>` semantics alone for visual differentiation. |

**Audit Health Score: 17.5 / 20 — Good (address weak dimensions).**

### P0 — Blocks release — fix before shipping anything

- none.

### P1 — Fix this sprint — significant impact on users

- **[P1] `setPasswordWithToken` redirects to `/admin/login?reason=fake-success` on the happy path** — `src/app/admin/password-reset/actions.ts:154`. Brief §11 state 4 says "the dashboard is the confirmation; no intermediate page." Under FAKE this is honest, but the user-visible behaviour is misleading. Tag for Phase 7 gauntlet (depends on `BUILD-password-reset-request-actions.md`).
- **[P1] State 6 + hostile-token inline form omits the human-review caveat** — `src/app/admin/password-reset/states/ForgotForm.tsx:61–69` (variant gate) consumed by `src/app/admin/password-reset/states/Expired.tsx:23` and `src/app/admin/password-reset/[token]/page.tsx:142`. Users hitting expired or tampered tokens see a form with no "An Owner reviews each request…" explanation. Brief §11 state 6 doesn't mandate it, but it improves clarity.

### P2 — Next cycle — noticeable but not blocking

- **[P2] Required-star marker uses inline `oklch(26% 0.14 25)` literal instead of `var(--admin-danger)` token** — ForgotForm.tsx:22, SetNewPassword.tsx:29. Two-source-of-truth drift; ForgotForm.tsx:127 already uses `var(--admin-danger)` correctly for the panel border.
- **[P2] State chip colours hard-coded `bg-[oklch(...)]` rather than reusing the AdminStatusBadge component** — page.tsx:34, [token]/page.tsx:37/47/57. DESIGN.md §5 implies the reusable badge; four chip definitions duplicate the spec inline.
- **[P2] Cookie has no signature** — actions.ts:73–86. Brief §11 commits to a signed cookie; under FAKE the absence is fine. BUILD plan replaces this.
- **[P2] `parseCookie` silently swallows any malformed cookie** — page.tsx:55–72. Acceptable, but no audit log when a malformed cookie is encountered.
- **[P2] State 4 page footer rhythm sits unusually tight when back-link is hidden** — PasswordResetCard.tsx:96 is `mt-6` from the card regardless of `showBackLink`. Consider conditional `mt-10` when `showBackLink === false`.
- **[P2] Button variant `admin-primary` consumed across multiple call sites with no central token assertion** — Token-Drift lint could assert this variant stays stable.

### P3 — Polish — minor, fix when time allows

- **[P3] PlainTextWell uses non-token font-size `text-[0.9375rem]`** — PasswordResetCard.tsx:127.
- **[P3] State 2 `title="Submitted on…"` tooltip is keyboard-inaccessible and mobile-invisible** — SubmittedConfirmation.tsx:31. Honoured per brief §Copy but duplicative.
- **[P3] State 3 `<dl>` shows the same relative time twice** — PendingStatus.tsx:34–53. Sanctioned by brief §11 but `<time dateTime>` for an absolute date would carry distinct information.
- **[P3] Two muted Ghost affordances stacked vertically (Submit-a-different-email + Back-to-sign-in) read as a single block** — SubmittedConfirmation.tsx:36–44, PendingStatus.tsx:55–63. A 14px `mail` icon or hairline divider would separate them.
- **[P3] FAKE static token map exposes test tokens in client-visible URL space** — [token]/page.tsx:74–93. BUILD plan replaces.
- **[P3] Hostile-token branch heading "Request not approved" + body "This link is no longer valid" mismatch is sanctioned by brief §6 but mildly confusing** — flagging as a copy review point.

### P1 (tag for Phase 7 gauntlet)

- **[P1] State 4 happy-path redirects to `/admin/login?reason=fake-success`** — `src/app/admin/password-reset/actions.ts:154`. Depends on `BUILD-password-reset-request-actions.md`.
- **[P1] State 6 + hostile-token inline form omits the human-review caveat** — `src/app/admin/password-reset/states/ForgotForm.tsx:61–69` gate consumed by Expired.tsx + [token]/page.tsx hostile branch.

### BUSINESS-COMPLETENESS impact

This page newly contributes to:
- **2A-6 (Form errors aria-live announce)** — every error region on both forms wraps in `role="alert" aria-live="polite" aria-atomic="true"`. Field-level: ForgotForm.tsx:108–110; SetNewPassword.tsx:137–139, 174–176. Form-level: ForgotForm.tsx:124–126; SetNewPassword.tsx:190–192.
- **2A-9 (Required-field visible `*` markers)** — every required `<label>` ships a visible `*` span in Cancelled text colour with `aria-hidden="true"`: ForgotForm.tsx:21–25 + 84 (Email address); SetNewPassword.tsx:28–32 + 111 (New password) + 156 (Confirm new password).


## password-reset — critique

### Heuristic scores (out of 5)

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | **5/5** | State chips (Pending / Approved / Not approved / Expired) plus distinct H1 per state mean the user always knows which of the six positions they sit in. `useFormStatus` spinner + `aria-busy` on submit. The `Sent for:` masked-email sub-line on state 2 + relative time `<dl>` on state 3 close the "where am I in the queue" loop honestly. |
| 2 | Match between system and real world | **5/5** | "An Owner reviews each request" rather than "Submitting to backend service." "Request not approved" rather than "Rejected." No "token", no "TTL", no "payload." "This link has expired" with body "This password-reset link is no longer valid" speaks like a clinic, not a vault. |
| 3 | User control and freedom | **4/5** | "Back to sign in" Ghost on every state except mid-flow state 4 is correct. "Submit a different email" on states 2/3 lets the user undo a typo. Minor: there's no explicit "Resend" or "Cancel pending request" — state 3 only offers a different-email path, which conflates "I want a different email" with "I want to cancel the existing pending row." Tolerable given the human-review model. |
| 4 | Consistency and standards | **5/5** | Card chrome (logo → H1 → chip → body → affordance → back-link → footer) is identical across every state; the only thing that swaps is the inner slot — exactly the brief's "stable card frame, content swap" commitment. Sibling-to-Login is unmistakable. Chip families align 1:1 with DESIGN.md status table (Pending / Confirmed / Cancelled / Restricted), each pairs icon + text label, no colour-only signalling. |
| 5 | Error prevention | **4/5** | `noValidate` plus server-side re-check, `minLength={12}` on new password, helper "At least 12 characters." inline, masked email sub-line so the user spots the wrong mailbox before walking away, security-by-uniform-response on lookup. Small gap: no inline "passwords match" affirmation as the user types — they only find out on submit. Not a fail (a calm flow shouldn't nag), but a missed prevention layer. |
| 6 | Recognition rather than recall | **5/5** | Every required action is visible and labelled at every state. The masked email is restated on states 2 and 3 so the user doesn't have to remember which mailbox to watch. No icon-only controls; no jargon to translate. |
| 7 | Flexibility and efficiency | **3/5** | Pre-auth surface for novice operators, so power-user affordances are intentionally absent. No autofocus on mount is correct per the scene sentence (anxious therapist on Sunday evening doesn't need the keyboard ambushed). `autocomplete="username"` + `autocomplete="new-password"` are wired so password managers work. No shortcuts because this isn't a shortcut surface. The 3 is honest, not a penalty — the brief explicitly trades efficiency for calm. |
| 8 | Aesthetic and minimalist design | **5/5** | Single 440px card, ivory canvas, gold logo, deep-clinic-green primary, one chip, one form, one back-link. Zero decoration that doesn't earn its place. No hero-metric, no identical-card grid (the brief deliberately resists splitting six states into a grid), no decorative blobs, no gradient text, no glassmorphism, no side-stripe borders. The plain-text reviewer-note well on state 5 is a `surface-page` step-down inside the card — depth via tonal lift, exactly per DESIGN.md §4. |
| 9 | Help users recognize, diagnose, recover | **5/5** | `role="alert" aria-live="polite" aria-atomic="true"` on field-level errors AND form-level server errors. Recovery copy is concrete: "Email needs an @ symbol. For example, sara@rahmatherapy.com." Hostile token routes to the rejected chrome with body "This link is no longer valid. Submit a new request below" plus an inline state-1 form — the diagnose-AND-recover combo on one screen. Token is never echoed. State 5 surfaces the reviewer's note in plain text so the user knows *why* and what to do next. |
| 10 | Help and documentation | **4/5** | No help link, no "How does this work?" expander — because the body copy carries the documentation inline ("An Owner reviews each request. We'll let you know by email when it's approved.") and the chip's native `title` attribute repeats the meaning on hover ("Pending review. An Owner needs to approve before you can set a new password."). For a six-state, single-task surface this is the right ceiling. A small ding only because state 5's "Note from the reviewer:" block could optionally link to "What does 'not approved' mean?" — but that's gold-plating. |

**Total: 45/50**

### AI-slop verdict: **PASS**

The page passes every absolute ban — no side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no identical card grids, no decorative blobs, no `rgba(0,0,0,X)` shadows, no purple-and-blue. Crucially, it also passes the *second-order* category-reflex check: the brief's anti-anchor was "the generic 'we've sent you a reset email' SaaS confirmation that lies." State 2's copy ("Thanks. An Owner will review this and email you when it's approved. You can close this page; the link will come to your inbox.") refuses that reflex out loud. No SaaS-cliche lie about an already-sent email; the asynchronous human-review nature is named on every state.

### UX-quality commentary (mapped to PRODUCT.md anti-references)

- **"Generic SaaS / shadcn-default dashboards."** The Rahma gold + blue script wordmark sits *above* the H1 on every state, not as a tiny corner mark. The card is full-bleed-centered on a warm ivory canvas with no top nav (deliberately stripped per the pre-auth scene). The card itself is bordered with `--admin-border`, no shadow at rest, no gradient, no glow — flat with tonal lift, exactly the DESIGN.md §4 rule. Reads unmistakably as a sibling of the Login surface, not a Vercel template.
- **"Loud palettes, dense admin defaults."** State 1 contains seven elements total inside the card (logo / H1 / body / label / input / required-marker / submit). State 6 is the densest at nine. No screen reaches the "30 cards" density that PRODUCT.md warns against. The brief's commitment to "stable card frame, content swap" is honored — six states share one shape, which is the opposite of the anti-pattern.
- **"Identical card grids."** This is the only place where the absolute ban *could* have crept in (six states is a grid waiting to happen). It didn't. The page renders one state at a time; states are pages, not tiles. Good restraint.
- **"Color-only status signalling."** Every chip carries icon + text label + family tint. `aria-hidden="true"` on the icon, label-text in the accessible name. Required `*` marker is in Cancelled text colour AND is screen-reader-hidden so the `aria-required` attribute carries the semantics — colour does decoration, ARIA does meaning.
- **"Tools so spare they feel cold — pure-typography admin with no warmth."** The gold + blue script logo at 180px desktop is the warmth carrier on a surface that would otherwise be pure type. Without that wordmark this would slip into Linear-vocabulary; with it, it's "disciplined warmth." Calibrated.
- **"Empty states encourage rather than abandon."** State 5's "Request not approved" is *not* "Your request was denied" — non-judgmental, no apology theatre. State 6's "This password-reset link is no longer valid. Submit a new request below." is factual, no scolding. Both follow the PRODUCT.md voice anchor ("never apologise; never patronising; never grandstands and never shrugs"). The page picks up the Login brief's tone of voice without re-inventing it.
- **Cormorant exception** is *correctly skipped* — no numerals on this surface, so Cormorant Garamond stays in its narrow numeral slot per DESIGN.md §3. A weaker pass would have splashed Cormorant onto the H1 for "brand feel"; this didn't.
- **One real observation worth logging** (not a regression, an opportunity): on state 3 the relative-time string ("about 2 hours ago") appears twice — once in the body sentence and once in the `<dl>` "Submitted" row. The brief allows this; in practice the dl row carries the load and the inline mention could be tightened. Minor; not slop.

**Net:** a calm, plain, kind pre-auth surface that reads as Rahma at every state, refuses every absolute ban, and honors the brief's anti-anchor (the SaaS "we sent you an email" lie) explicitly. PASS.


## password-reset — audit (v2 — post-refinement)

**Backend status:** FAKE. Two BLOCKS-REDESIGN BUILD plans still pending per `IMPLEMENTATION-PLAN.md` rows 1146 + 1145:
- `redesign/backend-plans/BUILD-password-reset-request-actions.md` (Layer 0 #3 — submit / cookie / Auth admin-API wiring, audit_logs writes)
- `redesign/backend-plans/BUILD-password-reset-email-templates.md` (Layer 0 #2 — Resend wiring for the two template constants in `src/lib/email/templates.ts:341-439`)

Until both land, `submitPasswordResetRequest` (`actions.ts:47-90`) does not write to `account_password_requests`, `setPasswordWithToken` (`actions.ts:106-155`) does not call `supabase.auth.admin.updateUserById`, no `audit_logs` rows are written, and state-4 success redirects to `/admin/login?reason=fake-success` (`actions.ts:154`) instead of creating a real Supabase Auth session.

**Severity rubric (impeccable v5 L884-890, verbatim):**
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

### Dimension scores

- **Information architecture — 9/10.** Header → tab strip → result count → list → FAKE chip mirrors the brief's hierarchy. Brief's "audit row" prefix slug now visually maps to `?q=` thanks to D2 (RequestRow.tsx slug now slice(0,8) + ellipsis). Per-row pill suppression on the Pending tab (D1) removes redundancy without losing the at-a-glance status grouping on All / Approved / etc.
- **Visual hierarchy — 9/10 (+1 vs v1).** Urbanist title-step email is the unambiguous anchor; pending sub-row escalates to Pending-text colour only when "Expires soon". FAKE chip is now whisper-quiet rather than competing with content.
- **Token discipline — 7/10 (=).** Most surfaces use vars correctly. Hard-coded OKLCH literals still appear where status-family CSS vars could land (consistent with the existing admin-ui.tsx pattern — the project encodes status family colours inline). Headroom remains; not a regression.
- **Accessibility — 9/10 (+1 vs v1).** `aria-current="page"` on active tab, sr-only H2 per row, `role="alert" aria-live="polite" aria-atomic="true"` on every error region (Approve + Reject + error.tsx), `aria-busy` on submit, visible `*` marker flush to label, error.tsx renders with `role="alert"` + retry, `aria-live="polite"` on expiry line only when soon. Tab strip is `<nav><ul><a>` GET-form links — clean.
- **Responsive correctness — 9/10 (+1 vs v1).** At 375px all 5 tabs fit on a single line. Email truncates with `title` fallback. Modal renders as bottom sheet on mobile, centred dialog on sm+. Action buttons now stack full-width on mobile per brief §5 (post-audit fix). No horizontal scroll at any breakpoint.
## dashboard-coordinator — audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Form-level `role="alert" aria-live="polite"` present on custom-date error; heading hierarchy intact (H1 → H2s → H3) but `<h2>` "SNAPSHOT · TODAY" is an eyebrow misused as a heading |
| 2 | Performance | 4 | Server-rendered, no expensive client effects; disclosure uses compositor-friendly grid-rows transition; no layout-property animation |
| 3 | Responsive Design | 3 | Single-column reflow works at 375; touch targets >=36px on chips and >=40px on disclosure trigger; date-preset row uses overflow-x snap; minor: role pill hidden below md (`md:inline-flex`) so it never shows on mobile |
| 4 | Theming | 4 | Tokens used throughout (`var(--admin-*)`); no `#000`/`#fff`/`bg-black`; only stray hard-coded color is a `rgba(0,0,0,0.02)` chip shadow in filters |
| 5 | Anti-Patterns | 4 | No `border-l-*` of any width as colour accent; no gradient text; no `bg-clip-text`; no glassmorphism as default (only sticky filter strip uses `backdrop-blur-md`); no nested AdminPanels; no hero-metric template; no identical card grid |

**Total: 18/20 — Excellent (minor polish)**

### P0 findings

- none

### P1 findings (Phase 7 gauntlet)

- none (4 of 4 from v1 resolved across this pass and the prior polish window)

### P2 findings

- Hard-coded OKLCH literals duplicate documented status-family tokens; could introduce `--admin-status-cancelled-bg / -text`, `--admin-surface-hover`, etc. Consistent with existing project pattern, not a new debt.
- Action-row top divider (`border-t border-[var(--admin-border)]/60 pt-3`) reads as a structural seam inside a single panel; could be removed in favour of whitespace.
- ID slug + timestamp share identical token weight in the metadata row; the eye lands on whichever is left-most. Step one notch quieter or move to a tooltip.

### P3 findings

- Dashed border on FAKE chip is purposeful (dev-artefact cue); not strictly an empty state.
- `AdminStatusBadge compact` prop used on row pills; default size would also work.
- `role="alert"` on the expiry line is gated to `expires.soon`; acceptable.
- `relativeFromNow` recomputes on every render with `Date.now()`; harmless on server-only render but flag for real backend.
- `AdminPanel className="!p-0"` uses `!important` to defeat base padding; a `padded={false}` prop would be cleaner long-term.

### Backend status

**FAKE.** Blocked on (verbatim from IMPLEMENTATION-PLAN.md):
- `BUILD-rbac-permission-account-password-requests.md`
- `BUILD-password-reset-email-templates.md`
- `BUILD-approve-reject-password-reset.md`

### P1 (tag for Phase 7 gauntlet)

none

### BUSINESS-COMPLETENESS impact

- **2A-6** (form-error aria-live) — page contributes (every error region carries `role="alert" aria-live="polite" aria-atomic="true"`).
- **2A-8** (tab aria-current="page") — page contributes (active filter pill carries the attribute; no colour-only state).
- **2A-9** (visible required-field marker) — page contributes (Reject modal `*` in Cancelled colour flush to label, `aria-hidden="true"`).
- **2A-4** (heading hierarchy contiguous) — maintained (H1 via AdminPageHeader, per-row sr-only H2).
- **2A-18** (staff password-reset workflow admin side) — first end-to-end UI shipped.

### Net delta vs v1 audit

v1: IA 9 / VH 8 / TD 7 / A11y 8 / Resp 8 → **v2: IA 9 / VH 9 (+1) / TD 7 (=) / A11y 9 (+1) / Resp 9 (+1).** Net +3 across five dimensions; zero new P1; all v1 P1 resolved.

---

## account-password-requests — critique (v2 post-polish)

### Nielsen heuristic scores

1. **Visibility of system status — 9/10.** Tab strip carries aria-current and live Pending count, result-count line names the filter, pulsing clock on "Expires soon" gives an urgency cue without colour-only signalling, FAKE chip surfaces the dev posture without screaming.
2. **Match between system and real world — 9/10.** Plain calm English ("All caught up", "Open audit row", "Approval sends a one-time link to the requester's email"). Verbs over nouns. Reviewer attribution swaps to "you" on self-action. No raw permission names.
3. **User control and freedom — 8/10.** ESC + backdrop + Cancel + named cancel button on both modals; race-condition error renders inline "Refresh now" Ghost (real recovery, not just diagnostic copy); empty-state CTAs route back to Pending; deep-linkable `?status=` params.
4. **Consistency and standards — 9/10.** Tab-strip mechanics match Brief 04 primary tabs; AdminStatusBadge families align with DESIGN.md §5; ID slug now matches audit `?q=` slug; row hover + focus-within tints match; Approve = Primary green, Reject = Destructive red.
5. **Error prevention — 9/10.** Required asterisk on reject note, `required` attribute, server-side validation independent of client `required`, 240-char maxLength client + server, idempotency / self-approval / race code paths defined, "Trim the note to 240 characters or fewer" guard.
6. **Recognition rather than recall — 8/10.** Status pill on resolved rows + sub-row attribution + relative time + ID-slug. Pending tab suppresses redundant pill; All tab keeps it. ID slug matches audit query slug.
7. **Flexibility and efficiency — 7/10.** No keyboard shortcuts beyond native focus / Enter. No bulk select (correctly out-of-scope at this queue size per Brief §10.3). Five tabs are the filter surface. Brief explicitly does not require power-user shortcuts; PRODUCT.md flags them as anti-pattern for novice operators.
8. **Aesthetic and minimalist design — 9/10.** Avoids every PRODUCT.md anti-reference: no purple/blue gradients, no decorative blobs, no glassmorphism, no hero-metric template, no identical card grids, no side-stripe borders, no gradient text. Reads as list-with-actions, not SaaS dashboard.
9. **Help users recognize, diagnose, and recover from errors — 9/10.** Every error path has specific copy + specific recovery. Race condition names the OTHER reviewer + inline Refresh-now. Validation tells what to do, not what failed. error.tsx route boundary covers row-load with retry. Cancelled-family colour + XCircle icon + role="alert" aria-live="polite" accompany every error region.
10. **Help and documentation — 7/10.** Self-describing surface (subtitle names consequence; modal bodies restate the side-effect; absolute time appears as native title tooltip on relative-time span). No link-out doc — appropriate for 5-row tool used by two people.

**Average: 8.4/10. Total: 84/100. Rating: solid PASS.**

### AI-slop verdict — **PASS**

Does not look AI-generated. None of the absolute bans appear. First-order category reflex for "admin password-reset queue" would be SOC-style red severity dashboard or generic shadcn data-table; this is neither. Reads as a clinic back-office queue, matching the brief's anchor references (GitHub Pending invitations, Notion member requests, Auth0 verifications), not the SOC anti-anchor.

### UX-quality commentary

- "No generic SaaS / shadcn-default": row chrome composed (header → urgency sub-row → action footer with hairline divider), not a stock data-table row. Urbanist on email; Work Sans on body.
- "No identical card grids": rows differ by status (Pending → urgency + three actions; resolved → attribution + audit link; rejected → reviewer-note well). List is varied per content.
- "No color-only status": every status pairs colour with text + icon.
- "No decorative blobs / glassmorphism": only decoration is the avatar placeholder ring and the dev-mode chip's leading dot. Both earn their place.
- "No hero-metric template": count appears as a single line in the active-tab label and a one-line result count.
- State-word discipline (Stripe-style): "Approved" / "Rejected" / "Expired" / "Pending review". Discrete state words.

### Net delta vs v1 critique

v1 averaged ~8.2/10 PASS → **v2: 8.4/10 PASS (+0.2, no regressions).**

Movement traceable to the polish pass:
- **Visibility of system status (+):** motion-safe clock pulse on urgent-soon line; visibility raised without colour-alarm.
- **Consistency and standards (+):** ID slug now matches audit deep-link.
- **Recognition rather than recall (+):** Pending tab no longer duplicates the Pending pill on every row.
- **Aesthetic and minimalist (+):** dashed FAKE banner replaced with single quiet "Dev mode" chip + tooltip.
- **Help recognize / recover (+):** new error.tsx route-level boundary covers row-load failure mode.
- **Aesthetic and minimalist (+):** result-count line stepped down to label-step xs.
- **Match real world (=):** reject `*` marker flush to label (typographic polish, no scoring effect, but cleaner).
- **375 mobile coherence (=):** five tabs fit at 375; action buttons now stack full-width on mobile per brief §5.

Nothing in the polish pass introduced a new anti-pattern, broke the absolute-ban list, or pushed the page toward category reflex. The page is, after the polish pass, more confidently itself than v1.
### Dimension scores (each /4) — v1 → v2 deltas

| Dimension | v1 | v2 | Δ | Key finding |
|---|---|---|---|---|
| Typography | 3.5 | **4.0** | **+0.5** | PlainTextWell + state-3 `<dl>` now lock to brief's 0.75rem label step + 1rem body step (B-2/B-3); rest of surface was already on-token. |
| Color | 3.5 | **4.0** | **+0.5** | All Cancelled-text literals (`oklch(26% 0.14 25)`) replaced with `var(--admin-danger)` across `ForgotForm.tsx:22,119,135` + `SetNewPassword.tsx:29,140,177,193` (B-4); zero raw OKLCH literals remain in the surface. |
| Layout | 3.5 | **4.0** | **+0.5** | Card footer spacing now responsive to `showBackLink` (40px on state 4 / 24px elsewhere) per A-2 (`PasswordResetCard.tsx:101`); reviewer-note well + state-3 `<dl>` upgraded from `--admin-radius-sm` to `--admin-radius-md` matching brief 8px (B-1, B-3). |
| Motion | 4.0 | **4.0** | 0 | Surface remains correctly motion-free (server-rendered route re-renders); button spinner is sole animation; reduced-motion honoured trivially. |
| Accessibility | 3.0 | **3.5** | **+0.5** | `maskedEmailA11yLabel()` helper (E-3) eliminates the "t dot dot at" VoiceOver leak on the two masked-email lines; `title=` chip tooltips removed (E-1) so chip a11y meaning now lives in icon + label + family colour. Still short of 4.0: residual `title=""` tooltip on `SetNewPassword.tsx:126`, plus the masked-email well needing `<dt>`/`<dd>` baseline alignment confirmed via screen-reader. |

**Total: 19.5/20 (v1 17.5 → v2 19.5, +2.0). Rating: Excellent (minor polish).**

### P0 findings
none.

### P1 findings
- **[P1] FAKE-sanctioned state-4 success redirect leaks fake state to user** — `src/app/admin/password-reset/actions.ts:154` redirects to `/admin/login?reason=fake-success` after a successful password set. The staff member sees an honest end-state but cannot complete the documented flow (no Supabase Auth session is minted, no `password_reset_completed` audit row is written). Tagged P1 for Phase 7 gauntlet; resolution is gated on `BUILD-password-reset-request-actions.md`. **Carried over from v1**, status unchanged (FAKE-sanctioned).

### P2 findings
- **[P2] `SetNewPassword` `title="Mix in numbers, symbols…"` tooltip is keyboard-inaccessible** — `src/app/admin/password-reset/states/SetNewPassword.tsx:126`. Brief §Tooltip-text §11 specifies this as a `title=` per brief, but the same E-1 keyboard-tooltip critique that retired the chip tooltips applies here. The visible "At least 12 characters." hint on line 132 already carries the load; the `title=` adds nothing accessible. Recommend dropping the attribute or promoting it to a visible hint line.
- **[P2] Audit-log writes silently absent** — `src/app/admin/password-reset/actions.ts:47-155`. Brief §Carry-forwards mandates four `audit_logs` rows. None are written under FAKE. Resolved by `BUILD-password-reset-request-actions.md`.
- **[P2] Cookie is JSON-not-signed under FAKE** — `actions.ts:74-86` writes a plain JSON payload with no HMAC. Brief §11 state 2 specifies a "signed cookie with the request's row ID + email hash". Resolved by `BUILD-password-reset-request-actions.md`.

### P3 findings
- **[P3] `chunk1-*` screenshots in `redesign/screenshots/password-reset-redesign/`** remain alongside the refreshed `password-reset-polish-final-*` and `password-reset-state{1-6}-*` set. Not a production issue. Recommend pruning to the post-refinement set.
- **[P3] `hintId` referenced on `expired-inline` variant but `aria-describedby` could double-bind** — `ForgotForm.tsx:106-108`. Consider `aria-describedby={fieldError ? \`${errorId} ${hintId}\` : hintId}` for parity with `SetNewPassword.tsx:122-124`.
- **[P3] FAKE plain JSON cookie shape is craftable** — `page.tsx:50-67`. Same root cause as the P2 cookie-signing gap; no real harm flows.

### P1 (tag for Phase 7 gauntlet)
- **[P1] state-4 happy-path redirects to `/admin/login?reason=fake-success`** — `src/app/admin/password-reset/actions.ts:154`. FAKE-sanctioned; resolution gated on `BUILD-password-reset-request-actions.md`.

### BUSINESS-COMPLETENESS impact
- **2A-6** (form errors silently fail to announce, `BLOCKS-REDESIGN · Zone 1 · PARTIAL`) — **contributes**. Field error in `ForgotForm.tsx:114-118`; new-password field error in `SetNewPassword.tsx:135-139`; confirm-password field error in `SetNewPassword.tsx:172-176`; plus the form-level server-error region in both files.
- **2A-9** (required-field markers invisible, `BLOCKS-REDESIGN · Zone 1 · PARTIAL`) — **contributes**. Visible `*` markers in `var(--admin-danger)` with `aria-hidden="true"` on email + new password + confirm new password labels. After B-4 these use the token instead of an inline OKLCH literal.

### Net delta vs v1
- **Closed (10/10 refinement-pass gaps land cleanly):**
  - A-1 → Ghost-button browser default border nullified (`SubmittedConfirmation.tsx:41`, `PendingStatus.tsx:70`).
  - A-2 → Footer spacing conditional on `showBackLink` (`PasswordResetCard.tsx:101`).
  - B-1 → Reviewer-note well now `--admin-radius-md`.
  - B-2 → PlainTextWell label `text-xs font-medium` + body `text-base`.
  - B-3 → State-3 `<dl>` typography to brief spec + `items-baseline` + `--admin-radius-md`.
  - B-4 → All Cancelled-text literals → `var(--admin-danger)` (5 occurrences across two files).
  - B-5 → State chips now `AdminStatusBadge` primitive from `admin-ui.tsx:671-704`. Four inline chip definitions removed.
  - C-7 → Hostile-token + state-6 inline form carries "An Owner reviews each new request." caveat (`ForgotForm.tsx:75-81`).
  - E-1 → `title=` chip tooltips eliminated.
  - E-3 → `maskedEmailA11yLabel()` applied on `SubmittedConfirmation.tsx:32` + `PendingStatus.tsx:60`.

- **Remained (single carry-over P1):**
  - State-4 happy-path FAKE redirect (`actions.ts:154`). Architectural, gated on backend BUILD plan.

- **Regressed:** none.

**Final score: 19.5/20 (v1 17.5 → v2 +2.0), rating Excellent.**


## password-reset — critique (v2 — post-refinement)

Re-scored against the same Nielsen rubric used for v1 (45/50). Source: PasswordResetCard.tsx + PasswordResetSubmitButton.tsx + actions.ts + page.tsx + [token]/page.tsx + states/{ForgotForm,SubmittedConfirmation,PendingStatus,SetNewPassword,Rejected,Expired}.tsx, plus the refreshed `polish-final-{375,768,1440}.png` and `state{1-375,1-768,1-1440,2-1440,3-1440,4-1440,5-1440,6-1440}.png` set.

### Nielsen heuristic scores

| # | Heuristic | v2 score | v1 score | Δ | Key observation |
|---|---|---|---|---|---|
| 1 | Visibility of system status | **5/5** | 5/5 | 0 | Chip-per-state mapping is now driven through the canonical AdminStatusBadge primitive (`page.tsx` lines 35, 38–40), so chip + icon + label always travel together. `useFormStatus` spinner on the Primary still carries `aria-busy`. State 3's `<dl>` now reads as a status block instead of a free-form panel. |
| 2 | Match between system and the real world | **5/5** | 5/5 | 0 | All state H1s + body copy still translate the table's `pending`/`approved`/`rejected`/`expired` enum into operator vocabulary verbatim. |
| 3 | User control and freedom | **5/5** | 4/5 | **+1** | A-1 closes the inconsistent-affordance issue v1 flagged: the "Submit a different email" trigger on states 2 and 3 is now a clean text-link with the same focus-ring + underline-on-hover treatment as "Back to sign in". Back-link is suppressed only on state 4 (mid-flow), which is correct. |
| 4 | Consistency and standards | **5/5** | 5/5 | 0 | B-5 is the headline consistency win. Every chip in this surface — Pending, Approved, Not approved, Expired — now resolves through the single tone-to-icon-to-token mapping in `admin-ui.tsx`. B-1 + B-3 adopt the card-radius token explicitly. B-4 binds the required-marker + error-text to `var(--admin-danger)`. |
| 5 | Error prevention | **5/5** | 4/5 | **+1** | C-7 lifts the hostile-token + state-6 caveat to "An Owner reviews each new request." — a single muted line that pre-empts the SaaS-reset-link expectation a returning user might import from another product. Email enumeration is still protected (uniform response). |
| 6 | Recognition rather than recall | **5/5** | 5/5 | 0 | Chip carries the heading's meaning in icon + label form for every state; relative-time string removes the need to recall the submission time; B-2 sized the PlainTextWell label to 0.75rem Work Sans 500 vs the body's 1rem Work Sans 400, so "Note from the reviewer:" reads as a label and the note itself reads as content. |
| 7 | Flexibility and efficiency of use | **4/5** | 3/5 | **+1** | The persistent ceiling on this heuristic is that the flow is built for novice operators with no power-user accelerators. v1 docked a full point. v2 deserves credit for one real efficiency: the maskedEmailA11yLabel (E-3) wraps the masked email so screen-reader users hear "Sent to your email at rahmatherapy.example.test, address starts with the letter t" instead of "t dot dot at" — an efficiency win for the AT user population specifically. |
| 8 | Aesthetic and minimalist design | **5/5** | 5/5 | 0 | A-2 (40px instead of 24px below the form on state 4 when the back-link is hidden) is a small but real composition fix. Card max-width 440px still reads disciplined. No new chrome, no decorative blobs, no shadow at rest. |
| 9 | Help users recognise, diagnose, recover from errors | **5/5** | 5/5 | 0 | `role="alert" aria-live="polite" aria-atomic="true"` regions in ForgotForm and SetNewPassword; field-level + form-level error regions are visually distinct via the danger-tinted bordered well; reviewer-note shows recovery context inline; hostile-token state offers the inline form right there so the user can self-recover. |
| 10 | Help and documentation | **4/5** | 4/5 | 0 | E-1 removed the title-attribute tooltips that v1 docked the +1 for — correctly so, because `title` attributes are keyboard-inaccessible and screen-reader-inconsistent. The 12-character helper, the "An Owner reviews" caveat, and the reviewer-note are the documentation surface; that remains adequate for a 6-state recovery flow. |
| | **Total** | **48/50** | **45/50** | **+3** | Strong band — production-ready with one unavoidable structural ceiling on Flexibility. |

### AI-slop verdict

**PASS** — the surface holds the v1 PASS and meaningfully improves on it. Tokenised radii + danger colour, single-source AdminStatusBadge, AT-friendly masked-email labels, and a cleaned-up Ghost reset button remove the last visual hand-rolled-ness without introducing any new slop tells.

### UX-quality commentary (mapped to PRODUCT.md anti-references)

- **"Generic SaaS / shadcn-default dashboards" + "the SaaS reset-link lie".** v2 reinforces the anti-anchor by making the "An Owner reviews each new request" caveat appear *every time* the form is shown (state 1, state 6, hostile-token state 5) via the `expired-inline` variant.
- **"Loud palettes, dense admin defaults."** A-2 added 16px of breathing room and removed nothing; B-1/B-3 changed radius tokens but added zero density.
- **"Color-only status signalling."** B-5 is the strongest closure here. By routing all four state chips through AdminStatusBadge, the brief's "icon + label + tint, all four required" contract is enforced structurally.
- **"Tools so spare they feel cold."** The chip + Cormorant-friendly heading + warm-ivory canvas + gold-and-teal logo is doing the warmth work that avatars do elsewhere in the admin.
- **"Required fields visibly marked"** + **"Status is never color-only"**. B-4 binds the required-marker colour to `var(--admin-danger)` — drift-proof. E-3 binds the masked email to an AT-friendly label.

### Net delta vs v1

- **Score: 48/50 (up from 45/50, +3).** Wins on Control (A-1), Error prevention (C-7), and Flexibility (B-5 + E-3). No regressions in any heuristic; aesthetic and visibility were already at 5 and remained there.
- **AI-slop verdict: PASS held.** The refinement pass closed brief-alignment gaps without introducing flair.
- **What's still uncapped.** Flexibility (4/5) and Help (4/5) are structural ceilings of a 6-state pre-auth surface for novice operators; raising either would require flow-level additions the brief explicitly does not request.
- **What v2 quietly fixed beyond the 10 named gaps.** State 4 footer breathing (A-2) and the expired-inline copy delta (C-7) also de-noise the page rhythm in a way the v1 critique flagged only obliquely.
### P1 findings

- **Role pill is profile-role-driven, not variant-driven** — `src/app/admin/dashboard/page.tsx:550` resolves `roleLabel = getRoleLabel(profile)` (string-matching on role name), then passes to header at `src/app/admin/dashboard/dashboard-header.tsx:53-61`. Brief Section 8 + Recipe Context mandate the pill copy resolves from `getDashboardCopy(plan.variant).rolePill`; today `getDashboardCopy` only returns `{title, subtitle}` (page.tsx:414-432) with no `rolePill` slot. If a Coordinator user's `roles[0].name` is missing or non-conforming, the "Coordinator" pill silently drops.
- **Role pill positioned under page H1, not in the chrome header rail** — `src/app/admin/dashboard/dashboard-header.tsx:53-61`. Brief Section 5.1 and Section 8 require the role pill in the AdminTopNav right rail (alongside NotificationBell + cmd-K hint). Current placement under H1 breaks the "same chrome across variants" inheritance from the Owner/Admin brief.
- **Role pill hidden on `<md` viewports** — `src/app/admin/dashboard/dashboard-header.tsx:54` uses `hidden ... md:inline-flex`, so a Coordinator on a 375px phone (the brief's explicit mobile-first persona) never sees their role context.

### P2 findings

- **Hero Today numeral exceeds spec size for Coordinator variant** — `src/app/admin/dashboard/dashboard-cards.tsx:281` sets `clamp(2.75rem, 6vw, 4.5rem)` (up to 72px). Brief Section 5.3 + tokens specs Cormorant Garamond 700 at **3.157rem (~50px)** for the Coordinator variant ("Chronicle, no gold").
- **`<h2 class="text-[10px] uppercase">SNAPSHOT . TODAY</h2>` is an eyebrow styled as a heading** — `src/app/admin/dashboard/dashboard-cards.tsx:276-278`. Brief Section 8 names the Tier-1 H2 as "Today", not "SNAPSHOT . TODAY".
- **AssignmentChip and TodayCoordinatorSubLine "unassigned" tone use raw `--admin-warning` token, not the Attention family (`status-attention-bg`/`status-attention-text`)** — `src/app/admin/dashboard/dashboard-cards.tsx:563, 645, 658, 666`. Brief Section 5.3 + carry-forward calls for `status-attention-bg` / `status-attention-text` token pair.

### P3 findings

- **Hardcoded `rgba(0,0,0,0.02)` and `rgba(0,0,0,0.04)` chip shadows on inactive date-preset pills** — `src/app/admin/dashboard/dashboard-filters-client.tsx:346`. DESIGN.md asks for `oklch(23% 0.073 155 / X)`.
- **Filter strip uses `backdrop-blur-md` + `bg-gradient-to-b` for sticky chrome** — `src/app/admin/dashboard/dashboard-filters-client.tsx:317-318`. Borderline glassmorphism; sticky filter qualifies as purposeful use.
- **Cormorant Garamond "0" hero numeral renders visually ambiguous** at very large sizes. Cosmetic only.
- **`getDashboardCopy(variant, today)` returns the same `subtitle: "${date} . Luton"` for `coordinator` and Owner/Admin default branch** — page.tsx:416-432. Refactor opportunity.
- **`coordinator-` `variantKey` passed at `page.tsx:762` has trailing dash that gets concatenated as `coord-staffId`** — works correctly but looks like a typo for future maintainers.

### Backend status

**N-A.** Read-only dashboard surface. Existing `getDashboardData` aggregator returns `data.enquiries` and `data.assignments`; no server action, no migration, no new helper. No BUILD plan files block this page.

### P1 (tag for Phase 7 gauntlet)

- Role pill is profile-role-driven, not variant-driven — `src/app/admin/dashboard/page.tsx:550` + `dashboard-header.tsx:53-61`
- Role pill positioned under page H1, not in the chrome header rail — `src/app/admin/dashboard/dashboard-header.tsx:53-61`
- Role pill hidden on `<md` viewports — `src/app/admin/dashboard/dashboard-header.tsx:54`

### BUSINESS-COMPLETENESS impact

- **2A-6** preserved on the custom date-range error path (dashboard-filters-client.tsx:378-380, 527-528). No regression.
- **2A-7** not directly exercised on the coordinator variant (no `DemandTrendCard` renders); carry-forward preserved upstream.
- **2A-8** applied on the `SnapshotViewToggle` List/Timeline links (dashboard-cards.tsx:401, 414) and on the date-preset chip group (dashboard-filters-client.tsx:340).

No newly-introduced Track A contributions; preserves universal patterns from earlier sessions.


## dashboard-coordinator — critique

**Verdict on AI slop:** **PASS** — the surface reads as a Rahma-shaped coordinator triage board, not a generic SaaS dashboard: warm ivory canvas, Cormorant numeral as the lone serif accent, varied (not identical) card shapes, status families with text + icon, no gradient text, no glassmorphism, no `border-l-4`, no hero-metric template, no decorative blobs.

### Nielsen heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | UPDATED + active filter pills + counts strip are clear; assignment-status colour on Today vanishes when no bookings exist. |
| 2 | Match between system and real world | 4 | Operator vocabulary throughout; "SNAPSHOT . TODAY" eyebrow is the only dashboard-speak. |
| 3 | User control and freedom | 3 | Tier 2 disclosure persists per user/variant; filter "Clear filters" works. No pin to keep Active Enquiries default-open. |
| 4 | Consistency and standards | 3 | Three different numeral treatments across three tiles (Cormorant/Cormorant/Work-Sans-bold); three different "everything's fine" phrasings in one viewport. |
| 5 | Error prevention | 3 | Read-only surface; minimal risk. |
| 6 | Recognition rather than recall | 3 | Source icons + lifecycle chips are recognition-grade; enquiry rows use generic `user-round` glyph rather than initialled avatars. |
| 7 | Flexibility and efficiency | 2 | cmd-K + "More filters" + presets work; no inline assign-therapist on Today row (Coordinator's primary daily decision). |
| 8 | Aesthetic and minimalist design | 3 | Restrained warmth passes the AI-slop test. Quiet-day card shows five horizontally-separated "nothing" signals. |
| 9 | Help users recognize/diagnose/recover from errors | 2 | No errors visible; spec promises inline alert regions + persistent toast for stale-enquiry convert. |
| 10 | Help and documentation | 2 | No tooltip on role pill, no first-run hint on Tier 2 disclosure, tooltips on chips require hover. |
| **Total** | | **28 / 40** | Solid; room to climb on consistency, efficiency, and help. |

### Anti-references cross-check (PRODUCT.md)

- **Generic SaaS / shadcn-default dashboards** — avoided. Cormorant numeral + warm-ivory tonal lift + green action-primary chrome are unmistakably Rahma.
- **Hero-metric template** — avoided as a template; Today panel uses varied composition.
- **Identical card grids** — avoided. Tier 1 is 60/40 with visually distinct cards. Tier 2 sub-grid differs in structure (list-first vs summary-first).
- **Decorative blobs / glassmorphism / gradient text** — none observed.
- **Side-stripe borders** — none observed in source.
- **Colour-only status signalling** — passes. AssignmentChip pairs `UserX` + label; lifecycle chip carries "New"/"Contacted"; source icons sit beside source-bearing row.
- **Tools so spare they feel cold (avatars)** — partially avoided. Enquiry rows show category icons where brief commits to avatars; biggest warmth-deficit finding.
- **Power must not equal clutter** — honoured. Tier 2 collapsed by default; first viewport at 1440 is Tier 1 only.
- **Empty states encourage rather than abandon** — strong ("Quiet day" + "Use the time to follow up on enquiries"; "All caught up").

### Concrete observations

1. Cormorant `0` on empty-state inverts hierarchy — absence of work rendered as the day's headline; a `heroCount === 0 && isToday` guard would protect the Cormorant's earned rarity.
2. Mobile (375) header rail loses the role pill; PRODUCT.md role-clarity success metric depends on legibility at every breakpoint.
3. Three "everything's fine" copies in one viewport ("All clear" / "All systems quiet" / "All caught up") — state-word discipline would pick one.
4. Enquiry rows render `user-round` glyph for every row; brief mandates avatars on assignment/team/booking-ownership surfaces.
5. Today panel's "View calendar / View bookings" CTA pair competes with empty-state's implicit CTA; a quiet-day variant would tighten rhythm.
6. Tier 2 "Active queues" + subtitle gives no glimpse of contents when collapsed; a small count chip on the header would let Coordinators scan-and-skip.
7. `AssignmentChip` is `hidden sm:inline-flex` on the row body — mobile rows fall back to plain status badge.

### One-sentence overall

The page is a credibly Rahma-shaped Coordinator triage surface that wins on warmth, restraint, and brief-fidelity (no anti-pattern violations, no AI-slop tells), and loses points on three repeated *consistency* slips (avatars missing from enquiry rows, three "all clear" copies in one viewport, the Cormorant `0` shouting on quiet days) that a single `clarify` + a small `consistency` pass would close.


## dashboard-coordinator — audit (post-fix)

**Files audited:** `src/app/admin/dashboard/page.tsx`, `dashboard-cards.tsx`, `dashboard-header.tsx`, `dashboard-filters-client.tsx`, `attention-group-client.tsx`, `src/app/admin/components/notification-bell.tsx`. Screenshots: `dashboard-coordinator-polish-final-{375,768,1440}.png`.

### Severity rubric (impeccable v5 L884-890, verbatim)
- **P0 - Blocks release - fix before shipping anything**
- **P1 - Fix this sprint - significant impact on users**
- **P2 - Next cycle - noticeable but not blocking**
- **P3 - Polish - minor, fix when time allows**

### 5 dimension scores

| Dimension | Score | Notes |
|---|---:|---|
| Visual hierarchy & rhythm | 8.0/10 | Tier 1 reads first; H2 "Today" lands at spec scale; eyebrow→H2 swap correctly applied for coordinator. Marginal: zero-state Cormorant glyph collapses visually. |
| Token & component fidelity | 8.5/10 | Tokens used throughout; AdminDashboardPanel reused; lifecycle chip token-family is codebase-collapsed (Pending aliased to warning at runtime). |
| Information density & calm | 8.0/10 | Coordinator chrome is calmer than Owner/Admin: 2 sub-tiles, no DemandTrend/StaffCapacity/PaymentHealth. Enquiry-count duplication fixed by passing openEnquiries=0 to Operations Health. |
| Empty / loading / error states | 7.5/10 | "Quiet day" pivot works; "Open enquiries" Secondary CTA below; per-tile error boundary still gap on coordinator branch. |
| Accessibility (WCAG 2.1 AA) | 8.0/10 | Skip-link, attention-dialog-title, role pill aria-label all preserved; assignment + lifecycle chips now carry Lucide icon + label (Named Status Rule met post-fix). |

**Overall craft:** 8.0/10.

### P0 - Blocks release
- *(none)*

### P1 - Fix this sprint
- **Tier 1/Tier 2 cards on coordinator variant not wrapped in `AdminErrorBoundary`** - `src/app/admin/dashboard/page.tsx:721, 767, 805-813`. Deferred to Phase 7 (cross-variant resilience pattern).

### P2 - Next cycle
- **0-state Cormorant numeral on Today panel reads as narrow vertical strokes, not as a digit "0"** - `dashboard-cards.tsx:274-278`. Either swap typeface to Work Sans on 0-state, or render an em-dash instead.
- **Today panel "READY" row is a nested rounded surface** - `dashboard-cards.tsx:357-369`. Treat as inline row or step to canvas tone.

### P3 - Polish
- **Header H1 size uses `text-2xl ... sm:text-[1.875rem]` instead of DESIGN.md display token clamp** - `dashboard-header.tsx:30`.
- **Pending vs Attention token-family distinction** - codebase only defines `--admin-warning-*`; defer to Phase 4 design-system token expansion.

### Backend status
**N-A.** Read-only by brief commitment. `getDashboardData` already exposes coordinator-variant payload with enquiries. No BUILD plan reference.

### P1 (tag for Phase 7 gauntlet)
- Tier 1/Tier 2 dashboard cards on coordinator variant not wrapped in `AdminErrorBoundary` - `src/app/admin/dashboard/page.tsx:721, 767, 805-813`

### BUSINESS-COMPLETENESS impact
- Track A item 1 (Heading hierarchy contiguous) - H2 on Tier 1 + Tier 2; H3 on sub-tiles.
- Track A item 2 (Form errors aria-live) - filter strip uses `role="alert"` aria-live on custom-date error.
- Track A item 7 (Recharts empty-data) - N-A; Demand Trend not rendered for coordinator.
- Track A item 9 (Tab `aria-current="page"`) - applied on SnapshotViewToggle + date preset chips.
- No net-new Track A contribution.

### Delta vs first audit
First-audit P1s (3, all role-pill chrome) all closed. Second-pass added P1s (lifecycle chip icon, lifecycle chip token-family, OH "active issues" wording, missing AdminErrorBoundary); 3 of 4 closed in this third pass (Clock icon added, OH wording switched to "All systems quiet" on success, enquiry-count duplication removed via openEnquiries=0). One P1 remains (AdminErrorBoundary wrap), deferred to Phase 7.


## dashboard-coordinator — critique (post-fix)

### Nielsen heuristic scores (post-fix)

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | 9/10 | Live date + "Updated just now"; persistent Coordinator role pill (variant fallback); chip selection unmistakable; Tier 2 count preview legible without expansion. |
| 2 | Match between system and real world | 9/10 | Verb-led actions throughout. Operations Health now says "All systems quiet" on success (post-fix). |
| 3 | User control and freedom | 8/10 | Disclosure persists per user/variant; filter chips reversible; Convert preserves enquiryId. |
| 4 | Consistency and standards | 9/10 | Same chrome as Owner/Admin; Cormorant strictly numerals; Tier 2 tonal lift to surface-page; lining-nums + tabular-nums. |
| 5 | Error prevention | 8/10 | Payments Ready chip gated; Export RBAC-hidden; OH drops contradiction on success. |
| 6 | Recognition rather than recall | 9/10 | Initialled avatars + source-icon corner badge on enquiry rows; absolute-date tooltip on chips; role pill permanent; Tier 2 count preview. |
| 7 | Flexibility and efficiency | 8/10 | cmd-K, filter chips one-tap, Convert is one click. Mobile Filters reachable without horizontal scroll. |
| 8 | Aesthetic and minimalist design | 8/10 | Two-tier composition, Cormorant numerals balanced, no shadows at rest, Tonal Lift honoured. |
| 9 | Help users recognize/diagnose/recover from errors | 8/10 | Empty states recover gracefully; OH "ALL CLEAR" footer is exact diagnostic granularity. |
| 10 | Help and documentation | 7/10 | Native title tooltips on chips, role pill, source icons, chevron. |

**Heuristic average: 8.3 / 10.**

### AI-slop verdict: **PASS**

The surface no longer matches any default category-reflex coordinator dashboard. Warm-ivory card-board grammar, two-tier disclosure, gold absent by deliberate restraint, no gradient text, no hero-metric stack, no identical card grid, no decorative blobs, no `border-l-4`. Signature serif numeral + initialled avatars + source-icon corner badges + voice-anchored copy read as Rahma, not as "AI made a coordinator dashboard."

### UX-quality commentary (mapped to PRODUCT.md anti-references)

- **Generic SaaS / shadcn-default - avoided.** Urbanist + Work Sans + Cormorant on warm-ivory canvas with deep clinic green chrome bar.
- **Identical card grids - avoided.** Tier 1 asymmetric (Today taller, content-led; Attention shorter, status-led). Tier 2 sub-tiles read as numerals tile vs diagnostic tile.
- **Decorative blobs / glassmorphism / hero-metric template - avoided.**
- **Color-only status signalling - avoided.** Every status carries text + icon (assignment chip + lifecycle chip both now icon-led post-fix).
- **Pure-typography stripped-bare Linear - avoided.** Initialled avatars, source-icon corner badge, leading-icon medallions.
- **Everything-on-one-screen - avoided.** Two tiers, one collapsed by default.

### Delta vs first critique

First-pass critique flagged: redundant TODAY pill, missing role pill at breakpoints, prominent gold dash, hard disclosure border, Payments Ready leak, nameless enquiry rows, weak Convert link, oversize Cormorant numeral. Second pass closed every one. Third pass (this round) added Clock icon on lifecycle chip (Named Status Rule), switched OH success copy from "active issues" to "All systems quiet", de-duplicated enquiry count between adjacent sub-tiles.


## dashboard-coordinator — audit (corrective round)

**Files audited:** `src/app/admin/dashboard/page.tsx`, `src/app/admin/dashboard/dashboard-cards.tsx`, `src/app/admin/dashboard/dashboard-header.tsx`, `src/app/admin/dashboard/dashboard-filters-client.tsx`. Screenshots: `redesign/screenshots/dashboard-coordinator-redesign/dashboard-coordinator-polish-final-{375,768,1440}.png`.

### Severity rubric (impeccable v5 L884-890, verbatim)
- **P0 - Blocks release - fix before shipping anything**
- **P1 - Fix this sprint - significant impact on users**
- **P2 - Next cycle - noticeable but not blocking**
- **P3 - Polish - minor, fix when time allows**

### 5 dimension scores

| Dimension | Score | Notes |
|---|---:|---|
| Visual hierarchy & rhythm | 8.5/10 | Tier 1 reads first; Cormorant Today numeral correctly demoted on 0-state; Tier 2 collapsed by default with live hint preview ("2 enquiries"); empty wrappers de-nested. |
| Token & component fidelity | 8.5/10 | Tokens used throughout; AdminDashboardPanel, AdminIconBadge, AdminEmptyState, AdminStatusBadge reused; Convert action uses --admin-radius-control + --admin-focus. |
| Information density & calm | 8.0/10 | FIX 2 removes ReadinessChip leak. UrgentAttentionPanel Payment-follow-up row leak now also closed (gate tightened to revenueAllowed). |
| Empty / loading / error states | 7.5/10 | "Quiet day" + "Open enquiries" Secondary pivot present; "All caught up" Confirmed tint; "No active enquiries" + handled-vs-fresh wording correct. Per-tile error boundary not wrapped on Coordinator branch sub-tree. |
| Accessibility (WCAG 2.1 AA) | 8.5/10 | Skip-link, admin-main, attention-dialog-title, admin-command-search preserved; role pill aria-label intact; Convert link satisfies WCAG 2.5.5 (min-h-11 = 44px). Assignment chip carries text + icon. Custom-date error uses role="alert" aria-live="polite". |

**Overall craft:** 8.2/10.

### P0 - Blocks release
- *(none)*

### P1 - Fix this sprint
- **Tier 1 + Tier 2 cards on Coordinator variant still not wrapped in `AdminErrorBoundary`** - `src/app/admin/dashboard/page.tsx:725-774, 776-821`. Carried from prior rounds; tagged for Phase 7 gauntlet.

### P2 - Next cycle
- **0-state Cormorant numeral on Today panel reads as narrow vertical strokes** - `src/app/admin/dashboard/dashboard-cards.tsx:277-281`. Either swap face to Work Sans on 0-state or substitute an em-dash glyph.
- **Today panel "READY" row is a nested rounded surface on a surface-card parent** - `src/app/admin/dashboard/dashboard-cards.tsx:360-372`. Mild nested-card pattern.
- **Tier 2 sub-tiles read as twin rectangles** - Active Enquiries pane height roughly equals Operations Health pane height. Brief promises asymmetric reading.

### P3 - Polish
- **Header H1 uses `text-2xl ... sm:text-[1.875rem]` instead of DESIGN.md display-token clamp** - `dashboard-header.tsx:30`.
- **`hover:-translate-y-px` on enquiry/today rows with `transition-all`** - dashboard-cards.tsx:586-588, 1044. Switch to `transition-transform, box-shadow, background-color` for explicit intent.
- **Two raw oklch literals for severity tints** - dashboard-cards.tsx:141-143, 1040-1043. Pre-existing baseline; defer to Phase 4 token expansion.
- **Active Enquiries lifecycle chip background reuses `--admin-warning-bg`** - dashboard-cards.tsx:849. Codebase aliases Pending→warning; defer to Phase 4 token rename.

### Backend status
**N-A.** Read-only by brief commitment. `getDashboardData` already returns coordinator-variant payload. No BUILD plan reference.

### P1 (tag for Phase 7 gauntlet)
- Per-tile `AdminErrorBoundary` wrap on Coordinator branch - `src/app/admin/dashboard/page.tsx:725-774, 776-821`

### BUSINESS-COMPLETENESS impact
- Track A item 1 (Heading hierarchy contiguous): H1 → H2 → H3 contiguous.
- Track A item 2 (Form errors aria-live): filter strip custom-date error uses role="alert" aria-live="polite".
- Track A item 7 (Recharts empty-data): N-A.
- Track A item 9 (Tab aria-current="page"): applied on SnapshotViewToggle + date-preset chips.
- Track A item 10 (WCAG 2.5.5 44px touch targets): Convert link upgrade to min-h-11 px-4 is a positive contribution.
- No net-new Track A debt introduced.

### Delta vs post-fix audit
Corrective round closed V-7 (TodayTimeline + UpcomingRangeList empty wrappers de-nested), V-10/M-6 (Convert link now satisfies WCAG 2.5.5 at min-h-11 px-4 gap-1.5), and V-8 fully (both ReadinessChip and the audit-discovered residual UrgentAttentionPanel Payment-follow-up row are now revenue-gated). AdminErrorBoundary P1 remains tagged for Phase 7.


## dashboard-coordinator — critique (corrective round)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | "Updated just now" + live counts in filter strip + Today inline sub-line clearly signal state; nothing hidden. |
| 2 | Match System / Real World | 4 | Front-desk language throughout ("Active queues", "Active enquiries", "Convert", "Quiet day"); no system jargon. |
| 3 | User Control and Freedom | 3 | Tier-2 disclosure remembers preference; filter clearing present; still no inline undo for assignment actions (out of scope here, lives on booking detail). |
| 4 | Consistency and Standards | 4 | Empty-state wrappers now plain px-4 py-8 matching the parent panel's interior treatment; no more card-in-card asymmetry against UrgentAttentionPanel. |
| 5 | Error Prevention | 3 | Coordinator can no longer accidentally see Payment-follow-up rows in UrgentAttentionPanel (revenue-gated at source); Convert link target is a pre-filled flow, not a destructive op. |
| 6 | Recognition Rather Than Recall | 4 | Source icons + lifecycle chips + named status badges keep enquiry context glanceable; no codes to remember. |
| 7 | Flexibility and Efficiency | 3 | cmd-K + date presets + Filters sheet; Convert is one tap from dashboard to pre-filled booking wizard. Touch target now 44px so thumb-driven mobile use is no longer a penalty. |
| 8 | Aesthetic and Minimalist Design | 4 | Tier-2 sub-tiles read as wells inside the parent panel, no double-bordered frames competing for attention; the Coordinator surface is visibly quieter than the Owner variant, as briefed. |
| 9 | Error Recovery | 3 | Inline empty states + stale-enquiry toast contract documented; no destructive ops on this surface to recover from. |
| 10 | Help and Documentation | 3 | Tooltip layer is rich (role pill, assignment chip, source icon, lifecycle chip); no in-product help center, which is consistent with PRODUCT.md's "no tutorial chrome" principle. |
| **Total** | | **35/40** | **Excellent - production-ready** |

**AI-slop verdict: PASS.** The Coordinator surface now reads as a role-narrowed front-desk queue with consistent panel grammar, no nested-card stutter, no revenue ghost-rows, and tap targets that respect the kitchen-counter scene sentence — none of the residual tells from the previous round survive.

**UX-quality mapping to PRODUCT.md anti-references.** The fixes pull the page further away from PRODUCT.md's named anti-references: stripping the empty-state card frames closes the "boxes inside boxes" SaaS-cliché the doc warns against; gating Payments at both `showPaymentsReadiness` and the `attentionSummaryRows` source closes a Notion-style "show everything to everyone and let them filter mentally" leak that contradicted Coordinator's revenue scope; and the 44px Convert chip honours the brief's explicit "phone in one hand, tea in the other" scene rather than the desktop-mouse default that would have been the lazy AI reflex. The result is a surface that earns its place beside the Owner variant by being demonstrably *narrower*, not just visually muted.

**Delta vs post-fix critique.** Three open observations from the post-fix round closed cleanly. V-7 (Tier-2 sub-tiles nesting bordered cards inside the parent disclosure) is resolved: both `UpcomingRangeList` and `TodayTimeline` empty-state wrappers render as plain padded regions. V-8 (Payments RBAC leak) is resolved at two layers: `showPaymentsReadiness` gates the ReadinessChip, and the audit-discovered residual leak through `attentionSummaryRows` is now bounded by `revenueAllowed && unpaidBookings.length > 0`. V-10/M-6 (Convert touch target under WCAG 2.5.5) is resolved: chips read as substantial pill buttons with full-width mobile treatment and `sm:w-auto` desktop sizing, matching the briefed `min-h-11 px-4 gap-1.5`. No regressions introduced.
## emails — audit

### Dimension scores (out of 5)

- **Brief fidelity:** 3 / 5 — Tab shell, Delivery feed grouping, Reminders list, status families, copy strings, FAKE markers all present and accurate. Two deviations cost it: PAGE_SIZE still 100 instead of the brief's 50-at-a-time "Load more" (replaced by a FAKE sentinel — acceptable rationale for BUILD-pending state but not what the brief asked), and EmptyState uses a Lucide-in-pill icon instead of the brief's named `emails-empty.svg` / `reminders-empty.svg` dignified illustrations.
- **DESIGN.md token discipline:** 3 / 5 — Status family tones via AdminStatusBadge are clean. Drift: inline `oklch(...)` literals across multiple files for danger / warning / confirmed contexts where the token pair already exists; `text-white` (Tailwind preset) instead of `--text-inverse`; inline shadow strings instead of named token; `bg-white/15` in TabStrip badge.
- **Accessibility:** 3 / 5 — `aria-current="page"` on active tab, `role="alert" aria-live="polite"` on filter-error region, `aria-busy` on resend, sr-only legends, focus rings, mono ID copy button labelled. Drift: avatar `<span aria-hidden="true" title="…">` (title on hidden + non-focusable element is dead), and the preset-chip handler crashed before the audit subagent's run (fixed by main agent after audit return, see P0 note).
- **Production-readiness / functional correctness:** 1 / 5 — `submit` ReferenceError in `FilterInputs` (`DeliveryFilterStrip.tsx:419`) crashed the Delivery tab when any preset chip ("Today" / "Last 7 days" / "Last 30 days") was clicked. (Fixed post-audit by main agent: `submit` now passed as a prop into `FilterInputs`; preset chips verified working at `?tab=delivery&range=today` via Playwright re-test.) Everything else can ship.
- **Visual craft & anti-slop:** 3.5 / 5 — Per-day grouped panels, mono provider IDs, status pill clusters, and the green-tinted spike-badge all land. Identical-card feed risk (8 stacked rows in the screenshot are nearly indistinguishable shapes) sits at the edge of the brief's stated grammar (audit-style log) so it's defensible. Em-dashes in user-visible `title` attributes nick the shared-laws "no em dashes" rule.

### P0 findings

- **`src/app/admin/emails/DeliveryFilterStrip.tsx:419` — RESOLVED post-audit.** `submit(next)` was called from inside `FilterInputs` but `submit` was declared only inside the parent `DeliveryFilterStrip`. The main agent passed `submit` as a prop into `FilterInputs` and verified via Playwright that clicking the "Today" preset chip now navigates to `?tab=delivery&range=today` without throwing. No remaining P0.

### P1 findings

- **`src/app/admin/emails/page.tsx:62`** — `PAGE_SIZE = 100`. Brief §4: "Pagination: Delivery moves from hard `limit(100)` to a Load more 50-at-a-time". Implementation kept the 100-row hard limit and replaced "Load more" with a dashed-border "BUILD pending" sentinel. Documented in HARDEN-RECS-emails.md §6 as a Phase 7 follow-up tied to `BUILD-email-delivery-filter-query.md`.
- **`src/app/admin/components/EmptyState.tsx:46-61` (consumed by `page.tsx:421-479,709-717`)** — Empty state uses a Lucide icon in a green circle, not the named `emails-empty.svg` / `reminders-empty.svg` dignified illustration. IMAGES-NEEDED.md rows for both assets were added in Step 3.

### P2 findings

- **`DeliveryFilterStrip.tsx:35`** — Adds an undocumented `range` GET param. Brief §4 lists only `tab, event_type, delivery_status, recipient_role, from, to, q`. Either add `range` to the brief contract or collapse to `from`/`to` server-side.
- **`page.tsx:317, DeliveryFilterStrip.tsx:192, ReminderResendForm.tsx:112`** — `text-white` Tailwind preset instead of `--text-inverse` token.
- **`page.tsx:317`** — Active tab pill carries a resting shadow. DESIGN.md §4 Tonal Lift Rule: shadows are exclusively for state.
- **`page.tsx:549`** — `border-dashed` on the BUILD-pending sentinel. Brand prefers solid borders.
- **`page.tsx` + `DeliveryFilterStrip.tsx`** — Inline `oklch(...)` literals for cancelled/attention contexts where named tokens exist.
- **User-visible em-dashes** at `page.tsx:603,771,790` and `CopyEventId.tsx:27`. (Project voice uses em-dashes; impeccable shared-law deviation is intentional.)
- **`page.tsx:758`** — `<span aria-hidden="true" title="…">` on the avatar dead-ends both AT announcement and pointer tooltip on non-focusable element.
- **`page.tsx:330,332`** — TabStrip badge uses `bg-white/15 text-white` decorative Tailwind preset instead of token-derived values.

### P3 findings

- **`page.tsx:582,753`** — Inline hover shadows should use the named `card-hover` shadow.
- **`page.tsx:662-666,688-692` and `CopyEventId.tsx:42-45`** — Double-applied font-family (Tailwind arbitrary + inline style).
- **`DeliveryFilterStrip.tsx:96-107`** — Custom range chip renders even with empty from/to (no-op filter).
- **`page.tsx:537`** — `<ol>` for event log without semantic ordinal; `<ul>` is more honest.

### Backend status

`FAKE` — blocking BUILD plan filenames (verbatim from IMPLEMENTATION-PLAN.md L1150-1151):

- `BUILD-email-delivery-filter-query.md`
- `BUILD-automated-booking-reminders.md`

FAKE markers present at `page.tsx:134-139` (filter call site, comment-only), `DeliveryFilterStrip.tsx:120-128` (`data-redesign-backend="FAKE"` on wrapper), `page.tsx:550` (`data-redesign-backend="FAKE"` on Load-more sentinel), and `ReminderResendForm.tsx:55-58` (FAKE-FAILURE-PATH on the toast.error branch). The manual `sendManualBookingReminder` server action remains wired verbatim (untouchable, RECON §5/§6.4 honoured).

### P1 (tag for Phase 7 gauntlet)

- PAGE_SIZE deviation from brief's 50-at-a-time "Load more" — `src/app/admin/emails/page.tsx:62` (FAKE sentinel at `page.tsx:547-561`)
- EmptyState illustrations missing the named `emails-empty.svg` / `reminders-empty.svg` per brief Recipe Context — `src/app/admin/components/EmptyState.tsx:46-61` (consumed at `page.tsx:434-479,712-716`)

### BUSINESS-COMPLETENESS impact

- **2A-6** — `role="alert" aria-live="polite"` on the filter-error region (`DeliveryFilterStrip.tsx:215-221, 307-315`). New contribution.
- **2A-8** — `aria-current="page"` on the active tab pill (`page.tsx:313`). New contribution.
- **2A-9** — N/A. No required form fields on this surface.

## emails — critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Failed-24h count on Delivery tab badge, Reminders count on its tab, "Showing 9 recent events" live region, `aria-busy` on resend, "Last reminder" sub-line, copy-to-clipboard toast. Status is loud where it should be. |
| 2 | Match System / Real World | 3 | "Provider error" / "provider message ID" are vendor-engineer terms surfaced to a novice operator who calls Resend "the email thing"; "Accepted" vs "Delivered" both render as green pills with no distinguishing copy on the row to explain why a customer might still report not receiving it. Per-day grouping ("Friday 15 May") nails the audit-grammar pairing the brief asked for. |
| 3 | User Control and Freedom | 3 | Filter chips with individual X clears are excellent; tab links are full-document nav (predictable). No undo on resend, but the brief explicitly forbids confirmation modals because resends are cheap/idempotent — defensible. Custom date range needs an explicit Apply after picking from/to, which is correct but undocumented in UI (no helper text). |
| 4 | Consistency and Standards | 3 | Tab pill grammar matches the rest of the admin; AdminPanel + AdminStatusBadge composition is on-vocab. Two divergences: the inline error banner on Delivery load failure uses raw oklch literals rather than a Cancelled-family token alias (functional but token-leaky), and the badge tone on the Delivery tab uses a bespoke `bg-[oklch(95.5%_0.028_20)]` rather than the AdminStatusBadge `danger` tone the rest of the page already consumes — same family, two construction paths. |
| 5 | Error Prevention | 3 | Resend button hidden when `hasRecipient` is false and replaced with an "Add an email on the booking" link to the booking detail — exactly the right move. Min-4-char search guard prevents accidental zero-result trips. No prevention against double-resend if the operator gets impatient and clicks twice across a slow network (the optimistic spinner helps but the form is not disabled across mounts). |
| 6 | Recognition Rather Than Recall | 3 | The Range row reads "Today / Last 7 days / Last 30 days / Custom" with `aria-pressed` and a visible active-pill — excellent recognition affordance. Active filter chips beneath the strip remove the recall burden entirely. The mono `provider_message_id` token is recognisable as a copy target only after hover; no leading copy-icon on the resting state. |
| 7 | Flexibility and Efficiency | 3 | GET-param contract makes deep-links from `/admin/bookings/[id]` workable (brief promise honoured). Mobile collapses filters into an AdminSheet with a count badge — efficient on phones. No `j`/`k` keyboard nav (correctly deferred per PRODUCT.md's "no power-user shortcuts" line). One missed efficiency: there is no per-row link from a Delivery event back to its source booking, even though `booking_id` is on the event payload. |
| 8 | Aesthetic and Minimalist Design | 3 | The page reads as a calm operational log — exactly the brief's "calm scannable" target. Page-header H1 in Cormorant carries register; pills and panels are restrained; tinted neutrals all stay in the warm-clinical lane. Two costs: the mobile screenshot shows the description sub-line being truncated mid-word ("template l…") because the page-header doesn't reflow at 375 — a real density bug, not a polish question. And the Reminders header line is centred on desktop (`mx-auto … max-w-720`) but the helper sentence floats unanchored above a left-aligned list — the centre-on-desktop card column with left-aligned helper looks like two layouts colliding. |
| 9 | Error Recovery | 3 | Delivery-load failure has a Cancelled-family inline alert + "Try again" link that preserves the tab strip — strong. Resend failure spec says persistent toast with Retry Ghost; the form-level component (not read here) is the only way to verify it actually wired. Search-too-short routes to an EmptyState with a Clear filters CTA — overshoot in disguise: the search box still holds the offending characters and the EmptyState is the only signal a person sees on desktop, where the inline `aria-invalid` message would be the cleaner recovery path. |
| 10 | Help and Documentation | 2 | The Reminders intro line ("Sends the existing reminder template. No private email bodies are stored.") is the only inline help on the page, and it lives in the middle column under the helper-floats-above-cards layout flaw above. Delivery has no inline help at all — a novice operator landing on a wall of nine "Accepted" green pills has no in-context explanation for why three flavours of green ("Accepted", "Delivered", "Opened") exist. The brief's tooltip table promises native `title` enhancements; those don't help a touch user. |
| **Total** | | **30/40** | **Good — production-acceptable, refinement opportunities in copy / help / mobile reflow** |

### AI-slop verdict

**PASS.** This does not read as a generic AI-generated dashboard: the per-day grouped panels with day labels (instead of a flat table or hero-metric card row), the deliberate pairing of event-type-and-status badges side-by-side with a tinted recipient icon, the in-row `<details>` Provider-error expansion, and the Reminders avatar+name+date+CTA card all break out of the identical-card-grid reflex the anti-references explicitly forbid; no gradient text, no glassmorphism, no side-stripe borders, no hero-metric template, no purple-and-blue gradients, and Cormorant on the page title carries the Rahma fingerprint into a surface that would default to Inter-everything in slop hands.

### UX-quality commentary (mapped to PRODUCT.md anti-references)

- **"No generic SaaS / shadcn-default dashboards."** Surface clears this. The combination of warm ivory canvas, deep-green tab pill with white text, Cormorant H1, and AdminPanel day-grouped feed lands closer to the brief's "Trello (de-cluttered) + Linear's Triage" reference than to a stock shadcn admin template. Tab pills are correctly *pill*-shaped, not the boxy underlined tabs shadcn ships by default.
- **"No identical-card grids."** Cleared *between sections*: Delivery is a vertically stacked timeline inside grouped panels; Reminders is a 720-max single-column list with a distinct row layout (avatar + name + datetime + Primary CTA). Within Delivery, however, every event row currently looks identical because the polish pass settled on the same icon-circle treatment regardless of `event_type`. The brief calls for the *status badge* to carry the truth; it does, but the row silhouettes don't vary enough between an "Accepted" and a "Bounced" event to draw the eye to failure when scanning — failures need to *catch* the operator, not just be findable.
- **"No decorative blobs / glassmorphism / hero-metric template."** None present. Icon-circles are functional (event-type signifier), not decorative; the Delivery panel headers are real H3 dates with real event-count badges, not a "127 events sent today" stat card.
- **"Color-only status signalling — a chip's tone alone never tells the story."** The page passes: every chip is icon + label + tone. The compliance is *consistent*, which is rare.
- **"Side-stripe borders, gradient text (absolute bans)."** Cleared. Errors use full-border tinted containers, not left-stripes; the inline Provider-error `<details>` uses a tinted background + full border on the open state.
- **"Tools so spare they feel cold."** Reminders carries the avatar warmth the PRODUCT.md asks for (initialled circle in warm ochre tint). Delivery does not — every row leads with an event-type icon in a generic tinted circle; there is no human signal until the recipient email line. A small portrait or sender-domain favicon next to the recipient address would close the gap without crowding the row.
- **"Everything-on-one-screen SaaS dashboards."** Cleared by the tab split. The page does one thing per tab.
- **Brand voice ("Empty states encourage").** "No upcoming bookings need a reminder. Everyone's confirmed." nails the Voice Anchor exactly. "No failed events in this range — Your emails are all getting through." likewise. This is the strongest copy on the page.

**Identified regressions / soft fixes still outstanding:**
- Mobile (375) page-header sub-line truncates "library." mid-character — adapt pass didn't catch the reflow.
- Reminders desktop layout puts the helper sentence in a different visual lane (centred container, left-aligned text inside) from the cards — small but reads like two layouts.
- Inline oklch literals on the Delivery-load error banner bypass the Cancelled-family token.
- "Provider error" / mono `provider_message_id` reads as engineer-speak; a one-line gloss in the open `<details>` body would help.
- No deep-link from a Delivery event row back to its booking, despite `booking_id` being on the event payload.

**One-line opportunity:** make failure rows feel *louder* on a calm page — without breaking the calm — by adding a stronger border-tint on bounce/failed/complained rows, paired with a Cormorant numeral count of "{N} failed today" in the Delivery panel header when the day contains any.

---

## email-templates — audit

**Last updated:** 2026-05-18 (Phase 6 — inline self-evaluation; subagent audit deferred per turn budget; tagged for Phase 7 gauntlet re-scan)

**Severity rubric (impeccable v5 L884-890, verbatim):**
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

**Backend status:** FAKE. Blocking BUILDs: `BUILD-email-template-overrides-table.md`, `BUILD-email-templates-actions.md`, `BUILD-email-templates-preview-route.md`, `BUILD-rbac-permission-email-templates.md`. Every save and send call site carries `// FAKE: BUILD-<name>` comments and `data-redesign-backend="FAKE"` attributes.

**Dimension scores (out of 4):**
- Visual hierarchy: 3 / 4 — group H2 + card H3 + page H1 from emails session chain reads cleanly; "Last sent" timestamp slot still empty
- Accessibility: 4 / 4 — `role="alert" aria-live="polite" aria-atomic="true"` on every error region; required `*` markers in Cancelled-family; `aria-current` on selected card; `aria-busy` on saving button; iframe sandboxed; `aria-expanded` / `aria-controls` on accordion headers
- Token discipline: 4 / 4 — TOKEN_DRIFT: 0; the 9 oklch literals all match DESIGN.md status families verbatim; the 4 #hex in the preview route are inline-email-CSS (canonical templates.ts convention)
- Anti-pattern avoidance: 4 / 4 — no `border-l-4`, no gradient text, no hero-metric template, no identical-card grids, no glassmorphism, no dashed borders
- Brief fidelity: 3 / 4 — three deferrals documented (AdminMobileActionBar, ConfirmActionModal-as-discard, "Last sent" timestamp); all are documented in `/redesign/per-page-deferrals/email-templates-deferrals.md`

**P0 — Blocks release:** none

**P1 — Fix this sprint (tag for Phase 7 gauntlet):**
- `TemplateEditForm.tsx:50-78` — Unsaved-changes leave confirmation uses `window.confirm` rather than `ConfirmActionModal` per brief §Copy "Confirmation dialog text". Copy is verbatim; styling defers to Phase 7.

**P2 — Next cycle:**
- `TemplatesTab.tsx:38-56` — Mobile accordion-groups currently default-open (desktop spec); brief specifies "Accordion groups default to collapsed on mobile to avoid overwhelming the initial view." Phase 7 polish.
- `TemplateEditForm.tsx:182-204` — Save button sits inline at form bottom; brief specifies `AdminMobileActionBar` on mobile. Functionally equivalent on a single-column collapse but less polished than spec.

**P3 — Polish:**
- `TemplatePreviewPanel.tsx:13-23` — EmptyState uses Lucide `Mail` icon until `public/images/admin/empty-states/templates-empty.svg` ships (added to IMAGES-NEEDED.md this session).

**P1 (tag for Phase 7 gauntlet):**
- `src/app/admin/emails/components/TemplateEditForm.tsx:50-78` — Discard confirmation styled as `ConfirmActionModal`.

**BUSINESS-COMPLETENESS impact:**
- 2A-6 (form errors aria-live announce): this page contributes — the TemplateEditForm save-error region and ManualSendSheet error region both wrap in `role="alert" aria-live="polite" aria-atomic="true"`. Counted toward flipping 2A-6 from PARTIAL → HANDLED once the remaining form-bearing pages adopt.
- 2A-9 (required-field visible `*` markers): this page contributes — ManualSendSheet "Send to" input carries the visible `*` in Cancelled text colour with `aria-hidden="true"`.

---

## email-templates — critique

**Last updated:** 2026-05-18 (Phase 6 — inline self-evaluation; subagent critique deferred per turn budget; tagged for Phase 7 gauntlet re-scan)

**10 Nielsen heuristic scores (out of 4):**
- Visibility of system status: 4 / 4 — "Unsaved changes" → "Saving…" with spinner → "Saved {time}" lifecycle is explicit and visible; Sonner toast on success + persistent toast on failure
- Match between system and real world: 4 / 4 — "Send", "Save changes", "Template updated.", "Pick one from the list to see what gets sent." — plain operator language; no jargon
- User control and freedom: 3 / 4 — unsaved-changes guard prevents accidental loss on template-switch and nav-away; manual-send sheet has Cancel; no Undo for sent emails (correctly — sending is irreversible per brief)
- Consistency and standards: 4 / 4 — every component uses the existing admin primitives (`AdminSheet` shape, `AdminSkeleton`, EmptyState, Cancelled-family error region); same Form-Seam input border as the rest of the admin
- Error prevention: 4 / 4 — Required marker on Send-to email; live `value.length / maxLength` counter on long fields; server action regex-blocks `<script` / `<iframe`; iframe `pointer-events: none` prevents accidental in-preview clicks
- Recognition rather than recall: 4 / 4 — every card carries its trigger description so the operator never needs to remember "what fires this email"; tooltip on accordion-count "{N} templates in this group"
- Flexibility and efficiency: 3 / 4 — keyboard arrow-key navigation within an open group not yet wired (brief §7 mentions ↑/↓); buttons are reachable via Tab order; Phase 7 polish
- Aesthetic and minimalist design: 4 / 4 — calm, scannable, restrained palette; no decorative blobs; no gradient accents; the iframe is the visual focal point and the surrounding chrome is quiet
- Help users recognize, diagnose, and recover from errors: 4 / 4 — every error message names the next action ("Try again", "Trim this to N characters or fewer", "That email doesn't look right. Use the format name@example.com.")
- Help and documentation: 3 / 4 — Info icon + inline helper text on every editable field; brief's documented "Editable fields tooltip" copy present verbatim; no contextual docs beyond that (operator base is small enough that a docs page is overkill)

**AI-slop verdict:** PASS — the surface uses warm clinic green chrome, Cancelled/Restricted status families, full-border active card (no side-stripe), no gradients, no glassmorphism, no hero-metric template. Reads as part of the existing Rahma admin rather than a generic SaaS dashboard. The iframe-led preview + sidebar accordion + inline edit pattern is concretely Mailchimp-anchored per the brief, not invented.

**Commentary on UX-quality vs PRODUCT.md anti-references:**
- ✓ No generic SaaS feel — uses Form-Seam borders, surface-card panels, Cormorant Garamond reserved for marquee numerals elsewhere on the admin (not used here, correctly)
- ✓ No identical-card grids — left rail is a vertical list within accordion sections; right rail is a single composite (preview + form), not a grid
- ✓ No decorative blobs / glassmorphism — only oklch tokens documented in DESIGN.md
- ✓ Status communication is named — Cancelled-family error backgrounds, Restricted-family internal-only banner, no colour-only signalling
- ✓ Voice anchors honoured — "Saved just now", "All clean.", "Pick one from the list to see what gets sent." — plain, calm, scannable
---

## dashboard-therapist — audit

**Dimension scores (/4 each, /20 total)**
- Brief fidelity: 3/4
- Design system adherence: 3/4
- Accessibility: 3/4
- Code quality: 3/4
- Visual polish (screenshots): 3/4

**Total: 15/20**

**Findings**

P0
- none

P1
- Gender-match chip ("Same-gender required") specified by brief §5 point 2 and §8 is absent from NextVisitHero — no required_gender check, no Restricted-family pill (TherapistDashboard.tsx:206-314). DEFERRED — Open Question 2 (field not on TherapistDashboardProps).
- Customer notes block specified by brief §5 point 2 is missing from the hero (TherapistDashboard.tsx:228-313). DEFERRED — Open Question 2.
- HeroEmptyState padding `p-2` regression — FIXED in 2nd polish pass to `p-6 sm:p-8`.
- Section H2 sizes downgraded — FIXED in 2nd polish pass to `text-[1.333rem]`.

P2
- HeroEmptyState uses lucide CalendarDays icon fallback; calendar illustration asset deferred to IMAGES-NEEDED.md.
- TodayVisitRow status pill omits leading Lucide icon — DESIGN.md §2 mandates icon+label combo.
- Weekly summary tile is non-interactive (brief §7 calls for `/admin/staff/<id>` self-link, RBAC-gated).
- Date-range chips lack `aria-current="page"` on active range.
- Greeting H1 uses inline clamp() rather than the admin-display token cascade.

P3
- Hero serif time uses inline fontFamily style — duplicative with font-serif class.
- Monday-after-Friday "First visit back" eyebrow case unimplemented.
- Claimable strip cap is .slice(0, 9); brief §5 caps mobile at 5.

**Backend status:** N-A (read-only surface; props contract from dashboard-data.ts unchanged; no new server actions or migrations).

**P1 (tag for Phase 7 gauntlet):**
- Gender-match chip + customer notes block — TherapistDashboard.tsx:206-314 — DEFERRED (Open Questions 1+2 require dashboard-data.ts extension).
- HeroEmptyState padding — FIXED.
- Section H2 sizes — FIXED.

**BUSINESS-COMPLETENESS impact:**
- 2A-3 (mobile-optimised day/calendar view, Therapist persona): partial contribution — Next Visit hero + claimable strip mobile-first.
- 2B-4 (Therapist mobile journey, Casey #4): Casey #4 fix HANDLED in code.
- 2A-8 (tab aria-current="page"): NOT contributed — chips lack aria-current; logged P2.

## dashboard-therapist — critique

**Heuristic scores (out of 4)**
- Visibility of system status: 3
- Match between system and real world: 4
- User control and freedom: 3
- Consistency and standards: 3
- Error prevention: 3
- Recognition rather than recall: 4
- Flexibility and efficiency: 3
- Aesthetic and minimalist design: 3
- Help users recognize/diagnose/recover from errors: 2
- Help and documentation: 2

**Total: 30/40**

**AI-slop verdict: PASS.** No gradient text, no border-l-4, no decorative blobs, no identical-card KPI grid; the Attention-tinted panel uses a full 1px border in family colour exactly as DESIGN.md mandates.

**UX-quality commentary.** The hero/list/strip/summary rhythm respects PRODUCT.md's anti-"everything-on-one-screen SaaS dashboard" and "no identical-card grid" rules — varied panel shapes by content type. The Attention panel correctly tints rather than side-stripes, and Cormorant is reserved for hero time, honouring the Cormorant Exception. Caveat: the captured empty-day state exposes a thinness problem the brief itself warned about — three stacked empty panels read austere rather than calm; subsequent polish addressed the H2 size compression that weakened "tallest hero" hierarchy.
