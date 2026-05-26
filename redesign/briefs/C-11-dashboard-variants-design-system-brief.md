# C-11 — Dashboard variants + shared design system + dark mode + motion-reduce pass

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q11 + §3 C-11 (3 variant files, NOT 4; shared building blocks library)
- `redesign/audits/C-A/01-dashboard-audit.md` (V-01 three urgency reps overlap; B-03 animate-spin without motion-reduce; CR-03 Therapist bifurcation already exists)
- `redesign/audits/C-A/R05-therapist-fresh-day.md` §4 (PE-1 narrative empty-state pattern; PE-2 "Need help?" sectional pattern; PE-3 time-of-day greeting)
- `redesign/briefs/C-FIELDWORK-EXPERIENCE-brief.md` (PractitionerTodaySection drop-in C-11 consumes)
- `BAND-C-MASTER-PLAN.md` Part 0 hard rules (motion-reduce, no border-l-4, mobile-first 375)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-11-dashboard-variants-design-system-plan.md`
- Progress: `redesign/per-page-progress/C-11-dashboard-variants-design-system-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-11 is **the largest C-B plan by scope** alongside C-02. It does four things at once:

1. **Extract 3 dashboard variant files** matching the existing `DashboardVariant` taxonomy: `BusinessDashboard.tsx` (NEW — Owner + Admin), `CoordinatorDashboard.tsx` (NEW), `TherapistDashboard.tsx` (already exists — refactor to consume shared blocks). `page.tsx` becomes a thin variant router.
2. **Build a shared dashboard building blocks library** so each variant composes from the same primitives (`RevenueStripe`, `EnquiriesTodoStripe`, `ClaimQueueStripe`, `PendingBookingsStripe`, `ScheduleGapStripe`, `RecentActivityStripe`, `EmptyState` narrative pattern, `QuickHelpPanel`, `DashboardHeader`, `MobileStickyActionBar`).
3. **Add dark mode** — default-on, user-switchable toggle to light, persists per user via `staff_profiles.theme_preference` (new column), honours `prefers-color-scheme` as tertiary fallback only. Every CSS variable in `globals.css` / `admin-theme.css` gets a dark counterpart.
4. **Sweep `animate-spin` instances** across the admin tree to apply `motion-reduce:animate-none` consistently (currently inconsistent — AuditPageActions has it; ~30 other instances don't).

**Key scope discoveries during plan-writing:**

- **Dark mode is fully greenfield.** Zero `dark:` Tailwind classes, zero `data-theme` attribute, zero `useTheme` hook, zero `ThemeProvider` exist today. Dark mode is foundational design work — not a polish pass.
- **Variant extraction is the easiest of the four.** Owner/Admin/Coord branches already inline in `page.tsx` after the early `TherapistDashboard` return at line 633. Refactor is mechanical.
- **C-FIELDWORK is in flight or just landed.** C-11 consumes `PractitionerTodaySection` from C-FIELDWORK. C-FIELDWORK already mounts it in the inline `page.tsx` branches; C-11's extraction inherits the mount.
- **`animate-spin` audit:** at least 20 instances across `src/app/admin/`, only a handful currently apply `motion-reduce:animate-none`. The sweep is ~30 file edits.

**Sequencing constraint:** **C-FIELDWORK ships before or with C-11.** C-11 imports `PractitionerTodaySection` and the shared helpers (`getGreeting`, etc.) from C-FIELDWORK's output.

---

## 1 — Why this plan exists

### 1.1 Variant code is currently inline in a 1017-line `page.tsx`

`src/app/admin/dashboard/page.tsx` already routes by variant (line 633 returns early for Therapist). The Business + Coord variants render INLINE in the rest of the file (~400 lines of variant-specific JSX). Per audit #01:

- **CR-02:** Coordinator variant renders an `ActiveEnquiriesCard + OperationsHealthCard` disclosure that Business variant doesn't.
- **CR-03:** Therapist variant is fully bifurcated.
- **V-01:** Business variant stacks THREE semantically overlapping urgency representations (Snapshot / Needs attention / Operations Health) — high cognitive overhead.

The decisions doc (Q11) locks the refactor: 3 variant files matching existing `DashboardVariant`, shared blocks lifted to a library. Owner + Admin lumped (no current divergence). C-11 implements.

### 1.2 The R05 patterns are exemplary but Therapist-only today

R05 PE-1 + PE-2 + PE-3:
- **TherapistDashboard zero-state copy** — narrative + empathy + next-action (e.g., "Quiet day. Take care of yourself.").
- **"Need help?" sectional pattern** — 4 onboarding CTAs (Update profile / Set availability / Browse claimable / View completed).
- **Time-of-day greeting** — "Good morning, Test."

These are absent from Business + Coord variants today. Owner dashboard has no greeting (just "Dashboard" h1 per R01 audit). C-11 lifts these patterns to all variants via shared blocks.

### 1.3 Dark mode is a user-priority feature (decisions doc Q11)

Decisions doc Q11:
> "Introduce dark mode as the default, with a user-switchable toggle to light mode. Persists per user. Honours prefers-color-scheme only as a tertiary fallback (default-on means the explicit default beats system preference unless the user toggles)."

**Three persistence layers in priority order:**
1. User's explicit toggle choice (highest priority — saved to `staff_profiles.theme_preference`).
2. App default — dark (locked).
3. System `prefers-color-scheme` — tertiary fallback if no user choice AND default-on logic is bypassed (e.g., for an Owner who explicitly wants system-tracking — see §9.4).

**Zero infrastructure today:** verified via grep — no `dark:`, no `data-theme`, no `useTheme`. Every CSS variable in the admin theme needs a dark counterpart.

### 1.4 Motion-reduce pass is consistency hygiene

`prefers-reduced-motion` is a Part 0 hard rule. `animate-spin` is the canonical violator. Current state:
- ✅ Pattern exists: `src/app/admin/dashboard/PullToRefresh.tsx:142` (`reducedMotion ? "size-4" : "size-4 animate-spin"`)
- ✅ Some files: `src/app/admin/audit/AuditPageActions.tsx:80` applies `motion-reduce:animate-none`
- ❌ Most files: 20+ `<Loader2 className="size-4 animate-spin" />` without the guard

C-11 sweeps these to apply `motion-reduce:animate-none` consistently across all `animate-spin` usages. **Trivial per-file fix, just lots of files.**

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-11)

