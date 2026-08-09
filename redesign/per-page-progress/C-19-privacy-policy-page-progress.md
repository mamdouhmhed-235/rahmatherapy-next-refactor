# C-19 — Privacy policy page — PROGRESS

**Plan:** `redesign/plans/C-phase/C-19-privacy-policy-page-plan.md`
**Brief:** `redesign/briefs/C-19-privacy-policy-page-brief.md`
**Programme:** Band C, C-C implementation — plan **#19 of 22** (§4 order). Runs after C-18.
**Migrations:** none. **Zone-2 actions:** none. **Commits:** one.

> Created early, during C-18, to capture Owner answers to C-19's ⏸ gate as they were given. Everything below the decisions section is filled at C-19 implementation time.

---

## 1 — ⏸ STOP-AND-ASK (plan:20) — Owner answers

The plan's single ⏸ bundles three copy inputs. Two are answered; two remain outstanding.

| # | Question (plan's wording) | Status |
|---|---|---|
| (a) | contact details to publish (email/phone; postal optional) | **✅ ANSWERED 2026-08-04** |
| (b) | retention number (7-year insurance default unless their policy says otherwise) | **✅ ANSWERED 2026-08-04** |
| (c) | business/trading name line for "Who we are" | **✅ ANSWERED 2026-08-04** |

### (a) Contact details — Owner decision, 2026-08-04, in chat

**Publish email + phone, exactly as already published on the site. No postal address.**

- Email: `rahmatherapy@outlook.com`
- Phone: `07798897222`

Both come from `src/content/site/contact.ts:10-23`, which already publishes them (plus WhatsApp on the same number) on the public contact surfaces. Reusing them exposes nothing new and avoids a privacy notice that contradicts the contact page.

**No postal address**, deliberately: the site publishes none today, it is not needed for the notice to function, and publishing a home address on a public page is permanent and effectively irreversible once indexed. Handle as "available on request" if the page needs to mention it.

**Relevant history:** C-21 established that the previously published `hello@rahmatherapy.co.uk` **did not exist** — customers emailing it reached nobody — and replaced it with the live `rahmatherapy@outlook.com`. A privacy notice whose contact route is dead would be worse than no notice, so the working address is the one that matters here.

### (c) Controller identity — Owner answer 2026-08-04, VERIFIED against the public register

**The data controller is a limited company:**

- **Registered name: `RAHMATHERAPY LIMITED`** (all caps is the registered form)
- **Company number: `16769945`**

**Independently verified** against Companies House (`find-and-update.company-information.service.gov.uk/company/16769945`) rather than taken on trust, because this becomes a public legal statement identifying who is responsible for visitors' personal data under Art 13(1)(a). The register returns an exact match: name `RAHMATHERAPY LIMITED`, number `16769945`, status **Active**, type **Private limited company**, incorporated **7 October 2025**.

**Implementation notes for the page copy:**
- The **legal entity** is `RAHMATHERAPY LIMITED`; the **brand/trading name** used throughout the site is "Rahma Therapy". The "Who we are" section must name the legal entity with its company number — the brand may appear alongside, but must not stand in place of it.
- Because the controller is a **company and not an individual**, the lawful-basis, rights and complaints sections must read consistently with a corporate controller. This is not a find-and-replace of one line.
- The ICO registration referred to in the brief belongs to the **company**.

**Knock-on for the flagged business item:** the brief's ICO fee figure (`brief:37`, "Tier 1 £52") was written assuming the smallest tier. ICO fees are banded by organisation size and turnover, so the tier should be confirmed against the company rather than carried over from the brief. Business action, not code — recorded, not actioned.

---

## 1.1 — ⏸ GATE CLEARED

All three copy inputs are answered: **(a)** email + phone as already published, **(b)** 7 years / ~12 months, **(c)** `RAHMATHERAPY LIMITED`, company number `16769945`. **C-19 is unblocked and may proceed** — protocol §1.4 is satisfied; no value is a placeholder.

### (b) Retention — Owner decision, 2026-08-04, in chat

- **Booking/treatment records: 7 years after the last visit.**
- **Enquiries that do not become bookings: ~12 months.** Owner confirmed the brief's figure explicitly.
- Analytics: per Google's retention settings (unchanged from the brief; only meaningful once C-17/C-18's gated GA is live).

**Two caveats recorded deliberately, because this becomes a public legal statement:**

