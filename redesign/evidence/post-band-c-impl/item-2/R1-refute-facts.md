# R1 — Adversarial refutation of A-deletion-paths.md and B-blast-radius.md

Role: adversarial verifier. Default posture is REFUTE; every point below was
re-run myself (commands and raw output shown), not trusted from the reports.
Repo: `rahmatherapy-next-refactor`, Windows, ripgrep via the Grep tool / `rg`
in Git Bash. Read-only against `src/`, `scripts/`, `e2e/`, `supabase/`; this
file is the only write.

Verdict key: **CONFIRM** = re-run reproduces the claim as stated. **REFUTE** =
re-run contradicts the claim, in whole or in a specific sub-part. Where a
claim's overall conclusion survives but a specific evidentiary sub-fact
(a count, a completeness statement) does not, I mark that sub-fact REFUTE and
say explicitly whether it changes the conclusion.

---

## Part A — A-deletion-paths.md (deletion paths / age-triggered deletion)

### A1. "No cron/trigger/function deletes rows based on a date/age comparison" — CONFIRM

Read all 4 files in `src/app/api/cron/**` in full myself:
`booking-reminders/route.ts`, `scheduled-emails/route.ts`,
`review-emails/route.ts`, `extend-recurring-horizons/route.ts`. Zero
`.delete()` calls in the first three. `extend-recurring-horizons/route.ts`
has exactly 4, all inside `rollbackOccurrence()` (lines 569–573), which is
called only from three failure branches inside `extendTemplate()`
(participant-insert failure, item-insert failure, assignment-insert failure)
— i.e. undo-on-mid-transaction-failure, keyed on `booking_id`/`id` equality,
never on age. Confirmed by reading the function bodies directly, not
trusting the report's line numbers (their 565-574 vs. my re-read 569-573 —
trivial off-by-a-few from comment lines, substance identical).

`wrangler.jsonc` triggers block re-read in full: exactly 4 cron expressions
(`0 8 * * *`, `* * * * *`, `*/15 * * * *`, `0 3 * * *`), each dispatching to
one of the 4 routes above via `WORKER_SELF_REFERENCE`. No fifth trigger, no
external scheduler config anywhere else in the repo:

```
$ find . -iname "vercel.json" -not -path "*/node_modules/*"
(none)
$ find . -iname "wrangler*" -not -path "*/node_modules/*"
./wrangler.jsonc
$ find .github -type f
(no .github directory present)
```

Also checked `supabase/config.toml` for a pg_cron/schedule block and
`supabase/functions/` for Edge Functions that could carry an independent
scheduled deletion — neither exists:

```
$ find supabase -maxdepth 1 -type d
supabase
supabase/migrations
supabase/verification
$ rg -i "cron|schedule" supabase/config.toml
(no output — file absent / no matches)
```

Grep for `pg_cron|cron.schedule|CREATE TRIGGER|date_trunc|now() -|- interval`
across `supabase/migrations/**` (case-insensitive) returns 9 files, all
`updated_at` triggers or the C-01 `bookings_completed_at_trigger` (sets
`completed_at` on status change) — no delete-by-age trigger. Matches the
report's characterization.

**Extra check the report didn't run, which I did**: `scripts/seed-e2e-staff.mjs`
(outside `src/`, so correctly outside the report's stated scope) contains a
`cleanup` mode with 10 `.delete()` calls, e.g. `bookings.delete().in("id",
bookingIds)`. This is NOT age-triggered — it targets a fixed, hardcoded list
of 7 `phase10.*@example.test` seed users by explicit email/id match, needs a
local `.env` service-role key, and is invoked manually
(`npm run test:e2e:cleanup` / `node scripts/seed-e2e-staff.mjs cleanup`), not
by any scheduler. Confirms the "no age-based deletion" conclusion rather than
threatening it, but the report never mentioned it exists — noting it here so
nobody later "discovers" it and treats it as new information.

### A2. "17 `.delete()` call sites exist in `src/`" — CONFIRM

```
$ rg -n "\.delete\(\)" src -g "*.ts" -g "*.tsx" | wc -l
17
```

Full listing reproduced independently matches the report's classification:
4 in `extend-recurring-horizons`'s `rollbackOccurrence` (failure-rollback,
not age), 13 across 7 admin `actions.ts` files + `roles/actions.ts` — every
site keyed on an explicit `.eq(...)`/id/date supplied by the caller. Also
confirmed **zero** age-comparison guard follows any of the 17 calls:

```
$ rg -n -A5 "\.delete\(\)" src -g "*.ts" -g "*.tsx" | rg -i "\.lt\(|\.lte\(|\.gt\(|\.gte\("
(no output)
```

### A3. "Only DELETE FROM statements in `supabase/migrations/**` are lines 294
and 377 of `20260809120000_c14_save_availability_day.sql`" — **REFUTE (the
completeness sub-claim)**, conclusion unaffected

```
$ rg -n -i "DELETE FROM|delete from" supabase/migrations
supabase\migrations\20260509143000_granular_rbac_consolidation.sql:193:delete from public.role_permissions rp
supabase\migrations\20260509143000_granular_rbac_consolidation.sql:493:delete from public.staff_permission_overrides
supabase\migrations\20260509143000_granular_rbac_consolidation.sql:513:delete from public.role_permissions
supabase\migrations\20260509143000_granular_rbac_consolidation.sql:533:delete from public.permissions
supabase\migrations\20260809120000_c14_save_availability_day.sql:294:  DELETE FROM public.availability_rules
supabase\migrations\20260809120000_c14_save_availability_day.sql:377:  DELETE FROM public.staff_availability_rules
```

There are **6** `DELETE FROM` statements across **2** files, not 2 statements
in 1 file. I read the 4 I hadn't seen (lines 180–220 and 480–540 of
`20260509143000_granular_rbac_consolidation.sql`): all 4 are a one-time RBAC
data migration that deletes rows by an explicit, hardcoded permission-name
list (`where permissions.name in ('view_reports', 'view_clients', ...)`) or
an explicit role-name list (`where r.name in ('Owner', 'Admin', ...)`) — a
static cleanup that runs once when this migration is applied, not a
recurring function and not age-gated. So the underlying claim this evidence
was supporting ("nothing deletes by age") still holds — but the specific
sentence "the only DELETE FROM statements ... are lines 294 and 377" is
factually wrong as written and should not be re-quoted as a completeness
claim in any follow-on doc.

### A4. Retention/purge/expiry grep counts ("43 hits" in `src/`, "6 hits" in
`supabase/`) — **REFUTE (the counts)**, substance of the finding unaffected

```
$ rg -i "retention|purge|prune|expire|expiry|pg_cron" src -g "*.ts" -g "*.tsx" | wc -l
198
$ rg -i "retention|purge|prune|expire|expiry|pg_cron" supabase | wc -l
11
```

Actual counts are 198 (src) and 11 (supabase), not 43 and 6 — off by roughly
4.6x and 1.8x. I did not stop at recounting; I read every `retention` and
`purge` hit (the two rarer, more load-bearing terms) to check whether the
extra volume hides something the original 43-hit sample missed:

- Every `retention` hit in `src/` (39 lines) is the admin reports/dashboard
  "client retention rate" business KPI (`getRetentionRate`,
  `RetentionRate` interface, `performance-helpers.ts` KPI tile) — a
  returning-customer metric, unrelated to data-retention duration.
- The only `purge` hits are a client-side localStorage legacy-key purge in
  `BookingsChrome.tsx` / `savedViews.test.ts` (an old saved-view cache key
  in the browser), not a database row purge.
- `prune` — zero hits anywhere in `src/`.
- The bulk of the 198→43 gap is `expire`/`expiry`, appearing in 34 files —
  I listed all 34 and cross-checked them against the 8 files that contain
  `.delete()` calls (staff/availability, admin/availability, staff, roles,
  services, clients, email-templates, extend-recurring-horizons cron): zero
  overlap. Every `expire`/`expiry` hit is a token/TTL/session-cookie
  concern (password-reset tokens, account-password-requests, manage-token,
  consent-cookie freshness, the booking-cancellation "28 days" restore
  window) — none of which deletes anything.

