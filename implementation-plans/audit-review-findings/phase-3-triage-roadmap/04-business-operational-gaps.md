# Phase 3 Business And Operational Gaps

## Verdict

Business operations readiness is **not ready**. The product has a strong foundation for mobile therapy booking, gender-aware assignment, admin CRM, and cash/card payment tracking, but several operational requirements must be clarified before real customer/staff use.

## Missing Or Incomplete Business Requirements

| Severity | Gap | Evidence | Related issue |
| --- | --- | --- | --- |
| P0 | Production owner/admin/staff bootstrap | Supabase Phase 3 count found zero staff profiles and zero active booking staff. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/51 |
| P1 | Customer cancellation/rescheduling/manage workflow | Manage links are generated but no public manage route appears in build output. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/53 |
| P1 | Repeat-customer operational history needs booking-specific contact/address context | Phase 2 repeat booking changed customer details but CRM retained old client details. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/59 |
| P1 | Group booking payment expectation must match backend total | Phase 2 group booking UI displayed a lower estimated total than backend/admin records. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/58 |
| P1 | Observability/privacy defaults must match health-adjacent data | Sentry currently opts into default PII and server local variable capture. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/65 |
| P2 | Service-area and travel expectations need stronger operational handling | Prior audits noted service-area validation is not yet a complete UK postcode/travel model. | Existing backlog: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/8 |
| P2 | Admin mobile daily operations are not practical | Phase 2 found 390px admin layout is too constrained for realistic operations. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/60 |

## Launch Readiness By Business Area

| Area | Readiness | Notes |
| --- | --- | --- |
| Public website trust/content | Partially ready | Content is suitable for a UK mobile therapy business, but service-area, cancellation, payment timing, parking/access, preparation, and aftercare expectations should be clearer. |
| Customer booking | Not ready | Pricing, repeat-customer snapshots, manage links, and reset/copy issues remain. |
| Gender-aware availability | Mostly ready with follow-up | Phase 2 verified matching behavior, but customer-facing wording should stay simple and avoid exposing assignment mechanics. |
| Admin CRM | Blocked | No real staff/admin data exists, and mobile CRM usability is not production-ready. |
| Payments | Partially ready | Cash/card status tracking exists, but customer-facing payment timing and methods need clearer expectation setting. |
| Email/Resend | Not ready for production confirmation | Environment keys exist, but production sender/domain readiness and broken manage links must be resolved. |
| Privacy/GDPR readiness | Not ready | RLS is strong, but Sentry PII/local capture and sensitive data handling policy need production review. |

## Business-Fit Summary

Rahma Therapy can become operationally viable after a focused hardening pass. The most important product gaps are not broad feature requests; they are the operational contracts customers and staff rely on: accurate totals, reliable contact/address data per booking, clear cancellation/manage paths, real admin bootstrap, safe observability, and mobile-friendly admin workflows.

## Recommended Roadmap

1. Establish production admin/staff data and owner lockout procedure.
2. Fix booking integrity and pricing accuracy.
3. Resolve customer manage/cancellation/rescheduling expectations.
4. Harden privacy defaults and document sensitive-data handling.
5. Improve operational UX for mobile admin, repeat clients, and service-area handling.
