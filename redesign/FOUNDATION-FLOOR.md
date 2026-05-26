# Foundation Floor (Step 10a)

Recon-only audit of the seven universal pre-launch items, plus a placeholder for jurisdiction-derived items pending Phase 1.

**Pre-launch status:** the production domain `rahmatherapy.co.uk` does **not** currently resolve from this environment (`Could not resolve host`). The site is not yet deployed publicly. Therefore live HTTPS / HSTS / mixed-content checks at the production edge are not testable here — those must be verified at Cloudflare on first deploy.

References used: `next.config.ts`, `src/middleware.ts`, `src/lib/email/client.ts`, `sentry.{client,server,edge}.config.ts`, `wrangler.jsonc`, `.env` / `.env.example`, `docs/production-runbook.md`, `docs/production/production-readiness-checklist.md`, dev-server header probe via `curl -I http://localhost:3000/admin/login/`.

---

## SECTION 1: Universal Floor

### 1. HTTPS — **PARTIAL** — **BLOCKS-LAUNCH**
- **Code intent:** `src/app/layout.tsx:9` sets `metadataBase: new URL("https://rahmatherapy.co.uk")`; SEO/canonical URLs across `src/app/(public)/**` all point at `https://rahmatherapy.co.uk`. Production canonical is HTTPS-only by design.
- **HSTS:** **not** set in `next.config.ts headers()` (`Strict-Transport-Security` absent). Cloudflare can enforce HSTS at the edge but the `wrangler.jsonc` config does not declare it; "Always Use HTTPS" + HSTS must be confirmed in the Cloudflare dashboard before launch.
- **Mixed-content:** untestable until deployment. Codebase contains zero `http://` URLs in production code paths (verified with grep: only test fixtures and dev `.env`).
- **Local dev exception:** `.env` `NEXT_PUBLIC_SITE_URL=http://localhost:3000/` is local-only; production uses HTTPS via Cloudflare.

### 2. Auth basics — **PRESENT** — **BLOCKS-LAUNCH** (met)
- **Authentication:** Supabase Auth via `@supabase/ssr`. Server-side session refresh in `src/middleware.ts` (matcher `/admin/:path*`).
- **Session handling:** middleware reads cookies via `request.cookies.getAll()`, refreshes on every admin request, writes back via `supabaseResponse.cookies.set()`. Unauthenticated requests redirect to `/admin/login?redirectTo=…`. Inactive `staff_profiles.active = false` redirects to `/admin/login?reason=inactive`.
- **Defense in depth:** every admin page additionally calls `getStaffProfile(supabase)` + `getAdminPageAccess(profile, pageKey)` — see RECON §6 for the full RBAC story.
- **Signout:** POST-only to `src/app/admin/signout/route.ts` from three call sites; CSRF-resistant (no GET signout endpoint).

### 3. Backups configured — **PARTIAL** — **BLOCKS-LAUNCH**
- **Platform default:** Supabase Postgres includes automatic daily backups on Free / Pro / Team tiers; project `twzutkfgqclqurvkmvqz` is `ACTIVE_HEALTHY` (verified via Supabase MCP `list_projects`). Tier and retention window are **not** documented in this repo.
- **Documentation:** `docs/production-runbook.md:159` states verbatim: *"Supabase backups and export expectations must be confirmed before launch."*
- **Restore test:** **no record** of any restore drill in commits, runbook, or scripts. `pnpm verify:london-time` exists for time-handling, but there is no `pnpm restore:smoke-test` equivalent.
- **Storage:** Supabase Storage bucket `staff-avatars` (private) is the only bucket per `docs/production/production-readiness-checklist.md:62`. No documented backup of object storage independent of Supabase platform defaults.
- **Action required pre-launch:** confirm backup tier, document retention window, perform one timed restore drill, and decide whether off-platform backup snapshots are required for a UK B2C therapy CRM (likely yes given health-note retention).

### 4. Error tracking installed — **PRESENT** — **NICE-TO-HAVE** (already at BLOCKS-LAUNCH bar, but installation is a nice-to-have-by-default)
- **Sentry wired** at all three layers:
  - Client: `sentry.client.config.ts` — Replay integration, `tracesSampleRate: 0.1` (1.0 in dev), `replaysOnErrorSampleRate: 1.0`, `sendDefaultPii: false`, `beforeSend: scrubSentryEvent`.
  - Server: `sentry.server.config.ts` — same scrubbing + `includeLocalVariables: false` in production (verified by `docs/production-runbook.md:60`).
  - Edge: `sentry.edge.config.ts` (file present per repo root).
