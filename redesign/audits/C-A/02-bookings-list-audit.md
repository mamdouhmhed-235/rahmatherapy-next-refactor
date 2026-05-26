# C-A.1 #02 — `/admin/bookings` (list) audit

**Surface:** `/admin/bookings` (list — tabs: Needs Attention / Today / Upcoming / Claimable / All / Cancelled etc.)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `b9c1403` (post-#01 audit). Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `src/app/admin/bookings/page.tsx` (968 LOC, read in full) + 14 colocated production files surveyed by Explore subagent (excludes nested `[bookingId]/` + `new/` — those are surfaces #03 + #04).
**Roles swept:** Owner @ 1280-attention + 1280-all + 1280-cancelled + 375-attention, plus Therapist + Coordinator @ 1280. Admin skipped (predicate-equivalent to Owner per `canManageAllBookings`). Therapist-Fresh skipped (zero-state shape inferable from page.tsx code path — `canViewAll === false` + zero `assignedIds` + zero `claimableIds`).
**Screenshots:** `redesign/audits/C-A/screenshots-02-bookings-list/` — 7 PNGs.

---

## 1 — Bugs found

### B-04 — C-05 root cause LOCATED: `claimBookingAssignment()` does not check booking status
**Severity:** high (data integrity — assignment can be created against a cancelled booking)
**Source:** `src/app/admin/bookings/actions.ts:269–275`. The server action fetches the booking record and only checks existence, not status:
```ts
const { data: booking } = await adminClient
  .from("bookings")
  .select("id, booking_date, start_time, end_time")
  .eq("id", assignment.booking_id)
  .single();
if (!booking) return { error: "Booking not found." };
// ← missing: if (["cancelled", "no_show"].includes(booking.status)) return error
```
**Visual repro:**
- Owner @ 375 `view=attention`: the cancelled "Badar — Hijama Package" row renders the `cancelled` status pill **and** a primary "Claim" button side-by-side (see `screenshots-02-bookings-list/owner-375-attention.png`).
- Owner detail page for that booking (`/admin/bookings/9d55ce2a-…`) shows an enabled "+ Assign therapist" button despite the "This booking is cancelled" banner above it (see `owner-1280-cancelled-detail.png`).
- Therapist `view=claimable` (verified `test.therapist@…`): cancelled bookings ARE filtered out at the UI layer (`page.tsx:175-177`), so the therapist-facing claimable view never surfaces them. BUT the row-action "Claim" button on Owner-side attention view still renders.

**Inconsistency:** UI hides cancelled from claimable-view-as-Therapist (one filter), but row-action Claim button on attention-view-as-Owner does not gate on status, and the server action accepts the claim regardless. The user's framing ("cancelled bookings can't be assigned or claimed") describes the therapist-claimable side; the audit additionally surfaces that the Owner-side ROW ACTIONS happily proceed and the server action accepts the mutation.

**C-B plan disambiguation needed:** does the user want (a) cancelled bookings to be wholly inert (no claim/assign anywhere, must restore first), or (b) cancelled bookings remain claim able as a "redirect to restore" path? The master-plan intent strongly suggests (a) per the "dead state" wording.

**Fix anchor for C-C:** add a status guard in `actions.ts:274`. Companion fix in row-action gating (`BookingRowActions.tsx`) to hide the Claim button when status is cancelled/no_show.

### B-05 — `BookingRowActions.tsx:232` has one `animate-spin` without `motion-reduce` guard
**Severity:** low (a11y, animation continues regardless of OS reduced-motion setting)
**Source:** subagent finding. Sibling `ClaimAssignmentButton.tsx:61` correctly uses `motion-reduce:transition-none` at line 103. Pattern inconsistency — same dir.

### B-06 — Manual reminders are a documented stub
**Source:** `BookingRowActions.tsx:118–122` — clicking "Send reminder" toasts `"Manual reminders are coming soon."` and re-routes to `/admin/emails?booking=…`.
**Status:** **intentional pre-existing stub.** Pairs with **C-08** (email templates + automation). Audit flags it for C-B to confirm scope.

### B-07 — Master-plan-documented `caret-color: transparent` hydration warning IS NOT in our CSS
**Source:** subagent grep of `BookingsChrome.tsx` + sibling filter components — no `caret-color` declaration found.
**Implication:** HANDOFF §1.10 attributed the warning to "browser-autofill induced". The audit did not repro a React-19 hydration warning at all (clean console at every viewport / role / tab combination). Either: (a) the warning was browser-autofill-only and only repros when the user's saved credentials autofill the filter inputs — which Playwright doesn't trigger; (b) the warning has been silently fixed since the post-Band-B audit.
**Status:** **MAY NOW BE A NON-ISSUE.** Recommend the user verify in their own browser session (autofill engaged) before C-B plans for it; if it does still appear in the user's session, the `suppressHydrationWarning` workaround HANDOFF §1.10 proposed remains valid.

### B-08 — Sentry tunnel double-hop persists (same as B-02 from #01)
*(See dashboard audit B-02.)* Reproduces on every page; not bookings-list-specific. Cross-reference only.

---

## 2 — Visual issues

### V-05 — List renders WITHOUT pagination across all tabs (C-09 hazard already documented as user item)
**Source:** `page.tsx:438-477` — query has no `.limit()` or `.range()`. All bookings returned and rendered. Cards mapped directly in `page.tsx:556-591` with no virtualisation.
**Current state benign:** the production DB has only 11 total bookings across 7 date groupings (`view=all` measurement). Doc height = 3093 px at 1280. Pagination isn't biting yet.
**Future-state bad:** when bookings cross ~200, the first paint will degrade. When they cross ~1000, the page becomes unusable. The animation stagger caps at 12 rows (`page.tsx:561 ROW_STAGGER_MAX`) which is the only existing acknowledgement of scale, but the rest of the list still renders.
**Maps to:** C-09 (pagination + scale-aware design) — this surface is one of the headline cases.

### V-06 — Production DB has visible test data on the bookings list (confirmed)
**Cards visible to Owner on `view=attention` (375 viewport):**
- `Phase10 E2E Claim Client` (test fixture)
- `Phase10 THERAPIST A` (test fixture)
- `Zara Test Client` (test fixture)
- `Mohammed Abdulrahman Abdul-Hakim Al-Farsi-Lampungbungkangkang` (apparent stress-test long-name fixture)
- Plus `Fatima Ahmed` + `Badar` (likely real-looking but possibly test)
- On `view=cancelled`: `اَلسَّلَامُ عَلَيْكُمْ Test Client` (explicit Test prefix)

**Carried over from:** master-plan Part 3 "Production DB visibly contains test data". Audit confirms it's visible at multiple viewports + tabs and across multiple sessions.
**Implication:** before public launch, the cleanup pass needs to remove these test rows. Should also verify that `dev` env uses a fixture seed file and `prod` doesn't share the same Supabase project.

### V-07 — Coordinator nav still labelled "Bookings" (not narrowed)
**Source:** `page.tsx:370` — `title: canViewAll ? "Bookings" : "My bookings"`. Coordinator has `canViewAll = true` per RBAC (Coord can view all per `canManageAllBookings`), so title is "Bookings" — same as Owner/Admin. ✅ Accept (RBAC-driven, not an inconsistency).

---

## 3 — Empty / edge states

### E-06 — Comprehensive empty-state coverage by (view × emptyMode)
**Source:** `BookingsEmptyStateInner` (`page.tsx:626-729`). 8 distinct empty states surfaced: search-only / filter-only / attention / today / upcoming / claimable / completed / cancelled — each with a curated icon + copy. Several reference illustration assets at `/images/admin/empty-states/*.svg`. ✅ Excellent UX, accept.

### E-07 — Claimable view masks identifying details (`normalizeClaimableBooking`)
**Source:** `page.tsx:260-321`. Therapist's claimable view shows generic `"Claimable booking"` as `contact_full_name` and nulls out address / amount / health notes. Privacy preserved before the therapist claims. ✅ Accept.

### E-08 — Therapist's `view=today` returns 3 cards but the dashboard said "No upcoming visit"
**Observed:** Therapist navigates to `/admin/bookings` → lands on `view=today` (default for non-`canViewAll`) → sees 3 cards. But the Dashboard heading from #01 audit said "No upcoming visit" for the same therapist account.
**Reading the code:** dashboard's "No upcoming visit" line uses `findNextAppointment(data.bookings, today)` which checks `booking_date > today` — strictly after today. Bookings list's `view=today` checks `booking_date === today`. The two surfaces disagree because they answer different questions.
**Audit assessment:** **not a bug, but a UX confusion.** Two surfaces using "today / upcoming" with different meanings. Worth flagging for **C-07** (proper routing between pages) — coherent verb semantics across pages.

---

## 4 — Cross-role inconsistencies

### CR-05 — Therapist sees no Attention tab; Owner/Admin/Coord do
**Source:** `BookingsChrome.tsx` filters the visible tab list based on `canViewAll`. Therapist (canViewAll = false) sees Today / Upcoming / Claimable only — no Attention. Owner / Admin / Coord see Needs Attention / Today / Upcoming / Claimable.
**Status:** **intended** — Attention is a triage-queue concept for booking managers, not for individual therapists. Accept.

### CR-06 — Therapist title is "My bookings" + descriptive `"Sessions assigned to you, plus open bookings you can claim."` — friendly worker-facing copy. ✅ Accept.

### CR-07 — Therapist sees no "+ New booking" CTA
**Source:** `page.tsx:376-386` — actions gated on `canViewAll`. Correct RBAC. Therapist can't create bookings. ✅ Accept.

### CR-08 — Coordinator behaves identically to Owner on this surface
**Verification:** `cardCount: 7`, same tab set, same H1, same description, "+ New booking" present. Confirms RBAC predicate `canManageAllBookings` returns true for the Coordinator role too. Accept.

---

## 5 — Cross-viewport issues

### CV-04 — Mobile chrome (375 viewport) collapses filter chrome into "Refine" button
**Source:** `BookingsChrome.tsx` adapts at mobile. Filter strip turns into a single "Refine" button which opens a sheet (presumably). The chip-based date-range strip is replaced. ✅ Accept; clean.

### CV-05 — Mobile cards are well-formed at 375
**Observed:** time + service + status pills + therapist + Confirm/⋯ actions all fit. Long names (e.g. the stress-test `Mohammed Abdulrahman...Kang…kang`) break correctly via `break-words`. ✅ Accept.

### CV-06 — AdminShell mobile nav at `position: fixed; bottom: 0` captured oddly mid-page in fullPage screenshots
**Same artefact as documented in #01 (CV-02).** Not a real bug; just a Playwright fullPage capture quirk. The nav clears the page content correctly via the parent layout's mobile padding.

---

## 6 — Console / network issues

### CN-04 — Owner at 1280 attention/all/cancelled views: 0 errors, 0 warnings (after initial load)
**Capture:** `browser_console_messages` returns 0 errors and 0 warnings on the bookings-list views.

### CN-05 — But: across navigations, 6 font + CSS preload warnings persist
**Symptoms:** `[WARNING] The resource …/_next/static/media/{font-hash}.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate \`as\` value and it is preloaded intentionally.` — 4 font preload warnings + 2 CSS chunk preload warnings.
**Source:** Next.js / Turbopack font preloading registers these eagerly but the page may not reference all of them. Cosmetic warning, no functional impact.
**Audit status:** flag for C-12+ polish band. Lower priority than the application-level findings.

### CN-06 — Sentry monitoring tunnel double-hop persists
*(Same as B-08 / B-02 from #01.)*

### CN-07 — No failed bookings-list-specific network requests detected
**Network capture:** all dashboard + bookings list requests returned 2xx.

---

## 7 — Pre-existing items the audit accepts

### PE-06 — Attention-view query uses an OR predicate that mixes status + assignment + reschedule + customer cancellation
**Source:** `page.tsx:169-173`. The "attention" view collects pending bookings + non-fully-assigned + reschedule requests + customer cancellations. Logical and well-commented. Accept.

### PE-07 — `BOOKING_SELECT` query is broad but justified — many UI cells depend on these columns
**Source:** `page.tsx:43-87`. 50+ columns. Could be narrowed by separating list / detail queries but the savings are marginal at current scale. Accept; revisit if C-09 pagination work makes a narrower variant warranted.

### PE-08 — Email-failure swallow at `actions.ts:216` + `:354` is intentional fail-safe
**Source:** subagent. Cancellation + claim flows tolerate email-send failure (state change still proceeds; error logged to console). ✅ Accept.

### PE-09 — No delete affordance — by design
**Source:** subagent + page.tsx. Bookings are immutable operational records; status changes (cancel / no-show) replace deletion.
**Tension with user item C-06:** "Delete + bulk delete where relevant". For bookings, the "where relevant" answer is **probably nowhere** — status changes are the right primitive. C-B plan for C-06 should focus on clients (where deletion has clearer semantics) and skip bookings, OR add a "hard delete (audit-preserved)" path purely for GDPR-erasure cases.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-04 — C-05 root cause located at `actions.ts:269-275` | Add status guard in server action; pair with `BookingRowActions.tsx` hide-Claim-on-cancelled. **Disambiguate UX intent with user first.** | C-05 (already a user item) |
| 2 | E-08 — "today" semantic divergence dashboard ≠ bookings list | Align verb semantics across pages | C-07 (routing) |
| 3 | V-05 — unbounded list query | Pagination + virtualisation | C-09 |
| 4 | V-06 — test data in prod DB visible | DB cleanup before launch | C-12+ (hygiene) |
| 5 | B-05 — one `animate-spin` lacks reduced-motion | One-line fix | C-12+ or fold into C-11 dark-mode pass |
| 6 | B-06 — "Manual reminders coming soon" stub | Wire to email-automation surface | C-08 |
| 7 | B-07 — caret-color warning may already be fixed | Verify in user's browser before any work | C-B verification |
| 8 | PE-09 + C-06 — booking-delete tension | C-06 brief should explicitly scope **out** booking deletion in favour of status changes; focus delete UX on clients | C-06 |

---

## 9 — Hand-off

**State at end of audit:**
- 7 screenshots captured in `screenshots-02-bookings-list/` (Owner: attention/all/cancelled/cancelled-detail/375-attention; Therapist: 1280/claimable; Coordinator: 1280).
- 0 code changes (audit-only).
- Browser session signed out.
- C-05 root cause identified at line+number; C-04 confirmed has zero in-page restore affordance (only "restore from audit log" message text).

**Key diagnostics for C-B:**
- C-05 anchor: `src/app/admin/bookings/actions.ts:269-275` (+ row-action button gating in `BookingRowActions.tsx`).
- C-04 anchor: `src/app/admin/bookings/[bookingId]/page.tsx:1170` ("Restore it from the audit log" copy — no UI button).
- C-09 anchor: `src/app/admin/bookings/page.tsx:438-477` (no `.limit()` on the bookings query).
- C-08 anchor: `src/app/admin/bookings/BookingRowActions.tsx:118-122` (manual reminders stub).

**Open question for user:** master-plan C-05 says "cancelled bookings can't be assigned or claimed". The audit found the OPPOSITE — Owner can claim cancelled bookings via row-action (server action doesn't gate). Therapist's claimable view does hide cancelled (UI filter). Two possible reads:
1. User experienced the bug as Therapist (can't claim cancelled) and the framing is correct from that vantage.
2. User experienced the bug differently — verify before C-B writes the plan.

**Next surface:** `/admin/bookings/[bookingId]` (booking detail — master plan surface #04). The C-05 fix touches this detail page too (the "+ Assign therapist" button + "Status & payment" form). Suggest auditing surface #04 next so the fix has a complete picture.

**No regressions vs Part 1 baseline:** `/admin/bookings` (list) remains ✅ READY for what it does today; the bugs found are pre-existing and aligned with already-planned user items (C-04 / C-05 / C-09).

*End of bookings list audit.*
