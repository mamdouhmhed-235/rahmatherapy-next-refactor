# Remediation Implementation Plan

## Status

- Phase: 9
- Completion status: Complete
- Purpose: Future implementation plan for remediating the planned Rahma Therapy site audit findings.
- Runtime remediation performed in this phase: None

## Executive Summary

The planned Rahma Therapy pages are structurally complete and deployed, but the audit found 19 canonical issues or tracked decision/tooling items that must be remediated, deferred, or re-verified before the planned-site experience is production-polished. The highest-risk items are the booking popup failing to open, mobile horizontal overflow, missing planned media assets, and review excerpt verification.

This plan deliberately separates remediation into small phases that can each be implemented, validated, committed, pushed, and checked on Vercel before the next phase starts. Asset-dependent work is isolated so future implementers do not invent imagery or alter the visual plan without approved assets.

## Scope

In scope:

- Planned routes and the final planned homepage route after cleanup.
- Shared layout, navigation, footer, booking, image wrappers, and route ownership where they affect planned pages.
- Removal of confirmed legacy/dead routes and old page code after the implementer identifies the current canonical planned homepage route.
- Remediation of all canonical issue IDs in `09-master-issue-register.md`.
- Local and live verification after each implementation phase.

Non-goals:

- Do not redesign the planned site outside targeted audit fixes.
- Do not keep legacy pages or dead old-page code once the planned-only experience is ready, but verify current route ownership before deleting anything.
- Do not rewrite customer review text.
- Do not invent or generate replacement assets without developer approval.
- Do not edit planning bundle files unless a future task explicitly asks to update source-of-truth documentation.
- Do not require screenshots as committed artifacts.
- Do not replace the homepage short disclaimer with the full disclaimer. The approved HomeSafetyAftercare disclaimer is: "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care."
- Keep the full disclaimer on Services, focused package pages, and FAQs/Aftercare where required.
- Review excerpts are allowed in hero and featured sections if they are exact canonical excerpts or exact canonical `shortExcerpt` values.
- Treat `/images/home/home-hero.avif` as the approved working home hero image unless the developer provides a matching WebP.
- Keep 24 initial Reviews wall cards unless measured performance proves reduction is necessary.
- Retire the legacy homepage and other confirmed legacy/dead pages during remediation. First identify the current canonical planned homepage route, then remove legacy links/routes/code cleanly.
- Do not redesign the booking popup; fix only behavior/accessibility if needed.

## Prioritization Model

Priority is based on:

1. Conversion and route blockers: booking popup and broken core mobile behavior.
2. Compliance risk: forbidden booking-page wording and review excerpt integrity.
3. Accessibility barriers: keyboard, headings, skip link, tab semantics.
4. Responsive and navigation quality: mobile/tablet usability and shared shell clarity.
5. Asset replacement and visual polish: high visual impact but blocked if assets are missing.
6. Performance and final release checks: lower risk after behavior and content are correct.

## Phase Ordering Rationale

| Phase | Rationale |
|---|---|
| 1. Critical CTA and mobile containment | Booking failure blocks conversion, and mobile overflow is a high-severity usability failure. |
| 2. Content and plan-compliance restoration | Booking copy, review excerpt verification, and image-wrapper behavior should be fixed before visual polish or performance work. |
| 3. Accessibility and interaction fixes | Once core content and booking behavior are correct, keyboard and semantic behavior can be verified accurately. |
| 4. Responsive/mobile layout and navigation | Layout tuning should happen after semantic and content changes because content dimensions can change. |
| 5. Asset replacement and visual polish | Requires approved assets; isolate so missing assets do not block non-asset fixes. |
| 6. Performance, SEO, and deployment hardening | Performance checks are meaningful after UI behavior and review wall semantics are stable. |
| 7. Legacy cleanup and strict plan-compliance re-audit | Removes old/dead routes only after planned behavior is stable, then verifies every planned page against its plan file. |
| 8. Final cross-page verification | Confirms the full planned-site experience after all targeted phases. |

## Issue Assignment Matrix

