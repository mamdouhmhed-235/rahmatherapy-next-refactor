## ITEM 2 — Privacy policy: stop promising what the code doesn't do

### 2.1 The problem

`src/app/(public)/privacy/page.tsx`, section **"6. How long we keep it"** — symbol: the `<section id="how-long-we-keep-it">` block, currently at lines 165-173 (opening tag 165, closing tag 173, body `<p>` at 167-172) — RE-LOCATE BY SYMBOL and report drift rather than trusting these numbers. It states booking and treatment records are kept **7 years**, enquiries **around 12 months**, and (a third sentence, easy to overlook) that analytics data is "kept according to Google's own retention settings."

**Corrected claim** (the plan previously said "Nothing in the codebase deletes anything" — that sentence is not literally true and should not be reused): nothing in the codebase enforces the 7-year/12-month schedule this section describes. No scheduled job, cron route, or database trigger deletes a booking, client, or enquiry because of its age. Deletion does exist elsewhere in the codebase, but none of it is age-triggered:

- `deleteClient()` (`src/app/admin/clients/actions.ts:504-704`) — an on-demand, permission-gated GDPR-erasure path. Hard-deletes sensitive client notes (the code's own comment cites Article 17), cascade-cancels open bookings, soft-deletes the client, is idempotent, and is invoked from `updatePrivacyRequestStatus()` (`src/app/admin/privacy/actions.ts:26-127`) when a `deletion_review` request is marked "Completed."
- `rollbackOccurrence()` (`src/app/api/cron/extend-recurring-horizons/route.ts:564-574`) — a same-run, best-effort rollback of a half-written occurrence when a later step in the same series-extension fails. Not retention pruning.
- The remaining `.delete()` call sites (17 total in `src/`, re-confirmed by grep) are ordinary admin CRUD on availability overrides, staff, email templates, services, and roles — none touch bookings, clients, or enquiries, none are age-triggered.

Enquiries specifically are never deleted by any code path — `Grep "\.delete\(\)"` scoped to `src/app/admin/enquiries/` returns zero matches. The 12-month figure is thus even less backed than the 7-year figure, which at least has an admin-triggered (not automatic) erasure path behind it.

### 2.2 Recommended change — rewrite generically, do not delete the section

The Owner said "delete that section." **Rewrite it instead** — here is the reason: UK GDPR Article 13(2)(a) expects a privacy notice to state either a retention period **or the criteria used to determine it**. Deleting the section outright removes a disclosure the page is expected to carry, trading an over-promise for an omission. A criteria-based statement satisfies both the Owner's instruction ("generic, not so specific in promising anything") and the requirement.

**Rewrite the section's `<p>` body** to say, in the page's existing plain-English voice and without naming any duration:
- records are kept only as long as necessary for the care provided and for legal, insurance and accounting obligations;
- how long that is depends on the type of record and the obligation that applies;
- anyone can ask what is held about them, or ask for it to be deleted, using the contact details in section 1 — which points at rights the page already describes and which are genuinely operable via `/admin/privacy` (see 2.4).

**The third sentence — analytics retention via Google's own settings — must be explicitly kept or explicitly dropped, not silently lost.** It names no banned duration string, so a verification pass that only greps for `7 year`/`12 month` will pass either way and would not catch an accidental drop. Default: **keep it, unedited**, appended after the rewritten criteria-based sentences — it describes a real, separate consent-gated mechanism (Google's own retention settings) rather than a promise this codebase would need to enforce, so it does not carry the same over-promise problem as the first two sentences. If the Owner wants it removed too, that is a second, separate decision to make explicitly — do not fold it into "delete the section" without asking, since it is truthful as written.

Keep the heading text ordinal ("6."), the `id="how-long-we-keep-it"` anchor, and the section number.

### 2.3 If the Owner insists on deletion instead

Then the sections **must be renumbered**. The heading ordinals are hardcoded literal text inside each `<h3>` — `"7. Your rights"` (line 176 today), `"8. Concerns and complaints"` (line 196), `"9. No automated decision-making"` (line 211) — there is no shared numbering array or generated TOC component anywhere in the file, so each must be retyped by hand to "6.", "7.", "8." respectively. Removing section 6 without renumbering leaves the page jumping "...5. Where your data goes" straight to "...7. Your rights."

