# C-19 — Content + Legal Completeness Closeout

**Reviewed:** commit `e70bef8` ("feat(redesign): C-19 privacy policy page"), parent `425556b`.
**File under review:** `src/app/(public)/privacy/page.tsx` (220 lines, the only source file in the commit).
**Diff confirmed:** `git show e70bef8 --stat` → exactly `src/app/(public)/privacy/page.tsx` (NEW) + `redesign/evidence/C-19/privacy-1280.png` + `redesign/evidence/C-19/privacy-375.png`.

Verdict: **PASS** — all 13 checks pass; one NON-BLOCKING style note.

---

## 1. Nine brief sections present, each with an id anchor

All nine present, in substance, each in its own `<section id="...">`:

| # | Heading text (page.tsx) | id anchor |
|---|---|---|
| 1 | "1. Who we are" | `who-we-are` (line 50) |
| 2 | "2. What we collect" | `what-we-collect` (line 71) |
| 3 | "3. Why we use it" | `why-we-use-it` (line 102) |
| 4 | "4. Who helps us run the site" | `who-helps-us-run-the-site` (line 133) |
| 5 | "5. Where your data goes" | `where-data-goes` (line 154) |
| 6 | "6. How long we keep it" | `how-long-we-keep-it` (line 164) |
| 7 | "7. Your rights" | `your-rights` (line 174) |
| 8 | "8. Concerns and complaints" | `concerns` (line 194) |
| 9 | "9. No automated decision-making" | `no-automated-decisions` (line 209) |

**PASS.**

## 2. "Who we are" names the legal entity + company number

Line 53-55, quoted exactly:
> "This website and our booking service are run by RAHMATHERAPY LIMITED (company number 16769945), trading as Rahma Therapy. We are the data controller responsible for your personal information — the organisation that decides how and why it's used."

Legal entity `RAHMATHERAPY LIMITED` and company number `16769945` both present; the brand "Rahma Therapy" sits alongside as "trading as", not in place of the entity — matches the Owner's answer (c) exactly. **PASS.**

## 3. Corporate-controller consistency (no residual sole-trader/individual phrasing)

Ran `grep -E "\bI \b|\bmy \b|myself|sole trader|practitioner|self-employed"` against the file — **0 matches**. All first-person references in the body are plural/corporate: "We are the data controller" (line 55), "we collect" (line 74), "a member of our team" (line 213), "our legitimate business interest in protecting the company" (line 128). No individual-practitioner phrasing found anywhere in the file. **PASS.**

## 4. Contact details are exactly the two published values, no postal address

Section 1 (lines 58-68) renders `contactLinks.email` and `contactLinks.phone` from `src/content/site/contact.ts` — verified those constants are:
```
phone.value = "07798897222"   (contact.ts:12)
email.value = "rahmatherapy@outlook.com"   (contact.ts:22)
```
The page consumes these via import (`contactLinks.email.href`, `contactLinks.email.value`, `contactLinks.phone.href`, `contactLinks.phone.value`) rather than hardcoding them, so it cannot drift from the published values. No WhatsApp link, no postal address, and no other channel appears anywhere in the file (confirmed by reading the full 220 lines — the only other contact-adjacent text is line 189-191, which just points back to section 1). **PASS.**

## 5. Retention section — figures correct, no automated-mechanism claim

Lines 166-171, quoted exactly:
> "Our policy is to keep booking and treatment records for 7 years after your last visit with us. If you make an enquiry that doesn't turn into a booking, we keep it for around 12 months. Analytics information, where you've given consent for it, is kept according to Google's own retention settings."

- 7 years (bookings/treatment): present, matches Owner answer (b).
- ~12 months (non-converting enquiries): present ("around 12 months"), matches Owner answer (b).
- Analytics per Google's retention settings: present.
- Automated-mechanism check: the sentence is phrased as "Our policy is to keep... for 7 years" — a policy statement, not a claim of automatic deletion or a described mechanism. No words like "automatically," "deleted after," "purged," or "system" appear anywhere in the section. This matches the progress file's explicit caveat (progress.md:65-70) that no retention/pruning job exists in the codebase and the copy must not imply one. **PASS.**

## 6. Per-participant-notes point (C19-F6) present

Section 2, last bullet (lines 94-98), quoted exactly:
> "If you book for other people, any notes you add about them. Those notes are about someone else, not you, and may include information about that person's health too."

This states the required fact: participant notes are free text about other people and may include their health information. **PASS.**

