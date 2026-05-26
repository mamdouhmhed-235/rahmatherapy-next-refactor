# Product

## Register

product

## Users

Rahma Therapy is a UK-based mobile hijama, cupping, massage, and soft-tissue therapy clinic operating in Luton and surrounding areas. The admin/CMS is used by a small clinic-operations team across five RBAC roles:

- **Owner / Main Admin** — the practice owner. Holds every permission. Spots revenue and operational issues, sets policy (services, settings, role templates), bootstraps staff, owns the audit trail.
- **Admin / Practice Manager** — runs the business day to day. Full booking and client management, revenue and operational reports, staff profile editing, email and enquiry workflows. No role-template authority, no individual permission overrides by default.
- **Booking Coordinator** — front-desk-style. Manages enquiries and bookings, assigns work, contacts clients. No revenue access, no staff/role management, no audit or privacy.
- **Therapist** — sees only their own assigned bookings, manages their own availability, opens assigned clients' contact and health context within scope, captures session notes.
- **Inactive** — revoked staff. Sign-in is blocked at the middleware; the surface exists for HR/audit purposes only.

Context is daily clinic operations: triaging today's bookings, assigning therapists with gender-matching to clients (a culturally significant constraint — Rahma serves a predominantly Muslim clientele where same-gender care is expected), confirming and reminding, handling enquiries that haven't yet become bookings, capturing aftercare notes. Primary surface is desktop in the clinic office or at home; secondary is mobile in transit between visits or while a therapist is on-site.

## Product Purpose

Rahma Admin is the operational backbone of the clinic. It exists so a small team can run a high-touch, culturally-sensitive complementary-wellness practice without losing track of clients, missing payments, or accidentally double-booking a same-gender therapist. The public marketing site exists to bring clients in; this product exists to serve them once they've arrived, and to make the staff doing that work feel respected and unhurried.

Success in six months looks like:

- **Role clarity.** Each role only sees and acts on what they need; a therapist never stumbles into revenue data, a coordinator never has to walk around the audit surface to do their job.
- **Operator confidence.** Calm, scannable, predictable; no surprises in production. Status is unambiguous. Empty states encourage rather than abandon. Errors are announced.
- **Front-desk speed.** Fewer clicks per booking triage. The Today list and Needs-Attention queue do most of the daily work without context-switching between pages.

Brand-grade polish is the *floor* (the admin must read as a Rahma surface, not a generic dashboard), not the *success metric*. The metric is operations.

## Brand Personality

**Calm · Scannable · Dignified.**

A quiet operational tool that respects its operators. Warm where the public site is warm; restrained where the public site is image-led; never shouts. Voice is plain, direct, and kind: "All caught up" rather than "0 items"; "Send reminder" rather than "Trigger notification"; "Therapist not yet assigned" rather than "Status: NULL." Numerals are confident and a little decorative (Cormorant Garamond on stats and marquee numbers); body and form copy are quiet (Work Sans). Imagery — avatars, dignified empty-state illustrations, charts — earns its place. Decoration that carries meaning, not decoration for decoration's sake.

**Positive reference: Linear's *sensibility*, not Linear's *vocabulary*.** Take Linear's restraint, operator confidence, careful typography, keyboard-first respect for power users — apply them through the warm clinical Rahma palette, with avatars, illustration, and chart richness where Linear would use pure typography. The intersection is **disciplined warmth**.

## Anti-references

- Generic SaaS / shadcn-default dashboards.
- Purple-and-blue gradients, neon-on-black, "tools look cool dark."
- Decorative blobs, glassmorphism, hero-metric template (big number / small label / supporting stats stacked decoratively).
- Loud palettes, dense admin defaults, table-of-everything home pages.
- Color-only status signalling — a chip's tone alone never tells the story.
- Side-stripe borders, gradient text (impeccable absolute bans).
- Tools so spare they feel cold — pure-typography admin with no avatars, illustrations, or warmth. Linear-vocabulary is *not* the target.
- Everything-on-one-screen SaaS dashboards — 30 cards, no hierarchy, infinite scroll of widgets.

Cards are the admin's natural vocabulary and are not banned, but they must be varied and considered; icon + heading + text repeated thoughtlessly is the same antipattern as the hero-metric template.

## Design Principles

1. **Simplicity that opens into depth.** The first surface a staff member sees is calm and obviously useable. Complexity — filters, mass-actions, advanced views, the full report library — lives one drill-down away, never on the front page. New staff feel productive in minutes; experts can reach everything in seconds.

2. **One floor of ease — every role.** Whether the user is the Owner or a brand-new Therapist, the basic operations (find a booking, send a reminder, claim work, change a status) work the same way and feel equally fast. Role differences shape *what is shown*, never *how hard each shown thing is*.

3. **Calm, scannable, visual.** Restraint as the baseline; visuals when they earn their place — staff avatars, dignified empty-state illustrations, readable charts, the warm clinical palette, Cormorant numerals on stats. Decoration that carries meaning. Not Linear-bare; not SaaS-loud.

