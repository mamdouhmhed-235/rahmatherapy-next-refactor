# C-A.1 #11 — `/admin/staff/[staffId]` audit

**Surface:** `/admin/staff/[staffId]` (staff profile detail — identity, role, permissions, profile completion, onboarding, assignment context, shortcuts to availability + performance)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `5a55390`.
**Operating discipline:** per master-plan Part 0.
**Source surveyed:** `page.tsx` (1115 LOC), `StaffProfileForm.tsx`, `RolePermissionsPanel.tsx`, `StaffPermissionOverridesForm.tsx`, `StaffDetailShortcuts.tsx`, `error.tsx`. Explore subagent + Owner @ 1280 + 375 on `Test Therapist` (id `884311b1-…`).
**Screenshots:** 2 PNGs.

---

## 1 — Bugs found

### B-54 — No findings of consequence
**Audit summary:** this is the cleanest surface audited so far. Subagent reports:
- **Zero** TODO / FIXME / XXX / HACK / FAKE markers
- **Zero** unguarded `animate-spin` (all transitions use `motion-reduce:transition-none`)
- **Zero** `border-l-4` violations
- Strong `aria-label / role / aria-live / aria-busy` accessibility
- RBAC narrowing complete: assignment + same_gender_team scopes correctly limited; isOwnProfile path lets a Therapist see their own page

**Suspected reason:** this surface was touched extensively in B-3 (Performance shortcuts) and B-6 (LTV ribbon adjacent work). The B-team discipline carried through.

---

## 2 — Visual issues

### V-31 — Sections enumerated: Profile / Identity & contact / Profile details / Account & role / Assigned bookings / Identity / Profile completion / Onboarding / Role and permissions / Permission overrides
**Source:** verified live. Note "Identity" appears twice in the section list — once for the header summary and once for the inner Identity block. Visually fine but consider renaming the second to avoid header duplication.

### V-32 — docH = 9900px (very long page)
**Source:** verified live. Reasonable given the breadth of sections + permission matrix. Could fold into accordion at C-12+ polish if user finds it overwhelming.

### V-33 — Two "Active" status chips appear in the role-chip query
**Source:** DOM eval found `["Active", "Active", "Therapist"]`. The duplication is likely a meta-chip near the header + a switch label. Worth confirming during C-B planning but not a bug.

---

## 3 — Empty / edge states

### E-25 — Profile completeness checker tracks 5 fields (phone / short_bio / specialties / languages / service_areas)
**Source:** subagent `page.tsx:355-365`. "Add →" links to direct edit. ✅ Good onboarding UX.

### E-26 — Inactive banner above tab strip when account is deactivated
**Source:** subagent `page.tsx:549-556`. ✅ Clear visual state.

---

## 4 — Cross-role inconsistencies

### CR-21 — `isOwnProfile` exception: a Therapist can visit their OWN profile but not peers'
**Source:** subagent `page.tsx:167, 171, 199, 240-243`. Brief §11 exception that lets a Therapist see full client workload context on own page even when canViewClientWorkloadContext=false. ✅ Thoughtful narrowing.

### CR-22 — Out-of-scope queries narrow to active + bookable
**Source:** subagent `page.tsx:204-212`. `assignment` and `same_gender_team` scopes auto-filter `active=true, can_take_bookings=true`.

---

## 5 — Cross-viewport issues

### CV-25 — Sticky save bar `sm:hidden` (mobile-only) with Discard + Save (flex-1/flex-2)
**Source:** subagent `StaffProfileForm.tsx:357-410`. ✅ Best mobile-form pattern observed in the audit.

### CV-26 — Two-column above xl, single below; right rail sticky only above xl
**Source:** subagent `page.tsx:590, :731`. ✅ Clean.

---

## 6 — Console / network issues

### CN-24 — 0 errors / 0 warnings.

---

## 7 — Pre-existing items the audit accepts

### PE-34 — Permission-overrides UX has risk-tier matrix (critical = always confirm; high = confirm on grant only; medium/low = one-click)
**Source:** subagent `StaffPermissionOverridesForm.tsx:289-295`. ✅ Best permission-change UX observed.

### PE-35 — Role assignment is single-select (one role per staff)
**Source:** subagent `StaffProfileForm.tsx:452-480`. Radio group, not checkboxes. ✅ Per business rule.

### PE-36 — Inline help blocks ("Each role grants a fixed bundle…")
**Source:** subagent `page.tsx:880-886`. Inline explainers throughout — reduces support burden.

### PE-37 — `StaffDetailShortcuts.tsx` has keyboard shortcuts (kbd hints in code)
**Source:** subagent. Power-user keyboard nav. ✅ Accept.

---

## 8 — Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | V-31 — "Identity" used twice in section labels | Rename inner to "Identity details" or merge | C-12+ |
| 2 | V-32 — 9900px docH | Optional accordion / progressive-disclosure pass | C-12+ |
| — | This surface is **the reference** for: RBAC narrowing, motion-reduce discipline, mobile sticky save bar, permission UX | Use as template for refactoring other surfaces | (lessons) |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes. Cleanest surface audited; few real bugs.
**Next surface:** #12 `/admin/staff/[staffId]/availability` (299 LOC per master plan).

*End of staff-detail audit.*
