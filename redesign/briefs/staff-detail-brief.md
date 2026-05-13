# Shape Brief: `/admin/staff/<id>` redesign

**Date:** 2026-05-12
**Page slug:** `staff-detail`
**Status:** user-confirmed
**Brief number:** 28 of 29 (Phase 5)

## 1. Feature Summary

The single-staff command centre: identity, contact, profile copy that surfaces on the public `/staff/<slug>` page, role + permission shape, assigned workload, and (for admins) the onboarding/profile-completion picture plus the audit trail. The page exists at the intersection of two RBAC axes; *what the viewer's role lets them see* and *whose profile they're looking at* (own vs colleague); and the current implementation gates roughly nine panels through five permission flags + an `isOwnProfile` toggle. The redesign keeps that gating logic intact but rebuilds the visual surface as a two-column workstation with a sticky right rail and a fixed panel order so the operator never has to wonder where to find a given fact.

## 2. Primary User Action

Three audiences, three primary actions on the same page:
- **Owner / Admin (any colleague):** edit role, toggle permission overrides, check onboarding/workload at a glance, jump to availability.
- **Therapist (own profile):** edit safe-profile fields (bio, languages, specialties, service areas, phone visibility), jump to own availability.
- **Coordinator / Therapist (colleague, scope-permitted):** read the colleague's profile to confirm gender match, languages, service areas, current assignments; never edit.

The page is **a hub, not a workstation, for read-only viewers**, and **a focused workstation, not a kitchen-sink editor, for admins**.

## 3. Design Direction

Two-column workstation matching `/admin/clients/<id>` (Brief 18) and `/admin/staff/<id>/availability` (Brief 27): a narrower right rail of stat-and-status panels + a wider main column of editable forms or read-only displays. The decorative banner-with-avatar-tile chrome (lines 232–258, same pattern as the availability page) retires; replace with the flat header pattern from Brief 27. The current scattered green/orange tick-and-cross checklist (lines 320–325) gets the named-status-rule treatment (Confirmed/Cancelled families, never `text-emerald-600` / `text-orange-600` raw). Decorative `User` icon on the avatar tile retires in favour of the real-photo-or-initial-token pattern from Brief 26.

## 4. Scope

