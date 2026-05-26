# C-10 — Bottom-of-page spacing / footer overlap fix

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §3 C-10 (status: unchanged; needs Playwright 375 audit pass to catalogue)
- `redesign/audits/C-A/01-dashboard-audit.md` §5 CV-02 (root-cause finding — `AdminPageScaffold` adds `pb-24 md:pb-8` correctly; surfaces missing the scaffold are the suspects)
- `BAND-C-MASTER-PLAN.md` §3 C-10 (original scope)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-10-bottom-spacing-footer-overlap-plan.md`
- Progress: `redesign/per-page-progress/C-10-bottom-spacing-footer-overlap-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-10 is **the smallest C-B plan** — a discovery + remediation pass for "footer overlap" / bottom-spacing issues across admin surfaces. Master plan §3 C-10 framed it as "Some pages have the bottom section sitting too close to the footer, so the bottom content can't be seen properly."

**Root cause (from audit #01 CV-02):** `AdminPageScaffold` adds `pb-24` on mobile (96px) and `md:pb-8` on desktop (32px). The mobile bottom nav is `position: fixed; bottom: 0; height: 56.6px`. 96px clears the nav with ~40px breathing room. **Surfaces that DON'T use `AdminPageScaffold` (or that override its padding) get bottom content covered by the fixed nav.**

C-10 is a **two-phase plan**:
1. **Phase A — Catalogue:** Playwright walk at 375 + 1280 across every admin surface. Identify surfaces where content is hidden behind the bottom nav OR a sticky save bar OR similar.
2. **Phase B — Remediate:** for each catalogued surface, apply `AdminPageScaffold` (if missing) OR adjust the local bottom-padding to clear the obstruction.

No new design primitives, no new components, no schema, no permissions. **Pure CSS-padding hygiene pass.**

---

## 1 — Why this plan exists

### 1.1 The audit hint (audit #01 CV-02)

Audit #01 verified the dashboard at 4 viewports — bottom content clears the mobile nav correctly. The audit explicitly flagged C-10's scope: *"'footer overlap' item likely concerns surfaces where this `pb-24 md:pb-8` discipline is not applied. Dashboard is OK; other surfaces need verifying."*

### 1.2 Why a discovery pass first

The decisions doc says "Status unchanged — needs Playwright 375 audit pass to catalogue." Without the catalogue, the remediation list is unknown. Phase A produces the punch list; Phase B fixes.

### 1.3 Why this is the smallest C-B plan

Each fix is a CSS-class addition or adjustment (`pb-24 md:pb-8` or equivalent). No design decisions, no edge cases, no schema. Mechanical work once the punch list is set.

---

## 2 — Scope (lifted from master plan §3 C-10)

### 2.1 Phase A — Discovery (Playwright sweep)

**Per-surface walk at 375px (mobile) + 1280px (desktop) + 768 spot-check:**

| Surface | Notes |
|---|---|
| `/admin/dashboard` (all 3 variants) | Audit #01 verified OK. Re-confirm. |
| `/admin/bookings` (list) | Audit #02 verified OK. Re-confirm. |
| `/admin/bookings/new` | High suspect — sticky save bar at the bottom; verify no double-coverage. |
| `/admin/bookings/[bookingId]` | Audit #04 verified OK. Re-confirm. |
| `/admin/clients` (list) | Audit #05 — check. |
| `/admin/clients/new` | Has sticky save bar — check. |
| `/admin/clients/[clientId]` | Audit #07 — check. |
| `/admin/clients/[clientId]/edit` (C-06 NEW) | NEW route — verify pb-24 from start. |
| `/admin/enquiries` | Audit #08 — check. |
| `/admin/calendar` | Big grid surface — check. |
| `/admin/staff` + `/admin/staff/[id]` | Audit #10 + #11 — check. |
| `/admin/staff/[id]/availability` | Has multiple stacked forms — check. |
| `/admin/staff/[id]/performance` | Audit #13 — check. |
| `/admin/availability` (global) | Audit #15 — check. |
| `/admin/services` | Audit #16 — check. |
| `/admin/settings` | Audit #17 — has sticky save bar — check. |
| `/admin/operations` | Audit #18 — check. |
| `/admin/emails` | Audit #19 — check. |
| `/admin/email-templates/preview/[id]` | iframe surface — check. |
| `/admin/roles` + `/admin/roles/[id]` | Audit #21 — check. |
| `/admin/privacy` | Audit #22 — check. |
| `/admin/account-password-requests` | Audit #23 — check. |
| `/admin/audit` | Audit #24 — check. |
| `/admin/reports` | Audit #25 — check. |
| `/admin/me` | Audit #14 — check. |
| `/admin/bookings/series/[templateId]` (C-02 NEW) | NEW route — verify from start. |

**Verification technique per surface:**

```js
// Playwright snippet — at 375px viewport
const bottomNav = document.querySelector('[role="navigation"][data-mobile-nav]'); // or the actual selector
const navTop = bottomNav?.getBoundingClientRect().top;
const lastContentEl = document.querySelector('main')?.lastElementChild; // page's last meaningful child
const contentBottom = lastContentEl?.getBoundingClientRect().bottom;

// Pass: contentBottom < navTop (with ≥ 20px breathing room)
// Fail: contentBottom >= navTop (content hidden behind nav)
```

For sticky save bars (e.g., `/admin/settings`), check that the save bar's `bottom` accounts for the nav's height — common pattern is `bottom: 14` (above-nav stacked).

**Output of Phase A:** a markdown deliverable `redesign/audits/C-A/c-10-overlap-catalogue.md` listing each surface + status (✅ OK / ⚠️ overlap detected / 🔨 NEW route to verify) + screenshot evidence per fail.

### 2.2 Phase B — Remediation

For each catalogued surface marked ⚠️ overlap detected:

**Fix pattern 1 — Surface missing `AdminPageScaffold`:**

```tsx
// Before:
export default async function SomeAdminPage() {
  return <div className="...">...</div>;
}

// After:
import { AdminPageScaffold } from "@/app/admin/components/admin-ui";

export default async function SomeAdminPage() {
  return (
    <AdminPageScaffold width="narrow|wide|default">
      ...
    </AdminPageScaffold>
  );
}
```

`AdminPageScaffold` is the canonical container — verified at audit #01 to apply `pb-24 md:pb-8` correctly. Surfaces using it inherit the right spacing.

**Fix pattern 2 — Sticky save bar overlapping mobile nav:**

```tsx
// Before:
<div className="sticky bottom-0 ...">

// After:
<div className="sticky bottom-14 md:bottom-0 ...">
// The bottom-14 (56px = mobile nav height) raises the save bar above the nav on mobile.
```

Lift the pattern from `ClientCreateForm.tsx:431-432` (verified in C-06 brief inspection — `sticky bottom-14 z-30`).

**Fix pattern 3 — Local `pb-*` override that's too small:**

If a surface has `pb-4` or similar overriding the scaffold's `pb-24`, increase to `pb-24 md:pb-8` (mobile-specific) or remove the override.

**Fix pattern 4 — Nested scaffolds / double-padding:**

If a surface wraps `AdminPageScaffold` inside another container that also adds bottom padding, the result is double-padding (acceptable but wasteful). Document but don't fix unless visually broken.

### 2.3 Out-of-tree polish (public booking flow)

Master plan didn't mention public booking pages (`/booking/...`). Per existing audit scope, public pages are out of admin scope. **C-10 doesn't touch them.** If catalogue surfaces a need, defer to C-12+.

---

## 3 — RBAC matrix

**Not applicable.** C-10 doesn't introduce permissions, doesn't change visibility, doesn't modify routing. Pure CSS hygiene.

---

## 4 — Layout strategy

Layout is the SUBJECT, not the strategy. The fix is **mechanical bottom-padding application** to surfaces missing it.

### 4.1 Visual expectations

Before fix (example — generic broken surface):

```
┌───────────────────────────┐
│ Header                    │
│ ─────────────────────────│
│ Content                   │
│ ─────────────────────────│
│ Form                      │
│ [ Submit ] ← covered     │  ← fixed nav covers
│ ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ │  ← mobile nav (fixed bottom)
└───────────────────────────┘
```

After fix:

```
┌───────────────────────────┐
│ Header                    │
│ ─────────────────────────│
│ Content                   │
│ ─────────────────────────│
│ Form                      │
│ [ Submit ]                │
│                           │  ← pb-24 breathing room
│ ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ │  ← mobile nav
└───────────────────────────┘
```

For sticky save bars (e.g., settings):

After fix:

```
┌───────────────────────────┐
│ Form content              │
│ ...                       │
│ ──── (scroll)             │
│ ╔═════════════════════╗   │
│ ║ Save / Cancel       ║   │  ← sticky bar — sits ABOVE the nav
│ ╚═════════════════════╝   │  ← bottom-14 = 56px
│ ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ │  ← mobile nav (fixed bottom)
└───────────────────────────┘
```

---

## 5 — States & edge cases

### 5.1 Surface with a footer inside the main content (e.g., customer manage page)

The customer manage page is OUT-OF-ADMIN-TREE. C-7 added a "Need help?" footer there. The mobile nav doesn't render on `/booking/...`. So no overlap. Out of C-10 scope.

### 5.2 Surface with a `<dialog>` modal

Modals render in their own stacking context; the fixed nav doesn't affect them. No spacing fix needed.

### 5.3 Surface with horizontal scroll (e.g., chip strip)

Horizontal scroll is independent of bottom spacing. No interaction.

### 5.4 Surface where the bottom IS deliberately at the viewport edge (e.g., loading skeleton)

Loading state shouldn't overlap nav either. Verify the scaffold applies to the loading skeleton too.

### 5.5 Surface with `min-h-screen` and short content

Short content + min-h-screen → empty space below the content but still bounded by the viewport. Mobile nav covers nothing. Acceptable.

### 5.6 Sticky save bar that's hidden when nothing's edited

If the sticky bar is `display: none` when no changes, no overlap. When shown, must clear the nav. Verify in dirty state.

---

## 6 — Migration footprint

**None.** Pure CSS class adjustments. No schema, no permissions, no audit_log changes.

---

## 7 — Files touched (preview — unknown until Phase A)

### NEW (1 file)
- `redesign/audits/C-A/c-10-overlap-catalogue.md` — Phase A deliverable

### EDITED (TBD per Phase A catalogue — estimated 5-15 files)

Each surface's `page.tsx` OR the relevant client component (typically the form wrapper). Each edit is a small CSS class addition / adjustment.

**Likely suspects (from audit re-reads):**
- `/admin/bookings/new/page.tsx` — verify scaffold + sticky save bar bottom-14
- `/admin/clients/new/page.tsx` — verify (already has sticky bar at `bottom-14 z-30`)
- `/admin/clients/[clientId]/edit/page.tsx` (C-06 NEW) — apply scaffold from start
- `/admin/settings/page.tsx` — verify sticky save bar
- `/admin/staff/[id]/availability/page.tsx` — multi-form surface; high suspect
- `/admin/bookings/series/[templateId]/page.tsx` (C-02 NEW) — apply scaffold from start
- `/admin/me/page.tsx` — verify scaffold (post-C-07 Quick links addition didn't break spacing)

Catalogue determines actual list.

### UNCHANGED
- `AdminPageScaffold` component itself — it's correct per audit #01.
- Mobile nav component — fixed positioning + height verified.
- All non-CSS code paths.

---

## 8 — Sequencing and dependencies

**No hard blockers.** C-10 ships last per recommended C-B order. Reasoning:
- Several prior plans introduce new routes (`/admin/clients/[id]/edit` from C-06, `/admin/bookings/series/[id]` from C-02, etc.). C-10 catalogues + fixes them along with existing surfaces.
- If C-10 ships earlier, new routes from later plans must apply the spacing themselves at creation time (less efficient).

**Coordination:**
- C-11's variant extraction shouldn't break spacing (each variant inherits AdminPageScaffold). Verify in C-10 catalogue.
- C-FIELDWORK's mobile sidebar reorder doesn't affect bottom spacing.
- C-07's new SavedFiltersBar above the bookings list doesn't push other content; bottom-spacing unaffected.

---

## 9 — Open questions

**Q9.1 — Catalogue strictness**

How strict is "overlap"? Defined as: ≥ 20px breathing room between content bottom and nav top at 375px. Smaller threshold OK but documented as design tolerance.

**Q9.2 — Public booking flow**

Out of scope per §2.3. If user wants polish there, separate plan.

**Q9.3 — Customer manage page footer**

`/booking/manage/[token]/` has the C-07 "Need help?" footer. C-10 doesn't touch it (public, no nav).

**Q9.4 — Surfaces NOT using `AdminPageScaffold` — should we standardise?**

Locked: yes, where possible. Some surfaces may have legitimate reasons not to use it (custom layouts); document the exceptions.

**Q9.5 — Loading skeleton states**

Verify loading state inherits scaffold. If not, Phase B fixes.

**Q9.6 — When the catalogue is empty**

If Phase A finds zero overlapping surfaces, C-10 ships as a "verified clean" docs deliverable + no code changes. Acceptable — C-10's value is the verification pass.

**Q9.7 — Print mode**

Print stylesheet should already remove the fixed nav. No bottom-spacing issue for print. Verify.

---

## 10 — Acceptance criteria

A C-10 implementation is complete when:

1. **Phase A catalogue exists** at `redesign/audits/C-A/c-10-overlap-catalogue.md` listing every admin surface + status.
2. **All ⚠️ surfaces remediated** — each fix is a small CSS-class addition + visual verification.
3. **No regressions** — fixes don't break desktop layouts.
4. **Playwright re-sweep at 375 + 768 + 1280 passes** — every admin surface clears the bottom nav with ≥ 20px breathing room.
5. **Sticky save bars sit above nav** — `bottom-14` (mobile) / `bottom-0` (desktop) pattern verified.
6. **Loading states inherit spacing** — verified per surface.
7. **All static gates pass** — lint, tsc, vitest, build, bundle delta within budget (~zero net change — CSS-only).
8. **Screenshot evidence** at 375 viewport per remediated surface (before + after).

---

## 11 — References

| Source | What it gives |
|---|---|
| `BAND-C-MASTER-PLAN.md` §3 C-10 | Scope statement |
| `01-dashboard-audit.md` §5 CV-02 | Root-cause finding + the `pb-24 md:pb-8` discipline |
| `ClientCreateForm.tsx:431-432` | Canonical sticky-save-bar pattern (`sticky bottom-14 z-30`) |
| `AdminPageScaffold` component | Canonical container — `pb-24 md:pb-8` applied |

---

## 12 — Out of scope

- **Public booking flow** (`/booking/...`) — separate concern.
- **Login + auth pages** — no admin nav; no overlap.
- **Print media** — already excluded from fixed nav.
- **Email template preview iframe** — iframe is sandboxed; bottom spacing inside the iframe is its own context.
- **Design-system changes** — `AdminPageScaffold` stays as-is. C-10 USES it, doesn't redesign it.
- **Mobile nav redesign** — fixed-bottom-nav is the standard; C-10 doesn't touch it.
- **Surface-specific layout redesigns** — C-10 is mechanical padding only.
- **Sticky-save-bar redesign** — pattern from ClientCreateForm is the lift target; no redesign.

---

*End of C-10 brief. Plan file follows: `redesign/plans/C-phase/C-10-bottom-spacing-footer-overlap-plan.md`.*
