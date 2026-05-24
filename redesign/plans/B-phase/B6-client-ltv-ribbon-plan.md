# Plan: B-6 — Client LTV ribbon

**Brief:** `redesign/briefs/B6-client-ltv-ribbon-brief.md`
**Effort:** ~0.5 day
**Prerequisites:** B-1 (`<MetricRow>` + `<SparklineChart>`) + B-2 (`getClientLifetimeMetrics`) shipped
**Gates:** none downstream
**Safety label:** ADDITIVE (new component mounted at top of existing client detail page; existing page untouched below the mount)
**Blocks redesign:** NO — small adjunct extension

---

## What this is

A LTV ribbon component added to the top of `/admin/clients/[clientId]`. Six stats horizontally + 12-month sparkline below. Consumes `getClientLifetimeMetrics(clientId, data)` from B-2. Hides when client has zero bookings; renders when client has any booking history (including all-cancelled).

## Why it's needed

Per user's "we need tracking and metrics for such things" answer on the LTV consideration. Without B-6, a client's lifetime value is invisible at the moment the operator is deciding how to handle them (calls, rescheduling, follow-up). Industry standard (Cliniko, Practice Better): LTV at the top of every client page.

## What this does (user story)

"As a Coordinator on the phone with a returning client, I open her client page and see at a glance that she's worth £1,240 across 17 visits with the last one 3 weeks ago — the 'Loyal' chip tells me she's a regular. I treat her accordingly: flexible reschedule, friendly tone, no hard sell."

## What information it stores or retrieves

**Reads:** consumes `ReportData` already fetched by the existing client detail page. Computes via `getClientLifetimeMetrics(clientId, data)` from B-2. No new DB queries.

**Writes:** none.

**Migrates:** none.

## Who can use it

- Visible whenever `canViewClients(profile)` is true (existing gate on the page itself).
- Therapist viewing a client they've assigned: visible, but data layer narrows; ribbon shows therapist-scoped LTV (LTV sub-line reads "Across N visits with you").
- Owner / Admin / Coord: full LTV (clinic-wide).

## What can go wrong

- **Client with zero bookings**: ribbon hides entirely (per `getClientLifetimeMetrics` returning zero-filled object → consumer checks `visitCount === 0` and renders null).
- **Client with all-cancelled bookings**: LTV = 0; ribbon shows zero state (£0, "Never" last seen, "—" preferred service, "New" chip).
- **Sparkline all-zero data**: sparkline hides per B-1 contract (returns nothing).
- **Therapist scope narrowing too aggressive**: data layer already narrows via existing `?clientId=` filter (verify with manual check). If `getClientLifetimeMetrics` returns zero-narrowed result for a client a Therapist never assigned, ribbon hides correctly.
- **Mobile reflow at 3×2 grid**: ensure tabular-nums alignment in the LTV / Visits / Avg booking cells.
- **Last seen relative-time staleness**: re-computed on each render (server component); accurate.
- **Tooltip on truncated Preferred service**: only when truncation triggers (full name > 20 chars).

## How to verify it works

1. **Static:** lint + types clean.
2. **Vitest:** new component spec passes; baseline preserved.
3. **Playwright role sweep**:
   - Owner views a loyal client (17 visits): full ribbon with `★Loyal` chip, sparkline populated.
   - Owner views a new client (1 booking): full ribbon with `New` chip.
   - Owner views a brand-new client (0 bookings): ribbon hidden; existing page renders unchanged.
   - Therapist views a client they've assigned: therapist-narrowed LTV sub-line reads "Across N visits with you".
   - Therapist views a client they've never assigned: ribbon hidden.
4. **Repeat-status threshold check**: seed clients with 1 / 3 / 7 / 12 visits; confirm chip mappings `New` / `Returning` / `Regular` / `Loyal`.
5. **Visual**: screenshots at 375 / 768 / 1280.
6. **Edge cases**: all-cancelled (ribbon visible with zero state); sparkline-all-zero (sparkline hidden).

## Safe implementation order

### Step 1 — `<ClientLtvRibbon>` component
- Create `src/app/admin/clients/[clientId]/ClientLtvRibbon.tsx` (~120 lines).
- Props: `clientId: string`, `data: ReportData` (or whatever shape the existing page passes — verify and use).
- Server component.
- Compute via `getClientLifetimeMetrics(clientId, data)` from B-2.
- Early return `null` when `metrics.visitCount === 0`.
- Render per brief §5:
  - `<aside role="complementary" aria-label="Client lifetime overview" className="border-t border-b ...">`
  - 6 stat cells (LTV / Visits / Last seen / Avg booking / Preferred service / Repeat status chip)
  - `<SparklineChart>` below at 32px height
  - Empty state (sparkline hidden, ribbon hidden) per brief §6
- Repeat status chip mapping per brief §5.3.
- Therapist-narrowed sub-line on LTV tile per brief §6.
- **Verify:** smoke render with known client data.

### Step 2 — Vitest spec
- Create `src/app/admin/clients/[clientId]/__tests__/ClientLtvRibbon.test.tsx`.
- Test states: populated loyal (17 visits) · new (1 booking) · zero-bookings (returns null) · all-cancelled (zero state) · sparkline-all-zero (sparkline hidden) · therapist-narrowed sub-line.
- **Verify:** all specs pass.

