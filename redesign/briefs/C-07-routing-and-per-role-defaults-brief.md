# C-07 — Cross-page routing improvements + per-role defaults

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none hard — C-03, C-11, C-FIELDWORK are soft-coordinated only (see companion plan §0/§1 for fallback stubs).
> Decisions: C-B-DECISIONS.md §3 C-07; checkpoint resolution D5 (2026-07-26). Findings applied: see refinement changelog.

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §3 C-07 (split into C-07a routing primitives + C-07b per-role defaults; bundle of bugs from C-A.3)
- `redesign/audits/C-A/W02-new-booking-end-to-end-flow.md` §3 (W02-V-2 + W02-E-1)
- `redesign/audits/C-A/W05-assignment-claim-reassign-flow.md` §3 (W05-V-2)
- `redesign/audits/C-A/W08-owner-scope-switching-flow.md` (W08-V-1 terminology + B-140 scope handling)
- `redesign/audits/C-A/R01-owner-day.md` (B-154 Yesterday chip + B-155 dual date + B-139 dashboard scope-toggle)
- `redesign/audits/C-A/R03-coordinator-day.md` (B-161 saved-filter)
- `redesign/audits/C-A/R04-therapist-day.md` (B-167 default tab)
- `redesign/audits/C-A/R05-therapist-fresh-day.md` (B-170 Open to claim mismatch)
- `redesign/audits/C-A/07-client-detail-audit.md` (B-134 3 duplicate CTAs)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-07-routing-and-per-role-defaults-plan.md`
- Progress: `redesign/per-page-progress/C-07-routing-and-per-role-defaults-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-07 is the **cross-page routing polish + per-role defaults plan**. Two halves, shipped together as one brief + plan but executed in two phases:

**Phase A (C-07a — routing primitives)** — fix the rough edges in cross-surface navigation:
- **B-134** — `/admin/clients/[id]` has 3 duplicate `?clientId=` "Book again" CTAs. Consolidate to one primary CTA.
- **B-140** — `/admin/me` only links to personal reports. Add cross-links to other surfaces relevant to the viewer's role.
- **W05-V-2** — booking detail's AssignmentManager renders staff names as plain text. Make them link to `/admin/staff/[id]`.
- **W02-V-2** — after creating a manual booking (no-prefill OR `?clientId=` path), no "just created" affordance on the booking detail. Add a success toast via `?just_created=1` search-param pattern (mirrors C-03's `?just_converted=1`).
- **W02-E-1** — city whitelist invisible until SQL error. Lift `allowed_cities` to the booking form for inline validation.
- **W08-V-1** — Owner scope terminology drift ("Personal" / "My" / "Mine") across surfaces. Pick one and apply consistently.
- **B-170** — Therapist dashboard's "Open to claim" disagrees with `/admin/bookings?view=claimable`. Sync the two surfaces (or make the dashboard copy explicit about its narrower view).
- **Customer manage page polish** — out-of-admin tree (`/booking/manage/`, token as a query param — see §2.8 correction). Cross-page navigation between cancel + reschedule sub-flows surfaced as a master-plan add. Scope locked in §2.8.

**Phase B (C-07b — per-role defaults)** — adjust default state per role to reduce the click-cost of common workflows:
- **B-139** — dashboard has no scope-toggle (Personal vs Team). Add for roles where it applies.
- **B-154** — "Yesterday" date-range chip missing on dashboard filter strip.
- **B-155** — dual date controls (chip strip + filter form) confusable. Sync state.
- **B-161** — Coordinator has no saved-filter pattern. Add a "Save this filter" affordance.
- **B-167** — `/admin/bookings` defaults to "Attention" tab for all roles. Per-role default: Therapist → "Today", Coordinator → "Attention" (current), Owner/Admin → "Attention" (current).

**Note on scope absorption:** several C-07 items from the master plan are now in C-03's bundle:
- **B-108** booking → enquiry reverse-link → **C-03 §2.5** (Origin panel).
- **W01-V-1** Cancel form referer-aware → **C-03 §2.7**.
- **B-157** return-to-enquiries → **C-03 §2.8** (just-converted toast).

C-07 doesn't duplicate these. The scope below reflects the post-C-03 reality.

---

## 1 — Why this plan exists

### 1.1 The "feels rudimentary" master-plan finding

Master plan Part 3 + C-A.3 surfaced a recurring theme: routing between admin pages is functional but unpolished. Users (especially Owner per R01) hit dead-ends, redundant CTAs, missing cross-links. No single fix is large; the aggregate is significant.

### 1.2 Per-role defaults — workflow efficiency

R01/R03/R04/R05 each surfaced a default-state friction:
- R01: Owner's filter strip lacks "Yesterday" (one-click look-back).
- R03: Coordinator filters daily but can't save common filter combos.
- R04: Therapist's `/admin/bookings` default tab is "Attention" — irrelevant for their workflow; should be "Today" or "Assigned".
- R05: Therapist-Fresh dashboard mismatches the claimable list.

Per-role defaults reduce the "click-cost" of common workflows. Small touches, real time savings.

### 1.3 Why split into two phases (07a + 07b)

Decisions doc Q-not-explicit recommendation. Phase A's items are cross-surface routing fixes; Phase B's are dashboard/filter polish. Different mental models, different testing surfaces. Splitting keeps each phase tractable + reviewable.

Both phases ship in **one plan** (not two separate plans) because:
- Each item is small (1-3 file edits typical).
- Combined verification gate is cleaner.
- No hard dependencies between phases.

### 1.4 Customer-manage-page scope

Master plan §3 C-07 added "+ customer manage page (out-of-admin tree)" without specifics. C-07 covers minimum-viable polish at that surface:
- Confirm the cancel + reschedule sub-flows link to each other where appropriate.
- Confirm "back to booking summary" exists.
- Confirm the page handles expired/invalid tokens gracefully (existing behaviour — verify only).

No major redesign. If the customer-side flow needs significant work, that's a separate plan (likely C-12+).

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-07 + audit cross-references)

### 2.1 B-134 — consolidate 3 duplicate `?clientId=` CTAs (Phase A)

Per audit 07 + W02 §1 entry-point catalogue: `clients/[clientId]/page.tsx:556, 597, 868` — three separate `?clientId=` links to `/admin/bookings/new`.

**Locked decision:** keep ONE primary CTA. Drop the others.

