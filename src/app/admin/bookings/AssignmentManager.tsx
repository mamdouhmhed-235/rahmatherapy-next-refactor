"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCog, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateBookingAssignment } from "./actions";
import type { StaffAssignmentPreview } from "./assignment-eligibility";

interface AssignmentManagerProps {
  assignmentId: string;
  assignedStaffId: string | null;
  candidates: StaffAssignmentPreview[];
}

export function AssignmentManager({
  assignmentId,
  assignedStaffId,
  candidates,
}: AssignmentManagerProps) {
  const router = useRouter();
  const [staffId, setStaffId] = useState(assignedStaffId ?? "");
  const [isPending, startTransition] = useTransition();

  function submit(action: "assign" | "unassign") {
    const formData = new FormData();
    formData.set("assignment_id", assignmentId);
    formData.set("action", action);
    formData.set("staff_id", staffId);

    startTransition(async () => {
      const result = await updateBookingAssignment(formData);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(action === "unassign" ? "Assignment cleared" : "Assignment updated");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--rahma-border)] bg-white p-3">
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
          Assign eligible staff
        </span>
        <select
          value={staffId}
          onChange={(event) => setStaffId(event.target.value)}
          className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20"
        >
          <option value="">Choose staff</option>
          {candidates.map((candidate) => (
            <option
              key={candidate.staff.id}
              value={candidate.staff.id}
              disabled={!candidate.eligible}
            >
              {candidate.staff.name} - {candidate.reason}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !staffId}
          onClick={() => submit("assign")}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserCog className="size-4" />}
          Assign
        </Button>
        {assignedStaffId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => submit("unassign")}
          >
            <UserMinus className="size-4" />
            Unassign
          </Button>
        ) : null}
      </div>
    </div>
  );
}
