# Item 8 Phase 3 App — data feed and test surfaces (Q3 derivation)

Read-only derivation. Snapshot locked at **2026-08-11T23:54:56Z** (`git status` /
`git diff`, repo root `rahmatherapy-next-refactor`). Every line number below was
re-located by symbol, not trusted from the plan.

## 0. CRITICAL — the repo is being concurrently, uncommittedly modified right now

This is not something I changed; it is what `git status`/`git diff` showed on a
repo I only read. While this derivation was running, the working tree already
contained an **uncommitted, in-progress implementation of most of Item 8 Phase 3
App** — separate from, and apparently unaware of, this Q3 task. The two files
this task names as targets (`booking-detail-data.ts` and the
`updateBookingManagement-completed-guard.test.ts` precedent) are untouched and
stable. Everything else around them is moving:

```
 M src/app/admin/bookings/BookingManagementForm.tsx
 M src/app/admin/bookings/actions.ts
 M src/app/admin/bookings/types.ts
?? src/lib/booking/__tests__/travel-fee.test.ts
?? src/lib/booking/travel-fee.ts
?? supabase/migrations/20260812000500_item8_phase3_bookings_travel_fee.sql
```

I observed `src/lib/booking/travel-fee.ts` gain a new exported function
(`isInFreeTravelArea`) **between two reads taken minutes apart** in this same
session — direct proof of a second, live process editing the tree concurrently.
Nothing below should be treated as a stable baseline to build on top of without
re-running `git status` first. **Recommend the orchestrator confirm no other
session is mid-flight on Item 8 Phase 3 App before dispatching further write
work from this report**, to avoid two agents racing on `actions.ts`.

What the uncommitted work already contains, as of the snapshot above (useful
context, not verified by me beyond static reading — I ran no build/tests, per
my read-only scope):

- `supabase/migrations/20260812000500_item8_phase3_bookings_travel_fee.sql` —
  the source file for the already-applied migration (`travel_fee numeric(10,2)
  not null default 0`), matching the task's stated live-DB facts exactly.
- `src/lib/booking/travel-fee.ts` (new) — `toPence`/`fromPence`/
  `applyTravelFeeDelta`/`parseTravelFee`/`isInFreeTravelArea`. The delta math
  matches the brief's worked example and pence-safety requirement exactly
  (`applyTravelFeeDelta` never re-derives from service price × participants).
- `src/lib/booking/__tests__/travel-fee.test.ts` (new) — unit tests for the
  above, including the exact 90+14=104(not 118) and the 45.30−14.30+20.10 float
  hazard from the brief.
- `src/app/admin/bookings/actions.ts` (modified) — `updateBookingManagement`
  now parses `travel_fee` from the form, computes `travelFeeChanged` against
  `beforeState.travel_fee` (the pre-submit row, already available for free
  since the existing `select("*")` already returns the new column), locks on
  `beforeState.status === "completed"` OR `wasFullyPaid` (computed from
  `beforeState.amount_due`/`amount_paid`, i.e. also pre-submit state) with a
  field-level error on `fieldErrors.travel_fee`, does **not** lock on
  `cancelled`, and folds the delta into `payload.total_price`/`amount_due` via
  `...travelFeeUpdate` spread — full diff quoted in §7 below since it is
  adjacent to, and changes the meaning of, the test-stub analysis in §3–§4.
- `src/app/admin/bookings/types.ts` (modified) — `BookingRecord` gained
  `travel_fee: number | string | null` as a **required** field. This is a
  concrete, testable consequence for `booking-detail-data.ts` (§1 below):
  `normalizeClaimableBooking`'s return-object literal (lines 186–253) builds a
  full `BookingRecordWithClientId` by hand and does not currently set
  `travel_fee` — once this type change lands, that literal fails `tsc` unless
  a `travel_fee: null,` line (mirroring the existing `total_price: null,` /
  `amount_due: null,` style already in that literal) is added.
- `src/app/admin/bookings/BookingManagementForm.tsx` (modified) — already
  accepts a `freeTravelCities?: string[]` prop and calls
  `isInFreeTravelArea(booking.service_city, freeTravelCities)` to hide the
  quick-confirm chip and render an "Outside the free-travel areas" notice. It
  reads `booking.travel_fee` directly. **Nothing currently supplies this
  prop** — `src/app/admin/bookings/[bookingId]/page.tsx` (the only caller of
  `BookingManagementForm`) is unmodified and does not pass `freeTravelCities`.
  This is the live confirmation of exactly the gap Q1 below describes: the
  alert has a renderer now, but no data feed.

