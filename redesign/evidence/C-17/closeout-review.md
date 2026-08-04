VERDICT: PASS

# C-17 (Google Analytics) — adversarial closeout review

Reviewer: read-only closeout subagent. Repo `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`, branch `master`, HEAD `d5425ec` (confirmed via `git log -1`). Range reviewed: `git diff 099903a..HEAD` — three commits: `05f251e` (Phase A), `e545f38` (Phase B), `d5425ec` (leak fix). `SUBAGENT-RULES.md` read first and followed. `src/lib/maintenance.ts` not touched (its standing Owner-owned uncommitted diff was present before I started and is unchanged — confirmed via `git status --porcelain -- src/lib/maintenance.ts` before and after). All git commands used were `log`/`diff`/`show`/`status`; no `checkout`/`stash`/`switch`/`restore` run at any point. No package installs performed. No writes made anywhere except this file (a scratchpad-only helper script used for the bundle investigation lives outside the repo, at the session scratchpad path, and never touched repo files).

This review does not re-litigate the Owner's decision to drop the `/booking/manage` GA mount, or the two deferred Zone-2 items (Cloudflare env var, production deploy + live GA Realtime verification) — both are correctly still open per prior evidence and are orchestrator-owned.

---

## Part 1 — gates at final HEAD (all run independently by me, not copied from prior evidence)

| Gate | Result | Detail |
|---|---|---|
| `npx tsc --noEmit` | **PASS — 0 errors** | Empty output. |
| `npx vitest run` | **PASS by identity** | `Test Files 2 failed \| 189 passed (191)`, `Tests 5 failed \| 1820 passed (1825)`. Failing tests, confirmed via `grep FAIL`: `src/lib/auth/admin-access.test.ts` × 2 (`gives Owner broad access…`, `gives Admin broad operational access…`) and `src/app/admin/bookings/new/ManualBookingForm.test.tsx` × 3 (`renders step 1 on first load`, `moves focus to the first invalid field…`, `shows the consent error…`). Exact identity match to the inherited baseline — no new failure, none swapped out. |
| `npx eslint .` | **PASS by identity** | `59 errors / 7 warnings` in exactly six files, counted via ESLint's JSON formatter (not just visual scan): `design_handoff_area_pages/prototype/area-page.jsx` (48E/1W), `design_handoff_area_pages/prototype/shared.jsx` (2E/5W), `design_handoff_area_pages/prototype/site-chrome.jsx` (5E/0W), `src/features/booking/BookingExperience.tsx` (3E/0W), `src/features/booking/BookingExperienceLoader.tsx` (1E/0W), `src/features/booking/utils/returning-customer.ts` (0E/1W). Matches the inherited baseline exactly; none of the C-17-touched files (`GoogleAnalytics.tsx`, `SuccessScreen.tsx`, the three new test files, `(public)/layout.tsx`) appear. |
| `pnpm build` | **PASS — clean, 52 routes** | `rm -rf .next && pnpm build` (env var unset): `✓ Compiled successfully in 9.3s`, TypeScript pass finished clean, `Generating static pages using 23 workers (52/52)`. Route table includes `ƒ /booking/manage` (still routes — the deletion only removed the GA mount, not the route). No admin/middleware/build-config files appear in the touched-file diff (confirmed separately, see Part 2). |
| Bundle ceiling (+1 kB public first-load JS, pre-C-17 vs post-C-17) | **NOT RUN — literal comparison unobtainable in a read-only, no-checkout session** | See dedicated section below. |

### Bundle ceiling — what was actually obtainable

The plan's own §3.1 note is correct: this Next 16.2.4 Turbopack build prints no "First Load JS" size table to the console (confirmed again on a fresh `pnpm build` run — grepped the full captured log for `First Load\|kB`, zero hits), and `scripts/measure-admin-bundles.mjs` is hardcoded to an admin-only `ROUTES` list with no public-route or `/booking/manage` entries (read the full 162-line script). Per the dispatch, I did not extend that script.

The plan's literal ask — the `pnpm build` route-size table for `/` and `/booking/manage` **before vs after C-17** — requires a build from `099903a` (the pre-C-17 parent) to diff against. Obtaining that build requires `git checkout 099903a`, which is explicitly forbidden for a read-only reviewer (`SUBAGENT-RULES.md` §2, dispatch git limits). No stored pre-C-17 bundle baseline exists in the repo (`redesign/baselines/` only holds `bundle-pre-B1.json`, a Band-B artifact from a much earlier point, not usable as a C-17 "before"). **Recording this as NOT RUN, not PASS, per the dispatch's explicit instruction.**

