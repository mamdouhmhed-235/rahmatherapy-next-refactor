"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarRange,
  Copy,
  Info,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../../../components/admin-ui";
import {
  createStaffAvailabilityRule,
  deleteStaffAvailabilityRule,
} from "../../actions";
import {
  CANCELLED_TEXT,
  DAYS_LONG,
  formatTime,
} from "./lib";

interface StaffAvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface GlobalRuleSeed {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

interface StaffAvailabilityRulesFormProps {
  staffId: string;
  initialRules: StaffAvailabilityRule[];
  canEdit: boolean;
  globalModeLocked: boolean;
  globalRulesSeed?: GlobalRuleSeed[];
}

export function StaffAvailabilityRulesForm({
  staffId,
  initialRules,
  canEdit,
  globalModeLocked,
  globalRulesSeed,
}: StaffAvailabilityRulesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rules, setRules] = useState(initialRules);
  const [showAddRow, setShowAddRow] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const editable = canEdit && !globalModeLocked;

  // Days that already have a rule — disabled in the day picker
  const usedDays = useMemo(
    () => new Set(rules.map((r) => r.day_of_week)),
    [rules]
  );

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;

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

      toast.success("Working hours saved.");
      setShowAddRow(false);
      router.refresh();
    });
  }

  function handleDelete(ruleId: string) {
    if (!editable) return;
    startTransition(async () => {
      const result = await deleteStaffAvailabilityRule(staffId, ruleId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
      toast.success("Working hours saved.");
      router.refresh();
    });
  }

  async function toggleWorkingDay(rule: StaffAvailabilityRule) {
    if (!editable) return;
    // Off-state = delete the rule. The booking engine treats absence as closed.
    handleDelete(rule.id);
  }

  async function startFromGlobal() {
    if (!editable || !globalRulesSeed || globalRulesSeed.length === 0) return;
    const seeds = globalRulesSeed.filter(
      (seed) => seed.is_working_day && !usedDays.has(seed.day_of_week)
    );
    if (seeds.length === 0) {
      toast.error("Already populated for every clinic-open day.");
      return;
    }
    startTransition(async () => {
      const added: StaffAvailabilityRule[] = [];
      for (const seed of seeds) {
        const result = await createStaffAvailabilityRule(staffId, seed);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.data) added.push(result.data);
      }
      setRules((current) =>
        [...current, ...added].sort(
          (a, b) =>
            a.day_of_week - b.day_of_week ||
            a.start_time.localeCompare(b.start_time)
        )
      );
      toast.success(
        `Started from clinic-wide hours (${added.length} day${added.length === 1 ? "" : "s"}).`
      );
      router.refresh();
    });
  }

  const hasSeed = !!globalRulesSeed && globalRulesSeed.length > 0;
  const canSeedNow =
    editable && hasSeed && rules.length === 0;

  return (
    <AdminPanel
      title="Weekly working hours"
      description="The recurring pattern the booking engine uses every week."
      badge={
        <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
          {rules.length} {rules.length === 1 ? "day" : "days"}
        </span>
      }
    >
      {globalModeLocked ? (
        <div
          role="note"
          className="mb-4 flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-3 text-sm text-[var(--admin-body)] sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <Info
              className="mt-0.5 size-4 shrink-0 text-[var(--admin-text-muted)]"
              aria-hidden="true"
            />
            <span>
              These rows show the global pattern. Switch to custom hours above
              to edit this staff member&apos;s schedule.
            </span>
          </span>
        </div>
      ) : null}

      {/* Rules list */}
      {rules.length === 0 ? (
        <EmptyRulesState
          globalModeLocked={globalModeLocked}
          canSeed={canSeedNow}
          onSeed={startFromGlobal}
          onAddRule={() => setShowAddRow(true)}
          editable={editable}
        />
      ) : (
        <ul
          className="grid list-none gap-2 pl-0"
          aria-label="Weekly working hours"
        >
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle sm:flex-nowrap",
                !globalModeLocked && "hover:border-[var(--admin-primary)]/30"
              )}
            >
              <CalendarRange
                className="size-4 shrink-0 text-[var(--admin-primary)]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--admin-heading)]">
                  {DAYS_LONG[rule.day_of_week]}
                </p>
                <p className="mt-0.5 font-mono text-sm text-[var(--admin-text-muted)]">
                  {formatTime(rule.start_time)}–{formatTime(rule.end_time)}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={!editable || isPending}
                  onChange={() => toggleWorkingDay(rule)}
                  aria-label={`${DAYS_LONG[rule.day_of_week]} working day`}
                  className="size-4 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                />
                <span className="hidden sm:inline">Working day</span>
              </label>
              <button
                type="button"
                disabled={!editable || isPending}
                onClick={() => handleDelete(rule.id)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[oklch(95.5%_0.028_20)] hover:text-[oklch(26%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
                aria-label={`Remove ${DAYS_LONG[rule.day_of_week]} availability rule`}
                title={`Remove this rule: ${DAYS_LONG[rule.day_of_week]}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add-rule control + collapsible form */}
      {rules.length > 0 && editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!showAddRow ? (
            <button
              type="button"
              onClick={() => setShowAddRow(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              Add rule
            </button>
          ) : null}
          {hasSeed && rules.length > 0 ? null : null}
        </div>
      ) : null}

      {showAddRow && editable ? (
        <form
          onSubmit={handleCreate}
          className="mt-4 grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          aria-busy={isPending || undefined}
        >
          <div className="grid gap-1.5">
            <label
              htmlFor="rule-day"
              className="text-sm font-medium text-[var(--admin-heading)]"
            >
              Day
            </label>
            <select
              id="rule-day"
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(event.target.value)}
              disabled={isPending}
              className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
            >
              {DAYS_LONG.map((day, index) => (
                <option key={day} value={index} disabled={usedDays.has(index)}>
                  {day}
                  {usedDays.has(index) ? " (added)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="rule-start"
              className="text-sm font-medium text-[var(--admin-heading)]"
            >
              Opens
              <span aria-hidden="true" className={cn("ml-0.5", CANCELLED_TEXT)}>
                *
              </span>
            </label>
            <input
              id="rule-start"
              name="start_time"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={isPending}
              required
              className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
            />
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="rule-end"
              className="text-sm font-medium text-[var(--admin-heading)]"
            >
              Closes
              <span aria-hidden="true" className={cn("ml-0.5", CANCELLED_TEXT)}>
                *
              </span>
            </label>
            <input
              id="rule-end"
              name="end_time"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={isPending}
              required
              className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:h-10 sm:w-auto"
            >
              {isPending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              Save hours
            </button>
            <button
              type="button"
              onClick={() => setShowAddRow(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:h-10 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {globalModeLocked ? (
        <div className="mt-4">
          <Link
            href="/admin/availability"
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Open clinic-wide hours →
          </Link>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function EmptyRulesState({
  globalModeLocked,
  canSeed,
  onSeed,
  onAddRule,
  editable,
}: {
  globalModeLocked: boolean;
  canSeed: boolean;
  onSeed: () => void;
  onAddRule: () => void;
  editable: boolean;
}) {
  if (globalModeLocked) {
    return (
      <p className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-5 text-sm text-[var(--admin-text-muted)]">
        Clinic-wide hours apply. No custom weekly rules are set.
      </p>
    );
  }
  return (
    <div className="grid justify-items-center gap-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--admin-panel)] text-[var(--admin-primary)]"
      >
        <CalendarRange className="size-6" />
      </span>
      <div className="max-w-[45ch]">
        <p className="font-display text-base font-semibold text-[var(--admin-heading)]">
          No custom rules yet
        </p>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
          Add a rule for each working day to define this staff member&apos;s
          weekly pattern.
        </p>
      </div>
      {editable ? (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onAddRule}
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Add rule
          </button>
          {canSeed ? (
            <button
              type="button"
              onClick={onSeed}
              title="Copy the clinic-wide working hours as a starting point — edit afterwards."
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Copy className="size-4 shrink-0" aria-hidden="true" />
              Start from global hours
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
