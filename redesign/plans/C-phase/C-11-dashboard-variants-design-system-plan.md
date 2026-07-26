# C-11 — Dashboard variants + design system + dark mode + motion-reduce — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: C-FIELDWORK (hard — verify `git log --oneline --grep="C-FIELDWORK" | grep -q "feat(redesign)"` AND both `src/app/admin/dashboard/PractitionerTodaySection.tsx` + `src/app/admin/dashboard/shared-helpers.ts` exist; absent as of 2026-07-26, so pre-flight #5 WILL stop until C-FIELDWORK ships).
> Decisions: C-B-DECISIONS.md §2 Q11 + §3 C-11; checkpoint resolutions D8/D9/D10 (2026-07-26). Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-11-dashboard-variants-design-system-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-11-dashboard-variants-design-system-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** *(Amended 2026-07-26 — C11-F1.)* On `master`; HEAD at or descended from `ea97932`; verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/ supabase/migrations/` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted .playwright-mcp logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. **Dev server reachable.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing. *(The 6 pre-existing failures in 3 files — ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1 — are THE baseline; preserve, don't fix.)*
4. **Static gates green.** *(Amended 2026-07-26 — C11-F2.)* `npx tsc --noEmit` — 0 errors. `pnpm lint` — no NEW errors vs the 59-error baseline (55 from untracked `design_handoff_area_pages/prototype/*.jsx`, 4 pre-existing in `src/features/booking/`).
5. **C-FIELDWORK must be merged.** Verify:

   ```bash
   git log --oneline | grep -i "C-FIELDWORK"
   # Expect: the C-FIELDWORK implementation commits in HEAD.
   ls src/app/admin/dashboard/PractitionerTodaySection.tsx
   ls src/app/admin/dashboard/shared-helpers.ts
   # Both files exist.
   ```

   If C-FIELDWORK isn't merged, **stop** — C-11 imports its outputs.

6. **DB verification:**

   ```sql
   -- (a) staff_profiles.theme_preference does not yet exist
   SELECT column_name FROM information_schema.columns
   WHERE table_name='staff_profiles' AND column_name='theme_preference';
   -- Expected: 0 rows

   -- (b) Inventory current staff_profiles for backfill confirmation
   SELECT email, can_take_bookings FROM staff_profiles ORDER BY email;
   ```

7. **`animate-spin` inventory:**

   ```bash
   git grep -nE "animate-spin" src/app/admin/ | wc -l
   # Approx count for the motion-reduce sweep scope
   git grep -nE "animate-spin" src/app/admin/ | grep -v "motion-reduce" | wc -l
   # Approx count of MISSING motion-reduce guards
   ```

   Record both numbers in the progress file. *(Create `redesign/per-page-progress/C-11-dashboard-variants-design-system-progress.md` now if absent — it does not exist as of 2026-07-26 and no earlier step creates it.)*

   *(Verified 2026-07-26 — C11-F5: 60 instances across 39 files; 59 lack `motion-reduce` — only `AuditPageActions.tsx:80` has it. Plan's original "~30" estimate was low. Per D8, the sweep itself is demoted to optional hygiene — see the Phase F wrapper.)*

7b. **Hardcoded-color inventory (admin-wide):**

   ```bash
   # OKLCH literals (excludes those already inside var() definitions, which are fine)
   git grep -nE "oklch\\(" src/app/admin/ | grep -v "globals.css\\|admin-theme" | wc -l

   # Hex literals
   git grep -nE "#[0-9a-fA-F]{3,8}\\b" src/app/admin/ | wc -l

   # rgb / rgba literals
   git grep -nE "rgb\\(|rgba\\(" src/app/admin/ | wc -l

   # Per-file breakdown for the sweep targets
   git grep -lE "oklch\\(|#[0-9a-fA-F]{6}\\b" src/app/admin/ | head -30
   ```

   Record the counts + per-file list in the progress file. These are the files where Phase E Step 11b sweeps hardcoded colors → CSS variables.

   *(Verified 2026-07-26 — C11-F6: 98 files under `src/app/admin/` match oklch/hex; 520 `oklch(` lines. Per D9 the C-11 sweep is TRIMMED — see Step 11b amendment.)*

   **Scope extension (C11-F7):** the greps above exclude `globals.css`, but admin-styling literals also live in `src/app/globals.css` OUTSIDE the shared `:root`: `.admin-action-primary` `#ffffff !important` (L266), `.admin-action-outline` `#ffffff` (L284), `.admin-nav-surface` `#ffffff` (L222, L338), `.admin-nav-link` `rgba()` (L342-350), `.admin-shell::before` oklch gradient (L33-37). Also run:

   ```bash
   git grep -nE "oklch\\(|#[0-9a-fA-F]{3,8}\\b|rgb\\(|rgba\\(" src/app/globals.css | grep -n "admin"
   ```

   and add the admin-scoped hits to the sweep target list (re-grep — line numbers may have shifted).

7c. **Admin surface inventory** (for the verification sweep):

   ```bash
   # Top-level admin routes — Phase G Playwright walks one representative page per section
   ls -d src/app/admin/*/ src/app/admin/*/[*]/ 2>/dev/null | sort
   ```

   Confirm at least these surfaces are reachable + theme-relevant:
   - `/admin/dashboard`
   - `/admin/bookings` + `/admin/bookings/[id]` + `/admin/bookings/new`
   - `/admin/clients` + `/admin/clients/[id]` + `/admin/clients/new`
   - `/admin/calendar`
   - `/admin/enquiries`
   - `/admin/staff` + `/admin/staff/[id]` + `/admin/staff/[id]/availability` + `/admin/staff/[id]/performance`
   - `/admin/availability` (global)
   - `/admin/reports`
   - `/admin/emails` + `/admin/email-templates/preview/[id]`
   - `/admin/services`
   - `/admin/settings`
   - `/admin/operations`
   - `/admin/roles` + `/admin/roles/[id]`
   - `/admin/privacy`
   - `/admin/audit`
   - `/admin/account-password-requests`
   - `/admin/me`
   - `/admin/login` (theme not applied here — pre-auth; document if any styling looks off)

   The dark mode applies to ALL of these uniformly. Phase G Playwright walks at least one page from each section.

8. **Theme infrastructure absence confirmed:**

   ```bash
   git grep -nE "dark:|prefers-color-scheme|data-theme|useTheme|ThemeProvider" src/
   # Expected: 0 hits (or only false positives like CSS comments).
   ```

9. **Bundle baseline:**

   ```bash
   pnpm build && node scripts/measure-admin-bundles.mjs > /tmp/c11-pre-bundle.txt
   ```

   Capture `/admin/dashboard` bundle size for delta comparison in §3.1.

10. **Test fixture inventory:**
    - At least one of each role active.
    - Owner test account ready for dual-view + theme toggle E2E.

```
DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.
```

If any pre-flight check fails (especially #5 C-FIELDWORK dependency), **stop** and surface to user.

---

## 1 — Safe implementation order (7 phases, 8 work areas — phased to ship in isolation)

Each phase is a self-contained commit. C-C can pause + resume between phases without breaking the build.

### Phase A — Shared building blocks library (work area 1)

**Step 1 — Create `src/app/admin/dashboard/blocks/` directory** with one file per block. Each is **render-only** (no data fetching, no side effects). Lift JSX from `page.tsx` inline branches + existing dashboard components.

Files to create (each with co-located `.test.tsx`):

```
blocks/
  DashboardHeader.tsx        ← consumes shared-helpers.ts getGreeting()
  EmptyState.tsx              ← lifts the existing components/EmptyState.tsx or creates new
  QuickHelpPanel.tsx          ← extends the existing QuickHelpPanel with per-variant content slots
  RevenueStripe.tsx
  EnquiriesTodoStripe.tsx
  ClaimQueueStripe.tsx
  PendingBookingsStripe.tsx
  ScheduleGapStripe.tsx
  RecentActivityStripe.tsx
  MobileStickyActionBar.tsx   ← lifts mobileStickyActionForVariant logic into a component
  index.ts                     ← barrel export
```

**Block contract (per brief §2.1):**
- Render-only: data via props.
- Each block has 2-3 stories: full / empty / loading (the latter only where applicable).
- No CSS modules; use existing admin-theme CSS variables for full theme compatibility.

**Lift sources (verify during impl):**
- `RevenueStripe` ← lift from `dashboard-cards.tsx` revenue tile cluster.
- `PendingBookingsStripe` ← lift from `page.tsx` "Needs your attention" rendering.
- `EnquiriesTodoStripe` ← lift from coord-variant `<ActiveEnquiriesCard>`.
- `ClaimQueueStripe` ← derive from `data.bookings.filter(unassigned)` pattern.
- `RecentActivityStripe` ← lift from `page.tsx` Recent Activity panel.
- `ScheduleGapStripe` ← NEW (no existing analogue; derive from `nextSevenDays` + staff availability).
- `MobileStickyActionBar` ← lift from `mobileStickyActionForVariant` (`page.tsx:611`) + existing rendering.
- `DashboardHeader` ← consume `shared-helpers.ts` (from C-FIELDWORK) — `getGreeting()` + `FORMATTERS`.
- `QuickHelpPanel` ← extend existing `dashboard/QuickHelpPanel.tsx` to accept a `variant` prop + per-variant content via slots OR a `links` array prop.

> **Build reality 2026-07-26 (C11-F8) — reuse/move, don't re-lift:**
> - `MobileStickyActionBar.tsx` ALREADY EXISTS as a render-only component at `src/app/admin/dashboard/MobileStickyActionBar.tsx` (used from `page.tsx:682` + `:1003`). The helper `mobileStickyActionForVariant` lives in `dashboard-helpers-b5.ts:263` — `page.tsx:611` is only a call site. Move/re-export the existing component into `blocks/` rather than re-lifting.
> - `DashboardHeader`: `src/app/admin/dashboard/dashboard-header.tsx` already exists (consumed at `TherapistDashboard.tsx:434`) — extend/move it rather than creating from scratch.
> - `EmptyState`: `src/app/admin/components/EmptyState.tsx` exists and is imported at `TherapistDashboard.tsx:25`.
> - `QuickHelpPanel` already accepts a `links` array prop (`TherapistDashboard.tsx:553`) — verify before extending.
> Re-grep all anchors at impl time; prior Band C plans may have shifted line positions.

**Step 2 — Vitest specs per block.**

For each block in `blocks/__tests__/`, cover:
- Renders happy-path props correctly
- Renders empty state when no data
- Conditional logic per role / capability

Pattern: render → assert key text + button labels. Don't over-test layout.

**Phase A verify checkpoint:**
- `pnpm lint` + `tsc` + `vitest run` green
- Storybook (if configured) renders each block
- No new use in `page.tsx` yet — blocks are dormant until Phase B/C wires them.

### Phase B — BusinessDashboard.tsx extraction (work area 2 + 8 part 1)

**Step 3 — Create `src/app/admin/dashboard/BusinessDashboard.tsx`.**

Move the inline Business + Coord branch from `page.tsx:~650-1017` into this file. **Two sub-steps for safety:**

3a. **Verbatim move** — extract code as-is into `BusinessDashboard.tsx`. `page.tsx` calls `<BusinessDashboard {...props} />`. Verify Playwright: dashboard renders identically (no behavioural change).

3b. **Compose from blocks** — replace inline rendering with imports from `blocks/`. The composition should match brief §4.1 layout. **This is where V-01 reconciliation happens:**
- Collapse "Snapshot · Today" into `DashboardHeader` (header strip carries today's count).
- Promote "Needs your attention" → `PendingBookingsStripe` (primary actionable stripe).
- Demote "Operations Health" → wrap in a `<details>` disclosure ("Health check ▾").

**Step 4 — `BusinessDashboard.tsx` props interface.**

```ts
interface BusinessDashboardProps {
  staffName: string;
  today: string;
  data: ReportData;
  summary: ReturnType<typeof summarizeReports>;
  attentionItems: ReturnType<typeof getAttentionItems>;
  todayAppointments: ReportData["bookings"];
  upcomingInRange: ReportData["bookings"];
  nextSevenDays: ReportData["bookings"];
  needsAssignment: ReportData["bookings"];
  unassignedOnly: ReportData["bookings"];
  unpaidBookings: ReportData["bookings"];
  rangeLabel: string;
  preservedSearchParams: Record<string, string>;
  // B-5 stripe inputs
  stripeTiles: PersonalStripeTile[];
  stripeScorecard: StaffScorecard;
  stripePriorScorecard?: StaffScorecard;
  contribStripeRange: StripeRange;
  stripeStickyAction: MobileStickyAction | null;
  // RBAC + capability flags
  canViewRevenue: boolean;
  canTakeBookings: boolean;
  // PractitionerTodaySection inputs (from C-FIELDWORK) — conditional on canTakeBookings
  practitionerNextAppointment?: ReportData["bookings"][number] | null;
  practitionerClaimableCount?: number;
  // Today view, etc.
  todayView: "list" | "timeline";
  // Quick-help permissions for the QuickHelpPanel
  quickHelpPermissions: QuickHelpPermissions;
}
```

Tight interface; props are the bridge between `page.tsx` data fetching and the variant composition.

**Step 5 — Wire `page.tsx` to call BusinessDashboard.**

Replace the inline rendering (~400 lines) with:

```tsx
return (
  <BusinessDashboard
    staffName={profile.name}
    today={today}
    data={data}
    summary={summary}
    {...moreProps}
  />
);
```

**Phase B verify checkpoint:**
- `pnpm lint` + `tsc` green
- Playwright sweep: Owner + Admin → BusinessDashboard renders. V-01 reconciliation applied (Health check collapsed by default).
- Visual regression: no broken layout at 375 / 1280.

### Phase C — CoordinatorDashboard.tsx extraction (work area 3 + 8 part 2)

**Step 6 — Create `src/app/admin/dashboard/CoordinatorDashboard.tsx`.**

Same pattern as Phase B. Two sub-steps: verbatim move, then compose-from-blocks.

**B-01 fix during composition:** the literal "()" rendering bug per audit #01. Find the source in the lifted JSX — likely a parenthetical wrapping a falsy value. Conditional render:

```tsx
{secondaryValue ? <span>({secondaryValue})</span> : null}
```

**Step 7 — Wire `page.tsx` to call CoordinatorDashboard.**

Same pattern as Step 5.

After this, `page.tsx` has:

```tsx
const Variant =
  plan.variant === "therapist" ? TherapistDashboard
  : plan.variant === "coordinator" ? CoordinatorDashboard
  : BusinessDashboard;

return (
  <PullToRefresh enabled={plan.variant === "therapist"}>
    <Variant {...variantProps} />
  </PullToRefresh>
);
```

**Phase C verify checkpoint:**
- Lint + tsc green.
- Playwright: Coord → CoordinatorDashboard renders. B-01 parens bug gone.
- `page.tsx` LOC count ~300-400 (was 1017). Verify.

### Phase D — TherapistDashboard refactor (work area 4)

**Step 8 — Refactor `TherapistDashboard.tsx` to consume shared blocks.**

C-FIELDWORK already extracted today + next-appt into `PractitionerTodaySection`. Now extract the remaining inline blocks:

- Inline header (lines ~145-200) → use `DashboardHeader` block.
- Inline empty-state cards → use `EmptyState` block.
- `MobileStickyActionBar` → use shared block.

`QuickHelpPanel` already exists separately — verify it doesn't need further changes (it might already be variant-aware if `quickHelpLinksForTherapist` is passed in).

> **Build reality 2026-07-26 (C11-F8):** parts of this step are already done on `ea97932` — `TherapistDashboard.tsx` already consumes `dashboard-header.tsx` (`:434`) and `components/EmptyState.tsx` (imported `:25`), and `MobileStickyActionBar.tsx` is already a separate render-only component. "Inline header (lines ~145-200)" is stale: lines 145-200 are a helper map, not a header; the inline `getGreeting`/`FORMATTERS` helpers sit at `TherapistDashboard.tsx:75-90` pending the C-FIELDWORK lift. The remaining work here is re-pointing these existing components at `blocks/` (or re-exporting) — re-grep anchors before editing.

Result: TherapistDashboard.tsx shrinks from ~1361 to ~250-400 lines. The rest is in `blocks/`.

**Step 9 — Visual regression sweep — Therapist dashboard.**

Playwright at 375 / 768 / 1280 / 1440 + Therapist account. Compare against pre-refactor screenshots:
- Identical ProfileCompletionNudge rendering
- Identical Personal Stripe
- Identical Recent Clients Strip
- Identical Quick Help Panel
- Identical pull-to-refresh tip + sticky action bar

**Phase D verify checkpoint:**
- Lint + tsc + vitest green.
- Therapist visual regression passes.

### Phase E — Dark mode infrastructure (work area 6)

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: apply migration `<ts>_c11_theme_preference.sql` (ALTER TABLE `staff_profiles` ADD COLUMN `theme_preference` + CHECK constraint) to the production Supabase project via `mcp__supabase__apply_migration`.
> Exact SQL / change: verbatim in the Step 10 body below.
> Post-action verification: `SELECT column_name FROM information_schema.columns WHERE table_name='staff_profiles' AND column_name='theme_preference';` → 1 row; constraint `staff_profiles_theme_preference_check` present in `information_schema.check_constraints`.
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 10 — Migration: `staff_profiles.theme_preference`.**

New file: `supabase/migrations/<ts>_c11_theme_preference.sql`:

```sql
BEGIN;

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS theme_preference text;

ALTER TABLE public.staff_profiles
  DROP CONSTRAINT IF EXISTS staff_profiles_theme_preference_check;

ALTER TABLE public.staff_profiles
  ADD CONSTRAINT staff_profiles_theme_preference_check
  CHECK (theme_preference IS NULL OR theme_preference IN ('dark', 'light', 'system'));

COMMIT;
```

Apply via `mcp__supabase__apply_migration`. **Zone-2 — explicit user confirmation.**

Post-migration: `mcp__supabase__generate_typescript_types`.

> ⛔ **SUPERSEDED — DO NOT IMPLEMENT THIS STEP'S CSS BLOCK (2026-07-26; C11-F11 + C11-F3, collision map §6)** ⛔
> Post-merge, ALL `--admin-*` variables live in `src/styles/tokens.css:61-196`, inside the SAME `:root` block as the public `--rahma-*`/shadcn tokens (imported via `globals.css:4`; `globals.css` defines no CSS variables; `admin-theme.css` does not exist anywhere in `src/`). Implementing the dark-at-`:root` block below would dark-flip EVERY public page site-wide (home, about, services, reviews, FAQs, areas, the booking dialog).
> Step 11a below — light at `:root`, dark scoped under `[data-theme="dark"]`, targeting ONLY the `--admin-*` family — is the ONLY safe implementation. Executor: skip directly to Step 11a. Original Step 11 text preserved below for reference only.

**Step 11 — CSS variable duplication.**

Edit `src/app/globals.css` (or `admin-theme.css` — verify the canonical location during impl). Structure:

```css
/* Default = dark theme */
:root {
  --admin-bg: oklch(15% 0.012 88);
  --admin-panel: oklch(20% 0.008 88);
  --admin-heading: oklch(95% 0.018 88);
  --admin-body: oklch(85% 0.012 88);
  --admin-text-muted: oklch(65% 0.010 88);
  --admin-border: oklch(28% 0.010 88);
  --admin-primary: oklch(72% 0.105 80);
  /* ... every existing --admin-* variable gets a dark-counterpart value */
}

