# Production-readiness testing baseline — 2026-08-17

**Measured at `a78a693`.** Every number here was measured in this repo, not estimated and not copied
from an older document. This is a **snapshot to test against**, not a test plan — planning and
implementation belong to the agent that follows.

⛔ **Re-measure before trusting this.** It ages the moment anything ships. §10 gives the commands.

---

## 1 — ⛔ Constraints that shape ANY test plan. Read before designing anything.

| Constraint | Consequence for testing |
|---|---|
| ⛔ **The site is LIVE** at rahmatherapy.uk. Push to `master` auto-deploys via Cloudflare (~3 min) | **There is no CI and no staging.** A push is a production release. Nothing can be "tried in staging" first |
| ⛔ **12 unpushed commits, the first being `3eb2939` (Phase 12)** | A bare `git push` **opens live bookings**. Nothing ships for testing without that business decision |
| ⛔ **Production Supabase is a LIVE customer surface** | All DB writes need the Owner's explicit per-action approval. No test may write to production data |
| ⛔ **Admin is auth-gated and agents may not authenticate** | **The entire admin UI cannot be visually or interactively tested by an agent.** 164 of 242 test files cover admin *logic* precisely because the UI is unreachable |
| ⛔ **Production still ships the maintenance banner; bookings are CLOSED there** | Production and local render different chrome on every page. **Pin which one a test targets** |
| **Local has bookings OPEN** (Phase 12 is in the working tree) | The booking flow is testable locally, and only locally |
| **No dev server was running** as of 2026-08-17 | Port 3000 was empty. Verify before assuming — the standing "it's the Owner's, never touch it" rule was found stale |

---

## 2 — Environment

```
node       v24.16.0          next               16.2.4
pnpm       10.17.1           react              19.2.4
typescript ^5                vitest             ^4.1.5
                             @playwright/test   ^1.59.1
```

Deploy target: **Cloudflare via OpenNext** (`opennextjs-cloudflare`, `wrangler.jsonc`).
`trailingSlash: true`. Sentry `tunnelRoute: "/monitoring"`. **66** Supabase migrations.

---

## 3 — Test infrastructure that already exists

**Unit — `vitest.config.ts`:** `environment: "jsdom"`, `globals: true`,
`include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]`, `exclude: ["e2e/**"]`.
⛔ **No coverage reporter is configured** — `grep -c coverage package.json vitest.config.ts` → **0 / 0**.

**E2E — `playwright.config.ts`:** `testDir: "./e2e"`,
`baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000"`, two projects — **Desktop Chrome** and
**Pixel 5**. ⚠️ E2E **skips unless `E2E_BASE_URL` is set**, and needs seeded staff
(`pnpm test:e2e:setup` / `test:e2e:cleanup`).

**6 e2e specs:** `admin-contrast` · `admin-roles` · `admin-settings` · `booking-claiming` ·
`booking-public` (plus `helpers.ts`, `admin-contrast-helpers.ts`).

**Checks already wired into `package.json`:**

| Command | What it does |
|---|---|
| `pnpm test` / `pnpm test:unit` | `vitest run` |
| `pnpm test:e2e` | Playwright |
| `pnpm test:security:secrets` | `scan-browser-secrets.mjs` — scans the browser bundle for secrets |
| `pnpm verify:london-time` | timezone correctness |
| `pnpm lint` · `pnpm build` | eslint · `gen-image-manifest.mjs && next build` |

**Standalone gate scripts:** `measure-admin-contrast.mjs` · `verify-admin-token-contrast.mjs` ·
`measure-admin-bundles.mjs` · `extract-doc-citations.sh` · `extract-doc-doc-citations.sh`.

---

## 3.1 — ⛔ E2E authentication: how it works, and why it does NOT work right now

`.env.example` defines credentials for **8 roles** — `OWNER`, `ADMIN`, `COORDINATOR`,
`THERAPIST_A`, `THERAPIST_B`, `REPORTING`, plus optional `INACTIVE` and `NON_STAFF`.

### ✅ The mechanism is sound, and it is agent-safe

`e2e/helpers.ts` `loginAs()` **does not type a password into a form.** It calls Supabase's
`createBrowserClient(...).signInWithPassword` programmatically and injects the resulting session
cookies into the Playwright context. `getCredentials(prefix)` only ever reads
`process.env[E2E_<ROLE>_EMAIL|PASSWORD]`.

⛔ **So an agent can run these tests without ever seeing, typing, echoing or committing a credential.**
The value travels `.env` → `process.env` → the Supabase SDK → a session cookie. It never enters the
agent's context. That is ordinary CI practice and is materially different from an agent typing a
password into a login field, which remains prohibited.

### ⛔ But as configured today, ZERO credentials reach the test process

**Measured, not assumed** (booleans only — no value was read or printed):

