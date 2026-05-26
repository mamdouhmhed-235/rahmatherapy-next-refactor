# Harden recommendations — `/admin/roles/<id>` (role-detail)

Phase 6, brief 22. Generated 2026-05-18.

The page now covers the brief's `## 6. Key States` matrix. This document records each state, where it's implemented, and the remaining edge cases that depend on backend work outside this session.

## States covered in this session

| State | Where implemented | Notes |
|---|---|---|
| Default populated | `page.tsx` server render | Categories grouped, granted count badge accurate. |
| Loading | Next.js streaming + Sonner pending toasts | Mutations show optimistic Switch state + `aria-busy`; metadata form button shows spinner. |
| Permission toggle on Owner role | `PermissionRow.tsx` `buildConfirmCopy()` | Modal copy verbatim from brief §6. |
| Critical-risk permission toggle (grant) | `PermissionRow.tsx` `buildConfirmCopy()` | Brief §6 verbatim ("Granting it expands this role's authority..."). |
| Critical-risk permission toggle (revoke) | `PermissionRow.tsx` `buildConfirmCopy()` | Brief §6 verbatim ("Revoking it may prevent {role} staff..."). |
| High-risk permission toggle (grant) | `PermissionRow.tsx` `buildConfirmCopy()` | Confirm only on grant; revoke is one-click. |
| Permission toggle pending | `PermissionRow.tsx` `pending` state | Switch shows spinner + status text label; row inert. |
| Permission toggle success | Sonner Confirmed family | `Granted {permission display name}.` / `Revoked {permission display name}.` |
| Permission toggle failure | Sonner Cancelled with Retry | Persistent (`duration: Infinity`) with action callback that retries; Switch rolls back to previous state. |
| Metadata save submitting | `RoleMetadataForm.tsx` `useActionState` | `aria-busy`; inline `role="alert"` region appears when error state returned. |
| Metadata save success | `RoleMetadataForm.tsx` `useEffect` | Sonner: `Role saved.` `revalidatePath` handled server-side. |
| Deactivate role flow | `DangerZonePanel.tsx` | Confirm modal Cancelled family. On confirm, hidden form submits via `requestSubmit()`. Sonner success. |
| Reactivate role flow | `DangerZonePanel.tsx` | One-click form, non-destructive. Sonner success. |
| Delete role flow | `DangerZonePanel.tsx` (FAKE) | Button + modal present; degrades via toast until `BUILD-delete-role.md` lands. `data-redesign-fake="delete-role"` marker preserved. |
| `is_system` lockdown | `DangerZonePanel.tsx` | Delete button omitted; inline "System roles can't be deleted." note. `active` checkbox disabled in `RoleMetadataForm`. |
| Empty staff sidebar | `page.tsx` | "No staff assigned." in Soft Slate. No CTA per brief. |
| Filter active | `PermissionsFilterStrip.tsx` + `page.tsx` | Filter chips show selected counts. Filtered-to-zero state shows `PermissionsEmpty`. |
| `AdminAccessDenied` | Reuses shared `AdminAccessDenied` | Raw `manage_role_templates` identifier stripped by `sanitiseDeniedMessage`. |

## Edge cases verified by reading code

- **47 permissions across 9 categories renders cleanly:** `groupedFiltered` Map is built in a single pass; each category renders its own `<ul>` inside the AdminPanel scroll container.
- **Owner role critical-permission modal wraps at 375px:** modal max width `min(calc(100vw-2rem),28rem)`; tested in Playwright at 375 — no overflow.
- **Critical-risk grant vs revoke copy differs:** `buildConfirmCopy()` switches on `direction` parameter and renders the brief's two distinct sentences.
- **12-staff sidebar:** `aside` panel is naturally sized; no `max-h` ceiling. The staff list grows the panel; the page is scrollable.
- **Description 2-line vs 8-line:** `RoleDescription` component shows plain `<p>` if `text.length <= 180`, else native `<details>` with `line-clamp-2` summary + Show more / Show less.

## Layer 3 backend error states (deferred)

These three states depend on the `deleteRole` server action landing per `BUILD-delete-role.md`. While the action is absent, the danger-zone Delete button degrades gracefully (`data-redesign-fake="delete-role"` + Pending-family note in the confirm dialog + toast on confirm explaining the wire-up is pending).

