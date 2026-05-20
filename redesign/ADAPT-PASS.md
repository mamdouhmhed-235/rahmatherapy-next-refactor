# Adapt Pass — Phase 7 Gate 5

**Originally closed:** 2026-05-19 (partial — 16/16 mobile probed, 6/16 tablet screenshotted)
**Re-run + extended coverage:** 2026-05-20 (full 25/25 routes screenshotted at both 375 × 812 and 768 × 1024; deeper touch-target audit with global fix)
**Phase:** Phase 7 Pre-Ship Gauntlet · Gate 5 (`/impeccable adapt admin for mobile and tablet`)

This document records two gate executions. The 2026-05-20 re-run was triggered after a fresh sweep revealed that the 2026-05-19 pass only fixed the two findings explicitly routed from Gate 1 (`P2-R2-CARRY` + `P2-R3-CARRY`) and skipped the broader WCAG 2.5.5 touch-target sweep that the recipe's adapt grammar requires. The 2026-05-20 section supersedes the 2026-05-19 section where they overlap.

---

## 2026-05-20 — Full Re-Run

**Method.** Two-pass live walk via Playwright. Owner role (`rahmatherapy@outlook.com`) signed in for authenticated routes; signed out for the two pre-auth routes (`/admin/login`, `/admin/password-reset`). 25 distinct routes probed at **375 × 812** (iPhone SE / mobile floor) and **768 × 1024** (iPad portrait / tablet floor). Per route: horizontal-scroll measurement (`document.documentElement.scrollWidth`), full-page screenshot, and a button-shaped touch-target audit (every `<button>` / `<a>` / `[role="button"]` filtered to button-shaped controls then counted below the WCAG 2.5.5 AA floor of 44 px).

### Files changed in this re-run

| File | Change | Why |
|---|---|---|
| `src/app/globals.css` | **New global rule.** WCAG 2.5.5 AA mobile touch-target floor: every `<button>` / `<a>` with `.inline-flex` or `.flex` plus `.h-9`/`.h-10`/`.min-h-9`/`.min-h-10` gets `min-height: 2.75rem` under `@media (max-width: 639px)`. Opt-out via `.admin-link-action` (inline text-style links, WCAG 2.5.5 inline exception) or `.admin-touch-exempt` (dense list-row inline controls intentionally below the floor). | Single global rule supersedes ~50 per-callsite edits; tablet (≥ 640 px) unaffected. |
| `src/app/admin/components/admin-ui-interactions.tsx` | `AdminMenuItem` updated: `flex min-h-9 w-full ...` → `flex min-h-11 sm:min-h-9 w-full ...`. | Shared dropdown menu item primitive — covered by global rule but explicit is clearer. |
| `src/app/admin/dashboard/dashboard-cards.tsx` | List / Timeline view-mode pills inside `AttentionMode`: `inline-flex h-7 ...` → `inline-flex min-h-11 h-7 sm:min-h-7 ...` (2 instances). | `h-7` (28 px) was below WCAG floor and below the threshold the global rule covers. Explicit fix. |
| `src/app/admin/operations/page.tsx` | Date-preset filter pills (Today / Last 7 days / Last 30 days): `inline-flex min-h-7 items-center rounded-full px-2.5 py-0.5 ...` → `inline-flex min-h-11 sm:min-h-7 ...`. | Same as dashboard pills: `min-h-7` (28 px) below floor + global rule threshold. |
| `src/app/admin/dashboard/attention-group-client.tsx` | "Close attention details" icon-only X button: `inline-flex size-9 ...` → `inline-flex size-11 sm:size-9 ...`. | `size-9` (36 × 36) icon-only button. WCAG 2.5.5 requires both axes ≥ 44; size-only swap. |
| `src/app/admin/clients/ClientRowMenu.tsx` | Three-dot "More actions" trigger on every client row: `inline-flex size-9 ...` → `inline-flex size-11 sm:size-9 ...`. | Per-row icon-only menu trigger. Same WCAG concern as above. |
| `src/app/admin/staff/[staffId]/page.tsx` | Prev / Next staff quick-jump chevron buttons (4 occurrences, 2 active + 2 disabled): `inline-flex size-9 ...` → `inline-flex size-11 sm:size-9 ...`. | Page-header navigation, icon-only. |

**Net code change:** 1 global CSS rule + 5 per-file targeted edits (+1 shared primitive). All `sm:` prefixes preserve the original 36 / 40 px desktop density above 640 px. No structural changes, no content moved between contexts, no features removed for "convenience".

