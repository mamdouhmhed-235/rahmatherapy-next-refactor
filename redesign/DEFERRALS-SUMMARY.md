# Phase 6 deferrals summary

Generated 2026-05-19 at end-of-Phase-6. Aggregates the 24 `<slug>-deferrals.md` files in `per-page-deferrals/` into a single Phase 7 entry-point reference.

## Counts at a glance

- Pages with deferrals (real entries): 22
- Pages clean (sentinel "no deferrals"): 2 (`reports`, `password-reset`)
- Pages with no deferrals file (early-merged, pre-deferral protocol): 5 (`00-shared-components`, `login`, `bookings`, `booking-new`, `booking-detail`)
- Total deferred items (approximate, counting bundled sub-bullets as one): ~130
- Defer-to breakdown (target phase, where stated):
  - Phase 7 (gauntlet `/impeccable audit admin`): the dominant target — ~100 items
  - Phase 8 (extract / token consolidation): ~6 items
  - BUILD plan (gated on a named `BUILD-*.md` landing): ~10 items
  - post-launch / N/A / seed-data / lucide upgrade: ~8 items
  - `00-shared-components` follow-up (shared primitives): ~12 items (most also tagged Phase 7)

## Per-page table

| Page slug | Deferrals | Defer-to (counts) | Status |
|---|---|---|---|
| 00-shared-components | — | — | no file (early-merged, pre-protocol) |
| login | — | — | no file (early-merged, pre-protocol) |
| bookings | — | — | no file (early-merged, pre-protocol) |
| booking-new | — | — | no file (early-merged, pre-protocol) |
| booking-detail | — | — | no file (early-merged, pre-protocol) |
| account-password-requests | 3 | Phase 7 ×3 (1 gated on BUILD-rbac-permission-account-password-requests.md) | OK |
| audit | 9 | Phase 7 ×8, Phase 8 ×1 | OK |
| availability | 1 (P2/P3 carry-forward block) | Phase 7 ×1 | OK (5 P1/P2 resolved in corrective dispatch) |
| calendar | 4 | Phase 7 ×4 | OK |
| client-detail | 9 | Phase 7 ×9 | OK |
| client-new | 5 | Phase 7 ×5 | OK |
| clients | 3 | Phase 7 ×2, N/A ×1 (browser-extension hydration) | OK |
| dashboard-coordinator | ~18 (1 active P1 + 17 cross-variant carry-forwards) | Phase 7 ×17, Phase 4 token-rename ×1 | OK |
| dashboard-owner-admin | 7 | Phase 7 ×4, post-launch/shell ×1, i18n/future ×3 | OK (+7 explicit brief-shape deviations, intentional, not bugs) |
| dashboard-therapist | 6 | Phase 7 ×6 (3 blocked on `dashboard-data.ts` extension) | OK |
| email-templates | 4 | Phase 7 ×3, BUILD plan ×1 | OK |
| emails | 8 | Phase 7 ×8 (some gated on BUILD-email-delivery-filter-query.md) | OK |
| enquiries | 2 | Phase 7 ×1, Phase 7/backend ×1 | OK |
| operations | 8 | Phase 7 ×6, post-launch (BUILD-operations-filter-query.md) ×2 | OK |
| password-reset | 0 | — | clean (sentinel) |
| privacy | 3 | Phase 7 ×3 | OK |
| reports | 0 | — | clean (sentinel) |
| role-detail | 3 | Phase 7 ×2, BUILD-delete-role.md ×1 | OK (10 visual-review fixes already landed) |
| roles | 9 | Phase 7 ×5, Phase 8 ×1, BUILD plan ×2, post-launch (seed) ×1 | OK |
| services | 2 | Phase 7 / 00-shared-components ×2 | OK |
| settings | 5 | Phase 7 ×3, Phase 8 ×1, post-launch (LAUNCH-SHEET) ×1 | OK |
| staff | 6 | Phase 7 ×6 (2 blocked on `getStaffTeamSelect` extension) | OK |
| staff-availability | 9 | Phase 7 ×9 (1 blocked on staff_profiles schema migration) | OK |
| staff-detail | 8 | Phase 7 ×7, brief↔codebase ×1 (public /staff route) | OK |

