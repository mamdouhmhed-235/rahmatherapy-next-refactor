# Q1 — `src/app/admin/bookings/actions.ts`, the write path

Read-only derivation. Repo verified live at HEAD (`c188995`, item 8 Phases 1–2 complete/committed; Phase 3 migration applied, no app code reads/writes `travel_fee` yet — confirmed below by grep, zero hits).

File: `src/app/admin/bookings/actions.ts` (1754 lines total; this derivation only touches lines 1–1394, where every target lives).

---

## 1. `updateBookingManagement` — full function, byte-exact, blocks

Opens at **line 284**, exactly as the plan claims. Closes at line 578.

### Block A — signature, auth gate, arg parsing (284–332)

```
284	export async function updateBookingManagement(
285	  _previousState: BookingUpdateState,
286	  formData: FormData
287	): Promise<BookingUpdateState> {
288	  const actor = await requireBookingManager();
289	  if (!actor) return { error: "Insufficient permissions." };
290	  if (!canManageAllBookings(actor)) return { error: "Insufficient permissions." };
291	
292	  const bookingId = String(formData.get("booking_id") ?? "").trim();
293	  const status = String(formData.get("status") ?? "") as BookingStatus;
294	  const paymentStatus = String(
295	    formData.get("payment_status") ?? ""
296	  ) as PaymentStatus;
297	  const paymentMethodValue = String(formData.get("payment_method") ?? "");
298	  const paymentMethod = paymentMethodValue as PaymentMethod;
299	  const adminNotes = String(formData.get("admin_notes") ?? "").trim();
300	  const treatmentNotes = String(formData.get("treatment_notes") ?? "").trim();
301	  const customerManageNotes = String(
302	    formData.get("customer_manage_notes") ?? ""
303	  ).trim();
304	  const amountPaidValue = String(formData.get("amount_paid") ?? "").trim();
305	  const paymentNote = String(formData.get("payment_note") ?? "").trim();
306	  const fieldErrors: Record<string, string> = {};
307	  const amountPaid = amountPaidValue ? Number(amountPaidValue) : 0;
308	
309	  if (!bookingId) fieldErrors.booking_id = "Booking is required.";
310	  if (!BOOKING_STATUSES.includes(status)) {
311	    fieldErrors.status = "Choose a valid booking status.";
312	  }
313	  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
314	    fieldErrors.payment_status = "Choose a valid payment status.";
315	  }
316	  if (
317	    paymentStatus === "paid" &&
318	    !PAYMENT_METHODS.includes(paymentMethod)
319	  ) {
320	    fieldErrors.payment_method = "Choose cash or card for paid bookings.";
321	  }
322	  if (
323	    paymentMethodValue &&
324	    !PAYMENT_METHODS.includes(paymentMethod)
325	  ) {
326	    fieldErrors.payment_method = "Choose a valid payment method.";
327	  }
328	  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
329	    fieldErrors.amount_paid = "Enter a valid amount paid.";
330	  }
331	
332	  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
```

No `travel_fee` form field is read anywhere in this block (confirmed by whole-file grep — see §8).

### Block B — beforeState read (334–341) — **the highest-value block, see §3**

```
334	  const adminClient = createSupabaseAdminClient();
335	  const { data: beforeState } = await adminClient
336	    .from("bookings")
337	    .select("*")
338	    .eq("id", bookingId)
339	    .single();
340	
341	  if (!beforeState) return { error: "Booking not found." };
```

### Block C — completed-reversal guard, requires force flag + reason (343–369)

```
343	  // State-machine guard (C-04a Phase B): leaving `completed` is a
344	  // mistake-correction path, not a routine status edit, so it needs the Status
345	  // form's confirm modal to send an explicit force flag plus a reason. Every
346	  // other transition — including the notes forms, which re-post the booking's
347	  // own status unchanged — passes straight through.
348	  const completedReversalReason = String(
349	    formData.get("completed_reversal_reason") ?? ""
350	  ).trim();
351	
352	  if (isCompletedReversal(beforeState.status, status)) {
353	    if (formData.get("force_completed_reversal") !== "on") {
354	      return {
355	        error: "Reopening a completed booking requires confirmation.",
356	        fieldErrors: {
357	          status: "Use Restore on the next-action strip — or confirm via the modal.",
358	        },
359	      };
360	    }
361	    if (completedReversalReason.length < COMPLETED_REVERSAL_MIN_REASON_LENGTH) {
362	      return {
363	        error: "Reopening a completed booking requires a reason.",
364	        fieldErrors: {
365	          completed_reversal_reason: `Provide a reason (min ${COMPLETED_REVERSAL_MIN_REASON_LENGTH} chars).`,
366	        },
367	      };
368	    }
369	  }
```