As a supplementary (not substitute) data point, I wrote a scratchpad-only Node script that replicates `scripts/measure-admin-bundles.mjs`'s own methodology (sum of `rootMainFiles`+`polyfillFiles` from `build-manifest.json`, plus each route's `entryJSFiles` from its `page_client-reference-manifest.js`, gzipped) and pointed it at `/`, `/home`, `/services`, and `/booking/manage` instead of the admin routes. I ran two full builds at HEAD — one with `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset, one with it set to `G-TEST` — to isolate the component's own marginal contribution (the closest in-session proxy for "the feature's cost", though not the same as a pre/post-C-17 diff). Result: **byte-for-byte identical** gzipped First Load JS on every measured route between the two builds (`/` 169.65 kB, `/home` 234.28 kB, `/services` 276.17 kB, `/booking/manage` 198.55 kB shared+route JS, unchanged either way). This is consistent with the plan's own reasoning (`GoogleAnalytics.tsx` is a server component that returns `null` in the gated-off case and renders only `next/script` tags in the gated-on case; `gtag.js` itself loads from Google's CDN and is never bundled) but is explicitly **not** a verification of the actual pre-C-17-vs-post-C-17 ceiling — it only shows the feature's own on/off toggle costs nothing measurable in the client bundle at HEAD, which is a good sign but not proof of the +1 kB gate.

---

## Part 2 — adversarial sweep

No blocking or non-blocking findings identified. Full sweep detail below, organized by the dispatch's checklist.

### Scope creep — none found

`git diff 099903a..HEAD --stat` across the whole range: exactly 7 files with any net diff (`.env.example`, `src/app/(public)/layout.tsx`, `src/app/booking/__tests__/no-google-analytics.test.ts`, `src/components/GoogleAnalytics.tsx`, `src/components/__tests__/GoogleAnalytics.test.tsx`, `src/features/booking/components/SuccessScreen.test.tsx`, `src/features/booking/components/SuccessScreen.tsx`). `src/app/booking/layout.tsx` is created in `05f251e` and deleted in `d5425ec`, netting to zero and correctly not appearing in the cumulative stat. Independently confirmed untouched across the whole range: `grep`-checked `git diff 099903a..HEAD -- src/features/booking/BookingExperience.tsx src/app/admin/ src/lib/ src/middleware.ts next.config.ts wrangler.jsonc` → empty output. Every touched file traces to a plan step or the recorded Owner decision; nothing extra.

### Lost steps — none; both phases implemented, the Owner decision correctly supersedes plan text

- **Phase A (Steps 1–3):** `GoogleAnalytics.tsx` matches brief §2.1 verbatim (env-gated, `NODE_ENV==="production"` gate, `afterInteractive`, C-18 insertion-point comment). Mounted in `(public)/layout.tsx:32`. `.env.example:20-23` documents the var with a placeholder value consistent with every other var in that file's convention. The `booking/layout.tsx` mount from Step 2 was later deleted by the Owner-directed fix — correctly not re-litigated per this dispatch's instruction 1.
- **Phase B (Steps 4–5):** `SuccessScreen.tsx:19-31` fires `window.gtag?.("event","booking_request_submitted")` once, ref-guarded, in the single mount path (`BookingExperience.tsx` `currentStep === "success"`, stable `key="success"`). Colocated `SuccessScreen.test.tsx` covers all three required cases (fires once, no throw when absent, StrictMode double-mount nets one).
- **The fix (`d5425ec`):** correctly scoped to exactly the Owner's ruling — deletes `src/app/booking/layout.tsx`, adds a recursive anti-drift guard test (`no-google-analytics.test.ts`) scanning `src/app/booking/**` for any reference to `GoogleAnalytics`, excluding only its own `__tests__/` directory (verified there is no other `__tests__` directory under `src/app/booking/` that this exclusion could over-broadly hide — `find src/app/booking -type f` returns exactly 4 files, 3 in `manage/` + the 1 guard test).
- Plan §3 gate item 2's literal text ("gtag script present in… `/booking/manage`") is superseded by the Owner's 2026-08-04 ruling recorded in this dispatch; I verified the **inverted** requirement (gtag ABSENT from `/booking/manage`) holds live — see Part 1 build + curl checks below — and did not treat the plan's stale wording as a defect.

### Style drift — none found

`git diff 099903a..HEAD | grep -n "border-l-4\|oklch(\|prefers-reduced-motion"` → zero matches across the entire range. No new hardcoded color literals, no motion-preference handling touched (Phase B's `SuccessScreen.tsx` change is additive-only: new import + new ref + new effect, confirmed by re-reading the diff hunks — nothing in the pre-existing render/copy/`success-heading`/`tabIndex` code was touched). The one-line `<GoogleAnalytics />` addition to `(public)/layout.tsx` matches the file's existing flat-mount pattern (sits directly under `<PublicScrollbar />`, no new wrapper/classes).

### Weakened or vacuous tests — none found; read and reasoned through all three specs myself

- **`GoogleAnalytics.test.tsx`** (read in full, 69 lines): the two negative-case tests (env unset; `NODE_ENV !== "production"`) assert `document.querySelector("script[data-nscript]")` is `null`. If the `if (!GA_ID || process.env.NODE_ENV !== "production") return null;` gate in the component were removed, `next/script` would still inject a `script[data-nscript]` element into `document.head` on render (its insertion is effect-driven, not dependent on `GA_ID` being a real value), so both tests would fail. Not vacuous.
- **`SuccessScreen.test.tsx`** (read in full, 74 lines): test 1 asserts `gtag` was called exactly once with the exact two-argument tuple — if the effect were deleted, `toHaveBeenCalledTimes(1)` would report 0 and fail. Test 3 (StrictMode) specifically exercises the `useRef` guard — React's dev double-invoke runs `setup→cleanup→setup` on the same instance, so without the ref guard the second `setup` would call `gtag` again and `toHaveBeenCalledTimes(1)` would report 2. Not vacuous.
- **`no-google-analytics.test.ts`** (read in full, 46 lines): has an explicit anti-vacuity test (`"finds files to scan"`, asserting `files.length > 0`) independent of the main assertion, so a path-mistake that made the scanner see zero files would be caught rather than silently passing. The main test does a literal-substring scan for `"GoogleAnalytics"` across every non-test `.ts`/`.tsx` file under `src/app/booking/`; dropping the guard reintroduces exactly the leak this test exists to prevent, and I confirmed (by reading `ManageBookingForms.tsx`/`actions.ts`/`page.tsx`) there is currently nothing else in that tree referencing `gtag`/`GoogleAnalytics`/`googletagmanager` for the scan to miss today. Disclosed (non-blocking) limitation, same one prior evidence already recorded: a renamed re-export (`export { GoogleAnalytics as Tracker }`) or a hand-rolled inline `<Script src="…googletagmanager…">` written without referencing the named component would bypass this specific string match — neither exists in the current tree.

### The residual privacy question — independently re-checked, no second leak found

Repeated the "does any `(public)` route read `searchParams` for anything besides the known-safe pair" check from scratch, not by trusting the prior write-up:
- `grep -rn "searchParams" "src/app/(public)/"` → **zero matches**. None of the ten `(public)` page files (`page.tsx`, `home/page.tsx`, `about/page.tsx`, `services/page.tsx`, `services/[slug]/page.tsx`, `areas/page.tsx`, `areas/[slug]/page.tsx`, `faqs-aftercare/page.tsx`, `reviews/page.tsx`, `layout.tsx`) reads `searchParams` at all.
- Broader grep for `useSearchParams|location\.search|URLSearchParams` across all of `src/` → 45 files, but every one of them is under `src/app/admin/**` (untracked by GA — no mount there) except exactly one: `src/features/booking/hooks/useBookingUrlState.ts`. Read that file in full: it reads only two keys off `URLSearchParams` — `booking` (checked for the literal string `"1"`) and `services` (passed through `isBookingPackageId()`, an enum guard against `BookingPackageId` — not passed through raw). No token, email, name, or other identifying value is ever read from or written to the URL by this hook. This matches the prior sweep's finding; I did not find a second manage-token-class leak.
- Confirmed the mount boundary directly, not just by reading the diff: `src/app/booking/manage/page.tsx` lives at `src/app/booking/manage/`, outside the `(public)` route group, and (post-fix) `src/app/booking/layout.tsx` no longer exists — `ls src/app/booking/` shows only `manage/` and `__tests__/`. There is no other layout file under `src/app/booking/` that could mount `GoogleAnalytics`.
- Live confirmation, not just static reasoning: built with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST`, ran `pnpm start`, curled `http://localhost:3000/booking/manage` (200, real `InvalidManageLink` fallback body since the token wasn't a live DB row) → **0** matches for `gtag|googletagmanager|dataLayer`. Same build, `/home` → **1** match (present, correct) and `/admin/login` → **0** matches (correct). All three checked in the same server run for direct comparability.

### The consent seam — verified live, correctly positioned for C-18

Read `src/components/GoogleAnalytics.tsx` at HEAD directly (not from the diff): the comment `// C-18 consent insertion point: gtag('consent', 'default', { ... }) goes here` sits at line 17, between `function gtag(){dataLayer.push(arguments);}` (line 16) and `gtag('js', new Date());` (line 18). Per Google's Consent Mode v2 contract, `consent` defaults must be set before the first `gtag('js', …)`/`gtag('config', …)` calls for the default to gate the initial hit — this ordering satisfies that. `d5425ec` did not touch this file (confirmed via `git diff 05f251e..HEAD -- src/components/GoogleAnalytics.tsx` → empty) — the seam survived the fix round unchanged.

### Commit cadence — matches the plan, fix round is legitimate

`git log --oneline 099903a..HEAD`:
```
d5425ec fix(redesign): C-17 — no GA on /booking/manage; its token must not reach page_location
e545f38 feat(redesign): C-17 Phase B — booking_request_submitted conversion event
05f251e feat(redesign): C-17 Phase A — GA4 tag, public + booking mounts, env documented
```
Maps cleanly to the plan's §7 table rows 1 (Phase A) and 2 (Phase B). The plan's row 3 ("Verification — evidence + progress file + master plan checklist → ✅") has not landed yet — expected, since that commit is downstream of this very closeout review (no `redesign/per-page-progress/C-17-google-analytics-progress.md` exists yet, and `BAND-C-MASTER-PLAN.md:464` still shows the C-17 row as "⏳ (brief + plan ✅) … Implementation ⏳ pending" — not a defect in the reviewed range, just work that comes after this file lands). The `d5425ec` fix round is exactly the kind of legitimate mid-course correction the dispatch says to expect, not scope creep.

---

## Findings

**None — no blocking or non-blocking code defects were found in this range.** The only open item is the bundle-ceiling gate's NOT RUN status documented in Part 1, which is a structural review-tooling limitation (no stored pre-C-17 bundle baseline + checkout forbidden for a read-only reviewer), not a defect in the C-17 commits themselves. It is recorded honestly as NOT RUN rather than asserted as passing, per the dispatch's instruction, and is consistent with the same class of gap nine prior plans have already recorded.

One non-blocking observation carried forward from prior evidence, re-confirmed independently rather than just copied: `SuccessScreen`'s fire-once guard depends on there being no live path that remounts the component while `currentStep === "success"` (a stable literal `key="success"`, no persisted/URL/history path back to that step) — true as shipped, but no test in `SuccessScreen.test.tsx` exercises a genuine remount scenario (only StrictMode's same-instance double-invoke is tested). This is the same coverage gap `phase-b-verify-full.md` Check 5 already flagged; I re-derived it independently while reading `BookingExperience.tsx`/`MotionStep.tsx`/`useBookingUrlState.ts` myself and agree it is real but non-blocking (a future regression, not a current one).

---

## Swept and clean (checked, found nothing)

- `border-l-4`, `oklch(...)`, `prefers-reduced-motion` patterns anywhere in the range's diff — zero matches.
- Admin tree, root layout, middleware, `next.config.ts`, `wrangler.jsonc` — zero diff across the whole range.
- `src/lib/maintenance.ts` — untouched by the range; its pre-existing uncommitted Owner change is the only diff present and I left it alone.
- Import-graph leak from `(public)`/`booking` mounts into `/admin/**` — `grep -rn "GoogleAnalytics" src/` returns exactly the component, its two test files, the one live mount (`(public)/layout.tsx`), and the guard test's string check; nothing under `src/app/admin/`.
- `.env.example` — only the one documented addition, follows the file's existing placeholder-value convention, no `.env` file created or modified.
- Second manage-token-class leak in any other `(public)` route via `searchParams`/`useSearchParams`/`location.search` — none found (see dedicated section above).
- Vacuous tests in any of the three new specs — none found; reasoned through what would happen if the underlying behavior were removed for each.
- Scope creep beyond the plan's declared file list — none; exactly 7 net-changed files across the whole range, all traceable to a step or the Owner decision.
- Static gates (tsc/vitest/eslint) — all match the inherited baseline by identity, run independently by me from a clean state (fresh `pnpm build` twice, full `npx vitest run`, full `npx eslint .` with JSON-formatter file counts, not a truncated visual read).
- Dev-server HTML — curled `/home` and `/booking/manage` against a live `pnpm dev` instance (no GA env set): zero `googletagmanager` matches on either, confirming the gate holds outside of production builds too.

Both background server processes I started (`pnpm start` on port 3000 with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST`, then `pnpm dev` on port 3000) were killed after use; no server was left running. `.next/` was rebuilt multiple times during this review — it is git-ignored and irrelevant to the tracked tree.
