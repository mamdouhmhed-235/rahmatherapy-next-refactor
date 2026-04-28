# Master Issue Register

## Status

- Phase: 8 consolidation
- Completion status: Complete for issue consolidation and de-duplication
- Purpose: Single canonical issue register for future remediation planning.
- Scope: Planned Rahma Therapy pages only; legacy pages are included only where shared shell behavior affects planned pages.
- Runtime remediation: None.

## Consolidation Method

- Read audit files `00` through `09`.
- Extracted all issue IDs referenced in category-specific audit files.
- Collapsed duplicate issue IDs into canonical issues where the observed behavior, expected behavior, fix path, and verification method are materially the same.
- Preserved duplicate/cross-category IDs as aliases so earlier audit matrices remain traceable.
- Kept separate issues where the remediation owner, verification method, or user risk differs.

## Summary By Severity

| Severity | Canonical issue count |
|---|---:|
| Blocker | 0 |
| High | 5 |
| Medium | 15 |
| Low | 1 |
| Polish | 0 |
| Total | 21 |

## Summary By Category

| Category | Count | Issue IDs |
|---|---:|---|
| Plan compliance | 2 | PLAN-HOME-001, PLAN-SERVICES-001 |
| Visual design | 1 | VISUAL-002 |
| UX | 2 | UX-001, UX-002 |
| Responsive layout | 3 | RESP-001, RESP-002, RESP-003 |
| Accessibility | 5 | A11Y-001, A11Y-002, A11Y-003, A11Y-004, A11Y-005 |
| Content/copy | 2 | PLAN-HOME-002, PLAN-REVIEWS-001 |
| CTA/booking | 2 | CTA-001, INTERACTION-001 |
| Navigation/routing | 1 | CTA-002 |
| Performance | 1 | PERF-001 |
| SEO | 0 | None |
| Deployment | 0 | None |
| Asset replacement | 2 | VISUAL-001, PLAN-FAQS-002 |
| Code quality | 0 | None |

## Summary By Route

