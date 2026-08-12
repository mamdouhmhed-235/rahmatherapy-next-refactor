# Z2 — The bypass: every path to `confirmed` that skips the travel-fee input

Read-only derivation. Repo state at time of read (`git status --porcelain -- src/ supabase/`):

```
 M src/app/admin/bookings/BookingManagementForm.test.tsx
 M src/app/admin/bookings/BookingManagementForm.tsx
 M src/app/admin/bookings/[bookingId]/booking-detail-data.ts
 M src/app/admin/bookings/[bookingId]/page.tsx
 M src/app/admin/bookings/__tests__/BookingCard.test.tsx
 M src/app/admin/bookings/__tests__/view-predicates-parity.test.ts
 M src/app/admin/bookings/actions.ts
 M src/app/admin/bookings/bookings-list-data.ts
 M src/app/admin/bookings/types.ts
 M src/lib/maintenance.ts
?? src/app/admin/bookings/__tests__/updateBookingManagement-travelFee.test.ts
?? src/lib/booking/__tests__/travel-fee.test.ts
?? src/lib/booking/travel-fee.ts
?? supabase/migrations/20260812000500_item8_phase3_bookings_travel_fee.sql
```

This is a **fourth** snapshot of a working tree the three prior derivations (Q1/Q2/Q3) already
found moving underneath them. It has moved again since their reads: `actions.ts` grew from
1754→1826 lines, `BookingManagementForm.tsx` from 1494→1601, and the change now also touches
`BookingCard.test.tsx`, `bookings-list-data.ts`, `[bookingId]/page.tsx`, and
`view-predicates-parity.test.ts` — none of which Q1/Q2/Q3 saw modified. The implementation is
now substantially further along than any prior report describes: `updateBookingManagement`'s
fee-fold/lock logic is complete, `BookingManagementForm.tsx` has a working `travel_fee` field and
a working confirm-chip hide+alert, `booking-detail-data.ts` and `bookings-list-data.ts` both
select and normalize `travel_fee`, and dedicated test files exist for the arithmetic, the lock,
and the detail-page chip gating. **Re-run `git status` before dispatching further work from this
report** — the same warning Q1/Q2/Q3 each gave still applies.

Given that, this report's job — tracing every path to `confirmed` that skips the fee input — finds
the two paths the task brief already named are now correctly closed, and finds **two bypasses the
brief did not name and no prior report flagged**, both live in the current working tree.

---

## 1. The four paths to `confirmed`, and which are gated

### Path A — `QUICK_ACTIONS` "Confirm booking" chip (booking detail page) — **GATED**

`src/app/admin/bookings/BookingManagementForm.tsx`. The chip is one of four static
`QUICK_ACTIONS` entries (opens line 358, confirm entry lines 359-368), rendered via
`StateAwareQuickActionButton` (396 ff.), consumed at the `.filter().map()` call inside
`StatusAndPaymentSection` — byte-exact, lines 826-836:

```
826	        {QUICK_ACTIONS.filter(
827	          (descriptor) =>
828	            !(descriptor.action === "confirm" && needsTravelFeeBeforeConfirm)
829	        ).map((descriptor) => (
830	          <StateAwareQuickActionButton
831	            key={descriptor.action}
832	            booking={booking}
833	            descriptor={descriptor}
834	          />
835	        ))}
836	      </div>
```

`needsTravelFeeBeforeConfirm` is computed just above, lines 733-738:

```
733	  const isOutsideFreeTravel = !isInFreeTravelArea(
734	    booking.service_city,
735	    freeTravelCities
736	  );
737	  const travelFee = Number(booking.travel_fee ?? 0);
738	  const needsTravelFeeBeforeConfirm = isOutsideFreeTravel && travelFee === 0;
```

