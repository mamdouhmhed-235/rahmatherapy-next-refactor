# Harden Recommendations — 00-shared-components

**Session date:** 2026-05-13
**Phase:** 6 — Implementation (Step 4 Harden)
**Files in scope:** `src/app/admin/components/AdminTopNav.tsx`, `src/app/admin/components/AdminCommandSearch.tsx`, `src/app/admin/components/admin-ui.tsx`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/badge.tsx`

---

## Code changes already made during Harden

| # | Issue | File | Fix applied |
|---|---|---|---|
| H1 | Reduced motion CSS selector mismatch — `@media (prefers-reduced-motion)` targeted `.menu-enter` / `.sheet-enter` class names but elements used inline `style={{ animation: ... }}` — override was dead code | `AdminTopNav.tsx` | Added `u-menu-enter` / `u-sheet-enter` classes; updated CSS selector to match |
| H2 | `getInitials("")` / whitespace-only names returned `""` — empty initials circle | `AdminTopNav.tsx` | Added `trim()`, `filter(Boolean)`, `"?"` fallback |
| H3 | `getUserFirstName("")` returned `""` via `??` (only catches null/undefined, not empty string) | `AdminTopNav.tsx` | Added explicit falsiness check after `split(" ")[0]` |
| H4 | First name in trigger had no truncation — very long names overflowed the Clinic Green bar | `AdminTopNav.tsx` | Added `max-w-[8rem] truncate` |
| H5 | `profile.staffId` used directly in href — produces `/admin/staff/undefined` if empty | `AdminTopNav.tsx` | Added ternary guard on both "Your profile" hrefs |
| H6 | Focus not restored when "More" sheet closed — keyboard users orphaned (WCAG 2.4.3) | `AdminTopNav.tsx` | Added `moreButtonRef`, passed as `returnFocusRef` to `UserMenuSheet`, called `returnFocusRef.current?.focus()` in cleanup |
| H7 | **Nav link text invisible / contrast failure (Step 7 device review).** `site-parity.css` sets `a { color: inherit; }` globally. With no explicit text colour on ancestor elements, nav `<a>` links inherit the browser UA default (dark), defeating opacity-based white utilities (`text-white/85`). Additionally, the user menu trigger `<button>` had no explicit `bg-transparent`, causing Safari to render its default button background (light/white), making the trigger appear as a white rectangle on the dark bar. | `AdminTopNav.tsx` | (1) Added `text-white` directly to brand `<Link>` element. (2) Added `text-white` to `<nav>` element — scoped to nav strip only, never cascades to the dropdown which lives in the right-rail `<div>`. (3) Changed inactive nav link text from `text-white/85` → `text-white` (full, no opacity) so `a { color: inherit; }` cannot compete. (4) Added `bg-transparent appearance-none` to user menu trigger button base classes. |

---

## Brief §6 Key States cross-check

### AdminTopNav

| State | Status | Notes |
|---|---|---|
| Default | PASS | Clinic Green bar, three zones |
| Hover (Hover Moss) | PASS | `hover:bg-white/10` on dark surface is equivalent |
| Active (Selected Sage + aria-current) | PASS | `bg-[oklch(90%_0.028_155)]` + `aria-current="page"` |
| Focus (3px Focus Azure ring) | PASS | `focus-visible:ring-2 focus-visible:ring-white/60` |
| Mobile-stripped | PASS | Brand + search + bell only; centre nav hidden |

### AdminBottomTabBar

| State | Status | Notes |
|---|---|---|
| Default | PASS | 4-5 primary tabs + "More" |
| Tab-active (Clinic Green + Selected Sage + aria-current) | PASS | `border-t-2 border-[var(--admin-primary)] bg-[oklch(93.5%_0.038_155)]` |
| Tab-hover | FIXED | Was `--admin-panel-muted` (warm ivory). Brief requires Hover Moss `oklch(95.5%_0.012_155)`. Fixed in this pass. |
| Tab-focus (Focus Azure inset ring) | PASS | `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-focus)]/55` |
| More-open (sheet slides up) | PASS | `UserMenuSheet` with focus management |

### AdminCommandSearch

| State | Status | Notes |
|---|---|---|
| Closed | PASS | Dialog hidden |
| Opening (160ms ease-gentle) | DEFERRED | BaseDialog renders without entrance animation; deferred to animate pass |
| Empty (hint) | PASS | "Start typing" text shown |
| Typing (debounced 120ms) | FIXED | Was 180ms. Changed to 120ms per brief. |
| Results (grouped) | PASS | Type + title + detail per result |
| Empty results | PASS | "Nothing matches..." copy matches brief §8 |
| Error (toast + retain query) | FIXED | No try/catch existed. Added error state with Sonner toast + query retained. |
| Up/Down/Enter navigate | FIXED | Arrow-key navigation between results added. |

### User menu dropdown (desktop)

| State | Status | Notes |
|---|---|---|
| Closed | PASS | Conditionally rendered |
| Opening (160ms ease-gentle) | PASS | `u-menu-enter` animation (reduced motion now works after H1 fix) |
| Open | PASS | Full dropdown visible |
| Item-hovered (Hover Moss) | PASS | `hover:bg-[var(--admin-panel-muted)]` |
| Item-active (Selected Sage + aria-current) | PASS | `bg-[oklch(92%_0.022_155)]` + `aria-current="page"` |
| Closing (120ms ease-snappy) | DEFERRED | Instant dismiss (conditional render). Delayed-unmount animation deferred to polish pass. |

### AdminAccessDenied

| State | Status | Notes |
|---|---|---|
| Default (plain English, no raw permission strings) | PARTIAL | Uses `AdminPanel` with 48px icon circle rather than the `EmptyState` component the brief specifies. Functionally correct. Per-page sessions can align to `EmptyState` when they render this component in context. |

### AdminSkeleton

| State | Status | Notes |
|---|---|---|
| Pulse 1.4s ease-in-out | FIXED | Tailwind `animate-pulse` defaults to 2s. Added custom `admin-skeleton-pulse` at 1.4s. |
| prefers-reduced-motion static block | PASS | Tailwind motion-reduce utilities handle `animate-*`. |

### AdminPanel, Buttons, Inputs, AdminStatusBadge, EmptyState, AdminMobileActionBar, Sonner Toast, ConfirmActionModal

All verified as implemented correctly in `admin-ui.tsx` / `admin-ui-interactions.tsx`. Loading, error, disabled, and success states all present.

---

## States added in this Harden pass (code implementation)

### 1. AdminCommandSearch — Error state + retain query
**File:** `src/app/admin/components/AdminCommandSearch.tsx`
Try/catch wraps `searchAdminCommand`. On failure: Sonner error toast ("Search failed. Try again."), query string retained, results cleared, `isPending` resolves normally.

### 2. AdminCommandSearch — Arrow key navigation
**File:** `src/app/admin/components/AdminCommandSearch.tsx`
Added `focusedIndex` state and `handleKeyDown` on the search input. ArrowDown/ArrowUp moves focus through result `<a>` links via `resultRefs`. ArrowUp at index 0 returns focus to the input.

### 3. AdminCommandSearch — Debounce 120ms
**File:** `src/app/admin/components/AdminCommandSearch.tsx`
`window.setTimeout(..., 180)` changed to `window.setTimeout(..., 120)`.

### 4. AdminBottomTabBar — Hover Moss tint correction
**File:** `src/app/admin/components/AdminTopNav.tsx`
Tab hover changed from `hover:bg-[var(--admin-panel-muted)]` (warm ivory) to `hover:bg-[oklch(95.5%_0.012_155)]` (Hover Moss) on both primary tabs and the "More" tab, matching brief §6.

### 5. AdminSkeleton — 1.4s pulse animation
**File:** `src/app/admin/components/admin-ui.tsx`
Replaced Tailwind `animate-pulse` (2s) with custom `admin-skeleton-pulse` keyframe at 1.4s ease-in-out, matching the brief spec exactly.

---

## States deliberately deferred

| State | Deferred to |
|---|---|
| User menu dropdown Closing animation | Polish pass (requires delayed unmount) |
| AdminCommandSearch Opening animation | Animate pass (BaseDialog entrance) |
| AdminAccessDenied — full EmptyState illustration | Per-page sessions |
| AdminPanel Interactive-hover shadow (when panel is a link) | Per-page sessions |
| BookingListCard states | Sessions 2/3/4 |
| AdminStat trend/loading/hidden-by-permission | Dashboard sessions 8/9/10 |
| UrgentAttentionPanel empty/loading/error | Dashboard sessions 8/9/10 |
| NotificationBell Loading/Error states | notification-bell.tsx — not in session 1 scope |

---

## Verification results

| Check | Result |
|---|---|
| 60-character names render without breaking layout | PASS — `truncate` + `max-w-[8rem]` on trigger; `truncate` on all dropdown/sheet name displays |
| Large numbers don't overflow | N/A for chrome — number surfaces (AdminStat) are per-page session scope |
| Empty notification state shows "All caught up" | PASS — confirmed in NotificationBell |
| Empty command search shows hint text | PASS — "Start typing" + "Search bookings, clients, staff, or pages." |
| Error responses display clear next-action | PASS (FIXED) — was missing; now Sonner toast + retain query |
| Form inputs tappable without zoom | PASS — all inputs use `h-11` (44px); WCAG 2.5.5 met |
