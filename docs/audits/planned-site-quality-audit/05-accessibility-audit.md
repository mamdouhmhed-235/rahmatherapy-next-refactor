# Accessibility Audit

## Status

- Phase: 5
- Completion status: Complete
- Scope: Planned Rahma Therapy pages only.
- Standard used: WCAG 2.1 AA-oriented manual review with browser accessibility snapshots and static component inspection.
- Runtime remediation: None.

## Method

- Read the master audit brief, route inventory, plan compliance matrix, and master issue register.
- Audited representative planned routes locally at `http://127.0.0.1:3000`.
- Used browser accessibility snapshots for landmarks, headings, tab roles, placeholder names, and modal presence.
- Used static code review for interaction semantics, ARIA state, focus-visible styles, reduced-motion handling, and form labeling.
- Used keyboard checks for custom tablists and booking-trigger behavior where practical.

## Checklist

- [x] Verify one H1 per planned page.
- [x] Verify landmarks and heading hierarchy.
- [x] Test keyboard access for header, mobile nav, booking popup, accordions, aftercare tabs, FAQ filters, package finder, review filters, review cards, and About timeline.
- [x] Check visible focus states and reduced-motion behavior.
- [x] Check placeholder accessible names and overlay contrast.
- [x] Copy every accessibility and interaction issue into `09-master-issue-register.md`.
- [x] Confirm no runtime code was changed.

## Page Structure Results

| Route | H1 count | Main landmark | Heading hierarchy | Notes | Issue IDs |
|---|---:|---:|---|---|---|
| `/home-planned` | 1 | Yes | Partial | Trust-strip cards use H2s directly after the H1, which makes the outline noisy before the main content sections. | A11Y-001 |
| `/home-planning` | N/A | N/A | N/A | Redirect alias; inherits `/home-planned` once redirected. | A11Y-001 |
| `/services` | 1 | Yes | Partial | Trust-strip card titles use H2s before the package section H2. | A11Y-001 |
| `/services/supreme-combo-package` | 1 | Yes | Pass | Shared package template has a logical H1 to H2/H3 flow. | None |
| `/services/hijama-package` | 1 | Yes | Pass | Shared package template has a logical H1 to H2/H3 flow. | None |
| `/services/fire-cupping-package` | 1 | Yes | Pass | Shared package template has a logical H1 to H2/H3 flow. | None |
| `/services/massage-therapy-30-mins` | 1 | Yes | Pass | Shared package template has a logical H1 to H2/H3 flow. | None |
| `/services/massage-therapy-1-hour` | 1 | Yes | Pass | Shared package template has a logical H1 to H2/H3 flow. | None |
| `/about` | 1 | Yes | Pass | About page headings are generally logical and section-led. | None |
| `/reviews` | 1 | Yes | Pass | Review cards use reviewer names as H3s under review wall sections. | None |
| `/faqs-aftercare` | 1 | Yes | Partial | Quick answer cards use H2s directly under a parent H2, which makes the outline noisy. | A11Y-001 |

## Interactive Component Matrix

| Component / flow | Routes | Keyboard access | Focus visible | ARIA / semantic state | Reduced motion | Notes | Issue IDs |
|---|---|---|---|---|---|---|---|
| Header desktop nav | All planned routes | Pass | Pass | Uses links inside `nav aria-label="Primary navigation"`. | N/A | Duplicate desktop/hamburger UX tracked separately as `UX-001`. | None |
| Mobile nav button | All planned routes | Pass | Pass | Button exposes `aria-expanded`, `aria-controls`, and stateful label. | N/A | Menu opens/closes semantically, but no skip link exists before repetitive navigation. | A11Y-002 |
| Skip-to-content path | All planned routes | Fail | N/A | `main#main-content` exists, but there is no skip link. | N/A | Keyboard users must traverse repeated header controls on every page. | A11Y-002 |
| Booking popup URL trigger | All planned routes | Fail in browser test | N/A | Popup did not appear from `?booking=1` or booking-trigger click in local testing. | Not verified | Modal focus behavior cannot pass while the popup fails to open. | INTERACTION-001 |
| Booking popup modal shell | All planned routes | Blocked | Blocked | Static code uses Base UI Dialog, `Dialog.Title`, `Dialog.Description`, `aria-modal`, inert shell, and final focus restore. | Pass in CSS/MotionStep code | Static structure is promising, but runtime opening failed. | INTERACTION-001 |
| Accordions | `/home-planned`, `/services`, package routes, `/faqs-aftercare` | Pass | Pass | Buttons expose `aria-expanded` and `aria-controls`; panels use `role="region"` and `aria-labelledby`. | N/A | No hover-only dependency observed. | None |
| Aftercare tabs | `/faqs-aftercare` | Partial | Pass | Buttons use `role="tab"`, `aria-selected`, and `aria-controls`. | Pass for Framer Motion | ArrowRight did not move focus or selection during browser test. | A11Y-003 |
| FAQ category filters | `/faqs-aftercare` | Partial | Pass | Buttons use `role="tab"`, `aria-selected`, and `aria-controls`. | N/A | Same custom tablist pattern lacks arrow-key behavior and roving tabindex. | A11Y-003 |
| Package finder | `/services` | Pass | Pass | Option buttons use `aria-pressed`; result updates visually. | Pass for Framer Motion | Keyboard activation works through native buttons; no live announcement for recommendation changes. | A11Y-004 |
| Reviews search | `/reviews` | Pass | Pass | Search input has `aria-label="Search reviews by keyword"`. | N/A | Search field is accessible by name. | None |
| Reviews category filters | `/reviews` | Pass | Pass | Buttons use `aria-pressed`; horizontal scroll discoverability tracked as responsive issue. | N/A | Native buttons are keyboard operable. | None |
| Reviews load more | `/reviews` | Pass | Pass | Native button. | N/A | No issue observed. | None |
| Review cards | `/reviews` | Partial | Pass | Focusable article expands on focus; nested button exposes `aria-expanded`. | Pass through `useReducedMotion` | The focusable article is an extra unnamed focus stop with no role or expanded state. | A11Y-005 |
| About timeline | `/about` | Pass | Pass | Milestone buttons use `aria-pressed`; active milestone is visible. | Pass through `useReducedMotion` | Keyboard users can activate milestones with native buttons. | None |
| Package cards | `/home-planned`, `/services`, package routes | Pass | Pass | Links and booking triggers are native anchors. | N/A | No hover-only critical content observed. | None |
| Related package cards | Package routes | Pass | Pass | Native links. | N/A | No issue observed. | None |
| Placeholder images | Most planned routes | N/A | N/A | `role="img"` with visible placeholder label and descriptive `aria-label`. | N/A | Accessible names are clear, even though visual placeholder volume is tracked as `VISUAL-001`. | None |