Clicking the chip still posts through `quickUpdateBooking`'s `action === "confirm"` branch
(actions.ts 849-851, unchanged, still a bare `{ status: "confirmed" as BookingStatus }` with no
fee field and no server-side fee check) — **the gate is entirely client-side**: hide the
affordance, force the admin onto the form below, which has the field. There is no server-side
block on confirming an out-of-zone, fee-0 booking; the design's own philosophy (visible throughout
`actions.ts`'s comments) is to fence terminal-state doors procedurally, not to hard-refuse a
business choice the form itself permits.

### Path B — Full Status & Payment form → `updateBookingManagement` — **GATED where it matters**

The status dropdown (`<option value="confirmed">`, line 892) posts through
`updateBookingManagement`, which now carries the field (`travel_fee` name, lines 316-320), the
format check (344-347), and the completed/fully-paid lock evaluated against `beforeState` (i.e.
before this submit — 366-393), folding the delta via `applyTravelFeeDelta` (398-413) and spreading
it into the payload (`...travelFeeUpdate,` at 490). This path does **not** block a `pending →
confirmed` save at `travel_fee = 0` — the admin can still choose to save it that way — but they can
only do so having seen the field, which is the brief's actual bar ("must not be able to
**one-click** confirm ... at travel_fee = 0", not "must never confirm at 0").

### Path C — `restoreBooking` defaulting to `confirmed` — **NOT GATED — bypass #1**

`RESTORE_TARGET_STATUSES = ["confirmed", "pending"]` (actions.ts:80). `restoreBooking` reads its
target from the form, defaulting to `"confirmed"` when absent:

```
1001	  const targetStatusValue = String(formData.get("target_status") ?? "confirmed");
```

`restoreBooking`'s `beforeState` select is `"*, clients(deleted_at)"` (line 1018) — a wildcard, so
`travel_fee` is present on it — but **nothing in the function reads it**. A repo grep of the whole
function body (992-1190) for `travel_fee|isInFreeTravelArea|freeTravel` returns zero hits. The
payload builder (`buildPayload`, 1072-1084) sets only `status`, and — only when leaving
`cancelled` — clears `customer_cancelled_at`/`customer_cancellation_note`/`cancelled_at`. No fee
awareness anywhere in this function.

Because Item 8 Phase 2 made out-of-zone addresses bookable (arriving `pending`), and because the
fee lock explicitly does **not** apply to `cancelled` ("Cancelled is deliberately NOT locked" —
actions.ts:364), the following sequence is live and unobstructed today:

1. An out-of-zone booking arrives `pending`, `travel_fee = 0` (the column default).
2. Admin cancels it — no fee gate fires; cancellation is never locked.
3. At any point within the restore window (S6/S7), admin clicks **"Restore booking"** — one click,
   through a generic confirm modal that never mentions money — and the booking is written straight
   to `status: "confirmed"`, `travel_fee` still `0`, having skipped `pending` and the fee field
   entirely.
4. The booking can now be completed or marked fully paid, at which point `travel_fee` **locks
   permanently at 0** — this is exactly the brief's stop condition, reached via a path the brief
   never named.

This one root cause has **two independent one-click UI entry points**, both reachable by the same
actor class (`canManageAllBookings` / `fullScope`) as Path A:

**C1 — `[bookingId]/page.tsx`'s "Restore booking" button (the operational-pulse strip).**
`deriveNextAction` hardcodes the target for both restorable source statuses:

```
1336	      action:
1337	        momentPassed || windowExpired
1338	          ? undefined
1339	          : {
1340	              kind: "restore_booking",
1341	              label: "Restore booking",
1342	              targetStatus: "confirmed",
1343	            },
```
(cancelled-source branch, 1310-1344) and identically for no_show:
```
1359	      action: restorable
1360	        ? {
1361	            kind: "restore_booking",
1362	            label: "Restore booking",
1363	            targetStatus: "confirmed",
1364	          }
1365	        : undefined,
```
(no_show-source branch, 1347-1367). `nextAction` (and this button) is gated on `fullScope`
(line 394: `const nextAction = fullScope ? deriveNextAction(bookingWithTimeline) : null;`) — the
same actor class as Path A, not a lesser-privileged escape hatch. `NextActionButton`
(`src/app/admin/bookings/[bookingId]/NextActionButton.tsx`, full file read) takes `targetStatus` as
a prop and posts it verbatim (line 52: `formData.set("target_status", targetStatus);`) with **no
other fields** — its confirm modal body (lines 105-114) lists three bullets ("Status will change
…", "Assigned staff will be notified.", "Audit log records the restore.") and never mentions money.

**C2 — `BookingRowActions.tsx`'s row-menu "Restore booking" item (bookings list page).** This one
doesn't even set `target_status`, relying on `restoreBooking`'s own default:

```
285	  async function undoCancellation() {
```
— that's the *Undo* handler (does set `target_status`, see §2). The **menu item** is separate,
`runQuickAction("restore")` (line 497 trigger), which builds its FormData in `runQuickAction`
(190-221): `booking_id` and `action` only — `target_status` is never set on this path. Confirmed
by the component's own test, `BookingRowActions.test.tsx` (lines 104-120):

```
104	  it("restores a cancelled booking through the confirm dialog", async () => {
...
116	    expect(lastPayload()).toMatchObject({
117	      booking_id: "booking-1",
118	      action: "restore",
119	    });
```

No `target_status` in the asserted payload — the test itself documents that this surface leaves it
to the server default of `"confirmed"`. The modal's own copy states the outcome outright:

```
486	                  <ConfirmActionModal
487	                    title="Restore this booking?"
...
493	                    description="The booking goes back to confirmed and assigned staff are notified."
```

(lines 486-508). `isInertStatus` (line 364: `status === "cancelled" || status === "no_show"`)
gates which rows show this item — the same two source statuses as C1 — with zero fee awareness in
between (`restoreBlockedReason`, 371-384, checks only the S6 past-moment and S7 window guards).

### Path D — `BookingRowActions.tsx`'s own "Confirm" button (bookings list page) — **NOT GATED — bypass #2**

Distinct from Path A: the bookings **list page** (`/admin/bookings`) renders its own,
independent one-click Confirm button per row, in `BookingRowActions.tsx`, and it was never wired
to the free-travel/fee logic that Path A received.

`showConfirm`, byte-exact (lines 341-342):
```
341	  const showConfirm =
342	    role === "full" && status === "pending" && pendingAction !== "cancel";
```
No fee term, no city term — compare to Path A's `needsTravelFeeBeforeConfirm`, which this
predicate has no equivalent of. The button itself (417-431):
```
417	      {showConfirm ? (
418	        <button
419	          type="button"
420	          onClick={() => runQuickAction("confirm")}
...
429	          Confirm
430	        </button>
431	      ) : null}
```
posts through the exact same `quickUpdateBooking` `action === "confirm"` branch as Path A
(actions.ts 849-851) — same server code, same zero fee-awareness — but with no client-side hide at
all. `role === "full"` is the list page's name for the same `canManageAllBookings` actor class
(`const canViewAll = canManageAllBookings(profile);` — `page.tsx:233` — propagated down to
`BookingCard`'s `role: "full" | "therapist"` prop, `BookingCard.tsx:303`, and from there into
`BookingRowActions`).

**Structurally, the component cannot know better.** `BookingRowActions`'s own prop type carries no
address or money field at all — the full `Props` type (lines 31-53) has `bookingId`, `clientName`,
`role`, `status`, `paymentStatus`, `assignmentStatus`, `mapUrl`, `claimableAssignmentId`,
`bookingDate`, `startTime`, `cancelledAt`, `customerCancelledAt` — no `service_city`, no
`travel_fee`, no `freeTravelCities`. Its sole caller, `BookingCard.tsx`, doesn't pass them either
— the full call site (245-258):
```
245	        <BookingRowActions
246	          bookingId={booking.id}
247	          clientName={clientName}
248	          role={role}
249	          status={booking.status}
250	          paymentStatus={booking.payment_status}
251	          assignmentStatus={booking.assignment_status}
252	          mapUrl={showSensitiveDetails ? mapUrl : null}
253	          claimableAssignmentId={claimableAssignment?.id ?? null}
254	          bookingDate={booking.booking_date}
255	          startTime={booking.start_time}
256	          cancelledAt={booking.cancelled_at}
257	          customerCancelledAt={booking.customer_cancelled_at}
258	        />
```
This is **not** a missing-data problem — the data is one hop away and already flowing through this
exact file's data source: `bookings-list-data.ts` already selects both `travel_fee` (line 75) and
`service_city` (line 91), and already normalizes `travel_fee: null,` for the claimable-only branch
(line 559), mirroring exactly what Q3's report predicted for `booking-detail-data.ts`'s
`normalizeClaimableBooking`. The town list (`freeTravelCities`) is the one genuinely new fetch this
surface would need — nothing in `bookings-list-data.ts` or `page.tsx` currently calls
`getFreeTravelCities()`.

---

## 2. Is the Undo toast also a bypass? — No, checked and ruled out

Two "Undo" handlers exist (`BookingManagementForm.tsx:171-193`,
`BookingRowActions.tsx:285-309`), both fired from the toast shown immediately after a cancel, both
building `target_status` from the **client-held pre-cancel status**, not hardcoding `"confirmed"`:
```
175	    undoFormData.set(
176	      "target_status",
177	      booking.status === "pending" ? "pending" : "confirmed"
178	    );
```
(`BookingManagementForm.tsx`, 175-178; `BookingRowActions.tsx`'s `undoCancellation`, 289-292, is
character-for-character the same ternary on its own `status` variable.) A booking that was
`pending` (fee never considered) when cancelled comes back `pending` on Undo — not `confirmed` —
so the *fee field is still enforced downstream* the normal way. A booking that was already
`confirmed` (fee, if any, already set) comes back `confirmed` with `restoreBooking` never touching
`travel_fee`, so the previously-set fee survives untouched. **Neither Undo path reaches `confirmed`
with a fee that was never considered.** This is the one place in the codebase that already gets the
"what was this booking's status, really" question right — and it is the natural model for fixing
Path C (see §3).

---

## 3. What gating is required, and exactly where

**Path D (list-page Confirm button) — the more surgical fix.** Thread the same predicate Path A
already computes, one hop further:
- Add `travel_fee: number | string | null` and `service_city: string | null` to
  `BookingRowActions`'s `Props` (currently 31-53), plus a `freeTravelCities: string[]` prop (or a
  precomputed `needsTravelFeeBeforeConfirm: boolean`, matching the naming Path A already
  established).