---

## 1. `getBookingDetailData` — location, current select, and where a town read fits

**Claim in the plan: line 330. Actual: line 330 — matches exactly (verified by
symbol, not trusted).** File:
`src/app/admin/bookings/[bookingId]/booking-detail-data.ts` (465 lines total).
This file itself carries **zero** uncommitted changes — it is the stable half
of this task.

### Confirmed: no `business_settings` / town-list read anywhere in this file

`grep -n "business_settings" booking-detail-data.ts` → no matches. The plan's
claim is correct: the function fetches the booking row, two audit-log queries,
and one enquiry reverse-lookup — nothing from `business_settings`.

### The two existing parallel-fetch idioms inside the cached closure

There are two, not one, and they are shaped differently — worth knowing before
picking where a third read joins:

1. **A real `Promise.all`** (lines 388–412), gated on `fullScope`, running two
   independent `audit_logs` queries concurrently, then flattened/sorted/capped
   outside the `Promise.all`.
2. **A bare sequential `await`** for `sourceEnquiry` (lines 426–430) — not
   inside a `Promise.all`, runs strictly after the booking fetch resolves,
   because nothing else does.

Neither is "the town list's Promise.all" already; a third read would need to be
added to one of these, or given its own line.

### Where the caller must add it, and how

Two live options exist for the *how*, both already used elsewhere in this repo:

- **Option A — call the existing cached helper.** `getFreeTravelCities()`
  already exists at `src/lib/booking/free-travel-cities.ts:36`, wraps its own
  `unstable_cache` (60s revalidate, tagged `TAGS.SETTINGS`), and is already
  called this exact way — as a bare `Promise.all` sibling of another
  cached helper — at `src/app/(public)/layout.tsx:24-26`:
  ```ts
  const [bookingWindow, freeTravelCities] = MAINTENANCE_MODE
    ? [null, [] as string[]]
    : await Promise.all([getPublicBookingWindow(), getFreeTravelCities()]);
  ```
  Calling it from *inside* `getBookingDetailData`'s own `unstable_cache`
  closure would be a **nested cache call** (an `unstable_cache`-wrapped
  function invoked from inside a different `unstable_cache`'s body) — nothing
  else in this codebase does that today; every existing call site of
  `getFreeTravelCities()` or `getPublicBookingWindow()` sits at a page/layout
  top level, not inside another `unstable_cache`. Concretely: `getBookingDetailData`'s
  own cache entry is *not* tagged `TAGS.SETTINGS` (see the tags array, lines
  454–461), so if the outer cache is fresh but the inner `getFreeTravelCities`
  cache was just busted by a settings save, the outer entry keeps serving the
  town list it captured at its own last run until its own 60s window or one of
  its own tags fires — a real (if narrow) staleness window worth flagging, not
  fixing here.
- **Option B — inline `business_settings` select, mirroring
  `src/app/admin/bookings/new/page.tsx:73-77`** (same table, same column, same
  `.eq("id", 1).single()` shape already used for exactly this purpose
  elsewhere in `admin/bookings`):
  ```ts
  adminClient
    .from("business_settings")
    .select("free_travel_cities")
    .eq("id", 1)
    .single(),
  ```
  This keeps the read inside the same cache scope as the rest of the function
  (single `unstable_cache`, single set of tags) but requires adding
  `TAGS.SETTINGS` to the tags array (lines 454–461) so an admin's settings
  save actually busts this booking-detail cache — currently absent, and
  necessary either way if the alert is to reflect a settings change within the
  same 60s window rather than after it.

Either way, the natural join point is alongside the `sourceEnquiry` read
(§ line 426–430): both are single-row/single-column lookups that don't depend
on `fullScope`, both should run for every viewer who can open the booking
(claimable-only viewers get `service_city: null` in
`normalizeClaimableBooking`, so the alert is moot for them but the fetch
itself is harmless), and joining them into one `Promise.all` parallelizes two
reads that today run sequentially only because nothing forces them to.

---

## 2. Booking select — does it include the five named columns, and travel_fee

Byte-exact quote of `BOOKING_DETAIL_SELECT` (lines 70–118), the string the
full-scope path uses:

```
const BOOKING_DETAIL_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  total_price,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_source,
  amount_due,
  amount_paid,
  paid_at,
  payment_note,
  status,
  payment_status,
  payment_method,
  assignment_status,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  consent_acknowledged,
  customer_notes,
  health_notes,
  customer_manage_notes,
  cancelled_at,
  customer_cancelled_at,
  customer_cancellation_note,
  last_customer_manage_action_at,
  reschedule_requested_at,
  reschedule_preferred_date,
  reschedule_preferred_time,
  reschedule_note,
  reschedule_status,
  admin_notes,
  treatment_notes,
  created_at,
  recurring_template_id,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, display_name, participant_notes, health_notes, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name)),
  email_delivery_events(id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at)
`;
```

**Yes to all five**: `total_price` (line 77), `amount_due` (line 82),
`amount_paid` (line 83), `status` (line 86), `service_city` (line 93) are all
present. **`travel_fee` is absent** — needs adding, one line, anywhere in the
column list (no ordering constraint observed elsewhere in this string).

The claimable-scope string is separate and narrower — quoted for completeness
since it is the other branch of the same `scopedRelation.claimableOnly ? … :
…` select (lines 356–370):

```
const CLAIMABLE_BOOKING_DETAIL_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  status,
  assignment_status,
  group_booking,
  booking_source,
  reschedule_status,
  cancelled_at,
  customer_cancelled_at,
  created_at,
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;
```

It carries none of the five, and its row is fed through
`normalizeClaimableBooking` (lines 183–254), which already nulls out every
money/address field by hand (`total_price: null`, `amount_due: null`,
`service_city: null`, etc.) — consistent with claimable-only viewers not
seeing money or the exact address today. If `travel_fee` becomes a **required**
field on `BookingRecord` (it already has, uncommitted — see §0), this literal
must add a `travel_fee: null,` line or `tsc` fails on this file. This is a
concrete, mechanical consequence, not a judgment call.

---

## 3. `updateBookingManagement-completed-guard.test.ts` — full file, byte-exact

File: `src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts`,
373 lines, unmodified in the working tree (clean per `git status`).

Every `vi.mock`, present in this order (lines 11–45):

```ts
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

// Only the profile lookup is stubbed — the permission helpers stay real so the
// action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingRestoredClientEmail: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn(),
}));
```

No mock for `@/lib/booking/travel-fee` — none is needed today (nothing in
`actions.ts` imported it as of the committed baseline this test file targets),
but note the uncommitted `actions.ts` diff (§0/§7) now imports
`applyTravelFeeDelta`/`parseTravelFee`/`toPence` from that module unmocked —
those are pure functions with no I/O, so leaving them unmocked and real is the
correct choice for these specs, not a gap.

**How the actor is faked**: `updateBookingManagement` calls a private
`requireBookingManager()` (actions.ts:118), which calls
`createSupabaseServerClient()` (mocked to resolve `{}`) then
`getStaffProfile(supabase)`. The test fakes this via
`vi.mocked(getStaffProfile).mockResolvedValue(owner)` in every `beforeEach`
(lines 172, 301), where `owner = staff("Owner", [PERMISSIONS.MANAGE_BOOKINGS_ALL])`
(line 80) built by the `staff()` factory (lines 64–78, quoted below).

**How the beforeState row is faked**: a plain object,
`COMPLETED_BOOKING` (lines 47–62):

```ts
const COMPLETED_BOOKING = {
  id: "booking-1",
  client_id: "client-1",
  status: "completed",
  booking_date: "2026-07-20",
  start_time: "14:00:00",
  payment_status: "unpaid",
  payment_method: null,
  paid_at: null,
  amount_paid: 0,
  total_price: 55,
  admin_notes: "Parking round the back.",
  treatment_notes: "Deep tissue, left shoulder.",
  customer_manage_notes: null,
  payment_note: null,
};
```

No `amount_due`, no `travel_fee`. `stubAdminClient()` (below) takes this as
its default `booking` argument but accepts any override.

**How the supabase stub is built** — the entire function, byte-exact
(lines 90–141):

```ts
/** Stand-in for the Supabase admin client covering `updateBookingManagement`. */
function stubAdminClient(booking: Record<string, unknown> = COMPLETED_BOOKING) {
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp) {
    if (entry.op === "select") return { data: booking, error: null };
    return { data: { ...booking, ...entry.payload }, error: null };
  }

  function startOp(
    table: string,
    op: RecordedOp["op"],
    payload?: Record<string, unknown>
  ) {
    const entry: RecordedOp = { table, op, payload, filters: [] };
    ops.push(entry);
    const chain = {
      eq: (column: string, value: unknown) => {
        entry.filters.push(`eq:${column}=${String(value)}`);
        return chain;
      },
      select: () => chain,
      single: <T,>() =>
        Promise.resolve(resolve(entry) as unknown as { data: T | null; error: unknown }),
    };
    return chain;
  }

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: async (row: Record<string, unknown>) => {
          ops.push({ table, op: "insert", payload: row, filters: [] });
          return { error: null };
        },
      };
    }
    return {
      select: () => startOp(table, "select"),
      update: (payload: Record<string, unknown>) =>
        startOp(table, "update", payload),
    };
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  const find = (table: string, op: RecordedOp["op"]) =>
    ops.filter((entry) => entry.table === table && entry.op === op);
  const audit = () => find("audit_logs", "insert")[0]?.payload;

  return { ops, find, audit, client };
}
```

Every existing `it()` title, in file order:

1. `it.each(["pending", "confirmed", "cancelled", "no_show"])("refuses completed → %s without the force flag", …)` (line 181)
2. `"refuses the force flag when the reason is under 5 characters"` (line 199)
3. `"reopens with the force flag and a reason, folding the reason into the audit row"` (line 220)
4. `"lets a notes save on a completed booking through"` (line 257)
5. `"leaves transitions out of every other status untouched"` (line 274)
6. `it.each(["completed", "no_show"])("refuses %s on a future-dated booking", …)` (line 309, second `describe` block, "future-date guard (W03-E-2)")
7. `"still cancels a future-dated booking, and still emails the client"` (line 330)
8. `"still completes a past-dated booking"` (line 349)
9. `"still completes a booking dated today"` (line 364)

Two `describe` blocks total: `"updateBookingManagement — completed-reversal guard"` (line 169) and `"updateBookingManagement — future-date guard (W03-E-2)"` (line 298), each with its own `beforeEach` resetting mocks and re-stubbing `getStaffProfile`/the two email sends.

---

## 4. Can the caller add fee/total_price/amount_due/amount_paid to a booking row and assert on the UPDATE payload today?

**Yes, in full, with no stub changes required.** Concretely:

- `booking` is typed `Record<string, unknown>` — the caller can pass
  `stubAdminClient({ ...COMPLETED_BOOKING, travel_fee: 0, amount_due: 55 })`
  (or any other object) and it becomes both what the `beforeState` select
  returns (`resolve()`'s `"select"` branch returns `booking` verbatim,
  regardless of the `.eq()` filter value passed — filters are recorded, never
  used to pick a row) **and** the base that the update's returned row merges
  onto (`{ ...booking, ...entry.payload }`).
- The actual `.from("bookings").update(payload)` call site in `actions.ts`
  (currently `.update(payload).eq("id", bookingId).select().single()`,
  lines 457–462 in the committed baseline / 530–535 in the uncommitted one —
  same shape) matches the stub's supported chain exactly: `.select()` takes no
  argument and is ignored (`select: () => startOp(table, "select")` — no-arg
  is fine since the mock never inspects it), `.eq()` records a filter and
  returns the chain, `.single()` resolves. So does the earlier `beforeState`
  fetch, `.from("bookings").select("*").eq("id", bookingId).single()`
  (line 335–339) — same chain shape, `select("*")`'s argument is likewise
  ignored.
- Assertion surface: `stub.find("bookings", "update").at(-1)!.payload` gives
  the exact object the code passed to `.update(...)`. A test can already write
  `expect(update.payload).toMatchObject({ travel_fee: 14, total_price: 104,
  amount_due: 104 })` today, **against the currently-committed `actions.ts`**
  that assertion would simply fail (those keys are absent from `payload`
  because the committed version doesn't build a `travelFeeUpdate` at all) —
  which is exactly the right shape for a red/green TDD cycle once the
  fee-fold logic lands.

What the stub **cannot** do, precisely:

- It does not distinguish rows by id/filter — a test that needs two different
  fixture rows resolved from two different `.eq()` calls in the same test
  isn't supported; every `select`/`update` on a given `stubAdminClient()`
  instance resolves against the one `booking` object it was constructed with.
  Not a blocker here: the fee-lock logic only ever touches one booking per
  test.
- No `.maybeSingle()`, `.order()`, `.limit()`, `.insert()` on any table other
  than `audit_logs` — calling one of those on the `"bookings"` chain throws
  "not a function". Not currently exercised by `updateBookingManagement`'s
  travel-fee path (it only ever does `select`/`update`/`.eq`/`.single` on
  `bookings`), so this is a non-issue for fee-lock tests specifically.
- Numbers are plain JS numbers in the fixture, not Postgres numeric strings —
  a test asserting the exact worked example (`45 × 2 = 90` stored, `+14 = 104`)
  works fine as `total_price: 90` → asserted `total_price: 104`, but a test
  that wants to reproduce the "amount_due has no scale, arrives as a numeric
  string over PostgREST" case (which `applyTravelFeeDelta` already handles —
  see §0/§6) would have to pass a string fixture (`total_price: "90.00"`)
  itself; the stub does not coerce or vary this for you either way, it just
  echoes back whatever was given.

---

## 5. Other existing tests asserting on `updateBookingManagement` payloads

Two other files import/exercise `updateBookingManagement` (repo-wide grep, not
scoped to `admin/bookings/__tests__`):

- **`src/app/admin/bookings/__tests__/quickUpdateBookingCancel.test.ts`** —
  same server-action, same kind of assertion (`stub.find("bookings",
  "update").at(-1)!.payload`), different concern (the cancellation-email
  queue/sweep, not the completed/future-date guards). Three relevant
  `describe` blocks: `"updateBookingManagement — the Status form opens the
  same window"` (line 394), `"updateBookingManagement — leaving cancelled
  kills the queued email"` (line 443), plus a bare `it()` at line ~506 for the
  over-blocking canary. Its `stubAdminClient` (line 155) and money fixture
  (`FUTURE_CONFIRMED_BOOKING`, lines 82–91: `total_price: 55, amount_due: 55,
  amount_paid: 0`) are shaped the same way as the completed-guard file's, no
  `travel_fee`. This file is unmodified/clean.
