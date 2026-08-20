# HANDOFF — 2026-08-20 (thirteenth session · PRODUCTION-READINESS FIXES, ROUNDS 1–3)

**⛔ THIS IS THE LIVE DOCUMENT. Read it end to end before touching anything.**
It replaces `HANDOFF-2026-08-19-IMPLEMENTATION-11.md`, whose **§1 position, §3 baselines and §7 open
items are now stale by 21 commits**. Everything else in `-11` still stands, including its gotchas
119–127. The twelve earlier handoffs keep gotchas 1–118 and are **not** superseded.

**This file adds gotchas 128–139 (§6).**

---

## 1 — ⛔ POSITION

```
HEAD           953d7df   on master
origin/master  0f8ab9d
UNPUSHED       41 commits
tracked files  2020
working tree   CLEAN
```

⛔ **Compute it, never trust it:** `git rev-list --count origin/master..HEAD`

✅ **The working tree is fully clean.** The `@vitest/coverage-v8` devDependency that sat uncommitted
across several sessions was landed in `ccd141a` on the Owner's instruction, together with the
`verify:migrations` script entry.

### 1.1 — ⛔⛔ THE MOST IMPORTANT FACT, UNCHANGED ACROSS FOUR SESSIONS

**The first unpushed commit is `3eb2939` — Phase 12, which removes the maintenance system. A bare
`git push` OPENS LIVE BOOKINGS.** Every later commit descends from it, so nothing ships without it.
Never push without a fresh, explicit Owner instruction, and say out loud what a push would do before
proposing one.

### 1.2 — ⛔ THE DATABASE IS FURTHER AHEAD OF `origin/master` THAN EVER

`-11` recorded two applied-but-unpushed migrations. It is now **eight**, and the gap is wider:

```
migration files at origin/master :  66
migration files at HEAD          :  80
migrations applied in production :  80
```

⛔ **All eight of these are LIVE in the database and their files exist only in unpushed commits:**

| Version | What it did |
|---|---|
| `20260819072517` | f10 — restore series-fn grants |
| `20260819072756` | f1/f2 — booking capacity + window |
| `20260819134224` | BST future-check fix |
| `20260819150206` | buffer midnight-wrap fix |
| `20260819233514` | **a completed booking no longer blocks its slot** |
| `20260820001554` | **service_role DML on `staff_permission_overrides`** |
| `20260820001617` | **narrowed the `public` default ACL** |
| `20260820075446` | **rebuild self-check** |

This is deliberate and Owner-approved. It also means **`origin/master` could not rebuild the current
database** — only `HEAD` can.

---

## 2 — ⛔ ABSOLUTE RULES

1. ⛔ **THE SITE IS LIVE.** Push to `master` auto-deploys via Cloudflare (~3 min). No CI, no staging.
2. ⛔ **`git push` right now opens live bookings.**
3. ⛔ **Every DB write needs the Owner's explicit per-action approval.** Writing a migration *file*
   is fine; applying it is not.
4. ⛔ **Do NOT submit the sitemap in Search Console** until Phase 12 is deployed.
5. ⛔ **C2 — the Owner's visible page copy must not be reworded.**
6. ⛔ **C3 — every absolute site URL must come from `SITE_URL`/`siteUrl()`.** ⚠️
   `canonical-domain.test.ts` scans **test files and comments too** — gotchas 92 and 127.
7. ⛔ **Never round-trip a repo file through PowerShell `Get-Content`/`Set-Content`** — destroys
   UTF-8. **And see gotcha 134: bash `python -c "…"` with backticks is just as destructive.**
8. ⛔ **Never `git checkout --` to undo a mutation** while uncommitted work sits in the same file.
9. ⛔ **NEVER propose a second Supabase project, a new database, PGlite, Docker, or a rebuild
   rehearsal** (D-014, §4.1). This was deferred twice and raised twice anyway. Do not do it again.
10. ⛔ **Do not "fix" the 4 lint errors.** They are the baseline.

---

## 3 — ⛔ GATE BASELINES — all measured at `953d7df`, 2026-08-20