| Route | Canonical issues |
|---|---|
| `/home-planned` | PLAN-HOME-001, PLAN-HOME-002, CTA-001, VISUAL-001, UX-001, RESP-003, A11Y-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/home-planning` | Inherits `/home-planned`: PLAN-HOME-001, PLAN-HOME-002, CTA-001, VISUAL-001, UX-001, RESP-003, A11Y-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/services` | PLAN-SERVICES-001, VISUAL-001, UX-001, RESP-001, A11Y-001, A11Y-002, A11Y-004, INTERACTION-001, CTA-002 |
| `/services/supreme-combo-package` | VISUAL-001, UX-001, UX-002, RESP-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/services/hijama-package` | VISUAL-001, UX-001, UX-002, RESP-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/services/fire-cupping-package` | VISUAL-001, UX-001, UX-002, RESP-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/services/massage-therapy-30-mins` | VISUAL-001, UX-001, UX-002, RESP-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/services/massage-therapy-1-hour` | VISUAL-001, UX-001, UX-002, RESP-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/about` | VISUAL-001, UX-001, A11Y-002, INTERACTION-001, CTA-002 |
| `/reviews` | PLAN-REVIEWS-001, VISUAL-001, VISUAL-002, UX-001, A11Y-002, A11Y-005, INTERACTION-001, CTA-002, PERF-001 |
| `/faqs-aftercare` | CTA-001, A11Y-003, PLAN-FAQS-002, VISUAL-001, UX-001, RESP-001, RESP-002, A11Y-001, A11Y-002, INTERACTION-001, CTA-002 |
| All planned routes/shared shell | UX-001, A11Y-002, INTERACTION-001, CTA-002 |

## Developer-Provided Asset Requirements

| Issue ID | Requires assets? | Asset dependency |
|---|---:|---|
| VISUAL-001 | Yes | Planned production imagery for hero, body media, credential, and final CTA areas across planned routes. |
| VISUAL-002 | Yes | Planned reviews proof imagery/mosaic assets. |
| PLAN-HOME-001 | Possible | Either provide `/images/home/home-hero.webp` or formally approve/update the `.avif` implementation path. |
| PLAN-FAQS-002 | Possible | Aftercare tab images must exist once the component is wired through `FaqsAftercareImage`; if missing, developer-provided assets are needed. |

## Alias And De-Duplication Map

| Referenced issue ID | Canonical issue ID | Reason |
|---|---|---|
| CONTENT-001 | PLAN-HOME-002 | Same shortened required disclaimer issue on planned home safety section. |
| PLAN-HOME-003 | CTA-001 | Same forbidden "Book Now page" booking-copy concept on planned home FAQ. |
| PLAN-FAQS-003 | CTA-001 | Same forbidden "Book Now page" booking-copy concept on FAQs/aftercare. |
| CONTENT-002 | PLAN-REVIEWS-001 | Same customer review text integrity failure, broadened to both reviews hero and featured mosaic. |
| PLAN-REVIEWS-002 | VISUAL-002 | Same reviews proof/mosaic visual drift from planned trust-building treatment. |
| PLAN-FAQS-001 | A11Y-003 | Same custom tab implementation drift that creates incomplete tab keyboard behavior. |
| CTA-003 | INTERACTION-001 | Same booking popup runtime failure from allowed query strings and booking triggers. |

All alias IDs above remain traceable to their source audit files and should not be reused for unrelated future findings.

## Canonical Issues

### PLAN-HOME-001

- Severity: Medium
- Category: Plan compliance
- Route: `/home-planned`, inherited by `/home-planning`
- Viewport: All
- Component/File: `src/components/planned-home/HomeHero.tsx`, `src/content/images.ts`
- Plan Source: `01-page-build-plans/01-home-page-codex-implementation-plan.md`
- Related Plan Section: HomeHero
- Alias/Cross-Category IDs: None
- Asset Dependency: Possible, if `/images/home/home-hero.webp` is required rather than approving `.avif`.
- Observed: The implemented hero uses `/images/home/home-hero.avif`.
- Expected: The plan specifies `/images/home/home-hero.webp` for the home hero image.
- Why It Matters: The planned asset inventory and implementation are misaligned, which weakens visual QA and deployment asset checks.
- Recommended Fix: Align implementation and manifest to the planned image path, or formally approve the `.avif` path and update planning documentation.
- Verification Method: Inspect `HomeHero` and image manifest, then verify the rendered hero source in browser dev tools.
- Likely Remediation Phase: Phase 1 visual/content alignment
- Status: Open

### PLAN-HOME-002

- Severity: High
- Category: Content/copy
- Route: `/home-planned`, inherited by `/home-planning`
- Viewport: All
- Component/File: `src/components/planned-home/HomeSafetyAftercare.tsx`
- Plan Source: `01-page-build-plans/01-home-page-codex-implementation-plan.md`, audit brief compliance rule
- Related Plan Section: HomeSafetyAftercare
- Alias/Cross-Category IDs: CONTENT-001
- Asset Dependency: No
- Observed: The safety note only includes the shortened sentence, "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care."
- Expected: The required disclaimer must remain unchanged where required: "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking."
- Why It Matters: The shortened copy removes suitability guidance that the audit brief treats as fixed compliance language.
- Recommended Fix: Replace the shortened safety note with the exact required disclaimer.
- Verification Method: Static source inspection plus rendered text check on `/home-planned`.
- Likely Remediation Phase: Phase 1 compliance copy alignment
- Status: Open

### CTA-001

- Severity: Medium
- Category: CTA/booking
- Route: `/home-planned`, inherited by `/home-planning`; `/faqs-aftercare`
- Viewport: All
- Component/File: `src/content/pages/plannedHome.ts`, `src/content/pages/faqsAftercare.ts`
- Plan Source: `01-home-page-codex-implementation-plan.md`, `06-faqs-aftercare-page-codex-implementation-plan.md`, `07-booking-popup-content-update-codex-implementation-plan.md`, audit brief booking rules
- Related Plan Section: HomeFAQPreview, FaqCategoryAccordions
- Alias/Cross-Category IDs: PLAN-HOME-003, PLAN-FAQS-003
- Asset Dependency: No
- Observed: FAQ copy refers to a "Book Now page" on planned home and FAQs/aftercare.
- Expected: Planned-page booking copy should refer to the booking popup/request flow using `?booking=1`, not a `/book-now` page concept.
- Why It Matters: `/book-now` is forbidden by the audit brief and no planned booking page exists.
- Recommended Fix: Update both FAQ answers to reference the booking request flow or WhatsApp without introducing a Book Now page.
- Verification Method: Static search for `Book Now page` and rendered FAQ checks on `/home-planned` and `/faqs-aftercare`.
- Likely Remediation Phase: Phase 1 booking copy alignment
- Status: Open

### PLAN-SERVICES-001

- Severity: Medium
- Category: Plan compliance
- Route: `/services`
- Viewport: All
- Component/File: `src/components/services/PackageFinder.tsx`
- Plan Source: `03-main-services-page-codex-implementation-plan.md`
- Related Plan Section: PackageFinder
- Alias/Cross-Category IDs: None
- Asset Dependency: No, if the planned image already exists; otherwise covered by VISUAL-001.
- Observed: The section renders `ImagePlaceholder` directly for `/images/services/package-finder.webp`.
- Expected: Planned services imagery should use `ServicesImage` or an equivalent route-owned image wrapper so real assets render when present.
- Why It Matters: The component bypasses the established image QA pattern and can stay a placeholder even after assets are provided.
- Recommended Fix: Render the PackageFinder image through `ServicesImage` or the route-owned image wrapper pattern.
- Verification Method: Static component inspection plus browser check that `/images/services/package-finder.webp` renders when present.
- Likely Remediation Phase: Phase 1 visual asset alignment
- Status: Open

### PLAN-REVIEWS-001

- Severity: High
- Category: Content/copy
- Route: `/reviews`
- Viewport: All
- Component/File: `src/components/reviews/ReviewsHero.tsx`, `src/components/reviews/FeaturedReviewsMosaic.tsx`, `src/lib/content/reviews.ts`
- Plan Source: `05-reviews-page-codex-implementation-plan.md`, audit brief review-text rule
- Related Plan Section: ReviewsHero, FeaturedReviewsMosaic
- Alias/Cross-Category IDs: CONTENT-002
- Asset Dependency: No
- Observed: The reviews hero uses `heroExcerpts`, and the featured mosaic uses local `quote` strings instead of exact canonical review text.
- Expected: Customer review text must not be rewritten, normalized, paraphrased, or excerpted as if it were original review text.
- Why It Matters: Altering customer-supplied review wording creates compliance and content-integrity risk.
- Recommended Fix: Source review proof text from `rahmaGoogleReviews` by stable review ID and render exact approved text, or avoid presenting shortened text as verbatim quotes.
- Verification Method: Compare rendered reviews hero and featured mosaic text against `src/lib/content/reviews.ts`.
- Likely Remediation Phase: Phase 1 content integrity alignment
- Status: Open

### VISUAL-002

- Severity: Medium
- Category: Visual design
- Route: `/reviews`
- Viewport: All
- Component/File: `src/components/reviews/ReviewsHero.tsx`, `src/components/reviews/FeaturedReviewsMosaic.tsx`
- Plan Source: `05-reviews-page-codex-implementation-plan.md`, Phase 3 visual audit
- Related Plan Section: ReviewsHero, FeaturedReviewsMosaic
- Alias/Cross-Category IDs: PLAN-REVIEWS-002
- Asset Dependency: Yes, planned reviews proof/mosaic imagery.
- Observed: The reviews proof area uses a large placeholder, plain inline proof text, and card-only featured reviews instead of the planned premium proof/mosaic treatment.
- Expected: Reviews proof should feel controlled, premium, and visually persuasive while preserving exact customer review text.
- Why It Matters: The reviews page is a trust-conversion page; weaker proof design reduces credibility.
- Recommended Fix: Rework the proof treatment using planned review imagery and canonical review data without rewriting customer text.
- Verification Method: Browser-check `/reviews` at mobile and desktop widths and compare against the planned mosaic direction.
- Likely Remediation Phase: Phase 2 reviews visual alignment
- Status: Open

### A11Y-003

- Severity: Medium
- Category: Accessibility
- Route: `/faqs-aftercare`
- Viewport: All
- Component/File: `src/components/faqs-aftercare/AftercareTabs.tsx`, `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`
- Plan Source: `06-faqs-aftercare-page-codex-implementation-plan.md`, Phase 5 accessibility audit
- Related Plan Section: AftercareTabs, FaqCategoryAccordions
- Alias/Cross-Category IDs: PLAN-FAQS-001
- Asset Dependency: No
- Observed: Custom tablists expose `role="tab"` and `aria-selected`, but arrow-key navigation did not move focus or selected state.
- Expected: Tablists should implement APG-style keyboard behavior, or use the planned shadcn/ui Tabs primitive.
- Why It Matters: Screen reader and keyboard users expect tab-role controls to support roving focus and arrow-key movement.
- Recommended Fix: Use shadcn/ui Tabs as planned, or implement complete tab keyboard handling and roving tabindex for both tablists.
- Verification Method: Focus the first tab, press ArrowRight/ArrowLeft/Home/End, and confirm focus and selected state update correctly.
- Likely Remediation Phase: Phase 2 accessibility interaction alignment
- Status: Open

### PLAN-FAQS-002

- Severity: Medium
- Category: Asset replacement
- Route: `/faqs-aftercare`
- Viewport: All
- Component/File: `src/components/faqs-aftercare/AftercareTabs.tsx`
- Plan Source: `06-faqs-aftercare-page-codex-implementation-plan.md`
- Related Plan Section: AftercareTabs
- Alias/Cross-Category IDs: None
- Asset Dependency: Possible, if planned aftercare tab images are not yet provided.
- Observed: Active tab imagery renders `ImagePlaceholder` directly instead of using `FaqsAftercareImage` or `next/image`.
- Expected: Planned FAQ/aftercare imagery should use the route-owned image wrapper so real public assets can render with the configured fallback.
- Why It Matters: The section can remain a placeholder even after assets exist, and it bypasses the shared image QA pattern.
- Recommended Fix: Render tab imagery through `FaqsAftercareImage` using the planned image path for each tab.
- Verification Method: Static component inspection plus browser check that aftercare tab images render when assets are present.
- Likely Remediation Phase: Phase 1 visual asset alignment
- Status: Open

### VISUAL-001

- Severity: High
- Category: Asset replacement
- Route: `/services`, focused package routes, `/about`, `/reviews`, `/faqs-aftercare`; partially affects `/home-planned` beyond the hero
- Viewport: All
- Component/File: `src/components/shared/ImagePlaceholder.tsx`, planned page image wrappers, `public/images`
- Plan Source: Phase 3 visual audit, planned page image inventories
- Related Plan Section: Hero, body media sections, final CTA sections
- Alias/Cross-Category IDs: None
- Asset Dependency: Yes, planned production imagery.
- Observed: Large labelled placeholders are visible across key planned-page hero, body, credential, and final CTA areas because planned media assets are not present or not wired.
- Expected: A polished production wellness site should show planned real imagery in primary visual areas, with placeholders only as development fallback.
- Why It Matters: Prominent placeholders make several planned routes feel unfinished and reduce trust.
- Recommended Fix: Add or wire the planned image assets through route-owned image wrappers, retaining placeholders only as fallback.
- Verification Method: Browser-check affected routes at 390px, 768px, 1024px, and 1440px and confirm real imagery replaces first-screen and final CTA placeholders.
- Likely Remediation Phase: Phase 1 visual asset alignment
- Status: Open

### UX-001

- Severity: Medium
- Category: UX
- Route: All planned routes
- Viewport: 1024px and 1440px
- Component/File: `src/components/layout/SiteHeader.tsx`
- Plan Source: Phase 3/4 browser audit
- Related Plan Section: Shared planned-page navigation
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Desktop and small-desktop headers show full navigation, a Book Now button, and a hamburger menu at the same time; at 1024px some labels wrap.
- Expected: Desktop navigation should provide a clear primary nav path without duplicate menu affordances or cramped wrapped labels.
- Why It Matters: Duplicate navigation affordances reduce polish and distract from booking.
- Recommended Fix: Define a clean breakpoint strategy: show full nav without hamburger on desktop, or switch fully to a compact menu before labels wrap.
- Verification Method: Browser-check header behavior at 1024px and 1440px across planned routes.
- Likely Remediation Phase: Phase 2 shared shell UX alignment
- Status: Open

### UX-002

- Severity: Medium
- Category: UX
- Route: `/services/supreme-combo-package`, `/services/hijama-package`, `/services/fire-cupping-package`, `/services/massage-therapy-30-mins`, `/services/massage-therapy-1-hour`
- Viewport: 390px mobile
- Component/File: `src/components/package-pages/PackageHero.tsx`
- Plan Source: `04-focused-package-pages-codex-implementation-plan.md`, Phase 3 visual audit
- Related Plan Section: PackageHero
- Alias/Cross-Category IDs: None
- Asset Dependency: No, unless solved through additional package-specific imagery covered by VISUAL-001.
- Observed: Package detail pages present long explanatory copy, price, CTAs, and trust pills before meaningful visual proof is visible on mobile.
- Expected: Package pages should feel sales-led and specific from the first viewport, with value and visual proof reinforcing each other early.
- Why It Matters: The first mobile viewport is the highest-intent area for package pages, and text-heavy composition can reduce booking momentum.
- Recommended Fix: Tighten mobile hero composition so package-specific proof/media appears earlier without losing required copy.
- Verification Method: Browser-check all focused package routes at 390px and verify the first viewport balances copy, CTA, and proof.
- Likely Remediation Phase: Phase 2 package UX alignment
- Status: Open

### RESP-001

- Severity: Medium
- Category: Responsive layout
- Route: `/services`, focused package routes, `/faqs-aftercare`
- Viewport: 768px tablet
- Component/File: Hero components using stacked text plus `min-h-[560px]` media cards
- Plan Source: Phase 4 responsive audit
- Related Plan Section: Hero sections
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Tablet heroes stack text and large media placeholders into very tall first sections.
- Expected: Tablet hero layouts should keep the primary message, CTAs, and enough of the next section visible without excessive vertical dead space.
- Why It Matters: Overlong tablet heroes slow scanning and make the first page segment feel heavy.
- Recommended Fix: Adjust tablet hero media sizing and spacing, or introduce an intermediate two-column breakpoint where appropriate.
- Verification Method: Browser-check affected routes at 768px and confirm the first section is no longer overlong.
- Likely Remediation Phase: Phase 2 responsive hero alignment
- Status: Open

### RESP-002

- Severity: Medium
- Category: Responsive layout
- Route: `/faqs-aftercare`
- Viewport: 390px mobile
- Component/File: `src/components/faqs-aftercare/AftercareTabs.tsx`, `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`
- Plan Source: Phase 4 responsive audit
- Related Plan Section: AftercareTabs, FaqCategoryAccordions
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Mobile tab rows require horizontal scrolling; the third aftercare tab starts outside the viewport without a strong scroll cue.
- Expected: Touch-scroll tab rows should make hidden options discoverable through a visible cue, gradient edge, or stacked mobile layout.
- Why It Matters: Users may miss treatment-specific aftercare or FAQ categories.
- Recommended Fix: Add a clearer mobile tab overflow affordance or stack tab options at narrow widths.
- Verification Method: Browser-check `/faqs-aftercare` at 390px and verify all tab/category choices are discoverable.
- Likely Remediation Phase: Phase 2 mobile interaction alignment
- Status: Open

### RESP-003

- Severity: High
- Category: Responsive layout
- Route: `/home-planned`, inherited by `/home-planning`
- Viewport: 390px mobile
- Component/File: `src/components/layout/SiteHeader.tsx`, `src/components/planned-home/HomeReviewCarousel.tsx`
- Plan Source: Phase 4 responsive audit
- Related Plan Section: Shared navigation, HomeReviewCarousel
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Browser measurement at 390px reported `document.scrollWidth` of 2268px from off-screen nav menu elements and an off-screen review carousel card.
- Expected: Mobile pages should have no horizontal overflow when the menu is closed and carousel content should remain contained.
- Why It Matters: Horizontal overflow is a core mobile quality failure and can cause accidental sideways scrolling or clipped layouts.
- Recommended Fix: Contain the closed mobile nav and review carousel overflow so off-screen elements do not expand document width.
- Verification Method: Browser-check `/home-planned` at 390px and confirm `document.documentElement.scrollWidth <= window.innerWidth`.
- Likely Remediation Phase: Phase 1 responsive containment fix
- Status: Open

### A11Y-001

- Severity: Medium
- Category: Accessibility
- Route: `/home-planned`, `/home-planning`, `/services`, `/faqs-aftercare`
- Viewport: All
- Component/File: Trust/quick-answer card sections in planned page components
- Plan Source: Phase 5 accessibility audit
- Related Plan Section: Semantic structure and heading hierarchy
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Several card-level headings use H2s directly under an existing page or section heading.
- Expected: Section headings should form the main H2 outline; nested card titles should usually be H3s or non-heading text.
- Why It Matters: Screen reader users who navigate by headings receive a noisy outline.
- Recommended Fix: Review card heading levels and demote nested card titles where they are not top-level page sections.
- Verification Method: Re-run heading outline checks and confirm one H1 with logical H2 sections and nested H3 card titles.
- Likely Remediation Phase: Phase 2 accessibility semantics
- Status: Open

### A11Y-002

- Severity: Medium
- Category: Accessibility
- Route: All planned routes
- Viewport: All
- Component/File: `src/app/(public)/layout.tsx`, `src/components/layout/SiteHeader.tsx`
- Plan Source: Phase 5 accessibility audit
- Related Plan Section: Keyboard access and landmark navigation
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: `main#main-content` exists, but there is no skip link before the repeated header/navigation.
- Expected: Keyboard users should have a visible-on-focus "Skip to main content" link targeting `#main-content`.
- Why It Matters: Keyboard users must traverse repeated navigation on every page before reaching content.
- Recommended Fix: Add a skip link before `SiteHeader` and ensure it becomes visible on focus.
- Verification Method: Press Tab from the top of each planned route and confirm the first focus stop is a visible skip link that moves focus to `main#main-content`.
- Likely Remediation Phase: Phase 1 accessibility foundation
- Status: Open

