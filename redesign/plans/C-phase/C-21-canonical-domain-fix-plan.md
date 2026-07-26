# C-21 — Canonical domain fix — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none — C-21 is fully independent (no dependency markers to check). Soft ordering: C-20 prefers C-21's domain cutover first (Maps-key referrer coverage, D19) — tracked in C-20's plan, no gate here.
> Decisions: C-B-DECISIONS.md — no C-21 entries (doc predates C-21). Refinement decisions D21/D22 applied. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-21-canonical-domain-fix-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-21-canonical-domain-fix-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user (public-pages + small admin cosmetic sweep; same `(public)` divergence note as C-17/C-19/C-20).
   **Update 2026-07-26 (C21-F5):** superseded — single source of truth is `master`; HEAD at or descended from `ea9793223015a523d57163f688e9d78d1c9790c3` (`ea97932`, frontend branch merged; no `(public)` divergence remains). Verify: `git branch --show-current` → `master` and `git merge-base --is-ancestor ea97932 HEAD` → exit 0.
2. Dev server → 200; baseline tests + static gates green.
   **Baseline caveat 2026-07-26 (C21-F6):** "green" = no NEW failures vs the verified baselines — lint has 59 pre-existing errors (55 from untracked `design_handoff_area_pages/prototype/*.jsx`, 4 pre-existing in `src/features/booking/`); vitest 485/491 with 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1); `npx tsc --noEmit` and `pnpm build` clean. Working tree: path-scoped check only (`git status --porcelain -- <paths this plan touches>` returns empty); the wider tree is intentionally dirty — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
3. **User confirmations — both ANSWERED 2026-07-16:**
   - **(a) Live domain = `rahmatherapy.uk`.** Still verify at impl whether the site serves the **apex** or `www.` (whichever the other redirects to) — the canonical must match the post-redirect URL, or canonicals fight the redirect.
   - **(b) Contact email = `rahmatherapy@outlook.com`.** The published `hello@rahmatherapy.co.uk` is **confirmed dead** — no such mailbox. Customers emailing the site's contact address currently reach nobody.
4. **Re-run the reference census** (2026-07-16 counts: 12 × `.co.uk`, 8 × `.com`, 0 × `.uk`; **re-verified 2026-07-26 (C21-F3): 15 × `.co.uk` in 12 files, 8 × `.com` in 5 files, 0 × `.uk`** — the +3 `.co.uk` are the new area pages: `(public)/areas/page.tsx`, `(public)/areas/[slug]/page.tsx`, `components/area-pages/area-json-ld.ts`. Expect these numbers, not the 2026-07-16 ones — the delta is the known area-pages addition, not contamination):
   ```bash
   grep -rno "rahmatherapy\.co\.uk\|rahmatherapy\.uk\|rahmatherapy\.com" src/ public/ | grep -o "rahmatherapy\.[a-z.]*" | sort | uniq -c
   ```
