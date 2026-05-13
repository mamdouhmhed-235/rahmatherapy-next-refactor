# Phase 0 — Reconnaissance (Admin Redesign)

Reconnaissance pass for the Rahma Therapy admin/CMS surface. Read-only — no files were changed.

URL used for live checks: **http://localhost:3000** (Next.js dev server already running).
Logged in as: `rahmatherapy@outlook.com` (Owner / Main Admin).
Database state during recon: **two passes**.
- **Pass 1 — empty:** test owner only, no bookings / clients / enquiries / privacy requests / operational events. All 21 reachable routes screenshotted.
- **Pass 2 — seeded:** ran `pnpm test:e2e:setup` (script `scripts/seed-e2e-staff.mjs`, marker `phase10_e2e`) which created 6 phase10 staff + 1 client + 1 booking with assignment + 1 enquiry + 1 privacy request. Detail pages and populated list/dashboard pages re-screenshotted. Cleanup: `pnpm test:e2e:cleanup` removes everything markered `phase10_e2e`. The seeded data is currently still in the DB so Phase 2 can compare empty-vs-populated baselines.

Screenshot file naming: `NN-route.png` for empty-state pass (Pass 1), `NNb-route-populated.png` for seeded pass (Pass 2). `22-booking-detail.png` and `23-client-detail.png` exist only as Pass-2 captures (no Pass-1 equivalent).

---

## 1. Tech Stack Summary

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router) |
| UI runtime | React 19 + React Server Components by default |
| Language | TypeScript (strict) |
| Styling | **Tailwind CSS v4** (`@theme` CSS-first), CSS variables / design tokens (`src/styles/tokens.css`), legacy Webflow parity layer (`src/styles/site-parity.css`) — both still imported |
| Component library | **shadcn/ui** ("new-york" style, baseColor "neutral") — only 12 primitives present, all customised; dialog uses `@base-ui/react` (NOT Radix) |
| Motion | Framer Motion 12 |
| Icons | lucide-react |
| Forms | React Hook Form 7 + Zod 4 (public flows); admin forms are mostly **plain HTML + Server Actions**, no RHF |
| Client state | Zustand 5 |
| Server state | TanStack Query 5 (set up but used sparingly in admin; admin is mostly Server Components) |
| Backend platform | **Supabase** (Postgres + Auth + Storage) |
| Auth | Supabase Auth (cookies via `@supabase/ssr`); middleware in `src/middleware.ts` |
| Email | Resend |
| Errors | Sentry (`@sentry/nextjs`, three configs) |
| Analytics | **None** — confirmed by zero matches for `gtag/track/mixpanel/posthog/umami/plausible/dataLayer/analytics.*` across the entire repo |
| Audit trail | `audit_logs` table — every admin mutation writes a row (see §6) |
| Deployment | Cloudflare via `@opennextjs/cloudflare` |
| Package manager | pnpm 10, Node 24 |

**Entry points:**
- `src/app/layout.tsx` — root layout (loads fonts + `site-parity.css` + `globals.css`).
- `src/app/admin/layout.tsx` — admin shell (auth gate + variant resolver + `AdminTopNav`).
- `src/middleware.ts` — Supabase session refresh / route protection.
- `next.config.ts` — `trailingSlash: true` (note: every admin route is reached at `…/`).
- `wrangler.jsonc` + `open-next.config.ts` — Cloudflare adapter.
- `sentry.{client,server,edge}.config.ts` — error monitoring.

---

## 2. Admin Pages Inventory

24 routes under `src/app/admin/` plus 2 route handlers (signout POST, reports CSV export). Roles in the system are configurable, but the seed/spec uses: **Owner / Admin (Practice Manager) / Booking Coordinator / Therapist / Inactive**. Permission gates resolve via `src/lib/auth/admin-access.ts → getAdminPageAccess(profile, pageKey)` and helpers in `src/lib/auth/rbac.ts`.

**Post-Phase-0 amendment (2026-05-11):** `password-reset` and `account-password-requests` are NEW pages (not present in original codebase). Added to inventory after Phase 0 following a Phase-5 Supabase schema audit that revealed the `account_password_requests` table (migration `phase9_account_password_requests`, 2026-05-09) exists in production with a pending row and zero application-code references. No baseline audit/critique scores exist for these two pages — Phase 6 will build them as greenfield. Blast radius at time of amendment: **0** for both — no other admin file imports from them yet; once built, they will pick up the same shared dependencies (`AdminAccessDenied`, `admin-ui.tsx`, `AdminTopNav`, `AdminLayout`) every other admin page transits.