[data-theme="light"] {
  --admin-bg: oklch(97% 0.018 88);
  --admin-panel: oklch(99% 0.005 88);
  --admin-heading: oklch(13% 0.015 88);
  /* ... light counterparts */
}

[data-theme="dark"] {
  /* Same as :root defaults — explicit selector for stable cascade */
  --admin-bg: oklch(15% 0.012 88);
  /* ... */
}

@media print {
  :root, [data-theme="dark"] {
    /* Print always uses light theme — toner-friendly */
    --admin-bg: white;
    --admin-panel: white;
    --admin-heading: black;
    /* ... */
  }
}
```

**Plan locks: dark is the root default.** `[data-theme="dark"]` selector is redundant but explicit for cascade clarity. `[data-theme="light"]` triggers light. Absence of `data-theme` (e.g., during FOUC) falls through to `:root` (dark). Designer + WCAG verification at impl time confirms exact OKLCH values.

**Admin-wide scope of the CSS variable change:** `:root` selectors apply globally to every page. The variable remapping in `globals.css` automatically cascades to every admin route under `/admin/*` (and to public routes too, since the selectors aren't admin-scoped). To prevent the public booking site from inheriting the dark theme unintentionally, **Step 11a (NEW)** below scopes the dark theme to the admin tree.

**Step 11a — Scope the dark theme to admin pages only.**

> **File target (2026-07-26 — C11-F3):** the canonical location is `src/styles/tokens.css` — `--admin-canvas` at `:61` through the end of the `--admin-*` family at `:196`, inside the shared `:root` (imported via `globals.css:4`). Dark overrides MUST target only the `--admin-*` family — the public site's `--rahma-*`/shadcn values share the same `:root` and must not flip. Verify after editing: `git grep -n "data-theme" src/styles/tokens.css` shows the `[data-theme="dark"]` block containing ONLY `--admin-*` variables.
> **Coordination note (collision map §6, verbatim):** "tokens.css's `:root` block is shared with the public site post-merge (this was not true pre-merge — do not trust any pre-merge plan text describing separate admin/public CSS scopes). Delete Step 11's dark-at-`:root` block; Step 11a's light-default/`[data-theme="dark"]`-scoped approach is the only safe implementation. Extend the hardcoded-color sweep's grep scope to include `src/app/globals.css`, not just `src/app/admin/**`."

Wrap the dark theme CSS variables under a more specific selector so the public site keeps its current single theme:

```css
/* Light theme defaults at :root — covers public site + admin in 'light' mode */
:root {
  --admin-bg: oklch(97% 0.018 88);
  /* ... light values for every --admin-* variable */
}

