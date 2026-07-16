# C-18 — Cookie consent & PECR compliance — **PLAN**

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase; successor to C-17)
**Brief:** `redesign/briefs/C-18-cookie-consent-brief.md` (companion — read first; §1 carries the verified legal state)
**Progress (filled in C-C):** `redesign/per-page-progress/C-18-cookie-consent-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch decision with the user** (same note as C-17 — public layouts diverge ~9 lines from the frontend line). **Co-implementation with C-17 in one window is the recommended path** — confirm.
2. Dev server → 200; baseline tests + static gates green.
3. **C-17 landing state:** `grep -rn "GoogleAnalytics" src/` — if C-17 is implemented, its component gets rewritten (Step 8); if not, implement C-17 Phase A directly in the gated form (skip the plain-GA intermediate entirely).
4. **Cookie inventory (feeds the registry — brief §2.1):** in a private window against the dev server AND the production site, record every cookie + storage key an anonymous visitor receives on: home, a service page, the booking flow (through to the review step), /booking/manage with a token. Expected: no Supabase auth cookies for anonymous visitors (verify — if any appear, classify + registry them), booking-draft sessionStorage, and (post-C-17) `_ga`/`_ga_*`. Record results in the progress file.
5. **Consent-events table absence:** `SELECT to_regclass('public.consent_events');` → null expected.
6. **Design tokens:** confirm `--rahma-*` set in `src/styles/tokens.css` unchanged; `SiteFooter.tsx` structure for the settings-link insertion.
7. **Legal state re-check (cheap):** confirm no ICO GA4-specific ruling has landed since 2026-07-16 (one web search) — if the DUAA statistics exception has been formally extended to GA4-class tools, surface to the user before building (brief Q8.4).
8. **DO-NOT-TOUCH:** admin tree, root layout, middleware, RECON §5 untouchables.

---

## 1 — Safe implementation order (7 phases)

### Phase A — Registry + notice page (pure content, no behaviour)

**Step 1 — `src/lib/consent/cookie-registry.ts`** per brief §2.1: types, `CONSENT_BANNER_VERSION = "2026-07-16.1"`, entries from the pre-flight #4 inventory. Registry completeness test: every inventoried cookie/storage item has an entry; no entry lacks name/purpose/duration/description.

**Step 2 — `/cookies` notice page** (`src/app/(public)/cookies/page.tsx`): server component rendering the registry (grouped by purpose), plain-English intro, consent-record explanation, retention note, "Change your choices" button (opens the panel via a query param or client island), last-updated from the version constant. Public design language; add to the sitemap if one exists.

### Phase B — Consent state + Consent Mode ordering

**Step 3 — `src/lib/consent/consent-state.ts`.**

```ts
export interface ConsentState {
  v: string;                       // banner version at time of choice
  id: string;                      // pseudonymous uuid (crypto.randomUUID())
  choices: { analytics: boolean }; // keyed by CookiePurpose minus "essential"
  ts: string;                      // ISO timestamp of the choice
}
export const CONSENT_COOKIE = "rahma_consent";
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 182; // ~6 months (ICO-aligned)

