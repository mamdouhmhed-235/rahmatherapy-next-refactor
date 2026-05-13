# Brief: audit

## 1. Feature Summary

`/admin/audit` is the Owner-only read-only timeline of every administrative mutation in the system. Each row in `audit_logs` records an action type (43 distinct types per RECON §6.2 plus the 4 new password-reset action types from Brief 10), the staff member who acted, the target row, and a JSON snapshot of `before_state` + `after_state`. The current implementation reads the top 100 events and renders them as `AdminPanel` cards with badges and a key-summary `<dl>`. The redesign keeps the page's nature (calm, read-only, incident-response surface) and adds three things the current page lacks: **filtering** (by actor, action type family, date range, target type), **search by target ID** for incident response ("what happened to booking `1d503d3b-…`?"), and **a sensitive-key indicator** that makes the existing regex-based redaction (RECON §6.2) visible to the Owner as a deliberate system behaviour rather than a silent omission. The existing redaction regex is preserved verbatim; the Owner never sees the unredacted payload, even though they hold every permission. This is intentional: the audit log is *evidence*, and evidence the Owner cannot tamper with at read time is more valuable than evidence they can.

## 2. Primary User Action

**Find what happened: scroll the recent timeline, or filter / search to the specific row, then read the before-and-after JSON for that one event without leaving the page.**

## 3. Design Direction

**Colour strategy:** Restrained. The audit log is forensic; calm canvas, plain typography, no chrome that draws attention away from the data. Status families appear only where action *type* meaningfully maps to a state: destructive actions (cancel / delete / deactivate) carry a small Cancelled-family chip on the row; routine state changes carry a Pending-family chip; creation events carry a Confirmed-family chip. Everything else is the system's neutral type ramp on the warm ivory canvas. No Cormorant numerals (this is not a stats surface). No gold (decoration is wrong here). No marquee elements.

**Theme scene sentence:** *"Fatimah on her laptop on a Thursday evening at the kitchen table, trying to figure out who cancelled a booking that the client says they didn't cancel, working backward from a customer phone call ninety minutes ago."* Forces light mode, a layout that lets the eye scan timestamps and target IDs at speed, and copy that reads like a system log, not a marketing dashboard.

**Anchor references:**
- **GitHub's repository audit log** — dense, scannable rows, target IDs as first-class data, filterable by actor and action
- **Stripe Dashboard's "Events" log** — JSON before/after expansion inline on the row, monospace for IDs, plain English for action labels
- **Linear's "Activity" view on an issue** — relative timestamps with absolute on hover, actor avatars, action verbs in the present tense ("Fatimah confirmed booking #1d50…"), narrative voice without decoration

Anti-anchor: a "security dashboard" template with red banners, threat scores, and severity charts. The audit log is not a SIEM. It's a record.

## 4. Scope

Production-ready. Includes: filter strip (actor + action-type family + target type + date range), search by target ID (UUID prefix matching), redaction visibility chip, paginated load-more beyond the current top-100 limit (the existing top-100 is a UI default, not a contract; the underlying query supports larger result sets via the existing repository helper), per-row before/after JSON expansion via `<details>` (no modal), and copy-to-clipboard for the target ID and event ID. The 4 new password-reset audit action types from Brief 10 are mapped into the new action-type family taxonomy.

**Out of scope:** the redaction regex itself (untouchable per RECON §6.2; only its visibility on the row changes). The `audit_logs` schema (untouchable; no new columns proposed). The Sentry / log-pipeline integration (separate concern, RECON §5 untouchable). Bulk export of audit rows to CSV; Owner can already screenshot a row or copy JSON; CSV export of an evidence log is a policy decision deferred to a later phase.

## 5. Layout Strategy

**Page rhythm (top to bottom):**

1. **`AdminPageHeader`** — H1 "Audit log" (literal, no voice softening; this is a forensic surface; "Activity timeline" would underplay the role). Subtitle in Soft Slate Work Sans 400 label step: "Read-only record of every administrative action. Sensitive fields are always redacted." The subtitle does the work of making the redaction policy visible up front; the Owner never has to wonder why a payload reads `[redacted: health]`.