| Page | File | Route | Purpose | Roles / Permission gate | Key UI elements |
|---|---|---|---|---|---|
| Index redirect | `src/app/admin/page.tsx` | `/admin` | Hard `redirect("/admin/dashboard")`. | Open (target page enforces). | None. |
| Login | `src/app/admin/login/page.tsx` (+ `LoginForm.tsx`) | `/admin/login` | Email/password sign-in; surfaces `?reason=inactive`. | Public. | Brand mark + h1, h2, email + password fields, submit button, footer copy. |
| **Password reset** *(NET-NEW, post-Phase-0)* | `src/app/admin/password-reset/page.tsx` *(not yet implemented; token landing route `password-reset/[token]/page.tsx` and paired server actions to be added in Phase 6)* | `/admin/password-reset` (plus `/admin/password-reset/[token]` for the set-new-password landing after approval) | Staff-facing forgot-password flow. Submits an encrypted request into `account_password_requests`; surfaces request-submitted confirmation, pending-review status, approved-with-token reset form, rejected and expired states. Closes the Supabase schema gap discovered in Phase 5: the `account_password_requests` table has existed since migration `phase9_account_password_requests` (2026-05-09) with zero application code. | Public (pre-authentication) — similar gate to `/admin/login`. | Forgot-password email form, request-submitted confirmation card, pending-review status check, approved-with-token (set-new-password) form with password + confirm-password fields, rejected state with reviewer note display, expired state with re-request affordance. Derived from `redesign/BRIEF-COMMANDS.md` brief #11 and the live DB schema. |
| Dashboard | `src/app/admin/dashboard/page.tsx` | `/admin/dashboard?range=&from=&to=&staffId=&service=&source=&status=&paymentStatus=&city=` | Role-shaped command centre — three variants (business / coordinator / therapist). | `getAdminPageAccess("dashboard")` ≠ none — anyone with any of the dashboard-feeding scopes. | `DashboardHeader`, filter bar, `TodayAtAGlanceCard`, `UrgentAttentionPanel`, `StaffCapacityCard`, `PaymentHealthCard` (revenue-gated), `OperationsHealthCard`, `BusinessPulseCard`, `NotificationBell`, `TherapistDashboard` variant. |
| Audit log | `src/app/admin/audit/page.tsx` | `/admin/audit` | Read-only top-100 audit events with sensitive-key redaction. | `manage_audit_logs` (Owner). | `AdminPanel` of event cards with badges + key-summary `<dl>`. |
| **Account password requests** *(NET-NEW, post-Phase-0)* | `src/app/admin/account-password-requests/page.tsx` *(not yet implemented; paired `actions.ts` for approve/reject server actions to be added in Phase 6)* | `/admin/account-password-requests` | Owner / Admin review queue for pending records in `account_password_requests`. Approve (which triggers a Supabase Auth admin-API password reset), reject with reviewer note, or let expire. Every state transition writes to `audit_logs` and the corresponding `reviewed_by` / `reviewed_at` / `reviewer_note` columns. Currently 1 row sits pending in production with no UI to act on it. | New permission `manage_account_password_requests` (Owner + Admin / Practice Manager). Booking Coordinator and Therapist denied. | Request list with status filter (pending / approved / rejected / expired), per-row approve and reject actions wrapped in `ConfirmActionModal` per DESIGN.md destructive-action pattern, reviewer-note field on reject (required) and approve (optional), audit-link per request, empty state when no pending requests. Derived from `redesign/BRIEF-COMMANDS.md` brief #13 and the live DB schema. |
| Availability (global) | `src/app/admin/availability/page.tsx` | `/admin/availability` | Working hours, blocked dates, overrides; per-staff capacity preview. | `manage_availability_global` (Owner / Admin). | Capacity preview, weekly grid, `AvailabilityRulesManager`, `BlockedDatesManager`, `AvailabilityOverridesManager`. |
| Bookings list | `src/app/admin/bookings/page.tsx` | `/admin/bookings?view=&search=&status=&assignment_status=&payment_status=&required_gender=&service=&location=&assigned_staff=&from=&to=` | Triage queue — needs-attention, today, upcoming, claimable, etc. | `canManageBookings` (`manage_bookings_all` OR `manage_bookings_assigned`). Therapists see narrower view set. | View tabs, GET filter form, `BookingListCard` rows, quick-action buttons, **Google Maps deep-link** per booking. |
| Booking detail | `src/app/admin/bookings/[bookingId]/page.tsx` | `/admin/bookings/<id>` | Single booking — status, participants, assignments, notes, audit timeline, email status, payment summary, address. | Scoped: full / assigned / claimable. | `BookingManagementForm` (admin), `ParticipantBreakdown` + `AssignmentManager`/`ClaimAssignmentButton`, `ActivityTimeline`, `EmailDeliveryStatus`, side cards (summary, client, address). |
| Booking new | `src/app/admin/bookings/new/page.tsx` (+ `ManualBookingForm.tsx`) | `/admin/bookings/new?clientId=&enquiryId=` | Manual phone/WhatsApp/walk-in/repeat booking, optionally seeded from an enquiry. | `manage_bookings_all`. | Multi-section form: contact + source, services + participants, location + time, notes + confirmation. |
| Calendar | `src/app/admin/calendar/page.tsx` | `/admin/calendar?view=day\|week&date=&staffId=&paymentStatus=` | Day/week agenda (Europe/London), printable, with unassigned sidebar. | bookingScope ≠ none. | GET filter bar, per-date `AdminPanel` rows of `CalendarBooking` cards, "Unassigned" sidebar, `PrintButton`. |
| Clients list | `src/app/admin/clients/page.tsx` | `/admin/clients?q=&lifecycle=&payment=&location=&source=` | CRM directory with rollups, repeat status, source attribution. | clients scope ≠ none. | `AdminFilterBar` (q/lifecycle/payment/location/source), `ClientCard` link tiles. |
| Client detail | `src/app/admin/clients/[clientId]/page.tsx` (+ `ClientDetailForms.tsx`) | `/admin/clients/<id>` | Profile + booking history + notes + privacy + audit. | Multiple scopes feed visible columns. | Side: contact, stats, optional health, notes (+ create form), privacy (+ request form), audit. Main: upcoming + past bookings. |
| Client new | `src/app/admin/clients/new/page.tsx` (+ `ClientCreateForm.tsx`) | `/admin/clients/new` | Create profile without booking; flags duplicates. | `manage_clients_all`. | Single form, duplicate-confirm checkbox surfaces conditionally. |
| Emails | `src/app/admin/emails/page.tsx` | `/admin/emails` | Resend delivery events + manual reminder queue. | `view_email_logs` OR `resend_booking_emails`. | Two-column: manual reminder list (one form per booking), delivery events list. |
| Enquiries | `src/app/admin/enquiries/page.tsx` (+ `EnquiryForm.tsx`, `EnquiryStatusButton.tsx`) | `/admin/enquiries` | Lead pipeline: phone/WhatsApp/IG/referral/website. | `manage_enquiries`. | Two-column: intake form, list of enquiries with contacted/closed buttons + Convert link. |
| Operations | `src/app/admin/operations/page.tsx` | `/admin/operations` | Safe-context production support events; ack/resolve. | `manage_settings` OR `manage_email_settings`. | `AdminPanel` event articles with Ack/Resolve forms. |
| Privacy | `src/app/admin/privacy/page.tsx` (+ `PrivacyStatusForm.tsx`) | `/admin/privacy` | GDPR triage + sensitive-note review. | `manage_privacy_operations` OR `manage_sensitive_client_notes`. | Two-column: privacy requests with status forms, sensitive notes review. |
| Reports | `src/app/admin/reports/page.tsx` | `/admin/reports?range=&from=&to=&staffId=&source=&paymentStatus=` | Bookings, repeat clients, revenue, services, staff workload, source/channel; 8 CSV exports. | `view_reports_*` family. Revenue rows + Export-CSV gated by `view_reports_revenue`. | Filter form, 4 `AdminStat`s, `RevenueChart`, `CountBarChart`s, panels for service / staff / staff-revenue, 8 CSV export `<Link>`s, metric definitions. |
| Roles list | `src/app/admin/roles/page.tsx` | `/admin/roles` | All roles with permission + staff counts. | `manage_role_templates` (Owner). | Role cards with ShieldCheck tile (note: role name renders as `<p>`, not `<h2>`). |
| Role detail | `src/app/admin/roles/[roleId]/page.tsx` (+ `RoleMetadataForm.tsx`, `PermissionRow.tsx`) | `/admin/roles/<id>` | Edit metadata, toggle individual permissions, see members. | `manage_role_templates`. | Banner header, two-column: per-permission `PermissionRow` toggles; metadata form + members list. |
| Services | `src/app/admin/services/page.tsx` (+ `ServiceFormDialog.tsx`, `DeleteServiceButton.tsx`) | `/admin/services` | Treatment catalog (price, duration, gender restriction, visibility). | `manage_services`. | Service cards 2-col grid, modal create+edit dialog, delete button with confirm. |
| Settings | `src/app/admin/settings/page.tsx` (+ `SettingsForm.tsx`) | `/admin/settings` | Booking window, buffers, notice, cancellation cutoff, allowed cities, intake on/off. | `manage_settings` (Owner). | Single grouped form (5 sections); shadcn `CardTitle` renders as **`<h3>` — heading skip from h1**. |
| Staff list | `src/app/admin/staff/page.tsx` (+ `NewStaffForm.tsx`) | `/admin/staff` | Team directory; admins see all, coordinators see assignment pool, therapists see same-gender team + self. | `getStaffTeamAccess` ≠ none. | 3-col grid of staff cards (name renders as **`<h3>` — skips h2**), `NewStaffForm` modal. |
| Staff detail | `src/app/admin/staff/[staffId]/page.tsx` (+ `StaffProfileForm.tsx`, `StaffPermissionOverridesForm.tsx`) | `/admin/staff/<id>` | Profile editor + permission overrides + workload + audit. | Self-edit OR `manage_staff_profiles` / `assign_staff_roles` / `manage_permission_overrides`. | Banner with Profile/Availability tabs, profile form, completion + onboarding panels, role permissions wall, override form, recent assignments, audit. (`StaffProfileForm` itself uses h3 group titles inside an h2-titled panel.) |
| Staff availability | `src/app/admin/staff/[staffId]/availability/page.tsx` (+ `AvailabilityModeSelector.tsx`, `StaffAvailabilityRulesForm.tsx`) | `/admin/staff/<id>/availability` | Mode selector (use_global / custom) + per-day rule editor. | `manage_availability_global` OR (own + `manage_availability_own`). | Profile/Availability tab nav (no `aria-current="page"`), mode buttons, per-day rule rows. |

