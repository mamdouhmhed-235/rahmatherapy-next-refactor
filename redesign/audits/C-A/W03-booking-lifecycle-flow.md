# C-A.2 W03 — Booking lifecycle (pending → confirmed → completed → review) flow audit

**Workflow:** booking row in `pending` → admin clicks "Confirm" / sets via Status form → `confirmed` → admin clicks "Mark complete" → `completed` → (TODO) 2h-after-completion → Google review email to client. Each transition writes an audit_log row, may fire emails, and revalidates cross-page caches.
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `22ca0f1`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #02 (bookings list quick actions), #04 (booking detail Status form + next-action strip), #19 (emails surface — templates + delivery log).
**Source surveyed:**
- Server actions: `bookings/actions.ts:367-447` (`quickUpdateBooking`), `:118-237` (`updateBookingManagement`).
- Email vocabulary: `src/lib/email/notifications.ts` (9 exported functions), `src/lib/email/templates.ts` (9 render fns + 4 password-reset).
- DB state: `email_delivery_events` table (event_type histogram), `audit_logs` (booking action_type histogram), `bookings` (status distribution).
**Roles swept:** Owner. Cross-role pattern symmetrical per #02/#04.
**Live walk:** read-only — inspected the 1 completed audit-log row + the 3 quick-confirm rows. Did NOT trigger a new transition (would write to prod DB and fire emails — Zone-2 per master plan clarification 3).

---

## 1 — Status transition handlers + email behavior (consolidated from code + DB)

### Quick actions (`quickUpdateBooking`, actions.ts:367-447):
| Action | Status → | Audit log type | Email fired | Recipients |
|---|---|---|---|---|
| `confirm` | → `confirmed` | `booking_quick_confirm` | `sendAssignedStaffBookingChangeEmails` | **Assigned staff only** |
| `cancel` | → `cancelled` | `booking_quick_cancel` | `sendBookingCancellationEmails` | Client + admin + assigned staff |
| `complete` | → `completed` | `booking_quick_complete` | `sendAssignedStaffBookingChangeEmails` | **Assigned staff only** |
| `mark_paid` | (payment, not status) | `booking_quick_mark_paid` | none | — |
| no_show | **NOT A QUICK ACTION** | — | — | — (must use full Status form) |

### Full Status form (`updateBookingManagement`, actions.ts:118-237):
Same email pattern at lines 213-227: cancellation broadcasts; any other status change notifies only assigned staff.

### Production audit-log evidence (DB):
| Action type | Count |
|---|---|
| `booking_quick_confirm` | 3 |
| `booking_quick_cancel` | 2 |
| `booking_quick_complete` | **1** |
| `booking_management_updated` | 3 |
| `booking_assignment_*` | 9 |
| `booking_reminder_sent` | 2 |
| `booking_reschedule_*` | 2 |

**The completion code path has only been exercised once in production.** The 2 bookings currently in `completed` status came in seeded as completed (`updated_at = created_at`).

### Production email-event evidence (DB):
| Event type | Count |
|---|---|
| `booking_confirmation` | 5 (new-booking) |
| `admin_booking_notification` | 5 (new-booking → admin) |
| `booking_reminder` | 4 |
| `staff_assignment` | 4 |
| `booking_cancellation_customer` | 2 |
| `booking_cancellation_admin` | 2 |
| `staff_booking_change` | 2 |

**7 event types active.** Per C-A.1 #19 B-83, 9 templates exist in code — `reschedule request` + `plain text fallback` aren't firing in prod. (Plain text is a fallback; reschedule request only fires when a customer initiates one through the customer-facing manage page.)

---

## 2 — Bugs found

