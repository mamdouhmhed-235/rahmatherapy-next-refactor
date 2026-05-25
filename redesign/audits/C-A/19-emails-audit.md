# C-A.1 #19 — `/admin/emails` audit (+ #20 template-preview route)

**Surface:** `/admin/emails` (delivery log + reminders + templates editor) + `/admin/email-templates/preview/[id]/route.ts` (193 LOC API endpoint for iframe template HTML preview)
**Audit type:** C-A.1 discovery (no fixes)
**Date:** 2026-05-25 | **Pre-state:** HEAD `1796608`.
**Source:** `emails/page.tsx` (985), `DeliveryFilterStrip.tsx`, `ReminderResendForm.tsx`, `CopyEventId.tsx`, `actions.ts`, `format.ts`, `error.tsx`, `loading.tsx`, `components/{ManualSendSheet,TemplateBrowser,TemplateEditForm,TemplatePreviewPanel,TemplatesTab,templates-data}.tsx/.ts`. Plus `email-templates/{actions.ts, preview/[id]/route.ts}`. Owner @ 1280 + 375.
**Screenshots:** 2 PNGs.

---

## Bugs

### B-83 — Only 7 event types defined; C-08 needs 3 more (assignment / claim / client-assigned)
**Severity:** HIGH (the C-08 user item)
**Source:** verified live DOM via filter dropdown. Event types found:
- Booking confirmation ✅
- New booking (admin) ✅
- Reminder ✅
- Cancellation (customer) ✅
- Cancellation (admin) ✅
- Reschedule request ✅
- Booking change (staff) ✅
**Missing per master plan C-08:**
- Assignment event (when a booking is assigned to a practitioner)
- Claim event (when a practitioner claims a booking)
- Client-assigned event (when a client is shown their assigned therapist)

**C-08 plan deliverable:** add 3 new templates + wire 3 new send hooks + 3 new email_event types. Reference template-editor UI in `components/TemplateEditForm.tsx` for the lift.

### B-84 — Resend buttons not present on delivery rows (cross-ref #04 B-18)
**Severity:** medium (operational gap from #04)
**Source:** DOM scan returned 0 buttons matching `/resend|retry|send again/i`. The `ReminderResendForm.tsx` component name implies a resend UI exists somewhere — likely scoped to the Reminders tab only, not the general Delivery log.
**Decision:** C-B planning for C-08 should confirm whether Resend Reminders is enough, or if all event types need resend.

### B-85 — No pagination indicated on delivery log (date-grouped scroll)
**Source:** verified live — sections show 6 days of activity (Thursday 21 May → Thursday 14 May) without "Load More" / pagination affordance. Worth checking the underlying query.
**Maps to:** C-09.

### B-86 — Master-plan PART-1 verdict for /admin/emails should be ⚠️ PARTIAL not ✅
**Source:** Part 1 already marks this as ✅ READY but contested per user item 8. The audit confirms the contested verdict — 3 event templates missing + resend UX gap. **Update Part-1 table to ⚠️ PARTIAL.**

---

## Strengths

### PE-51 — Full template editor + iframe preview already exists
**Source:** `components/TemplateEditForm.tsx` + `TemplatePreviewPanel.tsx` + the `/admin/email-templates/preview/[id]/route.ts` API renders HTML for the iframe. **This is the most sophisticated email-template UX I've seen in the audit.** C-08 plan is additive (new templates) not redesign.

### PE-52 — Templates tab + Reminders tab + Delivery tab separation
**Source:** verified live — 3 tabs offer clear IA.

### PE-53 — `ManualSendSheet.tsx` exists — admin can send manual email outside the automated flows
**Source:** subagent expected to confirm. Useful for one-off cases.

---

## RBAC + privacy

### CR-29 — `canViewEmailLogs` predicate gates the surface
**Source:** referenced in dashboard page.tsx during #01 audit. Owner/Admin can view; Therapist/Coord cannot.

---

## Console / network

CN-29 — 0 errors / 0 warnings on initial load.

---

## #20 — Template preview route

### Status — `route.ts` not a `page.tsx`
**Source:** `src/app/admin/email-templates/preview/[id]/route.ts` (193 LOC). It's the iframe source for the TemplatePreviewPanel.tsx — renders sanitized HTML for a given template_id with sample data. Not a user-facing page.
**Decision:** treat as part of #19 audit (this file). Separate audit file would be premature for an API endpoint.
**Risks to verify in C-08 plan:** the route should require `canViewEmailLogs`-equivalent permission; sample-data injection should be sanitised; iframe should set CSP `default-src 'self'`.

---

## Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-83 — 3 new event types needed | New templates + send hooks for assignment/claim/client-assigned | **C-08 (main)** |
| 2 | B-84 — no Resend on Delivery log | Per-row resend (with rate-limit?) | C-08 |
| 3 | B-85 — delivery log pagination | Load more or date-window | C-09 |
| 4 | B-86 — Part-1 verdict update | Mark `/admin/emails` ⚠️ PARTIAL | Master plan housekeeping |
| 5 | #20 — verify route.ts RBAC + sanitisation | API audit | C-08 |

---

## Hand-off

**State:** 2 screenshots. 0 code changes. **C-08 has a clear scope: 3 templates + send hooks + email_event types. Existing template UX is high-quality — additive work only.**
**Next surface:** #21 `/admin/roles + /[roleId]` (combined audit per master plan).

*End of emails + template-preview audit.*