## Top themes

### Theme 1: Shared-primitives debt (00-shared-components follow-up)
Pages involved: services, role-detail, roles, staff-detail, client-detail, calendar, dashboard-owner-admin, staff-availability, role-detail, client-new.
Summary: The largest cross-page theme. Many per-page agents could not fix issues because the fix lives inside a shared primitive on the "Files to NEVER touch" list — `AdminPanel` H2/H3 step, `AdminActionMenu` 36px touch target, `AdminAccessDenied` ShieldCheck-vs-Lock icon, `AdminEntityRow` title typography, `AdminErrorBoundary` `role="alert"`, `ConfirmActionModal` controlled-open API (blocks `email-templates` `window.confirm` → modal swap), `AdminSheet` not yet extracted (blocks every "mobile filter strip" deferral), `Switch` primitive 24px height, `AdminMobileActionBar` not yet wired across pages.
Phase 7 handling: Open a single 00-shared-components follow-up session that batches the primitive-level edits and re-flows fixes across every page that uses each component.

### Theme 2: Data-layer extensions blocked by RECON §5 untouchables
Pages involved: dashboard-therapist (3), staff (2), staff-availability (1), email-templates (1), emails (1), operations (2), staff-detail (1), privacy (2), enquiries (1), clients (1).
Summary: Many deferrals are blocked because the additive prop or query they need lives in `dashboard-data.ts`, `team-access.ts`, `actions.ts`, or another helper marked untouchable. Examples: `required_gender` and customer-notes on `nextAppointment` (dashboard-therapist); `auth.users.last_sign_in_at` and `raw_user_meta_data.avatar_url` projections (staff); `staff_profiles.avatar_url` column missing entirely (staff-availability); stale-booking guard return contract (emails); concurrent-edit revision check + permission-revoked error reason (privacy); template→delivery aggregation (email-templates); `phone XOR email` `.refine()` (enquiries); admin/PM scope event_type filter (operations).
Phase 7 handling: Either lift specific helpers off the untouchable list for Phase 7, or pair each deferral with the relevant `BUILD-*.md` plan and resolve when the BUILD lands.

### Theme 3: Inline `oklch(...)` literals vs token consolidation
Pages involved: audit, operations, calendar, client-detail, clients, client-new, roles, role-detail, reports, settings, staff-availability, dashboard-owner-admin.
Summary: At least 12 pages flag the same pattern — status-family colours (Cancelled, Restricted, Attention, Hover-Moss, Selected-Sage) are written as raw `oklch(...)` literals matching the canonical DESIGN.md values, but the corresponding CSS variables (`--admin-status-cancelled-bg`, `--admin-surface-hover`, etc.) don't yet exist in `tokens.css`. Every page-level deferral notes this is a system-wide concern, not a page lapse.
Phase 7 / Phase 8 handling: Single global token-extraction sweep in Phase 8 (`/impeccable extract admin`) — adds the missing CSS variables, then swaps inline literals across all pages in one pass. Settings and audit both explicitly call this out as the right venue.

### Theme 4: Mobile filter strip → `AdminSheet` bottom sheet
Pages involved: enquiries, operations, staff, clients (RESOLVED in visual-review), role-detail (RESOLVED in post-review), audit.
Summary: Five pages defer the same fix — the brief specifies a "Filters" Ghost trigger that opens an `AdminSheet` from the bottom on mobile, but most pages shipped a native inline `<details>` disclosure because `AdminSheet` either didn't exist yet or wasn't extracted to the shared primitives. Clients and role-detail later landed it; the others remain inline.
Phase 7 handling: Bundle with the 00-shared-components follow-up — once `AdminSheet` is canonical, sweep the remaining pages in a single visual-consistency pass.

