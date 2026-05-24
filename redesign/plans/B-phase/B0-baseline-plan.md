# Plan: B-0 — Baseline capture (NEW)

**Brief:** none (no UI; capture-only)
**Effort:** ~0.5 day (half-day max)
**Prerequisites:** none — this IS the prerequisite for everything else
**Gates:** B-1, B-2, B-3, B-4, B-5, B-6
**Safety label:** READ-ONLY (mostly) + 1 Zone-2 (auth row creation for fresh test account)
**Blocks redesign:** YES — without baseline, "delta vs baseline" assertions in later phases are unenforceable

---

## What this is

A short capture phase that runs BEFORE B-1 implementation begins. Records the current state of the application against which every subsequent Band B phase's verification gates compare:

1. Bundle baseline for the surfaces that B-1, B-4, B-5 will modify.
2. Visual baseline (skeleton + populated states) for the surfaces that change.
3. Sentry baseline for any new instrumentation to compare against.
4. WCAG contrast verification on the proposed severity-strong tokens before they ship in B-1.
5. Fresh test account creation (Zone-2) for B-5 Therapist fullness verification.
6. Per-phase progress scratchpads.

## Why it's needed

Without B-0:
- "Bundle delta ≤ +12kB" is unenforceable (no number to compare to).
- "Shimmer replaces pulse" can't be visually diffed.
- The Therapist fullness pass can't be verified against a truly-empty state (no fresh account exists).
- B-1's proposed severity-strong OKLCH tokens might fail WCAG 4.5:1; better to find out before they ship as the standard.

## Who can do it

Any implementer. Most steps are read-only. Step 5 (auth row creation) requires Zone-2 user authorisation.

## What can go wrong

- **Bundle baseline measurement drift**: `pnpm build` output varies slightly between machines / Node versions. Record on the same machine that will run B-1 → B-6 builds.
- **Sentry baseline includes flaky errors**: Sentry might show pre-existing intermittent errors not caused by Band B. Record them so subsequent phases can distinguish baseline-noise from regression.
- **WCAG check too strict**: 4.5:1 is AA standard for body text; AAA is 7:1. Lock at AA to avoid over-engineering.
- **Fresh test account auth flow**: creating a user requires INSERT into `auth.users` + linked `staff_profiles` row + role assignment. Use Supabase admin client (service_role) via MCP, not raw SQL on `auth.*`.

## How to verify it works

After B-0 completes:
- `redesign/per-page-progress/B0-progress.md` exists with all 6 steps logged.
- `redesign/baselines/bundle-pre-B1.json` exists with first-load JS sizes for `/admin/dashboard` and `/admin/reports`.
- `redesign/baselines/screenshots-pre-B1/` directory has 3-viewport screenshots of dashboard + reports + clients/[clientId] + any active skeleton states.
- `redesign/baselines/sentry-baseline.txt` records active issue counts + URLs.
- `redesign/baselines/wcag-severity-tokens.md` records contrast ratios for each proposed token.
- `test.therapist.fresh@rahmatherapy.example.test` exists in `auth.users` AND `staff_profiles` with zero bookings/assignments.
- 7 template files exist in `redesign/per-page-progress/B[0-6]-progress.md`.

## Safe implementation order

### Step 1 — Bundle baseline
- Run `pnpm build` on a clean checkout of `redesign/start-state`.
- Extract `.next/build-manifest.json` first-load JS for:
  - `/admin/dashboard`
  - `/admin/reports`
  - `/admin/clients/[clientId]` (existing page; B-6 adds ribbon)
  - `/admin/me` (does not exist yet; record as "N/A baseline")
  - `/admin/staff/[staffId]` (existing; B-3 modifies)
- Write `redesign/baselines/bundle-pre-B1.json`:
  ```json
  {
    "captured_at": "2026-05-22T...",
    "node_version": "...",
    "pnpm_version": "...",
    "git_sha": "20aba4b",
    "first_load_js_kb": {
      "/admin/dashboard": 247,
      "/admin/reports": 312,
      "/admin/clients/[clientId]": 198,
      "/admin/staff/[staffId]": 142
    }
  }
  ```
