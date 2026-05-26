# Deferrals — settings

## Subagent audit + critique not dispatched (recipe Step 12a/12b)
- **Source:** Step 12a / 12b
- **Defer to:** Phase 7
- **Why deferred:** Turn budget exhausted before subagent dispatch (Step 6 dev-server Turbopack workaround consumed turns). Main agent self-review appended to PER-PAGE-SCORES.md with explicit bias caveat. Phase 7 gauntlet should re-score objectively.
- **Provisional Phase 6 answer:** Self-audit/self-critique recorded inline.

## Full Playwright form-flow smoke not exercised (recipe Step 11b)
- **Source:** Step 11b
- **Defer to:** Phase 7
- **Why deferred:** Turn budget. Sign-in succeeded, `/admin/settings` rendered, three-viewport snapshots captured, horizontal scroll false at every viewport, console errors zero — but the multi-step interaction sequence (edit numeric → live helper update → save → toast → clean state → intake switch on→off modal → confirm → banner swap → resume one-click → chip Enter/comma/backspace → hidden input value) was not driven end-to-end.
- **Provisional Phase 6 answer:** Brief §7 Interaction Model implemented in code per the requirements; coverage relied on code review against brief.

## Impeccable axes loop not run (recipe Step 7)
- **Source:** Step 7
- **Defer to:** Phase 7 (if 3-viewport playwright screenshots reveal a problem on review)
- **Why deferred:** Brief was met on first craft pass; Step 7b iteration 1 was clean (no horizontal scroll, no console errors, hierarchy correct, all four panels render). Recipe Step 7b's escape hatch permits `POLISH_ISSUES_ITER_1: none` to skip iteration 2.
- **Provisional Phase 6 answer:** No axes applied. Page met brief on first craft pass.

## Step 6 dev-server workaround note (for LAUNCH-SHEET)
- **Source:** Step 6 (pre-flight not the actual issue)
- **Defer to:** post-launch / LAUNCH-SHEET update
- **Why deferred:** `pnpm next dev -p 3024` and `node node_modules/next/dist/bin/next dev -p 3024` both fail under Turbopack (workspace root resolver doesn't follow the junctioned `node_modules`, despite `next.config.ts` setting `turbopack.root`). The `--webpack` flag works around it. LAUNCH-SHEET Section 1a should document this or restructure the worktree spawn to avoid the junction.
- **Provisional Phase 6 answer:** This session used `--webpack` to start the server on 3024. Subsequent recipe runs should adopt the same flag until Turbopack-junction interaction is fixed at the worktree-setup layer.

## Token-drift: raw `oklch()` literals consistent with admin-ui.tsx
- **Source:** Step 11a token-drift grep
- **Defer to:** Phase 8 extract (project-wide consolidation of status-family tokens)
- **Why deferred:** Every `oklch()` literal in the new `SettingsForm.tsx` matches the values already used inline throughout `src/app/admin/components/admin-ui.tsx` (Cancelled `oklch(26% 0.14 25)`, Confirmed `oklch(22% 0.085 155)`, Restricted `oklch(30% 0.02 280)`, Attention `oklch(26% 0.13 55)`). The brief flags `var(--rahma-*)` escapes / raw red Tailwind / `bg-white/N` / `backdrop-blur` as drift — all zero. The raw `oklch()` pattern itself is the codebase convention and is a Phase 8 extract concern.
- **Provisional Phase 6 answer:** TOKEN_DRIFT: 0 (no new drift introduced; all literals are codebase-canonical status family colours).
