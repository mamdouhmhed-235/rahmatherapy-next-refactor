"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { firstName } from "./format";
import { sendManualBookingReminder } from "./actions";

interface ReminderResendFormProps {
  bookingId: string;
  contactFullName: string | null;
  hasRecipient: boolean;
}

// The hidden `booking_id` input and the `<form action={sendManualBookingReminder}>`
// wire-up are RECON §6.4 untouchable contracts — they MUST stay verbatim. The
// optimistic state is layered around the form, never replaces it.
//
// Note: `sendManualBookingReminder` (untouchable per RECON §5) returns void on
// both success and failure paths. The client can't distinguish them from the
// returned value alone, so the optimistic state below treats action completion
// as success unless the action throws. A thrown action triggers the failure
// toast — wired here for completeness even though the current server contract
// swallows the throw. Marked FAKE-FAILURE-PATH for the same reason.
export function ReminderResendForm({
  bookingId,
  contactFullName,
  hasRecipient,
}: ReminderResendFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle"
  );
  const formRef = useRef<HTMLFormElement>(null);
  const name = firstName(contactFullName);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setOutcome("sending");
    startTransition(async () => {
      try {
        const data = new FormData(form);
        await sendManualBookingReminder(data);
        setOutcome("sent");
        toast.success(`Reminder sent to ${name}.`);
        // Brief §6: "Last reminder" sub-line updates without a full reload.
        // revalidatePath inside the server action invalidates the route cache,
        // and router.refresh() re-fetches the server-rendered data so the
        // "Last reminder" line on this row picks up the new event.
        router.refresh();
      } catch {
        // FAKE-FAILURE-PATH: the untouchable server action does not currently
        // throw — it swallows errors via the operational-events log. When that
        // contract evolves (or a network failure surfaces), this branch fires.
        setOutcome("failed");
        toast.error(
          `Couldn't send to ${name}. Try again or check the email address.`,
          {
            duration: Number.POSITIVE_INFINITY,
            action: {
              label: "Retry",
              onClick: () => formRef.current?.requestSubmit(),
            },
          }
        );
      }
    });
  };

  // Missing-recipient row: the brief specifies the resend button is hidden and
  // an Attention chip replaces it (rendered by the parent). Keep the form
  // mounted so the booking_id contract test still finds the hidden input.
  if (!hasRecipient) {
    return (
      <form
        ref={formRef}
        action={sendManualBookingReminder}
        className="hidden"
        aria-hidden="true"
      >
        <input type="hidden" name="booking_id" value={bookingId} />
      </form>
    );
  }

  const sending = isPending || outcome === "sending";
  const sent = outcome === "sent";

  return (
    <form
      ref={formRef}
      action={sendManualBookingReminder}
      onSubmit={handleSubmit}
      className="w-full sm:w-auto"
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={sending}
        aria-busy={sending || undefined}
        aria-label={`Send reminder to ${name}`}
        title={`Send the reminder template to ${name}`}
        className={cn(
          "inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold outline-none transition-colors duration-150 sm:w-auto",
          "focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
          sent
            ? "bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)] border border-[oklch(70%_0.10_155)]"
            : "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-hover)]",
          sending && "cursor-progress opacity-90"
        )}
      >
        {sending ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            <span>Sending…</span>
          </>
        ) : sent ? (
          <>
            <Send className="size-4 shrink-0" aria-hidden="true" />
            <span>Sent</span>
          </>
        ) : (
          <>
            <Send className="size-4 shrink-0" aria-hidden="true" />
            <span>Send reminder</span>
          </>
        )}
      </button>
    </form>
  );
}
