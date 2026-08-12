# Q2-form — BookingManagementForm.tsx derivation (item 8 Phase 3, application code)

Read-only derivation. Target: `src/app/admin/bookings/BookingManagementForm.tsx` (1494 lines, unmodified —
confirmed via `git status --porcelain -- src/` showing no `M` against this path).

Files read in full: `BookingManagementForm.tsx`, `BookingManagementForm.test.tsx`, `src/lib/booking/travel-fee.ts`.
Files read in part: `src/app/admin/bookings/types.ts` (85-162), `src/app/admin/bookings/[bookingId]/page.tsx`
(1-554), `src/app/admin/bookings/[bookingId]/booking-detail-data.ts` (grep + targeted lines), `src/app/admin/bookings/actions.ts`
(1-520, re-read twice — see §0), `src/lib/booking/free-travel-cities.ts`, `src/app/admin/bookings/new/page.tsx` (55-99),
`src/app/admin/bookings/new/ManualBookingForm.tsx` (530-599), `src/features/booking/components/AboutYouStep.tsx` (115-140),
`eslint.config.mjs`, `redesign/HANDOFF-2026-08-11-IMPLEMENTATION-2.md` (1-80).

Repo-wide greps run: `travel_fee`, `free.travel|FREE_TRAVEL|isOutsideFreeTravel|freeTravelAreas|mileage_origin|travel_fee`,
`service_city|BookingRecord`, `BookingManagementForm`, `getFreeTravelCities|free_travel_cities|isOutsideFreeTravel|FreeTravel`,
`59 error|59E|six.file|lint baseline`, `eslint-disable|any\b` (scoped to the target file).

---

## §0 — Finding that overrides part of the task's STATE section: `actions.ts` is being edited concurrently, right now

The task brief states as verified fact: *"NO application code reads or writes it yet [`travel_fee`] — that is what
this derivation is for."* This is **no longer true as of this session** — confirmed by re-reading, not assumed.

`git status --porcelain -- src/` returns:
```
 M src/app/admin/bookings/actions.ts
 M src/lib/maintenance.ts
?? src/lib/booking/__tests__/travel-fee.test.ts
?? src/lib/booking/travel-fee.ts
```
(`M src/lib/maintenance.ts` is the pre-existing baseline dirty path documented in
`redesign/HANDOFF-2026-08-11-IMPLEMENTATION-2.md` line 40 — not new.)

Direct evidence of a live edit mid-session: my first full read of `actions.ts` (top of this session) showed the
import block ending `...canAssignBookings, getStaffProfile } from "@/lib/auth/rbac";` at line 19 with no
travel-fee imports, and `updateBookingManagement`'s body going straight from the field-error block to
`beforeState` fetch to the completed-reversal guard, with **no travel-fee code anywhere** and a bare
`const payload = { status, ... }` (no spread). A second read minutes later, of the same file, shows:

```
20	  applyTravelFeeDelta,
21	  parseTravelFee,
22	  toPence,
```
as new imports (from `@/lib/booking/travel-fee`, the now-untracked file), plus a full new block —

```
360	  // ── Item 8 Phase 3 — the travel charge ────────────────────────────────────
...
366	  const previousTravelFee = Number(beforeState.travel_fee ?? 0);
367	  const travelFeeChanged =
368	    travelFeeInput !== null &&
369	    toPence(travelFeeInput) !== toPence(previousTravelFee);
370	
371	  if (travelFeeChanged) {
372	    const previousAmountDue = Number(beforeState.amount_due ?? 0);
373	    const previousAmountPaid = Number(beforeState.amount_paid ?? 0);
374	    const wasFullyPaid =
375	      previousAmountDue > 0 && previousAmountPaid >= previousAmountDue;
376	
377	    if (beforeState.status === "completed") {
378	      return {
379	        fieldErrors: {
380	          travel_fee:
381	            "This booking is completed — the travel charge can no longer be changed.",
382	        },
383	      };
384	    }
385	    if (wasFullyPaid) {
386	      return {
387	        fieldErrors: {
388	          travel_fee:
389	            "This booking is fully paid — the travel charge can no longer be changed.",
390	        },
391	      };
392	    }
393	  }
394	
395	  // The fee is folded INTO the stored totals as a delta, never summed by a
396	  // reader and never re-derived from service price x participants. See
397	  // src/lib/booking/travel-fee.ts for why this is integer pence.
398	  const travelFeeUpdate =
399	    travelFeeChanged && travelFeeInput !== null
400	      ? (() => {
401	          const folded = applyTravelFeeDelta({
402	            totalPrice: beforeState.total_price,
403	            amountDue: beforeState.amount_due,
404	            previousTravelFee,
405	            nextTravelFee: travelFeeInput,
406	          });
407	          return {
408	            travel_fee: travelFeeInput,
409	            total_price: folded.totalPrice,
410	            amount_due: folded.amountDue,
411	          };
412	        })()
413	      : {};
```
and the payload builder now opens `const payload = { ...travelFeeUpdate, status, ... }` (line 489-490).