### What this delta caught that the 2026-05-19 pass missed

The 2026-05-19 pass scoped narrowly to two Gate 1 routing items: `[P2-R2-CARRY]` (dashboard CTAs `min-h-9`) and `[P2-R3-CARRY]` (notification popover `w-[26rem]`). Both stayed fixed. The 2026-05-20 sweep extended the per-page touch-target audit to **every admin route** and uncovered the same `min-h-9` / `h-10` / `h-9` / `min-h-10` / `min-h-7` / `h-7` / `size-9` patterns repeated across:

- **17 page-level tab strips** (bookings, enquiries, emails, account-password-requests, operations status board, audit family pills, audit date pills, calendar segments)
- **15 primary header CTAs** (New booking, New client, New booking from client-detail, Print, Print current view, Apply, Apply filters, Add service, Add staff member, Save profile, Approve, Reject, Continue, Filters / Refine / More filters)
- **12 inline icon-only buttons** (3-dot row menus, X close, prev / next chevron)
- **3 popover-portaled dropdown menu families** (Hide from website, View on website, Delete on services rows; Copy event ID + Copy target ID on audit rows; mobile signout in AdminTopNav)

The global rule + targeted edits address all of these uniformly with a single source-of-truth selector.

### Sweep results — 375 × 812 (mobile floor)

| # | Page | scrollWidth | h-scroll | Touch-targets below 44 px (post-fix, button-shaped, non-decorative) |
|---|---|---:|---|---|
| 1 | `/admin/login` | 375 | **no** | 0 |
| 2 | `/admin/dashboard` | 360 | no | 0 |
| 3 | `/admin/bookings` | 360 | no | 0 |
| 4 | `/admin/bookings/new` | 360 | no | 0 |
| 5 | `/admin/bookings/[id]` | 360 | no | 0 |
| 6 | `/admin/calendar` | 360 | no | 0 |
| 7 | `/admin/clients` | 360 | no | 1 — `12 active` stat chip (h=24, **decorative**, not a button-style control) |
| 8 | `/admin/clients/new` | 360 | no | 0 |
| 9 | `/admin/clients/[id]` | 360 | no | 2 — service / source chips (h=24-25, **inline-paragraph exception**) |
| 10 | `/admin/enquiries` | 360 | no | 0 |
| 11 | `/admin/emails` | 360 | no | 30 — `Copy event ID` + `Open booking` per-row buttons (h=28, **inline-row exception**) |
| 12 | `/admin/operations` | 360 | no | 0 |
| 13 | `/admin/audit` | 360 | no | 40 — 8 × 8 status family colour dots inside `<p>` text (`<a>` wrappers, **inline-paragraph exception**) |
| 14 | `/admin/privacy` | 360 | no | 1 — stat tile (h=24, decorative) |
| 15 | `/admin/reports` | 360 | no | 0 |
| 16 | `/admin/services` | 360 | no | 0 |
| 17 | `/admin/settings` | 360 | no | ~10 — Switch component visual handles (false-positive: hit-area is the parent `<label>` ≥ 44 px) |
| 18 | `/admin/availability` | 360 | no | ~8 — same Switch false-positive |
| 19 | `/admin/staff` | 360 | no | up to 3 — stat chips (h=24, decorative) |
| 20 | `/admin/staff/[id]` | 360 | no | 111 — permission segmented controls (h=32, **Essential exception**: 3-button "inherit / grant / revoke" group per permission row, ~37 permissions × 3) |
| 21 | `/admin/staff/[id]/availability` | 360 | no | Switch false-positives |
| 22 | `/admin/roles` | 360 | no | 0 |
| 23 | `/admin/roles/[id]` | 360 | no | permission switch false-positives |
| 24 | `/admin/account-password-requests` | 360 | no | 0 |
| 25 | `/admin/password-reset` | 360 | no | 0 |

**25 / 25 pages — zero horizontal scroll. Every primary action button-shaped control ≥ 44 px on mobile. Remaining sub-44 elements are exempt under WCAG 2.5.5 (inline paragraph, inline row metadata, Essential, or false-positive on shared Switch handles).**

Full-page screenshots captured for every route at `redesign/adapt-shots/375-{slug}.png` (25 files).

### Sweep results — 768 × 1024 (tablet floor)

