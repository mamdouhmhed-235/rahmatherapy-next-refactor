# Deferrals — client-new

Date: 2026-05-18 (refreshed after enhancement pass)
Recipe: /redesign/per-page-recipes/client-new-recipe.md
Brief: /redesign/briefs/client-new-brief.md

## Items resolved in the enhancement pass (no longer deferred)

The following items previously deferred were implemented in scope without straying from brief:

- **"Try again" Ghost in `FormErrorBanner`** — brief §6/§8. Now renders a Ghost retry button inside the Cancelled-family banner that re-submits the form on click. `ClientCreateForm.tsx` `FormErrorBanner`.
- **Soft "no contact channel" warning modal** — brief §10 Q2 / §8. Now fires a `<dialog>` modal when both `email` and `phone` are empty on submit, with the brief-verbatim heading "No contact details yet", body, and Primary "Save anyway" / Secondary "Add contact details" buttons. `ClientCreateForm.tsx` `NoContactDialog`.
- **Submission failure banner copy prefix `"Couldn't create client. {server message}"`** — brief §6/§8. `FormErrorBanner` now prepends the brief-mandated prefix to whatever string the server returns.
- **Client-side pre-validation (courtesy)** — brief §Copy §Error messages strings now render client-side BEFORE the network round-trip for email/phone/postcode format issues. Verbatim messages: "Email needs an @ symbol (for example, sara@example.com).", "Phone number is too short. Include the area code.", "Postcode doesn't look right. Try the format LU1 1AA." Server remains the source of truth — server-side validation is unchanged.
- **AdminMobileBottomNav collision** — sticky save bar now uses `bottom-14 z-30` on mobile to sit cleanly above the `h-14` fixed mobile nav (matches the pattern used by `SettingsForm.tsx`). Form root carries `pb-32` on mobile so the last form content scrolls into view above the save bar.
- **Live region for submission status** — sr-only `<div role="status" aria-live="polite">` now announces "Saving client…" / "Couldn't save client." beyond the per-field `role="alert"` pattern.
- **aria-required on required inputs** — `FormField` now sets `aria-required="true"` whenever `required` is set.
- **`scrollIntoView` on first invalid field** — focus useEffect now also scrolls the field into view with `{ block: "center", behavior: "smooth" }`.
- **Desktop-only autofocus on first field** — `full_name` auto-focuses on mount via `matchMedia("(pointer: fine)")` guard, so mobile keyboards don't pop up unsolicited.
- **Native `<select>` chevron replaced with custom `ChevronDown`** — Rahma-tokenised chevron over `appearance-none` select.
- **Disabled submit affordance** — opacity 0.4 + cursor-not-allowed (matches DESIGN.md §5 disabled spec).
- **Submit press-state** — `active:scale-[0.98]` (motion respects `prefers-reduced-motion` globally).
- **Banner mount animation** — duplicate + form-error banners use `.rahma-pop-in` keyframe (subtle scale+opacity, 140ms ease-out-quart).
- **Panel mount animation** — three panels use `.rahma-fade-up` (subtle translate+opacity, 320ms ease-out-quart).
- **Character counter on Notes textarea** — renders `{N} / 2000` with `maxLength={2000}`.
- **"* means required" legend as Cancelled-tinted pill** — replaces tiny grey text legend.
- **"Where did this client come from?" helper on Source select** — small clarity nudge for novice admins.
- **Microcopy under submit on desktop** — "We'll redirect you to the new client's profile after save." reassures the operator about what happens on success.
- **Address sub-section divider in Panel 2** — `email + phone` (contact) and `address + postcode + city + area` (where they are) separated by a thin `border-t` + uppercase "Address" sub-heading. Breaks the panel-shape sameness without splitting into a 4th panel.
- **`max-w-[14rem]` → `max-w-[220px]`** on Postcode field — matches brief §5 verbatim.
- **Postcode 4px drift fixed** — see above.

## Items still deferred (genuine scope blockers)

### postcodes.io postcode → city/area auto-fill
- **Source:** brief §4 + brief §10 Q3
- **Verbatim:** Brief §4 Out: "No address autocomplete / postcode lookup currently. UK postcode validation stays server-side only. Recommend applying the same pattern to this form... Out of scope for current session."
- **Defer to:** Phase 7 (or follow-up `BUILD-postcode-lookup-client.md` session)
- **Why deferred:** Out of scope per brief §4. Requires a server endpoint + integration with postcodes.io, beyond the sanctioned city/area additive.

### `AdminAccessDenied` Secondary "Back to dashboard" styling distinction
- **Source:** brief §11 Denied
- **Verbatim:** "Single Secondary 'Back to dashboard' → /admin/dashboard. Tertiary Ghost 'View clients' → /admin/clients"
- **Defer to:** Phase 7
- **Why deferred:** Both CTAs render (default AdminAccessDenied "Back to dashboard" link + custom "View clients" via `actions` slot), but the default styling is Ghost-shape, not Secondary-shape. Distinguishing requires touching the shared `AdminAccessDenied` component which affects every admin page.
- **Provisional Phase 6 answer used to continue this session:** Both CTAs render functionally; styling distinction is a system-wide polish item.

### Status-family colour values inlined as oklch() constants
- **Source:** audit P2 finding · ClientCreateForm.tsx:12-17
- **Defer to:** Phase 7 (system-wide)
- **Why deferred:** Design-system gap, not a page-local lapse. DESIGN.md doesn't expose CSS variables for status backgrounds yet; `admin-ui.tsx:315` and `staff/availability/lib.ts` use the same pattern. Right fix is to canonicalise into `tokens.css` in Phase 7.

### Brief §Copy §Error messages — server-side validation strings
- **Source:** brief §Copy §Error messages
- **Defer to:** Phase 7
- **Why deferred:** Refining server-side Zod messages requires touching `actions.ts` beyond the sanctioned city/area additive. Brief §Copy strings now render *client-side* for email/phone/postcode formats (courtesy pre-validation), but the server's Zod messages for `full_name`/`client_source` remain "Full name is required." / "Invalid option…" instead of brief's "Enter the client's full name." / "Pick where this client came from." Properly addressed when Phase 7 revisits server-side message canonicalisation system-wide.

### Server duplicate-warning prose template
- **Source:** brief §Copy
- **Defer to:** Phase 7
- **Why deferred:** Brief specifies the template `"Possible duplicate client: {field} matches an existing record for {existing client name}."` but the current server returns `"{name} ({contact})"` joined by commas. Server-side change; out of scope per RECON §5 untouchable rule.

### text-white literal on submit button
- **Source:** audit P2
- **Status:** RESOLVED — submit button now uses `text-[oklch(99.5%_0.003_88)]` (Field White token from DESIGN.md §2) instead of `text-white`.
