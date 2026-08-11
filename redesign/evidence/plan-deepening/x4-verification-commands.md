# X4 — Verification command set: ground truth, established live on this machine

**Slug:** `x4-verification-commands` · **Scope:** cross-cutting (whole plan) · **Date:** 2026-08-11
**Repo:** `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` · **Branch:** `master`
**Commands were actually run.** Every number below is real output from this machine, not a transcription from the plan. Where a command could not be run (credentials, or it would write outside the one file this audit is allowed to touch), that is stated explicitly and nothing is guessed.

---

## 1 — Toolchain, confirmed live

```
node --version        → v24.16.0
pnpm --version         → 10.17.1
npx tsc --version       → Version 5.9.3
npx vitest --version    → vitest/4.1.5 win32-x64 node-v24.16.0
npx playwright --version → Version 1.59.1
node -e "console.log(require('./node_modules/next/package.json').version)" → 16.2.4
```

All match `package.json` (`next@16.2.4`, `@playwright/test@^1.59.1`, `vitest@^4.1.5`, `typescript@^5`, `packageManager: pnpm@10.17.1`, `engines.node: 24.x`).

**Confirmed, not assumed:**
- `node_modules/@playwright/test/cli.js` **exists** (`Test-Path` → `True`).
- `node_modules/playwright/cli.js` **does NOT exist** (`Test-Path` → `False`).
This is exactly the gotcha the handoff names — the plan's own §7.9(b) command uses the wrong one (see §3 below).

---

## 2 — Each gate, exact command, real output, timing

### 2.1 `npx tsc --noEmit`

```bash
npx tsc --noEmit
```
- **Clean output:** none — silent, exit code `0`.
- **Ran it twice** (cold and warm): **~5.0–5.2s** both times (`00:00:05.19`, `00:00:04.87`). `tsconfig.json` has `"incremental": true`, but the warm run showed no material speedup here — treat ~5s as the working estimate either way.
- **Writes to the repo:** yes — `tsconfig.tsbuildinfo` at repo root, created/updated by every run. **It is gitignored** (`.gitignore:47` → `*.tsbuildinfo`), confirmed by `git status --porcelain -- tsconfig.tsbuildinfo` returning nothing. So it does not dirty `git status`, but it is a real file write an implementer should not be surprised by, and it must never be added to a commit.
- **Baseline it proves:** `0` (matches plan §8 exactly).

### 2.2 `npx vitest run` (full) and scoped variants

