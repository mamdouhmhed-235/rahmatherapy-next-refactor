# Item 2 — Blast-radius re-verification (LIVE)

Repo: `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`
Method: every claim run live today against the working tree, not assumed from prior evidence docs. Tool used: the Grep tool (ripgrep-backed) and Glob tool unless noted; PowerShell/Bash `find` used only to confirm directory contents where grep returned zero matches (to rule out "empty directory" false negatives).

---

## Claim 1 — "Grep '7 year|seven year|12 month|twelve month' (case-insensitive) over src/ returns matches ONLY at privacy/page.tsx lines 168 and 170"

**Command:** `Grep pattern="7 year|seven year|12 month|twelve month" path=src -i -n`

**Actual output:**
```
src\app\(public)\privacy\page.tsx:168:              Our policy is to keep booking and treatment records for 7 years after your last
src\app\(public)\privacy\page.tsx:170:              keep it for around 12 months. Analytics information, where you&apos;ve given
```

**Verdict: CONFIRMED.** Exactly two matches, both in `src/app/(public)/privacy/page.tsx`, at lines 168 and 170 exactly as claimed. No other file in `src/` matches.

---

## Claim 2 — footer.ts `legalLinks: []`, SiteFooter maps it, live footer has zero legal links; check for ANY `/privacy` link anywhere (nav, footer, cookie banner, consent dialog, booking flow, emails, `src/lib/email/**`, `src/content/**`)

**Commands run:**
- `Grep "legalLinks" path=src`
- `Grep "/privacy" path=src -i`
- `Grep "href=.*privacy|Link.*privacy|\"/privacy" path=src -i`
- `Grep "Privacy Policy|Privacy policy" path=src`
- `Grep "privacy" path=src/lib/email -i`
- `Grep "privacy" path=src/content -i`
- `Grep "privacy" path=src/components/consent -i`
- `Grep "privacy" path=src/app/booking -i`
- `Grep "privacy" path=src/app/(public)/cookies/page.tsx -i`
- Read `src/content/site/footer.ts` in full
- Read `src/components/layout/SiteFooter.tsx:60-109`

**Actual output (key excerpts):**
- `src/content/site/footer.ts:26: legalLinks: [],` — confirmed empty array.
- `src/components/layout/SiteFooter.tsx:80: {footerContent.legalLinks.map((item) => (` — confirmed `.map()` over the empty array, so it renders nothing.
- Every `/privacy`-shaped hit in `src/` is either: the public page's own `canonical: siteUrl("/privacy/")` self-reference (`src/app/(public)/privacy/page.tsx:25`), or the unrelated **admin** `/admin/privacy` route (a staff data-subject-request queue, not the public policy page) referenced from `AdminTopNav.tsx`, `PrivacyFilterBar.tsx`, `admin/privacy/page.tsx`, `admin/clients/actions.ts`, `admin/privacy/actions.ts`.
- `src/lib/email/**`: **zero matches** for "privacy" — no email template links to the privacy page.
- `src/content/**`: matches are all the word "privacy" used descriptively in area-page/FAQ prose (e.g. "in the privacy of your own home"), none is a link/href to `/privacy`.
- `src/components/consent/**` (CookieBanner, ConsentPreferencesPanel): **zero matches** for "privacy" — the consent UI does not link to the privacy policy.
- `src/app/booking/**`: **zero matches** for "privacy" anywhere in the booking flow.
- `src/app/(public)/cookies/page.tsx`: **zero matches** for "privacy" — the cookies page doesn't cross-link to the privacy page either.
- No `"Privacy Policy"` text/link anywhere in `src/` except the privacy page's own `<title>` metadata and its own eyebrow text.
- The only cross-page mechanism in the footer is a "Cookie settings" trigger button (`href="?cookie-settings=1"`, `data-cookie-settings-trigger`), which opens the consent panel — not a link to `/privacy`.

**Verdict: CONFIRMED, and the plan's "footer has zero legal links" is correct — but the broader sweep found NO link to `/privacy` anywhere in the live public site at all** (not footer, not nav, not cookie banner/consent panel, not booking flow, not emails, not other content pages). This is a stronger/different finding than the plan's narrow footer-only claim: the /privacy page is currently unreachable by any in-app link — it would only be found via direct URL, a search engine, or its own `sitemap`-style canonical tag (and no sitemap file exists either — see Claim 7). This raises the blast radius question the plan didn't ask: since nothing links to it, the page is effectively orphaned, which arguably *lowers* risk for item 2's edit (fewer live entry points to break) but is worth the Owner knowing.