/* Dark theme — ONLY applies under the admin tree's data-theme attribute.
   The admin layout sets data-theme on <html>; this selector targets when
   the active theme is 'dark'. */
[data-theme="dark"] {
  --admin-bg: oklch(15% 0.012 88);
  /* ... dark values */
}

[data-theme="light"] {
  /* Redundant with :root but explicit; ensures admin's 'light' choice
     doesn't accidentally inherit a future :root change. */
  --admin-bg: oklch(97% 0.018 88);
  /* ... light values (matches :root) */
}

@media print {
  :root, [data-theme="dark"], [data-theme="light"] {
    --admin-bg: white;
    --admin-heading: black;
    /* ... print overrides */
  }
}
```

**Decision: light is the `:root` default, dark is selector-triggered.** This flips the earlier brief framing (which said `:root` = dark default). The flip is necessary so the public site (which doesn't set `data-theme`) stays in its current appearance unchanged. The admin layout sets `<html data-theme="dark">` server-side by default for admin pages, achieving the user-facing "dark default in the admin" goal.

> **Correction (2026-07-26 — C11-F10, verifier-confirmed):** the sentence above is wrong as written — `src/app/admin/layout.tsx` is a NESTED layout (returns `<AdminTopNav>{children}</AdminTopNav>`, no `<html>`/`<body>`; only the root layout owns `<html>`), so it CANNOT set `data-theme` on `<html>` server-side. The dark-default-in-admin goal is achieved client-side by the inline FOUC script (Step 15 as amended per D10), which sets `document.documentElement.dataset.theme` early in the body stream.

**FOUC mitigation script** (Step 15 — adjusted): sets `data-theme="dark"` on `<html>` by default for the admin tree before React hydrates, OR `"light"` / `"system"` based on localStorage mirror. The script only runs on admin pages (gated by route check inside the script — or simply because the script lives in `src/app/admin/layout.tsx`).

**Step 11b — Hardcoded-color sweep (admin-wide).**

> **Amended 2026-07-26 (D9 — Owner approved; C11-F6):** the verified inventory is 98 files / 520 `oklch(` lines under `src/app/admin/` (~7x the original ~10-15-file estimate). C-11's sweep is TRIMMED to the files the variant extraction actually touches — `dashboard/page.tsx`, `TherapistDashboard.tsx`, the new `blocks/` + variant files, `dashboard-cards.tsx`, `dashboard-filters-client.tsx`, plus the chart-fill/LTV-ribbon helpers audited per §4.3 — AND the `src/app/globals.css` admin-scoped literals (C11-F7: `.admin-action-primary` `#ffffff` L266, `.admin-action-outline` `#ffffff` L284, `.admin-nav-surface` `#ffffff` L222/L338, `.admin-nav-link` `rgba()` L342-350, `.admin-shell::before` oklch gradient L33-37 — re-grep before editing; these would stay light-stuck in dark theme otherwise). The remaining ~90-file admin-wide sweep is explicitly logged for C-12+ — do NOT silently drop it: record the deferred per-file list in the progress file.

Run the inventory from §0 Step 7b. For each file with hardcoded OKLCH / hex / RGB literals:

1. **Read the file in context.** Determine the colour's intent:
   - Brand colour (Rahma Gold, status tones) — keep, OR migrate to a `--admin-status-*` variable if not already.
   - Surface colour (background, border, text) — migrate to existing `--admin-bg` / `--admin-panel` / `--admin-border` / `--admin-heading` etc.
   - Dynamic colour (avatar tints, deterministic-hue) — usually theme-neutral; keep as-is.
2. **Apply the migration** with a small refactor commit per logical group of files (e.g., "Migrate status badge colours to CSS variables").
3. **Verify visually** at impl time — the existing light-theme rendering should be byte-identical post-migration (variables resolve to the same values).
4. **Add dark counterparts** to `src/styles/tokens.css` for any new variable introduced (path corrected 2026-07-26 per C11-F3 — the `--admin-*` family lives there, not in `globals.css`; scope dark values under `[data-theme="dark"]`).

**Phase E sub-commit cadence:** these can ship as separate small commits before the ThemeProvider lands — each is a pure refactor with no behaviour change. Bonus: future theme work becomes trivial.

**Step 12 — ThemeProvider context.**

New file: `src/app/admin/components/ThemeProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { saveThemePreference } from "./theme-actions";

type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  effectiveTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  effectiveTheme: "dark",
  setTheme: () => {},
});

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme: Theme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);

  // Track system preference for the 'system' theme option
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mq.matches);
    const listener = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const effectiveTheme: "dark" | "light" =
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  // Apply data-theme attribute on change
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    // Persist to staff_profiles + localStorage mirror
    saveThemePreference(next).catch((error) => {
      console.error("saveThemePreference failed:", error);
    });
    try {
      localStorage.setItem("rahma-admin-theme", next);
    } catch {
      // ignore — incognito/quota
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

**Step 13 — Server action `saveThemePreference`.**

New file: `src/app/admin/components/theme-actions.ts`:

```ts
"use server";

import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";

const themeSchema = z.enum(["dark", "light", "system"]);

export async function saveThemePreference(theme: string): Promise<{ success: boolean; error?: string }> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) {
    return { success: false, error: "Invalid theme value." };
  }
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile) return { success: false, error: "Not authenticated." };

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("staff_profiles")
    .update({ theme_preference: parsed.data })
    .eq("id", profile.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
```

**Step 14 — Mount ThemeProvider in admin layout.**

Edit `src/app/admin/layout.tsx`:

```tsx
import { ThemeProvider } from "./components/ThemeProvider";
// ...

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Existing auth + profile fetch
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  // ...

  const initialTheme = (profile?.theme_preference ?? "dark") as "dark" | "light" | "system";

  return (
    <ThemeProvider initialTheme={initialTheme}>
      {/* existing layout JSX */}
    </ThemeProvider>
  );
}
```

Note: `profile.theme_preference` must be added to the `StaffProfile` interface and the `getStaffProfile` SELECT in `src/lib/auth/rbac.ts:319`.

**Step 15 — FOUC mitigation script.**

> **Amended 2026-07-26 (C11-F10 verifier-confirmed; D10 — Owner approved):** `next/script` with `strategy="beforeInteractive"` is root-layout-only in Next.js 16.2.4, and `src/app/admin/layout.tsx` is a nested layout owning no `<html>`/`<body>` — the `<Script>` sketch below cannot work as written. Implement instead as a plain inline `<script dangerouslySetInnerHTML={{ __html: ... }} />` emitted at the TOP of the admin layout's returned JSX (before `<AdminTopNav>`), reusing the IIFE body below verbatim. It executes early in the body stream (the minor loss of beforeInteractive's pre-hydration guarantee is accepted per D10). Do NOT touch the root layout. Verify per §3.7 hard-refresh FOUC check.

Edit `src/app/admin/layout.tsx` (or root layout if appropriate). Inject before React hydrates:

```tsx
<Script
  id="theme-fouc-mitigation"
  strategy="beforeInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var stored = localStorage.getItem('rahma-admin-theme');
          var theme = stored || 'dark';
          if (theme === 'system') {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          document.documentElement.dataset.theme = theme;
        } catch (e) {
          document.documentElement.dataset.theme = 'dark';
        }
      })();
    `,
  }}
/>
```

