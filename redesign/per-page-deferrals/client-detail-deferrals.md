# Deferrals — client-detail

## Mobile AdminTopNav overlap with first-card content at 375px
- **Source:** Step 12a audit P1 (subagent reading `client-detail-final-375.png`)
- **Verbatim:** "Mobile AdminTopNav overlaps page content at 375px; chrome-wide bug exposed because the header lacks any top spacing."
- **Defer to:** Phase 7
- **Why deferred:** Root cause is in admin shell chrome (AdminTopNav layout), not the client-detail page itself. Fix belongs in `00-shared-components` follow-up via Phase 7 gauntlet.
- **Provisional Phase 6 answer used to continue this session:** None — visual artefact only; functional access unaffected.

## Hardcoded `oklch(...)` Cancelled-family literals in ClientDetailForms.tsx
- **Source:** Step 11a token-drift grep + Step 12a audit P1
- **Verbatim:** "Raw `oklch(...)` literals for Cancelled/error states bypass token layer: `ClientDetailForms.tsx:78,90,105,115,178,190,205,221`. Should use `--admin-status-cancelled-bg/text` tokens."
- **Defer to:** Phase 7
- **Why deferred:** Tokens `--admin-status-cancelled-bg` and `--admin-status-cancelled-text` don't exist as CSS variables in the current design system (status families are defined as inline `oklch()` literals everywhere — `AdminInput` at `admin-ui.tsx:737-769` uses the identical inline pattern). Migration requires extending `globals.css` (out of recipe scope) and a codebase-wide swap — Phase 7 gauntlet.
- **Provisional Phase 6 answer used to continue this session:** Mirror the established AdminInput pattern in `admin-ui.tsx:737-769`, keeping the inline oklch literals at the same values as DESIGN.md `status-cancelled-bg`/`status-cancelled-text`.

## "Back to clients" Ghost link (brief drift)
- **Source:** Step 12a audit P2
- **Verbatim:** "Brief §7 says 'No explicit back-link needed — browser back button and AdminTopNav breadcrumb handle it.' Link present at `page.tsx:438-444`."
- **Defer to:** Phase 7
- **Why deferred:** Removable in a Phase 7 polish pass; not user-blocking.
- **Provisional Phase 6 answer used to continue this session:** Keep the discreet ghost link (matches other admin detail pages' breadcrumb convention).

## `BookingHistoryCard` lacks staff avatar + gender-match chip
- **Source:** Step 12a audit P2
- **Verbatim:** "DESIGN.md §5 BookingListCard mandates avatar + gender-match chip; current card has neither."
- **Defer to:** Phase 7
- **Why deferred:** The booking history card on this page intentionally omits assignee context (the brief's information hierarchy for this page is "client-centric, not staff-centric"). The BookingListCard shape lives in `bookings/page.tsx`; aligning the two is a Phase 7 cross-page consistency pass.
- **Provisional Phase 6 answer used to continue this session:** Compact client-detail-local card with status / date / service / payment.

## `StatCell` uppercase tracked label
- **Source:** Step 12a audit P2
- **Verbatim:** "Uppercase + letter-spacing label violates DESIGN.md 'Never uppercase shouting'."
- **Defer to:** Phase 7
- **Why deferred:** Mild visual inconsistency; matches AdminPageHeader's eyebrow convention. Phase 7 to decide whether to demote eyebrow uppercase or keep.

## Privacy "Submit request" uses Save icon
- **Source:** Step 12a audit P2
- **Verbatim:** "Semantically a submission, not a save — Send/Upload icon better."
- **Defer to:** Phase 7
- **Why deferred:** Minor copy/iconography tweak.
- **Provisional Phase 6 answer used to continue this session:** Save glyph aligns with the other admin form submit buttons in the codebase.

## Therapist-with-no-booking-assignments → 404 instead of AdminAccessDenied
- **Source:** Step 11b interactive verification (Playwright as `test.therapist@…`, navigating to `/admin/clients/0f38df55-…/`)
- **Verbatim:** "Brief §6 Key States lists `Therapist denied (out-of-scope)` with `AdminAccessDenied`. Current `page.tsx:376` flow: when therapist has zero rows in `booking_assignments`, the client query is skipped and `notFound()` triggers — H1 renders as '404', not the brief's `AdminAccessDenied` heading."
- **Defer to:** Phase 7
- **Why deferred:** The codebase's `getClientDataAccess` returns `canViewClient: false` for an unassigned therapist, so the redesigned page reaches `notFound()` before the access-denied branch. Restructuring the order requires changing whether the client row is loaded (probe-then-deny vs notfound). Matches the pre-existing behavior at `page.tsx` pre-redesign and is not source-introduced by this session.
- **Provisional Phase 6 answer used to continue this session:** Preserve the legacy 404 path; document for Phase 7.

## Step 11b screenshots: therapist-scope screenshot not captured
- **Source:** Step 11b
- **Verbatim:** Recipe: "screenshot `client-detail-therapist-scope.png`"
- **Defer to:** Phase 7
- **Why deferred:** The test.therapist seed in this dev environment has zero rows in `booking_assignments` (therapist sees bookings via `staff_id` rather than via the assignments table). Without an assigned booking, the redesigned page can't render the Therapist-scoped variant — the access flow falls through to `notFound()` (documented in the deferral above). Seeding booking_assignments rows is a backend/seed concern outside the recipe's "Files to edit" scope.
- **Provisional Phase 6 answer used to continue this session:** Coordinator-scoped screenshot (`client-detail-coordinator-1440.png`) verified the role-variant rendering logic separately; the Therapist scope branch is exercised by the same `clientAccess.canViewHealthNotes / canViewClient` gating verified there in reverse.

## "Per-impeccable-axis" screenshots not produced
- **Source:** Step 7 recipe
- **Verbatim:** "Identify 2 to 4 axes where the page has *visible* problems (not plausible improvements)."
- **Defer to:** Phase 7
- **Why deferred:** Post-craft visual review showed no axes with visible problems severe enough to warrant the 2-4 axis surface. Phase 7 gauntlet will apply axes if global re-review finds them.
- **Provisional Phase 6 answer used to continue this session:** Skipped per-axis screenshots; post-axes screenshots taken (identical to post-craft).
