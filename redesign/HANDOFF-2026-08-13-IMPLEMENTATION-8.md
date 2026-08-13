# HANDOFF — 2026-08-13 (ninth session · SEO/AEO/GEO implementation)

**Read this file first, end to end.** The eight earlier handoffs keep their gotchas and are **not**
superseded:

- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — 1-15
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — 16-27
- `HANDOFF-2026-08-12-IMPLEMENTATION-3.md` §5 — 28-41
- `HANDOFF-2026-08-12-IMPLEMENTATION-4.md` §5 — 42-53
- `HANDOFF-2026-08-12-IMPLEMENTATION-5.md` §5 — 54-66
- `HANDOFF-2026-08-13-IMPLEMENTATION-6.md` §5 — 67-79 *(its §1 and §7 are stale; gotcha 78 corrected by 80)*
- `HANDOFF-2026-08-13-IMPLEMENTATION-7.md` §5 — 80-89

**This file adds gotchas 90-105.**

| | |
|---|---|
| **HEAD** | `master` — ⛔ **UNPUSHED.** `origin/master` is still `9271863`. ⛔ **Never trust a commit count written here** (this row said `1970ede` / 13, stale by its own commit). **Compute it:** `git rev-list --count origin/master..HEAD` |
| **Deployed** | ⛔ **NOTHING.** Cloudflare deploys on **push**. Production is untouched |
| **Shipped locally** | SEO/AEO/GEO Phases 0-11 (see `redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md` §18) |
| **Next** | Phase 11b → 12 → 13. **Do not push anything without an explicit Owner instruction** |

---

## 0 — ⛔ THE TWO DOCUMENTS THAT GOVERN THIS WORK

1. **`redesign/plans/SEO-AEO-GEO-2026-08-13-plan.md`** — the spec. Every decision + the evidence.
2. **`redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md`** — the phased execution order, 49 named
   gotchas, and **§18, the progress log**. Read §18 before doing anything.

**Read both before touching a single file.** They were rewritten twice after research overturned
most of an earlier draft, and they carry corrections you will otherwise re-make from scratch.

---

## 1 — ⛔ GATE BASELINES. TWO CHANGED. Use these.

```powershell
npx tsc --noEmit                              # 0
npx vitest run                                # 0 failed / 2498 passed (2498)  <-- Phase 11b took it to ZERO
pnpm lint                                     # 4 errors / 1 warning, THREE files
npx vitest run scripts/                       # 47 passed
node scripts/measure-admin-contrast.mjs .     # 110 (46 dark / 64 light), 209 unresolved, 153 tokens
node scripts/verify-admin-token-contrast.mjs  # 0
git status --porcelain -- src/ supabase/      # exactly:  M src/lib/maintenance.ts
```

The suite grew **2460 → 2498** by exactly the **38 guards** this workstream added (12 sitemap/robots
+ 21 canonicals + 5 FAQ).

✅ **Phase 11b is DONE and the five failures are gone.** All five were **stale tests** — no product
code changed and no assertion was weakened. The total stayed **2498**: three specs were rewritten in
place, none added or removed. Full diagnosis in plan §14.4.1. ⛔ **The reference is now ZERO, not
five — any failure from here on is a regression.**

---

## 2 — ⛔ ABSOLUTE RULES (unchanged, and one is now sharper)

- ⛔ **THE SITE IS LIVE** at rahmatherapy.uk. Push to `master` **auto-deploys** via Cloudflare. No
  CI, no staging. **A push is a production release.**
- ⛔ **LOCAL FIRST — the Owner's standing instruction.** Commit to `master`, **never push** until
  the Owner explicitly says go, after Phase 12. `git push` appears nowhere in the plan before
  Phase 13.
- ⛔ **MAINTENANCE MODE IS ON, and it is TWO hazards:**
  1. `src/lib/maintenance.ts` is working-copy `false`, HEAD `true`, deliberately uncommitted.
     **Committing it would OPEN LIVE BOOKINGS.** Never stage it. Stage by explicit path only —
     never `.` / `-A` / `-u`, **and never `git commit -a` or `-am`** (gotcha 90).
  2. **It is also a page-content state.** `MaintenanceBanner` is a **server** component, so the
     served HTML of every public page contains *"This website is still being built — online booking
     is not yet available."* (gotcha 91).