1. **The "insurance-standard" basis was NOT independently verified.** The 7-year figure originates in the brief (`C-19-privacy-policy-page-brief.md:24`), which itself flags it as a default "to be confirmed against the actual insurance policy" (`brief:37`). The orchestrator declined to assert the insurance or professional-body standard as fact and said so in chat before the Owner decided. This is the Owner's business decision, not a verified legal finding.
2. **No code enforces it.** A codebase sweep found **no retention or pruning process for bookings, clients or enquiries**. The only booking deletion is a rollback path for a failed recurring-series creation (`src/app/api/cron/extend-recurring-horizons/route.ts:569-572`); every other `.delete()` is admin CRUD on availability, staff, services, templates and roles. Records are therefore kept indefinitely unless deleted by hand. Publishing "7 years" makes it a commitment a human must keep manually.

   **Building a retention job is explicitly OUT of C-19's scope** — the Owner locked C-19 to one new page with nothing else touched. Enforcement is a separate future item; logged here and in `OWNER-ACTION-BACKLOG.md` rather than silently absorbed.

   This is the same defect class C-18 §3.1 documents twelve times over: copy describing an intended end state rather than what the code actually does. The difference is that here the gap is disclosed up front and is the Owner's to close operationally.

---

## 2 — Nothing outstanding

All ⏸ inputs are answered and verified (§1.1). C-19 requires no further Owner input to be implemented.

---

## 3 — Drift found at extraction time (2026-08-04), to handle at C-19 plan start

- **The brief's GA premise is stale.** `brief:8` and `brief:22` state Google Analytics is "NOT yet in the codebase (0 grep hits)" and "not yet active as of this writing". C-17 has since shipped (`d5425ec`) and C-18 gates it. Decision D18's conditional-safe wording was designed to survive exactly this, so the page copy still lands — but since C-18 lands first, the page can state plainly that GA loads **only with consent** rather than hedging. Better outcome than planned.
- **Anchor drift.** The plan (`plan:22`) and brief cite `src/app/api/bookings/route.ts:27` for `participantNotes[]`. C-22's rate-limit imports (`a63de0b`, `ceb028d`, 2026-07-27 — one day after the plan's verification date) inserted five lines, so line 27 is now `healthNotes` and `participantNotes` sits at line 32. The companion citation `AboutYouStep.tsx:429` is still correct. Re-locate by symbol, per SUBAGENT-RULES rule 7.
- **Dependencies: genuinely none.** The plan declares no hard dependency, so there is no `git log --grep` marker to verify. C-17 (`70e2103`) and C-18 are soft coordination only.

---

## 4 — Implementation — **SHIPPED 2026-08-09**

| Commit | What | Model |
|---|---|---|
| `e70bef8` | Steps 1–2 — `src/app/(public)/privacy/page.tsx` (220 lines) + 375/1280 evidence screenshots | `sonnet` |
| `ab80687` | **Fix round** — `what-we-collect` corrected: town/city and the booker's own gender disclosed | `sonnet` |

**Verification tier:** FULL closeout (four independent read-only dimensions in parallel + one adversarial sweep), all `model: sonnet` per §5. No `opus` dispatch on this plan — a static server-rendered content page needs no capability beyond Sonnet, and every reviewer judges against plan text rather than taste.

**Diff scope held exactly to the Owner's lock:** one new source file, zero edits anywhere else, across both commits. Confirmed independently four times (`git show --stat` + `git diff 425556b..ab80687`).

### 4.1 — Closeout verification FAILED first time. Two BLOCKING findings, both real.

The truthfulness dimension returned **FAIL**; the adversarial reviewer then **re-derived both findings from the code independently rather than trusting the first report, and refuted nothing.** Evidence in `redesign/evidence/C-19/closeout-{content-legal,truthfulness,gates-scope,a11y-responsive,adversarial}.md`.

1. **The page under-disclosed a required field.** The booking request collects **four** separate location fields — `postcode`, `address`, **`city`**, `area` — and `AboutYouStep.tsx` renders a dedicated required **"City / Town"** input distinct from **"Area / County"**. The page said only *"Your postcode, address and area"*. A public legal notice omitting a category of data the code genuinely collects is the notice being wrong, not a copy nit.
2. **The page under-disclosed whose gender is collected.** It said *"the names and genders of anyone else included"* — third parties only. But for a self-booking the gender `<fieldset>`'s `<legend>` reads **"Your gender"** and the value is stored as `clientGender`. The booker's own gender was collected and undisclosed.

**Root cause, named by the adversarial reviewer:** plan Step 2's required cross-check against the booking schema (`plan:36`) was performed but **not exhaustively** against the current `details` object. This is a lost step, not merely a content bug — the plan named the exact verification action that would have caught both.

