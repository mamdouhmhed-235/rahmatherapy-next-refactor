# Item 2 deepening — Privacy policy retention section

**Plan section audited:** `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 168-201 ("ITEM 2 — Privacy policy: stop promising what the code doesn't do").
**Repo state:** HEAD `86b8b22` (branch `master`). `src/` verified byte-identical to the plan's `33f895f` baseline for the one file this item touches (see anchors below — every quoted line number matched on re-read).
**Read-only.** No files under `src/`, `scripts/`, `e2e/`, `supabase/` were modified. Only this report was written.

---

## 1. Exact current text of section 6, and heading ordinals

Read in full: `src/app/(public)/privacy/page.tsx` (222 lines).

```
165  <section id="how-long-we-keep-it" className="flex flex-col gap-3">
166    <h3 className={headingClass}>6. How long we keep it</h3>
167    <p className={bodyText}>
168      Our policy is to keep booking and treatment records for 7 years after your last
169      visit with us. If you make an enquiry that doesn&apos;t turn into a booking, we
170      keep it for around 12 months. Analytics information, where you&apos;ve given
171      consent for it, is kept according to Google&apos;s own retention settings.
172    </p>
173  </section>
```

The plan's cited range `src/app/(public)/privacy/page.tsx:165-173` is **exact** — the section's opening `<section>` tag is line 165, its closing `</section>` is line 173. No drift.

All nine headings and their anchors, confirmed by reading the whole file:

| # | Heading (exact text) | `id` anchor | Lines |
|---|---|---|---|
| 1 | "1. Who we are" | `who-we-are` | 50-69 |
| 2 | "2. What we collect" | `what-we-collect` | 71-101 |
| 3 | "3. Why we use it" | `why-we-use-it` | 103-132 |
| 4 | "4. Who helps us run the site" | `who-helps-us-run-the-site` | 134-153 |
| 5 | "5. Where your data goes" | `where-data-goes` | 155-163 |
| 6 | "6. How long we keep it" | `how-long-we-keep-it` | 165-173 |
| 7 | "7. Your rights" | `your-rights` | 175-193 |
| 8 | "8. Concerns and complaints" | `concerns` | 195-208 |
| 9 | "9. No automated decision-making" | `no-automated-decisions` | 210-216 |

Ordinals are **hardcoded literal text** inside each `<h3>` (`"6. How long we keep it"` etc.) — there is no shared numbering array or generated TOC component anywhere in the file. This confirms the plan's §2.3 warning: deleting section 6 outright, without manually retyping "6."→"7." etc. in the three headings below it, leaves the page reading "...5. Where your data goes" then jumping straight to "...7. Your rights."

---

## 2. Nothing in the codebase prunes/deletes bookings, clients or enquiries **by age** — verified, with an important correction to the plan's phrasing

**What I searched, and what I found:**

```
Grep "purge|prune|retention|cleanup|cron.*delete|scheduled.*delete" (-i) over src/   → 35 files, none implement age-based deletion
Grep "deleted_at|older than|olderThan|AGE\(|age >|retentionDays|RETENTION" (-i) over src/  → 123 files, all are soft-delete FLAG checks (`.is("deleted_at", null)`), none compute an age/interval to trigger a delete
Grep "\.delete\(\)" over src/  → 17 call sites (see table below)
Grep "\.delete\(\)" over src/app/admin/enquiries/  → 0 matches (no enquiries deletion of any kind exists)
Grep "delete" (-i) over src/app/api/cron/  → matches only test doubles and `deleted_at` filter reads; the four cron routes (extend-recurring-horizons, review-emails, scheduled-emails, booking-reminders) contain exactly one `.delete()` call total, and it is not age-based (see below)
```

**Every `.delete()` call site in `src/`, and what it actually does:**

| File:line | Table | Trigger | Age-based? |
|---|---|---|---|
| `src/app/api/cron/extend-recurring-horizons/route.ts:569-572` | `booking_assignments`, `booking_items`, `booking_participants`, `bookings` | `rollbackOccurrence()` — best-effort undo of a **half-written occurrence created moments earlier in the same run**, when a later step in that same series-extension fails | No — this is a transactional rollback, not retention pruning |
| `src/app/admin/clients/actions.ts:630` | `client_notes` (`is_sensitive=true` only) | `deleteClient()` — hard delete of a client's sensitive notes, called on **admin-initiated GDPR erasure** (`reason: "gdpr_erasure"`) or an admin's manual "Delete client" action | No — on-demand, permission-gated, one client at a time |
| `src/app/admin/availability/actions.ts`, `staff/actions.ts`, `staff/[staffId]/availability/actions.ts`, `email-templates/actions.ts`, `services/actions.ts`, `roles/actions.ts` | availability overrides, staff, email templates, services, roles | Admin CRUD "delete this row" actions | No — none touch bookings/clients/enquiries, none are age-triggered |

**Correction to the plan's wording.** §2.1 states "**Nothing in the codebase deletes anything.**" This is **not literally true** and an implementer who takes it at face value could be surprised mid-task: `deleteClient()` (`src/app/admin/clients/actions.ts:504-704`) is a real, wired-up, permission-gated GDPR-erasure path — soft-deletes the client, hard-deletes their sensitive notes (Article 17), cascade-cancels open bookings, and is invoked automatically from `src/app/admin/privacy/actions.ts:100-110` when a privacy manager marks a `deletion_review` request "Completed." A booking-rollback delete also exists in the recurring-horizons cron.

The plan's **substantive claim is correct and should be restated precisely**: **nothing in the codebase automatically prunes bookings, clients, or enquiries on a schedule tied to their age** (i.e., nothing implements "delete this booking because it is now 7 years old" or "delete this enquiry because it is now 12 months old"). All deletion that exists is either (a) an on-demand admin/GDPR action taken about one specific record, or (b) a same-transaction rollback of a row that was never successfully completed. Recommend the plan's §2.1 be reworded from "Nothing in the codebase deletes anything" to: *"Nothing in the codebase enforces the 7-year/12-month retention schedule the page describes — no scheduled job, cron route, or database trigger deletes a booking, client, or enquiry because of its age. (Deletion does exist elsewhere in the codebase — admin-initiated GDPR erasure via `deleteClient()`, and a same-run rollback in the recurring-horizons cron — but neither is age-triggered, and neither implements what section 6 promises.)"*

**Enquiries specifically:** `src/app/admin/enquiries/actions.ts` has status-update and create actions only; grepping the whole `enquiries/` directory for `.delete()` returns zero matches. Enquiries are never deleted by any code path, automated or manual. The 12-month figure for enquiries in section 6 is thus even less backed than the 7-year figure for bookings (which at least has an admin-triggered erasure path, however non-automatic).

---

## 3. No TOC or internal link references `#how-long-we-keep-it` — confirmed repo-wide

