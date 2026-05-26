# Audit Log — Filterable Query and Load-More Pagination — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** audit-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `audit`

## What this is
A new server-side query function that accepts `q`, `actor`, `family`, `target_type`, and `range`/`from`/`to` filter params, plus a `auditLoadMore` server action that returns the next cursor page of matching rows.

## Why it's needed
The current `/admin/audit` page reads a flat, unfiltered top-100 list from a repository helper. The redesigned page (§5) replaces this with a filtered, paginated timeline. The filter strip IS the redesigned audit surface; shipping a redesigned page that is still an unfiltered top-100 dump would be embarrassing.

## What it does (user story)
"As an Owner investigating an incident, I want to filter the audit timeline by actor, action family, target type, and date range, and load more than 100 rows when needed, so I can find the specific event in seconds."

## What information it stores or retrieves
Reads from `audit_logs` joined with `staff_profiles` (for actor display name). Accepts filter parameters: `q` (UUID prefix match on `target_id`, `actor_staff_id`, `id`; minimum 4 chars), `actor` (exact match on `actor_staff_id`), `family` (mapped from the 8-family taxonomy to a list of matching `action_type` values), `target_type` (exact match), `range`/`from`/`to` (date range on `created_at`). Returns rows ordered `created_at DESC`, paginated with a cursor (the `id` of the last row returned).

## Who can use it
Only called from `/admin/audit` which is gated on `manage_audit_logs` (Owner only). Permission is enforced at the page level; the query function itself need not re-check.

## What can go wrong
- **UUID prefix search returns too many results:** a 4-character prefix on `audit_logs.id` could match thousands of rows. Enforce the 4-character minimum client-side (reject shorter queries before submission) and add a result-count cap (e.g. 500) server-side.
- **Family filter maps to an empty action-type list:** if an unrecognised family key is passed, the query should return all rows (treat unknown family as "all actions") rather than returning zero rows.
- **Date range `from` after `to`:** the server should swap the values silently or return an empty result set rather than a DB error.
- **Load-more cursor points to a deleted row:** if a row was deleted between page loads, the cursor-based query should continue from the nearest surviving row rather than throwing.
- **Actor filter UUID is malformed:** if the `actor` param is not a valid UUID, the query should treat it as "anyone" (ignore the filter) rather than throwing a Postgres invalid-UUID error. Validate UUID format before passing to Supabase.
- **DB query timeout on large date ranges:** a `lifetime` range query with no other filters can scan millions of rows. Add an index hint or a server-side date-range cap if query time exceeds 5s.

## How to verify it works
1. Apply `family=bookings` filter — only rows with action types in the "Bookings & assignments" family return.
2. Enter a 4-character UUID prefix in the search box — only rows with matching `target_id`, `actor_staff_id`, or `id` return.
3. Apply `range=today` — only rows with `created_at >= start of today UTC` return. Verify with a row created yesterday that it is absent.

## Safe implementation order
1. Write the new query function in a new file (e.g., `src/app/admin/audit/queries.ts`) accepting the filter params and returning typed rows. Start with just date-range filtering.
2. Add `actor` and `target_type` filters.
3. Add `family` → action-type expansion using the 8-family taxonomy helper.
4. Add UUID prefix search on `q`.
5. Implement cursor-based pagination: accept `cursor?: string`, add `WHERE id < cursor` to the query, return `{ rows, nextCursor }`.
6. Write the `auditLoadMore` server action in `src/app/admin/audit/actions.ts` that calls the query function with a cursor.
7. Wire the query into `page.tsx` and wire `auditLoadMore` into `AuditLoadMoreButton.tsx`.

## How to undo it if something breaks
All changes are additive. The new query function is called only from the redesigned `page.tsx`. Reverting `page.tsx` to the previous implementation restores the original unfiltered top-100 behaviour. No schema changes.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
