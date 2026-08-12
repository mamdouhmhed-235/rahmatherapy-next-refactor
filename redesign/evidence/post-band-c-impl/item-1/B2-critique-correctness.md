# Item 1 Batch B / Step 1e digest — adversarial correctness critique

Read-only critique. HEAD verified at `530d15494864002331080fd6aac71839cd5acac0`
(unchanged throughout). All line numbers/counts below are re-measured
directly from source in this session, not copied from the digest.

## 0. TOP FINDING (blocker) — the digest's central premise is already false

The digest, and every "OPEN" question in it, assumes **Item 1 Batch B has not
been built yet** — it repeatedly frames the manual-send action, the new
`emails-data.ts` export, the audit registration, and the tab UI as design
decisions still to be made by "the implementer."

That premise was already false while this critique was being written. The
working tree is **not** the clean "Batch A only" state the digest describes —
it is mid-implementation, live, uncommitted, and it changed **while I was
reading it**:

- My first `git status --short` (early in this session) showed only the
  expected `M src/lib/maintenance.ts`.
- A `Read` of `src/app/admin/audit/format.ts` showed `review_email_sent`
  **absent** and `describeAction` at lines 105-115 with `password_reset_*`
  starting at line 97.
- Minutes later, `grep -n "review_email_sent"` on the **same file** returned
  a match at line 98, and a re-`Read` showed a new 7-line block (a comment +
  the `review_email_sent` entry) had been inserted between
  `manual_booking_reminder_sent` and `report_exported` — shifting
  `password_reset_request_lookup_failed` from line 98 to line 105.
- `git status --short -- src/` at that point showed three modified files
  beyond the baseline: `format.ts`, `actions.ts`, `emails-data.ts`.
- A `git diff --stat` on `page.tsx` returned "36 lines changed, 1 file"; a
  **second** `git diff --stat` on the identical path, called seconds later
  with no edits from me, returned "111 lines changed" — the file grew by 75
  lines between my two read-only calls.
- By the end of this session, `git status --short -- src/` showed:
  ```
   M src/app/admin/audit/__tests__/format.test.ts
   M src/app/admin/audit/format.ts
   M src/app/admin/emails/__tests__/emails-data.test.ts
   M src/app/admin/emails/actions.ts
   M src/app/admin/emails/emails-data.ts
   M src/app/admin/emails/page.tsx
   M src/lib/maintenance.ts
  ?? src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts
  ?? src/app/admin/emails/components/ReviewRequestButton.tsx
  ```

**Something else — another agent/session, or the Owner — is actively writing
Item 1 Batch B into this exact working tree, uncoordinated with this
read-only critique task, in real time.** By my final snapshot, the following
already exist, uncommitted:

- `sendManualReviewRequest` (`src/app/admin/emails/actions.ts`) — full RBAC
  gate, H11 scope check, rate limit, `sendReviewRequestEmail(bookingId,
  adminClient, { ignoreClientCooldown: true })` call, refusal-message map,
  `automated: false` audit row, cache-tag invalidation.
- `getReviewRequestCandidates` (`src/app/admin/emails/emails-data.ts`) — a
  new, separately-cached export.
- `review_email_sent` registered in `ACTIONS` (`format.ts:98`), with an
  explanatory comment about it having two writers (cron `automated: true` /
  manual `automated: false`).
- A "Review requests" tab wired into `page.tsx` (`TabKey`, `resolveTab`,
  the `tabs` array entry, `ReviewsTab`/`ReviewRow`, badge count).
- `ReviewRequestButton.tsx` — a new client component with a confirm-modal
  send flow.
- Three test files (`sendManualReviewRequest.test.ts` new, `emails-data.test.ts`
  and `format.test.ts` extended) — **including a source-text guard for
  gotcha 39** on `getReviewRequestCandidates`'s select/filters, and a
  fallback-shadowing-proof pair of assertions for `review_email_sent` in
  `format.test.ts`.
- Confirmed via `npx tsc --noEmit -p tsconfig.json`: **0 errors**. Via
  `npx eslint` on the five touched/added files: **0 findings**. Via
  `npx vitest run src/app/admin/emails src/app/admin/audit`: **9 test files,
  116 tests, all passing** (up from the digest's own measured 8 files / 97
  tests baseline for the same scope).

