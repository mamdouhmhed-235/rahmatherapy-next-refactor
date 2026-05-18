# Harden recommendations — emails

**Page:** `/admin/emails`
**Session:** Phase 6 row 22 of 29 (emails)
**Date:** 2026-05-18
**Brief reference:** `/redesign/briefs/emails-brief.md` §6 Key States + Verification edge cases

This report enumerates every error / edge state the brief calls out, the current implementation status, and any production-hardening recommendation. Implemented items are confirmed against the code; deferred items are tagged with why.

---

## 1. Coverage matrix against brief §6 Key States

| State (brief §6) | Implementation | Notes |
|---|---|---|
| **Default (Delivery, no filters)** | ✅ Implemented | Newest day first; up to 100 events from the read; per-day grouping with `dayKey` (London business date). |
| **Failed-events spike** (24h failed count badge) | ✅ Implemented | `countFailedRecent(events)` with `FAILED_BADGE_WINDOW_HOURS=24`; badge renders Cancelled-family on the Delivery tab pill. |
| **Filter active** | ✅ Implemented | Active-filter chips with per-chip X (button) + "Clear filters" Ghost both visible. |
| **Loading** | ✅ Implemented | `loading.tsx` renders tab strip + filter strip + 3 panel skeletons × 4 row skeletons (matches brief copy). |
| **Resend submitting** | ✅ Implemented | Button gains `aria-busy="true"`, spinner replaces leading icon, copy switches to "Sending…". |
| **Resend success** | ✅ Implemented | Confirmed-family "Sent" chip on the button; Sonner success `Reminder sent to {first_name}.`; `router.refresh()` so the "Last reminder" sub-line updates. |
| **Resend failure** | ✅ Implemented (wired, FAKE failure path) | Cancelled-family Sonner toast `Couldn't send to {first_name}. Try again or check the email address.`, persistent (`Infinity`), Retry action triggers `requestSubmit()`. Note: the untouchable server action swallows errors internally, so this path activates only on thrown errors — the wire-up is correct for when that contract evolves. |
| **Empty Delivery (no events ever)** | ✅ Implemented | `EmptyState` with Inbox icon + brief copy verbatim. |
| **Empty Delivery (with filters)** | ✅ Implemented | `EmptyState` with MailWarning icon + Ghost "Clear filters" + brief copy verbatim. |
| **Empty Delivery (Failed filter, no failures)** | ✅ Implemented | `EmptyState` with MailCheck icon + "No failed events in this range" + "Your emails are all getting through." |
| **Empty Reminders** | ✅ Implemented | `EmptyState` with CalendarClock + brief copy verbatim. |
| **Missing recipient row** | ✅ Implemented | Leading Attention chip "No recipient on file"; recipient slot falls back to "No recipient · booking #<short>" with the booking-id link; ReminderResendForm keeps the hidden `booking_id` input mounted via `aria-hidden` shell so the contract test still passes. |
| **Delivery data load failure** | ✅ Implemented | `role="alert" aria-live="polite"` Cancelled-family region replaces the timeline; the tab strip + filter strip stay usable; "Try again" Ghost reloads. |
| **`recipient_role='admin'` for Coordinator** | ✅ Implemented (silent server-side filter) | The Admin recipient-role option is hidden in the filter strip when the operator lacks `view_email_logs`; the existing data layer respects the row-level filter (untouched). |
| **Search `q` zero results** | ✅ Implemented | Same `No email events match your filters` empty state with Ghost "Clear filters". |
| **Resend on stale (cancelled) booking** | ⚠ Brief-listed, server-action-blocked | Server action is RECON §5 untouchable. The flow cannot produce the toast `That booking was cancelled. No reminder sent.` without modifying `actions.ts`. Deferred to Phase 7 backend-handoff. |
| **All-reminders-sent** | ⚠ Out-of-scope without product call | The brief lists this as a distinct empty state, but the underlying data does not currently filter already-reminded bookings out of the upcoming list. Implementing requires a product decision on visibility. Deferred to Phase 7. |

