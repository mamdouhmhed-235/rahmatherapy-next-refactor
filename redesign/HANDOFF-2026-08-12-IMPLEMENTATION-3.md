# HANDOFF — 2026-08-12 (third implementation session)

> ⛔ **SUPERSEDED FOR POSITION AND NEXT-STEPS by
> `HANDOFF-2026-08-12-IMPLEMENTATION-4.md`. Read that one first.**
> HEAD is no longer `eb213fe`, and items 1, 5 and Step 0.5 have since completed.
> **This file's §5 gotchas 28-41 remain live and are NOT superseded** — the
> newer file adds 42-53 on top of them. Its §2 gate baselines and §7 next-steps
> are stale; use the newer file's.

**Read this file first, end to end.** Then `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`
§0.0a, §0.0b, §0.0c, §1, §10 and §11 before opening any item section.

The three earlier handoffs are still live and are **not** superseded:
- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19.
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — gotchas 1-15.
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — gotchas 16-27.

This file adds §5's **new** gotchas 28-41. Nothing is mid-flight. No agent is running.
Every change is committed. The tree is clean apart from the one standing dirty path.

| | |
|---|---|
| **HEAD** | `eb213fe` |
| **Branch** | `master` |
| **Shipped this session** | ✅ **ITEM 8 COMPLETE — all five phases** |
| **Next** | **Item 1 Batch B** + Step 1e → item 7 (one pass) → item 5 → Step 0.5 → Step Z |
| **Deploy** | Still deferred, **to the very end of the plan, by Owner decision** |

---

## 1 — What happened this session, in order

| Commit | What |
|---|---|
| `46f9369` | **Item 8 Phase 1 application code.** 13 files. Reads `free_travel_cities`, adds an Owner-only mileage origin, and **dual-writes both city columns** |
| `9c7093d` | **e2e browser proof** of the Owner-only origin — 3 tests, first spec to authenticate |
| `c188995` ⛔Zone-2 | **Item 8 Phase 2.** All three service-area gates removed. Migration applied as version `20260811230807` |
| `eb2b6c2` ⛔Zone-2 | **Item 8 Phase 3 + Phase 5 chip gating.** `bookings.travel_fee`, applied as version `20260811234948` |
| `3866d24` | Fully-paid lock fix found by the adversarial money review **after** Phase 3 landed |
| `a378cc6` | This handoff (first revision) |
| `22fc321` | **Item 8 Phase 5, email half** — labelled travel-charge line across the 8 touch points |
| `1f786b1` | Handoff revision + gotcha 39 |
| `9e65184` ⛔Zone-2 ×2 | **Item 8 Phase 4, database + propagation.** `recurring_booking_templates.travel_fee` and a re-signatured `create_recurring_booking_series`; applied as `20260812083309` and `20260812083317` |
| `a7019fc` | **Item 8 Phase 4, admin half** — `setSeriesTravelFee`, the series panel, audit registration |
| `71d7ebd` | Handoff revision + gotcha 40 |
| `eb213fe` | **Item 8 Phase 5, customer copy** — Owner-approved sentence by sentence. **ITEM 8 COMPLETE** |

**The live three-way service-area contradiction is FIXED and verified end to end.**
`POST /api/availability/` now returns identical slots for Luton, **Harpenden** and
Manchester against the running dev server and the live database. Harpenden is the exact
town the plan uses to describe the defect.

---

