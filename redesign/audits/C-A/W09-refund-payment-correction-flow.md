# C-A.2 W09 — Refund + payment correction flow audit

**Workflow:** admin needs to refund a paid booking → opens `/admin/bookings/[id]` Status & payment form → manually edits `amount_paid` (often to 0) + adds a `payment_note` → saves. There is no first-class refund action; the workflow is distributed across fields.
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `408294d`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #04 (B-17 "no refund affordance"), #05 (clients list `hasRefund` filter), #25 (reports payment-status options), master plan Part 3 ("No refund workflow as atomic action").
**Source surveyed:**
- Payment handling: `bookings/actions.ts:118-237` (`updateBookingManagement`), `:367-447` (`quickUpdateBooking` includes mark_paid).
- Payment vocabulary: `bookings/actions.ts:45` (PAYMENT_STATUSES = ["paid","unpaid"]).
- Cross-page payment references: `clients/page.tsx:155` (`hasRefund`), `reports/reports-helpers.ts:32` ("Refunded" filter option), `reports/__tests__/reports-helpers.test.ts:47` (test says "4 real payment statuses").
- LTV calc: `clients/client-metrics.ts:73` (`amount_paid ?? total_price`).
- DB schema: bookings.payment_status currently has no CHECK constraint visible.
- DB state: 9 unpaid + 2 paid; 0 refunded; 0 waived (production).
**Roles swept:** Owner.

---

## 1 — Current refund "workflow" (such as it is)

1. Admin opens `/admin/bookings/[id]`.
2. Status & payment form is displayed.
3. Admin EITHER:
   - (a) edits `amount_paid` to a smaller positive value (partial refund), keeping `payment_status="paid"`, OR
   - (b) edits `amount_paid` to 0, switches `payment_status` to "unpaid" (full refund/reversal).
4. Optionally adds `payment_note` explaining the refund.
5. Clicks Save → `updateBookingManagement` runs.
6. Audit log row: `booking_management_updated` with before+after — no special action_type.
7. **The refund is now indistinguishable from any other payment edit in the audit log.** To find it, you must compare `before_state.amount_paid` vs `after_state.amount_paid` and detect the decrease.

---

## 2 — Bugs found

### B-143 — Payment-status vocabulary drift: code/tests reference 4 values, server enforces 2
**Severity:** medium (multi-surface inconsistency; legacy/intent gap)
**Source:**
- `bookings/actions.ts:45` — `PAYMENT_STATUSES: PaymentStatus[] = ["paid", "unpaid"]`.
- `reports/reports-helpers.ts:32` — has `{ value: "refunded", label: "Refunded" }` in its dropdown.
- `reports/__tests__/reports-helpers.test.ts:47` — test description: "covers the 4 real payment statuses (paid, unpaid, refunded, waived)".
- `clients/page.tsx:155` — `hasRefund = bookings.some(b => b.payment_status === "refunded")`.
- DB: production has 0 rows with `payment_status='refunded'` or `'waived'`.
**Implication:** the system has BUILT filter UI for refunded + waived but provides NO mechanism to SET those values. The filters are dead. Admins clicking "Refunded" in Reports payment-status filter will always see "0 results" because the value can't be reached.
**Decision options:**
- (a) Extend `PAYMENT_STATUSES` to include `refunded` + `waived` + add a refund action that sets it. **Recommended.**
- (b) Remove the dead filter values from UI + tests + helpers.
**Best home:** **C-04 / C-12+ payment workflow** (cleanest if paired with adding atomic refund action). The 4-value intent is the right model.

### B-144 — `paid_at` timestamp can persist with `amount_paid=0` after a refund
**Severity:** low-medium (forensic confusion — booking shows "Paid at 14:32" with amount_paid=0)
**Source:** `bookings/actions.ts:183-188`:
```
paid_at:
  paymentStatus === "paid" && beforeState.payment_status !== "paid"
    ? new Date().toISOString()
    : paymentStatus === "paid"
      ? beforeState.paid_at
      : null,
```
**Behavior:** if admin keeps `payment_status="paid"` but reduces `amount_paid` to 0 (partial-then-full refund, or weird state), `paid_at` stays. Only flips to `null` when `payment_status` itself flips to `unpaid`.
**Decision:** when reducing amount_paid to 0, prompt admin to also switch payment_status. OR: derive `paid_at` from amount_paid > 0 (single source of truth). C-12+ data hygiene.

### B-145 — No first-class refund action_type in audit_logs
**Severity:** medium (forensic — hard to find refunds in history)
**Source:** all payment edits via `updateBookingManagement` write `action_type: "booking_management_updated"` (actions.ts:206). No distinct `booking_refunded` action_type. To find refunds:
```sql
SELECT * FROM audit_logs
WHERE action_type = 'booking_management_updated'
  AND (after_state->>'amount_paid')::numeric < (before_state->>'amount_paid')::numeric;
```
**Decision:** add `booking_refund_recorded` action_type when amount_paid decreases. Or add separate server action `recordRefund(bookingId, refundAmount, reason)`. Pair with B-143 → C-04 / C-12+ refund workflow.