- `bookings-list-data.ts` already selects both source columns (75, 91) — no new select needed for
  those two; only the town list is a new fetch (`getFreeTravelCities()`, already used this exact
  way as a `Promise.all` sibling at `src/app/(public)/layout.tsx:24-26`, per Q3's report).
- Thread from `page.tsx` → `BookingCard.tsx` (call site 245-258) → `BookingRowActions.tsx`.
- Change `showConfirm` (341-342) to add `&& !needsTravelFeeBeforeConfirm`, mirroring Path A's
  filter predicate exactly so the two surfaces cannot drift.

**Path C (restore-to-confirmed) — recommend reusing the Undo toast's own pattern, not inventing a
new lock.** The two restore-to-confirmed entry points (`page.tsx`'s `deriveNextAction`,
`BookingRowActions.tsx`'s row-menu item) both hardcode/default `targetStatus: "confirmed"`
regardless of whether the booking was ever actually confirmed before. The Undo toast in the same
two files already computes the *correct* target from the booking's own prior state. The minimal,
best-precedented fix: when the booking being restored is `pending`-sourced (or, short of tracking
that, when `needsTravelFeeBeforeConfirm` is true for its current `service_city`/`travel_fee`),
restore it to `target_status: "pending"` instead of `"confirmed"` — which re-routes the admin
through Path A or Path B's already-working gates rather than requiring a new server-side check
inside `restoreBooking` itself (which has no town-list access today and would need one added, a
larger change). This needs the same `needsTravelFeeBeforeConfirm` computation as Path A/D wired
into `deriveNextAction` (`page.tsx`) and into `BookingRowActions.tsx`'s restore-item visibility
decision — both already need `freeTravelCities`/`travel_fee`/`service_city` for Path D's fix, so
the two fixes share the same new plumbing.

A server-side belt-and-braces version (reject the request inside `restoreBooking` itself when
`targetStatus === "confirmed" && needsTravelFeeBeforeConfirm`) is also possible and would close the
gap even against a hand-crafted request, but requires `restoreBooking` to fetch
`business_settings.free_travel_cities` inline (it has no such read today) — a materially larger
change than restoring to `pending` client-side. Given Path A/B's own precedent (client-side hide,
no server hard-block on confirming at fee 0 through the *form*), the client-side reroute is the
more consistent fix; flagging the server option since the brief asks for "must not be able to" —
which the client-side reroute already achieves for every UI-driven click, matching what Path A
already ships.

---

## 4. What does the admin see when a chip is hidden, today?

**Path A (detail page) — already has clear, correct copy.** When
`needsTravelFeeBeforeConfirm` is true, the chip row (`.filter().map()`, 826-836) simply omits the
Confirm chip — but an explanatory panel renders immediately below it, byte-exact (838-856):

```
838	      {needsTravelFeeBeforeConfirm ? (
839	        <div
840	          role="status"
841	          className="mb-5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-3 text-sm text-[var(--admin-body)]"
842	        >
843	          <strong className="font-semibold">
844	            Outside the free-travel areas.
845	          </strong>{" "}
846	          {booking.service_city?.trim()
847	            ? `${booking.service_city.trim()} is not in `
848	            : "This address is not in "}
849	          {freeTravelCities.length > 0
850	            ? freeTravelCities.join(", ")
851	            : "the free-travel areas"}
852	          . Set a travel charge below before confirming — one-click confirm is
853	          hidden until you do, because the charge can no longer be changed once
854	          the visit is completed or fully paid.
855	          </div>
856	      ) : null}
```
This is not a confusing empty gap: it names the town, names the reason, and points at the fix
("Set a travel charge below"). No further copy work needed here.

**Path D (list page) — currently nothing to see, because nothing is hidden.** The button is always
shown when `showConfirm` is true; there is no "hidden" state to evaluate yet. Once Path D's fix
lands, the list page has materially less room per row than the detail page's panel — a full
sentence like the one above does not fit a table/card row alongside Claim/Assign/Mark
paid/Cancel. Minimum recommended copy for that constrained space: replace the Confirm button's slot
with a small inline label or icon+tooltip reading **"Set travel charge"** (short enough for a
button-sized slot) that, on click/tap, either jumps to the booking's detail page (where Path A's
full alert and the fee field both live) or opens the same alert as a tooltip. The exact
component/interaction choice is an implementation decision outside this derivation's scope, but
*some* replacement affordance is required — a silently-missing Confirm button next to four other
live buttons reads as "no live way to confirm this booking" rather than "here's why, and what to
do," which is worse than Path A's current empty-space handling, not equivalent to it.