```
npx tsc --noEmit                              0 errors
npx vitest run                                247 files / 2559 tests / 0 failed
npx vitest run scripts/                       68 passed
npx eslint src scripts                        4 errors / 1 warning, THREE files
pnpm verify:migrations                        142 checked / 38 implicit / 0 missing
pnpm test:security:secrets                    passes, 13 keys checked
node scripts/verify-system-integrity.mjs      PASS (exit 0)
node scripts/measure-admin-contrast.mjs       110 total (46 dark / 64 light)
node scripts/verify-admin-token-contrast.mjs  0 failures
git status --porcelain                        EMPTY
npx next build                                SUCCEEDS (exit 0)
```

⚠️ **The test totals moved on 2026-08-20 and that is expected.** 245→247 files and 2523→2559 tests
is exactly Round 3's five guards (`953d7df`); scripts 47→68 is the scanner's first test. A LOWER
number than these is a regression.

⛔ **CHECK THE TEST COUNT, NOT THE COLOUR.** A green exit with a LOWER count is a real, observed,
silent failure mode here (gotcha 118).

⚠️ **`npx eslint` with no path argument now reports 13 errors, not 4.** The extra nine are inside
`.production-readiness/` — gate 02's coverage artefacts, which are gitignored but still walked.
**Scope the command to `src scripts`** or you will chase a regression that is not there.

### 3.1 — `npx next build`

Run at `008e938` on 2026-08-20: **succeeds, exit 0**, all routes prerendered as expected. Not
re-run at `953d7df` — Round 3 added only test files, which `next build` does not compile. Re-run it
before any release verdict rather than trusting that reasoning. ⛔ `pnpm
cf:build` remains **deferred and closed** (D-012) — it cannot run on this host, and the site is
built by Cloudflare's own Linux builders, where OpenNext packaging is proven because the site is
live.

---

## 4 — ⛔ OWNER DECISIONS. Do not re-ask, do not re-litigate.

### 4.1 — Made this session (2026-08-19 / 20)

- ⛔ **D-014 — NO second Supabase project, NO new database, NO rebuild rehearsal. Ever.** Verbatim:
  *"why the fuck is this issue of a backup or second supabase keep coming up? i thought i deffered
  this … so long as we can just recreate the exact database system using the migeration files … then
  no need to create a fucking second database, i dont want to keep repeating myself!!"*
  It had already been deferred under D-013 and was raised twice more. **Do not propose it in any
  form, including "it is free".**
- ✅ **The `auth.users` gap is NOT a concern.** *"all current existing users are pure test ones"*.
  Migrations do not restore the 13 accounts; `scripts/bootstrap-owner-admin.mjs` is the answer. Do
  not raise it as a backup hole again.
- ✅ **A completed booking must NOT block its time slot** — settled, and now fixed in the database.
- ✅ **The 95 permission grants are intended.** *"whatever is present on my site now is my doing"*.

### 4.2 — ⛔ HOW THE OWNER WANTS TO BE COMMUNICATED WITH

Unchanged from `-11` §4.2 and still the thing most likely to go wrong:

- ⛔ **Lead with the answer.** Plain language, short sentences, answer first, evidence second.
- **Categorise**: what's done / what's open / what needs them.
- ⛔ **Do not surface irrelevant information.**
- **Long tables belong in a document, not a chat reply.**
- ⚠️ **New this session:** the Owner lost track of which prompt was being followed after several
  turns of deep work. **Say which task you are on when you resume, and stop when the stated task
  ends** rather than rolling into the next one.

### 4.3 — Carried forward, still binding

GDPR compliance **out of scope, Owner-owned** (D-009) · password/MFA/captcha/brute-force **deferred,
Owner-owned** · `pnpm cf:build` **closed** (D-012) · Supabase branching **unavailable, Free plan**
(D-013) · email is **deliberately LIVE** to `thefoolmarketing@outlook.com`, namespace is the
`ZZTEST-` **name** · client **`Badar`** (`4978ae6d-79d0-4119-a8c0-fd374e8dc75d`) is the one real
record and must never be touched.

