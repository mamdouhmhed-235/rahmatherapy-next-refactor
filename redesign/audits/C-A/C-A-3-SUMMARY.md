# C-A.3 — Role-day audit summary (end-of-phase consolidation)

**Status:** ✅ COMPLETE — all 5 role-days audited
**Date completed:** 2026-05-25
**Branch:** `redesign/start-state` HEAD `ac96fe4`
**Commits in C-A.3:** 5 (R01 → R05 sequentially) — from `23510e0` (R01) through `ac96fe4` (R05)
**Total commits ahead of master at C-A.3 close:** 252

**What this doc is:** the single-source-of-truth handoff between C-A.3 (role-day audit) and what comes next (C-B plan-writing). Read this alongside `C-A-1-SUMMARY.md` + `C-A-2-SUMMARY.md` before opening C-B planning files.

---

## 1 — Per-role index

| # | Role | File | New bugs | Headline insight |
|---|---|---|---|---|
| R01 | Owner | `R01-owner-day.md` | B-154..B-157 (4) | Each surface works; Owner's SEQUENCE has too many "where do I go next?" decisions. No "Yesterday" chip; dual date controls; no return-to-list post-convert. → C-07 routing. |
| R02 | Admin (Practice-Manager) | `R02-admin-day.md` | B-158..B-160 (3) | **Privacy "Completed" UI lie has role-trust dimension** — Admin processing SARs in good faith. Regulatory exposure. → Tier-A C-PRIVACY-FULFILMENT (B-158). |
| R03 | Coordinator | `R03-coordinator-day.md` | B-161..B-163 (3) | Coord's workflow PRIMITIVES (saved filters, return-to-list, batch processing) are weak. → C-07 routing. |
| R04 | Therapist | `R04-therapist-day.md` | B-164..B-169 (6) | Admin is mobile-FRIENDLY but not mobile-FIELD-OPTIMISED. Critical mobile info (client phone, address) buried; no "Open in maps"; no "next visit" widget. **Therapist Field Experience mini-plan recommended.** |
| R05 | Therapist-Fresh | `R05-therapist-fresh-day.md` | B-170..B-173 (4) | **`TherapistDashboard.tsx` is the STRONGEST empty-state surface in the admin** — narrative, empathy, "Need help?" onboarding ladder, time-of-day greeting. Reference template for C-11. |

**Total: 20 new bugs (B-154 → B-173). Bug index continuous: B-01 → B-173.**

---

## 2 — Whole-system synergy themes (cross-role)

C-A.1 was per-surface. C-A.2 was per-workflow. C-A.3 surfaces ROLE-LEVEL patterns:

### Theme 1 — "Where do I go next?" friction is universal
Every role's day has too many decisions about WHERE to navigate next. Examples:
- Owner: dashboard → bookings → enquiries → reports → refund — 4-5 manual navigation hops
- Coord: dashboard → bookings → enquiries → operations → bookings (return) — re-applying filters each time
- Therapist: /admin/me → /admin/bookings → /admin/bookings/[id] → back-button OR re-nav
- Admin: bookings → staff → audit → emails → privacy (if granted) — heavy cross-page rhythm

**Each role's nav is well-scoped** (Therapist has 3 items, Owner has 5+) but the WITHIN-role navigation is rough. **C-07 routing plan is the natural home** — single biggest UX win for Band C.

### Theme 2 — Default views don't match role intent
| Role | Default lands on | Role wants | Source |
|---|---|---|---|
| Owner | dashboard with 3 urgency reps | "What's changed since yesterday?" | R01 + R01-V-1 |
| Admin | same as Owner | "What needs MY attention" | R02 |
| Coord | bookings list "Attention" tab | "Unassigned matching my filter" | R03 |
| Therapist | bookings list "Attention" tab | "My next visit" | R04 B-167 |
| Therapist-Fresh | TherapistDashboard variant | "Finish my profile" | R05 ✅ already correct |

**Therapist-Fresh dashboard is the ONLY role with role-appropriate default landing.** Lift the pattern (per-role variant + role-appropriate default) to all roles. → C-11 / C-12+.