## 2 — ⛔ GATE BASELINES. Use these, not any earlier file's numbers.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2352 passed (2357)   <-- was 2295/2300 at session start
pnpm lint           # 59 errors / 7 warnings, the same six files
git status --porcelain -- src/ supabase/   # exactly:  M src/lib/maintenance.ts
```

**The five failures are unchanged and unrelated to every item.** Isolation, per §11.2:

```powershell
npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx   # exactly 3 failed / 33 passed (36)
npx vitest run src/lib/auth/admin-access.test.ts                       # exactly 2 failed / 4 passed (6)
```

**Lint identity held all session** at 59E/7W across exactly six files — *even though this
session edited two of those six* (`BookingExperience.tsx`, `BookingExperienceLoader.tsx`)
and moved their line numbers. That is the `{file, ruleId}` rule working as designed.

**+57 tests added this session**, all passing. **33 mutants teeth-checked**; 31 HAS_TEETH on
the first pass, and **2 were found toothless and replaced** — see gotchas 39 and 41.

---

## 3 — Live database state after this session

| Object | State |
|---|---|
| `business_settings` | **12 columns**. `allowed_cities` AND `free_travel_cities` both `["Luton","Dunstable"]`; `mileage_origin` null |
| `bookings` | **`travel_fee numeric(10,2) NOT NULL DEFAULT 0`** added. **15 rows**, all with fee 0, zero `total_price`/`amount_due` mismatches |
| `create_booking_request` | **No city gate.** Body length 17715, md5 `6b5fb9de14dd01ffe978e72d3e818066` |
| `allowed_cities` references | **ZERO** database objects — 0 functions, 0 RLS policies |
| `permissions` | `manage_travel_origin` granted to **Owner only** |

| `recurring_booking_templates` | **27 columns** — `travel_fee numeric(10,2) NOT NULL DEFAULT 0` added. **0 rows**, so Phase 4 touched no live data |
| `create_recurring_booking_series` | **Re-signatured**: 21 args, ending `p_travel_fee numeric`. Exactly one function survives; 2 fee-applied price expressions in the body |

**Migrations applied this session:** `20260811230807` (Phase 2 gate removal),
`20260811234948` (Phase 3 `travel_fee`), `20260812083309` (template `travel_fee`),
`20260812083317` (series function re-signature).

⛔ **The ONLY remaining reference to `allowed_cities` anywhere is the deliberate
dual-write in `settings/actions.ts`.** Step Z deletes it, after the deploy.

---

## 4 — Owner decisions this session

| # | Decision | Answer |
|---|---|---|
| 10 | Phase 2 migration (remove the service-area gate) | **Approved and applied** |
| 11 | Phase 3 migration (`bookings.travel_fee`) | **Approved and applied**, knowing it meant shipping Phase 5's chip gating in the same unit |
| 13 | Phase 4's two migrations | **Approved and applied** |
| 14 | Phase 5's customer copy | **Approved sentence by sentence**, drafted against the site's existing voice and reviewed before implementation |
| 15 | `"Covered area:"` → `"Free-travel area:"` | **Yes, renamed** |
| 16 | Does customer copy name the mileage origin? | **No — admin-only.** It is NULL today so the sentence would render broken, and since nothing computes from it, naming it implies an arithmetic we do not perform |
| 12 | May agents authenticate using `.env`? | **Yes** — see gotcha 30. The rule was never "tests cannot log in"; it is that no agent may *handle* a credential. The Playwright harness never exposes one |

---

## 5 — NEW GOTCHAS (28-41). Each cost real time this session.

28. **⛔ `test.use({ channel: "chrome" })` MUST be file-level in Playwright.** Inside a
    `describe` it errors out the *entire file* before a single test runs
    (`"Cannot use({ channel }) in a describe group, because it forces a new worker"`).
    `e2e/admin-contrast.spec.ts` has it at file level; copy that, not the describe.

29. **⚠️ The long-running dev server produces stale-render artifacts that look like real
    bugs.** Two hit this session: (a) an error boundary (*"Couldn't load settings."*) on
    the first cold compile of a changed route, and (b) **two `input[name="mileage_origin"]`
    elements in one DOM** — one with a server-style React id (`_r_8_`), one client-style
    (`_R_ihqatpesknelb_`). Neither reproduced on a warm server; two consecutive full runs
    were clean. **Assert `toHaveCount(1)` rather than using `getByLabel`**, so a real
    duplication fails loudly instead of a selector quietly resolving it.

30. **✅ Agents CAN run authenticated e2e specs, and this does not breach the credential
    rule.** `loginAs` (`e2e/helpers.ts:25`) never types a password: it calls
    `supabase.auth.signInWithPassword()` in Node and injects the resulting cookies with
    `page.context().addCookies()`. The secret never reaches the browser or the model.
    ```powershell
    node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/<spec> --project=chromium
    ```
    `playwright.config.ts` loads no env file, so `--env-file` is mandatory, and the CLI is
    at `@playwright/test/cli.js`. **`E2E_BASE_URL=http://localhost:3000`** — the dev
    server, *not* production; check that before running anything credentialed.
    ⚠️ The **MCP browser tools** are still barred: driving a real browser means *something*
    must type the password, which puts it in context.

