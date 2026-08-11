# Item 4 — column-usage re-verification (A-column-usage)

Repo: `rahmatherapy-next-refactor`. Anchor commit for line numbers: `33f895f910c6a0a9e08a22896716ba4bb6c8adfd` (2026-08-09 22:49:47 +0100).
Current HEAD at time of check: `91a5864538d33b98c64d6bfc064de0034131b329` (2026-08-11 19:28:41 +0100).

Method: extracted `src/app/admin/bookings/bookings-list-data.ts` as it existed at commit `33f895f` via
`git show 33f895f:src/app/admin/bookings/bookings-list-data.ts`, read it in full, and independently
grepped for every column token inside the claimed line range. Then diffed 33f895f against HEAD for
this file to check whether the anchors have since drifted.

```
git diff 33f895f HEAD -- src/app/admin/bookings/bookings-list-data.ts
```
Output: **empty** — the file is byte-identical between 33f895f and current HEAD. No drift.

## Claim 1 — function location

`buildBookingPredicatePlan` — claimed lines 273-401.

Actual: **lines 273-401**, confirmed exact.
- L273: `export function buildBookingPredicatePlan(`
- L401: closing `}` (L400 is `return { embeds, steps };`)

Verdict: **CONFIRMED**, no drift.

## Claim 2 — column-usage counts inside the function body

All re-derived independently via `grep -n "<token>" file | awk -F: '$1>=273 && $1<=401'` against the
33f895f extraction, then read in context.

