# SEO / AEO / GEO — implementation plan (the HOW)

**Companion:** `redesign/plans/SEO-AEO-GEO-2026-08-13-plan.md` — the spec, holding every decision and
the evidence behind it. **Read it before Phase 1.** This document is the execution order.
**Base commit for all anchors:** `9271863` on `master`.
**Status:** not started. No `src/` file has been changed.

---

## 0 — How to use this document

### ⛔ 0.0 — LOCAL FIRST. Nothing is pushed until the Owner says so.

**Owner decision, 2026-08-13.** This is the governing workflow rule and it changes how every stop
gate works.

| | |
|---|---|
| **Commit** | ✅ Yes — to `master`, locally, one commit per phase |
| **Push** | ⛔ **NO.** Not until the Owner explicitly says go, after Phase 12 |
| **Why it is safe** | Cloudflare deploys on **push**, not commit. Local commits reach nobody |
| **Verification** | Local. `pnpm preview` (OpenNext build + local preview) — ✅ **Owner-approved**, **on a port that is NOT 3000** |
| **Release** | Phase-by-phase pushes with verification between — see Phase 13 |

⛔ **The dev server at `localhost:3000` is the Owner's. Never spawn, restart or kill it.** The preview
build must bind elsewhere.

⛔ **`git push` is not in this document until Phase 13.** If you find yourself typing it before then,
stop.

**Consequence for stop gates:** where a phase's VERIFY says `curl https://rahmatherapy.uk/...`, that
is a **Phase 13 release check**, not a per-phase gate. The per-phase gate is the local build,
the local preview, and the §2.1 gates.

### 0.1 — ⛔ ONE PHASE AT A TIME. This is not negotiable.

Every phase ends with a **STOP GATE**. You may not begin the next phase until the current phase's
gate passes *and* the Owner has said go.

**Why this rule exists:** a push to `master` **auto-deploys to production** via Cloudflare. There is
no CI and no staging. If four phases ship together and something breaks, the diff you must bisect is
four phases wide, on a live site, with no rollback environment. Shipping one phase at a time means
**every deploy has exactly one candidate cause.**

### 0.2 — The shape of every phase

```
GOAL        what this phase achieves
WHY         the decision, and the reasoning behind it
FILES       exact paths
STEPS       numbered, smallest safe increments
GOTCHAS     named traps, with what happens if you hit them
VERIFY      commands and expected output — run them, do not assume
STOP GATE   what must be true before the next phase
```

### 0.3 — Rules for the implementer

- **Never claim a check passed unless you ran it and saw the output.**
- **Compute rather than guess.** Where a number is checkable, check it.
- **Treat every claim in this document as a claim to test.** Two research passes overturned 10 of 11
  original claims; this document is better, not infallible.
- If a gate fails, **stop and report**. Do not "fix forward" into the next phase.

---

## 1 — Context an implementer needs

| | |
|---|---|
| **Site** | Next.js 16 App Router, ~20 public pages, deployed to Cloudflare via OpenNext |
| **Business** | Mobile / outcall hijama, cupping and massage in Luton, UK. **No premises open to the public** |
| **Live** | ⛔ **rahmatherapy.uk is LIVE.** Push to `master` = production release. ~3–4 min deploy |
| **Maintenance mode** | ⛔ **ON**, and this is **two** hazards, not one. **(a)** `src/lib/maintenance.ts` is working-copy `false`, HEAD `true`, deliberately uncommitted — **committing it would OPEN LIVE BOOKINGS**. **(b)** ⛔ **It is also a page-content state.** `MaintenanceBanner` is a **server** component rendered from `src/app/(public)/layout.tsx` on every public page, so the served HTML that every crawler sees contains *"This website is still being built — online booking is not yet available."* **This gates Phase 2 — see §3.1.** |
| **Dev server** | Owner-run at `localhost:3000` (not `127.0.0.1`). **Never spawn, restart or kill it** |
| **Goal** | Rank and be recommended for **cupping** and **massage** across Luton, its districts, and two neighbouring towns |

### 1.1 — The public surface (20 URLs)

```
8 single-URL routes  /home/ /about/ /services/ /reviews/ /faqs-aftercare/ /privacy/ /cookies/ /areas/
5 package pages      /services/{supreme-combo-package, hijama-package, fire-cupping-package,
                                massage-therapy-30-mins, massage-therapy-1-hour}/
5 area spokes        /areas/{bury-park, leagrave, stopsley, dunstable, houghton-regis}/
2 redirects          /  →308→ /home/     /areas/luton/  →308→ /areas/
1 transactional      /booking/manage  (token-gated, NOT for indexing)
```

Bury Park, Leagrave and Stopsley are **districts of Luton**. Dunstable and Houghton Regis are
**separate towns in Central Bedfordshire**. This distinction is load-bearing in Phase 7.

---

## 2 — ⛔ Absolute constraints

| # | Constraint | Consequence of breaking it |
|---|---|---|
| **C1** | **Never stage `src/lib/maintenance.ts`.** Stage by explicit path only — never `.` / `-A` / `-u`, **and never `git commit -a` or `-am`** (those stage every tracked modified file, which is *precisely and only* this one). The list is exhaustive as written; if a command is not on it, check what it stages before running it | **Opens live bookings.** Verify the flag in each committed tree with `git show <sha>:src/lib/maintenance.ts` before **every** push |
| **C2** | **No visible page prose may be reworded.** `seo: { title, description }` are metadata — length may change, wording and tone may not. `<h1>` text is frozen | Owner's explicit instruction |
| **C3** | **Any new absolute site URL must import `SITE_URL`/`siteUrl()`** from `src/content/site/site-url.ts` | ⛔ **Corrected:** `canonical-domain.test.ts` fails under **`npx vitest run` only**. `package.json`'s build is `gen-image-manifest && next build` — **no test step — and there is no CI.** So nothing at build or push time stops a second literal from deploying. **You must run the vitest gate manually before every push**; it is the only thing enforcing this |
| **C4** | **`trailingSlash: true`** (`next.config.ts:43`). Every emitted URL ends in `/` | Canonical/sitemap/href mismatch; 308s on every sitemap URL |
| **C5** | **Mark up only what the page visibly says** | Google policy violation; and LLMs can't use markup the HTML doesn't restate |
| **C6** | **No migrations, data writes, deploys, package installs, or real emails** without Owner approval | — |

### 2.1 — Gate baselines (must be identical at every stop gate)

```powershell
npx tsc --noEmit                              # 0
npx vitest run                                # 5 failed / 2493 passed (2498)   <- Ph2 +12, Ph3 +21, Ph8 +5
pnpm lint                                     # 4 errors / 1 warning, THREE files
npx vitest run scripts/                       # 47 passed
node scripts/measure-admin-contrast.mjs .     # 110 (46 dark / 64 light)
node scripts/verify-admin-token-contrast.mjs  # 0
git status --porcelain -- src/ supabase/      # exactly:  M src/lib/maintenance.ts
```

