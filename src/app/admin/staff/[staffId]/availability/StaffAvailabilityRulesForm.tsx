"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createStaffAvailabilityRule,
  deleteStaffAvailabilityRule,
} from "../../actions";

interface StaffAvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface StaffAvailabilityRulesFormProps {
  staffId: string;
  initialRules: StaffAvailabilityRule[];
  canEdit: boolean;
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

export function StaffAvailabilityRulesForm({
  staffId,
  initialRules,
  canEdit,
}: StaffAvailabilityRulesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rules, setRules] = useState(initialRules);
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createStaffAvailabilityRule(staffId, {
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        is_working_day: true,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setRules((current) =>
          [...current, result.data].sort(
            (a, b) =>
              a.day_of_week - b.day_of_week ||
              a.start_time.localeCompare(b.start_time)
          )
        );
      }

      toast.success("Availability rule added");
      router.refresh();
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteStaffAvailabilityRule(staffId, ruleId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setRules((current) => current.filter((rule) => rule.id !== ruleId));
      toast.success("Availability rule removed");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <CalendarPlus className="size-5 text-[var(--rahma-green)]" />
          Schedule Rules
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-xl border border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/30 p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <div className="grid gap-1.5">
            <label
              htmlFor="rule-day"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--rahma-muted)]"
            >
              Day
            </label>
            <select
              id="rule-day"
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(event.target.value)}
              disabled={!canEdit || isPending}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="rule-start"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--rahma-muted)]"
            >
              Start
            </label>
            <Input
              id="rule-start"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={!canEdit || isPending}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="rule-end"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--rahma-muted)]"
            >
              End
            </label>
            <Input
              id="rule-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={!canEdit || isPending}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={!canEdit || isPending}
            className="self-end"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Add Rule
          </Button>
        </form>

        <div className="divide-y divide-[var(--rahma-border)] rounded-xl border border-[var(--rahma-border)] bg-white">
          {rules.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--rahma-muted)]">
              No personal schedule rules yet.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--rahma-charcoal)]">
                    {DAYS[rule.day_of_week]}
                  </p>
                  <p className="text-sm text-[var(--rahma-muted)]">
                    {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canEdit || isPending}
                  onClick={() => handleDelete(rule.id)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--rahma-muted)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Remove ${DAYS[rule.day_of_week]} availability rule`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