8 work areas, phased in the plan:

### 2.1 Shared building blocks library (work area 1)

New directory: `src/app/admin/dashboard/blocks/` (or similar — plan locks the exact path).

Blocks to ship:

| Block | Lifts from | Consumed by |
|---|---|---|
| `DashboardHeader` | Existing `dashboard-header.tsx` + R05 PE-3 time-of-day greeting | All 3 variants |
| `EmptyState` | R05 PE-1 narrative pattern (lifted from existing `components/EmptyState.tsx` if it exists, otherwise new) | All variants when surfaces are empty |
| `QuickHelpPanel` | Existing `dashboard/QuickHelpPanel.tsx` (already exists per TherapistDashboard import) — extend with per-variant content slots | All variants, content per-variant |
| `PractitionerTodaySection` | **C-FIELDWORK output** — already a drop-in component | All variants conditionally on `can_take_bookings` |
| `RevenueStripe` | Extracted from Business variant's KPI tile grid (per `dashboard-cards.tsx`) | Business |
| `EnquiriesTodoStripe` | Extracted from Business + Coord enquiries surfacing | Business + Coordinator |
| `ClaimQueueStripe` | Extracted from `data.bookings` filter for unassigned (`page.tsx:545-549`) | Coordinator + practitioner-mode any variant |
| `PendingBookingsStripe` | Extracted from "Needs your attention" rendering (Business V-01 dimensionalisation) | Business + Coordinator |
| `ScheduleGapStripe` | NEW — schedule-coverage gaps for Coord; lifts the `getDashboardCopy(coordinator)` framing + adds gap-detection | Coordinator |
| `RecentActivityStripe` | Extracted from Business "Recent Activity" panel | Business |
| `MobileStickyActionBar` | Existing `mobileStickyActionForVariant` helper (page.tsx:611) — lift to shared component | All variants (variant-aware action) |

