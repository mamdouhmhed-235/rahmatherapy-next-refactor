# C-21 — visual-regression evidence (plan §3.5)

**Plan:** `redesign/plans/C-phase/C-21-canonical-domain-fix-plan.md` §3.5
**Commit under test:** `38ff24c` — *fix(seo): canonical domain — single source of truth + correct site URL*
**Captured:** 2026-07-27, dev server `http://localhost:3000` (Next dev, `trailingSlash: true`)
**Harness:** `mcp__playwright__*`, Chromium, viewport 1280×900 (`clientWidth` 1265 after the 15 px scrollbar) and 375×812 (`clientWidth` 360)
**Method:** full-page PNG per page + DOM probe per page (header/footer/section presence, `documentElement.scrollWidth` vs `clientWidth`, real overflow scan excluding elements inside `overflow-x` containers, broken-image scan, `mailto:` href + text, domain-literal counts in the served HTML) + `browser_console_messages` per navigation + `browser_network_requests`.

---

## Verdict

# NO VISUAL REGRESSION

All 12 public pages render fully and identically in structure at 1280. Zero console errors anywhere. Zero failed network requests. The single intentional delta — the published clinic contact address — is correct on all 12 pages.

---

## 1280 sweep

| Page | Screenshot (`redesign/evidence/C-21/`) | Renders OK | Console errors | Contact address correct |
|---|---|---|---|---|
| `/` (308 → `/home/`) | `viewport-1280-root-redirect.png` | Y | none | Y |
| `/home` | `viewport-1280-home.png` | Y | none | Y |
| `/about` | `viewport-1280-about.png` | Y | none | Y |
| `/services` | `viewport-1280-services.png` | Y | none | Y |
| `/reviews` | `viewport-1280-reviews.png` | Y | none | Y |
| `/faqs-aftercare` | `viewport-1280-faqs-aftercare.png` | Y | none | Y |
| `/areas` | `viewport-1280-areas.png` | Y | none | Y |
| `/areas/bury-park` | `viewport-1280-areas-bury-park.png` | Y | none | Y |
| `/areas/leagrave` | `viewport-1280-areas-leagrave.png` | Y | none (1 warning — see below) | Y |
| `/areas/stopsley` | `viewport-1280-areas-stopsley.png` | Y | none (1 warning — see below) | Y |
| `/areas/dunstable` | `viewport-1280-areas-dunstable.png` | Y | none | Y |
| `/areas/houghton-regis` | `viewport-1280-areas-houghton-regis.png` | Y | none | Y |

### Render/layout detail (1280)

| Page | `<header>` | `<footer>` | `main section` count | `scrollWidth`/`clientWidth` | Horizontal overflow | Broken images | Next.js error overlay |
|---|---|---|---|---|---|---|---|
| `/` → `/home/` | Y | Y | 10 | 1280 / 1280 | none | 0 | none |
| `/home` | Y | Y | 10 | 1265 / 1280 | none | 0 | none |
| `/about` | Y | Y | 5 | 1280 / 1280 | none | 0 | none |
| `/services` | Y | Y | 6 | 1280 / 1280 | none | 0 | none |
| `/reviews` | Y | Y | 7 | 1280 / 1280 | none | 0 | none |
| `/faqs-aftercare` | Y | Y | 8 | 1280 / 1280 | none | 0 | none |
| `/areas` | Y | Y | 13 | 1280 / 1280 | none | 0 | none |
| `/areas/bury-park` | Y | Y | 13 | 1280 / 1280 | none | 0 | none |
| `/areas/leagrave` | Y | Y | 13 | 1280 / 1280 | none | 0 | none |
| `/areas/stopsley` | Y | Y | 13 | 1280 / 1280 | none | 0 | none |
| `/areas/dunstable` | Y | Y | 13 | 1280 / 1280 | none | 0 | none |
| `/areas/houghton-regis` | Y | Y | 13 | 1280 / 1280 | none | 0 | none |

An `h1` is present and correct on every page. The overflow scan flags nothing outside `overflow-x` scroll containers; the elements that do sit beyond 1280 on `/home` are the cards inside the intentionally horizontally-scrollable package carousel, and the document itself never scrolls sideways.

---

## Console

Across all 12 pages: **0 errors, 2 warnings.**

| Page | Level | Message | Classification |
|---|---|---|---|
| `/areas/leagrave` | warning | `Image with src "/images/areas/package-photos/massage-session-c.jpg" was detected as the Largest Contentful Paint (LCP). Please add the loading="eager" property if this image is above the fold.` | **Pre-existing** — a Next.js `<Image>` priority hint in dev. Nothing in C-21 touches image components or area-page markup. |
| `/areas/stopsley` | warning | same LCP hint, same image | **Pre-existing**, same cause |

The known `caret-color:transparent` hydration warning (HANDOFF §1.10) **did not appear** in this sweep.

