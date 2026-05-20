"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { deleteService } from "./actions";

interface DeleteServiceButtonProps {
  serviceId: string;
  serviceName: string;
  hasHistoricalBookings?: boolean;
  /** When true the button is rendered as a destructive menu item inside AdminActionMenu. */
  asMenuItem?: boolean;
}

export function DeleteServiceButton({
  serviceId,
  serviceName,
  hasHistoricalBookings = false,
  asMenuItem = false,
}: DeleteServiceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleBlockedClick() {
    toast.error(
      "This service has booking history and can't be deleted. Deactivate it instead.",
      { duration: Infinity }
    );
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteService(serviceId);

      if (result.error) {
        toast.error(result.error, { duration: Infinity });
        return;
      }

      toast.success("Service deleted.");
      setOpen(false);
      router.refresh();
    });
  }

  // Guarded path: usage_count > 0 — no modal, just toast.
  if (hasHistoricalBookings) {
    return (
      <button
        type="button"
        onClick={handleBlockedClick}
        disabled
        aria-disabled="true"
        title="Has booking history — deactivate instead"
        className={
          asMenuItem
            ? "flex min-h-9 w-full cursor-not-allowed items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-sm font-medium text-[oklch(26%_0.14_25)]/45 opacity-70"
            : "inline-flex min-h-9 cursor-not-allowed items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-semibold text-[oklch(26%_0.14_25)]/45 opacity-70"
        }
      >
        <Trash2 className="size-4 shrink-0" aria-hidden="true" />
        Delete
      </button>
    );
  }

  const triggerClass = asMenuItem
    ? "flex min-h-9 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-sm font-medium text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
    : "inline-flex min-h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-semibold text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55";

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger
        render={
          <button type="button" className={triggerClass}>
            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
            Delete
          </button>
        }
      />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm" />
        <BaseDialog.Popup className="fixed left-1/2 top-[30vh] z-50 w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)]"
            >
              <XCircle
                className="size-5 text-[oklch(26%_0.14_25)]"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                Delete &ldquo;{serviceName}&rdquo;?
              </BaseDialog.Title>
              <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                Past bookings keep this service name on their record. New
                bookings won&rsquo;t be able to use it.
              </BaseDialog.Description>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
            <BaseDialog.Close
              disabled={isPending}
              render={
                <button
                  type="button"
                  disabled={isPending}
                  className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Keep it
                </button>
              }
            />
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              aria-busy={isPending || undefined}
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(40%_0.14_25)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[oklch(33%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none"
            >
              {isPending ? (
                <Loader2
                  className="size-4 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              Delete service
            </button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
