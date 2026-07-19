# C-21 — Canonical domain fix (wrong site URL in metadata + structured data)

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase; discovered while restricting the Maps API key for C-20)
**Predecessors:**
- Discovery 2026-07-16: while setting HTTP-referrer restrictions on the Google Maps key, the live domain was confirmed as **`rahmatherapy.uk`** — which appears **nowhere in the codebase**. Instead the code carries two wrong domains: `rahmatherapy.co.uk` (12 refs) and `rahmatherapy.com` (8 refs).
- Root cause: **no single source of truth for the site URL** — each page hard-codes its own absolute URL string, so drift was inevitable and silent.
**Companion files:**
- Plan: `redesign/plans/C-phase/C-21-canonical-domain-fix-plan.md`
- Progress: `redesign/per-page-progress/C-21-canonical-domain-fix-progress.md` (filled during C-C)

---

## 1 — The defect

Search engines are being told the public pages live at domains that aren't the site.

| Location | Currently says | Class |
|---|---|---|
| `src/app/layout.tsx:9` — `metadataBase` | `https://rahmatherapy.co.uk` | **Site-wide**: builds every canonical URL + Open Graph/social image URL |
| `src/app/(public)/home/page.tsx:24` — JSON-LD `url` | `https://rahmatherapy.com/` | **Homepage** structured data — the highest-value page |
| `src/app/(public)/about/page.tsx:24` | `https://rahmatherapy.co.uk/about` | Structured data |
| `src/app/(public)/services/page.tsx:23` | `https://rahmatherapy.co.uk/services` | Structured data |
| `src/app/(public)/reviews/page.tsx:23,29` | `https://rahmatherapy.co.uk/` + `/reviews` | Structured data (breadcrumb) |
| `src/app/(public)/faqs-aftercare/page.tsx:25` | `https://rahmatherapy.co.uk/faqs-aftercare` | Structured data |
| `src/content/site/contact.ts:22-23` | `hello@rahmatherapy.co.uk` | **CONFIRMED DEAD (user, 2026-07-16)** — this mailbox does not exist. The real business email is **`rahmatherapy@outlook.com`**. Customers using the site's published contact address currently reach nobody. |
| `src/app/admin/email-templates/preview/[id]/route.ts:52,54` | `.co.uk` dummy values | Cosmetic (admin preview fixture) |
| `src/app/admin/password-reset/actions.ts:21` + `SubmittedConfirmation.tsx:10` | `f••@rahmatherapy.co.uk` masked-email fallback/comment | Cosmetic |
| Admin form placeholders/examples ×8 (`LoginForm`, `ForgotForm`, `SettingsForm`, `NewStaffForm`) | `@rahmatherapy.com` | Cosmetic (staff-only example text) |

**Severity note (2026-07-16):** the dead contact email is arguably worse than the SEO defect — a customer emailing the address published on the site gets nothing back. It ships in the same commit.

**Why it matters:** `metadataBase` drives canonical tags — telling Google the canonical version of every page is on a domain that doesn't serve the site invites indexing confusion and split/incorrect attribution; social shares request preview images from the wrong host (broken previews); JSON-LD `url`/breadcrumb values that disagree with the actual URL weaken entity matching. None of this breaks the site for visitors — which is exactly why it went unnoticed.

---

## 2 — Scope

1. **Single source of truth (the actual fix):** add `SITE_URL` to the existing site-content module (`src/content/site/`), sourced from an env var with a hard-coded production default, and make every absolute URL derive from it — `metadataBase`, all JSON-LD `url`/`item` values, anywhere else an absolute site URL is composed. After this, the domain exists in exactly ONE place.
2. **Correct the value** to the confirmed live domain `https://rahmatherapy.uk`.
3. **Contact email → `rahmatherapy@outlook.com`** (confirmed by the user 2026-07-16 as the real business address; the published `hello@rahmatherapy.co.uk` is dead). Applies **only where the string represents the clinic's own contact address**:
   - `src/content/site/contact.ts:22-23` — the displayed address + its `mailto:` link. **The user-visible fix.**
   - `src/app/admin/email-templates/preview/[id]/route.ts:54` — the `contactEmail` value in the template-preview fixture (it stands in for the clinic's contact line in rendered previews).
   - Anywhere else a *clinic contact* address is composed (grep at impl).
   **NOT applied to per-person staff-email fields** — login/staff/password-reset form placeholders and error examples describe *a staff member's own* email, not the clinic's. Those carry `@rahmatherapy.com` today (a domain the business doesn't own); replace them with a neutral example (`you@example.com` / `name@example.com`) rather than the owner's personal-business address, which would be misleading in a "type YOUR email" field. Same for the masked-email fallback in `password-reset/actions.ts:21` (`f••@example.com`).
4. **Cosmetic sweep (same commit, zero-risk):** with items 2–3 done, no `rahmatherapy.co.uk` or `rahmatherapy.com` literal remains anywhere in `src/`.
5. **Guard:** a unit test asserting no hard-coded `rahmatherapy.co.uk` / `rahmatherapy.com` string survives in `src/` (a grep-style assertion) so drift can't silently return.

**Not in scope (flagged for the user's decision, not actioned):** the site has **no `sitemap.ts` and no `robots.ts`** — a genuine SEO gap, but a separate piece of work. Also out: redirects from the old domains (only relevant if `.co.uk`/`.com` are owned and pointed anywhere — a DNS/registrar matter, not code).

---

## 3 — Everything else

- **Migration:** none. **Packages:** none. **Bundle:** ~0.
- **Sequencing:** fully independent; small; can ship immediately. Worth shipping BEFORE the public site gets more search traffic (the longer wrong canonicals are indexed, the longer the correction takes to propagate).
- **Post-ship (user actions, recorded):** re-submit/verify the site in Google Search Console under the correct domain; social-share preview re-scrape (LinkedIn/Facebook debuggers) if previews were shared previously.
- **Acceptance:** `SITE_URL` is the only place the domain appears; every public page's rendered canonical + JSON-LD shows `https://rahmatherapy.uk/...`; view-source spot-check on all 6 public pages; **the site's published contact address reads `rahmatherapy@outlook.com` and its `mailto:` link opens to it**; no `rahmatherapy.co.uk` / `rahmatherapy.com` literal survives in `src/`; the anti-drift test passes; no visual change beyond the corrected email text; static gates pass.

---

*End of C-21 brief. Plan: `redesign/plans/C-phase/C-21-canonical-domain-fix-plan.md`.*
