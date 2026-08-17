# FINDINGS O1 — fresh-eyes sweep for genuinely dead material

**Date:** 2026-08-17 · **Mandate:** find categories a directory-by-directory, citation-based sweep
structurally cannot see. Not bound by Wave 1's territories.

⛔ **All headline sizes independently re-verified by the orchestrator.**

---

## 1 — Headline

**On tracked files: essentially nothing new — and now we know *why* structurally.**
**Off the tracked tree: ~8.5 GB of regenerable residue that Wave 1's Class-B register missed entirely.**

The plan's "~82 MB reclaimed" understated the available cleanup by roughly **100×**.

---

## 2 — ⛔ The residue Wave 1 missed (all untracked)

| Path | Size | Why dead | Verified |
|---|---:|---|---|
| **`.next/`** | **8.4 GB** | Next build + dev cache; `.next/dev` alone is **8.3 GB**. Fully regenerable | ✅ ignored |
| `.open-next/` | 55 MB | OpenNext Cloudflare build output; regenerates via `pnpm cf:build` | ✅ ignored |
| `.playwright-mcp/` | 33 MB / 316 files | Playwright-MCP screenshot + console spill, 2026-07-08 → 08-13. Tool scratch, not a test record | ✅ ignored |
| `.impeccable/` | 198 KB / 21 files | 10 dead design sessions, last written **2026-05-15**. Contains the repo's only empty directory | ✅ ignored |
| `.superpowers/brainstorm/…` | 146 KB / 5 files | One abandoned brainstorm + a stale `state/server.pid` for a long-gone process | ✅ ignored |
| `redesign/.kilo/` | 2 KB | **Kilo Code IDE residue** — a harness this project no longer uses. Empty state, all script lines commented out | ✅ ignored |
| `.claude/skills/impeccable.zip` | 284 KB | Installer archive; its 61 entries are byte-identical to the already-extracted, already-tracked `.claude/skills/impeccable/` | ⛔ **NOT IGNORED** |

**Total ≈ 8.5 GB, of which ~8.46 GB is machine-regenerable with zero information loss.**
For scale: whole working dir 11 GB · `node_modules/` 1.1 GB · `.git/` 289 MB.

⛔ **OPERATIONAL WARNING: the Owner's dev server on `localhost:3000` is serving out of `.next/`.**
It must be stopped by the Owner before `.next/` is removed, or their session breaks mid-run.

⛔ **`impeccable.zip` is untracked AND not gitignored** — one `git add .` puts 284 KB into the public
repo. (`AGENTS.md` already forbids `git add .`, so this is a latent risk, not an active one.)
A one-line `.gitignore` entry closes it. `.claude/` is out of scope to change, so this is flagged only.

---

## 3 — ⛔ Why the citation audit returned "everything is protected"

**Method:** MD5 over every tracked text file for exact duplicates; then 4-gram shingle sets
(Jaccard ≥ 0.45 or containment ≥ 0.75) over 640 non-vendored markdown files, pairwise.

**Exact duplicate documents: ZERO.** Every hash collision in the tracked tree was a screenshot pair
or a `.agents/` ↔ `.claude/` vendored pair.

**Near-duplicates: 342 pairs, concentrated in one place.**

The 26 `per-page-recipes/*.md` show pairwise **containment 0.80–0.86**. `login-recipe.md` (43 KB) is
~85% contained in each of the other 25. ⛔ **Roughly 1.0 MB of the cluster's 1.25 MB is shared
boilerplate**, and that block name-drops `SAFETY-NET.md`, `impeccable-v5-latest-stable.html`,
`per-page-deferrals/*`, `baseline/*.png` and more.

⛔ **So ~25 of the "citations" protecting any given top-level document are one sentence, duplicated
25 times.** `SAFETY-NET.md` — 368 bytes — scores **115 citation hits** by this mechanism alone.

