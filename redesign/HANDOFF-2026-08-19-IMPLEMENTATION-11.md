# HANDOFF — 2026-08-19 (twelfth session · PRODUCTION DEFECT REMEDIATION)

> ## ⛔ SUPERSEDED 2026-08-20 — THIS IS NO LONGER THE LIVE DOCUMENT
>
> **Read `HANDOFF-2026-08-20-IMPLEMENTATION-12.md` instead.**
>
> This file's **§1 position, §3 gate baselines and §7 open items are stale by 21 commits.** Do not
> act on them. Specifically, everything below that says:
>
> | says | actually |
> |---|---|
> | `HEAD e7ecdb5` | `HEAD 008e938` |
> | `UNPUSHED 19 commits` | **38 commits** |
> | `2514 tests / 244 files` | **2523 tests / 245 files** |
> | `tracked files 1996` | **2017** |
> | "two migrations applied to production" | **eight**, and `origin/master` holds 66 migration files against production's 80 |
> | §7.1 "next task: further decluttering" | **withdrawn** — the Owner moved to production-readiness fixes instead |
>
> ⛔ **What is still valid here:** §2 absolute rules, §4 Owner decisions, §6 gotchas 119–127, and
> §8 standing facts. Those are carried forward, not replaced. Gotchas 1–118 in the eleven earlier
> handoffs are likewise untouched.

**⛔ THIS WAS THE LIVE DOCUMENT AT THE TIME OF WRITING.**
It replaces `HANDOFF-2026-08-17-IMPLEMENTATION-10.md`, whose §1 position and §7 open items are
stale. Everything else in `-10` still stands, including its gotchas 109-118. The eleven earlier
handoffs keep gotchas 1-108 and are **not** superseded.

**This file adds gotchas 119-127 (§6).**

---

## 1 — ⛔ POSITION

```
HEAD           e7ecdb5   on master
origin/master  0f8ab9d
UNPUSHED       19 commits
working tree   CLEAN
tracked files  1996
```

⛔ **Compute it, never trust it:** `git rev-list --count origin/master..HEAD`

### 1.1 — ⛔⛔ THE MOST IMPORTANT FACT, UNCHANGED ACROSS THREE SESSIONS

**The first unpushed commit is `3eb2939` — Phase 12, which removes the maintenance system. A bare
`git push` OPENS LIVE BOOKINGS.** Every later commit descends from it, so nothing ships without it.
Never push without a fresh, explicit Owner instruction, and say out loud what a push would do
before proposing one.

Production still serves the maintenance banner, bookings are CLOSED there, and screen readers still
hear "Map of Dunstable, Luton". All fixed locally, all blocked behind Phase 12.

### 1.2 — ⛔ NEW THIS SESSION: THE DATABASE IS NO LONGER IN SYNC WITH origin/master

**Two migrations were applied to PRODUCTION on 2026-08-19, with the Owner's explicit approval.**

| Version | Name |
|---|---|
| `20260819072517` | `f10_restore_series_fn_grants` |
| `20260819072756` | `f1_f2_booking_capacity_and_window` |

⛔ **The live database now contains changes whose code is unpushed.** That is safe today only
because the maintenance banner keeps the public booking form closed. The RPC changes affect booking
creation, which nobody can reach from production yet.

---

## 2 — ⛔ ABSOLUTE RULES

1. ⛔ **THE SITE IS LIVE.** Push to `master` auto-deploys via Cloudflare (~3 min). No CI, no staging.
2. ⛔ **`git push` right now opens live bookings.**
3. ⛔ **Every DB write needs the Owner's explicit per-action approval** (`AGENTS.md`). Writing a
   migration *file* is fine; applying it is not.
4. ⛔ **Do NOT submit the sitemap in Search Console** until Phase 12 is deployed.
5. ⛔ **C2 — the Owner's visible page copy must not be reworded.**
6. ⛔ **C3 — every absolute site URL must come from `SITE_URL`/`siteUrl()`.** ⚠️ `canonical-domain.test.ts`
   scans **test files and comments too** — this bit twice, gotchas 92 and 127.
7. ⛔ **Never round-trip a repo file through PowerShell `Get-Content`/`Set-Content`** — destroys UTF-8.
8. ⛔ **Never `git checkout --` to undo a mutation** while uncommitted work sits in the same file.

---