31. **⛔ Do not apply a large `CREATE OR REPLACE FUNCTION` by retyping its body.** 18KB of
    PL/pgSQL cannot be retyped safely, and a mistyped signature creates an **OVERLOAD**
    rather than replacing the function — silently, leaving two live definitions. Instead
    apply a guarded `DO` block that transforms the function's own
    `pg_get_functiondef()`, asserting the before-md5, that the cut text is present, and
    afterwards that exactly one function exists with the expected after-md5. The
    human-readable full-body file still gets committed; the two are pinned to each other
    by the md5. This is how `20260811210000` was applied.

32. **Verify a migration file against live `prosrc` before treating it as the base.**
    `md5(prosrc)` and `length(prosrc)` compared against the text between the file's
    `$function$` delimiters. They matched exactly (18038 / `723789e4…`), which is what
    made the file safe to slice.

33. **`14.30 * 100` is `1429.9999999999998`.** A money-precision check written as
    `Math.round(v * 100) !== v * 100` rejects exactly the values it exists to accept.
    **Validate money as text** (`/^\d+(\.\d{1,2})?$/`), never by arithmetic. This bug was
    caught in my own helper before it shipped.

34. **`PAYMENT_STATUSES` in `bookings/actions.ts:68` is only `["paid", "unpaid"]`.**
    `"partially_paid"` is NOT valid and fails validation — a partial payment is
    `amount_paid < amount_due` with status `unpaid`. Cost a confusing test failure.

35. **A future-dated booking cannot be marked `completed` or `no_show`** — a guard in
    `updateBookingManagement` returns an error. Any fixture for a *completed* booking needs
    a **past** `booking_date`, or the test fails for a reason unrelated to what it tests.

36. **Making a field required on `BookingRecord` breaks five construction sites** — two
    `normalizeClaimableBooking` helpers and three test fixtures. That is a **feature**, not
    a cost: a select that quietly omitted `travel_fee` would show £0 in the form while the
    row held a real fee, and saving would write that 0 back. Budget for the five edits and
    keep the field required.

37. **⚠️ ABSENT-versus-EMPTY is now a recurring defect class in this codebase. Assume it.**
    It bit twice this session, in unrelated places:
    - `mileage_origin` — a **disabled input is omitted from FormData entirely**, so an
      Admin's save carries no key. Treating absent as `""` wipes the Owner's value.
    - `travel_fee` — the two **notes forms re-post a subset** of the status form's fields
      and never carry it. Treating absent as `0` strips the charge off a booking whenever
      an admin edits a note.
    Both were invisible to `tsc`, to lint, and to every existing test. Whenever a form
    field is conditionally rendered or conditionally posted, distinguish
    `formData.get(k) !== null` from `=== ""`.

38. **⛔ Fail-safe DIRECTION for the free-travel list.** An empty list means the settings
    read **failed** — the settings form enforces a minimum of one entry, so an empty list
    is never a real configured state. `isInFreeTravelArea` therefore returns **true**
    (inside) for an empty list. Reading it the other way would hide the quick-confirm chip
    on **every booking in the system** on a transient fetch failure. Getting this backwards
    is a one-character change with a system-wide blast radius; it has its own teeth-check.

39. **⛔ A SELECT STRING THAT NO STUB HONOURS IS INVISIBLE TO THE TEST SUITE.** Every
    email test stubs Supabase with a hand-built object that returns the whole mock row
    regardless of what the select asked for — the same is true of
    `lib/cache/__tests__/fake-supabase-admin.ts`. So deleting a column from
    `BOOKING_EMAIL_SELECT` breaks **nothing**: proved by mutation, where all four
    behavioural tests stayed green while production would have silently dropped the
    travel charge from every confirmation email. **A select string can only be guarded by
    reading the source text** (`src/lib/email/__tests__/travel-fee-line.test.ts` shows the
    idiom). Assume this applies to every other select in the repo: none of them are
    covered by the stubs that appear to exercise them.

