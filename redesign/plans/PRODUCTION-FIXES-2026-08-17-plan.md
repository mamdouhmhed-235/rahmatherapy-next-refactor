# Production fixes — verified defects and their surgical remedies

**Written 2026-08-17.** ✅ **EXECUTED AND REVIEWED. See the record below.**

## ✅ EXECUTION RECORD — 2026-08-17 / 19

| Fix | Status |
|---|---|
| F1 + F2 | ✅ Code written, **migration APPLIED to production** `20260819072756` |
| F3 health notes | ✅ Data-layer redaction + cache key. ⚠️ First attempt broke the Therapist role (D3); now mirrors `clients/access.ts` |
| F4 staff invitation | ✅ **THREE** false promises removed, not the two reported |
| F5 input caps | ✅ ⚠️ First attempt capped the CLIENT schema, which no server module imports (D1). Server route now capped |
| F6 price parity | ✅ Test added, mutation-tested. ⚠️ First version missed `packagePages.ts` (D7) |
| F7 e2e | ✅ `pnpm test:e2e:auth` added; production-DB hazard documented in `e2e/helpers.ts` |
| F8 migration drift | ⛔ **NOT fixed in code, deliberately.** Procedure in `supabase/migrations/README-MIGRATION-DRIFT.md`; needs Owner-run `supabase db pull` |
| F9 Sentry traces | ✅ `beforeSendTransaction` ×3 + 2 tests |
| F10 series grants | ✅ **APPLIED** `20260819072517`. Pre-flight confirmed `proacl = NULL` = PUBLIC EXECUTE |
| F11 rate limiter | ✅ Logs once; behaviour deliberately unchanged |
| **D8 (new)** | ✅ `create_booking_request` also held PUBLIC EXECUTE. Applied in the same migration |
| **D13 (new)** | ✅ Advisory lock re-keyed to date only |
| **§17.1 (new)** | ✅ `searchClients` returned soft-deleted clients. **§14's "False" row WITHDRAWN.** Fixed + guarded + mutation-tested |
| **§17.2 (new)** | ✅ `getSearchClientIds` had the same missing `deleted_at` filter. Fixed |
| **§17.3 (new)** | ✅ Sentry scrubber leaked a partial manage token **15.06%** of the time (20,000-sample measurement). Pattern order swapped, guarded, mutation-tested |
| **§17.4 (new)** | ✅ Two comments corrected — a `⛔` cache-key comment stating a false invariant, and a §14 scope note. No behaviour change |
| **§17.5** | ⛔ **Four issues found and deliberately NOT fixed** — incl. a live BST bug needing a production migration (Owner approval). See the table |

⛔ **THREE rounds of review were needed.** The third (2026-08-19, §17) found no regression but did
overturn one §14 refutation and one live scrubbing guarantee. The first pass shipped two fixes that did not work (D1, D6)
and eleven further defects. Full record in the commits `58c22ad` (first pass) and `5aab8d6`
(corrections). **A DST bug, a broken Therapist role and an unbounded server schema all survived a
green test suite** — no gate in this repo can see SQL, and the caps were on a file nothing imports.

⛔ **The migrations four functional VERIFY steps have NOT been run** — each requires creating
bookings in production. Approval covered applying the migrations, not writing customer data.

---

**Original plan follows.**

Origin: another agent produced a list of suspected issues. **Every item below was independently
verified against this codebase** — file, line and command recorded. Three of its claims were
**refuted** and two **overstated**; those are in §14 so nobody re-raises them.

⛔ **Count correction:** an earlier chat summary said "9 worth fixing". The accurate figure is
**11 confirmed real**, of which 9 are defects and 2 are hygiene. All 11 are here.

---

## 1 — ⛔ Read before touching anything

| Constraint | Consequence |
|---|---|
| ⛔ **Every commit descends from `3eb2939` (Phase 12)** | Nothing here can be pushed without opening live bookings. All fixes are **local-only** until the Owner ships Phase 12 |
| ⛔ **Production Supabase is live** | Every DB migration needs the Owner's explicit per-action approval before it runs |
| ⛔ **No CI, no staging** | The seven gates plus a cold `pnpm build` are the only safety net |
| **Gate baselines** | tsc 0 · vitest **0 failed / 2501 / 242 files** · lint 4E+1W in three files · scripts 47 · contrast 110 (46/64) · verify 0 · `git status` on `src/`+`supabase/` EMPTY |
| ⚠️ **Check the test COUNT, not the colour** | gotcha 118 — a green run with a lower count is a silent failure |