- ⛔ **Verify the flag in each COMMITTED TREE before any push:** `git show <sha>:src/lib/maintenance.ts`.
- ⛔ **C2 — the Owner's visible page copy must not be reworded.** `seo: { title, description }` are
  metadata: **length may change, wording and tone may not.** `<h1>` text is frozen.
- ⛔ **C3 — every absolute site URL must come from `SITE_URL`/`siteUrl()`.** `canonical-domain.test.ts`
  fails on a second literal — **comments included** (gotcha 92).
- ⛔ **The dev server is the Owner's**, at `localhost:3000`. Never spawn, restart or kill it. Ask
  them to restart it if you need that.
- ⛔ **No migrations, data writes, deploys, package installs or real emails without approval.**

---

## 3 — ⛔ OWNER DECISIONS MADE THIS SESSION. Do not re-ask.

| Decision | Answer |
|---|---|
| The §0.2 "SEO declined" entry | ⛔ **REVERSED 2026-08-13.** Annotated in place in `POST-BAND-C-FOLLOWUP-plan.md` |
| Workflow | **Local first.** Commit to `master`, no push until told |
| Release | **Push phase by phase**, verifying between — not one big push |
| Local verification | `pnpm preview` **approved**, on a port that is **NOT 3000** |
| `Review` objects / `aggregateRating` | ⛔ **DROPPED.** `sameAs` to the Google listing instead |
| Area link placement | **Footer only.** ⛔ The nav stays at its designed 5 items |
| Nav/footer label | **"Areas We Cover"** |
| Title/description edits | **Length only**, wording and tone preserved |
| Area page taglines | **KEEP** them ("At-Home Recovery" etc.), even though 4 titles stay 63-71 |
| `/reviews/` title | **Rewrite approved** — was 29 chars with no keyword |
| FAQ server-rendering | **Approved** — render all, hide with CSS |
| FAQ / review schema | **Ship** on the Owner's rule: cheap + no penalty + plausibly helps machines |
| `llms.txt` | ⛔ **Never.** 97% of published files get zero requests |
| Maintenance removal | **Its own phase, at the very end, before release** — Phase 12 |
| The 5 failing tests | **Fix before deployment** — Phase 11b |

**Still carried forward from earlier sessions, all closed:** medical disclaimer (Owner handles
personally) · tracked design archives (KEEP) · password-reset encryption (not on the roadmap) ·
1280px hamburger · 25% zoom · raising either id cap · restructuring the therapist read.

---

## 4 — ⛔ MEASURED FACTS. Do not re-derive.

### 4.1 — What the site actually is
**21** public URLs: 8 single-route + 5 package + 5 area spokes, plus `/` (308 → `/home/`),
`/areas/luton/` (308 → `/areas/`) and `/booking/manage`. **18 are indexable.**

⛔ **Corrected 2026-08-13: this said "20 public URLs" above a list of 21.** Three counts, not one:
**21** URLs exist · **20** were probed in the Phase 0/11 baselines (`/areas/luton/` excluded — it
308s and renders nothing to capture) · **18** are indexable. **18 is also the reach of the footer and
of the maintenance banner**, both of which render only from `(public)/layout.tsx`. See plan §1.1 and
gotcha 105.

**Bury Park, Leagrave and Stopsley are districts of Luton. Dunstable and Houghton Regis are separate
towns in Central Bedfordshire.** The Owner's visible titles always got this right; only the
structured data was wrong, and Phase 1b fixed it.

### 4.2 — Crawler reality (measured live, 2026-08-13)
- **All AI crawlers reach the site.** GPTBot, ClaudeBot, PerplexityBot, Google-Extended, bingbot and
  Googlebot each returned **200**. Nothing is blocked.
