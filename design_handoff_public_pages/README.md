# Handoff: Customer-Facing Pages Redesign

## Overview
This package contains the redesigned **customer-facing (public) pages** for the Rahma Therapy
website: **Home, About, Services, Package detail (×5 variants), Reviews, and FAQs & Aftercare**.

The redesign is a **brand re-theme + layout polish** of the existing public site. The structure,
component breakdown, and copy stay almost identical to what already ships in
`rahmatherapy-next-refactor`; the headline change is a **palette shift from clinic-green to a
vibrant therapy-blue + gold** system, applied through the existing design tokens, plus per-section
layout refinements visible in the reference files.

> **Read this first — the single most important fact:**
> The entire colour re-theme is driven by **three CSS custom-property value changes** in
> `src/styles/tokens.css`. The repo already uses these tokens everywhere via Tailwind v4's
> `@theme inline` mapping (`bg-rahma-green`, `text-rahma-charcoal`, etc.), so changing the token
> *values* re-skins all seven pages at once. Do **not** rewrite components from scratch — re-theme
> the tokens, then diff each section against the reference and apply the small layout deltas.

## About the design files
The files in `designs/` are **design references created in HTML** — self-contained prototypes that
show the intended look and behaviour. They are **not** production code to copy verbatim. They were
authored as direct ports of the real components, so the Tailwind class strings inside them line up
closely with the codebase. Your task is to **recreate these designs in the existing Next.js + React
+ Tailwind v4 codebase**, using its established components, tokens, and patterns.

Open any `designs/*.html` file directly in a browser to inspect it — they work offline, and you can
use browser DevTools to read exact computed styles, spacing, and class names on any element.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, copy, and interactions. Recreate
pixel-for-pixel using the codebase's existing components and tokens. Where the reference diverges
from current production layout, the reference wins.

---

## Design tokens (the new values)

All tokens live in **`src/styles/tokens.css`** as CSS custom properties in `:root`, exposed to
Tailwind through the `@theme inline` block as `--color-rahma-*`. **Keep the token names** — only
change the values below.

### Colour — the re-theme (change these 3 values)

| Token            | Current (green)      | New (blue)            | Role                                   |
|------------------|----------------------|-----------------------|----------------------------------------|
| `--rahma-green`  | `#30463f`            | **`#2589c8`**         | Primary. Buttons, links, dark panels, accents |
| `--rahma-charcoal`| `#1f2f2b`           | **`#144a78`**         | Headings, deepest blue, hover state for primary buttons |
| `--rahma-muted`  | `#53615d`            | **`#4a5a6a`**         | Body / secondary text                  |

### Colour — unchanged (already correct)

| Token            | Value      | Role                          |
|------------------|------------|-------------------------------|
| `--rahma-ivory`  | `#f7f3ec`  | Page background (warm cream)  |
| `--rahma-surface`| `#ffffff`  | Card / panel surface          |
| `--rahma-gold`   | `#f5a623`  | Accent — badges, eyebrows-on-dark, active chips |
| `--rahma-blue`   | `#1b82b8`  | Focus rings (`--ring`)        |
| `--rahma-border` | `#e8ded1`  | Warm hairline borders         |

### Derived tokens to double-check after the swap
These reference the old green hue and should be reviewed (retint toward the new blue or leave warm,
your call — the reference uses near-black scrims so they read fine either way):
- `--brand-glow: #edf6f3` and `--brand-calm-surface: #edf5f2` — faint green-tinted surfaces; retint to a blue-tinted equivalent if any UI uses them.
- `--shadow-soft-token` / `--shadow-card-token` / `--shadow-elevated-token` — these `color-mix` against `--brand-deep` (= `--rahma-green`), so they **auto-retint to blue-tinted shadows** once the token changes. No action needed; just be aware shadows shift hue.
- `--hero-scrim-token` / `--image-card-scrim-token` — hardcoded near-black teal (`rgba(7,22,28,…)`); fine as-is.

### Typography
Unchanged from the repo. Display = **Urbanist** (`--font-urbanist`), body = **Work Sans**
(`--font-work-sans`). Headings use `font-display` + `font-medium`, tight leading (`~1.04`).
Eyebrows: `text-sm font-semibold uppercase tracking-[0.18em]` in `rahma-green` (or `rahma-gold` on
dark backgrounds).

