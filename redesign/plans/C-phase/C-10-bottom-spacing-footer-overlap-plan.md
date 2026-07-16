# C-10 — Bottom-spacing / footer overlap fix — **PLAN**

**Type:** Band C plan-writing output (C-B phase — final plan)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-10-bottom-spacing-footer-overlap-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-10-bottom-spacing-footer-overlap-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree.** `git status --short` empty.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → 200.
3. **Baseline tests + static gates.** `pnpm vitest run` 485/491; `pnpm lint` + `tsc` green.
4. **Cross-plan dependency check** — ideally all prior C-B plans merged so the new routes from C-06 (clients edit) + C-02 (series view) are catalogued alongside existing surfaces. Pre-flight tolerates missing prior plans; catalogue what exists. **(2026-07-16) HARD exception: C-16 (pagination + bounded lists) must be merged first** — it changes list-page heights and adds `PaginationBar` above the bottom padding on ~8 surfaces; measuring spacing before it lands would catalogue stale geometry. If C-16 is absent, STOP and confirm with the user.
5. **Locate `AdminPageScaffold`:**

   ```bash
   git grep -n "export.*AdminPageScaffold" src/app/admin/components/
   # Verify the canonical container exists
   ```

6. **Identify surfaces using AdminPageScaffold:**

   ```bash
   git grep -l "AdminPageScaffold" src/app/admin
   ```

   The list of admin pages NOT in this output is the candidate set for Phase A inspection.

7. **DO-NOT-TOUCH list:** Badar's `9d55ce2a`, real customer data — Playwright walks read-only.

---

## 1 — Safe implementation order (2 phases)

### Phase A — Discovery (Playwright catalogue sweep)

**Step 1 — Per-surface Playwright walk at 375 + 768 + 1280.**

Sign in as Owner (full surface access). For each surface from the brief §2.1 list:

1. Navigate to the surface.
2. At 375 viewport: capture screenshot + run verification snippet:

```js
() => {
  // Find the fixed mobile bottom nav
  const bottomNav = document.querySelector('nav[aria-label*="mobile" i], [data-mobile-nav], nav.fixed.bottom-0');
  if (!bottomNav) return { result: "no-mobile-nav", note: "Surface has no fixed bottom nav at this viewport" };

  const navRect = bottomNav.getBoundingClientRect();

  // Find the last meaningful content element
  const mainEl = document.querySelector('main') || document.body;
  const allChildren = Array.from(mainEl.querySelectorAll('*'));
  // Skip elements that are visually hidden / aria-hidden / display:none
  const visible = allChildren.filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
  });
  const lastVisible = visible[visible.length - 1];
  if (!lastVisible) return { result: "no-content" };

  const contentRect = lastVisible.getBoundingClientRect();
  const breathingRoom = navRect.top - contentRect.bottom;
  const documentHeight = document.documentElement.scrollHeight;
  const scrollPos = window.scrollY + window.innerHeight;
  const isAtBottom = scrollPos >= documentHeight - 5;

  // Scroll to bottom first to evaluate overlap
  window.scrollTo(0, documentHeight);
  const contentRectAfterScroll = lastVisible.getBoundingClientRect();
  const breathingRoomAtBottom = navRect.top - contentRectAfterScroll.bottom;

  return {
    result: breathingRoomAtBottom >= 20 ? "ok" : "overlap",
    breathingRoom: breathingRoomAtBottom,
    contentBottom: contentRectAfterScroll.bottom,
    navTop: navRect.top,
  };
}
```

Record the result + screenshot per surface.

3. At 1280 viewport: verify no fixed mobile nav covers content (desktop typically uses a different layout).

4. Apply judgement for sticky save bars — they should `bottom-14` to sit above the mobile nav.

**Step 2 — Produce the catalogue.**

New file `redesign/audits/C-A/c-10-overlap-catalogue.md`:

```markdown
# C-10 Bottom-spacing overlap catalogue

**Date:** 2026-05-{NN}
**Auditor:** {role}
**Viewports walked:** 375 + 768 + 1280

## Summary

- Surfaces walked: N
- Surfaces with overlap: M
- Surfaces with sticky-save-bar issues: K
- NEW routes (post-C-06/C-02 etc.) verified clean: P

## Per-surface results

### /admin/dashboard
- 375: ✅ ok (breathing room: 45px)
- 1280: ✅ no fixed nav
- Notes: ...

### /admin/bookings/new
- 375: ⚠️ overlap (breathing room: -8px — content hidden behind nav)
- 1280: ✅ no fixed nav
- Notes: sticky save bar at bottom-0; should be bottom-14
- Fix: edit ManualBookingForm.tsx line N → change to bottom-14 md:bottom-0

### {... per surface}

## Remediation list

[Auto-generated from ⚠️ entries above]

1. `src/app/admin/bookings/new/ManualBookingForm.tsx` — sticky save bar bottom positioning
2. {...}

## Verified clean

[Auto-generated from ✅ entries above]

1. /admin/dashboard
2. {...}
```

