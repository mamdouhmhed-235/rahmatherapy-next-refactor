# C-06 — Client CRUD hardening + destructive-overwrite fix + privacy honesty fold-in

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q5/Q6/Q2 + §3 C-06 (locked scope)
- `redesign/audits/C-A/W06-client-create-and-first-booking-flow.md` §10 (architecture, lift verbatim)
- `redesign/audits/C-A/W02-new-booking-end-to-end-flow.md` §1+§2 (3 prefill paths)
- `redesign/audits/C-A/06-clients-new-audit.md` (DuplicateWarningBanner pattern)
- `redesign/audits/C-A/07-client-detail-audit.md` (B-34 edit gap)
- `redesign/audits/C-A/22-privacy-audit.md` (B-87/B-88 honesty fix)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md`
- Progress: `redesign/per-page-progress/C-06-client-crud-hardening-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-06 is the largest Band C plan alongside C-02, and the only one carrying a **HIGH-severity data-integrity headline**. It does five jobs at once:

1. **Stops `create_booking_request` from silently overwriting client rows** on email conflict (B-110 + B-131 — the single biggest data-hygiene risk surfaced by C-A).
2. **Adds the missing client-edit surface** (`/admin/clients/[clientId]/edit`) so admins can correct a typo without going through a destructive workaround (B-34).
3. **Adds soft-delete + bulk-delete** via one shared `deleteClient` primitive, behind a confirmation modal.
4. **Wires the privacy workflow to actually do something** when an admin clicks "Completed" on a `deletion_review` or `data_export` request (B-87 + B-88 — currently a UI lie).
5. **Lifts the existing `DuplicateWarningBanner` pattern** from `/admin/clients/new` into `ManualBookingForm` so the booking form's client-handling matches the create-client form (B-132 asymmetry).

Net effect: the four entry points that today can corrupt client data (`/admin/bookings/new` no-prefill, `?enquiryId=`, `?clientId=`, and silent privacy completion) become safe, consistent, and audited.

---

## 1 — Why this plan exists (the problem, in three layers)

### 1.1 The destructive-overwrite bug (B-110 + B-131)

`create_booking_request` (Postgres RPC) currently ends with:

```sql
insert into public.clients (full_name, phone, email, address, postcode, city, area, notes)
values (...)
on conflict (email) do update
  set full_name = excluded.full_name,
      phone     = excluded.phone,
      address   = excluded.address,
      postcode  = excluded.postcode,
      city      = excluded.city,
      area      = coalesce(excluded.area, clients.area),
      notes     = coalesce(excluded.notes, clients.notes),
      updated_at = now()
returning id into v_client_id;
```

W02 §3 + W06 §10 catalogue the consequences. Three prefill paths converge on this clause:

| # | Source | Concrete failure |
|---|---|---|
| (a) | No prefill (typed-in details on `/admin/bookings/new`) | New booking for `sara@example.com` typed as "Sarah Mohammed" (typo) silently rewrites the existing `Sara Mohamed` row. Original spelling, phone, address are gone. No audit row covers the client mutation. |
| (b) | `?enquiryId=` prefill | Same as (a) — the enquiry-prefilled email collides with an existing client; client row overwritten. |
| (c) | `?clientId=` prefill | The form **never sends the prefilled client.id** through; the SQL still matches by email. If admin fixes a typo in the email (`sara@gmial.com` → `sara@gmail.com`), the SQL no longer matches, creates a brand-new client row, and **orphans the original**. The "Book again" intent is lost; original client's booking history will never reflect the new visit. |

No row in `audit_logs` records the client mutation — the booking-creation audit row only logs `manual_admin_booking_created` (target: bookings). The destructive overwrite is invisible to forensics.

### 1.2 The missing edit surface (B-34)

`/admin/clients/[clientId]` is read-only for client identity fields. A typo in a phone number or email today is uncorrectable from the admin tree — you'd have to either (a) make a SQL-level update or (b) trigger the destructive overwrite bug above by creating another booking. Both are unacceptable. There is no `/admin/clients/[clientId]/edit` route.

### 1.3 The privacy "UI lie" (B-87 + B-88)

`/admin/privacy` shows GDPR request rows and lets the privacy manager set status to Completed. The current copy on the confirm modal reads:

> "Confirm you've reviewed booking and audit-log integrity before finalising deletion or anonymisation. The customer will get a confirmation email."

`updatePrivacyRequestStatus` (`privacy/actions.ts:24-84`) does **none** of that — it updates the `status` column and writes an audit row. The client + bookings + notes stay. No email goes out. No export is generated. **The button lies.**

C-B-DECISIONS Q2 locked the response: defer the dedicated compliance sprint, but **fold the honesty fix into C-06** by wiring the "Completed" handler to call `deleteClient(reason='gdpr_erasure')` (for `deletion_review` type) or run a minimal JSON export server action (for `data_export` type).

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-06)

C-06 ships 11 steps. Order is finalised in the plan; the brief lists them by topic.

### 2.1 The headline fix — `create_booking_request` + `ManualBookingForm`

**Step 1 — RPC change.** Modify `public.create_booking_request` to:
- Add new parameter `p_client_id uuid DEFAULT NULL`.
- If `p_client_id` is provided + valid → `SELECT FROM clients WHERE id = p_client_id` → use that row directly. Skip the `on conflict` block entirely. (Honours explicit "this is the client" intent from `?clientId=` prefill.)
- If `p_client_id` is NOT provided → check for matches by `(email)` first; if matches exist, **`raise exception 'duplicate_client_exists'` with a structured error payload** the server action can surface as a duplicate-warning response. Replace `on conflict (email) do update` → `on conflict (email) do nothing` so a race-condition-leftover doesn't silently merge either.
- Add `p_confirm_duplicate boolean DEFAULT false` parameter so admin-acknowledged dup creation can bypass the new exception (mirrors the `confirm_duplicate` checkbox in `ClientCreateForm`).

**Step 2 — `ManualBookingForm` updates.** In `src/app/admin/bookings/new/ManualBookingForm.tsx`:
- Hidden `<input name="client_id" />` populated when `prefillClient` is non-null. Value: `prefillClient.id`.
- Add `state.duplicateWarning` handling identical to `ClientCreateForm.tsx:246-252`. Render the existing `DuplicateWarningBanner` component (lifted into a shared location — see Files Touched).
- `confirm_duplicate` checkbox + state, same shape as create-client form.
- Server-action signature in `bookings/actions.ts` (`createManualBooking` + downstream `createBookingTransaction`) updated to thread `client_id` + `confirm_duplicate` to the RPC.

**Step 3 — Booking action error handling.** When the RPC raises `duplicate_client_exists`, surface it as `{ duplicateWarning: "<matching client display>" }` on the `ManualBookingState` return type. Don't fall through to a generic "Couldn't create booking" toast.

### 2.2 The edit surface — `/admin/clients/[clientId]/edit`

**Step 4 — `updateClient` server action.** In `src/app/admin/clients/actions.ts`, add `updateClient(clientId, patch, supabase)` server action:
- RBAC: requires `canManageAllClients(profile)` (Owner / Admin / Coord — see §3 RBAC matrix).
- Field-level filtering: identity fields (full_name, email, gender_preference) writable only when `canManageClientIdentityFields(profile)` (Owner + Admin). Coord receives a no-op for those fields server-side.
- Email-collision check: same shape as `createClient` lines 153-187 — if the new email matches a different existing client, return hard error `"Email already in use by [other client name]. Resolve manually."`. No silent merge.
- Audit log row: action_type `client_updated`, `before_state` = current row snapshot, `after_state` = only changed fields. Don't log unchanged fields.
- Cache invalidation: `updateTag("clients")` + `revalidatePath("/admin/clients")` + `revalidatePath(\`/admin/clients/${clientId}\`)`.

**Step 5 — New route.** Create `src/app/admin/clients/[clientId]/edit/page.tsx` + colocated `ClientEditForm.tsx`. Form mirrors `ClientCreateForm.tsx` shape (same section headings: Who they are / How to reach them / Internal notes), with one addition: **a Gender preference field** (`gender_preference_type` enum, default `no_preference`) — present in the DB schema but not on the create form. Edit-only for now; create-form completeness is out of C-06 scope.

**Step 6 — "Edit" button on detail header.** In `src/app/admin/clients/[clientId]/page.tsx` action area (currently lines 593-594, sitting next to `PrintRecordButton` + "Book again" CTA), add an Edit button (`Pencil` icon from lucide). Only renders when `canManageAllClients(profile)` is true.

