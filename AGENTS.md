# AGENTS.md — Rahma Therapy

## Project

Professional local business website for **Rahma Therapy** — a mobile hijama/cupping, massage, and physiotherapy service based in Luton and surrounding areas.

**Current stage:** Early build, active development. Expect frequent changes.
**Current focus:** Frontend only. Backend, database, auth, storage, and API integrations are not in scope unless explicitly requested.

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js (App Router) |
| UI | React + shadcn/ui |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (utility-first, CSS variables/design tokens) + CSS Modules |
| Animation | Framer Motion |
| Forms | React Hook Form + Zod |
| Date picking | React DayPicker |
| Client state | Zustand |
| Server state | TanStack Query |
| Backend platform | Supabase (installed, not yet in use) |
| Email | Resend (installed, not yet in use) |
| Package manager | pnpm |
| Build | Next.js build pipeline, Turbopack in dev |
| Deployment | Cloudflare |

---

## Commands

```bash
pnpm dev        # Start dev server (Turbopack)
pnpm build      # Production build
pnpm lint       # Run ESLint
```

---

## Design & Quality Standards

- The website must be **professional, modern, responsive, reactive, and aesthetically pleasing** at all times.
- **Mobile-first** responsive design across all breakpoints.
- Target **Core Web Vitals**: fast LCP, low CLS, responsive interactions.
- Use **semantic HTML** and proper **ARIA attributes** for accessibility (WCAG 2.1 AA minimum).
- Prioritise **visual quality, smooth animations, and polished UI** above all else.
- Follow **industry best practices** for performance, responsiveness, and code quality.
- For frontend work, follow `docs/frontend-design-system.md` to preserve the implemented Rahma Therapy design system.

---

## Code Conventions

- **TypeScript strict mode** — no `any`, proper typing everywhere.
- **shadcn/ui** for UI components. Check existing components before adding new ones.
- **Tailwind CSS** for styling. Use CSS variables and design tokens. Utility-first approach.
- **CSS Modules** (`.module.css`) for complex, component-scoped styles when Tailwind alone is insufficient.
- **Zustand** for client-side state management.
- **React Hook Form + Zod** for form handling and validation.
- **TanStack Query** will handle server state once backend work begins.
- **Next.js App Router** conventions: route groups `(parentheses)`, layouts, server components by default, `"use client"` only when needed.
- Keep components **modular and reusable**. One concern per file.

---

## Key Rules

1. **Frontend focus only.** Do not build backend features, API routes, database schemas, auth flows, or storage integrations unless explicitly asked.
2. **Check existing patterns** before introducing new libraries or approaches.
3. **Never commit secrets**, API keys, or `.env` files.
4. **Use `next/image`** for images, `next/script` for external scripts.
5. **Maintain responsive design** across all breakpoints — test at mobile, tablet, and desktop.
6. **Prioritise visual quality** — this is a client-facing business website. Every pixel matters.