| Issue ID | Remediation phase | Status |
|---|---|---|
| INTERACTION-001 | Phase 1 | Assigned |
| RESP-003 | Phase 1 | Assigned |
| CTA-001 | Phase 2 | Assigned |
| REVIEW-EXCERPT-VERIFY | Phase 2 | Assigned |
| PLAN-SERVICES-001 | Phase 2 | Assigned |
| PLAN-FAQS-002 | Phase 2 | Assigned, may need asset availability |
| A11Y-001 | Phase 3 | Assigned |
| A11Y-002 | Phase 3 | Assigned |
| A11Y-003 | Phase 3 | Assigned |
| A11Y-004 | Phase 3 | Assigned |
| A11Y-005 | Phase 3 | Assigned |
| UX-001 | Phase 4 | Assigned |
| UX-002 | Phase 4 | Assigned |
| RESP-001 | Phase 4 | Assigned |
| RESP-002 | Phase 4 | Assigned |
| LEGACY-001 | Phase 7 | Assigned |
| VISUAL-001 | Phase 5 | Assigned, blocked if approved assets are unavailable |
| VISUAL-002 | Phase 5 | Assigned, blocked if approved assets are unavailable |
| PERF-001 | Phase 6 | Assigned |
| TOOLING-001 | Phase 6 | Assigned |

## Shared Validation Commands

Run after every implementation phase:

```powershell
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
```

If `package.json` gains a `test` script later, also run:

```powershell
pnpm test
```

Known audit-time note: during the original audit validation, `pnpm exec tsc --noEmit --incremental false` failed in PowerShell because `tsc` was not recognized even though `node_modules\.bin\tsc` existed. This is tracked as `TOOLING-001`. A future remediation implementer should still run the required command, record its exact result, and use `pnpm build` as the build/type-check gate because Next.js successfully ran TypeScript during audit.

## Shared Deployment Gate

After each phase:

1. Commit only that phase's changes.
2. Push to the default branch.
3. Wait for the Vercel deployment to complete.
4. Check affected live route(s) on `https://rahmatherapy-next-refactor.vercel.app/`.
5. If the primary deployment is stale or unavailable, check:
   - `https://rahmatherapy-next-ref-git-5fb7c0-mamdouh9001-gmailcoms-projects.vercel.app/`
   - `https://rahmatherapy-next-refactor-qgg5pr3n5.vercel.app/`
6. Record route status, title, and any mismatch before proceeding.

## Phase 1: Critical CTA And Mobile Containment

### Goal

Restore the primary booking interaction and eliminate the high-severity mobile overflow on the planned homepage.

### Issue IDs Addressed

- INTERACTION-001
- RESP-003

### Routes Affected

- All planned routes for booking behavior.
- `/home-planned` and `/home-planning` for horizontal overflow.

### Files/Components Likely Touched

- `src/features/booking/BookingExperience.tsx`
- `src/features/booking/hooks/useBookingUrlState.ts`
- `src/features/booking/components/BookingDialog.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/layout/SiteHeader.tsx`
- `src/components/planned-home/HomeReviewCarousel.tsx`
- Any shared booking trigger helpers used by planned pages.

### Constraints

- Keep allowed booking URLs exactly: `?booking=1` and `?booking=1&services=<service-id>`.
- Preserve valid service IDs: `supreme-combo`, `hijama-package`, `fire-package`, `massage-30`, `massage-60`.
- Do not introduce `/book-now`, `?package=`, or `/services/mobile-massage-therapy`.
- Do not alter customer review text while touching the home carousel.

### Expected Outcome

- Direct navigation to `?booking=1` opens the booking popup.
- Direct navigation to `?booking=1&services=<valid-id>` opens the popup with correct package preselection.
- Clicking visible booking triggers opens the popup without full-page navigation.
- Modal focus behavior can be verified.
- `/home-planned` at 390px has no horizontal overflow when the mobile menu is closed.

### Implementation Steps

