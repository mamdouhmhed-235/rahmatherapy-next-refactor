# C-A.2 W08 — Owner switching scope (personal vs team) flow audit

**Workflow:** Owner (who takes bookings — scope clarification 1 per master plan) navigates between Dashboard / `/admin/me` / `/admin/reports` and expects coherent scope semantics. Each surface has a different scope-control UX. Tests cross-page consistency.
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `aaa3c2f`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #01 (dashboard Personal Stripe), #13 (`staff/[id]/performance` self-redirect to /me), #14 (`/admin/me`), #25 (reports + PersonalTeamToggle), scope clarification 1 (master plan).
**Source surveyed:**
- Reports toggle: `src/app/admin/reports/PersonalTeamToggle.tsx` (full).
- Dashboard Personal Stripe: `src/app/admin/dashboard/dashboard-helpers-b5.ts` (referenced; per #01 audit context).
- `/admin/me`: `src/app/admin/me/page.tsx` (single cross-link to reports at line 46).
- `/admin/staff/[id]/performance`: self-redirect to /admin/me when viewing own (per #13).
**Roles swept:** Owner. Therapist behavior accepted from per-page audits (auto-Personal).

---

## 1 — Cross-page scope-control inventory

| Surface | Default scope | Toggle UI? | URL param | Notes |
|---|---|---|---|---|
| `/admin/dashboard` | "Personal Stripe always shown alongside Business" | **NO toggle** | none | Per #01 — when Owner has zero bookings, stripe shows all-zeros (correct per scope clarification 1). |
| `/admin/me` | Implicit Personal | NO toggle | none | One-way link to `?staffId=<id>&scope=personal` at line 46. |
| `/admin/staff/[id]/performance` | Per-staff scope (admin viewing a specific therapist) | NO toggle | `/admin/me` self-redirect if id == viewer | Therapist can ONLY view own. Admin/Owner can view any. |
| `/admin/reports` | Default Team (no `?scope=` = team) | **YES — PersonalTeamToggle.tsx** | `?scope=personal&staffId=<id>` | Visible to Owner/Admin/Coord; hidden for Therapist (auto-Personal). |

**The scope-control UX is INCONSISTENT.** Reports has an explicit toggle. Dashboard treats Personal as a permanent strip (no switch). /admin/me has no toggle (it IS the personal view).

---

## 2 — Bugs found

### B-139 — Dashboard has no "view team" affordance — Owner is forced through Reports to see team-wide metrics
**Severity:** medium (workflow friction — Owner's mental model is "I want to see what my team is doing today" → they expect a toggle on the dashboard, not a separate Reports navigation)
**Source:** dashboard renders Personal Stripe (when Owner is bookable) + Business tile (which is team-aggregate). There's no "Switch to team-only view" or "Hide personal" toggle. To compare team-vs-personal trends, Owner must navigate to /admin/reports + click Team/Personal toggle.
**Implication:** scope-control is forked between two surfaces. Dashboard shows both at once (no switching). Reports allows true scope choice.
**Decision:** add a header-level scope segmented control on the dashboard (Team / Personal / Both) that controls what mainly renders below. **Could be a Band C addition or fold into C-11 design-system pass.** Pair with #01 dashboard quick-add gap as the broader "dashboard surface needs a more capable header" finding.

### B-140 — `/admin/me` link to `/admin/reports?staffId=<id>&scope=personal` is the ONLY cross-link from /me to Reports
**Severity:** low (asymmetry — there's no "View team data" / "Browse all reports" link)
**Source:** `me/page.tsx:46` is the only cross-link. After viewing personal performance, the user has to use the global nav to reach team-wide reports.
**Decision:** add a "View team-wide reports" link adjacent to the personal-reports link. C-07.

### B-141 — Reports default Team view doesn't show Owner-as-team-member separately
**Severity:** low-medium (data semantics — Owner who takes bookings is hidden in team aggregate)
**Source:** Reports Team view aggregates ALL bookings including Owner's. There's no "Team excluding owner" breakdown or "Owner contribution" callout in the Team view. Compare with #01 dashboard which has the Personal Stripe specifically for the Owner. Reports doesn't have an equivalent "Personal" line on the team view.
**Implication:** Owner can't easily see "how does my contribution compare to the team's?" in Reports. They have to mentally subtract Personal's metrics from Team's. Pairs with scope clarification 1.
**Decision:** add a "Personal contribution" line / breakdown in Reports Team view. Or surface a third "Comparison" view. C-07 or C-12+ analytics polish.

### B-142 — Scope param doesn't persist across navigation
**Severity:** low (mild UX friction — admin sets Personal in Reports, navigates to /admin/me, navigates back to Reports → defaults to Team again)
**Source:** scope is URL-param-driven. No localStorage / cookie preservation. Each surface defaults independently.
**Implication:** Owner who prefers Personal-mostly has to re-toggle on every Reports visit.
**Decision:** persist last-used scope in localStorage OR in a server-side user preference column. C-12+ persistence pass.

---

## 3 — Visual issues

### W08-V-1 — Inconsistent terminology: "Personal Stripe" (Band B copy) vs "Personal" (Reports toggle)
**Source:** Dashboard speaks of "Personal Contribution" (per #01). Reports toggle is "Personal". /admin/me is unlabeled (just IS the personal view). Three different labels for the same concept.
**Decision:** unify on "Personal" or "My" or "Mine" — pick one. Apply consistently. C-07 or C-12+ copy pass.

### W08-V-2 — Owner who has ZERO personal bookings sees all-zero Personal Stripe with no "Why am I seeing this?" explainer
**Source:** per #01 — Personal Stripe shows all-zeros when Owner hasn't taken bookings recently. Correct per scope clarification 1 ("Owner takes bookings — but their period may be empty"). But the dashboard offers no contextual hint like "You haven't taken any bookings this week — this is normal if you're in admin-only mode."
**Decision:** ambient explainer when all-zero personal across all periods. C-12+ copy.

---

## 4 — Empty / edge states

### W08-E-1 — Therapist sees /admin/reports with the scope-toggle HIDDEN (auto-Personal)
**Source:** PersonalTeamToggle.tsx:34-35 — `if (!visible) return null;`. Therapist permission setting passes `visible=false`. ✅ Correct narrowing.

### W08-E-2 — Owner sees scope-toggle VISIBLE in Reports
**Source:** same component. ✅ Accept.

### W08-E-3 — Inactive Owner — no longer takes bookings — Personal Stripe still renders for them (uses active=true filter — actually need to verify)
**Source:** scope clarification 1 says "Owner takes bookings too". An Owner who toggles their own active=false would presumably no longer take bookings. Does the Personal Stripe disappear? Out of W08 scope; flag for #01 follow-up.

---

## 5 — Cross-role inconsistencies

### W08-CR-1 — Therapist: auto-Personal, no toggle, can only see own data
**Source:** layered RBAC. ✅ Correct.

### W08-CR-2 — Coord: same as Therapist on /admin/me (their own scope) + sees PersonalTeamToggle in Reports
**Source:** standard. ✅ Accept.

### W08-CR-3 — Admin: same as Coord in Reports + can view any staff's performance page
**Source:** `canViewAllStaff` predicate broader. ✅ Accept.

### W08-CR-4 — Owner: same as Admin + Personal Stripe shows on Dashboard
**Source:** Personal Stripe visibility predicated on Owner+takes-bookings flag. ✅ Accept.

---

## 6 — Cross-viewport issues

No new mobile-level findings beyond #01/#14/#25 baselines.

---

## 7 — Console / network issues

### W08-CN-1 — 0 errors / 0 warnings
Read-only walk.

---

## 8 — Pre-existing items the audit accepts

### W08-PE-1 — `PersonalTeamToggle` uses `<Link>` for native client-side nav with works-without-JS fallback
**Source:** lines 65-78. ✅ Solid pattern. Note: this is a B-4 (Band B) component, well-built.

### W08-PE-2 — `PersonalTeamToggle` preserves other filters across the toggle
**Source:** lines 37-44 + 47-51. Personal filters add `scope=personal&staffId=<id>`; Team filters strip both. Other filters preserved. ✅ Accept.

### W08-PE-3 — `/admin/staff/[id]/performance` self-redirects to /admin/me when viewing own
**Source:** per #13 audit. ✅ Consistent UX — keeps personal-performance behind one canonical URL.

### W08-PE-4 — Reports `parseReportFilters` consumes both `staffId` + `scope` parameters from URL
**Source:** per the PersonalTeamToggle.tsx comment header (line 10). Whole-page narrowing happens via the URL. ✅ URL-as-state pattern.

---

## 9 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-139 — dashboard has no team-toggle | Add scope segmented control to dashboard header | C-07 routing + C-11 design-system |
| 2 | B-140 — /admin/me only links to personal reports | Add "team reports" link | C-07 |
| 3 | B-141 — team view doesn't break out Owner contribution | Add Personal contribution line in Team Reports | C-07 or C-12+ |
| 4 | B-142 — scope doesn't persist across navigation | localStorage / user-prefs column | C-12+ |
| 5 | W08-V-1 — "Personal" terminology inconsistent | Unify | C-07 / C-12+ copy |
| 6 | W08-V-2 — all-zero Personal Stripe no explainer | Ambient empty-state copy | C-12+ |

---

## 10 — Cross-references to existing findings

- **#01 dashboard** — Personal Stripe + cognitive load + no quick-add CTAs. W08 adds the scope-toggle gap (B-139) to the dashboard improvement backlog.
- **#13 + #14 + #25** — per-surface scope behavior. W08 layers cross-page consistency analysis.
- **scope clarification 1** — Owner-takes-bookings. W08 confirms the data layer + UI honor this, but the cross-page UX could be more coherent.

---

## 11 — Hand-off

**State:** 0 screenshots (visual fix-targets are well-documented at per-page audits). 0 code changes. 0 prod DB writes. 4 new bugs (B-139 → B-142).

**Most consequential W08 findings to surface to C-B:**
1. **B-139 — dashboard scope-toggle gap** — biggest UX win for cross-page consistency. Pair with C-07.
2. **B-142 — scope doesn't persist** — small fix, big repeat-friction reduction.
3. **W08-V-1 — terminology unification** — pure copy work but consistency matters for trust.

**Next workflow:** W09 — refund + payment correction. Tests the absent atomic refund flow (master plan Part 3 carry) across booking detail Status form → audit log.

**Bug index advance:** B-138 → B-142. Next available: B-143.

*End of W08 owner-scope-switching-flow audit.*
