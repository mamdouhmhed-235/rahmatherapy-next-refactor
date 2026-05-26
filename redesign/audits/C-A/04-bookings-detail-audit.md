# C-A.1 #04 — `/admin/bookings/[bookingId]` audit

**Surface:** `/admin/bookings/[bookingId]` (booking detail — status & payment, notes, participants, assignment, email activity, audit log)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `edfe9e8`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `page.tsx` (1381 LOC), `BookingDetailSidebar.tsx`, `BookingCreatedToast.tsx`, `RescheduleResponseButtons.tsx`, `error.tsx`. Explore subagent surveyed; high-impact C-05 claims spot-verified at lines 787-791, 883-890, 1163-1172.
**Roles swept:** Owner @ 1280 confirmed-booking (id `da6912d5-49dc…`, status confirmed) + 375 confirmed. Cancelled-detail screenshot captured in #02 audit (`screenshots-02-bookings-list/owner-1280-cancelled-detail.png`) — referenced here. Therapist view of this detail page not swept (would require an assigned booking matching `test.therapist`'s gender + active state; Therapist view restrictions verified via code at `page.tsx:fullScope` predicate).
**Screenshots:** `redesign/audits/C-A/screenshots-04-bookings-detail/` — 2 PNGs.

---

## 1 — Bugs found

### B-15 — C-05 root cause is THREE distinct gating bugs on this surface, not one
**Severity:** high (the entire C-05 user item)
**Source — spot-verified:**

(a) **Claim button** (`page.tsx:787-791`):
```ts
const canClaim =
  isUnassigned &&
  canClaimAssignments(profile) &&
  assignment.required_therapist_gender === profile.gender &&
  claimPreview?.eligible === true;
```
No `booking.status` check. Claim button renders on a cancelled booking if assignment is unassigned + gender matches.

(b) **Mark complete** (`page.tsx:793-794` + `:799-801`):
```ts
const isAssignedToActor = assignment.assigned_staff_id === profile.id;
const isOwn = isAssignedToActor && assignment.status === "assigned";
// …
const canPromptForSessionNote =
  isAssignedToActor &&
  canCreateSessionNotes(profile) &&
  Boolean(booking.client_id);
```
Gates on `assignment.status === "assigned"` but NOT on `booking.status`. A cancelled booking can still be marked complete by the assigned therapist.

(c) **Reassign + Remove assignment** (`page.tsx:883-890`):
```tsx
{canReassignBookings ? (
  <AssignmentManager … />
) : null}
```
Predicate `canReassignBookings = fullScope && canAssignBookings(profile)` (line 319). No booking.status reference.