**Forms — every input `name` per page** (server-action names; hidden ID fields included):

- `/admin/login`: `email`, `password`.
- `/admin/dashboard` (filter form, GET): `range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`.
- `/admin/bookings` (filter form, GET): `view`, `search`, `from`, `to`, `status`, `assignment_status`, `payment_status`, `required_gender`, `location`, `service`, `assigned_staff` (admins only).
- `/admin/bookings/new`: `enquiry_id` (hidden), `booking_source`, `full_name`, `email`, `phone`, `booking_for`, `service_slugs[]`, `number_of_people`, `booking_date`, `start_time`, `address`, `postcode`, `city`, `area`, `access_notes`, `parking_notes`, `customer_notes`, `health_notes`, `consent_acknowledged`, `send_confirmation_email`.
- `/admin/bookings/[bookingId]` (`BookingManagementForm`): `booking_id` (hidden), `status`, `payment_status`, `payment_method`, `amount_paid`, `payment_note`, `treatment_notes`, `admin_notes`, `customer_manage_notes`. Plus discrete server actions (claim/assign/quick action) without form fields beyond hidden IDs.
- `/admin/calendar` (filter form, GET): `view`, `date`, `staffId`, `paymentStatus`.
- `/admin/clients` (filter form, GET): `q`, `lifecycle`, `payment`, `location`, `source`.
- `/admin/clients/new`: `confirm_duplicate` (conditional), `full_name`, `client_source`, `email`, `phone`, `address`, `postcode`, `source_detail`, `notes`.
- `/admin/clients/[clientId]`: `ClientNoteForm` → `client_id` (hidden), `note`. `ClientPrivacyRequestForm` → `client_id` (hidden), `request_type`, `request_note`.
- `/admin/availability`:
  - rules → `rule_id` (hidden), `day_of_week`, `start_time`, `end_time`, `is_working_day`.
  - blocked → `blocked_date`, `reason`.
  - overrides → `override_date`, `start_time`, `end_time`, `reason`.