### Block D — future-date guard for completed/no_show (371–390)

```
371	  // W03-E-2 (C-04a) — an outcome cannot be recorded before the day it happens
372	  // on. The Status dropdown offers `completed` and `no_show` on every booking,
373	  // so without this the form is the way round a refusal `quickUpdateBooking`'s
374	  // chips and the auto-promoter both carry: same predicate, same words, so the
375	  // three paths cannot drift. Keyed on the status being written, not on the
376	  // transition — `pending`, `confirmed` and `cancelled` stay settable on a
377	  // future-dated booking, and cancelling one ahead of time (the ordinary case)
378	  // still emails the client. The Notes forms re-post the booking's own status,
379	  // but a future-dated booking cannot be sitting at `completed` or `no_show`
380	  // for them to re-post: nothing creates one there and, with this guard, no
381	  // write path can move one there either.
382	  if (
383	    (status === "completed" || status === "no_show") &&
384	    isBookingDateFutureLondon(beforeState)
385	  ) {
386	    return {
387	      error:
388	        "This booking is in the future. Mark complete or no-show after the appointment time.",
389	    };
390	  }
```

### Block E — cancellation transition/exit flags (392–415)

```
392	  // C-04a Phase H — one predicate for the two things that must never disagree:
393	  // the `cancelled_at` stamp the S7 restore window is measured from, and the
394	  // delayed customer email the admin's Undo cancels. Read from the status being
395	  // written, not from the returned row, so the stamp and the send are decided
396	  // by the same expression. Only the way IN to `cancelled` counts: both Notes
397	  // forms re-post the booking's own status through `HiddenStatusPayload`, and a
398	  // notes save on an already-cancelled booking must not restart the window.
399	  const isCancellationTransition =
400	    beforeState.status !== "cancelled" && status === "cancelled";
401	
402	  // The mirror image, and the one this form was missing. The Status dropdown is
403	  // a second way OUT of `cancelled`, and until now it left without touching the
404	  // email the cancellation queued: admin cancels here, the toast expires after
405	  // its undo window, admin changes their mind and drives the same dropdown back
406	  // to Confirmed — and the queued row survives, so the cron sends the client a
407	  // cancellation for a booking that is live again.
408	  //
409	  // Deliberately NOT gated on S6 (past appointment moment) or S7 (28-day
410	  // window), and deliberately not delegated to `restoreBooking`. Either would
411	  // remove the Status form as the admin's escape hatch out of a terminal status,
412	  // which is a separate decision the Owner has not made. This closes the email
413	  // hole only.
414	  const isCancellationExit =
415	    beforeState.status === "cancelled" && status !== "cancelled";
```

### Block F — the write payload (417–455) — see §2 for the standalone quote and field analysis

(quoted verbatim in §2)

### Block G — the `.update()` call (457–464)

```
457	  const { data, error } = await adminClient
458	    .from("bookings")
459	    .update(payload)
460	    .eq("id", bookingId)
461	    .select()
462	    .single();
463	
464	  if (error) return { error: error.message };
```

### Block H — cancellation-email sweep (466–498)

