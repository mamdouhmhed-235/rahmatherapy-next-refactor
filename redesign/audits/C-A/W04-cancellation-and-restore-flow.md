# C-A.2 W04 — Booking cancellation + restore flow audit

**Workflow:** booking in any active status → cancel (via 3 paths: admin quick / admin Status form / customer manage page) → status=`cancelled` → emails fired → (later) restore via Status form (Cancelled → Confirmed/Pending). Tests round-trip semantics + cross-page state hygiene + the "restore from audit log" copy.
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `b542b4a`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #02 (bookings list quick cancel + Cancelled tab), #04 (booking detail Status form + B-16/E-12 "restore from audit log" copy + B-15 four C-05 edit points), #09 (calendar excludes cancelled), #25 (reports filter `b.status !== "cancelled"`), W03 (cancellation email pattern).
**Source surveyed:**
- Admin cancellation: `bookings/actions.ts:213-227` (Status form) + `:423-437` (quick action).
- Customer-side cancellation: `src/app/booking/manage/actions.ts` (lines 115-182) + `src/lib/booking/customer-manage.ts` (lines 140-260) — separate cutoff-aware code path.
- Restore: no dedicated server action; happens via `updateBookingManagement` status dropdown.
- Cross-page filters for cancelled bookings: `clients/[clientId]/page.tsx:1408`, `reports/reporting.ts:813`, `calendar/page.tsx` (per #09).
**Roles swept:** Owner. Customer-manage path can be inferred from code (the manage URL goes to a customer-facing page outside `/admin`).
**No submit performed.** Read-only walk; all behaviour derived from code + existing audit log evidence.

---

## 1 — Cancellation paths (consolidated)

There are THREE distinct cancellation paths, each with slightly different side-effects:

| Path | Caller | Server action | Audit log type | Email type | Initiator label |
|---|---|---|---|---|---|
| A — Admin quick cancel | Bookings list row + booking detail next-action strip | `quickUpdateBooking` action=`cancel` | `booking_quick_cancel` | `sendBookingCancellationEmails` with `{initiatedBy:"admin"}` | `booking_cancellation_admin` (email_delivery_events) |
| B — Admin Status form | Booking detail Status & payment form | `updateBookingManagement` | `booking_management_updated` | Same as A | Same as A |
| C — Customer manage page | Customer link via `manage_token` | `manage/actions.ts:cancelBooking` (named) | **NO dedicated audit_log row** — only `customer_cancellation_note` + `customer_cancelled_at` columns on bookings | `sendBookingCancellationEmails` with `{initiatedBy:"customer", cancellationNote}` | `booking_cancellation_customer` (email_delivery_events) |

**Notable asymmetry (path C):** customer-side cancellation does NOT write a row to `audit_logs`. Forensic info lives on the booking row itself (`customer_cancellation_note` + `customer_cancelled_at` + `customer_cancellation_token`). The admin-side audit_logs view will show no entry for the cancellation event; admin would need to look at the booking row OR the email delivery events to know it happened. **B-119 from W03 said admin-vs-customer initiator info isn't in audit_log — confirmed at code level here.**

---

## 2 — Restore path

Per C-A.1 #04 B-16 + E-12: there is **no dedicated "Restore" server action**. The actual restore mechanism is:
1. Admin opens cancelled booking detail.
2. Opens "Status & payment" form.
3. Changes status from `cancelled` → `confirmed` (or `pending`).
4. Clicks Save.
5. `updateBookingManagement` runs, status updates, `booking_management_updated` audit row written.

**What email fires on restore:**
- Lines 213-218: `if (beforeState.status !== "cancelled" && data.status === "cancelled")` → cancellation email. **Does not trigger on a restore (cancelled→confirmed) because the precondition is "before was not cancelled".**
- Lines 219-227: `else if (beforeState.status !== data.status)` → `sendAssignedStaffBookingChangeEmails`. ✅ This branch fires on restore.

**Net result on restore:**
- Assigned staff get an email saying "Booking status changed from cancelled to confirmed."
- **Client gets NO email.** They received the original confirmation, then a cancellation email, then silence. They have no way to know the booking is back on.

---

## 3 — Bugs found

### B-120 — Restore (cancelled→confirmed) sends NO client-facing email
**Severity:** high (client-experience — silently restored bookings = no-shows or surprise visits)
**Source:** `actions.ts:213-227`. The cancellation-detection branch only catches transitions TO cancelled. Restores go through the staff-only `sendAssignedStaffBookingChangeEmails` branch. The CLIENT receives no notification that the cancelled booking is back on.
**Concrete failure mode:**
- Client books for Saturday 14:00 → confirmation email.
- Clinic cancels Friday morning → cancellation email "Sorry, your booking is cancelled."
- Clinic restores Friday afternoon → no email.
- Saturday 14:00 — client doesn't show because they understood it was cancelled. OR client shows up confused.
- Either way: bad UX + commercial loss.
**Decision:** add a `sendBookingRestoredClientEmail` (likely just `sendBookingCreatedEmails` re-fired with a "your booking has been reinstated" copy variant). Pair with C-04 — the same plan that adds an explicit Restore button should add the restore email.

### B-121 — "Restore it from the audit log if it was cancelled by mistake" copy is a UX LIE — confirmed at code level
**Severity:** medium (copy correctness — user follows the hint and gets a read-only panel)
**Source:** `bookings/[bookingId]/page.tsx:1163-1172` (per #04 E-12) — the cancelled-booking next-action strip hint reads "Restore it from the audit log if it was cancelled by mistake." The audit log is read-only (`page.tsx:356-386` per #04 V-12). The actual restore is the Status & payment form's status dropdown — which the hint never mentions.
**Implication:** new admin user clicks "Audit log" expecting a Restore button. None exists. They have to guess that the Status form does the restore. C-04 must fix this either by:
- (a) Rewriting the hint to direct user to the Status panel, OR
- (b) Adding an explicit Restore button with confirm dialog (and folding B-120's restore-email logic into it).
- **(b) is the better fix** because it also fixes the affordance discoverability for non-admin roles.

### B-122 — Restore can transition `completed` → `confirmed` with no business-rule guard
**Severity:** medium (data integrity — an already-completed-and-billed booking can be un-completed)
**Source:** `updateBookingManagement` accepts any value from `BOOKING_STATUSES`. There's no state-machine. So `completed → cancelled → confirmed → completed` is valid; `cancelled → confirmed → completed` is valid; `completed → pending` is valid. Audit log captures each transition, but no transition is BLOCKED.
**Implications:** combined with B-115 (no client email on pending→confirmed) and W03-E-3 (no idempotency on review email if C-01 is built), bookings can ricochet between states with no client-side communication, all while audit_logs accumulate noise.
**Decision:** state-machine validation in the server action — disallow `completed → pending/confirmed` without explicit force flag + audit reason. C-04 or C-12+ data-model cleanup.

### B-123 — Customer-side cancellation has no admin-side audit_log row — only the booking-row mutation
**Severity:** medium (forensic asymmetry)
**Source:** `manage/actions.ts:145-151` — updates `bookings.customer_cancellation_note` + `customer_cancelled_at` + `status`. No `audit_logs.insert(...)` call after the mutation. Compare with admin-side `actions.ts:204-211` which DOES write an audit_log row.
**Implication:** the `/admin/audit` log shows no entry for customer cancellations. To investigate why a booking was cancelled, admin must inspect the booking row's `customer_cancelled_at` column. Worse, if the same booking gets re-cancelled by admin later (or restored + re-cancelled), the audit log only shows the second event.
**Decision:** add a `customer_action_logs.insert` OR simply mirror the cancellation to `audit_logs` with actor_staff_id=null + a new action_type `booking_customer_cancelled`. C-12+ forensic.

### B-124 — Cancelled bookings still appear in `/admin/bookings` Claimable tab (C-05 cross-page leak)
**Severity:** medium-high (the C-05 user item — confirmed cross-page)
**Source:** `bookings/page.tsx:114-119` — `claimableRows` query filters by `.eq("status", "unassigned")` on the ASSIGNMENT row, **not the booking row**. So a cancelled booking that still has unassigned assignment slots appears in the claimable list. Combined with B-15 (4 UI/server gates for C-05), this is the cross-page surface where the bug is most visible to therapists.
**Decision:** C-05 plan must update the claimable query to filter `bookings.status NOT IN ('cancelled', 'no_show')` as well. Adds a 5th edit point to the C-05 list (now 4 + 1 query = 5 edits).

### B-125 — Restoring a booking does NOT clear `customer_cancellation_note` or `customer_cancelled_at` columns
**Severity:** low-medium (data hygiene — stale fields on a now-active booking)
**Source:** `updateBookingManagement` payload (actions.ts:177-193). No reset of customer-cancellation fields on a non-cancelled status. So after a restore:
- `booking.status = 'confirmed'`
- `booking.customer_cancelled_at = '<prior cancel timestamp>'` (orphaned)
- `booking.customer_cancellation_note = '<prior note>'` (orphaned)

A user reading the row later would think "this booking was cancelled by the customer" when actually it was restored.
**Decision:** when transitioning from `cancelled` → non-cancelled, NULL the customer_cancellation fields (or rename them to `last_customer_cancellation_*` to clarify they're historical). C-12+ data-model cleanup.

---

## 4 — Visual issues

### W04-V-1 — Cancelled bookings on `/admin/bookings` Cancelled tab show no visual cue that they've been restored if status flipped back
**Source:** the Cancelled tab filters by `status='cancelled'`. So a restored booking will simply disappear from this tab. Cross-page consistency ✅, but a "recently restored" indicator on the booking detail would help admins remember the round trip happened.
**Decision:** badge "Recently restored" on detail page for, say, 72h after a cancelled→active transition. C-12+ polish.

### W04-V-2 — No "Cancel + restore in one button" pattern; restore is a separate Save action on the Status form
**Source:** observed in code. The "Restore" affordance (when added per B-121) should be a single-click button with confirm. C-04 plan.

---

## 5 — Empty / edge states

### W04-E-1 — Customer cancellation is gated by `customer_cancellation_cutoff_hours` from business_settings
**Source:** `customer-manage.ts:178-180` — `if (now > cutoffTime) return { allowed: false, reason: "The cancellation cutoff has passed." }`. ✅ Sensible business rule. Setting lives in `/admin/settings`. Per #17 settings audit, this is editable.
**Implication for C-04 plan:** admin restore is unbounded (no cutoff). If a client cancels past cutoff via support call, admin can override by cancelling on their behalf. But the cutoff applies only to the customer-self-service path.

### W04-E-2 — Customer cancellation token is single-use? Need to verify
**Source:** `customer-manage.ts` uses `manage_token` for auth. The cancellation server action doesn't appear to invalidate it. So a customer could (theoretically) hit cancel multiple times. Server-side guard at `manage/actions.ts:128-131` checks `if (!booking.cancellation.allowed)` — which probably catches "already cancelled" case.
**Decision:** verify via code spelunking or live test. Out of W04 scope; flag for C-12+ if real.

### W04-E-3 — Customer cancellation note has a length limit (`Enter a shorter cancellation note`)
**Source:** `manage/actions.ts:115`. ✅ Server-side validation. Front-end customer manage page may or may not preview the limit; out of W04 scope.

### W04-E-4 — On Path B (admin Status form), if admin transitions cancelled → confirmed WITHOUT touching payment fields, the form preserves the prior payment state
**Source:** `updateBookingManagement` doesn't have payment-clearing logic on status change. So a booking that was cancelled with `amount_paid > 0` will retain that on restore. Makes sense (the money was paid; status flip doesn't refund it). ✅ Accept.

---

## 6 — Cross-role inconsistencies

### W04-CR-1 — Therapist cannot cancel via quick action (and cannot restore)
**Source:** `quickUpdateBooking` requires `canManageAllBookings(profile)` (line 369-371). Therapist false → "Insufficient permissions." Coord / Admin / Owner can all cancel + restore.
**Status:** intended. Therapist can mark their own ASSIGNMENT completed/no_show via `updateOwnAssignmentStatus`, but they can't move the booking itself to cancelled. ✅ Correct RBAC.

### W04-CR-2 — Coord-vs-Admin restore behaviour parity
**Source:** same predicate. Confirmed in #04 audit. ✅ Accept.

---

## 7 — Cross-viewport issues

### W04-CV-1 — Cancelled detail at 1280 (per #02 audit screenshot `owner-1280-cancelled-detail.png`) shows the misleading hint cleanly above the Status panel — copy fix per B-121 is layout-neutral
**Source:** referenced. ✅ Accept.

---

## 8 — Console / network issues

### W04-CN-1 — 0 errors / 0 warnings — no novel network behavior observed
Carried from W01/W02/W03 baselines.

---

## 9 — Pre-existing items the audit accepts

### W04-PE-1 — Calendar correctly excludes cancelled bookings from the grid
**Source:** #09 V-? (calendar audit). ✅ Accept — cross-page consistency hygiene is good for this surface.

### W04-PE-2 — Reports correctly filter `status !== "cancelled" && status !== "no_show"` for upcoming + revenue rollups
**Source:** `reporting.ts:813`. ✅ Accept.

### W04-PE-3 — Cancellation email side carries `cancellationNote` from customer path through to admin recipients
**Source:** `manage/actions.ts:169-173`. ✅ Good — admin can see WHY the customer cancelled.

### W04-PE-4 — Customer manage URL is token-gated (signed) per `ensureBookingManageUrl`
**Source:** `lib/booking/manage-token.ts` (not surveyed deeply). Tokens prevent random clients cancelling each other's bookings. ✅ Accept.

### W04-PE-5 — Cancelled-detail audit-log panel preserves the full history including cancellation event
**Source:** #04 V-12. Audit log is read-only but it DOES show the cancellation. So the misleading copy ("Restore from audit log") might come from a misreading of "the audit log shows you what happened" → "the audit log is where you fix it". Real UX issue per B-121.

---

## 10 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-120 — restore sends no client email | Add `sendBookingRestoredClientEmail` | **C-04 (HEADLINE)** + C-08 |
| 2 | B-121 — "restore from audit log" copy is a UX lie | Add explicit Restore button OR fix the hint copy | **C-04 (HEADLINE)** |
| 3 | B-122 — no state-machine on transitions | Disallow `completed → pending/confirmed` without force | C-04 or C-12+ |
| 4 | B-123 — customer cancellation has no admin-side audit_log | Mirror to audit_logs with actor=null | C-12+ forensic |
| 5 | B-124 — cancelled bookings appear in Claimable tab | Add `bookings.status NOT IN (...)` filter to claimable query | **C-05 (adds a 5th edit point)** |
| 6 | B-125 — restore doesn't clear customer_cancellation_* columns | NULL on transition out of cancelled | C-12+ data hygiene |
| 7 | W04-V-1 — no "recently restored" indicator | Badge for 72h | C-12+ polish |
| 8 | W04-V-2 — restore is hidden behind dropdown | Explicit button (folds into B-121) | C-04 |
| 9 | W04-E-2 — customer cancellation token reuse | Verify guard | C-12+ |

---

## 11 — Cross-references to existing findings

- **B-15 (C-A.1 #04)** — said C-05 = 4 edits (3 UI predicates + 1 server action). W04 B-124 adds the claimable tab QUERY as a 5th edit point. **C-05 = 5 edits.**
- **B-16 + E-12 (C-A.1 #04)** — the "restore from audit log" misleading copy. W04 B-121 confirms cross-page (the hint is on the detail; the audit log itself can't do anything; the actual fix is on the same detail's Status form).
- **B-83 (C-A.1 #19)** — C-08 missing event types. W04 adds `booking_restored_client` to the C-08 backlog (now ~6+ types).
- **B-115 + B-118 (W03)** — client-notification gap on pending→confirmed AND now restore. Same fix shape; same C-08 plan home.

**C-05 edit-point list, consolidated through W04:**
1. `actions.ts:269-275` `claimBookingAssignment()` — add `booking.status NOT IN ('cancelled','no_show')` guard
2. `bookings/[bookingId]/page.tsx:787-791` — claim button predicate
3. `bookings/[bookingId]/page.tsx:793-794` + `:799-801` — mark complete predicate
4. `bookings/[bookingId]/page.tsx:883-890` — reassign manager predicate
5. **NEW from W04: `bookings/page.tsx:114-119` — claimableRows query filter**

PLUS the unresolved master-plan vantage question (Owner CAN currently claim cancelled bookings; master plan says they "can't"). Surface for user clarification before C-B plan-writing.

---

## 12 — Hand-off

**State:** 0 screenshots (referenced #02's cancelled-detail PNG). 0 code changes. 0 prod DB writes. 6 new bugs (B-120 → B-125). The cancellation surface area is **well-built for the cancel path** (3 entry points all funnel through proper email broadcasts + audit logs) but has **3 HEADLINE gaps on the restore path**: no client email (B-120), misleading hint copy (B-121), no state-machine guard (B-122).

**Most consequential W04 findings to surface to C-B:**
1. **B-120 + B-121** — pair into C-04 (cancellation restore). Both should be fixed together: explicit Restore button + client email on restore.
2. **B-124** — adds a 5th edit point to C-05. The claimable tab cross-page leak.
3. **B-123** — customer cancellation forensic asymmetry. Defensive fix; not blocking.

**Next workflow:** W05 — assignment / claim / reassign. Tests the C-05 bug end-to-end across surfaces (bookings list claimable tab → click claim → booking detail post-claim state) + the C-08 missing assignment/claim/client-assigned emails.

**Bug index advance:** B-119 → B-125. Next available: B-126.

*End of W04 cancellation-and-restore-flow audit.*
