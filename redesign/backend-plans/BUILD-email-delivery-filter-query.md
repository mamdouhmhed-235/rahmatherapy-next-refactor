# Email Delivery — Filterable Events Query — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** emails-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `emails`

## What this is
A new server-side query for the Delivery tab of `/admin/emails` that accepts `event_type`, `delivery_status`, `recipient_role`, date-range (`from`/`to`), and `q` (free-text on recipient email or provider message ID prefix) filter params, plus cursor-based Load-more pagination replacing the current hard `limit(100)`.

## Why it's needed
The emails brief (§4, §5) replaces the current flat `limit(100)` unfiltered event list with a filterable, paginated Delivery tab. Operators primarily open this tab to confirm a specific email landed or to investigate failures. Without filters, there is no quick path from "client says they didn't get the reminder" to the relevant event row.

## What it does (user story)
"As an Admin, I want to filter the delivery log to 'failed' events from the last 7 days for a specific recipient, so I can quickly confirm which emails bounced and decide whether to resend."

## What information it stores or retrieves
Reads from `email_delivery_events` (joined with `bookings` for recipient context where needed). Accepts: `event_type` (multi-select from the 9 known template event types in `templates.ts`), `delivery_status` (accepted / delivered / opened / clicked / bounced / failed / complained), `recipient_role` (customer / staff / admin — hidden from Coordinator), `from`/`to` (date range on `sent_at`), `q` (prefix match on `recipient_email` or `provider_message_id`). Returns events ordered `sent_at DESC`, 50 at a time, with a cursor for Load-more.

## Who can use it
Called from `/admin/emails` Delivery tab. Page-level gate: `canViewEmailLogs` (Owner, Admin/PM, and Coordinator-with-both-permissions). Coordinator-with-resend-only never sees the Delivery tab.

## What can go wrong
- **`recipient_role = 'admin'` events visible to Coordinator:** the query must filter out `recipient_role = 'admin'` events for any caller without `view_email_logs` full scope. Pass the caller's permission set into the query function.
- **`q` search on `provider_message_id` is case-sensitive:** Resend provider IDs are lowercase; enforce lowercase normalization on the input before querying.
- **Empty `event_type` multi-select treated as "no filter":** if the caller submits an empty `event_type[]`, return all types. If they submit an unrecognised type value, ignore it silently (do not throw).
- **DB query slow on large `email_delivery_events`:** add a composite index on `(sent_at DESC, delivery_status)` if the table is large. Confirm in dev that the filtered query returns in under 300ms.
- **Cursor pagination skips rows if events are inserted between pages:** cursor is based on `id` (stable UUID) rather than `sent_at` (could have ties). Use `WHERE id < cursor` to avoid skipped rows.

## How to verify it works
1. Apply `delivery_status=failed` filter — only rows with that status return.
2. Apply `recipient_role=admin` filter as Admin/PM — admin-recipient rows return. Apply same filter as Coordinator-with-both — admin rows are absent.
3. Click "Load more" — next 50 rows append without losing scroll position or duplicating rows.

## Safe implementation order
1. Write `src/app/admin/emails/queries.ts` with a `getDeliveryEvents(filters, cursor)` function. Start with date-range and delivery_status filters only.
2. Add event_type multi-select and recipient_role filters.
3. Add `q` prefix search on recipient_email.
4. Add cursor pagination.
5. Write the `emailDeliveryLoadMore` server action that calls `getDeliveryEvents` with a cursor.
6. Wire into the Delivery tab in `page.tsx` and the Load-more button client component.

## How to undo it if something breaks
Additive query function and server action. Reverting `page.tsx` to the previous unfiltered `limit(100)` query restores old behaviour. No schema changes.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