2. **Filter strip + search row** — single horizontal control bar at `surface-card` background, 1px `border-subtle`, 8px radius, padding `md`. Contents left to right:
   - **Search box** (240px wide, full-width on mobile): `<input>` with placeholder "Search by booking, client, staff, or event ID". Submits a GET form with `?q=` param. Server-side does prefix match on UUID columns (`target_id`, `actor_staff_id`, `id`).
   - **Actor select**: dropdown of all staff members who have ever written an audit row (server-side `SELECT DISTINCT actor_staff_id`). Default "Anyone".
   - **Action family select**: a curated taxonomy that groups the 43+ action types into 8 families (see §8 Content Requirements). Default "All actions".
   - **Target type select**: dropdown of distinct `target_type` values (`booking`, `client`, `staff`, `role`, `service`, `setting`, `enquiry`, `privacy_request`, `operational_event`, `email`, `password_reset`). Default "All targets".
   - **Date range**: same 5-preset chip pattern from Brief 06 (Today · This week · This month · Last 30 days · Custom). Default "Last 30 days" (not "Today"; audit is rarely about today; the Owner is usually investigating something from days back).
   - **"Clear" Ghost link** at the right end: clears all filters and the search box.

   Active filters render as Restricted-family dismissible chips beneath the strip (same chip pattern as Brief 04 bookings filters).

3. **Result count line** — single Work Sans 400 label step Soft Slate line between filter strip and timeline: "Showing 47 of 1,302 events." When unfiltered: "Showing 100 most recent events. Load more to see older entries."

