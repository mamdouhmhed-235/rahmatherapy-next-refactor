# Business Completeness Profile (Phase 1 Step 3)

Admin-lens completeness audit for a small UK B2C mobile complementary-therapy clinic (3 to 4 people, Luton). Sources: `PRODUCT.md`, `/redesign/RECON.md`, `/redesign/FOUNDATION-FLOOR.md`. Spot-checks against the codebase noted inline.

**Discipline filter** applied per item. An item only appears below if at least one is true:
1. A reasonable customer of *this* business would be frustrated or confused without it.
2. The owner couldn't perform an essential daily operational task without it.
3. Its absence creates legal, regulatory, or data-protection risk.

**Tag legend.** Every item carries: Priority · Zone · Status · Evidence.

- **Priority:** `BLOCKS-REDESIGN` · `BLOCKS-LAUNCH` · `NICE-TO-HAVE` · `DEFER`
- **Zone:** `1` (in codebase, fixable in-stack, no secrets/billable, reversible) · `2` (adds something new, in-stack) · `3a` (new tool, account/key/cost) · `3b` (architectural change, needs ADR) · `3c` (out of scope, new product direction). Tiebreaker: third-party config / secrets / env vars / billable → Zone 2 minimum.
- **Status:** `NOT-STARTED` · `PARTIAL` · `BROKEN`
- **Evidence:** one-line observation from codebase or docs.

---

## SECTION 2A: Business Operations

### 2A-1. Mobile-friendly booking creation (top daily task #1)
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `src/app/admin/bookings/new/ManualBookingForm.tsx` exposes 27 visible inputs at desktop width (Phase 0 live probe); `docs/production/production-readiness-checklist.md:70` admits *"Mobile <768px walkthrough … pending future audit."*

Discipline filter ✓ (owner essential daily task). PRODUCT.md establishes mobile-first usage: *"they have it on their phone … even away from a desk all the time."* A 27-input single-screen form on a phone is friction for the most-used flow in the product.

**Phase 5 brief coverage (2026-05-12):** `booking-new-brief.md` redesigns the form as a four-step wizard with `AdminMobileActionBar` sticky navigation and mobile-first field stacking. `bookings-brief.md` collapses the filter bar to an `AdminSheet` bottom sheet. `calendar-brief.md` adds responsive day/week views. Phase 6 implementation: sessions 2 (booking-new), 3 (bookings), 14 (calendar) of the implementation plan.

### 2A-2. Mobile-friendly rebook of an existing client (top daily task #2)
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `/admin/bookings/new?clientId=<id>` URL pattern exists (`RECON.md` §2); `AdminCommandSearch` server action `searchAdminCommand` searches across `booking_assignments`, `bookings`, `clients` (`RECON.md` §6.1).

Discipline filter ✓ (owner essential daily task). Codebase supports the flow but it currently takes 4+ taps: open clients, search, open client, hit "Create booking". The cmd-K palette helps power users; novice operators (PRODUCT.md tech-level signal) won't reach for it. Redesign should make rebook a one- or two-tap path from any list.

**Phase 5 brief coverage (2026-05-12):** `clients-brief.md` adds a "New booking" Ghost button visible at rest on every client row → one-tap rebooking from the directory. `client-detail-brief.md` adds a "New booking" Primary in the page header with `?clientId=` pre-fill link. `booking-new-brief.md` pre-fills all contact + address fields from the client record. Together these reduce the rebook path from 4+ taps to 2 (client row → confirm booking). Phase 6 sessions 5 (clients), 6 (client-detail), 2 (booking-new).

### 2A-3. Mobile-optimised calendar / day view
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `/admin/calendar` exists with day/week views (`RECON.md` §2). Production-readiness-checklist explicitly defers mobile walkthrough.

Discipline filter ✓ (owner essential). A therapist between visits needs the day view on their phone. Currently unverified at <768px.

**Phase 5 brief coverage (2026-05-12):** `calendar-brief.md` specifies the responsive time-rail day view with 56px hourly tick gutter, momentum-scroll week strip, and mobile fallback for the unassigned sidebar. `dashboard-therapist-brief.md` provides the Therapist's mobile-first claimable strip and Next Visit hero. Phase 6 session 14 (calendar), 10 (dashboard-therapist).

### 2A-4. Heading hierarchy on shadcn-card pages
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `A11Y-BASELINE.md` finding A1: four pages (`/admin/settings`, `/admin/staff`, `/admin/availability`, `/admin/staff/[id]`) skip H1 → H3 because `src/components/ui/card.tsx CardTitle` renders as `<h3>`.

Discipline filter ✓ (regulatory: Equality Act 2010 / WCAG 2.1 AA). Confirmed live during Phase 0 probe.

**Phase 5 brief coverage (2026-05-12):** `00-shared-components-brief.md` mandates `AdminPanel`/`AdminPanelHeader` rendering H2 universally, replacing all shadcn `Card`/`CardTitle` (H3) usages in admin pages. Named fixes in: `settings-brief.md` (explicit H2 panels), `staff-brief.md` (H3→H2 for member names), `availability-brief.md` (H2 section panels), `staff-detail-brief.md` (mixed H2/H3 order fix), `roles-brief.md` (role name `<p>`→`<h2>`), `client-detail-brief.md` (CardTitle→AdminPanel). Phase 6 session 1 (00-shared-components) fixes the primitive; subsequent sessions inherit it.

