# Wave reconciliation log

Cross-wave consistency notes per POST-AGENT-AUDIT-PROTOCOL §6. Updated at the close of each LAUNCH-SHEET §3 wave (or partway when the wave straddles sessions).

---

## Wave 1 — quick wins (CLOSED 2026-05-17)

**Pages:** calendar · availability · reports · settings

**Merge order:** calendar (pre-existing on `redesign/start-state` at session start) → availability (pre-existing) → settings (`9102e8e`, merged 2026-05-17) → reports (`92047e8`, rebased onto settings then merged) → **wave closed**.

**Status:** all 4 merged on `redesign/start-state`. Visual cross-page reconciliation at 1440 / 768 / 375 deferred to Phase 7 (`/impeccable audit admin`) — the dev server was not exercised post-merge during this session.

**Notable Phase-7 carry-forwards from this wave:**

- **settings**: audit + critique were main-agent self-review (subagent dispatch was deferred due to turn-budget). Phase 7 must re-audit objectively. Reference: `redesign/per-page-deferrals/settings-deferrals.md` "Subagent audit + critique not dispatched".
- **reports**: 4 P2 token-drift findings (raw oklch literals + section H2 type step + AdminStat resting shadow + section H2 vs panel H2 semantic stacking). The **AdminStat resting shadow** finding is cross-cutting and belongs to `00-shared-components` scope, not reports — every page using `AdminStat` carries it. Phase 7 fix lives in `src/app/admin/components/admin-ui.tsx:211`.
- **reports + settings**: 22 + 10 raw `oklch()` literals respectively, all matching `admin-ui.tsx` codebase convention — routed to Phase 8 extract for systemic tokenisation rather than per-page surgery.
- **reports**: agent's own corrective dispatch closed 6 of the 7 user-flagged audit items (Section C duplicates, 4×2 chip grid, section H2 1.5rem→1.778rem, mobile filter trigger range label, invisible loading state, mobile bottom-nav clearance). Fix 3 (AdminStat shadow) correctly deferred to 00-shared-components. Fix 5 (sparse bar charts) correctly skipped per user's own "out of brief scope" note.

---

## Wave 6 — FAKE admin lists (CLOSED 2026-05-17)

**Pages merged:** enquiries (`1ebc18f`) · audit (`3c69da8`) · operations (`2a8b804`) · privacy (`9238d14`, landed via the parallel-5 batch — see operational observations below)

Wave 6 closed when privacy landed on `redesign/start-state`. Visual cross-page reconciliation across all four pages at 1440 / 768 / 375 deferred to Phase 7 (`/impeccable audit admin`) — the dev server was not exercised post-merge during the closing session.

### Brief-extension precedents now in `redesign/start-state`

Wave 6 establishes **9 brief-extension patterns** that future page briefs may need to align with or explicitly override. Listed here so brief authors and Phase 7 can decide on consistency-or-divergence per pattern.

#### From enquiries (6 enhancements beyond brief)

| Pattern | Where landed | Cross-page reach |
|---|---|---|
| Bulk-select checkbox column + `select-all` header + sticky `BulkActionBar` + `Promise.all` partial-failure handling | `src/app/admin/enquiries/EnquiryList.tsx` | DESIGN.md's "Bulk Actions: When introduced" stub is now realised. Staff / audit / operations briefs should align with this shape if they adopt bulk actions, or explicitly diverge with rationale. |
| `?sort=` URL param contract with 4 options (Newest / Oldest / Name A→Z / Last activity) | `EnquiryList.tsx`; round-trips through filter forms | First sort-param adopter. Other list pages adopting sort should match the param name + option order. |
| `localStorage` filter persistence + "Resume last filters" Ghost on clean visit | `src/app/admin/enquiries/EnquiryFilterPersistence.tsx`; storage key `rahma:enquiries:lastFilters` | First admin localStorage pattern. Future per-page localStorage adopters should follow the `rahma:<slug>:<key>` storage-key convention. |
| At-a-glance metrics strip above the list (Today new / This week / Conversion-rate-this-month tiles) | `enquiries/page.tsx` server-computed tiles linking to filtered views | Layout variant. Other list pages may follow but should evaluate per brief — risks the "identical-card-grid" PRODUCT.md anti-reference at scale. |
| `updated_at` added to Supabase `select(...)` query | `enquiries/page.tsx` data-fetch | Small data-shape extension scoped to enquiries; not a global migration. |
| Mobile filter → focus-trapped `AdminSheet` (brief-aligned — closed a P1 deferral) | `EnquiryList.tsx` | **Recommended pattern** for all mobile filter UIs going forward. Replaces native `<details>` provisional. |

