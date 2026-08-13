# SEO / AEO / GEO — design spec (the WHY)

**Written:** 2026-08-13 · **Revised twice:** primary-source fact-check, then a second research pass
**Base commit for all anchors:** `9271863` on `master`
**Implementation document:** `redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md` — **that** is what an
implementer follows. This file holds the decisions and the evidence behind them.
**Status:** decided. **Not implemented.** No `src/` file has been changed.

> ⛔ **Two research passes overturned much of the first draft.** 11 claims were checked against
> primary sources: 1 confirmed, 1 outdated, 9 partly wrong. A second pass then re-opened six of
> those with a challenger agent. **Do not implement from memory of any earlier draft.** §10 logs
> every correction.

---

## 0 — The decision this rests on

`POST-BAND-C-FOLLOWUP-plan.md` §0.2 listed *"no `sitemap.ts` / `robots.ts`, and 5 of 6 public pages
emit no canonical tag"* under **"Explicitly OUT of scope — do not touch. The Owner declined these."**
**The Owner reversed this on 2026-08-13.** §0.2 is annotated in place.

---

## 1 — Goal, scope, constraints

**Goal.** Rank and be recommended for **cupping** and **massage** across **Luton — broadly and
precisely** (the city plus its districts) and the two neighbouring towns served.

**In scope:** the 20 public URLs. **Out of scope:** `/admin`, `/api/*`.

### Constraint A — owner-authored copy must not change
**No visible page prose may be reworded.**
✅ **Owner ruling:** `seo: { title, description }` strings are **metadata, not prose** — length may
be corrected, **wording and tone preserved**, by trimming brand suffixes. `<h1>` text stays frozen.

### Constraint B — the canonical-domain tripwire
`canonical-domain.test.ts` fails on a **second** literal `https://rahmatherapy.uk` outside
`src/content/site/site-url.ts`. All new code **must** import `SITE_URL` / `siteUrl()`.

### Constraint C — trailing slash
`next.config.ts:43` sets **`trailingSlash: true`**. Every emitted URL carries it. ⚠️ Next's default
is the opposite — do not "fix" toward the default.

### ⛔ 1.1 — PRECONDITION: maintenance mode gates the discovery work

⛔ **An earlier draft of this spec claimed "crawlers see no maintenance text." That was WRONG** — the
check searched for the word *"maintenance"*, which appears **0 times** in the served HTML. The banner
does not use that word. Verified live 2026-08-13, in raw server-rendered markup on every public page:

> *"This website is still being built — online booking is not yet available. To get in touch:
> 07798 897222 (call, text, or WhatsApp) · rahmatherapy@outlook.com"*

`MaintenanceBanner` is a **server** component rendered from `src/app/(public)/layout.tsx` whenever
`MAINTENANCE_MODE` is true — which HEAD is. The discovery workstream — sitemap, `Sitemap:` directive, Search Console
submission — exists to trigger Google's **first-ever full indexing pass** over all 18 URLs.

⛔ **Doing both at once would have Google's first snapshot of this site be the "not ready" version,
and a `git revert` cannot un-index it.** This is the least reversible state in the entire plan.

### ✅ RESOLVED 2026-08-13 — by sequencing, not by accepting risk

**Owner decision:** all work is done **locally**, committed to `master` but **not pushed**. Cloudflare
deploys on **push**, not commit — so **nothing reaches Google until the Owner says go.**

**Maintenance removal becomes the final phase**, immediately before the first push. The sequence is:

```
build + verify everything locally  →  remove the maintenance system  →  re-verify
                                   →  THEN push, phase by phase
```

So Google's first indexing pass happens against a site with **no "still being built" banner at all.**
The blocker is eliminated rather than mitigated. **No page may be pushed while the banner ships.**

### Constraint D — the governing markup rule
> **Mark up what the page already says. Never what it doesn't.**

Google's policy forbids marking up content not visible to readers, **and** independent research shows
LLMs often cannot extract facts from JSON-LD when the visible HTML doesn't restate them. Under a copy
freeze the compliant option and the effective option are the same option. This single rule decides
most of §3.

---

## 2 — The Owner's decision rule, refined

The Owner's rule: *"cheap + no penalty risk + might plausibly help machines understand us = keep it,
even without proven ranking benefit."*

