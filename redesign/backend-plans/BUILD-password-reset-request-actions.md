# Password-Reset Flow — Submit and Set-Password Server Actions — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** password-reset-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `password-reset`

## What this is
Two new server actions — `submitPasswordResetRequest` and `setPasswordWithToken` — plus a short-lived signed cookie (`rahma_password_reset_request`) that tracks a staff member's in-flight reset request across browser sessions.

## Why it's needed
The password-reset page is fully greenfield (§4). Both routes (`/admin/password-reset` and `/admin/password-reset/[token]`) are non-functional without these server actions. State 1 (forgot form) can't write to `account_password_requests`; State 4 (set new password) can't update the Supabase Auth password.

## What it does (user story)
"As a locked-out therapist, I want to submit my email and receive a human-reviewed reset — and when approved, set a new password via the link in my email — without understanding what happens behind the scenes."

## What information it stores or retrieves
`submitPasswordResetRequest`: accepts `email`. Looks up the staff member in `staff_profiles` (by email in `auth.users`). If found: inserts a new row in `account_password_requests` with `status='pending'`, `created_at`, and `expires_at` (24 hours); sets a signed `rahma_password_reset_request` cookie (`SameSite=Lax`, `HttpOnly`, `Secure`, short TTL ~7 days); writes audit row `password_reset_requested`. If not found: writes audit row `password_reset_request_lookup_failed` (with email redacted per RECON §6.2 regex) and returns the SAME state-2 response as if found (prevents email enumeration).

`setPasswordWithToken`: accepts `new_password` and `confirm_new_password`. Reads the token from the route param. Validates the token against the `account_password_requests` row (`status='approved'`, `expires_at` in the future, token hash matches). Calls Supabase Auth admin-API to set the new password. Marks the row `status='used'` (or the schema's terminal state). Signs the user in (creates a Supabase session). Writes audit row `password_reset_completed`. Redirects to `/admin/dashboard`.

## Who can use it
Pre-authentication (public routes). No RBAC check. The routes must be in the middleware's public-route allow-list (`/admin/password-reset` and `/admin/password-reset/:path*`).

## What can go wrong
- **Email enumeration:** `submitPasswordResetRequest` must return identical HTTP status and response body regardless of whether the email exists in `staff_profiles`. Timing attacks are a lower-order concern for this use case but avoid unnecessary delays.
- **Supabase Auth admin-API failure (setPasswordWithToken):** if the password update call fails, do NOT update the `account_password_requests` row status. Return `{ error: "auth_api_failed" }` so the UI stays on state 4.
- **Token already used (double-click or replay):** `setPasswordWithToken` must check `status = 'approved'` (not 'used' or 'rejected') before processing. On second call, return `{ error: "token_already_used" }` → page renders state 6 (expired).
- **Token expired:** `expires_at < now()` → return `{ error: "token_expired" }` → page renders state 6.
- **Hostile token (malformed or tampered):** token validation must fail closed. Return `{ error: "invalid_token" }` → page renders state 5 (rejected with copy: "This link is no longer valid."). Never echo the raw token in any error message or log.
- **Password too short (< 12 chars):** return `{ error: "password_too_short" }` before calling Supabase Auth.
- **Passwords don't match:** return `{ error: "passwords_dont_match" }` before calling Supabase Auth.
- **Cookie set but server fails to insert DB row:** the cookie should only be set after a successful DB insert. Roll back order if needed.
- **Middleware not updated:** if `/admin/password-reset` is not in the public-route allow-list, unauthenticated staff are redirected to `/admin/login` — defeating the entire flow. Add the route to the matcher before testing.

## How to verify it works
1. Submit a valid staff email → state 2 renders; a `account_password_requests` row with `status='pending'` appears in Supabase Studio; `password_reset_requested` audit row exists; `rahma_password_reset_request` cookie set in browser.
2. Submit an invalid email → state 2 renders identically (no visible difference); `password_reset_request_lookup_failed` audit row exists with email redacted.
3. Navigate to `/admin/password-reset/<valid_approved_token>` → state 4 renders; submit valid new passwords → staff account password updated in Supabase Auth (verify by signing in with new password); row status becomes 'used'; `password_reset_completed` audit row exists; browser redirects to `/admin/dashboard`.
4. Navigate to the same token URL a second time → state 6 renders ("This link has expired").

## Safe implementation order
1. Add `/admin/password-reset` and `/admin/password-reset/:path*` to the middleware's public-route allow-list. Confirm the routes render without redirect.
2. Implement `submitPasswordResetRequest` without the cookie — just the DB insert + audit write. Test: submit → row in DB.
3. Add the signed cookie after DB insert succeeds.
4. Implement `setPasswordWithToken` token validation and `status` check (before the Auth API call). Test: expired or wrong token → correct error returned.
5. Add the Supabase Auth admin-API call for password update. Test with a dev user account.
6. Add the session creation + redirect on success.
7. Add all error-path returns and confirm state routing in `page.tsx`.

## How to undo it if something breaks
The new routes and `actions.ts` file are additive. Removing them from the middleware allow-list makes the routes inaccessible. The `account_password_requests` table already exists; any inserted rows during testing can be cleaned up manually. No changes to existing user accounts unless `setPasswordWithToken` successfully completes.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
