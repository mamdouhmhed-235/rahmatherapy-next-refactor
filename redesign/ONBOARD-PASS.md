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

**4 source files** + **5 onboard-shot screenshots** under `redesign/onboard-shots/`.

---

## Should Gate 3 (harden) re-run on any page changed during this gate?

**Recommendation: no.**

- The new `ProfileCompletionNudge` component is a self-contained server component with three explicit empty-handling branches (no profile_completed_at → render; one of five fields empty → render; otherwise → return null). All edge cases handled inline.
- The Therapist dashboard change is additive (one new section above existing content); existing surfaces unchanged.
- The label refinements on staff-detail are copy-only; no data flow or state changes.
- No new data dependencies, no new error paths, no new overflow risks.

---

## Gate 6 closed: 2026-05-20.

Ready for Gate 7 (`/impeccable polish admin`). Per the recipe's gate ordering, Gate 7 is the last code-mutating gate before the Gate 8 critique re-score.