Verified: **no table of contents or internal link anywhere in the repo references `#how-long-we-keep-it`** (repo-wide case-insensitive grep, 7 matches total, all either the anchor's own definition or planning/evidence markdown — none a live `href`). The anchor can be removed safely if this path is chosen; only the visible numbering matters for correctness.

**Which path to take is the one thing left open here** — the plan text above still frames it as "if the Owner insists," and nothing in this session's decisions has resolved it. An implementer must get an explicit answer (§2.2 rewrite vs. §2.3 delete-and-renumber) before starting; see stop condition 1 in §2.9.

### 2.4 Nothing else on the page over-promises — checked, not assumed

- **§2 "What we collect"** (lines 71-101): out of scope, do not touch. One drift note for whoever next audits this section: the file's own top-of-file comment (lines 10-14) cites `src/features/booking/schemas/booking-schema.ts` as a source of truth, but that file's actual exports are `bookingParticipantSchema`, `bookingLocationSchema`, `bookingDetailsSchema`, `bookingVisitSchema`, `bookingAcknowledgementSchema` — there is no `bookingRequestSchema` export (the plan previously named one that doesn't exist). This is a pre-existing comment drift, not something item 2's edit touches or fixes.
- **§5 "Where your data goes"** (lines 155-163): a static factual statement about which of two transfer mechanisms applies to third-party processors. No retention or deletion language. Confirmed unaffected.
- **§7 "Your rights"** (lines 175-193): read in full — lists six rights (access, correction, erasure, restriction/objection, portability, withdraw consent) and points readers at the contact details in section 1. No response-time commitment appears anywhere ("within X days," "1 month," etc.) — confirmed by reading every line.
- **§9 "No automated decision-making"** (lines 210-216): "We do not use automated decision-making or profiling... every booking is reviewed and handled by a member of our team." Consistent with bookings being created `pending` and requiring staff to claim/assign them through permission-gated admin actions — checked by reading `src/app/admin/bookings/actions.ts` and the admin/bookings test files that assert on the `pending` status. This was checked by absence-of-evidence across the files read, not an exhaustive trace of every status transition — reasonable confidence, not a formal proof.

**Change section 6 only.**

### 2.5 Full blast radius

**Files to edit:** exactly one — `src/app/(public)/privacy/page.tsx`. Rewrite path (§2.2): only the `<p>` inside the `how-long-we-keep-it` section. Deletion path (§2.3): that whole `<section>...</section>` block removed, plus the three ordinal literals in the `<h3>` tags immediately below it (currently reading "7.", "8.", "9.").

**Callers / consumers in code: none.** This is a standalone Next.js route (`export default function PrivacyPolicyPage()`), resolved purely by file convention at `/privacy/`. No component imports or renders any part of it.

**Shared with the public/customer site:** the page **is** public-site content, but nothing else in the public site currently links to it — `src/content/site/footer.ts:26` reads `legalLinks: []`, and `SiteFooter.tsx` renders that array via `.map()`, so the live footer today contains **zero legal links, including to this page**. No other public page, layout, or component links to `/privacy/` (confirmed: `Grep "/privacy"` over `src/` returns only this page's own `canonical` metadata value and unrelated `/admin/privacy` matches). This means the page is reachable only by direct navigation or search-engine crawl of the URL, not by any in-site link — an implementer should not go looking for a nav/footer element to update; there isn't one.

**`src/app/booking/manage/` — the known cross-cutting trap, checked by name:** `Grep "privacy|retention|7 year|12 month"` (case-insensitive) scoped to `src/app/booking/manage/` returns **zero matches**. Confirmed clean — item 2 has no blast radius there.

**No other page repeats the figures being edited:** `Grep "7 year|seven year|12 month|twelve month"` (case-insensitive) over `src/` returns matches **only** at `src/app/(public)/privacy/page.tsx:168,170` — the two lines item 2 edits. `src/app/(public)/cookies/page.tsx` discusses per-cookie storage duration, a different and unrelated disclosure, with no "7 year"/"12 month" language. There is no "terms and conditions" page anywhere in the repo to cross-check (site has privacy + cookies only). No design-handoff prototype file references retention duration either.

**Tests affected: none exist today.** `Glob "src/app/(public)/**/__tests__/**"` returns 0 results — the entire `(public)` route group has zero unit/component tests. `Glob "e2e/**/*.spec.ts"` returns exactly 4 files (`admin-roles.spec.ts`, `booking-claiming.spec.ts`, `booking-public.spec.ts`, `admin-contrast.spec.ts`), none of which assert on this page's text (confirmed by grepping those specs for retention/privacy strings). This means the plan's old verification line "the privacy page's existing tests still pass" was **false** — there was nothing to run. §2.7 below adds the page's first test.

**Snapshots affected: none.** No `.snap` file in the repo matches "privacy"; there is no snapshot-testing infrastructure targeting this component.

**No sitemap file exists that would need a URL-list update** — `Glob "src/app/**/sitemap*.ts"` and `Glob "public/sitemap*.xml"` both return 0 results.

**Proven NOT affected, with the exact commands used:**
- No TOC/internal link references the anchor: `Grep "how-long-we-keep-it"` (case-insensitive, whole repo) — 7 matches, all either the anchor's own definition in `page.tsx` or planning/evidence markdown, zero live `href`s. Also checked `Grep "privacy#"` repo-wide — zero matches.
- No other shipped page repeats the retention figures: `Grep "7 year|seven year|12 month|twelve month"` over `src/` — 2 matches, both inside the section being edited.
- `booking/manage/` has zero references: `Grep "privacy|retention|7 year|12 month"` scoped to `src/app/booking/manage/` — zero matches.
- No e2e spec asserts on this page's text: `Grep` over `e2e/` for retention/heading strings — zero hits in spec files.
- Sections 2, 5, 7, 9 need no companion edit — read in full, evidence in §2.4.
- No sitemap file exists — `Glob` checks above, both empty.
- No footer/nav link needs updating — `src/content/site/footer.ts:26` is `legalLinks: []`; `Grep "/privacy"` over `src/` finds no other referencing component.

### 2.6 Ordering relative to the other items

Item 2 is fully independent. `src/app/(public)/privacy/page.tsx` appears in no other item's file-touch list in this plan (items 1, 3, 4, 5, 6, 7, 8 concern email cooldowns, override-list sorting, DB indexes, bundle tooling, adjustment-list counting, admin contrast, and the travel-charge model respectively). No prerequisite, no conflict — can run in any order or in parallel with any other item.

### 2.7 Tests to add, named, with exact file paths

No test currently exists for this page. Add one new file, following this repo's page-test convention (page/data/action modules get `__tests__/<name>.test.ts` beside them — here, a page component test, matching the sibling-test convention used for components elsewhere):

**New file:** `src/app/(public)/privacy/page.test.tsx`

- `it("does not promise a specific retention duration in section 6")` — render `<PrivacyPolicyPage />`, assert the rendered text does not match `/7 years?/i` or `/12 months?/i` within the `#how-long-we-keep-it` section (rewrite path), or that the section is absent entirely (deletion path).
- `it("keeps the analytics retention sentence in section 6")` — rewrite path only; asserts the rendered section text still contains the Google-analytics-retention sentence, so a future edit cannot silently drop it the way nothing currently guards against.
- `it("keeps section headings numbered contiguously with no gap")` — render the page, collect all `<h3>` text matching `/^\d+\./`, assert the extracted leading integers form an unbroken sequence starting at 1. This guards directly against the "5 → 7" gap the deletion path risks, and is valuable regardless of which path (§2.2 or §2.3) is chosen.
- `it("keeps the how-long-we-keep-it anchor")` — rewrite path only; asserts `document.getElementById("how-long-we-keep-it")` (or equivalent query) still resolves.
- `it("describes retention by criteria, not a fixed date")` — rewrite path only; asserts the section text contains obligations-based wording (e.g. matches `/as long as necessary/i` or similar) rather than a bare duration, to lock in the Article 13(2)(a) criteria-based disclosure.

This file lives under `src/**`, so `vitest.config.ts`'s `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]` picks it up automatically — no config change needed.

No e2e test is proposed. The 4 existing specs are narrowly scoped (admin roles, booking claiming, booking public flow, admin contrast) and none touch static legal-page copy; adding Playwright coverage for a wording fix would be disproportionate. The new Vitest test above is the right level.

### 2.8 Per-batch verification — exact commands, what must move, what must not

Run from the repo root. Prefer PowerShell for the parenthesized path segment.

1. **Typecheck — must stay at 0.**
   ```
   npx tsc --noEmit
   ```
   A pure-JSX text edit inside an already-typed component should not move this at all. Any change is a stop condition.

2. **No duration string survives — rewrite path only** (not applicable under the deletion path, since the whole section is gone either way).
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern "7 year", "12 month" -SimpleMatch
   ```
   MUST return zero matches after the edit (currently returns 2, at lines 168 and 170 — this is the "before" baseline). This check alone does **not** confirm the analytics sentence survived — that is checked separately by the new test in §2.7, since no banned-string grep can catch a silent deletion of untouched-looking text.

3. **Section numbering stays contiguous** (both paths — rewrite keeps 1-9, deletion renumbers to 1-8).
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern '<h3.*>\d\.'
   ```
   MUST show an unbroken 1,2,3,4,5,6,7,8,9 sequence (rewrite path) or 1,2,3,4,5,6,7,8 with the original "7/8/9" ordinals now reading "6/7/8" (deletion path). MUST NOT show any repeated or skipped ordinal.

4. **The anchor `id="how-long-we-keep-it"`** — kept (rewrite) or removed (deletion, since §2.3 confirmed nothing links to it).
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern 'id="how-long-we-keep-it"' -SimpleMatch
   ```
   Rewrite path: MUST still show 1 match. Deletion path: MUST show 0 matches.

5. **Vitest — baseline must not move (identity, not just count).**
   ```
   npx vitest run
   ```
   Baseline is 5 failed / 2236 passed (2241): `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, both pre-existing and unrelated to this page. MUST stay exactly those 5 named failures. After adding the new test file from §2.7 (5 test cases on the rewrite path, or fewer if the deletion path drops the analytics/anchor/criteria-wording cases), the passed count MUST increase by exactly the number of new cases added, with 0 new failures. A 6th failure may appear intermittently — that is the documented flake in `ManualBookingForm.test.tsx`'s "malformed email" case; confirm it by re-running that file alone (`npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx` → must show exactly 3 failed / 33 passed) before treating any extra failure as real.

6. **Lint — must not move.**
   ```
   pnpm lint
   ```
   Baseline: 59 errors / 7 warnings across exactly six files (see the handoff's lint identity list). `src/app/(public)/privacy/page.tsx` and the new `page.test.tsx` are not in that list today and MUST NOT appear in it after the edit.

### 2.9 Stop conditions

1. **The Owner has not confirmed §2.2 (rewrite) vs §2.3 (delete + renumber).** This is the one genuinely open decision in this section — do not guess; the two paths produce materially different diffs (9 sections with an anchor kept, vs. 8 sections with the anchor and three ordinals retyped).
2. **Whether the analytics-retention sentence (§2.2, third original sentence) survives the rewrite is undecided beyond this draft's default of "keep it."** If the Owner wants it dropped too, get that as an explicit second answer — do not fold it silently into "rewrite section 6."
3. **Any new duration or schedule language creeps back in during drafting** — e.g., "we typically keep records for a few years" still names an implicit figure. The Article 13(2)(a) criteria-based approach means describing the *basis* (legal/insurance/accounting obligation, care needs), not a number, however soft.
4. **`npx tsc --noEmit` moves off 0, or `npx vitest run`'s failing set changes identity** (different 5 tests, or a different count) beyond the expected new-test additions. This is a pure-copy-plus-one-new-test-file change; any other ripple is unexpected and must be investigated before proceeding.
5. **A footer/nav link to `/privacy/` is discovered that this audit missed** — re-run `Grep "/privacy"` over `src/` before starting, since `footer.ts`'s `legalLinks: []` could change between this draft and implementation. If a link now exists, check the new copy still reads correctly in that link's context.
6. **The implementer is tempted to also fix section 2's field-mapping drift (the `bookingRequestSchema` comment, §2.4) or section 7's missing response-time commitment.** Both are out of scope — "Change section 6 only." Flag them as separate follow-ups.

### 2.10 Rollback

Nothing here is irreversible. This is a pure content edit to one tracked file (`src/app/(public)/privacy/page.tsx`) plus one new test file, no migration, no data write, no cache/tag invalidation (the page is plain server-rendered content with no `revalidatePath`/`updateTag` call). Rollback is `git diff` / `git checkout -- src/app/(public)/privacy/page.tsx` targeting only that file and the new test file — never a bare `git checkout .` or any command touching the rest of the intentionally-dirty tree.

### 2.11 One more content-integrity note

`LAST_UPDATED` (`src/app/(public)/privacy/page.tsx:29`, rendered at line 45, currently `"9 August 2026"`) is not wired to anything automatic — it's a hardcoded string. Editing the substantive legal text of section 6 without bumping this date is a real content-integrity gap for a privacy policy (the page would claim to be current as of a date before the actual change). Update `LAST_UPDATED` to the date the edit ships, as part of this item's diff, regardless of which path (§2.2 or §2.3) is chosen.
