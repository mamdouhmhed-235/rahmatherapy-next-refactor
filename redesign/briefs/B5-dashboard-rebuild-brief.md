# Brief: B-5 — Dashboard rebuild (`/admin/dashboard`)

**Phase:** B-5 (largest UI surface; ships last)
**Estimated effort:** ~3 days
**Brief status:** session-4 reframe; user-confirmed; supersedes `dashboard-owner-admin-brief.md`, `dashboard-coordinator-brief.md`, `dashboard-therapist-brief.md` (all three)
**Plan:** `redesign/plans/B-phase/B5-dashboard-rebuild-plan.md`
**Prerequisites:** B-1 (primitives) + B-2 (helpers) shipped; B-3 + B-4 ideally shipped (visual-language consistency)

---

## 1. Feature Summary

The most-visited admin surface, rebuilt from scratch — not polished. Strips the dashboard back to *operational triage only*: Today + Attention + Operations Health up top, with a thin role-aware Personal Contribution stripe leading the page so every operator sees their own slice immediately. The current Tier-2 disclosure (Business Overview with 4 sub-tiles) is removed entirely — its data has a better home on Reports (B-4). Operations Health is promoted from buried inside the disclosure to a primary-tier panel. `BusinessPulseCard` (Service mix + Client mix) is removed and lands in B-4's Activity section. M2 (Operations Health per-row hrefs) and M3 (Therapist ClaimableCard inline ClaimAssignmentButton) papercuts close in-flight. Mobile gains a sticky bottom action bar, pull-to-refresh, and swipeable today cards. All three role variants (business / coordinator / therapist) preserved; their differences become *content* (which tiles render) not *chrome* (the layout is identical, the variant decides what fills each slot). Every tile uses B-1 primitives; severity tints use the new strong tokens; numerals are Cormorant marquees with sparkline + delta tails.

## 2. Primary User Action

**Open the dashboard, see (in this order, top to bottom): my own numbers · what's happening today · what needs my attention · what's broken operationally. Take the one most-likely action without navigating away. Hand off to deeper pages (Reports, Bookings, Staff, Performance) only when I want depth.**

For mobile: **open the app one-handed in a moving vehicle, see my next visit, tap "Call client" or "Open in Maps" from the sticky bottom bar, never having to scroll the full page.**

## 3. Design Direction

