# Shape Brief: `/admin/roles/<id>` redesign

**Date:** 2026-05-12
**Page slug:** `role-detail`
**Status:** user-confirmed
**Brief number:** 22 of 29 (Phase 5)

## 1. Feature Summary

The Owner's single-role workstation: edit role metadata, toggle every individual permission grant, and see at-a-glance which staff sit on this role. Permissions arrive from the catalogue with category, scope, and risk_level metadata that the current page doesn't surface; the redesign promotes that metadata into the row composition so the Owner can see *what they're about to grant* without bouncing to documentation. Adds a destructive deactivate-role flow wired through `ConfirmActionModal`.

## 2. Primary User Action

**Grant or revoke a specific permission for this role, confidently.** Confidence requires three things the current page partially supplies: a clear description of the permission, an explicit risk level (low / medium / high / critical; already in the data, not yet shown), and an obvious safety net when touching the Owner role. Secondary actions: rename / re-describe the role (metadata form), browse who currently holds it (staff sidebar), deactivate or delete the role (destructive footer).

## 3. Design Direction

Calm administrative workstation, two-column on desktop. Permissions are the primary surface (left, wider column) and behave as a long but navigable list grouped by category with sticky category labels; metadata + staff occupy a narrower right rail. The current `border + bg-white + rounded-xl` permission cards become flat list-row entries on `surface-page` with toggle on the right. Risk level rides as a tinted chip on each row; Restricted family for low, Pending for medium, Attention for high, Cancelled for critical, so the Owner reads the row's danger before reaching for the toggle. The current decorative `ShieldCheck` tile in the header retires (same critique as roles-list); replace with a role-letter token consistent with Brief 20.

## 4. Scope

In:
- Two-column desktop layout (`xl:` `1fr 22rem`); single column on mobile with metadata/staff stacked below permissions.
- Page header: breadcrumb "Roles" link + role-letter token + H1 role display name + system/active chips + DB role mono + description (Soft Slate, line-clamp-2 + "Show more").
- **Permissions surface (left column):**
  - Grouped by `category`, sticky category headers (Work Sans 500 label step, all-caps), inside a single `AdminPanel` with the panel header reading "Permissions ({granted} of {total} granted)".
  - Per-permission row: title + scope chip + risk-level chip + description in Soft Slate + Switch toggle on the right. No nested cards.
  - Filter strip above permissions: category (multi-select), risk_level (multi-select), free-text `q` over name/description, "Granted only" toggle. All GET params.
  - Sticky "Granted on this role: {n} permissions" footer summary inside the panel that updates as toggles flip (client-side count).
- **Metadata + staff sidebar (right column):**
  - `RoleMetadataForm` repositioned and restyled (DESIGN.md tokens), preserved field contract per RECON §6.4 (`role_id`, `display_label`, `description`, `sort_order`, `active`, hidden `active=on` shadow for system roles).
  - Staff-on-role list as `AdminEntityRow`-style entries (avatar + name + email + inactive chip when applicable). Plain text "No staff assigned." for empty.
  - Below the metadata form, a destructive footer panel with two actions: "Deactivate role" (Secondary, only if currently active) and "Delete role" (Destructive button, only if `!is_system && staff_count === 0`). Both gated by `ConfirmActionModal`.
- Confirm-on-owner-role logic for permission toggles preserved verbatim (currently handled inline in `PermissionRow.tsx`), restyled to use the shared `ConfirmActionModal` instead of the ad-hoc `Dialog` to standardise the destructive pattern.
- New `ConfirmActionModal` paths for high-risk and critical permission toggles on any role (not just Owner): toggling a `risk_level=critical` permission grant always confirms; toggling a `risk_level=high` permission confirms when *granting* (revoking is safe enough to be one-click).
- Carry-forward soft fixes per Phase 6: raw `var(--rahma-*)` token escapes, raw `var(--rahma-green)` decorative tile, `bg-red-100`/`text-red-700` inactive chip → Cancelled/Restricted family, raw permission identifier on the denied screen.

