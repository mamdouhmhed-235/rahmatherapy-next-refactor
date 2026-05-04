"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimBookingAssignment } from "./actions";

interface ClaimAssignmentButtonProps {
  assignmentId: string;
}

export function ClaimAssignmentButton({
  assignmentId,
}: ClaimAssignmentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function handleClaim() {
    const formData = new FormData();
    formData.set("assignment_id", assignmentId);

    startTransition(async () => {
      const result = await claimBookingAssignment(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Assignment claimed");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={!hydrated || isPending}
      onClick={handleClaim}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <UserCheck className="size-4" />
      )}
      Claim assignment
    </Button>
  );
}
