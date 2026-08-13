# HANDOFF — 2026-08-13 (seventh implementation session)

**Read this file first, end to end.** The seven earlier handoffs keep their
gotchas and are **not** superseded, except where §6 below says otherwise:

- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — gotchas 1-15
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — gotchas 16-27
- `HANDOFF-2026-08-12-IMPLEMENTATION-3.md` §5 — gotchas 28-41
- `HANDOFF-2026-08-12-IMPLEMENTATION-4.md` §5 — gotchas 42-53
- `HANDOFF-2026-08-12-IMPLEMENTATION-5.md` §5 — gotchas 54-66
- `HANDOFF-2026-08-13-IMPLEMENTATION-6.md` §5 — gotchas 67-79
  ⚠️ **its §1 and §7 are now stale — this file replaces both, and gotcha 78 is
  corrected by gotcha 80 below.**

This file adds **gotchas 80-89**. Nothing is mid-flight. No agent is running.
Every change is committed and pushed, and the push has deployed.

| | |
|---|---|
| **HEAD** | `ce050ce` on `master`, **pushed to origin** (0 unpushed), **deployed** |
| **Shipped** | **3 commits.** All three items the Owner approved are live |
| **Deployed** | ⛔ **THE SITE IS LIVE** at rahmatherapy.uk, in **maintenance mode**. Cloudflare auto-deploys on push to `master` |
| **HANDOFF-6 §7.1** | ✅ **CLOSED.** All three coverage gaps answered — two covered, one proved unclosable |
| **HANDOFF-6 §7.2** | ⏸️ **ANSWERED, DELIBERATELY NOT ACTED ON.** The cap stays at 125; its comment was the defect and is fixed. See §7 |
| **Next** | Owner's call. Nothing is queued — see §7 for the only things still open |

---

## 1 — ⛔ GATE BASELINES. ONE CHANGED. Use these, not any earlier file's.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2455 passed (2460)          <-- CHANGED (was 2447)
pnpm lint           # 4 errors / 1 warning in THREE files     (unchanged)
npx vitest run scripts/                        # 47 passed    (unchanged)
node scripts/measure-admin-contrast.mjs .      # 110 failures (46 dark / 64 light),
                                               #   209 unresolved, 153 tokens (unchanged)