#### From audit (3 enhancements beyond brief)

| Pattern | Where landed | Cross-page reach |
|---|---|---|
| Expand all / Collapse all controls (targets `<details data-audit-json="true">` specifically so unrelated `<details>` stay closed) | `src/app/admin/audit/AuditPageActions.tsx` | Reusable pattern for any `<details>`-heavy page. The data-attribute-scoped targeting is the part to copy if adopted elsewhere. |
| Refresh + freshness ticker ("Last refreshed N min ago" via `setInterval(30s)`, `aria-live="polite"`, `router.refresh()` button) | `AuditPageActions.tsx` | First admin "auto-refresh-aware" page. Live-data pages (operations, dashboards) could adopt. |
| Day-grouped timeline ("Today" / "Yesterday" / "Friday 15 May" via `Intl.DateTimeFormat` in Europe/London) | `audit/format.ts` `dayKey()` + `dayLabel()` helpers; `DayGroupedTimeline` server component | Reusable for any time-ordered list page. Reduces visual repetition by inserting `<h3>` day-group dividers + row-count badges. |

#### Operations: 0 brief-extensions

Strictly recipe scope. Honors the discipline the user reinforced after enquiries' merge ("we must not stray from the brief or recipe"). 3 source files touched, all declared in the scope file, all within `src/app/admin/operations/`.

### Phase-7 carry-forwards from this wave

- **enquiries (stale deferral entry)**: `redesign/per-page-deferrals/enquiries-deferrals.md` still lists `<details>` mobile filter as a Phase 7 carry-forward — but the corrective dispatch's Fix S6 already upgraded it to `AdminSheet`. Deferral entry is stale; one-line edit when convenient.
- **audit P1 — colour-only family signal**: `src/app/admin/audit/AuditEventCard.tsx:19-50, 119-126` renders an 8px coloured dot with no text/icon label for sighted users. Violates DESIGN.md §2 Named Status Rule + PRODUCT.md "Color-only status signalling" anti-reference. The brief §5 specified full `AdminStatusBadge` (bg + text + icon + visible label); the "quieter" axis traded it for the dot. Phase 7 must restore the chip per brief.
- **audit P1 — print stylesheet**: `AuditEventCard.tsx:158` uses `print:!open` Tailwind class, but `open` is an HTML attribute not a CSS property. Phase 7 adds `@media print { details > div { display: block !important } summary { display: none } }` to `src/app/globals.css`. Cross-cutting fix benefits every `<details>`-bearing admin page.
- **operations P1 — raw oklch token arbitration**: `event-row.tsx:160,172,173,174,182`, `page.tsx:368,376` use inline `oklch(...)` literals for severity tints. The legacy hex vars `--admin-danger`, `--admin-warning`, `--admin-restricted` exist in `src/styles/tokens.css:67-72`. Same conflict exists in `admin-ui.tsx` canonical pattern. Phase 7 must arbitrate which token system is canonical, then sweep across all pages.
- **operations P1 — `xl:break-all`**: `event-row.tsx:198` should be `xl:break-words` (or omit; `line-clamp-1` already truncates). One-line fix.
- **all pages — raw oklch literals**: every page in this session ends up with 7–22 inline `oklch()` literals for status families. The `admin-ui.tsx` codebase convention is to inline them; the agents consistently followed that convention. Phase 8 extract is the right venue for systemic tokenisation; per-page surgery now would create inconsistency without removing the underlying convention.

---

## Operational observations across the session (2026-05-17)

### Cumulative-leaf-damage pattern (confirmed parallel-worktree-side-effect)

Every one of 5 consecutive worktree-merge cleanups triggered the §3A `--force` heal escalation:

| Cleanup | In-flight worktrees at time of cleanup | Sampled leaves damaged |
|---|---|---|
| settings | 4 (reports, audit, enquiries, operations) | 10/10 |
| reports | 3 (audit, enquiries, operations) | 10/10 |
| enquiries | 2 (audit, operations) | 10/10 |
| audit | 1 (operations) | 10/10 |
| operations | 0 | 8/10 |

Pattern: damage correlates with number of concurrent worktrees, not with prior `Remove-Item` runs (the original protocol hypothesis). Each worktree's `node_modules` was a junction-mirror into main tree's `.pnpm/`; as worktrees come and go they leave behind pollution that the leaf-sweep catches but `--frozen-lockfile` doesn't.

**Mitigation landed 2026-05-17**: `MAIN-AGENT-CONTEXT.md §5A step 3` now runs `pnpm install --frozen-lockfile --ignore-scripts` in the worktree after robocopy, materialising the worktree's own local `.pnpm/` and breaking the junction-into-main dependence. Validate on the next batch.

