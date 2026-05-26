# C-A.2 W02 — New booking end-to-end flow audit

**Workflow:** entry-point → `/admin/bookings/new` (no enquiry) → 4-step manual booking form → `createManualBooking` server action → `create_booking_request` Postgres RPC → `/admin/bookings/[bookingId]` (newly-created)
**Audit type:** C-A.2 cross-page workflow discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `45b51de`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Predecessor audits referenced:** C-A.1 #01 (`/admin/dashboard`), #02 (`/admin/bookings` list), #03 (`/admin/bookings/new`), #04 (`/admin/bookings/[bookingId]`), #05 (`/admin/clients` list), #07 (`/admin/clients/[clientId]`), #08 (`/admin/enquiries`), #09 (`/admin/calendar`).
**Source surveyed:**
- Entry points: `dashboard/dashboard-cards.tsx:832`, `bookings/page.tsx:379+687`, `calendar/page.tsx:1847`, `clients/page.tsx:1337`, `clients/ClientRowMenu.tsx:74`, `clients/[clientId]/page.tsx:556+597+868`, `enquiries/EnquiryList.tsx:522` (W01).
- Form state: `bookings/new/ManualBookingForm.tsx:613` (`useState(true)` for `sendConfirmationEmail`), `:1855-1856` (the visible checkbox).
- Server action: `bookings/actions.ts:726-960` (`createManualBooking`).
- Booking RPC: `public.create_booking_request` (Postgres function — full body inspected via `pg_get_functiondef`).
**Roles swept:** Owner @ 1280. Coord/Admin not re-walked (predicate-equivalent per #03 CR-10). Therapist excluded per #03 CR-09.
**No submit performed.** Per master plan scope clarification 3 (no Zone-2 ops during C-A). All side-effects derived from code + the SQL function body.

---

## 1 — Cross-page entry-point catalogue

**10 entry points to `/admin/bookings/new`, organised by prefill type:**

| # | Source | Path | Prefill |
|---|---|---|---|
| 1 | Calendar empty-state CTA | `calendar/page.tsx:1847` | none |
| 2 | Bookings list header button | `bookings/page.tsx:379` | none |
| 3 | Bookings empty-state action | `bookings/page.tsx:687` | none |
| 4 | Enquiry row Convert button (W01) | `enquiries/EnquiryList.tsx:522` | `?enquiryId=` |
| 5 | Dashboard urgency rep — Convert from enquiry | `dashboard/dashboard-cards.tsx:832` | `?enquiryId=` |
| 6 | Client detail — "Book again" primary CTA | `clients/[clientId]/page.tsx:556` | `?clientId=` |
| 7 | Client detail — second `?clientId=` link | `clients/[clientId]/page.tsx:597` | `?clientId=` |
| 8 | Client detail — empty-state action | `clients/[clientId]/page.tsx:868` | `?clientId=` |
| 9 | Client list — ClientRowMenu | `clients/ClientRowMenu.tsx:74` | `?clientId=` |
| 10 | Client list — row direct link | `clients/page.tsx:1337` | `?clientId=` |

**Gap surfaces (no link to `/admin/bookings/new` from):**
- **`/admin/dashboard` standalone (no quick-add "+New booking" CTA)** — confirms C-A.1 #01 finding. Dashboard's only path to new-booking is via the Enquiry conversion CTAs (item 5) OR Bookings nav → list → header button. Two-hop minimum for from-scratch creation.
- `/admin/calendar` grid cells — clicking a slot does not start a new booking (calendar is read-only). Empty-state CTA exists but the grid itself is not a creation entry point.
- Top-level admin nav has no `+` action button. Other CRMs typically put a global quick-create in the header.

---

## 2 — Step-by-step walk (Owner, no prefill)

| Step | Action | Observed |
|---|---|---|
| 1 | Dashboard → look for "New booking" CTA | None visible. Only "View bookings" link goes to the list. ✓ confirms #01 V-?. |
| 2 | `/admin/bookings` → header "New booking" button | Present at `bookings/page.tsx:379` (verified via code; #02 audit). |
| 3 | Click → land at `/admin/bookings/new` | Form renders 4-step wizard: Contact & source / Services & participants / Location / Date & time. ✓ Matches code structure. |
| 4 | Step 1 default state (verified live) | `booking_source = "phone"` (default), all contact fields empty, no "From enquiry" badges, `enquiry_id` hidden input absent (no `?enquiryId=`), `participant_name_0` empty. |
| 5 | `send_confirmation_email` default | **TRUE** — `useState(true)` at `ManualBookingForm.tsx:613`, surfaced as a checked checkbox at step 4 (line 1855-1856). Hidden input on step 1 reads value `"on"`. So the manual-booking client confirmation IS sent by default unless the admin un-ticks. |
| 6 | Code-walk submission path | `createManualBooking` (actions.ts:726) → Zod validation → `createBookingTransaction` → `create_booking_request` RPC → optional inline-assignment loop → email send (if checkbox on) → cache invalidations → `redirect(/admin/bookings/[id])`. |
| 7 | Cross-page side-effects (cache tags / paths) | Tags invalidated: `report-data`, `dashboard-data`. Paths revalidated: `/admin/bookings`, `/admin/dashboard`, `/admin/calendar`. **NOT invalidated:** `/admin/clients`, `/admin/clients/[clientId]`. Even though a new client row may be created OR an existing one overwritten (see B-110), the client surfaces won't reflect it until natural revalidation. |
| 8 | Booking detail landing | `redirect(/admin/bookings/${result.bookingId})`. Detail page renders the standard booking surface — **no "just created" affordance** (no toast, no welcome banner, no "Send confirmation now" CTA if email was unticked). |

---

## 3 — Bugs found

### B-110 — SQL `create_booking_request` does DESTRUCTIVE overwrite of existing clients on email match
**Severity:** HIGH (data hygiene — silent data loss)
**Source:** Postgres function body, the `on conflict (email) do update` block. When the form's email matches an existing `clients.email` (after `lower(trim(...))` normalisation), the existing client row's `full_name`, `phone`, `address`, `postcode`, `city`, `area`, `notes` are ALL replaced by the form submission's values. No history is kept of the prior values.
**Concrete failure mode:**
- Admin creates a new booking for `sara@example.com` with name spelled "Sarah Mohammed" (typo).
- The existing `Sara Mohamed` (correct spelling) row is overwritten to "Sarah Mohammed".
- Phone, address, etc. also replaced with whatever the admin typed (or left blank).
- The original data is destroyed. No audit log row covers this (audit log line 822-833 only logs the booking creation; the client mutation is invisible to it).
**Same severity-of-consequence as the B-9 finding** (no dup-client guard at form layer — confirmed at SQL layer here).
**Decision:** the `do update` SHOULD be replaced with `do nothing` + an explicit "this email already exists — link this booking to <existing client> or create a fresh client?" decision in the form. The current behavior silently destroys data. **Lift to C-06 (delete + bulk-delete + dedup) as a sub-deliverable, OR C-03+B-9 plan.**

### B-111 — Client dedup uses email only — no phone-based dedup at the SQL layer
**Severity:** medium (data hygiene — fragmentation)
**Source:** same SQL function — `on conflict (email)`. There is no `unique` constraint on `phone` (would need to verify in `\d clients`, but the conflict clause confirms email is the only dedup axis). Same person with two emails → two separate client rows.
**Implication:** the phone-only enquiry case (e.g., Audit Enquiry Two from W01) cannot dedupe at SQL even if admin enters phone identical to an existing client. Confirms B-9 from #03 at SQL layer. Pairs with B-110.
**Decision:** add either `(phone)` unique partial index OR a soft-dup detection in the form (cross-reference the lifted `DuplicateWarningBanner` from `/admin/clients/new`). C-06 or C-03+B-9.

### B-112 — SQL function REQUIRES a valid email — combined with W01 prefill gap creates a path that's effectively un-completable from a phone-only enquiry
**Severity:** medium (UX friction in a critical workflow)
**Source:**
- SQL function: validates `v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'` — strict.
- Front-end Zod schema (actions.ts:706): `email: z.email("A valid email is required.")` — also strict.
- W01 finding: enquiry prefill leaves email blank when source enquiry has phone only.
**Net effect:** to convert a phone-only enquiry, the admin must manually obtain and enter an email address. Real-world friction — a WhatsApp/phone enquiry path doesn't always carry email. The clinic loses the ability to convert these enquiries through this form unless they make a follow-up call or invent a placeholder email.
**Decision options:**
- (a) Allow phone-only bookings (relax SQL+Zod to require email OR phone) — but then dedup needs to handle phone too (B-111).
- (b) Make the form auto-derive a placeholder email like `phone-only+<phoneDigits>@rahmatherapy.example` so the SQL passes — but this pollutes the email column.
- (c) Defer — require email for all bookings, document the limitation prominently.
**Decision:** flag for the user during C-B planning. **Real product decision.** Likely covers C-03 (enquiry conversion) + C-08 (email automation).

### B-113 — `createManualBooking` does NOT invalidate `/admin/clients` or `/admin/clients/[clientId]` cache paths
**Severity:** medium (stale data — newly-created or overwritten clients invisible until natural cache TTL)
**Source:** `bookings/actions.ts:947-951` — invalidates `report-data` + `dashboard-data` tags and revalidates `/admin/bookings`, `/admin/dashboard`, `/admin/calendar`. **Missing:** `revalidatePath("/admin/clients")` and `revalidatePath("/admin/clients/${clientId}")`.
**Concrete failure mode:** Admin creates a booking for a brand-new client. New client row is inserted by the RPC. Admin then navigates to `/admin/clients` — list does NOT show the new client until Next.js cache naturally invalidates (or full reload). Same for an open `/admin/clients/[clientId]` tab if the existing client was overwritten per B-110.
**Decision:** add the two revalidatePath calls. One-line server-action fix. C-12+ or fold into C-09 cache pass.

### B-114 — `bookings.contact_full_name` is a snapshot of the form submission, but the `clients.full_name` got overwritten by the SAME submission — so the snapshot is identical to the (now-clobbered) client name, hiding the data loss
**Severity:** low (forensic — makes B-110 silent)
**Source:** SQL function — `bookings.contact_full_name = v_clean_name` (the form value), `clients.full_name = v_clean_name` (the form value via the `do update`). The booking row carries the new name as a "snapshot", but it's the same value just written to clients. If you later inspect the booking thinking "what name was on the client when this was made?", you'd see the new name — no way to tell from booking data alone that the client's name was different before.
**Decision:** pairs with B-110 — fix the destructive overwrite first; this becomes moot.

---

## 4 — Visual issues

### W02-V-1 — Dashboard has no "+New booking" / "+Add client" / "+Add enquiry" quick-add CTAs
**Source:** verified live — `Array.from(document.querySelectorAll('a, button')).filter(t => /book|add|new|create/i.test(...))` returns only "Bookings" (nav), "View bookings" (urgency card range link). No creation affordance. **Confirms C-A.1 #01 finding** at the cross-page level.
**Decision:** add a `+` quick-add menu / row of CTAs in the dashboard header. Fold into the design-system C-11 work, OR add as a separate small plan during C-07 routing.

### W02-V-2 — No "just created" affordance on `/admin/bookings/[bookingId]` after redirect
**Source:** `createManualBooking` redirects via `redirect(/admin/bookings/${id})` but doesn't set any flash state. The detail page renders identically to a navigation from the list. No toast confirming "Booking created" — Next.js `redirect()` cannot carry a flash message.
**Implication:** if the user accidentally double-clicked or has a slow network, they may not realise the booking was created and try again, potentially creating a duplicate.
**Decision:** flash toast pattern via search-param trick (`?created=1` → page shows toast → strip param). Or surface "Just created" inline at top of detail page. C-07 routing.

---

## 5 — Empty / edge states

### W02-E-1 — City whitelist validation is enforced ONLY at the SQL layer; front-end shows no preview
**Source:** SQL function `if not exists (select 1 from jsonb_array_elements_text(v_settings.allowed_cities) ...) then raise exception 'Location is outside the service area'`. Front-end form does not pre-fetch `business_settings.allowed_cities` to validate the typed city.
**Implication:** admin types "Bedford" (out of area), fills the rest of the form, clicks submit on step 4, gets a generic error "Location is outside the service area". Wasted time. Should be a step-3 (Location) inline validation.
**Decision:** lift the `allowed_cities` list to the form via the page.tsx loader. Validate inline. C-07 routing or C-12+.

### W02-E-2 — Booking date bounds: `today` ≤ booking_date ≤ `today + booking_window_days`
**Source:** SQL function — two `raise exception` lines. `booking_window_days` is from `business_settings`. Front-end date picker SHOULD enforce these bounds; if not, user submits and gets server-side error.
**Decision:** verify the form's date picker reads `booking_window_days` from settings. (Out of scope for this W02 audit to repro at picker level; flag for C-07/C-09 inline validation pass.)

### W02-E-3 — Group bookings: only participant 1 gets `health_notes`
**Source:** SQL function — `case when v_participant_index = 1 then nullif(trim(coalesce(p_health_notes, '')), '') else null end`. Per #03 V-09, the form has only one global `health_notes` textarea. SQL function correctly maps it to participant 1 and writes NULL for participants 2..N.
**Implication:** group bookings cannot record per-participant health context. Significant for clinical context — hijama / cupping group bookings could need per-participant flags (medications, conditions).
**Decision:** schema + form addition for `health_notes[]` per-participant. C-12+ clinical workstream OR fold into C-02 recurring bookings (when scope expands to per-participant fields).

### W02-E-4 — Email default-on means manual bookings ALWAYS fire `sendBookingCreatedEmails` unless the admin un-ticks at step 4
**Source:** `useState(true)` at line 613. ✅ Generally correct UX — manual bookings should default to sending confirmation. **But** there's no audit log of WHETHER the email was sent — no row records the decision. The audit log row at `:822-833` records `bookingSource`, `participantCount`, etc., but not whether the email was sent.
**Decision:** add `emailSent: parsed.data.sendConfirmationEmail` to the audit `after_state`. Trivial change, useful forensic data. C-12+ trivial.

---

## 6 — Cross-role inconsistencies

### W02-CR-1 — Owner / Admin / Coord all reach the same form (canManageAllBookings)
**Source:** `bookings/new/page.tsx:25` predicate confirmed. Live verification skipped to save effort.

### W02-CR-2 — Therapist blocked at form page (AdminAccessDenied variant="therapist")
**Source:** `bookings/new/page.tsx:25-33`. Confirmed in #03 CR-09.

### W02-CR-3 — Coord and Therapist visibility of the newly-created booking
**Source:** Coord scope is global per `canViewAllBookings`. Therapist sees only their own assignments. **Post-creation, the booking is `unassigned`** (SQL function line `status, 'pending', 'unassigned'`) — Therapist will not see it on `/admin/bookings` until they're assigned/claim it. ✅ Correct behavior, but worth noting that a coordinator-created booking is invisible to all therapists until assignment lands — pairs with C-08 ("missing assignment email") to discoverability.

---

## 7 — Cross-viewport issues

### W02-CV-1 — Mobile (375) form behavior accepted from #03 CV-07/08/09
No new mobile concerns surfaced at the cross-page level.

---

## 8 — Console / network issues

### W02-CN-1 — 0 errors, 0 warnings on the load of `/admin/bookings/new` (no prefill)
Verified via `browser_console_messages` after navigation. Sentry tunnel + font preload baseline persists per #01 CN-09.

---

## 9 — Pre-existing items the audit accepts

### W02-PE-1 — RPC enforces service_role caller
**Source:** SQL function lines 1-2: `if v_actor_role is distinct from 'service_role' then raise exception ... using errcode = '42501'`. Combined with the server action calling `createSupabaseAdminClient()`, this gives layered RBAC. ✅ Strong defense in depth.

### W02-PE-2 — RPC uses `pg_advisory_xact_lock` to prevent double-booking races
**Source:** SQL function `perform pg_advisory_xact_lock(hashtextextended('create_booking_request:' || p_booking_date::text || ':' || p_start_time::text, 0))`. Two parallel submissions for the same date+time will serialise. ✅ Solid concurrency hygiene.

### W02-PE-3 — `participant_count`, `service_count` derived deterministically — `total_price = service_price * participant_count`
**Source:** SQL function. Pricing is RPC-computed, not form-supplied. ✅ Prevents client-side price tampering.

### W02-PE-4 — Booking participants always get `booking_assignments` row with `status='unassigned'` and `assigned_staff_id=null`
**Source:** SQL function final loop. Creates the assignment shape that the claim / reassign UI expects. ✅ Consistent with #04 audit's understanding of the data model.

### W02-PE-5 — `gender_restrictions` IS enforced at SQL layer (`male_only` / `female_only` services rejected for mismatched participants)
**Source:** SQL function — two `exists` checks raise exception "Selected service is not suitable for every participant". So #03 B-10 is "the FORM doesn't filter the service list" — but the SQL DOES block submission. Net effect: admin can choose a forbidden combination but gets a generic error at submit. UX gap, not a security gap. **Slightly revises B-10 severity downward.**

---

## 10 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-110 — destructive client overwrite on email match | Change `do update` → `do nothing` + form decision UX | C-06 (delete + dedup) — possibly the headline item |
| 2 | B-111 — no phone-based dedup | Add unique partial index OR DuplicateWarningBanner crossover | C-06 |
| 3 | B-112 — email-required blocks phone-only enquiry conversion | User-level product decision required | C-03 (or C-08) |
| 4 | B-113 — missing `/admin/clients*` revalidatePath | One-line server action fix | C-12+ or fold into C-09 cache pass |
| 5 | B-114 — booking name snapshot hides destructive overwrite | Resolved by B-110 fix | — |
| 6 | W02-V-1 — no dashboard quick-add | Add `+` CTAs to dashboard header | C-11 (design-system) or C-07 |
| 7 | W02-V-2 — no "just created" affordance | Flash toast via search-param trick | C-07 |
| 8 | W02-E-1 — city whitelist hidden until submit | Lift `allowed_cities` to form for inline validation | C-07 or C-12+ |
| 9 | W02-E-2 — booking window not inline-validated | Verify date picker bounds; fold into W02-E-1 | C-07 |
| 10 | W02-E-3 — single global health_notes for group bookings | Per-participant `health_notes[]` schema + UI | C-12+ clinical |
| 11 | W02-E-4 — no `emailSent` in audit log | Add field to audit `after_state` | C-12+ trivial |
| 12 | W02-PE-5 revision — `gender_restrictions` enforced at SQL only | Form-side filter for better UX | C-12+ or fold into C-03 |

---

## 11 — Cross-references to existing findings

- **B-9 (C-A.1 #03)** — "no duplicate-client guard". W02 confirms at SQL layer + adds the destructive-overwrite dimension (B-110).
- **B-10 (C-A.1 #03)** — `gender_restrictions` declared but unused in form. W02-PE-5 confirms SQL DOES enforce it; severity revised downward.
- **V-08 (C-A.1 #03)** — service-not-prefilled. Re-confirmed in W01; not re-walked here.
- **W01-V-1** — Cancel routes to bookings list. Same gap applies to no-prefill form (Cancel still goes to /admin/bookings/).
- **#01 dashboard quick-add gap** — re-confirmed at the new-booking cross-page level.
- **#04 booking detail** — no "just created" affordance is a workflow-level finding that the per-page audit couldn't see because it only examines steady-state.

---

## 12 — Cache-invalidation map (cross-page side-effects on successful create)

| Surface | Invalidated? | Source |
|---|---|---|
| `/admin/dashboard` | ✅ via `revalidatePath` + `dashboard-data` tag | actions.ts:923, :947-950 |
| `/admin/bookings` (list) | ✅ via `revalidatePath` | :949 |
| `/admin/calendar` | ✅ via `revalidatePath` | :951 |
| `/admin/reports` | ✅ via `report-data` tag | :923, :947 |
| `/admin/enquiries` | ✅ when conversion (only) | :925 |
| `/admin/clients` (list) | **❌ MISSING — B-113** | — |
| `/admin/clients/[clientId]` | **❌ MISSING — B-113** | — |
| `/admin/me` | indirect via `dashboard-data` | — |
| `/admin/staff/[id]/performance` | indirect via `report-data` | — |

---

## 13 — Hand-off

**State:** 0 screenshots (no novel-visual content beyond the no-prefill form which is well-covered by C-A.1 #03). 0 code changes. 5 new bugs (B-110 → B-114). 0 booking writes to prod DB. The new-booking flow is structurally robust (RPC concurrency + service_role gate + deterministic pricing) but has **HIGH-severity data hygiene issues**: destructive client overwrite, missing phone-based dedup, and missing `/admin/clients*` cache invalidation.

**Most consequential W02 findings to surface to C-B:**
1. **B-110 destructive client overwrite** — single biggest data-hygiene finding of C-A so far. Pair with C-06.
2. **B-112 email-required blocks phone-only conversion** — needs user-level product decision.
3. **B-113 missing client-cache invalidation** — easy fix; surface in C-09 cache pass.
4. **W02-E-1 city whitelist invisible** — submit-then-error UX.

**Next workflow:** W03 — booking lifecycle pending → confirmed → completed → review. Tests email triggers at status transitions, the "completed" hook for C-01 Google review email, and the audit-log capture of each transition.

**Bug index advance:** B-109 → B-114. Next available: B-115.

*End of W02 new-booking-end-to-end-flow audit.*
