# C-23 — Availability-aware calendar on the admin create-booking page

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Predecessors:**
- User direction 2026-07-16: bring the public flow's "no-guessing availability" idea to `/admin/bookings/new` — the calendar itself shows which days are bookable instead of staff clicking dates one at a time. Explicit instruction: **reuse the shared engine rather than duplicating logic**, and judge which parts translate.
- **Reference implementation:** `redesign/start-state` commit `0325838` — `src/lib/booking/availability.ts` (engine refactor + `calculateAvailableDays`), `src/app/api/availability/month/route.ts`, `ScheduleStep.tsx`, `DatePickerField.tsx`. **Not on master.** **Amended 2026-07-26 (C23-F5, verifier-CONFIRMED): now ON master — the `redesign/start-state → master` merge (`ea97932`) carried `0325838`; master and start-state are byte-identical on these paths (empty diff, verified twice). The plan's Phase A is verify-only.**
- Code audit 2026-07-16 of `src/app/admin/bookings/new/ManualBookingForm.tsx` (2,019 lines) — findings in §2, and they materially reshape the naive port.
**Companion files:**
- Plan: `redesign/plans/C-phase/C-23-admin-availability-calendar-plan.md`
- Progress: `redesign/per-page-progress/C-23-admin-availability-calendar-progress.md` (filled during C-C)

---

## 0 — TL;DR

Staff currently discover admin availability by trial and error: pick a date → wait → "No therapists available on this date" → pick another. C-23 makes the admin calendar **show** which days can be served, before any click.

Five phases: **port the engine refactor to master byte-identically** (it is a verified conflict-free port, and porting *reduces* the risk of the eventual `redesign/start-state → master` merge) → **admin-scoped month endpoint** with relaxed rules via an additive options bag → **admin calendar component** that informs but never blocks → **wire into the existing three date-input branches without changing any submitted data** → verify month-vs-day equivalence.

*Amended 2026-07-26 (C23-F1/F5): the merge already happened (`ea97932`) — the port phase is already satisfied (master ↔ start-state byte-identical on both files, verified twice). Phase A collapses to a read-only identity assertion; the remaining four phases stand. Note the risk-posture change: the engine + `/api/availability/month` now serve the LIVE public customer calendar (see §4.1 wrapper).*

**The governing constraint (user direction 2026-07-16): change nothing that already works.** No new form state, no second date, no removed override paths, no altered payload. C-23 changes *how staff see* dates, not what the form submits.

---

## 1 — Why (the current experience)

`ManualBookingForm` step 3 offers a native `<input type="date">`. Choosing a date fires `checkAvailability(date)` → `POST /api/availability` → either a slot row or *"No therapists available on this date. Pick another date, or override."* ([:1461](src/app/admin/bookings/new/ManualBookingForm.tsx)). Finding a bookable day for an awkward gender mix or a busy week is pure trial and error — every attempt a round-trip. The public flow solved exactly this on `redesign/start-state`; the engine work needed is already written and live-verified there.

---

## 2 — Audit: what the admin form actually is (and must keep being)

Six findings, each of which changes the naive port:

| # | Finding (verified 2026-07-16) | Consequence for C-23 |
|---|---|---|
| 1 | **One shared `bookingDate` state** ([:533](src/app/admin/bookings/new/ManualBookingForm.tsx)), one hidden `booking_date` ([:961](src/app/admin/bookings/new/ManualBookingForm.tsx)), one shared `startTime` ([:534](src/app/admin/bookings/new/ManualBookingForm.tsx)) | **Exactly one calendar.** A second date would change submitted data and break the shared start time. Mixed-gender groups get **two marker sets on one calendar**, not two calendars. |
| 2 | **Three mutually-exclusive branches render the same date input**: single/same-gender ([:1445](src/app/admin/bookings/new/ManualBookingForm.tsx)), mixed-gender ([:1498](src/app/admin/bookings/new/ManualBookingForm.tsx)), **fallback** ([:1630](src/app/admin/bookings/new/ManualBookingForm.tsx)) used when `!canCheckAvailability` or `overrideAvailability` | All three must survive. The fallback branch has **no availability data by definition** — it degrades to today's plain input (or an unmarked calendar), never to a broken one. |
| 3 | **`overrideAvailability` + per-cohort `femaleOverride`/`maleOverride` skips** feed a hidden `override_availability` ([:963-964](src/app/admin/bookings/new/ManualBookingForm.tsx)) | The calendar **informs, never blocks**. Public disables full days; admin must keep **every** date selectable — staff deliberately book unavailable days and let a therapist claim. |
| 4 | **`canCheckAvailability` gate** ([:666](src/app/admin/bookings/new/ManualBookingForm.tsx)): city ≥ 2 chars + a gendered participant + services chosen for every participant | The month fetch reuses this exact gate — no new preconditions, no fetch before the engine could answer meaningfully. |
| 5 | Date inputs carry `min={today}` and no upper bound | Preserve: no past dates; **no customer booking-window ceiling** (admins may book beyond it — see §3). |
| 6 | Mixed-gender path runs **two per-day fetches** (female cohort, male cohort) against one date, rendering two slot sections that share one `start_time` | The month layer mirrors this shape: **two month fetches, two marker sets, one calendar** — the existing per-day sections below are untouched. |

**Explicit non-removal list** (these must be byte-for-byte intact at sign-off): shared `bookingDate`/`startTime` state · hidden `booking_date` + `override_availability` inputs · all three date-input branches · override toggle + both cohort skips · `canCheckAvailability` semantics · per-day `/api/availability` fetching and slot buttons with `slotLabel` staff counts · `min=today` · `setStartTime("")` on date change · step-3 gate (`bookingDate && startTime`) · draft persistence.

---

## 3 — Why admin needs its own endpoint (not `/api/availability/month`)

The public month route is unauthenticated and inherits two customer-facing guards from `calculateAvailableDays`: `booking_status_enabled` (the public pause) and `isDateInBusinessWindow` (the customer booking window). Both are wrong for staff:

- With public booking **paused**, the admin calendar would show a blank month — while therapists are demonstrably free.
- Beyond the customer window (e.g. 90+ days out), staff legitimately take bookings; the engine would report `hasSlots: false` for days that are genuinely open.

