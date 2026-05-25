# HANDOFF — Post-C-A (Band C Audit Phase Complete)

**Date written:** 2026-05-25
**Branch:** `redesign/start-state`
**HEAD at handoff:** `84045f4` (clean working tree)
**Commits ahead of master:** 253
**Predecessor handoff:** `redesign/HANDOFF-2026-05-21.md` (Band B closure, 2026-05-21)

**What this doc is:** the single self-contained context for the next session to pick up Band C work. Mirrors the precedent set by `HANDOFF-2026-05-21.md`. Open this first, then drill into the linked sub-docs as needed.

---

## 0 — Opening template for the next session

When the next session opens, the opener should output (literal text):

> Loaded the post-C-A handoff. On `redesign/start-state` HEAD `84045f4` clean. 253 commits ahead of master. **All of C-A is complete** — 25 per-surface audits + 10 per-workflow audits + 5 per-role-day audits = 40 audit files, 173 bugs catalogued (B-01..B-173). Read `redesign/HANDOFF-2026-05-25-POST-C-A.md` end-to-end. Pre-flight: [dev server status via curl, working tree status, any deviations from documented state]. **C-A discovery is done; we're at the C-A → C-B inflection point.** The 4 things needing user direction: (1) Tier-A Privacy GDPR sprint (P0 regulatory — B-87/88/89 + B-158) — yes/no/defer? (2) test-data cleanup (~30 min) — do first or skip? (3) the 11 open questions blocking C-B (see §6 of handoff) — answer in batch now or inline as plans are written? (4) which C-B plan to write first. Awaiting user direction.

Then pause. Do not proceed without user direction on at least (1) and (3).

---

## 1 — Programme location: where we are

**Band C arc:** post-Band-B programme = comprehensive audit + 11 user-prioritised items + adjacent fixes.

Three phases:
- **C-A (Audit pass)** — ✅ **COMPLETE 2026-05-25**.
- **C-B (Plan-writing)** — ⏳ pending.
- **C-C (Implementation)** — ⏳ blocked on C-B.

**C-A breakdown:**

| Phase | What | Status | Output |
|---|---|---|---|
| C-A.1 | Per-surface audit (25 admin surfaces) | ✅ COMPLETE 2026-05-25 | 24 audit files + 1 batched, B-01..B-103 |
| C-A.2 | Per-workflow audit (10 flows W01..W10) | ✅ COMPLETE 2026-05-25 | 10 audit files, B-104..B-153 |
| C-A.3 | Per-role-day audit (5 roles R01..R05) | ✅ COMPLETE 2026-05-25 | 5 audit files, B-154..B-173 |

**Total:** 40 audit files, 173 bugs catalogued, ~15 architecture deliverables embedded.

---

## 2 — Canonical files to read in this order

1. **`redesign/HANDOFF-2026-05-25-POST-C-A.md`** — this document. Start here.
2. **`redesign/audits/C-A/C-A-1-SUMMARY.md`** — per-surface audit programme summary.
3. **`redesign/audits/C-A/C-A-2-SUMMARY.md`** — per-workflow audit programme summary.
4. **`redesign/audits/C-A/C-A-3-SUMMARY.md`** — per-role-day audit programme summary.
5. **`redesign/plans/C-phase/BAND-C-MASTER-PLAN.md`** — Part 0 operating discipline + Part 2 user items + Master implementation checklist (C-A.1/.2/.3 rows now ✅).
6. **Any specific audit file** (`redesign/audits/C-A/{NN}-{slug}-audit.md`, `W{NN}-{slug}-flow.md`, `R{NN}-{role}-day.md`) ONLY when working on that surface/workflow/role.

**Don't read every audit file proactively.** The 3 summary docs distil everything; drill into specific audits only as needed.

---

## 3 — The 11 user items — final post-C-A reframed scope

This is the source-of-truth scope C-B will plan against. Synthesised from C-A.1/.2/.3 summaries §2.

### C-01 — Google review email 2h after completion
**Status:** **GREENFIELD CONFIRMED.** No template, no send function, no scheduler, no sentinel column. **Complete architecture in `W03-booking-lifecycle-flow.md` §11:**
- New `bookings.completed_at` + `bookings.review_email_sent_at` columns.
- New `renderReviewRequestEmail(input)` in `templates.ts` + service-aware copy.
- New `sendReviewRequestEmail(bookingId, adminClient, opts)` with idempotent guard on sentinel.
- New email_event_type `review_request_client`.
- Scheduler choice: Resend `scheduledAt` OR `pg_cron` (recommended for un-complete safety) OR Vercel Cron.
- Audit log action_type: `review_email_sent`.
- Service-aware Google review URL with pre-filled message.
**Open Q:** trigger off `bookings.status='completed'` (admin control) OR all-assignments-completed (Therapist-driven)? See B-129. Recommend: booking-level AND all-assignments-completed.

