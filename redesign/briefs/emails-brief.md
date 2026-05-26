# Shape Brief: `/admin/emails` redesign

**Date:** 2026-05-12
**Page slug:** `emails`
**Status:** user-confirmed
**Brief number:** 16 of 29 (Phase 5)

## 1. Feature Summary

Operational email status hub for the clinic: who got which transactional email, did it land or bounce, and which of the next-20 upcoming bookings still need a manual reminder. The redesign reframes the current two-column dump as a **three-tab surface under one `/admin/emails` parent** — **Delivery** (the events timeline), **Reminders** (manual-send queue), and **Templates** (preview / edit, handed off to Brief 02). The two tabs covered here lean on filters and grouping, not raw lists.

## 2. Primary User Action

**Confirm a specific reminder landed, or send one that hasn't.** Almost every visit to `/admin/emails` is reactive: a client said they didn't receive the confirmation, or it's the morning of a booking and the operator wants to nudge the customer. The surface optimises for "look up the booking → see the event status → resend if needed" in three clicks, with deep links from `/admin/bookings/[id]` landing on the right row.

## 3. Design Direction

Calm operational log. Delivery tab is a per-day grouped feed (matching the audit timeline's grammar so the operator's scan-pattern is shared), not a flat list. Reminders tab is a vertical list of upcoming-booking rows with the recipient inline and a single Primary "Send reminder" per row, no modal. Status families do the work: Confirmed for accepted/delivered, Cancelled for failed/bounced, Pending for queued, Restricted for spam/complaint, Attention for missing recipient (`recipient_email = null`). Mail iconography is decorative-only; the status badge carries the truth.

## 4. Scope

In:
- Replace the unframed two-column layout with a parent `/admin/emails` page that hosts the three tabs above (`Delivery` / `Reminders` / `Templates`).
- Default tab: **Delivery**. URL contract: `?tab=delivery|reminders|templates&event_type=&delivery_status=&recipient_role=&from=&to=&q=`.
- Delivery tab: per-day grouped `AdminPanel`s, each row a tight event card with full status badge composition (icon + label + tint), inline recipient, sub-line of `recipient_role` + relative time + `provider_message_id` in mono (copy-on-click via Sonner), expandable `<details>` for the full `error_message`.
- Filter strip above Delivery: `event_type` (multi-select of the 9 known template event types from `src/lib/email/templates.ts`), `delivery_status` (accepted / delivered / opened / clicked / bounced / failed / complained), `recipient_role` (customer / staff / admin), date-range presets (Today / Last 7 days / Last 30 days / Custom), free-text `q` over recipient email + provider id prefix. All GET params.
- Reminders tab: same next-20-upcoming-bookings list the current page renders, but each row uses the `BookingListCard` body (avatar, contact name, formatted date+time, payment badge omitted) + a trailing Primary "Send reminder" + a one-line "Last reminder sent: 9 May, 10:14" if the audit/event history shows one.
- Empty states via shared `EmptyState`.
- Carry-forward soft fixes per Phase 6: raw `var(--rahma-*)` token escapes (every line), raw `text-red-700` on `error_message` → Cancelled family token, raw permission identifier on the denied screen.
- Pagination: Delivery moves from hard `limit(100)` to a "Load more" 50-at-a-time (matches DESIGN.md §Admin-Specific Patterns → Pagination).

