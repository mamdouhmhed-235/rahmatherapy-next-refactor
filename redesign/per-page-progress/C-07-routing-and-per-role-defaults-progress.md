# C-07 — Routing and per-role defaults — PROGRESS

**Plan:** `redesign/plans/C-phase/C-07-routing-and-per-role-defaults-plan.md`
**Brief:** `redesign/briefs/C-07-routing-and-per-role-defaults-brief.md`
**Programme:** Band C, C-C implementation — plan **#15 of 22** (§4 order).
**Predecessor:** C-03, final commit `d3b5c90`.
**Dependencies:** none blocking — C-11 (shipped) is the only soft one, for the scope-toggle mount point.
**Migration:** none. C-07 is not among the ledger's 9 migration-bearing plans. **No Zone-2 actions.**

> ## ⏳ IN PROGRESS — Phases A1–A4 done and verified. B1–B4 remain.

---

## 1 — Phase A

| Phase | Commit | Verify |
|---|---|---|
| A1 — CTA dedupe, staff link, QuickLinks | `526733f` | **PASS** |
| A2 — just_created toast, city validation | `5b07851` | **PASS** (1 real defect found, fixed below) |
| A3 — Personal→Mine, 7-day claimable window | `8f76fc6` | **FAIL** → fixed |
| A fix round | `b8f2f5d` | **PASS** on both lenses |
| A4 — customer manage footer | `4603340` | **PASS** on code; verify-only half undocumented → recorded here |

All dispatches `sonnet` per §5 (routine UI work); all verifiers `sonnet`, high effort.

## 1.1 — Two pieces of plan code that would have shipped half-working

**Step 3's `getQuickLinksForRole` switches on `profile.role_name` — which is not a stable slug.** It is `getRoleDisplayName()`'s output, i.e. the **editable `display_label`** from the database ("Owner / Main Admin", "Client Care / Booking Coordinator", "Admin / Practice Manager"). An exact-match switch on it returns `[]` for every role whose label an Owner has ever edited — in practice three of the four. The Quick Links panel would have rendered nothing for Coordinators, Admins and Owners while working perfectly for Therapists, with no error anywhere.
Implemented instead on the page's existing `resolveAdminShellVariant()` bucketing, with **every individual link gated on the exact predicate its destination page enforces**, each verified against that page's own source. A verifier re-traced all 16 links independently: every one resolves and is openable by the role that sees it.

**Step 1's premise was already resolved.** The plan says drop two of three `?clientId=` CTAs on the client detail page. Only **two render today** — the "third" (`newBookingHref` feeding `ClientDetailShortcuts`) renders `null` and exists solely to wire the `b` keyboard shortcut to the header button the plan says to keep. Deleting it would have broken that shortcut. No change made; documented rather than performing a destructive no-op edit.

## 1.2 — A3's blocking defect: a filter defeated before it ran

Step 7 added a `booking_date <= today + 7d` filter to the Therapist dashboard's "Open to claim" section. It ran **in memory over `data.bookings`** — an array the dashboard has already bounded to `from = to = today` on any ordinary visit (`getBookings()` applies `.gte(filters.from).lte(filters.to)`; `page.tsx` always supplies a truthy `from`/`to` defaulting to today, so the range-based defaults never apply).

So every claimable booking 1–7 days out was excluded by the base query **before the new filter saw it**. The section rendered empty or undercounted beneath copy promising "next 7 days · N available" — telling a Therapist there is no claimable work when there is. Static gates cannot see this: the query is valid, the filter is correct, and no spec exercised the combination.

**Fixed in `b8f2f5d`** with a separately-bounded fetch (`from: today, to: sevenDayLimit`), mirroring the page's own existing `stripeFilters` pattern, rather than widening the shared query — which would have silently changed the meaning of every other tile computed from `data.bookings` (weekCount, todayAppointments, needsAssignment, unpaidBookings), several of which apply no independent date bound. Cost is one extra `getDashboardData()` call on the Therapist branch only, 3→4, within the documented 6-query budget. The cache key needed no change: it already includes `JSON.stringify(filters)`, so the distinct filter object lands in its own entry. A new spec pins the boundary — 7 days out is in, 8 days out is out.

