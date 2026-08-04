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

## 4 — ▶ Position

**Not started.** Awaiting C-18 completion, plus ⏸ answers (a) and (c).
