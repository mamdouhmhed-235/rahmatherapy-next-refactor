# AGENTS.md - Rahma Therapy

## Project Context

Rahma Therapy is a professional local business website for mobile hijama, cupping, massage, and soft-tissue therapy in Luton and surrounding areas.

The public marketing site, package pages, image-led sections, and booking request experience are active. Backend/admin work should follow the same product direction and design quality as the public site, not a separate generic dashboard style.

Future AI agents should treat this file as the starting context before making changes. Check existing patterns first, keep edits surgical, preserve unrelated worktree changes, and validate meaningful changes before committing.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js App Router |
| UI | React + shadcn/ui |
| Language | TypeScript strict |
| Styling | Tailwind CSS, CSS variables, design tokens, utility-first responsive styling |
| Motion | Framer Motion / Motion |
| Date picking | React DayPicker |
| Forms | React Hook Form + Zod |
| Client state | Zustand |
| Server state | TanStack Query |
| Backend platform | Supabase |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| CMS | Custom in-app admin CMS, Supabase-backed, no separate CMS |
| Storage | Supabase Storage |
| Email | Resend |
| Images | next/image plus Cloudflare CDN/edge caching |
| Analytics | None initially; add Umami later if needed |
| Package manager | pnpm |
| Build/dev | Next.js build pipeline; Turbopack in dev |
| Deployment | Cloudflare |

Core commands:

```bash
pnpm dev
pnpm lint
pnpm build
pnpm start
```

## Architecture Map

- `src/app` contains App Router entrypoints.
- `src/app/(public)` contains public routes, shared public layout, header/footer shell, and package detail routing.
- `src/app/(public)/services/[slug]` renders package detail pages from typed content and composes package page sections.
- `src/app/admin` is reserved for the future custom Supabase-backed admin CMS.
- `src/components/layout` contains site shell components such as header, footer, logo, and booking triggers.
- `src/components/shared` contains reusable public UI primitives such as `SectionContainer`, `SectionHeading`, image cards, trust pills, ratings, and credential logos.
- `src/components/ui` contains shadcn/ui-style primitives. Use these before adding new UI primitives.
- `src/components/home`, `about`, `services`, `faqs-aftercare`, `reviews`, and `package-pages` contain route-specific presentation sections.
- `src/features/booking` owns the booking request experience: modal dialog, multi-step flow, package data, time slots, Zod schemas, React Hook Form state, Zustand draft state, and request preparation.
- `src/content/pages` contains typed page content for public pages and package detail pages.
- `src/content/site` contains shared site identity, navigation, contact, footer, and social content.
- `src/content/images.ts` maps reusable image identity metadata.
- `src/lib/utils` contains generic helpers such as `cn`.
- `src/lib/seo`, `src/lib/content`, `src/lib/analytics`, and `src/lib/supabase` are reserved for cross-cutting infrastructure. Keep backend clients and integrations behind dedicated lib modules.
- `src/styles/tokens.css` defines Rahma design tokens and Tailwind theme variables.
- `src/app/globals.css` imports Tailwind v4 layers, tokens, animation CSS, and global public shell rules.
- `src/styles/site-parity.css` is the legacy Webflow parity layer. Prefer tokens, Tailwind, or scoped CSS modules for new/touched code.
- `public/images` stores local image assets consumed through `next/image`.

## Design Direction

The current visual direction is warm clinical luxury:

- Ivory and white surfaces, deep Rahma green, charcoal text, muted green-gray body text, and gold accents.
- Rounded cards and panels, soft borders, soft shadows, calm spacing, and restrained motion.
- Image-led layout whenever possible: full-bleed images, clear object-fit crops, dark transparent gradients, and text directly over imagery where it improves clarity.
- Clinical trust without feeling sterile: clean equipment, respectful private care, same-gender care context, clear aftercare, and professional qualification signals.
- Avoid generic SaaS/dashboard styling, purple/blue gradients, decorative blobs, loud palettes, or dense admin defaults.

