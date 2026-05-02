"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteAvailabilityRule,
  saveAvailabilityRule,
  type AvailabilityActionState,
} from "./actions";

interface AvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface AvailabilityRulesManagerProps {
  initialRules: AvailabilityRule[];
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(value: string) {
  return value.slice(0, 5);
}

export function AvailabilityRulesManager({
  initialRules,
}: AvailabilityRulesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AvailabilityActionState>({});
  const [editingRule, setEditingRule] = useState<AvailabilityRule | null>(
    initialRules[0] ?? null
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveAvailabilityRule({}, formData);

      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) toast.error(result.error);
        return;
      }

      setState({});
      toast.success("Working day saved");
      router.refresh();
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteAvailabilityRule(ruleId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Working day removed");
      setEditingRule(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="size-5 text-[var(--rahma-green)]" />
          Global Working Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="divide-y divide-[var(--rahma-border)] rounded-xl border border-[var(--rahma-border)] bg-white">
          {initialRules.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--rahma-muted)]">
              No global working hours set.
            </p>
          ) : (
            initialRules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => setEditingRule(rule)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--rahma-ivory)]/40"
              >
                <div>
                  <p className="font-medium text-[var(--rahma-charcoal)]">
                    {DAYS[rule.day_of_week]}
                  </p>
                  <p className="text-sm text-[var(--rahma-muted)]">
                    {rule.is_working_day
                      ? `${formatTime(rule.start_time)} - ${formatTime(rule.end_time)}`
                      : "Closed"}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--rahma-muted)]">
                  Edit
                </span>
              </button>
            ))
          )}
        </div>

        <form
          key={editingRule?.id ?? "new"}
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-xl border border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/30 p-4"
        >
          <input type="hidden" name="rule_id" value={editingRule?.id ?? ""} />

          {state.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              Day
            </span>
            <select
              name="day_of_week"
              defaultValue={editingRule?.day_of_week ?? 1}
              disabled={isPending}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
              Start
            </span>
            <Input
              name="start_time"
              type="time"
              defaultValue={formatTime(editingRule?.start_time ?? "08:00")}
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
              defaultValue={formatTime(editingRule?.end_time ?? "20:00")}
              disabled={isPending}
              required
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--rahma-charcoal)]">
            <input
              name="is_working_day"
              type="checkbox"
              defaultChecked={editingRule?.is_working_day ?? true}
              disabled={isPending}
              className="size-4 accent-[var(--rahma-green)]"
            />
            Working day
          </label>

          <div className="flex justify-between gap-2">
            {editingRule ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDelete(editingRule.id)}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