### A11Y-004

- Severity: Low
- Category: Accessibility
- Route: `/services`
- Viewport: All
- Component/File: `src/components/services/PackageFinder.tsx`
- Plan Source: Phase 5 accessibility audit
- Related Plan Section: PackageFinder
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Package finder option buttons update the recommended package visually, but the recommendation container is not a live region.
- Expected: Assistive technology users should receive a clear announcement when the recommendation changes, or focus should be managed intentionally.
- Why It Matters: Users who cannot see the visual update may not realize the recommendation changed.
- Recommended Fix: Add a polite live region or status text for recommendation changes without disrupting keyboard flow.
- Verification Method: Use screen reader or accessibility tree inspection to confirm package finder changes are announced.
- Likely Remediation Phase: Phase 3 accessibility polish
- Status: Open

### A11Y-005

- Severity: Medium
- Category: Accessibility
- Route: `/reviews`
- Viewport: All
- Component/File: `src/components/reviews/ReviewCard.tsx`
- Plan Source: Phase 5 accessibility audit
- Related Plan Section: Review wall
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Each review card renders a focusable `motion.article` with `tabIndex={0}` that expands text on focus, but the article has no interactive role, accessible name, or expanded state.
- Expected: Focusable elements should have clear semantics; expansion should be controlled by a named button or equivalent disclosure control.
- Why It Matters: The extra focus stop can confuse keyboard and screen reader users.
- Recommended Fix: Remove the article from tab order and rely on the named button, or make the card a fully accessible disclosure control.
- Verification Method: Tab through the review wall and confirm each focus stop has a clear role/name and announced expansion state.
- Likely Remediation Phase: Phase 2 review interaction accessibility
- Status: Open