- **Verify:** file written; numbers logged.

### Step 2 — Visual baseline (screenshots)
- Spin up `pnpm dev`. Sign in as Owner.
- Capture screenshots at 375 / 768 / 1280 / 1440 for:
  - `/admin/dashboard` (populated + skeleton state during load — use Network throttle "Slow 3G" to capture skeleton)
  - `/admin/reports` (same)
  - `/admin/clients/[clientId]` for a known client (same)
- Save to `redesign/baselines/screenshots-pre-B1/{viewport}/{page}-{state}.png`.
- **Verify:** ~24 screenshots captured (4 viewports × 3 pages × 2 states).

### Step 3 — Sentry baseline
- Sign in to Sentry dashboard for the Rahma project.
- Filter to last 7 days; capture:
  - Active issue count
  - Top 10 issues by frequency
  - List of any "release: redesign-start-state" tagged events
- Save to `redesign/baselines/sentry-baseline.txt` (plain text; no PII / no stacktraces of users).
- **Verify:** file written; counts logged.

### Step 4 — WCAG contrast verification for severity-strong tokens
- Per `SHARED-IMPLEMENTATION-NOTES.md` §3 + audit G3.
- Compute contrast ratio of each proposed token against intended text colour:
  - `--admin-danger-bg-strong` (`oklch(92% 0.075 20)`) vs `--admin-danger-text` (lookup in tokens.css)
  - `--admin-warning-bg-strong` (`oklch(93% 0.085 70)`) vs `--admin-warning-text`
  - `--admin-success-bg-strong` (`oklch(93% 0.060 155)`) vs `--admin-success-text`
