# HANDOFF — 2026-08-17 (eleventh session · WORKSPACE DECLUTTER)

**⛔ THIS IS THE LIVE DOCUMENT. Read it end to end before touching anything.**
It replaces `HANDOFF-2026-08-13-IMPLEMENTATION-9.md`, whose §1 position table and §6.2 next-task
note are now stale. **Everything else in -9 still stands**, and the ten earlier handoffs keep their
gotchas and are **not** superseded:

- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — 1-15
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — 16-27
- `HANDOFF-2026-08-12-IMPLEMENTATION-3.md` §5 — 28-41
- `HANDOFF-2026-08-12-IMPLEMENTATION-4.md` §5 — 42-53
- `HANDOFF-2026-08-12-IMPLEMENTATION-5.md` §5 — 54-66
- `HANDOFF-2026-08-13-IMPLEMENTATION-6.md` §5 — 67-79 *(its §1 and §7 are stale; gotcha 78 corrected by 80)*
- `HANDOFF-2026-08-13-IMPLEMENTATION-7.md` §5 — 80-89
- `HANDOFF-2026-08-13-IMPLEMENTATION-8.md` §5 — **90-108**
- `HANDOFF-2026-08-13-IMPLEMENTATION-9.md` — the SEO/AEO/GEO release record

**This file adds gotchas 109-118 (§5).**

---

## 1 — ⛔ POSITION. Verify with git before trusting anything here.

```
HEAD           50a294d   on master
origin/master  0f8ab9d
UNPUSHED       10 commits
working tree   CLEAN
tracked files  1988      (was 2996 before this session)
```

⛔ **Never trust a commit count written in a document.** Compute it:
`git rev-list --count origin/master..HEAD`

### 1.1 — ⛔⛔ THE MOST IMPORTANT FACT IS UNCHANGED

**The first unpushed commit is still `3eb2939` — Phase 12, which removes the maintenance system.
A bare `git push` OPENS LIVE BOOKINGS.** The other nine are its descendants, so git's linear history
means **nothing ships without it.** Never push without a fresh, explicit Owner instruction, and say
out loud what a push would do before proposing one.

| | |
|---|---|
| Deployed (Phases 0-11b) | `efc7484` → `0f8ab9d`, released 2026-08-13 |
| ⛔ NOT deployed | `3eb2939` Phase 12 · `9e8d83f` docs · `563d520` geography fix · `c04b6b4` handoff · **plus this session's 6 declutter commits** |

⛔ **Production still serves the maintenance banner, bookings are CLOSED there, and screen readers
still hear "Map of Dunstable, Luton".** All three are fixed locally and blocked behind Phase 12.

---

## 2 — ⛔ ABSOLUTE RULES (unchanged)

1. ⛔ **THE SITE IS LIVE.** Push to `master` auto-deploys via Cloudflare (~3 min). No CI, no staging.
2. ⛔ **`git push` right now opens live bookings.**
3. ⛔ **Do NOT submit the sitemap in Search Console** until Phase 12 is deployed.
4. ⛔ **C2 — the Owner's visible page copy must not be reworded.**
5. ⛔ **C3 — every absolute site URL must come from `SITE_URL`/`siteUrl()`.** Only `npx vitest run`
   catches a violation.
6. ⛔ **Never round-trip a repo file through PowerShell `Get-Content`/`Set-Content`** — it destroys
   UTF-8. Use the Edit tool; write commit messages with Write, then `git commit -F`.
7. ⛔ **`AGENTS.md`'s non-negotiables paragraph is binding** and was surgically corrected this
   session — see §4.

---

## 3 — ⛔ GATE BASELINES (all verified green at `50a294d`, after a cold build)

```powershell
npx tsc --noEmit                              # 0
npx vitest run                                # 0 failed / 2501 passed (2501), 242 files
                                              # ⛔ CHECK THE COUNT, not just green — gotcha 118
pnpm lint                                     # 4 errors / 1 warning, THREE files
npx vitest run scripts/                       # 47 passed
node scripts/measure-admin-contrast.mjs .     # 110 (46 dark / 64 light)
node scripts/verify-admin-token-contrast.mjs  # 0
git status --porcelain -- src/ supabase/      # EMPTY
```

