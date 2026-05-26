# Clients — Sort by Last Visit Query — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** clients-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `clients`

## What this is
A new sort option (`?sort=last_visit`) for the `/admin/clients` page that orders the client list by most-recent booking date descending, achieved via a JOIN between `clients` and `bookings`.

## Why it's needed
The clients brief (§5, §7) adds a "Name A–Z / Last visit" sort toggle to the filter bar. Coordinators and Owners frequently want to identify recently-served clients for rebook outreach. Without this, the sort toggle is non-functional and the redesign would ship a broken control.

## What it does (user story)
"As an Owner or Coordinator, I want to sort the client list by most-recent visit so that clients who haven't been in for a while surface near the bottom and I can prioritise rebook outreach."

## What information it stores or retrieves
Reads from `clients` LEFT JOINed with `bookings` on `bookings.client_id = clients.id`, grouping by `clients.id` and ordering by `MAX(bookings.booking_date) DESC NULLS LAST` (clients with no bookings sort to the end). Applies all existing filter params (`q`, `lifecycle`, `payment`, `location`, `source`) before sorting.

## Who can use it
Any role with client-scope access (Owner, Admin/PM, Coordinator). Gated at the page level by the existing `clients scope` check. The query function respects the same scope.

## What can go wrong
- **N+1 JOIN performance on large datasets:** with thousands of clients and tens of thousands of bookings, `MAX(booking_date)` GROUP BY can be slow without an index. Confirm a `bookings(client_id, booking_date)` composite index exists; if not, add it.
- **Null last visit breaking sort order:** clients with no bookings should sort after all clients with at least one booking (`NULLS LAST`). Without explicit `NULLS LAST`, Postgres defaults to `NULLS FIRST` for DESC sorts, which would put new clients at the top of a "last visit" sort — incorrect.
- **Sort param injection:** only `name` and `last_visit` are valid sort values. Any other value should fall back to `name` (alphabetical) silently — never pass raw param values into an ORDER BY clause.
- **Pagination interaction:** if the clients list grows large enough to need pagination, cursor-based pagination on `last_visit` (a derived value) is complex. For now, full list returned; revisit if > 500 clients.

## How to verify it works
1. Apply `?sort=last_visit` — client with a booking from yesterday appears before client with a booking from 6 months ago.
2. Client with no bookings appears at the bottom of the `last_visit` sort, not the top.
3. Apply `?sort=name` — alphabetical order restored, clients with no bookings sort normally with first letter.

## Safe implementation order
1. Confirm or add a `bookings(client_id, booking_date)` index in the database.
2. Write the modified query in `src/app/admin/clients/page.tsx` (or a colocated query helper): if `sort === 'last_visit'`, use the JOIN + GROUP BY + MAX pattern; otherwise use the existing alphabetical query.
3. Validate the `sort` param server-side (allowlist: `['name', 'last_visit']`; default `name`).
4. Wire the sort toggle UI component — the existing page already has `?sort=` in the URL contract added by this brief; the query just needs to consume it.

## How to undo it if something breaks
The sort-param branch is additive. Remove the `sort === 'last_visit'` branch; the query falls back to alphabetical. No schema changes unless the index was added — an index can be dropped without data loss.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