### Theme 5: `aria-current` / `aria-pressed` and a11y carry-forwards
Pages involved: calendar (P2), dashboard-therapist (date-range chips), clients (RESOLVED), audit (`aria-live` on copy button), roles (`aria-keyshortcuts` decorative), staff-availability (alertdialog).
Summary: Repeated a11y polish items — segmented-control / GET-link active state correctness, decorative aria attributes that imply non-existent behaviour, missing `role="alert"` regions, copy-button live regions that double-announce with toast.
Phase 7 handling: Single a11y sweep in `/impeccable audit admin` — standardises the GET-link active-state pattern across pages and audits every `aria-*` attribute for truthfulness.

### Theme 6: BUILD-plan-gated FAKE backends
Pages involved: role-detail (BUILD-delete-role.md), operations (BUILD-operations-filter-query.md), emails (BUILD-email-delivery-filter-query.md), email-templates (BUILD-email-templates-actions.md), account-password-requests (BUILD-approve-reject-password-reset.md + BUILD-rbac-permission-account-password-requests.md), password-reset (BUILD-password-reset-request-actions.md + BUILD-password-reset-email-templates.md), roles (BUILD-create-role.md `noValidate` removal + sr-only error region), client-new (postcode lookup).
Summary: ~10 deferrals are explicitly gated on a named `BUILD-*.md` plan landing. UI degrades gracefully in each case (FAKE markers, disabled controls, generic error toasts) but Phase 7 / launch needs to walk these in lockstep with the BUILD ladder.
Phase 7 handling: Maintain a Phase 7 BUILD-pairings matrix — each BUILD plan landing triggers a per-page revisit to remove FAKE markers, swap toast copy to brief-verbatim, and re-enable disabled controls.

### Theme 7: EmptyState illustration commissioning
Pages involved: audit, staff, availability, dashboard, emails (named explicitly), and the broader cross-page note that Lucide line-icons read "SaaS-default" vs DESIGN.md §5 illustrated-empty-state spec.
Summary: Several agents flagged that `EmptyState` currently renders Lucide glyphs in tinted tiles as a placeholder; DESIGN.md commits to bespoke illustrations. `IMAGES-NEEDED.md` rows were appended where applicable.
Phase 7 handling: Either accept Lucide-as-canonical (DESIGN.md amendment) or commission the illustration set in a single batch.

### Theme 8: AdminMobileActionBar wire-ups
Pages involved: clients (RESOLVED with overflow popover workaround), email-templates, staff-availability (I9), dashboard-coordinator (mobile chrome carry-forward).
Summary: The brief's mobile "tap row → action bar slides up" pattern requires client-side row-selection state that several Server Component pages don't carry. Mostly workaround-resolved (overflow popover, inline buttons) but the canonical pattern is unlanded.
Phase 7 handling: Decide whether the action-bar pattern is worth the client-state cost or whether the popover/inline pattern becomes canonical.

### Theme 9: ConfirmActionModal as a confirm-flow primitive
Pages involved: email-templates (window.confirm fallback), staff-availability (working-day checkbox), roles (Cancel close), client-new (no-contact dialog landed natively).
Summary: `ConfirmActionModal` accepts a trigger element but doesn't expose a programmatic / controlled-open API. Several pages need that mode (form-driven discard, destructive-shortcut confirmation) and fell back to `window.confirm` or native `<dialog>`.
Phase 7 handling: Bundle with the 00-shared-components follow-up — extend `ConfirmActionModal` with a controlled-open API, then swap fallbacks across affected pages.

---

(All entries are recorded verbatim in the per-page files under `redesign/per-page-deferrals/`. Phase 7 gauntlet should read this summary first for cross-page grouping, then walk each per-page file for the verbatim sources and provisional Phase 6 answers.)