**Read this as a live signal, not a contradiction to fix**: another process is implementing item 8 Phase 3's
server half (`updateBookingManagement`) in parallel with this read-only derivation, and it is landing exactly the
design the task brief describes — pence-delta folding via `applyTravelFeeDelta`, lock evaluated against
`beforeState` (before this submit) so setting the fee and marking paid in the same save still works, `completed`
and "fully paid" locked, `cancelled` not locked. `src/lib/booking/travel-fee.ts` (new, untracked, read in full)
confirms the arithmetic: `toPence`/`fromPence` round-trip via `Math.round(value * 100)`, `parseTravelFee` accepts
only `/^\d+(\.\d{1,2})?$/` text (empty string → `0`, anything else unparseable → `null`), and
`applyTravelFeeDelta` computes `deltaPence = toPence(next) - toPence(previous)` then adds it to both stored totals
— matching the worked example in the task brief exactly (45×2=90, +14 fee = 104).

**Consequence for the form work this report is about:**
- The new input's form field name is fixed by the already-landed server code: `name="travel_fee"`, string value,
  accepted pattern `^\d+(\.\d{1,2})?$` (so `type="number" step="0.01" min="0"`, same as `AmountPaidInput`, is
  exactly compatible — no negatives, no exponent notation, ≤2dp).
- Absence vs. empty string matters server-side (`travelFeeSubmitted = formData.get("travel_fee") !== null`) — the
  Status & payment form's visible field must always post a real value (never omit the field), same as
  `amount_paid` today. The Notes forms (`HiddenStatusPayload`, `BookingNotesScopedForm`) currently post no
  `travel_fee` key at all, which is what makes them safe no-ops server-side without further changes — **do not**
  add a `travel_fee` hidden input to either notes payload unless the intent is to let notes-only saves touch it.
- `fieldErrors.travel_fee` is the key the server already returns for all three rejection cases (bad amount,
  completed, fully paid) — a new `<Field id={travelFeeId} error={form.state.fieldErrors?.travel_fee}>` wrapper
  (the same idiom `amountPaidId`'s `Field` uses) is what renders it; no new field-error key needs inventing.
- `BookingRecord` (`src/app/admin/bookings/types.ts`) still has **no** `travel_fee` property as of this read
  (grepped fresh, zero matches) even though the column and the server write exist. Any new UI code reading
  `booking.travel_fee` will not typecheck until this type gains it — this is a real prerequisite, just outside
  this file.

This file (`BookingManagementForm.tsx`) itself was not touched by the concurrent process — confirmed by its
unchanged line count (1494, same as first and last read) and its absence from `git status --porcelain -- src/`.

---

## §1 — `AmountPaidInput`, byte-exact (Q1)

**Claimed 443-515 — CONFIRMED, no drift.** The function opens at line 443 (`function AmountPaidInput({`) and its
closing brace is line 515, matching the claim exactly.

```
443	function AmountPaidInput({
444	  id,
445	  value,
446	  disabled,
447	  hasError,
448	  onChange,
449	  total,
450	}: {
451	  id: string;
452	  value: string;
453	  disabled: boolean;
454	  hasError: boolean;
455	  onChange: (value: string) => void;
456	  total: number;
457	}) {
458	  return (
459	    <div className="grid gap-1.5">
460	      <div className="relative">
461	        <span
462	          aria-hidden="true"
463	          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-[var(--admin-text-muted)]"
464	        >
465	          £
466	        </span>
467	        <input
468	          id={id}
469	          name="amount_paid"
470	          type="number"
471	          min="0"
472	          step="0.01"
473	          inputMode="decimal"
474	          placeholder="0.00"
475	          value={value}
476	          onChange={(e) => onChange(e.target.value)}
477	          disabled={disabled}
478	          aria-invalid={hasError ? "true" : undefined}
479	          className={inputClass(hasError, "pl-7")}
480	        />
481	      </div>
482	      {total > 0 && Number.isFinite(Number(value)) && Number(value) > total ? (
483	        <p
484	          role="status"
485	          aria-live="polite"
486	          className="rounded-[var(--admin-radius-control)] bg-[oklch(96.0%_0.038_75)] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-[oklch(28%_0.120_55)]"
487	        >
488	          Amount is more than the booking total. Mark as partially paid first, or check the figure.
489	        </p>
490	      ) : null}
491	      {total > 0 ? (
492	        <div className="flex flex-wrap gap-1.5">
493	          <button
494	            type="button"
495	            onClick={() => onChange(total.toFixed(2))}
496	            disabled={disabled || Number(value) === total}
497	            className="inline-flex h-11 sm:h-7 items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 sm:px-2 text-xs sm:text-[0.6875rem] font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-50"
498	          >
499	            Match total · £{total.toFixed(2)}
500	          </button>
501	          {Number(value) !== 0 ? (
502	            <button
503	              type="button"
504	              onClick={() => onChange("0")}
505	              disabled={disabled}
506	              className="inline-flex h-11 sm:h-7 items-center gap-1 rounded-[var(--admin-radius-control)] px-3 sm:px-2 text-xs sm:text-[0.6875rem] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-50"
507	            >
508	              Clear
509	            </button>
510	          ) : null}
511	        </div>
512	      ) : null}
513	    </div>
514	  );
515	}
```

**The idiom to mirror, precisely:**
- Wrapping `<div className="grid gap-1.5">`, a `<div className="relative">` holding an `aria-hidden` `£` prefix
  span absolutely positioned `left-3`, and the `<input>` itself with `className={inputClass(hasError, "pl-7")}`
  — the `pl-7` extra is what clears the prefix glyph. `id`/`name` are separate props: `id` is caller-supplied
  (for label pairing), `name` is hardcoded to the field's wire name (`"amount_paid"` here → would be
  `"travel_fee"` for a sibling).