- `/admin/services` (`ServiceFormDialog`): `name`, `slug`, `group_category`, `gender_restrictions`, `price`, `duration_mins`, `display_order`, `is_active`, `is_visible_on_frontend`, `short_description`, `full_description`, `suitable_for_notes`.
- `/admin/settings`: `company_name`, `contact_phone`, `contact_email`, `booking_window_days`, `minimum_notice_hours`, `buffer_time_mins`, `customer_cancellation_cutoff_hours`, `allowed_cities`, `booking_status_enabled`.
- `/admin/staff` (`NewStaffForm`): `name`, `email`, `role_id`, `gender`.
- `/admin/staff/[staffId]` (`StaffProfileForm`): `name`, `phone`, `show_phone_on_profile`, `short_bio`, `specialties`, `languages`, `service_areas`, plus admin-only `role_id`, `gender`, `active`, `can_take_bookings`, `availability_mode`, `profile_photo_path`.
- `/admin/staff/[staffId]/availability` (`StaffAvailabilityRulesForm`): per row `day_of_week`, `start_time`, `end_time`, `is_working_day`.
- `/admin/roles/[roleId]` (`RoleMetadataForm`): `role_id` (hidden), `display_label`, `description`, `sort_order`, `active` (with hidden `active=on` shadow when system role).
- `/admin/enquiries` (`EnquiryForm`): `full_name`, `source`, `phone`, `email`, `service_interest`, `assigned_staff_id`, `notes`.
- `/admin/emails` (per-row reminder): `booking_id` (hidden).
- `/admin/operations` (per-row): `event_id` (hidden), `status` (hidden).
- `/admin/privacy` (`PrivacyStatusForm`): `request_id` (hidden), `status`.

Detailed per-page UI inventory (tables/cards/charts/empty-states) lives in each agent's narrative — see this document's section list for the high-level summary; all subsections cross-reference the per-page detail captured above.

---

## 3. Customer-Facing Pages — DO NOT TOUCH

These remain out of scope for the admin redesign:

- `src/app/(public)/page.tsx` — root marketing landing
- `src/app/(public)/home/page.tsx`
- `src/app/(public)/about/page.tsx`
- `src/app/(public)/services/page.tsx`
- `src/app/(public)/services/[slug]/page.tsx` — package detail pages
- `src/app/(public)/faqs-aftercare/page.tsx`
- `src/app/(public)/reviews/page.tsx`
- `src/app/(public)/layout.tsx` — public shell (header/footer/booking trigger)
- `src/app/booking/manage/page.tsx` — customer self-service booking management
- `src/components/{home,about,services,faqs-aftercare,reviews,package-pages,sections,webflow}/**` — customer-section presentation components
- `src/components/layout/**` (`SiteHeader`, `SiteFooter`, `Logo`, `BookingTrigger`, etc.) — public shell only; **no admin file imports any of these**
- `src/features/booking/**` — booking modal and customer flow

---

## 4. Shared Components & Blast Radius

There is **no** `src/components/admin/` folder. All admin-specific shared components live under `src/app/admin/components/`. The site-wide `src/components/{layout,shared,sections}/` trees are marketing-only.

| Component | File | Used by | Blast radius |
|---|---|---|---|
| `AdminLayout` (the shell) | `src/app/admin/layout.tsx` | every authenticated `/admin/*` route | **24 / 24** |
| `AdminTopNav` | `src/app/admin/components/AdminTopNav.tsx` | rendered by layout for all routes; takes role-aware `variant` + `pageAccess` | **24 / 24** |
| `AdminCommandSearch` (⌘K) | `src/app/admin/components/AdminCommandSearch.tsx` | embedded in TopNav | **24 / 24** indirect |
| `AdminAccessDenied` | `src/app/admin/components/admin-ui.tsx` | every admin page.tsx except `admin/page.tsx` (redirect) and `admin/login/page.tsx` | **22 / 24** direct |
| `admin-ui.tsx` (the file as a whole — 1020 lines, 30+ exports: `AdminPageHeader`, `AdminPanel`, `AdminFilterBar`, `AdminPageScaffold`, `AdminStat`, `AdminMetricGrid`, `AdminStatusBadge`, `AdminEmptyState`, `AdminDescriptionList`, `AdminEntityRow/Card`, `AdminProgressBar`, `AdminStackedBar`, `AdminMiniTrend`, `AdminHealthTile`, `AdminAttentionRail`, `AdminLoadingState`, `AdminSkeleton`, `AdminHiddenDataState`, `AdminMobileActionBar`, `AdminToolbar`, `AdminButton`, `AdminActionGroup`, `AdminDashboardPanel`, `AdminPanelHeader`, `AdminIconBadge`, `AdminSectionHeader`, `AdminDetailSection`, `AdminSegmentedControl`, `AdminResponsiveGrid`, `AdminSeverityMeter`) | `src/app/admin/components/admin-ui.tsx` | transitively reached by all 24 pages via `AdminAccessDenied` | **24 / 24** |
| `AdminPageHeader` | admin-ui.tsx | `audit`, `calendar`, `clients/new`, `clients`, `emails`, `enquiries`, `operations`, `privacy`, `reports` | 9 |
| `AdminPanel` | admin-ui.tsx | `audit`, `calendar`, `clients/[id]`, `emails`, `operations`, `privacy`, `reports`, `staff/[id]` | 8 direct, all via `AdminAccessDenied` |
| `AdminFilterBar` | admin-ui.tsx | `calendar`, `clients`, `reports` | 3 |
| `AdminPageScaffold` | admin-ui.tsx | `dashboard`, `TherapistDashboard` | 2 |
| `AdminEmptyState` (legacy) | admin-ui.tsx | `enquiries`, `privacy`, plus 5 helpers | 2 page + 5 helper |
| `EmptyState` (Phase-23 replacement) | `src/app/admin/components/EmptyState.tsx` | `bookings`, `TherapistDashboard` | 2 |
| `AdminStatusBadge` | admin-ui.tsx | `audit`, `calendar`, `clients/[id]`, `emails`, `enquiries`, `operations`, `privacy`, `reports`, `staff/[id]` + helpers | 9 page |
| `AdminErrorBoundary` | `admin-error-boundary.tsx` | `dashboard` only | 1 |
| `NotificationBell` | `notification-bell.tsx` | `dashboard` (rendered inline, not in TopNav) | 1 |
| `AdminPopover` | `admin-popover.tsx` | `notification-bell.tsx` only | 0 page |
| `admin-ui-interactions.tsx` (`AdminSheet`, `AdminActionMenu`, `ConfirmActionModal`) | `src/app/admin/components/admin-ui-interactions.tsx` | `AdminSheet` used by `dashboard-filters-client.tsx` + `notification-bell.tsx`; `AdminActionMenu` and `ConfirmActionModal` currently unused (orphan) | 0–1 indirect |
| `admin-scalable-lists.tsx` (`AdminListSurface`, `SavedViewTabs`) | same path | not yet wired up to any page | **0 / 24** — natural target for future shared DataTable |
| **shadcn primitives used in admin** | `src/components/ui/` | | |
| `Button` | `button.tsx` | 30 admin files | universal |
| `Input` | `input.tsx` | 11 |
| `Badge` | `badge.tsx` | 9 |
| `Card` (+ Header/Title/Content/Footer) | `card.tsx` | 7 (managers + form components, **not used by any page.tsx directly** — pages prefer `AdminPanel`) |
| `Textarea` | `textarea.tsx` | 7 |
| `Dialog` | `dialog.tsx` | 4 (`NewStaffForm`, `ServiceFormDialog`, `PermissionRow`, `admin-ui-interactions`) — built on **`@base-ui/react`** not Radix |
| `Form` (`Field`/`FieldSet`/etc.) | `form.tsx` | 0 admin |
| `Checkbox`, `Accordion`, `Container`, `Section`, `button-link` | various | 0 admin (marketing-only) |