It held up. Both research passes independently proposed the same two additional legs:

| Leg | Test | What it catches |
|---|---|---|
| 1 | Cheap? | — |
| 2 | No penalty risk? | Rejects `aggregateRating` |
| 3 | Is there a **live mechanism**, not merely absence of disproof? | Rejects **`llms.txt`** — 97% of published files got zero requests |
| 4 | Is that mechanism **reachable on our architecture**? | Rejects the **sitelinks `WebSite` node** — it requires the root URI, and our root 308-redirects |

---

## 3 — Decisions

### 3.1 — Discovery

| Decision | Why |
|---|---|
| **Sitemap: 18 URLs**, trailing-slashed, slugs derived from data not hand-listed | Verified 2026-08-13: all 18 return 200, none redirects, **0 noisy URLs** |
| **Omit `priority` and `changefreq`** | Google: *"Google ignores `<priority>` and `<changefreq>` values."* Bing likewise |
| **`lastmod` from real git commit dates; omit rather than guess** | Trust is **binary and site-wide** — Illyes: *"we either trust it or we don't."* Never `new Date()` at build time, or every Cloudflare deploy restamps all 18 and forfeits the field permanently |
| **Submit in Search Console AND reference in robots.txt** | GSC only reports errors for sitemaps submitted there. The ping endpoint has been dead since end-2023 |

**Excluded from the sitemap, each confirmed noisy:** `/` (308), `/areas/luton/` (308),
`/booking/manage/` (noindex), `/admin/` (307 → login), `/api/*` (405).

### 3.2 — robots.txt ⛔ *reversed twice — read the reasoning*

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /monitoring

