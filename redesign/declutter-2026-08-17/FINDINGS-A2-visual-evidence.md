# FINDINGS A2 — visual evidence, screenshots and capture baselines

**Territory:** `redesign/screenshots`, `evidence`, `baseline`, `baselines`, `reconciliation-walk`,
`adapt-shots`, `onboard-shots`, `polish-shots`
**Date:** 2026-08-17 · **Method:** directory/run granularity, exhaustive MD5 pass over all PNGs,
`git ls-files` vs `find` for tracked status, citations existence-verified rather than string-matched.
Read-only throughout.

---

## 1 — Summary

| | |
|---|---|
| Total files | 1,372 |
| Total size | ~192 MB |
| Tracked (Class A) | 1,357 |
| ⛔ Gitignored, unrecoverable if deleted (Class B) | **15 files, 24.65 MB** — all in `redesign/evidence/C-21/` |
| Byte-identical duplicates (exhaustive checksum) | 96 groups · 136 redundant copies · **19.0 MB** |
| **Cleanly reclaimable now, zero controversy** | **24.65 MB** |
| Reclaimable only if doc citations are updated first | ~19 MB |
| Total touchable in any scenario | **~43.6 MB of ~192 MB (≈23%)** |

Verdicts: KEEP-GOVERNING 4 · KEEP-MEMORY 9 · KEEP-CITED 6 · CONSOLIDATE 1 · DELETE-SAFE 1 ·
OWNER-CALL 3. **The remaining ~148 MB (77%) is legitimately KEEP.**

---

## 2 — Inventory

| Path | What it is | Files | Size | Tracked | Last-touched | Cited by (verified) | Verdict |
|---|---|---|---|---|---|---|---|
| `screenshots/` root | Phase-2 empty/populated baseline + booking-wizard pass | 54 | 5.2 MB | 100% | 2026-05-19 | `RECIPE-PROGRESS.md:169-171`, `RECON.md:11,391` | KEEP-MEMORY |
| `screenshots/<slug>-redesign/` (29 dirs) | Per-page capture trail for every admin page's Phase 6/7 recipe | 669 | ~88.5 MB | 100% | 2026-05-19 | 30 `per-page-recipes/*.md` name this exact path as canonical step output | KEEP-CITED |
| `baseline/` (singular) | Phase 7 Gate 5 "adapt-after" (62) + role-sweep shots | 146 | 20 MB | 100% | 2026-05-19 | 30 `per-page-recipes/*.md`; `LAUNCH-SHEET.md`, `MAIN-AGENT-CONTEXT.md`, `POST-AGENT-AUDIT-PROTOCOL.md` | **CONSOLIDATE** |
| `baselines/` (plural) | Separate May 24-25 "B0-B6" micro-project, 7 sub-runs + 3 non-image files | 87 | 17 MB | 100% | 2026-05-25 | ⛔ `scripts/measure-admin-bundles.mjs:146` **reads** `bundle-pre-B1.json` at runtime; `src/styles/tokens.css:112` cites `wcag-severity-tokens.md` | KEEP-GOVERNING |
| `reconciliation-walk/` | Phase 6 close-out cross-page walk | 90 | 12 MB | 100% | 2026-05-19 | `RECONCILIATION-WALK-PLAN.md`, `WAVE-RECONCILIATION.md` | KEEP-MEMORY |
| `adapt-shots/` | Phase 7 Gate 5 re-run, full 25/25 routes — successor to `baseline/`'s partial pass | 50 | 8.7 MB | 100% | 2026-05-20 | `ADAPT-PASS.md` ("supersedes the 2026-05-19 section where they overlap") | KEEP-MEMORY |
| `onboard-shots/` | Phase 7 Gate 6, terminal | 7 | 1.3 MB | 100% | 2026-05-20 | `ONBOARD-PASS.md` | KEEP-MEMORY |
| `polish-shots/` | Phase 7 Gate 7, terminal | 4 | 472 KB | 100% | 2026-05-20 | `POLISH-PASS.md` | KEEP-MEMORY |
| `evidence/C-02…C-23` (14 dirs) | Band C plan-item verification records | 116 | ~14 MB | all but C-21 | Jul 27 – Aug 9 | Several cited from **production source** (`cookie-registry.ts`, `extend-recurring-horizons/route.ts`, `SentryProvider.test.tsx`, `privacy/page.test.tsx`) | KEEP-CITED / GOVERNING |
| `evidence/C-21/visual-regression-1280.md` | The tracked findings doc | 1 | 8.9 KB | yes | 2026-07-27 | Governing SEO plan says explicitly NOT to use as baseline | KEEP-MEMORY |
| `evidence/C-21/*.png` | 15 full-page screenshots, gitignored | 15 | **24.65 MB** | ⛔ **NO (Class B)** | n/a | Not cited by path anywhere | **DELETE-SAFE** |
| `evidence/SEO-phase0-baseline/` | `probe-baseline.json`, 40 structural probes | 2 | 72 KB | 100% | 2026-08-13 | `SEO-AEO-GEO-IMPLEMENTATION.md:104` — "**the regression oracle**" | **KEEP-GOVERNING, load-bearing** |
| `evidence/SEO-phase11-review/` | Phase 11 review record | 2 | 20 KB | 100% | 2026-08-13 | No literal path citation; direct evidence for live plan §14 | KEEP-GOVERNING |
| `evidence/admin-contrast/` | WCAG contrast investigation | 16 | 172 KB | 100% | 2026-08-12 | `scripts/verify-admin-token-contrast.mjs:240` (comment) | KEEP-GOVERNING |
| `evidence/checkpoint-3/`, `plan-deepening/`, `post-band-c-impl/` | Band C drift/research notes | 119 | 3.1 MB | 100% | Aug 3–12 | `DRIFT-CHECKPOINT-*-FORMAL.md`, `HANDOFF-2026-08-1*.md` | KEEP-GOVERNING |

