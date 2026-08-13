# SEO/AEO/GEO — Phase 11 full review

**Plan:** `redesign/plans/SEO-AEO-GEO-IMPLEMENTATION.md` §14
**Run:** 2026-08-13, against the local dev server, `MAINTENANCE_MODE = false`
**Scope:** every change from Phases 1–10. Nothing pushed; production is untouched.

---

## §14.1 — Mechanical: ALL CHECKS PASS

```
1. SITEMAP        200 · exactly 18 URLs · all trailing-slashed · canonical origin
                  no priority/changefreq · no lastmod
                  no /admin, /api, /booking/manage or redirecting URLs
2. ROBOTS         Sitemap: line present and absolute
                  /admin NOT disallowed (auth-gated instead)
                  no noindexed path is disallowed  ← the trap, guarded
                  /api/ disallowed
3. ALL 18 URLS    200 · self-canonical · no robots meta
4. JS-DISABLED    all 18 carry an h1, a service word, a place name, 200+ words
5. SENTINELS      no "Luton, Luton" · no "Dunstable, Luton"
                  no aggregateRating anywhere · all JSON-LD parses
6. PRIVATE        /booking/manage, /admin/login, /admin/password-reset all noindex
7. DISCOVERY      /areas reachable from /home/ · /privacy linked
                  / redirects in ONE hop to /home/
```

**§14.1.4 is the load-bearing AEO check.** A plain `fetch()` is exactly what a non-rendering
crawler receives — GPTBot, ClaudeBot and PerplexityBot do not execute JavaScript. Every indexable
page carries its heading, a service word and a place name without JS.

## Entity consistency

```
@id values       1   https://rahmatherapy.uk/#business
telephone        1   +447798897222
url              1   https://rahmatherapy.uk/home/
areaServed       1   "Luton and surrounding areas"
business nodes   16
dangling @id     0
parse failures   0
```

## §14.2 — Visual: clean, with one expected delta

40 full-page captures (20 routes × 1280 and 375) in the session scratchpad under `after/`;
geometry in `after/geometry.json`. **PNGs are not committed** — 44.5 MB, same reasoning as the
Phase 0 baseline.

| | Baseline | Now | |
|---|---|---|---|
| Header links | 16 | **16** | unchanged, as intended — the nav was not touched |
| Footer links | 12 | **15** | +3: "Areas We Cover", "Privacy", "Cookies" |
| Horizontal overflow | 0 | **0** | |
| Failed requests | 0 | **0** | |

Footer count is **15 on every page** except `/booking/manage`, which has no footer. The delta is
uniform and fully explained; nothing else moved.

**FAQ tabs, driven in a real browser:** all 7 tabs clicked, each reveals exactly one correct panel,
exactly one `aria-selected` throughout, and the per-tab question counts sum to **31**
(4+5+4+5+4+5+4) — the complete set. 31 questions in the DOM, 4–5 visible at a time, exactly as
before the change.

**Lighthouse (mobile):** Accessibility **100** · SEO **100** · Agentic Browsing **100** ·
Best Practices **96**.

---

## ⚠️ The one non-green result, diagnosed and dismissed

Best Practices lost 4 points on a single audit, `errors-in-console`. The item:

```
429 Too Many Requests — http://localhost:3000/monitoring/?o=…
```

`/monitoring` is Sentry's tunnel route. **This is self-inflicted and not a defect:**

- A **single** page load with no other traffic produces **zero** non-2xx responses.
- The error appeared on *every* page during a 40-load rapid sweep, thinned to 4 pages when the
  sweep was paced at 1.5 s, and vanishes entirely on an isolated load. That gradient is a rate
  limiter, not a bug.
- Hundreds of automated page loads were issued during this session; Sentry rate-limited the ingest.
- The only rate limiter in the codebase is a 60-second guard on **admin test emails**
  (`email-templates/actions.ts:348`) — nothing touching public pages.
- `/monitoring` is already `Disallow`ed in the robots.txt shipped in Phase 2.

Real users at normal traffic will not hit this. **Re-check at release**, when the site is not being
swept by a test harness — if `errors-in-console` is clean there, Best Practices returns to 100.

## A measurement bug worth recording

The first tab-interaction check reported `correctPanel: false` for 6 of 7 tabs. That was **the test,
not the page**: it clicked and read the DOM synchronously, before React had flushed the state
update, so it kept reading the *previous* panel. With a 120 ms wait between click and assertion, all
7 pass. Anyone re-running an interaction check against this component needs that wait.

---

## §14.3 — Owner-side, NOT done here

1. **Google Search Console** — verify the property, submit the sitemap, record a baseline.
2. **Google Business Profile** — configure as a service-area business: address removed, service
   areas by city/postcode, within the 20-area cap.

⭐ On the evidence gathered for this workstream, item 2 outranks everything in this repository for
the stated goal. Neither can be done from the codebase.