```
466	  // Kill any cancellation email still sitting in the undo window. Identical
467	  // filters to `restoreBooking`'s sweep, and identically free of a
468	  // `scheduled_for` condition: `delivery_status = 'queued'` is the whole test
469	  // for "not yet sent", because the cron claims a row out of `queued` before it
470	  // dispatches. Adding the timestamp back would miss every row that is already
471	  // due but not yet drained — up to a minute's worth — which is exactly the
472	  // window this sweep exists for.
473	  let cancelledQueuedEmail = false;
474	  let cancelledQueuedEmailSweepError: string | undefined;
475	
476	  if (isCancellationExit) {
477	    const { count, error: sweepError } = await adminClient
478	      .from("email_delivery_events")
479	      .update({ delivery_status: "cancelled_by_restore" }, { count: "exact" })
480	      .eq("booking_id", bookingId)
481	      .eq("event_type", "booking_cancellation_customer")
482	      .eq("delivery_status", "queued");
483	
484	    if (sweepError) {
485	      // Fails closed the only way this path can. `restoreBooking` fails closed
486	      // by suppressing its client email; there is no client email on this path
487	      // to suppress, so the anomaly is recorded as itself — in the audit row
488	      // below, which is the durable record, plus this Cloudflare log line. An
489	      // errored sweep says nothing about whether the cancellation is still
490	      // queued, so it must never be read as "nothing was queued".
491	      console.error(
492	        "Unable to sweep queued cancellation emails while leaving cancelled.",
493	        sweepError
494	      );
495	      cancelledQueuedEmailSweepError = sweepError.message;
496	    }
497	    cancelledQueuedEmail = (count ?? 0) > 0;
498	  }
```

### Block I — audit insert (500–526) — quoted standalone in §4

### Block J — cancellation / status-change emails (528–558)

```
528	  if (isCancellationTransition) {
529	    await sendBookingCancellationEmails(bookingId, adminClient, {
530	      initiatedBy: "admin",
531	      // C-08 Phase D — skip-self: the cancelling admin doesn't get a
532	      // business alert about their own cancellation.
533	      actorStaffId: actor.id,
534	      // Change 14 — the customer leg is parked in `email_delivery_events` as
535	      // `queued` for this many seconds instead of being sent now; the admin and
536	      // assigned-staff legs still go immediately. That gap is exactly the window
537	      // the Undo toast lives in, and a restore inside it sweeps the queued row
538	      // to `cancelled_by_restore` so the client never hears about a booking that
539	      // is still on. The toast's `duration` in BookingRowActions.tsx and
540	      // BookingManagementForm.tsx is derived from this same constant.
541	      //
542	      // The queued row is only drained by the scheduled-emails cron, so a
543	      // cancellation email now depends on that cron running — and the cron is
544	      // minute-granular, so the real delay is this plus up to another minute.
545	      // No user-facing string may name a number of seconds because of it.
546	      delaySeconds: CANCELLATION_UNDO_DELAY_SECONDS,
547	    }).catch((error) => {
548	      console.error("Unable to send booking cancellation emails.", error);
549	    });
550	  } else if (beforeState.status !== data.status) {
551	    await sendAssignedStaffBookingChangeEmails(
552	      bookingId,
553	      adminClient,
554	      `Booking status changed from ${beforeState.status} to ${data.status}.`
555	    ).catch((error) => {
556	      console.error("Unable to send assigned staff change emails.", error);
557	    });
558	  }
```

### Block K — confirmed-client email (560–565) — quoted standalone in §5

### Block L — cache invalidation + return (567–578)

```
567	  updateTag("report-data");
568	  updateTag("dashboard-data");
569	  updateTag(TAGS.BOOKINGS);
570	  updateTag(TAGS.AUDIT);
571	  updateTag(TAGS.EMAILS);
572	  revalidatePath("/admin/bookings");
573	  revalidatePath(`/admin/bookings/${bookingId}`);
574	  revalidatePath("/admin/dashboard");
575	  revalidatePath("/admin/calendar");
576	
577	  return { success: true };
578	}
```

**Plan-claim check:** function opens at line 284 exactly as claimed. NONE of the drift found elsewhere in this file (see §3, §6) applies here — every claim about `updateBookingManagement` line numbers is exact.

---

## 2. The payload object (claimed 417–455)

Claim is **exact**: the object literal runs lines 417–455 verbatim.