The script runs synchronously before React hydration. Reads localStorage (mirror) → falls back to system prefs → falls back to dark. Sets `data-theme` on `<html>` immediately. No FOUC.

**Step 16 — ThemeToggle UI.**

New file: `src/app/admin/components/ThemeToggle.tsx`:

```tsx
"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative inline-block">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as "dark" | "light" | "system")}
        aria-label="Theme"
        className="..." /* admin-styled select */
      >
        <option value="dark">🌙 Dark</option>
        <option value="light">☀️ Light</option>
        <option value="system">🖥 System</option>
      </select>
    </div>
  );
}
```

Mount in the admin shell header — `src/app/admin/components/AdminTopNav.tsx` (path corrected 2026-07-26 per C11-F9: no `admin-shell.tsx` exists; `AdminTopNav` is the shell/header component, mounted from `src/app/admin/layout.tsx:59`). Place to the right of the profile menu / nav items. Verify: `git grep -n "ThemeToggle" src/app/admin/components/AdminTopNav.tsx` → 1+ hits after the edit.

**Step 17 — Vitest specs for theme infrastructure.**

New tests:
- `ThemeProvider.test.tsx` — initial theme honored, setTheme updates dataset, 'system' resolves to OS pref.
- `theme-actions.test.ts` — Zod validation rejects invalid theme; valid theme writes to DB.
- `ThemeToggle.test.tsx` — dropdown renders 3 options, selecting fires server action.

