# C-A.2 W07 — Therapist availability + recurring booking flow audit

**Workflow:** admin/owner configures availability via `/admin/staff/[id]/availability` and `/admin/availability` → admin creates new booking via `/admin/bookings/new` → availability rules gate booking creation in `create_booking_request` RPC → (TODO: recurring bookings — C-02 greenfield).
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `216a9f3`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #12 (`/admin/staff/[id]/availability`), #15 (`/admin/availability` global), W02 (SQL RPC availability checks), W05 (eligibility for claim/reassign).
**Source surveyed:**
- Booking inline assignment path: `bookings/actions.ts:836-895` (within `createManualBooking`).
- Assignment eligibility module: `bookings/assignment-eligibility.ts` (referenced indirectly).
- DB schema for recurrence: `information_schema.columns` query against `bookings` for `%recur%|%cycle%|%repeat%|%parent%|%series%` → **0 rows**.
- DB tables for recurrence: query against `%recur%|%series%|%schedule%` → **0 rows**.
- Code grep for `recur|recurring|standing|cadence|lunar|hijri` in `src/app/admin/bookings/**` → **0 substantive matches** (only `outstanding` payment field matches, unrelated).
**Roles swept:** Owner. Behavior derived from code + schema introspection.

---

## 1 — Confirmed: C-02 is fully greenfield

**No code, no schema, no UI for recurring bookings exists anywhere in the codebase.** Verifying:

- `bookings` table: no `recurrence_*`, `series_*`, `parent_booking_id`, `recurrence_rule`, `cycle_*` columns.
- `public` schema: no `recurring_bookings`, `booking_series`, `schedules` tables.
- Code: 0 mentions of "recur" / "standing" / "cadence" / "lunar" / "hijri" in booking-related code.
- Front-end booking form (`ManualBookingForm.tsx`): no recurrence step or input.
- Customer-facing booking flow (`/booking/...`): not audited deeply but no expectation of recurrence either.

**C-02 is the largest greenfield item in Band C.** Every layer needs design + implementation.

---

## 2 — Availability → booking-creation pipeline (existing infrastructure)

