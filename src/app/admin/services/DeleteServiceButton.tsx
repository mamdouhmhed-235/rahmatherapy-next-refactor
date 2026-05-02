"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteService } from "./actions";

interface DeleteServiceButtonProps {
  serviceId: string;
  serviceName: string;
}

export function DeleteServiceButton({
  serviceId,
  serviceName,
}: DeleteServiceButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const result = await deleteService(serviceId);

      if (result.error) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }

      toast.success(`${serviceName} deleted`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      {confirming ? "Confirm" : "Delete"}
    </button>
  );
}