5. **DO-NOT-TOUCH:** `.example`/`.example.test` fixture domains (test data, correct as-is); RECON §5 untouchables.
6. **DO-NOT-TOUCH (live data):** booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns. *(Note: this plan publishes `rahmatherapy@outlook.com` as the site's contact address — that edit is in scope; this rule is about never sending test emails to it or touching live records.)*

---

## 1 — Implementation (4 steps, one commit)

**Step 1 — Introduce the single source.** In `src/content/site/` (alongside `contact.ts`), add:

```ts
// The one place the site's public origin is defined. Everything absolute derives
// from here — metadataBase, JSON-LD url/item values, anywhere else.
// Deliberately a PURE CONSTANT (D21, 2026-07-26): NEXT_PUBLIC_SITE_URL remains the
// separate env contract for email/cron link generation (getSiteUrl() throws
// without it — by design) and is localhost in dev; canonicals must NOT read it.
export const SITE_URL = "https://rahmatherapy.uk";
export const siteUrl = (path = "/") => new URL(path, SITE_URL).toString();
```

**Amended 2026-07-26 (D21, C21-F2):** the original env-first draft (`process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahmatherapy.uk"`) is superseded. The env var is load-bearing TODAY for email/cron: `src/lib/email/client.ts:43-50` `getSiteUrl()` throws `EmailConfigurationError` without it; `src/app/api/cron/booking-reminders/route.ts:69-80` 500s without it; consumers `src/lib/booking/manage-token.ts:15` and `src/app/admin/account-password-requests/actions.ts:187,323`. Dev `.env:21` sets it to `http://localhost:3000/`, so env-first would render localhost canonicals in dev (breaking verification §3.2 by design) and a stale prod env would silently override the corrected domain. Verify: `npx tsc --noEmit` clean; `grep -n "process.env" src/content/site/site-url.ts` → no matches.

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: update the PRODUCTION `NEXT_PUBLIC_SITE_URL` value to `https://rahmatherapy.uk` (post-redirect canonical form per pre-flight #3a) in the production build/deploy environment.
> Exact SQL / change: `NEXT_PUBLIC_SITE_URL=https://rahmatherapy.uk` — set wherever production builds read it (wrangler.jsonc `vars` / CI build env; locate the authoritative source WITH the user at execution — the fact pack does not record where production sets it).
> Post-action verification: production env listing shows the new value; after the next deploy, a `getSiteUrl()`-derived link (e.g. a password-reset email to an owned test account, or a booking-manage link in a test email) carries the `https://rahmatherapy.uk` origin.
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 1a — Align the production env contract (email/cron) — added 2026-07-26 (D21).** Email/cron KEEP the `NEXT_PUBLIC_SITE_URL` contract (throw-by-design; do not weaken the throw and do not remove the var). This step only aligns the production VALUE with `SITE_URL` so email/cron-generated links match the canonical domain. Dev `.env:21` stays `http://localhost:3000/` — expected; after Step 1 it no longer feeds canonicals. Deploy-coupled: may execute after the code commit lands; the code steps do not depend on it.

**Step 2 — Rewire every absolute URL** to derive from it:
- `src/app/layout.tsx:9` → `metadataBase: new URL(SITE_URL)`.
- `src/app/(public)/home/page.tsx:24` (`.com` → correct), `about/page.tsx:21`, `services/page.tsx:23`, `reviews/page.tsx:24,30`, `faqs-aftercare/page.tsx:25` → `siteUrl("/about")` etc. *(Anchors re-verified 2026-07-26, C21-F7: about 24→21, reviews 23,29→24,30; all others exact.)*
- Grep for any remaining absolute-URL composition in `src/` and route it through the helper.
- *Verify (added 2026-07-26, rubric §7):* re-run pre-flight #4's census after Steps 2+2a — the only remaining hits are Step 3's targets (`contact.ts:22-23`, preview route ×2, password-reset pair, admin form placeholders).

**Step 2a — Area pages + `area-json-ld.ts` reconciliation — added 2026-07-26 (C21-F1, D21, D22).** Three NEW `.co.uk` carriers shipped with the area pages (merge `ea97932`) and are absent from Step 2's list:
- `src/app/(public)/areas/page.tsx:19` — `canonical: "https://rahmatherapy.co.uk/areas/"` → `siteUrl("/areas/")`.
- `src/app/(public)/areas/[slug]/page.tsx:29` — canonical template `` `https://rahmatherapy.co.uk/areas/${area.slug}/` `` → `` siteUrl(`/areas/${area.slug}/`) ``.
- `src/components/area-pages/area-json-ld.ts:3` — file-local `const SITE_URL = "https://rahmatherapy.co.uk"` (feeds Service/Breadcrumb JSON-LD url/item values at L10,21,31,32). Delete the local const and IMPORT `SITE_URL`/`siteUrl` from `src/content/site/site-url.ts` — do NOT literal-swap to `.uk`: a second hard-coded constant is exactly the drift mode this plan exists to kill (Step 4's guard asserts against it).
- *Verify:* `grep -rn "rahmatherapy\." "src/components/area-pages/" "src/app/(public)/areas/"` → zero domain literals.

**Step 3 — Contact email + cosmetic sweep.** Two distinct categories — do not conflate them:

**(3a) Clinic contact address → `rahmatherapy@outlook.com`** (confirmed real, 2026-07-16):
- `src/content/site/contact.ts:22-23` — displayed value **and** the `mailto:` href. This is the user-visible defect fix: the current address is dead.
- `src/app/admin/email-templates/preview/[id]/route.ts:54` — `contactEmail` fixture (stands in for the clinic contact line in previews).
- Grep for any other clinic-contact composition and update.
- Note: this address is also the Owner's admin login — harmless overlap; the site simply publishes the address the business actually uses.

**(3b) Per-person staff-email placeholders → neutral examples** (NOT the owner's address — a "type your email" field must not suggest someone else's):
- `LoginForm.tsx:29,114`, `ForgotForm.tsx:29,111`, `NewStaffForm.tsx:60,168`, `SettingsForm.tsx:301` → `you@example.com` / `name@example.com` style.
  *(Correction 2026-07-26, C21-F8: `SettingsForm.tsx:301` is NOT a per-person staff field — it is the business_settings `contact_email` FieldRow (`SettingsForm.tsx:292-304`, helper "Shown to customers as the reply-to address"), i.e. the clinic's own address field, so 3b's "not someone else's email" rationale doesn't apply to it. The action stands — replace the dead-domain placeholder with a neutral `you@example.com`-style example — but as a conscious choice: do NOT pre-fill `rahmatherapy@outlook.com` as placeholder text without Owner sign-off; the field's VALUE is Owner-managed data.)*
- `password-reset/actions.ts:21` masked fallback + its comment in `SubmittedConfirmation.tsx:10` → `f••@example.com`.
- `email-templates/preview/[id]/route.ts:52` (`manageUrl`) → derive from `SITE_URL`.

After 3a + 3b, zero `rahmatherapy.co.uk` / `rahmatherapy.com` literals remain in `src/`. *(Assumes Steps 2 + 2a done first; 2026-07-26 starting census is 15 × `.co.uk` / 8 × `.com` — C21-F3. Verify: re-run pre-flight #4's census → both zero, excluding `.example*` fixtures.)*

**Step 4 — Anti-drift guard.** New test asserting the census is clean:

```ts
// src/content/site/__tests__/canonical-domain.test.ts
// Fails if a wrong-domain literal reappears anywhere in src/ (excluding *.example/.example.test fixtures).
// Reads the source tree and asserts zero matches for /rahmatherapy\.co\.uk|rahmatherapy\.com/.
// Also asserts the clinic contact address is the confirmed live one (rahmatherapy@outlook.com)
// so a future edit can't silently reintroduce a dead mailbox.
```
This is what stops the drift recurring — the defect existed precisely because nothing enforced consistency.

**Extended 2026-07-26 (C21-F9, D22):** the zero-wrong-domain assertion alone cannot catch the drift mode the build just demonstrated — a second hard-coded CORRECT-domain constant (the `area-json-ld.ts:3` pattern). The test must ALSO assert the live-domain literal `https://rahmatherapy.uk` appears in exactly ONE file under `src/`: `src/content/site/site-url.ts`. *Verify:* `pnpm vitest run src/content/site/__tests__/canonical-domain.test.ts` passes; temporarily duplicating the literal in a second file makes it fail.

---

## 2 — Files touched

**NEW (2):** `src/content/site/site-url.ts` (or an addition to an existing site-content module); `src/content/site/__tests__/canonical-domain.test.ts`.
**EDITED (~15, updated 2026-07-26 — C21-F1/C21-F4):** `layout.tsx`; 5 public pages (home/about/services/reviews/faqs); 3 area-page files (`(public)/areas/page.tsx`, `(public)/areas/[slug]/page.tsx`, `components/area-pages/area-json-ld.ts` — Step 2a); `contact.ts` (conditional); 4 admin form files + preview route + password-reset pair (cosmetic).
**UNCHANGED:** everything else. No visual change anywhere — this is metadata only.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (incl. the new guard test), build. *(Baselines 2026-07-26, C21-F6: lint has 59 pre-existing errors — 55 untracked `design_handoff_area_pages/prototype/*.jsx` + 4 in `src/features/booking/`; vitest 485/491 with 6 pre-existing failures in 3 files; tsc + build clean. Gate = no NEW errors/failures vs these baselines.)*
2. **Rendered-output check (the real proof):** `curl -s http://localhost:3000/<page> | grep -i "canonical\|og:url\|application/ld+json"` for all 6 public pages — every absolute URL reads `https://rahmatherapy.uk/...`; no `.co.uk`, no `.com`.
   *(Updated 2026-07-26 — C21-F4/D22: the page list is now 12. Original 6: `/` (308→`/home`), `/home`, `/about`, `/services`, `/reviews`, `/faqs-aftercare`. Area 6: `/areas`, `/areas/bury-park`, `/areas/leagrave`, `/areas/stopsley`, `/areas/dunstable`, `/areas/houghton-regis` (`/areas/luton` 308→`/areas`). Env note (D21/C21-F2): dev `.env:21` sets `NEXT_PUBLIC_SITE_URL=http://localhost:3000/` — expected and harmless; after Step 1 the rendered canonicals/OG/JSON-LD come from the pure-constant module, so this check passes without any env gymnastics. Do not "fix" the dev env value.)*
2b. **Contact-email check:** the public contact surface renders `rahmatherapy@outlook.com` and its `mailto:` href matches (click-through opens a compose window to that address). Staff-email placeholder fields show a neutral example, never the owner's address.
3. **Structured-data validity:** paste each page's JSON-LD into Google's Rich Results Test (or Schema validator) — no errors, URLs correct. *(User-performed external check — an executing agent must not block on it; record it as a pending user action in the progress file.)*
4. **Census clean:** re-run pre-flight #4 → `.co.uk` and `.com` both zero (excluding `.example` fixtures).
5. **No visual regression:** the 6 public pages render identically (spot-check at 1280; metadata-only change). *(Updated 2026-07-26 — C21-F4/D22: 12 pages per §3.2's enumeration, area pages included. Evidence convention (rubric §8): screenshots/captures go to `redesign/evidence/C-21/` — never `redesign/audits/**`.)*
6. **Post-deploy (user actions, recorded in progress file):** verify the property in Google Search Console under `rahmatherapy.uk`; request re-indexing of the homepage; re-scrape social previews if links were previously shared.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Canonical points at the apex while the site serves `www.` (or vice versa) | medium | medium | Pre-flight #3a explicitly confirms which form is served; canonical must match the post-redirect URL. |
| A working contact email gets "corrected" into a dead one | low | high | Resolved 2026-07-16: the CURRENT address is the dead one; `rahmatherapy@outlook.com` is confirmed live. Verify the mailto renders correctly (§3.2b). |
| Owner's address used as a "type your email" placeholder | medium | low | Step 3b keeps the two categories separate — clinic contact vs per-person examples. |
| `NEXT_PUBLIC_SITE_URL` stale/missing in production *(row corrected 2026-07-26 — C21-F2/D21: the env var is NOT "previews only"; it is load-bearing for email/cron — `getSiteUrl()` throws, cron 500s, both by design)* | medium | medium | Step 1's module is a pure constant, so canonicals are immune. Step 1a (HARD-STOP) aligns the prod env value so email/cron links match. Do not remove the var or weaken its throw. |
| Guard test too brittle (fails on legitimate mentions, e.g. docs) | low | low | Scope the assertion to `src/` and exclude `.example*` fixtures. |
| Old domains were indexed and now 404/mismatch | low | low | Out of code scope: if `.co.uk`/`.com` are owned, a registrar-level 301 to `.uk` is the clean move — flagged for the user, not code. |

---

## 5 — Undo

Single git revert. No migration, no data, no user-visible change to undo.

---

## 6 — Commit cadence

One commit: `fix(seo): canonical domain — single source of truth + correct site URL`. (Not a `feat(redesign)` — this is a defect fix, not a plan feature.)

---

## 7 — Hand-off to C-C

1. Get the two pre-flight confirmations (domain form + contact email).
2. Steps 1→4, one commit. *(2026-07-26: now includes Step 1a — prod env HARD-STOP, deploy-coupled, may follow the commit — and Step 2a — area-page reconciliation.)*
3. Verification §3.2 (rendered output) is the proof that matters — grep of source is necessary but not sufficient.
4. Record the post-deploy Search Console actions in the progress file for the user.
5. **Adjacent gap flagged, not scoped:** no `sitemap.ts` / `robots.ts` exists — raise with the user at sign-off as a possible follow-up.

---

*End of C-21 plan.*