40. **⛔ ADDING A PARAMETER TO A POSTGRES FUNCTION IS NOT A REPLACEMENT — IT IS A SECOND
    FUNCTION.** Postgres identifies a function by (name, argument types), so
    `CREATE OR REPLACE` with an extra parameter leaves the old signature live alongside
    the new one. Worse, if the new parameter has a DEFAULT, every existing call becomes
    **ambiguous** (`function is not unique`) while both exist. Create the new definition
    and `DROP FUNCTION` the old signature **in the same transaction**, then assert
    `count(*) = 1` afterwards. `20260812010100` does this, and c06 set the precedent.

41. **⛔ A SOURCE-TEXT COPY GUARD CAN MATCH THE WRONG COPY.** A guard asserting the
    request-received email's caveat passed with the rendered default **gutted**, because
    the identical wording also sits in that field's `placeholder` — editor affordance, not
    customer copy. Assert against the **registry** (`findTemplate(...).fields.find(...)
    .defaultValue`), not the file. And normalise whitespace in any copy assertion: JSX
    wraps sentences across lines, a reflow is not a copy change, and a guard that fails on
    formatting is noise — noisy guards get deleted, which is worse than not having one.
    This is the second toothless guard mutation caught this session; see also gotcha 39.

**Also re-confirmed:** PowerShell's working directory **persists between tool calls** and
drifted mid-session, making `npx vitest run` report *"No test files found"* — which looks
like a catastrophic failure and is just a wrong cwd. `Set-Location` back to the repo root
before trusting any gate result.

---

## 6 — Plan claims that FAILED verification this session

Add these to the 29 from the deepening pass and the 6 from the second session.

| Where | Claim | Truth |
|---|---|---|
| §8.4 | The Owner-only origin spec (permission check + `beforeState` comparison) | **Incomplete, and dangerously so.** It never says how `mileage_origin` is *written*. Implemented literally — as a normal payload field — an Admin's save blanks the Owner's origin **every time**, because the gate has already passed by then. The check and the write are two separate bugs |
| §8.5c row 10 | Test titled *"rejects a mileage-origin change from an Admin, **but still saves the Admin's other edits**"* | **Contradicts §8.4's own code snippet**, which sets `fieldErrors` and therefore rejects the whole save. Implemented per the snippet: nothing is written |
| §8.5 | "Delete the block" in `availability.ts:454-456` | **Insufficient.** `getAllowedCities`/`isCityAllowed` have no other caller, so deleting only the block leaves two `no-unused-vars` warnings in a **seventh** lint file — a baseline regression. They must go with it |
| §8.5c item 7 | "no test file for `availability.ts`" | **False.** The four `lib/booking/__tests__` fixtures genuinely execute `loadContextRest`/`isCityAllowed`. Four tests at risk, not zero |
| §8.6 | "add `travel_fee` to the `beforeState` select or the delta double-charges" | **Moot, in our favour.** Both `beforeState` reads in `bookings/actions.ts` are `.select("*")`, so `travel_fee` arrives free. The warned-of hazard cannot occur as the code stands |
| §8.6 | The completed/fully-paid lock predicate | **Incomplete.** `amount_due` is independently nullable, so `?? 0` makes a fully-paid booking with a null `amount_due` compute `0 > 0 === false` and skip the lock. Must fall back `amount_due ?? total_price ?? 0`, mirroring `quickUpdateBooking`. Found by the adversarial money review *after* the Phase 3 commit; fixed in `3866d24` |

