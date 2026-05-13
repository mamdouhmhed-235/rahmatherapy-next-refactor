# Shape Brief: `/admin/roles` redesign

**Date:** 2026-05-12
**Page slug:** `roles`
**Status:** user-confirmed
**Brief number:** 20 of 29 (Phase 5)

## 1. Feature Summary

Owner-only role library: every role template the clinic uses (the five seeded roles plus any custom), each surfaced with its permission count, staff count, system/custom marker, and active/inactive state. The redesign tightens the current ad-hoc card list into a list-row paradigm matching the rest of the admin, adds a "Create role" entry point, and fixes the H1→H3 heading-skip Sam #1 flagged in BASELINE-CRITIQUE (role names currently render as `<p>`, breaking screen-reader heading nav).

## 2. Primary User Action

**Open the right role to edit its permissions.** The page is a hub, not a workstation; everything destructive (toggle a permission, rename, deactivate, delete) lives on the detail page. Secondary action: create a new role when the team grows into a niche the seed roles don't cover.

## 3. Design Direction

Quiet directory, list-row paradigm. The current `ShieldCheck`-in-a-green-tile + rounded-2xl card with `var(--shadow-soft-token)` reads visually heavy for what is just "five-ish rows that link to detail pages." Replace with `AdminEntityRow`-style rows on `surface-page`, no per-row shadow, no decorative green tile (the avatar slot is wrong for a non-personal entity; replace with a small Restricted-family-tinted role-letter token, or no token at all and rely on the name's typographic weight). The role's name becomes the actual heading (H2 per BASELINE-CRITIQUE Sam #1). Status (active / inactive / system) reads through the named status families, never colour-only.

## 4. Scope

In:
- Replace the unframed list with a single `AdminPanel` containing list-row entries.
- Each row: role display name as H2 (Urbanist 500, title step) + system/active chips + description (Soft Slate, line-clamp-2) + right-rail counts (permissions / staff) + trailing chevron.
- "Create role" Primary in the page header actions slot (calls existing `createRole` server action via a thin `AdminSheet` form on submit; see §7).
- Soft active/inactive grouping: active roles first (in `sort_order`), then a thin divider, then inactive roles below in a collapsed-by-default `<details>` "Inactive roles (N)". Avoids surfacing dormant roles at the top of every visit while keeping them one click away.
- Counts use Lucide icons + numeric label + plain word ("12 permissions" / "3 staff"); the `Users` count is itself a Ghost link to `/admin/staff?roleId=<id>` so the operator can pivot from "who is in this role" without round-tripping the role detail.
- `AdminAccessDenied` updated: plain-English copy, no raw `manage_role_templates` permission identifier (current line 26 leaks it).
- Heading fix: page H1 already correct; role-row name becomes H2 (resolves Sam #1 from BASELINE-CRITIQUE).

Out (unchanged):
- `updateRoleMetadata`, `togglePermissionForRole`, `createRole` server actions and their form contracts (RECON §5 untouchable, §6.4 preserved field names).
- The 5-role seed (Owner / Admin / Coordinator / Therapist / Inactive) and their `is_system=true` flag.
- Permission catalogue. Edits happen on the detail page, not here.
- No bulk operations on roles. Roles are not bulk-managed.
- No drag-to-reorder; `sort_order` is editable on the detail page only.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader`; title "Roles and permissions" / description "What each role can do across the admin." Actions slot: Primary "Create role" → opens `AdminSheet`.
2. **Quick summary line** (Soft Slate, label step, inline under header): "{n} active roles, {m} inactive. {x} staff assigned across all roles." Not a stat-tile row; three numbers in prose, no Cormorant. Roles is a low-volume surface; tiles would dominate.
3. Single full-width `AdminPanel` (no two-column split; a directory of ≤10 rows reads best at full width).
4. Inside the panel:
   - Active roles, stacked, in `sort_order`. Visual rhythm via 16px vertical spacing between rows; 1px `border-subtle` divider between rows.
   - Thin "Inactive" section heading (Work Sans 500 label step, Soft Slate, all-caps) above a collapsed-by-default `<details>` containing inactive roles. The `<summary>` reads "Inactive roles ({n})" with a chevron.

**Row composition (active and inactive identical, except inactive carries the Restricted-family "Inactive" chip):**
- Left, 40px column: small letter token (first letter of `display_label`) on Hover Moss background, Practice Charcoal letter; subtle, not the dominant element. Skipped entirely for the Inactive system role (an envelope-with-x or lock pictogram would be theatre; the chip plus muted typography carries the meaning).
- Centre, flexible column:
  - Top row: H2 role display name (Urbanist 500, title step) + system chip (Restricted family) if `is_system` + Confirmed/Restricted chip ("Active" / "Inactive").
  - Sub-line 1: description (Soft Slate, line-clamp-2, body step); if no description, omitted (not "No description").
  - Sub-line 2: `DB role: {name}` in mono (Soft Slate, label step). This is the operator-actionable identifier when consulting code or audit logs; surface it consistently, never hide it.
- Right rail, fixed:
  - Permissions count: `ShieldCheck` 14px + "{n} permissions" (Soft Slate body step). Not interactive.
  - Staff count: `Users` 14px + "{n} staff" (Soft Slate body step). Ghost link → `/admin/staff?roleId=<id>` if `n > 0`; plain text if `n = 0` (no broken-link path to a guaranteed-empty filter).
  - `ChevronRight` 16px (decorative).
- Whole row is a `<Link>` to `/admin/roles/<id>` (`/admin/staff?roleId=...` is a nested interactive element inside; the row uses click-to-navigate with explicit nested interactive escape on the staff-count link).

**"Create role" `AdminSheet`:**
- Right slide-in on desktop (`AdminSheet` from the right at `lg:`), bottom on mobile.
- Title: "Create role".
- Fields: display label (required), DB role name (lowercase letters + underscores, with helper "Used in code and audit logs. Lowercase letters and underscores only.", required, validated client + server), description (textarea, optional), sort_order (numeric, default = max(sort_order) + 10), active checkbox (default checked).
- Primary "Create role" / Secondary "Cancel". Form posts to `createRole` server action.
- On success: sheet closes, success toast "Role '{display_label}' created. Add permissions next.", redirect to `/admin/roles/<new_id>`.

**Mobile (≤md):**
- Page summary line wraps to two lines.
- Row right-rail collapses: counts move below the description on a separate line ("12 permissions · 3 staff"), with `ChevronRight` pinned right at the row's vertical centre.
- "Create role" Primary becomes full-width below the page summary.

## 6. Key States

- **Default; populated.** 5 active seeded roles + any custom. Inactive section collapsed.
- **Empty (impossible in practice but render-safe).** Page-level `EmptyState`, shield-and-people SVG, "No roles defined. Set up a role to assign staff." with Primary "Create role" that opens the same sheet. (The 5 seeded roles cannot be deleted via the UI; the empty state exists for robustness only.)
- **Loading.** `AdminSkeleton`: page header (instant), summary line (instant), 5 row skeletons in the panel.
- **Create-role sheet open.** Background scrim, focus trapped in sheet, ESC closes, "Create role" Primary disabled while server action pending; primary sets `aria-busy="true"` and shows spinner.
- **Create-role validation error.** Inline `role="alert" aria-live="polite"` region above the form's first invalid field; field border shifts to Cancelled; sheet stays open; the rest of the page stays intact.
- **Create-role failure (server).** Sonner toast, Cancelled family, no auto-dismiss, "Couldn't create role. {server message}." Sheet stays open with the form data intact.
- **Inactive disclosure expanded.** Smooth height transition (no shadow flash), inactive rows render with the Restricted-family "Inactive" chip; the description and counts are otherwise rendered the same as active.
- **Single-role-with-0-staff.** Staff count renders as plain text "0 staff", no link. Permissions count always plain (it's a count, not a navigation target).
- **System role.** Restricted-family "System" chip appears beside the active/inactive chip. Detail page enforces edit restrictions; this page does not preview them.

## 7. Interaction Model

- Row click → `/admin/roles/<id>` (full row link target; the nested `Users` count link uses `event.stopPropagation()` so the click doesn't navigate to the role detail).
- "Create role" → opens `AdminSheet` from right (desktop) / bottom (mobile). Form submits to `createRole` server action with named fields `display_label`, `name`, `description`, `sort_order`, `active`. On 2xx, redirect to the new role's detail page so the operator immediately starts assigning permissions.
- Inactive `<details>` toggle: native; no JS.
- Staff-count link → `/admin/staff?roleId=<id>` (existing deep-link pattern; RECON §6.5 lists `/admin/staff/<id>` as preserved; the `?roleId` filter on the list page is a net-new query param added by the staff brief, but reachable here).
- Keyboard: tab traversal through rows, then the "Inactive" disclosure, then expanded inactive rows. `n` opens the create-role sheet (additional, never the only path; surfaced in screen-reader-only help text).

## 8. Content Requirements

- Page title: "Roles and permissions".
- Page description: "What each role can do across the admin."
- Page summary: "{n} active roles, {m} inactive. {x} staff assigned across all roles." (count-aware; if 0 inactive, summary collapses to "{n} active roles. {x} staff assigned across all roles.").
- "Create role" primary CTA label: "Create role".
- Inactive disclosure summary: "Inactive roles ({n})".
- DB role line prefix: "DB role: {name}" (mono).
- Counts: "{n} permission" / "{n} permissions" (count-aware), "{n} staff" (uncountable noun, no plural switch).
- Create-role sheet helper: "Used in code and audit logs. Lowercase letters and underscores only."
- Success toast: "Role '{display_label}' created. Add permissions next."
- Failure toast: "Couldn't create role. {server message}."
- Empty-state copy as in §6.
- No raw permission identifiers anywhere on the live surface (current `page.tsx:26` leaks `manage_role_templates`).

## 9. Recommended References

- Brief 01 (`00-shared-components`) → `AdminEntityRow`, `AdminSheet`, EmptyState, status family vocabulary.
- Brief 13 (`availability`) → inline-add-form pattern; the create-role sheet follows the same Primary + Secondary footer treatment.
- DESIGN.md §Admin-Specific Patterns → Data Table (44px row height target; this page lives within that paradigm even though it's not a literal table).
- DESIGN.md §5 → AdminPanel, Buttons (Primary for "Create role"), Inputs (sheet form).
- BASELINE-CRITIQUE Sam #1 (heading skip on this page): role name `<p>` → `<h2>` resolves at row-composition time. Sam #3 (active tab `aria-current="page"`) does not apply here (no tabs on this surface).

## 10. Open Questions

1. **Letter-token vs. no token.** A subtle letter token on Hover Moss gives the row a visual anchor; no token relies on typographic hierarchy alone. The latter is cleaner; the former matches the avatar-led grammar used on staff and clients (consistency benefit). Proposal: letter token at 40px, Hover Moss, Practice Charcoal; small enough not to compete, large enough to anchor the eye. Phase 6 verifies in populated screenshots.
2. **"Inactive" as a row chip vs. a row-tinted background.** Restricted-family chip is the safe, named-status-rule-compliant default. A tinted row background would scream "do not edit." Proposal: chip only. Inactive roles are kept around for HR/audit (PRODUCT.md); not destructive. Stick with chip.
3. **Delete-role surface.** Not in scope here (lives on the detail page per existing behaviour), but flag for the next role-detail brief: delete is destructive + irreversible if it cascades to staff records; needs `ConfirmActionModal` wire-up.

## 11. Role variants

This page is reachable by **Owner only** (`manage_role_templates` is owner-exclusive per the RBAC seed and RECON §3 confirms it). Per the recipe instruction "for pages only one role can reach, collapse to that role plus the Denied state."

### Owner

Full surface. All roles visible (active and inactive, system and custom). "Create role" Primary visible. Letter tokens render. Staff-count links render for roles with `staff_count > 0`. Inactive disclosure visible. Each row navigates to `/admin/roles/<id>`.

### Denied state

Admin (Practice Manager), Booking Coordinator, Therapist, and Inactive all hit `AdminAccessDenied`:

- Title: "Roles access limited"
- Body: "Role and permission management is restricted to the practice owner. Ask the owner if you need a permission changed."
- No raw `manage_role_templates` permission identifier on screen (current `page.tsx:26` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

---

## Recipe Context

- **RECON §2 inventory row:** Roles list — `src/app/admin/roles/page.tsx` — `/admin/roles` — All roles with permission + staff counts. Note: role name renders as `<p>`, not `<h2>` (RECON §8 / BASELINE-CRITIQUE Sam #1).
- **Access gate (RECON §3):** `canManageRoleTemplates(profile)` (owner-exclusive). Single-role page. Collapses to Owner + Denied per recipe.
- **Untouchable backend (RECON §5):** `updateRoleMetadata`, `togglePermissionForRole`, `createRole` server actions at `src/app/admin/roles/actions.ts` (explicit DO-NOT-TOUCH). RBAC helpers at `src/lib/auth/rbac.ts` (`canManageRoleTemplates`, `getRoleDisplayName`) preserved.
- **Preserved IDs / form names (RECON §6.4):** Create-role form fields `display_label`, `name`, `description`, `sort_order`, `active`. Role-edit form fields per the detail brief, not this page. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** None currently; redesign adds none. Cross-link to `/admin/staff?roleId=<id>` is a net-new query param introduced by the (forthcoming) staff brief, but reachable from here.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** Sam #1 heading skip (role-row name `<p>` → `<h2>`) resolves here; specifically called out at `/admin/roles` in RECON §8 / line 367. Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout (every line), raw `bg-white` on the row Link at `page.tsx:60`, raw `var(--shadow-soft-token)` on resting rows (violates Tonal Lift Rule; rows should be flat at rest), raw `var(--rahma-green)` decorative tile fill at `page.tsx:69`, raw `text-white` on tile icon, raw permission identifier on `AdminAccessDenied` at `page.tsx:26`.
- **IMAGES-NEEDED additions:** `roles-empty.svg` (shield-and-people, ~80–120px) for the render-safe empty state. Append row in Phase 6.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Heading hierarchy: page H1 followed by role-row H2 at every visible row; screen-reader heading nav (`<h2>` jumps) traverses all active roles, then all expanded inactive roles, in `sort_order`.
  - Active / inactive grouping: inactive `<details>` collapsed by default; expanding does not reflow active rows.
  - Create-role round-trip: `AdminSheet` opens, fields validate (`name` regex enforces lowercase + underscores), submit calls `createRole` with the exact form contract from `actions.ts`, success redirects to `/admin/roles/<new_id>` with a Confirmed-family toast.
  - Validation failure: server returns error → inline `role="alert"` region renders the message; sheet stays open with form intact; focus moves to the first invalid field.
  - Tonal Lift Rule: rows have no shadow at rest; hover applies `card-hover` shadow only when the entire row is interactive.
  - Role pass: Owner sees full surface; Admin/PM / Coordinator / Therapist / Inactive all hit `AdminAccessDenied` with the new copy and no raw permission identifier.
  - A11y pass: `AdminAccessDenied` no longer renders `manage_role_templates`; staff-count link inside the row link is keyboard-accessible without firing the outer row click; `<details>` disclosure keyboard-operable; sheet traps focus and returns focus to the "Create role" trigger on close.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**Create-role `AdminSheet` (`createRole` server action):**
- `Display label *` (`name="display_label"`). Placeholder `e.g. Senior Therapist`. Helper `Shown to staff and on access-denied screens.`
- `DB role name *` (`name="name"`). Placeholder `senior_therapist`. Helper `Used in code and audit logs. Lowercase letters and underscores only.`
- `Description` (`name="description"`, textarea, 3 rows). Placeholder `What does this role do day-to-day?`
- `Sort order` (`name="sort_order"`, number). Helper `Lower numbers appear first in the list.`
- `Active` (`name="active"`, checkbox, default checked). Helper `Inactive roles can't be assigned to new staff.`

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Header CTA | `Create role` | Primary |
| Inactive disclosure trigger | `Inactive roles ({N})` (chevron) | Ghost |
| Per-row staff count link (when N>0) | `{N} staff` (`Users` icon) | Ghost |
| Sheet submit | `Create role` | Primary |
| Sheet cancel | `Cancel` | Secondary |
| Empty-state CTA (render-safe) | `Create role` | Primary |
| Denied CTA | `Back to dashboard` | Secondary |

### Error messages

- `display_label` empty: `Add a label staff will see.`
- `display_label` over 60 chars: `Trim the label to 60 characters or fewer.`
- `name` empty: `Add a DB role name.`
- `name` invalid format (uppercase, spaces, dashes, etc.): `DB role names use lowercase letters and underscores only. For example: senior_therapist.`
- `name` duplicate: `A role with that DB name already exists. Pick a different one.`
- `sort_order` non-numeric: `Sort order must be a number.`
- Server failure: `Couldn't create role. Try again.` (toast, persistent)
- List load failure: `Couldn't load roles. Try refreshing.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Render-safe empty (impossible with seed) | `No roles defined` | `Set up a role to assign staff.` | `Create role` |
| Inactive section, zero inactive | (section hidden entirely) | — | — |
| Denied | `Roles access limited` | `Role and permission management is restricted to the practice owner. Ask the owner if you need a permission changed.` | `Back to dashboard` |

### Tooltip text

- Letter token: native `title` shows the full role name.
- System chip: `System role. Comes with the clinic; can be edited but not deleted.`
- Active chip: `Active. Assignable to staff.`
- Inactive chip: `Inactive. Kept on file, not assignable.`
- Permissions count: `{N} permissions granted on this role`.
- Staff count link (N>0): `Open the staff list filtered to this role`.
- Staff count plain text (N=0): `No staff on this role yet`.
- DB role mono line: `This identifier appears in code and audit logs`.
- Inactive disclosure trigger: `Show inactive roles` / `Hide inactive roles`.
- "Create role" Primary: `Add a new role with custom permissions`.

### Confirmation dialog text

This page mutates nothing destructive (create is non-destructive; the audit log is the safety net). No `ConfirmActionModal` instances on the list view. Deactivate / Delete live on the detail page (Brief 23).

**Toasts**
- Create success: `Role "{display_label}" created. Add permissions next.`
- Create failure: `Couldn't create role. Try again.` (persistent, Retry)
- Filter applied (if any added later): no toast — list refresh is the feedback.
