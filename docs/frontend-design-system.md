# Rahma Therapy Frontend Design System

This document records the implemented frontend direction for Rahma Therapy. Use it for all future frontend work so the site remains recognisable, polished, accessible, and consistent.

## Brand Principles

- Rahma Therapy should feel warm, calm, professional, trustworthy, image-led, and tactile.
- Preserve the refined no-tagline logo family as the identity anchor.
- Keep the homepage photographic hero as a signature first-viewport element.
- Keep treatment/service pages image-led, with clear CTAs and readable text over photography.
- Prefer refinement over reinvention. The site should feel like Rahma Therapy made better, not a new template.

## Color Tokens

- Use `src/styles/tokens.css` for semantic colors and reusable visual values.
- `--primary` is the main clinical/trust action color. Use it for primary CTAs, active progress, links, icons, and selected booking states.
- `--accent` and `--brand-highlight` are warm supporting accents. Use them sparingly for emphasis, badges, and brand warmth.
- `--brand-deep` anchors dark text, footer links, deep CTA gradients, and high-contrast surfaces.
- `--brand-surface`, `--brand-calm-surface`, and `--brand-warm-surface` support calm page backgrounds and booking surfaces.
- Do not introduce random one-off colors. Add or reuse semantic tokens instead.

## Typography

- Use the existing display/body font stack from the app tokens.
- Keep hero headings large and confident, but prevent mobile overflow with stable `clamp()` sizes from the parity layer.
- Use balanced text for major hero and section headings when practical.
- Avoid negative letter spacing and viewport-width font scaling.

## Layout Rhythm

- Keep page sections spacious and calm using the existing `padding-section-*`, container, and spacer classes.
- Cards use `--radius-card`; hero/large framed surfaces use `--radius-section`.
- Use `--shadow-card-token` for image cards and `--shadow-elevated-token` for signature framed hero surfaces.
- Avoid cards inside cards. Use cards for repeated content, service tiles, pricing, and booking panels only.

## Header And Footer

- Header stays fixed with a light translucent surface, subtle border, and clear booking CTA.
- Navigation must include only active public routes from `src/content/site/navigation.ts`.
- Active, hover, and focus states must remain visible.
- Mobile menu must be keyboard operable and close on Escape.
- Footer should be calm and structured, with service links in semantic navigation and no empty legal nav.

## Hero Rules

- The home hero remains a massive photographic first impression.
- Use the hero scrim token to protect readability without flattening or hiding the image.
- CTA placement should remain visible in the hero content block and full-width on narrow mobile when needed.
- Service-page heroes should keep their service-specific image layouts and improve polish through consistent spacing, radius, and shadow.

## Service Cards And Image Overlays

- Service/treatment cards remain image-first.
- Use the shared image-card scrim token so text stays readable while most of the image remains visible.
- Keep pricing as a compact pill, not a heavy opaque block.
- Use hover/focus lift only as a subtle affordance and disable motion under reduced-motion preferences.

## CTA, Button, Link, And Card Rules

- Primary buttons use `--primary`; dark hover uses `--brand-deep`.
- Buttons are pill-shaped, clearly focusable, and have subtle lift/shadow.
- Links in navigation/footer should show visible hover/focus changes.
- Image cards and pricing cards use token radii, borders, and shadows for a tactile but restrained feel.

## Booking Popup UX

- Booking remains frontend-only. Do not add API, database, auth, email, Supabase, Resend, or TanStack Query behavior.
- Preserve Zustand draft state, URL/hash triggers, package preselection, package validation, RHF/Zod details validation, DayPicker/time selection, review acknowledgement, and prepared-result behavior.
- The popup should feel guided: clear heading, progress, selected package states, summary panel, visible errors, and sticky mobile actions.
- Form fields must show labels, useful invalid messages, and visible `aria-invalid` styling.
- Keep focus return to the trigger after closing.

## Motion

- Motion should be restrained and functional: hover lift, step transition, and selected-state feedback.
- Respect `prefers-reduced-motion`; transforms and animated transitions must not be required to understand or use the interface.
- Do not add decorative motion or unrelated animated backgrounds.

## Responsive Expectations

- Check mobile around 375px, tablet around 768px, and desktop around 1440px.
- Hero text, buttons, service overlays, pricing cards, and booking footer actions must not overlap or overflow.
- Booking uses a two-column desktop layout and a single-column mobile layout with sticky actions.

## Accessibility Expectations

- Maintain semantic landmarks, one clear page `h1`, and logical heading order.
- All interactive controls must be keyboard reachable.
- Focus states must remain visible via token-based focus rings.
- Dialog and mobile menu must be operable with keyboard and Escape.
- Form controls need labels and invalid states.
- Image overlays must maintain practical contrast for text.

## Do Not Rules

- Do not restore removed pages or stale nav links.
- Do not replace the site with a generic template.
- Do not shrink the home hero into a small card.
- Do not bury images under heavy opaque overlays.
- Do not add decorative blobs, orbs, unrelated gradients, or random colors.
- Do not make booking harder, less clear, or backend-dependent.
- Do not create broad abstractions or new libraries for visual-only work.

## Visual Verification Checklist

- Home hero: readable text, visible image, clear CTA, mobile fit.
- Service cards: image-led, readable overlay, visible price, hover/focus state.
- Header: logo balance, active state, CTA clarity, mobile menu, Escape close.
- Footer: link hierarchy, mobile stacking, no empty nav.
- Service pages: hero image layout, benefit cards, pricing, CTA, FAQ rhythm.
- Booking: package selection, validation, details, date/time, review acknowledgement, prepared state, close/reopen focus.
- Run `pnpm lint` and `pnpm build` before finishing frontend changes.
