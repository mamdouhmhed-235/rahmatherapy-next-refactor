# Deferrals — emails

These are decisions surfaced during the emails Phase 6 session that are not Phase 6 blockers but should be picked up by Phase 7 (`/impeccable audit admin`) or Phase 8 (`/impeccable extract admin`).

---

## PAGE_SIZE = 100 instead of brief's 50-at-a-time Load more
- **Source:** Step 12a audit P1; brief §4 Scope (Pagination)
- **Verbatim:** "Pagination: Delivery moves from hard `limit(100)` to a Load more 50-at-a-time"
- **Defer to:** Phase 7 (tied to `BUILD-email-delivery-filter-query.md`)
- **Why deferred:** Cursor pagination requires the BUILD plan's server-side filter query. Until the BUILD lands, the current behaviour reads the last 100 events and renders a `data-redesign-backend="FAKE"` notice that names the BUILD-pending state. Shipping a stub 50-at-a-time fetch would re-imply forward progress that doesn't exist.
- **Provisional Phase 6 answer used to continue this session:** Keep `PAGE_SIZE=100`; replace the brief's "Load more" with an explicit "BUILD pending" sentinel block carrying a `data-redesign-backend="FAKE"` marker.

## EmptyState illustrations not yet swapped in
- **Source:** Step 12a audit P1; brief Recipe Context "IMAGES-NEEDED additions"
- **Verbatim:** "`emails-empty.svg` (envelope-with-check, ~80–120px) for Delivery empty state; `reminders-empty.svg` (calendar-with-zzz, ~80–120px) for Reminders empty state. Append rows in Phase 6."
- **Defer to:** Phase 7 (illustration commissioning)
- **Why deferred:** The IMAGES-NEEDED.md rows were appended this session (Step 5), but the actual SVG assets do not exist yet in `public/images/admin/empty-states/`. The current EmptyState renders Lucide icons (`Inbox`, `MailWarning`, `MailCheck`, `CalendarClock`) in a tinted circular tile as the placeholder.
- **Provisional Phase 6 answer used to continue this session:** Keep Lucide glyphs; surface the asset request via IMAGES-NEEDED.md so Phase 7 illustration work has a queue.

## Stale-booking Sonner toast for cancelled bookings
- **Source:** Brief §6 Key States; §11 Implementation Notes
- **Verbatim:** "Resend on stale (cancelled) booking: Cancelled toast `That booking was cancelled. No reminder sent.`"
- **Defer to:** Phase 7 backend handoff
- **Why deferred:** `src/app/admin/emails/actions.ts` is RECON §5 explicit DO-NOT-TOUCH and currently returns void on both success and failure paths. The client cannot distinguish "sent" from "blocked by stale-booking guard" without altering the action's return contract.
- **Provisional Phase 6 answer used to continue this session:** Wire the failure-path Sonner toast with the generic copy `Couldn't send to {first_name}. Try again or check the email address.` Document the stale-booking branch in HARDEN-RECS-emails.md as Phase 7.

## All-reminders-sent empty state
- **Source:** Brief Copy block ("Reminders, all sent recently")
- **Verbatim:** Heading `All reminders sent`, body `Every upcoming booking already had one go out.`
- **Defer to:** Phase 7
- **Why deferred:** Implementing this state requires filtering already-reminded bookings out of the upcoming-bookings query, which is a product decision (do already-reminded bookings disappear from the list, or stay visible with a "Last reminder" sub-line?). The brief does not resolve this trade-off.
- **Provisional Phase 6 answer used to continue this session:** All upcoming bookings stay visible; each row shows a "Last reminder: …" sub-line if it has one. The "All reminders sent" empty state is unreachable in current data.

## DayPicker popover for Custom range
- **Source:** Brief §7 Interaction Model
- **Verbatim:** "Custom opens a DayPicker popover."
- **Defer to:** Phase 7 polish
- **Why deferred:** Functional `<input type="date">` covers the operator need on every modern browser; the DayPicker upgrade is brand polish rather than functional gap.
- **Provisional Phase 6 answer used to continue this session:** Native `<input type="date">` for From / To when Range = Custom.

## Sub-line "Sending…" Pending chip during resend
- **Source:** Brief §6 Key States ("Resend submitting")
- **Verbatim:** "row sub-line gains a Pending-family 'Sending…' chip until the server action returns"
- **Defer to:** Phase 7 polish
- **Why deferred:** The button itself already communicates the in-flight state (`aria-busy="true"`, spinner replaces icon, copy switches to "Sending…"). Adding a chip in the row sub-line would require lifting the form's optimistic state into the parent `ReminderRow`. Functional behaviour is correct; the additional chip is layout polish.
- **Provisional Phase 6 answer used to continue this session:** Button-level state communication (aria-busy + spinner + "Sending…" → "Sent" → toast).

## Audit P1 / P2 cleanups
- **Source:** Step 12a audit
- **Verbatim:** See `redesign/PER-PAGE-SCORES.md` § `emails — audit`
- **Defer to:** Phase 7 `/impeccable audit admin`
- **Why deferred:** Eight P2 findings (token drift around `text-white`, inline shadows on rest, inline oklch literals for cancelled/attention contexts, undocumented `range` URL param, etc.) are polish-level and do not affect user flow. Two P1 findings are documented under their own deferral entries above.

## Critique-identified soft fixes
- **Source:** Step 12b critique
- **Defer to:** Phase 7
- **Items:**
  - Mobile page-header sub-line truncation at 375 width (description "Delivery status, manual reminders, and template library." needs better reflow).
  - Reminders helper sentence vs. centred-card column alignment.
  - "Provider error" gloss in expanded `<details>` body to soften vendor-engineer language.
  - Deep-link from Delivery event row to its source booking (data is present, link is missing).
  - Failure-row visual prominence (the row silhouette doesn't catch the eye on a calm page).