Sitemap: https://rahmatherapy.uk/sitemap.xml
```

| Decision | Why |
|---|---|
| **Do NOT `Disallow: /admin/`** | `/admin` is **not linked from a single public page** — adding it would be the *first public advertisement* that the path exists. Crawl budget is irrelevant: Google's own guide applies from **10,000+ pages**; this site has ~20 |
| **`Disallow: /api/`, `/monitoring`** | Verified render-safe — all 9 API handlers are **POST-only, zero GET**. `/monitoring` is the Sentry tunnel |
| **`noindex`, never `Disallow`, for pages that must leave the index** | ⛔ **The trap:** *"For the noindex rule to be effective, the page must not be blocked by a robots.txt file… the crawler will never see the noindex rule."* Disallow + noindex is **strictly worse than noindex alone** |
| **Allow every AI crawler** | See below |

**Standing rule:** no URL may appear in both a `Disallow` and a `noindex`. Worth a test.

**AI crawlers — the distinction that matters.** "AI crawler" is not one thing:

| Bot | Purpose | Blocking costs you |
|---|---|---|
| `GPTBot`, `ClaudeBot`, `CCBot` | Model **training** | Nothing in search |
| **`OAI-SearchBot`, `Claude-SearchBot`** | **Search/citation index** | **Your AI citations** |
| `ChatGPT-User`, `Claude-User` | User-triggered fetch | Live retrieval |
| `Google-Extended` | Gemini grounding | Gemini grounding only — Google states it is **not** an inclusion or ranking signal in Search |

Since the goal is AI visibility: **allow all.** Currently nothing is blocked — seven crawler
identities were tested and all returned identical 200s.

⚠️ **Cloudflare PREPENDS, it does not replace.** After deploy you will see Cloudflare's 24 comment
lines *above* your directives. **That is normal.** Verify by checking your `Sitemap:` line is
present — not by expecting a clean file. Do not disable the managed file.

### 3.3 — Linking the area cluster ⛔ *rationale corrected*

**Decision (Owner, 2026-08-13): one "Areas We Cover" link in the FOOTER ONLY, pointing at the hub
`/areas`. The main nav is left untouched at 5 items. The five spokes stay reachable through the hub.**

⚠️ **An earlier draft of this section recommended nav + footer. The Owner chose footer only, and the
research supports that being a free choice:** Mueller states link position — header, footer, or body
— is *"pretty much irrelevant"* to Google, so the machine-understanding delta between nav and footer
is ~zero. The footer renders on **all 18 indexable pages** — ⛔ *corrected 2026-08-13: this said "20".
`SiteFooter` renders only from `(public)/layout.tsx`, so `/` and `/areas/luton/` redirect without
rendering it, and `/booking/manage/` sits outside that route group* — so the hub still gains a
site-wide inbound link and every spoke still lands two clicks from every page. **The nav stays at its
designed 5 items.**

The earlier doorway-page justification does **not** survive primary sourcing: the "orphaned pages
look like doorways" heuristic came from a 2015 Google doc whose self-assessment questions **did not
survive** the 2022 move into Search Essentials, and the current spam-policy page never mentions
navigation, footers or internal links. Mueller: link position is *"pretty much irrelevant."*

**The real reason to link is discovery, and it is decisive:**
> No internal link **+** no sitemap **+** no `Sitemap:` directive = **no discovery path at all**
> except external links. And a page that is not indexed **cannot be cited by any AI engine** —
> which defeats the AEO/GEO goal directly.

Both researchers and every local-SEO specialist consulted agree: link them. Nav-vs-footer is a **UX**
call, not an SEO one.

⛔ **CORRECTED 2026-08-13.** This sentence used to continue: *"chosen as **both** because the nav and
footer link arrays are currently identical, so footer-only would make `/areas` the only top-level
page missing from the nav; and for a mobile business 'do you come to my area?' is the first
qualifying question."* That was the pre-decision draft's recommendation and it is **superseded** by
the Owner's **footer-only** decision at the head of this section — `navigation.ts` was never touched
and `primaryNavigation` is still 5 items. The reasoning is kept rather than deleted so a later reader
can see that nav placement was considered and deliberately rejected, not overlooked.

⚠️ **The genuine risk is elsewhere.** Current policy tests *"substantially similar pages"* and, since
2024-03-05, **scaled content abuse**. The six spokes are structurally identical (11 `<h2>`, 18
`<h3>`, 13 images, 1,465–1,492 words). Mitigation is differentiation — unique titles (§3.4), correct
per-area geography (§3.5), distinct anchors — all reachable without touching copy. Exposure is low:
six pages for a real service area, each with 135–170 words of genuinely local prose, 4 unique cards,
4 unique FAQs and 3 non-overlapping testimonials, is nowhere near scaled-content volume.

### 3.4 — Canonicals and metadata

**Coverage is the work:** add `alternates: { canonical: siteUrl("/<path>/") }` to the six routes
lacking it — `home`, `about`, `services`, `services/[slug]`, `reviews`, `faqs-aftercare`.
Self-referencing canonicals remain explicitly recommended; it is a **hint, not a rule**.

**Regression guard (not a live bug):** canonical must derive from the **static route path**, never
`searchParams`. This holds for free today — `?booking=1` is client-side only.

**Title/description lengths** — length only, wording preserved:
- **`/reviews/` title, 29 chars** — the weakest title on the highest-content page, and carries
  neither keyword. The one case needing more than a trim.
- **Area titles 74–87** — dropping the trailing `| Rahma Therapy` from the six area pages fixes most.
- **`/faqs-aftercare/` description, 191** · `/home`, `/about`, `/services` at 168–173.

### 3.5 — Structured data

**(a) One business node, and an ordering trap.**

⛔ **Normalise the facts and add the `@id` in the SAME commit. Never `@id` first.** The five business
nodes currently disagree — two phone formats, four different `url` values. RDF merge is *additive*,
so adding a shared identifier first merges the contradictions into one entity asserting both phone
numbers.

- `@id` = **absolute** `https://rahmatherapy.uk/#business`, never bare `#business` (a relative
  fragment resolves against the document, yielding a different identity per page).
- **Emit the full node on every page.** `@id` resolves **within a page only** — Google calls them
  *"in-page node identifiers"*, and one source states outright that Google does **not** merge across
  pages by `@id`.
  ⛔ **CORRECTED 2026-08-13.** An earlier draft claimed the area pages "reference a node defined
  nowhere" and "ship a `provider` with no name and no address." **That was wrong.**
  `area-json-ld.ts:19-25` defines the provider **inline and self-sufficiently**: `@id`, `@type`,
  `name: "Rahma Therapy"`, `telephone`, `areaServed`. It is not a dangling reference.
  **The real defect is narrower:** that node is missing `address`, `url` and `sameAs`, and its
  `areaServed` string (`"Luton and surrounding areas"`) disagrees with the five page-level nodes
  (`"Luton"`). The `@id`-must-be-defined-in-page rule stays as forward-looking guidance — it is not
  a description of today's state.
