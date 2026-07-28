"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminButton } from "../components/admin-ui";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  quickUpdateBooking,
  updateOwnAssignmentStatus,
} from "./actions";

type BookingAction =
  | "confirm"
  | "mark_paid"
  | "cancel"
  | "complete"
  | "assignment_completed"
  | "assignment_no_show";

interface BookingActionButtonProps {
  bookingId?: string;
  assignmentId?: string;
  action: BookingAction;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  /**
   * "default" 40px / "sm" 32px / "touch" 44px on mobile collapsing to 32px on sm+
   * (the touch size is what mobile quick-action chips use to satisfy WCAG 2.5.5).
   */
  size?: "default" | "sm" | "touch";
  icon?: React.ReactNode;
  onSuccess?: () => void;
}

const SUCCESS_TOAST: Record<BookingAction, string> = {
  confirm: "Booking confirmed.",
  mark_paid: "Marked paid.",
  // C-04a Phase H — the client's cancellation email is queued, not sent, so
  // "has been notified" was false the moment `delaySeconds` landed. It is
  // drained by a minute-granular cron, so no number of seconds is true either:
  // "shortly" is the only honest word.
  //
  // This chip is deliberately the one cancel control WITHOUT an Undo action: the
  // row menu and the Status form both offer one where S6 leaves the booking
  // restorable, this component never does. It is
  // generic over six actions and has neither the booking's pre-cancel status nor
  // a place to put an action-specific toast option, so threading Undo through it
  // is a wider change than the Owner judged the inconsistency to be worth
  // (authorised 2026-07-28, copy only). Do not "fix" the asymmetry by guessing —
  // it is a decision, not an oversight.
  cancel: "Booking cancelled. The client will be emailed shortly.",
  complete: "Marked complete.",
  assignment_completed: "Marked complete.",
  assignment_no_show: "Marked as no-show.",
};

const CONFIRM_COPY: Partial<
  Record<BookingAction, { title: string; description: string; confirmLabel: string; cancelLabel: string }>
> = {
  cancel: {
    title: "Cancel this booking?",
    // The "cannot be undone" half was made false by Phase H — a cancellation is
    // undoable through Restore. See the note on SUCCESS_TOAST.cancel above.
    description: "The client will be emailed shortly after you confirm.",
    confirmLabel: "Cancel booking",
    cancelLabel: "Keep it",
  },
  assignment_no_show: {
    title: "Mark this booking as no-show?",
    description:
      "The booking will be recorded as a no-show. This still counts as a completed slot for your records.",
    confirmLabel: "Mark no-show",
    cancelLabel: "Cancel",
  },
};

export function BookingActionButton({
  bookingId,
  assignmentId,
  action,
  children,
  variant = "ghost",
  size = "sm",
  icon,
  onSuccess,
}: BookingActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const confirmCopy = CONFIRM_COPY[action];
  const [error, setError] = useState<string | null>(null);
  // "touch" maps to the sm shape but with a 44px floor on mobile.
  const adminButtonSize = size === "touch" ? "sm" : size;
  const touchClass =
    size === "touch" ? "min-h-11 sm:min-h-8 w-full sm:w-auto" : undefined;

  function runAction() {
    setError(null);
    const formData = new FormData();
    if (action === "assignment_completed" || action === "assignment_no_show") {
      if (assignmentId) formData.set("assignment_id", assignmentId);
      formData.set(
        "status",
        action === "assignment_completed" ? "completed" : "no_show"
      );
    } else {
      if (bookingId) formData.set("booking_id", bookingId);
      formData.set("action", action);
    }

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result =
          action === "assignment_completed" || action === "assignment_no_show"
            ? await updateOwnAssignmentStatus(formData)
            : await quickUpdateBooking(formData);

        if ("error" in result && result.error) {
          setError(result.error);
          toast.error(result.error);
          resolve();
          return;
        }

        toast.success(SUCCESS_TOAST[action]);
        router.refresh();
        onSuccess?.();
        resolve();
      });
    });
  }

  if (confirmCopy) {
    return (
      <ConfirmActionModal
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        cancelLabel={confirmCopy.cancelLabel}
        destructive
        onConfirm={runAction}
        trigger={
          <AdminButton
            variant={variant}
            size={adminButtonSize}
            icon={icon}
            loading={isPending}
            className={touchClass}
            aria-label={typeof children === "string" ? children : undefined}
          >
            {children}
          </AdminButton>
        }
      >
        {error ? (
          <div
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2 text-sm text-[oklch(26%_0.14_25)]"
          >
            {error}
          </div>
        ) : null}
      </ConfirmActionModal>
    );
  }

  return (
    <AdminButton
      variant={variant}
      size={adminButtonSize}
      icon={icon}
      loading={isPending}
      className={touchClass}
      onClick={runAction}
    >
      {children}
    </AdminButton>
  );
}
