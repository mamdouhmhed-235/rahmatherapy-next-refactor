# C-21 — Canonical domain fix — PROGRESS

**Plan:** `redesign/plans/C-phase/C-21-canonical-domain-fix-plan.md`
**Brief:** `redesign/briefs/C-21-canonical-domain-fix-brief.md`
**Programme:** Band C, C-C implementation — plan **#1 of 22** in the C-C-EXECUTION-PROTOCOL §4 order.
**Executed:** 2026-07-27 · orchestrated session (implementer + independent verifier + evidence sweep + adversarial reviewer)
**Programme-start SHA:** `11553c7`

---

## 1 — Commits

| # | SHA | Message | Files |
|---|---|---|---|
| 1 | `38ff24c` | `fix(seo): canonical domain — single source of truth + correct site URL` | 19 (2 new, 17 edited) |
| 2 | `21915d0` | `fix(seo): C-21 — structured-data URLs match the served trailing-slash form` | 6 (Owner-approved fix round) |

**Final SHA: `21915d0`.** Not pushed (protocol §1.5).

Plan §6 specified a single commit. The second commit is the Owner-approved closeout fix round (see §4), not a plan deviation by the implementer.

---

## 2 — Steps executed

| Step | Status | Notes |
|---|---|---|
| 1 — single source `src/content/site/site-url.ts` | ✅ | Pure constant per D21/C21-F2. `grep "process.env"` → zero matches. Verbatim the plan's code block. |
| 1a — production `NEXT_PUBLIC_SITE_URL` (⛔ HARD-STOP) | ✅ **no action required** | Raised in chat. **Owner confirmed 2026-07-27: already set to `https://rahmatherapy.uk` in Cloudflare variables.** No env change performed by the agent or orchestrator. |
| 2 — rewire absolute URLs | ✅ | `metadataBase: new URL(SITE_URL)`; 5 public pages' JSON-LD `url`/`item` derived via `siteUrl()`. |
| 2a — area pages + `area-json-ld.ts` | ✅ | File-local `SITE_URL` const deleted and replaced with an **import** (not a literal swap) — the drift mode D22's guard targets. |
| 3a — clinic contact address | ✅ | `contact.ts` displayed value **and** `mailto:` href → `rahmatherapy@outlook.com`; preview-route `contactEmail` fixture likewise. |
| 3b — per-person placeholders | ✅ | Neutral `@example.com` examples. Owner's address deliberately NOT used as placeholder text anywhere, incl. `SettingsForm.tsx` (C21-F8's conscious choice). |
| 4 — anti-drift guard | ✅ | `src/content/site/__tests__/canonical-domain.test.ts`, 3 specs. Negative case genuinely exercised (temp probe → 2 specs fail → probe removed, tree clean). |

---

## 3 — Verification gate (plan §3)

| Gate | Result |
|---|---|
| §3.1 lint | **59 errors / 7 warnings — identity exact**, same 6 files, no swap-ins |
| §3.1 tsc | `npx tsc --noEmit` → **0 errors** |
| §3.1 vitest | **6 failed / 488 passed / 494** — the 6 are exactly the inherited set; guard adds 3 new passing specs |
| §3.1 build | `pnpm build` → **clean** (re-run at `21915d0`, exit 0) |
| §3.2 rendered output (12 pages + `/`) | ✅ every canonical / JSON-LD `url`/`item` / og:image reads `https://rahmatherapy.uk/…`; **zero** `.co.uk` / `.com` in any response body; **zero** localhost leakage into metadata values |
| §3.2b contact email | ✅ `rahmatherapy@outlook.com` + matching `mailto:` on 12/12 pages; `hello@rahmatherapy.co.uk` appears nowhere |
| §3.3 Rich Results Test | ⏳ **Owner action** — external, agent must not block on it |
| §3.4 census | ✅ `.co.uk` **0** · `.com` **0** · `.uk` **1** (only `src/content/site/site-url.ts`) |
| §3.5 no visual regression | ✅ 12 pages at 1280 + 2 at 375 — 0 console errors, no overflow, no broken layout. Evidence: `redesign/evidence/C-21/visual-regression-1280.md` |
| §3.6 Search Console / social re-scrape | ⏳ **Owner action** — post-deploy |

**Post-fix-round re-verification:** every URL emitted into structured data curl-confirmed **200** (zero 308s). Adversarial reviewer verdict on the original commit: **0 scope creep · 0 style drift · 0 lost steps**.

---

## 4 — Deviations

**One, Owner-approved in chat 2026-07-27 (commit `21915d0`).**

