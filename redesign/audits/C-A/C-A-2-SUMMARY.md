# C-A.2 — Cross-page workflow audit summary (end-of-phase consolidation)

**Status:** ✅ COMPLETE — all 10 workflows audited
**Date completed:** 2026-05-25
**Branch:** `redesign/start-state` HEAD `46bfa1e`
**Commits in C-A.2:** 10 (W01 → W10 sequentially) — from `45b51de` (W01) through `46bfa1e` (W10)
**Total commits ahead of master at C-A.2 close:** 246

**What this doc is:** the single-source-of-truth handoff between C-A.2 (cross-page workflow audit) and what comes next (C-A.3 role-day audit / C-B plan-writing). Read this alongside `C-A-1-SUMMARY.md` before opening C-B planning files.

**Operating discipline reminder:** every C-phase file embeds or references `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.

---

## 1 — Per-workflow index

| # | Workflow | Audit file | New bugs | Headline finding |
|---|---|---|---|---|
| W01 | Enquiry → booking conversion | `W01-enquiry-to-booking-flow.md` | B-104..B-109 (6) | B-107 enquiry-update non-transactional with booking-create; B-108 booking → enquiry reverse-link missing |
| W02 | New booking end-to-end | `W02-new-booking-end-to-end-flow.md` | B-110..B-114 (5) | **B-110 SQL `on conflict (email) do update` destroys existing client data — HIGH severity** |
| W03 | Booking lifecycle (pending→completed→review) | `W03-booking-lifecycle-flow.md` | B-115..B-119 (5) | **B-116 C-01 review email is GREENFIELD** + B-115 no client email on pending→confirmed |
| W04 | Cancellation + restore | `W04-cancellation-and-restore-flow.md` | B-120..B-125 (6) | B-120 restore sends no client email; B-121 "restore from audit log" copy is a UX lie |
| W05 | Assignment / claim / reassign | `W05-assignment-claim-reassign-flow.md` | B-126..B-130 (5) | B-126 6th C-05 edit point; B-130 master-plan vantage on C-05 INVERTED |
| W06 | Client create + first booking | `W06-client-create-and-first-booking-flow.md` | B-131..B-135 (5) | **B-131 + W06 §10 reframe: 3 prefill paths converge on destructive merge — C-06 architecture** |
| W07 | Availability + recurring booking | `W07-availability-recurring-flow.md` | B-136..B-138 (3) | **C-02 fully greenfield**; B-136 inline assignment skips eligibility |
| W08 | Owner scope switching | `W08-owner-scope-switching-flow.md` | B-139..B-142 (4) | B-139 dashboard has no scope-toggle; scope-control UX inconsistent across 4 surfaces |
| W09 | Refund + payment correction | `W09-refund-payment-correction-flow.md` | B-143..B-148 (6) | B-146 no atomic refund workflow; B-148 reports overstate revenue when refunded |
| W10 | Settings + downstream impact | `W10-settings-downstream-impact-flow.md` | B-149..B-153 (5) | **B-149 settings save only revalidates /admin/settings — every downstream surface stays stale** |

**Total: 50 new bugs (B-104 → B-153). Bug index runs continuously across C-A.1 + C-A.2: B-01 → B-153.**

---

## 2 — Re-framing of the 11 user items (post-C-A.2)

C-A.1 §2 already re-scoped C-01..C-11 once. C-A.2 layers cross-page findings on top. **C-B plan-writing should start from THIS reframing combined with C-A-1-SUMMARY §2.**

### C-01 — Google Business review email after completion
**Status:** **GREENFIELD CONFIRMED.** W03 §11 has a complete C-01 architecture:
- Schema: `bookings.completed_at` + `bookings.review_email_sent_at`.
- Templates: `renderReviewRequestEmail` + service-aware copy.
- Send fn: `sendReviewRequestEmail` with idempotent guard.
- Scheduler: choose Resend `scheduledAt` vs `pg_cron` (recommended) vs Vercel Cron.
- Email_event_type: `review_request_client` (new).
- Audit log action_type: `review_email_sent`.
- Trigger choice: booking-level `status='completed'` AND all-assignments-completed (B-129).

### C-02 — Recurring / standing bookings
**Status:** **FULLY GREENFIELD CONFIRMED** (W07 §1). W07 §10 has the C-02 architecture:
- 7 discovery questions for the user (cadences, end-conditions, cascade behavior, Hijri-cycle awareness).
- Schema: `recurring_booking_templates` table (recommended) + `bookings.parent_booking_id`.
- Integration points: new RPC, cron expansion, cancellation server action, UI step, calendar badge, recurrence-aware emails.
- Hijri / Sunnah days handling: service-specific decision required.

### C-03 — Enquiry → booking one-click conversion
**Scope FURTHER SHRINKS** (already shrank in C-A.1 §2). W01 confirms:
- Convert button + URL prefill exist (#08 B-36).
- Service still not pre-selected (V-08, confirmed live).
- Plus 4 cross-page bugs: B-104 toast copy, B-105 dup toast, B-106 no re-conversion guard, B-107 partial-state hazard, B-108 reverse-link missing, W01-E-2 sessionStorage carryover.
**C-03 plan should add:**
- Service fuzzy-match (the original master-plan ask).
- Stale-URL guard (B-106).
- Partial-state safety (B-107).
- Cancel button referer-aware (W01-V-1).
- Toast copy fix (B-104).

### C-04 — Cancellation restore
**Scope CHANGES + EXPANDS via W04 + W09.** From C-A.1: restore-via-audit-log copy is misleading; status-flip is the actual restore (B-16 + E-12). Cross-page additions:
- B-120: restore sends no client email.
- B-121: explicit Restore button needed (folds the copy fix in).
- B-122: no state-machine on transitions.
- **+ refund workflow (W09 §10 deliverable)** — pair restore + refund into a single "lifecycle correction" plan. New action_type `booking_refund_recorded` (B-145), first-class refund modal (B-146), payment_status vocab fix (B-143).

### C-05 — Cancelled bookings can't be assigned/claimed
**Scope EXPANDS to 6 edit points** (was 4 in C-A.1, was 1 in master plan). W05 §10 consolidates:
1. `bookings/actions.ts:269-275` claimBookingAssignment (server)
2. `bookings/[bookingId]/page.tsx:787-791` canClaim (UI)
3. `bookings/[bookingId]/page.tsx:793-794` mark-complete (UI)
4. `bookings/[bookingId]/page.tsx:883-890` AssignmentManager (UI)
5. `bookings/page.tsx:114-122` claimableRows SQL query (already filtered at view-level per §0 correction, but the underlying scope still leaks)
6. `bookings/access.ts:24-33` hasClaimableAssignment (foundational predicate)

**Recommended fix shape:** centralised `ensureBookingActive(bookingId, supabase)` helper called at the top of `claimBookingAssignment` + `updateBookingAssignment` server actions. UI predicates become defense-in-depth.

**OPEN QUESTION (B-130):** master-plan vantage on C-05 is INVERTED at the data layer. Owner CAN claim cancelled bookings today. **User clarification needed before C-B plan-writing.**

### C-06 — Delete + bulk delete + dedup
**Scope EXPANDS DRAMATICALLY.** C-A.1 said "client deletion via privacy workflow + lift services delete-with-in-use-guard". W06 §10 adds the **complete fix architecture for the destructive-client-overwrite issue** (B-110 + B-131):
- Add `p_client_id uuid DEFAULT NULL` parameter to `create_booking_request` RPC.
- Honor explicit client_id when provided (skip on-conflict).
- Replace `on conflict (email) do update` with `do nothing` + raise structured exception.
- Add `confirmDuplicate` flag to bypass exception when admin acknowledges.
- Form: hidden `client_id` input when prefilling from `?clientId=`.
- Lift `DuplicateWarningBanner` from `/admin/clients/new` into `ManualBookingForm`.

**This is the biggest data-hygiene fix in Band C.** C-06 plan should lead with this.

### C-07 — Cross-page routing improvements
**Scope GROWS — many specific cross-page findings to fold in:**
- B-108: booking detail no reverse link to source enquiry.
- W01-V-1: Cancel button on conversion form routes to bookings list, not back to enquiries.
- B-134: 3 duplicate `?clientId=` CTAs on client detail.
- B-140: /admin/me has only one cross-link to Reports.
- W05-V-2: no link from booking → /admin/staff/[id].
- W02-V-2: no "just created" affordance after booking-create redirect.
- W08 inconsistent scope-toggle terminology + dashboard missing toggle (B-139).
- W02-E-1: city whitelist invisible until SQL error — inline validation lift.

### C-08 — Email templates + automation
**Scope EXPANDS to ~7+ missing event types** (was 3 in C-A.1):
1. `assignment` (master plan)
2. `claim` (master plan)
3. `client_assigned_therapist` (master plan)
4. `booking_confirmed_client` (W03 B-115) — pending→confirmed transition
5. `review_request_client` (W03 B-116) — C-01 dependency
6. `booking_restored_client` (W04 B-120)
7. `staff_unassignment` (W05 B-127)
8. Possibly: `booking_completed_client` (W03 B-116 territory) — for non-review completion notice
9. Possibly: `refund_issued` (W09 B-146)

Plus per-row Resend on delivery log (#04 B-18 + #19 B-84).

### C-09 — Pagination + scale-aware design
**Scope CLARIFIED + cache-invalidation theme added.** C-A.1 §2 listed the unbounded surfaces. **W10 §10 + cross-W findings consolidate a cache-invalidation gap pattern:**
- W02 B-113: createManualBooking doesn't invalidate `/admin/clients*`.
- W05 B-128: assignment changes don't invalidate `/admin/staff*`.
- W10 B-149: settings save only invalidates `/admin/settings`.

**C-09 plan should choose:** (a) per-mutation cherry-pick (cheapest), (b) central `recordMutation` helper, or (c) tag-based invalidation everywhere (most scalable; recommended).

### C-10 — Bottom-of-page spacing
**No change from C-A.1.** Run Playwright 375 pass to catalogue.

### C-11 — Dark mode default + toggle
**Scope unchanged.** W08 V-1 surfaces terminology unification as adjacent design-system work; can fold in.

---

## 3 — New pattern templates surfaced in C-A.2

| Pattern | Source workflow | Use for |
|---|---|---|
| Centralised guard helper (`ensureBookingActive`) | W05 §10 | C-05 single-point fix |
| Tag-based cache invalidation (`unstable_cache` consumers) | W10 §10 | C-09 cache pass |
| Atomic refund modal | W09 §10 | C-04 refund workflow |
| Scheduler choice tree (Resend scheduledAt / pg_cron / Vercel Cron) | W03 §11 | C-01 + reminder + future cron-like work |

Plus the C-A.1 patterns (delete-with-in-use-guard, cursor pagination, DuplicateWarningBanner, RBAC narrowing, etc.) — all still apply.

---

## 4 — Tech-debt cross-page findings (additions to C-A.1 §4 inventory)

C-A.1 §4 documented 11 surfaces with `// FAKE` / `data-redesign-fake` / `BUILD-*.md` markers. C-A.2 adds:

| Theme | Source workflow | Marker |
|---|---|---|
| Stale "refunded" + "waived" payment_status vocab | W09 B-143 | `reports/__tests__/reports-helpers.test.ts:47` comment + dead filter values |
| `staff_profiles.availability_mode='global_with_overrides'` unreachable from UI | W07 B-138 | SQL branch in `create_booking_request` lines ~143+ but no UI surface |
| `reports/reporting.ts:417` TODO (`bookedRevenue` policy decision) | W09 B-148 | Already known; W09 surfaces as actionable item |

---

## 5 — Bug index (continuous from C-A.1 + C-A.2 = B-01 → B-153)

C-A.1: B-01..B-103 (103 bugs across 25 surfaces).
C-A.2: B-104..B-153 (50 bugs across 10 workflows).

**Total bug index: 153 bugs catalogued in C-A.**

P0 / HIGH severity (data integrity / regulatory):
- B-87/88/89 — privacy GDPR fulfilment (P0 regulatory)
- B-110 + B-131 — destructive client overwrite (HIGH data integrity, 3 paths)
- B-148 — reports overstate revenue when refunded (HIGH reporting accuracy)
- B-149 — settings cache invalidation gap (HIGH cross-page integrity)

HEADLINE for individual user items:
- B-116 — C-01 greenfield
- C-02 entire greenfield (W07)
- B-126 + W05 §10 — C-05 6 edit points + centralised helper
- B-115 + B-127 + 5 more — C-08 expanded to ~7+ missing event types
- B-146 — C-04 needs first-class refund modal