## 1.3 — A2 introduced a new double-toast, and its commit message said otherwise

`5b07851`'s message claims its `just_created=1` param produces "the identical B-105 double-toast shape already recorded… not a new or worse variant". **That was wrong.** Before it, the non-enquiry redirect carried no query params at all, so `BookingCreatedToast`'s second effect never fired there and exactly one toast showed. Adding `justCreated=true` fired it alongside the always-on sessionStorage-driven first effect — two toasts on the **most common** booking path, where one appeared before.

C-03's B-105 double-toast on the *enquiry* path is genuinely pre-existing and stays deferred to C-12+. This one was new, and is fixed in `b8f2f5d`: the specific "Booking created." toast (carrying the actionable View-client link) wins and the generic "Booking request submitted." is suppressed on that path only. The enquiry path is untouched and pinned by a regression spec.

## 1.4 — A4: Step 8's verify-only half, performed and recorded

The A4 implementer shipped the footer correctly but never documented the verify-only checks, so a verifier ruled it a rule-12 gap — *"never mark a phase/gate done that didn't run"* — and then performed them independently. Both findings are worth more than the check itself:

- **The plan's premise does not match the architecture.** It asks to verify that the cancel/reschedule *"Back to booking"* links work. **No such links exist.** Cancellation and reschedule are inline forms on the single `/booking/manage?token=…` page (no dynamic route segment — the plan's own earlier C07-F1 correction says as much), submitted through `useActionState` server actions that re-render the same page with success/error text. The token rides in a hidden input and is never dropped by navigation, because there is no navigation. **This verification item is unverifiable because its subject does not exist** — not a gap, a stale premise.
- **The expired-token render is graceful**, confirmed by reading both paths. On page load, a null from `getCustomerManageBooking` renders `InvalidManageLink` — heading "Manage link unavailable", body "This link is invalid or has expired…", plus a Return-home link. On submit, all three actions in `manage/actions.ts` independently re-check the token and return an inline "This manage link is invalid or expired." if it went stale between load and submit. Both degrade cleanly.

The code half is clean: 34 insertions, zero deletions, one file, no new imports, **no `createSupabaseAdminClient`** anywhere near this public route, and `contactEmail`/`contactPhone` genuinely in scope from the pre-existing batched `getBusinessSettings()` call.

---

## 2 — Logged, not fixed

- **⚠️ `weekCount` on the dashboard has the identical defeat A3 just fixed.** `page.tsx`'s `weekCount` also filters `data.bookings`, which is bounded to `filters.to` (today by default) — so the dashboard's week count is wrong today, for the same reason the claimable window was. **Pre-existing** (predates C-07; `page.tsx` was untouched by `8f76fc6`), so logged under rule 6a rather than fixed. Worth a plan that owns the dashboard.
- **⚠️ The new manage-page footer is inert in production.** `business_settings.contact_email` and `contact_phone` are **both NULL** live, so the footer — and the pre-existing "Contact" SideCard using the same values — render nothing for real customers today. Correctness is unaffected; the feature simply does nothing until those settings are populated. **Owner action, not a code fix.**
- **`isCityKnown` treats an empty `allowed_cities` list as "city is fine"** and suppresses the warning. If that setting were ever emptied, the client would stay silent while the server's `not exists(...)` check rejected *every* submission — the inverse of the false-alarm risk. Not exercised today (live value is `["Luton","Dunstable"]`).
- **Performance-page tiles still read "Personal utilisation" / "Personal retention"** (`performance-helpers.ts`). Same terminology family as W08-V-1 but that surface is in neither the audit's inventory nor C-07's files-touched list — a defensible scope boundary, flagged for completeness.
- **The 7-day claimable filter had no test coverage** as originally shipped; the fix round added a boundary spec.
- **Footer grammar asymmetry:** with only `contactEmail` set, the copy reads "Need help? email …" (lowercase, directly after the question mark) versus the phone branch's "Need help? Call us on …". Cosmetic.
