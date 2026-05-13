# Phase 0 — Accessibility Baseline (Admin)

This is the score the redesign must beat. Every claim below combines static JSX inspection with a live DOM probe (Playwright `evaluate` against `localhost:3000`, logged in as Owner). Where the live DB had no rows for a detail page, the live result is marked "deferred — needs seed data".

**Methodology**
- Static: Read each `page.tsx` and the components it imports; counted `<img>/<Image>/<input>/<textarea>/<select>/<h1..h6>/<label htmlFor>/aria-label/aria-labelledby` and noted obvious red flags.
- Live: Ran on each page —
  - `document.querySelectorAll('h1,h2,…')` → heading sequence.
  - `Array.from(inputs).filter(i => !i.labels?.length && !aria-label && !aria-labelledby)` → unlabelled inputs by `name`.
  - `document.querySelectorAll('button')` filtered for empty text + no `aria-label` → unnamed icon-only buttons.
- Live tests/contrast/keyboard-trap not yet exercised by axe or by manual tab — flagged for Phase 7.

**Global findings (apply across all admin pages)**
- Admin layout's `AdminTopNav` is **good**: provides skip-link `<a href="#admin-main">`, `<main id="admin-main" tabIndex={-1}>`, mobile drawer with `aria-label="Open admin navigation"`, `aria-haspopup`/`aria-expanded` on the user menu, `aria-current="page"` on active mobile menu items, and `aria-label` on icon-only chrome buttons (Search, Settings).
- Common implicit-label pattern across admin forms: a wrapper `<label>…<Input/select/textarea …/></label>` (single labelable descendant). Live probe confirms `i.labels?.length > 0` for these — the pattern is sound.
- **`<table>` elements: zero in admin** (cards/grids only). "Table without caption" is N/A.
- **Color-only conveyance: not seen** in source — every status indicator pairs tone with an `AdminStatusBadge` text value. (Tab links in `staff/[id]` are an exception — see below.)
- **`role="alert"` / `aria-live` regions on form errors: missing globally** — every form-level error `<p>` is silent for assistive tech.
- **Required-field visible markers: missing globally** — `required` is set on inputs without an accompanying "*" or "(required)" label hint.

---

## Per-page baseline

### `/admin/login`
- File(s): `login/page.tsx`, `LoginForm.tsx`.
- Images: 0 raw img/Image; one inline decorative `<svg aria-hidden="true">`. **OK.**
- Inputs (live, total visible): 2 — both labelled (`<label htmlFor>` pair). **0 unlabelled.**
- Headings (live): `H1: Rahma Therapy`, `H2: Sign in to your account`. **OK.**
- Other red flags: `required` on email/password without visible marker; form-error region not `role="alert"`.

### `/admin` (redirect)
- N/A — server `redirect("/admin/dashboard")`.

### `/admin/dashboard`
- File(s): `dashboard/page.tsx`, `dashboard-header.tsx`, `dashboard-cards.tsx`, `dashboard-filters-client.tsx`, `TherapistDashboard.tsx`.
- Images: 0 (one CSS `repeating-linear-gradient` decorative bg in `dashboard-cards.tsx`).
- Inputs (live): 0 visible filter inputs at root (filters live in a sheet/popover). When the filter sheet opens we expect 5 (range/from/to/city/service/staffId/source/status/paymentStatus) — already implicit-labelled per static pass.
- Headings (live): `H1: Dashboard`, `H2: Today at a glance`, `H2: Urgent attention`, `H2: Staff Capacity`, `H2: Payment Health`, `H2: Operational health`, `H2: Business pulse` (+ empty-state H2s nested). Single H1, clean H2 hierarchy. **OK.**
- Other red flags: `NotificationBell` and `MobileNotificationButton` are icon-only — their labels not yet verified live (no console errors, but should re-check during Phase 7). The therapist variant H1 is mutually exclusive with `DashboardHeader`'s H1.

### `/admin/bookings`
- Files: `bookings/page.tsx` (filter form, list cards).
- Images: 0.
- Inputs (live, with empty filter UI collapsed): 0 surfaced. With filters expanded: 9 (search, from, to, status, assignment, payment, gender, location, service, +assigned_staff for admins). All wrapped in `FilterInput`/`FilterSelect` implicit-label pattern (static pass).
- Headings (live, empty DB): `H1: Bookings`. With rows: H2 per `BookingListCard`. **OK.**
- Other red flags: external Maps deep-link `<a target="_blank">` should have `rel="noopener noreferrer"` — needs live verification on a populated row. `BookingActionButton` / `CopyButton` accessibility names — verify Phase 7.

