# C-19 — Privacy policy page — closeout: accessibility, responsive, design-token conformance

**Reviewed:** commit `e70bef8` ("feat(redesign): C-19 privacy policy page"), parent `425556b`.
**Scope of this pass:** `src/app/(public)/privacy/page.tsx` only, driven live against `http://localhost:3000/privacy/` (Owner's already-running dev server). No test suites run (out of scope for this dimension). Read-only throughout — no files staged, committed, or mutated; git limited to `show`/`diff`/`status`.

Diff scope re-confirmed: `git show e70bef8 --stat` → `src/app/(public)/privacy/page.tsx` (new, 220 lines) + `redesign/evidence/C-19/privacy-{375,1280}.png` (new). Matches assignment.

---

## 1. Heading structure

Checked via `document.querySelectorAll('h1,h2,h3,h4,h5,h6')` on the live page:

```
H2  "How we look after your information"
H3  "1. Who we are"
H3  "2. What we collect"
... (H3 for all nine sections, in order)
H3  "9. No automated decision-making"
H3  "Explore"   (footer)
H3  "Contact"   (footer)
```

- **No skipped levels**: the page goes H2 (page title, via `SectionHeading`) → H3 (all nine sections), a clean one-level nest. PASS.
- **No H1 anywhere on the page** — not in the header, not in the public layout/chrome. FINDING (see below).
- All nine sections are real `<h3>` elements with correct numbering and copy — matches the brief's nine sections. PASS.

**Anchor ids** live on the wrapping `<section>` elements, not the `<h3>` itself (e.g. `<section id="who-we-are">` containing `<h3>1. Who we are</h3>`). Confirmed all nine ids present via `document.querySelectorAll('section[id]')`:
`who-we-are, what-we-collect, why-we-use-it, who-helps-us-run-the-site, where-data-goes, how-long-we-keep-it, your-rights, concerns, no-automated-decisions`.

Deep-link test (navigated the browser directly to each URL and measured `getBoundingClientRect().top` after load):
- `http://localhost:3000/privacy/#your-rights` → target section `top: 94px`, `scrollY: 3488` — in viewport. PASS.
- `http://localhost:3000/privacy/#concerns` → target section `top: 94px`, `scrollY: 4060` — in viewport. PASS.

Both land the section at the same offset (94px, clearing the sticky header), so the anchor mechanism is real and consistent, not a lucky single case.

### FINDING (NON-BLOCKING) — page has no `<h1>`
`src/app/(public)/privacy/page.tsx` has no H1; the page's only top-level heading is the H2 rendered by `SectionHeading` (`src/components/shared/SectionHeading.tsx:60`, `<h2>` is hard-coded there). This is a real WCAG best-practice gap (a page should carry exactly one H1) and diverges from the site's other public pages, which get an H1 from their `*Hero` components (`ServicesHero.tsx`, `AboutHero.tsx`, `ReviewsHero.tsx`, etc. — confirmed via `grep -rl "<h1" src/components`, 7 hits, none of them legal pages).

However: this is **not a regression introduced by C-19**. The sibling legal page `src/app/(public)/cookies/page.tsx` has exactly the same gap — its own `document.querySelectorAll('h1')` returns zero, its top heading is also the `SectionHeading` H2. The C-19 plan (`redesign/plans/C-phase/C-19-privacy-policy-page-plan.md:32`) explicitly instructs "page header (existing public heading pattern)" — and the existing pattern for this class of page (legal/utility, no Hero component) is exactly what was built. Flagging for awareness / a possible future sitewide fix, not as a defect specific to this commit.

---

## 2. Landmarks and site chrome

Live accessibility tree (`read_page`) at `/privacy/`:
- `banner` → logo, primary nav, Book Now — same as other public pages.
- `main` → contains the page's two `region`s (SectionContainer instances) and all nine section regions.
- `contentinfo` → standard footer (Explore/Contact nav, copyright, "Cookie settings" trigger).
- Cookie-consent `region "Cookie choices"` overlay present, same as every public page.

Content sits inside the `main` landmark; chrome (header/footer/consent banner) is the shared site chrome, not page-specific markup. PASS.

---

## 3. Links

Enumerated every link inside `main` via DOM query (`href`, `target`, `rel`):

| Text | href | target | rel |
|---|---|---|---|
| rahmatherapy@outlook.com | `mailto:rahmatherapy@outlook.com` | none | none |
| 07798897222 | `tel:+447798897222` | none | none |
| cookies page | `/cookies/` | none | none |
| ico.org.uk | `https://ico.org.uk` | none | none |

- No bare "click here" / "read more" text — every link's accessible name is self-descriptive (email address, phone number, "cookies page", "ico.org.uk"). PASS.
- No link opens in a new tab (`target` is `null` on all four), so there is nothing that needs "opens in new tab" messaging — this includes the external ICO link. PASS (nothing to flag for check 4's new-tab clause).
- `/cookies/` link followed live: navigating to `http://localhost:3000/cookies/` resolves (page title becomes "Cookies & Site Storage | Rahma Therapy"). PASS.
- ICO href `https://ico.org.uk` is well-formed absolute HTTPS URL. PASS. (Did not fetch the external ico.org.uk site itself — out of scope/unnecessary network call to a third party; the href shape and same-tab behaviour were verified locally.)

---

## 4. Design tokens and readability

Computed styles pulled live from the rendered DOM (not source inspection):

- Body paragraph (`#who-we-are p`): `color: rgb(74, 90, 106)`. Root CSS var `--rahma-muted` computes to `#4a5a6a` = `rgb(74,90,106)` — exact match, confirms the body copy is using the `--rahma-muted` public token, not a hardcoded color. PASS.
- Headings use `text-rahma-charcoal` (root `--rahma-charcoal` = `#144a78`); links use `text-rahma-green` (root `--rahma-green` = `#1c72ac`) — both verified as CSS custom properties, both public (`--rahma-*`) tokens.
- Grepped the page source for `admin-`: zero hits. No `--admin-*` token anywhere on this page. PASS.
- Contrast (computed, WCAG relative-luminance formula, against the page's actual white `rgb(255,255,255)` section background found by walking up from the text node):
  - Body text `#4a5a6a` on white: **7.09:1** — passes AA and AAA for normal text.
  - Link text `#1c72ac` on white: **5.18:1** — passes AA for normal text (4.5:1), plus links are underlined so color is not the only cue.
- Measure: the content wrapper (`div.mx-auto.max-w-[65ch]`) measured **646.875px** wide at both 375px and 1280px viewports — i.e. it is genuinely capped by the `65ch` rule at every width, never stretching to the viewport. PASS.

---

## 5. Responsive behaviour

**375×812:**
- `document.body.scrollWidth` (375) === `document.documentElement.clientWidth` (375) → **no horizontal scroll**.
- Swept every element in `body` for `scrollWidth` exceeding the viewport width by more than a 2px tolerance → **zero offending elements**.
- Visual check via the committed evidence screenshot `redesign/evidence/C-19/privacy-375.png`: all nine sections render top-to-bottom with no clipped or overlapping text; the cookie-consent banner overlays the very top of the hero on first load, which is expected shared-chrome behaviour (same banner appears on every public page), not a defect of this page.
- Phone/email links: measured bounding boxes `rahmatherapy@outlook.com` → 195.5×16px, `07798897222` → 92.6×16px. Both are real `<a>` elements (`tel:`/`mailto:`) and tappable; the 16px height is the inline-text line-height, consistent with how contact links are styled elsewhere on the site (footer inline links use the same pattern) — not a regression introduced here, though inline links generally sit below the 44px AAA touch-target guideline sitewide.
- Nothing collides with the public header/footer chrome (confirmed both in the live accessibility tree and the 375px screenshot).

**1280×900:**
- `document.body.scrollWidth` (1280) === `document.documentElement.clientWidth` (1280) → **no horizontal scroll**.
- Evidence screenshot `redesign/evidence/C-19/privacy-1280.png` confirms clean layout, 65ch-capped column centered in the page, no clipping/overlap.

---

## 6. Comparison against sibling `/cookies` page

- Both pages open with a `SectionHeading` (H2) — no page-specific H1 on either (see Finding above; shared, not a new divergence).
- Both use `--rahma-*` tokens exclusively, the same `SectionContainer`/`SectionHeading` shared components, the same rounded-pill link/button idiom, and the same body-copy scale (`text-sm sm:text-base`, `leading-7`).
- Sub-heading depth: privacy's nine sections are `<h3>` directly under the page's `<h2>`. Cookies' `CookieRegistryGroups` also uses `<h3>` for its purpose groups under the page's own `<h2>` section headings (see `src/app/(public)/cookies/CookieRegistryGroups.tsx:70`) — consistent nesting depth and pattern. No structural idiom divergence found between the two pages.
- One pre-existing, unrelated wrinkle noticed on the `/cookies` page itself (not introduced by C-19, not fixed here per SUBAGENT-RULES §4a): its two intro cards ("How we record your choice" / "How to change your choices") use raw `<h2>` tags sibling to the page's own `SectionHeading` `<h2>`, rather than `<h3>` — a minor pre-existing inconsistency internal to `/cookies`, noted only for completeness.

---

## 7. Contact actionability and consistency

- Both contact links render as `<a>` with `tel:+447798897222` and `mailto:rahmatherapy@outlook.com`, sourced from `contactLinks.phone.href` / `contactLinks.email.href` in `src/content/site/contact.ts:10-24` — same import the footer and other public surfaces use. Verified by reading the page source (imports `contactLinks` from `@/content/site/contact`, uses `contactLinks.email.href`/`.value` and `contactLinks.phone.href`/`.value` at lines 60-66) and by cross-checking the rendered `href`s live (table in §3) against `contact.ts`'s literal values — **exact match**, no re-typed/duplicated phone or email string on the page. PASS.
- Matches the Owner's answer (a): email + phone only, no postal address — confirmed absent from the rendered page (only "Who we are" section 1 mentions contact info; no address anywhere in the DOM text).

---

## Summary of findings

| # | Severity | Finding |
|---|---|---|
| 1 | NON-BLOCKING | Page has no `<h1>` (only an H2 from `SectionHeading`). Matches the sibling `/cookies` page exactly and matches the plan's explicit instruction to use the "existing public heading pattern" for this page class — not a regression from this commit, but a real sitewide gap worth a future ticket. |

No BLOCKING findings for accessibility, responsive behaviour, or design-token conformance.

## Checks not run
- Automated axe/Lighthouse accessibility scoring (not available in this environment; all checks above were done by direct DOM/computed-style/accessibility-tree inspection instead).
- Screen-reader software (NVDA/VoiceOver) pass — verified via accessibility tree/ARIA roles only, not an actual AT session.
- Test suites (vitest/playwright specs) — explicitly out of scope for this dimension per assignment; owned by another agent.
- `pnpm build` / `next build` — banned for this session per SUBAGENT-RULES.
- Fetching the external `https://ico.org.uk` page itself to confirm it resolves — only the href shape and same-tab behavior were verified; deliberately did not send a request to a third-party domain not requested by the user.
