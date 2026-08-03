# SUBAGENT RULES — the one-page contract for every dispatched worker

You are an implementer, verifier, or reviewer subagent in the Band C programme. Read THIS page + your dispatch + your assigned plan/brief sections — you do NOT need the full execution protocol (that governs the orchestrator). If your dispatch conflicts with this page, or reality contradicts your assigned plan text: STOP, return to the orchestrator with the contradiction stated verbatim. Never improvise around it.

## Absolute prohibitions (violations are run-ending)

1. **Zone-2 actions — NEVER.** No `mcp__supabase__apply_migration`; no INSERT/UPDATE/DELETE/DDL via `execute_sql` (SELECT-only, verification purposes); no production env changes; no external-console actions; no `wrangler`/production deploys; no package installs (`pnpm add/install <pkg>`, `npx` fetching anything not in the lockfile — `npx tsc --noEmit` is fine); no writes to `auth.users`; nothing through ANY path (cron route, admin UI via Playwright, curl) that sends a real email to a recipient outside `*.example.test`. On reaching such a step: halt, return.
2. **Git:** never push. Never `git add .`/`-A`. Never stash/restore/checkout/switch to "clean" the tree — it is intentionally dirty. Stage explicitly by path, only files in your assignment. Verifiers/reviewers: git `log`/`diff`/`show`/`status` ONLY.
3. **Never touch:** `src/lib/maintenance.ts` (Owner-owned uncommitted change); `redesign/audits/**`; `C-B-DECISIONS.md`; booking `9d55ce2a` (real customer); the Owner account `rahmatherapy@outlook.com` in email-test paths; any client whose email isn't `*.example.test` or name isn't `Phase10*`/`Audit Test*`; RECON §5 untouchables (`reporting.ts` core exports, `dashboard-helpers.ts`, RBAC matrix, middleware, build configs) beyond your plan's explicit exceptions.
4. **Files — two cases only:** (a) unrelated issue you noticed, not needed by your steps → note it in your return summary, do not fix; (b) a change OUTSIDE your assigned files that IS required for your steps to work → halt, return. Never quietly widen scope.
5. **Never claim a check you didn't run.** If a check can't run, say so in your return.

## Implementation discipline

6. Implement steps EXACTLY as written; run each step's inline verification before the next. VERIFY-ALREADY-IMPLEMENTED wrappers: run the verification; never re-implement the preserved text.
7. **Shared surfaces** (`ManualBookingForm.tsx`, `notifications.ts`, `wrangler.jsonc`/`worker-entrypoint.ts`, `admin/bookings/page.tsx`, `templates-data.ts`): re-run your anchor greps first; re-locate by symbol, never stale line numbers.
8. **Code rules:** no `border-l-4`; honour `prefers-reduced-motion`; `updateTag(tag)` not `revalidateTag`; `createSupabaseAdminClient()` only after `getStaffProfile()`; never pass `Set`/`Map`/`Date` through `unstable_cache` (JSON-safe only); mobile-first (clean at 375px); match each file's existing style; tests accompany code per your steps.
9. **Baselines are BY IDENTITY:** compare lint/vitest failures against the inherited list in your dispatch — same totals with a swapped-in new failure is a FAIL. Never diff against baseline numbers hardcoded in plan text.
10. **Credentials:** use exactly the login table in your dispatch; never invent accounts; never enter credentials outside the documented test logins.
11. **Commits** (when your dispatch says you commit): `feat(redesign): <PLAN-ID> <phase/step summary>` per the plan's cadence table; one coherent unit per commit; never batch phases.
12. **Return summary (always):** files touched, commit SHAs, verification outputs, deviations (must be none) or the exact blocker; the model you ran as, if known. Evidence = file:line / SHA you verified yourself.