```
Grep "how-long-we-keep-it" (case-insensitive) over the whole repo (not just src/) → 7 files:
  redesign/plans/POST-BAND-C-FOLLOWUP-plan.md   (the plan itself, quoting the anchor)
  redesign/evidence/admin-contrast/surgical-review.md
  redesign/evidence/C-19/fix-round-reverify.md
  src/app/(public)/privacy/page.tsx              (the anchor's own definition, line 165)
  redesign/evidence/C-19/closeout-adversarial.md
  redesign/evidence/C-19/closeout-a11y-responsive.md
  redesign/evidence/C-19/closeout-content-legal.md
```

Every match outside `page.tsx` itself is a planning/evidence markdown doc discussing the section, not a live link. I additionally searched for any `href="#how-long...` or `privacy#` pattern site-wide — zero matches. The page itself (read in full above) has no in-page table of contents component; sections are laid out as a flat vertical list with no jump-nav. **The plan's claim holds exactly as stated.**

**Extra finding, relevant to blast radius:** I also checked what links *to* `/privacy/` at all. `src/content/site/footer.ts:26` — `legalLinks: []` — the footer's legal-links array is **currently empty**. `SiteFooter.tsx` renders `footerContent.legalLinks` via `.map()`, so today the public footer contains **no link to the privacy page whatsoever**. No other public page, layout, or component links to `/privacy/` either (`Grep "/privacy"` over `src/` turns up only the page's own `canonical` metadata value and unrelated `/admin/privacy` matches). There is no `sitemap.ts`/`sitemap.xml` in the repo. This means the live surface reachable from item 2's edit is smaller than "a public legal page normally implies" — it's an orphaned-but-indexable URL, reachable only by direct navigation or search-engine crawl of the URL itself, not by any in-site link. Worth a line in the plan so an implementer doesn't go hunting for a footer link to update.

