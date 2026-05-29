# Section-Blending + Reference-Fidelity Audit — public pages

Pages reviewed: **Home, Services, About, Reviews, FAQs & Aftercare** (per request).
Method: live pages on `localhost:3000` at 1440×900 via **Playwright** (computed-style section
sweep) + full-page visual check; the **same detector run on the reference HTML** in
`designs/*.html`; cross-checked against `screenshots/*.png`.

Detector logic: for each top-level `<section>`, read computed `background-color`; flag an
adjacent pair as a **blend** when both are the same flat colour (ivory `#f7f3ec` or white
`#fff`) with no internal separation (no gradient, no large dark inner panel). Heroes, final-CTA
panels and the green Leave-a-review panel are NOT blends — their dark/gradient blocks separate them.

---

## ✅ RESOLVED — implemented via Option B (safe variant)

A new subtle warm tone `--rahma-sand: #f0e8d8` (one step deeper than ivory) + a `sand`
`SectionContainer` tone were added, and applied to the **2nd section of each ivory run** so the
page reads ivory → sand → ivory:

| Page | Section set to `sand` | Component |
|------|----------------------|-----------|
| Home | "How your home session works" | `home/HomeAppointmentProcess.tsx` |
| About | "Meet the team" + "Respect first. Always." | `about/TeamProfiles.tsx`, `about/ComfortSection.tsx` |
| Reviews | "The same words, again and again." (mosaic) | `reviews/FeaturedReviewsMosaic.tsx` |
| FAQs | "Safety and suitability come first." | `faqs-aftercare/SafetySuitability.tsx` *(restores the reference's `tone="warm"` intent)* |

Green text that would have dropped under AA on sand was switched to **charcoal**:
ComfortSection eyebrow, SafetySuitability eyebrow, FeaturedReviewsMosaic card badges
(charcoal-on-gold/20 ≈ 6.8:1). HomeAppointmentProcess/TeamProfiles had no green text on the section.

**Verified (Playwright, live):** every page's section sequence now alternates with **no adjacent
same-tone blends**; a contrast sweep of all visible text on every sand section found **no value
under AA** (charcoal headings/muted body keep large margins; no green text remains on sand). The
only sweep "hits" were sr-only 1×1px star labels inside white cards — not visible, dismissed.
`tsc` clean (src). Sand depth is tunable (deeper is contrast-safe now that no green sits on it).

---

## Part 1 — Reference fidelity verdict ✅

Every page's section **count, order, tone and headings match the reference designs exactly.**
Running the detector on the live page and on the matching `designs/NN-*.html` returns the same
tone sequence for all five pages.

The **only** differences between live and reference are the changes we deliberately made:
- **WCAG contrast** — primary blue `--rahma-green` `#2589c8 → #1c72ac`; active gold tab/chip/chevron
  text `green → charcoal`.
- **SEO** — `/` now 308-redirects to `/home`.

No *unintended* deviations were found. In particular, **the section-blending below is inherited
from the reference designs — it is faithful, not a regression.** (Confirmed: the reference HTML and
screenshots show the same adjacent same-tone sections.)

---

## Part 2 — Section-blending findings

> All blends are **flat ivory `#f7f3ec` against flat ivory** — adjacent sections with identical
> background and no divider, so the seam disappears and they read as one block.

| Page | Blended sections (heading) | Components (tone) | In reference too? |
|------|----------------------------|-------------------|-------------------|
| **Home** | "Why people choose us" → "How your home session works" | `home/WhyRahmaTherapy.tsx` + `home/HomeAppointmentProcess.tsx` (both `ivory`) | Yes |
| **Services** | — *none* — clean ivory/white alternation | — | — (model page) |
| **About** | "Care that comes to you." → "Meet the team" → "Our journey so far" → "Respect first. Always." (a **4-section ivory run** — the worst case) | `about/BrandStory.tsx` + `about/TeamProfiles.tsx` + `about/MilestoneTimeline.tsx` + `about/ComfortSection.tsx` (all `ivory`) | Yes |
| **Reviews** | "Real words from real Luton clients." (hero) → "The same words, again and again." | `reviews/ReviewsHero.tsx` + `reviews/FeaturedReviewsMosaic.tsx` (both `ivory`) | Yes |
| **FAQs & Aftercare** | "Safety and suitability come first." → "Every question, answered" *(the example you flagged)* | `faqs-aftercare/SafetySuitability.tsx` + `faqs-aftercare/FaqCategoryAccordions.tsx` (both `ivory`) | Yes — Safety was `tone="warm"` in the reference port, which rendered as plain ivory |

**Not blends (correctly separated, no action):** every page's hero (gradient/image), every final-CTA
(white/ivory section wrapping a dark `#144a78` panel), and the Reviews "Already had a session"
Leave-a-review block (green panel).

---

## Part 3 — Why the obvious fix (re-toning) does NOT work

- These ivory sections are **card-heavy** — they show **white cards on ivory**. Flipping a section
  to white (`tone="surface"`) would make the white cards blend into a white background (kills card
  contrast). So we can't just alternate ivory→white here.
- Each ivory run is also **flanked by white sections**, so flipping one ivory→white would just
  create a *new* white+white seam next to it (cascades).

→ The fix must add separation **while keeping the ivory background** (so cards still pop).

---

## Part 4 — Recommended fixes

### Option A — Hairline section dividers *(recommended: surgical, zero cascade, no new tokens)*
Add a top hairline to the **second and any subsequent** section of each run, using the existing
warm border token. `SectionContainer` already forwards `className`:

```tsx
<SectionContainer tone="ivory" className="border-t border-rahma-border" …>
```

Exact edits:

| File | Change |
|------|--------|
| `home/HomeAppointmentProcess.tsx` | add `border-t border-rahma-border` to its `SectionContainer` |
| `about/TeamProfiles.tsx` | add `border-t border-rahma-border` |
| `about/MilestoneTimeline.tsx` | add `border-t border-rahma-border` |
| `about/ComfortSection.tsx` | add `border-t border-rahma-border` |
| `reviews/FeaturedReviewsMosaic.tsx` | add `border-t border-rahma-border` |
| `faqs-aftercare/FaqCategoryAccordions.tsx` | add `border-t border-rahma-border` |

Pros: one-line each, keeps every colour/card exactly as the reference, no risk of new seams.
Con: `--rahma-border` (`#e8ded1`) is a *subtle* warm line on ivory — clear but quiet. If you want
a stronger seam, bump to `border-rahma-border` + a faint top shadow, or use Option B.

### Option B — Subtle "sand" tone *(premium look; shared-infra change → confirm first)*
Introduce one new token + tone so ivory runs alternate **ivory → sand → ivory** (sand = a slightly
deeper cream, e.g. `--rahma-sand: #f1e9da`). White cards still pop on sand, and it naturally honours
the reference's `tone="warm"` intent on the FAQs Safety section.
- `tokens.css`: add `--rahma-sand` + `--color-rahma-sand`.
- `shared/SectionContainer.tsx`: add `sand: "bg-rahma-sand text-rahma-charcoal"` to `toneClasses`.
- Apply `tone="sand"` to the 2nd section of each run (HomeAppointmentProcess; About Team + Comfort;
  FeaturedReviewsMosaic; SafetySuitability).

Pros: softer, more "designed" rhythm; collision-free (sand ≠ ivory ≠ white). Con: touches the shared
SectionContainer + a new token; a larger change than Option A.

### Recommendation
Apply **Option A** (hairline dividers) — it removes the blending with the least risk and keeps the
pages pixel-faithful to the reference otherwise. Move to **Option B** only if you want the richer
tonal rhythm and are happy with the shared-infra change. Services already alternates cleanly and
needs nothing.