## 3 — ⛔ GATE BASELINES (green at `e7ecdb5`)

```powershell
npx tsc --noEmit                              # 0
npx vitest run                                # 0 failed / 2514 passed, 244 files
                                              # ⛔ CHECK THE COUNT — gotcha 118
pnpm lint                                     # 4 errors / 1 warning, THREE files
npx vitest run scripts/                       # 47 passed
node scripts/measure-admin-contrast.mjs .     # 110 (46 dark / 64 light)
node scripts/verify-admin-token-contrast.mjs  # 0
git status --porcelain -- src/ supabase/      # EMPTY
pnpm build                                    # succeeds
```

⚠️ **The vitest baseline moved from 242/2501 to 244/2514** — three new guard files added this
session, nothing removed. The lint 4E/1W in `BookingExperience{,Loader}.tsx` and
`returning-customer.ts` remain **the baseline; do not "fix" them.**

**Citation gates** (both are tracked scripts at the repo root):
```bash
bash extract-doc-citations.sh | awk -F'\t' 'NR>1 && $4=="DANGLING"'   # code→doc, baseline 1
bash extract-doc-doc-citations.sh                                     # doc→doc, baseline ~429
```
Both pass on a **set difference** against a captured baseline, never on zero.

---

## 4 — ⛔ OWNER DECISIONS. Do not re-ask, do not re-litigate.

### 4.1 — Made 2026-08-17 / 19

| Decision | Ruling |
|---|---|
| ⛔ **The two credential files** | **"Forget about the passwords, they are just test ones." CLOSED.** `docs/users-credentials` and `redesign/test-credentials.md` hold plaintext passwords beside the real business mailbox in a **public** GitHub repo. The Owner has ruled. ✅ Independently verified: every `SERVICE_ROLE_KEY`/`API_KEY`/`ANON_KEY` in the tree is a **placeholder**; no Supabase key is exposed |
| **Declutter scope** | Docs, artifacts, assets only. `src/`, dependencies, `public/`, `.claude/` were out of scope |
| **C-21 screenshots** | **Delete** — overruled the audit's keep recommendation. Done, irreversible |
| **Screenshot archives + Playwright data** | **Delete** — "the final site is built, they have no value". 1,020 files |
| **Logs and test artifacts** | ⛔ **KEEP** |
| **`photos-rahma-therapy/`** | **Move out of the repo**, not delete. All 52 files |
| **73-file reorganisation** | Offered, **not recommended, not executed** |
| **The 11 verified defects** | **Fix all of them** |
| **F4 (staff invitation)** | Recommended option B taken — make the screen honest. Making the invitation real is still open |
| **F6 (prices)** | Recommended option B taken — parity test, not a refactor |
| ⛔ **The two migrations** | **APPROVED and APPLIED to production 2026-08-19** |

### 4.2 — ⛔ HOW THE OWNER WANTS TO BE COMMUNICATED WITH

This was stated forcefully. **Take it seriously.**

- ⛔ **Lead with the answer.** The Owner replied *"whats your fucking answer to my questions then? you just spewed a lot of bullshit but i never understood"* to a technically correct but dense reply. **Plain language, short sentences, answer first, evidence second.**
- **Categorise**: what's done / what's open / what needs them.
- ⛔ **Do not surface irrelevant information.** A system notice about unrelated MCP connectors was relayed unprompted; the Owner objected — *"i never asked anything for that anyways."* An instruction to surface something is not an instruction to surface it regardless of relevance.
- **Long tables belong in a document, not a chat reply.**

### 4.3 — Carried forward, still binding

`Review` objects + `aggregateRating` ⛔ dropped · area link footer-only · `llms.txt` ⛔ never ·
`knowsLanguage` ⛔ **closed permanently** · tracked design archives KEEP (`CLEANUP-AND-CONTRAST-plan.md`
§G.5 names `brand-logo-assets/` and `rahma-therapy-image-replacements/` specifically).

---

## 5 — WHAT HAPPENED THIS SESSION

**19 unpushed commits.** Three phases.

### 5.1 — Workspace declutter (already DONE — do not redo)

Nine agents inventoried; four adversarial reviews attacked the findings.

| | Before | After |
|---|---:|---:|
| Tracked files | 2,996 | **1,988** (now 1,996 after new files) |
| `redesign/` | 215 MB / 1,819 files | **55 MB / ~810 files** |
| Disk freed | — | **~8.65 GB** |