---

## 4. Existing tests for this page — there are none

```
Glob "src/app/(public)/privacy/**"        → only page.tsx itself (no __tests__ dir, no *.test.tsx)
Glob "**/privacy*.test.*"                 → src/app/admin/privacy/__tests__/privacy-data.test.ts only (a DIFFERENT page — /admin/privacy, the operations queue — not this one)
Glob "src/app/(public)/**/__tests__/**"   → 0 results (the ENTIRE (public) route group has zero unit/component tests)
Glob "e2e/**/*.spec.ts"                   → 4 files total: admin-roles.spec.ts, booking-claiming.spec.ts, booking-public.spec.ts, admin-contrast.spec.ts
Grep "privacy|retention|7 year|12 month|how long we keep" (-i) over e2e/ → 0 hits in spec files (admin-contrast-helpers.ts references the ROUTE "/admin/privacy" for a contrast audit only, not text)
```

**The plan's §2.5 verification line — "the privacy page's existing tests still pass" — is vacuous: there is nothing to run.** No unit test exercises `src/app/(public)/privacy/page.tsx`, and no e2e spec asserts on its text or structure. This is a genuine gap the deepened plan must close (see §7 below — tests to add). Note this also means the whole `(public)` route group ships with zero component-level regression coverage; that's a pre-existing condition, not something item 2 caused, but item 2 is the first item in this follow-up plan to touch a public-page's body copy, so it's the right place to add the page's first test.

---

## 5. Does `/admin/privacy` genuinely offer the rights section 7 (and 2.2's rewrite) would point at?

**Yes — read `src/app/admin/privacy/page.tsx`, `src/app/admin/privacy/actions.ts`, `src/app/admin/privacy/data-export.ts`, and `src/app/admin/clients/actions.ts` in full.** This is real, wired, permission-gated functionality, not a stub:

- **Access (Article 15):** `generateClientDataExport()` (`src/app/admin/privacy/data-export.ts:54+`) builds a real JSON export of a client's row (minus record-keeping columns `id`/`created_at`/`updated_at`/`deleted_at`) plus their audit trail (capped at 50 rows), gated by `PERMISSIONS.MANAGE_PRIVACY_OPERATIONS`, triggered from the `/admin/privacy` queue's "Completed" flow for a `data_export` request.
- **Erasure ("ask us to delete your information"):** `updatePrivacyRequestStatus()` (`src/app/admin/privacy/actions.ts:26-127`) — when a `deletion_review` request is marked "Completed," it calls `deleteClient(clientId, "gdpr_erasure", ...)` (`src/app/admin/clients/actions.ts:504+`), which: cancels active recurring templates, cascade-cancels open bookings (completed bookings are deliberately never touched — "a tax + ICO record," per the code comment), **hard-deletes** sensitive client notes (the comment explicitly cites "UK GDPR Article 17 means special-category health data has to actually disappear"), then soft-deletes the client last. It is idempotent (a client already deleted returns `{success:true, alreadyDeleted:true}` and skips the cascade) and writes an `audit_logs` row either way.
- **Correction / sensitive-note review:** tracked as request types (`correction`, `sensitive_note_review`) through the same status queue (open → reviewing → completed/declined), though the code comment at `actions.ts:90-91` notes these two are "manual workflow, status only" — i.e., the admin UI tracks and closes the request, but doesn't itself mutate the underlying client record (an admin edits the client's fields separately via the client-detail page for corrections).
- **Restriction / objection:** no distinct request type or mechanism exists for these two rights specifically — they fold into the general "correction" / "deletion_review" workflow or are handled off-system. The privacy queue's four `REQUEST_TYPE_OPTIONS` are `data_export`, `correction`, `deletion_review`, `sensitive_note_review` only — there is no explicit "restrict processing" or "object to processing" request type.