- **`src/app/admin/bookings/BookingManagementForm.test.tsx`** — a different
  kind of "payload" assertion. `updateBookingManagement` is fully mocked
  (`vi.mock("./actions", () => ({ updateBookingManagement: vi.fn(), … }))`,
  line 14), and `lastPayload()` (lines 77–80) reads the **`FormData` the
  client component submitted to the mocked action**, not anything written to
  Supabase:
  ```ts
  function lastPayload() {
    const call = vi.mocked(updateBookingManagement).mock.calls.at(-1);
    return Object.fromEntries((call![1] as FormData).entries());
  }
  ```
  Three assertion sites (lines 131, 164, 199). This is the precedent for
  testing that a new travel-fee `<input>` actually lands in the submitted
  `FormData` — a UI-level test, complementary to but distinct from the
  server-side fold/lock tests in §3–§4. **This file is unmodified**, even
  though `BookingManagementForm.tsx` itself is (§0) — i.e. the uncommitted UI
  work has no test coverage yet.

---

## 6. Repo idiom for money assertions in tests

Grepped `toBeCloseTo`, `toBe(104)`, `pence`, `Math.round` across
`src/**/__tests__/**`. Findings:

- **No `pence` and no `Math.round` anywhere in any existing `__tests__`
  directory** (repo-wide, before the uncommitted `travel-fee.test.ts` — see
  below). Money-as-integer-pence is not an established test idiom anywhere
  else in the codebase; it is being introduced fresh for this feature.