---

## Claim 3 — "Grep 'how-long-we-keep-it' repo-wide returns 7 matches, none a live href"

**Commands:**
- `Grep "how-long-we-keep-it" path=. output_mode=files_with_matches` (whole repo)
- `Grep "how-long-we-keep-it" path=. output_mode=count`
- `Grep "href[^\n]*how-long-we-keep-it|how-long-we-keep-it[^\n]*href|#how-long-we-keep-it" path=.`

**Actual output:**
```
Found 9 files:
redesign\plans\POST-BAND-C-FOLLOWUP-plan.md
redesign\evidence\admin-contrast\surgical-review.md
redesign\evidence\plan-deepening\draft-item-02-privacy.md
redesign\evidence\plan-deepening\item-02-privacy.md
redesign\evidence\C-19\fix-round-reverify.md
src\app\(public)\privacy\page.tsx
redesign\evidence\C-19\closeout-adversarial.md
redesign\evidence\C-19\closeout-a11y-responsive.md
redesign\evidence\C-19\closeout-content-legal.md

Found 35 total occurrences across 9 files.
```
The `href`/`#how-long-we-keep-it` search returned only prose sentences inside planning markdown describing the absence of such a link (e.g. "no table of contents or internal link anywhere in the repo references `#how-long-we-keep-it`") — never an actual `<a href="#how-long-we-keep-it">` or `<Link href=...>` in source. The one occurrence in `src/` is `id="how-long-we-keep-it"` on the `<section>` itself (an anchor target, not a link).

**Verdict: PARTLY TRUE.** "None a live href" — **CONFIRMED**, still true. "7 matches" — **FALSE today**: the repo-wide grep now returns **9 files / 35 line occurrences**, not 7. This is not a measurement error; it's the predictable self-referential growth the plan's own evidence trail caused: `item-02-privacy.md`, `draft-item-02-privacy.md`, and `POST-BAND-C-FOLLOWUP-plan.md` each quote the "7 matches" finding multiple times (10, 9, and 10 occurrences respectively in this pass), and three more `C-19` closeout docs and one `admin-contrast/surgical-review.md` doc that didn't exist (or didn't yet mention the anchor) when "7" was first counted are now in the corpus. The undercount is entirely inside `redesign/` planning/evidence prose, not `src/` — the live-code fact ("nothing links to this anchor") is unaffected and still holds.

---

## Claim 4 — "Grep 'privacy|retention|7 year|12 month' (case-insensitive) scoped to src/app/booking/manage/ returns zero matches"

**Command:** `Grep pattern="privacy|retention|7 year|12 month" path=src/app/booking/manage -i -n`

**Actual output:** `No matches found`

Confirmed the directory is not empty first: `find .../src/app/booking/manage -type f` →
```
src/app/booking/manage/actions.ts
src/app/booking/manage/ManageBookingForms.tsx
src/app/booking/manage/page.tsx
```

**Verdict: CONFIRMED.** Zero matches, directory has 3 real files, so this isn't a false negative from an empty/missing path.

---

## Claim 5 — "Glob src/app/(public)/**/__tests__/** returns 0 results and there are zero tests under src/app/(public)/** at all" (checked for both `__tests__` dirs and sibling `*.test.tsx`)

**Commands:**
- `Glob src/app/(public)/**/__tests__/**` → `No files found`
- `Glob src/app/(public)/**/*.test.tsx` → `No files found`
- `Glob src/app/(public)/**/*.test.ts` → `No files found`
- Cross-checked with `find .../src/app/(public) -iname "__tests__" -type d` → no output (empty)

**Verdict: CONFIRMED.** Zero `__tests__` directories and zero sibling `*.test.ts(x)` files anywhere under `src/app/(public)/**`. There is genuinely no existing test infrastructure for any public route, consistent with the plan calling item 2's test "the first public-page test."

---

## Claim 6 — "e2e/ contains exactly 4 spec files and none asserts on this page's text"

