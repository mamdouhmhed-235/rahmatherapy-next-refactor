# C-18 — Phases D-fix / E / F — independent FULL verification

**Verifier:** fresh subagent, no prior involvement in this plan. **Model:** as configured for this run.
**Scope:** `c327973` (Phase D fix), `3e9f8b5` (Phase E — Steps 10-11), `295f4d2` (Phase F — Step 12).
**Baseline:** `032bdca` (migration-applied chore commit, no app code). `git diff 032bdca..295f4d2 --stat`:

```
 src/app/(public)/cookies/page.tsx                  |   7 +-
 src/app/api/consent-events/route.test.ts           | 174 +++++++++++++
 src/app/api/consent-events/route.ts                | 114 +++++++++
 src/app/booking/manage/page.tsx                    |  20 ++
 .../consent/__tests__/consent-logging.test.ts      | 272 +++++++++++++++++++++
 .../consent/__tests__/consent-transitions.test.ts  |  27 ++
 src/components/consent/consent-store.ts            | 115 ++++++++-
 src/components/layout/SiteFooter.tsx               |  49 ++--
 .../layout/__tests__/SiteFooter.test.tsx           |  68 ++++++
 src/lib/consent/cookie-registry.ts                 |   9 +
 10 files changed, 837 insertions(+), 18 deletions(-)
```

Every file is inside C-18's established files-touched family (registry, consent-store, the route + its test, the /cookies page, SiteFooter + its test, and `booking/manage/page.tsx`, whose use is explicitly anticipated by the plan's C18-F9 note and the orchestrator's Phase F decision recorded in the `295f4d2` commit message). No unexpected file. `src/lib/maintenance.ts` absent from all three commits. `src/app/layout.tsx` (root) untouched (`git diff 032bdca..295f4d2 -- src/app/layout.tsx` empty). `package.json`/lockfile unchanged; `zod` was already a dependency (`^4.3.6`). `git worktree list` shows one worktree only. `git status --porcelain` = 280 lines, 258 of them `D` (pre-existing deletions, intact); the other 22 are the standing `src/lib/maintenance.ts` dirty file, an in-progress append to the C-18 progress doc (4 lines, docs only), and untracked evidence/photo/design directories predating this session. No unrestored edit found anywhere else in the tree.

**Hash re-confirmation (orchestrator's claim about the implementer's in-place bundle-measurement revert):**
```
consent-store.ts   working tree = 9f285604c40f1a03b4efab91f5173cde0f2ed877 = HEAD blob   (match)
SiteFooter.tsx     working tree = 36005d617707b4bff3a967bf6243281afe66aaff = HEAD blob   (match)
```
Both intact. No other tracked file shows an unexplained diff from HEAD.

**Amend corroboration for `3e9f8b5`** (read-only `git log`, no reflog needed): AuthorDate `20:23:40 +0100`, CommitterDate `20:24:24 +0100` — a 44s gap consistent with the claimed single in-session amend. The commit's actual diff includes `src/app/(public)/cookies/page.tsx`, and the commit message explicitly describes that file's change ("/cookies page's 'How we record your choice' copy updated...") — contents match the message.

---

## Lead item 1 — the route's failure modes (`src/app/api/consent-events/route.ts`)

Read directly, not inferred from tests.

