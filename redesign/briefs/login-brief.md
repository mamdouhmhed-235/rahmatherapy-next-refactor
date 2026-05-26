# Brief: login

## 1. Feature Summary

The admin login page is the first Rahma surface every staff member sees. It authenticates with email and password via the `signInAdmin` server action, surfaces a clear inactive-account notice when `?reason=inactive` is present, and links forward to the password-reset flow. The layout is a single centred card on the warm ivory canvas, anchored by the full `logo-refined.svg` wordmark above the form. It must read as unmistakably Rahma before the staff member types a character.

## 2. Primary User Action

**Recognise the Rahma brand, enter credentials, and reach the dashboard in one attempt.**

## 3. Design Direction

**Colour strategy:** Committed. The login page is the brand gateway — the gold wordmark on ivory canvas, anchored by the Clinic Green submit button, makes "this is a Rahma surface" legible without any other decoration. Nothing else competes for attention.

**Theme scene sentence:** *"A therapist standing at a client's doorstep, phone in one hand, opening the admin to check the appointment details before ringing the bell."* The scene forces light mode (locked), one-handed mobile use, and a form that loads fast and responds instantly — no ambient chrome, no decorative weight.

**Anchor references:**
- **Stripe Dashboard login** — centred card, wordmark above the form, nothing decorating the canvas except brand identity; complete before you sign in
- **Linear sign-in page** — single-column, no split panel, typeface does the heavy lifting
- **Basecamp** — warm, human, a form that feels like walking into a known place rather than a security checkpoint

## 4. Scope

Production-ready. Centered card, full `logo-refined.svg` wordmark, email + password form, `?reason=inactive` inactive notice, "Forgot your password?" link to the password-reset flow. Phase 6 copies `brand-logo-assets/vector-trace-no-tagline/logo-refined.svg` to `public/images/brand/rahma/logo-refined.svg` and wires it up.

## 5. Layout Strategy

**Canvas:** Full-viewport warm ivory (`surface-page`, oklch 97.8%), no background image or texture.

**Card:** `Practice Panel` surface (oklch 99.2%), 8px radius, 1px `border-subtle`. Max-width 400px. Centred horizontally and vertically — `min-height: 100dvh`, flexbox column. `xl` (32px) padding on desktop; `lg` (24px) on mobile. No shadow at rest (Tonal Lift Rule).

**Card contents (top to bottom):**

1. **Logo block** — `logo-refined.svg` at 180px wide on desktop, 140px on mobile, natural colours (gold "RAHMA" + blue "therapy" script). `alt="Rahma Therapy"`. Centred. `xl` (32px) bottom margin.
2. **H1** — "Staff sign in" (Urbanist 600, heading step, Chronicle). `lg` (24px) bottom margin.
3. **Inactive notice** (conditional, `?reason=inactive`) — Restricted family colours, `lock` Lucide icon (16px, `aria-hidden`), copy: "Your account has been deactivated. Contact the owner to regain access." Full-border card with Restricted family background tint. Form still renders below it.
4. **Email field** — `<label>` "Email address" + `<input type="email" name="email">`. Standard DESIGN.md Input spec.
5. **Password field** — `<label>` "Password" + `<input type="password" name="password">`. "Forgot your password?" Ghost link right-aligned below the input (→ `/admin/password-reset`), Work Sans 400 label step, Soft Slate.
6. **Submit button** — Primary "Sign in", full-width. Loading state: 16px spinner, `aria-busy="true"`, text unchanged.
7. **Footer** — below the card, centred `text-muted`: "Rahma Therapy staff portal."

## 6. Key States

| State | What the user sees |
|---|---|
| Default | Logo, H1, email + password fields, "Sign in" button, "Forgot your password?" link |
| `?reason=inactive` | Logo, H1, Restricted-family inactive notice above the form, then the form |
| Field focus | Focus Azure border + ring on the active input |
| Submitting | "Sign in" button: 16px spinner, `aria-busy="true"` |
| Auth error (wrong credentials) | `<div role="alert" aria-live="polite" aria-atomic="true">` above submit: "Incorrect email or password." Cancelled family, `x-circle` icon. Password field clears; email retained |
| Server / network error | Same `role="alert"` region: "Something went wrong. Try again." Cancelled family, Ghost "Try again" |
| Success | `signInAdmin` redirects to `/admin/dashboard` |

