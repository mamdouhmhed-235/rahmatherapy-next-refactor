# Brief: dashboard-owner-admin

## 1. Feature Summary

`/admin/dashboard` for Owner / Main Admin and Admin / Practice Manager — the "business" variant of the role-shaped command centre. It is the front door of the admin: the first surface both senior roles see on every sign-in. This redesign **directly resolves BASELINE-CRITIQUE P2** ("Owner dashboard exposes 6+ card groups simultaneously — density exceeds target") and the matching DESIGN.md *Don't* ("expose more than two card tiers simultaneously at Owner dashboard level"). The redesign re-tiers the page into a calm primary surface (Today + Urgent Attention) with a Business Overview tier collapsed behind a disclosure. The filter bar narrows from nine fields to a Date-Range + "More filters" pattern, the inline `NotificationBell` is folded into the right rail of the page header (no longer a floating element), and four absolute-ban / token-escape carry-forwards from Phase 4 are fixed in place.

## 2. Primary User Action

**Read today's state and the attention queue in the first viewport without scrolling, decide which one item to act on, and reach it in one tap. Business-health context expands on disclosure when wanted, never by default.**

## 3. Design Direction

**Colour strategy:** Full palette (committed at chrome level, restrained at content level). Status families carry Today's booking row pills and Urgent Attention row icons. The Business Overview tier — when expanded — uses Confirmed / Pending / Cancelled family tints on the four sub-panels to group meaning across the page; numerals stay Chronicle on Practice Panel. Gold appears once: the marquee "Today's bookings" Cormorant numeral on the Today panel header.

**Theme scene sentence:** *"Fatimah, the practice owner, opens her iPhone at 7:55am from her kitchen — sun coming through the window — to see what today looks like before her first therapist leaves at 9."* Forces light mode, mobile-first ordering, and a primary tier that reads at-a-glance without zoom.

**Anchor references:**
- **Linear's "My Issues" landing** — focused primary surface with disclosure-revealed secondary context, never a wall of cards on first paint
- **Stripe Dashboard "Today" header band** — date-range filter as a compact control with payload, not a row of nine inputs
- **Basecamp 4's "Hey!" page** — a single calm column that respects the operator; no hero-metric template, no decorative widgets

Anti-anchor: the current `/admin/dashboard` Owner view itself — six tiers stacked vertically with no disclosure is the antipattern this brief replaces.

## 4. Scope

Production-ready spec for Phase 6. Owner + Admin/PM "business" variant only. Coordinator and Therapist variants are out of scope here (separate briefs in the Phase 5 queue). Includes: page-level disclosure tiering, filter-bar redesign (9 → 1 + overflow), inline `NotificationBell` repositioning into the page header rail, `dashboard-cards.tsx` `border-l-4` removal (lines 128, 417), `attention-group-client.tsx` `bg-black` removal (line 144), tokenisation of the 12 hardcoded staff-avatar hex tints, Recharts `minHeight: 288` on the demand-trend mini-chart, and `aria-current="page"` on the date-range preset chips.

**Out of scope:** the dashboard data layer (`dashboard-data.ts` — untouchable per RECON §5), the server-side filter contract (GET params per RECON §2 are preserved verbatim), and any change to which roles see which cards (RBAC scope is fixed by `getAdminPageAccess`).

## 5. Layout Strategy

**Page rhythm (top to bottom, desktop ≥1024px):**

1. **`AdminPageHeader`** — H1 "Today at Rahma" (not "Dashboard" — voice-anchored per PRODUCT.md Voice Anchors; Linear-clarity, plain). H1 in Urbanist 600 display step, Chronicle. Below H1: live date in Soft Slate Work Sans 400 label step ("Tuesday 12 May 2026 · Luton"). Right rail: `NotificationBell` (24px) + cmd-K hint chip (desktop only) + role badge ("Owner" / "Admin" in Restricted family pill, Work Sans 500). The bell is **always in the header rail** — never a floating side element, never `border-l-4` styled.

