# Password-Reset Email Templates — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** account-password-requests-brief.md, password-reset-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `account-password-requests`

## What this is
Two new email template entries — `password_reset_approved` and `password_reset_rejected` — added to `src/lib/email/templates.ts` (the SERVER-ONLY template registry) and matching render functions.

## Why it's needed
`approvePasswordResetRequest` sends `password_reset_approved` (carrying the one-time token link) and `rejectPasswordResetRequest` sends `password_reset_rejected` (carrying the reviewer note). Both server actions reference these templates by name. Without them, Resend throws a "template not found" error and the entire approve/reject flow fails.

## What it does (user story)
"As a staff member who submitted a password-reset request, I want to receive either a clear approval email with a working reset link, or a rejection email with the reviewer's note, so I know exactly what happened and what to do next."

## What information it stores or retrieves
`password_reset_approved`: receives `{ staffName, reviewerNote?, tokenLink, expiresInHours }` at render time. Outputs HTML + plain-text companion with the one-time link prominently displayed.

`password_reset_rejected`: receives `{ staffName, reviewerNote, reviewerName }` at render time. Outputs HTML + plain-text companion with the reviewer note rendered as plain text (no HTML, no `dangerouslySetInnerHTML`).

Both templates: footer contact line is sourced from `contactEmail` / `contactPhone` from `business_settings` (editable via Brief 02 / email-templates). The footer line must be an editable override field per Brief 02's audience-variant spec.

## Who can use it
Called server-side only by `approvePasswordResetRequest` and `rejectPasswordResetRequest`. Never exposed directly to any client component. No RBAC check at the template level — permission is enforced by the calling server actions.

## What can go wrong
- **Token link expired by the time the email is opened:** the link carries an `expires_at` timestamp. The staff member must see "This link expires in 24 hours" in the email body. If they click past expiry, state 6 (expired) renders on the password-reset page.
- **Reviewer note contains HTML or script tags:** the `reviewer_note` field must be rendered as escaped plain text. React's default escaping handles this when using JSX; do NOT use `dangerouslySetInnerHTML` for this field.
- **Missing variables at render time:** if `tokenLink` is undefined in the approve template, the email renders a broken link. The render function must throw if required variables are absent.
- **Template render throws:** Resend catches rendering errors and surfaces them as delivery failures. The calling server action must handle the thrown error and return `{ error: "email_failed" }` without committing the DB row.

## How to verify it works
1. Call the render function for `password_reset_approved` with mock data including a token link — confirm the output HTML contains the link, the staff name, and the expiry note; confirm the plain-text companion also contains the link.
2. Call the render function for `password_reset_rejected` with a reviewer note containing `<script>alert(1)</script>` — confirm the output renders the literal string, not an executable script.
3. Send both templates via Resend in dev mode and confirm delivery in the Resend dashboard; confirm `email_delivery_events` rows are written for both.

## Safe implementation order
1. Add the two template definitions (name, subject line, recipient placeholder) to `templates.ts` without implementing the render functions yet — lets the file compile and other code can import the names.
2. Implement `renderPasswordResetApprovedEmail({ staffName, reviewerNote, tokenLink, expiresInHours })` — render, send to a dev mailbox, visually verify the link works.
3. Implement `renderPasswordResetRejectedEmail({ staffName, reviewerNote, reviewerName })` — render, verify the note is plain-text-escaped.
4. Cross-check voice consistency with Brief 10 (password-reset page) and Brief 12 (account-password-requests page) at Phase 7 Gate 2 `clarify`.

## How to undo it if something breaks
Additions to `templates.ts` are purely additive — removing the two new entries restores the file to its previous state. No DB migration required. Email sends that already happened cannot be unsent.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