**Path C (restore-to-confirmed) — same gap as Path D if fixed via reroute-to-pending.** If the
recommended fix (§3) reroutes to `target_status: "pending"` instead of hiding the action outright,
the admin still sees "Restore booking" and clicks it — it just lands the booking on `pending`
instead of `confirmed`. The toast copy ("Booking restored.") would then be accurate either way, but
the **modal's own description** ("The booking goes back to confirmed…", `BookingRowActions.tsx:493`,
and `NextActionButton.tsx`'s bullet "Status will change from {fromStatus} to {targetStatus}") would
need to reflect the actual target dynamically rather than being written as if `confirmed` is always
the outcome — both already parameterize on `targetStatus`/`STATUS_WORDS[targetStatus]`
(`NextActionButton.tsx:109-111`) so this is a copy consequence of picking the right target, not a
separate fix.

---

## 5. What breaks when the fee field is wired in — current, verified state

The field is **already wired in** (not hypothetical, as it was when Q1/Q2/Q3 wrote their reports).
Checked against the live tree:

- **Type errors**: `BookingRecord.travel_fee: number | string | null` is now a required field
  (`types.ts:101`). Both places that hand-build a normalized `BookingRecord`-shaped literal have
  already been updated: `booking-detail-data.ts`'s claimable-only normalizer sets `travel_fee:
  null,` (line 199) and `bookings-list-data.ts`'s equivalent does the same (line 559). No
  outstanding `tsc` gap found by grep in either file. `BookingRowActions.tsx`'s `Props` type has
  **no** `travel_fee`/`service_city` fields — this is not a type error (TS does not complain about
  data a component chooses not to accept), it is the functional gap in §1 Path D.
- **Existing tests, server side**: a dedicated new file,
  `src/app/admin/bookings/__tests__/updateBookingManagement-travelFee.test.ts`, covers the fold
  arithmetic and the lock (11 tests across two `describe` blocks: "travel fee arithmetic" and
  "travel fee lock" — titles confirmed by grep, including `"does not lock the travel fee on a
  cancelled booking"`). The pre-existing `updateBookingManagement-completed-guard.test.ts` and
  `quickUpdateBookingCancel.test.ts` were not modified and, per Q3's static read (unverified by a
  real test run — read-only scope forbids one), should be unaffected since none of their fixtures
  post `travel_fee`.
