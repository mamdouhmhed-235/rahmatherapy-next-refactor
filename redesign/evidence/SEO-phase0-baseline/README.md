# SEO/AEO/GEO — Phase 0 baseline

**Plan:** `redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md` §3 (Phase 0)
**Captured:** 2026-08-13, commit `efc7484`
**Source:** ⛔ **local dev server** `http://localhost:3000` (Owner-run), **`MAINTENANCE_MODE = false`**
**Harness:** Playwright 1.59.1, cached chromium-1234, viewports **1280×900** and **375×812**
**Routes:** all 20 public URLs

> ⛔ **Pin the comparison source.** Per the plan's G-note, baseline and later capture must share one
> source and one maintenance state. This baseline is **local, flag `false`** — deliberately, because
> that is also the **post-Phase-12 end state** (maintenance removed). Do **not** compare it against
> production, which currently renders the maintenance banner and a layout spacer.

## Files

| | |
|---|---|
| `probe-baseline.json` | 40 structural probes (20 routes × 2 viewports). **This is the regression oracle** — it is diffable and small |
| Screenshots | ⛔ **NOT committed.** 40 full-page PNGs, **44.5 MB**, in the session scratchpad under `scratchpad/baseline/{1280,375}/`. Committing them would repeat the C-21 mistake this workstream already gitignored (24.6 MB of PNGs referenced by a tracked doc) |

## Health at baseline — all clean

```
console errors ......... 0 / 40 probes
failed requests ........ 0 / 40 probes
horizontal overflow .... 0 / 40 probes
images missing alt ..... 0
maintenance text ....... 0 / 20 routes   (local, flag=false — as expected)
```

## Defects confirmed, and which phase closes each

| Baseline fact | Phase |
|---|---|
| `/booking/manage/` emits **no robots meta** — customer tokens indexable | **1** |
| Area JSON-LD `areaServed` is `"<name>, Luton"` for every area — so `"Luton, Luton"` and `"Dunstable, Luton"` | **1b** |
| **No sitemap, no robots.txt** | **2** |
| **Canonical missing on 11 routes**: `/home/ /about/ /services/ /reviews/ /faqs-aftercare/`, all 5 package pages, `/booking/manage/` | **3** |
| **0 of 5 core pages link to `/areas`** — the cluster is reachable only from itself (6 pages link to it, all inside the cluster) | **4** |
| `/privacy/` and `/cookies/` have **h1 = 0** | **5** |
| `/reviews/` emits **`BreadcrumbList` only** — no business node despite 1,830 words of reviews | **7** |
| `/home/` emits `HealthAndBeautyBusiness` only — no `address`, no `sameAs` | **7** |
| `/privacy/`, `/cookies/`, `/booking/manage/` emit **no JSON-LD at all** | 7 / n-a |

## Link sets at baseline (Phase 4 must change exactly these)

```
header: /home/  /services/  /about/  /reviews/  /faqs-aftercare/   (5 internal)
footer: /home/  /services/  /about/  /reviews/  /faqs-aftercare/   (5 internal, + tel/mail/social)
legal : (none — legalLinks is [])
```

## Word counts — the area-page similarity the plan flags

`/areas/` 1291 · bury-park 1358 · leagrave 1352 · stopsley 1321 · dunstable 1326 · houghton-regis 1340

Tight clustering across six structurally identical pages is the "substantially similar pages" exposure
the spec discusses (§3.3). Differentiation via titles and per-area geography is the mitigation; the
copy itself is frozen.

## How to re-run

```bash
node <scratchpad>/capture-baseline.mjs
```

Requires the Owner's dev server up at `localhost:3000`. The script resolves Playwright from the repo
via `createRequire` (it lives outside the repo) and launches the cached chromium-1234 build, because
the repo's Playwright expects a revision that is not in the local browser cache.
