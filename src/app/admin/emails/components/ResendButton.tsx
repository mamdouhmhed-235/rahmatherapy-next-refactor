"use client";

// C-08 Phase C — per-row Resend on the Delivery tab (brief §2.6, plan §1
// Step 9). Follows BookingActionButton.tsx's established pattern
// (useTransition + ConfirmActionModal + toast-on-resolution) rather than the
// plan's own useActionState sketch, whose `if (state?.ok) toast.success(...)`
// fired on every render, not just on a real transition — not shippable as
// written.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmActionModal } from "../../components/admin-ui-interactions";
import { resendEmail } from "../actions";

interface ResendButtonProps {
  deliveryEventId: string;
  eventTypeLabel: string;
  recipientEmail: string;
}

export function ResendButton({
  deliveryEventId,
  eventTypeLabel,
  recipientEmail,
}: ResendButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function runResend() {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.set("delivery_event_id", deliveryEventId);
        const result = await resendEmail(formData);

        if (!result.ok) {
          toast.error(result.error ?? "Resend failed.");
          resolve();
          return;
        }

        toast.success(`Resent to ${recipientEmail}.`);
        router.refresh();
        resolve();
      });
    });
  }

  return (
    <ConfirmActionModal
      title="Resend this email?"
      description={`A new copy of "${eventTypeLabel}" will be sent to ${recipientEmail} using the current template settings. The original send is preserved.`}
      confirmLabel="Resend"
      cancelLabel="Cancel"
      destructive={false}
      onConfirm={runResend}
      trigger={
        <button
          type="button"
          disabled={isPending}
          aria-busy={isPending || undefined}
          aria-label={`Resend ${eventTypeLabel} to ${recipientEmail}`}
          title={`Resend ${eventTypeLabel} to ${recipientEmail}`}
          className={cn(
            "inline-flex h-9 sm:h-8 min-h-9 sm:min-h-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50",
            isPending && "cursor-progress"
          )}
        >
          <Repeat2 className={cn("size-3.5", isPending && "animate-spin")} aria-hidden="true" />
          <span className="hidden sm:inline">Resend</span>
        </button>
      }
    />
  );
}