node scripts/verify-admin-token-contrast.mjs   # 0            (unchanged)
git status --porcelain -- src/ supabase/       # exactly:  M src/lib/maintenance.ts
```

The suite grew by **13 tests across 2 new files** (236 → 238 files): `london.test.ts`
+1, `report-insights.test.ts` +2, `reports-data.test.ts` +3 (new),
`bookings-list-window.test.ts` +7 (new).

The **five** vitest failures are unchanged and unrelated to everything here:
`admin-access.test.ts` ×2 ("gives Owner broad access…", "gives Admin broad
operational access…"); `ManualBookingForm.test.tsx` ×3 ("renders step 1 on first
load", "moves focus to the first invalid field…", "shows the consent error…").
Isolate those two files before calling anything a regression.

Lint identity is the `{file, ruleId}` multiset: `BookingExperience.tsx`
{immutability ×1, set-state-in-effect ×2}, `BookingExperienceLoader.tsx`
{set-state-in-effect ×1}, `returning-customer.ts` {no-unused-vars ×1}.
**Never `file:line:column`.**

**Layer 1 did not move**, and should not have: no CSS or className changed this
session. Diff it as a multiset keyed on `theme|file|fg|bg|ratio`, never
positionally (gotcha 79).

**Layer 3 was not run.** It needs real credentials and a browser; no CSS changed.

---

## 2 — What shipped, in order

| # | Commit | What |
|---|---|---|
| 1 | `c70839f` | **refactor(bookings)** — the pager's branch choice gathered into `resolveBookingsWindow`, + 7 tests |
| 2 | `8c1c4c6` | **test(reports,time)** — the two guards that shipped unobserved, + 6 tests |
| 3 | `ce050ce` | **docs(bookings,search)** — the corrected URL ceiling behind both id caps. **Comments only** |

**Only commit 1 changes behaviour**, and it is identical by construction. Commit 3
was verified to have **zero non-comment diff lines** before it was made.

### What each one actually did

**`c70839f` — `src/app/admin/bookings/page.tsx`.** The choice between the two
windowing branches was spread across FOUR independent `canViewAll ? … : …`
ternaries: the rows, then `page`, `pageCount` and `total` on `PaginationBar`. Any
one could be flipped alone with every suite green. `resolveBookingsWindow` is that
decision once, exported (the file already exported four other pure helpers, so no
new class of risk to the route). `paginateInMemory` now no longer runs for
managers, where its result was computed and discarded — the only incidental
effect. New file `__tests__/bookings-list-window.test.ts`.

**`8c1c4c6` — reports + time.** New file
`src/app/admin/reports/__tests__/reports-data.test.ts` watches the ITEM N wiring
line. `report-insights.test.ts` gained a fixture that makes the per-staff
utilisation rule execute **for the first time in the repo's history**.
`london.test.ts` gained one test that observes the `Europe/London` pin.

**`ce050ce` — both id-cap comments.** `SCOPED_CANDIDATE_ID_CAP` (125) in
`bookings/bookings-list-data.ts` and `SCOPED_SEARCH_ASSIGNMENT_CAP` (100) in
`search-actions.ts`. **Neither value changed.**

---

## 3 — ⛔ OWNER DECISIONS. CLOSED. DO NOT RE-ASK ANY OF THESE.

Carried forward from HANDOFF-6 §3, all still closed, plus two new ones.

| Decision | Answer |
|---|---|
| Medical disclaimer on /home, /about, /services | ⛔ **Owner handles personally. Out of scope for agents. Never raise again** |
| Tracked design archives (`brand-logo-assets/`, `rahma-therapy-image-replacements/`) | **KEEP** |
| Authenticated encryption for password-reset tokens (H.2) | ⛔ **NOT on the roadmap.** `payload_nonce` STAYS. **Do not list it as dead schema** |
| `@tanstack/react-query` | Removed |
| Step Z | Run. Done |
| Hamburger appearing below 1280px | **Leave it.** Not a defect |
| Appearance at 25% browser zoom | **Leave it.** Measured: nothing overflows |
| ITEM E.1 `ui/` shadcn scaffolding | Deleted, regenerable via CLI |
| **Raising either id cap** | ⛔ **NEW — declined.** Both stay. See §7.1 |
| **Restructuring the therapist read** (`!inner` EXISTS embed) | ⛔ **NEW — declined as disproportionate.** Recorded, not queued. See §7.1 |

---

## 4 — ⛔ MEASURED PLATFORM FACTS. Do not re-derive these; do not trust the old numbers.

Everything here was measured on 2026-08-13 against the live instance or this host.
Two shipped comments and one gotcha were wrong, and the wrong numbers had already
sized two constants.

### 4.1 — The Supabase request-target ceiling is ~25 kB, and overflow is HTTP 400

Probed with real GETs against `twzutkfgqclqurvkmvqz` using the **public anon key**
(read-only; every request was rejected by RLS before returning a row).

| request target | result |
|---|---|
| 24,918 B (640 UUIDs + the shipped `BOOKING_SELECT`) | **accepted** — Postgres answered `42501 permission denied`, so the URL was fully parsed and planned |
| 25,473 B | **HTTP 400 `Bad Request`**, plain text, from the gateway |

Unauthenticated, a 32,000-character query string still returned a semantic 401
(`UNAUTHORIZED_MISSING_API_KEY`) — so the edge is not enforcing an 8 kB limit
either. The gateway identifies as `sb-gateway-version: 1` behind
`Server: cloudflare`. **It is not the nginx the old comments assumed.**

Capacity under that ceiling: **~605 ids** with `BOOKING_SELECT`, **~634 ids** with
the palette's smaller select.

The **byte arithmetic in both old comments was right** and reproduces exactly (37
characters per UUID; a worst-case model with every filter and embed gives 1,734 B
empty / 6,619 at 125 / 7,594 at 150 / 9,544 at 200, matching their stated
~1.75 / 6.6 / 7.6 / 9.5 kB). Only the limit it was compared against was wrong, by
about 3×.

⚠️ **Caveat recorded in the code too:** this was measured from a developer host.
Production reaches Supabase from a **Cloudflare Worker**, whose own outbound URL
limit is **NOT verified**. That is one of the reasons the headroom was not spent.

### 4.2 — The anon key validates PostgREST syntax for free

`42501` = PostgREST parsed and planned the query (it reached Postgres and was
refused on privileges). `PGRST1xx` = PostgREST rejected the shape itself. So any
PostgREST syntax question can be settled read-only, with no rows, no service-role
key and no seeding. This is how §4.3 was answered.

### 4.3 — HANDOFF-6 §7.2's three structural constraints ALL HOLD

| Claim | Probe result |
|---|---|
| PostgREST cannot order a parent by an embedded column | ✅ `PGRST118 — 'bookings' and 'booking_assignments' do not form a many-to-one or one-to-one relationship. A related order on 'booking_assignments' is not possible` |
| PostgREST cannot express `assigned ∪ claimable` in one request | ✅ **Both** shapes rejected: `PGRST100 failed to parse logic tree`. Top-level `or=(…)` cannot reference embedded/aliased columns at all — tried across two aliases and inside one |
| The aliased `!inner` filter-embed idiom works | ✅ `42501` — parses and plans |
| The schema permits two assignment rows per (booking, staff) pair | ✅ `booking_assignments` has **only** a PK on `id` and three FKs. **No unique constraint.** ITEM M's A2 dedup gate is warranted |

### 4.4 — Business reality, measured (⚠️ the brief's version was wrong)

```
bookings ................ 15      assignment rows ......... 10
  of which assigned ..... 3       bookable staff .......... 6 (of 12 profiles)