The **five** vitest failures are pre-existing and unrelated: `admin-access.test.ts` ×2,
`ManualBookingForm.test.tsx` ×3. Isolate those two files before calling anything a regression.

---

## 3 — Phase 0 — Pre-flight

**GOAL** Establish that the baseline is what this document assumes.

**STEPS**
1. Run all seven gate commands in §2.1. Record output.
2. `git log --oneline -1` — confirm the base, and `git status --porcelain` for the working tree.
3. `git show HEAD:src/lib/maintenance.ts` — confirm `MAINTENANCE_MODE = true`.
4. Capture a live "before" snapshot for later comparison:
   `curl -s https://rahmatherapy.uk/robots.txt`, `curl -sI https://rahmatherapy.uk/sitemap.xml`,
   and the served HTML of `/home/` and `/areas/bury-park/`.

5. **Capture the visual baseline** — all 20 public URLs at **1280 and 375**, into a new evidence
   directory. ⛔ The C-21 evidence is **476 commits stale** and covers only 12 pages at 1280 / 3 at
   375, with nothing for `/privacy/`, `/cookies/` or the package pages. **Record which maintenance
   state and which source (dev vs production) the capture used** — §14.2 compares against this.
6. **Settle the Owner questions that block later phases**, so nobody plans around an unknown:
   - **§5.0** — ship discovery before or after maintenance mode ends?
   - **G38** — is reproducing 89 Google reviews verbatim cleared under Google Maps' terms? This
     decides whether Phase 9 Step B is ever legal to write.
   - **G16** — the nav label wording.
   - **§7 of the spec** — the one-line languages copy ask.

**STOP GATE** All seven gates match §2.1. Snapshot and visual baseline saved. **All four Owner
questions answered in writing.**

---

## 4 — Phase 1 — ⚠️ Privacy: keep customer booking tokens out of the index

**GOAL** Stop `/booking/manage/?token=…` from being indexable.

**WHY** That page renders a customer's booking from a token in the URL, and there is **no `noindex`
anywhere in the codebase**. If such a link is ever shared, forwarded, or leaked via a referrer
header, the URL can be indexed. **This is a privacy exposure, not a ranking one** — which is exactly
why an SEO-framed review nearly missed it. It is first because it is the highest-severity item and
the smallest change.

**FILES** `src/app/booking/manage/page.tsx`

**STEPS**
1. Add `robots: { index: false }` to the existing `metadata` export. Note the export is currently
   **untyped** (`export const metadata = {`) — either leave it untyped or add `: Metadata` and its
   import; do not half-change it.
2. Do **not** add `follow: false` — plain `noindex` is standard and links on noindexed pages are
   eventually treated as nofollowed anyway.

**GOTCHAS**
- ⛔ **G1 — the Disallow+noindex trap.** This page must stay **crawlable**. If a later phase adds
  `Disallow: /booking/manage` to robots.txt, Googlebot can never fetch the page, never sees the
  `noindex`, and the URL **stays indexed and becomes hard to remove.** Phase 2 deliberately does not
  disallow it. Do not "helpfully" add it.
- **G2** — verify a bare `GET` on that route does not consume or invalidate a booking token before
  inviting crawlers to fetch it.

**VERIFY** `npx tsc --noEmit` → 0 · targeted test run · confirm the rendered page emits
`<meta name="robots" content="noindex">` in dev.

3. **Same phase, same mechanism — the admin auth pages.** Add `robots: { index: false }` to
   `/admin/login` and `/admin/password-reset` **(a subtree — the middleware exempts it via
   `startsWith`, so cover its children)**. ⛔ `/admin/signout` is a **Route Handler**
   (`src/app/admin/signout/route.ts`), not a page — it has **no `metadata` export**, so it needs an
   **`X-Robots-Tag: noindex` response header**, not the metadata pattern.
   **Why here:** this is the other half of Phase 2's G6. G6 says *don't* `Disallow: /admin/` because
   `noindex` is the right tool — if that half never lands, the three publicly reachable admin URLs
   end up neither disallowed nor noindexed.

**STOP GATE** Gates match. Owner approves the push. After deploy:
`curl -s https://rahmatherapy.uk/booking/manage/ | grep -i noindex` returns a match, and
`curl -s https://rahmatherapy.uk/admin/login/ | grep -i noindex` returns a match.

---

## 4.5 — Phase 1b — Fix the live geography error (before anyone is invited to crawl)

**GOAL** Stop shipping a factually wrong location claim.

**WHY** `area-json-ld.ts:26` emits `` areaServed: { name: `${area.name}, Luton` } `` unconditionally,
so the hub ships **`"Luton, Luton"`** and Dunstable ships **`"Dunstable, Luton"`** — a town that is
**not in Luton**. This moved ahead of Phase 2 deliberately: **Phase 2 exists to make crawlers fetch
these pages.** Inviting the first crawl of a page that states a known-wrong fact contradicts the
plan's own severity logic.

**FILES** `src/components/area-pages/area-json-ld.ts` (line 26)

**STEPS** Replace the suffix with a real model: districts (Bury Park, Leagrave, Stopsley) as `Place`
with `containedInPlace` → a `City` node for Luton; **Luton, Dunstable and Houghton Regis typed
`City`, never suffixed into each other.**

**GOTCHA G26b** — this is **structurally independent** of the `provider` block at lines 19-25, so it
does **not** need to wait for Phase 7's normalise-then-`@id` commit (G22). Keep the two separate.

**VERIFY** Grep the built output: no `"Luton, Luton"`, no `"Dunstable, Luton"`.

**STOP GATE** All six area pages emit a geographically correct `areaServed`. Gates match.

---

## 5 — Phase 2 — Discovery: sitemap, then robots

### ✅ 5.0 — The maintenance/indexing blocker is RESOLVED by sequencing

Every public page currently tells crawlers *"This website is still being built — online booking is
not yet available."* in **server-rendered** HTML (§1). This phase exists to trigger Google's
**first-ever full indexing pass**, and no `git revert` can un-index a bad first snapshot.

**Resolved by the Owner's local-first decision (§0.0):** this phase is built and verified **locally
only**. **Phase 12 removes the maintenance system entirely before anything is pushed** (§13.5), so
Google's first crawl meets a site with no banner at all.

⛔ **The rule this leaves behind: no sitemap, `Sitemap:` directive or Search Console submission may
reach production while the maintenance banner ships.** Phase 13 enforces the order.

**GOAL** Give crawlers a machine-readable index, and a robots.txt that is yours.

**WHY** `/sitemap.xml` currently 404s and `/robots.txt` is Cloudflare's boilerplate — 25 lines, all
comments, no directives, no `Sitemap:`. Combined with the orphaned `/areas` cluster (Phase 4), Google
currently has **no discovery path** to six pages built to rank. An unindexed page also cannot be
cited by any AI engine, which defeats the AEO/GEO goal directly.

**FILES** `src/app/sitemap.ts` (new) · `src/app/robots.ts` (new)

