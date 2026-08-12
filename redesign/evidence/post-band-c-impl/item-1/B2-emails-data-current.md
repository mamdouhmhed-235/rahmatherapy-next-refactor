# B2 — `src/app/admin/emails/emails-data.ts` current state, item 1 Batch B

READ-ONLY derivation. HEAD = `530d154` (master), tree dirty only at `M src/lib/maintenance.ts`
(unrelated, per the task brief — left untouched). Every line number below was obtained by
reading the actual file just now (`Read` tool, `cat -n`-style output), not trusted from any
plan/handoff. `wc -l` confirms the file is **551 lines** total.

`npx vitest run src/app/admin/emails/__tests__/emails-data.test.ts` was run once, from repo root,
for item 8 below. No other command with side effects was run. No `src/`, `scripts/`, `e2e/`, or
`supabase/` file was written.

---

## 1. Whole file structure

Verbatim import block (lines 55–66):
```ts
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { getTemplateOverrideSummaries } from "@/lib/email/templates";
import {
  LOG_PAGE_SIZE,
  clampPage,
  pageRange,
  type PaginatedResult,
} from "@/lib/pagination";
import type { DateRangePresetKey } from "./format";
```

Every export, in file order, with its true line range:

| Symbol | Kind | Lines |
|---|---|---|
| `EMAILS_PAGE_SIZE` | exported const (`= 100`) | 68 |
| `DELIVERY_SELECT` | local const (select string) | 70–71 |
| `EmailEvent` | exported interface | 73–84 |
| `ReminderBooking` | exported interface | 86–93 |
| `EmailTemplateStaffName` | exported interface | 95–98 |
| `EmailsPageParams` | exported interface | 100–115 |
| `EmailsPageData` | exported interface | 117–126 |
| `getEmailsPageData` | exported async function | **128–254** |
| `EmailDeliveryFilters` | exported interface | 256–266 |
| `FilteredDeliveryParams` | exported interface | 268–273 |
| `FilteredDeliveryData` | exported interface | 275–278 |
| `escapeLike` | local function | 280–285 |
| `quoteOrValue` | local function (+doc 287–298) | 299–301 |
| `resolveDeliveryDateBounds` | exported function (+doc 303–335) | 336–363 |
| `DeliveryFilterBuilder` | local interface | 367–372 |
| `applyDeliveryPredicates` | local function (+doc 374–388) | 389–412 |
| `countEmailDeliveryEvents` | exported async function (+doc 414–420) | 421–455 |
| `getFilteredDeliveryEvents` | exported async function (+doc 457–461) | 462–506 |
| `EmailDeliveryPage` | exported type | 508–510 |
| `getEmailDeliveryPage` | exported async function (+doc 512–520) | 521–551 (EOF) |

No other exports. `DELIVERY_SELECT` (local, not exported) verbatim:
```
"id, booking_id, staff_id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at"
```

---

## 2. `getEmailsPageData` — true range and `unstable_cache` idiom

**True range: lines 128–254.** This matches the handoff's claim (`HANDOFF-2026-08-12-IMPLEMENTATION-3.md:270`, "spans :128-254") exactly — re-verified independently by `Read`, not trusted from the handoff. The plan's older `:142-197` figure is **wrong as a range for the whole function** — the handoff itself already flags it as superseded ("not the plan's ':142-197' (already corrected once)"), and 142/197 are in fact two internal landmarks, not the function's boundaries (see §3).

