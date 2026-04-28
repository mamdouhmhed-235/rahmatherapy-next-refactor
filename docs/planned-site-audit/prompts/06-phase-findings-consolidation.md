# Prompt 06: Findings Consolidation And Master Issue Register

```txt
You are executing Phase 8 of the planned Rahma Therapy site audit.

Use relevant skills:
- technical writing
- issue triage
- frontend QA
- release risk assessment

Goal:
Consolidate all audit findings into a single master issue register that is complete, categorized, deduplicated, and ready to drive a future remediation implementation plan.

This is documentation-only. Do not fix runtime code.

Read all audit files:
- 00-audit-brief.md
- 01-route-and-codebase-inventory.md
- 02-plan-compliance-matrix.md
- 03-visual-ui-ux-audit.md
- 04-responsive-mobile-audit.md
- 05-accessibility-audit.md
- 06-content-copy-compliance-audit.md
- 07-links-ctas-booking-audit.md
- 08-performance-seo-deployment-audit.md
- 09-master-issue-register.md

Tasks:
1. Find every issue mentioned in category-specific audit files.
2. Deduplicate overlapping issues.
3. Keep cross-category links where one issue affects multiple areas.
4. Assign stable issue IDs.
5. Assign severity:
   - Blocker
   - High
   - Medium
   - Low
   - Polish
6. Assign category:
   - Plan compliance
   - Visual design
   - UX
   - Responsive layout
   - Accessibility
   - Content/copy
   - CTA/booking
   - Navigation/routing
   - Performance
   - SEO
   - Deployment
   - Asset replacement
   - Code quality
7. For every issue, document:
   - route
   - viewport if applicable
   - component/file
   - plan source
   - observed behavior
   - expected behavior
   - why it matters
   - recommended fix
   - verification method
   - likely remediation phase
   - status
8. Add summary tables by severity, category, and route.
9. Mark issues that require developer-provided assets separately.

Gate before stopping:
- Every issue from every audit file appears in 09-master-issue-register.md.
- No issue lacks severity, category, route/component, expected result, or verification method.
- No runtime code changed.
```