- **`toBeCloseTo`** appears only in reporting/analytics tests, never for raw
  currency values — always for *rates* and *percentages* (floating-point
  ratios, where approximate equality is the correct tool):
  - `src/app/admin/reports/__tests__/reporting-b2.test.ts:141,174,196,219,241,339`
    — `result.rate`, `percentageOfRevenue`, `avgMinutesToFirstContact`.
  - `src/app/admin/reports/__tests__/reports-helpers.test.ts:385` —
    `util.delta`.
- **No `toBe(104)`-style exact-money literal anywhere in the pre-existing
  test suite.** Money assertions elsewhere in the codebase (e.g. the
  `total_price`/`amount_due`/`amount_paid` fixtures quoted in §3/§5) use plain
  `toMatchObject({ amount_paid: 0, … })`-style exact equality on whole-pound
  fixtures (55, 90), never `toBeCloseTo`.

**The uncommitted `src/lib/booking/__tests__/travel-fee.test.ts`** (§0) is
therefore the *first* place in this codebase establishing a pence-safe money
idiom: exact `toBe(104)` / `toBe(51.1)` assertions on the pounds-decimal
*output* of `applyTravelFeeDelta` (never on raw pence internally — `toPence`
itself is only asserted directly in one `it("round-trips through pence")`
case), plus one explicit demonstration of the float hazard being defended
against (`expect(45.3 - 14.3 + 20.1).not.toBe(51.1)`, line 32). Any new tests
in the completed-guard file for the fee-lock behaviour should follow this same
convention — assert exact pounds-decimal values on the `payload` object
(`toMatchObject({ travel_fee: 14, total_price: 104, amount_due: 104 })`), not
`toBeCloseTo`, since `applyTravelFeeDelta` guarantees exact 2dp output.