- **Keep (primary):** the header action area's "Book again" button (line 597 — verified in C-06 brief code inspection). Already has the bright primary tone + icon.
- **Drop:** line 556 (likely a secondary nav-ish link near the breadcrumb) + line 868 (empty-state action — replace with `EmptyTab`'s existing "Book now" CTA from the bookings panel, which already uses the same URL).

**Net effect:** one obvious "Book again" affordance per surface. Eliminates the "which button do I click?" ambiguity audit 07 V-? flagged.

### 2.2 B-140 — `/admin/me` cross-links (Phase A)

`/admin/me` is the personal home for non-Owner roles + an alternate landing for Owner. Per audit #14: only links to `/admin/staff/[id]/performance`. No cross-link to:
- Therapist's assigned bookings (`/admin/bookings?view=assigned`).
- Therapist's claimable list (`/admin/bookings?view=claimable`).
- Therapist's own staff detail.
- Owner's dashboard.

**Locked decision:** add a "Quick links" section to `/admin/me` rendering role-appropriate links:

| Role | Links rendered |
|---|---|
| Therapist | Today's visits / Claimable work / My staff profile / Completed visits |
| Coord | Today's bookings / Triage queue / Active enquiries / My staff profile |
| Admin | Dashboard / Today's bookings / Staff roster / Recent activity |
| Owner | Dashboard / Reports / Settings / Today's bookings |

Section title: "Quick links" — same pattern as the existing "Need help?" panel on TherapistDashboard.

### 2.3 W05-V-2 — booking → staff link (Phase A)

`bookings/[bookingId]/page.tsx` — AssignmentManager (line 883-890 per C-05 work) renders staff names as plain text. Make them clickable.

**Locked:** `<Link href={\`/admin/staff/${assignment.assigned_staff_id}\`}>{staffName}</Link>`. Hover effect + focus ring. RBAC: `canViewStaff` predicate gates — if the viewer can't reach staff detail, the name renders unlinked.

### 2.4 W02-V-2 — "just created" affordance (Phase A)

Mirror C-03's `?just_converted=1` pattern. After `createManualBooking` redirects to `/admin/bookings/[bookingId]`, append `?just_created=1`. The detail page reads the param → shows a one-shot toast: *"Booking created."*

For the no-prefill path: toast just confirms.
For the `?clientId=` prefill path: toast confirms + has "↗ View client" link.
For the `?enquiryId=` prefill path: C-03 already handles via `?just_converted=1`.

Implementation: same `BookingDetailToasts.tsx` component from C-03 (extend with the new toast type).

### 2.5 W02-E-1 — city whitelist inline validation (Phase A)

`bookings/new/page.tsx` already fetches `services` + (optionally) `enquiry`/`prefillClient`. Extend to also fetch `business_settings.allowed_cities`. Pass to `ManualBookingForm` as a prop.

In `ManualBookingForm` step 3 (Location), validate `city` input client-side against the whitelist BEFORE submit:

```tsx
const cityNormalised = city.trim().toLowerCase();
const isAllowedCity = allowedCities.some(
  (allowed) => allowed.trim().toLowerCase() === cityNormalised ||
               cityNormalised.includes(allowed.trim().toLowerCase())
);

{!isAllowedCity && city.trim().length > 0 ? (
  <p className="text-xs text-[oklch(26%_0.14_25)]">
    "{city}" is outside our current service area. We deliver to: {allowedCities.join(", ")}.
  </p>
) : null}
```

Mirrors the SQL function's check at create_booking_request (W02 §2). Server still validates as defense-in-depth.

### 2.6 W08-V-1 — terminology unification (Phase A)

W08 §1 inventoried scope-toggle terminology drift:
- Dashboard: "Personal" stripe
- Reports: `?scope=personal`
- `/admin/me`: "My day" / "My bookings"
- Bookings list: "Assigned" view (semantically equivalent to "Mine")
- TherapistDashboard: "My week"

**Locked decision:** standardise on **"Mine"** as the user-facing label. Reasoning:
- Short, owns the relationship.
- Doesn't collide with "Personal" (could be interpreted as personal-data-privacy in GDPR contexts).
- Aligns with the natural language pattern (My visits / Mine).

**Apply where the label is visible to users.** URL params + DB column names stay as-is (no schema drift).

| Surface | Before | After |
|---|---|---|
| Dashboard stripe | "Personal contribution" | "My contribution" (or "Mine") |
| Reports scope filter | "Personal" / "Team" | "Mine" / "Team" |
| `/admin/me` greetings | "My day" | keep — already aligned |
| TherapistDashboard | "My week" | keep — already aligned |

URL params: `?scope=personal` stays (no breaking change). Display label is "Mine".

### 2.7 B-170 — Open to claim cross-surface consistency (Phase A)

Per R05: TherapistDashboard's "Open to claim" reads "Nothing open right now" while `/admin/bookings?view=claimable` shows 1 claimable booking.

**Locked decision:** option (b) from R05 §3 — make the dashboard's section copy explicit about its narrow view. "Open to claim" on the dashboard renders bookings claimable WITHIN THE NEXT 7 DAYS; the link to "browse all claimable work" routes to the unfiltered list.

**Implementation:**
- TherapistDashboard's "Open to claim" section adds a date filter to its underlying query (next 7 days).
- Section copy clarifies: "Open to claim — next 7 days · {N} available" OR "Open to claim — next 7 days · Nothing scheduled. Browse all claimable work →"
- The "Browse all claimable work" link routes to `/admin/bookings?view=claimable` (existing — unchanged).

Net: dashboard surfaces near-future claimable; full list available via the link. Mismatch resolved by making the dashboard's narrowness explicit.

### 2.8 Customer manage page polish (Phase A)

> ✅ **PATH CORRECTION (2026-07-26)** — real file is `src/app/booking/manage/page.tsx`; `token` is a `searchParams` query param, not a `[token]` dynamic route segment. See companion plan Step 8 for the corrected anchor. [C07-F1]

Out-of-admin tree at `/booking/manage/` (token passed as a query param, e.g. `/booking/manage?token=...`). Per W04 audit references:
- Surface exists + token-gated.
- Cancel + reschedule sub-flows work.
- `customer_cancellation_cutoff_hours` gates cancel.

**C-07 scope at this surface (minimum-viable):**
- Verify "Back to booking summary" link exists from cancel/reschedule sub-pages.
- Verify expired-token render is graceful ("This link has expired. Please contact the clinic.").
- Add a small "Need help? Contact {clinic_phone}" footer link at the bottom of the manage page.

If significant gaps surface during impl, document for C-12+ — don't expand C-07 scope.

### 2.9 B-139 — dashboard scope-toggle (Phase B)

Per R01: Owner dashboard has no Personal vs Team toggle. Owner who takes bookings sometimes wants their personal view; sometimes wants the team-wide view. Currently, only the Personal Stripe is personal-scoped; everything else is team-wide for Owner.

**Locked decision:** add a scope-toggle pill in the dashboard header for Owner + Admin (who manage scope-wide reports), per W08 §1 inventory.

**Component:** new `<DashboardScopeToggle>` that switches between:
- "Mine" — filters dashboard tiles + lists to actor's bookings only.
- "Team" — current default (all data).

State persists via URL search-param `?scope=mine` (defaults to `team`). Survives navigation. Coord doesn't get the toggle (their dashboard is already team-wide by role); Therapist doesn't (their dashboard is always personal).

C-11 consumes this in the BusinessDashboard variant.

### 2.10 B-154 — Yesterday chip (Phase B)

`dashboard-filters-client.tsx` already has chips: Today / This week / This month / Last 30 days / Custom. **Add: Yesterday.**

Placement: after "Today", before "This week". Single-day range (from=yesterday, to=yesterday). Common Owner workflow: "what happened yesterday?"

### 2.11 B-155 — dual date controls (Phase B)

Per R01: the date-range chip strip AND the filter form both have date controls. Changing one doesn't sync the other → admin gets confused state.

**Locked decision:** sync the two via URL state. Both UI components read `?from=` + `?to=` from URL; both write to URL on change. State is in URL; UI components are stateless views.

Pattern lift: existing `useSearchParams` + `useRouter` pattern. Verify both components currently dispatch their own state; refactor to URL-driven.

### 2.12 B-161 — Coordinator saved-filter pattern (Phase B)

Coord uses the bookings list with consistent filter combos (e.g., "unassigned + today" or "partially_assigned + this week"). Currently re-applies manually each visit.

**Locked decision:** add "Save this filter" affordance to `/admin/bookings`. Saved filters persist per-user in DB (new column `staff_profiles.saved_booking_filters jsonb` OR new table — see open Q9.4).

**Phase B v1 scope:** localStorage-backed (no DB migration). Saved filters live in the browser. Cleared on logout.
**Phase B v2 (deferred to C-12+):** DB persistence so saved filters survive devices.

C-07b ships v1 only. Future C-NN promotes to DB if user wants cross-device persistence.

### 2.13 B-167 — per-role default bookings tab (Phase B)

`bookings/page.tsx` defaults all roles to "Attention" view. Per role:

| Role | Default | Rationale |
|---|---|---|
| Owner | Attention (current) | Operational triage focus |
| Admin | Attention (current) | Same as Owner |
| Coord | Attention (current) | Triage queue is their focus |
| Therapist | **Today** (new) | Their day's work |
| Therapist-Fresh | Today (zero-state) | Empty Today is acceptable + lifts the proper hint |

**Implementation:** `bookings/page.tsx` derives default view based on `plan.variant` (or `profile.role_name`). URL still defaults: if no `?view=` param, fall through to per-role default.

---

## 3 — RBAC matrix

C-07 introduces no new permissions, no new gates. All items work within existing RBAC:

| Item | Notes |
|---|---|
| Quick links on `/admin/me` | Per-role link sets; gated by existing predicates |
| Booking → staff link | Renders unlinked when `canViewStaff` is false |
| Dashboard scope-toggle | Renders for Owner + Admin only |
| Saved filters | Per-user; gated by `canViewAllBookings` |
| Per-role default tab | Existing role detection |

---

## 4 — Layout strategy

### 4.1 Client detail action area (B-134 fix)

Before:
```
[Print] [Edit] [Delete] [Book again]   ← header
...
[ + Book now ]   ← empty-state action elsewhere
...
[ Book again CTA ]   ← duplicate somewhere
```

After (B-134):
```
[Print] [Edit] [Delete] [Book again]   ← header — ONE primary CTA
...
(no duplicate elsewhere; empty-state CTA still uses same URL but renders only when bookings list is empty)
```

### 4.2 `/admin/me` Quick links section

Add after the existing Recent Activity section (or wherever Most-prominent-call-to-action position is):

```
┌─ Quick links ──────────────────────────────┐
│ ↗ Today's visits                            │
│ ↗ Claimable work                            │
│ ↗ My staff profile                          │
│ ↗ Completed visits                          │
└─────────────────────────────────────────────┘
```

Per-role link set per §2.2. Single column at 375; 2-col grid at md+.

### 4.3 Dashboard scope toggle

Header strip on BusinessDashboard:

```
┌─────────────────────────────────────────────────────────┐
│ Today at Rahma Therapy                                  │
│ Thursday 26 May · Luton                                 │
│                                                          │
│ [ Team · Mine ]   ← scope toggle pill                   │
└─────────────────────────────────────────────────────────┘
```

Pill is interactive (click cycles or toggles). URL updates to `?scope=mine`. Visual style: matches existing chip styling on the filter strip (no new component vocabulary).

### 4.4 Yesterday chip + dual-date sync (Phase B)

Filter strip:

```
[Today] [Yesterday] [This week] [This month] [Last 30 days] [Custom]
```

Yesterday inserted between Today + This week.

Dual-date sync: changing the chip strip updates `?from=` + `?to=`. Changing the form date pickers updates the same params. Both reflect each other immediately.

### 4.5 Saved filters (Phase B v1)

Above the bookings list table:

```
┌─ Saved filters ────────────────────────┐
│ ⭐ Unassigned this week     [ × ]      │
│ ⭐ Coord triage             [ × ]      │
│ + Save current filter                  │
└────────────────────────────────────────┘
```

Click a saved filter → applies its URL params. "+" button captures current filter state → prompts for name → saves to localStorage.

Section appears only when ≥ 1 saved filter exists OR when user has applied a non-default filter (the "+" prompt shows).

### 4.6 Per-role default tab

Therapist visits `/admin/bookings` with no `?view=` → renders Today tab pre-selected. Cosmetic-only change; URL doesn't change post-render (user can navigate to other tabs as normal).

### 4.7 Customer manage page footer

```
... existing page content ...

─────────────────────────────────────────────────────
Need help? Call us on 07700 900 456 or email
contact@rahmatherapy.example.test
─────────────────────────────────────────────────────
```

> ✅ **DATA-SOURCE CORRECTION (2026-07-26)** — the page already fetches these values via `getCustomerManageBooking(token)` as `booking.settings.contactPhone` / `booking.settings.contactEmail` (already used to build the existing "Contact" SideCard) — no new `business_settings` fetch is needed. See companion plan Step 8. [C07-F4]

Reads contact details from the already-fetched `booking.settings.contactPhone` / `booking.settings.contactEmail`. Defense-in-depth for clients who get stuck.

---

## 5 — States & edge cases

### 5.1 Owner scope toggle on a personal-bookings-empty week

Toggle to "Mine" → dashboard tiles all show 0. EmptyState narrative copy (per C-11's pattern from R05): "No personal activity this week. Take care of yourself." Toggle back to "Team" → restores normal view.

### 5.2 Saved filter for a tab that no longer applies

User saves "Therapist-only / unassigned" filter. Admin reorganises Therapist roles (Therapist deactivated). When user reapplies the saved filter, the underlying query returns no results. Empty-state copy reads: "No bookings matching this saved filter."

### 5.3 Saved filter with deleted reference

Saved filter targets `?service=hijama` and admin deletes the hijama service. Filter applied → 0 results + empty-state.

### 5.4 Yesterday chip on the first day of a date range

Yesterday + Custom = same range. Yesterday chip is just a shortcut. No conflict.

### 5.5 Per-role default tab on URL with explicit `?view=`

URL takes precedence. Therapist with `?view=claimable` sees claimable, not Today. Default only applies when URL has no view param.

### 5.6 Customer manage page contact info missing

`business_settings.contact_phone` could be NULL (per W10 W10-E-3). Footer renders only the available channel: "Need help? Email contact@..." OR "Call 07700..." — never both broken. If BOTH null, footer omits.

### 5.7 Scope toggle on Owner who isn't an active practitioner

Owner with `can_take_bookings=false` toggles to "Mine" → dashboard tiles show 0 (no personal bookings) + EmptyState. Acceptable; reflects reality.

### 5.8 City whitelist with a partial match (e.g., "Luton Hoo")

W02-E-1 used a permissive match (`needle.includes(allowed)` OR `allowed.includes(needle)`). "Luton Hoo" includes "Luton" → allowed. Mirrors SQL function's check. Acceptable.

### 5.9 Just-created toast on a hard refresh

URL has `?just_created=1` → toast fires → URL param stripped after first render → refresh shows no toast. Same idempotency pattern as C-03 just-converted.

### 5.10 Quick links section RBAC for a Therapist who lost permissions mid-session

If a permission is revoked mid-session, the cached RBAC predicate may stay stale. Acceptable — operational events; user can refresh.

---

## 6 — Migration footprint

**Phase A:** None. All routing-primitive changes are pure code.

**Phase B v1 (saved filters):** None. localStorage-backed. No schema.

**Phase B v2 (deferred):** Would require `staff_profiles.saved_booking_filters jsonb` column OR new table. Not in C-07 scope.

**No new permissions, no new audit_log action_types.**

---

## 7 — Files touched (preview — full list in plan)

### NEW (~3 files)
- `src/app/admin/me/QuickLinks.tsx` — role-aware quick-links section
- `src/app/admin/dashboard/blocks/DashboardScopeToggle.tsx` — pill component (consumed by C-11's BusinessDashboard)
- `src/app/admin/bookings/SavedFiltersBar.tsx` — saved-filters UI (localStorage-backed)
- `src/lib/booking/__tests__/saved-filters.test.ts` — coverage for localStorage helper
- (optional) `src/lib/booking/saved-filters.ts` — helper for localStorage CRUD

### EDITED (~10 files)
| File | Change |
|---|---|
| `src/app/admin/clients/[clientId]/page.tsx` | Drop 2 duplicate `?clientId=` CTAs (B-134); keep header "Book again" |
| `src/app/admin/me/page.tsx` | + QuickLinks render (B-140) |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Staff names → `<Link>` in AssignmentManager (W05-V-2); read `?just_created=1` toast (W02-V-2) |
| `src/app/admin/bookings/[bookingId]/BookingDetailToasts.tsx` (from C-03) | + just_created toast type (W02-V-2) |
| `src/app/admin/bookings/actions.ts` | Append `?just_created=1` to redirect URL in `createManualBooking` no-prefill + clientId paths (W02-V-2) |
| `src/app/admin/bookings/new/page.tsx` | + fetch `business_settings.allowed_cities`; pass to form (W02-E-1) |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | + inline city validation; + `allowedCities` prop (W02-E-1) |
| `src/app/admin/dashboard/PersonalContributionStripe.tsx` (or similar) | Label rename "Personal" → "Mine" (W08-V-1) |
| `src/app/admin/reports/...` | Scope filter label rename (W08-V-1) |
| `src/app/admin/dashboard/TherapistDashboard.tsx` | "Open to claim" section copy + date filter (B-170) |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | + Yesterday chip (B-154); URL sync (B-155); + DashboardScopeToggle mount (B-139) |
| `src/app/admin/dashboard/BusinessDashboard.tsx` (from C-11) | + DashboardScopeToggle in header |
| `src/app/admin/bookings/page.tsx` | Per-role default view (B-167); + SavedFiltersBar render |
| `src/app/booking/manage/...` | + Need help footer; verify back-links + expired-token render |

### UNCHANGED
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- Existing URL param names (`?scope=personal`) — only labels change.

---

## 8 — Sequencing and dependencies

**Phase A → Phase B order:** Phase A items are independent; Phase B's saved filter + scope toggle build on Phase A's URL-routing foundations.

**Cross-plan synergies:**
- **C-03** owns B-108 + W01-V-1 + B-157 (Origin panel + Cancel routing + just-converted toast). C-07's `BookingDetailToasts.tsx` extension adds the `just_created` type — same component, additive.
- **C-11** consumes `DashboardScopeToggle` in BusinessDashboard variant + R05's `Open to claim` section pattern (B-170). C-07 ships the component; C-11 mounts it.
- **C-FIELDWORK** PractitionerTodaySection consumes "Open to claim" section pattern — C-07's B-170 fix aligns the dashboard copy with the claimable list semantics.

**No hard blockers.** C-07 can ship before or after C-11; the component lives in `dashboard/blocks/` and is imported where needed.

---

## 9 — Open questions

**Q9.1 — "Mine" terminology** — final lock. Alternative considered: "My". Locked at "Mine" for brevity. User can override if "My" reads more naturally.

**Q9.2 — Customer manage page scope** — minimum-viable. If audit during impl reveals significant routing gaps in the public flow, surface to user; don't expand C-07. C-12+ likely.

**Q9.3 — Scope toggle UI: pill cycle or dropdown?** Locked at **pill** — matches existing date-range chip strip vocabulary. Click toggles state.

**Q9.4 — Saved filters persistence** — locked at localStorage v1 in C-07. DB persistence is C-12+. Note: localStorage doesn't survive device switches; user understands.

**Q9.5 — Per-role default tab — make it user-overridable?** Some Therapists may prefer "Assigned" default. **Locked at hardcoded role default** in C-07. User-customisation is C-12+.

**Q9.6 — Quick links on `/admin/me` — should they include role-irrelevant links for context?** Locked at role-relevant only. Avoid noise.

**Q9.7 — Yesterday chip behaviour at month-end** — Yesterday of June 1 = May 31. No special edge case. Standard `new Date()` minus 1 day.

**Q9.8 — Dual-date sync — what if URL has invalid values?** Existing date parser handles invalid input (defaults to today). No new edge case.

**Q9.9 — B-170 dashboard claimable filter — exactly 7 days or configurable?** Locked at 7 days (one week). Configurability is C-12+.

**Q9.10 — Staff link RBAC — should Therapist see colleague staff names linked or unlinked?** Per existing `canViewStaff` predicate. Therapist typically does NOT have `view_staff` → staff names render unlinked. Acceptable.

---

## 10 — Acceptance criteria

C-07 is complete when:

**Phase A:**
1. **B-134:** `/admin/clients/[id]` has exactly ONE "Book again" affordance (in the header). No duplicates.
2. **B-140:** `/admin/me` shows a "Quick links" section with role-appropriate links.
3. **W05-V-2:** Booking detail's AssignmentManager renders staff names as `<Link>` to `/admin/staff/[id]` (when `canViewStaff` true).
4. **W02-V-2:** Creating a manual booking (no-prefill or `?clientId=`) lands on detail with `?just_created=1` toast.
5. **W02-E-1:** Booking form's city input shows inline validation against `allowed_cities` before submit.
6. **W08-V-1:** "Personal" labels read "Mine" across dashboard + reports.
7. **B-170:** TherapistDashboard "Open to claim" shows next-7-days bookings + clarifying copy.
8. **Customer manage page:** Footer with contact info; back-links verified; expired-token render verified.

**Phase B:**
9. **B-139:** BusinessDashboard has a Mine/Team scope toggle.
10. **B-154:** Filter chip strip includes "Yesterday".
11. **B-155:** Chip strip + form date controls sync via URL state.
12. **B-161:** Bookings list has Saved Filters bar (localStorage-backed v1).
13. **B-167:** Therapist visiting `/admin/bookings` lands on "Today" tab by default.

**All:**
14. All static gates pass.
15. Playwright role × surface sweep — each item verified per role.
16. No regressions on the surfaces touched.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §3 C-07 | Recommended split + bundle inventory |
| Master plan §3 C-07 | Original bundle list (some items absorbed by C-03) |
| `R01-owner-day.md` | B-139 / B-154 / B-155 / B-157 (B-157 → C-03) |
| `R03-coordinator-day.md` B-161 | Saved-filter need |
| `R04-therapist-day.md` B-167 | Default tab |
| `R05-therapist-fresh-day.md` B-170 | Open to claim mismatch |
| `07-client-detail-audit.md` | B-134 |
| `W02-new-booking-end-to-end-flow.md` | W02-V-2 + W02-E-1 |
| `W05-assignment-claim-reassign-flow.md` | W05-V-2 |
| `W08-owner-scope-switching-flow.md` | Terminology inventory |
| `C-03-enquiry-to-booking-conversion-brief.md` §2.5 / §2.7 / §2.8 | Items absorbed from C-07 master-plan-original |
| `C-11-dashboard-variants-design-system-brief.md` | Consumes DashboardScopeToggle + R05 patterns |
| `C-FIELDWORK-EXPERIENCE-brief.md` §2.3 | PractitionerTodaySection consumes "Open to claim" pattern |

---

## 12 — Out of scope

- **B-108 / W01-V-1 / B-157** — absorbed by C-03.
- **Saved filters DB persistence (cross-device)** — C-12+.
- **User-overridable default tab** — C-12+.
- **Customer manage page redesign** beyond minimum-viable polish — C-12+.
- **Quick links customisation per user** — C-12+.
- **Scope toggle on Coord/Therapist dashboards** — they're already scope-locked.
- **URL param renaming** (e.g., `?scope=personal` → `?scope=mine`) — keeps URLs backward-compatible.
- **New permissions** — none introduced.
- **Schema migrations** — none in C-07 (Phase B v1 uses localStorage).
- **Email touchpoints** — out of routing scope.
- **Pagination on saved-filter views** — C-09 / C-12+.

---

*End of C-07 brief. Plan file follows: `redesign/plans/C-phase/C-07-routing-and-per-role-defaults-plan.md`.*