```
417	  const payload = {
418	    status,
419	    payment_status: paymentStatus,
420	    payment_method:
421	      paymentStatus === "paid" && paymentMethodValue ? paymentMethod : null,
422	    amount_paid: amountPaid,
423	    paid_at:
424	      paymentStatus === "paid" && beforeState.payment_status !== "paid"
425	        ? new Date().toISOString()
426	        : paymentStatus === "paid"
427	          ? beforeState.paid_at
428	          : null,
429	    payment_note: paymentNote || null,
430	    admin_notes: adminNotes || null,
431	    treatment_notes: treatmentNotes || null,
432	    customer_manage_notes: customerManageNotes || null,
433	    // S7 — stamped in the SAME UPDATE that writes `status = 'cancelled'`. A
434	    // second round trip could leave a cancelled booking with no cancellation
435	    // moment, and `isRestoreWindowExpired` fails closed on that: the Restore
436	    // affordance would vanish from a booking cancelled seconds ago. Cancelling
437	    // again after a restore re-stamps, which restarts the 28 days.
438	    ...(isCancellationTransition
439	      ? { cancelled_at: new Date().toISOString() }
440	      : {}),
441	    // …and cleared on the way back out, mirroring `restoreBooking`'s payload
442	    // builder field for field: all three cancellation columns are stale the
443	    // moment the booking stops being cancelled, and a live booking still
444	    // carrying a cancellation moment is what `getCancellationMoment` reads. No
445	    // PGRST204 fallback here, unlike `restoreBooking`: this function already
446	    // writes `cancelled_at` unconditionally on the way IN, so the column is a
447	    // hard requirement of this path either way.
448	    ...(isCancellationExit
449	      ? {
450	          cancelled_at: null,
451	          customer_cancelled_at: null,
452	          customer_cancellation_note: null,
453	        }
454	      : {}),
455	  };
```

**Fields set, unconditionally:** `status`, `payment_status`, `payment_method` (derived), `amount_paid`, `paid_at` (derived), `payment_note`, `admin_notes`, `treatment_notes`, `customer_manage_notes`.

**Fields set, conditionally (spread):** `cancelled_at` (either the fresh ISO stamp on cancellation-in, or `null` on cancellation-out), plus `customer_cancelled_at` and `customer_cancellation_note` (both `null`) on cancellation-out.

**`total_price` / `amount_due`: NOT present in this object at all.** Neither key is set, read, or referenced anywhere in the payload literal. Repo-wide grep of this file for `total_price|amount_due` returns exactly one hit, and it is a **read**, not in this function (see §8 for the full accounting). `amount_paid` is the only money field this payload touches, and it is written straight from the raw form input (`amountPaid`, a `Number()` of the posted string) with no reference to `total_price`, `amount_due`, or any existing `travel_fee`.

This confirms the design brief's premise: today nothing in this payload folds a fee into `total_price`/`amount_due` — a caller adding fee-awareness has a clean, empty slate here, not an existing computation to rewire.

---

## 3. beforeState read — **the load-bearing finding**

**Yes**, both mutating actions in this file read a `beforeState` immediately before building their payload, and in **both cases the select is `.select("*")`** — a wildcard, not an explicit column list.

### `updateBookingManagement` (lines 335–339, inside the block quoted in §1):

```
335	  const { data: beforeState } = await adminClient
336	    .from("bookings")
337	    .select("*")
338	    .eq("id", bookingId)
339	    .single();
```

### `quickUpdateBooking` (lines 753–757 — see §6):

```
753	  const { data: beforeState } = await adminClient
754	    .from("bookings")
755	    .select("*")
756	    .eq("id", bookingId)
757	    .single();
```

**Correction to the plan's stated risk:** the plan warns *"If the select is an explicit list, the caller must add `travel_fee` to it or the delta silently treats the old fee as 0 and double-charges."* That conditional does not fire here — **neither select is an explicit list**. Both are bare `select("*")` against the untyped admin client (PostgREST wildcard), so `beforeState.travel_fee`, `beforeState.total_price`, `beforeState.amount_due`, and `beforeState.amount_paid` are **already present on `beforeState` with zero code change**, because `travel_fee` is a real, live column on `public.bookings` as of the applied Phase 3 migration. A caller wiring in the fee-delta and the completed/fully-paid lock in either function can read `beforeState.travel_fee` today without touching either select statement.