| §8.7 step 3 | The series fee update as one bulk `UPDATE` with a single shared `$oldFee` | **Wrong for any occurrence carrying a per-booking override.** Each occurrence's delta must come from ITS OWN current fee: `85 - 25 + 14 = 74`, where the plan's shape writes `89`. Implemented per-occurrence, with a mutant proving the test catches the plan's version |
| §8.7 | "`CREATE OR REPLACE FUNCTION create_recurring_booking_series(..., p_travel_fee numeric default 0)`" | **Cannot work as written.** Adding a parameter changes the signature, so `CREATE OR REPLACE` creates a SECOND function and leaves the old one live — and while both exist every 20-argument call is ambiguous. Needs create + `DROP FUNCTION` of the old signature in one transaction (gotcha 40) |
| §8.8 | Customer copy naming the mileage origin (*"measured from {origin}"*) | **Rejected, Owner decision 16.** It is NULL today so the sentence renders broken, and nothing computes from it — naming it implies an arithmetic we do not perform |

**Everything else checked held.** All 24 Phase-1 anchors, all Phase-2 anchors, and all
Phase-3/4 anchors were exact — **zero drift across all five phases**.

---

## 7 — What is left, in order

### ✅ ITEM 8 IS COMPLETE. All five phases shipped.

Nothing in item 8 remains. Do not reopen it. In particular:
- **Do not surface the mileage origin in customer copy** (Owner decision 16).
- **Do not "tidy" the dual-write** in `settings/actions.ts` — that is Step Z's job, after
  the deploy.
- The customer copy is **Owner-approved and test-guarded**
  (`src/features/booking/__tests__/travel-charge-copy.test.ts`). Changing any of those
  strings needs fresh sign-off, not a judgement call.

### 1. NEXT — Item 1 Batch B + Step 1e *(no Zone-2; start here)*

**Batch A already shipped** in `0863573`: the 6-month per-client cooldown and the
repeat/one-off classification, both batched one-query-per-tick, with the class already
written to the audit `after_state`.

**Batch B — the manual admin send:**
- A **new tab on `/admin/emails`** (Owner decision 7), *not* a subsection of Reminders.
  Review requests target `completed` bookings; the Reminders tab lists only upcoming
  `pending`/`confirmed` ones, which is why the plan's original "beside `ReminderResendForm`"
  instruction was unbuildable.
- A new action **mirroring `resendEmail`'s scope check** (`admin/emails/actions.ts:120`).
  ⛔ **Do NOT edit `sendManualBookingReminder`** — RECON-untouchable. Mirror it.
- A new `emails-data.ts` export. Note `getEmailsPageData` spans **:128-254**, not the
  plan's ":142-197" (already corrected once).
- **Register `review_email_sent` in `src/app/admin/audit/format.ts`'s `ACTIONS`** —
  verified absent, and the cron already writes that `action_type`, so it currently renders
  through the generic fallback.
- Quiet hours **do not apply** (Owner decision 3) — matching the existing manual resend.
- Verbatim idioms to mirror: `redesign/evidence/post-band-c-impl/item-1/B-idioms-to-mirror.md`.

**Step 1e** — vary review copy by client class (Owner decision 6, approved, unimplemented).
The seam is `pickReviewMessages({ groupCategory, city, overrides })`; `classifyReviewClient`
already exists and its result is already in the audit trail.

⛔ **`notifications.ts` is shared with item 8, which has now landed — re-grep before
editing it.** In practice Batch B barely touches it.

### 2. Item 7 — admin theming, **all phases in ONE pass**

The Phase B / Phase B-tail split is **obsolete** — it existed only because item 7 was once
scheduled before item 8. Item 8 has shipped, so tokenize every file in one go, including
the five formerly-carved-out ones (`SettingsForm.tsx`, `BookingManagementForm.tsx`,
`bookings/[bookingId]/page.tsx`, `ManualBookingForm.tsx`, `SeriesActions.tsx`).

⚠️ **Several of those files changed materially this session** — re-derive every literal
count from scratch; every figure in §7 of the plan predates item 8.
⛔ **Do not rebuild the three contrast verification layers** — they exist and work.
⛔ **Never compare a Layer 3 sweep against a stored baseline from another day.**

### 3. Item 5 — bundle measurement *(needs the one sanctioned `pnpm build`)*

Coordinate it: the build writes the same `.next/` the Owner's dev server serves from, and
agents may not restart that server.

### 4. Step 0.5's tooling half

Extend `scripts/verify-admin-token-contrast.mjs` to *parse* the prose ratio claims. Still
outstanding from Phase 0.

