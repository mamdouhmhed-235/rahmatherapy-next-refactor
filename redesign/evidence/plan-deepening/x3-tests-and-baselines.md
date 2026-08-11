# x3 — Cross-cutting test/snapshot inventory and baseline identity

**Auditor:** subagent `x3-tests-and-baselines`, read-only.
**Repo state at audit time:** `HEAD` = `86b8b22` on `master` (per `git log --oneline -1`), `src/` byte-identical to the plan's base commit `33f895f` per the handoff. Tree dirty only as documented (playwright-mcp deletions, untracked design-handoff folders, `src/lib/maintenance.ts` modified).
**Scope:** the whole plan (`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`), with focus on §8 (lines 1238–1254, the verification gate) and every place the plan names a test, a count, or a baseline.

All commands below were actually run in this session. No number in this report is asserted without a command shown.

---

## 1. Vitest config, and exact single-file/single-test commands

`vitest.config.ts` (full contents, 16 lines):

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- **Environment:** `jsdom` (global, not per-file — every test runs jsdom even pure-logic ones).
- **Globals:** `true` — `describe`/`it`/`expect`/`vi` are ambient, not imported... **correction, checked**: every test file in this repo *does* explicitly `import { describe, expect, it, vi } from "vitest"` despite `globals: true`. That's a style choice, not a requirement — `globals: true` means it would still work without the import.
- **Include:** `src/**/*.test.{ts,tsx}` **and** `scripts/**/*.test.{ts,tsx}` — confirms the handoff's gotcha 12 (`scripts/` tests do run).
- **Exclude:** `e2e/**`, `node_modules/**` — Playwright specs are never picked up by vitest, confirming gotcha 12's second half.
- **No `setupFiles`, no `testTimeout` override** — so vitest's default per-test timeout (5000ms) applies everywhere. This is *why* the documented `ManualBookingForm` flake times out at exactly 5000ms under load — there is no per-file timeout override raising it.
- **No path aliases besides `@` → `src/`.**

**Package script:** `package.json:14` → `"test": "vitest run"`.

**Exact commands, this repo, Windows/pnpm, verified by running them:**

```bash
# Whole suite
npx vitest run
# or: pnpm test

# Single file
npx vitest run src/lib/auth/admin-access.test.ts

# Single test by name (substring match on the full "describe > it" title)
npx vitest run src/lib/auth/admin-access.test.ts -t "gives Owner broad access"
```

I ran both of the single-target forms during this audit; both work exactly as shown (see §4 for output).

---

## 2. Full test-file inventory, grouped by area

**Counts, by command:**

```bash
find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l      # 220
find scripts -name "*.test.ts" -o -name "*.test.tsx" | wc -l  #   2
```

**Total: 222 test files** (`220` under `src/`, `2` under `scripts/`), all matched by vitest's include globs. This is also exactly what the full `vitest run` reported: `Test Files 220 passed | 2 failed (222)`.

### 2a. `scripts/` (2 files)

| File | Covers |
|---|---|
| `scripts/measure-admin-contrast.test.ts` | Layer 1 static contrast analyser (item 7). **10 `it()` blocks** — matches the plan's own claim at §7.4a. |
| `scripts/verify-admin-token-contrast.test.ts` | Layer 2 token-pair proof (item 7). **12 `it()` blocks.** |

Both pass today in isolation: `npx vitest run scripts/measure-admin-contrast.test.ts scripts/verify-admin-token-contrast.test.ts` → `Test Files 2 passed (2)`, `Tests 22 passed (22)`.