**Colour strategy:** Warm and confident. Lead with Personal Contribution stripe in subdued Soft Slate (not loud — it's the operator's calm summary). Today's bookings carry status-family pills (Confirmed mint, Pending amber, Cancelled coral). Urgent Attention panel uses the new `--admin-warning-bg-strong` for tile background — the previous 0.30 tint was too washed out. Operations Health priority list uses severity-strong banding. Owner variant lead numeral (Today's booking count) stays Cormorant marquee at `clamp(3rem, 6vw, 5.5rem)` with gold accent dot only when unconfirmed bookings exist (preserved from Phase 6's editorial-warm rebuild). Therapist variant gets quieter palette — the Next Visit hero is the only Cormorant moment; everything else is restrained Urbanist.

**Theme scene sentence:** *"It's Monday 8:30am. Fatimah opens the dashboard on her iPad: she sees she did 22 hours last week and brought in £540, that today has 8 bookings of which 2 are unassigned (the gold dot is visible), that 3 things need her attention, and that one operational event needs acknowledging. She handles the unassigned bookings first, then the operations event, and is done by 8:42am."* Forces personal-stripe-first, forces operational triage to dominate the page, forces the page to *complete* in under 15 minutes of operator time.

**Anchor references:**
- **Linear "My Issues" landing** — focused primary surface, no wall of cards
- **Basecamp 4 "Hey!"** — single calm column, respects the operator
- **Front desk app "Inbox today"** — queue, not dashboard, for the Coordinator variant
- **Uber driver app "Next trip"** — single prominent next-action card for the Therapist variant
- **Stripe Dashboard "Today"** — for the Personal Contribution stripe rhythm (tile + delta + sparkline)
- **Calendly mobile "Today's events"** — for the mobile sticky action bar and swipeable today cards pattern

Anti-anchor: the current Phase-6 dashboard — Tier-2 disclosure collapsed makes the page feel hollow; muted severity tints fail to demand attention; BusinessPulseCard at the bottom feels like dead furniture; jagged card sizes across the variants.

## 4. Scope

**In:**

### Routes
- `/admin/dashboard` — wholesale rebuild. Same route, new content tree.

### Variant resolution
- Preserved: `resolveAdminShellVariant(profile)` returns `business | coordinator | therapist` (existing contract).
- Variant determines:
  - Which tiles render in the Personal Contribution stripe
  - Today panel emphasis (unassigned-first for Coordinator; chronological for Business/Therapist)
  - Operations Health visibility (visible for business + coordinator; hidden for therapist)
  - Mobile sticky action bar content
- Variant does NOT determine layout — all three variants share the same shell.

### Content tiers (top → bottom)

1. **Page header** — H1 + sub-line + right rail. Existing `DashboardHeader` restyled (no rebuild of the component itself; it already houses date label / role pill / cmd-K). NotificationBell remains in global `AdminTopNav` (R4 — untouched).

2. **Personal Contribution stripe (NEW)** — 4 `<MetricRow>` instances in a horizontal strip. Role-aware content (per variant table in §5). Calls `getStaffScorecard(data, profile.id)` from B-2; dropdown to choose period (today / this week / this month, default this week).

3. **Filter strip** — existing strip, restyled to use B-1 tokens. Date-preset chips + More filters + Export (Owner/Admin only, gated on `view_reports_revenue`).

4. **Tier 1: Today + Attention** — two-panel grid xl, stacked below.
   - Left (60% xl): Today panel per variant.
   - Right (40% xl): Urgent Attention panel.

5. **Tier 1.5: Operations Health (NEW position)** — full-width panel, business + coordinator only. Previously inside Tier-2 disclosure; promoted to primary tier. Therapist variant: hidden.

6. **Therapist-only Tier 2: Claimable work strip** — full-width panel with horizontal scroll on mobile / 3-card grid on desktop. Each card now includes inline `<ClaimAssignmentButton>` (M3 fix). Visible for therapist variant; hidden for business + coordinator.

7. **Therapist-only Tier 3: Quiet weekly summary** — small panel. `<MetricRow>` "This week (N visits) · {hours} worked". Linked to `/admin/me?range=this_week`.

### Mobile additions
- **Sticky bottom action bar** — `fixed bottom-0 inset-x-0 z-40` panel with one or two primary CTAs based on variant.
- **Pull-to-refresh** at full-page top — triggers `router.refresh()` (Next.js).
- **Swipeable today cards** — Today panel rows on mobile become a horizontal snap-scroll strip; full list still available via "View all today's bookings →" link.

### Removals (compared to current dashboard)
- **`BusinessPulseCard`** (Service mix + Client mix) — removed entirely from dashboard; relocates to B-4 Reports Activity section.
- **Tier-2 Business Overview disclosure** — removed. Staff Capacity + Payment Health + Demand Trend + Operations Health were the four sub-tiles; Ops Health promotes to Tier 1.5; Staff Capacity + Payment Health + Demand Trend become Reports concerns (already covered by B-4's headline tile strip + Money section).
- **The Mix Snapshot slim strip** (Service & Client) below Tier 2 — removed.
- **The cmd-K hint chip "Search (⌘K)"** in the header right rail — preserved (still useful).
- **The "Search business overview" `localStorage` preference** — removed (disclosure removed; preference irrelevant).

### Papercuts closed
- **M2**: `OperationsHealthCard` priority list rows now carry per-row `href` (failed email row → `/admin/emails`, ops event row → `/admin/operations`, availability row → `/admin/staff`). The "View →" Ghost link per row uses the row-specific href, not the panel default.
- **M3**: Therapist `ClaimableCard` claimable rows gain inline `<ClaimAssignmentButton assignmentId={...} />` (existing component from `bookings/`). Per AUDIT-2026-05-22 C4: the component takes `assignmentId` (NOT `bookingId`) and runs an optimistic-claim flow with a sonner toast on success — no confirm modal exists. The optimistic visual lock (button → "Claimed" disabled state) is the only accidental-claim safety net. If accidental claims become a problem in practice, a confirm modal can be added as a Phase 7 enhancement.

**Out:**
- **Staff goals on the dashboard** — out per user decision (no goals at all this round).
- **AI-generated coaching** — out.
- **Real-time-via-realtime updates of booking counts** — V1.1.
- **Drag-to-rearrange tile order** — Phase 7 candidate; not blocking.
- **Per-user dashboard customisation** ("hide this tile") — Phase 7 candidate.
- **Dashboard widget marketplace** — out forever.
- **Calendar embed on dashboard** — out (Calendar has its own page).

## 5. Layout Strategy

**Desktop (≥1280px) page rhythm — applies to all three variants:**

```
┌───────────────────────────────────────────────────────────────┐
│ DashboardHeader (H1 · subtitle · role pill · cmd-K hint)       │
├───────────────────────────────────────────────────────────────┤
│ PERSONAL CONTRIBUTION STRIPE                                  │
│  ┌──────────┬──────────┬──────────┬──────────┐                │
│  │ <MetRow> │ <MetRow> │ <MetRow> │ <MetRow> │                │
│  └──────────┴──────────┴──────────┴──────────┘                │
├───────────────────────────────────────────────────────────────┤
│ Filter strip (chips · More filters · Export·)                  │
│ Active filter chips row                                       │
├──────────────────────────────────┬────────────────────────────┤
│ Today panel (60%)                │ Urgent Attention (40%)     │
├──────────────────────────────────┴────────────────────────────┤
│ Operations Health (full-width)  [business + coordinator only] │
├───────────────────────────────────────────────────────────────┤
│ Claimable work strip   [therapist variant only]               │
│ Quiet weekly summary   [therapist variant only]               │
└───────────────────────────────────────────────────────────────┘
```

**Mobile (<768px) page rhythm:**

```
┌──────────────────────────────┐
│ DashboardHeader              │
├──────────────────────────────┤
│ Personal Contribution stripe │
│ (2×2 grid)                   │
├──────────────────────────────┤
│ Filter chips (h-scroll)      │
├──────────────────────────────┤
│ Today panel                  │
│ (swipeable card strip)       │
├──────────────────────────────┤
│ Urgent Attention             │
├──────────────────────────────┤
│ Operations Health  [bc]      │
├──────────────────────────────┤
│ Claimable strip      [t]     │
│ Weekly summary       [t]     │
└──────────────────────────────┘
[ STICKY BOTTOM ACTION BAR ]
```

### 5.1 Personal Contribution stripe (NEW; all variants)

`<PersonalContributionStripe>` — horizontal strip of 4 `<MetricRow>` from B-1.

Per variant tile sets (all values come from `getStaffScorecard(data, profile.id, priorData)` from B-2; period defaults to "this week" but configurable via a small picker at strip right):

| Variant | Tile 1 | Tile 2 | Tile 3 | Tile 4 |
|---|---|---|---|---|
| **Business** (Owner/Admin) | My bookings today (own; `scorecard.clinical.assignmentsCompleted` for today) | My contribution this week (own; `scorecard.clinical.assignmentsCompleted` + `scorecard.admin.bookingsAssignedCount`) | My revenue this week (own; `scorecard.clinical.revenueAttributed`) | Open attention items (business-wide; the operational handle stays clinic-wide) |
| **Coordinator** | Today's unassigned to clear | Enquiries handled this week (mine) | My conversion rate | Active attention items |
| **Therapist** | Next visit (time + client first name) | Today's visits count | My hours this week | My clients this month |

Each `<MetricRow>` has its mini-sparkline if a time series is meaningful; "Next visit" tile renders the time + client name instead. Period picker (top-right of stripe) cycles `today / this week / this month`. Stripe collapses to 2×2 grid on mobile.

### 5.2 Filter strip (per variant)

- Business + Coordinator: full filter strip (Today / This week / This month / Last 30 days / Custom + More filters + Export). Export visible only when `view_reports_revenue` (Owner/Admin/PM).
- Therapist: narrowed to date-range chips only (Today · Tomorrow · This week · Custom). No More filters. No Export.

### 5.3 Today panel (per variant)

Always `<AdminPanel>` with `surface-card` background, padding `lg`.

**Business variant:**
- Eyebrow: `SNAPSHOT · {RANGE LABEL}` (Soft Slate)
- Marquee numeral: today's booking count, Cormorant 700 `clamp(3rem, 6vw, 5.5rem)` Chronicle + gold accent dot if any unconfirmed
- Sub-line: "of which N confirmed · N pending · N completed" with inline `AdminStatusBadge`s
- 7-day sparkline (pure SVG) below the numeral
- Up to 5 today rows (compressed `BookingListCard`): avatar + client name + service + time + status pill. Whole row is `<Link>` with hover-lift.
- Trailing: "View all N for today →" Ghost link
- Day readiness ribbon: condensed inline `READY` eyebrow + 3 `ReadinessChip` (Confirmations / Coverage / Payments) — preserved from Phase 6's editorial-warm rebuild

**Coordinator variant:**
- Same chrome as Business + emphasis on unassigned:
  - Sub-line leads with "N **unassigned** · N confirmed · N pending"; unassigned count in Attention family text colour with leading `alert-circle`
  - Today rows sorted **unassigned-first**, then by start time
  - Each unassigned row carries an "Unassigned" assignment chip (Attention family); when `required_gender` is set, the chip reads "Unassigned · same-gender required"

**Therapist variant: Next Visit hero** (replaces the Today panel; bigger, more decorated)
- Eyebrow: "Next visit" (or "Tomorrow's first visit" / "First visit back" per existing logic)
- Primary line: client first name + service name (Urbanist 600 title step on mobile, heading step on desktop)
- Time + duration line: Cormorant Garamond 700 `1.778rem` "11:45 · 60 min" (the only Cormorant on this variant)
- Address block: full address + postcode + city (Work Sans 400)
- Two side-by-side Ghost buttons (44px touch target): "Open in Maps" (Maps deep-link), "Call client" (`tel:`)
- Gender-match chip when applicable (Restricted family pill)
- Customer notes block (open by default; max-h 8em mobile / 12em desktop)
- Trailing: full-width Primary "Open booking" button → `/admin/bookings/{id}`
- Below the hero: "Today's visits" H2 + up to 5 row list (same compressed `BookingListCard` pattern)

### 5.4 Urgent Attention panel (all variants)

`<UrgentAttentionPanel>` — Pending family background tint using **`--admin-warning-bg-strong`** (NEW; stronger than current `bg`):
- Header: "Needs your attention" + count badge
- Up to 5 attention rows. Each row: 16px lucide icon (severity-coloured) + description + date chip + trailing chevron, entire row is a deep link
- "See all N →" Ghost link bottom
- Empty state: smaller illustration + "All caught up. Nothing needs your attention right now." Background tint switches from Pending family to Confirmed family on empty.

### 5.5 Operations Health panel (NEW position; business + coordinator)

Promoted from Tier-2 disclosure to primary tier (Tier 1.5 — between Tier 1 and the Therapist-only Tier 2/3). Full-width.

- Header: "Operations Health" + overall severity banner (tinted by worst severity in the priority list)
- Severity-weighted priority list — each row uses the new `--admin-{severity}-bg-strong` tokens for a stronger emphasis than current.
- **M2 fix**: each row carries `href` derived from row type (failed email → `/admin/emails`, ops event → `/admin/operations/{eventId}`, availability gap → `/admin/staff/{staffId}?tab=availability`).
- Footer: "ALL CLEAR: {labels}" line consolidating any clear items (preserved from Phase 6).

### 5.6 Therapist variant — fullness pass (AUDIT-2026-05-22 M1)

The user explicitly flagged: "Therapist variant looks empty when no data — should feel production-ready, never rudimentary." The original brief left the variant prone to a near-blank screen when DB is sparse (no bookings, no claimable work). This section adds 5 content blocks that render meaningfully even on quiet days, so the variant always feels full and operationally useful.

**Empty-state philosophy (codified):** "Empty" never means "blank screen." It means "the operational data slots are zero, but the surrounding scaffolding is full and actionable." Every empty section produces one of: an explanation, an actionable CTA, a tip, or a milestone — never just "—" or "No data."

The Therapist variant page rhythm (top → bottom) becomes:

1. **`DashboardHeader`** — H1 + sub-line (existing).
2. **Profile-readiness banner** — `<ProfileCompletionNudge>` (existing component, behaviour preserved). Per AUDIT-2026-05-22 Q1 (tone match): no celebratory pill added. The banner hides on completion as today; the page below it carries the content density. The original gamification-tinted ★★★★★ pill is dropped — too playful for the existing calm/professional admin voice ("disciplined warmth" per PRODUCT.md).
3. **Personal Contribution stripe** — 4 `<MetricRow>` tiles per §5.1 (Therapist tile set). Render zero values gracefully (not "—").
4. **Highlight / Tip strip (NEW; tone-refined per AUDIT-2026-05-22 Q1)** — Single-row `<MetricRow>`-shaped block. Calm, factual voice that matches the existing admin tone — no gamification language ("best month yet"), no trophy/star icons. Content priority:
   - First: if `getTherapistHighlight(scorecard, priorScorecard, profile)` returns a data-driven highlight, show it. Icon: `TrendingUp` (lucide). Library (factual phrasing):
     - "Last month: {N} visits completed. Highest in 3 months." (when trend confirms)
     - "Currently averaging {Y}% utilisation — above your 6-week trend." (when above-average)
     - "{N} same-gender requests fulfilled this week."
     - "First visit completed — welcome to the rota." (single, welcoming line for brand-new)
     - "Steady week: {N} visits completed with no cancellations." (when applicable)
   - Else: rotate to a working-tip from a deterministic library (picked by `profile.id` hash modulo library length — stable per session). Icon: `Lightbulb` (lucide). Library:
     - "Tip: Tap a Next Visit address to open Maps directly."
     - "Tip: Pull down to refresh the dashboard."
     - "Tip: Claim a booking from the strip below — first to claim wins."
     - "Tip: Mark a session complete from the booking detail page after each visit."
     - "Tip: Set your availability under Staff → My availability to control bookings."
   - Implementation: pure helper `getTherapistHighlightOrTip(scorecard, priorScorecard, profile)` returning `{ icon: 'TrendingUp' | 'Lightbulb', message: string }`. Single line, ~60–90 characters target.
5. **Next Visit hero** — when data exists. When no upcoming visit, the hero collapses to a smaller empty-state panel that LINKS into block 6 (the Claimable strip) and block 9 (My availability) so the operator sees what to do.
6. **Today's visits list** — when data exists. Hidden when only the hero is the day's visit (already specced).
7. **Open invitations to claim strip (PROMOTED when Today is empty)** — `<ClaimableStrip>` with Attention family background.
   - When Today's visits + Next Visit are both empty, this strip moves UP in the visual hierarchy (above blocks 5/6's collapsed state) and uses the new `--admin-warning-bg-strong` token to invite engagement.
   - When Today is populated, this stays in its current secondary position.
   - Mobile: horizontal snap-scroll, up to 5 cards.
   - Desktop ≥1024px: 3-card grid + "See all N →" Ghost link.
   - Each card: client first name + service + start time + date + "Available" chip + **`<ClaimAssignmentButton assignmentId={...} />`** (M3 fix, per AUDIT-2026-05-22 C4 — takes `assignmentId` NOT `bookingId`; optimistic-claim with sonner toast, NOT a confirm modal).
   - Empty state: "Nothing open right now. Check back later or set your availability to surface more openings."
8. **My recent clients (NEW)** — strip of last 6 unique clients seen in the last 30 days. Horizontal scroll on mobile / 4-card grid on desktop. Each card: avatar + first name + service last delivered + days-since-last-visit. Tap → client detail page. Pulls from `data.bookings.filter(b => b.client_id && b.status === 'completed' && b.booking_date >= last30days)`, dedup by `client_id`, sorted by most recent.
   - Empty state: hides entirely (brand-new therapist with no completed visits in the last 30 days).
   - Important: respects existing Therapist RBAC — only clients the Therapist has been assigned to.
9. **Quiet weekly summary** — `<MetricRow>` "This week (N visits) · about Nh worked". Linked to `/admin/me?range=this_week`.
10. **Quick help / resources panel (NEW)** — Bottom of page (above mobile sticky bar safe-area). Single small panel "Need help?" with 3 Ghost links (filtered to what the Therapist can reach):
    - "Update my profile" → `/admin/staff/{staffId}` (if `canEditOwnProfile`, else hidden)
    - "Set my availability" → `/admin/staff/{staffId}/availability` (if `canEditOwnAvailability`, else hidden)
    - "Browse claimable work" → `/admin/bookings?view=claimable` (when claimable RBAC granted)
    - "View my completed visits" → `/admin/bookings?view=completed&staffId={staffId}`
    - Always renders at least one link; hides the panel entirely only when every link would be denied (essentially impossible for an active Therapist).

**Result:** even with zero bookings and zero claimable work, the Therapist variant shows: header → profile banner → 4 zero-but-formatted tiles → milestone/tip strip → empty-state hero linking onward → "Nothing open right now" Claimable strip (still informative) → (recent clients hidden if applicable) → Weekly summary → Quick help panel → mobile sticky bar with "Set my availability" fallback action. **5+ meaningful content blocks. The page never reads "blank."**

### 5.7 Quiet weekly summary (therapist variant)

Same as §5.6 block 9. Listed separately for grep-ability.

### 5.8 Mobile sticky bottom action bar

`fixed bottom-0 inset-x-0 z-40 bg-[var(--admin-panel)] border-t border-[var(--admin-border)] p-3 safe-area-padding-bottom`. Content per variant. **Per AUDIT-2026-05-22 Q5: Therapist gets a meaningful fallback action ladder instead of hiding when no Next Visit.**

| Variant | Primary action | Fallback (when primary unavailable) | Hidden when |
|---|---|---|---|
| Business | "Assign N unassigned →" → `/admin/bookings?view=unassigned`. | (none) | N unassigned = 0 |
| Coordinator | "Assign N unassigned →" → `/admin/bookings?view=unassigned`. | (none) | N unassigned = 0 |
| Therapist | "Open in Maps" + "Call client" — both target the Next Visit. | When no Next Visit: "Browse claimable →" → `/admin/bookings?view=claimable` (if claimable available). When neither: "Set my availability →" → `/admin/staff/{staffId}/availability`. | Essentially never (last-resort fallback is always available for an active Therapist). |

### 5.9 Pull-to-refresh (mobile, all variants)

Native browser scroll PTR pattern via a thin pointer-events handler at the page top. On release past threshold (~80px), triggers `router.refresh()`. Spinner during refresh. Honours `prefers-reduced-motion` (instant refresh, no spinner animation).

### 5.10 Swipeable today cards (mobile, business + coordinator)

The Today panel's row list becomes a horizontal snap-scroll strip (cards ~85vw wide). Trailing card prompts "View all N today →" → `/admin/bookings?view=today`.

Desktop unchanged (vertical list).

## 6. Key States

| State | What the user sees |
|---|---|
| Business owner, populated DB, mid-day | Header + Personal Stripe (4 tiles populated) + filter strip + Today panel (5 rows, 2 unassigned, gold dot active) + Urgent Attention (3 rows) + Operations Health (1 critical, 2 clear). Fits 1.5 viewports at 1440×900. |
| Coordinator, busy morning | Header + Personal Stripe (4 Coord tiles) + filter strip + Today panel with unassigned-first sort + Urgent Attention + Operations Health. Sticky bar: "Assign 3 unassigned →". |
| Therapist between visits, mobile | Header + Personal Stripe (compressed 2×2) + Next Visit hero (big, with Maps/Call buttons inline) + Today's visits list + Claimable strip with inline Claim buttons + Quiet weekly summary. Sticky bar: "Open in Maps" + "Call client". |
| Business, empty DB | Personal Stripe shows zeros (no fake values) + filter strip + Today panel "Quiet day. No bookings scheduled." + Urgent Attention "All caught up." + Operations Health "All systems quiet." |
| Therapist, no upcoming visits at all | Next Visit hero in empty state: "Nothing scheduled. Your day is clear. Browse claimable work?" CTA to `/admin/bookings?view=claimable`. |
| Business owner viewing their personal stripe at `?contribStripeRange=today` | Tiles narrow to today scope; period picker pill highlights "Today". |
| Loading | `AdminSkeleton` shimmer per section. |
| Error in any section | Per-section `<AdminPanel error>` with `role="alert"`. Other sections render. |
| Mobile pull-to-refresh active | Subtle "Refreshing…" indicator at top; spinner; release threshold triggers `router.refresh()`. |
| Mobile swipeable today, dragging | Horizontal scroll-snap engaged; trailing chevron indicator hints more content. |
| Inactive staff (any variant) | Middleware blocks; page never renders. |
| Therapist denied at the dashboard | Should never happen — Therapist has `manage_bookings_assigned` + `manage_availability_own` granting dashboard access. If somehow denied: `AdminAccessDenied` "Dashboard access limited." |
| `prefers-reduced-motion: reduce` | No count-up animations; no swipe-card snap animation; no PTR spinner animation; shimmer becomes static. |
| Cmd-K palette open | Existing `AdminCommandSearch` — unchanged. |

## 7. Interaction Model

- **Personal Contribution stripe period picker** (top-right of stripe) — segmented control `[Today | This week | This month]`. Sets `?contribStripeRange=` URL param. Stripe re-renders narrowed; rest of page unchanged.
- **Filter strip preset chip click** — submits GET form (`?range=`). URL updates; page re-renders.
- **"More filters" click** — opens `AdminSheet` from right (desktop) / bottom (mobile).
- **Today row click** — `<Link>` to `/admin/bookings/{id}`. Whole row is link.
- **Today row "Assign therapist" inline action (Coordinator only)** — secondary action on unassigned rows; opens assignment popover. Optional; ship without if scope tight.
- **Urgent Attention row click** — deep-link per item type (existing pattern preserved).
- **Operations Health row click** — per-row `href` (M2 fix); ROW is link, not panel.
- **Claimable strip card "Claim" button (Therapist)** — `<ClaimAssignmentButton>` inline; opens existing confirm modal; success toast + revalidate.
- **Claimable strip card body click (excl. button)** — `<Link>` to booking detail.
- **Quiet weekly summary tile click** — link to `/admin/me?range=this_week` (this is the new self-link → my Performance page).
- **Mobile sticky action bar click (Business/Coordinator)** — link to `/admin/bookings?view=unassigned` (existing route).
- **Mobile sticky action bar click (Therapist Maps / Call)** — Maps deep-link / `tel:` link (existing behaviour from Phase 6 Therapist brief).
- **Pull-to-refresh release (mobile)** — `router.refresh()`. Brief loading state.
- **Swipeable today card swipe (mobile)** — native CSS scroll-snap; no JS.
- **`prefers-reduced-motion`** honoured throughout: no count-ups, no swipe animations, no PTR spinner motion.
- **Keyboard order**: H1 → Personal Stripe tiles + period picker → filter chips → More filters → Export → Today rows → Urgent Attention rows → Operations Health rows → (Therapist) Claimable cards + Claim buttons → Weekly summary → sticky action bar items.

## 8. Content Requirements

**Headings.**
- H1 (all variants): "Today at Rahma Therapy" (preserved from Phase 6 amendment — voice-anchored)
- Sub-line: live date + locality ("Tuesday 12 May 2026 · Luton") for Business + Coordinator; live date only for Therapist ("Tuesday 12 May 2026")
- Personal Stripe section eyebrow: "MY CONTRIBUTION · {PERIOD LABEL}" (Soft Slate uppercase)
- Today panel H2: "Today" (Business + Coordinator) / "Next visit" (Therapist hero eyebrow + later H2 "Today's visits")
- Urgent Attention H2: "Needs your attention"
- Operations Health H2: "Operations Health"
- Claimable H2 (Therapist): "Open to claim (N)"
- Weekly summary H2 (Therapist): "This week"

**Empty-state copy.**

| Section / panel | Heading | Body | CTA |
|---|---|---|---|
| Personal Stripe, no activity in period | (renders zeros; no special copy) | — | — |
| Today panel (Business/Coordinator), no bookings | `Quiet day` | `No bookings scheduled. Quiet days are healthy days.` (Business) / `Nothing scheduled. Use the time to follow up on enquiries.` (Coord) | — |
| Today panel, filtered to empty range | `No bookings in this range` | `Try a different date range, or clear the filter.` | `Clear filters` |
| Urgent Attention, zero items | `All caught up` | `Nothing needs your attention right now.` | — |
| Operations Health, all clear | `All systems quiet` | `No operational events flagged in the last 7 days.` | — |
| Next Visit hero, no upcoming today | `Nothing scheduled` | `Your day is clear. Anything to claim?` | `Browse claimable work` |
| Next Visit hero, no upcoming + nothing claimable | `Nothing scheduled` | `Quiet day. Take care of yourself.` | — |
| Today's visits list (Therapist), only the hero visit | (section hidden) | — | — |
| Claimable strip, empty | `Nothing open right now` (single line) | — | — |
| Weekly summary, no completed visits yet | `Week starting` | `0 visits · 0h` | — |

**Microcopy.**
- H1: "Today at Rahma Therapy"
- Personal Stripe period picker labels: `Today` · `This week` · `This month`
- Personal Stripe Business tile labels: `Bookings today` / `My contribution` / `Revenue this week` / `Open attention`
- Personal Stripe Coordinator tile labels: `Unassigned today` / `Enquiries handled` / `My conversion rate` / `Active attention`
- Personal Stripe Therapist tile labels: `Next visit` / `Today's visits` / `Hours this week` / `Clients this month`
- Sticky action labels: `Assign N unassigned →` / `Open in Maps` / `Call client`
- "View all today" link: `View all N for today →`
- "See all attention" link: `See all N →`
- Today row Coord assignment chip: `Unassigned` / `Unassigned · same-gender required`
- Claimable card chip: `Available`
- Claimable card button: `Claim` (the existing button text from `<ClaimAssignmentButton>`)
- Operations Health row "View →": `View →`

**Voice anchors hit.** Verbs over nouns (Assign, Open, Call, View, Browse, Claim); real names ("Aisha · 8 visits" not "Therapist · 8 sessions"); state-word discipline ("Unassigned · same-gender required" makes constraint legible without colour-only signal); empty states encourage ("Take care of yourself" softens "0 bookings").

## 9. Recommended References

- **B-1 brief** — every tile, sparkline, ring, delta chip, chart, shimmer skeleton
- **B-2 brief** — `getStaffScorecard` for the Personal Stripe; existing data layer otherwise
- **B-3 brief** — visual language consistency: same period picker, same tile sizing, same scorecard helper consumption
- **B-4 brief** — Activity section receives `BusinessPulseCard` from here
- **`dashboard-owner-admin-brief.md`** — Phase 5 brief; this brief supersedes but preserves intent
- **`dashboard-coordinator-brief.md`** — preserved for unassigned-first sort + Active Enquiries logic
- **`dashboard-therapist-brief.md`** — preserved for Next Visit hero + Maps/Call deep-links + worker-tool tone
- **`reference/spatial-design.md`** — equal min-heights, mobile sticky bar safe-area, tonal lift
- **`reference/interaction-design.md`** — pull-to-refresh threshold, swipe-card snap, GET form filter behaviour
- **`reference/motion-design.md`** — shimmer + count-up + PTR spinner timing curves
- **`reference/copywriting.md`** — empty-state pass at the end of B-5
- **DESIGN.md §5 (AdminPanel)** — preserved
- **DESIGN.md §2 (No-Gold-Text exception, Tonal Lift Rule, no `border-l-4` ban)** — all preserved verbatim

## 10. Open Questions

1. **Personal Stripe period picker default** — today vs this week vs this month? **Recommendation:** this week (matches the cadence operators think in — most ops decisions are weekly).
2. ~~**Stripe Tile #2 for Business** — clinical vs admin contribution?~~ **RESOLVED per AUDIT-2026-05-22 Q4: every role sees their own metrics.** Owner Personal Stripe shows the union: tile #2 sums `scorecard.clinical.assignmentsCompleted + scorecard.admin.bookingsAssignedCount`. Owner-who-doesn't-treat sees `0 (clinical) + N (admin)`. The label "My contribution this week" is role-agnostic — the number tells the story. Zero clinical is informative; no hiding.
3. **Mobile sticky bar conflict with notifications** — could a critical notification toast overlay the sticky bar? **Recommendation:** R4's toast positions above the sticky bar (z-index 50 > 40). Verify in B-5 implementation.
4. **PTR threshold value** — 80px or 60px? **Recommendation:** 80px (matches iOS/Android native). User must intentionally pull, not accidentally.
5. **Operations Health on Therapist** — definitely hidden, but what if a Therapist needs to see a failed email about *their* booking? **Recommendation:** Therapist receives the operations event via the existing notification centre (R4); Operations Health panel itself is admin-scope. No leak.
6. **Tier-2 disclosure removal — affects user's saved `localStorage` preference** — the `dashboard:show-business-overview-{userId}` key becomes stale. **Recommendation:** ship the removal; the stale key auto-orphans. Plan can include an opt-in cleanup migration to drop the key on first load.
7. **`<ClaimAssignmentButton>` inline button affordance vs the card-as-link** — clicking the button vs clicking the card body: how do they differ? **Recommendation:** card body remains `<Link>` to booking detail; the inline button uses `event.stopPropagation()` to avoid the link firing. Click-area is split.
8. **Coordinator-only Tier-2 "Active queues" disclosure (Active Enquiries + Operations Health side-by-side)** — currently exists in Phase 6 implementation. **Decision:** with Operations Health promoted to Tier 1.5 universally for business + coordinator, the Active Enquiries tile needs a home. **Recommendation:** add an "Active Enquiries" panel between Today panel and Urgent Attention for Coordinator variant only. Tight grid; preserves the original brief's intent.

---

## Recipe Context

### Files to create

| File | Purpose |
|---|---|
| `src/app/admin/dashboard/PersonalContributionStripe.tsx` | The new top stripe (~120 lines). Role-aware tile selection. Consumes `getStaffScorecard` from B-2. |
| `src/app/admin/dashboard/MobileStickyActionBar.tsx` | Mobile bottom sticky bar (~80 lines). Variant-aware content. |
| `src/app/admin/dashboard/PullToRefresh.tsx` | Pointer-events wrapper for PTR (~60 lines). `router.refresh()` on release past threshold. `prefers-reduced-motion` honoured. |
| `src/app/admin/dashboard/SwipeableTodayCards.tsx` | Mobile horizontal snap-scroll wrapper for the Today panel row list (~50 lines). |
| `src/app/admin/dashboard/dashboard-helpers-b5.ts` | Pure helpers introduced for the rebuild (e.g. `tilesForVariant(variant)`, `mobileStickyActionForVariant(variant, data)`). |
| `src/app/admin/dashboard/__tests__/dashboard-helpers-b5.test.ts` | Vitest specs. |

### Files to modify

| File | Change |
|---|---|
| `src/app/admin/dashboard/page.tsx` | Wholesale restructure (~956 → ~600 lines after extraction). Remove BusinessPulseCard rendering. Remove Tier-2 disclosure rendering (the `BusinessOverviewDisclosure` wrapper still exists but `dashboard/page.tsx` no longer mounts it for Business — Coordinator variant adapts to render a smaller `BusinessOverviewDisclosure` for Active Enquiries only). Wire the new `<PersonalContributionStripe>`, promote `<OperationsHealthCard>` to Tier 1.5, add `<MobileStickyActionBar>` + `<PullToRefresh>` wrapper. Preserve every GET param. |
| `src/app/admin/dashboard/TherapistDashboard.tsx` | Refactor for new tier structure. Replace bare claimable cards with cards-containing-`<ClaimAssignmentButton>` (M3 fix). Add `<PersonalContributionStripe variant="therapist">` at top. Add mobile sticky bar. Preserve Next Visit hero per Phase-5 therapist brief. |
| `src/app/admin/dashboard/dashboard-cards.tsx` | Update `<OperationsHealthCard>` rows to carry per-row `href` (M2 fix). Update tile spacing tokens to use `--admin-{severity}-bg-strong`. Apply equal `min-h-[14rem]` across all primary-tier panels. Remove `BusinessPulseCard` export (consumed by B-4 instead). |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | Restyle to use B-1 token palette. Remove `BusinessOverviewDisclosure` mount for Business variant (still mounted for Coordinator). |
| `src/app/admin/dashboard/dashboard-header.tsx` | Add the cmd-K hint chip on desktop (preserved); ensure right rail accommodates Personal Stripe period picker. Otherwise minor. |
| `src/app/admin/dashboard/loading.tsx` | Update skeleton placeholder shapes to match new structure. |

### Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — RECON §5 untouchable
- `src/app/admin/dashboard/dashboard-helpers.ts` — RECON §5 untouchable (existing pure helpers)
- `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts`
- `src/app/admin/shell-variant.ts` — variant resolver preserved
- `src/lib/auth/**` — RBAC
- `src/lib/supabase/**`
- `src/middleware.ts`
- `supabase/migrations/**` — no schema changes in B-5
- All build/config files
- `src/app/admin/components/notification-*.{ts,tsx}` — R4
- `src/app/admin/components/charts/**` — owned by B-1
- `src/app/admin/components/tiles/**` — owned by B-1
- `src/app/admin/reports/reporting.ts` — owned by B-2

### Feature Preservation Manifest

**GET filter form `name` attributes preserved (RECON §2):**
`range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`. Plus existing Phase-6 URL param `todayView` (`list | timeline` — preserved per AUDIT-2026-05-22 G4; controls the Today panel's List ↔ Timeline view toggle on Business + Coordinator variants). Plus new: `contribStripeRange` (`today | this_week | this_month`, optional).

**Permission gates preserved (RECON §2):**
- `getAdminPageAccess("dashboard")` ≠ none
- `view_reports_revenue` — gates the Export link
- `manage_email_settings` / `manage_settings` — gates the Operations Health panel
- Therapist's `manage_bookings_assigned` + `manage_availability_own` — preserved

**JS hooks / IDs to preserve (RECON §6.4):**
- `id="admin-main"` + skip-link
- `id="admin-command-search"` — cmd-K palette
- `id="attention-dialog-title"` — `aria-labelledby` on attention dialog

**Server actions:** none (read-only; deep-links handle mutations on other pages).

**Audit log writes:** none from this page directly.

**External / deep links to preserve (RECON §6.5):**
- POST `/admin/signout` (never GET)
- GET `/admin/reports/export?{filterQuery}` (Export Ghost preserved)
- `https://www.google.com/maps/search/?api=1&query={address}` (Therapist Maps deep-link)
- `tel:{phone}` (Therapist Call deep-link)
- `/admin/bookings/{id}` deep-link
- `/admin/bookings?view=claimable` / `?view=unassigned` / `?view=today` / `?view=attention`
- `/admin/me?range=this_week` (Therapist weekly summary tile link)
- Dashboard deep-link pattern: `/admin/dashboard?range=custom&from=...&to=...&contribStripeRange=this_month` preserved

### Information hierarchy (top to bottom)

1. Page identity + live date + role pill
2. Personal Contribution stripe (NEW — leads the page)
3. Filter context (chips + active filter chips + Export)
4. Tier 1 — Today + Urgent Attention
5. Tier 1.5 — Operations Health (NEW position; business + coordinator only)
6. Therapist-only — Claimable strip + Weekly summary
7. Mobile sticky bottom action bar (variant-aware)

### Design direction — tokens and components

- **H1 "Today at Rahma Therapy":** Urbanist 600 display step (`clamp(1.875rem, 4vw, 2.5rem)`), Chronicle, 2px × 32px gold accent rule
- **Sub-line:** Work Sans 400 body, Soft Slate
- **Role pill:** Restricted family (existing)
- **Personal Stripe tile:** `<MetricRow>` from B-1 — compact, no panel chrome, tabular-nums, optional 18×6 mini-sparkline
- **Personal Stripe period picker:** segmented control `text-xs h-7` next to stripe (top-right)
- **Today panel marquee numeral:** Cormorant Garamond 700 `clamp(3rem, 6vw, 5.5rem)` Chronicle, line-height 1, tabular-nums
- **Today row pill:** existing `AdminStatusBadge` per status family
- **Urgent Attention background tint:** **NEW token** `--admin-warning-bg-strong` (replaces current `bg-warning`)
- **Operations Health priority row tints:** **NEW tokens** `--admin-{danger|warning|success}-bg-strong`
- **Tonal Lift Rule:** Tier 1 cards at `surface-card`; Coordinator-only `BusinessOverviewDisclosure` sub-tiles step down to `surface-page` (existing rule preserved)
- **No `border-l-4`:** preserved ban; full-border + tint instead
- **Mobile sticky bar:** `fixed bottom-0 inset-x-0 z-40 bg-[var(--admin-panel)] border-t border-[var(--admin-border)] p-3` with safe-area-padding-bottom
- **Skeleton shimmer:** B-1 gradient sweep
- **Focus rings:** 3px Focus Azure 2px offset on every interactive element
- **Disclosure motion:** N/A (Tier-2 removed for Business)

---

## Implementation Notes

**Per-state intent** lives in §6.
**Per-viewport intent** lives in §5 (Desktop ≥1280, Mobile <768).

**Verification steps:**
- `pnpm lint` + `npx tsc --noEmit` clean
- Vitest: new helper specs pass; existing dashboard-data/helpers specs preserved
- Playwright role sweep: Owner, Admin, Coordinator, Therapist (skip Inactive); navigate to `/admin/dashboard`; assert correct variant rendered with all sections per §5
- Screenshot at 375 / 768 / 1280 / 1440 for each role
- Mobile-specific: simulate PTR (Chrome DevTools touch); confirm refresh fires past 80px threshold
- Mobile-specific: swipe through Today cards; confirm snap-scroll works
- M2 verification: Operations Health failed-email row click → lands on `/admin/emails` (not `/admin/operations`)
- M3 verification: Therapist Claimable card "Claim" button click → optimistic visual lock to "Claimed" → server action fires → sonner toast "Booking claimed" → router.refresh. No confirm modal (per AUDIT-2026-05-22 C4).
- Personal Stripe period change: cycle Today / This week / This month; URL updates; stripe re-renders with narrowed metrics
- Mobile sticky bar: navigate to dashboard with 3 unassigned bookings; sticky bar reads "Assign 3 unassigned →"
- Empty-state pass: clear DB; reload; every section renders its empty state correctly
- `prefers-reduced-motion`: enable in OS settings; reload; confirm no count-ups, no swipe animations, no PTR spinner

---

## Copy

### Form labels

| Slot | Text |
|---|---|
| Date-range chip group | (sr-only `Date range`) |
| Date chips | `Today` / `This week` / `This month` / `Last 30 days` / `Custom` (business + coordinator) — `Today` / `Tomorrow` / `This week` / `Custom` (therapist) |
| More filters (when open) | `City` / `Service` / `Therapist` (sr-only `Staff`) / `Source` / `Status` / `Payment` |
| Personal Stripe period | (sr-only `My contribution period`) — chips `Today` / `This week` / `This month` |

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Date preset chips | (above) | Pill |
| More filters trigger | `More filters` (with count) | Ghost |
| More filters apply | `Apply filters` | Secondary |
| More filters clear | `Clear all` | Ghost |
| Export | `Export` | Ghost (download icon; gated) |
| Today overflow | `View all {N} for today →` | Ghost |
| Attention overflow | `See all {N} →` | Ghost |
| Operations Health row "View" | `View →` | Ghost (per row — M2) |
| Claimable card "Claim" | `Claim` | Primary (inline from `<ClaimAssignmentButton>` — M3) |
| Mobile sticky (Business/Coord) | `Assign {N} unassigned →` | Primary |
| Mobile sticky (Therapist) | `Open in Maps` / `Call client` | Primary / Secondary (side-by-side) |
| Today empty filtered | `Clear filters` | Ghost |
| Therapist Next Visit "Open booking" | `Open booking` | Primary |
| Therapist Next Visit hero buttons | `Open in Maps` / `Call client` | Ghost / Ghost |
| Quiet weekly summary tile | (whole tile is a link; no button text) | — |
| Coordinator Active Enquiries "Convert →" | `Convert →` | Ghost |
| `BusinessOverviewDisclosure` toggle (Coordinator only) | `Show active queues` / `Hide active queues` | Ghost (chevron) |

### Error messages

| Slot | Text |
|---|---|
| Section data load failure | `Couldn't load this section. Try refreshing.` |
| Tile data load failure | `Couldn't load this section. Try refreshing.` |
| PTR refresh failure | (no toast — error caught silently; page remains static) |
| Mobile swipe with no cards | (section hidden entirely) |
| Custom range invalid | `End date must be on or after start date.` |
| Filter combination yields zero | (Today panel empty state above) |
| Session refresh after permission change | `Your access has changed. Refresh to continue.` (persistent toast) |

### Empty-state text

(See §6 / §8 for the full table.)

### Tooltip text

| Slot | Text |
|---|---|
| Role pill | (no tooltip — pill self-describes) |
| Marquee numeral | native `title` = `{N} bookings on {date}` |
| Status badges in sub-line | (if interactive) `{N} {state} bookings. Select to filter.` |
| Attention row icon | native `title` = item-type label (`Unconfirmed booking`, `Privacy request waiting`) |
| Operations Health severity icon | `{severity}` |
| Date preset chip | native `title` = absolute range (`This week: 12–18 May 2026`) |
| Export Ghost | `Download a CSV of bookings in this range` |
| More filters count badge | `{N} active filters` |
| `<ClaimAssignmentButton>` (Therapist) | (existing button's tooltip from `bookings/`) |
| Personal Stripe period picker | (sr-only label only) |
| Mobile sticky bar Assign | `Assign {N} unassigned bookings` |
| Mobile sticky bar Open in Maps | `Open this address in Google Maps` |
| Mobile sticky bar Call client | `Call {clientName}: {phone}` |
| cmd-K chip | `Search (⌘K)` |
| NotificationBell | (R4-owned; unchanged) |

### Confirmation dialog text

This page mutates nothing directly. The `<ClaimAssignmentButton>` (M3 inline on Therapist claimable cards) triggers the existing optimistic-claim flow from `bookings/` — no confirm modal exists; success/failure are communicated via sonner toast (per AUDIT-2026-05-22 C4).

### Toasts

- Filter applied: no toast — re-render is the feedback
- Export clicked: no toast — browser download chrome
- Personal Stripe period changed: no toast
- Claim success (M3): `Booking claimed.` (existing sonner toast from `<ClaimAssignmentButton>`; verified against actual component)
- Claim failure: existing toast

---

*End of B-5 brief. Next: B-6 brief (client LTV ribbon) — small adjunct extension to client detail page.*