---

## 5 — WHAT HAPPENED THIS SESSION

The Owner asked for a **verify-then-plan** pass over 8 issues found by an earlier assessment, then
approved fixing them in rounds.

### 5.1 — Every issue verified independently first

All 8 were reproduced rather than trusted. Notably, **seven claimed-untested guards were confirmed
as placebos in one run**: deleting the health-notes redaction call, `beforeSendTransaction` on all
three Sentry configs, the `FREE_TEXT_MAX` server cap, the middleware inactive-staff redirect and a
permission-list member left **2523/2523 passing and `tsc` clean**.

⛔ **Two of the assessment's own framings were wrong and were corrected:**
- The Sentry token leak **was already fixed** on 2026-08-17 (`58c22ad`, F9). Only the *test* is
  missing.
- The free-text cap did not *fix* a defect — it **caused** one. `8a90dc3` fixed it with `maxLength`
  on the textareas **and shipped a mutation-tested 4-test file**. Only the server bound is unguarded,
  which is low value.

### 5.2 — Round 1: three fixes applied to production

| Commit | What |
|---|---|
| `8662a1e` | **A completed booking no longer blocks its slot.** Two busy-checks disagreed; the named-therapist path counted `completed` as busy while the unassigned path and `availability.ts:596` did not — so the public calendar OFFERED a slot the RPC then refused. |
| `2e1e70b` | **Permission overrides can save** (42501 before, SUCCEEDED after) **and the `public` default ACL is narrowed** — `anon` TRUNCATE/REFERENCES/TRIGGER/MAINTAIN went 10→0 on every table. |

Every change was measured before and after, with a **control arm** each time, and
`verify-system-integrity.mjs` diffed empty either side.

### 5.3 — Round 2: the rebuild path (`008e938`)

- **`20260820075446_rebuild_self_check.sql`** — the last migration now asserts the end state and
  **raises** if replaying the files does not reproduce it. The rebuild proves itself when it runs.
  Non-vacuity proven by deliberately breaking an expectation and confirming it raises.
- **`scripts/verify-migration-coverage.mjs`** + `scripts/expected-db-objects.json` — offline gate,
  142 names checked, 0 missing.
- ⛔ **A planned mass-rename of 48 migration files was measured and ABANDONED.** See
  `README-MIGRATION-DRIFT.md` §8: 162 tracked files would have started pointing at filenames that no
  longer exist, to buy protection for a CLI this host does not have. §4 rule 3 stands.

### 5.4 — Round 3: five guards that nothing was holding (`953d7df`)

Gate 02 proved seven “protections” were placebos. Five now fail loudly, **each mutation-verified** —
apply the deletion, confirm the suite goes RED naming the right test, restore, confirm green:

| Guard | Mutation result |
|---|---|
| Health-notes redaction at the **call site** (3 cases) | 1 failed / 16 passed |
| Package prices — 25 literals, not 5 | nested change **and** a price SWAP both caught |
| Permission lists — 5 helpers, 14 members, one table | removing a member caught |
| Browser-secret scanner + its first ever test | 2 mutations caught (6 failed, then 2 failed) |
| Sentry `beforeSendTransaction` on all three runtimes | 7 failed across both files |

⛔ **Removing the scanner's blanket `NEXT_PUBLIC_` exemption surfaced a real case** and briefly turned
that gate red: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is in the bundles and matches via `API_KEY`. It is
genuinely publishable — Maps browser keys cannot work otherwise — so it is allow-listed **with its
reason**. ⚠️ Its safety rests on HTTP-referrer restrictions being configured in Google Cloud, which
no scanner here can verify.

**Deliberately not covered:** the free-text server bound. Its dangerous half — the silent dead-end on
the booking form — is already guarded and mutation-tested by `free-text-caps.test.tsx` (`8a90dc3`).
Only the server `.max()` remains, behind a 256 KB body cap.

---

## 6 — NEW GOTCHAS (128–139)