**Resolution (user-approved 2026-07-16):** a small **additive, defaulted options bag** on `calculateAvailableDays` (`ignoreBookingWindow?`, `ignorePublicPause?`, alongside the existing `now?`) plus a **new authenticated admin route**. Every existing caller keeps current behaviour by omission. One engine, two policies — no duplicated logic (the user's explicit requirement).

---

## 4 — Scope

### 4.1 Phase A — Port the engine to master (prerequisite, zero behaviour change)

> ✅ **VERIFY-ALREADY-IMPLEMENTED (2026-07-26)** — the build at `ea97932` already implements this phase (C23-F1, verifier-CONFIRMED twice: `git diff master redesign/start-state --stat` on both paths → empty; C23-F5: the merge carried `0325838` onto master). Executor: run the plan's pre-flight #3 read-only identity assertion instead of the checkout below — do NOT run the tree-mutating `git checkout`. The final paragraph of this section is INVERTED (C23-F2): `/api/availability/month` is ALREADY live and customer-facing — the shipped public booking flow's `ScheduleStep.tsx:94-104` POSTs it (unauthenticated, service-role client); any engine/route edit touches production customer behaviour now. Original text preserved below for reference.

`git checkout redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/month/` — **byte-identical**.

Verified 2026-07-16: master's `availability.ts` has been untouched since the fork (`02951a2`); start-state's only change is `0325838`. The branches therefore differ on that file by *exactly* the refactor — the port is conflict-free, and because it is identical, the eventual `redesign/start-state → master` merge sees **no divergence** on these files instead of a 469-line conflict. **Porting de-risks the planned merge.**

Refactor shape (unchanged from the reference): `loadSettings` → `loadContextRest` (date-independent context) → `loadDayRecords(dates[])` (batched) → `computeDaySlots` (pure per-date). `calculateAvailableSlots` keeps its exact contract — the existing per-day admin and public callers are unaffected.

**On master after Phase A, `/api/availability/month` exists but only the admin route calls it** (the public frontend that consumes it lives on start-state). Harmless and intentional; it becomes live for customers on the eventual merge.

### 4.2 Phase B — Admin month endpoint

`POST /api/admin/availability/month` (or a server action — plan decides): staff session + booking-create permission, same zod payload as the public route plus the cohort's `participantGenders`, calling `calculateAvailableDays` with `{ ignoreBookingWindow: true, ignorePublicPause: true }`. Returns `{ days: [{date, hasSlots, slotCount}] }`.

### 4.3 Phase C — Admin calendar component

New admin component built on `react-day-picker` — **already a dependency and already used in admin** ([CalendarDatePopover.tsx](src/app/admin/calendar/CalendarDatePopover.tsx)), so no new package and an existing house idiom (`--admin-*` tokens, `h-11` targets, popover shell) to match.

- **Marks, never disables.** Days with availability get a clear marker; days without are visibly de-emphasised but remain fully selectable (finding 3). The only floor is the existing `min=today`.
- **Mixed-gender: two marker sets, one calendar** — a day reads *both cohorts servable* / *one cohort only* / *neither*, so staff see at a glance that e.g. Tuesday works for the female participants but needs a male therapist to claim. The existing two per-cohort slot sections below are untouched.
- **Legend + one-line hint** explaining the markers, in admin copy.
- Month navigation triggers a fetch; per-month cache keyed `month|services|genders|city` with `AbortController`, lifted from the reference.
- Direct date entry preserved alongside the calendar — staff usually have a customer's requested date in hand.

### 4.4 Phase D — Wire into the three branches

Single/same-gender first (one month fetch), then mixed-gender (two month fetches, per-cohort markers), then confirm the fallback branch degrades cleanly. **No change to form state, payload, validation, or step gating.**

### 4.5 Deliberately NOT ported

- **Auto-select the first available day.** Public auto-selects to spare a stranger a click; an admin usually has a *requested* date in hand, and auto-jumping months would fight the operator and silently overwrite a date they just typed.
- **Disabling full days** (finding 3).
- **Auto-hop to next month when empty** — same reasoning; the calendar reports emptiness, the operator decides.
- Any change to the public flow — the public frontend stays on `redesign/start-state`. *(Amended 2026-07-26, C23-F5: the public frontend now lives on `master` — the 4-step dialog flow shipped with `ea97932`. The constraint stands unchanged: C-23 still touches nothing in the public flow.)*

---

## 5 — States & edge cases

- **5.1 `canCheckAvailability` false** (no city / no services / no gendered participant): no month fetch, no markers — plain calendar. Matches today's behaviour exactly.
- **5.2 Override on:** availability sections hide today; the calendar stays available and unmarked (or marked if data is cached) — never blocks.
- **5.3 Month fetch fails / aborts:** calendar renders unmarked; the per-day check on selection remains the source of truth. Availability is *hinting*, never gating.
- **5.4 Inputs change mid-month-view** (city edited, service swapped, participant gender flipped): cache key changes → refetch; stale responses discarded via AbortController.
- **5.5 Selected date becomes unmarked after an input change:** the selection is **kept** (never auto-cleared) — the per-day check speaks on submit; silently moving a staff member's chosen date is worse than showing it unmarked.
- **5.6 Marker vs per-day disagreement** (booking taken between fetches): the per-day check on selection wins; the month view is a hint that refreshes on month change. Documented, not defended against.
- **5.7 Past dates:** unchanged — `min=today` floor preserved.
- **5.8 Beyond the customer booking window:** days show true therapist availability (§3) — an admin capability the public deliberately lacks.

---

## 6 — Migration / dependencies

**No database migration. No new package.** One engine options extension (additive, defaulted). One new admin route. Bundle: calendar + month-cache logic on `/admin/bookings/new` only — **ceiling +6 kB** on that route.

---

## 7 — Sequencing and cross-plan coordination

- **Independent** of every other plan; Phase A carries its own prerequisite. Ships anytime.
- **C-14** — its Phase C/D edit `availability.ts` (the RECON-sensitive engine). After C-23 Phase A, that file is the refactored version: C-14's Phase C override-fetch widening (`.maybeSingle()` → array) now applies inside `loadDayRecords`/`loadContextRest`, and Phase D's `getBookingDateBounds` refactor sits alongside the new options bag. **Whichever ships second re-reads the other's changes** — noted in both plans. *(Updated 2026-07-26, C23-F7: the file is ALREADY the refactored version on master independent of C-23 — C-14's "if C-23 landed first" branch is unconditionally active, and its "re-plan Phase A as a merge" branch is impossible. Serialization, Owner-approved: C-23 Phase B lands BEFORE C-14's engine phases — noted in both plans.)*
- **C-20 / C-06 Step 13 / C-02 Phase E** — all touch `ManualBookingForm.tsx` in different regions (address fields, email-optional, recurring section) vs C-23's step-3 date area. Coordinate commit order only.
- **C-22** *(added 2026-07-26, D23 — Owner-approved)* — C-22 adds per-IP rate limiting to the public `POST /api/availability` + `POST /api/availability/month` routes; C-23's new authenticated admin month route is NOT rate-limited by it. Same route files as C-23's engine surface — coordinate in one window, re-grep anchors if the other has landed.
- **Branch strategy** — Phase A is a *strict subset* of what the eventual `redesign/start-state → master` merge would bring, applied identically, so it reduces that merge's surface rather than adding to it. *(Superseded 2026-07-26, C23-F5: that merge has already happened — `ea97932`. There is no pending merge left to de-risk; Phase A is verify-only.)*

---

## 8 — Acceptance criteria

1. Admin step 3 shows a calendar marking days with matching availability; days without are visibly distinct **and still selectable**.
2. Mixed-gender groups show both cohorts' availability on the one calendar; the existing two slot sections below are unchanged.
3. **Nothing removed:** every item on the §2 non-removal list verified present and working (override toggle, both cohort skips, fallback branch, per-day slots, `min=today`, step gating, draft persistence).
4. Submitted payload byte-identical to today for the same inputs (`booking_date`, `start_time`, `override_availability`) — proven by comparing a before/after submission.
5. `calculateAvailableSlots` behaviour unchanged on master (existing per-day admin + public checks unaffected by the port).
6. Month summary agrees with the per-day endpoint for sampled dates, including a fully-booked day and a no-matching-therapist day.
7. Admin sees availability **beyond** the customer booking window and **while public booking is paused**; the public route's behaviour is unchanged in both cases.
8. `canCheckAvailability` false → no fetch, plain calendar, current behaviour.
9. Ported files are byte-identical to `redesign/start-state` (verified by diff).
10. Static gates pass; +6 kB ceiling; no new package; no migration.

---

## 9 — Out of scope

- Any change to the public booking flow or its components.
- Auto-select / auto-hop (§4.5).
- Showing *which* therapist is free, or capacity counts, on the calendar — the per-day slot rows already carry staff counts via `slotLabel`.
- Extending the day summary with reason codes ("closed" vs "fully booked" vs "no gender match") — attractive, but it widens the shared engine's contract; C-12+ if wanted.
- Admin calendar page (`/admin/calendar`) — different surface, untouched.
- Recurring-series availability preview (C-02 territory).

---

*End of C-23 brief. Plan: `redesign/plans/C-phase/C-23-admin-availability-calendar-plan.md`.*
