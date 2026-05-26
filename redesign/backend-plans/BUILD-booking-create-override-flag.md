# Backend Plan: Booking Create — Override Availability Flag

**Zone:** 2 (code + migration, no new external service)
**Priority:** Non-blocking (Phase 6 booking-new session can ship without this; override path degrades gracefully to a server error until it lands)
**Depended on by:** `booking-new` (override mode), `booking-detail` (manual admin assign without availability check)
**Depends on:** None

---

## 1. Problem

The `create_booking_request` Postgres RPC raises a Postgres exception (`raise exception`) when `v_required_male > v_available_male` or `v_required_female > v_available_female`. This means admin users **cannot create a booking at a time when no same-gender therapist is available** — even when they want to create an unassigned booking that will wait for a therapist to claim later.

The admin `booking-new` page needs an "Override availability" escape hatch so coordinators can book a client at a requested date/time even if no therapist is immediately bookable, then let the booking sit unassigned.

---

## 2. Scope of change

### 2a. Supabase migration — `create_booking_request` RPC

Add `p_override_availability boolean default false` parameter. When `true`, skip the `v_required_male > v_available_male` and `v_required_female > v_available_female` exception blocks.

The rest of the RPC (date validation, city validation, booking/participant/assignment inserts) runs identically. The booking is created with `assignment_status = 'unassigned'` as normal — overriding availability does not pre-assign anyone.

```sql
-- Add to function signature:
p_override_availability boolean default false

-- Wrap the availability checks:
if not p_override_availability then
  if v_required_male > v_available_male then
    raise exception 'Not enough male therapists available';
  end if;
  if v_required_female > v_available_female then
    raise exception 'Not enough female therapists available';
  end if;
end if;
```

### 2b. `createBookingTransaction.ts`

Add `overrideAvailability?: boolean` to `CreateBookingTransactionInput`.

Pass it to the RPC call:
```typescript
p_override_availability: input.overrideAvailability ?? false,
```

### 2c. `actions.ts` — `createManualBooking`

Read the hidden form field and pass it through:
```typescript
overrideAvailability: formData.get("override_availability") === "on",
```

Add to the `manualBookingSchema`:
```typescript
overrideAvailability: z.boolean().default(false),
```

Pass to `createBookingTransaction`:
```typescript
overrideAvailability: parsed.data.overrideAvailability,
```

### 2d. `ManualBookingForm.tsx`

When override mode is active, include:
```html
<input type="hidden" name="override_availability" value="on" />
```

---

## 3. Audit log

No change to the audit log format. The `manual_admin_booking_created` log entry already captures the booking outcome. The UI labels the override at creation time with the Attention-family banner; the DB record does not need a separate `overridden` flag (the `assignment_status = 'unassigned'` is the persistent signal).

---

## 4. RLS / permissions

No change. The RPC is `security definer` called via the admin client (service role). The service role bypass is already in place.

---

## 5. Rollback

The new parameter has `default false`, so it is fully backwards-compatible. All existing callers (customer-facing booking flow, existing admin `createManualBooking`) continue to work without passing the flag.

---

## 6. Test cases

- Submit admin booking at date/time with no available therapists, `override_availability = false` → server returns availability error
- Submit admin booking at date/time with no available therapists, `override_availability = true` → booking created, `assignment_status = 'unassigned'`, no exception
- Submit admin booking at date/time with available therapists, `override_availability = true` → booking created normally (override does not break the happy path)
- Customer-facing booking flow (does not send `override_availability`) → behaviour unchanged

---

## 7. Migration file name

`{timestamp}_add_override_availability_to_create_booking_request.sql`

Place in `supabase/migrations/` following the existing timestamp convention.

---

## 8. Dependencies / sequencing

- Can be built at any point before or after Phase 6 booking-new session
- If shipped before: the "Override" button in the admin form is fully functional
- If shipped after: the "Override" button exists in the UI; clicking it and submitting surfaces the RPC exception as a form error ("No therapists available for that slot. Pick another date, or contact the owner to force-assign manually.")
- No other plan file depends on this one

---

## 9. Author notes

This is intentionally a minimal change — one new `boolean` parameter, two guarded `if` blocks. Do not add a separate `override_log` table or `override_reason` field at this stage; the simplest implementation unblocks the UI requirement cleanly.

---

## 10. Status

`[ ]` Not started