⛔ **The headline finding, and it is counter-intuitive: the tracked archive was NOT dead weight.**
Of 46 proposed document deletions, **44 were refuted**. Only 3 tracked documents were safe to
remove. The real clutter was never in git — 8.4 GB of it was `.next`.

**Backups exist and should not be deleted:** `~/Desktop/rahma-git-backup-2026-08-17` (verified
all-refs bundle + raw `.git` copy) and `~/Desktop/rahma-archive-2026-08-17` (80 moved files).

### 5.2 — Production-readiness baseline

`redesign/PRODUCTION-READINESS-BASELINE-2026-08-17.md`. ⛔ **Two gaps nobody had recorded:**
**no coverage measurement of any kind exists**, and **8 of 11 public component directories have zero
tests**. §3.1 documents why `pnpm test:e2e` runs nothing and reports success.

### 5.3 — Eleven verified defects, fixed, then reviewed, then corrected

Another agent supplied suspected issues. **Every one was verified against the code before being
accepted** — 3 were refuted and 2 overstated (`redesign/plans/PRODUCTION-FIXES-2026-08-17-plan.md`
§14 records them so nobody re-raises them).

The fixes were then independently reviewed, which found **13 further defects, two of which meant
the original fix did not work at all**. Both rounds are in the plan and in commits `58c22ad` and
`5aab8d6`.

---

## 6 — NEW GOTCHAS (119-127)

119. **⛔ A CLIENT-ONLY SCHEMA IS NOT A VALIDATION BOUNDARY.** F5 capped
     `features/booking/schemas/booking-schema.ts`. That file is imported by **no server module** —
     `api/bookings/route.ts` defines its **own** schema. The caps landed on the file nobody
     validates a POST against, leaving the only reachable surface unbounded. **Before "adding
     validation", grep who imports the schema you are editing.**

120. **⛔ READ WHAT A FLAG MEANS BEFORE GATING ON IT.** F2 gated pause/notice on
     `p_override_availability`, assuming it meant "admin booking". It is an availability-override
     **checkbox**, `useState(false)`, absent by default. The fix would have blocked the Owner's own
     same-day phone bookings — the exact workflow the commit message claimed it protected.
     `p_booking_source` is the flag that distinguishes public from staff-entered.

121. **⛔ WALL-CLOCK ARITHMETIC IS DST-WRONG.** `(now() at time zone 'Europe/London') + interval` is
     calendar arithmetic on a naive timestamp and is **one hour wrong across every BST transition**
     (next: 25 Oct 2026). Use the absolute `timestamptz`. The function already computed the right
     value 60 lines above. ⚠️ `pnpm verify:london-time` **cannot catch this** — it only exercises the
     TypeScript helpers, not SQL.

122. **⛔ DOLLAR-QUOTED BLOCKS DO NOT DOUBLE QUOTES.** Inside `$mig$…$mig$`, a string literal still
     needs `''` for one quote — I wrote `''''` and the migration failed with a syntax error.
     ✅ **It failed atomically and changed nothing**, because the block asserted the live body's md5
     first and ran in a transaction. **Always put an md5 pre-condition on a function rewrite.**

123. **⛔ A PERMISSION FIX CAN BREAK A ROLE.** Gating health notes on
     `canManageSensitiveClientNotes` alone denied them to **Therapists**, who hold only
     `VIEW_CLIENT_HEALTH_NOTES_ASSIGNED` — the person about to treat the client. It also
     contradicted `/admin/clients/[id]`, which already grants them. **Query `role_permissions` for
     who actually holds a permission before gating on it, and check whether the codebase already
     answers the question elsewhere** (`src/app/admin/clients/access.ts` did).

124. **⛔ `proacl = NULL` MEANS PUBLIC EXECUTE, NOT "NO GRANTS".** A function created without an
     explicit GRANT defaults to EXECUTE for PUBLIC. Two functions were in this state in production.
     **A signature change forces DROP + CREATE, which silently discards every grant** — `CREATE OR
     REPLACE` preserves them, `DROP` does not.

125. **⛔ AN ADVISORY LOCK KEYED TOO FINELY SERIALISES NOTHING.** The booking lock keyed on
     `date:start_time`, so a 10:00 and a 10:30 request for a 60-minute service overlapped but took
     **different** locks and both passed. Key on the unit you are protecting (the date).

