# Per-page scope — enquiries

## Files to edit

- `src/app/admin/enquiries/page.tsx` — Restructure to two-column desktop (24rem sidebar + flexible main). Add URL-param tab strip (`?tab=all|new|contacted|converted|closed`, default `all`) with Attention-family count badge on "New". Add GET filter bar (`source`, `assigned_staff`, `from`, `to`, `q`). Restyle list rows to `AdminEntityRow` pattern with source icon + status badge + always-visible Ghost actions + three-dot `AdminActionMenu`. Replace legacy `AdminEmptyState` with shared `EmptyState` per tab. Mobile: collapse intake form behind `Record new enquiry` disclosure toggle (client `useState`); tab strip → momentum-scroll pills; filter bar → `Filters` Ghost → `AdminSheet`. Mark `// FAKE: BUILD-enquiries-filter-query` at the filter-read call sites (server-side filtering is a no-op until that BUILD lands). Replace plain header count badge with the "New" tab badge. Single H1 "Enquiries", H2 "Record enquiry" in sidebar.
- `src/app/admin/enquiries/EnquiryForm.tsx` — Restyle all inputs to DESIGN.md Input spec (`surface-input` ground, `border-default` Form Seam, Focus Azure on focus). Add `role="alert" aria-live="polite" aria-atomic="true"` error region above submit. Add 16px spinner + `aria-busy="true"` on submit. Add `aria-label` to `assigned_staff_id` select. Ensure every `<label for="…">` matches input `id`. Required `*` markers (`<span aria-hidden="true">*</span>`) in Cancelled text colour on `full_name` and `email`. Preserve every existing field `name` attribute verbatim.
- `src/app/admin/enquiries/EnquiryStatusButton.tsx` — Replace raw `warning`/`muted` tone classes with DESIGN.md `AdminStatusBadge` + Ghost button pattern. Status transitions emit Sonner toasts ("Marked as contacted." / "Enquiry closed." / persistent Cancelled toast with Retry on failure). Preserve `updateEnquiryStatus(id, status)` call binding verbatim.

## Files to NEVER touch

- `src/app/admin/enquiries/actions.ts` — Server actions `createEnquiry`, `updateEnquiryStatus`. Do not rename, change signatures, or alter field bindings.
- `src/lib/auth/**` — Standard untouchable (RECON §5).
- `src/lib/supabase/**` — Standard untouchable (RECON §5).
- `src/middleware.ts` — Standard untouchable.
- `supabase/migrations/**` — Standard untouchable.
- All build/config files — `next.config.ts`, `tsconfig.json`, `package.json`, `tailwind.config.*`, `postcss.config.*`, `pnpm-lock.yaml`.
