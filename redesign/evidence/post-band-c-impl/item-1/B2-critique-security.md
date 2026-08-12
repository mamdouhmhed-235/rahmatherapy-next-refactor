# Item 1 Batch B — adversarial security / email-safety critique

Read-only. HEAD verified at `530d15494864002331080fd6aac71839cd5acac0`, stable
at both the start and end of this session (`git status --short -- src/`
identical both times — no concurrent-edit churn during this pass, unlike the
companion correctness critique).

Files read in full: `src/app/admin/emails/actions.ts` (all 414 new lines,
plus the full pre-existing `resendEmail`/`sendManualBookingReminder` for
pattern comparison), `src/app/admin/emails/emails-data.ts` (whole file, 686
lines), `src/app/admin/emails/page.tsx` (tab wiring + `ReviewsTab`/`ReviewRow`),
`src/app/admin/emails/components/ReviewRequestButton.tsx`,
`src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts`,
`src/lib/email/notifications.ts:1518-1630` (`sendReviewRequestEmail`, to
verify claims made about it rather than trusting the diff's comments), and
the `format.ts`/`format.test.ts`/`emails-data.test.ts` diff hunks.

Verdict up front: **no exploitable defect found in Item 1 Batch B itself**
across every category the brief named. Each is traced below with the actual
code, not the diff's comments about the code. One out-of-scope anomaly is
noted at the end because it is real and sitting in the same working tree, not
because it belongs to this batch.

---

## 1. Therapist triggering a review email for an unassigned booking

`sendManualReviewRequest`, `src/app/admin/emails/actions.ts:323-345`:

```ts
const canSeeAllBookings = canViewAllBookings(profile) || canManageAllBookings(profile);
if (!canSeeAllBookings) {
  const { count } = await adminClient
    .from("booking_assignments")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("assigned_staff_id", profile.id);
  if (!count || count === 0) {
    ... return { ok: false, error: "You can only send review requests for bookings assigned to you." };
  }
}
```

`!count` is true for both `count === null` and `count === undefined` — the
check **refuses**, never permits, on a null/undefined count. There is no path
where a Supabase error or an empty result set falls through to
`sendReviewRequestEmail`. This is a straight copy of the exact idiom already
proven in `resendEmail` (lines 167-202) and `sendManualBookingReminder`
(lines 49-68) in the same file — same operator, same refuse-on-falsy
direction, no drift.

Confirmed with a real (non-toothless) test:
`sendManualReviewRequest.test.ts` "refuses an unassigned Therapist-class
actor" uses a `therapist` fixture holding `RESEND_BOOKING_EMAILS` +
`VIEW_BOOKINGS_ASSIGNED` (not `VIEW_BOOKINGS_ALL`), stubs
`assignmentCount: 0`, and asserts both the refusal message and that
`sendReviewRequestEmail` was never called. The companion `owner` fixture is
built to deliberately hold `VIEW_BOOKINGS_ALL` specifically so the
"permission gate" test can't accidentally pass for the wrong reason (the
comment at the fixture says this was "proven toothless by mutation before
this fixture was widened" — i.e. someone already mutation-tested this).

A nonexistent `booking_id` also refuses (no assignment row can ever match),
so the scope check can't be used as an existence oracle by an unassigned
therapist either — the error message is identical whether the booking exists
or not.

**No defect.**

## 2. Cached candidate list — cross-actor PII leak via a missing cache-key term

`getReviewRequestCandidates`, `emails-data.ts:381-384`:

```ts
[
  "emails-review-candidates",
  cacheKeyPart({ canResend, canSeeAllBookings, staffId }),
],
```

Compared directly against the established-safe `getEmailsPageData` key
(`emails-data.ts:238-249`, `cacheKeyPart({ canSeeDelivery, canResend,
canSeeAllBookings, staffId, businessDate, includeTemplates, limit, offset })`):
every input that changes which rows the fetcher can return for the reviews
list — `canResend` (gates the whole list), `canSeeAllBookings` (all-clinic vs
scoped), `staffId` (which therapist's assignments scope the query) — is
present in the key. There is no fourth input: the query has no date filter,
no pagination params, nothing else varies the result set. Two different
therapists (`staffId` differs) get distinct cache entries; a
`canSeeAllBookings: false` scoped therapist can never be served the
`canSeeAllBookings: true` entry Owner/Admin/Coordinator would populate.

Verified by the test `"keys its cache separately per scope, so one staff
member's list is never served to another"` — calls with `staffId: "s1"` then
`staffId: "s2"` and asserts `createSupabaseAdminClient` was invoked twice
(i.e. two distinct cache misses, not one shared hit).

Tag (`TAGS.EMAILS`) is shared across all keys, which only affects
*invalidation timing* (a booking event revalidates every staff member's
entry, same as `getEmailsPageData` already does), not *which* content a given
key resolves to — a shared invalidation tag cannot cause a cross-user
content leak.

**No defect.**

## 3. Any test path that could reach the real Resend SDK

`sendManualReviewRequest.test.ts` mocks, checked individually:

- `vi.mock("@/lib/supabase/admin", ...)` — `createSupabaseAdminClient` is a
  bare `vi.fn()`, so nothing this test does touches a real client.
- `vi.mock("@/lib/auth/rbac", async (importOriginal) => ({ ...(await
  importOriginal()), getStaffProfile: vi.fn() }))` — only the profile lookup
  is stubbed; `canViewAllBookings`/`canManageAllBookings`/
  `canResendBookingEmails` stay real, which is *why* the RBAC assertions in
  §1 above are meaningful and not self-fulfilling.
- `vi.mock("@/lib/email/notifications", async (importOriginal) => ({
  ...(await importOriginal()), sendReviewRequestEmail: vi.fn() }))` — the one
  function that would otherwise reach the transport is replaced; every other
  export of that module (unrelated to this action) stays real but is never
  invoked from `sendManualReviewRequest`.
- `vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(), getFromEmail:
  vi.fn(...), extractEmailAddress: vi.fn(...) }))` — belt-and-braces: the
  test file's own comment calls this "defence in depth," because spreading
  the real `notifications` module above pulls `client.ts` into the import
  graph even though `sendReviewRequestEmail` (the only caller of `sendEmail`
  in that graph) is itself mocked out. I traced the import chain by hand:
  `actions.ts` imports `sendReviewRequestEmail` from `notifications.ts`;
  `notifications.ts` imports `sendEmail` from `client.ts` at module scope
  (top-level `import`, not lazy) — so without this second mock, `client.ts`
  and its module-scope `RESEND_API_KEY` read would still load into the test
  process, even though the mocked `sendReviewRequestEmail` would never call
  it. With the mock in place, `client.ts`'s real body never executes at all
  — `sendEmail` is replaced before the module graph resolves it.

No test in this file calls the real `sendReviewRequestEmail`, and no test
constructs a real Supabase or Resend client. `RESEND_API_KEY` being live in
this environment is never exercised by this suite.

**No defect. Transport is unreachable.**

## 4. Rate limit — keyed on (event_type, booking_id) instead of (event_type, recipient_email, booking_id)

`actions.ts:356-363`:

```ts
const { data: recent } = await adminClient
  .from("email_delivery_events")
  .select("id")
  .eq("event_type", "review_request_client")
  .eq("booking_id", bookingId)
  .gte("created_at", cutoff)
  .limit(1)
  .maybeSingle();
```

Direction check, worked from first principles rather than trusting the
comment: a rate limit's predicate defines which past rows count as "recent
enough to block." Removing a term (`recipient_email`) from an AND-chain of
equality predicates can only **widen** the set of past rows that satisfy the
remaining predicates — every row that would have matched all three terms
still matches these two, plus any row that shares `event_type`+`booking_id`
but had a *different* recipient. A wider "does a recent row exist" query
finds a match at least as often, so it refuses at least as often. There is no
scenario in which dropping `recipient_email` here makes the check pass
(permit a send) in a case where the 3-term version would have refused it —
the reverse can happen (this version refuses in cases the 3-term version
would have permitted, e.g. the same booking's contact email changed between
two rapid sends), but that is strictly the safer direction for an
email-safety rate limit.

This is also the semantically correct scope for *this* limiter specifically:
`resendEmail`'s version replays a specific historical `email_delivery_events`
row (an existing `recipient_email` to match against), which is why it can
and does key on the tuple. A fresh manual send has no such row to read a
recipient from before it sends — `booking_id` is the only stable identifier
available pre-send, and it is never null here (it comes straight off the
`ReviewRequestCandidate.id` the form posts, not off a delivery-event row).
Keying on the tuple would in fact be *impossible* to implement pre-send
without first computing the recipient redundantly.

Verified by test `"respects RESEND_RATE_LIMIT_SECONDS"`: stubs a recent
`email_delivery_events` row for the booking and asserts the send is refused
with `"Recently sent. Try again in 60 seconds."` and that
`sendReviewRequestEmail` is never called.

**No defect — direction is correct, tighter not looser, as the diff's own
comment claims and this trace confirms independently.**

## 5. Audit row written without a send / omitted after a real send

`actions.ts:391-408` — the only `audit_logs` insert in this function sits
strictly after the `if (!outcome.sent) { return {...}; }` early return:

```ts
if (!outcome.sent) {
  return { ok: false, error: ... };   // <- returns BEFORE the insert
}
await adminClient.from("audit_logs").insert({ ... action_type: "review_email_sent", ... after_state: { booking_id: bookingId, automated: false } });
```

There is no code path that reaches the insert with `outcome.sent === false`,
and no code path that returns `{ ok: true }` without having reached the
insert first (the `return { ok: true }` is the last statement, after the
insert). A thrown `sendReviewRequestEmail` call is caught separately
(`catch (error) { ... return { ok: false, ... }; }`, lines 376-389) — also
strictly before the audit insert, and it records an `operational_events` row
(`failed_review_request_attempt`, severity `error`) instead, not an
`audit_logs` row.

Verified by three separate tests: `"writes an audit row with automated:
false"` (success path, one `audit_logs` insert, correct shape); the second
half of `"bypasses the 6-month client cooldown but still respects the
per-booking sentinel"` (mocks `sendReviewRequestEmail` to return `{ sent:
false, reason: "already_sent" }` and asserts `ok: false` with **no**
`audit_logs` insert); `"reports a thrown send as an operational event and a
clean error, without an audit row"` (rejection path, asserts zero
`audit_logs` inserts and exactly one `operational_events` insert).

**No defect.**

## 6. ABSENT vs EMPTY FormData

`actions.ts:314-315`:

```ts
const bookingId = String(formData.get("booking_id") ?? "").trim();
if (!bookingId) return { ok: false, error: "No booking selected." };
```

`FormData.get` on a missing key returns `null` (not `undefined`, not `""`) —
`null ?? ""` evaluates to `""`, `String("")` is `""`, `.trim()` is `""`,
`!""` is `true`: an absent `booking_id` key is refused identically to an
empty one, and identically to a whitespace-only one (`"   "` also refuses
after `.trim()`). There is no `formData.has()` check that could be bypassed
by omitting the key, and no `formData.get("booking_id") as string` cast that
would let `null` flow through untreated. Same idiom, verbatim, in
`sendManualBookingReminder` (line 39) and `resendEmail` (line 132) — no
drift for this new caller.

Verified by test `"refuses an empty booking id without touching the
database"` — passes a bare `new FormData()` (key genuinely absent, not set
to `""`), asserts the refusal message, and asserts zero database inserts
(i.e. it refuses before even constructing the admin client's queries — it
returns before `createSupabaseAdminClient()` is called, since that happens
on line 317, after this check).

**No defect.**

## 7. Tab / badge visibility for an actor who shouldn't see it

Three independent gates, all traced to source:

- **Data**: `getReviewRequestCandidates` self-gates — `if (!canResend) return
  [];` is the first line inside the cached fetcher (`emails-data.ts:320`). A
  non-`canResend` caller's cache entry is always `[]`, regardless of what
  bookings exist.
- **Tab visibility**: `page.tsx:632-643`, `visible: canResend` on the tab
  descriptor; `TabStrip tabs={tabs.filter((t) => t.visible)}` (line 655)
  drops it from the strip entirely for a non-`canResend` actor.
- **Content render**: `page.tsx:660-662`, `{activeTab === "reviews" &&
  canResend ? <ReviewsTab .../> : null}` — double-gated even if `activeTab`
  is forced to `"reviews"` via `?tab=reviews` (note `resolveTab` at line 604
  does not itself check `canResend`, matching the pre-existing `reminders`
  tab's identical lack of a permission check in `resolveTab` — the gate lives
  at render time for both tabs, not in the resolver, and that pattern
  predates this diff).

**Badge leak check**: the badge (`page.tsx:635-643`) renders only
`reviewCandidates.length` and a title string built from that same number —
`` `${reviewCandidates.length} completed bookings not yet asked for a
review` ``. No candidate name, email, or booking id appears in the badge or
its title attribute. For a scoped therapist, `reviewCandidates` is already
their own-assignments-only list (per §2), so the count itself cannot reveal
the existence of a booking outside their scope — it's a count of bookings
they can already see in full via Reminders/their own booking list, not a
count derived from a wider query.

**No defect.**

---

## Out-of-scope anomaly noted, not attributed to this batch

`src/lib/maintenance.ts` is modified in the working tree
(`MAINTENANCE_MODE: true → false`) alongside the six Batch B files. Per the
companion correctness critique (`B2-critique-correctness.md`, written
earlier in the same uncoordinated-editing incident this session's stable
`git status` did **not** reproduce), that file was **already** modified
before any Batch B file existed in this working tree — it is not something
Item 1 Batch B's implementation touched or depends on, and none of the six
Batch B files reference it. I did not open it and have no independent
finding about it; I'm recording only that it sits in the same tree so a
later reviewer doesn't mistake it for part of this batch's diff. My
instructions explicitly forbid touching it, which reads as this being
already known and separately owned, not overlooked.

---

## Summary

| # | Hunt area | Result |
|---|---|---|
| 1 | Therapist sends review email for unassigned booking | Refused correctly; `!count` refuses on null/undefined |
| 2 | Cached list cross-actor leak | Key carries `canResend`+`canSeeAllBookings`+`staffId`, matches `getEmailsPageData` precedent |
| 3 | Test reaching real Resend SDK | Unreachable — `sendReviewRequestEmail` mocked, `client.ts` mocked defense-in-depth |
| 4 | Rate limit bypassable / wrong direction | Correct direction — dropping `recipient_email` strictly widens the "recent" match, never narrows it |
| 5 | Audit row written/omitted incorrectly | Insert is unreachable except on confirmed `outcome.sent === true` |
| 6 | Absent vs empty FormData | `null ?? ""` unifies both; refused either way |
| 7 | Tab/badge visibility leak | Triple-gated (data, tab list, render); badge carries only a scope-bounded count |

No defects found in Item 1 Batch B against any of the requested hunt
categories.