---

## 7. Full diff of the uncommitted `updateBookingManagement` change (context for §0/§4)

For completeness, since §3–§4's analysis of "what the caller can assert" is
only actionable once this logic exists — and per the snapshot lock in §0, it
already does, uncommitted:

```diff
diff --git a/src/app/admin/bookings/actions.ts b/src/app/admin/bookings/actions.ts
index 10819ed..60f797a 100644
--- a/src/app/admin/bookings/actions.ts
+++ b/src/app/admin/bookings/actions.ts
@@ -16,6 +16,11 @@ import {
   sendStaffUnassignmentEmail,
 } from "@/lib/email/notifications";
 import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
+import {
+  applyTravelFeeDelta,
+  parseTravelFee,
+  toPence,
+} from "@/lib/booking/travel-fee";
 import { canAssignBookings, getStaffProfile } from "@/lib/auth/rbac";
 import { createSupabaseServerClient } from "@/lib/supabase/server";
 import {
@@ -305,6 +310,14 @@ export async function updateBookingManagement(
   const paymentNote = String(formData.get("payment_note") ?? "").trim();
   const fieldErrors: Record<string, string> = {};
   const amountPaid = amountPaidValue ? Number(amountPaidValue) : 0;
+  // Item 8 Phase 3. Absent (not empty) means the form never carried the field —
+  // the notes forms re-post a subset — so only a submitted value can change the
+  // fee. An empty submitted field means "no charge", which is 0, not an error.
+  const travelFeeRaw = formData.get("travel_fee");
+  const travelFeeSubmitted = travelFeeRaw !== null;
+  const travelFeeInput = travelFeeSubmitted
+    ? parseTravelFee(String(travelFeeRaw))
+    : null;
 
   if (!bookingId) fieldErrors.booking_id = "Booking is required.";
   if (!BOOKING_STATUSES.includes(status)) {
@@ -328,6 +341,10 @@ export async function updateBookingManagement(
   if (!Number.isFinite(amountPaid) || amountPaid < 0) {
     fieldErrors.amount_paid = "Enter a valid amount paid.";
   }
+  if (travelFeeSubmitted && travelFeeInput === null) {
+    fieldErrors.travel_fee =
+      "Enter a travel charge of 0 or more, to the penny.";
+  }
 
   if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
 
@@ -340,6 +357,61 @@ export async function updateBookingManagement(
 
   if (!beforeState) return { error: "Booking not found." };
 
+  // ── Item 8 Phase 3 — the travel charge ────────────────────────────────────
+  // Evaluated against the booking as it stands BEFORE this submit, so setting
+  // the fee and marking the visit paid in the same save still works. Only a
+  // CHANGED fee is gated: an unchanged one re-posted alongside a note edit on a
+  // completed booking must still go through. Cancelled is deliberately NOT
+  // locked — a cancelled booking is not financial history.
+  const previousTravelFee = Number(beforeState.travel_fee ?? 0);
+  const travelFeeChanged =
+    travelFeeInput !== null &&
+    toPence(travelFeeInput) !== toPence(previousTravelFee);
+
+  if (travelFeeChanged) {
+    const previousAmountDue = Number(beforeState.amount_due ?? 0);
+    const previousAmountPaid = Number(beforeState.amount_paid ?? 0);
+    const wasFullyPaid =
+      previousAmountDue > 0 && previousAmountPaid >= previousAmountDue;
+
+    if (beforeState.status === "completed") {
+      return {
+        fieldErrors: {
+          travel_fee:
+            "This booking is completed — the travel charge can no longer be changed.",
+        },
+      };
+    }
+    if (wasFullyPaid) {
+      return {
+        fieldErrors: {
+          travel_fee:
+            "This booking is fully paid — the travel charge can no longer be changed.",
+        },
+      };
+    }
+  }
+
+  // The fee is folded INTO the stored totals as a delta, never summed by a
+  // reader and never re-derived from service price x participants. See
+  // src/lib/booking/travel-fee.ts for why this is integer pence.
+  const travelFeeUpdate =
+    travelFeeChanged && travelFeeInput !== null
+      ? (() => {
+          const folded = applyTravelFeeDelta({
+            totalPrice: beforeState.total_price,
+            amountDue: beforeState.amount_due,
+            previousTravelFee,
+            nextTravelFee: travelFeeInput,
+          });
+          return {
+            travel_fee: travelFeeInput,
+            total_price: folded.totalPrice,
+            amount_due: folded.amountDue,
+          };
+        })()
+      : {};
+
   // State-machine guard (C-04a Phase B): leaving `completed` is a
   // mistake-correction path, not a routine status edit, so it needs the Status
   // form's confirm modal to send an explicit force flag plus a reason. Every
@@ -415,6 +487,7 @@ export async function updateBookingManagement(
     beforeState.status === "cancelled" && status !== "cancelled";
 
   const payload = {
+    ...travelFeeUpdate,
     status,
     payment_status: paymentStatus,
     payment_method:
```