1. Reproduce booking failure locally on `/services/?booking=1&services=hijama-package`.
2. Trace URL-state handling from `useBookingUrlState` into `BookingExperience`.
3. Fix the state transition that should open the dialog from URL search params and trigger clicks.
4. Verify package preselection handles one valid service ID and ignores invalid IDs safely.
5. Verify Escape close, close button, backdrop behavior, initial focus, focus trap, and focus restoration.
6. Inspect the closed mobile nav and home review carousel for offscreen elements increasing document width.
7. Contain closed nav/carousel overflow without hiding focusable active content when the menu is open.
8. Re-check `document.documentElement.scrollWidth <= window.innerWidth` at 390px.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if a test script exists at implementation time.

### Local Route Checks

- `/home-planned/`
- `/home-planning/`
- `/services/?booking=1`
- `/services/?booking=1&services=hijama-package`
- `/services/supreme-combo-package/?booking=1&services=supreme-combo`
- `/reviews/?booking=1`
- `/faqs-aftercare/?booking=1`

Check at 390px and desktop:

- Booking popup opens.
- Valid package is preselected.
- Focus enters the dialog and returns after close.
- Escape closes the dialog.
- No horizontal overflow on `/home-planned/`.

### Live Vercel Checks

- `/home-planned/`
- `/services/?booking=1`
- `/services/?booking=1&services=hijama-package`
- `/reviews/?booking=1`
- `/faqs-aftercare/?booking=1`

### Commit Message

```txt
fix planned booking popup and home mobile overflow
```

### Rollback Note

Revert the phase commit if booking state handling regresses route rendering or if containment breaks mobile nav access. Re-test any later phases that depend on booking or shared header behavior after rollback.

### Gate Before Next Phase

- Booking opens from URL and click triggers on representative planned routes.
- `/home-planned/` has no 390px horizontal overflow.
- Required validation commands recorded.
- A Vercel deployment for the phase is live and checked.

## Phase 2: Content And Plan-Compliance Restoration

### Goal

Restore compliance-sensitive copy, review text integrity, booking copy, and planned image-wrapper behavior before broader accessibility and design work.

### Issue IDs Addressed

- CTA-001
- REVIEW-EXCERPT-VERIFY
- PLAN-SERVICES-001
- PLAN-FAQS-002

### Routes Affected

- `/home-planned`
- `/home-planning`
- `/services`
- `/reviews`
- `/faqs-aftercare`

### Files/Components Likely Touched

- `src/content/pages/plannedHome.ts`
- `src/content/pages/faqsAftercare.ts`
- `src/components/reviews/ReviewsHero.tsx`
- `src/components/reviews/FeaturedReviewsMosaic.tsx`
- `src/lib/content/reviews.ts`
- `src/components/services/PackageFinder.tsx`
- `src/components/services/ServicesImage.tsx`
- `src/components/faqs-aftercare/AftercareTabs.tsx`
- `src/components/faqs-aftercare/FaqsAftercareImage.tsx`

### Constraints

- Do not replace the homepage short disclaimer with the full disclaimer.
- Keep the full disclaimer on Services, focused package pages, and FAQs/Aftercare where required.
- Do not add, paraphrase, rewrite, correct, or normalize customer review text.
- Review excerpts are allowed if they exactly match canonical review text or exact canonical `shortExcerpt` values.
- Do not add unsupported medical claims.
- Do not force `HomeHero` from `.avif` to `.webp`; the current AVIF path is approved unless the developer provides a matching WebP.
- Do not invent assets. If aftercare assets are unavailable, keep labelled placeholders and mark asset replacement for Phase 5.
- Do not introduce forbidden booking URLs.

### Expected Outcome

- Home safety section keeps the approved short disclaimer.
- Home and FAQ copy no longer refer to a "Book Now page".
- Reviews hero and featured mosaic use exact canonical review excerpts or exact canonical `shortExcerpt` values.
- PackageFinder and AftercareTabs use route-owned image wrappers.
- Home hero keeps the approved `.avif` path unless an approved WebP replacement is provided later.

### Implementation Steps