### `/admin/bookings/new`
- Files: `bookings/new/page.tsx`, `ManualBookingForm.tsx`.
- Images: 0.
- Inputs (live): **27 visible**, **0 unlabelled**.
- Headings (live): `H1: Create admin booking`, `H2: Contact and source`, `H2: Services and participants`, `H3: Participant 1`, `H2: Location and time`, `H2: Notes and confirmation`. Clean H1 → H2 → H3.
- Other red flags: `consent_acknowledged` is a `required` checkbox — visible state is the box itself only, no required marker text. Form-error `<p>` not announced.

### `/admin/bookings/[bookingId]`
- Files: `bookings/[bookingId]/page.tsx`, `BookingManagementForm.tsx`, `AssignmentManager.tsx`, `ClaimAssignmentButton.tsx`, `BookingActionButton.tsx`, `CopyButton.tsx`.
- Images: 0.
- Inputs (live, populated): **9 visible**, **0 unlabelled** in `BookingManagementForm`.
- Headings (live, populated): `H1: Phase10 E2E Claim Client`, then H2s `Lifecycle & Payment`, `Participants & Assignments` (with H3 `Phase10 Claim Participant`), `Service Snapshots`, `Safety & Consent` (with H3s `Consent`, `Health notes`), `Notes` (with H3s `Customer notes`, `Customer manage notes`, `Treatment notes`, `Admin notes`), `Customer Requests` (with H3s `Cancellation`, `Reschedule request`), `Activity Timeline`, `Email Delivery`, `Booking Summary`, `Booking Contact`, `Home Visit`. **Clean H1 → H2 → H3 hierarchy.**
- Other red flags: 0 icon-only buttons missing labels at runtime. Page does **not** expose a back-link to `/admin/clients/<id>` even though the booking is linked to a client — flagged for Phase 5 (UX consideration, not a11y blocker).

### `/admin/calendar`
- Files: `calendar/page.tsx`.
- Images: 0.
- Inputs (live): 4 — view, date, staffId, paymentStatus. All labelled.
- Headings (live): `H1: Calendar`, `H2: Unassigned appointments`. **OK.**
- Other red flags: `PrintButton` accessible name — verify Phase 7.

### `/admin/clients`
- Files: `clients/page.tsx`.
- Images: 0.
- Inputs (live): **5 visible, 1 unlabelled** — `INPUT[name="location" type=text placeholder="Postcode or city"]`.
- Headings (live): `H1: Clients`, `H2: No clients found`. **OK.**
- **Issue (live-confirmed):** `name="location"` has no associated `<label>`, no `aria-label`, no `aria-labelledby` — only a placeholder. Search input `q` (statically flagged) was found *labelled* at runtime — the wrapping `<label>` is doing its job there.

### `/admin/clients/new`
- Files: `clients/new/page.tsx`, `ClientCreateForm.tsx`.
- Images: 0.
- Inputs (live): **8 visible**, **0 unlabelled**.
- Headings (live): `H1: Create client`, `H2: Client details`. **OK.**
- Other red flags: required fields lack visible markers; form-error not `role="alert"`.

### `/admin/clients/[clientId]`
- Files: `clients/[clientId]/page.tsx`, `ClientDetailForms.tsx`.
- Images: 0.
- Inputs (live, populated): **3 visible**, **0 unlabelled** (note + privacy-request forms).
- Headings (live, populated): `H1: Phase10 E2E Claim Client`, `H2: Contact`, `H2: Client Summary`, `H2: Health and safety context`, `H2: Client Notes`, `H2: Privacy workflow`, `H2: Recent audit activity`, `H2: Booking History`, `H3: Upcoming bookings`, `H3: Past bookings`. **Clean H1 → H2 → H3.** Static prediction confirmed.
- Other red flags: 0 icon-only buttons missing labels. Form-error regions still not `role="alert"` (consistent with global finding A4).