### INTERACTION-001

- Severity: High
- Category: CTA/booking
- Route: All planned routes
- Viewport: All
- Component/File: `src/features/booking/BookingExperience.tsx`, `src/features/booking/hooks/useBookingUrlState.ts`, planned-page booking triggers
- Plan Source: `07-booking-popup-content-update-codex-implementation-plan.md`, Phase 5 accessibility and interaction audit, Phase 6 CTA audit
- Related Plan Section: Booking popup behavior, booking modal focus behavior
- Alias/Cross-Category IDs: CTA-003
- Asset Dependency: No
- Observed: Local browser testing found `?booking=1`, `?booking=1&services=hijama-package`, and visible booking triggers did not render the booking dialog.
- Expected: Allowed booking URLs and booking-trigger clicks should open the booking popup, preselect valid service IDs, move focus into the modal, trap focus, close on Escape, and restore focus.
- Why It Matters: Booking is the primary conversion interaction and modal accessibility cannot pass while the popup fails to open.
- Recommended Fix: Debug booking URL-state and trigger handling so the dialog opens reliably from direct query URLs and clicked CTAs; then verify modal focus behavior.
- Verification Method: Browser-test `?booking=1`, `?booking=1&services=<valid-id>`, and visible `data-booking-trigger="true"` clicks across planned page families.
- Likely Remediation Phase: Phase 1 booking interaction fix
- Status: Open