126. **✅ PATCH THE LIVE SOURCE, DO NOT RE-TRANSMIT LARGE SQL.** A 711-line function was applied by a
     `DO` block that reads `pg_get_functiondef`, asserts its md5, applies small `replace()` patches
     and `EXECUTE`s the result. The base body is then guaranteed correct rather than transcribed.
     ⚠️ **Consequence to record:** the repo file and the live function are then functionally
     equivalent but **not byte-identical** — see `supabase/migrations/README-MIGRATION-DRIFT.md` §6.

127. **⛔ GOTCHA 92 RECURS IN TEST FILES.** `canonical-domain.test.ts` fails on a second literal
     `https://rahmatherapy.uk` **anywhere under `src/`, including tests and comments**. A new Sentry
     test hard-coded it in a URL string and broke the suite. Use `example.test`.

---

## 7 — ⛔ OPEN ITEMS

### 7.1 — ⛔ THE OWNER'S NEXT STATED TASK: further removal and decluttering

**The Owner will specify the scope themselves. Do not start, and do not guess.**

⚠️ **A full declutter was ALREADY executed on 2026-08-17** (§5.1). Read
`redesign/plans/DECLUTTER-2026-08-17-plan.md` **before** proposing anything — especially §4, the
written map of what is load-bearing and why, and §14's three refuted claims. Repeating that audit
would waste a session.

⛔ **What is protected and why** (all verified, do not re-derive):
- `redesign/audits/**` and `C-B-DECISIONS.md` — `AGENTS.md` never-touch list
- `redesign/evidence/admin-contrast/` — a **live write target** of `pnpm test:e2e`
- `redesign/baselines/bundle-pre-B1.json` — read at runtime; `existsSync`-guarded, so deleting it
  **silently** disables the bundle gate. ⚠️ `baselines/` (plural, keep) vs `baseline/` (singular,
  already deleted) — one Tab of difference, gotcha 112
- **51 doc paths cited from live source**, listed in `declutter-2026-08-17/FINDINGS-A5 §2`
- `per-page-deferrals/` — a live punch-list, 14 items still open
- `brand-logo-assets/`, `rahma-therapy-image-replacements/` — closed Owner ruling
- ⛔ **Citation count is NOT a protection signal** — 26 recipes share ~1 MB of boilerplate, so a
  368-byte file scores 115 "citations" (gotcha 110)

### 7.2 — Blocking, Owner-side

**Full site testing**, then push Phase 12 (**opens bookings**), then Search Console.

### 7.3 — Not done, deliberately

- ⛔ **F8 — seven migrations exist in production with no file in the repo**, incl. the
  account-password-requests table and the avatar storage bucket, plus one repo migration never
  applied. **A fresh rebuild produces a broken database.** Procedure in
  `supabase/migrations/README-MIGRATION-DRIFT.md`; needs `supabase db pull` with CLI credentials.
- ⛔ **The two migrations' four functional VERIFY steps** — all require **creating bookings in
  production**. Approval covered applying the migrations, not writing customer data. Manual.
- **F4 option A** — making the staff invitation real.
- **13 remaining open deferrals** (one was fixed: the 44px trigger).
- ⛔ **`wrangler.jsonc` has 4 cron triggers, one firing every minute**, which begin acting on real
  bookings the moment Phase 12 ships, along paths never exercised against a real booking.

---

## 8 — Standing facts

- **Business reality governs effort.** ~15 bookings, 6 therapists, four cities, one engineer.
  ⛔ **The Owner has explicitly said not to over-engineer.** A reviewer cut one plan by two thirds on
  exactly that ground and was right.
- **Commit messages**: PowerShell here-strings strip quotes → always `git commit -F <file>`, written
  with the Write tool. ⚠️ Bash heredocs also failed repeatedly on content with backticks/quotes —
  use the Write tool for anything non-trivial.
- ⚠️ **Python on Windows writes `/tmp/x` to `C:\tmp\x`**, which Git Bash cannot see. Use repo-relative
  paths.
- ⛔ **There is no dev server running.** The old "localhost:3000 is the Owner's, never touch it" rule
  was verified **stale** — port 3000 is empty. Check before assuming.
- **The largest lever for the stated goal is the Google Business Profile**, already live, not in this
  repo.
