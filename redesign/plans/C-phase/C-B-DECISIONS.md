# C-B Decisions — Answers to the 11 Open Questions

**Date written:** 2026-05-26
**Branch:** `redesign/start-state`
**Predecessor:** `redesign/HANDOFF-2026-05-25-POST-C-A.md` (handoff §6 listed the 11 open questions blocking C-B)
**Purpose:** Lock the user-direction answers that unblock C-B plan-writing. Source-of-truth for scope decisions per C-NN plan.

**How to use this doc:** When writing any `C-NN-{slug}-brief.md` or `C-NN-{slug}-plan.md`, consult §3 (per-plan scope) first, then §2 (full reasoning per question). The summary table in §1 is the single-line index.

---

## 1 — Summary table

| Q | Topic | Decision | Lands in |
|---|---|---|---|
| Q1 | C-05 vantage (B-130) | **Lock down** — cancelled/no_show inert for all roles; restore-first to act. 7 edit points via `ensureBookingActive` helper (6 from W05 §10 + B-171 past-dated). | C-05 |
| Q2 | Privacy GDPR scope | **Defer dedicated sprint.** Fold honesty fix into C-06: cascade-delete on `deletion_review.Completed` + minimal JSON export on `data_export.Completed`. B-89 ICO breach stays deferred to compliance band. | C-06 |
| Q3 | C-02 recurring bookings | All recommendations confirmed **except Hijri/Sunnah dropped**. Cadences: weekly, fortnightly, monthly. Per-occurrence cancel/reschedule. Therapist binding lockable. Hybrid 12-week horizon. Template-table schema. Single plan. | C-02 |
| Q4 | C-01 Google review email | URL: `https://g.page/r/Ccfwk27JycKDEBM/review`. Variants editable via existing `email_template_overrides` infrastructure (no new table). 10 variants (5 massage + 5 cupping). pickReviewMessages picks 3 random per email + injects `clients.city`. Trigger `bookings.status='completed'` + 2h via pg_cron. | C-01 |
| Q5 | C-06 framing | **Both entry points share one `deleteClient` primitive.** No undo window. No booking hard-delete. Plus destructive-overwrite structural fix + client edit route (Q6) + privacy wiring (Q2). | C-06 |
| Q6 | B-34 client edit surface | **Build it, fold into C-06.** Dedicated `/admin/clients/[clientId]/edit` route. All fields except id/created_at/updated_at. Email change uses same collision check. Owner/Admin edit anything; Coord operational fields only; Therapist no access. Audit log `client_updated` with diff. | C-06 |
| Q7 | C-08 event types | **5 templates:** assignment, client_assigned_therapist, booking_confirmed_client, staff_unassignment, claim. Plus per-row Resend on `/admin/emails` delivery log. Drop: review_request_client (C-01), booking_restored_client (C-04a), refund_issued (C-04b dropped), booking_completed_client (redundant with C-01). Single plan. | C-08 |
| Q8 | C-04 paired scope | **Split: C-04a only. C-04b dropped.** Payment is in-person — no in-app refund tracking. Remove dead `refunded`/`waived` from filter UI. 1-line `\|\|`→`??` reports fix. | C-04a |
| Q9 | C-09 cache approach | **Tag-based pragmatic.** Resource-level taxonomy: 7 tags (clients, bookings, staff, enquiries, settings, audit, emails). Plus filter-query FAKE cleanup folded in (~10 markers). Non-filter FAKEs distribute to future C-12+. | C-09 |
| Q10 | Therapist Field Experience | **Dedicated plan, renamed `C-FIELDWORK-EXPERIENCE-plan.md`.** Capability-keyed (`can_take_bookings` + active assignment), NOT role-keyed. `PractitionerTodaySection` drop-in component. Shared primitives: `tel:`, maps deep-link, mobile-sticky bar. | C-FIELDWORK-EXPERIENCE |
| Q11 | Per-role dashboard variants | **3 variant files matching existing `DashboardVariant` taxonomy.** `BusinessDashboard.tsx` (Owner+Admin), `CoordinatorDashboard.tsx`, `TherapistDashboard.tsx` (existing). NOT 4 — Owner+Admin stay lumped (no current divergence). Future split is cheap if needed. | C-11 |

---

## 2 — Detailed decisions

### Q1 — C-05 vantage clarification (B-130)

**The question:** master plan said "cancelled bookings can't be claimed/assigned". W05 confirmed Owner CAN at the data layer. Therapist's claimable view is UI-filtered. Which is the bug?

