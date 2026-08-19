# Verification of the twelfth session's work — 2026-08-19 (session 14)

**Status: UNTRACKED, UNCOMMITTED.** Nothing in `src/` or `supabase/` was modified. No database
write was made. Read-only throughout.

**Position at time of writing:** `HEAD 1d179a5` · `origin/master 0f8ab9d` · 20 unpushed ·
working tree clean · tracked files **1997**.

**Method:** every claim was treated as a claim to test. Where an answer was computable it was
computed. 30 verification agents ran in two adversarial rounds (7 verifiers, 23 refuters); their
output was then re-checked by hand — 19 of 24 flagged findings did not survive, and one of my own
conclusions was corrected by a refuter. Findings below are only those I personally confirmed.

---

## 1 — Position and gates

### 1.1 One number in the brief is off by one, and it is explained

| | Brief said | Measured | Explanation |
|---|---|---|---|
| tracked files | 1996 | **1997** | 1996 is correct **at `e7ecdb5`**. `1d179a5` added `HANDOFF-2026-08-19-IMPLEMENTATION-11.md`. Not a discrepancy. |

Verified three independent ways, all agreeing: `git ls-files | wc -l`, `git ls-files | sort -u | wc -l`,
`git ls-tree -r HEAD --name-only | wc -l`. And `git ls-tree -r e7ecdb5 --name-only | wc -l` → 1996.

Everything else in the brief matches git exactly: HEAD, origin/master, 20 unpushed, clean tree.

### 1.2 All eight gates re-run — all match baseline

| Gate | Baseline | Measured | |
|---|---|---|---|
| `npx tsc --noEmit` | 0 | 0 | ✅ |
| `npx vitest run` | 0 failed / 2514 / 244 files | **0 failed / 2514 passed / 244 files** | ✅ count checked, not colour |
| `pnpm lint` | 4E/1W, three files | 4E/1W in **exactly three** files | ✅ |
| `npx vitest run scripts/` | 47 | 47 | ✅ |
| `measure-admin-contrast.mjs` | 110 (46/64) | **110 (46 dark / 64 light)** | ✅ |
| `verify-admin-token-contrast.mjs` | 0 | 0 | ✅ |
| `git status --porcelain -- src/ supabase/` | EMPTY | EMPTY | ✅ |
| `pnpm build` | succeeds | exit 0 | ✅ regenerated `.next` |

The three lint files are `BookingExperience.tsx`, `BookingExperienceLoader.tsx`,
`utils/returning-customer.ts` — the documented baseline. Not touched.

### 1.3 — ✅ FIXED. The code→doc citation gate is back to its documented baseline of **1**.

> **Resolved 2026-08-19.** The wrapped path in `e2e/helpers.ts` was rewrapped so the full filename
> stays on one line. That citation now reports **`RESOLVES`**, and the gate returns **1** dangling —
> the known pre-existing external one — so the handoff's stated baseline is true again. A `⛔` note
> was added above the line telling the next person not to re-wrap it. The identical split in
> `playwright.config.ts` two lines up was fixed at the same time; it was never flagged, because the
> gate only tracks document citations, but it was the same mistake.
>
> **The finding as originally recorded:**

`bash extract-doc-citations.sh | awk -F'\t' 'NR>1 && $4=="DANGLING"'` returns **2**:

| Dangling | Status |
|---|---|
| `supabase/migrations/20260521160000_create_notification_state.sql:7` → `lets-start-with-r4-lazy-stroustrup.md` | the known pre-existing external one |
| `e2e/helpers.ts:18` → `redesign/PRODUCTION-READINESS-BASELINE-2026-08-17` | ⚠️ **new, and NOT introduced by this session** |

The second was introduced by **`5aab8d6`** (`git log -S` on that path confirms it), so it was already
dangling when the handoff recorded "baseline 1". **The cited document exists** —
`redesign/PRODUCTION-READINESS-BASELINE-2026-08-17.md` is present. The comment simply wraps the path
across two lines, stranding `.md` on the next line, so the extractor cannot resolve it:

```
// … See redesign/PRODUCTION-READINESS-BASELINE-2026-08-17
// .md section 3.1.
```