**Phase E verify checkpoint:**
- Lint + tsc + vitest + build green.
- Manual visual: load any admin page → renders in dark theme. Toggle to light → instant switch, no FOUC. Refresh → theme persists. Sign out + sign in → theme persists (from DB).
- Print preview → renders light (per print media query).

### Phase F — Motion-reduce sweep (work area 7)

> ✅ **VERIFY-ALREADY-IMPLEMENTED (2026-07-26)** — the build at `ea97932` already satisfies this phase's acceptance rationale: `src/app/globals.css:437-446` carries an app-wide `prefers-reduced-motion` rule (`animation-duration: 0.01ms !important`, iteration-count 1) that freezes every spinner, so audit B-03's §3.3 acceptance check passes today (C11-F4).
> Executor: VERIFY the behaviour instead of re-implementing — enable `prefers-reduced-motion: reduce` in browser devtools and confirm no spinner animates on `/admin/dashboard` (the §3.3 B-03 check). Per D8 (Owner approved), the per-instance `motion-reduce:animate-none` sweep below is DEMOTED to **optional hygiene — largely already satisfied**; verified scale if undertaken: 60 `animate-spin` occurrences across 39 admin files, 59 unguarded (verified 2026-07-26). Original phase text preserved below for reference.

**Step 18 — Generate the punch list.**

```bash
git grep -nE "animate-spin" src/app/admin/ > /tmp/c11-animate-spin-all.txt
git grep -nE "animate-spin" src/app/admin/ | grep -v "motion-reduce" > /tmp/c11-animate-spin-missing.txt
wc -l /tmp/c11-animate-spin-missing.txt
```

Each match in `c11-animate-spin-missing.txt` is a file:line to fix.

**Step 19 — Apply the modifier.**

For each match, edit the `className` to include `motion-reduce:animate-none`:

```tsx
// Before:
<Loader2 className="size-4 animate-spin" aria-hidden="true" />

// After:
<Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
```

This can be done file-by-file OR via a script. **Recommended:** file-by-file with a 5-minute scan of each file to confirm context. Some animate-spin instances are inside conditional render branches where the existing logic already handles motion-reduce differently (e.g., `reducedMotion ? 'size-4' : 'size-4 animate-spin'` pattern). Don't override that pattern; preserve.

**Step 20 — Audit re-grep.**

```bash
git grep -nE "animate-spin" src/app/admin/ | grep -v "motion-reduce" | grep -v "reducedMotion"
# Expected: 0 matches (or only intentional exceptions documented in code comments)
```

**Phase F verify checkpoint:**
- All `animate-spin` instances in `src/app/admin/` honor `prefers-reduced-motion`.
- Manual verification with `prefers-reduced-motion: reduce` enabled (browser devtools) — no spinning loaders observed during a Playwright walk.

### Phase G — End-to-end verification + bug-fix confirmation

**Step 21 — Playwright role sweep × 2 themes (16 walks total).**

For each role × each theme × each viewport (4 viewports):
- Sign in
- Navigate to `/admin/dashboard`
- Capture screenshot
- Verify variant + theme correctly rendered

**Step 22 — V-01 + B-01 + B-03 fixes confirmed.**

- V-01: Business variant doesn't have 3 overlapping urgency cards. Health check is collapsed.
- B-01: Coord Snapshot card no longer renders `()` between heading + value.
- B-03: Dashboard filters spinner no longer animates with reduced-motion preference.

**Step 23 — WCAG contrast check.**

Run axe-core or Lighthouse on `/admin/dashboard` in both themes. Target: WCAG AA (4.5:1 body, 3:1 large text + UI). If failures, surface for designer + tweak OKLCH values.

**Phase G verify checkpoint:**
- All 16 Playwright walks pass.
- Bug fixes verified.
- WCAG AA met.

