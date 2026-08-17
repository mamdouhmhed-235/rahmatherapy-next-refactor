# HANDOFF — 2026-08-13 (tenth session · SEO/AEO/GEO RELEASE + Phase 11b/12)

> ⛔ **SUPERSEDED 2026-08-17 by `redesign/HANDOFF-2026-08-17-IMPLEMENTATION-10.md` — read that first.**
> **Two parts of this file are now stale:** §1's position table (HEAD is `50a294d`, 10 commits are
> unpushed) and §6.2's "next task is decluttering", which was **completed 2026-08-17**.
> ⚠️ **Everything else here still stands** — the release record, the Owner decisions, the resolved
> questions and the traps. This remains the authoritative record of the SEO/AEO/GEO release.

**⛔ This was the live document for the eleventh session. Read it end to end before touching anything.**
The nine earlier handoffs keep their gotchas and are **not** superseded:

- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — 1-15
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — 16-27
- `HANDOFF-2026-08-12-IMPLEMENTATION-3.md` §5 — 28-41
- `HANDOFF-2026-08-12-IMPLEMENTATION-4.md` §5 — 42-53
- `HANDOFF-2026-08-12-IMPLEMENTATION-5.md` §5 — 54-66
- `HANDOFF-2026-08-13-IMPLEMENTATION-6.md` §5 — 67-79 *(its §1 and §7 are stale; gotcha 78 corrected by 80)*
- `HANDOFF-2026-08-13-IMPLEMENTATION-7.md` §5 — 80-89
- `HANDOFF-2026-08-13-IMPLEMENTATION-8.md` §5 — **90-108** *(its §1 header table is now stale — this file replaces it)*

**This file adds no new gotchas of its own; 105-108 were written into -8 during this session.**

---

## 1 — ⛔ POSITION. Verify with git before trusting anything here.

```
HEAD           563d520   on master
origin/master  0f8ab9d
UNPUSHED       3 commits
working tree   CLEAN (0 changes)
```

⛔ **Never trust a commit count written in a document.** Compute it:
`git rev-list --count origin/master..HEAD`

### 1.1 — ✅ WHAT IS LIVE at rahmatherapy.uk

**SEO/AEO/GEO Phases 0 → 11b are DEPLOYED** (16 commits, `efc7484` → `0f8ab9d`), released 2026-08-13.
Sitemap, robots, canonicals on all 18 indexable URLs, the areas hub linked from the footer, one-hop
root redirect, `en-GB`, one business entity with `@id`+address+`sameAs`, all 31 FAQs server-rendered,
breadcrumbs, therapist `Person` entities, `noindex` on the token page, and the geography fixed **in
the structured data**.

### 1.2 — ⛔ WHAT IS *NOT* LIVE — three unpushed commits

| # | Commit | What | Why it is held |
|---|---|---|---|
| 1 | `3eb2939` | **Phase 12 — removes the maintenance system** | ⛔ **Pushing it OPENS LIVE BOOKINGS** |
| 2 | `9e8d83f` | Phase 13 release record (docs only) | child of #1 |
| 3 | `563d520` | Geography fix in `alt`/`title` (code + guard) | child of #1 |

⛔⛔ **THE SINGLE MOST IMPORTANT FACT IN THIS FILE:**
**#2 and #3 are DESCENDANTS of Phase 12. Git history is linear, so NONE of them can be pushed
without also pushing Phase 12. A bare `git push` OPENS LIVE BOOKINGS.**
There is no way to ship the geography fix or the docs alone. Do not try to cherry-pick around this
without the Owner's explicit instruction.

### 1.3 — Production right now

- The maintenance banner **still shows** on all 18 rendering pages: *"This website is still being
  built — online booking is not yet available."*
- **Bookings are CLOSED** in production.
- The **local** dev site has bookings **OPEN** (Phase 12 is in the working tree) — that is deliberate,
  so the Owner can test.

---

## 2 — ⛔ ABSOLUTE RULES

1. ⛔ **THE SITE IS LIVE.** Push to `master` auto-deploys via Cloudflare (~3 min). No CI, no staging.
   **A push is a production release.**
2. ⛔ **NEVER PUSH WITHOUT AN EXPLICIT, CURRENT OWNER INSTRUCTION.** This session the Owner
   authorised a release, then **interrupted mid-release** to stop the maintenance removal. Treat any
   prior authorisation as spent once the Owner changes course.
