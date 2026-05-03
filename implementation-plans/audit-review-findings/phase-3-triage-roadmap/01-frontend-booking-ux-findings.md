# Phase 3 Frontend And Booking UX Findings

## Verdict

Launch readiness for the customer booking experience is **not ready**. The public site and booking entry point load, but confirmed Phase 2 defects and Phase 3 code review evidence show pricing, repeat-customer data, customer manage links, and reset behavior need remediation before public launch.

## Evidence Collected

- Browser smoke on `2026-05-03`: `/home/`, `/services/`, and `/admin/login/` returned HTTP 200 on `http://localhost:3000`.
- Booking modal opens from `/home/?booking=1`.
- Build route inventory includes public routes and admin routes, but no public booking manage route.
- `pnpm lint`, `pnpm build`, and `git diff --check` passed during Phase 3.
- Supabase cleanup check found `0` `audit_phase` clients, bookings, and auth users.

## Confirmed Findings

| Severity | Finding | Evidence | Issue |
| --- | --- | --- | --- |
| P1 | Group booking estimated total under-displays price | Phase 2 E2E showed 2-person booking UI estimated total as GBP45 while backend/admin recorded GBP90. Phase 3 code review found `BookingSummary.tsx` displays `formatPrice(packageTotal)` without multiplying by `numberOfPeople`. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/58 |
| P1 | Repeat-customer contact details are not snapshotted per booking | Phase 2 repeat booking used same email with changed phone/address; admin client details stayed at original values. Phase 3 code review found `createOrFindClient` returns the existing client id by email without updating or storing booking-level contact snapshots. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/59 |
| P1 | Customer manage links are generated but no public manage route exists | Phase 1 found email/manage-link support without a matching public route. Phase 3 build output confirmed no `/booking/manage` route. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/53 |
| P2 | Booking wizard reset leaves the customer on the confirmation step | Phase 2 E2E: after submission, "Start a new request" cleared data but kept the wizard on confirmation instead of returning to service selection. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/62 |
| P2 | Static slot copy conflicts with live availability behavior | Phase 2 E2E found date/time helper copy still says live availability is coming soon despite active dynamic slot calculation. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/61 |
| P2 | UK/London date handling needs explicit hardening | Phase 1 found date/minimum-notice logic is not consistently explicit about Europe/London behavior around UTC/BST boundaries. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/54 |

## Booking Experience Assessment

The booking flow is structurally close to the desired sequence: service, demographics, location, dates/times, then details/review/confirmation. The experience is not launch-ready because the review step can misprice group bookings, repeated customer contact changes can be detached from the booking context, and manage links can lead customers to a missing route.

Gender-aware availability was exercised in Phase 2 and generally behaved correctly for male, female, and mixed-group matching. The remaining UX risk is copy clarity: customers should understand that availability reflects matched therapist availability without being forced to reason about internal assignment capacity.

## Recommended Order

1. Fix the group booking total mismatch before public booking is enabled.
2. Add booking-level contact/address snapshots or a safe client update model.
3. Either implement customer manage links or remove them from production emails until ready.
4. Clean up reset behavior and stale availability copy.
5. Re-run booking E2E for single, mixed-gender group, and repeat-customer flows.