| Column | Claimed count | Claimed lines | Actual count | Actual lines | Verdict |
|---|---|---|---|---|---|
| `booking_date` | 5 | L332, L338, L341, L366, L367 | 5 | L332, L338, L341, L366, L367 | CONFIRMED |
| `assignment_status` | 4 | L313, L345, L348, L364 | 4 | L313, L345, L348, L364 | CONFIRMED |
| `recurring_template_id` | 2 (mutually exclusive branches) | L357, L358 | 2 | L357 (`if (ctx.templateId) eq(...)`), L358 (`else steps.push({op:"notNull",...})`) — genuinely if/else, mutually exclusive | CONFIRMED |
| `reschedule_status` | 1 | L314 | 1 | L314 (`"reschedule_status.eq.requested"`, inside the `attention` view's `or()`) | CONFIRMED |
| `payment_status` | 1 | L365 | 1 | L365 (`if (ctx.paymentStatus) eq("payment_status", ctx.paymentStatus);`) | CONFIRMED |
| `customer_cancelled_at` | 1 | L315 | 1 | L315 (`"customer_cancelled_at.not.is.null"`, inside `attention`'s `or()`) | CONFIRMED |
| `client_id` | 1 | L395 | 1 | L395 (`arms.push(`client_id.in.(${ctx.searchClientIds.join(",")})`);`) | CONFIRMED |
| `status` (bookings.status) | 6 | L294 (`notInert()` def, reached from L303 and L331) + L312, L342, L351, L354, L363 | 6 | Same 6 distinct source lines where the literal column name `"status"` is written as a `bookings.status` predicate: L294 (`notInert()`'s own `steps.push`), L312 (`"status.eq.pending"` string inside `attention`'s `or()`), L342 (`neq("status","completed")`, upcoming), L351 (`eq("status","completed")`, completed), L354 (`steps.push({op:"in",column:"status",...})`, cancelled), L363 (`if (ctx.status) eq("status", ctx.status)`, post-view filter) | CONFIRMED |

Notes on the `status` count's methodology (re-derived, not just accepted): `notInert()` is a single
helper *defined* at L294 and *called* from two sites, L303 (archive-exclusion rule) and L331
(claimable case, "repeated on purpose"). Neither call site (L303, L331) itself contains the literal
token `status` — they only invoke the helper by name. Counting "distinct source sites that emit a
`status` predicate" as *places in the source text where the column name is written* (rather than
*call sites of a shared helper*) gives exactly 6, matching the claim. If one instead counted every
call site of `notInert()` separately (L303 and L331 as two more emissions, on top of L294's
definition), the total would be 7 — but that is not the counting method the claim specifies, and the
6-count with the stated line set is what the actual code supports under the specified method.

Full independent grep for `status` in the 273-401 range (for audit trail):
```
294:    steps.push({ op: "notIn", column: "status", value: INERT_STATUS_FILTER });
298:  // operator explicitly picked one of those two statuses.        <- comment, not a predicate
300:    ctx.status === "cancelled" || ctx.status === "no_show";        <- reads ctx.status (query param), not a column predicate
312:          "status.eq.pending",
313:          "assignment_status.neq.fully_assigned",
314:          "reschedule_status.eq.requested",
333:      eq(`${embed("fv")}.status`, "unassigned");                  <- fv.status = booking_assignments.status, NOT bookings.status (see Claim 3)
342:      neq("status", "completed");
345:      eq("assignment_status", "unassigned");
348:      eq("assignment_status", "partially_assigned");
351:      eq("status", "completed");
354:      steps.push({ op: "in", column: "status", values: ["cancelled", "no_show"] });
363:  if (ctx.status) eq("status", ctx.status);
364:  if (ctx.assignmentStatus) eq("assignment_status", ctx.assignmentStatus);
365:  if (ctx.paymentStatus) eq("payment_status", ctx.paymentStatus);
```
L298 (comment) and L300 (reads the query-string filter `ctx.status`, does not emit a predicate) are
correctly excluded from the count. L333 is correctly excluded from the `bookings.status` count — see
Claim 3.

## Claim 3 — the 7th `status` occurrence (L333) targets `booking_assignments.status`, not `bookings.status`

Line 333 (33f895f): `eq(`${embed("fv")}.status`, "unassigned");` — inside the `claimable` case.

`BOOKING_FILTER_EMBEDS` (33f895f, lines 193-202):
```ts
export const BOOKING_FILTER_EMBEDS = {
  /** The view's own EXISTS on assignments (`assigned` / `claimable`). */
  fv: "booking_assignments",
  /** `required_gender` filter. */
  fg: "booking_assignments",
  /** `assigned_staff` filter. */
  fa: "booking_assignments",
  /** `service` filter. */
  fs: "booking_items",
} as const;
```
So `fv` resolves to `booking_assignments`.

`bookingSelectWith` (lines 468-477) turns each embed alias into a PostgREST aliased `!inner` embed on
the select string:
```ts
const joins = embeds
  .map((alias) => `${alias}:${BOOKING_FILTER_EMBEDS[alias]}!inner(id)`)
  .join(",");
```
i.e. for `fv` this emits `fv:booking_assignments!inner(id)` on the `bookings` select — a PostgREST
INNER-joined embedded resource aliased `fv`. `applyBookingPredicates` then calls
`.eq("fv.status", "unassigned")` on the query builder (via the `eq()` step), which is PostgREST's
embedded-filter syntax and applies to the *joined* `booking_assignments` row (through the `fv` alias),
not to the top-level `bookings.status` column.

Verdict: **CONFIRMED**. The 7th `status` site (L333) filters `booking_assignments.status` via the
`fv` alias/embed, not `bookings.status`. It correctly does not belong in the `bookings.status`
column-usage count used to justify an index on `bookings.status`.

## Claim 4 — `visibleBookingViews(true)` and `getBookingViewCounts` fan-out

`visibleBookingViews` (33f895f, lines 916-932):
```ts
export function visibleBookingViews(canViewAll: boolean): BookingViewKey[] {
  return canViewAll
    ? [
        "attention",
        "today",
        "upcoming",
        "claimable",
        "assigned",
        "unassigned",
        "partially_assigned",
        "completed",
        "cancelled",
        "all",
        "series",
      ]
    : ["today", "upcoming", "claimable", "assigned", "completed"];
}
```
`canViewAll === true` branch has exactly 11 entries, in the exact order claimed:
attention, today, upcoming, claimable, assigned, unassigned, partially_assigned, completed,
cancelled, all, series.

`getBookingViewCounts` (lines 950-967):
```ts
export async function getBookingViewCounts(params: {
  profile: Profile;
  filters: BookingListFilters;
  views: readonly BookingViewKey[];
}): Promise<Partial<Record<BookingViewKey, number>>> {
  const { profile, filters, views } = params;
  const base = await resolveBookingPredicateContext(profile, filters);

  const totals = await Promise.all(
    views.map((view) => countBookings({ ...base, view }))
  );
  ...
}
```
`countBookings` (lines 776-800) issues exactly one `count: "exact", head: true` PostgREST query per
call:
```ts
const { count, error } = await applyBookingPredicates(
  adminClient
    .from("bookings")
    .select(bookingSelectWith("id", plan?.embeds ?? []), {
      count: "exact",
      head: true,
    }),
  plan?.steps ?? []
);
```
So `getBookingViewCounts` fans out one `count:"exact", head:true` query per entry of whatever `views`
array it's given, via `Promise.all`. (The function itself is generic over `views`; it is
`visibleBookingViews(canViewAll)`'s 11-entry result that the caller is expected to pass for the
clinic-wide chip row — confirmed by the array shape above, not separately traced to the caller site
since the claim only asked to verify the array literal and the fan-out mechanism.)