**One fix per commit.** Two exceptions are called out below where splitting would itself cause a bug.

---

## 2 — Recommended order, and why

| # | Fix | Why here |
|---|---|---|
| **1** | **F8 — migration drift** | ⛔ **First.** Every DB fix below adds a migration on top of a baseline the repo cannot reproduce. Repair the record before stacking on it. Repo-only change; touches no database |
| **2** | **F1 + F2 together** | ⛔ **Same function, one migration.** Both rewrite `create_booking_request`. Two migrations would mean the second rewrites the first |
| **3** | **F3 — health notes** | Highest user-facing severity. ⛔ Its cache-key step is not optional |
| **4** | **F9, F5, F11** | Small, independent, low risk |
| **5** | **F7 — e2e** | Needed before the rest can be meaningfully regression-tested |
| **6** | **F4, F6** | ⛔ Need an Owner decision first — see each |
| **7** | **F10** | Hygiene, non-exploitable |

---

## F1 — ⛔ The booking API accepts more bookings than you have therapists

**Verified.** `supabase/migrations/20260811210000_item8_phase2_remove_service_area_gate.sql:290-302`

The busy-check **INNER JOINs `booking_assignments`** on `ba.assigned_staff_id = v_staff.id`. Every
website booking is created with `assigned_staff_id = null` (same file, line 561-571), so **an
unassigned booking makes nobody busy and consumes zero capacity.**

The read engine gets this right: `src/lib/booking/availability.ts:328` `unassignedReservationCounts()`
counts assignments with a null staff id and subtracts them at line 772
(`Math.max(0, availableStaffByGender.male - unassignedCounts.male)`).

**Plain English:** you have 2 therapists; the API will accept 5 bookings for the same slot. The
customer calendar won't offer it, so it needs a direct POST or a race — and the assignment screen
still refuses to double-book, so nobody turns up twice. **The damage is over-accepting and having to
ring people back.**

**Fix — one `CREATE OR REPLACE`.** Make the write path count unassigned reservations exactly as the
read engine does: alongside the existing assigned-overlap check, subtract assignment rows where
`assigned_staff_id IS NULL`, `status IN ('unassigned','assigned')`, matching
`required_therapist_gender`, whose booking overlaps the requested window.

⛔ **Mirror the read engine's semantics, do not invent new ones** — including its buffer handling, so
the two surfaces cannot drift apart again.

---

## F2 — ⛔ Pause, notice and buffer are not enforced on writes

**Verified.** Zero occurrences of `booking_window_settings`, `is_paused`, `minimum_notice`,
`buffer_time_mins` or `lead_time` anywhere in the write RPC. The read engine enforces notice and
buffer, and returns *"Online booking is currently paused."* at `availability.ts:813`.

**Plain English:** pausing intake closes the booking page, but a hand-crafted POST still gets in. It
lands as **pending**, so you would see it — this is not silent.

**Fix — in the same migration as F1.** Read `booking_window_settings` and reject when paused or
inside the notice window.

⛔ **Do not restore the old checks verbatim** — they would block your own same-day phone bookings.
The RPC already takes `p_override_availability`; **admin-created bookings must bypass these checks,
public ones must not.** Gate on that flag.

---

## F3 — ⛔ Coordinators can read client health notes

**Verified.** `src/app/admin/bookings/[bookingId]/page.tsx:758-767` renders `participant.health_notes`
with **zero** permission checks — a `grep` for every sensitive-notes guard in that file returns **0**.
The only condition is `!claimableOnly`. The permission exists and is unused here:
`rbac.ts:23` `VIEW_CLIENT_HEALTH_NOTES_ASSIGNED`, `rbac.ts:167` `canManageSensitiveClientNotes()`.

**Plain English:** anyone who can open a booking sees the client's health notes.

**Fix — three steps, and the third is mandatory.**

1. Compute the viewer's entitlement via the existing `canManageSensitiveClientNotes(profile)`.
2. Strip `health_notes` **in the data layer**, not the JSX — `booking-detail-data.ts`. Never ship the
   value to a client that must not see it.
