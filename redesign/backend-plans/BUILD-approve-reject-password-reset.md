# Approve / Reject Password-Reset Request — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** account-password-requests-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `account-password-requests`

## What this is
Two new server actions — `approvePasswordResetRequest` and `rejectPasswordResetRequest` — that together form the full review workflow for staff password-reset requests.

## Why it's needed
The Approve and Reject buttons in the `account-password-requests` brief (§7) drive the entire purpose of this page. Without these actions the page is read-only and the production row that already sits pending in `account_password_requests` can never be processed.

## What it does (user story)
"As an Owner or Admin, I want to approve or reject a staff password-reset request so that the staff member either receives a one-time reset link or a plain-English rejection email with my note."

## What information it stores or retrieves
**Approve:** reads the `account_password_requests` row by `id`; verifies `status = 'pending'`; calls the Supabase Auth admin-API to generate a password-reset token; writes `status = 'approved'`, `reviewed_by`, `reviewed_at`, the token payload, and optional `reviewer_note` back to the row; sends the `password_reset_approved` email via Resend; writes an `audit_logs` row with action type `password_reset_approved`.

**Reject:** reads the row; verifies `status = 'pending'`; writes `status = 'rejected'`, `reviewed_by`, `reviewed_at`, required `reviewer_note`; sends the `password_reset_rejected` email via Resend; writes an `audit_logs` row with action type `password_reset_rejected`.

## Who can use it
Authenticated staff holding the `manage_account_password_requests` permission (Owner + Admin/Practice Manager by default). Each server action must verify this permission on entry and return 403 on failure without touching the DB.

## What can go wrong
- **Row no longer pending (race condition):** another reviewer approved or rejected the same row between the time it appeared on screen and confirm-click. Action must re-read the row inside the transaction and return a `{ error: "already_reviewed", reviewedBy: string }` shape so the UI can render the "just reviewed by {name}" inline error without closing the modal.
- **Supabase Auth admin-API failure (approve only):** token generation call fails (network, quota, invalid user). The row must NOT be updated, the email must NOT be sent. Return `{ error: "auth_api_failed" }`.
- **Resend email delivery failure:** email send fails after a successful Auth-API call (approve) or after a valid row state. The row update must be rolled back (or the row must NOT be committed until email succeeds). Return `{ error: "email_failed" }`.
- **DB write failure:** Supabase Postgres returns an error on the update. Return `{ error: "db_write_failed" }`.
- **Reject with empty reviewer_note:** server action must enforce `reviewer_note` as required on reject even if the client-side `required` attribute was bypassed. Return `{ error: "note_required" }`.
- **Self-approval attempt:** if the requesting staff member's email matches the reviewer's account, return `{ error: "self_approval_not_allowed" }`.
- **Permission removed mid-session:** staff had permission when they loaded the page but it was revoked before confirm. The server-entry permission check catches this. Return 403.

## How to verify it works
1. Approve: submit a pending row as Owner → row status becomes `approved`, `reviewed_at` is set, the staff member's inbox receives the approval email with a working one-time link, and an `audit_logs` row with `action_type = 'password_reset_approved'` and the correct `actor_staff_id` exists.
2. Reject: submit a pending row as Owner with a reviewer note → row status becomes `rejected`, rejection email arrives with the note visible, `audit_logs` row with `action_type = 'password_reset_rejected'` exists.
3. Race condition: two browser tabs both load the same pending row; first tab approves successfully; second tab's confirm fires → action returns `{ error: "already_reviewed" }` without touching the DB a second time; UI renders the inline error, not a success toast.

## Safe implementation order
1. Create `src/app/admin/account-password-requests/actions.ts` with both action stubs that return `{ error: "not_implemented" }` so the file exists and imports compile.
2. Implement the permission guard first (check `manage_account_password_requests`; throw 403 on failure). Test: call without permission → 403.
3. Implement the row fetch + idempotency check. Test: call with a `status = 'approved'` row → returns `already_reviewed`.
4. Implement the `rejectPasswordResetRequest` path (no Auth-API call) end-to-end first — simpler, and validates the DB/email/audit pattern before adding the Auth-API complexity.
5. Add the Supabase Auth admin-API call to `approvePasswordResetRequest`. Use the existing admin client from `src/lib/supabase/**`. Test against a real test-user account in dev.
6. Add Resend email sends for both paths (templates must exist first — see BUILD-password-reset-email-templates.md).
7. Wire the actions to the UI buttons in `page.tsx` / `ApproveModal.tsx` / `RejectModal.tsx`.

## How to undo it if something breaks
The server actions write to `account_password_requests` (update) and `audit_logs` (insert). Neither change breaks the existing data shape. To undo a bad approve: manually set `status = 'pending'` on the row in Supabase Studio; the Auth token expires naturally. There is no way to "un-send" an email, which is why email send must be the last step inside each action.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
