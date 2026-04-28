# Remediation Prompt Pack

Use these prompts to guide Codex through the Rahma Therapy planned-site remediation work one phase at a time.

## How To Use

1. Start with `00-start-here.md`.
2. Send `01-phase-critical-cta-mobile-containment.md`.
3. Wait for Codex to complete, validate, commit, push, and report the phase gate.
4. Send the next numbered phase prompt only after the previous gate passes.
5. If the session is compacted or Codex loses context, send `99-context-recovery.md` before continuing.

## Source Of Truth

The active audit and remediation pack is:

- `docs/audits/planned-site-quality-audit/00-audit-brief.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

Category support files:

- `01-route-and-codebase-inventory.md`
- `02-plan-compliance-matrix.md`
- `03-visual-ui-ux-audit.md`
- `04-responsive-mobile-audit.md`
- `05-accessibility-audit.md`
- `06-content-copy-compliance-audit.md`
- `07-links-ctas-booking-audit.md`
- `08-performance-seo-deployment-audit.md`

## Non-Negotiable Overrides

- Do not replace the homepage short disclaimer with the full disclaimer.
- Keep the full disclaimer on Services, focused package pages, and FAQs/Aftercare.
- Review excerpts are allowed if exact canonical excerpts or exact canonical `shortExcerpt` values.
- Do not force the home hero from `.avif` to `.webp`.
- Do not reduce the Reviews wall below 24 initially visible reviews unless measured performance proves it necessary.
- Retire confirmed legacy/dead routes during the dedicated cleanup phase after identifying the current canonical planned homepage route.
- Do not redesign the booking popup.
- Do not remove planned copy, CTAs, prices, package names, therapist-gender wording, or safety/suitability content.
- Do not add `/book-now`, `?package=`, or `/services/mobile-massage-therapy`.
- Use approved assets only; otherwise keep labelled placeholders.