### C-02 — Recurring / standing bookings
**Status:** **FULLY GREENFIELD CONFIRMED.** Zero recurrence schema, zero UI, zero RPC support. **Complete architecture in `W07-availability-recurring-flow.md` §10.** Largest item in Band C by scope.
- **7 discovery questions for user** (services / roles / cadences / end-conditions / cancellation cascade / reschedule cascade / Hijri-cycle / therapist binding).
- Schema: `recurring_booking_templates` table (recommended) OR `bookings.parent_booking_id + recurrence_rule jsonb`.
- New RPC `create_recurring_booking_series`.
- Cron expansion + cancellation server action.
- New form step + calendar badging.
- New email template `renderRecurringSeriesCreatedEmail`.
- Hijri / Sunnah-day handling (17/19/21 of lunar month).

### C-03 — Enquiry → booking one-click conversion
**Status:** Scope is NARROW (master-plan called it a feature; reality is ~half-day fix).
- Convert button exists at `EnquiryList.tsx:522` ✅
- URL routes to `?enquiryId=…` ✅
- Form prefills name/phone/source/customer-notes ✅
- **MISSING:** service fuzzy-match for `service_interest` → package option pre-select.
- **PLUS cross-page bugs from W01:** B-104 toast copy, B-106 no re-conversion guard, B-107 partial-state hazard, B-108 reverse-link, W01-E-2 sessionStorage carryover, W01-V-1 Cancel routing, B-157 (R01) no return-to-enquiries.