**Step 7 — Coordinator field-level gating.** New permission `manage_client_identity_fields` (migration) granted to Owner + Admin; NOT Coord. Helper `canManageClientIdentityFields(profile)` in `src/lib/auth/rbac.ts`. In `ClientEditForm.tsx`, when the actor lacks the permission:
- Identity fields (full_name, email, gender_preference) render as **read-only** with a tooltip explaining the limitation.
- Server action (`updateClient`) silently drops identity-field keys from the patch and writes only what's permitted. Belt + braces.
- Therapist gets the existing `AdminAccessDenied` page (predicate fails at route entry).

### 2.3 The delete primitive — `deleteClient`

**Step 8 — Server action.** In `clients/actions.ts`, add `deleteClient(clientId, reason, supabase)`:
- RBAC: requires `canManageAllClients(profile)` for `reason='admin_delete'`; requires `MANAGE_PRIVACY_OPERATIONS` for `reason='gdpr_erasure'`.
- Soft-delete: `UPDATE clients SET deleted_at = now()` (new column — see Migration §6). The row stays in DB so audit_log target labels still resolve.
- Cascade soft-delete bookings: `UPDATE bookings SET status = 'cancelled', deleted_at = now() WHERE client_id = $1 AND status NOT IN ('cancelled', 'completed')`. Don't touch completed bookings — they're a tax + ICO record. Don't touch cancelled bookings — they're already inert (C-05 lockdown).
- Hard-delete sensitive notes: `DELETE FROM client_notes WHERE client_id = $1 AND is_sensitive = true` (GDPR Article 17 — special-category health data must actually disappear).
- Anonymise audit_log target labels: `UPDATE audit_logs SET target_label = '[deleted client]' WHERE target_type = 'clients' AND target_id = $1`. Keep the rows (audit integrity) but strip PII from the label.
- Audit log row: action_type `client_deleted`, `before_state` = full pre-delete snapshot, `after_state` = `{ deleted_at, reason }`. **One row per `deleteClient` call** — when called in a bulk loop, that produces N rows, which is the correct shape for forensics ("client X deleted at time T by actor Y for reason Z").
- For cascade-deleted bookings: **one rolled-up audit row** per `deleteClient` call with `after_state = { cascaded_booking_count: N, cascaded_booking_ids: [...] }`. Avoids N+1 audit rows per bulk-delete (preserves audit-log readability).
- Cache invalidation: `updateTag("clients")` + `updateTag("bookings")` + `updateTag("audit")` + revalidatePath on `/admin/clients`, `/admin/clients/[clientId]`, `/admin/bookings`, `/admin/audit`, `/admin/privacy`, `/admin/dashboard`.

**Step 9 — Delete button on detail page.** In `clients/[clientId]/page.tsx` action area, add a Delete button next to Edit. Opens `ConfirmActionModal` (existing component at `src/app/admin/components/admin-ui-interactions.tsx`) with copy:
> "Delete **{client.full_name}** and cancel all their open bookings?
>
> · Past completed bookings stay on the record.
> · Sensitive health notes are deleted permanently.
> · This cannot be undone."

Confirm button: "Delete client" — destructive tone. On confirm, calls `deleteClient(clientId, 'admin_delete', supabase)` and redirects to `/admin/clients?deleted=1` (param triggers a "Client deleted" toast on the list page).

**Step 10 — Bulk-delete on `/admin/clients` list.** New feature on `src/app/admin/clients/page.tsx`:
- Checkbox column added to client rows.
- When ≥1 row selected, a sticky toolbar appears: "{N} selected · Delete selected · Clear selection".
- "Delete selected" opens `ConfirmActionModal` with copy:
> "Delete **{N} clients** and cancel their open bookings?
>
> · {N} client profiles will be soft-deleted.
> · Open bookings for each will be cancelled.
> · Past completed bookings stay on the record.
> · This cannot be undone."

