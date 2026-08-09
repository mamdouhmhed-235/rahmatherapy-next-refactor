# C-19 — Adversarial closeout review

**Commit under review:** `e70bef8` (parent `425556b`)
**Reviewer:** adversarial closeout subagent, read-only, protocol §2.5

---

## 0 — Diff confirmed

```
git show e70bef8 --stat
git diff 425556b..e70bef8 --name-status
```

Both confirm exactly three changed paths, one commit:

- `A  src/app/(public)/privacy/page.tsx` (220 lines, only source file)
- `A  redesign/evidence/C-19/privacy-1280.png`
- `A  redesign/evidence/C-19/privacy-375.png`

`git log --oneline 425556b..e70bef8` → single commit `feat(redesign): C-19 privacy policy page`. No edits to any other file. **Scope creep: none found.**

---

## 1 — Lost-steps checklist

### Brief §1 nine content sections (brief.md:19-27)

| # | Section | Present in page.tsx | Evidence |
|---|---|---|---|
| 1 | Who we are | ✅ | `page.tsx:44` `id="who-we-are"` |
| 2 | What we collect | ✅ (gap found, see §4) | `page.tsx:66` `id="what-we-collect"` |
| 3 | Why we use it | ✅ | `page.tsx:97` `id="why-we-use-it"` |
| 4 | Who helps us run the site | ✅ | `page.tsx:126` `id="who-helps-us-run-the-site"` |
| 5 | Where data goes | ✅ | `page.tsx:146` `id="where-data-goes"` |
| 6 | How long we keep it | ✅ | `page.tsx:155` `id="how-long-we-keep-it"` |
| 7 | Your rights | ✅ | `page.tsx:163` `id="your-rights"` |
| 8 | Concerns | ✅ | `page.tsx:182` `id="concerns"` |
| 9 | No automated decision-making | ✅ | `page.tsx:196` `id="no-automated-decisions"` |

All nine present, in brief order, as anchored `<section id=…>` headings. No section silently dropped.

### Plan Step 1 copy rules (plan.md:34)

- "no statute citations in body text" — verified: `grep -n "GDPR|Article|DUAA|Data Protection Act|Art\."` against the page returned **zero matches**. Rule followed.
- "health-information sentence mirrors the booking form's reality... removable on request" — page.tsx's health bullet ("Any health or safety notes you choose to share — for example allergies, medication, pregnancy, recent surgery, injuries or skin concerns. This is optional... you can ask us to remove it at any time.") matches the plan's prescribed construction closely. Rule followed.
- "transfers paragraph written swap-ready" — page.tsx:156-161 names both the UK Extension to the EU-US DPF and UK-approved SCCs without hinging on either, matching brief.md:23's exact instruction. Rule followed.
- "analytics/processor and `/cookies` wording conditional-safe" — page.tsx states GA "only runs once you've given us your consent through the cookie banner" without hedging on GA's existence. Cross-checked: `GoogleAnalytics.tsx`, `ConsentScripts.tsx`, `consent-store.ts` exist in `src/`, confirming GA has in fact shipped (C-17) and is consent-gated (C-18), so stating it plainly (rather than the brief's original "not yet active" hedge) is the correct outcome per the progress doc's own note (progress.md:82: "the page can state plainly that GA loads only with consent rather than hedging. Better outcome than planned."). Rule followed, and correctly adapted to the shipped state of the codebase rather than stale brief text.

### Plan Step 2 verification requirements (plan.md:36, gate §3.2)

Step 2 requires: "content cross-checked against the booking schema (pre-flight #4)." This cross-check was evidently **incomplete** — see §4 below, where I independently confirm two BLOCKING content gaps against the live booking schema that a correct cross-check would have caught. This is a lost step, not merely a content bug: the plan named the exact verification action (`src/app/api/bookings/route.ts:14-40` re-verification) that would have surfaced both gaps before commit.

---

## 2 — Style comparison (privacy vs cookies vs about)

Read `src/app/(public)/cookies/page.tsx` (87 lines) and `src/components/about/AboutHero.tsx` for comparison.