Out (unchanged):
- `updateRoleMetadata`, `togglePermissionForRole`, `createRole` server actions and their form contracts (RECON §5 untouchable, §6.4 preserved).
- `permissions` catalogue (categories, scope, risk_level enums). Read-only on this page; no permission editing.
- Inactive staff still appear in the staff sidebar with the inactive chip; not filtered out.
- `is_system` editing rules; the existing hidden `active=on` shadow stays.
- No bulk grant/revoke. Each toggle is a deliberate action.

## 5. Layout Strategy

Page chrome (top to bottom):
1. Breadcrumb link "← Roles" (Soft Slate label step).
2. **Page header:** letter token (Hover Moss, Practice Charcoal) + role display name as H1 + Restricted/Confirmed system/active chip cluster + DB role mono line. Description as one wrapped paragraph below, Soft Slate body, line-clamp-2 + "Show more" Ghost when longer.
3. Two-column grid on `xl:` (`1fr 22rem`), single column below.

**Left column; Permissions:**
- Filter strip (Inputs on Form Seam): category multi-select, risk_level multi-select, "Granted only" toggle, free-text `q`. Apply Secondary; Clear Ghost when active.
- Single `AdminPanel` titled "Permissions" with the granted-count badge in the panel header ("12 of 47").
- Permissions list, grouped by `category`, ordered by `name`:
  - Each category opens with a sticky `position: sticky; top: 0;` header inside the panel: Work Sans 500 all-caps label step, Soft Slate text, 1px `border-subtle` bottom. Sticky stays inside the panel's scroll context, not the page.
  - Per-permission row composition:
    - Centre, flexible column:
      - Top: permission name (Work Sans 600 body step, Practice Charcoal) + scope chip (Restricted family, label step, e.g. "scope: all" / "scope: own") + risk chip (Restricted/Pending/Attention/Cancelled for low/medium/high/critical, label step).
      - Sub-line: description (Soft Slate body step). If null, omitted.
      - Sub-line 2 (optional): mono `permission.name` token (e.g. `manage_staff_profiles`) in label step Soft Slate. Surfaced consistently because this is the identifier appearing in audit logs and code.
    - Right rail: shadcn `Switch` primitive restyled to DESIGN.md tokens. Granted = Clinic Green track with Field White thumb; revoked = Warm Veil track with Practice Charcoal thumb. `aria-label` reads "{permission name}: granted" / "revoked".
- Panel footer (sticky inside panel): "{n} permissions granted on this role" in Work Sans 500 label step.

**Right column; Metadata + Staff + Danger zone:**
- `RoleMetadataForm` panel: H3 "Role details" + form fields (display_label / description / sort_order / active toggle). Save Primary at the bottom of the form. Disabled fields where the existing logic enforces (`is_system` constrains some).
- Staff panel: H3 "Staff with this role" + count badge. List of `AdminEntityRow` entries (avatar + name + email + inactive chip if `!s.active`). Empty: inline "No staff assigned." in Soft Slate. Each row links to `/admin/staff/<id>`.
- Danger-zone panel: H3 "Role lifecycle" + two action buttons:
  - **Deactivate role** Secondary (visible only when `role.active === true`). Click → `ConfirmActionModal` Cancelled family: "Deactivate {display_label}? Staff with this role keep their assignment but won't see admin surfaces until they're moved to an active role." Primary "Deactivate" / Secondary "Cancel".
  - **Delete role** Destructive (visible only when `!is_system && staff_count === 0`). Click → `ConfirmActionModal` Cancelled family: "Delete {display_label}? This can't be undone. The role has no staff assigned." Primary "Delete role" / Secondary "Cancel". When `is_system`, the button is omitted entirely with a one-line note "System roles can't be deleted." (Plain English, never a tooltip-only signal.)