// readConsent(cookieString): ConsentState | null  — null on absent/malformed/
//   version-mismatch (v !== CONSENT_BANNER_VERSION). Expiry rides the cookie Max-Age.
// writeConsent(choices): sets the cookie (SameSite=Lax; Secure; Path=/; Max-Age)
//   preserving id if a prior cookie exists, else minting one.
// clearGaCookies(): deletes _ga and every _ga_* cookie (Path=/, current domain and
//   leading-dot domain variants — document the matrix in a comment).
```

Unit tests: round-trip, malformed JSON → null, version mismatch → null, id preservation, `clearGaCookies` name matching.

**Step 4 — `ConsentScripts.tsx`** (server component, inline `<Script id="consent-default" strategy="beforeInteractive">`): initialises `dataLayer`/`gtag` stub and fires `gtag('consent','default',{ ad_storage:'denied', analytics_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', wait_for_update: 500 })`; then, if the (server-read) consent cookie grants analytics, immediately fires `gtag('consent','update',{ analytics_storage:'granted' })`. First-party inline only — zero external requests. Mount FIRST in `(public)/layout.tsx` + `booking/layout.tsx` so it precedes everything (the gated loader is the only Google-code source, so ordering holds by construction — brief §2.2).

### Phase C — Banner + preferences panel

**Step 5 — `CookieBanner.tsx`** (client): reads consent via a tiny provider/hook; renders nothing when a valid current-version consent exists. First layer per brief §2.3 — the parity invariant implemented by rendering Accept-all and Reject-all from the SAME styled component with only the label differing (parity by construction). Bottom-fixed, safe-area-inset padding, no scroll-lock, no overlay. `rahma-*` tokens; reduced-motion-safe entrance.

**Step 6 — Preferences panel** (within the same component tree): accessible dialog (focus trap, `aria-modal`, ESC, labelled heading), Essential locked row, per-purpose toggles **off by default** (rendered from the registry's non-essential purposes), expandable per-cookie table, [Save choices]/[Accept all]/[Reject all]. Openable from: banner, footer link, /cookies page button (`?cookie-settings=1` param or a custom event — implementer picks; both documented).

**Step 7 — Interaction wiring.** Accept-all → `writeConsent({analytics:true})` → `gtag('consent','update',{analytics_storage:'granted'})` → notify the gated loader (state/context) → log `granted`. Reject-all → `writeConsent({analytics:false})` → log `rejected`. Panel save → same with `updated`. Withdrawal path (was granted, now denied): update-denied → `clearGaCookies()` → log `withdrawn` → `location.reload()` (brief §2.5). Behaviour tests: parity render, no-pretick default, focus trap, choice→cookie→callback sequences.

### Phase D — Gated GA loader (the C-17 amendment)

**Step 8 — Rewrite `GoogleAnalytics.tsx`** into the consent-gated loader: renders the two gtag Scripts only when (a) env-gated production check passes (C-17 semantics preserved) AND (b) current consent grants analytics — via the provider so an in-session grant mounts it without navigation. The C-17 insertion-point comment is consumed here. C-17's gating tests extend: consent-denied → null even in production with env set.

### Phase E — Consent proof

**Step 9 — Migration (Zone-2 — explicit user confirmation):** `consent_events` per brief §2.4 SQL + `ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;` (no policies — deny-all client access; service-role writes only). Apply via `mcp__supabase__apply_migration`; `generate_typescript_types` after; verify: table exists, RLS on, anon insert/select fail.

**Step 10 — `POST /api/consent-events`:** zod schema `{ consent_id: uuid, banner_version: known-version literal, purposes_offered, choices, action: enum }`, body-size cap, admin-client insert, always 204 (fire-and-forget; failures console-logged). Route test: valid insert, bad shape 400-or-silent-204 per chosen posture (locked: 204 always externally, validation failures logged + dropped — no oracle for probing), unknown banner_version dropped.

**Step 11 — Client logging calls** from Step 7's wiring (navigator.sendBeacon preferred, fetch fallback) — consent UX never awaits the log.

### Phase F — Withdrawal surface

**Step 12 — `SiteFooter.tsx`:** persistent "Cookie settings" link (same footer style; present on every public page) opening the panel pre-filled. Verify /booking/manage also exposes a path (its layout mounts the banner component; footer presence verified — if that page lacks the SiteFooter, add the link to its page shell).

### Phase G — Verification (gate below) + bookkeeping

**Step 13 — Full gate run + evidence + progress file + master-plan row flip.**

---

## 2 — Files touched (final list)

### NEW (~10)
| File | Purpose |
|---|---|
| `src/lib/consent/cookie-registry.ts` | Single-source registry + banner version |
| `src/lib/consent/consent-state.ts` (+ test) | Cookie read/write/expiry/version + GA-cookie clearing |
| `src/components/consent/ConsentScripts.tsx` | Inline default-denied (+ restore) head script |
| `src/components/consent/CookieBanner.tsx` (+ behaviour tests) | First layer + preferences panel + provider |
| `src/app/(public)/cookies/page.tsx` | Registry-rendered notice page |
| `src/app/api/consent-events/route.ts` (+ test) | Proof logging endpoint |
| `supabase/migrations/<ts>_c18_consent_events.sql` | The one migration |
| `src/lib/consent/__tests__/registry-completeness.test.ts` | Inventory ↔ registry parity |

### EDITED (~4)
| File | Change |
|---|---|
| `src/components/GoogleAnalytics.tsx` | → consent-gated loader (C-17 amendment; env semantics preserved) |
| `src/app/(public)/layout.tsx` | + ConsentScripts (first) + CookieBanner mounts |
| `src/app/booking/layout.tsx` | same |
| `src/components/layout/SiteFooter.tsx` | + persistent "Cookie settings" link |

### UNCHANGED (do NOT touch)
Admin tree, root layout, middleware, build configs, RECON §5 untouchables.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (all new specs), build, bundle (+5 kB public ceiling). No new packages.
2. **The regulator test (acceptance #1):** production build, private window, DevTools Network filtered to `google` — load home, navigate two pages, open the booking dialog, click nothing → **zero Google requests**. Repeat after Reject-all → still zero. Evidence: HAR/screenshot.
3. **Grant path:** Accept-all → gtag loads; GA DebugView shows consent-granted page_view; cookie attributes verified (Max-Age ≈ 182 days, SameSite=Lax, Secure); `consent_events` row (`granted`) with version/purposes/choices via SQL.
4. **Withdrawal:** grant → withdraw via footer link → `_ga*` cookies gone (DevTools), `withdrawn` row logged, page reloaded, post-reload Network shows zero Google requests.
5. **Parity + no-pretick evidence:** screenshots 375/768/1280/1440 + computed-style equality assertion (size/font/contrast) on the two first-layer buttons; panel default state screenshot.
6. **Version bump re-prompt:** flip `CONSENT_BANNER_VERSION` locally → previously-granted browser re-prompts; restore constant.
7. **A11y:** panel focus trap + keyboard-complete + ESC; axe pass on banner/panel/cookies page; reduced-motion honoured.
8. **No-wall + booking interplay:** scroll/interact with banner up; 375 booking-dialog primary actions unobstructed (screenshot).
9. **RLS:** direct anon insert/select against `consent_events` fails; route insert succeeds.
10. **Registry accuracy:** pre-flight #4 inventory ↔ registry ↔ /cookies page ↔ panel table all agree (the completeness test + manual check).

Evidence stored in `redesign/audits/C-A/screenshots-c-18/`.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Some path loads gtag pre-consent (regression of req 1) | low | high | Single-source rule: the gated loader is the ONLY component referencing googletagmanager; gate item 2 is a hard check; standing registry rule covers future tags. |
| Consent default fires after a Google request (ordering, req 8) | low | high | No Google code exists on the page except via the gated loader, which mounts only post-grant — ordering holds by construction, not by race. |
| Banner nudging accusations (parity drift at some viewport) | low | medium | Same-component rendering + computed-style assertion at 4 viewports. |
| `_ga` cookie deletion misses a domain/path variant | medium | low | `clearGaCookies` handles host + dot-domain variants; gate item 4 verifies empirically on production domain. |
| Logging endpoint abused (spam inserts) | low | low | Schema + known-version + size validation, 204-always (no probe oracle), service-role-only table; volume is trivially low-value — accepted residual. |
| Consent cookie blocked (user blocks all cookies) | low | low | Banner re-shows each visit; gtag never loads (no stored grant) — fail-closed and compliant. |
| Banner obscures booking dialog at 375 | medium | low | Gate item 8; banner z-index below dialog + bottom-safe-area layout. |
| ICO later blesses GA4 under the DUAA exception | low | none | Banner becomes stricter than required — harmless (brief Q8.4). |
| C-17 ships alone first (interim non-consented collection) | low | medium | Co-ship recommended in both plans; if it happens, C-18 is the immediate next deploy and the gap is a recorded user decision. |

---

## 5 — Undo procedure

Code: git revert per phase (reverting Phase D restores C-17's plain loader — only do so if also reverting C-17 or accepting non-consented collection knowingly). Migration undo: `DROP TABLE IF EXISTS consent_events;` — loses consent history; if C-18 remains live, do NOT drop (the proof obligation stands while consent is relied upon).

---

## 6 — Test fixture guidance

All verification is self-generated (the tester's own browser choices) — no customer data involved anywhere. `consent_events` test rows are identifiable by the dev-session banner versions; prune with user confirmation post-verification. Badar's `9d55ce2a` + real client rows untouched (no interaction surface exists).

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — registry + /cookies page + completeness test |
| 2 | Phase B — consent-state helpers + ConsentScripts + tests |
| 3 | Phase C — banner + panel + wiring + behaviour tests |
| 4 | Phase D — gated GoogleAnalytics rewrite (C-17 amendment) |
| 5 | Phase E — migration applied (`chore(supabase): C-18 migration applied {name}`) + route + logging |
| 6 | Phase F — footer link + /booking/manage path |
| 7 | Verification — evidence + progress file + master plan checklist → ✅ |

`feat(redesign): C-18 {phase}` prefixes.

---

## 8 — Hand-off to C-C

1. Read brief (§1 legal table) + plan; run pre-flight — esp. #4 cookie inventory (feeds everything), #7 legal re-check, and the C-17 co-implementation decision (#3).
2. Phases strictly A→G; the migration (Step 9) is the only Zone-2 action — show SQL, await user confirmation.
3. The regulator test (gate #2) is the plan's identity — do not sign off without its evidence.
4. Final commit flips the master-plan C-18 row → ✅.
5. **Successor flag:** the missing privacy policy page (UK GDPR Art 13) is the recommended next compliance item — surface it to the user at C-18 sign-off.

---

*End of C-18 plan. Brief: `redesign/briefs/C-18-cookie-consent-brief.md`. Progress: `redesign/per-page-progress/C-18-cookie-consent-progress.md` (filled during C-C).*