## Browser Verification Notes

### H1 and Landmarks

- Representative static checks found exactly one H1 on `/home-planned`, `/services`, `/services/supreme-combo-package`, `/about`, `/reviews`, and `/faqs-aftercare`.
- `main#main-content` is present through `src/app/(public)/layout.tsx`.
- Header and footer landmarks are present.
- No skip link is present before the header.

### Custom Tabs

- `/faqs-aftercare` exposes aftercare and FAQ category controls as `role="tab"` inside labelled `tablist` containers.
- Focus was placed on `Hijama / wet cupping`; pressing `ArrowRight` left focus and selected state unchanged.
- APG-style tab keyboard behavior is therefore incomplete.

### Booking Popup

- Navigating to `/services?booking=1&services=hijama-package` did not render a dialog in the browser test.
- Clicking a visible booking trigger changed/kept the URL at `?booking=1` but did not render `Request a home appointment`.
- Because the popup did not open, focus trap, initial focus, Escape behavior, and focus restoration could not be fully verified at runtime.
- Static code indicates intended modal support through Base UI Dialog, inert shell elements, and final focus restore, but runtime behavior is currently the gate failure.

### Reduced Motion

- `HomeReviewCarousel` checks `prefers-reduced-motion` and pauses auto-scroll when reduced motion is requested.
- `MilestoneTimeline`, `PackageFinder`, `AftercareTabs`, `ReviewCard`, `Reveal`, and booking `MotionStep` use Framer Motion `useReducedMotion`.
- Booking CSS contains a `prefers-reduced-motion: reduce` media query.
- No Phase 5 reduced-motion issue was logged for the requested carousel, timeline, and Motion components.

### Image Overlays And Placeholders

- Placeholder images expose visible labels and `role="img"` accessible names including intended file paths.
- Overlay contrast was readable in browser snapshots reviewed during Phase 3/4 and remains covered by visual issue `VISUAL-001` for production polish, not by a separate accessibility failure.

## New Phase 5 Issues

| Issue ID | Severity | Route(s) | Summary |
|---|---|---|---|
| A11Y-001 | Medium | `/home-planned`, `/home-planning`, `/services`, `/faqs-aftercare` | Card-level headings use H2s directly under parent sections, creating a noisy document outline. |
| A11Y-002 | Medium | All planned routes | No skip link is provided even though `main#main-content` exists. |
| A11Y-003 | Medium | `/faqs-aftercare` | Custom tablists expose tab roles but do not support arrow-key tab navigation. |
| A11Y-004 | Low | `/services` | Package finder recommendation changes are visual only and are not announced to assistive technology. |
| A11Y-005 | Medium | `/reviews` | Review cards add a focusable article that expands on focus but has no interactive role/name/expanded state. |
| INTERACTION-001 | High | All planned routes | Booking popup did not open from `?booking=1` or booking-trigger clicks in local browser testing. |

## Phase 5 Gate

- Every planned-page interactive component checked: Yes.
- Findings include user impact and verification method: Yes, in `09-master-issue-register.md`.
- Every issue appears in the master issue register: Yes.
- Runtime code changed: No.