- Use any contrast-checker that handles OKLCH (e.g. https://oklch.com/ or convert to sRGB first via `culori`).
- Pass criterion: ≥ 4.5:1 AA for body text.
- Save to `redesign/baselines/wcag-severity-tokens.md`:
  ```markdown
  | Token | Background OKLCH | Text token | Text OKLCH | Contrast ratio | Pass AA? |
  |---|---|---|---|---|---|
  | --admin-danger-bg-strong | oklch(92% 0.075 20) | --admin-danger-text | oklch(28% 0.13 25) | 6.4 | YES |
  ...
  ```
- **If any fail (per AUDIT M8 — explicit pause behaviour):**
  1. Record the failing token's actual contrast ratio in `wcag-severity-tokens.md`.
  2. B-0 commits as a "partial baseline" (mark in commit message: `chore(admin): B-0 — baseline capture (WCAG tokens FAILED — see baseline file)`).
  3. B-1 cannot start until the user authorises a token-adjustment step. Adjustment options:
     - Increase lightness: `oklch(92% ... 20)` → `oklch(95% ... 20)` typically lifts contrast ~1.5:1.
     - Decrease chroma: `oklch(92% 0.075 20)` → `oklch(92% 0.05 20)` makes the colour less saturated (often raises contrast).
     - Swap to a different hue family entirely (last resort).
  4. Re-verify post-adjustment in B-1 step 1 (before tokens land).
- **Verify:** all 3 tokens documented; all 3 pass AA OR adjustment authorisation logged.

### Step 5 — Fresh test account (Zone-2) — per AUDIT H2 — clarified method
- Per `SHARED-IMPLEMENTATION-NOTES.md` §13.
- **Request Zone-2 confirmation from user** before any auth-table write.
- **CRITICAL (per AUDIT H2):** direct `INSERT INTO auth.users` with raw `crypt()` does NOT produce a Supabase-compatible password hash. Supabase Auth uses bcrypt via its own JS SDK admin API. There are 3 valid creation paths:
  1. **Recommended — Supabase Studio UI** (manual; matches Zone-2 confirmation flow):
     - Open Supabase Dashboard → Authentication → Users → "Add user" button
     - Email: `test.therapist.fresh@rahmatherapy.example.test`
     - Password: `TherapistFresh123!`
     - Auto-confirm: yes
     - Submit. The user is created; auth.users gets the row; password is bcrypt-hashed by Supabase Auth.
  2. **Alternative — Node script** (if the user wants reproducibility):
     ```ts
     // scripts/create-fresh-therapist.ts — run once, committed but never auto-run
     import { createClient } from "@supabase/supabase-js";
     const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
     const { data, error } = await admin.auth.admin.createUser({
       email: "test.therapist.fresh@rahmatherapy.example.test",
       password: "TherapistFresh123!",
       email_confirm: true,
     });
     console.log(data, error);
     ```
     Run: `pnpm tsx scripts/create-fresh-therapist.ts`. Capture user ID for the next step.
  3. **NOT recommended — raw SQL via MCP:** `auth.encrypted_password()` exists in some Supabase versions but is not stable API. Avoid.
- After auth.users row exists, create the linked `staff_profiles` row via `mcp__supabase__execute_sql`:
  ```sql
  INSERT INTO public.staff_profiles (
    auth_user_id, name, gender, active, can_take_bookings,
    availability_mode, role_id
  ) VALUES (
    '<the-new-auth-user-uuid>',
    'Test Therapist Fresh', 'female', true, true, 'custom',
    (SELECT id FROM public.roles WHERE name = 'therapist' LIMIT 1)
  );
  ```
- Verify by signing in with the new credentials in `pnpm dev` (manual; takes 30s).
- Confirm `/admin/dashboard` renders the Therapist variant with zero data.
- Document credentials + auth_user_id in `redesign/per-page-progress/B0-baseline-progress.md`.
- Update HANDOFF §4.2 credentials section.
- **Verify:** sign-in works; dashboard renders empty Therapist variant; no errors.

### Step 6 — Per-phase progress templates
- Create `redesign/per-page-progress/B0-progress.md` (this phase's own log; populate with steps 1–5 evidence).
- Create empty templates for B-1 → B-6:
  - `redesign/per-page-progress/B1-foundation-progress.md`
  - `redesign/per-page-progress/B2-metric-backend-progress.md`
  - `redesign/per-page-progress/B3-performance-surface-progress.md`
  - `redesign/per-page-progress/B4-reports-rebuild-progress.md`
  - `redesign/per-page-progress/B5-dashboard-rebuild-progress.md`
  - `redesign/per-page-progress/B6-client-ltv-ribbon-progress.md`
- Template content for each:
  ```markdown
  # Progress — B[N] [phase title]
  
  **Brief:** redesign/briefs/B[N]-*-brief.md
  **Plan:** redesign/plans/B-phase/B[N]-*-plan.md
  **Started:** TBD
  **Completed:** TBD
  
  ## Step log
  
  (append step-N: COMPLETE — <one-line evidence> lines per plan step)
  
  ## Verification gate
  
  - [ ] Static lint
  - [ ] Static types
  - [ ] Vitest
  - [ ] Playwright role sweep
  - [ ] Screenshots captured
  - [ ] Bundle delta within budget
  - [ ] Sentry instrumentation
  - [ ] A11y gates passed
  
  ## Hand-off
  
  Next phase: B[N+1] (or "programme complete" for B-6)
  ```
- **Verify:** 7 files exist in `redesign/per-page-progress/`.

### Step 7 — Commit
- Stage scoped files explicitly:
  - `redesign/baselines/` (entire directory)
  - `redesign/per-page-progress/B[0-6]-*.md`
- Commit message: `chore(admin): B-0 — baseline capture (bundle + screenshots + Sentry + WCAG + fresh therapist account)`
- Note: the auth.users row from step 5 is committed at the DB layer (no git artefact).

## How to undo it if something breaks

Most B-0 work is artefact-creation. Rollback:
- Revert the commit — baselines + progress templates disappear from git. Fresh test account row remains in `auth.users` (DELETE via Supabase MCP if not wanted).
- WCAG verification document deletion: no impact (nothing else depends on it).

If fresh test account becomes problematic (Zone-2 mishap): DELETE FROM auth.users WHERE email = 'test.therapist.fresh@...'; cascades clean up via FKs.

## Safety confirmations

- [ ] Branch is `redesign/start-state`.
- [ ] `mcp__supabase__list_tables` verified before auth writes.
- [ ] Zone-2 confirmation received for `auth.users` INSERT (step 5).
- [ ] No `pnpm install` (read-only build for baseline).
- [ ] No production deploy triggered.

---

## Step-by-step verification log template

```
step-1: COMPLETE — bundle baseline captured: dashboard 247kB / reports 312kB / clients/[clientId] 198kB / staff/[staffId] 142kB
step-2: COMPLETE — 24 screenshots captured (4 viewports × 3 pages × 2 states); saved to redesign/baselines/screenshots-pre-B1/
step-3: COMPLETE — Sentry baseline recorded: 3 active issues; top: TypeError in ReportsCharts (pre-existing)
step-4: COMPLETE — WCAG verification: danger-bg-strong 6.4:1 PASS / warning-bg-strong 5.8:1 PASS / success-bg-strong 4.9:1 PASS — all AA
step-5: COMPLETE — fresh therapist account created (Zone-2 confirmed by user); sign-in verified; Therapist variant renders empty
step-6: COMPLETE — 7 progress template files created in redesign/per-page-progress/
step-7: COMPLETE — committed chore(admin): B-0 — baseline capture
```

---

## Verification gate

| Gate | Command | Pass criterion |
|---|---|---|
| Bundle baseline | `ls redesign/baselines/bundle-pre-B1.json` | File exists with numbers |
| Visual baseline | `ls redesign/baselines/screenshots-pre-B1/` | 4 viewport directories, each with PNG files |
| Sentry baseline | `cat redesign/baselines/sentry-baseline.txt` | Issue counts + IDs logged |
| WCAG verification | `cat redesign/baselines/wcag-severity-tokens.md` | All 3 tokens documented; all PASS AA OR adjustment noted |
| Fresh account | Sign in with `test.therapist.fresh@…` | `/admin/dashboard` renders Therapist variant empty |
| Progress templates | `ls redesign/per-page-progress/B[0-6]-*.md` | 7 files exist |

---

## Files touched (summary)

**Created:**
- `redesign/baselines/bundle-pre-B1.json`
- `redesign/baselines/screenshots-pre-B1/{375,768,1280,1440}/*.png` (~24 PNG files)
- `redesign/baselines/sentry-baseline.txt`
- `redesign/baselines/wcag-severity-tokens.md`
- `redesign/per-page-progress/B0-progress.md`
- `redesign/per-page-progress/B1-foundation-progress.md`
- `redesign/per-page-progress/B2-metric-backend-progress.md`
- `redesign/per-page-progress/B3-performance-surface-progress.md`
- `redesign/per-page-progress/B4-reports-rebuild-progress.md`
- `redesign/per-page-progress/B5-dashboard-rebuild-progress.md`
- `redesign/per-page-progress/B6-client-ltv-ribbon-progress.md`

**Modified:**
- `redesign/HANDOFF-2026-05-21.md` (§4.2 credentials — add new test account)

**External (DB only, no git):**
- `auth.users` — 1 INSERT (Zone-2)
- `staff_profiles` — 1 INSERT (Zone-2)

**Total: ~37 files (mostly screenshots) + 1 modified + 2 DB rows.**

---

## Hand-off

After B-0 ships:
- B-1 implementer has all reference baselines.
- B-5 implementer has a fresh-therapist account for fullness verification.
- Every subsequent phase's verification gate can be measured against B-0's baselines.
- Per-page-progress templates ready to be filled.

Next phase: B-1 (foundation primitives).