2. **Compact filter strip** — single horizontal row at `surface-card` background, 1px `border-subtle`, 8px radius, padding `md`. Contents left-to-right:
   - **Date-range chip group** — 5 preset pills (Today · This week · This month · Last 30 days · Custom). Active pill: Clinic Green fill, Field White text, `aria-current="page"`. Inactive: transparent, Practice Charcoal. Hover: Hover Moss. The presets map to the existing `range=` GET param; "Custom" reveals `from` + `to` date inputs inline on the same row (desktop) or in a bottom `AdminSheet` (mobile).
   - **"More filters" Ghost button** (`sliders-horizontal` 16px) — opens an `AdminSheet` from the right (desktop) or bottom (mobile) containing the remaining seven filters: `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`. The sheet uses the §5 Input spec verbatim. Apply: Secondary "Apply" + Ghost "Clear all". On submit, the URL updates and the sheet closes. Active-filter count appears as a numeric badge (Pending family) on the "More filters" button.
   - **"Export" Ghost link** — `download` icon, opens `/admin/reports/export?...` with current filters carried; visible only when `view_reports_revenue` is granted. (Owner + Admin/PM both qualify.)

3. **Tier 1 — Primary surface (always visible).** Two-column grid on desktop ≥1280px, single-column stack below.
   - **Left column (60%): `TodayAtAGlanceCard`** — `AdminPanel`, padding `lg`. Top row: marquee Cormorant Garamond 700 numeral (3.157rem, Chronicle) of today's booking count + gold accent dot if any are unconfirmed. **The "unconfirmed" condition now includes REQUEST bookings** (`status: "pending"` + `assignment_status: "unassigned"`) created via booking-new. These arrive without therapist assignment and appear with an Attention-family (orange) status badge on Today rows. The gold dot fires when `assignment_status = "unassigned"` OR `status = "pending"` for any today booking. Sub-line: Work Sans 400 body, Soft Slate, "of which N confirmed · N pending · N completed" — each count as an `AdminStatusBadge` (compact size) inline. Below: a list of up to **5 today rows** — compressed `BookingListCard` variant: avatar (32px) + client name (Urbanist 500 title step) + service + start time + status pill + leading Ghost "Open" link (entire row is the link). Trailing: "See all N for today →" Ghost link in Clinic Green. Empty state ("Quiet day — no bookings scheduled"): centred 80px illustration (calendar with check mark per DESIGN.md §5 EmptyState taxonomy) + encouraging copy.
   - **Right column (40%): `UrgentAttentionPanel`** — `AdminPanel` with **Pending family background tint** (`status-pending-bg`) and 1px `status-pending-text` border. **No `border-l-4`.** Header: "Needs your attention" Urbanist 600 title step + Pending family count badge. Body: up to 5 attention rows. Each row: 16px Lucide icon in Pending family text colour (`aria-hidden="true"`) + description (Work Sans 400 body) + date chip (Work Sans 500 label, Warm Veil background) + trailing chevron, entire row is a deep link. "See all N →" Ghost link at bottom in Clinic Green. Empty state: smaller — 60px illustration (speech bubble with check) + "All caught up. Nothing needs your attention right now."