- Both privacy and cookies pages use `SectionContainer`/`SectionHeading` from `@/components/shared`, the `tone="ivory"`/`tone="surface"` alternation, `width="narrow"`, `--rahma-*` token classes (`text-rahma-muted`, `text-rahma-charcoal`, `text-rahma-green`), and a "Last updated: …" trailer line. This matches the established idiom for this page class.
- One naming inconsistency found: `src/app/(public)/privacy/page.tsx:21` sets `title: "Privacy Policy — Rahma Therapy"` (em-dash separator). Every other public page's `<title>` uses a pipe separator: `grep -n "title:" src/app/(public)/*/page.tsx` shows `about`, `cookies`, `faqs-aftercare`, `home`, `reviews`, `services` all use `" | "`. This is a real, verifiable deviation from sitewide title convention — **but** it is not an implementer error: the plan itself specifies this exact title verbatim (`plan.md:32`: `title "Privacy Policy — Rahma Therapy"`). The implementer followed the plan precisely; the plan's own copy conflicts with the sitewide `<title>` convention. **NON-BLOCKING**, attributable to the plan text, not the commit.
- Section-heading level: privacy page's `headingClass` renders `<h3>` for its nine subsections (page.tsx:16, `headingClass`), with the page's only `<h2>` coming from `SectionHeading` (`src/components/shared/SectionHeading.tsx:60`, hardcoded `<h2>`). This produces zero `<h1>` on the page — same structural gap as `cookies/page.tsx`, which uses the identical `SectionHeading` + inline `<h2>` pattern for its own subsections. Confirms reviewer #4's accessibility claim (see §5).

No hand-written CSS, no ad-hoc component invented beyond what the page needs. Reads as belonging to this codebase.

---

## 3 — Pause-gate values verified against Owner's recorded answers

Read `src/content/site/contact.ts:9-24`:

```
phone.value = "07798897222"
email.value = "rahmatherapy@outlook.com"
```

Page imports `contactLinks` from this exact module (`page.tsx:4`) and renders `{contactLinks.email.value}` / `{contactLinks.phone.value}` dynamically — not hand-copied strings, so there is zero drift risk between the page and the published contact source. Matches Owner answer (a) exactly. **No postal address** anywhere in the page (confirmed by reading the full 220-line diff) — matches the Owner's explicit instruction not to publish one.

Controller: `page.tsx:46-48` — "This website and our booking service are run by RAHMATHERAPY LIMITED (company number 16769945), trading as Rahma Therapy. We are the data controller…" — matches Owner answer (c) exactly: legal entity named first with its company number, brand alongside rather than instead of it. No individual's name appears anywhere in the page.

Retention: `page.tsx:157-160` — "keep booking and treatment records for 7 years after your last visit… enquiry that doesn't turn into a booking, we keep it for around 12 months… Analytics… kept according to Google's own retention settings." Matches Owner answer (b) exactly, word-for-word against the progress doc's recorded figures (progress.md:59-61).

**No placeholder or invented value found anywhere in the diff.** Pause gate: clean.

---

## 4 — Honesty test: two BLOCKING gaps independently confirmed

I re-derived both BLOCKING claims from the other reviewers directly against the code, not by trusting their evidence.

**(a) City/Town omitted from "What we collect."**
`src/app/api/bookings/route.ts:36-39`:
```
postcode: z.string().trim().min(3),
address: z.string().trim().min(5),
city: z.string().trim().min(2),
area: z.string().trim().min(2),
```
`city` is a distinct, required (`min(2)`) schema field, separate from `area`. `src/features/booking/components/AboutYouStep.tsx:499` renders a dedicated `"City / Town"` field (`autoComplete="address-level2"`, line 504), distinct from the `"Area / County"` field at line 512. `page.tsx:78-81` reads only "Your postcode, address and area, plus any access or parking notes" — `city` is absent. **CONFIRMED, BLOCKING.** A public legal notice is under-disclosing a real, required data category the code collects.

**(b) Booker's own gender omitted, scoped only to "anyone else included."**
`AboutYouStep.tsx:294-301`:
```
{!isGroupBooking ? (
  <>
    <fieldset className={styles.segmentField}>
      <legend>
        {bookingFor === "someone_else" ? "Participant gender" : "Your gender"}
      </legend>
```
When `bookingFor !== "someone_else"` (i.e., booking for self), the legend reads **"Your gender"** and stores it as `clientGender` (`route.ts:28: clientGender: genderInputSchema`). `page.tsx:82-85` reads "...plus the names and genders of anyone else included" — this only discloses third-party gender collection, not the booker's own. **CONFIRMED, BLOCKING.** The booker's own gender is a category of the booker's own personal data, omitted from the "What we collect" section entirely.

Both gaps trace to the same root cause identified in §1: Step 2's required schema cross-check (plan.md:36) was not exhaustively performed against the current 8-field `details` object.