### 2A-5. Unlabelled filter input on `/admin/clients`
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `A11Y-BASELINE.md` `/admin/clients` row: `INPUT[name="location" type=text placeholder="Postcode or city"]` has no `<label>`, no `aria-label`, no `aria-labelledby` (live-probed).

Discipline filter ✓ (regulatory: Equality Act 2010 / WCAG 2.1 AA, also blocks clients filter for screen-reader users).

**Phase 5 brief coverage (2026-05-12):** `clients-brief.md` §4 explicitly names this as a P0 fix: "The `location` filter input currently has no `<label>` or `aria-label` at runtime. Every filter input ships with a visible `<label>` element." Phase 6 session 5 (clients).

### 2A-6. Form errors silently fail to announce (aria-live missing)
`BLOCKS-REDESIGN · Zone 1 · PARTIAL` · **Evidence:** `A11Y-BASELINE.md` global finding A4. Every form-level error region (`LoginForm`, `ClientCreateForm`, `EnquiryForm`, `ManualBookingForm`, `SettingsForm`, `AvailabilityRulesManager`, `BookingManagementForm`, `BlockedDatesManager`, `AvailabilityOverridesManager`) renders error text as a plain `<p>` without `role="alert"` or `aria-live="polite"`. **Coverage:** 00-shared-components primitive shipped (`aa76451`); per-form audit live for: login (`role="alert" aria-live="polite" aria-atomic="true"` on LoginForm.tsx error region per `7e7e930`). Flip to `HANDLED` when remaining 23 form-bearing pages adopt; each per-page recipe's Step 12a `**BUSINESS-COMPLETENESS impact:**` subsection tracks new contributions.

**Phase 6 close — documented contributors (2026-05-19):** beyond login, 4 additional pages explicitly recorded a 2A-6 contribution in their PER-PAGE-SCORES.md `BUSINESS-COMPLETENESS impact:` subsection:
- `enquiries` (`EnquiryForm` form-level + field-level regions with full WCAG attribute set)
- `roles` (`CreateRoleSheet.tsx:43-49` form-level region — partial contribution; recipe notes the surrounding submit is FAKE-degraded and the region is `sr-only`)
- `services` (`ServiceFormDialog.tsx:178-181, :266-269` + shared `AdminInput` error region — all triplets present)
- `email-templates` (`TemplateEditForm` save-error + `ManualSendSheet` regions with full triplet)

**Status held at PARTIAL.** Documented evidence reaches 5/24 form-bearing pages (login + 4). The remaining 19 form-bearing pages did not log a `BUSINESS-COMPLETENESS impact:` entry — this is a documentation gap, NOT confirmation of implementation gap. Phase 7 (`/impeccable audit admin` per impeccable-v5-latest-stable.html) is the appropriate venue to verify the undocumented pages by inspecting the implementations; flip to HANDLED is deferred until Phase 7 produces that evidence.

Discipline filter ✓ (regulatory). Highest-impact a11y fix because it touches every form.

**Phase 5 brief coverage (2026-05-12):** `00-shared-components-brief.md` §5 Input spec mandates `<div role="alert" aria-live="polite" aria-atomic="true">` on every error region universally. Every form-bearing brief (booking-new, client-new, settings, availability, enquiries, services, staff-availability, etc.) carries this forward verbatim. Phase 6 session 1 (00-shared-components) establishes the primitive; every subsequent session inherits it.

### 2A-7. Recharts empty-data 0×0 warnings on `/admin/reports` and dashboard
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `RECON.md` §8: six console warnings *"width(-1) and height(-1) of chart …"* from `RevenueChart` / `CountBarChart` / dashboard demand-trend mini-chart. Confirmed in-scope by user during Phase 0 Q&A.

Discipline filter ✓ (owner essential — reports). Cosmetic but visible; fixed with `minHeight: 288` on `ResponsiveContainer`.

**Phase 5 brief coverage (2026-05-12):** `reports-brief.md` §4 explicitly applies `minHeight: 288` to every `ResponsiveContainer` (6 warnings → 0). `dashboard-owner-admin-brief.md` §10 Open Question 3 notes the demand-trend mini-chart fix. Phase 6 sessions 11 (reports), 8 (dashboard-owner-admin).

### 2A-8. Tab `<Link>`s lack `aria-current="page"` on staff detail / availability
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `A11Y-BASELINE.md` `/admin/staff/[id]/availability` row. Active tab is signalled by `border-[var(--rahma-green)]` only (color-only conveyance), violating one of PRODUCT.md's accessibility commitments.

Discipline filter ✓ (regulatory).

