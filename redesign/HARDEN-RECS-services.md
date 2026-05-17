# Harden recommendations — services

Generated against the live implementation in worktree `agent/services-redesign`. Brief: `/redesign/briefs/services-brief.md`.

## State coverage matrix (brief §6 vs implementation)

| State | Brief intent | Implementation status | Notes |
|---|---|---|---|
| Default (loaded) | Grouped catalog with H1 + summary + Add service Primary | ✅ Implemented | `page.tsx` renders `AdminPageScaffold` + `AdminPageHeader` |
| Active service row | Letter token + name + description + price + duration + gender chips + Edit + 3-dot | ✅ Implemented | `AdminEntityRow` composition |
| Inactive service row | Cancelled-family `Inactive` badge; menu shows `Activate` | ✅ Implemented | `is_active === false` branch in `page.tsx` + `ServiceRowActions` |
| Hidden service row | Restricted-family `Hidden` badge; menu shows `Show on website` | ✅ Implemented | `is_visible_on_frontend === false` branch |
| In-use service row | Completed-family `In use` badge; menu Delete disabled | ✅ Implemented | `InUseBadge` (Completed-family pill) + `DeleteServiceButton hasHistoricalBookings` guard |
| Empty catalog | `EmptyState` + "No services yet" + "Add your first treatment to start the catalog." + Add service Primary | ✅ Implemented | `page.tsx` total === 0 branch |
| Sheet: Add service | Slide in from right, blank form, "Save service" Primary + Cancel Ghost | ✅ Implemented | `ServiceFormDialog` create mode |
| Sheet: Edit service | Same sheet, "Edit {service name}" title, pre-filled, "Save changes" Primary | ✅ Implemented | `ServiceFormDialog` edit mode |
| Sheet: submitting | `aria-busy`, spinner replaces icon, inputs stay enabled per AdminButton spec | ✅ Implemented | `AdminButton loading={isPending}` |
| Sheet: field errors | Inline `role="alert"` per field; cross-field error banner | ✅ Implemented | `AdminInput error` slot, gender select error region, form-level `role="alert"` banner |
| Delete confirmation | Cancelled-family modal, "Delete `{service name}`?" body, Destructive + Secondary buttons | ✅ Implemented | `DeleteServiceButton` modal |
| Delete blocked | Sonner toast (Cancelled family, no auto-dismiss), no modal | ✅ Implemented | `hasHistoricalBookings` branch in `DeleteServiceButton` |
| Loading skeleton | `AdminSkeleton: group headings + row placeholders` | ⚠️ N/A | Server-rendered page; no client-side loading state needed |

## Verification edge cases (recipe Step 9)

| Edge case | Status | Notes |
|---|---|---|
| 80-char service name doesn't break row at 375px | ✅ Verified | `<input maxLength={80}>` on name; `AdminEntityRow` title wraps via `break-words` |
| Edit sheet with 5-row `full_description` pre-filled doesn't push footer off | ✅ Verified | Sheet body uses `overflow-y-auto`; footer is in flex column flow at bottom |
| Delete `ConfirmActionModal` at 375 with long service name wraps cleanly | ✅ Verified | Modal width `min(calc(100vw-2rem),26rem)`; title `text-base` wraps; tested via DOM |
| 3-dot Delete `disabled` with native `title` when `usage_count > 0` | ✅ Implemented | `DeleteServiceButton` renders `disabled aria-disabled="true" title="Has booking history — deactivate instead"` |
| Empty-catalog `EmptyState` with "Add your first treatment." + Add service Primary, no dashed border | ✅ Implemented | `EmptyState` from `EmptyState.tsx` (no dashed border) + `ServiceFormDialog` trigger below |
| Slug-change warning banner above submit when editing in-use service | ⏭️ Deferred | Brief Copy section §"Slug-change warning on in-use service (optional inline confirmation modal)" — marked optional. Defer to Phase 7. |

## Recommendations applied

1. **80-char hard cap on service name** — added `maxLength={80}` on the name `AdminInput` to enforce the brief's row-collapse limit at write-time.
2. **Cross-field error region** — top-level `role="alert" aria-live="polite" aria-atomic="true"` banner inside the form for server-returned `state.error`.
3. **Per-field error regions** — each `AdminInput` carries its own `role="alert"` region (via shared primitive), plus an explicit alert region for the gender select.
4. **Aria-busy + spinner on submit** — `AdminButton loading={isPending}` swaps the leading icon slot for a spinner and sets `aria-busy="true"` per DESIGN.md §Status Communication.
5. **Delete blocked toast — `duration: Infinity`** — Sonner toast is non-auto-dismissing per DESIGN.md Status Communication: "Error (system-level): no auto-dismiss".
6. **Native `title` on disabled Delete option** — `title="Has booking history — deactivate instead"` per brief Tooltip text section.
7. **AdminSheet keyboard close** — Escape closes the BaseDialog (built-in); focus trapped while open (BaseDialog default behavior).
8. **Title-case category display** — group H2 displays use `titleCase(group.title)` so the DB-stored `"cupping"` renders as `"Cupping"` per brief §8 ("title-cased").

## Items deferred to Phase 7

- 3-dot trigger touch target 36px (shared primitive `AdminActionMenu`)
- Row title typography 14px vs brief's title step 21px (shared primitive `AdminEntityRow`)
- Slug-change-on-in-use-service inline warning banner (brief marked optional)

See `redesign/per-page-deferrals/services-deferrals.md` for full deferral context.

## Hardening not needed

- I18n: admin is single-locale (en-GB) per PRODUCT.md scope. No additional locale handling needed.
- Offline / network failure: `createService`/`updateService`/`deleteService` server actions already return `{ error }` shape; UI surfaces via Sonner persistent toast. Standard Next.js server-action error path is already covered.
- Validation overlap with server: parseServiceFormData already enforces name/slug/price/duration/order; client-side `required` + `min/max` are progressive enhancement on top.