### B-146 — No refund affordance with confirmation UX (carried from #04 B-17 + master plan Part 3)
**Severity:** medium (workflow + financial accuracy)
**Source:** #04 B-17. There's no "Refund" button. Admin must mentally translate "I need to refund this client £80" into "edit amount_paid from 80 → 0 and add a note". Easy to typo (£8 instead of £0). No confirm dialog. No specific refund-method tracking (was it cash returned at the door? Bank transfer? Voucher?).
**Decision:** **first-class refund modal** with: refund amount input (defaults to amount_paid), refund method (cash / card / bank_transfer / voucher), refund reason (free text), audit-log linkage. Updates `bookings.amount_paid`, sets `payment_status='refunded'` (post-B-143), writes `booking_refund_recorded` audit row, fires optional refund-confirmation email to client. **A real feature, not a one-line fix.**

### B-147 — Client LTV calculation falls back to `total_price` when `amount_paid IS NULL`
**Severity:** low-medium (reporting accuracy for legacy/imported data)
**Source:** `clients/client-metrics.ts:73` — `ltv += toNumber(booking.amount_paid ?? booking.total_price)`.
**Behavior:** nullish-coalescing → if amount_paid is `null`, use total_price as fallback. If amount_paid is `0`, the 0 is kept (correct).
**Implication:** new bookings (RPC `create_booking_request` sets amount_paid=0 always per W02 §2 SQL function) don't have null. But legacy/migrated bookings might. They'd inflate LTV by including their `total_price` even if unpaid.
**Decision:** verify if any production bookings have NULL amount_paid (query). If yes, decide whether to default-treat-as-unpaid (use 0) or default-treat-as-paid (current behavior). C-12+ data audit + correctness check.

### B-148 — Reports `completedRevenue` falls back to `total_price` when `amount_paid` is 0 or null (line 438)
**Severity:** medium (revenue reporting overstates collected revenue)
**Source:** `reports/reporting.ts:438` — `completedRevenue += amount(booking.amount_paid || booking.total_price)`. Uses logical-OR (`||`), not nullish-coalescing — so `amount_paid=0` ALSO falls back to total_price.
**Implication:** a completed booking that was refunded (amount_paid=0) still counts in completedRevenue as if it was fully paid (uses total_price). **The reports overstate revenue for refunded-but-completed bookings.** This is a real reporting bug.
**Decision:** decide which value reports SHOULD show:
- `amount_paid` only (true cash collected) — change to `?? 0`.
- `amount_paid` with `total_price` fallback only when `amount_paid IS NULL` — change to `??`.
- Both with separate "billed" vs "collected" lines.

The TODO at `reporting.ts:417` (`// TODO(post-Phase-7 policy decision): bookedRevenue...`) is exactly this. **Surfaced + reframed by W09. C-12+ analytics correctness OR fold into C-04 refund plan.**

---

## 3 — Visual issues

### W09-V-1 — Status & payment form has no visual cue when amount_paid decreases from a prior positive value (i.e., "this looks like a refund")
**Source:** observed. Just a numeric input. No "Looks like you're refunding £80 — record refund method?" prompt.
**Decision:** addressed by B-146 first-class refund modal. C-04.

### W09-V-2 — No refund history panel on `/admin/bookings/[id]` (similar to assignment / audit log panels)
**Source:** observed. Refunds are mixed into general payment edits in the audit log.
**Decision:** addressed by B-145 distinct action_type → could surface a "Refund history" panel.

---

## 4 — Empty / edge states

### W09-E-1 — Partial refund (admin reduces amount_paid from £80 → £40) leaves payment_status="paid" — semantically correct but no "partial refund" indicator
**Source:** form allows this. No status-level signal that a partial refund happened.
**Decision:** add `bookings.refund_amount NUMERIC` column? Or a `refund_history JSONB[]` column? Or compute from audit_logs delta? C-04 design decision.

### W09-E-2 — No refund cap (admin could enter `amount_paid=200` on a £80 booking)
**Source:** `actions.ts:162-163` validates `amount_paid >= 0` but no upper bound.
**Implication:** if amount_paid > total_price, the booking is in "overpaid" state. Reports `reporting.ts:1312` comment acknowledges: "returns true ratio (e.g. > 1 from refunded-then-overpaid edge cases)". So the codebase IS aware of overpaid edge cases.
**Decision:** add upper-bound check (amount_paid <= total_price + some tolerance for tips?) OR leave as-is and accept the comment's edge-case acknowledgement. C-12+.

