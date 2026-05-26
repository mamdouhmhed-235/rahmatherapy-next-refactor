# Per-page deferrals — roles

## Active deferrals (Phase 7 / BUILD wiring / post-launch)

### Cancel button in Create-role AdminSheet does not close the sheet
- **Source:** Step 12a audit P1 / `src/app/admin/roles/CreateRoleSheet.tsx`
- **Verbatim:** "Cancel button in create-role sheet does not close the sheet — no `onClick`/data attribute, no form reset. Breaks brief §6 cancel contract."
- **Defer to:** Phase 7
- **Why deferred:** wiring the close requires either a BaseDialog `Close` render-prop or converting the component to use Dialog state primitives — touching the AdminSheet/BaseDialog seam belongs to the `00-shared-components` follow-up.
- **Provisional Phase 6 answer used to continue this session:** Cancel renders with brief copy and visual treatment; ESC + scrim-click already close the sheet via BaseDialog defaults.

### "Press N" keyboard shortcut advertised but not implemented
- **Source:** Step 12a audit P1 / `src/app/admin/roles/page.tsx` + `src/app/admin/roles/CreateRoleSheet.tsx`
- **Verbatim:** "advertises a keyboard shortcut that no JS handler implements; `aria-keyshortcuts=\"n\"` on the trigger button is decorative-only."
- **Defer to:** Phase 7
- **Why deferred:** Adding a global keydown listener requires a client wrapper for the entire roles page (currently a Server Component). The brief explicitly classes the shortcut as "additional, never the only path" — the trigger button is the primary entry. Phase 7 can either wire the handler or strip the misleading sr-only tip + `aria-keyshortcuts` to keep the affordance truthful.
- **Provisional Phase 6 answer used to continue this session:** trigger button reachable via Tab and visibly available; primary keyboard entry remains the focusable trigger.

### Form-level error region is `sr-only` while submit is FAKE-degraded
- **Source:** Step 12a audit P2 / `src/app/admin/roles/CreateRoleSheet.tsx`
- **Verbatim:** "Form-level error region permanently `className=\"sr-only\"`… even once `createRole` wires up, validation errors will not be visually announced."
- **Defer to:** Phase 7 (or BUILD-create-role.md wire-up, whichever lands first)
- **Why deferred:** Until `createRole` lands, the region cannot fire. The Phase 7 audit will re-scan and require dropping `sr-only` once submit is unblocked.
- **Provisional Phase 6 answer used to continue this session:** ARIA contract is present (`role="alert" aria-live="polite" aria-atomic="true"`); BUSINESS-COMPLETENESS 2A-6 partially contributed.

### Raw `oklch(...)` colour escapes for Hover Moss / Selected Sage / Cancelled text
- **Source:** Step 12a audit P2 / `src/app/admin/roles/page.tsx`; `src/app/admin/roles/CreateRoleSheet.tsx`
- **Verbatim:** "Raw `oklch(...)` colour escapes for hover/letter-token fills bypass the token system (`var(--admin-*)`)."
- **Defer to:** Phase 8 (or `00-shared-components` follow-up — token surface change)
- **Why deferred:** the matching CSS variables (`--admin-surface-hover`, `--admin-surface-selected`, etc.) do not yet exist in `src/styles/tokens.css`. 14 other already-redesigned admin pages use the same inline escapes; lifting them to tokens is a system-wide change, not a single-page fix.
- **Provisional Phase 6 answer used to continue this session:** match the established Phase 6 inline-oklch pattern.

### `<form noValidate>` will need removal once `createRole` lands
- **Source:** Step 12a audit P2 / `src/app/admin/roles/CreateRoleSheet.tsx`
- **Defer to:** BUILD-create-role.md wire-up
- **Why deferred:** intentional: while submit is disabled, `noValidate` silences spurious browser validation tooltips. Remove it the moment the backend lands.

### "Inactive / Suspended" seeded role has `active=true` in the DB
- **Source:** Step 12b critique commentary + 12a audit (data-layer drift)
- **Defer to:** post-launch / DB seed correction
- **Why deferred:** out of Phase 6 scope (data not code). The UI now coerces this row into the inactive `<details>` regardless of `active` flag (see PER-PAGE-SCORES revision pass), but the underlying seed should still be corrected so the truth flows from data, not UI logic.
- **Recommendation:** either set `roles.active = false` on the seeded `Inactive` row, OR have the role-detail page expose Deactivate explicitly.

### AdminAccessDenied icon should be `Lock`, not `ShieldCheck`
- **Source:** User-directed revision pass review (audit visual #10)
- **Verbatim:** "switch the denied state to a Lock icon, distinct from the permission shield, for unmistakable signalling."
- **Defer to:** `00-shared-components` follow-up
- **Why deferred:** `<ShieldCheck>` is hardcoded inside the shared primitive `src/app/admin/components/admin-ui.tsx:899`. Recipe Hard Rule #3 prohibits modifying shared primitives from this session — the fix needs to land in the shared-components session so every denied surface across the admin updates together.

### "Duplicate role" affordance
- **Source:** User-directed revision pass review (missing feature #6)
- **Defer to:** BUILD plan (new server action)
- **Why deferred:** requires authoring a new `duplicateRole` server action. Crosses the Phase 6 ↔ BUILD autonomy boundary (same constraint that put `createRole` into `BUILD-create-role.md`). Out of agent scope for this recipe.

### Capability summary on hover / expand
- **Source:** User-directed revision pass review (improvement #5)
- **Verbatim:** "Show a tiny capability summary on hover/expand. 'Can manage: bookings, staff. Cannot: roles, audit.'"
- **Defer to:** Phase 7
- **Why deferred:** requires fetching the actual permission list per role (currently we fetch `role_permissions(count)` only — the count, not the names) plus a categorisation map. Significant data-layer change that risks breaking the established Supabase query shape used across redesigned admin pages.

---

## Resolved during the 2026-05-17 revision pass

Pre-existing audit findings now closed in this session (see PER-PAGE-SCORES.md "roles — revision pass" section for the implementation summary):

- Active chip noise per row (P3) — chip dropped; only Inactive surfaces inside `<details>`.
- "Inactive / Suspended" Active-chip drift — coerced via `isInactiveSystemRole`.
- Right-rail counts orphan at 1440 (critique) — 3-col grid.
- Letter-token / H2 misalignment — items-center.
- `<details>` chevron-only affordance — explicit "Show / Hide" text added.
- Mobile counts prose-feel — stacked two-line metadata.
- Page summary caption-feel — leading `Users` icon.
- Hover state too loud — border-color change dropped.
- Empty-state missing Create-role CTA — new inline `RolesEmptyState`.
- Focus styling under-spec — `ring-[3px]` + offset.
- System role tooltip — wrapper `<span title="...">`.
- Visual tier hierarchy — Privileged / Operational subheads.
- URL pivot to audit log — `NestedActivityLink` added.

---

(All remaining items tagged for Phase 7 gauntlet re-scan, BUILD wiring, `00-shared-components` follow-up, or post-launch DB seed correction. No P0 found.)
