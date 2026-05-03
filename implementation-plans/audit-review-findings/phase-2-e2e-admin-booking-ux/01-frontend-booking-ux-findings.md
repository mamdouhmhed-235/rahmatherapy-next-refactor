# Phase 2 Frontend Booking UX Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/57

## Routes Tested

| Route | Result | Notes |
|---|---:|---|
| `/` | Pass | 200, no initial console errors. |
| `/home/` | Pass | 200, booking CTA opens dialog. |
| `/services/` | Pass | 200, service CTAs route to booking. |
| `/about/` | Pass | 200. |
| `/reviews/` | Pass | 200. |
| `/faqs-aftercare/` | Pass | 200. |
| `/admin/login/` | Pass | 200. |

## E2E Matrix

| Test | Result | Evidence |
|---|---:|---|
| Single-person male booking | Pass | UI submitted `audit_phase2_single@example.test`; `/api/bookings/` returned 200; DB created 1 client, 1 booking, 1 participant, 1 item, 1 male assignment. |
| Mixed-gender group booking | Pass with UX defect | UI submitted 2-person male/female booking; DB created 2 participants, 2 items, 2 assignments with male/female required therapist genders. |
| Repeat customer booking | Partial | Both bookings linked to one client record, but second booking contact name/phone were not snapshotted and displayed as the first booking's client details. |
| Consent and health notes | Pass | `consent_acknowledged=true`; booking health notes persisted. |
| Availability selection | Partial | API enforced availability, but UI copy says slots are static and all global slots are displayed without customer-facing live-matching explanation. |

## Findings

| Severity | Title | Reproduction steps | Expected behavior | Actual behavior | Evidence | Affected route/file/table | Recommended follow-up issue title |
|---|---|---|---|---|---|---|---|
| High | Group booking UI shows single-person total after selecting multiple participants | Open booking, choose Hijama Package, set 2 people, select male + female, review and submit. | Review and success summary should show the group total, `£90.00` for 2 x £45. | UI showed `Estimated total £45` while DB/admin showed `£90.00`. | Browser review and success screens showed £45; Supabase `bookings.total_price` was `90.00`. | `/home/?booking=1`, booking dialog summary | Fix group booking estimated total in public booking UI |
| High | Repeat booking loses the second request's contact snapshot | Submit a booking for `audit_phase2_single@example.test`, then submit another with same email but different name/phone. | Admin should show the contact details supplied for that booking, or clearly indicate reused CRM details. | Second booking displayed the first client's name and phone because only the client record is linked. | Group booking entered `audit_phase2_repeat client` / `07700900002`; admin and DB client still showed `audit_phase2_single client` / `07700900001`. | `clients`, `bookings`, `/admin/bookings/[bookingId]/` | Snapshot booking contact details for repeat customers |
| Medium | Booking time step still describes static slots | Complete steps through location. | Customer should see live availability language aligned with gender-aware therapist matching. | Text says: "These static slots remain requests only until live availability is connected in the next phase." | Browser booking step 4. | `src/features/booking/components/ScheduleStep.tsx` | Replace stale static-slot copy with live availability messaging |
| Medium | Start a new request does not reset the booking step | Submit a booking, then click `Start a new request`. | Dialog should reset to step 1 with a clean selection. | It remained on step 6 while clearing selected packages and showing a step-6 success shell. | Browser after success. | booking dialog state/store | Reset booking wizard step after successful submission |
| Low | Public site still exposes placeholder image text | Load `/home/` and inspect package/team/final CTA imagery. | Production-like audit should show real visual assets or intentionally hidden placeholders. | Several image alt/text placeholders are visible to assistive tech and in rendered placeholders. | Browser snapshot showed `PLACEHOLDER IMAGE...` text for multiple images. | `/home/`, public image components/content | Replace visible placeholder media on public pages |

## UX Notes

The booking sequence is understandable and respectful overall: Service -> Clients -> Location -> Time -> Review -> Ready. Gender collection is explained in plain language. The weak points are price trust for group bookings, stale availability copy, and lack of per-participant identity beyond gender for group bookings.
