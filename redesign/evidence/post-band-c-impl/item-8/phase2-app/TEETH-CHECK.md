# TEETH-CHECK — item 8 Phase 2

Same harness and rules as Phase 1: assert the cut anchor occurs exactly once,
apply the mutant, run the named test, restore in a `finally`, assert the
restored bytes are byte-identical. All five restores passed byte-identity.

Phase 2 is mostly *deletions*, so the mutants restore what was removed. A test
that still passes with the gate put back would be proving nothing.

## Results — 5 of 5 HAS_TEETH

| # | Mutation | Test that must go red | Verdict |
|---|---|---|---|
| M1 | Restore a service-area `superRefine` on `bookingLocationSchema` | `accepts an out-of-zone city and lets the customer continue to time selection` | **HAS_TEETH** |
| M2 | Reintroduce a hardcoded town list in `booking-schema.ts` | `no longer exports a hardcoded town list or a service-area refinement` | **HAS_TEETH** |
| M3 | Restore the city gate in `loadContextRest` | `returns the same availability for a city outside the free-travel list` | **HAS_TEETH** |
| M4 | Restore the old blocking outside-coverage copy | `surfaces an informational, non-blocking notice when the selected address is out of area` | **HAS_TEETH** |
| M5 | Make `AboutYouStep` ignore the prop and hardcode towns again | same test | **HAS_TEETH** |

M4 and M5 target the same test deliberately: one proves the *copy* is no longer
a refusal, the other proves the town list genuinely comes from the prop rather
than a constant. Either regression alone turns the notice back into a lie.

## Live end-to-end proof, beyond the unit tests

`POST /api/availability/` against the Owner's dev server and the live database,
same date and service, three cities:

| City | In free-travel list? | Slots returned |
|---|---|---|
| Luton | yes | full day, from 08:00 |
| Harpenden | **no** | **identical to Luton** |
| Manchester | **no** | **identical to Luton** |

Harpenden is the exact town the plan uses to describe the defect: a customer
was shown a green "covered" tick by the five-town client constant and then an
empty calendar by the two-town database gate. Both now agree, because neither
gates any more.

## Database state at the time of this check

`create_booking_request` no longer raises on the city. Verified independently
of the migration's own assertions: exactly 1 function of that name (no
overload was created), body md5 `6b5fb9de14dd01ffe978e72d3e818066` matching the
committed migration file byte for byte, **0** functions and **0** RLS policies
referencing `allowed_cities`, and `bookings` unchanged at 15 rows.

The only remaining reference to `allowed_cities` anywhere is the deliberate
dual-write in `settings/actions.ts`, which Step Z removes after the deploy.