### `/admin/enquiries`
- Files: `enquiries/page.tsx`, `EnquiryForm.tsx`, `EnquiryStatusButton.tsx`.
- Images: 0.
- Inputs (live): **7 visible**, **0 unlabelled**.
- Headings (live): `H1: Enquiries`, `H2: Record enquiry`, `H2: No enquiries yet`. **OK.**
- Other red flags: `EnquiryStatusButton` accessible name — verify Phase 7 once enquiries exist.

### `/admin/emails`
- Files: `emails/page.tsx`.
- Images: 0.
- Inputs (live): **0 visible** (no candidate bookings); per-row reminder forms have one hidden input each.
- Headings (live): `H1: Email status`, `H2: Manual reminder`, `H2: Delivery events`. **OK.**

### `/admin/operations`
- Files: `operations/page.tsx`.
- Images: 0.
- Inputs (live): 0 (no events to display).
- Headings (live): `H1: Operational errors`. **OK.**
- Other red flags: per-event Acknowledge/Resolve buttons have visible text — fine.

### `/admin/audit`
- Files: `audit/page.tsx`.
- Images: 0.
- Inputs: 0.
- Headings (live): `H1: Audit log`. **OK.**

### `/admin/privacy`
- Files: `privacy/page.tsx`, `PrivacyStatusForm.tsx`.
- Images: 0.
- Inputs (live): 0 visible (no requests).
- Headings (live): `H1: Privacy Operations` (assumed; only H1 present in empty state). **OK.**

### `/admin/reports`
- Files: `reports/page.tsx`, `RevenueChart`, `CountBarChart`.
- Images: 0.
- Inputs (live): **6 visible**, **0 unlabelled** — range/from/to/staffId/source/paymentStatus.
- Headings (live): `H1: Reports`, `H2: Revenue by period`, `H2: Bookings by status`, `H2: Service performance`, `H2: Staff workload`, `H2: Staff revenue attribution`, `H2: CSV exports`, `H2: Source/channel report`, `H2: Metric definitions`. **OK.**
- Other red flags: charts have a `label` prop ("Bookings by status chart" / "Bookings by source chart") — verify it materialises as `aria-label` on the SVG live (Phase 7). **Console warnings**: 6 Recharts width/height warnings when data is empty (cosmetic, see RECON §8).

### `/admin/services`
- Files: `services/page.tsx`, `ServiceFormDialog.tsx`, `DeleteServiceButton.tsx`.
- Images: 0.
- Inputs (live, list view): 0; ~12 inputs in `ServiceFormDialog` modal, presumed implicit-labelled.
- Headings (live): `H1: Services & Packages`, `H2: Supreme Combo Package`, `H2: Hijama Package`, `H2: Fire Package`, `H2: 30-Min Massage Therapy`, `H2: 1-Hour Massage Therapy`. **OK.**
- Other red flags: `ServiceFormDialog` open trigger and `DeleteServiceButton` icon-only state — verify Phase 7.

### `/admin/settings`
- Files: `settings/page.tsx`, `SettingsForm.tsx`.
- Images: 0.
- Inputs (live): **9 visible**, **0 unlabelled**.
- Headings (live): `H1: Settings`, `H3: Business Rules`, `H3: Contact details`, `H3: Booking availability`, `H3: Cancellation cutoff`, `H3: Service areas`, `H3: Payment expectations and email readiness`. **❌ Heading skip — H1 → H3 with no H2.** Caused by shadcn `CardTitle` rendering as `<h3>`.
- Other red flags: form-error not announced.

### `/admin/availability`
- Files: `availability/page.tsx`, `AvailabilityRulesManager.tsx`, `BlockedDatesManager.tsx`, `AvailabilityOverridesManager.tsx`.
- Images: 0.
- Inputs (live): **10 visible**, **0 unlabelled**.
- Headings (live): `H1: Availability`, `H2: Weekly capacity preview`, `H3: Global Working Hours`, `H3: Blocked Dates`, `H3: Date Overrides`. **❌ Skip — the three sub-section H3s sit beside (after) the single H2 instead of nested under it.** Caused by shadcn `CardTitle = h3`.

### `/admin/staff`
- Files: `staff/page.tsx`, `NewStaffForm.tsx`.
- Images: 0 (decorative `<User>` lucide).
- Inputs (live, list view): 0; `NewStaffForm` modal has 4 (`name`, `email`, `role_id`, `gender`) — labelled with explicit `htmlFor` (per static grep).
- Headings (live): `H1: Staff Management`, then **`H3` per staff card** (`Rahma Therapy`, `Test Admin`, `Test Booking Coordinator`, `Test Inactive`, `Test Therapist`). **❌ Heading skip — H1 → H3.**