Each block is **render-only** — data comes via props from the variant's parent component. No data fetching inside blocks. Keeps the data-flow predictable + makes blocks easy to unit-test.

### 2.2 BusinessDashboard.tsx — NEW (work area 2)

Extract inline Owner/Admin branch from `page.tsx:~650-1017` into `src/app/admin/dashboard/BusinessDashboard.tsx`. Pure refactor — no behaviour change:

```tsx
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
  // ... B-5 stripe inputs, dashboard copy, etc.
  canTakeBookings: boolean;  // for C-FIELDWORK conditional mount
  // ... other props as needed
}

export function BusinessDashboard(props: BusinessDashboardProps): JSX.Element {
  // Composition of shared blocks:
  // - DashboardHeader (greeting + date + subtitle)
  // - RevenueStripe
  // - PendingBookingsStripe
  // - EnquiriesTodoStripe
  // - RecentActivityStripe
  // - <PractitionerTodaySection> (conditional on canTakeBookings)
  // - QuickHelpPanel (Business-tailored content)
  // - MobileStickyActionBar
}
```

**During extraction, fix V-01** (three urgency reps overlap): consolidate "Snapshot · Today" + "Needs your attention" + "Operations Health" into a single composition. Decisions doc didn't specify the exact reconciliation; **plan §9.2 locks a recommendation** — collapse Snapshot into the header strip + keep Needs Your Attention as the actionable list + demote Operations Health to a disclosure ("Health check ▾") below the fold.

### 2.3 CoordinatorDashboard.tsx — NEW (work area 3)

