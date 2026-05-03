"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  updateBookingManagement,
  type BookingUpdateState,
} from "./actions";
import type { BookingRecord } from "./types";

interface BookingManagementFormProps {
  booking: BookingRecord;
}

const selectClass =
  "h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20";

export function BookingManagementForm({ booking }: BookingManagementFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<BookingUpdateState>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBookingManagement({}, formData);

      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) toast.error(result.error);
        return;
      }

      setState({});
      toast.success("Booking updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-6"
      style={{ borderColor: "var(--rahma-border)", boxShadow: "var(--shadow-soft-token)" }}>
      <input type="hidden" name="booking_id" value={booking.id} />

      <div className="mb-5">
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Lifecycle &amp; Payment
        </h2>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          Update the appointment status, payment record, and back-office notes.
        </p>
      </div>

      {state.error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Booking status" error={state.fieldErrors?.status}>
          <select
            name="status"
            defaultValue={booking.status}
            disabled={isPending}
            className={selectClass}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No show</option>
          </select>
        </Field>

        <Field
          label="Payment status"
          error={state.fieldErrors?.payment_status}
        >
          <select
            name="payment_status"
            defaultValue={booking.payment_status}
            disabled={isPending}
            className={selectClass}
          >
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </Field>

        <Field
          label="Payment method"
          error={state.fieldErrors?.payment_method}
        >
          <select
            name="payment_method"
            defaultValue={booking.payment_method ?? ""}
            disabled={isPending}
            className={selectClass}
          >
            <option value="">Not set</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </Field>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Treatment notes">
          <Textarea
            name="treatment_notes"
            rows={5}
            defaultValue={booking.treatment_notes ?? ""}
            disabled={isPending}
          />
        </Field>

        <Field label="Admin notes">
          <Textarea
            name="admin_notes"
            rows={5}
            defaultValue={booking.admin_notes ?? ""}
            disabled={isPending}
          />
        </Field>

        <Field label="Customer manage notes">
          <Textarea
            name="customer_manage_notes"
            rows={5}
            defaultValue={booking.customer_manage_notes ?? ""}
            disabled={isPending}
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save booking
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
        {label}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