- **Build integration:** `next.config.ts` wraps with `withSentryConfig({ org: "lanternvale", project: "rahmatherapy-next-refactor", tunnelRoute: "/monitoring" })`. Source-map upload via `SENTRY_AUTH_TOKEN`.
- **PII scrubbing:** `src/lib/observability/sentry-scrubbing` exports `scrubSentryEvent` used by both client and server `beforeSend`.
- **Live verification:** during recon, Playwright observed Sentry tunnel POSTs to `/monitoring/` returning 200 OK — Sentry is reaching its endpoint.
- **Outstanding:** `NEXT_PUBLIC_SENTRY_DSN` must be set in Cloudflare runtime env at deploy; no project-level alert routing rules are documented in this repo (Sentry-side concern).

### 5. Environment separation — **PARTIAL** — **BLOCKS-LAUNCH**
- **Local dev:** uses `.env` pointing at the same Supabase project (`twzutkfgqclqurvkmvqz`) that production will use. There is **only one Supabase project** in the configured org (`Rahma-therapy`) — verified via Supabase MCP.
- **Cloudflare environments:** `wrangler.jsonc` declares no `[env.staging]` or `[env.production]` blocks — single deploy target.
- **Test data isolation:** test users (`test.admin@…`, `test.coordinator@…`, `test.therapist@…`, `test.inactive@…`) and Phase-10 e2e users (`phase10.*@example.test`) coexist in the same DB the dev server hits. Per Phase-0 recon, they're markered (`source_detail = 'phase10_e2e'`) and have a clean teardown via `pnpm test:e2e:cleanup`.
- **Secrets:** `.env` is `.gitignore`'d; `.env.example` provides setup template. No accidental secret commits found.
- **Action required pre-launch:** either (a) provision a separate staging Supabase project + Cloudflare Worker env, or (b) document an explicit "production = clean DB, test markers will be wiped" gate. Without one of those, real customer data and Phase-10 fixtures will share a database.