### Radii, shadows, spacing
Unchanged. Cards: `rounded-3xl`. Shadows: `shadow-soft` / `shadow-card` / `shadow-elevated`.
Section rhythm: `py-16 sm:py-20 lg:py-24`. Container: `max-w-7xl` (wide variant `max-w-[88rem]`).
Buttons/CTAs: pill `rounded-full`, `min-h-12`, `px-6`, `text-sm font-semibold`; min touch target 44px.

---

## Page → component mapping

The reference pages compose section components whose names map **almost 1:1** to existing files in
`src/components/<page>/`. Re-theme via tokens, then open each reference page and apply layout/copy
deltas section by section to the matching component.

### Home — `designs/01-home.html`
Page: `src/app/(public)/page.tsx` · Components: `src/components/home/`

| Reference section        | Component file                  |
|--------------------------|---------------------------------|
| Hero                     | `HomeHero.tsx`                  |
| Trust badges strip       | `HomeTrustStrip.tsx`           |
| Pain-point cards         | `PainPointCards.tsx`           |
| Package cards (bento)    | `HomePackageCards.tsx`         |
| Why Rahma Therapy        | `WhyRahmaTherapy.tsx`          |
| Appointment process      | `HomeAppointmentProcess.tsx`   |
| Review carousel          | `HomeReviewCarousel.tsx`       |
| Team preview             | `HomeTeamPreview.tsx`          |
| FAQ preview              | `HomeFAQPreview.tsx`           |
| Final CTA                | `HomeFinalCTA.tsx`             |

(`HomeSafetyAftercare.tsx` exists in the repo — confirm against the reference whether it stays in the composition.)

### About — `designs/02-about.html`
Page: `src/app/(public)/about/` · Components: `src/components/about/`

Hero → `AboutHero.tsx` · Stats strip → `AboutStatsStrip.tsx` · Trust snapshot → `TrustSnapshot.tsx` ·
Brand story → `BrandStory.tsx` · Team profiles → `TeamProfiles.tsx` · Milestone timeline →
`MilestoneTimeline.tsx` · Comfort section → `ComfortSection.tsx` · Final CTA → `AboutFinalCTA.tsx`.
(Repo extras to reconcile: `CredentialsBand.tsx`, `SafetyStandards.tsx`.)

### Services — `designs/03-services.html`
Page: `src/app/(public)/services/` · Components: `src/components/services/`

Hero → `ServicesHero.tsx` · Package cards → `PackageCards.tsx` · Package finder → `PackageFinder.tsx` ·
Comparison table → `PackageComparison.tsx` · Treatment methods → `TreatmentMethods.tsx` ·
Final CTA → `ServicesFinalCTA.tsx`.

### Package detail — `designs/04-package.html`
Components: `src/components/package-pages/`. The reference covers **5 slug variants**
(`supreme-combo-package`, `hijama-package`, `fire-cupping-package`, `massage-therapy-30-mins`,
`massage-therapy-1-hour`) — same layout, different content driven by `src/content/pages/packagePages.ts`.

Hero → `PackageHero.tsx` · Who it's for → `PackageWhoItsFor.tsx` · Includes → `PackageIncludes.tsx` ·
Treatment breakdown → `TreatmentBreakdown.tsx` · Benefits → `PackageBenefits.tsx` · FAQ →
`PackageFAQ.tsx` · Related packages → `RelatedPackages.tsx` · Final CTA → `PackageFinalCTA.tsx`.
(Also present: `PackageSummaryCard.tsx`, `PackageSessionSteps.tsx`, `PackageSafety.tsx`, `PackageImage.tsx`.)

### Reviews — `designs/05-reviews.html`
Page: `src/app/(public)/reviews/` · Components: `src/components/reviews/`

Hero → `ReviewsHero.tsx` · Featured mosaic → `FeaturedReviewsMosaic.tsx` · Explorer (filter + wall) →
`ReviewsExplorer.tsx` (+ `ReviewFilters.tsx`, `ReviewWall.tsx`, `ReviewCard.tsx`) · Theme highlights →
`ReviewThemeHighlights.tsx` · Leave-a-review CTA → `LeaveReviewCTA.tsx` · Final CTA → `ReviewsFinalCTA.tsx`.

### FAQs & Aftercare — `designs/06-faqs.html`
Page: `src/app/(public)/faqs-aftercare/` · Components: `src/components/faqs-aftercare/`