---

## 6 — Open questions for the user (C-B can't write plans until these are answered)

C-A.1 listed 6 open questions. C-A.2 confirms + adds:

1. **C-05 vantage clarification (HIGH)** — confirmed by B-130: master-plan framing is INVERTED at the data layer. Owner CAN claim cancelled bookings. Which is the bug?
2. **/admin/privacy GDPR scope (HIGH — regulatory)** — unchanged from C-A.1.
3. **C-02 recurring bookings discovery (now expanded to 7 questions per W07 §10)** — services / roles / cadences / end-conditions / cancellation cascade / reschedule cascade / Hijri-cycle / therapist binding.
4. **C-01 Google review link + assets** — unchanged.
5. **C-06 framing decision** — confirmed by W06 §10: should be "client deletion via privacy" + the booking-flow client-handling fix + DuplicateWarningBanner lift. Pre-decided structure.
6. **B-34 client edit surface** — unchanged.
7. **NEW C-08 scope decision** — C-08 expanded from 3 to 7+ missing event types. User should pick which to ship in C-08 vs defer to C-12+.
8. **NEW C-04 refund-paired scope** — W09 §10 proposes pairing cancel/restore + refund into a single "lifecycle correction" C-04 plan. User confirms scope.
9. **NEW C-09 cache-invalidation approach** — pick (a) cherry-pick, (b) central helper, (c) tag-based. Recommended (c).

