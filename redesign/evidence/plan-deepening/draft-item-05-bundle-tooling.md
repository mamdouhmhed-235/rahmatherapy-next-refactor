## ITEM 5 — Make the bundle measurement actually work

### 5.1 Correcting the record first

The backlog says this needs a bundle analyzer, i.e. a package install. **That is wrong, and this plan corrects it.** `scripts/measure-admin-bundles.mjs` **already** solves the hard part: Next 16 Turbopack omits per-route First Load JS from the CLI table, and the script reconstructs it from `.next/build-manifest.json` (`rootMainFiles` + `polyfillFiles`) unioned with each route's `entryJSFiles` from `.next/server/app/<route>/page_client-reference-manifest.js`, then gzips to get real numbers. Only Node built-ins (`node:fs`, `node:path`, `node:zlib`) are imported — confirmed by reading the script's imports. **No package install is needed. This item is not Zone-2.**

Verified against the build currently sitting in the tree (dated 2026-08-09, source commit `aca7c18`): **46 per-route client-reference manifests exist**, including `admin/bookings/new`, `admin/bookings`, `(public)/services`, `(public)/home` and `booking/manage`.

**One correction to the previous wording:** describing these four/five as "every route the outstanding ceilings care about" overclaims. Only `/admin/bookings/new` has a directly-cited ceiling (§5.6 below); no plan cites plain `/admin/bookings` (the list page) by name. State the ceiling-relevant routes precisely rather than by a bundled list — see §5.6.

### 5.2 The two real gaps

1. **`ROUTES` is a hardcoded array of six entries** — symbol `ROUTES`, currently at `scripts/measure-admin-bundles.mjs:31-44` (RE-LOCATE BY SYMBOL and report drift rather than trusting these line numbers): `admin/dashboard`, `admin/reports`, `admin/clients/[clientId]`, `admin/staff/[staffId]`, `admin/me`, `admin/staff/[staffId]/performance`. It contains **no `/admin/bookings*` route and no public route**, which is why C-20's `+3 kB` and C-23's `+6 kB` ceilings were never measurable, along with an estimated nine to eleven earlier plans' ceilings (the precise count depends on how partially-covered plans are counted — see §5.6; do not assert an exact figure without footnoting the plan list).
2. **The only baseline is `redesign/baselines/bundle-pre-B1.json`, captured 2026-05-24 at `d2e6512`, before Band B.** Every delta it reports is cumulative across Band B *and* Band C, so it can never attribute a change to the plan under test. Confirmed empirically: an unmodified read-only run of the script against the current build reports `/admin/dashboard` delta_vs_pre_B1_kb = +23.73 kB — real drift, but blended across two bands, not attributable to any single plan.

### 5.3 The change

**a. Auto-discover routes instead of hardcoding them.** Walk `.next/server/app/**/page_client-reference-manifest.js`, deriving each route's `manifestRoute` from its directory path exactly as today (no change needed to `chunksForRoute()`'s entry-key construction — verified: the manifest's internal entry key is `[project]/src/app/${manifestRoute}/page` **including parentheses** for route groups, confirmed by grepping the raw manifest files for both `(public)/home` and `booking/manage`). Add a **new, separate, pure function** `manifestRouteToUrl(manifestRoute: string): string` that strips only literally-parenthesised path segments to build the display/report `url` field — e.g. `(public)/services` → `/services`, bare `(public)` → `/`. Dynamic segments (`[slug]`, `[clientId]`, etc.) pass through unchanged into both `manifestRoute` and `url` — no new logic needed there, this already matches the existing hardcoded entries' style.

