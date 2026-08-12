# Item 1 Batch B — adversarial critique: irreversibility, races, and state

Read-only. Working tree re-verified stable across this session's reads
(`git status --short -- src/` unchanged: seven `M` + two `??`, matching the
task brief exactly). Files read in full: `src/app/admin/emails/actions.ts`
(all 521 lines), `src/app/admin/emails/emails-data.ts` (the new
`getReviewRequestCandidates` block, lines ~244-323, plus its surrounding
context), `src/app/admin/emails/components/ReviewRequestButton.tsx`,
`src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts`,
`src/lib/email/notifications.ts:1499-1630` (`sendReviewRequestEmail` and
`sendTrackedEmail`), `src/app/api/cron/review-emails/route.ts`,
`src/app/admin/components/admin-ui-interactions.tsx` (`ConfirmActionModal`),
and the `email_delivery_events` table definition
(`supabase/migrations/20260503170000_phase4_customer_manage_email_readiness.sql:28-38`).

Two sibling critiques already sit in this directory:
`B2-critique-correctness.md` (found a minor, now self-disclosed, overfetch/
under-display issue in `getReviewRequestCandidates`'s `×2` multiplier) and
`B2-critique-security.md` (found no defect in the RBAC gate, cache key,
transport isolation, rate-limit column choice, audit-insert reachability, or
ABSENT-vs-EMPTY handling). Neither touches concurrency/atomicity, which is
this critique's mandate. I do not re-litigate their findings; I confirmed
both hold and reference them only where directly relevant below.

**Verdict up front: one real, unmitigated defect** — the new per-send rate
limit does not close the double-send window it exists to close, because it
is a read-then-act check racing against a write that happens strictly after
the irreversible side effect (the actual email send). Everything else in
this lens (sentinel-write consistency, cache staleness, failure ordering,
predicate parity) checked out.

---

## 1. Double-send: the 60-second rate limit is TOCTOU, not atomic

`sendManualReviewRequest`, `actions.ts:455-477`:

```ts
const cutoff = new Date(
  Date.now() - RESEND_RATE_LIMIT_SECONDS * 1000
).toISOString();
const { data: recent } = await adminClient
  .from("email_delivery_events")
  .select("id")
  .eq("event_type", "review_request_client")
  .eq("booking_id", bookingId)
  .gte("created_at", cutoff)
  .limit(1)
  .maybeSingle();
if (recent) {
  return { ok: false, error: `Recently sent. Try again in ${RESEND_RATE_LIMIT_SECONDS} seconds.` };
}
```

then, unconditionally on that check passing, `actions.ts:479-483`:

```ts
outcome = await sendReviewRequestEmail(bookingId, adminClient, {
  ignoreClientCooldown: true,
});
```

**The row this SELECT looks for does not exist until after the email is
already sent.** Inside `sendReviewRequestEmail` (`notifications.ts:1518-1630`),
the only two writes are: (a) `sendTrackedEmail` at line ~1596, which calls the
real `sendEmail()` transport *first* and only writes the
`email_delivery_events` row *after* that call resolves
(`notifications.ts:558-573` — `await sendEmail(...)` then
`await recordEmailDeliveryEvent(...)`), and (b) the sentinel `UPDATE
bookings SET review_email_sent_at = now() WHERE id = ? AND
review_email_sent_at IS NULL` at `notifications.ts:1613-1621`, which runs
*after* the send too. There is no write to either table before the email is
dispatched.

**Concrete failure scenario:** the "Review requests" tab is not scoped to
one staff member — it is the shared clinic queue (`canSeeAllBookings` is
true for Owner/Admin/Coordinator, `emails-data.ts` cache-key comment and
`B2-critique-security.md` §2 both confirm the list content, not just
visibility, is clinic-wide for those roles). Two staff with
`resend_booking_emails` — say Owner and Coordinator, each in their own
browser session — both have the tab open and both see the same completed
booking (same 60-second-cached row set). Both click "Send request" within
the same few hundred milliseconds (a shift-handoff coincidence, or one
retrying a request that looked stuck on a slow connection while the first
attempt was still in flight — nothing here dedupes by client, only by
server-side state that doesn't exist yet):

1. Request A: SELECT `email_delivery_events` for
   `(review_request_client, booking-1, last 60s)` → empty → proceeds.
2. Request B (arrives before A's `sendEmail()` call has returned and been
   recorded): SELECT → still empty, because A hasn't written its row yet →
   proceeds.
3. Both A and B call `sendReviewRequestEmail("booking-1", ...)`. Both read
   `booking.review_email_sent_at` as `null` (neither has written the sentinel
   yet either) and both pass the `already_sent` guard at
   `notifications.ts:1540-1542`.
4. **Both A and B call the real `sendEmail()`.** The customer receives two
   identical "please leave us a review" emails.
5. Both then attempt the sentinel `UPDATE ... WHERE review_email_sent_at IS
   NULL`. Exactly one succeeds; the other's `marked` comes back falsy, which
   `notifications.ts:1623-1627` handles with a `console.warn` — not
   surfaced to either caller, not turned into a refusal.
6. **`outcome.sent` is `{ sent: true }` for *both* A and B** — `sendReviewRequestEmail`
   has no way to know it lost a race it never checked for before sending.
7. Back in `sendManualReviewRequest`, both requests hit
   `actions.ts:499` (`if (!outcome.sent)`) as false, both proceed to
   `actions.ts:510-516` and **each writes its own `audit_logs` row** —
   `action_type: "review_email_sent"`, `automated: false`, same
   `target_id`, different `actor_staff_id` (or the same one twice, if it was
   one person's slow-connection retry). Both return `{ ok: true }`. Both
   admins see a success toast.

**Net state:** the customer got two emails; `bookings.review_email_sent_at`
holds one timestamp (whichever UPDATE won); `audit_logs` holds two rows
claiming a send happened. Anyone reconciling "how many times was this
booking's review request sent" from the audit trail will get the wrong
answer either way — the sentinel says "once," the audit log says "twice,"
and reality (the customer's inbox) matches the audit log, not the sentinel.

**This directly contradicts the invariant the code and the UI both assert.**
The JSDoc above `sendManualReviewRequest` states "one review request per
booking, always" (`actions.ts:410-411`, restated from
`notifications.ts:1515-1516`), and `ReviewRequestButton.tsx`'s confirm-modal
copy tells the admin *as a fact*, before they click: `"Only one review
request is ever sent per booking, so this booking won't appear here again"`
(`ReviewRequestButton.tsx:65`). That promise is false under the race above.

**Is this worse than before this diff?** Yes, concretely. Before this
change, `sendReviewRequestEmail` had exactly one caller: the 15-minute cron
(`src/app/api/cron/review-emails/route.ts`), which processes its candidate
batch in a single sequential `for` loop (`route.ts:154-205`, no
`Promise.all`) inside one HTTP handler invocation. The only theoretical
collision was two overlapping cron ticks (a 15-minute cadence, extremely
unlikely to overlap, and the sentinel-race comment in `notifications.ts`
already treats that as a monitoring-only edge case). This diff adds a
second, human-driven, multi-actor entry point with no serialization between
actors and no queueing — the exact shape of concurrency (independent actors,
same target, sub-second timing) that turns a theoretical race into a
plausible one. The 60-second rate limit was clearly written to guard against
this (`actions.ts:455-457`'s own comment: "Rate-limit, reusing the same
window as the per-row resend"), but a read-then-later-write check has no
teeth against two reads that both land before either write.

**Why this isn't caught by the existing test suite:** every test in
`sendManualReviewRequest.test.ts` calls `sendManualReviewRequest` once, with
`sendReviewRequestEmail` mocked to resolve synchronously
(`beforeEach` sets `mockResolvedValue({ sent: true })`,
`sendManualReviewRequest.test.ts:150`). A mocked, immediately-resolved async
function can never model two calls interleaving around a real network round
trip — the same "stub-free reality" gap the task brief names explicitly.
Nothing in this suite, nor in `sendReviewRequestEmail.test.ts` (Batch A,
out of scope for this diff), exercises two concurrent callers.

**Severity: major.** Not blocker-grade in raw impact — the failure mode is
one duplicate customer email plus an audit-log discrepancy, not data loss or
a financial transaction, and the timing window is narrow (sub-second,
same-booking, two-distinct-actors). But it is a real, currently-unmitigated
violation of an invariant the code explicitly asserts to the admin as fact,
newly and materially exposed by this diff's multi-actor UI surface, in a
system that otherwise takes real care about exactly this class of problem
(the DB-guarded sentinel UPDATE, the `.is("review_email_sent_at", null)`
defense, the explicit JSDoc reasoning about ordering). A true fix needs a
DB-level compare-and-set before the send (e.g. an atomic
`UPDATE bookings SET review_email_sent_at = now() WHERE id = ? AND
review_email_sent_at IS NULL RETURNING id`, checked *before* calling
`sendEmail`, not after) rather than a SELECT-based rate limit; that is a
change to `sendReviewRequestEmail` itself (Batch A code, out of scope for me
to prescribe further here), or a Batch-B-local advisory lock / unique
constraint on `email_delivery_events(event_type, booking_id)` scoped to
"pending" sends. No such constraint exists today —
confirmed by reading the table's `create table` statement
(`supabase/migrations/20260503170000_...sql:28-38`): no unique index beyond
the primary key, so nothing at the database layer backstops this either.

---

## 2. Sentinel-written-without-send / send-without-sentinel

Traced every return path in `sendReviewRequestEmail` (`notifications.ts:1518-1630`)
against whether the sentinel and the send agree:

- `status !== "completed"` → returns before any write. Consistent.
- `review_email_sent_at` already set → returns before any write. Consistent.
- No recipient (`no_email`) → **writes the sentinel without sending**
  (`notifications.ts:1546-1551`), by design, so the cron doesn't retry a
  dead-end booking forever. This path is unreachable from the manual send:
  `getReviewRequestCandidates` filters `recipient_email !== ""`
  (`emails-data.ts:387`) before a row is ever offered as a button, and the
  computation it uses (`row.contact_email || embeddedClientEmail(row) ||
  ""`) is byte-for-byte the same `||`-chain `sendReviewRequestEmail` itself
  uses (`notifications.ts:1544`, confirmed also by both sibling critiques).
  So this branch cannot fire for a booking a human clicked "Send" on.
- Cooldown skip (`client_recently_asked`) → returns before any write,
  correctly *not* writing the sentinel (comment at
  `notifications.ts:1564-1568` is explicit about why). Unreachable from the
  manual path anyway (`ignoreClientCooldown: true` is always passed at
  `actions.ts:481-483`).
- Success → send, then sentinel, guarded by `WHERE ... IS NULL`
  (`notifications.ts:1613-1621`), with the losing side of a race logged, not
  silently dropped (covered in §1 above).

**No defect in this category beyond the race in §1** — the no_email
sentinel-without-send is intentional, existing (Batch A), and structurally
unreachable through this diff's new UI.

## 3. Failure ordering: send succeeds, audit insert fails

`actions.ts:510-516`:

```ts
await adminClient.from("audit_logs").insert({
  actor_staff_id: profile.id,
  action_type: "review_email_sent",
  target_type: "bookings",
  target_id: bookingId,
  after_state: { booking_id: bookingId, automated: false },
});

updateTag(TAGS.EMAILS);
updateTag(TAGS.AUDIT);
revalidatePath("/admin/emails");
return { ok: true };
```

The `insert(...)` result (`{ data, error }`) is not checked. If it fails
(RLS misconfiguration, transient DB error), the function does not throw
(Supabase's `insert()` resolves, it does not reject, absent `.throwOnError()`)
— execution falls straight through to `updateTag`/`revalidatePath`/`return {
ok: true }`. The admin sees success, correctly: the email *was* sent, so
`{ ok: true }` is not a lie. What silently disappears is the audit trail
row — no error surfaces anywhere (not to the admin, not to Sentry, not to
`operational_events`).

**Is this new, or a pattern this diff should have deviated from?** Checked
both siblings in the same file: `sendManualBookingReminder`'s audit insert
(`actions.ts:72-79`) and `resendEmail`'s audit insert (`actions.ts:273-283`)
are written identically — bare `await ... .insert(...)`, no `error` check,
no try/catch around just that call. This is the established convention for
every audit-log write in this file, not something Batch B introduced
independently. Per the standing instruction to evaluate this diff on its own
terms rather than re-litigating patterns it inherited faithfully: this is
**consistent with, not a regression from,** the codebase's existing
tolerance for a lost audit row on an already-successful send.

**Is the resulting behaviour safe?** Yes, for the customer and for the
booking's own state (`review_email_sent_at` was already durably written by
`sendReviewRequestEmail` before this insert is even attempted, so the
one-shot guarantee for *this* codepath, absent the race in §1, holds
regardless of whether the audit row lands). It is unsafe only for
*observability* — an admin auditing "who sent this and when" would see
nothing for a real send. That gap already exists for `manual_booking_reminder_sent`
and `email_resent`; Batch B does not make it worse or better.

**Severity: minor**, reported because the task explicitly asked the
question, not because it's a new problem — it's an inherited,
pre-established tradeoff, unrelated to this diff's own design choices.

## 4. UI offering a send that will certainly be refused

Compared `getReviewRequestCandidates`'s predicate set against
`sendReviewRequestEmail`'s own checks, term by term:

| Check | List (`emails-data.ts`) | Send (`notifications.ts`) | Match? |
|---|---|---|---|
| Status | `.eq("status", "completed")` (`:365`) | `status !== "completed"` → refuse (`:1537-1538`) | Yes |
| Sentinel | `.is("review_email_sent_at", null)` (`:366`) | `review_email_sent_at` truthy → refuse (`:1540-1541`) | Yes |
| Recipient | `contact_email \|\| embeddedClientEmail(row) \|\| ""`, filtered non-empty (`:385,387`) | `booking.contact_email \|\| booking.clients?.email`, falsy → refuse (`:1544-1545`) | Yes, same `\|\|` chain, same two fields |
| Cooldown | Not filtered (deliberate, comment `:184-188`) | Bypassed via `ignoreClientCooldown: true`, always passed by this caller (`actions.ts:481-483`) | Consistent — list doesn't need to filter what the caller always bypasses |

No mismatch found. The one gap between "listed" and "certainly sendable" is
exactly the race in §1 (a booking can be listed, then have its sentinel set
by a second concurrent sender between page render and this admin's own
click) and the ordinary, harmless staleness of a 60-second cache (handled
correctly — see §5). Both are covered elsewhere in this document, not new
findings for this section.

## 5. Cache staleness after a send

`getReviewRequestCandidates` is cached via `unstable_cache` tagged
`TAGS.EMAILS` (`emails-data.ts:320`, confirmed present in the current
`{ revalidate: 60, tags: [TAGS.EMAILS] }` options). The send action calls
`updateTag(TAGS.EMAILS)` (`actions.ts:518`) and `revalidatePath("/admin/emails")`
(`actions.ts:520`) after a successful send. Next's tag-based invalidation
(`updateTag`/the `unstable_cache` tags system) invalidates every cache entry
carrying that tag regardless of its distinct cache key — so all per-staff
`cacheKeyPart({ canResend, canSeeAllBookings, staffId })` entries invalidate
together, the same mechanism `getEmailsPageData` already relies on
elsewhere in this file. `ReviewRequestButton.tsx:56` also calls
`router.refresh()` client-side after a successful send, forcing the
just-invalidated server data to be re-fetched. A sent booking's
`review_email_sent_at` is no longer `null`, so it is excluded by
`.is("review_email_sent_at", null)` on the next read — **the row does
disappear**, and a re-click after a genuine send correctly surfaces
`"A review request has already been sent for this booking."` via the
`already_sent` refusal path rather than a confusing error.

**No defect.**

## 6. `.slice()` after `.filter()` combined with `.limit()` — under-display

Already found and fully documented by `B2-critique-correctness.md` §3: the
`REVIEW_CANDIDATE_LIMIT * 2` overfetch (`emails-data.ts:294`, `= 40` rows)
can under-display eligible bookings if more than half of the fetched page
lacks a recipient email, and the current implementation (as of this
session's final read) now carries an explicit `⚠️ DISCLOSED LIMIT` comment
(`emails-data.ts:280-287`) acknowledging exactly this tradeoff and its
scope ("not worth the machinery for a clinic with 15 bookings... If the
email-coverage mix ever shifts, raise the multiplier or paginate").

From this critique's money-and-state lens specifically: this cannot produce
a **wrong** state — no booking is ever offered that shouldn't be, no
sentinel is ever written incorrectly, no double-send results from it. It is
a visibility gap, not a correctness or irreversibility gap, and it is now
self-disclosed in-code rather than silent. I have nothing to add to the
correctness critique's treatment of it. One small addition worth noting: the
tab badge (`page.tsx`, `` `${reviewCandidates.length} completed bookings not
yet asked for a review` ``) presents the post-`slice()` count as if it were
the total outstanding count, with no "at least" qualifier — in the
disclosed-limit failure mode, an admin could read the badge as "12
remaining" when the true count is higher. Cosmetic, not a state defect;
not re-scored separately.

---

## Summary

| # | Hunt area | Result |
|---|---|---|
| 1 | Double-send via concurrent submits vs. the 60s rate limit | **Defect (major)** — TOCTOU: rate-limit SELECT races the send, which writes to `email_delivery_events` only after `sendEmail()` returns; two near-simultaneous callers both pass, both send, both audit-log |
| 2 | Sentinel written without send / vice versa | No defect — `no_email` sentinel-without-send is intentional Batch A behavior, structurally unreachable via this diff's UI |
| 3 | Audit insert failure after a successful send | Minor, pre-existing codebase convention (same as `manual_booking_reminder_sent`/`email_resent`), not a Batch B regression; safe for the customer/booking, blind for observability only |
| 4 | List/predicate mismatch vs. `sendReviewRequestEmail` | No defect — status, sentinel, and recipient checks match term-for-term |
| 5 | Cache staleness after a send | No defect — tag-based invalidation plus `router.refresh()` correctly removes a sent row on next read |
| 6 | `.slice()`-after-`.filter()` under-display | Already documented (`B2-critique-correctness.md` §3), now self-disclosed in-code; confirmed to be a visibility gap only, not a state/money integrity issue |

## Unverified claims

- I did not independently load-test or execute two real concurrent calls
  against a live Supabase instance — §1's race is derived from a precise
  read of the write ordering in `sendTrackedEmail`/`sendReviewRequestEmail`
  and the absence of any DB-level uniqueness constraint on
  `email_delivery_events`, not from an observed reproduction, per this
  task's read-only, no-migration, no-real-email constraints.
- Whether any application-level mutex/queue exists somewhere outside the
  six touched files (e.g. a Postgres advisory lock taken elsewhere in the
  request path, or an edge-platform-level request coalescer) that could
  incidentally close this window was not found in anything I read, but I
  did not exhaustively search the full `src/lib` tree for one.
