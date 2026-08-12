"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateEnquiryStatus } from "./actions";

interface EnquiryStatusButtonProps {
  enquiryId: string;
  status: "contacted" | "closed" | "new";
  children: React.ReactNode;
  successMessage: string;
  errorMessage?: string;
  /** Allow Undo toast (default true). Set false for terminal transitions
   *  where reverting would surprise the user (e.g. confirming a deletion). */
  undoable?: boolean;
  destructive?: boolean;
  className?: string;
}

export function EnquiryStatusButton({
  enquiryId,
  status,
  children,
  successMessage,
  errorMessage = "Couldn't update that one. Try again.",
  undoable = true,
  destructive = false,
  className,
}: EnquiryStatusButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("enquiry_id", enquiryId);
        formData.set("status", status);
        startTransition(async () => {
          const result = await updateEnquiryStatus(formData);
          if (result?.error) {
            toast.error(errorMessage, {
              duration: Infinity,
              action: {
                label: "Retry",
                onClick: () => {
                  startTransition(async () => {
                    const retry = await updateEnquiryStatus(formData);
                    if (retry?.error) {
                      toast.error(errorMessage, { duration: Infinity });
                    } else {
                      toast.success(successMessage);
                    }
                  });
                },
              },
            });
            return;
          }
          // Sonner success with Undo when the previous status round-trips
          // back through the same endpoint (the action is its own inverse).
          const previousStatus = result?.previousStatus;
          if (undoable && previousStatus && previousStatus !== status) {
            toast.success(successMessage, {
              duration: 5000,
              action: {
                label: "Undo",
                onClick: () => {
                  const undoForm = new FormData();
                  undoForm.set("enquiry_id", enquiryId);
                  undoForm.set("status", previousStatus);
                  startTransition(async () => {
                    const undoResult = await updateEnquiryStatus(undoForm);
                    if (undoResult?.error) {
                      toast.error("Couldn't undo. Try again manually.");
                    } else {
                      toast.info("Reverted.");
                    }
                  });
                },
              },
            });
            return;
          }
          toast.success(successMessage);
        });
      }}
      className={cn(
        "inline-flex h-9 min-h-11 sm:min-h-9 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:cursor-not-allowed",
        destructive
          ? "text-[var(--admin-status-cancelled-text)] hover:bg-[var(--admin-status-cancelled-bg)]"
          : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]",
        className
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
