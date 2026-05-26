"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCog, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminButton } from "../components/admin-ui";
import {
  AdminSheet,
  ConfirmActionModal,
} from "../components/admin-ui-interactions";
import { updateBookingAssignment } from "./actions";
import type { StaffAssignmentPreview } from "./assignment-eligibility";

interface AssignmentManagerProps {
  assignmentId: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  candidates: StaffAssignmentPreview[];
}

export function AssignmentManager({
  assignmentId,
  assignedStaffId,
  assignedStaffName,
  candidates,
}: AssignmentManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const eligibleOnly = useMemo(
    () => candidates.filter((candidate) => candidate.eligible),
    [candidates]
  );
  const visibleCandidates = showAll ? candidates : eligibleOnly;
  const hasIneligible = candidates.length > eligibleOnly.length;

  function submit(action: "assign" | "unassign", staffId: string) {
    const formData = new FormData();
    formData.set("assignment_id", assignmentId);
    formData.set("action", action);
    formData.set("staff_id", staffId);

    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await updateBookingAssignment(formData);
        if ("error" in result && result.error) {
          toast.error(result.error);
          resolve();
          return;
        }

        toast.success(
          action === "unassign"
            ? "Assignment removed. Anyone eligible can claim it."
            : "Assignment updated."
        );
        router.refresh();
        resolve();
      });
    });
  }

  const reassignTrigger = (
    <AdminButton
      variant="ghost"
      size="sm"
      className="min-h-11 sm:min-h-8"
      icon={
        assignedStaffId ? (
          <UserCog className="size-4" aria-hidden="true" />
        ) : (
          <UserPlus className="size-4" aria-hidden="true" />
        )
      }
    >
      {assignedStaffId ? "Reassign" : "Assign therapist"}
    </AdminButton>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminSheet
        title={assignedStaffId ? "Reassign this booking" : "Assign a therapist"}
        description={
          assignedStaffId
            ? `Currently assigned to ${assignedStaffName ?? "a therapist"}.`
            : "Pick from therapists matched to this booking's gender requirement."
        }
        side="bottom"
        trigger={reassignTrigger}
      >
        <div className="grid gap-1.5">
          {visibleCandidates.length === 0 ? (
            <p className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2 text-sm text-[var(--admin-text-muted)]">
              No eligible therapists are available for this time slot. Try a different time, or adjust the gender requirement on the booking.
            </p>
          ) : (
            visibleCandidates.map((candidate) => {
              const isCurrent = candidate.staff.id === assignedStaffId;
              return (
                <button
                  key={candidate.staff.id}
                  type="button"
                  disabled={
                    isPending || !candidate.eligible || isCurrent
                  }
                  onClick={() => submit("assign", candidate.staff.id)}
                  className="flex items-start gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5 text-left outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <StaffAvatar
                    name={candidate.staff.name}
                    seed={candidate.staff.id}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--admin-heading)]">
                      {candidate.staff.name}
                      {isCurrent ? (
                        <span className="ml-2 text-xs font-medium text-[var(--admin-text-muted)]">
                          currently assigned
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--admin-text-muted)]">
                      {candidate.reason}
                    </span>
                  </span>
                </button>
              );
            })
          )}

          {hasIneligible ? (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-2 inline-flex h-8 items-center justify-center self-start rounded-[var(--admin-radius-control)] px-2 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              {showAll ? "Show eligible only" : "Show all staff"}
            </button>
          ) : null}
        </div>
      </AdminSheet>

      {assignedStaffId ? (
        <ConfirmActionModal
          title={`Remove ${assignedStaffName ?? "this therapist"} from this booking?`}
          description="The booking goes back to unassigned. Anyone eligible can claim it."
          confirmLabel="Remove assignment"
          cancelLabel="Keep them"
          destructive
          onConfirm={() => submit("unassign", "")}
          trigger={
            <AdminButton
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-8"
              icon={<UserMinus className="size-4" aria-hidden="true" />}
              loading={isPending}
            >
              Remove assignment
            </AdminButton>
          }
        />
      ) : null}
    </div>
  );
}

function StaffAvatar({ name, seed }: { name: string; seed?: string }) {
  const tint = avatarTint(seed ?? name);
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{ backgroundColor: tint.bg, color: tint.text }}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

/** Deterministic avatar tint — see BookingDetailSidebar.tsx for the spec. */
function avatarTint(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `oklch(88% 0.025 ${hue})`,
    text: `oklch(26% 0.04 ${hue})`,
  };
}