- `type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"` — this exact attribute set is what
  makes the mobile numeric keypad show a decimal point and is also what already matches `parseTravelFee`'s
  accepted grammar (§0).
- The over-total warning (line 482-490) is a **controlled, standalone condition** — `total > 0 && Number.isFinite(Number(value)) && Number(value) > total` — rendered as `role="status" aria-live="polite"` with the shared warm-amber
  “oklch” warning-chip classes used identically at lines 486, 859 (payment-status "paid with zero" notice) and
  843 (out-of-total-range paid). A travel-fee sibling would need its own semantics here (there is no natural
  "over total" ceiling for a fee), so this block is likely **not** reused as-is — only the visual/aria pattern
  is.
- The **"total > 0" quick-fill preview idiom, claimed at :491 — CONFIRMED, line 491 is exactly `{total > 0 ? (`.**
  It renders two `type="button"` chips only when `total > 0`: "Match total · £{total.toFixed(2)}" (disabled when
  already matching) and a conditional "Clear" chip (only shown when the current value isn't already `0`, line
  501: `{Number(value) !== 0 ? (`). Height is `h-11 sm:h-7` (44px mobile touch target, denser on sm+, same
  pattern as the rest of the file). For a travel-fee sibling, the natural analogue is NOT "match total" but
  something like "Match free-travel default" or simply omitting the quick-fill row entirely (there is no
  obvious single expected value for a travel fee the way there is for amount-paid-equals-total) — this is a
  design decision the caller has to make, not something this file's existing code answers.
