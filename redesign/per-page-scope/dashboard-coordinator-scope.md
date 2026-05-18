# Per-page scope — dashboard-coordinator

## Files to edit

- `src/app/admin/dashboard/page.tsx` — Coordinator-variant Tier 2 composition: render only `ActiveEnquiriesCard` + `OperationsHealthCard` for `plan.variant === "coordinator"` (no `DemandTrendCard`, no `BusinessPulseCard`, no `StaffCapacityCard`, no `PaymentHealthCard`). Pass `unassignedFirst` to `TodayAtAGlanceCard` for coordinator variant. Sort `todayAppointments` unassigned-first for coordinator (`unassignedFirst`). Wire `ActiveEnquiriesCard` from `data.enquiries`. Resolve role-pill copy via `getDashboardCopy(plan.variant).rolePill` (new field).
- `src/app/admin/dashboard/dashboard-cards.tsx` — add new `ActiveEnquiriesCard` export (Cormorant-Chronicle numeral count + 2-row excerpt + per-row "Convert →" Ghost → `/admin/bookings/new?enquiryId=…` + trailing "→ All enquiries" Ghost → `/admin/enquiries`; source icon Lucide `phone`/`message-square`/`instagram`/`globe`; Pending-family chip "New"/"Contacted"; empty-state "No active enquiries"/"All enquiries handled"). `TodayAtAGlanceCard` accepts `unassignedFirst: boolean` (default `false` for Owner/Admin parity); when true, sorts rows unassigned-first then by start time. Unassigned rows render avatar slot as Hover-Moss circle + centred 16px `user-x`; trailing Attention-family assignment chip "Unassigned" or "Unassigned · same-gender required" when `required_gender` set. Inline sub-line count `of which N unassigned · N confirmed · N pending` with Attention-text colour + `alert-circle` when unassigned > 0, Confirmed-text colour when 0.
- `src/app/admin/dashboard/dashboard-header.tsx` — role-pill mapping uses Restricted family tint for "Coordinator"; chrome unchanged.
- `src/app/admin/dashboard/dashboard-filters-client.tsx` — Export Ghost gated on `canExport` (the prop already exists at the call site in `page.tsx:664`); ensure the rendered link respects the gate so Coordinator never sees it. Date-preset chips + "More filters" sheet identical to Owner/Admin.
- `src/app/admin/dashboard/attention-group-client.tsx` — no changes in this session (Brief-06 carry-forward `bg-black` removal already landed in start-state — verified via Grep returning 0 matches; preserve `id="attention-dialog-title"`).
- `src/app/admin/dashboard/demand-trend-client.tsx` — no changes in this session (component not rendered for Coordinator; Brief-06 carry-forward fixes already landed by dashboard-owner-admin OR will land when that session runs).
- `src/app/admin/components/notification-bell.tsx` — no changes in this session (Brief-06 `border-l-4` carry-forward already landed in start-state — verified via Grep returning 0 matches).

## Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — RECON §5 server-side aggregation (coordinator variant resolution line 124). If Active Enquiries needs a new data shape, flag in handoff; default to using existing `data.enquiries` payload.
- `src/app/admin/dashboard/dashboard-helpers.ts` — RECON §5.
- `src/app/admin/dashboard/dashboard-data.test.ts`, `src/app/admin/dashboard/dashboard-helpers.test.ts` — test surface.
- `src/app/admin/dashboard/TherapistDashboard.tsx` — therapist variant lives in separate brief.
- `src/app/admin/shell-variant.ts` — `resolveAdminShellVariant` is RECON §5.
- `src/app/admin/enquiries/actions.ts` — enquiry mutations stay in their own route.
- `src/middleware.ts` — Supabase session refresh / route protection.
- `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5).
- `supabase/migrations/**`.
- `src/components/ui/card.tsx` — fix lives in `00-shared-components` session.
- All build/config files (`next.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, `tsconfig.json`, etc.).
