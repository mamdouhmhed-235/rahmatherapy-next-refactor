# TEETH-CHECK — item 8 Phases 3 + 5 (chip gating)

Same harness and rules as Phases 1 and 2. All six restores passed byte-identity.

This is the only code in the repo that moves money, so every guard was mutated.

## Results — 6 of 6 HAS_TEETH

| # | Mutation | Test that must go red | Verdict |
|---|---|---|---|
| M1 | Remove the quick-confirm chip filter — **the bypass itself** | `hides the quick-confirm chip when the address is outside the free-travel zone and travel_fee is 0` | **HAS_TEETH** |
| M2 | Flip the empty-list fail-safe from "inside" to "outside" | `leaves the quick-confirm chip alone when the free-travel list is unavailable` | **HAS_TEETH** |
| M3 | Remove the completed lock | `rejects a travel-fee change on a completed booking` | **HAS_TEETH** |
| M4 | Remove the fully-paid lock | `rejects a travel-fee change on a fully-paid booking` | **HAS_TEETH** |
| M5 | Treat the previous fee as always 0 (double-charge on a second edit) | `tracks total_price and amount_due through a fee change, and never moves amount_paid` | **HAS_TEETH** |
| M6 | Treat an absent `travel_fee` field as 0 | `leaves the totals untouched when the fee is not part of the submitted form` | **HAS_TEETH** |

## Why M2 and M6 exist

Both are failure modes that a reasonable implementation gets backwards.

**M2 — the fail-safe direction.** If the free-travel list arrives empty, is every
address chargeable, or none? Reading it as "outside" would hide the quick-confirm
chip on **every booking in the system** the moment a settings read failed. The
settings form enforces a minimum of one entry, so an empty list is never a real
configured state — it means the read failed, and the safe answer is to leave
existing behaviour alone.

**M6 — absent versus empty.** The two notes forms re-post a subset of the status
form's fields and never carry `travel_fee`. Treating an absent field as 0 would
silently strip the travel charge off a booking every time an admin edited a note.
That is the same class of bug as Phase 1's mileage-origin wipe, in a different
place, and it is caught by the same absent-vs-empty discipline.

## Money arithmetic, proved separately

`src/lib/booking/__tests__/travel-fee.test.ts` (10 tests) pins the arithmetic
itself, including the plan's worked example — a £45 service for 2 participants
with a £14 fee reaches **£104**, not `(45 + 14) × 2 = 118` — and the exact float
hazard that motivates integer pence: `45.30 - 14.30 + 20.10` is
`51.099999999999994` in IEEE-754, which `total_price`'s `numeric(10,2)` scale
would round on write while the unscaled `amount_due` would not, leaving the two
columns silently disagreeing by a fraction of a penny.

A bug in that helper was caught before it shipped: the first draft rejected
valid input, because `14.30 * 100` is `1429.9999999999998`, so a numeric
precision check failed on exactly the values it was meant to accept. The check
is now made against the text.

## Database state

`bookings.travel_fee numeric(10,2) NOT NULL DEFAULT 0`, applied as version
`20260811234948`. Post-apply: 15 rows unchanged, 0 rows with a non-zero fee, and
0 rows where `total_price` and `amount_due` disagree — the additive migration
disturbed nothing.