---

## 3 — `baseline/` vs `baselines/`: answered definitively

**They are not duplicates of each other. They are unrelated projects with near-identical names.**

- **`baseline/`** (singular) — Phase 6/7 admin-redesign gauntlet output, 2026-05-19. Gate-5
  "adapt-after" shots plus role-sweep shots, from the same recipe system that produced
  `screenshots/`.
- **`baselines/`** (plural) — a separate later micro-project (2026-05-24→25), six sequential
  "B0-B6" gates across 7 dated sub-runs, plus three **non-screenshot** files:
  `bundle-pre-B1.json`, `sentry-baseline.txt`, `wcag-severity-tokens.md`.

⛔ **The real finding:** `baseline/`'s 62 "adapt-after" files are not merely *conceptually*
superseded by `adapt-shots/` — **37 of them are checksum-proven byte-identical** to files already
in `screenshots/<slug>-redesign/`, captured the same day by the same run under a different
filename convention. `baseline/` is substantially **a second copy of `screenshots/`**.

---

## 4 — High-confidence deletion

### `redesign/evidence/C-21/*.png` — 15 files, 24.65 MB — DELETE-SAFE

```bash
git ls-files redesign/evidence/C-21/                     # → only visual-regression-1280.md
git status --porcelain --ignored redesign/evidence/C-21/ # → 15 files marked "!!"
du -cb redesign/evidence/C-21/*.png                      # → 25,848,230 bytes = 24.65 MB
grep -rl "C-21" redesign/ src/ scripts/ e2e/ *.md        # → only the tracked .md itself
```

`SEO-AEO-GEO-IMPLEMENTATION.md:754-756`, a live governing plan, disowns them outright: *"Do NOT
use the C-21 evidence as the baseline… 476 commits ago."*

Already outside git (so zero history impact), uncited, and explicitly stale. **Keep the tracked
8.9 KB findings doc.**

⛔ **Class B caveat:** these are gitignored, so deletion is permanent and git cannot restore them.

No other directory clears the DELETE-SAFE bar.

---

## 5 — Do not delete

- **`evidence/SEO-phase0-baseline/probe-baseline.json`** — the regression oracle; the authority for
  the "20 probed routes" count in the live plan.
- ⛔ **`baselines/bundle-pre-B1.json`** — **read at runtime** by `scripts/measure-admin-bundles.mjs:146`.
  Guarded by `existsSync`, so deleting it does not error — it **silently disables** the
  bundle-regression check. Silent degradation, not a crash.
- **`baselines/wcag-severity-tokens.md`** — cited in production `src/styles/tokens.css:112`.
- **`evidence/admin-contrast/root-cause-D1.md`** — cited in the gate script
  `scripts/verify-admin-token-contrast.mjs:240`.
- **`evidence/C-18/cookie-inventory-{source,browser}.md`**, `C-18/sentry-replay-investigation.md`,
  `C-02/phase-b-rpc-verification.md`, `post-band-c-impl/item-2/` — cited by path from production `src/`.
- **All of `evidence/C-02`–`C-23`** — small, individually cited, several load-bearing.
- **`screenshots/`** (88.5 MB) — the named output location for 30 per-page recipes.

---

## 6 — Uncertain / Owner-call

1. **`baseline/`'s 62 adapt-after files, 8.6 MB — CONSOLIDATE.** 37 are proven byte-identical to
   files already in `screenshots/`; the rest are the partial May-19 run that `adapt-shots/`
   supersedes. But 30 recipe docs name these exact paths. Requires citation updates first — do not
   delete unilaterally.
2. **Intra-`screenshots/` duplicate steps, ~14.4 MB across 58 proven groups.** e.g.
   `role-detail-final-768.png` = `role-detail-polish-final-768.png` = `role-detail-post-axes-768.png`,
   byte-identical — the polish step made no visual change. Reclaimable with zero information loss,
   but it means editing inside a protected "keep" archive for low value.
3. **`evidence/SEO-phase11-review/`** — no exact-string citation, but same-session evidence for live
   plan §14. 20 KB; flagged for awareness only.

---

## 7 — Method notes

- **Duplicate detection was exhaustive, not sampled.** All 1,149 PNGs sized → 98 size-collision
  groups (334 files) as candidates (differing byte size rules out identity, so the prefilter cannot
  miss a true duplicate) → all 236 candidates MD5-hashed → 96 confirmed groups. Two size collisions
  proved coincidental, which demonstrates the prefilter works.
- The 223 non-PNG files were not hashed — not a visual-archive question.
- Every "cited-by" was **existence-verified** at the cited path, not merely string-matched.
- **No broken or stale citations were found anywhere in this territory.**