Out (unchanged):
- `sendManualBookingReminder` server action and its no-private-body contract (RECON §5 untouchable — `src/app/admin/emails/actions.ts`).
- `email_delivery_events` schema and the read shape.
- Templates tab content; the template browser, preview, edit, and manual-send sheet all live in Brief 02. This brief defines the **tab shell** and the chrome around Brief 02's tab content.
- No new mutations beyond resend. No "resend any event" generic button; resend is reminder-scoped on purpose.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader`; "Email" / "Delivery status, manual reminders, and template library." No actions slot (per-tab actions live in the tab body).
2. Sticky tab strip (`TabPills` per Brief 01 shared-components vocabulary): Delivery (count badge: failed-in-last-24h if >0, Cancelled family) / Reminders (count badge: upcoming candidates) / Templates. `aria-current="page"` on the active tab.
3. Tab body fills the remaining width on `xl:` (no two-column split at this level; each tab owns its own layout).

**Delivery tab body:**
- Filter strip at top (one row on `lg:` and above, wraps below). Inputs follow Form Seam standard. "Apply" Secondary; "Clear filters" Ghost when any filter active.
- Active filter chips below the strip (`x` to clear each).
- Per-day `AdminPanel` groups, newest day first. Header: business-date as H3 + count `AdminStatusBadge` ("17 events"). Body: stacked event rows.
- Event row: status badge cluster on left (`event_type` + `delivery_status`), recipient email (Work Sans 500), sub-line of `recipient_role` + relative time + mono provider id, `<details>` toggle if `error_message` exists. Single row, no nested card.
- "Load more" Secondary at bottom; 50-at-a-time; preserves scroll.
- Empty: `EmptyState` with an envelope-with-check SVG, "No email events match your filters." with Ghost "Clear filters" if any active.

**Reminders tab body:**
- Single column, max 720px (operator surface, doesn't need full width).
- Above the list: short inline help line in Soft Slate explaining "Sends the existing reminder template. No private email bodies are stored." (lifts the current page description, but inside the tab body rather than the page header).
- List of up to 20 upcoming bookings, sorted by date then time.
- Row: avatar + contact name (Work Sans 500) + formatted date+time + Primary "Send reminder" (right-aligned, full-width on mobile becoming a sticky bottom action bar). Sub-line below name: contact email in Soft Slate + "Last reminder: 9 May, 10:14" (only if found in event history; otherwise omitted, not "Never sent").
- Empty: `EmptyState`, calendar-with-zzz SVG, "No upcoming bookings need a reminder." No CTA.

**Templates tab body:** handed to Brief 02; this brief preserves the slot, not the content.

**Mobile (≤768px):**
- Tab strip becomes momentum-scroll pills (DESIGN.md §Admin-Specific Patterns → View Tabs).
- Delivery filter strip collapses behind a "Filters" Ghost button → opens an `AdminSheet` from the bottom; active filter count appears on the trigger.
- Reminders rows: Primary "Send reminder" inline on every row, full-width below the metadata.

## 6. Key States

- **Default; Delivery tab, no filters.** Newest day first, up to 50 events.
- **Failed-events spike.** Delivery tab badge shows the 24h failed count in Cancelled family. Filtering `delivery_status=failed` is one click.
- **Filter active.** Filter chips visible; "Clear filters" Ghost appears next to "Apply".
- **Loading.** `AdminSkeleton` bars approximating: tab strip (instant, no skeleton), filter strip (instant), 3 per-day panels with 4 row skeletons each.
- **Resend submitting.** Reminders row's Primary "Send reminder" becomes `aria-busy="true"` with the 16px spinner replacing the leading icon; row sub-line gains a Pending-family "Sending…" chip until the server action returns; success swaps to Confirmed-family "Sent" chip and the "Last reminder" line updates.
- **Resend success.** Sonner toast top-right desktop / top-centre mobile, Confirmed family, leading `check-circle`, "Reminder sent to {first_name}." 4s auto-dismiss.
- **Resend failure.** Sonner toast, Cancelled family, no auto-dismiss, leading `x-circle`, "Couldn't send to {first_name}. Try again or check the email address." Ghost "Retry" within the toast.
- **Empty; Delivery.** No events ever (fresh database) → "No email events logged yet."; encouraging not apologetic. With filters → "No email events match your filters." + Ghost "Clear filters".
- **Empty; Reminders.** No upcoming candidates → "No upcoming bookings need a reminder. Everyone's confirmed."
- **Missing recipient.** Event row with `recipient_email = null` renders a leading Attention chip "No recipient on file" and the recipient slot reads "; (booking #abcd1234)" with the truncated `booking_id` linking to the booking detail. This is rare but happens when staff is removed before delivery; surface it loudly, don't suppress.

### Backend error states (Layer 3 — for Phase 6 `/impeccable harden`)

| State | What the user sees |
|---|---|
| Delivery tab data load failure (DB error, timeout, or permission change mid-session) | Cancelled-family inline `role="alert" aria-live="polite"` region replaces the timeline and per-day panels: "Couldn't load email events. Try refreshing." Ghost "Try again" button. Tab strip remains usable so the operator can switch to Reminders or Templates. Filter strip stays visible. |
| Delivery tab: `recipient_role='admin'` events appear for Coordinator | Silent — the server filters them server-side. No error, no "hidden" copy hint. The Coordinator simply does not see those rows. |
| Delivery tab: `q` search returns zero results | `EmptyState`: "No email events match your filters." Ghost "Clear filters" CTA. |

## 7. Interaction Model

- Tab clicks update `?tab=` via the surrounding GET form; full-document navigation, server-rendered (no client routing required, matches the rest of the admin).
- Filter strip is one GET form per tab; submitting submits all current filter inputs at once.
- "Send reminder" is a `<form action={sendManualBookingReminder}>` per row, `<input type="hidden" name="booking_id">` preserved verbatim (RECON §6.4). No JS required.
- Optimistic UI on resend: client component wraps the form, transitions to `aria-busy` on submit, awaits server return, swaps to Sent / Failed state and triggers the Sonner toast.
- Copy provider message ID: click the mono token → `navigator.clipboard.writeText(...)` → Sonner Confirmed "Copied event ID".
- Expand error: native `<details>` element, no JS. Open state styled with a tinted Cancelled background.
- Date-range preset pills set `from` / `to` to canned values and submit; Custom opens a DayPicker popover.
- Keyboard `j` / `k` deferred per §10.

## 8. Content Requirements

- Page title: "Email".
- Page description: "Delivery status, manual reminders, and template library."
- Delivery tab label: "Delivery" (count badge if failed-in-last-24h > 0).
- Reminders tab label: "Reminders" (count badge: upcoming candidates).
- Templates tab label: "Templates".
- Reminders intro: "Sends the existing reminder template. No private email bodies are stored."
- Delivery empty (no filters): "No email events logged yet."
- Delivery empty (with filters): "No email events match your filters."
- Reminders empty: "No upcoming bookings need a reminder. Everyone's confirmed."
- Resend success toast: "Reminder sent to {first_name}."
- Resend failure toast: "Couldn't send to {first_name}. Try again or check the email address."
- Missing recipient row chip: "No recipient on file"
- No raw permission identifiers anywhere on the live surface (current `page.tsx:143` leaks `view_email_logs`).

## 9. Recommended References

- Brief 01 (`00-shared-components`) → tab strip, `TabPills`, status badge composition, EmptyState, AdminSheet (mobile filters).
- Brief 02 (`email-templates`) → defines the Templates tab content. This brief defines its slot, not its body.
- Brief 11 (`audit`) → per-day grouped panel grammar matches; copy the day-header pattern verbatim so audit + delivery feel like siblings.
- DESIGN.md §5 → AdminStatusBadge (icon + label + tint), Status Families table for event-type and delivery-status mapping.
- DESIGN.md §Admin-Specific Patterns → Search and Filter (GET form contract); Pagination (Load more); Status Communication (resend success / failure toasts).
- BASELINE-CRITIQUE: no deterministic carry-forwards. Soft fixes listed in §4 above.

## 10. Open Questions

1. **Failed-events badge window.** "Failed in last 24h" or "Failed in last 7 days" on the Delivery tab badge? Proposal: 24h. Failures matter when they're recent and actionable; week-old bounces have likely been chased already through other channels. Phase 6 confirms.
2. **`j` / `k` keyboard nav.** Power-user shortcut on a novice-target surface. Worth it because the operators' established CRM (monday.com) uses similar; but PRODUCT.md explicitly warns against keyboard shortcuts as a primary path. Proposal: ship without `j` / `k` initially; revisit if usage data shows long event-list traversals are common. Defer.

## 11. Role variants

### Owner

Full surface. All three tabs visible. All filters active. Both `view_email_logs` and `resend_booking_emails` permissions held. "Send reminder" Primary on every Reminders row. Templates tab fully editable per Brief 02. Sees system-internal `recipient_role = "admin"` events (e.g. failed-payment alerts to ops); Coordinator and Therapist do not.

### Admin (Practice Manager)

Identical to Owner for this surface. PM holds both permissions and the same `recipient_role = "admin"` visibility. Only delta lies inside the Templates tab (Brief 02 specifies which template fields PM can edit); not this brief's concern.

### Booking Coordinator

Coordinator holds `resend_booking_emails` (sends reminders as part of front-desk work) but typically lacks `view_email_logs`. Surface adapts:

- If Coordinator holds **only** `resend_booking_emails`: Delivery tab and its badge are **hidden**; the tab strip is two-wide (Reminders + Templates). Default tab: Reminders. Filter strip is irrelevant; not rendered.
- If Coordinator holds **both** (operator decision, not default): identical to Admin/PM, but the `recipient_role` filter omits the "admin" option and any `recipient_role = "admin"` event rows are hidden server-side (existing data layer respects this).
- Templates tab: read-only per Brief 02's Coordinator variant.
- Empty Reminders copy unchanged.

### Therapist

Therapists hold neither permission by default. They reach this page only by deep-link (a stale bookmark, an emailed link from an admin). Collapse to the **Denied state**; no tab strip, no partial render.

### Denied state

`AdminAccessDenied` invoked when neither `view_email_logs` nor `resend_booking_emails` is held:

- Title: "Email access limited"
- Body: "You need email or booking-management access to see delivery status. Ask the practice owner."
- No raw `view_email_logs` permission identifier on screen (current line 143 leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

---

## Recipe Context

- **RECON §2 inventory row:** Emails — `src/app/admin/emails/page.tsx` — `/admin/emails` — Resend delivery events + manual reminder queue.
- **Access gate (RECON §3):** `canViewEmailLogs(profile) || canResendBookingEmails(profile)`. Owner / Admin/PM hold both; Coordinator typically holds resend only; Therapist holds neither.
- **Untouchable backend (RECON §5):** `sendManualBookingReminder` server action at `src/app/admin/emails/actions.ts` (RECON §5 explicit DO-NOT-TOUCH). The redesign is presentation-only against this contract.
- **Preserved IDs / form names (RECON §6.4):** `<input type="hidden" name="booking_id">` on every Reminders row preserved verbatim. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** This page currently has none. The redesign **adds** GET params `tab`, `event_type`, `delivery_status`, `recipient_role`, `from`, `to`, `q`; all additive, no rename.
- **Tabbed-shell coupling:** Brief 02 (`email-templates`) defines the Templates tab body. This brief defines the tab shell and the Delivery + Reminders bodies. Phase 6 implementation order: this brief first (shell), Brief 02 second (Templates content drops into the prepared slot).
- **BASELINE-CRITIQUE carry-forwards landing on this page:** none deterministic. Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout, raw `text-red-700` on `error_message` line, raw permission identifier `view_email_logs` on `AdminAccessDenied`, ad-hoc empty state instead of shared `EmptyState`, hard `limit(100)` replaced with paginated "Load more".
- **IMAGES-NEEDED additions:** `emails-empty.svg` (envelope-with-check, ~80–120px) for Delivery empty state; `reminders-empty.svg` (calendar-with-zzz, ~80–120px) for Reminders empty state. Append rows in Phase 6.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Tab strip: confirm `?tab=` deep-links resolve to the correct default; `aria-current="page"` set on the active tab; mobile pill row scrolls horizontally without overflow.
  - Resend round-trip: click "Send reminder", observe `aria-busy`, observe Sonner success toast, observe "Last reminder" sub-line update on the row without a full reload.
  - Resend failure path: force a server-action throw, confirm Cancelled toast with Retry, no auto-dismiss, no row state mutation.
  - Filter contract: every Delivery filter combination produces a URL with the documented param names; deep-link survives a reload.
  - Pagination: Load more appends 50 rows in place; existing rows stay scrolled in view; URL gains no offset param (server reads cursor from the last visible row).
  - Role pass: Owner / Admin/PM / Coordinator-resend-only / Coordinator-both / Therapist; confirm tab visibility, filter visibility, recipient_role filter options, and `AdminAccessDenied` content match §11.
  - A11y pass: `AdminAccessDenied` no longer renders `view_email_logs`; resend buttons announce target name in their accessible name; expandable `<details>` are keyboard-operable; mobile filter `AdminSheet` traps focus.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**Delivery tab filter strip (each filter has a visible `<label>`):**
- `Search` (`name="q"`) — placeholder `Email or event ID`.
- `Event type` (`name="event_type"`, multi-select) — default option `All events`.
- `Delivery status` (`name="delivery_status"`) — default option `Any status`. Options: `Accepted`, `Delivered`, `Opened`, `Clicked`, `Bounced`, `Failed`, `Complained`.
- `Recipient` (`name="recipient_role"`) — default option `Any recipient`. Options: `Customer`, `Staff`, `Admin` (Admin option hidden for Coordinator).
- `From` / `To` (date inputs, revealed when Range = `Custom`).
- Date range chips — group label `Range` (sr-only). Chips: `Today`, `Last 7 days`, `Last 30 days`, `Custom`.

**Reminders tab — per-row hidden form:**
- `booking_id` (hidden input, preserved verbatim from RECON §6.4).

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Filter apply | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filters` (with count) | Ghost |
| Mobile filter sheet apply | `Apply filters` | Primary |
| Per-row resend | `Send reminder` | Primary |
| Per-row resend (in-flight) | `Sending…` (with spinner) | Primary, `aria-busy` |
| Pagination | `Load more` | Secondary |
| Tab pills | `Delivery` / `Reminders` / `Templates` | Tab-pill |
| Resend failure retry | `Retry` | Ghost (toast) |
| Copy provider ID | (click on mono token; no visible button) | — |

