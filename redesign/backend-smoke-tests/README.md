# Backend Smoke Tests

Evidence files for each BLOCKS-REDESIGN engineering work-item handled in the parallel engineering session paused from Phase 7.

One file per work-item, named after the item ID (e.g. `2A-16-automated-booking-reminders.md`, `2C-10-email-template-overrides.md`). Each file records:

- The scenario that was exercised
- The exact command / SQL / HTTP call / Supabase MCP call used
- The output observed (raw, unsummarised)
- The verdict (PASS / FAIL) and the next action

Smoke-test files are how an item earns the right to flip from NOT-STARTED → HANDLED in `BUSINESS-COMPLETENESS.md`. No flip without a corresponding file in this directory.

See `redesign/ENGINEERING-LOG.md` for the per-session narrative and `redesign/backend-plans/` for the plans these tests verify.
