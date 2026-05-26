# Scope — emails (Phase 6 session 22)

## Files to edit

- `src/app/admin/emails/page.tsx` — full rewrite (server component): tab shell + Delivery body + Reminders body + Templates marker stub + Denied copy fix.
- `src/app/admin/emails/format.ts` (new) — pure helpers: event-type labels, status-tone mapping, day-grouping, relative time.
- `src/app/admin/emails/DeliveryFilterStrip.tsx` (new, client) — filter strip + active-filter chips + mobile `AdminSheet` fallback.
- `src/app/admin/emails/CopyEventId.tsx` (new, client) — clipboard click on the mono `provider_message_id` token.
- `src/app/admin/emails/ReminderResendForm.tsx` (new, client) — wraps `<form action={sendManualBookingReminder}>`, preserves the verbatim `<input type="hidden" name="booking_id">`, adds optimistic "Sending…" state + Sonner toasts + `router.refresh()` so the row's "Last reminder" sub-line updates.
- `src/app/admin/emails/loading.tsx` (new) — Next.js route loading boundary; renders the brief §6 skeleton (tab strip pills + filter-strip rectangles + 3 day panels × 4 row skeletons).

Helper files live in the emails route directory, mirroring the established admin pattern (audit page splits into 6 sibling files). The primary owned surface is still `page.tsx`; the helpers are implementation detail for it.

Full rewrite of `page.tsx` replaces the two-column dump with a 3-tab parent surface (Delivery / Reminders / Templates). This session owns:
  - The tab shell (`?tab=delivery|reminders|templates`, `aria-current="page"`, mobile momentum-scroll pills, count badges)
  - The Delivery tab body (filter strip + chips + per-day grouped `AdminPanel` feed + Load-more + `<details>` error expansion + copy-on-click provider IDs + empty + load-failure states; FAKE — filters degrade to unfiltered last-100 until `BUILD-email-delivery-filter-query.md` lands)
  - The Reminders tab body (single-column max-720 list, verbatim `<form action={sendManualBookingReminder}>` per row with the `<input type="hidden" name="booking_id">` preserved, optimistic "Sending…" state, Sonner toasts, "Last reminder" sub-line)
  - A Templates tab marker stub containing the literal string `Templates tab body — populated by the email-templates session` — the future email-templates session greps for this marker
  - `AdminAccessDenied` denied-copy fix (no raw `view_email_logs` identifier)

## Files to NEVER touch

- `src/app/admin/emails/actions.ts` — `sendManualBookingReminder` server action (RECON §5 explicit DO-NOT-TOUCH; the no-private-body contract lives here)
- `src/lib/email/**` — Resend sender helpers; `templates.ts` is SERVER ONLY
- `src/lib/auth/**` — auth/permission helpers (RECON §5)
- `src/lib/supabase/**` — Supabase clients (RECON §5)
- `src/middleware.ts` — auth middleware (RECON §5)
- `supabase/migrations/**` — DB migrations (RECON §5)
- All build/config files (`next.config.ts`, `tsconfig.json`, `tailwind.config.*`, `package.json`, `pnpm-lock.yaml`, etc.)
- The `email_delivery_events` schema and read shape (read-only contract)

## Backend FAKE markers

The Delivery tab depends on `BUILD-email-delivery-filter-query.md` (BLOCKS-REDESIGN). Until that lands, the filter strip submits but the server falls back to the unfiltered last-100 events read. Filter call sites carry `data-redesign-backend="FAKE"` and a `// FAKE` comment. The Reminders tab's `sendManualBookingReminder` action stays wired verbatim and is NOT FAKE — it is the existing working contract.

The 24h automated reminder cron belongs to `BUILD-automated-booking-reminders.md` (BLOCKS-REDESIGN). This recipe does not surface that automation; it builds only the manual-resend queue. No FAKE marker is needed in this page for the automated cron since the page does not render anything from it.

## Templates tab note

The Templates tab body is owned by the `email-templates` recipe (a later session). This session renders a stub with the literal marker string so the next session can find and replace it. Do NOT implement template browsing, preview, edit, or manual-send here.
