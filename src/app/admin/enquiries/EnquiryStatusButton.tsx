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
  destructive?: boolean;
  className?: string;
}

export function EnquiryStatusButton({
  enquiryId,
  status,
  children,
  successMessage,
  errorMessage = "Couldn't update that one. Try again.",
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
          toast.success(successMessage);
        });
      }}
      className={cn(
        "inline-flex h-9 min-h-11 sm:min-h-9 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:cursor-not-allowed",
        destructive
          ? "text-[oklch(26%_0.14_25)] hover:bg-[oklch(95.5%_0.028_20)]"
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