## 7. Interaction Model

**Keyboard:** `Tab` moves email → password → "Forgot your password?" → "Sign in". `Enter` in either field submits. No autofocus on load (avoids aggressive mobile keyboard pop-up).

**Form submission:** `<form action={signInAdmin}>` server action. No client-side fetch. On error the server re-renders with the `role="alert"` region populated.

**"Forgot your password?" link:** Ghost, right-aligned below the password field, navigates to `/admin/password-reset`. Visible at rest.

**Inactive notice:** Static, not dismissible. Rendered server-side from `?reason=inactive` before hydration.

## 8. Content Requirements

**H1:** "Staff sign in"

**Field labels:** "Email address" / "Password"

**Button:** "Sign in"

**Forgot link:** "Forgot your password?"

**Inactive notice:** "Your account has been deactivated. Contact the owner to regain access."

**Auth error:** "Incorrect email or password." (wrong credentials) / "Something went wrong. Try again." (server error)

**Footer:** "Rahma Therapy staff portal."

**Logo:** `brand-logo-assets/vector-trace-no-tagline/logo-refined.svg` → copy to `public/images/brand/rahma/logo-refined.svg` in Phase 6. `alt="Rahma Therapy"`. Natural colours, no `invert`. Existing `logo-mark.svg` at 24px in `AdminTopNav` unaffected.

## 9. Recommended References

- `reference/interaction-design.md` — form field lifecycle, `role="alert"` error region, focus management
- `reference/spatial-design.md` — centred card layout, full-viewport canvas

## 10. Open Questions

