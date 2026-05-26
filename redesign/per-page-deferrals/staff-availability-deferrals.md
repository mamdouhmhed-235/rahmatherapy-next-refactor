# Deferrals — staff-availability (Phase 6, after v2 polish)

The v2 polish pass resolved every v1 P1 deferral. Remaining items below are genuinely P2 / P3 — flagged for Phase 7 gauntlet or deferred greenfield additions.

## Working-day checkbox is a destructive shortcut without confirm
- **Source:** Step 12a v2 audit P2
- **Verbatim:** Working-day checkbox in Panel A is hard-coded `checked={true}` and un-check just deletes the rule. Functional but reads as a control rather than a destructive shortcut; users may not realise un-check = delete (no confirm).
- **Defer to:** Phase 7
- **Why deferred:** Either gate through `ConfirmActionModal` or relabel the control as "Remove this day"; the current behaviour matches the brief's "off-day toggle" semantics but the affordance reads as a non-destructive switch.
- **Provisional Phase 6 answer:** Toggle leaves explicit Trash button as the canonical delete path; checkbox provides a parallel shortcut.

## BookingGuardModal inlines destructive colour literals
- **Source:** Step 12a v2 audit P2
- **Verbatim:** BookingGuardModal hard-codes destructive bg `oklch(40%_0.14_25)` and scrim `oklch(12%_0.01_165)/35` inline instead of via family tokens or a shared modal primitive.
- **Defer to:** Phase 7
- **Why deferred:** The shared `ConfirmActionModal` doesn't support the controlled-open API this guard needs (it's trigger-driven). Lifting the API or wiring a new primitive lives in `00-shared-components`.

## Mobile bottom-nav overlap on lowest Panel CTA
- **Source:** Step 12b v2 critique (chrome carry-forward)
- **Verbatim:** Sticky mobile bottom-nav still overlaps the lowest Panel's CTA on 375.
- **Defer to:** Phase 7
- **Why deferred:** Out of scope (chrome lives in `00-shared-components`). The per-page `pb-16 md:pb-8` spacer mitigates but the underlying `pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]` in `AdminTopNav` is the right place to tune.

## No inline "closure vs override" disambiguation
- **Source:** Step 12b v2 critique
- **Verbatim:** Still no contextual help link for "What's the difference between a closure and an override?" — the one obvious novice question.
- **Defer to:** Phase 7 (or content team)
- **Why deferred:** Inline help link would benefit every page; better landed at the shell level (NavHelpButton or contextual `?` icon convention).

## Mode pill duplicates active segmented-control state
- **Source:** Step 12b v2 critique
- **Verbatim:** Mode pill ("Using global hours") sits to the left of the segmented control on desktop, redundant with the active button label.
- **Defer to:** Phase 7
- **Why deferred:** Removing the pill would break the brief's explicit "status-family pill rendered to the right of the segmented control" spec. Repositioning to inline with the subline is a minor visual decision worth discussing with the design owner.

## Bookings-guard count message lacks booking link-out
- **Source:** Step 12b v2 critique
- **Verbatim:** Bookings-guard alertdialog count message ("1 booking on …") doesn't list which booking(s) or link out — operators have to leave the page to verify before clicking "Block anyway".
- **Defer to:** Phase 7
- **Why deferred:** Would require a secondary query joining `bookings` → `clients` + a small list inside the modal; nice-to-have, not blocking.

## Dead conditional + raw avatar oklch
- **Source:** Step 12a v2 audit P3
- **Verbatim:** Dead `{hasSeed && rules.length > 0 ? null : null}` at `StaffAvailabilityRulesForm.tsx:264`; avatar bg uses raw `oklch(95.5%_0.012_155)` instead of a token at `page.tsx:200`.
- **Defer to:** Phase 7
- **Why deferred:** Trivial cleanup; doesn't affect runtime.

## Avatar real-photo support
- **Source:** Step 12a v2 audit + Brief §5 + Brief 26 reference
- **Verbatim:** Brief calls for "real photo or initialled Hover-Moss token"; current implementation is initials-only.
- **Defer to:** Phase 7 (or backend Phase)
- **Why deferred:** No `image_url` / `avatar_url` column exists on `staff_profiles` — including it in the select crashes the query (verified during this session). Needs a backend migration to add the column before the UI can light up.

## Improvement opportunities (not in brief)
The following were on the recommendation list but defer beyond Phase 6:

- **I5** Copy-schedule from another staff member — full new server action + UI.
- **I6** Recent-edits mini-log under each manager (last 3 changes).
- **I7** CSV export of upcoming closures + overrides.
- **I8** DayPicker / native-date polyfill for Safari — shared concern.
- **I9** Mobile sticky save bar (`AdminMobileActionBar`) — shared chrome.
- **I11** Keyboard shortcut hint (⌘S / Ctrl+S) — shared chrome.
- **I12** First-rule wizard for fresh custom-mode staff.
- **F6** React-19 `useOptimistic` for optimistic prepend (brief §6 spec).
- **F7 / B6** Row exit animation on delete (brief §6 spec).

— **Defer to:** Phase 7 (or Phase 8 extract). Each is greenfield scope, not a deviation from the brief's Phase 6 acceptance criteria.
