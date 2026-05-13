---
name: Rahma Admin
description: Warm clinical card-board triage surface for a mobile hijama and massage therapy clinic
colors:
  surface-page: "oklch(97.8% 0.006 88)"
  surface-card: "oklch(99.2% 0.004 88)"
  surface-input: "oklch(98.5% 0.005 88)"
  surface-hover: "oklch(95.5% 0.012 155)"
  surface-selected: "oklch(92.0% 0.022 155)"
  action-primary: "oklch(23% 0.073 155)"
  action-primary-hover: "oklch(18% 0.068 155)"
  text-primary: "oklch(11% 0.014 155)"
  text-body: "oklch(23% 0.010 143)"
  text-muted: "oklch(42% 0.008 143)"
  text-inverse: "oklch(99.5% 0.003 88)"
  accent-gold: "oklch(75% 0.155 72)"
  accent-amber: "oklch(69% 0.142 72)"
  border-subtle: "oklch(89% 0.014 78)"
  border-default: "oklch(55% 0.022 80)"
  border-strong: "oklch(42% 0.025 80)"
  border-focus: "oklch(47% 0.095 230)"
  status-confirmed-bg: "oklch(93.5% 0.038 155)"
  status-confirmed-text: "oklch(22% 0.085 155)"
  status-pending-bg: "oklch(96.0% 0.038 75)"
  status-pending-text: "oklch(28% 0.120 55)"
  status-cancelled-bg: "oklch(95.5% 0.028 20)"
  status-cancelled-text: "oklch(26% 0.140 25)"
  status-completed-bg: "oklch(94.0% 0.030 200)"
  status-completed-text: "oklch(28% 0.095 200)"
  status-attention-bg: "oklch(95.0% 0.050 65)"
  status-attention-text: "oklch(26% 0.130 55)"
  status-restricted-bg: "oklch(94.0% 0.008 280)"
  status-restricted-text: "oklch(30% 0.020 280)"
typography:
  display:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "clamp(1.778rem, 3vw, 2.369rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "1.778rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "1.333rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Work Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Work Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  numeral:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "3.157rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  mono:
    fontFamily: "IBM Plex Mono, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  control: "6px"
  card: "8px"
  lg: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.action-primary-hover}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-body}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-destructive:
    backgroundColor: "oklch(40% 0.14 25)"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  admin-panel:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.card}"
    padding: "20px"
  admin-stat:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.card}"
    padding: "20px 24px"
  input-default:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  badge-confirmed:
    backgroundColor: "{colors.status-confirmed-bg}"
    textColor: "{colors.status-confirmed-text}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  badge-pending:
    backgroundColor: "{colors.status-pending-bg}"
    textColor: "{colors.status-pending-text}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  badge-cancelled:
    backgroundColor: "{colors.status-cancelled-bg}"
    textColor: "{colors.status-cancelled-text}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  badge-completed:
    backgroundColor: "{colors.status-completed-bg}"
    textColor: "{colors.status-completed-text}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  badge-attention:
    backgroundColor: "{colors.status-attention-bg}"
    textColor: "{colors.status-attention-text}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
---

# Design System: Rahma Admin

## 1. Overview

**Creative North Star: "The Practitioner's Board"**

Rahma Admin is the morning briefing book of a well-run mobile hijama clinic: every booking's status is named and coloured, every assignment shows the therapist's face, and today's work is legible before the first coffee. The grammar is card-board (the team already uses monday.com and its muscle memory is an asset, not a liability), but the palette, typography, and clinic-specific affordances make it unmistakably Rahma rather than a generic project tool. Warm ivory surfaces, deep clinic green chrome, Cormorant Garamond on marquee numerals, and dignified illustrated empty states define a surface that is calm and scannable at Therapist level, revealing depth for the Owner without becoming cluttered.

This system explicitly rejects: generic SaaS white-blue-grey palettes; hero-metric templates with gradient accents; identical card grids; side-stripe `border-l-4` accents on any element; gradient text; everything-on-one-screen Owner dashboards; and the stripped-bare Linear vocabulary that removes warmth, avatars, and illustration entirely.

**Key Characteristics:**
- Warm ivory surface system (page, card, input — three distinct lightness steps; depth via tonal lift, not shadow)
- Full status palette: six named families, each with bg tint + text + icon — never colour alone
- Cormorant Garamond reserved strictly for marquee numerals on dashboard stat tiles
- Staff avatars (real photo or initialled token) on every assignment and staff surface
- Dignified illustrated empty states — no dashed borders, no bare "No data" text
- Flat elevation at rest; tonal lift via surface lightness; shadows only in response to interaction state
- Comfortable density: 16px body base, 24-32px section rhythm, mobile-first layouts throughout