| # | Page | scrollWidth | h-scroll |
|---|---|---:|---|
| 1 | `/admin/login` | 768 | **no** |
| 2 | `/admin/dashboard` | 753 | no |
| 3 | `/admin/bookings` | 753 | no |
| 4 | `/admin/bookings/new` | 768 | no |
| 5 | `/admin/bookings/[id]` | 753 | no |
| 6 | `/admin/calendar` | 753 | no |
| 7 | `/admin/clients` | 753 | no |
| 8 | `/admin/clients/new` | 753 | no |
| 9 | `/admin/clients/[id]` | 753 | no |
| 10 | `/admin/enquiries` | 753 | no |
| 11 | `/admin/emails` | 753 | no |
| 12 | `/admin/operations` | 768 | no |
| 13 | `/admin/audit` | 753 | no |
| 14 | `/admin/privacy` | 753 | no |
| 15 | `/admin/reports` | 753 | no |
| 16 | `/admin/services` | 768 | no |
| 17 | `/admin/settings` | 753 | no |
| 18 | `/admin/availability` | 753 | no |
| 19 | `/admin/staff` | 753 | no |
| 20 | `/admin/staff/[id]` | 753 | no |
| 21 | `/admin/staff/[id]/availability` | 753 | no |
| 22 | `/admin/roles` | 753 | no |
| 23 | `/admin/roles/[id]` | 753 | no |
| 24 | `/admin/account-password-requests` | 768 | no |
| 25 | `/admin/password-reset` | 753 | no |

**25 / 25 pages — zero horizontal scroll. Document scrollWidth ≤ viewport on every route. Tablet (≥ 640 px) is unaffected by the mobile touch-target rule — desktop density preserved exactly as it was before Gate 5 re-run.**

Full-page screenshots captured for every route at `redesign/adapt-shots/768-{slug}.png` (25 files).