This is not a nitpick about the digest's wording — it means **most of the
digest's "OPEN" section is now moot**, and every fact the six derivation
agents reported about `actions.ts`/`emails-data.ts`/`format.ts` "as they
stand today" was already stale relative to the live working tree by the time
it was compiled into this digest. Whoever consumes this critique next should
re-run `git status` before trusting anything below the fold in the six
evidence files, and should find out who/what is writing to this working
tree concurrently — a second uncoordinated writer in a repo this task was
explicitly scoped read-only against is itself a process defect, independent
of whether the code being written is correct.

The remainder of this critique evaluates (a) the digest's claims against the
source as it stood when each claim was checked, and (b) the **now-landed**
implementation against the digest's own gotcha-hunting lens, since that
implementation is the more consequential artifact by the time anyone reads
this.

## 1. Digest claims independently re-verified as accurate

Spot-checked the highest-leverage claims (the ones that would change what an
implementer types) directly against source, not against the digest's own
text:

- `actions.ts`: `sendManualBookingReminder` 31-97, its scope check 48-67,
  `RESEND_RATE_LIMIT_SECONDS` at 101, `resendEmail` 120-289, its H11 block
  159-201, `dispatchResend` 298-365 with the switch at 311-364, `canManageEmails`
  25-29. All exact, no drift.
- `notifications.ts`: `sendReviewRequestEmail` signature and full body
  1518-1630 exactly as quoted, including the booking `select` string at
  1528-1530 verbatim, `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS` at 1367,
  `ReviewClientClass` at 1369, `getClientsAskedForReviewSince` 1413-1446,
  `getCompletedBookingCountsByClient` 1457-1479, `classifyReviewClient`
  1491-1497. The JSDoc at 1513-1516 explicitly states `ignoreClientCooldown`
  "does NOT bypass the per-booking `review_email_sent_at` sentinel" — this
  directly and correctly answers the brief's "sentinel vs cooldown
  inversion" question: there is no inversion risk in the function this
  digest was worried about wrapping.
- `templates.ts`: `resolveTemplateOverrides` 708-730 exact, `fieldDefault`
  confirmed to read `field.defaultValue` off the registry (not a
  locally-duplicated literal), `pickReviewMessages`'s arg shape
  `{groupCategory, city, overrides, random?}` confirmed with no class field.