1. Verify the home safety note remains the approved short disclaimer and do not change it.
2. Update the planned home and FAQs/aftercare FAQ answers to refer to the booking request flow or WhatsApp without mentioning a Book Now page.
3. Compare reviews hero and featured mosaic excerpts against canonical review text and `shortExcerpt` values.
4. Change only non-canonical/paraphrased review excerpts. Do not replace the curated design with full long reviews unless the design still works.
5. Verify `HomeHero` keeps the approved `.avif` path unless an approved WebP is supplied.
6. Change `PackageFinder` to render its media through `ServicesImage`.
7. Change `AftercareTabs` to render active tab imagery through `FaqsAftercareImage`.
8. Run static scans for `Book Now page`, `/book-now`, `?package=`, and non-canonical review excerpt strings.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present.

### Local Route Checks

- `/home-planned/`
- `/services/`
- `/reviews/`
- `/faqs-aftercare/`

Check:

- Approved short disclaimer visible on home safety section.
- No visible "Book Now page" copy.
- Reviews proof excerpts match canonical review text or exact canonical `shortExcerpt` values.
- PackageFinder and aftercare tab media render through wrappers.

### Live Vercel Checks

- `/home-planned/`
- `/services/`
- `/reviews/`
- `/faqs-aftercare/`

### Commit Message

```txt
fix planned content compliance and image wrappers
```

### Rollback Note

Revert the phase commit if compliance copy or review text is accidentally altered beyond the documented fixes. If rollback happens after Phase 5 assets, re-check any image wrapper assumptions.

### Gate Before Next Phase

- Static scans show no "Book Now page", `/book-now`, or `?package=` in scoped planned source.
- Review proof text integrity is verified.
- Validation commands and live route checks recorded.

## Phase 3: Accessibility And Interaction Fixes

### Goal

Improve semantic structure, keyboard access, tab behavior, package finder announcements, and review card disclosure semantics.

### Issue IDs Addressed

- A11Y-001
- A11Y-002
- A11Y-003
- A11Y-004
- A11Y-005

### Routes Affected

- All planned routes for skip link.
- `/home-planned`, `/home-planning`, `/services`, `/faqs-aftercare` for heading hierarchy.
- `/faqs-aftercare` for tab behavior.
- `/services` for package finder live updates.
- `/reviews` for review card focus/disclosure behavior.

### Files/Components Likely Touched

- `src/app/(public)/layout.tsx`
- `src/components/layout/SiteHeader.tsx`
- `src/components/planned-home/HomeTrustStrip.tsx`
- `src/components/services/ServicesTrustStrip.tsx`
- `src/components/faqs-aftercare/QuickAnswersStrip.tsx`
- `src/components/faqs-aftercare/AftercareTabs.tsx`
- `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`
- `src/components/services/PackageFinder.tsx`
- `src/components/reviews/ReviewCard.tsx`
- Existing UI tabs primitive if available.

### Constraints

- Keep visible content and planned section order unchanged.
- Prefer existing UI primitives and local patterns.
- Do not degrade reduced-motion support.
- Preserve review text exactly.

### Expected Outcome

- First Tab stop exposes a visible skip link to `main#main-content`.
- Heading outline uses one H1 and logical H2/H3 nesting.
- FAQ/aftercare tabs support arrow-key navigation or use planned shadcn/ui Tabs.
- Package finder recommendation changes are announced.
- Review card expansion is controlled by a named interactive element.

### Implementation Steps

1. Add a skip link before the repeated header in the public layout.
2. Adjust card heading levels in affected trust/quick-answer sections.
3. Rebuild aftercare and FAQ category tablists with the planned tabs primitive, or implement roving tabindex and Arrow/Home/End handling.
4. Add a polite live region or status announcement for PackageFinder recommendation changes.
5. Remove `tabIndex={0}` from review articles or convert them into a fully accessible disclosure pattern.
6. Re-run keyboard navigation checks across representative pages.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present.

### Local Route Checks

- `/home-planned/`
- `/services/`
- `/reviews/`
- `/faqs-aftercare/`

Check:

- First Tab focuses skip link.
- Heading outline is logical.
- Arrow keys operate aftercare and FAQ category tabs.
- Package finder result updates are announced.
- Review card focus stops have clear role/name/state.

### Live Vercel Checks

- `/home-planned/`
- `/services/`
- `/reviews/`
- `/faqs-aftercare/`

### Commit Message