### Error messages

- Filter combination yields zero events: `No email events match your filters.` (empty state)
- Search query under 4 chars: `Type at least 4 characters of an email or event ID.`
- Delivery load failure: `Couldn't load email events. Try refreshing.` (inline Cancelled banner replacing the timeline; tab strip stays usable)
- Resend failure: `Couldn't send to {first_name}. Try again or check the email address.` (Sonner, persistent, Retry Ghost)
- Resend disabled (no recipient on file): inline Attention chip in row reads `No recipient on file` — the resend button is hidden, no error needed.
- Resend on stale booking (booking was cancelled): `That booking was cancelled. No reminder sent.` (toast, Cancelled, persistent)
- Copy-to-clipboard failure: inline `<code>{provider_message_id}</code>` shown next to the click target for manual copy; no toast.

### Empty-state text

| Tab / context | Heading | Body | CTA |
|---|---|---|---|
| Delivery, no filters, ever | `No email events logged yet` | `Events appear here as confirmation, reminder, and cancellation emails go out.` | — |
| Delivery, filtered to empty | `No email events match your filters` | `Try a wider date range, or clear the filters.` | `Clear filters` |
| Delivery, "Failed" filter on, no failures | `No failed events in this range` | `Your emails are all getting through.` | `Clear filters` |
| Delivery, load failure | `Couldn't load email events` | `Try refreshing the page.` | `Try again` |
| Reminders empty | `No upcoming bookings need a reminder` | `Everyone's confirmed.` | — |
| Reminders, all sent recently | `All reminders sent` | `Every upcoming booking already had one go out.` | — |
| Denied | `Email access limited` | `You need email or booking-management access to see delivery status. Ask the practice owner.` | `Back to dashboard` |