- `templates-data.ts` (real path:
  `src/app/admin/emails/components/templates-data.ts`, matching the digest's
  correction of the plan's bare filename): `subjectField()` and
  `reviewVariantField()` both set `placeholder: defaultValue` /
  `placeholder: text, defaultValue: text` from the **same** function
  parameter — confirmed byte-identical, matching the digest's gotcha-41
  warning that a placeholder-vs-default source-text guard is meaningless
  here and any guard must call `fieldDefault()`/the renderer.
- `format.ts`: `ACTIONS` map is 56 entries (independently counted by
  section, matches exactly), `describeAction` fallback confirmed at
  105-115 (the digest's own correction of the plan's stale 100-110 claim
  is right), `ACTION_TYPES_BY_FAMILY` derives purely from `ACTIONS`'s own
  keys as claimed.
- `fake-supabase-admin.ts`: `builder()` at lines 50-82, the 18-method
  `passthrough` array (select/eq/neq/in/is/or/not/gte/gt/lte/lt/ilike/like/
  order/limit/range/returns/overrideTypes) each bound to `() => chain` —
  confirmed exactly, gotcha 39 is real for any test written against this
  stub.
- `extend-recurring-horizons.test.ts`: the gotcha-39 source-text-guard
  precedent is real, confirmed at lines 532 (comment) / 536 (`it(...)`),
  one line earlier than the digest's stated "536-547" for the comment but
  within the digest's own hedge ("around").
- Test counts: `sendReviewRequestEmail.test.ts` 23 runtime tests,
  `review-emails.test.ts` 11, `resendEmail.test.ts` 25 (21 plain `it(` +
  2 `it.each` blocks × 2 params = 25, matching the digest's 23-static +
  2-extra breakdown once `it.each` call sites are counted as static sites),
  `emails-data.test.ts` at the time of the derivation agents' run was 28
  plain `it(` + 1 `it.each` × 3 params = 31. All confirmed by direct grep
  and by an actual `vitest run`, independent of the digest's own numbers.

None of the above needed correction. The derivation agents' line/count
discipline was genuinely good — the failure mode in this digest is entirely
about **staleness against a moving target**, not sloppy reading of a fixed
snapshot.

## 2. Gotchas the brief asked me to hunt — resolved in the landed code

Since the code the digest treated as hypothetical now exists, I checked it
directly against every gotcha named in the task brief, rather than against
the digest's predictions about it:

- **Recipient predicate match** — `getReviewRequestCandidates` computes
  `row.contact_email || embeddedClientEmail(row) || ""` and filters out the
  empty-string result (`emails-data.ts` new block, confirmed by reading the
  diff). This is the same `||`-chain, same field pair
  (`contact_email` / `clients.email`), same precedence as
  `sendReviewRequestEmail`'s `booking.contact_email || booking.clients?.email`
  (`notifications.ts:1544`). No mismatch — a row the eligibility list offers
  will not immediately bounce with `no_email`, and a row the list omits for
  having no recipient is not one `sendReviewRequestEmail` could have sent to
  either.
- **Per-booking sentinel vs. client cooldown** — `getReviewRequestCandidates`
  filters `.is("review_email_sent_at", null)` (respects the sentinel) and
  explicitly does **not** filter by the 6-month cooldown, with a comment
  reasoning through exactly why (`ignoreClientCooldown: true` would be dead
  code otherwise). No inversion.
- **Cache-key completeness** — `getReviewRequestCandidates` is its **own**
  `unstable_cache` call (a new cache key, `"emails-review-candidates"`), not
  a field bolted onto `getEmailsPageData`'s existing cached return. Its key
  is `cacheKeyPart({ canResend, canSeeAllBookings, staffId })` — every
  boolean that gates its own internal branching is present in its own key.
  I raised this as an open risk before finding the code (none of the six
  evidence docs states the requirement as a hard rule, only as an unresolved
  design question) — the actual implementation resolved it correctly by
  sidestepping the question entirely (separate cache entry, not a shared
  one), so there is no cross-permission leak.
- **`action_type` registered, not just written** — `review_email_sent` is in
  `ACTIONS` (`format.ts:98`) before any code writes it via
  `sendManualReviewRequest`'s audit insert, so it does not fall into the
  digest's own documented trap (present-but-unregistered → invisible to the
  family filter). `format.test.ts` gained two new tests that specifically
  guard against the fallback-shadowing failure mode gotcha 41 warns about
  (`describeAction("review_email_sent").phrase` must NOT equal the
  underscore-stripped fallback string, and the phrase/chip must differ from
  the fallback's `"none"`/generic values) — this is the correct technique,
  applied correctly.
- **Gotcha 39 on the new query** — `getReviewRequestCandidates` uses the
  same `createSupabaseAdminClient()` + `.eq/.is/.in/.order/.limit` chain as
  every other query in this file, against the same no-op stub. A dedicated
  `describe("source-text guards for predicates no stub can honour", ...)`
  block was added to `emails-data.test.ts`, reading the file between two
  anchor strings (asserting each anchor is unique before slicing — a real
  safeguard against the guard itself silently measuring the wrong region)
  and asserting `.eq("status", "completed")`, `.is("review_email_sent_at",
  null)`, `"clients(email)"`, `"contact_email"` are present, and that the
  cooldown-adjacent table/column names (`email_delivery_events`,
  `delivery_status`) are **absent** from that region. This mirrors the
  `extend-recurring-horizons.test.ts` precedent correctly and closes the
  exact hole the digest flagged.

## 3. A real, still-open defect in the landed code

**`getReviewRequestCandidates`'s overfetch multiplier can under-display
eligible bookings, and nothing tests for it.**

```ts
// src/app/admin/emails/emails-data.ts
const REVIEW_CANDIDATE_LIMIT = 20;
...
let q = adminClient
  .from("bookings")
  .select(REVIEW_CANDIDATE_SELECT)
  .eq("status", "completed")
  .is("review_email_sent_at", null)
  .order("completed_at", { ascending: false, nullsFirst: false })
  .limit(REVIEW_CANDIDATE_LIMIT * 2);
...
return (data ?? [])
  .map((row) => ({ ... recipient_email: row.contact_email || embeddedClientEmail(row) || "" }))
  .filter((row) => row.recipient_email !== "")
  .slice(0, REVIEW_CANDIDATE_LIMIT);
```

The query fetches **40** rows (`REVIEW_CANDIDATE_LIMIT * 2`), then filters out
rows with no recipient in JS, then slices to 20. The `* 2` multiplier is an
unstated heuristic: it assumes no more than half of any 40-row page lacks a
recipient email. If a clinic's completed-booking population skews toward
walk-ins or phone bookings with no email on file (plausible — nothing in the
domain guarantees a floor on email coverage), more than 20 of the 40 fetched
rows can be recipient-less, and the admin sees a list shorter than 20 even
though eligible rows exist further down the true `completed_at` ordering
that the query never reached. This is the same *shape* of defect the digest
itself flagged elsewhere in this codebase (the reminders block's
`.limit(200)` on `booking_assignments`, called out in `B2-emails-data-current.md`
as "a latent under-display risk") — but this one is new, in code that did
not exist when that observation was written, and:

- No comment in the new code acknowledges the tradeoff (contrast the H11
  `.limit(200)` block a few lines above it in the same file, which has an
  explicit comment reasoning through exactly this kind of cap).
- No test exercises the "more than half of the fetched page has no
  recipient" case — the one behavioural test added
  (`"returns completed bookings with a recipient..."`) uses 6 rows, none of
  which trigger the multiplier's failure mode (2 of 6 lack a recipient, well
  under the 50% the `* 2` factor assumes).

