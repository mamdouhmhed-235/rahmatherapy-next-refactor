# Shape Brief: `/admin/staff/<id>/availability` redesign

**Date:** 2026-05-12
**Page slug:** `staff-availability`
**Status:** user-confirmed
**Brief number:** 27 of 29 (Phase 5)

## 1. Feature Summary

The per-staff availability workstation: where the booking engine learns when a specific therapist works, when they're off, and any one-off overrides that bend the weekly pattern. Today the page exposes only the **weekly rule grid** (`staff_availability_rules`) and a use-global / custom mode toggle. The two adjacent tables, `staff_blocked_dates` and `staff_availability_overrides`, already feed the booking engine but have no editor UI; managing them requires direct database access. The redesign closes that gap by adding two net-new editable surfaces that parallel the global `BlockedDatesManager` and `AvailabilityOverridesManager` from Brief 13 (`/admin/availability`), so the staff-level page has the same three-manager shape as the global page.

## 2. Primary User Action

Three role-specific tasks share the surface:
- **Owner / Admin:** confirm a therapist's working pattern is right, drop in a closure for an upcoming holiday, or grant a one-day extended shift for a campaign.
- **Therapist (own profile):** edit their own working hours, mark a personal day off, or extend a Saturday by two hours for a busy weekend.

The shared mental model: **change exactly one of three things (weekly rule / blocked date / override) without affecting the other two**. The redesign optimises for that single-axis edit; the page is never a workstation that wants you to touch all three at once.

## 3. Design Direction

Three-manager stack matching the global availability page so the operator's muscle memory transfers. Mode selector (use_global vs custom) at the top, sitting in a quiet `surface-card` band so it reads as a switch, not a section. Below: three stacked `AdminPanel`s in fixed order; Weekly rules, Blocked dates, Availability overrides; each with the inline add-form-above-list pattern from Brief 13. Tab strip "Profile / Availability" repositioned with proper `aria-current="page"` (Sam #3 carry-forward). The current decorative header card (h-24 ivory band + avatar tile + tab nav baked inside) retires in favour of a flat `AdminPageHeader` with the avatar inline; no faux-banner chrome.

## 4. Scope

