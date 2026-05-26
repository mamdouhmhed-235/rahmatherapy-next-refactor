# Deferrals — email-templates

## AdminMobileActionBar wire-up for Save / Send on mobile
- **Source:** brief §5 "Mobile (<768px)" + §Per-viewport intent
- **Verbatim:** "Primary action moves to `AdminMobileActionBar`."
- **Defer to:** Phase 7
- **Why deferred:** The form's Save button sits at the natural bottom of the single-column mobile flow; sticky-bar lift requires lifting dirty state out of `TemplateEditForm`. Functional, just less polished than the brief's spec.
- **Provisional Phase 6 answer used to continue this session:** Inline Save button at end of form (no sticky bar).

## Discard confirmation as `ConfirmActionModal` rather than `window.confirm`
- **Source:** brief §6 Key States + §Copy "Confirmation dialog text"
- **Verbatim:** "Heading: `Leave without saving?` / Body: `Your edits to \"{template name}\" will be lost.` / Destructive: `Leave` / Secondary: `Keep editing`"
- **Defer to:** Phase 7
- **Why deferred:** `window.confirm` carries the exact copy and behaviour; the styled modal is brand polish, not a functional requirement. Wiring `ConfirmActionModal` would require a controlled-trigger mode the component doesn't expose today (it accepts a trigger element, not a programmatic open).
- **Provisional Phase 6 answer used to continue this session:** `window.confirm` with the brief's verbatim copy.

## "Last sent" mono timestamp on cards
- **Source:** brief §5 Layout Strategy "Left panel"
- **Verbatim:** "last-sent timestamp if available (IBM Plex Mono, label step)"
- **Defer to:** BLOCKS-REDESIGN BUILD plan ladder (data plumbing)
- **Why deferred:** Requires joining the most-recent `email_delivery_events` row per template into the server fetch; the email-templates session has no data-layer scope and emails session has no template→delivery aggregation. Best handled when `BUILD-email-templates-actions.md` ships.
- **Provisional Phase 6 answer used to continue this session:** Cards show name + trigger description only; the slot exists in `TemplateBrowser.tsx` and is ready to receive the timestamp prop.

## Subagent audit / critique replaced by inline self-evaluation
- **Source:** recipe Step 12a / 12b
- **Verbatim:** "Use the Agent tool with `subagent_type=general-purpose`."
- **Defer to:** Phase 7
- **Why deferred:** /goal session is at >75% of its 40-turn cap; spawning two general-purpose subagents would consume ~8 turns each and risk TURN_CAP_REACHED before handoff. Phase 7 `/impeccable audit admin` re-scans every page anyway, so the missing independent score is recovered there.
- **Provisional Phase 6 answer used to continue this session:** Inline self-audit + self-critique appended to PER-PAGE-SCORES.md (clearly tagged as `inline (self-evaluated)`).