### C-04 — Cancellation restore + refund (paired)
**Status:** scope EXPANDS via W04 + W09. Recommend paired plan.
- **Restore:** add explicit Restore button (current "restore from audit log" copy is a UX lie per #04 + W04 B-121).
- **Restore email:** add `sendBookingRestoredClientEmail` — currently restore is silent to client (W04 B-120).
- **State-machine:** add guards against `completed → pending/confirmed` without force (W04 B-122).
- **Refund modal:** first-class refund UX with method tracking + reason — currently distributed across amount_paid + note (W09 B-146).
- **Payment status vocab:** extend allowed set to ['paid','unpaid','refunded','waived'] (test file says "4 real statuses" but server only accepts 2 — W09 B-143).
- **Audit log:** new `booking_refund_recorded` action_type (W09 B-145).
- **Reports correctness:** fix `completedRevenue` to not overstate when refunded (W09 B-148 — same as `reporting.ts:417` TODO).
- **No-show quick action:** add to `quickUpdateBooking` (W03 B-117).
- **Therapist auto-promote:** when all assignments complete, auto-promote booking.status to completed (R04 B-168).

### C-05 — Cancelled bookings can't be assigned/claimed
**Status:** **6 edit points** + 1 OPEN VANTAGE QUESTION. Recommended fix shape: centralised `ensureBookingActive(bookingId, supabase)` helper.

**Edit points (from W05 §10):**
1. `bookings/actions.ts:269-275` — `claimBookingAssignment()` add `booking.status NOT IN ('cancelled','no_show')` guard
2. `bookings/[bookingId]/page.tsx:787-791` — `canClaim` predicate
3. `bookings/[bookingId]/page.tsx:793-794` + `:799-801` — mark-complete predicate
4. `bookings/[bookingId]/page.tsx:883-890` — `canReassignBookings` AssignmentManager predicate
5. `bookings/page.tsx:114-122` — `claimableRows` SQL query
6. `bookings/access.ts:24-33` — `hasClaimableAssignment` foundational predicate

**OPEN VANTAGE QUESTION (B-130):** master plan said "cancelled bookings can't be claimed/assigned". W05 confirmed Owner CAN at data layer. Therapist's claimable view is UI-filtered. Two reads of "which can't is the bug?" — needs user clarification.

Also: B-171 (R05) past-dated claimable bookings (related; same shape of fix).

### C-06 — Delete + bulk delete + dedup
**Status:** scope EXPANDS DRAMATICALLY. **Complete architecture in `W06-client-create-and-first-booking-flow.md` §10.**
- **The destructive-client-overwrite fix is the HEADLINE** (B-110 W02 + B-131 W06).
- Add `p_client_id uuid DEFAULT NULL` parameter to `create_booking_request` RPC.
- Honor explicit client_id when provided (skip on-conflict).
- Replace `on conflict (email) do update` with `do nothing` + raise structured exception.
- Add `confirmDuplicate` flag.
- Form: hidden `client_id` input on prefill from `?clientId=`.
- Lift `DuplicateWarningBanner` from `/admin/clients/new` into `ManualBookingForm`.
- Plus original C-06 scope: client-level delete via privacy workflow + lift services delete-with-in-use-guard.

### C-07 — Cross-page routing improvements
**Status:** scope grew SIGNIFICANTLY via C-A.3. Recommend split into C-07a (routing primitives) + C-07b (per-role defaults).
- B-108: booking detail → enquiry reverse link.
- W01-V-1: Cancel form → enquiry referer-aware.
- B-134: 3 duplicate `?clientId=` CTAs on client detail — consolidate.
- B-140: /admin/me only links to personal reports.
- W05-V-2: no link from booking → /admin/staff/[id].
- W02-V-2: no "just created" affordance after redirect.
- B-139 (R01): dashboard no scope-toggle.
- W08-V-1: terminology unification (Personal / My / Mine).
- W02-E-1: city whitelist invisible — inline validation lift.
- B-154 (R01): no Yesterday chip.
- B-155 (R01): dual date controls confusable.
- B-157 (R01): no return-to-enquiries post-Convert.
- B-161 (R03): no saved-filter pattern.
- B-167 (R04): per-role default bookings tab.
- B-170 (R05): cross-surface "Open to claim" mismatch.
- + customer manage page (out-of-admin tree).

### C-08 — Email templates + automation expansion
**Status:** scope EXPANDED from 3 to ~7+ missing event types.
1. `assignment` (master plan)
2. `claim` (master plan — admin notification when therapist claims)
3. `client_assigned_therapist` (master plan)
4. `booking_confirmed_client` (W03 B-115) — pending→confirmed transition
5. `review_request_client` (W03 B-116) — C-01 dependency
6. `booking_restored_client` (W04 B-120) — C-04 dependency
7. `staff_unassignment` (W05 B-127) — removed therapist notified
8. Possibly `refund_issued` (W09 B-146) — C-04 dependency
9. Possibly `booking_completed_client` (W03) — non-review completion notice

Plus per-row Resend on delivery log (#04 B-18 + #19 B-84).

### C-09 — Pagination + scale-aware + cache-invalidation
**Status:** scope CLARIFIED. C-A.1 §2 listed unbounded surfaces. **C-A.2 added cache-invalidation theme:**
- W02 B-113: createManualBooking doesn't invalidate `/admin/clients*`.
- W05 B-128: assignment changes don't invalidate `/admin/staff*`.
- W10 B-149: settings save only invalidates `/admin/settings`.

**Approach choice (C-09 plan must pick):**
- (a) Cherry-pick per-mutation (cheapest).
- (b) Central `recordMutation()` helper that knows propagation graph.
- (c) Tag-based invalidation everywhere via `unstable_cache` (most scalable; recommended).

### C-10 — Bottom-of-page spacing
**Status:** unchanged. Need Playwright 375 pass to catalogue.

### C-11 — Dark mode + design-system + per-role dashboards
**Status:** scope EXPANDED dramatically via C-A.3.
- Original: dark mode default + toggle.
- **Plus** lift `TherapistDashboard.tsx` pattern (R05-PE-1) — narrative empty states across admin.
- **Plus** lift "Need help?" sectional pattern (R05-PE-2) — onboarding sections per role.
- **Plus** lift time-of-day greeting (R05-PE-3) — currently Owner/Admin/Coord dashboards have no greeting.
- **Plus** per-role dashboard variants (R05 + R04) — Owner / Admin / Coord variants following the TherapistDashboard model.
- **Plus** unguarded `animate-spin` instances across the codebase (per C-A.1) — folded into the motion-reduce pass.

---

## 4 — Architecture deliverables embedded in audits (lift directly into C-B plans)

C-A.2 sections (per `C-A-2-SUMMARY.md` §8):
- **W01-enquiry-to-booking-flow.md §11** — C-03 narrow scope + 4 cross-page bugs
- **W02-new-booking-end-to-end-flow.md §1+§2** — manual-booking entry-point catalogue + cache-invalidation map
- **W03-booking-lifecycle-flow.md §11** — C-01 complete architecture
- **W04-cancellation-and-restore-flow.md §1+§10** — C-04 restore-button-and-email shape
- **W05-assignment-claim-reassign-flow.md §10** — C-05 6-edit-point list + `ensureBookingActive` helper
- **W06-client-create-and-first-booking-flow.md §10** — C-06 destructive-client-overwrite fix architecture
- **W07-availability-recurring-flow.md §10** — C-02 complete architecture + 7 discovery questions
- **W08-owner-scope-switching-flow.md §1** — scope-control inventory across 4 surfaces
- **W09-refund-payment-correction-flow.md §10** — paired refund workflow (extends C-04)
- **W10-settings-downstream-impact-flow.md §10** — C-09 cache-invalidation approach options

C-A.3 additions (per `C-A-3-SUMMARY.md` §8):
- **R03** — saved-filter pattern recommendation
- **R04** — "Therapist Field Experience" plan recommendation (bundle B-164/165/166/167/169 + W05 B-127)
- **R05** — empty-state pattern template (TherapistDashboard pattern lift)

**C-B can lift each §10/§11 section directly into a `C-NN-{slug}-plan.md` file.**

---

## 5 — P0 / HIGH severity bug index

**P0 regulatory (CANNOT ship without fix or explicit acceptance):**
- **B-87, B-88, B-89** (`/admin/privacy` audit #22) — Privacy "Completed" is a UI lie. No SAR export, no cascade delete, no SLA timer, no ICO breach workflow.
- **B-158** (R02) — Admin role-trust dimension. Admin operationally processes SARs in good faith. Legal exposure for the role-not-the-person.

**HIGH data integrity:**
- **B-110** (W02) — SQL `on conflict (email) do update` destroys existing client data. 3 prefill paths converge on it.
- **B-131** (W06) — `?clientId=` prefill doesn't plumb client.id; SQL matches by email; admin editing email orphans the source client.
- **B-148** (W09) — Reports `completedRevenue` overstates revenue when refunded (uses `||` not `??`, so 0 falls through to total_price).

**HIGH cross-page integrity:**
- **B-149** (W10) — Settings save only revalidates `/admin/settings`. Every downstream surface (bookings/new, calendar, customer manage page, email templates) stays stale until natural cache expiry.

**HIGH workflow:**
- **B-164** (R04) — Booking detail mobile sidebar order buries client phone + address. Therapist arriving on phone has to scroll past 5+ panels to reach critical fieldwork info.

---

## 6 — 11 open questions BLOCKING C-B plan-writing

C-A.1 §7 listed 6. C-A.2 added 3. C-A.3 added 2. Total = 11. **C-B can't write plans until these are answered.**

1. **C-05 vantage clarification (B-130)** — master-plan framing was INVERTED at data layer. Owner CAN claim cancelled bookings today. Which is the bug — Owner-can or Therapist-can't?

2. **/admin/privacy GDPR scope** — expand Band C with `C-PRIVACY-FULFILMENT-plan.md` (cascade delete + SAR export + 30-day SLA + ICO breach workflow + the role-trust angle B-158), OR defer to a dedicated compliance band? Migrations needed → Zone-2 confirmation per migration.

3. **C-02 recurring bookings discovery — 7 questions** (per W07 §10):
   - which services should support recurrence?
   - which roles can set it?
   - cadence options (weekly / fortnightly / monthly / custom / lunar-cycle / Hijri-aware Sunnah-days)?
   - end-conditions (forever / N occurrences / until date)?
   - single-occurrence cancellation cascade?
   - reschedule cascade?
   - therapist binding (locked vs re-claimable per occurrence)?

4. **C-01 Google review link + assets** — clinic's Google Business profile URL + service-specific message copy templates.

5. **C-06 framing** — primarily client-deletion via privacy workflow, hard-delete with audit preservation, or both? **W06 §10 architecture already pre-decides the structure** but user confirms.

6. **B-34 client edit surface** — confirmed missing across admin. Build an edit route, or accept that client details are immutable after creation?

7. **C-08 scope decision** — C-08 expanded from 3 to ~7+ missing event types. Which to ship in C-08 vs defer to C-12+?

8. **C-04 refund-paired scope** — W09 §10 proposes pairing cancel/restore + refund into a single "lifecycle correction" plan. User confirms scope or splits.

9. **C-09 cache-invalidation approach** — (a) per-mutation cherry-pick, (b) central helper, OR (c) tag-based everywhere. Recommended (c).

10. **Therapist Field Experience sub-plan vs C-12+ fold** — bundle R04's mobile-field gaps (B-164/165/166/167/169 + W05 B-127) into a dedicated plan, or fold into C-12+? **Recommend dedicated plan** since the structurally-different mobile-fieldwork context warrants focused design.

11. **Per-role dashboard variants vs universal+conditional** — currently TherapistDashboard.tsx is the only role-specific variant. Should Owner / Admin / Coord get their own variants too? **Recommend yes** following the TherapistDashboard pattern.

---

## 7 — Recommended next moves (decision matrix)

Master plan's recommended sequence is C-A → C-B → C-C. C-A is now complete.

| Path | When to choose | Effort | Output |
|---|---|---|---|
| **(A) C-B plan-writing** | If user answers (most of) the 11 questions in §6 | 7-15 plan files × ~half-day each | Brief + plan + progress per item |
| **(B) Tier-A Privacy GDPR sprint first** | P0 regulatory priority overrides Band C sequence | ~3-5 days (migrations + cascade + SAR export + SLA + ICO workflow) | `C-PRIVACY-FULFILMENT` shipped before any other C-NN item |
| **(C) Test-data cleanup first** | Independent low-effort hygiene | ~30 min scripted DELETE pass | Production DB clean of `Phase10 *`, `Audit *`, `Test *`, Arabic-prefix, long-name fixtures |
| **(D) Answer the 11 questions in batch** | If user wants to front-load decisions before any work | 1 session of clarification | Updated handoff with answers locked |

**Recommended sequence:** (D) → (C) → (B) → (A) sequentially. Or (D) → (A) with (B) deferred if Privacy is not blocking.

**Default if user is unsure:** start with (D) — gather the 11 answers in one go. Then plan-writing flows freely.

---

## 8 — Operating discipline (verbatim from master plan Part 0)

### Project root + branch
- Working directory: `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`
- Branch: `redesign/start-state` (single-branch sequential — NO worktrees)
- HEAD at this handoff: `84045f4`

### Dev server
- Always run on `http://localhost:3000` via user's own `pnpm dev` in a separate terminal.
- Verify with `curl -I http://localhost:3000/admin/login/` → HTTP 200.
- If "Port 3000 in use" message appears — the existing dev server is still running; reuse it. Don't kill, don't spawn duplicate.
- Don't use `preview_start` MCP — wrong harness.

### Login credentials (canonical — do not invent new accounts)

| Role | Email | Password | Profile id |
|---|---|---|---|
| Owner | `rahmatherapy@outlook.com` | `Password123` | `01582c5d-bd75-4c49-b207-6f5597e15218` |
| Admin | `test.admin@rahmatherapy.example.test` | `AdminTest123!` | (unknown — never needed) |
| Coordinator | `test.coordinator@rahmatherapy.example.test` | `CoordinatorTest123!` | (unknown) |
| Therapist | `test.therapist@rahmatherapy.example.test` | `TherapistTest123!` | `884311b1-e9d0-44b9-91f3-14188a3baf59` |
| Therapist-Fresh | `test.therapist.fresh@rahmatherapy.example.test` | `TherapistFresh123!` | `87e01c11-9d0d-4b52-bf3e-2af16f0f03d5` |
| Inactive | `test.inactive@rahmatherapy.example.test` | `InactiveTest123!` | `58784433-cb42-4773-9b22-b792c24b852d` |

### MCPs in scope

**`mcp__supabase__*`** (production project_id `twzutkfgqclqurvkmvqz` — pass on every call):
- `execute_sql` — read-only queries, schema introspection (used heavily in C-A).
- `apply_migration` — **Zone-2 only.** Explicit user confirmation per migration. Band C needs migrations for C-01 (review_email_sent_at column), C-02 (recurrence schema), C-08 (email_template rows), C-PRIVACY (cascade delete + SAR + SLA + breach workflow).
- `list_tables` / `list_extensions` / `get_advisors` / `get_logs` — safe diagnostic.
- `generate_typescript_types` — after schema changes.

**`mcp__playwright__*`** — canonical browser harness against `http://localhost:3000`.

**Playwright sign-in pattern** (form schema rejects `browser_fill_form`):
```js
() => {
  const ev = (el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  ev(document.querySelector('input[type="email"]'), '<email>');
  ev(document.querySelector('input[type="password"]'), '<password>');
  document.querySelector('button[type="submit"]').click();
}
```
Wait 2-3 seconds after click.

**Playwright sign-out:** `fetch('/admin/signout', { method: 'POST', credentials: 'include' })` via `browser_evaluate`.

**Beforeunload modal trap:** when navigating away from `/admin/bookings/new` or similar form pages, a "beforeunload" modal appears. Handle via `browser_handle_dialog accept:true`.

### Hard rules (do NOT violate)

- **No `pnpm install` / `pnpm add` / `npx <pkg>`** without Zone-2 user confirmation. Band B + C-A shipped 0 new deps.
- **Stage files EXPLICITLY** for every commit — `git add <path>`, NEVER `git add .` / `git add -A`.
- **No `border-l-4` anywhere** (DESIGN.md ban).
- **Honour `prefers-reduced-motion`** — use `src/app/admin/components/use-reduced-motion.ts` or `motion-reduce:` Tailwind modifier.
- **`updateTag(tag)` not `revalidateTag(tag, profile)`** for server-action cache invalidation (Next 16 idiom).
- **`createSupabaseAdminClient()` after `getStaffProfile()` auth check** — every server action.
- **RECON §5 untouchables:** `reporting.ts` core exports (additive only), `dashboard-helpers.ts`, RBAC matrix, middleware, build configs, B-1 chart + tile primitives.
- **SHARED-NOTES §15 (cache hazards):** never `Set<>` / `Map<>` / `Date` through `unstable_cache`.
- **SHARED-NOTES §17:** use `statusChartFillForKey` from `ReportsCharts.tsx` for chart fills.
- **SHARED-NOTES §18:** run 5-step filter-vs-data audit checklist on any new filter-equipped surface.
- **Mobile-first.** Every UI change reads cleanly at 375 px.
- **Single-branch sequential commits.** No worktrees.

### Static + verification gates (every C-C implementation phase)

1. `pnpm lint` — 0 errors.
2. `npx tsc --noEmit` — 0 errors.
3. `pnpm vitest run` — new specs pass; **6 pre-existing baseline failures preserved** (`createBookingTransaction` × 1, `admin-access` × 2, `ManualBookingForm` × 3). Band C start baseline: 485 / 491 passing.
4. `pnpm build` — clean.
5. `node scripts/measure-admin-bundles.mjs` — bundle delta within budget per SHARED-NOTES §5.
6. Playwright role sweep per the plan's verification gate.
7. Screenshot evidence at 375 / 768 / 1280 / 1440 where mobile reflow is meaningful.

---

## 9 — Bug index — full summary

**Total: 173 bugs catalogued in C-A (B-01 → B-173).**

**By phase:**
- C-A.1: B-01..B-103 (103 bugs across 25 surfaces)
- C-A.2: B-104..B-153 (50 bugs across 10 workflows)
- C-A.3: B-154..B-173 (20 bugs across 5 role-days)

**By surface/workflow/role (jump tables):**

C-A.1 ranges per surface — see `C-A-1-SUMMARY.md` §5.
C-A.2 ranges per workflow:
- W01 (enquiry→booking): B-104..B-109
- W02 (new booking E2E): B-110..B-114
- W03 (lifecycle): B-115..B-119
- W04 (cancel+restore): B-120..B-125
- W05 (assignment/claim): B-126..B-130
- W06 (client→first booking): B-131..B-135
- W07 (availability+recurring): B-136..B-138
- W08 (Owner scope): B-139..B-142
- W09 (refund): B-143..B-148
- W10 (settings downstream): B-149..B-153

C-A.3 ranges per role:
- R01 (Owner): B-154..B-157
- R02 (Admin): B-158..B-160
- R03 (Coord): B-161..B-163
- R04 (Therapist): B-164..B-169
- R05 (Therapist-Fresh): B-170..B-173

**Next available bug number: B-174.**

---

## 10 — Pattern templates surfaced across C-A (lift during C-C)

From C-A.1 §3:
- Delete-with-in-use-guard (`/admin/services`)
- Cursor pagination + Load More (`/admin/audit`, `/admin/operations`)
- Duplicate detection with override (`/admin/clients/new` DuplicateWarningBanner)
- RBAC narrowing (`/admin/staff/[staffId]`)
- Permission-overrides UX (StaffPermissionOverridesForm risk-tier matrix)
- Mobile sticky save bar (`/admin/staff/[staffId]`, `/admin/settings`)
- Tab roving tabindex + arrow-key nav (AvailabilityManagersTabs)
- Suspense streaming with `cache()` dedup (PerformanceSurface)
- Motion-reduce discipline (`/admin/reports`)

From C-A.2 §3:
- Centralised guard helper (`ensureBookingActive` pattern for C-05)
- Tag-based cache invalidation (recommended for C-09)
- Atomic refund modal (for C-04)
- Scheduler choice tree (Resend scheduledAt / pg_cron / Vercel Cron — for C-01 + future cron work)

From C-A.3 §6:
- **TherapistDashboard zero-state pattern** (narrative + empathy + next-action) — for all empty states
- **"Need help?" sectional pattern** (4-step role-specific onboarding ladder) — for all role-dashboards
- Time-of-day greeting (`getGreeting(hour)`)
- Per-role dashboard variants
- Mobile-gesture tip ("Pull down to refresh")

---

## 11 — File conventions for next phase

### C-B plan-writing (when it starts)

Per master plan §5 file layout:
- `redesign/briefs/C-NN-{slug}-brief.md` — design + scope + content + states
- `redesign/plans/C-phase/C-NN-{slug}-plan.md` — execution steps + files + verification gates
- `redesign/per-page-progress/C-NN-{slug}-progress.md` — filled during C-C

Numbering:
- `C-01..C-11` reserved for the 11 user-prioritised items.
- `C-12+` for audit-surfaced items.
- Letter suffixes for splits (`C-04a-cancellation-restore-brief.md` + `C-04b-refund-modal-brief.md`).

**Special items:**
- `C-PRIVACY-FULFILMENT-plan.md` — if Tier-A Privacy sprint is approved (special name, not numbered).
- `C-THERAPIST-FIELD-EXPERIENCE-plan.md` (if approved per open Q #10) — bundle Therapist mobile fieldwork findings.

### Commit message convention

Per existing commits:
- `docs(redesign): C-A.{N} {ref} — {summary}` (audits)
- `feat(redesign): C-{NN} {step}` (implementation)
- `chore(redesign): {bookkeeping}` (master plan / handoff updates)

ALWAYS end commit messages with:
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 12 — Production-DB state (for test-data-cleanup decisions)

**Test rows visible across 6+ surfaces (per C-A.1 §6 + observations):**

- **`/admin/staff`**: 11/12 records are test (`Phase10 *` / `Test *`)
- **`/admin/clients`**: 7+/12 records are test (`Audit Test Client *`, `Phase10 *`, `Zara Test Client`, Arabic-prefix `Test Client`, stress-name `Mohammed Abdulrahman Abdul-Hakim Al-Farsi-Lampungbungkangkang`)
- **`/admin/enquiries`**: 3/3 records are test (`Audit Enquiry One/Two`, `Phase10 E2E Enquiry`)
- **Bookings list**: visible test rows
- **Booking 77f90d24** (`Ñoño García-López y Vega Romero`) — unicode stress fixture
- **Booking ae9bb5bd** (`李小龍 (Lǐ Xiǎolóng) 👨‍⚕️🌿`) — multilingual + emoji stress fixture
- **Booking eaafbb1a** (`اَلسَّلَامُ عَلَيْكُمْ Test Client`) — RTL Arabic stress fixture

**Cleanup approach (when authorised):** scripted DELETE pass via `mcp__supabase__execute_sql`. Document in `redesign/per-page-progress/test-data-cleanup-progress.md`.

**Important constraint:** test-data cleanup is Zone-2 (DB writes). Requires explicit user confirmation. **Do not run unsupervised.**

---

## 13 — DB state observations relevant to C-B

- `bookings` table: 11 rows (9 unpaid + 2 paid). 2 completed (both seeded; never transitioned via app — see W03).
- `payment_status` actual values in DB: only `paid` + `unpaid`. Filter UI shows refunded + waived which are DEAD code paths (W09 B-143).
- `audit_logs` action_types observed in production: `booking_quick_confirm` (3), `booking_management_updated` (3), `booking_assignment_completed` (3), `booking_quick_cancel` (2), `booking_assignment_claimed` (2), `booking_assignment_reassigned` (2), `booking_reminder_sent` (2), `booking_quick_complete` (1), `booking_reschedule_reviewed` (1), `booking_reschedule_declined` (1), `booking_assignment_unassigned` (1). **The completion code path has been exercised ONCE in production.**
- `email_delivery_events` types: 7 active (`admin_booking_notification`, `booking_confirmation`, `booking_reminder`, `staff_assignment`, `booking_cancellation_customer`, `booking_cancellation_admin`, `staff_booking_change`).
- `email_templates` table does NOT exist. Templates live in code (`src/lib/email/templates.ts`).
- `business_settings` is a single row (`id=1`). 10 columns. **NO `updated_at` column** (concurrent-edit gap per W10 B-150).
- NO recurrence columns or tables — C-02 fully greenfield confirmed.

---

## 14 — Tech-debt breadcrumb inventory (consolidated from C-A.1 §4 + C-A.2 additions)

**11 surfaces with explicit `// FAKE` / `data-redesign-fake` / `BUILD-*.md` markers** (per C-A.1 §4):

| Surface | Markers |
|---|---|
| `/admin/enquiries` | `page.tsx:160-162, :187` `// FAKE: BUILD-enquiries-filter-query` ×2 |
| `/admin/staff` (list) | `page.tsx:213` BUILD-staff-filter-query; `:312` BUILD-staff-workload-aggregates; `:439, :515` data-redesign-backend FAKE |
| `/admin/staff/[id]/availability` | `BlockedDatesManager.tsx:176` + `OverridesManager.tsx:200` data-redesign-fake |
| `/admin/operations` | `page.tsx:158, :224, :250` data-redesign-fake filter-query ×3; `event-row.tsx:169` same; `operations-board.tsx:210` data-redesign-needs-photo (missing asset) |
| `/admin/emails` | `page.tsx:140, :251` BUILD-email-delivery-filter-query + filter-slice; `:128` FAKE; `DeliveryFilterStrip.tsx:128` FAKE; `ReminderResendForm.tsx:56` FAKE-FAILURE-PATH |
| `/admin/email-templates/preview/[id]` | `route.ts:9-11` BUILD-email-templates-preview-route + BUILD-rbac-permission-email-templates; `:86` simplified permission gate |
| `/admin/privacy` | `page.tsx:331, :450` `// FAKE — server ignores until BUILD plan`; BUILD-privacy-filter-query |
| `/admin/roles` | `DangerZonePanel.tsx:115` data-redesign-fake delete-role |
| `/admin/account-password-requests` | `ApproveModal.tsx:74` + `RejectModal.tsx:72` data-redesign-backend FAKE (notes NOT persisted) |
| `/admin/audit` | `page.tsx:117` `// FAKE: BUILD-audit-target-existence` |
| `/admin/reports` | `reporting.ts:417` TODO post-Phase-7 policy bookedRevenue (= W09 B-148) |

**Plus C-A.2 additions:**
- Stale "refunded" + "waived" payment_status vocab (`reports/__tests__/reports-helpers.test.ts:47` + dead filter values) — W09 B-143
- `staff_profiles.availability_mode='global_with_overrides'` in SQL but unreachable from UI — W07 B-138

**Grep deliverable for C-09 plan-writing:** `// FAKE|data-redesign-fake` across `src/app/admin/` should be a deliverable when the C-09 plan is written.

---

## 15 — Important reminders

### About the audit phase that just ended
- **C-A was pure discovery — no fixes during audit, no DB writes during audit.** That discipline held throughout 40 audit files. Maintained the integrity of the baseline.
- **Almost all findings cross-reference** via the bug index (B-NN). Future C-B planners can search by bug number to find authoritative discussion.
- **Architecture deliverables are embedded** in workflow audits §10/§11 sections. **Don't re-derive these — lift them.**

### About the auditor's confidence calibration
- C-A.2 corrected W04 B-124 explicitly in W05 §0 (the list view IS protected; the leak is via direct URL access). The pattern of self-correction is in the audit corpus — readers should expect cross-references where one audit revises another.
- C-A.1 corrected a master-plan example (Recent Activity capped at 20 per #14 audit — master plan said it was unbounded). Same self-correction pattern.

### About the user
- The user is the clinic Owner. They take bookings themselves (scope clarification 1). They have given Band B + Band C their personal attention.
- The user's communication preference: **terse, direct, with tradeoffs surfaced.** They make decisions; agent presents options.
- The user has a working dev server they manage themselves. Do not `pnpm dev` to spawn a competing process.
- Decisions about migrations, deletions, and external API calls are all Zone-2 — get explicit confirmation per action.

### About what the next session should NOT do
- Don't read every audit file proactively — use the 3 summary docs.
- Don't re-walk the surfaces / workflows / roles — discovery is done.
- Don't fix anything — wait for C-B planning + user direction.
- Don't run `pnpm install` / `npx <pkg>` without confirmation.
- Don't write to production DB without confirmation (test-data cleanup is Zone-2).
- Don't assume the master-plan framing on C-05 — the data layer disagrees (B-130).

---

## 16 — Quick-reference command palette

```bash
# Verify dev server (user's own pnpm dev should be running)
curl -I http://localhost:3000/admin/login/

# Check working tree
git status --short

# Check commits ahead of master
git rev-list --count master..HEAD   # expect 253 at handoff time

# View recent commits
git log --oneline -15

# Find a bug discussion
grep -rn "B-{NN}" redesign/audits/C-A/

# Find an architecture deliverable
grep -A2 "^## 10\|^## 11" redesign/audits/C-A/W*.md
```

```sql
-- Common DB introspection
SELECT COUNT(*) FROM bookings GROUP BY status;
SELECT COUNT(*) FROM email_delivery_events GROUP BY event_type;
SELECT action_type, COUNT(*) FROM audit_logs WHERE action_type LIKE 'booking%' GROUP BY action_type;
```

---

## 17 — End-of-handoff state at write time

- **Branch:** `redesign/start-state`
- **HEAD:** `84045f4`
- **Working tree:** clean
- **Commits ahead of master:** 253
- **Audits committed in this session (C-A.2 + C-A.3):** 16 (10 W + 5 R + 2 summary + 1 master-plan-update commits)
- **New bugs in this session:** 70 (B-104 → B-173)
- **Files touched:** 16 new audit files + 1 master-plan edit + this handoff

**No outstanding work in progress.** Branch is at a clean checkpoint suitable for any of the recommended next moves.

*End of handoff. The next session opens here. Read top-to-bottom; pause at §0 template; await user direction.*