In:
- **Surface (a); Weekly rules.** Existing `StaffAvailabilityRulesForm` preserved verbatim re: server-action contract (RECON §6.4). Restyled to DESIGN.md tokens. Mode-selector behaviour (use_global / custom) unchanged at data layer; visually surfaced as a Confirmed/Pending family banner reflecting which mode this staff member is currently in ("Using global hours" → Pending family pill, edits to weekly rules disabled with a Ghost "Switch to custom hours" CTA; "Custom hours" → Confirmed family pill, edits enabled).
- **Surface (b); Blocked dates (net-new editor).** New `StaffBlockedDatesManager` client component paralleling `BlockedDatesManager` from `/admin/availability`. Lists `staff_blocked_dates` rows for this staff_id (date, all_day boolean, optional reason). Inline add form above list (date input + optional reason + "Add closure" Secondary). Per-row delete via `ConfirmActionModal` (matches Brief 13's destructive pattern). New server actions: `addStaffBlockedDate(formData)` and `deleteStaffBlockedDate(blockedDateId)` (net-new; flag in §10 Q1 for backend confirmation; same pattern as Brief 22's `deleteRole` net-new ask).
- **Surface (c); Availability overrides (net-new editor).** New `StaffAvailabilityOverridesManager` client component paralleling `AvailabilityOverridesManager`. Lists `staff_availability_overrides` rows (date, start_time, end_time, optional reason). Inline add form above list (date input + start time + end time + optional reason + "Add override" Secondary). Per-row delete via `ConfirmActionModal`. New server actions: `addStaffAvailabilityOverride(formData)` and `deleteStaffAvailabilityOverride(overrideId)` (same flag as (b)).
- Tab strip "Profile / Availability" rebuilt as `TabPills` per Brief 01 with `aria-current="page"` (Sam #3 carry-forward). The active-tab indicator becomes Clinic Green fill + Field White text per DESIGN.md §Admin-Specific Patterns → View Tabs, not the current `border-b-2 border-[var(--rahma-green)]` colour-only treatment.
- Decorative h-24 ivory banner + 96px avatar tile + nested tab nav (lines 75–113) retires. Replace with flat header: 40px circular avatar + name H1 + Soft Slate sub-line "Availability" + tab strip below the header.
- "Bookings off" / inactive states adapt: when `staff.active === false`, surface a Restricted-family page-level banner above the three managers reading "This staff member is inactive. Availability edits won't take effect until they're reactivated." All three managers stay editable (the data still matters for audit trails and reactivation prep), but the banner makes the no-op nature obvious.
- Empty states via shared `EmptyState` for each of the three managers (matches Brief 13).
- Carry-forward soft fixes per Phase 6: raw `var(--rahma-*)` token escapes throughout, `bg-white` on header card, `shadow-soft` + `shadow-md` on header chrome (Tonal Lift Rule), `border-2 border-white` decorative ring on avatar, `var(--rahma-green)` / `var(--rahma-muted)` decorative avatar tile, raw permission identifier on the denied screen (line 38), `border-b-2` colour-only active-tab signal (Sam #3).

Out (unchanged):
- `staff_availability_rules` schema, the existing `StaffAvailabilityRulesForm` server-action contract, and the use_global / custom mode logic (RECON §5 untouchable).
- `staff_blocked_dates` and `staff_availability_overrides` table schemas. The booking engine's read path against both is untouchable.
- Permission gate (`manage_availability_global` OR `own && manage_availability_own`) preserved verbatim.
- No availability "preview" that shows the resolved schedule for a future day (that's the booking engine's job; surfacing it here would duplicate logic and drift).
- No cross-staff bulk operations. This page is one staff member's availability, full stop.

## 5. Layout Strategy

Page chrome (top to bottom):
1. Breadcrumb link "← {staff.name} Profile" (Soft Slate label step) at top-left.
2. **Flat page header:** 40px circular avatar + H1 staff name + Soft Slate sub-line reading "Availability". No banner, no avatar-on-a-stripe theatre. Avatar treatment matches Brief 26 (real photo or initialled Hover-Moss token).
3. **Tab strip** (`TabPills`): "Profile Settings" / "Availability" with `aria-current="page"` on the active tab. Sits below header, above the mode-selector band.
4. **Mode-selector band** (`surface-card` + `border-subtle` top + bottom, full-width): segmented control "Use global hours / Custom hours" with the matching status-family pill rendered to the right of the segmented control. Sub-line below the segmented control explaining the consequence: "This staff member follows the clinic-wide working hours from Settings." / "This staff member has their own working pattern set below."
5. **Three stacked `AdminPanel`s** (fixed order, vertical stack on all viewports; no two-column variant; the three managers are sequential mental models, not parallel ones):

**Panel A; Weekly rules** (existing `StaffAvailabilityRulesForm`):
- H2 "Weekly working hours".
- Description: "The recurring pattern the booking engine uses every week."
- Body: existing 7-row per-day grid (one row per day-of-week) preserved verbatim. Each row: day label + working/off toggle + start time + end time + delete (when multiple rules per day exist).
- Footer: "Add rule" Ghost (preserved).
- Disabled state (when mode = "Use global hours"): rows render read-only, inputs in `surface-input` with `disabled` semantics; a single line above the grid reads "These rows show the global pattern. Switch to custom hours above to edit this staff member's schedule." Ghost "Switch to custom hours" inline.

**Panel B; Blocked dates** (net-new `StaffBlockedDatesManager`):
- H2 "Blocked dates".
- Description: "Days this staff member isn't available. Closures override the weekly pattern."
- Inline add form (above list, matching Brief 13 grammar):
  - Date input (`type="date"`, required).
  - All-day checkbox (default checked).
  - Reason input (optional, helper "What's this for? Visible to admin only.").
  - Secondary "Add closure".
- List below: each row is a single `AdminEntityRow`:
  - Left: `XCircle` Lucide 14px in Cancelled text.
  - Centre: formatted date (`Mon, 12 May 2026`) Work Sans 500 body step + " · All day" (when all_day) or " · {start}–{end}" (future-proofing for partial-day closures; current schema is all_day boolean so the partial-day branch stays in the off position until schema gains start/end).
  - Sub-line: reason in Soft Slate (omitted if null).
  - Trailing: `Trash2` Ghost button → `ConfirmActionModal` Cancelled family: "Remove this closure? The {date} block will be deleted; the booking engine will treat the day as available again."
- Empty: `EmptyState` inline-style line "No closures set. The booking engine will offer every working-pattern slot for this staff member."

**Panel C; Availability overrides** (net-new `StaffAvailabilityOverridesManager`):
- H2 "One-off overrides".
- Description: "Hours that replace the weekly pattern for a single date. Use this for extended Saturdays or a half-day clinic."
- Inline add form (above list):
  - Date input (required).
  - Start time + End time (both required, validated server-side: start < end, and start/end within the clinic's general operating window from `business_settings`; soft client check + server enforcement).
  - Reason input (optional).
  - Secondary "Add override".
- List below: each row is an `AdminEntityRow`:
  - Left: `Calendar` Lucide 14px in Pending text.
  - Centre: formatted date + " · {start}–{end}" + small Pending-family "Override" chip.
  - Sub-line: reason in Soft Slate (omitted if null).
  - Trailing: `Trash2` Ghost button → `ConfirmActionModal` Cancelled family: "Remove this override? The {date} hours will revert to the weekly pattern."
- Empty: inline line "No overrides scheduled. The weekly pattern applies on every working day."

**Inactive-staff banner (when applicable):**
- Renders above the mode-selector band: Restricted-family banner with `lock` icon + body "This staff member is inactive. Availability edits won't take effect until they're reactivated."

**Mobile (≤md):**
- Mode-selector segmented control stacks above the explanatory sub-line.
- Three panels stack identically (already stacked).
- Per-row trailing `Trash2` becomes inline below the row's centre column on `sm:` and below.
- Inline add forms wrap into single-column field stacks; Secondary submit becomes full-width.

## 6. Key States

- **Default; populated, custom mode.** All three panels populated; weekly rules editable; mode pill Confirmed family "Custom hours".
- **Default; populated, global mode.** Weekly rules read-only with the inline "Switch to custom hours" Ghost; mode pill Pending family "Using global hours". Blocked dates and overrides remain editable (they're per-staff regardless of mode).
- **Inactive staff.** Restricted-family banner pinned above all panels.
- **Loading.** `AdminSkeleton`: page header + tab strip (instant) + mode-selector band (instant) + three panel headers + 4 row skeletons each.
- **Add closure submitting / Add override submitting.** Secondary submit `aria-busy="true"` with spinner; on success, the new row appends at the top of the list with a brief Confirmed-family tinted background (one frame, no animation); Sonner Confirmed toast: "Closure added for {date}." / "Override added for {date}."
- **Add validation error.** Per-field `role="alert"` region below the offending input; field border shifts to Cancelled; focus moves to the first invalid field.
- **Delete closure / Delete override.** `ConfirmActionModal` Cancelled family with the body copy from §5; on confirm, row animates out; Sonner Confirmed: "Closure removed." / "Override removed."
- **Delete failure.** Cancelled-family Sonner with Retry Ghost, no auto-dismiss.
- **Mode switch (Use global → Custom).** No confirm modal (non-destructive: switching from a derived pattern to an empty custom pattern requires the operator to then fill in rules; the inline empty state on Panel A guides the next step). On switch: mode pill updates, Panel A's rows become editable, an inline EmptyState appears inside Panel A reading "No custom rules yet. Add a rule for each working day." with Ghost "Add rule".
- **Mode switch (Custom → Use global).** Confirm modal Cancelled family: "Switch to global hours? The custom rules you've set for this staff member will be hidden but not deleted. Switching back to custom restores them." Primary "Use global hours" (Destructive variant since the operator is opting out of a configured pattern) / Secondary "Cancel".
- **Empty all three panels (fresh staff member).** All three managers render their inline empty lines; no overarching page-level empty state (the page is a workstation, not a directory).
- **Self-edit (Therapist on own profile).** Same surface; some sub-line copy adapts (see §11).

### Backend error states (Layer 3 — for Phase 6 `/impeccable harden`)

| State | What the user sees |
|---|---|
| Add blocked date: duplicate date submitted (same `staff_id` + `date` exists) | `role="alert"` below date field: "That date is already closed. Edit or delete the existing entry." Secondary submit stays enabled (not `aria-busy`); row is NOT added |
| Add blocked date: past date submitted | `role="alert"`: "Pick a date from today onwards." |
| Add blocked date: permission mismatch (Therapist submits another staff member's `staff_id`) | Server returns 403; Sonner Cancelled toast (no auto-dismiss): "You can only edit your own availability." Form resets |
| Add override: `start_time >= end_time` | `role="alert"`: "End time has to be after start time." |
| Add override: conflicting override on same date | `role="alert"`: "That date already has an adjustment. Delete the existing one first." |
| Add override: permission mismatch | Same 403 pattern as blocked date |
| Delete (either type): row belongs to another staff member | Server returns 403; Sonner Cancelled toast: "Couldn't remove. Try again." Row remains visible in list |
| Add override: date is a non-working day in the weekly pattern | Pending-family warning banner above the override add-form submit (not a blocking error): "That day is already a non-working day. Continue?" — Secondary "Add override anyway" proceeds and saves the row; the booking engine may still not surface slots until the weekly rule is updated. Primary "Cancel" returns focus to the date field |
| Add/delete network failure | Sonner Cancelled (no auto-dismiss): "Couldn't save. Try again." Ghost "Retry" button |

## 7. Interaction Model

- **Mode-selector segmented control.** Client component. "Use global → Custom" is one-click; "Custom → Use global" gates through `ConfirmActionModal`. Both submit through the existing mode-update server action (preserved verbatim).
- **Weekly rules form (Panel A).** Existing `StaffAvailabilityRulesForm` preserved; submit, add, remove server-action contracts untouched. Restyled inputs only.
- **Blocked dates manager (Panel B).** Inline add form posts to net-new `addStaffBlockedDate` server action with named fields `staff_id` (hidden), `date`, `all_day`, `reason`. Delete posts to `deleteStaffBlockedDate` with `blocked_date_id`.
- **Overrides manager (Panel C).** Inline add form posts to net-new `addStaffAvailabilityOverride` server action with named fields `staff_id` (hidden), `date`, `start_time`, `end_time`, `reason`. Delete posts to `deleteStaffAvailabilityOverride` with `override_id`.
- **Optimistic UI.** Add operations append the row optimistically; on server error, the row rolls back and a Cancelled toast fires.
- **Sort.** Both Blocked dates and Overrides lists sort by date ascending (next-upcoming first). Past entries auto-roll to a collapsed-by-default `<details>` "Past closures ({n})" / "Past overrides ({n})" inside each panel; keeps the queue scannable as months accumulate.
- **Keyboard.** Tab traverses tab strip → mode selector → Panel A inputs → Panel A's "Add rule" → Panel B add-form fields → Panel B list → Panel C add-form fields → Panel C list.
- **No URL state.** All three managers' edits are server mutations; no `?tab=` or similar on this sub-route (tab strip URL already differentiates Profile vs Availability).

## 8. Content Requirements

- Breadcrumb: "← {staff.name} Profile".
- Page H1: staff name.
- Page sub-line: "Availability".
- Tab labels: "Profile Settings" / "Availability".
- Mode pill copy: "Using global hours" (Pending family) / "Custom hours" (Confirmed family).
- Mode explanation: "This staff member follows the clinic-wide working hours from Settings." / "This staff member has their own working pattern set below."
- Mode switch confirm modal title: "Switch to global hours?"
- Mode switch confirm modal body: "The custom rules you've set for this staff member will be hidden but not deleted. Switching back to custom restores them."
- Mode switch confirm Primary: "Use global hours" (Destructive variant).
- Inactive-staff banner: "This staff member is inactive. Availability edits won't take effect until they're reactivated."
- Panel A title: "Weekly working hours".
- Panel A description: "The recurring pattern the booking engine uses every week."
- Panel A global-mode inline: "These rows show the global pattern. Switch to custom hours above to edit this staff member's schedule."
- Panel A custom-mode empty: "No custom rules yet. Add a rule for each working day."
- Panel B title: "Blocked dates".
- Panel B description: "Days this staff member isn't available. Closures override the weekly pattern."
- Panel B add-form labels: "Date", "All day", "Reason".
- Panel B add-form Secondary: "Add closure".
- Panel B success toast: "Closure added for {formatted date}."
- Panel B delete modal title: "Remove this closure?"
- Panel B delete modal body: "The {formatted date} block will be deleted. The booking engine will treat the day as available again."
- Panel B empty: "No closures set. The booking engine will offer every working-pattern slot for this staff member."
- Panel B past-collapse: "Past closures ({n})".
- Panel C title: "One-off overrides".
- Panel C description: "Hours that replace the weekly pattern for a single date. Use this for extended Saturdays or a half-day clinic."
- Panel C add-form labels: "Date", "Start time", "End time", "Reason".
- Panel C add-form Secondary: "Add override".
- Panel C success toast: "Override added for {formatted date}."
- Panel C delete modal title: "Remove this override?"
- Panel C delete modal body: "The {formatted date} hours will revert to the weekly pattern."
- Panel C empty: "No overrides scheduled. The weekly pattern applies on every working day."
- Panel C past-collapse: "Past overrides ({n})".
- Denied state copy: "Availability access requires either own-availability permission (for your own profile) or global availability permission. Ask the owner if you need either." (no raw `manage_availability_own or manage_availability_global` identifier).

## 9. Recommended References

- Brief 13 (`availability`) → direct parallel for `BlockedDatesManager` and `AvailabilityOverridesManager`; copy the inline-add-form pattern, the per-row delete + `ConfirmActionModal` treatment, and the empty-state inline grammar verbatim.
- Brief 26 (`staff` directory) → avatar treatment (real photo or initialled Hover-Moss token).
- Brief 18 (`client-detail`) → conditional panel composition; this page's mode-selector gates Panel A read/write, similar grammar.
- Brief 22 (`role-detail`) → net-new server action pattern (`deleteRole` precedent applies to the four new add/delete actions on this page).
- DESIGN.md §Admin-Specific Patterns → View Tabs (`aria-current="page"` resolution for Sam #3).
- DESIGN.md §5 → Inputs and Fields (Form Seam border, required marker, error region).
- BASELINE-CRITIQUE Sam #3 (active-tab `aria-current` missing) resolves here for the Profile/Availability tab strip.

## 10. Open Questions

1. **Net-new server actions on `src/app/admin/staff/[staffId]/availability/actions.ts`.** Four new actions (`addStaffBlockedDate`, `deleteStaffBlockedDate`, `addStaffAvailabilityOverride`, `deleteStaffAvailabilityOverride`) are required to make Surfaces (b) and (c) editable. The global `/admin/availability` already has analogous helpers (per Brief 13's data layer); the open question is whether Phase 6 extends those to accept a `staff_id` argument or creates a parallel set on this route. Proposal: create a parallel set on this route; keeps the global path RECON §5 untouchable, and the per-staff actions can enforce the `own && manage_availability_own` permission check inline. Flag for backend confirmation before implementation.
2. **All-day vs partial-day closures.** Current `staff_blocked_dates` schema carries an `all_day` boolean; the existing global `BlockedDatesManager` (Brief 13) treats them as all-day only. Open question: do we expose partial-day closures here too, given that overrides (Surface c) already cover the "I'll work different hours that day" case? Proposal: keep blocked dates strictly all-day on this page; partial-day modelling is what overrides exist for. The schema field stays unused for now.
3. **Sort: next-upcoming first vs chronological.** Next-upcoming-first puts the operator's actionable items at the top; pure chronological mixes past and future. Proposal: next-upcoming first, past behind a collapsed disclosure. Matches the Brief 13 pattern.

## 11. Role variants

Access gate: `manage_availability_global` OR (`own_profile && manage_availability_own`). Four roles can reach this page through different routes.

### Owner

`manage_availability_global` always held. Full surface across any staff member.
- Mode selector: both directions interactive (global → custom one-click, custom → global through confirm).
- All three panels editable.
- Banner appears on inactive staff but doesn't block edits.
- Denied state never reached.

### Admin (Practice Manager)

PM holds `manage_availability_global` by default. Identical to Owner for this surface. If a future RBAC change strips that permission, PM falls through to the same `own && manage_availability_own` path Therapist uses (and only their own page becomes editable).

### Booking Coordinator

Coordinator holds neither `manage_availability_global` nor `manage_availability_own`. Collapse to the **Denied state**.

(Coordinators do need to *see* staff availability to assign work, but they don't edit it; the booking engine and `/admin/staff/<id>` profile page surface the resolved availability without exposing this editor.)

### Therapist

Therapist holds `manage_availability_own` but not `manage_availability_global`. Access bifurcates:

- **On own profile (`isOwnProfile === true`):** Full editor surface. Mode selector available (custom → global confirm explains "the clinic's working hours will replace yours" in the same modal copy, just with first-person framing in the sub-line). All three panels editable on self. Sub-line under the page header reads "Your availability" instead of just "Availability"; small voice anchor (PRODUCT.md "real names"). Inactive banner can't apply to self (an inactive therapist is blocked at the middleware).
- **On another staff member's profile (`isOwnProfile === false`):** Denied state. Copy adapts slightly: "You can manage your own availability. Open your profile to make changes."

### Denied state

`AdminAccessDenied` invoked when the access gate fails:

- Title: "Availability access limited"
- Body: "Availability access requires either own-availability permission (for your own profile) or global availability permission. Ask the owner if you need either."
- Therapist-on-another-staff variant: "You can manage your own availability. Open your profile to make changes." with a Secondary "Open my availability" → `/admin/staff/<own_id>/availability`.
- No raw `manage_availability_own or manage_availability_global` permission identifier on screen (current `page.tsx:38` leaks it; fix in Phase 6).
- Single Secondary "Back to staff directory" → `/admin/staff`.

---

## Recipe Context

- **RECON §2 inventory row:** Staff availability — `src/app/admin/staff/[staffId]/availability/page.tsx` (+ `AvailabilityModeSelector.tsx`, `StaffAvailabilityRulesForm.tsx`) — `/admin/staff/<id>/availability` — Mode selector (use_global / custom) + per-day rule editor. Note: Profile/Availability tab nav lacks `aria-current="page"` (RECON §8 / Sam #3).
- **Post-Phase-5 amendment (RECON.md line 5):** This page's scope explicitly extended to cover `staff_blocked_dates` and `staff_availability_overrides` (both tables read by the booking engine with no editable UI today). This brief delivers that extension.
- **Access gate (RECON §3):** `manage_availability_global` OR (`isOwnProfile && manage_availability_own`). All four active roles can reach via different paths; Inactive blocked at middleware.
- **Untouchable backend (RECON §5):** `staff_availability_rules` server-action contract (`StaffAvailabilityRulesForm`'s submit + add + delete). `AvailabilityModeSelector`'s mode-update action. `staff_availability_rules`, `staff_blocked_dates`, `staff_availability_overrides` table schemas. Booking-engine read paths against all three.
- **Preserved IDs / form names (RECON §6.4):** Existing weekly-rules form fields preserved verbatim. Net-new add/delete forms for blocked dates and overrides use named fields `staff_id`, `date`, `all_day`, `reason` (Panel B); `staff_id`, `date`, `start_time`, `end_time`, `reason` (Panel C); `blocked_date_id` / `override_id` for deletes. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** None currently; redesign adds none. Tab strip URL differentiation between Profile and Availability already lives at the route level.
- **Net-new server actions:** `addStaffBlockedDate`, `deleteStaffBlockedDate`, `addStaffAvailabilityOverride`, `deleteStaffAvailabilityOverride` per §10 Q1. Awaiting backend confirmation in Phase 6.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** Sam #3 active-tab `aria-current="page"` missing on the Profile/Availability nav at `page.tsx:99–112` (RECON §8 confirmed). Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout; `bg-white` + `shadow-soft` on header card at `page.tsx:75–77` (Tonal Lift Rule); `shadow-md` on avatar tile at line 82; `border-2 border-white` decorative ring at line 82; `var(--rahma-green)` / `var(--rahma-muted)` conditional avatar fill at line 83; `bg-[var(--rahma-ivory)]` decorative banner at line 79; `border-b-2` colour-only active-tab signal at line 108; raw permission identifier on `AdminAccessDenied` at `page.tsx:38`.
- **IMAGES-NEEDED additions:** None specific to this page; avatar uses the same real-photo-or-initial-token pattern as Brief 26.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Three-manager stack: Weekly rules / Blocked dates / Availability overrides render in fixed order with H2 headings contiguous under page H1.
  - Sam #3 fix: active tab carries `aria-current="page"`; active state composition is Clinic Green fill + Field White text (not colour-only `border-b-2`).
  - Tonal Lift: header card has no `shadow-soft`; resting state is flat with surface lightness only.
  - Mode selector: global → custom one-click; custom → global gates through `ConfirmActionModal` with Destructive Primary; both submits use the existing untouchable mode-update action.
  - Net-new server actions: `addStaffBlockedDate`, `deleteStaffBlockedDate`, `addStaffAvailabilityOverride`, `deleteStaffAvailabilityOverride` exist on `actions.ts` with permission checks (`manage_availability_global` OR `isOwnProfile && manage_availability_own`) before mutation.
  - Add round-trip: optimistic prepend + Confirmed toast on success; rollback + Cancelled toast on failure with Retry.
  - Delete round-trip: `ConfirmActionModal` Cancelled family fires; on confirm, row animates out; on cancel, row remains.
  - Sort + past-disclosure: lists ascend by date; past entries inside collapsed `<details>`.
  - Inactive staff: Restricted banner above mode selector; all three managers stay editable.
  - Role pass: Owner / Admin / Coordinator (denied) / Therapist on own profile (full editor with "Your availability" sub-line) / Therapist on another profile (denied with "Open my availability" Secondary).
  - A11y pass: `AdminAccessDenied` no longer renders the raw permission identifier; net-new add forms wrap errors in `role="alert" aria-live="polite" aria-atomic="true"`; required `*` markers in Cancelled text colour; tab strip keyboard-accessible.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**Mode-selector segmented control:**
- Group label `Availability mode` (sr-only). Options: `Use global hours` / `Custom hours`.

**Panel A — Weekly working hours (`StaffAvailabilityRulesForm`, preserved):**
- Per row: `Day` (sr-only, day label is visible), `Working day` (toggle), `Opens` (`name="start_time"`), `Closes` (`name="end_time"`).

**Panel B — Blocked dates (`StaffBlockedDatesManager`, net-new):**
- `Date *` (`name="date"`, type `date`).
- `All day` (`name="all_day"`, checkbox, default checked).
- `Reason` (`name="reason"`, optional). Helper `What's this for? Visible to admin only.` Placeholder `e.g. Eid, family wedding, sick leave`.

**Panel C — One-off overrides (`StaffAvailabilityOverridesManager`, net-new):**
- `Date *` (`name="date"`).
- `Start time *` (`name="start_time"`).
- `End time *` (`name="end_time"`).
- `Reason` (`name="reason"`, optional). Placeholder `e.g. Extended Saturday, half-day clinic`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Mode segmented control | `Use global hours` / `Custom hours` | Segmented |
| Switch-to-custom from disabled Panel A | `Switch to custom hours` | Ghost |
| Mode switch custom→global confirm | `Use global hours` | Destructive |
| Mode switch confirm cancel | `Cancel` | Secondary |
| Panel A: save rules | `Save hours` | Primary |
| Panel A: add rule | `Add rule` | Ghost |
| Panel B: add closure | `Add closure` | Secondary |
| Panel B: per-row delete | (icon `trash-2`) | Ghost — tooltip `Remove this closure` |
| Panel C: add override | `Add override` | Secondary |
| Panel C: per-row delete | (icon `trash-2`) | Ghost — tooltip `Remove this override` |
| Past-entries disclosure | `Past closures ({N})` / `Past overrides ({N})` | Ghost |
| Delete-closure modal confirm | `Remove` | Destructive |
| Delete-override modal confirm | `Remove` | Destructive |
| Delete modal cancel | `Keep it` | Secondary |
| Denied — therapist on other staff | `Open my availability` | Secondary |
| Denied — generic | `Back to staff directory` | Secondary |

### Error messages

- Working day end before start: `End time has to be after start time.`
- Working day with no times: `Set opening and closing times for this day, or toggle it off.`
- Blocked date in the past: `Pick a date from today onwards.`
- Blocked date already exists: `That date is already closed. Edit or delete the existing entry.`
- Override start ≥ end: `End time has to be after start time.`
- Override conflicts with existing override on same date: `That date already has an override. Delete the existing one first.`
- Override on a day the weekly pattern marks closed: `That day is already a non-working day. Use Blocked dates if you need to confirm a closure, or change the weekly pattern first.`
- Override outside clinic operating window (soft warning): `Those hours fall outside the clinic's normal operating window. Continue?` (Pending banner above submit; click-through allowed)
- Add/save server failure: `Couldn't save. Try again.` (toast, persistent)
- Delete server failure: `Couldn't remove. Try again.` (toast, persistent)
- Inactive staff edit attempt: no error — banner above clarifies edits won't take effect until reactivation.
- Therapist edit on own profile: no special error states beyond the above.

### Empty-state text

| Panel | Heading / inline copy | Body | CTA |
|---|---|---|---|
| Panel A (custom mode, no rules yet) | `No custom rules yet` | `Add a rule for each working day to define this staff member's weekly pattern.` | `Add rule` |
| Panel A (global mode, disabled) | (inline above grid) | `These rows show the global pattern. Switch to custom hours above to edit this staff member's schedule.` | `Switch to custom hours` |
| Panel B empty | (inline line, no full EmptyState) | `No closures set. The booking engine will offer every working-pattern slot for this staff member.` | — |
| Panel C empty | (inline line) | `No overrides scheduled. The weekly pattern applies on every working day.` | — |
| Inactive-staff banner (above all panels) | (no heading) | `This staff member is inactive. Availability edits won't take effect until they're reactivated.` | — |
| Denied — generic | `Availability access limited` | `Availability access requires either own-availability permission (for your own profile) or global availability permission. Ask the owner if you need either.` | `Back to staff directory` |
| Denied — therapist on other staff | `Open your own availability instead` | `You can manage your own availability. Open your profile to make changes.` | `Open my availability` |

### Tooltip text

- Mode pill ("Using global hours"): native `title` — `Falls back to the clinic-wide working hours in Settings.`
- Mode pill ("Custom hours"): `Has their own working pattern set here.`
- Per-row weekly working day toggle: `aria-label="{Day} working day"`.
- Panel B row date: native `title` shows day-of-week — e.g. `Monday, 26 May 2026 (Bank Holiday)`.
- Panel B "All day" checkbox: `Block the entire day. Partial-day closures use overrides.`
- Panel B `trash-2`: `Remove this closure`.
- Panel C "Override" chip on a row: `These hours replace the weekly pattern for this date.`
- Panel C `trash-2`: `Remove this override`.
- Past disclosure: `Show past entries`.
- "Switch to custom hours" Ghost (when Panel A disabled): `Start a custom weekly pattern for this staff member`.
- Self-view sub-line "Your availability": `These are your working hours and time off`.

### Confirmation dialog text

**Mode switch — Custom → Use global**
- Heading: `Switch to global hours?`
- Body: `The custom rules you've set for this staff member will be hidden but not deleted. Switching back to custom restores them.`
- Destructive: `Use global hours`
- Secondary: `Cancel`

(Custom → Use global direction only. The opposite direction is one-click.)

**Remove closure (Panel B)**
- Heading: `Remove this closure?`
- Body: `The {formatted date} block will be deleted. The booking engine will treat the day as available again from the next sync.`
- Destructive: `Remove`
- Secondary: `Keep it`

**Remove override (Panel C)**
- Heading: `Remove this override?`
- Body: `The {formatted date} hours will revert to the weekly pattern.`
- Destructive: `Remove`
- Secondary: `Keep it`

**Toasts**
- Save hours success: `Working hours saved.`
- Add closure success: `Closure added for {formatted date}.`
- Add override success: `Override added for {formatted date}.`
- Remove closure success: `Closure removed.`
- Remove override success: `Override removed.`
- Mode switched: `Now using {global|custom} hours.`
- Any failure: persistent Cancelled toast with `Retry` Ghost.