So: the report's raw counts were wrong (likely a stale/truncated grep run,
or scoped differently than stated), but re-reading the full, correct set of
matches reaches the same conclusion the report claimed — no hidden
age-triggered deletion inside the extra ~155 hits I additionally checked
that the report didn't account for.

### A5. `deleteClient()` — permission gate, hard-delete of sensitive notes,
call site from `updatePrivacyRequestStatus()` — CONFIRM, verbatim

Re-read both files in full.

- `deleteClient()` at `src/app/admin/clients/actions.ts:504` (report says
  504 — matches exactly).
- Permission gate at lines 516–523: `gdpr_erasure` requires
  `getClientDataAccess(profile, ...).canManagePrivacyOperations`; otherwise
  `canManageAllClients(profile) && canManageClientDestructiveOps(profile)`;
  returns `{ success: false, error: "Insufficient permissions." }` — matches.
- Hard delete at lines 628–633: `client_notes.delete().eq("client_id",
  clientId).eq("is_sensitive", true).select("id")`, preceded by the comment
  "Hard delete, not soft: UK GDPR Article 17 means special-category health
  data has to actually disappear." at lines 626–627 — matches exactly,
  including the comment text.
- Client row soft-deleted last, lines 648–651 (`clients.update({ deleted_at:
  deletedAt })`) — matches.
- Completed bookings excluded from the cascade-cancel via
  `.not("status", "in", "(cancelled,completed)")` at line 605, with an
  explicit comment at 586–588 — matches.
- `src/app/admin/privacy/actions.ts`: import of `deleteClient` at line 8,
  `updatePrivacyRequestStatus()` defined at line 26, call site at lines
  100–105, gated on `status === "completed" && before.request_type ===
  "deletion_review"` at lines 93–96 — matches exactly, line-for-line.

### A6. Erasure mechanism is staff-mediated only, no public self-service
route — CONFIRM

```
$ find "src/app/(public)" -type f | sort
about, areas/[slug], areas, cookies (2 files), faqs-aftercare, home, layout,
page, privacy, reviews, services (2 files)  — 13 files total, all content pages
$ find src/app/api -type f | sort
admin/availability, availability (x2), bookings (x4), consent-events (x2),
cron (x7)  — 19 files total, no privacy/enquiry-submission endpoint
$ rg "client_privacy_requests" src -l
8 files, all under src/app/admin/** (clients, privacy) — zero under
(public)/** or api/**
```

I additionally checked `src/app/booking/**` (a *third*, separate top-level
route group the report didn't explicitly name — `src/app/booking/manage/`
etc. sit outside `(public)` but are equally public-facing) for any privacy
writes or references:

```
$ rg -i "privacy" src/app/booking -l
(no files found)
$ rg "client_privacy_requests" src/app/booking -l
(no files found)
```

Confirms and slightly strengthens the report's claim: there is no intake
path anywhere in the public surface (including the one they didn't
explicitly search). `ClientDetailForms.tsx` does import and call
`createClientPrivacyRequest` at lines 8 and 202 as claimed. Also confirmed
zero "privacy" references anywhere under `src/lib/email/**` (18 files
listed, grepped, zero hits) — no email template links to a privacy request
flow or the privacy page either.

### A7. No response-time/SLA promise for a privacy/erasure request — CONFIRM

Re-read `src/app/(public)/privacy/page.tsx` section 7 in full: "To use any
of these rights, contact us using the details in 'Who we are' above." — no
timeframe. Broadened the search beyond the report's phrase list:

```
$ rg -n -i "within \d+|respond within|response time|working days?|business days?|\d+\s*(day|week|month)s?\b.*\b(respond|reply|process|action|complete)" src
```

Every hit is unrelated: "working day" (staff availability/scheduling
copy), "Avg response time" (an *enquiry-contact* KPI label on the admin
dashboard, `dashboard-helpers-b5.ts`), "+7 business days" (a reports
date-range default), "joined within 30 days" (client "new" classification).
None is customer-facing privacy-request SLA copy. Matches the report.

---

## Part B — B-blast-radius.md (link/reachability and retention-prose blast
radius)

### B1. "7 year|seven year|12 month|twelve month" matches ONLY privacy/page.tsx
lines 168 and 170 — CONFIRM