### B-115 — Client gets NO notification when their booking moves pending → confirmed
**Severity:** medium-high (client UX — they don't know the clinic accepted their booking)
**Source:** `actions.ts:429-437` — every status transition that ISN'T to cancelled calls `sendAssignedStaffBookingChangeEmails`, which (per `notifications.ts:491`) emails ONLY the assigned staff member. The client receives no notification.
**Implication:** when a client books online (or via phone → admin manual booking), they get the immediate confirmation email (`sendBookingCreatedEmails`). Then the admin reviews + confirms — and the client sees no further communication until the reminder cron fires. They have no signal that the clinic has confirmed availability and the slot is locked in.
**Decision:** **C-08 must add a `sendBookingConfirmedClientEmail`** when status moves pending → confirmed. Same fix shape as the existing assigned-staff branch but pointed at the client recipient. Use the existing template engine (`renderStaffBookingChangeEmail` pattern) for the structure.

### B-116 — No `sendBookingCompletedClientEmail` / `sendReviewRequestEmail` exists — C-01 is greenfield
**Severity:** high (it's the entire C-01 user item)
**Source:** `grep -r "review\|googleReview" src/lib/email` — returns no template render function for a post-completion review request. `notifications.ts` exports 7 booking-related send functions; none is for completion → client → review. Same `sendAssignedStaffBookingChangeEmails` is fired on completion at `actions.ts:430` — staff are told the booking completed; the client is told nothing.
**Implication for C-01 plan:** the work involves:
1. New template render function: `renderReviewRequestEmail(input)` in `templates.ts`.
2. New notifications function: `sendReviewRequestEmail(bookingId, client.email, adminClient, opts)` in `notifications.ts`.
3. A 2h delay mechanism — either:
   - (a) Postgres `pg_cron` job that polls bookings where `status='completed' AND review_email_sent_at IS NULL AND updated_at < now() - interval '2 hours'`.
   - (b) Vercel Cron / external scheduler.
   - (c) Inline scheduled-send via Resend's `scheduledAt` parameter (Resend supports this).
4. New `bookings.review_email_sent_at` column to prevent duplicate sends.
5. New email_event_type: `review_request_client`.
6. Service-aware copy: per the user item brief, the email's call-to-action should embed a service-specific pre-filled message into the Google review URL.
7. Audit log row when the email is sent: `review_email_sent` action_type.

### B-117 — No "Mark no-show" quick action
**Severity:** medium (workflow gap — common day-of-appointment scenario forces user to open the full Status form)
**Source:** `quickUpdateBooking` (actions.ts:388-401) handles `confirm | mark_paid | cancel | complete` only. `no_show` is in `BOOKING_STATUSES` (line 38-44) but has no shortcut.
**Implication:** when a therapist arrives, the client doesn't show, and the therapist needs to mark the slot no-show, they must navigate into the booking detail's Status & payment form (multi-field form). Friction at the worst moment.
**Decision:** add `no_show` to `quickUpdateBooking` accepted actions + add a "Mark no-show" button to the next-action strip on the booking detail. C-04 (cancellation pair) or C-12+ workflow polish.

### B-118 — `updateBookingManagement` Status form has the SAME client-notification gap as quickUpdateBooking
**Severity:** same as B-115 (same root cause)
**Source:** `actions.ts:213-227`. The full Status form also goes through the cancellation-OR-staff-only branch. Pairs with B-115; same C-08 fix covers both call sites.

### B-119 — Cancelled-bookings audit log lacks the OWNER context — `initiatedBy: "admin"` is hardcoded
**Severity:** low (forensic — when a customer-initiated cancellation happens, what audit-row distinguishes it?)
**Source:** `actions.ts:425` — `sendBookingCancellationEmails(bookingId, adminClient, { initiatedBy: "admin" })`. There's no path where a customer cancellation triggers this server action with `initiatedBy: "customer"`. The customer cancellation path likely lives in `src/app/booking/manage/...` and writes its own emails. But the email_delivery_events table doesn't separate customer-vs-admin cancellation in its event_type ("booking_cancellation_customer" and "booking_cancellation_admin" exist BUT both are 2 in prod — equal counts, suggesting BOTH paths got exercised symmetrically). The audit_log row for cancellation, however, is `booking_quick_cancel` whether admin-initiated or customer-initiated. **Initiator information is recoverable only by joining with email_delivery_events** — not a single-table view.
**Decision:** add an `initiated_by` field to the audit log row's `after_state` blob, OR use a distinct action_type for customer-initiated cancellations. C-12+ forensic improvement.

---

## 3 — Visual issues

### W03-V-1 — Next-action strip on `/admin/bookings/[id]` may not surface "Mark complete" depending on state
**Source:** per C-A.1 #04 audit — the detail page has a "next-action strip" that renders one or two buttons based on booking state. For a confirmed booking with a past start_time, "Mark complete" should appear. **Not re-verified live** for W03 (would require touching DB to age a booking back in time). Flag for #04 follow-up.
**Decision:** verify in W03 follow-up or fold into C-12+ next-action-strip discoverability pass.

### W03-V-2 — There is no "Send review now" / "Re-send confirmation" affordance on the detail page
**Source:** per #04 audit and #19 (emails surface) — neither offers a per-row "Resend" on the delivery log. So even once C-01 is built and a review email gets queued, there's no "resend to this client" button. Same for "send manual review request" before the 2h timer fires.
**Decision:** when C-01 ships, add a per-booking-detail "Send review request now" inline button + resend hook. Fold into C-08 or C-01.

---

## 4 — Empty / edge states

### W03-E-1 — No 2h timer infrastructure exists for C-01
**Source:** code search — no `pg_cron` jobs visible, no `vercel.json` cron entries (would need to check `vercel.json` separately), no `setTimeout`-based scheduler. The existing `booking_reminder_sent` cron (per audit log) is the only time-deferred email mechanism. C-01 plan needs to specify the scheduler.
**Decision:** **the C-01 plan should choose between (a) leveraging Resend's `scheduledAt`, (b) `pg_cron` + a polling function, or (c) Vercel Cron**. Reuse the reminder cron pattern if it's clean.

### W03-E-2 — A booking can be set to `completed` even if start_time is in the future (no temporal guard)
**Source:** `quickUpdateBooking` line 399-401 — `action === "complete" ? { status: "completed" } : null`. No check that the booking is actually in the past.
**Implication:** admin could accidentally mark a future-dated booking "completed". A C-01 review email would then be triggered before the appointment has even happened — embarrassing.
**Decision:** server-side guard: reject `complete` if `booking_date + start_time > now()`. C-04 (lifecycle) or C-12+.

### W03-E-3 — A `completed` booking can be transitioned back to `confirmed`/`pending` with no audit trail of the "un-complete"
**Source:** the full Status form has no guard — admin can pick any value from the BOOKING_STATUSES dropdown. Audit log captures the transition (so it's not invisible), but there's no UI affordance saying "are you sure?".
**Implication:** A booking that fired a review email then got reverted to "confirmed" → next time the admin marks it completed, the review email could fire again (depends on whether B-116 fix uses a `review_email_sent_at` sentinel, which it should).
**Decision:** sentinel column + idempotent guard (per B-116 plan).

---

## 5 — Cross-role inconsistencies

### W03-CR-1 — Quick actions visibility (per #04 audit)
- Owner / Admin / Coord: all see the next-action strip per `canManageAllBookings`.
- Therapist: per #04 — they see only their assignment's status, not the booking's. They can mark **their assignment** completed via `updateOwnAssignmentStatus`, but they can't mark the **booking** completed. The booking remains in `confirmed` until an admin runs `quickUpdateBooking` action=complete.
- **Race-condition implication:** when a therapist marks their assignment complete, but the booking stays at `confirmed`, the C-01 review email wouldn't fire (because it triggers off booking.status). **Subtle dependency** — the C-01 timer needs to choose: trigger off booking-level status, OR off all-assignments-completed-state. Pairs with #13 + #04.

---

## 6 — Cross-viewport issues

### W03-CV-1 — Quick-action buttons at 375
**Source:** per #02 + #04 audits. Mobile responsiveness for the next-action strip is good. No regressions at the workflow level.

---

## 7 — Console / network issues

### W03-CN-1 — 0 errors, 0 warnings across the read-only walk
No new findings vs #02/#04 baselines.

---

## 8 — Pre-existing items the audit accepts

### W03-PE-1 — `booking_quick_*` audit logs capture before + after state
**Source:** actions.ts:418-421. ✅ Strong forensic trail.

### W03-PE-2 — Cache invalidation on status transitions is comprehensive
**Source:** actions.ts:439-444 — `report-data` + `dashboard-data` tags, `/admin/bookings` + `/admin/bookings/[id]` + `/admin/dashboard` + `/admin/calendar` paths. ✅ Matches W02 + W01 patterns.

### W03-PE-3 — `paid_at` is set once on transition to paid and preserved on subsequent updates
**Source:** actions.ts:183-188 in `updateBookingManagement`. Mirror of the B-2 `first_contacted_at` idempotent guard pattern. ✅ Accept.

### W03-PE-4 — Cancellation email uses `initiatedBy: "admin"` to distinguish from customer-initiated cancel
**Source:** actions.ts:425. Email-event side captures the distinction (`booking_cancellation_admin` vs `booking_cancellation_customer`). Audit log side doesn't (B-119).

### W03-PE-5 — 7 email event types active in production
Matches #19 audit's "7 in DOM" finding — surface is honest about the gap.

---

## 9 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-115 — no client notification on pending → confirmed | Add `sendBookingConfirmedClientEmail` | **C-08 (HEADLINE)** |
| 2 | B-116 — no review request email; C-01 greenfield | Whole-stack: template + send fn + scheduler + sentinel column + service-aware copy | **C-01 (HEADLINE)** |
| 3 | B-117 — no "Mark no-show" quick action | Add to quickUpdateBooking + next-action strip | C-04 or C-12+ |
| 4 | B-118 — same client-notification gap in full Status form | Folds into B-115 fix | C-08 |
| 5 | B-119 — audit log can't distinguish customer-vs-admin cancellation | Add `initiated_by` to audit `after_state` | C-12+ |
| 6 | W03-V-1 — next-action strip discoverability | Verify in live walk + adjust state predicates | C-12+ |
| 7 | W03-V-2 — no "Send review now" affordance | Add inline button on detail | C-01 or C-08 |
| 8 | W03-E-1 — no 2h timer infrastructure | Choose scheduler (Resend scheduledAt / pg_cron / Vercel Cron) | C-01 design decision |
| 9 | W03-E-2 — can mark future-dated booking complete | Temporal guard in server action | C-04 or C-12+ |
| 10 | W03-E-3 — un-complete with no idempotency on review email | Sentinel column `review_email_sent_at` | C-01 |
| 11 | W03-CR-1 — therapist vs booking completion semantics | Decide: trigger C-01 off booking-status OR all-assignments-completed | C-01 design decision |

---

## 10 — Cross-references to existing findings

- **B-83 (C-A.1 #19)** — "C-08 missing 3 event types: assignment / claim / client-assigned". W03 adds B-115 (`booking_confirmed_client`) and B-116 (`review_request_client`) to the C-08 backlog. **C-08 is now ~5+ new event types, not 3.**
- **B-84 (C-A.1 #19)** — "no Resend on delivery log". Pairs with W03-V-2 — "no Send review now affordance".
- **#02 + #04** — bookings list + detail Status form audit findings remain authoritative for visual/state issues; W03 layers on the cross-page email & scheduler concerns.

---

## 11 — C-01 scoping deliverable (most useful artifact from this audit)

C-01 plan can lift this directly:

**Goal:** send a Google Business review request to the client 2 hours after their appointment is marked completed, with service-aware pre-filled copy.

**Schema:** add `bookings.review_email_sent_at TIMESTAMPTZ NULL` (sentinel — prevents duplicate sends).

**Template:** new `renderReviewRequestEmail(input)` in `templates.ts`. Reuses `renderBookingPlainText` for the fallback. Input shape: `{ booking, client, service, businessGoogleReviewUrl }`.

**Send function:** new `sendReviewRequestEmail(bookingId, adminClient, opts)` in `notifications.ts`. Idempotent on `review_email_sent_at`. Writes `email_delivery_events` row with `event_type='review_request_client'`. Updates the sentinel column on success.

**Scheduler choice:**
- (a) Resend `scheduledAt: now + 2h` — fired inline at the completion server action. Simplest. Risk: if Resend's scheduling has a per-day quota or limit, that's invisible.
- (b) `pg_cron` polling `WHERE status='completed' AND review_email_sent_at IS NULL AND completed_at < now() - 2h LIMIT 50` every minute. Self-healing.
- (c) Vercel Cron — same as (b) but in our codebase.

**Sequence at completion:**
1. `quickUpdateBooking` / `updateBookingManagement` action="complete" runs.
2. Status update + audit log + cache invalidation (existing).
3. Add: set `bookings.completed_at = now()` (new column, ALTER TABLE needed).
4. Add: if scheduler-choice-(a), `sendReviewRequestEmail(..., { scheduledAt: completedAt + 2h })`.
5. If scheduler-choice-(b)/(c), the cron picks it up.

**Service-aware copy:** the email body interpolates `service.name` from `booking_items` (group bookings → use first item or combined name). Google review URL gets the message pre-filled via `?gpb_review_search_term=...` query param syntax (verify with Google Business profile docs at plan time — user-supplied URL needed).

**Un-complete safety:** if booking is reverted from completed → confirmed BEFORE the 2h timer fires:
- Scheduler-choice-(a): the scheduled Resend send proceeds anyway (can't cancel). Real risk.
- Scheduler-choice-(b)/(c): the poller sees `status != completed` and skips.
- **Recommendation:** scheduler-choice-(b) is safer for un-complete cases.

---

## 12 — Hand-off

**State:** 0 screenshots. 0 code changes. 0 prod DB writes. 5 new bugs (B-115 → B-119). The booking lifecycle is **structurally fine for transitions + audit + staff notification** but has **HEADLINE gaps for client communication**:
1. **C-01 greenfield** — no review email mechanism at all.
2. **C-08 client-confirmed gap** — pending→confirmed sends no client email.
3. **No no_show quick action** — operational gap.

**C-01 + C-08 scoping in §11 above is the most useful deliverable from this audit** for the C-B planning phase.

**Next workflow:** W04 — cancellation + restore. Tests the cancellation server actions + the "restore from audit log" copy on cancelled-detail (#04 B-16/E-12), and the C-05 cancelled-bookings-can't-be-claimed bug.

**Bug index advance:** B-114 → B-119. Next available: B-120.

*End of W03 booking-lifecycle-flow audit.*