```txt
fix planned page accessibility interactions
```

### Rollback Note

Revert the phase commit if tab/focus behavior breaks core interaction. Re-check Phase 1 booking modal focus if layout or focus helpers are touched.

### Gate Before Next Phase

- Manual keyboard checks pass on affected routes.
- No new focus traps or unreachable controls.
- Validation and deployment checks recorded.

## Phase 4: Responsive Layout And Shared Header UX

### Goal

Resolve tablet hero height, mobile tab discoverability, package hero first-viewport hierarchy, and shared header breakpoint clarity.

### Issue IDs Addressed

- UX-001
- UX-002
- RESP-001
- RESP-002

### Routes Affected

- All planned routes for shared header breakpoint behavior.
- `/services`, focused package routes, `/faqs-aftercare` for tablet hero layout.
- Focused package routes for mobile hero composition.
- `/faqs-aftercare` for mobile tab discoverability.

### Files/Components Likely Touched

- `src/components/layout/SiteHeader.tsx`
- `src/components/layout/SiteFooter.tsx`
- `src/content/site/navigation.ts`
- `src/content/site/footer.ts`
- `src/components/services/ServicesHero.tsx`
- `src/components/package-pages/PackageHero.tsx`
- `src/components/faqs-aftercare/FaqsAftercareHero.tsx`
- `src/components/faqs-aftercare/AftercareTabs.tsx`
- `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`

### Constraints

- Keep planned pages within their planning-bundle design system.
- Do not redesign legacy routes in this phase; legacy cleanup is handled in Phase 7.
- Do not remove planned navigation items in this phase unless required for the responsive header fix.
- Do not remove required CTAs or treatment suitability copy.

### Expected Outcome

- Desktop header has one clear navigation mode at 1024px and 1440px.
- Broad legacy cleanup is deferred to Phase 7 so this phase can stay focused on responsive layout and header behavior.
- Tablet heroes are not excessively tall.
- Focused package mobile heroes balance value, CTA, and media/proof earlier.
- FAQ/aftercare mobile tab rows clearly reveal hidden options or stack cleanly.

### Implementation Steps

1. Define a header breakpoint strategy that avoids full nav plus hamburger at the same viewport.
2. Avoid broad navigation cleanup in this phase; leave legacy retirement to Phase 7 unless a header breakpoint fix requires a small preparatory change.
3. Adjust tablet hero media sizing/min-height for services, package, and FAQs/aftercare hero components.
4. Tighten package hero mobile layout without removing required copy.
5. Add mobile tab overflow affordance or switch FAQ/aftercare tabs to a stacked/segmented mobile layout.
6. Check text wrapping and CTA wrapping at 390px, 768px, 1024px, and 1440px.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present.

### Local Route Checks

- `/home-planned/`
- `/services/`
- `/services/supreme-combo-package/`
- `/services/hijama-package/`
- `/services/fire-cupping-package/`
- `/services/massage-therapy-30-mins/`
- `/services/massage-therapy-1-hour/`
- `/faqs-aftercare/`

Check at 390px, 768px, 1024px, and 1440px.

### Live Vercel Checks

- `/home-planned/`
- `/services/`
- `/services/supreme-combo-package/`
- `/faqs-aftercare/`

### Commit Message

```txt
improve planned responsive layout and header
```

### Rollback Note

Revert the phase commit if shared navigation breaks planned-route access or if hero layout regressions appear. If reverted after Phase 5, re-check visual asset placement.

### Gate Before Next Phase

- Header breakpoint behavior is clean.
- Dual-homepage navigation is preserved or changed only with explicit user approval.
- Tablet/mobile checks pass for affected routes.
- Validation and live checks recorded.

## Phase 5: Asset Replacement And Visual Polish

### Goal

Replace prominent placeholders and complete the planned premium proof/media treatment using approved assets only.

### Issue IDs Addressed

- VISUAL-001
- VISUAL-002

### Routes Affected

- `/services`
- Focused package routes
- `/about`
- `/reviews`
- `/faqs-aftercare`
- `/home-planned` for secondary planned image placeholders

### Files/Components Likely Touched

