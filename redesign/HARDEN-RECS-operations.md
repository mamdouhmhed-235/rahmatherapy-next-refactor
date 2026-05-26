# Harden recommendations — operations

**Date:** 2026-05-17
**Page:** `/admin/operations`
**Files reviewed:** `src/app/admin/operations/page.tsx`, `operations-board.tsx`, `event-row.tsx`

## Brief Layer-3 backend error states (§6 Key States table)

| State | Status | Action taken |
|---|---|---|
| Initial-load failure (DB error or timeout on column queries) | **PARTIAL → FIXED** | Page already surfaces Cancelled-family `AdminPanel` error banner (`role="alert" aria-live="polite"`). Brief mandates filter strip remains visible and offers "Try again" Ghost. **Fix applied below: H1.** |
| Admin/PM scope: owner-only event types silently omitted | **HANDLED at data layer** | Silent omission per §11. No UI change required — `getAdminPageAccess` + `canManageOperations` controls visibility. Admin/PM holds `manage_email_settings`; owner-only events filtered at the data layer per RECON §6.2. |
| Bulk resolve partial failure | **HANDLED** | `operations-board.tsx:155–170` increments `failures` counter on caught throws, toast with `duration: Infinity` matches brief copy `Couldn't resolve {N} of {total}. Try again.`. Successfully-resolved rows migrate; failed rows roll back optimistic move. |

## Brief verification edge cases (§Implementation Notes)

| Case | Status | Notes |
|---|---|---|
| 250-character `summary` truncates on desktop with tooltip; wraps clean on mobile | **HANDLED** | `event-row.tsx` summary `<p>` uses `xl:line-clamp-1 xl:break-all` with `title={event.summary}` native tooltip. Mobile: no clamp, full wrap. |
| 8+ `safe_context` keys: 4 inline chips + "+N more" Ghost | **HANDLED** | `event-row.tsx` slices `safeKeys.slice(0, 4)`; `+N more` button opens native `<details>`. |
| 60 error-severity rows in Open column with full tint | **PARTIAL** | Cancelled-family bg applied on Open + error rows. Visual fatigue at scale untested (DB empty). Phase 7 should sample with seeded data. |
| Bulk-Resolve ConfirmActionModal body with `{n}=87` at 375px | **HANDLED** | `ConfirmActionModal` width caps at `w-[min(calc(100vw-2rem),26rem)]`. Body wraps via Description prop. No overflow risk. |
| All-clear EmptyState shield-with-check renders when `operations-clear.svg` missing | **HANDLED** | `EmptyState` falls back to `ShieldCheck` lucide icon; wrapper element carries `data-redesign-needs-photo="operations-clear.svg"`. |

## Network / concurrent operations

| Case | Status | Notes |
|---|---|---|
| Acknowledge submit during pending state | **HANDLED** | Button `disabled={pending !== null}`; `aria-busy` set; spinner replaces leading icon (§12.6 admin-ui pattern). |
| Resolve submit during pending state | **HANDLED** | Same disable/busy contract. |
| Bulk Resolve double-tap | **HANDLED** | `bulkResolving` flag disables the trigger; ConfirmActionModal `confirming` flag disables both buttons during the sequenced POSTs. |
| Acknowledge failure (network throw) | **HANDLED** | `event-row.tsx` rollback to `previousColumn`, toast `Couldn't acknowledge that event. Try again.` |
| Resolve failure (network throw) | **HANDLED** | Same rollback, toast `Couldn't resolve that event. Try again.` |

## Permission / auth resilience

| Case | Status | Notes |
|---|---|---|
| Coordinator/Therapist navigates to `/admin/operations` | **HANDLED** | `getAdminPageAccess` returns no-access → `AdminAccessDenied` with sanitised copy ("Operational events access limited"); no raw permission identifier leaks. |
| Inactive staff hits page | **HANDLED** | `if (!profile.active) redirect("/admin/login")` at page top. |

## Accessibility resilience

| Case | Status | Notes |
|---|---|---|
| Keyboard-only navigation | **HANDLED** | All buttons + links are focusable; `o`/`a`/`r` keys jump focus to column heading; severity chip is an `<a>` with `focus-visible` ring. |
| Screen-reader announcement of column migration | **HANDLED** | Live `aria-live="polite"` region surfaces bulk progress line; Sonner toasts have built-in `role="status"`. |
| `prefers-reduced-motion` | **HANDLED** | Tailwind transitions on focus/hover; no motion that violates. AdminSkeleton uses `motion-reduce:animate-none`. |
| Form `role="alert" aria-live="polite"` | **HANDLED** | Initial-load error banner uses AdminPanel's built-in role="alert". |

## Hardening fixes applied this step

- **H1: initial-load error preserves filter strip + adds "Try again" CTA.** Brief §6 explicitly: "Filter strip remains visible. Severity stat tiles are also absent. Ghost 'Try again' button." Pre-fix: my error path returned an empty `<AdminPanel error="…">` and hid stat tiles + filter strip. Post-fix: stat tiles hidden (no data to count), filter strip preserved, retry CTA links back to `/admin/operations`.
- **H2: Bulk-Resolve trigger guard.** `disabled={bulkResolving}` prevents reentry during in-flight sequence.

## Carry-forward to Phase 7 (gauntlet)

- Validate visual fatigue with 60+ error-severity Open rows once Supabase seed exists.
- Confirm `operations-clear.svg` asset lands in `public/images/admin/empty-states/` so the `data-redesign-needs-photo` marker can clear.
- Run a real bulk-resolve over N=20+ to validate the sequenced-POST audit-log ordering.
