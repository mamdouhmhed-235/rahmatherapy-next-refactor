"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addCustomerManageNote,
  requestCustomerCancellation,
  requestCustomerReschedule,
  type CustomerManageActionState,
} from "./actions";

const initialState: CustomerManageActionState = {};

interface ManageBookingFormsProps {
  token: string;
  cancellationAllowed: boolean;
  cancellationReason: string | null;
  rescheduleDisabled: boolean;
}

export function ManageBookingForms({
  token,
  cancellationAllowed,
  cancellationReason,
  rescheduleDisabled,
}: ManageBookingFormsProps) {
  const [noteState, noteAction, notePending] = useActionState(
    addCustomerManageNote,
    initialState
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    requestCustomerCancellation,
    initialState
  );
  const [rescheduleState, rescheduleAction, reschedulePending] =
    useActionState(requestCustomerReschedule, initialState);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <CustomerForm
        title="Add a note"
        description="Share a safe update for the team before your appointment."
        action={noteAction}
        state={noteState}
      >
        <input type="hidden" name="token" value={token} />
        <Textarea name="note" rows={5} maxLength={1000} required />
        <SubmitButton pending={notePending}>Save note</SubmitButton>
      </CustomerForm>

      <CustomerForm
        title="Request cancellation"
        description={
          cancellationAllowed
            ? "This will cancel the current booking request."
            : cancellationReason ?? "This booking cannot be cancelled online."
        }
        action={cancelAction}
        state={cancelState}
      >
        <input type="hidden" name="token" value={token} />
        <Textarea
          name="note"
          rows={5}
          maxLength={1000}
          placeholder="Optional reason or note"
          disabled={!cancellationAllowed}
        />
        <SubmitButton pending={cancelPending} disabled={!cancellationAllowed}>
          Cancel booking
        </SubmitButton>
      </CustomerForm>

      <CustomerForm
        title="Request reschedule"
        description="Suggest a preferred new date and time; the booking is not moved until the team confirms."
        action={rescheduleAction}
        state={rescheduleState}
      >
        <input type="hidden" name="token" value={token} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              Preferred date
            </span>
            <Input
              name="preferred_date"
              type="date"
              required
              disabled={rescheduleDisabled}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              Preferred time
            </span>
            <Input
              name="preferred_time"
              type="time"
              required
              disabled={rescheduleDisabled}
            />
          </label>
        </div>
        <Textarea
          name="note"
          rows={4}
          maxLength={1000}
          placeholder="Optional note"
          disabled={rescheduleDisabled}
        />
        <SubmitButton pending={reschedulePending} disabled={rescheduleDisabled}>
          Send request
        </SubmitButton>
      </CustomerForm>
    </div>
  );
}

function CustomerForm({
  title,
  description,
  action,
  state,
  children,
}: {
  title: string;
  description: string;
  action: (payload: FormData) => void;
  state: CustomerManageActionState;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className="rounded-2xl border bg-white p-5"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[var(--rahma-muted)]">
        {description}
      </p>
      <div className="mt-4 grid gap-3">{children}</div>
      {state.error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

function SubmitButton({
  pending,
  disabled = false,
  children,
}: {
  pending: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
