"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Globe, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateStaffAvailabilityMode } from "../../actions";
import { AdminStatusBadge } from "../../../components/admin-ui";
import { ConfirmActionModal } from "../../../components/admin-ui-interactions";

type AvailabilityMode = "use_global" | "custom";

interface AvailabilityModeSelectorProps {
  staff: {
    id: string;
    availability_mode: string;
  };
  canEdit: boolean;
  isSelfView: boolean;
}

export function AvailabilityModeSelector({
  staff,
  canEdit,
  isSelfView,
}: AvailabilityModeSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentMode, setCurrentMode] = useState<AvailabilityMode>(
    staff.availability_mode === "custom" ? "custom" : "use_global"
  );
  const sublineId = useId();

  function applyMode(modeId: AvailabilityMode) {
    if (modeId === currentMode) return;
    startTransition(async () => {
      const result = await updateStaffAvailabilityMode(staff.id, modeId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCurrentMode(modeId);
      toast.success(
        `Now using ${modeId === "use_global" ? "global" : "custom"} hours.`
      );
      router.refresh();
    });
  }

  const isCustom = currentMode === "custom";
  const subline = isCustom
    ? isSelfView
      ? "You have your own working pattern set below."
      : "This staff member has their own working pattern set below."
    : isSelfView
      ? "Your schedule follows the clinic-wide working hours from Settings."
      : "This staff member follows the clinic-wide working hours from Settings.";

  return (
    <section
      aria-labelledby="availability-mode-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2
            id="availability-mode-heading"
            className="text-sm font-medium text-[var(--admin-text-muted)]"
          >
            Availability mode
          </h2>
          <p
            id={sublineId}
            className="mt-1 text-sm text-[var(--admin-body)]"
          >
            {subline}
          </p>
        </div>

        <div
          className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end"
          aria-describedby={sublineId}
        >
          <span
            title={
              isCustom
                ? "Has their own working pattern set here."
                : "Falls back to the clinic-wide working hours in Settings."
            }
            className="inline-flex self-start sm:self-center"
          >
            <AdminStatusBadge
              value={isCustom ? "Custom hours" : "Using global hours"}
              tone={isCustom ? "confirmed" : "pending"}
            />
          </span>

          <ModeSegmentedControl
            isCustom={isCustom}
            disabled={!canEdit || isPending}
            isPending={isPending}
            isSelfView={isSelfView}
            onUseGlobal={() => applyMode("use_global")}
            onCustom={() => applyMode("custom")}
          />
        </div>
      </div>
    </section>
  );
}

function ModeSegmentedControl({
  isCustom,
  disabled,
  isPending,
  isSelfView,
  onUseGlobal,
  onCustom,
}: {
  isCustom: boolean;
  disabled: boolean;
  isPending: boolean;
  isSelfView: boolean;
  onUseGlobal: () => void;
  onCustom: () => void;
}) {
  const confirmBody = isSelfView
    ? "The clinic's working hours will replace yours below. Your custom rules will be hidden but not deleted — switching back to custom restores them."
    : "The custom rules you've set for this staff member will be hidden but not deleted. Switching back to custom restores them.";

  return (
    <div
      role="group"
      aria-label="Availability mode"
      className="inline-flex w-full flex-wrap items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] p-1 sm:w-auto"
    >
      {isCustom ? (
        <ConfirmActionModal
          title="Switch to global hours?"
          description={confirmBody}
          confirmLabel="Use global hours"
          cancelLabel="Cancel"
          destructive
          onConfirm={async () => onUseGlobal()}
          trigger={
            <button
              type="button"
              disabled={disabled}
              aria-pressed={false}
              className={cn(
                "inline-flex h-11 flex-1 min-w-[8.5rem] items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:flex-initial",
                "bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-canvas)]"
              )}
            >
              {isPending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <Globe className="size-4 shrink-0" aria-hidden="true" />
              )}
              Use global hours
            </button>
          }
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={true}
          onClick={onUseGlobal}
          style={{ color: "#ffffff" }}
          className={cn(
            "inline-flex h-11 flex-1 min-w-[8.5rem] items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:flex-initial",
            "bg-[var(--admin-primary)] shadow-sm"
          )}
        >
          {isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
          )}
          Use global hours
        </button>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-pressed={isCustom}
        onClick={isCustom ? undefined : onCustom}
        style={isCustom ? { color: "#ffffff" } : undefined}
        className={cn(
          "inline-flex h-11 flex-1 min-w-[8.5rem] items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:flex-initial",
          isCustom
            ? "bg-[var(--admin-primary)] shadow-sm"
            : "bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-canvas)]"
        )}
      >
        {isPending && isCustom ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : isCustom ? (
          <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <UserCheck className="size-4 shrink-0" aria-hidden="true" />
        )}
        Custom hours
      </button>
    </div>
  );
}
