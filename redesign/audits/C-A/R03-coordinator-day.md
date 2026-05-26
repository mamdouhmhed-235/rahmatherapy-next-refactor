# C-A.3 R03 — Coordinator day audit

**Audit type:** C-A.3 role-day discovery (no fixes)
**Role:** Coordinator (`test.coordinator@rahmatherapy.example.test`)
**Day walked:** Triage workflow — unassigned bookings + enquiry follow-up + active queues
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `17b8192`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** R01 (Owner — shared dashboard friction), R02 (Admin), C-A.1 #02 (bookings tabs), #08 (enquiries), #18 (operations), W01 (enquiry→booking), W05 (assignment/claim), W04 (cancellation).
**Roles swept:** Coordinator scope inferred from RBAC predicates + per-page audits.

---

## 1 — Coordinator's narrowing (vs Owner/Admin)

Per the RBAC predicates and per-page audits:

| Surface / capability | Coord has? | Source |
|---|---|---|
| `/admin/dashboard` | ✅ | All authenticated admin |
| `/admin/bookings` full list + manage | ✅ | `canManageAllBookings` per #03 CR-10 |
| `/admin/bookings/new` (manual booking) | ✅ | same predicate per #03 CR-10 |
| `/admin/clients` + `/admin/clients/new` | ✅ | `canManageClients` (likely granted) |
| `/admin/enquiries` | ✅ | `canManageEnquiries` per #08 CR-17 |
| `/admin/calendar` | ✅ | read-only — all admin |
| `/admin/operations` | ✅ | per #18 (Owner/Admin/Coord listed) |
| `/admin/staff` list | likely ✅ view-only | TBD |
| `/admin/staff/[id]` | likely ❌ | `canManageStaffProfiles` not granted by default |
| `/admin/staff/[id]/availability` | likely ❌ | same |
| `/admin/availability` global | likely ❌ | `canManageSettings` not granted |
| `/admin/settings` | ❌ | `canManageSettings` |
| `/admin/services` | ❌ | services management |
| `/admin/emails` | likely view-only | `canViewEmailLogs` ≠ `canManageEmailSettings` |
| `/admin/roles` | ❌ | high-trust |
| `/admin/privacy` | depends on `canManagePrivacyOperations` grant | per #22 |
| `/admin/audit` | depends on `canViewAuditLog` grant | per #24 |
| `/admin/reports` + PersonalTeamToggle | ✅ visible toggle per W08 §1 | per W08 CR-2 |

**Effective Coord scope:** bookings + clients + enquiries + calendar + operations + reports (with toggle). Coord is **the triage role** — they coordinate but don't configure.

---

## 2 — Coord's day walk (narrative)

### 8:30 AM — Triage start
Coord opens `/admin/dashboard`. Same overlapping urgency reps as Owner/Admin. Specifically interested in:
- "Needs your attention" — usually populated by pending bookings + unassigned slots.
- "Operations health" — staff gaps / coverage gaps.

**Coord-specific friction:**
- The Personal Stripe ("My contribution") shows for Coord too if they're bookable per scope clarification 2 — BUT Coordinator might NOT take bookings. If Coord has `can_take_bookings=false`, the Personal Stripe might still render (need to verify the predicate). **If it does, it's irrelevant noise for a non-bookable Coord.**
- Same R01 friction (B-154 no Yesterday chip, B-155 dual date controls, no quick-add CTAs).

