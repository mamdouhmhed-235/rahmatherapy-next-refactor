# C-09 — Cache invalidation (tag-based pragmatic) + filter-FAKE cleanup

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q9 + §3 C-09 (tag-based pragmatic with 7 resource-level tags + filter-FAKE cleanup ~10 markers)
- `redesign/audits/C-A/W10-settings-downstream-impact-flow.md` §2 B-149 (HEADLINE settings cache gap) + §10 (cache-pattern consolidation analysis)
- `redesign/audits/C-A/W02-new-booking-end-to-end-flow.md` §2 B-113 (manual booking doesn't invalidate /admin/clients)
- `redesign/audits/C-A/W05-assignment-claim-reassign-flow.md` §2 B-128 (assignment changes don't invalidate /admin/staff*)
- Audits #08 (enquiries), #10 (staff list), #18 (operations), #19 (emails), #22 (privacy) — for filter-FAKE markers
**Companion files:**
- Plan: `redesign/plans/C-phase/C-09-cache-invalidation-filter-cleanup-plan.md`
- Progress: `redesign/per-page-progress/C-09-cache-invalidation-filter-cleanup-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-09 is the **cache + filter hygiene plan**. Two work streams, both surfaced repeatedly during C-A:

1. **Tag-based cache invalidation with resource-level taxonomy.** Introduce 7 resource-level tags (`clients`, `bookings`, `staff`, `enquiries`, `settings`, `audit`, `emails`) ADDED ALONGSIDE the existing data-driven tags (`report-data`, `dashboard-data`). Mutations call `updateTag('clients')` (or many tags) based on the resources they touch. Page data fetchers wrap reads in `unstable_cache(fn, key, { tags: [...] })` carrying both their data-driven tag AND the resource tags they read. Fixes the three known cache gaps:
   - **B-149** — `updateBusinessSettings` only revalidates `/admin/settings`. Adds `updateTag('settings')`.
   - **B-113** — `createManualBooking` doesn't invalidate `/admin/clients*`. Adds `updateTag('clients')`.
   - **B-128** — assignment changes don't invalidate `/admin/staff*`. Adds `updateTag('staff')`.
   - Plus comprehensive sweep of all `src/app/admin/**/actions.ts` server actions to apply the right tags.

2. **Filter-query FAKE cleanup.** ~16 filter-query placeholders across 5 surfaces wired to real server queries. Discovery: decisions doc estimated ~10; actual count is ~16 across enquiries (2), staff list (2), operations (6), emails (3), privacy (3).

**Two cross-cutting findings during plan-writing:**

- **Existing `unstable_cache` usage:** 3 sites (`performance-data.ts:54`, `dashboard-data.ts:160`, `reports-data.ts:51`) already use the wrap pattern with output-driven tags. C-09 **extends** those wraps with additional resource tags (belt + braces — both old + new tags). Doesn't replace.
- **Non-filter FAKEs distributed to C-12+** (per decisions doc): `email-templates/preview` RBAC + fallback (3), `account-password-requests` notes-not-persisted (2), `audit` target-existence (1), `roles` create + delete-role stubs (2), `emails/ManualSendSheet` booking-context picker (1), `staff` workload-aggregates (2 markers), `staff/[staffId]/availability` override + blocked-dates actions (2). C-09 does NOT touch these.

---

## 1 — Why this plan exists

### 1.1 The three explicit cache gaps (HEADLINE)

W02 / W05 / W10 cataloged a pattern: each mutation hot-path cherry-picks which paths to revalidate. There's no centralised "mutation X affects surfaces Y, Z" registry. Three concrete bugs:

- **B-149 (W10):** `updateBusinessSettings` calls only `revalidatePath("/admin/settings")`. Admin reduces `booking_window_days` from 90 → 30; booking form still allows day 31-90 until natural cache TTL. Confusing for both admin + client.
- **B-113 (W02):** `createManualBooking` updates `report-data` + `dashboard-data` tags and revalidates bookings/dashboard/calendar paths. **Misses `/admin/clients*`** — a newly-inserted-or-overwritten client (per W02 B-110) isn't visible on the client list until natural revalidation.
- **B-128 (W05):** Assignment changes (assign/reassign/unassign/claim) update bookings paths but miss `/admin/staff*`. Staff detail "recent bookings" + staff list "workload aggregates" stay stale.

### 1.2 Decision: tag-based pragmatic (decisions doc Q9)

Three approaches considered in W10 §10:
- (a) Cherry-pick per-mutation. Cheapest but error-prone (same gaps reappear with each new mutation).
- (b) Central `recordMutation(kind)` helper that knows the propagation graph. Tighter coupling.
- (c) Tag-based invalidation everywhere via `unstable_cache`. Most scalable.

**Decisions doc Q9 locked (c) tag-based pragmatic** with resource-level taxonomy (not per-id):
- 7 tags: `clients`, `bookings`, `staff`, `enquiries`, `settings`, `audit`, `emails`.
- Resource-level (not per-id) because current admin surfaces don't have a hot-enough single-record read path to justify per-id bookkeeping. Add later if a specific page proves slow.

### 1.3 Why ADD tags rather than REPLACE

Existing `unstable_cache` wraps use `'report-data'` + `'dashboard-data'` tags. These map to output-data shapes (the cached function's return value). They're not per-resource.

Decisions doc Q9 mandates resource-level tags. The simplest path is to **extend** existing wraps to carry multi-tag arrays: `['dashboard-data', 'bookings', 'clients', 'enquiries']`. Each mutation invalidates the relevant resource tag, which invalidates all multi-tagged caches that listed it. Existing `report-data` + `dashboard-data` tag-invalidation semantics stay; resource tags are additive.

Belt-and-braces: existing mutations that already call `updateTag('report-data')` continue working; the new resource-tag calls ride alongside.

### 1.4 The filter-FAKE pattern

5 admin surfaces have URL-driven filter UI that the server query ignores. The URL contract is correct (browse the page with `?status=pending&payment_status=unpaid`); the server-side query just doesn't read the params. Filters work in-memory after the server fetches everything — works at small data scale but breaks at production scale (audit B-83/B-91 et al).

Decisions doc Q9 explicitly folds these into C-09 as a paired hygiene pass — same plan, different work area.

### 1.5 Why distinguish filter-query FAKE from other FAKE markers

Per decisions doc Q9: "**Heterogeneous non-filter FAKEs distribute to C-12+** (not C-09)". The non-filter FAKEs (notes-not-persisted, delete-role stub, RBAC gate stubs, etc.) each have their own design decisions to make. They're not a pattern; they're individual TODOs.

The filter-query FAKEs ARE a pattern — same shape across 5 surfaces. C-09 sweeps them together because the lift is the same: wire the URL params into the server query, paginate where appropriate (deferred — C-09 doesn't introduce pagination), drop the FAKE markers.

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-09)

### 2.1 Resource tag taxonomy

| Tag | Set by (mutations) | Read by (page data fetchers) |
|---|---|---|
| `clients` | `createClient`, `updateClient` (C-06), `deleteClient` (C-06), `addClientNote`, `createManualBooking` (B-113 fix), privacy `updatePrivacyRequestStatus` Completed (C-06 wiring) | `/admin/clients`, `/admin/clients/[id]`, `/admin/clients/new`, `/admin/bookings/new` (autocomplete) |
| `bookings` | All `bookings/actions.ts` mutations: `createManualBooking`, `updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus`, `respondToCustomerReschedule`, `restoreBooking` (C-04a), `cancelRecurringSeries` (C-02) | `/admin/bookings*`, `/admin/calendar`, `/admin/dashboard`, `/admin/reports`, `/admin/clients/[id]` (booking history), `/admin/staff/[id]` (recent bookings) |
| `staff` | Staff CUD, role-permission changes, availability changes (`availability/actions.ts`), assignment changes (cross-cut with `bookings`) | `/admin/staff*`, `/admin/bookings/new` (therapist picker), `/admin/calendar` (eligibility), `/admin/dashboard` |
| `enquiries` | Enquiry CUD, `updateEnquiryStatus`, convert-to-booking (via `createManualBooking` cross-tag) | `/admin/enquiries*`, `/admin/dashboard`, `/admin/clients/[id]` (linked-enquiry display if any) |
| `settings` | `updateBusinessSettings` (B-149 fix), `business_settings` direct DB mutations | Anywhere reading `business_settings`: `/admin/settings`, `/admin/bookings/new` (booking_window_days, allowed_cities), `/admin/calendar`, customer manage page, email templates |
| `audit` | Any server action that writes to `audit_logs` — i.e., ALL non-trivial mutations | `/admin/audit`, `/admin/operations`, `/admin/clients/[id]` (recent activity), `/admin/staff/[id]/performance` |
| `emails` | Email events (`email_delivery_events` inserts), template overrides (`saveTemplateOverride`), `resendEmail` (C-08) | `/admin/emails`, `/admin/email-templates/preview/[id]`, `/admin/clients/[id]` (email panel if shown) |

**Notes:**
- `audit` is HOT — every server action writes audit_logs and thus calls `updateTag('audit')`. Caches tagged 'audit' invalidate frequently. Acceptable trade-off — audit log staleness is the dominant complaint pattern in the audit.
- Cross-tag mutations are common. Example: `createManualBooking` touches `bookings`, `clients` (new client created), `audit`, `emails` (delivery_events written). One mutation; 4 `updateTag` calls.
- Resource tags ADD alongside existing `report-data` + `dashboard-data` tags. Both layers invalidate.

### 2.2 Server action sweep

Sweep `git grep -nE "updateTag|revalidatePath|revalidateTag" src/app/admin/` and `src/lib/`. For each mutation server action, classify which resource tags it touches:

| Server action | Adds resource tags |
|---|---|
| `createClient` | `clients` |
| `updateClient` (C-06) | `clients`, `audit` |
| `deleteClient` (C-06) | `clients`, `bookings`, `audit`, `emails` |
| `addClientNote` | `clients`, `audit` |
| `updatePrivacyRequestStatus` | `clients` (if Completed deletion_review), `audit` |
| `createManualBooking` | `bookings`, `clients` (new or merged), `audit`, `emails` |
| `updateBookingManagement` | `bookings`, `audit`, `emails` (on cancellation) |
| `quickUpdateBooking` | `bookings`, `audit`, `emails` |
| `claimBookingAssignment` | `bookings`, `staff`, `audit`, `emails` |
| `updateBookingAssignment` | `bookings`, `staff`, `audit`, `emails` |
| `updateOwnAssignmentStatus` | `bookings`, `staff`, `audit` |
| `restoreBooking` (C-04a) | `bookings`, `audit`, `emails` |
| `respondToCustomerReschedule` | `bookings`, `audit` |
| `createRecurringSeries` (C-02) | `bookings`, `audit`, `emails` |
| `cancelRecurringSeries` (C-02) | `bookings`, `audit`, `emails` |
| `updateBusinessSettings` | `settings`, `audit` — and **cross-resource invalidations**: bookings/new + calendar may need to refetch settings, so explicit `revalidatePath` of dependent routes stays |
| Staff availability actions | `staff`, `audit` |
| Staff profile updates | `staff`, `audit` |
| `saveTemplateOverride` (emails) | `emails`, `audit` |
| `resendEmail` (C-08) | `emails`, `audit` |
| Enquiry CUD | `enquiries`, `audit` |

**Comprehensive sweep deliverable:** every mutation gets the right tag set. Plan §1 includes the sweep step.

### 2.3 Page data fetcher retrofit

For each admin surface, identify the data fetcher (`*-data.ts` file or inline `await supabase.from(...)` in `page.tsx`). Wrap each in `unstable_cache(fn, key, { tags: [...resourceTags, ...existingDataTags] })`.

**Existing wraps (extend):**
- `performance-data.ts:54` → add `'staff'`, `'bookings'`, `'audit'` to tag array.
- `dashboard-data.ts:160` → add `'bookings'`, `'clients'`, `'enquiries'`, `'staff'`.
- `reports-data.ts:51` → add `'bookings'`, `'clients'`, `'staff'`.

**New wraps (introduce):**
- `/admin/clients` list page fetcher → tag with `'clients'`.
- `/admin/clients/[id]` detail fetcher → tag with `'clients'`, `'bookings'`, `'audit'`, `'emails'`.
- `/admin/bookings` list fetcher → tag with `'bookings'`, `'clients'`, `'staff'`.
- `/admin/bookings/[id]` detail fetcher → tag with `'bookings'`, `'clients'`, `'staff'`, `'audit'`, `'emails'`.
- `/admin/calendar` fetcher → tag with `'bookings'`, `'staff'`, `'settings'`.
- `/admin/staff` list fetcher → tag with `'staff'`, `'bookings'`.
- `/admin/staff/[id]` detail fetcher → tag with `'staff'`, `'bookings'`, `'audit'`.
- `/admin/enquiries` list fetcher → tag with `'enquiries'`.
- `/admin/emails` delivery log fetcher → tag with `'emails'`.
- `/admin/settings` fetcher → tag with `'settings'`.
- `/admin/audit` page fetcher → tag with `'audit'`.
- `/admin/operations` fetcher → tag with `'audit'`, `'bookings'`, `'settings'`.
- `/admin/privacy` fetcher → tag with `'clients'`, `'audit'`.

**Pre-flight Step 5** enumerates all `page.tsx` files that fetch data directly (some don't via `unstable_cache` yet — those need to be wrapped, not just extended).

**Cache hazards (RECON §15):** never put `Set<>` / `Map<>` / `Date` through `unstable_cache`. Existing wraps already follow this. New wraps verify.

### 2.4 Filter-query FAKE cleanup

5 surfaces, ~16 markers (actual count higher than decisions doc's ~10 estimate):

**`/admin/enquiries` (2 markers — `page.tsx:160, 187`):**
- Wire URL `?status=` / `?source=` / `?service=` filters into the server query.
- Drop `FAKE: BUILD-enquiries-filter-query` markers.

**`/admin/staff` list (2 markers — `page.tsx:213, 516`):**
- Wire URL `?gender=` / `?active=` / `?role=` filters.
- Drop `FAKE: BUILD-staff-filter-query` + the `data-redesign-fake="staff-filter-query"` data-attribute on the form element.

**`/admin/operations` (6 markers — `page.tsx:158, 172, 186, 224, 250` + `event-row.tsx:169`):**
- Wire URL filter params for severity / event_type / from-date / to-date into the server query.
- Drop `data-redesign-fake="filter-query"` data-attributes from each filter input + row.

**`/admin/emails` (3 markers — `DeliveryFilterStrip.tsx:128` + `page.tsx:140, 251`):**
- Wire URL `?event_type=` / `?recipient_role=` / `?delivery_status=` filters.
- The in-memory filter slice currently does the work post-fetch (line 251); migrate to server-side.

**`/admin/privacy` (3 markers — `page.tsx:331, 450` + `PrivacyFilterBar.tsx:152`):**
- Wire URL `?status=` / `?request_type=` filters.
- Drop `// FAKE — server ignores until BUILD plan` comments + the `data-redesign-fake="filter-query"` attribute.

**Pattern across all 5:**
- Read URL searchParams in `page.tsx`.
- Pass into the data fetcher.
- Apply filters server-side in the Supabase query (e.g., `.eq("status", filterStatus)`).
- Remove in-memory filter logic in the page.
- Drop FAKE markers.

**Audit checklist per surface (SHARED-NOTES §18 — 5-step filter-vs-data audit):**
1. URL `searchParams` parsed in page.tsx.
2. Parsed values passed to data fetcher.
3. Server query applies filters (`.eq` / `.in` / `.gte` / etc.).
4. Filter UI defaults to current URL state (controlled inputs).
5. Empty-state copy reflects filter vs. data presence ("No results matching your filters" vs. "No data yet").

### 2.5 What's NOT in C-09 (distributed elsewhere)

Per decisions doc Q9:

| FAKE marker | Distributed to |
|---|---|
| `emails/ManualSendSheet:291` booking-context picker | C-12+ |
| `emails/page.tsx` FAILURE-PATH (not in current grep) | C-12+ |
| `staff/page.tsx:312, 440` workload-aggregates ×2 | C-12+ |
| `staff/[staffId]/availability/*` override + blocked-dates action stubs | C-12+ |
| `roles/[roleId]/DangerZonePanel:115` delete-role stub | C-12+ |
| `roles/CreateRoleSheet:39, 171` create-role stub ×2 | C-12+ |
| `email-templates/preview/[id]/route.ts:9, 84, 172` RBAC + render fallback ×3 | C-12+ |
| `audit/page.tsx:117` target-existence | C-12+ |
| `account-password-requests/{Reject,Approve}Modal` notes-not-persisted ×2 | C-12+ |
| `reporting.ts:417` TODO `bookedRevenue` policy | **C-04a hygiene tail** (already in C-04a plan §2.9e) |

C-12+ gets a docs deliverable from C-09 listing these by surface for the future band's planning.

---

## 3 — RBAC matrix (C-09 × roles)

C-09 introduces no new permissions, no new gates. The cache layer is transparent to RBAC:

| Action | All roles |
|---|---|
| See updated data after a mutation | Same as before — just **faster** (no stale-data window). RBAC narrowing happens at the read layer, which is unchanged. |
| Filter visibility on the 5 swept surfaces | RBAC narrowing applied via existing predicates (e.g., `canViewEmailLogs`); filters operate on the already-narrowed result set. |

---

## 4 — Layout strategy

C-09 makes **no UI changes**. It's pure infrastructure. Filter UI on the 5 swept surfaces stays visually identical; what changes is the server side wiring. Users notice:
- Settings save → booking-form date max updates immediately (B-149 fix).
- New booking with new client → client appears on /admin/clients immediately (B-113 fix).
- Assignment change → staff workload tile reflects immediately (B-128 fix).
- Filter selections on the 5 surfaces actually narrow server-side rather than in-memory.

No new visual primitives, no new components.

---

## 5 — States & edge cases

### 5.1 Cross-resource mutation that adds many tags at once

Example: `createManualBooking` calls `updateTag('bookings')` + `updateTag('clients')` + `updateTag('audit')` + `updateTag('emails')` + existing `updateTag('report-data')` + `updateTag('dashboard-data')`. Plus several `revalidatePath` calls. That's 6+ invalidations per booking creation.

**Performance check:** each `updateTag` call is essentially a Next.js cache-tag-bump (O(1) per tag). 6 calls per mutation is negligible.

### 5.2 Audit-tag invalidation frequency

Every server action writes audit_logs → every server action calls `updateTag('audit')`. Caches tagged `'audit'` (the audit log page, operations page) effectively become "always invalidated on next read" — they're basically uncached.

**Acceptable trade-off:** audit log staleness was a recurring complaint pattern in C-A. Worst case: the audit log fetcher hits the DB every read. The DB query is already paginated; load is low.

If observed-slow at scale, narrow `'audit'` invalidation to specific mutations (e.g., only the ones admin reads on `/admin/audit`). C-12+.

### 5.3 Resource tag for a server action that doesn't actually need cross-invalidation

Some actions invalidate one resource cleanly without cross-cutting. E.g., `addClientNote` touches only the client's notes. It still calls `updateTag('clients')` + `updateTag('audit')`. Verify that the client detail fetcher's cache is tagged `'clients'` so the note appears immediately.

### 5.4 Mutation that fails mid-action — cache state

If a server action errors out, the caller's UI shows the error. The mutation didn't happen; cache state stays valid. No special handling needed.

Pattern caveat: an action that writes audit_logs SUCCESSFULLY but then errors on a downstream write — partial state. The `'audit'` cache invalidates correctly; downstream caches may not have been notified. Acceptable — error path; admin re-runs.

### 5.5 Filter wiring discoverability

Once the server-side filters work, users can bookmark a filtered URL and the page loads pre-filtered. Verify each swept surface honours this (controlled inputs default to current URL state). Test at impl time.

### 5.6 Filter changes that should clear pagination

When user changes a filter, current page (if paginated) should reset to page 1. C-09 doesn't introduce new pagination (that's deferred). But existing pagination (e.g., audit, operations) should reset cleanly. Verify.

### 5.7 Cache-clear after RLS policy changes

Changing an RLS policy doesn't trigger cache invalidation automatically. If a permission is revoked mid-session, the cached read may still serve narrower data. Acceptable — RLS changes are operator events, not user-driven flows. Re-fetch on RLS edit is C-12+ if needed.

### 5.8 Cache hazards (RECON §15) verification

Every new `unstable_cache` wrap reviews the cached function's return type. No `Set<>` / `Map<>` / `Date` in the returned shape. If existing functions return such types, refactor to plain arrays / strings. Plan §1 includes a pre-flight grep.

---

## 6 — Migration footprint

**None.** C-09 is pure code:
- New `updateTag` calls in existing server actions.
- New / extended `unstable_cache` wraps in data fetchers.
- Filter-query wiring (Supabase query extensions; no schema changes).
- FAKE marker removal (comment + data-attribute cleanup).

No new tables, no new permissions, no new email/audit types. Zero migrations.

---

## 7 — Files touched (preview — full list in plan)

### NEW (1 file)
- `src/lib/cache/tag-taxonomy.ts` — exports the 7 tag-name constants + a `RESOURCE_TAGS` array + type aliases. Single source of truth for tag names.

### EDITED (broad — ~25-30 files)

**Server action files (~10):**
- `src/app/admin/clients/actions.ts`
- `src/app/admin/bookings/actions.ts`
- `src/app/admin/bookings/recurring-actions.ts` (C-02)
- `src/app/admin/staff/actions.ts` (and per-staff sub-actions)
- `src/app/admin/availability/actions.ts`
- `src/app/admin/enquiries/actions.ts`
- `src/app/admin/settings/actions.ts`
- `src/app/admin/emails/actions.ts`
- `src/app/admin/email-templates/actions.ts`
- `src/app/admin/privacy/actions.ts`

**Data-fetcher files (~8-10):**
- `src/app/admin/components/performance-data.ts` (extend wrap)
- `src/app/admin/dashboard/dashboard-data.ts` (extend wrap)
- `src/app/admin/reports/reports-data.ts` (extend wrap)
- `src/app/admin/clients/page.tsx` (introduce wrap)
- `src/app/admin/clients/[clientId]/page.tsx` (introduce wrap)
- `src/app/admin/bookings/page.tsx` (introduce wrap)
- `src/app/admin/bookings/[bookingId]/page.tsx` (introduce wrap)
- `src/app/admin/staff/page.tsx`
- `src/app/admin/staff/[staffId]/page.tsx`
- `src/app/admin/calendar/page.tsx`
- `src/app/admin/enquiries/page.tsx`
- `src/app/admin/emails/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/audit/page.tsx`
- `src/app/admin/operations/page.tsx`
- `src/app/admin/privacy/page.tsx`

**Filter-FAKE cleanup (5 surfaces):**
- `src/app/admin/enquiries/page.tsx` (already in data-fetcher list)
- `src/app/admin/staff/page.tsx` (same)
- `src/app/admin/operations/page.tsx` (same) + `event-row.tsx`
- `src/app/admin/emails/page.tsx` (same) + `DeliveryFilterStrip.tsx`
- `src/app/admin/privacy/page.tsx` (same) + `PrivacyFilterBar.tsx`

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- Non-filter FAKE markers (distributed to C-12+ per §2.5).
- Existing `report-data` + `dashboard-data` tag semantics (additive, not replaced).
- Schema (no migrations).

---

## 8 — Sequencing and dependencies

**Order in C-C:** C-09 can ship any time after C-06 + C-04a + C-01 + C-FIELDWORK + C-11 + C-08 + C-02. Reasoning:
- Each prior plan introduces new server actions (e.g., C-06's `updateClient`, C-02's `cancelRecurringSeries`). C-09 sweeps those once they exist.
- If C-09 ships before some prior plans, those plans' authors must consult the tag taxonomy and apply tags themselves. Adds friction.

**Decisions doc §5 recommended order:** C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-02 → **C-09** → C-03 → C-07 → C-10. C-09 lands ninth — most prior plans have shipped their actions.

**No hard blockers**, but pre-flight verifies which prior plans are merged. If some aren't, C-09 stubs the tag additions for those actions (with a comment) and the prior plan's implementer applies the rest. Coordinated via `tag-taxonomy.ts` as the single source of truth.

**Coordination with C-12+:** C-09 deliverable includes a docs note listing the non-filter FAKEs distributed to C-12+ (per §2.5).

---

## 9 — Open questions

**Q9.1 — Tag granularity: resource-level vs per-id**

Locked at **resource-level** per decisions doc Q9. Per-id tags (e.g., `client:abc-123`) would be more surgical but add bookkeeping complexity. Revisit if a hot path is observed at scale (e.g., dashboard refresh stalls on a stale single-client cache).

**Q9.2 — Should `audit` tag be invalidated on EVERY server action that writes audit_logs?**

Locked: **yes**. Audit-log staleness is the primary complaint pattern. Frequent invalidation = always-fresh audit log. Trade-off: audit page hits DB on every read; load is low (paginated query).

**Q9.3 — Should the 3 existing `unstable_cache` wraps replace `report-data` + `dashboard-data` tags with resource tags?**

Locked: **no — extend, don't replace**. Existing tags work; new resource tags ADD alongside. Belt-and-braces. Future polish could simplify.

**Q9.4 — Filter-FAKE count discrepancy (decisions doc said ~10, actual is ~16)**

Locked at the actual count. Plan §2.4 lists per-surface counts. No scope creep — same surfaces, more thorough sweep than initially estimated.

**Q9.5 — Pagination on the filter-FAKE swept surfaces**

NOT in C-09. Decisions doc Q9 was specific: filter-query wiring only. Pagination is a C-12+ scale concern unless a surface (e.g., operations) renders 100+ rows by default. Operations may need an emergency pagination pass during C-09 verification if Playwright shows row counts that visibly degrade the page.

**Q9.6 — Cache hazards (RECON §15) audit**

Plan §1 pre-flight greps for `Set<` / `Map<` / `Date` in functions about to be wrapped. Most existing functions are already plain-array safe (per existing wrap patterns). Verify per-fetcher.

**Q9.7 — Tag naming clash with existing `report-data` / `dashboard-data`**

The two existing tags are output-driven (the cached function's return data shape). Resource tags are input-driven (which DB tables the function reads). They coexist without conflict — `updateTag('bookings')` doesn't invalidate `'report-data'`-tagged caches unless those caches also tagged with `'bookings'`. C-09's wraps add resource tags to existing wraps for the cross-cutting case.

**Q9.8 — Operations page is hottest swept surface — risk?**

Operations renders all `operational_events` + filters in-memory. Current page can be slow. Wiring server-side filters should make it FASTER, not slower. Plan §3 verifies via Playwright timing comparison.

**Q9.9 — How granular for the `settings` tag?**

Settings is a single row. `updateTag('settings')` invalidates every cache reading any of the 10 columns. Acceptable — settings changes are rare; total invalidation on every save is fine.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-09 implementation is complete when:

1. **7 resource tags exported** from `src/lib/cache/tag-taxonomy.ts`.
2. **Every mutation server action** calls `updateTag(...)` with the appropriate resource tags (per §2.2 matrix). Verified via grep + per-action review.
3. **Every relevant data fetcher** is wrapped in `unstable_cache` carrying the appropriate resource tags (per §2.3 list). Existing wraps extended; new wraps introduced.
4. **B-149 fix verified:** admin reduces `booking_window_days` → `/admin/bookings/new` form's date picker max updates immediately on next visit (within seconds, not minutes).
5. **B-113 fix verified:** admin creates a new booking with a new client → `/admin/clients` list shows the new client immediately on next refresh.
6. **B-128 fix verified:** admin assigns a booking → `/admin/staff/[id]` "recent bookings" reflects immediately.
7. **5 filter-FAKE surfaces cleaned:** enquiries, staff list, operations, emails, privacy. Server-side filters work via URL params. FAKE markers + `data-redesign-fake` attributes removed.
8. **Filter audit checklist (§2.4)** passes for each swept surface — URL state → fetcher → query, controlled UI defaults, empty-state copy adapts.
9. **No regressions** on existing surfaces — Playwright sweep on dashboard, reports, performance pages.
10. **Cache hazards verified** — no `Set<>` / `Map<>` / `Date` in cached function return types.
11. **All static gates pass** — lint, tsc, vitest, build, bundle delta within budget.
12. **C-12+ FAKE docs deliverable** — `redesign/audits/C-A/c-12-plus-fake-inventory.md` lists the non-filter FAKEs distributed away from C-09.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q9 + §3 C-09 | Tag taxonomy + filter-FAKE scope |
| `W10-settings-downstream-impact-flow.md` §2 B-149 + §10 | HEADLINE cache gap + consolidation analysis |
| `W02-new-booking-end-to-end-flow.md` §2 B-113 | Manual booking missing clients invalidation |
| `W05-assignment-claim-reassign-flow.md` §2 B-128 | Assignment missing staff invalidation |
| `08-enquiries-audit.md` | Filter-FAKE references |
| `10-staff-list-audit.md` | Filter-FAKE references |
| `18-operations-audit.md` | Filter-FAKE references |
| `19-emails-audit.md` | Filter-FAKE references |
| `22-privacy-audit.md` | Filter-FAKE references |
| `dashboard-data.ts:160` | Existing `unstable_cache` wrap (lift target) |
| `reports-data.ts:51` | Existing wrap |
| `performance-data.ts:54` | Existing wrap |
| `SHARED-IMPLEMENTATION-NOTES.md` §15 | Cache hazards (no Set/Map/Date) |
| `SHARED-IMPLEMENTATION-NOTES.md` §18 | Filter-vs-data 5-step audit checklist |

---

## 12 — Out of scope (explicit non-goals)

- **Pagination on the swept surfaces** — locked at "wire filters; don't paginate yet". Q9.5.
- **Per-id tag granularity** — Q9.1. Resource-level only.
- **Non-filter FAKE cleanup** — distributed to C-12+ per §2.5.
- **`reports/reporting.ts:417` TODO** — already in C-04a hygiene tail.
- **Cache-clear on RLS policy change** — §5.7.
- **Tag invalidation observability tooling** (e.g., dashboard for "which tags were invalidated when") — C-12+ ops.
- **`unstable_cache` migration to next-generation Next.js cache APIs** — locked at current `unstable_cache` API; future framework upgrades handled separately.
- **Settings-affecting downstream warning callouts** (W10-V-1) — C-12+ UX polish.
- **Customer manage page cache invalidation** — public site is out of admin C-09 scope.
- **Mobile UI changes** — C-09 is invisible to UI; no mobile work.
- **New permissions** — C-09 doesn't introduce any.

---

*End of C-09 brief. Plan file follows: `redesign/plans/C-phase/C-09-cache-invalidation-filter-cleanup-plan.md`.*
