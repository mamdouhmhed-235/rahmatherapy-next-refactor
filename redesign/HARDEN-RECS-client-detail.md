# HARDEN-RECS — client-detail

Date: 2026-05-18

## Key states implemented (brief §6)

- Default loaded — header + sidebar + Upcoming tab active.
- Upcoming / Past / All tabs — server-rendered from `?tab=` URL param via `coerceTab` (unknown silently coerces to `upcoming`).
- Empty Upcoming / Past / All — EmptyState component with brief-correct heading, body, and optional "Book now" CTA gated on `canManageAllBookings`.
- Notes: collapsed (Ghost "Add note" with `+`) / expanded (textarea + Save + Cancel) — `useState isExpanded` in ClientDetailForms.tsx.
- Privacy section — request list (status-family badge) + always-visible ClientPrivacyRequestForm.
- Therapist view — Stats / Privacy / Audit / "New booking" CTA hidden via clientAccess + canManageAllBookings gating; booking history scoped via `booking_assignments`.
- Fallback panel — rendered when health/notes/privacy all denied.
- Access denied — AdminAccessDenied with brief copy "You don't have access to this client's profile" / "Contact the owner if you need access.".
- Loading — Next.js Suspense + AdminPanel built-in `loading` prop (panel skeleton).

## Edge cases verified

- `?tab=` with unknown value silently coerces to `upcoming` (no error) — `coerceTab` at `page.tsx:65-69`.
- 60-character client name — header H1 uses `text-balance` + `clamp(1.778rem, 3vw, 2.369rem)` so it scales without breaking layout.
- 500-character / 4-row note — sidebar Note list wraps via `whitespace-pre-wrap` + `leading-6` and the textarea row count is brief-spec 4.
- Add-note animation — uses `motion-safe:` modifier so `prefers-reduced-motion` is respected.
- Empty Past tab — renders "No past bookings yet" with no CTA (read-only context per brief).

## Not implemented in this session (deferred / out of scope)

- City/area fields (`20260513120000_add_client_city_area.sql` migration) — types lack `city`/`area` columns in this checkout; the brief allows showing "—" when blank, which is the current behaviour for address/postcode.
- Per-impeccable-axis screenshots (Step 7 axes) — page met brief on first craft with no visible problems; no axis applied.