3. ⛔ **Add that boolean to the `unstable_cache` key.** `booking-detail-data.ts:340` caches with
   `revalidate: 60` (line 455). The file's own header states RBAC scope *"forms part of the cache key,
   so a claimable-only viewer can never be served the full record"* — it already passes `canViewAll`
   and `canClaim` as explicit booleans. **Filter without extending the key and the 60-second cache
   serves an Owner's notes to a Coordinator — strictly worse than today.**

⚠️ Also decide whether an assigned therapist should see them. `VIEW_CLIENT_HEALTH_NOTES_ASSIGNED`
exists, implying yes — that is an Owner call.

---

## F4 — ⛔ New staff can never sign in, and the screen says otherwise. Twice.

**Verified.** No `inviteUserByEmail`, `auth.admin.createUser` or `generateLink` anywhere in
`src/app/admin/staff/`. Repo-wide, auth accounts are created **only** in two scripts:
`scripts/reset-live-auth-owner.mjs:158` and `scripts/seed-e2e-staff.mjs:70`. Meanwhile
`NewStaffForm.tsx:126` and `:169` both promise *"They'll receive a sign-in invitation."*

**Plain English:** every therapist you add is locked out, and the UI tells you it worked.

⛔ **Owner decision required — two honest options:**

| Option | What it means |
|---|---|
| **A — make it true** | Call `auth.admin.inviteUserByEmail` on creation and link the returned user to the staff row. Real fix; touches auth and needs an email path that works |
| **B — make it honest** | Remove both invitation promises and document that sign-in is provisioned separately (as `bootstrap-owner-admin.mjs` already does) |

**Recommendation: B now, A later.** B is minutes and stops the lie today; A is a real feature and
should not be rushed into an auth surface on a live site.

---

## F5 — Booking form accepts unlimited text

**Verified.** `src/features/booking/schemas/booking-schema.ts:97` — `notes: z.string()` with no
`.max()`. The schema has exactly **one** `.max()` and it is on `numberOfPeople` (line 100).
`src/app/api/bookings/route.ts:61` does `await request.json()` with no size check.

**Plain English:** someone can paste a novel into the notes field and it lands in your database.

**Fix.** Add `.max()` to every free-text field in the schema (notes, names, address lines) at limits
matching the DB columns, and reject oversized bodies at the route via `content-length` before parsing.

⚠️ **Check the DB column types first** — if a column is `text`, the cap is a product decision, not a
technical one. Pick a generous limit; the goal is preventing abuse, not constraining customers.

---

## F6 — Prices exist in five hand-maintained copies

**Verified.** Price literals in `content/pages/packagePages.ts` (30), `content/pages/services.ts` (10),
`features/booking/data/booking-packages.ts` (5), `content/pages/home.ts` (5),
`app/admin/bookings/new/ManualBookingForm.tsx` (5). ⚠️ **Five files, not the three reported.**
They all match today.

**Plain English:** nobody is being mis-quoted right now. It breaks the first time you change a price
in one place and not the other four.

⛔ **Owner decision required.** A true single source of truth is a real refactor. The proportionate
options, given ~15 bookings and one engineer:

| Option | Cost |
|---|---|
| **A — one shared constant** the five import | Moderate. Genuine fix |
| **B — a test that asserts all five agree** | Small. Does not prevent drift, but makes it impossible to ship unnoticed |

**Recommendation: B.** It converts a silent business risk into a failing test for a fraction of the
effort, and A stays available later.

---

## F7 — `pnpm test:e2e` runs nothing and reports success

**Verified.** Measured with booleans only, no value read:
`node -e 'Boolean(process.env.E2E_OWNER_EMAIL)'` → **false**;
`node --env-file=.env -e '…'` → **true**. `playwright.config.ts` imports only `@playwright/test`,
has no `globalSetup`, and `dotenv` is not installed (0 references). Every role-gated spec is
`test.skip(!requireCredentials([...]))`.

**Plain English:** your end-to-end tests look like they pass. They are skipping almost everything.

**Fix.** Add a script that passes the env file explicitly — Node 24 supports it natively:
`node --env-file=.env node_modules/@playwright/test/cli.js test`. ⛔ **Do not install `dotenv`**
(`.env.example` forbids it). `E2E_BASE_URL` must also be set or specs skip for a second reason.

⚠️ `E2E_REPORTING_EMAIL` is absent from `.env` — that role still skips until it is added.

⛔ **Before running these:** they authenticate against the **live production database**. There is no
test/staging project configured anywhere. `booking-claiming.spec.ts` mutates bookings. **Settle the
database question before wiring the credentials in** — otherwise this fix upgrades "tests nothing"
to "tests write to production".

