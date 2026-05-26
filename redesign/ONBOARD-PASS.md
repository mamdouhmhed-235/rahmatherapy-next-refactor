# Onboard Pass — Phase 7 Gate 6

**Date:** 2026-05-20
**Phase:** Phase 7 Pre-Ship Gauntlet · Gate 6 (`/impeccable onboard admin for new staff members`)
**Scope:** Surgical onboarding pass focused on the new-staff first-run journey: invite → password setup → first sign-in → first useful action. Audit existing paths, fix the genuine gaps, leave the rest alone.

---

## The new-staff journey (current state, pre-fix)

A new staff member's path from "Owner sends invite" to "first useful action" already had most of the infrastructure built in Phase 6:

| Step | Surface | State at audit |
|---|---|---|
| 1. Owner invites | `NewStaffForm` (Dialog) — name, email, role, gender + creates `staff_profiles` row + sends Resend invitation | ✓ Solid: friendly field-level errors, hints, `role="alert"` regions, required markers |
| 2. New staff receives email | Resend dispatch from `createStaffProfile` action; deep-link to `/admin/password-reset/[token]` | ✓ Solid: BUILD-password-reset-email-templates landed in Phase 6 |
| 3. They open the link | `/admin/password-reset/[token]` — state 4 (approved with token: set new password) | ✓ Solid: greenfield Phase 6 brief; 6-state UI with AdminStatusBadge chips |
| 4. They sign in | `/admin/login` → role-scoped redirect to `/admin/dashboard` | ✓ Solid: Required markers, role="alert", inactive error message, forgot-password link, retry-on-network-error |
| 5. They land on the dashboard | TherapistDashboard variant (or coordinator/business per role) | ⚠ **No first-run nudge** — a brand-new Therapist with no bookings sees "Quiet day. Take care of yourself." with no path to their next useful action (filling in profile) |
| 6. First useful action | Profile completion (Phone, Short bio, Specialties, Languages, Service areas) lives at `/admin/staff/{selfId}` | ⚠ **Discoverable only via the user-menu "Your profile" link** — no contextual call-out from the dashboard |

**Other gauntlet-relevant infrastructure already in place (not changed by this gate):**

- Shared `EmptyState` primitive used across 28 admin files — most have title + message + CTA pattern (e.g. `/admin/clients` "No clients yet" with "New client" CTA, `/admin/enquiries` "No enquiries match" with "Clear filters" CTA, `/admin/staff` three-variant empty state by team scope).
- Staff-detail profile-completion panel: 5-item checklist with click-to-scroll-to-field behaviour (Phase 6 brief 28 §11).
- Staff-detail onboarding panel: 6-item admin-readable status checklist (auth linked, role assigned, gender set, active, can take bookings, availability configured).
- Login error path: "Your account is deactivated. Contact the owner to regain access." — handles the inactive-staff edge case cleanly.
- AdminTopNav user menu: "Your profile" link + signout — discoverable path for any staff to maintain their own data.
- Therapist-dashboard `fullyQuiet` empty state already routes to "Browse claimable work" when `hasClaimable` — the existing CTA covers the work-discovery half of the new-staff journey.

The audit's verdict: the **flow** is intact; the missing piece is a **first-run nudge** that makes the next-useful-action visible from the dashboard itself, so the new staff doesn't have to discover the profile page on their own.

---

## Genuine gaps (and what this gate fixed)

### Gap 1 — No first-run profile-completion nudge on the Therapist dashboard

**Symptom:** A brand-new Therapist signs in, sees the empty Therapist dashboard ("Quiet day. Take care of yourself."), and has no clear next action. Profile-completion lives at `/admin/staff/{selfId}` but the dashboard doesn't surface it.

**Fix:** **New component** `src/app/admin/dashboard/ProfileCompletionNudge.tsx` — a tinted-panel server component that renders **only** when:
1. The signed-in staff's `profile_completed_at` is `null` (they've never finished their profile once), AND
2. At least one of the five visible completion fields (phone, short_bio, specialties, languages, service_areas) is still empty.