Hero → `FaqsAftercareHero.tsx` · Quick answers → `QuickAnswersStrip.tsx` · Before appointment →
`BeforeAppointment.tsx` · Aftercare tabs → `AftercareTabs.tsx` · Safety & suitability →
`SafetySuitability.tsx` · FAQ accordions → `FaqCategoryAccordions.tsx` · When to get advice →
`WhenToGetAdvice.tsx` · Final CTA → `FaqsAftercareFinalCTA.tsx`.

### Shared / layout (used across all pages)
`src/components/shared/` (`SectionContainer`, `SectionHeading`, `CredentialLogos`, `StarsRating`,
`TrustPill`, `CTAButtons`, `ImagePlaceholder`) and `src/components/layout/`
(`SiteHeader`, `SiteFooter`, `Logo`, `BookingTrigger`). `src/components/ui/accordion.tsx` backs the
FAQ/aftercare accordions.

---

## Interactions & behaviour
Match the reference exactly. Notable interactive pieces:
- **Review carousel** (home): horizontal scroll, prev/next buttons, play/pause auto-advance, cards expand on click (short → full quote). Pause control toggles label between "Play reviews" / "Pause reviews".
- **Accordions** (FAQ, package FAQ, home FAQ preview): single-open, chevron rotates 180° when open, active item gets gold chevron pill + green ring; `aria-expanded` / `aria-controls` wired.
- **Aftercare tabs** & **FAQ category tabs**: active tab uses `bg-rahma-gold text-rahma-green`, inactive `bg-white text-rahma-green` with hover border.
- **Reviews explorer**: search input + category filter pills (active = `bg-rahma-green text-white`), progressive "show more" wall.
- **Package finder** (services): selectable option chips, active = `bg-rahma-gold`.
- **Booking CTAs**: every "Book"/"Start booking" links to `?booking=1` (with optional `&services=<id>`) and carries `data-booking-trigger="true"` — this opens the existing `BookingExperience` modal. Do not rebuild the booking flow; keep the trigger contract.
- **Hover states**: primary buttons `hover:bg-rahma-charcoal`; cards lift (`hover:-translate-y-1 hover:shadow-card`); images scale (`group-hover:scale-105`). Focus-visible rings use `rahma-blue` (or `rahma-gold` on dark).

## Responsive behaviour
Mobile-first Tailwind. Reference frames are desktop (1440px). Standard breakpoints (`sm` 640, `lg` 1024).
Heroes and split sections stack to one column on mobile; multi-column card grids collapse
(`grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3/4`). Preserve the existing responsive class
patterns already in each component.

## Assets / imagery
The reference uses dashed **placeholder tiles** wherever a real photo belongs (label + intended file
path shown inside each tile, e.g. `/images/home/home-hero.avif`). Keep the existing
`ImagePlaceholder` / `ResponsiveImage` components and real image pipeline (`src/content/images.ts`) —
do **not** ship the placeholder tiles to production. Brand logo + credential logos (CMA, IPHM) are
existing assets; keep current `Logo` / `CredentialLogos` components.

## Content / copy
Copy in the reference matches the live content modules in `src/content/pages/` (`home.ts`,
`about.ts`, `services.ts`, `packagePages.ts`, `faqsAftercare.ts`) and `src/content/site/`. If you
change copy, change it in those content modules, not inline in components.

## Suggested implementation order
1. **Re-theme tokens** in `src/styles/tokens.css` (the 3 colour changes above). Run the site and visually confirm the whole public site shifts green → blue.
2. Review derived green-tinted tokens (`--brand-glow`, `--brand-calm-surface`) and retint if used.
3. Page by page (Home first), open the matching `designs/*.html`, and diff each section against its component — apply layout/spacing/copy deltas.
4. Verify interactions (carousel, accordions, tabs, filters, booking trigger) and responsive stacking.
5. Check focus rings, hover states, and WCAG contrast on the new blue (primary `#2589c8` on white; headings `#144a78`).

## Files in this bundle
- `designs/01-home.html` … `06-faqs.html` — self-contained HTML reference designs (open in a browser).
- `screenshots/01-home.png` … `06-faqs.png` — full-page screenshots of each design (visual reference).
- `index.html` — a contact sheet (full-page thumbnails) linking to all six designs for quick browsing.
- `README.md` — this document.
- `KICKOFF_PROMPT.md` — a ready-to-paste prompt for Claude Code.