This is a minor severity issue in practice (worst case: an admin sees fewer
eligible rows than exist, not wrong rows or a crash — pagination/refresh
would eventually surface them if the underlying data mix shifts), but it is
concrete, present in code already landed, and unlike the digest's other
concerns, was not caught by the concurrent implementer's own gotcha-39
diligence — the source-text guard added checks *which* predicates are
present, not whether the *combination* of predicate + limit + JS-filter +
slice can under-serve.

## 4. Step 1e — confirmed still untouched, digest's analysis stands

`git status` at every snapshot in this session showed `notifications.ts` and
`templates.ts` unmodified. Everything the digest reports about Step 1e —
`pickReviewMessages`'s 4-field arg shape with no `clientClass`,
`classifyReviewClient` computed only in the cron route and never threaded
past its own audit-log write, the 10-fields-vary-by-category /
0-fields-vary-by-class count, the options-(a)/(b)/(c) analysis, and the
`FAILED CLAIMS` entry showing the plan's §1.6 "natural seam" framing
conflicts with its own §1.11 regression gate — is corroborated by direct
reading and remains current as of this session's final snapshot. I found no
inaccuracy in the Step 1e evidence doc worth reporting as a defect.

## Unverified claims

- The exact byte contents of `ReviewRequestButton.tsx`'s confirm-modal copy
  and the `ReviewsTab`/`ReviewRow` markup beyond what is quoted above were
  read but not exhaustively checked against every design/accessibility
  convention used elsewhere in `page.tsx` (e.g. whether `EmptyState`'s
  `illustrationSrc` prop is required — the digest itself flagged this as
  unverified, and I did not resolve it either).
- Whether the 19-item and 8-item `format.ts` completeness-check lists (action
  types written-but-unregistered, and registered-but-dead) are exactly right
  was not re-counted; I verified the specific claim relevant to this task
  (`review_email_sent`'s absence, now presence) and the exact line ranges,
  not the two long enumerated lists.
- Whether anything **else** in the working tree changed underneath this
  critique after my final `git status` snapshot (`HEAD 530d154`, working
  tree modified as listed in §0) — by construction, a critique cannot verify
  its own currency past the moment it stops reading.