**Command:** `find .../e2e -type f | sort`

**Actual output:**
```
e2e/admin-contrast-helpers.ts
e2e/admin-contrast.spec.ts
e2e/admin-roles.spec.ts
e2e/booking-claiming.spec.ts
e2e/booking-public.spec.ts
e2e/helpers.ts
```

6 files total; of these, files matching `*.spec.ts` are exactly 4: `admin-contrast.spec.ts`, `admin-roles.spec.ts`, `booking-claiming.spec.ts`, `booking-public.spec.ts`. The other two (`admin-contrast-helpers.ts`, `helpers.ts`) are shared helper modules, not spec files.

Grep for "privacy" inside `e2e/` found hits only in `admin-roles.spec.ts` (asserting the **admin nav label** "Privacy" is hidden/shown for certain roles — the `/admin/privacy` staff queue) and `admin-contrast-helpers.ts` (auditing contrast on the `/admin/privacy` route). Neither touches `/privacy` (the public policy page) or its text.

**Verdict: CONFIRMED.** Exactly 4 spec files; none asserts on the public privacy page's text (the only "privacy" hits are the unrelated admin `/admin/privacy` route).

---

## Claim 7 — "No sitemap file exists (src/app/**/sitemap*.ts, public/sitemap*.xml)"

**Commands:**
- `Glob src/app/**/sitemap*.ts` → `No files found`
- `Glob public/sitemap*.xml` → `No files found`
- `find src -iname "sitemap*"` and `find public -iname "sitemap*"` → both empty

**Verdict: CONFIRMED.** No sitemap file of either kind exists in the repo today.

---

## Claim 8 — "No .snap file in the repo matches privacy; there is no snapshot infrastructure"

**Commands:**
- `Glob **/*.snap` (repo-wide) → `No files found`
- `find . -iname "__snapshots__" -not -path "*/node_modules/*"` → empty
- `Grep "toMatchSnapshot|toMatchInlineSnapshot" path=src` → `No files found`

**Verdict: CONFIRMED.** Zero `.snap` files anywhere in the repo (not just none matching "privacy" — none at all), zero `__snapshots__` directories, and zero uses of Vitest/Jest snapshot APIs in `src/`. There is no snapshot testing infrastructure in this codebase, full stop — a stronger finding than the plan's narrower claim.

---

## Claim 9 — Does `src/app/(public)/cookies/page.tsx` contain retention-duration language that would become inconsistent with a criteria-based section 6?

**Full file read.** Relevant quoted passage (the only retention-duration language on that page):

> "Choosing Accept all, Reject all, or saving your own settings stores that answer in a small cookie on your device ... **It stays for six months and then we ask you again.** We also keep an internal record of that same choice ... for as long as we rely on it as evidence of your consent."
> (`src/app/(public)/cookies/page.tsx:42-51`)

The linked `CookieRegistryGroups` component pulls from `src/lib/consent/cookie-registry.ts`, which additionally states fixed durations for other storage items: the `rahma_consent` cookie ("6 months (182 days)"), `zam-therapy-booking-draft-v3` ("No fixed expiry ... only cleared when you click..."), `rahma-booking-contact-v1` ("180 days, or until you clear it"), Google Analytics ("Up to 13 months ... not independently verified"), and two "Session" items.

**Verdict:** These are all **cookie/browser-storage retention periods** (consent choice, booking draft, GA cookie, session storage) — a **different subject** from privacy page section 6, which is about **booking/treatment/enquiry record retention** (7 years / 12 months). There is no textual or numeric overlap between the two pages' claims (the cookies page never says "7 years" or "12 months," and the privacy page never states "6 months" or "180 days"). **No direct inconsistency would be created** by rewriting privacy §6 to be criteria-based, because the cookies page's durations describe unrelated data (cookies, not records) and aren't cross-referenced from privacy §6 or vice versa. Flagging this as a new consideration the plan didn't name: if the Owner ever wants the *cookies* page similarly rewritten to criteria-based language, that's a separate, later decision — out of scope for item 2 as currently framed, but worth naming so it isn't assumed already covered.

---

## Claim 10 — Does any OTHER page (public or admin) state a retention period in prose? Broad search for "we keep" / "retain" / "retention" / "years after" / "months" across src/ and src/content/