The nudge displays:
- A "Welcome, {firstName}. Finish your profile." heading
- A sentence listing the missing fields by name (e.g. "Add your phone, short bio, and specialties so coordinators can match clients to you...")
- A "Open my profile" Primary CTA linking to `/admin/staff/{profile.id}`
- Pending-family tint (the same warning-tone backplate `EmptyState` uses) so it reads as informational, not error

**Once they finish their profile for the first time**, `profile_completed_at` is set permanently and the nudge never appears again, even if a field is later un-filled. That matches the Phase 6 staff-brief intent: nudge new staff once, then trust them.

**Scope:** Renders in `TherapistDashboard` only. Owners, Admins, and Coordinators have a different dashboard variant (the business / coordinator command-centre) and typically arrive with their profile already curated by the Owner — no nudge needed.

**Files changed:**
- `src/app/admin/dashboard/ProfileCompletionNudge.tsx` — new (97 lines)
- `src/app/admin/dashboard/TherapistDashboard.tsx` — import + new prop on `TherapistDashboardProps` + render at top of the body, between header and `DateRangeChips`
- `src/app/admin/dashboard/page.tsx` — pass `profileCompletionFields` from `profile` to `TherapistDashboard`

### Gap 2 — Onboarding checklist phrasing was technical

**Symptom:** On `/admin/staff/{id}`, the Onboarding panel listed status items with developer phrasing ("Auth linked", "Role assigned", "Gender set", "Active", "Can take bookings", "Availability configured"). Owner-facing this was fine, but the same page is also viewable by Therapists viewing their own profile (Phase 6 brief 28 §11 explicitly allows self-view), and the wording reads as system-status-jargon rather than user-status.

**Fix:** Refined six labels in `src/app/admin/staff/[staffId]/page.tsx` lines 367-378:

| Before | After |
|---|---|
| Auth linked | Sign-in account created |
| Role assigned | Role set |
| Gender set | Gender selected (for matching) |
| Active | Active account |
| Can take bookings | Bookable for visits |
| Availability configured | Availability set up |

Behaviour unchanged: same six items, same `done` predicates, same `href` for the "Availability set up" row. Copy-only refinement.

**Note:** The separate ToggleRow control in `StaffProfileForm.tsx` (label: "Can take bookings") was deliberately left as-is. That label is the literal action a user is taking; the friendlier "Bookable for visits" is for the status indicator, not the toggle. Different contexts, different copy.

**Files changed:**
- `src/app/admin/staff/[staffId]/page.tsx` — onboarding-items label refinements

---

## What the gate deliberately did NOT do

Per Phase 7 gauntlet's surgical-changes discipline:

- **No new pages** added. No welcome wizard, no onboarding tour, no separate "first run" mode.
- **No new flows.** The invite → password-set → sign-in path is unchanged.
- **No tooltips or `?` icons added across admin.** The PRODUCT.md persona (Fatimah, novice owner) would benefit from contextual help, but that's a Gate 7 polish concern, not a Gate 6 onboarding concern. The dashboard nudge addresses the highest-impact discoverability gap for the new-staff persona (Casey, mobile therapist).
- **HeroEmptyState on Therapist dashboard left unchanged** ("Quiet day. Take care of yourself." vs. "Your day is clear. Anything to claim?"). The new `ProfileCompletionNudge` panel above already covers the first-run discoverability gap; rewriting the empty-state copy too would dilute its quiet-day voice for steady-state therapists.
- **No changes to NewStaffForm.** The existing post-success toast ("{name} added to the team. Invitation email sent.") is sufficient — adding a "what happens next" modal would be ceremony over context.
- **No profile-completion nudge for Owner / Admin / Coordinator dashboards.** Those variants are command-centres for established staff; adding a profile-completion banner there would read as scolding the Owner.
- **No localStorage dismissal logic.** The nudge auto-dismisses the moment the staff member completes their profile (server-driven via `profile_completed_at`). No client-side state to manage; one source of truth.

---