**Verdict:** the *access*, *erasure*, and (partially) *correction* rights section 7 promises are genuinely operable via `/admin/privacy`. *Restriction* and *objection* are not separately tracked — a customer exercising those rights would presumably be logged under "correction" or handled outside the ticketed queue. This is a pre-existing gap in `/admin/privacy`'s scope, **not something item 2 needs to fix** (item 2 only touches section 6), but if the deepened plan wants to be precise, section 7's promise of those two rights is *less* verifiably backed by working code than access/erasure/correction are. I did not find this distinction called out anywhere in the plan; it's optional detail, not a blocker, since item 2 explicitly scopes to section 6 only.

---

## 6. Sections 7, 8, 9, 2, and 5 — do they need no change? Read all five, evidence below.

- **§7 "Your rights" (lines 175-193):** Read in full. Lists six rights (access, correction, erasure, restrict/object, portability, withdraw consent) and says "To use any of these rights, contact us using the details in 'Who we are' above." **No response-time commitment appears anywhere in the text** (no "within X days," no "1 month," no SLA language) — confirmed by reading every line. The plan's claim "§7 promises no response time" is **CONFIRMED**.
- **§9 "No automated decision-making" (lines 210-216):** Read in full: "We do not use automated decision-making or profiling to make decisions about you. Every booking is reviewed and handled by a member of our team." I spot-checked this against the booking lifecycle: bookings are created with `status: "pending"` (confirmed via wide use of the `"pending"` status literal across `src/app/admin/bookings/*` and its tests — e.g. `filterBookings.test.ts`, `BookingManagementForm.test.tsx`) and require a staff member to claim/assign them through permission-gated admin actions (`src/app/admin/bookings/actions.ts`). I did not trace every code path that could theoretically auto-confirm a booking, but no such path turned up in any of the admin/bookings, admin/availability, or cron files read during this audit, and the recurring-horizons cron only *extends a template's horizon* (creates future pending occurrences), it does not confirm or decide anything about a client. **CONFIRMED, with the caveat that I verified this by absence-of-evidence across the files I read, not by an exhaustive trace of every booking-status transition** — reasonable confidence, not proof of a negative.
- **§5 "Where your data goes" (lines 155-163):** Read in full — a single paragraph naming providers processing data outside the UK and the two lawful transfer mechanisms (UK Extension to the EU-US DPF, or UK-approved SCTs). This is a static factual/legal statement about which transfer mechanism applies to third-party processors; it does not reference retention duration or deletion at all, and item 2's edit (rewriting section 6's wording) has no textual or logical dependency on it. **CONFIRMED unaffected.**
- **§2 "What we collect" (lines 71-101):** Read in full — a bulleted list of collected fields (name/phone/email, address, booking-for-self/other/group + gender, treatments + date/time, treatment notes, optional health/safety notes, notes about other participants). I did a light spot-check (not the full bidirectional field mapping C-19 performed) confirming this list's shape is still plausible against the booking flow, and found corroborating evidence in `redesign/evidence/C-19/closeout-content-legal.md` (already-completed adversarial closeout, item 6-7) that this section was checked point-by-point against the brief at C-19 time. I did **not** re-run the full schema-vs-copy diff myself (out of scope for item 2, which only touches section 6) — flagging this as **UNVERIFIABLE-BY-ME-IN-FULL, but corroborated by prior closeout evidence**, not blindly trusted. One minor, non-blocking observation: the file's own top-of-file comment (`page.tsx:10-14`) cites `src/features/booking/schemas/booking-schema.ts` as one of the two schema sources for section 2's accuracy, but that file's actual exports are `bookingParticipantSchema`, `bookingLocationSchema`, `bookingDetailsSchema`, `bookingVisitSchema`, `bookingAcknowledgementSchema` — not literally `bookingRequestSchema` (the plan's §2.4 name). This is a pre-existing comment in the file, not something the plan asserts, and section 2 is explicitly out of scope for item 2 ("Do not touch it") — noting it only so a future item auditing section 2 doesn't get tripped up by the same drifted symbol name.

**Overall verdict on §2.4:** the plan's claim "nothing else on the page over-promises" is well-supported for §5, §7, §9 by direct reading, and reasonably supported for §2 by the C-19 closeout paper trail (not independently re-verified end-to-end by me). No new over-promise was found anywhere else in the page during this audit.

---

## 7. Does any other page repeat the 7-year / 12-month retention promise?

```
Grep "7 year|seven year|12 month|twelve month" (-i) over src/  → ONLY src/app/(public)/privacy/page.tsx:168,170 (2 matches, both already covered by item 2's edit)
Glob "src/app/(public)/**/page.tsx"  → home, services, services/[slug], areas, areas/[slug], about, faqs-aftercare, reviews, cookies, privacy — no "terms" page exists in the repo at all
Read src/app/(public)/cookies/page.tsx (first 40 lines + scanned) → discusses cookie-specific storage duration ("how long it lasts" per-cookie), not the client-record retention schedule; no "7 year"/"12 month" language
Grep "7 year|seven year|12 month|twelve month|retain.*year|keep.*year" (-i) over redesign/ (docs, not shipped copy) → 14 files, ALL are planning/brief/closeout markdown docs about C-19 or this follow-up item, none are marketing copy meant to ship
Glob design_handoff_public_pages/**  → 0 results (directory does not exist in this working tree — it's one of the standing-dirty DELETED paths per the handoff §6)
Glob design_handoff_area_pages/**    → exists (prototype .jsx/.css/.html files); none reference retention duration at all
```

**Confirmed: no other shipped page, prototype, or marketing copy repeats the 7-year/12-month figures.** The plan's implicit assumption — that editing `src/app/(public)/privacy/page.tsx` alone is sufficient, with no companion edit needed elsewhere — is **correct**. There is also no "terms and conditions" page in the codebase to cross-check (the site has privacy + cookies only).

---

## 8. `src/app/booking/manage/` — the known trap, checked explicitly

Per the assignment's standing instruction that `src/app/booking/manage/` sits outside both `(public)/` and `admin/` and is a known trap for shared-UI misses:

```
Grep "privacy|retention|7 year|12 month" (-i) over src/app/booking/manage/ → 0 matches
```

Nothing in `booking/manage/` references the privacy page, retention language, or any of the section-6 text. It renders shared booking-management UI primitives unrelated to the privacy policy's content. **Confirmed clean — item 2 has zero blast radius here.**

---

## 9. Blast radius summary

**Files to edit:** exactly one — `src/app/(public)/privacy/page.tsx` (the JSX inside the `<section id="how-long-we-keep-it">` block, lines 165-173; specifically the `<p>` at lines 167-172. If the Owner instead chooses the §2.3 deletion path, the ordinal literals in the three `<h3>` tags at lines 176 ("7."→"6."), 196 ("8."→"7."), 211 ("9."→"8.") also need editing, plus removal of the whole `<section id="how-long-we-keep-it">...</section>` block.)

**Callers / consumers:** none in code. No component imports or renders a subset of this page; it is a standalone route (`export default function PrivacyPolicyPage()`), and Next.js resolves it purely by file convention at `/privacy/`.

**Tests affected:** none exist today (see §4) — so nothing *breaks*, but nothing *catches a regression* either until a test is added.

**Snapshots affected:** none — no snapshot-testing setup targets this page (repo has no `.snap` files matching `privacy`; confirmed no snapshot test infrastructure references this component).

**Shared with the public/customer site:** the page **is** public-site content (`src/app/(public)/privacy/`), but nothing else in the public site currently links to it (footer's `legalLinks: []` is empty — see §3). `src/app/booking/manage/` (the known trap) does not reference it (§8 above).

**Proven NOT affected, with the commands used:**
- No TOC/internal link references the anchor being changed — `Grep "how-long-we-keep-it"` and `Grep "privacy#"` repo-wide (§3).
- No other shipped page repeats the retention figures needing a matching edit — `Grep "7 year|12 month"` over `src/` and `redesign/` (§7).
- `booking/manage/` (the known trap) has zero references — `Grep "privacy|retention"` scoped to that directory (§8).
- No e2e spec asserts on this page's text — `Grep` over `e2e/` for retention/heading strings (§4).
- Sections 2, 5, 7, 9 need no companion edit — read in full, evidence in §6.
- No sitemap file exists that would need a URL-list update — `Glob "src/app/**/sitemap*.ts"` and `Glob "public/sitemap*.xml"`, both empty.

---

## 10. Ordering relative to the other 7 items

Item 2 is fully independent. It touches only `src/app/(public)/privacy/page.tsx`, a file no other item in this plan's file-touch lists references (items 1/3/4/5/6/7/8 concern email cooldowns, override-list sorting, DB indexes, bundle tooling, adjustment-list counting, admin contrast, and the travel-charge model respectively — none overlap the public privacy page). **No prerequisite, no conflict, can run in any order or in parallel with any other item.**

---

## 11. Per-batch verification — exact commands, what must move, what must not

Run from the repo root (`C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`). Prefer PowerShell for the parenthesized path segment (Git Bash's leading-slash mangling isn't triggered by `(public)`, but PowerShell avoids any doubt per the environment gotchas).

1. **Typecheck — must stay at the documented baseline of 0.**
   ```
   npx tsc --noEmit
   ```
   MUST NOT move from 0 errors. A pure-JSX text edit inside an already-typed component should not change this at all; any change is a stop condition.

2. **No duration string survives (only if the Owner's rewrite, §2.2, is chosen — NOT applicable if §2.3 deletion is chosen, since the whole section is gone either way).**
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern "7 year", "12 month" -SimpleMatch
   ```
   MUST return **zero matches** after the edit (currently returns 2, at lines 168 and 170 — this is the baseline "before").

3. **Section numbering stays contiguous (both paths — rewrite keeps 1-9, deletion path renumbers to 1-8).**
   Manual check by rendering the page (dev server is Owner-run at `localhost:3000` — read-only `curl`/fetch is fine, do not restart it): confirm the visible heading sequence has no gap. Or, statically:
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern '<h3.*>\d\.' 
   ```
   MUST show an unbroken 1,2,3,4,5,6,7,8,9 sequence (rewrite path) or 1,2,3,4,5,6,7,8 with all four original "7/8/9" ordinals now reading "6/7/8" (deletion path). MUST NOT show any repeated or skipped ordinal.

4. **The anchor `id="how-long-we-keep-it"` — kept (rewrite path) or removed (deletion path, per §2.3's finding that nothing links to it).**
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern 'id="how-long-we-keep-it"' -SimpleMatch
   ```
   Rewrite path: MUST still show 1 match. Deletion path: MUST show 0 matches (and re-run the repo-wide anchor-reference check from §3 to reconfirm nothing broke — it shouldn't, since nothing referenced it before either).

5. **Vitest — baseline must not move (identity check, not just count, per the handoff's standing-facts rule).**
   ```
   npx vitest run
   ```
   Baseline is **5 failed / 2236 passed (2241)**, exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 (pre-existing, unrelated to this page). MUST stay exactly those 5 named failures — a different total that still sums to 5 is a FAIL per the handoff's "baselines by identity" rule. If a new test is added per §12 below, the passed count MUST increase by exactly the number of new test cases added, with 0 new failures.

6. **Lint — must not move.**
   ```
   pnpm lint
   ```
   Baseline: 59 errors / 7 warnings in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. `src/app/(public)/privacy/page.tsx` is not in that list today and MUST NOT appear in it after the edit.

---

## 12. Tests to add, named, with exact file paths

No test currently exists for this page (§4). Recommend adding one new file:

**New file:** `src/app/(public)/privacy/page.test.tsx`

Suggested test cases (Vitest + `@testing-library/react`, matching the pattern used elsewhere in the repo for server-component page rendering, e.g. how other `(public)` pages could be tested — none exist yet to copy from directly, so this establishes the pattern):

- `it("does not promise a specific retention duration in section 6")` — renders `<PrivacyPolicyPage />`, asserts the rendered text does NOT contain `/7 years?/i` or `/12 months?/i` (or whatever exact duration strings existed before the fix) within the `#how-long-we-keep-it` section (or asserts the section is absent, if the deletion path is chosen).
- `it("keeps section headings numbered contiguously with no gap")` — renders the page, collects all `<h3>` text matching `/^\d+\./`, asserts the extracted leading integers form an unbroken sequence starting at 1 (this test is valuable independent of which of §2.2/§2.3 is chosen, and guards against exactly the "5 → 7" gap bug the plan warns about).
- `it("keeps the how-long-we-keep-it anchor if section 6 exists")` — conditional on the rewrite path: asserts `getByRole` or a `document.getElementById("how-long-we-keep-it")` still resolves.
- `it("still describes retention by criteria, not a fixed date")` (rewrite path only) — asserts the section text contains language about "as long as necessary" / obligations-based wording rather than a bare duration, to lock in the GDPR Art.13(2)(a) criteria-based disclosure the plan intends.

This file goes under `src/**`, so it is automatically picked up by `vitest.config.ts`'s `include: ["src/**/*.test.{ts,tsx}", ...]` — confirmed by reading `vitest.config.ts` directly (§4 above already cites this).

No e2e test is proposed — the existing 4 specs are narrowly scoped (admin roles, booking claiming, booking public flow, admin contrast) and none touch static legal-page copy; adding page-text assertions to Playwright would be disproportionate to a wording fix, and the new Vitest test above is the right level for a static-content regression guard.

---

## 13. Stop conditions

An implementer should halt and ask the Owner, rather than proceed, if any of the following turn up:

1. **The Owner has not yet confirmed §2.2 (rewrite) vs §2.3 (delete + renumber).** The plan itself frames this as still-open ("If the Owner insists on deletion instead…") — do not guess; the two paths produce materially different diffs (one keeps 9 sections, the other renumbers to 8 and removes an anchor).
2. **Any new duration or schedule language creeps back in during drafting** — e.g. a rewrite that says "we typically keep records for a few years" still names an implicit figure. The GDPR Art.13(2)(a) criteria-based approach the plan recommends means describing the *basis* (legal/insurance/accounting obligation, care needs) not a number, however soft.
3. **`npx tsc --noEmit` moves off 0**, or **`npx vitest run`'s failing set changes identity** (different 5 tests, or a different count) — this is a pure-copy change; any code-level ripple is unexpected and should be investigated before proceeding, not overwritten.
4. **A footer/nav link to `/privacy/` is discovered that this audit missed** (re-run `Grep "/privacy"` over `src/` before starting, since `footer.ts`'s `legalLinks: []` could change between this audit and implementation) — if found, factor whether the new copy still reads correctly in that link's context.
5. **The implementer is tempted to also fix section 2's field-mapping or section 7's missing response-time commitment** — both are out of scope per the plan's explicit "Change section 6 only" (line 196) and this audit's §6 findings; flag them as separate follow-ups instead of scope-creeping into item 2.

---

## 14. Rollback

This is a pure content edit to a single tracked file with no migration, no data write, and no irreversible side effect. Rollback is a plain `git diff`/`git checkout -- src/app/(public)/privacy/page.tsx` on that one file (implementer's own change, not a destructive operation against the pre-existing dirty tree — do not run a bare `git checkout .` or any path that touches other dirty files per the standing rule in the handoff §6). No rollback plan beyond "revert the file" is needed since nothing else is touched, no DB row is written, and no cache/tag invalidation occurs for a static public page's JSX text (this page is not behind `revalidatePath`/`updateTag` — it's plain server-rendered content, confirmed by the absence of any cache-tag import in `page.tsx`).

---

## 15. Open items for the deepened plan to fold in

- Reword §2.1's "Nothing in the codebase deletes anything" to the more precise age-based-pruning claim (§2 above) — the current wording is a plan-accuracy issue an implementer could stumble on if they go looking and find `deleteClient()`.
- Add a note that the public footer currently has no link to `/privacy/` at all (`legalLinks: []`) — not a defect to fix under item 2, but worth flagging so nobody assumes there's a nav element to sanity-check post-edit.
- Add the new test file (§12) to item 2's file-touch list — currently the plan's verification (§2.5) implies existing tests will guard the change, but none exist.
- Optional, lower priority: note that §7's "restriction"/"objection" rights aren't separately tracked in `/admin/privacy`'s four request types (§5 above) — true today, out of scope for item 2, but useful context if a future item deepens section 7.