- ⛔ **Do NOT use `@graph`.** Vendor convention, but it makes parsing atomic: one formatting error
  voids *all* structured data on the page instead of one block. Current separate blocks fail
  independently — safer.

**(b) Address — a required property currently unmet.**
Google lists exactly two required LocalBusiness properties: `name` and `address`. The site has no
address anywhere, so all 15 business-node emissions fail the entry gate.

**Decision: truthful partial `PostalAddress` — `addressLocality: "Luton"`,
`addressRegion: "Bedfordshire"`, `addressCountry: "GB"`, NO `streetAddress`.** Every fact appears in
visible copy, so it satisfies Constraint D, and it exposes no premises.
⚠️ **Verify in the Rich Results Test before shipping** — validator behaviour for address-less
service-area businesses is contested. **Fallback:** `Organization` (Google documents zero required
properties).
⛔ **Never fabricate a street address** — GBP suspension risk, far worse than a markup warning.

**(c) Geography — fixes D13, a live factual error.**
Districts as `Place` with **`containedInPlace`** → a `City` node for Luton; Luton, Dunstable and
Houghton Regis typed `City`, never suffixed into each other. Use `areaServed` (not the superseded
`serviceArea`) and `containedInPlace` (not `containedIn`). Do not put `containedInPlace` on the
business node.

**(d) `sameAs` — the best value on the table.** Point at the Google Business Profile listing and
Instagram. `googleReviewsUrl` already exists in `src/lib/content/reviews.ts`. This is the *documented*
cross-source entity signal, it lets machines resolve 5.0-from-177 **at its authoritative source**
rather than as a copied number, and it asserts nothing falsifiable. Zero risk, best ratio.

**(e) Type.** Keep `HealthAndBeautyBusiness`. ⛔ **Reject `MedicalBusiness`** — no subtype covers
hijama, and a clinical type invites the *"misrepresent your primary purpose"* clause plus YMYL
scrutiny.

### 3.6 — FAQs

**Server-render all 31.** ✅ Confirmed safe: Google's spam policies explicitly list *"Accordion or
tabbed content that toggle between hiding and showing additional content"* as **NOT** a violation,
and no live doc down-weights collapsed content.

⛔ **Hard gate:** every FAQ must be reachable by a **visible, keyboard-operable control.** The
FAQPage doc's "expandable answer is valid" exemption was **deleted on 2026-06-15**, leaving only
Constraint D.

**The justification is retrieval, not rich results:** no major AI crawler except Googlebot executes
JavaScript, so client-only content is invisible to ChatGPT, Claude and Perplexity.

**`FAQPage` markup — ✅ SHIP IT, on the Owner's rule.** It is genuinely inert: no errors, no manual
action, no penalty. It produces **no Google search appearance** (feature removed 2026-05-07, docs
deleted 2026-06-15, GSC API removed August 2026) and this site was **already ineligible from
2023-09-14** — so the deprecation removes nothing it had. Kept as cheap, riskless, plausibly useful
for machine understanding. **Budget zero benefit.**
⛔ **Do NOT substitute `QAPage`** — its live doc forbids it verbatim for FAQ pages.

### 3.7 — Reviews

| Element | Decision |
|---|---|
| **`sameAs` → Google listing** | ✅ **Do first.** Zero risk, best value, puts the real rating at its authoritative source |
| **`Review` objects** | ⛔ **DROPPED — Owner decision 2026-08-13.** Not on SEO grounds: the Google Maps terms question on reproducing 89 reviews verbatim (G38) is **unresolved**, and it is a licensing question, not an SEO one. `sameAs` captures most of the benefit at zero risk. The four hard rules are retained below **only** as the specification to follow if this is ever revisited |
| **`aggregateRating`** | ⛔ **Never.** Not from the GBP 5.0/177, not computed from the 89 |
| **`Product` retype to chase stars** | ⛔ **Never.** A false type claim — the only path with genuine spam exposure |
| **`ReviewsStatsStrip.tsx`** | Leave alone. It is page copy, honestly labelled. Guidelines govern **markup**, not visible copy |