### 5.1 — Step A: the sitemap (ship and verify before touching robots)

**18 URLs**, all trailing-slashed, all built from `siteUrl()`:

```
/home/  /about/  /services/  /reviews/  /faqs-aftercare/  /privacy/  /cookies/  /areas/
/services/<5 package slugs>/
/areas/<5 area spokes>/
```

1. Derive package slugs from `packagePages` and area slugs from `areaSpokes`. **Never hand-list** —
   a new area or package must appear automatically.
2. **Omit `priority` and `changefreq` entirely.** Google ignores both; Bing ignores both. Next's
   `MetadataRoute.Sitemap` will emit them if you populate the fields — don't.
3. `lastmod`: ⛔ **default to a COMMITTED date map**, not git-at-build-time. Cloudflare Workers Builds
   **clones shallow**, and under a shallow clone `git log -1 --format=%cI -- <file>` returns **HEAD's
   date for every file** — so all 18 URLs restamp on every deploy. That is precisely the G3 failure,
   reached by a route G5 does not catch: git access *works*, it just returns the wrong answer.
   Deriving from git is the **contingency**, not the default, and only if proven under a real deploy.
   If a route's real change date is unknown, **omit `lastmod` for that route** rather than guess.
   ⛔ Also: the sitemap route **must be prerendered**. `workerd` cannot spawn `git` via
   `child_process` at request time — that would pass locally and return 500 in production.

**GOTCHAS**
- ⛔ **G3 — never `new Date()` at build time.** `lastmod` trust is **binary and site-wide**: one
  history of wrong dates and Google discards the field for the whole site. On Cloudflare, every
  deploy would restamp all 18 URLs. Worse than never shipping it.
- ⛔ **G4 — no noisy URLs.** No redirects, no 404s, no robots-blocked URLs. Excluded and verified:
  `/` (308), `/areas/luton/` (308), `/booking/manage/` (noindex from Phase 1), `/admin/` (307),
  `/api/*` (405).
- **G5** — confirm build-time git access works under OpenNext/Cloudflare. If not, fall back to a
  committed content-dates module. **Verify; do not assume.**

**VERIFY** A test asserting: exactly 18 URLs · every URL ends in `/` · no URL is robots-disallowed ·
no `priority`/`changefreq` keys · **output byte-identical across two builds with no content change**
(this is what catches G3).

### 5.2 — Step B: robots.txt

⛔ **STOP GATE FOR STEP A FIRST.** Do not write robots until the deployed sitemap is verified:
`curl -sI https://rahmatherapy.uk/sitemap.xml` → **200**, and the body holds exactly 18 `<loc>`
entries, every one trailing-slashed. G9's ordering rule ("never point at a 404") only buys anything
if the sitemap is confirmed **live** first — and it is a hard 404 today. **This is a separate deploy
and a separate Owner go-ahead**, per §0.1: one deploy, one candidate cause.

**Illustrative OUTPUT — not source to transcribe:**

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /monitoring

Sitemap: https://rahmatherapy.uk/sitemap.xml
```

⛔ **In `src/app/robots.ts`, write `sitemap: siteUrl("/sitemap.xml")`** importing from
`@/content/site/site-url`. **Never type the literal `https://rahmatherapy.uk` into a `.ts` file under
`src/`** — `canonical-domain.test.ts` scans `src` and would turn the 5-failure baseline into 6, and
per C3 **nothing at build or push time would stop the deploy.**

**GOTCHAS**
- ⛔ **G6 — do NOT `Disallow: /admin/`.** It is already auth-gated, and `/admin` is **not linked from
  a single public page** — adding it would be the *first public advertisement* that the path exists.
  Crawl budget does not apply: Google's guide starts at **10,000+ pages**; this site has ~20.
- ⛔ **G7 — do NOT `Disallow: /booking/manage`.** See G1.
- ⛔ **G8 — Cloudflare PREPENDS, it does not replace.** After deploy you will see Cloudflare's ~24
  comment lines **above** your directives. **That is normal and benign** — comments are ignored by
  every parser. **Verify by checking your `Sitemap:` line is present**, not by expecting a clean
  file. Do **not** disable Cloudflare's managed file.
- **G9 — order matters.** Ship the sitemap first. A `Sitemap:` line pointing at a 404 is worse than
  no line.
- **G10 — allow all AI crawlers.** `GPTBot`/`ClaudeBot` are *training* bots; **`OAI-SearchBot` and
  `Claude-SearchBot` are the ones that produce your citations.** Blocking those costs visibility.
  Add no AI-specific `Allow` lines — `User-agent: *` already permits them.

**VERIFY (post-deploy)**
```bash
curl -s https://rahmatherapy.uk/robots.txt | grep -i sitemap
curl -sI https://rahmatherapy.uk/sitemap.xml
```
Expect a `Sitemap:` line, and 200 on the sitemap.

**STOP GATE** All 18 sitemap URLs return 200 and none redirects (re-run the noisy-URL check). Gates
match. `/robots.txt` contains your `Sitemap:` line.

---

## 6 — Phase 3 — Canonicals

**GOAL** Every public page emits a self-referencing canonical.

**WHY** 12 of 20 URLs have none. `/home/`, `/home/?booking=1`, `/home/?cookie-settings=1` and
`/home/?utm_source=x` all return 200 with identical content and no canonical — four URLs for one
page. Canonicals are a **hint, not a rule**, but they are the documented tool here.

**FILES** `src/app/(public)/{home,about,services,reviews,faqs-aftercare}/page.tsx` ·
`src/app/(public)/services/[slug]/page.tsx`

**STEPS** Add `alternates: { canonical: siteUrl("/<path>/") }`, copying the existing pattern from
`/areas/` or `/privacy/` exactly. For `[slug]`, build the path from the slug inside `generateMetadata`.

**GOTCHAS**
- ⛔ **G11 — trailing slash.** `siteUrl("/home/")`, not `"/home"`. C4.
- ⛔ **G12 — derive from the route path, never `searchParams`.** If the canonical echoed the query
  string, `?utm_source=x` would self-canonicalise and *manufacture* the duplicates this phase
  removes. This holds for free today (`?booking=1` is client-side only) — the guard is to stop a
  regression.
- **G13** — do not robots-disallow `?utm_*`/`?booking`; that would destroy the consolidation signal.

**VERIFY** A test: `/home/?utm_source=x&booking=1` renders
`<link rel="canonical" href="https://rahmatherapy.uk/home/">`.

**STOP GATE** All 18 indexable URLs emit a self-referencing canonical. Gates match.

---

## 7 — Phase 4 — Linking

**GOAL** End the orphaning of `/areas`, and make the legal pages reachable.

**WHY** `/areas` appears **zero times** in the served HTML of all five core pages. Six pages built to
rank have no internal path in. Nav-vs-footer makes no measurable machine difference — this is a UX
call, chosen as **both** because the nav and footer arrays are currently identical, so footer-only
would make `/areas` the only top-level page missing from the nav.

