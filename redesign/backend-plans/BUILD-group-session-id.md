# Backend Plan: Group Session ID — Split-Time Mixed-Gender Group Bookings

**Zone:** 2 (new DB column + migration + extended server action)
**Priority:** DEFERRED — Phase 2. Not in scope for booking-new current session. Documented for future implementation.
**Depended on by:** booking-new (Phase 2 mixed-gender group with different times)
**Depends on:** None

---

## 1. Problem (Phase 2)

Option C for group bookings (Phase 1) creates one booking record even when mixed-gender participants pick different time slots. In Phase 1, the coordinator sees per-gender availability sections but the form submits one `start_time` for all participants — the second time slot is silently ignored.

Phase 2 needs to support: a mixed-gender group where male participants book at 2pm and female participants book at 4pm. These must be separate booking records (different `booking_date`/`start_time`) but linked to show as one group in the admin UI.

---

## 2. Scope of change (Phase 2 — DEFERRED)

### 2a. Migration — add `group_session_id` to `bookings`

```sql
alter table public.bookings
  add column if not exists group_session_id uuid null;

create index if not exists bookings_group_session_id_idx
  on public.bookings (group_session_id)
  where group_session_id is not null;
```

`group_session_id` is a client-generated UUID shared by all booking records that belong to the same group session. It is `NULL` for single-participant bookings and same-time group bookings (one record, `group_booking = true` handles those).

### 2b. `createManualBooking` extension

When a mixed-gender group has different `start_time` values per gender group:

```typescript
// If maleStartTime !== femaleStartTime for a mixed-gender group:
const groupSessionId = crypto.randomUUID();

// Create booking for female participants
const femaleResult = await createBookingTransaction({
  ...baseInput,
  details: {
    ...details,
    participantGenders: femaleGenders,
    participantNames: femaleNames,
    // ...
  },
  preferredTime: femaleStartTime,
  groupSessionId, // new optional field
}, adminClient);

// Create booking for male participants
const maleResult = await createBookingTransaction({
  ...baseInput,
  details: {
    ...details,
    participantGenders: maleGenders,
    participantNames: maleNames,
  },
  preferredTime: maleStartTime,
  groupSessionId,
}, adminClient);
```

### 2c. `createBookingTransaction.ts` extension

Add `groupSessionId?: string` to `CreateBookingTransactionInput`. If present, write it to the `bookings` table:

```typescript
// In the booking insert:
group_session_id: input.groupSessionId ?? null,
```

### 2d. Admin UI changes (Phase 2)

- `booking-detail-brief.md`: add a "Group session" sidebar card linking to sibling bookings via `group_session_id`
- `bookings-brief.md`: BookingListCard shows a "Split group" badge when `group_session_id` is set and `group_booking = true`

---

## 3. Phase 1 vs Phase 2 distinction

| Scenario | Phase 1 behaviour | Phase 2 behaviour |
|---|---|---|
| Same-gender group, any time | One booking record, `group_booking = true` | Same |
| Mixed-gender group, same time | One booking record, `group_booking = true` | Same |
| Mixed-gender group, different times | One booking record, second time ignored | Two booking records, `group_session_id` links them |

---

## 4. UI changes needed in booking-new (Phase 2)

Step 3 for mixed-gender groups:
- Show TWO time pickers (female participants, male participants) — Phase 1 shows both but submits only the last selected
- Phase 2: if times differ, form submits BOTH times and the server action creates two records
- Confirmation in step 4: shows TWO booking summaries side by side (female group + male group)
- Submit button: "Submit booking requests" (plural)

---

## 5. Status

`[ ]` Not started — DEFERRED to Phase 2