- **Existing tests, client side**: `BookingManagementForm.test.tsx` gained a new `describe`,
  `"BookingManagementForm — quick-confirm gating on the travel charge"` (4 tests, titles confirmed
  by grep), including `"leaves the quick-confirm chip alone when the free-travel list is
  unavailable"` — i.e. the fail-safe direction (§6) is already under direct test, not just
  documented in a comment.
- **Untested today — the two bypasses this report found**: `BookingRowActions.test.tsx` (renders
  `BookingRowActions` directly, mocks `quickUpdateBooking`) has zero mention of
  `travel_fee`/`travelFee`/`freeTravel` anywhere in the file, and its one restore-related test
  (`"restores a cancelled booking through the confirm dialog"`, 104-120) asserts the exact
  `{booking_id, action}` payload with no `target_status`, silently documenting Path C2's server-side
  default rather than testing against it. `restoreBooking.test.ts` (full test-title list read,
  30+ cases covering S6/S7/completed-reopen/deleted-client) likewise has zero
  `travel_fee`/`freeTravel` mentions. `BookingCard.test.tsx` has a `travel_fee: 0` fixture entry
  (line 97) but only because `BookingRecord` now requires the field for the fixture to typecheck —
  not because anything in that file asserts on fee-gating behaviour.
- **Lint baseline**: `redesign/HANDOFF-2026-08-11-IMPLEMENTATION-2.md` names six files as the
  standing 59E/7W lint baseline (`area-page.jsx`, `shared.jsx`, `site-chrome.jsx`,
  `BookingExperience.tsx`, `BookingExperienceLoader.tsx`, `returning-customer.ts`). None of the nine
  files this change touches (`actions.ts`, `BookingManagementForm.tsx`,
  `[bookingId]/booking-detail-data.ts`, `[bookingId]/page.tsx`, `bookings-list-data.ts`,
  `types.ts`, plus the untracked `travel-fee.ts`) are in that set — any lint finding in any of them
  is a new, uncounted regression against the gate. This report did not run `pnpm lint` (out of
  scope, no build) — this is a flag to check, not a measured result.
