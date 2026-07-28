"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AdminButton,
  AdminPanel,
  AdminStatusBadge,
  type AdminTone,
} from "../components/admin-ui";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import { BookingActionButton } from "./BookingActionButton";
import {
  quickUpdateBooking,
  updateBookingManagement,
  type BookingUpdateState,
} from "./actions";
import {
  CANCELLATION_UNDO_TOAST_MS,
  COMPLETED_REVERSAL_MIN_REASON_LENGTH,
  isBookingMomentPastLondon,
  isCompletedReversal,
} from "./_helpers";
import type { BookingRecord, BookingStatus } from "./types";

interface BookingManagementFormProps {
  booking: BookingRecord;
}

const STATUS_TONES: Record<BookingStatus, AdminTone> = {
  pending: "info",
  confirmed: "success",
  completed: "default",
  cancelled: "danger",
  no_show: "warning",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function BookingManagementForm({ booking }: BookingManagementFormProps) {
  return (
    <div className="grid gap-6">
      <StatusAndPaymentSection booking={booking} />
      <NotesSection booking={booking} />
    </div>
  );
}

// ─── Shared plumbing for the Status & payment section ────────────────────────

interface StatusFormState {
  isPending: boolean;
  state: BookingUpdateState;
  dirty: boolean;
  amountPaid: string;
  setAmountPaid: (value: string) => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  paymentNote: string;
  setPaymentNote: (value: string) => void;
  submit: (formData: FormData) => Promise<void>;
  setReasonError: (message: string) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  recomputeDirty: (
    overrides?: Partial<{
      status: string;
      payment_status: string;
      payment_method: string;
      amount_paid: string;
      payment_note: string;
    }>
  ) => void;
  initial: {
    status: BookingStatus;
    payment_status: string;
    payment_method: string;
    amount_paid: string;
    payment_note: string;
  };
}

function useStatusForm(booking: BookingRecord): StatusFormState {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<BookingUpdateState>({});
  const [dirty, setDirty] = useState(false);
  const [amountPaid, setAmountPaid] = useState(
    String(Number(booking.amount_paid ?? 0))
  );
  const [paymentMethod, setPaymentMethod] = useState(booking.payment_method ?? "");
  const [paymentNote, setPaymentNote] = useState(booking.payment_note ?? "");

  const initial = useMemo(
    () => ({
      status: booking.status,
      payment_status: booking.payment_status,
      payment_method: booking.payment_method ?? "",
      amount_paid: String(Number(booking.amount_paid ?? 0)),
      payment_note: booking.payment_note ?? "",
    }),
    [booking]
  );

  function recomputeDirty(overrides: Partial<{
    status: string;
    payment_status: string;
    payment_method: string;
    amount_paid: string;
    payment_note: string;
  }> = {}) {
    const current = {
      payment_method: paymentMethod,
      amount_paid: amountPaid,
      payment_note: paymentNote,
      ...overrides,
    };
    setDirty(
      (current.status !== undefined && current.status !== initial.status) ||
        (current.payment_status !== undefined &&
          current.payment_status !== initial.payment_status) ||
        current.payment_method !== initial.payment_method ||
        Number(current.amount_paid) !== Number(initial.amount_paid) ||
        current.payment_note !== initial.payment_note
    );
  }

  // C-04a Phase H (Change 14) — the Undo behind the cancellation toast. Posted
  // through `quickUpdateBooking`'s `action=restore` so it lands in
  // `restoreBooking`, which owns the S6 past-moment guard, the deleted-client
  // refusal, the `booking_restored` audit action and the sweep that kills the
  // still-queued cancellation email. Re-selecting a status in this form would
  // be an unguarded way back out of a terminal state.
  //
  // `target_status` restores what the booking actually was; `restoreBooking`
  // accepts only `confirmed`/`pending`, so a completed booking reopened and then
  // cancelled comes back as `confirmed`.
  async function undoCancellation() {
    const undoFormData = new FormData();
    undoFormData.set("booking_id", booking.id);
    undoFormData.set("action", "restore");
    undoFormData.set(
      "target_status",
      booking.status === "pending" ? "pending" : "confirmed"
    );
    try {
      const undoResult = await quickUpdateBooking(undoFormData);
      if (undoResult.error) {
        toast.error(`Couldn't undo: ${undoResult.error}`);
      } else {
        // No follow-up toast when the cron beat the undo (brief §5.9) — the
        // client gets an honest "your booking is back on" email in that case.
        toast.success("Cancellation undone.");
      }
    } catch (error) {
      console.error("[bookings] undo cancel failed", { bookingId: booking.id, error });
      toast.error("Couldn't undo that cancellation. Try again.");
    }
    router.refresh();
  }

  // The promise matters: the reopen-confirm modal awaits this before it closes,
  // so the dialog outlives the request instead of dismissing on the next
  // microtask. Same shape as the Restore control's `runRestore`.
  function submit(formData: FormData) {
    // The Status dropdown can write any status, so the cancellation toast has
    // to be told apart from an ordinary save. Read the same way the
    // completed-reversal interception in `handleSubmit` reads it: the rendered
    // booking's status against the status this submit is posting.
    //
    // The plan's `cancelledWithUndoWindow` flag on the server response exists
    // only because it assumed a `useActionState` consumer, where the submitted
    // FormData is out of reach in the effect. This form awaits the action
    // directly and still holds the FormData, so the flag would be a server
    // round trip for something already in hand.
    const isCancellationTransition =
      booking.status !== "cancelled" &&
      String(formData.get("status") ?? "") === "cancelled";

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await updateBookingManagement({}, formData);
        if (result.error || result.fieldErrors) {
          setState(result);
          if (result.error) {
            toast.error("Couldn't save changes. Try again.", {
              duration: Infinity,
              action: {
                label: "Retry",
                onClick: () => void submit(formData),
              },
            });
          }
          resolve();
          return;
        }
        setState({});
        setDirty(false);
        if (isCancellationTransition) {
          // The client has NOT been notified yet — the customer leg is queued
          // (`delaySeconds` in `updateBookingManagement`) for the
          // scheduled-emails cron to drain. The cron fires on the minute, so the
          // true wait is the delay plus up to another minute: no number of
          // seconds may appear in this copy.
          //
          // S6, asked before the Undo is offered. The Undo posts
          // `action=restore`, so on a booking whose appointment moment has gone
          // `restoreBooking` refuses it: the admin would get "…appointment time
          // has already passed…", the queued cancellation would still reach the
          // client, and the booking would be left unrestorable. Read here rather
          // than at render because the form can sit open across the boundary.
          const undoable = !isBookingMomentPastLondon(booking);
          toast.success(
            undoable
              ? "Booking cancelled. The client will be emailed shortly — there's a brief window to undo it."
              : "Booking cancelled. The client will be emailed shortly.",
            undoable
              ? {
                  action: {
                    label: "Undo",
                    onClick: () => void undoCancellation(),
                  },
                  // Shorter than the server's delay on purpose — see
                  // CANCELLATION_UNDO_TOAST_MS.
                  duration: CANCELLATION_UNDO_TOAST_MS,
                }
              : undefined
          );
        } else {
          toast.success("Booking updated.");
        }
        router.refresh();
        resolve();
      });
    });
  }

  /**
   * Refuses a reopen client-side, under the same field key the server uses, so
   * the message lands in the one render site both paths share.
   */
  function setReasonError(message: string) {
    setState({ fieldErrors: { completed_reversal_reason: message } });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // While a completed reopen is pending the Save control is the confirm
    // modal's trigger, so the only way to reach a native submit is implicit
    // submission (Enter inside a field). Route it back to the modal rather than
    // firing a request the server guard would reject anyway.
    if (
      isCompletedReversal(booking.status, String(formData.get("status") ?? "")) &&
      formData.get("force_completed_reversal") !== "on"
    ) {
      setState({
        fieldErrors: {
          status: "Reopening a completed booking needs confirming — use Save status & payment.",
        },
      });
      return;
    }

    submit(formData);
  }

  return {
    isPending,
    state,
    dirty,
    amountPaid,
    setAmountPaid,
    paymentMethod,
    setPaymentMethod,
    paymentNote,
    setPaymentNote,
    submit,
    setReasonError,
    handleSubmit,
    recomputeDirty,
    initial,
  };
}

