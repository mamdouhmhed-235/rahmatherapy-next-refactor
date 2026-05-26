# C-A.1 #10 — `/admin/staff` (list) audit

**Surface:** `/admin/staff` (Staff Management — filterable list + inactive disclosure)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `1dca165`.
**Operating discipline:** per master-plan Part 0.
**Source surveyed:** `page.tsx` (1106 LOC), `NewStaffForm.tsx`, `actions.ts`, `team-access.ts`, `profile-access.ts`. Subagent + Owner @ 1280 + 375.
**Screenshots:** 2 PNGs.

---

## 1 — Bugs found

### B-48 — Two more FAKE markers (`BUILD-staff-filter-query`, `BUILD-staff-workload-aggregates`)
**Severity:** medium (C-09 — server-side filtering + workload aggregation marked tech-debt)
**Source:** subagent `page.tsx:213, :312`. Both are explicit "server-side stub; filtering happens client-side" markers. Same pattern as #08 enquiries (also FAKE-tagged).
**Cross-reference:** the `// FAKE` grep across the codebase should be a deliverable of C-09 plan.

### B-49 — No pagination
**Severity:** low at current scale (12 staff)
**Source:** subagent — no `.limit()/.range()`. Will not bite for staff scale (clinics rarely have >50 staff).
**Decision:** lower priority than bookings / clients pagination work but track.

### B-50 — No delete affordance on list
**Severity:** low (`updateStaffProfile({ active: false })` deactivation is the design intent per actions.ts:292-294)
**Source:** subagent. Staff list has no delete; staff detail page (likely) has the deactivate toggle. Hard-delete is not a feature — staff records are audit-preserved.
**Decision:** consistent with bookings (immutable + status-only). Accept; C-06 should skip staff deletion.

### B-51 — Inline `[&::-webkit-details-marker]:hidden` for custom summary UI
**Severity:** very low (a11y — custom disclosure UI without testing across browsers)
**Source:** subagent `page.tsx:699, :1057`. Custom-styled `<details>` toggle. Acceptable but worth checking across Safari + Firefox + mobile browsers.

### B-52 — `animate-spin` in NewStaffForm.tsx:229 unguarded (consistent pattern)
**Severity:** low. Same anti-pattern.

### B-53 — `Onboarding total = 6` magic number duplicated across 4 lines
**Severity:** very low (DRY / maintainability)
**Source:** subagent `page.tsx:261, 269, 323, 1049`.

---

## 2 — Visual issues

### V-28 — Filter chips show counts: "10 Active / 6 Bookable / 9 No assignments / 4 Onboarding incomplete"
**Source:** verified live. ✅ Clean. Pill-as-filter pattern consistent with clients list.

### V-29 — 12 staff records: 11 are TEST/Phase10/Audit fixtures, 1 real ("Minhaj rahman")
**Source:** verified live h2 list. **Worst surface so far for production-DB hygiene** — only 1 of 12 staff records is real.

### V-30 — `data-redesign-backend="FAKE"` attributes on the row markup
**Source:** subagent `page.tsx:439, :515`. Used to flag the client-side filter path for future swap-in. Doesn't impact users but shows in inspect element.

---

## 3 — Empty / edge states

### E-24 — Inactive members render below an active section in a collapsible `<details>` disclosure
**Source:** subagent `page.tsx:695-726`. Smart UX — keeps active visible by default, inactive accessible on demand.

---

## 4 — Cross-role inconsistencies

### CR-19 — Three RBAC scopes for staff list: admin / assignment / same_gender_team
**Source:** subagent `team-access.ts:108-141`:
- **admin** (Owner/Admin): full list + contact + role + workload.
- **assignment** (Coordinator with assign permission): active bookable staff only, no contact fields.
- **same_gender_team** (Therapist): own profile + same-gender active bookable peers; "You" chip on self.

Audit didn't sweep all three live, but code-level narrowing is clear. ✅ Accept.

### CR-20 — Therapist's workload visibility hidden for peers, visible for self
**Source:** subagent `page.tsx:684`. Privacy-preserving design.

---

## 5 — Cross-viewport issues

### CV-23 — Workload section uses `lg:flex` row + `2x2 grid` at tablet
**Source:** subagent. Standard adaptive pattern.

### CV-24 — Mobile may wrap specialties/languages/service_areas awkwardly under 375px
**Source:** subagent observation. Did not deeply verify visually. Flag for C-12+ if specific clipping is reported.

---

## 6 — Console / network issues

### CN-23 — 0 errors / 0 warnings.

---

## 7 — Pre-existing items the audit accepts

### PE-32 — `staffLoadError` UI is a graceful retry alert
**Source:** subagent `page.tsx:621-638`. ✅ Accept.

### PE-33 — NewStaffForm copy mentions "@" + "same-gender booking matching" specifically — domain-aware
**Source:** subagent NewStaffForm.tsx:60, :66. ✅ Accept (domain-tight UX copy).

---

## 8 — Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-48 — 2 FAKE markers on staff query/aggregate | DB-side filter + aggregate | C-09 |
| 2 | V-29 — 11/12 staff are test rows | DB cleanup | C-12+ hygiene |
| 3 | B-52 — animate-spin unguarded | motion-safe: | C-11 |
| 4 | B-53 — onboarding total magic number | Single const | C-12+ |
| 5 | CV-24 — possible specialty-pill wrap clip <375 | Visual spot-check | C-12+ |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes.
**Next surface:** #11 `/admin/staff/[staffId]`.

*End of staff-list audit.*