Exclude the two Next-internal boundary manifests, `_global-error` and `_not-found`, from the discovered route set — they have no corresponding `page.tsx` and do not represent navigable URLs. (Correction: these come from Next's built-in `error.tsx`/`global-error.tsx` conventions and, for `_not-found`, Next's *default* 404 boundary — there is no `not-found.tsx` file anywhere in `src/app`, so do not describe `_not-found` as coming from a project-authored `not-found.tsx`.) After exclusion, the discovered route count must equal the on-disk `page.tsx` count — confirmed today as 46 manifests − 2 excluded = 44, matching `find src/app -name page.tsx | wc -l` → 44 exactly. Assert this equality at runtime (see §5.7's stop condition); do not hardcode "44" — recount `page.tsx` at build time since new pages may land before this item ships.

No parallel routes (`@folder`) or intercepted routes (`(.)folder`/`(..)folder`) exist anywhere under `src/app` today (confirmed: zero matches walking `src/app` for those patterns) — the auto-discovery logic does not need to handle them; do not add speculative generality for a shape that doesn't exist.

Walk `.next/server/app/**` (post-build output), not `src/app` (source) — this is a deliberate choice, not an oversight to "fix": walking source would require manually excluding non-page directories that have a `route.ts` handler but no `page.tsx` (`admin/email-templates/preview/[id]`, `admin/signout`) plus a same-named-but-unrelated legacy directory (`admin/email-templates`, distinct from the real `admin/emails/templates/[templateId]`). Walking the build output sidesteps all of that for free, since only real pages produce a `page_client-reference-manifest.js`.

**b. Add a CLI route filter.** The script currently has **no argv parsing at all** (`process.argv` is never read) — this is new functionality, not preserved behavior; do not describe it as "keeping" an existing filter. Design:
- Bare positional args are matched as exact-URL or path-prefix substrings against the *discovered* `url` (not the raw manifest path) — e.g. `node scripts/measure-admin-bundles.mjs /admin/bookings/new` or `.../measure-admin-bundles.mjs /admin/bookings` (prefix match, catches both the list and `/new`).
- No args → full discovered set (today's only behavior, preserved).
- A filter that matches zero routes → non-zero exit code + stderr message. Fail loud; never silently emit `"routes": []`.

**c. Re-baseline at a known SHA.** Write `redesign/baselines/bundle-post-band-c.json` recording the commit it was captured at, and have the script prefer it when present while keeping the `bundle-pre-B1.json` comparison available. **Do not delete or overwrite `bundle-pre-B1.json`** — it is the historical record for Band B.

The script's own `result` object (symbol `result`, currently at `scripts/measure-admin-bundles.mjs:144-159`) does **not** emit a `git_sha` field today — only `captured_at`, `next_version`, `measurement_method`, `shared_baseline`, `routes`, `baseline_used`. `bundle-pre-B1.json`'s `git_sha`/`branch`/`node_version`/`pnpm_version`/`sentry_nextjs` fields were added **by hand** after generation, not emitted by the script. Pick one explicitly rather than leaving it implicit:
- **Recommended:** extend the script to shell out to `git rev-parse --short HEAD` (and optionally `git branch --show-current`) and embed `git_sha`/`branch` in `result` directly, so every future capture is self-describing without a manual editing step.
- If that is skipped, the implementer must add `git_sha`/`captured_at`-adjacent metadata to `bundle-post-band-c.json` by hand, exactly as was done for `bundle-pre-B1.json`, and say so in the commit.

**d. Document the one-command workflow** (build, run, diff) at the top of the script's header comment, alongside the existing usage lines.

### 5.4 The build

This item needs **one `pnpm build`** to populate `.next/` before the final capture. That is expected and permitted **for this item only**. Everything else in this plan must not build.

**A production build that faithfully reflects the current `src/` tree already exists in the working tree**: `.next/BUILD_ID` and `.next/build-manifest.json` are dated 2026-08-09, tracing to commit `aca7c18`, and `git diff --quiet aca7c18 HEAD -- src/` exits 0 — `src/` is byte-identical to that build's source except the one standing exception, `src/lib/maintenance.ts` (a runtime flag, not expected to move bundle bytes). **Use this existing build to develop and dry-run the auto-discovery/filter/refactor logic without spending the one permitted build early.** Do exactly one confirming `pnpm build` at the end, immediately before capturing `bundle-post-band-c.json`, per §5.7's command sequence. Note as an expected outcome, not a surprise: if the build is fully deterministic and `maintenance.ts` is inert to bundling, the final build's byte counts may come out identical to what a run against the existing `.next/` would already show — that is not evidence of a broken build, it is the expected consequence of `src/` being unchanged.

### 5.5 Blast radius

**Files to edit:**
- `scripts/measure-admin-bundles.mjs` — add route auto-discovery, the `manifestRouteToUrl` function, the CLI filter, and (recommended) `git_sha` emission.
- `redesign/baselines/bundle-post-band-c.json` — **new file**, written by capturing the script's stdout once, per §5.7.
- `scripts/measure-admin-bundles.test.ts` — **new file**, see §5.8.

**Callers/consumers, confirmed by `grep -rn "measure-admin-bundles|bundle-pre-B1|bundle-post-band-c"` excluding `redesign/`:** none. No `package.json` `scripts` entry wraps this file, no reference in `next.config.ts`, no `.github/` workflow, no `.husky/` hook. The script is invoked only by hand today. This means the blast radius of changing it is contained entirely to the script file and the two baseline JSON files.

**Tests affected:** none exist for this script today (`scripts/**/*.test.*` currently contains only `measure-admin-contrast.test.ts` and `verify-admin-token-contrast.test.ts`, both item 7's contrast tooling) — no existing test can break from this change.

**Shared with public/customer site:** none as an editing concern. This item edits only `scripts/` and `redesign/baselines/` — nothing under `src/` changes as a result of this item. `/booking/manage`, checked by name: it is one of the routes the *auto-discovered* script will now measure (previously invisible to it), because it renders under the root layout with no route-group segment to strip and needs no special-casing beyond the generic "no parens → URL is the manifest path verbatim" rule. The auto-discovery logic must not assume "everything outside `admin/` is under `(public)/`" — it must strip parens only where they are literally present, wherever they occur, or `/booking/manage` would be mis-derived.

**Proven NOT affected (what was checked, and how):**
- No other script or config references this script or either baseline JSON — `grep -rn "measure-admin-bundles|bundle-pre-B1|bundle-post-band-c"` outside `redesign/`, zero hits beyond the script itself.
- `package.json` `scripts` block, read in full — no entry wraps this file.
- `.github/` and `.husky/` — `grep -rn "measure-admin-bundles"`, zero matches in both.
- `vitest.config.ts`'s `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]` already picks up any new `scripts/**/*.test.{ts,tsx}` file automatically — no config change needed for the new test file.
- No file under `src/` imports from `scripts/` — scripts in this repo are standalone Node CLIs, not imported by app code (same consumer grep as above, zero hits under `src/`).
- No parallel (`@folder`) or intercepted (`(.)folder`/`(..)folder`) routes exist under `src/app` — `find src/app -type d`, zero matches — so the auto-discovery logic needs no extra handling for them.

### 5.6 The outstanding bundle ceilings this item makes measurable, named precisely

- **C-23's `+6 kB` ceiling** (`C-23-admin-availability-calendar-plan.md:170`) applies to exactly one route: **`/admin/bookings/new`**. Confirmed not yet measured — `redesign/evidence/C-23/closeout-adversarial.md:148` states the bundle-ceiling check was banned for agents that session and not run by anyone.
- **C-20's `+3 kB` ceiling** (`C-20-address-autocomplete-plan.md:183,188`) covers **two distinct surfaces**:
  1. Admin: `ManualBookingForm.tsx`, wired only at `/admin/bookings/new` — the same route as C-23's ceiling.
  2. Customer: `AboutYouStep.tsx`, which is **not** behind any single dedicated route — it is reached through `BookingExperience`, mounted in `src/app/(public)/layout.tsx`, the shared layout for every `(public)` route. This ceiling is a property of the shared `(public)` bundle. **Any** `(public)` route is an equally valid sample for a before/after diff — `/services` and `/home` are not privileged targets, just convenient examples. Phrase this as "any two representative public routes," not as naming those two specifically.
- No plan cites plain `/admin/bookings` (the list page, no further path segment) by name in either C-20 or C-23 — grepped both for `admin/bookings[^/]`, zero matches. It is still useful that auto-discovery picks it up (nothing wrong with measuring more than the minimum), just not because of these two ceilings.
- Roughly nine to eleven earlier plans have a ceiling target the hardcoded six never covered (C-01, C-02, C-03, C-04a, C-05 partially, C-06, C-13, C-15, C-16, C-17 self-acknowledging the gap at its own line 118, C-18) — the exact count is sensitive to how partially-covered plans (e.g. C-05, which spans both an unmeasurable `/admin/bookings/*` ceiling and a measurable `/admin/clients/*` one) are counted. Do not assert a bare number; if a count is wanted, footnote the plan list above.

### 5.7 Verification — exact command sequence, what must move, what must not

```bash
# 1. Build (the ONE permitted build for this item)
pnpm build

# 2. Run the auto-discovering script, capture the new baseline
pnpm exec node scripts/measure-admin-bundles.mjs > redesign/baselines/bundle-post-band-c.json

# 3. Re-run immediately against the SAME .next/ output — must be identical except captured_at
#    (and git_sha, if the run spans a commit boundary, which it should not mid-capture)
pnpm exec node scripts/measure-admin-bundles.mjs > <scratchpad>/rerun.json
diff <(jq 'del(.captured_at)' redesign/baselines/bundle-post-band-c.json) \
     <(jq 'del(.captured_at)' <scratchpad>/rerun.json)
#    -> must be EMPTY

# 4. Confirm nothing unexpected moved in the tree
git status --porcelain
#    MUST show only: the new redesign/baselines/bundle-post-band-c.json (as "??" until staged),
#    plus the pre-existing standing-dirty paths already on the tree, plus " M src/lib/maintenance.ts".
#    MUST NOT show any change to redesign/baselines/bundle-pre-B1.json or anything under src/.
```

**What MUST move:**
- Every route in `bundle-post-band-c.json`'s `routes[]` gets a non-null `first_load_js_gzip_bytes` — no `error` field, no `missing_chunks`, for any of the 44 real routes.
- The discovered route count equals the on-disk `page.tsx` count at build time (44 today; re-verify, do not hardcode).
- `/admin/bookings/new`, `/admin/bookings`, every `(public)/*` route, and `/booking/manage` are present by name in the output.

**What MUST NOT move:**
- `redesign/baselines/bundle-pre-B1.json` — verify via `git status --porcelain -- redesign/baselines/bundle-pre-B1.json` → empty.
- `src/**` — verify via `git status --porcelain -- src/` → only the pre-existing ` M src/lib/maintenance.ts` line.
- Anything outside `scripts/measure-admin-bundles.mjs`, `scripts/measure-admin-bundles.test.ts`, and the two baseline JSON files.

**Sanity anchor** (uncompressed, whole-build magnitude check only — not comparable to the script's per-route gzip figures): the `aca7c18` build had 102 client JS chunk files totaling 4,800,796 bytes (4.58 MiB), and 326,313 bytes (318.7 KiB) of CSS.

If a discovered route's manifest is malformed or has zero `entryJSFiles` (e.g. a pure server component page), `chunksForRoute()` already returns `null` and the route is reported with only an `{ url, error }` shape (existing behavior, unchanged by this item). Auto-discovery may surface more such edge routes than the six hand-picked ones ever hit. **Treat any `error`-shaped route as a discovered route for count purposes** (it still corresponds to a real `page.tsx`), but it fails the "every route gets a non-null `first_load_js_gzip_bytes`" check above — surface it as a named failure in the capture, not a silently-passing count.

### 5.8 Tests to add

New file: `scripts/measure-admin-bundles.test.ts` (mirrors the existing `scripts/measure-admin-contrast.test.ts` pattern; auto-picked-up by `vitest.config.ts`'s `scripts/**/*.test.{ts,tsx}` include — no config change needed).

Requires first extracting the URL-mapping step into a small, pure, exported function — `export function manifestRouteToUrl(manifestRoute: string): string` — rather than leaving it inlined, so it is testable without a real `.next/` build.

1. `it("strips a leading route-group segment", ...)` — asserts `manifestRouteToUrl("(public)/services") === "/services"` and `manifestRouteToUrl("(public)") === "/"`.
2. `it("preserves dynamic segments verbatim", ...)` — asserts `manifestRouteToUrl("admin/clients/[clientId]") === "/admin/clients/[clientId]"`.
3. `it("passes through routes with no route group unchanged", ...)` — asserts `manifestRouteToUrl("booking/manage") === "/booking/manage"` (regression guard for the `/booking/manage` trap named in §5.5).
4. `it("excludes Next-internal boundary manifests from route discovery", ...)` — given a fixture list of manifest paths including `_global-error` and `_not-found`, asserts neither appears in the discovered route set.
5. `it("discovers exactly as many routes as there are page.tsx files on disk", ...)` — integration-style; run only when `.next/` exists in the working tree (skip/guard otherwise, since CI/other sessions may not have a build present); asserts `discoverRoutes().length === <count of page.tsx files under src/app>`, computed at test time, not hardcoded to 44.

### 5.9 Ordering relative to the other items

No other item's file list touches `scripts/measure-admin-bundles.mjs` or either baseline JSON — confirmed by grepping every other item's stated file list for `measure-admin-bundles` and `baselines/`, zero hits. No direct file conflict with any other item.

**Sequencing matters even without a file conflict.** The `.next/` build in the tree right now is at `aca7c18` — Band C complete, none of this follow-up plan's items applied. That is exactly the boundary `bundle-post-band-c.json` should capture. **Run item 5 first**, before items 1, 3, 6, 7, or 8 land (all of which touch `src/`; item 2 is copy-only and item 4 is a migration with no client code, so neither would move bundle bytes). If item 5 runs after other items have already changed `src/`, the resulting "baseline" would blend "post Band C" with "partway through this follow-up plan" — the exact defect this item exists to fix in `bundle-pre-B1.json`.

Items 7 (site-wide CSS cascade-layer/contrast fix) and 8 (travel-charge model — new settings UI, mileage-origin field, series-level controls) will both change bundle bytes once they land, and neither currently carries a stated bundle ceiling of its own. Once item 5's tooling exists, it is the correct tool to set ceilings for items 7/8 — and when those items land, `bundle-post-band-c.json` should be superseded by a new, separately-dated file (never overwritten — the same "never delete a historical baseline" rule this item applies to `bundle-pre-B1.json`).

### 5.10 Stop conditions

1. `pnpm build` (§5.7 step 1) fails, or exits with errors not already accounted for in the standing baselines (handoff: `npx tsc --noEmit` → 0; the build was clean at `aca7c18`). Halt — do not fix forward inside item 5's scope; a build failure here means something upstream broke, which is not this item's job to diagnose.
2. Step 3's self-diff (rerun against the identical `.next/` output) is non-empty. Halt — the script is non-deterministic (e.g. `Set` iteration order, or a timestamp leaking into a field other than `captured_at`); do not ship a baseline captured by a non-deterministic tool.
3. The discovered route count does not equal the on-disk `page.tsx` count. Halt and diagnose — either a real page is being silently skipped (reintroducing the exact failure mode this item exists to fix) or a non-page manifest is being miscounted as a page.
4. `git status --porcelain -- redesign/baselines/bundle-pre-B1.json` shows any change. Halt immediately — this file must never be modified.
5. Any change appears under `src/` after this item's work. Halt — item 5 has no reason to touch `src/`; if a diff appears there, revert it before proceeding rather than folding it into this item's commit.

### 5.11 Rollback

Nothing in this item is irreversible.
- `.next/` is gitignored build output — regenerating or deleting it has no git-visible effect and touches no tracked data.
- `scripts/measure-admin-bundles.mjs`'s edits are an ordinary tracked-file change, revertible like any other.
- `redesign/baselines/bundle-post-band-c.json` is net-new — if its shape or numbers are wrong, delete it and re-run §5.7 step 2; there is no migration, data mutation, or Zone-2 action anywhere in this item to undo.
- `redesign/baselines/bundle-pre-B1.json` is never touched by this item (enforced by stop condition 4), so there is nothing to roll back there by construction.

No Zone-2 action of any kind is required for this item — no migration, data write, deploy, package install, or real email. The single `pnpm build` is the only ordinarily-restricted action this item performs, and it is pre-authorized for this item alone.
