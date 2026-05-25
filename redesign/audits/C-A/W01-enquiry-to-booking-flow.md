# C-A.2 W01 — Enquiry → Booking conversion flow audit

**Workflow:** enquiry row "Convert" → `/admin/bookings/new?enquiryId=…` (prefilled form) → `createManualBooking` server action → `/admin/bookings/[bookingId]` (detail of newly-created booking)
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `7d9e732`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #08 (`/admin/enquiries`), #03 (`/admin/bookings/new`), #04 (`/admin/bookings/[bookingId]`).
**Source surveyed:** `src/app/admin/enquiries/EnquiryList.tsx` (Convert button render + selectability guard), `src/app/admin/enquiries/actions.ts` (status vocabulary + `updateEnquiryStatus`), `src/app/admin/enquiries/page.tsx` (tab filter logic), `src/app/admin/bookings/new/page.tsx` (enquiry fetch + `prefillFailed` signal), `src/app/admin/bookings/new/ManualBookingForm.tsx` (hidden input plumbing + toast copy), `src/app/admin/bookings/actions.ts` (the `if (enquiryId)` enquiry update block at 897–926).
**Roles swept:** Owner @ 1280. Coord skipped — `canManageAllBookings` is predicate-equivalent per #03 CR-10. Therapist excluded — blocked at /admin/enquiries page middleware per #08 CR-17.
**Screenshots:** 2 PNGs in `screenshots-W01-enquiry-to-booking/`.
**DB state surveyed:** 3 enquiries total in production. 1 convertible (`Audit Enquiry Two`, status="new", `converted_booking_id=null`). 2 closed (`Audit Enquiry One`, `Phase10 E2E Enquiry`). 0 currently-converted enquiries — couldn't test the **already-converted** stale-URL case live; reasoned from code instead.
**No submit performed.** Per master plan scope clarification 3 (no Zone-2 ops during C-A), I walked the conversion form up to step-1 prefill verification + edge cases, but did not submit (which would have created a real booking + potentially fired emails).

---

## 1 — Workflow steps walked

| Step | Action | Observed |
|---|---|---|
| 1 | `/admin/enquiries` — locate convertible enquiry | "Convert" button renders only on rows where `status ∈ {new, contacted}` and `converted_booking_id IS NULL`. Verified live: Audit Enquiry Two ("new") shows Convert; Audit Enquiry One ("closed") + Phase10 E2E ("closed") do not. ✅ |
| 2 | Click "Convert" link | Hard navigation to `/admin/bookings/new/?enquiryId=59e3d933-…`. ✅ Matches `EnquiryList.tsx:522` href. |
| 3 | Form step-1 prefill render | Confirmed prefilled live: `enquiry_id` hidden input ✅, `full_name` ✅, `phone` ✅, `booking_source=whatsapp` ✅, `participant_name_0` ✅, `customer_notes = service_interest + "\n\n" + notes` ✅. **4 visible "From enquiry" badges** matched the prefilled visible fields. |
| 4 | Form fields that should be prefilled but aren't | `email` blank (enquiry was phone-only) ✓ expected. `participant_gender_0` blank (enquiry has no gender) ✓ expected. **Service NOT pre-selected** — `pkg_radio_0` radios all unset despite `service_interest="Supreme Combo Package"` matching a literal package option (confirms C-A.1 #03 V-08, the only outstanding C-03 gap). |
| 5 | Stale `enquiryId` URL | Cleared session-storage then `?enquiryId=00000000-0000-0000-0000-000000000000`. Form rendered empty, hidden `enquiry_id` empty (server cleared), and toast fired — but with WRONG copy (see B-104). |
| 6 | Cancel / Back behavior | Cancel button href = `/admin/bookings/` (the bookings LIST, not back to the originating enquiry). No back-link to `/admin/enquiries/59e3d933-…` anywhere on the form. |
| 7 | Reverse-link from booking detail | Grep across `src/app/admin/bookings/[bookingId]/**` for `converted_booking_id` / "enquiry" returned **zero matches**. The booking detail surface has no UI affordance pointing back to the originating enquiry. Bidirectional link is one-way (enquiry → booking exists at EnquiryList.tsx:488; booking → enquiry does not exist). |
| 8 | Server-side conversion side-effects (read from code) | On successful booking create, the server: (a) updates enquiry `status="booked"` + `converted_booking_id=bookingId` at actions.ts:904–908, (b) writes `enquiry_converted_to_booking` audit log at :914–921, (c) `updateTag("report-data" + "dashboard-data")` + `revalidatePath("/admin/enquiries")` at :923–925. Then sends booking emails (if checkbox on) + redirects to `/admin/bookings/[id]` at :952. |