(The one *explicit* select in this file that is missing a needed column belongs to a different action — `restoreBooking`'s `select("*, clients(deleted_at)")` at line 945, also effectively `*` plus an embed, so it too already carries `travel_fee`. `respondToCustomerReschedule`'s select at 1383–1385 is the only genuinely explicit/narrow list in the file, and it is unrelated to money fields — see next page of the file for its full body, not reproduced here as it is out of scope for this write path.)

---

## 4. `canManageAllBookings` gate and audit insert

### Gate (claimed 290) — **exact**

```
290	  if (!canManageAllBookings(actor)) return { error: "Insufficient permissions." };
```

Full context (288–290):

```
288	  const actor = await requireBookingManager();
289	  if (!actor) return { error: "Insufficient permissions." };
290	  if (!canManageAllBookings(actor)) return { error: "Insufficient permissions." };
```

### Audit insert (claimed 500–526) — **exact**, `action_type: "booking_management_updated"` confirmed

```
500	  await adminClient.from("audit_logs").insert({
501	    actor_staff_id: actor.id,
502	    action_type: "booking_management_updated",
503	    target_type: "bookings",
504	    target_id: bookingId,
505	    before_state: beforeState,
506	    // The reopen reason only exists once the guard above has accepted it, so
507	    // folding it into `after_state` is what makes the audit row explain itself.
508	    after_state: {
509	      ...data,
510	      ...(completedReversalReason
511	        ? { completed_reversal_reason: completedReversalReason }
512	        : {}),
513	      // Same two keys `restoreBooking` writes, so the two paths that can suppress
514	      // a client's cancellation are queryable as one. Only attached when the
515	      // sweep actually ran: on every other save these keys would be noise.
516	      ...(isCancellationExit
517	        ? {
518	            cancelled_queued_email: cancelledQueuedEmail,
519	            // Carried verbatim, never coerced: an error whose message is ""
520	            // must still record that the sweep failed, rather than serialising
521	            // to a row byte-identical to the healthy "nothing was queued" case.
522	            cancelled_queued_email_sweep_error: cancelledQueuedEmailSweepError,
523	          }
524	        : {}),
525	    },
526	  });
```

`before_state: beforeState` uses the whole `select("*")` row, so if a caller adds a fee delta to the payload, the audit row's `before_state` already captures the pre-write `travel_fee` for free — same reasoning as §3. `after_state` spreads `data`, the fresh row returned by `.update(payload).select().single()`, so a written `travel_fee` would show up there too without any change to this insert.

---

## 5. Confirmed-client email — order and data source

### Quote (claimed 561–565) — **exact**

```
560	  // C-08: booking_confirmed_client on pending → confirmed
561	  if (beforeState.status === "pending" && data.status === "confirmed") {
562	    await sendBookingConfirmedClientEmail(bookingId, adminClient).catch((error) => {
563	      console.error("Unable to send booking_confirmed_client email.", error);
564	    });
565	  }
```

### Fires after the update — confirmed

The `.update(payload)` call is at lines 457–462 (§1 Block G / §2 above); this email call is at 561, strictly after it in source order and in the same synchronous control flow (no branch skips from 457 to 561 without passing through the update).

### Fresh select, not the update result — confirmed

`sendBookingConfirmedClientEmail` is called with `(bookingId, adminClient)` — **not** `data` (the update result) and **not** `beforeState`. Its own body, in `src/lib/email/notifications.ts` (lines 1073–1102), does its own independent lookup:

```
1073	export async function sendBookingConfirmedClientEmail(
1074	  bookingId: string,
1075	  supabase: SupabaseClient
1076	): Promise<void> {
1077	  // C-C fix round (F-2) — was `includeManageUrl: true`, which rotated the
1078	  // single live manage token on every pending→confirmed transition and
1079	  // killed the link in whatever email the customer already had. See
1080	  // getExistingBookingManageUrl's doc comment: this email now simply omits
1081	  // the manage-link CTA rather than risk breaking one already sent.
1082	  const { booking, input } = await getBookingTemplateInput(bookingId, supabase, {
1083	    includeExistingManageUrl: true,
1084	  });
```

