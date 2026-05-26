# Privacy — Status-Grouped Filter Query — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** privacy-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `privacy`

## What this is
A new server-side query for `/admin/privacy` that returns privacy requests grouped into four status buckets (Received/Reviewing/Completed/Declined) with per-bucket counts, and accepts `request_type`, `status`, `from`/`to`, and `q` filter params.

## Why it's needed
The privacy brief (§5) replaces the current flat two-column layout with four status-grouped panels. The four-panel structure requires the server to split data by status and provide per-panel counts. Without this grouping query, the panels can't render correct content or counts, and the stat tiles (§5) can't show "Open requests: N".

## What it does (user story)
"As an Owner reviewing privacy requests, I want to see Received and Reviewing requests expanded at the top, and Completed and Declined collapsed below, so I can immediately triage the open queue without scrolling past closed history."

## What information it stores or retrieves
Reads from `privacy_requests` (or `client_privacy_requests` — verify actual table name in schema) joined with `clients` (for client name) and conditionally with `staff_profiles` (for `canViewClientContactDetails` gating). Returns four result sets, one per status: `{ received: [...], reviewing: [...], completed: [...], declined: [...] }` plus counts per bucket. Also returns the three stat-tile values: `openCount` (received + reviewing), `oldestOpenDays` (age of oldest received row), `sensitiveReviewedThisMonthCount` (count of `client_notes` where `is_sensitive=true` and `created_at` within current month). Accepts: `request_type` (multi-select: data_export/correction/deletion_review/sensitive_note_review), `status` (multi-select for filter override), `from`/`to` (date range on `created_at`), `q` (ILIKE on request_note).

Contact-detail lines (email, phone) only included when `canViewClientContactDetails` is true for the calling profile.

## Who can use it
Gate: `manage_privacy_operations` OR `canManageSensitiveClientNotes`. Admin/PM sub-variants (privacy-only / notes-only / both) affect which data is returned — handled server-side.

## What can go wrong
- **`sensitive_note_review_count` fires a separate aggregate query:** keep it as a single extra COUNT query; do not load and count all 25 notes client-side.
- **Contact details leaking for profiles without `canViewClientContactDetails`:** the query must strip email and phone columns when this permission is absent. Never rely on the frontend to hide them.
- **`from`/`to` filter applied to the Received panel but not the stat tiles:** the stat tiles should always show current totals regardless of active filters. Keep stat-tile queries separate from the filtered panel queries.
- **Unknown `request_type` value:** treat as "all types" (ignore unknown values).
- **Privacy request table name mismatch:** RECON §6.1 lists `createClientPrivacyRequest` which writes to an unknown table name. Verify the actual table name in `supabase/migrations/**` before writing the query.

## How to verify it works
1. Create one privacy request of each status type → all four panels render with correct counts.
2. Apply `request_type=data_export` filter → only data-export requests appear across all four panels.
3. Sign in as a profile without `canViewClientContactDetails` → contact detail line is absent from all rows (not just hidden via CSS — absent from the HTML source).
4. Stat tile "Open requests" shows the sum of Received + Reviewing counts.

## Safe implementation order
1. Verify the actual privacy requests table name in `supabase/migrations/**`.
2. Write `src/app/admin/privacy/queries.ts` with `getPrivacyRequests(filters, callerPermissions)` returning the four status buckets and basic counts (no stat tiles yet).
3. Add stat-tile queries (`openCount`, `oldestOpenDays`, `sensitiveReviewedThisMonth`).
4. Add `request_type`, `status`, `from`/`to`, `q` filter application.
5. Add contact-detail permission gating.
6. Wire into `page.tsx`.

## How to undo it if something breaks
Additive query function. Reverting `page.tsx` to the previous flat two-column render restores old behaviour. No schema changes.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