- **Valid payload → row inserted.** `supabase.from("consent_events").insert({...})` (lines 93-100), fields taken from `parsed.data` after zod validation.
- **No `.select()` chained on the insert — CONFIRMED.** Line 94-100 is a bare `.insert({...})`; the destructure `const { error } = await supabase.from(...).insert(...)` never calls `.select()`. `route.test.ts`'s mock query builder only exposes `.insert()` (no chainable `.select()`), and the test "inserts exactly the validated fields, with no .select() chained" pins that a `.select()` call would throw (mock has no such method), get caught, and log "insert threw" instead of leaving `console.error` untouched — the test asserts `console.error` was NOT called on the happy path, which would fail if `.select()` were chained.
- **Malformed shape → 204, no insert attempted.** `consentEventSchema.safeParse` failure returns early (`return noContent()`) at line 76-82, before the `supabase.from(...).insert(...)` call is ever reached. `console.error("[consent-events] dropped: malformed payload", ...)` fires first. Test: "204s on a malformed shape and never attempts an insert" — confirms `insert` not called, `console.error` called.
- **Unknown `banner_version` → dropped, still 204.** Line 84-90 checks `KNOWN_BANNER_VERSIONS.includes(parsed.data.banner_version)` before the insert; `KNOWN_BANNER_VERSIONS` (`src/lib/consent/cookie-registry.ts:38`) is `readonly string[] = [CONSENT_BANNER_VERSION]`, exported from the registry file as required. Test confirms drop + `console.error` with the exact rejected version.
- **Oversized body → rejected cheaply, before full parse.** Two checks: (1) `Content-Length` header pre-check (lines 49-52) rejects before even calling `request.text()`; (2) an actual-byte-length check via `TextEncoder().encode(rawBody).length` (lines 61-66) rejects before `JSON.parse` — both precede the zod parse. Tests cover both the header-present and header-absent/wrong cases.
- **Supabase `error` is captured and logged, not discarded — CONFIRMED.** Lines 106-108: `if (error) { console.error("[consent-events] insert failed", error); }` — the destructured `error` from the insert result is checked and logged, exactly the C-04a failure class the migration's own comment warns about. Test "204s and logs, without throwing, on a DB error" mocks `insert` to resolve `{ error: { code: "42501", ... } }` and asserts `console.error` was called with that object.
- **DB error → 204, logged, not thrown.** Confirmed by the same test; a thrown admin-client construction is separately covered ("204s and logs... when the admin client itself throws") via the outer `try/catch` (lines 92-111) logging `"[consent-events] insert threw"`.
- **No test writes to the live database.** `route.test.ts` mocks `@/lib/supabase/admin` entirely (`vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))`) and stubs `from`/`insert`. Confirmed empirically too: live `SELECT count(*) FROM public.consent_events` → **0** (see DB section below).

**Verdict: PASS.** Every failure mode behaves exactly as specified, verified from source, not restated from tests.

---

## Lead item 2 — the `action` mapping

`determineConsentAction()` (`src/components/consent/consent-store.ts:175-191`):

```ts
if (purposes.some((purpose) => previous[purpose] && !next[purpose])) return "withdrawn";
if (!hadPriorRecord) return purposes.some((purpose) => next[purpose]) ? "granted" : "rejected";
return "updated";
```

This is a literal match for the specified three-branch rule. Boundary cases re-derived and cross-checked against `consent-logging.test.ts`:

| Case | Re-derivation | Test | Result |
|---|---|---|---|
| First-visit reject-all | no prior record, nothing granted → `rejected` | "logs 'rejected' for a first choice that switches nothing on" | PASS |
| Withdraws one purpose, grants another in the same click | `previous.analytics && !next.analytics` true → `withdrawn`, regardless of the other purpose | "logs 'withdrawn' — not 'updated' — even when another purpose is granted in the same click" | PASS |
| Save that changes nothing | no purpose newly denied, prior record exists → `updated` (the rule has no "no-op, don't log" branch — a re-save is still logged) | "logs 'updated' even when re-saving the exact same prior choice" | PASS |
| Re-grant after a withdrawal | prior record exists (the withdrawn state), nothing newly denied → `updated`, not `granted` — literal reading of "else → updated" | "logs 'updated' when a prior record exists and nothing already-granted is withdrawn" | PASS |

`consent_id`: `logConsentEvent` sends `state.id`, and `writeConsent()` (`src/lib/consent/consent-state.ts:144`) preserves `existing?.id` when a prior cookie parses, minting fresh only when none exists — so a withdrawal's logged `consent_id` is the same id as the grant it revokes, joinable. Confirmed by test "carries the just-written state's own id, banner version and choices".