- Production `/robots.txt` returns **200** — Cloudflare's managed Content Signals file, ~24 lines,
  **every one a comment**, no directives, no `Sitemap:`.
- Production `/sitemap.xml` was a **hard 404** before this work.
- Production `/` is still a **2-hop** redirect; the 1-hop fix is committed but unpushed.

### 4.3 — Core Web Vitals: measured and closed
LCP **482 ms** · CLS **0.00** · TTFB 298 ms. Lighthouse mobile A11y/SEO/Agentic **100**.
**No CrUX field data exists** — too few real visitors, which is a symptom of the discovery problem
this work fixes, not a performance problem.

### 4.4 — The evidence that actually mattered
- Structured data is **not** a citation driver. Google: *"there's no special schema.org structured
  data that you need to add."* A controlled study of 1,885 pages measured the effect of adding
  JSON-LD on AI citations at **approximately zero**. **Budget zero ranking gain from all of it.**
- What IS evidenced: **content present in the server-rendered HTML** (no major AI crawler except
  Googlebot runs JavaScript), and **off-site presence** — Google Business Profile above all.
- **FAQ rich results were removed from Google Search on 2026-05-07**, docs deleted 2026-06-15, GSC
  API removed August 2026. This site was already ineligible from 2023-09-14.
- **Self-serving review markup** has never rendered since 2019, and two current guidelines forbid
  editor-curated ratings.

---

## 5 — NEW GOTCHAS (90-105). Each cost real time.

90. **⛔ `git commit -a`/`-am` IS THE MAINTENANCE-FLAG HAZARD.** The old rule named `.`/`-A`/`-u`
    and stopped there. `commit -am` stages every tracked modified file — which in this repo is
    **precisely and only `src/lib/maintenance.ts`**. The list must be exhaustive or it is a trap.

91. **⛔ THE MAINTENANCE FLAG IS ALSO A PAGE-CONTENT STATE, NOT JUST A STAGING HAZARD.** I twice
    told the Owner "crawlers see no maintenance text" — **wrong both times.** My check searched for
    the word *"maintenance"*, which appears **0 times**. The banner says *"This website is still
    being built — online booking is not yet available."* `MaintenanceBanner` is a **server**
    component. **Search for the actual string, not the concept name.**

92. **⛔ THE CANONICAL-DOMAIN TEST SCANS COMMENTS TOO.** I wrote a comment in `robots.ts` *warning
    against hard-coding the origin* — and hard-coded it in the warning. The suite went to 6
    failures. Nothing at build or push time enforces this; **only `npx vitest run` catches it.**

93. **⛔ POWERSHELL `Get-Content -Raw` + `Set-Content` DESTROYS UTF-8 FILES.** A one-line baseline
    edit to a plan file turned **235 em dashes into 2**, destroyed all **71 ⛔ markers** and added a
    BOM. The tell was the diffstat: 400 insertions / 289 deletions for a one-line change.
    **Never round-trip a repo file through PowerShell. Use the Edit tool.** Same root cause put a
    BOM in a commit message earlier the same session (`Out-File -Encoding utf8`).

94. **⛔ MULTI-LINE ANCHORS MISS IN CRLF FILES.** This repo is mixed CRLF/LF. Any multi-line
    find/replace must normalise: `find.replace(/\n/g, eol)` where `eol` is detected from the file.
    Single-line anchors sidestep it entirely. Every mutation script here asserts the anchor occurs
    **exactly once** and refuses otherwise — that refusal caught two ambiguous anchors that would
    have silently hit the wrong occurrence.

95. **⛔ NEVER RETYPE OWNER COPY. REPLACE FRAGMENTS.** The descriptions carry `£` and curly
    apostrophes. Phase 6 changed 24 strings by replacing only the *changed fragment* — e.g.
    `"Explore Rahma Therapy"` → `"Rahma Therapy"`, leaving the `’s` after it physically untouched.
    Verified after: £ 46/46, ’ 7/7, — 114/114, zero mojibake.

