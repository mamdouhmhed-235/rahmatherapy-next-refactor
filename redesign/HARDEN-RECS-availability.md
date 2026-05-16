# Harden recommendations — availability

Phase 6 production hardening audit, scoped to the four files in the recipe's edit list. Server actions in `src/app/admin/availability/actions.ts` are untouchable (RECON §5), so all hardening is client-side.

## Already covered

| State | Where it lives | Status |
|---|---|---|
| Working day toggled with end ≤ start | `AvailabilityRulesManager` client validate() | ✓ "End time has to be after start time." (brief copy) |
| Working day on with empty times | `AvailabilityRulesManager` client validate() | ✓ "Set opening and closing times, or toggle the day off." |
| Working-day toggle off → 160ms collapse + Restricted tint | DayRow `transition-[opacity...] duration-[var(--motion-duration-fast)] ease-gentle` | ✓ |
| Working-day toggle on → 160ms reveal + Confirmed tint | Same | ✓ |
| `revalidatePath('/admin/availability')` after every mutation | `actions.ts` (untouched) | ✓ |
| Coordinator denied | `DeniedSurface` (page.tsx) | ✓ generic copy + "Back to dashboard" |
| Therapist denied with "My availability" deep link | `DeniedSurface` | ✓ specific copy + Secondary `/admin/staff/{ownStaffId}/availability` |
| Empty closed-dates list | `BlockedDatesManager` | ✓ shared `EmptyState` component |
| Empty hour-adjustments list | `AvailabilityOverridesManager` | ✓ shared `EmptyState` component |
| Empty staff list | `StaffCapacityList` | ✓ shared `EmptyState` with "Add staff" CTA |
| Form-level errors announced | All three manager forms | ✓ `role="alert" aria-live="polite" aria-atomic="true"` |
| Required date inputs visually marked | `BlockedDatesManager`, `AvailabilityOverridesManager` | ✓ `<span aria-hidden="true">*</span>` Cancelled-family colour |
| Touch targets ≥44px on mobile | All Primary buttons (Save hours, Add closed date, Add adjustment) | ✓ `h-11` on mobile, `sm:h-10` on desktop; row delete buttons `size-11` |
| Switch keyboard accessible | `Switch` component handles Enter/Space | ✓ |
| Confirm modal on destructive deletes | `ConfirmActionModal` triggered from row trash button | ✓ for both closed dates and overrides |
| Save hours single submit despite N parallel server-action calls | `Promise.all` collects all 7 rule writes; field errors merged per-day | ✓ |
| No horizontal scroll at 375 / 768 / 1440 | Verified Playwright check | ✓ |
| Long staff names wrap | `AdminEntityRow` `min-w-0 flex-1` + `truncate` | ✓ |
| Past-date HTML input guard | `min={today}` on date inputs in both add-forms | ✓ partial — bypassable via devtools |

## Gaps to close (this session)

| # | State / scenario | Current behaviour | Brief-required behaviour | Fix |
|---|---|---|---|---|
| H1 | Duplicate `blocked_date` add | Server returns raw Postgres `duplicate key value violates unique constraint` | "That date is already closed. Edit or delete the existing entry." | Map error text in `BlockedDatesManager.handleSubmit` |
| H2 | Override on a closed weekly day | Server allows it silently | "That day is closed in the weekly schedule. Open it in Working hours before adding an adjustment." | Pass `initialRules` to `AvailabilityOverridesManager`, client-side check before POST |
| H3 | Override date in the past (devtools bypass) | Server allows it (no past-date check) | "Pick a date from today onwards." | Client check in `handleSubmit` before POST |
| H4 | Duplicate `override_date` | Server upserts (replaces) silently | "That date already has an adjustment. Delete the existing one first." | Map error if upsert returns conflict, OR check `overrides` client-side |
| H5 | Network failure on Save / Add / Delete | Generic toast | "Couldn't save the hours. Try again." / "Couldn't add the entry. Try again." / "Couldn't remove the entry. Try again." | Replace generic toast messages with brief copy |

## Out of scope (deferred to Phase 7 / Phase 8)

- **Server-side validation parity** — `actions.ts` is RECON §5 untouchable; the Phase 7 gauntlet may flag that several brief error messages must be defended at the server tier. Currently the client maps observed Postgres errors but the action itself doesn't return brief copy. Phase 7 may decide to either expand client mapping or amend the untouchable list.
- **Optimistic UI for delete** — current pattern is server-action → revalidate → re-render. Optimistic removal could be added but isn't in the brief.
- **Concurrent-edit protection** — two operators saving working hours simultaneously could race; not flagged in the brief.
- **i18n** — admin is English-only per `PRODUCT.md` (UK clinic, English-speaking team). RTL and translation expansion not in Phase 6 scope.

