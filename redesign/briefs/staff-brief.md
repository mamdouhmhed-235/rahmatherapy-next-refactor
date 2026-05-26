# Shape Brief: `/admin/staff` redesign

**Date:** 2026-05-12
**Page slug:** `staff`
**Status:** user-confirmed
**Brief number:** 26 of 29 (Phase 5)

## 1. Feature Summary

Team directory: who's on the clinic, what they do, how loaded their week is, and (for admins) where their onboarding sits. The current page does role-scoped data slicing well at the data layer (Owner sees all, Coordinator sees active bookable, Therapist sees same-gender bookable + self) but the visual surface is a 3-column identical-card grid with multiple absolute-ban tells: dashed-border empty state, hover-revealed "View profile" CTA, decorative shadow on resting cards, H1→H3 heading skip. The redesign rebuilds it as a list-row directory with avatar-led rows, a status-clear secondary line, and a contextual filter strip.

## 2. Primary User Action

**Find one staff member and open their profile**, or for an Admin / Owner: **scan the team for who is over- or under-loaded, who hasn't finished onboarding, and who needs an availability nudge**. The page is a hub, never a workstation; every consequential mutation lives one click away on `/admin/staff/<id>` or `/admin/staff/<id>/availability`. Secondary action (Admin only): add a new staff member via `NewStaffForm` (currently rendered as a button-triggered surface).

## 3. Design Direction

Calm, scannable directory in the same `AdminEntityRow` grammar used by `/admin/clients`, `/admin/roles`, and `/admin/services`. Avatar-led rows, not cards. Status carries through the named families (Confirmed for active+bookable, Pending for active+bookings-off, Restricted for inactive). Workload signal travels in a quiet inline pill ("8 upcoming"), with the dashboard's denser visualisation reserved for `/admin/staff/<id>`. The current decorative gradient-ish "View profile" hover reveal disappears; the whole row is a link, full stop. Specialties chips render once, not always; they appear on `lg:` and above, otherwise collapse to a count.

## 4. Scope

