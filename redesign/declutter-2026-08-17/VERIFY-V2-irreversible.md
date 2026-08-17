# VERIFY V2 — adversarial attack on the IRREVERSIBLE deletions

**Date:** 2026-08-17 · **Mandate:** refute, not confirm. Uncertainty defaults to "do not delete".
All four candidates independently re-derived from scratch (MD5 joins, grep sweeps, config reads),
not merely re-confirmed from A1–A5's assertions.

---

## 1 — Verdicts

| Candidate | Verdict | Reason |
|---|---|---|
| `redesign/evidence/C-21/*.png` (15 files, 24.65 MB) | ⛔ **REFUTED → OWNER-CALL** | Irreproducible; the tracked sibling doc names all 15 files as its evidence trail |
| Class B junk (`.tsbuildinfo` ×2, dev-server logs, `test-results/`) | ✅ **CLEARED** | Genuinely regenerable, zero consumers, `.gitignore` correct |
| `photos-rahma-therapy/` (as a MOVE) | ✅ **CLEARED** | Nothing in the build reads it; 28 dup / 24 unique independently confirmed |
| `brand-logo-assets/` + `rahma-therapy-image-replacements/` | ✅ **CLEARED — and protected** | §G.5 is an explicit, dated, closed Owner ruling |

---

## 2 — ⛔ The C-21 question, answered

**The DELETE-SAFE verdict does not survive.** Downgraded to OWNER-CALL.

**(a) Does the tracked `.md` reference the PNGs?** Yes, by filename. `visual-regression-1280.md`
lists all 15 filenames verbatim in a "Screenshot" column as the named evidence behind each page's
"renders OK" claim. There is **no** `![...]()` embed syntax (`grep '!\['` → no matches), and every
prose conclusion (error counts, DOM measurements, network-request counts) is stated in text. So:
deleting the images breaks no markdown rendering, but turns 15 "here is the screenshot" pointers
into dead citations **inside a document whose entire purpose is visual-regression evidence**.

**(b) Referenced elsewhere?** No. A precise regex for all 15 exact filenames across the tracked
tree matches only the C-21 `.md` itself.

**(c) Genuinely untracked?** Confirmed. `.gitignore:62-65` carries an explicit rule with its own
explanatory comment — a **deliberate, documented decision**, not an accident. A real point in
A2's favour.

**(d) ⛔ Reproducible? NO — and this is the substantive miss.** HEAD is **496 commits** past the
capture commit `38ff24c`. Every captured surface has changed since: `about`, `faqs-aftercare`,
`home`, `layout`, `reviews`, `services` all modified — and `/privacy` and `/cookies`, now live,
**did not exist yet**. A fresh capture would show a different UI, not reproduce this one.
**These 15 PNGs are the only surviving visual record of the site at `38ff24c`.**

⛔ **"Stale as a baseline" and "worthless as a record" are different claims, and the second does
not follow from the first.** The live plan's warning says not to use C-21 as the baseline for a
future privacy/cookies check *because it is incomplete for that purpose* — not that the images
have no historical value.

---

## 3 — `photos-rahma-therapy/`: independent recount

MD5 join (exact multiset per-file match) of all 52 files against **all 90 files under `public/`** —
deliberately the full tree, not just `images/` + `logos/`.

**Result: 28 duplicate / 24 unique — matches A4 exactly.**

⚠️ A first attempt using a `comm`-based shell one-liner returned 27/25 — a line-ending artifact,
caught and discarded by cross-checking with a second method. Reported because a single sample is
not a verdict.

**`homepage-hero-vid.mp4` is genuinely unique** — not a duplicate of the live
`public/videos/homepage-hero-v3.mp4` used by `HomeHero.tsx:23`. Different MD5, different size
(1,143,976 B vs 748,379 B), and the orphan is *newer* (Aug 3 vs Jul 25).

**Build surface: structurally inert.** `next.config.ts` restricts `images.localPatterns` to
`/images/**`; `scripts/gen-image-manifest.mjs` hardcodes `public/images`; `wrangler.jsonc` serves
`.open-next/assets`, derived only from `public/`. The directory sits at repo root, outside
`public/`, so Next's static convention could never serve it regardless of any glob.

✅ **CLEARED as a move — provided all 52 files travel together**, not just the 24 unique ones. The
28 duplicates may still carry separate provenance as distinct camera-roll exports.

---

## 4 — §G.5, verified verbatim

From `redesign/plans/CLEANUP-AND-CONTRAST-plan.md` lines 625-646:

> **G.5 Tracked asset archives — Owner's call** … `rahma-therapy-image-replacements/` (14 files),
> `brand-logo-assets/` (59 files), `design_handoff_area_pages/` (37 files, 6.1 MB…)
>
> ## ⛔ ANSWERED AND CLOSED — Owner decision, 2026-08-13. DO NOT RE-OPEN.
>
> **`rahma-therapy-image-replacements/` and `brand-logo-assets/` are KEPT.** They are the
> business's design source material and stay in the repository. **A future audit must not list
> them as deletion candidates.**

A1's trace is confirmed. Duplicate counts independently re-verified: `brand-logo-assets` **12/59**,
`rahma-therapy-image-replacements` **6/14** — both exact matches.

⚠️ **`design_handoff_area_pages/` is a phantom** — it does not exist in the working tree and
**zero commits have ever touched it** (verified separately). §G.5's third item refers to something
that was never in this repository.

---

## 5 — What Wave 1 got wrong

| Agent | Error |
|---|---|
| **A2** | ⛔ Its stated citation command is **misreported**. `grep -rl "C-21" redesign/ src/ scripts/ e2e/ *.md` returns **53 files**, not "only the tracked .md". `C-21` is a phase ID, not just an image citation. The conclusion survives only when you test the actual PNG filenames |
| **A2** | The C-21 DELETE-SAFE verdict never weighed irreproducibility — the substantive miss |
| **A2** | `raster-exact/` has **16** files, not 17 |
| **A4** | "seven `dji_mimo_*` originals" — there are **8** (of 10 total, 2 are duplicates). The 24 total is still right |
| **A4** | ⛔ Its duplicate check compared against `public/images/` + `public/logos/` (89 files), **not the full `public/` tree** (90, missing `public/videos/`). It didn't change the answer here, but a duplicate hiding in `public/videos/` would have been missed — a real methodology gap |

Everything else held up exactly as reported.

---

## 6 — Confidence

High on candidates 2, 3 and 4 — all re-derived from scratch. Candidate 1 is a genuine judgment
call rather than a clean catch: the facts are certain (narrow citation, irreproducible images,
deliberate ignore rule), but the verdict weighs "sole surviving record of a superseded UI state"
against "explicitly disowned by governance, gitignored by design". Given irreversibility, it was
called REFUTED.

Not checked: no PNG binaries opened; no build/lint/test run; A5's 850-line inbound-reference table
not re-verified, as none of these four candidates depend on it.