`banner_version`: `state.v = CONSENT_BANNER_VERSION` set unconditionally in `writeConsent()` (line 139) — always the current constant, never anything else.

`choices`: `state.choices` is exactly what was just written (line 145), not derived or filtered.

`purposes_offered`: `Object.keys(state.choices)`, **not** literally read off `COOKIE_REGISTRY`/`GATED_PURPOSES` at the call site — one finding below (Finding 1, LOW).

**Verdict: PASS**, one LOW finding.

---

## Lead item 3 — ordering on the withdrawal path

Traced through `recordConsentChoices()` (`consent-store.ts:331-351`): `writeConsent()` → `notify()` → **`logConsentEvent(...)` synchronously** → `void applyChoiceTransition(previous, state.choices)` (not awaited). `applyChoiceTransition`'s withdrawal branch (lines 286-323) is what calls `window.location.reload()`. Because `logConsentEvent` is a plain synchronous function (not `async`) that calls `navigator.sendBeacon` (also synchronous — it queues the request and returns a boolean) before `applyChoiceTransition` is even invoked, the beacon dispatch is guaranteed to complete before the reload-triggering code starts running — this is ordering by construction (single-threaded JS, not a race), not merely usual-case timing.

- **`sendBeacon` preferred, `fetch(keepalive)` fallback** — confirmed at `consent-store.ts:222-238`: tries `navigator.sendBeacon`, falls back to `fetch(..., { keepalive: true }).catch(() => undefined)` only if `sendBeacon` is unavailable or declines (`false`).
- **Consent UX never awaits the log** — `logConsentEvent` returns `void`, and `recordConsentChoices` never awaits it; test "recordConsentChoices returns the state synchronously even while the network call is still pending" proves the caller gets the `ConsentState` back synchronously even with a never-resolving `fetch`.
- **A test pins the ordering directly** — `consent-logging.test.ts`, describe "ordering on the withdrawal path": `expect(sendBeacon.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0])`. A second test in the same block sanity-checks the assertion is meaningful (a grant never reloads, so the ordering check "only bites on withdrawal").

**Verdict: PASS.**

---

## Lead item 4 — the Phase D fix (`c327973`)