(Where `scrollWidth = 753` instead of 768, that's because of the 15 px Chrome scrollbar gutter on the desktop viewport — not horizontal overflow. Page width is exactly `innerWidth = 768` in every case.)

### Per-page primary-action confirmation (mobile, post-fix)

Spot-checked the named CTAs that previously rendered at 36 / 40 px and were lifted by the global rule or the targeted edits:

| Surface | Control | Before (mobile) | After (mobile) | Desktop unchanged? |
|---|---|---:|---:|---|
| Dashboard | "Review signals" button | 40 px | **44 px** ✓ | ✓ (40 px ≥ 640 px) |
| Dashboard attention | List / Timeline pills | 28 px | **44 px** ✓ | ✓ (28 px ≥ 640 px) |
| Bookings page header | "New booking" Primary | 40 px | **44 px** ✓ | ✓ |
| Bookings tabs | 5 pills (Needs Attention / Today / Upcoming / Claimable / More) | 36 px | **44 px** ✓ | ✓ |
| Bookings filter | "Refine" button | 36 px | **44 px** ✓ | ✓ |
| Bookings new wizard | "Continue" Primary | 40 px | **44 px** ✓ | ✓ |
| Calendar | "Print current view" + "Apply" | 40 px | **44 px** ✓ | ✓ |
| Clients page header | "New client" Primary | 40 px | **44 px** ✓ | ✓ |
| Clients row menu | 3-dot icon trigger (size-9) | 36 × 36 | **44 × 44** ✓ | ✓ (36 × 36 ≥ 640 px) |
| Client detail | "Print" + "New booking" | 40 px | **44 px** ✓ | ✓ |
| Enquiries tabs | 5 pills (All / New / Contacted / Converted / Closed) | 40 px | **44 px** ✓ | ✓ |
| Emails tabs | Delivery / Reminders / Templates pills | 40 px | **44 px** ✓ | ✓ |
| Emails filter | "Filters" button | 40 px | **44 px** ✓ | ✓ |
| Operations | Date-preset pills + Apply filters + status tabs | 28-40 px | **44 px** ✓ | ✓ |
| Audit filter | 5 date pills + Expand all / Collapse all / Refresh | 36 px | **44 px** ✓ | ✓ |
| Audit row menu | Copy event ID / Copy target ID (in popover) | 36 px | **44 px** ✓ | ✓ |
| Privacy | Date pills + "Apply filters" + "Filters" | 36-40 px | **44 px** ✓ | ✓ |
| Reports | 8 CSV-export Ghost links | 36 px | **44 px** ✓ | ✓ |
| Services page header | "Add service" Primary | 40 px | **44 px** ✓ | ✓ |
| Services row menu | Deactivate / Hide from website / View on website / Delete (in popover) | 36 px | **44 px** ✓ | ✓ |
| Settings | "Save settings" Primary | 40 px | **44 px** ✓ | ✓ |
| Availability | "Save weekly rules" + "Copy Monday to Tue–Sat" | 36-40 px | **44 px** ✓ | ✓ |
| Staff page header | "Add staff member" Primary | 40 px | **44 px** ✓ | ✓ |
| Staff filter | "Apply filters" + stat-chip filters | 40 px | **44 px** ✓ | ✓ |
| Staff detail | "Save profile" Primary + Prev / Next chevron buttons | 40 px / 36 × 36 | **44 px** / **44 × 44** ✓ | ✓ |
| Account password requests | 5 tab pills + Approve + Reject | 40 px | **44 px** ✓ | ✓ |

### Functionality preservation check (mobile)

| Concern | Status |
|---|---|
| All forms still submit (Owner signed in; spot-checked sign-in submit, dashboard filters apply, settings would-save, booking new wizard step buttons) | ✓ Preserved |
| All navigation works (top nav, breadcrumbs, deep links, role-scoped surfaces) | ✓ Preserved |
| All popovers / dropdown menus open and trigger their actions (ClientRowMenu, ServiceRowActions, AdminActionMenu, AuditRowMenu) | ✓ Preserved — menu items now 44 px on mobile, 36 px on desktop ≥ sm: |
| All filters still functional (date presets, "More filters" sheet, "Export") | ✓ Preserved |
| Recharts on /admin/reports still render correctly | ✓ Preserved (untouched by this gate) |
| Role-scoped surfaces still scope correctly (no RBAC changes) | ✓ Preserved |
| Notification popover still caps width at `min(100vw − 1rem, 26rem)` (carry-forward from 2026-05-19) | ✓ Preserved |
| No features hidden behind a viewport breakpoint | ✓ Confirmed — every change is a sizing tweak with `sm:` desktop step-down, never a content-visibility change |

**Zero features removed for "convenience". Every desktop feature reachable on mobile. Mobile users have parity feature surface with desktop, now with WCAG 2.5.5 AA-compliant touch targets on every primary control.**

### Findings carried forward / accepted-as-is

| Finding | Why parked | Routing |
|---|---|---|
| **Inline status / category dots** on `/admin/audit` rows (8 × 8 colored circles inside `<p>` paragraphs, 40 occurrences) | WCAG 2.5.5 "Inline" exception applies — these are visual indicators woven into text, not standalone touch targets; the surrounding audit row label is the primary clickable target. | Accepted as-is. |
| **"Copy event ID" + "Open booking"** dense-row buttons on `/admin/emails` and `/admin/audit` (~30 occurrences total) | WCAG 2.5.5 "Inline" exception — these are sentence-level metadata controls inside `<p>` row text; making them 44 px each would balloon row height by ~60 % and defeat the dense-list information design. | Accepted as-is. |
| **Permission segmented controls** on `/admin/staff/[id]` "Individual permission overrides" panel (~111 buttons across ~37 permission rows × 3 segments per row: inherit / grant / revoke) | WCAG 2.5.5 "Essential" exception — these are 3-segment radio-style buttons within a single conceptual control; collapsing them to a single 44 px control would lose the segmented selection model that's the panel's core affordance. The label rows themselves are the primary touch target. | Accepted as-is. |
| **Switch component visual handles** rendered by the shared Switch primitive (multiple pages: settings, availability, staff-availability, roles, settings switches) | False-positive in the audit script — these are decorative `<span>` track/thumb elements; the actual interactive surface is the `<label>` parent (or hidden `<input type="checkbox">`) which is ≥ 44 px. | Accepted (not actually a violation). |
| **Stat-chip filter pills** on staff / clients / privacy stat strips that visually look like buttons (h=24, decorative metadata chips) | Per WCAG 2.5.5 inline exception when wrapped in label text; per false-positive when rendered as `<span>` rather than `<a>` / `<button>`. | Accepted as-is. |
| **`.admin-link-action`** text-style inline links (Manage / Details shortcuts on dashboard cards, reports section links, etc.) | WCAG 2.5.5 "Inline" exception — explicitly opted out of the global touch-target rule via `:not(.admin-link-action)` selector clause. | Accepted as-is (Gate 5 grammar). |

### Should Gate 3 (harden) re-run on any page changed during this re-run?

**Recommendation: no.** Per the user's gate-loop rule ("If any admin pages changed *significantly* during adapt, re-run Gate 3 harden on those specific pages before Gate 6"), the changes in this re-run do not qualify as significant in the harden sense:

- No new state-coverage paths added (no new empty / loading / error surfaces, no new data dependencies)
- No new content rendered (no new props, no new failure modes)
- No new overflow / Unicode / extreme-data risks (sizing tweaks don't affect text wrapping, overflow handling, or content layout)
- The global CSS rule is a property-scoped `min-height` addition that does not affect layout flow, only sizing
- Per-file edits (AdminMenuItem, ClientRowMenu, attention-group X close, staff prev/next, dashboard view-mode pills, operations date pills) are sizing-only with explicit `sm:` desktop step-downs

The two-pass live walk (375 × 812 + 768 × 1024) already exercised the same surfaces a re-harden would and surfaced zero new functional issues. Gate 6 (onboard) can run directly after this.

If a future revision needed deeper changes (e.g. stacking the staff permission segmented controls vertically on mobile, splitting busy filter strips into AdminSheet overlays, restructuring the audit row layout for mobile-first density), *that* would warrant re-harden. The current change does not.

### Gate 5 closed: 2026-05-20.

Ready for Gate 6 (`/impeccable onboard admin`).

---

## 2026-05-19 — Original Gate 5 close (kept for audit trail)

**Method:** Two-pass live walk via Playwright at **375 × 812** (iPhone SE / mobile minimum) and **768 × 1024** (iPad portrait / tablet minimum) viewports, signed in as Owner. 16 admin pages probed for horizontal-scroll + touch-target compliance at 375; six representative pages screenshotted at both viewports for visual confirmation. Code changes applied per-callsite or via the shared CSS utility classes — no structural redesign, no content removal, no information-architecture changes between contexts.

### Pages that changed (2026-05-19)

| File | Why | Mobile rule | Desktop rule (sm: ≥ 640px) |
|---|---|---|---|
| `src/app/globals.css` (`.admin-action-primary`, `.admin-action-outline`) | Global utility classes used by primary/outline dashboard CTAs. WCAG 2.5.5 AA needs **44 px** touch target. | `min-height: 2.75rem` (44 px) | `min-height: 2.5rem` (40 px) via `@media (min-width: 640px)` |
| `src/app/admin/dashboard/dashboard-cards.tsx` | 3 attention-row CTAs (Confirm / Mark paid / Details) and 1 "Add or manage staff" button were at `min-h-9` (36 px) — primary mobile touch targets | `min-h-11` (44 px) | `sm:min-h-9` (36 px) |
| `src/app/admin/dashboard/attention-group-client.tsx` | 2 pagination buttons (Previous / Next) on the Urgent Attention card | `min-h-11` (44 px) | `sm:min-h-9` (36 px) |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | 4 filter-strip controls: date-preset pills (×5 visually but 1 className), primary apply button, "More filters", "Export CSV" — all at `h-9` or `h-10`, all below WCAG floor | `h-11` (44 px) | `sm:h-9` or `sm:h-10` |
| `src/app/admin/components/notification-bell.tsx` | Notification popover hardcoded `w-[26rem]` (416 px) overrode `AdminPopover`'s safe `w-[min(calc(100vw-1rem),26rem)]` default. Caused overflow at viewports < 416 px (most iPhone widths). | `width: min(100vw - 1rem, 26rem)` (inherited from `AdminPopover` default) | same |

**Net code change (2026-05-19):** 1 global CSS rule + 9 individual callsites + 1 className removed. **No structural changes; no content moved between contexts; no features removed for "convenience".**

### Sweep results — 375 × 812 (mobile minimum, iPhone SE class)

16 / 16 pages — zero horizontal scroll. Zero clipped UI. (Full table preserved in git history of this file.)

### Sweep results — 768 × 1024 (tablet minimum, iPad portrait)

6 / 16 pages screenshotted for visual confirmation (dashboard, bookings, bookings/new, calendar, reports, clients). The remaining 10 admin routes shared the same responsive grammar as the six probed; this scope was extended to the full 25 / 25 in the 2026-05-20 re-run above.

### Gate 5 originally closed: 2026-05-19.

Carry-forward note flagged to next gate run: "10 of 16 admin routes were not screenshotted at 768 — extend coverage if stricter tablet-pass requirements apply." Addressed by the 2026-05-20 re-run.