---

## 2 — Files touched (final list)

### NEW (~17 files)
| File | Purpose |
|---|---|
| `src/app/admin/dashboard/blocks/DashboardHeader.tsx` | Header + greeting + filter strip |
| `src/app/admin/dashboard/blocks/EmptyState.tsx` | Narrative empty-state pattern |
| `src/app/admin/dashboard/blocks/QuickHelpPanel.tsx` | (or refactor existing) Per-variant help links |
| `src/app/admin/dashboard/blocks/RevenueStripe.tsx` | Owner/Admin revenue tiles |
| `src/app/admin/dashboard/blocks/EnquiriesTodoStripe.tsx` | Triage stripe |
| `src/app/admin/dashboard/blocks/ClaimQueueStripe.tsx` | Coordinator + practitioner-mode |
| `src/app/admin/dashboard/blocks/PendingBookingsStripe.tsx` | Needs-attention primary stripe |
| `src/app/admin/dashboard/blocks/ScheduleGapStripe.tsx` | Coord schedule-coverage |
| `src/app/admin/dashboard/blocks/RecentActivityStripe.tsx` | Business recent activity |
| `src/app/admin/dashboard/blocks/MobileStickyActionBar.tsx` | Mobile sticky action bar |
| `src/app/admin/dashboard/blocks/index.ts` | Barrel export |
| `src/app/admin/dashboard/blocks/__tests__/*.test.tsx` | One per block |
| `src/app/admin/dashboard/BusinessDashboard.tsx` | NEW variant file |
| `src/app/admin/dashboard/CoordinatorDashboard.tsx` | NEW variant file |
| `src/app/admin/components/ThemeProvider.tsx` | Theme context |
| `src/app/admin/components/ThemeToggle.tsx` | Header toggle |
| `src/app/admin/components/theme-actions.ts` | Server action saveThemePreference |
| `src/app/admin/components/__tests__/ThemeProvider.test.tsx` | Theme context tests |
| `supabase/migrations/<ts>_c11_theme_preference.sql` | Schema migration |

### EDITED (~35 files)
| File | Change |
|---|---|
| `src/app/admin/dashboard/page.tsx` | Shrink to thin variant router (~300-400 lines) |
| `src/app/admin/dashboard/TherapistDashboard.tsx` | Consume shared blocks; remove inlined helpers (~250-400 lines after) |
| `src/app/admin/layout.tsx` | Wrap with ThemeProvider; inline FOUC script |
| `src/lib/auth/rbac.ts` | Add `theme_preference` to StaffProfile + SELECT |
| `src/styles/tokens.css` | CSS variable duplication for dark/light themes (path corrected 2026-07-26 per C11-F3 — all `--admin-*` vars live here in the shared `:root`; `admin-theme.css` does not exist; dark values `[data-theme="dark"]`-scoped only) |
| `src/app/globals.css` | Migrate admin-scoped hardcoded literals (`.admin-action-*`, `.admin-nav-*`, `.admin-shell::before` — C11-F7) to `--admin-*` vars |
| `src/app/admin/components/AdminTopNav.tsx` | Mount ThemeToggle in header (path corrected 2026-07-26 per C11-F9 — no `admin-shell.tsx` exists) |
| 39 files with `animate-spin` (60 instances, verified 2026-07-26 — C11-F5) | Add `motion-reduce:animate-none` — OPTIONAL hygiene per D8 (see Phase F wrapper) |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 chart + tile primitives.
- Other admin surfaces (bookings list, client list, etc.) — only `animate-spin` modifications.
- C-04a / C-05 / C-06 / C-01 / C-FIELDWORK modifications — orthogonal.
- `PullToRefresh.tsx` — already has motion-reduce pattern; left alone.

---

## 3 — Verification gate (commands + pass criteria)

### 3.1 Static gates

