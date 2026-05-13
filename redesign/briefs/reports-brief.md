# Shape Brief: `/admin/reports` redesign

**Date:** 2026-05-12
**Page slug:** `reports`
**Status:** user-confirmed
**Brief number:** 29 of 29 (Phase 5)

## 1. Feature Summary

The clinic's operational and financial mirror: how many bookings happened in a window, how many clients came back, where they came from, which services led, who carried the workload, and (when permitted) what was collected vs still outstanding. The page already serves four role scopes through one URL: Owner and PM see the full picture; Coordinator sees operational data minus revenue; Therapist sees only their own narrow slice as "My report." The redesign keeps the four-scope split, tightens the chart treatments to fix the Recharts size warnings flagged at baseline, regroups panels by question-being-answered rather than chart-vs-list, and rebuilds the CSV-export rail into a deliberate "what would you like to take with you" surface.

## 2. Primary User Action

**Pull one specific answer about a chosen window**, then optionally export it as CSV. The window starts at "this month, all staff, all sources" for admins and "this month, just me" for therapists; the operator narrows from there. Almost no one reads the whole page; the redesign optimises for "land, set range, see the relevant panel, possibly download."

## 3. Design Direction

Operational mirror, not a "metrics dashboard." Filter strip at top reads as a deliberate query builder; below it, three vertically grouped question sections (**Activity**, **Workload**, **Money**) replace the current chart-grid-then-list-grid-then-export-rail order. Each section opens with one heading + one short framing sentence. Charts shrink in visual weight: smaller heights (288px enforced minimum from BASELINE-CRITIQUE), Cormorant numerals on the four headline stat tiles only. The eight CSV exports get a single grouped panel near the bottom of each section's tail (revenue exports under Money, workload exports under Workload, etc.), not one undifferentiated rail of identical buttons.

## 4. Scope

In:
- Three-section vertical structure: **Activity** (bookings + sources + clients), **Workload** (staff workload, service performance), **Money** (revenue chart, collected vs outstanding, staff revenue attribution); Money entirely hidden when `revenueAllowed === false`.
- Filter strip rebuilt: range select + From / To date inputs + staff combobox + source select + payment select + Secondary "Apply" + Ghost "Clear filters" when active. Active filter chips below the strip. All existing GET params preserved verbatim (RECON §6.5: `range`, `from`, `to`, `staffId`, `source`, `paymentStatus`).
- Recharts containers gain `minHeight: 288` (BASELINE-CRITIQUE P1 carry-forward; resolves the 6 Recharts warnings flagged in Phase 0).
- Headline stat strip: 2 tiles when `revenueAllowed === false` ("Bookings", "Repeat clients"), 4 tiles when true (adds "Collected revenue", "Outstanding"). Outstanding tile uses the Attention family tint when > 0, matching the existing `alert={summary.outstandingRevenue > 0}` toggle.
- Service performance / Staff workload / Staff revenue panels: keep the existing row composition (label + value) but restyle the row backgrounds from `bg-[var(--rahma-ivory)]/70` rounded boxes (token escape) to `AdminEntityRow`-style rows on `surface-page` with proper borders. Hard `slice(0, 8)` becomes "Show all →" Ghost expanding inside a `<details>`.
- CSV export grouping: split the current eight-button rail into per-section sub-panels:
  - **Activity exports** (3): Client summary / Booking list / Source-channel.
  - **Workload exports** (2): Staff workload / Service performance.
  - **Money exports** (3, gated on revenue): Revenue summary / Payment report / Staff revenue attribution.
- "Export CSV" Primary in the page header retires (it currently re-exports `revenue_summary` regardless of which panel the operator is reading); replaced with the per-section grouped panels below.
- Metric definitions panel kept but restyled; definitions become an `<details>`-collapsed expandable per metric, surfaced inside an `AdminPanel` at the page bottom titled "How these numbers are calculated."
- Carry-forward soft fixes: raw `var(--rahma-*)` token escapes throughout, `bg-white` + raw input chrome on the filter strip, `bg-[var(--rahma-ivory)]/70` on row containers (lines 234, 203), `uppercase tracking-wide` on field labels (line 219; DESIGN.md says no uppercase shouting on data headers), raw permission identifier on the denied screen (line 248).

