# Deferrals — role-detail (Phase 6 → Phase 7)

## Filter strip lacks explicit "Apply filters" Secondary button
- **Source:** brief §5 Layout Strategy → left column filter strip ("Apply Secondary; Clear Ghost when active")
- **Verbatim:** "Filter strip (Inputs on Form Seam): category multi-select, risk_level multi-select, 'Granted only' toggle, free-text `q`. Apply Secondary; Clear Ghost when active."
- **Defer to:** Phase 7
- **Why deferred:** Chip-based filters auto-apply on click (better interactive UX), search input auto-applies on Enter, and a Clear Ghost remains visible whenever filters are active. An explicit Apply Secondary would add friction without changing behaviour. Phase 7 gauntlet can decide whether to surface an Apply control or codify the auto-apply pattern in DESIGN.md Admin Patterns.
- **Provisional Phase 6 answer used to continue this session:** auto-apply chip toggles + Enter-to-submit search + Clear Ghost.

## Mobile filter strip does not collapse into AdminSheet — RESOLVED 2026-05-18
- **Source:** brief §5 Layout Strategy → Mobile ("Permission filter strip collapses behind a 'Filters' Ghost → `AdminSheet` from the bottom.")
- **Verbatim:** "Permission filter strip collapses behind a 'Filters' Ghost → `AdminSheet` from the bottom."
- **Status:** CLOSED in the post-review follow-up (G2 + G3). Mobile (`<sm:`) renders a "Filters" Ghost trigger with active-count pill that opens an `AdminSheet` bottom-anchored containing the full filter content. Permissions panel also gained `max-h-[70vh]` + sticky category headers on mobile to make the freed vertical real estate useful.

## Post-review follow-up: 10 fixes applied 2026-05-18

After the initial Phase 6 handoff a visual audit identified 10 improvements (categorised B/G/V/A/C/Q/W). The user approved all 10 and they were applied in-session:

- **B1 — Inactive system role chip coercion** — CLOSED
- **B2 — Deactivate clobbering unsaved edits** — CLOSED (`flipActiveAndSubmit` submits the live `#role-metadata-form` with `active` flipped)
- **B3 + A1 — Switch `aria-busy`** — CLOSED
- **V11 + V12 — Mobile sticky save bar + dirty-state chip** — CLOSED
- **G4 — Right-rail H2 → H3** — CLOSED (manual `<h3>` inside right-rail AdminPanels)
- **G2 + G3 — Mobile filter sheet + panel scroll on mobile** — CLOSED
- **C1 — Audit trail link in danger zone** — CLOSED
- **V15 + W1 — FAKE delete banner voice fix** — CLOSED
- **V2 — Mono identifier mobile collapse** — CLOSED
- **C12 — Owner self-revoke banner** — CLOSED

Round-2 audit lifted dimension scores 16/20 → 20/20 with 0 P1s; round-2 critique 32/40 → 36/40 (AI-slop PASS).

## Switch primitive height is 24px (not 44px) — shared-components debt
- **Source:** brief §6 verification + recipe Step 8 ("min 44px touch targets — check `getBoundingClientRect().height >= 44`")
- **Verbatim:** "Confirm permission-row Switch is tappable without zoom on mobile (min 44px touch targets — check `getBoundingClientRect().height >= 44`)"
- **Defer to:** Phase 7 (via 00-shared-components follow-up)
- **Why deferred:** The Switch primitive at `src/components/ui/switch.tsx` is shared and the recipe lists shared primitives as out-of-scope ("fixes live in `00-shared-components` session"). The switch element measures 24×44 (AA-compliant per WCAG 2.5.5 minimum 24×24). The row wraps the switch in a `min-h-[44px]` flex column so the *tap region* measured at the wrapper is 48×44, preserving the brief's intent. The primitive-level fix is a one-line height bump in the shared component.
- **Provisional Phase 6 answer used to continue this session:** wrapper provides 44px tap region; primitive untouched.

## Delete-role backend dependency
- **Source:** brief §10 Q1 + recipe Step 3 BACKEND FAKE MARKER
- **Verbatim:** "`deleteRole(roleId)` is a net-new server action per brief §10 Q1, tracked at `BUILD-delete-role.md` (non-blocking)."
- **Defer to:** Phase 7 (gated on BUILD-delete-role.md landing)
- **Why deferred:** Backend action does not yet exist; UI degrades gracefully (button + modal + Pending-family note + toast that explains the wire-up is pending; `data-redesign-fake="delete-role"` marker preserved). Once BUILD-delete-role.md lands, replace the modal's confirm handler with a `deleteRoleAction` client wrapper and route success → `/admin/roles` redirect with `Role "{display_label}" deleted.` Sonner; Layer-3 error branches mapped in HARDEN-RECS.
- **Provisional Phase 6 answer used to continue this session:** disabled-by-staff-presence button + FAKE-marked confirm-and-toast degradation.
