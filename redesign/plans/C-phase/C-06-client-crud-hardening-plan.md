# C-06 — Client CRUD hardening + destructive-overwrite fix + privacy honesty fold-in + optional admin-booking email — **PLAN**

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-06-client-crud-hardening-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-06-client-crud-hardening-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

This plan is the "how" — what to build in what order, what to verify at each step, what can go wrong, and how to roll back. The "what + why + UX shape" lives in the brief. Read the brief first, then this.

---

## 0 — Pre-flight (verify before touching code)

Every C-C session for this plan opens with these checks. If any fails, fix or pause before proceeding.

1. **Branch + clean tree.** `git status --short` returns empty. `git rev-parse --abbrev-ref HEAD` returns `redesign/start-state`.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` returns `HTTP/1.1 200 OK`. If not, prompt the user to start `pnpm dev` (do NOT spawn a duplicate).
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing (6 baseline failures preserved per master plan).
4. **Static gates green.** `pnpm lint` 0 errors, `npx tsc --noEmit` 0 errors. (Confirms baseline before any C-06 changes.)
5. **DB introspection.** Confirm via `mcp__supabase__execute_sql`:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='clients' AND column_name='deleted_at'` → returns 0 rows (column not yet added).
   - `SELECT name FROM public.permissions WHERE name IN ('manage_client_identity_fields','manage_client_destructive_ops')` → returns 0 rows.
   - `SELECT pg_get_functiondef('public.create_booking_request'::regproc)` ends with the destructive `on conflict (email) do update` block.
   - **(Step 13 amendment)** `SELECT is_nullable FROM information_schema.columns WHERE table_name='bookings' AND column_name='contact_email'` → returns `NO` (currently NOT NULL; the migration drops it). Confirm `clients.email` is `YES` (nullable) + carries `clients_email_key UNIQUE` (verified 2026-05-26 — tolerates multiple NULLs).