---

## 2 — Bugs found

### B-104 — Toast copy says "client details" even when prefill failure is for an enquiry
**Severity:** medium (user-facing UX — misleading copy on the wrong workflow)
**Source:** `ManualBookingForm.tsx:786` — hardcoded `toast.warning("Couldn't load client details. Fill in manually.", ...)`. The `prefillFailed` server signal is set whenever EITHER `?clientId=` OR `?enquiryId=` fails (page.tsx:78–80), but the toast text is fixed to "client details" regardless of which path failed.
**Repro:** Sign in → navigate to `/admin/bookings/new?enquiryId=00000000-0000-0000-0000-000000000000` → toast says "Couldn't load client details." Misleading — the user came from the Convert button on an enquiry and never intended to load a client.
**Decision:** lift to C-07 (routing) or fold into a C-12+ copy pass. One-line fix — make the toast text conditional on which signal source failed.

### B-105 — Stale-prefill toast fires TWICE on a single render
**Severity:** low (duplicate notification noise)
**Source:** observed live — `Array.from(document.querySelectorAll('[role="status"], [role="alert"], [aria-live]'))` returned the same "Couldn't load client details. Fill in manually." string twice. Likely React 19 strict-mode double effect or a non-idempotent `useEffect` on the `prefillFailed` prop. Same pattern hazard as documented for other one-shot effects in B-band fixes (cf. B-2 idempotent guards).
**Decision:** wrap the effect in a `useRef` guard or migrate to a single toast emission point.