In:
- Replace banner-avatar header chrome with the flat header from Brief 27: 40px circular avatar + H1 name + Soft Slate sub-line "Staff profile" (or "Your profile" on own).
- Profile / Availability tab strip rebuilt as `TabPills` with `aria-current="page"` (Sam #3 carry-forward, same fix as Brief 27).
- Two-column main grid (`xl:` `1fr 22rem`) with fixed panel order on each side:
  - **Left (main):** Editable / read-only profile (existing `StaffProfileForm` or read-only fallback), Assigned bookings + workload, Audit history.
  - **Right (rail, sticky):** Status & identity, Profile completion checklist, Onboarding checklist, Role + permissions overview, Permission overrides editor.
- Role + permissions overview promotes the current flat chip list (lines 351–363) into a labelled two-line composition: top line "{role display_label}" with mono `role.name` sub-token; bottom line "{n} permissions inherited from role" + Ghost "Show all →" expanding the existing chip list inside a `<details>`. Effective-permission badge: when `staff_permission_overrides` exist, surface "+ {n_added} added, {n_revoked} revoked" in Pending tint above the chip list.
- Permission overrides editor (`StaffPermissionOverridesForm`) restyled to DESIGN.md tokens; existing self-lockout protection (line 374–377: "Self overrides are disabled to prevent lockout") preserved with the same plain-English copy. The current decorative description gets a Restricted-family banner inside the panel when viewing self ("Self overrides are disabled to prevent lockout. Ask another owner-level admin to change your overrides.").
- Profile completion + Onboarding checklists: replace `bg-[var(--rahma-ivory)]/70` rounded rows + raw `text-emerald-600` / `text-orange-600` checks with `AdminEntityRow`-style rows + Confirmed/Cancelled family status icons inside `AdminStatusBadge`-shape pills. Each item links inline-edits where possible (e.g. clicking "Phone" scrolls focus to the phone field on the profile form when permission allows; clicking "Availability configured" links to `/admin/staff/<id>/availability`).
- Assigned bookings + workload list: each row becomes a compact `BookingListCard` per Brief 01 (avatar of *client* when `canViewClientWorkloadContext`, gender-required chip when not). Hard `limit(8)` becomes "Show all assignments →" Ghost linking `/admin/bookings?staffId=<id>&view=upcoming` instead of paginating in place (the bookings list page is the right surface for full history). Empty: shared `EmptyState` with calendar-quiet SVG, "No assigned bookings yet." (no CTA; assignment happens on the booking detail page).
- Audit history: per-row composition matches the Brief 11 audit timeline rows verbatim (action-verb-phrase mapping + relative time). Hard `limit(8)` becomes "Open audit trail →" Ghost linking `/admin/audit?target_type=staff&target_id=<id>` (Brief 11 already accepts that param).
- New "Status & identity" rail panel (top of right rail): renders the per-staff status family ("Active" Confirmed / "Bookings off" Pending / "Inactive" Restricted), gender, role display, and a Ghost "Open availability →" link.
- Read-only profile fallback (lines 287–302, when neither `canEditSafeProfile` nor `canShowAdminPanels`) rebuilt as a `dl`-style description list with proper label + value pairs; specialties/languages/service-areas render as Restricted-family chips (decorative, not status). Gender renders inline alongside the role.
- Carry-forward soft fixes per Phase 6: raw `var(--rahma-*)` token escapes throughout, `bg-white` + `shadow-soft` on header card (Tonal Lift Rule), `shadow-md` + `border-4 border-white` on avatar tile, `bg-[var(--rahma-ivory)]/70` rounded checklist rows, raw `text-emerald-600` / `text-orange-600` checklist icons, `bg-white` + `hover:shadow-card` on assignment-row Link (line 430), `border-b-2` colour-only active-tab signal, raw permission identifier on `AdminAccessDenied` (lines 91, 121).

Out (unchanged):
- `getStaffTeamAccess`, `staffProfilesFrom`, `getStaffTeamSelect`, `canEditSafeStaffProfile` data-access helpers (RECON §5 untouchable).
- `StaffProfileForm` and `StaffPermissionOverridesForm` server-action contracts and named fields (RECON §6.4).
- The five permission flags driving panel visibility (`canViewContactFields`, `canViewAdminFields`, `canViewClientWorkloadContext`, `canViewRoleControls`, `canViewPermissionControls`, `canViewAudit`) and `canEditSafeStaffProfile`.
- The scope-based extra filtering (`assignment` adds `eq("active", true).eq("can_take_bookings", true)`; `same_gender_team` adds gender match) on the staff query.
- The "profile not visible in your scope" denied path (lines 115–123); copy refined per §11.
- The eligibility sub-route `/admin/staff/<id>/eligibility` (if reachable from this page; not refactored here).
- No customer-facing fields surface on this page (that's the public `/staff/<slug>` page's job).

## 5. Layout Strategy

Page chrome (top to bottom):
1. Breadcrumb link "← Team directory" (Soft Slate label step).
2. **Flat page header:** 40px avatar + H1 staff name + Soft Slate sub-line ("Staff profile" / "Your profile"). Status family chip ("Active" / "Bookings off" / "Inactive") inline beside the name. Email line below sub-line when `canViewContactFields`.
3. **Tab strip** (`TabPills`): "Profile" / "Availability" with `aria-current="page"`. Availability tab visible when `canShowAdminPanels || isOwnProfile` (matches existing logic at line 267).
4. Two-column main grid on `xl:` (`1fr 22rem`); single column below.

**Left column (main):**

**Panel L1; Profile editor or read-only.**
- When editable: H2 "Profile". Restyled `StaffProfileForm` preserved verbatim. Form sections internal to the component preserved.
- When read-only: H2 "Profile". `dl` of label + value pairs (short_bio as wrapped paragraph above the `dl`; specialties / languages / service areas as Restricted-family decorative chip rows; gender inline). When all fields are empty: inline "This colleague's profile is still being filled in." (Soft Slate, no CTA; viewer can't edit).

**Panel L2; Assigned bookings + workload.**
- H2 "Assigned bookings".
- Sub-line: "{n} upcoming · {n} past visible." (counts derived from existing logic; past entries collapse to a `<details>` "Past assignments (N)" inside the panel).
- Body: up to 8 compact `BookingListCard`s; each links to `/admin/bookings/<id>` when permitted. When `canViewClientWorkloadContext === false`: client name replaced with the per-row required gender chip ("Female-required" / "Male-required"); booking_date + time + city stays visible.
- Footer: "Show all assignments →" Ghost → `/admin/bookings?staffId=<id>&view=upcoming` (admin scope; coordinator scope filtered similarly by the bookings page).
- Empty: shared `EmptyState`, calendar-quiet SVG, "No assigned bookings yet." No CTA.

**Panel L3; Audit history** (admin scope only):
- H2 "Audit history".
- Body: per-row action-verb-phrase line + relative time (matches Brief 11 row composition).
- Footer: "Open audit trail →" Ghost → `/admin/audit?target_type=staff&target_id=<id>`.
- Empty: inline "No recent activity recorded."

**Right column (rail, sticky):**

**Panel R1; Status & identity.**
- H3 "Status".
- Body: status family chip + Gender + Role display name + mono DB role name + "Open availability →" Ghost.
- When viewing self: small Confirmed-family "You" chip beside the role.

**Panel R2; Profile completion** (when `canShowAdminPanels || isOwnProfile`):
- H3 "Profile completion".
- Sub-line: "{n} of 5 done." with the count tinted Confirmed when 5/5, Pending when 1–4, Cancelled when 0.
- Body: per-item `AdminEntityRow` with Lucide check-circle (Confirmed) or x-circle (Cancelled) leading icon + label + (where applicable) inline "Add →" Ghost that scrolls focus to the matching field on Panel L1.

**Panel R3; Onboarding checklist** (admin scope only):
- H3 "Onboarding".
- Sub-line: "{n} of 6 done." (same colour ladder as R2).
- Body: same `AdminEntityRow` composition as R2. Items linking off-page where applicable ("Availability configured" → `/admin/staff/<id>/availability`).

**Panel R4; Role and permissions** (admin scope only):
- H3 "Role and permissions".
- Body: role display name (Work Sans 500 body) + mono `role.name` + count "Inherits {n} permissions" + when overrides present: "+ {added} added, {revoked} revoked" Pending-family pill below.
- Footer: `<details>` "Show all permissions" expanding a flat chip list (existing data, restyled).

**Panel R5; Permission overrides** (when `canManagePermissionOverrides` and not self):
- H3 "Permission overrides".
- Sub-line: "Overrides sit on top of the fixed role bundle."
- Body: restyled `StaffPermissionOverridesForm` (preserved server-action contract).
- Self variant (when viewing own): replace form with a Restricted-family banner "Self overrides are disabled to prevent lockout. Ask another owner-level admin to change your overrides."

**Mobile (≤md):**
- Right rail collapses below the main column.
- Tab strip becomes momentum-scroll pills.
- Two-column desktop grid (`xl:grid-cols-2` on the *current* page's middle section) flattens; all sub-panels stack in the order R1–R2–R3–R4–R5 below the main column.

## 6. Key States

- **Default; admin viewing colleague.** All five right-rail panels visible (R5 includes the overrides editor). Main column Profile is editable.
- **Default; admin viewing self.** All panels visible except R5's editor (replaced with the self-lockout banner per existing behaviour). "You" chip on R1.
- **Default; coordinator viewing assignment-pool colleague.** Main column: read-only Profile (`dl` style) + Assigned bookings (with client context if `canViewClientWorkloadContext`, gender chips if not). Right rail: R1 only. No completion checklist, no onboarding, no permissions, no overrides.
- **Default; therapist viewing same-gender colleague.** Main column: read-only Profile (`dl` style) + Assigned bookings (gender-chip variant, no client context). Right rail: R1 only.
- **Default; therapist viewing self.** Editable Profile (safe fields only; existing `canEditSafeStaffProfile` constrains). Right rail R1 + R2 (Profile completion). No onboarding panel (HR-style metric, admin-only).
- **Out-of-scope profile.** Existing denied path (lines 115–123) renders with refined copy ("This profile isn't visible in your current team scope."); no raw permission identifier.
- **Inactive staff.** Restricted-family banner above the tab strip ("This staff member is inactive."), all panels render as normal but the assigned-bookings panel shows only past entries (an inactive staff member has no upcoming work; existing data layer handles this).
- **Loading.** `AdminSkeleton`: header (instant), tab strip (instant), main-column profile skeleton, right-rail R1 + R2 + R3 skeletons.
- **Profile form save success.** Sonner Confirmed "Profile saved." Profile-completion checklist re-renders with updated tick state via `revalidatePath`. No navigation.
- **Permission override toggle.** Existing form pattern (single switch per row). On submit: Sonner Confirmed "Permission override updated." Risk-tier confirm matrix from Brief 22 §6 inherits here (critical always confirms; high confirms on grant; medium/low one-click).
- **No data in any optional field.** Profile read-only renders "This colleague's profile is still being filled in." inline.
- **Empty Assigned bookings.** `EmptyState`, calendar-quiet SVG, "No assigned bookings yet." (admin scope) / "No recent assignments." (coordinator/therapist scope).
- **Empty audit history.** Inline "No recent activity recorded." (admin scope only; this panel doesn't render outside admin scope).

## 7. Interaction Model

- Tab strip: client-side `Link` to `/admin/staff/<id>/availability` (existing pattern).
- Profile form: existing `StaffProfileForm` submit + named fields preserved. On submit, `revalidatePath` refreshes the right rail's completion/onboarding counts without full reload.
- Permission overrides form: existing `StaffPermissionOverridesForm` preserved. Risk-tier confirms route through `ConfirmActionModal` per Brief 22 §6.
- Profile completion row "Add →" Ghost: client-component `<button>` that calls `document.querySelector('[name="<field>"]')?.scrollIntoView({ behavior: 'smooth' })` + focuses the input. Only renders when the operator has edit permission on the field.
- Assignment row click: `Link` to `/admin/bookings/<id>` when `canOpenWorkloadBookings`; renders as a static `div` otherwise (existing logic preserved).
- "Show all assignments →" Ghost: `Link` to `/admin/bookings?staffId=<id>&view=upcoming`; additive URL param; Bookings list (Brief 04) reads it.
- "Open audit trail →" Ghost: `Link` to `/admin/audit?target_type=staff&target_id=<id>`; additive URL params; Audit (Brief 11) reads them.
- Right rail stickiness: `position: sticky; top: var(--admin-top-offset);` on `xl:` and above. On scroll, the rail stays in view as the main column scrolls past it; on mobile the rail is in normal flow.
- Keyboard: tab traverses breadcrumb → tab strip → main-column form → right-rail panels in order. The `<details>` disclosure on Panel R4 is keyboard-operable; chip lists inside are not focusable (decorative).

## 8. Content Requirements

- Breadcrumb: "← Team directory".
- Page H1: staff name.
- Page sub-line: "Staff profile" (admin/coordinator/therapist on colleague) / "Your profile" (own).
- Tab labels: "Profile" / "Availability".
- Inactive banner: "This staff member is inactive."
- Status chip copy: "Active" / "Bookings off" / "Inactive".
- Panel L1 read-only empty fallback: "This colleague's profile is still being filled in."
- Panel L2 sub-line: "{n} upcoming · {n} past visible."
- Panel L2 past-collapse summary: "Past assignments ({n})".
- Panel L2 empty: "No assigned bookings yet." (admin) / "No recent assignments." (coordinator/therapist).
- Panel L2 footer Ghost: "Show all assignments →".
- Panel L3 footer Ghost: "Open audit trail →".
- Panel L3 empty: "No recent activity recorded."
- Panel R1 self-chip: "You".
- Panel R1 footer Ghost: "Open availability →".
- Panel R2 sub-line: "{n} of 5 done."
- Panel R3 sub-line: "{n} of 6 done."
- Panel R4 inherits-line: "Inherits {n} permission" / "Inherits {n} permissions" (count-aware).
- Panel R4 overrides-line: "+ {added} added, {revoked} revoked."
- Panel R4 disclosure: "Show all permissions".
- Panel R5 sub-line (colleague): "Overrides sit on top of the fixed role bundle."
- Panel R5 self-banner: "Self overrides are disabled to prevent lockout. Ask another owner-level admin to change your overrides."
- Out-of-scope denied: "This profile isn't visible in your current team scope. Ask the owner if you need access."
- Out-of-team denied: "Team profiles aren't visible in your role. Open your own profile from the directory instead." with a Secondary "Open my profile" → `/admin/staff/<own_id>`.
- No raw permission identifiers anywhere on the live surface (current `page.tsx:91` and `page.tsx:121` leak `view_staff`).

## 9. Recommended References

- Brief 18 (`client-detail`) → two-column workstation layout, conditional panel composition, sub-line "{n} of N" counts.
- Brief 27 (`staff-availability`) → flat header treatment, tab strip with `aria-current="page"`, decorative-banner retirement.
- Brief 26 (`staff` directory) → avatar treatment, status chip composition, self-row "You" chip vocabulary.
- Brief 22 (`role-detail`) → permission-override risk-tier confirm matrix (inherits verbatim on this page's Panel R5).
- Brief 11 (`audit`) → action-verb-phrase mapping for Panel L3 rows; cross-link via `?target_type=staff&target_id=<id>`.
- Brief 04 (`bookings`) → cross-link target for "Show all assignments →" via `?staffId=<id>&view=upcoming`.
- DESIGN.md §2 → Status Families (Confirmed/Cancelled for checklist ticks/crosses; Restricted for decorative chips).
- DESIGN.md §5 → AdminPanel, AdminStatusBadge, AdminEntityRow.

## 10. Open Questions

1. **Right-rail stickiness offset.** The header layout's height varies (banner retires, breadcrumb stays, tab strip stays). A fixed `top` value needs to track the cumulative top-chrome height. Proposal: CSS variable `--admin-top-offset` set by the layout (already a stable surface); rail consumes it. Phase 6 verifies the value matches the new header height.
2. **"Add →" scroll-and-focus from Panel R2 checklist.** Useful for novice operators (PRODUCT.md Fatimah); minor JS cost (no library, just `scrollIntoView` + `focus()`). Proposal: ship. If it proves brittle across mobile keyboards, fall back to anchor-link navigation.
3. **Past assignments cap.** Existing query uses `limit(8)` total. Splitting upcoming + past in the redesigned panel means the operator only sees the most recent 8 *combined*; past may be effectively invisible if 8 upcoming exist. Proposal: bump to `limit(16)` and split client-side, capping past at 8 visible inside the `<details>`. Backend confirms the query change is safe (no untouchable contract here; RECON §5 lists this page's helpers but not the assignment query shape).
4. **Therapist-on-colleague public-bio framing.** The current read-only fallback shows everything the team-scope-permitted viewer is allowed to see. Open question: should the therapist see the *public* bio (the one that surfaces on `/staff/<slug>`) explicitly labelled as such, with a "What clients see" frame? Proposal: yes; small labelled section above the description list, "What clients see on the public site:" then the public-facing snippet. Phase 6 polish.

## 11. Role variants

The page is gated by `teamAccess.access || isOwnProfile`. Within "has access," the surface varies along *two* axes: the viewer's `getStaffTeamAccess` scope (admin / assignment / same_gender_team) and whether the viewed profile is the viewer's own. The five permission flags + `isOwnProfile` derive a **(viewer, target)** matrix:

| Viewer | Target | Panels visible |
|---|---|---|
| Owner / Admin (admin scope) | Any colleague | L1 editable, L2, L3, R1, R2, R3, R4, R5 |
| Owner / Admin (admin scope) | Self | L1 editable, L2, L3, R1 (with "You"), R2, R3, R4, R5 (self-banner; no editor) |
| Coordinator (assignment scope) | Assignment-pool colleague | L1 read-only, L2 (gender-chip variant when no `canViewClientWorkloadContext`), R1 |
| Coordinator (assignment scope) | Self | L1 read-only (Coordinator typically lacks `canEditSafeStaffProfile`; if held, L1 editable on safe fields only), L2 (own assignments via `isOwnProfile`), R1 (with "You"), R2 |
| Therapist (same_gender_team scope) | Same-gender colleague | L1 read-only, L2 (gender-chip variant, no client context), R1 |
| Therapist (same_gender_team scope) | Self | L1 editable (safe fields), L2 (own assignments), R1 (with "You"), R2 |
| Inactive / no team access | Any | Denied state |

Each sub-heading below collapses the above matrix into the user-facing variants.

### Owner

Always reaches via admin scope. Always sees the full surface (L1 editable + L2 + L3 + all five right-rail panels). On self: R5 swaps to the lockout banner; everything else identical. "You" chip on R1 when on self. Cross-links to availability, bookings list (with `staffId` filter), and audit trail (with `target_type=staff&target_id`) all visible.

### Admin (Practice Manager)

Identical surface to Owner. PM holds the admin scope of `getStaffTeamAccess` and `canManagePermissionOverrides` per default RBAC. R5's editor is fully interactive on any colleague; on self, lockout banner.

### Booking Coordinator

Coordinator's scope is `assignment`. Viewing options:

- **Colleague in assignment pool (`isOwnProfile === false`):** L1 read-only (`dl` style) + L2 (assignments with client-context if Coordinator holds `canViewClientWorkloadContext`, otherwise gender-required chip variant) + R1 only. No completion checklist, no onboarding, no role/permissions, no overrides.
- **Self (`isOwnProfile === true`):** L1 read-only unless Coordinator holds `canEditSafeStaffProfile` (in which case the safe-field subset is editable) + L2 (own assignments) + R1 (with "You" chip) + R2 (Profile completion, because `isOwnProfile === true`).

Cross-link "Open availability →" hidden on colleague (Coordinator can't manage anyone's availability per Brief 27 §11). On self: hidden too unless Coordinator holds `manage_availability_own` (typically not).

### Therapist

Therapist's scope is `same_gender_team`. Viewing options:

- **Same-gender colleague (`isOwnProfile === false`):** L1 read-only public-bio framing + L2 (gender-chip variant, no client context) + R1 only. The right rail is intentionally lean; a therapist looking up a teammate needs name, gender, role, availability link, and visible assignments, not the operational backend.
- **Self (`isOwnProfile === true`):** L1 editable on safe fields (existing `canEditSafeStaffProfile` constraint) + L2 (own assignments, full client context per `isOwnProfile` exception) + R1 (with "You") + R2 (Profile completion). Cross-link "Open availability →" visible (own availability is editable per Brief 27).
- **Cross-gender colleague:** never reachable; the staff query at lines 107–112 filters this out before render. Therapist hitting that URL falls through to the existing "profile not visible" denied path.

### Denied state

Two distinct denied surfaces:

**Out-of-team denied** (`teamAccess.access === false && !isOwnProfile`, i.e. Inactive or any future role without `view_staff` reaching a colleague URL):
- Title: "Team access limited"
- Body: "Team profiles aren't visible in your role. Open your own profile from the directory instead."
- Secondary "Open my profile" → `/admin/staff/<own_id>`.
- Tertiary Ghost "Back to dashboard" → `/admin/dashboard`.

**Out-of-scope denied** (`teamAccess.access === true` but the queried staff falls outside the viewer's scope; e.g. Therapist hitting a cross-gender colleague URL, Coordinator hitting an inactive colleague URL):
- Title: "Team profile not visible"
- Body: "This profile isn't visible in your current team scope. Ask the owner if you need access."
- Single Secondary "Back to team directory" → `/admin/staff`.

Both paths: no raw `view_staff` permission identifier on screen (current `page.tsx:91` and `:121` leak it; fix in Phase 6).

---

## Recipe Context

- **RECON §2 inventory row:** Staff detail — `src/app/admin/staff/[staffId]/page.tsx` (+ `StaffProfileForm.tsx`, `StaffPermissionOverridesForm.tsx`) — `/admin/staff/<id>` — Profile + assignment + permission overrides + audit.
- **Access gate (RECON §3):** `teamAccess.access || isOwnProfile`; within that, scope-based extra filtering on the staff query and five permission flags drive panel visibility. All four active roles can reach the page via different (viewer × target) routes.
- **Untouchable backend (RECON §5):** `getStaffTeamAccess`, `staffProfilesFrom`, `getStaffTeamSelect`, `canEditSafeStaffProfile` data-access helpers. `StaffProfileForm` and `StaffPermissionOverridesForm` server-action contracts. `booking_assignments` workload join (with `limit(8)` though §10 Q3 proposes bumping to 16).
- **Preserved IDs / form names (RECON §6.4):** All `StaffProfileForm` fields preserved verbatim. `StaffPermissionOverridesForm` per-row switch posts preserved. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** None currently on this page. Outbound cross-links use additive params on destination pages: `/admin/bookings?staffId=<id>&view=upcoming` (Brief 04 reads it), `/admin/audit?target_type=staff&target_id=<id>` (Brief 11 reads it).
- **Cross-axis variation:** Surface varies on both `getStaffTeamAccess` scope and `isOwnProfile`; the (viewer × target) matrix in §11 expresses both. Coordinator viewing assignment-pool + Therapist viewing same-gender are net-new "read-only colleague view" surfaces this brief defines explicitly.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** decorative banner-avatar header at `page.tsx:232–258` same retirement as Brief 27; Sam #3 active-tab `aria-current="page"` missing at line 263; raw `text-emerald-600` / `text-orange-600` checklist icons at lines 321/323/341/343 → Confirmed/Cancelled status families; `bg-white` + `shadow-soft` on header card (Tonal Lift Rule); `bg-white` + `hover:shadow-card` on assignment row Link at line 430; `bg-[var(--rahma-ivory)]/70` rounded checklist rows at 317 / 337; raw permission identifier on `AdminAccessDenied` at lines 91 + 121.
- **IMAGES-NEEDED additions:** `assignments-quiet.svg` (calendar-quiet, ~80–120px) for Panel L2 empty `EmptyState`. Append row in Phase 6.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - (Viewer × target) matrix: walk all seven cells of §11 and confirm panel visibility, edit/read-only state, cross-link visibility, and copy match the table.
  - Banner-avatar header retirement: no `h-24` ivory band, no `border-4 border-white` ring, no `shadow-soft` on header card.
  - Sam #3 fix: active tab carries `aria-current="page"`; active state is Clinic Green fill + Field White text (not `border-b-2` colour-only).
  - Checklist colour ladder: tinted Confirmed / Pending / Cancelled per count, never raw `text-emerald-600` / `text-orange-600`.
  - Profile form round-trip: save success revalidates path; right-rail completion/onboarding counts update without full reload.
  - Permission override round-trip: critical always confirms; high confirms on grant only; medium/low one-click; self-view replaces editor with lockout banner.
  - Cross-links resolve: "Show all assignments →" lands on `/admin/bookings?staffId=<id>&view=upcoming` with filter pre-applied; "Open audit trail →" lands on `/admin/audit?target_type=staff&target_id=<id>`; "Open availability →" lands on `/admin/staff/<id>/availability`.
  - Out-of-team vs out-of-scope denied surfaces render distinct copy as in §11; neither leaks the raw `view_staff` permission identifier.
  - Right-rail stickiness: rail stays visible on `xl:`+ scroll; flows naturally below the main column on mobile.
  - A11y pass: tab strip keyboard-accessible; checklist "Add →" Ghosts focus the right field; assignment row Links carry descriptive accessible names; `AdminAccessDenied` strips permission identifiers.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**`StaffProfileForm` (preserved from RECON §6.4):**

*Always editable when permitted:*
- `Full name *` (`name="name"`) — placeholder `As they'd like it on their record`.
- `Phone` (`name="phone"`) — placeholder `07…`. Helper `Visible to admin; show to clients via the toggle below.`
- `Show phone on public profile` (`name="show_phone_on_profile"`, checkbox). Helper `If on, the phone number appears on the public /staff/{slug} page.`
- `Short bio` (`name="short_bio"`, textarea 4 rows). Placeholder `One paragraph clients see on the public site.`
- `Specialties` (`name="specialties"`, chip input). Placeholder `Add a specialty and press Enter` (e.g. `Cupping`, `Postnatal`, `Sports massage`).
- `Languages` (`name="languages"`, chip input). Placeholder `e.g. English, Arabic, Urdu`.
- `Service areas` (`name="service_areas"`, chip input). Placeholder `e.g. Luton, Dunstable, Houghton Regis`.

*Admin-only fields (when `canShowAdminPanels`):*
- `Role` (`name="role_id"`, select). Helper `Determines default permissions. Grants and revokes per-staff happen below in Overrides.`
- `Gender *` (`name="gender"`). Options `Female`, `Male`. Helper `Used for same-gender booking matching.`
- `Active` (`name="active"`, checkbox). Helper `Inactive staff can't sign in.`
- `Can take bookings` (`name="can_take_bookings"`, checkbox). Helper `Off pauses new assignments without deactivating the account.`
- `Availability mode` (`name="availability_mode"`, select). Options `Use clinic global hours`, `Custom hours`. Helper `Manage the custom pattern on the Availability tab.`
- `Profile photo` (`name="profile_photo_path"`, file input). Helper `Square image, at least 400×400. Shown on the public site.`

**`StaffPermissionOverridesForm` (per-permission row, preserved):**
- Per Switch: `aria-label="{permission display name}: {added | revoked | role default}"`. Three-state radio or tri-state Switch (Add / Default / Revoke).

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Save profile | `Save profile` | Primary |
| Discard profile changes | `Discard changes` | Ghost (when dirty) |
| Save overrides | `Save overrides` | Primary |
| Per-checklist-item "Add →" | `Add →` | Ghost (scrolls to field) |
| Per-checklist-item "Open availability →" | `Open availability →` | Ghost |
| Tab strip | `Profile` / `Availability` | Tab-pill |
| Panel L2 overflow | `Show all assignments →` | Ghost |
| Panel L3 overflow | `Open audit trail →` | Ghost |
| Panel R4 disclosure | `Show all permissions` | Ghost (chevron) |
| Critical-risk override confirm | `Grant` / `Revoke` (per direction) | Destructive |
| High-risk grant override confirm | `Grant` | Destructive |
| Override modal cancel | `Cancel` | Secondary |
| Out-of-team denied CTA | `Open my profile` (Secondary) + `Back to dashboard` (Ghost) | — |
| Out-of-scope denied CTA | `Back to team directory` | Secondary |

### Error messages

**Profile form:**
- `name` empty: `Add their full name.`
- `phone` toggled visible but empty: `Add a phone number, or toggle the visibility off.`
- `phone` malformed: `Phone number is too short. Include the area code.`
- `short_bio` over 600 chars: `Trim the bio to 600 characters or fewer.`
- `gender` empty (admin field): `Pick a gender; it's used for same-gender booking matching.`
- `role_id` empty: `Pick a role.`
- `profile_photo_path` non-image: `Upload an image file (PNG, JPG, or WebP).`
- `profile_photo_path` over 5MB: `Photo is too large. Aim for under 5 MB.`
- Save server failure: `Couldn't save the profile. Try again.` (toast, persistent)

**Permission overrides:**
- Per-row server failure: `Couldn't change {permission}. {server message}` (toast, persistent, Retry)
- Self-edit attempt (defensive — UI hides editor): `Self overrides are disabled to prevent lockout. Ask another owner-level admin.`
- Concurrent edit: `Someone else just changed an override on this staff member. Refresh to see the latest.`

**Cross-link errors:**
- `Show all assignments →` lands on bookings list with no matches: handled by Brief 04 empty state.
- `Open audit trail →` lands on audit with no matches: handled by Brief 11 empty state.

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Read-only profile, all fields empty | (inline, no full EmptyState) | `This colleague's profile is still being filled in.` | — |
| Panel L2 empty (admin) | `No assigned bookings yet` | `Assign them to a booking from the bookings list or the booking detail page.` | `Show all assignments →` |
| Panel L2 empty (coordinator/therapist) | `No recent assignments` | `Assignments will show up here once they're allocated.` | — |
| Panel L3 empty | `No recent activity recorded` (inline) | — | — |
| Panel R2 (Profile completion) — 0/5 | `0 of 5 done` (Cancelled tint count) | (per-item list shows what's missing) | inline `Add →` per item |
| Panel R3 (Onboarding) — 0/6 | `0 of 6 done` (Cancelled tint) | (per-item list) | inline links per item |
| Panel R5 (self) | (no heading) | `Self overrides are disabled to prevent lockout. Ask another owner-level admin to change your overrides.` | — |
| Inactive-staff banner | (no heading) | `This staff member is inactive.` | — |
| Out-of-team denied | `Team access limited` | `Team profiles aren't visible in your role. Open your own profile from the directory instead.` | `Open my profile` + `Back to dashboard` |
| Out-of-scope denied | `Team profile not visible` | `This profile isn't visible in your current team scope. Ask the owner if you need access.` | `Back to team directory` |

### Tooltip text

- Avatar: native `title` shows full name (or `You ({name})` on self).
- "You" chip on R1: `This is you`.
- Status chip on header: `Active. Can sign in and accept bookings.` / `Active but not accepting new bookings.` / `Inactive. Sign-in blocked.`
- Gender field tooltip: `Used for same-gender booking matching only. Not shown to clients.`
- "Show phone on public profile" toggle: `Off keeps the phone number admin-only. On surfaces it on /staff/{slug}.`
- Specialty / language / area chip: `Click ✕ to remove`.
- Per-row "Add →" Ghost on completion checklist: `Jump to the {field} field on the profile form`.
- Permission row scope chip: `scope: {scope}` — same text as Brief 23 role-detail.
- Permission row risk chip: same tooltip set as Brief 23 (Low/Medium/High/Critical with one-sentence explanation each).
- "Open availability →" (R1): `Open this staff member's availability tab`.
- "Show all assignments →" (L2): `Open the bookings list filtered to this staff member`.
- "Open audit trail →" (L3): `Open the audit log filtered to this staff member`.
- "+ N added, M revoked" Pending pill on R4: `This staff member has {N} overrides on top of their role's default permissions`.
- Public-bio framing label (therapist on colleague): `What clients see on the public site`.

### Confirmation dialog text

**Override toggles inherit Brief 23's risk-tier matrix verbatim:**

**Critical-risk override toggle (grant or revoke)**
- Heading: `{Grant|Revoke} {permission name} for {staff name}?`
- Body: `This is a critical-risk permission. {Granting it expands their authority across the admin. | Revoking it may prevent them from completing existing workflows.}`
- Destructive: `Grant` / `Revoke`
- Secondary: `Cancel`

**High-risk override grant (revoke is one-click)**
- Heading: `Grant {permission name} to {staff name}?`
- Body: `This is a high-risk permission. Confirm before granting.`
- Destructive: `Grant`
- Secondary: `Cancel`

**Discard profile changes** (when dirty + tab switch / navigation)
- Heading: `Discard your changes?`
- Body: `Anything you've typed since opening will be lost.`
- Destructive: `Discard`
- Secondary: `Keep editing`

No confirmation on Save (success path), low/medium-risk override toggles (one-click), or read-only viewers (no destructive paths exposed).

**Toasts**
- Profile save success: `Profile saved.`
- Profile save failure: `Couldn't save the profile. Try again.` (persistent, Retry)
- Override grant success: `Granted {permission} to {staff name}.`
- Override revoke success: `Revoked {permission} from {staff name}.`
- Override save failure: `Couldn't change {permission}. Try again.` (persistent, Retry)
- Tab switch with unsaved changes: handled by Discard modal (no toast).
- Self-overrides edit attempt: no toast — banner explains.