```bash
npx vitest run
```
- **Clean output (by identity):**
  ```
  Test Files  2 failed | 220 passed (222)
       Tests  5 failed | 2236 passed (2241)
  ```
  exactly:
  - `src/lib/auth/admin-access.test.ts` × 2 (`gives Owner broad access…`, `gives Admin broad operational access…`)
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx` × 3 (`renders step 1 on first load`, `moves focus to the first invalid field when continuing with errors`, `shows the consent error when trying to create booking without consent`)
- **First full run, timed:** `Duration 86.06s` (transform 33.61s / import 545.30s / tests 81.33s / environment 1111.75s — these sub-figures are cumulative across parallel workers, not wall-clock; wall-clock elapsed measured externally was **90.9s**).
- **Reproduced the documented flake, live, in this session.** A second full run (invoked moments later, to list `FAIL` lines) surfaced a **6th** failure — `ManualBookingForm.test.tsx > optional email > still rejects a malformed email, and stops rejecting it once cleared` — on top of the same 5. This is exactly the "1–2 extra `optional email` sub-tests intermittently time out under full-suite load" flake the handoff (§5 gotcha) and plan §8 describe. **Do not treat a 6th ManualBookingForm failure as a regression** if the other 5 are the documented ones and the extra one clears on isolation.
- **Isolation re-run, to prove the flake claim rather than trust it:**
  ```bash
  npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx
  ```
  → `Test Files 1 failed (1)` / `Tests 3 failed | 33 passed (36)` / `Duration 15.61s` — **exactly** the 3 baseline failures, every time, confirming the "isolation reproduces exactly 3" claim is true, not asserted.
  ```bash
  npx vitest run src/lib/auth/admin-access.test.ts
  ```
  → `Tests 2 failed | 4 passed (6)` / `Duration 1.04s` — exactly the 2 baseline failures.
- **Directory-scoped variant** (useful for items 3/6, which touch `src/app/admin/availability/**` and the staff-availability tree):
  ```bash
  npx vitest run src/app/admin/availability
  ```
  → `Test Files 6 passed (6)` / `Tests 62 passed (62)` / `Duration 2.96s`. Confirms both single-file and directory-path scoping work with this vitest version.
- **Writes to the repo:** none observed. `git status --porcelain -- src/ supabase/` was checked before and after every vitest invocation in this session and stayed at exactly ` M src/lib/maintenance.ts` throughout. No coverage directory is produced (no `--coverage` flag is used by any of the above).

### 2.3 `pnpm lint` (and scoping)

```bash
pnpm lint
```
- **Clean output (by identity):** `✖ 66 problems (59 errors, 7 warnings)`, in exactly:
  - `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx`
  - `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`
  (re-derived independently with `pnpm lint 2>&1 | grep -E "^\S.*\.(jsx|tsx|ts)$" | sort -u` — six distinct files, matching the plan exactly.)
- **Timed:** `24.87s`, exit code `1` (ESLint exits non-zero whenever any error — not just warning — is present; this is expected and is not itself a regression signal, the **file identity** is).
- **Can be scoped to a path without changing the baseline's meaning — confirmed:**
  ```bash
  pnpm lint src/app/admin/availability
  # → clean (no output beyond the pnpm banner), exit 0, ~few seconds
  pnpm lint src/app/admin/availability "src/app/admin/staff/[staffId]/availability"
  # → clean, exit 0, 4.78s
  ```
  The `lint` script is bare `"eslint"` in `package.json`, so `pnpm lint <path...>` passes the path(s) straight through to ESLint as positional globs, using the same `eslint.config.mjs` rules. **What "scoped, without changing the baseline's meaning" means precisely:** a scoped run tells you whether *the files you touched* are clean — it does **not** re-derive the repo-wide 59/7 baseline, and a scoped-clean result must never be reported as "lint gate passed." The full, unscoped `pnpm lint` must still be run before closing out a batch, specifically to re-confirm the six-file identity is unchanged (no new file joined the list, no old one dropped off silently).
  - Tried passing a Next.js dynamic-route directory (`[staffId]`) as a path argument to `pnpm lint` directly (not through a PowerShell path cmdlet): it worked unescaped and unquoted-vs-quoted made no difference, because PowerShell only wildcard-expands bracket paths for its **own** cmdlets (`Get-ChildItem`, `Test-Path`, etc.), not for arguments handed to an external command like `pnpm`/`eslint`. **No bracket-escaping gotcha here** — do not add one to the plan; it would be a false claim.
- **Writes to the repo:** none — no `--fix`, no `.eslintcache` produced (checked: none present after multiple runs).
- **`redesign/**` is fully excluded from lint** (`eslint.config.mjs`'s `globalIgnores` lists `"redesign/**"`), so this report file — and any other evidence written under `redesign/evidence/`— can never affect the lint baseline. This directly forecloses the exact failure mode the handoff's gotcha 14 describes (a prior agent's stray scratch files polluting the lint baseline) **for anything written under `redesign/`**; it does **not** protect stray files written anywhere else in the repo, which remains the real risk this audit's file-write rule guards against.

### 2.4 `node scripts/measure-admin-contrast.mjs .`

- **Flags, from source (not guessed):** positional arg 0 = root directory (default `.`); `--json` for machine output; `--theme=dark|light` to filter one theme; `--max-failures=N` — the **only** thing that changes `process.exitCode` (`1` if `results.length > N`, else `0`). **Without `--max-failures`, the script always exits `0` regardless of failure count** — confirmed by running it plain (456 failures, exit `0`) and then with `--max-failures=0` (exit `1`) and `--max-failures=456` (exit `0`, not shown above but follows the same `>` comparison). This is a real gotcha: **a bare `node scripts/measure-admin-contrast.mjs .` in a CI script will never fail the build on its own** — the guard test (§7.8/Step 0.4) or an explicit `--max-failures=` argument is what must gate a pipeline.
- **Does it write a file?** No — pure `console.log`/`process.stdout` (JSON mode) or human text. Nothing under `--json` or otherwise touches disk. Verified by reading the full script and by `git status` before/after.
- **Current reading, live, this session:**
  ```
  files scanned: 309
  tokens resolved: 92
  unresolved elements (class string could not be resolved statically): 239
  FAILURES (<4.5:1)  total 456   explicit-pair 76   assumed-surface 380
    dark 377 / light 79
  ```
  **Matches plan §7.4a exactly** (456 / 377 dark / 79 light / 76 explicit-pair / 380 assumed-surface / 239 unresolved).
- **Timed:** `0.86s` — effectively instant. Cheap enough to run after every single Phase A/B substitution batch.

### 2.5 `node scripts/verify-admin-token-contrast.mjs`

- **Flags:** same convention — `--json`, `--max-failures=N`; default `maxFailures = Infinity` so a bare run **always exits 0** regardless of failures (confirmed: plain run has 1 failure, exit `0`; `--max-failures=0` → exit `1`; `--max-failures=1` → exit `0`). Same gotcha as 2.4 applies.
- **Does it write a file?** No — `readFileSync(tokens.css)` only, `console.log` output. The file-level docstring is explicit: *"Analysis only. This script never edits tokens.css."*
- **Current reading, live, this session:**
  ```
  ratio-comment mismatches: 0
  pair AA failures:         1
  total failures:           1
  ```
  with the one failure listed as `3.41:1 < 4.5:1 [light] --admin-warning vs --admin-warning-bg` — **matches plan §7.5a exactly.**
- **Timed:** `0.36s` — instant.

### 2.6 `node scripts/measure-admin-bundles.mjs`

- **Flags:** **none at all** — `process.argv` is never read anywhere in the file. It is always `.next/`-in, full-JSON-to-stdout-out.
- **Does it write a file?** No — the whole file has zero `writeFileSync` calls; it ends in `process.stdout.write(JSON.stringify(result, null, 2) + "\n")`. Confirmed by grepping the full file.
- **Prerequisite, confirmed the hard way:** it needs `.next/build-manifest.json` and per-route `page_client-reference-manifest.js` files, i.e. a prior `pnpm build`. **This machine already has a `.next/` from an earlier build** (`build-manifest.json` mtime `2026-08-09T21:47:28.872Z`; `BUILD_ID` embeds the literal string `aca7c18`, which is a real commit — `git log --oneline -1 aca7c18` resolves to `docs(redesign): C-20, C-14, C-10 shipped — progress + master-plan checklist`). **This audit did NOT run `pnpm build`** (forbidden by the absolute rules) — the script was run read-only against that pre-existing, now-2-day-stale build artifact, purely to prove the script's mechanics; its numbers are **not** a fresh baseline and must not be quoted as one.
- **Confirms both of plan §5.2's claims, independently re-counted:**
  ```bash
  find .next/server/app -name "page_client-reference-manifest.js" | wc -l   # → 46
  ```
  matches "46 per-route client-reference manifests exist." And:
  ```bash
  find .next/server/app -name "page_client-reference-manifest.js" | grep -i "admin/bookings\|(public)/services\|(public)/home"
  ```
  returns `(public)/home`, `(public)/services`, `(public)/services/[slug]`, `admin/bookings/new`, `admin/bookings`, `admin/bookings/series/[templateId]`, `admin/bookings/[bookingId]` — all present in `.next/`, **none of them in the script's hardcoded `ROUTES` array** (which lists only `admin/dashboard`, `admin/reports`, `admin/clients/[clientId]`, `admin/staff/[staffId]`, `admin/me`, `admin/staff/[staffId]/performance` — confirmed by reading the file). This is exactly the gap item 5 exists to close.
- **Timed:** `<0.1s` against the existing `.next/` — trivial once a build exists; the cost is entirely the `pnpm build` that must precede it (not timed here, per the no-build rule).

### 2.7 The Playwright contrast sweep (`e2e/admin-contrast.spec.ts`)

**Not run to completion in this audit — by design, not oversight.** Running it for real performs actual `signInWithPassword` logins (harness-mediated, no credential ever touches this agent, which is allowed) **and writes evidence files to `redesign/evidence/admin-contrast/`**, which is outside the single file (`redesign/evidence/plan-deepening/x4-verification-commands.md`) this audit is permitted to write. So the mechanics below were verified without a live run:

- **`--list` (no login, no write, safe to run) — confirmed live:**
  ```bash
  node ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium --list
  ```
  →
  ```
  [chromium] › unauthenticated admin surfaces — login, password-reset (audited once, outside the role loop)
  [chromium] › INACTIVE — negative path only, not contrast-audited
  [chromium] › contrast sweep — OWNER
  [chromium] › contrast sweep — ADMIN
  [chromium] › contrast sweep — COORDINATOR
  [chromium] › contrast sweep — THERAPIST_A
  Total: 6 tests in 1 file
  ```
  **Matches plan §7.2b's "6 tests, 3.8 minutes" claim** (6 tests confirmed; timing not independently re-measured here since the full run was not executed). `git status --porcelain` was unchanged before/after `--list` (only the pre-existing standing-dirty entries from handoff §6 appeared) — `--list` itself writes nothing.
  Confirmed `test.use({ channel: "chrome" })` is pinned at line 93 of the spec, scoped to that file — matches handoff gotcha 4.
- **⛔ The plan's own documented command for this gate is wrong on this machine — a real drift, not a style nit.** Plan §7.9(b) says:
  ```bash
  node --env-file=.env.e2e ./node_modules/playwright/cli.js test e2e/admin-contrast.spec.ts
  ```
  Two independent problems, both reproduced:
  1. `.env.e2e` **does not exist** on this machine (`Test-Path` → `False`). Only `.env` exists (confirmed present, contents never read).
     ```
     node --env-file=.env.e2e -e "console.log('ok')"
     → C:\Program Files\nodejs\node.exe: .env.e2e: not found   (exit 9)
     ```
  2. `node_modules/playwright/cli.js` **does not exist** (§1 above) — only `node_modules/@playwright/test/cli.js` does.
  The **handoff's own §5 gotchas 2–3 already state the correct form**, and it is what actually works:
  ```bash
  node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
  ```
  **The deepened plan must replace §7.9(b)'s command with this one.** This is exactly the kind of "plan text is a claim, not a fact" drift the handoff warns about, caught by literally trying to run it.
- **The route-filter self-healing mechanism (commit `2903108`) was verified working, live, without touching Playwright or credentials at all** — `resolveRouteFilter` is a pure exported function in `e2e/admin-contrast-helpers.ts`. Ran it directly via Node's native TS support (`node --experimental-strip-types`) against a scratch script (kept outside the repo, in the session scratchpad):
  ```
  mangled input:      [ 'C:/Program Files/Git/admin/dashboard' ]
  resolved:            { matched: Set(1) { '/admin/dashboard' }, unmatched: [] }

  genuinely bad input: [ '/admin/does-not-exist' ]
  resolved:            { matched: Set(0) {}, unmatched: [ '/admin/does-not-exist' ] }

  clean input:         [ '/admin/dashboard' ]
  resolved:            { matched: Set(1) { '/admin/dashboard' }, unmatched: [] }
  ```
  This proves, independent of the commit message's own claims: (a) a Git-Bash-mangled `CONTRAST_ROUTES` value **does** recover via suffix match today, and (b) a genuinely bad route value **does** land in `unmatched`, which the spec's `beforeAll` turns into a hard failure (confirmed by reading `e2e/admin-contrast.spec.ts:98-108`) rather than a silent no-op. **This means `CONTRAST_ROUTES` specifically is self-healing against the Git Bash bug** — but nothing else in this plan's command set has that protection (see §3).
- **What the deepened plan must record about actually running it:** the full sweep is Owner/orchestrator work, not subagent work, for two independent reasons — it needs real credentials (which no agent may hold or type, only reference by prefix) and it writes to `redesign/evidence/admin-contrast/<role>-<theme>.md` (outside any read-only audit agent's single permitted write path). Any future deepening or execution agent given broader write permission must still be told explicitly which directory the spec writes to, so it isn't mistaken for a stray/scratch write.

---

## 3 — Git Bash argument mangling: reproduced, and the canonical fix

**Reproduced live, this session, unprompted by the handoff text — i.e. independently confirmed, not copied:**

```bash
CONTRAST_ROUTES=/admin/dashboard node -e "console.log(process.env.CONTRAST_ROUTES)"
→ C:/Program Files/Git/admin/dashboard
```

Three follow-up tests, to find the actual fix rather than assume one:

| Attempt | Command | Result |
|---|---|---|
| Quoting alone | `CONTRAST_ROUTES="/admin/dashboard" node -e "…"` | **Still mangled** — `C:/Program Files/Git/admin/dashboard`. Quoting is not the fix; this must be said explicitly because it is the first thing anyone tries. |
| Comma-joined list | `CONTRAST_ROUTES=/admin/dashboard,/admin/bookings node -e "…"` | **Only the first entry is mangled**: `C:/Program Files/Git/admin/dashboard,/admin/bookings`. Matches commit `2903108`'s own diagnosis exactly ("It only fired reliably on a lone leading-slash token"). |
| `MSYS_NO_PATHCONV=1` | `MSYS_NO_PATHCONV=1 CONTRAST_ROUTES=/admin/dashboard node -e "…"` | **Preserved exactly**: `/admin/dashboard`. This is the general-purpose fix. |
| Double leading slash | `CONTRAST_ROUTES=//admin/dashboard node -e "…"` | Preserved as `//admin/dashboard` (extra leading slash) — works only if the consumer normalises a double slash; **do not use this as the general answer**, it is Git-internals folklore, not a clean fix. |

### Canonical safe invocation

**PowerShell (preferred for any command carrying a route-like string as an argument or env var):** PowerShell has no leading-slash path-conversion behaviour at all — a plain assignment is safe as written:
```powershell
$env:CONTRAST_ROUTES = "/admin/dashboard,/admin/bookings"
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```
or inline for a single invocation:
```powershell
$env:CONTRAST_ROUTES = "/admin/dashboard"; node ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```

**Git Bash, if it must be used:** prefix with `MSYS_NO_PATHCONV=1`, confirmed above to preserve the value exactly:
```bash
MSYS_NO_PATHCONV=1 CONTRAST_ROUTES=/admin/dashboard,/admin/bookings \
  node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```

**Which to prefer:** **PowerShell.** It has no equivalent failure mode for this class of argument, it is the harness's stated primary shell, and `MSYS_NO_PATHCONV=1` is a per-invocation opt-out an implementer must remember every single time — one missed instance silently reproduces exactly the "audits nothing but passes" bug the handoff describes as a full debugging cycle. **Only `CONTRAST_ROUTES` itself is self-healing (§2.7) against a forgotten `MSYS_NO_PATHCONV`; no other route-like argument anywhere in this plan's command set (e.g. any future `curl http://localhost:3000/admin/...` invocation from Git Bash) has that protection**, and the handoff explicitly says the same class of bug hit `curl` output too. Treat every bare `/`-prefixed argument in Git Bash as suspect, full stop — do not rely on a particular script's defence.

---

## 4 — What each command writes into the repo, exactly

| Command | Writes? | Path | Tracked by git? |
|---|---|---|---|
| `npx tsc --noEmit` | **Yes** | `tsconfig.tsbuildinfo` (repo root) | No — gitignored (`.gitignore:47`) |
| `npx vitest run` (any scope) | No | — | — |
| `pnpm lint` (any scope) | No | — | — |
| `node scripts/measure-admin-contrast.mjs .` | No | — | — |
| `node scripts/verify-admin-token-contrast.mjs` | No | — | — |
| `node scripts/measure-admin-bundles.mjs` | No (stdout only) | — | — |
| `pnpm build` (item 5 only, not run in this audit) | **Yes** | `.next/**` (large tree) | No — `.gitignore` covers `.next/**` via the eslint ignore list's presence and Next's own convention; **verify `.gitignore` covers it before relying on this**, not independently re-checked in this pass beyond the eslint config |
| `e2e/admin-contrast.spec.ts` full run (not run here) | **Yes** | `redesign/evidence/admin-contrast/<role>-<theme>.md` (confirmed by reading `e2e/admin-contrast-helpers.ts:813-815`, `fs.mkdirSync` + `fs.writeFileSync`), plus Playwright's own `test-results/` and (on failure) `playwright-report/` | `redesign/evidence/**` — **tracked**, unlike `test-results/`. An implementer should `git add` the evidence files deliberately as part of the commit that reports the sweep result, per plan §7.12's suggested `docs(redesign): admin contrast evidence` commit; `test-results/`/`playwright-report/` are already in the standing-dirty untracked set per handoff §6 and should not be added. |

**Net effect for the "gates by identity" check (§8 of the plan):** `git status --porcelain -- src/ supabase/` stays clean under every gate command except the two that are supposed to leave evidence (`e2e/admin-contrast.spec.ts`'s full run, and `pnpm build` for item 5) — and neither of those touches `src/` or `supabase/`, so the plan's own scoped `git status` check is unaffected by any of them. `tsconfig.tsbuildinfo` at repo root is the one universal, silent, gitignored write every implementer will produce just by running the type-checker — worth a one-line mention in the plan so nobody mistakes it for stray output.

---

## 5 — SELECT-only verification: "no real emails were sent"

**Schema, confirmed live** (`information_schema.columns` for `email_delivery_events`): `id, booking_id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at, staff_id, scheduled_for, html_payload, text_payload, to_email, subject, metadata`.

**Baseline captured this session** (record this exact figure, or re-capture immediately before starting item 1 work):
```sql
SELECT count(*) AS total_rows, max(created_at) AS latest_row, now() AS server_now
FROM public.email_delivery_events;
```
→ `total_rows = 43`, `latest_row = 2026-07-29 09:56:19.288541+00`, `server_now = 2026-08-11 12:12:47.599387+00` (this audit's run). **43 is the pre-item-1 total; nothing has been written to this table since 2026-07-29.**

**Distribution, confirmed live** — supports plan §1.2's claim about `delivery_status`:
```sql
SELECT delivery_status, count(*) FROM public.email_delivery_events GROUP BY delivery_status ORDER BY 2 DESC;
```
→ **only `accepted` (43)** exists today. The plan is right to warn against hardcoding from this single observed value — there is no live `skipped`/`bounced`/etc. row to check the filter against, so the code must not assume `accepted` is the only value `sendTrackedEmail` can ever write.

**Bounded "did this run send anything" query** — run once to capture the run-window start (`v_run_start`), then again at the end:
```sql
-- capture immediately before starting item-1 development/testing:
SELECT now() AS run_start;   -- record this literal timestamp, e.g. 2026-08-11T12:12:47Z

-- after development/testing, run this with the recorded timestamp substituted:
SELECT count(*) AS rows_created_during_run,
       array_agg(DISTINCT event_type) AS event_types,
       array_agg(DISTINCT to_email) FILTER (WHERE to_email IS NOT NULL) AS recipients,
       array_agg(DISTINCT recipient_email) FILTER (WHERE recipient_email IS NOT NULL) AS recipient_emails_alt
FROM public.email_delivery_events
WHERE created_at > '2026-08-11T12:12:47Z'::timestamptz;
```
**Pass condition:** `rows_created_during_run = 0`. If it is non-zero, the second and third columns give the exact recipients — every one must be `*.example.test` (per rule 2's absolute stop) or the run is a hard failure, not a note. Because the mailer must be mocked throughout (plan §1.1/1.8), the expected passing value is always `0`, never "0 except test addresses" — a genuinely mocked test suite should not reach this table at all. Treat any non-zero count from a real dev/test session as a stop-and-report event, not something to explain away.

**Simpler equivalent using the captured baseline directly (no timestamp to remember):**
```sql
SELECT count(*) - 43 AS new_rows_since_this_audit
FROM public.email_delivery_events;
```
Valid only until another legitimate email is sent for an unrelated reason (e.g. a real booking confirmation) between now and when item 1 work starts — the explicit `now()`-at-start approach above is the one to actually put in the plan, this is only offered as a sanity spot-check.

---

## 6 — SELECT-only query sets: item 4 (indexes) and item 8 (schema)

### 6.1 Item 4 — `bookings` indexes, pre-apply state confirmed

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'bookings' ORDER BY indexname;
```
→ **confirmed exactly 3, matching plan §4.1 verbatim:**
```
bookings_client_status_completed_idx | CREATE INDEX ... ON public.bookings USING btree (client_id, status) WHERE (status = 'completed'::booking_status_type)
bookings_pkey                        | CREATE UNIQUE INDEX ... ON public.bookings USING btree (id)
idx_bookings_recurring_template      | CREATE INDEX ... ON public.bookings USING btree (recurring_template_id) WHERE (recurring_template_id IS NOT NULL)
```
```sql
SELECT count(*) FROM public.bookings;
```
→ **15** — matches the plan's "15 rows today" exactly.

**Post-apply verification** (run after the Owner-approved migration is applied by the orchestrator — this audit did not and must not run it):
```sql
-- Confirm the four new names exist, and nothing else silently changed:
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'bookings' ORDER BY indexname;
-- MUST return 7 rows: the pre-existing 3 above PLUS
-- bookings_date_time_id_idx, bookings_status_date_idx,
-- bookings_assignment_status_date_idx, bookings_client_id_idx.

-- Confirm no data changed (an index add must never move row count):
SELECT count(*) FROM public.bookings;   -- MUST still read 15 (or whatever it is at apply time)

-- Confirm each new index's definition matches the approved SQL exactly (paranoia check —
-- IF NOT EXISTS silently no-ops if a same-named index with a DIFFERENT definition already
-- existed, which would be a silent divergence from what was approved):
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='bookings'
  AND indexname IN ('bookings_date_time_id_idx','bookings_status_date_idx',
                     'bookings_assignment_status_date_idx','bookings_client_id_idx');
```

### 6.2 Item 8 — pre-state confirmed, and the post-apply query set

**Pre-state, confirmed live (record this exact snapshot before touching anything — this satisfies plan §8.9.G):**
```sql
SELECT id, allowed_cities FROM public.business_settings;
```
→ `{"id": 1, "allowed_cities": ["Luton", "Dunstable"]}` — **exactly 2 towns**, matching plan §8.2's "2 towns" claim precisely.

```sql
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%';
```
→ **`create_booking_request` only** — matches plan §8.2/§8.9.A's claim exactly. (This is the literal re-run the plan asks implementers to do before starting item 8 — confirmed it returns exactly one row today.)

```sql
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE qual ILIKE '%allowed_cities%' OR with_check ILIKE '%allowed_cities%';
```
→ **empty** — confirms "no RLS policy references `allowed_cities`" (plan §8.2).

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND column_name IN ('travel_fee','mileage_origin','free_travel_cities');
```
→ **empty** — none of item 8's new columns exist yet. Use this exact query, re-run after each phase, as the running proof of what has and hasn't landed.

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='recurring_booking_templates' ORDER BY ordinal_position;
```
→ 26 columns, confirmed **no money column of any kind** — supports plan §8.7's "stores the address … but no money whatsoever" claim.

```sql
SELECT p.name AS permission, r.name AS role
FROM public.permissions p
JOIN public.role_permissions rp ON rp.permission_id = p.id
JOIN public.roles r ON r.id = rp.role_id
WHERE p.name IN ('manage_settings','manage_role_templates')
ORDER BY p.name, r.name;
```
→ confirmed exactly: `manage_role_templates` → **Owner only**; `manage_settings` → **Admin, Owner**. This is the live proof behind plan §8.4's "confirmed live" claim about the permission precedent — re-verified independently here, not merely trusted from the plan text.

**Post-apply query set, phase by phase (run after each Owner-approved migration in item 8, in order):**

```sql
-- After Phase 1 (rename + origin + permission migrations):
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='business_settings' ORDER BY ordinal_position;
-- MUST show free_travel_cities (was allowed_cities) and mileage_origin; allowed_cities MUST be gone.

SELECT p.name, r.name FROM public.permissions p
JOIN public.role_permissions rp ON rp.permission_id=p.id
JOIN public.roles r ON r.id=rp.role_id
WHERE p.name = 'manage_travel_origin';
-- MUST return exactly one row: (manage_travel_origin, Owner). No other role.

-- After Phase 2 (gate removal — no schema change, verify behaviourally):
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%free_travel_cities%' OR prosrc ILIKE '%allowed_cities%';
-- Re-run this. create_booking_request should still appear (it now reads free_travel_cities
-- for the city-required check, per plan §8.5) but MUST NOT raise on out-of-zone. This SQL
-- proves presence, not behaviour — pair with the booking-schema.test.ts Manchester case (§8.5).

-- After Phase 3 (bookings.travel_fee):
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='bookings' AND column_name='travel_fee';
-- MUST be numeric, NOT NULL, default 0.

-- After Phase 4 (recurring_booking_templates.travel_fee):
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='recurring_booking_templates' AND column_name='travel_fee';
-- MUST be numeric, NOT NULL, default 0.

-- Money-path spot check, any phase after 3 (the single most important assertion in item 8,
-- per plan §8.9.C — this SQL form complements, does not replace, the unit test):
SELECT id, total_price, amount_due, travel_fee
FROM public.bookings
WHERE travel_fee <> 0
ORDER BY created_at DESC LIMIT 20;
-- Manually spot-check a handful: total_price MUST equal (service_price * participant_count) + travel_fee,
-- never (service_price + travel_fee) * participant_count. Cross-reference booking_items for the
-- service_price_snapshot and participant_count to do the arithmetic by hand.
```

**Rollback reference (schema only — no data is destroyed by any of item 8's additive changes):**
```sql
-- Phase 1:
ALTER TABLE public.business_settings RENAME COLUMN free_travel_cities TO allowed_cities;
ALTER TABLE public.business_settings DROP COLUMN mileage_origin;
DELETE FROM public.role_permissions WHERE permission_id = (SELECT id FROM public.permissions WHERE name='manage_travel_origin');
DELETE FROM public.permissions WHERE name = 'manage_travel_origin';
-- Phase 3:
ALTER TABLE public.bookings DROP COLUMN travel_fee;   -- only safe if no non-zero fee has been folded into total_price/amount_due; otherwise those columns are now wrong and must be corrected first
-- Phase 4:
ALTER TABLE public.recurring_booking_templates DROP COLUMN travel_fee;
```
**Caution embedded above and worth restating:** dropping `bookings.travel_fee` after real fees have been folded into `total_price`/`amount_due` does **not** un-fold them — the delta model (plan §8.6) means the money already moved. A rollback after real use requires reversing the deltas first, row by row, not just dropping the column. This must be in the plan's own rollback section for item 8, not left implicit.

---

## 7 — Copy-pasteable gate blocks

### 7.1 FULL gate run — before starting the plan, and before closing it out

**PowerShell (preferred):**
```powershell
git branch --show-current                                   # must-not-move: master
git log --oneline -1                                         # must-not-move: current HEAD or a descendant
git status --porcelain -- src/ supabase/                     # must-not-move: exactly ' M src/lib/maintenance.ts'

npx tsc --noEmit                                              # must-not-move: silent, exit 0
npx vitest run                                                # must-not-move: 5 failed / 2236 passed (2241), the 5 named in §8 of the plan
pnpm lint                                                      # must-not-move: 59 errors / 7 warnings, the 6 named files

# Item 7 only — instant, safe to include in every full run once item 7 is in flight:
node scripts/measure-admin-contrast.mjs .                      # MUST MOVE across item 7's phases: 456 -> lower -> 0
node scripts/verify-admin-token-contrast.mjs                   # MUST MOVE once: 1 -> 0 after Step 0.2, then stay 0

# Item 1 only — SELECT-only, run before starting and again before closing out:
# (paste the query from §5 above with the captured run_start timestamp)
```

**Git Bash equivalent** (only if PowerShell is genuinely unavailable — see §3 for why PowerShell is preferred):
```bash
git branch --show-current
git log --oneline -1
git status --porcelain -- src/ supabase/
npx tsc --noEmit
npx vitest run
pnpm lint
node scripts/measure-admin-contrast.mjs .
node scripts/verify-admin-token-contrast.mjs
```
(None of the full-gate commands carry a route-like argument, so the Git Bash mangling risk in §3 does not apply to this block specifically — it applies to the Playwright sweep's `CONTRAST_ROUTES` and to any ad hoc `curl`.)

**What "must not move" means precisely for this plan:** the *totals* AND the *identity* of failures must match. A tsc count that stays 0 but starts failing on a different file, or a vitest 5/2236 that swaps in a new failing test in place of one of the three named `ManualBookingForm` cases, is a **FAIL**, per plan §1 rule 8. Do not just diff totals.

### 7.2 FAST gate run — between batches, while iterating on one item

```powershell
npx tsc --noEmit
npx vitest run <path-to-touched-files-or-directory>
pnpm lint <path-to-touched-files-or-directory>

# Item 7 batches only — always cheap, always worth running:
node scripts/measure-admin-contrast.mjs .
node scripts/verify-admin-token-contrast.mjs
```
**This is not a substitute for §7.1.** A scoped vitest/lint pass proves the files you touched are locally clean; it cannot prove you didn't break something elsewhere (a shared type, an import cycle, a second consumer of a renamed symbol). **Run the FULL block from §7.1 before calling any item done**, not just the fast one.

---

## 8 — Answers to the specific questions asked

1. **Toolchain, confirmed:** Node `v24.16.0`, pnpm `10.17.1`, Next `16.2.4`, TypeScript `5.9.3`, vitest `4.1.5`, `@playwright/test` `1.59.1`.
2. **Exact commands, clean output, timing:** all given in §2, with real numbers, not the plan's transcribed numbers — and every number matched the plan's claims exactly except where noted (the `.env.e2e`/`playwright/cli.js` drift in §2.7, and the "always exits 0 without `--max-failures`" behaviour of both contrast scripts, which the plan doesn't currently state and should).
3. **Git Bash mangling:** reproduced live (§3); quoting does **not** fix it (tested and disproved); `MSYS_NO_PATHCONV=1` does; PowerShell is immune and is the preferred shell for this reason; `CONTRAST_ROUTES` specifically self-heals via commit `2903108`'s suffix-match (verified live, independent of the commit message), but nothing else in this command set has that protection.
4. **Repo writes:** `npx tsc --noEmit` writes a gitignored `tsconfig.tsbuildinfo`; the full Playwright sweep writes tracked evidence files under `redesign/evidence/admin-contrast/` plus untracked `test-results/`; `pnpm build` (item 5 only) populates `.next/`; every other gate command writes nothing (§4, all independently confirmed by `git status` before/after).
5. **Email verification SQL:** given in §5, SELECT-only, bounded by a captured `now()` timestamp, with the live baseline (`43` rows, latest `2026-07-29`) recorded so a future run has a concrete starting point.
6. **Item 4 / item 8 SELECT sets:** given in full in §6, against confirmed live pre-state (3 indexes on `bookings`, 15 rows; `business_settings.allowed_cities = ["Luton","Dunstable"]`; only `create_booking_request` references it; no RLS policy does; none of item 8's new columns exist yet).
7. **Full/fast gate blocks:** given in §7, copy-pasteable, PowerShell-first with a Git Bash fallback.