---

## F8 — ⛔ The repo cannot rebuild the production database

**Verified against the live project** (read-only `list_migrations`). Production has **72** applied;
the repo has **66** files.

**7 migrations exist in production with no file in the repo:**

```
phase9_account_password_requests                    ← the account-password-requests TABLE
phase8_staff_avatars_bucket                         ← avatar storage bucket
phase18_storage_avatars_canonical_perm              ← its permissions
restore_phase8_service_role_read_grants             ← service-role grants
restore_phase8_service_role_permissions_read_grant  ← service-role grants
phase9_payload_text
add_override_availability_and_area_to_booking_rpc   ← a booking RPC change
```

**And one the report missed, in the other direction:** `20260502183000_restore_api_role_grants.sql`
is in the repo and was **never applied to production**.

⚠️ `grant_manage_account_requests_to_owner_admin` appears to differ but does not — production
recorded it with a doubled timestamp prefix. Not a gap.

**Timestamp drift confirmed:** 9 of 11 sampled migrations have a repo filename timestamp that differs
from the production version (e.g. `c06_client_crud_hardening` repo `20260727120000` vs prod
`20260727202424`). Supabase keys on the version, so a fresh `db push` treats them as unapplied.

**Plain English:** rebuilding this database from the repo gives you a broken one — no
password-requests table, no avatar storage. This likely explains why "staff avatars unsupported" was
logged as a deferral.

**Fix — repo-only, no database change.**
1. Pull the 7 missing migrations out of production into `supabase/migrations/` with their **production
   version numbers** as filenames.
2. Decide `restore_api_role_grants`: apply it, or delete it and record why.
3. ⛔ **Do not rename the 66 existing files to match production.** Renaming changes nothing in the
   database and risks confusing a future `db push`. Record the drift in a README instead.

⛔ **Owner approval needed before any `supabase db pull`.**

---

## F9 — Sentry traces leak the manage-booking token

**Verified.** `scrubSentryEvent` is wired to `beforeSend` in all three configs — that handles
**errors**. A dedicated `addEventProcessor` handles `replay_event`. ⛔ **There is no
`beforeSendTransaction`**, and `tracesSampleRate` is **0.1 in production** (all three configs).

**Plain English:** the URL `/booking/manage?token=…` can reach Sentry inside performance traces.
Errors and session replays are already protected — traces were missed.

**Fix — one line per config.** Add `beforeSendTransaction: scrubSentryEvent` to
`sentry.client.config.ts`, `sentry.server.config.ts` and `sentry.edge.config.ts`.

✅ The existing scrubber already handles it once invoked: the token is a `randomUUID()` (36 chars) and
`LONG_TOKEN_PATTERN` redacts any 24+ run of `[A-Za-z0-9_-]`, hyphens included — plus `manage.*token`
and `token` match by key name.

---

## F10 — Recurring-series function lost its grants (hygiene, not exploitable)

**Verified.** `20260812010100_item8_phase4_series_fn_travel_fee.sql:92` **drops** the function to
change its signature, and the migration contains **zero** GRANT/REVOKE statements. Postgres discards
grants on drop, and a new function defaults to **EXECUTE for PUBLIC** — so
`REVOKE … FROM PUBLIC, anon, authenticated` from `20260802122636:939` is gone.

✅ **Not exploitable.** That migration rewrites the live function's source in place, so the body keeps
its original `service_role` guard and raises `42501` for anyone else. The outer lock is gone; the
inner one holds.

**Fix.** A migration re-applying the two lines. Will also clear the Supabase advisor findings it
currently generates.

---

## F11 — Rate limiter fails open silently

**Verified.** `src/lib/rate-limit.ts:94-102` returns `null` when the Cloudflare binding is absent.
⛔ **This is deliberate and correct** — the comment reads *"which is exactly the fail-open path we
want"*, because the binding does not exist under `next dev` or in tests. There are **0** log calls in
that catch.

**Fix — logging only. Do not change the behaviour.** Emit a one-time warning when the namespace is
unavailable in production, so a Worker misconfiguration is visible rather than silent.

---

## 13 — Partly real: fix only the stated half

**Failed emails.** ✅ Alerting **exists** — `nav-notifications.ts:18` surfaces
`email_failed: "Email delivery failed"` from `email_delivery_events`. **Only automatic retry is
missing.** Do not build an alerting system that already exists.

