# Scope — privacy

Recipe: `/redesign/per-page-recipes/privacy-recipe.md`
Brief: `/redesign/briefs/privacy-brief.md`
Backend status: FAKE (filter query un-implemented per `BUILD-privacy-filter-query.md`)

## Files to edit

- `src/app/admin/privacy/page.tsx` — full rewrite: AdminPageHeader (new copy), three-tile stat strip (Open requests / Awaiting longest / Sensitive notes reviewed this month), filter strip via new `PrivacyFilterBar` client wrapper (GET form with `request_type` / `status` / `from` / `to` / `q` + optional `sort` + `expand`), two-column `xl:grid-cols-[minmax(0,1fr)_22rem]` with four status-grouped `AdminPanel`s (Received → Reviewing → Completed → Declined) in fixed order, request rows on `surface-page` (no nested cards, no `bg-white`), Soft Slate quoted request_note well via `PrivacyRequestNote`, `<details>` "Update status" disclosure wrapping `PrivacyStatusForm`, sensitive-note rail panel (right column on xl, collapsed `<details>` on mobile), shared `EmptyState` (replaces legacy `AdminEmptyState`) with clipboard-with-shield image slot (`data-redesign-needs-photo`), Denied state stripped of raw permission identifier, all `var(--rahma-*)` → DESIGN.md tokens, `expand=all` override for Completed/Declined.
- `src/app/admin/privacy/PrivacyStatusForm.tsx` — restyle to DESIGN.md Input + Button spec; preserve `name="request_id"` and `name="status"` hidden/select inputs verbatim; preserve `updatePrivacyRequestStatus` server action wiring (no fetch/XHR); wire `ConfirmActionModal` on Completed + Declined destructive transitions per brief §6; success Sonner toast `Request marked {status}.`; failure Sonner toast `Couldn't update the request. Try again.` (persistent, Retry); button label `Save status`; align option labels (Received / Reviewing / Completed / Declined) with brief §8.
- `src/app/admin/privacy/PrivacyFilterBar.tsx` — NET-NEW client wrapper: GET-form filter strip (request_type multi-select, status multi-select, date-range presets Today/This week/This month/Custom revealing from/to, `q` search), active-filter chips below, Apply (Secondary) + Clear (Ghost) actions, mobile "Filters" Ghost trigger → `AdminSheet` from bottom. Form element carries `data-redesign-fake="filter-query"` until backend lands (BUILD-privacy-filter-query.md).
- `src/app/admin/privacy/PrivacyRequestNote.tsx` — NET-NEW client wrapper: Soft Slate well with leading single-character mark, `whitespace-pre-wrap`, `line-clamp-4` default, "Show more" / "Show less" Ghost toggle.

## Files to NEVER touch

- `src/app/admin/privacy/actions.ts` — `updatePrivacyRequestStatus` server action; signature, names, and return shape are RECON §5 untouchable.
- `src/app/admin/clients/[clientId]/actions.ts` (and any other file owning `createClientPrivacyRequest`) — creation never happens on this page (RECON §5 + §6.4).
- `client_notes` write paths anywhere in the codebase — sensitive notes are reviewed here, not edited; edits route to client detail.
- `src/middleware.ts` — out of Phase 6 scope.
- `src/lib/auth/**` — RBAC layer; `canViewClientContactDetails`, `canManageSensitiveClientNotes`, `hasPermission`, `PERMISSIONS` consumed read-only.
- `src/lib/supabase/**` — DB client layer.
- `src/components/ui/card.tsx` and other shared primitives — fixes live in `00-shared-components` session.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, lockfiles, etc.).
- Main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — user works there.

## Backend FAKE surfaces

The recipe's brief §6 Backend error states + recipe Step 3 BACKEND FAKE MARKER specify:

- Filter strip `<form>` element (in `PrivacyFilterBar.tsx`) — carries `data-redesign-fake="filter-query"`. Server still returns the unfiltered page-load result until `BUILD-privacy-filter-query.md` lands. URL persistence works; filtering does not.
- Stat-tile click-to-filter on "Open requests" and "Awaiting longest" — falls under the same FAKE umbrella (the URL appends params, server ignores them for now).

## Permission contract (read-only consumption)

- `hasPermission(profile, PERMISSIONS.MANAGE_PRIVACY_OPERATIONS)` — gates request queue and status forms.
- `canManageSensitiveClientNotes(profile)` — gates sensitive-note rail.
- `canViewClientContactDetails(profile)` — silently omits contact-detail line under client names (no "hidden" copy hint).