4. **Front-desk first.** The Today list and Needs-Attention queue do the bulk of daily work. Visible state at the top of every screen; fewer page-loads, less context-switching. Owner-mode adds more cards, but Today is still the front door.

5. **Auditable and reversible.** Every mutation writes an audit log; the UI shows it. Destructive actions require explicit confirmation; non-destructive ones are instant. Staff can trace what they (or someone else) did, without leaving the page.

## Accessibility & Inclusion

**Target: WCAG 2.1 AA** across the admin surface. UK B2C context (Equality Act 2010 "reasonable adjustments").

Specific commitments derived from the Phase 0 accessibility baseline:

- **Heading hierarchy contiguous.** No H2 skips. shadcn `CardTitle` defaults to `<h3>` and is currently causing four pages to skip from H1 to H3; the redesign fixes the heading level via component or composition.
- **Every form input labelled.** Live recon already found one unlabelled filter input at `/admin/clients` and the `name="location"` field. Net-new forms inherit the implicit-label pattern at minimum; nothing ships unlabelled.
- **Form errors announced.** All form-level error regions wrap in `role="alert" aria-live="polite"` so assistive tech catches them on submit.
- **Status is never color-only.** Every tone or chip pairs with a text label or shape cue. Tab-style links carry `aria-current="page"` (currently styled by color only).
- **Required fields visibly marked** (currently the `required` attribute is present without any visual hint).
- **Motion respects `prefers-reduced-motion`** — already honoured globally; the redesign preserves it.
- **Contrast at 4.5:1 on body text, 3:1 on UI components.** Tokens reviewed during Phase 4 (Design System).

**Cultural inclusion.** Rahma serves a predominantly Muslim clientele where same-gender care is the norm and a clinical requirement. Booking, assignment, and staff profile UX must keep gender-matching legible and unambiguous; copy must respect that same-gender care is the expected default, not an exception to be apologised for. Health-note language stays clinical and dignified — these are bodies in care, not "subjects."

## Admin-Specific Context

**Business type:** Small local business in the cupping and massage niche. Mobile-delivery model — therapists travel to client locations.

**Business size:** Small, 3 to 4 people.

**Industry:** Healthcare, alternative-treatment branch. Cupping (hijama), massage, and soft-tissue therapy.

**Admin users:** Two people hold the highest-privilege accounts and both effectively operate as owners. In practice this likely splits into one "Main Admin / Owner" and one "Admin / Practice Manager" with near-owner privileges. All other users are therapists (workers of the business). The current 5-role RBAC (Owner, Admin / Practice Manager, Booking Coordinator, Therapist, Inactive) covers this comfortably; "Booking Coordinator" may sit dormant at the current team size until the business adds front-desk support.

**Tech level:** Novice. Day-to-day operators are not engineers. Their existing CRM is monday.com, so they are familiar with card / board / colour-coded status vocabulary, but not with conventional admin dashboards. Implication: lean into recognisable card-and-list paradigms; avoid power-user keyboard shortcuts as a primary path; surface every action via visible UI before it lives behind a shortcut.

**Usage intensity per day:** Per-day count not measured. Important behavioural signal: the team accesses the admin from their phone, anytime, including away from a desk. **Mobile-first frequency**, not mobile-as-fallback. Daily reach is "whenever a booking, enquiry, or rebook comes in", which can happen at any hour.

**Top daily tasks:**
1. **Create bookings.** New customer or admin-entered (phone, WhatsApp, walk-in).
2. **Rebook existing clients.** A returning client comes back; the admin needs to find them fast and pre-fill from their last visit.
3. **Use the CRM to track business-essential metrics.** Today's schedule, payment health, repeat-client trend, simple revenue and workload numbers (the things they currently use monday.com for, plus the things monday.com cannot do because it is generic).

**Pain points:** The team describes the current UI as confusing, unprofessional, and complicated. Caveat to weigh during the redesign: when they reviewed it they were signed in as the highest-privilege account, which exposes every panel and every action at once. That likely amplified the "too much" feeling. The redesign must solve both halves: cut visual density at every role, and especially trim the highest-privilege surface so power does not equal clutter.

**Design standard target:** Beautiful and simple, where simplicity is the front door to depth rather than a cap on capability. The first surface a user sees is clean and obvious; complexity unfolds when invited. Ease of use is the measurable property: a new therapist on a phone and a tired owner on a laptop should both feel fluent inside the first session.

**CSS framework constraint:** No external constraint. The redesign builds on the current chosen stack, which stays fixed. For the record:

| Layer | Choice |
| --- | --- |
| Framework | Next.js App Router |
| UI | React + shadcn/ui |
| Language | TypeScript strict |
| Styling | Tailwind CSS, CSS variables, design tokens, utility-first responsive styling |
| Motion | Framer Motion (Motion) |
| Date picking | React DayPicker |
| Forms | React Hook Form + Zod |
| Client state | Zustand |
| Server state | TanStack Query |
| Backend platform | Supabase |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| CMS | Custom in-app admin CMS, Supabase-backed; no separate CMS |
| Storage | Supabase Storage |
| Email | Resend |
| Images | `next/image` plus Cloudflare CDN/edge caching |
| Analytics | None initially; Umami later if needed |
| Package manager | pnpm |
| Build/dev | Next.js build pipeline; Turbopack in dev |
| Deployment | Cloudflare |

