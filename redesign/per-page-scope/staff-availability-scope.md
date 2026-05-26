# Per-page scope — staff-availability

## Files to edit
- `src/app/admin/staff/[staffId]/availability/page.tsx` — replace decorative banner + tab nav with flat header + TabPills; add mode-selector band, inactive banner, three-manager stack; route Panel B + C data; remove raw permission identifier from denied state.
- `src/app/admin/staff/[staffId]/availability/AvailabilityModeSelector.tsx` — restyle as segmented control with status-family pill + plain-English sub-line; route Custom→Use-global through ConfirmActionModal Destructive Primary; preserve existing mode-update server-action contract verbatim.
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityRulesForm.tsx` — restyle to DESIGN.md tokens (Form Seam input borders, status families, no raw hex); preserve existing submit + add + delete server-action contracts and form field `name` attributes; add disabled-with-Ghost-switch state when mode = global.
- `src/app/admin/staff/[staffId]/availability/StaffBlockedDatesManager.tsx` (NET-NEW) — client component with inline add form (`staff_id` hidden, `date`, `all_day`, `reason`) + AdminEntityRow list sorted ascending + per-row Trash Ghost via ConfirmActionModal + past-entries `<details>` disclosure + EmptyState inline copy; carries `data-redesign-fake="staff-blocked-dates-actions"` until backend BUILD lands.
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` (NET-NEW) — parallel grammar with `staff_id` hidden + `date` + `start_time` + `end_time` + `reason` + Pending-family chip + per-row Trash via ConfirmActionModal; carries `data-redesign-fake="staff-availability-override-actions"`.
- `src/app/admin/staff/[staffId]/availability/actions.ts` — add four net-new server actions: `addStaffBlockedDate`, `deleteStaffBlockedDate`, `addStaffAvailabilityOverride`, `deleteStaffAvailabilityOverride`, each gated by `manage_availability_global OR (isOwnProfile && manage_availability_own)` inline; graceful FAKE degrade until BUILD plans land.

## Files to NEVER touch
- `staff_availability_rules` server-action contract on `StaffAvailabilityRulesForm` (submit + add + delete) — RECON §5 untouchable.
- `AvailabilityModeSelector`'s mode-update action contract — RECON §5 untouchable.
- `staff_availability_rules`, `staff_blocked_dates`, `staff_availability_overrides` table schemas.
- Booking-engine read paths against all three tables.
- `src/middleware.ts`.
- `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer; permission gate preserved verbatim.
- `src/components/ui/card.tsx` and other shared primitives — out of scope (fixes live in `00-shared-components` session).
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).
- Main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — the user works there.