- `public/images/**`
- `src/components/planned-home/*`
- `src/components/services/*`
- `src/components/package-pages/*`
- `src/components/about/*`
- `src/components/reviews/*`
- `src/components/faqs-aftercare/*`
- Route-owned image wrappers.

### Constraints

- Do not invent assets.
- Do not use generic stock-like images that do not match the planning bundle.
- Do not rewrite customer review text while improving reviews proof.
- Preserve alt text/accessibility labels.
- If assets are unavailable, defer the affected route/section with a clear asset-blocked note.

### Expected Outcome

- Primary hero, body media, credential, proof, and final CTA placeholders are replaced with planned approved imagery.
- Reviews proof/mosaic feels premium and trust-led while preserving exact canonical review content.
- Placeholders remain only as development fallback for truly missing assets.

### Implementation Steps

1. Confirm developer-provided asset list and filenames against the planning bundle.
2. Place approved assets in the expected `public/images/**` paths.
3. Wire route-owned image wrappers to render assets.
4. Update reviews proof visuals using approved assets and exact review data.
5. Preserve responsive image sizing and overlay readability.
6. Document any unavailable assets as deferred rather than fabricating replacements.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present.

### Local Route Checks

- `/home-planned/`
- `/services/`
- all focused package routes
- `/about/`
- `/reviews/`
- `/faqs-aftercare/`

Check at 390px, 768px, 1024px, and 1440px:

- Images render.
- Overlay contrast is readable.
- No new layout shift or overflow.
- Placeholder labels are absent from final visible production sections unless explicitly deferred.

### Live Vercel Checks

- All in-scope planned routes with replaced assets.

### Commit Message

```txt
add planned media assets and visual proof polish
```

### Rollback Note

If assets are incorrect or create visual regressions, revert only the asset/presentation phase commit. Do not revert earlier compliance/accessibility fixes unless they were modified in the same commit.

### Gate Before Next Phase

- Approved assets are present and rendered.
- Asset-blocked sections are explicitly listed if any remain.
- Validation and live route checks recorded.

## Phase 6: Performance, SEO, And Deployment Hardening

### Goal

Reduce review wall animation cost, resolve the standalone TypeScript command ambiguity if still present, and confirm no SEO/deployment regressions after prior fixes.

### Issue IDs Addressed

- PERF-001
- TOOLING-001

### Routes Affected

- `/reviews`
- All planned routes for final metadata/schema spot checks.
- All planned routes through the shared validation workflow.

### Files/Components Likely Touched

- `src/components/reviews/ReviewCard.tsx`
- `src/components/reviews/ReviewWall.tsx`
- `src/components/reviews/ReviewsExplorer.tsx`
- `package.json` only if the user approves adding an explicit `typecheck` script.
- Metadata files only if a regression is found during verification.

### Constraints

- Preserve review wall usability, filters, search, and load-more behavior.
- Preserve reduced-motion support.
- Do not add Review or AggregateRating schema.
- Do not rewrite review text.
- Do not reduce the initial Reviews wall below 24 visible reviews unless measured performance proves it necessary.
- Do not change package scripts unless the TypeScript command still fails and the user approves a package.json validation-script fix.

### Expected Outcome

- Lighter review-card animation renders initially while preserving the approved 24 visible reviews unless measured performance proves a lower count is necessary.
- Review wall remains usable and accessible.
- Standalone TypeScript validation is either working or documented with an approved equivalent command.
- Metadata and JSON-LD remain valid, with no self-serving review schema.
- Deployment checks remain green.

### Implementation Steps

1. Reduce animation cost first by removing expensive per-card layout animation or limiting motion to small state changes.
2. Keep reduced-motion behavior intact.
3. Keep the initial 24-review count unless profiling proves it should be reduced.
4. Re-check search/filter/load-more behavior.
5. Re-run static schema scan for `Review` and `AggregateRating`.
6. Re-run `pnpm exec tsc --noEmit --incremental false`.
7. If it still fails with command resolution, identify and document the project-approved equivalent command. Add a `typecheck` script only if the user approves that package.json change.
8. Verify route metadata titles/descriptions still render.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present.