```bash
pnpm lint                       # no NEW errors vs the 59-error baseline (see pre-flight #4; amended 2026-07-26 — C11-F2)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline preserved (485/491; 6 pre-existing failures in 3 files)
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget for C-11:**
- Shared blocks: ~10 kB shared by all variants
- 3 variant files: ~5 kB each (down from 1017-line page.tsx)
- ThemeProvider + Toggle + actions: ~3 kB client
- CSS variable duplication: ~2 kB in stylesheet
- Motion-reduce sweep: 0 net bytes (modifier additions)

**Plan ceiling: +20 kB cumulative across `/admin/dashboard/*` + `+5 kB` for theme infrastructure across all admin pages.**

Compare against `/tmp/c11-pre-bundle.txt` baseline.

### 3.2 Playwright role × theme sweep (admin-wide)

**Scope:** dark mode applies admin-wide, so verification walks ALL admin sections in both themes. The full matrix is intentionally large; impl can prioritise critical surfaces first (dashboard + bookings + clients) and complete the remaining surfaces in a final-verification pass.

**Per role × theme × viewport** (4 viewports each):
- Sign in
- Walk the role's primary surfaces (matrix below)
- Capture screenshots in both themes
- Verify no surface is "stuck" in the opposite theme
- Sign out

| Role | Themes | Surfaces walked |
|---|---|---|
| Owner | Dark + Light + System spot-check | Dashboard, Bookings list + detail + new, Clients list + detail + new, Calendar, Staff list + detail, Reports, Emails + Email-templates preview, Settings, Operations, Privacy, Audit, /admin/me |
| Admin | Dark + Light | Same as Owner (slightly narrower data scope per RBAC) |
| Coord | Dark + Light | Dashboard, Bookings list + detail + new, Clients list + detail, Calendar, Enquiries, Reports (scoped) |
| Therapist | Dark + Light | Dashboard, Bookings list + detail (own assignments), Clients detail (assigned only), /admin/me, Reports (Personal-only) |
| Therapist-Fresh | Dark | Dashboard (zero-state), /admin/me (zero-state) — confirms empty-state copy reads in both themes |

**Smoke walks at 4 viewports per surface** — at minimum a hard refresh of each route in each theme to catch any surface where CSS variables don't resolve correctly. 1280 + 375 are mandatory; 768 + 1440 are spot-checks.

**Toggle verification per session:** in one Playwright session per role, toggle Dark → Light → System → Dark via the header dropdown. Verify each transition applies instantly (no FOUC), persists across navigation, and persists across sign-out + sign-in (DB-backed).

### 3.3 V-01 + B-01 + B-03 verification

- V-01: visit Owner dashboard → no triplicate urgency cards. Health check disclosure collapsed.
- B-01: visit Coord dashboard → no "()" rendering bug.
- B-03: enable `prefers-reduced-motion` via browser devtools → trigger any spinner → no animation. *(Note 2026-07-26 — C11-F4: this check passes TODAY, pre-sweep, via the app-wide reduce rule at `globals.css:437-446`. A passing B-03 is NOT evidence the optional per-instance Phase F sweep ran — use the Step 20 re-grep for that.)*

### 3.4 DB verification

```sql
-- After Owner toggles theme to light
SELECT theme_preference FROM staff_profiles WHERE email = 'rahmatherapy@outlook.com';
-- Expected: 'light'

-- After toggling to system
SELECT theme_preference FROM staff_profiles WHERE email = 'rahmatherapy@outlook.com';
-- Expected: 'system'
```

### 3.5 WCAG contrast verification (admin-wide)

Run axe-core / Lighthouse on AT LEAST one representative page from each admin section, in both themes:

- `/admin/dashboard` (all 3 variants, both themes — 6 runs)
- `/admin/bookings` list (both themes)
- `/admin/bookings/[id]` detail (both themes)
- `/admin/bookings/new` form (both themes)
- `/admin/clients` list (both themes)
- `/admin/clients/[id]` detail (both themes — high stakes, B-6 LTV ribbon + status badges)
- `/admin/clients/new` form (both themes)
- `/admin/calendar` (both themes — chart cells must be legible)
- `/admin/reports` (both themes — chart fills must be legible per SHARED-NOTES §17)
- `/admin/staff/[id]` (both themes)
- `/admin/emails` delivery log (both themes)
- `/admin/settings` (both themes)
- `/admin/audit` (both themes)
- `/admin/privacy` (both themes)

Target: WCAG AA (4.5:1 body, 3:1 large/UI). Document any failures + remediation. Surfaces with bespoke colour systems (charts, status badges, LTV ribbon) are highest-risk; verify carefully.

**Brand-asset spot-check:** any logo, illustration, or hardcoded brand image used in the admin (e.g., on `/admin/login`, in email previews, in dashboard hero) must remain legible against a dark background OR be wrapped in a light container per brief §5.9.

### 3.6 Print mode verification

In browser print preview: dashboard renders in light theme regardless of user's theme preference. Page text legible against white background.

### 3.7 FOUC verification

Hard refresh `/admin/dashboard` 5-10 times with each theme. No light-flash-then-dark (or vice versa). Inline script runs before React hydrates.

### 3.8 Screenshot evidence (admin-wide)

**Dashboard variants (per brief §4.1-4.3):**
- 375 + 1280 × dark + light × 3 variants = 12 screenshots
- 1280 × Health check disclosure expanded (Business) = 1
- 1280 × Coord dashboard with B-01 bug gone = 1
- 1280 × theme toggle dropdown open = 1

**Other admin surfaces (1280, both themes — confirms admin-wide coverage):**
- /admin/bookings list × 2 themes
- /admin/bookings/[id] detail × 2 themes
- /admin/clients/[id] detail (with LTV ribbon) × 2 themes
- /admin/calendar × 2 themes
- /admin/reports × 2 themes
- /admin/staff/[id] × 2 themes
- /admin/settings × 2 themes
- /admin/emails × 2 themes
- /admin/audit × 2 themes
- /admin/privacy × 2 themes
- /admin/me × 2 themes

Total: ~35 screenshots minimum. Mobile (375) spot-checks for the surfaces with significant mobile reflow (Bookings list, Bookings detail, Calendar, /admin/me).

Store in `redesign/evidence/C-11/screenshots-dashboard/` (dashboard) + `redesign/evidence/C-11/theme-coverage/` (admin-wide). *(Evidence convention 2026-07-26 per rubric §8/D15 — replaces the original `redesign/audits/C-A/...` targets; NEVER write into `redesign/audits/**`.)* C-C plan-writer can adjust the sub-directory structure if a different convention is cleaner, as long as everything stays under `redesign/evidence/C-11/`.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| V-01 reconciliation breaks Owner workflow expectations | medium | medium | Brief §4.1 + §9.1 documents the recommendation; user can override at impl. Health Check disclosure is opt-out (collapsed default, can expand). |
| Dark mode contrast fails WCAG AA | medium | medium | Designer verification during impl; axe-core run in §3.5. OKLCH values illustrative; tune at impl. |
| FOUC flash visible despite inline script | low | low | Script runs `beforeInteractive`; the dataset assignment is synchronous. Test thoroughly per §3.7. |
| `staff_profiles.theme_preference` constraint blocks valid values | very low | low | Migration includes explicit IN clause; constraint name unique. |
| Variant extraction introduces a render regression | medium | medium | Pre/post Playwright screenshots; visual regression compare. Sub-step 3a (verbatim move) before 3b (compose-from-blocks) isolates the risk. |
| Block component re-renders too frequently due to prop instability | low | low | Memoize at parent level if needed; profile only if observed. |
| Motion-reduce sweep misses files | low | low | Re-grep after sweep (§F Step 20). |
| TherapistDashboard refactor breaks existing tests | medium | medium | C-FIELDWORK already lifted shared-helpers; C-11 lifts the rest. Existing TherapistDashboard tests should still pass. Run thoroughly. |
| Print-mode contrast unreadable | low | low | Print media query overrides to light (§Step 11). Test in print preview. |
| Initial theme load fetches `theme_preference` from DB on every page load (latency) | low | low | `getStaffProfile` already fetches the staff row. Adding one column is no extra query. |
| Toggle UX confusion (3 options) | low | low | Tooltip + dropdown labels explicit. Q9.3 locked dropdown. |
| FOUC script localStorage out of sync with DB | low | low | ThemeProvider's setTheme writes both. On next sign-in, server-fetched value overrides. Eventual consistency acceptable. |
| Brand-asset images broken in dark mode | medium | medium | Audit during impl (§5.9 in brief). Wrap brand assets in light-background containers if needed. |
| `<details>` disclosure for Health Check confuses users who expect always-visible | low | low | Disclosure label "Health check" is descriptive; per-org-research not blocking. User can override the disclosure at impl. |
| Bundle delta exceeds ceiling | low | low | Tree-shake; lazy-load Health check disclosure content. |

### 4.1 Real risk: scope creep within C-11

C-11 is the largest plan. Phases are designed to ship in isolation, but the temptation to fold extra polish (new icons, new Empty State copy, etc.) is real. **Plan locks: each phase ships AS DESIGNED. No additional polish without user approval.** Future polish goes to C-12+.

### 4.2 Real risk: admin-wide hardcoded-color sweep surface area

Per user clarification 2026-05-26, dark mode applies to ALL admin pages. The hardcoded-color sweep (§Step 11b) touches every admin component using OKLCH / hex literals. **Risk:** a missed file shows up in dark theme with stuck-light colours (e.g., a status badge that's `oklch(50% 0.10 25)` in code instead of `var(--admin-status-danger)`). Mitigation:
- Pre-flight Step 7b enumerates all hardcoded-colour files.
- Phase G Step 21 Playwright walks every admin section in both themes.
- Phase G Step 23 axe-core / Lighthouse contrast on representative pages catches surfaces with low contrast in either theme.
- If a surface is missed in C-11, fix is a quick one-file CSS variable migration; document as a C-12+ polish item if discovered post-ship.

The sweep is the high-effort surface; pre-flight count sets expectations. If the count is >30 files, the C-C plan-executor may opt to split the sweep into multiple smaller commits to keep review tractable.

*(Verified 2026-07-26 — C11-F6: the count IS 98 files / 520 `oklch(` lines, so the >30 split path is certain and the original ~10-15-file estimate was ~7x low. Per D9 the C-11 sweep is trimmed to the variant-extraction files + `globals.css` admin literals — see the Step 11b amendment; the remaining ~90-file sweep is logged for C-12+, recorded in the progress file.)*

### 4.3 Real risk: chart + LTV ribbon need bespoke dark-theme variants

`reporting.ts` is RECON §5 untouchable, but the chart rendering layer (`ReportsCharts.tsx`) uses `statusChartFillForKey` for status-coloured chart fills (SHARED-NOTES §17). The B-6 LTV ribbon uses a similar pattern. Both will need dark-theme palette variants — and the change MUST come from the CSS-variable layer (not from `reporting.ts`). Plan locks:
- Audit chart-fill helpers during Phase E Step 11b
- Ensure `statusChartFillForKey` reads from CSS variables that have dark counterparts
- Verify chart legibility in both themes during Phase G Step 23 axe-core run
- Same for LTV ribbon (B-6 primitive — additive only per RECON §5 + DESIGN.md sanctioned brand colours)

---

## 5 — Undo procedure

### 5.1 Per-phase rollback

Revert in reverse phase order:
1. `git revert <phase-G>` — verification commits, no behavioural impact
2. `git revert <phase-F>` — motion-reduce sweep reverts (back to inconsistent state)
3. `git revert <phase-E>` — Theme infrastructure removed. Dropdown UI gone. CSS variables revert to single theme.
4. `git revert <phase-D>` — TherapistDashboard refactor reverts (back to inline blocks)
5. `git revert <phase-C>` — CoordinatorDashboard.tsx removed; page.tsx restores inline Coord branch
6. `git revert <phase-B>` — BusinessDashboard.tsx removed; page.tsx restores inline Business branch
7. `git revert <phase-A>` — blocks library removed

### 5.2 Migration rollback

```sql
ALTER TABLE public.staff_profiles
  DROP CONSTRAINT IF EXISTS staff_profiles_theme_preference_check;
ALTER TABLE public.staff_profiles
  DROP COLUMN IF EXISTS theme_preference;
```

User preferences stored in the column are lost on rollback. Acceptable if rollback is decided promptly.

### 5.3 CSS revert

Phase E reverts the CSS variable duplication. The default light theme returns.

---

## 6 — Test fixture guidance

**Safe for C-11 E2E:**
- All test accounts (Owner / Admin / Coord / Therapist / Therapist-Fresh / Inactive).
- No test data mutations required (theme toggle is per-user; doesn't touch other rows).

**DO NOT touch:**
- Badar's row (cancelled, off-limits).
- Real customer data.

**Theme toggle for E2E:** click the dropdown, select each option, verify `data-theme` attribute updates. Then visit a different admin page → theme preserved. Sign out + sign in → theme preserved (from DB).

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Phase coverage |
|---|---|
| 1 | Phase A — Shared blocks library + tests |
| 2 | Phase B (3a verbatim) — BusinessDashboard verbatim move + page.tsx wire |
| 3 | Phase B (3b compose) — BusinessDashboard composes from blocks + V-01 reconciliation |
| 4 | Phase C — CoordinatorDashboard extraction + B-01 fix |
| 5 | Phase D — TherapistDashboard refactor to consume blocks |
| 6 | Phase E Step 10 — Migration applied + types regenerated |
| 7 | Phase E Step 11 — CSS variable duplication (`:root` light, `[data-theme="dark"]` dark, print override) — i.e. Step 11a's approach in `src/styles/tokens.css`; Step 11's dark-at-`:root` block is superseded (2026-07-26) |
| 8 | Phase E Step 11b — Hardcoded-color sweep (admin-wide; can be split into multiple sub-commits per file group if extensive) |
| 9 | Phase E Steps 12-17 — ThemeProvider + Toggle + theme-actions + FOUC mitigation + tests |
| 10 | Phase F — Motion-reduce sweep (optional hygiene per D8, 2026-07-26 — may be skipped; verify B-03 only) |
| 11 | Phase G — Verification (admin-wide Playwright × theme sweep + WCAG + screenshots + progress file + master plan checklist → ✅) |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-11 {phase}` prefix during C-C.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. Run §0 Pre-flight in full. **Confirm C-FIELDWORK is merged.** Capture animate-spin baseline count + bundle baseline.
3. Execute Phase A → B → C → D → E → F → G in order. Phases A-D are pure code; E is Zone-2 (migration + CSS); F is mechanical sweep. *(2026-07-26: Phase F demoted to optional hygiene per D8 — verify-only unless the Owner opts into the sweep; see the Phase F wrapper.)*
4. Migration in Phase E is Zone-2 — show SQL to user; await approval; capture migration_name.
5. CSS variable values for dark theme are illustrative in §1 Step 11 — designer + WCAG verification expected at impl time.
6. Verification gate (§3) non-negotiable. The 16-walk Playwright × theme × role matrix is the verification heart.
7. Update progress file per phase.
8. Final commit updates master plan checklist C-11 row from `⏳` to `✅` with shipped date + commit SHA.

---

## 9 — Open questions remaining

1. **CSS variable canonical location** — `globals.css` or `admin-theme.css`? Identify during pre-flight; use whichever is the single source of truth.

   **RESOLVED (2026-07-26 — C11-F3):** neither. All `--admin-*` variables live in `src/styles/tokens.css:61-196`, in the SAME `:root` block as the public `--rahma-*`/shadcn tokens (imported via `globals.css:4`). `globals.css` defines no variables; `admin-theme.css` does not exist. Dark overrides must target only the `--admin-*` family (see Step 11a).

2. **`<details>` disclosure default — collapsed or expanded?** Brief locked collapsed (per V-01 demotion). User can flip at impl if Health check is critical-default-visible.

3. **`ThemeToggle` placement in shell header** — exact position (right of profile menu? as standalone icon?). Visual designer decision at impl.

4. **OKLCH values for dark theme** — illustrative in plan. Designer + WCAG axe-core verification finalises.

5. **`Print` media query strictness** — should print always force light, or honor user preference? Plan locks: always light (toner-friendly). Override possible if user requests.

6. **Bundle delta if shared blocks add too much weight** — tree-shaking + lazy disclosure should keep it within ceiling. Profile during build.

7. **Per-role default tab on `/admin/bookings`** (deferred from R04 B-167) — not C-11 scope; C-07.

8. **Shadow DOM / Web Components for blocks** — speculative; not needed today. C-12+ if needed.

9. **i18n / RTL** — out of C-11 scope. Future band.

---

*End of C-11 plan. Brief: `redesign/briefs/C-11-dashboard-variants-design-system-brief.md`. Progress: `redesign/per-page-progress/C-11-dashboard-variants-design-system-progress.md` (filled during C-C).*