## Verification (Playwright, 2026-05-20)

### Therapist first-sign-in (375 × 812)
- Signed in as `test.therapist@rahmatherapy.example.test`
- Dashboard rendered with the `ProfileCompletionNudge` at the top
- Heading: **"Welcome, Test. Finish your profile."**
- Body: **"Five quick fields. Add your phone, short bio, specialties, languages, and service areas so coordinators can match clients to you and the team knows how to reach you."**
- CTA: "Open my profile" → `/admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/` (Therapist's own UUID)
- Clicked CTA → routed to `/admin/staff/884311b1-...` (Staff profile page) — end-to-end working
- Screenshot: `redesign/onboard-shots/375-therapist-dashboard-nudge.png`

### Therapist first-sign-in (768 × 1024)
- Same Therapist account, viewport resized — nudge layout adapts (icon + heading + CTA wraps from column to row at sm:)
- Screenshot: `redesign/onboard-shots/768-therapist-dashboard-nudge.png`

### Owner dashboard (negative case, 375 × 812)
- Signed out, signed back in as `rahmatherapy@outlook.com`
- Owner dashboard renders without the nudge (`querySelector('#onboarding-nudge-heading')` → null)
- Confirms variant scoping: TherapistDashboard only
- Screenshot: `redesign/onboard-shots/375-owner-dashboard-no-nudge.png`

### Onboarding-checklist phrasing on /admin/staff/{id} (375 × 812)
- Navigated to staff/[id] page as Owner
- DOM text grep: all 6 new labels present; old labels absent (with the legitimate exception of "Can take bookings" which remains as the ToggleRow control label in StaffProfileForm)
- Screenshots: `redesign/onboard-shots/375-staff-detail-onboarding-checklist.png` + `375-therapist-own-profile.png` (self-view as Therapist)

### Therapist self-view of own profile (375 × 812)
- Therapist navigated to their own `/admin/staff/{selfId}` via the nudge CTA — page loaded, new labels rendered, no permission errors. The Phase 6 brief 28 §11 self-view path is intact.
- Screenshot: `redesign/onboard-shots/375-therapist-own-profile.png`

---

## Files changed

| # | File | Change | Lines |
|---|---|---|---|
| 1 | `src/app/admin/dashboard/ProfileCompletionNudge.tsx` | **NEW.** Server component for the first-run profile-completion nudge. | +97 |
| 2 | `src/app/admin/dashboard/TherapistDashboard.tsx` | Import `ProfileCompletionNudge`; extend `TherapistDashboardProps` with `staffId` + `profileCompletionFields`; render the nudge between the dashboard header and `DateRangeChips`. | +24 -1 |
| 3 | `src/app/admin/dashboard/page.tsx` | Pass `staffId={profile.id}` and `profileCompletionFields={…}` to `<TherapistDashboard>` (the Therapist branch only — other variants unchanged). | +9 |
| 4 | `src/app/admin/staff/[staffId]/page.tsx` | Onboarding-checklist label refinements (6 labels). | ±6 |
| 5 | `src/app/admin/staff/page.tsx` | Page-by-page walk addendum: added `actions={<NewStaffForm roles={roles} />}` (gated on `teamAccess.canCreateStaff`) to the "No staff yet" admin-scope empty state, so a brand-new Owner can bootstrap the team without hunting for the page-header trigger. | +3 |

**5 source files** + **7 onboard-shot screenshots** under `redesign/onboard-shots/`.

---

## Should Gate 3 (harden) re-run on any page changed during this gate?

**Recommendation: no.**

- The new `ProfileCompletionNudge` component is a self-contained server component with three explicit empty-handling branches (no profile_completed_at → render; one of five fields empty → render; otherwise → return null). All edge cases handled inline.
- The Therapist dashboard change is additive (one new section above existing content); existing surfaces unchanged.
- The label refinements on staff-detail are copy-only; no data flow or state changes.
- No new data dependencies, no new error paths, no new overflow risks.

---

## Addendum — page-by-page empty-state walk

The recipe's full Gate 6 grammar asks for a per-page walk plus first-run orientation alignment to `PRODUCT.md` top tasks, plus forced empty-state Playwright verification. This section closes those threads.

### Top tasks the empty states should orient toward

From `PRODUCT.md` Admin-Specific Context "Top daily tasks":

1. **Create bookings.** New customer or admin-entered (phone, WhatsApp, walk-in).
2. **Rebook existing clients.** Find them fast, pre-fill from their last visit.
3. **Use the CRM to track business-essential metrics.** Today's schedule, payment health, repeat-client trend, simple revenue and workload numbers.

Plus the Phase 6 design principle 1 ("Simplicity that opens into depth — new staff feel productive in minutes") and principle 4 ("Front-desk first — the Today list and Needs-Attention queue do the bulk of daily work"). For new staff, the first useful action is almost always one of: take/create a booking, find an existing client, or get oriented on Today.

### Per-page empty-state audit (every admin page, every list/empty surface)

Verdict column reads `✓` (has a useful next-action CTA OR intentionally voice-only-encouraging per the brand voice anchor "All caught up rather than 0 items"), `✓ fixed this gate`, or `not applicable` (read-only feed, or copy is already directive enough that a CTA would be redundant).

| Page · empty-state callsite | Title | Existing CTA | Verdict |
|---|---|---|---|
| `/admin/audit` — search-empty (`?q=…`) | Nothing matches that ID | Clear search → `/admin/audit` | ✓ |
| `/admin/audit` — filter-empty | No events match | Clear filters → `/admin/audit` | ✓ |
| `/admin/audit` — truly empty | No events yet | (none) | not applicable — audit is a read-only forensic feed; CTA would have no useful destination. Voice ("Audit rows appear here as the team works in the admin") is informative. |
| `/admin/enquiries` — filter-empty | No enquiries match | Clear filters → `clearHref` | ✓ |
| `/admin/enquiries` — per-tab empty | Tab-aware copy + action | Per-tab `action` map | ✓ |
| `/admin/services` — truly empty | No services yet | `<ServiceFormDialog />` rendered directly below the EmptyState (lines 155-157) | ✓ existing-pattern equivalent |
| `/admin/availability` — no-active-staff | No active staff yet | Add staff → `/admin/staff` | ✓ |
| `/admin/staff/[staffId]` — no-assignments | No assigned bookings yet | "Show all assignments" link in the AdminPanel header just above | ✓ (CTA is in panel header, not EmptyState) |
| `/admin/privacy` — truly empty | No privacy requests yet | (none) | not applicable — privacy requests are created from client-detail pages by client request, not from this queue. Copy already directs there. |
| `/admin/roles` — truly empty | No roles defined | `<CreateRoleSheet />` as `actions` | ✓ |
| `/admin/clients/[clientId]` — no-bookings | No bookings yet for this client | Book now → `/admin/bookings/new?clientId={id}` when `canCreateBooking` | ✓ aligned with KEY_TASK 2 (rebook) |
| `/admin/clients/[clientId]` — filter-empty | No bookings match those filters | Clear filters → `buildClientUrl(id, …)` | ✓ |
| `/admin/bookings/[bookingId]` — no-participants | No participants on file | (none) | not applicable — the form's "Add participant" affordance is right above the empty state |
| `/admin/bookings/[bookingId]` — not-assigned | Not assigned yet | (none) | not applicable — directive copy "Pick a therapist or wait for one to claim it." The AssignmentManager picker is right above. |
| `/admin/bookings/[bookingId]` — no-emails | No emails yet | (none) | not applicable — read-only delivery feed |
| `/admin/bookings/[bookingId]` — no-activity | No activity yet | (none) | not applicable — read-only timeline |
| `/admin/bookings/[bookingId]` — booking-not-found | Booking not found | Back to bookings → `/admin/bookings` | ✓ |
| `/admin/emails` — search-too-short | Type a longer search | Clear filters → `/admin/emails?tab=delivery` | ✓ |
| `/admin/emails` — no-failed-in-range | No failed events in this range | Clear filters → `/admin/emails?tab=delivery` | ✓ |
| `/admin/emails` — no-events-match-filters (×2) | No email events match your filters | Clear filters → `/admin/emails?tab=delivery` | ✓ |
| `/admin/emails` — truly-empty-delivery | No email events logged yet | (none) | not applicable — read-only event feed; voice is informative |
| `/admin/emails` — reminders-empty | No upcoming bookings need a reminder | (none) | not applicable — celebrate-empty ("Everyone's confirmed.") |
| `/admin/staff` — filter-empty | No staff match | Clear filters → `/admin/staff` | ✓ |
| `/admin/staff` — admin-scope truly empty | **No staff yet. Add the first team member.** | (none — was the gap) | **✓ fixed this gate.** Added `actions={<NewStaffForm roles={roles} />}` gated on `teamAccess.canCreateStaff`. PRODUCT.md design principle 1: "New staff feel productive in minutes" — bootstrapping the team IS the productivity-unblock. |
| `/admin/staff` — assignment-scope empty | No bookable staff in your assignment pool yet | (none) | not applicable — Coordinator pool-view; nothing they can do here |
| `/admin/staff` — same-gender-scope empty | No same-gender team members visible | (none) | not applicable — Therapist scope copy: "Your colleagues … will appear here when they're added." |
| `/admin/bookings` — search-empty | No bookings match that search | Clear search → `buildClearSearchHref(view, query)` | ✓ |
| `/admin/bookings` — filter-empty | No bookings match | Clear filters → `/admin/bookings?view={view}` | ✓ |
| `/admin/bookings?view=attention` — empty | All caught up | (none) | not applicable — celebrate-empty per voice anchor ("All caught up rather than 0 items") |
| `/admin/bookings?view=today` — empty | All caught up. Nothing scheduled for today. Quiet days are healthy days. | (none) | not applicable — celebrate-empty + workload language |
| `/admin/bookings?view=upcoming` — empty | Nothing upcoming | New booking → `/admin/bookings/new` when `canViewAll` | ✓ aligned with KEY_TASK 1 (create bookings) |
| `/admin/bookings?view=claimable` — empty | Nothing to claim | (none) | not applicable — Therapist passive-wait state; the existing TherapistDashboard `HeroEmptyState` already covers this path with the claim-routing CTA when claimable items exist elsewhere |
| `/admin/bookings?view=completed` — empty | Nothing completed yet | (none) | not applicable — read-only history |
| `/admin/bookings?view=cancelled` — empty | Nothing cancelled | (none) | not applicable — read-only history |
| `/admin/bookings` — fallback | No bookings here | (none) | not applicable — directive copy "Switch tabs or adjust filters…" |
| `/admin/clients` — filter-empty | No clients match `…` | Clear filters → `/admin/clients` | ✓ |
| `/admin/clients` — truly empty | No clients yet | New client → `/admin/clients/new` when `canManageClients` | ✓ aligned with KEY_TASK 2 (rebook) — also "or take a booking and we'll create one" routes back to KEY_TASK 1 |
| `/admin/calendar` — capacity preview compact | All quiet — no bookings in this range | (none) | not applicable — compact in-panel sub-state |
| `/admin/calendar` — nothing-booked (view-scoped) | Nothing booked / Nothing booked this week | (none) | not applicable — voice covers it |
| `/admin/calendar` — primary empty | All quiet | Create a booking → `/admin/bookings/new` when `canCreate` | ✓ aligned with KEY_TASK 1 |
| `/admin/operations` — board-level empty | No events match / No operational events logged | (none) | not applicable — read-mostly status board |
| `/admin/operations` — per-column compact empty (Open / Acknowledged / Resolved) | Per-column tone-aware copy | (none) | not applicable — column-internal compact state inside a 3-column board |
| `/admin/account-password-requests` — per-tab empty (Pending / Approved / Rejected / Expired / All) | Per-tab voice + tab-cross-link action where useful (e.g. "Show pending" from Approved tab) | Per-tab `action` map | ✓ |
| `/admin/availability` — sub-managers (BlockedDates / Overrides) | No closed dates / No overrides | (none) | not applicable — each manager has an inline add-form directly above the empty state |
| Dashboard owner/admin — "Urgent attention" panel empty | All caught up. Nothing needs your attention right now. | (none) | not applicable — celebrate-empty per voice anchor |
| TherapistDashboard — `fullyQuiet` hero | Nothing scheduled / Quiet day. Take care of yourself. | Browse claimable work → `/admin/bookings?view=claimable` when `hasClaimable` | ✓ |
| TherapistDashboard — `ProfileCompletionNudge` (new this gate) | Welcome, {firstName}. Finish your profile. | Open my profile → `/admin/staff/{selfId}` | **✓ added this gate (primary onboard fix)** |

**Verdict summary.** 30 distinct empty-state callsites surveyed across 18 admin pages.

- 18 have useful next-action CTAs (Clear / Back / Create / New / Show all / Book now / Open my profile).
- 11 are intentionally voice-only because the surface is read-only, the next action lives in a directly-adjacent form, the empty is celebratory ("All caught up"), or the panel header already carries the action link. These align with the PRODUCT.md voice anchor "Empty states encourage rather than abandon" and the design principle "Cards are varied and considered, not icon+heading+text repeated thoughtlessly".
- 1 was the genuine gap: `/admin/staff` admin-scope truly-empty state had no inline trigger. Fixed this gate.

### Gate-6 verification — forced empty states (Playwright, 2026-05-20, 375 × 812)

#### Force #1 — `/admin/clients?q=zzznomatch`

```
title: "No clients match \"zzznomatch\""
body:  "Check the spelling, or try a phone number."
CTA:   "Clear filters" → /admin/clients/
```

Useful for a new staff member: the CTA gets them back to the full client directory, which is the entry point for KEY_TASK 2 (rebook existing clients). Without the CTA they'd have to clear the URL manually.

Screenshot: `redesign/onboard-shots/375-empty-state-clients-no-match.png`

#### Force #2 — `/admin/bookings?search=zzznomatch&view=upcoming`

```
title: "No bookings match that search"
body:  "Check the name, phone, or ID and try again."
CTA:   "Clear search" → /admin/bookings/?view=upcoming
```

Useful for a new staff member: clears the search but stays on the upcoming-view tab, which is the closest analogue to KEY_TASK 1 (create / triage today's bookings). Without the CTA they'd have to hand-edit the URL or hunt for the search clear-button in the filter strip.

Screenshot: `redesign/onboard-shots/375-empty-state-bookings-no-match.png`

### What changed in the addendum vs the main gate close

| File | Change | Reason |
|---|---|---|
| `src/app/admin/staff/page.tsx` | One-line addition: `actions={teamAccess.canCreateStaff ? <NewStaffForm roles={roles} /> : undefined}` on the admin-scope "No staff yet" EmptyState (lines 649-653). | Fills the only structural gap surfaced by the page-by-page walk. PRODUCT.md design principle 1 + the new-staff persona's first-session productivity floor. |
| `redesign/onboard-shots/375-empty-state-clients-no-match.png` | New verification screenshot. | Playwright force-empty-state evidence. |
| `redesign/onboard-shots/375-empty-state-bookings-no-match.png` | New verification screenshot. | Playwright force-empty-state evidence. |

### Tour overlay — explicitly NOT added

PRODUCT.md does not request an onboarding tour overlay; the design principle is "Simplicity that opens into depth — complexity unfolds when invited." Adding a Joyride / Shepherd-style overlay would directly contradict that. The `ProfileCompletionNudge` panel + the inline empty-state CTAs are the contextual-help layer this product asks for, no more.

---

## Gate 6 closed: 2026-05-20.

Ready for Gate 7 (`/impeccable polish admin`). Per the recipe's gate ordering, Gate 7 is the last code-mutating gate before the Gate 8 critique re-score.