4. **Tier 2 — Business Overview (disclosure).** A single full-width `AdminPanel` titled "Business overview" with a trailing `chevron-down` toggle. **Collapsed by default.** State persists in `localStorage` keyed by user ID so an operator who prefers it expanded keeps their preference. When expanded, the panel contains a four-tile sub-grid (2×2 desktop, single-column mobile), each tile a small `AdminPanel`:
   - **Staff Capacity tile** — Today's capacity utilisation. Top: Cormorant Garamond numeral (smaller — 1.778rem, Chronicle) "73%" + Confirmed family dot. Body: stacked-bar (`AdminStackedBar` from admin-ui.tsx) of booked / available / blocked per active therapist. Avatars (32px circles) on each row use the **tokenised deterministic-tint utility** — replace 12 hardcoded hexes (`dashboard-cards.tsx`) with `oklch(85% 0.035 var(--avatar-hue))` where `--avatar-hue` is `(index * 37) mod 360`, clamped to the brand-adjacent ranges (75–165 and 30–80) to skip purples/magentas.
   - **Payment Health tile** — `view_reports_revenue`-gated (Owner + Admin/PM both qualify). Top: marquee Cormorant numeral of outstanding £ across confirmed bookings. Body: Confirmed family count "£X paid this week" + Pending family count "£X outstanding". Trailing Ghost link "→ Open payment report".
   - **Operations Health tile** — count of unacknowledged operational events from `/admin/operations`. Top: numeral. Body: a 2-row excerpt of the top events with Pending family icons. Trailing Ghost link "→ Operations".
   - **Demand Trend tile** — `RevenueChart`-cousin mini-chart. **`ResponsiveContainer` gets explicit `minHeight: 288`** (fixes the 6 pre-existing Recharts warnings — RECON §8). Bar fills use `accent-amber` (admin-amber on dark-on-light contrast safe per DESIGN §2 No-Gold-Text exception). Empty state: "Not enough data yet. Trend appears after 14 days of bookings."

5. **Tonal lift between tiers.** Tier 1 cards sit at `surface-card` (oklch 99.2%) over the `surface-page` canvas (oklch 97.8%). Tier 2's parent panel sits at `surface-card` and its four sub-tiles step **down** to `surface-page` — i.e. the sub-tiles read as wells inside the parent panel. This honours the Tonal Lift Rule without nesting two cards at the same lightness (which DESIGN.md bans).

**Mobile rhythm (<768px):** Single-column. The two Tier-1 panels stack (Today first, Attention second). Date-range chips become a horizontal momentum-scroll strip; "More filters" button is full-width below the chip strip. Business Overview disclosure becomes full-width single-column when expanded. `NotificationBell` stays in the header rail at 24px (already a 44px touch target via padding).

## 6. Key States

