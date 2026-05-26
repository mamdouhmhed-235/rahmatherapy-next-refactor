# Harden recommendations — account-password-requests

Generated 2026-05-18 during Phase 6 Step 9 of the redesign recipe. The page is greenfield with FAKE backend (3 outstanding BUILD plans). Harden focuses on every state listed in brief §6 Key States + per-state edge cases.

## Edge-case verification matrix

| Case | Implemented behaviour | Status |
|---|---|---|
| Pending tab, zero rows | `EmptyState` "All caught up" + body "No password-reset requests are waiting for review." + no CTA | ✓ (covered in `emptyStateCopy`) |
| Approved/Rejected/Expired/All tab, zero rows | Per-tab `EmptyState` with Ghost "Show pending" CTA where applicable | ✓ |
| Tab switch loading | Wrapped in `<Suspense key={status} fallback={<RequestListSkeleton />}>` so RSC stream falls back to `AdminSkeleton`-composed placeholder rows when async data fetch is non-trivial. Skeleton renders 3 placeholder rows + a result-count skeleton with `aria-busy="true" aria-live="polite"`. | ✓ (wired; falls through with sync FAKE seed, fires correctly when real async lands) |
| List load failure | Implicit through Server Component error boundary at `src/app/admin/error.tsx`; the page itself doesn't catch — fail surface is the shared admin error boundary | ✓ (relies on shared boundary) |
| Approve modal open | Confirmed-family header glyph, optional textarea (`name="reviewer_note"`), counter "{N} / 240", Primary "Send approval email" + Cancel | ✓ |
| Reject modal open | Cancelled-family header glyph, required textarea with `*` marker, role="alert" error region, Destructive "Send rejection email" + Cancel | ✓ |
| Reject empty-note submit | HTML `required` attribute prevents form submit AND server-side validation returns `{ ok: false, code: 'validation', message: "Add a note before rejecting. The requester needs to know why." }`; error region wraps in `role="alert" aria-live="polite" aria-atomic="true"` | ✓ |
| Approve in flight | `useFormStatus.pending` → button shows `Loader2` spinner, `aria-busy="true"`, button disabled | ✓ |
| Approve success | Modal closes via `useEffect(result.ok)`; route revalidates — no client toast yet (Sonner integration would be Phase 7 polish; FAKE handler revalidates) | ⚠ no toast (deferred to Phase 7 when real send lands) |
| Self-approval attempt | Server action returns `{ ok: false, code: 'self_approval' }`; modal stays open; client renders error region "You can't approve your own request. Ask another owner or admin to review." | ✓ stub wired; actual self-check waits for real backend |
| Race condition (already reviewed by another admin) | Server action returns `{ ok: false, code: 'race', otherReviewer }`; modal stays open; client renders error region "This request was just reviewed by {other reviewer}. Refresh to see the latest." | ✓ stub wired |
| 240-char overflow on Approve note | Client `maxLength={240}` + state clamp `slice(0, 240)`; server-side also rejects > 240 | ✓ |
| 240-char overflow on Reject note | Same | ✓ |
| Reviewer-note rendering hostile HTML / `<script>` | React default text escaping. No `dangerouslySetInnerHTML` anywhere on the page | ✓ |
| 80-char long email at 375px | `truncate` on `<p>` (whitespace-nowrap + overflow-hidden + text-ellipsis); `title` attribute carries full email | ✓ |
| Permission missing (`manage_account_password_requests` not granted) | Page renders `AdminAccessDenied` with denied copy that does NOT leak the raw permission name (admin-access denied component sanitises any input matching `/^[a-z_]+$/`) | ✓ |
| Owner has audit access; Admin/PM does not | Per-row: `canOpenAudit` flag drives whether "Open audit row" Ghost link renders or the Soft Slate "Audit details available to the owner only." line appears | ✓ |
| ESC inside open modal | Base UI `Dialog.Root` handles ESC → setOpen(false). Disabled while `pending` (useFormStatus) | ✓ |
| Backdrop click | Base UI Dialog default → setOpen(false). Disabled while `pending` | ✓ (Base UI default) |
| Focus return on modal close | Base UI Dialog default focuses the originating trigger | ✓ |
| `prefers-reduced-motion` | Modal uses Tailwind's `motion-safe:` prefix variants; reduced-motion users get instant fade with no slide | ✓ |
| FAKE backend window | Every approve/reject button + modal carries `data-redesign-backend="FAKE"` with a `data-redesign-fake-source` BUILD plan reference; the page wrapper carries the same marker plus a sighted-reviewer banner | ✓ |

## Notes for Phase 7 gauntlet (deferrals)

- Sonner toast on Approve/Reject success — brief calls for "Approval email sent to {email}." and "Rejection email sent to {email}." auto-dismissing toasts. Current FAKE wiring closes the modal but emits no toast. The toast can land alongside the real server actions when `BUILD-approve-reject-password-reset.md` ships, since the toast is meaningful only when an email actually went out.
- Idempotent row-status race-check — server action stubs return the structured error code but do not actually re-check DB state. That check ships with the real backend.

## Files touched

- (no source-file changes during harden; existing code already covers every brief state via the matrix above)