Separately, `legalLinks: []` means **nothing on the site links to the privacy policy** — a compliance
concern, not just SEO.

**FILES** `src/content/site/navigation.ts` · `src/content/site/footer.ts`

**STEPS**
1. ⛔ **DO NOT touch `navigation.ts`.** Owner decision 2026-08-13: **footer only.** The nav stays at
   its designed 5 items. This is a free choice — Mueller: link position is *"pretty much irrelevant"*
   to Google, so nav-vs-footer costs nothing in machine understanding, and the footer renders on all
   20 pages anyway.
2. Append one entry to `footer.ts` `serviceLinks`: **label `"Areas We Cover"`, href `/areas`**.
   ⛔ **`/areas`, with NO trailing slash.** Every existing entry is slash-less. C4/G11's
   trailing-slash rule governs **emitted absolute URLs** (canonical, sitemap), **not internal nav
   hrefs** — Next applies `trailingSlash` to the rendered href anyway, so the emitted URL is still
   `/areas/` with no redirect hop. (Slash-less also keeps any future active-state logic working:
   `SiteHeader.tsx:12-16` tests `pathname.startsWith(`${href}/`)`, which `/areas/` would break.)
3. Populate `legalLinks` (`footer.ts:26` — verify) with Privacy and Cookies.

**GOTCHAS**
- ⛔ **G14 — link the HUB only, never the five spokes.** The Owner's constraint is no long menu. The
  hub already links all five spokes, so every spoke lands two clicks from every page.
- **G15** — these are plain data arrays rendered by `SiteHeader.tsx` and `SiteFooter.tsx`; no
  component change should be needed. If one is, stop and reconsider.
- **G16** — the label is new visible text. It is a nav label, not page prose, but **the Owner picks
  the wording.**

**VERIFY** Fetch `/home/` and confirm an `/areas/` href is present. Confirm nav renders 6 items at
desktop **and** in the mobile drawer.

**STOP GATE** `/areas/` reachable by following links from `/home/`. `/privacy/` and `/cookies/`
linked. Gates match.

---

## 8 — Phase 5 — Structural fixes

**GOAL** Three small, independent corrections.

**FILES** `src/app/(public)/page.tsx` · `src/components/shared/SectionHeading.tsx` (or the legal
pages) · `src/app/layout.tsx`

**STEPS**
1. `permanentRedirect("/home")` → `permanentRedirect("/home/")` — removes a redundant hop on the
   site's strongest URL (`/` → `/home` → `/home/` becomes one hop).
2. `/privacy` and `/cookies`: promote the existing heading from `<h2>` to `<h1>`. **No words change**
   — only the tag. `SectionHeading` hard-codes `<h2>`; prefer a prop over editing the shared
   component, so no other page's heading level moves.
3. `src/app/layout.tsx`: `lang="en"` → `lang="en-GB"`.

**GOTCHAS**
- ⛔ **G17** — `SectionHeading` is shared. Changing its hard-coded `<h2>` would alter heading levels
  across the whole site. Add an optional `as`/`level` prop and use it only on the two legal pages.
- **G18** — moving the homepage to `/` outright is **out of scope**. Deliberate: it is a
  restructure, not a one-word fix.

**VERIFY** `curl -sI https://rahmatherapy.uk/` shows a single 308 straight to `/home/`. Both legal
pages have exactly one `<h1>`. Re-run the admin-contrast gates — heading changes can move Layer 1.

**STOP GATE** Gates match, **including the two contrast scripts** (diff Layer 1 as a **set** keyed on
`theme|file|fg|bg|ratio`, never positionally).

---

## 9 — Phase 6 — Metadata: lengths and per-page OpenGraph

**GOAL** Bring titles/descriptions into display range; stop all 20 pages sharing one OG card.

**WHY** 14 of 20 titles and 12 of 20 descriptions fall outside display limits. Separately, `openGraph`
is set once in the root layout and nothing overrides it — sharing any page produces an identical card.

**FILES** `src/content/pages/{areaPages,packagePages}.ts` (`seo` blocks) · the five core route files ·
per-page metadata

**STEPS**
1. **Length only, wording and tone preserved** (C2). Trim redundant brand suffixes rather than
   rewrite. Priority:
   - **`/reviews/` title, 29 chars** — the weakest title on the highest-content page (1,831 words),
     and it carries neither target keyword. The one case needing more than a trim.
   - **Area titles 74–87** — dropping the trailing `| Rahma Therapy` from the six area pages fixes
     most without losing a keyword.
   - **`/faqs-aftercare/` description, 191** · `/home`, `/about`, `/services` at 168–173.
2. Add a per-page `openGraph` block deriving title/description from that page's **existing** `seo`
   strings. Keep `social-preview.png` as the site-wide fallback image; per-page images only where
   distinct imagery already exists. **Commission no new assets.**

**GOTCHAS**
- ⛔ **G19 — do NOT add a `twitter` block.** Next derives Twitter tags from OpenGraph automatically;
  they are already correct on the live site. Adding one duplicates work and risks divergence.
- **G20** — count characters, don't eyeball. Targets ~50–60 (title) and ~140–160 (description).
- **G21** — every trimmed string is Owner copy. Present the before/after list for approval **before**
  committing.

**VERIFY** Re-run the length sweep. Confirm each page's OG card is distinct from its siblings.

**STOP GATE** Owner has approved the before/after string list. Gates match.

---

## 10 — Phase 7 — Business entity: normalise, identify, address, geography

**GOAL** One coherent business entity, correctly located.

**WHY** Today five pages emit **anonymous** business nodes that disagree with each other — two phone
formats (`+447798897222` vs bare `07798897222` in four files), four different `url` values,
`priceRange` on one page only, `sameAs` on two only. **Google requires `address`; the site has none
on any of its 15 emissions.**

⛔ **Scope correction — do not over-scope this.** The six area pages do **not** ship a dangling
reference. `area-json-ld.ts:19-25` defines the provider **inline and self-sufficiently**: `@id`,
`@type`, `name: "Rahma Therapy"`, `telephone`, `areaServed`. An earlier draft called it "a node
defined nowhere" with "no name" — **that was wrong**, and the stop-gate check *"every referenced
`@id` has a defining node in the same page's output"* **already passes on those six pages today.**
The real defect there is narrower: that node lacks `address`, `url` and `sameAs`, and its
`areaServed` (`"Luton and surrounding areas"`) disagrees with the five page-level nodes (`"Luton"`).

*(The geography error is fixed separately in Phase 1b — it is structurally independent of this work.)*

**FILES** `src/components/area-pages/area-json-ld.ts` · the five page-level JSON-LD literals ·
a new shared builder, e.g. `src/content/site/business-node.ts`

### 10.1 — ⛔ G22 — THE ORDERING TRAP. Read this before writing code.

**Normalise the facts and add the `@id` in the SAME commit. Never `@id` first.**