**Double submit.** ✅ A same-tab guard exists (`BookingExperience.tsx:111,579`). **Two tabs is the
real gap** and needs a server-side idempotency key, not another client flag.

---

## 14 — REFUTED. Do not re-raise these. ⚠️ ONE ROW WAS WITHDRAWN 2026-08-19.

| Claim | Verdict |
|---|---|
| **Honeypot shows a fake success screen** | ⛔ **By design, and well built.** The fake success is the correct pattern. The autofill worry is actively mitigated: `autoComplete="off"`, `tabIndex={-1}`, `aria-hidden="true"`, positioned off-screen rather than `display:none` (deliberate — the comment notes some bots skip hidden fields). It also logs the trip. **Leave it alone.** ⚠️ Re-checked 2026-08-19: the fake response is **key-for-key identical** to the real one (`status, message, bookingId, participantCount, itemCount, assignmentCount, manageUrl`, HTTP 200), so the verdict stands — but *"a bot must learn nothing"* is overstated. Values differ: `manageUrl` is always `null` and the three counts are always `1` regardless of the request. **Still not worth changing** |
| ~~**Deleted clients show in search**~~ | ⛔ **WITHDRAWN 2026-08-19 — this row was WRONG.** See §17.1. The refutation checked `clients-list-data.ts` only and generalised from it. `search-actions.ts` is a different path and had no filter. **Fixed.** |
| **Three actions refuse silently** | ⛔ **Not defects.** Those `return null` sites are internal helper lookups, not user-facing actions. The reporting agent itself concluded no permission gate is missing. ⚠️ Re-checked 2026-08-19: the three cited sites really are helpers and the row is correct **as written**. Do not read it as clearing the whole class — see §17.4 for a genuinely silent user-facing action it does not cover |

---

## 15 — ⛔ Noted, not a code fix: four cron triggers

`wrangler.jsonc:71` — `["0 8 * * *", "* * * * *", "*/15 * * * *", "0 3 * * *"]`. **One fires every
minute.** They run today and will begin acting on real customer bookings the moment Phase 12 ships,
along paths that have never executed against a real booking.

**This is a testing requirement, not a defect.** It belongs in the production-readiness test plan.

---

## 16 — Verification for every fix

After each one: the seven gates identical to baseline (⛔ **check the vitest count**, gotcha 118),
plus `pnpm build`. `git status --porcelain -- src/ supabase/` will be non-empty while working — that
is expected here, unlike during the declutter.

**Per-fix proof, beyond the gates:**

| Fix | Proof it worked |
|---|---|
| F1 | A test asserting the write path refuses booking N+1 when N therapists are free and N unassigned bookings overlap |
| F2 | A test that a paused window rejects a public create and still allows an override create |
| F3 | A test that a Coordinator's payload contains **no** `health_notes` key — assert on the data layer, not the DOM — **and** that two viewers with different entitlements get different cache entries |
| F5 | A schema test rejecting an over-length note |
| F7 | Run it and **count executed tests** — the report said 15 of 18 run once wired correctly |
| F8 | `supabase db diff` clean, or a documented explanation of any remainder |
| F9 | A scrubbing test covering a transaction-shaped event, not just an error |

---

## 17 — ✅ POST-VERIFICATION CORRECTIONS — 2026-08-19 (session 14)

An independent verification pass re-tested every claim in this plan, gotchas 119-127, and the three
§14 refutations, against both the repo and the **live database**. Full evidence:
`redesign/VERIFICATION-2026-08-19-session-14.md`.

**Headline: no fix in this plan regressed.** All eight gates matched baseline. The two migrations
are applied and the live function does what §F1/§F2 claim — verified field by field in
`pg_proc.prosrc`, not from the file. Five real problems were found; **four were pre-existing**, one
was a new guard weaker than advertised. The three fixed below are the ones worth a one-line change
at this business's scale.

### ✅ 17.1 — `searchClients` returned soft-deleted clients — §14 row WITHDRAWN

**The defect.** `src/app/admin/search-actions.ts` queried `clients` on the **service-role** client,
so RLS does not apply, with no `deleted_at` filter. A soft-deleted client's full name, email, phone
and postcode reappeared in the global admin command palette on every `/admin` page, linking to a URL
that 404s.