Out (unchanged):
- `getReportData`, `getRevenueSeries`, `getServicePerformance`, `getStaffWorkload`, `getStaffRevenueAttribution`, `summarizeReports`, `parseReportFilters`, `canOpenReports`, `canViewRevenueReports`, `METRIC_DEFINITIONS` (RECON §5 untouchable).
- `/admin/reports/export` route handler and the 8 export keys (`revenue_summary`, `client_summary`, `booking_list`, `payment_report`, `staff_workload_report`, `staff_revenue_attribution_report`, `service_performance_report`, `source_channel_report`).
- The role-scoped data shape (Owner / PM see all; Coordinator's revenue rows hidden at the data layer; Therapist sees only their own assigned bookings).
- The therapist-scope copy substitution ("My report" / "Your workload, completed sessions, and own bookings in the selected range." at line 64–69); preserved verbatim with minor voice polish.
- No customisable date-range presets beyond the existing five (`lifetime` / `year` / `month` / `week` / `custom`).
- No client-side charting library swap. Recharts stays; only the container `minHeight` fix applies.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader`; scope-conditional title and description (preserved): "Reports" / "Server-scoped business, client, booking, payment, staff, service, and source reporting." for revenue scopes; "My report" / "Your workload, completed sessions, and own bookings in the selected range." for therapist. No actions slot (per-section CSV groupings replace the single top-right export button).
2. **Filter strip** (`AdminFilterBar`): range / From / To / staff / source / payment + Apply Secondary + Clear Ghost (when active). Active filter chips below.
3. **Headline stat strip**: 2 or 4 `AdminStat` tiles depending on `revenueAllowed`. Cormorant numerals. Outstanding tile Attention-tinted when > 0.

**Section A; Activity** (always):
- H2 "Activity".
- Framing sentence (Soft Slate): "How busy the clinic was in this window and where clients came from."
- Two panels side-by-side on `xl:` (`grid-cols-2`), stacked below:
  - "Bookings by status" with `CountBarChart` (`minHeight: 288`).
  - "Source and channel" with `CountBarChart`.
- Activity CSV row (full-width panel below): "Export Activity data" with three Ghost Download chips (Client summary / Booking list / Source-channel).

**Section B; Workload** (visible when scope ≥ coordinator):
- H2 "Workload".
- Framing sentence: "Who carried the load and which services led."
- Two panels side-by-side on `xl:`:
  - "Staff workload"; `AdminEntityRow` list with avatar (Hover Moss letter token) + staff name + "{n} assignments · {n} completed" sub-line. Top 8 visible; `<details>` "Show all".
  - "Service performance"; `AdminEntityRow` list with service name + "{n} bookings" + " · {money}" suffix when `revenueAllowed`.
- Workload CSV row: "Export Workload data" with two Ghost Download chips (Staff workload / Service performance).

**Section C; Money** (visible when `revenueAllowed === true`):
- H2 "Money".
- Framing sentence: "What was collected, what's outstanding, and how it splits across staff."
- Layout: **Revenue chart full-width on `xl:`** (single panel, full-bleed within the page max-width, `minHeight: 288`). Below that, two-column on `xl:`:
  - "Staff revenue attribution"; `AdminEntityRow` list with staff name + money formatted value. Existing description preserved: "Participant service-item attribution avoids group-booking double-counting."
  - "Outstanding vs collected"; small inline panel with two `AdminStat`-like tiles stacked (Cormorant numerals): "Collected" Confirmed family / "Outstanding" Attention family when > 0. (Mirrors the headline stats; here it serves as the section's anchor without forcing the operator to scroll back up.)
- Money CSV row: "Export Money data" with three Ghost Download chips (Revenue summary / Payment report / Staff revenue attribution).

**Bottom panel; "How these numbers are calculated":**
- H2.
- Body: each metric from `METRIC_DEFINITIONS` rendered as a `<details>` with the metric label as `<summary>` (in Restricted family chip composition) and the definition expanded below in body step Soft Slate. Default state: all collapsed.
- Helps the novice owner (PRODUCT.md Fatimah) understand what each number means without dominating the page.

**Mobile (≤md):**
- Filter strip collapses behind "Filters" Ghost → `AdminSheet` from the bottom (matches other heavily-filtered pages).
- Headline stat tiles stack vertically.
- Each section's two-panel rows stack to a single column.
- Revenue chart stays full-width (always was, on mobile).
- Per-section CSV chip rows wrap; each chip becomes inline-block.

## 6. Key States

- **Default; admin scope, current month.** Filter strip set to "Monthly" with current window. All three sections render (Money included). All four stat tiles visible.
- **Default; coordinator scope.** Sections A and B render with full Activity + Workload data. Section C entirely hidden. Headline stats show 2 tiles. Money exports panel hidden.
- **Default; therapist scope.** Same as coordinator visually (no Money), but the data layer returns only the therapist's own assigned bookings + completed sessions. Page title "My report"; description "Your workload, completed sessions, and own bookings in the selected range." Staff filter hidden (single-entry list = self, redundant).
- **Empty (no records in window).** Each list panel renders existing "No records in this range." inline copy. Charts render with an empty axis and a centred "No bookings in this window." line.
- **Custom range with from > to.** Server-side validation catches; client-side helper line below the From/To fields renders "End date must be on or after start date." in Cancelled text.
- **Filter active.** Filter chips visible; "Clear filters" Ghost appears beside Apply.
- **Loading.** `AdminSkeleton`: filter strip (instant), 4 stat-tile skeletons, then section-by-section: panel headers + chart skeleton (`minHeight: 288` placeholder rectangle) + 4 row skeletons in each list panel.
- **Outstanding > 0.** Outstanding stat tile (top strip + Section C inline) tinted Attention family. Body text in both tiles reads the formatted money value; the tint reads at a glance even before the operator parses the number.
- **CSV export click.** `Link` to `/admin/reports/export?report=...&<query>` triggers a server-side download (existing route handler). No client-side spinner; the browser's download chrome takes over. Each export Ghost gets a `download` attribute hint.
- **CSV exports disabled on therapist scope.** Therapist's data is scoped to their own bookings; the existing export route enforces this. Activity exports remain available (Booking list, Source-channel; both filter to own data); Money exports hidden; Workload exports hidden on therapist scope (the surface is "My report", not "everyone's workload").

## 7. Interaction Model

- Filter strip: GET form, submit via existing `<form action="/admin/reports">`. URL preserves deep-link state (RECON §6.5).
- Date range select: changing `range` doesn't immediately rewrite From/To; the operator hits Apply to commit. Client-side helper line shows the implied window beside the select ("This month: 1 May to 31 May") when range ≠ custom; on custom, From/To become required.
- CSV export Ghosts: anchor links with `download` attribute. Each carries an accessible label "Download {report label} CSV".
- Metric definitions: native `<details>` toggle.
- `<details>` "Show all" inside Staff workload and Service performance: native, server-rendered.
- Keyboard: tab traverses filter strip → Apply → stat tiles (decorative, not focusable) → Section A → Section B → Section C → metric definitions. Each `<details>` is keyboard-operable.
- Charts (Recharts): existing keyboard interactions preserved; no new mouse/touch behaviour.

## 8. Content Requirements

- Page title (admin/coordinator): "Reports".
- Page title (therapist): "My report".
- Page description (admin/coordinator): "Server-scoped business, client, booking, payment, staff, service, and source reporting."
- Page description (therapist): "Your workload, completed sessions, and own bookings in the selected range."
- Filter labels: "Range", "From", "To", "Staff", "Source", "Payment".
- Range options: "Lifetime", "Yearly", "Monthly", "Weekly", "Custom".
- Range helper (when not custom): "This month: 1 May to 31 May" (live-bound to current window).
- Custom range validation: "End date must be on or after start date."
- Section A heading: "Activity".
- Section A framing: "How busy the clinic was in this window and where clients came from."
- Section B heading: "Workload".
- Section B framing: "Who carried the load and which services led."
- Section C heading: "Money".
- Section C framing: "What was collected, what's outstanding, and how it splits across staff."
- Stat tile labels: "Bookings", "Repeat clients", "Collected revenue", "Outstanding".
- Stat tile sub-lines: "Booking records in scope" / "{n} new clients" / "Actual amount paid" / "Due minus paid".
- Panel titles: "Bookings by status", "Source and channel", "Staff workload", "Service performance", "Staff revenue attribution", "Outstanding vs collected", "Revenue by period".
- CSV row headings: "Export Activity data", "Export Workload data", "Export Money data".
- CSV chip labels: "Client summary", "Booking list", "Source-channel", "Staff workload", "Service performance", "Revenue summary", "Payment report", "Staff revenue attribution".
- Metric definitions panel title: "How these numbers are calculated".
- Empty-row copy: "No records in this range." (preserved).
- Chart empty copy: "No bookings in this window."
- Denied state copy: "Reports access requires reporting or own-booking permission. Ask the owner if you need broader access." (no raw `view_reports_own or view_reports_operational` identifier).

## 9. Recommended References

- Brief 06 (`dashboard-owner-admin`) → headline stat tile composition (Cormorant numerals, Outstanding Attention-tint at >0).
- Brief 11 (`audit`) → date-range preset vocabulary; cross-page consistency.
- Brief 26 (`staff` directory) → avatar token treatment in Staff workload rows.
- DESIGN.md §Admin-Specific Patterns → Search and Filter (GET form contract); Status Communication (no toasts here; exports are anchor-link downloads).
- DESIGN.md §5 → AdminStat, AdminPanel, AdminEntityRow.
- BASELINE-CRITIQUE P1 (Recharts ResponsiveContainer warnings on `/admin/reports`): `minHeight: 288` fix resolves here.

## 10. Open Questions

1. **Range helper line as live-bound.** Translating "Monthly" into "1 May to 31 May" requires a small client component (date math on the selected range). Cost: ~1 KB. Worth it? Proposal: yes; the operator's most common confusion (per the team's existing monday.com workflow) is "what window am I actually looking at?" Phase 6 polish; defer the equivalent for Custom (operator can read From/To directly).
2. **`<details>` "Show all" vs separate page.** Currently `slice(0, 8)`. If the clinic grows beyond ~8 staff or ~8 services, the in-place expansion may dominate the page. Proposal: keep `<details>` for now (≤20 entries each is fine); revisit if real-world usage shows scrolling pain. Beyond 20, a paginated route (`/admin/reports/staff` or similar) becomes the right answer.
3. **Metric definitions: collapsed vs inline.** Collapsed `<details>` keeps the page calm but hides a hint that may matter to a novice. Inline definitions add ~150 vertical lines. Proposal: keep `<details>` collapsed by default; add a "Show all definitions" Ghost at the panel header that toggles all simultaneously. Phase 6 polish.

## 11. Role variants

Access is gated by `canOpenReports(profile)`. Revenue sub-gating happens via `canViewRevenueReports(profile)`. All four active roles can reach the page, but the surface varies sharply.

### Owner

`canViewRevenueReports === true`. Full surface: 4 headline stat tiles, all three sections (Activity / Workload / Money), all eight CSV exports across the three per-section groupings, full filter strip. Page title "Reports".

### Admin (Practice Manager)

Identical surface to Owner. PM holds `view_reports_revenue` and the full `view_reports_*` family per default RBAC. Same panels, same exports, same chrome.

### Booking Coordinator

`canViewRevenueReports === false`. Surface: 2 headline stat tiles (Bookings + Repeat clients), Section A (Activity) full, Section B (Workload) full but with Service performance row values reading "{n} bookings" only (no money suffix), Section C (Money) entirely hidden. Activity + Workload CSV groupings visible. Money CSV grouping hidden. Page title "Reports". Filter strip identical.

### Therapist

`canViewRevenueReports === false`; data layer further narrows to own assigned bookings. Surface: 2 headline stat tiles (Bookings + Repeat clients; both scoped to therapist's own data; "Repeat clients" reads as "Repeat clients I've seen"), Section A (Activity) full (Source and channel still relevant; therapist sees where their bookings came from), Section B narrowed (Staff workload panel hidden entirely; the surface is "My report", not "everyone's workload"; Service performance kept since the therapist sees which of *their* services led). Section C hidden. CSV exports: only "Booking list" Activity export visible (Source-channel and Client summary exports require broader scope; both hidden). Page title "My report". Staff filter hidden in the filter strip (single-entry list = self).

### Denied state

`canOpenReports === false`. Reachable only by Inactive accounts or any future role explicitly stripped of every `view_reports_*` permission:

- Title: "Reports access limited"
- Body: "Reports access requires reporting or own-booking permission. Ask the owner if you need broader access."
- No raw `view_reports_own or view_reports_operational` permission identifier on screen (current `page.tsx:248` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

---

## Recipe Context

- **RECON §2 inventory row:** Reports — `src/app/admin/reports/page.tsx` — `/admin/reports?range=&from=&to=&staffId=&source=&paymentStatus=` — Bookings, repeat clients, revenue, services, staff workload, source/channel; 8 CSV exports.
- **Access gate (RECON §3):** `canOpenReports(profile)` admits Owner / Admin/PM / Coordinator / Therapist at varying scopes. Revenue rows + Money section gated by `canViewRevenueReports(profile)`. Therapist scope narrowed to own assigned bookings at the data layer.
- **Untouchable backend (RECON §5):** `getReportData`, `getRevenueSeries`, `getServicePerformance`, `getStaffWorkload`, `getStaffRevenueAttribution`, `summarizeReports`, `parseReportFilters`, `canOpenReports`, `canViewRevenueReports`, `METRIC_DEFINITIONS` (all in `src/app/admin/reports/reporting.ts`). `/admin/reports/export` route handler.
- **Preserved IDs / form names (RECON §6.4):** Filter form action `/admin/reports` and field names `range`, `from`, `to`, `staffId`, `source`, `paymentStatus` preserved verbatim. CSV export route accepts `report` + the same filter params via querystring. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** All five filter params (`range`, `from`, `to`, `staffId`, `source`, `paymentStatus`) preserved; no rename, no addition. Export route's `report` param uses the existing 8 keys verbatim.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** Phase 0 §9 Q2 explicitly flagged `/admin/reports` Recharts `ResponsiveContainer` width/height warnings (6 instances) as in-scope for Phase 6 fix → `minHeight: 288` applied on every chart container. Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout; `bg-white` + raw input chrome on filter inputs at `page.tsx:86–122`; `bg-[var(--rahma-ivory)]/70` on row containers at `page.tsx:203` and `page.tsx:234`; `uppercase tracking-wide` field labels at `page.tsx:219` (DESIGN.md typography rule against shouting on data headers); raw permission identifier on `AdminAccessDenied` at `page.tsx:248`.
- **IMAGES-NEEDED additions:** None; this page is charts-and-data only.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Recharts warnings: launch dev server, open `/admin/reports` populated, confirm 0 ResponsiveContainer warnings in the browser console (Phase 2 baseline recorded 6; success means 0).
  - Filter contract: every combination produces a URL with the documented param names; deep-link survives reload; clear-filters Ghost resets all params to default.
  - Range helper live-binding: changing the `range` select updates the helper line ("This month: 1 May to 31 May") without form submit; on custom, helper hides and From/To become required.
  - Section gating: walk through Owner / PM / Coordinator / Therapist viewers and confirm sections A/B/C, headline stat count, Service-performance money suffix, and CSV groupings match §11.
  - CSV download round-trip: each chip's Link resolves to `/admin/reports/export?report=<key>&<query>` with the operator's current filters preserved; therapist-scope exports return therapist-scoped CSVs (existing route enforces).
  - Outstanding tint: when `summary.outstandingRevenue > 0`, both the headline stat tile and the Section C inline tile render Attention-family.
  - "Show all →" `<details>` expansion: server-renders the full list without a client-side fetch.
  - Role pass: Owner / PM / Coordinator / Therapist / Inactive; surface variants match §11; `AdminAccessDenied` content matches §11 with no raw permission identifier.
  - A11y pass: filter inputs labelled; CSV chip Links carry "Download {label} CSV" accessible names; `<details>` keyboard-operable; mobile `AdminSheet` traps focus.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline; Recharts warnings reduced to 0.

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Policy fields paired with plain-English consequence helpers. Encouraging empty states; specific errors; no raw permission names or raw DB column names in user copy.

### Form labels

**Filter strip (every field has a visible `<label>`):**
- `Range` (`name="range"`) — options: `Lifetime`, `Yearly`, `Monthly`, `Weekly`, `Custom`. Default `Monthly`.
- `From` (`name="from"`, date) — required when Range = Custom; otherwise read-only / hidden.
- `To` (`name="to"`, date) — required when Range = Custom.
- `Staff` (`name="staffId"`) — default `All staff`. Hidden on Therapist scope.
- `Source` (`name="source"`) — default `All sources`.
- `Payment` (`name="paymentStatus"`) — default `Any payment`. Options: `Any payment`, `Paid`, `Outstanding`, `Refunded`, `Waived`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Filter apply | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filters` (with count) | Ghost |
| Mobile filter sheet apply | `Apply filters` | Primary |
| List "Show all" disclosure (Staff workload / Service performance / Staff revenue) | `Show all →` / `Show fewer` | Ghost |
| Activity CSV chips | `Client summary` / `Booking list` / `Source-channel` | Ghost (with `download` icon) |
| Workload CSV chips | `Staff workload` / `Service performance` | Ghost |
| Money CSV chips | `Revenue summary` / `Payment report` / `Staff revenue attribution` | Ghost |
| Metric definitions per-row | (each metric label is the `<summary>`) | Ghost |
| Metric definitions overall (Phase 6 polish) | `Show all definitions` / `Hide all definitions` | Ghost |

### Error messages

- Date range — `From` after `To`: `End date must be on or after start date.` (inline below the From/To row, Cancelled text)
- Range = Custom with empty From or To: `Pick a start and end date for a custom range.`
- Date in the far future (>5 years out): `That date is outside the supported range. Reports cover the last 5 years.`
- Page load failure: `Couldn't load this report.` (replaces the section content) with `Try again` Ghost.
- CSV download failure (rare; the route enforces): toast `Couldn't generate that export. Try again in a minute.`
- Chart render failure: `Couldn't render this chart.` (inline replacing chart) with `Try again` Ghost.
- Section data empty: row-level "No records in this range." (preserved verbatim from existing copy)
- Chart empty: `No bookings in this window.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Whole page, no records in window | (per-panel inline copy; no full-page EmptyState) | `No records in this range.` | — |
| Chart empty | (inline, no heading) | `No bookings in this window.` | — |
| Staff workload empty | `No staff activity in this range` | `Nobody had a booking assigned in the selected window.` | — |
| Service performance empty | `No services booked` | `No services had bookings in the selected window.` | — |
| Staff revenue empty | `No revenue attributed yet` | `Once bookings are paid, attribution appears here.` | — |
| Source & channel empty | `No source data` | `New leads will show up here as bookings come in.` | — |
| Therapist scope: `My report` empty | `Nothing for this range` | `You had no bookings in the selected window.` | — |
| Denied | `Reports access limited` | `Reports access requires reporting or own-booking permission. Ask the owner if you need broader access.` | `Back to dashboard` |

### Tooltip text

- Range select option `Lifetime`: native `title` — `Everything since the clinic started.`
- Range select option `Yearly` / `Monthly` / `Weekly`: native `title` shows what the helper line shows — e.g. `Monthly: 1 May to 31 May`.
- Range helper line (live-bound, beside Range select): `This {range}: {from} to {to}.`
- Staff filter on Therapist scope (hidden, but if surfaced as disabled): `Your reports already filter to you.`
- Headline stat `Bookings`: `Booking records in scope.`
- Headline stat `Repeat clients`: `Clients with more than one booking in the window.`
- Headline stat `Collected revenue`: `Total amount paid across bookings in this window.`
- Headline stat `Outstanding` (when 0): `All paid up for this window.`
- Headline stat `Outstanding` (>0): `Due minus paid. These bookings still need collection.`
- Chart bars: native `title` shows value — e.g. `Mon 12 May: 6 bookings`.
- Staff workload row: native `title` — `{N} assignments, {N} completed`.
- Service performance row: native `title` — `{N} bookings · £{N} collected` (money suffix on revenue scopes only).
- CSV chip: `Download {label} as CSV` (e.g. `Download Booking list as CSV`).
- Metric definitions `<summary>`: native `title` — `Show how this number is calculated`.

### Confirmation dialog text

No `ConfirmActionModal` instances. The page is read-only (with CSV exports as anchor-link downloads). No destructive actions.

**Toasts**
- Filter applied: no toast — report re-render is the feedback.
- CSV download started: no toast — browser download chrome is the feedback.
- CSV failure (rare): `Couldn't generate that export. Try again in a minute.` (persistent, Retry).
