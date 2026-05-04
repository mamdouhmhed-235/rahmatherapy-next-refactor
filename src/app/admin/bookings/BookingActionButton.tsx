"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  quickUpdateBooking,
  updateOwnAssignmentStatus,
} from "./actions";

interface BookingActionButtonProps {
  bookingId?: string;
  assignmentId?: string;
  action: "confirm" | "mark_paid" | "cancel" | "complete" | "assignment_completed" | "assignment_no_show";
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

export function BookingActionButton({
  bookingId,
  assignmentId,
  action,
  children,
  variant = "outline",
}: BookingActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAction() {
    const formData = new FormData();

    startTransition(async () => {
      const result =
        action === "assignment_completed" || action === "assignment_no_show"
          ? await updateOwnAssignmentStatus(
              withAssignmentData(formData, assignmentId, action)
            )
          : await quickUpdateBooking(withBookingData(formData, bookingId, action));

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Booking updated");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={isPending}
      onClick={handleAction}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

function withBookingData(
  formData: FormData,
  bookingId: string | undefined,
  action: BookingActionButtonProps["action"]
) {
  if (bookingId) formData.set("booking_id", bookingId);
  formData.set("action", action);
  return formData;
}

function withAssignmentData(
  formData: FormData,
  assignmentId: string | undefined,
  action: BookingActionButtonProps["action"]
) {
  if (assignmentId) formData.set("assignment_id", assignmentId);
  formData.set(
    "status",
    action === "assignment_completed" ? "completed" : "no_show"
  );
  return formData;
}
