# TEETH-CHECK — item 8 Phase 1 application code

Every guard added in this commit was verified by **mutating the source**, running the
named test, restoring, and asserting the restored bytes were byte-identical to the
original. A guard test that still passes with its guard removed is worse than no
guard — one already shipped in this programme, which is why this step is mandatory.

Harness: a Python driver that, per mutant,

1. reads the file with `newline=""` and **detects** the line ending rather than
   assuming CRLF (the Edit tool rewrites working copies to LF);
2. asserts the cut anchor occurs **exactly once** before slicing, and aborts otherwise;
3. writes the mutant, runs `npx vitest run <path>`, records the exit code and which
   expected failure titles appeared;
4. restores the original text in a `finally`, then asserts
   `restored_bytes == original_bytes`.

All six restores passed the byte-identity assertion. `git status --porcelain -- src/`
after the run showed only this commit's own files plus the standing
` M src/lib/maintenance.ts`.

## Results — 6 of 6 HAS_TEETH

| # | Mutation | Test that must go red | Exit | Verdict |
|---|---|---|---|---|
| M1 | Delete `allowed_cities: freeTravelCities,` from the upsert payload (i.e. make it a rename instead of a dual-write) | `writes the town list to free_travel_cities and allowed_cities together` | 1 | **HAS_TEETH** |
| M2 | Delete the owner-only mileage-origin permission block entirely | `rejects a mileage-origin change from an admin and writes nothing` | 1 | **HAS_TEETH** |
| M3 | Change `?? null` to `?? ""` in the stored-origin normalisation | `treats a blank submitted origin as unchanged when none is stored` | 1 | **HAS_TEETH** |
| M4 | Write `mileage_origin` unconditionally instead of omitting it when unsubmitted | `lets an admin save other settings while the origin field is absent, without clearing it` | 1 | **HAS_TEETH** |
| M5 | Delete the minimum-one-free-travel-area check | `rejects an empty free-travel list with the reworded message` | 1 | **HAS_TEETH** |
| M6 | Revert `availability.ts` to read `settings.allowed_cities` | the four `lib/booking` fixtures — surfaced as `Location is outside the service area` | 1 | **HAS_TEETH** |

In every case the expected failure title was found in the output, so the suite failed
for the intended reason and not incidentally.

## What each mutant proves

- **M1** is the one that matters most. The dual-write has no other enforcement: the
  admin client is untyped, so `tsc` cannot see a missing payload key; the pre-existing
  test asserted only `upserts.toHaveLength(1)` and never inspected the keys; and a
  PostgREST upsert leaves columns absent from the payload untouched, so a dropped
  `allowed_cities` would silently freeze the live booking gate at its last value while
  every visible surface reported success. M1 closes that hole.
- **M3** and **M4** are siblings, not duplicates. M3 covers the comparison (a raw `""`
  is never `!==`-equal to a stored `NULL`, which would have marked every save a change
  and locked Admins out of the settings page permanently). M4 covers the write (an
  unconditional payload field would blank the owner's origin on every Admin save even
  after the comparison was fixed). Fixing either alone leaves the other live.
- **M6** confirms the four `lib/booking` fixtures genuinely hold `availability.ts`'s
  column read in place, and re-confirms that a missed fixture rename fails **loudly**
  rather than silently — overturning the plan's §8.4 "silent if missed" wording for the
  second time, now from the opposite direction (mutating the source rather than the
  fixture).
