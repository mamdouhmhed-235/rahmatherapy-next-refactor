# C-A.1 #15 — `/admin/availability` (global) audit

**Surface:** `/admin/availability` (global working hours / closed dates / hour adjustments + capacity overview)
**Audit type:** C-A.1 discovery (no fixes)
**Date:** 2026-05-25
**Pre-state:** branch `redesign/start-state` HEAD `42ad3b7`.
**Source:** `page.tsx` (635 LOC) + AvailabilityManagersTabs / AvailabilityRulesManager / BlockedDatesManager / AvailabilityOverridesManager / actions.ts / error.tsx. Subagent + Owner @ 1280 + 375.
**Screenshots:** 2 PNGs.

---

## 1 — Bugs found

### B-67 — No "N staff affected" hint when changing global rules
**Severity:** medium (operational risk — owner can change global hours without seeing the scope)
**Source:** subagent — no real-time count of staff with `availability_mode === "inherit"` shown during edit. Master-plan Part 1 readiness expectation specifically called this out as something to verify.
**Implication:** Owner clicking "Save" on Monday hours has no idea whether 0 or 8 staff inherit them.

### B-68 — No unsaved-changes warning / dirty-state guard
**Severity:** low-medium (UX risk)
**Source:** subagent — form state is lost if user navigates away. No `beforeunload` handler. Per master-plan Part 1 readiness expectation.

### B-69 — Three more unguarded `animate-spin` instances
**Severity:** low
**Source:** subagent `AvailabilityRulesManager.tsx:201`, `BlockedDatesManager.tsx:283`, `AvailabilityOverridesManager.tsx:283`. Inconsistent — line 336 of AvailabilityRulesManager DOES respect `motion-reduce:transition-none` for transitions but ignores it for spins.

### B-70 — No overlap detection (same as #12 B-59)
**Severity:** low-medium
**Source:** subagent. Global surface inherits this gap from per-staff surface.

### B-71 — No edit-in-place for weekly rules (same as #12 B-56)
**Severity:** medium
**Source:** subagent. Delete + recreate only.

### B-72 — `availability_mode === "custom"` staff are flagged with badges but NOT during real-time edits
**Severity:** low (information freshness)
**Source:** subagent `page.tsx:498-502`. Custom-schedule staff badges render on initial load but don't update after a global rule save. Worth a refresh prompt.

### B-73 — `BaseDialog.Backdrop` lacks `inert` on sibling content
**Severity:** low (a11y)
**Source:** subagent. Screen readers may still traverse background DOM when modal open.

---

## 2 — Visual issues

### V-41 — "This week's capacity" overview lists ALL staff at top
**Source:** verified live. 12 staff names visible (11 test + 1 real). Good signal-at-a-glance but also amplifies V-29's test-data-on-prod issue from #10.

### V-42 — Sections: Working hours / Closed dates / Hour adjustments
**Source:** verified. ✅ Clean IA. Less confusing than per-staff (no mode selector here).

---

## 3 — Empty / edge states

### E-31 — Mobile collapses tabs to button group (`AvailabilityManagersTabs:68 md:hidden`)
**Source:** subagent. Adapts well.

---

## 4 — Cross-role inconsistencies

### CR-27 — Global edit requires `PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL`
**Source:** subagent `page.tsx:115`. ✅ Tight gate.
**Note:** B-61 from #12 (no team isolation) applies here too — a global avail admin can edit even if they shouldn't own clinic-wide changes.

---

## 5 — Cross-viewport issues

### CV-30 — Mobile weekly rules row may render unclear (subagent line 310)
**Source:** subagent — `sm:grid-cols-[9rem_minmax(0,28rem)_1fr]` collapses on mobile but the "Opens / Closes" label semantics may be ambiguous without icon hints. Visual spot-check at C-12+ polish.

---

## 6 — Console / network issues

### CN-28 — 0 errors / 0 warnings.

---

## 7 — Pre-existing items the audit accepts

### PE-43 — Tab set has roving tabindex + arrow-key keyboard navigation
**Source:** subagent `AvailabilityManagersTabs:40-62`. ✅ Best tab a11y observed.

### PE-44 — `requireGlobalAvailabilityManager()` server gate consistent across all actions
**Source:** subagent `actions.ts:18`. ✅ Accept.

---

## 8 — Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-67 — no affected-staff count | Show "N staff inherit" hint per rule edit | C-12+ ops UX |
| 2 | B-68 — no unsaved-changes guard | beforeunload + visual dirty indicator | C-12+ |
| 3 | B-69 — 3 unguarded animate-spin | motion-safe: | C-11 |
| 4 | B-71 — no edit-in-place (matches #12) | Inline edit pattern | C-12+ |
| 5 | B-72 — custom-mode badges don't refresh | router.refresh on save | C-12+ |
| 6 | B-73 — BaseDialog inert siblings | a11y polish | C-11 |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes.
**Next surface:** #16 `/admin/services`.

*End of availability-global audit.*
