# HANDOFF — 2026-08-12 (third implementation session)

**Read this file first, end to end.** Then `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`
§0.0a, §0.0b, §0.0c, §1, §10 and §11 before opening any item section.

The three earlier handoffs are still live and are **not** superseded:
- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19.
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — gotchas 1-15.
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — gotchas 16-27.

This file adds §5's **new** gotchas 28-40. Nothing is mid-flight. No agent is running.
Every change is committed. The tree is clean apart from the one standing dirty path.

| | |
|---|---|
| **HEAD** | `a7019fc` |
| **Branch** | `master` |
| **Shipped this session** | Item 8 **Phases 1-4 COMPLETE**, plus Phase 5's **chip gating** (in Phase 3) and **email half** |
| **Next** | Item 8 **Phase 5's remaining customer copy** (needs Owner sign-off) → item 1 Batch B → item 7 → item 5 → Step 0.5 → Step Z |
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

**The live three-way service-area contradiction is FIXED and verified end to end.**
`POST /api/availability/` now returns identical slots for Luton, **Harpenden** and
Manchester against the running dev server and the live database. Harpenden is the exact
town the plan uses to describe the defect.

---

## 2 — ⛔ GATE BASELINES. Use these, not any earlier file's numbers.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2347 passed (2352)   <-- was 2295/2300 at session start
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

**+52 tests added this session**, all passing. **28 mutants teeth-checked**; 27 HAS_TEETH on
the first pass, and the 28th was **found toothless and replaced** — see gotcha 39.

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
| 12 | May agents authenticate using `.env`? | **Yes** — see gotcha 30. The rule was never "tests cannot log in"; it is that no agent may *handle* a credential. The Playwright harness never exposes one |

---

## 5 — NEW GOTCHAS (28-40). Each cost real time this session.

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

**Everything else checked held.** All 24 Phase-1 anchors, all Phase-2 anchors, and all
Phase-3 anchors in `bookings/actions.ts` were exact — **zero drift across three phases**.

---

## 7 — What is left, in order

### ✅ Item 8 Phase 4 — DONE (`9e65184`, `a7019fc`)

One deviation from the plan, deliberate and tested: §8.7's step 3 specifies a single bulk
UPDATE using one shared `$oldFee`. That is **wrong for any series where an occurrence was
individually adjusted** — each occurrence's delta must come from its own current fee, or a
booking carrying an override has its total corrupted. Implemented per-occurrence, with a
mutant proving the test catches the plan's version.

### NEXT: Item 8 Phase 5's remaining customer copy — NEEDS OWNER SIGN-OFF

### (superseded) Phase 4's original brief, retained for the record

⛔ **Zone-2 ×2, both needing Owner approval:**
```sql
alter table public.recurring_booking_templates add column travel_fee numeric(10,2) not null default 0;
```
plus `CREATE OR REPLACE FUNCTION create_recurring_booking_series(..., p_travel_fee numeric default 0)`
— apply that one with the gotcha-31 technique, **not** by retyping.

**⛔ The single most likely thing to get wrong**, and the plan says so: the fully-paid skip
**cannot be a single PostgREST filter**, because it compares two columns to each other.
There is no working `.filter("amount_paid", "lt", "amount_due")` through the JS client. Use
fetch → partition in application code → update, and report `{ updated, skipped }`.

**Reuse, do not reimplement:** `src/lib/booking/travel-fee.ts` holds the pence arithmetic
(`applyTravelFeeDelta`, `toPence`, `parseTravelFee`, `isInFreeTravelArea`). The cron at
`extend-recurring-horizons/route.ts:419-420` and the new series action both need the
identical maths. Register the new audit action type in `admin/audit/format.ts` — note
`recurring_series_cancelled` is *already* missing from it and renders miscategorised, a
pre-existing out-of-scope defect.

### Then, in this order

1. **Item 8 Phase 5's remainder — CUSTOMER COPY ONLY; the email half shipped in
   `22fc321`.** What is left: the `ConfirmStep.tsx` payment-acknowledgement checkbox
   (`:232-236` — it lists "service and participant count" and must also name the travel
   charge), the new restatement beside the `.reassurance` divs (`:266-280` — a *separate*
   edit from the checkbox, easy to conflate into one), `AboutYouStep`'s **final** notice
   copy, the request-received email reword (`notifications.ts` `sendBookingCreatedEmails`
   — it legitimately shows a pre-fee total, so reword rather than refactor), and the
   `/booking/manage` line-item split (copy-only; the number is already correct).
   ⛔ **STOP CONDITION: the final customer-facing wording naming the travel charge and the
   mileage origin needs Owner sign-off. Do not invent it.** The interim Phase 2 copy is in
   place and is not false — it simply says an out-of-zone address can still be booked.
   ⛔ The labelled fee line must live **inside** the fixed `renderSummary`/
   `renderBookingPlainText` bodies, never as an overridable `SafeField`.
2. **Item 1 Batch B** — manual admin send, **new tab** on `/admin/emails`. Plus **Step 1e**
   (vary review copy by client class; approved, unimplemented).
3. **Item 7** — all phases in **one pass**, no Phase B split.
4. **Item 5** — needs the one sanctioned `pnpm build`; coordinate, it writes the same
   `.next/` the Owner's dev server serves.
5. **Step 0.5's tooling half.**
6. **Step Z** — `DROP COLUMN allowed_cities` + delete the dual-write in
   `settings/actions.ts`. **AFTER the deploy, at the very end.**

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

## 9 — Known-but-not-fixed, recorded deliberately

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