6. **Test fixture inventory.** Confirm the following test rows exist on `/admin/clients` for end-to-end testing (do **not** use Badar's row `9d55ce2a` / `avonrk@hotmail.co.uk` — real data):
   - `Audit Test Client 1..5` (5 rows) — safe to bulk-delete in E2E.
   - `Phase10 E2E Claim Client` — safe to delete via privacy workflow.
   - `Zara Test Client` — safe to edit.
   - Stress-name client `Mohammed Abdulrahman Abdul-Hakim Al-Farsi-Lampungbungkangkang` — safe to edit (verify name field handles the length).
   - Unicode/RTL/emoji bookings (`77f90d24`, `ae9bb5bd`, `eaafbb1a`) — safe to attempt operations against their linked clients to verify the form handles non-ASCII.

If any pre-flight step fails, **stop** and surface to the user before touching code.

---

## 1 — Safe implementation order (13 steps, with verify checkpoints)

Steps 1-11 + the Step 12 migration are the original C-06 body. Step 13 (Phase F — optional admin-booking email) was added in the 2026-05-26 amendment; its DB pieces (the `contact_email DROP NOT NULL` + the RPC's null-email branch) are folded into the Step 12 migration below.

Each step is a self-contained working slice. After each step, the listed verify-checkpoint runs; if it fails, fix before proceeding. Commits are grouped at the bottom (§9) — implementation can land in fewer commits than steps.

### Phase A — Foundation primitives (steps 1-3)

**Step 1 — Extract shared `DuplicateWarningBanner` component.** Pure refactor, no behaviour change.
- New file: `src/app/admin/clients/components/DuplicateWarningBanner.tsx`. Lift the inline `DuplicateWarningBanner` from `ClientCreateForm.tsx:461-504` verbatim. Export named.
- Edit `ClientCreateForm.tsx`: remove the inline component, import from new path.
- Verify: `npx tsc --noEmit` green; `pnpm vitest run` `clients` package green; visit `/admin/clients/new` and trigger a duplicate match → banner still renders identically.

**Step 2 — RBAC + permissions migration draft.** Code-only at this step; migration applies in Step 12.
- Edit `src/lib/auth/rbac.ts`:
  - Add to `PERMISSIONS` const: `MANAGE_CLIENT_IDENTITY_FIELDS: "manage_client_identity_fields"`, `MANAGE_CLIENT_DESTRUCTIVE_OPS: "manage_client_destructive_ops"`.
  - Add helpers: `canManageClientIdentityFields(profile)`, `canManageClientDestructiveOps(profile)`. Both follow the existing `hasPermission` pattern (rbac.ts:393).
- Add a unit test ensuring both helpers return `false` for null + inactive + missing-permission cases, and `true` for granted-permission case. (Pattern from existing rbac tests if present; otherwise mint.)
- Verify: `npx tsc --noEmit` green; new helper tests pass; existing rbac tests still pass.

**Step 3 — Update `clients/types.ts` for `deleted_at`.** Code-only (DB column lands in Step 12 migration).
- Edit `src/app/admin/clients/types.ts`: add `deleted_at: string | null` to `ClientRecord` (or whatever the interface is called) and to any colocated `Booking*` types if bookings get the column too.
- Verify: `npx tsc --noEmit` green. Existing readers of `ClientRecord` (notably `/admin/clients/page.tsx`, `/admin/clients/[clientId]/page.tsx`) compile fine because all reads ignore the new field.

### Phase B — The headline fix (steps 4-5)

**Step 4 — `ManualBookingForm` + booking action plumbing.**
- Edit `src/app/admin/bookings/new/ManualBookingForm.tsx`:
  - Around line 504 (props block), confirm `prefillClient` is already passed in.
  - Around line 510 (state block), no new state needed for `client_id` — it's a hidden input rendered just before the submit row.
  - Add a hidden input near the existing `<input type="hidden" name="enquiry_id">` (look for `enquiryId` plumbing — already there per `bookings/actions.ts:741`). Pattern: `{prefillClient ? <input type="hidden" name="client_id" value={prefillClient.id} /> : null}`.
  - Add `confirmDuplicate` state (`useState<boolean>(false)`) — mirrors `ClientCreateForm.tsx:79`.
  - Add `state.duplicateWarning` handling above step 1's first AdminPanel: `{state.duplicateWarning ? <DuplicateWarningBanner ... /> : null}`. Imported from the shared location (Step 1).
  - Add `name="confirm_duplicate"` checkbox inside the lifted banner (already in the shared component).
  - Submit button: extend the `submitDisabled` logic — `Boolean(state.duplicateWarning) && !confirmDuplicate` blocks submit (pattern from `ClientCreateForm.tsx:136-137`).
- Edit `src/app/admin/bookings/actions.ts` (`createManualBooking` 726-960):
  - Inside the Zod schema (around line 700-724), no schema change — the new fields are not user-validated input.
  - After parsed.success guard, read `client_id` + `confirm_duplicate` from `formData`: `const clientId = String(formData.get("client_id") ?? "").trim() || null; const confirmDuplicate = formData.get("confirm_duplicate") === "on";`
  - Thread both into the `createBookingTransaction` call (line 807-820). Update its input type to accept `clientId?: string | null` + `confirmDuplicate?: boolean`.
  - Wrap the `createBookingTransaction` call in a try/catch that checks for the structured `duplicate_client_exists` exception from the RPC. On match, return `{ duplicateWarning: "<matching client display>" }` instead of throwing. Use the existing `ManualBookingState` shape (extend if needed to include `duplicateWarning`).
- Edit `src/app/api/bookings/createBookingTransaction.ts` (line 113):
  - Update the `supabase.rpc("create_booking_request", { ... })` arg object to include `p_client_id: clientId ?? null` + `p_confirm_duplicate: confirmDuplicate ?? false`.
  - Catch the new RPC error code (PG `errcode = 'P0001'` with `SQLSTATE` matching the structured payload) and re-throw a typed `DuplicateClientError` carrying the matching client info.
- Verify: `npx tsc --noEmit` green. `pnpm vitest run api/bookings/createBookingTransaction` — adjust the existing mock to expect the new RPC args. **Test will fail until Step 11 lands** (RPC change), so mark this expected fail.
- Playwright manual check (post-migration): visit `/admin/clients/[clientId]` for a test client → "Book again" → confirm hidden `client_id` is in the rendered form via `browser_evaluate(() => document.querySelector('[name="client_id"]')?.value)`.

**Step 5 — Booking action error surfaces.**
- Already partially done in Step 4. Confirm:
  - The `ManualBookingState` interface includes `duplicateWarning?: string`.
  - The error path returns the warning string formatted like `ClientCreateForm`'s pattern: `"Sara Mohamed (sara@example.com)"`.
  - The `useActionState` in `ManualBookingForm` already handles a `state.duplicateWarning` field (added in Step 4).
- Verify: lint + tsc green. Manual repro after Step 11 lands.

### Phase C — Edit surface (steps 6-8)

**Step 6 — `updateClient` server action.**
- Edit `src/app/admin/clients/actions.ts` (after the existing `createClient` at line 223):

```ts
export async function updateClient(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  // 1. RBAC: requireClientManager
  // 2. Parse with clientSchema (same as createClient) + add client_id + client_updated_at
  // 3. Optimistic concurrency: SELECT current.updated_at; reject if mismatch
  // 4. Field-level filter: if !canManageClientIdentityFields(actor), strip
  //    full_name + email + gender_preference from patch (defensive — UI already hides)
  // 5. Email-collision check: if email changed AND new email exists on a different
  //    client.id, return { error: "Email already in use by ${other.full_name}. Resolve manually." }
  // 6. UPDATE clients SET ...patch WHERE id = clientId
  // 7. Audit log: action_type='client_updated', before_state=current row,
  //    after_state=changed fields only (diff)
  // 8. Cache invalidation: updateTag("clients") + updateTag("audit") +
  //    revalidatePath("/admin/clients") + revalidatePath(`/admin/clients/${clientId}`)
  // 9. redirect(`/admin/clients/${clientId}?updated=1`) — flash toast on detail
}
```

- Add unit tests `clients/__tests__/updateClient.test.ts`:
  - Owner can change any field → ✓
  - Coord with operational-only permission can change phone/address/notes; identity-field attempts silently dropped → ✓
  - Coord patch containing both operational + identity fields → operational applied, identity dropped, audit log records only what changed → ✓
  - Email collision → returns error, no DB write → ✓
  - Concurrent-edit conflict (mismatched `updated_at`) → returns error → ✓
  - Therapist call → throws `Insufficient permissions` → ✓

**Step 7 — `ClientEditForm` + edit route.**
- New file: `src/app/admin/clients/[clientId]/edit/ClientEditForm.tsx`. Structure cribbed from `ClientCreateForm.tsx`:
  - Three `AdminPanel`s: Who they are / How to reach them / Internal notes.
  - **Adds gender_preference field** in "Who they are" panel — `<select>` with options No preference / Female only / Male only.
  - All fields pre-populated from `client` prop (server-side fetch).
  - Hidden inputs: `client_id` (the path param), `client_updated_at` (optimistic concurrency token).
  - When `!canManageClientIdentityFields`, render full_name + email + gender_preference as `disabled` inputs with helper text per brief §4.1.
  - Sticky save bar pattern lifted from `ClientCreateForm.tsx:422-459`.
  - Cancel button → `/admin/clients/[clientId]`.
- New file: `src/app/admin/clients/[clientId]/edit/page.tsx`. Structure cribbed from `clients/new/page.tsx`:
  - `getStaffProfile()` + RBAC gate (`canManageAllClients`).
  - Server-side fetch the client row via `createSupabaseAdminClient()`.
  - 404 if not found OR `deleted_at IS NOT NULL`.
  - Pass `client` + `canEditIdentityFields` (boolean) into `<ClientEditForm>`.
- Add metadata: `{ title: "Edit Client - Rahma Therapy Admin" }`.
- Verify: navigate to `/admin/clients/[any-test-client]/edit` as Owner → form renders pre-populated. As Coord → form renders but identity fields disabled. As Therapist → AdminAccessDenied.
- Add `__tests__/ClientEditForm.test.tsx` covering: render-with-all-fields-editable, render-with-identity-disabled, submit happy-path, submit with email collision response.

**Step 8 — Edit button on detail page header.**
- Edit `src/app/admin/clients/[clientId]/page.tsx`:
  - Around line 593 (action area), add an `Edit` button before "Book again". Icon: `Pencil` from lucide. Pattern matches `PrintRecordButton` import + render shape.
  - Conditional: only when `canCreateBooking` is true (already computed at line 505 as `canManageAllBookings(profile)` — that gate is equivalent for Owner/Admin/Coord). For Coord-with-operational-only, the button is visible but the destination page handles field-level read-only state.
  - Link: `/admin/clients/[clientId]/edit`.
- Verify: visit detail page as each role → Edit button visibility matches matrix in brief §3.

### Phase D — Delete primitive (steps 9-10)

**Step 9 — `deleteClient` server action.**
- Edit `src/app/admin/clients/actions.ts` (after `updateClient`):

```ts
export async function deleteClient(
  clientId: string,
  reason: "admin_delete" | "gdpr_erasure",
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ success: boolean; alreadyDeleted?: boolean; cascadedBookingCount?: number }> {
  // 1. RBAC enforced at caller — this function is NOT exported as a server action;
  //    it's a helper called by the Delete button action and by the privacy "Completed" handler.
  // 2. SELECT client; if deleted_at IS NOT NULL → return { success: true, alreadyDeleted: true }
  //    after writing an idempotent audit row.
  // 3. UPDATE clients SET deleted_at = now() WHERE id = $1
  // 4. UPDATE bookings SET deleted_at = now(), status = 'cancelled', cancelled_at = now(),
  //    cancellation_reason = 'client_deleted'
  //    WHERE client_id = $1 AND status NOT IN ('cancelled', 'completed')
  //    RETURNING id  -- capture cascadedBookingIds[]
  //    (cancelled_at stamping: S7 coordination 2026-07-16, C-04a amendment — cascaded
  //    cancellations honour the 28-day restore window; moot in practice since the
  //    deleted-client check blocks restore anyway, but keeps the data uniform)
  // 5. DELETE FROM client_notes WHERE client_id = $1 AND is_sensitive = true
  // 6. UPDATE audit_logs SET target_label = '[deleted client]' WHERE target_type = 'clients' AND target_id = $1
  //    (note: target_label may not exist — verify; if absent, skip this step)
  // 7. INSERT INTO audit_logs: action_type='client_deleted', before_state=full client row,
  //    after_state={ deleted_at, reason, cascaded_booking_count, cascaded_booking_ids,
  //    completed_bookings_preserved_count, sensitive_notes_deleted_count }
  // 8. Cache invalidation: updateTag("clients") + updateTag("bookings") + updateTag("audit") +
  //    revalidatePath calls per brief §2.3.
  // 9. Return { success: true, cascadedBookingCount }
}
```

**Then add the public-facing server actions that call it:**

```ts
export async function adminDeleteClient(...): Promise<ClientActionState> {
  // RBAC: requireClientManager + canManageClientDestructiveOps
  // Call deleteClient(clientId, 'admin_delete', adminClient)
  // redirect(`/admin/clients?deleted=1`)
}

export async function bulkDeleteClients(...): Promise<{ deletedCount: number; errors: string[] }> {
  // RBAC: requireClientManager + canManageClientDestructiveOps
  // For each clientId in formData.getAll('client_ids'):
  //   await deleteClient(clientId, 'admin_delete', adminClient)
  //   accumulate errors
  // revalidatePath("/admin/clients")
  // Return summary for the toast on the list page
}
```

- Add unit tests `clients/__tests__/deleteClient.test.ts`:
  - Soft-deletes client + cascades to open bookings + leaves completed alone + hard-deletes sensitive notes → ✓
  - Idempotent on already-deleted client → ✓
  - Audit log row shape matches spec → ✓
  - RBAC: Coord call to `adminDeleteClient` returns `Insufficient permissions` → ✓

**Step 10 — Delete button + bulk-delete on list.**
- New file: `src/app/admin/clients/components/DeleteClientButton.tsx`:
  - Client component, uses `ConfirmActionModal` from `admin-ui-interactions`.
  - Renders icon button `Trash2` + label "Delete".
  - On confirm → calls `adminDeleteClient` server action via `useActionState`.
  - Shown only when `canManageClientDestructiveOps(profile)`.
- Edit `src/app/admin/clients/[clientId]/page.tsx`:
  - Import + render `<DeleteClientButton>` between Edit + "Book again" in action area.
- New file: `src/app/admin/clients/components/BulkDeleteToolbar.tsx`:
  - Client component holding the selection-set state (lifted up from list rows via context or a top-level state managed by list page).
  - Sticky toolbar UI per brief §4.3.
  - Modal opens via `ConfirmActionModal`; passes selected names + count.
- Edit `src/app/admin/clients/page.tsx`:
  - Add checkbox column to each row.
  - Wrap list in a client-component shell that holds selection state.
  - Add "Show deleted (N)" toggle in filter area — drives a `?show_deleted=1` URL param that the server fetch reads.
  - Deleted-row styling: opacity-60 + strikethrough on name (per brief §5.3).
  - Listen for `?deleted=1` URL param post-redirect → show success toast via existing Sonner pattern.
- Edit `src/app/admin/clients/ClientRowMenu.tsx`:
  - Add "Delete client" item between "View audit history" and the existing items, behind a `canManageClientDestructiveOps` check. Same destructive styling as the bulk-delete bar's confirm button.

### Phase E — Privacy wiring (step 11 — code) + Migration (step 12 — DB)

**Step 11 — Privacy "Completed" wiring + JSON export action.**
- Edit `src/app/admin/privacy/actions.ts` (`updatePrivacyRequestStatus` at lines 24-84):
  - After the existing UPDATE on `client_privacy_requests` (line 55-58) and audit log INSERT (lines 64-79), branch on `(parsed.data.status, before.request_type)`:

```ts
if (parsed.data.status === "completed") {
  if (before.request_type === "deletion_review") {
    const result = await deleteClient(before.client_id, "gdpr_erasure", adminClient);
    // result.alreadyDeleted handled — request status update still happened
  } else if (before.request_type === "data_export") {
    // No-op here; the actual download is generated by a separate
    // server action invoked from the form UI before status flips.
    // OR: generate now and stash export URL in the audit log.
  }
}
```

- New file: `src/app/admin/privacy/data-export.ts`:
  - Server action `generateClientDataExport(clientId, adminClient)`:
    - RBAC: `requirePrivacyManager` (existing helper in `clients/actions.ts:71-74` or recreate as colocated).
    - Fetch client + bookings + non-sensitive notes + last 50 audit_log rows for the client.
    - Build JSON blob per brief §2.4 format.
    - Return as a downloadable Response via `Response` with `Content-Disposition: attachment; filename="client-{id}-export-{date}.json"`.
- Edit `src/app/admin/privacy/PrivacyStatusForm.tsx`:
  - Extend props to accept `requestType: string`.
  - Branch the `ConfirmActionModal.description` text per brief §4.4 matrix.
  - For `data_export` completion, add a "Download export now" button INSIDE the modal — when clicked, invokes `generateClientDataExport` via `fetch()` and triggers a browser download. Only THEN does the status flip to Completed (admin confirms via the existing confirm button after the download has been generated).
- Edit `src/app/admin/privacy/page.tsx` (around line 630-631 where `request.request_type` is rendered):
  - Pass `request_type` into the `<PrivacyStatusForm>` instances.

**Step 12 — Migration.** Single SQL file applied via `mcp__supabase__apply_migration` (Zone-2 — confirm with user before invoking). **Includes the Step 13 amendment DDL** (`contact_email DROP NOT NULL` + the RPC's null-email/phone-fallback branch):

```sql
-- C-06 client CRUD hardening — single migration
-- Filename: supabase/migrations/<YYYYMMDDHHMMSS>_c06_client_crud_hardening.sql

BEGIN;

-- 1. Soft-delete columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 1b. (Step 13 amendment) Optional email on the admin booking flow.
--     Permissive: the public flow always supplies a validated email via its own
--     Zod (route.ts), so this only enables the admin no-email path.
ALTER TABLE public.bookings ALTER COLUMN contact_email DROP NOT NULL;

-- 2. New permissions
INSERT INTO public.permissions (name, description)
VALUES
  ('manage_client_identity_fields',
   'Edit identity fields on client records (full_name, email, gender_preference). Required for full /admin/clients/[id]/edit access.'),
  ('manage_client_destructive_ops',
   'Delete and bulk-delete client records via the admin Delete button and bulk-delete toolbar.')
ON CONFLICT (name) DO NOTHING;

-- 3. Grant new permissions to Owner + Admin (NOT Booking Coordinator)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Owner', 'Admin')
  AND p.name IN ('manage_client_identity_fields', 'manage_client_destructive_ops')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. RPC change — make destructive-overwrite impossible
CREATE OR REPLACE FUNCTION public.create_booking_request(
  -- ALL EXISTING POSITIONAL PARAMETERS PRESERVED IN ORDER
  p_service_slugs              text[],
  p_contact_full_name          text,
  p_contact_email              text,
  p_contact_phone              text,
  p_customer_notes             text,
  p_health_notes               text,
  p_consent_acknowledged       boolean,
  p_service_address_line1      text,
  p_service_city               text,
  p_service_postcode           text,
  p_access_notes               text,
  p_booking_date               date,
  p_start_time                 time without time zone,
  p_participant_genders        staff_gender_type[],
  p_participant_display_names  text[] DEFAULT ARRAY[]::text[],
  p_participant_notes          text[] DEFAULT ARRAY[]::text[],
  p_booking_source             text DEFAULT 'website',
  p_participant_service_slugs  text[] DEFAULT NULL,
  p_override_availability      boolean DEFAULT false,
  p_area                       text DEFAULT NULL,
  -- NEW PARAMETERS (appended — backward-compatible)
  p_client_id                  uuid DEFAULT NULL,
  p_confirm_duplicate          boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  -- existing declarations (unchanged)
  -- ...
  v_existing_client_id uuid;
BEGIN
  -- existing validations (service-role gate, name/email/phone, settings,
  -- date bounds, services, gender restrictions, end_time, availability) UNCHANGED
  -- ...

  -- NEW: client resolution
  IF p_client_id IS NOT NULL THEN
    -- Honour explicit client_id. Skip on-conflict logic.
    SELECT id INTO v_client_id FROM public.clients WHERE id = p_client_id AND deleted_at IS NULL;
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Specified client does not exist or has been deleted'
        USING errcode = 'P0002';
    END IF;
  ELSIF v_normalized_email IS NOT NULL AND v_normalized_email <> '' THEN
    -- No explicit client_id, email PRESENT — email is the dedup key.
    SELECT id INTO v_existing_client_id
      FROM public.clients
      WHERE email = v_normalized_email
        AND deleted_at IS NULL
      LIMIT 1;

    IF v_existing_client_id IS NOT NULL AND NOT p_confirm_duplicate THEN
      -- Raise structured exception the server action surfaces as duplicateWarning
      RAISE EXCEPTION 'duplicate_client_exists: %', v_existing_client_id
        USING errcode = 'P0001',
              hint = (SELECT full_name FROM public.clients WHERE id = v_existing_client_id);
    END IF;

    -- Insert or do-nothing (NOT do-update — that was the bug)
    INSERT INTO public.clients (full_name, phone, email, address, postcode, city, area, notes)
    VALUES (
      v_clean_name, v_clean_phone, v_normalized_email,
      trim(p_service_address_line1), trim(p_service_postcode), v_clean_city,
      nullif(trim(coalesce(p_area, '')), ''),
      nullif(trim(coalesce(p_customer_notes, '')), '')
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_client_id;

    -- If on-conflict-do-nothing skipped the insert (and we didn't already have
    -- a confirm_duplicate path), v_client_id is NULL. Resolve to existing.
    IF v_client_id IS NULL THEN
      SELECT id INTO v_client_id
        FROM public.clients
        WHERE email = v_normalized_email
          AND deleted_at IS NULL
        LIMIT 1;
    END IF;

  ELSE
    -- (Step 13 amendment) No explicit client_id, email ABSENT — phone is the dedup key.
    -- Admin flow only; the public flow can never reach here (its Zod requires email).
    SELECT id INTO v_existing_client_id
      FROM public.clients
      WHERE phone = v_clean_phone
        AND deleted_at IS NULL
      LIMIT 1;

    IF v_existing_client_id IS NOT NULL AND NOT p_confirm_duplicate THEN
      -- Same anti-silent-merge exception; matching priority is email-first,
      -- phone-fallback (per user direction 2026-05-26). Admin links or confirms.
      RAISE EXCEPTION 'duplicate_client_exists: %', v_existing_client_id
        USING errcode = 'P0001',
              hint = (SELECT full_name FROM public.clients WHERE id = v_existing_client_id);
    END IF;

    -- Insert a client with NULL email. ON CONFLICT (email) never fires on NULL,
    -- so the insert always proceeds; capture the id directly (re-fetch by email
    -- would not work — NULL never equals NULL).
    INSERT INTO public.clients (full_name, phone, email, address, postcode, city, area, notes)
    VALUES (
      v_clean_name, v_clean_phone, NULL,
      trim(p_service_address_line1), trim(p_service_postcode), v_clean_city,
      nullif(trim(coalesce(p_area, '')), ''),
      nullif(trim(coalesce(p_customer_notes, '')), '')
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- existing INSERT INTO bookings (...) — uses v_client_id.
  -- (Step 13 amendment) bookings.contact_email is now nullable; insert
  -- NULLIF(v_normalized_email, '') so an empty admin email persists as NULL.
  -- existing participant + items + assignments loop UNCHANGED
  -- existing return jsonb UNCHANGED
END;
$function$;

COMMIT;
```

**RPC client-resolution summary (combined Step 1 + Step 13):**

| Branch | Condition | Behaviour |
|---|---|---|
| 1 | `p_client_id` provided | Use that client directly. Email irrelevant. |
| 2 | No client_id, email present | Email is dedup key — collision → `duplicate_client_exists` unless confirm; else insert-or-resolve. |
| 3 | No client_id, email absent | **Phone is dedup key** — phone match → `duplicate_client_exists` unless confirm; else insert client with `email = NULL`. |

`bookings.contact_email` receives `NULLIF(v_normalized_email, '')` so an empty admin email lands as NULL (never `''` — which would matter if a future constraint were added).

- After migration: run `mcp__supabase__generate_typescript_types` to refresh types if any consumer relies on generated types for the new columns.
- Verify post-migration:
  - `SELECT pg_get_functiondef('public.create_booking_request'::regproc)` shows the new body.
  - `SELECT is_nullable FROM information_schema.columns WHERE table_name='bookings' AND column_name='contact_email'` → now `YES`.
  - Re-run `pnpm vitest run api/bookings/createBookingTransaction` — should pass now.
  - Manual Playwright test: visit `/admin/clients/[test-client]` → "Book again" → submit form → confirm RPC honoured `client_id` (existing client's name is NOT overwritten — verify via `mcp__supabase__execute_sql` SELECT pre + post).

### Phase F — Optional admin-booking email (Step 13 — amendment 2026-05-26)

Implements brief §2.5. The DB pieces (12a `DROP NOT NULL` + 12b RPC null-branch) are folded into the Step 12 migration above. Step 13 is the **code** layer: ManualBookingForm UI + Zod + downstream guards + the "No email — reminders off" indicator. Lands after the migration so the DB is ready first (the UI relaxation is harmless without the migration, but submission only succeeds once `contact_email` is nullable).

**Step 13a — `ManualBookingForm` email-optional UI.** Edit `src/app/admin/bookings/new/ManualBookingForm.tsx`:
- `:1037` — drop `required` from the Email `FieldLabel` (remove `*`). Helper text → `"Optional. Used for confirmations and reminders when provided."`
- `:196-198` — relax the contact validator: validate **format only when present**:
  ```ts
  if (vals.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals.email.trim()))
    errs.email = "Email needs an @. For example, sara@example.com.";
  // (no "required" branch)
  ```
- `:914` — relax the Step-1 gate:
  ```ts
  if (step === 1)
    return !!(fullName.trim() && phone.trim() &&
      (!email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())));
  ```
  Phone stays required; email is allowed empty, format-checked only when non-empty.
- `:613` + `:1855` — gate the `sendConfirmationEmail` checkbox on email presence. When `!email.trim()`, hide the checkbox block entirely and force `sendConfirmationEmail = false` (e.g., a derived value or a `useEffect` that resets it when email clears).

**Step 13b — `createManualBooking` Zod relaxation.** Edit `bookings/actions.ts:706`:
```ts
// Before: email: z.email("A valid email is required."),
// After:
email: z.union([z.email("Email needs an @. For example, sara@example.com."), z.literal("")]).default(""),
```
And guard the confirmation-send branch (`:928`): `if (parsed.data.sendConfirmationEmail && parsed.data.details.email.trim())`.

**Step 13c — Downstream null-email guards.**
- `src/lib/email/notifications.ts` — `sendBookingCreatedEmails` (and any per-booking customer send) early-returns when the booking's `contact_email` is null/empty. (Belt-and-braces; the manual-booking call site already gates on the checkbox.)
- `src/app/api/cron/booking-reminders/route.ts` — add `.not("contact_email", "is", null)` (or `AND contact_email IS NOT NULL` in the underlying query) to the reminder-candidate fetch so null-email bookings are never targeted.
- (When C-01 ships) its `review-emails` cron query gains the same `contact_email IS NOT NULL` guard. Flag for the C-01 impl session via a comment; C-01 hasn't shipped yet.

**Step 13d — "No email — reminders off" indicator.** Edit `src/app/admin/bookings/[bookingId]/page.tsx`:
- Where contact details render (near the email/phone block), conditionally render a muted info chip when `booking.contact_email` is null/empty:
  ```tsx
  {!booking.contact_email ? (
    <Link href={booking.client_id ? `/admin/clients/${booking.client_id}/edit` : "#"}
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-panel-muted)] px-2.5 py-1 text-xs text-[var(--admin-text-muted)]">
      <Info className="size-3.5" aria-hidden="true" />
      No email — reminders off
    </Link>
  ) : null}
  ```
- Links to the client edit route (Step 7) when the booking is client-linked, so the admin can add an email in one hop.

**Step 13e — Public-flow isolation (verification only, no code).** `src/app/api/bookings/route.ts` keeps `email: z.email()`. No edit. The verification gate (§3) adds a regression assertion.

**Step 13f — Tests.**
- Update `bookings/new/ManualBookingForm.test.tsx`: Step-1 gate passes with empty email; format error still fires on malformed non-empty; `sendConfirmationEmail` checkbox absent when no email.
- Update `api/bookings/createBookingTransaction.test.ts`: assert RPC called with `p_contact_email: ""` when admin omits email.
- New/updated `createManualBooking` spec: empty email accepted; phone still required; confirmation-send branch skipped when email empty.
- New `api/bookings/route.test.ts` (or extend): missing-email payload → 400 (public-flow isolation).

**Phase F verify checkpoint:**
- Lint + tsc green.
- New + updated tests pass.
- Playwright manual: `/admin/bookings/new` → leave email empty → reach Step 2 → complete flow → booking created with `contact_email IS NULL` (verify via SQL) → no confirmation email row in `email_delivery_events`.
- Public flow: `POST /api/bookings` without email → 400.

---

## 2 — Files touched (final list)

### NEW (10 files)
| File | Purpose |
|---|---|
| `src/app/admin/clients/[clientId]/edit/page.tsx` | Edit route server component |
| `src/app/admin/clients/[clientId]/edit/ClientEditForm.tsx` | Edit form (client component) |
| `src/app/admin/clients/[clientId]/edit/__tests__/ClientEditForm.test.tsx` | RBAC + field-gating coverage |
| `src/app/admin/clients/components/DuplicateWarningBanner.tsx` | Shared component (Step 1 extract) |
| `src/app/admin/clients/components/BulkDeleteToolbar.tsx` | Selection-bar UI for list bulk delete |
| `src/app/admin/clients/components/DeleteClientButton.tsx` | Single-client delete affordance |
| `src/app/admin/clients/__tests__/updateClient.test.ts` | Vitest coverage for `updateClient` |
| `src/app/admin/clients/__tests__/deleteClient.test.ts` | Vitest coverage for `deleteClient` + bulk |
| `src/app/admin/privacy/data-export.ts` | `generateClientDataExport` server action |
| `supabase/migrations/<ts>_c06_client_crud_hardening.sql` | DB migration (Step 12) |

### EDITED (12 files)
| File | Change summary |
|---|---|
| `src/app/admin/clients/actions.ts` | + `updateClient`, `deleteClient` (helper), `adminDeleteClient`, `bulkDeleteClients` |
| `src/app/admin/clients/new/ClientCreateForm.tsx` | Import shared `DuplicateWarningBanner` (no behaviour change) |
| `src/app/admin/clients/[clientId]/page.tsx` | Edit + Delete buttons in header action area; `deleted_at` short-circuit to 404 |
| `src/app/admin/clients/page.tsx` | Checkbox column + selection state + `BulkDeleteToolbar` + "Show deleted (N)" toggle + `?deleted=1` toast |
| `src/app/admin/clients/ClientRowMenu.tsx` | "Delete client" menu item (gated) |
| `src/app/admin/clients/types.ts` | `deleted_at: string \| null` on `ClientRecord` (+ `Booking*` if applicable) |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | Hidden `client_id`, `DuplicateWarningBanner` integration, `confirm_duplicate` checkbox. **(Step 13)** Email optional: drop `required`, format-only validation, relaxed Step-1 gate, `sendConfirmationEmail` checkbox hidden when no email |
| `src/app/admin/bookings/actions.ts` | Thread `client_id` + `confirm_duplicate` through `createManualBooking`; handle `duplicate_client_exists` error. **(Step 13)** `manualBookingSchema.email` → optional; guard confirmation-send branch on non-empty email |
| `src/app/api/bookings/createBookingTransaction.ts` | Pass new RPC args; surface `DuplicateClientError`. **(Step 13)** accept `""` email (passed through to RPC → NULL) |
| `src/app/api/bookings/createBookingTransaction.test.ts` | Update mock args. **(Step 13)** assert empty-email passthrough |
| **(Step 13)** `src/app/admin/bookings/[bookingId]/page.tsx` | "No email — reminders off" muted info chip when `contact_email` is null; links to client edit |
| **(Step 13)** `src/lib/email/notifications.ts` | `sendBookingCreatedEmails` (+ per-booking customer send-fns) early-return on null/empty `contact_email` |
| **(Step 13)** `src/app/api/cron/booking-reminders/route.ts` | Add `contact_email IS NOT NULL` to reminder-candidate query (C-01 review cron gets the same guard when it ships) |
| `src/app/admin/privacy/actions.ts` | Branch `updatePrivacyRequestStatus` on `(status, request_type)`; call `deleteClient` for `deletion_review` |
| `src/app/admin/privacy/PrivacyStatusForm.tsx` | Accept `requestType` prop; branch modal copy; add Download Export button for `data_export` |
| `src/app/admin/privacy/page.tsx` | Pass `request_type` into `<PrivacyStatusForm>` instances |
| `src/lib/auth/rbac.ts` | New PERMISSIONS constants + helpers |
| `src/app/admin/bookings/new/ManualBookingForm.test.tsx` | New specs for duplicate flow + hidden `client_id` plumbing. **(Step 13)** email-optional gate + checkbox-hidden specs |
| **(Step 13)** `src/app/api/bookings/route.test.ts` (new or extend) | Public-flow regression: missing-email payload → 400 (proves isolation) |

### UNCHANGED (Step 13 — explicit non-touch)
- **`src/app/api/bookings/route.ts`** — the public booking flow. Its `bookingRequestSchema.email = z.email()` stays. Email remains required on the public flow. **Verified by the §3 regression test.**
- The public booking form component(s) — separate from `ManualBookingForm`; untouched.

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix migration files, middleware, build configs (RECON §5 untouchables).
- B-1 chart/tile primitives.
- `business_settings` table or any RPC other than `create_booking_request`.
- `client_notes` table schema (only sensitive-notes DELETE in cascade).
- `audit_logs` table schema (action_type is just a text column — new values are code constants).

---

## 3 — Verification gate (commands + pass criteria)

Run after Step 12 lands. Every command must pass before commits go to master plan checklist as ✅.

### 3.1 Static gates

```bash
pnpm lint                       # 0 errors
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; 6 baseline failures preserved (createBookingTransaction × 1 now passes — net 5 baseline failures? VERIFY)
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget per SHARED-NOTES §5
```

**Bundle budget for C-06:** new edit route + 3 new client components + new privacy data-export server action. Estimate +8 kB for the edit route bundle, +3 kB for the bulk-delete components on the list bundle. Plan ceiling: **+15 kB cumulative across `/admin/clients/**`**. If delta exceeds, investigate before committing — likely a re-import of `DuplicateWarningBanner` causing duplication.

### 3.2 Playwright role sweep (4 roles × 4 viewports = 16 walks minimum)

Recipe per role:

1. Sign in via the standard pattern (master plan Part 0). Wait 2-3s.
2. Navigate to `/admin/clients/[test-client-id]` (Audit Test Client 1).
3. Verify Edit button visibility per RBAC matrix in brief §3.
4. Verify Delete button visibility per RBAC matrix.
5. If Edit visible: click → confirm edit form renders pre-populated; for Coord verify identity fields disabled with helper text; submit a phone change → confirm redirect + flash toast.
6. If Delete visible: click → confirm modal copy matches brief §4.2; cancel; verify no DB change.
7. Navigate to `/admin/clients` (list). Verify checkbox column visibility per role; verify "Show deleted (N)" toggle.
8. (Owner + Admin only) Select 2 test clients → confirm sticky toolbar + count copy. Cancel out (no real bulk delete during sweep).
9. Sign out via `fetch('/admin/signout', { method: 'POST', credentials: 'include' })`.

**Mutation tests (Owner + Admin runs only, against test fixtures):**

a. **Destructive-overwrite repro (pre-fix baseline assumption — should fail post-fix):** Visit `/admin/bookings/new` (no prefill). Type an existing test client's email + a wrong name. Submit. **Expected:** duplicate-warning banner appears; submit blocked until confirm-duplicate checkbox ticked.

b. **`?clientId=` plumbing:** Visit `/admin/clients/[Audit Test Client 2]` → "Book again" → confirm hidden `client_id` in form. Submit (no email edit). Re-query `clients` table for that ID — `updated_at` should advance only if any of {name/phone/address/postcode/city/notes} changed, but the values should be the SAME (the booking didn't touch them this time because we use the explicit `client_id` path).

c. **Edit happy path:** Edit `Audit Test Client 3` → change phone → save → confirm redirect + flash. Re-query — phone matches new value, audit_log has `client_updated` row with diff.

d. **Email collision:** Edit `Audit Test Client 4` → change email to `Audit Test Client 5`'s email → submit. **Expected:** hard error banner; no DB change.

e. **Delete cascade:** Delete `Audit Test Client 5` via Delete button → confirm modal → confirm. Re-query: `clients.deleted_at` set, all open `bookings.status='cancelled'` + `deleted_at` set, sensitive `client_notes` rows for that client are GONE (count = 0), `audit_logs` has a `client_deleted` row with the rolled-up cascade summary.

f. **Bulk delete:** Select 2 remaining test clients → bulk delete → confirm. Verify 2 `client_deleted` audit rows + correct cascade summaries.

g. **Privacy `deletion_review` completion:** Pick a remaining client with a `deletion_review` privacy request OR create one via the privacy form. Mark request as Completed via the PrivacyStatusForm. Confirm: status updates, `clients.deleted_at` is set, audit log captures the cascade, modal copy matched the new branched text.

h. **Privacy `data_export` completion:** Pick a remaining client; create a `data_export` request; mark Completed. Confirm: Download Export button triggers JSON download; status flips to Completed; downloaded JSON validates against the schema in brief §2.4.

i. **Coord blocked from destructive ops:** As Coord, attempt `/admin/clients/[id]/edit` → form renders, identity fields disabled. Attempt direct call to `adminDeleteClient` via inspecting the form → action returns "Insufficient permissions."

j. **Therapist blocked:** As Therapist, attempt `/admin/clients/[id]/edit` → AdminAccessDenied. Attempt direct route `/admin/clients` → list visible but limited to assigned clients (existing behaviour); no checkbox column.

**Step 13 mutation tests (Owner + Admin, against test fixtures):**

k. **Admin booking without email — happy path:** `/admin/bookings/new` (no prefill). Fill name + phone + services + location; **leave Email empty**. Confirm Step 1 → Step 2 navigation succeeds. Complete the flow. **Expected:** booking created; `SELECT contact_email FROM bookings WHERE id='<new>'` → `NULL`; no row in `email_delivery_events` for this booking (confirmation checkbox was hidden); booking detail shows "No email — reminders off" chip.

l. **Phone-fallback matching:** `/admin/bookings/new` (no prefill, no email) using a phone that matches an existing test client. Submit. **Expected:** duplicate-warning banner (phone match); tick confirm-duplicate → new NULL-email client created; OR with a fresh phone → new NULL-email client created directly.

m. **Repeat-client (no email) — screenshot scenario:** `/admin/clients/[a client with NULL email]` → "Book again" → email field empty + not required → complete → booking created with `contact_email IS NULL` via the `client_id` path (existing client NOT overwritten).

n. **Email present still works (regression):** `/admin/bookings/new` with a valid email → confirmation checkbox visible + checked by default → booking created with `contact_email` set → confirmation email row appears.

o. **PUBLIC FLOW ISOLATION (critical):** `POST /api/bookings` with a payload **omitting `email`** (via `browser_evaluate` fetch). **Expected:** HTTP 400 with `fieldErrors.email`. Confirms the public flow still requires email and never reaches the RPC's null-email branch. The public booking form UI still marks email required.

### 3.3 Screenshot evidence

Capture PNGs into `redesign/audits/C-A/screenshots-06-clients-new/c-06-after/` (or new directory per C-C convention):

- 375 + 1280: client detail header showing Edit + Delete buttons (Owner)
- 375 + 1280: edit form (Owner) with all fields editable
- 375 + 1280: edit form (Coord) with identity fields disabled
- 375 + 1280: bulk-delete confirm modal
- 375 + 1280: privacy "Completed" confirm modal for `deletion_review` (new copy)
- 375: clients list with checkbox column

### 3.4 Database evidence

Capture pre/post SQL queries into the progress file:

```sql
-- Pre-state: any test client's full row
-- Post-state: same row after every mutation
-- audit_logs entries created during the C-06 verification sweep
SELECT action_type, count(*) FROM audit_logs
WHERE created_at > '<C-06 verification start timestamp>'
GROUP BY action_type;

-- Expected new rows: client_updated, client_deleted, client_privacy_request_status_updated
```

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| RPC change is backward-incompatible with public site booking form | medium | HIGH | New params are appended + defaulted. **Verify** by grep: `git grep create_booking_request -- "*.ts"` returns only `createBookingTransaction.ts:113` + test file. No positional-by-name callers. |
| Migration breaks running dev server cache | low | medium | After `apply_migration`, prompt user to refresh dev server. Run `mcp__supabase__generate_typescript_types`. |
| `target_label` column on audit_logs doesn't exist | low | low | Step 9 anonymisation guarded by IF-EXISTS check. Audit table schema verified during pre-flight (Step 0). |
| Bulk-delete loop hits a row-lock contention | low | low | Loop is serial; one client at a time. Each `deleteClient` is its own implicit transaction. Worst case: partial completion — admin re-runs for remaining selection. |
| JSON export bundle exceeds reasonable size for a client with 100+ bookings | low | low | Cap audit_log to last 50 rows (in brief §2.4). Booking history is unbounded by design (right-of-access). If size becomes an issue later, paginate the export — out of C-06 scope. |
| Soft-deleted client's bookings show up in reports/dashboards | medium | medium | Add `WHERE deleted_at IS NULL` to the reads in `clients/page.tsx`, `bookings/page.tsx`, `reporting.ts`. **`reporting.ts` is RECON §5 untouchable for core exports** — verify which reads need the filter and which are additive. If core reads need it: surface to user; the structural fix may need its own follow-up plan. (**This is a real risk — see Open Q 5.1 below.**) |
| Privacy "Completed" double-deletes if admin clicks twice | low | low | `deleteClient` is idempotent (returns `alreadyDeleted: true` if `deleted_at IS NOT NULL`). |
| Optimistic-concurrency token mismatch creates UX confusion | low | low | Error message is explicit: "This client was updated by someone else. Reload to see the latest." Reload restores the form to current server state. |
| `DuplicateWarningBanner` extraction breaks `ClientCreateForm` styling | low | low | Step 1 is a pure refactor — same JSX, just imported from a new file. Verify with the existing happy-path Playwright case before proceeding. |
| Coord without `manage_client_destructive_ops` can still call `bulkDeleteClients` by crafting a request | low | medium | Server action gates with `canManageClientDestructiveOps(profile)` before any DB write. Belt + braces with the UI hiding. |
| **(Step 13) `DROP NOT NULL` lets the public flow create no-email bookings** | low | HIGH | The constraint relaxation is table-wide, but the public flow's own `route.ts` Zod (`email: z.email()`) is the gate — it rejects missing email at 400 before the RPC. Regression test (o) proves it. The DB constraint was never the public flow's only guard; the Zod is. |
| **(Step 13) Empty-string email stored instead of NULL** → collides on `clients_email_key UNIQUE` second time | medium | medium | RPC inserts `NULL` (not `''`) into `clients.email`; `bookings.contact_email` receives `NULLIF(v_normalized_email,'')`. Vitest + a manual two-no-email-bookings test confirm no unique violation. |
| **(Step 13) Reminder / review cron emails a null address** | low | low | `contact_email IS NOT NULL` guard added to the reminder-candidate query (Step 13c). `sendBookingCreatedEmails` early-returns on null. |
| **(Step 13) Admin confused why no confirmation was offered** | low | low | "No email — reminders off" indicator on the booking detail explains the state + links to the client edit route to add an email. |

### 4.1 Real open risk surfaced in this plan

**The soft-deleted-client read path.** If any read of `clients` or `bookings` doesn't filter `deleted_at IS NULL`, deleted clients still appear in:
- Dashboard tiles
- Reports (revenue / completed bookings — `reporting.ts` is RECON §5 untouchable)
- Calendar
- `/admin/bookings/new` autocomplete
- Booking detail's "client" panel

**Path forward:** during Step 12 verification, run a comprehensive grep:

```bash
git grep -nE "from\(.clients.\)|FROM public\\.clients" -- "src/**/*.ts" "src/**/*.tsx"
```

For each match, decide:
- Does this read fundamentally care if the client is deleted? (Most do — they're showing live data.)
- Add `.is("deleted_at", null)` to the Supabase query.

For `reporting.ts` core exports (read-only utilities): the RECON §5 rule allows additive changes only. Filtering by `deleted_at` is **subtractive** — it would change report values. Surface to the user during C-C: either (a) accept that historical revenue reports include deleted-client bookings (since the booking was real revenue, only the client record was scrubbed for privacy) — **this is the recommended posture for tax compliance**, OR (b) take the additive route and add a new export variant.

This is a real C-C decision point. Document it in the progress file as a deviation if (b) is chosen.

---

## 5 — Undo procedure

If C-06 needs to be rolled back partially or fully during C-C, the order is reverse of implementation:

### 5.1 Undo migration (Step 12)

If the migration is partially-applied or causing issues:

```sql
BEGIN;

-- Reverse the RPC change — restore the destructive-overwrite version
CREATE OR REPLACE FUNCTION public.create_booking_request(...)
-- ... paste the original body captured during pre-flight (see C-06 plan §0 step 5
-- which captured the body via pg_get_functiondef)
$function$;

-- Drop new permissions
DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id FROM public.permissions
  WHERE name IN ('manage_client_identity_fields', 'manage_client_destructive_ops')
);
DELETE FROM public.permissions
WHERE name IN ('manage_client_identity_fields', 'manage_client_destructive_ops');

-- Drop new columns
ALTER TABLE public.clients DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS deleted_at;

-- (Step 13) Restore the NOT NULL on bookings.contact_email.
-- PRE-REQUISITE: no null-email bookings may exist, or the constraint re-add fails.
-- Backfill them first if any were created during the email-optional window:
--   UPDATE public.bookings SET contact_email = '' WHERE contact_email IS NULL;  -- or a sentinel
ALTER TABLE public.bookings ALTER COLUMN contact_email SET NOT NULL;

COMMIT;
```

Caveat: if any rows were soft-deleted before rollback, dropping the column re-exposes them in the UI. **Hard-undeleting first is safer** — run a `UPDATE clients SET deleted_at = NULL` and equivalent for bookings before dropping the column. Data is preserved; rollback is clean.

**(Step 13) Re-adding `contact_email SET NOT NULL` is the one rollback that can FAIL** — if admin no-email bookings were created during the window, the constraint re-add errors until they're backfilled. Backfill to `''` or a sentinel first, OR leave the column nullable (the relaxation is harmless if the UI/Zod revert restores the email-required behaviour for new bookings). **Recommended: leave `contact_email` nullable on rollback** — reverting the UI + Zod is sufficient to restore email-required behaviour; the relaxed column constraint has no downside.

### 5.2 Undo code (Steps 1-11)

Single `git revert <commit-sha>` per implementation commit, in reverse order. Because changes are layered (RPC change in migration is the last to land), the code revert order ideally precedes the DB undo so the codebase doesn't briefly call args that the DB function doesn't accept.

Recommended sequence for full rollback:
1. `git revert <email-optional-code-commit>` (Step 13 — restores email-required UI + Zod; safe to do first, independent of others)
2. `git revert <privacy-wiring-commit>` (Step 11)
3. `git revert <delete-primitive-commit>` (Steps 9-10)
4. `git revert <edit-surface-commit>` (Steps 6-8)
5. `git revert <headline-fix-code-commit>` (Steps 4-5)
6. **Apply DB rollback migration** (§5.1 — leaving `contact_email` nullable per the recommendation)
7. `git revert <foundation-commit>` (Steps 1-3)

If any commits are squashed, the order shifts; the key invariant is: **DB rollback happens after the code that uses the new RPC args is reverted.**

### 5.3 Test data cleanup post-rollback

After rollback, any test-data damage during E2E should be visible in audit_logs (the `client_deleted` rows). Restore deleted test clients manually via:
```sql
UPDATE clients SET deleted_at = NULL WHERE id IN ('<test-client-ids>');
UPDATE bookings SET deleted_at = NULL, status = 'pending' WHERE id IN ('<cascade-cancelled-booking-ids>');
-- (status restoration is judgment — may need to consult the audit log for original status)
```

Real-data damage (e.g., Badar's row accidentally touched) requires manual SQL forensics via `audit_logs.before_state` JSON.

---

## 6 — Test fixture guidance (what to use, what NOT to touch)

**Safe to use for any C-06 E2E walk:**
- `Audit Test Client 1` through `Audit Test Client 5`
- `Phase10 E2E Claim Client`
- `Zara Test Client`
- The unicode/RTL/emoji stress-fixture clients (verify their IDs at pre-flight)

**DO NOT touch:**
- **Badar's row** (`9d55ce2a`, email `avonrk@hotmail.co.uk`) — real cancelled booking. Even restore verification against it during C-04a should not include data mutation here.
- **Owner's own row** if Owner has a `clients` profile (unlikely — Owner is `staff_profiles`, not `clients`).
- Any client whose email matches a real customer pattern (non-`*.example.test`, non-`Phase10`, non-`Audit Test`).

**Pre-deletion verification SQL** (run before any bulk delete):

```sql
SELECT id, full_name, email, created_at
FROM clients
WHERE id IN ('<selected-ids>');
```

Cross-reference against the pre-flight safe-fixture list. If any selected ID isn't on the safe list, **STOP** and surface to the user.

---

## 7 — Commit cadence in C-C (recommendation)

Implementation can land in fewer commits than steps. Recommended cadence:

| Commit | Coverage |
|---|---|
| 1 | Phase A (steps 1-3) — `DuplicateWarningBanner` extract + RBAC helpers + types |
| 2 | Phase B code (steps 4-5) — `ManualBookingForm` + booking action + createBookingTransaction (tests fail until migration) |
| 3 | Phase C (steps 6-8) — `updateClient` + edit route + form + detail page Edit button |
| 4 | Phase D (steps 9-10) — `deleteClient` + bulk-delete UI + detail page Delete button |
| 5 | Phase E code (step 11) — Privacy wiring + JSON export action |
| 6 | Step 12 — migration applied (Zone-2 — explicit confirmation; includes the Step 13 `DROP NOT NULL` + RPC null-branch) + ts types regenerated + tsc/lint/build green |
| 7 | Step 13 (Phase F) — email-optional code: ManualBookingForm UI + Zod + downstream cron/notification guards + "No email — reminders off" indicator + tests (incl. public-flow regression) |
| 8 | (if needed) Soft-delete read-filter sweep per §4.1 |
| 9 | Verification gate — Playwright screenshots + progress file finalised + master plan checklist row → ✅ |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` and stages files explicitly (`git add <path>` — never `git add .`).

Per HANDOFF §11 `feat(redesign): C-NN {step}` is the implementation commit prefix during C-C. For docs/bookkeeping that lands alongside (progress file updates, master plan checklist transitions), use `chore(redesign): {bookkeeping}`.

---

## 8 — Hand-off to C-C

When this plan is picked up for implementation:

1. Read the brief end-to-end.
2. Read this plan end-to-end.
3. Re-read W06 §10 (the architecture is lifted here but the audit's framing is useful context).
4. Run all of §0 (Pre-flight) before any code change.
5. Execute Phase A → Phase B → Phase C → Phase D → Phase E → Phase F (Step 13 email-optional) in order. Don't skip ahead.
6. Migration (Step 12) is Zone-2 — explicit user confirmation before invoking `mcp__supabase__apply_migration`. Show the user the migration SQL first. **It now includes the Step 13 `contact_email DROP NOT NULL` + the RPC's null-email/phone-fallback branch — both land in the single migration.**
7. Verification gate (§3) is non-negotiable.
8. Update `redesign/per-page-progress/C-06-client-crud-hardening-progress.md` as each phase lands.
9. Final commit also updates `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` C-06 row state from `⏳` to `✅` with shipped date + commit SHA.

---

## 9 — Open questions remaining (for plan-reviewer / user)

These are decisions that surfaced during plan-writing and are flagged here rather than in the brief because they're implementation-detail-shaped:

1. **`reporting.ts` read-filter posture for soft-deleted clients** — §4.1 above. Tax-compliance recommended posture is "leave reports unfiltered". Confirm with user during C-C.

2. **`target_label` column existence on `audit_logs`** — pre-flight verification will tell. If absent, the cascade-anonymisation step is dropped from `deleteClient` and a separate plan is needed to add it. Not a C-06 blocker; just a forensic enhancement.

3. **JSON export delivery mechanism** — current plan: server action returns a `Response` with `Content-Disposition: attachment`. Whether this works through Next 16 server actions cleanly needs verification. Fallback: write the JSON to a temporary blob in storage, return a signed download URL. Decided during implementation if the direct approach fails.

4. **Test fixture diversity for Coord-edit verification** — Coord needs at least one client whose operational fields they can change without identity-field interference. The Audit Test Client 1..5 set is generic; create one if needed during the verification sweep.

5. **(Step 13) Phone-fallback matching: link silently or raise duplicate warning?** Locked as **raise the warning** (anti-silent-merge, consistent with the email path). If the repeat-phone case proves too noisy in practice, flip the RPC's phone branch to silent-link — a one-line change. Surface to user if observed.

6. **(Step 13) Booking-level email edit for existing no-email bookings** — out of scope (brief Q9.10). Re-enablement works for FUTURE bookings via the client edit route. Retroactive per-booking email-add is a C-12+ item. Flag if the user wants it.

7. **(Step 13) `NULLIF(v_normalized_email,'')` in the bookings INSERT** — verify the existing RPC body's bookings INSERT references `v_normalized_email` (vs `p_contact_email` directly). If it inserts `p_contact_email` raw, change that site to `NULLIF(p_contact_email,'')` so an empty admin email persists as NULL, not `''`. Confirm during impl by reading the captured original RPC body.

8. **(Step 13) Confirm no other reader assumes `bookings.contact_email` is non-null** — grep `git grep -n "contact_email" src/` and verify each consumer null-safes (notifications, reminders, booking detail, emails delivery log). The "No email — reminders off" indicator + the cron guard cover the known ones; the grep catches strays.

---

*End of C-06 plan. Brief: `redesign/briefs/C-06-client-crud-hardening-brief.md`. Progress: `redesign/per-page-progress/C-06-client-crud-hardening-progress.md` (filled during C-C).*
