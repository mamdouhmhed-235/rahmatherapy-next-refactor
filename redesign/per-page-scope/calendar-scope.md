# Per-page scope — calendar

Phase 6 session: row 14 of 29 (chronological position 6).
Worktree: `agent/calendar-redesign` off `redesign/start-state`.

## Files to edit

- `src/app/admin/calendar/page.tsx` — full redesign per brief: replace `AdminFilterBar` with date-aware control rail (segmented Day/Week + date stepper with DayPicker popover + staff combobox + payment select + Apply Secondary); rebuild day view with 56px time-rail gutter + offset `BookingListCard`s; rebuild week view as 7 stacked per-date `AdminPanel`s with count badges; add sticky Unassigned sidebar (admin/coordinator) or Claimable today (therapist); concurrent-bookings Attention chip + `role="status" aria-live="polite"` banner; shared `EmptyState` with calendar-empty.svg placeholder; print stylesheet per DESIGN.md §Admin-Specific Patterns; strip raw `var(--rahma-*)` token escapes and bare `bg-white` (lines 62/64/135 per brief §9); strip raw `view_bookings_all or view_bookings_assigned` permission identifier on denied screen (line 176); preserve all four GET param names (`view`/`date`/`staffId`/`paymentStatus`); preserve `BookingListCard` import from Brief 01.
- `src/app/admin/calendar/PrintButton.tsx` — only if a `print:hidden` adjustment is needed; otherwise leave untouched.
- `src/app/admin/calendar/CalendarDatePopover.tsx` — net-new client component (co-located in the same route directory). Required because the brief mandates React DayPicker, which needs `"use client"`, while `page.tsx` must remain a server component for async `getReportData` + RBAC. Co-located file pattern is canonical Next.js App Router practice; no shared component layer is touched.

## Files to NEVER touch

- `src/app/admin/reports/reporting.ts` (and shared `getReportData` / `parseReportFilters`) — RECON §5 untouchable; calendar reads from this contract.
- `src/lib/time/london/**` (`addBusinessDays`, `formatBusinessDate`, `getBusinessDate`) — RECON §5 untouchable.
- `src/lib/auth/**` and `src/lib/supabase/**` — auth + DB layer; RECON §5.
- `src/lib/auth/getAdminPageAccess.ts` — admits all four active roles for "calendar"; do not touch.
- `src/middleware.ts` — admin route gating unaffected.
- `src/components/ui/card.tsx` — out of scope (fix lives in 00-shared-components session, already completed).
- `BookingListCard` (Brief 01 shared component) — REUSE verbatim, do not re-skin.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).
- Main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — never touch; user works there.
