# C-12+ FAKE marker inventory (distributed from C-09)

Per C-09 brief §2.5, the non-filter FAKE markers were explicitly out of C-09
scope — C-09 Phase D only replaced the filter-bearing fetchers (enquiries,
staff, operations, emails, privacy) with real server-side filters. This doc
enumerates everything else that remains FAKE, for C-12+ planning.

**Provenance note:** the plan's own Step 14 draft was written 2026-05-26.
Twelve plans have shipped since, including C-15 (which retired one whole
component and resolved half of another marker) and this same plan's Phase D
(which removed the filter markers, confirmed below). The list below is a
fresh re-grep of the live tree at the time this file was written, not a copy
of the plan's draft — see "Reconciliation" at the end for what changed and
why the count differs from the plan's expectation.

## Categories

### A — Backend stubs (no real action / no real persistence)

- `src/app/admin/account-password-requests/ApproveModal.tsx:74-75, 87` —
  `data-redesign-backend="FAKE"` / `data-redesign-fake-source="approve
  handler — BUILD-approve-reject-password-reset.md"` — approve action does
  not persist a review decision or notes.
- `src/app/admin/account-password-requests/RejectModal.tsx:72-73, 85` — same
  shape for reject (same BUILD doc).
- `src/app/admin/roles/[roleId]/DangerZonePanel.tsx:115` —
  `data-redesign-fake="delete-role"` — delete role is a no-op.
- `src/app/admin/roles/CreateRoleSheet.tsx:39, 171` —
  `data-redesign-fake="create-role"` — create-role submit is disabled;
  `createRole` doesn't exist in `roles/actions.ts` yet (BUILD-create-role.md).
- `src/app/admin/password-reset/page.tsx:19` — state routing (states 1/2/3)
  is cookie-only; the real implementation would also query
  `account_password_requests` by the cookie's email-hash to confirm row
  status (BUILD-password-reset-request-actions.md). **Not in the plan's
  original list** — the plan only inventoried the admin-side approve/reject
  actions, not this customer-facing pre-auth flow that feeds the same queue.
- `src/app/admin/password-reset/states/ForgotForm.tsx:18, 87-88` —
  `data-redesign-backend="FAKE"` — `submitPasswordResetRequest` no-ops the DB
  write + email send (same BUILD doc as above). **Not in the plan's original
  list.**
- `src/app/admin/password-reset/states/SetNewPassword.tsx:100-101` —
  `data-redesign-backend="FAKE"` — `setPasswordWithToken` does not call the
  Supabase Auth admin API (same BUILD doc). **Not in the plan's original
  list.**
- `src/lib/email/templates.ts:1494` — password-reset email templates are
  structure-only; real Resend send wiring lands with
  `BUILD-password-reset-email-templates.md` — a distinct BUILD doc from the
  three above (email content vs. request/approval persistence). **Not in the
  plan's original list.**

### B — RBAC / render-fallback stubs

- `src/app/admin/email-templates/preview/[id]/route.ts:20-25` — **partially
  resolved since the plan was drafted.** The plan's draft cited lines 9, 84,
  172 and described BOTH an RBAC-check FAKE and a render-fallback FAKE. C-15
  Phase B (commit series around `10ca7db`/companions) made GET resolve real
  saved overrides and added a real POST draft-preview path — the
  render-fallback half is fixed. What remains, now only at lines 20-25, is
  the RBAC-gate precision: the route still gates on the broader
  edit-OR-view-only check (`canManageEmailSettings || canViewEmailLogs ||
  canResendBookingEmails`) instead of the specific `manage_email_templates`
  permission key that already exists and that `actions.ts` already enforces
  for saves/resets (`BUILD-rbac-permission-email-templates.md`).

### C — Workload aggregate stubs

- `src/app/admin/staff/page.tsx:252-255, 379-380` —
  `data-redesign-fake="staff-workload-aggregates"` — team-health numbers
  (active / bookable / no-assignments) are derived client-side from
  page-load data rather than a real aggregate query
  (`BUILD-staff-workload-aggregates`).

### D — Staff availability action stubs

- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx:200`
  — `data-redesign-fake="staff-availability-override-actions"`.
- `src/app/admin/staff/[staffId]/availability/StaffBlockedDatesManager.tsx:176`
  — `data-redesign-fake="staff-blocked-dates-actions"`.

### E — One-offs

- `src/app/admin/audit/page.tsx:116-121` — `BUILD-audit-target-existence` —
  target-row existence is unknown (`null`); the "Open target" ghost renders
  optimistically rather than being confirmed by a real batched lookup.
- `src/app/admin/emails/ReminderResendForm.tsx:26, 56` —
  `FAKE-FAILURE-PATH` — confirmed present (the plan flagged this one as
  "mentioned in audit but not in current grep — verify"; it is real, at line
  56, with supporting comment at line 26). The untouchable
  `sendManualBookingReminder` server action swallows its own errors, so the
  client-side failure branch cannot currently fire in practice.
- `src/app/admin/emails/page.tsx:604-619` — `data-redesign-backend="FAKE"` —
  "Load more" pagination stub ("Showing the most recent N events" /
  "BUILD pending" badge); load-more arrives with the cursor-pagination
  backend. **Not in the plan's original list** — likely introduced or left
  in place after the plan's draft, adjacent to C-16's pagination work.
- **Removed since the plan was drafted:** `src/app/admin/emails/ManualSendSheet.tsx:291`
  — the plan listed this as a live one-off ("booking-context picker depends
  on BUILD-email-templates-actions"). The file no longer exists: C-15 Phase F
  (commit `10ca7db`, "retire ManualSendSheet + old editor components")
  deleted it outright. There is nothing left at this path to plan for.

## Reconciliation — live count vs. the plan's expectation

The plan's Step 14 draft (2026-05-26) enumerated **11 file locations**
carrying non-filter FAKE markers: `ApproveModal.tsx`, `RejectModal.tsx`,
`DangerZonePanel.tsx`, `CreateRoleSheet.tsx`,
`email-templates/preview/[id]/route.ts`, `staff/page.tsx`,
`StaffAvailabilityOverridesManager.tsx`, `StaffBlockedDatesManager.tsx`,
`audit/page.tsx`, `emails/ManualSendSheet.tsx`, `emails/ReminderResendForm.tsx`.

The live re-grep at time of writing finds **15 file locations**, and the
sets are NOT identical:

- **10 of the plan's 11 persist** largely as described (the
  `preview/[id]/route.ts` entry is narrower now — see category B).
- **1 of the plan's 11 is gone**: `emails/ManualSendSheet.tsx` was deleted
  whole by C-15 Phase F.
- **5 are new**, not in the plan's draft at all: `password-reset/page.tsx`,
  `password-reset/states/ForgotForm.tsx`,
  `password-reset/states/SetNewPassword.tsx`, `src/lib/email/templates.ts`
  (password-reset email templates), and `emails/page.tsx`'s pagination stub.

Net: 11 − 1 + 5 = **15**, which disagrees with the plan's stated 11. The
disagreement is expected and explained above file-by-file — this document
records the real, live number (15) rather than silently adopting the plan's
stale draft count.

**Filter-FAKE reconciliation (cross-check against Phase D):** the plan's
non-filter inventory is, by definition, everything left over after Phase D's
filter-cleanup. A live re-grep of the 5 surfaces Phase D touched
(`enquiries/page.tsx`, `staff/page.tsx`, `operations/page.tsx` +
`event-row.tsx`, `emails/page.tsx` + `DeliveryFilterStrip.tsx`,
`privacy/page.tsx` + `PrivacyFilterBar.tsx`) confirms **zero** remaining
`FAKE`/`data-redesign-fake` markers tied to filtering. The only surviving
hit is a harmless historical comment in `enquiries/page.tsx:178`
("client-facing sort order was never part of the filter-FAKE pattern") that
explains why sort stays client-side — not a stub marker. This reconciles
cleanly: Phase D's removal is complete, and every marker in this document is
genuinely non-filter.

## Recommended C-12+ approach

Cluster by category:
- **A: Password-reset + account workflows** — `BUILD-approve-reject-password-reset.md`,
  `BUILD-password-reset-request-actions.md`, and
  `BUILD-password-reset-email-templates.md` cover one coherent customer-facing
  flow (request → admin approve/reject → set new password → email content)
  plus the admin-side roles workflows (`BUILD-create-role.md`, role deletion).
  These naturally split into two focused plans (password-reset end-to-end;
  roles create/delete) but could also ship as one larger BUILD plan given the
  shared "server action currently no-ops" shape.
- **B: RBAC / render fallback hardening** — now a single narrow item: wire
  the exact `manage_email_templates` permission into the preview route's
  gate (`BUILD-rbac-permission-email-templates.md`). Small, isolated.
- **C: Workload aggregate query** — replace the client-derived staff
  team-health numbers with a real aggregate query.
- **D: Staff availability per-day action wiring** — override-actions and
  blocked-dates-actions for `/admin/staff/[staffId]/availability`.
- **E: Email-side polish** — `ReminderResendForm`'s failure-path (depends on
  `sendManualBookingReminder` gaining a real throw contract) and the
  `/admin/emails` cursor-pagination "Load more" stub (likely folds into
  C-16-style pagination work rather than a standalone plan).
- **F: Audit target-existence lookup** — batched existence check for
  `/admin/audit`'s "Open target" affordance.

Each cluster gets its own focused C-12+ plan, except where noted (B and part
of E are small enough to fold into an adjacent plan rather than standing
alone).