`getBookingTemplateInput(bookingId, supabase, …)` re-queries by `bookingId` — it takes only the ID, not the caller's in-memory row — so this email's booking data is a genuinely fresh, post-write select, independent of both `beforeState` and `data`. Any fee value written by the `.update(payload)` a few lines earlier will already be visible to this email's template input without further plumbing, once the migration (already applied) and a future write of `travel_fee` exist.

---

## 6. `quickUpdateBooking`

### Function open — claimed 732 — **exact**

```
732	export async function quickUpdateBooking(formData: FormData) {
733	  const actor = await requireBookingManager();
734	  if (!actor || !canManageAllBookings(actor)) {
735	    return { error: "Insufficient permissions." };
736	  }
```

### Auth gate — quoted above (733–736), byte-exact.

### Confirm branch — claimed 777–778 — **exact**

```
776	  const payload =
777	    action === "confirm"
778	      ? { status: "confirmed" as BookingStatus }
```

Full ternary chain for context (776–796), showing every branch this action can take:

```
776	  const payload =
777	    action === "confirm"
778	      ? { status: "confirmed" as BookingStatus }
779	      : action === "mark_paid"
780	        ? {
781	            payment_status: "paid" as PaymentStatus,
782	            payment_method: beforeState.payment_method ?? ("cash" as PaymentMethod),
783	            amount_paid: amountDue,
784	            paid_at: beforeState.paid_at ?? new Date().toISOString(),
785	          }
786	        : action === "cancel"
787	          ? { status: "cancelled" as BookingStatus, ...cancelledAtStamp }
788	          : action === "complete"
789	            ? isFutureDated
790	              ? null
791	              : { status: "completed" as BookingStatus }
792	            : action === "no_show"
793	              ? isFutureDated
794	                ? null
795	                : { status: "no_show" as BookingStatus }
796	              : null;
```

**Plan claim confirmed:** the `confirm` branch produces exactly `{ status: "confirmed" as BookingStatus }` — a single key, no form fields read for it at all (`action` is the only input this branch consults). There is no fee input, no `travel_fee`, no amount field anywhere in this action's payload construction. As a one-click chip with a fixed literal payload and no form body beyond `booking_id`/`action`, it structurally cannot become fee-aware without adding new inputs to the chip itself — confirmed correct.

### Second confirm-email path — claimed 893–898 — **exact**

```
893	  // C-08: booking_confirmed_client on pending → confirmed
894	  if (beforeState.status === "pending" && updatedBooking.status === "confirmed") {
895	    await sendBookingConfirmedClientEmail(bookingId, adminClient).catch((error) => {
896	      console.error("Unable to send booking_confirmed_client email.", error);
897	    });
898	  }
```

Same email function, same fresh-lookup behavior as §5 — mirrors `updateBookingManagement`'s send exactly, just triggered off `updatedBooking.status` (this function's update result) instead of `data.status`.

### beforeState select for this function (753–757), also `.select("*")` — see §3.

---

## 7. Existing `fieldErrors` precedent — the house idiom

### Return-type declaration (lines 50–54)

```
50	export interface BookingUpdateState {
51	  error?: string;
52	  fieldErrors?: Record<string, string>;
53	  success?: boolean;
54	}
```

Both `updateBookingManagement` and `restoreBooking` are typed `Promise<BookingUpdateState>`; `quickUpdateBooking` returns an untyped but structurally identical shape (`{ error }` / `{ success: true }`, no fieldErrors used there today — see §6, no field-level validation exists in the chip path).

### Existing field-level error returns, in `updateBookingManagement` (343–369, quoted in full in §1 Block C):

```
354	      return {
355	        error: "Reopening a completed booking requires confirmation.",
356	        fieldErrors: {
357	          status: "Use Restore on the next-action strip — or confirm via the modal.",
358	        },
359	      };
```

```
362	      return {
363	        error: "Reopening a completed booking requires a reason.",
364	        fieldErrors: {
365	          completed_reversal_reason: `Provide a reason (min ${COMPLETED_REVERSAL_MIN_REASON_LENGTH} chars).`,
366	        },
367	      };
```

A second precedent exists in `restoreBooking` (lines 933–935 and 980–986, both within the range read for this derivation):

