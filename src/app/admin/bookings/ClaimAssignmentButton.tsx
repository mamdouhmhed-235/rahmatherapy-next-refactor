"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminButton } from "../components/admin-ui";
import { claimBookingAssignment } from "./actions";

interface ClaimAssignmentButtonProps {
  assignmentId: string;
}

export function ClaimAssignmentButton({
  assignmentId,
}: ClaimAssignmentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticClaimed, setOptimisticClaimed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function handleClaim() {
    setOptimisticClaimed(true);
    const formData = new FormData();
    formData.set("assignment_id", assignmentId);

    startTransition(async () => {
      const result = await claimBookingAssignment(formData);

      if (result.error) {
        setOptimisticClaimed(false);
        const raceLost = /already|claim/i.test(result.error);
        toast.error(
          raceLost
            ? "Someone else just claimed this one. Refresh to see the latest."
            : "Couldn't claim this booking. Try again.",
          { duration: raceLost ? Infinity : 6000 }
        );
        return;
      }

      toast.success("Booking claimed.");
      router.refresh();
    });
  }

  if (optimisticClaimed) {
    return (
      <AdminButton
        variant="primary"
        size="sm"
        disabled
        aria-busy
        icon={
          isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ClaimMark />
          )
        }
      >
        Claimed
      </AdminButton>
    );
  }

  return (
    <AdminButton
      variant="primary"
      size="sm"
      disabled={!hydrated || isPending}
      onClick={handleClaim}
      icon={<UserCheck className="size-4" aria-hidden="true" />}
    >
      Claim this booking
    </AdminButton>
  );
}

/**
 * One-shot scale-in + fade for the optimistic check icon.
 * Fires once on mount (i.e. once per claim), respects prefers-reduced-motion.
 * Animates transform + opacity only (per shared motion law: no layout props).
 */
function ClaimMark() {
  const ref = useRef<HTMLSpanElement>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setPlayed(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="inline-flex items-center justify-center transition-[opacity,transform] duration-[240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:!opacity-100 motion-reduce:!scale-100"
      style={{
        opacity: played ? 1 : 0,
        transform: played ? "scale(1)" : "scale(0.85)",
      }}
    >
      <CheckCircle2 className="size-4" />
    </span>
  );
}