RDF merge is *additive*. Applying a shared identifier to nodes that disagree merges the
contradictions into one entity asserting **both** phone numbers and four different URLs. Adding the
`@id` first is strictly worse than the status quo.

### 10.2 — Steps (one commit for 1–4)

1. **Extract one shared `businessNode` builder** and normalise:
   - `telephone`: `+447798897222` everywhere (currently bare `07798897222` in four files)
   - `url`: one canonical business URL everywhere — **the business's URL, not the current page's**
   - `areaServed`: one value
   - `sameAs`: Instagram **plus the Google Business Profile URL** (`googleReviewsUrl` already exists
     in `src/lib/content/reviews.ts`)
   - `priceRange`: `"£40-£60"` (ASCII hyphen, as in code)
2. **Add `@id`**: absolute `` `${SITE_URL}/#business` `` — **never bare `#business`** (a relative
   fragment resolves against the document, giving a different identity per page). Carry `url`
   alongside it.
3. **Add `address`**: `{ "@type": "PostalAddress", addressLocality: "Luton",
   addressRegion: "Bedfordshire", addressCountry: "GB" }` — **no `streetAddress`**.
4. **Emit the complete node on every page** that references it.
5. **Fix the geography** in `area-json-ld.ts:26`. Replace the hardcoded `` `${area.name}, Luton` ``
   with a real model: the three districts as `Place` with `containedInPlace` → a `City` node for
   Luton; **Luton, Dunstable and Houghton Regis typed `City`, never suffixed into each other.**

**GOTCHAS**
- ⛔ **G23 — never fabricate a street address.** GBP suspension risk, far worse than a markup warning.
- ⛔ **G24 — `@id` resolves within a page only.** Do not strip the node from area pages and rely on
  the reference. Google processes page-by-page; a dangling reference is legal JSON-LD and
  **validates silently** while carrying no data.
- ⛔ **G25 — do NOT adopt `@graph`.** It makes parsing atomic: one formatting error voids *all*
  structured data on the page. Current separate `<script>` blocks fail independently.
- ⛔ **G26 — the live geography bug.** `/areas/` currently emits `areaServed: "Luton, Luton"` and the
  Dunstable/Houghton Regis pages claim those towns are in Luton. **They are not** — they are separate
  towns in Central Bedfordshire, and the Owner's visible titles already say so correctly.
- ⛔ **G27 — C5 applies to every property.** Safe (present in visible copy): name, telephone, url,
  sameAs, priceRange, areaServed, locality-level address. **Unsafe:** `openingHoursSpecification`,
  `paymentAccepted`, `currenciesAccepted`, `knowsLanguage`, `foundingDate`, `streetAddress`.
- **G28 — `address` validation is contested** for address-less service-area businesses.
  **Validate in the Rich Results Test before shipping.** If it still errors, fall back to
  `Organization` (zero required properties).

**VERIFY** All 20 URLs through the Rich Results Test **and** the Schema Markup Validator. Confirm:
every referenced `@id` has a defining node **in the same page's output** · exactly one telephone
format and one `url` site-wide · **no `"Luton, Luton"`, no `"Dunstable, Luton"`** · no missing
required `address`.

**STOP GATE** Rich Results Test clean on `/home/`, `/areas/bury-park/`, `/areas/dunstable/`,
`/services/hijama-package/`. Gates match.

---

## 11 — Phase 8 — FAQs: server-render, then mark up

**GOAL** Put all 31 FAQs into the served HTML.

**WHY** Only **4 of 31** reach the HTML — `FaqCategoryAccordions.tsx` is a client component whose
state seeds to the first category. **No major AI crawler except Googlebot executes JavaScript**, so
26 answers are invisible to ChatGPT, Claude and Perplexity — and Google does not click tabs either.

**FILES** `src/components/faqs-aftercare/FaqCategoryAccordions.tsx` · `src/app/(public)/faqs-aftercare/page.tsx`

**STEPS**
1. Render all **7** `faqCategories` into the DOM; hide inactive with `hidden` / `display:none`.
   Visible UX identical — same tabs, same clicks, same appearance.
   ⛔ **SEVEN, not ten.** `faqCategories` holds 7 categories (booking, packages, therapists-privacy,
   hijama, dry-fire-cupping, massage-iastm, aftercare) carrying all 31 questions. The other three ids
   (`hijama`, `cupping`, `massage`) belong to **`aftercareTabs`** — a **separate export rendered by a
   different component** (`AftercareTabs.tsx`) containing **zero** question/answer pairs. **Do not
   pull them into the FAQ DOM or the markup** — they are not Q&A, and marking them up as such would
   breach C5.
2. Then add `FAQPage` JSON-LD. 80 of 88 pairs are plain strings; the 8 homepage FAQs use a block
   array and need a **serialiser**, not a copy edit.

**GOTCHAS**
- ⛔ **G29 — HARD BLOCKING GATE: every one of the 31 FAQs must be reachable by a visible,
  keyboard-operable control.** The FAQPage doc's "expandable answer is valid" exemption was **deleted
  on 2026-06-15**, leaving only C5. Any FAQ in the DOM with no reveal affordance must be given one,
  or removed from both the DOM and the markup.
- ⛔ **G30 — accessibility.** Hide with `hidden`/`display:none`, **not visually-only** — otherwise
  screen readers announce all ten categories at once.
- ⛔ **G31 — `FAQPage` produces NO Google search appearance.** Feature removed 2026-05-07, docs
  deleted 2026-06-15, GSC API removed August 2026. This site was **already ineligible from
  2023-09-14**, so nothing is lost. It ships on the Owner's decision rule — cheap, riskless,
  plausibly useful for machine understanding. **Budget zero benefit.** Never write an acceptance
  criterion referencing the GSC FAQ report or the Rich Results Test FAQ check — both are gone.
- ⛔ **G32 — do NOT substitute `QAPage`.** Its live doc forbids it verbatim for FAQ pages.
- ⛔ **G33 — zero test coverage.** No test imports any public marketing component. **Show the Owner
  the diff before applying.**

**VERIFY** `curl` the deployed page and grep for the answer text of the **last** collapsed FAQ — this
proves the content is in the served HTML with no reliance on any vendor doc. Add a test asserting all
31 questions appear in the server-rendered output. Keyboard-walk every tab.

**Weight check (measured):** all 31 Q&As are **4.1 kB** raw on a 109 kB page served with **brotli** —
~1–2 kB over the wire. Negligible against LCP 482 ms.

**STOP GATE** 31 questions in the HTML · every one keyboard-reachable · Owner approved the diff ·
gates match.

---

## 12 — Phase 9 — Reviews

**GOAL** Machine-readable review signal, without the one element that carries risk.

**FILES** the business-node builder (Phase 7) · `src/app/(public)/reviews/page.tsx`

### 12.1 — Step A: `sameAs` (do this first — best value, zero risk)

Already covered by Phase 7 step 1. It puts 5.0-from-177 at its **authoritative source** rather than
as a copied number on your own site. If Phase 7 shipped it, this step is already done.

