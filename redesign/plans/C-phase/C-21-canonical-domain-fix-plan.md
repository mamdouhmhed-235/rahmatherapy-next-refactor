# C-21 — Canonical domain fix — **PLAN**

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-21-canonical-domain-fix-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-21-canonical-domain-fix-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user (public-pages + small admin cosmetic sweep; same `(public)` divergence note as C-17/C-19/C-20).
2. Dev server → 200; baseline tests + static gates green.
3. **User confirmations — both ANSWERED 2026-07-16:**
   - **(a) Live domain = `rahmatherapy.uk`.** Still verify at impl whether the site serves the **apex** or `www.` (whichever the other redirects to) — the canonical must match the post-redirect URL, or canonicals fight the redirect.
   - **(b) Contact email = `rahmatherapy@outlook.com`.** The published `hello@rahmatherapy.co.uk` is **confirmed dead** — no such mailbox. Customers emailing the site's contact address currently reach nobody.
4. **Re-run the reference census** (2026-07-16 counts: 12 × `.co.uk`, 8 × `.com`, 0 × `.uk`):
   ```bash
   grep -rno "rahmatherapy\.co\.uk\|rahmatherapy\.uk\|rahmatherapy\.com" src/ public/ | grep -o "rahmatherapy\.[a-z.]*" | sort | uniq -c
   ```
5. **DO-NOT-TOUCH:** `.example`/`.example.test` fixture domains (test data, correct as-is); RECON §5 untouchables.

---

## 1 — Implementation (4 steps, one commit)

**Step 1 — Introduce the single source.** In `src/content/site/` (alongside `contact.ts`), add:

```ts
// The one place the site's public origin is defined. Everything absolute derives
// from here — metadataBase, JSON-LD url/item values, anywhere else.
// Override per-environment with NEXT_PUBLIC_SITE_URL if ever needed (previews).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahmatherapy.uk";
export const siteUrl = (path = "/") => new URL(path, SITE_URL).toString();
```

**Step 2 — Rewire every absolute URL** to derive from it:
- `src/app/layout.tsx:9` → `metadataBase: new URL(SITE_URL)`.
- `src/app/(public)/home/page.tsx:24` (`.com` → correct), `about/page.tsx:24`, `services/page.tsx:23`, `reviews/page.tsx:23,29`, `faqs-aftercare/page.tsx:25` → `siteUrl("/about")` etc.
- Grep for any remaining absolute-URL composition in `src/` and route it through the helper.

**Step 3 — Contact email + cosmetic sweep.** Two distinct categories — do not conflate them:

**(3a) Clinic contact address → `rahmatherapy@outlook.com`** (confirmed real, 2026-07-16):
- `src/content/site/contact.ts:22-23` — displayed value **and** the `mailto:` href. This is the user-visible defect fix: the current address is dead.
- `src/app/admin/email-templates/preview/[id]/route.ts:54` — `contactEmail` fixture (stands in for the clinic contact line in previews).
- Grep for any other clinic-contact composition and update.
- Note: this address is also the Owner's admin login — harmless overlap; the site simply publishes the address the business actually uses.

**(3b) Per-person staff-email placeholders → neutral examples** (NOT the owner's address — a "type your email" field must not suggest someone else's):
- `LoginForm.tsx:29,114`, `ForgotForm.tsx:29,111`, `NewStaffForm.tsx:60,168`, `SettingsForm.tsx:301` → `you@example.com` / `name@example.com` style.
- `password-reset/actions.ts:21` masked fallback + its comment in `SubmittedConfirmation.tsx:10` → `f••@example.com`.
- `email-templates/preview/[id]/route.ts:52` (`manageUrl`) → derive from `SITE_URL`.

After 3a + 3b, zero `rahmatherapy.co.uk` / `rahmatherapy.com` literals remain in `src/`.

**Step 4 — Anti-drift guard.** New test asserting the census is clean:

```ts
// src/content/site/__tests__/canonical-domain.test.ts
// Fails if a wrong-domain literal reappears anywhere in src/ (excluding *.example/.example.test fixtures).
// Reads the source tree and asserts zero matches for /rahmatherapy\.co\.uk|rahmatherapy\.com/.
// Also asserts the clinic contact address is the confirmed live one (rahmatherapy@outlook.com)
// so a future edit can't silently reintroduce a dead mailbox.
```
This is what stops the drift recurring — the defect existed precisely because nothing enforced consistency.

---

## 2 — Files touched

**NEW (2):** `src/content/site/site-url.ts` (or an addition to an existing site-content module); `src/content/site/__tests__/canonical-domain.test.ts`.
**EDITED (~12):** `layout.tsx`; 5 public pages (home/about/services/reviews/faqs); `contact.ts` (conditional); 4 admin form files + preview route + password-reset pair (cosmetic).
**UNCHANGED:** everything else. No visual change anywhere — this is metadata only.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (incl. the new guard test), build.
2. **Rendered-output check (the real proof):** `curl -s http://localhost:3000/<page> | grep -i "canonical\|og:url\|application/ld+json"` for all 6 public pages — every absolute URL reads `https://rahmatherapy.uk/...`; no `.co.uk`, no `.com`.
2b. **Contact-email check:** the public contact surface renders `rahmatherapy@outlook.com` and its `mailto:` href matches (click-through opens a compose window to that address). Staff-email placeholder fields show a neutral example, never the owner's address.
3. **Structured-data validity:** paste each page's JSON-LD into Google's Rich Results Test (or Schema validator) — no errors, URLs correct.
4. **Census clean:** re-run pre-flight #4 → `.co.uk` and `.com` both zero (excluding `.example` fixtures).
5. **No visual regression:** the 6 public pages render identically (spot-check at 1280; metadata-only change).
6. **Post-deploy (user actions, recorded in progress file):** verify the property in Google Search Console under `rahmatherapy.uk`; request re-indexing of the homepage; re-scrape social previews if links were previously shared.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Canonical points at the apex while the site serves `www.` (or vice versa) | medium | medium | Pre-flight #3a explicitly confirms which form is served; canonical must match the post-redirect URL. |
| A working contact email gets "corrected" into a dead one | low | high | Resolved 2026-07-16: the CURRENT address is the dead one; `rahmatherapy@outlook.com` is confirmed live. Verify the mailto renders correctly (§3.2b). |
| Owner's address used as a "type your email" placeholder | medium | low | Step 3b keeps the two categories separate — clinic contact vs per-person examples. |
| `NEXT_PUBLIC_SITE_URL` unset in production → default used | low | none | The default IS production; the env var exists only for previews. |
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
2. Steps 1→4, one commit.
3. Verification §3.2 (rendered output) is the proof that matters — grep of source is necessary but not sufficient.
4. Record the post-deploy Search Console actions in the progress file for the user.
5. **Adjacent gap flagged, not scoped:** no `sitemap.ts` / `robots.ts` exists — raise with the user at sign-off as a possible follow-up.

---

*End of C-21 plan.*
