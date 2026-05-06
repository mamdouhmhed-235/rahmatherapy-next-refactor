# Phase 3 Frontend, Booking UX, And Customer Lifecycle Findings

Tracking issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/101

## Skills And Capabilities Used

| Capability | Why used |
| --- | --- |
| code-review | Deduplicated confirmed UX defects from Phase 1/2 evidence. |
| agile-product-owner | Separated launch blockers, must-haves, should-haves, and polish. |
| codex-security:validation | Kept customer lifecycle findings separate from security/privacy risks. |
| architecture | Mapped booking route, API, manage-link, and admin handoff readiness. |

## Executive Summary

Launch readiness verdict for the customer-facing booking lifecycle: **Not ready for public launch polish, but core booking mechanics are materially functional**.

Phase 2 live E2E evidence shows the public booking flow can create normalized single-person, repeat-customer, and mixed-gender group bookings. Availability is gender-aware, booking creation is atomic enough to reject stale same-slot requests in a small parallel test, and email side effects did not block booking creation. The main customer-facing blocker is trust and perceived production quality: the live public site still exposes large visible placeholder image panels on the booking entry path.

## Customer Booking Readiness

| Area | Readiness | Evidence |
| --- | --- | --- |
| Public booking entry | Partial | `https://rahmatherapy.uk/?booking=1` opens the booking dialog with the expected service-first flow. Public home and service CTAs route into booking. |
| Step sequencing | Meets core need | Browser smoke shows the sequence `Service -> For -> Location -> Time -> Details -> Review -> Ready`. |
| Single booking creation | Meets core need | Phase 2 created a single-person audit booking with client, booking, participant, item, assignment, status, consent/notes, and email events. |
| Mixed-gender group booking | Meets core need | Phase 2 created a mixed-gender group with separate participants/items and gendered assignments; female therapist claim filled only the female assignment. |
| Repeat customer behavior | Meets core need | Phase 2 submitted multiple bookings for one audit customer and preserved separate booking snapshots/notes. |
| Availability | Meets core need / needs broader non-prod load testing | Gender-aware slots worked and a four-request parallel same-slot check accepted two requests and rejected two stale-slot attempts. Larger spike testing remains blocked pending non-production fixtures. |
| Customer manage link | Partial | Invalid/no-token route safely shows `Manage link unavailable`. Phase 1/2 evidence supports safe manage-link architecture, but broader cancellation/reschedule lifecycle confidence depends on more non-production E2E. |
| Email side effects | Meets core need | Phase 2 observed email delivery events and booking creation was not rolled back by email side effects. |
| Customer trust | Not launch-ready | Live public pages expose `PLACEHOLDER IMAGE` labels and intended asset paths in hero/body/final CTA sections. |

## Confirmed Findings

| Priority | Type | Title | Evidence | Issue |
| --- | --- | --- | --- | --- |
| P1 | Confirmed defect | Live public pages show placeholder image panels | Chrome DevTools Phase 3 smoke on `/` still shows `PLACEHOLDER IMAGE` alt text and intended file paths including `/images/home/home-hero.avif`. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/97 |
| P2 | Missing test readiness | Full E2E/high-volume booking tests need a controlled non-production path | `pnpm test:e2e` is unsafe for this live audit because current fixtures use `phase10_` data rather than the required audit isolation; broad load scenarios were blocked for safety. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/104 |

## Customer Lifecycle Assessment

The customer lifecycle is structurally strong: customers can start a booking without an account, provide participant-level data, get gender-aware availability, submit booking requests, and reach a safe manage-link route. Admin visibility, booking detail, payment state, participant breakdown, assignment state, notes, and email event visibility were tested through controlled audit records in Phase 2.

The lifecycle is still not launch-polished because the public site looks unfinished, cancellation/rescheduling expectations need clearer public-policy confidence, and high-volume spike behavior needs a safe non-production environment before serious marketing.

## Assessment Against `implementation_plan3.md`

| Plan area | Status | Notes |
| --- | --- | --- |
| Booking data model and atomic creation | Implemented | Normalized booking records and repeat-customer snapshots were verified. |
| Booking experience redesign | Implemented / partial polish | Flow is live and coherent; visual trust is weakened by placeholders. |
| Gender-aware availability | Implemented | Male/female/mixed participant matching was verified in Phase 2. |
| Customer manage, cancellation, rescheduling | Partial | Safe invalid-token route confirmed; broader lifecycle needs continued E2E coverage. |
| Email readiness | Partial | Email events are visible and non-blocking; production sender/domain readiness remains an operational gate. |
| Launch acceptance | Partial | Core booking works, but placeholder images and safe E2E/load coverage remain unresolved. |

## Recommended Order

1. Replace public placeholder imagery before serious public launch: #97.
2. Add a safe non-production E2E/load path: #104.
3. Run a final booking lifecycle smoke: public booking, admin visibility, manage link, cancellation/reschedule request, email event, and cleanup.

## No-Fix Confirmation

No booking UX fixes, application code changes, feature work, schema changes, configuration changes, or Supabase data changes were made in Phase 3.