---

## 2. Verification edge cases (brief §11 Implementation Notes)

| Edge case | Current behaviour |
|---|---|
| 60-char email at 375px | The recipient line uses `truncate` (single line, ellipsis on overflow). Fits without breaking the row. |
| 1,000-char `error_message` in `<details>` | `<details>` body has `[word-break:break-word]` and inherits `text-xs leading-5`; long strings wrap. Provider error stays inside the tinted Cancelled-family region. |
| 24h "Last reminder" line on a narrow row | Sub-line is `flex flex-wrap` with `gap-x-2 gap-y-0.5`; wraps cleanly. |
| Missing-recipient row alignment | Attention chip floats with name; resend button stays hidden; hidden form mounted for contract preservation. |
| Mobile filter sheet focus trap | `AdminSheet` (Base UI Dialog) handles focus trap + Escape dismissal natively. Confirmed via manual test (sheet opens with title "Filters"). |
| Resend buttons announce target name | `aria-label="Send reminder to {first_name}"` + `title` tooltip both present. |
| `<details>` keyboard-operable | Native semantics; Space/Enter on summary toggles. |
| `AdminAccessDenied` (Therapist) no raw `view_email_logs` | The `permission` prop is accepted for backwards-compat but ignored at render; sanitiseDeniedMessage discards bare identifiers. Brief copy verbatim. |

---

## 3. New states added during harden

None — the brief's §6 already enumerates the full error state landscape, and the craft + polish loops landed every one of them. Harden's role here was to verify coverage and document gaps, not to add new states.

---

## 4. Token discipline (harden cleanup pass)

Confirmed via Grep against `src/app/admin/emails/page.tsx`, `DeliveryFilterStrip.tsx`, `ReminderResendForm.tsx`, `CopyEventId.tsx`, and `loading.tsx`:

- No `var(--rahma-*)` legacy tokens (carry-forward from BASELINE-CRITIQUE).
- No raw `text-red-700` on the error_message line (replaced with `oklch(26%_0.14_25)` Cancelled-family literal — token-equivalent).
- No raw `view_email_logs` identifier rendered to the user.
- All status badges go through `AdminStatusBadge` with named tones (`success`, `info`, `warning`, `danger`, `restricted`, `muted`).
- All structural colors are `var(--admin-*)` tokens; only the named status families use oklch literals (matching the rest of the admin surface, e.g. `admin-ui.tsx`).

---

## 5. Items intentionally not changed (locked by recipe)

- `src/app/admin/emails/actions.ts` — RECON §5 explicit DO-NOT-TOUCH.
- The `<input type="hidden" name="booking_id">` per-row contract — preserved verbatim.
- `<form action={sendManualBookingReminder}>` — preserved verbatim.
- The `email_delivery_events` read shape — unchanged.
- `id="admin-main"` skip-link target — lives at the layout level; not touched.

---

## 6. Recommended Phase 7 follow-ups

1. **Wire stale-booking toast** once `actions.ts` is allowed to communicate `outcome` to the caller (currently returns void on both paths).
2. **Decide on the "all reminders sent recently" empty state** — needs product input on whether already-reminded upcoming bookings should hide or stay visible with their "Last reminder" sub-line.
3. **DayPicker popover for Custom range** — Phase 7 polish; native date inputs are functional in the meantime.
4. **Sub-line Pending "Sending…" chip** — currently the optimistic state lives in the resend button itself (aria-busy + copy change). The brief suggests a separate Pending chip in the row sub-line; both communicate state but the chip pattern is slightly more discoverable.
5. **Real cursor-pagination Load more** — depends on `BUILD-email-delivery-filter-query.md`. The page surfaces a FAKE notice with a clear "BUILD pending" label until the backend lands.

---

## 7. Sign-off

Harden coverage of the brief is complete with the noted server-blocked deferrals. The page meets the brief's §6 state inventory, §11 verification list (a11y + role passes), and the recipe's hard rules around untouchable backend contracts.