The adversarial review found that `next.config.ts` sets `trailingSlash: true`, so plan Step 2's literal path strings (`siteUrl("/about")`) emit URLs that HTTP-308-redirect — contradicting the plan's own §4 risk row 1 ("the canonical must match the post-redirect URL") and diverging from the area pages, which the same commit got right. Rather than improvise against explicit plan text, the orchestrator stopped and asked. The Owner chose "fix both now". Changes:

- `/about` → `/about/`, `/services` → `/services/`, `/faqs-aftercare` → `/faqs-aftercare/`, `/reviews` → `/reviews/`
- homepage entity `url` and all BreadcrumbList "Home" items: root → `/home/` (the repo's declared single indexable homepage, per `src/app/(public)/page.tsx`)
- includes `area-json-ld.ts:30`, which composed the Home crumb via direct `${SITE_URL}/` interpolation rather than a `siteUrl()` call

`@id` values were deliberately **not** touched (identifiers, not page URLs). No `alternates.canonical` was added — explicitly deferred (§5).

---

## 5 — Deferred / flagged, not actioned

1. **5 of 6 original public pages emit no `<link rel="canonical">` at all.** `/home`, `/about`, `/services`, `/reviews`, `/faqs-aftercare` never declared `alternates.canonical`; only the 6 area pages do. The brief's premise that `metadataBase` "builds every canonical URL" is **factually wrong** for the Next App Router — `metadataBase` only resolves *relative* URLs, it never emits a canonical tag. So brief §3's acceptance line "every public page's rendered canonical shows `https://rahmatherapy.uk/...`" passes **vacuously** on those 5. Concrete cost: `bookingLink.href = "?booking=1"` means every public page is linked as `/home/?booking=1` etc., and with no canonical those query variants are separately indexable duplicates. **Owner decision 2026-07-27: defer to a follow-up**, pairing naturally with the sitemap/robots gap.
2. **No `sitemap.ts` / `robots.ts`** (plan §7.5). `GET /robots.txt` → 404. Already recorded as Owner-deferred in `BAND-C-REFINEMENT-2026-07-26.md` §6.3 — not re-raised as new.
3. **`createManageUrl` emits `/booking/manage?token=…` with no trailing slash**, so production 308s it. Verified the redirect preserves the query, so customer links work — it just costs one hop on a customer-facing email link. Out of C-21 scope; separate ticket.
4. **Clinic email is triplicated.** `MaintenanceBanner.tsx:22,25` and `MaintenanceModal.tsx:58,62` hard-code `rahmatherapy@outlook.com` instead of importing `contactLinks.email` (as `SiteHeader`/`SiteFooter` do). Already correct today, so nothing was stale — but it is the same single-source-of-truth failure C-21 killed for the domain, left standing for the email.
5. **Guard-test residual blind spots** (notes, not defects): `LIVE_ORIGIN` matching is substring-based, so a hypothetical `https://www.rahmatherapy.uk` or `http://rahmatherapy.uk` duplicate would evade the exactly-one assertion; the guard scans `src/` only (the pre-flight census also covers `public/`); `process.cwd()` rooting means running the spec from a subdirectory throws `ENOENT …/src/src`.
6. **Evidence PNGs not committed.** `redesign/evidence/C-21/` holds 15 screenshots totalling **25 MB**; at that rate 22 plans would add ~0.5 GB to the repo. Only the 8.8 KB findings summary (`visual-regression-1280.md`) is committed; the PNGs remain on disk, untracked. A `.gitignore` entry for `redesign/evidence/**/*.png` would formalise this — **not** actioned, since `.gitignore` is outside this plan's files-touched list (protocol §1.6a).

---

## 6 — Outstanding Owner actions

| # | Action | Status |
|---|---|---|
| 1 | Production `NEXT_PUBLIC_SITE_URL` | ✅ **CLOSED** — Owner confirms already `https://rahmatherapy.uk` in Cloudflare variables |
| 2 | §3.3 — validate each page's JSON-LD in Google's Rich Results Test | ⏳ open |
| 3 | §3.6 — verify the property in Search Console under `rahmatherapy.uk`; request homepage re-indexing; re-scrape social previews if links were previously shared | ⏳ open (post-deploy) |
| 4 | Set `business_settings.contact_email` | ⏳ open — see below |
| 5 | Decide on the deferred canonical-tags follow-up (§5.1) | ⏳ open |

### On item 4 — `business_settings.contact_email`

Read-only check 2026-07-27 (project `twzutkfgqclqurvkmvqz`): the value is **NULL** — *not* the dead `hello@rahmatherapy.co.uk`. So there is **no dead-mailbox exposure** on the transactional surface. All three consumers handle NULL safely:

- `templates.ts:181,400` — contact line filtered out of booking emails
- `booking/manage/page.tsx:53-58` — `.filter(Boolean)`, line omitted
- `notifications.ts:210` — `getAdminRecipient()` falls back to `extractEmailAddress(getFromEmail())`

**Consequence of leaving it NULL:** booking emails carry no contact line at all, and admin booking notifications go to the FROM address rather than a chosen inbox.

**Owner asked (2026-07-27) to confirm the ability to change it exists — it does, and C-21 left it intact:** `/admin/settings` → "Contact email" field ([`SettingsForm.tsx:292-304`](../../src/app/admin/settings/SettingsForm.tsx), helper *"Shown to customers as the reply-to address"*), persisted by [`settings/actions.ts:85`](../../src/app/admin/settings/actions.ts) as `contact_email: contactEmail || null`. C-21 only neutralised the field's *placeholder*; the field's value is Owner-managed data and was deliberately not pre-filled (C21-F8). Setting it to `rahmatherapy@outlook.com` is recommended and is the Owner's call — it is production data.

---

## 7 — Baseline identity AFTER C-21 (inherited by plan #2, C-22)

**This supersedes the programme-start snapshot and any baseline text hardcoded inside later plans.**

- **tsc:** `npx tsc --noEmit` → **0 errors, clean.**
- **build:** `pnpm build` → **clean.**
- **vitest: 6 failed / 488 passed / 494 total** *(totals rose from 485/491 — C-21's guard adds 3 new passing specs; the failure set is unchanged)*:
  1. `src/lib/auth/admin-access.test.ts` :: admin access matrix gives Owner broad access while keeping owner-only role actions permission-gated
  2. `src/lib/auth/admin-access.test.ts` :: admin access matrix gives Admin broad operational access without role template management
  3. `src/app/api/bookings/createBookingTransaction.test.ts` :: createBookingTransaction normalizes a single public booking into the RPC payload
  4. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm renders step 1 on first load
  5. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm moves focus to the first invalid field when continuing with errors
  6. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm shows the consent error when trying to create booking without consent
- **lint: 59 errors / 7 warnings**, in exactly:
  - `design_handoff_area_pages/prototype/area-page.jsx` 48E 1W
  - `design_handoff_area_pages/prototype/shared.jsx` 2E 5W
  - `design_handoff_area_pages/prototype/site-chrome.jsx` 5E 0W
  - `src/features/booking/BookingExperience.tsx` 3E 0W
  - `src/features/booking/BookingExperienceLoader.tsx` 1E 0W
  - `src/features/booking/utils/returning-customer.ts` 0E 1W

**Expected shrinkage:** none was expected for C-21, and none occurred. C-06 (plan #3) is the plan expected to remove failure #3 (`createBookingTransaction`) — confirming that removal is an explicit exit-criterion of C-06's closeout.

---

## 8 — ⚠️ Carry-forward for every later Band C plan

**`src/content/site/__tests__/canonical-domain.test.ts` is now a repo-wide tripwire.** From here on, ANY new file under `src/` that contains `rahmatherapy.com`, `rahmatherapy.co.uk`, or a **second** `https://rahmatherapy.uk` literal — including in a comment or a test fixture — fails this spec. The failure surfaces as a *new* baseline entry attributed to whichever plan is in flight, with a message that looks unrelated to that plan's work.

**Every later plan's dispatch must carry:** new absolute site URLs in `src/` must import `SITE_URL` / `siteUrl` from `src/content/site/site-url.ts`; fixture emails must stay on `*.example` / `*.example.test`. Most exposed: **C-18** (`(public)/cookies/page.tsx` + any canonical it sets), **C-08** (`templates-data.ts` email footers), and any future sitemap work.

**Shared-surface check (protocol §1.9):** no collisions introduced. `contact.ts` replaced two email lines with two lines, so C-22's anchor `contactLinks.phone.value` sits at an unchanged line number. `ManualBookingForm.tsx`, `notifications.ts`, `wrangler.jsonc`, `admin/bookings/page.tsx`, `templates-data.ts` all untouched.

**Unclosed loop worth naming:** canonicals are now a pure constant while email/cron still read `NEXT_PUBLIC_SITE_URL`. Both now say `https://rahmatherapy.uk`, but nothing in the codebase asserts the two agree — a future env drift would silently desynchronise them.

---

*End of C-21 progress.*