**Top blast-radius targets** (descending):
1. `AdminTopNav` + `AdminLayout` — every admin page.
2. `admin-ui.tsx` as a file — every admin page transitively (via `AdminAccessDenied`).
3. shadcn `Button` — 30 of ~50 admin component files.
4. `AdminPageHeader`, `AdminPanel`, `AdminStatusBadge`, `AdminEmptyState` — the visible "skin" of list/detail pages.
5. The **dual `AdminEmptyState` (legacy) vs `EmptyState` (new)** state — consolidating these is a cheap pre-redesign cleanup.

---

## 5. Untouchable Files

Backend / route-handler / middleware / migration files. The redesign must not touch any of these.

**API route handlers**
- `[DO NOT TOUCH] src/app/api/availability/route.ts` — public availability API
- `[DO NOT TOUCH] src/app/api/bookings/route.ts` — public booking submission API
- `[DO NOT TOUCH] src/app/admin/signout/route.ts` — POST signout endpoint (admin chrome must keep submitting `<form action="/admin/signout" method="POST">` exactly as-is)
- `[DO NOT TOUCH] src/app/admin/reports/export/route.ts` — CSV export download + `report_exported` audit write

**Middleware / instrumentation**
- `[DO NOT TOUCH] src/middleware.ts` — Supabase session cookie refresh + admin route protection
- `[DO NOT TOUCH] src/instrumentation.ts` — Sentry instrumentation hook
- `[DO NOT TOUCH] sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`

**Server actions** (every admin mutation lives here — UI changes call into these unchanged)
- `[DO NOT TOUCH] src/app/admin/login/actions.ts` — `signInAdmin`
- `[DO NOT TOUCH] src/app/admin/bookings/actions.ts` — booking mutation actions (multiple)
- `[DO NOT TOUCH] src/app/admin/clients/actions.ts` — client create/update/note/privacy actions
- `[DO NOT TOUCH] src/app/admin/availability/actions.ts` — global availability rule/blocked/override actions
- `[DO NOT TOUCH] src/app/admin/services/actions.ts` — service create/update/archive/delete
- `[DO NOT TOUCH] src/app/admin/settings/actions.ts` — `updateBusinessSettings`
- `[DO NOT TOUCH] src/app/admin/staff/actions.ts` — staff profile / role / availability / overrides actions
- `[DO NOT TOUCH] src/app/admin/roles/actions.ts` — role metadata + permission toggle
- `[DO NOT TOUCH] src/app/admin/enquiries/actions.ts` — enquiry create + status
- `[DO NOT TOUCH] src/app/admin/emails/actions.ts` — `sendManualBookingReminder`
- `[DO NOT TOUCH] src/app/admin/operations/actions.ts` — `updateOperationalEventStatus`
- `[DO NOT TOUCH] src/app/admin/privacy/actions.ts` — `updatePrivacyRequestStatus`
- `[DO NOT TOUCH] src/app/admin/components/search-actions.ts` — `searchAdminCommand` (cmd-K palette)

**Auth / RBAC core** (read-only references only — `getAdminPageAccess` etc. are imported by every page)
- `[DO NOT TOUCH] src/lib/auth/**` — RBAC matrix, page access resolver, role helpers, staff profile loader
- `[DO NOT TOUCH] src/lib/supabase/**` — server / browser / admin client factories
- `[DO NOT TOUCH] src/lib/email/**` — Resend email senders
- `[DO NOT TOUCH] src/lib/observability/**` — Sentry/log helpers
- `[DO NOT TOUCH] src/lib/ops/**` — operational event helpers
- `[DO NOT TOUCH] src/lib/booking/**`, `src/lib/time/**`, `src/lib/seo/**`, `src/lib/content/**`, `src/lib/env/**`

**Admin business logic colocated under app/admin** (read-only — UI imports from these)
- `[DO NOT TOUCH] src/app/admin/dashboard/dashboard-data.ts`
- `[DO NOT TOUCH] src/app/admin/reports/reporting.ts` (and friends: `report-revenue.ts`, `report-services.ts`, etc. as exist)
- `[DO NOT TOUCH] src/app/admin/bookings/access.ts`, `format.ts`
- `[DO NOT TOUCH] src/app/admin/clients/access.ts`, `format.ts`
- `[DO NOT TOUCH] src/app/admin/staff/team-access.ts`
- `[DO NOT TOUCH] src/app/admin/shell-variant.ts`
- `[DO NOT TOUCH] src/app/admin/access.ts` (if present), and any `*.data.ts` / `*-data.ts` colocated helpers

**Database**
- `[DO NOT TOUCH] supabase/migrations/**` — schema source of truth
- `[DO NOT TOUCH] supabase/**` (config + seeds)

**Build / deploy / config**
- `[DO NOT TOUCH] next.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`
- `[DO NOT TOUCH] scripts/**` — seed/maintenance node scripts

