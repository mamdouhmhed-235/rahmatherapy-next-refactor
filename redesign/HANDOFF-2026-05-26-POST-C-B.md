# HANDOFF — Post-C-B (Band C Plan-Writing Phase Complete)

**Date written:** 2026-05-26
**Branch:** `master` (see §7 for branch context — there was a mid-session merge)
**HEAD at handoff:** `8b9ad1c`
**Predecessor handoff:** `redesign/HANDOFF-2026-05-25-POST-C-A.md` (Band C audit phase closure, 2026-05-25 → updated 2026-05-26 with C-B-DECISIONS lock)

**What this doc is:** the single self-contained context for the next session to pick up Band C C-C (implementation) work. Mirrors the precedent set by `HANDOFF-2026-05-25-POST-C-A.md`. **Open this first**, then drill into the linked sub-docs as needed.

**Programme status:** C-A ✅ + C-B ✅ + (D) decisions ✅ — **C-C implementation is now UNBLOCKED**.

---

## 0 — Opening template for the next session

When the next session opens, the opener should output (literal text):

> Loaded the post-C-B handoff. On `master` HEAD [SHA] clean. [N] commits ahead of origin/master. **All of C-B is complete — 21/21 plans (each with brief + plan).** `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` checklist shows C-B ✅ (original 12 + C-13 + C-14 added 2026-05-26; C-15 + C-16 + C-17 + C-18 + C-19 + C-20 + C-21 added 2026-07-16 during the plan-refinement phase). **C-C implementation is unblocked.** Pre-flight: [dev server status via curl, working tree status, any deviations from documented state]. Recommended C-C sequence per `C-B-DECISIONS.md` §5 + amendments: **C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-15 → C-13 → C-02 → C-09 → C-03 → C-07 → C-16 → C-10**, with **C-14 + the C-17/C-18 pair + C-19 + C-20 + C-21 independent** (C-14's Phase D customer date-picker fix, the GA+consent pair, C-19's privacy page, C-20's address autocomplete, and C-21's canonical-domain fix can each ship first as quick wins; break phases anytime; **C-18 co-ships with C-17**; **C-21 is a 1-commit defect fix worth shipping early**). C-04a + C-FIELDWORK are sequencing-critical (load-bearing for C-05 + C-11). C-15 ships after C-08 + before C-13/C-02. C-16 ships after C-09/C-07 + hard-before C-10. Awaiting user direction on which plan to ship first.

Then pause. Do not proceed without user direction.

---

## 1 — Programme location: where we are

**Band C arc:** comprehensive audit + 11 user-prioritised items + adjacent fixes.

Three phases:

- **C-A — Audit pass** ✅ **COMPLETE 2026-05-25** (40 audit files, 173 bugs catalogued).
- **(D) — Lock 11 C-B open questions** ✅ **COMPLETE 2026-05-26** (`C-B-DECISIONS.md` — 470 lines, all 11 answered).
- **C-B — Plan-writing** ✅ **COMPLETE 2026-05-26** (this handoff).
- **C-C — Implementation** ⏳ pending. **UNBLOCKED.**

---

## 2 — Canonical files to read in this order

1. **`redesign/HANDOFF-2026-05-26-POST-C-B.md`** — this document. Start here.
2. **`redesign/plans/C-phase/BAND-C-MASTER-PLAN.md`** — Part 0 operating discipline + Part 2 user items + master implementation checklist (C-B row now ✅; per-C-NN rows show brief+plan landed).
3. **`redesign/plans/C-phase/C-B-DECISIONS.md`** — source of truth for all 11 locked decisions. §3 per-plan scope is the bridge between decisions and plans. §5 recommended C-C order.
4. **The 12 briefs + plans** (per §3 below) — read when picking up a specific C-NN for implementation.
5. **`redesign/HANDOFF-2026-05-25-POST-C-A.md`** — the audit-phase handoff (background context; still authoritative for §6-§16).
6. **Specific audit files** (`redesign/audits/C-A/{NN}-{slug}-audit.md`, `W{NN}-*.md`, `R{NN}-*.md`) — only when a specific plan calls them out in its References section.

**Don't re-read every audit file proactively.** Each plan's §11 References + each brief's "Predecessors" list pin the audits that matter.

---

## 3 — The 13 C-B plans (all ✅ brief + plan written 2026-05-26 — C-13 added same day via post-handoff amendment)

Each row links the brief + plan + summarises scope + key decisions + sequencing.

### C-06 — Client CRUD hardening + destructive-overwrite fix + privacy honesty fold

- **Brief:** `redesign/briefs/C-06-client-crud-hardening-brief.md` (464 lines)
- **Plan:** `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md` (~690 lines)
- **Scope (AMENDED 2026-05-26):** **13 steps.** Original 11: kill destructive `on conflict (email) do update` in `create_booking_request` RPC + lift DuplicateWarningBanner into ManualBookingForm + new `/admin/clients/[clientId]/edit` route + `updateClient` action with email-collision check + Coord field-level gating via new `manage_client_identity_fields` permission + `deleteClient` shared primitive (soft-delete client, cascade open bookings, hard-delete sensitive notes) + Delete button + bulk-delete + privacy `deletion_review` Completed handler calls `deleteClient(gdpr_erasure)` + `data_export` Completed generates minimal JSON export. **+ Step 13 (amendment): optional email on the admin manual-booking flow** — migration drops `bookings.contact_email NOT NULL`; the RPC gains a null-email/phone-fallback client-match branch (email-first, phone-fallback); ManualBookingForm email made optional (admin-only); `sendConfirmationEmail` hidden when no email; reminder/review crons gain `contact_email IS NOT NULL` guard; booking detail shows "No email — reminders off" indicator. **Public flow unchanged + regression-tested.**
- **Migration:** Zone-2 — `clients.deleted_at` + `bookings.deleted_at` columns + **`bookings.contact_email DROP NOT NULL` (Step 13)** + 2 new permissions + RPC change (now with null-email branch) + role_permissions seed for Owner+Admin.
- **Cross-plan update needed:** C-02 flagged that `deleteClient` cascade must ALSO cancel active recurring templates for the client (since `recurring_booking_templates.client_id` has `ON DELETE RESTRICT`). Add this to the cascade.

### C-04a — Cancellation restore + delayed-email infra + row-level affordances + auto-promote + hygiene tail

