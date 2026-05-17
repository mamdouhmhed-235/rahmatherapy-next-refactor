"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminSheet } from "../components/admin-ui-interactions";

const SEARCH_MIN_CHARS = 3;

export interface PrivacyFilterValues {
  request_type: string[];
  status: string[];
  range: string;
  from: string;
  to: string;
  q: string;
}

interface PrivacyFilterBarProps {
  initialValues: PrivacyFilterValues;
  requestTypeOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
}

const RANGE_PRESETS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "custom", label: "Custom" },
];

function buildHref(next: PrivacyFilterValues): string {
  const params = new URLSearchParams();
  if (next.request_type.length > 0)
    params.set("request_type", next.request_type.join(","));
  if (next.status.length > 0) params.set("status", next.status.join(","));
  if (next.range && next.range !== "") params.set("range", next.range);
  if (next.range === "custom") {
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
  }
  if (next.q.trim()) params.set("q", next.q.trim());
  const qs = params.toString();
  return qs ? `/admin/privacy?${qs}` : "/admin/privacy";
}

export function PrivacyFilterBar({
  initialValues,
  requestTypeOptions,
  statusOptions,
}: PrivacyFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<PrivacyFilterValues>(initialValues);
  const [searchError, setSearchError] = useState<string | null>(null);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clearTo: PrivacyFilterValues }[] = [];
    for (const value of values.request_type) {
      const option = requestTypeOptions.find((o) => o.value === value);
      chips.push({
        key: `type:${value}`,
        label: `Type: ${option?.label ?? value}`,
        clearTo: {
          ...values,
          request_type: values.request_type.filter((v) => v !== value),
        },
      });
    }
    for (const value of values.status) {
      const option = statusOptions.find((o) => o.value === value);
      chips.push({
        key: `status:${value}`,
        label: `Status: ${option?.label ?? value}`,
        clearTo: { ...values, status: values.status.filter((v) => v !== value) },
      });
    }
    if (values.range) {
      const preset = RANGE_PRESETS.find((p) => p.key === values.range);
      const label =
        values.range === "custom" && (values.from || values.to)
          ? `Range: ${values.from || "…"} to ${values.to || "…"}`
          : `Range: ${preset?.label ?? values.range}`;
      chips.push({
        key: "range",
        label,
        clearTo: { ...values, range: "", from: "", to: "" },
      });
    }
    if (values.q) {
      chips.push({
        key: "q",
        label: `Search: ${values.q}`,
        clearTo: { ...values, q: "" },
      });
    }
    return chips;
  }, [values, requestTypeOptions, statusOptions]);

  const hasActiveFilters = activeChips.length > 0;

  const navigate = (next: PrivacyFilterValues) => {
    setValues(next);
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = values.q.trim();
    if (raw.length > 0 && raw.length < SEARCH_MIN_CHARS) {
      setSearchError("Type at least 3 characters to search.");
      return;
    }
    setSearchError(null);
    navigate({ ...values, q: raw });
  };

  const toggleType = (value: string) => {
    const next = values.request_type.includes(value)
      ? values.request_type.filter((v) => v !== value)
      : [...values.request_type, value];
    navigate({ ...values, request_type: next });
  };

  const toggleStatus = (value: string) => {
    const next = values.status.includes(value)
      ? values.status.filter((v) => v !== value)
      : [...values.status, value];
    navigate({ ...values, status: next });
  };

  const setRange = (key: string) => {
    if (values.range === key) {
      navigate({ ...values, range: "", from: "", to: "" });
      return;
    }
    navigate({ ...values, range: key });
  };

  const setDateBound = (which: "from" | "to", value: string) => {
    if (which === "from") navigate({ ...values, range: "custom", from: value });
    else navigate({ ...values, range: "custom", to: value });
  };

  return (
    <form
      data-redesign-fake="filter-query"
      onSubmit={onSearchSubmit}
      aria-busy={isPending || undefined}
      className="mb-5 grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3"
    >
      {/* Top row — search + clear */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <label htmlFor="privacy-q" className="sr-only">
          Search request notes
        </label>
        <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
            aria-hidden="true"
          />
          <input
            id="privacy-q"
            name="q"
            type="search"
            value={values.q}
            onChange={(e) => setValues({ ...values, q: e.target.value })}
            placeholder="Search request notes"
            aria-describedby={searchError ? "privacy-q-error" : undefined}
            aria-invalid={searchError ? true : undefined}
            className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-9 pr-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </div>

        {/* Desktop selects (request type + status) — hidden under md */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <ChipMultiSelect
            label="Type"
            allLabel="All types"
            options={requestTypeOptions}
            selected={values.request_type}
            onToggle={toggleType}
          />
          <ChipMultiSelect
            label="Status"
            allLabel="All statuses"
            options={statusOptions}
            selected={values.status}
            onToggle={toggleStatus}
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3.5 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Apply filters
          </button>
          {hasActiveFilters ? (
            <Link
              href="/admin/privacy"
              className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      </div>

      {/* Date range presets — always visible */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1">
        <span className="shrink-0 pl-1 text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
          Date
        </span>
        {RANGE_PRESETS.map((preset) => {
          const active = values.range === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => setRange(preset.key)}
              aria-pressed={active}
              className={
                active
                  ? "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--admin-primary)] px-3.5 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  : "inline-flex h-9 shrink-0 items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              }
            >
              {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {preset.label}
            </button>
          );
        })}
        {values.range === "custom" ? (
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="date"
              aria-label="From date"
              defaultValue={values.from}
              onBlur={(e) => setDateBound("from", e.target.value)}
              className="h-9 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-2 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
            />
            <span aria-hidden="true" className="text-[var(--admin-text-muted)]">
              to
            </span>
            <input
              type="date"
              aria-label="To date"
              defaultValue={values.to}
              onBlur={(e) => setDateBound("to", e.target.value)}
              className="h-9 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-2 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
            />
          </div>
        ) : null}
      </div>

      {/* Mobile filter trigger (Type + Status only — date presets work on mobile already) */}
      <div className="flex items-center gap-2 md:hidden">
        <AdminSheet
          title="Filter privacy requests"
          description="Filter by request type and current status. Date presets stay above."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex h-10 w-full items-center justify-between gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters
              </span>
              {hasActiveFilters ? (
                <span
                  className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[0.6875rem] font-semibold text-white"
                  aria-label={`${activeChips.length} active filters`}
                >
                  {activeChips.length}
                </span>
              ) : null}
            </button>
          }
          footer={
            <div className="flex items-center justify-end gap-2">
              {hasActiveFilters ? (
                <BaseDialog.Close
                  render={
                    <Link
                      href="/admin/privacy"
                      className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      Clear filters
                    </Link>
                  }
                />
              ) : null}
              <BaseDialog.Close
                render={
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  >
                    Apply filters
                  </button>
                }
              />
            </div>
          }
        >
          <div className="grid gap-5">
            <ChipMultiSelectGroup
              label="Request type"
              options={requestTypeOptions}
              selected={values.request_type}
              onToggle={toggleType}
            />
            <ChipMultiSelectGroup
              label="Status"
              options={statusOptions}
              selected={values.status}
              onToggle={toggleStatus}
            />
          </div>
        </AdminSheet>
      </div>

      {searchError ? (
        <p
          id="privacy-q-error"
          role="alert"
          aria-live="polite"
          className="text-sm text-[oklch(26%_0.14_25)]"
        >
          {searchError}
        </p>
      ) : null}

      {values.range === "custom" &&
      values.from &&
      values.to &&
      values.from > values.to ? (
        <p
          role="alert"
          aria-live="polite"
          className="text-sm text-[oklch(26%_0.14_25)]"
        >
          End date has to be after the start date.
        </p>
      ) : null}

      {/* Active filter chips */}
      {activeChips.length > 0 ? (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => navigate(chip.clearTo)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(94%_0.008_280)] px-3 py-1 text-xs font-medium text-[oklch(30%_0.02_280)] outline-none transition-colors hover:bg-[oklch(91%_0.012_280)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                {chip.label}
                <X className="size-3" aria-hidden="true" />
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

function ChipMultiSelect({
  label,
  allLabel,
  options,
  selected,
  onToggle,
}: {
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${label}: ${selected.length}`;

  return (
    <details className="relative">
      <summary
        className={cn(
          "inline-flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
          "[&::-webkit-details-marker]:hidden"
        )}
      >
        <span className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
          {label}
        </span>
        <span>{summary}</span>
      </summary>
      <div className="absolute left-0 z-30 mt-1.5 grid min-w-[14rem] gap-1 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-2 shadow-[var(--admin-shadow-overlay)]">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--admin-radius-control)] px-2 text-sm text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option.value)}
                className="size-4 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus:ring-[var(--admin-focus)]/30"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function ChipMultiSelectGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-within:ring-2 focus-within:ring-[var(--admin-focus)]/55",
                checked
                  ? "bg-[var(--admin-primary)] text-white"
                  : "border border-[var(--admin-border-form)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option.value)}
                className="sr-only"
              />
              {checked ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