UI-bearing **error/404 pages** are admin-redesignable in principle — but **none currently exist** under `/admin` (no `error.tsx`, no `not-found.tsx`, no `loading.tsx`). Adding them would be a redesign opportunity.

---

## 6. Feature Preservation Manifest

Nothing in this section can be silently dropped during redesign.

### 6.1 Server actions (every admin mutation)

| Page | Server actions invoked |
|---|---|
| `/admin/login` | `signInAdmin(email, password)` (calls `supabase.auth.signInWithPassword`) |
| Layout / chrome | `searchAdminCommand(query)` (cmd-K) |
| `/admin/bookings*` | `updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus`, `createManualBooking` |
| `/admin/clients*` | `createClient`, `updateClient`, `addClientNote`, `requestClientPrivacyAction` |
| `/admin/availability` | `saveAvailabilityRule`, `deleteAvailabilityRule`, `createBlockedDate`, `deleteBlockedDate`, `createAvailabilityOverride`, `deleteAvailabilityOverride` |
| `/admin/services` | `saveService`, `deleteService` (and archive/restore variant) |
| `/admin/settings` | `updateBusinessSettings` |
| `/admin/staff*` | `createStaffMember`, `updateStaffProfile`, `updateStaffPermissionOverrides`, plus staff availability rule actions |
| `/admin/roles*` | `createRole`, `updateRoleMetadata`, `togglePermissionForRole` |
| `/admin/enquiries` | `createEnquiry`, `updateEnquiryStatus` |
| `/admin/emails` | `sendManualBookingReminder` |
| `/admin/operations` | `updateOperationalEventStatus` |
| `/admin/privacy` | `updatePrivacyRequestStatus` |

Every admin mutation is wired via `<form action={serverAction}>` (or equivalent `formAction`); there are **zero `fetch()` calls to admin endpoints** in client code. Preserve the `<form action={…}>` contract and field `name` attributes (§2).

### 6.2 Audit log writes (every action that records to `audit_logs`)

Per §6.1, every action above writes a row to `audit_logs` with `{ actor_staff_id, action_type, target_type, target_id, before_state?, after_state? }`. Action types — **all must keep firing post-redesign**:

`booking_management_updated`, `booking_quick_confirm`, `booking_quick_mark_paid`, `booking_quick_cancel`, `booking_quick_complete`, `booking_assignment_claimed`, `booking_assignment_unassigned`, `booking_assignment_reassigned`, `booking_assignment_completed`, `booking_assignment_no_show`, `manual_admin_booking_created`, `enquiry_converted_to_booking`, `client_created`, `client_updated`, `client_note_added`, `client_privacy_request_created`, `client_privacy_request_status_updated`, `enquiry_created`, `enquiry_status_updated`, `manual_booking_reminder_sent`, `operational_event_status_updated`, `availability_rule_created`, `availability_rule_updated`, `availability_rule_deleted`, `blocked_date_created`, `blocked_date_deleted`, `availability_override_upserted`, `availability_override_deleted`, `staff_member_created`, `staff_profile_updated`, `staff_role_assigned`, `staff_availability_rules_updated`, `staff_permission_overrides_updated`, `role_created`, `role_metadata_updated`, `role_permission_toggled`, `service_created`, `service_updated`, `service_archived`, `service_restored`, `service_deleted`, `business_settings_updated`, `report_exported`.

The `/admin/audit` page redacts sensitive keys via regex `note|health|treatment|consent|token|secret|key|payload|body` — **preserve this redaction**.

### 6.3 Analytics events

**None.** The repo has zero analytics calls (`gtag`, `track`, `mixpanel`, `posthog`, `umami`, `plausible`, `dataLayer`, `analytics.*`). AGENTS.md confirms "analytics intentionally absent — Umami planned later." There is no analytics surface to preserve.

### 6.4 JS hooks (selectors / IDs that must not be renamed)

- `id="admin-main"` + `<a href="#admin-main">` skip-link in layout — **a11y critical**, preserve.
- `id="admin-command-search"` — label target for cmd-K input.
- `id="attention-dialog-title"` — `aria-labelledby` target on dashboard's attention dialog.
- Form field IDs `id="email"`, `id="password"` (login); `id="staff-name"` etc. (NewStaffForm); `id="rule-day"` etc. (StaffAvailabilityRulesForm) — all label-for targets, not external selectors.
- SVG `<linearGradient id="demandGradient">` — internal Recharts def.
- **No `data-testid`, no `document.getElementById/querySelector` external hooks** anywhere in admin.

### 6.5 External / important links

- **Single off-domain link** in admin: `https://www.google.com/maps/search/?api=1&query=${address}` per booking on `/admin/bookings` rows — preserve.
- POST `/admin/signout` — three call sites (desktop user menu, mobile menu, layout fallback). **Must remain a POST form, not a GET link.**
- GET `/admin/reports/export?report=<name>&<filters>` — 8 download links from reports page. Each download writes a `report_exported` audit row.
- Skip-link target `#admin-main` (a11y).
- All deep-link patterns the redesign must keep reachable: `/admin/bookings/<id>`, `/admin/bookings/new?clientId=…`, `/admin/bookings/new?enquiryId=…`, `/admin/bookings?view=claimable`, `/admin/dashboard?range=custom&from=…&to=…`, `/admin/staff/<id>`, `/admin/staff/<id>/availability`, `/admin/clients/<id>`, `/admin/roles/<id>`.

### 6.6 Per-page summaries

The full per-page manifest (server actions, audit writes, important links per route) was produced by the feature-preservation agent and is implicit in §6.1–6.5. Aggregations above are the consolidated truth.

---

## 7. Existing Design System

### 7.1 Tokens (`src/styles/tokens.css`)