- **Audit trail — a mitigating factor, not a break**: both `quickUpdateBooking`'s audit insert
  (`before_state: beforeState`, from a `select("*")`) and `restoreBooking`'s
  (`before_state: bookingBeforeState`, destructured from `select("*, clients(deleted_at)")` with
  only `clients` removed) already capture the pre-transition `travel_fee` value for free, because
  both selects are wildcards and `travel_fee` is a live column. So even though Path C/D let a
  fee-blind confirm happen today, the audit log already has enough to reconstruct after the fact
  that it happened — "this booking was confirmed while `travel_fee = 0` and
  `service_city = <out-of-zone town>`" is answerable from `audit_logs` today, without any schema or
  insert change.

---

## 6. Fail-safe direction for the town list — verified correct

`isInFreeTravelArea` (`src/lib/booking/travel-fee.ts:42-58`), full function:

```
42	export function isInFreeTravelArea(
43	  city: string | null | undefined,
44	  freeTravelCities: string[]
45	): boolean {
46	  if (freeTravelCities.length === 0) return true;
47	
48	  const normalised = String(city ?? "").trim().toLowerCase();
49	  if (normalised === "") return true;
50	
51	  return freeTravelCities.some((town) => {
52	    const candidate = town.trim().toLowerCase();
53	    return (
54	      candidate !== "" &&
55	      (normalised === candidate || normalised.includes(candidate))
56	    );
57	  });
58	}
```

An **empty or undefined town list resolves to `true` (inside)**, not `false` (outside) — line 46 is
the explicit early return. The function's own doc comment (lines 35-40) names the exact failure
mode this guards against: *"Treating it as 'outside' would hide the quick-confirm chip on every
booking in the system on a transient fetch failure, so an unknown answer resolves to 'inside' and
leaves existing behaviour alone."* `BookingManagementFormProps.freeTravelCities` defaults to `[]`
when the prop is omitted (`BookingManagementForm.tsx:60`, `freeTravelCities = []`), which resolves
through the same fail-open path. This is the **correct** direction — the failure mode the task
asked me to check for (every booking reading as out-of-zone, hiding the confirm chip everywhere)
does **not** occur; the actual fail-safe is the opposite and correct one, confirmed by the dedicated
regression test named in §5 (`"leaves the quick-confirm chip alone when the free-travel list is
unavailable"`).

The one caveat: this fail-safe is only load-bearing where `freeTravelCities` is actually threaded
in (Path A). Path D and Path C's UI surfaces don't call `isInFreeTravelArea` at all yet, so the
question "what happens if the list is empty" doesn't yet arise there — once §3's fix threads the
list into those surfaces, they inherit this same, already-correct, already-tested fail-open
behaviour for free, provided they reuse `isInFreeTravelArea` rather than reimplementing the
comparison.

---

## Summary table

| # | Path to `confirmed` | File(s) | Gated? | Fix needed |
|---|---|---|---|---|
| A | `QUICK_ACTIONS` Confirm chip (detail page) | `BookingManagementForm.tsx` 826-836/733-738 | **Yes** — client-side hide + alert (838-856) | none |
| B | Status & Payment form | `BookingManagementForm.tsx` / `actions.ts` 289-651 | **Yes** — field + server-side completed/fully-paid lock | none |
| C1 | "Restore booking" button, detail page | `[bookingId]/page.tsx` 1310-1367, `NextActionButton.tsx` | **No** | reroute to `target_status: "pending"` when `needsTravelFeeBeforeConfirm` |
| C2 | "Restore booking" row-menu item, list page | `BookingRowActions.tsx` 480-509 | **No** | same fix, needs `travel_fee`/`service_city`/`freeTravelCities` threaded first |
| D | "Confirm" button, list page | `BookingRowActions.tsx` 341-342/417-431 | **No** | thread `travel_fee`/`service_city`/`freeTravelCities`, mirror Path A's filter predicate |

Undo toasts (both files) were checked and are **not** a bypass — they restore to the booking's own
pre-cancel status, never hardcoding `confirmed`.
