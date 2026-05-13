# Enquiries — Tab-Based Filter Query — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** enquiries-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `enquiries`

## What this is
A new server-side query for `/admin/enquiries` that accepts a `tab` param (all/new/contacted/converted/closed) plus `source`, `assigned_staff`, `from`/`to`, and `q` filter params, replacing the current unfiltered flat list.

## Why it's needed
The enquiries brief (§5, §7) replaces the current flat unfiltered two-column layout with a tab-based lead pipeline. Each tab represents a distinct filtered query: "new" → `status = 'new'`, "converted" → `converted_booking_id IS NOT NULL`, etc. The tab-based triage IS the redesign; without these queries, the five-tab strip shows the same full list in every tab.

## What it does (user story)
"As a Booking Coordinator, I want to see only my 'New' enquiries in one tab so I can work through the uncontacted leads without the contacted and converted ones cluttering the view."

## What information it stores or retrieves
Reads from `enquiries` joined with `staff_profiles` (for `assigned_staff` display). Tab-to-filter mapping:
- `all` → no status filter
- `new` → `status = 'new'`
- `contacted` → `status = 'contacted'`
- `converted` → `converted_booking_id IS NOT NULL`
- `closed` → `status = 'closed'`

Additional filters: `source` (exact match on `enquiries.source`), `assigned_staff` (exact match on `assigned_staff_id`), `from`/`to` (range on `created_at`), `q` (ILIKE on `full_name`, `phone`, `email`).

Returns enquiries ordered `created_at DESC`. Also returns a `newCount` (count where `status = 'new'`) for the badge on the "New" tab.

## Who can use it
Called from `/admin/enquiries`. Gate: `canManageEnquiries` (Owner, Admin/PM, Coordinator). Therapist is denied at page level.

## What can go wrong
- **`converted` tab uses `converted_booking_id IS NOT NULL` not a `status` value:** this is a derived query, not a simple status match. Confirm the `enquiries` table has a `converted_booking_id` column (nullable FK to `bookings`). If absent, the converted tab can't work.
- **`newCount` fires an extra query per page load:** cache the count alongside the main query in a single Supabase call using `count: 'exact'` in a separate filter, or compute it client-side from the total count result.
- **`q` search too broad on large enquiry lists:** limit to ILIKE prefix match (`q%`) rather than substring match (`%q%`) to use indexes.
- **Unknown `tab` param value:** default to `all`. Never pass the raw param value to a WHERE clause.

## How to verify it works
1. Navigate to `?tab=new` — only enquiries with `status = 'new'` render.
2. Navigate to `?tab=converted` — only enquiries with a non-null `converted_booking_id` render.
3. Apply `?source=whatsapp&tab=new` — only new WhatsApp enquiries render.
4. The "New" tab badge shows the correct count even when viewing a different tab.

## Safe implementation order
1. Verify `enquiries` table has a `converted_booking_id` column in Supabase Studio.
2. Write `src/app/admin/enquiries/queries.ts` with `getEnquiries(tab, filters)`. Implement `all` and `new` tabs first.
3. Add `contacted`, `closed`, and `converted` tab variants.
4. Add `source`, `assigned_staff`, `from`/`to`, `q` filter application.
5. Add `newCount` return value.
6. Wire into `page.tsx` to replace the current unfiltered query.

## How to undo it if something breaks
Additive query function. Reverting `page.tsx` to the previous unfiltered query restores old behaviour. No schema changes.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