Backend and admin surfaces must use the same brand language:

- Use the same tokens, spacing rhythm, typography, focus states, buttons, cards, and calm green/gold visual system.
- Admin/CMS screens should be efficient and scannable, but still feel like Rahma Therapy.
- Do not introduce an unrelated dark admin theme or default shadcn dashboard look unless it is restyled into the Rahma system.

## Frontend Rules

- Use Next.js App Router conventions. Prefer server components by default; add `"use client"` only for interactivity, browser APIs, local state, or effects.
- Use existing section and card patterns before creating new ones.
- Use `SectionContainer` for page bands and `SectionHeading` for section titles unless a section has a clear custom pattern.
- Use `next/image` through existing image helpers where available.
- Keep image cards clear: no unnecessary backing panels over image content, no exposed placeholder/file-path text in production-facing UI, and no clipped overlay text.
- Text must not overlap, clip, or escape its container at mobile or desktop widths.
- Preserve accessible semantics, keyboard focus, `aria-*` where needed, and visible focus states.
- Use lucide icons when an icon is needed.
- Keep motion subtle and purposeful. Respect reduced-motion patterns where relevant.
- Keep card radii, spacing, border opacity, and shadows consistent with the surrounding component.

## Backend, Data, And CMS Rules

- Supabase is the backend platform: Supabase Postgres, Supabase Auth, Supabase Storage, and Supabase client modules.
- Keep Supabase access behind dedicated modules in `src/lib/supabase` or feature-specific server utilities. Do not scatter raw client setup through components.
- Use Supabase Auth for admin/CMS access. Do not invent a separate auth system.
- Use a custom in-app admin CMS for content management. Do not add a separate CMS unless explicitly requested.
- Use React Hook Form + Zod for admin and public forms.
- Use TanStack Query for client-side server state when backend reads/writes are introduced.
- Use Resend for email/notification workflows.
- Never commit secrets, API keys, service role keys, `.env` files, or real private client data.
- Treat medical/complementary wellness copy carefully: Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care.

## Content And Routing Rules

- Public content currently lives in typed files under `src/content`. Prefer editing content there instead of hardcoding copy into components.
- Package detail routes are generated from `src/content/pages/packagePages.ts`.
- Navigation and site identity come from `src/content/site`.
- Preserve `trailingSlash: true` behavior from `next.config.ts`.
- Keep route slugs, booking package IDs, and existing CTA destinations stable unless explicitly asked to change them.

## Booking Flow Context

The booking flow is currently a modal experience mounted in the public layout via `BookingExperience`.

- State is split between React Hook Form, local component state, URL state, and persisted Zustand draft state.
- Package selection rules live in `src/features/booking/data/booking-packages.ts`.
- Visit/details validation lives in `src/features/booking/schemas/booking-schema.ts`.
- `submitBookingRequest` currently prepares the request payload. Future backend implementation should connect this flow to Supabase/Resend without changing the user-facing flow unnecessarily.

## Development Rules For AI Agents

- Read the relevant code before editing. Do not assume component structure.
- Touch only files required for the task.
- Do not refactor adjacent code unless the task requires it.
- Preserve unrelated dirty worktree changes. Stage only files you changed for the task.
- Use `pnpm lint` and `pnpm build` for meaningful code changes.
- For frontend changes, smoke test the affected route at desktop and mobile when practical.
- For docs-only changes, a focused diff/status check is usually enough.
- Use `apply_patch` for manual edits.
- Keep TypeScript strict. Avoid `any`, unsafe casts, disabled lint rules, and broad catch-all code.
- Follow existing imports, aliases, and file organization.
- When adding dependencies, justify why existing stack cannot solve the problem.

## Deployment And Operations

- Deployment target is Cloudflare.
- Image delivery should use `next/image` with Cloudflare CDN/edge caching.
- Analytics are intentionally absent for now. Add Umami later only when requested.
- Preserve performance basics: stable dimensions for media, low layout shift, optimized image loading, accessible interactive states, and no avoidable client-side JavaScript.