### CTA-002

- Severity: Medium
- Category: Navigation/routing
- Route: All planned routes through shared header/footer
- Viewport: All
- Component/File: `src/content/site/navigation.ts`, `src/content/site/footer.ts`
- Plan Source: Audit brief planned-route scope, Phase 6 CTA audit
- Related Plan Section: Shared planned-page navigation and footer
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Shared planned-page navigation and footer include `Home` -> `/`, which routes users to the legacy homepage.
- Expected: Planned-page navigation should keep users inside the planned-page experience unless a legacy route is intentionally retained.
- Why It Matters: Users can leave the planned premium design system and land on an out-of-scope legacy page from the planned shell.
- Recommended Fix: Decide whether planned-page navigation should point Home to `/home-planned`, label the legacy route explicitly, or remove the legacy Home link from planned shell navigation.
- Verification Method: Static navigation/footer inspection and browser click smoke check after remediation.
- Likely Remediation Phase: Phase 2 shared shell navigation alignment
- Status: Open

### PERF-001

- Severity: Medium
- Category: Performance
- Route: `/reviews`
- Viewport: All, highest risk on mobile
- Component/File: `src/components/reviews/ReviewCard.tsx`, `src/components/reviews/ReviewWall.tsx`, `src/components/reviews/ReviewsExplorer.tsx`
- Plan Source: Phase 7 performance audit
- Related Plan Section: ReviewsExplorer, ReviewWall
- Alias/Cross-Category IDs: None
- Asset Dependency: No
- Observed: Every visible review card is a Framer Motion article, and the initial review wall can render 24 animated cards before "Load more".
- Expected: Reviews wall animation should remain lightweight, especially on mobile and lower-powered devices.
- Why It Matters: The review wall may increase client-side rendering and animation work on a high-card-count trust page.
- Recommended Fix: Reduce default visible review count, remove per-card layout animation, or limit motion to small state changes while retaining reduced-motion support.
- Verification Method: Static source inspection plus follow-up mobile Lighthouse/profiling on `/reviews`.
- Likely Remediation Phase: Phase 3 performance polish
- Status: Open

