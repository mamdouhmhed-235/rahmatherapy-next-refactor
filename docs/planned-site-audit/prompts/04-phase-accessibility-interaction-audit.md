# Prompt 04: Accessibility And Interaction Audit

```txt
You are executing Phase 5 of the planned Rahma Therapy site audit.

Use relevant skills:
- Accessibility Auditor
- WCAG 2.1 AA review
- keyboard navigation testing
- semantic HTML review
- ARIA review
- interaction QA

Goal:
Audit accessibility and interaction quality across the planned pages. Verify users can operate the site with keyboard, focus states are visible, reduced motion is respected, and no critical information is hover-only.

This is documentation-only. Do not fix runtime code.

Read first:
- docs/planned-site-audit/00-master-brief.md
- docs/audits/planned-site-quality-audit/01-route-and-codebase-inventory.md
- docs/audits/planned-site-quality-audit/02-plan-compliance-matrix.md
- docs/audits/planned-site-quality-audit/09-master-issue-register.md

Audit checks:
1. One H1 per page.
2. Correct landmark structure and semantic sections.
3. Logical heading hierarchy.
4. Keyboard access for:
   - header nav
   - mobile nav
   - booking popup
   - accordions
   - aftercare tabs
   - FAQ category filters
   - package finder
   - reviews search/filter/load more/cards
   - About timeline
   - package cards and related package cards
5. Visible focus states.
6. No hover-only information.
7. Buttons and links use the correct semantic elements.
8. Form/search fields have accessible names.
9. Tab/filter controls expose selected state.
10. Expand/collapse controls expose expanded state.
11. Reduced-motion behavior exists for carousel, timeline, and Motion components.
12. Image overlays have sufficient contrast.
13. Placeholder images have clear visible labels and accessible names.
14. Booking modal has appropriate focus behavior.

Write findings into:
- 05-accessibility-audit.md
- 09-master-issue-register.md

Use issue prefixes:
- A11Y
- INTERACTION

Gate before stopping:
- Every planned-page interactive component has been checked.
- Findings include user impact and verification method.
- Every issue appears in the master issue register.
- No runtime code changed.
```