```bash
node -e 'console.log(Boolean(process.env.E2E_OWNER_EMAIL))'              # false
node --env-file=.env -e 'console.log(Boolean(process.env.E2E_OWNER_EMAIL))'  # true
```

**Why:** `playwright.config.ts` imports nothing but `@playwright/test` and reads only
`process.env.E2E_BASE_URL`. There is **no `globalSetup`**, and **`dotenv` is not installed**
(0 references in `package.json`) and must not be added. **Playwright never loads `.env`.** Next.js
does — Playwright is a different process.

### ⛔⛔ The consequence is a SILENT PASS, not a failure

Every role-gated spec is written as `test.skip(!requireCredentials([...]), "...")`. With no
credentials in the process, **`pnpm test:e2e` skips essentially every meaningful assertion and
reports success.** A green E2E run today proves almost nothing — the same shape of failure as
gotcha 118. **Count the executed tests, not the exit code.**

### What actually makes it work

`.env.example` prescribes an untracked **`.env.e2e`** (⚠️ which **does not currently exist** — the
real values are in `.env`). Either location works provided the file is passed explicitly, since
Node 24 supports `--env-file` natively:

```bash
node --env-file=.env node_modules/@playwright/test/cli.js test
# and E2E_BASE_URL must be set, or every spec skips on hasBaseUrl()
```

⚠️ **`E2E_REPORTING_EMAIL` is not set** in `.env` (measured `false` while the other five resolved
`true`), so the reporting-role specs in `admin-roles.spec.ts` will skip even after the env file is
wired in.

### ⛔ The real risk is not the credentials — it is the database

**Only ONE Supabase project is configured.** There is no test, staging or branch database anywhere
in `.env.example`, `playwright.config.ts`, `e2e/` or `scripts/`. `E2E_BASE_URL` defaults to
`127.0.0.1:3000`, so the *app* is local — but it authenticates against, reads from and writes to the
**live production database holding real customer bookings**.

⛔ **Any e2e test that creates, claims, cancels or modifies a booking writes to production customer
data.** `booking-claiming.spec.ts` does exactly this class of thing. This is the constraint that
should shape the entire e2e strategy, and it is a far larger concern than credential handling.
Options worth weighing before running anything: a Supabase branch/preview database, a seeded and
namespaced test tenant, or keeping destructive e2e strictly manual and Owner-driven.

---

## 4 — ⛔ THE BASELINE. Any deviation is a regression until proven otherwise.

```powershell
npx tsc --noEmit                              # 0
npx vitest run                                # 0 failed / 2501 passed / 242 files
pnpm lint                                     # 4 errors / 1 warning, THREE files
npx vitest run scripts/                       # 47 passed
node scripts/measure-admin-contrast.mjs .     # 110 (46 dark / 64 light)
node scripts/verify-admin-token-contrast.mjs  # 0
git status --porcelain -- src/ supabase/      # EMPTY
```

⛔ **The 4 lint errors ARE the baseline, not a defect** — `BookingExperience.tsx`,
`BookingExperienceLoader.tsx`, `returning-customer.ts`. Do not "fix" them.

⛔ **CHECK THE TEST COUNT, NOT JUST THE COLOUR (gotcha 118).** On 2026-08-17 one full run reported
`Test Files 241 passed (241) / Tests 2480 passed (2480)` **with exit code 0** — no failure, no error,
no skip notice. The gap was exactly `canonicals.test.ts` (21 tests), which passes in isolation. Three
other runs returned 242 / 2501. **A green exit code with a lower count is a real and silent failure
mode.**

**Citation gates** (pass on set-difference, never on zero): code→doc **1** pre-existing dangling
entry — external, a migration comment citing a file in the user's global `~/.claude/plans/`;
doc→doc **429**, mostly prescriptive output paths inside recipes.

---

## 5 — What IS covered — 242 test files, 2,501 tests

| Area | Files |
|---|---:|
| `app/admin` | **164** |
| `lib/email` | 23 |
| `app/api` | 9 |
| `features/booking` | 8 |
| `lib/booking` | 7 |
| `components/consent` | 5 |
| `scripts` | 4 |
| `lib/auth` | 3 |
| everything else | 19 |

⚠️ **68% of the suite is admin logic.** That is a rational response to the admin UI being
untestable, but it means the customer-facing surface is the thinner half.

---

## 6 — ⛔ What is NOT covered. This is the honest map.

1. ⛔ **No coverage measurement of any kind.** No reporter, no thresholds, no enforcement. **The real
   coverage percentage of this codebase is unknown.** Establishing it is probably step one.
2. ⛔ **8 of 11 public component directories have ZERO tests.** Only `consent`, `faqs-aftercare` and
   `layout` have a `__tests__` folder. **Untested as components: `home`, `about`, `services`,
   `reviews`, `area-pages`, `package-pages`, `media`, `shared`** — essentially the whole
   customer-facing marketing surface. *(Their routes are partly covered by `canonicals.test.ts` and
   `sitemap-robots.test.ts`, which assert metadata, not rendering.)*
