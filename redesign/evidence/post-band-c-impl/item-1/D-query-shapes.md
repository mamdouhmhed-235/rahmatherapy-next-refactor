# Item 1 — Query shape verification (cooldown lookup + classification count)

Verified against live repo state, commit `91a5864538d33b98c64d6bfc064de0034131b329` (2026-08-11
19:28:41 +0100 — current HEAD at verification time; the plan's claims were stated "as of commit
33f895f", so every line number below was re-located by symbol name, not trusted from the plan).
DB checks ran SELECT-only against Supabase project `twzutkfgqclqurvkmvqz`. No writes, no email
sends, no server actions were executed.

---

## QUERY 1 — the cooldown lookup

Proposed:
```
supabase.from("email_delivery_events")
  .select("bookings!inner(client_id)")
  .eq("event_type", "review_request_client")
  .eq("delivery_status", "accepted")
  .gte("created_at", since)
  .in("bookings.client_id", clientIds)
```

### a) Is `email_delivery_events.booking_id` a real FK to `bookings.id`?

**Yes.** SQL run:

```sql
SELECT con.conname, con.contype, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public' AND rel.relname = 'email_delivery_events' AND con.contype = 'f';
```

Result:
```
email_delivery_events_booking_id_fkey | f | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
email_delivery_events_staff_id_fkey   | f | FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE SET NULL
```

A real FK exists on `booking_id → bookings.id`. PostgREST can embed `bookings` from
`email_delivery_events` through it. The `!inner` embed and the nested `.eq`/`.in` filters in the
proposed shape are therefore structurally possible — the approach does not need to change on this
account.

### b) Precedent for filtering on an embedded column

Yes, and the repo has **two distinct precedents**, both confirmed by direct re-read (not trusted
from the plan):

**1. `.in()` directly on an embedded column** — `src/app/admin/bookings/assignment-eligibility.ts:238-244`:
```ts
supabase
  .from("booking_assignments")
  .select("assigned_staff_id, bookings!inner(id, booking_date, start_time, end_time, status)")
  .not("assigned_staff_id", "is", null)
  .in("status", ["assigned"])
  .eq("bookings.booking_date", booking.booking_date)
  .in("bookings.status", ["pending", "confirmed"]),
```
Line 244 is exactly `.in("bookings.status", [...])` on the embedded `bookings` table — the same
operator (`.in`) on the same shape (`embed_table.column`) the proposed Query 1 uses for
`bookings.client_id`. This is direct, on-point precedent that `.in()` on an embedded column works
in this codebase's PostgREST client.

**2. `.not(embed.column, "in", ...)` on an embedded column** — `getScopedBookingIds`,
`src/app/admin/bookings/bookings-list-data.ts:515-537` (the example named in the task):
```ts
const claimableRows = canClaimAssignments(profile)
  ? (
      await adminClient
        .from("booking_assignments")
        .select("booking_id, bookings!inner(status, booking_date)")   // line 531
        .eq("status", "unassigned")
        .is("assigned_staff_id", null)
        .eq("required_therapist_gender", profile.gender)
        .not("bookings.status", "in", '("cancelled","no_show")')       // line 535
        .gte("bookings.booking_date", todayISO)
    ).data ?? []
  : [];
```
(Line numbers re-verified live: `select` at 531, `.not(...)` at 535 — both match the plan's
claim for this function; no drift found here.)

**3.** `bookings-list-data.ts`'s own `BOOKING_FILTER_EMBEDS` machinery (lines 193-202, 468-477)
generalizes the same pattern into aliased `!inner` embeds (`fv:booking_assignments!inner(id)`)
with `.eq("fv.<col>", …)` filters — confirming `.eq` on an embedded/aliased column is a repo-wide
convention, not a one-off. No `.in()` example was found on an *aliased* embed, but #1 above shows
`.in()` on a plain (non-aliased) embed works, which is the shape Query 1 uses (`bookings`, not an
alias).

**Verdict for (b):** solid precedent exists, including the specific `.in()` operator on an
embedded column (`assignment-eligibility.ts:244`), which the task called out as the thing to
specifically check for.

### c) Is `booking_id` nullable? What does that mean for `!inner`?

**Yes, nullable.** From `information_schema.columns`:
```
booking_id | uuid | is_nullable: YES
```

Full column check run:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='email_delivery_events'
ORDER BY ordinal_position;
```

`!inner` on an embed is PostgREST's way of turning the embed into an `INNER JOIN` (as opposed to
the default `LEFT JOIN`, which would return the parent row with a `null` nested object when there
is no match). Rows in `email_delivery_events` where `booking_id IS NULL` have no matching `bookings`
row, so `bookings!inner(client_id)` **filters those rows out entirely** — they never reach the
`.eq`/`.in` filters afterward, because there is nothing for those filters to match against.

**Does it matter here?** No, and for two independent reasons:
1. The proposed query already filters `.eq("event_type", "review_request_client")` — the rows this
   query is scanning are review-request-send records, which are only ever written by
   `sendReviewRequestEmail`/`sendTrackedEmail` against a real `booking.id` (see
   `src/app/api/cron/review-emails/route.ts:125`, `candidate.id` passed straight from a `bookings`
   row). There is no code path that writes a `review_request_client` event with a null
   `booking_id`.
2. Even in the hypothetical case a null-`booking_id` row existed, `!inner` silently drops it from
   this query's result set rather than erroring — which is the *correct* behavior for a cooldown
   lookup keyed by `client_id` (a row with no booking has no client to attribute a cooldown to).

So nullability is real but inert for this query's purpose — no special-casing required.

### d) Full column list — `email_delivery_events`

From `information_schema.columns` (`ordinal_position` order):

| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| booking_id | uuid | YES |
| event_type | text | NO |
| recipient_email | text | YES |
| recipient_role | text | YES |
| delivery_status | text | NO |
| provider_message_id | text | YES |
| error_message | text | YES |
| created_at | timestamptz | NO |
| staff_id | uuid | YES |
| scheduled_for | timestamptz | YES |
| html_payload | text | YES |
| text_payload | text | YES |
| to_email | text | YES |
| subject | text | YES |
| metadata | jsonb | YES |

All four filter columns the proposed query touches (`event_type`, `delivery_status`, `created_at`,
plus `booking_id` for the embed) are present with the expected types.

### e) Does the client's typing allow this, and how do existing call sites read the nested shape?

**The admin client carries no `Database` generic at all.** `src/lib/supabase/admin.ts:11-27`:
```ts
export function createSupabaseAdminClient() {
  ...
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```
`createClient(url, key, options)` with no type argument — every `.from(...).select(...)` off this
client is effectively untyped (`any`-shaped rows) at the TypeScript level. This is corroborated by
the comment already in `bookings-list-data.ts:64-67`: *"the admin client carries no `Database`
generic and the row is an unchecked `.returns<BookingRecord[]>()` cast"*.

So yes, `.select("bookings!inner(client_id)")` will compile — the string is untyped and unchecked
by tsc regardless of its shape.

**How existing call sites read the resulting nested object** — `assignment-eligibility.ts:274-280`,
reading the result of the `.select("assigned_staff_id, bookings!inner(id, booking_date, start_time,
end_time, status)")` query from (b)#1 above:
```ts
for (const row of busyAssignmentsResult.data ?? []) {
  const staffId = row.assigned_staff_id as string | null;
  const busyBooking = row.bookings as unknown as {
    id: string;
    start_time: string;
    end_time: string;
  };
  ...
```
The pattern is a manual `as unknown as {...}` double-cast on the embedded field (`row.bookings`),
naming only the sub-fields actually used. `getScopedBookingIds` does the equivalent implicitly by
never touching the embedded `bookings` object at runtime at all — it only uses it inside filter
predicates (`.not("bookings.status", ...)`), then reads `assignment.booking_id` off the flat top
level (line ~545).

**Verdict for (e):** the proposed `bookings!inner(client_id)` embed will type-check (loosely,
because nothing here is strictly typed) and the correct repo-idiomatic way to read it is
`row.bookings as unknown as { client_id: string }`, matching `assignment-eligibility.ts:276-280`.

### Query 1 — overall verdict

**Works as written, no shape change required.** The FK is real (a), `.in()` on an embedded column
has direct precedent (b), the nullability of `booking_id` is real but harmless for this query (c),
all referenced columns exist with the right types (d), and the untyped admin client plus an
existing `as unknown as {...}` cast precedent (e) is sufficient to read `bookings!inner(client_id)`
safely. One implementation note carried into the code, not a shape change: read the nested value as
`row.bookings as unknown as { client_id: string }` per the `assignment-eligibility.ts` precedent,
since the admin client will not infer it.

---

## QUERY 2 — the classification count

Requirement: **one query per tick** returning, per `client_id`, the number of completed bookings,
inclusive of the candidate booking itself.

### f) Precedent for per-group counts without PostgREST GROUP BY

No RPC and no embedded-count precedent exists for this specific shape. What exists instead is the
repo's standing pattern: **fetch the rows once, aggregate in JS with a `Map`.**

`.rpc(...)` call sites in the repo (full list, `grep '\.rpc\('` across `src`):
- `extend-recurring-horizons/route.ts:273`
- `createBookingTransaction.ts:140` (`create_booking_request`)
- `admin/availability/actions.ts:91` (`save_availability_day`)
- `admin/bookings/recurring-actions.ts:167`
- `admin/staff/actions.ts:532` (`save_staff_availability_day`)

None of these compute a per-group aggregate count — they are all transactional/write RPCs. There is
no `GROUP BY`-style RPC in the codebase to reuse.

The actual precedent for "count per key from a flat row set" is
`getRetentionRate`, `src/app/admin/reports/reporting.ts:1260-1281`:
```ts
const completedCounts = new Map<string, number>();
for (const booking of bookings) {
  if (booking.status !== "completed") continue;
  if (!booking.client_id) continue;
  completedCounts.set(booking.client_id, (completedCounts.get(booking.client_id) ?? 0) + 1);
}
const totalClients = completedCounts.size;
let retainedClients = 0;
for (const count of completedCounts.values()) {
  if (count >= threshold) retainedClients += 1;
}
```
This is exactly the shape needed: filter to `status === "completed"`, bucket by `client_id` in a
`Map`, read the count per key. `client-metrics.ts` (`getClientLifetimeMetrics`,
`completedBookings.length`) is the same idea at single-client granularity. Both operate on rows
already fetched by one prior query — the counting itself never re-queries the DB per group.

### g) Simplest shape satisfying "one query per tick"

**Shape:**
```ts
const { data } = await supabase
  .from("bookings")
  .select("id, client_id")
  .eq("status", "completed")
  .in("client_id", candidateClientIds); // dedup'd client_ids from this tick's candidates
```
then in JS:
```ts
const completedCounts = new Map<string, number>();
for (const row of data ?? []) {
  completedCounts.set(row.client_id, (completedCounts.get(row.client_id) ?? 0) + 1);
}
```
`completedCounts.get(clientId)` is then the classification count for that client, inclusive of the
candidate itself (see h — the candidate is already `status = 'completed'` in the DB at read time,
so it is a row in this same result set).

**Is this acceptable under the plan's rule?** Yes. The rule (per the task's own framing) forbids N
queries *per candidate* — it does not forbid in-JS aggregation. This shape is exactly one
`SELECT ... WHERE status='completed' AND client_id IN (...)` per cron tick, regardless of how many
of the tick's ≤50 candidates share client_ids; the `.in("client_id", candidateClientIds)` list is
built once (deduplicated) before the query, not once per candidate. This is the same one-query
plus in-JS-`Map` pattern the repo already uses in `reporting.ts:1260-1281` for the structurally
identical problem ("completed-booking count per client_id"), so it is idiomatic, not a new
technique introduced for this feature.

Scale check: 15 bookings live today, 50-candidate cap per tick → at most 50 distinct client_ids in
the `.in()` list and a proportionally small result set. No pagination or batching concern at this
volume.

### h) Is the boundary rule satisfiable — is the candidate's own status already 'completed' at read time?

**Yes**, confirmed directly from the candidate query's own WHERE clause,
`src/app/api/cron/review-emails/route.ts:107-114`:
```ts
const { data: candidates, error: queryErr } = await supabase
  .from("bookings")
  .select("id")
  .eq("status", "completed")          // line 110
  .is("review_email_sent_at", null)
  .gte("completed_at", sevenDaysAgo)
  .lte("completed_at", twoHoursAgo)
  .limit(50);
```
The candidates query filters `.eq("status", "completed")` (line 110) directly on `bookings`. Every
row the cron reads as a "candidate" is, by construction of this WHERE clause, already
`status = 'completed'` in the database at read time — there is no intermediate state where a
candidate is read before its status flips to completed. Consequently, when Query 2's classification
count runs (`status='completed' AND client_id IN (candidateClientIds)`), the candidate booking's own
row is naturally present in that same result set — "inclusive of the candidate booking itself" is
satisfied for free, with no special-casing needed to add it back in.

### Query 2 — overall verdict

No GROUP BY/RPC precedent exists, but the repo has a clean, repeatedly-used precedent
(`reporting.ts:1260-1281`, `client-metrics.ts`) for one-query-then-`Map`-aggregate. The simplest
compliant shape is `select id, client_id from bookings where status='completed' and client_id in
(candidateClientIds)`, counted in JS — one query per tick, not per candidate. The inclusive-of-
candidate requirement is automatically satisfied because the candidates query itself only ever
reads rows that are already `status='completed'` (confirmed at route.ts:110).

---

## Summary table

| # | Question | Answer |
|---|---|---|
| a | Real FK `email_delivery_events.booking_id → bookings.id`? | Yes, `ON DELETE CASCADE` |
| b | `.in()`/`.not()` precedent on embedded columns? | Yes — `assignment-eligibility.ts:244` (`.in`), `bookings-list-data.ts:535` (`.not`) |
| c | `booking_id` nullable? Effect of `!inner`? | Nullable; `!inner` drops null-FK rows silently; harmless here (no such rows are ever written for this event_type) |
| d | `email_delivery_events` columns | 16 columns, listed above; all 4 needed by Query 1 present |
| e | Client typing / nested-embed read pattern | Admin client has no `Database` generic (untyped); repo pattern is `row.bookings as unknown as {...}` (`assignment-eligibility.ts:276-280`) |
| f | Per-group count precedent | No RPC/embedded-count precedent; repo precedent is fetch-once + `Map` aggregation (`reporting.ts:1260-1281`) |
| g | Simplest one-query-per-tick shape | `select id, client_id from bookings where status='completed' and client_id in (candidateClientIds)`, counted in JS — acceptable, matches existing precedent |
| h | Boundary rule satisfiable? | Yes — candidates query itself filters `status='completed'` (`route.ts:110`), so inclusion is automatic |

All line numbers above were re-located by symbol name against current HEAD
(`91a5864538d33b98c64d6bfc064de0034131b329`) rather than trusted from the plan's prior citations;
none drifted from what this verification pass found.
