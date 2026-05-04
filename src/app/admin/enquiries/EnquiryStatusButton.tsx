"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateEnquiryStatus } from "./actions";

export function EnquiryStatusButton({
  enquiryId,
  status,
  children,
}: {
  enquiryId: string;
  status: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("enquiry_id", enquiryId);
        formData.set("status", status);
        startTransition(async () => {
          const result = await updateEnquiryStatus(formData);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Enquiry updated");
        });
      }}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--rahma-border)] bg-white px-2.5 text-xs font-semibold text-[var(--rahma-charcoal)] transition-colors hover:bg-[var(--rahma-ivory)] disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : null}
      {children}
    </button>
  );
}