### B-106 — `/admin/bookings/new` does NOT guard against re-converting an already-converted enquiry
**Severity:** medium (data hygiene — silent double-conversion)
**Source:** `page.tsx:54–60` fetches the enquiry by id without checking `converted_booking_id`. The form will happily render with prefill from an enquiry that already has a `converted_booking_id` set. On submit, `actions.ts:904–908` will OVERWRITE `enquiry.converted_booking_id` with the new booking's id, orphaning the previous booking's link to the source enquiry (the previous booking still exists in `bookings`, just no longer reachable via `enquiry.converted_booking_id`).
**Repro:** (couldn't test live — no currently-converted enquiry exists in the DB) construct URL `/admin/bookings/new?enquiryId=<already-converted-enquiry-id>` and submit. Both bookings will exist; only the most-recent one will be linked.
**UI-layer protection:** EnquiryList.tsx hides the Convert button for already-converted rows (line 485 conditional). So the only way to reach this state is **stale URL** (e.g., bookmark, browser-back, or hand-constructed link). But it IS reachable — server should defensively block.
**Decision suggested:** at page.tsx level, redirect to `/admin/bookings/<converted_booking_id>` if the enquiry already has one set — with a toast explaining the redirect. Or surface a banner "This enquiry has already been converted on <date> — view that booking instead?". C-03 plan should cover this.

### B-107 — Partial-state hazard: enquiry-update is not transactional with booking creation
**Severity:** medium (data integrity — silent inconsistency under transient DB error)
**Source:** `actions.ts:807–820` creates the booking via `createBookingTransaction`. Lines 897–926 update the enquiry AFTER, with no `.single()` error guard and no rollback. If the enquiry `SELECT` or `UPDATE` throws (network blip, row-locked, etc.), the error propagates through the outer `try/catch` at :953 which ONLY catches `BookingCreationError` — anything else re-throws at line 958. Net result: booking exists, enquiry not marked, user sees a 500 / generic error and may re-submit, **creating a duplicate booking**.
**Same severity-of-consequence as B-04** (C-05 server-action gate bug from #02).
**Repro window:** narrow — requires the enquiry update to fail in the gap between booking commit and enquiry commit. Not easily reproducible in a healthy dev env. **But it's a real race.**
**Decision:** wrap the booking + enquiry update in a single Postgres function (similar pattern to `createBookingTransaction`), OR catch + log the enquiry-update error and still redirect to the booking (so the user doesn't double-submit). C-03 or C-12+.

### B-108 — Booking detail has no link back to the originating enquiry (one-way bidirectional gap)
**Severity:** medium (workflow continuity — once converted, the enquiry "context" is lost)
**Source:** `grep -r "converted_booking_id\|enquiry" src/app/admin/bookings/[bookingId]` returns zero matches. The booking detail page never queries the enquiry that spawned it, never shows "Converted from enquiry on <date>", never offers a link back.
**Cross-references:** Enquiry → booking direction works (`EnquiryList.tsx:488` `View booking` link on converted rows). Reverse direction broken.
**Implication for C-07 (routing):** the recurring complaint of "feels rudimentary" is concretely reproducible here. After converting, the only way to get back to the enquiry is via the global Enquiries nav → list → find by name. The bookings detail surface should at least render an "Originated from enquiry: <name>" pointer (from a `bookings.enquiry_id` column OR by reverse-lookup on `enquiries WHERE converted_booking_id = booking.id`).
**Decision:** addressed by C-07 routing plan; spec the bidirectional link as a deliverable. May also need a schema decision: add `bookings.enquiry_id` for the forward pointer, or keep relying on the reverse-lookup query.

### B-109 — "Reopen as new" on a converted enquiry doesn't clear `converted_booking_id` — leaves UI in an inconsistent state
**Severity:** low–medium (data hygiene + UX consistency)
**Source:** `actions.ts updateEnquiryStatus` (lines 116–170 ish) accepts a new status and updates `enquiries.status` plus optional `first_contacted_at` — **does not touch `converted_booking_id`**. The "Reopen as new" affordance from `EnquiryList.tsx:501` flips status to "new" but the enquiry retains its `converted_booking_id`. Because `EnquiryList.tsx:92` overrides the badge label based on `converted_booking_id` (priority over `status`), the badge **still shows "Converted"** despite the status now being "new".
**Implication:** the button looks like it does something but produces no UI-visible change. Stealthy no-op.
**Decision:** either (a) hide the Reopen button when `converted_booking_id` is set (cleaner UX), or (b) make Reopen also clear `converted_booking_id` and write an audit row. (a) is safer because clearing the link silently orphans the booking's enquiry reverse-pointer (which we're also trying to introduce per B-108). Surface for C-12+ or C-06.

---

## 3 — Visual issues

### W01-V-1 — Cancel button on conversion form routes to `/admin/bookings/`, losing the user's enquiry context
**Source:** verified live — cancel `<a>` href reads `/admin/bookings/`. If the user came from the Convert button on an enquiry and changes their mind, they land on a generic bookings list, not back at the enquiry they were converting.
**Pairs with B-108 + C-07 (routing).** The form should know about its referer enquiry and route Cancel back to either `/admin/enquiries/` (with a `?focus=<enquiryId>` hint) or `/admin/enquiries/<id>` if a per-enquiry detail route exists.

### W01-V-2 — `customer_notes` prefill format is brittle when one side is empty
**Source:** `ManualBookingForm.tsx:514–525` (per #03 audit subagent) — prefill builds `customer_notes` as `service_interest + "\n\n" + notes`. Live verification: when both are set you get `"Supreme Combo Package\n\n[AUDIT...] WhatsApp enquiry"`. When notes is empty you get `"Supreme Combo Package\n\n"` (trailing blank lines). When service_interest is empty you get `"\n\n[notes...]"` (leading blank lines).
**Severity:** very low (cosmetic). One-line fix — strip empty parts before joining. C-12+ or C-03 cleanup.

---

## 4 — Empty / edge states

### W01-E-1 — Stale (deleted / non-existent) `enquiryId` URL is handled correctly server-side, modulo B-104 toast copy
**Source:** verified live with id `00000000-0000-0000-0000-000000000000`. Server-side: form renders empty, `enquiry_id` hidden input is EMPTY (not the bogus id), so a subsequent submit creates a normal manual booking with no enquiry side-effect. ✅ Defense-in-depth at the data plumbing layer. Toast fires (B-104 copy bug aside).

### W01-E-2 — sessionStorage auto-save **persists across enquiry-conversion sessions** — silent data carryover
**Source:** verified live. After loading `/admin/bookings/new?enquiryId=<X>` and beginning a conversion, then navigating to `/admin/bookings/new?enquiryId=<Y>` (different enquiry) — the form restored fields from the X conversion draft, NOT from Y. The `enquiry_id` hidden input correctly switched to Y, but the visible prefilled fields showed X's data.
**Implication:** if a user starts a conversion, abandons it, and later opens a DIFFERENT enquiry's conversion link, the form will show the wrong client's name/phone with no warning. They could submit Y's enquiry_id wired to X's contact details.
**Severity:** medium (data quality). Pairs with B-9 from #03 (no duplicate-client guard) — together they create a real path to orphaned/mislabeled client records.
**Decision suggested:** when prefilling from a NEW source (different `clientId` or `enquiryId`), clear the saved draft before restoring. Or scope the draft cache key by `clientId` / `enquiryId`. C-03 or C-12+.

### W01-E-3 — Status vocabulary indirection: DB has `booked`, UI shows `Converted`
**Source:** `actions.ts ENQUIRY_STATUSES = ["new", "contacted", "booked", "closed"]` (line 17). The "Converted" tab + badge derives from `converted_booking_id IS NOT NULL`, not from `status` (page.tsx:194, EnquiryList.tsx:92).
**Implication:** "Converted" and "booked" are not the same dimension — an enquiry could (theoretically) have `status="booked"` without `converted_booking_id` set, or vice versa (via the B-109 Reopen path). The actual rule: server only sets `status="booked"` together with `converted_booking_id`, so they're conjoint in practice — but the data model permits the split.
**Decision:** decide during C-B whether to enforce this invariant with a DB constraint OR converge on a single source of truth (e.g., drop `status="booked"` and derive everything from `converted_booking_id`). Until then, document the rule clearly. C-12+ or C-06.

---

## 5 — Cross-role inconsistencies

### W01-CR-1 — Coordinator predicate-equivalence accepted from #03 CR-10
**Source:** `canManageAllBookings(profile)` returns true for Owner / Admin / Coord (per access.ts predicates, confirmed in #02 + #03). No role-specific behavior on the conversion path was observed in code review.
**Live verification:** skipped to save effort; would re-walk only if a Coord-specific finding surfaces in W02/W05.

### W01-CR-2 — Therapist is blocked from the enquiry surface AND from the bookings/new surface
**Source:** #08 CR-17 (Therapist middleware-blocked from `/admin/enquiries`) + #03 CR-09 (`/admin/bookings/new` renders `AdminAccessDenied variant="therapist"` for Therapist). ✅ Therapist cannot reach this workflow at all. Correct RBAC.

---

## 6 — Cross-viewport issues

### W01-CV-1 — Convert button at mobile (375): inherits the bookings/new mobile sticky action bar at the destination
**Source:** #08 audit didn't explicitly verify Convert tap-target at 375, but `EnquiryList.tsx:522` renders Convert inside the row's action group alongside "Mark contacted" + "More actions". Each is a standard button — sufficient tap target. The destination form is mobile-friendly per #03 CV-07–09. **No regressions found from the cross-page handoff at mobile.** ✅ Accept.

---

## 7 — Console / network issues

### W01-CN-1 — 0 errors, 0 warnings on the full walk (enquiry list → conversion form prefill → stale-id render)
**Source:** `browser_console_messages` returns 4 info messages total across the walk (likely the Sentry tunnel + Next.js prefetch chatter already documented in #01 CN-09).

### W01-CN-2 — No new network failures
**Source:** observed. The `/admin/bookings/new` page was a normal GET; no new fetches initiated by the form on prefill.

---

## 8 — Pre-existing items the audit accepts

### W01-PE-1 — `enquiry_converted_to_booking` audit log row is well-shaped (before + after state captured)
**Source:** `actions.ts:914–921`. The audit row captures both states + the actor — strong forensic trail for the conversion. ✅ Accept.

### W01-PE-2 — Cache invalidation on conversion is correct
**Source:** `actions.ts:923–925` invalidates `report-data` + `dashboard-data` tags + revalidates `/admin/enquiries`. Plus the standard booking-creation tags at :947–951. ✅ Accept — comprehensive.

### W01-PE-3 — `bookings.enquiry_id` is NOT a column (intentional reverse-only relationship)
**Source:** confirmed by absence — `createManualBooking` doesn't set any enquiry-pointer on the booking row; the relationship is one-way via `enquiries.converted_booking_id`. For C-07 / B-108 fix-design, decide whether to add `bookings.enquiry_id` (forward pointer + index) or do a reverse-lookup join.

---

## 9 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-104 — toast copy wrong for enquiry-prefill failure | One-line conditional in ManualBookingForm.tsx:786 | C-12+ trivial OR C-03 |
| 2 | B-105 — duplicate toast fires | Idempotent guard on the prefill-failed effect | C-12+ |
| 3 | B-106 — no `converted_booking_id` re-conversion guard | Server-side redirect or banner in `bookings/new/page.tsx` | C-03 |
| 4 | B-107 — non-transactional enquiry update | Wrap in Postgres function OR swallow + log the failure | C-03 (or fold into C-06 data-integrity pass) |
| 5 | B-108 — no booking → enquiry reverse link | UI affordance on `/admin/bookings/[bookingId]` + schema decision (`bookings.enquiry_id` col vs reverse-lookup) | C-07 |
| 6 | B-109 — "Reopen as new" no-op on converted enquiries | Hide the button OR clear `converted_booking_id` on reopen | C-12+ or C-06 |
| 7 | W01-V-1 — Cancel routes to bookings list, not enquiries | Make Cancel referer-aware (or read enquiry_id from search params) | C-07 |
| 8 | W01-V-2 — brittle customer_notes concatenation | Strip empty parts before joining | C-12+ |
| 9 | W01-E-2 — sessionStorage draft carries across enquiries | Scope draft cache key by `enquiryId/clientId` OR clear on different source | C-03 |
| 10 | W01-E-3 — booked vs Converted vocabulary split | Document invariant OR add DB constraint OR converge on `converted_booking_id` | C-12+ data-model cleanup |

---

## 10 — Cross-references to existing findings

- **B-36 (C-A.1 #08)** — already documents that the Convert entry point exists. W01 confirms live + maps the downstream side-effects.
- **B-37 (C-A.1 #08)** — `// FAKE: BUILD-enquiries-filter-query` markers on the enquiries page. Not directly part of W01 walk, but the tab filter that EXCLUDES converted/closed from the bulk-selectable set lives in the same in-memory path. C-09 fix needs to preserve the selectability rule.
- **V-08 (C-A.1 #03)** — confirmed live: service still not pre-selected for the conversion. C-03's narrow scope (service fuzzy-match) is the right fix.
- **E-09 (C-A.1 #03)** — sessionStorage auto-save. W01-E-2 extends this with the cross-enquiry-carryover hazard.
- **B-9 (C-A.1 #03)** — no duplicate-client guard. Pairs with W01-E-2 — the conversion path will silently create a new client record under the new enquiry's name even if the prefilled (carried-over) fields belong to a different person.

---

## 11 — Hand-off

**State:** 2 screenshots captured. 0 code changes. 6 new bugs (B-104 → B-109). 0 booking writes to prod DB. The conversion path is structurally well-built (correct cache tags, audit logging, hidden-input wiring, server-side prefill clearing on stale id) but has **medium-severity edge cases**: non-transactional enquiry update, stale-URL re-conversion, sessionStorage carryover, one-way booking↔enquiry link.

**Most consequential W01 findings to surface to C-B:**
1. **B-107 partial-state hazard** — pair with C-03 plan. Booking exists, enquiry not marked, user might double-submit.
2. **B-108 missing reverse link** — pair with C-07 plan. After conversion, no path back from booking to source enquiry.
3. **B-106 no re-conversion guard** — pair with C-03 plan. Stale URL → orphaned booking.
4. **W01-E-2 sessionStorage carryover** — pair with C-03 plan + B-9 dup-client guard. Mislabeled client records under wrong enquiry.

**Next workflow:** W02 — new booking end-to-end (dashboard → /admin/bookings/new with NO enquiry → submission → confirmation). Different prefill path; tests the standalone manual-booking creation.

**Bug index advance:** B-103 → B-109. Next available: B-110.

*End of W01 enquiry-to-booking-flow audit.*
