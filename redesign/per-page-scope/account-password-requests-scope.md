# Scope — account-password-requests

## Files to edit

- `src/app/admin/account-password-requests/page.tsx` — NEW. Server Component. Reads `?status=` GET param (pending / approved / rejected / expired / all; default pending). Permission-gates on `manage_account_password_requests`; renders `AdminAccessDenied` for everyone else. Renders H1 + subtitle + 5-tab strip + result count + request list.
- `src/app/admin/account-password-requests/RequestRow.tsx` — NEW. Per-row composition: avatar + email + status badge + relative timestamp; status-specific sub-row; status-specific action row.
- `src/app/admin/account-password-requests/ApproveModal.tsx` — NEW. Client wrapper around `ConfirmActionModal`; Confirmed-family glyph; optional `reviewer_note` textarea; Primary "Send approval email" with loading spinner; FAKE handler (`data-redesign-backend="FAKE"`).
- `src/app/admin/account-password-requests/RejectModal.tsx` — NEW. Client wrapper around `ConfirmActionModal`; Cancelled-family glyph; REQUIRED `reviewer_note` textarea with `*` marker; Destructive "Send rejection email" with loading spinner; FAKE handler.
- `src/app/admin/account-password-requests/actions.ts` — NEW. FAKE server actions `approvePasswordResetRequest({ requestId, reviewerNote? })` + `rejectPasswordResetRequest({ requestId, reviewerNote })` — no-op stubs that write nothing real; revalidate the route + return a structured result. Real wiring lands when 3 BUILD plans complete (BUILD-rbac-permission-account-password-requests.md, BUILD-password-reset-email-templates.md, BUILD-approve-reject-password-reset.md).
- `src/app/admin/account-password-requests/error.tsx` — NEW (added during D6 polish pass). Next.js segment-level error boundary that renders the brief §6 row-load error state ("Couldn't load requests. Try refreshing.") with a Cancelled-family `role="alert"` region and a Ghost retry button. Inert in the FAKE window (sync seed cannot throw); becomes the visible surface the moment a real Supabase query fails post-BUILD-plan landing.
- `redesign/per-page-progress/account-password-requests-progress.md` — append per step.
- `redesign/per-page-scope/account-password-requests-scope.md` — this file.
- `redesign/per-page-deferrals/account-password-requests-deferrals.md` — created in Step 13 (sentinel if no deferrals).
- `redesign/HARDEN-RECS-account-password-requests.md` — created in Step 9.
- `redesign/PER-PAGE-SCORES.md` — append `## account-password-requests — audit` + `## account-password-requests — critique` in Step 12.
- `redesign/screenshots/account-password-requests-redesign/*.png` — Steps 7 / 7b / 8 / 11b / 12c.
- `redesign/baseline/account-password-requests-adapt-after-{mobile,tablet}.png` — Step 8.
- `redesign/IMPLEMENTATION-PLAN.md` — "Currently on" line update only (Step 3); `[ ]` → `[x]` + commit hash only after user approval (Step 13).

## Files to NEVER touch

- `supabase/migrations/**` — the `account_password_requests` table already exists; no schema changes.
- `src/lib/auth/**` — RBAC matrix logic; permission seeded out-of-band, not edited in code from here.
- `src/lib/supabase/**` — client factories used unchanged (RECON §5).
- `src/middleware.ts` — route added to admin-protected set, but middleware logic untouched.
- `src/app/admin/audit/**` — Brief 11 owns these; cross-link target only.
- `src/app/admin/password-reset/**` — Brief 10 owns the sibling staff-facing flow.
- `src/app/admin/components/admin-ui-interactions.tsx` — `ConfirmActionModal` primitive used as-is, no modifications.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).
- The main tree `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`.
