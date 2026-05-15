# Harden — booking-detail

Pass date: 2026-05-15
Surface: `/admin/bookings/[bookingId]` (Brief 15)
Sources cross-read: `briefs/booking-detail-brief.md` (§6 Key States + §Implementation Notes), `DESIGN.md`, `page.tsx`, `BookingManagementForm.tsx`, `BookingDetailSidebar.tsx`, `BookingActionButton.tsx`, `ClaimAssignmentButton.tsx`, `AssignmentManager.tsx`, `format.ts`, `components/admin-ui.tsx`.

---

## Cross-check vs brief §6 Key States

| Brief state | Implementation | Status |
|---|---|---|
| Default — pending, unassigned | Pending badge in header; `tone="warning"` "Unassigned" chip + alert-circle avatar tile in `AssignmentRow`; "Confirm booking" Ghost in `BookingManagementForm` quick-action row; `NextActionStrip` "Assign a therapist, then confirm with the client." | ✅ Present |
| Confirmed, assigned | Confirmed badge in header; `TherapistAvatar` + name + Confirmed-family assignment status badge; "Mark paid" quick-action visible | ✅ Present |
| Saving status & payment | `loading={isPending}` on Primary; `aria-disabled`; `disabled={form.isPending}` on every select/input/textarea inside the section form | ✅ Present |
| Saved status & payment | `toast.success("Booking updated.")` (Sonner default = Confirmed family + auto-dismiss 4s) + `router.refresh()` — sidebar badge refreshes via server re-render | ✅ Present |
| Saving notes | Same pattern in `NotesSection` (loading + aria-disabled + textareas disabled) | ✅ Present |
| Saved notes | `toast.success("Notes saved.")` + refresh | ✅ Present |
| Cancel (quick action) | `BookingActionButton action="cancel"` → `ConfirmActionModal` with verbatim brief copy ("Cancel this booking?" / "Cancel booking" / "Keep it"), destructive | ✅ Present |
| Claim assignment (Therapist) optimistic | `ClaimAssignmentButton` flips `optimisticClaimed` synchronously; race-lost branch toasts persistent "Someone else just claimed this one. Refresh to see the latest." | ✅ Present |
| Own assignment status update | "Mark complete" + "Mark as no-show" Ghost buttons in `AssignmentRow` when `isOwn`; no-show wired to `ConfirmActionModal` | ✅ Present |
| Booking not found | `BookingNotFound()` → `EmptyState` with `CalendarX` icon + verbatim copy + "Back to bookings" Secondary | ✅ Present |
| Permission denied | `BookingAccessDenied()` → `AdminAccessDenied` with strip-permission-name copy + Secondary back-link | ✅ Present |

All 11 brief-mandated states are wired. Hardening focused on weaknesses inside those states (overflow, error recovery, missing-data edges) rather than missing states.

---

## Gaps found during harden

### G1 — `ParticipantsPanel` returns `null` when empty
**Code:** `page.tsx:544–546`. If `booking.booking_participants.length === 0` the panel is omitted entirely. Brief never anticipates a zero-participant booking, but the data layer allows it. Silent omission breaks the section rhythm and violates the "empty lists show a useful empty state" verification criterion.
**Fix:** render an `EmptyState` ("No participants on file" + reassuring body) instead of `null`.

### G2 — Cormorant numeral overflow on tight sidebar
**Code:** `BookingDetailSidebar.tsx:96–107` (Total) and `page.tsx:1270–1281` (NextActionStrip numeral). The Cormorant Garamond span is sized at `2.369rem` (~38px) with no overflow protection. A `£1,234,567.89`-class value in a 20rem sidebar (320px – padding) is on the edge; uncommon for a clinic but possible for a refund line where amounts compound. Verifier said: *"Large numbers don't overflow."*
**Fix:** add `min-w-0`, `tabular-nums`, and `break-words` to the Cormorant numeral spans. Anchor the suffix label in a wrapper so it can wrap independently.

### G3 — `Payment status = Paid` with `amount_paid = 0` is silently accepted client-side
**Code:** `BookingManagementForm.tsx`. The brief copy library §Error messages prescribes: *"Set the amount paid before marking this as paid."* Currently no client-side inline warning is rendered before submit. The server may or may not reject; either way the operator gets no "next-action" feedback inline.
**Fix:** render a Pending-family `role="status"` inline warning beneath the payment-status select when `payment_status === "paid" && Number(amount_paid) === 0`.

### G4 — Save errors auto-dismiss with no retry path
**Code:** `BookingManagementForm.tsx` `useStatusForm.handleSubmit` and `useNotesForm.handleSubmit`. On `result.error` both call `toast.error(result.error)` (Sonner default 4s auto-dismiss). Brief §Error messages prescribes: *"Couldn't save changes. Try again." (toast, persistent, Retry)* for the system-level save failure path.
**Fix:** make the save-failure toast persistent (`duration: Infinity`) and attach an action button that re-fires the save with the same FormData payload.