4. **Timeline** — vertical stack of `AdminPanel` event cards, one per row, separated by `md` (16px) gap. Each card:
   - **Card top row** (horizontal): 32px actor avatar + actor name (Urbanist 500 title step) + action verb phrase (Work Sans 400 body step, e.g. "confirmed booking" or "cancelled assignment") + target chip (`mono` font for the truncated UUID, e.g. `booking 1d50…1358`) + relative timestamp right-aligned (Work Sans 500 label step, Soft Slate, e.g. "47 minutes ago"). The full ISO timestamp + Europe/London absolute time appears in a native `title` tooltip on hover.
   - **Action-family chip** (where applicable): single Confirmed / Pending / Cancelled / Restricted family chip beneath the top row. Routine state changes (e.g. `booking_quick_mark_paid`) get a Pending chip; destructive (`booking_quick_cancel`, `service_deleted`, `staff_member_deactivated`) get a Cancelled chip; creation (`client_created`, `staff_member_created`) get a Confirmed chip. Read-only events (e.g. `report_exported`) get a Restricted chip. Many events get no chip; the action label itself is the meaning.
   - **Redaction chip** (when the row's `before_state` or `after_state` contains any key matching the redaction regex `note|health|treatment|consent|token|secret|key|payload|body`): a small Restricted-family chip "Redacted: {N} field(s)" with a leading `lock` 12px icon. Hover reveals a `title` tooltip listing the redacted key names (the *keys* are visible; only the values are redacted). This makes the existing silent redaction visible.
   - **Expandable JSON block** — `<details>` element (closed by default). Summary line in Work Sans 500 label step: "Show before / after". When opened: a two-column `surface-page` well (steps down from `surface-card` per the Tonal Lift Rule) with `IBM Plex Mono` 0.875rem JSON pretty-print. Left column: "Before"; right column: "After". Redacted values render as `"[redacted]"` (no value, just the literal string). On mobile the two columns stack vertically.
   - **Per-card action row** (bottom): two Ghost links; "Copy event ID" (writes the audit row's `id` to clipboard via the Clipboard API with a Sonner toast "Copied event ID") and "Copy target ID" (the relevant UUID). No "Open target" link by default because target rows can be deleted (e.g. a deleted booking has no detail page to open); a Ghost "Open booking" / "Open client" / etc. *does* appear when the target type is one of `booking` / `client` / `staff` / `role` / `service` and the target row currently exists (server-side existence check). When the target is gone, a Soft Slate inline note replaces the link: "Target row no longer exists."

5. **Load more button** at the bottom of the timeline, Secondary Button style, full-width on mobile / max-width 240px on desktop. Loads the next 100 events appended to the existing list (no full reload). Hidden when the current view returns fewer than 100 results.

**Mobile rhythm (<768px):** Filter strip collapses behind a "Filter" Ghost button + active-count badge (same pattern as Brief 04). Search box stays full-width above the filter button. Date-range chip strip becomes horizontal momentum-scroll. Timeline cards stack single-column. JSON `<details>` expansions stack the Before/After columns vertically.

## 6. Key States

| State | What the user sees |
|---|---|
| Default (Owner, unfiltered) | Filter strip + "Last 30 days" preset active + result count "Showing 100 most recent events" + timeline of 100 cards + Load more button |
| Filter applied | Active chips beneath the filter strip + result count "Showing N of M events" + timeline filtered to N |
| Search submitted | Active "ID search" chip + result count + timeline of matching rows (typically 1–5 for a UUID prefix) |
| Filtered to empty | `EmptyState`: search illustration, "No events match", "Try adjusting or clearing your filters." Ghost "Clear filters" CTA |
| Unfiltered, system has zero audit rows (impossible in practice, but specced) | `EmptyState`: archive illustration, "No events yet", "Audit rows appear here as the team works in the admin." (No CTA; the Owner can't make events happen by clicking.) |
| Loading (filter submit / Load more) | `AdminSkeleton` event-card placeholders; filter strip remains stable; result count shows "…" |
| Error loading rows | Inline Cancelled-family `role="alert" aria-live="polite"` region in place of the timeline: "Couldn't load audit log. Try refreshing." Ghost "Try again" button. Filter strip remains usable. |
| Row card with no redacted keys | Card renders without the redaction chip; JSON expansion shows full values |
| Row card with redacted keys | Redaction chip "Redacted: {N} field(s)" beneath the action-family chip; expansion shows `"[redacted]"` in place of the value |
| Row card whose target was deleted | Bottom-action row shows "Target row no longer exists." in Soft Slate; no "Open target" link |
| Row card with `before_state: null` (creation event) | JSON expansion shows only the "After" column; "Before" column header reads "Before: (created)" |
| Row card with `after_state: null` (deletion event) | JSON expansion shows only the "Before" column; "After" column header reads "After: (deleted)" |
| JSON expansion open on mobile | Before and After columns stack vertically with a 1px `border-subtle` divider between them |
| Mobile filter sheet open | `AdminSheet` from bottom with all filter fields; "Apply" Primary + "Clear" Ghost |
| Owner copying an event/target ID | Sonner toast top-right (desktop) / top-centre (mobile): "Copied event ID" or "Copied target ID"; auto-dismiss 4s |

### Backend error states (Layer 3 — for Phase 6 `/impeccable harden`)

| State | What the user sees |
|---|---|
| Search query fewer than 4 characters submitted | No server request made; inline note below the search input: "Type at least 4 characters of an ID." Filter strip remains stable |
| Filter query returns DB timeout (large date range + no other filters) | Inline Cancelled-family `role="alert"` region replacing the timeline: "Couldn't load audit log. Try refreshing." Ghost "Try again". Filter strip remains usable |
| Load-more cursor points to a deleted row | Load-more continues from the nearest surviving row; no error surfaced to the user |
| Actor filter UUID is malformed | Server treats it as "anyone" (ignores the filter); no DB error surfaced; results show all actors |

## 7. Interaction Model

- **Search.** GET form submission on Enter or "Apply" tap. URL becomes `/admin/audit?q=…`; deep-linkable. Server-side: prefix-match on `target_id` (UUID), `actor_staff_id` (UUID), `id` (UUID). 4+ character minimum; below that, results aren't filtered (avoids accidental "match-everything" on a stray character).
- **Filters.** Every change submits the form (no client-side filtering; these are GET params for deep-linkability). The form submits with debounce on select changes (220ms) so a user changing multiple filters in a row doesn't trigger multiple submissions.
- **Date range.** Preset chips submit instantly. "Custom" reveals `from` + `to` date inputs inline on desktop, in the filter sheet on mobile.
- **Per-row `<details>` expansion.** Native HTML `<details>` element with a custom-styled `<summary>`. Open/closed state lives entirely in the DOM (no server state). Honours `prefers-reduced-motion`; instant when reduced; 240ms `ease-gentle` `grid-template-rows: 0fr → 1fr` transition otherwise (same trick as Brief 06).
- **Clipboard.** "Copy event ID" / "Copy target ID" use `navigator.clipboard.writeText()`. On the rare browser that lacks it (corporate locked-down environments), the click renders an inline Soft Slate fallback showing the ID as `<code>` for manual copy.
- **Load more.** Server action returns the next page; client appends without scroll jump. The button rotates from "Load more" to "Loading…" with `aria-busy="true"`. After the last page, the button is replaced by a Soft Slate line: "End of audit log."
- **Keyboard.** Tab order: search box → actor select → action-family select → target-type select → date-range chips left-to-right → "Clear" link → first event card's `<details>` summary → first event card's "Copy event ID" → "Copy target ID" → "Open target" (if present) → next card. JSON expansion `<details>` toggle is Space/Enter.
- **`@media print`.** DESIGN.md §6 Admin-Specific Patterns "Print Considerations" applies if Owner prints the page for incident records: filter strip hidden, `<details>` forced open (`details[open]` default, and the print stylesheet sets `details { display: block } summary { display: none }`), `break-inside: avoid` on each card.

## 8. Content Requirements

**Headings.**
- H1: "Audit log"
- H2 (per event card, via the actor + action top row): rendered as `<h2>` with `sr-only` text for screen readers (the visual top row reads as a sentence; the H2 ensures heading nav works). Example: `<h2 class="sr-only">Fatimah confirmed booking 1d50…1358 about 47 minutes ago</h2>`.

**Action-family taxonomy (8 families).** The full list of action types from RECON §6.2 + the 4 password-reset additions from Brief 10 maps as follows. Implementer caches this mapping in a colocated helper:

| Family | Chip family | Example action types |
|---|---|---|
| Bookings & assignments | Pending (state change) / Cancelled (cancel) / Confirmed (create) per action | `booking_management_updated`, `booking_quick_confirm`, `booking_quick_mark_paid`, `booking_quick_cancel`, `booking_quick_complete`, `booking_assignment_claimed`, `booking_assignment_unassigned`, `booking_assignment_reassigned`, `booking_assignment_completed`, `booking_assignment_no_show`, `manual_admin_booking_created`, `enquiry_converted_to_booking` |
| Clients & enquiries | per action | `client_created`, `client_updated`, `client_note_added`, `client_privacy_request_created`, `client_privacy_request_status_updated`, `enquiry_created`, `enquiry_status_updated` |
| Staff & roles | per action | `staff_member_created`, `staff_profile_updated`, `staff_role_assigned`, `staff_availability_rules_updated`, `staff_permission_overrides_updated`, `role_created`, `role_metadata_updated`, `role_permission_toggled` |
| Services & settings | per action | `service_created`, `service_updated`, `service_archived`, `service_restored`, `service_deleted`, `business_settings_updated` |
| Availability | per action | `availability_rule_created`, `availability_rule_updated`, `availability_rule_deleted`, `blocked_date_created`, `blocked_date_deleted`, `availability_override_upserted`, `availability_override_deleted` |
| Operations & email | per action | `operational_event_status_updated`, `manual_booking_reminder_sent` |
| Reports & exports | Restricted (read) | `report_exported` |
| Account security | Restricted | `password_reset_requested`, `password_reset_request_lookup_failed`, `password_reset_completed`, `password_reset_token_rejected` |

**Action verb phrases** (rendered in the card top row, derived server-side from `action_type`).

| Raw `action_type` | Rendered phrase |
|---|---|
| `booking_quick_confirm` | "confirmed booking" |
| `booking_quick_cancel` | "cancelled booking" |
| `booking_quick_mark_paid` | "marked booking paid" |
| `booking_assignment_claimed` | "claimed assignment for booking" |
| `client_note_added` | "added a note to client" |
| `service_deleted` | "deleted service" |
| `role_permission_toggled` | "toggled permission on role" |
| `report_exported` | "exported report" |
| `password_reset_completed` | "completed password reset" |
| `password_reset_request_lookup_failed` | "submitted a password-reset request (no matching account)" |

Implementer ships a complete map for every action type as part of the colocated helper. Voice: plain present-tense verbs ("confirmed", "cancelled", "added"). Never "performed action X on entity Y." Never "system event." Never machine-translation tone.

**Empty state copy.**

| State | Heading | Body | CTA |
|---|---|---|---|
| Filtered to empty | "No events match" | "Try adjusting or clearing your filters." | Ghost "Clear filters" |
| Unfiltered, no rows at all | "No events yet" | "Audit rows appear here as the team works in the admin." | (no CTA) |
| Search returns nothing | "Nothing matches that ID" | "Check the ID and try again." | Ghost "Clear search" |

**Microcopy.**
- Subtitle (page H1): "Read-only record of every administrative action. Sensitive fields are always redacted."
- Redaction chip label: "Redacted: {N} field(s)"; singular handled at N=1 ("Redacted: 1 field")
- Redaction chip tooltip (`title`): "Hidden: note, health, treatment_notes" (comma-separated list of the matched keys)
- Result count, filtered: "Showing {N} of {M} events."
- Result count, unfiltered: "Showing 100 most recent events. Load more to see older entries."
- Relative timestamp: Intl.RelativeTimeFormat in en-GB ("47 minutes ago", "3 days ago", "about a month ago")
- Absolute timestamp on hover (`title`): "12 May 2026, 19:42 BST"
- "Copy event ID" toast: "Copied event ID"
- "Copy target ID" toast: "Copied target ID"
- "End of audit log" line (after Load more exhausts): "End of audit log."
- Target deleted line: "Target row no longer exists."

**Voice anchors hit.** PRODUCT.md "real names" (the target is `booking 1d50…1358`, not "entity #1"). "verbs over nouns" (action verb phrases). State-word discipline on chips. The audit page is the *one place* on the admin where the voice is allowed to be slightly system-y (this is a system log, after all) without breaking PRODUCT.md's voice anchors; "completed password reset" is a verb-phrase that names what happened, even though it has the cadence of an event log.

## 9. Recommended References

- **`reference/copywriting.md`** — for the action-verb-phrase taxonomy; voice consistency across 47 distinct action types is the bulk of the QA work at Phase 7 Gate 2.
- **`reference/interaction-design.md`** — for the deep-linkable filter GET-form contract and the `<details>` expansion mechanics.
- **`reference/spatial-design.md`** — for the timeline rhythm; consistent card spacing matters more than density on an investigation surface.

## 10. Open Questions

1. **Search index.** UUID prefix matching is fine for small datasets (current top-100). Once the audit table grows past ~10K rows, a Postgres trigram index on `target_id::text` and `actor_staff_id::text` is the right move. Flag for Phase 6 owner; not a brief commitment because it's a DB concern.
2. **Pagination strategy.** "Load more" appends pages. After 10 page-loads (1,000 rows) on a single session the DOM gets heavy. Recommendation: at row 1,000 the Load more button switches to a "Search for older events" CTA that opens the filter sheet pre-focused on the date range. Implementer can defer this until real-world telemetry shows it's needed.
3. **Action-family chip on routine bookkeeping.** The current spec assigns Pending family to "routine state changes" like `booking_quick_mark_paid`. A counter-argument: marking a payment received is a positive event and could earn Confirmed family. **Current call:** Pending for *state transitions*, Confirmed for *creations only*. Revisit if Phase 7 testing shows Owners read the chips inconsistently.
4. **"Open target" Ghost on rows whose target was deleted.** This brief specifies a server-side existence check. That's a per-row DB lookup, which could add 100 queries to a default page render. Mitigation: a single batch lookup keyed by target_type + a list of target_ids. Implementer details.
5. **Should `report_exported` show *which* report was exported?** Currently `action_type` distinguishes only `report_exported`; the specific report (e.g. revenue, services, staff workload) lives in `after_state.report` per the CSV export action helper. Brief commits: the action-verb phrase reads "exported report" and the `<details>` expansion shows the report name in the JSON. Adequate.
6. **CSV export of the audit log itself.** Deliberately out of scope (see §4). If Phase 7 testing shows incident-response workflows are bottlenecked by screenshot/copy-paste, revisit in a later phase as a separate feature.

---

## 11. Role variants

`/admin/audit` is gated on `manage_audit_logs`, which the RBAC matrix grants to **Owner only**. Per the command instruction, this section collapses to a single role + the denied state.

### Owner / Main Admin

**What is visible.** Everything in §5: filter strip + search + result count + timeline + Load more. All 8 action families. All sensitive-key redactions render with the redaction chip and the `[redacted]` placeholder in JSON expansions; the Owner does *not* see unredacted payloads even though they hold every permission. The "Open target" Ghost link appears on rows whose target row still exists. "Copy event ID" + "Copy target ID" available on every row.

**What is hidden.** Unredacted sensitive values. The raw `encrypted_payload` from password-reset rows (always renders as `[redacted: payload]`). Stack traces or Sentry error payloads on internal action types (none exist in `audit_logs` today, but a future addition would also be redacted by the existing regex; `key|secret|token` covers most). The redaction chip itself makes this hiding *legible*; the Owner can see *that* a value was hidden and *which key* was hidden, just not the value. This is the brief's central forensic-trust design choice: read-time tamper-resistance > read-time omniscience.

**Role-specific copy.** None; there is no other role on this surface, so no need to soften or scope the language. The subtitle "Read-only record of every administrative action. Sensitive fields are always redacted." is the canonical voice and does not change.

**Role-specific actions.** None. Every action on this page (search, filter, expand, copy, load more) is available identically to the Owner. There is no "delete row" or "edit row" affordance; `audit_logs` is append-only by design.

### Denied state

**Who lands here.** Anyone reaching `/admin/audit` without `manage_audit_logs`. Per the current RBAC matrix that is: Admin / Practice Manager, Booking Coordinator, Therapist, and any custom role without the permission. The middleware redirects unauthenticated users to `/admin/login` before this page renders, so the denied state is only seen by *authenticated staff without permission*.

**What is visible.** The shared admin shell (top nav, role indicator) renders normally. The page body renders the standard `AdminAccessDenied` component per `00-shared-components-brief.md`: illustrated `EmptyState` with the lock-icon empty-state illustration, heading "You don't have access to this section.", body "Audit access is restricted to the practice owner. Contact the owner if you think this is a mistake.", Secondary "Back to dashboard" button → `/admin/dashboard`.

**What is hidden.** The filter strip, search, timeline, and every row. Not a single audit-row preview leaks; the server short-circuits the data fetch when `manage_audit_logs` fails. The page title in the browser tab reads "Access denied · Rahma" rather than "Audit log · Rahma" so the tab doesn't suggest the user is partway into the audit surface.

**Role-specific copy.** The denied-state body is **slightly more specific** here than the generic shared denied copy from `00-shared-components-brief.md`: it names *why* this surface is restricted ("Audit access is restricted to the practice owner") because the audit log is the one surface where the role-restriction reason is itself useful (it tells the user "this isn't a permissions bug; it's a deliberate policy"). Other denied surfaces use the generic copy.

**Role-specific actions.** "Back to dashboard" Secondary button (always present on `AdminAccessDenied`). No "Request access" affordance; for this surface specifically, the Owner is the only person who can grant the permission, and an in-app "Request access" button on an evidence-tamper-resistant surface would be a strange affordance. The user contacts the Owner out-of-band.

---

**Carry-forwards this brief logs for Phase 6 implementation:**
- New action-verb-phrase helper (colocated, e.g. `src/app/admin/audit/format.ts`) mapping every action type to a present-tense verb phrase. Includes the 4 new password-reset action types from Brief 10.
- New action-family taxonomy helper (8 families) mapping raw `action_type` → family chip family.
- New filter contract: GET params `q` (search), `actor` (UUID), `family` (taxonomy key), `target_type` (enum), `range` / `from` / `to`. Add to RECON §6.5 URL contract.
- New redaction-visibility helper: given a `before_state` / `after_state` JSON blob, returns the list of redacted top-level keys. Uses the existing regex from RECON §6.2 verbatim.
- New `auditLoadMore` server action that returns the next page of rows from the underlying repository.
- Target-existence batch lookup helper for the "Open target" Ghost link.
- DESIGN.md §6 print-stylesheet additions (already specced there).
- No mutation server actions (audit is read-only); no audit-log writes from this page.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/audit/page.tsx` | Replace the current top-100 list render with the new filter strip + search + result count + paginated timeline + Load more. Server component reads filter/search GET params and queries the audit repository helper accordingly. Preserves the `manage_audit_logs` permission gate at the top; renders `AdminAccessDenied` for anyone without it. |
| `src/app/admin/audit/format.ts` *(net-new)* | Action-verb-phrase map (every `action_type` → present-tense verb phrase) and action-family taxonomy map (every `action_type` → family chip family, one of 8 families). Includes the 4 new password-reset action types from Brief 10. |
| `src/app/admin/audit/redaction.ts` *(net-new)* | Pure helper: given a `before_state` / `after_state` JSON blob, returns `{ keysHidden: string[], count: number }`. Uses the existing regex `note|health|treatment|consent|token|secret|key|payload|body` from RECON §6.2 verbatim. Does NOT mutate the redaction policy; only surfaces it. |
| `src/app/admin/audit/actions.ts` *(net-new)* | New server action `auditLoadMore({ filters, cursor }: …): Promise<AuditPage>` that calls the existing repository helper with a paging cursor. No mutations; this file exists for the Load more server action only. |
| `src/app/admin/audit/AuditFilterStrip.tsx` *(net-new)* | Client component for the filter strip + search box + date-range chips. Mobile collapse to "Filter" Ghost button + `AdminSheet`. GET-form submission per filter contract. |
| `src/app/admin/audit/AuditEventCard.tsx` *(net-new)* | Server component for each timeline card: actor avatar + verb phrase + target chip + relative timestamp + action-family chip + redaction chip + `<details>` JSON expansion + Copy IDs + conditional "Open target". |
| `src/app/admin/audit/AuditLoadMoreButton.tsx` *(net-new)* | Client component for the Load more button, calls `auditLoadMore` and appends results. |

### Files to NEVER touch

- `src/lib/auth/**` — `manage_audit_logs` permission resolution stays as-is (RECON §5)
- `src/lib/supabase/**` — client factories
- `src/middleware.ts`
- `supabase/migrations/**` — `audit_logs` schema is untouchable; no new columns proposed by this brief
- The existing audit-log repository helper (whichever file in `src/lib/` owns `getRecentAuditLogs` or equivalent); this brief adds a cursor-paged variant alongside but does not modify the existing helper. Phase 6 owner picks the file location for the extension.
- The redaction regex at RECON §6.2 — preserved character-for-character. This brief surfaces the regex's behaviour; it does not change which keys it matches.
- All build/config files

### Feature Preservation Manifest

**Permission gate (RECON §2):** `manage_audit_logs` (Owner only). The page MUST render `AdminAccessDenied` for any authenticated staff member without this permission. Middleware redirects unauthenticated users to `/admin/login` upstream.

**Redaction regex (RECON §6.2):** `note|health|treatment|consent|token|secret|key|payload|body`. Preserve verbatim. Every value matching this regex on a top-level key in `before_state` or `after_state` renders as `"[redacted]"` in the JSON expansion. The key name itself remains visible (it's what powers the redaction chip).

**Audit log writes from this page:** **None.** Audit is append-only and read-only at the UI layer. No row in `audit_logs` is written by anything on `/admin/audit`. Visiting the page is not itself an audit event.

**JS hooks / IDs to preserve (RECON §6.4):**
- `id="admin-main"` skip-link target
- `id="admin-command-search"` (cmd-K palette, in shared top nav, not duplicated here)

**External / deep links to preserve (RECON §6.5):**
- POST `/admin/signout` (shared top nav)
- New deep-link targets the brief adds: `/admin/audit?q=…&actor=…&family=…&target_type=…&range=…&from=…&to=…`; every filter combination must be reachable by URL alone.
- Conditional "Open target" Ghost links route to: `/admin/bookings/<id>`, `/admin/clients/<id>`, `/admin/staff/<id>`, `/admin/roles/<id>`, `/admin/services` (services don't have detail pages — the link goes to the list). Other target types render no link.

**No filter form `name` attributes inherited; all filter names defined in this brief:** `q`, `actor`, `family`, `target_type`, `range`, `from`, `to`. (None of these were in RECON §2 because the current audit page has no filter form.)

### Information hierarchy (top to bottom)

1. Page identity + redaction policy disclosure (H1 + subtitle, sets forensic tone)
2. Filter strip + search (control over what's visible)
3. Result count (always-visible context for the timeline below)
4. Timeline (the rows themselves; the page's primary content)
5. Load more (pagination)

### Design direction, tokens and components

- **H1 "Audit log":** Urbanist 600 display step, Chronicle.
- **Subtitle:** Work Sans 400 label step, Soft Slate.
- **Filter strip container:** `surface-card` (`oklch(99.2% 0.004 88)`); 1px `border-subtle`; 8px radius; padding `md`.
- **Search input:** DESIGN.md §5 Input spec (`surface-input` ground, `border-default` Form Seam, 6px radius).
- **Filter selects:** DESIGN.md §5 Input spec, treated as `<select>` with native chrome restyled to match.
- **Date-range chip strip:** identical to Brief 06 chip pattern; "Last 30 days" default-active.
- **Active filter chips (below the strip):** Restricted family pair (`status-restricted-bg` / `status-restricted-text`); pill shape; trailing `x` 12px to dismiss.
- **Event card:** `AdminPanel` at `surface-card`; 8px radius; 1px `border-subtle`; padding `md`; `md` (16px) gap between cards.
- **Actor avatar:** 32px circle, deterministic-tint utility from Brief 06.
- **Actor name:** Urbanist 500 title step, Chronicle.
- **Verb phrase:** Work Sans 400 body step, Practice Charcoal.
- **Target chip:** IBM Plex Mono 0.75rem (label step in mono), `surface-page` background, 1px `border-subtle`, 4px radius, 2px×8px padding; format `target_type 1d50…1358`.
- **Relative timestamp:** Work Sans 500 label step, Soft Slate, right-aligned, with `title` attribute for absolute on hover.
- **Action-family chip:** DESIGN.md §5 AdminStatusBadge spec; Confirmed / Pending / Cancelled / Restricted per family.
- **Redaction chip:** Restricted family pair; leading `lock` 12px Lucide; "Redacted: {N} field(s)" copy; `title` tooltip lists redacted key names.
- **JSON `<details>` summary:** Work Sans 500 label step "Show before / after"; leading `chevron-right` that rotates 90° on open (transform only, not layout — honours the motion law).
- **JSON well (open `<details>`):** `surface-page` background (steps down from card); 8px radius; 1px `border-subtle`; padding `md`; two columns at ≥768px, stacked vertically below.
- **JSON pretty-print:** IBM Plex Mono 0.875rem; Chronicle on `surface-page`; `[redacted]` literal in Soft Slate italics.
- **"Copy event ID" / "Copy target ID" Ghost links:** Practice Charcoal text, Hover Moss hover fill, Focus Azure focus ring.
- **"Open target" Ghost link:** Same Ghost style, leading `external-link` 12px; only rendered when target exists.
- **"Target row no longer exists." line:** Soft Slate Work Sans 400 label step; replaces "Open target" when target is gone.
- **Load more Secondary button:** Secondary style per DESIGN.md §5; full-width mobile / max-width 240px desktop.
- **"End of audit log." line:** Soft Slate Work Sans 400 label step; replaces Load more after exhaustion.
- **Disclosure motion:** 240ms `ease-gentle` `grid-template-rows: 0fr → 1fr` transition; `prefers-reduced-motion: reduce` → instant.
- **Focus ring:** 3px Focus Azure (`oklch(47% 0.095 230)`) with 2px offset on every interactive element.
- **Sonner toast (copy feedback):** Confirmed family for the copy success toast; leading `check-circle` 16px; auto-dismiss 4s.
- **Skeleton:** `AdminSkeleton` event-card placeholders per state row; filter strip stays stable during load.

---

## Implementation Notes

Per-state intent lives in §6 Key States (above). Per-viewport intent lives in §5 Layout Strategy (above); desktop ≥1024px rhythm with explicit mobile <768px filter-sheet collapse and JSON column stack rules.

**Verification steps (for Phase 6 Step 6 verify):** Playwright + DevTools + `/impeccable audit` + `/impeccable critique`. Additional forensic-trust verification: confirm the redaction regex from RECON §6.2 is referenced verbatim by `redaction.ts` (string-equality check in the test suite); confirm no audit-log row is written when `/admin/audit` is loaded (Supabase inspector); confirm the page renders `AdminAccessDenied` for every authenticated role except Owner; confirm UUID prefix search redacts/clamps inputs below 4 characters.

---

## Copy

### Form labels

- Search input — visible label `Search by ID`; placeholder `Booking, client, staff, or event ID`.
- Actor select — visible label `Actor`; default option `Anyone`.
- Action family select — visible label `Action`; default option `All actions`.
- Target type select — visible label `Target`; default option `All targets`.
- Date range chip strip — group label `Range` (sr-only on desktop, visible on mobile sheet); chip values `Today`, `This week`, `This month`, `Last 30 days`, `Custom`.
- Custom range inputs — `From` / `To` (date pickers, visible labels).

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Filter strip clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filter` (with count badge when active) | Ghost |
| Mobile filter sheet apply | `Apply filters` | Secondary |
| Per-card JSON expand summary | `Show before / after` | Ghost (chevron) |
| Per-card copy event ID | `Copy event ID` | Ghost |
| Per-card copy target ID | `Copy target ID` | Ghost |
| Per-card open target | `Open booking` / `Open client` / `Open staff` / `Open role` / `Open services` | Ghost (variants per target type) |
| Pagination | `Load more` | Secondary |
| Empty-result reset | `Clear filters` / `Clear search` | Ghost |
| Load-error retry | `Try again` | Ghost |

### Error messages

- Search query too short: `Type at least 4 characters of an ID.` (inline beneath search input)
- Search returns nothing: `Nothing matches that ID. Check the ID and try again.`
- Filtered to empty: `No events match. Try adjusting or clearing your filters.`
- Server load failure: `Couldn't load audit log. Try refreshing the page.`
- Clipboard API unavailable (rare): `Your browser blocked clipboard access. Copy this ID manually:` followed by `<code>{id}</code>`.
- Date range invalid (`from` after `to`): `End date must come after the start date.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Filtered to empty | `No events match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Search returns nothing | `Nothing matches that ID` | `Check the ID and try again.` | `Clear search` |
| Unfiltered, no rows | `No events yet` | `Activity is recorded here as the team makes changes.` | — |
| Load-more exhausted | `End of audit log.` (inline line, not an EmptyState) | — | — |
| Target deleted (per-card line) | — | `Target row no longer exists.` | — |
| Denied (non-Owner) | `You don't have access to this section` | `Audit access is restricted to the practice owner. Contact the owner if you think this is a mistake.` | `Back to dashboard` |

### Tooltip text

| Surface | Tooltip |
|---|---|
| Relative timestamp on each card | (absolute, native `title`) `12 May 2026, 19:42 BST` |
| Redaction chip | (native `title` listing keys) `Redacted fields: note, health, treatment_notes` |
| Copy-event-ID Ghost | `Copy event ID to clipboard` |
| Copy-target-ID Ghost | `Copy target ID to clipboard` |
| Target chip (truncated UUID) | (native `title`) full UUID, e.g. `1d503d3b-b1dc-455c-8007-43c5ed1358b8` |
| Action-family chip | (native `title`) the raw `action_type`, e.g. `booking_quick_cancel` — for power-user investigation |

### Confirmation dialog text

This page mutates nothing. No `ConfirmActionModal` instances. No confirmations needed.

**Toasts**
- Copy event ID success: `Copied event ID.`
- Copy target ID success: `Copied target ID.`
- Clipboard failure: (no toast — inline fallback renders the ID as `<code>` for manual selection)
