# HANDOFF — 2026-08-13 (sixth implementation session)

**Read this file first, end to end.** The six earlier handoffs keep their gotchas
and are **not** superseded:

- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — gotchas 1-15
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — gotchas 16-27
- `HANDOFF-2026-08-12-IMPLEMENTATION-3.md` §5 — gotchas 28-41
- `HANDOFF-2026-08-12-IMPLEMENTATION-4.md` §5 — gotchas 42-53
- `HANDOFF-2026-08-12-IMPLEMENTATION-5.md` §5 — gotchas 54-66

This file adds **gotchas 67-79** and supersedes -5's POSITION and NEXT-STEPS
only. Nothing is mid-flight. No agent is running. Every change is committed and
pushed.

| | |
|---|---|
| **HEAD** | `c3790b7` on `master`, **pushed to origin** (0 unpushed) |
| **Shipped** | **20 commits.** `CLEANUP-AND-CONTRAST-plan.md` is CLOSED — every item done, declined or answered |
| **Deployed** | ⛔ **THE SITE IS LIVE** at rahmatherapy.uk, in **maintenance mode**. Cloudflare auto-deploys on push to `master` |
| **Step Z** | ✅ **DONE.** `business_settings.allowed_cities` dropped (migration `20260813012046`) |
| **Next** | Two investigations, both **plan-then-present, do not fix yet** — see §7 |

---

## 1 — ⛔ GATE BASELINES. THREE CHANGED. Use these, not any earlier file's.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2442 passed (2447)          <-- CHANGED
pnpm lint           # 4 errors / 1 warning in THREE files     (unchanged)
npx vitest run scripts/                        # 47 passed    <-- CHANGED (was 42)
node scripts/measure-admin-contrast.mjs .      # 110 failures (46 dark / 64 light),
                                               #   209 unresolved, 153 tokens  <-- CHANGED