function HiddenNotesPayload({ booking }: { booking: BookingRecord }) {
  return (
    <>
      <input type="hidden" name="booking_id" value={booking.id} />
      <input
        type="hidden"
        name="treatment_notes"
        value={booking.treatment_notes ?? ""}
      />
      <input
        type="hidden"
        name="admin_notes"
        value={booking.admin_notes ?? ""}
      />
      <input
        type="hidden"
        name="customer_manage_notes"
        value={booking.customer_manage_notes ?? ""}
      />
    </>
  );
}

interface QuickActionDescriptor {
  action: "confirm" | "mark_paid" | "complete" | "cancel";
  pendingLabel: string;
  doneLabel: string;
  isDone: (booking: BookingRecord) => boolean;
  isDestructive?: boolean;
}

// `completed`, `cancelled` and `no_show` are terminal for the one-click chips
// (see `quickUpdateBooking`): leaving any of them needs a reason, or a restore,
// that the chip cannot capture, so the affordance disappears rather than
// offering a call the server will refuse. All three status chips carry that
// same shape; `mark_paid` keys on payment status and is unaffected.
const QUICK_ACTIONS: QuickActionDescriptor[] = [
  {
    action: "confirm",
    pendingLabel: "Confirm booking",
    doneLabel: "Confirmed",
    isDone: (b) =>
      b.status === "confirmed" ||
      b.status === "completed" ||
      b.status === "cancelled" ||
      b.status === "no_show",
  },
  {
    action: "mark_paid",
    pendingLabel: "Mark paid",
    doneLabel: "Marked paid",
    isDone: (b) => b.payment_status === "paid",
  },
  {
    action: "complete",
    pendingLabel: "Mark complete",
    doneLabel: "Completed",
    isDone: (b) =>
      b.status === "completed" ||
      b.status === "cancelled" ||
      b.status === "no_show",
  },
  {
    action: "cancel",
    pendingLabel: "Cancel booking",
    doneLabel: "Cancelled",
    isDone: (b) =>
      b.status === "cancelled" ||
      b.status === "completed" ||
      b.status === "no_show",
    isDestructive: true,
  },
];

