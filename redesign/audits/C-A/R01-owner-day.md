# C-A.3 R01 — Owner day audit (whole-system synergy walk)

**Audit type:** C-A.3 role-day discovery (no fixes)
**Role:** Owner (`rahmatherapy@outlook.com`)
**Day walked:** morning dashboard check → review yesterday → handle today's bookings → respond to enquiries → review reports → handle a refund
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `73e9978`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #01 (dashboard), #02 (bookings list), #04 (booking detail), #08 (enquiries), #25 (reports), W01 (enquiry→booking), W02 (new booking), W03 (lifecycle), W08 (scope), W09 (refund).
**Roles swept:** Owner only (this audit) — was already signed in from W08 session.
**Live walk:** read-only browser navigation; no submits.

---

## 1 — The walk

### 8:30 AM — Morning dashboard check
Owner opens `/admin/dashboard`. Verified live (W08 session continuation):
- Top: Personal Stripe ("My contribution · This week") — Personal status pills (Ready / Confirmations / Coverage / Payments).
- Middle: "SNAPSHOT · TODAY" with same/overlapping urgency reps.
- Lower: "Needs your attention" — another listing.
- Bottom: "Operations health" — staff gaps + coverage gaps.

**Friction:**
- **Three urgency reps for largely overlapping concerns** (per #01 V-?, C-A.1 finding). Owner has to triangulate which one to act on first.
- **No quick-add CTAs** on the dashboard header — no "+ New booking", "+ Add client", "+ Add enquiry" (W02-V-1).
- **Two distinct date-range controls** on the same page — `contribStripeRange` (controls Personal Stripe) and `range` (controls dashboard urgency rep dates). Both present chips Today / This week / This month / Last 30 / Custom. Cognitive overhead: which controls what?
- **No "Yesterday" preset** — verified live (`yesterdayLinks: []`). Owner who wants to review yesterday must click "Custom" → manually pick yesterday's date in both From and To. **5 clicks to do something that should be one chip.**

### 8:35 AM — Review yesterday
Owner clicks "Custom" → opens range picker. Per #01 audit (date-range UX), the picker accepts From/To. Owner types 2026-05-24 in both fields, submits.

**Friction:**
- 5-click workflow for "view yesterday" should be one chip (per master plan Part 3 — adjacent industry table-stakes).
- "Yesterday" view is conceptually different from "Today" — it's a retro-review, often for catching missed enquiries / no-shows / pending follow-ups. The default dashboard chips don't acknowledge this distinct intent.

### 8:45 AM — Today's bookings
Owner clicks Bookings nav → lands at `/admin/bookings/?view=attention` (default tab — confirmed by #02 audit). Sees 4 tabs (All / Today / Upcoming / Cancelled / Attention / Claimable) with per-tab counts.

**Friction:**
- "Attention" is the default but the master-plan Owner-day workflow says "handle today's bookings" — implying "Today" should be default. Owner must click "Today" tab.
- Per #02: "today" semantic divergence — different surfaces interpret "today" differently. Already catalogued (E-08).

### 9:15 AM — Respond to enquiries
Owner clicks Enquiries nav → lands at `/admin/enquiries`. Sees "New (1)" with the single Audit Enquiry Two row.

**Friction:**
- The W01 conversion flow has B-104..B-109 (6 cross-page bugs). Owner converting an enquiry hits:
  - B-104 stale-prefill toast wrong copy (if URL is stale).
  - W01-E-2 sessionStorage carryover from a PRIOR conversion attempt could mislead.
  - After conversion, no reverse link back to the source enquiry (B-108).
- Master plan calls out enquiries → bookings as a high-volume Owner action. **The cross-page hand-back is broken** — once converted, the enquiry is "out of the Owner's hands"; they go on to reports without easy return.

### 10:00 AM — Review reports
Owner clicks Reports nav → lands at `/admin/reports` with Team scope (default per W08). PersonalTeamToggle visible. Owner clicks Personal to see their own contribution. Per #25 — Reports is the cleanest surface (zero animate-spin, no FAKE markers).

**Friction:**
- W08 B-142: scope doesn't persist. If Owner switches to Personal here, navigates elsewhere, returns, defaults to Team again.
- W08 B-141: Team view doesn't break out "Owner contribution" — to compare own vs team, Owner must toggle Personal then mentally diff.
- W08-V-1: terminology inconsistent (`/admin/me` says "My Contribution"; Reports says "Personal"; dashboard says "Personal Stripe").

### 11:00 AM — Handle a refund
Customer rings; Owner needs to refund booking #DA6912D5 (£80, partial £40).

**Friction (per W09):**
- No "Refund" button anywhere (B-146).
- Owner navigates to `/admin/bookings/da6912d5...` → opens Status & payment form.
- Manually edits `amount_paid` from 80 → 40 (or 0 for full).
- No confirm dialog. No refund-method tracking ("cash / card / bank transfer / voucher" — invisible).
- Optionally adds payment_note describing the refund.
- Saves.
- Audit log row: `booking_management_updated` — indistinguishable from any other payment edit (B-145).
- **W09 §10** has the proposed C-04 paired refund-and-restore deliverable; the current state is just a numeric input.

**Cross-page side-effect Owner won't notice:**
- B-148: reports `completedRevenue` STILL counts the original total_price (the `||` fallback). Owner thinks revenue is correct; it's overstating.

---

## 2 — Owner-day-specific findings

### B-154 — Dashboard has no "Yesterday" date-range chip
**Severity:** low (UX friction — master-plan-mandated Owner morning routine)
**Source:** verified live — no element matches `/yesterday/i` on /admin/dashboard. Owner must use Custom → 5-click workflow.
**Decision:** add "Yesterday" chip alongside Today / This week / etc. One-line UI change. C-12+ or C-07 routing.

### B-155 — Dashboard `contribStripeRange` and `range` are TWO separate date controls — admin must know which controls what
**Severity:** low-medium (cognitive overhead — two pickers on one surface)
**Source:** verified live — both render as identical-looking chip rows of "Today / This week / This month / Last 30 / Custom". Their effects are scoped to different parts of the page.
**Implication:** Owner sees two identical chip rows and has to know that one controls Personal Stripe + the other controls dashboard urgency rep dates. Visually similar = confusable.
**Decision:** label them distinctly OR unify into one date control that scopes both. C-07 or C-11 design-system pass.

### B-156 — Default Bookings list view is "Attention" but master-plan Owner-day implies "Today" should be default
**Severity:** very low (default-view preference — could be user-settable)
**Source:** per #02 audit. The "Attention" view aggregates pending + unassigned + reschedule-requested + customer-cancelled — broader than "Today's confirmed bookings".
**Decision:** small consideration during C-07. Could be a per-role default OR a remembered preference. C-12+.

### B-157 — No "back to enquiry list" affordance after Convert-from-enquiry
**Severity:** medium (continuity gap — Owner converts 5 enquiries in a row; loses the list cursor each time)
**Source:** post-conversion, Owner lands on `/admin/bookings/[newBookingId]`. To return to the enquiries list, they use the global Enquiries nav OR browser back. Browser back returns to the form they just submitted (stale). Global nav resets the enquiries list cursor / filter.
**Implication:** processing a batch of 5 enquiries means 5 separate "go to enquiries list, find the next one" navigations. Friction compounds.
**Decision:** post-conversion redirect to `/admin/enquiries?focus=<convertedId>` OR add a "Back to enquiries" link on the new booking detail. C-07 routing.

---

## 3 — Cross-page rhythm gaps (R01 perspective)

| Owner workflow step | Gap | Source |
|---|---|---|
| Morning dashboard | 3 urgency reps overlap | #01 V-? |
| Quick-add anything | No CTAs | W02-V-1 + R01 verified |
| Yesterday review | No preset chip | **R01 B-154** |
| Process enquiry batch | No return-to-list | **R01 B-157** |
| Compare own vs team metrics | No "Personal contribution" line in Team view | W08 B-141 |
| Switch surfaces | Inconsistent scope terminology | W08 W08-V-1 |
| Refund | Non-atomic, no confirm, no method tracking | W09 B-146 |
| Track refund effect on revenue | Reports still inflated | W09 B-148 |

---

## 4 — Visual / mental-model issues

### R01-V-1 — Owner Dashboard cognitively dense at 1280
**Source:** per #01 + live walk. The dashboard tries to be all-things-to-all-times — Personal Stripe, Snapshot Today, Needs Attention, Operations Health, all stacked. **Per role-day insight: Owner who arrives at 8:30 AM wants to see "what changed since I left yesterday?" — a temporal-diff view, not a status-pill blast.**
**Decision:** consider an "Overnight" / "Since yesterday" callout at top — what enquiries came in, what bookings were claimed, what cancellations happened. Reduces the urgency-rep overlap by surfacing CHANGE not STATE. Fold into C-11 design-system + dashboard surface refresh.

### R01-V-2 — No "I'm done for the day" affordance / EOD ritual
**Source:** observed. The dashboard doesn't have a "close out" view (e.g., "All today's bookings handled, 3 enquiries responded, refunds processed"). Owner's mental model has an end-of-day; the system doesn't acknowledge it.
**Decision:** very-low-priority. Fold into a future Band C-11+ workflow polish OR ignore until volume demands it.

---

## 5 — Cross-references

- **All bugs surfaced in C-A.1 + C-A.2** that affect Owner's day are referenced inline above.
- **R01 contributes 4 new bugs (B-154..B-157)** all in the "cross-page rhythm" theme.
- **C-07 routing plan should consolidate** B-154 (yesterday chip), B-155 (date control labels), B-156 (default view), B-157 (back to enquiries), W02-V-1 (quick-add), W01-V-1 (cancel routing).

---

## 6 — Items for plans

| # | Finding | Best home |
|---|---|---|
| 1 | B-154 — no Yesterday preset | C-07 or C-12+ |
| 2 | B-155 — dual date controls confusable | C-07 or C-11 |
| 3 | B-156 — Attention default vs Today | C-12+ default-view preference |
| 4 | B-157 — no return-to-enquiries post-convert | C-07 |
| 5 | R01-V-1 — dashboard temporal-diff insight | C-11 dashboard refresh |
| 6 | R01-V-2 — no EOD ritual | future / low priority |

---

## 7 — Hand-off

**State:** 0 screenshots (live walk reused W08 session evidence). 0 code changes. 0 prod DB writes. 4 new bugs (B-154 → B-157).

**R01 summary insight:** Owner's day is functional but rhythmically unmoored. Each surface is well-built (per C-A.1 verdicts), but the SEQUENCE Owner walks through has too many "OK now where do I go next?" decisions. **C-07 routing plan is the natural home for these.**

**Next:** R02 Admin day.

**Bug index advance:** B-153 → B-157. Next available: B-158.

*End of R01 owner-day audit.*