Verbatim `unstable_cache` wrapper idiom (the outer function signature, the cache-key construction, and the options object — callback body omitted here, quoted in full in §3):
```ts
export async function getEmailsPageData(
  params: EmailsPageParams
): Promise<EmailsPageData> {
  const {
    canSeeDelivery,
    canResend,
    canSeeAllBookings,
    staffId,
    businessDate,
    includeTemplates,
  } = params;
  const limit = params.limit ?? EMAILS_PAGE_SIZE;
  const offset = params.offset ?? 0;

  const cached = unstable_cache(
    async (): Promise<EmailsPageData> => {
      const adminClient = createSupabaseAdminClient();
      /* ...callback body, lines 144–236... */
    },
    [
      "emails-page",
      cacheKeyPart({
        canSeeDelivery,
        canResend,
        canSeeAllBookings,
        staffId,
        businessDate,
        includeTemplates,
        limit,
        offset,
      }),
    ],
    { revalidate: 60, tags: [TAGS.EMAILS] }
  );
  return cached();
}
```
- Cache key array (lines 238–250): two elements — literal string tag `"emails-page"`, then `cacheKeyPart({...})` over every param that affects the query result (including the *resolved* `limit`/`offset`, not the raw `params.limit`/`params.offset` — the `??` defaults at lines 139–140 run before the key is built).
- `revalidate: 60, tags: [TAGS.EMAILS]` — line 251. `TAGS.EMAILS = "emails"` (`src/lib/cache/tag-taxonomy.ts:22`).
- `createSupabaseAdminClient()` — called at line 144, **inside** the `unstable_cache` callback (callback starts line 143), same placement as `countEmailDeliveryEvents` (line 428) and `getFilteredDeliveryEvents` (line 473).

---

## 3. `remindersPromise` block and the H11 assignment-scoping block

**H11 assignment-scoping block (comment + code): lines 159–173.** Verbatim:
```ts
      // Reminders scope (H11 middle path). A therapist with
      // resend_booking_emails but only assigned-bookings view is scoped to
      // their own assignments — keeps client contact PII bounded to bookings
      // they're actually working on.
      let allowedReminderBookingIds: string[] | null = null;
      if (canResend && !canSeeAllBookings) {
        const { data: ownAssignments } = await adminClient
          .from("booking_assignments")
          .select("booking_id")
          .eq("assigned_staff_id", staffId)
          .limit(200);
        allowedReminderBookingIds = Array.from(
          new Set((ownAssignments ?? []).map((a) => a.booking_id).filter(Boolean))
        );
      }
```

**`remindersPromise` block: lines 175–197.** Verbatim:
```ts
      const remindersPromise = (() => {
        if (!canResend) return Promise.resolve({ data: [] as ReminderBooking[] });
        if (
          allowedReminderBookingIds !== null &&
          allowedReminderBookingIds.length === 0
        ) {
          return Promise.resolve({ data: [] as ReminderBooking[] });
        }
        let q = adminClient
          .from("bookings")
          .select(
            "id, booking_date, start_time, contact_full_name, contact_email, status"
          )
          .gte("booking_date", businessDate)
          .in("status", ["pending", "confirmed"])
          .order("booking_date")
          .order("start_time")
          .limit(20);
        if (allowedReminderBookingIds !== null) {
          q = q.in("id", allowedReminderBookingIds);
        }
        return q.returns<ReminderBooking[]>();
      })();
```