**Phase A verify checkpoint:**
- Catalogue file committed.
- Punch list in §Remediation enumerated with specific file:line targets.
- If 0 entries in Remediation: C-10 ships as docs-only "verified clean" + immediate Phase B-skip → final commit.

### Phase B — Remediation

**Step 3 — Apply fixes per catalogue entry.**

For each entry in Phase A's Remediation list, apply the appropriate fix pattern (per brief §2.2):

**Pattern 1 — Wrap with AdminPageScaffold:**

```tsx
import { AdminPageScaffold } from "@/app/admin/components/admin-ui";

export default async function SomeAdminPage() {
  return (
    <AdminPageScaffold width="default">
      {/* existing content */}
    </AdminPageScaffold>
  );
}
```

Pick width prop based on visual inspection — typically `default` (max-w-7xl mx-auto) or `narrow` (max-w-2xl for forms).

**Pattern 2 — Adjust sticky save bar:**

```tsx
// Before:
<div className="sticky bottom-0 z-30 ...">

// After:
<div className="sticky bottom-14 z-30 md:bottom-0 ...">
```

**Pattern 3 — Fix local pb override:**

```tsx
// Before (page wraps with smaller padding):
<div className="grid gap-6 pb-4">

// After:
<div className="grid gap-6 pb-24 md:pb-8">
```

OR remove the override entirely if `AdminPageScaffold` provides correct padding.

**Pattern 4 — Document but don't fix (nested scaffolds):**

```tsx
// Document in c-10-overlap-catalogue.md as "double-padding, acceptable"
```

**Step 4 — Per-fix verification.**

After each remediation:
1. Re-run the Step 1 Playwright snippet on the fixed surface at 375.
2. Verify result becomes `"ok"` with breathing room ≥ 20px.
3. Visual check at 1280 — no desktop regression.
4. If dirty form state is in the picture (sticky save bar): verify the bar sits above the nav AND doesn't overlap the saved-state hidden render.

**Step 5 — Re-sweep verification.**

After all remediations land, re-run the Phase A walk on the fixed surfaces. All should return `"ok"`.

**Phase B verify checkpoint:**
- All ⚠️ catalogue entries are now ✅.
- No new regressions on previously-clean surfaces.

---

## 2 — Files touched (final list — depends on Phase A)

### NEW (1 file)
- `redesign/audits/C-A/c-10-overlap-catalogue.md` — Phase A discovery deliverable

### EDITED (TBD — estimated 5-15 files based on brief §7)

Per surface in Phase A Remediation list. Each is a small CSS class addition / adjustment in:
- `page.tsx` of the surface OR
- The relevant client component (typically the form wrapper / sticky save bar).

**No `*-data.ts` files touched** — purely view-layer CSS.

### UNCHANGED
- `AdminPageScaffold` component — correct per audit #01.
- Mobile nav component.
- All other code paths.

---

## 3 — Verification gate

### 3.1 Static gates

```bash
pnpm lint                       # 0 errors
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # baseline preserved (CSS-only changes don't affect tests)
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta ~zero
```

**Bundle budget:** Net-zero. CSS class additions are tree-shaken text strings. No new components, no new logic.

### 3.2 Re-sweep verification

After all Phase B fixes, re-run the Phase A walk. Every previously-⚠️ surface now ✅.

### 3.3 Visual regression spot-check

For each remediated surface:
- 1280 desktop view — should look identical to pre-fix (desktop padding unchanged).
- 375 mobile view — content now clears the nav with ≥ 20px breathing room.
- 768 spot-check — neither breaking.

### 3.4 Sticky save bar dirty-state check

For surfaces with sticky save bars (Settings, ManualBookingForm, ClientCreateForm if changed, etc.):
- Open the form clean → save bar (if visible) sits above nav.
- Edit a field → save bar shows save-state at bottom-14 (mobile) — above nav.
- Save → bar hides or reverts to previous; nav still clear.

### 3.5 Screenshot evidence

Per remediated surface, 375 mobile:
- Before-fix screenshot (from Phase A catalogue)
- After-fix screenshot (showing breathing room)