**Backend issues to leave alone:** There is no online payment system. This is intentional, by design. Bookings carry `payment_status`, `amount_due`, `amount_paid`, `payment_method`, and `payment_note` fields, but no payment-gateway integration. The customer-facing booking page is planned to let a client indicate their preferred payment type (cash or card on the day); that selector is on the roadmap, not built. Beyond payments, the full list of untouchable backend surfaces lives in `/redesign/RECON.md` §5.

**Niche specificity:** Small-team mobile hijama, cupping, massage, and soft-tissue therapy practice operating in Luton and surrounding areas, UK. Cultural context: predominantly Muslim clientele, same-gender care is the expected default and a clinical requirement.

**Jurisdiction:** UK, Luton operating area. Relevant regulators and frameworks: ICO (UK GDPR + cookie consent), Equality Act 2010 (accessibility, "reasonable adjustments"), CNHC or equivalent voluntary register where a practitioner holds membership, professional-body and insurer record-keeping requirements per therapist. The Foundation Floor (`/redesign/FOUNDATION-FLOOR.md`) Section 2 can now be filled with these specifics.

**Business scale:** Small team, five people or fewer. Calibration implication for the redesign: simpler is better, no over-engineering, no enterprise-grade power-user density. Density appears on demand, not by default. Build the proper system, but right-sized for a clinic of this scale.

**Business model:** B2C.

**Payment model:** In-person only. Cash or card, paid on the day of service. Customers will eventually be able to indicate their preferred payment type on the customer-facing booking page (designed, not yet implemented). No subscriptions, no memberships, no online checkout, no deposit-and-balance flow.

## Voice Anchors

(This subsection deepens the `Brand Personality` voice line above; it does not replace it. Phase 6 `clarify` and Phase 7 Gate 2 `clarify` must read BOTH the Brand Personality line AND this section when tuning copy voice.)

**Primary tone:** Calm, plain, direct, kind. Quietly competent. Verbs over nouns: "Send reminder," not "Trigger notification." Real numbers and real names: "Outstanding £45," not "Pending balance." Empty states encourage ("All caught up"), they never apologise ("No data available"). Errors say what to do next, never just what failed. Never patronising; never clever-for-the-sake-of-it. The voice never grandstands and never shrugs.

**Voice references** (products whose admin voice we admire):

- **Linear** (primary, already confirmed during teach): operator-clarity, terse where terseness helps, never decorative, never patronising. The product-copy benchmark for this admin.
- **Stripe Dashboard status microcopy** (narrow voice-only reference): precision of state words. "Paid in full," "Outstanding £45," "Refunded on 12 May" beats "Status: complete." Use Stripe's *state-word discipline*, not Stripe's visual vocabulary.

These references describe the *writing voice* only. The visual direction was set in the Brand Personality section above (warm clinical Rahma palette, disciplined warmth, calm and scannable and dignified).

## Design Direction

Direction chosen: **Tactile Card-Board**

Real product reference: Trello (de-cluttered) + Linear's Triage view + Basecamp 4's todo grid — refined into Rahma's warm clinical identity.

Reason for choosing (user's words): The team uses monday.com daily and is comfortable with card / board / colour-coded status vocabulary. They are moving off monday.com for operational reasons (clinic-specific workflows, gender matching, healthcare context — not design grievances with monday.com itself). The "generic / unprofessional / complicated" pain point applies to the *current Rahma admin codebase*, not to monday.com. So the team's monday.com fluency is an asset to inherit, not a pattern to avoid. Card-Board transfers that muscle memory directly while raising the visual polish far above what a generic project tool can deliver. The user also wants more visuals where relevant — prominent avatars, dignified illustration in empty states, considered chart richness, status iconography paired with colour — not the stripped-bare Linear vocabulary.

Trade-off accepted: Card-Board needs disciplined restraint to avoid reading "too monday.com" / too generic. The redesign mitigates this through (1) warm clinical Rahma palette already established (ivory canvas, deep green chrome, gold accent), (2) Cormorant Garamond on marquee numerals as a signature serif voice, (3) varied card sizes and compositions per content type (anti-identical-grid), (4) prominent staff avatars and dignified empty-state illustrations, (5) clinic-specific affordances (gender-matching legibility, same-gender assignment as visible status, mobile-first triage) that no generic project tool provides. Mobile horizontal-scroll boards need careful handling — likely a vertical-stack fallback on narrow viewports rather than horizontal scroll.

Visual richness commitment: Where relevant the admin leans into avatars (real or initialled), dignified empty-state illustration (not just text + line), considered chart treatment on reports/dashboard, and meaningful iconography (paired with text, never replacing it). Decoration that carries meaning, not decoration for decoration's sake. This is the "disciplined warmth" intersection from the Brand Personality section — applied as a card-board grammar rather than an editorial grammar.

Date: 2026-05-11
