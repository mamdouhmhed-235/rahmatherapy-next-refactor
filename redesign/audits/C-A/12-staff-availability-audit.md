# C-A.1 #12 — `/admin/staff/[staffId]/availability` audit

**Surface:** per-staff availability config (mode + weekly rules + blocked dates + one-off overrides)
**Audit type:** C-A.1 discovery (no fixes)
**Date:** 2026-05-25
**Pre-state:** branch `redesign/start-state` HEAD `1d31047`.
**Source:** `page.tsx` (299) + 4 manager components + `actions.ts` + `lib.ts`. Subagent + Owner @ 1280 + 375.
**Screenshots:** 2 PNGs.

---

## 1 — Bugs found

### B-55 — UI/backend mode mismatch: UI selector exposes 2 modes; backend supports 3
**Severity:** medium (feature unreachable)
**Source:** subagent — `AvailabilityModeSelector.tsx:12` declares type as `"use_global" | "custom"`; `src/app/admin/staff/actions.ts:19` declares `"use_global" | "custom" | "global_with_overrides"`. The third mode is valid backend state but cannot be set via UI.
**Implication:** if a staff record's mode is `global_with_overrides` (set via SQL or migration), the selector renders without a matching option. Worth investigating in C-B planning.

### B-56 — No EDIT for weekly rules — delete + recreate only
**Severity:** medium (UX)
**Source:** subagent `StaffAvailabilityRulesForm.tsx:205-246`. Add + delete buttons; no inline edit. Adjusting Friday's hours = delete + re-add.

### B-57 — `Promise.all()` swallows per-query failures on page.tsx:81-127
**Severity:** low-medium (silent partial state)
**Source:** subagent — six parallel queries; only falsy checks on `data` fields. Single query failure renders incomplete page without surfacing.

### B-58 — Five unguarded `animate-spin` instances
**Severity:** low (a11y consistency)
**Source:** subagent `AvailabilityModeSelector.tsx:167, 187, 208`, `StaffAvailabilityRulesForm.tsx:348`, `StaffBlockedDatesManager.tsx:250`, `StaffAvailabilityOverridesManager.tsx:299`.

### B-59 — No overlap detection on overrides
**Severity:** low-medium (data hygiene)
**Source:** subagent — checks date≥today + duplicate + end>start, but NO check for time-range overlaps with adjacent overrides on the same date OR conflicts with weekly rule windows.

### B-60 — Two `data-redesign-fake` markers (form-section placeholders)
**Severity:** low (acknowledged tech debt)
**Source:** subagent `StaffBlockedDatesManager.tsx:176`, `StaffAvailabilityOverridesManager.tsx:200`. Same pattern as the FAKE comments elsewhere — explicit "pending redesign" flags.

### B-61 — Global availability permission has no team-isolation check
**Severity:** medium (RBAC scope)
**Source:** subagent — staff with `MANAGE_AVAILABILITY_GLOBAL` can edit ANY staff member's availability without team-membership check. Inactive/deactivated staff also editable (UI note shown but backend allows write).

### B-62 — `BookingGuardModal` uses `role="alertdialog"` without `aria-modal="true"` or focus trap
**Severity:** low (a11y)
**Source:** subagent `StaffBlockedDatesManager.tsx:393-443`.

---

## 2 — Visual issues

### V-34 — Sections: Availability mode / Weekly working hours / Blocked dates / One-off overrides
**Source:** verified live. ✅ Clear IA.

### V-35 — Mode-selector buttons are `h-11 flex-1` on mobile, `sm:h-10 sm:flex-initial` desktop
**Source:** subagent. Mobile buttons stack full-width — reasonable touch targets but use vertical space.

### V-36 — Tablet (sm-lg) stacks form fields awkwardly
**Source:** subagent `StaffAvailabilityOverridesManager.tsx:201`, `StaffAvailabilityRulesForm.tsx:271`. Form `sm:grid-cols-2 lg:grid-cols-[…]` leaves tablet at single column despite available width.

---

## 3 — Empty / edge states

### E-27 — Soft warning on override for non-working day
**Source:** subagent `StaffAvailabilityOverridesManager.tsx:124-128`. Smart UX — warns without blocking. ✅ Accept.

### E-28 — Past blocked dates + past overrides in collapsible sections
**Source:** subagent — chronological organisation. ✅ Accept.

---

## 4 — Cross-role inconsistencies

### CR-23 — Therapist self-edit allowed via `MANAGE_AVAILABILITY_OWN` + `isOwnProfile`
**Source:** subagent `page.tsx:40-47`. Consistent with #11 staff detail pattern.

---

## 5 — Cross-viewport issues

### CV-27 — Tab strip `-mx-4 overflow-x-auto` on mobile
**Source:** subagent `page.tsx:222`. Horizontal momentum scroll for tab nav. Same overflow pattern as enquiries (#08 CV-19).

---

## 6 — Console / network issues

### CN-25 — 0 errors / 0 warnings.

---

## 7 — Pre-existing items the audit accepts

### PE-38 — `actions.ts:62-96` correctly traps unique-violation SQLSTATE
**Source:** subagent. Specific SQLSTATE handling — good error pattern.

---

## 8 — Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-55 — UI mode mismatch (2 vs 3) | Add `global_with_overrides` to selector OR remove from backend | C-12+ |
| 2 | B-56 — no rule edit | Inline edit instead of delete+recreate | C-12+ |
| 3 | B-57 — Promise.all error blindness | Per-query error UI | C-12+ |
| 4 | B-58 — 5 unguarded animate-spin | motion-safe: | C-11 |
| 5 | B-59 — no overlap detection | Server + UI validation | C-12+ data hygiene |
| 6 | B-60 — 2 redesign-fake markers | Mark for redesign-finish pass | C-12+ |
| 7 | B-61 — no team isolation on global perm | Tenant/team check | C-12+ RBAC hardening |
| 8 | B-62 — BookingGuardModal a11y gaps | aria-modal + focus trap | C-11 |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes.
**Next surface:** #13 `/admin/staff/[staffId]/performance` (B-3 surface).

*End of staff-availability audit.*