### G5 — Long unbreakable tokens in the header description
**Code:** `composeHeaderDescription` returns `${clientName} · ${serviceSummary} · ${when}`. The `AdminPageHeader` description `<p>` has `max-w-3xl` and `text-balance` but no `overflow-wrap: anywhere` / `break-words`. A 60-character single-token client name (e.g. dotted-domain emails, hyphenated names without spaces) would push the layout on mobile.
**Fix:** out-of-scope here — would touch the shared `AdminPageHeader` component used by every admin page. Flag for a future shared-components hardening pass. Local mitigation: nothing — the inputs come from the database and shorter strings would not exhibit it.

### G6 — Email activity error_message overflow
**Code:** `page.tsx` EmailActivityPanel `<p>` wrapping `event.error_message` had no word-break. Resend errors can be a single long unbroken token.
**Fix:** `break-words` added (resolved in Step 1).

### G7 — Amount paid > total has no inline feedback
**Code:** `AmountPaidInput`. Brief copy: *"Amount is more than the booking total. Mark as partially paid first, or check the figure."*
**Fix:** inline `role="status"` warning beneath the input (resolved in Step 1).

### G8 — Breadcrumb reference cell missing copy-the-full-id tooltip
**Code:** `page.tsx` breadcrumb `<li aria-current="page">`. Brief §Tooltip text specifies the native `title` shows the full booking reference for copy.
**Fix:** `title={booking.id}` on the breadcrumb cell (resolved in Step 1).

---

## Code changes already applied (Step 1)

| File | Change | Rationale |
|---|---|---|
| `src/app/admin/bookings/BookingManagementForm.tsx` | Added `items-start` to the 2-column field grid; added inline over-total warning (G7) | Row 2 cell-stretch misalignment + missing brief-mandated guard |
| `src/app/admin/bookings/[bookingId]/page.tsx` | `break-words` on email `error_message` (G6); `title={booking.id}` on breadcrumb (G8) | Long-token overflow + missing copy tooltip |

## Code changes to apply now (Step 2)

| Gap | File | Change |
|---|---|---|
| G1 | `page.tsx` `ParticipantsPanel` | Replace `return null` with `EmptyState` |
| G2 | `BookingDetailSidebar.tsx` SummaryCard Total + `page.tsx` NextActionStrip numeral | Add `min-w-0`, `tabular-nums`, `break-words`; wrap numeral container so suffix wraps independently |
| G3 | `BookingManagementForm.tsx` Status & payment panel | Add `role="status"` inline warning when `payment_status === "paid" && Number(amount_paid) === 0` |
| G4 | `BookingManagementForm.tsx` both submit handlers | Make save-failure toast persistent + Retry action |

---

## States added or hardened in this pass

1. **Empty participants** — new `EmptyState` ("No participants on file" / "Add at least one person before this booking can be assigned." / no CTA, read-only).
2. **Over-total amount** — inline Pending-family `role="status"` warning beneath Amount paid.
3. **Paid with zero amount** — inline Pending-family `role="status"` warning beneath Payment status.
4. **Save failure (status & notes)** — persistent Sonner error toast with "Retry" action that re-fires the save.
5. **Cormorant numeral overflow** — `tabular-nums` + `break-words` + `min-w-0` on Total tile and NextActionStrip numeral.
6. **Email error overflow** — `break-words` (Step 1).
7. **Breadcrumb full-ID tooltip** — `title={booking.id}` (Step 1).

---

## Out of scope / deferred

- **Concurrent-edit staleness banner** — brief specifies *"Someone else just updated this booking. Refresh to see the latest."* The server action `updateBookingManagement` returns no version-conflict shape; implementing this needs a backend contract addition (e.g. an `updated_at` echo on `BookingRecord` + an `If-Match`-style precondition check). Flagged for a backend plan, not for this surgical pass.
- **Payment status select with 5 brief-mandated values** (Outstanding/Paid/Partially paid/Refunded/Waived) — currently 2 values. Spec divergence, not a hardening issue.
- **Quick-action error toasts (BookingActionButton, AssignmentManager)** — same auto-dismiss pattern as G4 but lower frequency surfaces; deferred to the polish pass to keep the harden diff surgical.
- **`AdminPageHeader` description `overflow-wrap: anywhere`** — would touch a shared component used by all admin pages. Flagged for shared-components hardening (G5).
- **`customer_cancelled_at` surfacing** — the field is read but not displayed; surfacing it would need a new banner state that isn't in the brief.