```
$ rg -n -i "7 year|seven year|12 month|twelve month" src
src\app\(public)\privacy\page.tsx:168: ...for 7 years after your last
src\app\(public)\privacy\page.tsx:170: ...keep it for around 12 months...
```

Exactly 2 matches, both in the one file, both lines named. Matches exactly.

### B2. `footer.ts legalLinks: []`; no live `/privacy` link anywhere in
nav/footer/cookie-banner/consent/booking/emails/content — CONFIRM, and I
extended the search further

```
$ cat src/content/site/footer.ts
legalLinks: []  (confirmed empty, line 26)
```

Repo-wide `privacy` grep (case-insensitive, 46 files matched in `src/`) —
I read the content of every hit outside the already-known admin-only /
privacy-page-internal set, specifically the 5 the second report didn't
individually quote:
`AddressAutocompleteField.tsx` ("first input focus ... for cost + privacy" —
a code comment about lazy-loading, not a link), `reviews.ts` (testimonial
category tag "Islamic/modesty/privacy comfort"), `faqsAftercare.ts` (FAQ
section id/label "Therapists & Privacy"), `areaPages.ts` (bodily-privacy
prose, e.g. "the respect, hygiene and privacy it deserves"),
`TeamProfiles.tsx` ("privacy, communication and respect aren't optional").
None of these is a link.

Then searched specifically for the href pattern itself, repo-wide in `src/`:

```
$ rg -n "/privacy" src
src\app\(public)\privacy\page.tsx:25:  canonical: siteUrl("/privacy/"),   <- the page's OWN canonical self-reference
src\app\admin\clients\actions.ts:704:  revalidatePath("/admin/privacy");  <- unrelated admin route
(+ 15 more, all "/admin/privacy" — the staff queue, unrelated)
```

The only "/privacy" (public) occurrence anywhere in `src/` is the privacy
page's own `siteUrl("/privacy/")` canonical metadata tag — not an inbound
link from anywhere else. I also checked every `siteUrl(...)` call site
repo-wide (10 total) — each public page sets its own canonical, none
references `/privacy/` from another page. And an explicit href/Link-pattern
grep (`href={?["'\`]/priv|<Link[^>]*privacy`) returned zero matches. This is
a stronger, independently-reproduced confirmation of the report's "currently
unlinked from anywhere in the live public app" finding, not a refutation.

### B3. "how-long-we-keep-it" anchor: 9 files / 35 occurrences, none a live
href — **PARTLY STALE (as expected, and expectedly so)**, not a defect

```
$ rg -l "how-long-we-keep-it" . -g '!node_modules'
13 files (up from the 9 the second report counted)
$ rg -c "how-long-we-keep-it" . -g '!node_modules'
58 total occurrences (up from 35)
```

The 4 new files are all inside `redesign/evidence/post-band-c-impl/item-2/`
— `B-blast-radius.md` itself (6), `C-test-harness.md` (11),
`D-wording-candidates.md` (1), and a scratch test file
`R2-scratch/privacy-page.test.tsx` (5) — i.e. exactly the self-referential
growth pattern the second report's own `newFindings` predicted would keep
happening. This is not a new discovery on my part; it is the predicted
pattern recurring right on schedule, and I'm noting it so the number isn't
re-quoted as static. The live-code fact is unchanged: the only match in
`src/` is still the `id="how-long-we-keep-it"` anchor target on the
`<section>` at privacy/page.tsx:165, never an href.

### B4. `privacy|retention|7 year|12 month` in `src/app/booking/manage/` = 0 — CONFIRM

```
$ rg -n -i "privacy|retention|7 year|12 month" src/app/booking/manage
(no output)
```

### B5. Zero tests under `src/app/(public)/**` — CONFIRM

```
$ Glob src/app/(public)/**/__tests__/**  -> no files
$ Glob src/app/(public)/**/*.test.tsx    -> no files
$ Glob src/app/(public)/**/*.test.ts     -> no files
```

Note: `redesign/evidence/post-band-c-impl/item-2/R2-scratch/privacy-page.test.tsx`
exists (created during this same item-2 work), but it lives outside
`src/app/(public)/**`, so it does not contradict this specific claim, which
was correctly scoped to `src/`.

