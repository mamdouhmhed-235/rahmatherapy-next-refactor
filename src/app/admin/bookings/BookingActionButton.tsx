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
}

const SUCCESS_TOAST: Record<BookingAction, string> = {
  confirm: "Booking confirmed.",
  mark_paid: "Marked paid.",
  cancel: "Booking cancelled. The client has been notified.",
  complete: "Marked complete.",
  assignment_completed: "Marked complete.",
  assignment_no_show: "Marked as no-show.",
};

const CONFIRM_COPY: Partial<
  Record<BookingAction, { title: string; description: string; confirmLabel: string; cancelLabel: string }>
> = {
  cancel: {
    title: "Cancel this booking?",
    description:
      "The client will be notified by email. This cannot be undone from the booking page.",
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
