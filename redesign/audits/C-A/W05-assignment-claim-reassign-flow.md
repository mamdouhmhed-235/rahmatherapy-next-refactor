# C-A.2 W05 — Booking assignment / claim / reassign flow audit

**Workflow:**
- Owner/Admin assigns a therapist to an unassigned booking → `updateBookingAssignment` action=`assign` → assigned-staff email.
- Therapist claims an unassigned slot → `claimBookingAssignment` → audit log + self-notification email.
- Admin reassigns from therapist A to B → unassigns A + assigns B → B notified.
- Admin unassigns altogether → A's slot opened.
- Therapist completes/no-shows their own assignment → `updateOwnAssignmentStatus`.

**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `4069a32`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #02 (B-04 server-action gate), #04 (B-15 three UI predicate sites), #11 (staff detail), #14 (admin/me — claimable section), #19 (C-08 missing event types per B-83), W03 (email cascade pattern), W04 (claimable-query leak — see correction in §0).
**Source surveyed:**
- Server actions: `bookings/actions.ts:239-365` (`claimBookingAssignment`), `:449-562` (`updateBookingAssignment`), `:564-625` (`updateOwnAssignmentStatus`).
- Access predicates: `bookings/access.ts:14-56` (`canClaimAssignments`, `isOwnBooking`, `hasClaimableAssignment`, `canOpenBookingRecord`, `canAccessBooking`).
- List view + scoping: `bookings/page.tsx:107-133` (`getScopedBookingIds`), `:166-192` (in-memory view filter).
- Eligibility logic: `bookings/assignment-eligibility.ts` (referenced; not deeply read).
**Roles swept:** Owner. Therapist behavior derived from code (would need a real claimable booking to test, which doesn't exist in current DB state — see §0).
**No submit performed.**

---

## 0 — Correction to W04 B-124 (cross-page leak claim)

**W04 B-124 said:** cancelled bookings still appear in the Claimable tab.

**More precisely after deeper inspection:**

- ✅ The IN-MEMORY view filter at `bookings/page.tsx:175-177` DOES exclude cancelled/no_show bookings from the Claimable VIEW.
- ❌ The SQL `claimableRows` query at `:114-122` does NOT exclude cancelled bookings — but its leak is masked by the view filter at the LIST surface.
- ❌ `hasClaimableAssignment(access.ts:24-33)` does NOT check booking.status — and it's also used by `canOpenBookingRecord` at line 40, which gates whether a therapist can OPEN a given booking's detail page.

**Net effect:** the Claimable LIST is clean. But a therapist who deep-links / bookmarks / has-stale-history of a now-cancelled booking can still OPEN the detail page, see the Claim button (per #04 B-15a), and click it (server action lets it through per #02 B-04). **The C-05 leak vector is via direct URL access, not list display.**

W04 B-124 stands as a "claimable scope" finding but the wording needs C-B planners to read it together with this correction. The C-05 edit list now resolves to **6 edit points** (see §11).

---

## 1 — Cross-page flow walk

### Assign path (Owner → Therapist)
| Step | Action | Side-effect |
|---|---|---|
| 1 | Owner opens `/admin/bookings/[id]` for a `confirmed`-status booking with unassigned slots | AssignmentManager renders if `canReassignBookings(profile)` (line 883 of #04 audit). |
| 2 | Owner selects a staff from dropdown → submits | `updateBookingAssignment` action="assign" runs. Eligibility check via `getStaffAssignmentPreviews` (line 493-498). |
| 3 | Server updates assignment row → recomputes `bookings.assignment_status` via `recomputeBookingAssignmentStatus` (line 86-116). | Status becomes `partially_assigned` or `fully_assigned`. |
| 4 | `sendStaffAssignmentEmail` fires to the new staff member (line 542-551). | Therapist receives "You've been assigned to a booking". |
| 5 | Audit log row: `booking_assignment_reassigned` (line 528). | Forensic trail captured. |
| 6 | Cache invalidation: `report-data`, `dashboard-data` tags + revalidatePath `/admin/bookings/[id]`, `/admin/bookings`, `/admin/dashboard`, `/admin/calendar`. | **NOT `/admin/staff` or `/admin/staff/[id]`** — same gap pattern as W02 B-113. |
| 7 | Client gets NO email | C-08 missing-template per B-83 + W03 B-115. |

### Claim path (Therapist self-claims)
| Step | Action | Side-effect |
|---|---|---|
| 1 | Therapist opens `/admin/bookings` → "Claimable" tab → sees rows matching gender + assignment.status=unassigned. **Cancelled excluded from list per page.tsx:175-177.** | ✅ View safe. |
| 2 | Click into booking detail | `canOpenBookingRecord` resolves true via `hasClaimableAssignment`. **No booking.status check here** — cancelled deep-link reachable. |
| 3 | Click Claim button → `claimBookingAssignment` action runs | Eligibility check via `getClaimAssignmentEligibility`. **No booking.status check at action level either** (#02 B-04). |
| 4 | Assignment row updated → recompute booking assignment_status | Same as Assign path step 3. |
| 5 | `sendStaffAssignmentEmail(bookingId, actor.email, ..., actor.id)` (line 348-355) | Therapist self-notified. **Admin is NOT notified the slot has been claimed** (C-08 missing event per #19 B-83). |
| 6 | Audit log: `booking_assignment_claimed` (line 336-346) | Forensic trail captured. |
| 7 | Client gets NO email | They never knew about the assignment; they don't know it's been claimed. C-08. |

### Reassign path (Admin reassigns A → B)
| Step | Action | Side-effect |
|---|---|---|
| 1 | Owner/Admin opens AssignmentManager on detail page | Predicate from line 449-455. |
| 2 | Pick new staff (different from current) → submit | `updateBookingAssignment` action="assign" with new staff_id. |
| 3 | Single UPDATE on `booking_assignments` row → new `assigned_staff_id` | The PREVIOUS staff is silently un-assigned by virtue of the update. |
| 4 | `sendStaffAssignmentEmail` fires to the NEW staff (line 542-551) | New therapist notified. |
| 5 | **PREVIOUS therapist gets NO notification they've been removed** | B-127. |
| 6 | Audit log: `booking_assignment_reassigned` (line 528) | Captures the transition but doesn't fire a removal email. |

### Unassign path (Admin clears assignment to nobody)
| Step | Action | Side-effect |
|---|---|---|
| 1 | AssignmentManager → "Unassign" action | `updateBookingAssignment` action="unassign". |
| 2 | Server: assigned_staff_id → null, status → "unassigned" (line 485-489) | Slot reopened. |
| 3 | `recomputeBookingAssignmentStatus` runs | Booking moves toward `unassigned` or `partially_assigned`. |
| 4 | **NO email sent** (line 535: `if (updatedAssignment.assigned_staff_id)` — branch only fires when there's a new staff) | Previous therapist not notified of removal. B-127. |
| 5 | Audit log: `booking_assignment_unassigned` (line 528) | Captured. |

### Therapist self-complete / no-show path
| Step | Action | Side-effect |
|---|---|---|
| 1 | Therapist on booking detail (assigned to them) → marks own assignment completed | `updateOwnAssignmentStatus` (line 564). |
| 2 | Assignment row update → recompute booking assignment_status | If all assignments complete, booking assignment_status becomes `fully_assigned` (the recompute logic at line 100-108 only tracks "assigned"+ count, not "completed"+ count — so a fully-completed booking still reports `fully_assigned`, not `fully_completed`. Subtle modeling). |
| 3 | **NO email** at this level | No assigned-staff change email fires for self-action (line 564-625 has no email send). |
| 4 | Audit log: `booking_assignment_completed` / `booking_assignment_no_show` (line 608-615) | Captured. |
| 5 | Booking-level `bookings.status` is NOT updated by this path. | Admin must still set booking.status=`completed` via `quickUpdateBooking` action=complete to trigger booking-level cache + audit. **Independent state-machines** — see B-129. |

---

## 2 — Bugs found

### B-126 — `hasClaimableAssignment(access.ts:24-33)` doesn't filter cancelled bookings — 6th C-05 edit point
**Severity:** medium (the foundational predicate behind both LIST visibility AND detail-page access)
**Source:** `bookings/access.ts:24-33`. The function returns true if ANY assignment matches `status="unassigned"` + gender match — no booking-status check. Used by:
- `canOpenBookingRecord(line 40)` → gates whether a therapist can navigate to a booking detail at all.
- `bookings/page.tsx:177` — the in-memory view filter wraps it with its own status check (saves the LIST).
- `bookings/page.tsx:759` — used per-row inside the list rendering loop (probably to decide row-level affordances).
**Net implication:** cancelled bookings with unassigned slots stay reachable to therapists via direct URL. Fix the function itself; both the list display and the detail-page access become consistent.
**Decision:** add `booking.status NOT IN ('cancelled','no_show')` to the predicate body. **This is the 6th C-05 edit point** (consolidates with #04 B-15 + #02 B-04 + W04's nascent claimable-query finding).

### B-127 — When a booking is reassigned from therapist A to B (or unassigned entirely), therapist A is NOT notified they've been removed
**Severity:** medium (workflow + UX gap — therapist plans their day off an outdated assignment)
**Source:** `actions.ts:535-552` — the email-send branch only fires when there's a NEW `assigned_staff_id`. On `action=unassign` (line 485-489), the new id is null → branch skipped. On reassign A→B, only B gets a notification email — A is silently removed.
**Concrete failure mode:**
- Tuesday morning: Owner assigns Hijama Booking #42 to Therapist Sara.
- Sara sees in her dashboard. Plans her morning around it.
- Tuesday lunch: Owner reassigns to Therapist Aisha (Sara is double-booked).
- Aisha gets the assignment email. Sara gets nothing.
- Sara shows up at the client's address Tuesday afternoon.
- Awkward + commercial loss.
**Decision:** add `sendStaffUnassignmentEmail(bookingId, previousStaffEmail, adminClient, previousStaffId)` on unassign + reassign paths. New template needed. **Add to the C-08 backlog — now ~7+ missing event types.** Pair with C-04 / C-08.

### B-128 — `revalidatePath("/admin/staff")` and `/admin/staff/[id]` not called on assignment changes
**Severity:** low-medium (stale staff-detail data after assignment/claim/unassign)
**Source:** all 4 assignment server actions (claim/assign/reassign/unassign + own-status) end with `revalidatePath` calls for `/admin/bookings/*`, `/admin/dashboard`, `/admin/calendar`. **None invalidate `/admin/staff` or `/admin/staff/[id]`** — yet the staff detail page (per #11) shows "Recent bookings" and the staff list (per #10) shows workload aggregates. Both will be stale after an assignment mutation.
**Same gap pattern as W02 B-113 (clients) and W03 (general)** — cross-page cache invalidation is missing for the surfaces the booking flow touches.
**Decision:** add `revalidatePath("/admin/staff")` + `revalidatePath("/admin/staff/${assignedStaffId}")` (and the previous staff id if applicable). C-09 cache pass or C-12+ trivial.

### B-129 — `bookings.status` and `booking_assignments.status` are independent state-machines with no enforced relationship
**Severity:** medium (data modeling — leads to subtle inconsistencies)
**Source:**
- Therapist completing assignment via `updateOwnAssignmentStatus` updates `booking_assignments.status` only. Does NOT touch `bookings.status`.
- Admin marking booking complete via `quickUpdateBooking` action=`complete` updates `bookings.status` only. Does NOT touch `booking_assignments.status`.
- A booking with `bookings.status='completed'` could have all its assignments still at `status='assigned'`. Visible in DB; not surfaced in UI.
- Conversely, all assignments completed but `bookings.status='confirmed'` is also a valid state.
**Implication for C-01 (review email):** the trigger needs to choose explicitly which state-machine signals "fully done". If it triggers on `bookings.status='completed'`, then individual therapists completing all their assignments doesn't fire the review email automatically. If it triggers on "all assignments completed", admins lose control.
**Decision:** state-machine design decision required during C-01 plan-writing. Recommend: trigger on `bookings.status='completed'` (admin control wins) AND require that all assignments are also completed (forensic consistency). Pair with #11 (staff detail) audit's implicit assumption.

### B-130 — Owner-vantage on the C-05 cancelled-booking-claim — confirmed from code
**Severity:** master-plan inconsistency (the unresolved C-05 vantage question)
**Source:** the master plan Part 2 said "cancelled bookings can't be assigned/claimed". My code review confirms the master plan framing is INVERTED — at the DATA layer (`claimBookingAssignment` action + `updateBookingAssignment` action + `hasClaimableAssignment` predicate), nothing blocks cancelled bookings. Owner CAN claim/reassign cancelled bookings today. Therapist's CLAIMABLE TAB excludes them via in-memory view filter (W04 §0 correction), but other entry points (deep-link, direct URL) work.
**This is the unresolved master-plan vantage question.** The user clarification is needed before C-05 plan-writing.
**Decision:** flag for user discussion. Two reads:
- (a) "Cancelled bookings shouldn't be claimable" = enforce the inertness across all 6 edit points → C-05 is a defensive lockdown.
- (b) "Owner SHOULD be able to claim/reassign cancelled bookings if they intend to restore" = leave the predicates open + add C-04 restore-button + tie restore + reassign workflow together. **Cleaner narrative.**

---

## 3 — Visual issues

### W05-V-1 — AssignmentManager dropdown lists eligible therapists but doesn't surface CURRENT assignment cleanly
**Source:** observed in code. `AssignmentManager` (per #04 B-15c context) lists previews via `getStaffAssignmentPreviews`. Whether the currently-assigned staff is visually marked (e.g., "Currently assigned" badge) needs live verification. Out of W05 scope; flag for C-07 (routing) or C-12+ polish.

### W05-V-2 — No cross-link from `/admin/bookings/[id]` AssignmentManager row to the assigned staff's `/admin/staff/[id]` detail page
**Source:** observed in code — the staff name renders as text, not a link. Same pattern as the B-108 reverse-link gap. Pair with C-07.
**Decision:** clickable staff name → /admin/staff/[id]. C-07.

---

## 4 — Empty / edge states

### W05-E-1 — Therapist with no eligible claimable assignments sees an empty Claimable tab with appropriate copy
**Source:** `bookings/page.tsx:692-700` — "No unassigned bookings right now." vs "No unassigned bookings match your profile right now." Two distinct empty-states based on whether there ARE any unassigned bookings system-wide. ✅ Good UX.

### W05-E-2 — Eligibility logic for self-claim is non-trivial (gender match + availability window + busy overlap + global blocked dates + staff blocked dates + staff availability rules)
**Source:** `assignment-eligibility.ts` (referenced). Mirrors the create_booking_request RPC logic for finding eligible therapists. Sophisticated.
**Implication:** the "preview" UX for the Owner reassign flow is computed on-demand. If a therapist is offered but actually busy at the time, the system correctly rejects. Defense in depth (front-end shows; server confirms).

### W05-E-3 — Race condition on simultaneous claims of the same slot
**Source:** `actions.ts:288-302` — the claim UPDATE includes `.eq("status", "unassigned").is("assigned_staff_id", null)` — Postgres conditional update is atomic. If two therapists submit simultaneously, only one wins; the other gets "This assignment has already been claimed." (line 301). ✅ Solid concurrency hygiene.

---

## 5 — Cross-role inconsistencies

### W05-CR-1 — Owner / Admin / Coord all have `canManageAllBookings` → can assign + reassign + unassign
**Source:** standard predicate. ✅ Accept.

### W05-CR-2 — Therapist with `claim_assignments` permission + matching gender + eligibility → can claim
**Source:** layered predicates: `canClaimAssignments` (permission), `hasClaimableAssignment` (booking-level), `getClaimAssignmentEligibility` (busy/blocked/window). ✅ Multi-layer guards work.

### W05-CR-3 — Therapist completes own assignment via `updateOwnAssignmentStatus`, NOT via `quickUpdateBooking`
**Source:** distinct server actions for distinct privileges. ✅ Correct privilege separation.

### W05-CR-4 — Therapist can mark own assignment status to `completed` or `no_show` (OWN_ASSIGNMENT_STATUSES line 56)
**Source:** line 56 — `OWN_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["completed", "no_show"]`. Therapist CANNOT mark own assignment cancelled/unassigned/assigned. ✅ Correct.

### W05-CR-5 — Inactive staff cannot be re-assigned via reassign (would need an explicit toggle to re-activate first)
**Source:** `staff_profiles` has `active` boolean. The assignment-eligibility logic filters `active=true` upstream. ✅ Accept.

---

## 6 — Cross-viewport issues

### W05-CV-1 — AssignmentManager at 375 (mobile)
**Source:** not verified live. Per #04 V-13 the detail page sidebar reflows poorly at mobile. AssignmentManager is in the main content column, not sidebar — likely fine. Flag for C-07 mobile-pass.

---

## 7 — Console / network issues

### W05-CN-1 — 0 errors / 0 warnings on the read-only walk
Confirmed via earlier sessions' baselines.

---

## 8 — Pre-existing items the audit accepts

### W05-PE-1 — Atomic conditional UPDATE prevents double-claim race
**Source:** `actions.ts:288-302`. ✅ Strong concurrency.

### W05-PE-2 — Audit log captures every assignment transition with before+after state
**Source:** actions.ts:336-346 (claim), :526-533 (assign/reassign/unassign), :608-615 (self). ✅ Strong forensic trail.

### W05-PE-3 — Eligibility logic mirrors create_booking_request RPC — same gender/availability/blocked-date rules
**Source:** consistency between SQL function (W02 §1) and `assignment-eligibility.ts`. ✅ DRY-by-design even though duplicated. Could be refactored to a single shared function, but the SQL/TS split is reasonable.

### W05-PE-4 — `recomputeBookingAssignmentStatus` is the single source of truth for `bookings.assignment_status`
**Source:** `actions.ts:86-116` called after every assignment mutation. ✅ Consistent.

---

## 9 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-126 — hasClaimableAssignment doesn't filter cancelled | Add booking.status NOT IN guard | **C-05 (6th edit point)** |
| 2 | B-127 — no unassignment email to removed therapist | New `sendStaffUnassignmentEmail` | **C-08** |
| 3 | B-128 — assignment changes don't invalidate /admin/staff cache | Add revalidatePath calls | C-09 or C-12+ |
| 4 | B-129 — independent state-machines bookings vs assignments | Design decision required for C-01 + future | C-01 design |
| 5 | B-130 — master-plan C-05 vantage is INVERTED at data layer | **User clarification needed** | C-B prep |
| 6 | W05-V-1 — current-assigned not visually marked | Surface "currently assigned" badge | C-12+ |
| 7 | W05-V-2 — no link from booking → staff/[id] | Clickable staff name | C-07 |

---

## 10 — Cross-references to existing findings + revisions

- **#02 B-04** — `claimBookingAssignment` server action no booking.status check. **W05 confirms.** Edit point 1.
- **#04 B-15** — 3 detail-page UI predicates. **W05 confirms.** Edit points 2-4.
- **W04 B-124 (revised in §0)** — claimable LIST is filtered correctly; claimable SCOPE (set of IDs) and detail-page ACCESS are not.
- **W05 B-126 (this audit)** — `hasClaimableAssignment` foundational predicate. Edit point 6.
- **claim/reassign server actions** — `claimBookingAssignment` and `updateBookingAssignment` both miss `booking.status` checks at server level. The server is where C-05's defense-in-depth must land regardless of UI fixes.

**Consolidated C-05 edit list (6 points):**
1. `bookings/actions.ts:269-275` `claimBookingAssignment()` — add `booking.status NOT IN (...)` guard
2. `bookings/[bookingId]/page.tsx:787-791` — `canClaim` predicate
3. `bookings/[bookingId]/page.tsx:793-794` + `:799-801` — `isOwn` / mark-complete predicate
4. `bookings/[bookingId]/page.tsx:883-890` — `canReassignBookings` AssignmentManager render predicate
5. `bookings/page.tsx:114-122` `claimableRows` SQL query — add status filter
6. `bookings/access.ts:24-33` `hasClaimableAssignment` predicate body — add status filter

**Server-action defense recommended (single-point fix that doesn't require UI changes):** add a centralised helper `ensureBookingActive(bookingId, supabase) -> throws` and call it at the top of `claimBookingAssignment` + `updateBookingAssignment`. Then ALL UI predicate fixes (#2-#4, #6) become defense-in-depth rather than load-bearing. **Recommended C-05 plan shape.**

---

## 11 — Hand-off

**State:** 0 screenshots. 0 code changes. 0 prod DB writes. 5 new bugs (B-126 → B-130).

**Most consequential W05 findings to surface to C-B:**
1. **B-126 — sixth C-05 edit point at the foundational predicate.** Plus W05 §10 consolidates the 6-point edit list.
2. **B-127 — unassignment email gap (new C-08 entry).** Real workflow issue.
3. **B-129 — independent state-machines bookings vs assignments.** Affects C-01 design decisively.
4. **B-130 — master-plan vantage on C-05 is INVERTED.** User clarification needed before C-B plan-writing on C-05.

**W04 B-124 partial correction in §0** — keep both findings cross-referenced.

**Next workflow:** W06 — client creation + first booking. Tests `/admin/clients/new` → `/admin/clients/[id]` → `/admin/bookings/new?clientId=` prefill path (less-audited than the `?enquiryId=` path covered in W01).

**Bug index advance:** B-125 → B-130. Next available: B-131.

*End of W05 assignment-claim-reassign-flow audit.*
