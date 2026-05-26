# Scope — password-reset

Greenfield pre-auth surface. Six visible states across two routes inhabiting a single shared `PasswordResetCard` chrome. FAKE backend (two BLOCKS-REDESIGN BUILD plans pending: `BUILD-password-reset-email-templates.md`, `BUILD-password-reset-request-actions.md`).

## Files to edit

- `src/app/admin/password-reset/page.tsx` — server component (states 1, 2, 3, 5, 6 inline form). Reads signed cookie + queries `account_password_requests` to route state.
- `src/app/admin/password-reset/[token]/page.tsx` — dynamic server component (states 4, 5-on-token, 6-expired). Token verification server-side, never echoed.
- `src/app/admin/password-reset/actions.ts` — server actions: `submitPasswordResetRequest`, `setPasswordWithToken`, `clearPasswordResetCookie`. FAKE handlers no-op real DB writes/email sends; deterministic routing via test tokens.
- `src/app/admin/password-reset/PasswordResetCard.tsx` — shared chrome (logo, H1 slot, chip slot, body slot, affordance slot, back-link slot). Composition only; no state branching.
- `src/app/admin/password-reset/states/ForgotForm.tsx` — state 1 (email field + Primary).
- `src/app/admin/password-reset/states/SubmittedConfirmation.tsx` — state 2 (Pending chip + masked email + "Submit a different email" Ghost).
- `src/app/admin/password-reset/states/PendingStatus.tsx` — state 3 (Pending chip + dl Submitted/Sent-for).
- `src/app/admin/password-reset/states/SetNewPassword.tsx` — state 4 (Confirmed chip + two password fields + "Save and sign in" Primary).
- `src/app/admin/password-reset/states/Rejected.tsx` — state 5 (Cancelled chip + reviewer-note well + "Submit a new request" Primary).
- `src/app/admin/password-reset/states/Expired.tsx` — state 6 (Restricted chip + inline state-1 form).
- `src/middleware.ts` — APPEND two paths to existing public allow-list (`/admin/password-reset` and `/admin/password-reset/<token>`). Logic untouched per recipe Hard rule #3.
- `src/lib/email/templates.ts` — APPEND two template constants: `password_reset_approved` (FAKE stub; carries token link placeholder) and `password_reset_rejected` (FAKE stub; carries reviewer-note placeholder). Real send wiring lands with `BUILD-password-reset-email-templates.md`.
- `redesign/IMPLEMENTATION-PLAN.md` — "Currently on" line updated to row 16 password-reset.

## Files to NEVER touch

- `supabase/migrations/**` — `account_password_requests` table already exists; no schema change.
- `src/lib/auth/**` — RBAC + admin-access helpers; pre-auth surface does not use `getAdminPageAccess`.
- `src/lib/supabase/**` — client factories used unchanged.
- `src/app/admin/login/page.tsx` — Login session owns this; existing "Forgot your password?" Ghost link already routes here.
- `src/app/admin/account-password-requests/**` — sibling Brief 13 owns the admin-review queue.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `.env*`).