~~**Not fixed here** — it is outside this session's scope and is a one-line comment rewrap.~~
✅ **Fixed on the Owner's instruction, same session.** See the note at the head of this section.

---

## 2 — The two applied migrations: verified against the live database

Both are applied. Production now has **74** migrations (was 72).

| Version | Name | State |
|---|---|---|
| `20260819072517` | `f10_restore_series_fn_grants` | applied |
| `20260819072756` | `f1_f2_booking_capacity_and_window` | applied |

### 2.1 Every fidelity md5 in README-MIGRATION-DRIFT §6 independently reproduces

| Claim | Measured | |
|---|---|---|
| live body after apply = `8e455336…`, len 20105 | exact match from `pg_proc.prosrc` | ✅ |
| repo `f1_f2` body = `9a10991d…`, len 22410 | exact match | ✅ |
| pre-apply live body = `6b5fb9de…`, len 17715 | exact match, and it **is** the body of `20260811210000_item8_phase2_remove_service_area_gate.sql` | ✅ rollback path is sound |

### 2.2 The repo file and the live function are logically IDENTICAL

This is stronger than the README claimed. Strip comments and all whitespace from both bodies:

```
live  : md5 d55a0da2bbf448a26e50a94e27bbdd29, 12694 chars
repo  : md5 d55a0da2bbf448a26e50a94e27bbdd29, 12694 chars
```

Identical. Every code string literal also matches: 99 literals, `6ae49935ae8da2bda480695cd4704dc9`
on both sides.

The only difference, located by prefix binary search to characters 7500–7600, is **parenthesis
spacing** — `0))) ) )` live versus `0)) ) ) )` in the repo. Same tokens, same paren count, zero
semantic difference.

**So: the end state is confirmed, and the repo file is a faithful rebuild source.**

### 2.3 All seven behavioural claims verified in the live function body

| Claim | Evidence | |
|---|---|---|
| F1 counters present | live lines 294–313: counts `ba.assigned_staff_id is null`, `ba.status in ('unassigned','assigned')`, `b.status in ('pending','confirmed')`, buffered overlap, subtracted with `greatest(0,…)` | ✅ |
| F1 mirrors the read engine | `availability.ts:596` fetches bookings `.in("status",["pending","confirmed"])`, `:618` assignments `.in("status",["unassigned","assigned"])` — **the same two status sets**. And `overlaps()` at `:226` is `start < busyEnd+buf && end > busyStart-buf`; Postgres `OVERLAPS` against `(b.start-buf, b.end+buf)` expands to exactly that. **Algebraically identical.** | ✅ |
| D6 gated on `p_booking_source` | live line 138 `if p_booking_source = 'website'` | ✅ |
| D4 uses `v_requested_at` | live line 143 `v_requested_at < now() + make_interval(...)` — absolute, DST-safe | ✅ |
| D5 buffer applied | 4 occurrences; pre-apply file had **0** — genuinely new | ✅ |
| D13 lock keyed on date only | live 147–152 keys `'create_booking_request:' || p_booking_date`. Pre-apply keyed `date || ':' || start_time` — genuinely re-keyed | ✅ |
| D8 PUBLIC EXECUTE revoked | `proacl = {postgres=X/postgres,service_role=X/postgres}` on **both** functions | ✅ |

**F2's pause check exists but under different names than the plan documents.** The plan says
`booking_window_settings` / `is_paused`; a grep for those returns 0 and would look like the fix is
missing. The live function actually reads `business_settings.booking_status_enabled` (line 139) and
`minimum_notice_hours` (142–143). Live settings: enabled=true, notice=4h, buffer=30min,
window=29 days.

### 2.4 Defaults are fail-safe

`p_booking_source` defaults to `'website'` and `p_override_availability` to `false`. A caller that
omits them gets the strict path. The public route cannot inject either: they are absent from the
route's zod schema, which strips unknown keys.

### 2.5 The defect class F10/D8 closed is fully closed

Swept every `SECURITY DEFINER` function in `public`, `private`, `storage` for PUBLIC/anon/authenticated
EXECUTE → **zero**. Control run on `pg_catalog` returned 3257 matches, proving the predicate fires.
Remaining `proacl = NULL` functions are trigger functions and Supabase-managed storage internals.

