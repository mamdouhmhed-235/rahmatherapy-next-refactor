# Phase 1 Prompt: Critical CTA And Mobile Containment

You are executing Phase 1 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- frontend debugging
- accessibility testing
- browser automation
- release engineering

Read before editing:

- `docs/audits/planned-site-quality-audit/00-audit-brief.md`
- `docs/audits/planned-site-quality-audit/07-links-ctas-booking-audit.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 1 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 1 gate in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

Goal:

Restore the primary booking interaction and eliminate the high-severity mobile overflow on the planned homepage.

Issue IDs:

- `INTERACTION-001`
- `RESP-003`

Focus routes:

- `/home-planned`
- `/home-planning`
- `/services/?booking=1`
- `/services/?booking=1&services=hijama-package`
- `/services/supreme-combo-package/?booking=1&services=supreme-combo`
- `/reviews/?booking=1`
- `/faqs-aftercare/?booking=1`

Likely files:

- `src/features/booking/BookingExperience.tsx`
- `src/features/booking/hooks/useBookingUrlState.ts`
- `src/features/booking/components/BookingDialog.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/layout/SiteHeader.tsx`
- `src/components/planned-home/HomeReviewCarousel.tsx`
- shared booking trigger helpers used by planned pages

Constraints:

- Do not redesign the booking popup.
- Fix only booking behavior/accessibility if needed.
- Keep allowed booking URLs exactly: `?booking=1` and `?booking=1&services=<service-id>`.
- Preserve valid service IDs only: `supreme-combo`, `hijama-package`, `fire-package`, `massage-30`, `massage-60`.
- Do not introduce `/book-now`, `?package=`, or `/services/mobile-massage-therapy`.
- Do not alter customer review text while touching the home carousel.

Implementation checklist:

1. Reproduce the booking issue locally on `/services/?booking=1&services=hijama-package`.
2. Trace URL state from `useBookingUrlState` into `BookingExperience`.
3. Fix the state transition that opens the dialog from URL search params and trigger clicks.
4. Verify package preselection handles one valid service ID and ignores invalid IDs safely.
5. Verify Escape close, close button, backdrop behavior, initial focus, focus trap, and focus restoration.
6. Inspect closed mobile nav and home review carousel for offscreen elements increasing document width.
7. Contain closed nav/carousel overflow without hiding focusable active content when the menu is open.
8. Re-check `document.documentElement.scrollWidth <= window.innerWidth` at 390px.

Validation:

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if a test script exists

Local smoke checks:

- Booking popup opens from required query URLs.
- Valid package is preselected.
- Focus enters the dialog and returns after close.
- Escape closes the dialog.
- `/home-planned/` has no 390px horizontal overflow.

Deployment gate:

- Commit message: `fix planned booking popup and home mobile overflow`
- Push to `master`.
- Wait for Vercel.
- Check `/home-planned/`, `/services/?booking=1`, `/services/?booking=1&services=hijama-package`, `/reviews/?booking=1`, `/faqs-aftercare/?booking=1`.

Final response:

- Files changed
- Issues fixed
- Validation results
- Local route checks
- Vercel checks
- Commit hash
- Push result
- Whether Phase 2 is safe to start

Do not start Phase 2.