### 4.2 — Fix round and re-verification

`ab80687` corrected both bullets, +5/−4 in the one file:
- *"Your **address, town or city, area and postcode**, plus any access or parking notes…"*
- *"…plus **the gender of the person being treated — including your own if the booking is for you** — and the names and genders of anyone else included."*

**Re-verified by a fresh verifier (`sonnet`) with an exhaustive field-by-field mapping — `redesign/evidence/C-19/fix-round-reverify.md`.** This time the cross-check enumerated **every** field in `bookingRequestSchema` *and* `manualBookingSchema`, cross-read against `AboutYouStep`, `ConfirmStep`, `ScheduleStep`, `PackageSelectionStep` and `createBookingTransaction`, and checked **both directions**: **zero MISSING, zero OVER-DISCLOSED.** Over-disclosure was checked deliberately, because an over-correction is exactly what a hurried fix round would introduce, and a notice claiming to collect what the code does not is equally wrong.

Two non-blocking observations recorded rather than acted on: `numberOfPeople` has no dedicated bullet (inferable from the group wording, not a real gap), and `bookingSource` — an admin-only channel tag — is unmentioned because it is staff-entered operational metadata, not customer-supplied personal data, and was outside the brief's audited field list.

### 4.3 — Gate results (all BY IDENTITY, re-run after the fix)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `pnpm vitest run` | 5 failed / 2014 passed (2019) — identities **exactly** `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3. The passed total grew from 2007 because C-20 Phase A landed 7 new tests in the same window; judged by identity, not count |
| `pnpm lint` | **59E / 7W** in exactly the six baseline files; the privacy page absent from the output |
| `pnpm build` | **NOT RUN** — banned for agents this session (it twice knocked over the Owner's dev server). Recorded, not glossed |
| Live render 375 + 1280 | ✅ `redesign/evidence/C-19/privacy-{375,1280}.png`; all nine sections and the last-updated line present |
| Isolation | ✅ nothing staged or modified outside the one file (excluding the standing `maintenance.ts` change and pre-existing untracked dirt) |

**Accessibility / responsive, on measured evidence not impressions:** body contrast **7.09:1**, links **5.18:1** (both on computed colours against the actual rendered background); the `65ch` measure holds at **646.9px at both 375 and 1280**, never stretching; zero horizontal overflow at either width; all nine deep-link anchors land the section at a consistent 94px offset clearing the sticky header; `--rahma-*` public tokens throughout with **zero `--admin-*`** hits.

### 4.4 — Deliberately NOT fixed (out of the Owner-locked one-file scope; all in `OWNER-ACTION-BACKLOG.md`)

- **Sentry's `SENSITIVE_KEY_PATTERN` does not key-match `notes` / `participantNotes`** (`sentry-scrubbing.ts:4`). **Latent, not firing** — all 7 `Sentry.capture*` call sites were enumerated and none attaches those fields, and `sendDefaultPii: false` keeps the request body out of the automatic path. So the page's "personal information is scrubbed before it reaches Sentry" is **accurate about what actually reaches Sentry today**, which is why the copy was left alone rather than softened. It becomes false the moment any future capture attaches those fields.
- **No `<h1>` on `/privacy` or `/cookies`** — `SectionHeading.tsx:60` hardcodes `<h2>` and legal pages have no Hero. A real WCAG gap, but **sitewide and pre-existing**, with the fix in a shared component outside this plan's lock. The plan asked for the "existing public heading pattern" and that is precisely what was built.
- **The `<title>` em-dash where every other public page uses a pipe.** `plan:32` specifies that string verbatim; changing Owner-reviewed plan copy unasked is the deviation this programme guards against. Owner's call.

### 4.5 — Standing caveat, restated because it is now public

**No code enforces the published retention periods.** A `src/` sweep found no pruning process for bookings, clients or enquiries; the only booking deletion is a rollback path in the recurring-horizons cron. The page states 7 years / ~12 months as the practice's **policy** and makes **no claim of automatic deletion** — verified in both closeout passes. Enforcement is a manual, operational commitment the Owner now holds publicly. Building a retention job was explicitly out of C-19's scope.

Also still open from §1: the brief's **ICO Tier 1 £52** figure assumed the smallest band. Now that the controller is known to be an incorporated company, the band should be confirmed against it. Business action, not code.

---

## 5 — ▶ Position

**✅ SHIPPED.** Final code SHA `ab80687`. No Owner input outstanding for this plan.