Only two functions insert into `bookings`: `create_booking_request` and
`create_recurring_booking_series`. Both are service_role-only. No public path bypasses the fix.

### 2.6 The four functional VERIFY steps genuinely were not run

`bookings` holds **15 rows**, newest `2026-07-27`, **zero** created on or after 2026-08-19.
7 of 10 assignments are unassigned — the exact shape F1 was written for.

---

## 3 — Migration drift: full census (better than the README's 11-file sample)

Production **74** applied · repo **68** `.sql` files.

| README claim | Verdict |
|---|---|
| 7 migrations in prod with no repo file | ✅ **exactly those 7**, still missing |
| 1 repo migration never applied (`restore_api_role_grants`) | ✅ confirmed, 0 occurrences in prod. ⚠️ **RESOLVED 2026-08-19: verified superseded and DELETED** — all 14 of its grants already exist in production as *direct* ACL entries, so it was a no-op. See README §2.1 |
| `grant_manage_account_requests_to_owner_admin` **looks** like an 8th gap and is not | ✅ **the warning is correct** — prod recorded it with a doubled `20260521090000_` prefix. My own first matcher fell into this trap and reported a false 8th. The README saved it. |
| "Most filenames disagree" (sampled 11, 9 differed) | ✅ confirmed and now quantified: **48 of 66 matched files drift, 18 agree** |
| The two new files were renamed to match prod versions | ✅ both filenames equal their prod version exactly |

---

## 4 — What is actually wrong

Five items. **None is a regression introduced by the fixes.** Four are pre-existing; one is an
incomplete new guard. Ordered by what I would actually do something about.

### 4.1 Deleted clients DO show in admin search — §14's "REFUTED / False" must be withdrawn

`src/app/admin/search-actions.ts:168-200` — `searchClients` queries `clients` with the service-role
client and **no `deleted_at` filter**. Result: a soft-deleted client's full name, email, phone and
postcode appear in the global admin command palette on every `/admin` page, linking to a URL that
404s. Same omission at `bookings-list-data.ts:985` `getSearchClientIds`.

The original refutation checked **one** file (`clients-list-data.ts`, which does filter correctly)
and generalised from it. Control check: `grep deleted_at` returns **0** in `search-actions.ts` and
**6** in `clients-list-data.ts`, so the absence is real, not a broken search.

⚠️ **Current impact is zero: production has 15 clients and 0 soft-deleted.** This is latent, not
live. One line each: `.is("deleted_at", null)`.

### 4.2 The Sentry scrubber leaks part of the manage token 15% of the time

`src/lib/observability/sentry-scrubbing.ts:45-50` — `redactText()` runs `PHONE_PATTERN` **before**
`LONG_TOKEN_PATTERN`. The phone regex eats a digit run inside the UUID, which breaks the 24+
character run the token pattern needs, so the rest of the token survives.

Measured over **20,000 real `randomUUID()` values**:

```
current order (PHONE then LONG) : 3012 partial leaks  (15.06%)
swapped      (LONG then PHONE)  :    0 partial leaks  ( 0.00%)
```

Example: token `c7f54cfc-99cc-49e4-8457-686a9b9456be` scrubs to
`…token=c7f54cfc-99cc-49e[Filtered]a9b9456be` — 17 hex characters in runs of 6+, 24 in total.

⚠️ **Corrected after independent review.** Re-measured over **500,000** values: the leak rate is
~14.8%, and the **worst observed leak left 26 of the token's 32 hex characters** — only 6 unknown,
so **24 bits**, not the ~32 first stated. The longest unbroken hex run is 12; the guard's own needle
(runs of 6+) counts up to 20. The original "up to 18 hex characters" was the residue length of the
worked example above, not a maximum, and it understated the bug. Still not brute-forceable behind
the rate limiter, and traces sample at 0.1 — but the figure is now accurate.

This is a partial credential reaching a third-party processor, and it contradicts the D9 test's
stated guarantee. Not practically brute-forceable (~32 bits left, behind the rate limiter), and
traces sample at 0.1. **Fix is swapping two lines.** The bug is pre-existing; F9 is what routed
transaction URLs through this path.