### Theme 3 — Empty-state copy varies wildly
- Therapist-Fresh: "Quiet day. Take care of yourself." ✅ Narrative + empathetic.
- /admin/me Recent Activity (other roles): "No recent activity." Terse.
- /admin/reports zero-state: standard "No data" patterns.
- /admin/audit empty: defaults to recent loaded set; truly-empty unclear.
- Owner dashboard: stats show "0" without copy.

**R05-PE-1 lifts the TherapistDashboard pattern** as the empty-state template. → C-11.

### Theme 4 — Onboarding patterns are role-specific but absent for most roles
- Therapist-Fresh has the "Need help?" section ✅.
- Owner / Admin / Coord first-login: NO onboarding affordances. They land in the same full-content dashboard.

**R05-PE-2** lifts "Need help?" as the onboarding-section template across roles. **First-login affordance** could trigger off `staff_profiles.created_at` (e.g., < 7 days = show extra help). → C-12+.

### Theme 5 — Mobile / field-context optimization is Therapist-specific
- Owner / Admin / Coord work primarily from desktop (per master plan + scope clarification 1).
- Therapist works in client homes on mobile.
- Yet many critical mobile patterns are missing for Therapist: client phone hard to reach (B-164), no "Open in maps" (B-166), no session-note draft persistence (B-169).

**A separate "Therapist Field Experience" mini-plan** is the recommended bundle for B-164/165/166/167/169 + W05 B-127 + the "Therapist Field Experience" theme. → could be a C-12+ category OR a separate dedicated plan.

---

## 3 — Updated re-framing of the 11 user items (post-C-A.3 — final)

Building on C-A-1-SUMMARY §2 + C-A-2-SUMMARY §2:

### C-01 — Google Business review email
**Status:** unchanged from C-A-2-SUMMARY (greenfield; W03 §11 architecture).

### C-02 — Recurring / standing bookings
**Status:** unchanged from C-A-2-SUMMARY (greenfield; W07 §10 architecture).

### C-03 — Enquiry → booking conversion
**Status:** unchanged from C-A-2-SUMMARY (narrow scope + 4 cross-page bugs + R01 B-157 return-to-list).

### C-04 — Cancellation restore + refund (paired)
**Status:** scope confirmed from W04 + W09. R04 B-168 adds the assignment-vs-booking auto-promote consideration.

### C-05 — Cancelled bookings can't be assigned/claimed
**Status:** unchanged from C-A-2-SUMMARY (6 edit points, master-plan vantage inversion). R05 B-171 adds a related temporal-guard concern for past-dated claimable bookings.

### C-06 — Delete + bulk delete + dedup
**Status:** unchanged from C-A-2-SUMMARY (W06 §10 architecture).

### C-07 — Cross-page routing improvements
**Scope GROWS SIGNIFICANTLY with C-A.3 findings:**
- R01 B-154: no Yesterday chip
- R01 B-155: dual date controls confusable
- R01 B-157: no return-to-enquiries post-Convert
- R03 B-161: no saved-filter / pinned-filter pattern
- R04 B-167: per-role default bookings tab
- R05 B-170: cross-surface "Open to claim" mismatch

**C-07 becomes the headline routing+navigation plan with ~10+ specific items.** Recommend splitting into C-07a (routing primitives) + C-07b (per-role defaults).

### C-08 — Email templates + automation
**Status:** unchanged from C-A-2-SUMMARY (~7+ missing event types).

### C-09 — Pagination + scale-aware design
**Status:** unchanged from C-A-2-SUMMARY (cache-invalidation gap + unbounded lists).

### C-10 — Bottom-of-page spacing
**Status:** unchanged.

### C-11 — Dark mode default + toggle
**Scope EXPANDS with C-A.3 pattern templates:**
- Lift TherapistDashboard empty-state pattern (R05-PE-1)
- Lift "Need help?" sectional pattern (R05-PE-2)
- Lift time-of-day greeting (R05-PE-3)
- Apply across all role-dashboards

**C-11 grows from "dark mode pass" to "dark mode + design-system + per-role dashboards pass". Major.**

---

## 4 — Updated open questions for the user (final, blocking C-B)

C-A.1 had 6. C-A.2 added 3 = 9. C-A.3 adds 2 more:

10. **NEW: "Therapist Field Experience" sub-plan inside Band C?** — bundle B-164/165/166/167/169 + W05 B-127 into a separate Therapist UX plan, or fold into C-12+? Recommended: **dedicated plan** because Therapist's experience is structurally different (mobile fieldwork) and warrants focused design.