- No local `useState` inside `AmountPaidInput` itself — it is fully controlled (`value`/`onChange` from the
  parent's `useStatusForm`/`StatusAndPaymentSection`), consistent with how a travel-fee sibling should be wired
  through `useStatusForm` too (see §2/§8 on where new state would live).

---

## §2 — `StatusAndPaymentSection`, signature/props and insertion region (Q2)

**Claimed 689-938 — CONFIRMED, no drift.** Opens at line 689 (`function StatusAndPaymentSection({ booking }: { booking: BookingRecord }) {`), closes at line 938 (`}`), immediately followed by two blank lines then the Notes-section
plumbing at 941.

**Signature and props — the entire prop surface is one object:**
```
689	function StatusAndPaymentSection({ booking }: { booking: BookingRecord }) {
```
No other props. Everything else (`form`, `formRef`, `statusId`, etc.) is local state/derived values inside the
component body (690-726).

**Where a travel-fee `Field` would sit** — mirroring the `amountPaidId` `Field` exactly, byte-exact context
(883-900, the last `Field` in the 2-col grid, immediately before the grid's closing `</div>`):
```
883	          <Field
884	            id={amountPaidId}
885	            label="Amount paid"
886	            error={form.state.fieldErrors?.amount_paid}
887	          >
888	            <AmountPaidInput
889	              id={amountPaidId}
890	              value={form.amountPaid}
891	              disabled={form.isPending}
892	              hasError={Boolean(form.state.fieldErrors?.amount_paid)}
893	              onChange={(v) => {
894	                form.setAmountPaid(v);
895	                form.recomputeDirty({ amount_paid: v });
896	              }}
897	              total={total}
898	            />
899	          </Field>
900	        </div>
```
A new `travelFeeId = useId();` (added beside the four existing `useId()` calls at 692-695) plus a fifth `Field`
block copy-pasted from 883-899 (swapping `amountPaidId`→`travelFeeId`, `"Amount paid"`→something like
`"Travel charge"`, `amount_paid`→`travel_fee`, and `AmountPaidInput`→the new sibling component) would insert
cleanly right after line 899 and before line 900's `</div>` — same grid, same `xl:grid-cols-2` responsive
behaviour already governing the other four fields (comment at 802-806 explains the breakpoint choice).

**Where an outside-zone alert would sit** — two defensible byte-exact anchor points, both already-idiomatic:
1. **Beside the payment-status "paid with zero" notice**, i.e. inside the `Field` at 834-864, using the exact
   same `role="status" aria-live="polite"` amber-chip pattern already at 855-863:
   ```
   855	            {paidWithZero ? (
   856	              <p
   857	                role="status"
   858	                aria-live="polite"
   859	                className="rounded-[var(--admin-radius-control)] bg-[oklch(96.0%_0.038_75)] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-[oklch(28%_0.120_55)]"
   860	              >
   861	                Set the amount paid before marking this as paid.
   862	              </p>
   863	            ) : null}
   ```
   A sibling `{isOutsideFreeTravel ? (...) : null}` could be added inside the new travel-fee `Field` in exactly
   this shape.
2. **As a form-level notice**, mirroring `FormError` (1481-1493) or the `form.state.error` render site at line
   800 (`{form.state.error ? <FormError message={form.state.error} /> : null}`, right after
   `<HiddenNotesPayload booking={booking} />` at 799) — appropriate if the alert should be visible regardless of
   which field is focused, rather than scoped to the travel-fee input specifically.

Anchor (1) is the closer analogue to what already exists in this exact file for "field needs attention because
of a business condition"; anchor (2) is closer to "this booking is unusual, look here first."

---

## §3 — `total` variable (Q3)

**Claimed `:696, const total = Number(booking.total_price ?? 0)` — CONFIRMED, byte-exact, no drift.**
```
696	  const total = Number(booking.total_price ?? 0);
```
Sits directly after `amountPaidId` (695) and before the `paymentStatusValue` state hook (697). Note this reads
`booking.total_price` directly (not `amount_due`), unlike `computeOutstanding` in the parent page
(`[bookingId]/page.tsx:1458`, `Number(booking.total_price ?? booking.amount_due ?? 0)`) — this file has no
`amount_due` fallback anywhere. Relevant if a travel-fee sibling ever needs a "total" reference: it would read
the same `total` binding already in scope, not a new computation.

---

## §4 — `QUICK_ACTIONS` array and its consumption site (Q4)

**Claimed "opens :336 and runs to :372 across 4 actions" — CONFIRMED, byte-exact, no drift.** Opens at 336
(`const QUICK_ACTIONS: QuickActionDescriptor[] = [`), closes at 372 (`];`), 4 entries.

```
323	interface QuickActionDescriptor {
324	  action: "confirm" | "mark_paid" | "complete" | "cancel";
325	  pendingLabel: string;
326	  doneLabel: string;
327	  isDone: (booking: BookingRecord) => boolean;
328	  isDestructive?: boolean;
329	}
330	
331	// `completed`, `cancelled` and `no_show` are terminal for the one-click chips
332	// (see `quickUpdateBooking`): leaving any of them needs a reason, or a restore,
333	// that the chip cannot capture, so the affordance disappears rather than
334	// offering a call the server will refuse. All three status chips carry that
335	// same shape; `mark_paid` keys on payment status and is unaffected.
336	const QUICK_ACTIONS: QuickActionDescriptor[] = [
337	  {
338	    action: "confirm",
339	    pendingLabel: "Confirm booking",
340	    doneLabel: "Confirmed",
341	    isDone: (b) =>
342	      b.status === "confirmed" ||
343	      b.status === "completed" ||
344	      b.status === "cancelled" ||
345	      b.status === "no_show",
346	  },
347	  {
348	    action: "mark_paid",
349	    pendingLabel: "Mark paid",
350	    doneLabel: "Marked paid",
351	    isDone: (b) => b.payment_status === "paid",
352	  },
353	  {
354	    action: "complete",
355	    pendingLabel: "Mark complete",
356	    doneLabel: "Completed",
357	    isDone: (b) =>
358	      b.status === "completed" ||
359	      b.status === "cancelled" ||
360	      b.status === "no_show",
361	  },
362	  {
363	    action: "cancel",
364	    pendingLabel: "Cancel booking",
365	    doneLabel: "Cancelled",
366	    isDone: (b) =>
367	      b.status === "cancelled" ||
368	      b.status === "completed" ||
369	      b.status === "no_show",
370	    isDestructive: true,
371	  },
372	];
```

**Consumption site — claimed `:784` — CONFIRMED, byte-exact, no drift** (`{QUICK_ACTIONS.map((descriptor) => (` is exactly line 784):
```
782	      {/* Mobile: 2-col grid for thumb-symmetric tap targets. sm+: free-flow flex-wrap. */}
783	      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
784	        {QUICK_ACTIONS.map((descriptor) => (
785	          <StateAwareQuickActionButton
786	            key={descriptor.action}
787	            booking={booking}
788	            descriptor={descriptor}
789	          />
790	        ))}
791	      </div>
```

**How chips are rendered/filtered today, and how to add the gating cleanly:** `QUICK_ACTIONS` is an unconditional
static array — `.map` renders one `StateAwareQuickActionButton` per entry, always, for every booking. The
show/hide-as-"done" behaviour lives entirely **inside** `StateAwareQuickActionButton` (374-412, quoted in full
below), via each descriptor's own `isDone(booking)`: when true it renders a static "done" pill (384-400,
non-interactive, no button role); when false it renders the live `BookingActionButton`. Critically, **`isDone`
never removes the chip from the DOM — it only swaps its visual state.** The task's requirement is to *hide* the
confirm chip outright (not show it as a muted "done" pill), which is a different mechanism than anything
`isDone` currently drives.

```
374	function StateAwareQuickActionButton({
375	  booking,
376	  descriptor,
377	}: {
378	  booking: BookingRecord;
379	  descriptor: QuickActionDescriptor;
380	}) {
381	  const done = descriptor.isDone(booking);
382	  if (done) {
383	    return (
384	      <span className="inline-flex h-11 sm:h-8 w-full sm:w-auto items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 text-xs font-semibold text-[var(--admin-text-muted)]">
385	        <svg
386	          width="12"
387	          height="12"
388	          viewBox="0 0 24 24"
389	          fill="none"
390	          stroke="currentColor"
391	          strokeWidth="2.5"
392	          strokeLinecap="round"
393	          strokeLinejoin="round"
394	          aria-hidden="true"
395	        >
396	          <path d="M20 6 9 17l-5-5" />
397	        </svg>
398	        {descriptor.doneLabel}
399	      </span>
400	    );
401	  }
402	  return (
403	    <BookingActionButton
404	      bookingId={booking.id}
405	      action={descriptor.action}
406	      variant="ghost"
407	      size="touch"
408	    >
409	      {descriptor.pendingLabel}
410	    </BookingActionButton>
411	  );
412	}
```

**The clean insertion point is a `.filter(...)` immediately before `.map(...)` at line 784**, inside
`StatusAndPaymentSection` where `booking` (and a new `isOutsideFreeTravel` derived value, or the free-travel
prop needed to compute it — see §5) are already in scope:

```jsx
{QUICK_ACTIONS.filter(
  (descriptor) =>
    !(
      descriptor.action === "confirm" &&
      isOutsideFreeTravel &&
      Number(booking.travel_fee ?? 0) === 0
    )
).map((descriptor) => (
```

This keeps `QUICK_ACTIONS` itself a static, order-stable data table (no per-render construction, matches the
file's existing style of hoisting static config to module scope) and keeps the hiding rule local to the one
render site that has both `booking` and the free-travel context, rather than threading a `booking`-shaped
"visible" predicate into the `QuickActionDescriptor` interface (which would also require every `isDone` callback
to start taking a second argument — a much larger, non-surgical change for a single-action special case).

---

## §5 — Where props come from; parent trace; town-list vs. boolean recommendation (Q5)

**This component's entire prop surface, both levels:**
```
34	interface BookingManagementFormProps {
35	  booking: BookingRecord;
36	}
```
```
54	export function BookingManagementForm({ booking }: BookingManagementFormProps) {
55	  return (
56	    <div className="grid gap-6">
57	      <StatusAndPaymentSection booking={booking} />
58	      <NotesSection booking={booking} />
59	    </div>
60	  );
61	}
```
`StatusAndPaymentSection` (§2, line 689) takes the identical single `{ booking: BookingRecord }` prop. There is
no other prop anywhere in this file's exported/consumed surface for either component — no free-travel data, no
settings, nothing threaded today.

**Trace to the parent page** — `src/app/admin/bookings/[bookingId]/page.tsx:507`:
```
507	          {fullScope ? <BookingManagementForm booking={bookingWithTimeline} /> : null}
```
`bookingWithTimeline` is built at line 362: `{ ...booking, audit_logs: auditLogs }`, where `booking` comes from
`getBookingDetailData({ bookingId, profile, fullScope: canManageAllBookings(profile) })` (line 232-236), a call
into `./booking-detail-data.ts`. That function's return type names the booking field as
`BookingRecordWithClientId | null` — `type BookingRecordWithClientId = BookingRecord & { client_id: string | null }`
(booking-detail-data.ts:143-144) — so `BookingManagementForm`'s declared `booking: BookingRecord` prop already
silently widens to accept the superset object; no type friction there.

**Recommendation: thread the free-travel *town list* (`string[]`), not a precomputed boolean.**

Reasons, in order of weight:
1. **This exact pattern already exists one directory over**, for the same admin-bookings surface, for the same
   purpose. `src/app/admin/bookings/new/page.tsx:73-84` fetches `free_travel_cities` server-side and passes it
   down as `allowedCities?: string[]` into `ManualBookingForm` (`ManualBookingForm.tsx:547-551`, doc-commented
   "for the inline (non-blocking) city warning"). A `freeTravelCities?: string[]` prop on `BookingManagementForm`
   (threaded to `StatusAndPaymentSection`) is the same shape, same naming family, same surface.
2. **The component already receives `booking.service_city`** (it's on `BookingRecord`, see §6) but never reads
   it — so passing only a boolean would mean computing the comparison *outside* this file, in the page, using
   logic that then has to be kept in sync with wherever else "is this city covered" is decided. Passing the raw
   list keeps the single comparison in one place (this file), which matters directly for item 8's own history:
   the defect this whole item is unwinding was **exactly** this list being duplicated and drifting between three
   call sites. Adding a fourth, boolean-shaped copy of the same decision reintroduces that risk in miniature.
3. **The comparison idiom to reuse already exists**, in `src/features/booking/components/AboutYouStep.tsx:129-142`
   (public booking form, same free-travel concept):
   ```
   129	  const normalizedCity = city.trim().toLowerCase();
   130	  const hasCityValue = normalizedCity.length > 1;
   131	  const isCovered =
   132	    hasCityValue &&
   133	    freeTravelCities.some((town) => {
   134	      const allowed = town.trim().toLowerCase();
   135	      return (
   136	        allowed !== "" &&
   137	        (normalizedCity === allowed || normalizedCity.includes(allowed))
   138	      );
   139	    });
   140	  // Informational only. Nothing downstream blocks on this — an address outside
   141	  // the free-travel areas is bookable (item 8 Phase 2).
   142	  const isOutsideCoverage = hasCityValue && !isCovered;
   ```
   A `computeIsOutsideFreeTravel(city, freeTravelCities)` (or an inlined equivalent) inside
   `StatusAndPaymentSection` mirroring this exact trim/lowercase/substring-match idiom is the byte-for-byte-in-spirit
   way to keep the three "is this covered" call sites (public `AboutYouStep`, admin `ManualBookingForm`'s inline
   warning, and this file) computing the identical thing without a shared helper module needing to be created
   for it — though extracting one (e.g. into `src/lib/booking/free-travel-cities.ts`, which already owns
   `getFreeTravelCities()`) would be the cleaner fix if this task's scope allowed touching that file too.
4. Fetching the list is one call: `getFreeTravelCities()` (`src/lib/booking/free-travel-cities.ts:36`) is a
   ready-made, cached (60s, `TAGS.SETTINGS`-tagged), server-only async function returning exactly `string[]`,
   already invalidated on save by `admin/settings/actions.ts`. It can be added to
   `[bookingId]/page.tsx` as one more `await` alongside the existing `getBookingDetailData` call and threaded
   into the `<BookingManagementForm booking={...} freeTravelCities={...} />` call at line 507 — no new fetch
   plumbing needs inventing.

A precomputed boolean would be marginally simpler at the call site but pushes the "what counts as outside
free-travel" decision out of this file and away from the one place that also decides whether to hide the confirm
chip and show the alert — worse locality for a decision this task's brief frames as needing to stay coherent with
the fee-lock and chip-hiding logic that also lives here.

---

## §6 — Does the component already know the booking address? (Q6)

**Yes, structurally — no, in practice.** The `booking: BookingRecord` prop (both levels, §5) already carries the
full address, because `BookingRecord` (types.ts:92-162) includes:
```
112	  service_address_line1: string | null;
113	  service_address_line2: string | null;
114	  service_city: string | null;
115	  service_postcode: string | null;
116	  access_notes: string | null;
```
But `BookingManagementForm.tsx` **never reads any of these fields** — a repo-scoped grep for
`service_city|service_address|service_postcode` inside this file returns zero matches. The address is present on
every `booking` object this component is handed; nothing in the component currently looks at it. A new
`isOutsideFreeTravel` computation would be the first place in this file to touch `booking.service_city`.

---

## §7 — Existing test file, harness, and every test title (Q7)

Yes — `src/app/admin/bookings/BookingManagementForm.test.tsx` exists (367 lines), read in full.

**Harness — mocks (top of file, byte-exact):**
```
14	vi.mock("./actions", () => ({
15	  updateBookingManagement: vi.fn(),
16	  quickUpdateBooking: vi.fn(),
17	  updateOwnAssignmentStatus: vi.fn(),
18	}));
19	
20	vi.mock("next/navigation", () => ({
21	  useRouter: () => ({ refresh: vi.fn() }),
22	}));
23	
24	vi.mock("sonner", () => ({
25	  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
26	}));
```
`updateBookingManagement` is mocked wholesale — tests set its resolved value per-case
(`vi.mocked(updateBookingManagement).mockResolvedValue({ success: true })` in each `beforeEach`) and assert on
what it was *called with* (via the `lastPayload()` helper below), never against real server logic. This means
tests here **cannot exercise the actual `travel_fee` server contract** (§0) — they only assert on what FormData
the client-side form constructs and submits, and on what the client renders given a mocked server response. Gating
tests for the confirm chip and any new "fee changed while completed/paid" client-side pre-emption would follow
this same shape.

**Fixture — the full `BOOKING` object (28-74), byte-exact:**
```
28	const BOOKING: BookingRecord = {
29	  id: "booking-1",
30	  booking_date: "2026-07-20",
31	  start_time: "14:00:00",
32	  end_time: "15:00:00",
33	  total_duration_mins: 60,
34	  total_price: 55,
35	  contact_full_name: "Aisha Khan",
36	  contact_email: "aisha@example.test",
37	  contact_phone: "07123456789",
38	  booking_source: "phone",
39	  amount_due: 55,
40	  amount_paid: 0,
41	  paid_at: null,
42	  payment_note: null,
43	  status: "completed",
44	  payment_status: "unpaid",
45	  payment_method: null,
46	  assignment_status: "fully_assigned",
47	  group_booking: false,
48	  service_address_line1: "10 Test Street",
49	  service_address_line2: null,
50	  service_city: "Luton",
51	  service_postcode: "LU1 1AA",
52	  access_notes: null,
53	  consent_acknowledged: true,
54	  customer_notes: null,
55	  health_notes: null,
56	  customer_manage_notes: null,
57	  cancelled_at: null,
58	  customer_cancelled_at: null,
59	  customer_cancellation_note: null,
60	  last_customer_manage_action_at: null,
61	  reschedule_requested_at: null,
62	  reschedule_preferred_date: null,
63	  reschedule_preferred_time: null,
64	  reschedule_note: null,
65	  reschedule_status: "none",
66	  admin_notes: null,
67	  treatment_notes: null,
68	  created_at: "2026-07-01T09:00:00.000Z",
69	  recurring_template_id: null,
70	  clients: null,
71	  booking_participants: [],
72	  booking_items: [],
73	  booking_assignments: [],
74	};
```
Notes for anyone adding chip-gating tests here: `status: "completed"` and `service_city: "Luton"` (a free-travel
town in every fixture seen repo-wide) are the *default* fixture — most existing tests override `status` via
spread (`{ ...BOOKING, status: "confirmed" }` etc., e.g. line 155, 239, 248, 257, 266). A new
out-of-zone/fee test would need `{ ...BOOKING, service_city: "Some Other Town", status: "pending" }` (to get the
live Confirm chip in scope at all — recall §4's `isDone` already suppresses Confirm once `status` leaves
`pending`) plus, once it exists, a `travel_fee: 0` override (the field doesn't exist on `BookingRecord`/the
fixture yet — §0). Also note **the fixture has no `travel_fee` key today**, consistent with `BookingRecord`
lacking it.

**Helper (76-80):**
```
76	/** The FormData the action was last called with, flattened for assertions. */
77	function lastPayload() {
78	  const call = vi.mocked(updateBookingManagement).mock.calls.at(-1);
79	  return Object.fromEntries((call![1] as FormData).entries());
80	}
```

**Every test title, in file order, grouped by `describe`:**

`describe("BookingManagementForm — reopen-completed confirm modal", ...)` (93-222):
1. `"intercepts a completed → confirmed save with the confirm modal"`
2. `"submits the force flag and the typed reason on confirm"`
3. `"saves a completed → completed edit without the modal"`
4. `"saves a non-completed booking's status change without the modal"`
5. `"refuses the confirm when no reason has been given"`
6. `"refuses the confirm when the reason is shorter than the minimum"`
7. `"submits the trimmed reason once it meets the minimum"`
8. `"renders the server's completed_reversal_reason rejection"`

`describe("BookingManagementForm — quick actions on terminal statuses", ...)` (227-270) — the block whose
neighbourhood a new chip-hiding test would join:
9. `"offers no live Cancel chip on a completed booking"`
10. `"offers no live Mark complete chip on a cancelled booking"`
11. `"offers no live status chip on a no-show booking"`
12. `"keeps both chips live on a confirmed booking"`
13. `"keeps the Confirm chip live on a pending booking"` (13's own comment, line 263-264, calls this "the
    over-blocking canary for the Confirm chip" — the counterpart canary a new free-travel gating test would need
    is "keeps the Confirm chip live on a pending booking inside the free-travel zone", to prove the new
    condition doesn't over-fire on ordinary in-zone bookings)

`describe("BookingManagementForm — the cancellation toast's Undo", ...)` (289-366):
14. `"offers no Undo once the appointment moment has passed"`
15. `"offers the Undo on a future-dated booking"`
16. `"closes the Undo before the server's delay elapses"`
17. `"never names a number of seconds"`
18. `"says nothing about an Undo on an ordinary save"`

18 tests total, all in this one file (matches the "3 failed / 33 passed (36)" note in the handoff for the sibling
`ManualBookingForm.test.tsx` file, not this one — this file's own pass/fail baseline was not part of the 5
named failures in `redesign/HANDOFF-2026-08-11-IMPLEMENTATION-2.md:44-45`, so it is presumed fully green today,
though this derivation did not run `vitest` — read-only scope forbids it).

---

## §8 — Lint-sensitive details (Q8)

**This file is confirmed NOT one of the six baseline files.** From
`redesign/HANDOFF-2026-08-11-IMPLEMENTATION-2.md:39,53`: `pnpm lint` currently reports **59 errors / 7 warnings,
the same six files** — `area-page.jsx` (48E/1W), `shared.jsx` (2E/5W), `site-chrome.jsx` (5E/0W),
`BookingExperience.tsx` (3E), `BookingExperienceLoader.tsx` (1E), `returning-customer.ts` (0E/1W). `lint identity
is the {file, ruleId} multiset with counts, never file:line:column`. `BookingManagementForm.tsx` appears in none
of these six — any lint finding here is a new, 7th file, and changes the gate's file count, not just its total.

**Config in force:** `eslint.config.mjs` spreads `eslint-config-next/core-web-vitals` and
`eslint-config-next/typescript` with no per-file overrides or additional plugins; `redesign/**` is ignored but
`src/app/admin/bookings/**` is not. `@typescript-eslint/no-unused-vars` is set to `'warn'` in
`eslint-config-next/typescript` (verified in `redesign/evidence/post-band-c-impl/item-8/phase2-app/P4-availability-and-manual.md:58`,
itself checked against `node_modules/eslint-config-next/dist/typescript.js` in that session) — a *warning*, not
an error, but still a new count in the multiset.

**File-specific risk surface for a travel-fee addition, from what is already established in this file's style:**
- **No `eslint-disable` comments anywhere in this file** (grepped, zero hits) and **no `any` type usage**
  (grepped for `any\b`, the only two hits are prose in comments — "any status", "any of them" — not code). A new
  component that needs an escape hatch (disable comment, `any`) would be the first in this file and should be
  treated as a signal to find a typed alternative instead, matching the file's existing 100%-typed style.
- **Every helper component's props are inline-typed or via a named `interface`** (e.g. `AmountPaidInput`'s
  inline object type at 450-457, `QuickActionDescriptor` at 323-329) — a new `TravelFeeInput` sibling should
  follow the same inline-prop-object convention `AmountPaidInput` uses, not introduce a new named-interface
  pattern be inconsistent with its neighbour.
- **`useId()` pairing**: every labelled control in this file pairs a `useId()`-sourced id between a `<label htmlFor={id}>` (via the shared `Field` component, 1398-1440) and the control's own `id={id}` prop
  (e.g. `amountPaidId` used at both 884 and 889). `eslint-config-next`'s `jsx-a11y` rules (bundled in
  `core-web-vitals`) include `label-has-associated-control`; a new travel-fee field must follow this exact
  `useId()` → `Field id={...}` → control `id={...}` chain (adding one more `useId()` call beside
  `statusId`/`paymentStatusId`/`paymentMethodId`/`amountPaidId` at lines 692-695) or risk a new a11y lint error
  in a file that currently has none.
- **`aria-invalid`, `aria-live`, `role="status"`/`role="alert"`** are used consistently and are what several of
  this file's few dynamic hints depend on for the a11y baseline elsewhere in the redesign (see
  `redesign/A11Y-BASELINE.md`, not modified by this task) — any new inline warning (§2's outside-zone alert)
  should reuse `role="status" aria-live="polite"` exactly as the existing `paidWithZero` and `AmountPaidInput`
  warnings do, not `role="alert"` (reserved in this file for `FormError`, a harder failure state).
- **`react-hooks/exhaustive-deps`** (part of `core-web-vitals`) is not currently triggered anywhere in this file
  — there is exactly one `useEffect`-adjacent pattern in the whole admin-bookings tree and it lives in
  `ManualBookingForm.tsx`, not here (with its own disable comment, not present in this file). If a new
  travel-fee `useState`/derived value is added via a `useMemo`/`useEffect` rather than inline computation during
  render (the pattern every other derived value in this file uses — e.g. `paidWithZero`, `reopeningCompleted`,
  both plain `const` expressions, no hooks), it would be the first hook-dependency surface in this file and the
  most likely new source of a `react-hooks/exhaustive-deps` warning. Plain-`const` derivation (matching
  `paidWithZero`/`reopeningCompleted`) avoids this risk entirely and is also simplest.
- **Unused-var risk from `.filter()` additions (§4)**: if `isOutsideFreeTravel` (or the new `freeTravelCities`
  prop) is threaded into `StatusAndPaymentSection` but only used inside the new `Field`/alert and *not* also
  wired into the `QUICK_ACTIONS.filter(...)` predicate (or vice versa), nothing will trip `no-unused-vars`
  automatically because both are genuinely read somewhere — but a half-finished wiring (e.g. destructuring
  `freeTravelCities` as a prop and never reading it because the comparison was hardcoded elsewhere) would.
- No new lint surface was found in `AmountPaidInput`, `StatusAndPaymentSection`, or `QUICK_ACTIONS` as they exist
  today — this section is prospective (what a sibling addition risks), not a finding of an existing problem.

---

## Summary for the implementer

- Target insertion points, byte-exact: new `Field`/input after line 899 (before `StatusAndPaymentSection`'s
  field-grid `</div>` at 900), new `useId()` beside 692-695, new chip filter at the `.map` call at line 784
  (turn into `.filter(...).map(...)`), new alert either inside the `paymentStatusId` `Field` (834-864,
  mirroring 855-863) or beside `form.state.error` at line 800.
- New prop: `freeTravelCities?: string[]` threaded `BookingManagementForm` → `StatusAndPaymentSection`, sourced
  from `getFreeTravelCities()` (`src/lib/booking/free-travel-cities.ts:36`) fetched in
  `[bookingId]/page.tsx` and passed at the `<BookingManagementForm booking={bookingWithTimeline} />` call site
  (line 507).
- Prerequisite outside this file: `BookingRecord` (`types.ts`) needs a `travel_fee: number | string | null`
  field before any of this typechecks against real data — confirmed absent as of this read.
- The server contract this UI must match is **already implemented** in `actions.ts` as of this session (§0):
  field name `travel_fee`, string value matching `/^\d+(\.\d{1,2})?$/`, `fieldErrors.travel_fee` for all three
  rejection paths (bad format, completed, fully paid). This was not true when the task brief was written and is
  the single most important drift from the brief's STATE section.
- Test additions belong in the existing `"quick actions on terminal statuses"` `describe` block (§7, tests
  9-13), following its established `{ ...BOOKING, ... }` override + `lastPayload()`/`screen.queryByRole` idiom;
  no new test harness or mock is needed, `updateBookingManagement` is already mocked wholesale.