3. ⛔ **`git push` right now opens live bookings** (§1.2). Say so out loud before proposing one.
4. ⛔ **Do NOT submit the sitemap in Google Search Console** until Phase 12 is deployed (§6.3).
5. ⛔ **C2 — the Owner's visible page copy must not be reworded.** `seo: { title, description }` are
   metadata (length may change, wording may not). `<h1>` text is frozen.
6. ⛔ **C3 — every absolute site URL must come from `SITE_URL`/`siteUrl()`**
   (`src/content/site/site-url.ts`). `canonical-domain.test.ts` fails on a second literal —
   **comments included** (gotcha 92). ⛔ Nothing at build or push time enforces this; **only
   `npx vitest run` catches it.**
7. ⚠️ **C1 IS RETIRED.** It said "never stage `src/lib/maintenance.ts`". **That file no longer
   exists** (Phase 12 deleted it). It still applies retroactively to the 16 already-pushed commits.
8. ⛔ **The dev server at `localhost:3000` is the Owner's.** Never spawn, restart or kill it. Ask.
9. ⛔ **No migrations, data writes, deploys, package installs or real emails without approval.**
10. ⛔ **Never round-trip a repo file through PowerShell `Get-Content`/`Set-Content`** — it destroys
    UTF-8 (gotcha 93). Use the Edit tool. Write commit messages with the Write tool, then
    `git commit -F <file>`.

---

## 3 — ⛔ GATE BASELINES (all verified green at `563d520`)

```powershell
npx tsc --noEmit                              # 0
npx vitest run                                # 0 failed / 2501 passed (2501), 242 files
pnpm lint                                     # 4 errors / 1 warning, THREE files
npx vitest run scripts/                       # 47 passed
node scripts/measure-admin-contrast.mjs .     # 110 (46 dark / 64 light), 209 unresolved, 153 tokens
node scripts/verify-admin-token-contrast.mjs  # 0
git status --porcelain -- src/ supabase/      # EMPTY
```

**Two baselines changed this session, both legitimately:**

- **vitest 5 failed → 0 failed** (Phase 11b), then **2498 → 2501 passed** (the three `areaLabel`
  guards). ⛔ **The reference is now ZERO failures — any failure is a regression.**
- **`git status` → EMPTY** (G42). It used to be exactly ` M src/lib/maintenance.ts`. That file is
  deleted; a clean tree is now correct, and that line **reappearing** would mean someone restored a
  file that should be gone.

The **lint** 4E/1W in `BookingExperience.tsx`, `BookingExperienceLoader.tsx`,
`returning-customer.ts` are **the baseline — do not "fix" them.**

---

## 4 — ⛔ OWNER DECISIONS. Do not re-ask. Do not re-litigate.

### 4.1 — Made this session (2026-08-13)

| Decision | Ruling |
|---|---|
| **Phase 12 deployment** | ⛔ **LOCAL ONLY, indefinitely.** Removed locally so the Owner can test a banner-free site. **Production deployment happens only after the Owner's full testing passes, on a separate explicit instruction.** |
| **Push scope** | Everything **except** Phase 12 was pushed. The Owner interrupted the planned release to enforce this |
| **Search Console** | ⛔ **Not submitting yet.** Owner will do it themselves, after Phase 12 ships |
| **Lighthouse BP 96 vs 100** | Fold the recheck into the **full site-testing pass**, not a standalone task |
| **Google Business Profile** | ✅ **Already live and connected.** The plan's "not set up / biggest lever" claim was **out of date**. Its *service-area configuration* remains unverified |
| **`knowsLanguage` / languages copy** | ⛔ **CLOSED PERMANENTLY. Do not raise again.** The therapists speak **English**; `knowsLanguage: "en"` on a UK business is zero information |
| **Geography in `alt`/`title`** | **Fix approved and done** (`563d520`) |
| **Release ordering** | Two batches (§14.6.0), then superseded by the Phase-12 hold (§14.6.-1) |
| **a11y `disabled`+`aria-disabled`** | **Leave it.** Noticed, not a defect, not worth changing admin UX |
| **Phase 11 visual re-run after 11b** | **Skipped** — no product code changed |

### 4.2 — Carried forward, still binding

`Review` objects + `aggregateRating` ⛔ **dropped** · area link **footer only**, nav stays at 5 items ·
label **"Areas We Cover"** · title/description **length only** · area taglines **kept** · `/reviews/`
title rewrite **approved** · FAQ server-rendering **approved** · `llms.txt` ⛔ **never** · medical
disclaimer (Owner handles) · tracked design archives **KEEP** · password-reset encryption not on the
roadmap · 1280px hamburger · 25% zoom · raising either id cap · restructuring the therapist read.