1. **Password-reset link destination.** The "Forgot your password?" link points to `/admin/password-reset` — a net-new page per the RECON.md post-Phase-0 amendment. Phase 6 builds that page; confirm the route matches the password-reset brief before wiring the link.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/login/page.tsx` | Replace inline SVG glyph + green tile with `logo-refined.svg` `<Image>` component; restructure page into centred-card layout; handle `?reason=inactive` param to render inactive notice |
| `src/app/admin/login/LoginForm.tsx` | Restyle form to DESIGN.md Input spec; add full-width Primary "Sign in" button; add "Forgot your password?" Ghost link below password field; add `role="alert"` error region above submit; add loading state to button |
| `public/images/brand/rahma/logo-refined.svg` *(copy from `brand-logo-assets/vector-trace-no-tagline/logo-refined.svg`)* | New asset — Phase 6 copies this file; the login page `<Image>` src points here |

### Files to NEVER touch

- `src/app/admin/login/actions.ts` — `signInAdmin` server action; form must keep calling this unchanged
- `src/middleware.ts` — sets `?reason=inactive` redirect; do not modify
- `src/lib/auth/**`, `src/lib/supabase/**` — standard untouchables (RECON §5)
- `public/images/brand/rahma/logo-mark.svg` — the existing 24px nav mark; unaffected by this page
- All build/config files

### Feature Preservation Manifest

**Form field `name` attributes that must not change (RECON §2):**
`email`, `password`

**Server action wire-up:**
`signInAdmin(email, password)` — must remain `<form action={signInAdmin}>`, never replaced with a fetch/XHR call

**`?reason=inactive` handling:**
The middleware redirects to `/admin/login?reason=inactive` when an inactive account tries to access any admin route. The login page must read this param server-side and render the inactive notice before hydration. No JS required to show it.

**No JS hooks to preserve** on this page — RECON §6.4 lists no IDs or selectors specific to the login page.

### Information hierarchy (top to bottom)

1. Brand identity — `logo-refined.svg` wordmark (who this is)
2. Page purpose — H1 "Staff sign in" (what this page does)
3. Inactive notice — conditional, above the form (why access was blocked)
4. Form — email → password → forgot-password link → submit (the task)
5. Footer tagline — below the card (quiet brand close)

### Design direction — tokens and components

- **Canvas:** `surface-page` `oklch(97.8% 0.006 88)` — full viewport, no texture
- **Card:** `surface-card` `oklch(99.2% 0.004 88)` + 1px `border-subtle` + 8px radius; no shadow at rest (Tonal Lift Rule)
- **Logo:** `logo-refined.svg` at 180px wide (desktop) / 140px (mobile), natural colours, `alt="Rahma Therapy"`, no `invert` class
- **H1:** Urbanist 600, heading step (1.778rem), Chronicle `oklch(11% 0.014 155)`
- **Inputs:** DESIGN.md §5 — `surface-input` ground, `border-default` Form Seam, Focus Azure on focus, `role="alert"` error region
- **Submit button:** Primary full-width — `action-primary` fill, Field White text, 6px radius, 10px 20px padding, loading spinner replaces leading icon slot
- **"Forgot your password?" link:** Ghost — no border, no fill, Soft Slate at rest, Practice Charcoal on hover; Work Sans 400 label step; right-aligned below password field
- **Inactive notice:** Restricted family — `status-restricted-bg` tint + `status-restricted-text` + `lock` icon (16px, `aria-hidden`) + Work Sans 400 body step copy; full-border card (1px `status-restricted-text` at low opacity); `md` (16px) padding; `lg` (24px) bottom margin before the form fields
- **Auth error region:** Cancelled family — `<div role="alert" aria-live="polite" aria-atomic="true">` + `x-circle` icon (16px) + Work Sans 400 body step; positioned above the submit button
- **Footer:** Work Sans 400, label step, `text-muted` Soft Slate; centred below the card, `lg` (24px) top margin

---

## Implementation Notes

### Per-state intent

**Default (no params)**
- Logo centred, H1, clean form, "Forgot your password?" link, "Sign in" Primary button
- No visible error or notice regions
- No autofocus (avoids mobile keyboard pop-up on arrival)

**`?reason=inactive`**
- Inactive notice renders above the form fields (server-side from param, no JS)
- Heading: none — the notice is an inline banner, not a titled block
- Body: "Your account has been deactivated. Contact the owner to regain access."
- Icon: `lock` Lucide, 16px, `aria-hidden="true"`
- The form still renders below the notice (another staff member may need to sign in on the same device)
- The submit button is not disabled — the server action will handle any attempt

**Submitting**
- "Sign in" button: 16px spinner (Field White, border-right transparent) replaces leading icon slot; text unchanged "Sign in"; `aria-busy="true"`; button not disabled (prevents double-submit UX but still accessible)
- Inputs remain enabled

**Auth error (wrong credentials)**
- `role="alert"` region above submit button: "Incorrect email or password." with `x-circle` icon, Cancelled family
- Email field retains its value; password field clears (`value=""` on re-render)
- Both fields and submit button remain fully active

**Server / network error**
- Same `role="alert"` region: "Something went wrong. Try again." with Ghost "Try again" button that re-submits the form
- No data loss

**Success**
- `signInAdmin` middleware redirects to `/admin/dashboard` — no client-side success state needed on this page

### Per-viewport intent

**Mobile (375px)**
- Card: full-width with `lg` (24px) horizontal padding; no max-width constraint (fills the screen)
- Logo: 140px wide, centred
- All form elements full-width
- "Forgot your password?" link: right-aligned within the full-width password field container
- Footer: below the card, same centred single line
- No `AdminMobileActionBar` — submit is inline in the card

**Tablet (768px)**
- Card: max-width 400px kicks in; centred with auto margins; `xl` (32px) padding
- Logo: 180px wide

**Desktop (1440px)**
- Identical to tablet — the card is the content; the ivory canvas fills the rest
- Card remains max-width 400px, vertically centred in `min-height: 100dvh`
- No two-panel expansion (centred card is the confirmed layout)

### Verification steps

**Playwright (automated):**
- Default state: page loads at `/admin/login` — logo renders, H1 "Staff sign in" present, email + password fields present, "Sign in" button present, no error/notice regions visible
- `?reason=inactive`: navigate to `/admin/login?reason=inactive` — inactive notice renders with `lock` icon and correct copy before any interaction; form fields still present below it
- Tab order: Tab from email → password → "Forgot your password?" → "Sign in" — confirm sequence
- `Enter` in email field: focus moves to password field (or submits if password is filled)
- Submit with wrong credentials: `role="alert"` region appears above submit button with "Incorrect email or password."; password field clears, email retained
- "Forgot your password?" click: navigates to `/admin/password-reset`
- Successful sign-in: redirects to `/admin/dashboard`

**DevTools:**
- `logo-refined.svg` loads from `/images/brand/rahma/logo-refined.svg` with no 404
- No `invert` CSS class applied to the logo image
- `logo-mark.svg` in `AdminTopNav` is unaffected (still loads from its existing path)
- Inactive notice renders in the HTML source (server-rendered, not JS-injected) when `?reason=inactive` is in the URL

**`/impeccable audit`:**
- Zero `border-l-4` on the inactive notice or error region
- Inactive notice and error region both have text labels alongside their icons (not colour-only)
- No gradient text anywhere on the page

**`/impeccable critique`:**
- Single H1 "Staff sign in" — no heading hierarchy needed (no sub-sections)
- Email input has `<label for="email">Email address</label>` with matching `id`
- Password input has `<label for="password">Password</label>` with matching `id`
- Error region has `role="alert" aria-live="polite" aria-atomic="true"`
- Inactive notice has a programmatically determinable role — either `role="status"` or within a landmark that screen readers announce

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Encouraging empty states; specific errors; no raw permission names.

### Form labels

- `Email address *` (`name="email"`, `id="email"`) — placeholder `you@rahmatherapy.com`. Autocomplete `username`. Required marker (`*`) in Cancelled text colour with `aria-hidden="true"`.
- `Password *` (`name="password"`, `id="password"`) — autocomplete `current-password`. No placeholder (password placeholders are bad practice). Required marker as above.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Submit | `Sign in` | Primary (full-width) |
| Forgot link | `Forgot your password?` | Ghost (anchor → `/admin/password-reset`) |
| Server error retry | `Try again` | Ghost (inside `role="alert"`) |

### Error messages

- Empty email: `Add your email address.`
- Malformed email: `Email needs an @ symbol (for example, sara@rahmatherapy.com).`
- Empty password: `Add your password.`
- Wrong credentials (server response): `Incorrect email or password.` (no further detail — never reveals which field is wrong; standard auth practice)
- Server / network error: `Something went wrong. Try again.`
- Locked / rate-limited (if surfaced by server): `Too many sign-in attempts. Wait a few minutes and try again.`
- Inactive account on submit (caught server-side before redirect): `Your account is deactivated. Contact the owner to regain access.` (matches inactive-notice copy verbatim)

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| `?reason=inactive` notice (inline above form) | — | `Your account has been deactivated. Contact the owner to regain access.` | — |
| `?reason=session-expired` (optional future) | — | `You've been signed out. Sign in to continue.` | — |
| Footer | — | `Rahma Therapy staff portal.` | — |

No `EmptyState` component on this page — login is always in input mode.

### Tooltip text

- "Forgot your password?" link: `Reset your password` (native `title`). (Enhancement only; not visible on mobile.)
- Inactive-notice `lock` icon: `aria-hidden="true"`; the body copy carries the meaning.
- Submit button (loading state): `aria-busy="true"` is the announcement; no visible tooltip.

### Confirmation dialog text

No dialogs on this page. No destructive actions.

**Toasts**
- No client-side toasts. Successful sign-in redirects to `/admin/dashboard` where the dashboard chrome takes over.