**Commands:**
- `Grep "we keep|we retain|retention period|data retention|keep .*(records|data|information) for" path=src -i`
- `Grep "retain|retention" path=src/content -i`
- `Grep "stays for|lasts for|kept for|expires? (after|in)" path=src/app/(public)/cookies -i`
- Broad `Grep "we keep|we retain|retention|years after|months?" path=src -i` (files_with_matches) — 24 files matched, manually triaged

**Actual output (relevant hits only, noise excluded — most of the 24-file broad match was unrelated code like `getMonth()`, review text mentioning "years" as a time-since-treatment expression, cron job comments, etc.):**

```
src/app/(public)/privacy/page.tsx:128:  To keep records for insurance and legal purposes — our legitimate business
src/app/(public)/privacy/page.tsx:166: <h3 ...>6. How long we keep it</h3>
src/app/(public)/privacy/page.tsx:168: Our policy is to keep booking and treatment records for 7 years after your last
src/app/(public)/cookies/page.tsx:32: ... how long it lasts. We keep this list in one place ...
src/app/(public)/cookies/page.tsx:46: It stays for six months and then we ask you again. We also keep an
```

`src/lib/consent/cookie-registry.ts` (not `src/content/`, but source-of-truth for the cookies page's per-item durations) additionally has the specific duration strings quoted under Claim 9.

`src/content/**` — searched separately for "retain|retention" — **zero matches**. The only "privacy"-adjacent content-file hits are unrelated FAQ/area-page prose about physical/bodily privacy during treatment, not data retention.

No **admin** page states a data-retention prose duration (admin `/admin/privacy` is a request-tracking queue UI with routes/filters, not policy prose; grepped and confirmed no "we keep"/"retain" strings there).

**Verdict:** Confirmed — the only two pages in the whole app with retention-duration prose are `src/app/(public)/privacy/page.tsx` (§6, the one item 2 targets — "7 years", "12 months") and `src/app/(public)/cookies/page.tsx` + its data source `cookie-registry.ts` (cookie/session durations — "6 months", "180 days", "13 months", "Session"). These describe non-overlapping subjects (records vs. cookies) and use no shared duration figures, so there is no cross-page consistency conflict for item 2 to worry about. No other public or admin page states any retention period in prose.

---

## Summary table

| # | Claim | Verdict |
|---|---|---|
| 1 | Grep for year/month terms in src/ hits only privacy/page.tsx:168,170 | CONFIRMED |
| 2 | footer.legalLinks is `[]`; check for ANY /privacy link anywhere | CONFIRMED (footer empty) — plus new finding: **no in-app link to /privacy exists anywhere**, not just the footer |
| 3 | "how-long-we-keep-it" repo-wide = 7 matches, none a live href | PARTLY TRUE — "none a live href" holds; "7 matches" is now **9 files / 35 occurrences** (self-referential growth in redesign/ planning docs, not in src/) |
| 4 | booking/manage/ has zero privacy/retention hits | CONFIRMED |
| 5 | Zero tests under src/app/(public)/** (dirs and sibling files) | CONFIRMED |
| 6 | e2e/ has exactly 4 spec files, none asserts on this page's text | CONFIRMED |
| 7 | No sitemap file exists | CONFIRMED |
| 8 | No .snap file matches privacy; no snapshot infra | CONFIRMED (stronger: zero .snap files at all, zero snapshot API usage) |
| 9 | cookies/page.tsx retention language vs. criteria-based §6 | Retention language exists ("six months" for consent cookie, plus per-item cookie durations) but describes a **different subject** (cookies, not records) — **no direct inconsistency** created |
| 10 | Any other page states a retention period in prose | Only privacy §6 and cookies page/registry; no admin page; no overlap in figures |

**Net assessment:** 6 of 10 claims fully confirmed as stated. Claim 3's headline number ("7 matches") is stale/false today (actual: 9 files, 35 occurrences) though its substantive conclusion ("none a live href") still holds. Claim 2's substantive conclusion holds and is actually broader than stated — no page anywhere links to /privacy. Claims 9 and 10 are open research questions the plan asked, not verify/falsify claims; both are answered with quoted evidence above and found to pose no blocking inconsistency for item 2.
