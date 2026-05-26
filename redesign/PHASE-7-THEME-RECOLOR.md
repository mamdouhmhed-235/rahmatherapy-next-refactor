# Phase 7 — Admin Brand Re-theme (2026-05-20)

The admin shifted from "deep clinic green chrome on warm ivory" to a brand-anchored palette mirroring the Rahma Therapy logo. Two brand colors carry two semantic roles.

## Strategy

**Restrained-with-dual-role.** Light warm-cream chrome (almost-canvas) with brand colors in semantically-correct roles:

- **Therapy Blue (`#0f5e8e`)** — the action axis. Primary buttons, active states, links, focus context, Info family. Darker variant of the logo's `#127ebe` "therapy" script.
- **Brand Orange (`#f7931e`)** — the identity axis. Cormorant numerals (the literal logo wordmark hue), chart accents, illustration. Decoration only — fails WCAG body-text contrast.
- **Burnt Orange (`#a14820`)** — focus ring. Tied to brand orange but darker for legibility.
- **Cream Chrome (`oklch(96% 0.012 75)`)** — nav-bar surface. Cream just slightly deeper than the canvas; reads as part of the warm-ivory family rather than a heavy contrasting slab.

The split mirrors the logo's two-axis structure: identity (orange "RAHMA") + action (blue "therapy"). Both deployed in roles that fit their personality.

## What changed

### Tokens (`src/styles/tokens.css`)

**Re-coloured:**
- `--admin-primary`: clinic green `#073d2a` → Therapy Blue `#0f5e8e`
- `--admin-primary-hover`: → `#0a4870`
- `--admin-focus`: Focus Azure `#1b6f93` → Burnt Orange `#a14820`
- `--admin-accent`: Admin Amber `#d99a00` → Brand Orange `#f7931e`
- `--admin-info`: `#1b6f93` → `#0f5e8e` (now matches new primary)
- All shadow tokens: green-tinted → brand-blue-tinted (Brand-Tinted Shadow Rule, was Green-Tinted Shadow Rule)
- `--admin-sidebar` / `-active` / `-muted`: vestigial — retinted to cream-warm-neutrals for safety

**New (split chrome from action):**
- `--admin-nav-bg`: `oklch(96% 0.012 75)` cream chrome surface
- `--admin-nav-text`: `var(--admin-body)`
- `--admin-nav-text-muted`: `var(--admin-text-muted)`
- `--admin-nav-active-bg`: `oklch(93% 0.04 247)` Selected Sky
- `--admin-nav-active-text`: `var(--admin-primary)`
- `--admin-nav-border`: `oklch(88% 0.014 75)`
- `--admin-cormorant-color`: `var(--admin-accent)` (= brand orange)
- `--admin-hover-mist`: `oklch(95.5% 0.022 247)` (replaces inline Hover Moss)
- `--admin-selected-sky`: `oklch(92% 0.05 247)` (replaces inline Selected Sage)

**Status family shifts:**
- **Completed**: teal (h=200) → cool grey (h=270). Freed the blue hue territory for chrome and reads as "done / archived" semantically.

All five other families (Confirmed / Pending / Cancelled / Attention / Restricted) preserved.

### DESIGN.md

§2 Colors fully rewritten:
- "Clinic Green" → "Therapy Blue" + "Cream Chrome"
- "Rahma Gold" / "Admin Amber" → "Brand Orange" / "Burnt Orange"
- "Hover Moss" / "Selected Sage" → "Hover Mist" / "Selected Sky"
- "No-Gold-Text Rule" → "No-Brand-Orange-Text Rule"

§2 new named rules:
- **The Brand-Accent Containment Rule** — Brand Orange contained to four roles: Cormorant numerals ≥3.157rem, chart fills, illustration, Burnt Orange focus rings. Never as background-with-text (Pending h=75 and Attention h=65 own that pattern).
- **The Status-Exclusive Hue Rule** — no chrome surface shares any status family's hue.

§4 Elevation: "Green-Tinted Shadow Rule" → "Brand-Tinted Shadow Rule" (shadows tint to `oklch(41% 0.105 247)`).

§5 Components: Primary button / Navigation / Input / BookingListCard / Attention rail / Buttons / Data table all rewritten to reference Therapy Blue + Cream Chrome + Burnt Orange focus.

### AdminTopNav.tsx