## Issue Coverage Checklist

| Source audit file | Referenced issue IDs | Covered in canonical register? |
|---|---|---|
| `02-plan-compliance-matrix.md` | PLAN-HOME-001, PLAN-HOME-002, PLAN-HOME-003, PLAN-SERVICES-001, PLAN-REVIEWS-001, PLAN-REVIEWS-002, PLAN-FAQS-001, PLAN-FAQS-002, PLAN-FAQS-003 | Yes, direct or alias |
| `03-visual-ui-ux-audit.md` | VISUAL-001, VISUAL-002, UX-001, UX-002, RESP-001, RESP-002, RESP-003 | Yes |
| `04-responsive-mobile-audit.md` | VISUAL-001, VISUAL-002, UX-001, UX-002, RESP-001, RESP-002, RESP-003 | Yes |
| `05-accessibility-audit.md` | A11Y-001, A11Y-002, A11Y-003, A11Y-004, A11Y-005, INTERACTION-001, UX-001, VISUAL-001 | Yes |
| `06-content-copy-compliance-audit.md` | CONTENT-001, CONTENT-002, CTA-001, PLAN-HOME-002, PLAN-HOME-003, PLAN-REVIEWS-001, PLAN-FAQS-003 | Yes, direct or alias |
| `07-links-ctas-booking-audit.md` | CTA-001, CTA-002, CTA-003, INTERACTION-001, UX-001 | Yes, direct or alias |
| `08-performance-seo-deployment-audit.md` | PLAN-SERVICES-001, PLAN-FAQS-002, PERF-001, VISUAL-001, A11Y-005 | Yes |

## Phase 8 Register Gate

| Check | Status |
|---|---|
| Every issue from every audit file appears in this register | Complete |
| Overlapping issues de-duplicated with alias IDs preserved | Complete |
| Summary tables by severity, category, and route added | Complete |
| Developer-provided asset dependencies marked separately | Complete |
| Every canonical issue has severity | Complete |
| Every canonical issue has category | Complete |
| Every canonical issue has route/component | Complete |
| Every canonical issue has expected result | Complete |
| Every canonical issue has verification method | Complete |
| Runtime code changed | No |
