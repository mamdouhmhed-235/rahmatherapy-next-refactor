# Brief: dashboard-coordinator

## 1. Feature Summary

`/admin/dashboard` for the Booking Coordinator role — the "coordinator" variant of the role-shaped command centre. Where the Owner/Admin dashboard is a business-health surface with Today + Attention up top and four secondary tiles on disclosure, the Coordinator dashboard is a **pure front-desk triage surface**: Today + Attention always visible, and a single small Tier 2 disclosure containing the two things a Coordinator actually owns at this level — **Active Enquiries** (which today is not surfaced anywhere on the dashboard, even though Enquiries is the Coordinator's primary job) and **Operations Health** (unacknowledged operational events; same as Owner/Admin). No Payment Health, no Staff Capacity, no Demand Trend, no Export. The same chrome (header rail with NotificationBell + cmd-K + role pill, compact filter strip, two-tier disclosure) inherits from the Owner/Admin brief; the *content* of those tiers is what differentiates the variant. This honours PRODUCT.md's "One floor of ease — every role" principle: the chrome is identical so a Coordinator and an Owner can sit side by side and not have to re-learn anything; only what each one sees differs.

## 2. Primary User Action

**Open the page, see today's bookings (with unassigned ones flagged first), check the attention queue, and either assign work or convert the next pending enquiry into a booking — in that order, without leaving the dashboard's first viewport.**

## 3. Design Direction

**Colour strategy:** Full palette, content-level restrained. Identical token set to the Owner/Admin variant. Pending family carries the Active Enquiries tile (new-status enquiries are pending until contacted). Attention family carries unassigned-booking emphasis on Today rows. No gold marquee on this variant — Coordinator does not see revenue numbers and gold's only sanctioned use on this surface is the Today count, which becomes Chronicle on Coordinator (not gold). This is a deliberate restraint: gold is a brand-decoration accent the senior roles earn; Coordinator gets a more workmanlike palette.

**Theme scene sentence:** *"A Booking Coordinator at the kitchen counter at 8:30am, phone in one hand and a tea in the other, deciding which of today's unassigned bookings to assign first and which of last night's enquiries to call back before the school run."* Forces light mode, mobile-first ordering, and a primary tier that surfaces *assignment* as the day's first decision (not status, not revenue).

**Anchor references:**
- **Front Desk app's "Inbox today"** — the front-desk role surface as a *queue*, not a dashboard; what needs you next, not what is true generally
- **Notion's "Triage" template** — assignment as the first-class action; unassigned items visually distinct from assigned ones
- **Stripe Dashboard's "Disputes" landing** for a role-specific view — the same product chrome as the main dashboard, but the *content* is narrowed to one role's owned queue

Anti-anchor: the Owner/Admin variant itself with all four Tier-2 tiles visible. That's not a Coordinator's job and the surface should not pretend otherwise.

## 4. Scope

Production-ready spec for Phase 6. Booking Coordinator variant only. (Owner/Admin variant = Brief 06; Therapist variant = Brief 08, separate.) Includes: tier composition narrowing (Tier 2 drops from 4 tiles to 2), the new **Active Enquiries tile** (data pulled from existing `getEnquiriesNeedingAttention` style helper — to be added if not present), Today-panel emphasis shift toward unassigned-first ordering for this role, header rail role pill copy "Coordinator", and "Export" Ghost link hidden (revenue-gated, fails Coordinator's permission check).

**Out of scope:** All untouchables from Brief 06 (the data layer, RBAC, middleware). Also out of scope here: the Active Enquiries data fetcher itself. If it doesn't yet exist, Phase 6 adds it as a read-only helper in `dashboard-data.ts` (which RECON §5 marks untouchable, so this is a flag-and-confirm item, not a do-it-anyway item). Brief documents the UI contract; Phase 6 owner confirms whether the helper is added there or in a new colocated file.

## 5. Layout Strategy

**Page rhythm (top to bottom, desktop ≥1024px):**

1. **`AdminPageHeader`** — H1 "Today at Rahma" (same as Owner/Admin, voice-anchored, not "Coordinator dashboard"). Subtitle: live date + locality. Right rail: `NotificationBell` (24px) + cmd-K hint chip (desktop only) + role pill ("Coordinator", Restricted family). Same header-rail spec as Owner/Admin, no surface-level differences in chrome.

2. **Compact filter strip** — identical to Owner/Admin: 5 date-preset pills (Today · This week · This month · Last 30 days · Custom) + "More filters" Ghost button opening an `AdminSheet`. **The "Export" Ghost link is omitted on this variant** (revenue-gated). The "More filters" sheet exposes the same seven secondary filters as Owner/Admin; Coordinator has access to all of them per RBAC.

3. **Tier 1, primary surface (always visible).** Two-column grid on desktop ≥1280px, single-column stack below.
   - **Left column (60%): `TodayAtAGlanceCard`, Coordinator emphasis.** Top row: Cormorant numeral (Chronicle, no gold) of today's booking count + sub-line "of which N **unassigned** · N confirmed · N pending." The order is intentional: **unassigned** is the Coordinator's first decision, so it leads the inline count. Each count is a compact `AdminStatusBadge`. Below: up to 5 today rows, **sorted unassigned-first then by start time** (Owner/Admin sorts by start time only). Each row: avatar (32px, or "Unassigned" placeholder with Attention family tint when no therapist) + client name + service + start time + status pill + (new) **assignment chip** in Attention family ("Unassigned, needs same-gender therapist" when applicable) when the booking has no `assigned_staff_id`. Trailing: "See all N for today →" Ghost link to `/admin/bookings?view=today`.
   - **Right column (40%): `UrgentAttentionPanel`** — identical to Owner/Admin variant. Pending family tint, full-border, never `border-l-4`. Row composition unchanged. The data feed itself is already coordinator-scoped server-side per `dashboard-data.ts`.

4. **Tier 2, Coordinator Overview (disclosure).** Single full-width `AdminPanel`, **collapsed by default**, label "Active queues" (not "Business overview", Coordinator language). `localStorage` persistence keyed by user ID. When expanded, contains a **two-tile sub-grid** (1×2 desktop, single-column mobile):
   - **Active Enquiries tile** (new, not on current dashboard). Top: Cormorant numeral (Chronicle) of new + contacted enquiries needing follow-up. Body: 2-row excerpt, leading enquiry by recency, each row showing source icon (`phone` / `message-square` / `instagram` / `globe`) + name + Pending family chip ("New" or "Contacted") + "Convert →" Ghost link to `/admin/bookings/new?enquiryId=…`. Trailing: "→ All enquiries" Ghost link to `/admin/enquiries`. Empty state: "No active enquiries" / "Anything new will appear here when it lands."
   - **Operations Health tile** — identical to Owner/Admin variant. Same data feed, same Pending family icons, same trailing "→ Operations" link.

   Only two sub-tiles, side-by-side at 50/50 on desktop. The 4-tile 2×2 grid from Owner/Admin **collapses to 2-tile 1×2** for Coordinator. This is the *content* difference between the variants; the chrome (disclosure mechanics, tonal lift, motion, focus order) is identical.

5. **Tonal lift between tiers.** Same as Owner/Admin brief: Tier 1 cards at `surface-card` over `surface-page` canvas; Tier 2 parent panel at `surface-card`; Tier 2 sub-tiles step down to `surface-page` to read as wells.

**Mobile rhythm (<768px):** Single-column. Today first, Attention second, "Active queues" disclosure third (collapsed). When expanded on mobile, the two sub-tiles stack vertically. NotificationBell stays in header rail at 24px.

## 6. Key States

| State | What the user sees |
|---|---|
| Coordinator, first paint, populated DB | Header + filter strip + Tier 1 (Today panel with unassigned-first row order; Attention panel populated). Tier 2 disclosure collapsed. Fits in one viewport at 1440×900. |
| Coordinator, populated DB, mobile 375 | Same content stacked. Today fully visible at first paint; Attention one short scroll below. |
| Coordinator, empty DB, no bookings, no enquiries, no events | Today panel empty state ("Quiet day…"). Attention panel "All caught up." Tier 2 label reads "Active queues (nothing right now)" and chevron disabled. |
| Coordinator, today has bookings, all assigned | Today rows render in start-time order. Unassigned count in sub-line reads "0 unassigned" and renders in Confirmed family colour (subtle reward signal). |
| Coordinator, today has 3 unassigned bookings | Sub-line "3 unassigned" renders in Attention family text colour with leading `alert-circle` icon. Those 3 rows sort to the top of the Today list, each carrying the "Unassigned" assignment chip. |
| Coordinator, Tier 2 expanded | Active Enquiries + Operations Health tiles render side by side (desktop) or stacked (mobile). |
| Coordinator, Active Enquiries empty | Tile shows "No active enquiries" + "Anything new will appear here when it lands." No CTA (creating an enquiry is a separate flow, not the empty-state action). |
| Coordinator, Operations Health empty | "All systems quiet" + "No operational events flagged in the last 7 days." |
| Filter "More filters" open | Same `AdminSheet` mechanics as Owner/Admin. |
| Filtered date range with zero matching bookings | Today panel "No bookings for this range" + Ghost "Clear filters". Attention and Tier 2 ignore filters. |
| Loading | Same `AdminSkeleton` per tile. |
| Error in any tile | Same Cancelled family inline error region wrapped in `role="alert" aria-live="polite"`. |
| Coordinator, viewing as a Therapist by URL manipulation | `getAdminPageAccess` resolves a different `variant`; this brief does not render. No leakage. |

## 7. Interaction Model

Mechanics inherited from Owner/Admin brief verbatim (header rail, filter strip, Today rows as links, Attention rows as deep links, Tier 2 disclosure with `aria-expanded` + grid-template-rows transition, keyboard focus order). Coordinator-specific behaviours:

- **Today row click on an unassigned booking** → `/admin/bookings/<id>` (booking detail) where the assignment panel is the primary affordance, not the status form. (Coordinator's mental model: "I'm here to assign this.") Brief 09 (booking-detail) handles the detail page treatment; this brief only commits to the link target.
- **Active Enquiries "Convert →" link** → `/admin/bookings/new?enquiryId=<id>` with the existing pre-fill chip treatment from Brief 03 (booking-new). Single tap from dashboard to a pre-populated manual-booking wizard.
- **Active Enquiries tile click anywhere outside the "Convert" link** → `/admin/enquiries` filtered to the relevant lifecycle.
- **No "Export" Ghost link in the filter strip.** Coordinator's RBAC fails `view_reports_revenue`, so the link does not render. (Same UI shape as Owner/Admin, minus that one element.)
- **Tier 2 disclosure preference** persists in `localStorage` keyed by user ID, scoped per-variant: a user who is somehow both Coordinator and (later) elevated to Admin gets a fresh preference for the Owner/Admin layout. Single key per (user × variant).

## 8. Content Requirements

**Headings.**
- H1: "Today at Rahma" (identical to Owner/Admin).
- Subtitle: live date + locality.
- Tier 1 (H2): "Today" · "Needs your attention".
- Tier 2 disclosure label (H2): "Active queues" / "Active queues (nothing right now)".
- Tier 2 sub-tile titles (H3): "Active enquiries" · "Operations health".

**Coordinator-specific empty-state copy.**

| Tile / panel | Heading | Body |
|---|---|---|
| Today panel, zero bookings | "Quiet day" | "Nothing scheduled. Use the time to follow up on enquiries." |
| Today panel, filtered to empty range | "No bookings in this range" | (Ghost "Clear filters" link.) |
| Attention panel, zero items | "All caught up" | "Nothing needs your attention right now." |
| Active Enquiries, zero items | "No active enquiries" | "Anything new will appear here when it lands." |
| Active Enquiries, only-completed-or-converted | "All enquiries handled" | "New leads will show up here." |
| Operations Health, zero events | "All systems quiet" | "No operational events flagged in the last 7 days." |

The "Quiet day" copy on the Coordinator variant deliberately pivots to "Use the time to follow up on enquiries" (vs. Owner/Admin's "Quiet days are healthy days") because the Coordinator role has secondary work even on quiet booking days; Owner does not.

**Microcopy.**
- Inline count copy in Today panel sub-line: "of which N unassigned · N confirmed · N pending"
- Assignment chip: "Unassigned" (default); "Unassigned · same-gender required" (when `required_gender` is set on the booking)
- Role pill: "Coordinator" (Restricted family pill, Work Sans 500, label step)
- Tier 2 disclosure aria-labels: "Show active queues" / "Hide active queues"
- Convert action: "Convert →" (Ghost, Clinic Green)

**Voice anchors hit.** Verbs over nouns (Convert, Show, Hide). Real names ("N unassigned" not "Pending assignments"). Empty states encourage without preaching ("Use the time to follow up on enquiries", a verb, not a sentiment). State-word discipline on assignment chip ("Unassigned · same-gender required" makes the constraint legible without colour-only signalling).

## 9. Recommended References

- **`reference/spatial-design.md`** — for the narrowed Tier 2 grid (4-tile → 2-tile) and the unassigned-first sort emphasis on Today rows.
- **`reference/interaction-design.md`** — for the "Convert →" link target and the Coordinator's deep-link integration with `/admin/bookings/new?enquiryId=`.
- **`reference/copywriting.md`** — for the variant-specific empty-state copy pass at Phase 7 Gate 2 `clarify`.

## 10. Open Questions

1. **The Active Enquiries data fetcher.** RECON §2 lists `/admin/enquiries` as a page but does not document a dashboard-tile-shaped helper. If `dashboard-data.ts` already exports enquiry counts in the coordinator variant payload (it gates on `manage_enquiries`), Phase 6 wires the tile to that payload. If not, Phase 6 either (a) adds a small helper alongside (read-only, no mutation, no schema change) or (b) calls the same Supabase query the `/admin/enquiries` page already runs and trims to dashboard shape. Implementer decides at Phase 6 craft time.
2. **`bookingId` link target intent.** This brief asserts that clicking an unassigned today-row should land on the booking detail page with the assignment panel visually prioritised. That UI commitment lives in the Brief 09 booking-detail brief, not here, but it must hold up there. Flagging for cross-brief consistency.
3. **Should the Coordinator dashboard ever surface an "Unassigned bookings older than today" warning?** The Attention panel server-side data feed may or may not include this; depends on `getNotificationsForVariant`. If it doesn't, that's a Phase 6 gap to flag, Coordinator's job depends on it. Leaving open until the implementer can read the data shape.
4. **Tier 2 collapsed by default, is that right for Coordinator?** Argument for: same chrome as Owner/Admin (consistency = "one floor of ease"). Argument against: Coordinator's enquiries tile is a *primary* surface for the role, not a secondary one, and burying it behind a disclosure may bury the role's main job. Counter-argument: enquiries is a separate top-nav route already; the dashboard tile is a glance, not a workspace. **Current call:** collapsed by default with `localStorage` persistence (same as Owner/Admin) so the user can pop it open once and it sticks. Revisit if Phase 7 testing shows Coordinators are missing the enquiries signal.

---

**Carry-forwards this brief logs for Phase 6 implementation:**
- All carry-forwards from Brief 06 apply (`border-l-4` removal, `bg-black` removal, Recharts `minHeight`, avatar tokenisation, chart-colour tokens). Phase 6 fixes them once across `dashboard-cards.tsx` and the fix lands for every variant.
- New for this variant: the Active Enquiries tile component (likely lives in `dashboard-cards.tsx` as a new export, e.g. `ActiveEnquiriesCard`).
- New for this variant: Today panel row sorter accepts an `unassignedFirst` boolean (default false for Owner/Admin; true for Coordinator).
- "Export" Ghost link in `dashboard-filters-client.tsx` becomes conditional on `view_reports_revenue` (already gated server-side; this just ensures the UI doesn't render it for Coordinator).

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/dashboard/page.tsx` | Coordinator-variant tier composition: same Tier 1 (Today + Urgent Attention) as Owner/Admin; Tier 2 narrowed to 2 tiles (Active Enquiries + Operations Health); no Payment Health, no Staff Capacity, no Demand Trend. `showStaffCapacity`/`showPaymentHealth` gates already false for coordinator at lines 490–494; this brief commits the UI to that shape. |
| `src/app/admin/dashboard/dashboard-cards.tsx` | New export: `ActiveEnquiriesCard` component (Cormorant numeral count + 2-row excerpt + "Convert →" Ghost link + "→ All enquiries" trailing link). Today panel row sorter accepts `unassignedFirst: boolean` and renders the assignment chip in Attention family when a row has no `assigned_staff_id`. All Brief-06 carry-forward fixes (`border-l-4` at lines 128/417, hardcoded avatar hexes, raw chart colours) land here once for all variants. |
| `src/app/admin/dashboard/dashboard-header.tsx` | Role pill copy resolves from `getDashboardCopy(plan.variant).rolePill` (existing copy helper at line 375); for coordinator variant the pill reads "Coordinator" in Restricted family. NotificationBell, cmd-K hint chip placement identical to Owner/Admin. |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | "Export" Ghost link rendered conditionally on `view_reports_revenue` permission (already evaluated by `permissionAccess.revenue` at line 493). Date-preset chip group + "More filters" sheet identical to Owner/Admin. |
| `src/app/admin/dashboard/attention-group-client.tsx` | `bg-black` at line 144 → `oklch(12% 0.014 155)` (Brief-06 carry-forward; lands once for all variants). Preserve `id="attention-dialog-title"`. |
| `src/app/admin/dashboard/demand-trend-client.tsx` | **Not rendered for coordinator variant** (no Demand Trend tile). Brief-06 carry-forwards still apply when this component renders for Owner/Admin. |
| `src/app/admin/components/notification-bell.tsx` | `border-l-4` removal at line 403 (Brief-06 carry-forward; structural rewrite to header-rail variant). Coordinate with `00-shared-components-brief.md`. |

### Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — server-side aggregation, including `coordinator` variant resolution at line 124. If Active Enquiries needs a new data shape, flag in Open Questions and let Phase 6 owner decide whether to extend this file or add a colocated helper.
- `src/app/admin/dashboard/dashboard-helpers.ts`
- `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts`
- `src/app/admin/shell-variant.ts` (`resolveAdminShellVariant`)
- `src/app/admin/enquiries/actions.ts` — enquiry mutations stay in their own route
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts`
- `supabase/migrations/**`
- All build/config files

### Feature Preservation Manifest

**GET filter form `name` attributes that must not change (RECON §2):**
`range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`

**Permission gates that must keep applying (RECON §2):**
- `getAdminPageAccess("dashboard")` ≠ none — Coordinator has dashboard scope via `manage_bookings_all`/`manage_bookings_assigned` and `manage_enquiries`
- `view_reports_revenue` — must remain **false** for Coordinator; Payment Health and Export Ghost link both gate on this
- `manage_staff_profiles` — must remain false for Coordinator; Staff Capacity gates on this via `permissionAccess.staff`
- `manage_enquiries` — gates the new Active Enquiries tile; Coordinator has this; Owner/Admin also have it but the tile is variant-scoped to Coordinator
- `manage_settings` / `manage_email_settings` — gates Operations Health (Coordinator has neither by default per PRODUCT.md, **but** the current code gates Operations Health on `plan.variant !== "therapist"` at line 494, which would include Coordinator). Flag in Open Questions: is Operations Health really a Coordinator surface? Current call: yes, because the existing data layer already surfaces it; revisit if the Coordinator role does not actually have access to `/admin/operations` and the deep link 404s.

**JS hooks / IDs to preserve (RECON §6.4):**
- `id="admin-main"` + skip-link `<a href="#admin-main">` (a11y critical)
- `id="admin-command-search"` (cmd-K palette target)
- `id="attention-dialog-title"` (`aria-labelledby` target)
- SVG `<linearGradient id="demandGradient">` (not rendered for Coordinator, but preserve when rendered for Owner/Admin)

**Server actions:** none from this page (read-only surface; all mutations live on `/admin/bookings/*` and `/admin/enquiries/*`).

**Audit log writes:** none from this page directly.

**External / deep links to preserve (RECON §6.5):**
- POST `/admin/signout` (never a GET)
- Deep-link patterns: `/admin/dashboard?range=custom&from=…&to=…` reachable for Coordinator
- New deep-link target: `/admin/bookings/new?enquiryId=<id>` (from the Active Enquiries "Convert →" Ghost link, integrates with Brief 03's pre-fill chip treatment)
- `/admin/bookings?view=today` (from Today panel "See all" link)
- `/admin/enquiries` (from Active Enquiries tile trailing "→ All enquiries" link)
- `/admin/operations` (from Operations Health trailing link)
- `/admin/reports/export?…` — **not rendered for Coordinator** (revenue-gated)

### Information hierarchy (top to bottom)

1. Page identity + live date + right rail (NotificationBell, cmd-K chip, "Coordinator" role pill)
2. Filter context (date-preset chip group + "More filters" + active-filter count badge; no Export link)
3. Tier 1 primary surface — Today panel (unassigned-first sort, 60% column) + Urgent Attention panel (40% column)
4. Tier 2 disclosure — "Active queues" (collapsed by default; expands to 1×2 grid of Active Enquiries + Operations Health)

### Design direction, tokens and components

- **Header pieces:** identical token set to Brief 06 (Urbanist 600 H1 / Work Sans 400 subtitle / Restricted family role pill).
- **Date-preset chips:** identical to Brief 06.
- **Tier 1 cards:** identical to Brief 06.
- **Today panel inline count:** "of which N unassigned · N confirmed · N pending" — unassigned count uses Attention family text colour when > 0 (with leading `alert-circle` 12px), Confirmed family when = 0.
- **Today panel row, unassigned variant:** avatar slot renders a 32px Hover Moss placeholder circle with a centred `user-x` 16px icon (Attention family text colour). Row trailing carries an **assignment chip** in Attention family colour pair (`status-attention-bg` / `status-attention-text`) reading "Unassigned" or "Unassigned · same-gender required".
- **Today panel marquee numeral:** Cormorant Garamond 700, 3.157rem, **Chronicle** (not gold; gold is reserved for Owner/Admin variant on this surface).
- **Urgent Attention panel:** Pending family background tint + 1px Pending text border (Brief 06 spec; NEVER `border-l-4`). Empty-state shift to Confirmed family at count = 0.
- **Tier 2 parent panel:** `surface-card` over canvas; label "Active queues" in Urbanist 600 title step + trailing `chevron-down` toggle.
- **Tier 2 sub-tiles:** step down to `surface-page` (Tonal Lift Rule).
- **Active Enquiries tile:** `surface-page` background; H3 "Active enquiries" Urbanist 500 title step; Cormorant numeral 1.778rem Chronicle; row body Work Sans 400 body step; source icon 16px Lucide (`phone` / `message-square` / `instagram` / `globe`) `aria-hidden="true"`; lifecycle chip in Pending family ("New" / "Contacted") — both states are pending until converted; "Convert →" Ghost link Clinic Green Work Sans 500 label step; trailing "→ All enquiries" Ghost link Clinic Green.
- **Operations Health tile:** identical to Brief 06.
- **Disclosure motion:** 240ms `ease-gentle` `grid-template-rows: 0fr → 1fr` (compositor-friendly, does not animate height/auto); `prefers-reduced-motion: reduce` → instant.
- **Skeleton:** `AdminSkeleton` per tile.
- **Focus ring:** 3px Focus Azure with 2px offset on every interactive element.

---

## Implementation Notes

Per-state intent lives in §6 Key States (above). Per-viewport intent lives in §5 Layout Strategy (above), desktop ≥1024px rhythm with explicit mobile <768px reflow rules.

**Verification steps (for Phase 6 Step 6 verify):** Playwright + DevTools + `/impeccable audit` + `/impeccable critique`.

---

## Copy

### Form labels

This is a read-only dashboard. The only labelled controls are the filter strip (shared spec with Brief 06 dashboard-owner-admin):
- Date-range chip group — group label `Date range` (sr-only). Chips: `Today`, `This week`, `This month`, `Last 30 days`, `Custom`.
- "Custom" → `From` (date) / `To` (date).
- "More filters" sheet (same fields as Owner/Admin): `City`, `Service`, `Therapist`, `Source`, `Status`, `Payment`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Date preset chips | `Today` / `This week` / `This month` / `Last 30 days` / `Custom` | Pill |
| More filters trigger | `More filters` (with count) | Ghost |
| More filters apply | `Apply filters` | Secondary |
| More filters clear | `Clear all` | Ghost |
| Today panel overflow | `See all {N} for today →` | Ghost |
| Attention panel overflow | `See all {N} →` | Ghost |
| Tier 2 disclosure | `Show active queues` / `Hide active queues` | Ghost (chevron) |
| Active Enquiries per-row | `Convert →` | Ghost |
| Active Enquiries overflow | `→ All enquiries` | Ghost |
| Operations Health overflow | `→ Operations` | Ghost |

### Error messages

- Tile data load failure: `Couldn't load this section. Try refreshing.` (inline `role="alert"` per tile)
- Custom date `from` after `to`: `End date must be after the start date.`
- Filter combination returns nothing: handled by per-panel empty states (no toast).
- Stale enquiry on "Convert" click (404): `That enquiry is no longer open. Refresh to see the updated list.` (toast, persistent)
- Permission revoked mid-session: `Your access has changed. Refresh to continue.` (persistent toast)

### Empty-state text

| Tile / panel | Heading | Body | CTA |
|---|---|---|---|
| Today, zero bookings | `Quiet day` | `Nothing scheduled. Use the time to follow up on enquiries.` | `Open enquiries` |
| Today, filtered to empty range | `No bookings in this range` | `Try a different date range, or clear the filter.` | `Clear filters` |
| Today, all assigned | (inline sub-line, no full empty state) | `All of today's bookings have therapists.` | — |
| Attention, zero items | `All caught up` | `Nothing needs your attention right now.` | — |
| Active Enquiries, zero | `No active enquiries` | `Anything new will appear here when it lands.` | — |
| Active Enquiries, all handled | `All enquiries handled` | `New leads will show up here.` | — |
| Operations Health, zero events | `All systems quiet` | `No operational events flagged in the last 7 days.` | — |

### Tooltip text

- Role pill ("Coordinator"): `Your role on Rahma Admin`.
- Today count Cormorant numeral: native `title` shows `{N} bookings on {date}`.
- Unassigned sub-line count: `These bookings need a therapist`.
- "Unassigned" assignment chip on row: `Open the booking to assign a therapist`.
- "Unassigned · same-gender required" chip: `Needs a same-gender therapist`.
- Source icon in Active Enquiries row: `From {source}` (e.g. `From WhatsApp`).
- Lifecycle chip ("New" / "Contacted"): `New: hasn't been contacted yet` / `Contacted: a response is pending`. (Enhancement only; not visible on mobile.)
- "Convert →" Ghost: `Open the booking form with this enquiry pre-filled`.
- Tier 2 chevron: `Show active queues` / `Hide active queues`.
- Date preset chip: native `title` shows absolute range: `Today: 12 May 2026`, `This week: 12–18 May 2026`. (Enhancement only; not visible on mobile.)
- NotificationBell (count 0): `No attention items`.
- NotificationBell (count > 0): `{N} items need attention`.

### Confirmation dialog text

This page mutates nothing. No `ConfirmActionModal` instances. All confirmations live on the destination pages reached by the panels' links.

**Toasts**
- Filter applied: no toast — page re-render is the feedback.
- Stale enquiry on Convert: `That enquiry is no longer open. Refresh to see the updated list.` (persistent, Refresh Ghost).