**Single-mode (no dark theme).** Brand palette (`--rahma-ivory #f7f3ec`, `--rahma-green #30463f`, `--rahma-charcoal #1f2f2b`, `--rahma-muted #53615d`, `--rahma-gold #f5a623`, `--rahma-blue #1b82b8`, `--rahma-border #e8ded1`) plus admin-specific palette (`--admin-canvas #fbf8f2`, `--admin-sidebar #073824`, `--admin-panel #fffefa`, `--admin-border #e8dfd3`, `--admin-heading #151b18`, `--admin-body #313731`, `--admin-text-muted #5e625e`, `--admin-primary #073d2a`, `--admin-accent #d99a00`, `--admin-focus #1b6f93`) plus status pairs (`--admin-success/-bg`, `--admin-warning/-bg`, `--admin-danger/-bg`, `--admin-info/-bg`, `--admin-restricted/-bg`).

Tailwind v4 `@theme inline` re-exports every brand and admin color as `--color-*`, so `bg-rahma-green`, `text-admin-text`, `border-admin-border` etc. are first-class utilities.

### 7.2 Typography

- `Urbanist` 500 → `--font-urbanist` (display)
- `Work_Sans` 400/500/600/700 → `--font-work-sans` (body — body default)
- `Cormorant_Garamond` 600/700 → `--font-admin-serif` — **admin display only**, surfaced via `.admin-display` and `--font-admin-display`
- Type scale: `text-display`, `text-heading-1`, `text-heading-2` (responsive `clamp()`), `text-body-lg`, `text-body-sm`

### 7.3 Spacing / Radius / Shadows / Motion

- Spacing base 4 px; section spacing clamps `--section-space-{xs,sm,md,lg}`; content widths `--content-width-{sm,md,lg,xl}`.
- Radii: public `--radius-base 0.75rem`, `--radius-card 1.5rem`, `--radius-section 1.875rem`. Admin **tighter**: `--admin-radius-{sm,md,lg,card,control}` → 0.375 / 0.5 / 0.625 rem. Admin chrome should remain less rounded than public marketing.
- Shadows: public `--shadow-soft-token`, `--shadow-elevated-token`, `--shadow-card-token`. Admin: `--admin-shadow-card`, `--admin-shadow-subtle`. `--focus-ring-token` is applied globally in `site-parity.css`'s `:focus-visible` rule.
- Motion: `--motion-duration-fast/normal/slow` (160/240/360 ms), `--ease-gentle`, `--ease-snappy`. `globals.css` honours `prefers-reduced-motion`.

### 7.4 shadcn/ui inventory (only 12 files in `src/components/ui/`)

`button`, `button-link`, `badge`, `card`, `container`, `section`, `input`, `textarea`, `checkbox`, `form`, `dialog` (built on **`@base-ui/react`** not Radix), `accordion`. Every primitive is **already restyled to brand**. **Missing primitives** that the redesign will likely want and currently has to hand-roll: Select, Tabs, Tooltip, DropdownMenu, Sheet, Popover, Table, Toast/Sonner, Skeleton, Separator, Avatar, Switch, RadioGroup, Slider.

### 7.5 Site-parity layer (`src/styles/site-parity.css`)

Still imported (in root `layout.tsx` before `globals.css`). 2,837 lines of Webflow parity selectors. **No `admin-*` selectors** (verified). Admin pages depend on it only **transitively** via `body` font/background/`:focus-visible` rules. Safe to leave untouched.

### 7.6 Consistency notes — where the codebase deviates

- `var(--…)` admin-token usage: **603 occurrences across 30+ admin files** — strong adoption.
- **Deviation hotspots** (token-replacement candidates):
  - `admin-ui.tsx` line 21 — central tone helper uses `bg-gray-100 text-gray-600` (out-of-system grays).
  - `admin-ui.tsx` lines 34–35 — `border-orange-200`, `border-red-200` for warning/danger panel borders.
  - `dashboard/dashboard-cards.tsx` — hardcoded avatar tints (`#e8d5e0/#8b4a6b` etc., 12 hexes), chart accent `#5b8dd9`, bar fill `#a8d1bd`, `bg-gray-100 text-gray-600`. Should move into a tokenised data-viz sub-palette.
  - 11 admin files contain raw `text-gray-*` / `bg-gray-*` / `border-gray-*` utilities; 6 contain raw hexes (24 occurrences).
- **Two empty-state primitives coexist** (`AdminEmptyState` legacy + `EmptyState` Phase-23) — consolidating is a small cleanup.
- **Dead exports**: `BookingStatusChip` / `AssignmentStatusChip` in `admin-status-chips.tsx`, and `ConfirmActionModal` re-export in `src/app/admin/components/index.ts` — currently unused.

### 7.7 Brand guidance (quoted)

From `AGENTS.md`:

> "Backend/admin work should follow the same product direction and design quality as the public site, not a separate generic dashboard style."
>
> "Warm clinical luxury: Ivory and white surfaces, deep Rahma green, charcoal text, muted green-gray body text, and gold accents. Rounded cards and panels, soft borders, soft shadows, calm spacing, and restrained motion. … Avoid generic SaaS/dashboard styling, purple/blue gradients, decorative blobs, loud palettes, or dense admin defaults."
>
> "Admin/CMS screens should be efficient and scannable, but still feel like Rahma Therapy. Do not introduce an unrelated dark admin theme or default shadcn dashboard look unless it is restyled into the Rahma system."

---

## 8. Pre-Existing Issues (live check)

Live pass logged in as Owner across login, dashboard, bookings (empty + populated), bookings/new, bookings/[id] (populated), calendar, clients (empty + populated), clients/new, clients/[id] (populated), enquiries (empty + populated), emails, operations, audit, privacy (empty + populated), reports, services, settings, availability, staff (empty + populated), staff/[id], staff/[id]/availability, roles, roles/[id].

**Console errors:** **0 application errors** across every page visited.

The only "errors" surfaced are 3 dev-only Next.js HMR signals:
> `WebSocket connection to 'ws://localhost:3000/_next/webpack-hmr?id=...' failed: net::ERR_CONNECTION_REFUSED`

These are Next.js Turbopack hot-reload signals from Playwright's isolated browser context not having access to the dev HMR socket. **Pre-existing dev-only noise** — never reaches production builds.

