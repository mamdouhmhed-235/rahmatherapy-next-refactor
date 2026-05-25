# C-A.3 R05 — Therapist-Fresh first-day audit (zero-state ladder)

**Audit type:** C-A.3 role-day discovery (no fixes)
**Role:** Therapist-Fresh (`test.therapist.fresh@rahmatherapy.example.test`) — active therapist with zero assignments / bookings / history
**Day walked:** First-time experience — login → dashboard zero-state → onboarding nudges → first claimable browse
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `9de654f`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** R04 (Therapist day baseline), C-A.1 #01 (Owner dashboard for comparison), #11 (staff detail), #12 (staff availability), #14 (/admin/me).
**Roles swept:** Therapist-Fresh — **signed in live via Playwright** as `test.therapist.fresh@rahmatherapy.example.test`. Walked the dashboard + claimable view live.

---

## 1 — The Therapist-Fresh dashboard is EXCEPTIONAL

Most important finding from R05: **`TherapistDashboard.tsx` is the strongest empty-state surface in the admin.** Verified live, contains:

| Element | Quality |
|---|---|
| Personalised greeting "Good evening, Test." | ✅ Time-of-day aware (21:29 → "Good evening") |
| "Welcome, Test. Finish your profile." section as PRIMARY CTA | ✅ Headline: "Five quick fields. Add your phone, short bio, specialties, languages, and service areas so coordinators can match clients to you and the team knows how to reach you." Followed by a clear "Open my profile" button. |
| Personal contribution stripe with zero-state values | ✅ "Next visit: Nothing scheduled · Visits 0 · Hours 0h · Clients 0" |
| Date-range chips: Today / Tomorrow / This week | ✅ Includes "Tomorrow" (which Owner's dashboard lacks per R01 B-154; ironic) |
| "No upcoming visit" section copy | ✅ **"Nothing scheduled. Quiet day. Take care of yourself."** — empathetic, not clinical |
| "Open to claim" section | ⚠️ Reads "Nothing open right now." (but contradicted by /admin/bookings?view=claimable — see B-170) |
| "My week (no activity yet)" — section title explicitly labels the empty state | ✅ Strong pattern |
| "Tip: Pull down to refresh the dashboard." | ✅ Mobile-gesture awareness for the role most likely on mobile |
| "Need help?" section with 4 onboarding CTAs: Update profile / Set availability / Browse claimable work / View completed visits | ✅ **STRONGEST onboarding pattern in the admin.** |
| Nav narrowed: "My day / My bookings / Team" (vs Owner's 5+ items) | ✅ Role-appropriate scope |

**This is a reference template** for what zero-state UX should look like across the admin. Many other surfaces (per #01 V-? + #14 + #25) have terse "0" or "No results" empty states — Therapist-Fresh dashboard has narrative, empathy, and clear next steps. **Lift this pattern.**

---

## 2 — Live-walked zero-state path

### 8:00 PM (live walk) — First login
Therapist-Fresh signs in for the first time. Lands at `/admin/dashboard` → `TherapistDashboard.tsx` variant renders (NOT the Owner dashboard).

**Immediate impression:** "Welcome, Test. Finish your profile" is the first call to action. Clear next step. ✅

### Profile completion (primary onboarding rung)
Clicks "Open my profile" → `/admin/staff/87e01c11-9d0d-4b52-bf3e-2af16f0f03d5/` (their own staff detail page, per #11 — exceptional surface). The 5 fields listed in the welcome copy (phone, bio, specialties, languages, service areas) should map cleanly. **Did not deeply verify field-by-field**; flag for Therapist-Fresh follow-up to confirm the 5 fields are surfaced + savable in one go.

### Set availability (second rung)
Clicks "Set my availability" in "Need help?" → `/admin/staff/87e01c11-9d0d-4b52-bf3e-2af16f0f03d5/availability/`. **Verified live: NO AdminAccessDenied** — Therapist-Fresh CAN reach + interact with this page. 3 edit affordances visible (verified via `editAffordances: 3`). ✅ Onboarding ladder rung WORKS at RBAC level.

### Browse claimable (third rung)
Clicks "Browse claimable work" → `/admin/bookings?view=claimable`. **VERIFIED LIVE: 1 claimable booking visible** (Hijama Package, 24 May 2026 10:00–11:00, "Same-gender required: Claim").

**But wait** — the dashboard's "Open to claim" said "Nothing open right now." Mismatch (B-170 below).

Also: the visible booking is **24 May 2026** — yesterday relative to session date 2026-05-25. **Past-dated claimable booking** (B-171 below).

### My completed visits (fourth rung)
Did not deeply walk; the link routes to `/admin/bookings?view=completed&staffId=...` — would show zero results for Therapist-Fresh per their zero-history state.

---

## 3 — Bugs found

### B-170 — Dashboard "Open to claim" section disagrees with /admin/bookings?view=claimable for the same Therapist
**Severity:** medium (cross-surface data consistency — first impression is contradictory)
**Source:** verified live. Therapist-Fresh dashboard's "Open to claim" section reads "Nothing open right now." But `/admin/bookings?view=claimable` (linked from the same dashboard's "Need help?" section) returns 1 claimable booking matching this Therapist's gender + permissions.
**Likely cause:** the dashboard's "Open to claim" may filter to today/tomorrow only; the /admin/bookings claimable view has no date filter (see B-171). The mismatch is a cross-page consistency issue.
**Implication for Therapist-Fresh:** they read the dashboard, accept "nothing to claim", maybe close the tab. They miss the actual claimable work that exists. **Onboarding ladder broken at the claim rung.**
**Decision options:**
- (a) Sync the two surfaces: dashboard shows the same set as the list, filtered consistently.
- (b) Make the dashboard "Open to claim" sectional copy explicit: "Nothing open today. Browse all claimable work →" with a link.

**(b) is cheaper + clearer.** C-12+ or fold into C-07 routing.

### B-171 — `/admin/bookings?view=claimable` does NOT filter out past-dated bookings
**Severity:** medium-high (stale data — past unclaimed bookings look claimable)
**Source:** verified live. Therapist-Fresh on /admin/bookings?view=claimable sees a booking dated **24 May 2026** (yesterday) with `confirmed` status, `unassigned`, "Claim" button visible. The view filter at `bookings/page.tsx:175-177` checks only:
```ts
view === "claimable" &&
!["cancelled", "no_show"].includes(booking.status) &&
hasClaimableAssignment(booking, profile)
```
**No date filter.** So a past-dated unassigned booking still appears as claimable.
**Implications:**
- Therapist sees phantom past work in their list.
- Could even attempt to CLAIM the past booking — the server action might allow it (W05 PE-1 just guards against double-claim race; no temporal guard).
- For Therapist-Fresh specifically, the past-dated row makes the first-day experience confusing: "Am I supposed to do this 24 May booking? It's already past."
**Decision:** add `booking.booking_date >= today` to the view filter + the server-side claim eligibility check. Pair with C-05 fix or C-09 scale-aware fix. **C-04 lifecycle if combined with the W03 W03-E-2 (no temporal guard on mark-complete) finding — both are the same shape.**

### B-172 — "Open my profile" CTA on Therapist-Fresh dashboard goes to the GENERIC staff detail page, not a streamlined onboarding flow
**Severity:** low-medium (onboarding friction — first-timer drops into a generic page)
**Source:** verified live. Link `href` is `/admin/staff/87e01c11-9d0d-4b52-bf3e-2af16f0f03d5/` — the standard staff detail page (per #11). For Owner viewing this page it's a comprehensive admin tool with multiple sections. For Therapist-Fresh first-day, it's overwhelming.
**Decision:** consider a "Complete your profile" onboarding-flow variant page for first-timers — a stepped 5-field form (phone → bio → specialties → languages → service areas) that returns to dashboard on completion with "Welcome, Test. You're set up." flash. Out of Band C scope likely (would be C-NEW); flag for future "Therapist onboarding" plan.

### B-173 — Default sort/filter on /admin/bookings?view=claimable doesn't promote near-future bookings
**Severity:** low (UX — Therapist-Fresh on this view sees Hijama 24 May 2026 first; a 26 May should be more prominent)
**Source:** observed live — single row visible, can't deeply test sort. Likely sorted by `booking_date ASC` (default). For a Therapist with multiple claimable options, ASC-by-date is fine. The issue is whether past bookings are EXCLUDED (B-171) — once excluded, ASC-by-date works.
**Decision:** folds into B-171 fix.

---

## 4 — R05 surfaces the strongest patterns to lift across the admin

### R05-PE-1 — TherapistDashboard zero-state copy + structure
**Source:** `dashboard/TherapistDashboard.tsx` (existence verified per #01 audit; quality verified live in R05).
**Pattern:** every empty state has narrative, empathy, and a next-action CTA.
**Where to lift:** Owner dashboard (the 3-urgency-rep overlap could become "Quiet day" sections when truly empty). /admin/me for non-Therapist roles. Reports + Operations when zero-state.
**Decision:** **fold into C-11 design-system pass** as the empty-state pattern template.

### R05-PE-2 — "Need help?" section is the strongest onboarding pattern
**Source:** verified live — 4 CTAs (Update profile, Set availability, Browse claimable, View completed) — covers the entire Therapist-Fresh ladder.
**Where to lift:**
- Coordinator first-login: "Need help? Browse pending bookings / Triage enquiries / Set up filters."
- Admin first-login: similar role-specific list.
- Owner first-login: dashboard tour / 'getting started' panel.

**Decision:** standardise as a "Need help?" surface across role-specific dashboards. Probably C-12+ or fold into C-11.

### R05-PE-3 — Time-of-day aware greeting
**Source:** "Good evening, Test." at 21:29 → context-aware ✅. Likely a `getGreeting(hour)` helper somewhere.
**Where to lift:** Owner / Admin / Coord dashboards. **Currently Owner dashboard has no greeting** (per #01 + R01 verified — just "Dashboard" h1).

**Decision:** lift to all role-dashboards. C-12+ trivial.

### R05-PE-4 — Mobile-gesture tip ("Pull down to refresh")
**Source:** verified live.
**Decision:** consider whether other roles need different tips. Therapist-Fresh-specific is good; over-tipping for experienced roles would be noise. Accept as-is.

---

## 5 — Items for plans

| # | Finding | Best home |
|---|---|---|
| 1 | B-170 — dashboard "Open to claim" disagrees with /admin/bookings | C-12+ or C-07 — sync the surfaces |
| 2 | B-171 — claimable view doesn't filter past dates | **C-04 lifecycle (temporal guards)** or fold into C-05 |
| 3 | B-172 — "Open my profile" lands on full staff detail | Future "Therapist onboarding" plan (C-NEW or C-12+) |
| 4 | B-173 — claimable sort prominence | folds into B-171 |
| 5 | R05-PE-1 — lift TherapistDashboard empty-state pattern | **C-11 design-system pass** |
| 6 | R05-PE-2 — lift "Need help?" sectional pattern | C-11 / C-12+ |
| 7 | R05-PE-3 — time-of-day greeting on other dashboards | C-12+ trivial |

---

## 6 — Cross-references

- **R04** — Therapist day baseline. R05 builds on R04 with first-day specifics.
- **#01** — Owner dashboard. R05 highlights what Owner dashboard LACKS (greeting, "Need help?" section, narrative empty states).
- **#11** — staff detail. R05 confirms it's reachable for self-edit.
- **#12** — staff availability. R05 confirms Therapist-Fresh CAN access (per RBAC live verification).
- **W05** — claim flow. B-171 surfaces a missing temporal filter the per-workflow audit didn't catch.

---

## 7 — Hand-off

**State:** 0 screenshots (live walk captured 4 evaluate snapshots inline). 0 code changes. 0 prod DB writes. 4 new bugs (B-170 → B-173) + 4 pattern-template findings (R05-PE-1..R05-PE-4).

**R05 summary insight:** **`TherapistDashboard.tsx` is the strongest empty-state surface in the admin** — narrative, empathetic, action-oriented, mobile-aware, time-aware. Most other surfaces (per C-A.1) have terse empty states. **R05 contributes the empty-state pattern template** to C-11 design-system work.

**Two real bugs** found in the otherwise excellent variant:
- B-170: cross-surface mismatch on "Open to claim" — first-day Therapist might give up too early.
- B-171: claimable view has no past-date filter — a phantom yesterday booking is shown.

**C-A.3 COMPLETE.** All 5 role-day audits done.

**Bug index advance:** B-169 → B-173. Next available: B-174.

*End of R05 therapist-fresh-day audit.*
