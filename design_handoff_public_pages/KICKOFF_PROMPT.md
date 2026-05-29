# Claude Code kickoff prompt

Paste the following into Claude Code, running inside the `rahmatherapy-next-refactor` repo with this
`design_handoff_public_pages/` folder placed at the repo root.

---

We're re-theming and polishing the **public (customer-facing) pages** of this site to match the
designs in `design_handoff_public_pages/`. Read `design_handoff_public_pages/README.md` in full
first — it contains the design tokens, the page→component mapping, and the interaction spec.

Key facts:
- This is primarily a **brand re-theme (clinic-green → therapy-blue + gold)** plus per-section layout
  polish. **Do not rewrite components from scratch.**
- The whole colour change is driven by **three CSS custom-property values** in
  `src/styles/tokens.css` (keep the token *names*, change the *values*):
  - `--rahma-green: #30463f` → `#2589c8`
  - `--rahma-charcoal: #1f2f2b` → `#144a78`
  - `--rahma-muted: #53615d` → `#4a5a6a`
- The reference files in `design_handoff_public_pages/designs/*.html` are the source of truth for
  look, layout, copy, and interactions. Open them and inspect computed styles / class names directly.

Please work in this order, pausing after each for me to review:
1. Apply the token re-theme in `src/styles/tokens.css`, run the dev server, and confirm the public
   site shifts green → blue site-wide. Review the derived `--brand-glow` / `--brand-calm-surface`
   tokens and retint if anything uses them.
2. Home page — diff each section in `src/components/home/` against `designs/01-home.html` and apply
   any layout/spacing/copy deltas.
3. Then About, Services, Package detail (5 slug variants), Reviews, FAQs & Aftercare — each against
   its matching `designs/*.html` and component folder per the README mapping.
4. Verify interactions (review carousel, accordions, tabs, review filters, the `?booking=1`
   `data-booking-trigger` modal contract) and mobile responsive stacking.
5. Check focus rings and WCAG contrast on the new blue.

Keep all copy in `src/content/pages/*` and `src/content/site/*`, not inline. Keep the existing image
pipeline (`ImagePlaceholder` / `ResponsiveImage`) — the dashed tiles in the references are
placeholders, not production imagery.
