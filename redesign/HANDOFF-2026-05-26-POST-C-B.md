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

> Loaded the post-C-B handoff. On `master` HEAD [SHA] clean. [N] commits ahead of origin/master. **All of C-B is complete — 12/12 plans (each with brief + plan).** `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` checklist shows C-B ✅ as of 2026-05-26. **C-C implementation is unblocked.** Pre-flight: [dev server status via curl, working tree status, any deviations from documented state]. Recommended C-C sequence per `C-B-DECISIONS.md` §5: **C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-02 → C-09 → C-03 → C-07 → C-10**. C-04a + C-FIELDWORK are sequencing-critical (load-bearing for C-05 + C-11 respectively). Awaiting user direction on which plan to ship first.

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

## 3 — The 12 C-B plans (all ✅ brief + plan written 2026-05-26)

Each row links the brief + plan + summarises scope + key decisions + sequencing.

### C-06 — Client CRUD hardening + destructive-overwrite fix + privacy honesty fold

- **Brief:** `redesign/briefs/C-06-client-crud-hardening-brief.md` (464 lines)
- **Plan:** `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md` (~690 lines)
- **Scope:** 11 steps. Kill destructive `on conflict (email) do update` in `create_booking_request` RPC + lift DuplicateWarningBanner into ManualBookingForm + new `/admin/clients/[clientId]/edit` route + `updateClient` action with email-collision check + Coord field-level gating via new `manage_client_identity_fields` permission + `deleteClient` shared primitive (soft-delete client, cascade open bookings, hard-delete sensitive notes) + Delete button + bulk-delete + privacy `deletion_review` Completed handler calls `deleteClient(gdpr_erasure)` + `data_export` Completed generates minimal JSON export.
- **Migration:** Zone-2 — `clients.deleted_at` + `bookings.deleted_at` columns + 2 new permissions + RPC change + role_permissions seed for Owner+Admin.
- **Cross-plan update needed:** C-02 flagged that `deleteClient` cascade must ALSO cancel active recurring templates for the client (since `recurring_booking_templates.client_id` has `ON DELETE RESTRICT`). Add this to the cascade.

### C-04a — Cancellation restore + auto-promote + hygiene tail

- **Brief:** `redesign/briefs/C-04a-cancellation-restore-brief.md` (604 lines)
- **Plan:** `redesign/plans/C-phase/C-04a-cancellation-restore-plan.md` (~895 lines)
- **Scope:** 9 changes. Restore button + `restoreBooking` action + `sendBookingRestoredClientEmail` + state-machine guard (`completed → *` requires confirm modal + reason) + `no_show` quick action + assigned-practitioner auto-promote (capability-keyed) + 3 new audit/email types + hygiene tail (remove dead `refunded`/`waived` filter UI + `reporting.ts:438` `||→??` 1-char fix — RECON §5 exception per C-B-DECISIONS Q8).
- **Migration:** None expected — verify `email_delivery_events.event_type` is unconstrained (it is, per C-08 plan-writing finding).
- **Sequencing:** **MUST ship before or with C-05.** Restore button is load-bearing for C-05's lockdown.

### C-05 — Lock cancelled / no_show / past-dated bookings inert

- **Brief:** `redesign/briefs/C-05-cancelled-bookings-inert-brief.md` (468 lines)
- **Plan:** `redesign/plans/C-phase/C-05-cancelled-bookings-inert-plan.md` (~645 lines)
- **Scope:** 7 edit points (6 from W05 §10 + B-171 past-dated). New `ensureBookingActive(bookingId, supabase)` helper returns discriminated union (active true / not_found / cancelled / no_show / past_dated / client_deleted). Server-action defense at `claimBookingAssignment` + `updateBookingAssignment`. UI defense-in-depth at 4 detail-page predicates. SQL `!inner` JOIN at the claimableRows fetch + in-memory past-date filter. `updateOwnAssignmentStatus` is **explicitly NOT gated** (forensic edge case — see plan §1 Step 6).
- **Migration:** None (pure code).
- **Sequencing:** Lands AFTER C-04a (Restore is the survival path).

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

- **Brief:** `redesign/briefs/C-08-email-automation-expansion-brief.md` (476 lines)
- **Plan:** `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md` (~895 lines)
- **Scope:** 4 NEW templates (booking_confirmed_client, staff_unassignment, claim, client_assigned_therapist) + 1 existing verification (staff_assignment templates-data.ts field-list audit). Per-row Resend tooling on `/admin/emails` delivery log with `resendEmail` server action + `dispatchResend` switch + 60s rate-limit + `metadata.resent_from_event_id` linkage. Capability-keyed recipient resolution (any `can_take_bookings=true` practitioner).
- **Migration:** Conditional 1-line ALTER TABLE if `email_delivery_events.metadata jsonb` doesn't exist. **No CHECK constraint extension needed** — verified `event_type` is free-text.
- **Reframe note:** Decisions doc Q7 said "5 new templates"; actual is 4 new + 1 existing-verify because `staff_assignment` already exists (verified in code).

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
- **Sequencing:** Ships LAST so it catalogues new routes from C-06 + C-02 alongside existing surfaces.

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

---

## 6 — Cross-plan coordination + dependencies + sequencing

### 6.1 Hard sequencing constraints

| Plan | Must ship | Reason |
|---|---|---|
| C-04a | Before or with **C-05** | C-05's lockdown needs Restore button as escape hatch |
| C-FIELDWORK | Before or with **C-11** | C-11 imports PractitionerTodaySection + shared-helpers |
| **C-06 amendment** (deleteClient cascade) | Before **C-02 ships** | FK is `ON DELETE RESTRICT`; cascade must cancel templates |
| C-01 | Before **C-02** ships | Cron infrastructure pattern is the lift target |

### 6.2 Soft sequencing (recommended order)

Per C-B-DECISIONS §5: **C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-02 → C-09 → C-03 → C-07 → C-10**.

Order rationale:
- C-06 first — biggest data-integrity fix.
- C-04a → C-05 — locked sequence.
- C-01 → C-02 — cron infrastructure first.
- C-FIELDWORK → C-11 — drop-in component first.
- C-09 ninth — tag sweep catches all prior plans' new actions.
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

### C-B plan-writing outputs (12 briefs + 12 plans)

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
└── C-FIELDWORK-EXPERIENCE-brief.md

redesign/plans/C-phase/
├── BAND-C-MASTER-PLAN.md                                     # master checklist (12/12 ✅ as of 2026-05-26)
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
- **HEAD:** `8b9ad1c`
- **Commits this session (C-B plan-writing):** 24 (12 briefs + 12 plans + C-11 admin-wide clarification — bookkeeping interleaved). Plus 3 fix(build) commits + the merge commit pre-dating C-10.
- **Working tree:** clean (verify before any C-C work).
- **C-B status:** ✅ COMPLETE (12/12 plans).
- **C-C status:** ⏳ UNBLOCKED. Recommended order in `C-B-DECISIONS.md` §5.

**No outstanding work in progress.** Branch is at a clean checkpoint suitable for any of the recommended next moves.

*End of handoff. The next session opens here. Read top-to-bottom; pause at §0 template; await user direction.*
