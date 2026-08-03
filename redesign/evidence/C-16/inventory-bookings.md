# C-16 Phase A Step 1 — Bookings surfaces inventory

**Scope:** `src/app/admin/bookings/**` (list, `[bookingId]` detail, `new`, `series/[templateId]`) + their data helpers.
**Method:** read-only source inspection at HEAD `74ed6ed` (branch `master`). No audit claim taken on faith — every row below is re-derived from the current file, not from the 2026-07-16 audit or the brief's line numbers.
**Today's real row counts (given, 2026-08-03):** bookings 15 · clients 15 · enquiries 3 · staff_profiles 12 · services 5 · audit_logs 121 · email_delivery_events 43.

**Regions found: 9** (1 unbounded growing list, 1 unbounded-but-naturally-small scoped list, 1 confirmed-already-bounded series list, 4 per-booking nested lists on the detail page — all bounded by nature or explicit cap, 2 static/slow option lists on `new`). No chip/tab-count region exists to inventory (see Extra-depth §4).

---

## Inventory table

| Surface | Component | Query site | Growth class | Current bound | In-memory filtering? | 5-year projection | Verdict | Notes |
|---|---|---|---|---|---|---|---|---|
| `/admin/bookings` (canViewAll branch) | `BookingListSection` (`src/app/admin/bookings/page.tsx:280-329`) renders `filterBookings(bookings, query, profile, currentView)` | `bookings-list-data.ts:283-293` inside `getBookingsListData` — extracted helper, not inline in `page.tsx` (moved by C-09 Phase C Step 5) | fast (bookings) | **none** — `.range()` code exists (`bookings-list-data.ts:289-292`) but is only applied when `limit !== undefined`; `page.tsx:305` calls `getBookingsListData({ profile, canViewAll })` with no `limit`/`offset`, so today it is a full unbounded `select(BOOKING_SELECT)` ordered by date/time, every row, every visit | **Yes** — `filterBookings` (`page.tsx:57-202`) runs in JS over every row `getBookingsListData` returned | ~10-15k rows | **paginate** | Pagination-ready plumbing (`limit`/`offset` params + cache-key inclusion + `countBookings()` head-count helper) already shipped by C-09 (`bookings-list-data.ts:24-31, 257-263, 344-362`) and unit-tested (`__tests__/bookings-list-data.test.ts:108-115, 133-137`) but **not wired to any caller** — `countBookings` docstring says "not used by the page today." Phase C's job is to call it with real params + translate `filterBookings`' view/filter predicates into the SQL `WHERE`, not to build the pagination mechanism from scratch. |
| `/admin/bookings` (therapist-scoped branch: assigned + claimable) | same `BookingListSection` | `bookings-list-data.ts:296-326` — two separate `.in("id", ids)` reads (assigned ids, claimable-only ids from `getScopedBookingIds`, lines 121-154) merged with `[...a, ...b].sort(...)` | fast in theory, naturally small in practice (bounded to one therapist's own assignments + gender-matched open slots) | **none, and explicitly cannot be `.range()`'d per-query** — code comment `bookings-list-data.ts:26-31`: "They deliberately do NOT slice the therapist-scoped branch... a per-query range would page each half independently and produce a wrong window." | Yes — same `filterBookings` pass afterward | tens to low hundreds per therapist, not thousands | **cap+view-all** (brief's own §2.3 call: "scoped path gets a defensive cap (200) + note") — confirmed still the right shape at HEAD | No defensive cap of any kind exists yet on this branch — it is truly unbounded today, just naturally small given real assignment counts. Phase C cannot fix this with a naive `.range()` on either half; a real fix needs a cap applied to each `.in(...)` read (or a redesign merging the two id-sets before the row fetch). |
| `/admin/bookings` — view/tab chip counts | `BookingsChrome.tsx:302-380` (nav pills) | **none** | n/a | n/a | n/a | n/a | n/a | **No chip/tab-count feature exists today.** See Extra-depth §4 below — this contradicts an easy misreading of brief §2.3's "Tab badges (view counts) become cheap count-only queries" as describing an existing expensive feature being optimized. It is not; it is a net-new feature Phase C must build from nothing. |
| `/admin/bookings/series/[templateId]` — upcoming/past visit lists | `SeriesViewPage` (`series/[templateId]/page.tsx:194-459`), `VisitRow` | `page.tsx:236-269` — `.limit(10)` ascending (upcoming), `.limit(5)` descending (past), plus two `count:"exact",head:true` queries for the header numbers and `viewAllHref` total | fast in theory (bookings table), scoped to one series in practice | **hard cap (10 upcoming + 5 past)** + count-only companions — `.limit(10)` / `.limit(5)` at lines 244/252, counts at 253-262 | No — SQL-side `.gte`/`.lt` + `.order` + `.limit`, no JS filtering | a weekly `until_cancelled` series reaches ~260 visits in 5 years; this page never fetches past the caps | **already-correct** | Code comment (`page.tsx:221-227`) states this was built with C-16 in mind: "C-16's shared `PaginationBar` does not exist yet (confirmed before writing this), so these hard caps are the floor, not a placeholder for it." **Verified true at HEAD** — no `PaginationBar`/`pagination.ts` exists anywhere in the repo yet (checked: no matches under `src/app/admin/components` or `src/lib`). |
| `/admin/bookings/series/[templateId]` → "View all N visits" link | `page.tsx:439-445` → `/admin/bookings?view=series&templateId=<id>` | inherits the main list's query | fast | **inherits the unbounded canViewAll fetch above** | inherits `filterBookings`'s `series` branch (`page.tsx:133-136`) | same as main list | **paginate** (same fix as row 1) | Worth flagging explicitly: the series page's own caps do NOT protect the page this link lands on. A long-lived series' "view all" click currently pulls every booking in the whole clinic (not just the series) into memory before `filterBookings` narrows it down to the templateId — same cost as the general unbounded fetch, just with a heavier subsequent filter. |
| `/admin/bookings/[bookingId]` — Participants panel | `ParticipantsPanel`/`ParticipantRow` (`[bookingId]/page.tsx:618-757`) | nested `booking_participants(...)` in `BOOKING_DETAIL_SELECT` (`booking-detail-data.ts:114`) — one query, no separate limit | static (bounded by nature — participants per single booking, not by table age) | none needed — bounded by real-world booking size (1-6ish people) | No | stays small regardless of calendar years elapsed | **already-correct** | Not a "growing with the business" list; it grows only with the size of one booking. |
| `/admin/bookings/[bookingId]` — Assignment panel | `AssignmentPanel`/`AssignmentRow` (`page.tsx:761-1015`) | nested `booking_assignments(...)` in same select (`booking-detail-data.ts:116`) | static (bounded by nature) | none needed | No | stays small | **already-correct** | Same reasoning as participants — one row per participant, roughly. |
| `/admin/bookings/[bookingId]` — Email activity panel | `EmailActivityPanel` (`page.tsx:1060-1134`) | nested `email_delivery_events(...)` in `BOOKING_DETAIL_SELECT` (`booking-detail-data.ts:117`) — no limit | static (bounded by nature — per-booking email count, not the clinic-wide emails-delivery-log surface the brief separately flags at `emails/page.tsx`) | none, but naturally small (confirmation + reminder + reschedule notices ≈ single digits to low tens per booking even over years) | Sorts in JS (`page.tsx:1074-1076`) but doesn't filter — display-only re-sort of an already-small set | stays small per booking | **already-correct** | Do not conflate with the clinic-wide emails delivery log (a different admin surface, out of this agent's scope) — that one really is unbounded/capped-at-100 and IS one of C-16's targets; this per-booking panel is a different, already-bounded thing. |
| `/admin/bookings/[bookingId]` — Activity timeline | `ActivityPanel` (`page.tsx:1164-1228`) | `booking-detail-data.ts:386-417` — two `audit_logs` reads each `.limit(auditLimit)` (default `BOOKING_DETAIL_AUDIT_LIMIT = 10`), merged, sorted, `.slice(0, BOOKING_DETAIL_TIMELINE_CAP)` (= 20) | fast table (`audit_logs`, 121 rows today, ~100k+ in 5 years per brief §1.1) but this *view* of it is scoped to one booking + its assignments | **hard cap (10+10 merged, capped at 20)** | Yes, but over an already-capped set (merge + sort + slice of ≤20 rows, not the whole table) | stays at ≤20 regardless of table growth | **already-correct** | The helper's own comment (`booking-detail-data.ts:40-45`) states: "this surface is not on C-16's Phase A list and carries no unbounded list." **Verified true** — confirmed by re-reading the code, not taken on the comment's word alone. |
| `/admin/bookings/new` | `NewAdminBookingPage` (`new/page.tsx:18-132`) | `new/page.tsx:41-77` — `services` (active+visible, ordered), `staff_profiles` (active+bookable, ordered), single-row `clients`/`enquiries` prefill by id, single-row `business_settings` | slow/static (services ≈5, staff ≈12) | none explicit, but bounded by nature (`is_active`/`can_take_bookings` filters on tiny tables) | No | stays ≈flat (a handful of services/staff, not a growing-with-bookings table) | **already-correct** | No client search/autocomplete list query in `ManualBookingForm.tsx` either (checked — only `fetch("/api/availability")` and a postcode lookup, neither a rendered admin list). |
| `/admin/bookings` — chrome filter-dropdown options | `getBookingsChromeData` (`bookings-list-data.ts:227-255`) | `services`/`staff_profiles`, active-only, ordered by name | slow/static | none explicit, bounded by nature | No | stays ≈flat | **already-correct** | Cached 60s, tagged `BOOKINGS`/`CLIENTS`/`STAFF`. |

---

## Extra-depth findings (bookings list — the plan's largest change)

### 1. What the canViewAll branch fetches today, with evidence

`page.tsx:280-329` (`BookingListSection`) calls `getBookingsListData({ profile, canViewAll })` — **no `limit`/`offset` passed**. Inside `bookings-list-data.ts:283-293`:

```ts
if (canViewAll) {
  let query = adminClient.from("bookings").select(BOOKING_SELECT)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false });
  if (limit !== undefined) {
    const start = offset ?? 0;
    query = query.range(start, start + limit - 1);
  }
  return (await query.returns<BookingRecord[]>()).data ?? [];
}
```

Since `limit` is `undefined` at the only call site, the `if` never fires — this is a full-table read of `BOOKING_SELECT` (every scalar column plus nested `clients`, `booking_participants`, `booking_items`, `booking_assignments(...staff_profiles(name))`), every visit. `page.tsx:329` then runs `filterBookings(bookings, query, profile, currentView)` over the full in-memory array.

**So the audit's core behavioral claim is still true today**, but its citation (`bookings/page.tsx:438-446`) is stale — the fetch itself no longer lives in `page.tsx` at all; C-09 Phase C Step 5 (commit `64f8ee2`) extracted it to `bookings-list-data.ts`. `filterBookings` (the in-memory predicate function) is the part that stayed in `page.tsx`.

The **therapist-scoped branch** (`!canViewAll`, `bookings-list-data.ts:296-326`) is a different shape entirely: two `.in("id", [...])` reads (assigned-ids, claimable-only-ids) from `getScopedBookingIds`, concatenated and sorted in JS. It is genuinely unbounded (no cap of any kind), but self-limiting in practice because the id-lists come from a single therapist's own assignments. The code's own comment is explicit that C-16 cannot fix this with a per-query `.range()` — a range on each half pages the halves independently, producing a wrong combined window. This confirms the brief's own plan (§2.3: "scoped path gets a defensive cap (200) + note") is still the right call, not a naive `.range()`.

### 2. The full set of view keys `filterBookings` supports today, and what each predicate tests

From `BookingViewKey` (`BookingsChrome.tsx:15-26`) and the `matchesView` block (`page.tsx:106-136`):

| View key | Predicate (as literally written) | Columns touched |
|---|---|---|
| `all` | always true | — |
| `attention` | `status === "pending" \|\| assignment_status !== "fully_assigned" \|\| reschedule_status === "requested" \|\| Boolean(customer_cancelled_at)` | plain scalar columns on `bookings` |
| `assigned` | `isOwnBooking` → `booking_assignments.some(a => a.assigned_staff_id === profile.id)` | joined: `booking_assignments` |
| `claimable` | `!["cancelled","no_show"].includes(status) && booking_date >= today && hasClaimableAssignment(...)` where the latter checks `booking_assignments.some(a => a.status==="unassigned" && !a.assigned_staff_id && a.required_therapist_gender === profile.gender)` | scalar (`status`, `booking_date`) + joined (`booking_assignments`, gender-matched) |
| `today` | `booking_date === today` | scalar |
| `upcoming` | `booking_date >= today && status !== "completed"` | scalar |
| `unassigned` | `assignment_status === "unassigned"` | scalar (denormalized column, not derived from the join) |
| `partially_assigned` | `assignment_status === "partially_assigned"` | scalar |
| `completed` | `status === "completed"` | scalar |
| `cancelled` | `["cancelled","no_show"].includes(status)` | scalar |
| `series` | `templateId ? recurring_template_id === templateId : recurring_template_id !== null` | scalar |

Plus the pre-view "archive" exclusion (`page.tsx:96-104`): every view except `all`/`cancelled`/`series` drops `status in (cancelled, no_show)` **unless** the operator explicitly picked `status=cancelled` or `status=no_show` (`userWantsInertStatus`, `page.tsx:90`) — a C-05 Phase D fix, locked behavior per `filterBookings.test.ts`.

This list is confirmed current — `series` was added by C-02 Phase H (`ce5ad07`), and the `currentView` parameter (replacing an internal recompute) was added by C-07 Phase B3 (`838d049`, D5) — both post-audit, both reflected in the code read above, not from the brief's stale line numbers.

Post-view filters, applied to every view (`page.tsx:139-198`): `status`, `assignment_status`, `payment_status`, `from`/`to` date range (all plain scalar columns); `required_gender` (joined — `booking_assignments.required_therapist_gender`); `service` (joined — `booking_items.service_name_snapshot`); `assigned_staff` (joined — `booking_assignments.assigned_staff_id`); `location` (scalar, but an OR-across-three-columns substring match); `search` (spans `bookings` scalar columns **and** the raw `id` **and** the joined `clients` row's `full_name`/`email`/`phone`, all case-insensitive substring).

### 3. Which predicates are SQL-expressible vs. genuinely risky for a naive `.range()`

Every predicate above **is** expressible in SQL (Postgres has EXISTS/joins/ILIKE) — none is impossible. The risk Phase C actually has to manage is different: **any predicate backed by a join/EXISTS must be applied identically in both the `count:"exact"` query and the `.range()` query**, or the pager's "Showing X-Y of Z" total will drift from the rows actually returned. Flagged as joined/derived (not plain-column) and therefore worth double-checking at implementation time:

- `assigned` view — EXISTS against `booking_assignments` for `assigned_staff_id = profile.id`.
- `claimable` view — EXISTS against `booking_assignments` with a **gender match** (`required_therapist_gender = profile.gender`) plus `status`/`assigned_staff_id` conditions. Useful precedent: `getScopedBookingIds` (`bookings-list-data.ts:121-154`) already expresses this exact same gender-matched EXISTS in SQL today (for the therapist-scoped branch) — Phase C can lift that shape rather than invent a new one for the canViewAll branch.
- `required_gender` filter — EXISTS against `booking_assignments.required_therapist_gender`.
- `service` filter — EXISTS against `booking_items.service_name_snapshot`.
- `assigned_staff` filter — EXISTS against `booking_assignments.assigned_staff_id`.
- `search` — the widest one: spans `bookings` columns, the raw `id` (would need an `id::text ILIKE` cast — unusual and not indexable the normal way), **and** a joined `clients` row's three fields. This is the single hardest predicate to keep the count-query and range-query in exact agreement on.

One thing the brief's prompt implies as a risk that **turns out not to be one**: `payment_status` looks like it could be a derived/joined "payment state," but it is a **plain denormalized scalar column on `bookings` itself** (confirmed in `BOOKING_SELECT`, `types.ts:108`, and the direct `booking.payment_status !== paymentStatus` comparison at `page.tsx:141`) — trivial to push into SQL as a simple `.eq()`, no join needed.

Nothing in `filterBookings` touches "claimability windows" beyond the scalar `booking_date >= today` check already inside `hasClaimableAssignment` — there is no separate/more-complex claimability-window predicate hiding elsewhere in this file.

### 4. Chip/tab count computation

**There is none.** `BookingsChrome.tsx:302-380` renders the primary/overflow nav as plain text pills (`ALL_VIEW_LABELS`) with no numeric badge, count, or `aria-label` count anywhere — confirmed by reading the full component and by grepping the bookings directory for `badge|count|Count` (only false-positive matches in unrelated comments/tests). `getBookingsListData`/`countBookings` in `bookings-list-data.ts` don't feed any UI element today; `countBookings` is dead code awaiting a caller (per its own docstring, "not used by the page today"). Phase C is building tab counts from scratch, not converting an existing expensive computation.

### 5. `[bookingId]` detail and `new` pages — any unbounded list?

No. Detail page: participants/assignments are bounded by the size of one booking (not the whole table); email activity is bounded the same way (and is a different, unrelated surface from the clinic-wide emails delivery log the brief flags separately); the activity timeline is already explicitly capped (10+10 merged, sliced to 20) and its own code comment says it's intentionally excluded from Phase A's scope — verified true by reading the fetcher, not assumed. `new` page: only tiny slow/static option lists (services, staff) plus single-row prefill reads — no rendered list that grows with calendar time.

---

## Audit claims checked against today's HEAD

1. **Location claim, partially stale:** the audit's `bookings/page.tsx:438-446` citation for the unbounded fetch no longer points at a fetch — the query moved to `bookings-list-data.ts` (`getBookingsListData`, `~line 283-293`) when C-09 Phase C Step 5 extracted it (commit `64f8ee2`, pre-dating this inventory but post-dating the 2026-07-16 audit). **The behavioral claim itself (unbounded fetch, then in-memory `filterBookings`) is still true** for the `canViewAll` branch — this is a stale line-number, not a false claim.
2. **Implicit "greenfield" framing is wrong — the pagination plumbing already exists.** `bookings-list-data.ts` already has C-09-built `limit`/`offset` params (flowing into both the query and the cache key) and a `countBookings()` head-count helper, both unit-tested, both simply never called by any page today. Phase C's real task is smaller than "build pagination" — it's "wire the params through + translate `filterBookings` to SQL," not construct the mechanism from zero.
3. **Brief §2.3's "tab badges (view counts)" phrasing could be misread as describing an existing feature being made cheaper — it is not.** No chip/tab count of any kind is rendered on `/admin/bookings` today. This is new construction, not a retrofit of an expensive existing computation.
4. **Series page's caps, which the brief itself flags as already-coordinated (§2.3/§9), are confirmed correct and unchanged at HEAD** — 10 upcoming + 5 past + count-only queries, with a code comment explicitly stating it was built anticipating `PaginationBar`'s absence. Verified no `PaginationBar` component or `src/lib/pagination.ts` exists anywhere in the repo yet.
5. **One overlooked consequence, not in the brief:** the series page's own bounded lists do not protect the page its "View all N visits" link lands on (`/admin/bookings?view=series&templateId=<id>`) — that link re-enters the same unbounded `canViewAll` fetch as the main list (finding under row 5 of the table above). Phase C's fix for the main list's pagination automatically fixes this landing page too, but it's worth Phase C knowing the series page's existing caps were never actually protecting this path.
