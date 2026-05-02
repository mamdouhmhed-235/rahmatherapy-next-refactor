"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createAvailabilityOverride,
  deleteAvailabilityOverride,
  type AvailabilityActionState,
} from "./actions";

interface AvailabilityOverride {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface AvailabilityOverridesManagerProps {
  overrides: AvailabilityOverride[];
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

export function AvailabilityOverridesManager({
  overrides,
}: AvailabilityOverridesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AvailabilityActionState>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createAvailabilityOverride({}, formData);

      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) toast.error(result.error);
        return;
      }

      setState({});
      form.reset();
      toast.success("Availability override saved");
      router.refresh();
    });
  }

  function handleDelete(overrideId: string) {
    startTransition(async () => {
      const result = await deleteAvailabilityOverride(overrideId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Availability override removed");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Clock3 className="size-5 text-[var(--rahma-green)]" />
          Date Overrides
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="divide-y divide-[var(--rahma-border)] rounded-xl border border-[var(--rahma-border)] bg-white">
          {overrides.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--rahma-muted)]">
              No date overrides set.
            </p>
          ) : (
            overrides.map((override) => (
              <div
                key={override.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--rahma-charcoal)]">
                    {override.override_date}
                  </p>
                  <p className="text-sm text-[var(--rahma-muted)]">
                    {formatTime(override.start_time)} -{" "}
                    {formatTime(override.end_time)}
                    {override.reason ? `, ${override.reason}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(override.id)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Remove availability override ${override.override_date}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-xl border border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/30 p-4"
        >
          {state.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              Date
            </span>
            <Input
              name="override_date"
              type="date"
              disabled={isPending}
              required
            />
            {state.fieldErrors?.override_date ? (
              <span className="text-xs text-red-600">
                {state.fieldErrors.override_date}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              Start
            </span>
            <Input
              name="start_time"
              type="time"
              defaultValue="08:00"
              disabled={isPending}
              required
            />
            {state.fieldErrors?.start_time ? (
              <span className="text-xs text-red-600">
                {state.fieldErrors.start_time}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              End
            </span>
            <Input
              name="end_time"
              type="time"
              defaultValue="20:00"
              disabled={isPending}
              required
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              Reason
            </span>
            <Input name="reason" disabled={isPending} />
          </label>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save override
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
