# Progress — B-0 Baseline capture

**Brief:** none (capture phase)
**Plan:** `redesign/plans/B-phase/B0-baseline-plan.md`
**Started:** 2026-05-24 (session 5)
**Completed:** TBD

## Pre-flight findings

- Branch: `redesign/start-state`; HEAD at session start was `20aba4b`.
- Two prep commits landed before B-0 work began:
  - `6f3ff8f` chore(redesign): archive R4 + Phase-6 sweep screenshots from repo root
  - `d2e6512` docs(redesign): land Band B session-4 planning artefacts
- Stack: Next.js 16.2.4 (Turbopack), React 19.2.4, Node v24.12.0, pnpm v10.17.1, @sentry/nextjs ^10.51.0 (well above 7.x — `Sentry.startSpan` API confirmed available per SHARED-NOTES §12).
- 7 per-phase progress templates already exist; step 6 is verify-only.
- `redesign/baselines/` directory created on first write.

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

step-1: COMPLETE — bundle baseline captured into `redesign/baselines/bundle-pre-B1.json`. Next 16 Turbopack omits per-route First Load JS from the CLI table; reconstructed by parsing `build-manifest.json` (rootMainFiles + polyfillFiles) + per-route `page_client-reference-manifest.js` (entryJSFiles + entryCSSFiles), summing gzipped chunk bytes via Node `zlib`. Results (first-load JS gzip): dashboard 458.81 kB · reports 452.02 kB · clients/[clientId] 336.25 kB · staff/[staffId] 339.60 kB. Shared baseline 169.76 kB across 7 chunks. CSS reported separately at 38.95 kB per route (consistent — same two layout CSS files everywhere). No missing chunks.

step-2: COMPLETE — 12 populated screenshots captured (4 viewports × 3 surfaces) under `redesign/baselines/screenshots-pre-B1/{375,768,1280,1440}/owner-{dashboard,reports,clients-detail}-populated.png`. Owner signed in (`rahmatherapy@outlook.com`). Client-detail target: Fatima Ahmed (`5d5d7a36-7209-4d07-a673-fc46222cd5c7`, 2 bookings). Skeleton-state screenshots NOT captured because (a) Playwright MCP exposes no network throttling, (b) Turbopack caches each route after first hit so frame timing is unreliable, (c) a code-level baseline is more durable than a fleeting screenshot. Skeleton baseline documented from source in `redesign/baselines/screenshots-pre-B1/README.md`.

**B-1 DISCREPANCY FLAGGED (does not block B-0, but B-1 implementer must read before step 2):** `AdminSkeleton` component in `src/app/admin/components/admin-ui.tsx:1263` ALREADY uses a shimmer keyframe (`@keyframes shimmer` defined at `src/app/globals.css:41`). B-1 plan step 2 says "swap pulse → shimmer at the component level" but that swap has already happened. The remaining `animate-pulse` usages are in the route-level `loading.tsx` files (`src/app/admin/loading.tsx`, `src/app/admin/clients/loading.tsx`, `src/app/admin/emails/loading.tsx`, `src/app/admin/reports/loading.tsx`) which compose raw `<div className="animate-pulse">` divs instead of using `<AdminSkeleton>`. B-1 may want to: (a) migrate those `loading.tsx` files to compose `<AdminSkeleton>` (effortless shimmer adoption), and (b) re-scope step 2 to focus on shimmer-animation visual tuning (gradient stops, duration, easing) rather than re-introducing it. Detail captured in `redesign/baselines/screenshots-pre-B1/README.md`. **Pause B-1 step 2 for user confirmation before re-introducing shimmer logic.**

step-3: COMPLETE — Sentry baseline written to `redesign/baselines/sentry-baseline.txt`. Project owner manually confirmed 0 active Sentry issues at the baseline snapshot point (no Sentry MCP / API access available from this implementation session). `@sentry/nextjs ^10.51.0` confirmed in `package.json` — `Sentry.startSpan` API (used by SHARED-NOTES §12 slow-query spans in B-2) is supported (>= 7.x). Baseline supports the programme-exit gate "no new persistent error classes vs B-0 baseline".

