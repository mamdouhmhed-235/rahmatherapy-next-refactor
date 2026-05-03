# Phase 2 Business Operational Gaps

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/57

## Business-Fit Findings

| Severity | Title | Reproduction steps | Expected behavior | Actual behavior | Evidence | Affected route/file/table | Recommended follow-up issue title |
|---|---|---|---|---|---|---|---|
| High | Group booking price mismatch can undermine payment trust | Create a two-person Hijama booking. | Customer should see the same total they will be expected to pay/admin will manage. | Public UI says £45; admin/DB says £90. | Booking success screen vs admin booking detail. | Booking dialog summary | Align customer and admin group booking totals |
| Medium | Service-area expectations are present but not operationally explicit enough in booking | Complete booking location step. | Booking should confirm whether city is covered and explain travel/parking/access expectations. | City is collected, but the UI does not give strong operational confirmation or parking/access guidance. | Location step fields only: city, area, postcode, address. | Booking location step, business settings | Add customer-friendly service-area and access expectations |
| Medium | Availability language does not explain matched therapist capacity | Choose mixed-gender group and select time. | Customer should understand that shown slots have matching male/female therapist availability without seeing staffing complexity. | UI says preferred/static request slots and does not explain matched therapist availability. | Booking time step copy. | Booking schedule step | Explain matched therapist availability in booking flow |
| Low | Cancellation/rescheduling expectations are not prominent in booking | Review public booking flow and supporting pages. | Before submission, customer should see concise cancellation/rescheduling expectation. | Review confirmation says request is not final, but cancellation expectations are not prominent in the booking flow. | Booking review step. | Booking review step / FAQs | Add concise cancellation and rescheduling expectation to booking review |

## Business Coverage Notes

The public site communicates mobile home visits, Luton coverage, same-gender female care, hygiene, qualifications, and aftercare. The highest operational risks are not content volume; they are pricing consistency, repeat-customer contact clarity, and availability language that still describes a prior non-live phase.
