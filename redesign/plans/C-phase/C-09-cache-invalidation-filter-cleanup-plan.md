# C-09 — Cache invalidation + filter-FAKE cleanup — **PLAN**

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-09-cache-invalidation-filter-cleanup-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-09-cache-invalidation-filter-cleanup-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree.** `git status --short` empty. HEAD on `redesign/start-state`.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → 200.
3. **Baseline tests + static gates.** `pnpm vitest run` 485/491; `pnpm lint` + `tsc` green.
4. **Existing `updateTag` + `unstable_cache` inventory:**

   ```bash
   git grep -nE "updateTag\\(|unstable_cache" src/app/admin src/lib > /tmp/c09-cache-inventory.txt
   wc -l /tmp/c09-cache-inventory.txt
   # Record baseline count
   ```

5. **Filter-FAKE inventory:**

   ```bash
   git grep -nE "FAKE.*filter-query|data-redesign-fake=\"filter-query\"|filter-query.md" src/app/admin > /tmp/c09-filter-fakes.txt
   # Per-surface breakdown:
   git grep -lE "FAKE.*filter-query|data-redesign-fake=\"filter-query\"" src/app/admin | sort | uniq
   ```

   Confirm the per-surface counts match brief §2.4 (or document the delta).

6. **Cache hazard audit (`Set<` / `Map<` / `Date` in soon-to-be-cached fetchers):**

   ```bash
   # Functions that will be wrapped — check for hazardous return types
   git grep -nE "Set<|Map<|new Date\\(" src/app/admin/clients/page.tsx src/app/admin/bookings/page.tsx src/app/admin/staff/page.tsx src/app/admin/enquiries/page.tsx src/app/admin/emails/page.tsx src/app/admin/audit/page.tsx src/app/admin/operations/page.tsx src/app/admin/privacy/page.tsx src/app/admin/calendar/page.tsx
   ```

   For each match: assess whether the result flows through `unstable_cache`. Refactor to plain arrays / strings if so.

7. **Data-fetcher map:** identify which `page.tsx` does inline supabase queries vs uses a `*-data.ts` helper.

   ```bash
   git grep -l "createSupabaseAdminClient\\|from(" src/app/admin/**/page.tsx | sort
   ```

   Distinguish surfaces with existing `*-data.ts` helpers (extend) vs inline-fetching pages (introduce wrap by extracting to a new helper).

8. **C-N prerequisite check** — which prior plans are merged? Per brief §8 recommended sequencing C-09 is ninth. Confirm:

   ```bash
   git log --oneline | grep -E "C-06|C-04a|C-05|C-01|C-FIELDWORK|C-11|C-08|C-02"
   ```

   For each unmerged plan, C-09 stubs the tag additions in those files with a `// TODO C-09: apply tags here after merge` comment — the prior plan's implementer fills in. Document in progress file.

9. **Test fixture inventory** — at least one mutation per resource type for E2E:
   - Client create (touches `clients` tag)
   - Booking create (touches `bookings`, `clients`, `audit`)
   - Settings update (touches `settings`)
   - Assignment change (touches `bookings`, `staff`)
   - Etc.

10. **DO-NOT-TOUCH list:** Badar's `9d55ce2a`, real customer data.

