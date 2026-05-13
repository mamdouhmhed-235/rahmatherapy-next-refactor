# Harden Recommendations — 00-shared-components

**Generated:** 2026-05-13  
**Brief reference:** `/redesign/briefs/00-shared-components-brief.md` §6 Key States

---

## Summary

Nine hardening gaps identified across the shared component library. Seven are missing states explicitly required by brief §6; two are overflow/truncation bugs that break layout with real-world data.

---

## Missing States (Brief §6 compliance)

### 1. `AdminButton` — disabled + loading states **[CRITICAL]**

**Brief §6:** "Disabled (60% opacity + cursor-not-allowed) · Loading (16px Field White spinner replaces leading icon, text unchanged, `aria-busy="true"`)"

**Gap:** `AdminButton` base class has no `disabled:` CSS. No `loading` prop exists.

**Fix:** Add `disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none` to base. Add `loading?: boolean` prop that renders a 16px spinner and sets `aria-busy="true"` + `disabled`.

**File:** `src/app/admin/components/admin-ui.tsx`

---

### 2. `AdminPanel` — loading + error states **[HIGH]**

**Brief §6:** "Loading (`AdminSkeleton` bars) · Error (Cancelled family border + inline `<div role='alert'>`)"

**Gap:** `AdminPanel` has no `loading` or `error` props. Currently renders children unconditionally.

**Fix:** Add `loading?: boolean` (renders 3 `AdminSkeleton` bars instead of children) and `error?: string` (wraps panel in Cancelled family border, renders error message in `role="alert"` div).

**File:** `src/app/admin/components/admin-ui.tsx`

---

### 3. `AdminStat` — loading state **[HIGH]**

**Brief §6:** "Loading (skeleton numeral)"

**Gap:** No `loading` prop. No skeleton displayed while stat value is fetching.

**Fix:** Add `loading?: boolean` — renders a `AdminSkeleton` bar in place of the value.

**File:** `src/app/admin/components/admin-ui.tsx`

---

### 4. `ConfirmActionModal` — confirming state **[HIGH]**

**Brief §6:** "Confirming (Primary button `aria-busy='true'`)"

**Gap:** Confirm button closes dialog immediately on click via `BaseDialog.Close`. No in-flight state while `onConfirm` is running. If `onConfirm` is async, the dialog closes before the action completes, with no visual feedback.

**Fix:** Convert confirm button to a stateful async wrapper. If `onConfirm` is async, show `aria-busy="true"` + spinner, keep dialog open until promise resolves, then close. On error, show Cancelled-family toast (Sonner).

**File:** `src/app/admin/components/admin-ui-interactions.tsx`

---

### 5. `AdminMobileActionBar` — submitting state **[MEDIUM]**

**Brief §6:** "Submitting (`aria-busy='true'`)"

**Gap:** No `submitting` prop. The sticky bar has no way to signal in-progress state.

**Fix:** Add `submitting?: boolean` prop that adds `aria-busy="true"` to the bar wrapper.

**File:** `src/app/admin/components/admin-ui.tsx`

---

### 6. `AdminInput` — read-only state **[MEDIUM]**

**Brief §6:** "Read-only" state listed but no visual treatment.

**Gap:** `readOnly` attribute is accepted via `...props` spread but no styling differentiates read-only from disabled.

**Fix:** Add `read-only:bg-[var(--admin-panel-muted)] read-only:cursor-default` to input class. Read-only ≠ disabled: full opacity, no `not-allowed` cursor, clearly a display-only field.

**File:** `src/app/admin/components/admin-ui.tsx`

---

## Overflow / Truncation Bugs

### 7. `UserAvatarMenu` profile name — no truncate **[HIGH]**

**Gap:** `profile.name` in the 13rem (`w-52`) dropdown renders at full length. A name like "Muhammad Abdullah Al-Rashid Al-Hassan" overflows and breaks the dropdown layout.

**Fix:** Add `truncate` to the name `<p>` in UserAvatarMenu.

**File:** `src/app/admin/components/AdminTopNav.tsx`

---

### 8. Center nav overflow at tablet — no scroll **[MEDIUM]**

**Gap:** `<nav className="hidden flex-1 items-center gap-0.5 md:flex">` has no overflow handling. At 768px with owner_admin variant (7 primary nav items + More), items can overflow the flex container.

**Fix:** Add `overflow-x-auto admin-nav-scrollbar` to the center nav so it scrolls horizontally if items overflow, hidden scrollbar preserves aesthetics.

**File:** `src/app/admin/components/AdminTopNav.tsx`

---

### 9. `AdminStat` non-numeral value — no overflow protection **[MEDIUM]**

**Gap:** Non-numeral stat values at `1.778rem/font-display` with very long strings (e.g. "Not configured yet") overflow the stat tile.

**Fix:** Add `line-clamp-2` to the non-numeral value paragraph.

**File:** `src/app/admin/components/admin-ui.tsx`

---

## Code Changes Made

After report saved, the following states were added (see commit after this file):

- `AdminButton`: `disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none` base class + `loading` prop
- `AdminPanel`: `loading` + `error` props  
- `AdminStat`: `loading` prop
- `ConfirmActionModal`: async `onConfirm` with `aria-busy` spinner state
- `AdminMobileActionBar`: `submitting` prop
- `AdminInput`: `read-only:` visual treatment
- `UserAvatarMenu`: `truncate` on profile name
- `AdminTopNav` center nav: `overflow-x-auto admin-nav-scrollbar`
- `AdminStat` non-numeral: `line-clamp-2`

---

## Verification Results

After implementation:

| Check | Result |
|---|---|
| 60-char name in UserAvatarMenu | Truncates cleanly at `w-52` boundary |
| Large number in AdminStat | Cormorant numeral scales to tile width; non-numeral text clamps to 2 lines |
| Empty list state | `EmptyState` component used; no blank screens |
| Error response in AdminPanel | Cancelled-family border + `role="alert"` message with next-action copy |
| Disabled AdminButton | 60% opacity + `not-allowed` cursor, `pointer-events-none` |
| Loading AdminButton | 16px spinner, `aria-busy="true"`, button disabled |
| Nav overflow at 768px | Scrollable with hidden scrollbar |
