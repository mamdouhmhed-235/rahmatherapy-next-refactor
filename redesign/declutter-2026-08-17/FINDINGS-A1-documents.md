# FINDINGS A1 — `redesign/` loose files + `redesign/plans/`

**Territory:** 85 files directly inside `redesign/` (maxdepth 1) + 49 under `redesign/plans/`
(incl. `B-phase/`, `C-phase/`)
**Date:** 2026-08-17 · **134 files, ~5.55 MiB · all Class A** (`git status --porcelain -- redesign/`
is empty). No Class B risk in this territory. Read-only throughout.

| Verdict | Count |
|---|---|
| KEEP-CITED | 93 |
| KEEP-MEMORY | 24 |
| KEEP-GOVERNING | 7 |
| OWNER-CALL | 5 |
| DELETE-SAFE | 4 |
| KEEP-LIVE | 1 |

⛔ **Reclaimable: ~44.6 KB of 5.55 MiB (0.8%).**

---

## 1 — The headline: this is a citation web, not a pile of files

Dozens of apparently "spent" Phase 6/7/Band-B/Band-C documents are cited **by name** from agent
A3's territory (`per-page-recipes/`, `briefs/`, `per-page-progress/`):

| File | Inbound citations |
|---|---|
| `plans/C-phase/C-C-EXECUTION-PROTOCOL.md` | **93** (incl. live SQL migration comments and `AGENTS.md`) |
| `PER-PAGE-SCORES.md` (447 KB) | 57 |
| `RECON.md` | 48 (incl. governing `PRODUCT.md` / `DESIGN.md`) |
| `IMPLEMENTATION-PLAN.md` | 42 |
| `phase6-admin-workflow-guide.html` (948 KB) | 34 |
| `impeccable-v5-latest-stable.html` (738 KB) | 32 |

The two HTML files alone are 1.69 MiB — 29% of the territory — and both are heavily
cross-referenced. **Almost nothing here is deletable in isolation without creating dangling
pointers outside this territory.**

---

## 2 — ⛔ Two findings that change the standing rules

### 2a — `AGENTS.md` binds three more never-delete files

Not on the original governing-documents list, but protected by the binding agent-instructions file:

- `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` — *"Read… end to end… before any action"*.
  Also the single most-cited file in the territory (93 hits, including live SQL migration comments).
- `redesign/plans/C-phase/C-C-SINGLE-AGENT-ADDENDUM.md` — binding conditionally.
- `redesign/plans/C-phase/C-B-DECISIONS.md` — explicitly *"never touch"*, same clause as the
  live-customer-data protections.

**Recommendation: add these three to the governing-documents list** alongside HANDOFF-9 and the two
SEO-AEO-GEO plans.

⚠️ Note the interaction with A4's finding: `AGENTS.md` *also* cites `C-B-DECISIONS.md` in a way A4
read as a broken reference. The file exists at `redesign/plans/C-phase/C-B-DECISIONS.md`; the
citation is by bare filename, which is why a path-based check missed it.

### 2b — The "tracked design archives are KEEP" ruling points **outside** `redesign/`

Traced to its source: `redesign/plans/CLEANUP-AND-CONTRAST-plan.md` §G.5, which names
`rahma-therapy-image-replacements/` (14 files) and `brand-logo-assets/` (59 files) — **both
repo-root directories**, i.e. A4's territory, not the screenshot archives.

⛔ **The ruling has been applied more broadly than its source supports.** It should be read as
protecting those two asset directories specifically — which independently matches A4's finding that
`brand-logo-assets/` is 80% unique and unabsorbed.

---

## 3 — High-confidence deletions (proof: isolated `grep -rl` per filename, zero hits repo-wide)

| path | size | why safe |
|---|---|---|
| `subagent-chunk1-instructions.md` | 13,177 B | One-off worktree-subagent test instructions; the outcome is recorded in the kept `PHASE6-AUTONOMOUS-AGENT-PLAN.md` |
| `DEFERRALS-SUMMARY.md` | 10,987 B | Regenerable aggregate of A3's still-present `per-page-deferrals/*` |
| `plans/C-phase/C-C-RESUME-2026-07-31.md` | 3,265 B | One-off `/goal`-overflow companion for a single session; self-describes as superseded by git |
| `HANDOFF-2026-08-04-ADVISOR-SEAT.md` | 13,559 B | Zero citations — but flagged OWNER-CALL, not a firm delete (see §5) |

---

## 4 — Do not delete (looked deletable, isn't)

- ⛔ **`PHASE-7-THEME-RECOLOR.md`** (7,547 B, **zero citations**) — documents the rationale for the
  admin's *live* brand colours (Therapy Blue `#0f5e8e`, Brand Orange `#f7931e`) still in
  `tokens.css` today. **Exactly the "superseded plan whose reasoning was never copied forward"
  trap.** KEEP-MEMORY despite zero inbound references.
- **`C-B-DECISIONS.md`** — looks like a spent decisions log; is on `AGENTS.md`'s protected list.
- **The five largest files** (`RECON.md`, `IMPLEMENTATION-PLAN.md`, both HTML files,
  `PER-PAGE-SCORES.md` — 2.19 MiB, 39% of the territory) — all cited 30+ times.
- ⛔ **Six of the 22 shipped C-xx plans** (`C-01`, `C-02`, `C-04a`, `C-06`, `C-08`, `C-14`) are
  cited by path **inside production Supabase migration SQL comments**. Deleting them leaves dangling
  pointers in the live database's migration history.

---

## 5 — Consolidation candidates (need A3 + Owner; not independently executable)

1. The 9 gotcha-carrying handoffs (§5 sections only, ~196 KB) → one `GOTCHAS-1-108.md`.
2. The 5 pre-chain handoffs (Band A/B/C-A/C-B closure narratives, 264 KB) → one history document.
3. 22 C-xx plans + master plan + migration ledger (~1.05 MiB — the largest opportunity, but six are
   SQL-cited and must not move).
4. `BASELINE-*` / `FINAL-*` pairs → one before/after comparison.
5. `ADAPT` / `ONBOARD` / `POLISH` / `CLARIFY` / `HARDEN-PASS` → one "Phase 7 Gate Log".

---

## 6 — Uncertain / Owner-call

- ⛔ **`redesign/test-credentials.md` — SECURITY.** Four accounts are clearly synthetic
  (`.example.test`). The fifth (Owner / Main-Admin) uses **`rahmatherapy@outlook.com`** — the real
  published business mailbox — with a plaintext password. The file asserts this is "the seeded test
  owner credential and is safe to use in dev"; **that claim is unverified.** In git since
  **2026-05-15** and on the public remote. It is cited by 34 files, so it should **not** simply be
  deleted — but the credential needs rotating regardless. See the cross-cutting security note in
  the declutter plan.
- `HANDOFF-2026-08-04-ADVISOR-SEAT.md` — zero citations, but may hold unique process rationale (the
  `/goal` 4,000-char cap, the resume-file pattern). Recommend a human skim first.
- Both `.html` "explained in plain English" files — near-zero machine citation because they are
  Owner-facing reading, not cross-referenced docs. Judgment call.
- `SAFETY-NET.md` — cited 31 times, but almost certainly boilerplate reading-list inclusion; its
  content (a git-rollback note predating the redesign branch) has no remaining operational value.
  Fold into a consolidation rather than delete — breaking 31 citations for negligible gain.