**Why §14 got it wrong.** The refutation checked `clients-list-data.ts` — which *does* filter
correctly — and generalised from one file. Control proof: `grep deleted_at` returns **6** in
`clients-list-data.ts` and **0** in `search-actions.ts`, so the absence was real, not a bad search.

**Exact fix** — in the `searchClients` builder:

```ts
.select("id, full_name, email, phone, postcode")
.is("deleted_at", null)          // <- added
.or([...])
```

**Guard added.** `src/app/admin/search-actions.test.ts` — a new `describe` block asserting
`clients.filters` contains `["is", "deleted_at", null]`, plus a control asserting the recorder can
see the filter's *absence*. ⚠️ `FILTER_OPS` in that file's recording mock had to gain `"is"`;
without it the mock throws `.is is not a function`. ⚠️ **Corrected after review:** the first pass
said this fails "every existing test in the file". It does not — measured, it fails **2 of 10**
(**1 of the 8 pre-existing**), because only tests mounting a profile with an all-clients permission
ever reach `searchClients`. The `FILTER_OPS` change was still genuinely required: without it the
new guard cannot run at all.

**Mutation-tested:** removing the `.is()` line gives `1 failed | 9 passed` —
`AssertionError: expected [ [ 'or', …(1) ] ] to deep equally contain [ 'is', 'deleted_at', null ]`.
The guard bites.

⚠️ **Impact was zero at the time of fixing** — production holds 15 clients and **0** soft-deleted.
Latent, not a live leak.

### ✅ 17.2 — `getSearchClientIds` had the same omission

**Exact fix** — `src/app/admin/bookings/bookings-list-data.ts`, inside the cached fetcher:

```ts
.select("id")
.is("deleted_at", null)          // <- added
.or([...])
```

Lower impact than 17.1 — it only widens a booking search and never renders client PII directly — but
it is the same omission on the same table, fixed in the same pass.

### ✅ 17.3 — The Sentry scrubber leaked part of the manage token 15% of the time

**The defect.** `src/lib/observability/sentry-scrubbing.ts` — `redactText()` ran `PHONE_PATTERN`
**before** `LONG_TOKEN_PATTERN`. A manage token is a `randomUUID()`; the phone regex matches a digit
run inside it and replaces the middle, breaking the 24+ character run `LONG_TOKEN_PATTERN` needs, so
the remainder survived into Sentry.

**Measured over 500,000 real `randomUUID()` values** (⚠️ figures corrected after review — the
first pass quoted "up to 18 hex chars", which was the residue length of the *worked example below*,
not a maximum. The real leak is worse):

```
phone-first (as shipped) : ~14.8% of tokens leak a partial
token-first (fixed)      :   0.00%
worst observed leak      : 26 of the token's 32 hex characters survived
                           -> only 6 hex unknown = 24 bits, not the ~32 first stated
longest unbroken hex run : 12
counted by the guard's own needle (runs of 6+): up to 20
```

Example: `c7f54cfc-99cc-49e4-8457-686a9b9456be` scrubbed to
`...token=c7f54cfc-99cc-49e[Filtered]a9b9456be` — 17 hex characters in runs of 6+, 24 in total.

Still not brute-forceable in practice: 24 bits behind the rate limiter, and traces sample at 0.1.
But it is a partial credential reaching a third-party processor.

**Exact fix** — swap the last two lines of `redactText()`:

```ts
.replace(LONG_TOKEN_PATTERN, "[Filtered]")   // <- now FIRST
.replace(PHONE_PATTERN, "[Filtered]");       // <- now SECOND
```

**The swap is free.** Phone redaction output is byte-identical under both orders for
`"call 07700 900123 about it"`, `"+44 7700 900123"`, `"01582 123456"` and `"07700900123"` — a long
digit run is caught either way. A regression test now asserts this.

**Why F9's own test missed it.** The D9 test pins **one** hard-coded UUID
(`3f2504e0-4f89-11d3-9a0c-0305e82c3301`), which happens to be one of the ~85% that scrub cleanly. It
is a single sample of a probabilistic property.

**Guard added.** `src/lib/observability/sentry-scrubbing.test.ts` — three tests: 200 real
`randomUUID()` values with no hex residue permitted; a control proving the needle *can* match on an
unscrubbed token and that the surrounding URL carries no hex run of its own (gotcha 109); and the
phone regression above.

**Mutation-tested:** restoring the old order gives `1 failed | 5 passed` —
`AssertionError: expected [ …(39) ] to deeply equal []`. **39 of 200** tokens leaked, while the
original D9 test still passed. Exactly the blind spot it was written to close.

