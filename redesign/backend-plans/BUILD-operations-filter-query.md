# Operations — Filterable Events Query with Pagination — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** operations-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `operations`

## What this is
A new server-side query for `/admin/operations` that accepts `severity`, `event_type`, `status`, `from`/`to`, and `q` filter params, returns events grouped by status column (Open/Acknowledged/Resolved), and supports cursor-based Load-more pagination per column replacing the hard `limit(100)`.

## Why it's needed
The operations brief (§5) replaces the current single-panel article dump with a three-column status board filtered by severity, event_type, and date range. The three-column layout requires the data to be split by `status`. The severity summary stat tiles (§5) require aggregate counts. Without these query capabilities the three-column layout is impossible to render.

## What it does (user story)
"As an Owner triaging operational events, I want to see only 'error' severity Open events so I can fix the critical ones first without wading through info-level noise."

## What information it stores or retrieves
Reads from `operational_events`. Accepts: `severity` (multi-select: info/warning/error), `event_type` (multi-select from distinct values), `status` (used by the mobile tab strip to filter to one column), `from`/`to` (date range on `created_at`), `q` (prefix match on `summary`). Returns three parallel result sets (Open, Acknowledged, Resolved) each with up to 50 rows and a cursor, plus three aggregate counts for the severity stat tiles (Open errors / Open warnings / Open info).

For Admin/PM scope: filter out `event_type` values flagged as owner-only (server-side, silent omission, no greyed-out rows).

## Who can use it
Gate: `manage_settings` OR `manage_email_settings`. Owner sees all events; Admin/PM sees email-delivery and booking-engine events only (server-side scope filter).

## What can go wrong
- **Three parallel queries per page load:** the three-column layout fires three separate queries (one per status). On a slow connection this serialises. Use `Promise.all` to parallelise them.
- **Admin/PM scope filter leaks owner-only events:** the server query must filter `event_type NOT IN (ownerOnlyTypes)` for non-Owner callers. Hardcode the ownerOnlyTypes list rather than querying for it.
- **Bulk resolve fires N sequential server-action calls:** the brief (§7) sequences individual `updateOperationalEventStatus` calls rather than a batch update. This is safe for audit-log ordering but can be slow for large Open queues. Accept this for now; flag for Phase 7 if queue size grows.
- **Cursor pagination across status columns becoming stale:** if a row is resolved between page loads, it moves from Open to Resolved. The Open cursor correctly skips it on the next Load-more (since the row no longer matches `status = 'open'`). No special handling needed.
- **Severity filter returns 0 results:** return an empty list (no error). The three-column empty states handle this.

## How to verify it works
1. Apply `severity=error` filter — only error-severity rows appear in all three columns.
2. Stat tiles show correct counts: "Open errors: 3" matches the count of `status=open AND severity=error` rows in the DB.
3. Load-more on the Open column appends 50 more rows without duplicating existing ones.
4. Sign in as Admin/PM — owner-scope-only event types are absent from the event_type filter select and from row data.

## Safe implementation order
1. Write `src/app/admin/operations/queries.ts` with `getOperationalEvents(filters)` returning `{ open, acknowledged, resolved, statCounts }`. Start with status split only (no filters).
2. Add severity, event_type, date-range, and q filters.
3. Add Admin/PM scope filter (ownerOnlyTypes exclusion).
4. Add cursor pagination for each status column.
5. Write three `loadMore{Open|Acknowledged|Resolved}Events` server actions.
6. Wire into `page.tsx` and the Load-more button client components.

## How to undo it if something breaks
Additive query function and server actions. Reverting `page.tsx` to the previous single-panel `limit(100)` query restores old behaviour. No schema changes.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
