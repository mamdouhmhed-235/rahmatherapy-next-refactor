# FINDINGS A4 — everything outside `redesign/`

**Territory:** root loose files · `docs/` · `implementation-plans/` · `brand-logo-assets/` ·
`rahma-therapy-image-replacements/` · untracked bulk · orphan-check on `e2e/` and `scripts/`
**Date:** 2026-08-17 · **Method:** `git log`, `git ls-files`, ripgrep reference search, and MD5
comparison against `public/images/` + `public/logos/`. Read-only throughout.

---

## ⛔ 0 — SECURITY FINDING, outside decluttering scope

`docs/users-credentials` (tracked, 422 B) contains a production admin email and a **plaintext
password**, plus four harmless `.example.test` test credentials.

**Verified independently (values never read or reproduced):**

| Check | Result |
|---|---|
| Tracked in git | **yes** |
| Commits touching it | 1 — `500facb` |
| Is that commit on the remote? | **YES** — `git merge-base --is-ancestor 500facb origin/master` passes |
| Remote | `github.com/mamdouhmhed-235/rahmatherapy-next-refactor` |
| Repo visibility | ⛔ **PUBLIC** — unauthenticated API returned HTTP 200, sampled 2× |
| Password value shape | 11 chars, not placeholder-shaped |

⛔ **Deleting the file does not fix this.** It is in public git history. **The credential must be
rotated.** Rotation is Owner-side — no agent should attempt it.

✅ **Checked and clear:** every `SERVICE_ROLE_KEY`, `API_KEY` and `ANON_KEY` string found anywhere
in the tracked tree is a **placeholder**, verified by shape (none are JWT-form). No Supabase key is
exposed. `.env` is correctly gitignored and was never read.

---

## 1 — Summary

27 items inventoried (11 root files, 5 `docs/` files, 5 directories as units, 6 Class-B items).

| Verdict | Count |
|---|---|
| KEEP-LIVE | 4 |
| KEEP-GOVERNING | 5 |
| KEEP-MEMORY | 3 |
| KEEP-CITED | 1 |
| CONSOLIDATE | 2 |
| DELETE-SAFE | 6 |
| OWNER-CALL | 6 |

- **~2.2 MB, near-zero risk:** `role-specific-admin-crm-plan.html` (72 KB, zero references), both
  `.tsbuildinfo` files (2.1 MB), both dev-server logs, `test-results/`.
- **~71.7 MB, Owner decision, MOVE not DELETE:** `photos-rahma-therapy/` (55 MB),
  `brand-logo-assets/` (4.7 MB), `rahma-therapy-image-replacements/` (12 MB).

---

## 2 — Inventory

| path | class | size | tracked | last-touched | referenced by | verdict | evidence |
|---|---|---|---|---|---|---|---|
| `AGENTS.md` | A | 1.3 KB | yes | 2026-07-30 | de facto agent entry point | KEEP-GOVERNING | ⚠️ 2 stale specifics: cites `src/lib/maintenance.ts` (deleted in `3eb2939`) and `C-B-DECISIONS.md` (does not exist) |
| `README.md` | A | 7.1 KB | yes | 2026-05-01 | main dev doc | KEEP-LIVE | ⚠️ Stale: calls `admin/` "Reserved — future admin CMS" and the booking backend "future" — both shipped |
| `DESIGN.md` | A | 42 KB | yes | 2026-05-20 | **17+ citations in `src/`** | KEEP-GOVERNING | `grep "DESIGN\.md" src/` → 17 matches citing §-numbered sections from shipped code |
| `DESIGN.json` | A | 24 KB | yes | 2026-05-13 | `DESIGN.md:432`; design tooling | KEEP-GOVERNING | Actively consumed sidecar |
| `PRODUCT.md` | A | 17 KB | yes | 2026-05-13 | `dashboard-cards.tsx:271`, `therapist-fullness.ts:3` | KEEP-GOVERNING | Cited as governing brief for specific UI decisions |
| `dashboard_audit.md` | A | 4.9 KB | yes | 2026-05-09 | `redesign/BUSINESS-COMPLETENESS.md:177` | KEEP-CITED | Superseded in content but cited as evidence for a still-open finding |
| `implementation.md` | A | 6.7 KB | yes | 2026-05-09 | none (verified twice) | CONSOLIDATE | RBAC plan matching `20260509143000_granular_rbac_consolidation.sql` — shipped |
| `role-specific-admin-crm-plan.html` | A | 72 KB | yes | 2026-05-09 | **none** | **DELETE-SAFE** | Zero references; double-checked after catching a parallel-grep false positive |
| `sentry_guide.md` | A | 1.8 KB | yes | 2026-04-30 | `README.md:178` only | OWNER-CALL | Generic setup walkthrough; setup already complete |
| `GITHUB_ISSUES_GUIDE.md` | A | 3.8 KB | yes | 2026-04-30 | `README.md:177` | OWNER-CALL | Mandates `[#ID]` commits; **0 of 950 commits follow it** — never adopted |
| `skills-lock.json` | A | 269 B | yes | 2026-05-13 | `.claude/skills/impeccable/scripts/pin.mjs` | KEEP-LIVE | Active lockfile |
| `docs/production-runbook.md` | A | 7.4 KB | yes | 2026-05-04 | canonical ops runbook | KEEP-GOVERNING | ⚠️ Broken link to `./production/migration-history.md` |
| `docs/production/backend-parity-audit.md` | A | small | yes | 2026-05-10 | none outside `docs/` | KEEP-MEMORY | Pre-launch record |
| `docs/production/production-readiness-checklist.md` | A | small | yes | 2026-05-10 | none outside `docs/` | KEEP-MEMORY | Pre-launch record |
| `docs/tech-stack` | A | 857 B | yes | 2026-05-09 | none | CONSOLIDATE | Redundant with README's own table |
| `docs/users-credentials` | A | 422 B | yes | 2026-05-13 | none | ⛔ **OWNER-CALL — SECURITY** | See §0 |
| `implementation-plans/` (18) | A | 360 KB | yes | 2026-05-06 | `README.md:180` — "archived implementation plans" | KEEP-MEMORY | Intentional archive |
| `brand-logo-assets/` (59) | A | 4.7 MB | yes | 2026-05-04 | none in `src/`/`scripts/`/config | OWNER-CALL | **47/59 (80%) unique** — see §5 |
| `rahma-therapy-image-replacements/` (14) | A | 12 MB | yes | 2026-05-04 | none | OWNER-CALL | 6/14 absorbed; 8 unique masters |
| `e2e/` (7) | C | 84 KB | yes | — | `package.json` | KEEP-LIVE | Load-bearing, nothing orphaned |
| `scripts/` (14) | C | 176 KB | yes | — | 6/14 in `package.json`; rest vitest-picked or gate tooling | KEEP-LIVE | Load-bearing, nothing orphaned |
| `tsconfig.tsbuildinfo` | B | 1.1 MB | no | — | none | DELETE-SAFE | Regenerable cache |
| `tsconfig.phase0check.tsbuildinfo` | B | 1.1 MB | no | — | none | DELETE-SAFE | Regenerable cache |
| `dev-server.err.log` | B | 0 B | no | — | none | DELETE-SAFE | Empty |
| `dev-server.out.log` | B | 414 B | no | — | none | DELETE-SAFE | Trivial |
| `test-results/` | B | ~1 KB | no | — | none | DELETE-SAFE | Only `.last-run.json` |
| `photos-rahma-therapy/` (52) | B | 55 MB | no | — | none | OWNER-CALL | Move, not delete — see §4 |