**(c) Sentry key-pattern coverage gap (NON-BLOCKING, re-tested independently).**
Read `src/lib/observability/sentry-scrubbing.ts:4` in full:
```
const SENSITIVE_KEY_PATTERN = /(address|admin.*note|anon.*key|authorization|city|consent|cookie|customer.*note|email|full.*name|health|manage.*token|name|phone|postcode|postal|resend|secret|sentry.*auth|service.*role|supabase.*key|token|treatment)/i;
```
This is a substring match (`.test()`, unanchored). The key `participantNotes` does not contain any of `admin`+`note`, `customer`+`note`, bare `note`, `health`, or `name` as substrings — so it is **not** caught by key-pattern redaction; it would fall through to `redactText`, which only strips email/postcode/phone/long-token *patterns* from free text, not prose describing health conditions. Confirmed independently by reading the regex character-by-character. Cross-checked call sites: `grep -rl "Sentry\.(capture|withScope)" src` → 7 files (`reports-data.ts`, four `cron/*` routes, `instrumentation.ts`, `global-error.tsx`); spot-checked `reports-data.ts` for `notes`/`participantNotes`/`healthNotes` — no matches, so the gap is currently latent, not actively firing. **NON-BLOCKING claim confirmed as described** — real coverage gap, no current exploiting call site.

**(d) Transfers-vocabulary claim (NON-BLOCKING, confirmed as "not a defect").** `page.tsx:156-161` wording matches the plan's explicit swap-ready instruction verbatim (`plan.md:34`, `brief.md:23`). Confirmed: not a defect, correctly implemented as specified.

**(e) Missing H1 (NON-BLOCKING, confirmed via source reading).** `src/components/shared/SectionHeading.tsx:60` hardcodes `<h2>`; the privacy page's only headings are that `<h2>` plus nine `headingClass` `<h3>`s (`page.tsx:16,44,66,...`). `grep -rl "<h1" src/components` → 7 files, all Hero components for content pages (about, area-pages, faqs-aftercare, home, package-pages, reviews, services) — none of them legal/utility pages. Confirms the claim that this matches the established idiom for this page class (cookies has the same gap via the same shared component) rather than being a privacy-page-specific regression.

---

## 5 — Irreversibility check

Full 220-line diff read line-by-line. No home/postal address, no personal phone number distinct from the business line, no individual's name anywhere in the page. The controller is correctly stated as the limited company (`RAHMATHERAPY LIMITED`, company number `16769945`) with the brand named alongside, not replacing it, per Owner answer (c). Nothing in this diff should not be permanently public, other than the two BLOCKING under-disclosures in §4, which are omissions rather than over-disclosures.

---

## 6 — Verdict on the four prior reviewers' findings

| Claim | My verdict | How I verified |
|---|---|---|
| Transfers vocabulary too technical (NON-BLOCKING) | **CONFIRMED as described / not a defect** | Read plan.md:34, brief.md:23 — matches exactly as mandated |
| City/Town omitted (BLOCKING) | **CONFIRMED** | Read route.ts:36-39, AboutYouStep.tsx:499-512 directly |
| Booker's own gender omitted (BLOCKING) | **CONFIRMED** | Read AboutYouStep.tsx:294-301, route.ts:28 directly |
| Sentry scrubber key-gap (NON-BLOCKING) | **CONFIRMED** | Read sentry-scrubbing.ts:4 char-by-char; call-site grep |
| Missing H1 (NON-BLOCKING) | **CONFIRMED** | Read SectionHeading.tsx:60; grep for `<h1` across src/components |

Nothing was refuted. All five prior findings hold up under independent re-derivation.

---

## 7 — Additional finding from this pass

Beyond confirming the above, this review adds one finding not previously reported: **the plan's own required Step 2 cross-check action (plan.md:36) was not fully executed**, which is the process-level root cause of both BLOCKING content gaps in §4(a)-(b). This is reported as its own finding below since it is a process/step failure distinct from the content defects themselves.

---

## Checks not run

- Did not run `pnpm lint`/`tsc`/`build` (banned for agents this session per SUBAGENT-RULES; static-gate verification is another dimension's responsibility).
- Did not load `/privacy` in a live browser to re-screenshot or re-query the DOM (accessibility dimension already did this with a live DOM query; I relied on source-level confirmation of the same `<h1>` absence via `SectionHeading.tsx`).
- Did not exhaustively re-check all Sentry call sites beyond `reports-data.ts` for `notes`/`participantNotes` payloads (spot-checked one of seven).
