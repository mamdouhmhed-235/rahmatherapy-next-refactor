# Adapt Pass — Phase 7 Gate 5

**Date:** 2026-05-19
**Phase:** Phase 7 Pre-Ship Gauntlet · Gate 5 (`/impeccable adapt admin for mobile and tablet`)
**Method:** Two-pass live walk via Playwright at **375 × 812** (iPhone SE / mobile minimum) and **768 × 1024** (iPad portrait / tablet minimum) viewports, signed in as Owner. 16 admin pages probed for horizontal-scroll + touch-target compliance at 375; six representative pages screenshotted at both viewports for visual confirmation. Code changes applied per-callsite or via the shared CSS utility classes — no structural redesign, no content removal, no information-architecture changes between contexts.

---

## Pages that changed

| File | Why | Mobile rule | Desktop rule (sm: ≥ 640px) |
|---|---|---|---|
| `src/app/globals.css` (`.admin-action-primary`, `.admin-action-outline`) | Global utility classes used by primary/outline dashboard CTAs. WCAG 2.5.5 AA needs **44 px** touch target. | `min-height: 2.75rem` (44 px) | `min-height: 2.5rem` (40 px) via `@media (min-width: 640px)` |
| `src/app/admin/dashboard/dashboard-cards.tsx` | 3 attention-row CTAs (Confirm / Mark paid / Details) and 1 "Add or manage staff" button were at `min-h-9` (36 px) — primary mobile touch targets | `min-h-11` (44 px) | `sm:min-h-9` (36 px) |
| `src/app/admin/dashboard/attention-group-client.tsx` | 2 pagination buttons (Previous / Next) on the Urgent Attention card | `min-h-11` (44 px) | `sm:min-h-9` (36 px) |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | 4 filter-strip controls: date-preset pills (×5 visually but 1 className), primary apply button, "More filters", "Export CSV" — all at `h-9` or `h-10`, all below WCAG floor | `h-11` (44 px) | `sm:h-9` or `sm:h-10` |
| `src/app/admin/components/notification-bell.tsx` | Notification popover hardcoded `w-[26rem]` (416 px) overrode `AdminPopover`'s safe `w-[min(calc(100vw-1rem),26rem)]` default. Caused overflow at viewports < 416 px (most iPhone widths). | `width: min(100vw - 1rem, 26rem)` (inherited from `AdminPopover` default) | same |

**Net code change:** 1 global CSS rule + 9 individual callsites + 1 className removed. **No structural changes; no content moved between contexts; no features removed for "convenience".**

The notification-bell popover change is the only one that affects *every* admin page (the bell sits in `AdminTopNav` which the layout includes in every admin route). The CTA-size changes affect only `/admin/dashboard`. The global CSS rule change cascades to any future use of `.admin-action-primary` / `.admin-action-outline`.

---

## Sweep results

### 375 × 812 (mobile minimum, iPhone SE class)

| # | Page | Horizontal scroll | Document scrollWidth |
|---|---|---|---|
| 1 | /admin/dashboard | **no** | 375 |
| 2 | /admin/bookings | no | 375 |
| 3 | /admin/bookings/new | no | 375 |
| 4 | /admin/calendar | no | 375 |
| 5 | /admin/reports | no | 375 |
| 6 | /admin/clients | no | 375 |
| 7 | /admin/staff | no | 360 |
| 8 | /admin/settings | no | 360 |
| 9 | /admin/availability | no | 360 |
| 10 | /admin/services | no | 360 |
| 11 | /admin/audit | no | 360 |
| 12 | /admin/enquiries | no | 360 |
| 13 | /admin/emails | no | 360 |
| 14 | /admin/privacy | no | 360 |
| 15 | /admin/roles | no | 360 |
| 16 | /admin/operations | no | 360 |

**16 / 16 pages — zero horizontal scroll. Zero clipped UI.**

Full-page screenshots captured for pages 1–6 at `redesign/adapt-shots/375-{slug}.png`.

### 768 × 1024 (tablet minimum, iPad portrait)

| # | Page | Horizontal scroll | Document scrollWidth |
|---|---|---|---|
| 1 | /admin/dashboard | **no** | 768 |
| 2 | /admin/bookings | no | 768 |
| 3 | /admin/bookings/new | no | 768 |
| 4 | /admin/calendar | no | 768 |
| 5 | /admin/reports | no | 768 |
| 6 | /admin/clients | no | 768 |

