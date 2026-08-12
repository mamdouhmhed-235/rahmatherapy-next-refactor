# HANDOFF — 2026-08-12 (fifth implementation session)

**Read this file first, end to end.** Then `redesign/plans/CLEANUP-AND-CONTRAST-plan.md`
in full — it is the live plan now, and it is where all remaining work lives.

The five earlier handoffs are still live and are **not** superseded for their gotchas:
- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — gotchas 1-15
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — gotchas 16-27
- `HANDOFF-2026-08-12-IMPLEMENTATION-3.md` §5 — gotchas 28-41
- `HANDOFF-2026-08-12-IMPLEMENTATION-4.md` §5 — gotchas 42-53

This file adds §5's **new gotchas 54-66**, and supersedes -4's POSITION and
NEXT-STEPS only. Nothing is mid-flight. No agent is running. Every change is
committed.

| | |
|---|---|
| **HEAD** | `1e75adc` |
| **Branch** | `master` |
| **Shipped** | 25 commits. **POST-BAND-C plan CLOSED at 8/8.** Item 7 finished; then a full codebase audit and 6 of the new plan's items |
| **Next** | `CLEANUP-AND-CONTRAST-plan.md` — ITEM M, then K.1, then J |
| **Deploy** | Still deferred to the very end, by Owner decision. **Step Z runs only after it** |

---

