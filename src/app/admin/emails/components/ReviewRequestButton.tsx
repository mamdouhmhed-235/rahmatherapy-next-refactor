"use client";

// Item 1 Batch B — the manual review-request send on the Review requests tab
// (plan §1.7, Owner decision 7).
//
// Modelled on ResendButton.tsx, not ReminderResendForm.tsx, for two reasons:
// the underlying action returns `{ ok, error }` rather than void (so the
// failure path is real, not ReminderResendForm's documented
// FAKE-FAILURE-PATH), and a review request is a ONE-SHOT — `sendReviewRequestEmail`
// writes the `review_email_sent_at` sentinel, so a mis-click permanently
// retires that booking's review request. That earns a confirmation step, the
// same as the per-row resend.
//
// Building the FormData in JS rather than rendering a hidden input also keeps
// this immune to the ABSENT-vs-EMPTY class: there is no conditionally-rendered
// field that could be dropped from the payload.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmActionModal } from "../../components/admin-ui-interactions";
import { firstName } from "../format";
import { sendManualReviewRequest } from "../actions";

interface ReviewRequestButtonProps {
  bookingId: string;
  contactFullName: string | null;
  recipientEmail: string;
}

export function ReviewRequestButton({
  bookingId,
  contactFullName,
  recipientEmail,
}: ReviewRequestButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const name = firstName(contactFullName);

  function runSend() {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.set("booking_id", bookingId);
        const result = await sendManualReviewRequest(formData);

        if (!result.ok) {
          toast.error(result.error ?? "Couldn't send the review request.");
          resolve();
          return;
        }

        toast.success(`Review request sent to ${name}.`);
        router.refresh();
        resolve();
      });
    });
  }

  return (
    <ConfirmActionModal
      title="Send this review request?"
      description={`${name} will get the review-request email at ${recipientEmail}. Only one review request is ever sent per booking, so this booking won't appear here again.`}
      confirmLabel="Send request"
      cancelLabel="Cancel"
      destructive={false}
      onConfirm={runSend}
      trigger={
        <button
          type="button"
          disabled={isPending}
          aria-busy={isPending || undefined}
          aria-label={`Send a review request to ${name}`}
          title={`Send the review-request template to ${name}`}
          className={cn(
            "inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 sm:w-auto",
            isPending && "cursor-progress"
          )}
        >
          <Star className={cn("size-4 shrink-0", isPending && "animate-spin")} aria-hidden="true" />
          <span>Send request</span>
        </button>
      }
    />
  );
}
