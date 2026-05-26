# Brief: password-reset

## 1. Feature Summary

`/admin/password-reset` (and `/admin/password-reset/[token]`) is the staff-facing forgot-password flow. Net-new in the codebase: the `account_password_requests` table has been in production since the phase-9 migration with one pending row and zero application-code references, so the redesign builds this surface greenfield rather than restyling. The flow has two routes and six visible states. **Route 1** (`/admin/password-reset`) starts as a forgot-password email form and resolves to one of three terminal-for-now states: *request submitted*, *pending review* (when the staff member returns and re-checks), or *rejected/expired* (when their previous request didn't pass). **Route 2** (`/admin/password-reset/[token]`) is the approved-with-token landing where the staff member sets a new password. The administrative approval queue itself lives on a separate authenticated admin page (`/admin/account-password-requests`, Brief 13). This brief only covers the pre-authentication surface. Surface intent: read as unmistakably Rahma, communicate the human-review nature of the process clearly (this is not a self-serve reset link sent to email; an Owner / Admin manually reviews each request), and never make the staff member feel they've done something wrong.

## 2. Primary User Action

**Submit a password-reset request, then come back later (or click an approval link in email) to set a new password. The page tells you exactly which of the six states you are in and what to do next, every time.**

## 3. Design Direction

**Colour strategy:** Committed. Identical to the Login brief: gold `logo-refined.svg` wordmark on warm ivory canvas, anchored by Clinic Green CTAs. This is the second pre-auth surface in the product and it must read as a sibling of Login, not as a generic recovery page. Status families appear sparingly on this surface (Pending for "request submitted" and "pending review", Cancelled for "rejected", Restricted for "expired", Confirmed for the post-set-password success line), each one a single labelled chip beneath the H1, never a banner that dominates the card.

**Theme scene sentence:** *"A therapist standing in her kitchen on a Sunday evening, locked out after a phone reset, tapping 'forgot password' from the Login screen because she has a 9am visit tomorrow morning and needs the admin to work by then."* The scene forces light mode, single-column, mobile-first, low-anxiety copy, and a layout that does not hide the human-review caveat behind any small print; the user needs to know up front that this is not an instant-reset flow.

**Anchor references:**
- **Stripe Dashboard's "Forgot password"** — centred card, single column, terse copy, no decoration, brand identity carried entirely by the wordmark
- **Tailscale's device-authorisation prompt** — a flow that openly says "an admin needs to approve this" without making the user feel watched; the request is normal, not exceptional
- **Linear's session-expired re-auth screen** — calm copy, no red banners, no alarming icons; the page treats lockout as routine

Anti-anchor: the generic "we've sent you a reset email" SaaS confirmation that lies (because Rahma doesn't email a reset link; an Owner reviews the request manually). The copy must reflect the real flow, not the SaaS reflex.

## 4. Scope

Production-ready, greenfield. Two routes (`/admin/password-reset` and `/admin/password-reset/[token]`). Six visible states (see §11 Flow states). Single shared card layout that swaps inner content per state. Inherits the Login brief's canvas + wordmark treatment verbatim. Includes the new server actions to write into `account_password_requests` (`submitPasswordResetRequest`, `checkPasswordResetStatus`, `setPasswordWithToken`), wired as `<form action={…}>` per RECON §6, no client-side fetch.

**Out of scope:** the Supabase Auth admin-API call that resets the password when an Owner approves a request (lives in Brief 13's server actions). The email template that notifies the staff member of approval / rejection (handled by Brief 02 / email-templates as two new templates: `password_reset_approved` with the token link, and `password_reset_rejected` with the reviewer note). The token generation, hashing, and TTL policy (lives in the migration; this brief does not propose schema changes). The admin-side review queue UI (Brief 13).

## 5. Layout Strategy

**Canvas:** Identical to Login, full-viewport `surface-page` (warm ivory, oklch 97.8%), no background imagery.

**Card:** `Practice Panel` (oklch 99.2%), 8px radius, 1px `border-subtle`, max-width **440px** (wider than Login's 400px because two of the states render a small dl-style status block alongside the form). Centred horizontally and vertically (`min-height: 100dvh`, flex column). Padding `xl` (32px) desktop / `lg` (24px) mobile. No shadow at rest.

**Card content rhythm (top to bottom, shared across states):**

1. **Logo block** — `logo-refined.svg`, 180px desktop / 140px mobile, natural colours, `alt="Rahma Therapy"`, centred, `xl` bottom margin. Identical to Login.
2. **H1** — state-specific (see §11). Urbanist 600 heading step, Chronicle. `lg` bottom margin.
3. **State chip** (states 2–6 only; state 1 has no chip) — single inline chip in the appropriate status family, beneath the H1, leading Lucide icon + visible text label. Work Sans 500 label step.
4. **Body copy** — Work Sans 400 body step, Practice Charcoal, max 65ch. Plain English. No technical terms (no "encrypted_payload", no "token expired"; say "the link is no longer valid" instead).
5. **State-specific affordance** — form, status `<dl>`, or back-to-login Ghost link. Specified per state in §11.
6. **Footer link** — "Back to sign in" Ghost link beneath the card affordance area, Ghost style, centred. Always visible except on the success state of the set-new-password form (where it redirects automatically).
7. **Page footer** — below the card, centred Soft Slate Work Sans 400 label step: "Rahma Therapy staff portal." Identical to Login.

**Single shared card layout, content swap per state.** This is a deliberate restraint: six states could spawn six wildly different layouts, but the staff member who hits this surface is anxious (locked out, deadline pressure), and a stable card frame with predictable swap-in content reads as "I'm in the right place" at every state. Linear-restraint via Rahma palette, applied to a recovery flow.

## 6. Key States

The six full flow states are documented in §11 Flow states (the user-requested section). This §6 covers the cross-state UI behaviours:

| Cross-state | What the user sees |
|---|---|
| Loading (form submission) | Submit button: 16px Field White spinner, `aria-busy="true"`, button text unchanged. Other inputs disabled. |
| Validation error (invalid email format on state 1, mismatched passwords on state 4) | `role="alert" aria-live="polite" aria-atomic="true"` region below the offending field; Cancelled family colours, `x-circle` 16px icon, plain-English explanation. |
| Server error (network failure, Supabase outage) | Same `role="alert"` region above submit: "Something went wrong. Try again in a minute." Cancelled family, Ghost "Try again" button. Never reveals stack traces, table names, or token values. |
| Rate-limit hit (user spams "Submit") | State 2 (request submitted) renders preemptively after first valid submit; subsequent submits within the cooldown window render a Pending family info line beneath the H1: "We've already got your request from {time}. We'll get back to you soon." No new row in `account_password_requests`. |
| Hostile token tampering | `/admin/password-reset/[token]` with a token that fails verification renders **state 5 (rejected)** copy with body: "This link is no longer valid. Submit a new request below." plus the state-1 form inline beneath. Never echoes the bad token. |

## 7. Interaction Model

- **State 1 → State 2.** `<form action={submitPasswordResetRequest}>`. Email field, Primary "Submit request". On success the same route renders state 2 (no redirect; server action returns a re-rendered page with state 2 content). On validation error, re-renders state 1 with the `role="alert"` region populated and email retained.
- **State 2 ↔ State 3.** The staff member can navigate away and come back. On return, if there's an open pending request linked to their email (cookie-tracked by a short-lived signed cookie set in state 2), the page renders state 3 (pending review status check) instead of state 1's form. The cookie is the only client-side state; the source of truth is the `account_password_requests` table row.
- **Email approval link → State 4.** The approval email contains a one-tap link `/admin/password-reset/<token>`. Clicking opens state 4 (set new password). Token is verified server-side; if invalid/expired/already-used, state 5 or 6 renders.
- **State 4 → Sign-in.** `<form action={setPasswordWithToken}>` with two password fields (`new_password`, `confirm_new_password`). On success the server action signs the staff member in (creates a fresh Supabase Auth session) and redirects to `/admin/dashboard`. No intermediate "password updated" confirmation; the dashboard is the confirmation.
- **State 5 (rejected).** Renders the reviewer's note (sanitised to plain text, no HTML) and a Primary "Submit a new request" button that resets the user back to state 1 with a cleared form.
- **State 6 (expired).** Renders a "Submit a new request" CTA and inline the state-1 form below it.
- **"Back to sign in" Ghost link** → `/admin/login`. Always visible except during the state-4 success redirect.
- **Keyboard.** Tab order respects card content rhythm. Enter in the email or password fields submits. No autofocus on mount (avoids aggressive mobile keyboard pop-up on a low-anxiety landing surface).
- **Reduced motion.** All state transitions are server-rendered route re-renders, no client transitions to disable.

## 8. Content Requirements

**Voice.** Plain. Direct. Kind. The staff member is anxious; the page is calm. Never apologise for the human-review process; frame it as "an Owner reviews each request" matter-of-factly. Never use "unfortunately", "sadly", "we're sorry". Never use technical terms (no "token", no "payload", no "TTL").

**Headings (per state).**

| State | H1 |
|---|---|
| 1. Forgot password form | "Reset your password" |
| 2. Request submitted | "Request received" |
| 3. Pending review | "Still waiting on review" |
| 4. Set new password | "Set a new password" |
| 5. Rejected | "Request not approved" |
| 6. Expired | "This link has expired" |

**State chip (states 2–6).**

| State | Chip family | Chip label | Icon |
|---|---|---|---|
| 2 | Pending | "Pending review" | `clock` |
| 3 | Pending | "Pending review" | `clock` |
| 4 | Confirmed | "Approved" | `check-circle` |
| 5 | Cancelled | "Not approved" | `x-circle` |
| 6 | Restricted | "Expired" | `lock` |

**Microcopy.** Single most important sentence on each state lives in §11.

**Form labels.**
- State 1: `<label>` "Email address" + `<input type="email" name="email" required>`. Required marker per DESIGN.md: red `*` in Cancelled text colour adjacent to the label, `aria-hidden="true"`.
- State 4: `<label>` "New password" + `<input type="password" name="new_password" required minLength="12">` and `<label>` "Confirm new password" + `<input type="password" name="confirm_new_password" required>`. Below the first password: Work Sans 400 label step Soft Slate hint: "At least 12 characters."

**Server-action error copy** (Cancelled family `role="alert"`):
- Email invalid: "Enter a valid email address."
- Email not found in staff table: **same generic state-2 success message** ("Request received") to avoid leaking whether an email belongs to a staff member. Audit log records the failed lookup; user sees normal success.
- Passwords don't match (state 4): "Passwords don't match."
- Password too short (state 4): "Password needs at least 12 characters."
- Token already used (state 4 hit twice): state 6 (expired) renders.
- Network error: "Something went wrong. Try again in a minute."

**Footer.** "Rahma Therapy staff portal." (same as Login).

## 9. Recommended References

- **`reference/interaction-design.md`** — for the cookie-vs-table state-source priority on state 2 ↔ state 3 routing.
- **`reference/copywriting.md`** — for the no-apology, no-technical-terms voice at Phase 7 Gate 2 `clarify`.
- **`reference/security.md`** (if present in the impeccable skill) — for the "do not leak whether an email is a staff member" pattern on state 1 form submission.

## 10. Open Questions

1. **Email enumeration trade-off.** This brief commits to *not* differentiating "email not found" from "request submitted" on state 1, to avoid leaking staff-membership info to unauthenticated visitors. Trade-off: a real staff member who mistypes their email won't get the request reviewed and won't know why. Mitigation: state 3 (pending review status check, cookie-routed) will, on subsequent visits, show no pending row found and route the user back to state 1 with a Soft Slate hint "If you submitted recently and don't see a pending review, check the email address you used." Flag for Phase 7 testing.
2. **Token TTL and the "expired" trigger.** The `expires_at` column drives state 6 routing, but the brief doesn't propose a TTL value. Recommendation: 24 hours from approval, configurable via a single Supabase setting. Phase 6 owner confirms.
3. **Re-submission cooldown.** This brief assumes a cooldown window for re-submitting state-1 within state-2's session (cookie-tracked). Cooldown length is a policy choice; recommend 30 minutes; Phase 6 owner sets.
4. **Email notification voice.** The two new email templates (`password_reset_approved` carrying the token link, `password_reset_rejected` carrying the reviewer note) need to match the on-page voice. Owner of Brief 02 (email-templates) inherits this; flag for cross-brief consistency at Phase 7 Gate 2.
5. **What does the reviewer-note display look like for hostile reviewer text?** State 5 renders the `reviewer_note` from the DB. If an Owner types HTML or a script tag into the reject form, the staff member should see plain text only. This brief specifies sanitisation; Phase 6 implements via React's default escaping (no `dangerouslySetInnerHTML`). Flag confirming.

---

## 11. Flow states

The six states the staff member can encounter, each scoped to the single shared card.

### State 1, Initial forgot-password form

**Route:** `/admin/password-reset` (no token in URL, no active session cookie).

**What the user sees.** Logo, H1 "Reset your password", body copy ("An Owner reviews each request. We'll let you know by email when it's approved."), email field, Primary "Submit request" button, "Back to sign in" Ghost link beneath the card.

**Action available.** Submit the email address. Or navigate back to login.

**Copy voice.** Plain and matter-of-fact about the human-review process: "An Owner reviews each request. We'll let you know by email when it's approved." No apology, no urgency theatre.

### State 2, Request submitted (confirmation)

**Route:** Same `/admin/password-reset` route, server-rendered after successful state-1 submit. Signed cookie set with the request's row ID + email hash, short TTL (~7 days, matching the implicit `expires_at` of the request itself).

**What the user sees.** Logo, H1 "Request received", Pending family chip "Pending review" beneath the H1, body copy ("Thanks. An Owner will review this and email you when it's approved. You can close this page; the link will come to your inbox."), small Soft Slate Work Sans 400 label step line below the body showing the masked email ("Sent for: f••@rahmatherapy.co.uk") so the user knows which mailbox to watch. "Back to sign in" Ghost link beneath.

**Action available.** Close the page and wait for email. The form is gone, no submit affordance. Optional Ghost "Submit a different email" link beneath the masked-email line (clears the cookie and re-renders state 1) for the case where the user realises they used the wrong email.

**Copy voice.** Reassuring without being saccharine: "Thanks. An Owner will review this and email you when it's approved. You can close this page; the link will come to your inbox." No "we've sent you an email!" (because we haven't yet; the Owner has to act first). Honest about the asynchronous nature.

### State 3, Pending review status check

**Route:** Same `/admin/password-reset` route, hit after the user navigates away and comes back, with the state-2 cookie still valid and the DB row still `pending`.

**What the user sees.** Logo, H1 "Still waiting on review", Pending family chip "Pending review", body copy ("Your request is still in the queue. We'll email you when it's approved. Submitted {time-ago, e.g. 'about 2 hours ago'}."), a small `<dl>` description list with two rows: "Submitted" → relative timestamp; "Sent for" → masked email. Ghost "Submit a different email" link. "Back to sign in" Ghost link beneath.

**Action available.** Same as state 2: wait, or change the email. No new submit affordance.

**Copy voice.** Calm patience without nagging. The relative-time line ("about 2 hours ago") tells the user it's normal that this takes time without committing to a specific SLA Rahma can't enforce.

### State 4, Approved with token (set new password)

**Route:** `/admin/password-reset/[token]`. The token is validated server-side on every render. If valid + status=approved + not expired, this state renders.

**What the user sees.** Logo, H1 "Set a new password", Confirmed family chip "Approved", body copy ("Almost done. Pick a password you'll remember."), two password fields (new + confirm), 12-character minimum hint beneath the first field, Primary "Save and sign in" button. No "Back to sign in" link on this state; staff is mid-flow and we don't want a back-link tempting them to abandon.

**Action available.** Set the new password and continue to the dashboard. Or close the tab (the token remains valid until used or expired).

**Copy voice.** Brief and warm: "Almost done. Pick a password you'll remember." Not "Please choose a strong password meeting the following criteria…"; the criterion is shown inline next to the input.

### State 5, Rejected

**Route:** Either `/admin/password-reset` (user returns to base route after rejection email, cookie still set but DB row now `status=rejected`) OR `/admin/password-reset/[token]` (user clicks an old token link after the Owner rejected the request before approving).

**What the user sees.** Logo, H1 "Request not approved", Cancelled family chip "Not approved", body copy ("An Owner reviewed your request and decided not to approve it this time."), reviewer-note block when `reviewer_note` is present: a `surface-page` (well) panel inside the card with the reviewer note as plain text under a Work Sans 500 label "Note from the reviewer:". When the note is empty, the reviewer-note block is hidden entirely (no "no note provided" placeholder). Primary "Submit a new request" button that resets to state 1. "Back to sign in" Ghost link beneath.

**Action available.** Submit a new request (returns to state 1 with a cleared form) or back to login.

**Copy voice.** Non-judgmental. "An Owner reviewed your request and decided not to approve it this time." Not "Your request has been denied" (legalistic), not "Sorry, we couldn't approve this" (apologetic). The reviewer note carries any specific reason; the page does not editorialise.

### State 6, Expired

**Route:** `/admin/password-reset/[token]` where the token row has `expires_at` in the past, regardless of `status`.

**What the user sees.** Logo, H1 "This link has expired", Restricted family chip "Expired", body copy ("This password-reset link is no longer valid. Submit a new request below."), the state-1 forgot-password form inline beneath the body (email field + Primary "Submit request"). No separate "Submit a new request" button; the inline form is the action. "Back to sign in" Ghost link beneath.

**Action available.** Submit a new request inline, or back to login.

**Copy voice.** Factual, no scolding. "This password-reset link is no longer valid. Submit a new request below." The user did nothing wrong; expiry is a system property.

---

**Carry-forwards this brief logs for Phase 6 implementation:**
- New routes: `src/app/admin/password-reset/page.tsx` (states 1, 2, 3, 5, 6-with-inline-form) and `src/app/admin/password-reset/[token]/page.tsx` (states 4, 5-on-token, 6).
- New server actions in `src/app/admin/password-reset/actions.ts`: `submitPasswordResetRequest`, `checkPasswordResetStatus` (cookie + table read), `setPasswordWithToken` (verifies token + calls Supabase Auth admin-API + writes `audit_logs` row `password_reset_completed`).
- Audit log rows to add (RECON §6.2 list extends): `password_reset_requested`, `password_reset_request_lookup_failed` (when an email doesn't match a staff member; redacts the email per §6.2 redaction regex), `password_reset_completed`, `password_reset_token_rejected` (hostile tampering or already-used).
- Two new email templates (Brief 02 owners): `password_reset_approved` (carries the token link) and `password_reset_rejected` (carries the reviewer note). On-page voice and email-template voice must match; flag for cross-brief consistency.
- New cookie name: `rahma_password_reset_request` (signed, short-lived, samesite=Lax, secure, httpOnly).
- No `dashboard-cards.tsx` / `notification-bell.tsx` / `attention-group-client.tsx` carry-forwards apply here; this surface doesn't touch them.

---

## Recipe Context

### Files to edit

This page is greenfield. All files in the table are net-new and do not exist before Phase 6.

| File | What it is |
|---|---|
| `src/app/admin/password-reset/page.tsx` | New route — handles states 1, 2, 3, 5, and 6 (when the user returns to the base route). Server component that reads the signed cookie + queries `account_password_requests` to decide which state to render. Renders the shared card layout from §5 with state-specific inner content from §11. |
| `src/app/admin/password-reset/[token]/page.tsx` | New dynamic route — handles states 4, 5 (on token), and 6 (token expired). Server-side token verification on every render. |
| `src/app/admin/password-reset/actions.ts` | New server actions file: `submitPasswordResetRequest(formData)`, `setPasswordWithToken(formData)`, `clearPasswordResetCookie()`. Every action writes an `audit_logs` row per §6.2 list extension. |
| `src/app/admin/password-reset/PasswordResetCard.tsx` | New client/server-blended component for the shared card chrome (logo, H1 slot, chip slot, body slot, affordance slot, back-link). State-specific content rendered by composition, not by branching inside this component. |
| `src/app/admin/password-reset/states/*.tsx` | One server component per state (`ForgotForm.tsx`, `SubmittedConfirmation.tsx`, `PendingStatus.tsx`, `SetNewPassword.tsx`, `Rejected.tsx`, `Expired.tsx`). Each renders into the shared card's inner slots. |
| `src/lib/email/templates.ts` | Two new template definitions: `password_reset_approved` and `password_reset_rejected`. Voice must match the on-page voice; Brief 02 (email-templates) owner reviews at Phase 7 Gate 2. |
| `public/images/admin/empty-states/` | No new illustration assets required for this brief — the flow uses chips + plain text, not illustrated empty states. |

### Files to NEVER touch

- `supabase/migrations/**` — the `account_password_requests` table already exists. This brief does NOT propose schema changes.
- `src/lib/auth/**` — RBAC and admin-access helpers; the password-reset flow does NOT use `getAdminPageAccess` (pre-auth surface).
- `src/lib/supabase/**` — client factories used unchanged.
- `src/middleware.ts` — the password-reset routes must be added to the middleware's public-route allow-list, but the middleware logic itself is untouched (RECON §5).
- `src/app/admin/login/page.tsx` — Login brief (Brief 09) owns this; the only touchpoint is the existing "Forgot your password?" Ghost link which already routes to `/admin/password-reset`.
- All build/config files.

### Feature Preservation Manifest

This is a net-new surface. There is no existing UI to preserve. The preservation contract is forward-looking:

**Routes that must remain reachable after Phase 6 (RECON §6.5 extension):**
- GET `/admin/password-reset` (pre-auth public route; add to middleware allow-list)
- GET `/admin/password-reset/[token]` (pre-auth public route; add to middleware allow-list)
- The existing `/admin/login` "Forgot your password?" link target (already coded per Login brief)

**Database contract:**
- Table: `account_password_requests` (existing, no schema change)
- Read columns: `id`, `email_hash` (for cookie matching), `status` (`pending` / `approved` / `rejected` / `expired`), `expires_at`, `reviewer_note`, `created_at`, `reviewed_at`
- Write columns: server actions insert new rows on state 1 submit; mark `status='used'` (or similar terminal state per the existing migration's enum) on state 4 success
- Token: validated against the encrypted_payload column server-side, never echoed to the client

**JS hooks / IDs to preserve:**
- `id="admin-main"` skip-link target on both new routes (a11y critical, inherits from `00-shared-components-brief.md` shell pattern, but this surface uses a stripped chrome — no top nav — so the skip-link target moves to the card root)
- No other hooks

**Audit log writes to ADD (RECON §6.2 extension):**
- `password_reset_requested` (state 1 success)
- `password_reset_request_lookup_failed` (state 1 email not found; redact email per §6.2 regex)
- `password_reset_completed` (state 4 success)
- `password_reset_token_rejected` (state 4 hostile token / already-used)

**External links to preserve:**
- POST `/admin/signout` not applicable on this surface (pre-auth, no signout button)
- No off-domain links on this surface

### Information hierarchy (top to bottom)

1. Brand identity (logo wordmark, anchors recognition)
2. State name (H1, tells the user where they are in the flow)
3. State chip (states 2–6; communicates the system's status at a glance)
4. Body copy (one or two sentences of plain-English context)
5. State-specific affordance (form, status `<dl>`, or CTA button)
6. Back-to-login Ghost link (always available except state 4 success)
7. Page footer ("Rahma Therapy staff portal.")

### Design direction, tokens and components

- **Canvas:** `surface-page` (`oklch(97.8% 0.006 88)`); no background imagery.
- **Card:** `surface-card` (`oklch(99.2% 0.004 88)`); 8px radius; 1px `border-subtle`; max-width 440px; `xl` padding desktop / `lg` mobile; no shadow at rest.
- **Logo:** `public/images/brand/rahma/logo-refined.svg` (already vendored by Brief 09 / Login); 180px desktop / 140px mobile; `alt="Rahma Therapy"`.
- **H1:** Urbanist 600 heading step (1.778rem); Chronicle (`oklch(11% 0.014 155)`).
- **State chips:** DESIGN.md §5 AdminStatusBadge spec; one chip per state, Pending / Confirmed / Cancelled / Restricted families per §8 table.
- **Body copy:** Work Sans 400 body step (1rem); Practice Charcoal; max 65ch line length.
- **Inputs:** DESIGN.md §5 Input spec — `surface-input` ground, `border-default` (Form Seam, `oklch(55% 0.022 80)`), 6px radius; focus shifts border to Focus Azure + ring.
- **Required marker:** `<span aria-hidden="true">*</span>` in Cancelled text colour (`oklch(26% 0.140 25)`) adjacent to required `<label>` elements.
- **Primary button:** Clinic Green fill (`oklch(23% 0.073 155)`); Field White text; 6px radius; padding 10px 20px; Work Sans 600 label step; full-width on the card.
- **Ghost button / link:** Practice Charcoal text; no border; Hover Moss hover fill; Focus Azure ring on focus.
- **Reviewer-note well (state 5):** `surface-page` background (steps down from the card's `surface-card`); 8px radius; 1px `border-subtle`; `md` (16px) padding; Work Sans 500 label step "Note from the reviewer:" above; Work Sans 400 body step note content; plain text only (no HTML rendering).
- **Status `<dl>` (state 3):** `surface-page` well inside the card; `<dt>` Work Sans 500 label step Soft Slate; `<dd>` Work Sans 400 body step Practice Charcoal; two rows max (Submitted, Sent for).
- **Error `role="alert"` region:** Cancelled family colours; `x-circle` 16px Lucide icon (`aria-hidden="true"`); Work Sans 400 body step; below the offending field or above submit per the cross-state matrix in §6.
- **Focus ring:** 3px Focus Azure with 2px offset on every interactive element.
- **Motion:** none required on this surface. State transitions are server-rendered route re-renders. Reduced motion is honoured by default because there are no client animations to disable.
- **Skeleton:** not used. This is a server-rendered page; states render fully or fall to the cross-state error region; there is no "loading" between states beyond the submit-button spinner.

---

## Implementation Notes

Per-state intent lives in §11 Flow states (above), one sub-heading per workflow state with what-the-user-sees / action-available / copy-voice for each of the six states. Per-viewport intent lives in §5 Layout Strategy (above); the layout is a single centred card with mobile padding adjustments only.

**Verification steps (for Phase 6 Step 6 verify):** Playwright + DevTools + `/impeccable audit` + `/impeccable critique`. Additional security verification: confirm state 1 returns identical responses for "valid staff email" and "email not found" via DevTools network inspector; confirm hostile tokens never echo to the client; confirm `reviewer_note` renders as plain text when the DB row contains HTML.

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Encouraging empty states; specific errors; no raw permission names.

### Form labels

Required markers (`*`) render in Cancelled text colour with `aria-hidden="true"` on every label below.

**State 1 (forgot-password form) and State 6 (expired, inline form):**
- `Email address *` (`name="email"`, type `email`) — placeholder `you@rahmatherapy.com`. Autocomplete `username`.

**State 4 (set new password):**
- `New password *` (`name="new_password"`, type `password`, minLength 12) — autocomplete `new-password`. Helper `At least 12 characters.`
- `Confirm new password *` (`name="confirm_new_password"`, type `password`) — autocomplete `new-password`.

### Form button text

| Slot | State | Text | Variant |
|---|---|---|---|
| Submit forgot form | 1 / 6 | `Submit request` | Primary (full-width) |
| Set password and continue | 4 | `Save and sign in` | Primary (full-width) |
| Resubmit after reject | 5 | `Submit a new request` | Primary |
| Change email | 2 / 3 | `Submit a different email` | Ghost |
| Back to login | all except 4-success | `Back to sign in` | Ghost |
| Server error retry | any | `Try again` | Ghost (inside `role="alert"`) |

### Error messages

- Email malformed (state 1/6): `Email needs an @ symbol. For example, sara@rahmatherapy.com.`
- Email empty (state 1/6): `Add your email address.`
- New password too short (state 4): `Password needs at least 12 characters.`
- Passwords don't match (state 4): `Passwords don't match.`
- New password contains email (state 4, server check): `Pick something that doesn't include your email address.`
- Network / server error: `Something went wrong. Try again in a minute.`
- Rate-limit hit on rapid resubmit: `We've already got your request from {time}. We'll get back to you soon.` (Pending family info line, not a `role="alert"` error — see §6)
- Hostile token (state 5-on-token / state 6): rendered as state 5 with body `This link is no longer valid. Submit a new request below.` Token never echoed.
- "Email not found in staff table" → page intentionally renders State 2 success copy (security-by-uniform-response). No visible error.

### Empty-state text

The flow uses chips + plain copy, not illustrated empty states. Per-state copy:

| State | Heading | Body | CTA |
|---|---|---|---|
| 1. Forgot form | `Reset your password` | `An Owner reviews each request. We'll let you know by email when it's approved.` | `Submit request` |
| 2. Submitted | `Request received` | `Thanks. An Owner will review this and email you when it's approved. You can close this page; the link will come to your inbox.` Sub-line: `Sent for: f••@rahmatherapy.co.uk` | `Submit a different email` (Ghost) |
| 3. Pending check | `Still waiting on review` | `Your request is still in the queue. We'll email you when it's approved. Submitted {time-ago}.` Sub-`<dl>` shows `Submitted` + `Sent for`. | `Submit a different email` (Ghost) |
| 4. Set new password | `Set a new password` | `Almost done. Pick a password you'll remember.` | `Save and sign in` |
| 5. Rejected | `Request not approved` | `An Owner reviewed your request and decided not to approve it this time.` Reviewer-note well (when present): `Note from the reviewer:` + plain-text note. | `Submit a new request` |
| 6. Expired | `This link has expired` | `This password-reset link is no longer valid. Submit a new request below.` (inline state-1 form below) | (inline form) |

### Tooltip text

- Helper hint under `New password` (state 4): `Mix in numbers, symbols, or a memorable phrase; anything that hits 12.`
- State-2 / state-3 masked email: native `title` shows the partial pattern with explanation — `Submitted on 12 May, sent for f••@rahmatherapy.co.uk`.
- "Submit a different email" Ghost (state 2/3): `Send the request to a different address.`
- State chip (per state): native `title` repeats the meaning — e.g. `Pending review. An Owner needs to approve before you can set a new password.`
- Approved chip (state 4): native `title` — `Approved. Set your new password below.`
- Cancelled chip (state 5): native `title` — `Not approved. See the reviewer's note.`
- Restricted chip (state 6): native `title` — `Expired. Links last 24 hours.`
- Reviewer-note well: no tooltip; the label `Note from the reviewer:` is explicit.

### Confirmation dialog text

No `ConfirmActionModal` instances on this surface. State transitions are server-rendered route re-renders, not modal flows. Submit interactions on state 1 (forgot form) and state 4 (set new password) are non-destructive (the audit log is the safety net) so no inline confirmation gates either.

**Toasts**
- No Sonner toasts on this surface (pre-auth; toasts are an authenticated-shell affordance). All feedback is in-page server-rendered copy.
- State 4 success is the redirect to `/admin/dashboard`; no intermediate "password updated" toast.