### 5. ⛔ Step Z — LAST, after the deploy

`ALTER TABLE public.business_settings DROP COLUMN allowed_cities;` **and** delete the
dual-write line in `settings/actions.ts`. Its entire safety argument is that it runs after
the deploy. **Do not schedule it earlier as a tidy-up.**

Safe to run by then: **zero database objects reference `allowed_cities`** (verified this
session), so the only consumer left is that one deliberate line.

---

## 8 — Standing facts (unchanged, restated so this file stands alone)

- **Tree is intentionally dirty**: `git status --porcelain -- src/ supabase/` must show
  exactly ` M src/lib/maintenance.ts`. **Never `git add .`/`-A`; never stash/checkout to
  "clean" it.** Working copy `false`, HEAD `true`, deliberately.
- **Zone-2** = migrations, data-mutating SQL, deploys, package installs, env changes, real
  emails. **Owner-approved per action, orchestrator-performed, never delegated.**
  `mcp__supabase__execute_sql` is SELECT-only, project `twzutkfgqclqurvkmvqz`.
- **⛔ Never send a real email.** Mock the mailer at `@/lib/email/client`.
- **Dev server is Owner-run** at `localhost:3000` (not `127.0.0.1`). Never spawn, restart or
  kill it.
- **⛔ Do not rename `allowed_cities`** (decision 9) and **do not run Step Z early**.
- **Do not "fix" the four pre-existing lint errors** in `BookingExperience{,Loader}.tsx`.
- **Commit messages**: PowerShell here-strings strip double quotes — always
  `git commit -F <scratchpad file>`.
- **Teeth-check every guard** by mutating the source, running, restoring, and asserting the
  restore is byte-identical. The harness used all session is described in each phase's
  `TEETH-CHECK.md` under `redesign/evidence/post-band-c-impl/item-8/`.
- **Business reality that should govern effort**: 15 bookings, all Luton. 6 therapists who
  claim jobs voluntarily; no pay/rate/payout table exists anywhere.

---

## 9 — Method that worked, and is worth repeating

**Mutation-test every guard.** 33 mutants this session; 31 red on the first try, and **2
were TOOTHLESS and had to be replaced**. Both had the same shape: a test that looked like
it asserted the thing but asserted something adjacent to it (a select string no stub
honours; a placeholder that shadows the real default). Neither would have been found by
reading the test. The harness — assert the anchor is unique, mutate, run, restore in a
`finally`, assert byte-identity — is described in each phase's `TEETH-CHECK.md` under
`redesign/evidence/post-band-c-impl/item-8/`.

**Fan out derivation, apply edits yourself.** Three read-only workflows ran this session
(item 8 Phases 1, 2, 3-5), each with independent derivation agents plus adversarial
critics. The critics earned their place twice: one found the `mileage_origin` payload wipe
*before* it shipped, and the money critic found the `amount_due` null gap *after* Phase 3
committed. **Let the critic finish before committing money code** — that ordering mistake
cost an extra commit.

**Verify against the live system where cheap.** `POST /api/availability/` for three cities
proved the defect fixed in one command. `md5(prosrc)` proved a migration file matched the
live function byte for byte. Both were faster than reasoning about it.

---

## 10 — Known-but-not-fixed, recorded deliberately

- **Lost-update race in `updateBookingManagement`.** It reads `beforeState`, computes an
  absolute `total_price`/`amount_due`, then issues a plain `.update()` with no optimistic
  concurrency check. Two concurrent saves silently discard one another. **Pre-existing and
  systemic** — the same race already applies to `status` and `amount_paid` — so the travel
  fee inherits it rather than introducing it. Out of scope; worth a separate item.
- **The free-travel matching predicate now exists in three places** (`isInFreeTravelArea`,
  plus inline copies in `AboutYouStep.tsx` and `ManualBookingForm.tsx`). The *town list*
  has one source of truth, which was the point; the predicate does not. Worth consolidating
  onto the shared helper in a later pass.
- **`e2e/booking-public.spec.ts:7`'s test name** is now slightly misleading (there is no
  "unsupported service area feedback" to show). Cosmetic.