128. **⛔ TEST WHAT YOU WROTE, NOT A NARROWER VERSION.** A rolled-back probe revoked only `TRUNCATE`
     while the migration being validated revoked `truncate, references, trigger`. The probe passed and
     proved nothing about two thirds of the change. **Diff your probe against your artefact.**

129. **⛔ A BLANKET DEFAULT SILENTLY VOIDS DELIBERATE PER-TABLE GRANTS.** A draft added
     `alter default privileges … grant select,insert,update,delete on tables to service_role`. This
     repo grants **per table on purpose** — `20260804182200_c18_consent_events.sql:34-36` says so
     explicitly, and nine tables carry deliberately partial grants. The default would have made every
     future table full-CRUD, turning those restrictions into decoration, and **no gate checks ACLs**.
     Adversarial review caught it; it was dropped.

130. **✅ RE-TRANSMITTING A KNOWN-GOOD FILE BEATS PATCHING A LIVE OBJECT.** The three previous booking
     fixes were applied as md5-guarded string patches, each widening the repo-vs-live gap recorded in
     `README-MIGRATION-DRIFT` §6. The completed-booking fix sent the **whole file** instead, after
     proving the base equivalent first — and repo body and `prosrc` are now **byte-identical**
     (`f8ab98920eb54618c121229c67d742e3`). It collapses drift instead of adding to it.

131. **⛔ `alter default privileges for role supabase_admin` FAILS with 42501** on Supabase — that
     role is theirs, not yours. Its `public` default still grants `anon` `arwdDxtm` but governs
     **zero** tables (all 30 are `postgres`-owned). Residual risk, not fixable from here.

132. **⛔ `revoke all on <table> from anon, authenticated` TAKES THE SITE DOWN.** Measured: `anon`
     SELECT on `services` 1→0 and `authenticated` SELECT 24→0. Revoke the four named privileges
     (`truncate, references, trigger, maintain`) — never `all`.

133. **⛔ A PROPOSED TEST CAN ITSELF BE WRONG.** A price-parity test drafted in the plan compared a
     de-duplicated Set against `CANONICAL`, which contains `40` twice — it would have failed on
     correct data and looked like a real defect. **Dry-run a test's logic against known-good data
     before shipping it as a fix.**

134. **⛔ BACKTICKS IN BASH `python -c "…"` TRIGGER COMMAND SUBSTITUTION** and silently delete the
     content between them. This corrupted a memory file and a plan file in one session — the writes
     "succeeded" and the text was simply gone. **Use the Write tool for any content containing
     backticks**, same rule as the PowerShell UTF-8 one.

135. **⛔ `supabase/tests/10-capacity.sql` IS 170 LINES OF PURE COMMENT.** There is no executable SQL
     in it. It records hand-run measurements; nothing re-runs them. "C2 is closed by tests" is
     weaker than it sounds — re-running is a manual job.

137. **⛔ `git checkout --` WIPED UNCOMMITTED WORK, AGAIN.** It was used to undo a mutation in
     `scan-browser-secrets.mjs` while new, uncommitted changes sat in the **same file**. Everything
     went. This is already rule 8 in §2 and it still happened, because undoing a mutation *feels*
     like a different act from discarding work. **Copy the file to the scratchpad first and restore
     from that copy** — that is what every later mutation in Round 3 did.

138. **⛔ VITE CANNOT STRIP A CRLF SHEBANG.** Importing a `.mjs` whose `#!/usr/bin/env node` ends in
     `\r\n` fails with `Invalid Character !` — rolldown hoists the node: import shim onto the same
     line. `measure-admin-contrast.mjs` works only because its shebang happens to end in `\n`. With
     `core.autocrlf=true` and no `.gitattributes`, writing LF is not durable: the next checkout
     converts it back. **Drop the shebang** if the file is invoked as `node scripts/…` — which every
     script here is.

139. **⚠️ REMOVING A BLANKET EXEMPTION SURFACES REAL CASES. BUDGET FOR IT.** Narrowing the secret
     scanner immediately turned a green gate red on a key that was genuinely publishable. That is the
     exemption doing its job in reverse — it had been hiding everything, correct and incorrect alike.
     Expect the first run after any such change to fail, and resolve each case **on its merits with a
     written reason**, never by widening the exemption again.

