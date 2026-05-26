# Audit Log — Target-Existence Batch Lookup — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** audit-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `audit`

## What this is
A server-side batch lookup that, given a list of `(target_type, target_id)` pairs from a page of audit rows, returns which target rows still exist in their respective tables so the UI can render a "Open booking / Open client / …" Ghost link or a "Target row no longer exists." Soft Slate line.

## Why it's needed
The audit-page row composition (§5) shows a conditional Ghost link "Open booking / Open client / Open staff / Open role / Open services" — but only when the target row still exists. Without a server-side check the UI must either always show the link (risking a 404 on click) or never show it (losing the helpful cross-link). A single batch query prevents 100 individual round-trips.

## What it does (user story)
"As an Owner reviewing the audit timeline, I want to jump directly to the booking or client that was changed, but only when that record still exists, so I don't follow broken links."

## What information it stores or retrieves
Reads from: `bookings` (id), `clients` (id), `staff_profiles` (id), `roles` (id). For each `(target_type, target_id)` pair in a page of audit rows, executes one query per target type: `SELECT id FROM {table} WHERE id = ANY(array_of_ids)`. Returns a `Set<string>` of IDs that exist.

The five supported target types: `booking`, `client`, `staff`, `role`, `service`. Other target types (e.g. `business_settings`) render no link regardless of existence.

## Who can use it
Called server-side from `page.tsx` during the initial page render and from `auditLoadMore` for each subsequent page. No RBAC check at this level — gating is at the page level (`manage_audit_logs`).

## What can go wrong
- **Empty input array:** if a page has zero rows (unlikely but handled), the batch query should short-circuit and return an empty set without hitting the DB.
- **Unknown target_type:** silently treated as "does not exist"; no link rendered.
- **Deleted table (future schema change):** if a `target_type` references a table that was renamed or dropped, the query throws. Guard with a static allowlist of supported types.
- **Large batch causing slow query:** a 100-row page could include 100 distinct target IDs. `IN (…)` with 100 UUIDs is fast with a PK index; this is safe.

## How to verify it works
1. Load the audit page with a mix of rows: some whose bookings exist, some whose bookings were deleted. Confirm "Open booking" appears only for existing rows.
2. Delete a booking in Supabase Studio, reload the audit page — the previously-existing link becomes "Target row no longer exists."
3. Confirm the batch lookup fires exactly 1-5 queries per page load (one per distinct target type present), not one per row.

## Safe implementation order
1. Write `src/app/admin/audit/target-existence.ts` with a function `batchCheckTargetExistence(pairs: Array<{type, id}>): Promise<Set<string>>`.
2. Implement the `booking` type first (most common in the audit log). Test with a known existing and known deleted booking.
3. Add `client`, `staff`, `role`, `service` types.
4. Wire into `page.tsx` render and into `auditLoadMore` return value.

## How to undo it if something breaks
Additive helper function. To undo: remove the call from `page.tsx` / `auditLoadMore` and render no "Open target" link for any row. Zero data risk.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
