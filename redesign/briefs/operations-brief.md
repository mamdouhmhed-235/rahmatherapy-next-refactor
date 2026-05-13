# Shape Brief: `/admin/operations` redesign

**Date:** 2026-05-12
**Page slug:** `operations`
**Status:** user-confirmed
**Brief number:** 17 of 29 (Phase 5)

## 1. Feature Summary

The clinic's safe-context production-support log: integration failures, email-send errors, booking-engine warnings, and similar `operational_events` rows surface here with safe metadata only (no request bodies, no health notes, no secrets, no email bodies). The redesign reframes the current single-panel article dump into a triage queue grouped by status, with severity-led visual emphasis, inline ack/resolve, expandable safe-context payloads, and filters that match how the team actually clears the queue.

## 2. Primary User Action

**Triage the open queue: acknowledge what's seen, resolve what's handled, leave what's still pending.** A secondary action is investigative: open an event's `safe_context` to read the keys, then deep-link to the related booking or staff record if `booking_id` / `staff_id` is set. The page is reactive (operator visits because an alert pointed here, or because the dashboard's "Operational errors" count was non-zero).

## 3. Design Direction

A quiet incident log, not a dashboard. Three stacked status columns at desktop (Open / Acknowledged / Resolved), single-column status-tabbed stack on mobile, with severity carrying the *only* high-saturation pigment on the surface; error rows in Cancelled family, warning rows in Attention family, info rows neutral. The current red `Siren` icon at line 73 disappears: severity travels in the named status badge, not in a decorative icon. Safe-context keys render as a quiet chip row, not a comma-joined string; expansion opens a native `<details>` panel with mono key/value rendering.

## 4. Scope

In:
- Replace the single `AdminPanel` of article rows with a three-column layout on `xl:` (Open / Acknowledged / Resolved), single-column tabbed on `lg:` and below.
- Each event renders as a tight, full-border row (no nested cards) with: severity chip + event-type chip + summary line (Work Sans 500) + relative time + safe-context key chips + Ack/Resolve action row.
- Filter strip: severity (info / warning / error), event_type (multi-select; populated from distinct values in current page-load data), date-range presets (Today / 7 days / 30 days / Custom), free-text `q` over `summary`. All GET params.
- Safe-context inspection: native `<details>` with mono key/value list, never a modal. Booking_id / staff_id render as deep-links.
- Bulk Resolve on the Open column (header: "12 open" + Ghost "Resolve all" → `ConfirmActionModal` with Cancelled family icon + plain-English summary listing the count).
- Empty states via shared `EmptyState`.
- Carry-forward soft fixes per Phase 6: raw `var(--rahma-*)` token escapes throughout, raw `text-red-600` on Siren, raw permission identifier (`manage_settings or view_email_logs`) on the denied screen.
- Pagination: hard `limit(100)` becomes "Load more" 50-at-a-time per column.

Out (unchanged):
- `updateOperationalEventStatus` server action and its `event_id` / `status` POST contract (RECON §5 untouchable; `src/app/admin/operations/actions.ts`).
- `operational_events` schema and safe-context redaction at write-time (RECON §6.2 family).
- No new mutations beyond ack/resolve. No "reopen" action; resolved is terminal. If an event recurs, the next emission becomes a new Open row (existing behaviour).
- No comments / notes on events. The current model carries no human-note column; adding one is a separate change.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader`; "Operational events" / "Production support events. Safe metadata only: no request bodies, no health notes, no secrets, no email bodies." (Lifts the existing description verbatim; it carries the safety promise this page makes to the operator.)
2. Severity summary strip (three `AdminStat` tiles): "Open errors", "Open warnings", "Open info". Cormorant numeral; no trend arrows (clear-the-queue counts, not running metrics). Tiles act as one-click filters: click "Open errors" → applies `severity=error&status=open` and scrolls to the Open column.
3. Filter strip (`AdminFilterBar`): severity / event_type / date-range / `q`. Secondary "Apply"; Ghost "Clear filters" when any filter active. Active filter chips below the strip.
4. Three-column status grid on `xl:` (`1fr 1fr 1fr`), tabbed on `lg:` and below.

**Column layout (each of Open / Acknowledged / Resolved):**
- Column header: status name as H3 + count `AdminStatusBadge` (Cancelled family for Open if count>0, Pending for Acknowledged, Confirmed for Resolved).
- Open column header carries a trailing Ghost "Resolve all" if count ≥ 2 (single-item Resolve doesn't need bulk).
- Body: stacked event rows in `surface-card` panels (each panel = one event, NOT a grouping panel; keeps the row scannable and self-contained).
- Footer: "Load more" Secondary if count > 50 rendered.

**Event row composition:**
- Top row: severity chip (the lone tinted element on the row; error=Cancelled, warning=Attention, info=Restricted) + event-type chip (Restricted family, decorative-only) + relative time on the right (Soft Slate label step).
- Body: `summary` in Work Sans 500 body step, Practice Charcoal. Single line on desktop with truncation + tooltip; full text on mobile (wraps).
- Sub-line: linked references; "Booking #1d503d3b" + " · Staff: Karim" (links resolved server-side; if id is unmapped, render the truncated UUID as mono token, copy-on-click).
- Safe-context chip row: each key in `safe_context` renders as a small chip with mono key + value preview ("city: Luton"). Up to 4 chips inline; if more, "+3 more" Ghost opens the `<details>`.
- `<details>` body (expanded): mono key/value table; values JSON-formatted; copy-on-click on the whole JSON.
- Action row (Open and Acknowledged only): inline forms; Resolved column rows have no action row.

**Mobile (≤lg):**
- Severity stat tiles stack vertically.
- Three-column grid becomes a `TabPills` strip (Open / Acknowledged / Resolved) with the open-count badge. Default tab: Open.
- Filter strip collapses behind "Filters" Ghost → `AdminSheet` from the bottom.
- Event row sub-line wraps; safe-context chip row scrolls horizontally (momentum), `<details>` works as on desktop.

## 6. Key States

- **Default; Open column populated, Acknowledged and Resolved hidden behind columns.**
- **Empty Open (the goal).** `EmptyState` in the Open column: shield-with-check SVG, "Nothing open. The clinic is humming." (Acknowledged and Resolved columns retain their own empties if applicable.)
- **All clear (every column empty).** Page-level `EmptyState` replaces the three-column grid: same shield-with-check SVG, "No operational events logged. Quietest week in months."
- **Loading.** `AdminSkeleton`: three column headers + 4 row skeletons per column.
- **Acknowledge submitting.** Open-column row's Ack button sets `aria-busy="true"` with spinner; on success, row animates out of Open and into Acknowledged column (no full reload). Optimistic with rollback on failure.
- **Resolve submitting.** Same pattern; row migrates Open→Resolved or Acknowledged→Resolved.
- **Bulk Resolve flow.** `Resolve all` Ghost → `ConfirmActionModal` (Cancelled family icon, plain-English: "Mark 12 open events resolved? They'll move to the Resolved column.") → Primary "Resolve all" / Secondary "Cancel". On confirm: column shows a single inline progress line "Resolving 12…", rows migrate as the server action returns.
- **Resolve success toast.** Confirmed family Sonner, leading `check-circle`, "12 events resolved." Auto-dismiss 4s.
- **Resolve failure toast.** Cancelled family Sonner, no auto-dismiss, "Couldn't resolve 3 of 12. Try again." Ghost "Retry" within the toast.
- **High-severity emphasis.** Error-severity rows in the Open column get a fully-tinted Cancelled-family background on the entire row (still no `border-l-4`). This is the only severity-driven background treatment on the page; warnings and info rows stay on `surface-card`. Operators glance the Open column and immediately see how many are red-tinted.
- **Filter active.** Filter chips visible; "Clear filters" Ghost beside "Apply".

### Backend error states (Layer 3 — for Phase 6 `/impeccable harden`)

| State | What the user sees |
|---|---|
| Initial page data load failure (DB error or timeout on any of the three column queries) | Cancelled-family `role="alert" aria-live="polite"` banner replaces the three-column grid (or mobile tab content): "Couldn't load operational events. Try refreshing." Ghost "Try again" button. Severity stat tiles are also absent. Filter strip remains visible. |
| Admin/PM scope: owner-only event types silently omitted | No error, no greyed-out rows. Admin/PM simply sees a shorter list. Silent omission per §11. |
| Bulk resolve: partial failure (some rows resolved, some failed) | Sonner Cancelled toast (no auto-dismiss): "Couldn't resolve {N} of {total}. Try again." The successfully-resolved rows migrate to the Resolved column; failed rows remain in Open. Ghost "Retry" in the toast re-triggers the remaining failures only. |

## 7. Interaction Model

- Ack and Resolve are individual `<form action={updateOperationalEventStatus}>` per row with `<input type="hidden" name="event_id">` and `<input type="hidden" name="status" value="acknowledged|resolved">` preserved verbatim (RECON §6.4).
- Bulk Resolve: client component generates one POST per selected event_id through the same server action, sequenced (not parallel; keeps audit-log ordering deterministic), with the column progress line updating between each.
- Optimistic UI: client wrapper around the row sets `aria-busy`, awaits server return, swaps column, fires Sonner toast.
- Stat tile click → updates URL filters via the GET form → re-renders with the filter applied and scrolls to the relevant column.
- Severity chip click on a row → adds that severity to the filter and applies (quick triage by error-only).
- Safe-context `<details>` → native; no JS required.
- Copy JSON in expanded details → `navigator.clipboard.writeText(JSON.stringify(safe_context, null, 2))` → Sonner Confirmed "Copied safe context".
- Keyboard: `o` / `a` / `r` jumps focus to the Open / Acknowledged / Resolved column heading (PRODUCT.md cautions against keyboard primary paths; this is *additional*, surfaced in screen-reader-only help text, never the only way).

## 8. Content Requirements

- Page title: "Operational events".
- Page description: "Production support events. Safe metadata only: no request bodies, no health notes, no secrets, no email bodies."
- Column headers: "Open" / "Acknowledged" / "Resolved".
- Stat tile labels: "Open errors", "Open warnings", "Open info".
- Empty Open: "Nothing open. The clinic is humming."
- Empty everything: "No operational events logged. Quietest week in months."
- Bulk Resolve modal title: "Resolve open events?"
- Bulk Resolve modal body: "Mark {n} open events resolved? They'll move to the Resolved column."
- Resolve success toast: "{n} event resolved." / "{n} events resolved." (count-aware).
- Resolve failure toast: "Couldn't resolve {n} of {total}. Try again."
- "Safe context" chip prefix: just the key name in mono; no "Safe context:" prefix label (it's clear from position).
- No raw permission identifiers on the live surface (current `page.tsx:113` leaks `manage_settings or view_email_logs`).

## 9. Recommended References

- Brief 01 (`00-shared-components`) → `TabPills`, status badge composition, EmptyState, AdminSheet, AdminStat, ConfirmActionModal.
- Brief 11 (`audit`) → safe-context expansion grammar (the `<details>` JSON treatment matches the audit before/after columns at low cost; copy the mono token + copy-on-click pattern verbatim).
- Brief 12 (`account-password-requests`) → `ConfirmActionModal` wire-up reference for the bulk Resolve flow.
- DESIGN.md §2 → Status Families table for severity mapping (error → Cancelled, warning → Attention, info → Restricted).
- DESIGN.md §Admin-Specific Patterns → Bulk Actions (this is the second admin surface to use bulk; matches the spec).
- BASELINE-CRITIQUE: no deterministic carry-forwards on this page. Soft fixes listed in §4.

## 10. Open Questions

1. **Severity-tinted background on error rows in Open column.** This is the one place on the page where a status family supplies a full row background, not just a chip. PRODUCT.md's anti-pattern list bans colour-only status, but this isn't colour-only (chip + label + tint, all three). It risks reading as alarming on a busy day. Proposal: keep the tint, but only on Open + error (≤ 5% of rows in steady state). Phase 6 verifies against a populated database.
2. **Auto-resolve-after-N-days.** Resolved events accumulate forever and the Resolved column will grow indefinitely. Not in scope (the schema has no soft-delete or archive), but flag for Phase 7 product question: is a 30-day Resolved retention worth proposing?

## 11. Role variants

### Owner

Full surface. Both `manage_settings` and `manage_email_settings` permissions held. All three columns visible, all filters active, all actions available (Ack, Resolve, bulk Resolve, stat-tile click-to-filter). Sees the full event stream including settings-system events that PM lacks visibility into. Booking_id / staff_id deep-links resolve fully.

### Admin (Practice Manager)

Identical chrome to Owner. PM holds `manage_email_settings` (the access gate's `OR` arm) but lacks `manage_settings`. The data layer filters out events flagged as owner-scope-only by `event_type` (a small subset of settings-system events); PM sees email-delivery, booking-engine, and integration events. All actions (Ack, Resolve, bulk Resolve) available on events PM can see. No copy on the page references "owner-only" content; events PM can't see simply don't appear, not greyed out.

### Booking Coordinator

Coordinator holds neither permission. Collapse to the **Denied state**.

### Therapist

Therapist holds neither permission. Collapse to the **Denied state**.

### Denied state

`AdminAccessDenied` invoked when neither `manage_settings` nor `manage_email_settings` is held:

- Title: "Operational events access limited"
- Body: "Production support events are restricted to the owner and practice manager. Ask the owner if you need access."
- No raw `manage_settings or view_email_logs` permission identifier on screen (current `page.tsx:113` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

---

## Recipe Context

- **RECON §2 inventory row:** Operations — `src/app/admin/operations/page.tsx` — `/admin/operations` — Safe-context production support events; ack/resolve.
- **Access gate (RECON §3):** `getAdminPageAccess(profile, "operations")`; passes on `manage_settings` OR `manage_email_settings`. Owner holds both; Admin/PM holds `manage_email_settings`; Coordinator and Therapist hold neither.
- **Untouchable backend (RECON §5):** `updateOperationalEventStatus` server action at `src/app/admin/operations/actions.ts` (explicit DO-NOT-TOUCH). Redaction rules at the write-side (`operational_events` insert paths) are equally untouchable per RECON §6.2 family.
- **Preserved IDs / form names (RECON §6.4):** `<input type="hidden" name="event_id">` and `<input type="hidden" name="status">` on every Ack / Resolve form, preserved verbatim. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** Currently none. The redesign **adds** GET params `severity`, `event_type`, `status`, `from`, `to`, `q`; all additive, no rename.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** none deterministic. Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout, raw `text-red-600` on Siren, raw permission identifier on `AdminAccessDenied`, ad-hoc empty state instead of shared `EmptyState`, hard `limit(100)` replaced with paginated "Load more" per column.
- **IMAGES-NEEDED additions:** `operations-clear.svg` (shield-with-check, ~80–120px) for the all-clear `EmptyState`. Append row in Phase 6.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Three-column desktop / tab strip mobile: breakpoint switchover at `lg`, both renderings show identical row counts.
  - Ack / Resolve round-trip: row migrates between columns without a full reload; audit log row appears per mutation; rollback works when the server action errors.
  - Bulk Resolve: confirm modal renders Cancelled family icon + plain-English copy; sequenced POSTs preserve audit-log order; partial failure surfaces a Retry toast naming the failed count.
  - Filter contract: every combination produces a URL with the documented param names; deep-link survives a reload; stat-tile click applies the right filter and scrolls.
  - Severity tint on Open + error rows: verify against a populated database that the tint reads as legible not alarming; revisit per §10 Q1.
  - Role pass: Owner / Admin-PM / Coordinator / Therapist; confirm column / event visibility, `AdminAccessDenied` content matches §11.
  - A11y pass: `AdminAccessDenied` no longer renders `manage_settings or view_email_logs`; column headings are H3 and contiguous; Ack/Resolve buttons announce target event in accessible name; mobile `AdminSheet` traps focus; `<details>` are keyboard-operable.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**Filter bar:**
- `Severity` (`name="severity"`, multi-select) — default `Any severity`. Options: `Error`, `Warning`, `Info`.
- `Event type` (`name="event_type"`, multi-select) — default `All event types`.
- `Date range` chips — `Today`, `Last 7 days`, `Last 30 days`, `Custom`.
- `Search` (`name="q"`) — placeholder `Search events`.

**Per-row action forms (hidden inputs preserved from RECON §6.4):**
- `event_id` (hidden).
- `status` (hidden; value `acknowledged` or `resolved`).

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Filter apply | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filters` (with count) | Ghost |
| Mobile filter sheet apply | `Apply filters` | Primary |
| Per-row acknowledge | `Acknowledge` | Ghost |
| Per-row resolve | `Resolve` | Ghost |
| Bulk resolve trigger | `Resolve all` | Ghost |
| Bulk resolve modal confirm | `Resolve all` | Destructive |
| Bulk resolve modal cancel | `Cancel` | Secondary |
| Per-tile filter shortcut (stat tiles) | (click on tile — no visible button) | — |
| Copy safe-context JSON | (click on JSON block) | — |
| Pagination | `Load more` | Secondary |
| Mobile tab pills | `Open` / `Acknowledged` / `Resolved` | Tab-pill |
| Empty-state retry | `Try again` | Ghost |

### Error messages

- Acknowledge failure: `Couldn't acknowledge that event. Try again.` (toast, persistent)
- Resolve failure: `Couldn't resolve that event. Try again.`
- Bulk resolve partial failure: `Couldn't resolve {N} of {total}. Try again.` (toast, persistent, Retry)
- Bulk resolve total failure: `Couldn't resolve any events. Try again.`
- Filter combination yields zero events: handled by per-column empty states (no toast).
- Search query too short (<3 chars on summary search): `Type at least 3 characters to search.`
- Date range invalid: `End date has to be after the start date.`
- Page load failure: `Couldn't load operational events. Try refreshing.` (replaces the column grid with an inline alert + Retry)
- Copy-to-clipboard failure: inline `<pre>` of the JSON shown beside the click target.

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Open column empty | `Nothing open` | `The clinic is humming.` | — |
| Acknowledged column empty | `Nothing acknowledged` | `Events you've seen but haven't yet resolved appear here.` | — |
| Resolved column empty | `Nothing resolved yet` | `Resolved events appear here for the record.` | — |
| All three columns empty (whole page) | `No operational events logged` | `Quietest week in months.` | — |
| Filtered to empty | `No events match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Denied | `Operational events access limited` | `Production support events are restricted to the owner and practice manager. Ask the owner if you need access.` | `Back to dashboard` |

### Tooltip text

- Severity chip: native `title` describes the level — `Error — needs attention soon`, `Warning — keep an eye on it`, `Info — for the record`.
- Event-type chip: native `title` shows the raw `event_type` value for power-user inspection.
- Relative time on row: native `title` shows absolute time — `12 May 2026, 19:42 BST`.
- Safe-context chips ("city: Luton"): native `title` shows the full value if truncated.
- "+N more" Ghost: `Show all safe-context fields`.
- Acknowledge Ghost: `Mark this event as seen. Moves to Acknowledged.`
- Resolve Ghost: `Mark this event resolved. Moves to Resolved.`
- Bulk "Resolve all" Ghost: `Resolve every open event in one go`.
- Stat tiles: native `title` — `Filter to open errors` / `Filter to open warnings` / `Filter to open info`.
- Copy-on-click JSON: cursor hint `Click to copy as JSON` (via `title`).
- Booking deep-link in sub-line: `Open this booking`.
- Staff deep-link in sub-line: `Open this staff member's record`.

### Confirmation dialog text

**Bulk resolve**
- Heading: `Resolve open events?`
- Body: `Mark {N} open events resolved? They'll move to the Resolved column. Nothing is deleted; all events stay on the audit log.`
- Destructive: `Resolve all`
- Secondary: `Cancel`

No per-row confirmation (Ack and Resolve are reversible via the audit and recurrence is normal behaviour).

**Toasts**
- Acknowledge success: `Acknowledged.`
- Resolve success (single): `Resolved.`
- Resolve success (bulk): `{N} events resolved.` (singular `1 event resolved.`)
- Bulk partial failure: `Couldn't resolve {N} of {total}. Try again.` (persistent, Retry)
- Filter applied: no toast — column re-render is the feedback.
- Copy safe-context: `Copied safe context.`