### 6. Security headers — **PARTIAL** — **BLOCKS-LAUNCH**
- **Live-confirmed present** (probed `curl -IL http://localhost:3000/admin/login/`):
  - `X-Content-Type-Options: nosniff` ✓
  - `Referrer-Policy: strict-origin-when-cross-origin` ✓
  - `X-Frame-Options: SAMEORIGIN` ✓
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` ✓ (extra item; not in your seven but worth noting)
- **Missing in code:**
  - **`Content-Security-Policy`** — absent. `docs/production/production-readiness-checklist.md:73` explicitly states *"Rate-limit / CSP audit: not in this scope. Recommended next pass."* The team is aware.
  - **`Strict-Transport-Security`** — absent in code; potentially auto-applied by Cloudflare at the edge but unverified.
- **Information leak:** `X-Powered-By: Next.js` is sent. Minor; not a blocker.
- **Frame-ancestors strategy:** uses `X-Frame-Options: SAMEORIGIN` rather than the preferred `Content-Security-Policy: frame-ancestors 'self'`. Functionally equivalent for now, but a real CSP supersedes XFO.
- **Action required pre-launch:** add CSP (start in `report-only` mode, then enforce) covering at least `default-src 'self'`; `script-src` allowing `'self'` + Sentry tunnel; `style-src` allowing `'self' 'unsafe-inline'` (Tailwind needs inline for some hash patterns); `connect-src` including Supabase project URL + Sentry; `img-src` including Supabase Storage + Cloudflare Images; `frame-ancestors 'self'`. Verify HSTS with `max-age >= 31536000; includeSubDomains; preload`.

### 7. Transactional email working — **PRESENT** — **BLOCKS-LAUNCH** (met, with one launch-time check)
- **Provider:** Resend (`@resend/resend` via `src/lib/email/client.ts`).
- **Failure mode:** explicit, **not silent.** `EmailConfigurationError` thrown on missing `RESEND_API_KEY` or `RESEND_FROM_EMAIL`; `EmailDeliveryError` thrown on Resend API error response. Server actions catch and persist `email_delivery_events` rows (success/failure visible at `/admin/emails`).
- **Senders covered:** booking confirmation, assignment notifications, manual admin reminders (`sendManualBookingReminder` in `src/app/admin/emails/actions.ts`), enquiry conversion, password reset (Supabase Auth's built-in flow).
- **Audit trail:** every send writes an `email_delivery_events` row + an `audit_logs` row for staff-initiated sends (e.g., `manual_booking_reminder_sent`).
- **Templates:** `src/lib/email/templates.ts` + `src/lib/email/notifications.ts` — server-only modules.
- **Pre-launch check** (per `docs/production-runbook.md:130`): confirm `RESEND_FROM_EMAIL` is a verified sender/domain in Resend; submit a real booking and verify customer + admin emails are accepted.

---

## SECTION 1 — Summary table

| # | Item | Status | Tag |
|---|---|---|---|
| 1 | HTTPS | PARTIAL (deployed-state untested; HSTS not in code) | BLOCKS-LAUNCH |
| 2 | Auth basics | PRESENT | BLOCKS-LAUNCH (met) |
| 3 | Backups configured | PARTIAL (platform-default unverified; no restore drill) | BLOCKS-LAUNCH |
| 4 | Error tracking installed | PRESENT (Sentry, scrubbed, tunneled) | NICE-TO-HAVE (already at floor) |
| 5 | Environment separation | PARTIAL (single Supabase project, no Cloudflare envs) | BLOCKS-LAUNCH |
| 6 | Security headers | PARTIAL (missing CSP + HSTS; team aware) | BLOCKS-LAUNCH |
| 7 | Transactional email working | PRESENT (Resend, audited, non-silent failures) | BLOCKS-LAUNCH (met) |

**Universal floor pre-launch blockers:** items 1, 3, 5, 6 need work before launch.

---

## SECTION 2: Jurisdiction-Derived Legal Floor

Items applicable to this business per PRODUCT.md §Jurisdiction (`PRODUCT.md:132`) and §Niche specificity (`PRODUCT.md:130`): a UK B2C mobile complementary-therapy clinic in Luton handling **special-category (health) data** under UK GDPR, serving a predominantly Muslim clientele where same-gender care is a clinical requirement. ICO registration applies because the business processes personal data for business purposes. PECR / cookie-consent applies if/when non-essential cookies (analytics) are introduced.

References used: `PRODUCT.md`, `src/app/(public)/**`, `src/app/admin/privacy/**`, `src/app/admin/clients/**`, `src/content/site/footer.ts`, `supabase/migrations/**`, `redesign/A11Y-BASELINE.md`.

### 1. ICO registration & data controller declaration — **MISSING** — **BLOCKS-LAUNCH**
- **Why this applies:** any UK business processing personal data for non-domestic purposes must register with the ICO and pay the annual data-protection fee (Data Protection (Charges and Information) Regulations 2018). A B2C clinic handling clinical health records is firmly in scope.
- **Code/docs evidence:** no ICO registration number, "data controller" or "data processor" identity declared anywhere in repo. A repo-wide grep for `ICO`, `data controller`, `data processor` returns no business-side declaration (only this Foundation Floor doc itself).
- **Action required pre-launch:** register with the ICO, capture the registration reference number, and surface it in the public privacy notice (item 2). Decide whether a DPO is appointed — likely not required at this scale (Article 37 thresholds) — but a named "data protection contact" should still exist.

### 2. Public-facing privacy notice & cookie policy — **MISSING** — **BLOCKS-LAUNCH**
- **Why this applies:** UK GDPR Articles 13–14 require a privacy notice at the point of personal-data collection. The customer booking flow on the public site is the trigger.
- **Code evidence:** `src/content/site/footer.ts:26` has `legalLinks: []` (empty array — verified). No `/privacy`, `/cookies`, `/terms`, or `/legal` routes exist under `src/app/(public)/`.
- **Minimum contents needed:** controller identity + ICO reference, what data is collected (contact, health notes, gender preference), lawful bases (Article 6(1)(b) contract + Article 9(2)(a) explicit consent for health data), retention periods, recipients (Supabase, Resend, Cloudflare), data-subject rights (access, rectification, erasure, complaint route to ICO).
- **Action required pre-launch:** ship `/privacy` (privacy notice) and `/cookies` (cookie policy) routes under `src/app/(public)/`, populate `legalLinks` in `src/content/site/footer.ts`.

### 3. Cookie consent (PECR) — **PARTIAL (deferred by design)** — **NICE-TO-HAVE today, BLOCKS-LAUNCH when analytics ship**
- **Why this applies:** PECR Regulation 6 plus ICO 2019 guidance require prior consent for non-essential cookies. Strictly-necessary cookies (Supabase auth session) do not require a banner; analytics cookies do.
- **Current evidence:** PRODUCT.md:123 declares analytics intentionally deferred — *"Analytics: None initially; Umami later if needed."* No analytics scripts in `src/app/layout.tsx`; no `CookieBanner` component anywhere in `src/components/`. Sentry's tunnel POSTs are strictly-necessary error tracking and use no third-party cookies.
- **Action required pre-launch:** none for today's stack (no non-essential cookies). **Before turning on Umami or any analytics**, ship a consent banner (granular toggle, prior-consent default-off) and update the cookie policy. Until that day, current MISSING state is acceptable.

### 4. UK GDPR Right of Access / DSAR fulfilment (Article 15) — **PARTIAL** — **BLOCKS-LAUNCH**
- **What exists:** a workflow tracker. `PRIVACY_REQUEST_TYPES` at `src/app/admin/clients/actions.ts:26-31` includes `'data_export'`; UI to log/triage privacy requests lives at `src/app/admin/privacy/page.tsx`. Audit logs record state transitions (`src/app/admin/privacy/actions.ts:64`).
- **Gap:** there is **no automated export function** that compiles a client's bookings + health notes + audit history into a portable file. A DSAR today would be fulfilled by manual export, which is feasible at this scale (5-person clinic, low volume) but undocumented.
- **Action required pre-launch:** either (a) write a one-button "Generate DSAR pack" action in `src/app/admin/clients/[clientId]/actions.ts` that returns a structured JSON or PDF, or (b) document the manual export procedure in `docs/production-runbook.md` and accept it as the pre-launch SLA path. Option (b) is right-sized for current scale.

### 5. UK GDPR Right to Erasure (Article 17) — **PARTIAL** — **BLOCKS-LAUNCH**
- **What exists:** `PRIVACY_REQUEST_TYPES` includes `'deletion_review'` (`src/app/admin/clients/actions.ts:26-31`); audited workflow at `src/app/admin/privacy/`.
- **Gap:** no automated anonymisation/redaction routine. Article 17(3)(b) exempts processing required by law — including professional-body and insurer record-keeping retention (PRODUCT.md:132) — but the boundary between erasable contact data and retained clinical record needs to be coded or documented.
- **Action required pre-launch:** document, in the privacy notice (item 2), which data is erasable on request and which is retained under legal obligation; decide whether erasure pseudonymises the contact fields (name, phone, email) while preserving the booking record for retention. Implementation can follow launch if procedure is documented and a single staff erasure action can be done manually within ICO's one-month window.

### 6. Special-category (health) data — Article 9 explicit consent + retention policy — **PARTIAL** — **BLOCKS-LAUNCH**
- **Why this applies:** health notes are special-category personal data (UK GDPR Article 9(1)). The most workable lawful basis here is Article 9(2)(a) **explicit consent**, captured at booking time.
- **Consent — PRESENT:** `bookings.consent_acknowledged` boolean and `bookings.health_notes` field exist (`supabase/migrations/20260503090000_phase15_safety_consent_notes.sql:2-3`, verified); booking participants carry the same pattern. The intake/booking flow already asks for acknowledgement.
- **Gap (consent):** the consent text must explicitly meet the Article 9(2)(a) bar — "explicit consent for the processing of those personal data for one or more specified purposes" — and must be reviewable in the audit trail. Confirm the exact copy of the consent acknowledgement (in the booking form's intake copy) satisfies "explicit" not merely "implied."
- **Gap (retention):** no retention policy or automated purge. No retention period declared in code, migrations, or docs. CNHC / professional-body guidance commonly recommends ~7 years post-final-session for adults (longer for minors). Health data cannot legally live indefinitely without a defined period.
- **Action required pre-launch:** (a) write a one-paragraph retention policy in PRODUCT.md or `docs/data-retention.md` stating the retained period and rationale; (b) audit the existing consent acknowledgement copy and revise if it does not meet the "explicit" standard; (c) automated purge can follow launch — manual archival is acceptable at this scale.

### 7. Equality Act 2010 — WCAG 2.1 AA accessibility — **PARTIAL** — **BLOCKS-LAUNCH**
- **Why this applies:** PRODUCT.md:66 declares *"Target: WCAG 2.1 AA across the admin surface. UK B2C context (Equality Act 2010 'reasonable adjustments')."* The duty applies to the public booking site; the admin surface is held to the same internal bar.
- **What exists:** Phase 0 accessibility baseline at `redesign/A11Y-BASELINE.md` enumerates concrete violations — H1→H3 heading skips on `/admin/settings`, `/admin/staff`, `/admin/availability` (shadcn `CardTitle` renders as `h3`); unlabelled filter input `name="location"` at `/admin/clients`; form errors not announced (`role="alert"` missing); required-field visual markers absent; status communicated by colour alone in places. The redesign already names these as P0 fixes in `redesign/RECIPE-PROGRESS.md` Phase 4 carry-forwards.
- **Gap:** none of those fixes have shipped yet — they are scheduled for Phase 6 implementation.
- **Action required pre-launch:** complete the P0 a11y fixes listed in `redesign/RECIPE-PROGRESS.md` Phase 4 carry-forwards. Phase 7 QA must verify with an automated a11y scan (axe / Pa11y) before sign-off.

### 8. Same-gender care affordance (clinical requirement + Equality Act §195 / Sched. 3 ¶28) — **PRESENT** — **BLOCKS-LAUNCH (met)**
- **Why this applies:** same-gender care is declared a **clinical requirement** by the business (PRODUCT.md:78, :130). The Equality Act 2010 §195 / Schedule 3 paragraph 28 permits gender-restricted services where a genuine occupational requirement justifies it; intimate-treatment provision plainly qualifies.
- **Schema evidence:** `staff_profiles.gender` enum at `supabase/migrations/20260502052452_phase2_group2_staff_profiles.sql:18` (verified); `clients.gender_preference` enum (`male` / `female` / `no_preference`) at `supabase/migrations/20260502052516_phase2_group4_clients_and_bookings.sql:6` (verified); `bookings.required_therapist_gender` carried through assignment.
- **Logic evidence:** assignment guard at `src/app/admin/bookings/actions.ts:262` (verified) — `if (assignment.required_therapist_gender !== actor.gender) return { error: "You cannot claim an assignment for another therapist gender." }`.
- **Gap:** none functionally; copy/voice during redesign (PRODUCT.md:78) must ensure same-gender care reads as the expected default, not as an apologetic exception.

---

## SECTION 2 — Summary table

| # | Item | Status | Tag |
|---|---|---|---|
| 1 | ICO registration & data controller declaration | MISSING | BLOCKS-LAUNCH |
| 2 | Public-facing privacy notice & cookie policy | MISSING | BLOCKS-LAUNCH |
| 3 | Cookie consent (PECR) | PARTIAL (deferred — no analytics yet) | NICE-TO-HAVE today / BLOCKS-LAUNCH when analytics ship |
| 4 | UK GDPR DSAR fulfilment (Art. 15) | PARTIAL (workflow tracker, no automated export) | BLOCKS-LAUNCH |
| 5 | UK GDPR Right to Erasure (Art. 17) | PARTIAL (workflow tracker, no auto-anonymisation) | BLOCKS-LAUNCH |
| 6 | Health data — Art. 9 explicit consent + retention | PARTIAL (consent present; retention policy missing) | BLOCKS-LAUNCH |
| 7 | Equality Act 2010 — WCAG 2.1 AA | PARTIAL (baseline known; fixes scheduled, not shipped) | BLOCKS-LAUNCH |
| 8 | Same-gender care affordance | PRESENT | BLOCKS-LAUNCH (met) |

**Jurisdiction floor pre-launch blockers:** items 1, 2, 4, 5, 6, 7 need work before launch. Item 3 deferred by design until analytics activate. Item 8 met.

**Deliberately not in this section** (operational record-keeping rather than foundation-floor compliance; legal duty falls on the practitioner not on the platform — deferred to `redesign/BUSINESS-COMPLETENESS.md`): CNHC / professional-body credential record-keeping on-platform, per-therapist insurance certificate storage, indemnity tracking.