step-4: COMPLETE (with B-1 BLOCK on adjustment authorisation) — WCAG verification ran for all three proposed severity-strong tokens against the existing `--admin-{danger|warning|success}` text colours. Results: success 4.56:1 ✅ (passes by 0.06), danger 4.08:1 ❌ (fails by 0.42), warning 2.84:1 ❌ (fails by 1.66). Per B-0 plan step 4 explicit branch, B-1 cannot start until token adjustment is authorised. `redesign/baselines/wcag-severity-tokens.md` records the failures + three adjustment directions per failing family (lift L, drop C, add a paired `*-text-strong` token). Recommendation: Option C — add `--admin-{danger|warning}-text-strong` darker text tokens, paired with the bg-strong tokens (mirrors the existing `--admin-status-attention-bg`/`--admin-status-attention-text` convention; preserves proposed bg-strong tints; danger achieves 9.21:1 and warning achieves 10.71:1).

**B-1 authorisation received (user, 2026-05-24):** Option C. B-1 brief §5.4 + plan step 1 must add 5 new tokens (3 bg-strong + 2 text-strong) instead of 3. Token values: `--admin-danger-text-strong: oklch(30% 0.18 25)` (#6e0000, 9.21:1 vs danger-bg-strong) and `--admin-warning-text-strong: oklch(30% 0.16 55)` (#630000, 10.71:1 vs warning-bg-strong). Success family doesn't need a text-strong (existing `--admin-success` passes at 4.56:1).

step-5: COMPLETE (Zone-2 confirmed) — created `test.therapist.fresh@rahmatherapy.example.test` via Supabase MCP `execute_sql`. auth_user_id=`4cdc5e09-cc98-4bf9-9ac3-8d48fd341e72`, staff_id=`87e01c11-9d0d-4b52-bf3e-2af16f0f03d5`, role=Therapist, active=true. Sign-in verified via Playwright after fixing a GoTrue gotcha (see below). Dashboard renders the Therapist variant at 4 viewports — screenshots captured to `redesign/baselines/screenshots-pre-B1/{375,768,1280,1440}/empty-therapist-dashboard.png`. Account has zero personal bookings/assignments; "Open to claim 1" appears because Claimable is a shared pool across all Therapists (single existing claimable booking offered to anyone) — this is application behaviour, not a fresh-account anomaly; for empty-state verification the account is correctly empty in its own metrics. HANDOFF §4.2 credentials section already lists this account from the session-4 planning commit (`d2e6512`) — no further update needed.

**GoTrue NULL-token gotcha (process learning — document in dev-environment notes for future Zone-2 auth.users INSERT work):** Newer Supabase GoTrue versions reject auth.users rows where `confirmation_token`, `recovery_token`, `email_change_token_new`, or `email_change` are NULL — even with a valid bcrypt password. They must be set to empty strings (`''`) explicitly. The bcrypt hash itself (`crypt(password, gen_salt('bf', 10))`) IS Supabase-compatible — the B-0 plan's H2 warning was a misdiagnosis; the real failure was these token columns. Working pattern verified end-to-end (auth.users + auth.identities + staff_profiles INSERT + token columns set to '' on auth.users) — first attempt failed with "Incorrect email or password" until the token UPDATE ran.

step-6: COMPLETE (verify-only) — 7 per-phase progress template files confirmed present in `redesign/per-page-progress/B[0-6]-*-progress.md`. Templates were committed in prep commit 2 (`d2e6512`).

## Verification gate

- [ ] Bundle baseline `redesign/baselines/bundle-pre-B1.json` written
- [ ] Visual baseline screenshots captured (4 viewports × 3 pages × 2 states)
- [ ] Sentry baseline `redesign/baselines/sentry-baseline.txt` recorded
- [ ] WCAG severity-tokens contrast check `redesign/baselines/wcag-severity-tokens.md`
- [ ] Fresh test account `test.therapist.fresh@…` created (Zone-2 confirmed)
- [ ] 7 progress template files exist in `redesign/per-page-progress/B[0-6]-*.md`
- [ ] HANDOFF §4.2 credentials updated

## Hand-off

Next phase: B-1 (foundation primitives).