### 4.3 — ⛔ HOW THE OWNER WANTS TO BE COMMUNICATED WITH

The Owner **explicitly pushed back on dense, jargon-heavy output.** They asked for things
**"clear and simple, categorised, with full context."** When reporting:

- **Lead with the answer**, then the evidence. Not the reverse.
- **Categorise** — separate "what's done" from "what's open" from "what I need from you".
- **Plain language.** Say "the site tells screen readers the wrong town", not "the accessible layer
  carries a false locality claim".
- When they interrupt or change course, **tell them plainly what it did and did not affect** — they
  asked exactly that and deserved a direct answer, not a wall of detail.

---

## 5 — WHAT HAPPENED THIS SESSION (chronological)

### 5.1 — Documentation corrections (`dc14298`)
Five stale claims in the governing documents, found by testing the documents rather than trusting
them. All were docs + one source comment; **zero behaviour change.**

1. Plan said **"10 FAQ tabs"**; there are **7** (`aftercareTabs` has 0 Q&A — gotcha 103's conflation
   had never reached G30 or §14.2).
2. §14.2 expected **"+1 header nav item"** from Phase 4. The nav was **never touched** — the real
   delta is **+3 footer links**. This mattered because Phase 12 re-runs §14.2.
3. Both governing docs still said the area link was **"chosen as both"** nav and footer,
   contradicting the footer-only ruling. **Annotated in place**, not deleted (house convention).
4. ⛔ **"20" was one number doing three jobs, and two were wrong.** §1.1 listed **21** items under a
   "20" heading — *and* "20" was used to mean "every page". **The footer and the maintenance banner
   each reach 18**, not 20: both render only from `(public)/layout.tsx`; `/` and `/areas/luton/`
   redirect without rendering and `/booking/manage/` is outside the group. Three documents **and a
   committed source comment** asserted "all 20 pages". Now: **21 URLs exist · 20 were probed · 18 are
   indexable**, with §1.1 the single authority. **Gotcha 105.**
5. Handoff header + §18 carried a commit count that was **stale the instant it was written**.
   Replaced with the command that computes it.

Also gitignored `test-results/` and `photos-rahma-therapy/` (55 MB; 28 of its 52 files already exist
byte-identically under `public/images/`, and nothing loads from that path).
⚠️ **Updated 2026-08-17:** `photos-rahma-therapy/` was **moved out of the repo** to
`~/Desktop/rahma-archive-2026-08-17/` — all 52 files, because 24 of them exist nowhere else. The
`.gitignore` rule is retained so it cannot reappear untracked. See
`redesign/plans/DECLUTTER-2026-08-17-plan.md`.

### 5.2 — Phase 11b: the five pre-existing test failures (`0f8ab9d`)
⛔ **All five were STALE TESTS. No product code changed. No assertion was weakened.** Each was
reproduced **in isolation** first, ruling out cross-test pollution.

| # | Test | Diagnosis |
|---|---|---|
| 1-2 | `admin-access.test.ts` — Owner/Admin vs `accountRequests` | **Fixtures contradicted production.** Migration `20260521090000_grant_manage_account_requests_to_owner_admin.sql` grants the permission to Owner **and** Admin; the test fixtures were never updated. Fixed the fixtures; **no assertion touched** |
| 3 | *renders step 1 on first load* | All four step panels stay mounted (CSS + `aria-hidden`), and step 4's `SummaryCard` repeats step 1's title via the same `AdminPanel`. `getByText` matched two nodes. Fixed with `getByRole`, which skips `aria-hidden` — **stronger**, it proves step 1 is the exposed step |
| 4 | *moves focus to the first invalid field* | ⛔ **Guarded unreachable code.** Continue is `disabled={!isStepReady}` and `isStepReady` agrees with `validateStep` everywhere, so the click was inert. Measured: both buttons `disabled=true`, while a direct `.focus()` on `#full_name` **works**. Replaced with a guard on the disabled gate — what actually blocks an invalid step |
| 5 | *shows the consent error…* | ⛔ **Stale AND misnamed — it never tested consent.** It walked steps 1→3 and stopped at "Location". Replaced with a real consent gate: submit stays disabled until `#consent_acknowledged` is ticked |

Four mutants applied, run, restored byte-identically; killing assertions named in plan §14.4.1.

### 5.3 — Phase 12: maintenance removal (`3eb2939`) — **LOCAL ONLY**
⛔ **The plan's FILES list was INCOMPLETE**; following it literally would have shipped a **broken
consent surface**. It missed three files:

- `src/lib/consent/cookie-registry.ts` registered `maintenance-modal-seen`. **`MaintenanceModal` was
  its only writer**, so deleting the modal alone would leave the public `/cookies` page telling
  visitors their browser receives storage nothing sets.
- `registry-completeness.test.ts` asserted that key exists **and** "is not described as inactive" —
  two specs that would have failed (G44).
- `ConsentPreferencesPanel.tsx` cited `MaintenanceModal` as a design precedent — dangling once deleted.

**Verified by measurement:** G43 satisfied — across all 18 routes, phone `07798897222`,
`tel:+447798897222`, email and a WhatsApp link are present with the banner absent
(`SiteFooter` + `SiteHeader` render `contactLinks`). `?booking=1` returns 200 and Phase 3's canonical
still resolves it. `/cookies` correctly lists one fewer entry.

### 5.4 — Phase 13: the release
**Batch 1** — `efc7484`, `9e43e4f`, `9cdb905`, `9114a57` pushed one at a time, each verified.
**Then** — `58386a8`→`0f8ab9d` (12 commits) as one deploy.
**Withheld** — Phase 12, by the Owner's mid-release instruction.

⛔ **A contradiction in §14.6 was found and had to be resolved before Phase 12 could be written:**
step 2 said "push one phase per deploy in order"; step 3/G45 said "Phase 12 must be live before
Phase 2's discovery work". **Phase 2 is commit #5 and Phase 12 is #17 — git pushes are linear, so
both could not hold.** Resolved as two batches (§14.6.0), then superseded entirely when the Owner
held Phase 12 back (§14.6.-1).

**Release verification** (plan §18.5): sitemap 200 with 18 trailing-slashed `<loc>` and no
`priority`/`changefreq`; robots carries our `Sitemap:` line with `/admin` and `/booking/manage`
correctly **not** disallowed; all 18 URLs 200 / zero redirects / self-canonical; `/` 2 hops → 1;
`en-GB`; one `<h1>` on each legal page; `/home/` links to `/areas/` for the first time; absolute
`@id` + `PostalAddress`; **zero** `aggregateRating`; **31** FAQ questions in served HTML (was 4);
zero `"Luton, Luton"` in JSON-LD.

### 5.5 — Geography in `alt`/`title` (`563d520`) — **LOCAL ONLY**
Phase 1b was **incomplete**: it fixed the JSON-LD but not `AreaFinalCTA.tsx:13` (`alt`) and
`AreaMap.tsx:36` (`title`). Production **still serves** *"Map of Luton, Luton"*,
*"Map of Dunstable, Luton"*, *"Map of Houghton Regis, Luton"* to screen readers and as image alt.
Fixed locally with one helper, `areaLabel()`, beside `AreaPlaceType` — only a `district` keeps the
suffix. Guarded by `src/content/pages/__tests__/area-label.test.ts` (reads the real data, so new
areas are covered automatically) and mutation-tested.

---

## 6 — ⛔ OPEN ITEMS

### 6.1 — Blocking, Owner-side
**The Owner's full site testing.** Bookings are open locally for exactly this. When it passes:
1. Push `563d520` (carries Phase 12 + the docs + the geography fix — **this opens bookings**).
2. Verify the banner is gone from all 18 routes and `?booking=1` works.
3. **Then** Search Console.

### 6.2 — ⛔ THE NEXT TASK THE OWNER WANTS
**Removal and decluttering of the entire directory.** ⛔ **The Owner will specify the scope
themselves — do not start, and do not guess at what should be deleted.** Note that `redesign/`
contains 14 handoffs, many plans and evidence directories, and `photos-rahma-therapy/` (55 MB,
gitignored) sits at the repo root. ⛔ **Some archives are explicitly KEEP** (§4.2). Ask first.

### 6.3 — Deferred / unverified
- **Search Console** — not submitted, deliberately. It is the step that actually invites indexing.
  ⚠️ With discovery live while the banner still ships, this is the **only** thing holding back a full
  crawl of the "not ready" version. Google may still find the sitemap passively via `robots.txt` —
  **the residual risk the Owner accepted, and it grows the longer Phase 12 is held.**
- **Lighthouse Best Practices 96 vs 100** — fold into the full testing pass. The `errors-in-console`
  item was self-inflicted 429s on Sentry's `/monitoring` tunnel; the pacing gradient is the
  diagnostic (gotcha 100).
- **Google Business Profile service-area configuration** — profile is live; whether it is set as a
  service-area business (address removed, areas by city/postcode not radius) is **unverified**.