### 9:00 AM — Triage unassigned bookings
Coord clicks Bookings → switches to "Unassigned" tab (per #02 audit, tabs include All / Today / Upcoming / Cancelled / Attention / Claimable; "Unassigned" is likely captured under Attention or its own subview).

Per `bookings/page.tsx:184-186`:
```ts
(view === "unassigned" &&
  !["cancelled", "no_show"].includes(booking.status) &&
  booking.assignment_status === "unassigned")
```
So a dedicated "Unassigned" view exists ✅.

**Coord-specific friction:**
- For each unassigned booking, Coord opens detail → AssignmentManager → picks therapist from dropdown.
- W05 B-127: removed/reassigned therapist gets no email — Coord doesn't realise the previous therapist isn't notified.
- W05 B-128: assignment changes don't invalidate /admin/staff cache — Coord checking staff workload sees stale data.
- W05 B-136: inline-assignment-on-create doesn't validate eligibility — if Coord uses /admin/bookings/new with step-4 inline assignment, could over-assign a busy therapist.

### 10:00 AM — Enquiry follow-up
Coord clicks Enquiries → reviews New + Contacted tabs.

For each:
- "Mark contacted" button (after calling the lead) — works ✅.
- "Convert" button (if booking can be created from the enquiry) — runs W01 conversion flow.

**Coord-specific friction:**
- W01 B-104..B-109 all apply.
- B-157: post-convert lands on `/admin/bookings/[id]` with no return-to-enquiry list. Coord processing a batch of 5 leads loses cursor 5 times.
- **Coord's bulk-actions on enquiries** (per #08 E-22) — Mark contacted + Close via row checkboxes — partial-success handling exists ✅. Pattern accept.

### 11:00 AM — Operations queue
Coord clicks Operations → reviews active queue (per #18). 18 audit found:
- 5 `data-redesign-fake` markers + 1 missing operations-clear.svg.
- Proper pagination ✅ (C-09 template alongside audit log).
- Bulk resolve action available.

**Coord-specific friction:**
- The "missing operations-clear.svg" empty state image (per #18 V-?) — if Coord clears the queue, they see broken-image / missing empty-state UI.
- Otherwise this surface is well-built for Coord's workflow.

### 12:00 PM — Lunch / between-task gap
Coord checks dashboard for an update. Same urgency reps still showing the same items (no temporal-diff insight per R01-V-1). Coord has to MANUALLY remember "I just handled that enquiry; the dashboard should reflect it" — but it does (cache invalidations work per W01). Subtle: the dashboard SHOULD show movement, not static state.

### 2:00 PM — Pivot to bookings management
Coord opens /admin/bookings again. Re-triages the day's newly-arrived items.

**Coord-specific friction:**
- "Today" vs "Attention" tab semantics (#02 E-08).
- No saved-filter / pinned-filter affordance — Coord re-applies the same filter every session.

### 5:00 PM — Wind down
Coord glances at Reports → Personal scope (if Coord is bookable, sees own contribution) → Team scope to see end-of-day metrics. Same W08 friction (no scope persistence per B-142).

---

## 3 — Coord-day-specific findings

### B-161 — No saved-filter / pinned-filter pattern across the admin
**Severity:** medium (workflow friction — Coord opens same filter every session)
**Source:** observed. /admin/bookings has filter strip; /admin/enquiries has filter strip; /admin/operations has filter strip. None has a "Save this filter" / "Pin filter" pattern. Coord who always filters bookings by "Today + Unassigned + male-required" types the same filter every time they open the surface.
**Decision:** add saved filters with URL-shareable named queries. Pair with C-07 routing OR C-12+ workflow polish.

### B-162 — Coord can use /admin/bookings/new inline-assignment but has no warning when picking a busy therapist
**Severity:** medium (W05 B-136 confirmed at the role-of-use level)
**Source:** R03 + W05 B-136. Coord is the role most LIKELY to use inline-assignment when creating a phone-booked appointment (Owner+Admin can also; Coord does it daily). The eligibility-skip is most likely to bite Coord in production.
**Decision:** same fix as W05 B-136 (add eligibility check). Surfaced here at role-priority level.

### B-163 — Coord with `can_take_bookings=false` still sees Personal Stripe on dashboard (need to verify)
**Severity:** low (UX noise for non-bookable Coord)
**Source:** logic inferred — Personal Stripe predicate is `canClaimAssignments(profile)` which requires `profile.can_take_bookings`. So if Coord is NOT bookable, the Stripe shouldn't render. **Likely fine, but worth verifying live** for confidence.
**Decision:** verify in C-A.1 #01 follow-up OR accept.

---

## 4 — Coord-relevant cross-page rhythm gaps

| Coord workflow step | Gap | Source |
|---|---|---|
| Open dashboard | 3 overlapping urgency reps | #01 + R01 |
| Triage Unassigned bookings | View filter works ✅; staff cache stale post-assign | W05 B-128 |
| Convert enquiry | W01 6 bugs; no return-to-list | W01 + R01 B-157 |
| Bulk enquiry actions | partial-success works ✅ | #08 E-22 |
| Operations queue | empty-state missing-asset | #18 |
| Reports | scope toggle works ✅; doesn't persist | W08 B-142 |
| Wrap up | no "Daily triage summary" | — (no finding; just observation) |

---

## 5 — Items for plans

| # | Finding | Best home |
|---|---|---|
| 1 | B-161 — no saved-filter / pinned-filter pattern | C-07 or C-12+ workflow polish |
| 2 | B-162 — Coord-priority surfacing of W05 B-136 | same as W05 B-136 |
| 3 | B-163 — verify Personal Stripe hidden for non-bookable Coord | #01 follow-up |
| (others) | R01 + R02 findings apply equally | as per those audits |

---

## 6 — Hand-off

**State:** 0 screenshots (narrative-based, RBAC-derived). 0 code changes. 0 prod DB writes. 3 new bugs (B-161 → B-163).

**R03 summary insight:** Coord's day is high-frequency triage + cross-page navigation. Each individual surface works fine (per C-A.1 verdicts), but Coord's WORKFLOW PRIMITIVES (saved filters, return-to-list, batch processing) are weak. **C-07 routing plan is the natural home** for these.

**Next:** R04 Therapist day.

**Bug index advance:** B-160 → B-163. Next available: B-164.

*End of R03 coordinator-day audit.*