**Companion fix locations** (for C-C):
- Server: `actions.ts:269-275` (claimBookingAssignment) per #02 audit.
- Detail UI: lines 787-791 / 793-794 / 883-890 (this audit).
- Row-action UI: `BookingRowActions.tsx` claim button (per #02 audit B-04).

**Plan note:** the user wrote C-05 as a single bug, but the surface area is three predicate sites + one server action = four edits total to make cancelled bookings truly inert.

### B-16 — No state-machine on status transitions
**Severity:** medium (data hygiene)
**Source:** subagent `BookingManagementForm.tsx:576-591`. Status dropdown exposes all 5 values regardless of current state. Server validates the value is in the allowed set (`actions.ts:144-145`) but does not enforce transitions.
**Implications:** completed → pending is possible (resurrects a billed/sent-confirmation booking back into "pending" state). cancelled → confirmed is possible (which IS the de-facto restore mechanism for C-04 — but it's not labelled as such anywhere).
**Insight for C-04:** the restore-from-audit-log copy is misleading. The actual restore is "go to Status & payment, change status from Cancelled → Confirmed/Pending, save". The audit log is read-only. **C-04 plan should consider either:**
- (a) Adding an explicit "Restore booking" button that does the status flip with confirm dialog, or
- (b) Rewriting the copy to direct user to the Status panel instead of the audit log (which can't do anything).

### B-17 — No refund affordance
**Severity:** medium (operational gap)
**Source:** subagent `BookingManagementForm.tsx:305-377`. Payment amount is a manual number input. Workaround for refund: edit `amount_paid` back to 0 and add a note. No labelled refund flow.
**Carried over from:** master-plan Part 3 ("No refund workflow as an atomic action — currently distributed").
**Decision:** flag for C-12+ unless C-06 (delete/bulk delete) scope extends to refunds.

### B-18 — No "Resend email" affordance on failed email events
**Severity:** medium (operational gap, ties to C-08)
**Source:** subagent `page.tsx:939-1012`. Email activity panel displays `event_type`, `recipient_*`, `delivery_status`, `error_message` — read-only. A failed delivery has no remediation surface.
**Maps to:** C-08 (email templates + automation) — fold in.

### B-19 — Reschedule accept has no past-date validation
**Severity:** low (edge case)
**Source:** subagent `page.tsx:520-572` + `RescheduleResponseButtons.tsx`. The accept button POSTs `respondToCustomerReschedule` regardless of whether the customer's requested date is already in the past.
**Workflow note:** acceptance only records the decision; admin must manually move the date. So a past-date accept is logically possible but operationally moot. Still worth a UX hint.

### B-20 — `RescheduleResponseButtons.tsx:32-36` has an empty catch block
**Severity:** low (error visibility — toast shows generic message, server error not surfaced)
**Source:** subagent. Different from the intentional email-send catches in `actions.ts` (which log to console). Here the catch is fully empty.

### B-21 — `ClaimAssignmentButton.tsx:61` has `animate-spin` without `motion-reduce` guard
**Severity:** low (a11y consistency — same anti-pattern across the codebase)
**Source:** subagent.
**Note:** the same component DOES correctly use `motion-reduce` on its CSS transitions at lines 103-106 (`ClaimMark`). So the pattern is known to the author; just inconsistently applied.

### B-22 — Status labels triplicated across files
**Severity:** very low (maintenance debt, no user impact)
**Source:** subagent — `page.tsx:79-85`, `BookingManagementForm.tsx:37-43`, `BookingDetailSidebar.tsx:23-29` each independently define status label maps. Drift risk if one is updated.

---

## 2 — Visual issues

### V-11 — H1 reads as raw booking ID prefix only — e.g. "#DA6912D5"
**Source:** verified at confirmed booking detail. The H1 element on `/admin/bookings/da6912d5-…` reads `"#DA6912D5"`. The client name + service appears below as a subtitle.
**Question for C-B:** is the ID-as-H1 the intentional design (booking-as-ticket framing) or should the client name be the primary heading with the ID demoted? Most CRMs put the human name first. Worth raising during C-07 (routing) or C-12+ polish.

### V-12 — Audit log capped at top 20 events with no pagination
**Source:** subagent `page.tsx:356-386`. For an actively-managed booking (status changes, reassigns, reschedules, payments, note edits) the log can exceed 20 quickly. Older events become invisible.
**Maps to:** C-09 (pagination + scale-aware design).

### V-13 — On mobile (375), the sidebar (client info + visit location + price) flows BELOW the main panels rather than above
**Source:** `BookingDetailSidebar.tsx` per subagent — `md:sticky md:top-4` only; mobile order is default DOM order (which puts main panels first).
**UX implication:** therapist on mobile checking client phone/address has to scroll past Status & payment + Notes + Participants + Assignment + Email activity before reaching the sidebar.
**Decision:** worth reordering for mobile-first ergonomics. Flag for C-12+ mobile polish or fold into C-07.

---

## 3 — Empty / edge states

### E-12 — Cancelled-booking "Next" strip shows the right tone + copy
**Source:** spot-verified at `page.tsx:1163-1172`:
```ts
if (booking.status === "cancelled") {
  return {
    tone: "danger",
    icon: ShieldX,
    headline: "This booking is cancelled.",
    hint: "Restore it from the audit log if it was cancelled by mistake.",
  };
}
```
**Mis-hint:** the audit log can't restore; only the Status & payment form can (see B-16). Copy lies about the affordance. ⚠️ Action item for C-04.

### E-13 — `Email activity` panel is non-empty even on a quiet booking (because confirmation emails fire on create)
**Source:** subagent. Renders every email_delivery_event from creation onward. Good for trust — admin can see the chain of communication.

---

## 4 — Cross-role inconsistencies

### CR-12 — Therapist sees a narrower detail page (no audit log, no admin notes, no full status & payment form)
**Source:** subagent — `fullScope = canManageAllBookings(profile)` gates the audit-log panel (`page.tsx:500`), admin-notes editing, and parts of Status & payment. Therapist sees: client name + visit location + their assignment row + treatment-note prompt.
**Status:** intended RBAC narrowing. ✅ Accept.

---

## 5 — Cross-viewport issues

### CV-10 — Confirmed-booking detail at 1280 fits 6 sections (Status & payment / Notes / Participants / Assignment / Email activity / Activity) + sidebar. docH ≈ 2917 px. ✅ Reasonable.
### CV-11 — At 375, sidebar order (V-13) is the main thing. Otherwise reflow is clean. ✅
### CV-12 — Cancelled detail at 1280 (captured in #02 as `owner-1280-cancelled-detail.png`) — banner sits cleanly above Status & payment form; assignment manager + audit log + email activity all render below. ✅

---

## 6 — Console / network issues

### CN-11 — 0 errors / 0 warnings on confirmed-booking load
### CN-12 — Same persistent Sentry tunnel 308 + Next.js font-preload warnings as documented previously. No new issue.

---

## 7 — Pre-existing items the audit accepts

### PE-14 — Email-send catch blocks in `actions.ts:216,223` are intentional fail-safe
*(Already accepted in #02. Restated for cross-reference.)*

### PE-15 — Top-20 audit log limit is acceptable at current scale (avg booking probably has 3–10 events)
**Decision:** real but not biting. Flag for C-09 only if it becomes a pattern.

### PE-16 — H1-as-ID may be intentional design choice (ticket / case-id semantics)
**Decision:** leave to C-B planning to disambiguate.

### PE-17 — Therapist's narrower view of the detail page is intended RBAC
**Source:** `fullScope` predicate. Accept.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-15 — three predicate sites + one server action for C-05 | Full inert-cancelled discipline | C-05 |
| 2 | B-16 + E-12 — restore-via-audit-log is misleading; status flip is the actual restore | Add explicit "Restore" button OR rewrite hint | C-04 |
| 3 | B-17 — no refund affordance | Atomic refund flow | C-12+ (or fold into C-06) |
| 4 | B-18 — no "Resend email" on failed delivery | Resend button on email-activity rows | C-08 |
| 5 | B-19 — past-date reschedule accept | UX hint when past | C-12+ |
| 6 | B-20 — empty catch in `RescheduleResponseButtons.tsx:32-36` | Surface server error to toast | C-12+ |
| 7 | B-21 — `animate-spin` in ClaimAssignmentButton.tsx:61 | Add `motion-reduce` guard | C-11 design-system pass |
| 8 | B-22 — status labels triplicated | Move to shared `bookings/types.ts` constant | C-12+ |
| 9 | V-11 — H1 is "#XXXXXXX" rather than client name | C-B disambiguates | C-07 routing or C-12+ |
| 10 | V-13 — mobile sidebar order | Reorder or use `flex-col-reverse md:flex-row` | C-12+ mobile polish |

---

## 9 — Hand-off

**State at end of audit:**
- 2 screenshots captured (confirmed 1280 + 375). Cancelled-detail @ 1280 referenced from #02.
- 0 code changes.
- C-05 = 4 distinct edits (3 UI predicates + 1 server action). C-04 = "restore via audit log" copy is misleading; the actual restore mechanism is the Status panel.
- Browser still signed in as Owner.

**Next surface:** #05 `/admin/clients` (list) — medium priority, less RBAC complexity than bookings.

*End of bookings-detail audit.*
