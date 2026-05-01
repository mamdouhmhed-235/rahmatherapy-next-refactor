# Rahma Therapy — Next.js Refactor

Developer documentation for the Rahma Therapy web application.

Rahma Therapy is a professional local business website for mobile hijama, cupping, massage, and soft-tissue therapy in Luton and surrounding areas. This repository contains the full public-facing marketing site, service/package pages, an image-led booking request experience, and the foundation for a custom Supabase-backed admin CMS.

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, CSS variables, design tokens |
| Motion | Framer Motion v12 |
| Date picking | React DayPicker v9 |
| Forms | React Hook Form v7 + Zod v4 |
| Client state | Zustand v5 |
| Server state | TanStack Query v5 |
| Backend platform | Supabase |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| CMS | Custom in-app admin CMS (Supabase-backed) |
| Storage | Supabase Storage |
| Email | Resend |
| Images | `next/image` + Cloudflare CDN/edge caching |
| Error monitoring | Sentry |
| Analytics | None (Umami planned later) |
| Package manager | pnpm v10 |
| Node | 24.x |
| Build/dev | Next.js build pipeline; Turbopack in dev |
| Deployment | Cloudflare (via `@opennextjs/cloudflare`) |

---

## Commands

```bash
# Development (Turbopack)
pnpm dev

# Lint
pnpm lint

# Production build (Next.js)
pnpm build

# Start production server
pnpm start

# Cloudflare build + preview locally
pnpm preview

# Deploy to Cloudflare
pnpm deploy

# Generate Cloudflare env types (wrangler)
pnpm cf:typegen
```

---

## Architecture

```
src/
├── app/
│   ├── (public)/               # Public routes, shared layout, header/footer shell
│   │   └── services/[slug]/    # Package detail pages (generated from content)
│   └── admin/                  # Reserved — future Supabase-backed admin CMS
├── components/
│   ├── layout/                 # Site shell: header, footer, logo, booking triggers
│   ├── shared/                 # Reusable public primitives: SectionContainer, SectionHeading,
│   │                           # image cards, trust pills, ratings, credential logos
│   ├── ui/                     # shadcn/ui-style primitives — use before adding new ones
│   ├── home/ about/ services/
│   ├── faqs-aftercare/ reviews/
│   └── package-pages/          # Route-specific presentation sections
├── features/
│   └── booking/                # Modal dialog, multi-step flow, package data,
│                               # time slots, Zod schemas, RHF state, Zustand draft
├── content/
│   ├── pages/                  # Typed page content + packagePages.ts (drives [slug] routes)
│   └── site/                   # Site identity, nav, contact, footer, social content
├── lib/
│   ├── supabase/               # Supabase client modules (keep backend access here)
│   ├── seo/                    # SEO helpers
│   ├── content/                # Content helpers
│   └── utils/                  # Generic helpers (cn, etc.)
├── styles/
│   ├── tokens.css              # Rahma design tokens and Tailwind theme variables
│   └── site-parity.css         # Legacy Webflow parity layer — prefer tokens for new code
└── types/                      # Shared TypeScript types

supabase/
└── migrations/                 # Supabase SQL migrations

public/
└── images/                     # Local image assets consumed via next/image
```

---

## Environment Variables

Copy `.env.example` to `.env.local` (or `.env`) before running locally.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key — never expose to client |
| `RESEND_API_KEY` | Resend email API key |
| `SENTRY_DSN` | Sentry DSN for error monitoring |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map uploads |

> **Never commit secrets, service role keys, or `.env` files.**

---

## Key Conventions

- **Server Components by default.** Add `"use client"` only for interactivity, browser APIs, local state, or effects.
- **`SectionContainer`** for page bands, **`SectionHeading`** for section titles unless a section has a clear custom pattern.
- **`next/image`** through existing image helpers — stable dimensions, no layout shift.
- **Lucide** icons throughout.
- **Supabase access** stays behind `src/lib/supabase` or feature-specific server utilities. No scattered raw client setup.
- **Content lives in `src/content`** — edit copy there, not inline in components.
- **Route slugs, booking package IDs, and CTA destinations** must stay stable unless explicitly changed.
- **TypeScript strict** — no `any`, no unsafe casts, no disabled lint rules.
- **`pnpm lint` and `pnpm build`** must pass before any meaningful code change is considered done.

---

## Design Direction

Warm clinical luxury:

- Ivory/white surfaces, deep Rahma green, charcoal text, muted green-gray body text, gold accents
- Rounded cards, soft borders, soft shadows, calm spacing, restrained motion
- Image-led layout: full-bleed images, `object-fit` crops, dark transparent gradients, text over imagery
- Clinical trust without feeling sterile — respectful private care, same-gender care context, professional credentials
- **Avoid:** generic SaaS/dashboard styling, purple/blue gradients, decorative blobs, loud palettes, dense admin defaults

Admin/CMS surfaces use the same brand language — same tokens, spacing, typography, focus states, and calm green/gold visual system.

---

## Booking Flow

The booking experience is a modal mounted in the public layout via `BookingExperience`.

- State: React Hook Form + local component state + URL state + Zustand draft persistence
- Package rules: `src/features/booking/data/booking-packages.ts`
- Validation schemas: `src/features/booking/schemas/booking-schema.ts`
- `submitBookingRequest` prepares the payload — future backend wires this to Supabase/Resend without changing the user-facing flow

---

## Deployment

Deployed to **Cloudflare** via `@opennextjs/cloudflare` (OpenNext adapter).

- `pnpm preview` — build + local Cloudflare Workers preview
- `pnpm deploy` — build + deploy to Cloudflare
- `wrangler.jsonc` — Cloudflare project config

Image delivery uses `next/image` with Cloudflare CDN/edge caching.

---

## Further Reading

- [`AGENTS.md`](./AGENTS.md) — full project rules and context for AI agents
- [`GITHUB_ISSUES_GUIDE.md`](./GITHUB_ISSUES_GUIDE.md) — mandatory GitHub issues workflow for tracking all development work
- [`sentry_guide.md`](./sentry_guide.md) — Sentry integration notes
- `supabase/migrations/` — database migration history
- `implementation-plans/` — archived implementation plans per feature