## 2. Colors: The Clinic Canvas

A warm-ivory surface system anchored by deep clinic green chrome and gold accent. Six named status families — the Card-Board's defining feature — ensure every booking, assignment, and payment state is legible without relying on colour alone.

### Primary — Clinic Green

- **Clinic Green** (oklch(23% 0.073 155) ≈ #073d2a): Navigation chrome, primary call-to-action buttons, active nav labels. The brand's defining dark hue — an unmistakably deep clinical green, not teal, not forest, not generic. Occupies roughly 20-30% of any screen by surface area (sidebar, nav bar, primary CTAs).
- **Clinic Green Hover** (oklch(18% 0.068 155) ≈ #042d1e): Primary button and interactive nav hover state.
- **Field White** (oklch(99.5% 0.003 88) ≈ #fffffe): All text, icons, and labels on dark green surfaces. WCAG 12.2:1 against Clinic Green ✓✓✓.

### Secondary — Gold (decorative accent only)

- **Rahma Gold** (oklch(75% 0.155 72) ≈ #f5a623): Cormorant numeral highlight on light canvas, chart accent colour, icon fills where gold communicates celebration or excellence. WCAG 1.9:1 on canvas — **decoration only, never body text or labels**.
- **Admin Amber** (oklch(69% 0.142 72) ≈ #d99a00): Numeral colour on the dark green sidebar/nav, bar-chart fills, secondary data-viz accent. WCAG 5.0:1 against Clinic Green ✓ — this is the only sanctioned text use of either gold token.

**The No-Gold-Text Rule.** Both gold tokens fail WCAG 3:1 on any ivory surface. Gold is decoration: stat numerals in Cormorant Garamond, icon fills, chart colours, brand highlights. Never use as body text, label text, or status text on light backgrounds.

### Neutral — Surfaces and Text

- **Clinic Canvas** (oklch(97.8% 0.006 88) ≈ #fbf8f2): The warm ivory page background. The most-seen surface in the system.
- **Practice Panel** (oklch(99.2% 0.004 88) ≈ #fffefa): Card and panel surface. Lighter than canvas — cards lift via lightness, not shadow at rest.
- **Input Ground** (oklch(98.5% 0.005 88) ≈ #fefcf8): Form input background. Barely-perceptible warmth distinguishing the input well from the surrounding card.
- **Hover Moss** (oklch(95.5% 0.012 155)): Green-tinted hover fill for interactive rows, list items, and nav items.
- **Selected Sage** (oklch(92.0% 0.022 155)): Stronger green tint for active/selected rows, active nav items, and pressed states.
- **Chronicle** (oklch(11% 0.014 155) ≈ #151b18): Page headings (H1). WCAG 16.5:1 on canvas ✓✓✓.
- **Practice Charcoal** (oklch(23% 0.010 143) ≈ #313731): Body text, form values, card body copy. WCAG 11.5:1 on canvas ✓✓✓.
- **Soft Slate** (oklch(42% 0.008 143) ≈ #5e625e): Secondary, muted, supporting text, placeholder copy, metadata. WCAG 5.9:1 on canvas ✓.

### Borders

- **Warm Veil** (oklch(89% 0.014 78) ≈ #e8dfd3): Structural panel dividers, resting card outlines. Decorative; does not carry interactive meaning. Not suitable for WCAG 1.4.11.
- **Form Seam** (oklch(55% 0.022 80)): Input and interactive component boundaries. WCAG 3.6:1 on canvas — meets WCAG 1.4.11 Non-text Contrast ✓.
- **Strong Notch** (oklch(42% 0.025 80)): Pressed states, emphasis borders, strong focus context. WCAG 6.2:1 on canvas ✓.
- **Focus Azure** (oklch(47% 0.095 230) ≈ #1b6f93): Keyboard focus ring on all interactive elements. Distinct from brand green — a deliberate visual separation so focus rings are never confused with hover states. WCAG 4.7:1 on canvas ✓.

**The Form Seam Rule.** Input and interactive component borders use Form Seam (oklch 55%), not Warm Veil. Warm Veil is intentionally below WCAG 1.4.11 thresholds — it is a panel structural aid only. A developer reaching for `border-subtle` on a form input is using the wrong token.

### Status Families

Each family deploys as: background tint + text colour + leading Lucide icon (`aria-hidden="true"`) + visible text label. Colour alone is an absolute ban.

| Family | Background | Text | WCAG text:bg | Icon |
|---|---|---|---|---|
| Confirmed / Active | oklch(93.5% 0.038 155) | oklch(22% 0.085 155) | ~10:1 ✓ | `check-circle` |
| Pending / Unconfirmed | oklch(96.0% 0.038 75) | oklch(28% 0.120 55) | ~9:1 ✓ | `clock` |
| Cancelled / Void | oklch(95.5% 0.028 20) | oklch(26% 0.140 25) | ~10:1 ✓ | `x-circle` |
| Completed | oklch(94.0% 0.030 200) | oklch(28% 0.095 200) | ~8.7:1 ✓ | `check-square` |
| Unassigned / Attention | oklch(95.0% 0.050 65) | oklch(26% 0.130 55) | ~9.5:1 ✓ | `alert-circle` |
| Restricted / Inactive | oklch(94.0% 0.008 280) | oklch(30% 0.020 280) | ~8:1 ✓ | `lock` |

**The Named Status Rule.** A status badge without both a text label and an icon is incomplete and must not ship. The icon supports scanning; the text carries the accessible meaning; the background tint groups family members across a list at a glance.

## 3. Typography: The Practitioner's Voice

**Display Font:** Urbanist (Urbanist, system-ui, sans-serif) — clean humanist geometric; confident at large sizes without coldness. Admin page titles, section headers, card headings.

**Body Font:** Work Sans (Work Sans, system-ui, sans-serif) — slightly condensed humanist sans; clear at small sizes; clinical precision without austerity. All body copy, form labels, badge text, navigation copy.

**Numeral Accent:** Cormorant Garamond (Cormorant Garamond, Georgia, serif) — the brand's pre-established serif signature (documented in RECON §7.2 and PRODUCT.md Brand Personality). Used exclusively for marquee dashboard stats and KPI numerals. This is the established brand identity; it is not a reflex pick.

**Mono Font:** IBM Plex Mono (IBM Plex Mono, Menlo, monospace) — humanist mono that complements Work Sans without the coldness of geometric mono families. Booking IDs, audit log entries, payment references, compact timestamps in data-dense views.

**Character:** Urbanist's geometric confidence in headings reads as organised and capable; Work Sans's slightly condensed rhythm gives the admin its density target. The pairing avoids both the coldness of pure-geometric families and the informality of rounded-humanist ones. Cormorant Garamond numerals give the dashboard a warmth pure-sans systems cannot achieve.

### Hierarchy

- **Display** (Urbanist 600, clamp(1.778rem, 3vw, 2.369rem), lh 1.15, ls -0.02em): Page title (H1). One per page view. Chronicle colour.
- **Heading** (Urbanist 600, 1.778rem, lh 1.25, ls -0.015em): Major section headers (H2), AdminPanel titles. Chronicle colour.
- **Title** (Urbanist 500, 1.333rem, lh 1.35, ls -0.01em): Card headings, panel sub-headers (H3), client and booking names in list cards. Practice Charcoal.
- **Body** (Work Sans 400, 1.000rem, lh 1.6, ls normal): All body copy, form field values, card detail lines. Max line-length 65-75ch on any prose block. Practice Charcoal.
- **Label** (Work Sans 500, 0.750rem, lh 1.4, ls 0.01em): Field labels, badge text, metadata, timestamps, sub-labels, navigation items. Soft Slate for supporting metadata; Practice Charcoal for primary labels.

**Numeral (special case):** Cormorant Garamond 700, 3.157rem, lh 1, ls -0.02em. Dashboard KPI tiles and headline stat tiles only.

**The Cormorant Exception.** Cormorant Garamond appears on numbers and only on numbers. Setting body copy, card titles, or form labels in Cormorant collapses the numeral's warmth into decorative noise. Preserve its rarity; it earns its character by appearing in one narrow slot.

## 4. Elevation

This system is flat by default. Depth is communicated entirely through surface lightness: the page canvas (oklch 97.8%) is darker than the card surface (oklch 99.2%), which is darker than an open overlay (oklch 99.8%). No panel or card casts a shadow at rest.

Shadows appear only as state responses — not as structural decoration.

### Shadow Vocabulary

- **card-hover** (`0 2px 8px oklch(23% 0.073 155 / 0.08)`): Appears on hover of an interactive booking card or list row. Green-tinted, short-reach shadow confirming the element is clickable. Invisible at rest.
- **overlay** (`0 8px 24px oklch(23% 0.073 155 / 0.12), 0 1px 4px oklch(23% 0.073 155 / 0.06)`): Modal (Dialog), AdminSheet, and popover elevation. Two-layer for natural fall-off. Green-tinted so the shadow reads as part of the brand palette.
- **focus-ring** (`0 0 0 3px oklch(47% 0.095 230 / 0.55)`): Keyboard focus ring on all interactive elements. Blue-tinted (Focus Azure) to visually distinguish from green hover states — a focus ring must never be confused with a brand hover.

**The Tonal Lift Rule.** A resting card has no shadow. Its elevation is communicated by being lighter than the page behind it. A shadow on a panel at rest means someone broke the system. Shadows are exclusively for state: hover, overlay open, focus.

**The Green-Tinted Shadow Rule.** All shadows use the brand green (`oklch(23% 0.073 155)`) at low opacity. Never `rgba(0,0,0,X)`. This prevents shadows from reading as generic and ensures they remain perceptually warm.

## 5. Components

All components listed here are present in the codebase (RECON.md §4 and §2). No invented components.

### Navigation — AdminTopNav

Full-width top bar. Clinic Green surface (oklch(23% 0.073 155)). Left: brand wordmark + current-page breadcrumb (Work Sans 400 at label step, Field White at 70% opacity for breadcrumb, full Field White for page name). Active nav item: Selected Sage background tint (oklch 92%) with Urbanist 600 label. Inactive nav items: transparent, Work Sans 500, Field White. Hover: Hover Moss tint. Focus state: 3px Focus Azure ring (offset 2px). Right rail (left to right): NotificationBell (24px icon, pill count badge) / cmd-K hint chip / user avatar (32px circle, real photo or Work Sans 600 initials on Hover Moss background). Mobile (<768px): nav collapses to AdminSheet slide-in; hamburger button with 44px touch target. Signout is always a POST form (`<form action="/admin/signout" method="POST">`); never a `<a>` link. Skip-link `<a href="#admin-main">` preserved above nav, visually hidden until focused.

**States:** Default | Hover (Hover Moss tint) | Active (Selected Sage tint + Urbanist 600) | Focus (Focus Azure ring) | Mobile-open (AdminSheet overlay).

### AdminPanel — Core card wrapper

Practice Panel surface (oklch 99.2%). 8px corner radius. 1px Warm Veil border. Padding: 20px. No shadow at rest. Hover (when the entire panel is an interactive link): card-hover shadow. AdminPanelHeader uses Urbanist 600 at heading step, rendered as H2. Nested AdminPanels are prohibited (nested cards are always wrong).

**States:** Default | Interactive-hover (card-hover shadow) | Loading (AdminSkeleton — pulsing Warm Veil bars at expected content positions).

### Buttons

- **Primary:** Clinic Green fill; Field White text; Work Sans 600 at label step; 6px radius; padding 10px 20px. Hover: action-primary-hover (oklch 18%). Focus: 3px Focus Azure ring, 2px offset. Active: oklch(15% 0.065 155). Disabled: 40% opacity + cursor-not-allowed. Loading: 16px spinner (Field White, border-right transparent) replacing leading icon slot; text unchanged.
- **Secondary:** 1px Form Seam border (oklch 55%); transparent fill; Practice Charcoal text. Hover: Hover Moss fill. Focus: Focus Azure ring. Active: Selected Sage fill.
- **Destructive:** oklch(40% 0.14 25) fill; Field White text; WCAG 6.5:1 ✓. Hover: oklch(33% 0.14 25). Focus: Focus Azure ring. Used only for explicitly destructive confirmed actions (cancel booking, deactivate staff, delete service).
- **Ghost:** No border, no fill. Practice Charcoal text. Hover: Hover Moss fill. Focus: Focus Azure ring. Used for secondary navigation and tertiary inline actions.

### Inputs and Fields

Input Ground background (oklch 98.5%). 1px Form Seam border (oklch 55%) — not Warm Veil. 6px radius. Work Sans 400 at body step for field value; Work Sans 500 at body step for label above. Chronicle colour for label; Practice Charcoal for value. Required marker: `<span aria-hidden="true">*</span>` in Cancelled text colour (`oklch(26% 0.140 25)`) adjacent to every required label. Placeholder text: Soft Slate. Focus: border colour shifts to Focus Azure; shadow-focus-ring applied. Error: border shifts to Cancelled text colour; error message in Cancelled text below the field, wrapped in `<div role="alert" aria-live="polite" aria-atomic="true">`. Disabled: 60% opacity + cursor-not-allowed.

**States:** Default | Focus (Focus Azure border + ring) | Filled (unchanged) | Error (Cancelled border + alert region below) | Disabled (60% opacity).

### Status Badges — AdminStatusBadge

Rounded-full pill (9999px radius). Background and text colour from the status family table in §2. Always: 16px Lucide icon (`aria-hidden="true"`) + non-breaking space + visible text label. Work Sans 500 at label step (0.75rem). Padding 3px 10px. A badge without a text label is invalid. Size variants: default (0.75rem) and compact (0.6875rem / 11px) for very dense table contexts only.

**States:** Default only — badges are not interactive.

### Empty States — EmptyState

Vertically centred column layout. SVG illustration slot: 80-120px, meaningful to the context (no bookings → calendar with check mark; no staff → person with plus; no clients → person with heart; no enquiries → speech bubble with check). Urbanist 600 at title step for heading. Work Sans 400 at body step, Soft Slate, for description (max 2 lines, 45ch). Optional primary Button. Max-width 360px, horizontally centred within its container. No dashed borders. No sad-face illustrations. No generic "0 items" copy — voice is encouraging: "All caught up", "Ready for your first booking", "No one added yet".

### Booking Cards — BookingListCard (signature component)

Full-border card (1px Warm Veil). Practice Panel surface. 8px radius. Padding: 14px 16px. Status badge: top-right, within card. Client name: Urbanist 600 at title step, Chronicle colour. Service + formatted date/time: Work Sans 400 at body step, Practice Charcoal. Staff avatar (32px circle, real photo or initialled token on Hover Moss background) + therapist name: Work Sans 500 at label step, inline with avatar. Payment status badge: bottom-left row. **Gender-match chip:** "Same-gender required" — labelled chip using Restricted family colours, always visible when the constraint applies, never colour-only. This is a clinical requirement that must remain legible even when screen space is tight. Hover: card-hover shadow. Mobile: single-column stack. Confirm + quick-action buttons appear in a sticky AdminMobileActionBar at viewport bottom (not inline). No `border-l-4` under any circumstance.

**States:** Default | Hover (card-hover shadow) | Focus-visible (Focus Azure ring on card) | Mobile (stacked, sticky action bar).

### Stat Tiles — AdminStat

Practice Panel surface. 8px radius. Padding 20px 24px. Two-row structure: Work Sans 500 at label step (Soft Slate, top row) / Cormorant Garamond 700 at 3.157rem numeral (Chronicle, bottom row). Optional third row: trend indicator (Work Sans 400 at label step; up/down Lucide icon + delta percentage). 1px Warm Veil border. No gradient. No gradient text. No hero-metric stacking of three supporting stats below the primary number.

### Attention Panel — UrgentAttentionPanel

Full-border card (1px in status family colour — Pending or Cancelled family). Status family background tint. Never `border-l-4`. Item list: max 5 visible rows; "See all N" link at bottom in Clinic Green. Each row: 16px status icon (`aria-hidden="true"`) + description (Work Sans 400, body step) + date chip (Work Sans 500, label step, Warm Veil background). Mobile: the full panel collapses to a count badge on the NotificationBell; the list is accessible via the NotificationBell AdminSheet.

## 6. Do's and Don'ts

### Do

- **Do** vary card composition by content type. A `BookingListCard` is horizontal with avatar + status badge; an `AdminStat` tile is vertical with marquee numeral; a `ClientCard` is avatar-led with rollup stats. Varied shapes, not a uniform icon-heading-text grid repeated endlessly.
- **Do** include staff avatars (real photo or initialled token, minimum 32px diameter) on every surface involving assignment, team listing, or booking ownership.
- **Do** name every status with text label + icon + background tint. The icon supports fast scanning; the text carries the accessible meaning; the tint groups related statuses across a busy list.
- **Do** reserve Cormorant Garamond for marquee numerals and KPI stats only. All other headings use Urbanist.
- **Do** keep gender-matching legible as a labelled chip ("Same-gender required") on booking and assignment cards. It is a clinical requirement and must remain visible at every breakpoint.
- **Do** use dignified illustrated empty states: an SVG illustration relevant to the context, an encouraging Urbanist heading, a supporting description in Soft Slate, and an optional CTA.
- **Do** wrap all form-level error regions in `role="alert" aria-live="polite" aria-atomic="true"` — this is a WCAG AA requirement, a P0 audit blocker, and a direct commitment to novice operators hearing errors announced on phone screen readers.
- **Do** mark required form fields with a visible `*` marker in Cancelled text colour adjacent to every required label (`<span aria-hidden="true">*</span>`).
- **Do** preserve `id="admin-main"` skip-link target, `id="admin-command-search"`, and all server-action form `name` attributes across any nav or chrome changes (RECON §6.4).
- **Do** provide a vertical-stack fallback on mobile for any content arranged in columns or boards on desktop.
- **Do** tint all shadows toward the brand green (`oklch(23% 0.073 155)`), never `rgba(0,0,0,X)`.
- **Do** use Form Seam (oklch 55%) for input and interactive component borders — Warm Veil is for structural panel dividers only and does not meet WCAG 1.4.11.

### Don't

- **Don't** use `border-l-4` — or any `border-left` or `border-right` greater than 1px as a coloured accent — on cards, list items, attention rows, notification items, or any other element. Absolute ban. Replace with: full-border card with status family background tint, or a leading status icon, or a background tint alone.
- **Don't** use gradient text (`background-clip: text` combined with a gradient fill). Absolute ban.
- **Don't** use Rahma Gold or Admin Amber as body text, label text, or status text on any light surface. Both fail WCAG 3:1 on canvas. Gold is decoration only.
- **Don't** use the hero-metric template: large number / small label / supporting stats / gradient accent stacked decoratively. `AdminStat` tiles are flat, two-row, and numeral-led.
- **Don't** use identical card grids — the same card shape with icon + heading + text body repeated without variation. This is the hero-metric antipattern applied to lists.
- **Don't** use decorative blobs, glassmorphism, or background blur as a stylistic default.
- **Don't** use purple-and-blue gradients, neon accents, or a dark theme justified by "tools look professional dark." The physical-scene test (daytime, phone, bright light) forces light mode.
- **Don't** style the admin with generic SaaS defaults or out-of-the-box shadcn appearance. Every shadcn primitive must be restyled to the Rahma token system before it ships.
- **Don't** build a pure-typography admin stripped of avatars and illustration — the Linear vocabulary is explicitly not the target (PRODUCT.md). Warmth, avatars, and illustrated empty states are design requirements.
- **Don't** use colour-only status signalling. A chip with a background tint but no text label must not ship.
- **Don't** expose more than two card tiers simultaneously at Owner dashboard level (Today + Urgent Attention always visible; Business overview tier on demand via disclosure). Power must not equal clutter.
- **Don't** use dashed borders on empty states. A dashed border reads as "placeholder" or "unfinished". Use illustrated empty states instead.
- **Don't** display raw permission identifiers (`manage_role_templates`, `availability_mode`, `assign_staff_roles`) on access-denied or error screens. Plain English: "You don't have access to this section. Contact the owner."
- **Don't** add shadows to panels or cards at rest. Shadows are state responses only (hover, overlay, focus ring). A resting card with a shadow has broken the Tonal Lift Rule.

## Admin-Specific Patterns

Recipe-supplementary section. The six canonical sections above are skill-native; this section is appended for the redesign recipe so commands that read DESIGN.md (`live`, `craft`, `polish`) inherit admin-surface conventions. Specifies only patterns that exist in `redesign/RECON.md` and uses only tokens defined in the canonical sections above — no new tokens are introduced. If `/impeccable document` is re-run, this section may be stripped and must be re-appended per the Phase 8 preserve-and-reappend ritual.

### Data Table

Rahma Admin uses no generic HTML tables. The admin's list paradigm is **list-row cards** (`BookingListCard`, `ClientCard`, `AdminEntityRow`, per-date `AdminPanel` clusters in the calendar) and `<dl>` description lists for detail metadata (RECON §2, §4). Conventions below apply to those list-row surfaces.

- **Density: Comfortable — 44px row height.** PRODUCT.md commits to "16px body base, 24-32px section rhythm" and a novice, mobile-first operator base. Compact (32px) intimidates novice operators on a phone; spacious (56px) wastes the limited mobile viewport. 44px also satisfies the WCAG 2.5.5 touch-target floor.
- **Header row:** `surface-card` background, `text-muted` (Soft Slate) colour, Work Sans 500 at label step (0.75rem), sentence-case. Never uppercase shouting.
- **Data row:** `surface-page` (Clinic Canvas) background, `border-bottom: 1px solid border-subtle` (Warm Veil). Rows sit on canvas — they are not nested cards.
- **Row hover:** `surface-hover` (Hover Moss). Cursor pointer only when the row is a link or has a single primary action.
- **Row selected:** `surface-selected` (Selected Sage) — reserved for bulk-action contexts (below).
- **Cell padding:** vertical `md` (16px), horizontal `md` (16px) at comfortable density.
- **Sort indicator:** Lucide `arrow-up` / `arrow-down` (12px) leading the sorted column label, `aria-hidden="true"`. `aria-sort="ascending"` / `"descending"` on the column header for screen readers. Two-state cycle (asc → desc); clicking a different column resets to asc.
- **Empty state:** centred `EmptyState` component per §5 — illustration + Urbanist title + Soft Slate body + optional Button. No "0 rows" copy, no dashed border.

### Table Actions

- **Inline primary action** per row (e.g. "Send reminder" on `/admin/emails` rows) — visible at rest, Ghost Button style, Practice Charcoal text, no leading icon at default size so row scan-lines stay clean.
- **Secondary / tertiary actions** collapse into a trailing three-dot menu (Lucide `more-horizontal`, 16px) opening `AdminActionMenu` (exists in `admin-ui-interactions.tsx`, currently orphan per RECON §4). Menu items in Work Sans 500 at label step; destructive items in Cancelled text colour with a leading icon.
- **Hover-revealed row actions are banned.** Mobile-first operators have no hover. Every row action is either visible at rest or reachable via the trailing menu.

### Bulk Actions

Not currently present in the admin (RECON §4: shadcn `Checkbox` has `0 admin` usage; `AdminListSurface` and `SavedViewTabs` are built but unwired). When introduced:

- **Leading-column checkbox** at 24px touch target, `aria-label="Select <client name>"`. Header-row checkbox toggles all visible rows.
- **Bulk action bar** sticks to the bottom of the list viewport when ≥1 row is selected. `surface-card` background, 1px `border-subtle` top border, `md` (16px) vertical padding, full-width on mobile.
- **Bar contents:** selection count on the left ("3 selected", Work Sans 500 label step); action group on the right (Primary main action + Secondary alt + Ghost "Cancel selection").
- **Destructive bulk actions** always go through `ConfirmActionModal` (currently orphan; would be wired here).
- **Selection signal:** per-row `surface-selected` tint + numeric count in the bar. Colour alone is never the only signal (Named Status Rule, §2).

### Search and Filter

- **AdminFilterBar** (canonical pattern — used by `/admin/calendar`, `/admin/clients`, `/admin/reports` per RECON §4) renders as a horizontal grid of Inputs / Selects above the list. Every filter is a GET form field so URLs stay deep-linkable (RECON §6.5). Submit: Secondary "Apply filters" — never Primary; the list is the primary surface.
- **Filter fields** inherit the standard Input treatment from §5: `surface-input` ground, `border-default` (Form Seam), 6px radius.
- **Active filter chips** below the filter bar — small badges showing field name + value + 12px `x` to clear. Use the Restricted family colour pair (neutral grey-purple) so chips read as metadata, not status.
- **View Tabs** (`/admin/bookings` ships 10: Needs Attention, Today, Upcoming, Claimable, …) — horizontal pill row above the list. Active: Clinic Green fill, Field White text, Urbanist 500 label step. Inactive: transparent, Practice Charcoal, Work Sans 500. Hover: Hover Moss fill. Active tab **must** carry `aria-current="page"` (currently colour-only — Phase 6 fix per BASELINE-CRITIQUE Sam #3). On narrow viewports, view tabs become a momentum horizontal-scroll strip; never a stacked list.
- **Global command palette — AdminCommandSearch (cmd-K):** triggered from the cmd-K chip in AdminTopNav (desktop) or the search icon (mobile). Modal palette: single input + result list. Preserve `id="admin-command-search"` (RECON §6.4).
- **Critical fix:** `/admin/clients` `location` filter input currently has no label / aria-label at runtime (RECON §8, BASELINE-CRITIQUE Sam #3). The pattern above resolves this: every filter input ships with a visible `<label>` element using the §5 Input field-label specification.

### Status Badge

Defined fully in §2 (Status Families) and §5 (AdminStatusBadge). Recapped for the admin context:

- **Shape:** pill — `rounded-full` (9999px radius). Never rectangular, never square.
- **Composition:** background tint + text colour + Lucide icon (`aria-hidden="true"`) + visible text label. All four required. A badge without a text label is invalid.
- **Size:** default 0.75rem label (3px×10px padding); compact 0.6875rem (2px×8px) reserved for very dense table-row contexts only.
- **Token pairs:** Confirmed / Pending / Cancelled / Completed / Unassigned-Attention / Restricted. No new families. No colour-only status.

### Pagination

The admin has no paginated lists currently (RECON §2: `/admin/audit` reads top-100; other lists read in full). When a list exceeds ~50 rows in production:

- **Default: "Load more" button** at list bottom, Secondary Button style, full-width on mobile / max-width 240px on desktop. Loads the next page in place — existing rows stay scrolled in view; no full reload.
- **Numeric pagination** is reserved for `/admin/audit` if it ever needs backward stepping. Pattern: leading "Prev" + trailing "Next" Secondary Buttons + centred "Page 3 of 12" in Work Sans 500 label step.
- **No page-size selector.** Fixed default (50). Operators who need exhaustive data export CSV via `/admin/reports`.

### Print Considerations

`/admin/calendar` ships a `PrintButton` (RECON §2). `@media print` commitments:

- **Hide:** `AdminTopNav`, `AdminCommandSearch`, `AdminFilterBar`, `NotificationBell`, all interactive buttons, all sticky action bars.
- **Expand:** the calendar content area to full page width; remove `surface-card` borders; disable all hover and focus states.
- **Ink economy:** all text to Chronicle on white; status family backgrounds drop to outlined pills (1px `border-strong` Strong Notch + Practice Charcoal text + icon); shadows disabled entirely (already flat at rest per §4).
- **Page breaks:** `break-inside: avoid` on each per-date `AdminPanel` so a day's bookings never split across pages.

### Motion Tokens

Existing tokens (DESIGN.json sidecar; RECON §7.3) — fast / normal / slow philosophy:

- **duration-fast: 160ms** — toast appear, dropdown open, hover transitions, button press feedback.
- **duration-normal: 240ms** — Dialog open/close, AdminSheet slide-in, tab switches, AdminActionMenu open.
- **duration-slow: 360ms** — reserved for full-screen overlays and any gallery-style transitions.
- **Easing:** `ease-gentle` for entrances (exponential ease-out family — never bounce, never elastic, per impeccable design laws); `ease-snappy` for exits; `ease-gentle` for two-way transitions in both directions. Never `ease-in` alone for entrances — they should settle, not arrive.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` is honoured globally (RECON §7.3). All transitions reduce to instant; opacity-only fades may keep at ≤80ms; layout animations disabled. The redesign preserves this contract.

### Status Communication

How the admin surfaces operational signals:

- **Success:** Sonner toast (top-right desktop, top-centre mobile), Confirmed family colours, leading `check-circle` icon, auto-dismiss 4s. Body text Work Sans 500 at label step in Practice Charcoal.
- **Error (form-level):** **always** an inline region wrapped in `<div role="alert" aria-live="polite" aria-atomic="true">`, positioned directly below the field (or above the form for cross-field errors). Cancelled family colours. Required by WCAG 2.1 AA and by PRODUCT.md commitments — currently a P1 audit blocker per BASELINE-CRITIQUE.
- **Error (system-level):** Sonner toast, Cancelled family colours, leading `x-circle` icon, **no auto-dismiss** — user must dismiss explicitly. Provide a Ghost "Retry" button when the error is retryable.
- **Warning (action-blocking):** inline banner above the action, Pending family colours, leading `alert-circle` icon, visible text label. Never a tooltip — a tooltip is too easily missed for an action-blocking signal.
- **Warning (informational):** Pending family Sonner toast, auto-dismiss 6s (longer than success — warnings carry more weight).
- **Loading (data):** `AdminSkeleton` pulsing Warm Veil bars at expected content positions. Never a generic page spinner. Skeletons must approximate the eventual layout so the page does not reflow on load.
- **Loading (action button):** 16px Field White spinner replacing the button's leading icon slot; button text unchanged; button `aria-busy="true"` and disabled for the in-flight duration. Never a full-screen overlay for a single button press.
- **Confirmation (destructive):** `ConfirmActionModal` (exists in `admin-ui-interactions.tsx`, currently orphan per RECON §4 — Phase 6 wires it). Dialog overlay, Cancelled family icon, plain-English summary, Primary "Confirm" + Secondary "Cancel". Required for: cancel booking, deactivate staff, delete service, delete role.
- **Confirmation (non-destructive):** instant feedback via success toast; no modal interruption. Examples: assign therapist, send reminder, mark paid.