Verdict: **CONFIRMED**.

## Claim 5 — ordering and pagination

`getBookingsListData`, clinic-wide (`canViewAll`) branch (33f895f, lines 696-712):
```ts
let query = applyBookingPredicates(
  adminClient
    .from("bookings")
    .select(bookingSelectWith(BOOKING_SELECT, plan?.embeds ?? [])),
  plan?.steps ?? []
)
  .order("booking_date", { ascending: false })
  .order("start_time", { ascending: false })
  .order("id", { ascending: false });
if (limit !== undefined) {
  const start = offset ?? 0;
  query = query.range(start, start + limit - 1);
}
```
Order is `booking_date DESC, start_time DESC, id DESC`, and `.range()` pagination is applied whenever
`limit !== undefined`.

Verdict: **CONFIRMED**.

## Claim 6 — live-database constraints (SELECT-only, project twzutkfgqclqurvkmvqz)

Query 1 — column nullability/type on `public.bookings`:
```sql
SELECT column_name, is_nullable, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings'
  AND column_name IN ('booking_date','start_time','id','status')
ORDER BY column_name;
```
Result:
```
booking_date | is_nullable=NO | data_type=date               | udt_name=date
id           | is_nullable=NO | data_type=uuid                | udt_name=uuid
start_time   | is_nullable=NO | data_type=time without time zone | udt_name=time
status       | is_nullable=NO | data_type=USER-DEFINED         | udt_name=booking_status_type
```
`booking_date`, `start_time`, `id` are all `is_nullable = NO` (NOT NULL). Confirmed.

Query 2 — enum values of `booking_status_type`:
```sql
SELECT e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'booking_status_type'
ORDER BY e.enumsortorder;
```
Result (in enum sort order):
```
1 pending
2 confirmed
3 completed
4 cancelled
5 no_show
```
Exactly 5 values, matching the claim's list (pending, confirmed, completed, cancelled, no_show).

Verdict: **CONFIRMED** on both sub-claims (NOT NULL columns; 5-value enum).

## Summary

| Claim | Verdict |
|---|---|
| 1 — `buildBookingPredicatePlan` at 273-401 | CONFIRMED, no drift (33f895f == HEAD for this file) |
| 2 — column-usage counts | CONFIRMED, all counts and line numbers exact |
| 3 — L333 `fv.status` targets `booking_assignments.status`, not `bookings.status` | CONFIRMED |
| 4 — `visibleBookingViews(true)` 11 entries + `getBookingViewCounts` fan-out | CONFIRMED |
| 5 — ordering `booking_date DESC, start_time DESC, id DESC` + `.range()` | CONFIRMED |
| 6 — live DB: `booking_date`/`start_time`/`id` NOT NULL, `booking_status_type` has exactly 5 values | CONFIRMED |

No drift found anywhere. All claimed line numbers and counts hold exactly as stated, both at commit
`33f895f` and at current HEAD (`91a5864`, file identical for this path).