Related: the D9 test uses **one** hard-coded UUID, so it passes ~85% of the time by luck. A loop
over 50 UUIDs would have caught this immediately.

### 4.3 ✅ FIXED AND APPLIED 2026-08-19 — a pre-existing DST bug in the live booking function

> **Resolved.** Applied to production as `20260819134224_fix_booking_future_check_dst`, with the
> Owner's explicit approval, via an md5-guarded patch whose outcome a read-only dry run predicted
> exactly (`7bea3df6…`, 20078 bytes). Behaviour re-tested live: 6 of 6 correct across BST and GMT.
> Full record: `redesign/plans/PRODUCTION-FIXES-2026-08-17-plan.md` §18.
>
> ⚠️ Two corrections to what is written below, found by the independent review that preceded the fix:
> the "masked by a 4-hour notice check" mechanism is **wrong** (the broken guard runs *first*; what
> protects customers is that the slot list never offers such a time), and BST returns on
> **28 March 2027**, not the 29th. The original text is kept unedited below as the record of what
> was found at the time.

**Original finding, as written:**

Live `create_booking_request` line 84:

```sql
if v_requested_at < timezone('Europe/London', now()) then
  raise exception 'Booking time must be in the future';
```

`v_requested_at` is `timestamptz`; `timezone('Europe/London', now())` is a **naive timestamp**.
Postgres coerces it using the session TimeZone (UTC on Supabase), so during BST the threshold sits
one hour in the future. Measured on the live database across five dates:

| Date | Threshold skew | Rejects valid bookings? |
|---|---|---|
| 2026-01-15 (GMT) | 00:00:00 | no |
| 2026-03-28 (GMT) | 00:00:00 | no |
| 2026-08-19 (BST) | **+01:00:00** | **yes** |
| 2026-10-24 (BST) | **+01:00:00** | **yes** |
| 2026-10-26 (GMT) | 00:00:00 | no |

**Effect:** during BST, a booking starting in the next ~60 minutes is refused as "must be in the
future". Website bookings are masked by the 4-hour notice check. **Phone/admin bookings are not** —
they skip the F2 block and hit this line.

⛔ Important scoping: this is **not** a failure of D4. D4's claim was explicitly about the
minimum-notice check, and that fix is correct. Line 84 is a separate, pre-existing instance of the
same family, identical in the pre-apply file (lines 120/122). It fails **closed** — it refuses
bookings, never accepts bad ones.

### 4.4 The price parity test guards 5 of 25 price literals in `packagePages.ts`

The test reads `packagePages.map(pkg => pkg.price)` — the top-level field only. Counted in the file:

⚠️ **Counts corrected after independent review.** `grep -c "price:"` returns 28, but **3 of those
are `price: string;` interface field declarations** (lines 10, 30, 74), so there are **25** literals,
not 28. The first pass also mis-attributed the `summary.price` entries to `relatedPackages[]`.

- **5** top-level prices — guarded
- **15** inside `relatedPackages[]` — **unguarded, and rendered** at
  `src/components/package-pages/RelatedPackages.tsx:25` (`{related.price}`) on all five package pages
- **5** `summary.price` — unguarded, but **not rendered anywhere**, so no customer risk
- 5 prose/meta `£` mentions — unguarded, rendered

Mutation-tested by an agent in a scratchpad copy (repo untouched, `git status` empty after):
changing a top-level price fails the suite; changing a `relatedPackages[]` price leaves
**240 files / 2467 tests green**.

Nothing is mis-quoted today — all cross-sell prices currently match. The exposure is future, and
the real cost is false confidence: the test header says it "makes shipping a divergence impossible",
which is not true of the file D7 added. Also, `packagePages.ts` is the one mirror left out of the
per-id join, so two prices *swapped* there also ship green.

### 4.5 `phone` and `email` are the only uncapped free-text fields on the public route

`src/app/api/bookings/route.ts:34-35` — `phone: z.string().trim().min(1)` and `email: z.email()`
carry no `.max()`. Both reach `clients.phone` / `clients.email`. Bounded only by the 256 KB body cap.

Pre-existing and untouched by the fixes — `git diff 58c22ad^ 1d179a5 -- src/app/api/bookings/route.ts`
shows **0** changed lines mentioning either. F5 made this file strictly better. It is a gap in F5's
*stated* scope, not a regression. One line each if ever touched.