### `/admin/staff/[staffId]`
- Files: `staff/[staffId]/page.tsx`, `StaffProfileForm.tsx`, `StaffPermissionOverridesForm.tsx`.
- Images: 0.
- Inputs (live): **7 visible**, **0 unlabelled**.
- Headings (live): `H1: Rahma Therapy` (banner), then **`H3: Profile Details`, `H3: Account Status & Access`, `H3: Role & Identification`** (these come from `StaffProfileForm`'s shadcn `CardTitle`s) **→ then `H2: Profile completion`, `H2: Onboarding checklist`, `H2: Role permissions`, `H2: Individual permission overrides`, `H2: Assigned bookings and workload`, `H2: Audit history`** (from `AdminPanel`).
- **❌ Heading-order issue (live-confirmed):** H3s appear *before* H2s in document order — out-of-order levels. Symptom of mixing shadcn `CardTitle` (h3) and `AdminPanel` (h2). Static finding now confirmed.

### `/admin/staff/[staffId]/availability`
- Files: `staff/[staffId]/availability/page.tsx`, `AvailabilityModeSelector.tsx`, `StaffAvailabilityRulesForm.tsx`.
- Images: 0.
- Inputs (live): 3 in the rule form, presumed labelled (explicit `htmlFor`).
- Headings (live): `H1: <staff name>`. **OK** for the page itself.
- Other red flags: tab-style `<Link>`s ("Profile Settings", "Availability") — **no `aria-current="page"`**; active state signalled by `border-[var(--rahma-green)]` only (color/border, no programmatic state).

### `/admin/roles`
- Files: `roles/page.tsx`.
- Images: 0.
- Inputs: 0.
- Headings (live): `H1: Roles & Permissions`. **❌** Each role's name is a `<p className="font-semibold">`, not `<h2>` — screen-reader heading-nav cannot jump between roles. Confirmed live.

### `/admin/roles/[roleId]`
- Files: `roles/[roleId]/page.tsx`, `RoleMetadataForm.tsx`, `PermissionRow.tsx`.
- Images: 0.
- Inputs (live): The page has many permission toggles (one toggle per permission) each likely with `aria-label`; verified the page renders without errors.
- Headings (live): `H1: Owner / Main Admin`, `H2: Permissions`, `H2: Role details`, `H2: Staff with this role`. **OK.**
- Other red flags: staff list within "Staff with this role" uses `<p>` for member names (no h3) — same pattern as the roles list page; not a major issue at this depth.

---

## Summary table

| Page | Images Total / Labelled | Inputs Total / Labelled (live) | Heading hierarchy | Other red flags |
|---|---|---|---|---|
| `/admin/login` | 0 / 0 | 2 / 2 | OK (H1, H2) | required no marker; no role=alert |
| `/admin` | n/a | n/a | n/a (redirect) | — |
| `/admin/dashboard` | 0 (1 decorative bg) | 0 visible (filters in sheet) | OK (H1 + multiple H2s) | NotificationBell label — verify P7 |
| `/admin/bookings` | 0 | 0 visible (empty DB) / 9 in filter | OK | external Maps link rel; icon buttons |
| `/admin/bookings/new` | 0 | 27 / 27 | OK (H1→H2→H3) | required marker, error region |
| `/admin/bookings/[id]` | 0 | 9 / 9 | OK (H1 + many H2/H3) | no client back-link |
| `/admin/calendar` | 0 | 4 / 4 | OK | PrintButton label — verify P7 |
| `/admin/clients` | 0 | 5 / 4 | OK | **`location` input unlabelled (live)** |
| `/admin/clients/new` | 0 | 8 / 8 | OK | required marker, error region |
| `/admin/clients/[id]` | 0 | 3 / 3 | OK (H1, 7×H2, 2×H3) | error region not announced |
| `/admin/enquiries` | 0 | 7 / 7 | OK | EnquiryStatusButton — verify P7 |
| `/admin/emails` | 0 | 0 visible | OK | — |
| `/admin/operations` | 0 | 0 visible | OK (only H1 in empty state) | — |
| `/admin/audit` | 0 | 0 | OK (only H1) | — |
| `/admin/privacy` | 0 | 0 visible | OK | — |
| `/admin/reports` | 0 | 6 / 6 | OK | charts: 6 Recharts warnings; verify aria-label |
| `/admin/services` | 0 | 0 visible (modal has 12) | OK | dialog/delete icon labels |
| `/admin/settings` | 0 | 9 / 9 | **❌ H1 → H3** | shadcn CardTitle = h3 |
| `/admin/availability` | 0 | 10 / 10 | **❌ H2 + sibling H3s** | shadcn CardTitle = h3 |
| `/admin/staff` | 0 | 0 / 0 (list); 4 in modal | **❌ H1 → H3 per card** | — |
| `/admin/staff/[id]` | 0 | 7 / 7 | **❌ out-of-order H3 then H2** | mixing CardTitle + AdminPanel |
| `/admin/staff/[id]/availability` | 0 | 3 (rule form) | OK | tabs missing aria-current=page |
| `/admin/roles` | 0 | 0 | **❌ role names are `<p>` not h2** | — |
| `/admin/roles/[id]` | 0 | many toggles | OK (H1, three H2s) | members list also uses `<p>` |

---

## Findings to fix during the redesign (concrete, verifiable)

| # | Finding | Page(s) | Fix direction |
|---|---|---|---|
| A1 | Heading skips H2 (H1 → H3) | `/admin/settings`, `/admin/staff`, `/admin/availability`, `/admin/staff/[id]` (out-of-order) | Either render section group titles as `<h2>` directly, or add an `as` prop to shadcn `CardTitle` so it can downgrade/upgrade. Inside `AdminPanel` already-h2 sections, nest CardTitle as h3. |
| A2 | Role names rendered as `<p>` | `/admin/roles`, role-detail "Staff with this role" | Render as `<h2>` (roles list) and `<h3>` (role detail nested) so heading nav works. |
| A3 | Unlabelled filter input | `/admin/clients` `name="location"` | Add wrapping `<label>` (visible "Location" text or `sr-only`). |
| A4 | Form errors not announced | every form (`LoginForm`, `ClientCreateForm`, `EnquiryForm`, `ManualBookingForm`, `SettingsForm`, `AvailabilityRulesManager`, `BookingManagementForm`, `BlockedDatesManager`, `AvailabilityOverridesManager`) | Wrap top-level form errors in `<div role="alert" aria-live="polite">`. |
| A5 | Required fields lack visible markers | every form with `required` | Add visible "*" or "(required)" suffix to label. |
| A6 | Color-only active state on tab `<Link>`s | `/admin/staff/[id]`, `/admin/staff/[id]/availability` | Add `aria-current="page"` to the active tab (driven by `usePathname`). |
| A7 | shadcn `CardTitle` always emits `<h3>` (root cause of A1) | `src/components/ui/card.tsx` | Provide an `as` / `level` prop — defaults `<h3>` but can render `<h2>` etc. (Same pattern as Radix's `Slot`-based primitives.) |
| A8 | Recharts width/height warnings on empty data | `/admin/reports` | Set `minHeight` (e.g. 288) on `ResponsiveContainer`s in `RevenueChart` / `CountBarChart`. |

---

## Items deferred to live re-pass

After Pass-2 seeding (`pnpm test:e2e:setup`), the only items that remain genuinely deferred are runtime-behaviour checks that require manual interaction or specialised tooling.

- `/admin/services` modal flow — `ServiceFormDialog` open/close focus trap, focus return on close (manual interaction).
- `/admin/emails` populated state with a real future-dated, pending-payment booking — manual reminder per-row submit buttons (Pass-2 booking is 14 days out and pending, so should appear; spot-check during Phase 7).
- `/admin/operations` populated state — DB has no operational events to render the per-row Acknowledge/Resolve buttons; create one event during Phase 2 visual baseline.
- Real keyboard tab-order pass on the mobile drawer + cmd-K palette + dialogs (focus trap correctness) — manual.
- Axe / WAVE automated scan per page (post-Phase-2 visual baseline).
- Color-contrast spot-check via Chrome DevTools rendering panel (after redesign tokens settle).
- Role-shape passes: log in as therapist / coordinator / inactive (and `phase10.therapist.a@example.test` etc.) to capture role-variant heading and label trees — Phase 7 scope.