node scripts/verify-admin-token-contrast.mjs   # 0
git status --porcelain -- src/ supabase/       # exactly:  M src/lib/maintenance.ts
```

The **five** vitest failures are unchanged and unrelated to everything here:
`admin-access.test.ts` ×2 ("gives Owner broad access…", "gives Admin broad
operational access…"); `ManualBookingForm.test.tsx` ×3 ("renders step 1 on first
load", "moves focus to the first invalid field…", "shows the consent error…").
Isolate those two files before calling anything a regression.

Lint identity is the `{file, ruleId}` multiset: `BookingExperience.tsx`
{immutability ×1, set-state-in-effect ×2}, `BookingExperienceLoader.tsx`
{set-state-in-effect ×1}, `returning-customer.ts` {no-unused-vars ×1}.
**Never `file:line:column`** — deletions shift line numbers constantly.

**Layer 1 moved 127 → 110 deliberately** (ITEM B, −15; ITEM F deleted two dead
cards carrying `--admin-warning`, −2). Diff the finding **SET**, never the count
— and do it **line-number-independently**, as a multiset keyed on
`theme|file|fg|bg|ratio`. A positional diff reported **21 phantom new failures**
on the first attempt, because ITEM F and K.5 had shifted line numbers in the same
files. `--json` gives you the full set.

**Layer 3 was not run this session.** It needs real credentials and a browser; no
CSS changed after ITEM B, and Layer 1 confirms no contrast movement since.

---

## 2 — What shipped, in order

| # | Commit | What |
|---|---|---|
| 1 | `5a742df` | **ITEM M** — palette scoped search bounded; the repo's first test of that module |
| 2 | `4c955ea` | **ITEM K.1** — therapist bookings: candidate cap, filters before the cap, real pager |
| 3 | `7f26a2e` | Corrected HANDOFF-5's stale Layer 1 baseline |
| 4 | `b469b99` | **ITEM J** — Recent activity preview + expand link |
| 5 | `3f531ec` | **ITEM F** — deleted `PaginationControls` + `LoadMoreButton` |
| 6-9 | `7cfc4ca` `19356f8` `d8cd231` `58c21a1` | **ITEM N** — three exposures closed, one self-inflicted regression fixed |
| 10 | `ca859ed` | **ITEM K.4** — dashboard predicates pushed into SQL |
| 11 | `80bd350` | **ITEM G.1** — `@tanstack/react-query` removed (Zone-2, approved) |
| 12 | `207ac74` | **ITEM I.1** — one long-form business date helper |
| 13 | `2c0e749` | **ITEM K.5** — email tabs admit truncation |
| 14 | `bd3ba1c` | **ITEM F** — 25 unused exports + 2 files they emptied |
| 15 | `70b9589` | **ITEM B** — opacity washes below AA |
| 16 | `83f262a` | Plan's tail: stale comments, `countStaff`, dead scripts, decisions |
| 17-18 | `b97053e` `3d40076` | **STEP Z** — dual-write removed and deployed, THEN the column dropped |
| 19 | `c461b85` | ⛔ **Every photo on 5 page families was a placeholder in production.** Fixed |
| 20 | `c3790b7` | Maintenance notice moved to the bottom, clear of the fixed header |

---

## 3 — ⛔ OWNER DECISIONS. CLOSED. DO NOT RE-ASK ANY OF THESE.

| Decision | Answer |
|---|---|
| Medical disclaimer on /home, /about, /services | ⛔ **Owner handles personally. Out of scope for agents. Never raise again.** Recorded in plan §F.1 |
| Tracked design archives (`brand-logo-assets/`, `rahma-therapy-image-replacements/`) | **KEEP.** Recorded in plan §G.5 |
| Authenticated encryption for password-reset tokens (H.2) | ⛔ **NOT on the roadmap.** `payload_nonce` STAYS. Rationale is at the top of `src/lib/auth/password-reset-token.ts` so a grep finds it. **Do not list it as dead schema** |
| `@tanstack/react-query` | Removed |
| Step Z | Run. Done |
| Hamburger appearing below 1280px | **Leave it.** Owner declined; not a defect |
| Appearance at 25% browser zoom | **Leave it.** Measured: nothing overflows. Not a defect |
| ITEM E.1 `ui/` shadcn scaffolding | Already answered in `fc3989e`: deleted, regenerable via CLI |

---

## 4 — ⛔ THE PRODUCTION IMAGE BUG. Read this before touching any image code.

Every content photo on `/home`, `/about`, `/areas` + its five spokes, the five
package pages and `/reviews` rendered as a **placeholder** on the live site while
looking perfect in dev. ~210 placeholder instances.

**Cause.** Five wrappers asked
`existsSync(path.join(process.cwd(), "public", src))` whether a photo existed.
**Cloudflare Workers have no filesystem**, so it answered "no" for every image.
Locally Node answered "yes". Nothing was missing — all 89 files were tracked,
deployed and returning HTTP 200.

**Fix.** `scripts/gen-image-manifest.mjs` scans `public/images` at build time and
emits `src/lib/media/image-manifest.ts` — **plain data, no imports**. All seven
wrappers now use it.

⛔ **The manifest must stay client-safe.** `PackageFinder.tsx` and
`AftercareTabs.tsx` are `"use client"` and render these wrappers. A `node:`
import would break both pages — that is exactly why two wrappers had
hand-maintained lists before. `scripts/gen-image-manifest.test.ts` fails if the
manifest drifts from disk, is not byte-identical to a fresh render, or contains a
node builtin.

⛔ **Generation is INLINE in `build`, not a `prebuild` hook** — see gotcha 68.

**Current media state, measured live:** 68 content images, 66 render immediately,
2 are aftercare tab panels that render on click, 0 broken, 0 placeholders,
0 orphans, 0 referenced-but-missing.

---

## 5 — NEW GOTCHAS (67-79). Each cost real time.

67. **⛔ `existsSync` IN A COMPONENT IS INVISIBLE IN DEV AND TOTAL IN PRODUCTION.**
    The worst failure shape there is: dev has a filesystem, Workers do not, so the
    same code renders photos locally and placeholders live. Any `node:fs`,
    `node:path`, `process.cwd()` or `readFileSync` reached at request time is a
    production bug on this stack. Answer such questions at BUILD time and ship the
    answer as data.

68. **⛔ A `prebuild` npm HOOK NEVER FIRES HERE.** There is no `.npmrc`, and pnpm
    ≥7 defaults `enable-pre-post-scripts` to **false**. `opennextjs-cloudflare
    build` shells out to `pnpm build`. A generator wired as `prebuild` would
    silently never run and ship a stale artefact — the same class of bug by a
    quieter route. Wire generators INLINE: `"build": "node scripts/x.mjs && next build"`.

69. **⛔ `next/image` URL-ENCODES ITS PATHS, SO A `/images/` GREP UNDER-REPORTS.**
    Optimiser URLs read `%2Fimages%2Ffoo.jpg`. Two consecutive audits reported
    images "missing from the HTML" that were present. Decode `%2F` (and `&amp;`)
    before matching, and sanity-check the count against `<img` tags.

70. **⛔ `git add -u src/` SWEEPS UP `maintenance.ts`.** It did, and committed the
    flag flip. Recovered by `git checkout HEAD~1 -- <path>` + `--amend`. **Stage
    by explicit path, every time.** Watch `git add -- src/lib` too: it includes
    `src/lib/maintenance.ts`.

71. **⛔ A "DELETE UNUSED EXPORTS" CUTTER THAT CUTS TO THE NEXT `export` EATS LIVE
    CODE.** Cutting from a declaration to the next top-level `export` swallowed
    the NON-exported helpers sitting between two targets (`ReadinessChip`,
    `ClientMixLegend`, both used by live cards) and produced a plausible-looking
    file. `tsc` caught it. End at the declaration's own closing brace by
    balancing delimiters, and refuse to write an unbalanced cut.

72. **⛔ A NODE SCRIPT REWRITING A FILE CAN FLIP ITS LINE ENDINGS AND FAKE A HUGE
    DIFF.** `availability.ts` showed **1,896** changed lines for a **14**-line
    edit. `git diff --ignore-cr-at-eol` exposes it. Detect the file's own EOL and
    write it back. ⚠️ `subprocess.run(..., text=True)` in Python silently
    translates CRLF→LF, so a byte-level check must read **bytes**.

73. **⛔ STEP Z's DOCUMENTED ORDER WAS BACKWARDS.** The code comment said delete
    the dual-write *after* the `DROP COLUMN`. That breaks production: the running
    site writes whatever it last deployed, so dropping first fails every
    business-settings save with PGRST204 until the next deploy. **Code first,
    deployed, then the DDL.**

74. **⛔ POSTGRES CANNOT TELL YOU IF A FUNCTION READS A COLUMN.** PL/pgSQL bodies
    are opaque text, invisible to `pg_depend`, so a dependency walk reports "safe
    to drop" either way. The authoritative check before any `DROP COLUMN` is a
    text scan: `select … from pg_proc where prosrc ilike '%col%'`, plus views,
    policies, indexes, constraints and triggers.

75. **⛔ A HARDCODED ALLOWLIST MAY BE A WORKAROUND, NOT A POLICY.** Two image
    wrappers held "approved path" Sets that looked like an approval gate. Git
    history showed they were byte-for-byte mirrors of disk, created only because
    those components render inside `"use client"` parents. Treating them as policy
    would have preserved a maintenance burden forever. **Check the history for
    intent before honouring a list.**

76. **⛔ A FIXED HEADER CANNOT BE PUSHED DOWN BY AN IN-FLOW SIBLING.**
    `.navbar31_component` is `position: fixed; inset: 0 0 auto`. The maintenance
    banner rendered above it in flow and the two shared the same band — the logo
    sat inside the banner's box. Anything added above that header needs the header
    offset, or must go somewhere else entirely.

77. **⚠️ A BUG THAT SHOWS ON ONE PAGE MAY EXIST ON ALL OF THEM.** The banner
    collision was only *visible* on `/home`, because that header is transparent
    over the hero. On every inner page the opaque header hid the notice
    completely — worse, and silent. When a layout bug appears on one route, check
    a route with different chrome before scoping the fix.

78. **⛔ `TZ=…` DOES NOT APPLY TO NODE ON THIS WINDOWS HOST.** `TZ=Asia/Tokyo node
    -e "…"` still reports `Europe/London`. This machine IS in the business's
    timezone, so London-pinned and host-local agree by construction and any
    timezone-divergence property is **structurally unobservable** here. Two ITEM
    I.1 mutants survive for this reason, and that is recorded rather than hidden.

79. **⚠️ A SET DIFF KEYED ON LINE NUMBERS LIES AFTER A DELETION PASS.** Comparing
    Layer 1 before/after positionally reported 21 new failures that were the same
    findings shifted by ITEM F's deletions. Key the multiset on
    `theme|file|fg|bg|ratio` and count occurrences — the honest answer was
    **17 fixed, 0 new**.

---

## 6 — Plan claims that FAILED verification this session

| Where | Claim | Truth |
|---|---|---|
| HANDOFF-5 §1 | Layer 1 "123 (45 dark / 78 light), 240 unresolved, 152 tokens" | **Stale carry-forward.** Correct for `70a5af9`; at `1e75adc` it was **127 (49/78), 216, 153**. The plan was right; the handoff copied it forward after two commits moved it |
| ITEM B | "find which token(s) they resolve to and decide once whether the muted tone should be darkened" | **Wrong fix.** `--admin-text-muted` at full strength fails nowhere. Every failure is an **opacity wash** (`/40`…`/85`). Darkening the token would have moved ~150 passing elements and fixed none |
| ITEM B | the failures are defects | **9 of 15 sites are already `aria-hidden="true"`** — decorative, WCAG-exempt. Only 6 were real |
| ITEM I.1 | "point the consolidation at `formatBusinessDate`" | **Would have broken 16 baked email strings.** That helper is `dateStyle: "medium"`; these are `"full"`. A long-form twin was added instead |
| ITEM F | `AdminEmptyState` is unused | **ALIVE** — 4 non-test refs incl. `EmptyState.tsx:7`. Not deleted |
| ITEM F | `packageSessionSteps`, `headerCta` unused | **Already gone.** Stale entries |
| ITEM M | "the exported `ActivityRow`" | **Not exported** |
| ITEM K.5 | "a 'showing 20 of N' count would close it" | An exact N needs a head-count query that **breaks `emails-data.test.ts:558-587`**. Shipped a hedged notice keyed on `length === cap` instead |
| Step Z | "delete this line after the DROP COLUMN — and not before" | **Backwards.** See gotcha 73 |
| ITEM N | `filterReportDataToStaff` protects the export route | True *here*, but it narrows only 4 of 8 keys — `staff`, `enquiries`, `emailEvents`, `operationalEvents` pass straight through |

---

## 7 — ⛔ WHAT IS LEFT. Two investigations. **PLAN AND PRESENT — DO NOT FIX YET.**

The Owner wants options and a recommendation for each, then chooses. Both are
**known, recorded, non-urgent** — nothing is broken in production.

### 7.1 — Three coverage gaps

All three are places where a shipped guard cannot be observed by the test suite.
They were disclosed in the commits rather than hidden; the Owner wants a plan to
close them properly.

1. **`src/app/admin/bookings/page.tsx`** — the therapist pager's one wiring line
   (`const visibleBookings = canViewAll ? filteredBookings : scopedWindow.rows;`).
   Mutating it is NOT caught. The paging *math* is fully covered by
   `paginateInMemory` in `src/lib/pagination.test.ts`; it is the wiring that is
   not. Server component, no unit harness.
2. **`src/app/admin/reports/reports-data.ts`** — the `resolvableStaffFor`
   narrowing added in `d8cd231`, which stops the insights stripe naming a
   colleague to a Therapist. `__tests__/report-insights.test.ts` sets
   `staff: []`, so the per-staff rule it defends **has never executed in the
   suite**. Proving it needs a fixture with bookings, assignments and
   availability rules across two comparable periods.
3. **`src/lib/time/london.ts`** — `formatBusinessDateLong`'s timezone
   independence. Two mutants survive (midnight vs noon; dropping the London pin)
   because this host is already `Europe/London` and Node ignores `TZ` on Windows
   (gotcha 78). Only the `dateStyle` mutant is caught.

**Worth considering, not prescribing:** a Playwright/RTL harness for server
components; a CI job on a non-London timezone; injecting a clock/zone; or
accepting one or more with the reasoning recorded. The Owner explicitly does not
want over-engineering — a proportionate answer for a 15-booking clinic is a valid
recommendation, including "leave it, here is why".

### 7.2 — The therapist bookings cap (125)

`SCOPED_CANDIDATE_ID_CAP = 125` in `src/app/admin/bookings/bookings-list-data.ts`.

Beyond 125 lifetime assignments a therapist cannot reach their oldest bookings
from `/admin/bookings` unless they narrow with a date filter. Read that
constant's comment first — it explains why the number is arithmetic, not taste
(UUIDs cost 37 chars each in an `.in()` query string; the read 414s past ~8 kB),
and why `created_at DESC` makes the cap **deterministic but NOT chronological**
(`extend-recurring-horizons` materialises a series 12 weeks ahead, so a live
series' newest rows are its farthest-FUTURE dates).

**Constraints any solution must respect:**
- PostgREST cannot order a parent by an embedded column, so this read cannot be
  ordered by `booking_date` directly.
- A therapist's list is `assigned ∪ claimable` — PostgREST cannot express that
  union in one request, which is why the branch merges two reads in memory.
- `booking_assignments!inner` **can** filter without an id array — and the
  aliased-embed idiom already ships (`bookingSelectWith` emits
  `alias:table!inner(id)` alongside the untouched full embed). ⚠️ A NON-aliased
  `booking_assignments!inner` would filter the rendered nested array and break
  the "1 of 2 therapists assigned" label — see `BookingCard.tsx`.
- Business reality: **15 bookings, 6 therapists, all Luton.** The cap binds in
  roughly 18 months at current volume. This is not urgent.

**Also tracked, same area:** ITEM M's **A2** — replace the command palette's id
array with a `booking_assignments!inner` embed, gated on a multi-participant
dedup test (the schema permits two assignment rows per booking/staff pair).
`performance-data.ts` already ships that shape. Solving 7.2 well may solve A2.

---

## 8 — Standing facts (restated so this file stands alone)

- ⛔ **THE SITE IS LIVE.** Pushing to `master` **auto-deploys** via Cloudflare's
  GitHub integration. There is no CI and no staging. A push is a production
  release. Deploys take ~3-4 minutes.
- ⛔ **MAINTENANCE MODE IS ON.** `src/lib/maintenance.ts` — working copy `false`,
  **HEAD `true`**, deliberately uncommitted. **Never stage or commit this file.**
  Committing the working copy would OPEN LIVE BOOKINGS. Only the Owner decides
  when that flips.
- **Tree is intentionally dirty**: `git status --porcelain -- src/ supabase/`
  must show exactly ` M src/lib/maintenance.ts`. **Never `git add .`/`-A`/`-u`.**
- **Zone-2** = migrations, data-mutating SQL, deploys, package installs, env
  changes, real emails. **Owner-approved per action, orchestrator-performed,
  never delegated.** Present exact SQL in chat and STOP.
  `mcp__supabase__execute_sql` is SELECT-only; use `apply_migration` for DDL and
  **commit a matching file** to `supabase/migrations/` so the repo does not drift.
- **⛔ Never send a real email.** `src/lib/email/client.ts` wraps the live Resend
  SDK and `RESEND_API_KEY` is populated.
- **Dev server is Owner-run** at `localhost:3000` (not `127.0.0.1`). Never spawn,
  restart or kill it.
- **Commit messages**: PowerShell here-strings strip double quotes — always
  `git commit -F <scratchpad file>`.
- **Teeth-check every guard by mutating the source**, asserting the anchor occurs
  exactly once **in the file's own EOL form**, running, restoring, and confirming
  byte-identity — and attribute the failure to the guard **BY NAME**.
- **Business reality that should govern effort**: 15 bookings, all Luton, 6
  therapists. Most of this work is about the next 2-3 years, not today.

---

## 9 — Method that worked, and is worth repeating

**Measure the live site, not the code.** The image bug, the banner collision and
the "some pages still missing media" report were all settled by `curl` against
production plus real geometry — not by reading components. Three separate
hypotheses (missing commits, storage migration, Cloudflare config) were all
wrong, and one command disproved each.

**Critique the FINISHED diff, and act on it.** Adversarial passes caught, in
order: an overconfident cap value (200 → 100, on measured URL length), a test
that never asserted the scoping filter it existed to protect, a regression I had
just introduced (Coordinators losing staff names), and the plan's own backwards
Step Z ordering. Every one changed shipped code.

**When the plan and the measurement disagree, the measurement wins — and say so.**
Four plan-prescribed fixes were wrong this session (§6). Following ITEM B or
ITEM I.1 literally would each have caused a regression.

**Report the coverage you do NOT have.** Three guards ship uncovered and are named
in §7.1 rather than buried. A mutation harness that reports "all caught" is only
worth something if it also reports what it could not reach.