- **Brief:** `redesign/briefs/C-04a-cancellation-restore-brief.md` (~860 lines after 2026-05-26 amendment)
- **Plan:** `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md` (~1300 lines after 2026-05-26 amendment)
- **Scope (AMENDED 2026-05-26):** **14 changes** across **8 phases (A–H)**. Original 9: Restore button + `restoreBooking` action + `sendBookingRestoredClientEmail` + state-machine guard + `no_show` quick action + auto-promote + 3 new audit/email types + hygiene tail. Amendment adds: row-level Restore (Change 10) + `quickUpdateBooking` restore case (Change 11) + status-aware row menu — cancelled rows show ONLY Restore (Change 12) + delayed-email infrastructure: new `email_delivery_events.scheduled_for` + 4 payload columns + new cron route `/api/cron/scheduled-emails` at `* * * * *` (Change 13) + Cancel-with-Undo toast 10s window (Change 14). Plus refinements: past-datetime restore disallow (S6 — stricter than C-05's date-only lockdown) + Restore modal shows prior cancellation reason (S3) + queued-email cancellation on undo path + **(S7 — 2026-07-16) 28-day restore window** keyed to the cancellation moment (new `bookings.cancelled_at` column + backfill; guard reads `cancelled_at ?? customer_cancelled_at`; unknown time = expired fail-closed; completed-reopen exempt; see §5.17).
- **Migration:** **Zone-2 required (amendment)** — `email_delivery_events.scheduled_for timestamptz` + `html_payload text` + `text_payload text` + `to_email text` + `subject text` + `idx_email_delivery_events_scheduled_pending` partial index + **(S7 2026-07-16) `bookings.cancelled_at timestamptz` + two-source backfill**. Plus verify `email_delivery_events.event_type` is unconstrained (it is, per C-08 finding).
- **Sequencing:** **MUST ship before or with C-05.** Restore button is load-bearing for C-05's lockdown. Change 13's cron route is **independent** from C-01's review-emails cron (different mechanism — scheduled-time vs status-trigger). Both crons live alongside in `wrangler.jsonc`. Row-level Restore (Change 10) becomes user-discoverable once C-05's N1 (filter fix) lands — soft co-ship preferred.

### C-05 — Lock cancelled / no_show / past-dated bookings inert + status-aware filter + strikethrough

- **Brief:** `redesign/briefs/C-05-cancelled-bookings-inert-brief.md` (~750 lines after 2026-05-26 amendment)
- **Plan:** `redesign/plans/C-phase/C-05-cancelled-bookings-inert-plan.md` (~860 lines after 2026-05-26 amendment)
- **Scope (AMENDED 2026-05-26):** **9 edit points** across **4 phases (A–D)**. Original 7: `ensureBookingActive` helper + server-action defense + 4 UI predicates + SQL `!inner` JOIN + past-date guard. Amendment adds: **Edit Point 8** — `filterBookings` becomes status-aware so the user-facing "Cancelled" status dropdown actually returns rows (per S1b: "Any status" stays active-only; explicit `status=cancelled` surfaces them; claimable stays unconditionally strict regardless). **Edit Point 9** — cancelled-row strikethrough rendering (`line-through decoration-[var(--admin-text-muted)] decoration-1` + `opacity-75`) on `/admin/bookings` row cards AND `/admin/clients/[id]` `BookingHistoryCard` (cross-surface consistency). New shared helper `src/app/admin/bookings/_helpers.ts` lifts `getTodayIsoDate` + `isBookingMomentPastLondon` (consumed by C-04a's S6 guard). Cross-page sweep (S9) documents: client history already correct, reports + calendar intentionally exclude cancelled. Tab-promotion DECLINED per audit (Q9.8). `updateOwnAssignmentStatus` still **explicitly NOT gated** (forensic edge case).
- **Migration:** None (pure code).
- **Sequencing:** Lands AFTER C-04a (Restore is the survival path). Edit Point 8 makes C-04a's Change 10 row-level Restore user-discoverable — soft co-ship preferred. 5-commit cadence (one extra commit for Phase D vs original 4).

### C-01 — Google review email 2h after completion

- **Brief:** `redesign/briefs/C-01-review-request-email-brief.md` (781 lines)
- **Plan:** `redesign/plans/C-phase/C-01-review-request-email-plan.md` (~745 lines)
- **Scope:** New columns `bookings.completed_at` + `bookings.review_email_sent_at` + status-trigger. Renderer + variant picker (3 of 5 random per email, `{city}` substitution, `services.group_category`-keyed pool). Send fn with sentinel-guard idempotency. New Cloudflare Worker cron (`*/15 * * * *`) — **NOT pg_cron** (decisions-doc deviation; see §5 below). New route `src/app/api/cron/review-emails/route.ts`. Quiet-hours guard (21:00-08:00 Europe/London). Templates UI integration. New audit type `review_email_sent`.
- **Migration:** Zone-2 — 2 new columns + status trigger + backfill (2 existing completed bookings + Owner test account marked "already handled" to suppress).
- **Sequencing:** Independent. Cloudflare cron infrastructure from this plan is the lift target for C-02's cron.

### C-FIELDWORK-EXPERIENCE — Capability-keyed fieldwork ergonomics

- **Brief:** `redesign/briefs/C-FIELDWORK-EXPERIENCE-brief.md` (590 lines)
- **Plan:** `redesign/plans/C-phase/C-FIELDWORK-EXPERIENCE-plan.md` (~715 lines)
- **Scope:** New `isViewerAssignedPractitioner(booking, viewerStaffId, viewerCanTakeBookings)` predicate. Booking-detail mobile sidebar reorder (sidebar above main panels at 375 for assigned practitioners). New `PractitionerTodaySection` drop-in component with hero "Next visit" card + tel/maps/Mark complete (temporal guard) + today list + claimable strip. New `RelativeTimeDisplay` client component (FOUC-safe relative time). `shared-helpers.ts` extracted from TherapistDashboard (`getGreeting`, `buildMapsHref`, etc.). Mount conditionally in all 3 dashboard variants.
- **Migration:** None (pure code).
- **Sequencing:** Ships BEFORE or WITH C-11 (C-11 consumes `PractitionerTodaySection`).
- **Discovery flag:** `tel:` + maps + `getGreeting` ALREADY EXIST — C-FIELDWORK lifts as canonical patterns rather than inventing.

### C-11 — Dashboard variants + design system + dark mode + motion-reduce

- **Brief:** `redesign/briefs/C-11-dashboard-variants-design-system-brief.md` (~680 lines after admin-wide clarification commit `d8806ec`)
- **Plan:** `redesign/plans/C-phase/C-11-dashboard-variants-design-system-plan.md` (~900 lines)
- **Scope:** Extract 3 variant files (BusinessDashboard.tsx NEW, CoordinatorDashboard.tsx NEW, TherapistDashboard.tsx refactor). Shared blocks library at `dashboard/blocks/` (~10 components — DashboardHeader, EmptyState, QuickHelpPanel, RevenueStripe, EnquiriesTodoStripe, ClaimQueueStripe, PendingBookingsStripe, ScheduleGapStripe, RecentActivityStripe, MobileStickyActionBar). page.tsx becomes thin variant router. **Dark mode applies admin-wide** (clarified post-write per user feedback — every page under `/admin/*`). CSS variable structure: `:root` = light default + `[data-theme="dark"]` = dark + `@media print` always light + `staff_profiles.theme_preference` column. ThemeProvider in admin layout + inline FOUC-mitigation script. Motion-reduce sweep across ~30 `animate-spin` instances. Hardcoded-color audit sweep (admin-wide). V-01 + B-01 + B-03 fixes folded into the variant extractions.
- **Migration:** Zone-2 — `staff_profiles.theme_preference text` with CHECK constraint.
- **Sequencing:** AFTER C-FIELDWORK ships (consumes its outputs).
- **Largest plan alongside C-02.** 11-commit cadence in C-C.

### C-08 — Email automation expansion

- **Brief:** `redesign/briefs/C-08-email-automation-expansion-brief.md` (amended 2026-07-16)
- **Plan:** `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md` (amended 2026-07-16)
- **Scope (AMENDED 2026-07-16):** **5 NEW templates** (booking_confirmed_client, staff_unassignment, claim, client_assigned_therapist, **enquiry_logged**) + 1 existing verification (staff_assignment templates-data.ts field-list audit) + per-row Resend tooling (`resendEmail` action + `dispatchResend` switch + 60s rate-limit + `metadata.resent_from_event_id` linkage) + **business-notification routing (new Phase D)**: `staff_profiles.notification_email` + `business_notification_prefs` (per-type alert toggles), `resolveBusinessNotificationRecipients` resolver replacing `getAdminRecipient` for all internal alerts (opted-in Owner/Admin, skip-self, zero-opt-in fallback), `/admin/me` Notifications section. Capability-keyed recipient resolution (any `can_take_bookings=true` practitioner). See §5.15.
- **Migration:** **Zone-2 now definite (was conditional)** — 2 staff_profiles columns + Owner opt-in seed + conditional `email_delivery_events.metadata jsonb`. **No CHECK constraint extension needed** — verified `event_type` is free-text.
- **Reframe note:** Decisions doc Q7 said "5 new templates"; the 2026-05-26 write reframed to 4 new + 1 existing-verify (`staff_assignment` already exists); the 2026-07-16 `enquiry_logged` addition restores the count to 5.

### C-02 — Recurring / standing bookings

- **Brief:** `redesign/briefs/C-02-recurring-bookings-brief.md` (823 lines)
- **Plan:** `redesign/plans/C-phase/C-02-recurring-bookings-plan.md` (~900 lines)
- **Scope:** Largest plan alongside C-11. Fully greenfield. NEW table `recurring_booking_templates` + `bookings.recurring_template_id` FK + `services.allow_recurrence` flag + `create_recurring_booking_series` RPC + `compute_occurrence_dates` helper. Cadences: weekly/fortnightly/monthly (NO Hijri/Sunnah). End-conditions: until_cancelled / after_count / until_date. Hybrid 12-week generation + nightly Cloudflare Worker cron `extend-recurring-horizons` at `0 3 * * *`. New RecurringSection in ManualBookingForm step 4. NEW route `/admin/bookings/series/[templateId]` with Cancel series + Edit series (limited fields). New email `recurring_series_created_client`. Calendar badge + Series filter chip on bookings list. Per-service `allow_recurrence` toggle on services edit.
- **Migration:** Zone-2 — table + FK + service column + 2 RPCs.
- **Cross-plan update:** **C-06's `deleteClient` cascade must cancel active recurring templates first** (FK is `ON DELETE RESTRICT`). C-06 plan amendment needed.

### C-09 — Cache invalidation (tag-based) + filter-FAKE cleanup

- **Brief:** `redesign/briefs/C-09-cache-invalidation-filter-cleanup-brief.md` (456 lines)
- **Plan:** `redesign/plans/C-phase/C-09-cache-invalidation-filter-cleanup-plan.md` (~705 lines)
- **Scope:** New `src/lib/cache/tag-taxonomy.ts` with 7 resource tags (`clients`, `bookings`, `staff`, `enquiries`, `settings`, `audit`, `emails`) + audience map. Add tags to ~10 mutation action files. Extend 3 existing `unstable_cache` wraps (performance-data, dashboard-data, reports-data) + introduce ~13 new data helpers extracted from inline page.tsx queries. Filter-query FAKE cleanup at 5 surfaces (enquiries / staff list / operations / emails / privacy — actual count ~16 markers, not ~10 as decisions doc estimated). C-12+ FAKE inventory docs deliverable for non-filter FAKEs.
- **Migration:** None.
- **Sequencing:** Ships ninth so the tag sweep covers all prior plans' new server actions in one pass.

### C-03 — Enquiry → booking conversion (narrow polish + bug bundle)

- **Brief:** `redesign/briefs/C-03-enquiry-to-booking-conversion-brief.md` (587 lines)
- **Plan:** `redesign/plans/C-phase/C-03-enquiry-to-booking-conversion-plan.md` (~675 lines)
- **Scope:** 8-item bundle. Service fuzzy-match (HEADLINE — pre-select package from `service_interest` text). B-104 toast copy fix. B-106 re-conversion guard (redirect). B-107 graceful-catch (enquiry-update failure no longer cascades). B-108 booking → enquiry reverse-link via reverse-lookup query (no schema change). W01-E-2 sessionStorage scoped key. W01-V-1 Cancel routing. B-157 just-converted toast on detail.
- **Migration:** Conditional 1-line index migration if `idx_enquiries_converted_booking` is missing.
- **Sequencing:** Independent.

### C-07 — Cross-page routing + per-role defaults

- **Brief:** `redesign/briefs/C-07-routing-and-per-role-defaults-brief.md` (565 lines)
- **Plan:** `redesign/plans/C-phase/C-07-routing-and-per-role-defaults-plan.md` (~850 lines)
- **Scope:** 13 items across two phases. Phase A (routing primitives): B-134 consolidate 3 duplicate `?clientId=` CTAs + B-140 `/admin/me` Quick links + W05-V-2 booking → staff link + W02-V-2 just_created toast + W02-E-1 city inline validation + W08-V-1 "Personal" → "Mine" terminology + B-170 TherapistDashboard "Open to claim" 7-day filter + customer manage footer. Phase B (per-role defaults): B-139 dashboard scope toggle (DashboardScopeToggle component) + B-154 Yesterday chip + B-155 dual date sync + B-161 saved filters bar (localStorage v1) + B-167 per-role default tab (Therapist → Today).
- **Migration:** None.
- **Scope absorption note:** B-108 + W01-V-1 + B-157 were originally in C-07 master-plan scope but absorbed by C-03's bundle.

### C-10 — Bottom-spacing / footer overlap fix

- **Brief:** `redesign/briefs/C-10-bottom-spacing-footer-overlap-brief.md` (354 lines)
- **Plan:** `redesign/plans/C-phase/C-10-bottom-spacing-footer-overlap-plan.md` (~360 lines)
- **Scope:** Smallest C-B plan. Two-phase discovery + remediation. Phase A: Playwright walk at 375 + 768 + 1280 across every admin surface; verification snippet captures breathing room between content bottom and fixed mobile nav top. Output: `c-10-overlap-catalogue.md`. Phase B: remediate per catalogued entry via one of four fix patterns (wrap with AdminPageScaffold / raise sticky save bar to bottom-14 / fix local pb override / document nested-scaffold).
- **Migration:** None.
- **Sequencing:** Ships LAST so it catalogues new routes from C-06 + C-02 + C-13 alongside existing surfaces.

### C-13 — Group-booking surface + gender-clarity chips + composite identity

- **Brief:** `redesign/briefs/C-13-group-bookings-and-gender-clarity-brief.md` (~530 lines — NEW 2026-05-26 post-handoff)
- **Plan:** `redesign/plans/C-phase/C-13-group-bookings-and-gender-clarity-plan.md` (~750 lines — NEW 2026-05-26 post-handoff)
- **Scope:** 7 changes across 8 phases (A–H). Gender-clarity chips (replace generic `"Same-gender required"` with per-participant phrasing: `"Needs female therapist"` / `"Needs 2 female + 1 male"`). Group cards become first-class on `/admin/bookings` list — nested per-participant sub-rows + Users icon + group tint (option c). Composite identity (`"Aisha Khan + 2 others"`) on row headlines, detail page, browser title, calendar tooltips. Per-participant assignment progress (`"1 of 3 therapists assigned"`). Calendar tile gets Users icon + Group chip + composite-identity tooltip. Email templates (`staff_assignment`, `staff_claim`, `booking_confirmed_client`) gain conditional group-context block. `BookingCard` extracted as shared component — consumed by C-11 + C-FIELDWORK.
- **Migration:** None. Zero new permissions, zero new server actions. Pure UI render work.
- **Sequencing:** Soft-coupled to **C-FIELDWORK** (consume its card pattern), **C-08** (templates exist before extending), **C-11** (shared blocks adopt BookingCard), **C-05** (cancelled-row strikethrough class-composition preserved). Hard dependency: none.

### C-14 — Granular working hours (breaks) + customer booking-window date guard

- **Brief:** `redesign/briefs/C-14-granular-working-hours-breaks-brief.md` (~560 lines — NEW 2026-05-26 post-handoff)
- **Plan:** `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md` (~430 lines — NEW 2026-05-26 post-handoff)
- **Scope:** 4 phases. Working hours gain breaks (opens / break(s) / closes) across **global recurring** (`availability_rules`), **per-staff recurring** (`staff_availability_rules` — rides the existing use_global/custom toggle), and **per-date overrides** (`availability_overrides` + `staff_availability_overrides`). Plus a **customer booking-window date-picker guard** (Phase D): `DatePickerField` disables dates beyond `booking_window_days` + before the `minimum_notice_hours` floor, sharing window math with the server via a new `getBookingDateBounds` helper.
- **Storage model:** **segments — no new tables.** A break is the gap between bookable segment rows. Verified: recurring tables have no day-uniqueness + the slot engine already handles multiple windows per day → **zero schema + zero engine change for the recurring phases (A/B)**.
- **Migration:** Phase C only — drop `availability_overrides_override_date_key` unique (+ verify/drop staff-override equivalent). Phases A/B/D: none.
- **Engine touch:** `availability.ts` (RECON-sensitive) only in Phase C (widen global override fetch `.maybeSingle()` → array) + Phase D (refactor `isDateInBusinessWindow` to the shared helper). Recurring phases don't touch it.
- **Customer rule:** breaks hidden (no slots across a break). Admin picker stays unbounded.
- **Sequencing:** independent of the other 13 plans. Phase D ships first (customer win); A→B→C in order (C is highest-risk — schema + engine).

### C-15 — Email template studio (NEW 2026-07-16, plan-refinement phase)

- **Brief:** `redesign/briefs/C-15-email-template-studio-brief.md` (NEW 2026-07-16)
- **Plan:** `redesign/plans/C-phase/C-15-email-template-studio-plan.md` (NEW 2026-07-16)
- **Scope:** replaces the Templates-tab editing experience end-to-end (user verdict 2026-07-16 supersedes audit PE-51's "exemplary"): registry expansion (per-field `defaultValue` + editable subjects + renderer copy-lift + token catalogue + fixed-part legend), template gallery with Default/Customised badges, full-page editor at `/admin/emails/templates/[id]` with **chip-token variable insertion** (no hand-typed `{codes}`), **live draft preview** (POST draft → real render fns + sample data, debounced, pre-save), one-click per-template **Reset to default** + per-field Use-default, **"Send me a test"** to the actor's notification email. Retires ManualSendSheet + 4 old editor components; removes 3 non-filter FAKE markers.
- **Migration:** None (subject + new fields are new `field_key` values in the existing `email_template_overrides` table).
- **Load-bearing gate:** render-parity spec — zero-override output byte-identical before/after the copy-lift; pre-flight SQL capture of override rows diffed post-ship.
- **Sequencing:** after C-08 (its 5 templates + notification_email column land first); before C-13 + C-02 (their template work lands inside the studio; both plans carry compatibility notes). 6 phases / 7 commits.

### C-16 — Data growth: pagination standard + bounded lists (NEW 2026-07-16, plan-refinement phase)

- **Brief:** `redesign/briefs/C-16-data-growth-pagination-brief.md` (NEW 2026-07-16)
- **Plan:** `redesign/plans/C-phase/C-16-data-growth-pagination-plan.md` (NEW 2026-07-16)
- **Scope:** every admin list survives 5 years of data. Audit facts: bookings list fetches EVERY row with no limit then filters in memory (perf cliff + endless scroll); clients/enquiries unbounded; emails/privacy/operations silently hard-capped with no pager; audit log is the house reference (cursor, 100/page). Phases: inventory (every surface classified, user checkpoint) → shared `PaginationBar` + helpers (URL-driven, 25/page lists, 100/page logs, cursor mode for log-scale) → bookings/clients/enquiries to server-side pagination (bookings view-predicates→SQL gated by a parity spec against `filterBookings`) → cap→pager conversions → structure (not pagination) for static-long lists incl. the roles page (user's named example). **Standing Part 0 rule added: no unbounded list queries.** Verification via temporary page-size-3 override — no production seeding.
- **Migration:** None (index suggestions flag-only).
- **Sequencing:** after C-09 (pagination-ready helpers) + C-05 (final `filterBookings` shape) + C-07; **hard-before C-10** (page heights change; C-10 pre-flight now stops if C-16 absent). 5 phases / 8 commits.

### C-17 — Google Analytics (GA4) on customer pages (NEW 2026-07-16, plan-refinement phase)

- **Brief:** `redesign/briefs/C-17-google-analytics-brief.md` (NEW 2026-07-16)
- **Plan:** `redesign/plans/C-phase/C-17-google-analytics-plan.md` (NEW 2026-07-16)
- **Scope:** GA4 tag `G-WM8BCYG060` on customer surfaces only — env-gated `GoogleAnalytics` component (`next/script` `afterInteractive`; renders nothing outside production, so dev + Playwright never pollute analytics) mounted in `(public)/layout.tsx` + a thin new `booking/layout.tsx`; **admin never tracked** (gate asserts script absent from admin HTML). Phase B: one fire-once `booking_request_submitted` conversion event on the booking success screen (`PreparedStep`), zero PII. No new packages; zero migrations; one Cloudflare env var (build-time inlining verified).
- **Consent:** C-18 written same day — rewrites this component into the consent-gated loader; **co-ship the pair**.
- **Sequencing:** the C-17+C-18 pair is fully independent (like C-14); ships anytime. Branch confirmed with user at impl (public layouts diverge ~9 lines from the frontend line). 2 phases / 3 commits.

### C-18 — Cookie consent & PECR compliance (NEW 2026-07-16, plan-refinement phase)

- **Brief:** `redesign/briefs/C-18-cookie-consent-brief.md` (NEW 2026-07-16 — §1 carries the verified legal table)
- **Plan:** `redesign/plans/C-phase/C-18-cookie-consent-plan.md` (NEW 2026-07-16)
- **Scope:** in-house consent layer meeting the user's 9 requirements against the verified July-2026 legal state (DUAA statistics exception in force but GA4 fails it → opt-in still required; ICO final guidance Apr 2026). Registry-driven single source (`cookie-registry.ts` → banner toggles + panel table + new `/cookies` page); **basic Consent Mode v2** (default-denied all four params; gtag not injected until granted — the regulator test: zero pre-consent Google requests); banner in the `--rahma-*` public design language (Accept/Reject parity by construction, no pre-ticks, no cookie wall, responsive, reduced-motion, focus-trapped panel); **consent proof** via new `consent_events` table (timestamped pseudonymous log — version/options/choice/withdrawals, no PII); footer "Cookie settings" withdrawal (deletes `_ga*`, logs `withdrawn`, reloads); 6-month + version-bump re-prompts.
- **Migration:** one additive Zone-2 — `consent_events` + RLS deny-all (service-role route writes only).
- **Standing rule added to master plan Part 0:** cookie/tag registry discipline — every future tag gets a registry entry + version bump + loads through the consent gate.
- **Sequencing:** hard pair with C-17 (rewrites its component; co-ship). 7 phases / 7 commits. **Flagged, not scoped:** no privacy policy page exists (UK GDPR Art 13) — covered by C-19 (added later the same day).

### C-19 — Privacy policy page (NEW 2026-07-16, plan-refinement phase)

- **Brief:** `redesign/briefs/C-19-privacy-policy-page-brief.md` (NEW 2026-07-16)
- **Plan:** `redesign/plans/C-phase/C-19-privacy-policy-page-plan.md` (NEW 2026-07-16)
- **Scope (deliberately minimal — user-locked):** ONE new file, `src/app/(public)/privacy/page.tsx`, public design language, plain English, custom to the audited data flows (booking fields incl. health notes, named processors, concrete retention, rights, ICO contact, last-updated). **No edits to any other page** — booking-form/footer linking left for later. No migrations, no packages. Backed by the 2026-07-16 legal research (Art 13 checklist; explicit-consent route for health notes; ICO Tier-1 fee flagged as a business action, not code).
- **Sequencing:** fully independent; ships anytime; 1 commit.

### C-20 — Address autocomplete on both booking forms (NEW 2026-07-16, plan-refinement phase)

- **Brief:** `redesign/briefs/C-20-address-autocomplete-brief.md` (NEW 2026-07-16)
- **Plan:** `redesign/plans/C-phase/C-20-address-autocomplete-plan.md` (NEW 2026-07-16)
- **Scope:** Google Places autocomplete on the admin create-booking form + the customer booking form. One shared form-library-agnostic `AddressAutocompleteField` (customer binds via react-hook-form, admin via useState — both apply a parsed `AddressParts`). **Load-bearing detail:** the customer side applies `city` with `shouldValidate` so the covered-area notice re-evaluates. Deliberate deviations from the user's reference snippet: `next/script` lazy-load on first focus (not the CDN component library), env-var key, **UK component mapping** (`postal_town`→city, `administrative_area_level_2`→area), no `window.alert`. Plus UK-only address suggestions, Places session tokens, and a tested plain-input fallback when the key/script is unavailable.
- **Migration:** none; no new package. One env var (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, build-time inlined).
- **Blocking sign-off:** Cloud Console key restriction (referrers + APIs) + rotation decision (key was shared in plaintext during planning); C-18 registry entry + consent classification (functional-on-interaction recommended).
- **Sequencing:** independent; touches `ManualBookingForm.tsx` (shared with C-06 Step 13 / C-02 Phase E — different regions) and `LocationDetailsStep.tsx`. 4 phases / 5 commits.
- **Cost amendment 2026-07-16 (verified research):** Essentials fields ONLY (`address_components` + `geometry`) — **never `name`/`displayName`**, which the reference snippet includes and which would halve the free allowance (10,000→5,000/mo) and triple unit price ($5→$17/1,000); ~300 ms debounce because abandoned sessions bill per request; billing account with card mandatory even for free use; budgets only email and Maps quotas are per-minute, so the referrer restriction is the real cost control; post-deploy Metrics check must confirm usage sits inside the free allowance itself (the 90-day $300 trial credit can mask overage).

### C-21 — Canonical domain fix (NEW 2026-07-16, plan-refinement phase)

- **Brief:** `redesign/briefs/C-21-canonical-domain-fix-brief.md` (NEW 2026-07-16)
- **Plan:** `redesign/plans/C-phase/C-21-canonical-domain-fix-plan.md` (NEW 2026-07-16)
- **Defect:** the live domain `rahmatherapy.uk` appears **nowhere in the codebase**; two wrong domains are hard-coded instead — `rahmatherapy.co.uk` (12 refs, incl. `layout.tsx:9` `metadataBase` which builds every canonical + OG image URL, plus structured data on about/services/reviews/faqs) and `rahmatherapy.com` (8 refs, incl. **`home/page.tsx:24` homepage JSON-LD**; the other 7 are admin placeholders). Root cause: no single source of truth for the site URL.
- **Fix:** `SITE_URL` constant in `src/content/site/`, every absolute URL derived from it, value corrected, conditional contact-email change (**user confirms whether the `.co.uk` mailbox is real — never break a working address**), cosmetic sweep, and an **anti-drift test** asserting zero wrong-domain literals in `src/`. Verification is rendered-output-based (curl canonical/OG/JSON-LD on all 6 public pages).
- **Migration:** none. No visual change. 1 commit. **Ship early** — wrong canonicals compound while indexed.
- **Flagged, not scoped:** no `sitemap.ts` / `robots.ts` exists.

---

## 4 — Architecture deliverables embedded in briefs + plans (lift directly into C-C)

Each plan's body is largely self-contained execution detail. Pre-flight checks + Phase-by-Phase implementation steps + Verification gate are concrete. Notable lift targets:

| Plan | Key lift target / pattern |
|---|---|
| C-06 | W06 §10 — destructive-overwrite fix architecture. Verbatim. |
| C-04a | Email-send pattern from `sendBookingCancellationEmails` (notifications.ts:385). |
| C-05 | `ensureBookingActive` helper full code in plan §1 Step 1. |
| C-01 | Cron route mirrors `src/app/api/cron/booking-reminders/route.ts`. Worker entrypoint dispatch pattern. |
| C-FIELDWORK | Shared-helpers extraction from TherapistDashboard.tsx:89-130 + 1361. |
| C-11 | Dashboard variant routing pattern in page.tsx (line 633 early-return). CSS variable structure detailed in plan §1 Step 11. |
| C-08 | Existing template + send-fn pattern (`notifications.ts:341-429`). |
| C-02 | `create_recurring_booking_series` RPC sketch + `compute_occurrence_dates` helper full code in plan §1 Step 1. |
| C-09 | `tag-taxonomy.ts` full code in plan §1 Step 1. Per-mutation matrix in brief §2.2. |
| C-03 | `service-fuzzy-match.ts` full helper code in plan §1 Step 2. |
| C-07 | DashboardScopeToggle + SavedFiltersBar component sketches in plan §1. |
| C-10 | Verification snippet for Playwright catalogue (plan §1 Step 1). |
| C-13 | `composeGenderRequirementChip` + `composeBookingIdentity` helpers (plan §1 Phase A Step 1 + Phase C Step 8). `GroupBookingCard` nested-layout JSX (plan §1 Phase B Step 6). `renderGroupContextBlockHtml` template fragment (plan §1 Phase G Step 16). |
| C-14 | `working-hours-segments.ts` (`rowsToSchedule`/`scheduleToRows`/`validateSchedule`) + `date-bounds.ts` (`getBookingDateBounds`) + `WorkingHoursDayEditor.tsx` (plan §2). Segments model means recurring phases need zero engine change (verified `availability.ts:144-222`). |

---

## 5 — Critical discoveries during plan-writing (deviations from decisions doc / new findings)

These are the things the next session needs to know that weren't in the decisions doc:

### 5.1 C-01: pg_cron is NOT installed (decisions-doc deviation)

C-B-DECISIONS Q4 said "pg_cron polling every 15 min". Verified via `mcp__supabase__execute_sql`: `pg_cron` extension does not exist. **Plan switched to Cloudflare Workers cron** (existing project pattern at `worker-entrypoint.ts` + `wrangler.jsonc` + `src/app/api/cron/booking-reminders/route.ts`). Cadence (15 min) preserved.

### 5.2 C-08: `staff_assignment` template already exists

Decisions doc Q7 said "5 new templates"; code inspection confirmed `staff_assignment` already shipped (renderer + send-fn + SUBJECTS + templates-data + 4 prod sends). Actual scope: **4 NEW + 1 existing verification**.

### 5.3 C-11: Dark mode is fully greenfield + admin-wide

No `dark:` / `data-theme` / `useTheme` / `ThemeProvider` exists in `src/`. CSS structure post-clarification: `:root` = light default + `[data-theme="dark"]` = dark + `@media print` = always light. **Admin-wide** (every `/admin/*` page), NOT dashboard-only. Public site (`/booking/*`) stays unchanged.

### 5.4 C-FIELDWORK: tel: + maps + getGreeting all already exist

`BookingDetailSidebar.tsx:142-147` has `tel:` with `min-h-11`. `:278-288` has Google Maps deep link. `TherapistDashboard.tsx:89-130 + :1361` has `getGreeting()` + `buildAddressLines` + `buildMapsHref`. C-FIELDWORK lifts as canonical patterns rather than inventing.

### 5.5 C-09: Filter-FAKE actual count ~16, not ~10

Decisions doc estimated `~10 filter-query FAKEs`; actual grep count is **~16** across 5 surfaces (operations alone has 6, not the 3 the decisions doc said).

### 5.6 Email-event-type CHECK constraint absence

C-04a, C-01, C-08 all pre-flighted whether `email_delivery_events.event_type` is CHECK-constrained. **It is not** (only `delivery_status` has a CHECK). No migration needed for any new event_type values across C-04a / C-01 / C-08 / C-02.

### 5.7 C-04a: RECON §5 untouchable exception for reporting.ts:438

The `||` → `??` one-char fix in `reporting.ts:438` is explicitly approved per C-B-DECISIONS Q8 as an exception to the RECON §5 untouchable status for core exports. Tax-compliance-correct fix.

### 5.8 C-02: cross-plan update needed for C-06

`recurring_booking_templates.client_id` has `ON DELETE RESTRICT`. C-06's `deleteClient` cascade currently doesn't handle this. **C-06 plan needs an amendment** before C-02 lands: deleteClient must cancel active recurring templates as part of the cascade. C-02 plan §4.2 + §8 documents.

### 5.9 C-05: predicate inclusion of completed/no_show assignment statuses

Brief Q9.2 originally said "exclude completed"; plan §1 Step 1 revised to **include completed + no_show** in the `isViewerAssignedPractitioner` predicate. Rationale: retrospective viewing of own work needs phone+address access. Code comment documents.

### 5.10 C-06: Coord delete posture locked

Decisions doc was silent on Coord delete. Brief locked **Owner + Admin only** for delete via new `manage_client_destructive_ops` permission. Coord can edit operational fields (per Q6) but not delete.

### 5.11 C-04a + C-05 amendment bundle (2026-05-26 post-handoff edit)

Following user direction on a cancelled-booking ease+restore bundle, both C-04a and C-05 briefs + plans were amended on the same day this handoff was written. Net changes:

**C-04a (9 → 14 changes):**
- **N2 → Change 10:** Row-level Restore action on bookings list (extends `BookingRowAction` union).
- **N3 → Change 11:** `quickUpdateBooking` gains `restore` case (delegates to `restoreBooking`).
- **N4 → Change 12:** Status-aware row menu — cancelled rows show only Restore.
- **S5 → Change 13:** Delayed-email infrastructure — `email_delivery_events.scheduled_for` column (Zone-2 migration) + 4 payload columns + new `* * * * *` cron route `/api/cron/scheduled-emails`. **Independent from C-01's review-emails cron** — different mechanism (scheduled-time vs status-trigger).
- **S5 → Change 14:** Cancel-with-Undo toast with 10s window; cancellation email is queued via Change 13 infra, undo cancels the queued row.
- **S3 (refinement to Change 2):** Restore confirm modal surfaces prior `customer_cancellation_note` or audit-log cancel actor/date for context.
- **S6 (refinement to Change 1 + Change 2):** Past-datetime cancelled bookings unrestorable. Restore button hidden in detail page + row menu; server action returns structured error. **Stricter than C-05's date-only lockdown** — cutoff is `now() > booking_date + start_time` (Europe/London). Coexists with C-05's `booking_date < today` cutoff for different purposes.

**C-05 (7 → 9 edit points):**
- **N1 → Edit Point 8:** `filterBookings` refactored to be status-aware. The user-reported bug — "Cancelled" status dropdown returns no rows — is fixed. Per S1b: "Any status" stays active-only; explicit `status=cancelled` surfaces cancelled rows on attention/today/upcoming/etc.; claimable stays unconditionally strict (C-05 invariant preserved).
- **S2 → Edit Point 9:** Cancelled-row strikethrough rendering on bookings list + client-detail BookingHistoryCard. `line-through decoration-1 decoration-[var(--admin-text-muted)]` + `opacity-75`. Status badge + action button stay normal.
- **S9 (doc-only):** Cross-page sweep verified — client booking history already shows cancelled rows correctly; reports + calendar intentionally exclude (audit-confirmed W04-PE-2 + #09).
- **Q9.8 (declined):** Cancelled/No-show tab stays under "More" overflow rather than being promoted to top-level — verified via audit of `BookingsChrome.tsx:40-50` chrome structure. Top tier is forward-looking action surfaces; cancelled fits archive grouping with Completed.

**Shared helper:** new `src/app/admin/bookings/_helpers.ts` exports `getTodayIsoDate` + `isBookingMomentPastLondon` + `computeBookingMomentLondon` (+ optional `inertRowClassNames`). Consumed by both plans — single source.

**Coordination:** C-04a's Change 10 row-level Restore is only user-discoverable once C-05's Edit Point 8 makes cancelled rows visible on the list. Soft co-ship preferred. Hard sequencing (C-04a before/with C-05) unchanged.

**Cron coordination:** C-04a's Change 13 introduces a second Cloudflare Workers cron (`* * * * *`) alongside C-01's `*/15 * * * *` review-emails cron. Both register in `wrangler.jsonc` + `worker-entrypoint.ts`. Independent mechanisms; no shared state. C-12+ could unify into a single scheduled-send abstraction if a pattern emerges.

**Bundle impact:** C-04a ceiling raised +5 kB → +7 kB. C-05 ceiling raised +2 kB → +3 kB.

### 5.12 C-13 added as a 13th plan (2026-05-26 post-handoff)

Following user direction on the cancelled-booking amendment bundle (§5.11), a second user-direction session 2026-05-26 surfaced a related but distinct UX gap: **group bookings + gender-required bookings render with generic, information-thin chips that lose actionable detail**. Audit verified the data model is already correct (per-participant `booking_participants` rows + per-participant `booking_assignments`, claim/assign already per-participant gender-matched). The fix is **pure UI render work** across 4 surfaces (list, detail, dashboard, calendar) + 3 email templates.

**C-13 created** as a 13th plan (master plan checklist now lists 13/13 ✅). Briefs/plans landed at:
- `redesign/briefs/C-13-group-bookings-and-gender-clarity-brief.md`
- `redesign/plans/C-phase/C-13-group-bookings-and-gender-clarity-plan.md`

**7 changes / 8 phases (A–H):**
1. **Gender-clarity chip helper** (`composeGenderRequirementChip`) replacing generic `"Same-gender required"` with per-participant phrasing.
2. **Group cards as first-class** — option (c) nested layout with per-participant sub-rows on `/admin/bookings` list rows. New shared component `BookingCard.tsx`.
3. **Composite identity helper** (`composeBookingIdentity`) — `"{main_contact} + {N} others"`.
4. **Per-participant assignment progress** — `"1 of 3 therapists assigned"` for groups.
5. **Calendar surface treatment** — Users icon + Group chip + composite identity tooltip on event tiles.
6. **Booking detail refinement** — header composite identity; remove redundant "Group booking" badge; ParticipantCard chip refactor.
7. **Email templates with group context block** — extended `staff_assignment`, `staff_claim` (C-08), `booking_confirmed_client` (C-08) with conditional group-context section.

**Zero migrations, zero new permissions, zero new server actions.** No backend changes. The data model has been correct all along; the UI just rendered it generically.

**Shared helpers:** `_helpers.ts` (created by C-04a/C-05 amendments per §5.11) gains two more pure functions — `composeGenderRequirementChip` + `composeBookingIdentity`. Single source.

**Sequencing:** C-13 inserts between **C-08** and **C-02** in the recommended order. Soft-coupled to C-FIELDWORK (consume canonical card shape), C-08 (templates exist before extending), C-11 (shared blocks library adopts `BookingCard`), C-05 (cancelled-row strikethrough class-composition preserved on the extracted card).

**Bundle impact:** +5 kB across `/admin/bookings/*` + `/admin/calendar/*`.

**Cross-plan coordination:**
- **C-FIELDWORK:** its `PractitionerTodaySection` renders booking cards. C-13's `BookingCard` is the canonical shape; coordinate at impl time so both consume the same component.
- **C-08:** introduces `staff_claim` + `booking_confirmed_client` templates. C-13's Phase G plugs the group-context block into these renderers — ship C-08 first to avoid double-touching template renderer files.
- **C-11:** shared blocks library at `dashboard/blocks/` adopts `BookingCard` as its booking-row primitive. C-13 ships first so C-11 imports rather than reinvents.
- **C-05:** `isInertRow` class composition (Edit Point 9) applies on the outer `BookingCard` wrapper; sub-rows inherit naturally via CSS cascade.
- **C-02:** future recurring-group bookings render with the same group card (data model supports recurring + group composition).

### 5.13 C-06 amended — optional email on the admin booking flow (2026-05-26 post-handoff, Step 13)

User direction: email shouldn't be mandatory on the admin create-booking flow (`/admin/bookings/new`) — the next step should be reachable and the booking creatable with phone only. Audit verified the entanglement:

- **`bookings.contact_email` is `NOT NULL`** (verified) → requires a migration to drop the constraint.
- **`clients.email` has a `UNIQUE` constraint** (`clients_email_key`) → a missing email must be stored as `NULL` (multiple NULLs allowed), never `''` (would collide).
- **The admin flow shares the `create_booking_request` RPC** (via `createBookingTransaction.ts:113`) with the **public** booking flow (`POST /api/bookings`) — the same RPC C-06 already rewrites in Step 1.

**Routed into C-06** (avoids a second plan touching the same RPC + migration — the duplication the user explicitly wanted avoided). Added as **Step 13**:
- Migration: `ALTER TABLE bookings ALTER COLUMN contact_email DROP NOT NULL` (folded into C-06's existing Step 12 migration).
- RPC: third client-resolution branch — when email is absent, **phone is the dedup key** (email-first, phone-fallback per user decision). Phone match raises the same `duplicate_client_exists` warning (anti-silent-merge); no match → insert client with `email = NULL`.
- `ManualBookingForm` (admin-only): email field loses `required`; format-only validation; relaxed Step-1 gate; `sendConfirmationEmail` checkbox hidden when no email. Phone stays required (user-locked).
- `createManualBooking` Zod: email optional.
- Downstream: `sendBookingCreatedEmails` + reminder cron + (future) C-01 review cron gain `contact_email IS NOT NULL` guards. Booking detail shows a "No email — reminders off" indicator linking to the client edit route (re-enablement path).

**Isolation (critical user requirement):** the **public booking flow is NOT touched.** `route.ts` keeps its own `email: z.email()` Zod; email stays required on the public site. The RPC change is purely permissive (allows null; the email-present path is unchanged), and the public flow always sends a validated email so it never exercises the new branch. A regression test (verification gate mutation-test `o`) asserts a missing-email `POST /api/bookings` returns 400 — proving isolation.

**Re-enablement:** adding an email later via C-06's own client edit route (Step 5) re-enables emails for future bookings. Coherent within the one plan.

**Numbering note:** the C-06 plan's migration is "Step 12"; the email-optional code is "Step 13" (Phase F), landing after the migration so the DB is ready first. Two pre-existing "Step 11 migration" references in the plan (steps 2-3) were corrected to "Step 12" while amending.

### 5.14 C-14 added — granular working hours (breaks) + customer booking-window guard (2026-05-26 post-handoff)

User direction: working hours should support breaks (opens / break(s) / closes) for all days going forward — and the customer date picker should disable dates beyond the advance-booking window. Audit findings drove the design:

- **All four availability tables mapped:** `availability_rules` + `staff_availability_rules` (recurring, **PK-only — no day-uniqueness**, so multiple rows per day already allowed); `availability_overrides` (global, **UNIQUE on override_date**) + `staff_availability_overrides` (staff, has `override_type`); `blocked_dates` + `staff_blocked_dates` (full-day closures).
- **Slot engine already multi-window:** `getRuleWindowsForDay` returns an array; `containsWindow` books only slots fitting one window. A break = the gap between segment rows → falls out for free.
- **Booking-window picker bug:** `DatePickerField.tsx:26` disables `before: today` only — no upper bound. The server already rejects out-of-window dates (`isDateInBusinessWindow`), so it's purely a client UX gap.

**Created C-14** (14th plan; master plan now 14/14). Design recommendation **flipped from the earlier breaks-table idea to a segments model** because the scope expanded to 4 surfaces — segments reuse the existing tables + the multi-window engine uniformly, with zero new tables and zero recurring-engine change. Briefs/plans at `redesign/briefs/C-14-granular-working-hours-breaks-brief.md` + `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md`.

**4 phases:**
- **A — global recurring breaks** (`availability_rules`): segments; zero schema/engine change. New `WorkingHoursDayEditor` + `working-hours-segments.ts` conversion helper; save action → delete-day + insert-segments (atomic, prefer RPC).
- **B — per-staff recurring breaks** (`staff_availability_rules`): same; rides the existing `use_global`/`custom` mode toggle.
- **C — override breaks** (global + staff): **only schema + engine change.** Drop `availability_overrides_override_date_key` unique (+ verify staff equivalent); widen the global override fetch (`availability.ts:488` `.maybeSingle()` → array); verify staff-override multi-row handling in `resolveStaffWindows`.
- **D — customer date-picker guard** (independent, ship first): `DatePickerField` gains `after: latest` + notice-aware `before: earliest`; new `getBookingDateBounds` helper shared with the server's `isDateInBusinessWindow` so the clickable range and accepted range can't drift. Admin picker stays unbounded.

**Decisions locked (user):** (1) breaks global-primary but per-staff custom-capable — satisfied by the existing mode toggle; (2) breaks on overrides too; (3) breaks hidden from customers (no slots across a break) + the picker window guard; phone-side N/A. Minimum-notice floor added to the picker as the symmetric lower-bound fix.

**Migration:** Phase C only (unique-index drops). **Engine touch:** `availability.ts` only in Phases C + D (contained, behaviour-preserving — flag the RECON exception). **No new permissions, no new tables.**

**Sequencing:** independent of all other plans. Phase D is the most visible customer fix and can ship standalone first.

### 5.15 C-08 amended — business notifications + personal notification email (2026-07-16, plan-refinement phase)

User direction 2026-07-16 (collaborative plan-refinement session). Audit verified: internal alerts (new booking / cancellation / reschedule) go to `business_settings.contact_email` — the clinic's PUBLIC contact address (`getAdminRecipient`, `notifications.ts:209`); enquiries fire no email anywhere (`createEnquiry` sends nothing; **no public enquiry endpoint exists** — enquiries are staff-logged only); `staff_profiles` has no notification email; `/admin/me` is a performance page with no settings surface.

**C-08 gains Phase D (steps 13–18):**
- Migration (Zone-2, now definite): `staff_profiles.notification_email text` + `business_notification_prefs jsonb` (+ conditional `email_delivery_events.metadata`); Owner seeded opted-in.
- `resolveBusinessNotificationRecipients`: active opted-in Owner/Admin → `notification_email ?? email`; per-type prefs (5 keys: new_booking_request, booking_cancelled, reschedule_request, enquiry_logged, slot_claimed — all default on once enabled); **skip-self** (never emailed about your own action — supersedes brief §5.6 + Q9.3 locks); zero-opt-in fallback to `getAdminRecipient` so alerts never vanish; intentional non-sends write `skipped` delivery rows with reasons.
- All admin_internal sends rerouted (3 existing + claim + new); one delivery row per recipient.
- New 5th template `enquiry_logged` (hook in `createEnquiry`, skip-self).
- `/admin/me` "Notifications" section (Owner/Admin, self-only writes; hint copy locked in brief §2.8). Coordination note added to C-07 plan Step 3 (both plans mount cards on `/admin/me`).
- Commit cadence 8 → 11. New audit types `email_resent` (existing) + `notification_settings_updated`.

### 5.16 C-15 added as a 15th plan — email template studio (2026-07-16, plan-refinement phase)

User direction 2026-07-16: the Templates tab is "terrible… incomplete and not easy to use at all" — wants completeness, clarity on editable vs fixed, no hand-typed variable codes, one-click reset-to-default, and a **live** preview. Code audit confirmed every complaint (thin field surface, hardcoded subjects, saved-state-only FAKE-marked preview, reset only via clear-field-and-save). PE-51's "exemplary" verdict is relative to other admin surfaces and is superseded by the owner's.

**C-15 created** (master plan now 15/15). Scope summary in §3; key facts: zero migrations; render-parity gate protects live emails through the copy-lift; retires ManualSendSheet + 4 old editor components; removes 3 non-filter FAKE markers (C-09's C-12+ inventory should mark them owned by C-15). Compatibility notes added to C-01 (Step 12), C-02 (Step 11), C-13 (Phase G) plans — their template registrations inherit the studio; registry API stays backward-compatible.

**Recommended order updated:** … → C-08 → **C-15** → C-13 → C-02 → … (C-15 before C-13/C-02 so their template work lands inside the finished studio).

### 5.17 C-04a amended — S7 28-day restore window (2026-07-16, plan-refinement phase)

User direction 2026-07-16: a cancelled booking shouldn't be restorable forever — after weeks the restore makes no operational sense. **S7 refinement:** restore is allowed only within **28 days of the cancellation moment** (`RESTORE_WINDOW_DAYS = 28`, tunable constant). Composes with S6 (appointment moment must ALSO be in the future); both guards enforced server-side + hidden in UI with distinct copy per reason.

Audit fact that shaped it: admin cancels stamp NO timestamp on the booking row (`customer_cancelled_at` is customer-flow-only) → new **`bookings.cancelled_at`** column folded into C-04a's Step 10 migration, with a two-source backfill (customer timestamp, then latest cancel audit row); rows neither reaches stay NULL → **treated as expired (fail-closed)**. Guard reads `cancelled_at ?? customer_cancelled_at`, so the customer cancel path stays untouched. Both admin cancel paths stamp it; restore clears it; re-cancel re-stamps (window restarts). no_show restores were already dead via S6 (documented); **completed-reopen deliberately exempt** (force + reason friction suffices — user-confirmed).

Shared predicate `isRestoreWindowExpired` + the constant live in `_helpers.ts` (single source for server action + detail card + row menu). Ripples: C-05 inline-notice gains the expired-copy variant; C-02's cancel-series cascade + C-06's delete-client cascade stamp `cancelled_at` (one-line notes in both plans). Brief §1.11/§2.1 S7/§5.12/§6 + plan step 3.6 are the spec.

### 5.18 C-16 added as a 16th plan — data growth: pagination + bounded lists (2026-07-16, plan-refinement phase)

User direction 2026-07-16: proper pagination and accounting for data build-up on every admin list — nothing may sprawl past the page frame, on desktop or phone, 5 years into the business. Named example: the roles page. Code audit findings driving the plan: **bookings list fetches every booking ever with no limit** (`bookings/page.tsx:438`) then filters in memory — both an endless-scroll and a silent performance cliff at ~10-15k rows; clients + enquiries unbounded; emails (100) / privacy (25) / operations (300) hard-capped with **no pager** — old rows unreachable; **audit log is the one surface already done right** (cursor, 100/page) and becomes the house reference.

**C-16 created** (master plan now 16/16). Three treatment classes: paginate the growers (shared URL-driven `PaginationBar` + helpers; bookings view-predicates move into SQL, gated by a parity spec against `filterBookings` as the semantic oracle); convert silent caps to pagers; restructure static-long lists (roles) with density/disclosure — never pagination for static data. Verification proves multi-page behaviour via a temporary page-size-3 override — no production data seeding. Zero migrations.

**Future-proofing beyond Band C:** a standing rule now in BAND-C-MASTER-PLAN Part 0 — *no unbounded list queries; every list surface ships with a pager or a conscious cap + view-all; every plan's verification gate checks it.*

**Ripples:** C-09 Step 5 helpers written pagination-ready (limit/offset in signatures + count paths); C-02 Step 16 series page bounds its visit lists (10 upcoming + 5 past + view-all — an until-cancelled series reaches ~260 visits in 5 years); C-10 pre-flight now HARD-stops if C-16 hasn't merged (pagination changes the page heights its overlap audit measures).

**Recommended order updated:** … → C-09 → C-03 → C-07 → **C-16** → C-10.

### 5.19 C-17 added as a 17th plan — Google Analytics on customer pages (2026-07-16, plan-refinement phase)

User direction 2026-07-16: set up the existing GA4 tag (`G-WM8BCYG060`) on the customer-facing pages. Audit facts: zero analytics in `src/`; no CSP to block googletagmanager.com; customer surfaces = `(public)` route group (incl. the embedded booking flow) + `/booking/manage` (outside the group) → two mount points; root-layout mounting rejected (would track `/admin`).

**C-17 created** (master plan now 17/17; smallest plan of the band). Env-gated production-only component (`next/script` — no new package, no Zone-2 dependency), fire-once `booking_request_submitted` conversion event on `PreparedStep`, zero PII, admin-absence asserted in the gate. **Consent explicitly deferred (user decision):** the user will run Google's own consent setup — Consent Mode + banner is the declared NEXT plan-refinement item; C-17's init block carries a marked insertion point so that change lands additively.

**Ripples:** none to other plans (fully independent, like C-14). One production env var (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, build-time-inlined — pipeline injection is a named verification item).

### 5.20 C-18 added as an 18th plan — cookie consent & PECR compliance (2026-07-16, plan-refinement phase)

User direction 2026-07-16 with nine explicit requirements (block-before-consent, accept/reject parity, no pre-ticks, granular purposes, easy withdrawal, no cookie wall, consent PROOF not preference flags, Consent Mode ordering, accurate future-proofed disclosure) + a mandated research pass. **Verified legal state (web research, sources in the brief §1):** the DUAA 2025 statistics-cookie exception is IN FORCE (5 Feb 2026, SI 2026/82) but stock GA4 almost certainly fails its conditions (Google's own data use; per-user `_ga` IDs) → **opt-in consent remains required**; ICO final storage-and-access guidance (29 Apr 2026) mandates reject-parity + granularity + easy withdrawal and recommends ~6-month consent lifetime; consent-proof standard = timestamped who(pseudonymous)/when/what-shown(versioned)/what-chosen records; only **basic** Consent Mode v2 (no gtag load pre-consent) passes a strict no-pre-consent-requests test; PECR penalties now £17.5m/4%.

**C-18 created** (master plan now 18/18): in-house layer (no CMP dependency), registry-driven disclosure (single source for banner + panel + new `/cookies` page), `--rahma-*` design language, parity by construction (same component renders both first-layer buttons), `consent_events` proof table (the one Zone-2 migration, RLS deny-all, no PII), footer withdrawal that actually stops scripts (denied update + `_ga*` deletion + reload + logged), 6-month/version-bump re-prompts. **Rewrites C-17's `GoogleAnalytics` into the consent-gated loader — hard co-ship pair.** Standing cookie/tag-registry rule added to Part 0. Audit note: **no privacy policy page exists on the public site** — flagged as the recommended next compliance item (kept out of C-18 scope; covered by C-19, §5.21).

### 5.21 C-19 added as a 19th plan — privacy policy page (2026-07-16, plan-refinement phase)

User direction 2026-07-16, with an explicit simplicity correction: a generic-but-custom privacy policy page, **one new file, no changes to any other page** — the fuller apparatus initially proposed (booking-form just-in-time links, footer wiring, complaint intake) was cut at the user's direction; linking the page up is left for later. Research (same session) still informs the copy: Art 13 checklist; explicit consent (Art 9(2)(a)) as the route for the booking form's `healthNotes` (therapists aren't DPA s.204 health professionals); DUAA s.164A complain-to-us right mentioned in copy; concrete retention numbers (7-year insurance default, user confirms at impl); named processors (Supabase/Resend/Cloudflare/Sentry/Google); swap-ready transfers wording (UK Extension under CJEU appeal). Business actions recorded once in the brief, not code: ICO Tier-1 fee (£52), retention confirmation, contact details to publish.

**C-19 created** (master plan now 19/19; C-PRIVACY row note updated — B-89/B-90 + operational complaint handling remain there). Fully independent; 1 commit at impl.

### 5.22 C-20 added as a 20th plan — address autocomplete on both booking forms (2026-07-16, plan-refinement phase)

User direction 2026-07-16 with a Google Maps/Places key + the "Address Selection" quickstart snippet. Audit: both booking forms collect the same four fields (`address`/`postcode`/`city`/`area`) but bind differently — customer `LocationDetailsStep` via react-hook-form, admin `ManualBookingForm` via useState — so C-20 builds ONE form-library-agnostic component emitting parsed `AddressParts`, applied by each host in its own idiom.

**Four deliberate deviations from the supplied snippet** (recorded in the plan §1 so no one "restores" them): `next/script` lazy-load on first focus instead of the Extended Component Library CDN import; env-var key instead of a hard-coded one; **UK component mapping** (`postal_town`→city, `administrative_area_level_2`→area — the snippet's US `locality`/`administrative_area_level_1` model yields wrong or empty values for UK addresses); silent no-op instead of `window.alert` on unmatched free text. Added: `country: 'gb'` restriction, Places session tokens (billing), plain-input fallback when the key/script is unavailable.

**Load-bearing integration detail:** the customer side must apply the filled `city` with `setValue(..., { shouldValidate: true })` — otherwise the covered-area notice (which watches `city`) silently stops re-evaluating. Called out in the plan Step 5, the risk table, and gate case 5.

**Blocking sign-off items:** Cloud Console key restriction (HTTP referrers + Maps/Places APIs only) — **completed 2026-07-16** (`https://rahmatherapy.uk/*`, `https://*.rahmatherapy.uk/*`, `http://localhost:3000/*`; Maps JS + Places + Places New) — and a rotation decision, since **the key was pasted in plaintext during planning**; plus the C-18 registry entry + consent classification (functional-on-interaction recommended, decided with the user, never defaulted).

**Billing/cost amendment (2026-07-16, verified research — see §5.23).**

### 5.23 C-20 amended + C-21 added — Maps cost model and the canonical-domain defect (2026-07-16)

**C-20 cost amendment.** Verified research into current Maps Platform pricing (post-March-2025 per-SKU free allowances) corrected a real error carried in from the user's reference snippet: `fields: ['address_components','geometry','name']`. Place Details bills at the **highest field tier requested**, and `name`/`displayName` is **Pro** — including it halves the monthly free allowance (10,000 → 5,000) and triples the unit price ($5 → $17 per 1,000). The plan now mandates **Essentials fields only** and treats the field list as a blocking gate item. Also folded in: session-token billing means a completed booking costs exactly ONE Place Details event (typing is free) while **abandoned** sessions bill per request — making a **~300 ms debounce** a cost control (≈7,200/month debounced vs ≈14,400 un-debounced against a 10,000 free allowance); a **billing account with a card is mandatory** even for free-tier use (no card → 1 request/day); **budgets only email, never hard-stop**, and Maps quotas are largely per-minute rather than per-day — so the **HTTP-referrer key restriction is the load-bearing cost control**; and the 90-day $300 trial credit can silently absorb overage, so the post-deploy Metrics check must confirm usage sits inside the free allowance itself. Expected real usage ≈12% of the free allowance.

**C-21 added (19th→21st plan; defect discovered during the same key-restriction work).** Restricting the key required knowing the live domain — which surfaced that `rahmatherapy.uk` appears nowhere in the code, while `rahmatherapy.co.uk` (12 refs, incl. site-wide `metadataBase`) and `rahmatherapy.com` (8 refs, incl. the homepage's JSON-LD) are hard-coded. Search engines are being told the public pages live on domains that don't serve the site. Fix is a single `SITE_URL` source + corrected value + anti-drift test; 1 commit; recommended early. Adjacent gap flagged: no sitemap/robots files exist.

---

## 6 — Cross-plan coordination + dependencies + sequencing

### 6.1 Hard sequencing constraints

| Plan | Must ship | Reason |
|---|---|---|
| C-04a | Before or with **C-05** | C-05's lockdown needs Restore button as escape hatch |
| C-FIELDWORK | Before or with **C-11** | C-11 imports PractitionerTodaySection + shared-helpers |
| **C-06 amendment** (deleteClient cascade) | Before **C-02 ships** | FK is `ON DELETE RESTRICT`; cascade must cancel templates |
| C-01 | Before **C-02** ships | Cron infrastructure pattern is the lift target |
| **C-04a Phase G (row-level Restore)** | Co-ship with **C-05 Phase D (Edit Point 8)** | Row-level Restore is only user-discoverable once cancelled rows appear in the filter; soft-couple (technically independent but UX-coupled) |
| **C-04a Phase F (scheduled-emails cron)** | Independent from **C-01** | Different mechanism (`* * * * *` vs `*/15`); same Cloudflare Workers infrastructure; both register in `wrangler.jsonc` separately |
| **C-16** (2026-07-16) | After **C-09** + **C-05**, hard-before **C-10** | Plugs into C-09's pagination-ready helpers; derives bookings SQL from C-05's final `filterBookings`; changes page heights C-10 measures (C-10 pre-flight stops if C-16 absent) |

### 6.2 Soft sequencing (recommended order)

Per C-B-DECISIONS §5 + amendments (2026-05-26 + 2026-07-16): **C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-15 → C-13 → C-02 → C-09 → C-03 → C-07 → C-16 → C-10**.

Order rationale:
- C-06 first — biggest data-integrity fix.
- C-04a → C-05 — locked sequence.
- C-01 → C-02 — cron infrastructure first.
- C-FIELDWORK → C-11 — drop-in component first.
- C-08 → **C-15** — templates + notification_email column exist before the studio reworks the editor around them (2026-07-16).
- C-15 → **C-13** — C-13's email group-context block plugs into the post-copy-lift renderers; C-13's `BookingCard` available before C-11's shared-blocks adoption sweep (in practice C-11 ships ahead; coordinate at impl).
- C-07 → **C-16** — saved filters + default tabs settle before pagination composes with them; C-16 needs C-09's helpers + C-05's predicates already merged (2026-07-16).
- **C-16 → C-10** — pagination changes list-page heights; the bottom-spacing catalogue measures post-C-16 reality (hard constraint; C-10 pre-flight enforces).
- C-09 (now positioned mid-pack after C-13) — tag sweep catches all prior plans' new actions.
- C-03 / C-07 — UX polish on top of stable surfaces.
- C-10 last — catalogues new routes alongside existing.

### 6.3 Cross-plan synergies documented

- **C-03** absorbed B-108 + W01-V-1 + B-157 from C-07's master-plan scope.
- **C-07** extends C-03's `BookingDetailToasts` component with `just_created` type.
- **C-11** consumes C-FIELDWORK's `PractitionerTodaySection` + C-07's `DashboardScopeToggle`.
- **C-08** + **C-04a** + **C-01** + **C-02** all converge on `resolveTemplateOverrides` + `email_template_overrides` infrastructure.
- **C-FIELDWORK** uses C-04a's pattern for the Mark complete temporal-guard button.
- **C-05** orthogonal to C-FIELDWORK's mobile reorder (reorder applies to cancelled bookings too — practitioner needs phone for follow-up).
- **C-09** retrofits cache tags on all C-NN plans' new server actions.
- **C-10** catalogues new routes from C-06 + C-02.
- **C-13** extracts `BookingCard` consumed by C-FIELDWORK + C-11; plugs into C-08's new email templates; preserves C-05's `isInertRow` class composition on the outer card.

---

## 7 — Branch state + housekeeping context (READ THIS)

**Branch shift mid-C-B session:** the C-B plan-writing session began on `redesign/start-state`. Between C-07 commits and C-10 commits, **`redesign/start-state` was merged into `master`** + 3 `fix(build)` commits were applied on master + C-10's brief + plan landed on master.

**Current state:**
- **Active branch:** `master`
- **HEAD:** `8b9ad1c`
- All C-B work (12 briefs + 12 plans + C-11 admin-wide-dark-mode clarification + master plan bookkeeping) is on master.
- `redesign/start-state` still exists but is behind master.
- `origin/master` may or may not be ahead/behind — verify with `git status`.

**If the next session expects to work on `redesign/start-state`:** the merge to master may have been intentional housekeeping. Either accept master as the new working branch OR reset master and continue on redesign/start-state. **Confirm with the user.**

**Recommended:** continue on `master`. Future C-C work commits land on master. Future plans should explicitly verify branch at pre-flight.

### 7.1 Recent commits (last 30)

```
8b9ad1c docs(redesign): C-10 plan + C-B 12/12 COMPLETE — master plan bookkeeping
13782ce docs(redesign): C-10 brief — bottom-spacing / footer overlap fix
5740d4c fix(build): re-apply tsconfig exclude — shim approach defeated by OpenNext output-dir wipe
634de9d fix(build): replace tsc exclude with type shim for OpenNext worker bundle
0170805 fix(build): exclude worker-entrypoint.ts from Next.js tsc pass
3ef8423 Merge branch 'redesign/start-state' into master
c5c13d5 docs(redesign): C-07 plan
6b1662a docs(redesign): C-07 brief
9110fdf docs(redesign): C-03 plan
7bd638c docs(redesign): C-03 brief
9171e39 docs(redesign): C-09 plan
d00164f docs(redesign): C-09 brief
341b34e docs(redesign): C-02 plan
79cf538 docs(redesign): C-02 brief
b32932b docs(redesign): C-08 plan
2cfd4df docs(redesign): C-08 brief
d8806ec docs(redesign): C-11 admin-wide dark mode clarification
4e36f21 docs(redesign): C-11 plan
0a72f9a docs(redesign): C-11 brief
e67c81f docs(redesign): C-FIELDWORK plan
746cfa5 docs(redesign): C-FIELDWORK brief
aaa9a78 docs(redesign): C-01 plan
59a8633 docs(redesign): C-01 brief
04f2792 docs(redesign): C-05 plan
b9b997c docs(redesign): C-05 brief
39de78f docs(redesign): C-04a plan
7bc1f74 docs(redesign): C-04a brief
1f5e5a8 docs(redesign): C-06 plan
78811ac docs(redesign): C-06 brief
d2a3f26 docs(redesign): C-B decisions — lock answers to 11 open questions
```

---

## 8 — Operating discipline (verbatim from master plan Part 0)

### Project root + branch

- Working directory: `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`
- Branch: **`master`** post-merge (was `redesign/start-state` during C-B writing).
- HEAD at this handoff: `8b9ad1c`

### Dev server

- Always run on `http://localhost:3000` via user's own `pnpm dev` in a separate terminal.
- Verify with `curl -I http://localhost:3000/admin/login/` → HTTP 200.
- Reuse existing dev server; don't kill, don't spawn duplicate.
- Don't use `preview_start` MCP — wrong harness.

### Login credentials (canonical — do not invent new accounts)

| Role | Email | Password | Profile id |
|---|---|---|---|
| Owner | `rahmatherapy@outlook.com` | `Password123` | `01582c5d-bd75-4c49-b207-6f5597e15218` |
| Admin | `test.admin@rahmatherapy.example.test` | `AdminTest123!` | (unknown) |
| Coordinator | `test.coordinator@rahmatherapy.example.test` | `CoordinatorTest123!` | (unknown) |
| Therapist | `test.therapist@rahmatherapy.example.test` | `TherapistTest123!` | `884311b1-e9d0-44b9-91f3-14188a3baf59` |
| Therapist-Fresh | `test.therapist.fresh@rahmatherapy.example.test` | `TherapistFresh123!` | `87e01c11-9d0d-4b52-bf3e-2af16f0f03d5` |
| Inactive | `test.inactive@rahmatherapy.example.test` | `InactiveTest123!` | `58784433-cb42-4773-9b22-b792c24b852d` |

### MCPs in scope

- **`mcp__supabase__*`** — production `project_id` `twzutkfgqclqurvkmvqz` (pass on every call).
  - `execute_sql` — read-only queries, schema introspection (used heavily during C-B plan-writing).
  - `apply_migration` — **Zone-2 only.** Explicit user confirmation per migration. C-C will run multiple migrations (per per-plan §6).
  - `list_tables` / `list_extensions` / `get_advisors` / `get_logs` — safe diagnostic.
  - `generate_typescript_types` — after schema changes.
- **`mcp__playwright__*`** — canonical browser harness against `http://localhost:3000`.

### Hard rules (do NOT violate)

- **No `pnpm install` / `pnpm add` / `npx <pkg>`** without Zone-2 user confirmation.
- **Stage files EXPLICITLY** for every commit — `git add <path>`, NEVER `git add .` / `git add -A`.
- **No `border-l-4` anywhere** (DESIGN.md ban).
- **Honour `prefers-reduced-motion`** — use `src/app/admin/components/use-reduced-motion.ts` or `motion-reduce:` Tailwind modifier.
- **`updateTag(tag)` not `revalidateTag(tag, profile)`** for server-action cache invalidation (Next 16).
- **`createSupabaseAdminClient()` after `getStaffProfile()` auth check** — every server action.
- **RECON §5 untouchables:** `reporting.ts` core exports (additive only — though C-04a hygiene tail explicitly approved per C-B-DECISIONS Q8 for line 438's `||` → `??`), `dashboard-helpers.ts`, RBAC matrix, middleware, build configs, B-1 chart + tile primitives.
- **SHARED-NOTES §15 (cache hazards):** never `Set<>` / `Map<>` / `Date` through `unstable_cache`. C-09's audit sweep covers this.
- **SHARED-NOTES §17:** use `statusChartFillForKey` from `ReportsCharts.tsx` for chart fills.
- **SHARED-NOTES §18:** 5-step filter-vs-data audit checklist on any new filter-equipped surface.
- **Mobile-first.** Every UI change reads cleanly at 375 px.
- **C-C operating commits explicitly. `feat(redesign): C-NN {phase}`** prefix per Band B convention. Migrations: `chore(supabase): C-NN migration applied {migration_name}`.

### Static + verification gates (every C-C implementation phase)

1. `pnpm lint` — 0 errors.
2. `npx tsc --noEmit` — 0 errors.
3. `pnpm vitest run` — new specs pass; **6 pre-existing baseline failures preserved** per master plan Part 0.
4. `pnpm build` — clean.
5. `node scripts/measure-admin-bundles.mjs` — bundle delta within budget per per-plan ceiling.
6. Playwright role sweep per the plan's verification gate.
7. Screenshot evidence at 375 / 768 / 1280 / 1440 where mobile reflow is meaningful.

---

## 9 — File inventory (relevant to C-C)

### C-B plan-writing outputs (14 briefs + 14 plans)

```
redesign/briefs/
├── C-01-review-request-email-brief.md
├── C-02-recurring-bookings-brief.md
├── C-03-enquiry-to-booking-conversion-brief.md
├── C-04a-cancellation-restore-brief.md
├── C-05-cancelled-bookings-inert-brief.md
├── C-06-client-crud-hardening-brief.md
├── C-07-routing-and-per-role-defaults-brief.md
├── C-08-email-automation-expansion-brief.md
├── C-09-cache-invalidation-filter-cleanup-brief.md
├── C-10-bottom-spacing-footer-overlap-brief.md
├── C-11-dashboard-variants-design-system-brief.md
├── C-13-group-bookings-and-gender-clarity-brief.md           # NEW 2026-05-26 post-handoff
├── C-14-granular-working-hours-breaks-brief.md               # NEW 2026-05-26 post-handoff
├── C-15-email-template-studio-brief.md                       # NEW 2026-07-16 plan-refinement
├── C-16-data-growth-pagination-brief.md                      # NEW 2026-07-16 plan-refinement
├── C-17-google-analytics-brief.md                            # NEW 2026-07-16 plan-refinement
├── C-18-cookie-consent-brief.md                              # NEW 2026-07-16 plan-refinement
├── C-19-privacy-policy-page-brief.md                         # NEW 2026-07-16 plan-refinement
├── C-20-address-autocomplete-brief.md                        # NEW 2026-07-16 plan-refinement
├── C-21-canonical-domain-fix-brief.md                        # NEW 2026-07-16 plan-refinement
└── C-FIELDWORK-EXPERIENCE-brief.md

redesign/plans/C-phase/
├── BAND-C-MASTER-PLAN.md                                     # master checklist (14/14 ✅ as of 2026-05-26)
├── C-B-DECISIONS.md                                          # 11 locked decisions
├── C-01-review-request-email-plan.md
├── C-02-recurring-bookings-plan.md
├── C-03-enquiry-to-booking-conversion-plan.md
├── C-04a-cancellation-restore-plan.md
├── C-05-cancelled-bookings-inert-plan.md
├── C-06-client-crud-hardening-plan.md
├── C-07-routing-and-per-role-defaults-plan.md
├── C-08-email-automation-expansion-plan.md
├── C-09-cache-invalidation-filter-cleanup-plan.md
├── C-10-bottom-spacing-footer-overlap-plan.md
├── C-11-dashboard-variants-design-system-plan.md
├── C-13-group-bookings-and-gender-clarity-plan.md            # NEW 2026-05-26 post-handoff
├── C-14-granular-working-hours-breaks-plan.md                # NEW 2026-05-26 post-handoff
├── C-15-email-template-studio-plan.md                        # NEW 2026-07-16 plan-refinement
├── C-16-data-growth-pagination-plan.md                       # NEW 2026-07-16 plan-refinement
├── C-17-google-analytics-plan.md                             # NEW 2026-07-16 plan-refinement
├── C-18-cookie-consent-plan.md                               # NEW 2026-07-16 plan-refinement
├── C-19-privacy-policy-page-plan.md                          # NEW 2026-07-16 plan-refinement
├── C-20-address-autocomplete-plan.md                         # NEW 2026-07-16 plan-refinement
├── C-21-canonical-domain-fix-plan.md                         # NEW 2026-07-16 plan-refinement
└── C-FIELDWORK-EXPERIENCE-plan.md
```

### Audits (read-only references — drill in only when a plan calls them out)

```
redesign/audits/C-A/
├── C-A-1-SUMMARY.md  C-A-2-SUMMARY.md  C-A-3-SUMMARY.md       # distilled summaries — read first
├── 01-dashboard-audit.md   ...   25-reports-audit.md          # per-surface audits (24 files)
├── W01-enquiry-to-booking-flow.md  ...  W10-settings-...md    # workflow audits (10 files)
└── R01-owner-day.md  ...  R05-therapist-fresh-day.md          # role-day audits (5 files)
```

### Handoffs

```
redesign/
├── HANDOFF-2026-05-25-POST-C-A.md     # audit-phase handoff (background context)
└── HANDOFF-2026-05-26-POST-C-B.md     # THIS DOCUMENT — current handoff
```

### Per-plan progress files (filled during C-C — currently empty placeholders TBD)

```
redesign/per-page-progress/
├── C-01-review-request-email-progress.md (TBD)
├── C-02-recurring-bookings-progress.md (TBD)
└── ... one per C-NN plan
```

---

## 10 — DO NOT touch / off-limits guidance

- **Badar's `9d55ce2a` cancelled booking** — real email `avonrk@hotmail.co.uk`. NEVER mutate during E2E testing.
- **Owner test account `rahmatherapy@outlook.com`** during email-test paths — C-01 plan §0 + §6 documents backfill suppression.
- **Real customer data** — any client whose email isn't `*.example.test` or matches `Phase10*` / `Audit Test*` / unicode/RTL stress patterns.
- **RECON §5 untouchables** — `reporting.ts` core exports (only C-04a's line 438 `||→??` is explicitly approved), `dashboard-helpers.ts`, RBAC matrix migration files, middleware, build configs.
- **Non-filter FAKE markers** — per C-09 plan §2.5, distributed to C-12+. Don't touch during C-09 sweep.

---

## 11 — Quick-reference command palette

```bash
# Verify dev server
curl -I http://localhost:3000/admin/login/

# Check working tree + branch
git status --short
git branch --show-current  # expect 'master' post-C-B

# Check recent commits
git log --oneline -15

# Production DB schema introspection (use Supabase MCP)
# project_id: twzutkfgqclqurvkmvqz
# All execute_sql calls must pass project_id.

# Find a bug discussion
grep -rn "B-{NN}" redesign/audits/C-A/

# Find an architecture deliverable
grep -A2 "^## 10\|^## 11" redesign/audits/C-A/W*.md

# Confirm a per-plan reading deliverable
cat redesign/briefs/C-06-client-crud-hardening-brief.md | head -50
```

```sql
-- Common DB introspection (run via mcp__supabase__execute_sql)
SELECT COUNT(*) FROM bookings GROUP BY status;
SELECT action_type, COUNT(*) FROM audit_logs GROUP BY action_type ORDER BY action_type;
SELECT event_type, COUNT(*) FROM email_delivery_events GROUP BY event_type;
```

---

## 12 — Hand-off to C-C implementation

### What's done

- ✅ C-A audit pass (25 surfaces + 10 workflows + 5 role-days = 40 audit files; 173 bugs B-01..B-173).
- ✅ (D) decisions on 11 open questions (`C-B-DECISIONS.md`).
- ✅ C-B plan-writing — 12 briefs + 12 plans + master plan checklist updated.

### What's next

- ⏳ C-C implementation — execute the 12 plans in order per C-B-DECISIONS §5 + sequencing constraints in §6 above.
- Each plan's §0 Pre-flight + §1 Implementation order + §3 Verification gate is the recipe.
- Update per-plan progress files (`redesign/per-page-progress/C-NN-{slug}-progress.md`) per phase.
- Migrations are Zone-2 — explicit user confirmation per migration.

### Specific C-C onboarding actions

1. Open this handoff (`HANDOFF-2026-05-26-POST-C-B.md`) end-to-end.
2. Verify branch + HEAD (§7 + §11).
3. Pick the first plan to ship (recommended: C-06).
4. Open its brief + plan; run pre-flight; execute Phase A.
5. Commit per cadence; verify per gate.
6. Move to next plan per §6 sequencing.

### Open cross-plan amendments to apply before C-C ships specific plans

- **C-06 plan §1 Step 9 (`deleteClient` cascade):** extend to cancel active recurring templates before deleting the client. Required before C-02 ships. See §5.8.
- **(2026-05-26 amendment)** C-04a + C-05 amended for the cancelled-booking ease+restore bundle. C-04a now 14 changes / 8 phases with a Zone-2 migration (`scheduled_for` + payload columns); C-05 now 9 edit points / 4 phases. See §5.11. Both briefs + plans updated; no further amendments needed before C-C.
- **(2026-05-26 amendment)** C-13 added as a 13th plan for group-booking surface + gender-clarity. 7 changes / 8 phases / zero migrations / pure UI render. See §5.12. Brief + plan written; master plan checklist updated to 13/13. No further amendments needed before C-C.
- **(2026-05-26 amendment)** C-06 amended with Step 13 — optional email on the admin booking flow. Migration drops `bookings.contact_email NOT NULL`; RPC gains phone-fallback matching; admin form + Zod relaxed; public flow untouched + regression-tested. See §5.13. Brief + plan amended; no further amendments needed before C-C.
- **(2026-05-26 amendment)** C-14 added as a 14th plan — granular working hours (breaks) across global/staff/override + customer booking-window date-picker guard. Segments storage model (no new tables); Phase C migration drops the override-date unique. See §5.14. Brief + plan written; master plan checklist updated to 14/14. No further amendments needed before C-C.
- **(2026-07-16 amendment)** C-08 amended — business notifications + personal notification email (Phase D, steps 13–18): staff_profiles notification columns migration (now definite Zone-2), recipient resolver with skip-self + per-type prefs, `enquiry_logged` template, `/admin/me` Notifications section. See §5.15. Brief + plan amended; C-07 coordination note added. No further amendments needed before C-C.
- **(2026-07-16 amendment)** C-15 added as a 15th plan — email template studio (gallery + live draft preview + chip variables + reset-to-default + test send; retires ManualSendSheet). Zero migrations; render-parity gate. See §5.16. Brief + plan written; master plan checklist updated to 15/15; compatibility notes added to C-01/C-02/C-13. Recommended order now inserts C-15 between C-08 and C-13. No further amendments needed before C-C.
- **(2026-07-16 amendment)** C-04a amended — S7 28-day restore window: `bookings.cancelled_at` column + backfill folded into the Step 10 migration; guard + shared `isRestoreWindowExpired` helper + UI/copy variants; stamping notes rippled to C-02 (series cascade), C-06 (delete cascade), C-05 (expired notice copy). See §5.17. Brief + plan amended; no further amendments needed before C-C.
- **(2026-07-16 amendment)** C-16 added as a 16th plan — data growth: pagination standard + bounded lists everywhere (bookings/clients/enquiries to server-side pagination; cap→pager conversions; roles-page restructure; standing no-unbounded-queries rule in Part 0). Zero migrations. See §5.18. Brief + plan written; master plan checklist updated to 16/16; C-09 helper-signature + C-02 series-page-caps + C-10 hard pre-flight notes rippled. Order inserts C-16 between C-07 and C-10. No further amendments needed before C-C.
- **(2026-07-16 amendment)** C-17 added as a 17th plan — Google Analytics (GA4) on customer pages: env-gated production-only tag on `(public)` + `/booking/manage`, admin never tracked, one `booking_request_submitted` conversion event, zero PII, no packages, zero migrations. See §5.19. Brief + plan written (amended same day for the C-18 pairing). Fully independent; ships anytime — co-ship with C-18.
- **(2026-07-16 amendment)** C-18 added as an 18th plan — cookie consent & PECR compliance: registry-driven banner + panel + /cookies page in the public design language, basic Consent Mode v2 (zero pre-consent Google requests), `consent_events` proof table (one Zone-2 migration), footer withdrawal, 6-month/version-bump re-prompts, standing cookie/tag-registry rule in Part 0. Rewrites C-17's component into the consent-gated loader (hard co-ship pair). See §5.20. Brief + plan written; master plan checklist updated to 18/18. No further amendments needed before C-C.
- **(2026-07-16 amendment)** C-19 added as a 19th plan — privacy policy page: ONE new file (`(public)/privacy/page.tsx`), custom to the audited data flows, user-locked minimal scope (no other page touched; linking left for later). See §5.21. Brief + plan written; master plan checklist updated to 19/19. No further amendments needed before C-C.
- **(2026-07-16 amendment)** C-20 added as a 20th plan — address autocomplete (Google Places) on both booking forms: one shared form-library-agnostic component, UK component mapping, lazy load on focus, session tokens, plain-input fallback; blocking sign-off on Cloud Console key restriction + rotation and the C-18 consent classification. See §5.22. Brief + plan written; master plan checklist updated to 20/20. Independent; ships anytime. No further amendments needed before C-C.

### Programme-level final gates (Band C completion)

To be ticked once C-C ships all 12 plans:
- [ ] All 12 plans (C-01 ... C-11 + C-FIELDWORK) shipped.
- [ ] All C-A.1 audit-surfaced items addressed in C-12+, deferred (with rationale), or dismissed (with rationale).
- [ ] Production-readiness table in `BAND-C-MASTER-PLAN.md` Part 1 has every ⚠️ resolved.
- [ ] Per-plan progress files complete.
- [ ] Bundle deltas within budget per per-plan ceilings.
- [ ] No new persistent Sentry error classes.
- [ ] Vitest baseline preserved.
- [ ] All Band C migrations applied + verified.
- [ ] C-12+ FAKE inventory deliverable from C-09 exists (`c-12-plus-fake-inventory.md`).
- [ ] C-10 overlap catalogue exists (`c-10-overlap-catalogue.md`).
- [ ] Programme-level Phase 8 hand-off written (POST-C-C handoff).

---

## 13 — Important reminders for the next session

### About the work that just ended

- **C-B was pure planning — no code changes during plan-writing.** The 24 commits this session are all docs (briefs + plans + bookkeeping).
- Every plan's body is largely self-contained execution detail. Don't re-derive — execute as written.
- 5+ critical discoveries during plan-writing changed decisions-doc assumptions (§5). Read those first.

### About the auditor / planner's confidence calibration

- Several plans surfaced reframes vs decisions doc (C-08 templates, C-09 FAKE count, C-01 cron engine).
- C-11 dark mode scope was clarified post-write via user feedback ("all admin pages, not just dashboard").
- Cross-plan amendments flagged inline (especially C-02 → C-06 deleteClient cascade).

### About the user

- The user is the clinic Owner. They take bookings themselves (scope clarification 1).
- Communication preference: **terse, direct, with tradeoffs surfaced.** They make decisions; agent presents options.
- The user has a working dev server they manage themselves. Do not `pnpm dev` to spawn a competing process.
- Decisions about migrations, deletions, and external API calls are all Zone-2 — get explicit confirmation per action.
- The user merged `redesign/start-state` into `master` mid-session (§7). Future work is on master unless they direct otherwise.

### About what the next session should NOT do

- Don't re-write any C-B plan. Plans are written; execute them.
- Don't re-walk audits. Audits are done; reference per-plan when needed.
- Don't run `pnpm install` / `npx <pkg>` without Zone-2 confirmation.
- Don't write to production DB without per-migration confirmation.
- Don't assume the original decisions doc scope on C-08 / C-11 / C-01 — read the plan's discoveries.
- Don't ship C-02 before C-06's amendment (deleteClient cascade).
- Don't ship C-05 before C-04a.
- Don't ship C-11 before C-FIELDWORK.

---

## 14 — End-of-handoff state

- **Branch:** `master`
- **HEAD:** `8b9ad1c` (original handoff write time) → updated by subsequent commits including the 2026-05-26 cancelled-booking amendment commits (see git log for current HEAD).
- **Commits this session (C-B plan-writing):** 24 (12 briefs + 12 plans + C-11 admin-wide clarification — bookkeeping interleaved). Plus 3 fix(build) commits + the merge commit pre-dating C-10. **Plus 3 amendment commits 2026-05-26** for the C-04a + C-05 cancelled-booking ease+restore bundle (§5.11). **Plus 3 amendment commits 2026-05-26** for C-13 group-booking surface (§5.12). **Plus amendment commits 2026-05-26** for C-06 Step 13 optional admin-booking email (§5.13). **Plus amendment commits 2026-05-26** for C-14 granular working hours + booking-window guard (§5.14).
- **Working tree:** clean (verify before any C-C work).
- **C-B status:** ✅ COMPLETE (21/21 plans). C-04a + C-05 amended + C-13 added + C-06 amended (Step 13) + C-14 added 2026-05-26 (§5.11–§5.14); C-08 amended + C-15 added + C-04a S7 + C-16 added + C-17 added + C-18 added + C-19 added + C-20 added + C-20 cost-amended + C-21 added 2026-07-16 (§5.15–§5.23).
- **C-C status:** ⏳ UNBLOCKED. Recommended order: **C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-15 → C-13 → C-02 → C-09 → C-03 → C-07 → C-16 → C-10** (C-14 + the C-17/C-18 co-ship pair + C-19 + C-20 + C-21 independent; C-21 recommended early).

**No outstanding work in progress.** Branch is at a clean checkpoint suitable for any of the recommended next moves.

*End of handoff. The next session opens here. Read top-to-bottom; pause at §0 template; await user direction.*
