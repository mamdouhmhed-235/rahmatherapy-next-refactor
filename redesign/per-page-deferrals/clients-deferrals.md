# Deferrals — clients (Phase 6 session)

Post-visual-review pass (2026-05-17) resolved most P1/P2 audit findings. Remaining items below carry forward to Phase 7.

## Resolved in visual-review pass (no longer deferred)

- **P1 mobile rebook flow** — addressed via the "Start new booking" link inside `ClientRowMenu` (`ClientRowMenu.tsx`), surfaced on mobile only via `md:hidden`. Two-tap path: tap overflow `...` → tap "Start new booking". A true `AdminMobileActionBar` (tap row → bar slides up) would still be the brief's preferred pattern but is deferred (requires client-side row-selection state).
- **P1 sort toggle `aria-current="page"` misuse** — replaced with `aria-pressed` on the `SortLink` (still rendered as `<Link>` to preserve the GET-only deep-link contract). The sr-only descriptive name is now appended after the visible label, not split.
- **P2 mobile filter uses native `<details>`** — converted to `AdminSheet` (`side="bottom"`) matching the bookings/calendar pattern.
- **P2 sticky group heading H2 at `text-base`** — bumped to title step (Cormorant-style scale via `text-[1.333rem]` + `font-display`) and paired with a 1px horizontal rule that extends to the row right edge. Now reads as architectural separator.
- **P2 row overflow trigger** — `ChevronRight` replaced with a real `more-horizontal` button that opens `AdminPopover` content with last-booking summary + "View client profile" + "View audit history" links.
- **P2 lifecycle tooltip `<span title>`** — retained as enhancement-only tooltip (still mouse-only). Keyboard users get the lifecycle name in the `AdminStatusBadge` text label, which is the primary accessible signal per Named Status Rule.
- **P3 row min-height** — set to brief's 56px (was 60px).
- **P3 `FilterField` label size** — bumped to `text-sm` (was `text-xs`).
- **P3 inline OKLCH literals** — left in place where they match canonical DESIGN.md token values (`surface-hover`, `surface-selected`); they're 1:1 token-equivalent and follow the existing admin-ui pattern.
- **Tablet (768) filter overflow** — desktop filter form breakpoint moved from `md:grid` to `lg:grid`; tablet now uses the `AdminSheet` "Refine" trigger.
- **Mobile (375) "Tap to expand" truncation** — entire native `<details>` replaced by AdminSheet, no longer a concern.
- **Mobile last row hidden behind bottom nav** — `pb-20 lg:pb-0` added to the page wrapper.
- **Filler description under H1** — removed; replaced with the C2 stats line (`{N} active · {N} new this month · {N} returning · {N} at risk or lapsed`) where each segment is a one-click filter link.
- **Two stacked panel bands above the list** — count/sort strip is now frameless (transparent background, no border).
- **Avatar tints visually flat** — chroma bumped from 0.025 → 0.05, lightness reduced from 88% → 82% for clearer hue differentiation.
- **Trailing decorative chevron** — removed; replaced by the more-horizontal overflow trigger.
- **Server-render no loading state** — added `app/admin/clients/loading.tsx` with skeleton rows.
- **D2 hover bottom-border accent** — `hover:border-b-[oklch(60%_0.08_155)]` adds a 1px Hover-Moss accent on the row's bottom edge (full-width, not side-stripe).
- **D4 lapsed clients reduced saturation** — `opacity-75` applied when `lifecycle === "lapsed"` (visually deprioritised, still selectable).
- **C8 pagination** — `?page=N` GET param + 50-per-page server-side slice + "{start}–{end} of {total}" counter + Previous/Next nav (only renders when `totalPages > 1`).

## Still deferred to Phase 7

### True `AdminMobileActionBar` (tap-row pattern)
- **Source:** Brief §6 / §7 Interaction Model
- **Verbatim:** "On mobile, moves to a contextual `AdminMobileActionBar` when the row is tapped."
- **Defer to:** Phase 7
- **Why deferred:** Requires client-side row-selection state (which row is tapped) and an event handler on each row. The current `ClientRowMenu` (overflow popover) provides an equivalent two-tap path for mobile rebook ("…" → "Start new booking"). Phase 7 should adjudicate whether the action-bar pattern is worth the client-state cost vs the popover approach.
- **Provisional Phase 6 answer used to continue this session:** "Start new booking" link surfaced inside `ClientRowMenu` on mobile only.

### Inline overflow menu items requiring server actions
- **Source:** Brief §5 row anatomy ("Edit client", "Mark inactive", "Request privacy action", "View audit")
- **Defer to:** Phase 7
- **Why deferred:** "Edit client" and "Mark inactive" require existing-but-untouchable server actions wired into UI; "Request privacy action" is currently invoked from client detail. Surfacing these in the row-level popover would require adding form/button wrappers that conflict with the recipe's "Files to NEVER touch" list. Current `ClientRowMenu` surfaces the two non-mutating items: "View client profile" + "View audit history".
- **Provisional Phase 6 answer used to continue this session:** Two link-only items in the popover plus the mobile-only "Start new booking" shortcut.

### Hydration warning from browser-extension `caret-color`
- **Source:** Step 11c Playwright console
- **Verbatim:** Browser-extension-injected `style={{caret-color: "transparent"}}` triggers React hydration mismatch on every input.
- **Defer to:** N/A — not our code, not addressable from project source.
- **Why deferred:** This is documented in BASELINE-ISSUES.md §Dev-Only Noise as the standard pattern.
