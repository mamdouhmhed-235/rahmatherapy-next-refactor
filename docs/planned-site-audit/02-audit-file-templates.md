# Audit File Templates

Use these templates when executing the planned-site audit.

## Master Issue Register Template

```md
# Master Issue Register

## Summary

| Severity | Count |
|---|---:|
| Blocker | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Polish | 0 |

## Issues

### ISSUE-ID

- Severity:
- Category:
- Route:
- Viewport:
- Component/File:
- Plan Source:
- Related Plan Section:
- Observed:
- Expected:
- Why It Matters:
- Recommended Fix:
- Verification Method:
- Remediation Phase:
- Status:
```

## Plan Compliance Matrix Template

```md
# Plan Compliance Matrix

## /route-name

Plan source:

Expected route:

Implementation files:

### Section Order

| Order | Planned Section | Implemented Section/File | Present | Correct Order | Content Match | Design Match | CTA Match | Interaction Match | Issues |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | SectionName | ComponentName | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

### Notes

- 
```

## Visual UI/UX Finding Template

```md
### VISUAL-ID

- Severity:
- Route:
- Viewport:
- Component:
- Observed visual issue:
- Professional impact:
- Plan/design expectation:
- Recommended fix:
- Verification:
```

## Design Consistency Matrix Template

```md
## Design Consistency Matrix

| Page | Hero Treatment | Card Radius | Spacing Rhythm | Typography Scale | Image Overlay Contrast | CTA Styling | Dark Green Sections | Final CTA | Placeholder Quality | Issues |
|---|---|---|---|---|---|---|---|---|---|---|
| /home-planned | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /services | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /services/supreme-combo-package | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /services/hijama-package | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /services/fire-cupping-package | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /services/massage-therapy-30-mins | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /services/massage-therapy-1-hour | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /about | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /reviews | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| /faqs-aftercare | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
```

## Responsive Finding Template

```md
### RESP-ID

- Severity:
- Route:
- Viewport:
- Component:
- Observed:
- Expected:
- User impact:
- Recommended fix:
- Verification:
```

## Accessibility Finding Template

```md
### A11Y-ID

- Severity:
- Route:
- Component:
- WCAG/Accessibility Concern:
- Keyboard/Screen Reader Impact:
- Observed:
- Expected:
- Recommended fix:
- Verification:
```

## Content/Compliance Finding Template

```md
### CONTENT-ID

- Severity:
- Route:
- Component/Content Source:
- Plan source:
- Observed copy:
- Expected copy:
- Compliance risk:
- Recommended fix:
- Verification:
```

## CTA/Link Finding Template

```md
### CTA-ID

- Severity:
- Route:
- Component/File:
- Current href:
- Expected href:
- Booking/service ID impact:
- Recommended fix:
- Verification:
```

## Performance/Deployment Finding Template

```md
### PERF-ID

- Severity:
- Route:
- Component/File:
- Observed:
- Impact:
- Recommended fix:
- Verification:
```

## Remediation Phase Template

```md
## Phase N: Phase Name

### Goal

### Issues Addressed

- ISSUE-ID

### Files Likely Touched

- 

### Constraints

- Preserve approved copy unless issue requires restoring plan copy.
- Do not alter unrelated pages.
- Do not redesign outside the issue scope.

### Implementation Steps

1. 
2. 
3. 

### Verification Gate

- 

### Deployment Gate

- Commit:
- Push:
- Wait for Vercel:
- Check live route(s):

### Rollback Note

```
