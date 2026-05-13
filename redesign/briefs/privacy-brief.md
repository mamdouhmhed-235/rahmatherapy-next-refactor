# Shape Brief: `/admin/privacy` redesign

**Date:** 2026-05-12
**Page slug:** `privacy`
**Status:** user-confirmed
**Brief number:** 19 of 29 (Phase 5)

## 1. Feature Summary

The clinic's GDPR / UK-DPA workstation: customer privacy requests (export, correction, deletion review, sensitive-note review) tracked through a four-status workflow, plus a parallel review feed of the 25 most-recent sensitive client notes. The redesign reframes the current two-equal-panels layout into a status-grouped queue on the primary surface and keeps sensitive notes as a quiet review rail, with stronger plain-English copy reminding reviewers what *not* to leak in completion.

## 2. Primary User Action

**Move a privacy request through its workflow without losing the integrity guardrails the page exists to enforce.** Specifically: triage incoming requests, mark reviewing when work begins, and complete or decline with a deliberate confirmation that surfaces the legal posture (don't delete until booking + audit integrity is reviewed; sensitive notes never enter exports). Secondary action: scan the sensitive-note review feed for anything that shouldn't be tagged sensitive, and click through to the client to recategorise.

## 3. Design Direction

A regulatory workstation, not a triage board. The page reads quiet and serious: tinted neutrals dominate, status families anchor the queue, and the *only* high-saturation element is the per-request status badge. The current ad-hoc `<article>` with `bg-white` and `<h2>` becomes a tighter row inside a status-grouped panel; the request-note appears in a Soft Slate well that visually reads "verbatim quote", and the status form moves into a `<details>` disclosure so the surface stays scannable when a queue grows. Sensitive notes shrink into a right rail that emphasises *review*, not action; clicking a note routes to the client, where edits actually live.

## 4. Scope

In:
- Replace the two-equal-column layout with a primary surface (status-grouped requests) and a narrower right rail (sensitive-note review).
- Group privacy requests into four status sections (Received / Reviewing / Completed / Declined), default expand on Received + Reviewing, default collapse on Completed + Declined. Each section is an `AdminPanel`-grouped run with a count badge and an "X items" disclosure.
- Per-request row: request_type chip + client name (linked to `/admin/clients/<id>`) + relative time + collapsible status form (`<details>`) + request_note in a quoted-style well + (when permitted) contact details.
- Filter strip: request_type (multi-select of the four request types from the data layer), status (multi-select), created date-range presets, free-text `q` over request_note. All GET params.
- `ConfirmActionModal` wired on Completed and Declined transitions (DESIGN.md §Status Communication → Confirmation destructive). Both carry plain-English legal-posture summaries.
- Sensitive-note review feed: 25 most-recent rows (unchanged data shape) rendered as `EntityRow`-style entries with StickyNote pictogram, client name, line-clamped note preview (4 lines), created timestamp, and a Ghost "Open client" deep-link.
- Empty states via shared `EmptyState`. The current page uses the legacy `AdminEmptyState` on privacy requests and a bare `<p>` on sensitive notes; both unify here (BASELINE-CRITIQUE consolidation carry-forward).
- Carry-forward soft fixes per Phase 6: raw `var(--rahma-*)` token escapes throughout, raw `bg-white` on the request `<article>` (line 180), raw permission identifier on the denied screen (line 73), legacy `AdminEmptyState` → shared `EmptyState`.

Out (unchanged):
- `updatePrivacyRequestStatus` server action and its `request_id` / `status` POST contract (RECON §5 untouchable; `src/app/admin/privacy/actions.ts`).
- `requestClientPrivacyAction` (creation) lives on the client detail page; this page never creates a request (RECON §5 + §6.4). The Created intro stays "Create a request from a client detail page."
- `client_notes` writes; sensitive notes are reviewed here, not edited. All edit affordances route to the client detail.
- The four-status enum (Received / Reviewing / Completed / Declined). No new statuses, no new transitions.
- The contact-detail visibility gate (`canViewClientContactDetails`); preserved per RECON §6.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader`; eyebrow "Privacy", title "Privacy operations", description "Track export, correction, deletion review, and sensitive-note review. Every status change is audit logged."
2. **Stat strip** (three `AdminStat` tiles, narrower than dashboard tiles): "Open requests" (Received + Reviewing) / "Awaiting longest" (oldest Received in human form: "12 days ago") / "Sensitive notes reviewed this month" (informational). Cormorant numeral. Tiles act as one-click filters.
3. Filter strip (`AdminFilterBar`): request_type / status / date-range / `q`. Secondary "Apply"; Ghost "Clear filters" when active. Active filter chips below.
4. Two-column grid on `xl:` (`1fr 22rem`), single column below.

**Left column; privacy requests:**
- Four status-grouped `AdminPanel`s in fixed order (Received → Reviewing → Completed → Declined), each with H3 status name + count `AdminStatusBadge` in the matching status family (Attention for Received, Pending for Reviewing, Confirmed for Completed, Cancelled for Declined).
- Received and Reviewing panels default-expanded; Completed and Declined default-collapsed (the operator works the open queue, not the history).
- Per-row composition (no nested cards; rows sit on `surface-page` inside the panel):
  - Top: request_type chip (Restricted family, decorative-only; the chip names the action, status does the colour work) + relative time on the right (Soft Slate label step).
  - Body: client name as H4 (Urbanist 500), linked to `/admin/clients/<id>`. Below the name, when permitted: contact-detail line (email + phone) in Soft Slate.
  - Quoted request_note: indented well with a single-character leading mark, Soft Slate body, max 4 lines `line-clamp-4` with "Show more" Ghost expansion. Whitespace preserved.
  - Footer: created/updated meta in label step. Trailing `<details>` "Update status" disclosure containing the existing `PrivacyStatusForm` (preserved verbatim, restyled to DESIGN.md tokens).
- Empty (status section): inline "No {received|reviewing|completed|declined} requests." Soft Slate. Not full `EmptyState` (the page-level empty handles that).
- Empty (whole page): `EmptyState` replaces the four panels. Calm clipboard-with-shield SVG, "No privacy requests yet. Create one from a client detail page when a customer asks for export, correction, deletion review, or sensitive-note review." No CTA (this page never creates).

**Right column; sensitive-note review:**
- Sticky `AdminPanel` titled "Sensitive notes" with count badge ("Last 25").
- Description: "These notes don't enter exports or operational logs. Open the client to edit."
- Per-row composition (compact, list-row paradigm):
  - StickyNote pictogram (16px, Soft Slate, decorative).
  - Client name (Work Sans 500, linked to `/admin/clients/<id>`).
  - Note preview, line-clamped 4 lines, Soft Slate, whitespace preserved.
  - Created timestamp in label step.
  - Trailing Ghost "Open client →" link (full row is *not* the link target; the row mixes a link + an inline preview that may itself contain selectable text the operator wants to copy; explicit CTA only).
- Empty: short inline line "No sensitive notes in the last 25 client records." Not full `EmptyState`.

**Mobile (≤lg):**
- Stat tiles stack vertically; "Awaiting longest" tile carries extra weight (full-row width).
- Sensitive-note rail moves below the request queue as a collapsed-by-default `<details>` titled "Sensitive notes (25)". Operators on phones are mid-task; the review feed is rarely the reason for the visit.
- Filter strip collapses behind "Filters" Ghost → `AdminSheet` from the bottom.
- Per-row request: status form `<details>` stays inline; expanded form fields stack vertically.

## 6. Key States

- **Default; open queue (Received + Reviewing) visible, Completed + Declined collapsed.**
- **Empty page.** Shield-and-clipboard `EmptyState` with the create-from-client guidance.
- **Loading.** `AdminSkeleton`: stat tiles + filter strip (instant) + four panel headers + 3 row skeletons inside Received + 2 inside Reviewing.
- **Status change submitting.** Row's status form sets `aria-busy="true"`; spinner replaces the form's primary icon; success migrates the row to the new status panel (no full reload). Optimistic with rollback on failure.
- **Status change → Completed.** `ConfirmActionModal` (Cancelled family icon despite Completed family colour; destructive *finality*, not destructive *outcome*): "Mark request as completed? Confirm you've reviewed booking and audit-log integrity before finalising deletion or anonymisation." Primary "Mark completed" / Secondary "Cancel".
- **Status change → Declined.** `ConfirmActionModal` Cancelled family: "Decline this request? The customer keeps the right to escalate to the ICO. Be sure the reason is recorded in the request note or client notes." Primary "Decline" (Destructive button variant) / Secondary "Cancel".
- **Status change success toast.** Sonner Confirmed family, "Request marked {status}." Auto-dismiss 4s.
- **Status change failure toast.** Sonner Cancelled, no auto-dismiss, "Couldn't update request. Try again." Ghost "Retry".
- **Filter active.** Filter chips visible; "Clear filters" Ghost beside Apply. The status panels matching the filter retain headers; the panels that don't match are hidden, not greyed.
- **Sensitive-note feed populated but request queue empty.** Whole page renders sensitive-note review only; the empty queue panel collapses to a one-line "No privacy requests yet. Create from a client detail page." in place of the four status panels.
- **Sensitive-note feed empty but requests populated.** Right rail shows the inline "No sensitive notes in the last 25 client records." line.
- **Contact details suppressed.** When the operator lacks `view_client_contact_details`, the contact-detail line under client names is omitted (not greyed). No copy hints that something is hidden.

### Backend error states (Layer 3 — for Phase 6 `/impeccable harden`)

| State | What the user sees |
|---|---|
| Initial page data load failure (DB error, timeout, or privacy table name mismatch) | Cancelled-family `role="alert" aria-live="polite"` region replaces the four status panels: "Couldn't load privacy requests. Try refreshing." Ghost "Try again" button. Stat tiles also absent. Filter strip and sensitive-note rail remain visible if they loaded before the main query failed. |
| Contact details absent because caller lacks `canViewClientContactDetails` | Contact-detail line (email, phone) is absent from the rendered HTML — not hidden via CSS, not replaced with "hidden" placeholder copy. Silent omission per brief §5 and §6. |
| Filter combination returns zero requests | The matching status panels each show their section-level inline empty line ("No {status} requests."); the page-level `EmptyState` only renders when ALL four panels are empty. Ghost "Clear filters" CTA appears beneath the filter strip. |

## 7. Interaction Model

- Status update: `<form action={updatePrivacyRequestStatus}>` per row with `<input type="hidden" name="request_id">` and `<input type="hidden" name="status">` preserved verbatim (RECON §6.4 + §6.5). The existing `PrivacyStatusForm` client wrapper handles `ConfirmActionModal` for the two destructive transitions.
- Status form lives inside a `<details>` disclosure to keep panels scannable; expanded state persists across status migrations (the form reopens on the destination row if the operator wants to chain).
- Open client → `/admin/clients/<id>` (existing link, preserved verbatim).
- Filter strip submits via the surrounding GET form; URL persists deep-link state.
- Stat tile "Open requests" click → applies `status=received,reviewing` filter and scrolls to the Received panel.
- Stat tile "Awaiting longest" click → applies `status=received&sort=created_at_asc` and scrolls to the oldest row, which receives `:target`-style focus highlighting briefly (one frame, no animation).
- Keyboard: tab traversal through panels → rows → `<details>` triggers → form fields. The `<details>` disclosure handles native keyboard semantics.
- No drag-to-reorder, no inline edit on the request_note (note is the customer's words; immutable on this page).

## 8. Content Requirements

- Page title: "Privacy operations".
- Page eyebrow: "Privacy".
- Page description: "Track export, correction, deletion review, and sensitive-note review. Every status change is audit logged."
- Status panel headers: "Received" / "Reviewing" / "Completed" / "Declined".
- Stat tile labels: "Open requests" / "Awaiting longest" / "Sensitive notes reviewed this month".
- Page-level empty: "No privacy requests yet. Create one from a client detail page when a customer asks for export, correction, deletion review, or sensitive-note review."
- Section-level empty (each status): "No {status} requests."
- Sensitive-note empty: "No sensitive notes in the last 25 client records."
- Sensitive-note panel description: "These notes don't enter exports or operational logs. Open the client to edit."
- Confirm modals (Complete / Decline): copy as in §6 Key States.
- Success toast: "Request marked {status}."
- Failure toast: "Couldn't update request. Try again."
- No raw permission identifiers on the live surface (current `page.tsx:73` leaks `manage_privacy_operations or manage_sensitive_client_notes`).

## 9. Recommended References

- Brief 01 (`00-shared-components`) → `ConfirmActionModal`, EmptyState, AdminSheet, AdminStat, status family vocabulary.
- Brief 12 (`account-password-requests`) → Approve/Reject confirmation pattern; the Complete/Decline modals on this page follow the same plain-English-summary convention.
- Brief 11 (`audit`) → cross-link grammar (a privacy operator often verifies an action by jumping to its audit row; cross-pattern stays consistent).
- DESIGN.md §2 → Status Families (Received → Attention; Reviewing → Pending; Completed → Confirmed; Declined → Cancelled).
- DESIGN.md §Admin-Specific Patterns → Search and Filter, Status Communication (confirmation destructive).
- BASELINE-CRITIQUE: legacy `AdminEmptyState` consolidation carry-forward (also flagged on `enquiries`). Soft fixes listed in §4.

## 10. Open Questions

1. **Default-collapse for Completed and Declined.** Closing history by default keeps the queue scannable, but a regulator audit may want the full surface visible at a glance. Proposal: keep default-collapsed; expose a URL param `expand=all` for audit walk-throughs (one click sets it, browser back undoes it). Phase 6 confirms.
2. **"Awaiting longest" tile semantics on an empty open queue.** When Received and Reviewing are both empty, the tile reads "0 days"; accurate but visually flat. Proposal: collapse the tile to a Confirmed-family "All caught up" chip in that case. Defer to Phase 6 polish.
3. **Sensitive-note feed lookback window.** Hard 25-row cap is the current behaviour. Should the feed expose a "load more" or a date-range filter? Proposal: defer. The feed is *review*, not *triage*; if the operator needs older notes, the client detail surface is the right entry.

## 11. Role variants

### Owner

Full surface. Holds both `manage_privacy_operations` and `manage_sensitive_client_notes`, plus `view_client_contact_details`. All four status panels visible. All filters active. Status form on every request. Contact-detail line under every client name. Sensitive-note rail populated. Confirm modals on Complete / Decline as specified.

### Admin (Practice Manager)

By default, PM holds neither privacy permission. The page falls through to the **Denied state** unless the Owner explicitly grants `manage_privacy_operations` and/or `manage_sensitive_client_notes` via the role template.

If PM holds **`manage_privacy_operations` only:** identical chrome to Owner on the request queue; sensitive-note rail hidden entirely (the right column collapses, request queue takes full width on `xl:`). No copy hints that the rail is hidden.

If PM holds **`manage_sensitive_client_notes` only:** request queue panels and stat tiles hide; sensitive-note rail becomes the primary surface (full-width on `xl:`). Page header description adapts: "Recent sensitive client notes for review. Open the client to edit."

If PM holds **both:** identical to Owner.

Contact-detail line visibility follows `view_client_contact_details` independently per the existing gate.

### Booking Coordinator

Coordinator holds neither permission by default. Collapse to the **Denied state**.

### Therapist

Therapist holds neither permission by default. Collapse to the **Denied state**.

### Denied state

`AdminAccessDenied` invoked when neither `manage_privacy_operations` nor `manage_sensitive_client_notes` is held:

- Title: "Privacy operations restricted"
- Body: "Customer privacy requests and sensitive-note review are restricted to staff with explicit privacy authority. Ask the owner if you need access."
- No raw `manage_privacy_operations or manage_sensitive_client_notes` permission identifier on screen (current `page.tsx:73` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

---

## Recipe Context

- **RECON §2 inventory row:** Privacy — `src/app/admin/privacy/page.tsx` (+ `PrivacyStatusForm.tsx`) — `/admin/privacy` — GDPR triage + sensitive-note review.
- **Access gate (RECON §3):** `hasPermission(profile, PERMISSIONS.MANAGE_PRIVACY_OPERATIONS) || canManageSensitiveClientNotes(profile)`. Owner holds both by default; Admin/PM and below hold neither unless granted via role template.
- **Untouchable backend (RECON §5):** `updatePrivacyRequestStatus` server action at `src/app/admin/privacy/actions.ts` (explicit DO-NOT-TOUCH). Creation of privacy requests happens via `requestClientPrivacyAction` on the client detail page; never on this page. Sensitive-note writes also live on the client detail page.
- **Preserved IDs / form names (RECON §6.4):** `<input type="hidden" name="request_id">` and `<input type="hidden" name="status">` on every status form, preserved verbatim. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** Currently none. The redesign **adds** GET params `request_type`, `status`, `from`, `to`, `q`, plus optional `sort=created_at_asc` and `expand=all`; all additive, no rename.
- **Permission-derived data shape (RECON §6):** `canViewClientContactDetails` toggles the `email, phone` columns on the clients query. Preserved verbatim; the redesign only changes whether the contact-detail line renders, not the query shape.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** legacy `AdminEmptyState` → shared `EmptyState` consolidation (also flagged on `enquiries`). Soft fixes: raw `var(--rahma-*)` token escapes throughout, raw `bg-white` on the request `<article>` at `page.tsx:180`, raw permission identifier on `AdminAccessDenied` at `page.tsx:73`, bare `<p>` empty on sensitive-note panel at `page.tsx:150`.
- **IMAGES-NEEDED additions:** `privacy-empty.svg` (clipboard-with-shield, ~80–120px) for the page-level `EmptyState`. Append row in Phase 6.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Four status panels render in fixed order; Received + Reviewing expanded, Completed + Declined collapsed; `expand=all` URL param overrides defaults.
  - Status update round-trip: row migrates to destination panel without a full reload; audit log row written per mutation; rollback works when the server action errors.
  - `ConfirmActionModal` fires on Completed and Declined transitions only; modal copy reflects §6 verbatim; cancelling leaves status unchanged.
  - Filter contract: every combination produces a URL with the documented param names; deep-link survives a reload; stat-tile click applies the right filter and scrolls.
  - Contact-detail gate: confirm with two profiles (with/without `view_client_contact_details`) that the contact line renders or omits without any "hidden" copy hint.
  - Role pass: Owner / PM-with-neither / PM-with-privacy-only / PM-with-notes-only / PM-with-both / Coordinator / Therapist; confirm surface composition matches §11.
  - A11y pass: `AdminAccessDenied` no longer renders the raw permission string; status panel headers H3 contiguous under page H1; `<details>` disclosures keyboard-operable; mobile `AdminSheet` traps focus; confirm modal focus returns to the trigger on close.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Encouraging empty states; specific errors; no raw permission names.

### Form labels

**Per-row `PrivacyStatusForm` (preserved from RECON §6.4):**
- `request_id` (hidden).
- `Status *` (`name="status"`, select). Options: `Received`, `Reviewing`, `Completed`, `Declined`. Required marker (`*`) in Cancelled text colour with `aria-hidden="true"`.

**Filter strip:**
- `Request type` (`name="request_type"`, multi-select). Default `All types`. Options: `Data export`, `Correction`, `Deletion review`, `Sensitive note review`.
- `Status` (`name="status"`, multi-select). Default `All statuses`.
- `Date range` chips — `Today`, `This week`, `This month`, `Custom` (reveals `From`/`To`).
- `Search` (`name="q"`) — placeholder `Search request notes`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Filter apply | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filters` (with count) | Ghost |
| Mobile filter sheet apply | `Apply filters` | Primary |
| Per-row update-status disclosure | `Update status` (chevron) | Ghost |
| Per-row status submit (within form) | `Save status` | Primary |
| Per-row link to client | `Open client` | Ghost (link) |
| Sensitive-note row CTA | `Open client →` | Ghost (link) |
| Confirm modal — complete | `Mark completed` | Primary |
| Confirm modal — decline | `Decline` | Destructive |
| Confirm modal — cancel | `Cancel` | Secondary |
| Show-more on long request_note | `Show more` / `Show less` | Ghost |
| Section disclosure (Completed/Declined) | `Show {N}` / `Hide {N}` | Ghost (chevron) |
| Stat-tile filter shortcuts (click on tile) | (no visible button) | — |
| Load failure retry | `Try again` | Ghost |

### Error messages

- Status submit failure: `Couldn't update the request. Try again.` (toast, persistent, Retry)
- Concurrent edit (someone else already moved this): `That request was just updated by {actor}. Refresh to see the latest.`
- Filter date range invalid: `End date has to be after the start date.`
- Search query too short (<3 chars): `Type at least 3 characters to search.`
- Reviewer-note input on Complete/Decline (when added in future): blank on decline — `Add a note before declining. The customer keeps the right to ask for the reason.`
- Permission revoked mid-session: `Your access has changed. Refresh to continue.` (toast, persistent)
- Page load failure: `Couldn't load privacy requests. Try refreshing.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Page-level empty (no requests anywhere) | `No privacy requests yet` | `Create one from a client detail page when a customer asks for export, correction, deletion review, or sensitive-note review.` | — |
| Section empty (Received) | `No received requests` (inline) | `New customer requests appear here.` | — |
| Section empty (Reviewing) | `No requests being reviewed` (inline) | — | — |
| Section empty (Completed) | `No completed requests yet` (inline) | — | — |
| Section empty (Declined) | `No declined requests` (inline) | — | — |
| Filtered to empty | `No requests match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Sensitive-note rail empty | (no heading) | `No sensitive notes in the last 25 client records.` | — |
| Denied | `Privacy operations restricted` | `Customer privacy requests and sensitive-note review are restricted to staff with explicit privacy authority. Ask the owner if you need access.` | `Back to dashboard` |

### Tooltip text

- Request-type chip on row: native `title` shows the full type label — `Data export request`, `Correction request`, `Deletion review request`, `Sensitive note review request`.
- Status badge: native `title` shows the last actor + time — `Marked reviewing by Aisha on 11 May`.
- Relative time on row: native `title` shows absolute time — `Received 12 May 2026, 09:42 BST`.
- Request-note well "Show more" Ghost: `Expand to read the full note`.
- "Update status" `<details>` chevron: `Open the status form for this request`.
- Stat tile "Awaiting longest": native `title` shows the request — `Oldest open request: {first 8 chars of id} from {client name}`.
- Stat tile "Open requests": `Filter to open requests`.
- Stat tile "Sensitive notes reviewed this month": `Click to filter` (target behavior not yet defined in §7 — see open question above).
- Sensitive-note row pictogram: `Sensitive note — not in exports`.
- Reviewer-note input (if surfaced inline): `Visible to the customer in the response email.`
- Client-name link on a request row: `Open this client's profile`.

### Confirmation dialog text

**Mark completed**
- Heading: `Mark request as completed?`
- Body: `Confirm you've reviewed booking and audit-log integrity before finalising deletion or anonymisation. The customer will get a confirmation email.`
- Primary: `Mark completed`
- Secondary: `Cancel`

**Decline**
- Heading: `Decline this request?`
- Body: `The customer keeps the right to escalate to the ICO. Make sure the reason is recorded in the request note or client notes.`
- Destructive: `Decline`
- Secondary: `Cancel`

No confirmation on transitions to Received or Reviewing (they're reversible and non-finalising).

**Toasts**
- Status change success: `Request marked {status}.` (e.g. `Request marked completed.`)
- Status change failure: `Couldn't update the request. Try again.` (persistent, Retry)
- Filter applied: no toast — list re-render is the feedback.

