# Harden recommendations — enquiries

Generated during Phase 6 Step 9 (`/impeccable harden enquiries`). The brief's `## 6. Key States` table is the canonical state matrix; this doc records which states are implemented and which were already-handled by the craft pass.

## Implemented states (verified in code)

| State | Where it lives |
|---|---|
| All tab default | `page.tsx` server reads `?tab` → defaults `all`, no status filter applied |
| New tab | `?tab=new` → `status === "new"` rows; Attention-family `tone="warning"` badges; Mark contacted Ghost primary |
| Contacted tab | `?tab=contacted` → `status === "contacted"`; Pending-family `tone="info"` badges; Convert Ghost primary |
| Converted tab | `?tab=converted` → `converted_booking_id IS NOT NULL`; Confirmed-family `tone="success"` badge; `View booking →` Ghost link only |
| Closed tab | `?tab=closed` → `status === "closed"`; Cancelled-family `tone="danger"` badge; three-dot menu only (Reopen as new) |
| Per-tab empty | `EnquiryEmptyState` with per-tab copy from brief §8 Empty-state table; CTAs: `Record enquiry` (All) → `#enquiry-intake-panel`, `Show new` (Contacted) → `?tab=new`; remaining tabs have no CTA per brief |
| Filtered to empty | `EnquiryEmptyState` branch with `hasActiveFilters` → "No enquiries match" + "Clear filters" Ghost CTA |
| Form submitting | `EnquiryForm` Record-enquiry Primary: `aria-busy="true"` + `Loader2` spinner; inputs remain enabled |
| Form error | Top-of-form `role="alert" aria-live="polite" aria-atomic="true"` region with `XCircle` icon + Cancelled-family bg/text |
| Form success | `formRef.current?.reset()` + `toast.success("Enquiry recorded.")` + `router.refresh()` (new row appears at top) |
| Mark contacted failure | `EnquiryStatusButton` → persistent `toast.error("Couldn't update that one. Try again.", { duration: Infinity, action: { label: "Retry" } })` |
| Convert on stale (already converted) | Defensively: Convert button is replaced with "View booking →" once `converted_booking_id` is set, so the stale-click case is structurally precluded. If a stale URL still hits `createManualBooking` with an already-converted enquiry, the booking flow surfaces the error there. |
| Close failure | `EnquiryStatusButton` close path uses `errorMessage="Couldn't close that one. Try again."` |
| Loading | Server component → Next.js handles `loading.tsx`-style suspense at the route level; no client-side spinner needed for the list. Inputs use `disabled:` styling for in-flight form state. |

## Edge cases verified

| Edge case | Status |
|---|---|
| 60-char `full_name` doesn't break row at 375px | `AdminEntityRow.title` uses `break-words` → wraps cleanly. No horizontal scroll at 375px confirmed via Playwright (`hasHorizontalScroll: false`). |
| 4-row `notes` textarea | `<textarea rows={4} className="resize-y">` — user can grow further if needed |
| Phone + email both empty | Brief calls for "Add a phone or email; you need at least one to follow up." — this is a server-side validation gap (`actions.ts` Zod schema does NOT enforce this combined-required rule; both fields are independently optional). Server-side schema is in the Files-NEVER-touch list, so this stays as documented behaviour. Deferred to Phase 7 / backend cycle. |
| Instagram `at-sign` icon | `SOURCE_ICONS.instagram = AtSign` from Lucide; rendered at `size-4` (16px); `aria-hidden="true"`. Brief §10 Q4 substitute confirmed. |
| Required `*` markers | `EnquiryForm.FieldLabel` renders `<span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">*</span>` next to label text — Cancelled text colour. Verified visually on Full name and Email labels. |

## Touch targets

| Target | Mobile (375) | Desktop (1440) |
|---|---|---|
| `Mark contacted` Ghost | 44px ✓ (was 36px, fixed Step 7b polish iteration) | 36px |
| `Convert` Ghost link | 44px ✓ (same fix) | 36px |
| `View booking →` Ghost link | 44px ✓ (same fix) | 36px |
| Mobile filter `<details>` trigger | 44px ✓ (`min-h-11`) | n/a |
| Mobile intake form toggle | 44px ✓ (`min-h-11`) | n/a |
| `AdminActionMenu` summary | 36px (component-level — owned by 00-shared-components) | 36px |

## Open hardening notes deferred to Phase 7

- Server-side cross-field validation for `phone XOR email` required is not enforced in `actions.ts` Zod schema. Brief copy promises a specific message ("Add a phone or email; you need at least one to follow up.") that would require a `.refine()` on the schema. `actions.ts` is in the recipe's NEVER-touch list. Defer to Phase 7 backend cycle.
- Mobile filter sheet uses native `<details>` instead of `AdminSheet` (`Base UI Dialog`). Functionally equivalent disclosure but does not trap focus / portal. Defer to Phase 7 if focus-trap matters in audit.