function StateAwareQuickActionButton({
  booking,
  descriptor,
}: {
  booking: BookingRecord;
  descriptor: QuickActionDescriptor;
}) {
  const done = descriptor.isDone(booking);
  if (done) {
    return (
      <span className="inline-flex h-11 sm:h-8 w-full sm:w-auto items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 text-xs font-semibold text-[var(--admin-text-muted)]">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {descriptor.doneLabel}
      </span>
    );
  }
  return (
    <BookingActionButton
      bookingId={booking.id}
      action={descriptor.action}
      variant="ghost"
      size="touch"
    >
      {descriptor.pendingLabel}
    </BookingActionButton>
  );
}

function PaymentMethodSelect({
  id,
  value,
  disabled,
  hasError,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  hasError: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      id={id}
      name="payment_method"
      value={value}
      disabled={disabled}
      hasError={hasError}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      <option value="">Not set</option>
      <option value="cash">Cash</option>
      <option value="card">Card</option>
    </Select>
  );
}

function AmountPaidInput({
  id,
  value,
  disabled,
  hasError,
  onChange,
  total,
}: {
  id: string;
  value: string;
  disabled: boolean;
  hasError: boolean;
  onChange: (value: string) => void;
  total: number;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-[var(--admin-text-muted)]"
        >
          £
        </span>
        <input
          id={id}
          name="amount_paid"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={hasError ? "true" : undefined}
          className={inputClass(hasError, "pl-7")}
        />
      </div>
      {total > 0 && Number.isFinite(Number(value)) && Number(value) > total ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-[var(--admin-radius-control)] bg-[oklch(96.0%_0.038_75)] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-[oklch(28%_0.120_55)]"
        >
          Amount is more than the booking total. Mark as partially paid first, or check the figure.
        </p>
      ) : null}
      {total > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange(total.toFixed(2))}
            disabled={disabled || Number(value) === total}
            className="inline-flex h-11 sm:h-7 items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 sm:px-2 text-xs sm:text-[0.6875rem] font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Match total · £{total.toFixed(2)}
          </button>
          {Number(value) !== 0 ? (
            <button
              type="button"
              onClick={() => onChange("0")}
              disabled={disabled}
              className="inline-flex h-11 sm:h-7 items-center gap-1 rounded-[var(--admin-radius-control)] px-3 sm:px-2 text-xs sm:text-[0.6875rem] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PaymentNoteDisclosure({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(value.trim().length > 0);
  const noteId = useId();
  return (
    <div>
      {open ? (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={noteId}
              className="text-sm font-medium text-[var(--admin-heading)]"
            >
              Payment note
            </label>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-[0.6875rem] font-medium text-[var(--admin-text-muted)] underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Remove
            </button>
          </div>
          <textarea
            id={noteId}
            name="payment_note"
            rows={3}
            placeholder="e.g. paid in full at the door; £45 cash"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={textareaClass(false)}
          />
        </div>
      ) : (
        <>
          <input type="hidden" name="payment_note" value={value} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 sm:h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-dashed border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <span aria-hidden="true">+</span>
            Add a payment note
          </button>
        </>
      )}
    </div>
  );
}

function StatusSaveButton({
  dirty,
  isPending,
  type = "submit",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  dirty: boolean;
  isPending: boolean;
}) {
  // `...props` matters: as the reopen-confirm modal's trigger this button is
  // cloned by Base UI, which hands it the click handler that opens the dialog.
  return (
    <AdminButton
      {...props}
      type={type}
      variant="primary"
      loading={isPending}
      disabled={!dirty}
      aria-disabled={!dirty || isPending ? "true" : undefined}
      className={`min-h-11 sm:min-h-10 transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        !dirty ? "opacity-60" : "opacity-100"
      }`}
    >
      Save status &amp; payment
    </AdminButton>
  );
}

/**
 * Step 4b (C-04a Phase B) — the Save control becomes this modal's trigger the
 * moment the Status select leaves `completed`. Confirming re-submits the same
 * form with the two fields `updateBookingManagement`'s state-machine guard
 * demands. Brief §4.3.
 */
function ReopenCompletedModal({
  targetStatus,
  dirty,
  isPending,
  onConfirm,
}: {
  targetStatus: BookingStatus;
  dirty: boolean;
  isPending: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const reasonId = useId();
  const hintId = useId();
  const [reason, setReason] = useState("");
  // Flagged only once something has been typed — an untouched field isn't an
  // error yet. `confirmReopen` re-checks the same rule before posting, so a
  // confirm on a short reason is refused rather than sent to be rejected.
  const reasonTooShort =
    reason.trim().length < COMPLETED_REVERSAL_MIN_REASON_LENGTH;
  const showReasonError = reason.length > 0 && reasonTooShort;

  return (
    <ConfirmActionModal
      title="Reopen this completed booking?"
      description="Reopening a completed booking is unusual. The audit log will show why. Provide a brief reason."
      confirmLabel="Reopen booking"
      cancelLabel="Cancel"
      destructive={false}
      onConfirm={() => onConfirm(reason)}
      trigger={
        <StatusSaveButton type="button" dirty={dirty} isPending={isPending} />
      }
    >
      <div className="grid gap-1.5">
        <label
          htmlFor={reasonId}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Reason for reopening
        </label>
        <textarea
          id={reasonId}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          placeholder="e.g. client returned for retreat"
          aria-describedby={hintId}
          aria-invalid={showReasonError ? "true" : undefined}
          className={textareaClass(showReasonError)}
        />
        <p
          id={hintId}
          className={`text-xs ${
            showReasonError
              ? "text-[oklch(26%_0.14_25)]"
              : "text-[var(--admin-text-muted)]"
          }`}
        >
          Min {COMPLETED_REVERSAL_MIN_REASON_LENGTH} characters. Status will
          change from Completed to {STATUS_LABELS[targetStatus]}.
        </p>
      </div>
    </ConfirmActionModal>
  );
}

// ─── Lifecycle steps ──────────────────────────────────────────────────────────

const LIFECYCLE_STEPS: Array<{
  key: "pending" | "confirmed" | "completed";
  label: string;
}> = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
];

function StatusAndPaymentSection({ booking }: { booking: BookingRecord }) {
  const form = useStatusForm(booking);
  const formRef = useRef<HTMLFormElement>(null);
  const statusId = useId();
  const paymentStatusId = useId();
  const paymentMethodId = useId();
  const amountPaidId = useId();
  const total = Number(booking.total_price ?? 0);
  const [paymentStatusValue, setPaymentStatusValue] = useState(
    booking.payment_status
  );
  const [statusValue, setStatusValue] = useState<BookingStatus>(booking.status);
  const paidWithZero =
    paymentStatusValue === "paid" && Number(form.amountPaid) === 0;
  const reopeningCompleted = isCompletedReversal(booking.status, statusValue);

  // Awaited by the confirm modal, so it stays open until the server answers.
  // The length check is the client half of the same rule
  // `updateBookingManagement` enforces: without it a too-short reason posts a
  // request that can only ever come back rejected.
  async function confirmReopen(reason: string) {
    if (!formRef.current) return;
    const trimmedReason = reason.trim();
    if (trimmedReason.length < COMPLETED_REVERSAL_MIN_REASON_LENGTH) {
      form.setReasonError(
        `Provide a reason (min ${COMPLETED_REVERSAL_MIN_REASON_LENGTH} chars).`
      );
      return;
    }
    const formData = new FormData(formRef.current);
    formData.set("force_completed_reversal", "on");
    formData.set("completed_reversal_reason", trimmedReason);
    await form.submit(formData);
  }

  const stepIndex = LIFECYCLE_STEPS.findIndex(
    (step) => step.key === booking.status
  );

  return (
    <AdminPanel
      title="Status & payment"
      badge={
        <AdminStatusBadge
          tone={STATUS_TONES[booking.status]}
          value={STATUS_LABELS[booking.status]}
        />
      }
    >
      <ol
        aria-label="Booking lifecycle"
        className="-mx-1 mb-5 flex flex-wrap items-center gap-1 overflow-x-auto"
      >
        {LIFECYCLE_STEPS.map((step, index) => {
          const isPast = stepIndex > index;
          const isCurrent = stepIndex === index;
          return (
            <li key={step.key} className="flex items-center gap-1.5">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
                  isCurrent
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    : isPast
                      ? "bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)]"
                      : "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex size-1.5 rounded-full ${
                    isCurrent || isPast
                      ? "bg-current opacity-80"
                      : "bg-[var(--admin-border)]"
                  }`}
                />
                {step.label}
              </span>
              {index < LIFECYCLE_STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-px w-4 ${
                    isPast
                      ? "bg-[var(--admin-primary)]"
                      : "bg-[var(--admin-border)]"
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Mobile: 2-col grid for thumb-symmetric tap targets. sm+: free-flow flex-wrap. */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
        {QUICK_ACTIONS.map((descriptor) => (
          <StateAwareQuickActionButton
            key={descriptor.action}
            booking={booking}
            descriptor={descriptor}
          />
        ))}
      </div>

      <form
        id="booking-status-form"
        ref={formRef}
        onSubmit={form.handleSubmit}
        className="grid gap-5"
      >
        <HiddenNotesPayload booking={booking} />
        {form.state.error ? <FormError message={form.state.error} /> : null}

        {/*
          Form-grid responsiveness: at md (768) the sticky sidebar leaves ~430px
          for this column, where 2-col fields collide. Stay single-column from
          md through lg; restore 2-col at xl (1280) where there's real room.
        */}
        <div className="grid items-start gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          <Field
            id={statusId}
            label="Status"
            required
            error={form.state.fieldErrors?.status}
          >
            <Select
              id={statusId}
              name="status"
              value={statusValue}
              disabled={form.isPending}
              hasError={Boolean(form.state.fieldErrors?.status)}
              onChange={(e) => {
                const next = e.currentTarget.value as BookingStatus;
                setStatusValue(next);
                form.recomputeDirty({ status: next });
              }}
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </Select>
          </Field>

          <Field
            id={paymentStatusId}
            label="Payment status"
            required
            error={form.state.fieldErrors?.payment_status}
          >
            <Select
              id={paymentStatusId}
              name="payment_status"
              value={paymentStatusValue}
              disabled={form.isPending}
              hasError={Boolean(form.state.fieldErrors?.payment_status)}
              onChange={(e) => {
                const next = e.currentTarget.value as typeof paymentStatusValue;
                setPaymentStatusValue(next);
                form.recomputeDirty({ payment_status: next });
              }}
            >
              <option value="unpaid">Outstanding</option>
              <option value="paid">Paid</option>
            </Select>
            {paidWithZero ? (
              <p
                role="status"
                aria-live="polite"
                className="rounded-[var(--admin-radius-control)] bg-[oklch(96.0%_0.038_75)] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-[oklch(28%_0.120_55)]"
              >
                Set the amount paid before marking this as paid.
              </p>
            ) : null}
          </Field>

          <Field
            id={paymentMethodId}
            label="Payment method"
            error={form.state.fieldErrors?.payment_method}
          >
            <PaymentMethodSelect
              id={paymentMethodId}
              value={form.paymentMethod}
              disabled={form.isPending}
              hasError={Boolean(form.state.fieldErrors?.payment_method)}
              onChange={(v) => {
                form.setPaymentMethod(v);
                form.recomputeDirty({ payment_method: v });
              }}
            />
          </Field>

          <Field
            id={amountPaidId}
            label="Amount paid"
            error={form.state.fieldErrors?.amount_paid}
          >
            <AmountPaidInput
              id={amountPaidId}
              value={form.amountPaid}
              disabled={form.isPending}
              hasError={Boolean(form.state.fieldErrors?.amount_paid)}
              onChange={(v) => {
                form.setAmountPaid(v);
                form.recomputeDirty({ amount_paid: v });
              }}
              total={total}
            />
          </Field>
        </div>

        <PaymentNoteDisclosure
          value={form.paymentNote}
          disabled={form.isPending}
          onChange={(v) => {
            form.setPaymentNote(v);
            form.recomputeDirty({ payment_note: v });
          }}
        />

        {/*
          The reopen reason's only render site. The confirm modal dismisses
          itself once `onConfirm` settles, so a rejection — client-side or the
          server's `completed_reversal_reason` — has to surface out here, beside
          the control that reopens the dialog.
        */}
        {form.state.fieldErrors?.completed_reversal_reason ? (
          <FormError
            message={form.state.fieldErrors.completed_reversal_reason}
          />
        ) : null}

        <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
          {reopeningCompleted ? (
            <ReopenCompletedModal
              targetStatus={statusValue}
              dirty={form.dirty}
              isPending={form.isPending}
              onConfirm={confirmReopen}
            />
          ) : (
            <StatusSaveButton dirty={form.dirty} isPending={form.isPending} />
          )}
        </div>
      </form>
    </AdminPanel>
  );
}


// ─── Shared notes form plumbing ───────────────────────────────────────────────

interface NotesFormState {
  isPending: boolean;
  state: BookingUpdateState;
  dirty: boolean;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  handleChange: (event: React.FormEvent<HTMLFormElement>) => void;
}

function useNotesForm(booking: BookingRecord): NotesFormState {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<BookingUpdateState>({});
  const [dirty, setDirty] = useState(false);

  const initial = useMemo(
    () => ({
      treatment_notes: booking.treatment_notes ?? "",
      admin_notes: booking.admin_notes ?? "",
      customer_manage_notes: booking.customer_manage_notes ?? "",
    }),
    [booking]
  );

  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const next = {
      treatment_notes: String(data.get("treatment_notes") ?? ""),
      admin_notes: String(data.get("admin_notes") ?? ""),
      customer_manage_notes: String(data.get("customer_manage_notes") ?? ""),
    };
    setDirty(
      next.treatment_notes !== initial.treatment_notes ||
        next.admin_notes !== initial.admin_notes ||
        next.customer_manage_notes !== initial.customer_manage_notes
    );
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateBookingManagement({}, formData);
      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) {
          toast.error("Couldn't save notes. Try again.", {
            duration: Infinity,
            action: {
              label: "Retry",
              onClick: () => submit(formData),
            },
          });
        }
        return;
      }
      setState({});
      setDirty(false);
      toast.success("Notes saved.");
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
  }

  return { isPending, state, dirty, handleSubmit, handleChange };
}

function HiddenStatusPayload({ booking }: { booking: BookingRecord }) {
  return (
    <>
      <input type="hidden" name="booking_id" value={booking.id} />
      <input type="hidden" name="status" value={booking.status} />
      <input type="hidden" name="payment_status" value={booking.payment_status} />
      <input
        type="hidden"
        name="payment_method"
        value={booking.payment_method ?? ""}
      />
      <input
        type="hidden"
        name="amount_paid"
        value={Number(booking.amount_paid ?? 0)}
      />
      <input
        type="hidden"
        name="payment_note"
        value={booking.payment_note ?? ""}
      />
    </>
  );
}

function NotesSaveButton({
  dirty,
  isPending,
}: {
  dirty: boolean;
  isPending: boolean;
}) {
  return (
    <AdminButton
      type="submit"
      variant="primary"
      loading={isPending}
      disabled={!dirty}
      aria-disabled={!dirty || isPending ? "true" : undefined}
      className={`min-h-11 sm:min-h-10 transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        !dirty ? "opacity-60" : "opacity-100"
      }`}
    >
      Save notes
    </AdminButton>
  );
}

// ─── Notes meta ───────────────────────────────────────────────────────────────

interface NoteMeta {
  key: "treatment_notes" | "admin_notes" | "customer_manage_notes";
  label: string;
  placeholder: string;
  hint: string;
}

const NOTE_FIELDS: NoteMeta[] = [
  {
    key: "treatment_notes",
    label: "Treatment notes",
    placeholder: "What you observed, what you treated, what you'd note for next time.",
    hint: "Clinical record.",
  },
  {
    key: "admin_notes",
    label: "Admin notes",
    placeholder: "Operational context, not shown to the client.",
    hint: "Operational. Hidden from the client.",
  },
  {
    key: "customer_manage_notes",
    label: "Customer notes",
    placeholder: "Anything the client should know before their visit.",
    hint: "Visible to the client.",
  },
];

// ─── Notes section: all three types at a glance, individually collapsible ─────


function initialNoteValues(booking: BookingRecord): Record<NoteMeta["key"], string> {
  return {
    treatment_notes: booking.treatment_notes ?? "",
    admin_notes: booking.admin_notes ?? "",
    customer_manage_notes: booking.customer_manage_notes ?? "",
  };
}

function defaultOpenSet(
  initial: Record<NoteMeta["key"], string>
): Set<NoteMeta["key"]> {
  const set = new Set<NoteMeta["key"]>();
  for (const field of NOTE_FIELDS) {
    if ((initial[field.key] ?? "").trim().length > 0) set.add(field.key);
  }
  return set;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0)" }}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function NotesSection({ booking }: { booking: BookingRecord }) {
  const { isPending, state, dirty, handleSubmit, handleChange } =
    useNotesForm(booking);
  const initial = useMemo(() => initialNoteValues(booking), [booking]);
  const [openKeys, setOpenKeys] = useState<Set<NoteMeta["key"]>>(() =>
    defaultOpenSet(initial)
  );

  function toggle(key: NoteMeta["key"]) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <AdminPanel title="Notes">
      <form
        id="booking-notes-form"
        onSubmit={handleSubmit}
        onChange={handleChange}
        className="grid gap-3"
      >
        <HiddenStatusPayload booking={booking} />
        {state.error ? <FormError message={state.error} /> : null}

        <div className="grid gap-2.5">
          {NOTE_FIELDS.map((field) => {
            const value = initial[field.key];
            const hasContent = value.trim().length > 0;
            const isOpen = openKeys.has(field.key);
            return (
              <section
                key={field.key}
                className="overflow-hidden rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)]"
              >
                <button
                  type="button"
                  onClick={() => toggle(field.key)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:px-4 ${
                    hasContent
                      ? "bg-[var(--admin-panel-muted)] hover:bg-[var(--admin-hover-mist)]"
                      : "bg-[var(--admin-panel)] hover:bg-[var(--admin-panel-muted)]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-2 shrink-0 rounded-full ${
                        hasContent
                          ? "bg-[var(--admin-primary)]"
                          : "bg-[var(--admin-border)]"
                      }`}
                    />
                    <span className="text-sm font-semibold text-[var(--admin-heading)]">
                      {field.label}
                    </span>
                    {!hasContent ? (
                      <span className="text-[0.6875rem] text-[var(--admin-text-muted)]">
                        Empty
                      </span>
                    ) : null}
                  </span>
                  <Chevron open={isOpen} />
                </button>
                <div hidden={!isOpen} className="border-t border-[var(--admin-border)] p-3 sm:p-4">
                  <p className="mb-2 text-[0.6875rem] text-[var(--admin-text-muted)]">
                    {field.hint}
                  </p>
                  <textarea
                    name={field.key}
                    rows={4}
                    placeholder={field.placeholder}
                    defaultValue={value}
                    disabled={isPending}
                    className={textareaClass(false)}
                    aria-label={field.label}
                  />
                </div>
                {!isOpen ? (
                  <input type="hidden" name={field.key} defaultValue={value} />
                ) : null}
              </section>
            );
          })}
        </div>

        <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-3">
          <NotesSaveButton dirty={dirty} isPending={isPending} />
        </div>
      </form>
    </AdminPanel>
  );
}


