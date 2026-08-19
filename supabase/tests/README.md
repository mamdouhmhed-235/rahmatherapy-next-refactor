# `supabase/tests/` — SQL regression tests for the booking rules

These close **C2**: the booking-capacity rule — the defect that blocked the release — had no automated
test, only a "VERIFY AFTER APPLYING" comment in a migration. It now has twelve.

---

## ⛔ How these run, and why it is safe

There is **no pgTAP and no test database.** Supabase branching needs the Pro plan and this project is on
Free (Owner decision D-013: test on production, skip the rebuild proof). So every case runs **against
production, inside a transaction that is rolled back**.

That is not a compromise — it is airtight, and it was verified before being relied on:

```sql
begin;
insert into public.clients (...) values ('ZZTEST-rollback-probe', ...);
select count(*) from public.clients;   -- 16
rollback;
select count(*) from public.clients;   -- 15   ← nothing persisted
```

Because the transaction never commits:

- **No row survives.** Not the test bookings, not the test therapists, not the test clients.
- **No other session ever sees the changes.** Postgres MVCC means an uncommitted `update
  business_settings set booking_status_enabled = false` is invisible outside this transaction, so
  **online booking is never actually paused for a real customer** even while case B10 runs.
- **No email is sent.** These call the database function directly. The send lives in the application
  layer (`notifications.ts`), which is never loaded on this path. This is why `@probe.invalid`
  addresses are correct here and must **not** be changed to the live address — an unroutable RFC 2606
  address is right precisely where no send can occur.

⛔ **Every case still uses the `ZZTEST-` name prefix**, so that if a transaction ever did commit by
accident the rows are instantly identifiable and deterministically deletable.

⛔ **Client `Badar` (`clients.id = 4978ae6d-79d0-4119-a8c0-fd374e8dc75d`) is real.** No case selects "an
existing client" or "the first row" — every fixture creates its own rows by name. That is exactly how
`Badar` would otherwise get hit by accident.

## Running them

```bash
node scripts/verify-system-integrity.mjs --save /tmp/before.json
```

Then run `10-capacity.sql` — each `begin … rollback` block is independent. Paste a block through the
Supabase MCP `execute_sql`, or through the SQL editor in the Supabase dashboard. Then:

```bash
node scripts/verify-system-integrity.mjs --save /tmp/after.json
diff /tmp/before.json /tmp/after.json      # MUST be empty
```

⛔ **The diff being empty is part of the test.** If it is not empty, a transaction committed — find out
which and delete the `ZZTEST-` rows before doing anything else.

## Two mechanics the cases depend on

**1. Impersonating the service role.** `create_booking_request` refuses any caller whose `auth.role()`
is not `service_role`, and through `execute_sql` you arrive as `postgres` with no JWT. So each block
starts with:

```sql
set local request.jwt.claims = '{"role":"service_role"}';
```

`set local` means it dies with the transaction. The guard itself is tested — as `anon` and as
`authenticated` the function raises `42501`.

**2. Deterministic capacity.** The function counts *real* eligible staff, and production has twelve.
Each block therefore parks them all and creates exactly the therapists the case needs:

```sql
update public.staff_profiles set can_take_bookings = false;   -- rolled back
insert into public.staff_profiles (...) values ('ZZTEST-TF1', ...);
```

Readers never block on this in Postgres, so a real booking running concurrently is unaffected.

## Choosing dates

Cases use **2026-09-15** (Tuesday, BST) and **2026-11-16** (Monday, GMT).

⛔ **Check the weekday before changing a date.** `availability_rules` has Sunday as a non-working day, so
a Sunday fixture fails with *"Not enough … therapists available"* — the capacity error, not the error the
case is testing. That mistake was made and caught while writing these: 2026-11-15 is a Sunday and gave
two false results.

⛔ **Check the date is inside the window you are testing.** A notice-window case only exercises the
notice check if the date is genuinely inside `minimum_notice_hours`. 2026-11-16 is 89 days out, so it
needs `minimum_notice_hours = 2400` (100 days) to fall inside — at 720 it sits outside and the booking
is correctly accepted, testing nothing. That mistake was also made and caught.

## What is NOT covered here

- **The rebuild.** Applying all 76 migrations to an empty database and diffing against production is
  still unproven — it needs an empty database and there is not one. Owner decision D-013.
- **Concurrency.** Two simultaneous bookings for the last slot (the advisory-lock test) must never be
  attempted against production, because a failure *is* a double-booking. That is gate 11 and it stays
  blocked.
- **RLS behavioural scoping.** Those cases need seeded `auth.users` rows.