⛔ **Not one gate moved during the declutter.** No `src/` file was touched.

**Two NEW gates exist as tracked scripts** (they did not exist before; the plan referenced one that
was only a code block inside a document):

```bash
bash extract-doc-citations.sh | awk -F'\t' 'NR>1 && $4=="DANGLING"'   # code → doc
bash extract-doc-doc-citations.sh                                     # doc → doc
```

- **code→doc baseline: 1 dangling.** It is pre-existing and **external** — a migration comment citing
  a plan in the user's global `~/.claude/plans/`. Not a defect in this repo.
- **doc→doc baseline: 429 dangling.** Mostly prescriptive output paths inside recipes, plus 92
  screenshot references this session's deletion made permanent. ⛔ **It passes on a SET DIFFERENCE
  against a captured baseline, never on zero.** Baselines are stored beside the `.git` backup.

---

## 4 — ⛔ OWNER DECISIONS THIS SESSION. Do not re-ask.

| Decision | Ruling |
|---|---|
| **Declutter scope** | **Docs, artifacts and assets only.** `src/`, dependencies, `public/`, `.claude/` out of scope |
| ⛔ **The two credential files** | **"Just test ones." CLOSED — do not raise again.** `docs/users-credentials` and `redesign/test-credentials.md` carry plaintext passwords beside the real business mailbox in a **public** repo. The Owner has ruled. ✅ Independently verified: every `SERVICE_ROLE_KEY`/`API_KEY`/`ANON_KEY` in the tree is a **placeholder**; no Supabase key is exposed; `.env` correctly gitignored |
| **C-21 screenshots** | **Delete** — overruled the audit's keep recommendation. Done, irreversible |
| **Screenshot archives + Playwright data** | **Delete** — "the final site is built, they have no value". Done, 1,020 files |
| **Logs and test artifacts** | **KEEP.** `dev-server*.log` and `test-results/` retained |
| **`photos-rahma-therapy/`** | **Move out of the repo**, not delete. Done — all 52 files |
| **Removal method** | `git rm`, relying on git history, with a `.git` backup first |
| **73-file reorganisation** | ⚠️ **Offered and NOT recommended. Not executed.** See §7 |

---

## 5 — NEW GOTCHAS (109-117). Each cost real time or nearly caused damage.

109. **⛔ A PROOF OF ABSENCE MUST BE ABLE TO FIND THE THING IT CLAIMS IS ABSENT.** An agent proved 55
     files uncited with `grep -rl "$name" --exclude-dir=redesign …` — **excluding the very directory
     every citer lived in.** The check was structurally incapable of returning a hit. Run properly,
     **26 of 26** were cited. **Before trusting a negative, confirm the command could have produced a
     positive.**

110. **⛔ CITATION COUNT IS NOT A PROTECTION SIGNAL IN THIS REPO.** The 26 per-page recipes share
     ~1 MB of identical boilerplate that name-drops most top-level docs. `SAFETY-NET.md` — **368
     bytes** — scores **115 citation hits** that way. Judge by *who* cites, not how many.

111. **⛔ A STATEMENT OF FACT IN A GOVERNANCE DOCUMENT IS NOT A PROHIBITION.** `AGENTS.md` says
     *"Position of record is git + `redesign/per-page-progress/`"*. An audit read that as a
     directory-wide never-touch rule and nearly preserved 57 files on it. The never-touch list is a
     **different paragraph**. `AGENTS.md` now says so explicitly.