(The plan's stray `:142-197` figure lines up with `142` = where `unstable_cache(` opens and `197` = where this `remindersPromise` IIFE closes — i.e. it reads as "the block from the cache wrapper's start through the reminders block", not as the true range of `getEmailsPageData` itself. Flagging this reading rather than asserting it was the intent — either way, §2's 128–254 is the number to use for the function.)

**Is the H11 scoping reusable as-is for the new export? No — the 200-row cap on `booking_assignments` is a correctness hazard for a Therapist-scoped caller with more than 200 assignment rows total.**

`.limit(200)` bounds *the whole assignments table for that staff member*, not the reminders-window subset — it is not scoped by date or status. For the existing reminders list this is currently harmless in practice (this is a small clinic; there is no evidence any staff member is anywhere near 200 lifetime assignment rows), but it is a pre-existing, undocumented cap, not a deliberately-sized one for this query's actual candidate volume. A **review-request list draws from `completed` bookings going back to whenever `review_email_sent_at` was ever null**, i.e. potentially the therapist's entire completed-booking history — a much larger and more open-ended set than "assignments for bookings up to ~2 weeks out" that the existing reminders list implicitly bounds itself to via `.gte("booking_date", businessDate)`. Reusing the exact same `allowedReminderBookingIds` computation (same 200-row cap, no additional bound) for the new export means: once any therapist accumulates more than 200 total assignments, the new list can **silently omit** some of their eligible completed bookings from view — not a crash, not a wrong-tenant leak, just quiet under-display. This was already a latent risk on the *existing* reminders list; the new export inherits it unchanged if the block is copied verbatim, and the risk is proportionally larger here because completed-booking history is unbounded in time while upcoming-booking assignments are not.
This is a design flag for the implementer, not a blocking defect — the 200 cap is pre-existing repo behavior (RECON scope is unclear on whether raising it is even in scope for item 1), so widening it is a call for whoever implements Batch B to make deliberately, not something to change silently while copying the block.

---

## 4. `ReminderBooking` type and its select string

Verbatim (lines 86–93):
```ts
export interface ReminderBooking {
  id: string;
  booking_date: string;
  start_time: string;
  contact_full_name: string | null;
  contact_email: string | null;
  status: string;
}
```
Select string used to populate it (lines 185–187, inside `remindersPromise`):
```
"id, booking_date, start_time, contact_full_name, contact_email, status"
```
This type/select is **not sufficient for the new export** — it has no `completed_at`, no `client_id`, and no `clients(email)` embed, all of which the recipient-presence filter and any future client-class copy variation (Step 1e) need. A new type is required, not a reuse of `ReminderBooking`.

---

## 5. What the new query must filter on

**Base predicates (uncontested, three separate live sources agree):**
- `status = 'completed'`
- `review_email_sent_at IS NULL`

Sources: `sendReviewRequestEmail`'s own read (`notifications.ts:1537,1540`, checked in JS after a `.eq("id", bookingId).maybeSingle()` read, not as a list predicate); the cron's candidate query (`route.ts:126-133`, quoted below); and the plan's own test-name spec (`POST-BAND-C-FOLLOWUP-plan.md:396`): `it("returns completed bookings with a recipient and no review_email_sent_at, for the manual review-send list")`.

Cron candidate query, verbatim (`src/app/api/cron/review-emails/route.ts:126-133`):
```ts
  const { data: candidateRows, error: queryErr } = await supabase
    .from("bookings")
    .select("id, client_id, recurring_template_id")
    .eq("status", "completed")
    .is("review_email_sent_at", null)
    .gte("completed_at", sevenDaysAgo)
    .lte("completed_at", twoHoursAgo)
    .limit(50);
```
Note this query does **not** filter on recipient presence at all, and does not embed `clients`. It leaves "no email" handling entirely to `sendReviewRequestEmail`'s own per-row `no_email` branch, which marks the sentinel so the cron never retries that row. The 2h/7-day `completed_at` window is cron-specific pacing (send delay + don't resurface ancient completions on an *automated* schedule) — I did not find anything in the plan or handoff saying the manual admin list should carry the same window, and the manual list's whole purpose (per `POST-BAND-C-FOLLOWUP-plan.md:281`, "bypasses the 6-month client cooldown... one review request per booking") is to let a human reach bookings the automated path skipped, which argues **against** silently copying the 7-day cap onto the admin list. Flagging as an open design question rather than asserting an answer.

**"A recipient present" is confirmed NOT a single column.** `sendReviewRequestEmail`'s real recipient expression, verbatim (`notifications.ts:1544`):
```ts
  const customerEmail = booking.contact_email || booking.clients?.email;
```
against the select (`notifications.ts:1529`):
```ts
"id, client_id, contact_email, completed_at, review_email_sent_at, status, clients(email, city)"
```
So the eligibility condition is `contact_email IS NOT NULL OR clients.email IS NOT NULL`, where `clients` is a to-one embed reached through `bookings.client_id`.

**How PostgREST could express this, and why I recommend JS filtering instead:**