136. **⛔ MEASURE BLAST RADIUS BEFORE A MASS RENAME.** Renaming 48 migration files to match the
     ledger looked like tidy-up. Measured: **162 tracked files** reference the old names, 5 of them
     in `src/`. The benefit needed a CLI this host does not have. Abandoned.

---

## 7 — ⛔ OPEN ITEMS

### 7.1 — ✅ ROUND 3 IS DONE (`953d7df`). Nothing outstanding here.

All five guards landed and are mutation-verified — see §5.4. The list below is kept only so the
reasoning behind each is findable; **do not redo them.**

<details>
<summary>What they were</summary>


Live plan: `.production-readiness/runs/2026-08-18_baseline/00-control/FIX-PLAN-2026-08-19.md`.

1. **Health-notes call-site tests** — the highest-value one. The guard at
   `booking-detail-data.ts:493` is deletable in silence and there is **no database backstop**
   (`client_notes` grants `authenticated` no SELECT, so its one RLS policy can never fire).
   ⚠️ Also mutation-test `/admin/clients/[clientId]`, which computes the same permission and was
   never checked.
2. **Price parity** — 20 of 25 prices unchecked. Use the corrected `href`→`slug` version in the plan,
   not the buggy Set comparison (gotcha 133). **No price is wrong today** — verified.
3. **Permission-list table test** — 5 helpers, 14 members, any deletable in silence. One
   table-driven test covers all 14.
4. **Secret-scanner pattern** — add `PASSWORD|CREDENTIAL`, and make "looks like a secret" beat the
   `NEXT_PUBLIC_` exemption. That prefix is the one Next.js actually inlines.
5. **Sentry transaction test** — optional; the fix already works.
6. **Free-text server bound** — optional; skip without regret.

⛔ **Every test must be validated by re-applying its mutation and confirming it goes RED.**

</details>

### 7.2 — Needs the Owner

- ✅ ~~Wiring `verify:migrations` into `package.json`~~ — **DONE** in `ccd141a`, together with the
  `@vitest/coverage-v8` devDependency, on the Owner's explicit instruction.
- ⛔ **Whether to push. 41 commits. See §1.1 — this is the only thing still waiting on a decision,
  and it is the one with real consequences.**

### 7.3 — Not done, deliberately

- The 48-file migration rename (§5.3, gotcha 136).
- The middleware inactive-staff redirect test — three tested layers already deny inactive staff
  (`admin-access.test.ts:166`, `rbac-client-permissions.test.ts:35`). It is a redirect, not a gate.
- The free-text server bound (§5.4).
- `/admin/clients/[clientId]` health-note mutation testing — it computes the same permission as the
  booking page and has **never** been mutation-tested. Round 3 covered the booking surface only.
  ⚠️ This is the one genuinely unfinished thread from the fix plan.
- Any rebuild rehearsal (D-014).

---

## 8 — Standing facts

- Supabase project `twzutkfgqclqurvkmvqz`, eu-west-1, PG 17, **Free plan**.
- Scale: ~15 bookings, 15 clients, 12 staff, 13 auth users, 5 roles, 40 permissions, 95
  role_permissions, 5 services. **Do not over-engineer.**
- ✅ **The technique that makes DB testing safe:** run SQL against production inside
  `begin … rollback`, with `set local request.jwt.claims = '{"role":"service_role"}'` to impersonate
  the caller. Verified repeatedly. Always use `ZZTEST-` names.
- Read-only DB baseline: `.production-readiness/runs/2026-08-18_baseline/00-control/db-baseline/`,
  copied outside the repo at `C:\Users\mamdo\Desktop\rahma-db-baseline-2026-08-19`. ⛔ That folder is
  gitignored. Re-take it before any gate that writes to production.
- **Host limits (measured, not findings):** no WSL, no Docker, no `psql`/`pg_dump`, **no Supabase
  CLI**, and `node` cannot create symlinks.