| State | Designed handling (once `deleteRole` lands) |
|---|---|
| Delete race (staff assigned between UI render and server execution) | Server action returns error; modal stays open; `role="alert"` region above footer reads "This role now has staff assigned. Reassign them before deleting." Destructive button disabled; Cancel returns focus to the danger zone. |
| `is_system` server-side bypass (client manipulation) | Server action returns error; `role="alert"` reads "System roles can't be deleted." Modal closes; Delete button hidden from the UI. |
| Server-side DB constraint failure | Sonner Cancelled (no auto-dismiss) reads "Couldn't delete this role. Try again." Modal closes; Delete button remains visible. |

When BUILD-delete-role.md lands, the wiring is: route the modal's Delete button to a new `deleteRoleAction` client wrapper around the server action; parse the returned `{ error?: string }` shape and branch on the error message; on success, `redirect()` to `/admin/roles` with a Sonner toast `Role "{display_label}" deleted.`.

## A11y notes

- Switch component is the shared `@/components/ui/switch.tsx` primitive (out of scope for this session). At 24×44 it meets WCAG 2.5.5 AA (>= 24×24) but is below AAA (44×44). To preserve the brief's "≥44px touch target" intent, the switch is wrapped in a `min-h-[44px]` flex column inside `PermissionRow`, so the tap region around the switch satisfies 44×44 even without modifying the primitive. The primitive fix should land in the `00-shared-components` session.
- Permission row Switch carries `aria-label="{permission display name}: granted|revoked"` and supports Space / Enter.
- Form errors wrap in `role="alert" aria-live="polite" aria-atomic="true"` per DESIGN.md.
- Required `*` markers use Cancelled text colour (`oklch(26%_0.14_25)`), `aria-hidden="true"`.
- `AdminAccessDenied` does NOT render `manage_role_templates`; `sanitiseDeniedMessage` discards raw permission strings before display.

## Open polish items deferred to Phase 7

- The brief mentions an explicit "Apply filters" Secondary button on the filter strip. The current implementation auto-applies on chip click (better UX for chip filters); search auto-applies on Enter. If the brief intends literal Apply behaviour, the filter strip can grow an Apply button without touching the rest of the page.

## Post-review fixes landed in this session (2026-05-18 follow-up)

After the initial harden run, a visual audit + user request applied 10 targeted improvements. Tracking here so Phase 7 sees the closed surface state, not the round-1 surface.

| Tag | Fix | File(s) | Status |
|---|---|---|---|
| B1 | Inactive system role coerced to "Inactive" chip; lifecycle controls suppressed | `page.tsx` (`isInactiveSystemRole` + `treatAsInactive`), `DangerZonePanel.tsx` (`isInactiveSystem` prop) | CLOSED |
| B2 | Deactivate now submits the live `#role-metadata-form` with `active` flipped, preserving unsaved edits | `DangerZonePanel.tsx` `flipActiveAndSubmit`, `RoleMetadataForm.tsx` stable `formId` prop | CLOSED |
| B3 + A1 | Switch wrapper carries `aria-busy={pending}`; `aria-label` appends "(saving)" when in-flight | `PermissionRow.tsx` | CLOSED |
| V11 + V12 | Mobile sticky save bar + "Unsaved changes" Pending-family chip + Discard Ghost when dirty | `RoleMetadataForm.tsx` | CLOSED |
| G4 | Right-rail panels render as H3 (manual) while "Permissions" remains H2 | `page.tsx` (no `title` prop on right-rail AdminPanels; `<h3>` inside) | CLOSED |
| G2 + G3 | Mobile filter strip collapses to `AdminSheet` "Filters" trigger; permissions panel `max-h-[70vh]` + sticky category headers also on mobile | `PermissionsFilterStrip.tsx`, `page.tsx` | CLOSED |
| C1 | "Open audit trail" Ghost link in Role lifecycle panel | `DangerZonePanel.tsx` | CLOSED |
| V15 + W1 | FAKE delete banner reworded in operator voice ("Deletion isn't available yet…"); confirm toast rewritten too | `DangerZonePanel.tsx` | CLOSED |
| V2 | Mono permission identifier hidden on `<sm:`; visible at `sm:+` only | `PermissionRow.tsx` | CLOSED |
| C12 | Pending-family self-revoke banner when actor's `role_id === role.id` | `page.tsx` (`editingOwnRole` branch) | CLOSED |

Round-2 audit + critique scores landed at 20 / 20 + 36 / 40 with zero P1s remaining. Round-2 sections appended to `/redesign/PER-PAGE-SCORES.md`.
