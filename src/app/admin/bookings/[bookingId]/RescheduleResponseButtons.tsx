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
        // ⛔ G-08-02 — the success toast used to fire on ANY resolution, and the
        // action returned `void` on all five of its refusal paths. So a refused
        // save told staff it had worked, wrote nothing, and left the customer's
        // request unanswered with nobody aware. The action now returns a result;
        // this checks it BEFORE claiming success.
        //
        // ⚠️ The server's own message is shown rather than a generic one: "this
        // has already been answered" and "insufficient permissions" call for
        // completely different reactions from the person at the desk, and
        // "Try again" would be wrong advice for both.
        const result = await respondToCustomerReschedule(formData);

        if (result?.error) {
          toast.error(result.error, { duration: Number.POSITIVE_INFINITY });
          // ⛔ Refresh anyway: the commonest refusal is "already answered",
          // which means the screen in front of them is stale.
          router.refresh();
          return;
        }

        toast.success(
          decision === "reviewed"
            ? "Reschedule request accepted."
            : "Reschedule request declined."
        );
        router.refresh();
      } catch {
        // Still reachable for a transport-level failure (the action never
        // returning at all), which no result object can describe.
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