### Local Route Checks

- `/reviews/`
- `/home-planned/`
- `/services/`
- `/faqs-aftercare/`

Check:

- Review filters/search/load more still work.
- Reduced motion does not animate card layout.
- No Review/AggregateRating schema added.
- `TOOLING-001` outcome is recorded: command passes, approved equivalent documented, or package script added with approval.

### Live Vercel Checks

- `/reviews/`
- `/home-planned/`
- `/services/`
- `/faqs-aftercare/`

### Commit Message

```txt
optimize planned reviews wall performance
```

### Rollback Note

Revert this phase if review exploration, accessibility, or reduced-motion behavior regresses. Re-run Phase 3 review-card accessibility checks after rollback.

### Gate Before Next Phase

- Review wall behavior verified.
- Performance change does not create accessibility regression.
- Validation and deployment checks recorded.

## Phase 7: Legacy Cleanup And Strict Plan-Compliance Re-Audit

### Goal

Remove confirmed legacy homepage/dead route code and verify each remaining planned page is built from top to bottom according to its respective plan file.

### Issue IDs Addressed

- LEGACY-001

### Routes Affected

- Current canonical planned homepage route after inspection.
- `/home-planned` and `/home-planning` if they remain as aliases or redirects.
- `/services`
- Focused package routes
- `/about`
- `/reviews`
- `/faqs-aftercare`
- Any confirmed legacy routes such as `/home`, `/hijama`, `/physiotherapy`, `/sports-massage-barnet`, or other old/dead routes found in the current route map.

### Files/Components Likely Touched

- `src/app/**`
- `src/content/site/navigation.ts`
- `src/content/site/footer.ts`
- old legacy page content files under `src/content/pages/**`
- old legacy component folders under `src/components/**`
- route redirects or middleware only if the current architecture already uses them

### Constraints

- Do not delete anything until the current planned homepage route and legacy route ownership are confirmed.
- Do not remove booking popup, shared shell, planned page content, package pages, therapist-gender wording, prices, or safety/suitability content.
- Do not recreate `/book-now`, `?package=`, or `/services/mobile-massage-therapy`.
- Preserve useful redirects only if they prevent broken user/SEO paths and do not expose legacy page content.
- Keep approved assets only; do not invent imagery while cleaning dead code.

### Expected Outcome

- Confirmed old legacy page implementations are removed or redirected cleanly.
- Header and footer expose only the planned production navigation.
- No dead legacy content/components/imports remain.
- Every planned page is rechecked against its source plan file for exact section order, copy, CTAs, design treatment, image handling, interactions, and code ownership.
- Build route list no longer exposes unwanted legacy pages.

### Implementation Steps

1. Inspect the current route map and identify which route currently serves the planned homepage.
2. Identify legacy/dead routes and their owning files. Treat `/home` as legacy if it contains the old homepage, and inspect `/hijama`, `/physiotherapy`, `/sports-massage-barnet`, and any other old routes.
3. Decide whether each old route should be deleted, redirected, or retained as a planned route. Prefer removal unless a redirect is needed for users/SEO.
4. Update header/footer navigation so only planned production pages are shown.
5. Remove confirmed dead content/components/imports created only for legacy pages.
6. Run static scans for legacy route names, old component imports, `/book-now`, `?package=`, `/services/mobile-massage-therapy`, and forbidden medical-copy phrases.
7. Re-open the planning bundle files and compare each planned page top to bottom against its plan.
8. Record or fix any remaining discrepancies that are in scope for this phase.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present.

### Local Route Checks

- Canonical planned homepage route.
- `/services/`
- all focused package routes
- `/about/`
- `/reviews/`
- `/faqs-aftercare/`

Also check removed/redirected legacy routes to confirm they do not render old page content.

### Live Vercel Checks

- Canonical planned homepage route.
- `/services/`
- `/about/`
- `/reviews/`
- `/faqs-aftercare/`
- Removed/redirected legacy route behavior where relevant.

### Commit Message

```txt
remove legacy routes and verify planned page compliance
```

### Rollback Note