### Tooltip text

- Status badge cluster on event row: native `title` shows the combined state, e.g. `Reminder: Bounced (hard bounce)`. (Enhancement only; not visible on mobile.)
- Mono `provider_message_id`: `Click to copy provider ID`.
- Time-ago on each event: native `title` shows absolute — `12 May 2026, 14:30 BST`. (Enhancement only; not visible on mobile.)
- "Send reminder" per row: `Send the reminder template to {first_name}`.
- "Last reminder: {date}" sub-line: native `title` shows absolute date+time. (Enhancement only; not visible on mobile.)
- Tab pill `Delivery` with failed-count badge: `{N} failed in the last 24 hours`. (Enhancement only; not visible on mobile.)
- Tab pill `Reminders` with candidate count: `{N} upcoming bookings without a reminder yet`. (Enhancement only; not visible on mobile.)
- Attention chip "No recipient on file": `This booking has no email address — fix on the booking detail page.`
- Expand `<details>` (error message): `Show the full provider error`.
- Search input — submitted state: `Searching "{query}"`.

### Confirmation dialog text

No `ConfirmActionModal` on this page. Resends are not confirmed (they're cheap, idempotent, and the audit log captures every send).

**Toasts**
- Resend success: `Reminder sent to {first_name}.`
- Resend failure: `Couldn't send to {first_name}. Try again or check the email address.` (persistent, Retry)
- Copy provider ID success: `Copied event ID`
- Filter applied: no toast — timeline refresh is the feedback.