**Mobile (≤lg):**
- Sidebar columns collapse below permissions in order: Metadata → Staff → Danger zone.
- Permission filter strip collapses behind a "Filters" Ghost → `AdminSheet` from the bottom.
- Sticky category headers remain inside the panel scroll; the panel itself becomes a scroll region with `max-h-[70vh]` so the operator can keep filters visible.
- Save Primary in metadata form becomes full-width.

## 6. Key States

- **Default; populated.** All permissions visible, grouped by category, granted-on-this-role badge accurate.
- **Loading.** `AdminSkeleton`: header (instant), filter strip (instant), category header + 5 row skeletons in the panel, sidebar form skeleton + 3 staff row skeletons.
- **Permission toggle on Owner role.** `ConfirmActionModal` Cancelled family: "Change Owner permissions? The Owner role gates everything. Revoking a permission could lock you out of recovery actions. Confirm with your team first." Primary "Change Owner permission" / Secondary "Cancel".
- **Permission toggle on `risk_level=critical`.** `ConfirmActionModal` Cancelled family: "{Grant|Revoke} {permission display_name}? This is a critical-risk permission. {Granting it expands this role's authority across the admin. | Revoking it may prevent {role display_label} staff from completing existing workflows.}" Primary "{Grant|Revoke}" / Secondary "Cancel".
- **Permission toggle on `risk_level=high` (grant only).** Same modal pattern, slightly softer copy: "Grant {permission}? This is a high-risk permission. Confirm before granting." Revoke high-risk is one-click.
- **Permission toggle pending.** Switch sets `aria-busy="true"`, thumb shows a 12px Field White spinner; row body stays static.
- **Permission toggle success.** Switch lands in the new state; Sonner Confirmed family toast: "{Granted|Revoked} {permission display_name}." Auto-dismiss 4s. Granted-count badge updates.
- **Permission toggle failure.** Switch rolls back to the original state; Sonner Cancelled family toast, no auto-dismiss: "Couldn't change {permission display_name}. {server message}." Ghost "Retry".
- **Metadata save submitting.** Form's Primary `aria-busy="true"`; inline `role="alert"` region appears below the form if server returns an error.
- **Metadata save success.** Sonner Confirmed: "Role saved." Header updates with the new display_label without a full reload (revalidated path).
- **Deactivate role flow.** Confirm modal as above; on confirm, page reloads with the role now `!active`; active chip swaps to Restricted "Inactive". Deactivate button vanishes; in its place a Secondary "Reactivate role" appears (`updateRoleMetadata` with `active=on`).
- **Delete role flow.** Confirm modal; on confirm, redirect to `/admin/roles` with a Sonner Confirmed toast: "Role '{display_label}' deleted."
- **`is_system` lockdown.** Some metadata fields disable per existing logic; the danger-zone "Delete role" button is hidden; inline note "System roles can't be deleted."
- **Empty staff.** Sidebar staff panel renders "No staff assigned." in Soft Slate. No CTA; assigning staff to a role lives on the staff detail surface.
- **Filter active.** Filter chips below the filter strip; "Granted only" toggle separately persisted. Categories with zero matching rows hide their sticky header (no empty groups).

### Backend error states (Layer 3 — for Phase 6 `/impeccable harden`)

| State | What the user sees |
|---|---|
| Delete role: staff assigned between UI render and server execution (race) | `ConfirmActionModal` Primary returns server error; modal stays open; `role="alert"` region above footer: "This role now has staff assigned. Reassign them before deleting." Destructive button disabled; Secondary "Cancel" returns focus to the danger zone |
| Delete role: system role bypass (client sent `is_system=false` but server re-reads as `is_system=true`) | Modal returns server error; `role="alert"`: "System roles can't be deleted." Modal closes; Delete button is hidden from the UI (the server guard caught a client manipulation) |
| Delete role: server-side DB constraint error | Sonner Cancelled toast (no auto-dismiss): "Couldn't delete this role. Try again." Modal closes; Delete button remains visible |

## 7. Interaction Model