### ✅ 17.4 — Two comments corrected; no behaviour change

1. **`booking-detail-data.ts` cache key.** The `⛔` comment claimed that omitting `canViewHealthNotes`
   from the key would *"cache an Owner's record and serve it to a Coordinator — a strictly worse leak
   than the one being fixed"*. **That is false.** `staffId: profile.id` is already in the key and
   **predates F3** (it appears as context, not a `+` line, in `58c22ad`), so two viewers could never
   share an entry. In this repo a `⛔` comment is read as a gate, so it recorded a wrong invariant.
   The line is **defensive, not load-bearing** — it busts one viewer's entry immediately on a
   permission change instead of after 60s. **Code unchanged; comment rewritten.**

2. **§14, row 3** left standing — the three cited `return null` sites really are internal helpers.
   But it must not be read as clearing the class: `respondToCustomerReschedule`
   (`src/app/admin/bookings/actions.ts:1458`) returns `void` and exits silently on four paths while
   `RescheduleResponseButtons.tsx:26` toasts success **unconditionally**. Pre-existing by 703
   commits, untouched by `58c22ad`/`5aab8d6`, and there are more actions in that shape. **Not fixed
   here — out of scope, and a separate topic from §14.**

### ⛔ 17.5 — Found, NOT fixed. Deliberate.

| # | Issue | Why not fixed |
|---|---|---|
| **A** | ✅ **MIGRATION WRITTEN 2026-08-19, NOT APPLIED — ships with Phase 12.** See §18. **BST bug in the live booking RPC.** `create_booking_request` line 84 compares a `timestamptz` against `timezone('Europe/London', now())`, a **naive** timestamp. Postgres coerces it at the session TimeZone (UTC), so during BST the "must be in the future" threshold sits **one hour ahead**. Measured live across 5 dates: skew `+01:00` on 2026-08-19 and 2026-10-24, `00:00` on 2026-01-15, 2026-03-28 and 2026-10-26. **During BST a booking starting in the next ~60 min is refused.** Website bookings are masked by the 4h notice check; **phone/admin bookings are not** | ⛔ **Requires a migration applied to production — needs the Owner's explicit per-action approval.** Not a repo-only change. ⚠️ **NOT a failure of D4** — D4's claim was scoped to the minimum-notice check and that fix is correct. Line 84 is a separate pre-existing instance, identical in the pre-apply file (lines 120/122). It fails **closed**: it refuses bookings, never accepts bad ones |
| **B** | **The price parity test guards 5 of 25 price literals in `packagePages.ts`** (⚠️ corrected after review — `grep -c "price:"` returns 28, but **3 are `price: string;` interface declarations** at lines 10/30/74). Exact shape: **5 top-level (guarded) + 15 in `relatedPackages[]` + 5 `summary.price`**. The 15 are **rendered** at `RelatedPackages.tsx:25` on all five package pages; the 5 `summary.price` are **not rendered anywhere** and carry no customer risk. Mutation test: changing a cross-sell price leaves **240 files / 2467 tests green**. `packagePages.ts` is also the one mirror left out of the per-id join, so two *swapped* prices there also ship green | Nothing is mis-quoted today — all cross-sell prices currently match, so the exposure is future. Widening the accessor is a real change, not a one-liner, and F6 chose option B deliberately. ⚠️ **The test header's claim that it "makes shipping a divergence impossible" is not true of this file** |
| **C** | **`phone` and `email` are uncapped** on the public booking route (`route.ts:34-35`). Bounded only by the 256 KB body cap | Pre-existing and untouched: `git diff 58c22ad^ 1d179a5 -- src/app/api/bookings/route.ts` shows **0** changed lines mentioning either. F5 made this file strictly better. A gap in F5's *stated* scope, not a regression |
| **D** | **`20260812010100` asserts an md5 (`3f5424d…`) no repo file can produce** — `c02` is the only repo definer of the series function and its body hashes `5eb7d49f…`. A second rebuild blocker | Real, but **not the first** failure: a rebuild dies far earlier on the missing `account_password_requests` table, which **F8 / README §1 already records**. Worth one line in the README, nothing more. Subsumed by F8 |

### Verification of this pass

