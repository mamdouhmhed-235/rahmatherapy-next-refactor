"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStaffAvailabilityMode } from "../../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Globe, UserCheck, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AvailabilityMode = "use_global" | "custom" | "global_with_overrides";

interface AvailabilityModeSelectorProps {
  staff: {
    id: string;
    availability_mode: AvailabilityMode;
  };
  canManageGlobal: boolean;
  isOwnProfile: boolean;
}

export function AvailabilityModeSelector({ staff, canManageGlobal, isOwnProfile }: AvailabilityModeSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<AvailabilityMode>(
    staff.availability_mode
  );

  const modes: {
    id: AvailabilityMode;
    title: string;
    description: string;
    icon: typeof Globe;
  }[] = [
    {
      id: "use_global",
      title: "Use Global Schedule",
      description: "Follow the practice-wide working hours and holidays. Ideal for regular part-time or full-time staff.",
      icon: Globe,
    },
    {
      id: "custom",
      title: "Strictly Custom",
      description: "Override all global rules with a unique schedule. Best for contractors or visiting therapists.",
      icon: UserCheck,
    },
    {
      id: "global_with_overrides",
      title: "Global with Overrides",
      description: "Base availability on global rules, but allow specific custom shifts or block-outs.",
      icon: Calendar,
    }
  ];

  async function handleModeChange(modeId: AvailabilityMode) {
    if (modeId === currentMode) return;

    startTransition(async () => {
      const result = await updateStaffAvailabilityMode(staff.id, modeId);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setError(null);
        setCurrentMode(modeId);
        toast.success("Availability mode updated");
        router.refresh();
      }
    });
  }

  const canEdit = canManageGlobal || isOwnProfile;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center gap-3">
          <Info className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Globe className="size-5 text-[var(--rahma-green)]" />
            Availability Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {modes.map((mode) => {
              const isSelected = currentMode === mode.id;
              const Icon = mode.icon;

              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={isPending || !canEdit}
                  onClick={() => handleModeChange(mode.id)}
                  className={cn(
                    "relative flex flex-col items-start rounded-2xl border p-5 text-left transition-all duration-200",
                    isSelected
                      ? "border-[var(--rahma-green)] bg-[var(--rahma-ivory)] ring-1 ring-[var(--rahma-green)]"
                      : "border-[var(--rahma-border)] bg-white hover:border-[var(--rahma-muted)]",
                    isPending && "opacity-50 grayscale"
                  )}
                >
                  <div className={cn(
                    "mb-4 flex size-10 items-center justify-center rounded-xl",
                    isSelected ? "bg-[var(--rahma-green)] text-white" : "bg-gray-100 text-[var(--rahma-muted)]"
                  )}>
                    <Icon className="size-5" />
                  </div>
                  
                  <div className="flex items-center justify-between w-full mb-1">
                    <p className={cn(
                      "font-semibold text-sm",
                      isSelected ? "text-[var(--rahma-charcoal)]" : "text-[var(--rahma-muted)]"
                    )}>
                      {mode.title}
                    </p>
                    {isSelected && (
                      <CheckCircle2 className="size-4 text-[var(--rahma-green)]" />
                    )}
                  </div>
                  
                  <p className="text-xs leading-relaxed text-[var(--rahma-muted)]">
                    {mode.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-xl bg-[var(--rahma-ivory)]/50 p-4 border border-[var(--rahma-border)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--rahma-muted)] mb-3">Current Active Logic</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--rahma-green)]" />
                <p className="text-sm text-[var(--rahma-charcoal)]">
                  {currentMode === 'use_global' 
                    ? "Currently pulling 08:00 - 20:00 schedule from Global Settings." 
                    : currentMode === 'custom' 
                    ? "Global schedule is ignored. Using custom rules defined below."
                    : "Merging Global schedule with staff-specific overrides."
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