96. **⚠️ A CRUDE GREP OVER A WHOLE PAGE WILL FLAG OWNER COPY AS A BUG.** Checking the geography fix,
    I found **74** hits of `"<name>, Luton"` and nearly reported failure. They were in **visible
    prose**, where "Bury Park, Luton" is correct. Scoped to JSON-LD: 3, all in `description`, all
    legitimate. **Scope the search to the layer you changed.**

97. **⛔ THE DEV SERVER CAN CORRUPT ITS OWN GENERATED TYPES AND BREAK `tsc`.**
    `.next/dev/types/routes.d.ts` was written mid-session with a truncated line, and
    `next-env.d.ts` **imports** it — so `exclude` cannot drop it and `tsc` fails on source that is
    perfectly fine. Fix: have the Owner restart the dev server, or delete the file (gitignored,
    regenerable) while it is stopped.

98. **⚠️ A "MISSING" ITEM IS OFTEN THE MATCHER, NOT THE PAGE.** Two separate false alarms:
    "1 FAQ missing" (my needle stripped an apostrophe the HTML kept), and "the non-dev routes.d.ts
    is corrupted too" (the pattern matched a legitimate doc-comment line). Both dissolved on a
    proper check. **Verify the negative before reporting it.**

99. **⛔ READING THE DOM SYNCHRONOUSLY AFTER `.click()` READS THE PREVIOUS STATE.** My first FAQ tab
    check reported **6 of 7 tabs broken**. React had not flushed. A 120 ms wait between click and
    assertion → all 7 pass. **The page was never wrong.**

100. **⛔ AN AUTOMATED SWEEP TRIPS RATE LIMITS AND THE 429s LOOK LIKE PAGE DEFECTS.** 40 rapid page
     loads produced a console error on *every* page; paced at 1.5 s, 4 pages; a single isolated
     load, **zero**. The resource was Sentry's `/monitoring` tunnel. That gradient is the
     diagnostic. It also costs 4 Lighthouse Best-Practices points via `errors-in-console`.

101. **⛔ `@id` RESOLVES WITHIN A PAGE ONLY, AND A DANGLING REFERENCE VALIDATES SILENTLY.** Google
     documents them as *"in-page node identifiers"*. Every page must emit the business node **in
     full**. Use the **absolute** form — a bare `#business` is a relative IRI and resolves against
     the document, naming a *different* entity per page.

102. **⛔ NORMALISE FACTS AND ADD THE `@id` IN THE SAME COMMIT.** RDF merge is additive. Giving
     conflicting nodes a shared identifier *first* fuses the contradictions into one entity
     asserting both phone numbers — strictly worse than doing nothing.

103. **⚠️ COUNTING `label:` OCCURRENCES CONFLATED TWO EXPORTS.** I reported "10 FAQ categories" for
     three phases. There are **7** in `faqCategories`; the other three `label:` hits belong to
     `aftercareTabs`, a different export rendered by a different component with **zero** Q&A pairs.
     Pulling those into FAQ markup would have marked up content that is not Q&A.

104. **⚠️ MATCH LOCAL STYLE EVEN WHEN IT IS ARBITRARY.** I inserted `alternates` as the *first* key;
     all four pre-existing files put it **last**. Fixed by script rather than retyping, because
     the surrounding strings carry encoding hazards (gotcha 95).

105. **⛔ ONE NUMBER WAS DOING THREE JOBS, AND TWO OF THEM WERE WRONG.** "20" was written as the
     total URL count, as the probed-route count, *and* as a synonym for "every page". Those are
     **21**, **20** and **18**. The footer and the maintenance banner both render only from
     `(public)/layout.tsx`, so each reaches **18** — `/` and `/areas/luton/` `permanentRedirect`
     without rendering, and `/booking/manage/` sits outside the route group. Three documents *and a
     committed source comment* asserted "all 20 pages". **When a count is used to mean "everything",
     name the set it counts.** Fixed 2026-08-13; plan §1.1 is now the single authority.

---

## 6 — Method that worked, and is worth repeating

**Teeth-check every guard, and name the killer.** 12 mutants across three guard files, each applied,
run, restored **byte-identically**, with the failing assertion named. Two mutants were *refused*
because the anchor did not occur exactly once — that refusal is the safety feature.