Extract inline Coord branch from `page.tsx:~900-1000` into `src/app/admin/dashboard/CoordinatorDashboard.tsx`. Same pattern — render-only composition of shared blocks. **Fix B-01** (literal "()" rendering bug per audit #01) — conditional render the parenthetical wrapper.

### 2.4 TherapistDashboard.tsx refactor (work area 4)

Already exists. C-FIELDWORK already extracted today + next-appt rendering into PractitionerTodaySection. C-11 finishes the refactor: replace remaining inline blocks with imports from `blocks/`:
- `DashboardHeader` (currently inline at lines 75-87)
- `QuickHelpPanel` (already a separate component — lifts cleanly)
- `EmptyState` (currently inline — extract)
- `MobileStickyActionBar` (currently inline — extract)

After this, `TherapistDashboard.tsx` is ~200 lines instead of 1361. The 1100+ extracted lines distribute across `blocks/` files.

### 2.5 `page.tsx` thin variant router (work area 5)

After extraction, `page.tsx` becomes:

```tsx
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // Auth + data fetching (existing logic)
  // ...

  const Variant =
    plan.variant === "therapist" ? TherapistDashboard
    : plan.variant === "coordinator" ? CoordinatorDashboard
    : BusinessDashboard;

  return (
    <PullToRefresh enabled={plan.variant === "therapist"}>
      <Variant {...variantProps} />
    </PullToRefresh>
  );
}
```

Estimated post-refactor length: ~300-400 lines (down from 1017). Most reduction is from removing the inline Business + Coord JSX.

### 2.6 Dark mode infrastructure (work area 6)

**Three new pieces:**

(a) **Schema:** new column `staff_profiles.theme_preference text` (nullable; values: `'dark' | 'light' | 'system'`). Default NULL = use app default (dark).

(b) **ThemeProvider context:**

```tsx
// src/app/admin/components/ThemeProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  effectiveTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
}>({
  theme: "dark",
  effectiveTheme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children, initialTheme }: { children: React.ReactNode; initialTheme: Theme }) {
  // Apply data-theme attribute to <html>; update on change
  // Server action saves to staff_profiles.theme_preference
  // On mount, resolve 'system' to actual via window.matchMedia
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

Mount in `src/app/admin/layout.tsx` — wraps the entire admin tree. The initial theme is fetched server-side from `staff_profiles.theme_preference`, defaulted to `'dark'`.

(c) **CSS variable duplication:** every `--admin-*` variable in `globals.css` / `admin-theme.css` gets a dark counterpart selector-scoped under `[data-theme="dark"]`. Light theme stays as the current set, scoped under `[data-theme="light"]` (or default — TBD per design). Plan locks the structure.

(d) **Toggle UI:** new component `ThemeToggle.tsx` in the admin shell header (right-aligned, near profile menu). Three states: Dark / Light / System. Per-click cycle or dropdown — plan §9.3.

### 2.7 Motion-reduce pass (work area 7)

Sweep `git grep -n "animate-spin" src/app/admin/`. For each match:
- If already has `motion-reduce:animate-none` → skip.
- Otherwise, add the modifier inline.

Estimated touch: ~30 files. Pure mechanical edit; no behaviour change for users without `prefers-reduced-motion`.

Also: `dashboard-filters-client.tsx:372, :473, :521` (per audit B-03) — three known violators in the dashboard surface itself.

### 2.8 Fix the V-01 + B-01 + B-03 dashboard bugs (work area 8)

These are folded into the variant extractions:
- **V-01:** during BusinessDashboard extraction (work area 2) — collapse the three urgency reps per §9.2.
- **B-01:** during CoordinatorDashboard extraction (work area 3) — conditional render fix on the parens.
- **B-03:** during the motion-reduce sweep (work area 7).

---

## 3 — RBAC matrix (C-11 dark mode × roles)

C-11 doesn't gate variant selection differently — that already works. Dark mode is universal:

| Action | Owner | Admin | Coord | Therapist |
|---|---|---|---|---|
| See dashboard variant | ✅ Business | ✅ Business | ✅ Coordinator | ✅ Therapist |
| See dark theme by default | ✅ on first login | ✅ | ✅ | ✅ |
| Toggle theme (dark / light / system) | ✅ | ✅ | ✅ | ✅ |
| Theme preference persists per user | ✅ via `staff_profiles.theme_preference` | same | same | same |

No new permissions. The `staff_profiles.theme_preference` column is user-writable for their own row (existing RLS pattern).

---

## 4 — Layout strategy

### 4.1 BusinessDashboard composition (after V-01 fix)

```
┌──────────────────────────────────────────────────────────┐
│ DashboardHeader                                          │
│   Good morning, Mamdouh.                                 │
│   Thursday, 26 May · Luton                              │
│   Filter strip: Today / Week / Month / 30d / Custom    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ RevenueStripe (Owner only — Admin sees scoped variant)   │
│   Today  Week  Month  Lifetime                          │
│   £85    £445  £1.8k  £43k                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ PendingBookingsStripe                                    │
│   3 need attention                                       │
│   ─ Staff gap: Sarah's 14:00                            │
│   ─ Unpaid: 2 from last week                            │
│   ─ Reschedule requested: 1                             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ EnquiriesTodoStripe                                      │
│   2 new enquiries today                                  │
│   [ Triage ]                                            │
└──────────────────────────────────────────────────────────┘

(if Owner has can_take_bookings + has appointments)
┌──────────────────────────────────────────────────────────┐
│ PractitionerTodaySection (from C-FIELDWORK)             │
│   Your next visit · in 1h 12m                           │
│   ...                                                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ RecentActivityStripe                                     │
│   Last 20 events ...                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Health check ▾ (disclosure — collapsed by default)      │
│   (was Operations Health; demoted per V-01 fix)         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ QuickHelpPanel — Business-tailored                      │
│   Need help?                                            │
│   ─ Review weekly numbers   ─ Manage staff              │
│   ─ Configure emails        ─ Check pending bookings    │
└──────────────────────────────────────────────────────────┘
```

Mobile (375): vertical stack, same order. MobileStickyActionBar appears at bottom with variant-aware action.

### 4.2 CoordinatorDashboard composition

```
┌──────────────────────────────────────────────────────────┐
│ DashboardHeader                                          │
│   Good morning, Aisha.                                  │
│   Thursday, 26 May · Luton                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ PendingBookingsStripe                                    │
│   2 unassigned, 1 partially assigned                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ ClaimQueueStripe                                         │
│   3 in claim queue                                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ EnquiriesTodoStripe                                      │
│   5 enquiries awaiting first contact                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ ScheduleGapStripe                                        │
│   Next 7 days: 2 morning gaps in Bury Park              │
└──────────────────────────────────────────────────────────┘

(if Coord has can_take_bookings + has appointments)
┌──────────────────────────────────────────────────────────┐
│ PractitionerTodaySection (from C-FIELDWORK)             │
│   ...                                                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ QuickHelpPanel — Coordinator-tailored                   │
│   Need help?                                            │
│   ─ Triage pending bookings ─ Follow up on enquiries   │
└──────────────────────────────────────────────────────────┘
```

### 4.3 TherapistDashboard composition (post-refactor)

```
┌──────────────────────────────────────────────────────────┐
│ DashboardHeader                                          │
│   Good morning, Test.                                   │
│   Thursday, 26 May · Your work                          │
└──────────────────────────────────────────────────────────┘

ProfileCompletionNudge (existing — conditional)

PractitionerTodaySection (from C-FIELDWORK)

┌──────────────────────────────────────────────────────────┐
│ PersonalContributionStripe (existing — preserved)        │
└──────────────────────────────────────────────────────────┘

HighlightOrTipStrip (existing)
RecentClientsStrip (existing)

┌──────────────────────────────────────────────────────────┐
│ QuickHelpPanel — Therapist-tailored                     │
│   Need help?                                            │
│   ─ Update profile  ─ Set availability                  │
│   ─ Browse claimable ─ View completed visits           │
└──────────────────────────────────────────────────────────┘

Pull-to-refresh tip (existing — mobile only)
MobileStickyActionBar
```

### 4.4 Dark mode visual change

CSS variables remap. Key transitions:

| Token | Light (current) | Dark (new) |
|---|---|---|
| `--admin-bg` | `oklch(97% 0.018 88)` (warm white) | `oklch(15% 0.012 88)` (warm near-black) |
| `--admin-panel` | `oklch(99% 0.005 88)` (off-white) | `oklch(20% 0.008 88)` (panel) |
| `--admin-heading` | `oklch(13% 0.015 88)` (near-black) | `oklch(95% 0.018 88)` (warm white) |
| `--admin-body` | `oklch(28% 0.015 88)` (dark text) | `oklch(85% 0.012 88)` (light text) |
| `--admin-text-muted` | `oklch(50% 0.010 88)` (muted dark) | `oklch(65% 0.010 88)` (muted light) |
| `--admin-border` | `oklch(88% 0.014 88)` | `oklch(28% 0.010 88)` |
| `--admin-primary` | `oklch(35% 0.085 80)` (warm gold) | `oklch(72% 0.105 80)` (lighter gold) |

These are illustrative — actual values land during impl with the visual designer. The principle: hue stays warm (Rahma's brand); chroma + lightness invert.

### 4.5 Theme toggle UI

Right side of admin shell header (next to profile menu). Three states cyclable:

```
[ 🌙 Dark ] → click → [ ☀️ Light ] → click → [ 🖥 System ] → click → [ 🌙 Dark ]
```

OR dropdown (plan §9.3 locks one). Tooltip on hover: "Theme: Dark (default)". Persisted via server action on click.

---

## 5 — States & edge cases

### 5.1 First-time user (no `theme_preference` set)

Default to `'dark'` (app default). The toggle UI shows "Dark". `staff_profiles.theme_preference` stays NULL until user explicitly toggles. NULL = "follow app default" (which is dark).

### 5.2 User toggles to 'system'

`staff_profiles.theme_preference = 'system'`. ThemeProvider's `effectiveTheme` reads `window.matchMedia("(prefers-color-scheme: dark)").matches` on mount + listens for changes. The `<html data-theme="...">` attribute updates dynamically.

### 5.3 SSR flash of unstyled content (FOUC)

The server fetches `staff_profiles.theme_preference`, renders `<html data-theme="dark|light">`. Client hydrates with the same value — no FOUC.

For `'system'` theme: server can't know the user's OS preference. SSR renders the app default (dark); client-side ThemeProvider reads `matchMedia` and updates the `data-theme` attribute if needed. Brief FOUC possible if user has system-light AND chose 'system'. **Mitigation:** inline `<script>` in `<head>` that reads `prefers-color-scheme` and sets `data-theme` before React hydrates. Plan §9.5.

### 5.4 Variant routing edge cases

- Owner with `can_take_bookings=true` AND active assignments → BusinessDashboard + PractitionerTodaySection.
- Coord with `can_take_bookings=true` → CoordinatorDashboard + PractitionerTodaySection.
- Inactive user → blocked at middleware before reaching dashboard.

### 5.5 Empty state cascades

If a Business variant has NO data at all (Owner without bookings, no enquiries, no pending), the variant renders:
- DashboardHeader
- EmptyState (lifted R05 PE-1 pattern — "Quiet day. Nothing in your queue.")
- QuickHelpPanel

No stacked empty cards (each stripe checks data and renders nothing when empty).

### 5.6 Motion-reduce conformance verification

After the sweep, run a check: every `animate-spin` in `src/app/admin/` should have `motion-reduce:animate-none` adjacent OR be inside a component that uses the `useReducedMotion` hook for conditional rendering.

### 5.7 Theme toggle while page is loading

The toggle is interactive at all times. If clicked during a loading state, the toggle's server action fires; the spinner (with motion-reduce) keeps spinning until load completes; the theme switches mid-spin without visual disruption.

### 5.8 Dark mode on print

CSS `@media print { :root { /* light theme overrides */ } }` ensures printed pages use light theme regardless of user preference. Browsers default print to light anyway, but explicit override prevents dark backgrounds wasting toner.

### 5.9 Brand-asset images in dark mode

Logo, illustrations, screenshots. If any image has a transparent background optimised for light, it may need a dark variant. Audit during impl. Quick-fix: wrap brand assets in a container with light background even in dark mode (preserves logo legibility).

---

## 6 — Migration footprint

**One migration** in C-C (Zone-2):

```sql
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS theme_preference text;

-- Enum-like constraint (kept as text for forward compat with future themes)
ALTER TABLE public.staff_profiles
  ADD CONSTRAINT staff_profiles_theme_preference_check
  CHECK (theme_preference IS NULL OR theme_preference IN ('dark', 'light', 'system'));
```

No backfill needed — NULL means "use app default" (which is dark). Per-row updates happen as users toggle.

**No other schema changes.**

---

## 7 — Files touched (preview — full list in plan)

### NEW (~15 files)
- `src/app/admin/dashboard/blocks/DashboardHeader.tsx`
- `src/app/admin/dashboard/blocks/EmptyState.tsx`
- `src/app/admin/dashboard/blocks/QuickHelpPanel.tsx` (or refactor existing)
- `src/app/admin/dashboard/blocks/RevenueStripe.tsx`
- `src/app/admin/dashboard/blocks/EnquiriesTodoStripe.tsx`
- `src/app/admin/dashboard/blocks/ClaimQueueStripe.tsx`
- `src/app/admin/dashboard/blocks/PendingBookingsStripe.tsx`
- `src/app/admin/dashboard/blocks/ScheduleGapStripe.tsx`
- `src/app/admin/dashboard/blocks/RecentActivityStripe.tsx`
- `src/app/admin/dashboard/blocks/MobileStickyActionBar.tsx`
- `src/app/admin/dashboard/BusinessDashboard.tsx`
- `src/app/admin/dashboard/CoordinatorDashboard.tsx`
- `src/app/admin/components/ThemeProvider.tsx`
- `src/app/admin/components/ThemeToggle.tsx`
- `src/app/admin/components/theme-actions.ts` (server action to save preference)
- `src/app/admin/dashboard/blocks/__tests__/*.test.tsx` (one per block)
- `supabase/migrations/<ts>_c11_theme_preference.sql`

### EDITED (~40 files)
| File | Change |
|---|---|
| `src/app/admin/dashboard/page.tsx` | Shrink to thin variant router (~300 lines down from 1017) |
| `src/app/admin/dashboard/TherapistDashboard.tsx` | Consume shared blocks; remove inlined helpers (already exported via shared-helpers.ts per C-FIELDWORK) |
| `src/app/admin/layout.tsx` | Wrap with ThemeProvider; fetch initial theme server-side |
| `src/app/globals.css` (or admin-theme.css) | Duplicate every `--admin-*` variable under `[data-theme="dark"]` and `[data-theme="light"]` selectors; add inline `<script>` for FOUC mitigation |
| `~30 files with animate-spin` | Add `motion-reduce:animate-none` modifier |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- C-04a / C-05 / C-06 modifications — orthogonal.
- `PractitionerTodaySection.tsx` from C-FIELDWORK — C-11 imports and mounts; doesn't modify.
- `shared-helpers.ts` from C-FIELDWORK — same.

---

## 8 — Sequencing and dependencies

**Hard dependency: C-FIELDWORK before or with C-11.** Decisions doc §4 confirms. C-11 imports `PractitionerTodaySection` + `getGreeting` from C-FIELDWORK's shared-helpers.

**Coordination with all other C-NN plans:**
- C-04a / C-05 / C-06 / C-01 are orthogonal (different surfaces).
- C-09 (cache invalidation) will retrofit tag-based invalidation across the admin. Dashboard fetches are touched by C-09's `unstable_cache` wrapper. Coordinate: C-11 doesn't introduce new fetches; C-09 wraps existing reads. No conflict.
- C-08 ships new email templates. No dashboard impact.
- C-02 recurring bookings adds new admin surfaces. Doesn't affect dashboard variants.

**Sequencing within C-11:** plan phases are ordered to ship in isolation (variant extraction first, dark mode second, motion-reduce sweep last).

---

## 9 — Open questions

**Q9.1 — V-01 reconciliation: how exactly to collapse the three urgency reps?**

Locked in brief §4.1 — recommended composition:
- Snapshot → folded into DashboardHeader (header strip carries "today's count").
- Needs Your Attention → primary actionable stripe (renamed PendingBookingsStripe).
- Operations Health → demoted to a disclosure ("Health check ▾") below the fold.

User feedback during impl welcome. The decisions doc was silent; brief proposes; user can override.

**Q9.2 — Dashboard block scope: include `RevenueStripe` for Admin or Owner-only?**

Locked: **Owner sees full revenue; Admin sees scoped revenue (no lifetime totals)**. Aligned with existing RBAC permission `VIEW_REPORTS_REVENUE`. Coord doesn't see revenue at all.

**Q9.3 — Theme toggle: cycle or dropdown?**

Locked at **dropdown with 3 options** (Dark / Light / System). Cycle is faster but obscures the System option's existence. Dropdown is more discoverable.

**Q9.4 — Default theme on first login: dark or system?**

Decisions doc Q11 explicitly: **dark default**. Plan locks. User can toggle to System if they want OS-tracking.

**Q9.5 — FOUC mitigation script: inline in layout.tsx or as a separate file?**

Locked: **inline in `<head>` via Next.js `<script>` tag with `dangerouslySetInnerHTML`**. Reads `localStorage` (mirror of `staff_profiles.theme_preference` for instant access) + falls back to `prefers-color-scheme` if needed. The script must run before React hydrates. Plan locks the approach; impl-time tuning expected.

**Q9.6 — Migration of existing per-staff colour preferences?**

None today. Schema is greenfield for theme_preference. The 6 existing staff accounts get NULL → app default (dark) on first login post-deploy.

**Q9.7 — Should `ThemeToggle` be in the admin header or in a settings page?**

Locked: **admin header**. One-click access is industry standard. Settings page mirror is optional polish (C-12+).

**Q9.8 — Motion-reduce sweep: in-band with C-11 or its own plan?**

Locked: **in-band with C-11** per decisions doc. ~30 trivial edits. Sweep is mechanical and tightly scoped; no risk to other work.

**Q9.9 — Dark mode contrast / WCAG compliance verification?**

Plan §3 verification gate includes a WCAG contrast check at the C-C verification. Tools: any axe-core or Lighthouse run on the dashboard in dark mode. Target: WCAG AA (4.5:1 for body text, 3:1 for large text + UI). The illustrative palette in §4.4 was selected with this in mind; designer + tool verification confirms at impl.

**Q9.10 — Owner-from-Admin split deferred to future band?**

Locked per decisions doc Q11: NOT in C-11. `BusinessDashboard.tsx` serves both Owner and Admin. Future split is cheap (add variant key + extract divergent paths). Documented for posterity.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-11 implementation is complete when:

1. **3 dashboard variant files exist** (`BusinessDashboard.tsx`, `CoordinatorDashboard.tsx`, `TherapistDashboard.tsx`) each ~300-500 lines.
2. **`page.tsx` is ~300-400 lines** (down from 1017), serves only as data-fetch + variant router.
3. **Shared blocks library** at `dashboard/blocks/` with ~10 components, each render-only.
4. **V-01 fix** — Business variant no longer stacks three overlapping urgency reps.
5. **B-01 fix** — Coordinator Snapshot card no longer renders literal "()" between heading and value.
6. **Dark mode infrastructure** — `staff_profiles.theme_preference` column exists; ThemeProvider context wraps admin tree; toggle in header works; preference persists across sessions.
7. **Dark mode default** — new user logging in for the first time sees dark theme.
8. **Light + System variants work** — user can toggle to each, verified visually.
9. **No FOUC** — page loads with the correct theme applied immediately (no light-then-dark flash).
10. **Motion-reduce sweep complete** — every `animate-spin` in `src/app/admin/` has `motion-reduce:animate-none` adjacent. Verified via grep + manual file scan.
11. **WCAG AA contrast met** in both dark + light themes.
12. **No regressions on Therapist dashboard** — existing Therapist UX preserved including ProfileCompletionNudge, Personal Stripe, RecentClientsStrip, Need help?, mobile pull-to-refresh.
13. **All static gates pass** — lint, tsc, vitest, build, bundle delta within budget.
14. **Playwright role sweep at 375 / 768 / 1280 / 1440 passes** for all 4 roles in BOTH light + dark themes (8 total combinations).

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q11 + §3 C-11 | 3-variant taxonomy; shared blocks list; dark mode + motion-reduce in-band |
| `01-dashboard-audit.md` §1+§2 | B-01 parens bug, B-03 animate-spin, V-01 urgency-reps overlap |
| `R05-therapist-fresh-day.md` §1+§4 | TherapistDashboard exemplary patterns to lift |
| `R01-owner-day.md` (referenced) | Owner dashboard no greeting; lift from R05 PE-3 |
| `C-FIELDWORK-EXPERIENCE-brief.md` §2.1 + §2.3 | `PractitionerTodaySection` drop-in + shared-helpers |
| `dashboard/page.tsx:422-440` | `getDashboardCopy` variant-aware header (current) |
| `dashboard/page.tsx:633` | Therapist early-return — where the variant routing lives |
| `dashboard/page.tsx:565-575` | `stripeVariant` + variant-aware tile/stripe logic |
| `dashboard/dashboard-helpers-b5.ts` | `mobileStickyActionForVariant` to lift |
| `dashboard/PullToRefresh.tsx:142` | Existing motion-reduce pattern (the canonical reference) |
| `dashboard/QuickHelpPanel.tsx` | Existing block to extend with per-variant content |
| Global CSS (`globals.css` or `admin-theme.css`) | All `--admin-*` variables to duplicate for dark theme |

---

## 12 — Out of scope (explicit non-goals)

- **Owner-from-Admin RBAC split** — Q9.10, decisions doc Q11.
- **Per-variant dashboard customisation** (user-toggleable widgets) — speculative; C-12+.
- **Animated theme transition** (smooth fade between dark/light on toggle) — out of scope; instant switch is simpler + more accessible.
- **High-contrast mode** beyond standard dark/light — C-12+ accessibility band if requested.
- **Custom theme builder** (user picks accent colours) — speculative.
- **`/admin/settings` theme preference mirror** — Q9.7. Header-only toggle.
- **Dashboard widget reordering / drag-drop** — speculative.
- **Quick-add CTAs** (V-02) — C-07 routing plan handles.
- **`Luton` subtitle redesign** (V-03 + V-04) — copy polish, C-12+.
- **`/admin/me` redesign** — separate surface; C-12+ Therapist UX.
- **Animations on bar chart transitions** — out of scope; existing charts respect motion-reduce.
- **i18n / multi-language** — out of scope; English-only.

---

*End of C-11 brief. Plan file follows: `redesign/plans/C-phase/C-11-dashboard-variants-design-system-plan.md`.*