interface BookingNotesScopedFormProps {
  booking: BookingRecord;
  fields: Array<"treatment_notes" | "customer_manage_notes">;
}

/**
 * Therapist-scoped notes form: same submit contract as NotesSection,
 * but only renders the fields the therapist is allowed to edit.
 * Out-of-scope fields are still hidden inputs so the server action
 * doesn't null them (payment_status, etc. are sent at current values).
 */
export function BookingNotesScopedForm({
  booking,
  fields,
}: BookingNotesScopedFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<BookingUpdateState>({});
  const [dirty, setDirty] = useState(false);
  const treatmentId = useId();
  const customerId = useId();

  const initial = useMemo(
    () => ({
      treatment_notes: booking.treatment_notes ?? "",
      customer_manage_notes: booking.customer_manage_notes ?? "",
    }),
    [booking]
  );

  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const next = {
      treatment_notes: String(data.get("treatment_notes") ?? ""),
      customer_manage_notes: String(data.get("customer_manage_notes") ?? ""),
    };
    setDirty(
      next.treatment_notes !== initial.treatment_notes ||
        next.customer_manage_notes !== initial.customer_manage_notes
    );
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateBookingManagement({}, formData);
      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) {
          toast.error("Couldn't save notes. Try again.", {
            duration: Infinity,
            action: {
              label: "Retry",
              onClick: () => submit(formData),
            },
          });
        }
        return;
      }
      setState({});
      setDirty(false);
      toast.success("Notes saved.");
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
  }

  return (
    <AdminPanel title="Notes">
      <form
        id="booking-notes-form"
        onSubmit={handleSubmit}
        onChange={handleChange}
        className="grid gap-4"
      >
        <input type="hidden" name="booking_id" value={booking.id} />
        <input type="hidden" name="status" value={booking.status} />
        <input
          type="hidden"
          name="payment_status"
          value={booking.payment_status}
        />
        <input
          type="hidden"
          name="payment_method"
          value={booking.payment_method ?? ""}
        />
        <input
          type="hidden"
          name="amount_paid"
          value={Number(booking.amount_paid ?? 0)}
        />
        <input
          type="hidden"
          name="payment_note"
          value={booking.payment_note ?? ""}
        />
        <input
          type="hidden"
          name="admin_notes"
          value={booking.admin_notes ?? ""}
        />

        {state.error ? <FormError message={state.error} /> : null}

        {fields.includes("treatment_notes") ? (
          <Field id={treatmentId} label="Treatment notes">
            <textarea
              id={treatmentId}
              name="treatment_notes"
              rows={4}
              placeholder="What you observed, what you treated, what you'd note for next time."
              defaultValue={booking.treatment_notes ?? ""}
              disabled={isPending}
              className={textareaClass(false)}
            />
          </Field>
        ) : (
          <input
            type="hidden"
            name="treatment_notes"
            value={booking.treatment_notes ?? ""}
          />
        )}

        {fields.includes("customer_manage_notes") ? (
          <Field id={customerId} label="Customer notes">
            <textarea
              id={customerId}
              name="customer_manage_notes"
              rows={4}
              placeholder="Anything the client should know before their visit."
              defaultValue={booking.customer_manage_notes ?? ""}
              disabled={isPending}
              className={textareaClass(false)}
            />
          </Field>
        ) : (
          <input
            type="hidden"
            name="customer_manage_notes"
            value={booking.customer_manage_notes ?? ""}
          />
        )}

        <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
          <AdminButton
            type="submit"
            variant="primary"
            loading={isPending}
            disabled={!dirty}
            aria-disabled={!dirty || isPending ? "true" : undefined}
            className={`transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
              !dirty ? "opacity-60" : "opacity-100"
            }`}
          >
            Save notes
          </AdminButton>
        </div>
      </form>
    </AdminPanel>
  );
}

// ─── Shared field primitives (scoped to this file) ────────────────────────────

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-1.5 text-xs text-[oklch(26%_0.14_25)]"
        >
          <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Select({
  hasError,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }) {
  return (
    <select
      className={
        className ?? inputClass(Boolean(hasError))
      }
      {...props}
    />
  );
}

function inputClass(hasError: boolean, extra?: string) {
  return [
    // 44px height on mobile (WCAG 2.5.5 touch-target floor); 40px on sm+ (mouse-friendly density).
    "h-11 sm:h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50",
    hasError
      ? "border-[oklch(26%_0.14_25)]"
      : "border-[var(--admin-border-form)]",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function textareaClass(hasError: boolean) {
  return [
    "w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50",
    hasError
      ? "border-[oklch(26%_0.14_25)]"
      : "border-[var(--admin-border-form)]",
  ]
    .filter(Boolean)
    .join(" ");
}

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-3 text-sm text-[oklch(26%_0.14_25)]"
    >
      <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