recurring templates ..... 0       bookings in a series .... 0
future-dated bookings ... 0       group bookings .......... 0
participants ............ 15      avg/booking ............. 1.00 (max 1)
booking_date range ...... 2026-05-12 → 2026-08-11 (all in the past)
created_at range ........ 2026-05-10 → 2026-07-27
```

**Cities are NOT "all Luton":** Luton 12, Houghton Regis 1, Bedford 1, Dunstable 1.
⚠️ **Bedford is not one of the six area pages** — worth an Owner conversation at
some point, not a defect.

**Busiest therapist holds 2 lifetime assignment rows** ("Phase10 THERAPIST A");
next is 1. The cap is 125. Runway to it, by volume:

| per-therapist volume | months to 125 |
|---|---|
| today's measured rate (0.13/week) | ~144 (≈12 years) |
| 1 session/week | 28.8 |
| 2 sessions/week | 14.4 |
| 5 sessions/week | 5.8 |

HANDOFF-6's "roughly 18 months at current volume" implies ~1.6 sessions/week/
therapist — well above today's rate. The honest statement is **6 months to 12
years depending entirely on growth**.

### 4.5 — Node timezones on this host

Node **v24.16.0**, Windows.

| | |
|---|---|
| `TZ=America/New_York node -e …` | ignored — still `Europe/London` |
| `process.env.TZ = "…"` assigned **at runtime** | ✅ **works**, retunes ICU |
| Same, inside vitest | ✅ works |
| Leak between test files | ❌ none — vitest's per-file isolation resets it (a file that set it without restoring left the next file at `Europe/London`, `env.TZ` undefined) |

---

## 5 — NEW GOTCHAS (80-89). Each cost real time.

80. **⛔ GOTCHA 78 IS ONLY HALF TRUE, AND THE HALF THAT IS FALSE HID A CLOSABLE
    GAP.** `TZ=x node` really is ignored on this Windows host — but
    `process.env.TZ = "x"` **assigned at runtime** retunes ICU correctly, on Node
    24, including under vitest. A whole "structurally unobservable" verdict rested
    on testing only the launch-time form. **Test the runtime form before declaring
    a timezone property unobservable.**

81. **⛔ SOME MUTANTS ARE EQUIVALENT AND CANNOT BE KILLED BY ANYONE.**
    `formatBusinessDateLong` parses at UTC **noon**; mutating that to midnight
    changes nothing, in any timezone, ever — because the `Europe/London` pin puts
    both on the same calendar date. Verified across 7 zones × 366 days: **zero
    disagreements.** A surviving mutant is not automatically a coverage gap. Prove
    it is observable before you budget to close it, and record the ones that are
    not — HANDOFF-6 §7.1.3 listed this one as work.

82. **⛔ A "MEASURED" CEILING IN A COMMENT MAY NEVER HAVE BEEN MEASURED.** Both id
    caps cited "a ~8 kB nginx request-line ceiling" and a 414. The real limit is
    ~25 kB and the failure is a 400 (§4.1). The **byte arithmetic beside it was
    correct**, which is exactly what made it credible. When a comment mixes a
    computed figure with an environmental limit, the computed half being right
    says nothing about the other half.

83. **⛔ A WRONG NUMBER IN A COMMENT PROPAGATES TO THE NEXT CONSTANT.** The same
    8 kB figure sized `SCOPED_CANDIDATE_ID_CAP` (125) **and**
    `SCOPED_SEARCH_ASSIGNMENT_CAP` (100), in different files, written at different
    times. One bad measurement, two constants. When you correct one, `grep` the
    repo for the reasoning, not just the number.

84. **⚠️ CORROBORATION CAN BE INVENTED.** The palette comment credited postgrest-js
    with an overflow warning naming `.in('id', [200+ IDs])` as the point to stop.
    **There is no such warning anywhere in the installed package.** It read as an
    independent second source for a figure that was already wrong. Check cited
    third-party warnings in `node_modules` before trusting them.

85. **⛔ TESTING BOTH HALVES OF A GUARD DOES NOT TEST THE GUARD.**
    `resolvableStaffFor` was covered in `reporting.test.ts`; the rule it defends
    was covered in `report-insights.test.ts`. **Deleting the line that joins them
    in `reports-data.ts` passed all 167 tests in that folder.** Coverage of the
    parts is not coverage of the composition. Mutate the WIRING, not just the
    pieces.

86. **⚠️ A "ONE-LINE" COVERAGE GAP MAY BE FOUR LINES.** HANDOFF-6 §7.1.1 named one
    wiring line in `page.tsx`. It was one of **four** sibling `canViewAll ? … : …`
    ternaries expressing the same decision — the rows plus three `PaginationBar`
    props. Count the expressions of a decision before sizing the fix; gathering
    them was what made it testable at all.

87. **⛔ A FIXTURE THAT SETS A COLLECTION TO `[]` SILENTLY DISABLES EVERY RULE THAT
    LOOPS IT.** `report-insights.test.ts` set `staff: []` in every fixture, so the
    per-staff utilisation rule had no body to execute and had **never run in the
    suite** — any bug in its arithmetic was invisible while coverage looked fine.
    An empty collection in a shared fixture is a silent feature switch.

88. **⚠️ PARTIAL-MOCK THE MODULE UNDER TEST, OR YOU ASSERT AGAINST YOUR OWN MOCK.**
    `reports-data.ts` imports both `getReportData` (needs stubbing) and
    `resolvableStaffFor` (**is the thing under test**) from `../reporting`. Mocking
    the module wholesale would have stubbed the guard. Use
    `vi.mock(path, async (importOriginal) => ({ ...(await importOriginal()), one: stub }))`.

89. **⚠️ AN ABSENCE ASSERTION NEEDS A CONTRAST CASE.** "A Therapist sees no
    colleague named" passes just as happily against a fixture that produces no
    insights at all. Every such spec needs its twin — a viewer who MAY see the
    roster still getting the insight — or it is a test that cannot fail for the
    right reason. Both new spec files carry one.

**Bonus, re-learned:** `node -e "…"` invoked through the Bash tool mangles regex
backslashes exactly the way `cat <<'EOF'` does. Author mutation scripts with the
**Write tool**, then run the file. Cost one failed command this session.

---

## 6 — Claims that FAILED verification this session

| Where | Claim | Truth |
|---|---|---|
| `bookings-list-data.ts` + `search-actions.ts` | "a ~8 kB nginx request-line ceiling", failure is a 414 | **Wrong.** ~25 kB; failure is HTTP 400; gateway is not nginx (§4.1). Both comments corrected in `ce050ce` |
| `search-actions.ts` | postgrest-js warns about `.in('id', [200+ IDs])` | **No such warning exists** in the installed package (gotcha 84) |
| `bookings-list-data.ts` | `BOOKING_SELECT` "is itself 1,283 characters" | **1,079** stripped (1,205 URL-encoded). Corrected |
| HANDOFF-6 gotcha 78 | timezone divergence is "structurally unobservable here" | **Half wrong.** Runtime `process.env.TZ` works (§4.5); one of the two mutants was closable in 8 lines |
| HANDOFF-6 §7.1.3 | two surviving mutants, both coverage gaps | **One is an equivalent mutant** — unkillable by anyone (gotcha 81) |
| HANDOFF-6 §7.2 / brief | "15 bookings, **all Luton**" | **Four cities:** Luton 12, Houghton Regis 1, Bedford 1, Dunstable 1 |
| HANDOFF-6 §7.2 | "the cap binds in roughly 18 months at current volume" | At the measured rate, **~12 years**. 18 months implies ~1.6 sessions/week/therapist (§4.4) |

**Claims that were re-tested and HELD:** all three of HANDOFF-6 §7.2's structural
PostgREST constraints (§4.3); the byte arithmetic in both cap comments; gotcha
78's literal claim about `TZ=x node`; the no-unique-constraint premise behind
ITEM M's A2 gate.

---

## 7 — ⛔ WHAT IS LEFT

**Nothing is queued.** Everything below is recorded as answered-and-declined or
as an option the Owner has already seen. Do not start any of it without being
asked.

### 7.1 — The therapist bookings cap (125) — ANSWERED, DECLINED

The Owner was given four options and chose **"correct the comment, change no
behaviour."** That shipped in `ce050ce`. The other three are recorded here so
they do not have to be re-derived, **not** as a queue:

- **Raise both caps** to a measured value (125 → ~300, palette 100 → ~300).
  ⚠️ `SCOPED_BRANCH_ROW_CAP` (200) would then become the binding limit and must
  move with them, and 300 fully-embedded booking rows is a heavy response to
  render 25. **Raise the two together or neither.** Declined for now.
- **Restructure** the assigned half to a `booking_assignments!inner` EXISTS embed,
  so the id array disappears and the parent can be `.order()`ed and `.range()`d in
  SQL. Solves the cap **and** ITEM M's A2. But §4.3 confirms the union still
  cannot be one request, and the chip counts read the whole merged set, so it is a
  rewrite of the branch **plus** `getVisibleViewCounts` — on the most
  permission-sensitive read in the admin. Declined as disproportionate.
- **A windowed history view / archive surface.** Bigger than the above.

⚠️ **Non-obvious fact worth keeping if this is ever revisited:** the views where
the cap actually bites (`assigned`, `completed` — both lifetime) are
**assigned-only**. The union is only needed by date-bounded views (`today`,
`upcoming`, `claimable`), where the row counts are inherently small. That
asymmetry is the seam a future fix would use.

### 7.2 — ITEM M's A2 — still open, still gated

Replace the command palette's id array with a `booking_assignments!inner` embed.
`performance-data.ts:145` already ships that shape (⚠️ **non-aliased** there —
which is fine only because that surface does not render the assignment array; a
non-aliased embed on `/admin/bookings` would truncate it and break the "1 of 2
therapists assigned" label — see `BookingCard.tsx`).

The gate is unchanged and now **confirmed warranted** by §4.3: the schema permits
two assignment rows per (booking, staff) pair, and `.in()` + `new Set` guarantees
one row per match outright, where the embed only inherits that from a sibling.
**Prove the dedup before trading one for the other.**

### 7.3 — Loose ends noticed, not acted on

- **Bedford** has a booking but no area page (§4.4). Owner conversation, not a defect.
- `bookings-page-param.test.tsx:213` has a comment saying the therapist-scoped
  branch "always reports one page". Still literally true of
  `getBookingsListPage`, but easy to misread now that `resolveBookingsWindow`
  exists. Not touched — surgical scope.

---

## 8 — Standing facts (restated so this file stands alone)

- ⛔ **THE SITE IS LIVE.** Pushing to `master` **auto-deploys** via Cloudflare's
  GitHub integration. There is no CI and no staging. A push is a production
  release. Deploys take ~3-4 minutes.
- ⛔ **MAINTENANCE MODE IS ON.** `src/lib/maintenance.ts` — working copy `false`,
  **HEAD `true`**, deliberately uncommitted. **Never stage or commit this file.**
  Committing the working copy would OPEN LIVE BOOKINGS. Only the Owner decides
  when that flips. **Verify the flag in each COMMITTED TREE before pushing**
  (`git show <sha>:src/lib/maintenance.ts`), not just in the working copy.
- **Tree is intentionally dirty**: `git status --porcelain -- src/ supabase/`
  must show exactly ` M src/lib/maintenance.ts`. **Never `git add .`/`-A`/`-u`.**
  Stage by explicit path, every time (gotcha 70).
- **Zone-2** = migrations, data-mutating SQL, deploys, package installs, env
  changes, real emails. **Owner-approved per action, orchestrator-performed,
  never delegated.** Present exact SQL in chat and STOP.
  `mcp__supabase__execute_sql` is SELECT-only; use `apply_migration` for DDL and
  **commit a matching file** to `supabase/migrations/`.
- **⛔ Never send a real email.** `src/lib/email/client.ts` wraps the live Resend
  SDK and `RESEND_API_KEY` is populated.
- **Dev server is Owner-run** at `localhost:3000` (not `127.0.0.1`). Never spawn,
  restart or kill it. A plain `curl` against it is a fine smoke test.
- **Commit messages**: PowerShell here-strings strip double quotes — always
  `git commit -F <scratchpad file>`.
- **Teeth-check every guard by mutating the source**, asserting the anchor occurs
  exactly once **in the file's own EOL form** (this repo is mixed CRLF/LF),
  running, restoring, and confirming byte-identity — and attribute the failure to
  the guard **BY NAME**.
- **E2E credentials exist** in `.env` for OWNER, ADMIN, COORDINATOR, REPORTING,
  THERAPIST_A, THERAPIST_B, INACTIVE, NON_STAFF. Playwright skips unless
  `E2E_BASE_URL` is set. ⚠️ E2E is **excluded from `npx vitest run`**, so an e2e
  test does not appear in any gate.
- **Business reality that should govern effort**: 15 bookings, 6 bookable
  therapists, busiest holds 2 assignment rows. Most of this work is about the next
  2-3 years, not today. **The Owner has explicitly said not to over-engineer.**

---

## 9 — Method that worked, and is worth repeating

**Measure the platform, not the comment.** Every number in §4 replaced a written
claim, and two of them had already sized shipped constants. One `curl` loop with
the public anon key settled a ceiling that two files had been sized against for
weeks.

**Use the cheapest oracle that actually discriminates.** The anon key turns
PostgREST into a free syntax validator (§4.2): `42501` means accepted, `PGRST1xx`
means rejected. No rows, no service-role key, no seeded data, no Zone-2.

**Probe before you plan.** Both closable coverage gaps were prototyped as
throwaway test files, run, and deleted before a single recommendation was written
— so "this costs ~35 lines and works" was a measurement, not an estimate. The
tree was verified back to ` M src/lib/maintenance.ts` after each.

**Mutate the wiring, and report what the mutant killed.** Four mutants this
session, each restored byte-identically: the London pin (1 test), the ITEM N guard
(1 test — **0 of 167 before**), and the window decision forced each way (4 and 3).
A guard nobody mutated is a guard nobody has tested.

**Say when a gap cannot be closed.** The noon-vs-midnight mutant is recorded in
`london.test.ts` as provably equivalent rather than carried forward as debt. An
honest "unclosable, here is the proof" is worth more than a ticket that will be
re-opened every session.

**Separate the risky line from the safe ones.** Three commits: one behaviour
change, one test-only, one comment-only — with the comment-only commit's staged
diff checked for non-comment lines before it was made. If production had moved,
there would have been exactly one commit to look at.
