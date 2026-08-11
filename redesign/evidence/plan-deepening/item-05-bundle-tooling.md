# Item 5 deepening — bundle measurement tooling

Plan section audited: `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 300-330 ("ITEM 5 — Make the bundle measurement actually work"), as of commit `33f895f`. Audited at HEAD `0ec700c` (2026-08-11). Handoff read in full first: `redesign/HANDOFF-2026-08-11-PLANNING.md`.

All commands below were run read-only. No file under `src/`, `scripts/`, `e2e/`, `supabase/` was modified. `pnpm build` was **not** run by me — a production build already present in the tree (see §2) was used instead, which is a `read` operation, not a build.

---

## 1 — Anchor verification

| Plan claim | Location | Verdict |
|---|---|---|
| `ROUTES` hardcoded, `scripts/measure-admin-bundles.mjs:31-44` | Read tool, full file | **CONFIRMED, NO DRIFT.** Lines 31-44 are exactly `const ROUTES = [ ... ];` — six entries: `/admin/dashboard`, `/admin/reports`, `/admin/clients/[clientId]`, `/admin/staff/[staffId]`, `/admin/me`, `/admin/staff/[staffId]/performance`. |
| Reconstruction method (build-manifest `rootMainFiles`+`polyfillFiles` unioned with per-route `entryJSFiles`, gzip via node:zlib) | script lines 6-13, 46-100 | **CONFIRMED.** Matches the plan's prose exactly; also matches the script's own header comment verbatim. |
| No package install needed | script lines 25-27 (imports) | **CONFIRMED.** Only `node:fs`, `node:path`, `node:zlib` are imported — all Node built-ins. `package.json` devDependencies contain no bundle-analyzer package. |
| `redesign/baselines/bundle-pre-B1.json` — captured 2026-05-24 at `d2e6512` | Read tool | **CONFIRMED.** File header: `"captured_at": "2026-05-24T13:01:09.277Z", "git_sha": "d2e6512"`. |
| 46 per-route client-reference manifests exist, including `admin/bookings/new`, `admin/bookings`, `(public)/services`, `(public)/home` | recount below | **CONFIRMED** (count and all four named paths present) — **with one imprecision**, see §5. |

Recount command and result:
```
find .next/server/app -name "page_client-reference-manifest.js" | wc -l
→ 46
```

---

## 2 — Does `.next/` currently exist, and what is in it?

`.next/` exists and is **gitignored** (`.gitignore:18` → `/.next/`); `git status --porcelain .next` returns nothing regardless of its contents, confirmed. It contains a full production build (not just the Turbopack dev cache under `.next/dev/`): `BUILD_ID`, `build-manifest.json`, `server/app/**`, `static/chunks/**`, `prerender-manifest.json`, etc.

Critically, this is **not stale garbage** — it is dated and traceable:

```
.next/BUILD_ID mtime:          2026-08-09 22:47:48
.next/build-manifest.json mtime: 2026-08-09 22:47:28
git log -1 --before="2026-08-09 22:47:48" → aca7c18 (2026-08-09 22:46:37) "docs(redesign): C-20, C-14, C-10 shipped..."
```

This is **exactly** the commit the plan's own §5.5 anchor cites ("the end-of-programme build at `aca7c18`"). I confirmed `src/` is byte-identical between `aca7c18` and current HEAD (`0ec700c`):

```
git diff --quiet aca7c18 HEAD -- src/  → exit 0 → "src/ IDENTICAL"
git status --porcelain -- src/         → " M src/lib/maintenance.ts"  (the one documented, deliberate exception)
```

**Implication for the plan:** a production build that faithfully reflects the current `src/` tree (except the deliberately-dirty `maintenance.ts`, a runtime flag unlikely to move bundle bytes) is *already sitting in the working tree*. Item 5's implementer does not strictly need to run a fresh `pnpm build` to develop and unit-verify the auto-discovery change — they can develop and dry-run against the existing `.next/` output, then do exactly one confirming build at the end per §5.4. This should be stated explicitly in the deepened plan so the implementer doesn't burn the one permitted build early out of habit.

I ran the *existing* script (unmodified, read-only, output captured only to my scratchpad, never into the repo) against this existing build to sanity-check every claim in §5.1-5.3 empirically:

```
cd <repo> && pnpm exec node scripts/measure-admin-bundles.mjs > <scratchpad>/bundle-run.json
Exit code: 0
```

Output (excerpted) confirms:
- Exactly the 6 hardcoded routes are reported, in the order listed in `ROUTES`.
- Deltas against `bundle-pre-B1.json` compute correctly (e.g. `/admin/dashboard`: 458.81 → 482.54 kB gzip, delta +23.73 kB — this is the *cumulative* Band B + Band C drift the plan's §5.2 point 2 warns about; it is not attributable to any single plan).
- `/admin/me` and `/admin/staff/[staffId]/performance` have no `baseline_first_load_js_gzip_kb` / `delta_vs_pre_B1_kb` fields (correctly absent — they didn't exist at the pre-B1 baseline, matching the script's `if (baselineRoute)` guard and the baseline file's own `notes`).
- **No file was written to the repo.** `git status --porcelain` before and after the run is unchanged (only the pre-existing standing-dirty paths from the handoff's §6 list appear). The script writes to `process.stdout` only (source line 161) — there is no filesystem write path anywhere in the script. **Confirmed: the plan's implied workflow (build once, then run-and-redirect `> file.json` as many times as needed) cannot dirty the tree by itself; only the shell redirect the operator chooses to add does that, and only writes exactly the file they name.**

---

## 3 — CLI interface and flags

The script currently has **no argv parsing at all** — `process.argv` is never read. It always runs the fixed `ROUTES` list and always writes the full JSON to stdout. The "explicit route filter for focused runs" the plan asks the auto-discovery change to preserve (§5.3a) **does not exist today** — this is new functionality, not a preserved one, and the plan's phrasing ("Keep the ability to...") should be corrected to "Add the ability to..." to avoid an implementer searching for existing filter code that isn't there.

Current usage (from the script's own header comment, verified accurate):
```
pnpm exec node scripts/measure-admin-bundles.mjs               # writes JSON to stdout
pnpm exec node scripts/measure-admin-bundles.mjs > out.json    # capture
```
No flags, no positional args, no `--help`.

**Recommended concrete design for the new filter** (the plan should specify this, not leave it to implementer discretion, given `ManualBookingForm.tsx`-style "implementer's choice" ambiguity has already cost cycles elsewhere in this programme per handoff gotcha 9):
- Accept bare positional args as exact URL matches or path-prefix substrings against the *auto-discovered* URL (not the manifest path), e.g. `node scripts/measure-admin-bundles.mjs /admin/bookings/new` or `node scripts/measure-admin-bundles.mjs /admin/bookings` (prefix match).
- No args → full discovered set (current default behaviour, preserved).
- Zero matches for a supplied filter → non-zero exit + stderr message (fail loud, don't silently emit `"routes": []`).

---

## 4 — Route-shape enumeration (what auto-discovery must handle)

Full recursive directory walk (`find src/app -type d`) and full `page.tsx` enumeration (`find src/app -name page.tsx`) were run. Findings:

- **Route groups:** exactly one exists — `(public)`, applied to 11 directories: `(public)`, `(public)/about`, `(public)/areas`, `(public)/areas/[slug]`, `(public)/cookies`, `(public)/faqs-aftercare`, `(public)/home`, `(public)/privacy`, `(public)/reviews`, `(public)/services`, `(public)/services/[slug]`. **Rule: a path segment wrapped in parens contributes nothing to the URL** — `(public)/services` → `/services`, bare `(public)` (i.e. `src/app/(public)/page.tsx`) → `/`.
- **Dynamic segments:** `[slug]`, `[clientId]`, `[staffId]`, `[bookingId]`, `[templateId]`, `[roleId]`, `[token]`, `[id]` all occur. **Rule: bracket segments pass through into the URL literally** — this already matches the existing hardcoded entries' style (e.g. `/admin/clients/[clientId]`) and requires no new logic; `manifestRoute` and the discovered `url` differ *only* by paren-group stripping.
- **Parallel routes (`@folder`) and intercepted routes (`(.)folder` / `(..)folder`):** **none exist anywhere under `src/app`.** Confirmed by the full directory listing — zero `@*` or `(.)*`/`(..)*` directories. The plan does not need to design for these; state this as a verified absence, not an assumption, so a future implementer doesn't add unneeded generality.
- **Route-group-to-URL mapping edge case — verified directly in the manifest JS, not just inferred:** the internal entry key format is `[project]/src/app/${manifestRoute}/page` for *every* route, parens included (confirmed for both `(public)/home` and `booking/manage` by grepping the raw manifest files). This means the **existing** `chunksForRoute()` entry-key construction (script line 75) needs **zero changes** — `manifestRoute` should stay the literal directory path (parens included) all the way through chunk lookup; only a *separate*, new `manifestRoute → url` mapping function (stripping parens) is needed for the *display/report* `url` field and for the CLI filter in §3.
- **The `booking/manage` trap, checked explicitly as instructed:** `src/app/booking/manage/page.tsx` exists, sits under neither `(public)/` nor `admin/`, and its own top-of-file comment (lines 183-189) explicitly documents that it renders under the **root layout**, deliberately *outside* the `(public)` layout's `ConsentScripts`/`CookieBanner`. It imports `@/components/ui/badge` (a shared UI primitive) and is a genuinely public, unauthenticated, customer-facing page (booking management via emailed token link). **It has no route-group segment to strip, so it needs no special-casing beyond the generic "no parens → URL is the manifest path verbatim" rule** — but the auto-discovery logic must not assume "everything outside `admin/` is under `(public)/`" (e.g. must not special-case-strip a `(public)` prefix unconditionally); it must only strip segments that are *literally* parenthesised, wherever they occur. This route is also independently significant to item 5 because it is the C-17 plan's own +1 kB ceiling target (`/` and `/booking/manage`, see §6) — auto-discovery makes that ceiling measurable by the same script for the first time, alongside every other route.
- **Two special manifests that are not real pages:** `_global-error` and `_not-found` (Next.js internal boundaries — confirmed no `page.tsx` exists for either; they come from `error.tsx`/`not-found.tsx` conventions, not from `page.tsx`). **46 manifests − these 2 = 44, which exactly matches `find src/app -name page.tsx | wc -l` → 44.** This is a strong internal-consistency check the plan should state as an explicit sanity assertion for the implementer: *auto-discovery must yield exactly the same count as `page.tsx` files on disk; if it doesn't, something in the walk or the exclusion list is wrong.* **The plan does not currently say whether `_global-error`/`_not-found` should be included or excluded from the discovered `ROUTES` set — this is a real gap, not just a nice-to-have.** Recommendation: **exclude both** (they are not navigable URLs a user requests; including them with a synthetic `/_not-found` label would misrepresent what's being measured), and add a one-line note explaining why.
- **Non-page directories that must NOT be treated as pages** (confirmed by direct inspection, each is a `route.ts` handler or a supporting directory with no `page.tsx`): `admin/email-templates` (only `actions.ts` + tests — a *different*, legacy-named directory from the real `admin/emails/templates/[templateId]`, easy to visually confuse but functionally unrelated), `admin/email-templates/preview/[id]` (`route.ts`, an API handler, not a page), `admin/signout` (`route.ts`). None of these appear in the 46-manifest list, confirming the walk-by-manifest-existence approach (walking for `page_client-reference-manifest.js` files, as the plan specifies) naturally and correctly skips them — a walk over `src/app` directories instead would have required manually excluding these, so the plan's choice to walk `.next/server/app/**` (post-build output) rather than `src/app` source is the right one and should be kept.

Full manifest listing recount command and result (46 lines):
```
find .next/server/app -name "page_client-reference-manifest.js" | sed 's#\.next/server/app/##; s#/page_client-reference-manifest\.js##' | sort
```
→ `(public)`, `(public)/about`, `(public)/areas`, `(public)/areas/[slug]`, `(public)/cookies`, `(public)/faqs-aftercare`, `(public)/home`, `(public)/privacy`, `(public)/reviews`, `(public)/services`, `(public)/services/[slug]`, `_global-error`, `_not-found`, `admin`, `admin/account-password-requests`, `admin/audit`, `admin/availability`, `admin/bookings`, `admin/bookings/[bookingId]`, `admin/bookings/new`, `admin/bookings/series/[templateId]`, `admin/calendar`, `admin/clients`, `admin/clients/[clientId]`, `admin/clients/[clientId]/edit`, `admin/clients/new`, `admin/dashboard`, `admin/emails`, `admin/emails/templates/[templateId]`, `admin/enquiries`, `admin/login`, `admin/me`, `admin/operations`, `admin/password-reset`, `admin/password-reset/[token]`, `admin/privacy`, `admin/reports`, `admin/roles`, `admin/roles/[roleId]`, `admin/services`, `admin/settings`, `admin/staff`, `admin/staff/[staffId]`, `admin/staff/[staffId]/availability`, `admin/staff/[staffId]/performance`, `booking/manage`.

---

## 5 — The outstanding bundle ceilings: where recorded, and exactly which route each applies to

Both are recorded in the individual C-phase plans' own §3 "Verification gate" sections, not in a central registry:

- **C-23's `+6 kB` ceiling** — `redesign/plans/C-phase/C-23-admin-availability-calendar-plan.md:170`: *"bundle (**+6 kB ceiling on `/admin/bookings/new`**, 0 elsewhere; no new package)"*. Applies to exactly one route: `/admin/bookings/new`. Independently confirmed **not run**: `redesign/evidence/C-23/closeout-adversarial.md:148` — *"`pnpm build` / bundle-ceiling measurement (+6 kB) — banned for agents this session; not run by me or by any prior verifier this programme."*

- **C-20's `+3 kB` ceiling** — `redesign/plans/C-phase/C-20-address-autocomplete-plan.md:183,188`: *"ceiling +3 kB per form bundle"*, and *"only `scripts/measure-admin-bundles.mjs` exists (admin side). For the customer side there is no named script — compare `pnpm build` first-load-JS output for the `(public)` routes before vs after and record both numbers against the +3 kB ceiling."* This applies to **two distinct surfaces, not one**:
  1. **Admin:** `ManualBookingForm.tsx`, which renders at `/admin/bookings/new` — the *same route* as C-23's ceiling. (Confirmed by grep: `ManualBookingForm.tsx` is only ever wired at `src/app/admin/bookings/new/`.)
  2. **Customer:** `AboutYouStep.tsx` (`src/features/booking/components/AboutYouStep.tsx`), which is **not** rendered from a single dedicated route. It is reached through `BookingExperience`, which is mounted in `src/app/(public)/layout.tsx` — the **shared layout for every `(public)` route**. This means the C-20 customer-side ceiling is a property of the shared `(public)` bundle, not any one page; **any** `(public)` route (e.g. `/home`) is an equally valid, representative sample for measuring it, and the plan's mention of `(public)/services` and `(public)/home` in §5.1 should be read as "any two representative public routes for a before/after diff," not as "these two specifically carry the ceiling." I recommend the deepened plan say this explicitly, because as currently worded it reads as if `/services` and `/home` are privileged targets, which is not accurate to the code.

**One overclaim to correct in §5.1:** the plan states the 46-manifest set includes `admin/bookings/new, admin/bookings, (public)/services and (public)/home — every route the outstanding ceilings care about.` I confirmed all four paths exist in the manifest set (true), but I could **not** find any documented ceiling that names plain `/admin/bookings` (the list page, not `/new`) specifically — grepped `redesign/plans/C-phase/C-20-address-autocomplete-plan.md` and `C-23-admin-availability-calendar-plan.md` for `admin/bookings[^/]` and variants: no match. Only `/admin/bookings/new` has a directly-cited ceiling from either plan. Recommend softening §5.1's wording to name only `/admin/bookings/new` and `(public)/*` as the ceiling-relevant routes, and drop the implication that plain `/admin/bookings` itself carries one (it's still fine — indeed good — that auto-discovery picks it up anyway, just not because of these two ceilings).

**"along with nine earlier plans'" — UNVERIFIABLE to the stated precision.** I grepped every `C-phase/C-*.md` plan for a bundle-ceiling line and manually checked each cited target route against the six hardcoded `ROUTES` entries. Plans whose ceiling target(s) are **not** covered by the hardcoded six (i.e. were genuinely unmeasurable by the existing script, matching the plan's claim): C-01 (`/admin/emails/*`), C-02 (`/admin/bookings/*`), C-03 (`/admin/bookings/new`, `/admin/bookings/[id]`), C-04a (`/admin/bookings/*`), C-05 (`/admin/bookings/*` portion), C-06 (`/admin/clients/[id]/edit`, clients list — neither is the one clients route that *is* hardcoded), C-13 (`/admin/bookings/*`, `/admin/calendar/*`), C-15 (`/admin/emails/templates/[id]`, `/admin/emails`), C-16 (bookings-adjacent), C-17 (public routes — plan **self-acknowledges** this at its own line 118: *"no public-route bundle script exists"*), C-18 (public routes). That is **eleven** plans by my count, not nine, though the exact number is sensitive to how you treat partially-covered plans (e.g. C-05's ceiling spans both `/admin/bookings/*`, unmeasurable, and `/admin/clients/*`, partially measurable via the hardcoded `[clientId]` route — whether that counts as "measurable" or not is a judgment call the plan doesn't define). **I cannot reproduce "nine" exactly without knowing the plan author's counting rule; report as approximately nine-to-eleven, and recommend the deepened plan either drop the precise number or footnote the exact plan list** (I've supplied it above) so a reader can verify it rather than trust an uncited count — consistent with this session's own stated goal of not letting plan prose assert unverified numbers.

---

## 6 — Test coverage for the script itself

```
Glob: scripts/**/*.test.* → scripts/verify-admin-token-contrast.test.ts, scripts/measure-admin-contrast.test.ts
```
**`scripts/measure-admin-bundles.mjs` has no test file today.** (The two that exist belong to item 7's contrast tooling, not this script.) `vitest.config.ts` confirms `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]` — so a new `scripts/measure-admin-bundles.test.ts` *would* run under `pnpm vitest run` / `pnpm test:unit`, same as the item-7 scripts already do. The plan's §5.3/§5.5 don't ask for a test to be added; given the auto-discovery logic is new, non-trivial (route-group stripping, dynamic-segment passthrough, `_global-error`/`_not-found` exclusion) and currently exercised only by eyeballing full-build output, I recommend adding one (see §8 below) — this is squarely the kind of pure-logic change the repo's own convention (item 7's scripts) already tests in isolation from a real build.

---

## 7 — Blast radius

**Files to edit:**
- `scripts/measure-admin-bundles.mjs` — add auto-discovery (walk `.next/server/app/**` for `page_client-reference-manifest.js`), the paren-stripping `manifestRoute → url` mapping, the new CLI filter, and baseline-file preference logic (prefer `bundle-post-band-c.json` when present, else fall back to `bundle-pre-B1.json`, per §5.3b).
- `redesign/baselines/bundle-post-band-c.json` — **new file**, written by running the script once and capturing stdout (`> redesign/baselines/bundle-post-band-c.json`), with `git_sha`/`captured_at` metadata added by hand or by the script (the current script does not emit `git_sha` at all — `bundle-pre-B1.json`'s `git_sha`/`branch`/`node_version`/`pnpm_version`/`sentry_nextjs` fields were added by hand after generation, not by the script; the current script's own `result` object only emits `captured_at`, `next_version`, `measurement_method`, `shared_baseline`, `routes`, `baseline_used` — **no `git_sha` field exists in the script's output today**. If the deepened plan wants the new baseline to "record the commit it was taken at" (§5.3b), either the script must be extended to shell out to `git rev-parse --short HEAD` and embed it, or the implementer must add it by hand exactly as was done for `bundle-pre-B1.json`. This should be made explicit — it's currently an implicit requirement inferred from the existing baseline's shape, not stated as a script change.
- (Optional, recommended) `scripts/measure-admin-bundles.test.ts` — new test file, see §6/§8.

**Callers/consumers of the script, confirmed:**
```
grep -rn "measure-admin-bundles|bundle-pre-B1|bundle-post-band-c" (excluding redesign/) → only scripts/measure-admin-bundles.mjs itself
```
No entry in `package.json` `scripts`, no reference in `next.config.ts`, no `.github/` workflow, no `.husky/` hook. **The script is invoked only by hand (`pnpm exec node scripts/...`), by no automation.** This means the blast radius of changing it is contained entirely to the script file and the two baseline JSON files — nothing else in the build or CI pipeline depends on its current shape or its current six-route output.

**Tests affected:** none — there is no existing test for this script (see §6), so no existing test can break from this change.

**Shared with public/customer site:** **none.** This item touches only `scripts/` and `redesign/baselines/`. It never edits anything under `src/`, so nothing customer-facing changes as a result of this item. (The customer-facing surfaces it *measures* — `(public)/*` and `booking/manage` — are read-only targets of the script, not edited by it.)

**Proven not affected (what I checked, and how):**
- No other script or config file references `measure-admin-bundles.mjs` or either baseline JSON file (`grep -rn` above, zero hits outside `redesign/` docs and the script itself).
- `package.json` has no `scripts` entry wrapping this file (`Read` of `package.json`, confirmed).
- No CI/hook wiring: `grep -rn "measure-admin-bundles" .github/` and `.husky/` — both zero matches.
- `vitest`'s `include` picks up any new `scripts/**/*.test.{ts,tsx}` file automatically — confirmed by reading `vitest.config.ts` — so a new test file needs no config change.
- `src/` is untouched by this item (grep of the plan's own §5.3 change description — it only names `scripts/measure-admin-bundles.mjs` and the baseline file); confirmed no `src/` file exists that imports from `scripts/` (scripts in this repo are standalone Node CLIs, not imported by app code — spot-checked via the same consumer grep above, zero hits under `src/`).
- No parallel or intercepted routes exist under `src/app` for the auto-discovery logic to mishandle (`find src/app -type d`, zero `@*`/`(.)*`/`(..)*` entries) — the plan does not need extra logic for these, and the deepened plan should say so affirmatively rather than leave it unstated.

---

## 8 — Tests to add (named, with exact file)

New file: `scripts/measure-admin-bundles.test.ts` (mirrors the existing `scripts/measure-admin-contrast.test.ts` pattern; picked up automatically by `vitest.config.ts`'s `scripts/**/*.test.{ts,tsx}` include).

Requires the implementer to first extract the URL-mapping step into a small, pure, exported function (e.g. `export function manifestRouteToUrl(manifestRoute: string): string`) rather than inlining it into the top-level script body — this is the one small refactor needed to make the logic testable without a real `.next/` build.

1. **`"manifestRouteToUrl strips a leading route-group segment"`** — asserts `manifestRouteToUrl("(public)/services")` === `"/services"` and `manifestRouteToUrl("(public)")` === `"/"`.
2. **`"manifestRouteToUrl preserves dynamic segments verbatim"`** — asserts `manifestRouteToUrl("admin/clients/[clientId]")` === `"/admin/clients/[clientId]"`.
3. **`"manifestRouteToUrl passes through routes with no route group unchanged"`** — asserts `manifestRouteToUrl("booking/manage")` === `"/booking/manage"` (regression guard for the known trap named in the task).
4. **`"route discovery excludes Next-internal boundary manifests"`** — given a fixture list of manifest paths including `_global-error` and `_not-found`, asserts neither appears in the discovered route set.
5. **`"route discovery count matches the page.tsx count on disk"`** (integration-style, run only when `.next/` exists — skip/guard otherwise) — asserts `discoverRoutes().length === (number of page.tsx files under src/app)`, i.e. 44 at time of writing; this directly encodes the §4 sanity check above so a future silent regression (e.g. a stray directory reintroducing the ROUTES-omission failure mode) fails a test instead of only being caught by eyeballing.

---

## 9 — Ordering relative to the other 7 items

No other item's file list touches `scripts/measure-admin-bundles.mjs`, `redesign/baselines/bundle-pre-B1.json`, or `redesign/baselines/bundle-post-band-c.json` — confirmed by reading the full plan and grepping every other item's stated file list for `measure-admin-bundles` and `baselines/` (zero hits). **No direct file conflict with items 1-4 or 6-8.**

There is, however, a real **sequencing** consideration the plan does not currently state:

- The `.next/` build presently in the tree is at `aca7c18` — i.e. **Band C complete, none of this follow-up plan's 8 items applied yet** (per the handoff: "8 items... ZERO implemented"). This is precisely what a baseline file named `bundle-post-band-c.json` should capture: the state right after Band C, before any of items 1-8 land. **Recommendation: run item 5 first, before items 1, 3, 6, 7, or 8 land** (items that touch `src/`; item 2 is copy-only, item 4 is a migration with no client code) — capturing `bundle-post-band-c.json` from the *existing* build (or one fresh confirming build) while it still reflects that exact boundary. If item 5 runs *after* other items have already changed `src/`, the resulting baseline would silently blend "post Band C" with "partway through the follow-up plan," defeating the stated purpose of a clean re-baseline (§5.2 point 2's own complaint about `bundle-pre-B1.json` mixing Band B and Band C).
- Items 7 (admin colour/contrast — a site-wide CSS cascade-layer fix) and 8 (travel-charge model — new admin UI: a settings page, a mileage-origin field, series-level controls) will both materially change bundle bytes once they land. **Neither currently has a stated bundle ceiling in the plan text I was assigned (lines 300-330 only cover item 5; items 7/8 are out of my scope) — this is worth flagging to whoever owns items 7/8's sections: once item 5's tooling exists, it should be used to set ceilings for items 7/8 too, and `bundle-post-band-c.json` will need to be superseded (not overwritten — a new dated file, following the same "never delete a historical baseline" rule the plan already states for `bundle-pre-B1.json`) once those items land, if the Owner wants their deltas attributed cleanly.**

---

## 10 — Exact build+measure+diff command sequence (item 5 is the only item permitted a build)

```bash
# 1. Build (the ONE permitted build for this item)
pnpm build

