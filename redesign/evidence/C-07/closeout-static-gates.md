# C-07 closeout — §3.1 static gates + bundle budget

**VERDICT: PASS** (by identity, for the four identity-baselined gates: tsc, vitest, eslint, build). The bundle-budget check (item 5) could not be fully evaluated against the plan's ceiling — see §5 below; this is reported as a gap, not folded silently into the verdict.

Repo: `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`, branch `master`, HEAD `f038b4f` (verified via `git log -1 --oneline` before running). Working tree confirmed dirty only as expected: `src/lib/maintenance.ts` modified (Owner-authorised `MAINTENANCE_MODE = false`) — not touched by this run.

Read-only throughout: no source writes, no git mutation, no package installs (`npx tsc/vitest/eslint/next build` and `node scripts/...` only — all resolve from the existing lockfile).

---

## 1. `npx tsc --noEmit`

Exit code 0. **Output was empty** — 0 errors.

```
(no output)
EXIT:0
```

**Baseline identity: MATCH** (expected 0 errors).

---

## 2. `npx vitest run`

Verbatim tail:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
 FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
 FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
 FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
 FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent

 Test Files  2 failed | 171 passed (173)
      Tests  5 failed | 1494 passed (1499)
   Start at  15:23:30
   Duration  56.13s (transform 14.61s, setup 0ms, import 239.86s, tests 51.47s, environment 689.42s)
```

Failures by name, exactly:
1. `src/lib/auth/admin-access.test.ts` → "gives Owner broad access while keeping owner-only role actions permission-gated"
2. `src/lib/auth/admin-access.test.ts` → "gives Admin broad operational access without role template management"
3. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` → "renders step 1 on first load"
4. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` → "moves focus to the first invalid field when continuing with errors"
5. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` → "shows the consent error when trying to create booking without consent"

Totals: 2 test files failed / 171 passed (173 total); 5 tests failed / 1494 passed (1499 total).

**Baseline identity: MATCH** — exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, 5 total, no swapped-in new failure (e.g. no `createBookingTransaction` failure, consistent with C-06 having fixed it). Recorded pass-count for the record: **171/173 files, 1494/1499 tests**.

---

## 3. `npx eslint .`

Summary line: `✖ 66 problems (59 errors, 7 warnings)`.

Per-file breakdown (verified by counting each `line:col  error|warning` entry):

| File | Errors | Warnings |
|---|---|---|
| `design_handoff_area_pages/prototype/area-page.jsx` | 48 | 1 |
| `design_handoff_area_pages/prototype/shared.jsx` | 2 | 5 |
| `design_handoff_area_pages/prototype/site-chrome.jsx` | 5 | 0 |
| `src/features/booking/BookingExperience.tsx` | 3 | 0 |
| `src/features/booking/BookingExperienceLoader.tsx` | 1 | 0 |
| `src/features/booking/utils/returning-customer.ts` | 0 | 1 |
| **Total** | **59** | **7** |

Distinct files with errors/warnings: exactly 6, all within the two expected groups (`design_handoff_area_pages/prototype/*.jsx` and `src/features/booking/*`).

**Baseline identity: MATCH** — 59 errors / 7 warnings, confined to exactly the 6 files named in the inherited baseline.

---

## 4. `npx next build`

Verbatim tail:

```
▲ Next.js 16.2.4 (Turbopack)
✓ Compiled successfully in 11.5s
  Running next.config.js provided runAfterProductionCompile ...
✓ Completed runAfterProductionCompile in 2.3s
  Running TypeScript ...
  Finished TypeScript in 26.7s ...
  Collecting page data using 23 workers ...
  Generating static pages using 23 workers (0/52) ...
  Generating static pages using 23 workers (13/52)
  Generating static pages using 23 workers (26/52)
  Generating static pages using 23 workers (39/52)
✓ Generating static pages using 23 workers (52/52) in 680ms
  Finalizing page optimization ...
```

Build completed clean, exit 0. Static-generation phase reported **52/52 pages**. Route table lists all `/admin/*`, `/api/*`, public marketing routes, `/areas` (+5 spoke sub-paths), and `/services` (+5 package sub-paths) as expected; only a pre-existing deprecation notice (`middleware` → `proxy` convention) appeared, no errors.

**Baseline identity: MATCH** — clean build, as expected.

---

## 5. Bundle budget — `node scripts/measure-admin-bundles.mjs`

The script **exists** (`scripts/measure-admin-bundles.mjs`) and ran successfully against the `.next/` output from step 4 (exit 0). Full JSON output:

```json
{
  "captured_at": "2026-08-03T14:27:19.267Z",
  "next_version": "16.2.4 (Turbopack)",
  "shared_baseline": { "chunk_count": 7, "raw_bytes": 571248, "gzip_bytes": 173726, "gzip_kb": 169.65 },
  "routes": [
    { "url": "/admin/dashboard", "first_load_js_gzip_kb": 482.22, "baseline_first_load_js_gzip_kb": 458.81, "delta_vs_pre_B1_kb": 23.41 },
    { "url": "/admin/reports", "first_load_js_gzip_kb": 473.71, "baseline_first_load_js_gzip_kb": 452.02, "delta_vs_pre_B1_kb": 21.69 },
    { "url": "/admin/clients/[clientId]", "first_load_js_gzip_kb": 338.56, "baseline_first_load_js_gzip_kb": 336.25, "delta_vs_pre_B1_kb": 2.31 },
    { "url": "/admin/staff/[staffId]", "first_load_js_gzip_kb": 341, "baseline_first_load_js_gzip_kb": 339.6, "delta_vs_pre_B1_kb": 1.4 },
    { "url": "/admin/me", "first_load_js_gzip_kb": 448.31 },
    { "url": "/admin/staff/[staffId]/performance", "first_load_js_gzip_kb": 447.1 }
  ],
  "baseline_used": { "path": "redesign/baselines/bundle-pre-B1.json", "captured_at": "2026-05-24T13:01:09.277Z", "git_sha": "d2e6512" }
}
```

**Numbers for the four surfaces named in the dispatch, verbatim:**
- `/admin/me`: first_load_js_gzip_kb = **448.31 kB**. No `delta_vs_pre_B1_kb` field — the script's baseline file (`bundle-pre-B1.json`) predates this route's existence, so no comparator is present for it (this matches the script's own in-code comment: "B-3 — new routes; no pre-B1 baseline entry").
- `/admin/bookings*`: **not measured — no entry exists for this route at all.** The script's hardcoded `ROUTES` array (lines 31-44 of `scripts/measure-admin-bundles.mjs`) contains exactly: `/admin/dashboard`, `/admin/reports`, `/admin/clients/[clientId]`, `/admin/staff/[staffId]`, `/admin/me`, `/admin/staff/[staffId]/performance`. There is no `/admin/bookings`, `/admin/bookings/[bookingId]`, or `/admin/bookings/new` entry, and no code path to add one without editing the script. I am reporting this gap plainly per instruction rather than substituting a different measurement method.
- `/admin/dashboard`: first_load_js_gzip_kb = **482.22 kB**, `delta_vs_pre_B1_kb` = **+23.41 kB**.
- `/admin/clients/[clientId]`: first_load_js_gzip_kb = **338.56 kB**, `delta_vs_pre_B1_kb` = **+2.31 kB**.

**This cannot answer the "+5 kB cumulative across the four named surfaces" question as posed**, for two compounding reasons, both surfaced plainly rather than papered over:
1. One of the four required surfaces (`/admin/bookings*`) has zero instrumentation in this script — its contribution to any cumulative total is unknown, not zero.
2. Even for the three surfaces that do have numbers, the only delta the script computes (`delta_vs_pre_B1_kb`) is measured against `redesign/baselines/bundle-pre-B1.json`, captured 2026-05-24 at git SHA `d2e6512` — i.e. **before Band B started**, not before C-07 started. Git history on the script (`git log --oneline -- scripts/measure-admin-bundles.mjs`) shows only two commits, both from Band B (`59cea08` "B-3 — Performance surface", `84f111e` "B-1 — foundation primitives"); it has not been touched since, and no more-recent baseline snapshot exists under `redesign/baselines/`. So the `+23.41 kB` and `+2.31 kB` deltas shown are cumulative since Band B's start (covering all of Band B and Band C's prior phases), not isolated to C-07's own diff.

I ran exactly what the plan named and report the numbers verbatim; I did not compute a substitute delta or invent a stand-in for the missing `/admin/bookings*` measurement.

---

## Summary

| Gate | Result | Identity match |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | MATCH |
| `npx vitest run` | 5 failures (admin-access.test.ts ×2, ManualBookingForm.test.tsx ×3); 171/173 files, 1494/1499 tests | MATCH |
| `npx eslint .` | 59 errors / 7 warnings, 6 files | MATCH |
| `npx next build` | clean, 52 pages | MATCH |
| bundle budget | 3 of 4 named surfaces measured; `/admin/bookings*` has no instrumentation in the script; deltas shown are vs. a pre-Band-B baseline, not C-07-isolated | **gap — cannot verify plan's +5 kB cumulative ceiling as posed** |