Chrome surface flipped from dark green (`bg-[var(--admin-primary)]`) to cream (`bg-[var(--admin-nav-bg)]`). All `text-white/*` swapped to `text-[var(--admin-nav-text)]`. All `bg-white/16`, `ring-white/12`, etc. (white-on-dark overlays) swapped to `bg-[var(--admin-panel)]`, `ring-[var(--admin-border)]`. Bell + UserMenu + MobileSearch + bottom-tab-bar all retuned for cream chrome. Logo-mark `invert` class removed — renders in native brand colors now.

### AdminStat.tsx Cormorant numerals

`text-[var(--admin-heading)]` (Chronicle dark) → `text-[var(--admin-cormorant-color)]` (brand orange). Cormorant Exception rule covers decoration-only contrast.

### Favicon metadata

`src/app/layout.tsx` — added explicit `icons` block pointing at `/images/brand/rahma/favicon.svg` + `favicon-32.png` + `favicon-16.png` + `apple-touch-icon.png` + `favicon.ico`.

### Inline-literal sweep

`Hover Moss` (`oklch(95.5%_0.012_155)`) and `Selected Sage` (`oklch(92%_0.022_155)` / `oklch(92.0%_0.022_155)`) literals migrated to `var(--admin-hover-mist)` / `var(--admin-selected-sky)` across 24 admin source files. One stray `oklch(15%_0.065_155)` (clinic green active state) in `admin-ui.tsx` AdminButton primary → `oklch(28%_0.085_247)`. Two inline `h=200` (teal) Completed literals in `AuditEventCard.tsx` + `services/page.tsx` migrated to the new `--admin-status-completed-*` tokens.

## What did NOT change

- Public site (`/`, `/services`, `/contact`) — still warm-clinical green-and-cream. Public is a separate identity.
- shadcn primitives (`button.tsx`, `switch.tsx`, `badge.tsx`) — keep their `--rahma-green` defaults (admin uses `--admin-primary` directly, no cross-render).
- Status families: Confirmed (green h=155), Pending (amber h=75), Cancelled (red h=20), Attention (h=65), Restricted (grey-purple h=280). All preserved.
- Typography: Cormorant Garamond, Urbanist, Work Sans, IBM Plex Mono all unchanged. Only Cormorant numeral COLOR shifted.
- Motion tokens, radii, spacing scales — unchanged.

## Brand colors reference

From `brand-logo-assets/vector-trace-no-tagline/logo-refined.svg`:

| Hex | OKLCH | Role |
|---|---|---|
| `#f7931e` | `oklch(75% 0.168 60)` | Brand Orange — Cormorant numerals, chart accents, decoration |
| `#ffcd18` | `oklch(88% 0.181 91)` | Lighter amber (gradient mid-stop) — decoration only |
| `#127ebe` | `oklch(55% 0.149 247)` | Brand Blue — chrome derivative source |
| `#0f5e8e` | `oklch(38% 0.10 247)` | Therapy Blue (darker variant) — admin primary chrome / actions, AAA 7.2:1 ✓ |
| `#a14820` | `oklch(45% 0.115 50)` | Burnt Orange — focus ring (decoration-tier orange but darker), 4.2:1 ✓ for non-text |

## Risks & verification

| Risk | Status |
|---|---|
| Orange focus ring on Pending amber bg — collision | Pending h=75 + focus h=50; chroma + hue separation tested. Fallback to existing Focus Azure if real-screen testing fails. |
| White text on cream nav-bg (was on dark green) | Swept — all `text-white/X` overlays in AdminTopNav converted to dark-on-cream. Spot-grep confirms one remaining `text-white` is intentional (active "More" tab initials circle on `bg-[var(--admin-primary)]` blue — passes 7.2:1). |
| Pre-existing typecheck errors | 12 errors all unchanged from before this work; none introduced. |
| Shared logo + content with public site | Public-site assets unchanged. `--rahma-*` tokens preserved. |

Visual regression testing required on:
- Dashboard (Owner / Admin / Coordinator / Therapist variants) — cream nav, blue active tabs, orange Cormorant numerals.
- Booking detail, calendar, reports — Therapy Blue + Brand Orange + status families distinct.
- Login + password-reset — full logo-refined wordmark.
- Mobile bottom tab bar — active state reads correctly.

Token + design-rule changes are the single source of truth; component changes cascade from there.