In:
- Replace 3-column `Card` grid with a single full-width `AdminPanel` of `AdminEntityRow`-style rows, ordered alphabetically by `name` (existing sort, preserved).
- Each row: 40px circular avatar (real photo when available, initialled token on Hover Moss when not) + name as H2 + role chip + status chips + meta sub-line + workload pill + right-rail chevron.
- New filter strip above the panel: role multi-select (matches the `roles` table from the existing query), `?roleId=` deep-link param (matches the Brief 20 cross-link pattern), gender single-select (admin scopes only), free-text `q` over name + email, status filter (Active / Inactive; admin scopes only). All GET params.
- Soft active/inactive grouping for admin scope: active members first, then a thin divider, then inactive in a collapsed-by-default `<details>` "Inactive members (N)". Matches Brief 20 pattern. Coordinator and Therapist scopes don't see inactive rows at all (existing `eq("active", true)` filter), so the disclosure doesn't appear in those variants.
- New "Workload at a glance" mini-strip (admin scope only) above the directory: a one-line summary "Active: 6 · Bookable: 5 · No assignments this week: 2 · Onboarding incomplete: 1." Each segment is a Ghost link that applies a filter. No Cormorant numerals, no stat tiles; the team is small enough that prose plus filtering beats a stat-tile row.
- "Add staff member" Primary stays in the page header actions slot (admin scope only). `NewStaffForm` restyled to DESIGN.md tokens; surface treatment kept (existing in-place form or modal, whichever the current implementation uses; preserved verbatim per RECON §6.4).
- Empty state via shared `EmptyState`: replaces the dashed-border `border-2 border-dashed bg-white/50` block at line 298–309. Direct BASELINE-CRITIQUE absolute-ban fix.
- Hover-revealed "View profile" CTA (lines 288–291) removed; row is fully clickable, no decorative reveal.
- Heading hierarchy: member name `<h3>` → `<h2>` (resolves Sam #1 heading skip flagged in RECON §8 line 79). Page H1 → row H2s contiguous.
- Carry-forward soft fixes per Phase 6: `bg-white` on the card link (line 186), `var(--shadow-soft-token)` on resting cards (Tonal Lift Rule violation), `bg-white/50` and `border-dashed` on empty (lines 299), `var(--rahma-green)` / `var(--rahma-muted)` decorative avatar tile (line 197), raw permission identifier on the denied screen (line 68), `uppercase tracking-wider` role label (line 206; DESIGN.md typography says no uppercase shouting on data headers).

Out (unchanged):
- `getStaffTeamAccess`, `getStaffTeamSelect`, `staffProfilesFrom`, `getStaffProfileCompletion` data-access helpers (RECON §5 untouchable).
- The four-scope routing (admin / assignment / same_gender_team / none → denied).
- `NewStaffForm` server action contract and named fields (RECON §6.4).
- The role-scoped column visibility logic (`canViewAdminFields`, `canViewContactFields`, `canViewWorkloadSummary`).
- The onboarding-completion and profile-completion calculations (admin-only signals).
- The `booking_assignments` workload join.
- No bulk operations on staff. Each row links to a detail page.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader`: title and description vary by scope (preserved verbatim; "Staff Management" for admin, "Team Directory" for coordinator, "Team Directory" for therapist). Description text from the existing scope-conditional logic preserved. Actions slot: `NewStaffForm` Primary trigger (admin scope only).
2. **Workload-at-a-glance strip** (admin scope only): one-line prose with comma-separated segments, each a Ghost link applying a filter. Sits in a thin `surface-card` band with `border-subtle` top + bottom. Soft Slate body, no Cormorant.
3. Filter strip (`AdminFilterBar`): role / gender / status / `q`. Secondary "Apply"; Ghost "Clear filters" when active. Active filter chips below.
4. Single full-width `AdminPanel` (no two-column split; directory of ≤20 members reads best at full width).

**Row composition (active and inactive identical except for the inactive chip):**

- **Left, 56px column:** 40px circular avatar; real photo from `auth.users.raw_user_meta_data.avatar_url` if present (existing pattern from `BookingListCard`), initialled token (first letter of `name`) on Hover Moss with Practice Charcoal letter when not. No green-tile-with-User-icon (current line 195–201 retires).
- **Centre, flexible column:**
  - Top row: name as H2 (Urbanist 500 title step, Chronicle) + role chip (Restricted family, decorative-only) + status chip ("Active" Confirmed / "Bookings off" Pending / "Inactive" Restricted; named-status-rule compliant).
  - Sub-line 1: contact + identity meta; `email` (if `canViewContactFields`) + `· Gender: {gender}` (always when set; "Not set" only when admin scope and the field is empty). Soft Slate body step, truncated.
  - Sub-line 2: languages + service areas as compact tag list (`Languages` 12px Lucide + comma-joined, `MapPin` 12px Lucide + comma-joined). Truncates with "+N more" on desktop; full list on `xl:` and above.
  - Sub-line 3 (admin scope only): meta strip; "Onboarding {n}/6 · Profile {n}/{total}" with the onboarding count tinted Attention if `<6`, Confirmed if `=6`. The current bottom strip from lines 269–285 collapses into this single sub-line.
  - Specialties chip row (when `specialties?.length`): up to 3 chips inline on `xl:`, collapses to "{n} specialties" Ghost expand on `md:` and below.
- **Right rail, fixed:**
  - Workload pill (when `canViewWorkloadSummary`): Attention-family if `>= 8` upcoming, Pending if `5–7`, Confirmed if `1–4`, Restricted if `0`. Composition: `CalendarCheck` 14px + "{n} upcoming" label.
  - `ChevronRight` 16px decorative.
- **Whole row is a `<Link>` to `/admin/staff/<member.id>`.** Cursor pointer, hover surface tint to Hover Moss. No `border-l-4`. No hover-revealed "View profile" CTA.

**Mobile (≤md):**
- Right-rail workload pill drops below name (above meta sub-lines).
- Filter strip collapses behind "Filters" Ghost → `AdminSheet` from the bottom.
- Specialties row drops to count chip + Ghost expand.
- "Add staff member" Primary becomes full-width below the page header.

**Empty state:**
- Single `EmptyState` component (replaces the dashed-border block):
  - SVG: two-people-with-plus illustration (Hover Moss + Soft Slate).
  - Heading: scope-dependent. Admin: "No staff yet. Add the first team member." Coordinator: "No bookable staff in your assignment pool yet." Therapist: "No same-gender team members visible. Your profile is still here." (last line is encouraging, not apologetic).
  - CTA: Primary "Add staff member" → opens `NewStaffForm` (admin scope only). No CTA for coordinator/therapist (they cannot create staff).

## 6. Key States

- **Default; admin scope, populated.** All active members in alphabetical order; "Inactive members (N)" disclosure collapsed below.
- **Default; coordinator scope.** Only active bookable members, no inactive disclosure, no workload-strip prose, no `NewStaffForm` trigger.
- **Default; therapist scope.** Only same-gender bookable members + self, no inactive disclosure, no workload-strip prose, no role/gender/status filters (only `q` free-text remains).
- **Empty (any scope).** Scope-specific `EmptyState`.
- **Loading.** `AdminSkeleton`: page header (instant), workload-strip (instant), filter strip (instant), 5 row skeletons.
- **Filter active.** Filter chips visible; "Clear filters" Ghost beside Apply.
- **Workload pill colour ladder.** Restricted (0) / Confirmed (1–4) / Pending (5–7) / Attention (8+). Pill text always reads "{n} upcoming"; tint carries the load signal.
- **Onboarding-incomplete row (admin scope).** Sub-line 3 surfaces "Onboarding 4/6" in Attention tint; row is otherwise rendered identically. Clicking the segment of the workload strip "Onboarding incomplete: 1" filters down to these rows.
- **Inactive disclosure expanded.** Smooth height transition; rows render with the Restricted-family "Inactive" chip alongside the Active/Bookings-off chip. Workload pill omitted (inactive members have no upcoming work to surface).
- **Same-gender filter (Therapist scope).** No copy hints the filter is applied; the data layer handles it; surfacing it as a banner would feel like an apology. Therapist sees their team, not a notice about who is hidden.

### Backend error states (Layer 3 — for Phase 6 `/impeccable harden`)

| State | What the user sees |
|---|---|
| Staff list data load failure (DB error, timeout, or scope-query failure) | Cancelled-family `role="alert" aria-live="polite"` inline region replaces the `AdminPanel` list: "Couldn't load the team. Try refreshing." Ghost "Try again" button. Filter strip and page header remain visible. Workload-at-a-glance strip also absent. |
| `roleId` filter param contains an invalid UUID | Server silently ignores the malformed param and returns the full scoped list (equivalent to no role filter). No error surfaced. Active filter chip still renders on the client ("Role: [invalid]") with an `x` to dismiss it. |
| `workload=zero` or `onboarding=incomplete` filter returns zero matching staff | Per-scope `EmptyState` variant with filter context: "No staff match" / "Try adjusting or clearing your filters." Ghost "Clear filters" CTA. |

## 7. Interaction Model

- Row click → `/admin/staff/<id>` (full-row link target; no nested interactive elements in the row).
- `NewStaffForm` trigger (admin scope only): opens existing surface (preserved verbatim per RECON §5 / §6.4). Field contract untouched.
- Workload-strip segment click → applies the corresponding filter (`?status=active`, `?bookable=true`, `?workload=zero`, `?onboarding=incomplete`). All GET params, additive to the existing `?roleId=` (Brief 20 cross-link) and the new `q` / `gender` / `roleId` / `status` strip.
- Filter strip: GET form, URL persists deep-link state.
- Inactive disclosure: native `<details>`; no JS.
- Keyboard: tab traverses workload-strip links → filter strip → rows → "Add staff member" Primary. Each row gets one tab stop (the Link); no nested focusable elements.
- Specialties expansion on mobile: Ghost button toggles a localState chip-row visibility (client-side only; no URL params).

## 8. Content Requirements

- Page title (admin): "Staff Management".
- Page title (coordinator/therapist): "Team Directory".
- Page descriptions: preserved verbatim from current scope-conditional logic.
- Workload-strip segments (admin only): "Active: {n} · Bookable: {n} · No assignments this week: {n} · Onboarding incomplete: {n}." Each ≥0 count rendered (no hiding the zero; operators learn the surface by seeing its parts).
- Filter labels: "Role", "Gender", "Status", "Search".
- Filter status options (admin only): "All" / "Active" / "Inactive".
- Row status chips: "Active" / "Bookings off" / "Inactive".
- Workload pill suffix: "{n} upcoming".
- Sub-line meta separator: " · " (middle dot, U+00B7).
- Gender helper (admin scope, empty): "Gender: Not set".
- Inactive disclosure summary: "Inactive members ({n})".
- Empty-state heading (admin): "No staff yet. Add the first team member."
- Empty-state heading (coordinator): "No bookable staff in your assignment pool yet."
- Empty-state heading (therapist): "No same-gender team members visible. Your profile is still here."
- Empty-state CTA (admin only): "Add staff member".
- Denied state copy: "Team directory access is restricted to active staff with directory visibility. Ask the owner if you need access." (no raw `view_staff` identifier).

## 9. Recommended References

- Brief 05 (`clients`) → list-row directory paradigm; this brief uses the same row grammar with workload pill substituting for "New booking" Ghost.
- Brief 20 (`roles`) → letter-token treatment, inactive-disclosure pattern, denied-copy alignment.
- Brief 18 (`client-detail`) → conditional sub-line composition (panels show or hide based on `can*` permissions; no greyed-out empty rows).
- Brief 08 (`dashboard-therapist`) → cross-link from the therapist dashboard to this page lands them on the same-gender-team scope.
- DESIGN.md §5 → AdminPanel, AdminStatusBadge (chip composition), EmptyState.
- DESIGN.md §Admin-Specific Patterns → Data Table (44px row height target), Search and Filter (GET form contract).
- BASELINE-CRITIQUE absolute-ban fixes resolving here: dashed-border empty state (lines 298–309); hover-revealed CTA (lines 288–291). Sam #1 heading skip on member names also resolves here.

## 10. Open Questions

1. **Workload pill thresholds (1–4 / 5–7 / 8+).** Hand-chosen for a 3–4 person team. Open question: should the thresholds scale with team size? Proposal: hardcode for now; revisit if the team grows past 5. PRODUCT.md commits to a clinic-of-this-scale calibration, not a generalised SaaS surface.
2. **Same-gender filter visibility for Therapist.** The data layer enforces it; the UI shows no notice. This matches PRODUCT.md ("same-gender care is the expected default, not an exception to be apologised for"). Confirm with the team that the absent-banner approach reads correctly to a therapist who might expect to see colleagues of the other gender. Proposal: absent; flag for Phase 7 product review only if user testing surfaces friction.
3. **Profile completion vs. onboarding completion sub-line.** Two counts ("Onboarding 4/6 · Profile 18/22") on the same line carry similar visual weight but different meaning. Proposal: keep both; they target different audiences (onboarding for HR-style "is this person ready", profile completion for the public-site-facing rich profile that's surfaced on `/staff/<slug>` if it exists). If the distinction proves opaque, drop "Profile" in Phase 7 polish.

## 11. Role variants

The page is gated by `getStaffTeamAccess(profile)` with four scopes: `admin` / `assignment` / `same_gender_team` / `none`.

### Owner

Scope: `admin`. Full surface. All members visible (active + inactive disclosure). All filters active. Workload-strip prose visible. "Add staff member" Primary visible. Onboarding + Profile completion meta on every row. Workload pill on every row. Page title "Staff Management".

### Admin (Practice Manager)

Identical to Owner. PM holds `view_staff` (and the admin scope of `getStaffTeamAccess`) by default. Same surface, same actions. Only delta lies inside `/admin/staff/<id>` where role-template edits are owner-only.

### Booking Coordinator

Scope: `assignment`. Surface narrowed:
- Page title: "Team Directory".
- Only active + bookable members visible. No inactive disclosure (the data layer already filters).
- Filter strip: role and `q` only. Gender and status filters hidden (the data layer already constrains).
- Workload-strip prose hidden (coordinator doesn't need the broader signal).
- "Add staff member" trigger hidden.
- Row composition: contact-detail line hidden (`canViewContactFields` is false in this scope). Workload pill visible (`canViewWorkloadSummary` is typically true for coordinator; the data shape already gates it; the row honours the boolean). Onboarding/profile meta sub-line hidden.
- Cross-link target: row click goes to `/admin/staff/<id>` which renders a coordinator-scoped sub-page (per the staff-detail brief).

### Therapist

Scope: `same_gender_team`. Surface further narrowed:
- Page title: "Team Directory".
- Only active + bookable members of the same gender as the viewer, plus self. No inactive disclosure.
- Filter strip: `q` only (no role / gender / status; each would either be self-applying or irrelevant).
- Workload-strip prose hidden.
- "Add staff member" trigger hidden.
- Row composition: contact-detail line hidden (`canViewContactFields` typically false). Workload pill *on self only*; therapists see their own upcoming workload but not their teammates' load (privacy-leaning default; the data layer's `canViewWorkloadSummary` boolean tunes this). Onboarding/profile meta sub-line hidden.
- Self-row: rendered identically to teammate rows but with a small Confirmed-family "You" chip beside the name. The current behaviour merges self into the list silently; surfacing "You" makes the row easier to find at a glance and matches PRODUCT.md voice ("real names").

### Denied state

Scope: `none`. Inactive accounts only by current behaviour; any future role explicitly stripped of `view_staff` lands here.

`AdminAccessDenied` invoked:

- Title: "Team access limited"
- Body: "Team directory access is restricted to active staff with directory visibility. Ask the owner if you need access."
- No raw `view_staff` permission identifier on screen (current `page.tsx:68` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

---

## Recipe Context

- **RECON §2 inventory row:** Staff list — `src/app/admin/staff/page.tsx` (+ `NewStaffForm.tsx`) — `/admin/staff` — Team directory; admins see all, coordinators see assignment pool, therapists see same-gender team + self. Note: member name renders as `<h3>`, not `<h2>` (RECON §8 / Sam #1 heading skip).
- **Access gate (RECON §3):** `getStaffTeamAccess(profile)` returns one of four scopes (admin / assignment / same_gender_team / none). All four active roles reach the page; Inactive blocked.
- **Untouchable backend (RECON §5):** `getStaffTeamAccess`, `getStaffTeamSelect`, `staffProfilesFrom` (in `staff/team-access.ts`), `getStaffProfileCompletion` (in `staff/profile-access.ts`). `NewStaffForm` server action contract. `booking_assignments` workload join shape.
- **Preserved IDs / form names (RECON §6.4):** `NewStaffForm` fields preserved verbatim (form contract not touched). `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** None currently. Redesign **adds** GET params `q`, `roleId` (cross-link from Brief 20), `gender`, `status`, `workload`, `bookable`, `onboarding`; all additive, no rename.
- **Scope-conditional surface:** All four scopes share the same page chrome; differences live in row composition and filter visibility per §11. Data-layer differences (which rows are returned) are owned by `getStaffTeamAccess` and preserved untouched.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** absolute-ban dashed-border empty state at lines 298–309; absolute-ban hover-revealed CTA at lines 288–291; Sam #1 heading skip on member name (`<h3>` → `<h2>`) at line 203. Soft fixes (Phase 6 cleanup): `bg-white` on card Link at line 186, `var(--shadow-soft-token)` on resting cards at line 189 (Tonal Lift Rule violation), decorative `var(--rahma-green)` / `var(--rahma-muted)` avatar tile at line 197, `uppercase tracking-wider` role label at line 206, raw permission identifier on `AdminAccessDenied` at `page.tsx:68`.
- **IMAGES-NEEDED additions:** `staff-empty.svg` (two-people-with-plus, ~80–120px) for the empty `EmptyState`. Append row in Phase 6.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Scope routing: four `getStaffTeamAccess` scopes render the documented variants without crossing data boundaries; same-gender filter at the data layer holds.
  - Heading hierarchy: page H1 followed by row H2s contiguous; no member name renders as H3.
  - Dashed-border empty retired: `EmptyState` SVG + heading + Soft Slate body, no `border-dashed` class anywhere; admin scope shows CTA, other scopes don't.
  - Hover-reveal retired: no element on a row has `opacity-0` → `opacity-100` transition tied to `group-hover`; whole row is the click target with a single `:hover` surface tint.
  - Tonal Lift Rule: rows have no shadow at rest; hover applies `card-hover` shadow only.
  - Filter contract: every combination produces a URL with the documented param names; deep-link from Brief 20 (`?roleId=`) lands with the role filter pre-applied.
  - Workload-strip cross-links: clicking each segment applies the documented filter and scrolls to the matching rows; counts match the rendered list.
  - Inactive disclosure: collapsed by default in admin scope; smooth height transition; not rendered in coordinator/therapist scope.
  - Therapist "You" chip: self-row carries the chip; teammate rows do not.
  - Role pass: Owner / Admin / Coordinator / Therapist / Inactive; surface variants match §11; `AdminAccessDenied` content matches §11.
  - A11y pass: `AdminAccessDenied` no longer renders `view_staff`; row links have descriptive accessible names; mobile `AdminSheet` traps focus.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**Filter strip:**
- `Role` (`name="roleId"`, multi-select). Default `Any role`.
- `Gender` (`name="gender"`, admin scopes only). Default `Any gender`. Options: `Female`, `Male`.
- `Status` (`name="status"`, admin scope only). Default `All`. Options: `Active`, `Inactive`.
- `Search` (`name="q"`) — placeholder `Search by name or email`.

**`NewStaffForm` (admin scope only, preserved field names per RECON §6.4):**
- `Full name *` (`name="name"`) — placeholder `As they'd like it on their record`.
- `Email *` (`name="email"`, type `email`) — placeholder `name@rahmatherapy.com`. Helper `They'll receive a sign-in invitation at this address.`
- `Role *` (`name="role_id"`) — default option `Pick a role`.
- `Gender *` (`name="gender"`) — options `Female`, `Male`. Helper `Used for same-gender booking matching.`

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Header CTA (admin) | `Add staff member` | Primary |
| Workload-strip segments (admin) | inline Ghost text (no buttons) — each segment is a `<Link>` | Ghost |
| Filter apply | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filters` (with count) | Ghost |
| Inactive disclosure | `Inactive members ({N})` (chevron) | Ghost |
| Specialties expand (mobile) | `{N} specialties` | Ghost |
| `NewStaffForm` submit | `Add staff member` | Primary |
| `NewStaffForm` cancel | `Cancel` | Secondary |
| Empty-state CTA (admin) | `Add staff member` | Primary |
| Denied CTA | `Back to dashboard` | Secondary |

### Error messages

**Filters / list:**
- Filter combination returns nothing: handled by empty state below.
- Search query too short: `Type at least 2 characters of a name or email.`
- List load failure: `Couldn't load the team. Try refreshing.`

**`NewStaffForm`:**
- `name` empty: `Add their full name so the team knows who joined.`
- `email` empty: `Add an email so they can sign in.`
- `email` malformed: `Email needs an @ symbol. For example: name@rahmatherapy.com.`
- `email` already used: `Someone with that email is already on the team. Open their profile if you need to update it.`
- `role_id` not picked: `Pick a role so they have the right permissions on day one.`
- `gender` not picked: `Pick their gender; it's used for same-gender booking matching.`
- Server save failure: `Couldn't add this team member. Try again.` (toast, persistent)
- Invitation-send failure (Resend): `Saved their profile, but couldn't send the invitation email. Resend it from their profile.`

### Empty-state text

| Scope | Heading | Body | CTA |
|---|---|---|---|
| Admin, no staff | `No staff yet. Add the first team member.` | `Therapists, coordinators, and admins all live in this directory.` | `Add staff member` |
| Admin, filtered to empty | `No staff match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Coordinator | `No bookable staff in your assignment pool yet` | `Bookable team members appear here once they're set up.` | — |
| Therapist | `No same-gender team members visible. Your profile is still here.` | `Your colleagues in the same-gender team will appear here when they're added.` | — |
| Denied | `Team access limited` | `Team directory access is restricted to active staff with directory visibility. Ask the owner if you need access.` | `Back to dashboard` |

### Tooltip text

- Avatar (real photo): native `title` shows full name.
- Avatar (initial token): native `title` shows full name.
- Role chip on a row: native `title` shows the full role description, e.g. `Booking Coordinator. Manages bookings and enquiries.`
- Status chip "Active": `Active. Can sign in and accept bookings.`
- Status chip "Bookings off": `Active but not accepting new bookings.`
- Status chip "Inactive": `Inactive. Sign-in blocked.`
- Workload pill: native `title` — `{N} upcoming bookings in the next 7 days`.
- Workload pill (0): `No upcoming bookings`.
- Workload pill Attention (8+): `Heavy load. Consider re-balancing.`
- Onboarding "{n}/6" segment (Attention): `Onboarding incomplete. Open the profile to finish setup.`
- Onboarding "6/6" segment (Confirmed): `Onboarding complete`.
- Profile completion segment: `{N} of {total} profile fields filled`.
- "You" chip on self-row (therapist): `This is you`.
- Specialties row item: native `title` shows the specialty name.
- Languages/Service-areas list: native `title` shows the full comma-joined list when truncated.
- Workload-strip segments: native `title` — `Filter to {segment-description}` (e.g. `Filter to onboarding-incomplete staff`).

### Confirmation dialog text

No `ConfirmActionModal` on the list view. Deactivate / Delete live on the staff detail page (Brief 29).

**Toasts**
- `NewStaffForm` save success: `{Name} added to the team. Invitation email sent.`
- `NewStaffForm` save with email-send failure: `{Name} added, but the invitation email didn't send. Resend it from their profile.` (persistent, Retry)
- Save failure: `Couldn't add this team member. Try again.` (persistent, Retry)
- Filter applied: no toast — list refresh is the feedback.