### Step 3 — Mount in `page.tsx`
- Modify `src/app/admin/clients/[clientId]/page.tsx`.
- Immediately below the page sub-header (with client name / contact info) and above the existing tabs / sections, add:
  ```tsx
  <ClientLtvRibbon clientId={params.clientId} bookings={bookingsResult.data ?? []} />
  ```
- **Per AUDIT H6 — specify the data source exactly:** consume `bookingsResult.data ?? []` from the existing fetch at `page.tsx:381–396` (the unfiltered Promise.all alongside `clientResult`). DO NOT consume `bookingsForTab` at line 521 — that's tab-filtered and would skew LTV math. DO NOT add a new DB query.
- Mount the ribbon BEFORE any tab-filtering happens (i.e. after the data fetch resolves, before the existing tab logic kicks in).
- **Verify:** sign in; navigate to a client detail page; ribbon renders.

### Step 4 — Playwright sweep
- Per "How to verify it works" §3.
- Capture screenshots.

### Step 5 — Repeat-status threshold check
- Seed (or find existing) clients with each visit-count bucket: 0, 1, 3, 7, 12+.
- For each, navigate to client page; confirm chip label.

### Step 6 — Visual smoke
- 375 / 768 / 1280 screenshots; confirm reflow per brief §5.

### Step 7 — Lint + types + vitest
- All gates pass.

### Step 8 — Commit
- Stage scoped files explicitly.
- Commit message: `feat(admin): B-6 — Client LTV ribbon on /admin/clients/[clientId]`.

## How to undo it if something breaks

Revert the commit. The `<ClientLtvRibbon>` mount disappears from `page.tsx`; the new file is orphaned (harmless). The existing client detail page renders exactly as before.

## Safety confirmations

- [ ] Branch is `redesign/start-state` (or worktree).
- [ ] B-1 + B-2 commits already on the branch.
- [ ] No `pnpm install` (zero new deps).
- [ ] No DB migrations.
- [ ] No production deploy triggered by this phase.

---

## Step-by-step verification log template

```
step-1: COMPLETE — ClientLtvRibbon.tsx created; renders correctly for loyal + new + zero-bookings
step-2: COMPLETE — 6 vitest specs pass
step-3: COMPLETE — mounted in page.tsx; ribbon renders above tabs; existing page preserved
step-4: COMPLETE — Playwright role sweep: 5 scenarios verified (Owner loyal / Owner new / Owner zero / Therapist narrowed / Therapist non-assigned)
step-5: COMPLETE — threshold mapping verified: New (1) / Returning (3) / Regular (7) / Loyal (12)
step-6: COMPLETE — 3 viewports captured; mobile 3×2 grid reflows correctly
step-7: COMPLETE — lint + tsc + vitest all green
step-8: COMPLETE — committed feat(admin): B-6 — Client LTV ribbon
```

---

## Verification gate

| Gate | Command | Pass criterion |
|---|---|---|
| Static lint | `pnpm lint` | 0 errors |
| Static types | `npx tsc --noEmit` | 0 errors |
| Vitest | `pnpm vitest run` | 6 new specs pass; baseline preserved |
| Owner loyal client | Sign in, navigate to loyal client | Ribbon: £X · 17/2 · 3w ago · £Y · Massage · ★Loyal · populated sparkline |
| Owner new client | Sign in, navigate to client with 1 booking | Ribbon: £X · 1/0 · Xd ago · £X · Service · `New` chip · sparkline 1 point |
| Owner zero-bookings client | Navigate to a brand-new client | Ribbon hidden; existing page renders |
| Therapist scope narrowing | Sign in as Therapist, navigate to a client they've assigned | LTV sub-line reads "Across N visits with you" |
| Therapist non-assigned client | Sign in as Therapist, navigate to a client they've never seen | Ribbon hidden |
| All-cancelled client | Navigate to client with only cancelled bookings | Ribbon: £0 · 0/N · Never · — · `New` |
| Repeat status threshold | Navigate to clients at 1/3/7/12 visits | Chip = New / Returning / Regular / Loyal |
| Visual screenshots | 375 / 768 / 1280 | Layout matches brief §5 |
| Truncation tooltip | Hover Preferred service >20 chars | Full service name in tooltip |

---

## Files touched (summary)

**Created:**
- `src/app/admin/clients/[clientId]/ClientLtvRibbon.tsx`
- `src/app/admin/clients/[clientId]/__tests__/ClientLtvRibbon.test.tsx`

**Modified:**
- `src/app/admin/clients/[clientId]/page.tsx` (mount the ribbon at the top)

**Total: ~2 new files + ~1 modified file.**

---

## Hand-off

After B-6 ships:
- **Band B programme complete.**
- Phase 7 audit re-entry possible.
- All Owner-stated complaints structurally resolved:
  - Dashboard rebuilt (B-5)
  - Reports rebuilt with macro + drill-in + Insights (B-4)
  - Per-user metrics in Performance surface (B-3)
  - LTV visible on client detail (B-6)
  - Foundation primitives shared across all surfaces (B-1)
  - Metric backend canonical (B-2)
- Track B operational work (MFA / backup drill / Cloudflare secrets / Sentry verify) remains as separate pre-launch carry-over.

End of Band B plan series.