### B6. e2e/ = 4 spec files, none touching the public privacy page's text — CONFIRM

```
$ find e2e -type f | sort
admin-contrast-helpers.ts, admin-contrast.spec.ts, admin-roles.spec.ts,
booking-claiming.spec.ts, booking-public.spec.ts, helpers.ts
$ rg -n -i "privacy" e2e
admin-roles.spec.ts (nav-label visibility assertions for the "Privacy" ADMIN
  nav item — 5 lines) + admin-contrast-helpers.ts (audits the /admin/privacy
  route — 2 lines)
```

Matches exactly: 4 `*.spec.ts` files, both "privacy" hits are the
admin-only staff queue, neither touches the public policy page.

### B7. No sitemap file — CONFIRM

```
$ find src -iname "sitemap*"   -> (none)
$ find public -iname "sitemap*" -> (none)
```

### B8. Zero `.snap` files / no snapshot infra — CONFIRM

```
$ find . -iname "*.snap" -not -path "*/node_modules/*" | wc -l
0
```

### B9. cookies/page.tsx retention-duration prose does not conflict with a
criteria-based section 6 — CONFIRM (research question, answered correctly)

Re-read `cookies/page.tsx` and `cookie-registry.ts` in full. Confirmed fixed
durations exist for cookie/storage items ("six months" prose on the page,
plus `182 days`, `180 days`, "Up to 13 months", "Session" in the registry
entries) but every one of these describes browser-storage retention (how
long a cookie/localStorage key persists on the visitor's device), a
different subject from privacy section 6 (how long booking/treatment/enquiry
*records* are kept). No shared figures, no cross-reference. I additionally
grepped `src` broadly for "we keep"/"we retain"/"retention period"/"data
retention" to see if `cookies/page.tsx` had crept into that vocabulary since
the report was written — it matched once, but on inspection it's "We keep
this list in one place so it stays consistent" (referring to the cookie
*registry list*, not to data retention) — a false positive, not a
substantive hit. Conclusion unchanged.

### B10. No other page states a retention duration in prose — CONFIRM,
including a targeted re-check of the admin surface

```
$ rg -n -i "retain|retention|years after|kept for|stored for" src/app/admin
```

Every hit is the "client retention rate" business-KPI metric
(`getRetentionRate`, `RetentionRate`, `performance-helpers.ts` KPI tile,
dashboard tests) or unrelated code comments ("permission checks ... are
retained as defence-in-depth", "retain query" on a search error state) — no
admin page states a data-retention *duration* in prose. `src/content/**`
re-checked for `retain|retention` — zero matches, consistent with the report.

---

## Summary

Of the two reports' claims, everything that was actually about the *system's
behavior* (age-based deletion existing or not, `deleteClient()`'s mechanics,
the erasure-request flow, SLA promises, link reachability, retention prose
elsewhere) reproduced exactly as stated when I re-ran it independently — I
found no age-triggered deletion path, no live link to `/privacy` anywhere in
the app (a stronger negative than either report even claimed, once
`src/app/booking/**` and `src/lib/email/**` are added to the search), and no
retention-duration prose outside the two already-identified pages.

What did NOT hold up under re-verification were three narrow, self-contained
*evidentiary* claims inside A-deletion-paths.md — a completeness statement
about which migration file(s) contain `DELETE FROM` (missed 4 statements in
a second file) and a grep-count claim (43/6 hits, actual 198/11) — both
number/completeness errors that, on full inspection of the actual larger
result sets, did not hide a contradicting fact. B-blast-radius.md's own
"how-long-we-keep-it" count (claim 3) was already flagged by that report as
expected to drift upward from self-quoting; I confirmed it has (35→58,
9→13 files), which is the predicted pattern recurring, not a new problem.

**Practical implication for the Owner-facing wording-hazards list**: none of
the 5 hazards in A-deletion-paths.md need retraction — they all survive this
adversarial pass. The two count corrections above are worth a one-line
footnote if either document is carried forward, but they do not change what
copy is safe or unsafe to write for item 2.