---

## 7 — Recommended next move

Per master plan structure, next phase is **C-A.3 role-day audit** (5 roles: Owner / Admin / Coord / Therapist / Therapist-Fresh).

**Alternative paths the user may prefer:**
- **Skip C-A.3 and go to C-B planning** — C-A.1 + C-A.2 between them have produced 153 bugs and ~9 architecture deliverables (sections §10/§11 across workflow audits). C-B can write plans against this without needing role-day flows. The role-day audit would surface friction patterns useful for C-07 routing and C-11 dark-mode design, but not blocking.
- **Privacy GDPR sprint (Tier-A) first** — B-87/88/89 P0 regulatory severity. Recommended priority per C-A.1.
- **Test-data cleanup** — independent of all plans; ~30-min scripted DELETE pass.

**Master plan's recommended sequence:** C-A.3 → C-B → C-C. User's call.

---

## 8 — Cross-page architecture deliverables (lift directly into C-B)

C-A.2 produced these complete sub-plans embedded in workflow audits. C-B can lift each into a C-NN plan file:

- **W01 §11** — C-03 narrow scope (service fuzzy-match + 4 cross-page bugs)
- **W02 §1+§2** — manual-booking entry-point catalogue + cache-invalidation map
- **W03 §11** — C-01 architecture (schema + template + send fn + 3 scheduler options + un-complete safety)
- **W04 §1+§10** — cancellation paths + C-04 restore-button-and-email shape
- **W05 §10** — C-05 6-edit-point list + `ensureBookingActive` helper recommendation
- **W06 §10** — C-06 architecture (the destructive-overwrite fix: p_client_id parameter + on-conflict-do-nothing + DuplicateWarningBanner lift)
- **W07 §10** — C-02 complete architecture (7 questions + schema + integration points + Hijri handling)
- **W08 §1** — scope-control inventory across 4 surfaces
- **W09 §10** — C-04 paired refund workflow (extension of W04 scope)
- **W10 §10** — C-09 cache-invalidation approach options

---

*End of C-A.2 programme summary.*
