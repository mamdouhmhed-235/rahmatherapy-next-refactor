# Public Pages Redesign — Progress Handoff

> Pick up the green→blue re-theme + polish of the customer-facing pages from exactly where the last session stopped. Read this top-to-bottom, then do the **Review-first checklist** before editing.

## Mission & hard constraints
- **Project:** Next.js 16 / React 19, Tailwind v4 (CSS-first `@theme`), shadcn/ui, Supabase, Cloudflare/OpenNext, pnpm. Business: "Rahma Therapy" — mobile hijama / cupping / massage in Luton.
- **Branch:** work on **`redesign/start-state` ONLY**. Confirm with `git branch --show-current`.
- **Scope:** frontend **customer-facing public pages ONLY** (`src/app/(public)/*`). **NEVER touch** `src/app/admin/*`, `src/app/api/*`, the booking flow internals (`src/features/booking/*`, `src/app/booking/manage/*`). Admin is isolated on its own `--admin-*` tokens.
- **Source of truth:** `design_handoff_public_pages/` → `README.md`, `designs/01..06.html`, `screenshots/01..06.png`, `KICKOFF_PROMPT.md`.

## Standing decisions (user-confirmed — do not re-litigate)
1. **Full faithful recreation.** Apply ALL reference deltas (copy, layout, structure). The reference wins on any divergence. **Verify against the reference; never guess colors/values.**
2. **Keep the secondary "Book this package" CTA** on package cards (Home + Services), even though the reference shows only "View X".
3. **Reproduce reference copy verbatim**, including em dashes (—) and straight apostrophes. Copy lives in `src/content/pages/*`, never inline (except headings/eyebrows/hero which are inline in components).
4. **Shared-infra / cross-cutting changes → surface + confirm first** (e.g., `site-parity.css`).
5. Keep `ImagePlaceholder` / `ResponsiveImage` pipeline. Dashed tiles in the references are placeholders, not production images.