**Decision: lock down (interpretation #1).** Cancelled and no_show bookings are inert for all roles. To act on a cancelled booking, the actor must first restore it via the C-04a Restore button.

**Why:**
- Clean state machine. Each status has a clear allowed-action set; `cancelled`/`no_show` allow only `restore`.
- Explicit workflow. Restore is a deliberate decision with its own audit entry + client email (C-04a).
- Accurate audit trail. Any post-cancellation activity is preceded by a `booking_restored` event.
- Consistent UX. Therapist's filtered view becomes the truth across all roles, not a per-role illusion.
- Avoids the per-role override permission complexity that the inverse interpretation would require.

**Scope:** apply `ensureBookingActive(bookingId, supabase)` helper at 7 edit points:
1. `bookings/actions.ts:269-275` — `claimBookingAssignment()` guard
2. `bookings/[bookingId]/page.tsx:787-791` — `canClaim` predicate
3. `bookings/[bookingId]/page.tsx:793-794` + `:799-801` — mark-complete predicate
4. `bookings/[bookingId]/page.tsx:883-890` — `canReassignBookings` predicate
5. `bookings/page.tsx:114-122` — `claimableRows` SQL query
6. `bookings/access.ts:24-33` — `hasClaimableAssignment` predicate
7. **NEW** B-171 (R05) past-dated claimable bookings — extend helper to also reject `scheduled_at < now()`

**Sequencing constraint:** C-04a Restore button is load-bearing for this lockdown. **C-04a must land before or with C-05** — otherwise admins are stuck on a mistakenly cancelled booking with no restore path.

---

### Q2 — Privacy GDPR scope (Tier-A)

**The question:** expand Band C with `C-PRIVACY-FULFILMENT-plan.md` (cascade delete + SAR export + 30-day SLA + ICO breach workflow + role-trust angle B-158), or defer?

**Decision: defer the dedicated sprint. Fold honesty fix into C-06.** Minimal completion of what's already in the existing UI — make the buttons stop lying.

**Per-bug disposition:**

| Bug | Severity | Disposition |
|---|---|---|
| B-87 — Completed on `deletion_review` doesn't delete | P0 | **Fold into C-06.** Privacy "Completed" calls the new `deleteClient(reason='gdpr_erasure')` primitive. |
| B-88 — Completed on `data_export` produces nothing | P0 | **Fold into C-06.** Minimal JSON dump of client + bookings + notes (excluding `sensitive_notes`) attached or downloaded on click. No PDF template, no branded report. |
| B-89 — 72h ICO breach workflow missing | P0 | **Deferred to compliance band.** Already excluded per master-plan §130 ("Tier-A compliance programme... out of Band C scope"). |
| B-90 — 30-day SLA timer missing | P1 | **Skip.** Not P0. |
| B-158 — Admin role-trust angle | meta | **No separate action.** Dissolves automatically once B-87/B-88 are honest. |

**Result:** Open Q5 (C-06 framing) becomes "primarily privacy-workflow-driven since that's the GDPR seat" — confirmed. No `C-PRIVACY-FULFILMENT-plan.md` file is written.

**Accepted trade-offs (stated for transparency):**
- No SLA timer → aged-out requests stay "Received" forever; Admin eyeballs dates.
- No ICO breach workflow → manual scramble if ever needed.
- Plain JSON export, not branded PDF.

All acceptable given the "bare minimum within existing plan" framing.

---

### Q3 — C-02 recurring bookings (7 sub-questions)

**Confirmed recommendations:**

| # | Question | Decision |
|---|---|---|
| 1 | Which services support recurrence? | **All services, on by default.** Per-service opt-out flag exists but starts off. |
| 2 | Which roles can set it? | **Owner + Admin + Booking Coordinator.** Not Therapist. Not public booking form. |
| 3 | Cadence options | **Weekly, fortnightly, monthly (same day-of-month).** No custom interval. |
| 4 | End-conditions | **All three: until cancelled, after N occurrences, until specific date.** |
| 5 | Single-occurrence cancellation | **Per-occurrence default.** Explicit "Cancel series" button for ending the whole thing. |
| 6 | Reschedule cascade | **Per-occurrence only.** No "shift all subsequent" feature. |
| 7 | Therapist binding | **Locked by default** (same therapist for whole series). "Open to any therapist" toggle at series creation. |

**Dropped from earlier scope:** Hijri/Sunnah-day support. No Hijri converter. No `cadence_meta jsonb` column. Cadence enum is just 3 values.

**Adjacent decisions:**
- **A. Generation strategy:** hybrid — generate next 12 occurrences as concrete `bookings` rows at series creation; nightly cron extends horizon to maintain 12-week visibility.
- **B. Hijri/Sunnah-days:** **out of scope.** No converter, no dependency, no schema.
- **C. Schema:** dedicated `recurring_booking_templates` table + `bookings.recurring_template_id` FK.

**Migration footprint:**
1. `recurring_booking_templates` table (id, client_id, service_id, role_constraint, therapist_id nullable, cadence enum, end_type enum, end_count nullable, end_date nullable, created_by, created_at, cancelled_at nullable)
2. `bookings.recurring_template_id uuid nullable` column with FK
3. RPC `create_recurring_booking_series(template_input, p_horizon_weeks)` — writes template + generates initial 12-week horizon
4. Cron job `extend_recurring_series_horizons` — daily, walks active templates, generates next bookings up to 12 weeks ahead

**Plan size:** single C-02 plan (backend + frontend + email together). Don't split — verification gate is end-to-end.

---

### Q4 — C-01 Google review email

**Google review URL:** `https://g.page/r/Ccfwk27JycKDEBM/review`

**Approach for review-message variants:** category-level pools with `{city}` placeholder, picked randomly per email.

- **Pools keyed off `services.group_category`** — values `massage` and `cupping`.
- **5 variants per pool** (10 total). Pick 3 at random per email send.
- **`{city}` substituted from `clients.city`** — if null, the city-containing phrase is stripped cleanly.
- **No in-clinic variant** — all services are mobile per `HomeAppointmentProcess.tsx` / public site copy ("We come to you").

**Editable via existing `email_template_overrides` infrastructure.** This is the critical architectural finding — the override table already exists with schema `(template_id, field_key, value, updated_by, updated_at)` and is in use by 9 other templates via `resolveTemplateOverrides` in `templates.ts`. **No new schema. No new admin UI infrastructure.**

**Field layout in `email_template_overrides` for `template_id='review_request_client'`:**
```
field_key                value (default in code, overridable via admin UI)
─────────────────────────────────────────────────────────────────────────
subject                  "Thank you for visiting Rahma Therapy"
body_intro               "Thank you for choosing Rahma Therapy for your {service_name}..."
body_ask                 "If you have a moment, we'd be grateful for an honest review..."
body_cta_label           "Leave a Google review"
body_cta_url             "https://g.page/r/Ccfwk27JycKDEBM/review"
body_signoff             "Thank you again, The Rahma Therapy team"
massage_variant_1..5     (5 starter variants — see below)
cupping_variant_1..5     (5 starter variants — see below)
```

**Starter variant pools (locked at this stage — admin can edit later via admin UI):**

Massage pool:
1. `"I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end."`
2. `"Booked a home massage with Rahma Therapy in {city}. The therapist was excellent, the experience felt like a proper clinic but in the comfort of home."`
3. `"Just had a fantastic massage at home in {city}. Highly skilled, deeply relaxing, and so easy not having to travel."`
4. `"Tried Rahma Therapy for a mobile massage in {city} — top quality. Will definitely book again."`
5. `"Excellent home massage experience in {city}. Calm, professional, and exactly what I needed."`

Cupping/hijama pool:
1. `"Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful."`
2. `"Booked hijama at home in {city} — proper Sunnah practice, sterile equipment, and a calming atmosphere. Highly recommend."`
3. `"Excellent home hijama appointment in {city}. Felt looked after from start to finish, the setup was spotless and professional."`
4. `"Tried Rahma Therapy for hijama in {city} and couldn't be happier. Knowledgeable practitioner, careful technique, and great aftercare."`
5. `"First hijama session in {city} and it was a brilliant experience. Clean, professional, and the practitioner explained every step."`

**Trigger:** `bookings.status='completed'` + 2 hours, via pg_cron polling every 15 min. `bookings.completed_at` set automatically by trigger on status flip. Sentinel guard on `bookings.review_email_sent_at` — exactly one email per booking, ever.

**C-01 scope (revised, smaller than originally drafted):**
1. Migration: `bookings.completed_at` + `bookings.review_email_sent_at` columns + trigger
2. Renderer `renderReviewRequestEmail` in `templates.ts` with default copy + `resolveTemplateOverrides` integration
3. Add to `SUBJECTS` map in `email-templates/actions.ts`
4. Register in `templates-data.ts` so it appears in admin email-templates UI
5. Send fn `sendReviewRequestEmail(bookingId, ...)` with sentinel guard
6. Scheduler: pg_cron job every 15 min
7. Email event type: `review_request_client`
8. Audit log type: `review_email_sent`

---

### Q5 — C-06 framing

**Decision: both entry points share one `deleteClient` primitive.**

**One primitive, two entry points:**

```ts
deleteClient(clientId, reason, supabase)
  // Soft-delete client, soft-delete bookings, anonymise audit_log target labels,
  // hard-delete sensitive_notes. Audit log entry with reason.
```

- **Entry point 1: Privacy workflow.** `deletion_review` "Completed" → `deleteClient(reason='gdpr_erasure')`.
- **Entry point 2: Admin Delete button.** Delete button on `/admin/clients/[id]` → confirmation modal → `deleteClient(reason='admin_delete')`.
- **Bulk-delete:** same primitive in a loop, behind a confirm-count modal.

**What's NOT in C-06:**
- No "undo" window (master plan flagged as optional; adds complexity).
- No hard-delete of bookings (audit trail needed for tax + ICO records).
- No staff/services hard-delete (other surfaces; out of scope).

**Why "both" rather than privacy-only:**
Deleting a duplicate test client shouldn't require Admin to create a fake privacy request first. Privacy workflow is the regulated entry point; Delete button is the operational entry point. Same destructive effect, same audit log entry.

**Plus the destructive-overwrite headline** (B-110 + B-131) — `create_booking_request` RPC switches `on conflict (email) do update` → `do nothing + raise structured exception`, adds `p_client_id` parameter, lifts `DuplicateWarningBanner` into `ManualBookingForm`.

**Plus client edit route** (Q6 fold-in — see below).

**Full C-06 scope (11 steps):**
1. SQL: `create_booking_request` — add `p_client_id`, switch `do update` → `do nothing`, raise structured exception
2. Form: hidden `client_id`, lift `DuplicateWarningBanner` into `ManualBookingForm`
3. Server action: `updateClient(clientId, patch, supabase)` with email-collision check + audit log
4. NEW route: `/admin/clients/[clientId]/edit` + form
5. "Edit" button on `/admin/clients/[clientId]` page header (RBAC-gated)
6. Coordinator field-level gating (some fields read-only for Coord role)
7. Server action: `deleteClient(clientId, reason, supabase)` — soft-delete cascade + sensitive-notes hard-delete
8. Delete button on `/admin/clients/[clientId]` + bulk-delete on `/admin/clients` list
9. Privacy wiring: `deletion_review` "Completed" → `deleteClient(reason='gdpr_erasure')`
10. Privacy wiring: `data_export` "Completed" → minimal JSON export server action + download
11. Migration: schema deltas for the RPC + audit_log action_types `client_updated`

---

### Q6 — B-34 client edit surface

**Decision: build it, fold into C-06.** Folded via §5 above.

**Editable fields:** all `clients` table columns except `id`, `created_at`, `updated_at`.

- `full_name`, `phone`, `email`, `address`, `postcode`, `city`, `area`, `notes`, `client_source`, `source_detail`
- `gender_preference` — editable with a warning: "This affects therapist matching for future bookings — existing bookings keep their original assignment"

**Special cases:**
- **Email change** — same collision check as the C-06 create fix. If new email matches existing different client, hard error: "Email already in use by [other client name]. Resolve manually."
- **Phone change** — plain update (no enforced uniqueness in schema).
- **No retroactive cascade to bookings.** Historic bookings keep their snapshot. Editing the client only affects future bookings and the canonical record.

**RBAC:**
- **Owner + Admin:** edit anything.
- **Booking Coordinator:** edit operational fields (phone, address, city, area, notes). Cannot change identity fields (full_name, email, gender_preference).
- **Therapist:** no edit access.

**UI shape:** dedicated `/admin/clients/[clientId]/edit` route, mirroring the create form. Consistent with existing admin pattern (services, staff use dedicated edit pages). "Edit" button on `/admin/clients/[clientId]` page header.

**Audit log:** new action_type `client_updated`. Diff of changed fields stored (which fields, from→to). Don't log unchanged fields.

---

### Q7 — C-08 scope (email event types)

**5 new templates ship in C-08:**

| Template | Trigger | Recipient |
|---|---|---|
| `assignment` | `assignBookingToStaff` / `claimBookingAssignment` | Assigned practitioner (any role with `can_take_bookings`) |
| `client_assigned_therapist` | Same trigger, fires every assignment change | Client (always informed who's coming, including reassignment) |
| `booking_confirmed_client` | `quickConfirmBooking` pending→confirmed | Client |
| `staff_unassignment` | `unassignBookingFromStaff` / reassign flow | Removed practitioner |
| `claim` | `claimBookingAssignment` | Admin (operational awareness) |

**Plus tooling:** per-row Resend button on `/admin/emails` delivery log. Server action `resendEmail(deliveryEventId)` looks up original event, re-renders, sends, logs new event.

**Dropped from earlier scope:**
- `review_request_client` — ships in C-01
- `booking_restored_client` — ships in C-04a
- `refund_issued` — C-04b dropped (no in-app refund tracking)
- `booking_completed_client` — redundant with C-01 review email (intro paragraph carries the completion thanks)

**Implementation pattern per template (consistent):**
1. Add renderer `render{Name}Email` in `templates.ts` with default copy + `resolveTemplateOverrides`
2. Add to `SUBJECTS` map in `email-templates/actions.ts`
3. Register in `templates-data.ts` so it appears in admin email-templates UI
4. Add to `email_event_type` if needed
5. Add send fn `send{Name}Email`
6. Wire into trigger server action
7. Log to `email_delivery_events` on send

**Cross-cutting:** all assignment-related emails fire to any practitioner with `can_take_bookings=true`, not just role=therapist. Aligned with Q10 capability-keyed model.

**Plan size:** single C-08 plan. Pattern repeats; one verification gate.

---

### Q8 — C-04 paired scope

**Decision: split. C-04a only. C-04b dropped.**

**C-04a — cancellation/restore (ships first, unblocks C-05):**
1. Explicit Restore button on `/admin/bookings/[id]` (current "restore from audit log" UX is a lie per W04 B-121)
2. `sendBookingRestoredClientEmail` — currently restore is silent to client (W04 B-120)
3. State-machine guard against `completed → pending/confirmed` without `force=true` (W04 B-122)
4. No-show quick action in `quickUpdateBooking` (W03 B-117)
5. **Assigned-practitioner auto-promote** — when all assignments complete, auto-promote `booking.status` to completed (R04 B-168). Note: renamed conceptually from "therapist auto-promote" since Q10 made this capability-keyed.
6. New audit log action_type: `booking_restored` (verify if not already present)
7. New email_event_type: `booking_restored_client`
8. **Hygiene tail:** remove dead `refunded` and `waived` from payment-status filter UI (W09 B-143 — payment is in-person, no in-app refund tracking)
9. **Hygiene tail:** 1-char fix in `reporting.ts:417` — change `\|\|` → `??` for `completedRevenue` (W09 B-148)

**C-04b — DROPPED.** Payment is in-person. No in-app refund tracking. No refund modal. No `payment_status` enum extension. No `booking_refund_recorded` audit type. No `refund_issued` email.

---

### Q9 — C-09 cache-invalidation approach

**Decision: tag-based pragmatic with resource-level taxonomy.**

**Tag taxonomy:**

| Tag | Set by (mutations) | Read by (pages) |
|---|---|---|
| `clients` | Client CUD, manual booking create, privacy delete | `/admin/clients`, `/admin/clients/[id]`, `/admin/bookings/new` (autocomplete) |
| `bookings` | Booking CUD, quick-actions, cancel, restore, assignment changes | `/admin/bookings*`, `/admin/calendar`, `/admin/dashboard`, `/admin/reports` |
| `staff` | Staff CUD, assignment changes, availability changes | `/admin/staff*`, `/admin/bookings/new` (therapist picker), `/admin/calendar` |
| `enquiries` | Enquiry CUD, convert | `/admin/enquiries*`, `/admin/dashboard` |
| `settings` | Settings save | Anywhere reading `business_settings` |
| `audit` | Any server action that writes to `audit_logs` | `/admin/audit`, `/admin/operations` |
| `emails` | Email events, template changes | `/admin/emails`, `/admin/email-templates/preview/[id]` |

**Pattern:**
- Server action ends with `updateTag('clients')` (one or many, depending on what it touched).
- Page data fetchers wrap reads in `unstable_cache(fn, key, { tags: ['clients'] })`.
- Convention documented once in the C-09 plan.

**Why resource-level (not per-id):** current admin surfaces don't have a hot enough single-record read path to justify per-id tag bookkeeping. Add later if a specific page proves slow.

**Plus filter-query FAKE cleanup folded into C-09** (the natural pair):

| Surface | FAKE markers (filter-query) |
|---|---|
| `/admin/enquiries` | ×2 |
| `/admin/staff` (list) | ×1 |
| `/admin/operations` | ×3 |
| `/admin/emails` | ×2 |
| `/admin/privacy` | ×2 |

~10 filter-query placeholders wired to real server queries during the cache pass.

**Heterogeneous non-filter FAKEs distribute to C-12+** (not C-09):
- `emails` FAILURE-PATH, `roles` delete-role stub, `account-password-requests` notes-not-persisted ×2, `email-templates` RBAC gate, `audit` target-existence, `staff` workload-aggregates.
- The reports TODO is already in C-04a hygiene tail.

**C-09 scope:**
1. Document tag taxonomy as the cache convention
2. Cache wrapper retrofit on existing page data fetchers
3. `updateTag(...)` retrofit into 3 known offenders (B-149 settings, B-113 manual booking, B-128 assignment changes) + sweep `src/app/admin/**/actions.ts` for misses
4. Filter-query FAKE cleanup (~10 markers across 5 surfaces)
5. Verification: Playwright mutate-and-observe pass + filter sweep per surface

---

### Q10 — Therapist Field Experience → Fieldwork Experience

**Decision: dedicated plan, renamed `C-FIELDWORK-EXPERIENCE-plan.md`.** Capability-keyed (`can_take_bookings` + active assignment on booking), NOT role-keyed.

**Audit finding driving the rename:** `staff_profiles.can_take_bookings` (boolean, NOT NULL) already exists as the canonical "this user fulfils bookings" flag. Used in 20+ places already (rbac.ts:103, availability.ts:431, assignment-eligibility.ts:243, bookings/new/page.tsx:82, etc.). Per-user, not per-role. Owner can have it on or off.

**Capability predicate:**
```ts
isViewerAssignedPractitioner(booking, viewerStaffId, viewerCanTakeBookings): boolean
  // true iff viewer is in booking_assignments AND has can_take_bookings=true
```

**Two render paths per surface:**

- **Booking detail page** (`/admin/bookings/[bookingId]`)
  - Practitioner view (predicate true): mobile sidebar reordered, client phone + address prominent at top, `tel:` link, maps deep-link, mobile-sticky complete action
  - Admin-curator view (predicate false): current default layout

- **Dashboard** — `PractitionerTodaySection` drop-in component, conditional on `can_take_bookings=true`. Renders in any dashboard variant (Business / Coordinator / Therapist).

**Bundled scope:**

Mobile booking-detail ergonomics (R04 bugs):
- B-164: reorder mobile sidebar so client phone + address are top, not below 5+ admin panels
- B-165 through B-169 (R04 bundle — verify specifics during plan-writing)
- Mobile-sticky "Mark complete" / quick-action bar

Communication primitives:
- `tel:` deep-link on client phone
- `https://www.google.com/maps/dir/?api=1&destination=...` on client address
- Optional `sms:` deep-link for "Running 5 min late" quick text

Fieldwork-specific UI:
- Time-of-day greeting (already exists in TherapistDashboard via `getGreeting()` — extract to shared util used by all variants)
- Pull-to-refresh on dashboard (R05 pattern lift)
- "Today" view filtered prominently

**Explicitly out of scope (don't creep):** offline cache / PWA, native app, push notifications, real-time location sharing.

**Coordination with prior decisions:**
- C-05 lockdown role-agnostic (already aligned)
- C-04a auto-promote keyed by assignment-status not role (renamed to "assigned-practitioner auto-promote")
- C-08 assignment-related emails fire to any practitioner regardless of role
- C-11 dashboard variants each slot the `PractitionerTodaySection` conditionally

**Verification gate (Playwright at 375px) — ALL roles with `can_take_bookings=true`:**
1. Dashboard renders practitioner section (when capability flag on)
2. Booking detail renders practitioner view (when viewer is assigned)
3. `tel:` opens dialer
4. Maps deep-link opens
5. Mobile-sticky complete button accessible
6. Mark complete → toast + back to dashboard

**Test fixture note:** Owner test account (`rahmatherapy@outlook.com`) currently — verify `can_take_bookings` state; may need to flip true for the practitioner-path test.

---

### Q11 — Per-role dashboard variants

**Audit finding (correction to original framing):** existing `DashboardVariant` type already has 3 values — `"business" | "coordinator" | "therapist"` (+ `"blocked"`). Owner and Admin both map to `"business"`. Coordinator is effectively its own variant via extensive inline conditional logic in `page.tsx` (~10 flags: `revenueAllowed`, `showPaymentsReadiness`, `isCoordinatorVariant`, `getDashboardCopy(plan.variant)`, `tilesForVariant(stripeVariant)`, etc.).

**Decision: extract 3 dashboard files matching existing taxonomy, NOT 4.**

| File | Status | Serves | Existing variant key |
|---|---|---|---|
| `BusinessDashboard.tsx` | NEW (extract from `page.tsx`) | Owner + Admin | `"business"` |
| `CoordinatorDashboard.tsx` | NEW (extract from `isCoordinatorVariant` paths) | Booking Coordinator | `"coordinator"` |
| `TherapistDashboard.tsx` | Exists — refactor to consume shared blocks | Therapist | `"therapist"` |

`page.tsx` becomes a thin router: resolves variant → renders matching component.

**Why NOT split Owner from Admin:**
- Current code doesn't distinguish them. No divergence to extract.
- Splitting would require growing the `DashboardVariant` type, adding owner/admin detection in `resolveAdminShellVariant`, designing two near-identical dashboards.
- Clinic has one Owner today. Owner is the main admin operationally. Pre-committing to a split that doesn't exist is speculative work.
- If Owner vs Admin needs to diverge later, split is cheap: add variant key + extract divergent paths from `BusinessDashboard.tsx`.

**Shared building blocks library** (used by all variants):
- `PractitionerTodaySection` (from C-FIELDWORK)
- `RevenueStripe` (Owner + scoped Admin)
- `EnquiriesTodoStripe` (Business + Coordinator)
- `ClaimQueueStripe` (Coordinator + any practitioner with claim_assignments)
- `PendingBookingsStripe` (Business + Coordinator)
- `ScheduleGapStripe` (Coordinator)
- `RecentActivityStripe` (Business)
- `EmptyState` narrative pattern (lift from TherapistDashboard, used everywhere)
- `QuickHelpPanel` "Need help?" (lifted, role-tailored content)
- `DashboardHeader` with time-of-day greeting (shared util)
- `MobileStickyActionBar` (shared)

**C-11 scope (single plan, phased execution):**
1. Define shared building blocks + design system tokens
2. Extract `BusinessDashboard.tsx` from `page.tsx` inline branch (pure refactor — no behaviour change)
3. Extract `CoordinatorDashboard.tsx` from `isCoordinatorVariant` paths
4. Refactor `TherapistDashboard.tsx` to consume shared blocks
5. Slim `page.tsx` to a thin variant router
6. Integrate `PractitionerTodaySection` conditionally in each variant
7. Dark mode default + toggle
8. Motion-reduce pass on `animate-spin` instances

**Verification gate:** Playwright at 375 / 768 / 1280 / 1440 across all role × `can_take_bookings` combinations, both modes (light/dark).

**Future split path (documented, not built now):** Owner from Admin — add `"owner"` variant key, update resolver, extract `OwnerDashboard.tsx` from `BusinessDashboard.tsx`.

---

## 3 — Updated C-NN plan inventory + scope

| Plan | Status | Brief summary |
|---|---|---|
| **C-01** Google review email | scoped | Migration (`completed_at`, `review_email_sent_at`) + renderer with overrides + scheduler (pg_cron 15min) + send fn + register in admin email-templates UI. Variants editable via existing `email_template_overrides`. Trigger: `bookings.status='completed'` + 2h. |
| **C-02** Recurring bookings | scoped | `recurring_booking_templates` table + RPC + cron + form + calendar badging + email. Weekly/fortnightly/monthly only. Hybrid 12-week horizon. Single plan. No Hijri/Sunnah. |
| **C-03** Enquiry → booking conversion | scoped | Narrow fix (~half-day) — service fuzzy-match + cross-page bug bundle from W01. |
| **C-04a** Cancellation restore | scoped | Restore button + email + state-machine guard + no-show quick action + assigned-practitioner auto-promote + hygiene tail (remove dead refunded/waived filters + 1-char reports fix). Ships before/with C-05. |
| **C-04b** Refund modal | **DROPPED** | Payment is in-person. No in-app refund tracking. |
| **C-05** Lock cancelled/no_show inert | scoped | `ensureBookingActive` helper at 7 edit points (6 from W05 + B-171 past-dated). Sequencing: lands after or with C-04a. |
| **C-06** Client CRUD hardening | scoped | Destructive-overwrite fix (RPC + form) + `updateClient` + edit route + Delete button + bulk-delete + `deleteClient` primitive + privacy wiring (deletion_review + data_export JSON export). 11 steps. Largest plan alongside C-02. |
| **C-07** Cross-page routing | scoped | Split C-07a (routing primitives) + C-07b (per-role defaults). Bundle of bugs from C-A.3. |
| **C-08** Email automation expansion | scoped | 5 new templates + per-row Resend on delivery log. Single plan. |
| **C-09** Cache invalidation + filter FAKE cleanup | scoped | Tag-based pragmatic (7 resource-level tags) + ~10 filter-query FAKE markers wired. |
| **C-10** Bottom-of-page spacing | unchanged | Playwright 375 audit pass to catalogue, then fix. |
| **C-11** Dashboard variants + design system | scoped | Extract 3 variant files (Business / Coordinator / Therapist) + shared building blocks + R05 pattern lifts + dark mode + motion-reduce pass. Single phased plan. |
| **C-FIELDWORK-EXPERIENCE** | scoped | Capability-keyed (not role-keyed) fieldwork ergonomics. Booking detail dual-view + dashboard `PractitionerTodaySection` drop-in + `tel:` / maps / mobile-sticky primitives. |
| **C-PRIVACY-FULFILMENT** | **NOT WRITTEN** | Folded into C-06 (honesty fix only). Full GDPR sprint deferred to separate compliance band. |
| **C-12+** | future | Inventory: heterogeneous FAKE markers (emails FAILURE-PATH, roles delete-role, account-password-requests notes-persistence, email-templates RBAC gate, audit target-existence, staff workload-aggregates), B-90 SLA timer, B-89 ICO breach workflow (compliance band), Owner-from-Admin dashboard split (if/when needed). |

---

## 4 — Cross-cutting implications

### Sequencing constraints

- **C-04a must land before or with C-05** — Restore button is load-bearing for lockdown. Otherwise admins are stuck on mistakenly cancelled bookings.
- **C-FIELDWORK ships `PractitionerTodaySection` component**; C-11 consumes it in each dashboard variant. C-FIELDWORK can ship first or in parallel; C-11 just slots it conditionally.
- **C-01 uses existing `email_template_overrides` infrastructure** — no dependency on C-08. C-01 ships independently.

### Capability-keyed (not role-keyed) discipline

`staff_profiles.can_take_bookings` is the canonical predicate for practitioner work. Applies across:
- C-04a auto-promote (any assigned practitioner)
- C-05 lockdown applies to all roles
- C-08 assignment-related emails fire to any practitioner
- C-FIELDWORK booking detail dual-view + dashboard practitioner section
- C-11 dashboard variants each slot the practitioner section conditionally

**Rename in C-04a plan:** "therapist auto-promote" → "assigned-practitioner auto-promote".

### Migrations needed (Zone-2 — explicit user confirmation per migration in C-C)

- **C-01:** `bookings.completed_at` + `bookings.review_email_sent_at` + trigger
- **C-02:** `recurring_booking_templates` table + `bookings.recurring_template_id` FK + RPC + cron job
- **C-06:** `create_booking_request` RPC change (`p_client_id` parameter + `do nothing`) + audit_log action_types (`client_updated`)
- **C-08:** no schema migration (uses existing `email_template_overrides` + `email_delivery_events`)

### Test fixture additions needed

- Owner test account practitioner-path test: flip `can_take_bookings=true` for the existing Owner account during C-FIELDWORK verification, OR add a new test fixture `test.owner.practitioner@rahmatherapy.example.test`. Decide during C-FIELDWORK plan-writing.

### Documentation updates

When this doc lands, update:
- `redesign/HANDOFF-2026-05-25-POST-C-A.md` §6 — mark all 11 questions answered, point at this doc
- `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` Part 2 — update each C-NN item to reflect final scope

---

## 5 — Next steps in (D)→(C)→(B)→(A) sequence

Per handoff §7 recommended sequence:

- **(D) — Batch-answer the 11 questions:** ✅ **DONE** (this doc).
- **(C) — Test-data cleanup (~30 min Zone-2 SQL pass):** PENDING user direction. Independent low-effort hygiene to delete `Phase10 *`, `Audit *`, `Test *`, Arabic-prefix, unicode/emoji/RTL stress fixtures across staff/clients/enquiries/bookings.
- **(B) — Tier-A Privacy GDPR sprint:** DEFERRED per Q2 decision. Honesty fix folded into C-06.
- **(A) — C-B plan-writing:** UNBLOCKED. 13 plans to write (C-01 through C-11 plus C-FIELDWORK; C-04b dropped, C-PRIVACY not written).

**Recommended C-B plan-writing order** (informed by sequencing constraints + dependency graph):

1. **C-06** — biggest plan + headline data-integrity fix (destructive overwrite). Write first.
2. **C-04a** — load-bearing for C-05. Write second.
3. **C-05** — lockdown. Write third.
4. **C-01** — review email. Independent. Write fourth.
5. **C-FIELDWORK-EXPERIENCE** — capability-keyed. Write fifth (informs C-11).
6. **C-11** — dashboard variants. Write sixth.
7. **C-08** — email automation. Write seventh.
8. **C-02** — recurring bookings. Big plan. Write eighth.
9. **C-09** — cache invalidation + FAKE cleanup. Write ninth.
10. **C-03** — enquiry conversion. Narrow. Write tenth.
11. **C-07** — split into C-07a + C-07b. Write eleventh.
12. **C-10** — spacing. Quick. Write last.

This order can flex; nothing strict beyond the C-04a → C-05 sequence and C-FIELDWORK → C-11 informational dependency.

---

*End of decisions doc. C-B plan-writing is unblocked. Next user direction needed: do (C) test-data cleanup first, or jump straight to (A) plan-writing? If (A), confirm the recommended plan-writing order or override.*
