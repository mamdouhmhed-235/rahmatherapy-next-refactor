"use client";

import {
  useId,
  useMemo,
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
import { BookingActionButton } from "./BookingActionButton";
import {
  updateBookingManagement,
  type BookingUpdateState,
} from "./actions";
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

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateBookingManagement({}, formData);
      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) {
          toast.error("Couldn't save changes. Try again.", {
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
      toast.success("Booking updated.");
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
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

const QUICK_ACTIONS: QuickActionDescriptor[] = [
  {
    action: "confirm",
    pendingLabel: "Confirm booking",
    doneLabel: "Confirmed",
    isDone: (b) =>
      b.status === "confirmed" ||
      b.status === "completed" ||
      b.status === "cancelled",
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
    isDone: (b) => b.status === "completed",
  },
  {
    action: "cancel",
    pendingLabel: "Cancel booking",
    doneLabel: "Cancelled",
    isDone: (b) => b.status === "cancelled",
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
      Save status &amp; payment
    </AdminButton>
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
  const statusId = useId();
  const paymentStatusId = useId();
  const paymentMethodId = useId();
  const amountPaidId = useId();
  const total = Number(booking.total_price ?? 0);
  const [paymentStatusValue, setPaymentStatusValue] = useState(
    booking.payment_status
  );
  const paidWithZero =
    paymentStatusValue === "paid" && Number(form.amountPaid) === 0;

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
                    ? "bg-[var(--admin-primary)] text-white"
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
              defaultValue={booking.status}
              disabled={form.isPending}
              hasError={Boolean(form.state.fieldErrors?.status)}
              onChange={(e) =>
                form.recomputeDirty({ status: e.currentTarget.value })
              }
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

        <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
          <StatusSaveButton dirty={form.dirty} isPending={form.isPending} />
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

