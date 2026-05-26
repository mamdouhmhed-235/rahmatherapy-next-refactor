# HARDEN recommendations — settings

Phase 6 harden pass for `/admin/settings`. State coverage audited against brief §6 (Key States) and §7 (Interaction Model).

## States implemented in `SettingsForm.tsx`

- **Default; populated.** All four panels rendered. Save bar idle (no Discard button when `!isDirty`).
- **Dirty.** `isDirty` recomputed every render from controlled state vs `initial` snapshot. Discard Ghost appears; `beforeunload` listener attaches.
- **Loading initial.** Page is server-rendered with `settings ?? fallbackSettings`; no separate skeleton needed (first paint already shows the form).
- **Submitting.** `isPending` from `useTransition` disables every input + the save button; spinner replaces Save icon; button gets `aria-busy="true"`.
- **Submission success.** Sonner Confirmed toast "Settings saved."; `setState({})` clears errors; `router.refresh()` re-reads server state; dirty flag re-derives to false.
- **Validation error (field-level).** `state.fieldErrors?.<name>` → red Cancelled-coloured per-field error in `role="alert" aria-live="polite" aria-atomic="true"` region; input border shifts to Cancelled colour; `aria-invalid="true"`.
- **Validation error (form-level).** `state.error` → Cancelled-family banner with `XCircle` icon at form top, `role="alert"` + `aria-live="polite"` + `aria-atomic="true"`.
- **Intake toggle off → on.** One-click. Switch flips, Confirmed toast "Intake reopened. The public booking page is accepting requests."
- **Intake toggle on → off.** `BaseDialog.Root` opens (controlled via `pauseModalOpen` state); destructive primary "Pause intake" + secondary "Cancel"; on confirm, switch flips, Confirmed toast "Intake paused. Customer-facing booking page is now closed."
- **Intake currently off banner.** `IntakeStateBanner` reads `intakeOn`; Restricted-family pill + Lock icon + "Intake paused" copy.
- **Allowed cities empty.** `cities.length === 0` → Attention-family inline one-liner above chip input (NOT a full `EmptyState`).
- **Last-changed sub-line.** `lastChange` prop optional; renders when present, silently omitted otherwise per brief §6 (graceful degradation per BUILD-settings-last-changed-by.md non-blocking).
- **Concurrent edit conflict.** If server returns `state.error` matching the concurrent-edit pattern, the Cancelled banner displays the server message verbatim. (Brief Copy section provides the canonical string; server is authoritative.)
- **Required `*` markers.** Cancelled text colour, `aria-hidden="true"`, on `company_name` and all four numeric fields (per recipe P0 carry-forward).
- **Chip input keyboard.** Enter / comma adds; backspace on empty input removes last chip; click `x` removes specific chip.
- **Numeric helper live-binding.** Every numeric input updates its sibling helper string within the same React render tick via controlled state.
- **`beforeunload`.** Native UA prompt attached when dirty; detached on save success or discard.

## Verification surface checked

- 1440 × 900 / 768 × 1024 / 375 × 812 playwright snapshots saved to `redesign/screenshots/settings-redesign/settings-final-{1440,768,375}.png`.
- Horizontal scroll check on tablet + mobile both reported `overflow: false`.
- Console error count post-load: 0.

## Deferred to Phase 7

- Full impeccable axes iteration (`bolder` / `quieter` / `delight` etc.) — page met brief on first pass; no axis-relevant problems surfaced during 3-viewport visual audit. Phase 7 may re-evaluate.
- Subagent audit + critique scoring (recipe Step 12a/12b) — deferred for turn-budget reasons; main agent's self-review is recorded in `redesign/PER-PAGE-SCORES.md` under `## settings — audit` and `## settings — critique` with explicit caveat.
- Full Playwright form-flow smoke test (dirty → save toast, switch on→off modal flow, chip-input keyboard interactions, beforeunload) — recipe Step 11b items not exercised end-to-end due to turn budget; relied on code review against brief §7 Interaction Model.