Note for whoever picks this up: since **every existing test** in the
completed-guard file (§3) never sets `formData.set("travel_fee", …)`,
`travelFeeRaw` is `null` in all of them, so `travelFeeSubmitted` is `false`,
`travelFeeInput` stays `null`, `travelFeeChanged` is `false`, and
`travelFeeUpdate` spreads as `{}` — the existing 9 `it()`/`it.each()` cases
above should be unaffected by this diff. I did not run the suite to confirm
this (out of scope — read-only, no build/test execution), so it is a static
read, not a verified pass.

---

## Summary for the caller

1. **Read side** (`booking-detail-data.ts`, §1): add one more read for
   `business_settings.free_travel_cities`, joined with the existing
   `sourceEnquiry` await into a `Promise.all` (or its own line), plus
   `travel_fee` added to `BOOKING_DETAIL_SELECT` (§2) and to
   `normalizeClaimableBooking`'s literal (§2). If read inline (mirroring
   `admin/bookings/new/page.tsx`), also add `TAGS.SETTINGS` to this function's
   cache tags. This file is untouched by the concurrent work in §0 — it is
   the one piece of Phase 3 App's data path still fully open.
2. **Write side** (`actions.ts`) already has an uncommitted implementation
   (§0/§7) matching the brief's design point-for-point — delta-in-pence,
   locked on completed/fully-paid pre-submit state, cancelled not locked.
   Needs review/ownership decision, not re-implementation.
3. **Test side**: the completed-guard file's stub (§3/§4) already supports
   everything a fee-lock test needs with zero stub changes — arbitrary
   `travel_fee`/`total_price`/`amount_due` on the fixture, and exact
   `toMatchObject` assertions on the `.update()` payload, following the
   pence-safe convention already established in the new (uncommitted)
   `travel-fee.test.ts` (§6), not the `toBeCloseTo` idiom used elsewhere in
   this codebase for rates/percentages. `BookingManagementForm.test.tsx` (§5)
   is the separate precedent for asserting the new fee `<input>` reaches the
   submitted `FormData`, and has no coverage for it yet.