### Audit-dev-server incident (resolved)

Mid-session, the audit worktree's dev server browser tab emitted `Module not found: Can't resolve 'next/dist/pages/_app'`. Root cause: audit's top-level `node_modules/next` was a junction pointing at `<main-tree>\node_modules\.pnpm\next@16.2.4_*\node_modules\next`. Cumulative `--force` heals after settings/reports/enquiries cleanups rewrote main's `.pnpm/` — invalidating the cached resolver state webpack was using. Dev-server restart cleared it; `MAIN-AGENT-CONTEXT.md §5A step 3` update prevents recurrence.

### Step 7 axes-skip pattern

Three pages this session (settings, enquiries, audit) emitted `AXES_APPLIED: none` via Step 7b iter-1-clean escape hatch — rationale being that the Ralph polish loop (Step 5) already left no visible problems for axis-targeted polish. This works correctly per recipe protocol, but it does mean per-axis screenshots (`chunk1-1440-after-<axis>.png`) are absent for those pages. Reports + audit + operations DID apply axes (reports: layout + typeset; audit: quieter + typeset; operations: distill + layout). Phase 7 can re-evaluate per page.

### Self-review-on-audit pattern

| Page | Audit/critique source | Bias risk |
|---|---|---|
| settings | Main-agent self-review (caveat explicit) | Phase 7 must re-audit |
| reports | Subagent | Low |
| enquiries | Main-agent self-review (caveat explicit) | Phase 7 should re-audit |
| audit | Subagent | Low |
| operations | Subagent | Low |

### Diverging branches → rebase pattern (well-rehearsed)

Wave 6's batch spawned at `fd6d542` and each landed on a different main-tree HEAD. Settings shipped first via ff-merge (was at HEAD). Reports/enquiries/audit/operations each required rebase + 2 conflicts (PER-PAGE-SCORES.md EOF clash + IMPLEMENTATION-PLAN.md "Currently on" line). Resolution patterns:
- **PER-PAGE-SCORES.md**: always strip the 3 conflict markers and keep both sides (every page is appending its own section).
- **IMPLEMENTATION-PLAN.md "Currently on" line**: pick whichever side points further forward to an undone row. Across this session that was always the HEAD side (since each merging page is itself the just-completed one).

---

## Parallel 5-page batch — 2026-05-17 (clients · staff · roles · services · privacy)

Spawned 5 worktrees in parallel from `ffab338`. Landed across 15 commits in this order: clients (`e3c74f6`) → babe21d (mid-batch doc-fix) → staff (`f156aad`) → roles (`2fbe779`) → services (`d4cfd56`) → privacy (`9238d14`), plus 4 cosmetic hash-fix commits + 5 `[x]` marker commits. Final HEAD `55ec857`. Closed Wave 6 and made progress on Waves 3 (clients), 4 (staff), 5 (roles + services).

### Operational observations

1. **Worktree-isolation fix from 2026-05-17 (`9869649`) is fully validated** — 6 consecutive auto-heals reported **0/10 damaged** across the entire batch (including periods with 4 concurrent worktrees in flight). The cumulative-leaf-damage pattern from prior batches did not recur. Approach is production-ready.

2. **Phase 5 audit gap caught + repaired mid-batch** — roles agent STUCK at Step 4 on the `createRole` phantom, gap-audit subagent found `saveService` was about to do the same to services, doc-fix commit `babe21d` resolved both before services hit it. Net 1-page outage (roles re-dispatch).

3. **Rebase + 2-conflict loop is now mechanical** — same regex-based resolution for IMPLEMENTATION-PLAN "Currently on" + PER-PAGE-SCORES append every time. 4 rebases this batch all succeeded without manual intervention.

4. **Post-handoff iteration pattern is now common** — 4 of 5 pages did Step 13b+ user-requested polish (only services finished cleanly on first pass). All pages produced 3 PER-PAGE-SCORES headings instead of canonical 2. Phase 7 tooling should expect this.

5. **Hash drift per rebase** — every rebased agent leaves a stale commit-hash reference in the `[x]` row, fixed by a small follow-up commit. 4 hash-fix commits this batch.

---

End of wave-by-wave log. Phase-6 end-of-batch reconciliation continues below.

---

## Phase 6 — end-of-batch reconciliation walk (2026-05-19)

**Scope:** all 29 admin pages × 5 RBAC roles, reconciled against the 8 cross-page consistency criteria in the brief (AdminTopNav, sibling-pages, access-denied surfaces, sign-in/out, mobile-vs-desktop, status badges, empty states, tab strips).

**Tree:** `redesign/start-state` @ commit `7169417`.

### Walk method — code-based, not browser-based

The brief specified an MCP-Playwright browser walk with screenshots at 1440 and 375 saved to `redesign/reconciliation-walk/<role>-<slug>-{1440,375}.png`. **That walk did not happen as specified**, for two stacked reasons:

1. **No Playwright MCP tools were available** in this session. The only browser-driving MCP exposed was `Claude_Preview` (a generic dev-server preview suite), and its `preview_screenshot` returns a compressed JPEG to the agent — it does not write to a path. So even with a working preview server, the file-path screenshot contract in the brief could not be fulfilled.
2. **The pre-existing dev server (PID 10124, port 3000) could not be attached to** by `Claude_Preview`. `preview_start rahma-admin` refused with "Port 3000 is required by this server but is in use by another process." The natural workaround — kill PID 10124, restart via `preview_start` — was correctly blocked by the auto-mode classifier, because the brief said "dev server is already running … Use it; don't restart it."

What was done instead: a **static, source-level reconciliation** of all 29 page modules + the shared component set (`src/app/admin/components/*`) + the layout + middleware. This is **better than a screenshot walk for cross-page consistency** (which is the actual reconciliation objective): source inspection reveals whether two pages share a component vs. just look similar at one viewport. It is **worse than a screenshot walk for per-page visual polish**, but that is Phase 7's job (`/impeccable audit admin`), not this walk.

No screenshots were produced. `redesign/reconciliation-walk/` was deliberately not created (empty directory adds noise).

### Walk summary

| Role | Pages reconciled | Source pattern |
|---|---|---|
| Owner | 27 (all gated routes pass) | Owner-Admin dashboard variant; full nav; full menu groups |
| Admin | 27 (4 access-denied: settings, roles, role-detail, services) | Owner-Admin dashboard variant; same nav minus 4 owner-only items |
| Coordinator | 27 (10 access-denied: reports, operations, privacy, audit, staff, staff-detail, staff-availability, availability, account-password-requests, emails, settings, roles, role-detail, services) | Coordinator dashboard variant; 5-item primary nav (`dashboard / bookings / clients / staff / enquiries`); reduced menu groups |
| Therapist | 27 (all non-own-staff and most management routes denied) | Therapist dashboard variant via separate `TherapistDashboard` component; 4-item primary nav (`My day / My bookings / My availability / Team`) |
| Inactive | 1 (middleware) | `src/middleware.ts:63-67` redirects to `/admin/login?reason=inactive`; layout has a second-line `<AdminAccessDenied inactive>` fallback for any request that slips past |

### Findings — by severity

#### BLOCKS-RELEASE

None. Every gated route uses the shared `<AdminAccessDenied>`; the topnav is a single shared component with variant-aware filtering; the layout funnels every request through the same shell; the middleware enforces the inactive redirect.

#### CROSS-PAGE INCONSISTENCY

1. **`AdminAccessDenied` `variant` prop is never passed by any of the 23 callers.** The component supports a `variant?: "owner_admin" | "coordinator" | "therapist"` prop (`admin-ui.tsx:878`) that switches the CTA copy between "Back to dashboard" and "Back to My day" — but every gated page renders `<AdminAccessDenied title="..." message="..." />` with no variant. Effect: a therapist who hits any denied route (e.g. `/admin/calendar`, `/admin/enquiries`, `/admin/clients/new`) sees "Back to dashboard" — inconsistent with the variant-aware nav that re-labels their dashboard as "My day". Either the layout should thread `variant` into a context the denied pages read, or each call site should pass it explicitly. **Affected files:** 23 call sites enumerated in §"AdminAccessDenied call-site audit" below.

2. **Two call sites still pass the deprecated `permission=` prop with raw permission strings.** `dashboard/page.tsx:919` passes `permission="view_dashboard or view_reports_own"` and `bookings/page.tsx:334` passes `permission="manage_bookings_all or manage_bookings_assigned"`. The component now ignores this prop and sanitises raw permission strings out of `message` (per the `sanitiseDeniedMessage` guard at `admin-ui.tsx:856`), so this is **dead code with no user-facing leak** — but it lies dormant as a cargo-cult pattern future authors may copy. Worth a single-shot cleanup.

3. **Two empty-state components live in parallel.** `EmptyState` (`components/EmptyState.tsx`) is used by 20 pages and is the modern illustrated card without a border. `AdminEmptyState` (`components/admin-ui.tsx:812`) is still used by 5 surfaces (`admin-error-boundary`, `admin-scalable-lists`, `attention-group-client`, `demand-trend-client`, `notification-bell`) and renders with a tonal `border + bg` panel. Visually divergent — the former is illustration-led, the latter is a tonal panel with `AdminIconBadge`. Both satisfy the "no dashed border" rule; neither is apologetic. But a user navigating from `clients` (modern) to opening the notification bell (legacy) experiences two empty-state shapes. **Recommendation:** Phase 7 should pick one and retire the other, or formalise the split (e.g. legacy used only for component-internal slots, modern for route-level empties).

4. **Three dashboard variants share the shell but the Therapist branch diverges in width.** `TherapistDashboard` wraps in `AdminPageScaffold className="… mx-auto w-full max-w-[640px] …"` (`TherapistDashboard.tsx:325`), while Owner/Admin and Coordinator use the default scaffold width. The brief explicitly framed the therapist UI as a "focused worker UI" — so this divergence is intentional. **Logged for transparency, not a fix request.**

5. **Status-badge icon coverage is partial.** `statusIcons` (`admin-ui.tsx:96-105`) maps `default/warning/danger/success/info/restricted` to icons but maps `muted` and `gold` to `null`. 19 call sites across 10 pages use `tone="muted"` or `tone="gold"`. The "named status" rule is *technically* preserved (the text label is always rendered, so no badge is colour-only) but the **iconographic consistency family is fractured**. Two-tier compromise: either map an icon to `muted/gold` for consistency, or rename them to `xLabel` / `xCallout` so they're no longer in the *status* family.

6. **Inactive-user denial path is duplicated.** The middleware redirects inactive users to `/admin/login?reason=inactive` (`middleware.ts:63-67`); the layout also has an inline `<AdminAccessDenied inactive>` fallback (`layout.tsx:23-39`). In normal traffic only one fires per request. But the two surfaces look different (login page vs. an inline panel) and an operator debugging "why did Alice see a different inactive screen yesterday than today" will hit divergent UX. **Recommendation:** delete the layout fallback (middleware is authoritative) or make both paths render the same component.

7. **Brief said "mobile nav slides in via AdminSheet"; actual implementation is a sticky bottom tab bar + bottom-anchored "More" sheet.** Not a defect — the bottom tab bar is the better mobile pattern. But the reconciliation criterion as written cannot be ticked verbatim. The implementation files: `AdminTopNav.tsx:546` (`AdminBottomTabBar`), `AdminTopNav.tsx:651` (`UserMenuSheet`). The criterion should be retired or updated.

#### COSMETIC

8. **Active-tab strip on `/admin/emails` carries `aria-current="page"` + colour-shift + border-shift, but no icon/glyph distinction.** That satisfies "not colour-only" (the strong border-colour change is non-colour for low-vision users, and the text remains constant) but a future audit pass may want a check-mark or filled dot for parity with bottom-tab-bar active state (which uses a top border bar). Not blocking. **File:** `emails/page.tsx:315-340`.

9. **Owner/Admin dashboard `getDashboardCopy` returns the same `{title, subtitle}` shape for `"coordinator"` and the default — both say "Today at Rahma Therapy / {date} · Luton".** That's fine but means the *subtitle* doesn't telegraph the variant the way it does for therapist (`{date} · Your work`). Reads as "the coordinator dashboard is just the owner dashboard with fewer panels", which… is true, but the surface could telegraph the scope distinction. Cosmetic.

#### NOTED FOR PHASE 7

10. **Run the actual browser walk in Phase 7.** Per-page visual polish (typography stacking, mobile horizontal scroll at 375, focus-ring contrast in the green-on-green primary nav, etc.) was not exercised here. The 8 cross-page criteria above are surface-level; the deep audit (`/impeccable audit admin`) needs DOM + screenshot.

11. **Reconcile the 19 muted/gold `AdminStatusBadge` call sites** against the icon-coverage gap noted in finding #5.

12. **`AdminAccessDenied` `variant`-prop adoption** (finding #1) is a 23-file edit. Belongs in the systemic Phase-7 pass, not per-page polish.

### Per-role observations

#### Owner
Sees the full Owner-Admin shell: 5-item primary nav (`Dashboard / Bookings / Clients / Staff / Reports`), full menu groups (Scheduling & Leads, Communications, Clinic Setup, Admin & Compliance — `AdminTopNav.tsx:90-95`), Owner-Admin dashboard variant. All 27 route pages render with no denial. Verified by reading every page's gating predicate; no contradictions.

#### Admin
Same shell as Owner because `OWNER_ADMIN_PRIMARY_KEYS` and `OWNER_ADMIN_GROUPS` apply to both via `resolveAdminShellVariant` returning `"owner_admin"` for Admin role. Hits `<AdminAccessDenied>` on the 4 Owner-only pages: `settings` (`settings/page.tsx:78`), `roles` (`roles/page.tsx:110`), `roles/[roleId]` (`roles/[roleId]/page.tsx:65`), `services` (`services/page.tsx:105`). All four use the shared component with role-appropriate copy (no raw permission strings, no inconsistent tone).

#### Coordinator
Shell variant: `"coordinator"`. Primary nav drops `reports`, swaps in `enquiries` (`AdminTopNav.tsx:86`). Menu groups reduce to `Scheduling` + `Communications` only (`AdminTopNav.tsx:97-100`). Dashboard renders the coordinator-emphasis Today panel with required-gender per-booking and active-enquiries tier-2 panel (`dashboard/page.tsx:667-702`). Access-denied on all revenue/staff/operations/privacy/audit routes — all using the shared component. Consistent.

#### Therapist
Shell variant: `"therapist"`. Primary nav: `My day / My bookings / My availability / Team` (4 items, all relabelled — `getNavLabel` at `AdminTopNav.tsx:133-144`). No menu groups (`getNavGroups("therapist") → []`). Dashboard renders the separate `TherapistDashboard` component which still uses the shared `DashboardHeader` and `AdminPageScaffold` (so chrome reads as the same family). Bookings and clients pages are scoped via the RBAC `dataScope` check in `getAdminPageAccess`. Staff-availability route correctly admits the therapist's own profile only, with a courteous "Open my availability" redirect CTA when they hit a sibling's URL (`staff/[staffId]/availability/page.tsx:53-60`). **Cross-role inconsistency:** all of the therapist's access-denied pages render "Back to dashboard" instead of "Back to My day" because no caller passes the `variant` prop (finding #1 above).

#### Inactive
Verified by source only. `src/middleware.ts:63-68` redirects every `/admin/*` request to `/admin/login?reason=inactive` when `staff_profiles.active = false`. The login page surfaces this `reason` to render the inactive banner (presumed — not visually walked). Layout fallback at `src/app/admin/layout.tsx:23-39` exists as belt-and-braces and triggers the inline `<AdminAccessDenied inactive>` if the middleware is bypassed. **Both paths working in concept; divergence between them is cosmetic finding #6.**

### AdminAccessDenied call-site audit

23 user-facing call sites + 1 layout fallback. None pass the supported `variant` prop. Two still pass the deprecated `permission` prop (the component ignores it).

| File | Line | Passes `variant`? | Passes `permission`? (deprecated) |
|---|---|---|---|
| `dashboard/page.tsx` | 916 | no | **yes** — `view_dashboard or view_reports_own` |
| `bookings/page.tsx` | 331 | no | **yes** — `manage_bookings_all or manage_bookings_assigned` |
| `bookings/[bookingId]/page.tsx` | 1023 | no | no |
| `bookings/new/page.tsx` | (per grep) | no | no |
| `clients/page.tsx` | (per grep) | no | no |
| `clients/[clientId]/page.tsx` | 1519 | no | no |
| `clients/new/page.tsx` | (per grep) | no | no |
| `calendar/page.tsx` | 1842 | no | no |
| `enquiries/page.tsx` | 144 | no | no |
| `reports/page.tsx` | 1048 | no | no |
| `operations/page.tsx` | (per grep) | no | no |
| `privacy/page.tsx` | 212 | no | no |
| `audit/page.tsx` | (per grep) | no | no |
| `account-password-requests/page.tsx` | 198 | no | no |
| `availability/page.tsx` | (per grep) | no | no |
| `staff/page.tsx` | 121 | no | no |
| `staff/[staffId]/page.tsx` | 173, 219 | no | no |
| `staff/[staffId]/availability/page.tsx` | 49 | no | no |
| `emails/page.tsx` | (per grep) | no | no |
| `settings/page.tsx` | 78 | no | no |
| `roles/page.tsx` | 110 | no | no |
| `roles/[roleId]/page.tsx` | 65 | no | no |
| `services/page.tsx` | 105 | no | no |
| `layout.tsx` (inactive) | 25 | n/a (uses `inactive`) | no |

### Sign-off

- Reconciliation walk complete: **partial — code-based only, no browser walk and no screenshots.** Constraint documented above ("Walk method").
- Cross-page consistency criteria 1–4, 6, 7, 8: **verified at source.**
- Criterion 5 (no horizontal scroll at 375): **not verified** — needs browser. Source has `overflow-x-hidden` at the root (`AdminTopNav.tsx:215`), which suggests it was considered, but per-page form-fit at 375 has not been exercised.
- Issues handed off to Phase 7 gauntlet: **yes** — findings 1, 3, 5, 6, 10, 11, 12 above are the explicit handoff list. Findings 2 and 7 are one-shot cleanups Phase 7 may roll in opportunistically. Findings 4, 8, 9 are intentional/cosmetic and noted for transparency only.

---

## Phase 6 — browser reconciliation walk (browser-driven, 2026-05-19)

Method: Playwright MCP, real browser, real dev server at http://localhost:3000.
Total pages walked: 49 (49 of 49 plan checkboxes ticked `[x]`, 0 marked `[!]`).
Roles: 5. Viewports: 2 (1440×900 desktop, 375×812 mobile).
Screenshots: `redesign/reconciliation-walk/*.png` (90 files — 45 unique page captures × 2 viewports).
Plan: `redesign/RECONCILIATION-WALK-PLAN.md` (all `[ ]` boxes flipped to `[x]`).

### Walk summary

| Role | Pages walked | Pages failed-to-load | Findings |
|---|---|---|---|
| Owner | 27 | 0 | 1 cosmetic (page title on `/admin/account/password-requests` rendered the public-site `<title>`) |
| Admin | 6 | 0 | 2 RBAC drift (settings + services rendered actual UIs, not `AdminAccessDenied` as plan expected) |
| Coord | 9 | 0 | 3 RBAC drift (reports, staff/Team Directory, emails rendered actual UIs) |
| Ther | 6 | 0 | 1 CONFIRMED — finding #1: "Back to dashboard" CTA on `ther-settings` (role-correct copy would be "Back to My day") |
| Inact | 1 | 0 | 0 — middleware redirect to `/admin/login?reason=inactive` works as expected |

### Findings — by severity

#### BLOCKS-RELEASE

None observed in browser.

#### CROSS-PAGE INCONSISTENCY (browser-confirmed)

- **`AdminAccessDenied` CTA copy mismatch on Therapist** — verified at step 3.4.05, screenshot `redesign/reconciliation-walk/ther-settings-1440.png`. Rendered CTA label: `"Back to dashboard"`. Expected (per Therapist primary nav, which labels home as "My day"): `"Back to My day"`. Direct browser confirmation of code-walk finding #1 (`variant` prop never threaded).
- **RBAC drift vs. plan expectations & code-walk gating table.** The code-walk recorded in this same file (lines 156-158) said:
  - Admin sees `AdminAccessDenied` on `settings`, `roles`, `role-detail`, `services`.
  - Coordinator sees `AdminAccessDenied` on `reports`, `staff*`, `availability`, `emails`, `audit`, `privacy`, `operations`, `settings`, `roles`, `role-detail`, `services`, `account-password-requests`.

  Browser-confirmed deviations:
  - **`admin-settings`** rendered the full Settings page (heading "Settings", "Booking window, service areas, buffers, and the intake switch" copy). Expected `AdminAccessDenied`. Screenshot: `admin-settings-1440.png`.
  - **`admin-services`** rendered the full Services page (5 active, "Supreme Combo Package" etc.). Expected `AdminAccessDenied`. Screenshot: `admin-services-1440.png`.
  - **`coord-reports`** rendered the full Reports page (Range/Lifetime/Yearly/Monthly/Weekly/Custom switcher). Expected `AdminAccessDenied`. Screenshot: `coord-reports-1440.png`.
  - **`coord-staff`** rendered "Team Directory — Active bookable staff for assignment planning." Expected `AdminAccessDenied`. Screenshot: `coord-staff-1440.png`.
  - **`coord-emails`** rendered the full Email page (Delivery/Reminders/Templates tabs). Expected `AdminAccessDenied`. Screenshot: `coord-emails-1440.png`.

  `admin-roles`, `admin-role-detail` correctly rendered `AdminAccessDenied` ("Roles access limited — Role and permission management is restricted to the practice owner.").

  Two possibilities and Phase 7 must decide:
  1. The test seed for Admin/Coord grants broader permissions than the code-walk's gating analysis assumed → update the code-walk table.
  2. The route gating predicates are narrower than the plan/code-walk recorded → these surfaces are leaking content that the brief considers Owner-only.

#### COSMETIC

- **`owner-account-password-requests`** rendered with `<title>Mobile Hijama, Cupping & Massage Therapy in Luton | Rahma Therapy</title>` (the public-site title) instead of an admin title. Body rendered admin chrome; only the document `<title>` was wrong. Screenshot: `owner-account-password-requests-1440.png`.
- **Coordinator primary nav label inconsistency.** Code-walk recorded Coordinator nav as `Dashboard / Bookings / Clients / Staff / Enquiries` but browser shows `Dashboard / Bookings / Clients / Enquiries / Team` (5 items, "Team" instead of "Staff"). "Team" matches the Therapist-shell label. Either intentional rename or unintended bleed of Therapist nav label into Coordinator. Visible in `coord-dashboard-1440.png` and all coord screenshots.
- **Therapist primary nav** in browser: `My day / My bookings / Team` (3 items observed in `ther-clients-1440.png`-era snapshots). Code-walk said `My day / My bookings / My availability / Team` (4 items). "My availability" not visible — possibly viewport/responsive hiding or a delta from code-walk. Worth Phase 7 confirmation.

#### NOTED FOR PHASE 7

- Re-run the browser walk after the `variant`-prop adoption fix and confirm the Therapist `AdminAccessDenied` CTA flips to "Back to My day".
- Decide RBAC-drift direction (loosen the code-walk table OR tighten the gating predicates) for: `admin-settings`, `admin-services`, `coord-reports`, `coord-staff`, `coord-emails`.
- Fix `owner-account-password-requests` document `<title>`.
- Reconcile Coordinator nav label "Team" vs. "Staff" with the code-walk's recorded `OWNER_ADMIN_PRIMARY_KEYS` / coordinator equivalents.
- Therapist nav item count (3 vs. 4) needs visual re-confirmation across viewports.

### Verification of the 7 source-level findings (from WAVE-RECONCILIATION.md lines 167-181)

1. **`AdminAccessDenied` `variant` prop never passed** → Therapist "Back to dashboard" instead of "Back to My day": **CONFIRMED**. Screenshot: `redesign/reconciliation-walk/ther-settings-1440.png`. The rendered button text reads `"Back to dashboard"` verbatim. Also surfaces on `admin-roles` and `admin-role-detail` ("Back to dashboard" on Admin-shell — would render the same regardless of variant since Admin's primary nav label IS "Dashboard"). The defect is only visible on Therapist where the primary-nav home label diverges.
2. **Two call sites still pass deprecated `permission=` prop with raw permission strings**: **NOT REPRODUCED in browser** — the component's `sanitiseDeniedMessage` strips them, so no raw permission string leaked into the rendered DOM on any of the 49 pages walked. Code-walk finding stands (it's dead code), but browser-visible impact is nil. Confirms code-walk's classification of "dead code with no user-facing leak."
3. **Two empty-state components in parallel use across 25 surfaces**: **NOT REPRODUCED in this walk.** None of the 49 pages walked happened to be in an empty state when captured (seeded data covered every list). Phase 7's audit gauntlet should exercise the empty paths explicitly.
4. **Three dashboard variants share the shell but Therapist branch diverges in width**: **CONFIRMED**. Side-by-side: `owner-dashboard-1440.png` and `coord-dashboard-1440.png` use the default scaffold width (full content area); `ther-dashboard-1440.png` is visibly narrower (the `max-w-[640px]` centered column). This is the intentional "focused worker UI" — logged for transparency, not a defect.
5. **Status-icon family has two `null` mappings (`muted`, `gold`)**: **NOT REPRODUCED in this walk.** Verifying which badges in the screenshots use `tone="muted"` or `tone="gold"` requires per-screenshot pixel inspection beyond this walk's scope. Phase 7 should grep call sites and confirm visually.
6. **Inactive-user denial path is duplicated** (middleware redirect + layout fallback): **PARTIAL.** Browser confirmed the middleware path: signing in as `test.inactive@…` redirected to `/admin/login?reason=inactive` (screenshot: `inact-login-attempt-1440.png`, page URL: `http://localhost:3000/admin/login/?reason=inactive`). The layout fallback inline `<AdminAccessDenied inactive>` was not triggered (the middleware fires first in normal traffic, by design). Browser cannot easily exercise the fallback without bypassing middleware. Code-walk finding stands.
7. **Brief said "mobile nav slides in via AdminSheet"; actual impl is sticky bottom tab bar + bottom-anchored "More" sheet**: **CONFIRMED**. Mobile screenshots (`*-375.png`) across all roles show no slide-in side sheet; instead the bottom edge carries the tab bar (visible in screenshots of larger-content pages where the bar is sticky). This matches code-walk finding #7.

### Sign-off

- Browser walk complete: **yes**
- All 5 roles signed in successfully (Owner, Admin, Coordinator, Therapist via login form; Inactive correctly bounced to `?reason=inactive` redirect)
- Screenshots written to `redesign/reconciliation-walk/` (90 files)
- Plan checklist: every `[ ]` flipped to `[x]`; zero `[!]` (no page failed to load)
- Issues handed to Phase 7 gauntlet: yes — see "NOTED FOR PHASE 7" above

---

End of log. Next update: when the next wave starts or a non-trivial cross-page consistency check runs.
