# Phase 2 Blockers And Follow-Up Issues

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/57

## Confirmed Defects To File

| Severity | Recommended GitHub issue title | Source file |
|---|---|---|
| High | Fix group booking estimated total in public booking UI | `01-frontend-booking-ux-findings.md` |
| High | Snapshot booking contact details for repeat customers | `01-frontend-booking-ux-findings.md`, `02-admin-crm-ux-findings.md` |
| High | Make admin layout responsive on mobile | `02-admin-crm-ux-findings.md` |
| Medium | Replace stale static-slot copy with live availability messaging | `01-frontend-booking-ux-findings.md`, `04-business-operational-gaps.md` |
| Medium | Reset booking wizard step after successful submission | `01-frontend-booking-ux-findings.md` |
| Medium | Scope therapist booking detail controls to permitted actions | `02-admin-crm-ux-findings.md` |

## Blocked Or Partially Covered Areas

| Area | Status | Reason |
|---|---:|---|
| Resend acceptance details | Partial | Booking creation returned 200; email content and provider-side delivery were not inspected to avoid exposing private contents/secrets. |
| Concurrent assignment claim | Not fully exercised | Sequential already-claimed and wrong-eligibility paths were tested; true race/concurrency was not simulated. |
| Service create/edit/delete via admin UI | Partially covered | Services page loaded; no destructive service mutations were left behind. |
| Settings mutation | Partially covered | Settings page loaded; no global settings changes were made to avoid altering production-like behavior beyond audit records. |
| Deep accessibility audit | Partial | Basic semantics, labels, keyboard-visible controls, and mobile screenshots were reviewed; no automated axe run was performed. |

## Cleanup Confirmation

Cleanup was performed after the audit:

| Data class | Cleanup query/path |
|---|---|
| Booking assignments/items/participants/bookings | Deleted via `audit_phase2_%@example.test` client linkage. |
| Clients | Deleted where email matched `audit_phase2_%@example.test`. |
| Staff profiles | Deleted where email matched `audit_phase2_%@example.test`. |
| Auth users | Deleted through Supabase Admin Auth API for `audit_phase2_%@example.test`. |
| Anon insert probe | Confirmed blocked; no row cleanup needed. |

## Final Audit Notes

No source fixes, migrations, refactors, or feature changes were made in Phase 2. Only audit findings files and temporary `audit_phase2_` QA data were created.