The repo has real, verified precedent for filtering a *plain* embedded column (`.in("bookings.status", [...])` at `assignment-eligibility.ts:244`, `.not("bookings.status", "in", ...)` at `bookings-list-data.ts:535` — both re-verified live against PostgREST in `redesign/evidence/post-band-c-impl/item-1/D-query-shapes.md`, an earlier pass in this same evidence tree). What is **not** present anywhere in this repo is an `.or(...)` expression that spans a **base-table column and an embedded-table column together** (e.g. `contact_email.not.is.null,clients.email.not.is.null` inside one `.or()` string). The closest analogue — `bookings-list-data.ts:384-398`'s `search` arm — explicitly avoids this shape: it pre-resolves matching `clients` rows to a list of ids in a **separate** query, then folds `client_id.in.(${ids.join(",")})` into the `.or()` as a same-table (`bookings.client_id`) predicate (comment at line 394: *"The oracle's `clients.full_name/email/phone` arms, pre-resolved to ids"*). That precedent is not directly reusable here either — it resolves ids matching a **search term**, not "email column is non-null", so it would require a second query (`select id from clients where email is not null`) purely to invert a presence check, which is more machinery than the alternative.

I could not verify, one way or the other, whether `postgrest-js`'s `.or()` accepts a mixed base+embedded-column expression at all (no code path in this repo exercises it, and I have no way to fire a live PostgREST request from this sandbox to test it experimentally). Given that gap, and given two independent existing precedents that both do the OR in JS rather than in SQL for this exact recipient — `sendReviewRequestEmail`'s own `booking.contact_email || booking.clients?.email` (quoted above) and the cron's choice not to filter recipient presence in SQL at all — **I recommend filtering for recipient presence in JS, on the returned rows, after selecting `contact_email` and an embedded `clients(email)`**, not attempting an untested embedded `.or()`. This also has a concrete testability benefit under GOTCHA 39 (§7): a JS `.filter()` step is real code the fake stub's `.eq()`/`.is()`/`.or()` no-ops can never substitute for, so a behavioural test can actually exercise it, whereas a SQL-only predicate would be invisible to the existing test harness regardless of which shape it took.

---

## 6. Ordering + limit

`remindersPromise` uses `.order("booking_date").order("start_time").limit(20)` (quoted in §3) — ascending, soonest-first, capped at 20. The cron's own candidate query (§5) uses no explicit `.order()` and `.limit(50)`.

**Neither the plan nor the handoff specifies an ordering or limit for the new export**, and the one test the plan names for it (`POST-BAND-C-FOLLOWUP-plan.md:396`) asserts only on which rows come back, not their order or a cap. This is left to the implementer. If a bound is wanted, `.order("completed_at", { ascending: false }).limit(20)` (most-recently-completed first, same cap as the reminders list) would be a reasonable default consistent with existing style — noted as my inference, not a verified requirement.

---

## 7. `emails-data.test.ts` — count, stub idiom, GOTCHA 39

**Count:** 28 literal `it(` blocks + 1 `it.each` block with 3 params (line 311) = **31 runtime test cases**, confirmed both by direct read of the file and by the vitest run in §8 (`Tests  31 passed (31)`).

**Verbatim Supabase stub idiom** (`src/lib/cache/__tests__/fake-supabase-admin.ts:50-82`):
```ts
  function builder(result: FakeQueryResult) {
    const chain: Record<string, unknown> = {};
    const passthrough = [
      "select",
      "eq",
      "neq",
      "in",
      "is",
      "or",
      "not",
      "gte",
      "gt",
      "lte",
      "lt",
      "ilike",
      "like",
      "order",
      "limit",
      "range",
      "returns",
      "overrideTypes",
    ];
    for (const method of passthrough) {
      chain[method] = () => chain;
    }
    chain.single = async () => result;
    chain.maybeSingle = async () => result;
    chain.then = (
      onFulfilled?: (value: FakeQueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  }
```

