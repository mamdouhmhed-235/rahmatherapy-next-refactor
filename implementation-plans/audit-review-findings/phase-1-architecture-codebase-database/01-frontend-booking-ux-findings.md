# Phase 1 Frontend Booking UX Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/50

## Scope
- Public pages and booking entry points under `src/app/(public)/*`.
- Booking flow under `src/features/booking/*`.
- Public availability and booking API integration points.

## Architecture Map
- Public routes confirmed by `pnpm build`: `/`, `/home`, `/about`, `/reviews`, `/services`, `/services/[slug]`, `/faqs-aftercare`.
- Booking entry point: `src/features/booking/BookingExperience.tsx`.
- Booking step order: packages -> participants -> location -> schedule -> review -> prepared.
- Availability request boundary: `ScheduleStep` posts `date`, `serviceIds`, `participantGenders`, and `city` to `/api/availability`.
- Booking submit boundary: `submitBookingRequest` posts normalized booking payload to `/api/bookings/`.

## Findings

| Severity | Title | Evidence | Affected Area | Reproduction Notes | Follow-up Issue |
|---|---|---|---|---|---|
| Medium | Customer manage links are generated but no public manage route exists | `src/lib/email/notifications.ts` generates `/booking/manage?token=...`; `pnpm build` route inventory has no `/booking/manage` route. | Email UX, cancellation/manage workflow | Submit booking after emails are configured; the emailed manage link targets an absent route. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/53 |
| Medium | Booking schedule copy says availability is still static | `src/features/booking/components/ScheduleStep.tsx` lines 126-127 say static slots remain until live availability is connected, but the component now calls `/api/availability`. | Booking schedule step | Open booking flow schedule step; copy contradicts implemented live availability check. | Track with Phase 2 UX validation unless prioritized separately. |
| Low | Location step still contains temporary hard-coded coverage messaging | `LocationDetailsStep.tsx` has a temporary hard-coded city list and says outside-area users may still submit, while backend availability rejects outside `business_settings.allowed_cities`. | Booking location step | Enter a city outside Luton/Dunstable/Houghton Regis; UI permits progressing but schedule cannot produce valid slots. | Consider a follow-up UX issue after Phase 2 browser testing. |

## Data Flow
1. User selects services from the booking package UI.
2. User enters main contact and participant genders.
3. User enters city/address/postcode.
4. `ScheduleStep` calls `/api/availability` with service slugs, participant genders, date, and city.
5. User chooses returned time and submits review.
6. `submitBookingRequest` calls `/api/bookings/`.

## No Fixes
No frontend fixes were made in Phase 1.
