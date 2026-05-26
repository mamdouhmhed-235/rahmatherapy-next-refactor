# Deferrals — staff-detail

(no Phase 6 blocker deferrals — recipe closed cleanly; the three audit P1 findings below are tagged for Phase 7 gauntlet, not Phase-6 holdouts)

## P1s tagged for Phase 7 `/impeccable audit admin` (current as of rev 2)

- **Rail panels render as H2 instead of brief-specified H3** — `src/app/admin/components/admin-ui.tsx:293` flows to `src/app/admin/staff/[staffId]/page.tsx` panels at :720, :758, :785, :811, :841, :848. Defer to: Phase 7. Why deferred: `AdminPanel` is a shared primitive; introducing an `as` prop or H3 variant is a shared-component change that touches every page using `AdminPanel`.
- **Prev/next sibling-staff query has no `active`/scope filter** — `src/app/admin/staff/[staffId]/page.tsx:307-310`. Defer to: Phase 7. Why deferred: needs either inline scope-aware filtering mirroring the existing `getStaffTeamSelect` helper or a small new helper; both deserve a separate review focused on cross-page navigation patterns.
- **Cmd+S keyboard shortcut silent no-op on clean form** — `src/app/admin/staff/[staffId]/StaffDetailShortcuts.tsx:49-57`. Defer to: Phase 7. Why deferred: needs an `aria-live` announcement region or a Sonner toast on clean-form save attempts; small but touches the global hotkey UX pattern.

## Resolved between rev 1 and rev 2

- **Avatar tile single hardcoded Confirmed-family tint** — resolved. `hueFromId()` (page.tsx:102-108) implements `hash(staff.id) % 360` per Brief 00 §4.
- **Mono `role.name` slug visible under role display** — resolved. Hidden into `title` tooltip on R1 (page.tsx:740) and R4 (page.tsx:817).
- **Past-assignments `<details>` `border-dashed`** — resolved. Solid 1px `--admin-border` + `--admin-panel-muted/60` tonal lift (page.tsx:635-636).
- **Role chips vs Gender chips two different "selected" treatments** — resolved. Both use solid Clinic Green fill on active.
- **No Discard changes affordance when dirty** — resolved. Discard button renders inline (sm+) and in sticky mobile bar (`StaffProfileForm.tsx:368-410`) when `isDirty`.
- **Tablet (768) panel order with empty Audit** — partially resolved. Audit history collapses to an inline single-line pill when empty (page.tsx:664-677); rail still reflows under the pill but the surface is much smaller.

## §10 Q4 (brief Open Question — still deferred)

- **"What clients see on the public site" framing label above the read-only `dl`** — brief §10 Q4 marked "Phase 6 polish: yes". Defer to: Phase 7. Why deferred: §10 is Open Questions; the proposal was tentative; AND the rev-2 polish-pass removed all references to the (non-existent) public staff route. This deferral is tracked alongside the brief↔codebase mismatch flag below.

## Brief↔codebase mismatch flag (new in rev 2)

- The brief references a public `/staff/<slug>` surface in form-helper copy and §10 Q4, but the codebase has no public staff route (`src/app/(public)/` contains about, services, faqs-aftercare, home, reviews, services/[slug]; no `/staff/`). Rev-2 polish removed phantom cross-links and reframed helper copy to be neutral. Phase 7 should decide: is the public staff profile surface in scope, or should the `show_phone_on_profile` toggle label, `short_bio` placeholder copy, and §10 Q4 framing proposal be retired entirely?

## Critique-surfaced (non-blocking, current as of rev 2)

- **Inline per-field validation copy** (brief §11 Error messages — "Add their full name.", "Phone number is too short. Include the area code.", "Trim the bio to 600 characters or fewer.") not surfaced inline. Defer to: Phase 7.
- **R2 vs R3 panel rhythm** — Profile completion and Onboarding remain visually sibling-shaped at 1440. Defer to: Phase 7. Options: collapse R3 to a single line when ≥4/6 done, or merge into a single "Profile health" panel with a sub-tab.
- **R5 sub-line for novices** — "Overrides sit on top of the fixed role bundle" assumes the operator knows what "the role bundle" is. Defer to: Phase 7.

## Recipe / brief / RECON conflicts

- none — brief and codebase aligned where mandatory; the public-route mismatch (above) is informational, not blocking.