**Diff the machine-readable layer against the visible layer.** Almost every real defect this session
lived in the gap between them: the geography bug, the conflicting business nodes, the 27 invisible
FAQs. The Owner's visible copy was right in every single case.

**Prove a negative with a gradient, not an assertion.** The 429 was settled by showing the error
rate scaled with request pacing and vanished on an isolated load.

**Verify the counterpart of an expected change.** Phase 5's `<h2>`→`<h1>` was proved safe not by the
h1 appearing but by the **totals being unchanged** — privacy 1→1, cookies 4→4. Nothing was inserted.

**Measure the platform, not the comment.** Every number in §4 came from a live request or a script,
not from a doc or a memory.

---

## 7 — ⛔ WHAT IS LEFT

### 7.1 — ✅ Phase 11b: DONE 2026-08-13
Plan §14.4.1 carries the full diagnosis. **All five were stale tests** — no `src/` product code was
changed and no assertion was weakened. Each was reproduced *in isolation* first, which ruled out
cross-test pollution. Headlines worth carrying forward:

- The two permission failures were a **fixture** that contradicted production: migration
  `20260521090000` grants `manage_account_requests` to Owner and Admin, and the test never knew.
- ⛔ **The "consent" test never tested consent.** It walked steps 1→3 and stopped — the requirement
  it was credited with guarding was not guarded at all. It now genuinely is.
- ⛔ **The focus test guarded unreachable code.** Continue is `disabled` exactly when the step is
  invalid, so the click was inert. Guard the gate that actually blocks, not the branch behind it.

Gate baseline updated to **0 failed** in the same commit (G47).

### 7.2 — Phase 12: remove the maintenance system
Plan §14.5. ⛔ **THIS OPENS LIVE BOOKINGS.** It needs its **own explicit Owner instruction** —
approval of the SEO plan is **not** approval of this. It also legitimately changes the `git status`
gate (the file is deleted), and requires re-capturing the visual baseline, since the banner
disappears from all **18 rendering** pages (§4.1).

### 7.3 — Phase 13: release
Plan §14.6. **Push phase by phase**, verifying between. ⛔ Phase 12 must be pushed **before** the
discovery work goes live, so no crawler meets the banner. ⛔ Submit the sitemap in Search Console
**last** — that is the step that actually invites indexing.

### 7.4 — Owner-side, worth more than the whole repo
1. **Google Business Profile** as a service-area business — address removed, service areas by
   city/postcode, within the 20-area cap. ⭐ **On the evidence, this outranks everything here.**
2. **Google Search Console** — verify, submit the sitemap, get a baseline. Not analytics; does not
   conflict with the deliberate `no-google-analytics` decision.

### 7.5 — Open, optional, never answered
- One line of visible copy naming the therapists' languages (would unlock `knowsLanguage`).
- Whether reproducing 89 Google reviews verbatim is cleared under Google Maps' terms — only matters
  if `Review` objects are ever revisited.
- **Bedford** has a booking but no area page. Owner conversation, not a defect.

---

## 8 — Standing facts (restated so this file stands alone)

- **Commit messages**: PowerShell here-strings strip double quotes → always `git commit -F <file>`,
  and **write that file with the Write tool**, not `Out-File` (gotcha 93).
- **E2E credentials** exist in `.env`; Playwright skips unless `E2E_BASE_URL` is set, and e2e is
  **excluded from `npx vitest run`**.
- **Playwright browsers**: the repo's Playwright wants a revision that is not cached. Launch with
  `executablePath` at `ms-playwright/chromium-1234/chrome-win64/chrome.exe`, or `channel: "chrome"`.
  A script outside the repo must resolve Playwright via `createRequire` pointed at the repo.
- **`next.config.ts`**: `trailingSlash: true` (line 43) and Sentry `tunnelRoute: "/monitoring"`.
- **Business reality that should govern effort**: 15 bookings, 6 bookable therapists, four cities.
  **The Owner has explicitly said not to over-engineer.**