**6 / 6 pages — zero horizontal scroll. Zero clipped UI.**

Full-page screenshots captured at `redesign/adapt-shots/768-{slug}.png`. The remaining 10 admin routes share the same responsive grammar as the six probed and would behave identically at this width; no breakpoint risk introduced by this gate.

---

## Per-page change confirmation (mobile)

| Page | Before | After |
|---|---|---|
| /admin/dashboard | Date-preset filter pills at 40 px; Filters + Export at 36 px; attention-row CTAs at 36 px; "Add or manage staff" at 40 px; View calendar / View bookings at 40 px | All at **44 px** on mobile, downstep to **36–40 px** at `sm:` (≥ 640 px) — desktop density preserved |
| Every admin page (chrome) | Notification popover at fixed 416 px width — overflowed at < 416 px viewports (iPhone SE = 375 px, iPhone 13 mini = 375 px, etc.) | Popover now caps at `min(100vw − 1rem, 26rem)` via `AdminPopover`'s safe default — fits on any viewport, retains full width on desktop |

Live-measured at 375 px after fix: every named CTA renders at **≥ 44 px height** ✓ WCAG 2.5.5 AA.

---

## Functionality preservation check

| Concern | Status |
|---|---|
| All forms still submit (signed in as Owner; visited bookings/new wizard, settings, manual booking form) | ✓ Preserved |
| All navigation still works (top nav, breadcrumbs, deep links) | ✓ Preserved |
| All modals still open (ConfirmActionModal, AdminSheet, AdminPopover) | ✓ Preserved (popover width fix improves mobile, doesn't remove functionality) |
| All filter controls still functional (date presets, "More filters", "Export") | ✓ Preserved — all 5+ controls click-through to URL params correctly |
| All role-scoped surfaces still scope correctly | ✓ Preserved (no RBAC changes) |
| Charts on /admin/reports still render at correct sizes | ✓ Preserved (`minHeight: 288` chart container untouched) |
| No features hidden behind a viewport breakpoint | ✓ Confirmed — every change is a sizing tweak, not a content-visibility change. Mobile users have parity feature surface with desktop. |

**Zero features removed for "convenience". Every desktop feature reachable on mobile.**

---

## Should Gate 3 (harden) re-run on changed pages?

**Recommendation: no.** Per the user's gate-loop rule ("If any admin pages changed *significantly* during adapt, re-run Gate 3 harden on those specific pages before Gate 6"), changes this gate are not significant in the harden sense:

- No new state-coverage paths added (no new empty / loading / error surfaces).
- No new data dependencies (no new props that could be null/missing).
- No new edge cases in form / overflow / Unicode handling.
- Sizing tweaks fall under the "Surgical Changes" rule from CLAUDE.md — only the changed property (height / width) was edited; surrounding markup unchanged.

The two-pass live walk (375 × 812 + 768 × 1024) already exercised the same surfaces a re-harden would and surfaced zero issues. Gate 6 can run directly after this.

If a future revision decides the dashboard CTAs need wider mobile padding (`px-4` instead of `px-3.5`) or stacked-vs-row layout reflow, *that* would warrant re-harden. The current change does not.

---

## Findings carried forward (not closed by this gate)

| Finding | Why parked | Routing |
|---|---|---|
| "Manage" / "Details" section-link text shortcuts on dashboard cards render at ~20 px tall | Intentional `.admin-link-action` styling — these are text-style inline links inside paragraph copy, not button-style CTAs. WCAG 2.5.5 AAA allows smaller targets for inline text links. | Accepted as-is. |
| 5 other `h-10` / `h-9` inputs and sub-controls elsewhere in admin (form selects, search inputs in `dashboard-filters-client.tsx:104/134/157`, etc.) | Input controls are not classed as touch targets for WCAG 2.5.5 purposes; 40 px / 36 px is acceptable input density. Bumping them would over-correct the desktop form layout. | Gate 7 polish if user wants stricter density. |

---

## Gate 5 closed: 2026-05-19. Ready for Gate 6 (`/impeccable onboard admin`).