If pre-flight fails (especially #6 cache hazards), surface to user.

---

## 1 — Safe implementation order (5 phases)

### Phase A — Tag taxonomy + single source of truth

**Step 1 — Create `src/lib/cache/tag-taxonomy.ts`.**

```ts
// SERVER + CLIENT — pure constants. No side effects.

/**
 * Resource-level cache tags (C-B-DECISIONS Q9).
 *
 * Each tag corresponds to a resource family. Server actions call
 * `updateTag(TAG_NAME)` to invalidate caches that read from that family.
 * Data fetchers wrap reads in `unstable_cache(fn, key, { tags: [...] })`
 * carrying the tags their function reads from.
 *
 * Coexists with existing output-driven tags ('report-data',
 * 'dashboard-data') — both layers invalidate independently. Resource
 * tags are ADDED ALONGSIDE existing tags; not replacements.
 */
export const TAGS = {
  CLIENTS: "clients",
  BOOKINGS: "bookings",
  STAFF: "staff",
  ENQUIRIES: "enquiries",
  SETTINGS: "settings",
  AUDIT: "audit",
  EMAILS: "emails",
} as const;

export type ResourceTag = (typeof TAGS)[keyof typeof TAGS];

export const ALL_RESOURCE_TAGS: ResourceTag[] = Object.values(TAGS);

/**
 * Audience map — which page surfaces consume which tag.
 * Documentation only; used by Phase B fetchers to determine the tag set.
 */
export const TAG_AUDIENCE: Record<ResourceTag, string[]> = {
  clients: [
    "/admin/clients",
    "/admin/clients/[id]",
    "/admin/clients/new",
    "/admin/bookings/new",
  ],
  bookings: [
    "/admin/bookings",
    "/admin/bookings/[id]",
    "/admin/bookings/new",
    "/admin/calendar",
    "/admin/dashboard",
    "/admin/reports",
    "/admin/clients/[id]",
    "/admin/staff/[id]",
  ],
  staff: [
    "/admin/staff",
    "/admin/staff/[id]",
    "/admin/staff/[id]/availability",
    "/admin/staff/[id]/performance",
    "/admin/bookings/new",
    "/admin/calendar",
    "/admin/dashboard",
  ],
  enquiries: [
    "/admin/enquiries",
    "/admin/dashboard",
    "/admin/clients/[id]",
  ],
  settings: [
    "/admin/settings",
    "/admin/bookings/new",
    "/admin/calendar",
    "(public booking + customer manage page — out of admin tree)",
  ],
  audit: [
    "/admin/audit",
    "/admin/operations",
    "/admin/clients/[id]",
    "/admin/staff/[id]/performance",
  ],
  emails: [
    "/admin/emails",
    "/admin/email-templates/preview/[id]",
  ],
};
```

**Verification:** `pnpm lint` + `tsc` green. No runtime change yet — just constants.

### Phase B — Mutation server action sweep

**Step 2 — Mutation matrix verification** (table from brief §2.2). For each server action file:

```bash
git grep -l "use server" src/app/admin/**/actions.ts src/app/admin/**/recurring-actions.ts
```

For each file, identify mutations + add `updateTag` calls per the brief matrix. Pattern:

```ts
import { TAGS } from "@/lib/cache/tag-taxonomy";

// Inside server action, after the mutation succeeds:
updateTag(TAGS.CLIENTS);
updateTag(TAGS.AUDIT);
// Plus existing tags + revalidatePath calls preserved.
```

**Per-file changes:**

**`src/app/admin/clients/actions.ts`:**
- `createClient` (line 117-223): add `updateTag(TAGS.CLIENTS)` + `updateTag(TAGS.AUDIT)`. Preserve existing `updateTag("report-data")` + `updateTag("dashboard-data")`.
- `addClientNote` (line 225-275): add `updateTag(TAGS.CLIENTS)` + `updateTag(TAGS.AUDIT)`.
- `createClientPrivacyRequest` (line 277-325): add `updateTag(TAGS.CLIENTS)` + `updateTag(TAGS.AUDIT)`.
- (C-06 additions) `updateClient`, `deleteClient`, `bulkDeleteClients`: same pattern.

**`src/app/admin/bookings/actions.ts`:** ~15 mutations:
- `updateBookingManagement` (line 118-237): `updateTag(TAGS.BOOKINGS)` + `updateTag(TAGS.AUDIT)` + conditional `updateTag(TAGS.EMAILS)` if email sent.
- `claimBookingAssignment` (line 239-365): `TAGS.BOOKINGS` + `TAGS.STAFF` + `TAGS.AUDIT` + `TAGS.EMAILS`.
- `quickUpdateBooking` (line 367-447): `TAGS.BOOKINGS` + `TAGS.AUDIT` + conditional `TAGS.EMAILS`.
- `updateBookingAssignment` (line 449-562): `TAGS.BOOKINGS` + `TAGS.STAFF` + `TAGS.AUDIT` + `TAGS.EMAILS`.
- `updateOwnAssignmentStatus` (line 564-625): `TAGS.BOOKINGS` + `TAGS.STAFF` + `TAGS.AUDIT`.
- `respondToCustomerReschedule` (line 644-688): `TAGS.BOOKINGS` + `TAGS.AUDIT`.
- `createManualBooking` (line 726-960): `TAGS.BOOKINGS` + `TAGS.CLIENTS` + `TAGS.AUDIT` + `TAGS.EMAILS` + conditionally `TAGS.ENQUIRIES` (if enquiryId path taken).
- `restoreBooking` (C-04a): `TAGS.BOOKINGS` + `TAGS.AUDIT` + `TAGS.EMAILS`.

**`src/app/admin/bookings/recurring-actions.ts` (C-02):**
- `createRecurringSeries`: `TAGS.BOOKINGS` + `TAGS.CLIENTS` + `TAGS.AUDIT` + `TAGS.EMAILS`.
- `cancelRecurringSeries`: `TAGS.BOOKINGS` + `TAGS.AUDIT` + `TAGS.EMAILS`.

**`src/app/admin/settings/actions.ts`:**
- `updateBusinessSettings`: `TAGS.SETTINGS` + `TAGS.AUDIT`. **PLUS retain comprehensive `revalidatePath`** for surfaces that read settings without going through `unstable_cache`. Defense-in-depth.

**`src/app/admin/availability/actions.ts`:** ~6 mutations (visible from pre-flight grep):
- Each one: `TAGS.STAFF` + `TAGS.BOOKINGS` (availability affects booking eligibility) + `TAGS.AUDIT`.

**`src/app/admin/enquiries/actions.ts`:**
- `createEnquiry` / `updateEnquiryStatus` / `convertEnquiry`: `TAGS.ENQUIRIES` + `TAGS.AUDIT`. Convert also touches `TAGS.BOOKINGS` + `TAGS.CLIENTS`.

**`src/app/admin/staff/actions.ts`** (and any sub-action files):
- Staff CUD: `TAGS.STAFF` + `TAGS.AUDIT`.
- Role assignment changes: `TAGS.STAFF` + `TAGS.AUDIT`.

**`src/app/admin/emails/actions.ts`:**
- `resendEmail` (C-08): `TAGS.EMAILS` + `TAGS.AUDIT`.
- Existing manual-send actions: same.

**`src/app/admin/email-templates/actions.ts`:**
- `saveTemplateOverride`: `TAGS.EMAILS` + `TAGS.AUDIT`.

**`src/app/admin/privacy/actions.ts`:**
- `updatePrivacyRequestStatus`: `TAGS.AUDIT` + `TAGS.CLIENTS` (per C-06's wiring when status=completed AND request_type=deletion_review).

**Step 3 — Vitest specs for tag-write verification.**

For each updated server action, add (or extend) a vitest spec asserting:
- The action's mock `updateTag` was called with the expected resource tag(s).
- Existing tag calls (e.g., `report-data`) preserved.

Use vitest `vi.mock("next/cache", ...)` to capture the calls.

**Phase B verify checkpoint:**
- `pnpm lint` + `tsc` + `vitest run` green.
- Per-mutation manual check via Playwright: trigger the mutation, verify the expected page invalidates immediately (next page load reflects the change).

### Phase C — Page data fetcher retrofit

**Step 4 — Extend existing `unstable_cache` wraps.**

For each of the 3 existing wraps, add resource tags to the existing tag array:

**`src/app/admin/components/performance-data.ts:54`:**
```ts
// Before:
const cachedFetcher = unstable_cache(fetcher, [key], { tags: ["report-data"], revalidate: 60 });
// After:
const cachedFetcher = unstable_cache(fetcher, [key], {
  tags: ["report-data", TAGS.STAFF, TAGS.BOOKINGS, TAGS.AUDIT],
  revalidate: 60,
});
```

**`src/app/admin/dashboard/dashboard-data.ts:160`:**
```ts
// Add TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.ENQUIRIES, TAGS.STAFF
```

**`src/app/admin/reports/reports-data.ts:51`:**
```ts
// Add TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF
```

**Step 5 — Introduce new wraps for currently-inline-fetching surfaces.**

> **C-16 coordination (2026-07-16):** pagination itself stays OUT of C-09 (Q9.5 posture unchanged), but write every extracted helper **pagination-ready**: the filters/params object each helper accepts must include optional `limit` + `offset` (or `cursor`) fields that flow into the query and into the `unstable_cache` key (they're part of the serialized params, so distinct pages cache separately for free). C-16 (data-growth: pagination + bounded lists) then wires pagers through these helpers without rewriting them. Where a helper serves a to-be-paginated surface (clients, bookings, enquiries, emails, operations, privacy — per C-16 Phase A inventory), also expose a cheap companion `count` path (head-count query) for the "Showing X–Y of Z" readout.

For each `page.tsx` that does inline supabase queries, extract the fetch into a colocated `*-data.ts` file (or add to existing `*-data.ts` if present) + wrap in `unstable_cache`.

**Pattern (e.g., `/admin/clients/page.tsx`):**

Before (sketch):
```tsx
export default async function ClientsPage({ searchParams }: Props) {
  const adminClient = createSupabaseAdminClient();
  const { data: clients } = await adminClient.from("clients").select("...");
  // ... rest of page
}
```

After:
```tsx
// New file: src/app/admin/clients/clients-list-data.ts
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getClientsListData(filters: ClientsFilters) {
  const fetcher = async () => {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient.from("clients").select("...").apply(filters);
    if (error) throw error;
    return data ?? [];
  };

  const cached = unstable_cache(fetcher, [JSON.stringify(filters)], {
    tags: [TAGS.CLIENTS, TAGS.BOOKINGS],
    revalidate: 60,
  });

  return cached();
}

// page.tsx becomes:
const clients = await getClientsListData(filters);
```

**Per-surface targets (the new wraps):**

| Surface | New helper file | Tags |
|---|---|---|
| `/admin/clients` list | `clients/clients-list-data.ts` | `clients`, `bookings` |
| `/admin/clients/[id]` detail | `clients/[clientId]/client-detail-data.ts` | `clients`, `bookings`, `audit`, `emails` |
| `/admin/bookings` list | `bookings/bookings-list-data.ts` | `bookings`, `clients`, `staff` |
| `/admin/bookings/[id]` detail | `bookings/[bookingId]/booking-detail-data.ts` | `bookings`, `clients`, `staff`, `audit`, `emails` |
| `/admin/staff` list | `staff/staff-list-data.ts` | `staff`, `bookings` |
| `/admin/staff/[id]` detail | `staff/[staffId]/staff-detail-data.ts` | `staff`, `bookings`, `audit` |
| `/admin/calendar` | `calendar/calendar-data.ts` | `bookings`, `staff`, `settings` |
| `/admin/enquiries` | `enquiries/enquiries-data.ts` | `enquiries` |
| `/admin/emails` | `emails/emails-data.ts` | `emails` |
| `/admin/settings` | `settings/settings-data.ts` | `settings` |
| `/admin/audit` | `audit/audit-data.ts` | `audit` |
| `/admin/operations` | `operations/operations-data.ts` | `audit`, `bookings`, `settings` |
| `/admin/privacy` | `privacy/privacy-data.ts` | `clients`, `audit` |

**Step 6 — Cache hazard verification.**

Per-fetcher review: does the return type contain `Set<>`, `Map<>`, `Date`? If yes, transform to plain arrays / ISO strings before returning. Document any transform in the helper file's header comment.

Example:
```ts
// In privacy-data.ts:
// CACHE HAZARD AUDIT (RECON §15): the fetcher returns dates as ISO strings,
// not Date objects, because unstable_cache serializes the return value and
// re-hydration of Date objects across cache boundaries is unreliable.
```

**Step 7 — Vitest specs for cache wraps.**

For each new helper:
- Cache miss → fetcher runs.
- Cache hit (same key) → fetcher does NOT run again.
- Tag invalidation → next call runs fetcher again.

Test approach: mock `unstable_cache` to expose call counts; assert.

**Phase C verify checkpoint:**
- Lint + tsc + vitest green.
- Manual Playwright: trigger a mutation in one surface, verify the linked surface reflects immediately. E.g., create a client → /admin/clients shows new row on next refresh.

### Phase D — Filter-FAKE cleanup (5 surfaces)

Per the brief §2.4. One commit per surface, ordered by ease.

**Step 8 — `/admin/enquiries` filter wiring (commit 1).**

Edit `src/app/admin/enquiries/page.tsx`:
- Read `searchParams.status`, `searchParams.source`, etc.
- Pass into the new `enquiries-data.ts` fetcher (from Phase C Step 5).
- The fetcher applies `.eq("status", filter.status)` etc.
- Remove in-memory filter logic.
- Drop FAKE comments at lines 160, 187.
- Apply 5-step filter audit (per brief §2.4):
  1. URL parsed ✓
  2. Passed to fetcher ✓
  3. Server-side query ✓
  4. UI defaults ✓
  5. Empty-state copy ✓

**Step 9 — `/admin/staff` list filter wiring (commit 2).**

Same pattern:
- Read URL params (gender, active, role).
- Server-side query in `staff-list-data.ts`.
- Drop FAKE markers at lines 213, 516 + the `data-redesign-fake="staff-filter-query"` attribute.
- Workload-aggregates FAKE (line 312, 440) STAYS — not in C-09 scope. Add `// C-12+ data-redesign-fake retained` comment alongside if review is unclear.

**Step 10 — `/admin/operations` filter wiring (commit 3).**

6 markers across page.tsx + event-row.tsx:
- URL params for severity / event_type / from-date / to-date.
- Server-side query.
- Drop all `data-redesign-fake="filter-query"` attributes.

**Step 11 — `/admin/emails` filter wiring (commit 4).**

3 markers across page.tsx + DeliveryFilterStrip.tsx:
- URL params for event_type / recipient_role / delivery_status.
- Migrate in-memory slice (line 251) to server-side.
- Drop FAKE markers.

**Step 12 — `/admin/privacy` filter wiring (commit 5).**

3 markers across page.tsx + PrivacyFilterBar.tsx:
- URL params for status / request_type.
- Server-side query.
- Drop FAKE comments + data-attribute.

**Step 13 — Vitest specs per swept surface.**

For each, add a test asserting:
- Filter param in URL → fetcher receives it → query applies it → result reflects.
- Empty result with filters → empty-state copy reads "No results matching your filters."
- Empty result without filters → empty-state copy reads "No data yet" or similar.

**Phase D verify checkpoint per surface:**
- Manual Playwright: visit each swept surface with a filter URL → result reflects.
- Visit without filter → all data.
- Toggle filter via UI → URL updates → result re-fetches.

### Phase E — C-12+ FAKE inventory docs

**Step 14 — Create `redesign/audits/C-A/c-12-plus-fake-inventory.md`.**

Single docs deliverable for the future band:

```markdown
# C-12+ FAKE marker inventory (distributed from C-09)

Per C-09 brief §2.5, the non-filter FAKE markers were explicitly out
of C-09 scope. This doc enumerates them for C-12+ planning.

## Categories

### Backend stubs (no real action)

- `account-password-requests/ApproveModal.tsx:75` — `data-redesign-fake-source="approve handler — BUILD-approve-reject-password-reset.md"` — approve action doesn't persist notes
- `account-password-requests/RejectModal.tsx:73` — same shape for reject
- `roles/[roleId]/DangerZonePanel.tsx:115` — `data-redesign-fake="delete-role"` — delete role is a no-op
- `roles/CreateRoleSheet.tsx:39, 171` — `data-redesign-fake="create-role"` — create role disabled until BUILD plan

### RBAC + render fallback stubs

- `email-templates/preview/[id]/route.ts:9, 84, 172` — RBAC check is FAKE; render fallback FAKE

### Workload aggregate stubs

- `staff/page.tsx:312, 440` — `data-redesign-fake="staff-workload-aggregates"` — derived client-side rather than from a real query

### Staff availability action stubs

- `staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx:200` — override-actions FAKE
- `staff/[staffId]/availability/StaffBlockedDatesManager.tsx:176` — blocked-dates-actions FAKE

### One-off

- `audit/page.tsx:117` — BUILD-audit-target-existence
- `emails/ManualSendSheet.tsx:291` — booking-context picker depends on BUILD-email-templates-actions
- `emails/ReminderResendForm.tsx:56` — FAKE-FAILURE-PATH (mentioned in audit but not in current grep — verify)

## Recommended C-12+ approach

Cluster by category:
- A: Backend stubs for password-reset + roles workflows
- B: RBAC / render fallback hardening
- C: Workload aggregate query
- D: Staff availability per-day action wiring
- E: Email-side polish

Each cluster gets its own focused C-12+ plan.
```

This is the C-09 deliverable; future band planners pick from this list.

**Phase E verify checkpoint:**
- Docs file exists with correct file:line references.
- No code changes for this phase.

---

## 2 — Files touched (final list)

### NEW (~14 files)
| File | Purpose |
|---|---|
| `src/lib/cache/tag-taxonomy.ts` | Tag constants + audience map |
| `src/app/admin/clients/clients-list-data.ts` | Cached list fetcher |
| `src/app/admin/clients/[clientId]/client-detail-data.ts` | Cached detail fetcher |
| `src/app/admin/bookings/bookings-list-data.ts` | Cached list fetcher |
| `src/app/admin/bookings/[bookingId]/booking-detail-data.ts` | Cached detail fetcher |
| `src/app/admin/staff/staff-list-data.ts` | Cached list fetcher |
| `src/app/admin/staff/[staffId]/staff-detail-data.ts` | Cached detail fetcher |
| `src/app/admin/calendar/calendar-data.ts` | Cached calendar fetcher |
| `src/app/admin/enquiries/enquiries-data.ts` | Cached + filter-wired fetcher |
| `src/app/admin/emails/emails-data.ts` | Cached + filter-wired fetcher |
| `src/app/admin/settings/settings-data.ts` | Cached fetcher |
| `src/app/admin/audit/audit-data.ts` | Cached fetcher |
| `src/app/admin/operations/operations-data.ts` | Cached + filter-wired fetcher |
| `src/app/admin/privacy/privacy-data.ts` | Cached + filter-wired fetcher |
| `redesign/audits/C-A/c-12-plus-fake-inventory.md` | C-12+ deliverable |
| Per-helper vitest specs | One per new data helper |

### EDITED (~25 files)

**Mutations getting tag additions (~10):**
- `clients/actions.ts`, `bookings/actions.ts`, `bookings/recurring-actions.ts`, `staff/actions.ts`, `availability/actions.ts`, `enquiries/actions.ts`, `settings/actions.ts`, `emails/actions.ts`, `email-templates/actions.ts`, `privacy/actions.ts`

**Pages migrating to data-helper consumption (~10):**
- All `page.tsx` files that previously did inline supabase fetches — now consume their new `*-data.ts` helpers.

**Existing wraps extended (3):**
- `performance-data.ts:54`
- `dashboard-data.ts:160`
- `reports-data.ts:51`

**Filter-FAKE files cleaned (5 + sub-components):**
- enquiries/page.tsx
- staff/page.tsx
- operations/page.tsx + event-row.tsx
- emails/page.tsx + DeliveryFilterStrip.tsx
- privacy/page.tsx + PrivacyFilterBar.tsx

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- Non-filter FAKE markers (per brief §2.5 — C-12+).
- Existing `report-data` + `dashboard-data` tag semantics (additive only).
- Schema (zero migrations).

---

## 3 — Verification gate

### 3.1 Static gates

```bash
pnpm lint                       # 0 errors
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget:** new helpers are server-only (no client impact). Filter-FAKE wiring removes some in-memory filter logic (slight reduction). **Plan ceiling: -2 kB to +1 kB net change. Effectively neutral.**

### 3.2 Cache invalidation E2E sweep

Per mutation → relevant page invalidates:

| Mutation | Triggers | Expected immediate effect |
|---|---|---|
| `createClient` | Owner creates test client | `/admin/clients` shows new row (within 1-2s) |
| `createManualBooking` | Owner creates test booking | `/admin/bookings`, `/admin/clients` (new client created), `/admin/dashboard`, `/admin/calendar` all reflect |
| `updateBusinessSettings` (B-149 fix) | Owner reduces booking_window_days | `/admin/bookings/new` date picker max updates |
| `claimBookingAssignment` (B-128 fix) | Therapist claims a slot | `/admin/staff/[id]` recent bookings reflect immediately |
| `quickUpdateBooking` confirm | Admin confirms pending booking | `/admin/bookings`, `/admin/dashboard` reflect |
| `addClientNote` | Admin adds a note | `/admin/clients/[id]` reflects |
| `saveTemplateOverride` | Admin edits email template | `/admin/emails` Templates tab reflects |

### 3.3 Filter-FAKE sweep — 5 surfaces verified

Per surface, walk:

1. Visit with `?filter=value` URL → page renders with filter applied (verify via row count + spot-check rows).
2. Visit without URL params → all data.
3. Apply filter via UI → URL updates → page re-fetches → row count narrows.
4. Apply filter that yields 0 results → empty-state copy reads "No results matching your filters."
5. Remove filter → all data returns.

Surfaces:
- `/admin/enquiries`
- `/admin/staff`
- `/admin/operations`
- `/admin/emails`
- `/admin/privacy`

### 3.4 Cache hazard verification

Run vitest test suite. If any new helper's cached return type contains `Set<>` / `Map<>` / `Date`, the test should fail with a deserialization error. Document any caught hazard in progress file.

### 3.5 Playwright role sweep (no UI changes — smoke check only)

Per role, walk through 5-6 admin surfaces in both light + dark themes (after C-11 ships) at 1280:
- Confirm no visual regressions vs pre-C-09 baseline.
- C-09 is invisible to users (cache + filter wiring); regressions only manifest as broken pages.

### 3.6 Performance + observability check

Compare `unstable_cache` hit ratios pre/post in dev:
```bash
# Add temporary logging to data helpers; trigger a page load 5x with no mutations
# Expected: cache hit on 4/5 reads (1 miss on first load, 4 hits subsequent).
```

If hit ratio is unexpectedly low (e.g., cache key isn't stable), investigate.

### 3.7 Screenshot evidence

C-09 is invisible — minimal screenshots:
- 1 screenshot per swept filter surface showing filter applied (5 screenshots)
- 1 "before/after" comparison on /admin/bookings/new after B-149 settings update demo

Store in `redesign/audits/C-A/c-09-after/`.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Cache key instability (different JSON shapes for same filters) | medium | medium | `JSON.stringify(filters)` produces stable order if keys are sorted. Use `Object.keys(filters).sort()` or a normaliser helper. |
| Resource tag conflict with existing tag names | low | low | Pre-flight grep confirms `clients`, `bookings`, etc. aren't already in use as tags. Existing tags are `report-data` + `dashboard-data` — no conflict. |
| Cached function returns hazardous type | medium | medium | Pre-flight Step 6 + per-helper review (Phase C Step 6). Documented mitigation. |
| Tag invalidation too aggressive (everything invalidates everything) | low | medium | Resource-tag granularity is selective — only fetchers that listed a tag get invalidated. Per-mutation tag set is precise (not all-fire). |
| Tag invalidation too narrow (mutation forgets a tag) | medium | medium | Per-mutation matrix in brief §2.2 is the source of truth. Code review checklist + vitest spec per mutation. |
| `unstable_cache` API changes in future Next.js versions | low | low | Stable API today; future migration handled separately. |
| Filter-FAKE wiring breaks existing filter UX | medium | medium | Per-surface 5-step audit (brief §2.4). Playwright manual + vitest per surface. |
| Operations page becomes slower (more rows visible — filter was hiding) | low | low | Server-side filters should be FASTER. If somehow slower at scale, paginate in C-12+. |
| Audit log fetcher hits DB on every read (tag-invalidates frequently) | medium | low | Acceptable trade-off; load is low. C-12+ refine if needed. |
| Per-fetcher cache key collision when two pages have similar params | low | medium | Include surface-name prefix in cache key: `[`clients-list`, JSON.stringify(filters)]`. |
| Filter-FAKE removal breaks a URL someone bookmarked | low | low | URL contracts preserved (params still parsed); just now they actually apply server-side. Bookmarked URLs now produce filtered results. |
| Cross-plan: a C-NN plan not merged yet has a server action that needs tags | medium | low | Pre-flight Step 8 documents stubs. Tag additions in unmerged plans deferred with `// TODO C-09:` comments. Plan implementer fills in. |

### 4.1 Real risk: tag taxonomy drift over time

As new features land (C-12+), each new mutation needs to apply the right tags. Without a maintained matrix, mutations may forget tags → cache gaps re-emerge.

**Mitigation:**
- `tag-taxonomy.ts` is the single source of truth (with the audience map).
- Code review checklist: every new server action calls `updateTag` for resources it touches.
- Optional follow-up: lint rule that warns on `from(table)` writes without an `updateTag` call. C-12+ ops.

### 4.2 Real risk: filter-FAKE cleanup increases page latency

Currently: fetch ALL rows + filter in memory. Fast for small datasets.
After: fetch FILTERED rows from DB.

For small datasets, the change is wash. For large datasets (operations with 1000+ events), DB-side filtering is faster + reduces network payload.

**Verification:** Playwright timing comparison per swept surface pre/post Phase D.

---

## 5 — Undo procedure

### 5.1 Per-phase revert

Phases are commits in order. Revert in reverse:
1. `git revert <phase-E-docs>` — drops c-12-plus-fake-inventory.md.
2. `git revert <phase-D-filter-N>` (×5) — re-introduces FAKE markers + in-memory filters.
3. `git revert <phase-C-wraps>` — drops new data helpers; pages re-inline supabase queries.
4. `git revert <phase-B-mutations>` — removes resource-tag calls from mutations.
5. `git revert <phase-A-taxonomy>` — drops tag-taxonomy.ts.

If only one phase needs reverting (e.g., Phase D filter-X causes a regression), revert just that commit.

### 5.2 No DB rollback

C-09 has no migrations. No DB state to undo.

---

## 6 — Test fixture guidance

**Safe for C-09 E2E:**
- All standard test fixtures.
- Any test mutation that exercises a cache invalidation path.

**DO NOT touch:**
- Badar's `9d55ce2a`, real customer data.

**Verification mutations:** create + immediately read pattern. Documented in §3.2.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Phase coverage |
|---|---|
| 1 | Phase A — tag-taxonomy.ts + tests |
| 2 | Phase B (mutation sweep) — split into 2-3 sub-commits by file group if extensive |
| 3 | Phase C Step 4 — extend existing unstable_cache wraps |
| 4 | Phase C Step 5 — introduce new data helpers + page migration. Split per surface if needed. |
| 5 | Phase D — filter-FAKE cleanup, ONE COMMIT PER SURFACE (5 commits) |
| 6 | Phase E — C-12+ FAKE inventory docs |
| 7 | Verification — Playwright + WCAG + progress + master plan ✅ |

`feat(redesign): C-09 {phase}` prefix during C-C. Filter-FAKE commits use `chore(redesign): C-09 filter wiring — {surface}`.

---

## 8 — Hand-off to C-C

1. Read brief + plan end-to-end.
2. Run §0 Pre-flight in full. Capture baseline counts (animate-spin, filter-FAKE markers, cache hazards).
3. Execute Phase A → B → C → D → E in order.
4. No migration needed.
5. Verification gate (§3) non-negotiable — especially the cache-invalidation E2E sweep (§3.2) and filter-FAKE sweep (§3.3).
6. Update progress file per phase.
7. Final commit updates master plan checklist C-09 → ✅.

---

## 9 — Open questions remaining

1. **Tag-key naming clash check** — pre-flight greps for existing `'clients'`, `'bookings'`, etc. tag uses elsewhere. Should return 0 results.
2. **Cache key stability** — `JSON.stringify(filters)` deterministic? Use sorted-key version if not.
3. **Operations page server-side filter cost at scale** — Q9.8. Playwright timing post-Phase D documents.
4. **Tag invalidation observability** — temporary console.log instrumentation acceptable during impl + removed before commit. Permanent tooling = C-12+.
5. **Per-page cache strategy** — some pages may want `revalidate: 0` (fresh always) vs `revalidate: 60` (cached for a minute). Default to 60s; tune per surface during impl if needed.
6. **Cross-plan tag stubs for unmerged plans** — pre-flight Step 8. Comment-tag the unmerged actions; document in progress.
7. **Filter-FAKE removal that surfaces a hidden bug** — e.g., the server-side filter logic reveals a SQL injection risk or RLS gap. Surface immediately; fix in same commit.
8. **Empty-state copy adaptive to filters** — per-surface judgement. Plan §2.4 includes the checklist.
9. **`unstable_cache` revalidate interval** — default to 60s. Some surfaces (audit, operations) may want shorter (e.g., 10s) for freshness. Tune per surface.

---

*End of C-09 plan. Brief: `redesign/briefs/C-09-cache-invalidation-filter-cleanup-brief.md`. Progress: `redesign/per-page-progress/C-09-cache-invalidation-filter-cleanup-progress.md` (filled during C-C).*