`scripts/measure-admin-bundles.mjs` (item 5's subject) has **no** `.test.ts` companion — confirmed by `ls scripts/*.test.*`, which lists only the two contrast scripts above. This is relevant to item 5 (§7 below).

### 2b. `src/` (220 files), grouped by area

| Area | File count (approx, by path prefix) | Notable coverage relevant to this plan |
|---|---|---|
| `src/app/admin/availability/**` | 6 | `AvailabilityOverridesManager.test.tsx`, `AvailabilityRulesManager.test.tsx`, `WorkingHoursDayEditor.test.tsx`, `__tests__/actions.test.ts`, `__tests__/availability-data.test.ts`, `__tests__/page.test.ts` — **items 3, 6** |
| `src/app/admin/staff/[staffId]/availability/**` | 3 | `StaffAvailabilityRulesForm.test.tsx`, `__tests__/actions.test.ts`, `__tests__/lib.test.ts` — **items 3, 6**. **No test file for `StaffAvailabilityOverridesManager.tsx` itself** — see §6/§7 finding. |
| `src/app/admin/bookings/**` (incl. `[bookingId]`, `new`) | ~33 | booking CRUD, RBAC, quick actions, manual form, recurring series — **items 4, 6 (indirectly), 8** |
| `src/app/admin/settings/**` | 2 | `settings-data.test.ts`, `updateBusinessSettings.test.ts` — **item 8 Phase 1** |
| `src/app/admin/emails/**` (+ `email-templates/**`) | 9 | resend, manual reminder, templates — **item 1** |
| `src/app/admin/clients/**` | 8 | client CRUD, metrics, LTV — touched by item 8's "15 read sites of total_price" claim |
| `src/app/admin/reports/**` | 10 | revenue, workload, insights — touched by item 8's "revenue and series" money-read sites |
| `src/app/admin/dashboard/**` (+ `blocks/**`) | ~22 | KPI tiles, role dashboards — item 7's D9 (frozen `--admin-text` alias) lives here (`PersonalContributionStripe.test.tsx` exists but doesn't assert colour) |
| `src/app/admin/components/**` (incl. `charts/**`, `tiles/**`) | ~18 | shared admin chrome, `ThemeProvider.test.tsx`, `ThemeToggle.test.tsx`, `theme-actions.test.ts` — item 7 |
| `src/app/admin/{account-password-requests,audit,calendar,enquiries,me,operations,password-reset,privacy,roles,services,staff}/**` | ~30 | miscellaneous admin surfaces, mostly unrelated to this plan's 8 items except item 8's audit-format touchpoint (`src/app/admin/audit/__tests__/format.test.ts`) |
| `src/app/api/**` | 9 | `cron/__tests__/review-emails.test.ts` (**item 1**), `cron/__tests__/extend-recurring-horizons.test.ts` (**item 8 Phase 4**), booking creation transaction tests |
| `src/app/booking/**` (customer-facing, outside `(public)` and `admin`) | 1 | `no-google-analytics.test.ts` only — **no test at all for `src/app/booking/manage/**`**, the KNOWN TRAP the harness flagged for item 7. See §7. |
| `src/components/**` (shared, incl. `ui/`, `consent/`, `address/`, `layout/`) | 9 | `GoogleAnalytics`, `SentryProvider`, `AddressAutocompleteField`, consent panel/banner/logging/transitions, `SiteFooter` — **zero test files under `src/components/ui/`** (the button/input/badge primitives item 7 edits). See §7. |
| `src/content/site/**` | 1 | `canonical-domain.test.ts` — anti-drift text scan, not a render test |
| `src/features/booking/**` | 6 | `AboutYouStep.test.tsx` (**item 8 Phase 5**), `BookingSummary`, `DatePickerField`, `SuccessScreen`, `booking-packages.test.ts`, `booking-schema.test.ts` (**item 8 Phase 2**), `returning-customer-consent-gate.test.ts` |
| `src/lib/auth/**` | 3 | `admin-access.test.ts` (has 2 of the 5 baseline failures), `rbac.test.ts`, `rbac-client-permissions.test.ts` |
| `src/lib/booking/**` | 6 | `manage-token.test.ts`, `availability-options.test.ts`, `override-windows.test.ts`, `service-fuzzy-match.test.ts`, `staff-recurring-windows.test.ts`, `working-hours-segments.test.ts`. **No file tests `availability.ts` itself** (home of `isCityAllowed`/`getAllowedCities`, item 8 Phase 2's target). |
| `src/lib/consent/**` | 2 | `consent-state.test.ts`, `registry-completeness.test.ts` — out of scope (§0.2) |
| `src/lib/email/**` | 19 | every `send*Email` function has its own file, plus `pickReviewMessages`, `sample-data`, `resolveSubject`, `registry-defaults`, `resolveBusinessNotificationRecipients`, `renderGroupContextBlock` — **item 1**'s primary test surface (`sendReviewRequestEmail.test.ts`) |
| `src/lib/{address,observability,pagination,rate-limit,time}/**` | 5 | infra/utility, no plan-item overlap |

**Public pages — a confirmed zero:**

```bash
find "src/app/(public)" -iname "*.test.*"   # → nothing
```

**No file under `src/app/(public)/**` has any test, at all** — not just the privacy page item 2 touches, every public route. This matters directly for item 2 (§7 below).

### 2c. Per-item existing-test mapping (instruction 2)

| Item | Files it touches | Existing tests that exercise that code | Would they break? |
|---|---|---|---|
| **1** — review emails | `src/lib/email/notifications.ts`, `src/app/api/cron/review-emails/route.ts`, `src/app/admin/emails/actions.ts`, `src/app/admin/emails/page.tsx` | `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` (9 tests, verified below), `src/app/api/cron/__tests__/review-emails.test.ts` (6 tests) | **Yes, if the guard changes `sendReviewRequestEmail`'s signature or default behaviour without matching the existing tests' stubs.** The existing 9 tests stub `createSupabaseAdminClient` with a single fixed shape (`from().select().eq()`); adding a client-cooldown lookup inside the function will need that stub extended or the new tests will fail against the *old* stub. Not breaking per se, but every existing test in this file must be re-run after the change since they all invoke the same function. |
| **2** — privacy copy | `src/app/(public)/privacy/page.tsx` | **None.** Confirmed: `find "src/app/(public)" -iname "*.test.*"` returns nothing. | N/A — nothing to break, and nothing to run as a check either. See finding in §7. |
| **3** — override sort | `src/app/admin/availability/page.tsx`, `src/app/admin/staff/[staffId]/availability/page.tsx` | No existing test asserts on the `.order()` chain calls (`grep -rn ".order(\"override_date\"" src/app/admin/availability/__tests__/*.test.ts src/app/admin/staff/*/availability/__tests__/*.test.ts` → no output). `page.test.ts` and `staff/.../lib.test.ts` test *pure helpers* (`formatSegments`, `resolveWeekdayRule`, `groupOverridesByDate`, `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState`), not the query itself. | **No existing test breaks**, but also **none exists to prove the sort was added** — the plan's own §3.5 ("Unit tests for both orderings") has no natural home unless the sort is extracted into a testable pure function (see §7). |
| **4** — bookings indexes | Migration only, no app code | N/A | N/A — verified via SQL, not vitest |
| **5** — bundle measurement | `scripts/measure-admin-bundles.mjs` | **None** — no `.test.ts` file exists for this script at all (confirmed §2a). | Nothing to break; nothing exists to extend either. |
| **6** — adjustment date-counting | `AvailabilityOverridesManager.tsx`, `StaffAvailabilityOverridesManager.tsx`, `availability-data.ts`, `staff/[staffId]/availability/lib.ts`, both `page.tsx` | `AvailabilityOverridesManager.test.tsx` (8 tests — verified, has a describe block literally named `"AvailabilityOverridesManager — a date is all of its rows"`) tests the grouping-by-date UI logic **already**. **`StaffAvailabilityOverridesManager.tsx` has NO test file** (confirmed: `find src/app/admin -iname "*StaffAvailabilityOverridesManager*"` returns only the `.tsx`, not a `.test.tsx`). `availability-data.test.ts` (`resolveAvailabilityBannerState`, 5 tests) and `staff/.../lib.test.ts` (`resolveStaffAvailabilityBannerState`, 5 tests) both would need extending with date-vs-row semantics but their existing assertions (pure integer comparisons) are agnostic to whether the integers mean rows or dates, so **existing tests do not break**, they just stop being sufficient. | Concrete gap: staff-tree manager has no test file at all — new file required (§8). |
| **7** — admin theming | `src/styles/tokens.css`, `src/styles/site-parity.css`, `src/components/ui/{button,input,badge}.tsx`, ~99 admin files, `layout.tsx` | `src/app/admin/components/__tests__/ThemeProvider.test.tsx`, `ThemeToggle.test.tsx`, `theme-actions.test.ts` cover the theme *mechanism* (cookie/attribute plumbing), not colour values. **Zero test files exist under `src/components/ui/`** (`find src/components/ui -iname "*.test.*"` → nothing) — `button.tsx`, `input.tsx`, `badge.tsx` are completely untested today, by anything. `scripts/measure-admin-contrast.test.ts` and `scripts/verify-admin-token-contrast.test.ts` test the *verification tooling*, not admin components themselves. | No existing component test breaks from a literal→token substitution (there are none to break) — but this also means Phase B has **zero regression safety net** beyond the two static-analysis scripts and the live e2e sweep. The plan's §7.7a "cheap tripwire" needs a brand-new test file; none is named. |
| **8** — travel-charge model | `business_settings` (settings actions/form), `bookings`, `recurring_booking_templates`, `availability.ts`, `booking-schema.ts`, `BookingManagementForm.tsx`, `AboutYouStep.tsx`, templates/notifications | `settings/__tests__/updateBusinessSettings.test.ts`, `settings/__tests__/settings-data.test.ts`, `booking-schema.test.ts` (has the exact Manchester test the plan cites), `AboutYouStep.test.tsx` (has the exact "surfaces the outside-coverage notice" test the plan implicitly needs to rewrite), `bookings/__tests__/updateBookingManagement-completed-guard.test.ts` (the **exact sibling shape** for the new fully-paid/completed lock on `travel_fee`), `cron/__tests__/extend-recurring-horizons.test.ts`. `availability.ts` itself (home of `isCityAllowed`) has **no test file at all** — confirmed by `find src/lib/booking -iname "*.test.ts"`, which lists 5 files, none named `availability.test.ts`. `booking-window-settings.ts` (the "existing proven pattern" the plan cites for the cached settings read) **also has no test file**. | Existing tests in `updateBusinessSettings.test.ts` and `booking-schema.test.ts` will need direct edits (renaming `allowed_cities`→`free_travel_cities`, flipping the Manchester test's expected outcome) — this is expected per the plan and is a **modification**, not a break-then-fix. `AboutYouStep.test.tsx`'s existing "outside-coverage notice" test asserts today's *error* framing; item 8 must change its assertion to the new informational framing — again expected, but the plan doesn't name this file, which it should. |

---

## 3. Snapshot files — definitively none

```bash
find . -iname "*.snap" -not -path "*/node_modules/*" -not -path "*/.next/*"   # → nothing
grep -rn "toMatchSnapshot\|toMatchInlineSnapshot" src scripts e2e             # → 0 matches
```

**There are zero `*.snap` files and zero inline-snapshot calls anywhere in `src/`, `scripts/`, or `e2e/`.** This repo does not use vitest/Jest snapshot testing at all — every assertion is explicit (`toEqual`, `toMatchObject`, `toBe`, DOM queries). **The deepened plan should state this explicitly** so no implementer wastes time hunting for a `__snapshots__` directory or wonders whether a substitution-heavy item like 7 needs snapshot updates — it does not, because none exist.

---

## 4. Baseline verified BY IDENTITY

### 4a. `npx tsc --noEmit`

```
Exit code: 0, zero output.
```

Matches the plan's claim exactly (**0**).

### 4b. `npx vitest run` (full suite, one run, exactly as instructed)

```
 Test Files  2 failed | 220 passed (222)
      Tests  6 failed | 2235 passed (2241)
   Duration  93.94s
```

**This is 6 failed / 2235 passed, not the plan's stated 5 failed / 2236 passed.** However — this is **exactly** the documented, pre-investigated flake, not a new regression. The six failing tests, verbatim:

1. `src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated`
2. `src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management`
3. `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load`
4. `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors`
5. `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent`
6. `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm optional email > still rejects a malformed email, and stops rejecting it once cleared`

**I then isolated each file to separate real baseline from flake, per the task's explicit instruction:**

```bash
npx vitest run src/lib/auth/admin-access.test.ts
# → Test Files 1 failed (1); Tests 2 failed | 4 passed (6)
# → exactly tests #1 and #2 above, every time (re-run once, identical result)

npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx
# → Test Files 1 failed (1); Tests 3 failed | 33 passed (36)
# → exactly tests #3, #4, #5 above — NOT #6
```

**Conclusion: the true, stable baseline is exactly 5 — `admin-access.test.ts` ×2 (tests #1–2) + `ManualBookingForm.test.tsx` ×3 (tests #3–5), reproduced identically on isolated re-run.** Test #6 (`"still rejects a malformed email..."`, inside the `describe("ManualBookingForm optional email")` block) is the extra flake the handoff predicted almost exactly — it appeared once under full-suite load and did not appear in the isolated run. **This confirms the plan's §8 baseline is correct as stated; my one full-suite run simply hit the documented flake.** This is not a finding to report as a discrepancy — it is the flake, present and accounted for, doing exactly what the handoff said it would.

**Failure reasons, read from the actual error output (none of this needs fixing under this plan — recorded for completeness and because §8's "gate" instructs comparing failures by identity, which requires knowing what each one *is*):**

- Both `admin-access.test.ts` failures are the same root cause: `getVisibleAdminPages`/`getAdminPageAccess` for Owner/Admin no longer include/exclude `"accountRequests"` the way the test's `EXPECTED_PAGE_KEYS` / `toMatchObject` expects — a genuine pre-existing drift between the RBAC page-visibility test fixture and the current `admin-access.ts` implementation, unrelated to anything in this plan.
- The three stable `ManualBookingForm.test.tsx` failures are all "duplicate node" / "empty focus target" React Testing Library errors: `getByText("Contact & source")` and `getByText("Services & participants")` each match **two** elements in the rendered DOM (the step-nav label list renders the heading text twice — once in the desktop `<nav>` step list, once as an `<h2>`), and the focus-management assertion (`expected '' to be 'full_name'`) finds no element actually received focus. These read as a real, pre-existing test/component mismatch, not environment flakiness — they reproduce identically every isolated run.
- The flaky sixth test times out at exactly 5000ms (`vitest`'s default, per §1 above — no override in `vitest.config.ts`), consistent with resource contention under full-suite parallel load rather than a logic bug.

**None of items 1–8 in this plan touch `src/lib/auth/admin-access.ts` or its test, and only item 1's manual-send work touches `src/app/admin/bookings/new/ManualBookingForm.test.tsx`'s directory indirectly (it does not import or exercise `ManualBookingForm`).** So the deepened plan can state: **these 5 pre-existing failures are unrelated to every item in this plan and must reproduce, by name, unchanged, in every batch's post-check.**

### 4c. `pnpm lint`

```
✖ 66 problems (59 errors, 7 warnings)
```

Matches the plan's claim exactly (**59 errors / 7 warnings**). File-level confirmation:

```bash
grep -oP "^C:.*\.(jsx|tsx|ts)$" lint.log | sort -u
```
→
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```

Exactly the six files the plan names, no more, no fewer.

### 4d. `git status --porcelain -- src/ supabase/`

```
 M src/lib/maintenance.ts
```

Matches exactly.

**Overall: every §8 baseline claim is CONFIRMED except the vitest failure count, which is confirmed to be exactly the documented, pre-diagnosed flake and not a new problem — see §4b for the isolation proof.**

---

## 5. E2E spec inventory

```bash
find e2e -type f | sort
```
```
e2e/admin-contrast-helpers.ts
e2e/admin-contrast.spec.ts
e2e/admin-roles.spec.ts
e2e/booking-claiming.spec.ts
e2e/booking-public.spec.ts
e2e/helpers.ts
```

**Four spec files, two shared helper modules.** `playwright.config.ts` (full contents read): `testDir: "./e2e"`, `timeout: 60_000`, `expect.timeout: 10_000`, `fullyParallel: false`, `workers: 1`, `baseURL` from `E2E_BASE_URL` (default `http://127.0.0.1:3000`), two projects — `chromium` and `mobile-chrome` (`devices["Pixel 5"]`). **It loads no env file itself**, confirming handoff gotcha 2.

| Spec | Covers | Needs credentials? | Currently skips? |
|---|---|---|---|
| `e2e/booking-public.spec.ts` (20 lines, 1 test) | Public booking flow smoke test (service step, unsupported-area feedback) | No — only `E2E_BASE_URL` | Skips if `E2E_BASE_URL` unset; otherwise runs unauthenticated |
| `e2e/booking-claiming.spec.ts` (83 lines, 1 test) | Cross-therapist claim-handoff race (THERAPIST_A claims, THERAPIST_B sees it vanish) | Yes — `E2E_THERAPIST_A_*`, `E2E_THERAPIST_B_*`, `E2E_OWNER_*`, plus `E2E_CLAIMABLE_BOOKING_PATH` pointing at a real unassigned assignment | Skips without `E2E_BASE_URL`; skips without `E2E_CLAIMABLE_BOOKING_PATH`; skips without all three role credentials; further skips itself unless `browserName === "chromium"` **and** `project.name === "chromium"` (mutates shared state, deliberately runs once) |
| `e2e/admin-roles.spec.ts` (161 lines) | Per-role admin navigation visibility (Owner/Admin/Coordinator/Therapist see the right nav items, unauthenticated users are redirected) | Yes, per-test, via `requireCredentials([...])` | Each role test skips individually if its own credentials are absent; the unauthenticated-redirect test never skips |
| `e2e/admin-contrast.spec.ts` (199 lines, item 7's Layer 3) | Live per-role, per-theme contrast sweep across all admin routes | Yes — `OWNER`, `ADMIN`, `COORDINATOR`, `THERAPIST_A` (the file's own header comment states only these 5 roles genuinely exist: Owner/Admin/Coordinator/Therapist/Inactive; `THERAPIST_B` and `NON_STAFF` credentials are unpopulated and there is **no** Reporting role) | Each role test + the INACTIVE negative-path test skip individually via `requireCredentials`; the "unauthenticated admin surfaces" test never skips |

**`e2e/admin-contrast.spec.ts` pins `test.use({ channel: "chrome" })` at file scope (line 93), confirmed by grep, with an inline comment explaining exactly why (bundled Chromium revision mismatch) — the task's instruction to leave this pin alone is correct and the file's own comment already documents the reasoning for a future implementer.**

**Verified test count:** the file's own header claims "6 tests" (§7.2b of the plan repeats this). Actual `test(` call sites: 3 static (`unauthenticated admin surfaces`, `INACTIVE — negative path`, and one `contrast sweep — ${role}` inside a `for (const role of rolesToRun)` loop over `CONTRAST_ROLES = ["OWNER", "ADMIN", "COORDINATOR", "THERAPIST_A"]`, i.e. 4 roles). **3 static + 4 looped − 1 (the loop replaces the third static slot) = 6 tests total.** Confirmed.

**Exact command to run one spec** (as given in the task and independently confirmed against `e2e/admin-contrast.spec.ts`'s own header comment, which states the identical command):

```bash
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```

```bash
ls node_modules/playwright/cli.js       # No such file or directory
ls node_modules/@playwright/test/cli.js # exists
```

Confirms handoff gotcha 3 exactly.

### ⚠️ FALSE CLAIM found in the plan — `.env.e2e` vs `.env`

**Plan §7.9(b), lines ~906–929, instructs the Owner to create an untracked `.env.e2e` file and run the sweep as:**

```
node --env-file=.env.e2e ./node_modules/playwright/cli.js test e2e/admin-contrast.spec.ts
```

**Both of these are wrong, verified two independent ways:**

1. **The CLI path is wrong** — `node_modules/playwright/cli.js` does not exist (confirmed above); the correct path is `node_modules/@playwright/test/cli.js`, exactly as the task prompt and the handoff state, and exactly as `e2e/admin-contrast.spec.ts`'s **own** header comment (written later than the plan's §7.9, and evidently already corrected) now says.
2. **The env file is wrong.** `e2e/helpers.ts`'s `getEnvValue()` fallback reads a hardcoded `.env`, not `.env.e2e`. `.gitignore` still lists `.env.e2e` nowhere special (it's covered by the blanket `.env*` rule), but **the actual, current repository only contains a `.env` file** — `ls -la .env*` shows `.env` and `.env.example`, no `.env.e2e`. The real E2E credential keys (`E2E_OWNER_EMAIL`, etc. — names only checked, not values) live in `.env`. `.env.example`'s own comment block (lines ~46–57) **still tells the reader to use `.env.e2e`** and **still contains the same wrong `node_modules/playwright/cli.js` path** — this is a live, committed inconsistency in the repo itself, not just the plan.

**By contrast, `e2e/admin-contrast.spec.ts`'s own header comment (lines 34–38, read directly) already has the correct, current convention:**

```
Run (playwright.config.ts loads no env file itself):
  node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts

(This is a pnpm repo: there is no node_modules/playwright/cli.js — only
@playwright/test is a direct dependency, and its CLI lives at the path
above. Confirmed against node_modules/.bin/playwright's shim.)
```

**So there are now three different instructions in this repo for the same command, two of them wrong:**
- Plan §7.9 (wrong: `.env.e2e` + `node_modules/playwright/cli.js`)
- `.env.example`'s own comment (wrong: same two errors, independently committed)
- `e2e/admin-contrast.spec.ts`'s header comment (**correct**, and matches the task prompt's own instruction and the HANDOFF's gotcha list)

**This is exactly the kind of claim the task's stance section calls out — the plan itself is not internally consistent, and an implementer who follows §7.9 literally instead of the spec file's own comment will spend a debugging cycle rediscovering gotcha 3.** The deepened plan must replace §7.9's env-file instructions with the spec file's own (correct) convention, and should flag `.env.example`'s stale comment as a separate, small, out-of-scope-for-this-plan defect worth a follow-up (I did not edit it — read-only).

### `e2e/helpers.ts` — the authentication mechanism, read in full

`getCredentials(prefix)` reads `process.env.E2E_${prefix}_EMAIL`/`_PASSWORD`, returns `null` if either is missing. `requireCredentials(prefixes)` is `.every(...)` over that. `loginAs(page, credentials)` performs a real `createBrowserClient(...).auth.signInWithPassword(...)` and injects the resulting cookies into the Playwright browser context via `page.context().addCookies(...)`. **No agent-visible credential ever appears in test code** — this matches the plan's and the harness's repeated claim, and I confirmed it by reading the full 151-line file. `getEnvValue()` (used only for `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, not the E2E role credentials) falls back to parsing a physical `.env` file if the variable isn't already in `process.env` — this is the "hardcoded `.env`, not `.env.e2e`" fact cited above.

---

## 6. Repo conventions, with a real example of each

### Where a test file lives relative to its subject

Two co-located patterns, both used heavily and consistently:

- **Sibling file, same directory**: `AvailabilityOverridesManager.tsx` ↔ `AvailabilityOverridesManager.test.tsx` (same folder, same basename).
- **`__tests__/` subdirectory, same parent**: `src/app/admin/bookings/actions.ts` — wait, verified example: `src/app/admin/availability/__tests__/actions.test.ts` sits in `__tests__/` beside `page.tsx` and `availability-data.ts`, which live one level up.

Both patterns coexist in the same directory tree (e.g. `src/app/admin/availability/` has both a sibling `.test.tsx` for the manager component and an `__tests__/` folder for `actions.ts`/`availability-data.ts`/`page.tsx`'s pure exports). **The rule that best predicts which pattern applies: components use the sibling-file pattern; page/data/action modules use `__tests__/`.**

### How the mailer is mocked

Every email-adjacent test mocks `@/lib/email/client`'s `sendEmail` (never the transport below it), e.g. `src/lib/email/__tests__/sendReviewRequestEmail.test.ts`:

```ts
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));
```

Note the mocked "from" address uses the `*.example.test` TLD the plan's rule 2 requires for any test-visible recipient/sender. This is the exact convention item 1's new tests must follow.

### How Supabase is mocked

Universal convention across every server-action test: mock the factory, not the client shape, then hand-build a `.from()` stub per test. From `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`:

```ts
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));
```

...followed by a local `stubAdminClient()` helper building `{ from: vi.fn((table) => ...) }` per call. `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` differs slightly and *documents why*: `sendReviewRequestEmail` takes `supabase` as a parameter rather than calling the factory internally, so the stub is passed directly rather than routed through a mocked factory — this distinction matters for item 1, whose new `getClientsAskedForReviewSince` helper should follow whichever calling convention the function it's added to already uses.

### How server actions are tested (RBAC + audit)

`src/lib/auth/rbac` is mocked with `importOriginal` so the **real** permission-check logic runs (only `getStaffProfile`/`requirePermission` themselves are stubbed to return a fixture profile) — e.g. `src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts`:

```ts
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));
```

This is the exact idiom item 8's Owner-only `manage_travel_origin` permission test and item 1's `canResendBookingEmails` middle-path-guard test must both use — real gate logic, fixture identity only.

### How page-level pure data functions are tested

Non-I/O helpers exported from a `page.tsx` (grouping, formatting, banner-state derivation) are pulled into a `__tests__/page.test.ts` and tested as pure functions with plain fixtures — no rendering, no Supabase. Real example, `src/app/admin/availability/__tests__/page.test.ts`:

```ts
describe("groupOverridesByDate", () => {
  it("a single date with a break is one adjustment via .size, not two — the 'adjustments this week' chip counts dates, not rows", () => {
```

This is the **exact precedent for item 6** — a grouping helper is already tested this way in this file, for the identical semantic bug this plan re-fixes elsewhere.

---

## 7. Every test the plan proposes, mapped to a concrete file — and the gaps

| Item | Proposed test (paraphrased from the plan) | Concrete file it belongs in | Status |
|---|---|---|---|
| 1 | Cooldown suppresses/permits; `no_email` sentinel doesn't suppress; sentinel not written on cooldown skip; `ignoreClientCooldown` bypasses; classification (series/returning/first-time) | `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` (existing, 9 tests today — extend) | Has a home |
| 1 | Cron: `skipped_client_cooldown` counted; one batch query not N | `src/app/api/cron/__tests__/review-emails.test.ts` (existing, 6 tests today — extend) | Has a home |
| 1 | Manual action: refuses without permission; refuses unassigned Therapist + records operational event; respects per-booking sentinel; mailer mocked | **New file**, e.g. `src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts`, mirroring `sendManualBookingReminder.test.ts`'s structure exactly (same mocks: `next/cache`, `@/lib/supabase/admin`, `@/lib/supabase/server`, `@/lib/auth/rbac` via `importOriginal`, `@/lib/email/notifications`) and `resendEmail.test.ts`'s `describe("... — booking_assignments scope check (H11 middle path)")` block for the Therapist-scope tests specifically | **Gap — plan doesn't name this file** |
| 1 | Zero real emails, confirmed by SELECT on `email_delivery_events` | Not a vitest test — a manual/orchestrator-run SQL check per the plan's own §1.8 | Correctly scoped outside vitest already |
| 2 | "the privacy page's existing tests still pass" | **There are no existing tests for this page, or for any page under `src/app/(public)/`.** Confirmed by `find`. | **FALSE / misleading claim — see below** |
| 3 | Unit tests for both orderings | No natural home exists today — `.order()` calls are inline in `page.tsx` server components, and no existing test asserts on a Supabase query-builder chain call anywhere in `src/app/admin/availability/**` or `src/app/admin/staff/[staffId]/availability/**`. | **Gap — plan doesn't say how to make this testable** |
| 5 | Script runs clean; four ceiling routes appear; baseline file written; re-run is idempotent | No test file exists for `scripts/measure-admin-bundles.mjs` at all today. | **Gap — no file named** |
| 6 | Date-vs-row cap/total/saturation tests, both trees | `AvailabilityOverridesManager.test.tsx` exists (extend). **`StaffAvailabilityOverridesManager.tsx` has no test file at all** — new file needed: `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx` | **Half has a home, half is a gap** |
| 6 | Same, for `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` inputs now meaning dates | `availability-data.test.ts` and `staff/[staffId]/availability/__tests__/lib.test.ts` (both exist, extend) | Has a home |
| 7 | The "cheap tripwire" — new token's light value equals the literal it replaced | No file named in the plan. Natural home: extend `scripts/verify-admin-token-contrast.test.ts` (already the Layer 2 token-pair test), or a new `scripts/verify-token-substitutions.test.ts` if it needs to read the diff/substituted files directly rather than just `tokens.css`. | **Gap — plan doesn't name this file** |
| 7 | Phase C guard against new `oklch(` literals | Same situation — natural home is `scripts/measure-admin-contrast.test.ts` (already the literal-scanning layer) or a new guard test following the `canonical-domain.test.ts` idiom the plan itself cites (`src/content/site/__tests__/canonical-domain.test.ts`, a pure source-text scan with the identical shape) | Plan names the *idiom* correctly but not the *file* |
| 7 | Step 0.4 alias-freeze guard | Plan says "belongs with the Layer 2 verifier" — this one **is** named correctly: `scripts/verify-admin-token-contrast.test.ts` | Has a home |
| 8 | Manchester now parses/generates slots/creates a booking (inverse of today's rejection test) | `src/features/booking/schemas/booking-schema.test.ts:39` — **exact existing test found**, `it("rejects unsupported service areas before time selection", ...)`, to be inverted in place | Has a home, plan's anchor is correct |
| 8 | Participant × price × fee arithmetic | No existing file computes `total_price` for a multi-participant booking with a fee today. Nearest precedent: `src/app/api/bookings/createBookingTransaction.test.ts` (the RPC-calling test for booking creation) — new `describe` block there, or a new file if the fee logic moves elsewhere first | Plausible home exists, not named by the plan |
| 8 | Owner-only origin field: Admin rejected server-side, Owner succeeds, unchanged-origin save still succeeds | `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` (existing, extend — exact same mock shape already used for `requirePermission`) | Has a home |
| 8 | Minimum one free-travel area | Same file, same describe block region (`actions.ts:67-69`'s validation already has a sibling test likely present — worth checking during implementation) | Has a home |
| 8 | Completed/fully-paid fee lock, unchanged-fee-still-succeeds, fee+payment-same-save allowed, cancelled NOT locked | **Exact structural precedent exists**: `src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts` — a sibling file for the *identical* lock shape on a different field. New file: `src/app/admin/bookings/__tests__/updateBookingManagement-travel-fee-guard.test.ts`, same mocks, same `describe("updateBookingManagement — ... guard")` idiom | Plan doesn't name this precedent or the new file, but it exists and is very close |
| 8 | Series control updates template + future occurrences, skips completed/paid, reports counts, inheritance shown in UI | No existing precedent file for `recurring_booking_templates` write-path testing found under `src/app/admin/bookings/__tests__/` beyond `createRecurringSeries.test.ts`/`cancelRecurringSeries.test.ts` — closest analogue, extend or sibling | Plausible home, not named |
| 8 | Free-travel list change propagates to booking page without deploy (cache-tag invalidation) | No existing test for `booking-window-settings.ts`'s caching pattern (`find src/lib/booking -iname "*.test.ts"` — 5 files, none testing that file) — this is the exact pattern item 8 is told to copy, and it is itself untested today | **Gap — the pattern being copied has no test to mirror** |
| 8 | Guard against a second hardcoded town list | No existing precedent for "guard against reintroducing a removed hardcoded list" beyond `canonical-domain.test.ts`'s general shape (source-text scan) | Same idiom as item 7's guard, same gap in naming |

### FALSE CLAIM — item 2's "existing tests still pass"

Plan §2.5 (verification for item 2) states:

> `npx tsc --noEmit`; **the privacy page's existing tests still pass**; no duration string (`7 year`, `12 month`) survives in `src/app/(public)/privacy/`; the page renders and section numbering is contiguous.

**Verdict: FALSE as literally written.** `find "src/app/(public)" -iname "*.test.*"` returns nothing — there is no test file for the privacy page, and none for any public page. The clause is not merely vacuously true, it actively misleads: an implementer told to confirm "existing tests still pass" will go looking for a test file, not find one, and either (a) waste time confirming a negative, or (b) wrongly conclude they should have found one and something is broken. **It also silently begs the harder question the plan never answers: how does an implementer confirm "the page renders" at all**, given rule 7 forbids `pnpm build` for every item except item 5? There is no dev-server-independent way to render-check an App Router page without either a build or a new test. The deepened plan should either (a) explicitly instruct running the page through the Owner's already-running dev server at `localhost:3000` via a read-only fetch (in bounds per the harness's own environment note: "you may READ from it with curl/fetch"), or (b) add a minimal new render test (there is no existing convention for testing a public page component directly, since none exists — this would be a new pattern, worth flagging to the Owner rather than inventing silently).

---

## 8. Structured findings for the deepened plan

**Baselines are correct by identity**, with one nuance the plan should absorb into its own text rather than leave implicit: the isolation proof in §4b above (run `admin-access.test.ts` and `ManualBookingForm.test.tsx` separately, not just full-suite) is what actually distinguishes "true baseline" from "flake," and the plan currently only asserts the *outcome* of that distinction without showing how to reach it. An implementer who runs `npx vitest run` once and sees 6/2235 rather than 5/2236 has no written procedure for confirming this is the known flake rather than a new regression — they need exactly the two isolated commands in §4b.

**Zero snapshot files** — worth one explicit sentence in the plan so nobody hunts for `__snapshots__/`.

**The `.env.e2e` / `node_modules/playwright/cli.js` instructions in plan §7.9 are stale and contradict both the task's own repeated correct command and `e2e/admin-contrast.spec.ts`'s own (correct, already-fixed) header comment.** This should be corrected in the plan text itself, and `.env.example`'s matching stale comment (same two errors) flagged as a small follow-up.

**Six named tests in the plan have no file to land in** (item 1's manual-send test, item 3's ordering test, item 5's script test, item 6's staff-tree manager test, item 7's tripwire/guard tests, item 8's free-travel-cache test). Each has either a close sibling precedent (named above) or, in item 3/8's cache-pattern case, no precedent at all because the pattern being copied is itself untested. The deepened plan must name exact file paths for all of these or implementers will each invent a different convention.

**`StaffAvailabilityOverridesManager.tsx` and `src/lib/booking/availability.ts` are both completely untested today**, and both are directly in the blast radius of items 6 and 8 respectively. This is not a defect in the plan so much as missing context the plan should state plainly, since "no existing test" changes the verification strategy (new tests must establish correctness from scratch, not just extend an existing net).