3. **No visual-regression capability at all.** The Phase 6/7 screenshot archives and the C-21
   baseline were deleted 2026-08-17 by Owner decision. Visual testing starts from zero.
4. **No load, stress or soak testing.** No k6/artillery/autocannon config exists.
5. **No automated accessibility suite for public pages.** The two contrast scripts cover **admin
   tokens only**. Public-page a11y has only manual Lighthouse history.
6. **No migration test harness** for the 66 Supabase migrations, and no rollback rehearsal.
7. ⛔ **E2E currently runs ZERO authenticated assertions and reports success** — see §3.1. Playwright never loads `.env`, so every role-gated spec skips silently. 6 specs, and only `booking-public` touches a public page.
8. **No contract or schema tests** against the live Supabase schema.
9. **No bundle-size gate.** `measure-admin-bundles.mjs` exists but is manual, and its baseline
   (`redesign/baselines/bundle-pre-B1.json`) dates from Band B.

---

## 7 — Known-good production measurements to test against

From the SEO/AEO/GEO release verification, measured against production 2026-08-13:

| Metric | Value |
|---|---|
| LCP · CLS · TTFB | **482 ms** · **0.00** · 298 ms |
| Lighthouse mobile | A11y **100** · SEO **100** · Best Practices **96** |
| The BP gap | `errors-in-console` — self-inflicted 429s on Sentry's `/monitoring` tunnel under automated load. ⚠️ **A single isolated load gives zero.** Pace any sweep or you will measure your own traffic |
| Indexable URLs | **18**, all 200, zero redirects, self-canonical |
| `/sitemap.xml` | 200, exactly 18 `<loc>`, all trailing-slashed |
| `/robots.txt` | our directives only, `Sitemap:` line present |
| FAQs in served HTML | **31** |
| `aggregateRating` | **0** — and must stay 0 |
| ⚠️ CrUX field data | **None.** Too few visitors — lab data only |

---

## 8 — ⛔ Known open defects. Tests SHOULD find these. They are not regressions.

⛔ **11 further defects were verified 2026-08-17 and have their own remediation plan:**
`redesign/plans/PRODUCTION-FIXES-2026-08-17-plan.md` — booking over-acceptance, unenforced pause/notice,
Coordinators reading health notes, new staff unable to sign in, unbounded input, duplicated prices,
e2e running nothing, migration drift the repo cannot rebuild from, and unscrubbed Sentry traces.
That file also records three claims that were **refuted**, so they are not re-raised.

**14 deferrals re-verified as still open in today's code** (`redesign/per-page-deferrals/`):

- `AdminErrorBoundary` fallback lacks `role="alert"`
- Therapist dashboard missing its gender-match chip and customer-notes block
- Client-detail: a Therapist with zero assignments hits `notFound()` before `AdminAccessDenied`
- Role create/delete and the password-reset flow unshipped, with **live FAKE markers** in source
- `audit` date-range presets are rolling windows, not calendar boundaries
- Repo-wide **oklch token drift — 98 files / 679 occurrences**
- Client-new postcode auto-fill never extended from booking-new
- Email-templates "Last sent" timestamp absent
- Staff avatar photos unsupported (no `avatar_url` column)
- `staff` pagination absent (low urgency, ~11 rows)

✅ **Fixed 2026-08-17:** `AdminActionMenu` trigger 36px → 44px (WCAG 2.5.5).

⚠️ **Unverified, needs DB access:** roles seed drift — the "Inactive" role has `active=true`.

---

## 9 — Open questions for whoever plans the testing

Deliberately **not** answered here. They are planning decisions, not measurements.

1. What coverage threshold is worth enforcing for ~15 bookings, 6 therapists and one engineer?
   ⛔ The Owner has explicitly said **do not over-engineer** — a 90% mandate would be exactly that.
2. Can the admin UI be tested at all without an authenticated session, and is the Owner willing to
   drive an authenticated e2e run themselves?
3. Does production-readiness testing happen **before or after** Phase 12 ships? Testing production
   today tests the bannered, bookings-closed version — not the one that will go live.
4. Is visual regression worth rebuilding, having just deliberately deleted the archives?
5. Which of the 14 open defects block "production ready", and which are accepted debt?

---

## 10 — How to re-measure every number above

```bash
node -v && pnpm -v                                                    # §2
git ls-files supabase/migrations | wc -l                              # §2
cat vitest.config.ts playwright.config.ts                             # §3
git ls-files '*.test.ts' '*.test.tsx' | wc -l                         # §5
git ls-files 'src/components/**/__tests__/*' | cut -d/ -f3 | sort -u  # §6.2
grep -c coverage package.json vitest.config.ts                        # §6.1
```

Full context and gotchas 109-118: `redesign/HANDOFF-2026-08-17-IMPLEMENTATION-10.md`.
