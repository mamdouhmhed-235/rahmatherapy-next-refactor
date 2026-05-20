"use client";

import { forwardRef, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  updatePrivacyRequestStatus,
  type PrivacyActionState,
} from "./actions";

const initialState: PrivacyActionState = {};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Received" },
  { value: "reviewing", label: "Reviewing" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "Received",
  reviewing: "Reviewing",
  completed: "Completed",
  declined: "Declined",
};

function isDestructive(value: string) {
  return value === "completed" || value === "declined";
}

export function PrivacyStatusForm({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updatePrivacyRequestStatus,
    initialState
  );
  const [selectedStatus, setSelectedStatus] = useState(status);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmittedRef = useRef<string | null>(null);

  // Reset local state when server confirms the new value (so the select tracks the row's true status).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedStatus(status);
  }, [status]);

  // Surface success / failure as Sonner toasts, then refresh to migrate the row.
  useEffect(() => {
    if (state.success && lastSubmittedRef.current) {
      const label = STATUS_LABEL[lastSubmittedRef.current] ?? lastSubmittedRef.current;
      toast.success(`Request marked ${label.toLowerCase()}.`);
      lastSubmittedRef.current = null;
      router.refresh();
    } else if (state.error) {
      toast.error("Couldn't update the request. Try again.", {
        duration: Infinity,
        action: {
          label: "Retry",
          onClick: () => formRef.current?.requestSubmit(),
        },
      });
      lastSubmittedRef.current = null;
    }
  }, [state, router]);

  const unchanged = selectedStatus === status;
  const destructive = isDestructive(selectedStatus);
  const selectClass = cn(
    "h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
    state.error
      ? "border-[oklch(26%_0.14_25)]"
      : "border-[var(--admin-border-form)]"
  );

  // Used to remember which status we just dispatched so the success toast can name it.
  function rememberSubmission() {
    lastSubmittedRef.current = selectedStatus;
  }

  // Live region announcement target (for pending state when SR users want feedback).
  const liveMessage = pending
    ? `Saving request status to ${STATUS_LABEL[selectedStatus] ?? selectedStatus}.`
    : "";

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending || undefined}
      onSubmit={rememberSubmission}
      className="grid gap-3 rounded-[var(--admin-radius-card)] bg-[var(--admin-panel-muted)]/55 p-3 sm:p-4"
    >
      <input type="hidden" name="request_id" value={requestId} />

      <div className="grid gap-1.5">
        <label
          htmlFor={`privacy-status-${requestId}`}
          className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]"
        >
          Status
          <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
            *
          </span>
        </label>
        <select
          id={`privacy-status-${requestId}`}
          name="status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {destructive ? (
          <ConfirmActionModal
            title={
              selectedStatus === "completed"
                ? "Mark request as completed?"
                : "Decline this request?"
            }
            description={
              selectedStatus === "completed"
                ? "Confirm you've reviewed booking and audit-log integrity before finalising deletion or anonymisation. The customer will get a confirmation email."
                : "The customer keeps the right to escalate to the ICO. Make sure the reason is recorded in the request note or client notes."
            }
            confirmLabel={
              selectedStatus === "completed" ? "Mark completed" : "Decline"
            }
            cancelLabel="Cancel"
            destructive={selectedStatus === "declined"}
            onConfirm={() => {
              rememberSubmission();
              formRef.current?.requestSubmit();
            }}
            trigger={<SaveStatusButton pending={pending} unchanged={unchanged} />}
          />
        ) : (
          <SaveStatusButton type="submit" pending={pending} unchanged={unchanged} />
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </form>
  );
}

const SaveStatusButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    pending: boolean;
    unchanged: boolean;
  }
>(function SaveStatusButton({ pending, unchanged, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={pending || unchanged}
      {...rest}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none",
        "bg-[var(--admin-primary)] hover:bg-[var(--admin-primary-hover)]"
      )}
    >
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : null}
      Save status
    </button>
  );
});