**Why no `aggregateRating`:** not a ranking penalty — a structured-data manual action *"doesn't
affect how the page ranks."* The exposure is **collateral**: it causes **all** structured data on the
page to be ignored, forfeiting working breadcrumbs and entity signals for a star rating the site has
been ineligible for since 2019. Two current bullets bite directly — *"Ratings must be sourced
directly from users"* and *"Don't rely on human editors to create, curate, or compile ratings
information for local businesses"* — plus *"Don't aggregate reviews or ratings from other websites."*

⛔ **Four hard rules for `Review` objects** (the first research pass's own template broke three):
1. **Only reviews present in the server-rendered HTML** (~24 of 89) — derived in code from the same
   source the components use, **never hand-listed**, or it silently desyncs.
2. **`ratingValue` reads the real rating.** **Two reviews are 4-star**, not 5.
3. **Omit `datePublished` entirely.** Dates are relative (`"4 years ago"`); converting means inventing.
4. **`reviewBody` byte-identical** to the visible text; `author.name` exactly as displayed.

⚠️ **Outside SEO entirely:** reproducing 89 Google reviews verbatim on your own site is a Google Maps
terms/copyright question. **Nothing in this research cleared it.**

### 3.8 — Structural and privacy fixes

| # | Fix | Why |
|---|---|---|
| ⚠️ **P1** | **`robots: { index: false }` on `/booking/manage`** | Renders a customer's booking from a `?token=` in the URL, and there is **no `noindex` anywhere in the codebase**. If a link leaks, the URL can be indexed. **Privacy, not ranking** — which is why an SEO-framed review nearly missed it. Must stay **crawlable** so the noindex is seen |
| P2 | `noindex` on `/admin/login`, `/admin/signout`, `/admin/password-reset` **(subtree)** | The three the middleware exempts — the only publicly reachable admin URLs |
| P3 | `permanentRedirect("/home")` → `"/home/"` | Removes a redundant redirect hop on the strongest URL |
| P4 | `/privacy`, `/cookies`: `<h2>` → `<h1>` | **No words change** — only the tag |
| P5 | Populate `legalLinks` in `footer.ts:26` | A UK privacy policy unreachable from any page is a **compliance** concern |
| P6 | `lang="en"` → `lang="en-GB"` | UK business |

### 3.9 — Additions worth making

Breadcrumbs on `/about/`, `/services/`, `/services/[slug]/`, `/faqs-aftercare/` ·
**therapists as `Person` entries** with CMA/IPHM credentials (makes *"female therapist in Luton"*
machine-readable) · `founder`, `logo`, `image`, `email` on the business node · per-page OpenGraph
derived from existing `seo` strings · `serviceType` as an **array** of distinct services so "cupping"
and "massage" are separately addressable per place.

### 3.10 — ⛔ Never build (all confirmed dead or inert here)

`meta keywords` (the only item with an active downside — Bing has treated stuffing as a spam signal)
· `HowTo` · `rel=prev/next` · sitemap `priority`/`changefreq` · `rel=me`/authorship · Data Highlighter
· AMP · keyword-density targets · exact-match anchor ratios · meta description as a ranking factor ·
**sitelinks `WebSite`/`SearchAction`** (retired 2024-11-21, *and* it requires the root URI, which
308-redirects here — fails leg 4) · `speakable` (US news only) · **`llms.txt`** (fails leg 3) ·
`QAPage` as an FAQ substitute · `openingHoursSpecification`, `paymentAccepted`, `currenciesAccepted`,
`knowsLanguage`, `foundingDate`, `streetAddress` — all unbackable under Constraint D.

---

## 4 — What actually drives the goal

⛔ **Re-ranked by evidence.** The first draft led with structured data. That was wrong.

1. **Server-rendered HTML.** The only item with hard mechanism evidence — no major AI crawler except
   Googlebot executes JavaScript. §3.6 serves this directly.
2. **Off-site presence** — §6. For a local business this outranks everything in the repo.
3. **Structured data** — keep for **correctness and entity understanding**, not citation.

**On schema and AI, honestly.** Microsoft's Fabrice Canel is on record that schema helps Microsoft's
LLMs understand content for Copilot — an engine operator describing its own pipeline, and the
strongest evidence available. A controlled study (29 domains, methodology peer-reviewed *before*
results by Yoast and Moz people) found **no Google ranking effect and no Maps effect**, but ChatGPT
position +3.33 at 92.9% confidence. ⚠️ **That positive is weaker than it looks:** ~6 endpoints,
one-tailed, 90% threshold, **no correction for multiple comparisons** — one or two positives at
91–93% across six tests is close to noise. A separate large study (1,885 pages vs 4,000 matched
controls) measured the effect of adding JSON-LD on AI citations at approximately **zero**.

**So: budget zero ranking or citation gain.** Justify the schema work as (a) meeting a documented
required property currently unmet, (b) removing five conflicting anonymous business nodes, two phone
formats, four wrong URLs and one broken pointer, (c) a documented Bing/Copilot mechanism, (d) cheap
option value. That is exactly the Owner's rule.

---

## 5 — Core Web Vitals: measured, closed

LCP **482 ms** · CLS **0.00** · TTFB 298 ms · Lighthouse mobile A11y/BP/SEO **100**.
**No action required.** All 31 FAQs are **4.1 kB** of raw text on a 109 kB page served with
**brotli** — ~1–2 kB over the wire. Caveat: no CrUX field data exists (too few visitors — a symptom
of the discovery problem, not a performance one).

---

## 6 — Off-site: worth more than this entire document

1. **⭐ Google Business Profile as a service-area business.** *"If you don't serve customers at your
   business address, remove your address from your Business Profile."* Service areas by **city or
   postcode, never radius**; **max 20**; within ~2 hours' drive. Luton + districts + the two towns
   fits easily. The controlled study's **zero Maps effect** is direct evidence that on-page markup
   cannot substitute for this.
2. **⭐ Google Search Console** — not set up. Without it you cannot submit the sitemap or see what you
   rank for. **Not analytics**; does not conflict with the deliberate `no-google-analytics` decision.
   Now includes **Generative AI performance reports** (impressions only — no clicks, so CTR cannot
   be a KPI).
3. **Rating and review habit** — the supported path to visible stars.
4. **NAP consistency** across Maps, Facebook and UK directories.

---

## 7 — One ask for the Owner

**A single line of visible copy naming the languages the therapists speak.** It is the one narrow
exception to the copy freeze both research passes independently flagged as worth requesting — it
would unlock `knowsLanguage` and is plausibly the highest-value sentence available for a Bury Park
audience. **Owner's call; nothing depends on it.**

---

## 8 — Fact-check log

**Pass 1** (11 claims vs primary sources): 1 confirmed · 1 outdated · 9 partly wrong.

| Claim | Correction |
|---|---|
| FAQ rich results restricted to gov/health | **Feature fully removed 2026-05-07**; docs deleted; API removed Aug 2026 |
| Review markup "harmless, do for AEO" | Curated/editor-compiled ratings breach two current bullets |
| robots.txt Disallow admin — "harmless" | **Wrong tool.** Disallow+noindex trap |
| Canonicals "consolidate" params | A **hint**; the work is coverage; pin slash **with** slash |
| Structured data drives LLM citation | **Disconfirmed** — Google says no markup needed; study null |
| `llms.txt` neutral | **Do not ship** — 97% got zero requests |
| LocalBusiness with no address | **`address` is REQUIRED** |
| Site-wide `@id` referenced across pages | **In-page only**; emit the node in full per page |
| Nav linking reduces doorway risk | **Retired 2015 folklore**; link for **discovery** instead |
| Hidden content eligible for FAQPage | Indexing half confirmed; eligibility half dead |
| Sitemap hygiene | ✅ Confirmed; add omit-`priority`/`changefreq`, binary `lastmod` |

**Pass 2** (6 questions, each stress-tested by a challenger) added: the `@id` **ordering trap**;
**no `@graph`**; the `/admin` **path-disclosure** argument; the **training-vs-search** AI-bot
distinction; Cloudflare **prepends**; the four `Review` rules; the **multiple-comparisons** caveat on
the one positive study; and the **`/booking/manage` privacy finding**.