---

## 5 — Claims that were tested and held

These were attacked and survived. Recording them so they are not re-litigated.

- **F1 / F2 / D4 / D5 / D6 / D8 / D12 / D13** — all verified in the live function (§2.3).
- **F3 health notes** — redaction is in the data layer; the entitlement boolean **is** in the cache
  key; `revalidate: 60` and all six tags intact. The predicate
  `canManageSensitiveClientNotes || canViewAssignedHealthNotes` is broader than
  `clients/access.ts`, but before 58c22ad the page had **no permission check at all**, so every
  hypothesised role is strictly better off. The dashboard surface is outside F3's declared scope.
- **F4 staff invitation** — three false promises removed; no invitation copy survives; no code
  creates auth accounts. `NewStaffForm.tsx:58` ("Add an email so they can sign in") looked like a
  missed fourth — it is not a live contradiction: `FieldInput` line 322 renders
  `{hint && !error ? … : null}`, so the corrected hint and that validation error can never appear
  together.
- **F5** — the D2 correction is genuinely right: it measures actual body bytes with `TextEncoder`,
  not the spoofable `content-length`. Caps match column types; no cap exceeds its column.
- **F7 e2e** — `pnpm test:e2e` still collects 36 tests, executes 0, exits 0. `test:e2e:auth` is
  well-formed. The production-DB hazard note in `e2e/helpers.ts` is accurate.
- **F10** — `c02_recurring_bookings.sql:939-940` held the REVOKE/GRANT;
  `20260812010100:92` DROPs the function without re-granting; `20260819072517` restores it. Live ACL
  now correct. Supabase advisors show no function-grant findings.
- **Honeypot (§14)** — the fake response is **key-for-key identical** to the real one
  (`status, message, bookingId, participantCount, itemCount, assignmentCount, manageUrl`), same
  HTTP 200. Values differ (`manageUrl` always null, counts always 1), so "a bot must learn nothing"
  is slightly overstated — but the refutation's conclusion is right. **Leave it alone.**
- **"Three actions refuse silently" (§14)** — the three cited `return null` sites really are
  internal helpers. The row is correct as written. A different site,
  `respondToCustomerReschedule` (`actions.ts:1458`), *does* return `void` on four failure paths
  while `RescheduleResponseButtons.tsx:26` toasts success unconditionally — but it is pre-existing
  by 703 commits, untouched by either fix commit, and there are more actions in that shape than
  either agent enumerated. Real, but a separate topic from §14.

### One correction to my own working conclusion

I initially concluded a fresh rebuild would abort at `20260812010100` on its md5 pre-condition
(`3f5424d…`, unreproducible from any repo file — `c02` is the only repo definer of the series
function and its body hashes `5eb7d49f…`). That is true but **not the first failure**: a rebuild
dies far earlier, around `20260521120000_add_used_to_account_request_status.sql`, because the
`account_password_requests` table's migration is one of the 7 missing files. **The README's §1
already explains this.** The md5 gate is a second, later blocker that would still bite after the 7
files were restored — worth one line in the README, nothing more.

---

## 6 — What needs the Owner

1. **Nothing here is urgent.** No fix regressed. The site is unaffected today — bookings are still
   closed publicly, no soft-deleted clients exist, and no booking has been created since 27 July.
2. **Four one-line changes are available** if wanted (§4.1 ×2, §4.2 ×1). None is required.
3. **§4.3 (BST) is the only one with a deadline of sorts** — it is live now, during BST, on the
   phone/admin booking path. It refuses bookings rather than accepting bad ones.
4. **Two documents need a correction of record**, independent of any code change:
   - `PRODUCTION-FIXES-2026-08-17-plan.md` §14 — the "deleted clients" row is **False → withdraw**.
   - The `⛔` comment at `booking-detail-data.ts:507-511` states a cache leak that the pre-existing
     `staffId` key part already prevented. In this repo a `⛔` comment is treated as a gate, so it
     now records a wrong invariant. The code is correct and should stay.
5. ⛔ **Still true and unchanged:** `git push` opens live bookings. Nothing here changes that.