---

## 3 — Class B register (untracked; permanent loss if deleted)

| path | size | recoverable? |
|---|---|---|
| `tsconfig.tsbuildinfo` | 1.1 MB | yes — regenerates |
| `tsconfig.phase0check.tsbuildinfo` | 1.1 MB | yes — regenerates |
| `dev-server.err.log` | 0 B | yes |
| `dev-server.out.log` | 414 B | yes |
| `test-results/` | ~1 KB | yes |
| `photos-rahma-therapy/` | 55 MB | ⛔ **partially — 24 of 52 files are the only copy anywhere** |

Only `photos-rahma-therapy/`'s 24 unique files carry irreplaceable content. Everything else in
Class B is machine-regenerable ephemera.

---

## 4 — `photos-rahma-therapy/` analysis

MD5 of all 52 files against all 89 files under `public/images/` + `public/logos/`, multiset-correct
per-file join.

**Result: 28 duplicate / 24 unique — the prior session's claim is independently confirmed.**

The 24 unique files include `about-hero-arriving.png`, seven `dji_mimo_*` drone originals, four
`faq-*` images, `homepage-hero-vid.mp4`, `reviews-hero.png`, and several `.webp` service photos.
Zero references from `src/`. Since the Owner has ruled this directory gets **moved**, all 24
travel with it.

---

## 5 — `brand-logo-assets/` and `rahma-therapy-image-replacements/`

- **`brand-logo-assets/`** — 12/59 duplicated into `public/images/brand/rahma/`. **47/59 unique**,
  including the whole `raster-exact/` folder (17 files; its own README calls it the "primary
  fidelity reference") and `archive-2026-04-25-original/` (10 files, "kept for rollback/reference").
  ⛔ **Not spent source material** — only the favicon/social-preview subset was ever adopted.
  Deserves move-don't-delete treatment.
- **`rahma-therapy-image-replacements/`** — 6/14 `.webp` byte-identical to files now live in
  `public/images/home/` under different names. 8/14 unique: six `.png` masters plus
  `manifest.json` and `README.txt`. **Fully spent for its stated purpose**; only uncompressed
  originals remain.

---

## 6 — Stale root documents

`README.md` (admin CMS called "future") · `AGENTS.md` (cites a deleted file and a nonexistent one) ·
`implementation.md` (pre-backend genesis state) · `implementation-plans/IMPLEMENTATION_PLAN.md` ·
`dashboard_audit.md` (superseded but cited) · `docs/production-runbook.md` (broken link) ·
`GITHUB_ISSUES_GUIDE.md` (convention never adopted).

**Not stale:** `DESIGN.md`, `DESIGN.json`, `PRODUCT.md` — actively cited by section number from
shipped code.

---

## 7 — `.gitignore` gaps

**None.** All six Class-B paths are correctly covered (`*.tsbuildinfo`, `dev-server*.log`,
`test-results/`, and an explicit `photos-rahma-therapy/` entry with its own comment). None was ever
tracked-then-ignored. `.env` is correctly covered.

---

## 8 — Owner-call summary

`docs/users-credentials` (**security — rotate, don't just delete**) · `brand-logo-assets/` and
`rahma-therapy-image-replacements/` (prefer move) · `photos-rahma-therapy/` (already decided: move) ·
`implementation.md` (fold into `implementation-plans/`) · `dashboard_audit.md` (don't delete without
resolving its citation) · `sentry_guide.md` and `GITHUB_ISSUES_GUIDE.md` (low value, but the README
links need removing too) · `docs/tech-stack` (fold into README).
