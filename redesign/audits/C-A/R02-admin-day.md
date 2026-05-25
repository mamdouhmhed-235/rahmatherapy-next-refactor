# C-A.3 R02 — Admin (Practice-Manager) day audit

**Audit type:** C-A.3 role-day discovery (no fixes)
**Role:** Admin (`test.admin@rahmatherapy.example.test`)
**Day walked:** Practice-Manager workflow — bookings + staff + reports + emails
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `23510e0`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** R01 (Owner day shares most patterns), C-A.1 #10/#11/#12 (staff), #15 (availability global), #17 (settings), #19 (emails), #22 (privacy).
**Roles swept:** Admin scope inferred from RBAC predicates + code analysis; live walk skipped (predicate-equivalent to Owner on most surfaces; the narrative is identical except for the narrowing noted).

---

## 1 — Admin's day vs Owner's day — the deltas

| Surface | Owner | Admin | Delta |
|---|---|---|---|
| Dashboard | Personal Stripe + Snapshot + Attention + Operations | Same (Admin is bookable per scope clarification 2) | None |
| `/admin/bookings` | full access | full access (canManageAllBookings) | None |
| `/admin/clients` | full access | full access (canManageClients) | None |
| `/admin/enquiries` | full access | full access (canManageEnquiries) | None |
| `/admin/staff` | full access + can manage roles | full access (canManageStaff) but **likely cannot manage role-permission assignments** (need to verify per #21 audit) | minor narrowing |
| `/admin/staff/[id]/availability` | full | full | None |
| `/admin/availability` (global) | full | full | None |
| `/admin/services` | full | full | None |
| `/admin/settings` | full | full | None |
| `/admin/operations` | full | full | None |
| `/admin/emails` | full | full | None |
| `/admin/roles` | **Owner-only by design** (high-trust surface) | likely view-only or no access | narrowing TBD |
| `/admin/privacy` | full (`canManagePrivacyOperations` permission) | full IF granted (per `hasPermission` predicate at page.tsx:207) | depends on role-permission grants |
| `/admin/audit` | full | likely viewer (depends on permission) | TBD |
| `/admin/account-password-requests` | full | full | None |
| `/admin/reports` | full + PersonalTeamToggle | full + toggle | None |

**Net:** Admin's day is **structurally identical to Owner's day** for the practice-manager core (bookings + staff + reports + emails). The narrowing happens at the high-trust edges (roles, privacy, audit).

---

## 2 — Admin's day walk (narrative)

### Morning dashboard check
Same as R01 — 3 overlapping urgency reps, no quick-add CTAs, dual date controls, no Yesterday preset. **All R01 friction findings apply to Admin** (B-154..B-157).

### Bookings management (Admin's primary)
Same as Owner per RBAC predicate. **Admin spends more time here than Owner does** — Admin is the practice manager; bookings is their primary domain. Patterns:
- Assign therapists (same `updateBookingAssignment` server action — full eligibility check per W05).
- Reassign on therapist-out cases (W05 B-127: removed therapist gets no email — Admin is the one who notices this gap most often).
- Quick cancel + Status form (W04 B-120: restore doesn't email client — Admin is the one who restores, observing this gap).

### Staff management
Admin opens `/admin/staff` to handle:
- Workload imbalance (looks at #10 list per #10 audit findings).
- Per-staff edits via `/admin/staff/[id]` (#11 — clean surface; reference template).
- Availability tweaks via `/admin/staff/[id]/availability` (#12 — has FAKE markers + missing third mode per W07 B-138).

**Admin-specific friction:**
- Per #10 V-29 + master-plan Part 3 hygiene: 11/12 staff are test rows. Admin's staff list view is dominated by test data. Real production hygiene blocker.
- Per W05 B-128: assignment changes don't invalidate /admin/staff cache → Admin who just reassigned a booking opens staff list to verify workload → still stale. **Same friction as Owner but Admin notices it MORE often.**

### Reports review
Same as Owner. W08 W08-V-1 terminology inconsistency, W08 B-142 scope-doesn't-persist apply.

### Emails
Admin reviews `/admin/emails` (per #19). Sees:
- 7 active event types in production.
- C-08 missing 3+ types (per #19 B-83 + W03/W04/W05 expansions → ~7+ missing).
- Per-row Resend missing on delivery log (#19 B-84).

**Admin-specific friction:** Admin is more likely than Owner to TROUBLESHOOT failed deliveries (forwarding bounce reports, checking specific clients). The "no Resend" gap (B-18 + B-84) bites Admin harder.

### Privacy (if granted)
If Admin has `canManagePrivacyOperations` permission → can triage requests but the FULFILMENT is broken (B-87/88/89 P0 — privacy is a UI lie). **Admin attempting to handle a SAR or deletion request:**
- Triages request → marks Completed.
- **No actual export happens; no actual delete happens** (per #22 audit headline).
- Admin's "Completed" badge is a lie they're complicit in (without realising it).
- **For Admin specifically:** if they're not Owner, they may NOT be aware that the system isn't fulfilling under the hood — they trust the UI. **Real legal-exposure risk** if Admin (acting in good faith) marks SARs complete.

### Audit log review
Admin opens `/admin/audit` periodically (per #24). Cursor pagination works. Per W04 B-123: customer-side cancellations have NO audit-log rows. So Admin's view of "what happened" is INCOMPLETE — customer cancellations are invisible in the audit log.

---

## 3 — Admin-day-specific findings

### B-158 — Admin trusting the Privacy "Completed" badge could fulfil SARs in name only — legal exposure
**Severity:** HIGH (regulatory + role-trust)
**Source:** R02 + cross-reference #22 B-87/88/89. The privacy surface looks well-designed (it triages); but completion ≠ fulfilment. Admin (who may not be the same person who reviews the underlying code) acts in good faith on the UI; the result is unenforceable compliance.
**Why R02 (not #22):** the per-page audit caught the technical gap; R02 surfaces the **role-trust dimension** — Admin specifically is the role that operationally handles SARs/deletes in a clinic this size. Owner may delegate; Admin may execute.
**Decision:** **MUST be addressed before any Admin user starts processing privacy requests.** Either:
- (a) Block Admin from "Completed" until back-end fulfilment is real.
- (b) Add a banner: "⚠️ Privacy fulfilment is currently NOT IMPLEMENTED. Mark Completed only after MANUAL data export + deletion via the DB. Document the manual steps in the audit log."
- (c) Implement actual fulfilment (the full C-PRIVACY-FULFILMENT plan).
**Master plan recommends (c) as Tier-A. Until then, (b) is a stopgap.**

### B-159 — Admin's view of "what happened" is missing customer-side cancellations
**Severity:** medium (forensic gap with role-trust implication)
**Source:** W04 B-123 — customer cancellation has no audit_log row. Admin reviewing /admin/audit sees admin-side cancellations + everything else, but customers' self-cancellations are invisible.
**Why R02:** Admin is the role that uses /admin/audit MOST OFTEN for diagnostic ("why was this cancelled?"). The missing rows make their job harder.
**Decision:** same as W04 B-123. Fold into C-12+ forensic.

### B-160 — Admin's staff list dominated by test-data
**Severity:** low (hygiene) — but compounds Admin's daily friction
**Source:** #10 V-29 confirms 11/12 staff are test rows. Admin's MAIN staff-management view is unusable as a production daily tool.
**Decision:** test-data cleanup pass (master plan Part 3 carry; recommended in C-A-1-SUMMARY §8 as an independent low-effort task).

---

## 4 — Cross-references

Most Admin-day findings are inherited from R01 + previous audits. The novel R02 contributions:
- **B-158** — role-trust angle on privacy fulfilment gap (regulatory).
- **B-159** — audit log completeness gap (Admin's primary diagnostic tool).
- **B-160** — daily friction from test-data hygiene.

All R01 bugs (B-154..B-157) apply equally to Admin.

---

## 5 — Items for plans

| # | Finding | Best home |
|---|---|---|
| 1 | B-158 — Privacy "Completed" without fulfilment | **C-PRIVACY-FULFILMENT** (Tier-A) OR stopgap warning |
| 2 | B-159 — customer cancellation invisible to audit log | C-12+ forensic |
| 3 | B-160 — staff list test data | test-data-cleanup pass |
| (others) | All R01 bugs apply | as per R01 |

---

## 6 — Hand-off

**State:** 0 screenshots (narrative derived from RBAC predicates + cross-reference). 0 code changes. 0 prod DB writes. 3 new bugs (B-158 → B-160).

**R02 summary insight:** Admin's day is **R01 minus role-permission management plus more time in bookings + staff + audit + emails**. The novel R02 finding is the **role-trust dimension on Privacy fulfilment (B-158)** — Admin acting in good faith on a UI that lies. Regulatory exposure.

**Next:** R03 Coordinator day.

**Bug index advance:** B-157 → B-160. Next available: B-161.

*End of R02 admin-day audit.*