11. **NEW: Per-role dashboard variants?** — currently TherapistDashboard.tsx is the only role-specific variant. Should Owner / Admin / Coord get their own dashboard variants too, OR continue with one universal dashboard + conditional rendering? Recommended: **per-role variants** following the TherapistDashboard pattern.

---

## 5 — Bug index (continuous from C-A.1 + C-A.2 + C-A.3 = B-01 → B-173)

- C-A.1: B-01..B-103 (103 bugs across 25 surfaces).
- C-A.2: B-104..B-153 (50 bugs across 10 workflows).
- C-A.3: B-154..B-173 (20 bugs across 5 role-days).

**Total bug index: 173 bugs catalogued in C-A.**

P0 / HIGH severity items (unchanged from C-A.2 except role-trust addition):
- B-87/88/89 — privacy GDPR fulfilment (P0 regulatory)
- **B-158 (R02) — Admin role-trust dimension on privacy "Completed" badge** (HIGH regulatory)
- B-110 + B-131 — destructive client overwrite (HIGH data integrity)
- B-148 — reports overstate revenue when refunded (HIGH reporting accuracy)
- B-149 — settings cache invalidation gap (HIGH cross-page integrity)
- B-164 (R04) — mobile sidebar order hides critical info for Therapist (HIGH for Therapist workflow)

---

## 6 — Pattern templates surfaced in C-A.3 (additions to C-A.1 §3 + C-A.2 §3)

| Pattern | Source | Use for |
|---|---|---|
| Empty-state with narrative + empathy + next-action | R05 TherapistDashboard | All zero-states across admin → C-11 |
| "Need help?" onboarding section | R05 TherapistDashboard | All first-login / role-specific guidance → C-11/C-12+ |
| Time-of-day greeting | R05 TherapistDashboard | All role-dashboards → C-12+ trivial |
| Per-role dashboard variant | R05 TherapistDashboard | Owner/Admin/Coord variants → C-11 / C-NEW |
| Mobile-gesture tip ("Pull down to refresh") | R05 TherapistDashboard | Role-specific (mobile-heavy roles) → accept as-is |

---

## 7 — Recommended next move

C-A is now COMPLETE: 3 phases, 40 audit files (25 surfaces + 10 workflows + 5 role-days), 173 bugs, ~15 architecture deliverables across the §10/§11 sections.

**Next phase per master plan:** **C-B plan-writing**. C-A discovery is done. C-B converts findings into briefs + plans + progress files (Band B format).

**Alternative paths:**
- **Privacy GDPR sprint as Tier-A immediately** — B-87/88/89 + B-158 (Admin role-trust angle) is P0 regulatory. The user's call.
- **Test-data cleanup** — independent, ~30 min scripted DELETE. Recommended low-effort win before C-B.
- **User clarification on the 11 open questions** (per §4) before C-B plan-writing.

**Master plan's recommended sequence:** C-A → C-B → C-C. We're now ready for C-B. **The user's call on whether to do Privacy + test-data cleanup first.**

---

## 8 — Cross-page architecture deliverables (lift directly into C-B)

Consolidated from C-A.2 §8 + C-A.3 additions:

C-A.2 surfaces:
- W01 §11 — C-03 narrow scope
- W02 §1+§2 — manual-booking entry-point catalogue + cache-invalidation map
- W03 §11 — C-01 architecture
- W04 §1+§10 — C-04 restore-button-and-email shape
- W05 §10 — C-05 6-edit-point list + `ensureBookingActive` helper
- W06 §10 — C-06 architecture (destructive-overwrite fix)
- W07 §10 — C-02 complete architecture
- W08 §1 — scope-control inventory
- W09 §10 — C-04 paired refund workflow
- W10 §10 — C-09 cache-invalidation approach options

C-A.3 additions:
- R03 — saved-filter pattern recommendation
- R04 — "Therapist Field Experience" plan recommendation (bundle B-164/165/166/167/169)
- R05 — empty-state pattern template (lift TherapistDashboard pattern across admin)

---

*End of C-A.3 programme summary. **C-A COMPLETE.** Ready for C-B plan-writing pending user direction on open questions + Tier-A privacy decision.*
