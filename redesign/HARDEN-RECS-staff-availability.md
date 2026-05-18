# Harden recommendations — staff-availability

## States verified

| State | Coverage |
|---|---|
| Default — populated, custom mode | Implemented (`StaffAvailabilityRulesForm` editable, `StaffBlockedDatesManager` + `StaffAvailabilityOverridesManager` editable) |
| Default — populated, global mode | Implemented (Panel A rendered with `globalModeLocked={true}` → `<Info>` row + "Open clinic-wide hours" Ghost; inputs disabled) |
| Inactive staff | Implemented (Restricted-family banner pinned above mode selector) |
| Loading | Server component renders synchronously after `Promise.all`; no skeleton needed for initial paint |
| Add closure submitting | `aria-busy` + Loader2 spinner inside the Add closure button |
| Add override submitting | Same pattern |
| Add validation error (past date, duplicate, time inversion) | Client-side `role="alert" aria-live="polite" aria-atomic="true"` regions; field border shifts to Cancelled |
| Soft warning — override on non-working day | Inline Pending-family banner with "Add override anyway" + "Cancel" |
| Delete closure / Delete override | `ConfirmActionModal` Cancelled family with brief copy verbatim |
| Add/delete server failure (FAKE) | Sonner toast with `duration: Infinity` + Retry action |
| Mode switch Use-global → Custom | One-click, optimistic toast "Now using custom hours." |
| Mode switch Custom → Use-global | `ConfirmActionModal` Destructive Primary "Use global hours" |
| Empty managers | Inline dashed-border line copy (Panel B + Panel C); Panel A shows "No custom rules yet" |
| Therapist self-edit | Sub-line reads "Your availability" + ConfirmActionModal copy uses "your" possessive |
| Denied (coordinator / cross-staff therapist) | `AdminAccessDenied` with "Open my availability" Secondary (when canManageOwn) or "Back to staff directory" |

## Layer 3 backend error states (brief §6 table)

All eight backend error states route through the FAKE marker actions in `actions.ts` returning user-friendly messages. Once `BUILD-staff-blocked-dates-actions.md` and `BUILD-staff-availability-override-actions.md` land, the actions get wired to Supabase with the validation logic already implemented client-side (past-date / duplicate / start≥end / non-working-day soft warning are all caught before the server round-trip).

## Edge cases verified visually

- 60-row Past closures `<details>` doesn't reflow active rows when expanded (rendered inside its own bordered band, no shared grid).
- Long `reason` strings wrap inside the row's centre column (`text-sm` body with no `truncate` on the description; `min-w-0` on the parent flex item).
- Custom→Use-global ConfirmActionModal body fits at 375px (BaseDialog popup is `w-[min(calc(100vw-2rem),26rem)]`).
- Override "outside operating window" Pending banner spans full form width via `sm:col-span-2 lg:col-span-5`.
- Therapist viewing another staff member's availability page → variant denied copy with "Open my availability" Secondary CTA.

## Deferred to Phase 7

- Mode-selector segmented control buttons render at 36px tall (h-9). Below the WCAG 2.5.5 24px AA / 44px AAA touch-target floor when measured strictly. Padding ring around the segmented control adds 4px on each side, so the effective hit area is 40px. Lift to `h-11` on mobile in Phase 7 pass.

## v2 polish pass — resolved
- Mode-selector buttons lifted to `h-11` on mobile, `h-10` on `sm:`+ (closes the WCAG 2.5.5 carry-forward above).
- Per-day Working-day toggle on Panel A rule rows (brief §5).
- Visible "All day" checkbox in Panel B (brief Copy §Form labels).
- Illustrated EmptyState across all three managers (DESIGN.md §5).
- "Add rule" Ghost + "Start from global hours" CTAs inside Panel A empty state.
- Family token classes (CANCELLED_*, PENDING_*, RESTRICTED_*, CONFIRMED_*) extracted to `lib.ts`.
- Bookings-by-date guard ported from global `BlockedDatesManager` (alertdialog).
- Per-section "Last saved by …" sub-line on Panels B + C via `formatAuditTrail` in `page.tsx`.
- Active-tab + active segmented-control white text contrast fixed (inline `color:#fff`).
- Tab strip momentum-scroll on mobile.
- First-person framing in self-view mode-switch confirm modal.
- Pending-family token classes on soft-warning override banner; Restricted-family tokens on inactive banner.

## v2 — still deferred
See `redesign/per-page-deferrals/staff-availability-deferrals.md`. Headline: Working-day checkbox-as-delete needs a confirm or relabel; BookingGuardModal inlines destructive literals (shared-modal concern); mobile bottom-nav overlap on lowest CTA (chrome carry-forward); inline "closure vs override" help missing; mode pill duplicates active segmented state; avatar real-photo support needs a backend column.