| State | What the user sees |
|---|---|
| Owner — first paint, populated DB | Header + filter strip + Tier 1 (Today panel showing 3-5 today rows + Attention panel showing 1-3 attention items). Tier 2 disclosure collapsed. Page fits in one viewport at 1440×900. |
| Owner — populated DB, mobile 375 | Same content, stacked. Today panel fully visible at first paint; Attention panel one short scroll below. |
| Owner — empty DB (no bookings, no enquiries, no events) | Tier 1 Today panel shows the empty state ("Quiet day…" with calendar-check illustration). Attention panel shows its empty state. Tier 2 disclosure label reads "Business overview (no activity yet)" and the chevron is disabled. |
| Owner — DB with no attention items | Today panel populated, Attention panel shows "All caught up. Nothing needs your attention right now." inside a Confirmed family tint (the panel's background tint shifts from Pending family to Confirmed family when the count is 0). |
| Admin / Practice Manager | Identical to Owner. No surface differences. |
| Tier 2 expanded | Four sub-tiles appear in a 2×2 grid (desktop) or single column (mobile). Disclosure persists per user via `localStorage`. |
| Filter "More filters" open (desktop) | `AdminSheet` slides in from the right covering ~480px. Backdrop dims canvas via the standard overlay shadow. ESC closes; focus returns to the trigger button. |
| Filter "More filters" open (mobile) | `AdminSheet` slides up from bottom covering ~85vh. Sticky "Apply" + "Clear all" footer. |
| Filtered to a date range with zero matching bookings | Today panel becomes "No bookings for this range" + Ghost "Clear filters" link. Attention panel and Tier 2 ignore filters (always show current state). |
| Loading (Server Component streaming) | Standard `AdminSkeleton` pulsing Warm Veil bars in each card's content slot. No spinner. |
| Date-range "Custom" picked | The `from` + `to` inputs slide in inline on the same row (desktop) or in a small `AdminSheet` (mobile). Inputs use the §5 Input spec; on blur the URL updates. |
| Recharts (Demand Trend) measuring 0×0 at first paint | **Fixed in this brief** — `minHeight: 288` prevents the 6 pre-existing console warnings. |
| Error in any tile (data fetch failed) | The tile renders a Cancelled family border + "Couldn't load this section. Try refreshing." inline message wrapped in `role="alert" aria-live="polite"`. Other tiles render normally. |

## 7. Interaction Model

- **Header rail.** `NotificationBell` opens an `AdminSheet` (right on desktop, bottom on mobile) listing all attention items — same data source as the Tier 1 Attention panel but unfiltered by tier. cmd-K chip opens `AdminCommandSearch` (`id="admin-command-search"` preserved).
- **Filter strip.** Preset pill click submits the GET form (`range=today` etc.); the URL changes and the page re-renders. "Custom" reveals the date inputs without an extra navigation. "More filters" opens the sheet; "Apply" submits the form with all current values; "Clear all" submits a bare URL.
- **Tier 1 Today rows.** Entire row is a link to `/admin/bookings/<id>`. No quick actions on the dashboard — quick actions live on the bookings list (per the bookings brief). This keeps the dashboard as a *triage surface* and the bookings list as the *action surface*, avoiding duplicated affordances.
- **Tier 1 Attention rows.** Entire row is a deep link to whichever surface resolves the attention item (e.g. an unconfirmed booking → `/admin/bookings/<id>`; an unassigned booking → `/admin/bookings?view=claimable`; a privacy request → `/admin/privacy`). The destination is determined server-side per item type.
- **Tier 2 disclosure.** Chevron toggles `aria-expanded`. State persists in `localStorage` keyed by user ID. Honours `prefers-reduced-motion` — instant when reduced; 240ms `ease-gentle` height transition otherwise. (Layout-property exception: this is a height transition; per the impeccable motion law we should not animate layout. Resolution: animate `grid-template-rows: 0fr → 1fr` on the disclosure container instead, which is a compositor-friendly grid transition supported in modern browsers — keeps the animation off the layout thread.)
- **Tier 2 sub-tile clicks.** Each sub-tile's trailing Ghost link navigates to the deep destination. The tile itself is not a link (avoids accidental clicks when expanding/collapsing).
- **Keyboard.** Tab order: H1 → filter presets (left to right) → "More filters" → "Export" → Tier 1 Today rows → "See all" link → Tier 1 Attention rows → "See all" → Tier 2 disclosure → Tier 2 sub-tiles in document order. All interactive elements receive a 3px Focus Azure ring with 2px offset.

## 8. Content Requirements

**Headings.**
- H1: "Today at Rahma" (never "Dashboard" — voice-anchored).
- Subtitle (no heading level): live date + locality, e.g. "Tuesday 12 May 2026 · Luton".
- Tier 1 panel titles (H2): "Today" and "Needs your attention".
- Tier 2 disclosure label (H2): "Business overview" / "Business overview (no activity yet)" when empty.
- Tier 2 sub-tile titles (H3): "Staff capacity", "Payment health", "Operations health", "Demand trend".

**Empty-state copy library** (inherited from `00-shared-components-brief.md`, extended here):

| Tile / panel | Heading | Body |
|---|---|---|
| Today panel, zero bookings | "Quiet day" | "No bookings scheduled. Quiet days are healthy days." |
| Today panel, filtered to empty range | "No bookings in this range" | (Ghost "Clear filters" link.) |
| Attention panel, zero items | "All caught up" | "Nothing needs your attention right now." |
| Staff Capacity, no active therapists | "No therapists assigned yet" | (Primary "Add staff" → `/admin/staff/new` only if `manage_staff_profiles` granted.) |
| Payment Health, no payment activity | "No payment activity" | "Payments will appear here once bookings are completed." |
| Operations Health, no events | "All systems quiet" | "No operational events flagged in the last 7 days." |
| Demand Trend, <14 days of data | "Not enough data yet" | "Trend appears after 14 days of bookings." |

**Error copy (cross-tile).** "Couldn't load this section. Try refreshing." Generic enough to not leak schema; the Sentry capture still records the real error server-side.

**Microcopy.**
- Date preset pills: "Today" · "This week" · "This month" · "Last 30 days" · "Custom"
- "More filters" button label: "More filters" with active count "More filters (3)"
- "Export" button label: "Export" (no "CSV" suffix — the destination explains itself; Stripe-style state-word discipline)
- Disclosure expand/collapse aria-labels: "Show business overview" / "Hide business overview"

**Voice anchors hit.** PRODUCT.md Voice Anchors: "verbs over nouns" (Export, Show, Hide); "real numbers and real names" (the marquee numeral is the count, not a generic "metric"); "empty states encourage" ("Quiet day" / "All caught up" / "All systems quiet" — three different encouraging copy lines, none of them "No data available"). Stripe state-word discipline applied to payment-health body ("£X outstanding", not "Pending balance").

## 9. Recommended References

- **`reference/spatial-design.md`** — for the tier-grid rhythm and the Tonal Lift cascade across Tier 1 → Tier 2 → sub-tiles.
- **`reference/interaction-design.md`** — for the date-preset filter pattern, the Tier 2 disclosure mechanics (grid-template-rows transition over height/auto), and the "More filters" `AdminSheet` flow.
- **`reference/motion-design.md`** — for the disclosure transition that avoids animating layout properties.
- **`reference/copywriting.md`** — for the empty-state and error microcopy pass at Phase 7 Gate 2 `clarify`.

## 10. Open Questions

1. **`localStorage` for the disclosure preference vs server-side per-user setting** — `localStorage` is simpler and ships in Phase 6 without a migration. A future `user_preferences` table is the proper home but is out of scope. Implementer chooses `localStorage` unless a `user_preferences` table already exists (check during Phase 6; RECON didn't flag one).
2. **The `NotificationBell` currently has `border-l-4` at `notification-bell.tsx:403`** — this brief places the bell in the header rail and removes the stripe by structural rewrite. The fix is in scope here but the same component is shared with the rest of admin (the bell appears on the dashboard only per RECON §4, but the file is shared infrastructure). Coordinate with the `00-shared-components-brief.md` rewrite so we don't double-edit.
3. **Demand Trend chart axis colours** — the existing chart uses an ad-hoc `#5b8dd9` accent. This brief switches to `accent-amber`. If Phase 6 finds that amber on Practice Panel feels too warm for a chart, fall back to Focus Azure (`oklch(47% 0.095 230)`), which is already a sanctioned non-status colour in the token palette.
4. **Admin / Practice Manager parity** — this brief asserts identical surfaces for Owner and Admin/PM. If the user wants Admin/PM to drop the "Operations Health" tile (since `manage_settings` is owner-only), flag it and we revise. Current read: Admin/PM has `manage_email_settings` per RBAC matrix, which is sufficient for the operations queue, so the tile stays.

---

**Carry-forwards this brief logs for Phase 6 implementation:**
- `dashboard-cards.tsx:128` + `:417` — `border-l-4` removal (BASELINE-CRITIQUE P1)
- `attention-group-client.tsx:144` — `bg-black` → `oklch(12% 0.014 155)` (BASELINE-CRITIQUE P2)
- `notification-bell.tsx:403` — `border-l-4` removal (BASELINE-CRITIQUE P1, structural rewrite per §5)
- `demand-trend-client.tsx` — Recharts `ResponsiveContainer` `minHeight: 288` (RECON §8)
- `dashboard-cards.tsx` — 12 hardcoded avatar hexes → deterministic-tint utility (RECON §7.6)
- `dashboard-cards.tsx` raw `#5b8dd9` chart accent + `#a8d1bd` bar fill + `bg-gray-100` / `text-gray-600` → tokens

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/dashboard/page.tsx` | Restructure into Tier 1 (Today + Urgent Attention always visible) + Tier 2 (Business Overview disclosure, collapsed by default with `localStorage`-persisted preference); pass tier composition down per role |
| `src/app/admin/dashboard/dashboard-header.tsx` | Fold `NotificationBell` into the header right rail; add live date + locality subtitle; add role badge (Restricted family pill); add cmd-K hint chip (desktop only) |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | Replace 9-field filter row with date-preset chip group (5 pills + `aria-current="page"`) + "More filters" Ghost button that opens `AdminSheet` containing the remaining 7 filters; preserve every GET `name` attribute |
| `src/app/admin/dashboard/dashboard-cards.tsx` | Remove `border-l-4` at lines 128 and 417 (structural rewrite to full-border + Pending family tint); tokenise 12 hardcoded staff-avatar hexes to deterministic `oklch(85% 0.035 var(--avatar-hue))`; replace raw `#5b8dd9` chart accent + `#a8d1bd` bar fill + `bg-gray-100` / `text-gray-600` with tokens; rebuild `UrgentAttentionPanel` per DESIGN.md §5 spec |
| `src/app/admin/dashboard/attention-group-client.tsx` | Remove `bg-black` at line 144 → `oklch(12% 0.014 155)` (brand-green-tinted dark); preserve `id="attention-dialog-title"` |
| `src/app/admin/dashboard/demand-trend-client.tsx` | Add explicit `minHeight: 288` to Recharts `ResponsiveContainer` (kills the 6 pre-existing console warnings per RECON §8); switch chart accent to `accent-amber` (`oklch(69% 0.142 72)`) with Focus Azure fallback |
| `src/app/admin/components/notification-bell.tsx` | Remove `border-l-4` at line 403 (structural rewrite); accept a `variant="header-rail"` prop so it can render compactly inside `dashboard-header.tsx`; coordinate with `00-shared-components-brief.md` to avoid double-editing |

### Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — server-side data aggregation (RECON §5)
- `src/app/admin/dashboard/dashboard-helpers.ts` — pure helpers (RECON §5)
- `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts` — tests
- `src/app/admin/shell-variant.ts` — role-to-variant resolver
- `src/lib/auth/**` — RBAC matrix, `getAdminPageAccess`, page access resolver
- `src/lib/supabase/**` — client factories
- `src/middleware.ts` — Supabase session refresh / route protection
- `supabase/migrations/**`
- All build/config files (`next.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, `tsconfig.json`, etc.)

### Feature Preservation Manifest

**GET filter form `name` attributes that must not change (RECON §2):**
`range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`

**Permission gates that must keep applying (RECON §2):**
- `getAdminPageAccess("dashboard")` ≠ none — anyone with dashboard-feeding scope
- `view_reports_revenue` — gates the Payment Health tile (Owner + Admin/PM both qualify)
- `manage_email_settings` / `manage_settings` — gates the Operations Health tile

**JS hooks / IDs to preserve (RECON §6.4):**
- `id="admin-main"` + skip-link `<a href="#admin-main">` (a11y critical)
- `id="admin-command-search"` — cmd-K palette target
- `id="attention-dialog-title"` — `aria-labelledby` target on attention dialog
- SVG `<linearGradient id="demandGradient">` — internal Recharts def, preserve

**Server actions:** none (this page is a read-only surface; all mutations live on other pages).

**Audit log writes:** none from this page.

**External / deep links to preserve (RECON §6.5):**
- POST `/admin/signout` — never a GET
- GET `/admin/reports/export?…` — the "Export" Ghost link must carry the current filter state
- Deep-link patterns: `/admin/dashboard?range=custom&from=…&to=…` must remain reachable from any saved bookmark

### Information hierarchy (top to bottom)

1. Page identity + live date + right rail (NotificationBell, cmd-K chip, role badge)
2. Filter context (date-preset chip group + "More filters" + active-filter count badge + Export)
3. Tier 1 primary surface — Today panel (left 60%) + Urgent Attention panel (right 40%)
4. Tier 2 disclosure — Business Overview (collapsed by default; expands to 2×2 grid of Staff Capacity / Payment Health / Operations Health / Demand Trend)

### Design direction — tokens and components

- **H1 "Today at Rahma":** Urbanist 600 display step, Chronicle (`oklch(11% 0.014 155)`)
- **Subtitle:** Work Sans 400 label step, Soft Slate (`oklch(42% 0.008 143)`)
- **Date-preset active pill:** `action-primary` (`oklch(23% 0.073 155)`) fill + Field White text + `aria-current="page"`
- **Date-preset inactive pill:** transparent + Practice Charcoal + Work Sans 500 label step
- **Date-preset hover:** `surface-hover` (`oklch(95.5% 0.012 155)`) tint
- **Filter strip container:** `surface-card` (`oklch(99.2% 0.004 88)`) + 1px `border-subtle` (`oklch(89% 0.014 78)`) + 8px radius
- **More filters button active count badge:** Pending family (`status-pending-bg` / `status-pending-text`)
- **Today panel:** `AdminPanel` per DESIGN.md §5 — `surface-card` background, 1px `border-subtle`, 8px radius, padding `lg` (24px)
- **Marquee numeral:** Cormorant Garamond 700, 3.157rem, Chronicle, line-height 1, letter-spacing -0.02em
- **Today panel inline status badges:** compact size (0.6875rem) for dense inline count display
- **Urgent Attention panel:** `surface-card` with **Pending family background tint** (`status-pending-bg`) + 1px `status-pending-text` border — NEVER `border-l-4`
- **Attention panel empty-state shift:** background tint switches from Pending family to Confirmed family (`status-confirmed-bg`) when count is 0
- **Tier 2 parent panel:** `surface-card` (oklch 99.2%) over canvas
- **Tier 2 sub-tiles (when expanded):** step DOWN to `surface-page` (oklch 97.8%) so they read as wells inside the parent panel — honours Tonal Lift Rule
- **Staff avatar tints:** `oklch(85% 0.035 var(--avatar-hue))` where `--avatar-hue = (index * 37) mod 360`, clamped to ranges 75–165 and 30–80 (skips purples/magentas)
- **Demand Trend chart accent:** `accent-amber` (`oklch(69% 0.142 72)`); Focus Azure (`oklch(47% 0.095 230)`) as fallback
- **Recharts `ResponsiveContainer`:** explicit `minHeight: 288` (kills pre-existing warnings)
- **Skeleton state:** `AdminSkeleton` per tile — Warm Veil pulsing bars at expected content positions; no spinner
- **Disclosure motion:** 240ms `ease-gentle` `grid-template-rows: 0fr → 1fr` transition (NOT height/auto — avoids animating layout properties); `prefers-reduced-motion: reduce` → instant
- **Focus ring:** 3px Focus Azure (`oklch(47% 0.095 230)`) with 2px offset on every interactive element

---

## Implementation Notes

Per-state intent lives in §6 Key States (above). Per-viewport intent lives in §5 Layout Strategy (above) — desktop ≥1024px rhythm with explicit mobile <768px reflow rules.

**Verification steps (for Phase 6 Step 6 verify):** Playwright + DevTools + `/impeccable audit` + `/impeccable critique`.

---

## Copy

### Form labels

Read-only dashboard. The only labelled controls are filters:
- Date-range chip group — group label `Date range` (sr-only). Chips: `Today`, `This week`, `This month`, `Last 30 days`, `Custom`.
- "Custom" reveals: `From` (date) / `To` (date).
- "More filters" sheet (all seven secondary filters): `City` (`name="city"`), `Service` (`name="service"`), `Therapist` (`name="staffId"`), `Source` (`name="source"`), `Status` (`name="status"`), `Payment` (`name="paymentStatus"`). All inputs have visible `<label>` elements.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Date preset chips | `Today` / `This week` / `This month` / `Last 30 days` / `Custom` | Pill |
| More filters trigger | `More filters` (with count) | Ghost |
| More filters apply | `Apply filters` | Secondary |
| More filters clear | `Clear all` | Ghost |
| Export | `Export` | Ghost (download icon, gated on `view_reports_revenue`) |
| Today overflow | `See all {N} for today →` | Ghost |
| Attention overflow | `See all {N} →` | Ghost |
| Tier 2 disclosure | `Show business overview` / `Hide business overview` | Ghost (chevron) |
| Payment Health overflow | `→ Open payment report` | Ghost |
| Operations Health overflow | `→ Operations` | Ghost |
| Staff Capacity overflow | `→ Staff` | Ghost |
| Demand Trend overflow | `→ Reports` | Ghost |

### Error messages

- Tile data load failure: `Couldn't load this section. Try refreshing.` (inline `role="alert"` per tile, persistent until reload)
- Custom date range invalid: `End date must be after the start date.`
- Recharts data range too narrow (<14 days): handled in empty-state copy ("Not enough data yet").
- Export click without permission (defensive — link shouldn't render): `You don't have export access.` (toast, Cancelled, persistent)
- Filter combination yields zero matching bookings: handled by Today panel empty state.
- Session refresh after permission change: `Your access has changed. Refresh to continue.` (persistent toast)

### Empty-state text

| Tile / panel | Heading | Body | CTA |
|---|---|---|---|
| Today, zero bookings | `Quiet day` | `No bookings scheduled. Quiet days are healthy days.` | — |
| Today, filtered empty | `No bookings in this range` | `Try a different date range, or clear the filter.` | `Clear filters` |
| Attention, zero items | `All caught up` | `Nothing needs your attention right now.` | — |
| Staff Capacity, no active therapists | `No therapists yet` | `Add your first therapist to start tracking capacity.` | `Add staff` (only when `manage_staff_profiles`) |
| Staff Capacity, all on leave | `Everyone's off today` | `Capacity returns when therapists are back on the rota.` | — |
| Payment Health, no activity | `No payment activity` | `Payments will appear here once bookings are completed.` | — |
| Payment Health, all paid | `All paid up` | `No outstanding balances right now.` | — |
| Operations Health, zero events | `All systems quiet` | `No operational events flagged in the last 7 days.` | — |
| Demand Trend, <14 days data | `Not enough data yet` | `The trend appears once there are at least 14 days of bookings.` | — |
| Demand Trend, load failure | `Couldn't load the trend` | `Try refreshing the page.` | `Try again` |

### Tooltip text

- Role pill ("Owner" / "Admin"): no tooltip — the pill already shows the role name; a tooltip restating it adds nothing.
- Marquee Cormorant numeral on Today panel: native `title` `{N} bookings on {date}`.
- Inline status badges in Today sub-line: `{N} {state} bookings. Select to filter.` (Only add this tooltip if the badges are individually interactive; if they are static counts, omit the tooltip entirely.)
- Attention row icon: native `title` describes the item type — `Unconfirmed booking`, `Privacy request waiting`, etc.
- Date preset chip: native `title` shows absolute range: `Today: 12 May 2026`, `This week: 12–18 May 2026`. (Enhancement only; not visible on mobile.)
- Export Ghost: `Download a CSV of bookings in this range`.
- More filters count badge: `{N} active filters`.
- Tier 2 chevron: `Show business overview` / `Hide business overview`.
- Staff Capacity stacked-bar segments: `Booked: {N}h`, `Available: {N}h`, `Blocked: {N}h`.
- Payment Health outstanding figure: `Total amount due across confirmed bookings`.
- Demand Trend bars: native `title` shows the date + count: `Mon 12 May: 6 bookings`. (Enhancement only; not visible on mobile.)
- NotificationBell: same tooltip set as Brief 00 (`No attention items` at 0, `{N} items need attention` at >0).
- cmd-K chip: `Search (⌘K)`.

### Confirmation dialog text

This page mutates nothing. No `ConfirmActionModal` instances. Tier-2 disclosure preference persists silently via `localStorage` — no confirmation needed.

**Toasts**
- Filter applied: no toast — re-render is the feedback.
- Export clicked: no toast — browser download notification is the feedback.
- Tier 2 expanded/collapsed: no toast.