### 12.2 — Step B: `Review` objects — ⛔ **DROPPED. Do not build.**

**Owner decision, 2026-08-13.** Not dropped on SEO grounds — dropped because **G38 is unresolved**:
whether reproducing 89 Google reviews verbatim on your own site is permitted under Google Maps'
terms is a **licensing** question, not an SEO one, and nothing in this work cleared it.

`sameAs` (Step A / Phase 7) captures most of the benefit at zero risk, and both research passes
ranked it the best value on the table regardless.

**Phase 9 therefore has no code of its own.** Its content is Phase 7's `sameAs`. Keep the phase as a
checkpoint that `sameAs` shipped correctly, then move on.

**The rules below are retained ONLY as the specification to follow if this is ever revisited** —
they are not instructions to implement now.

⛔ **G34 — the four rules. The first research pass's own template broke three of them.**
1. **Only reviews present in the server-rendered HTML** (~24 of 89). Derive in code from the same
   source the components use — **never hand-list**, or it silently desyncs when `pageSize` changes.
2. **`ratingValue` reads the real rating.** **Two reviews are 4-star**, not 5.
3. **Omit `datePublished` entirely.** Dates are relative (`"4 years ago"`); converting means
   inventing one.
4. **`reviewBody` byte-identical** to visible text; `author.name` exactly as displayed.

⛔ **G35 — NEVER emit `aggregateRating`.** Not the GBP 5.0/177, not computed from the 89. Not a
ranking penalty — the exposure is **collateral**: a structured-data manual action causes **all**
structured data on the page to be ignored, forfeiting working breadcrumbs and entity signals for a
star rating the site has been ineligible for since 2019. Two current bullets bite directly:
*"Ratings must be sourced directly from users"* and *"Don't rely on human editors to create, curate,
or compile ratings information for local businesses."*

⛔ **G36 — never retype anything as `Product` to chase stars.** A false type claim, and the only path
with genuine spam-policy exposure.

⛔ **G37 — leave `ReviewsStatsStrip.tsx` alone.** It is page copy (C2), honestly labelled. The
guidelines govern **markup**, not visible copy.

⚠️ **G38 — outside SEO entirely:** reproducing 89 Google reviews verbatim on your own site is a
Google Maps terms/copyright question. **Nothing in this work cleared it.** Raise with the Owner.

**VERIFY** Rich Results Test — expect **"valid, no rich result eligible"**. That is the correct
outcome, **not a defect**. Add a test asserting the emitted `Review` count equals the server-rendered
count and every `ratingValue` matches its source record. Watch Search Console Manual Actions for 30
days.

**STOP GATE** No `aggregateRating` anywhere. Emitted review count == server-rendered count. Gates match.

---

## 13 — Phase 10 — Additions

**GOAL** Cheap, riskless markup that helps machines understand the business.

**STEPS**
1. `BreadcrumbList` on `/about/`, `/services/`, `/services/[slug]/`, `/faqs-aftercare/` — reuse the
   existing builder shape.
2. **Therapists as `Person` entries** with name, jobTitle, image and CMA/IPHM credentials. This makes
   *"female therapist in Luton"* — a real customer query — machine-readable.
3. `founder`, `logo`, `image`, `email` on the business node.
4. `serviceType` as an **array** of distinct services (cupping therapy, massage therapy, hijama) so
   the two target keywords are separately addressable per place, instead of one blended string.

**GOTCHAS**
- ⛔ **G39 — C5 governs every addition.** Only mark up therapists, credentials and services the pages
  visibly show.
- ⛔ **G40 — never build:** `meta keywords` (the one item with an active downside) · `HowTo` ·
  `rel=prev/next` · sitemap `priority`/`changefreq` · authorship markup · AMP · `speakable` ·
  **`llms.txt`** · **sitelinks `WebSite`/`SearchAction`** (retired 2024-11-21, *and* it requires the
  root URI, which 308-redirects here).

**STOP GATE** Gates match. Validator clean.

---

## 14 — Phase 11 — Full review and test

**GOAL** Prove the whole thing works, visually and mechanically, before calling it done.

### 14.1 — Mechanical

1. All seven gates in §2.1 — identical to baseline.
2. Re-run the **noisy-URL check**: every sitemap URL 200, none a redirect, all self-canonical.
3. `curl -s /robots.txt | grep -i sitemap` → present. `curl -sI /sitemap.xml` → 200.
4. **JS-disabled fetch of every public route** — confirm primary content, headings, service names and
   all place names appear in raw HTML. Pass/fail, per route, recorded. *(This is the single
   best-evidenced AEO/GEO check in the plan.)*
5. Rich Results Test + Schema Markup Validator on `/home/`, `/areas/bury-park/`, `/areas/dunstable/`,
   `/services/hijama-package/`, `/reviews/`, `/faqs-aftercare/`.
6. Grep the deployed HTML: **no `"Luton, Luton"`, no `"Dunstable, Luton"`**, no `aggregateRating`,
   every `@id` reference resolved in-page.
7. `/booking/manage/` emits `noindex` and is **not** robots-disallowed.

### 14.2 — Visual, in a browser

Use the Owner's dev server at `localhost:3000` (**never spawn or restart it**) or the deployed site.

8. **Every public page at 1280 and 375** — full-page screenshot, compared against **the baseline
   captured in Phase 0**.
   ⛔ **Do NOT use the C-21 evidence as the baseline.** It was captured at commit `38ff24c` on
   2026-07-27 — **476 commits ago** — and covers only 12 pages at 1280 and **3 at 375**, with **no
   baseline at all for `/privacy/`, `/cookies/` or the five package pages**. `/privacy/` and
   `/cookies/` are exactly what Phase 5 edits.
   ⛔ **"Expect no visual change" is FALSE — do not write that expectation.** Phase 4 adds **+1 header
   nav item and +2 footer legal links on every page.** The correct expectation is: *that delta and
   nothing else.*
   ⛔ **Pin one capture source** — dev server **or** production, never "either". `MAINTENANCE_MODE` is
   `false` locally and `true` in production, and it gates a spacer, the banner and the modal, so the
   two render different chrome on every page.
   **Add a header-overflow check** at the breakpoints where the desktop nav shows: a 6th item in a
   fixed-height bar can wrap or overflow. Reuse C-21's method — `scrollWidth` vs `clientWidth`.
9. **The FAQ page specifically** — click every one of the 10 tabs, confirm the panel switches, the
   right questions show, and nothing is visible that shouldn't be. Keyboard-walk with Tab/Arrow keys.
10. **Nav and footer** at desktop and mobile — 6 nav items, drawer opens, "Areas We Cover" navigates
    to `/areas/`, legal links present.
11. **Console and network clean** on every page — zero errors, zero failed requests.
12. **Lighthouse mobile** — Accessibility, Best Practices and SEO must all still be **100**, and CWV
    at least as good as LCP 482 ms / CLS 0.00.