**GOTCHA 39, checked explicitly for this stub, method by method:** every one of `select`, `eq`, `neq`, `in`, `is`, `or`, `not`, `gte`, `gt`, `lte`, `lt`, `ilike`, `like`, `order`, `limit`, `range`, `returns`, `overrideTypes` is `() => chain` — a pure no-op that returns the same chain object. **None of them touch `result`.** `resultFor(table)` (lines 39-48) resolves the row(s) to return purely by table name (and call-order cursor, for array-registered fixtures) — it never looks at what filters were chained. So:

- `select` — **not honoured.** A registered mock row is returned in full regardless of the select string; a real query that (accidentally) narrows or drops a column would show identical behaviour in this suite.
- `in` — **not honoured.**
- `is` — **not honoured.**
- `eq` — **not honoured.**
- `not` — **not honoured.**
- `or` — **not honoured** by this particular stub. (Two of the *other* describe blocks in this same file — `getFilteredDeliveryEvents q-filter or() string`, lines 265-304, and `countEmailDeliveryEvents honours the same filters...`, lines 373-429 — do assert on `.or()`/`.eq()`/`.gte()`/`.lte()` call strings, but they each build their **own** local recording-chain object for that one test, bypassing `createFakeAdminClient` entirely. `createFakeAdminClient` itself never records or inspects any filter call.)