---

## Network

`browser_network_requests` (including static assets) on `/` → `/home/` (57 requests) and `/areas/bury-park/` (56 requests): every response is `200`, `206` (hero video range request), `304`, or the expected `308` trailing-slash / `/monitoring` redirects. **No 4xx or 5xx, no failed asset.**

---

## The one intentional visual delta — clinic contact address

Confirmed on **12 / 12 pages**:

- rendered text is `rahmatherapy@outlook.com`
- every `mailto:` href is exactly `mailto:rahmatherapy@outlook.com`
- `hello@rahmatherapy.co.uk` appears **nowhere** — not in visible text, not anywhere in the served HTML (`outerHTML.includes(...)` false on all 12)
- `rahmatherapy.co.uk` and `rahmatherapy.com` literal counts in the served HTML: **0 on all 12 pages**; `rahmatherapy.uk` appears 6–16 times per page (OG/Twitter image URLs, JSON-LD `url`/`item`, area canonicals)

The address renders in three places per page: the in-page contact block, the mobile header menu, and the footer contact column.

**Reflow check on the changed string.** The new address is 12.8 px wider than the old one at the footer's 14 px `Work Sans` (193.3 px vs 180.5 px). At 1280 the footer link box ends at x=1253 inside a 1265 px content width, its shrink-wrapped column is exactly as wide as the link, nothing is clipped (`scrollWidth == clientWidth`), and the link stays on one line. At 375 all three instances are single-line and inside the viewport (footer link 8→229, header-menu link 19→212, in-page link 82→279, viewport 360). No wrap, no truncation, no overflow.

---

## 375 results (Part 0 mobile-first)

| Page | Screenshot | Renders OK | Horizontal overflow | Console errors | Contact address |
|---|---|---|---|---|---|
| `/home` | `viewport-375-home.png` | Y — header, hero, 10 `main section`s, footer | none (`scrollWidth` 375 = `clientWidth` 375; 0 real overflow elements; `body.scrollWidth` 375) | none | Y |
| `/areas/bury-park` | `viewport-375-areas-bury-park.png` + `viewport-375-areas-bury-park-lower.png` | Y — header, hero, 13 `main section`s, footer | none (`scrollWidth` 360 = `clientWidth` 360; 0 real overflow elements) | none | Y |

No broken images and no Next.js error overlay on either. Nothing is clipped or misaligned in the captures.

**Why `/areas/bury-park` at 375 is two files.** The page is 18 935 px tall at 375 CSS px, past Chromium's ~16 384 px raster limit, so `fullPage` capture fails outright (`Protocol error (Page.captureScreenshot): Unable to capture screenshot`, reproduced twice). It was captured instead as two 375×9600 viewport shots with the viewport temporarily set to 9600 px tall: `viewport-375-areas-bury-park.png` (top, y 0–9600) and `viewport-375-areas-bury-park-lower.png` (bottom, y 9818–19418). Together they cover the whole page with overlap. All the numeric 375 measurements above were taken at the true 375×812 viewport, not the tall one.

---

## Not checked, and why

1. **Pixel-for-pixel diff against a pre-C-21 baseline.** No pre-C-21 captures exist (`redesign/evidence/` did not exist before this run), and producing one would require checking out `38ff24c^`, which §1.5 / §2.3 forbid on this shared working tree. "No visual regression" is therefore established two other ways: (a) the commit's diff contains no JSX, CSS, class-name or component-markup change on any public surface — `layout.tsx` changes only `metadataBase`, the five public `page.tsx` files and the two area routes change only `metadata`/JSON-LD string values, `area-json-ld.ts` swaps a file-local const for an import, and the sole rendered-DOM change in the whole commit is the two strings in `src/content/site/contact.ts`; (b) all 12 pages were verified to render complete and overflow-free with the measurements above.
2. **Structured-data validity via Google's Rich Results Test** (plan §3.3) — explicitly a user-performed external check; out of scope for an agent.
3. **Post-deploy Search Console actions** (plan §3.6) — Owner actions, nothing to verify locally.
4. **Production `NEXT_PUBLIC_SITE_URL`** (Step 1a, ⛔ Zone-2) — orchestrator/Owner action, not verifiable from a dev browser.

## Observation, not a regression (flagged, not fixed)

`/home`, `/about`, `/services`, `/reviews`, `/faqs-aftercare` and `/` serve **no `<link rel="canonical">` at all** — those five pages never declared `alternates.canonical`; C-21 only corrected their JSON-LD `url`/`item` values, which are now all `https://rahmatherapy.uk/...`. The six area pages do emit a canonical, and each is correct (e.g. `https://rahmatherapy.uk/areas/bury-park/`). This is a pre-existing SEO gap in the same family as the missing `sitemap.ts`/`robots.ts` already flagged in plan §7.5 — raising it, not fixing it.