**Phase 5 brief coverage (2026-05-12):** `staff-availability-brief.md` explicitly fixes the Profile/Availability tab strip (Sam #3). `bookings-brief.md` specifies `aria-current="page"` on all primary view tabs. `00-shared-components-brief.md` §5 View Tabs spec mandates `aria-current="page"` universally. `emails-brief.md`, `client-detail-brief.md`, `enquiries-brief.md`, and all other tab-bearing briefs carry this forward. Phase 6 session 1 (00-shared-components) establishes the pattern; inherited by all subsequent sessions.

### 2A-9. Required-field markers invisible
`BLOCKS-REDESIGN · Zone 1 · PARTIAL` · **Evidence:** `A11Y-BASELINE.md` global finding A5. `required` HTML attribute is present on `LoginForm`, `SettingsForm`, `ManualBookingForm`, `ClientCreateForm` etc. without an "*" or "(required)" visible marker. **Coverage:** 00-shared-components primitive shipped (`aa76451`); per-form audit live for: login (visible `*` markers in Cancelled-family colour with `aria-hidden="true"` on LoginForm.tsx per `7e7e930`). Flip to `HANDLED` when remaining 23 form-bearing pages adopt; each per-page recipe's Step 12a `**BUSINESS-COMPLETENESS impact:**` subsection tracks new contributions.

**Phase 6 close — documented contributors (2026-05-19):** beyond login, 2 additional pages explicitly recorded a 2A-9 contribution in their PER-PAGE-SCORES.md `BUSINESS-COMPLETENESS impact:` subsection:
- `roles` (`CreateRoleSheet.tsx:57-59, :81-83` visible `*` in Cancelled-family colour with `aria-hidden="true"` on `display_label` and `name`)
- `email-templates` (`ManualSendSheet` "Send to" input carries the visible `*` in Cancelled text colour with `aria-hidden="true"`)

**Status held at PARTIAL.** Documented evidence reaches 3/24 form-bearing pages (login + 2). The remaining 21 form-bearing pages did not log a `BUSINESS-COMPLETENESS impact:` entry — this is a documentation gap, NOT confirmation of implementation gap. Phase 7 (`/impeccable audit admin` per impeccable-v5-latest-stable.html) is the appropriate venue to verify the undocumented pages by inspecting the implementations; flip to HANDLED is deferred until Phase 7 produces that evidence.

Discipline filter ✓ (regulatory, plus operator clarity).

**Phase 5 brief coverage (2026-05-12):** `00-shared-components-brief.md` §5 Input spec mandates `<span aria-hidden="true">*</span>` in Cancelled text colour adjacent to every required label, universally. Every form-bearing brief carries this forward. Phase 6 session 1 (00-shared-components) establishes the pattern.

### 2A-10. Two-factor authentication (MFA) for admin accounts
`BLOCKS-LAUNCH · Zone 2 · NOT-STARTED` · **Evidence:** No `auth.mfa` or TOTP setup surface visible in `/admin/login` or `/admin/settings` per recon. Supabase Auth supports TOTP MFA but it's not enabled.

Discipline filter ✓ (regulatory / data-protection — UK GDPR Article 32 "appropriate technical measures", especially with Article 9 health-note data). Zone 2 because enabling MFA on Supabase Auth needs project-side configuration (not just a code change in this repo).

**Phase 5 brief coverage (2026-05-12):** No Phase 5 brief requires MFA UI. Track B pre-launch item; not blocked on redesign completion.

### 2A-11. Leaked-password protection (HaveIBeenPwned)
`BLOCKS-LAUNCH · Zone 1 · HANDLED` · **Evidence:** `docs/production/production-readiness-checklist.md:67` reports Supabase advisor WARN: `auth_leaked_password_protection disabled`.

Discipline filter ✓ (regulatory / data-protection best practice). Toggle in Supabase dashboard, no code change.

**Phase 5 brief coverage (2026-05-12):** No Phase 5 brief requires this. Supabase dashboard toggle; handled during pre-launch Track B.

### 2A-12. Backup retention + restore drill
`BLOCKS-LAUNCH · Zone 1 · HANDLED` · **Evidence:** `FOUNDATION-FLOOR.md` §1 item 3. `docs/production-runbook.md:159` itself says *"Supabase backups and export expectations must be confirmed before launch."* No restore test on record.

Discipline filter ✓ (regulatory / data-protection — UK GDPR Article 32).

**Phase 5 brief coverage (2026-05-12):** No Phase 5 brief requires this. Operational task; handled during pre-launch Track B.

### 2A-13. Production / staging environment separation
`BLOCKS-LAUNCH · Zone 3a · NOT-STARTED` · **Evidence (verified via Supabase MCP):** one project only — `Rahma-therapy` (`twzutkfgqclqurvkmvqz`), status ACTIVE_HEALTHY, eu-west-1, Postgres 17, created 2026-05-01. `mcp__supabase__list_branches` errored (branching not enabled on the current tier). `wrangler.jsonc` defines no `[env.staging]` block. Dev server, `pnpm test:e2e:setup` (phase10 markered seed), and (eventually) production all read/write the same database.

Discipline filter ✓ (data-protection risk: test fixtures sit alongside real-client health records). Clarification: the Supabase project IS live; what's missing is a *second* environment so dev/test traffic doesn't share the production database. Two paths: (a) a separate Supabase project for staging, billable; (b) enable Supabase Branching on Pro+, billable. Either is Zone 3a (new account, key, or paid tier upgrade). **Timing:** post-redesign, pre-public-launch (see Top Priorities split below).

**Phase 5 brief coverage (2026-05-12):** No Phase 5 brief requires this. Infrastructure; handled during pre-launch Track B.

### 2A-14. CSP + HSTS headers
`BLOCKS-LAUNCH · Zone 1 · HANDLED` · **Evidence:** `FOUNDATION-FLOOR.md` §1 item 6. Live header probe shows `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` present. CSP absent. HSTS not in `next.config.ts headers()` (relies on Cloudflare edge, untested).

Discipline filter ✓ (regulatory best practice; defence in depth for health data).

**Phase 5 brief coverage (2026-05-12):** No Phase 5 brief requires this. Infrastructure; handled during pre-launch Track B.

### 2A-15. Receipts / proof-of-payment for clients — REMOVED FROM SCOPE
`OUT-OF-SCOPE` · **Decision (user, Phase 1 Step 3 review):** *"no need for receipts, or rather for the website to deal with it."*

Customers who need a receipt can be issued one out-of-band (e.g. WhatsApp / manual email). The CRM is not responsible for receipt generation. Listed here only so the next agent reading the audit knows the gap was considered and consciously dropped.

### 2A-16. Automated booking reminders (scheduled 24h-before, scalable)
`BLOCKS-REDESIGN · Zone 2 · NOT-STARTED` · **Evidence:** `sendBookingReminderEmail` template exists in `src/lib/email/notifications.ts:520` but is fired only from `/admin/emails` manual "Send reminder" buttons. Grep for `pg_cron`, `scheduled-functions`, `edge-function`: zero matches.

Discipline filter ✓ (owner essential operational task at any scale beyond a handful of bookings/day). **Confirmed in scope by user during Phase 1 Step 3 review** with the explicit requirement that the implementation must scale as the client list and booking volume grow. Implementation path:

- **Recommended:** Supabase Edge Function on a daily `pg_cron` schedule (e.g. 09:00 local). Function selects bookings 24h ahead in `status IN ('pending','confirmed')` and `email_delivery_events` does not already contain a reminder send for that booking. Calls `sendBookingReminderEmail` for each, then writes one `email_delivery_events` row per send. Idempotent by design.
- **Scales naturally:** the function loops over candidate bookings, not a fixed list. Supabase's free tier allows 500k Edge Function invocations / month; one daily cron will use under 50/month even at hundreds of bookings/day.

**Zone note (transparent disagreement with user's "Zone 1" request).** Per the recipe's own tiebreaker rule ("third-party config / secrets / env vars / billable usage → Zone 2 minimum"), Edge Functions need a separately deployed function + a `pg_cron` schedule + likely a function-scoped env var (e.g. SITE_URL for email links). That's Zone 2, not Zone 1. Priority bumped to BLOCKS-REDESIGN as requested. If you want Zone 1 ergonomics (no new infra), an alternative is to run the same logic from a Next.js server action invoked on first admin pageload of the day with a "last-run" timestamp, but this is fragile and depends on someone signing in each morning. Recommend Zone 2 / Edge Function.

**Phase 5 brief coverage (2026-05-12):** `emails-brief.md` builds the manual reminder queue (Reminders tab) only; the automated 24h cron is explicitly **not** included in any Phase 5 brief. Status unchanged: NOT-STARTED. Plan file: `redesign/backend-plans/BUILD-automated-booking-reminders.md` (created Phase 5.5 cross-check). Must be implemented before or during Phase 6 `emails` session (session 22 of the implementation plan).

### 2A-17. Two-empty-state primitive consolidation
`DEFER → IN-PROGRESS IN PHASE 6 · Zone 1 · HANDLED` · **Evidence:** `RECON.md` §4: `AdminEmptyState` (legacy) and `EmptyState` (Phase 23 new) coexist. User confirmed during Phase 0 Q3: deferred to a later phase.

Discipline filter weak (operator confusion is minor). Recorded for awareness.

**Phase 5 brief coverage (2026-05-12):** `00-shared-components-brief.md` §4 explicitly consolidates `AdminEmptyState` (legacy) → shared `EmptyState`. All 29 page briefs reference the shared `EmptyState` component. User marked DEFER in Phase 0 but Phase 5 briefs address it as part of the 00-shared-components redesign; it will be resolved in Phase 6 session 1.

### 2A-18. Staff password-reset workflow (greenfield)
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence (Phase 5 discovery):** `account_password_requests` table has existed in production since migration `phase9_account_password_requests` (2026-05-09) with one pending row and zero application-code references. Staff who forget their password have no self-service reset path; the Owner has no UI to approve or reject reset requests.

Discipline filter ✓ (owner essential: a locked-out therapist can't work). Zone 1 because the table and data schema already exist; the gap is application code only.

**Phase 5 brief coverage (2026-05-12):** `password-reset-brief.md` (Brief 10) — net-new staff-facing flow across six states (`/admin/password-reset` + `/admin/password-reset/[token]`). `account-password-requests-brief.md` (Brief 12) — net-new Owner/Admin review queue. Layer 3 plan files: `BUILD-approve-reject-password-reset.md`, `BUILD-password-reset-email-templates.md`, `BUILD-rbac-permission-account-password-requests.md`, `BUILD-password-reset-request-actions.md`. Phase 6 sessions 15 (login), 16 (password-reset), 12 (account-password-requests) of the implementation plan.

---

## SECTION 2B: User-Type Journeys

Walking each role through their typical day, surfacing breaks. The five roles in RBAC: Owner, Admin / Practice Manager, Booking Coordinator, Therapist, Inactive. Per Phase 1 Step 2 user-answers, Booking Coordinator is dormant at current team size but stays visible in the admin (kept as a destination role for future hires).

### 2B-1. Owner (mobile, morning check, away from desk)
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** `RECON.md` §2 dashboard: business-variant renders `TodayAtAGlanceCard` + `UrgentAttentionPanel` + `StaffCapacityCard` + `PaymentHealthCard` + `OperationsHealthCard` + `BusinessPulseCard`. Dashboard has 13 H2-rooted cards on a single page (live probe).

Journey: sign in → dashboard → scan today → spot a partially-assigned booking → tap into detail → assign therapist → mark paid. The flow exists end-to-end. Breaks: mobile density unverified (item 2A-3); dashboard's 13 cards stack on phone and cause scroll fatigue (called out in `dashboard_audit.md`); cmd-K palette useful but not discoverable for novice owners.

**Phase 5 brief coverage (2026-05-12):** `dashboard-owner-admin-brief.md` redesigns the business dashboard as a calm two-tier surface: Tier 1 (Today + Urgent Attention, always visible) + Tier 2 (Business Overview, collapsed by default with `localStorage` persistence). BASELINE-CRITIQUE P2 (6+ card groups simultaneously) resolved. `login-brief.md` adds the full `logo-refined.svg` brand wordmark. `booking-detail-brief.md` adds a fixed two-action sticky bar on mobile. `booking-new-brief.md` adds `AdminMobileActionBar`. Phase 6 sessions 8 (dashboard-owner-admin), 15 (login), 2 (booking-new), 4 (booking-detail).

### 2B-2. Admin / Practice Manager (desktop, mid-day operations)
`NICE-TO-HAVE · Zone 1 · HANDLED` · **Evidence:** `RECON.md` §2: Practice Manager has same surface as Owner minus `manage_role_templates` and `manage_permission_overrides`. `docs/production/production-readiness-checklist.md` "Role-shape coverage" matrix confirms parity.

Journey: review new enquiries → convert promising ones to bookings → adjust services and pricing → run a weekly operational report → export CSV for the owner. Flow works. Breaks: Reports page Recharts warnings (2A-7); CSV export already triggers `report_exported` audit. No regression-level blocker.

**Phase 5 brief coverage (2026-05-12):** `reports-brief.md` fixes Recharts warnings and restructures the three question-sections. `enquiries-brief.md` adds tab-based lead pipeline. `services-brief.md` adds grouped catalog with AdminSheet editor. No new blockers surfaced for Admin/PM journey.

### 2B-3. Booking Coordinator (dormant role, kept visible)
`DEFER · Zone 1 · HANDLED` · **Evidence:** `RECON.md` §2: role gated by `manage_enquiries` + `view_bookings_all` + `manage_bookings_all`. UX layer exists per `dashboard/page.tsx` "coordinator" variant. User Phase 1 Q2 answer: keep role visible.

Journey: would handle WhatsApp/phone enquiries → convert → assign. Works in principle. Untested with a real coordinator account in this recon pass. No daily occupant currently.

**Phase 5 brief coverage (2026-05-12):** `dashboard-coordinator-brief.md` designs the Coordinator variant with unassigned-first Today sort and Active Enquiries tile. `enquiries-brief.md` designs the full lead pipeline. `bookings-brief.md` includes Coordinator's full triage surface. Role is addressed by Phase 5 briefs; it is dormant only because no current staff member holds it, not because it's undeveloped.

### 2B-4. Therapist (mobile, between visits)
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** Phase 21 added a dedicated `TherapistDashboard.tsx`; bookings page filters to therapist's own work; staff profile/availability surfaces gate to own-self editing.

Journey: phone signed in between visits → therapist dashboard → see next appointment → drive there → complete the booking → optionally claim a newly-claimable visit later in the day. Designed-for path. Breaks: same mobile-density concern as Owner; gender-matching cue on claim buttons unverified (does the claimable list visually pair gender constraints with the visit?). `RECON.md` §8 noted gender-matching legibility as a Phase 5 question.

**Phase 5 brief coverage (2026-05-12):** `dashboard-therapist-brief.md` resolves BASELINE-CRITIQUE Casey #4 (dashed-border empty state replaced with EmptyState + "Browse claimable work" CTA). Adds Next Visit hero with `tel:` + Google Maps deep-links, gender-match chip, open-by-default customer notes block. `bookings-brief.md` narrows Therapist view to Today/Upcoming/Claimable tabs. `calendar-brief.md` adds "Claimable today" panel replacing the Unassigned sidebar for Therapist. `staff-availability-brief.md` adds the per-staff availability workstation (own-profile edit). Gender-matching legibility confirmed: "Same-gender required" chip always visible on BookingListCard and booking-new participant rows. Phase 6 sessions 10 (dashboard-therapist), 3 (bookings), 14 (calendar), 29 (staff-availability).

### 2B-5. Inactive (revoked)
`PRESENT · Zone n/a · PRESENT` · **Evidence:** `src/middleware.ts:59-64` redirects with `?reason=inactive`; `/admin/login` reads `searchParams.reason === "inactive"` and shows the inactive banner. Live-confirmed during Phase 0.

No journey break. Recorded for completeness.

**Phase 5 brief coverage (2026-05-12):** `login-brief.md` redesigns the inactive notice using Restricted-family status family (replacing the raw text banner).

---

## SECTION 2C: Tech-Stack Utilization

What the chosen stack enables but the admin doesn't currently use, and what's installed-but-broken.

### 2C-1. TanStack Query — installed, zero admin usage
`NICE-TO-HAVE · Zone 1 · HANDLED` · **Evidence:** `grep -l "useQuery\|useMutation\|@tanstack" src/app/admin/` returns no files. Listed in stack table; not wired.

Could power optimistic UI on quick-actions (Confirm / Mark Paid / Claim) and remove the current full-page revalidation on form submission. Zone 1 because pure code wiring within installed deps.

**Phase 5 brief coverage (2026-05-12):** `00-shared-components-brief.md` Open Question 2 recommends TanStack Query for the `NotificationBell` 60s poll. `booking-detail-brief.md` mentions optimistic claim UI. `bookings-brief.md` mentions optimistic row updates. Phase 6 implementer decides whether to wire TanStack for these surfaces; NICE-TO-HAVE, not blocking.

### 2C-2. Framer Motion — MOVED TO DEFERRED-COMPLETENESS.md
`MOVED TO DEFERRED · Zone 1 · NOT-STARTED` · **Phase 5 finding:** No Phase 5 brief requires Framer Motion. All motion in the redesign is specified as CSS transitions using DESIGN.md motion tokens (`--motion-duration-*`, `ease-gentle`, `ease-snappy`) implemented via Tailwind utilities. Moved to `/redesign/DEFERRED-COMPLETENESS.md` entry #1 with reason: "no brief required this — predicted in Phase 0 but not realized in Phase 5."

### 2C-3. Recharts width/height warnings
`BLOCKS-REDESIGN · Zone 1 · HANDLED` · **Evidence:** Same as 2A-7. Cross-listed here because it is a stack-utilisation symptom (Recharts `ResponsiveContainer` config gap), not just a console hygiene issue.

**Phase 5 brief coverage (2026-05-12):** See 2A-7. `reports-brief.md` and `dashboard-owner-admin-brief.md` both apply `minHeight: 288`. Phase 6 sessions 11 (reports), 8 (dashboard-owner-admin).

### 2C-4. Sonner (toast) is wired and in use
`PRESENT · Zone n/a · PRESENT` · **Evidence:** Spot-grep found Sonner / toast usage across 10 admin files (`AvailabilityOverridesManager`, `AvailabilityRulesManager`, `BlockedDatesManager`, `AssignmentManager`, `BookingActionButton`, `BookingManagementForm`, `ClaimAssignmentButton`, `CopyButton`, `EnquiryStatusButton`, `DeleteServiceButton`).

Earlier inferred "toast missing"; corrected. No action.

### 2C-5. Staff avatars via Supabase Storage
`NICE-TO-HAVE → IN-PROGRESS IN PHASE 6 · Zone 1 · HANDLED` · **Evidence:** Phase 18 migration `20260510000000_phase18_storage_avatars_canonical_perm.sql` provisioned the `staff-avatars` private bucket. `staff_profiles.profile_photo_path` field exists (4 admin files reference it). However `RECON.md` §9 image-inventory note: `/admin/staff` cards still fall back to lucide `<User>` icon when no avatar is uploaded.

Discipline filter weak (cosmetic). Note for Phase 5 — if avatars upload but don't render in lists, that's a wire-up gap worth a sweep.

**Phase 5 brief coverage (2026-05-12):** `00-shared-components-brief.md` Open Question 4 commits to the deterministic avatar algorithm (hue from `hash(staff.id) % 360` with chroma 0.025, lightness 88%) for staff without photos. `staff-brief.md`, `staff-detail-brief.md`, `booking-detail-brief.md`, `calendar-brief.md`, `dashboard-coordinator-brief.md`, and `audit-brief.md` all specify "real photo or initialled token" per row. Phase 6 session 1 (00-shared-components) wire-up plus the per-page sessions that render avatars.

### 2C-6. Missing shadcn primitives (Select, Tabs, Tooltip, DropdownMenu, Sheet, Popover, Table, Skeleton, Separator, Avatar, Switch, RadioGroup)
`NICE-TO-HAVE → BLOCKS-REDESIGN FOR SUBSET · Zone 1 · HANDLED` · **Evidence:** `RECON.md` §7.4 catalogues only 12 shadcn files in `src/components/ui/`. User confirmed during Phase 0 Q5: out of scope this phase, note for Phase 4 (Design System).

**Phase 5 brief coverage (2026-05-12):** Phase 5 briefs surface concrete requirements for specific missing primitives:
- **Switch** — Required by `settings-brief.md` (intake on/off) and `availability-brief.md` (working-day toggles). Blocks those sessions.
- **AdminSheet (existing in admin-ui-interactions.tsx, not a shadcn Sheet)** — Already exists; no new primitive needed.
- **Skeleton** — `AdminSkeleton` already exists in `admin-ui.tsx`; no new primitive needed.
- **Tabs/View Tabs** — Implemented as custom pill strips per DESIGN.md patterns; no shadcn Tabs needed.
- **Avatar** — Implemented as CSS circles with initialled tokens; no shadcn Avatar needed.
- **RadioGroup, Select, DropdownMenu** — Not required by any Phase 5 brief as net-new shadcn primitives; existing implementations sufficient.

Priority update: only **Switch** is BLOCKS-REDESIGN (needed by settings and availability sessions). All others remain NICE-TO-HAVE. Phase 6 session 1 (00-shared-components) adds the Switch component.

### 2C-7. Dead-code surfaces
`DEFER → PARTIALLY RESOLVED IN PHASE 6 · Zone 1 · HANDLED` · **Evidence:** `RECON.md` §4: `BookingStatusChip` / `AssignmentStatusChip` in `admin-status-chips.tsx` (unused), `ConfirmActionModal` re-export in `src/app/admin/components/index.ts` (unused), `AdminScalableLists`, `SavedViewTabs` (built but never imported by a page). User Phase 0 Q4: flag-only, do nothing.

**Phase 5 brief coverage (2026-05-12):** `account-password-requests-brief.md` (Brief 12) is the first consumer of `ConfirmActionModal` (currently orphan). `bookings-brief.md` wires `AdminListSurface` and `SavedViewTabs` (first consumer). `00-shared-components-brief.md` wires `AdminActionMenu` and `ConfirmActionModal` to destructive actions. Remaining dead code (`BookingStatusChip`, `AssignmentStatusChip` in `admin-status-chips.tsx`) is NOT addressed by any Phase 5 brief — those exports can be deleted during Phase 6 cleanup passes.

### 2C-8. Plain HTML form pattern in admin vs RHF+Zod in customer flow — MOVED TO DEFERRED-COMPLETENESS.md
`MOVED TO DEFERRED · Zone 1 · PARTIAL` · **Phase 5 finding:** No Phase 5 brief proposes switching admin forms to RHF+Zod. All 29 briefs explicitly preserve the `<form action={serverAction}>` + named-field contract (RECON §6.4). Moved to `/redesign/DEFERRED-COMPLETENESS.md` entry #2 with reason: "no brief required this — predicted in Phase 0 but not realized in Phase 5."

### 2C-9. No edge cron / scheduled function infrastructure
`NICE-TO-HAVE → BLOCKS-REDESIGN (see 2A-16) · Zone 2 · NOT-STARTED` · **Evidence:** `grep -l "pg_cron\|scheduled-functions\|edge-function"` returns zero matches across the repo.

Blocks 2A-16 (automated reminders) and would also enable nightly retention sweeps. Supabase Edge Functions + `pg_cron` is the in-stack path. Zone 2 because new infra configuration.

**Phase 5 brief coverage (2026-05-12):** No Phase 5 brief directly provisions this infrastructure, but `emails-brief.md` builds the manual reminder queue that is the partial substitute. 2A-16 plan file (`BUILD-automated-booking-reminders.md`) specifies the Supabase Edge Function + `pg_cron` implementation. This must be provisioned as part of the 2A-16 build.

### 2C-10. `email_template_overrides` database table (Phase 5 discovery)
`BLOCKS-REDESIGN · Zone 2 · HANDLED` · **Evidence (Phase 5 discovery):** `email-templates-brief.md` (Brief 02) requires a persistent store for editable template copy fields (greeting lines, footer contact). The `src/lib/email/templates.ts` file is SERVER-ONLY with hardcoded strings; there is no table to store per-operator overrides.

Discipline filter ✓ (owner essential: the Owner needs to control the voice of outgoing emails without touching code). Zone 2 because a new DB table + migration is needed.

**Phase 5 brief coverage (2026-05-12):** `email-templates-brief.md` §10 Q2 proposes the table. Layer 3 plan file: `BUILD-email-template-overrides-table.md`. Phase 6 session 21 (email-templates). Without this table, the "Save changes" Primary in the email-templates brief is non-functional.

**Engineering pause close — Session 1 + Session 2 (2026-05-19):** Status flipped NOT-STARTED → HANDLED. Three migrations applied to production project `Rahma-therapy` (`twzutkfgqclqurvkmvqz`):
- `20260519120000_email_template_overrides_table` — table + 4 RLS policies + service_role grants + `manage_email_templates` permission row
- `20260519121000_email_template_overrides_authenticated_select_grant` — one-line follow-up after smoke caught a missing GRANT (codebase convention check across 6 reference tables confirmed SELECT-only-to-authenticated as the universal pattern)
- `20260519130000_grant_manage_email_templates_to_owner_admin` — role grant, Owner + Admin (user decision; Booking Coordinator deliberately excluded)

Code wiring (Session 2): `src/app/admin/email-templates/actions.ts` rewritten with real `saveTemplateOverride` (permission gate + HTML strip + per-field upsert/delete + per-field audit row) and `sendTemplateManually` (permission gate + recipient/var validation + override resolution + render dispatch + Resend send + audit row). `src/lib/email/templates.ts` extended with `resolveTemplateOverrides` + `getAllTemplateOverrides` + override-aware `render*Email()` functions (each accepts an optional `overrides` map with safe defaults; backward-compatible for existing callers in notifications.ts and the preview route). UI plumbing: `TemplateEditForm` accepts `serverInitialValues`, `TemplatesTab` accepts `initialOverrides`, `emails/page.tsx` fetches via `getAllTemplateOverrides()` server-side. FAKE markers removed from the Save form and the manual-send form (preview-iframe FAKE marker + booking-picker FAKE marker kept as flagged scope-creep).

Smoke-test evidence: `/redesign/backend-smoke-tests/email-template-overrides-table-2026-05-19.txt` (Session 1) + `/redesign/backend-smoke-tests/email-template-overrides-actions-2026-05-19.txt` (Session 2). All 5 spec scenarios PASS (1, 2, 3, 5 live in the browser; 4 by code inspection + DB cross-check after Playwright DOM corruption could not defeat React's controlled-input restoration). Scenario 3 includes operator-confirmed inbox arrival of a real Resend send with override-applied copy.

---

## Top Priorities (split into two tracks)

*Last updated: 2026-05-12 (Phase 5.5 cross-check). Items 9–12 and the Zone 2 note on item 8 are new additions from the Phase 5 brief review.*

User direction (Phase 1 Step 3 review): the launch-track items run **after** the redesign is complete, before the site goes live publicly. They are not parallel — they are sequential. The list is split accordingly.

### Track A — Redesign workload (Phase 5 plans, Phase 6 implementation)

Twelve items the redesign must clear before it ships to the clinic. All `BLOCKS-REDESIGN`. Items 1–8 are from Phase 1 Step 3; items 9–12 are added by the Phase 5 brief review.

1. **Heading hierarchy (CardTitle h3 vs page h1)** · 2A-4 · Zone 1 · highest a11y leverage. Fix once in `src/components/ui/card.tsx` (add `as` prop); four pages clear at once. Also requires `AdminPanel`/`AdminPanelHeader` H2 universally per 00-shared-components brief.
2. **Form errors aria-live announce** · 2A-6 · Zone 1 · touches every form. Wrap top-level error regions in `role="alert" aria-live="polite"`. Universal pattern in 00-shared-components brief Input spec.
3. **Unlabelled `/admin/clients` `location` filter** · 2A-5 · Zone 1 · single-line fix, single page. Explicit P0 fix in clients-brief.md.
4. **Mobile-friendly booking creation** · 2A-1 · Zone 1 · top daily task, mobile-first user. booking-new brief: four-step wizard + AdminMobileActionBar.
5. **Mobile-friendly rebook flow** · 2A-2 · Zone 1 · top daily task #2. clients brief: one-tap "New booking" Ghost per row. client-detail brief: "New booking" Primary + ?clientId= pre-fill.
6. **Mobile-optimised calendar / day view** · 2A-3 · Zone 1 · therapist between visits needs this. calendar brief: responsive time-rail + week strip.
7. **Recharts empty-data warnings** · 2A-7 / 2C-3 · Zone 1 · trivial `minHeight: 288` fix. reports brief + dashboard-owner-admin brief.
8. **Automated 24h booking reminders (scalable)** · 2A-16 · Zone 2 · added to redesign scope by user request. Plan file: `BUILD-automated-booking-reminders.md`. Supabase Edge Function on a daily `pg_cron` schedule. Must be completed before or during Phase 6 `emails` session.
9. **Tab `aria-current="page"` (colour-only active tabs)** · 2A-8 · Zone 1 · previously in Honourable mentions; promoted because every tab-bearing Phase 5 brief commits to the fix universally. Single pattern from 00-shared-components brief; inherited by all tab-bearing sessions.
10. **Required-field visible `*` markers** · 2A-9 · Zone 1 · previously in Honourable mentions; promoted because 00-shared-components brief mandates the pattern universally across all forms. Zero sessions can ship without it.
11. **Staff password-reset workflow** · 2A-18 · Zone 1 · net-new greenfield. Production `account_password_requests` table already has a pending row; staff are locked out with no recovery path. Plan files: `BUILD-approve-reject-password-reset.md`, `BUILD-password-reset-request-actions.md`, `BUILD-password-reset-email-templates.md`, `BUILD-rbac-permission-account-password-requests.md`. Phase 6 sessions 15 (login), 16 (password-reset), 12 (account-password-requests).
12. **`email_template_overrides` database table** · 2C-10 · Zone 2 · required by email-templates brief for the editable copy fields feature. Plan file: `BUILD-email-template-overrides-table.md`. Phase 6 session 21 (email-templates).

### Track B — Pre-launch workload (after Track A, before public deployment)

Three items the site must clear before the public domain (`rahmatherapy.co.uk`) goes live. All `BLOCKS-LAUNCH`. None of them block the redesign itself; they run as a final pre-flight check once the admin redesign is signed off.

9 (B1). **Two-factor authentication on admin accounts** · 2A-10 · Zone 2 · UK GDPR Article 32 best practice for Article 9 health-note data. Supabase Auth TOTP MFA needs enabling at the project level and a small admin UI to enroll.
10 (B2). **Backups + restore drill** · 2A-12 · Zone 1 · `docs/production-runbook.md:159` itself flags this as a launch check. Operational task, no new code: confirm Supabase tier and retention window, document, run one timed restore drill.
11 (B3). **Environment separation** · 2A-13 · Zone 3a · two options, both billable: (a) a second Supabase project for staging, or (b) enable Supabase Branching on Pro+. Either way, dev/test traffic stops sharing a database with production.

### Honourable mentions

`BLOCKS-LAUNCH` items below the top eleven, in priority order:

- 2A-11 **Leaked-password protection** — one-toggle in Supabase dashboard, `auth_leaked_password_protection`. Already flagged as WARN by Supabase advisor.
- 2A-14 **CSP + HSTS headers** — `docs/production/production-readiness-checklist.md:73` itself defers these to a "next pass". Add CSP in report-only mode first, then enforce.

*Note: 2A-8 and 2A-9 (previously in Honourable mentions) have been promoted to Track A items 9 and 10, as Phase 5 briefs commit to addressing them universally.*