- Permission toggle: `<Switch>` wired via the existing `toggleRolePermission` server action (preserved verbatim per RECON §5). Owner-role + high/critical risk paths route through `ConfirmActionModal` before firing.
- Metadata save: form posts to `updateRoleMetadata` server action with named fields preserved (`role_id`, `display_label`, `description`, `sort_order`, `active`, plus hidden `active=on` shadow for system roles per RECON §6.4).
- Deactivate / Reactivate: client wrapper around a `<form action={updateRoleMetadata}>` with `active=off|on` hidden, gated by `ConfirmActionModal` on the deactivate path only (reactivate is one-click, non-destructive).
- Delete: new client action wrapping a `<form action={deleteRole}>` POST (or `deleteRole` server action if RECON §5 extends; flag in §10). Gated by `ConfirmActionModal`. On success, redirects via `revalidatePath('/admin/roles')` + `redirect()`.
- Filter strip: GET form, URL persists deep-link state.
- Sticky category header: pure CSS `position: sticky`; no scroll listener.
- Keyboard: tab traversal through filter strip → permission rows (each row's Switch is the focusable target) → metadata form → staff list links → danger-zone buttons. Switch responds to `Space`.
- "Show more" on description: native `<details>` element.

## 8. Content Requirements

- Page title: "{display_label}" (e.g. "Booking Coordinator").
- Breadcrumb: "← Roles" (linking to `/admin/roles`).
- DB role line: "DB role: {name}" + " · system" (when `is_system`) + " · inactive" (when `!active`).
- Permissions panel title: "Permissions" with badge "{granted} of {total} granted".
- Permission panel footer: "{n} permissions granted on this role." (count-aware singular).
- Filter labels: "Category", "Risk level", "Granted only", "Search".
- Risk chip text: "Low risk" / "Medium risk" / "High risk" / "Critical risk".
- Scope chip text: "scope: {scope}" (mono prefix is intentional; operators recognise it from rbac.ts).
- Metadata form section title: "Role details".
- Metadata form save: Primary "Save role details".
- Metadata form save success: "Role saved."
- Staff sidebar title: "Staff with this role" with count badge.
- Staff empty: "No staff assigned."
- Danger-zone title: "Role lifecycle".
- Deactivate button: "Deactivate role".
- Reactivate button: "Reactivate role".
- Delete button: "Delete role".
- Modal copy as specified in §6.
- System-role note: "System roles can't be deleted."
- Toggle success toast: "{Granted|Revoked} {permission display_name}."
- Toggle failure toast: "Couldn't change {permission display_name}. {server message}."
- Delete success toast: "Role '{display_label}' deleted."
- No raw `manage_role_templates` permission identifier on the denied screen (current `page.tsx:31` leaks it).

## 9. Recommended References

- Brief 20 (`roles`) → letter-token treatment, `AdminAccessDenied` denied-copy, raw-permission leak fix. Identical visual vocabulary.
- Brief 12 (`account-password-requests`) → `ConfirmActionModal` wire-up reference for the destructive flows (Owner-role permission change, high/critical risk toggle, deactivate, delete).
- Brief 19 (`privacy`) → quoted-text-in-Soft-Slate-well grammar (here it's the description in the page header, line-clamp-2 + Show more).
- DESIGN.md §2 → Status Families (risk-level mapping: low→Restricted, medium→Pending, high→Attention, critical→Cancelled).
- DESIGN.md §5 → Switch (will need restyle from shadcn default; currently uses `bg-red-100`-style raw tokens on related surfaces).
- DESIGN.md §Admin-Specific Patterns → Status Communication (confirmation destructive) for the four destructive paths.

## 10. Open Questions

1. **`deleteRole` server action.** RECON §5 lists `updateRoleMetadata`, `togglePermissionForRole`, `createRole` as untouchable; but not `deleteRole`. Either (a) it already exists and RECON missed it; (b) it doesn't exist and Phase 6 adds it as a net-new server action. Need a one-line confirmation from the backend audit. Proposal: assume (b); Phase 6 adds `deleteRole(roleId)` with explicit guards (`!is_system && staff_count === 0`) plus an audit_log write. Flag for confirmation before implementation.
2. **High-risk grant confirmation.** Confirming every high-risk grant adds friction for an Owner who is intentionally configuring a new role. Proposal: keep the confirm on grant only (revoke is safe); critical always confirms. If real-world usage proves this too clicky, lower to critical-only in Phase 7.
3. **Sticky category headers inside a scroll panel.** Works well at desktop heights; on mobile, the panel's `max-h-[70vh]` keeps headers visible but introduces a nested scroll context that can fight the page scroll. Proposal: drop the panel scroll on mobile (no `max-h`) and let categories scroll with the page; sticky behaviour applies on `lg:` and above only.

## 11. Role variants

This page is reachable by **Owner only** (`manage_role_templates` is owner-exclusive per the RBAC seed; RECON §3 confirms). Per recipe instruction "for pages only one role can reach, collapse to that role plus the Denied state."

### Owner

Full surface. All permissions visible and toggleable subject to the confirm modals listed in §6. Metadata form fully editable (subject to existing `is_system` field locks). Staff sidebar populated. Danger zone visible: Deactivate when active, Reactivate when inactive, Delete only when `!is_system && staff_count === 0`.

### Denied state

Admin (Practice Manager), Booking Coordinator, Therapist, and Inactive all hit `AdminAccessDenied`:

- Title: "Roles access limited"
- Body: "Role and permission management is restricted to the practice owner. Ask the owner if you need a permission changed."
- No raw `manage_role_templates` permission identifier on screen (current `page.tsx:31` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

(Identical denied copy to Brief 20 `/admin/roles`; the operator should never see a different message just because the URL deepened.)

---

## Recipe Context

- **RECON §2 inventory row:** Role detail — `src/app/admin/roles/[roleId]/page.tsx` (+ `RoleMetadataForm.tsx`, `PermissionRow.tsx`) — `/admin/roles/<id>` — Edit metadata, toggle individual permissions, see members.
- **Access gate (RECON §3):** `canManageRoleTemplates(profile)` (owner-exclusive). Single-role page. Collapses to Owner + Denied per recipe.
- **Untouchable backend (RECON §5):** `updateRoleMetadata`, `togglePermissionForRole`, `createRole` server actions at `src/app/admin/roles/actions.ts` (explicit DO-NOT-TOUCH). RBAC helpers `canManageRoleTemplates`, `getRoleDisplayName` preserved.
- **Preserved IDs / form names (RECON §6.4):** `RoleMetadataForm` fields `role_id`, `display_label`, `description`, `sort_order`, `active` (with hidden `active=on` shadow when system role). `PermissionRow` calls `toggleRolePermission(roleId, permissionId, permissionName)` server action; signature preserved verbatim. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** None currently. Redesign **adds** GET params `category`, `risk_level`, `granted_only`, `q` for permissions filtering; all additive, no rename.
- **Deep-link patterns preserved (RECON §6.5):** `/admin/roles/<id>` reachable from `/admin/roles` rows; `/admin/staff/<id>` reachable from each staff sidebar entry.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** Sam #1 heading-skip risk noted on the roles list; this page already has a proper H1, but the inline `<h2>` for "Permissions" and "Staff with this role" plus the role display name need to land cleanly under it. Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout, raw `var(--rahma-green)` decorative tile at `page.tsx:91`, `text-white` on tile icon, `bg-white` on staff row at `page.tsx:154`, `bg-red-100`/`text-red-700` inactive chip at `page.tsx:172` → Cancelled/Restricted family, raw permission identifier on `AdminAccessDenied` at `page.tsx:31`.
- **New net-new server action requirement:** `deleteRole(roleId)` per §10 Q1; awaiting backend confirmation in Phase 6.
- **IMAGES-NEEDED additions:** none specific to this page; the role-letter token uses no SVG.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Permission toggle round-trip on all four risk levels: low/medium one-click, high confirms on grant only, critical always confirms; Owner-role-specific confirm fires before risk-level confirm if both apply.
  - Toggle failure rolls back the Switch state and surfaces a Cancelled-family Sonner with Retry.
  - Metadata form save: `updateRoleMetadata` POST contract intact; success revalidates path; header reflects new `display_label` without full reload.
  - Deactivate / Reactivate: chip swap between Confirmed "Active" and Restricted "Inactive"; button label flips correspondingly.
  - Delete role: button visible only when `!is_system && staff_count === 0`; confirm modal renders Cancelled family; success redirects to `/admin/roles` with toast; audit log row written.
  - Filter contract: every combination produces a URL with the documented param names; deep-link survives a reload; empty-category groups hide their sticky header.
  - Sticky category headers: behave as `position: sticky` inside the panel scroll on `lg:`+; on mobile, sticky disables and categories scroll with the page.
  - Heading hierarchy: H1 (role name) → H2 ("Permissions") + H3 ("Role details" / "Staff with this role" / "Role lifecycle") contiguous; screen-reader heading nav traverses cleanly.
  - Role pass: Owner sees full surface; Admin/PM / Coordinator / Therapist / Inactive all hit `AdminAccessDenied` with the new copy.
  - A11y pass: `AdminAccessDenied` no longer renders `manage_role_templates`; Switch responds to Space and announces granted/revoked state; confirm modal traps focus and returns to the trigger Switch on close; mobile `AdminSheet` traps focus.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**`RoleMetadataForm` (preserved from RECON §6.4):**
- `role_id` (hidden).
- `Display label *` (`name="display_label"`). Helper `Shown to staff and on access-denied screens.` Placeholder `e.g. Booking Coordinator`.
- `Description` (`name="description"`, textarea, 3 rows). Placeholder `One or two sentences about what this role does day-to-day.`
- `Sort order` (`name="sort_order"`, number). Helper `Lower numbers appear first in the roles list.`
- `Active` (`name="active"`, checkbox/switch). Helper `Inactive roles can't be assigned to new staff.`
- Hidden `active=on` shadow for system roles (preserved).

**Per-permission row Switch:** `aria-label` reads `{permission display name}: granted` / `{permission display name}: revoked`.

**Filter strip:**
- `Category` (`name="category"`, multi-select). Default `All categories`.
- `Risk level` (`name="risk_level"`, multi-select). Default `All risk levels`. Options: `Low risk`, `Medium risk`, `High risk`, `Critical risk`.
- `Granted only` (`name="granted_only"`, toggle).
- `Search` (`name="q"`). Placeholder `Search permission names or descriptions`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Save metadata | `Save role details` | Primary |
| Filter apply | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filters` (with count) | Ghost |
| Description "Show more" | `Show more` / `Show less` | Ghost |
| Deactivate | `Deactivate role` | Secondary |
| Reactivate | `Reactivate role` | Secondary |
| Delete | `Delete role` | Destructive |
| Confirm modal — owner toggle | `Change Owner permission` | Destructive |
| Confirm modal — critical toggle | `Grant` / `Revoke` (per direction) | Destructive |
| Confirm modal — high-risk grant | `Grant` | Destructive |
| Confirm modal — deactivate | `Deactivate` | Destructive |
| Confirm modal — delete | `Delete role` | Destructive |
| Confirm modal — cancel | `Cancel` | Secondary |
| Breadcrumb back | `← Roles` | Ghost |

### Error messages

- `display_label` empty: `Add a label staff will see.`
- `display_label` over 60 chars: `Trim the label to 60 characters or fewer.`
- `sort_order` non-numeric: `Sort order must be a number.`
- Permission toggle failure (per-row): `Couldn't change {permission}. {server message}` (toast, persistent, Retry)
- Concurrent edit (someone else just toggled): `Someone else just changed this permission. Refresh to see the latest.`
- Owner-role lockout attempt (server-side guard): `That permission can't be revoked from Owner. It would lock everyone out.`
- Deactivate failure: `Couldn't deactivate this role. Try again.`
- Delete failure (has staff — defensive even when guard hides the button): `Reassign the {N} staff on this role before deleting.`
- Delete failure (system role): `System roles can't be deleted.`
- Search query too short: `Type at least 3 characters to search.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Permissions filtered to empty | `No permissions match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Granted-only on, none granted | `No permissions granted yet` | `Toggle on the permissions this role needs to do its job.` | `Show all permissions` |
| Staff sidebar empty | (no heading) | `No staff assigned.` | — |
| Denied (non-Owner) | `Roles access limited` | `Role and permission management is restricted to the practice owner. Ask the owner if you need a permission changed.` | `Back to dashboard` |

### Tooltip text

- System chip: native `title` — `System role. Comes with the clinic; can be edited but not deleted.`
- Active/Inactive chip: native `title` — `Active. Assignable to staff.` / `Inactive. Kept on file, not assignable.`
- DB role mono line: `This identifier appears in code and audit logs`.
- Permission scope chip: native `title` — `scope: {scope}. Applies to {their own data | all records | the same-gender team | …}`.
- Permission risk chip: native `title` — `Low risk` → `Cosmetic or read-only. Safe to grant.` `Medium risk` → `Affects records but reversible.` `High risk` → `Affects records and harder to reverse. Grant deliberately.` `Critical risk` → `Could disrupt access, billing, or compliance. Grant only when you're sure.`
- Permission name mono token: `Appears in audit logs as this identifier`.
- Switch granted state: `aria-label="{permission}: granted"`; visible `title` — `On. This role has this permission.`
- Switch revoked state: `aria-label="{permission}: revoked"`; visible `title` — `Off. This role does not have this permission.`
- Staff row in sidebar: `Open {name}'s profile`.
- Inactive chip on a staff row: native `title` — `Inactive. Sign-in blocked.`
- Granted count footer: native `title` shows the breakdown — `12 of 47 permissions: 5 low risk · 4 medium · 2 high · 1 critical`.
- Delete button (when guard blocks it for system role): `System roles can't be deleted`.
- Delete button (when guard blocks it for has-staff): `Reassign {N} staff first`.

### Confirmation dialog text

**Owner-role permission toggle (any permission)**
- Heading: `Change Owner permissions?`
- Body: `The Owner role gates everything. Revoking a permission could lock you out of recovery actions. Confirm with your team first.`
- Destructive: `Change Owner permission`
- Secondary: `Cancel`

**Critical-risk permission toggle (grant)**
- Heading: `Grant {permission name}?`
- Body: `This is a critical-risk permission. Granting it expands this role's authority across the admin.`
- Destructive: `Grant`
- Secondary: `Cancel`

**Critical-risk permission toggle (revoke)**
- Heading: `Revoke {permission name}?`
- Body: `This is a critical-risk permission. Revoking it may prevent {role display label} staff from completing existing workflows.`
- Destructive: `Revoke`
- Secondary: `Cancel`

**High-risk permission toggle (grant only — revoke is one-click)**
- Heading: `Grant {permission name}?`
- Body: `This is a high-risk permission. Confirm before granting.`
- Destructive: `Grant`
- Secondary: `Cancel`

**Deactivate role**
- Heading: `Deactivate {display_label}?`
- Body: `Staff with this role keep their assignment but won't see admin surfaces until they're moved to an active role.`
- Destructive: `Deactivate`
- Secondary: `Cancel`

**Delete role**
- Heading: `Delete {display_label}?`
- Body: `This can't be undone. The role has no staff assigned, but the audit log keeps a record of every permission it held.`
- Destructive: `Delete role`
- Secondary: `Cancel`

**Toasts**
- Permission grant success: `Granted {permission display name}.`
- Permission revoke success: `Revoked {permission display name}.`
- Metadata save success: `Role saved.`
- Deactivate success: `{display_label} deactivated.`
- Reactivate success: `{display_label} reactivated.`
- Delete success: `Role "{display_label}" deleted.`
- Any failure: persistent Cancelled toast with `Retry` Ghost.