## Post-handoff operator-value enhancements (added after the initial Phase-6 closure)

A second pass on user feedback added six surgical enhancements on top of the brief. None modify shared primitives, untouchables, or the four canonical scope files' contracts. All are mobile-responsive and verified live at 375 / 768 / 1440.

| # | Addition | Where | Notes |
|---|---|---|---|
| E1 | "Copy Monday → Tue–Sat" Ghost button | `AvailabilityRulesManager.tsx` above the day-row grid | Eliminates the 12-input-edit penalty when setting six identical weekdays. Full-width on mobile, right-aligned at `sm:`. Toast "Copied Monday hours to Tue–Sat." |
| E2 | Resolved-week 7-day strip | `page.tsx` `CapacityPreview` | Strip now overlays this calendar week's closed_dates + availability_overrides on top of the recurring template. Closures render Restricted tint with date label; adjustments render Pending tint with override times. Tooltip includes reason text. |
| E3 | "Last saved by {actor} on {date}" trail | `page.tsx` (server query) + all 3 managers | Single audit_logs query for the latest row per target_type, joined to staff_profiles for the actor name. Rendered as small `text-xs text-muted` line under each manager panel description. |
| E4 | All-days-closed save guard | `AvailabilityRulesManager.tsx` | When every day is toggled off, the Save button is wrapped in `ConfirmActionModal` with destructive copy ("Save with the clinic closed every day?"). Cancel returns user to editor; confirm proceeds with the 7 parallel saves. |
| E5 | Closed-day-with-bookings mismatch guard | `BlockedDatesManager.tsx` + `page.tsx` `bookingsByDate` prefetch | Page server-fetches upcoming non-cancelled bookings grouped by date; client intercepts submit when chosen date has bookings and opens a controlled Base UI Dialog ("Block this date even though bookings exist? — N bookings will stay scheduled"). Inlined dialog matches `ConfirmActionModal` look; shared primitive not modified. |
| E6 | Dignified SVG empty-state illustrations | `public/images/admin/empty-states/{closed-dates,hour-adjustments,staff}.svg` + `illustrationSrc` wired in all 3 EmptyState usages | Replaces the Lucide-icon-in-circle fallback for the three empty states. 96×96 SVGs using DESIGN.md OKLCH tokens directly (status-confirmed-bg background, status-confirmed-text strokes, gold accent for plus-marks). |

**What this addresses from the existing audit/critique:**

- Lifts the **critique heuristic 7 "Flexibility & efficiency"** score (was 2/4 — "no copy-to-other-days pattern, no week-template").
- Resolves the **critique flagged finding** about the 7-day strip showing recurring rules even when the week's closure overrides them.
- Lifts the **critique heuristic 1 "Visibility of system status"** score by surfacing audit-trail visibility (was 3/4 — "no inline 'who changed this' signal").
- Addresses two **error-prevention gaps** the critique flagged at heuristic 5: no warning before all-days-closed save, no warning before blocking a date with bookings.
- Resolves the **critique "Disciplined warmth — partial"** observation that empty states used the Linear-vocabulary icon-in-circle pattern instead of DESIGN.md §5 dignified illustrations.

**What this does NOT change:**

Brief Feature Preservation Manifest intact. Six server actions still wired identically. All seven audit-log writes still fire. `revalidatePath('/admin/availability')` still runs after every mutation. Form field names (`rule_id`, `day_of_week`, `start_time`, `end_time`, `is_working_day`, `blocked_date`, `reason`, `override_date`) preserved verbatim on the FormData boundary. No `border-l-4`, no em dashes, no token drift. 44px touch targets preserved everywhere. The two P1 audit findings (tabpanel `aria-labelledby` references + tab arrow-key navigation) are still deferred to Phase 7 as before.

## Implementation order

1. H3 (past date) and H5 (network failure copy) — pure-client, no plumbing.
2. H1 (duplicate blocked_date) — single line of error-text mapping.
3. H2 (override on closed day) — requires passing `initialRules` from `page.tsx` to `AvailabilityOverridesManager` as a new prop.
4. H4 (duplicate override) — client-side existence check against existing `overrides` array.
