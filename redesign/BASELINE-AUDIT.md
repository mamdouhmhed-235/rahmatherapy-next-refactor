# Baseline Technical Audit — Rahma Admin

**Date:** 2026-05-11  
**Phase:** Phase 2 — Visual Baseline  
**Method:** Dual pass — static code analysis agent (src/app/admin/**) + targeted grep scans across 5 dimensions.  
**Target:** All 24 admin routes under `src/app/admin/`.  
**Purpose:** Pre-redesign baseline. Documents what Phase 6/7 must fix. Nothing was changed.

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 2/4 | Zero `role="alert"` on any admin form; H1→H3 skips on 4 pages; location filter input has no accessible name |
| 2 | Performance | 3/4 | Scroll listener without debounce in AdminTopNav; backdrop-blur on 5 elements; otherwise lean (no layout animations, no will-change, next/image throughout) |
| 3 | Theming | 2/4 | 24 hard-coded hex values; 11 raw `bg-gray-*`/`text-gray-*` utilities; 41 raw red/orange utilities; `bg-white` used instead of `var(--admin-panel)` in 10+ files; no dark mode |
| 4 | Responsive Design | 3/4 | AdminTopNav has correct sm/md/lg breakpoints; form footers have sm:static; notification popover fixed at 26rem overflows < 375px; buttons at min-h-9 (36px) miss 44px touch target |
| 5 | Anti-Patterns | 2/4 | 3 confirmed `border-l-4` side-stripe violations (absolute ban); `backdrop-blur-sm` on 2 dialog backdrops; `bg-black` pure-black in attention group |
| **Total** | | **12/20** | **Acceptable — significant work needed across a11y and theming** |

---

## Anti-Patterns Verdict

**Partially FAIL.** Three confirmed `border-l-4` side-stripe violations are absolute bans. Two `backdrop-blur-sm` dialog backdrops are borderline glassmorphism (functional separation, not decorative glass cards — arguable). `bg-black` pure-black violates the tinted-neutral law. No gradient text, no `animate-bounce`, no nested cards. The absolute-ban violations are all co-located in the attention/notification UI, which limits blast radius, but they are the most-viewed surfaces on the dashboard.

---

## Executive Summary

- **Audit Health Score: 12/20 (Acceptable)**
- **P0: 2** (WCAG A/AA blockers — Phase 7 must clear both before ship)
- **P1: 14** (major issues — address in Phase 6)
- **P2: 9** (minor issues — next pass)
- **P3: 4** (polish — if time permits)
- **Top blockers:** (1) All admin form errors lack `role="alert"` — screen reader users cannot detect validation failures. (2) `/admin/clients` location filter has no accessible name — screen reader users cannot identify the field.

---

## Detailed Findings by Severity

---

### P0 — Blocking (WCAG A/AA failures)

**[P0-A1] Form error regions missing `role="alert"` on all admin forms**
- **Location:** `ManualBookingForm.tsx`, `SettingsForm.tsx`, `StaffProfileForm.tsx`, `ClientCreateForm.tsx`, `EnquiryForm.tsx`, `LoginForm.tsx`, and all other admin forms — no `role="alert" aria-live="polite"` wrapper found anywhere in `src/app/admin/`
- **Category:** Accessibility
- **Impact:** When a form submission returns errors, assistive technology announces nothing. Screen reader users (Sam) and any user relying on AT cannot know an error occurred or what it says. They must re-explore the page to discover the error manually.
- **WCAG:** 4.1.3 Status Messages (AA), 1.3.1 Info and Relationships (A)
- **Recommendation:** Wrap all form-level error `<div>`s in `<div role="alert" aria-live="polite" aria-atomic="true">`. One shared pattern applied to every admin form in Phase 6.
- **Suggested command:** `/impeccable harden admin forms`

**[P0-A2] Location filter input on `/admin/clients` has no accessible name**
- **Location:** `src/app/admin/clients/page.tsx` — `<Input name="location" placeholder="Postcode or city" />` — no `<label>`, no `aria-label`, no `aria-labelledby`
- **Category:** Accessibility
- **Impact:** Screen reader announces the field as just "input" with no name. Keyboard-only users with AT cannot identify or purposefully navigate to this field. The field is functionally invisible to assistive technology.
- **WCAG:** 1.3.1 Info and Relationships (A), 4.1.2 Name, Role, Value (A)
- **Recommendation:** Add `aria-label="Location (postcode or city)"` to the Input, or wrap in a visible `<label className="sr-only">`.
- **Suggested command:** `/impeccable harden admin forms`

---

### P1 — Major (significant difficulty, WCAG AA violations, or absolute-ban violations)

**[P1-A3] H1→H3 heading hierarchy skips on 4 admin pages**
- **Location:** `/admin/staff`, `/admin/settings`, `/admin/availability`, `/admin/staff/[id]` — shadcn `CardTitle` renders as `<h3>` while the page `<h1>` is the only preceding heading
- **Category:** Accessibility
- **Impact:** Screen reader users navigating by heading (common pattern for sighted-keyboard and AT users) encounter an unexplained H3 that cannot be reached from H2 via heading nav. WCAG 2.4.6 requires headings be used correctly.
- **WCAG:** 2.4.6 Headings and Labels (AA)
- **Recommendation:** Either set `asChild` on CardTitle with an explicit `<h2>`, or replace CardTitle with a semantic `<h2>` class in the affected pages.
- **Suggested command:** `/impeccable harden admin a11y`

**[P1-A4] Required fields carry no visual indicator on any admin form**
- **Location:** All admin forms — `required` attribute present on `<input>` elements but no asterisk, bold label, or color hint
- **Category:** Accessibility
- **Impact:** Novice users (Fatimah — target persona per PRODUCT.md) submit forms without knowing which fields are required. Error recovery requires trial and error. WCAG 3.3.2 requires labels or instructions for required fields.
- **WCAG:** 3.3.2 Labels or Instructions (AA)
- **Recommendation:** Add `<span aria-hidden="true" className="text-[var(--admin-danger)] ml-0.5">*</span>` to required `<label>` elements. Establish as a shared pattern.
- **Suggested command:** `/impeccable harden admin forms`

**[P1-A5] Status-tone classes use raw Tailwind gray without text label**
- **Location:** `src/app/admin/components/admin-ui.tsx:21` — `statusToneClasses.muted = "bg-gray-100 text-gray-600"`
- **Category:** Accessibility
- **Impact:** The "muted" tone conveys status through color only. No text label is guaranteed to accompany it. Fails WCAG 1.4.1 (Use of Color).
- **WCAG:** 1.4.1 Use of Color (A)
- **Recommendation:** Replace with `bg-[var(--admin-canvas)] text-[var(--admin-text-muted)]`. Always pair with a text label in callsites.
- **Suggested command:** `/impeccable harden admin a11y`

**[P1-AP1] Three `border-l-4` side-stripe accent borders (ABSOLUTE BAN)**
- **Location:**
  - `src/app/admin/components/notification-bell.tsx:403` — notification item severity stripe
  - `src/app/admin/dashboard/dashboard-cards.tsx:128` — attention item card full left border
  - `src/app/admin/dashboard/dashboard-cards.tsx:417-419` — severity-conditional left border on operational events
- **Category:** Anti-Pattern
- **Impact:** Thick colored left-border accent is the most recognisable AI-generated UI tell. All three appear on the highest-traffic surface (dashboard). Confirmed absolute ban per impeccable design laws.
- **Recommendation:** Rewrite each element. Options: (a) full-border card with background tint matching severity token; (b) leading severity icon or colored dot; (c) badge/chip in the card header. No left stripe.
- **Suggested command:** `/impeccable bolder dashboard`

**[P1-AP2] `backdrop-blur-sm` on two dialog backdrops**
- **Location:**
  - `src/app/admin/components/admin-ui-interactions.tsx:78` — AdminSheet/Dialog backdrop
  - `src/app/admin/components/AdminCommandSearch.tsx:69` — command palette backdrop
- **Category:** Anti-Pattern
- **Impact:** `backdrop-blur-sm` on modal overlays creates the glassmorphism visual style (blurred content visible behind the modal). The impeccable skill bans glassmorphism "as default" — use is borderline here since it provides functional overlay separation, but on these two surfaces it is purely decorative (the content behind is not meant to be read through).
- **Recommendation:** Replace `backdrop-blur-sm` with a solid semi-transparent overlay: `bg-slate-950/40` without blur. The `backdrop-blur` on sticky form footers (ManualBookingForm, ClientCreateForm) is functional and acceptable — leave those.
- **Suggested command:** `/impeccable bolder admin modals`

**[P1-AP3] `bg-black` pure black in dashboard attention group**
- **Location:** `src/app/admin/dashboard/attention-group-client.tsx:144`
- **Category:** Anti-Pattern + Theming
- **Impact:** Pure `#000000` reads harsh against the warm ivory admin palette. Violates the tinted-neutral law.
- **Recommendation:** Replace with `bg-[var(--admin-heading)]` (already token-defined as `#151b18`) or `bg-[oklch(12%_0.01_165)]`.
- **Suggested command:** `/impeccable colorize admin`

**[P1-T1] Panel tone border classes use raw Tailwind palette**
- **Location:** `src/app/admin/components/admin-ui.tsx:34-39` — `border-orange-200`, `border-red-200`, `border-emerald-200`, `border-sky-200`, `border-violet-200`
- **Category:** Theming
- **Impact:** These panel tone borders bypass the token system. If tokens are updated (e.g., `--admin-warning` changes), these panels won't update. 41 raw red/orange utility uses found across admin.
- **Recommendation:** Replace with `border-[var(--admin-warning)]`, `border-[var(--admin-danger)]`, `border-[var(--admin-success)]` etc.
- **Suggested command:** `/impeccable colorize admin`

**[P1-T2] 10+ `bg-white` instances should use `var(--admin-panel)`**
- **Location:** `availability/AvailabilityOverridesManager.tsx`, `availability/AvailabilityRulesManager.tsx`, `availability/BlockedDatesManager.tsx`, `availability/page.tsx`, `bookings/AssignmentManager.tsx`, `bookings/BookingManagementForm.tsx`, `bookings/new/ManualBookingForm.tsx` and others
- **Category:** Theming
- **Impact:** `bg-white` is pure white (#ffffff). The admin design token `--admin-panel` is `#fffefa` (warm ivory-tinted). Using `bg-white` breaks the warm palette consistency — panels appear cooler against the ivory canvas.
- **Recommendation:** Global find-and-replace `bg-white` → `bg-[var(--admin-panel)]` in admin source, excluding cases where white is intentionally distinct (e.g., contrast against a dark background).
- **Suggested command:** `/impeccable colorize admin`

**[P1-P1] Scroll event listener without debounce in AdminTopNav**
- **Location:** `src/app/admin/components/AdminTopNav.tsx:196-212`
- **Category:** Performance
- **Impact:** Scroll listener fires on every scroll event and calls `setState`, triggering re-renders of the top nav on every scroll tick. On mobile, this can visibly degrade scroll performance (jank).
- **Recommendation:** Wrap the scroll handler in a `requestAnimationFrame` throttle or lodash `debounce(16)`.
- **Suggested command:** `/impeccable optimize admin nav`

**[P1-P2] localStorage hydration waterfall in notification-bell**
- **Location:** `src/app/admin/components/notification-bell.tsx:71-79` — `useEffect` with localStorage read + `setState` with eslint comment suppressing the warning
- **Category:** Performance
- **Impact:** Causes a render waterfall during hydration: server renders one state, client re-renders after localStorage read. The eslint suppress comment indicates this is a known issue that was not resolved.
- **Recommendation:** Use `useLayoutEffect` with `typeof window !== 'undefined'` guard for localStorage reads that must be synchronous to avoid layout shift, or initialise state with a function that reads localStorage directly.
- **Suggested command:** `/impeccable optimize admin`

---

### P2 — Minor (annoyance, workaround exists)

**[P2-A6] `tabIndex={-1}` on main element may disrupt focus management**
- **Location:** `src/app/admin/components/AdminTopNav.tsx:278` — `<main id="admin-main" tabIndex={-1}>`
- **Category:** Accessibility
- **Impact:** `tabIndex={-1}` allows the skip link to programmatically focus `#admin-main`, which is correct. However it also means the element appears in the accessibility tree as focusable-via-script, which may confuse some AT users who encounter focus on a non-interactive element.
- **Recommendation:** This is a valid pattern for skip-link targets. No change needed unless AT testing reveals issues. Monitor during Phase 7 a11y testing.
- **Suggested command:** N/A (monitor)

**[P2-A7] `AdminProgressBar` missing descriptive `aria-label`**
- **Location:** `src/app/admin/components/admin-ui.tsx:391-402`
- **Category:** Accessibility
- **Impact:** `aria-valuenow` is set but if the surrounding context doesn't provide a clear label, screen readers may announce just a number without meaning.
- **Recommendation:** Ensure all `AdminProgressBar` callsites pass a descriptive `aria-label` prop that includes context (e.g., "Profile completion: 75%").
- **Suggested command:** `/impeccable harden admin a11y`

**[P2-T3] 11 raw `bg-gray-*` / `text-gray-*` utilities in admin components**
- **Location:** `admin-ui.tsx` (most), and scattered across 10 other admin component files
- **Category:** Theming
- **Impact:** Raw Tailwind gray utilities don't respond to token updates and create visual inconsistency against the warm admin palette. Confirmed 11 occurrences.
- **Recommendation:** Replace with admin tokens: `bg-[var(--admin-canvas)]`, `text-[var(--admin-text-muted)]`, `border-[var(--admin-border)]`.
- **Suggested command:** `/impeccable colorize admin`

**[P2-T4] 24 hard-coded hex values in admin source files**
- **Location:** Primarily `src/app/admin/dashboard/dashboard-cards.tsx` (avatar tint array: `#e8d5e0`, `#d5e0e8`, etc.)
- **Category:** Theming
- **Impact:** Hard-coded hex values escape the token system. Avatar colors won't update if the palette changes.
- **Recommendation:** Replace avatar tint array with a deterministic color-cycle utility using brand-adjacent hues expressed as CSS variables or OKLCH literals.
- **Suggested command:** `/impeccable colorize admin`

**[P2-T5] `TherapistDashboard.tsx` gradient not in token system**
- **Location:** `src/app/admin/dashboard/TherapistDashboard.tsx:90` — `bg-gradient-to-br from-[var(--admin-primary)]/5 via-[var(--admin-panel)] to-[var(--admin-panel)]`
- **Category:** Theming
- **Impact:** This gradient uses token values but isn't defined as a named gradient token. If it's intentional (subtle tint on therapist dashboard header), it should be extracted to a utility class or token. If unintentional, remove it.
- **Recommendation:** Either add a `.admin-therapist-header` class in tokens.css or remove the gradient and use a plain `bg-[var(--admin-panel)]`.
- **Suggested command:** `/impeccable colorize admin`

**[P2-R1] Notification popover fixed at `26rem` overflows on < 375px viewports**
- **Location:** `src/app/admin/components/notification-bell.tsx:220` (popover panel width)
- **Category:** Responsive Design
- **Impact:** At 375px viewport, `26rem` (416px) overflows horizontally. Therapists on phones (primary mobile use case) will see a clipped or overflowing notification panel.
- **Recommendation:** Use `w-[min(26rem,calc(100vw-2rem))]` to cap at viewport width on small screens.
- **Suggested command:** `/impeccable adapt admin`

**[P2-R2] Button touch targets at `min-h-9` (36px) miss 44px WCAG minimum**
- **Location:** `src/app/admin/dashboard/dashboard-cards.tsx:164,176` — CTA buttons at `min-h-9`
- **Category:** Responsive Design
- **Impact:** WCAG 2.5.5 (AA) requires touch targets of at least 44×44px. `min-h-9` = 36px. On mobile, these buttons are too small for reliable thumb activation.
- **Recommendation:** Change to `min-h-11` (44px) for primary interactive buttons on mobile. Or add `sm:min-h-9` to reduce only on desktop.
- **WCAG:** 2.5.5 Target Size (AA)
- **Suggested command:** `/impeccable adapt admin`

**[P2-P1] `backdrop-blur` on sticky form footer bars (functional but potentially expensive)**
- **Location:**
  - `src/app/admin/bookings/new/ManualBookingForm.tsx:305`
  - `src/app/admin/clients/new/ClientCreateForm.tsx:87`
  - `src/app/admin/components/admin-ui.tsx:680` (AdminMobileActionBar)
- **Category:** Performance / Anti-Pattern
- **Impact:** `backdrop-blur` on sticky elements is more expensive than on modal overlays because the blur must re-compute on every scroll frame. On mobile devices with weaker GPUs this can cause jank during form scroll. These use cases have `sm:static` so they only blur on mobile — exactly where performance is most constrained.
- **Note:** These are functionally motivated (creating visual separation between the sticky footer and scrolling content behind it), so they are not a glassmorphism ban violation. The concern is performance cost on mobile.
- **Recommendation:** Test on a mid-range Android device. If jank is observed, replace `backdrop-blur` with a solid `bg-[var(--rahma-ivory)]` (fully opaque) on mobile.
- **Suggested command:** `/impeccable optimize admin`

**[P2-P2] Multiple `useEffect` in AdminCommandSearch without memoization**
- **Location:** `src/app/admin/components/AdminCommandSearch.tsx:23-35`
- **Category:** Performance
- **Impact:** Multiple `useEffect` hooks managing search state without `useCallback`/`useMemo` on handlers cause unnecessary re-renders on every prop change cycle.
- **Recommendation:** Wrap search handlers in `useCallback`; memoize filtered results with `useMemo`.
- **Suggested command:** `/impeccable optimize admin`

---

### P3 — Polish (no real user impact)

**[P3-T6] No dark mode support anywhere in admin**
- **Location:** All admin files — zero `dark:` variants found
- **Category:** Theming
- **Impact:** If a user's OS is set to dark mode, the admin renders in light mode (intentional — single-mode design). No visual breakage, but the admin does not respect OS preference. PRODUCT.md does not mandate dark mode.
- **Recommendation:** Accepted design decision (single-mode). Document in tokens.css that dark mode is out of scope. No action required for Phase 6.

**[P3-A8] `text-[11px]` badge counter below standard body text minimum**
- **Location:** `src/app/admin/components/notification-bell.tsx:164,220` — badge counter rendered at 11px
- **Category:** Accessibility
- **Impact:** The badge counter is `aria-hidden="true"` (decorative only — the accessible count is announced via `aria-label` on the button). As a visual-only element, 11px is acceptable but at the edge of readability.
- **Recommendation:** No action required unless Phase 7 a11y testing shows contrast issues at this size.

**[P3-T7] `text-white` on notification badge counter**
- **Location:** `src/app/admin/components/notification-bell.tsx:164,220` — `text-white` on `bg-[var(--admin-danger)]` background
- **Category:** Theming / Accessibility
- **Impact:** `#ffffff` is pure white (banned by impeccable color law). However, on `--admin-danger` (#dc2626 or similar), pure white passes 4.5:1 contrast. Technically a color law violation but no user impact.
- **Recommendation:** Replace `text-white` with `text-[oklch(99%_0.005_165)]` (near-white with brand hue tint).

**[P3-P3] `backdrop-blur-sm` on mobile nav sheet backdrop**
- **Location:** `src/app/admin/components/AdminTopNav.tsx:459` — `backdrop-blur-sm` on the mobile nav drawer overlay
- **Category:** Performance
- **Impact:** Minor — only renders on mobile at `lg:hidden`. The blur adds visual depth to the off-canvas nav. Performance cost is minimal for a one-time slide-in.
- **Recommendation:** Low priority. Accept or replace with solid overlay in Phase 6 when touching the nav.

**[P3-A9] `text-xs` eyebrow labels with no sm: breakpoint**
- **Location:** `src/app/admin/components/admin-ui.tsx:110` — eyebrow text at `text-xs tracking-wide`
- **Category:** Accessibility / Responsive
- **Impact:** At 375px, `text-xs` (12px) is at the minimum readable size. No WCAG violation (WCAG minimum is 18px for large text requirements; 12px body text is allowed at AA). Minor readability concern.
- **Recommendation:** Consider `text-[0.6875rem]` with `sm:text-xs` if eyebrow labels feel cramped on mobile during Phase 7 testing.

---

## Patterns and Systemic Issues

**1. Token discipline has a two-tier problem:** The `--admin-*` token system has strong adoption (603 usages), but two escape hatches are in common use: (a) raw Tailwind color utilities (`bg-gray-*`, `border-orange-*` etc.) in 52 instances across 11+ files — these should all be token values; (b) `bg-white` used where `bg-[var(--admin-panel)]` is correct in 10+ component files. A pre-Phase-6 token audit and find-replace pass would eliminate both classes of issue in one sweep.

**2. All admin forms share the same a11y gaps:** Zero `role="alert"`, no required-field markers, and no inline validation — these are not one-off oversights, they are a systematic gap in the form-authoring pattern. A single shared `AdminFormError` wrapper component and a `FormFieldLabel` helper component that auto-applies the required asterisk would fix all instances in one pass rather than hunting each form individually.

**3. The side-stripe pattern is co-located:** All three `border-l-4` violations are in the attention/notification feature area (`dashboard-cards.tsx` and `notification-bell.tsx`). This is a single feature rewrite, not 24 scattered fixes.

**4. Mobile performance risks are specific:** `backdrop-blur` appears in 5 locations, all with legitimate functional purposes. The scroll listener debounce gap in AdminTopNav is the highest-risk item. Neither is systemic across the codebase.

---

## Positive Findings

- **Skip link implemented correctly** — `AdminTopNav.tsx:217-220` has `<a href="#admin-main">Skip to admin content</a>` with proper `sr-only` styling and `focus-visible` unhide. `id="admin-main"` with `tabIndex={-1}` on the main element correctly allows programmatic focus from the skip link.
- **`aria-hidden` on decorative icons** — 21 confirmed `aria-hidden="true"` uses across admin components. Icons are not polluting the accessibility tree with meaningless names.
- **Focus ring token applied globally** — `--focus-ring-token` and `focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35` pattern is consistent across all interactive elements. No suppressed focus rings found.
- **No layout-property animations** — Zero Framer Motion `layout` / `layoutId` uses in admin. No `width`, `height`, `top`, `left` animated via CSS transitions. Animation performance is not a concern.
- **No `will-change` overuse** — Zero `will-change` declarations found. No pre-emptive GPU layer promotion waste.
- **`next/image` used throughout** — Zero plain `<img>` tags found in admin source. All images use Next.js Image component with lazy loading by default.
- **TanStack Query not used in admin** — Admin is Server Components with direct Supabase calls. No client-side query waterfalls, staleTime gaps, or missing gcTime configurations to worry about.
- **No `useLayoutEffect`** — Zero unsafe `useLayoutEffect` calls outside of known safe contexts.
- **No gradient text anywhere** — Zero `bg-clip-text text-transparent` combinations found. The gradient text absolute ban is not violated.
- **No `animate-bounce`** — Zero Tailwind bounce animations. The "bounced" text found is email delivery copy, not an animation class.
- **AdminTopNav responsive** — Correct sm/md/lg breakpoints; mobile drawer uses `w-[min(20rem,calc(100vw-2rem))]` capping at viewport width; form footers have `sm:static` to remove sticky behaviour on desktop.
- **Sentry wired on client/server/edge** — Error monitoring covers all runtime environments. No silent failures.

---

## Recommended Actions (Priority Order)

1. **[P0] `/impeccable harden admin forms`** — Add `role="alert" aria-live="polite"` to all form error regions; add required-field visual markers; fix `/admin/clients` location filter with `aria-label`.
2. **[P1] `/impeccable harden admin a11y`** — Fix H1→H3 heading skips on staff/settings/availability/staff-detail pages; audit AdminProgressBar aria-label callsites; fix status-tone muted class color-only dependency.
3. **[P1] `/impeccable bolder dashboard`** — Rewrite all 3 `border-l-4` side-stripe violations on attention cards and notification items to use full-border + background-tint or leading icon patterns.
4. **[P1] `/impeccable colorize admin`** — Replace `bg-black` with token value; replace `bg-white` with `var(--admin-panel)`; replace panel tone border classes with token values; replace raw gray utilities.
5. **[P1] `/impeccable optimize admin`** — Debounce AdminTopNav scroll listener; resolve notification-bell localStorage hydration waterfall.
6. **[P2] `/impeccable adapt admin`** — Fix notification popover width to `min(26rem, 100vw - 2rem)`; increase CTA button touch targets to `min-h-11` on mobile.
7. **[P1] Remove `backdrop-blur-sm` from dialog backdrops** — `admin-ui-interactions.tsx:78` and `AdminCommandSearch.tsx:69`; keep functional sticky-footer blurs.
8. **[P3] `/impeccable polish admin`** — Final pass: `text-white` → near-white token; `text-xs` eyebrow breakpoints; TherapistDashboard gradient extraction.
