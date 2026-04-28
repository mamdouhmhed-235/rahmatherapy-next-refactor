# Performance SEO Deployment Audit

## Status

- Phase: 7
- Completion status: Complete for performance, SEO, validation, local smoke, and primary deployment checks
- Scope: Planned Rahma Therapy routes only, plus shared planned-page shell and booking surfaces
- Method: Static source inspection, required command execution, local route smoke checks, primary Vercel route checks.
- Runtime remediation: None.

## Performance And Image Handling

| Check | Result | Evidence | Issue IDs |
|---|---|---|---|
| Planned images use `next/image` or placeholder wrappers | Mostly pass, with known wrapper bypasses | Route-owned wrappers exist, but `PackageFinder` and `AftercareTabs` render `ImagePlaceholder` directly as logged in Phase 2. | PLAN-SERVICES-001, PLAN-FAQS-002 |
| No huge direct image imports | Pass | Static extension scan found image paths in strings/content, not direct JS/TS image module imports. | None |
| Client components limited to real interaction needs | Pass with review-performance caveat | Client components are used for nav, booking, accordions, tabs, finder, carousel, timeline, and review filtering/cards. | PERF-001 |
| Reviews wall does not animate every card heavily at once | Partial | `ReviewCard` wraps every visible review in Framer Motion; `ReviewsExplorer` starts with `pageSize = 24`. Reduced motion is respected, but default users can still receive many animated cards. | PERF-001 |
| Placeholder behavior remains production-safe | Partial | Placeholder labels are accessible and visible, but prominent fallback use is already tracked as visual production-polish debt. | VISUAL-001 |

## SEO And Structured Data

| Route | Metadata result | JSON-LD result | Schema risk | Issue IDs |
|---|---|---|---|---|
| `/home-planned` | Static title/description exists. | `HealthAndBeautyBusiness` JSON-LD exists. | No Review/AggregateRating schema found. | None |
| `/home-planning` | Redirect alias to `/home-planned`. | Inherits target page after redirect. | No schema issue found. | None |
| `/services` | Static title/description exists. | `HealthAndBeautyBusiness` JSON-LD with service offerings exists. | No Review/AggregateRating schema found. | None |
| Focused package routes | `generateMetadata` derives title/description from package content. | `Service` JSON-LD with provider exists. | No Review/AggregateRating schema found. | None |
| `/about` | Static title/description exists. | `HealthAndBeautyBusiness` JSON-LD exists. | No Review/AggregateRating schema found. | None |
| `/reviews` | Static title/description exists. | Breadcrumb JSON-LD only. | Pass: no self-serving Review or AggregateRating schema found. | None |
| `/faqs-aftercare` | Static title/description exists. | `HealthAndBeautyBusiness` JSON-LD exists. | No Review/AggregateRating schema found. | None |

## Validation Commands

### `pnpm lint`

Exit code: 0

Output:

```text
> zam-therapy-next-refactor@0.1.0 lint C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor
> eslint
```

### `pnpm exec tsc --noEmit --incremental false`

Exit code: 1

Output:

```text
'tsc' is not recognized as an internal or external command,
operable program or batch file.
```

Note: `node_modules\.bin\tsc`, `tsc.CMD`, and `tsc.ps1` exist, but the requested command failed exactly as shown in this PowerShell environment. The build command below still ran the Next.js TypeScript phase successfully.

### `pnpm build`

Exit code: 0

Output:

```text
> zam-therapy-next-refactor@0.1.0 build C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor
> next build

▲ Next.js 16.2.4 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 11.4s
  Running TypeScript ...
  Finished TypeScript in 15.2s ...
  Collecting page data using 15 workers ...
  Generating static pages using 15 workers (0/18) ...
  Generating static pages using 15 workers (4/18)
  Generating static pages using 15 workers (8/18)
  Generating static pages using 15 workers (13/18)
✓ Generating static pages using 15 workers (18/18) in 3.7s
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ○ /faqs-aftercare
├ ○ /hijama
├ ○ /home-planned
├ ○ /home-planning
├ ○ /physiotherapy
├ ○ /reviews
├ ○ /services
├ ● /services/[slug]
│ ├ /services/supreme-combo-package
│ ├ /services/hijama-package
│ ├ /services/fire-cupping-package
│ └ [+2 more paths]
└ ○ /sports-massage-barnet

○  (Static)  prerendered as static content
●  (SSG)     prerendered as static HTML (uses generateStaticParams)
```

### Existing Test Script

Result: no test script exists in `package.json`.

## Local Route Smoke Checks

Base URL checked: `http://127.0.0.1:3000`

Slashless route results:

| Route | Status | Status text |
|---|---:|---|
| `/home-planned` | 308 | Permanent Redirect |
| `/home-planning` | 308 | Permanent Redirect |
| `/services` | 308 | Permanent Redirect |
| `/services/supreme-combo-package` | 308 | Permanent Redirect |
| `/services/hijama-package` | 308 | Permanent Redirect |
| `/services/fire-cupping-package` | 308 | Permanent Redirect |
| `/services/massage-therapy-30-mins` | 308 | Permanent Redirect |
| `/services/massage-therapy-1-hour` | 308 | Permanent Redirect |
| `/about` | 308 | Permanent Redirect |
| `/reviews` | 308 | Permanent Redirect |
| `/faqs-aftercare` | 308 | Permanent Redirect |

Trailing-slash route results:

| Route | Status | Final URL | Title |
|---|---:|---|---|
| `/home-planned/` | 200 | `http://127.0.0.1:3000/home-planned/` | `Rahma Therapy | Mobile Hijama, Cupping &amp; Massage in Luton` |
| `/home-planning/` | 308 | `Permanent Redirect` | N/A |
| `/services/` | 200 | `http://127.0.0.1:3000/services/` | `Services | Mobile Hijama, Cupping &amp; Massage in Luton | Rahma Therapy` |
| `/services/supreme-combo-package/` | 200 | `http://127.0.0.1:3000/services/supreme-combo-package/` | `Supreme Combo Package | Mobile Cupping, Hijama &amp; Massage in Luton` |
| `/services/hijama-package/` | 200 | `http://127.0.0.1:3000/services/hijama-package/` | `Hijama Package in Luton | Private Mobile Wet Cupping | Rahma Therapy` |
| `/services/fire-cupping-package/` | 200 | `http://127.0.0.1:3000/services/fire-cupping-package/` | `Fire Cupping Package in Luton | Mobile Cupping Without Hijama` |
| `/services/massage-therapy-30-mins/` | 200 | `http://127.0.0.1:3000/services/massage-therapy-30-mins/` | `30-Min Mobile Massage Therapy in Luton | Rahma Therapy` |
| `/services/massage-therapy-1-hour/` | 200 | `http://127.0.0.1:3000/services/massage-therapy-1-hour/` | `1-Hour Mobile Massage Therapy in Luton | Rahma Therapy` |
| `/about/` | 200 | `http://127.0.0.1:3000/about/` | `About Rahma Therapy | Mobile Hijama, Cupping &amp; Massage in Luton` |
| `/reviews/` | 200 | `http://127.0.0.1:3000/reviews/` | `Reviews | Rahma Therapy Luton` |
| `/faqs-aftercare/` | 200 | `http://127.0.0.1:3000/faqs-aftercare/` | `FAQs &amp; Aftercare | Hijama, Cupping &amp; Massage in Luton | Rahma Therapy` |

Smoke-check note: `/home-planning/` is a redirect alias by design; the route inventory maps its content and components to `/home-planned`.

## Primary Live Deployment Checks

Initial sandboxed PowerShell requests to the primary Vercel URLs failed with:

```text
The underlying connection was closed: An unexpected error occurred on a receive.
```

The check was rerun outside the restricted sandbox for deployment verification.

| URL | Status | Final URL | Title |
|---|---:|---|---|
| `https://rahmatherapy-next-refactor.vercel.app/home-planned/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/home-planned/` | `Rahma Therapy | Mobile Hijama, Cupping &amp; Massage in Luton` |
| `https://rahmatherapy-next-refactor.vercel.app/services/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/services/` | `Services | Mobile Hijama, Cupping &amp; Massage in Luton | Rahma Therapy` |
| `https://rahmatherapy-next-refactor.vercel.app/services/supreme-combo-package/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/services/supreme-combo-package/` | `Supreme Combo Package | Mobile Cupping, Hijama &amp; Massage in Luton` |
| `https://rahmatherapy-next-refactor.vercel.app/services/hijama-package/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/services/hijama-package/` | `Hijama Package in Luton | Private Mobile Wet Cupping | Rahma Therapy` |
| `https://rahmatherapy-next-refactor.vercel.app/services/fire-cupping-package/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/services/fire-cupping-package/` | `Fire Cupping Package in Luton | Mobile Cupping Without Hijama` |
| `https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-30-mins/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-30-mins/` | `30-Min Mobile Massage Therapy in Luton | Rahma Therapy` |
| `https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-1-hour/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-1-hour/` | `1-Hour Mobile Massage Therapy in Luton | Rahma Therapy` |
| `https://rahmatherapy-next-refactor.vercel.app/about/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/about/` | `About Rahma Therapy | Mobile Hijama, Cupping &amp; Massage in Luton` |
| `https://rahmatherapy-next-refactor.vercel.app/reviews/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/reviews/` | `Reviews | Rahma Therapy Luton` |
| `https://rahmatherapy-next-refactor.vercel.app/faqs-aftercare/` | 200 | `https://rahmatherapy-next-refactor.vercel.app/faqs-aftercare/` | `FAQs &amp; Aftercare | Hijama, Cupping &amp; Massage in Luton | Rahma Therapy` |

Primary deployment status: available and not obviously stale based on title parity with local route smoke checks.

Alternate Vercel URLs: not checked because the primary deployment was available and returned the expected planned-route titles.

## Performance Finding Added This Phase

### PERF-001

- Severity: Medium
- Route: `/reviews`
- Source: `src/components/reviews/ReviewCard.tsx`, `src/components/reviews/ReviewWall.tsx`, `src/components/reviews/ReviewsExplorer.tsx`
- Observed: Every visible review card is a Framer Motion article, and the initial review wall can render 24 animated cards before "Load more".
- Expected: Reviews wall animation should remain lightweight, especially on mobile and lower-powered devices.
- User impact: The review wall may feel heavier than necessary and can increase client-side rendering/animation work on a high-card-count trust page.
- Verification method: Static source inspection; follow-up remediation should profile `/reviews` on mobile hardware or Lighthouse.
- Related existing issue: A11Y-005 for focus semantics on the same cards.

## Phase 7 Gate

| Check | Status |
|---|---|
| Planned image handling checked | Complete |
| Direct image import scan documented | Complete |
| Client component boundaries checked | Complete |
| Reviews wall animation checked | Complete |
| Metadata checked | Complete |
| Review/AggregateRating schema guard checked | Complete |
| `pnpm lint` result documented exactly | Complete |
| `pnpm exec tsc --noEmit --incremental false` result documented exactly | Complete |
| `pnpm build` result documented exactly | Complete |
| Existing test script check documented | Complete |
| Local route smoke checks documented exactly | Complete |
| Primary live deployment checks documented | Complete |
| Runtime code changed | No |
