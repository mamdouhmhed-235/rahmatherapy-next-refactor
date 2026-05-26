# HARDEN-RECS — password-reset

Run date: 2026-05-18 (Phase 6 Step 9)
Scope: `/admin/password-reset` and `/admin/password-reset/[token]`
Method: brief cross-reference + playwright probe + code audit + token-drift grep

## Verification matrix (brief §6 cross-state + edge cases)

| Edge case | Outcome | Status |
|---|---|---|
| 60-character email in state 1 | Input scrolls internally; card width 440px holds; no layout break | PASS |
| State 4 mismatched passwords | `role="alert" aria-live="polite"` inline below confirm field with "Passwords don't match." | PASS |
| State 4 password under 12 chars | `role="alert"` below new-password field with "Password needs at least 12 characters." | PASS |
| Hostile token (`<script>alert(1)</script>` URL-encoded) | Renders state 5 chrome ("Request not approved" + Cancelled chip) with body "This link is no longer valid. Submit a new request below." + inline state-1 form. **FIXED in this step** — previously fell to the regular state-5 body ("An Owner reviewed…") which is incorrect per brief §6. | FIXED |
| Token echoed to client | Token NEVER passed into JSX render path for hostile/expired/rejected cases. `admin-main` contains no occurrence of the raw token or `<script>` substring. The Next.js RSC stream serialises URL params as routing metadata but that is framework behavior, not a JSX echo; it is not executed as script. | PASS |
| Reviewer-note plain text under HTML payload | `PlainTextWell` renders `reviewer_note` via React's default escaping; `dangerouslySetInnerHTML` grep across `src/app/admin/password-reset/**` returns 0 hits. `white-space: pre-wrap` preserves multi-line legibility without re-introducing an HTML render path. | PASS |
| Rate-limit re-submit (state 1) | FAKE backend does not simulate cooldown; the cookie-based routing lands a returning visitor on state 3 ("Still waiting on review"). Real cooldown copy "We've already got your request from {time}." lands with `BUILD-password-reset-request-actions.md`. | DEFERRED → Phase 7 |
| Email-not-found (state 1) | FAKE handler treats every shape-valid email identically; renders state 2 (security-by-uniform-response). `submitPasswordResetRequest` does not branch on staff-table lookup. | PASS |
| Card max-width with two-password-field state 4 on desktop | `cardWidth: 440px` measured; layout holds; both password fields full-width inside card. | PASS |
| Validation error region wraps `role="alert" aria-live="polite" aria-atomic="true"` | All five error regions across state 1, state 4 confirmed via code grep + DOM snapshot. | PASS |
| Required `*` markers visible on every required label | State 1 `Email address *`, state 4 `New password *` + `Confirm new password *`, all in Cancelled text colour with `aria-hidden="true"`. | PASS |
| Focus-visible ring on every interactive element | Inherits from `Input`, `Button`, and Tailwind `focus-visible:ring-[var(--admin-focus)]/55` patterns. | PASS |
| `prefers-reduced-motion` | No client-side transitions on this surface (server-rendered route re-renders only). Honoured implicitly. | PASS |
| Cookie httpOnly + sameSite=Lax + secure (production) | `actions.ts` sets `httpOnly: true, sameSite: "lax", secure: production, path: "/admin/password-reset", maxAge: 7d`. The "signed" requirement is a FAKE gap pending `BUILD-password-reset-request-actions.md` (real implementation will hash email + sign). | PASS (signed-cookie deferred to Phase 7) |

## States covered by harden

The brief's six visible states are all reachable under FAKE backend via deterministic test tokens (`test-approved-token`, `test-rejected-token`, `test-rejected-empty`, `test-expired-token`) and cookie-based base-route routing. None added beyond the brief: harden confirmed the brief's enumerated set is exhaustive for this surface.

## File paths touched in this step

- `src/app/admin/password-reset/[token]/page.tsx` — added `kind: "hostile"` to `ResolvedTokenState`; default branch in `resolveToken` returns hostile; new render branch composes state-5 chrome + hostile body + inline state-1 form.

## Deferred to Phase 7

- Rate-limit cooldown copy (`BUILD-password-reset-request-actions.md` dependency).
- Signed cookie payload (`BUILD-password-reset-request-actions.md` dependency).
- Real Supabase Auth admin-API call on state-4 success + true session creation (`BUILD-password-reset-request-actions.md`).
- Real Resend send on approve / reject (`BUILD-password-reset-email-templates.md`).
- `account_password_requests` DB writes from `submitPasswordResetRequest`.
- `audit_logs` rows: `password_reset_requested`, `password_reset_request_lookup_failed`, `password_reset_completed`, `password_reset_token_rejected`.

## Carry-forward

No new states required beyond the brief. The harden pass strengthened the hostile-token render path and confirmed every other brief-listed edge case is already wired correctly under FAKE backend.
