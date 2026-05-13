# Email Templates — Preview Server Route — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** email-templates-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `email-templates`

## What this is
A new Next.js App Router server route handler at `/admin/email-templates/preview/[id]` that renders a specific email template with realistic dummy data and returns the HTML for display in the sandboxed preview iframe.

## Why it's needed
`src/lib/email/templates.ts` is SERVER ONLY and cannot be imported by any Client Component. The preview iframe (§5) must load the rendered HTML from a server-side endpoint — there is no other safe path. Without this route, the right-panel preview is blank for every template.

## What it does (user story)
"As an Owner previewing the booking-cancelled email, I want to see the actual rendered HTML that clients receive — with real-looking dummy data filling in client names, booking dates, and service names — so I can verify the copy before the next real cancellation fires it."

## What information it stores or retrieves
Accepts GET `/admin/email-templates/preview/[id]?field_key=greeting_intro&override_value=...` (optional live-edit query params for the unsaved-changes preview). Calls the matching `render*Email()` function from `templates.ts` with hardcoded dummy data (the dummy data lives in the route handler, not in `templates.ts`). Also reads any saved overrides from `email_template_overrides`. Returns `text/html` with `Content-Security-Policy: sandbox` header.

## Who can use it
Authenticated admin sessions only. Middleware's admin-route protection covers this route. The iframe src is a relative URL so it never leaks outside the authenticated session.

## What can go wrong
- **`templates.ts` import in a Client Component:** the route handler must be `src/app/admin/email-templates/preview/[id]/route.ts` (server route) — never imported into a `'use client'` file. Confirm with a bundle analyser that `templates.ts` does not appear in the client bundle.
- **Dummy data missing a required template variable:** if a render function expects `bookingDate` and dummy data omits it, the function throws a render error. The route handler must catch render errors and return a fallback `<p>Preview unavailable. Template render error.</p>` with 200 status so the iframe doesn't show a broken frame.
- **XSS via rendered HTML:** the iframe uses `sandbox` attribute. Confirm the route returns `sandbox="allow-same-origin"` in its Content-Security-Policy and the iframe element sets `sandbox="allow-same-origin"` and `referrerPolicy="no-referrer"`. No user-controlled data (from `email_template_overrides`) should be injected as raw HTML — render functions must sanitise/escape all variable values.
- **Route accessible without authentication:** if middleware's matcher does not cover `/admin/email-templates/preview/*`, unauthenticated requests could render template HTML. Confirm the route is under the admin matcher.
- **Template ID not found:** if the URL contains an unrecognised `id`, the handler returns 404 with a plain error body.

## How to verify it works
1. Navigate to `/admin/email-templates/preview/booking_confirmation` (authenticated) → rendered HTML for the booking-confirmation email with dummy data appears.
2. Check browser network tab → `Content-Type: text/html`, no `templates.ts` in the client bundle.
3. Set `src` of an iframe to the preview URL → email renders inside the iframe without script execution (`sandbox` attribute blocks scripts).
4. Navigate to the URL while signed out → redirected to `/admin/login` (middleware covers it).

## Safe implementation order
1. Create `src/app/admin/email-templates/preview/[id]/route.ts` as a GET handler returning a static "Preview coming soon" HTML string. Confirm the route is reachable and returns 200.
2. Add a static map of `id → render function` from `templates.ts`.
3. Add dummy data constants for each template.
4. Call the matching render function and return the HTML. Handle render errors with the fallback.
5. Add `email_template_overrides` lookup to inject saved overrides into the dummy data before rendering.
6. Wire the iframe `src` in `TemplatePreviewPanel.tsx`.

## How to undo it if something breaks
Delete `src/app/admin/email-templates/preview/[id]/route.ts`. The iframe src becomes a 404; the preview panel falls back to its empty state. No data loss.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
