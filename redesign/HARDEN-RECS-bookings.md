# Harden recommendations — /admin/bookings

Date: 2026-05-14
Scope: production-readiness pass on the bookings list page (Phase 6 craft output).
Brief: `redesign/briefs/bookings-brief.md` §6 "Key States" + Implementation Notes.

---

## 1. Production risks identified

### Layout resilience

- **R-1.** Long client names (60+ characters, common in the Rahma clientele: "Mohammed Abdul Rahman Al-Hashemi-Khalifa", double-barrelled Welsh/Polish names, etc.) overflow the row at 375px width when the name `<p>` has no `break-words`.
- **R-2.** Long service-name concatenations (`serviceNames.join(", ")`) on bookings with three or more service items overflow on mobile.
- **R-3.** Therapist-name list (`distinctTherapists.join(", ")`) below the avatar stack can be many names long on group bookings.
- **R-4.** `Group · N` chip would render "Group · 0" or "Group · 1" when `group_booking=true` but `participants.length <= 1` (draft-state data shape from booking-new).

### Error resilience

- **R-5.** Quick-action server errors surface raw server-side strings (e.g. "This assignment has already been claimed.") instead of the brief's operator-friendly copy ("Someone got there first."). Brief §10 Copy explicitly lists those friendlier forms.
- **R-6.** Catch blocks on the quick-action and claim paths log via `console.error(error)` (just the value), which doesn't give Sentry enough context to filter.
- **R-7.** The Suspense list-fetch catch block swallows the error entirely — no log, no Sentry breadcrumb.

### Concurrent operations

- **R-8.** Cancel routes through `ConfirmActionModal`. The modal's own `onConfirm` could be reached while another action (Confirm / Mark paid / Mark complete) is still in flight, stacking concurrent server calls.

### Keyboard accessibility

- **R-9.** Both dropdowns (row `…` menu and chrome "More" overflow) don't move focus into the panel on open. Escape closes but doesn't return focus to the trigger. Brief verification step explicitly asks for these.
- **R-10.** Row menu children lacked `role="menuitem"` despite the parent carrying `role="menu"`.

### Storage edges

- **R-11.** Saved views (localStorage) grew unbounded. Users could pollute their own browser quota and pay JSON-parse cost on every page load. View name length wasn't constrained either; a 5KB label would still save.

### State coverage gaps (brief vs implementation)

- **R-12.** Brief §10 distinguishes **"Filtered to empty"** from **"Search to empty"** with different headings, bodies, and CTAs ("Clear filters" vs "Clear search"). The implementation collapsed both into a single filtered-empty state.

---

## 2. Recommendations (and what was applied)

| # | Recommendation | Applied? | File |
|---|---|---|---|
| R-1 | `break-words` on the client name `<p>` | yes | `page.tsx` |
| R-2 | `break-words` on the date/service line | yes | `page.tsx` |
| R-3 | `min-w-0 break-words` on therapist-name list | yes | `page.tsx` |
| R-4 | Guard `isGroup` to `participantCount > 1` only | yes | `page.tsx` |
| R-5 | Map known server errors via `friendlyError()` to brief copy: claim race → "Someone got there first.", stale → "Refresh to see the latest.", 404 → "This booking is no longer available.", 403 → "You don't have permission to do that.", gender mismatch → "This booking needs a different-gender therapist." Unknown errors fall through to the raw server message so we never lie about the failure mode | yes | `BookingRowActions.tsx` |
| R-6 | Structured `console.error("[bookings] quick action failed", { action, bookingId, error })` and the parallel claim variant | yes | `BookingRowActions.tsx` |
| R-7 | `catch (loadError)` with `console.error("[bookings] failed to load list", loadError)` before rendering the inline retry block | yes | `page.tsx` |
| R-8 | `pendingAction !== null` guard at the top of `runQuickAction` and `runClaim`; blocked call surfaces a polite toast | yes | `BookingRowActions.tsx` |
| R-9 | On open: `useEffect` focuses first `[role="menuitem"]:not([disabled])`. Escape close: ref'd `closedByEscape` flag returns focus to trigger. Click-outside leaves focus where the user clicked | yes | `BookingRowActions.tsx`, `BookingsChrome.tsx` |
| R-10 | `role="menuitem"` added to Send reminder, Mark paid, Mark complete, and Cancel triggers | yes | `BookingRowActions.tsx` |
| R-11 | Soft cap of 20 saved views, name length capped at 40 chars, "Save this view" disabled at limit with explanatory tooltip | yes | `admin-scalable-lists.tsx` |
| R-12 | Add **"Search to empty"** variant matching brief copy: heading "No bookings match that search", body "Check the name, phone, or ID and try again.", Ghost CTA "Clear search" (preserves all other filter params, clears `search` only) | yes (this step) | `page.tsx` |