112. **⛔ `baseline` IS A STRICT PREFIX OF `baselines`, AND A TAB-COMPLETED PREFIX IS A LITERAL
     PATH.** `redesign/baseline/` was deleted this session; `redesign/baselines/` must never be —
     it holds `bundle-pre-B1.json` (read at runtime, `existsSync`-guarded, so deleting it **silently**
     disables the bundle gate) and `wcag-severity-tokens.md` (cited from `tokens.css:112`). One extra
     Tab turns the safe command into the destructive one. **Delete via
     `git rm --pathspec-from-file` over an enumerated list with a `grep -c 'baselines/'` guard, never
     a directory pathspec.**

113. **⚠️ `git check-ignore -v --no-index "path/"` WITH A TRAILING SLASH RETURNS A FALSE POSITIVE**,
     citing a blank `.gitignore` line. A control run on a nonexistent path reproduces it. **Test
     paths without trailing slashes.**

114. **⛔ A FAILED COMMAND SUBSTITUTION TURNS A VERIFICATION INTO A RUBBER STAMP.** A `sed` inside
     `grep -qF "$(…)"` errored, leaving `grep -qF ""` — **which matches everything.** Eight
     protection checks reported ✅ while proving nothing. Caught only because a ninth disagreed.
     **If every check passes, suspect the checker.**

115. **⛔ `git rm` IS ONLY RECOVERABLE WHILE `.git` SURVIVES — AND HERE `.git` IS THE ONLY COPY.**
     Nothing may be pushed, there is no second clone, and Phase 12 exists nowhere else. Forbidding
     `git reset --hard` is half a rule if `git reflog expire` and `gc --prune=now` are still allowed.
     **Back up `.git` before any deletion pass** — a verified `git bundle create --all` plus a raw
     copy. This session's backup is at `~/Desktop/rahma-git-backup-2026-08-17`.

116. **⚠️ `git grep` IS BLIND TO UNTRACKED FILES.** Searching for a string that lives only in an
     untracked file returns nothing and looks like proof of absence. Use plain `grep -rn` when the
     target may be untracked.

117. **⚠️ `rm -rf` DOES NOT EXIST IN POWERSHELL** (`rm` is `Remove-Item`, which has no `-rf`). This
     project is PowerShell-primary with Bash available. **Label which shell each command block
     targets**, or the executor reaches for `Remove-Item -Recurse -Force` unsupervised.

118. **⛔ `npx vitest run` CAN SILENTLY UNDER-DISCOVER TEST FILES AND STILL EXIT 0.** Observed
     2026-08-17: one run reported **`Test Files 241 passed (241)` / `Tests 2480 passed (2480)`** with
     **exit code 0** — no failure, no error, no skip notice. The gap was exactly
     `src/app/__tests__/canonicals.test.ts` (21 tests), which passes in isolation and was never
     touched. Two further full runs both returned **242 / 2501**.
     ⛔ **"vitest passed" is NOT a sufficient gate — a green exit code with a LOWER count is a real
     and silent failure mode.** Always compare the **count**, and re-run before believing a
     discrepancy. Had the count been read as "all passed", a missing SEO canonical guard would have
     gone unnoticed. This is why the baseline is written as *0 failed / **2501 passed** / **242
     files***, not just "green".

---

## 6 — WHAT HAPPENED THIS SESSION

**The Owner's declutter task (HANDOFF-9 §6.2) is DONE.** Nine agents inventoried the workspace and
attacked their own findings; four adversarial reviews each found real defects. Full record:
`redesign/declutter-2026-08-17/` (11 files) and `redesign/plans/DECLUTTER-2026-08-17-plan.md`.

| | Before | After |
|---|---:|---:|
| Tracked files | 2,996 | **1,988** |
| `redesign/` | 215 MB / 1,819 files | **55 MB / 810 files** |
| Disk freed | — | **~8.65 GB** |

**Six commits:** `672a3b9` audit+plan · `82f51b4` gate scripts · `af47605` doc corrections ·
`ba2072e` 3 spent documents · `ce7f502` 1,020 screenshots · `50a294d` execution record.