## 7. Health-information sentence mirrors the booking form's reality

Section 2 bullet (lines 88-93), quoted exactly:
> "Any health or safety notes you choose to share — for example allergies, medication, pregnancy, recent surgery, injuries or skin concerns. This is optional, used only to help us deliver your treatment safely, given with your consent, and you can ask us to remove it at any time."

Matches the plan's Copy rules (plan.md:34) point for point: optional / notes you choose to share / used to deliver treatment safely / given with consent / removable on request. **PASS.**

## 8. No statute citations in body copy

Ran `grep -E "Article|GDPR|Art\.|s\.164|Section [0-9]+\("` against the file — **0 matches**. Rights (section 7) and lawful bases (section 3) are described entirely in plain words ("necessary to fulfil our agreement with you," "your explicit permission," "our legitimate business interest") with no statutory citation anywhere in the body. **PASS.**

## 9. Transfers paragraph is swap-ready

Lines 156-161, quoted exactly:
> "Some of the providers above may process data outside the UK, including in the United States. Where that happens, the transfer is protected either by the UK Extension to the EU-US Data Privacy Framework or by UK-government-approved standard contractual terms, whichever applies to that provider."

Names both mechanisms ("or by UK-government-approved standard contractual terms") so the sentence does not collapse into nonsense if the DPF extension is struck down — the "or" clause remains true regardless. **PASS.**

## 10. ICO route present

Lines 196-206, quoted exactly:
> "If you're unhappy with how we've handled your personal information, please contact us first so we can try to put things right. If you're still not satisfied, you also have the right to complain to the Information Commissioner's Office (ICO), the UK's independent regulator for data protection: ico.org.uk · 0303 123 1113."

Raise-with-us-first, then ICO, with both `ico.org.uk` and `0303 123 1113` present. **PASS.**

## 11. Section 9 states no automated decision-making

Lines 211-214, quoted exactly:
> "We do not use automated decision-making or profiling to make decisions about you. Every booking is reviewed and handled by a member of our team."

**PASS.**

## 12. "Last updated" is a hardcoded string

Line 29: `const LAST_UPDATED = "9 August 2026";` — a literal string constant, not `new Date()` or any computed value. Rendered at line 45: `Last updated: {LAST_UPDATED}`. Confirmed by reading the full file — no `Date` import, no `new Date(` anywhere in the file. **PASS.** (Also matches today's date, 9 Aug 2026, per the session's currentDate context — consistent with this being the actual publish date.)

## 13. Plain-English read-aloud pass

Read the full body copy aloud-test style, section by section. Overall the page reads as plain English aimed at a non-specialist customer: short sentences, everyday words ("ask to see," "ask us to correct," "raise it with us first").

One phrase is denser than the rest and worth flagging:

> Section 5: "the transfer is protected either by the UK Extension to the EU-US Data Privacy Framework or by UK-government-approved standard contractual terms, whichever applies to that provider."

"UK Extension to the EU-US Data Privacy Framework" and "standard contractual terms" are technical terms of art that a non-specialist customer would not recognise. However, this is not an invented complexity — the plan explicitly requires this exact swap-ready phrasing (plan.md:34, brief.md:23) naming both mechanisms so the sentence survives a legal challenge to either one. Simplifying further would drop the legal precision the plan asked for. **NON-BLOCKING style note** — flagged, not a defect, since the brief mandates this specific construction.

No other sentence in the page requires specialist knowledge to follow.

---

## Summary

All 12 hard checks (1-2, 4-12) pass with quoted evidence; check 3 (corporate-controller consistency) passes on a targeted grep with zero residual individual/sole-trader phrasing found. One NON-BLOCKING style observation on check 13 (technical transfer-mechanism vocabulary), which is copy the plan explicitly mandated rather than an oversight.

No BLOCKING findings.

## Checks not run

- No live-render check (no dev-server fetch of `/privacy` was performed by this reviewer; content was verified by static reading of `page.tsx` plus the governing brief/plan/progress files, which is sufficient for the content + legal dimension assigned). The evidence screenshots (`privacy-375.png`, `privacy-1280.png`) already exist in the commit under review and were not independently re-rendered or re-diffed pixel-for-pixel by this reviewer — only their presence in `git show e70bef8 --stat` was confirmed.
- No lint/tsc/build/vitest run — out of scope for the content + legal dimension and banned tooling (`pnpm build`/`next build`) was avoided per the hard restrictions.