**Console warnings:** **6 occurrences** of one Recharts message on `/admin/reports` (only with empty data):
> `The width(-1) and height(-1) of chart should be greater than 0, please check the style of container, or the props width(100%) and height(100%), or add a minWidth(0) or minHeight(288) or use aspect(undefined) to control the height and width.`

Source: empty-data Recharts `ResponsiveContainer`s in `RevenueChart` / `CountBarChart` measuring 0×0 before paint. **Pre-existing — not caused by the redesign.** **Confirmed in scope** for Phase 6 fix (per user — set explicit `minHeight: 288`).

**Failed network requests:** **0**. Only non-static traffic was Sentry `/monitoring/` POSTs (all 200 OK).

**Live findings that confirm static a11y agent hypotheses:**
- `/admin/clients` — **`location` filter input has no label / aria-label** at runtime (placeholder only). **Confirmed.**
- `/admin/settings` — heading hierarchy skips H2: H1 "Settings" → H3 "Business Rules" / H3 "Contact details" / … (shadcn `CardTitle` renders as `<h3>`). **Confirmed.**
- `/admin/staff` (empty AND populated) — heading hierarchy skips H2: H1 "Staff Management" → H3 per staff card. **Confirmed.**
- `/admin/roles` — H1 only; role-card name renders as `<p>`, not `<h2>`, so screen-reader heading nav cannot jump between roles. **Confirmed.**
- `/admin/staff/<id>` — mixed ordering in the profile form: the in-form `Card` group titles (`Profile Details`, `Account Status & Access`, `Role & Identification`) render as **H3** while sibling `<AdminPanel>` titles (`Profile completion`, `Onboarding checklist`, …) render as **H2**. The H3s appear *before* the H2s in document order — **out-of-order heading levels confirmed.**

**Live findings the static pass did not catch:**
- `AdminPanel` title level: H2 (confirmed on `/admin/staff/<id>`). Good.
- shadcn `CardTitle` level: **H3**. Confirmed — every place a shadcn `Card` is used directly inside a page (settings, availability) the heading hierarchy skips H2.

**Populated-state findings (Pass 2):**
- `/admin/bookings/<id>` — clean H1 (`H1: Phase10 E2E Claim Client`) + 12 H2s + properly nested H3s (Cancellation, Reschedule, Customer notes, etc.). Good. 9 visible inputs in `BookingManagementForm`, **0 unlabelled**, **0 icon-only buttons missing labels**. The page does **not** render an explicit `<a href="/admin/clients/...">` back-link — the booking-→-client navigation has to round-trip through the clients list. Worth considering during Phase 5 page plan.
- `/admin/clients/<id>` — clean H1 (client name) + 7 H2s (Contact, Client Summary, Health and safety context, Client Notes, Privacy workflow, Recent audit activity, Booking History) + 2 H3s nested under Booking History (Upcoming, Past). 3 inputs (note + privacy request forms), **0 unlabelled**, **0 icon-only buttons missing labels**.
- `/admin/bookings` (populated) — `BookingListCard` renders client name as `H2`, no heading skip on this page (good). The Google Maps deep-link is rendered with **`target="_blank" rel="noreferrer"`** — modern browsers auto-imply `noopener` for `target=_blank` since 2021, so this is functionally safe; if Phase 6 polish wants strict best-practice, change to `rel="noopener noreferrer"`.
- `/admin/clients` (populated) — confirms `ClientCard` name renders as **H2** (good), single H1, hierarchy clean.
- `/admin/enquiries` (populated) — clean H1 + sibling H2s (Record enquiry / one-per-row enquiry name).
- `/admin/privacy` (populated) — clean H1 (page header) + H2 per request card.
- `/admin/dashboard` (populated) — same heading skeleton as empty pass, now with non-zero numbers in cards. Recharts warnings still fire on the demand-trend mini-chart at certain widths.

No new console errors or failed network requests in Pass 2.

---

## 9. Questions For You — Resolved

All six questions answered by the user. Decisions captured below for the record so this doc stands alone.

1. **Detail-page coverage gap** → **Resolved by seeding.** Ran `pnpm test:e2e:setup` (marker `phase10_e2e`); detail pages captured (`screenshots/22-booking-detail.png`, `screenshots/23-client-detail.png`). Empty-vs-populated comparison preserved for Phase 2 visual baseline by retaining both `NN-route.png` (empty) and `NNb-route-populated.png` (seeded) screenshot variants.
2. **Recharts width/height warnings on `/admin/reports`** → **In scope for Phase 6.** Fix direction: add explicit `minHeight: 288` to the `ResponsiveContainer`s in `RevenueChart` / `CountBarChart` (and the dashboard demand-trend mini-chart).
3. **`AdminEmptyState` (legacy) vs `EmptyState` (new) consolidation** → **Deferred to a later phase.** Not absorbed into Phase 6 implementation upfront; revisit during Phase 4 / Phase 5 once redesign direction is set.
4. **Dead-code surfaces** (`BookingStatusChip`, `AssignmentStatusChip` in `admin-status-chips.tsx`; `ConfirmActionModal` re-export in `src/app/admin/components/index.ts`) → **Flag only, do nothing.** Recorded above.
5. **Missing shadcn primitives** (Select / Tabs / Tooltip / DropdownMenu / Sheet / Popover / Table / Toast / Skeleton / Separator / Avatar / Switch / RadioGroup) → **Out of scope for Phase 0.** Note here for Phase 4 (Design System) consideration. Currently hand-rolled where needed.
6. **Test-account credentials** in `docs/users-credentials` (`test.admin@…`, `test.coordinator@…`, `test.therapist@…`, `test.inactive@…`) → **Confirmed valid.** Plus Phase-10 e2e accounts (`phase10.owner@example.test` etc., password `Phase10-Test-2026!`) seeded by `scripts/seed-e2e-staff.mjs` for role-shape testing in Phase 7.

No outstanding blockers — Phase 0 is complete pending your sign-off. Phase 1 not started.