⛔ **The headline finding, and it is counter-intuitive: the tracked archive was NOT dead weight.**
Of 46 proposed document deletions, **44 were refuted**. Only 3 tracked documents were safe to remove.
A bulk `rm -rf redesign/` — the obvious move at 61% of the repo — would have broken a wired e2e suite,
orphaned 51 source citations, and deleted files `AGENTS.md` forbids touching. **The real clutter was
never in git**: 8.4 GB of it was `.next`.

**Moved out of the repo** to `~/Desktop/rahma-archive-2026-08-17` (80 files, 55 MB):
`photos-rahma-therapy/` (24 files exist nowhere else), `.impeccable/`, `.superpowers/brainstorm/`,
`redesign/.kilo/`.

**`AGENTS.md` was surgically corrected** — Band C framing, the position-of-record line (gotcha 111),
and the `maintenance.ts` clause rephrased to be true whether or not Phase 12 ships. ⛔ **All five
protections in its non-negotiables sentence were preserved verbatim.**

---

## 7 — ⛔ OPEN ITEMS

### 7.1 — Blocking, Owner-side (unchanged from HANDOFF-9)

**The Owner's full site testing.** Bookings are open locally for exactly this. When it passes:
1. Push (carries Phase 12 + everything after — **this opens bookings**).
2. Verify the banner is gone from all 18 routes and `?booking=1` works.
3. **Then** Search Console.

### 7.2 — ⛔ Worth more than the declutter: 15 still-open deferrals

`redesign/per-page-deferrals/` was frozen 2026-05-19 while the project shipped three more months.
**15 items were re-verified as still open in today's code. One has since been fixed; 14 remain:**

- ✅ **`AdminActionMenu` trigger — FIXED 2026-08-17.** Was `size-9` (36px, measured 35.99px);
  now `min-h-11 min-w-11` (44×44), meeting WCAG 2.5.5. Shared primitive, so it lands on every page
  using the menu. Gates unchanged. ⛔ Not visually verified — the admin surface is auth-gated and
  agents may not authenticate.
- `AdminErrorBoundary` fallback lacks `role="alert"`.
- Therapist dashboard missing its gender-match chip and customer-notes block.
- Role create/delete and the password-reset flow unshipped, with live FAKE markers.
- Repo-wide oklch token drift — 98 files / 679 occurrences.

### 7.3 — Offered, not done

- **The 73-file reorganisation** of `redesign/`'s 85 loose files into an `archive/` tree.
  ⚠️ **Recommended against**: a move breaks citations exactly like a deletion, and stamping already
  achieves the anti-confusion goal at zero risk. `redesign/README.md` now maps what is live instead.
- **Deleting `redesign/audits/`'s 56 images** — needs an explicit override of `AGENTS.md`.
- **Stop committing screenshot evidence.** ⛔ `.git` stays at 286 MB because history is never
  rewritten. The deletion paused the growth; only gitignoring new captures prevents it recurring.

### 7.4 — Carried forward from HANDOFF-9

Lighthouse BP 96 vs 100 (fold into testing) · Google Business Profile service-area configuration
unverified · Rich Results Test never run · Bedford has a booking but no area page · Google Maps ToS
on 89 reviews (dormant) · Band C ITEM M / A2.

---

## 8 — Standing facts

- **Business reality governs effort.** ~15 bookings, 6 bookable therapists, four cities.
  ⛔ **The Owner has explicitly said not to over-engineer.** An adversarial reviewer cut this
  session's plan by two thirds on exactly that ground, and was right.
- **Commit messages**: PowerShell here-strings strip double quotes → always `git commit -F <file>`,
  written with the Write tool.
- **`next.config.ts`**: `trailingSlash: true` and Sentry `tunnelRoute: "/monitoring"`.
- **The largest lever for the stated goal is the Google Business Profile**, it is not in this
  repository, and it is already live.
- ⛔ **There was no dev server running this session.** The long-standing rule "the dev server at
  `localhost:3000` is the Owner's, never touch it" was verified stale — port 3000 was empty.
  Check before assuming.