**Citation count is a near-worthless protection signal in this repo, and should be discounted.**
*(This independently reproduces O2's finding by a completely different method.)*

---

## 4 — ⛔ The plan's verification gate cannot detect what a deletion would break

Plan §7 relied on `extract-doc-citations.sh`. Read A5 §3's own header: it finds paths cited
*"under `src/`, `scripts/`, `e2e/`, `supabase/`, and the root config files."*

⛔ **It is a code→doc check only. It never opens a markdown file.** If a batch deletes a document
that only other documents cited, **this gate returns green.** Same shape of failure as the
`--exclude-dir=redesign` bug the plan itself calls out.

Running the missing direction over all 640 tracked markdown files: **125 distinct dangling targets,
382 citing edges.**

⚠️ **Honest qualification:** O1's first matcher alternated `ts|tsx`, capturing every `page.tsx` as
`page.ts` — 353 false targets. Fixed, it drops to 125. Of those, the **majority are prescriptive
output paths** ("save to X") inside recipes, not broken retrospective citations. Six were
hand-checked: four prescriptive, one a naming mismatch, one self-annotated as moved.

**Genuine breakage that survives the filter:**

| Target | Cited from |
|---|---|
| ⛔ `src/lib/maintenance.ts` | **111 documents** — incl. `AGENTS.md`, all 13 handoffs, the Phase 11 final gate |
| `redesign/baselines/bundle-post-band-c.json` | 3 evidence docs — **it never existed** |
| `src/components/shared/MaintenanceModal.tsx` | 9 docs |
| `MaintenanceBanner.tsx` | 3 docs |
| `src/components/ui/card.tsx` | 40 docs (moved, not deleted) |

**A doc→doc extractor must be added to §7 before any batch runs.**

---

## 5 — Checked and found clean

- **Exact-duplicate documents** — zero, outside vendored skill copies.
- **Empty tracked files** — zero, whole repo. Smallest is 132 B
  (`per-page-progress/booking-detail-progress.md`, a stub whose emptiness *is* the record: that page
  was never run).
- **Empty directories** — one, `.impeccable/live/annotations`, untracked.
- **Dead npm scripts** — all 18 resolve to a real script or binary. Nothing orphaned either way.
- **Obsolete tool config** — none. `eslint.config.mjs:22` ignoring `.agents/**` is deliberate.
- **Territory gaps between A1–A5** — none. All 15 `redesign/` subdirectories were claimed.
- **Superseded `-old`/`-draft`/`-backup` pairs** — none genuine. `-final`/`-v2`/`-post-axes` are
  iteration screenshots; `-new` is a route name (`clients/new`), not a version marker.
- **Docs about the deleted maintenance system** — none wholly about it; ~60 files mention it
  incidentally.
- **`impeccable-v5-latest-stable.html`** (738 KB) — chased as a superseded vendored snapshot,
  **refuted**: 32 citations and `MAIN-AGENT-CONTEXT.md:71` declares it **IMMUTABLE** after an earlier
  session damaged it.
- **`SAFETY-NET.md` rollback anchors** — both still resolve (tag `redesign-baseline` → `a9ef885`,
  branch `redesign/start-state` → `0325838`). Stale in tone, not dead. **Keep.**
- **`probe-baseline.json`** — 40 maintenance references, the most of any file, but **not dead**: it
  was deliberately captured with `MAINTENANCE_MODE=false` because that is the post-Phase-12 end
  state. It is the correct baseline *because* the system is gone.

---

## 6 — Corrections to prior waves

- ⛔ **A4's Class-B register is ~0.7% complete by volume** — 6 items / ~57 MB listed, missing
  `.next` (8.4 GB), `.open-next`, `.playwright-mcp`, `.impeccable`, `.superpowers`, `redesign/.kilo`
  and the not-ignored zip. Its "`.gitignore` gaps: none" conclusion was correct for what it examined.
- **A2's duplicate count re-run independently** (MD5 over all 1,190 tracked `redesign/` images, not
  just the 1,149 PNGs): **97 groups / 137 copies / 17.9 MB** vs A2's 96 / 136 / 19.0 MB. Same
  conclusion; method sound.

---

## 7 — Report-only (out of scope to change)

`.agents/skills/` and `.claude/skills/` are **byte-for-byte identical** — 58 tracked files, 888 KB
each. `pin.mjs:24` explains it: the installer writes to every harness directory it finds. So the repo
tracks an Apache-2.0 third-party skill **twice**, plus the 284 KB installer zip.

**Handoff to a future audit:** check whether `implementation-plans/` (18 files, 360 KB) is a closed
cluster — its only outside anchor is a single README bullet, and three of its files cite five
`docs/production/*.md` deliverables that do not exist.

---

## 8 — Confidence

**High:** the untracked residue inventory (sizes, mtimes, ignore-status, zip-vs-extracted identity)
— all directly measured and independently re-verified. Zero exact-duplicate documents; zero empty
tracked files; no dead npm scripts — exhaustive over `git ls-files`.

**Medium:** the 125 dangling doc→doc targets. The matcher is regex over prose and it lied once
already. The *structural* claim — that A5's extractor never reads markdown — is certain, read from
its own header. The count is indicative; the prescriptive/genuine split rests on six hand-checks.

**Not checked:** `.env` and the two credential files. No builds or tests run, so `.next`/`.open-next`
regeneration is assumed from their being standard gitignored build output.
