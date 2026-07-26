# C-19 — Privacy policy page

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Scope discipline (user direction, verbatim intent):** simple. One new page, generic-but-custom to this site. **No changes to any other page.** No complaints machinery, no booking-form wiring, no footer edits — the page just exists at its URL; linking it up is left for later.
**Predecessors:**
- User direction 2026-07-16 + verified legal research (recorded in the plan-refinement session, 2026-07-16): UK GDPR Art 13 checklist current; health notes in bookings = special category data best covered by explicit consent (Art 9(2)(a)); DUAA s.164A complaints duty in force 19 June 2026 (notice mentions the right — the process itself is a business matter, out of scope); UK Extension to EU-US DPF valid (appeal pending — wording swap-ready); ICO requires concrete retention numbers; ICO fee Tier 1 £52 applies to the business (flagged, not code).
- Code audit 2026-07-16 (re-verified 2026-07-26 against the post-merge build — anchors hold): booking form collects name, email, phone, home address (+ access/parking notes), gender (client + participants), participant names, notes, per-participant notes (`participantNotes[]` — free text about other people, may include their health information) [C19-F6], **healthNotes**; processors in code: Supabase, Resend, Cloudflare, Sentry (PII-scrubbed per `sentry-scrubbing.ts`); Google Analytics is NOT yet in the codebase (0 grep hits) — planned, will be consent-gated once C-17/C-18 ship [C19-F5 / Decision D18]. No privacy page exists.
**Companion files:**
- Plan: `redesign/plans/C-phase/C-19-privacy-policy-page-plan.md`
- Progress: `redesign/per-page-progress/C-19-privacy-policy-page-progress.md` (filled during C-C)

---

## 1 — Scope

**One new file:** `src/app/(public)/privacy/page.tsx` — server-rendered, public design language (`--rahma-*` tokens, existing section/typography patterns), plain English, anchored section headings, a "Last updated" date. Content sections (all custom to this site's verified data flows):

1. **Who we are** — business name + contact email/phone (contact details confirmed with the user at impl).
2. **What we collect** — the booking-form fields as they actually are, including that notes may contain health information the customer chooses to share, and that participant notes (details about people other than the person booking) may include information about those third parties too [C19-F6].
3. **Why we use it** — plain-words purpose list with lawful bases: providing the booking/service (contract); health details (your explicit consent via the booking confirmation, withdrawable); booking/service emails (contract); analytics, if/when used on this site — always gated behind your cookie consent choice, with a dedicated cookies page linked here once published (conditional-safe wording, Decision D18 — true whether or not C-17/C-18 have shipped yet); keeping records for insurance/legal purposes (legitimate interest, named).
4. **Who helps us run the site** — named: Supabase (database), Resend (email delivery), Cloudflare (hosting), Sentry (error monitoring, personal data scrubbed), Google (analytics — only added to the site with your consent; not yet active as of this writing) [C19-F5 / Decision D18].
5. **Where data goes** — one short paragraph: some providers may process data in the US, protected by the UK Extension to the EU-US Data Privacy Framework or UK-approved contract terms (wording swap-ready if the framework changes).
6. **How long we keep it** — booking/treatment records 7 years after your last visit (insurance-standard default — user confirms/edits at impl); enquiries that don't become bookings ~12 months; analytics per Google's retention settings.
7. **Your rights** — see/correct/delete your data, restrict or object, data portability, withdraw consent any time; how to ask (email/phone).
8. **Concerns** — raise it with us first; you can also complain to the ICO (ico.org.uk · 0303 123 1113).
9. **No automated decision-making.**

**Explicit non-goals (user-locked):** no edits to the booking flow, footer, /cookies, layouts, or any other page; no complaint form; no content-module abstraction — the copy lives in the page file.

---

## 2 — Everything else

- **Migration:** none. **Packages:** none. **RBAC:** public page. **Bundle:** ~0 (server-rendered static content).
- **Sequencing:** fully independent — no hard dependency on any Band C plan. Completes the C-17/C-18/C-19 compliance trio but depends on neither; references to cookie consent are written conditional-safe (Decision D18, 2026-07-26) so they stay accurate whether C-17/C-18 land before or after C-19 (see §1 items 3-4).
- **Flagged business items (not code, recorded once):** ICO data protection fee (Tier 1 £52) applies to the business; retention number to be confirmed against the actual insurance policy; contact details to publish confirmed at impl.
- **Acceptance:** page renders at `/privacy` in the public design at 375 + 1280; all nine sections present and accurate to the audited data flows; plain-English (no statute citations in body copy); last-updated date present; zero changes outside the one new file (+ its test if trivial); static gates pass.

---

*End of C-19 brief. Plan: `redesign/plans/C-phase/C-19-privacy-policy-page-plan.md`.*