## 1 — ⛔ GATE BASELINES. These CHANGED this session. Use these, not any earlier file's.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2397 passed (2402)
pnpm lint           # 4 errors / 1 warning in THREE files      <-- CHANGED
git status --porcelain -- src/ supabase/   # exactly:  M src/lib/maintenance.ts
```

**⛔ THE LINT BASELINE MOVED** from 59E/7W in six files to **4E/1W in three**.
`design_handoff_area_pages/` was moved out of the repo and its three
`prototype/*.jsx` files held 55 errors and 6 warnings. What remains is exactly
the untouchable set — `BookingExperience.tsx` (2× `set-state-in-effect`,
1× `immutability`), `BookingExperienceLoader.tsx` (1× `set-state-in-effect`),
`returning-customer.ts` (1× `no-unused-vars`). **Every document in this repo
quoting 59E/7W is stale.** Identity is still the `{file, ruleId}` multiset.

**The vitest count also moved** — 2398 → 2402 total, because this session added
guards. The **five** failures are unchanged and unrelated to everything here:

```powershell
npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx   # exactly 3 failed / 33 passed (36)
npx vitest run src/lib/auth/admin-access.test.ts                       # exactly 2 failed / 4 passed (6)
```

The documented 6th flake (`ManualBookingForm > optional email > …`, 5000ms
timeout) did not appear once this session across ~15 full runs. It is
intermittent, not gone.

### The three contrast layers — current readings

```powershell
node scripts/measure-admin-contrast.mjs .      # 127 failures (49 dark / 78 light), 216 unresolved, 153 tokens
node scripts/verify-admin-token-contrast.mjs   # 0 failures
npx vitest run scripts/                        # 42 passed
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```

> **⛔ CORRECTED 2026-08-12 (seventh session).** This block previously read
> *"123 failures (45 dark / 78 light), 240 unresolved, 152 tokens"*. Those are
> the readings at **`70a5af9`** — the base commit `CLEANUP-AND-CONTRAST-plan.md`
> §1 declares, where they are still correct. They were carried into this file
> unchanged, but two commits in this handoff's own list had already moved them:
>
> | commit | tokens | unresolved | total | dark | light |
> |---|---|---|---|---|---|
> | `70a5af9` | 152 | 240 | 123 | 45 | 78 |
> | `7d2f787` (the button fix) | 152 | **216** | 123 | 45 | 78 |
> | `1d85f97` (the avatar ink) | **153** | 216 | **127** | **49** | 78 |
> | `1e75adc` → `0dd1a6e` | 153 | 216 | 127 | 49 | 78 |
>
> Measured in throwaway `git worktree`s at each commit, twice, identically. Note
> `1d85f97` **added** four Layer 1 dark findings and a token while removing
> Layer 3 ones — the two layers are different instruments and do not move
> together. **Light stayed 78 throughout**, which is exactly why the staleness
> hid: the one number anyone was watching never changed.
>
> Method note: the failing check here was *"the numbers do not reproduce"*, not
> *"the plan is wrong"*. Re-measuring at the commit a document names, before
> editing it, separated a stale carry-forward from an actual error.

**Layer 3 is now DETERMINISTIC** (see gotcha 55) — **79 failures total**, dark
**3 per role**, and two consecutive runs produce **byte-identical** evidence
files in all ten. That byte-identity is now the standard: if a run differs from
its predecessor on unchanged code, something is wrong with the harness, not the
product.

**⛔ Layer 1's light count is no longer 79.** It is **78**, and that is correct —
this session deliberately shipped appearance changes the Owner approved. The
"light is frozen at 79" rule from item 7 **no longer applies**; the rule that
replaced it is: *measure the failure SET, not the count, and account for every
entry that moves* (gotcha 57).

---

## 2 — What shipped, in order

| # | Commit | What |
|---|---|---|
| 1-9 | `856d1bb`..`d1425cf` | **Item 7's tail.** 58 new token pairs across 8 batches, then 3 dark-value corrections + a real print-block guard |
| 10 | `9b77821` | Phase D sweep; found Layer 3's light half was noise |
| 11 | `99af96e` | Last 4 Owner decisions — **static oklch literals reach ZERO** |
| 12 | `70a5af9` | **Layer 3 made deterministic**, and the two failures that exposed |
| 13 | `9867632` | 258 phantom deletions recorded |
| 14 | `6f52846` | **The old brand removed from the public `/cookies` page** |
| 15 | `fc3989e` | 8 dead files, 457 lines |
| 16-18 | `a3fced2`..`4406a5e` | Plan corrections + 130 lines of unrendered copy removed |
| 19 | `7d2f787` | **One CSS line killed the browser's ButtonFace grey** — Layer 3 dark 258 → 38 |
| 20-21 | `a67a841`, `1d85f97` | Avatar initials get an ink that cannot invert — dark 19 → 3 per role |
| 22-24 | `0d7cb87`..`eec7148` | ITEMS J, K, L, M, N written into the plan |
| 25 | `1e75adc` | **⛔ SECURITY: a therapist could export every client's name. Fixed** |

---

## 3 — ⛔ THE SECURITY FIX, AND WHAT IT DID NOT FIX

`1e75adc` closed a live data exposure: `/admin/reports/export?report=client_summary`
served a CSV of **every client's full name** to any therapist.

**Why it was reachable:** `Therapist` holds both `view_reports_own` and
`export_reports_own` (`20260509143000_granular_rbac_consolidation.sql:283-284`),
so it passed the route's gate; `report` is an unvalidated query param; and
`getReportData` returns `clients` **unscoped for every profile**.

**The fix** narrows via `filterReportDataToStaff` for any profile without
`hasUniversalReportScope`. All seven report branches were checked, not just the
one that leaked. An Owner's export is byte-identical to before.

⛔ **THE ROOT CAUSE IS STILL OPEN — ITEM N.** `getReportData` returns `clients`,
`staff`, `enquiries`, `emailEvents` and `operationalEvents` as full clinic-wide
tables for every caller, across **four** surfaces: `reports-data.ts`,
`performance-data.ts` (→ `/admin/me` **and** `/admin/staff/[staffId]/performance`),
`export/route.ts`, and **`calendar/calendar-data.ts:40,92`**. The export route is
now defended; the other three are not audited for what they render.

⚠️ **`calendar-data.ts:3-4` carries a comment that is actively false**:
*"getReportData applies its own RBAC narrowing from the profile it is given."*
True for bookings only. Do not trust it.

---

## 4 — Owner decisions this session

| # | Decision | Answer |
|---|---|---|
| 21 | Item 7's remaining ~33 colours | Batch them; do not do all in one commit. **Done, 8 batches** |
| 22 | The inert `hover:border-b-[oklch(60% 0.08 247)]` | **Delete the dead class** (it never compiled — a class attribute is whitespace-delimited) |
| 23 | LivePreview's error chrome on frozen white | **Mint an inverting chrome ground**; keep the paper light |
| 24 | The count pill at 3.52:1 | **Leave it** — later fixed anyway as part of the button work |
| 25 | `button.tsx`'s legacy green active state | **Reuse `--admin-primary-active`**, retire the duplicate token |
| 26 | The 5 unused shadcn `ui/` files | **Delete them** — regenerable via the CLI, so not a one-way door |
| 27 | The unused `content/pages/*` copy | **Show it first**, then **delete all 9** |
| 28 | `design_handoff_area_pages/` (6.1 MB) | **Move out of the repo, do NOT delete** — it was never tracked, so deletion was unrecoverable |
| 29 | The grey buttons | Fix them → became **one CSS line**, not 30 edits |
| 30 | The client avatar circles | Fix them |
| 31 | ITEM L | **Fix it now** |

---

## 5 — NEW GOTCHAS (54-66). Each cost real time.

54. **⛔ A HEREDOC CAN EAT A BACKSLASH AND FAKE A CLEAN RESULT.** Writing a
    mutation anchor via `cat <<'EOF'` turned `\\s` into `\s`, which JS then
    evaluated as `s`, and the harness reported a confident **"anchor
    occurrences: 0"** — indistinguishable from "the anchor is gone". Author
    anchors with the **Write tool** and `String.raw`, and always report the count
    you found rather than concluding "missing".

55. **⛔ LAYER 3's LIGHT READINGS WERE ~95% ARTEFACT, FOR ITS ENTIRE EXISTENCE.**
    `THEMES = ["dark","light"]`, so every route was audited in dark and then
    FLIPPED — and `setAdminTheme` only set the attribute, with the audit running
    on the very next line, against `transition-colors` at 160ms. The light pass
    was sampling mid-interpolation. Two runs on identical code disagreed by 110
    failures on one route while every dark file matched to the unit. Fixed in
    `70a5af9` by injecting `transition: none` before the theme loop; totals
    1745 → 328. **Animations are deliberately left running** — killing
    `animate-pulse` would change what is on screen.

56. **⛔ TO ASK "IS THIS TEXT RENDERED", GREP THE SYMBOL, NOT THE STRING.** Two
    wrong claims in one session came from `git grep "does not diagnose" -- src/components`:
    it answers *"is this text written here"*, which silently misses every
    component that imports the constant. `/faqs-aftercare` **does** show a
    medical disclaimer, via `SafetySuitability.tsx`.

57. **The "light mode is frozen" rule ENDED this session.** Item 7 held light at
    exactly 79 across 702 substitutions. The button and pill fixes deliberately
    moved it to 78. The replacement discipline: **diff the full finding SET**
    against a throwaway `git worktree` at the previous commit and account for
    every entry that moves. That is how the pill fix was proved to move exactly
    two entries and add none.

58. **⛔ `git status` HID 258 PHANTOM DELETIONS FOR MONTHS.** `.playwright-mcp/`
    (241) and `design_handoff_public_pages/` (17) were tracked but long deleted
    from disk. `.playwright-mcp/` was already in `.gitignore` — **gitignore has
    no effect on already-tracked paths**, which is why ignoring it never helped.

59. **⛔ A REGEX THAT STOPS AT THE FIRST `>` MISSES MOST JSX ELEMENTS.** Counting
    `<button>` tags without a `bg-` class gave 30; the TypeScript AST gave 44.
    Any `onClick={() => …}` before the `className` truncates the match. Use
    `measure-admin-contrast.mjs`'s exported `resolveClassExpr` + the repo's own
    `typescript` (import it by absolute path when scripting from outside the repo).

60. **⛔ TAILWIND PREFLIGHT IS DELIBERATELY NOT IMPORTED HERE.** `globals.css`
    imports only `theme` and `utilities`, because `site-parity.css` depends on
    browser defaults surviving. The cost was `background-color: ButtonFace` on
    every `<button>` without its own background — `rgb(240,240,240)`, which does
    not invert. **Verified in the live browser**: an empty `<button>` appended to
    the page computed exactly that. Fixed with one `@layer base` rule.

61. **⛔ AN ARBITRARY VALUE WITH RAW SPACES NEVER COMPILES.**
    `hover:border-b-[oklch(60% 0.08 247)]` in `clients/page.tsx` had never
    rendered — a `class` attribute is whitespace-delimited, so that was never one
    class name. Confirmed against the live 377 kB CSS bundle: zero
    `border-b-[oklch…]` utilities.

62. **⛔ A TEST CAN ENCODE A BUG AS INTENDED BEHAVIOUR.**
    `booking-view-counts.test.ts:345-367` — *"leaves the therapist-scoped branch
    un-paged (one page, no range)"* — asserts `pageCount: 1`, which is exactly
    the truncation defect of ITEM K.1. Fixing K.1 means **rewriting that test**,
    not keeping it green.

63. **⛔ A `.limit()` ON THE ROW FETCH DOES NOT BOUND THE ID ARRAY FEEDING IT.**
    `SCOPED_BRANCH_ROW_CAP = 200` looks like a bound but only caps the final
    `.in(ids)` read; `getScopedBookingIds` builds `ids` from an **uncapped**
    `booking_assignments` query. The same shape is live and uncommented in
    `search-actions.ts` (ITEM M). When auditing a cap, check what feeds it.

64. **⛔ PERMISSION GATES THAT LOOK RIGHT CAN STILL BE WRONG.** ITEM L's gate
    genuinely checks an export permission — and `Therapist` holds it. The
    exposure came from what happened **after** the gate. When auditing access,
    trace the DATA, not just the guard.

65. **A SCOPED BRANCH AND AN ALL-ROWS BRANCH CAN HAVE DIFFERENT BOUNDING, AND THE
    SCOPED ONE IS USUALLY WORSE.** `/admin/bookings` paginates the clinic-wide
    branch correctly and silently truncates the therapist's own. The command
    palette does the same. **A page-by-page audit cannot find these** — sweep
    variant-by-variant, keyed on the permissions that flip a query's shape.

66. **⚠️ Production data is so small that every list looks fine.** 15 bookings,
    6 therapists, ~40 email events. "It renders 3 rows in my fixture" proves
    nothing. The only useful question is *what stops this growing*.

**Also re-confirmed:** PowerShell's cwd persists between tool calls and drifted
again. Git Bash's `/tmp` is **not** Node's `C:\tmp` — writing with `curl -o /tmp/x`
then reading with Node's `fs` fails confusingly; use the scratchpad.

---

## 6 — Plan claims that FAILED verification this session

| Where | Claim | Truth |
|---|---|---|
| HANDOFF-4 §7 | "~33 distinct colours remain" | **66 distinct / 120 occurrences** |
| HANDOFF-4 §7, ×8 commits | "A token missing from `@media print` falls back to the browser default" | **False.** A media query ADDS rules. It keeps its **dark** value and prints it |
| CLEANUP plan ITEM A | "30 buttons, 30 edits" | 44 by AST — and the right fix was **one CSS line** |
| CLEANUP plan ITEM C | "`/admin/audit` is the worst page, 70 of 113" | Dissolved on re-measure: **0 failures**, worst ratio 5.05:1 |
| CLEANUP plan ITEM F | "the unused copy is superseded duplicates; the site already says all of it" | **False both ways** — the unused list was *richer*, and `/services` has no disclaimer at all |
| CLEANUP plan G.5 | "`design_handoff_area_pages/` is tracked" | **Untracked.** Deleting it would have been unrecoverable |
| Audit agent | "`faqsAftercareDisclaimer` is unused" | **Live**, via `SafetySuitability.tsx` |
| Design agent | ITEM N is "leaked counts, not raw PII" | **False** — `export/route.ts` returned raw client names (ITEM L) |

---

## 7 — What is left, in order

**Everything lives in `redesign/plans/CLEANUP-AND-CONTRAST-plan.md`.**

| # | Item | Why here |
|---|---|---|
| 1 | **M** — command palette scoped branch | Same shape as the security-adjacent bugs; small; `search-actions.test.ts` does not exist |
| 2 | **K.1** — therapist bookings silent truncation | Hides a person's own work history. ⛔ Rewrite the test at gotcha 62 |
| 3 | **J / K.2** — Recent activity pagination | Owner-reported. **Endorsed design is the only SOUND verdict** |
| 4 | **N** — `getReportData` unscoped collections | Root cause under ITEM L |
| 5 | **K.4** — dashboard attention | Push two JS predicates into SQL; indexes already exist |
| 6 | **B** — muted metadata text | The remaining 3 dark + ~24 light Layer 3 failures |
| 7 | **F** — remaining unused exports | ⛔ `PaginationControls`/`LoadMoreButton` are ON HOLD for ITEM J |
| 8 | **K.5** — "showing 20 of N" on the email tabs | |
| 9 | **I.1** — the `formatDate` timezone divergence | The one correctness edge in item I |
| 10 | **G.1** — drop `@tanstack/react-query` | ⛔ Zone-2 (rewrites the lockfile) |
| 11 | **H** — database leftovers | ⛔ Zone-2, one SQL approval each |
| 12 | **THE DEPLOY, then Step Z** | Owner's, and LAST |

**Needs no work:** ITEM C (dissolved) and **K.3 calendar** — the date window
already bounds it and a cap could drop rows from the print path.

**Blocked on an Owner decision:** F's `content/pages` (resolved — deleted),
G.5's remaining archives, H.2 (is authenticated encryption still on the
roadmap?), and whether the medical disclaimer should appear on `/home`,
`/about` and `/services` (it renders only on `/faqs-aftercare` and `/areas`).

---

## 8 — Standing facts (unchanged, restated so this file stands alone)

- **Tree is intentionally dirty**: `git status --porcelain -- src/ supabase/`
  must show exactly ` M src/lib/maintenance.ts` (working copy `false`, HEAD
  `true`). **Never `git add .`/`-A`; never stash/checkout to "clean" it.**
- **Zone-2** = migrations, data-mutating SQL, deploys, package installs, env
  changes, real emails. **Owner-approved per action, orchestrator-performed,
  never delegated.** `mcp__supabase__execute_sql` is SELECT-only, project
  `twzutkfgqclqurvkmvqz`.
- **⛔ Never send a real email.** `src/lib/email/client.ts` is an unguarded
  wrapper over the live Resend SDK and `RESEND_API_KEY` is populated.
- **Dev server is Owner-run** at `localhost:3000` (not `127.0.0.1`). Never spawn,
  restart or kill it.
- **Commit messages**: PowerShell here-strings strip double quotes — always
  `git commit -F <scratchpad file>`.
- **Teeth-check every guard** by mutating the source, running, restoring, and
  asserting byte-identity — and attribute the failure to the guard **by name**,
  or a different failing test will be mistaken for a pass (gotcha 44).
- **Do not rebuild the three contrast layers.** Layer 3's settle fix is done; do
  not re-do it.
- **Business reality that should govern effort**: 15 bookings, all Luton. 6
  therapists. Most of this plan is about the next 2-3 years, not today.

---

## 9 — Method that worked, and is worth repeating

**Compute the mapping; do not let an agent guess it.** Item 7's 119 substitutions
were driven by a script reusing the SHIPPED `parseTokensCss`/`resolveColour`,
with a pre-flight that asserted coverage, light byte-identity, role agreement and
Layer-2 exposure before a single file was written. Zero mis-substitutions.

**Let the critic finish, and critique the FINISHED diff.** Five critics against
the completed item-7 diff found three real dark-value defects and the print-block
misconception. Critics against a moving tree find only the moving tree.

**Sweep variant-by-variant, not page-by-page.** The page-by-page pass found five
issues. The variant pass found the command-palette asymmetry and the report-data
gap that turned out to be a live data exposure — neither reachable by walking
routes.

**When a hypothesis is disproved, say so and change the recommendation.** The
"Recent activity" panel was diagnosed as a bulk-write bug; reading
`saveAvailabilityDay` disproved it, which flipped the fix from "collapse events"
to "paginate" — the Owner's original instinct.

**A finding without a re-derived number is a rumour.** Every count in this
session that mattered was recomputed by hand before being acted on, and several
agent claims failed that check (§6).