### W09-E-3 — `paid_at` of cancelled booking — what happens?
**Source:** if admin cancels a paid booking, `payment_status` stays as it was (cancellation doesn't touch payment_status per actions.ts:177-193). Then `paid_at` stays. Then admin could refund-and-cancel separately. State: status=cancelled + payment_status=paid + paid_at set + amount_paid > 0 + ... — yeah, refund-after-cancel is messy.
**Decision:** part of the broader B-122 state-machine cleanup + B-146 refund workflow design.

---

## 5 — Cross-role inconsistencies

### W09-CR-1 — Only canManageAllBookings roles can edit payment (Owner / Admin / Coord)
**Source:** `requireBookingManager` predicate. Therapist cannot touch payment. ✅ Correct RBAC.

### W09-CR-2 — Therapist sees `amount_paid` read-only via assigned-staff view (per #04 CR-12 narrowed view)
**Source:** assumed from RBAC narrowing. Out of W09 scope to deeply verify.

---

## 6 — Cross-viewport issues

No new mobile-level findings beyond #04 baselines.

---

## 7 — Console / network issues

### W09-CN-1 — 0 errors / 0 warnings
Read-only walk.

---

## 8 — Pre-existing items the audit accepts

### W09-PE-1 — `paid_at` is preserved across edits when payment_status remains "paid"
**Source:** actions.ts:185-187. Idempotent guard pattern. ✅ Correct intent.

### W09-PE-2 — Validation: amount_paid must be a valid non-negative number
**Source:** actions.ts:162-163. ✅ Basic. Could be tighter (B-146 / W09-E-2).

### W09-PE-3 — Reports include payment_status as a filter dimension
**Source:** reports-helpers.ts:32. Pattern correct; vocab is the bug (B-143).

---

## 9 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-143 — payment status vocab drift (refunded/waived dead) | Extend allowed set + atomic refund action | **C-04** (or new C-12+ refund) |
| 2 | B-144 — paid_at persists with amount_paid=0 | Derive from amount_paid | C-12+ data hygiene |
| 3 | B-145 — no refund action_type in audit log | Distinct `booking_refund_recorded` | **C-04** |
| 4 | B-146 — no refund modal | First-class refund UX | **C-04 (HEADLINE — pair with restore)** |
| 5 | B-147 — LTV falls back to total_price on null amount_paid | Audit production data + decide policy | C-12+ |
| 6 | B-148 — completedRevenue overstates when refunded | Reports correctness fix | C-12+ analytics OR fold into B-146 |
| 7 | W09-E-2 — no upper-bound on amount_paid | Add validation OR document overpaid edge case | C-12+ |
| 8 | W09-E-3 — refund-after-cancel state messiness | Part of B-122 state-machine + B-146 | C-04 |

---

## 10 — Cross-references to existing findings

- **#04 B-17** — "no refund affordance". W09 confirms cross-page + adds vocab drift (B-143), audit log gap (B-145), reports correctness bug (B-148).
- **Master plan Part 3** — "No refund workflow as atomic action". W09 expands the gap inventory.
- **W04 B-122** — no state-machine. Pair: refund-after-cancel + reverting completed bookings = same root cause.
- **`reports/reporting.ts:417`** — TODO `bookedRevenue...` decision. W09 surfaces this as a B-148 / C-04 priority.

**Refund workflow scoping for C-04 (consolidates these into the C-04 plan):**
- New server action: `recordBookingRefund(bookingId, refundAmount, refundMethod, refundReason)`.
- Updates: `bookings.amount_paid -= refundAmount`, `payment_status = 'refunded'` (full) or stays `paid` (partial), `paid_at` cleared on full, optional `refund_amount += refundAmount`, optional `refund_history.append({...})`.
- Audit log row: `booking_refund_recorded` with `refundAmount` + `refundMethod` + `refundReason` in `after_state`.
- Reports: filter to `payment_status='refunded'` works; `completedRevenue` excludes refunded amounts (the B-148 fix).
- LTV: subtracts refunded amounts (post-fix to `client-metrics.ts:73`).
- Email: optional `sendRefundIssuedEmail` to client.

---

## 11 — Hand-off

**State:** 0 screenshots. 0 code changes. 0 prod DB writes. 6 new bugs (B-143 → B-148).

**Most consequential W09 findings to surface to C-B:**
1. **B-146 + B-145 + B-143 — atomic refund workflow is THE missing piece**. Pair with C-04 (cancellation restore) into a "lifecycle-correction" plan.
2. **B-148 — completedRevenue overstates collected revenue when refunded**. Real reporting bug. The `reports/reporting.ts:417` TODO is the same issue surfaced.
3. **B-147 — LTV null-fallback**. Smaller; data audit needed first.

**Next workflow:** W10 (final) — settings edit + downstream impact. Tests `/admin/settings` changes (booking window, allowed cities, cancellation cutoff, etc.) → downstream impact on `/admin/bookings/new`, `/admin/calendar`, customer manage page.

**Bug index advance:** B-142 → B-148. Next available: B-149.

*End of W09 refund-payment-correction-flow audit.*
