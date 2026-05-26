# Brief: B-6 — Client LTV ribbon (`/admin/clients/[clientId]`)

**Phase:** B-6 (small adjunct; doesn't gate anything)
**Estimated effort:** ~0.5 day
**Brief status:** session-4 reframe; user-confirmed (added per "we need tracking and metrics for such things")
**Plan:** `redesign/plans/B-phase/B6-client-ltv-ribbon-plan.md`
**Prerequisites:** B-1 (`<KpiTile>` + `<SparklineChart>`) + B-2 (`getClientLifetimeMetrics`)

---

## 1. Feature Summary

A lifetime-value ribbon added to the top of the existing `/admin/clients/[clientId]` client detail page. Six compact stats in a single horizontal strip: **lifetime value** (sum of completed/paid bookings), **visit count** (total + completed/cancelled split), **last seen** (relative timestamp), **avg booking value** for this client, **preferred service** (most-booked), **repeat status chip** (New / Returning / Regular / Loyal). Below the stats: a 12-month visits sparkline. The ribbon makes a client's worth visible at the moment the operator is deciding how to handle them — closing the loop with the source-attribution + retention metrics on B-4 Reports. Light-touch: doesn't rebuild the client detail page; just adds the ribbon at the top.

## 2. Primary User Action

**Open a client's detail page (from Bookings, Clients list, or a deep-link), see at a glance how valuable this client is to the practice, how often they've come in, when they were last seen, and whether they're a regular — without having to scroll the booking history or compute anything mentally.**

## 3. Design Direction

**Colour strategy:** Warm and informational. No severity tints (no "this client is bad" colouring). The repeat-status chip uses calm tokens — `Regular` and `Loyal` get a quiet Confirmed family pill (small reward signal); `Returning` is neutral Practice Charcoal; `New` is a Pending family pill (informational, not warning). LTV numeral is Cormorant in Chronicle. Sparkline is Soft Slate. The ribbon should feel like a printed letterhead at the top of a personal file — informative, dignified, not analytical.

**Theme scene sentence:** *"A Coordinator is on the phone with Sarah Iqbal, who's calling to reschedule a Tuesday booking. The Coordinator opens Sarah's client page mid-call, sees her LTV is £1,240 across 17 visits with the last one 3 weeks ago, sees the 'Loyal' chip, and offers her a flexible reschedule slot the system normally wouldn't surface."* Forces ribbon-at-top-of-page (not below the fold), forces clarity at a glance, forces the repeat status chip to communicate the relationship state without further reading.

**Anchor references:**
- **Cliniko client overview header strip** — LTV / visit count / last seen at the top of every client page
- **Practice Better client snapshot** — repeat-status badge concept
- **Stripe customer detail page** — `Total spent · Active subscriptions · Created` tile strip pattern
- **Salesforce Account header** — small dignified tile rhythm above the activity feed

Anti-anchor: a chart-heavy "client analytics" tab. The ribbon is six stats and one sparkline. Not a dashboard.

## 4. Scope

**In:**

### Component
- `<ClientLtvRibbon clientId, bookings>` — single new component, ~120 lines.
- **Per AUDIT-2026-05-22 H2 + H6:** consumes the existing `ClientBookingRecord[]` shape that `/admin/clients/[clientId]/page.tsx` already fetches as `bookingHistory`, NOT `ReportData`. B-2's `getClientLifetimeMetrics(clientId, bookings)` was updated to accept this shape.
- **Critical (per AUDIT H6) — specify the data source:** the client detail page fetches `bookingHistory` in `bookingsResult.data` at `page.tsx:381–396` (the unfiltered Promise.all alongside `clientResult`). That variable contains the FULL history regardless of which `?tab=` is active (upcoming/past/all are derived filters). The ribbon must consume `bookingsResult.data ?? []` (the unfiltered source), NOT the `bookingsForTab` filtered view at `page.tsx:521`. Mount the ribbon BEFORE the tab-filtering happens so it sees the full set.
- Renders 6 stats horizontally + 12-month sparkline below.
- No new DB query — purely consumes already-fetched data.

### Mount point
- Top of `src/app/admin/clients/[clientId]/page.tsx`, immediately below the page header / breadcrumb, above the existing tabs / sections.

### Permission rules
- Visible whenever the page itself is visible (existing `canViewClients(profile)` gate).
- Therapist viewing a client they've assigned: visible, but `getClientLifetimeMetrics` returns therapist-narrowed data (data layer narrows; ribbon shows the therapist-scoped LTV for that client, which IS what they need to see).
- Owner/Admin/Coord: full LTV (clinic-wide visits for this client).

### Files
- `src/app/admin/clients/[clientId]/ClientLtvRibbon.tsx` — new component (~120 lines)
- `src/app/admin/clients/[clientId]/page.tsx` — modified: mount the ribbon at the top
- `src/app/admin/clients/[clientId]/__tests__/ClientLtvRibbon.test.tsx` — vitest spec

**Out:**
- **A separate LTV analytics page** — out per user decision ("[separate brief]" → ribbon-only this round).
- **Per-staff LTV breakdown for a client** ("Aisha has seen Sarah 8 times worth £620") — Phase 7 candidate; not blocking.
- **LTV trend over time chart** — sparkline covers it; full chart is over-instrumented for this surface.
- **Promotion / loyalty CTAs based on LTV** (e.g. "Send Sarah a thank-you email") — out.
- **Editable client tags / VIP flag** — separate concern; out of B-6.
- **Anonymised aggregate LTV** ("clinic median LTV is £540") — separate insight; B-4 candidate; not B-6.
- **LTV in CSV exports** — Phase 7 candidate.

## 5. Layout Strategy

**Desktop ≥1024px:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Existing client detail page header — name, contact, edit buttons]    │
├──────────────────────────────────────────────────────────────────────┤
│ CLIENT LTV RIBBON                                                     │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐                          │
│ │ LTV  │ Visits│Last seen│Avg booking│Preferred│ Repeat status      │
│ │£1,240│ 17/2 │ 3w ago │ £73    │ Massage 60 │   [Loyal pill]      │
│ └──────┴──────┴──────┴──────┴──────┴──────┘                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (12-month sparkline)     │
├──────────────────────────────────────────────────────────────────────┤
│ [Existing client detail tabs / sections — preserved unchanged]        │
└──────────────────────────────────────────────────────────────────────┘
```

**Mobile <768px:**

```
┌──────────────────────────────┐
│ [Existing client header]      │
├──────────────────────────────┤
│ LTV RIBBON                   │
│ ┌────────┬────────┐          │
│ │ LTV    │Visits  │          │
│ │ £1,240 │ 17/2   │          │
│ ├────────┼────────┤          │
│ │Last    │Avg     │          │
│ │ 3w ago │ £73    │          │
│ ├────────┼────────┤          │
│ │Preferred│Repeat │          │
│ │Massage  │ Loyal │          │
│ └────────┴────────┘          │
│ ━━━━━━━━━━━━ (sparkline)     │
├──────────────────────────────┤
│ [Existing tabs / sections]    │
└──────────────────────────────┘
```

Mobile compresses to 3×2 grid; sparkline stays full-width below.

### 5.1 Ribbon composition

The 6 stats use the B-1 `<MetricRow>` primitive (or a slim ad-hoc element if `<MetricRow>` doesn't quite fit — both fine).

| # | Label | Value | Hint / sub-line |
|---|---|---|---|
| 1 | `LTV` | Cormorant numeral formatted via `formatMoney(ltv)` | `Across {visitCount} visits` |
| 2 | `Visits` | "17 / 2" (completed / cancelled split, tabular-nums) | (no sub-line) |
| 3 | `Last seen` | "3 weeks ago" (relative; native `title` shows absolute date) | (no sub-line) |
| 4 | `Avg booking` | `formatMoney(avgBookingValue)` | (no sub-line) |
| 5 | `Preferred service` | service name (truncated to 20 chars; full name in tooltip) | (no sub-line) |
| 6 | `Repeat status` | small pill chip — `New` / `Returning` / `Regular` / `Loyal` | (no sub-line) |

### 5.2 Sparkline

`<SparklineChart>` from B-1 at 32px height, full ribbon width.
- Data: `monthlyVisitsSeries` from `getClientLifetimeMetrics` — array of 12 monthly visit counts.
- Stroke: Soft Slate (`oklch(42% 0.008 143)`); fill: Soft Slate at 8% opacity.
- Hides when all 12 months are zero (sparkline returns nothing — see B-1).

### 5.3 Repeat status chip mapping (deterministic)

| Completed booking count | Chip label | Chip palette |
|---|---|---|
| 0 | (hide entire ribbon — no LTV data yet; render the existing client page only) | — |
| 1 | `New` | Pending family pill |
| 2–4 | `Returning` | Practice Charcoal pill (neutral) |
| 5–9 | `Regular` | Confirmed family pill |
| ≥ 10 | `Loyal` | Confirmed family pill + small "★" prefix icon (lucide `Star` 12px) |

### 5.4 Empty / edge states

- **Client has zero bookings:** ribbon hidden entirely; existing page renders without the ribbon. No empty-state copy in the ribbon slot itself.
- **Client has 1 booking but it's cancelled:** LTV = 0; "Visits" reads "0 / 1"; `Last seen` reads "Never"; "Preferred service" reads "—"; chip reads `New`. Ribbon still renders (LTV = 0 is informative).
- **Sparkline data all zero:** sparkline hides (per B-1 contract); rest of ribbon visible.
- **Therapist view (data narrowed):** LTV / counts narrow to the therapist's own assignments with this client. Sub-line on the LTV tile changes from "Across N visits" to "Across N visits with you" — makes the scope explicit.

## 6. Key States

| State | What the user sees |
|---|---|
| Owner viewing a loyal client (17 visits) | Full ribbon: £1,240 · 17/2 · 3w ago · £73 · Massage 60 · ★Loyal · 12-month sparkline populated |
| Owner viewing a new client (1 completed booking) | Full ribbon: £73 · 1/0 · 4d ago · £73 · Massage 60 · New · sparkline shows one dot |
| Owner viewing a brand-new client (0 bookings) | Ribbon hidden; existing page renders unchanged |
| Coordinator viewing same loyal client | Same as Owner ribbon |
| Therapist viewing a client they've assigned 4 times | Therapist-narrowed: £320 · 4/0 · 1w ago · £80 · Massage 60 · Returning · sparkline shows 4 points; LTV sub-line "Across 4 visits with you" |
| Therapist viewing a client they've never personally assigned | Ribbon hidden (zero data in their narrowed scope) |
| All cancelled bookings only | LTV £0 · "0 / N" visits · "Never" last seen · "—" preferred service · `New` chip · empty sparkline |
| Loading | `AdminSkeleton` shimmer in ribbon shape (6 short bars + 1 long bar for sparkline area) |
| Error fetching LTV | Ribbon shows inline `role="alert" aria-live="polite"` `Couldn't load client lifetime metrics. Try refreshing.` Existing page renders unchanged. |
| Mobile 375 | 3×2 grid + sparkline below (per §5 mobile layout) |
| `prefers-reduced-motion: reduce` | Sparkline still renders (it's not motion); no count-up on LTV value; static. |

## 7. Interaction Model

- **Ribbon stats are non-interactive.** No click. No hover. Just static info. (Stats become "talk to me" hover-tooltips only — see §8.)
- **Sparkline hover:** Recharts tooltip showing month + visit count (existing `<SparklineChart>` behaviour).
- **Repeat status chip:** native `title` describes the threshold ("Loyal: 10+ completed visits").
- **No keyboard interaction beyond standard tab order** — ribbon adds no focusable elements (all static text).
- **Screen reader:** ribbon wrapped in `<aside role="complementary" aria-label="Client lifetime overview">`; sparkline is `role="img" aria-label="12-month visit trend for this client"`.

## 8. Content Requirements

**Headings.** None — ribbon has no heading. It's a horizontal stat strip below the existing page header.

**Microcopy.**
- Stat labels: `LTV` · `Visits` · `Last seen` · `Avg booking` · `Preferred service` · `Repeat status`
- LTV sub-line: `Across {N} visits` (Owner/Admin/Coord) / `Across {N} visits with you` (Therapist)
- Visits value format: `{completed} / {cancelled}` (tabular-nums; small "/" separator)
- Last seen value: relative-time string ("3 weeks ago", "4 days ago", "Yesterday", "Today")
- Last seen = never: `Never`
- Preferred service: truncated to 20 chars; ellipsis if longer (full in tooltip)
- Repeat status chip: `New` / `Returning` / `Regular` / `Loyal` (★Loyal for the icon variant)

**Empty-state copy.** None — ribbon hides on zero bookings; no copy needed inline.

**Error copy.** `Couldn't load client lifetime metrics. Try refreshing.` (Soft Slate, `role="alert"`)

**Voice anchors hit.** Verbs over nouns ("Across 17 visits" not "Visit count: 17"); real numbers ("£1,240" formatted); state-word discipline ("Loyal" not "VIP"); empty states encourage (when 0 bookings: just hide, don't preach "No data yet").

## 9. Recommended References

- **B-1 brief** — `<MetricRow>`, `<SparklineChart>`, `<DeltaChip>` (delta not used here but the pattern matters)
- **B-2 brief** — `getClientLifetimeMetrics` signature + return shape
- **`reference/spatial-design.md`** — for the horizontal ribbon rhythm + mobile 3×2 reflow
- **DESIGN.md §5 (AdminEntityRow)** — the chip styling for "Repeat status"
- **DESIGN.md §2 (Cormorant Exception)** — the LTV numeral is a sanctioned Cormorant use
- **PRODUCT.md Voice Anchors** — informational tone, not analytical

## 10. Open Questions

1. **Should the ribbon appear above or below the existing page sub-header (which has the client's contact info)?** **Recommendation:** below the contact info but above the tabs. Contact info is identity; LTV is operational context. Tab content is detail.
2. **Repeat status chip thresholds** — 5/10 for Regular/Loyal feels right for therapy/wellness (not retail). User can override via `?retentionThreshold=` if needed (already a parameter on `getRetentionRate`). **Recommendation:** ship with 2–4 / 5–9 / 10+ defaults; revisit Phase 7 with real data.
3. **`Last seen` "Today" vs "Earlier today"** — granularity? **Recommendation:** if last booking was today and < 3 hours ago, render "Earlier today" with hours; else "Today". Phase 7 can refine.
4. **`Preferred service` ties** — what if a client has equal bookings across 2 services? **Recommendation:** take the most-recent of the tied services. Reduces flicker on equally-split clients.
5. **Mobile ordering of stats** — should `Repeat status` be first (most-glance-useful) or last (matches desktop)? **Recommendation:** match desktop (last). Less surprise; ribbon reads same across breakpoints.
6. **Owner viewing a client with the therapist-scoped story** — does Owner ever want to see the therapist-narrowed view? **Recommendation:** no — Owner gets full clinic-wide LTV always. If a manager wants per-therapist breakdown for a client, that's a Phase 7 feature.
7. **Tooltip / native `title` exhaustively for screen readers** — every stat needs an accessible label? **Recommendation:** the wrapping `<aside aria-label="Client lifetime overview">` + per-stat semantic markup is sufficient; no extra `title` needed except on the truncated `Preferred service` value (full service name in title).

---

## Recipe Context

### Files to create

| File | Purpose |
|---|---|
| `src/app/admin/clients/[clientId]/ClientLtvRibbon.tsx` | Ribbon component (~120 lines). Composes 6 stats + sparkline. Hides when `data.visitCount === 0`. |
| `src/app/admin/clients/[clientId]/__tests__/ClientLtvRibbon.test.tsx` | Vitest spec. Render: populated, zero-bookings (hidden), all-cancelled, sparkline empty (sparkline hides). |

### Files to modify

| File | Change |
|---|---|
| `src/app/admin/clients/[clientId]/page.tsx` | Add `<ClientLtvRibbon clientId={params.id} data={reportData} />` mount immediately below the existing page sub-header and above the tabs / sections. Compute `reportData` via the existing client-detail data flow (already fetches the client's booking history) OR call `getReportData` with `?clientId=` filter if a smaller-scoped query helper exists. Use whichever already-fetched data shape the page uses; do NOT add a new DB query. |

### Files to NEVER touch

- `src/app/admin/clients/[clientId]/page.tsx` data-fetching contract — the ribbon consumes existing data, doesn't add queries
- `src/app/admin/clients/page.tsx` (the clients list) — out of scope
- `src/app/admin/clients/[clientId]/client-detail-data.ts` (or equivalent) — RECON §5 untouchable
- `src/app/admin/clients/client-metrics.ts` — owned by B-2; only consume `getClientLifetimeMetrics`
- `src/lib/auth/**` — RBAC unchanged
- `src/lib/supabase/**`
- `supabase/migrations/**` — no schema changes
- All build/config files

### Feature Preservation Manifest

**Existing client detail page features preserved:**
- All existing tabs / sections render in their original order, below the ribbon
- All existing client identity / contact info renders above the ribbon
- No URL params changed
- No permission gates changed

**Permission gates preserved:**
- `canViewClients(profile)` — already gates the page; ribbon inherits

**JS hooks / IDs to preserve:**
- All existing IDs on `/admin/clients/[clientId]` preserved
- Ribbon adds a single new structural element wrapped in `<aside role="complementary" aria-label="Client lifetime overview">`

**Server actions:** none from ribbon.

**Audit log writes:** none from ribbon.

**External / deep links to preserve:** N/A — ribbon doesn't navigate.

### Information hierarchy (top to bottom of client detail page after B-6)

1. Page identity + breadcrumb
2. Client name / contact info (existing sub-header)
3. **Client LTV ribbon (NEW)** — only when `visitCount > 0`
4. Existing tabs / sections (booking history, notes, etc.)

### Design direction — tokens and components

- **Ribbon container:** `<aside role="complementary" aria-label="Client lifetime overview">` with `border-t border-b border-[var(--admin-border-subtle)] py-4 my-4`
- **Stat label:** Work Sans 500 0.625rem (label step) Soft Slate, uppercase letter-spaced eyebrow
- **Stat value (numeral):** Cormorant Garamond 700 1.5rem Chronicle, tabular-nums (LTV uses 1.778rem; other numerals 1.5rem)
- **Stat sub-line:** Work Sans 400 0.75rem Soft Slate
- **Sparkline:** B-1 `<SparklineChart>` 32px tall, Soft Slate stroke, 8% area fill
- **Repeat status chip:** `inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium` with palette per §5.3 table
- **Loyal chip prefix icon:** `Star` 12px lucide, inline before label
- **Mobile reflow:** CSS grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`

---

## Implementation Notes

**Per-state intent** lives in §6.
**Per-viewport intent** lives in §5 (desktop horizontal strip / mobile 3×2 grid).

**Verification steps:**
- `pnpm lint` + `npx tsc --noEmit` clean
- Vitest: new component spec passes
- Playwright role sweep: Owner / Admin / Coord — verify ribbon renders with populated data; Therapist — verify therapist-narrowed sub-line; brand-new client — verify ribbon hidden
- Screenshot at 375 / 768 / 1280 — confirm reflow per §5
- Repeat status chip tests: seed clients at 1 / 3 / 7 / 12 visits and verify `New` / `Returning` / `Regular` / `Loyal` mapping
- Edge case: client with all cancelled bookings — verify ribbon renders with £0 LTV + `Never` last seen
- Tooltip check: hover `Preferred service` truncated to 20 chars — full name appears

---

## Copy

### Form labels / button text

None — ribbon is read-only.

### Error messages

| Slot | Text |
|---|---|
| Ribbon data load failure | `Couldn't load client lifetime metrics. Try refreshing.` (Soft Slate, `role="alert" aria-live="polite"`, inside ribbon container) |

### Empty-state text

| Case | Behaviour |
|---|---|
| `visitCount === 0` | Ribbon hidden entirely; no empty-state copy |
| All bookings cancelled (LTV = 0, visits = 0/N) | Ribbon visible; LTV reads `£0.00`; "Last seen" reads `Never`; "Preferred service" reads `—`; chip reads `New` |
| Sparkline data all zero | Sparkline hidden; rest of ribbon visible |

### Tooltip text

| Slot | Text |
|---|---|
| `Last seen` value | absolute date (e.g. `Tue 21 May 2026`) |
| `Preferred service` (when truncated) | full service name |
| Repeat status chip | `{label}: {threshold} description` (e.g. `Loyal: 10+ completed visits`) |
| Sparkline (per data point) | `{month} {year}: {N} visits` |

### Confirmation dialog text

None — ribbon mutates nothing.

### Toasts

None — ribbon is purely informational.

---

*End of B-6 brief. End of Band B brief series. Next files: the 6 plans in `redesign/plans/B-phase/`.*