`tsc` 0 · full `vitest` re-run · `lint` 4E/1W in the same **three** files · `scripts/` 47 ·
contrast **110 (46/64)** · verify **0** · `pnpm build` succeeds.
⛔ The vitest **count rose** — new guard tests only, nothing removed. Counted, not eyeballed
(gotcha 118).

---

## 18 — ⛔ THE BST FIX: written, NOT applied. Ships with Phase 12.

`supabase/migrations/20260819160000_fix_booking_future_check_dst.sql` — **Owner decision
2026-08-19: Option A, surgical.** Repo-only. **Nothing has been applied to the database.**

### What it changes

One line of `create_booking_request`, and nothing else:

```sql
-  if v_requested_at < timezone('Europe/London', now()) then
+  if v_requested_at < now() then
```

`v_requested_at` is `timestamptz`. `timezone('Europe/London', now())` is a **naive** timestamp, which
Postgres coerces at the session TimeZone — UTC on this project — so throughout BST the threshold sat
**one hour in the future** and any booking starting within the next ~60 minutes was refused as "in
the past". Both sides are absolute instants now.

### Independently verified before writing it — six agents, three angles, none refuted

- **The mechanism is real.** Proven beyond the original analysis: a live REST request returns a BST
  timestamp as `+00:00`, so PostgREST connections genuinely run on UTC. No role, database default or
  `db_pre_request` hook overrides it.
- **Reachable through one screen only** — the admin **"Override availability"** branch, the sole
  surface with a free-typed time input. The public site and the ordinary admin slot picker are both
  filtered by `isOutsideMinimumNotice` in `availability.ts`, so neither is ever offered a slot inside
  the window. ⛔ The guard sits **before** the `if not p_override_availability` block, so ticking
  override does **not** bypass it.
- **Never once fired.** Across all 15 bookings the shortest positive lead time is **263 minutes**
  against a 60-minute window. It fails **closed** — it can only over-refuse.
- **The fix is strictly relaxing.** Over 61,488 probes covering every hour of 2026 it disagrees with
  the old form *only* where the old form was wrong, is never more permissive, and still refuses every
  genuinely past time in both seasons. That is the safest possible shape for a live change.

### Corrections to §17.5 row A, which this supersedes

1. ⚠️ **The masking mechanism was stated wrongly.** Website bookings are **not** protected by the
   4-hour notice check "running later" — the broken guard runs **first**. They are protected by the
   slot list never offering such a time. Same outcome, wrong reason.
2. ⚠️ **BST returns 28 March 2027**, not 29 March.
3. ⚠️ **"Public bookings are closed" is not a mitigation.** `booking_status_enabled` is `true` in the
   database; the banner is front-end only. It is irrelevant anyway — the exposed path is the admin
   override branch, which is live right now.

### How it is built, and why that way

Byte-concatenated from `20260819072756_f1_f2_booking_capacity_and_window.sql`, whose body is
**logically identical to the live function** (both hash `d55a0da2bbf448a26e50a94e27bbdd29` with
comments and whitespace stripped). `diff` of the two SQL bodies shows **exactly one** change.
Stripped body: **12694 → 12668** characters, i.e. 26 removed — 25 for `timezone('Europe/London',`
plus its closing paren. Nothing else moved.

⚠️ **This deliberately reverses gotcha 126's advice for this case.** Patching live `prosrc` by regex
was right when the repo file was unproven; now that the file is *proven* equivalent, re-issuing it is
strictly safer — a readable diff beats string surgery on production source.

It carries an **md5 pre-condition** (`8e455336428b4376fdffb7744eb8ae9c`) that aborts the migration
untouched if the live body has drifted (gotcha 122/126). `CREATE OR REPLACE` preserves grants —
only `DROP` discards them (gotcha 124) — and the signature is unchanged.

⚠️ **Applying it also closes the README §6 fidelity gap**: the live body becomes byte-identical to
the repo file rather than merely equivalent.

### ⛔ Left undone, deliberately — and it needs an Owner decision one day

The check immediately above blocks **any** past-dated booking for **every** caller, staff included,
so yesterday's walk-in cannot be logged through the app. Evidence: four bookings carry a
`booking_date` earlier than their `created_at`, so they were inserted directly, bypassing the RPC.

Gating **both** guards on `p_booking_source = 'website'` — the pattern the function already uses for
the notice check — would fix that and this together. **The Owner was offered this (Option B) on
2026-08-19 and chose the surgical fix instead.** Recorded so it is not re-raised as an oversight.