New test in `consent-transitions.test.ts` (lines ~180-206): registers `ALL_GRANTED` via `storedChoice()`, calls `unregisterReplayGateForTests()` (undoing the suite's `beforeEach registerReplayGate(replayGate)`), then withdraws analytics and asserts, in one test: no throw, `replayGate` not called, `analyticsUpdates() === ["denied"]`, `_ga` cookie gone, `reload` called exactly once. This genuinely exercises the unregistered-gate branch (`replayGate?.(...)` no-ops when `replayGate` is `undefined`) and proves the rest of the withdrawal — Consent Mode denial, GA cookie clearing, and the reload — still completes.

**The new helper cannot weaken other tests.** `unregisterReplayGateForTests()` (`consent-store.ts:375-377`) is a distinct export from `resetConsentStoreForTests()`; grep confirms exactly one call site in the whole tree (the new test itself). `resetConsentStoreForTests()` — which `storedChoice()` calls mid-test in every other withdrawal test in this file — does not touch `replayGate` at all (it only resets `snapshot`/`hasRead`/`panelOpen`/listener sets), so every other test's `beforeEach`-registered gate survives untouched. Confirmed by running the whole file: 15/15 pass.

**Verdict: PASS.**

---

## Lead item 5 — Phase F, the link works from everywhere

- **`SiteFooter.tsx` stays a server component** — no `"use client"`, no hooks, no consent-store import (confirmed by reading the full file). The new anchor is a plain `<a href="?cookie-settings=1" data-cookie-settings-trigger="true">Cookie settings</a>`, answered by `CookieBanner`'s existing delegated click listener (`COOKIE_SETTINGS_TRIGGER = '[data-cookie-settings-trigger="true"]'`, `CookieBanner.tsx:35,127`) and its `?cookie-settings=1` on-load check — confirmed present in `CookieBanner.tsx`, unmodified by these commits.
- **Appears on every `(public)` page** — `SiteFooter` is mounted exactly once, unconditionally, in `src/app/(public)/layout.tsx:33` (untouched by these three commits), so every route under the `(public)` group gets it structurally, not per-page.
- **`src/app/booking/manage/page.tsx`** — read in full: no `CookieBanner`/`ConsentScripts` import or mount; instead a `<Link href="/cookies/">cookies page</Link>` inside a paragraph that plainly states the page "doesn't run the cookie banner here" and that choices can be changed "for the rest of the site" via the linked page — accurately describes navigation, not an in-place toggle.
- **C-17's guard test still passes.** `src/app/booking/__tests__/no-google-analytics.test.ts` scans every `.ts`/`.tsx` under `src/app/booking/` (excluding `__tests__`) for the literal string `"GoogleAnalytics"` and asserts zero hits; `booking/manage/page.tsx` contains no such reference. Ran standalone: 2/2 pass.
- **Test proves real behaviour, not decoration** — `SiteFooter.test.tsx`'s second describe block renders `<SiteFooter /><CookieBanner />` together and asserts `screen.getByRole("dialog")` appears only after clicking the footer's "Cookie settings" link — an actual click-to-open assertion, not just an attribute check.

**Verdict: PASS.**

---

## Lead item 6 — truthfulness sweep (regenerated independently)

Every visitor-facing string touched or newly true/false as of `295f4d2`, found by re-diffing the three commits for rendered copy (not by trusting the implementer's list):

| # | String | Location | Verdict | Why |
|---|---|---|---|---|
| 1 | "How we record your choice" (heading, unchanged text but its truth condition changes with Phase E) | `/cookies` page | **TRUE** | A cookie *and* a server-side record now both exist; the heading's claim is doubly satisfied. |
| 2 | Body: "...stores that answer in a small cookie...random reference number...isn't linked to your name...the version...and what you chose. It stays for six months..." | `/cookies` page (unchanged half of the paragraph) | **TRUE** | Matches `ConsentState {id, v, choices, ts}`, `CONSENT_MAX_AGE_S` = 182 days ≈ 6 months. Pre-existing, re-verified. |
| 3 | "We also keep an internal record of that same choice — the reference number, the version shown, and what you chose — for as long as we rely on it as evidence of your consent." | `/cookies` page (new sentence, `3e9f8b5`) | **TRUE** | Every `recordConsentChoices()` call unconditionally calls `logConsentEvent()`, which posts to a route that inserts `consent_id`, `banner_version`, `purposes_offered`, `choices`, `action` on every valid, known-version payload (confirmed via source read + tests). Retention: no pruning exists (Q8.3 is C-12+), matching "as long as we rely on it" — no scheduled deletion contradicts this. |
| 4 | "Neither the cookie nor that record ever includes your IP address, your name, or anything else that identifies you." | `/cookies` page (new sentence, `3e9f8b5`) | **TRUE** | `route.ts`'s insert payload is exactly `{consent_id, banner_version, purposes_offered, choices, action}` — no IP/UA/name field is read from the request or included anywhere in the route. |
| 5 | "Cookie settings" (footer link label) | `SiteFooter.tsx` (new, `295f4d2`) | **TRUE / not misleading** | Opens the real preferences panel via the existing delegation; label makes no claim beyond what it does. |
| 6 | "This page keeps to what your booking needs and doesn't run the cookie banner here. You can still view or change your cookie choices for the rest of the site on our cookies page." | `booking/manage/page.tsx` (new, `295f4d2`) | **TRUE** | Root layout (untouched, confirmed by reading `src/app/layout.tsx`) mounts neither `ConsentScripts` nor `CookieBanner`; `/cookies` genuinely lets a visitor view/change choices. Correctly frames it as a navigation, not an in-place control. |
| 7 | "cookies page" (link text) | `booking/manage/page.tsx` | **TRUE** | Points to `/cookies/`, which is exactly what it claims to be. |

No `<title>`/`<meta>` changed by these three commits (`/cookies`'s metadata block and `booking/manage`'s `title` are untouched in the diff — confirmed by reading both files against `git diff`). No new heading, aria-label, or badge string was introduced by these commits beyond the ones above.

**Verdict: all 7 strings TRUE at `295f4d2`.** No false statement found, non-prose or prose.

---

## Lead item 7 — bundle re-measurement

**Method** (deliberately identical to the Phase D verifier's, `redesign/evidence/C-18/phase-d-verify-full.md`, for a genuinely comparable number): one `npx next build` (no env vars) of the current tree at `295f4d2`, then sum the real `zlib.gzipSync(buf, {level: 9})` size of every `/_next/static/chunks/*.js` file referenced in the prerendered `home.html`. Script: scratchpad `phase-ef-measure-bundle.mjs`.

```
Script count: 16
TOTAL raw: 850.07 kB
TOTAL gz : 262.72 kB
```

**Baseline used:** the Phase D verifier's own independently-reproduced figure at `d29958f` — **849.11 kB raw / 261.19 kB gz**, 15 files, same method, same compression level, cross-corroborated in that report against a second independent agent's 260.7 kB gz measurement of the same commit state. `d29958f` is code-identical to `032bdca` (the migration commit adds only a `.sql` file, no app code), so this is a legitimate "before" for these three commits without checking anything out myself.

**My independently-measured delta: +0.96 kB raw / +1.53 kB gz.** This closely corroborates the implementer's claimed **+0.99 kB raw / +1.56 kB gz** (within 0.03-0.04 kB — well inside the noise of a from-scratch Turbopack rebuild, whose content-hashed chunk boundaries differ from run to run: I found 16 referenced chunk files where the Phase D verifier found 15, consistent with re-splitting rather than a discrepancy — the method sums total bytes precisely to be robust to this).

**On "gzip delta bigger than raw delta" being unusual:** confirmed present in my own measurement too (raw +0.96 kB vs gz +1.53 kB, versus the bundle's overall ~3.24:1 average compression ratio). This is not a sign of a bad measurement — I reproduced it independently via a different build run — and it is explained by what actually changed: `SiteFooter.tsx` and `booking/manage/page.tsx` are both **server components**, so their diffs (footer anchor markup, the new paragraph) contribute zero bytes to this metric, which only sums client-side `/_next/static` scripts. The entire measured delta is attributable to real new **client** code in `consent-store.ts` (Phase E's `determineConsentAction`, `logConsentEvent`, the `/api/consent-events/` string, JSON field-name literals like `"consent_id"`/`"purposes_offered"`) — content that is less repetitive/less self-similar to the rest of the bundle than average JS, which plausibly compresses somewhat worse than the bundle's average ratio. This is a real, reproducible, small increase, not a measurement artefact.

**Context passed through, not decided here:** the Owner ratified a cumulative ≈5.19 kB gz delta (through Phase C, partly ratio-derived) against a 5 kB ceiling; the Phase D verifier separately measured a true +0.51 kB delta for Phase D; this verification adds a true +1.53 kB delta for Phase E/F on top. A precise cumulative total cannot be established without rebuilding Phase C's own "before" state, which checkout-prohibition rules out for every verifier in this chain, including this one. The Owner already knows the ceiling is being exceeded and has ratified proceeding past it once; this is more of the same category of decision, reported rather than made here.

---

## Lead item 8 — isolation and discipline

All confirmed above in the header section: files-touched matches the C-18 family exactly; `maintenance.ts` and root layout untouched; no new packages; `zod` pre-existing; worktree list clean; 258 pre-existing deletions intact; `consent-store.ts`/`SiteFooter.tsx` hash-match HEAD (no unrestored revert); `3e9f8b5`'s amend is corroborated by the author/committer date gap and its contents match its message.

---

## Gates — verbatim, by identity

**`npx tsc --noEmit`** → clean, 0 errors.

**Targeted suites** (`api/consent-events`, `lib/consent`, `components/consent`, `SiteFooter.test.tsx`, `no-google-analytics.test.ts`, `GoogleAnalytics.test.tsx`, `SentryProvider.test.tsx`, `returning-customer-consent-gate.test.ts`):
```
Test Files  13 passed (13)
     Tests  156 passed (156)
```

**Full `npx vitest run`:**
```
Test Files  2 failed | 200 passed (202)
     Tests  5 failed | 1971 passed (1976)
```
Failures by identity, confirmed exactly:
- `src/lib/auth/admin-access.test.ts` — "gives Owner broad access while keeping owner-only role actions permission-gated"; "gives Admin broad operational access without role template management" (×2)
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx` — "renders step 1 on first load"; "moves focus to the first invalid field when continuing with errors"; "shows the consent error when trying to create booking without consent" (×3)

Identity matches the inherited baseline exactly (`admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3). Totals (5 failed / 1971 passed / 1976 total) match the implementer's reported figure exactly.

**`npx eslint .`** → `66 problems (59 errors, 7 warnings)`. Files with violations, confirmed exhaustively:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Exactly the six baseline files. No new file introduced a lint violation.

**`git status --porcelain`** → 280 lines: 258 `D` (pre-existing, intact) + `M src/lib/maintenance.ts` (standing dirty file) + `M redesign/per-page-progress/C-18-cookie-consent-progress.md` (4-line docs append) + 20 untracked entries (pre-existing evidence/photo/design directories and one unrelated C-19 progress file, none from this diff).

### `ConsentPreferencesPanel.test.tsx` focus-trap flake — investigated

This file is **not touched by any of the three commits under review**. Ran the single test "moves focus into the dialog when it opens" **standalone, 8 separate isolated single-file runs**: 5 failed, 3 passed (all failures the same assertion, `dialog.contains(document.activeElement)` false). Because it fails even with zero other test files in the run, this is **genuine pre-existing timing sensitivity** in the test/component's focus-management race, not order-dependence introduced by `c327973`/`3e9f8b5`/`295f4d2`. It also passed cleanly in this verification's own full-suite run. Does not affect the PASS/FAIL verdict for the three commits in scope; worth a separate fix ticket.

### Supplementary finding: un-mocked network dispatch in a pre-existing test file

`src/components/consent/__tests__/consent-transitions.test.ts` (a Phase C/D file, only touched by `c327973`'s one added test) does **not** stub `navigator.sendBeacon`/`fetch`, unlike its sibling `consent-logging.test.ts`. Since `3e9f8b5` made `recordConsentChoices()` unconditionally call `logConsentEvent()`, every one of this file's 15 tests now triggers an un-mocked beacon/fetch attempt. Confirmed harmless: all 15 tests still pass in ~0-1ms each (indicating the attempt is thrown/rejected synchronously and swallowed by `logConsentEvent`'s own `try/catch`), and the live `consent_events` table row count is independently confirmed at 0 (below). Test-hygiene gap, not a functional defect — see Finding 2.

---

## Database verification (SELECT-only)

```sql
SELECT to_regclass('public.consent_events'), relrowsecurity, policy_count, row_count,
       service_role INSERT/SELECT, anon INSERT/SELECT, authenticated INSERT
```
Result:
```
table_exists: consent_events   rls_on: true   policy_count: 0   row_count: 0
service_role_insert: true   service_role_select: false
anon_insert: false   anon_select: false   authenticated_insert: false
```
Exactly matches the migration's documented intent and post-apply verification. **Row count is 0** — no test, live check, or prior agent activity has written to the live table. No rows to prune.

---

## Findings

| # | Severity | File:line | Finding |
|---|---|---|---|
| 1 | LOW | `src/components/consent/consent-store.ts:204-211` (comment), `src/lib/consent/consent-state.ts:29-32` (`ConsentChoices`) | `purposes_offered` is `Object.keys(state.choices)`, where `ConsentChoices` is a hand-typed interface documented to require manual sync with `COOKIE_REGISTRY`'s non-essential purposes (add a purpose → add a key here → update the inline script guard → bump the version). No automated test asserts `ConsentChoices`'s keys equal `GatedPurpose`/`GATED_PURPOSES` (the registry-derived list `ConsentPreferencesPanel.tsx` actually renders). Currently correct and non-drifted; a future purpose added to the registry without the matching `ConsentChoices` edit would silently under-report `purposes_offered` rather than fail loudly. Not "derived from the registry" in the literal runtime sense, though the discipline is documented and the current state is correct. |
| 2 | LOW (test hygiene) | `src/components/consent/__tests__/consent-transitions.test.ts` (whole file) | Does not stub `navigator.sendBeacon`/`fetch`, unlike `consent-logging.test.ts`. Every test now triggers an unmocked network attempt via `logConsentEvent`. Confirmed harmless (synchronous throw on relative-URL fetch in this jsdom/Node config, swallowed by try/catch; live row count still 0) but inconsistent with the sibling file's discipline and a candidate for flakiness/noise in a different CI network configuration. |
| 3 | INFO | `src/components/consent/__tests__/ConsentPreferencesPanel.test.tsx:263-269` | Pre-existing focus-trap test flakes standalone (5/8 isolated reruns failed here). Confirmed genuine timing sensitivity, not order-dependence, not introduced by the three commits under review. |

No MEDIUM/HIGH/CRITICAL findings.

---

## Live checks — BLOCKED

The Owner's dev server is unhealthy for the entire duration of this verification. Probed repeatedly with short timeouts, never restarted/killed/spawned:

```
GET http://localhost:3000/                → 000 (timeout, 8s)
GET http://localhost:3000/cookies/        → 000 (timeout, 6-8s)
GET http://localhost:3000/about/          → 000 (timeout, 6-8s), including immediately after this verifier's one build
GET http://localhost:3000/booking/manage  → 308 (router alive, rendering still hung)
GET http://localhost:3000/api/consent-events → 308 instantly (router alive)
```

One `npx next build` was run for the bundle re-measurement (lead item 7), matching the dispatch's "at most one" allowance. Probed `/about/` immediately afterward: still `000` — the server did not visibly change state (it was already unhealthy before this build and remained so after; this build did not observably worsen or fix it).

**BLOCKED — not done, named individually:**
1. A real consent choice in a browser writing a real row to `public.consent_events` with correct `banner_version`/`purposes_offered`/`choices`/`action` — **BLOCKED**, dev server unreachable.
2. A withdrawal logging `withdrawn` from a real browser session — **BLOCKED**, same reason.
3. The footer link opening the panel from a real, rendered public page — **BLOCKED**, same reason. (Verified instead via jsdom-rendered component test, see lead item 5 — this is a substitute, not equivalent to a real-browser check, and is reported as such.)

No other §3 gate item was attempted from a live browser in this pass; everything else in this report is static/source/test/DB verification.

---

## Overall verdict

**PASS** for everything verifiable without a working dev server: route failure-mode handling, the action mapping (all four boundary cases), withdrawal-path ordering, the Phase D fix's regression test, Phase F's footer-link universality and the C-17 guard test, the truthfulness sweep (7/7 strings TRUE), the independently re-measured bundle delta (closely corroborates the implementer's figure), and isolation/discipline. All gates match the inherited baseline **by identity**, exactly. DB state confirmed via SELECT-only SQL: correct grants, RLS, 0 rows.

**BLOCKED, not verified:** the three live-browser §3 gate items above, due to the pre-existing dev-server outage — recorded as such, not marked passed, not inferred from source reading.

Three findings recorded, all LOW/INFO — none block sign-off; recommended fixes are small (an explicit registry-derived assertion for `purposes_offered`'s shape, and stubbing `fetch`/`sendBeacon` in `consent-transitions.test.ts` for consistency with its sibling file).
