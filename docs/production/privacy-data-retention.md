# Privacy, Data Retention, And Customer Data Operations

This document defines the production privacy defaults for Rahma Therapy CRM data.
It is an operational policy for the application team, not legal advice.

## Capture And Logging Policies

### Sentry

- Production Sentry must keep `sendDefaultPii = false`.
- Server local variable capture must stay disabled in production.
- `beforeSend` scrubbing must remove names, emails, phone numbers, addresses, postcodes, health notes, consent notes, customer notes, admin notes, treatment notes, manage tokens, Supabase keys, Resend keys, and Sentry auth tokens.
- Safe operational context can include route, error class, status code, safe booking id, and safe staff id.

See [Sentry Privacy Policy](./sentry-privacy.md).

### Email Logging

- Store provider status, recipient, email type, booking id, staff id where relevant, timestamp, provider message id, and safe error summary.
- Do not store private email bodies by default.
- Failed email sends should create operational events with safe summaries only.

### Operational Errors

- Operational events must store safe summaries, status, severity, event type, and safe context only.
- Do not store raw request bodies, health notes, treatment notes, secrets, tokens, or full email bodies.

## Sensitive Data Access Rules

| Data category | Access rule |
| --- | --- |
| Health notes | Visible only to owner/admin users with operational need and assigned therapists where the booking context requires it. Excluded from default exports and operational logs. |
| Treatment notes | Visible only to permitted clinical/owner/admin users with operational need. Excluded from default exports and operational logs. |
| Consent records | Stored as booking/participant evidence. Excluded from default exports unless a future explicit sensitive-export permission is added. |
| Customer/admin notes | Permission-gated. Excluded from default exports and operational logs. |
| Audit logs | Visible only to users with `manage_audit_logs`. Raw payloads should not be shown to roles without sensitive-data permission. |
| Privacy requests | Visible and actionable only to users with `manage_privacy_operations`. |

## Retention Expectations

| Record type | Retention expectation | Notes |
| --- | --- | --- |
| Bookings | Retain for operational, financial, and dispute history. | Deletion/anonymization must preserve booking integrity where required. |
| Client profiles | Retain while there is an active customer relationship or legal/operational need. | Can be corrected; deletion may be anonymization if bookings must remain. |
| Booking contact snapshots | Retain with booking history. | Needed to preserve what was submitted for each appointment. |
| Health notes | Retain only as long as needed for safe service delivery and reasonable follow-up. | Review during privacy operations; minimize free-text detail. |
| Treatment notes | Retain only as long as clinically/operationally justified. | Keep permission-gated and excluded from default exports. |
| Consent records | Retain with booking history. | Needed to evidence acknowledgement. |
| Audit logs | Retain for accountability and security review. | Do not edit retrospectively. |
| Email status logs | Retain for operational troubleshooting and delivery evidence. | No private email body storage by default. |
| Enquiry records | Retain while follow-up is active; close stale leads. | Convert to bookings only through approved admin flow. |
| Operational error records | Retain until resolved and no longer needed for production support. | Store safe summaries only. |

## Customer Data Request Workflow

Use `/admin/privacy` and the client detail privacy workflow.

Supported request types:

- Data export request
- Correction request
- Deletion/anonymization review
- Sensitive note review

Workflow:

1. Verify the requester's identity before disclosing or changing data.
2. Create the privacy request from the relevant client detail page.
3. Review linked bookings, booking snapshots, health notes, consent records, email logs, audit logs, and operational constraints.
4. Set the request status to `reviewing` while work is in progress.
5. Complete the operation only after legal/operational retention needs have been considered.
6. Set the request status to `completed` or `declined`.
7. Every request creation and status change must write an `audit_logs` row.

## Deletion And Anonymization Rules

- Do not hard-delete booking or audit history when it would break operational, financial, legal, or accountability records.
- Prefer anonymizing client profile fields when a booking history must remain.
- Preserve booking-level contact snapshots if required for appointment/payment/dispute history.
- Remove or minimize health/treatment notes when there is no continuing need to retain them.
- Record the privacy decision in audit logs without copying sensitive note content into the audit payload.

## Production Checks

- Supabase security advisor must have no actionable security lints before launch.
- Browser bundles must not contain service-role keys, Resend keys, Sentry auth tokens, Cloudflare API tokens, manage tokens, or raw secrets.
- Default CSV exports must exclude health notes, treatment notes, admin notes, consent details, and raw audit payloads.
- Customer manage routes must only expose the booking linked to the validated token.