### 14.3 — Owner-side, off-site (outside the codebase)

13. **Google Search Console** — verify the property, submit the sitemap, record a baseline.
14. **Google Business Profile** — configure as a service-area business: address **removed**, service
    areas set by **city/postcode, never radius**, within the 20-area cap. ⭐ **This outranks
    everything in the repo for the stated goal.**

**FINAL GATE** Everything above green. Gate baselines identical. `git status --porcelain -- src/
supabase/` shows **exactly** ` M src/lib/maintenance.ts`.

---

## 14.4 — Phase 11b — Resolve the five pre-existing test failures

**GOAL** Get the suite to zero failures before anything is deployed.

**WHY** ⛔ **Owner instruction, 2026-08-13.** These five have failed since before this workstream
began — they are in `§2.1`'s baseline precisely so SEO changes could be judged against a stable
reference. **None of them is caused by this work**, and none is an SEO defect. But shipping to
production with a red suite means the next regression has nowhere to show up, so they are cleared
here: after the full review, before maintenance removal and release.

**THE FIVE**

| # | Test | File |
|---|---|---|
| 1 | *gives Owner broad access while keeping owner-only role actions permission-gated* | `src/lib/auth/admin-access.test.ts` |
| 2 | *gives Admin broad operational access without role template management* | `src/lib/auth/admin-access.test.ts` |
| 3 | *renders step 1 on first load* | `src/app/admin/bookings/new/ManualBookingForm.test.tsx` |
| 4 | *moves focus to the first invalid field when continuing with errors* | same |
| 5 | *shows the consent error when trying to create booking without consent* | same |

**APPROACH — diagnose before fixing.** For each, establish which side is wrong before touching
anything: is the **test** asserting something that is no longer true (in which case the test is
stale and the fix is to update it), or is the **code** genuinely broken (in which case the test is
doing its job and the code needs the fix)? ⛔ **Do not "fix" a failing test by weakening its
assertion** — two of these guard permission boundaries, and a permission test that has been softened
to pass is worse than one that fails loudly.

Numbers 1 and 2 are **permission-model** tests, so treat them as security-relevant: understand what
access each role is meant to have, and confirm the answer against the role definitions rather than
against whatever makes the test green.

Numbers 3-5 are **form/accessibility** behaviour on the manual booking form — first render, focus
management on invalid submit, and the consent guard. Number 5 in particular guards a consent
requirement, so its failure mode matters beyond the test.

**GOTCHAS**
- ⛔ **G47 — the gate baseline changes here, legitimately.** §2.1 goes from *5 failed / N passed* to
  *0 failed*. Update §2.1 in the same commit, or every later phase will look like it introduced a
  regression in the opposite direction.
- ⛔ **G48 — do not weaken an assertion to get green.** See above.
- **G49** — these tests were the reference for "is this a regression?" throughout Phases 0-11. Once
  they pass, that reference is gone; the new baseline is zero.

**VERIFY** `npx vitest run` → **0 failed**. Then re-run the Phase 11 review in full, because the
comparison baseline has moved.

**STOP GATE** Suite fully green · §2.1 updated · each fix explained as *test was stale* or *code was
broken*, never as "made it pass".

---

## 14.5 — Phase 12 — ⛔ Remove the maintenance system (Owner-gated, immediately pre-release)

**GOAL** Take the site out of maintenance mode entirely, and re-verify that every SEO decision in
this plan still holds against the changed HTML.

**WHY THIS IS LAST, AND SEPARATE** ⛔ **This phase OPENS LIVE BOOKINGS.** It is a business decision,
not an SEO one, and it is deliberately isolated so it is never bundled into an SEO commit. It sits
here because Phase 2's indexing blocker is resolved by *removing the banner before the first push*
(§5.0) — so this must land before Phase 13, and after everything else is verified.

⛔ **DO NOT BEGIN THIS PHASE WITHOUT AN EXPLICIT, SEPARATE OWNER INSTRUCTION.** Approval of the SEO
plan is **not** approval to open bookings.

**FILES** `src/lib/maintenance.ts` · `src/app/(public)/layout.tsx` (the spacer, banner and modal
gating, and the booking-loader swap) · `src/components/shared/MaintenanceBanner.tsx` ·
`src/components/shared/MaintenanceModal.tsx` · any test referencing them

**STEPS**
1. Confirm in writing that the Owner wants live bookings open.
2. Remove the maintenance gating from `(public)/layout.tsx` — the spacer, `MaintenanceBanner`,
   `MaintenanceModal` — and restore the booking loader on all public pages.
3. Delete `MaintenanceBanner.tsx`, `MaintenanceModal.tsx` and `src/lib/maintenance.ts`, plus every
   import and test that references them. **Remove your own orphans, nothing else.**
4. ⛔ **From this commit onward, C1 no longer applies** — the file it protects is gone. Update §2 C1
   and §16 in the same commit so no later reader follows a dead rail.

**RE-VERIFY EVERYTHING — removing the banner changes the served HTML of all 20 pages**
5. Re-capture the **visual baseline** at 1280 and 375. Every page loses the banner and the spacer, so
   the Phase 0 baseline no longer applies. This is an **expected, site-wide** visual change.
6. Re-run the **JS-disabled fetch** of every route — confirm the "still being built" text is gone and
   primary content, headings, service names and place names are all still present.
7. Confirm `?booking=1` works again, and that Phase 3's canonicals still resolve those variants to
   the clean URL — the booking flow is live again, so this path is exercised for the first time since
   Phase 3.
8. Re-run the Rich Results Test on the four representative pages — the business node and geography
   must be unchanged by the removal.
9. Re-run all seven §2.1 gates. ⚠️ **The `git status` gate changes**: ` M src/lib/maintenance.ts`
   will no longer appear, because the file is deleted. That is the one legitimate change to the
   baseline in this entire plan — record it explicitly so it is not mistaken for a mistake.
10. Re-read the spec's §3 decision table end to end and confirm nothing in it depended on the banner
    being present.

**GOTCHAS**
- ⛔ **G41 — this is the only irreversible business change in the plan.** Everything else is markup.
- ⛔ **G42 — the `git status` baseline legitimately changes here.** Update §2.1 in the same commit.
- **G43** — the banner carried a phone number and email in server HTML. Removing it removes those
  from every page's text. Confirm the footer still carries them, so no contact detail is lost from
  the crawlable content.
- **G44** — check for tests asserting the banner exists. They must be removed with it, not left to
  fail.

**STOP GATE** Bookings confirmed open by the Owner · banner text absent from every route's raw HTML ·
fresh visual baseline captured · all gates match (with the documented `git status` change) · spec §3
re-confirmed.

---

## 14.6 — Phase 13 — Release: push phase by phase

**GOAL** Get the verified work to production without losing bisectability.

**WHY** ⛔ **Owner decision: push phase-by-phase, verifying between** — not one large push. Thirteen
phases arriving in a single deploy would mean any production failure has thirteen candidate causes,
on a live site with no staging and no rollback environment. The whole point of §0.1 is preserved only
if the pushes are also separated.