```
933	  if (!RESTORE_TARGET_STATUSES.includes(targetStatusValue as RestoreTargetStatus)) {
934	    return { fieldErrors: { target_status: "Choose a valid restore target." } };
935	  }
```

```
980	  if (isCompletedReopen && (!forceCompleted || reason.length < 5)) {
981	    return {
982	      error: "Reopening a completed booking requires confirmation and a reason.",
983	      fieldErrors: forceCompleted
984	        ? { reason: "Provide a reason (min 5 chars)." }
985	        : { force_completed_reversal: "Confirm via the modal." },
986	    };
987	  }
```

**House idiom:** `{ error: string, fieldErrors: { <field_name>: <message> } }`, where `fieldErrors` keys are the form-field `name` attributes the client posts (`status`, `completed_reversal_reason`, `target_status`, `reason`, `force_completed_reversal`), each mapped to a single human-readable string. A new "completed/fully-paid lock" error on a fee field should return `{ error: "...", fieldErrors: { <fee_field_name>: "..." } }` in this same shape to match every existing caller-side error-rendering path in this file.

---

## 8. Every place `total_price` or `amount_due` is WRITTEN in this file

**Nowhere.** Whole-file grep for `total_price|amount_due` returns exactly one match in the entire 1754-line file:

```
764:  const amountDue = Number(beforeState.amount_due ?? beforeState.total_price ?? 0);
```

This is a **read** (inside `quickUpdateBooking`, used only to compute the `mark_paid` chip's `amount_paid` value at line 783 — `amount_paid: amountDue`). Neither `total_price` nor `amount_due` is ever assigned as an object key in any `.update()` payload, in either mutating action, anywhere in this file. `travel_fee` likewise has zero occurrences anywhere in the file (separately confirmed grep, no matches).

**Conclusion for the caller:** there is no existing computation of `total_price`/`amount_due` to rewire in this file — every write path (`updateBookingManagement`'s payload at 417–455, `quickUpdateBooking`'s payload at 776–796, `restoreBooking`'s payload builder at 999–1011) sets a disjoint set of columns, and none of them touch money totals today. Introducing the fee delta means *adding* `total_price`/`amount_due` keys to `updateBookingManagement`'s payload object (§2) for the first time — there is no prior arithmetic to preserve or avoid duplicating.

---

## Summary of plan-claim verification

| # | Claim | Verdict |
|---|---|---|
| 1 | `updateBookingManagement` opens at 284 | CONFIRMED, exact |
| 2 | Payload object at 417–455 | CONFIRMED, exact; sets `status`, `payment_status`, `payment_method`, `amount_paid`, `paid_at`, `payment_note`, `admin_notes`, `treatment_notes`, `customer_manage_notes`, conditionally `cancelled_at`/`customer_cancelled_at`/`customer_cancellation_note`. Never touches `total_price`/`amount_due`. |
| 3 | beforeState select — explicit list requiring `travel_fee` addition | **PARTIALLY FALSE, in the caller's favor.** Both `updateBookingManagement` (335–339) and `quickUpdateBooking` (753–757) already use `select("*")`, a wildcard — not an explicit column list. `travel_fee` is already present on `beforeState` with no select change needed. |
| 4 | `canManageAllBookings` gate at 290; audit insert at 500–526, `booking_management_updated` | CONFIRMED, both exact |
| 5 | `sendBookingConfirmedClientEmail` at 561–565, fires after `.update(payload)` (457–462), fresh select via `getBookingTemplateInput` | CONFIRMED, all three sub-claims exact |
| 6 | `quickUpdateBooking` opens 732, confirm branch 777–778, second confirm path 893–898; confirm branch is fee-blind | CONFIRMED, all exact; confirm branch is literally `{ status: "confirmed" as BookingStatus }`, no other inputs |
| 7 | House `fieldErrors` idiom exists | CONFIRMED — `BookingUpdateState.fieldErrors: Record<string,string>` (50–54), four existing usages found (356–358, 364–366, 933–934, 983–986) |
| 8 | Every write of `total_price`/`amount_due` in this file | **NONE EXIST.** One read only, line 764. |