**What a behavioural test against `createFakeAdminClient` can and cannot prove for the new export:**
- **Can prove:** that the right table(s) were queried at all (`fromCalls`); that the fetcher correctly reads/reshapes whatever `data` the stub is told to return (e.g. an array of raw rows in, the export's return shape out — including any JS-side recipient-presence filter from §5, since that runs on real returned data and is real executable code); cache hit/miss and cache-key-differentiation behaviour (via `cacheHarness`, which is a separate fake from the admin-client stub).
- **Cannot prove:** that `.eq("status", "completed")`, `.is("review_email_sent_at", null)`, or any embedded/select predicate was actually sent to the query — feeding the stub only "already eligible" fixture rows and asserting they come back proves the mapping works, not that the real predicate would exclude an ineligible row in production.
- **What would prove the predicates:** either (a) a local recording-stub for this one test, mirroring the existing `chain`/`recordingChain` idiom already used twice in this same file (§ "or() string" and "honours the same filters" tests), asserting the exact `.eq(...)`/`.is(...)` calls made; or (b) a **source-text guard** — reading the file's own source as a string and asserting a substring is present. This exact idiom already exists elsewhere in the repo (not yet in this file): `src/app/api/cron/__tests__/extend-recurring-horizons.test.ts:536-547`, explicitly commented as a GOTCHA-39 guard:
  ```ts
    // ⛔ Gotcha 39. The stub returns the whole mock row whatever the select asked
    // for, so dropping travel_fee from the select breaks NO behavioural test here
    // while silently reinstating the original defect in production. Only reading
    // the source catches it.
    it("keeps travel_fee in the template select", () => {
      const source = readFileSync(
        join(process.cwd(), "src/app/api/cron/extend-recurring-horizons/route.ts"),
        "utf8"
      );
      const select = source
        .split('.from("recurring_booking_templates")')[1]
        ?.split(".is(")[0];

      expect(select).toBeDefined();
      expect(select).toContain("travel_fee");
    });
  ```
  A new test for the new export's `status`/`review_email_sent_at` predicates (and its select string) should use this same technique if it wants to actually guard against a predicate silently being dropped, since `createFakeAdminClient` cannot.

**Shape a new test must take**, per the plan's single named test (`POST-BAND-C-FOLLOWUP-plan.md:396`, `it("returns completed bookings with a recipient and no review_email_sent_at, for the manual review-send list")`): register a `bookings` fixture on `createFakeAdminClient` (mirroring `stubClient()`, lines 48-84 of the test file) containing rows that already look eligible (since the stub cannot filter for real), assert the export's return shape/count against that fixture — this proves the mapping, not the predicate — and pair it with either a recording-stub or a source-text guard (as above) if the predicate itself needs proving.

---

## 8. Test run

Command (from repo root):
```
npx vitest run src/app/admin/emails/__tests__/emails-data.test.ts
```
Output:
```
 RUN  v4.1.5 C:/Users/mamdo/Desktop/rahmatherapy - Copy/rahmatherapy-next-refactor

 Test Files  1 passed (1)
      Tests  31 passed (31)
   Start at  10:36:13
   Duration  1.02s (transform 72ms, setup 0ms, import 104ms, tests 9ms, environment 743ms)
```
**Exact: 1 test file, 31 tests, 31 passed, 0 failed.** Matches the runtime-test-case count derived independently in §7 and in the prior session's `C-tests-and-mocks.md` (28 literal `it(` + 3 from one `it.each`).

---

## Additional drift found, not asked for by number but load-bearing

**`redesign/evidence/post-band-c-impl/item-1/B-idioms-to-mirror.md` (item 1 of that file) quotes a stale `sendReviewRequestEmail`.** That document's own commit-identity check (its lines 6-26) is honest about being written against commit `91a5864...` — but that commit **predates Batch A** (`0863573`, per the task brief, already shipped). Batch A changed `sendReviewRequestEmail`'s signature and body. Confirmed by direct comparison against the current file:

| | `B-idioms-to-mirror.md`'s quote (lines 34-38, 55-58) | Current `notifications.ts:1518-1525` |
|---|---|---|
| Signature | `sendReviewRequestEmail(bookingId, supabase)` — 2 params | `sendReviewRequestEmail(bookingId, supabase, options: { ignoreClientCooldown?: boolean } = {})` — 3 params |
| Return `reason` union | `"no_email" \| "already_sent" \| "send_failed"` | `"no_email" \| "already_sent" \| "send_failed" \| "client_recently_asked"` |
| `ReviewEmailBookingRow` (doc's lines 149-156 vs. current `notifications.ts:1338-1346`) | no `client_id` field | has `client_id: string \| null` |
| Body | no cooldown check | has the `client_id`/`ignoreClientCooldown`/`getClientsAskedForReviewSince` block (current lines 1554-1570) |

The doc's line citations for this symbol (`1356-1444`, `1348-1444`) are consequently also off from the symbol's true current location (`1499-1629` for the whole function incl. its doc comment, `1338-1346` for `ReviewEmailBookingRow`) — expected, since Batch A inserted code above it, not a new error. **Anyone implementing Batch B should re-quote `sendReviewRequestEmail` fresh rather than trusting that document's quoted body** — its structural shape (mirror the `unstable_cache`/scope-check/rate-limit idioms it documents for `actions.ts` and `emails-data.ts`) is still accurate, since those files are unaffected by Batch A, but its `notifications.ts` quote specifically is not.

## Open questions for the implementer (not resolved here — read-only derivation)

1. **Does the new export's list also need to exclude clients currently inside the 6-month cooldown window?** `POST-BAND-C-FOLLOWUP-plan.md` contradicts itself: §1.7 (line 282) describes the new export as "completed bookings with a recipient address and no `review_email_sent_at`" (no cooldown mention), while §1.8's file table (line 292) calls it "completed, recipient-present, **not-yet-cooled-down** bookings". The one test the plan actually names for this file (line 396) tests only status + recipient + sentinel, with no cooldown assertion. If the list is meant to also hide cooldown-suppressed clients, `ignoreClientCooldown: true` on the send action (§1.7, line 281) would be dead code for every row the list could ever show — which argues for showing all eligible rows regardless of cooldown and letting the send-time flag do its job. Not resolved here; flagging the exact contradiction for a human or the orchestrator to settle.
2. Whether the cron's 7-day `completed_at` window belongs on the manual list (see §5) — my read is no, but it is not explicitly settled in the plan either way.
3. Ordering/limit (§6) — not specified anywhere; implementer's choice.
4. Exact export name — the plan (line 396) says only "name the new export consistently and use that exact name here, in `page.tsx`, and in the new form component," without naming it. Not decided here.