# 2. Run the (now auto-discovering) script, capture to the new baseline
pnpm exec node scripts/measure-admin-bundles.mjs > redesign/baselines/bundle-post-band-c.json

# 3. Re-run immediately against the SAME .next/ output and diff — must be byte-for-byte
#    identical except captured_at (proves determinism / no accidental double-counting)
pnpm exec node scripts/measure-admin-bundles.mjs > /tmp-or-scratchpad/rerun.json
diff <(jq 'del(.captured_at)' redesign/baselines/bundle-post-band-c.json) \
     <(jq 'del(.captured_at)' /tmp-or-scratchpad/rerun.json)
#    → must be EMPTY

# 4. Confirm nothing else in the tree moved
git status --porcelain
#    MUST show only: the new redesign/baselines/bundle-post-band-c.json (if not yet
#    `git add`-ed it appears as "??"), plus the pre-existing standing-dirty paths from
#    handoff §6 (design_handoff_area_pages/, photos-rahma-therapy/, test-results/,
#    redesign/evidence/C-21/*.png, .playwright-mcp/ deletions) and " M src/lib/maintenance.ts".
#    MUST NOT show any change to redesign/baselines/bundle-pre-B1.json.
```

**What MUST move:** every route in the new baseline's `routes[]` array gets a non-null `first_load_js_gzip_bytes` (no `error` field, no unexplained `missing_chunks`); the route count in the new baseline equals the `page.tsx` count minus zero (i.e. auto-discovery finds all 44 real routes, or however many exist at build time — re-verify the count at build time, don't hardcode "44" into an assertion since new pages may have landed by then); `admin/bookings/new`, `admin/bookings`, every `(public)/*` route, and `booking/manage` are all present by name.

**What MUST NOT move:** `redesign/baselines/bundle-pre-B1.json` (untouched — verify via `git status --porcelain -- redesign/baselines/bundle-pre-B1.json` → empty); `src/**` (untouched by this item — verify via `git status --porcelain -- src/` → only the pre-existing `maintenance.ts` line); any file outside `scripts/measure-admin-bundles.mjs` and the two baseline JSONs.

---

## 11 — Stop conditions

- `pnpm build` (step 1 above) fails, or exits with new TypeScript/build errors not already accounted for in the standing baselines (handoff §6: `npx tsc --noEmit` → 0; build was previously clean at `aca7c18`). **Halt — do not "fix forward" inside item 5's scope; a build failure here means something upstream broke, which is not this item's job to diagnose.**
- Step 3's self-diff (rerun against identical `.next/` output) is **non-empty**. This means the script is non-deterministic (e.g. `Set` iteration order, or a timestamp leaking into a field other than `captured_at`) — **halt, do not ship a baseline captured by a non-deterministic tool.**
- The auto-discovered route count does not equal the on-disk `page.tsx` count (see §4's sanity check). **Halt and diagnose** — either a real page is being silently skipped (reintroducing the exact failure mode this item exists to fix) or a non-page manifest (a future `_something` special file, or a route-group index) is being miscounted as a page.
- `git status --porcelain -- redesign/baselines/bundle-pre-B1.json` shows any change. **Halt immediately** — the plan is explicit this file must never be modified.
- Any change appears under `src/` after this item's work. **Halt** — item 5 has no reason to touch `src/`; if a diff appears there, something unrelated leaked in (e.g. an accidental save, or a stray auto-formatter run) and must be reverted before proceeding, not folded into this item's commit.

## 12 — Rollback

Nothing in this item is irreversible or destructive:
- `.next/` is gitignored build output — deleting or regenerating it has no git-visible effect and touches no tracked data.
- `scripts/measure-admin-bundles.mjs`'s edits are a normal tracked-file change — `git diff`/`git restore` (on request, not unilaterally per the standing rules) reverts them like any other code change.
- `redesign/baselines/bundle-post-band-c.json` is a **net-new** file — if its shape or captured numbers turn out wrong, simply delete it and re-run step 2 of §10; there is nothing to "undo" in Supabase, no migration, no data mutation anywhere in this item.
- `redesign/baselines/bundle-pre-B1.json` is never touched by this item at all (enforced by the stop condition in §11), so there is nothing to roll back there by construction.

No Zone-2 action of any kind is required for this item — no migration, no data write, no deploy, no package install, no real email. The single `pnpm build` is the only ordinarily-restricted action this item performs, and it is explicitly pre-authorized by the plan for this item alone.