## Architecture / what's already wired
- **Token re-theme (DONE):** `src/styles/tokens.css` — `--rahma-green #30463f→#2589c8→#1c72ac` (last hop = post-audit WCAG-AA darken, see below), `--rahma-charcoal #1f2f2b→#144a78`, `--rahma-muted #53615d→#4a5a6a`; retinted `--brand-glow #edf6f3→#edf6fc`, `--brand-calm-surface #edf5f2→#e9f3fb`. Base shadcn tokens (`--primary`, `--foreground`, `--brand-deep`) derive from these.
- **`site-parity.css` fix (DONE):** `src/styles/site-parity.css` is imported **unlayered** (via `src/app/layout.tsx`) and drives public section backgrounds. It had an unlayered `p,h1,h2,h3 { color: inherit }` reset that overrode every `text-rahma-*` color utility on those tags → eyebrows + muted body text rendered charcoal site-wide. **Removed `color: inherit` from that reset.** Now eyebrows render green/gold and body renders muted everywhere. (If text colors look wrong, this is why — check it's still removed.)

## Color / CTA pattern (verified vs references — applies to ALL pages)
- **Gold primary action CTA** (Book a home session, Start your booking, About the team, Book now): `bg-rahma-gold text-rahma-charcoal hover:bg-[#ffc252]`. Focus ring `outline-white` on dark panels, `outline-rahma-blue` on light sections.
- **Solid blue CTA** (Compare all packages, Read more reviews, Meet the team, comparison "Ask on WhatsApp"): `bg-rahma-green text-white hover:bg-rahma-charcoal`.
- **White CTA** (package "View X", See all FAQs, Pause reviews): `bg-white text-rahma-green` (often bordered).
- **Outline CTA** (hero "View packages", "Ask on WhatsApp" on dark): transparent + white text + `border-white/35`.
- **Finder active chip:** `bg-rahma-gold text-rahma-green`.
- **Eyebrows:** `text-rahma-green` on light, `text-rahma-gold` on dark.
- **Hero H1 needs `font-display`** (Urbanist) explicitly. Section H2 = 48px Urbanist charcoal (via `SectionHeading`).
- **Final-CTA dark panels:** ivory/white section bg + rounded `bg-rahma-charcoal` panel + image + scrim `rgba(20,74,120,...)` = `#144a78` (NOT old `#1F2F2B` green or `#081f1c`) + content; include `pt-16 sm:pt-20 lg:pt-24`.

## Completed & verified
- **Step 1 — tokens:** done, verified (computed + screenshot).
- **Home (`01-home.html`):** 10 sections (dropped `HomeSafetyAftercare`). Hero, trust strip rebuilt to slim band (CMA logo + IPHM chip + 5.0 Google stars), pain points, packages (Pick your package + View + Book this package), Why (ivory + white cards + gold icons + gold "About the team"), process (gold CTA), reviews intro, team, FAQ (white section, 5 new Q&As), final CTA (#144a78 scrim + top padding). `homeTrustItems` removed from `home.ts`. Audited & fixed: hero H1 font, hero CTA gold, process CTA gold, final scrim, final padding.
- **About (`02-about.html`):** 8 sections (dropped `SafetyStandards` + `CredentialsBand`). Hero (gold CTA, removed trust pills + image overlay), stats (incl. "5★", "CMA + IPHM"), trust snapshot, brand story, team profiles (ivory + white cards, **muted role**, **gold check icons**), milestone timeline (ivory restyle, **5** milestones), comfort, final CTA (#144a78 scrim + padding). The `site-parity.css` p-reset fix was found & applied here.
- **Services (`03-services.html`):** 6 sections (dropped `ServicesTrustStrip`, `HomeAppointmentProcess`, `SafetyAftercareBand`, `ServicesMiniFAQ`). Hero (gold CTA, View packages, removed pills+overlay), PackageCards (simplified to home-style bento + Book this package), PackageFinder (new copy + chip labels + 6 rec bodies), **PackageComparison rebuilt** (transparent header; cells render blue ✓ badge / "—" / "Optional"; data → yes/no/optional; condensed Best-for), TreatmentMethods (concise bodies, removed "Included in" line), ServicesFinalCTA (`#1F2F2B`→`#144a78` scrim + padding + new copy). Audited: **no discrepancies**.

- **Package detail (`04-package.html`):** 8 sections (dropped `PackageSummaryCard`, `PackageSessionSteps`, `PackageSafety`). Hero (primary CTA blue→**gold**, removed opening-copy para + image overlay card + trust pills, image gradient `from-black/70 via-black/10`), WhoItsFor, Includes ("What's included" straight apostrophe), TreatmentBreakdown (**removed persuasive-phrase pill**; gradient `via-black/15`, overlay `text-white/80`), Benefits, FAQ (title `Common questions about {title with " Package" stripped / " Therapy…"→" therapy"}`, desc "Quick answers before you book."), RelatedPackages (unchanged, blue "View X"), FinalCTA (`#081f1c`→**`#144a78`** scrim 94/78/42 + added `pt-16 sm:pt-20 lg:pt-24` + removed 3rd para). `packagePages.ts` rewritten to match reference `RAHMA_PACKAGES` **verbatim** for all 5 slugs (straight apostrophes; `summary`/`heroOverlay*`/`openingCopy`/`persuasivePhrase` kept but now unused). Verified across all 5 slugs: 8 sections, gold hero CTA `rgb(245,166,35)`, `#144a78` scrim, FAQ-title transform; `tsc --noEmit` clean. Reference data + component ports were extracted from `window.RAHMA_PACKAGES` / embedded port script.

- **Reviews (`05-reviews.html`):** 6 sections (dropped `ReviewsStatsStrip`). Hero (eyebrow "Google reviews", new h1/subheading, primary CTA blue→**gold**, removed "Serving Luton since 2020" trust line, **simplified right column** to a single image card — dropped blur blobs + 3 floating review cards), FeaturedReviewsMosaic (new title/desc, badge `gold/16→/20`), ReviewsExplorer (new heading/desc, **removed medical-disclaimer card**), ReviewFilters (active count badge `white/18→/20`), ReviewWall ("You've" straight apostrophe), ReviewThemeHighlights (new heading + rewritten `themes`, last card "They book again"), LeaveReviewCTA (new h2/desc, `white/78→/80`), ReviewsFinalCTA (`#081f1c`→**`#144a78`** scrim 94/80/46 + new h2/desc + removed trailing trust line + padding `sm:pt-12 lg:pt-16`). Review **data unchanged** — `src/lib/content/reviews.ts` (stats/category-filters/89 reviews) is identical to the reference `RAHMA_REVIEWS*`. Inline UI copy (themes/headings/badges) kept inline as the reference does. Verified: 6 sections, gold hero CTA, `#144a78` scrim, filter-pill active = `bg-rahma-green`/white + filtering works; `tsc --noEmit` clean.

- **FAQs & Aftercare (`06-faqs.html`):** 8 sections (none dropped). Hero (primary CTA blue→**gold**, removed trust pills + image overlay card, gradient `from-black/70 via-black/10`, tightened subheading), QuickAnswersStrip ("Quick answers."), BeforeAppointment (new desc, gradient `/60`), AftercareTabs (title "Aftercare by treatment" + new desc + gradient `/60 /10`; kept keyboard nav + framer-motion), **SafetySuitability flipped green→ivory** (`tone="green"`→`"ivory"`; eyebrow gold→green, h2/body/cards white→charcoal, white disclaimer + item cards, green check icons), FaqCategoryAccordions ("Every question, answered" + "Pick a topic…"), WhenToGetAdvice ("…don't ignore it." + tightened subheading), FaqsAftercareFinalCTA (**`#1F2F2B`→`#144a78`** scrim 94/78/46 + added `pt-16 sm:pt-20 lg:pt-24` + removed trailing trust line). `faqsAftercare.ts` **regenerated to reference verbatim** (straight apostrophes; `suitabilityItems`/`faqsAftercareDisclaimer` unchanged). Verified: 8 sections, gold hero CTA, ivory Safety section, `#144a78` scrim, aftercare + FAQ category tabs active `bg-rahma-gold`/green, accordion single-open; `tsc --noEmit` clean. **No `#1F2F2B`/`#081f1c` scrims remain anywhere in `src/components`** (this was the last one).

Un-composed component files + now-unused content fields are **left in place** (not deleted) on all completed pages — consistent pattern.

## Methodology (do this per page)
1. **The `designs/*.html` are client-rendered apps** (no static markup) — you CANNOT read them as text. Open via chrome-devtools MCP at `file:///C:/Users/mamdo/Desktop/rahmatherapy%20-%20Copy/rahmatherapy-next-refactor/design_handoff_public_pages/designs/<file>.html` and inspect the rendered DOM with `evaluate_script`. `screenshots/*.png` are readable images.
2. Read `(public)/<page>/page.tsx` (composition) + its components + `src/content/pages/<page>.ts`.
3. From the reference: extract section outline (headings, copy, CTAs, bg) + detailed per-section content via `evaluate_script`.
4. Diff vs current. Apply edits (copy in content modules; structure/inline-copy in components).
5. Verify on live dev server: **computed styles** (`getComputedStyle`) + a full-page screenshot. Resize both tabs to **1440×900** (reference frames are 1440px desktop).
6. **Audit loop:** compare live vs reference CTAs/colors with computed diffs, fix any mismatch. (Past misses were all from guessing colors — measure the reference.)

## Tooling gotchas
- Dev server: `pnpm dev` → `localhost:3000` (was running in background; restart if needed). First compile of each route is SLOW (30–60s).
- chrome-devtools `navigate_page`/reload often **times out on the load event** even though the page renders — use long timeouts and just proceed to `evaluate_script`/`take_screenshot`.
- If computed styles look stale (Fast Refresh flakiness, esp. after an MCP reconnect), do a hard reload (`navigate_page` reload `ignoreCache:true`) before trusting measurements.
- Dev shows **placeholder dashed tiles** for images (real `/images/*` not in repo) — expected, not a bug.
- Git LF→CRLF warnings are harmless. Don't skip hooks.

## Remaining work
- **All six public pages are now redesigned + verified** (Home, About, Services, Package detail ×5, Reviews, FAQs & Aftercare). The green→blue re-theme + faithful recreation is complete page-by-page.
- **QA + WCAG audit (DONE):** all 6 public pages audited at desktop 1440 + true mobile 390 (chrome-devtools `emulate` viewport) — **no console errors, no horizontal overflow, 1 `<h1>` each, no broken links, all imgs have alt**; interactions verified (carousel next + play/pause toggle, finder chips, review filters, aftercare + FAQ tabs, accordions single-open, **mobile hamburger menu**). Three fixes applied + verified in a **production build**:
  - **P2 — blue contrast:** `--rahma-green` darkened `#2589c8`→**`#1c72ac`** (single token; no hardcoded literals elsewhere). Now AA: green-text/blue-fill **5.18:1 on white, 4.69:1 on ivory** (was 3.82/3.46). Green-on-gold **active tabs/chips/chevron** also fixed: active text/icon `text-rahma-green`→**`text-rahma-charcoal`** (charcoal-on-gold **4.54:1**, matches the gold CTAs) across `AftercareTabs`, `FaqCategoryAccordions`, `PackageFinder` chip, and the shared `ui/accordion.tsx` open-chevron pill (Home/Package/Services FAQs). All four are customer-facing only.
  - **P3 — duplicate homepage:** `src/app/(public)/page.tsx` now `permanentRedirect("/home")` → `/` returns **HTTP 308 → /home** (was serving identical content at both URLs). Single indexable homepage.
  - **P1 — booking modal:** NOT a real bug. Modal fails to open under `next dev` due to a **React Strict Mode effect-ordering race** in `src/features/booking/hooks/useBookingUrlState.ts` (the URL-sync effect strips `?booking=1` before the open effect's strict-mode re-run reads it). **Verified working in `pnpm build && pnpm start`** (modal opens, `aria-modal`, title "Request a home appointment"). Booking internals left untouched (out of scope).

## Review-first checklist (before editing)
1. `git branch --show-current` → must be `redesign/start-state`.
2. Read `design_handoff_public_pages/README.md` and `src/styles/tokens.css`.
3. Read these for the established patterns: `src/components/home/HomeFinalCTA.tsx`, `src/components/home/WhyRahmaTherapy.tsx`, `src/components/services/PackageComparison.tsx`, `src/components/services/ServicesHero.tsx`, `src/components/about/TeamProfiles.tsx`, `src/components/about/MilestoneTimeline.tsx`.
4. Read `src/components/shared/SectionContainer.tsx` (tones: ivory/surface/green/charcoal) + `SectionHeading.tsx` (eyebrow/title/description/align/inverse).
5. Open `designs/04-package.html` in chrome-devtools and extract its structure before touching code.