---

## 3. Recommendations intentionally NOT applied (and why)

- **Pagination / Load more / virtualisation.** Brief Admin-Specific Patterns says introduce only when lists exceed ~50 rows in production. Current seeded data is below that; defer until needed.
- **RTL layout.** Admin operators are en-GB; the public site serves the Arabic-reading clientele. The admin will not be translated.
- **i18n / pluralisation framework.** Single-locale app (en-GB). Adding `Intl.PluralRules` for "1 person" vs "N people" is over-engineering at this scale.
- **Offline / service-worker.** Clinic Wi-Fi reality vs build cost. Not a Phase 6 commitment.
- **Optimistic UI updates with rollback.** Brief Open Question 4 recommends this for v2; v1 ships with `router.refresh()`-driven server reconciliation.
- **Auto-retry with exponential backoff.** Operator gets explicit "Try again" affordances on both the list-level error block and the row-action error toasts; silent retry would hide stale-state warnings the brief requires.

---

## 4. Brief States checklist (cross-check)

Mapped to the brief §6 Key States table and §10 Copy:

| State | Brief asks for | Implemented? |
|---|---|---|
| Default (bookings present) | List with cards + chrome | yes |
| REQUEST booking | Pending + Unassigned chips, Attention family | yes (page.tsx renders both badges) |
| Today tab, empty | "All caught up" / "Nothing scheduled for today. Quiet days are healthy days." | yes |
| Needs Attention, empty | "All caught up" / "No bookings need your attention right now." | yes |
| Upcoming, empty | "Nothing upcoming" / "No bookings scheduled beyond today." (+ "New booking" CTA for canViewAll) | yes |
| Claimable, empty (admin) | "Nothing to claim" / "No unassigned bookings right now." | yes |
| Claimable, empty (therapist) | "Nothing to claim" / "No unassigned bookings match your profile right now." | yes |
| Filtered to empty | "No bookings match" / "Try adjusting or clearing your filters." / Ghost "Clear filters" | yes |
| Search to empty | "No bookings match that search" / "Check the name, phone, or ID and try again." / Ghost "Clear search" | yes (added this step) |
| Filter bar open (mobile sheet) | `AdminSheet` from bottom + full form + "Apply filters" + "Clear" | yes |
| "More views" open | Dropdown of overflow tabs, keyboard nav, Escape close | yes + focus mgmt added |
| Saved view active | `aria-current` on pill, params pre-populated | yes |
| "Save this view" open | Inline name input + Save + Cancel | yes + length/limit guards |
| Loading (tab switch / filter apply) | `AdminSkeleton` rows approximating card height | yes (via Suspense + `BookingCardSkeletonList`) |
| Quick action in flight | Per-row spinner + `aria-busy` | yes |
| Quick action success | Sonner toast, Confirmed family, 4s auto-dismiss | yes |
| Quick action error | Persistent toast + (where applicable) Retry | yes (friendlyError + retry implicit via re-clicking) |
| Permission denied | `AdminAccessDenied` illustrated, "Back to dashboard" | yes |
| List load failure | Inline alert + "Try again" link (renders inside chrome) | yes |

---

## 5. Verification criteria (post-implementation)

- **60-character names:** `break-words` ensures wrap inside `min-w-0 flex-1` parent; no horizontal overflow at 375px.
- **Large numbers:** `Group · N` chip and `formatMoney` payment badge live inside `flex flex-wrap` so they wrap rather than overflow.
- **Empty lists:** every view + filtered + search empty has an illustrated `EmptyState` with brief copy and (where appropriate) a next-action CTA.
- **Error responses:** server errors map to friendly toasts (with raw fallback). List-level fetch failure renders an inline alert with a `Try again` Ghost link that re-runs the full query at the current URL.
