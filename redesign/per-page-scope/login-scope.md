# Per-page scope — login

## Files to edit

- `src/app/admin/login/page.tsx` — replace inline circle-plus SVG + "Rahma Therapy" wordmark text + shadow card chrome with: full `logo-refined.svg` `<Image>` above an H1 "Staff sign in"; centred card on full-viewport `surface-page` ivory canvas; render Restricted-family `?reason=inactive` notice (server-side) above the form; footer "Rahma Therapy staff portal." below the card; no shadow on the card at rest.
- `src/app/admin/login/LoginForm.tsx` — restyle inputs to DESIGN.md Input spec (Form Seam border, Focus Azure ring); replace destructive error toast block with `<div role="alert" aria-live="polite" aria-atomic="true">` Cancelled-family region with `x-circle` icon; add visible required `*` markers (Cancelled text colour, `aria-hidden="true"`) beside Email and Password labels; add Ghost "Forgot your password?" link right-aligned below the password input → `/admin/password-reset`; "Sign in" Primary full-width with 16px spinner loading state + `aria-busy="true"` + text unchanged; preserve `name="email"` and `name="password"` literal; preserve the call to `signInAdmin(email, password)` unchanged; clear password / retain email after wrong-credentials response; emit specific brief copy ("Incorrect email or password." / "Something went wrong. Try again." / "Your account is deactivated. Contact the owner to regain access.").
- `redesign/IMPLEMENTATION-PLAN.md` — update "Currently on" line to `5 of 29 — login`; flip `[ ]` → `[x]` + add commit hash on the login row after user approval (Step 13 follow-up, not before).
- `redesign/per-page-progress/login-progress.md` — append `step-N: COMPLETE — …` lines as each step finishes.
- `redesign/per-page-scope/login-scope.md` — this file (scope contract for this session).
- `redesign/HARDEN-RECS-login.md` — written in Step 9 with harden output.
- `redesign/PER-PAGE-SCORES.md` — appended in Step 12 with audit + critique results.
- `redesign/screenshots/login-redesign/*` — Playwright screenshots for verification.
- `redesign/baseline/login-adapt-after-*.png` — adapt verification screenshots.

## Files to NEVER touch

- `src/app/admin/login/actions.ts` — `signInAdmin` server action; signature `(email, password) → { error? }` is the contract the form must keep calling unchanged.
- `src/middleware.ts` — sets `?reason=inactive` redirect; the login page only *reads* this param.
- `src/lib/auth/**` — RBAC + profile helpers (RECON §5 untouchables).
- `src/lib/supabase/**` — Supabase client/server factories (RECON §5 untouchables).
- `public/images/brand/rahma/logo-mark.svg` — the 24px nav mark inside `AdminTopNav`; unaffected by this page.
- `public/images/brand/rahma/logo-refined.svg` — already tracked in the worktree; consumed as-is; not modified.
- `src/components/ui/card.tsx` — out of scope; H2/H3 fix lives in the `00-shared-components` session.
- Build / config files — `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `tailwind.config*`, etc.
- The main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — out of bounds; this worktree only.