- **Rich Results Test** — never run; Google served bot-detection to the automated browser and
  **bypassing a CAPTCHA is off-limits**. ✅ The question it would have answered is already settled
  (§7).
- **Bedford** has a booking but no area page. Owner conversation, not a defect.
- **Google Maps ToS on 89 reviews** — dormant; only matters if `Review` objects are revisited.
- **Band C ITEM M / A2** — still gated on a multi-participant dedup test.

---

## 7 — ⛔ RESOLVED THIS SESSION. Do not re-investigate.

| Question | Answer |
|---|---|
| **Is the locality-only `PostalAddress` valid?** | ✅ **YES. No code change; the `Organization` fallback is NOT needed.** Google's LocalBusiness doc requires exactly **`name` and `address`** and requires **no `PostalAddress` sub-properties** — `streetAddress` is illustrative, under *"include as many properties as possible"*. The **Schema Markup Validator returned 0 ERRORS, 0 WARNINGS** on the exact entity |
| **Does `/admin/signout` need `X-Robots-Tag`?** | ✅ **NO.** It exports **`POST` only**, so a crawler's GET returns **405** — measured live, same as the `/api/*` routes. Google cannot index a 405 |
| **Does Cloudflare prepend to robots.txt?** | ⛔ **NO — G8 was WRONG.** The served file is **exactly our 6 lines**. Once `robots.ts` exists the app route wins outright and the managed Content-Signals file is gone |
| **Which pages does the footer/banner reach?** | **18**, not 20 (§5.1 item 4) |
| **How many FAQ categories?** | **7** (31 questions). The other 3 ids are `aftercareTabs`, a different export with 0 Q&A |

---

## 8 — ⛔ TRAPS THAT COST TIME THIS SESSION

Full text in `HANDOFF-...-8.md` §5, gotchas **105-108**. The four that will bite again:

1. **⛔ 106 — A single post-deploy sample can read a stale edge response, and it lied about the most
   safety-critical check.** Production sends `Cache-Control: s-maxage=31536000`. Seconds after
   Phase 1 deployed, one request showed `noindex` **present** and the next showed it **absent** —
   different Cloudflare PoPs. Sampled 8×: **8/8 present**. **Never accept one sample as the verdict.
   Sample ≥3 and read the actual tag, not a grep count.**
2. **⛔ 108 — `git checkout --` to undo a mutant destroys uncommitted work in the same file.** It
   restores to **HEAD**, not to your working copy. Mutation-testing `areaPages.ts` while the new
   `areaLabel` helper sat in it uncommitted reverted **both**, leaving two components importing a
   missing export — **every local page went to HTTP 500, including `/home/`, which was never
   touched**. `tsc` had passed *before* the restore, so the green gate was stale.
   **Back up the working copy and restore from that, or commit first. Re-run checks after a restore.**
3. **⚠️ 98 / 96 — Verify the negative before reporting it; scope the search to the layer you changed.**
   This cost **three** false alarms in one session: `07798 897222` spaced vs `07798897222` unspaced;
   `tel:` href is the **international** `+447798897222`; and a *"maintenance"* hit on
   `/areas/leagrave/` that was a **customer testimonial** — *"an essential part of body maintenance"*.
4. **⛔ 93 — never round-trip a repo file through PowerShell.** Use the Edit tool. It preserves CRLF
   and UTF-8; verified this session (every special-character count went **up or level, never down**).

**Also worth knowing:** every file in `redesign/` and `src/` here is **CRLF**. Multi-line Edit
anchors work fine, but **assert your anchor occurs exactly once** before mutating (gotcha 94).

---

## 9 — Standing facts

- **Business reality governs effort.** ~15 bookings, 6 bookable therapists, four cities.
  ⛔ **The Owner has explicitly said not to over-engineer.** "Leave it, here is why" is a valid answer.
- **Commit messages**: PowerShell here-strings strip double quotes → always
  `git commit -F <file>`, and **write that file with the Write tool**.
- **E2E credentials** exist in `.env`; Playwright skips unless `E2E_BASE_URL` is set, and e2e is
  **excluded from `npx vitest run`**.
- **`next.config.ts`**: `trailingSlash: true` (line 43) and Sentry `tunnelRoute: "/monitoring"`.
- **Structured data is not a citation driver.** Budget **zero** ranking or AI-citation gain from it.
  The evidenced levers are **server-rendered HTML** and **off-site presence** (the Business Profile).
- **The largest lever for the stated goal is the Google Business Profile, and it is not in this
  repository** — and it is already live.