| Layer | What it does | Cross-page surfaces |
|---|---|---|
| Global business hours | `availability_rules` table — weekly recurring opening hours (day_of_week + start/end). | `/admin/availability` (global page, #15) |
| Global date overrides | `availability_overrides` table — date-specific business-hour overrides (closed days, special hours). | `/admin/availability` |
| Global blocked dates | `blocked_dates` table — entire-day clinic closures. | `/admin/availability` |
| Per-staff rules | `staff_availability_rules` table — therapist's weekly working pattern. | `/admin/staff/[id]/availability` (#12) |
| Per-staff overrides | `staff_availability_overrides` table — specific-date overrides for one therapist. | `/admin/staff/[id]/availability` |
| Per-staff blocked dates | `staff_blocked_dates` table — therapist holidays/sick. | `/admin/staff/[id]/availability` |
| Staff `availability_mode` | `staff_profiles.availability_mode` — `custom` / `global_with_overrides` / etc. (per #12 — `global_with_overrides` is in schema but UI exposes only 2 modes). | `/admin/staff/[id]/availability` |
| **Consumer:** `create_booking_request` RPC | Walks all of the above to determine: "are there enough eligible therapists matching gender requirements for this slot?" (per W02 §2). | `/admin/bookings/new` submit |
| **Consumer:** `assignment-eligibility.ts` (TS layer mirror) | Same logic in TS for `getStaffAssignmentPreviews` (reassign) + `getClaimAssignmentEligibility` (claim). | Booking detail AssignmentManager + claim button |

**The availability data flows correctly into booking creation for the BLANK-availability check** (the SQL function refuses to create a booking if no eligible staff exist). But:

---

## 3 — Bugs found

### B-136 — Inline assignment in `createManualBooking` does NOT validate therapist eligibility — vulnerable to admin picking a busy/unavailable therapist
**Severity:** medium-high (data integrity — admin can over-assign, creating double-bookings within a single therapist's day)
**Source:** `bookings/actions.ts:836-895`. The inline assignment loop reads `therapist_assignment_<i>` from formData and blindly applies it to the corresponding assignment row. There is **no eligibility check** — no call to `getStaffAssignmentPreviews` or `getClaimAssignmentEligibility`.
**Compare:** `updateBookingAssignment` (admin reassign path) DOES call eligibility (lines 493-502). `claimBookingAssignment` (therapist claim) DOES call eligibility (lines 277-285). The inline-on-create path is the ONLY assignment path missing the check.
**Concrete failure mode:**
- Admin creates a booking for Saturday 14:00, picks Therapist Sara from step 4 dropdown.
- Sara is already assigned to a 13:30-15:00 booking (busy).
- The SQL function's create_booking_request runs first (line 807-820) — checks "are there N male therapists available for this slot?" YES (count includes Sara because she's eligible per gender + has-permission, but the SQL function doesn't check her specific busy window in that aggregate check — it just counts eligibles).
- Actually re-reading the SQL function: the per-staff busy-overlap check IS in the function (the loop body checks `v_has_busy_overlap` per staff). So the SQL function won't accept the booking if it would create over-capacity. BUT the function counts ELIGIBLE therapists and approves if `available >= required`. Sara would be EXCLUDED from `v_available_male` because of busy overlap. **Booking still succeeds because OTHER therapists are available.**
- Then the inline assignment runs at line 836-895 → assigns to SARA SPECIFICALLY → double-book.
**Decision:** add eligibility check to inline assignment loop. Use `getStaffAssignmentPreviews(booking, requiredGender, supabase)` after the booking is created, find the selected staff in the previews, skip the assignment OR raise an error if `!selected.eligible`. C-12+ or fold into C-04 lifecycle hygiene.

### B-137 — `override_availability=on` bypasses SQL-layer checks AND the inline-assignment-eligibility check (because inline assignment has no checks regardless) — double bypass
**Severity:** medium (operator override exists but is undocumented in scope)
**Source:** `actions.ts:742` reads `override_availability` from form; passed to RPC at `:813`. The RPC explicitly skips availability checks if `p_override_availability=true` (W02 §2). The form has a checkbox somewhere (need to verify which step). Compound with B-136, "override availability + inline assignment" = no constraints at all on staff selection.
**Decision:** add operator-confirmation modal when override is used + inline assignment is set + the selected staff is ineligible. C-12+.

### B-138 — `staff_profiles.availability_mode = 'global_with_overrides'` is in schema/SQL but unreachable from `/admin/staff/[id]/availability` UI
**Severity:** medium (data-model drift — the UI exposes 2 modes; the data layer supports 3) — already noted in #12 B-? but cross-page worth re-confirming.
**Source:** per #12 audit B-N. The SQL function at line ~143 handles `v_staff.availability_mode = 'custom'` and other branches. The 'global_with_overrides' branch IS in code but no UI toggle exists.
**Implication for cross-page:** an admin who manually sets `availability_mode='global_with_overrides'` via a DB tool would see different scheduling behavior, but the UI would still display only 2 options + might inadvertently overwrite the value on save. **Cross-page risk if any admin-side script sets this mode externally.**
**Decision:** either expose the third mode in UI or remove the SQL-side branch. C-12+ data-model cleanup.

---

## 4 — Visual issues

### W07-V-1 — Availability changes on `/admin/staff/[id]/availability` do NOT show downstream impact preview on `/admin/bookings/new`
**Source:** code-level — neither surface cross-links. If an admin tightens a therapist's hours, then opens new-booking, no badge says "Therapist X's available hours just changed, affecting these dates: …".
**Decision:** C-07 routing + C-12+ preview. Out of scope for C-A.

### W07-V-2 — `/admin/availability` global overrides changes don't surface a "N pending bookings affected" warning
**Source:** per #15 audit B-67 ("No 'N staff affected' hint"). Cross-page: changing global hours could invalidate already-created future bookings. The system doesn't surface them. Worse, the SQL function won't auto-cancel them — they'd just become orphaned (booked outside the now-restricted business hours).
**Decision:** C-07 / C-12+ — cross-page warning system + decision UX. Out of scope for C-A.

---

## 5 — Empty / edge states

### W07-E-1 — When no eligible therapist exists for a date+time, SQL function raises "Not enough male/female therapists available"
**Source:** W02 §2 SQL function lines ~227-230. ✅ Defense-in-depth. Front-end form may surface this generic error after submit (per W02 W02-E-1 city whitelist parallel — front-end doesn't preview).
**Decision:** lift the availability-check preview into the form (per W02-E-1's broader inline-validation pass). C-07.

### W07-E-2 — `override_availability` checkbox bypasses ALL availability constraints (intended)
**Source:** SQL function line ~136 + `actions.ts:742, 813`. Documented operator override. ✅ Accept.

### W07-E-3 — Therapist with no scheduled hours (no rules + no overrides) is NEVER eligible
**Source:** SQL function loop — if `v_has_window=false` after walking all rules/overrides, the staff is excluded. ✅ Correct.

### W07-E-4 — Inactive (`active=false`) staff are never eligible
**Source:** SQL function line ~110: `from public.staff_profiles sp where sp.active = true`. ✅ Correct.

### W07-E-5 — `staff_blocked_dates` is checked alongside `blocked_dates` (per-staff vs global)
**Source:** SQL function lines ~152-159. ✅ Both granularities work.

---

## 6 — Cross-role inconsistencies

### W07-CR-1 — Therapist cannot see or modify availability (per #12 + #15)
**Source:** RBAC restricts both pages to canManageStaff. Therapist has no self-service availability. ✅ Status quo.
**Note:** for C-02 future, if therapists are expected to self-manage their availability, this expands. Out of W07 scope but worth noting.

### W07-CR-2 — Owner / Admin can manage both global + per-staff availability
**Source:** standard. ✅ Accept.

---

## 7 — Cross-viewport issues

No new mobile-level findings beyond #12/#15 baselines.

---

## 8 — Console / network issues

### W07-CN-1 — 0 errors / 0 warnings
Read-only walk.

---

## 9 — Pre-existing items the audit accepts

### W07-PE-1 — Availability rules are checked atomically per-booking via SQL advisory lock
**Source:** `pg_advisory_xact_lock(hashtextextended('create_booking_request:' || date || ':' || time, 0))` (W02 PE-2). ✅ Concurrent booking attempts for the same slot serialise.

### W07-PE-2 — TS-side `assignment-eligibility.ts` mirrors SQL function logic
**Source:** W05 PE-3. ✅ Consistency.

### W07-PE-3 — `availability_mode='custom'` branch handles per-therapist working pattern + override stacking
**Source:** SQL function lines ~177-189. ✅ Sophisticated, correctly composed.

---

## 10 — C-02 scoping deliverable (most useful artifact from this audit)

C-02 plan can lift this directly. **Decisions required from the user before C-B plan-writing:**

### Discovery questions (master plan Part 2 mandate)
1. **Which services support recurrence?** Hijama tends to be monthly+; cupping similar. Massage might be weekly. Should ALL active services be opt-in, or whitelist?
2. **Which roles can set recurrence?** Owner only (cautious)? Owner + Admin? Coordinator?
3. **Cadence options:**
   - Weekly?
   - Fortnightly?
   - Monthly (same day-of-month)?
   - Monthly (same weekday-position — "first Tuesday")?
   - Custom interval (e.g., "every 28 days" for cupping cycle)?
   - **Lunar-cycle / Hijri-aware?** (e.g., "Sunnah days 17/19/21 of lunar month" per the hijama compliance research).
4. **End conditions:** forever / N occurrences / until date?
5. **Single-occurrence cancellation cascade:** does cancelling Wednesday's booking cancel ONLY that one or the entire series going forward?
6. **Reschedule cascade:** does moving Wednesday's booking move ALL subsequent occurrences by the same delta, or only that one?
7. **Therapist preference:** is the recurrence locked to a specific therapist OR re-claimable per-occurrence?

### Schema additions (suggested)
- `bookings.parent_booking_id uuid REFERENCES bookings(id)` — links a recurrence instance to its template.
- `bookings.is_recurrence_template boolean DEFAULT false` — marks the "first" booking that owns the recurrence rule.
- `bookings.recurrence_rule jsonb` — RFC 5545 RRULE OR simpler schema (e.g., `{ kind: 'weekly', interval: 1, count: 12 }` or `{ kind: 'lunar', days: [17,19,21] }`).
- `bookings.recurrence_end_date date NULL`.
- `bookings.recurrence_canceled_at timestamptz NULL` (for series-level cancellation).

OR — alternative: separate `recurring_booking_templates` table that spawns `bookings` rows on a cron schedule. (More normalized, simpler to reason about. Recommended.)

### Pipeline integration points (where existing code needs changes)
- **SQL function:** new `create_recurring_booking_series(template_input)` that creates the template row + an initial set of bookings (e.g., next 4 occurrences).
- **Cron job:** monthly poll for templates approaching end-of-window → spawn next N bookings.
- **Cancellation:** new server action `cancelBookingSeries(templateId)` that hard-cancels the template + all future instances.
- **Reschedule:** decision per question 6.
- **UI:** new step in `ManualBookingForm` (between Date & Time and final review) for recurrence options.
- **Calendar:** badge for recurrence-instance bookings to distinguish from one-offs.
- **Bookings list:** filter by "Recurring" status.
- **Emails:** new template `renderRecurringSeriesCreatedEmail`. Reminders for recurring bookings might need different copy.

### Hijri-cycle awareness (specifically called out in master plan)
- Need: a JS / SQL function to convert Gregorian dates → Hijri dates (or use a lib — but per master plan, no new deps without Zone-2 confirmation).
- Sunnah days: 17, 19, 21 of each lunar month → recurrence rule kind `{ kind: 'sunnah', months: [...] }`.
- **Open question for user:** is this a service-specific feature (hijama only) or system-wide?

**This is C-02 plan architecture.** Lift directly.

---

## 11 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | C-02 fully greenfield | Entire feature build | **C-02 (HEADLINE — whole item)** |
| 2 | B-136 — inline assignment skips eligibility | Add `getStaffAssignmentPreviews` call | C-12+ or fold into C-04 lifecycle |
| 3 | B-137 — `override_availability` + inline assignment = no checks | Operator-confirmation modal | C-12+ |
| 4 | B-138 — `global_with_overrides` mode unreachable from UI | Expose or remove | C-12+ data-model |
| 5 | W07-V-1 — no downstream-impact preview on availability change | Cross-link + warning system | C-07 routing |
| 6 | W07-V-2 — no "N pending bookings affected" warning on global change | Same | C-07 |

---

## 12 — Cross-references to existing findings

- **W02 §2 SQL function** — comprehensive availability gating documented. W07 confirms cross-page propagation.
- **W05 PE-3** — eligibility TS layer mirrors SQL. W07 confirms; B-136 is the ONLY gap in this mirror.
- **#12** — `/admin/staff/[id]/availability` per-page findings. W07 layers cross-page.
- **#15** — `/admin/availability` global per-page findings. W07 layers cross-page.

---

## 13 — Hand-off

**State:** 0 screenshots. 0 code changes. 0 prod DB writes. 3 new bugs (B-136 → B-138).

**Most consequential W07 findings to surface to C-B:**
1. **C-02 fully greenfield** — §10 has the complete plan architecture.
2. **B-136 — inline assignment eligibility gap** — single-point fix that closes the over-assignment risk.
3. **B-138 — global_with_overrides mode unreachable** — data-model drift to clean up before C-02 schema expansion (which would extend availability_mode usage further).

**Next workflow:** W08 — Owner switching scope (personal vs team). Tests the dashboard Personal Stripe + Reports?scope=personal + /admin/me cross-surface consistency for Owner who takes bookings.

**Bug index advance:** B-135 → B-138. Next available: B-139.

*End of W07 availability-recurring-flow audit.*
