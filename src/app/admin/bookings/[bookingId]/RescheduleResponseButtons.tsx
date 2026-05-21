"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminButton } from "../../components/admin-ui";
import { respondToCustomerReschedule } from "../actions";

// H4 reschedule response buttons. Client-component + useTransition pattern
// mirrors emails/ReminderResendForm.tsx — direct invocation of the imported
// server action sidesteps a Turbopack regression where raw
// `<form action={serverAction}>` in Server Components renders the
// `$ACTION_ID_*` hidden input with no value, so the form POSTs but no
// action ever dispatches. Direct call from a transition works reliably.
export function RescheduleResponseButtons({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const respond = (decision: "reviewed" | "declined") => {
    const formData = new FormData();
    formData.set("booking_id", bookingId);
    formData.set("decision", decision);
    startTransition(async () => {
      try {
        await respondToCustomerReschedule(formData);
        toast.success(
          decision === "reviewed"
            ? "Reschedule request accepted."
            : "Reschedule request declined."
        );
        router.refresh();
      } catch {
        toast.error("Couldn't update the reschedule request. Try again.", {
          duration: Number.POSITIVE_INFINITY,
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminButton
        type="button"
        variant="primary"
        size="sm"
        loading={isPending}
        disabled={isPending}
        onClick={() => respond("reviewed")}
      >
        Accept request
      </AdminButton>
      <AdminButton
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => respond("declined")}
      >
        Decline request
      </AdminButton>
    </div>
  );
}
