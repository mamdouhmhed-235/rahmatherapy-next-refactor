# C-18 — Cookie consent & PECR compliance (banner + Consent Mode v2 + consent proof)

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase; the declared successor to C-17)
**Predecessors:**
- User direction 2026-07-16: cookie banner + compliance meeting the UK's latest laws; responsive/dynamic at all screen sizes; non-intrusive; designed in the frontend public-pages design language; PLUS nine explicit requirements (block-before-consent, accept/reject parity, no pre-ticks, granular purposes, easy withdrawal, no cookie wall, consent PROOF not preference flags, Consent Mode ordering, accurate future-proofed disclosure).
- **Verified legal research 2026-07-16** (web research, sources cited in §1): DUAA 2025's PECR statistics exception is IN FORCE (5 Feb 2026, SI 2026/82) but stock GA4 almost certainly fails its conditions → **prior opt-in consent remains required for GA4**. ICO final "storage and access technologies" guidance (29 Apr 2026) mandates reject-parity, granularity, easy withdrawal; recommends ~6-month consent lifetime. Consent Mode v2 = four params; only **basic** mode (no gtag load pre-consent) passes a strict no-pre-consent-requests test. Consent proof standard = timestamped who/when/what-was-shown/what-was-chosen records (pseudonymous ID sufficient).
- `redesign/briefs/C-17-google-analytics-brief.md` — C-18 consumes C-17's marked consent insertion point; C-17's `GoogleAnalytics` component becomes the consent-gated loader.
- Code audit 2026-07-16: public design tokens `--rahma-*` (`src/styles/tokens.css`, WCAG-annotated); `SiteFooter.tsx` exists (withdrawal link home); **no privacy or cookie policy page exists anywhere on the public site**.
**Companion files:**
- Plan: `redesign/plans/C-phase/C-18-cookie-consent-plan.md`
- Progress: `redesign/per-page-progress/C-18-cookie-consent-progress.md` (filled during C-C)

---

## 0 — TL;DR

An in-house consent layer (no third-party consent-platform dependency — right-sized for a one-tag site) delivering all nine user requirements against the verified July-2026 legal state:

1. **Registry-driven disclosure** — one `cookie-registry.ts` is the single source for the banner's toggles, the preference panel's per-cookie table, and a new public **/cookies** notice page. Any future tag = registry entry + banner-version bump (which re-prompts everyone). Standing rule added to master-plan Part 0.
2. **Consent Mode v2, basic implementation** — inline head script sets `gtag('consent','default', …all four params denied)` before anything Google; **gtag.js is not injected at all until analytics consent is granted** (C-17's component becomes the gated loader). Regulator test in the gate: private window, Network tab, no clicks → zero requests to Google.
3. **Banner** — non-blocking bottom card in the `--rahma-*` design language; first layer **Accept all / Reject all at exact parity** + equal-weight "Cookie settings"; panel with Essential (always-on, explained) + per-purpose toggles, **off by default**; responsive 375→1440; reduced-motion; full keyboard/focus management; no cookie wall.
4. **Consent proof** — new `consent_events` table (the plan's one Zone-2 migration): timestamp, pseudonymous consent-id, banner version, purposes offered, choice, action. No IP, no PII. First-party consent cookie, **6-month expiry** (ICO-aligned re-prompt).
5. **Withdrawal** — persistent footer "Cookie settings" link reopens the panel; revoking fires `consent update: denied`, **deletes `_ga*` cookies**, reloads for a clean state, and is logged as `withdrawn`.

**Sequencing: with or immediately after C-17.** Zero new packages. One small additive migration.

---

## 1 — Why this plan exists (verified legal state, July 2026)

| Question | Verified answer | Key source |
|---|---|---|
| Is a banner still required for GA4? | **Yes.** DUAA Schedule 12 / PECR Schedule A1 para 5 (statistics exception, in force 5 Feb 2026) requires sole-purpose aggregate statistics, no sharing beyond improvement-assistance, clear info + objection means. Stock GA4 fails: Google's own use of data + per-user `_ga` client IDs. No formal ICO ruling on GA4 specifically — consensus expert reading; recorded caveat. | legislation.gov.uk (DUAA Sch 12; SI 2026/82); Hunton, Covington, ZwillGen summaries of ICO final guidance (Apr–May 2026) |
| Reject-all parity | ICO final guidance (29 Apr 2026) mandates refusal as easy as acceptance on the first layer; 2023 Bonner statements + 2025 top-1,000 sweep show active enforcement; DUAA uplifted PECR penalties to £17.5m/4%. | ICO strategy + guidance; Pinsent Masons; Arnold & Porter |
| Pre-ticked boxes | Invalid — affirmative act required; Planet49 assimilated case law. | ICO valid-consent guidance |
| Consent proof | Who (pseudonymous ID suffices) / when / what was shown (versioned) / what was chosen / withdrawals — retained while relied upon. Plus a cookie audit. | ICO "How should we obtain, record and manage consent?" |
| Consent Mode v2 | Params: `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`. Default-denied must execute before the Google tag; update on interaction. **Basic** mode = no Google requests pre-consent; **advanced** sends cookieless pings pre-consent → fails the user's requirement 1. Basic locked. | developers.google.com consent guide |
| Consent lifetime | ICO recommends ~6 months to seek fresh consent. Locked: 6-month cookie expiry. | ICO storage-and-access guidance |

Full research record with URLs preserved in the plan-refinement session log (2026-07-16); the table above is the operative summary.

---

## 2 — Scope

### 2.1 `cookie-registry.ts` — the single source (user req 9)

```ts
export const CONSENT_BANNER_VERSION = "2026-07-16.1"; // bump = re-prompt everyone

export type CookiePurpose = "essential" | "analytics"; // extensible: "marketing" etc.

export interface CookieRegistryEntry {
  name: string;          // "_ga", "_ga_*", "rahma_consent", …
  provider: string;      // "Google", "Rahma Therapy"
  purpose: CookiePurpose;
  duration: string;      // "13 months", "6 months", "session"
  description: string;   // plain-English, shown verbatim in panel + /cookies page
}

export const COOKIE_REGISTRY: CookieRegistryEntry[] = [ /* filled from the Phase A inventory */ ];
```

- Drives: banner panel toggle list (one toggle per non-essential purpose present in the registry), the panel's disclosure table, and the /cookies page. **Impossible for the three surfaces to drift.**
- Initial contents from the Phase A cookie inventory: `rahma_consent` (essential), GA4's `_ga` + `_ga_*` (analytics), any Supabase cookies anonymous visitors actually receive (expected: none on public — verified), booking-draft sessionStorage (disclosed as strictly necessary storage, not a cookie).
- **Standing rule (master-plan Part 0, lands with this amendment):** any new third-party tag or cookie ships with a registry entry + `CONSENT_BANNER_VERSION` bump, and loads through the consent gate. No exceptions.

### 2.2 Consent state + Consent Mode ordering (user reqs 1, 8)

- **First-party consent cookie `rahma_consent`** (not localStorage — SSR-readable, natural expiry): JSON `{ v: bannerVersion, id: <uuid>, choices: { analytics: boolean }, ts }`; `Max-Age` 6 months; `SameSite=Lax; Secure; Path=/`. Absent / expired / version-mismatch → banner shows.
- **Inline head script** (tiny, first-party, `beforeInteractive`) on customer layouts: initialises `dataLayer` and fires `gtag('consent','default',{ ad_storage:'denied', analytics_storage:'denied', ad_user_data:'denied', ad_personalization:'denied' })` — plus `analytics_storage:'granted'` restore when a valid stored consent grants it. Executes before any Google code by construction (no Google code exists on the page until the gated loader injects it).
- **Gated loader (C-17 amendment):** `GoogleAnalytics` renders the gtag `Script`s ONLY when current consent grants analytics. Grant flow: write cookie → `gtag('consent','update',{ analytics_storage:'granted' })` → mount the script (dataLayer queueing makes the order safe). Reject flow: write cookie, never mount. **Basic Consent Mode** — pre-consent, zero requests to any Google host.

### 2.3 Banner + preferences panel (user reqs 2, 3, 4, 6 + design constraints)

- **First layer** (bottom-anchored card; column at 375, inline bar ≥768): one short sentence + three controls — **[Accept all] [Reject all]** rendered from the SAME button component, identical size/contrast/position-weight, one click each; **[Cookie settings]** equal-weight text button opening the panel. No colour-coded nudging (both action buttons same style — `--rahma-green` outline or fill pair chosen at impl with contrast verified on ivory).
- **No cookie wall:** banner never blocks scrolling/interaction; content remains fully usable; no overlay dimming the page.
- **Preferences panel** (dialog, focus-trapped, ESC-closable, labelled): Essential row (always on, disabled toggle, explained), Analytics row (**toggle off by default**, description + expandable per-cookie table from the registry), [Save choices] + [Accept all] + [Reject all]. Granularity is per-purpose; adding a future purpose to the registry adds a toggle automatically.
- **Design language:** `--rahma-*` tokens exclusively (ivory surface, charcoal text, the AA-verified blue for actions, `--rahma-border`); matches public typography/radius; subtle entrance honouring `prefers-reduced-motion`; `min-h-11` touch targets; no layout shift (fixed-position, safe-area-inset padding at 375).
- **Copy:** plain-English, no dark patterns; links to the /cookies notice page.

### 2.4 Consent proof (user req 7)

- **New table `consent_events`** (Zone-2 migration — the plan's only one):
  ```sql
  CREATE TABLE consent_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    consent_id uuid NOT NULL,          -- pseudonymous; also stored in rahma_consent
    banner_version text NOT NULL,      -- which banner wording/options were shown
    purposes_offered jsonb NOT NULL,   -- snapshot of the offered purpose set
    choices jsonb NOT NULL,            -- what was chosen
    action text NOT NULL CHECK (action IN ('granted','rejected','updated','withdrawn'))
  );
  -- RLS enabled; no anon/authenticated policies (service-role writes only via the API route).
  ```
  No IP, no user agent, no PII — the ICO standard (who-as-identifier/when/what-shown/what-chosen) with data minimisation.
- **`POST /api/consent-events`** route: zod-validates shape + known banner_version + payload size cap, inserts via admin client, always returns 204 (fire-and-forget from the client; consent UX never blocks on logging; failures console-logged).
- Every banner interaction logs: first choice (`granted`/`rejected`), panel saves (`updated`), withdrawals (`withdrawn`). Re-prompts after expiry/version-bump log as fresh events under a new consent_id if the old cookie is gone.
- Retention note in the /cookies page + plan: kept while consent is relied upon; a periodic prune is a C-12+ item.

### 2.5 Withdrawal (user req 5)

- Persistent **"Cookie settings"** link in `SiteFooter.tsx` (every public page) reopens the panel pre-filled with current choices.
- Turning analytics off: rewrite cookie → `gtag('consent','update',{ analytics_storage:'denied' })` → **delete `_ga` and `_ga_*` cookies** (document the domain/path nuance in the plan) → log `withdrawn` → **reload the page** so no already-loaded gtag code lingers (simple, honest, complete stop — user req 5's "revoking must actually stop the scripts").

### 2.6 /cookies notice page (user req 9)

New `(public)/cookies/page.tsx`: what cookies/storage we use (rendered from the registry — always accurate), why, durations, how to change your mind (button opening the panel), the consent-record explanation, last-updated = banner version date. Linked from the banner, the panel, and the footer.

**Flagged, not scoped (user decision 2026-07-16):** the site has NO privacy policy page — a separate UK GDPR (Art 13) gap bigger than cookies, for a clinic collecting booking PII. Recorded as the recommended next compliance item; C-18 stays cookie-scoped.

---

## 3 — RBAC / privacy posture

- Entirely public-surface; no admin UI. Admin pages get no banner (no non-essential tags there — C-17 keeps GA off admin; the consent head-script mounts on customer layouts only).
- `consent_events`: service-role-only writes via the API route; no public read path; contains no PII by design.
- The consent cookie is itself essential (exempt from consent; disclosed in the registry).

---

## 4 — States & edge cases

- **4.1 First visit:** default-denied fires; banner shows; nothing Google loads. Clicking nothing ever = permanent denied state; banner re-shows next visit (no consent stored) — compliant (silence ≠ consent).
- **4.2 Returning granted visitor:** head script restores granted from the cookie; gated loader mounts gtag; no banner.
- **4.3 Returning rejected visitor:** no banner until expiry/version bump (respect the "no" — do not nag); footer link always available to change.
- **4.4 Expiry (6 months) or version bump:** treated as no-consent → banner re-shows; old grant is not honoured.
- **4.5 Ad-blocker + granted:** gtag fails to load; site unaffected (C-17's optional-chaining posture).
- **4.6 JS disabled:** no banner, but also no gtag (it's JS) — vacuously compliant; /cookies page is server-rendered and reachable.
- **4.7 Logging endpoint down:** consent UX proceeds; event lost + console-logged; cookie remains the operative preference. Accepted (availability over blocking consent).
- **4.8 Multi-tab:** cookie is shared; a grant in tab A is seen by tab B on next navigation; no cross-tab sync needed (accepted).
- **4.9 Booking-flow interplay:** banner must not obscure the booking dialog's primary actions at 375 — verified in the gate; the flow's sessionStorage draft is essential storage, unaffected by choices.
- **4.10 C-17 deployed before C-18** (if sequenced apart): plain GA collects without consent in the interim — the user's earlier accepted gap, now superseded: **co-ship recommended**, and if C-17 somehow ships alone, C-18 is the immediate next deploy.

---

## 5 — Migration footprint

**One additive Zone-2 migration:** `consent_events` table + RLS (no policies = deny-all client access). Nothing dropped, nothing altered. Rollback = drop table (loses consent history — re-collect by version-bumping the banner).

---

## 6 — Files touched (preview — full list in plan)

### NEW (~9)
- `src/lib/consent/cookie-registry.ts` — registry + banner version (single source)
- `src/lib/consent/consent-state.ts` — cookie read/write/expiry/version helpers (+ test)
- `src/components/consent/ConsentScripts.tsx` — inline head default-denied (+ restore) script
- `src/components/consent/CookieBanner.tsx` — first layer + preferences panel
- `src/app/(public)/cookies/page.tsx` — notice page (registry-rendered)
- `src/app/api/consent-events/route.ts` — proof logging endpoint
- `supabase/migrations/<ts>_c18_consent_events.sql`
- Tests: consent-state, banner behaviour (parity/no-pretick/focus), route validation

### EDITED (~4)
- `src/components/GoogleAnalytics.tsx` — becomes the consent-gated loader (C-17 amendment)
- `src/app/(public)/layout.tsx` + `src/app/booking/layout.tsx` — mount ConsentScripts + CookieBanner alongside the loader
- `src/components/layout/SiteFooter.tsx` — persistent "Cookie settings" link

### UNCHANGED (do NOT touch)
- Admin tree, root layout, middleware, RECON §5 untouchables.

---

## 7 — Sequencing and dependencies

- **With or immediately after C-17** (hard pairing — C-18 rewrites C-17's component; co-implementation in one C-C window is the recommended path; the pair is independent of all other plans, like C-14).
- Same branch note as C-17 (public layouts diverge ~9 lines from the frontend line; confirm target with the user).
- Bundle: banner + panel ~4-5 kB on public pages (client component, lazy-loadable if measured heavy). **Ceiling: +5 kB public bundles.**

---

## 8 — Open questions

**Q8.1 — Accept/Reject visual pairing:** identical-fill vs identical-outline pair — impl-time choice; parity (size/contrast/position/click-count) is the invariant, verified by screenshot + computed-style check.
**Q8.2 — Banner version string format:** date + counter (`2026-07-16.1`) locked; bump policy documented in the registry header comment.
**Q8.3 — Consent-events pruning cadence:** C-12+ (retention note shipped in copy).
**Q8.4 — GA4-specific ICO ruling risk:** if the ICO later blesses GA4 under the DUAA statistics exception, the banner becomes stricter than required — harmless; revisit then.

---

## 9 — Acceptance criteria (what "done" looks like)

1. **The regulator test:** private window, DevTools Network, load any public page, click nothing → **zero requests to any Google host**. Repeat after Reject all → still zero, including after navigation.
2. Accept all → gtag loads, `consent update granted` precedes/queues correctly, page_views flow; consent cookie set with 6-month expiry; `granted` row in `consent_events` with banner version + purposes + choice.
3. First layer shows Accept all / Reject all at parity (same component, same size/contrast/position, one click each) — screenshot + computed-style evidence at 375/768/1280/1440.
4. Preferences panel: analytics toggle off by default; Essential explained + locked; per-cookie table matches the registry exactly.
5. Footer "Cookie settings" on every public page reopens the panel; withdrawal deletes `_ga*` cookies (verified in DevTools), fires denied update, logs `withdrawn`, reloads clean.
6. No cookie wall: full site usable with the banner up; no scroll-lock, no overlay.
7. Version bump re-prompts a previously-granted browser; 6-month `Max-Age` attribute verified.
8. /cookies page renders the registry, is linked from banner/panel/footer, and is accurate to the Phase A inventory.
9. Banner honours reduced-motion; panel is focus-trapped + keyboard-complete; WCAG AA contrast on ivory verified.
10. Booking flow at 375 unobstructed with the banner visible.
11. Migration applied + verified; RLS deny-all confirmed (anon select/insert direct to the table fails; the route succeeds).
12. Static gates pass; +5 kB ceiling; no new packages.

---

## 10 — Out of scope (explicit non-goals)

- **Privacy policy page** — flagged as the recommended next compliance item (user decision pending); C-18 is cookie-scoped.
- Third-party consent-management platforms (Cookiebot etc.) — in-house locked.
- Marketing/personalisation purposes — registry-ready, but no such tags exist; toggles appear only when a purpose exists.
- "Consent or pay", geo-conditional banners, admin-side consent surfaces.
- Consent-events admin viewer/pruning — C-12+.
- Switching to an aggregate-only analytics tool to use the DUAA opt-out exception — noted as a future alternative (research finding), not pursued while GA4 is the chosen tool.

---

*End of C-18 brief. Plan file follows: `redesign/plans/C-phase/C-18-cookie-consent-plan.md`.*