Modal lists the first 3 names + "and {N-3} more" for the count. Decisions doc Q5 was silent — locking this as **count + sample names** (the brief's Open Q resolved during plan-writing — see §9).

On confirm: loops `deleteClient(clientId, 'admin_delete', supabase)` in series (not parallel — keeps the transaction footprint per-row predictable). One audit row per client + one rolled-up cascade row per client = 2N rows total for N clients.

### 2.4 The privacy honesty fix

**Step 11 — Privacy "Completed" wiring.** In `src/app/admin/privacy/actions.ts`, extend `updatePrivacyRequestStatus`:
- When `status === 'completed'` and `request_type === 'deletion_review'`: call `deleteClient(before.client_id, 'gdpr_erasure', adminClient)` after writing the status update.
- When `status === 'completed'` and `request_type === 'data_export'`: call new `generateClientDataExport(before.client_id, adminClient)` server action — returns a minimal JSON blob bundling client + bookings + notes (excluding `is_sensitive = true`). The action writes it to a downloadable stream and triggers a browser download. No PDF, no branded report.
- When `status === 'completed'` and `request_type === 'correction'` or `'sensitive_note_review'`: existing behaviour (status update only — these are manual workflows).
- Update the `ConfirmActionModal` copy in `PrivacyStatusForm.tsx:138-141` so the description reflects what actually happens per request type. Branch on `request_type`. No more lying.

**JSON export format** (locked at plan-writing time — see §9 Open Q resolved):
```json
{
  "exported_at": "2026-05-26T14:30:00.000Z",
  "exported_by": { "staff_id": "...", "name": "..." },
  "request": { "id": "...", "type": "data_export", "created_at": "..." },
  "client": { /* all fields except id timestamps */ },
  "bookings": [ /* all rows, full select including booking_items + assignments */ ],
  "notes": [ /* non-sensitive notes only */ ],
  "audit_log_summary": [ /* last 50 audit rows where target_id = client.id */ ]
}
```

Sensitive notes are excluded per page.tsx:772 comment + UK GDPR Article 9(2)(h) special-category data carve-out (admin still has them in `sensitive_note_review` queue if the request type warrants release). Audit log is **included** (resolved Open Q — see §9): admins can opt to redact it manually before sending; the system gives them the full export.

---

## 3 — RBAC matrix (C-06 actions × roles)

Confirmed via `role_permissions` query 2026-05-26:

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| View `/admin/clients/[id]` | ✅ all | ✅ all | ✅ all | ✅ assigned-only |
| Edit operational fields (phone, address, city, area, notes, client_source, source_detail, postcode) | ✅ | ✅ | ✅ | ❌ |
| Edit identity fields (full_name, email, gender_preference) | ✅ | ✅ | ❌ (read-only view) | ❌ |
| Delete client (admin_delete) | ✅ | ✅ | ❌ (button hidden — Coord doesn't need destructive ops) | ❌ |
| Bulk-delete | ✅ | ✅ | ❌ | ❌ |
| Privacy "Completed" → `deleteClient(gdpr_erasure)` | ✅ | ✅ | ❌ (lacks `manage_privacy_operations`) | ❌ |

**Note on Coord delete:** today `canManageAllClients(coord)` is `true`. The decisions doc was silent on Coord-vs-Admin distinction for delete. **Brief locks this as Owner + Admin only** for delete (operational vs destructive split). This narrows Coord's surface area, consistent with "Coord operational fields only for edit". One new permission `manage_client_destructive_ops` granted to Owner + Admin only — gates Delete button + bulk-delete checkbox visibility.

Therapist is blocked at route entry for both edit and any delete affordance, identical to today's `/admin/clients/new` gate.

---

## 4 — Layout strategy

### 4.1 `/admin/clients/[clientId]/edit` — new route

Mirror `ClientCreateForm.tsx` structure. Three `AdminPanel`s:

1. **"Who they are"** — full_name (required), client_source (required), source_detail, **gender_preference** (new field, dropdown: No preference / Female only / Male only, default current value).
2. **"How to reach them"** — email, phone, address, postcode, city, area.
3. **"Internal notes"** — notes textarea with character counter.

Sticky save bar at the bottom (mobile + desktop), pattern lifted from `ClientCreateForm.tsx:422-459`. Cancel returns to `/admin/clients/[clientId]`.

Field-level gating for Coord:
- Identity fields render as `disabled` inputs with helper text: *"Only Owner and Admin can change identity fields. Contact one of them if this needs updating."*
- No "Save anyway" override — server action will silently drop identity changes regardless.

### 4.2 Client detail page header (`/admin/clients/[clientId]`)

Currently the action area (page.tsx:593-617) holds Print + "Book again" (when `canCreateBooking`). Add two buttons before "Book again", in this order:

```
[Print] [Edit] [Delete] [Book again — primary]
```

**Edit:** `Pencil` icon + "Edit" label. Outline tone. Links to `/admin/clients/[clientId]/edit`.
**Delete:** `Trash2` icon + "Delete" label. Cancelled tone (red border, red text). Opens `ConfirmActionModal`. Hidden when actor lacks `manage_client_destructive_ops`.

At 375 px, the action row already wraps via `flex-wrap`. Verify nothing collides — likely needs `gap-1.5` adjustment per existing wrap behaviour.

### 4.3 `/admin/clients` list — bulk-delete toolbar

Today the list is a card-grid layout (`clients/page.tsx` line ~1337 spawns `ClientRowMenu`). Add:

1. **Row checkbox** — leading cell on each row. Mobile: occupies a dedicated tap target (`size-11`) consistent with the existing menu trigger.
2. **Sticky selection bar** — appears on first selection, sits below the page header at `top-12 z-30`. Same styling as the existing sticky save bar in `ClientCreateForm` (background `var(--admin-panel)`, top border).
3. **Bar copy:** `{N} client{N>1 ? 's' : ''} selected` + buttons `[Delete selected]` (cancelled tone) + `[Clear]` (ghost).
4. **Confirmation modal:** see §2.3 step 10 copy.

Selection state lives in a `useState<Set<string>>` (set of clientIds). On submit, fetched names are passed into the modal for the count-and-sample display.

Hidden when actor lacks `manage_client_destructive_ops`.

### 4.4 Privacy page — "Completed" feedback

`PrivacyStatusForm.tsx` already routes destructive transitions through `ConfirmActionModal`. Update the modal's `description` prop to branch on the request's `request_type`:

| Request type | New description |
|---|---|
| `deletion_review` | "Marking complete will delete this client's profile, cancel their open bookings, and permanently remove any sensitive notes. Past completed bookings stay for tax + ICO records. This cannot be undone." |
| `data_export` | "Marking complete will generate a JSON export of the client's data (excluding sensitive health notes) and trigger a download. The client will be emailed the file." (Note: client email is out of scope — see Open Q.) |
| `correction` | (existing copy — manual workflow) |
| `sensitive_note_review` | (existing copy — manual review only) |

The form needs the request_type passed in as a prop. Currently `PrivacyStatusForm` only receives `requestId` + `status` — extend props.

---

## 5 — States & edge cases

### 5.1 Booking-form duplicate detected (B-110/B-131 path)

When server returns `{ duplicateWarning: "Sara Mohamed (sara@example.com)" }`:
- Banner renders at top of step 1 (matching `ClientCreateForm` placement at line 246-252).
- Checkbox: "Create a separate client profile anyway" — name=`confirm_duplicate`.
- Submit button disabled until checked.
- Banner persists across step navigations within the same form session.
- After checkbox + resubmit, the RPC is re-invoked with `p_confirm_duplicate=true` and skips the duplicate exception.

### 5.2 Email-collision on edit

When edit form attempts to change email to one matching a different existing client:
- Server returns `{ error: "Email already in use by Fatima Ahmed. Resolve manually." }`.
- Inline error banner at top of form (same pattern as `FormErrorBanner` in `ClientCreateForm.tsx:506-545`).
- No automatic merge offered — the resolution path is delete + re-create, or contact support for a manual merge.

### 5.3 Soft-deleted client visibility on list

**Locked decision (Open Q resolved in §9):** soft-deleted clients are **hidden by default** with a "Show deleted (N)" toggle in the filter strip. Toggle exposed via existing `PrivacyFilterBar` pattern — or a simpler dropdown if the list filter strip doesn't already exist. When toggled on, deleted rows render at 60% opacity with a strikethrough on the name; the only action available is "View" (no Edit, no Delete, no new-booking CTA). Audit log on the row remains accessible.

### 5.4 Cascade-delete behaviour on past completed bookings

Completed bookings are **never deleted** — they're a tax + ICO record. The soft-delete cascade only touches `status NOT IN ('cancelled', 'completed')`. On the deleted client's audit-log row, the cascade summary records this:
```json
{ "cascaded_booking_count": 3, "cascaded_booking_ids": [...], "completed_bookings_preserved": 5 }
```

### 5.5 Privacy "Completed" with already-deleted client

Edge case: admin marks a `deletion_review` Completed for a client whose profile was already deleted via the Delete button. `deleteClient` should be **idempotent** — if `deleted_at IS NOT NULL`, return `{ success: true, alreadyDeleted: true }` and skip the cascade. Status update on the privacy request still happens. Audit log records `client_deleted` with `reason='gdpr_erasure'` and `before_state.already_deleted: true`.

### 5.6 Concurrent edit conflict

Two admins editing the same client simultaneously: today's `updated_at` is updated on every write. Add an optimistic-concurrency check — the edit form carries a hidden `client_updated_at` input; the server action rejects the patch if `current.updated_at !== form.client_updated_at`, returning a "This client was updated by someone else. Reload to see the latest." error. Mirrors the gap flagged in W10 B-150 (business_settings concurrent-edit). Cheap to add here.

---

## 6 — Migration footprint (Zone-2 — confirmed at C-C time, not now)

C-06 needs **one migration** in C-C (single file, multiple statements). Brief draft:

```sql
-- 1. New column for soft-delete (clients + bookings)
ALTER TABLE public.clients ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN deleted_at timestamptz;

-- 2. New permissions
INSERT INTO public.permissions (name, description) VALUES
  ('manage_client_identity_fields',
   'Edit identity fields on client records (full_name, email, gender_preference)'),
  ('manage_client_destructive_ops',
   'Delete and bulk-delete client records');

-- 3. Grant new permissions to Owner + Admin (NOT Coord)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('Owner', 'Admin')
  AND p.name IN ('manage_client_identity_fields', 'manage_client_destructive_ops');

-- 4. RPC change — see Step 1 §2.1 for full body
CREATE OR REPLACE FUNCTION public.create_booking_request(
  -- existing params
  p_client_id uuid DEFAULT NULL,
  p_confirm_duplicate boolean DEFAULT false
  -- ...
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;

-- 5. (No new audit_log action_types as DB rows — action_type is just a text column,
--    new values land as code-level constants. C-C verification confirms.)
```

**Not in this plan, deferred to C-09:** `unstable_cache` tag retrofit on read paths.

**Not in this plan, never:** hard-deletes of any historical data. Audit + tax integrity stays intact.

---

## 7 — Files touched (preview — full list in plan)

### NEW files
- `src/app/admin/clients/[clientId]/edit/page.tsx`
- `src/app/admin/clients/[clientId]/edit/ClientEditForm.tsx`
- `src/app/admin/clients/[clientId]/edit/__tests__/ClientEditForm.test.tsx`
- `src/app/admin/clients/components/DuplicateWarningBanner.tsx` (extracted shared component)
- `src/app/admin/clients/components/BulkDeleteToolbar.tsx`
- `src/app/admin/clients/components/DeleteClientButton.tsx`
- `src/app/admin/clients/data-export.ts` (new server action for JSON export)
- `supabase/migrations/<timestamp>_c06_client_crud_hardening.sql`

### EDITED files
- `src/app/admin/clients/actions.ts` — add `updateClient`, `deleteClient`, `bulkDeleteClients`
- `src/app/admin/clients/new/ClientCreateForm.tsx` — extract `DuplicateWarningBanner` to shared location (no behaviour change)
- `src/app/admin/clients/[clientId]/page.tsx` — add Edit + Delete buttons in header action area
- `src/app/admin/clients/page.tsx` — add checkbox column + `BulkDeleteToolbar` integration + soft-delete filtering
- `src/app/admin/clients/ClientRowMenu.tsx` — add "Delete client" item (when permitted)
- `src/app/admin/clients/types.ts` — add `deleted_at` to `ClientRecord`
- `src/app/admin/bookings/new/ManualBookingForm.tsx` — hidden client_id + `DuplicateWarningBanner` integration + `confirm_duplicate` checkbox
- `src/app/admin/bookings/actions.ts` — thread `client_id` + `confirm_duplicate` through `createManualBooking`
- `src/app/api/bookings/createBookingTransaction.ts` — pass `p_client_id` + `p_confirm_duplicate` to RPC, surface `duplicate_client_exists` exception
- `src/app/admin/privacy/actions.ts` — branch `updatePrivacyRequestStatus` on `(status, request_type)` and call `deleteClient` / `generateClientDataExport`
- `src/app/admin/privacy/PrivacyStatusForm.tsx` — branch modal description on `request_type`
- `src/lib/auth/rbac.ts` — add `canManageClientIdentityFields`, `canManageClientDestructiveOps`, `PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS`, `PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS`

### TESTED additions (vitest specs)
- New: `clients/__tests__/updateClient.test.ts`
- New: `clients/__tests__/deleteClient.test.ts`
- New: `clients/[clientId]/edit/__tests__/ClientEditForm.test.tsx` (RBAC + field-gating)
- Updated: `bookings/new/ManualBookingForm.test.tsx` — duplicate-warning flow + hidden `client_id` plumbing
- Updated: `api/bookings/createBookingTransaction.test.ts` — new RPC args

---

## 8 — Sequencing and dependencies

**Within C-06:** the safe order is RPC + form (steps 1-3) → edit surface (steps 4-7) → delete primitive (steps 8-10) → privacy wiring (step 11). Migration lands last, just before final verification.

**Cross-plan:** C-06 has no hard blockers. It ships before C-04a → C-05 per the C-B-DECISIONS §5 recommended order. C-04a depends on no C-06 outputs; C-06 depends on no other C-NN plan's outputs.

**Coordination with C-09:** the new `updateTag("clients")` / `updateTag("bookings")` calls in `updateClient` + `deleteClient` align with C-09's tag taxonomy. C-06 sets the precedent; C-09 retrofits the rest of the admin.

---

## 9 — Open questions surfaced during plan-writing (resolved or flagged)

The handoff listed 4 open questions to surface. Each is resolved below, with the resolution baked into the brief above:

**Q9.1 — Bulk-delete modal copy: names or count?**
→ **Both.** First 3 names + "and {N-3} more" when N > 3. Count-only feels coarse; full-list overflows on bulk pastes. The hybrid matches the existing `DuplicateWarningBanner` pattern (lists matching client display names with separators).

**Q9.2 — Soft-deleted clients on list: hidden default or strikethrough toggle?**
→ **Hidden by default, "Show deleted (N)" toggle.** Reduces visual noise on the working surface. Toggle pattern matches the existing FilterBar idiom. Deleted rows render at 60% opacity, strikethrough on name, only "View" affordance.

**Q9.3 — Cascade-deleted booking audit log: per-booking row or rolled-up?**
→ **Rolled-up.** One `client_deleted` audit row per `deleteClient` call carries `cascaded_booking_count` + `cascaded_booking_ids[]` in `after_state`. Bulk-delete of N clients produces N rows + N rolled-up cascade summaries = 2N rows. Per-booking would explode to N × M rows (M = avg bookings per client).

**Q9.4 — JSON export include audit_log entries?**
→ **Yes, last 50 audit rows where `target_id = client.id`.** UK GDPR Article 15 right-of-access typically includes audit metadata. Admin can opt to redact before sending; the system gives them the complete export.

### Newly surfaced open questions (flagged for C-C, not blocking plan)

**Q9.5 — Coord delete posture.** The decisions doc was silent on Coord's delete capability. **Locked in this brief as Owner + Admin only** (new permission `manage_client_destructive_ops`). If the user wants Coord to delete, flip the role_permissions migration to include Coord.

**Q9.6 — `gender_preference` on create form.** Today the field exists in the schema (default `no_preference`) but isn't on `ClientCreateForm.tsx`. C-06 introduces it on the **edit** form only. Adding it to create is one extra `<select>` plus a Zod field — **out of C-06 scope** per "surgical changes" principle, but a 5-minute follow-up.

**Q9.7 — Client email on `data_export` completion.** The privacy modal copy today implies a confirmation email is sent. C-06 generates the JSON file but does **not** email the client — emailing requires a new template + delivery flow, which belongs in C-08. For C-06, the modal copy is rewritten to say "trigger a download for the privacy manager" instead. Honest, no longer a lie.

**Q9.8 — `create_booking_request` RPC versioning.** Existing callers (the test fixture + production booking flow) pass positional args. Adding two new defaulted parameters at the end is backward-compatible. Verify no callers pass args by name in conflicting positions.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-06 implementation is complete when:

1. **The destructive overwrite is impossible from any of the 3 prefill paths.** Manual repro:
   - From `/admin/bookings/new` (no prefill) using an existing client's email + a typo'd name → duplicate banner appears, no overwrite occurs unless admin checks "Create separate profile anyway".
   - From `?enquiryId=` → same.
   - From `?clientId=` → form submits with `client_id`; RPC honours it; existing client's other fields not touched.
2. **Editing a client works end-to-end.** Owner / Admin can change any field; Coord can change operational fields and sees identity fields disabled with explainer copy; Therapist cannot reach the edit route.
3. **Deleting a client works end-to-end.** Confirmation modal lists the cascade; soft-delete sets `deleted_at`; open bookings are cancelled; sensitive notes are gone; audit log has a single `client_deleted` row + rolled-up cascade summary.
4. **Bulk-delete works for ≥2 clients.** Selection bar appears; modal lists names + count; loop completes; per-client audit rows generated.
5. **Privacy "Completed" on a `deletion_review` actually deletes the client.** Verified via post-state DB query showing `clients.deleted_at IS NOT NULL` + `bookings.deleted_at IS NOT NULL` for open ones.
6. **Privacy "Completed" on a `data_export` triggers a JSON download.** Verified via Playwright `browser_evaluate` capturing the download URL.
7. **Coordinator cannot delete.** Delete button is hidden in the UI; direct route invocation returns insufficient-permissions error.
8. **All static gates pass:** `pnpm lint`, `npx tsc --noEmit`, `pnpm vitest run` (6 baseline failures preserved), `pnpm build`, bundle delta within budget.
9. **Playwright role sweep at 375 / 768 / 1280 / 1440 passes for all 4 roles.**
10. **Badar's row (`9d55ce2a`, real email `avonrk@hotmail.co.uk`) is untouched.** Test data only.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §3 C-06 | 11-step scope (locked) |
| `C-B-DECISIONS.md` §2 Q5 | Both entry points share one `deleteClient` primitive |
| `C-B-DECISIONS.md` §2 Q6 | Edit-route field list + RBAC layers |
| `C-B-DECISIONS.md` §2 Q2 | Privacy honesty fix scope (cascade + JSON only; no SLA, no ICO) |
| `W06-client-create-and-first-booking-flow.md` §10 | Complete RPC + form architecture for B-110 / B-131 fix — **lift verbatim** |
| `W02-new-booking-end-to-end-flow.md` §1+§2 | 3 prefill paths catalogue + cache-invalidation map |
| `06-clients-new-audit.md` §1 B-29 | DuplicateWarningBanner pattern (the lift target) |
| `07-client-detail-audit.md` §1 B-34 | The missing edit surface (the gap C-06 closes) |
| `22-privacy-audit.md` | B-87 / B-88 P0 GDPR honesty gap (the lie C-06 makes truthful) |
| `BAND-C-MASTER-PLAN.md` Part 0 | Operating discipline — credentials, MCPs, hard rules |
| `clients/actions.ts:117-223` | `createClient` reference implementation (dedup pattern, audit log shape) |
| `clients/[clientId]/page.tsx:593-617` | Where Edit + Delete buttons land |
| `bookings/new/ManualBookingForm.tsx:518-530, 613` | Where hidden client_id input + duplicate banner integrate |
| `privacy/actions.ts:24-84` | `updatePrivacyRequestStatus` extension point |

---

## 12 — Out of scope (explicit non-goals)

- **Hard-delete of bookings** — preserved for tax + ICO records.
- **Hard-delete of audit logs** — preserved for forensic integrity (only target_label is anonymised).
- **Undo window** for delete — decisions doc Q5 explicitly out.
- **Refund modal / refund tracking** — C-04b is dropped per decisions doc Q8.
- **PDF / branded data export** — JSON only per decisions doc Q2.
- **Client confirmation email on deletion or export completion** — belongs in C-08 (decisions doc Q7 didn't list it).
- **SLA timer on aging privacy requests** — B-90, deferred to compliance band per decisions doc Q2.
- **ICO 72h breach workflow** — B-89, deferred to compliance band per decisions doc Q2.
- **Owner-from-Admin RBAC split** — deferred per decisions doc Q11.
- **`gender_preference` on the create form** — see Open Q9.6.
- **Cache-invalidation sweep beyond C-06's own additions** — C-09 handles the rest.

---

*End of C-06 brief. Plan file follows: `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md`.*