Revert this phase if planned routes are removed accidentally, redirects loop, or navigation no longer reaches required planned pages. After rollback, re-run build and route checks before retrying cleanup.

### Gate Before Next Phase

- Current planned homepage route is documented.
- Confirmed legacy routes do not render old page content.
- Header/footer show only planned production navigation.
- Each planned page has been rechecked against its source plan file.
- Validation and deployment checks recorded.

## Phase 8: Final Cross-Page Verification

### Goal

Confirm every planned route passes the audit acceptance gates after all remediation phases.

### Issue IDs Addressed

- No new issue IDs; verifies all remediated issues.

### Routes Affected

- `/home-planned`
- `/home-planning`
- `/services`
- `/services/supreme-combo-package`
- `/services/hijama-package`
- `/services/fire-cupping-package`
- `/services/massage-therapy-30-mins`
- `/services/massage-therapy-1-hour`
- `/about`
- `/reviews`
- `/faqs-aftercare`

### Files/Components Likely Touched

- No implementation files expected.
- Update audit/checklist documentation only if this phase is executed as documentation after implementation.

### Constraints

- Do not introduce new runtime changes during final verification unless a failed gate requires a new remediation phase.
- Record exact command and live route results.

### Expected Outcome

- All planned routes pass local smoke checks.
- Primary Vercel deployment is current and matches local behavior.
- No unresolved non-deferred canonical issue remains.

### Implementation Steps

1. Re-run full validation commands.
2. Smoke-check every planned route locally with trailing slash.
3. Check booking popup on representative general and package query URLs.
4. Check keyboard flows: skip link, tabs, package finder, review cards, booking modal.
5. Check responsive behavior at 390px, 768px, 1024px, and 1440px.
6. Check live Vercel routes after final push.
7. Update issue statuses only if directed by the user in a future remediation task.

### Validation Commands

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present.

### Local Route Checks

All in-scope planned routes.

### Live Vercel Checks

All in-scope planned routes on the primary deployment.

### Commit Message

```txt
verify planned site remediation
```

### Rollback Note

No runtime rollback should be needed if this is verification-only. If a verification fix is required, create a new targeted remediation commit and rollback that commit independently if needed.

### Gate Before Completion

- Every canonical issue is fixed or explicitly deferred with rationale.
- Required validation commands are recorded.
- Every live planned route returns expected content.
- Final acceptance checklist is complete.

## Final Acceptance Checklist

| Check | Required result |
|---|---|
| Booking popup | Opens from `?booking=1`, `?booking=1&services=<valid-id>`, and visible booking triggers. |
| Forbidden URLs | No `?package=`, `/book-now`, or `/services/mobile-massage-therapy` in scoped planned source. |
| Service IDs | Only `supreme-combo`, `hijama-package`, `fire-package`, `massage-30`, `massage-60` used for booking preselection. |
| Required disclaimer | Full disclaimer appears on Services, focused package pages, and FAQs/Aftercare; the homepage keeps its approved short disclaimer. |
| Review text | Customer review text is exact where presented as review quotation. |
| Accessibility | One H1 per page, logical headings, skip link, keyboard tabs, accessible review cards, package finder announcement. |
| Responsive | No horizontal overflow at 390px; tablet heroes are not overlong; CTAs wrap cleanly. |
| Visual assets | Approved planned assets render; placeholder-only sections are either removed or explicitly deferred. |
| Performance | Reviews wall avoids unnecessary high-card-count animation and respects reduced motion. |
| SEO/schema | Metadata exists; no self-serving Review/AggregateRating schema added. |
| Validation | `pnpm lint`, `pnpm exec tsc --noEmit --incremental false`, `pnpm build`, and tests if present are recorded. |
| Deployment | Phase commits pushed and primary Vercel route checks recorded before proceeding. |

## Documentation Gate

| Check | Status |
|---|---|
| Every canonical issue assigned to a remediation phase or asset-blocked phase | Complete |
| Asset-dependent issues isolated | Complete |
| Verification gates included after each phase | Complete |
| Deployment gates included after each phase | Complete |
| Rollback notes included after each phase | Complete |
| Future implementer can proceed without chat context | Complete |
| Runtime code changed | No |