**STEPS**
1. ⛔ **Verify the maintenance flag in EVERY committed tree about to be pushed:**
   `git show <sha>:src/lib/maintenance.ts` for each — until Phase 12's commit, every one must read
   `MAINTENANCE_MODE = true`.
2. Push **one phase's commit at a time.** After each: wait ~3–4 min for the deploy, then run that
   phase's live VERIFY block (the `curl` checks deferred from §0.0).
3. **Order matters — Phase 12 must be pushed before Phase 2's discovery work is live**, so no crawler
   meets the banner (§5.0).
4. If any live check fails, **stop.** Do not push the next phase. See §16 — Phases 1, 2 and 9 are not
   revertible by git alone.
5. Only after all pushes are green: **submit the sitemap in Search Console** (§14.3) — this is the
   step that actually invites indexing, and it must be last.

**STOP GATE** Every phase deployed and individually verified · sitemap submitted · §14 full review
re-run against production.

---

## 15 — Gotcha index

| # | Gotcha | Phase |
|---|---|---|
| G1 | Disallow+noindex trap — the page must stay crawlable | 1, 2 |
| G2 | Verify a bare GET doesn't consume a booking token | 1 |
| G3 | Never `new Date()` for `lastmod` — trust is binary, site-wide | 2 |
| G4 | No noisy URLs in the sitemap | 2 |
| G5 | Confirm build-time git access under OpenNext | 2 |
| G6 | Do NOT disallow `/admin/` — it would be the first public disclosure | 2 |
| G7 | Do NOT disallow `/booking/manage` | 2 |
| G8 | Cloudflare **prepends**; check for your `Sitemap:` line, not a clean file | 2 |
| G9 | Sitemap before robots — never point at a 404 | 2 |
| G10 | Allow AI crawlers; search bots ≠ training bots | 2 |
| G11 | Trailing slash on every emitted URL | 3 |
| G12 | Canonical from route path, never `searchParams` | 3 |
| G13 | Don't robots-block tracking params | 3 |
| G14 | Link the hub only, never the five spokes | 4 |
| G15 | Data arrays only — no component change expected | 4 |
| G16 | Nav label is new visible text — Owner picks it | 4 |
| G17 | `SectionHeading` is shared — use a prop, don't edit the default | 5 |
| G18 | Moving the homepage to `/` is out of scope | 5 |
| G19 | Never add a `twitter` block — Next derives it | 6 |
| G20 | Count characters, don't eyeball | 6 |
| G21 | Owner approves every trimmed string first | 6 |
| G22 | ⛔ Normalise **then** `@id`, same commit — never `@id` first | 7 |
| G23 | Never fabricate a street address | 7 |
| G24 | `@id` is in-page only; dangling refs validate silently | 7 |
| G25 | Do NOT use `@graph` — atomic parse failure | 7 |
| G26 | The live geography bug — `"Luton, Luton"`, `"Dunstable, Luton"` | 7 |
| G27 | C5 governs every property added | 7 |
| G28 | `address` validation contested — test first, `Organization` fallback | 7 |
| G29 | ⛔ Every FAQ needs a keyboard-operable reveal control | 8 |
| G30 | Hide with `hidden`/`display:none`, not visually-only | 8 |
| G31 | `FAQPage` produces no Google appearance — budget zero | 8 |
| G32 | Never substitute `QAPage` | 8 |
| G33 | Zero test coverage on public components — show the diff | 8 |
| G34 | The four `Review` rules | 9 |
| G35 | ⛔ Never emit `aggregateRating` | 9 |
| G36 | Never retype as `Product` | 9 |
| G37 | Leave `ReviewsStatsStrip.tsx` alone | 9 |
| G38 | Google Maps ToS on 89 verbatim reviews — uncleared | 9 |
| G39 | C5 governs additions | 10 |
| G40 | The never-build list | 10 |
| **G41** | ⛔ Maintenance removal is the only irreversible **business** change — needs its own Owner instruction | 12 |
| **G42** | The `git status` baseline legitimately changes when `maintenance.ts` is deleted | 12 |
| G43 | The banner carried phone + email in server HTML — confirm the footer still does | 12 |
| G44 | Remove tests asserting the banner, don't leave them failing | 12 |
| **G47** | The gate baseline legitimately becomes **0 failed** — update §2.1 in the same commit | 11b |
| **G48** | ⛔ Never weaken an assertion to get green; two of the five guard permission boundaries | 11b |
| G49 | Once these pass, the "is this a regression?" reference is zero, not five | 11b |
| **G45** | ⛔ Push Phase 12 **before** Phase 2's discovery is live — no crawler may meet the banner | 13 |
| **G46** | ⛔ Submit the sitemap in Search Console **last** — that is the step that invites indexing | 13 |

---

## 16 — Rollback

### 16.1 — Before release (the normal case — nothing is pushed)

While the work is local and unpushed, **rollback is trivial and carries no external consequence.**
Undo a phase with `git reset` / `git revert` locally. Nothing has deployed, nothing is indexed,
nothing to retract. **This is the whole benefit of the local-first decision — use it.** Prefer
fixing a phase properly over stacking a correction commit on top.

### 16.2 — After release (Phase 13 onward)

Every phase is one commit or a small group. To undo a phase: `git revert <sha>` and push. Deploys
take ~3–4 minutes.

⛔ **THREE PHASES ARE NOT REVERTIBLE BY GIT ALONE:**

| Phase | Why revert is wrong / insufficient |
|---|---|
| **1 — `noindex`** | ⛔ **Never revert this.** Reverting deletes `robots: { index: false }` and **re-opens the customer-token indexing exposure.** If Phase 1 has a defect, **fix forward** |
| **2 — discovery** | Revert leaves a sitemap URL Google has been told about returning 404, and **cannot retract the Search Console submission.** Remove the sitemap in GSC as well |
| **9 — reviews** | Revert does not retract a structured-data manual action. Use the reconsideration process |

⛔ **Before every push:** `git show <sha>:src/lib/maintenance.ts` must read `MAINTENANCE_MODE = true`
in **each** committed tree. Verify the committed tree, not the working copy.
⛔ **Never** `git stash` or `git checkout` to "clean" the tree — it is intentionally dirty at exactly
` M src/lib/maintenance.ts`.

---

## 17 — Expectation setting

**Budget zero ranking or AI-citation gain from the structured-data work.** The best controlled
evidence measures the effect of adding JSON-LD on AI citations at approximately **zero**, and a
peer-reviewed study found **no Google ranking effect and no Maps effect**.

This work is justified as: meeting a documented required property currently unmet · removing five
conflicting business nodes, two phone formats, four wrong URLs and one broken pointer · fixing a live
factual geography error · ending the orphaning of six pages · closing a customer-privacy exposure ·
and a documented Bing/Copilot mechanism.

**The largest lever for the stated goal is the Google Business Profile, and it is not in this
repository.**