Plus a few 1280 desktop screenshots for spot-check.

Store in `redesign/audits/C-A/c-10-after/`.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| AdminPageScaffold wrap breaks an existing custom layout | low | medium | Phase A catalogues which surfaces have intentional custom layouts. Phase B documents-but-doesn't-fix those. Verification per surface. |
| Sticky save bar position breaks at intermediate viewports (640px etc.) | low | low | `bottom-14 md:bottom-0` covers the Tailwind md breakpoint (768px). Verify spot-check at 640 + 720. |
| Phase A finds zero overlap → C-10 is a no-op | low | low | Docs deliverable ships as "verified clean." Phase B-skip is acceptable outcome. |
| Phase A catalogue grows large (15+ surfaces) | medium | low | Mechanical per-surface fixes; each is small. Commit cadence groups fixes by surface family (forms / lists / details). |
| Mobile nav height changes in future Tailwind upgrade | very low | low | Hardcoded `bottom-14` = 56px. If nav height changes, this plan's fixes drift. Acceptable — fixing then is trivial. |
| Bundle delta unexpected (CSS strings somehow grow) | very low | low | Pre/post measurement per §3.1. |
| Dark mode (post-C-11) affects spacing perception (not actual spacing) | low | low | Spacing is theme-neutral. Verify both themes don't differ. |
| Footer overlap re-emerges in C-12+ new surfaces | medium | low | C-10's pattern documented; future plans follow AdminPageScaffold discipline. C-12+ adds lint rule if drift observed. |

---

## 5 — Undo procedure

### 5.1 Per-fix revert

Each remediation commits independently (or grouped by surface family). Revert per commit.

### 5.2 Catalogue revert

`redesign/audits/C-A/c-10-overlap-catalogue.md` deletion if needed.

### 5.3 No DB rollback

C-10 has no DB changes.

---

## 6 — Test fixture guidance

**Safe for C-10:** all test fixtures. C-10 walks surfaces read-only.

**DO NOT touch:** Badar's `9d55ce2a`, real customer data. Playwright walks shouldn't mutate state.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — Playwright catalogue + `c-10-overlap-catalogue.md` |
| 2 | Phase B — Form surfaces (bookings/new, clients/new, clients/[id]/edit, settings) |
| 3 | Phase B — Detail surfaces (bookings/[id], clients/[id], staff/[id]) |
| 4 | Phase B — List surfaces (bookings, clients, staff, enquiries, etc.) |
| 5 | Phase B — Misc / NEW routes (series view, edit route, etc.) |
| 6 | Verification — Playwright re-sweep + screenshots + progress + master plan checklist → ✅ |

If Phase A catalogue finds zero overlap, commits 2-5 collapse into a single "no remediation needed" docs commit.

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-10 {phase} — {surface family}` during C-C.

---

## 8 — Hand-off to C-C

1. Read brief + plan.
2. Run §0 Pre-flight.
3. Execute Phase A first — catalogue all surfaces. If catalogue is empty, ship docs-only commit + skip to verification.
4. Execute Phase B — remediate per catalogue.
5. Verification gate (§3) — re-sweep + screenshots.
6. Update progress file per commit.
7. Final commit updates master plan checklist C-10 → ✅.
8. **C-10 is the FINAL C-B plan — its completion marks C-B (12/12) complete.** Master plan C-B row state updates to ✅.

---

## 9 — Open questions remaining

1. **Catalogue strictness threshold** — Q9.1 in brief. ≥ 20px breathing room. Tighter / looser at C-C judgement.
2. **AdminPageScaffold width prop** — default vs narrow vs wide. Per-surface visual judgement at Phase B.
3. **NEW routes from later plans** — C-06's edit route, C-02's series view. Both should apply AdminPageScaffold from creation; C-10 catalogues to verify.
4. **Loading skeleton coverage** — Q9.5. Verify scaffold applies to loading states.
5. **Empty Phase A result** — Q9.6 + §1 Step 2 note. Acceptable docs-only ship.
6. **Public booking flow** — §2.3 brief out-of-scope.
7. **Custom layouts that legitimately don't use scaffold** — document in catalogue, don't fix.
8. **Future drift prevention** — lint rule or visual-regression test in C-C if observed. C-12+.

---

*End of C-10 plan. Brief: `redesign/briefs/C-10-bottom-spacing-footer-overlap-brief.md`. Progress: `redesign/per-page-progress/C-10-bottom-spacing-footer-overlap-progress.md` (filled during C-C). **C-10 is the FINAL plan in C-B; its completion marks C-B (12/12) ✅.***
