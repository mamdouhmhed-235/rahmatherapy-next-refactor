"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import {
  ACTION_FAMILY_OPTIONS,
  DATE_RANGE_PRESETS,
  TARGET_TYPE_OPTIONS,
  type DateRangePresetKey,
} from "./format";
import { AdminSheet } from "../components/admin-ui-interactions";

export interface ActorOption {
  id: string;
  name: string;
}

interface AuditFilterStripProps {
  actors: ActorOption[];
  initialValues: {
    q: string;
    actor: string;
    family: string;
    target_type: string;
    range: string;
    from: string;
    to: string;
  };
}

const SEARCH_MIN_CHARS = 4;

function buildHref(values: AuditFilterStripProps["initialValues"]): string {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.actor) params.set("actor", values.actor);
  if (values.family) params.set("family", values.family);
  if (values.target_type) params.set("target_type", values.target_type);
  if (values.range && values.range !== "last_30_days") params.set("range", values.range);
  if (values.range === "custom") {
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
  }
  const qs = params.toString();
  return qs ? `/admin/audit?${qs}` : "/admin/audit";
}

export function AuditFilterStrip({ actors, initialValues }: AuditFilterStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(initialValues);
  const [searchError, setSearchError] = useState<string | null>(null);

  const submitImmediate = (next: typeof values) => {
    setValues(next);
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = values.q.trim();
    if (raw.length > 0 && raw.length < SEARCH_MIN_CHARS) {
      setSearchError("Type at least 4 characters of an ID.");
      return;
    }
    setSearchError(null);
    submitImmediate({ ...values, q: raw });
  };

  const hasActiveFilters = Boolean(
    values.q || values.actor || values.family || values.target_type || (values.range && values.range !== "last_30_days")
  );

  const activeRange = values.range || "last_30_days";

  const activeChips: { key: string; label: string; clearTo: typeof values }[] = [];
  if (values.q) {
    activeChips.push({ key: "q", label: `ID search: ${values.q}`, clearTo: { ...values, q: "" } });
  }
  if (values.actor) {
    const actor = actors.find((a) => a.id === values.actor);
    activeChips.push({ key: "actor", label: `Actor: ${actor?.name ?? "Unknown"}`, clearTo: { ...values, actor: "" } });
  }
  if (values.family) {
    const family = ACTION_FAMILY_OPTIONS.find((f) => f.key === values.family);
    activeChips.push({ key: "family", label: `Family: ${family?.label ?? values.family}`, clearTo: { ...values, family: "" } });
  }
  if (values.target_type) {
    const target = TARGET_TYPE_OPTIONS.find((t) => t.key === values.target_type);
    activeChips.push({ key: "target_type", label: `Target: ${target?.label ?? values.target_type}`, clearTo: { ...values, target_type: "" } });
  }
  if (values.range && values.range !== "last_30_days") {
    const preset = DATE_RANGE_PRESETS.find((p) => p.key === values.range);
    const label =
      values.range === "custom" && (values.from || values.to)
        ? `Range: ${values.from || "…"} → ${values.to || "…"}`
        : `Range: ${preset?.label ?? values.range}`;
    activeChips.push({
      key: "range",
      label,
      clearTo: { ...values, range: "last_30_days", from: "", to: "" },
    });
  }

  return (
    <div className="grid gap-3 print:hidden">
      {/* Desktop strip */}
      <section
        aria-label="Audit filters"
        className="hidden flex-wrap items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 md:flex"
        aria-busy={isPending}
      >
        <form onSubmit={onSearchSubmit} className="flex min-w-0 flex-1 items-center gap-2" role="search">
          <label htmlFor="audit-search" className="sr-only">
            Search by booking, client, staff, or event ID
          </label>
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
              aria-hidden="true"
            />
            <input
              id="audit-search"
              name="q"
              type="search"
              value={values.q}
              onChange={(e) => setValues({ ...values, q: e.target.value })}
              placeholder="Search by booking, client, staff, or event ID"
              className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-input-bg,var(--admin-panel))] pl-9 pr-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              aria-describedby={searchError ? "audit-search-error" : undefined}
              aria-invalid={searchError ? true : undefined}
            />
          </div>
        </form>

        <ActorSelect actors={actors} value={values.actor} onChange={(v) => submitImmediate({ ...values, actor: v })} />
        <FamilySelect value={values.family} onChange={(v) => submitImmediate({ ...values, family: v })} />
        <TargetTypeSelect value={values.target_type} onChange={(v) => submitImmediate({ ...values, target_type: v })} />

        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters || values.q ? (
            <Link
              href="/admin/audit"
              className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </section>

      {/* Date range chip strip — always visible */}
      <DateRangeChipStrip
        value={activeRange as DateRangePresetKey}
        from={values.from}
        to={values.to}
        onChange={(rangeKey, from, to) =>
          submitImmediate({ ...values, range: rangeKey, from: from ?? "", to: to ?? "" })
        }
      />

      {searchError ? (
        <p id="audit-search-error" role="alert" aria-live="polite" className="text-sm text-[var(--admin-status-cancelled-text)]">
          {searchError}
        </p>
      ) : null}

      {values.range === "custom" && values.from && values.to && values.from > values.to ? (
        <p role="alert" aria-live="polite" className="text-sm text-[var(--admin-status-cancelled-text)]">
          End date must be on or after start date.
        </p>
      ) : null}

      {/* Mobile filter trigger */}
      <div className="flex items-center gap-2 md:hidden">
        <form onSubmit={onSearchSubmit} className="flex-1" role="search">
          <label htmlFor="audit-search-mobile" className="sr-only">
            Search by booking, client, staff, or event ID
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
              aria-hidden="true"
            />
            <input
              id="audit-search-mobile"
              name="q"
              type="search"
              value={values.q}
              onChange={(e) => setValues({ ...values, q: e.target.value })}
              placeholder="Search by ID"
              className="h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] pl-9 pr-3 text-sm text-[var(--admin-body)] outline-none placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            />
          </div>
        </form>

        <AdminSheet
          title="Filter audit log"
          description="Refine the current view."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filter
              {hasActiveFilters ? (
                <span
                  className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[0.6875rem] font-semibold text-[var(--admin-on-primary)]"
                  aria-label={`${activeChips.length} active filters`}
                >
                  {activeChips.length}
                </span>
              ) : null}
            </button>
          }
          footer={
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/admin/audit"
                className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Clear
              </Link>
              <span className="text-xs text-[var(--admin-text-muted)]">Changes apply instantly.</span>
            </div>
          }
        >
          <div className="grid gap-4">
            <ActorSelect
              actors={actors}
              value={values.actor}
              onChange={(v) => submitImmediate({ ...values, actor: v })}
              fullWidth
            />
            <FamilySelect value={values.family} onChange={(v) => submitImmediate({ ...values, family: v })} fullWidth />
            <TargetTypeSelect
              value={values.target_type}
              onChange={(v) => submitImmediate({ ...values, target_type: v })}
              fullWidth
            />
          </div>
        </AdminSheet>
      </div>

      {activeChips.length > 0 ? (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => submitImmediate(chip.clearTo)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-status-restricted-bg)] px-3 py-1 text-xs font-medium text-[var(--admin-status-restricted-text)] outline-none transition-colors hover:bg-[var(--admin-status-restricted-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                {chip.label}
                <X className="size-3" aria-hidden="true" />
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ActorSelect({
  actors,
  value,
  onChange,
  fullWidth,
}: {
  actors: ActorOption[];
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "grid gap-1.5" : "inline-flex items-center gap-2"}>
      <span className={fullWidth ? "text-xs font-medium text-[var(--admin-text-muted)]" : "sr-only"}>Actor</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
      >
        <option value="">Anyone</option>
        {actors.map((actor) => (
          <option key={actor.id} value={actor.id}>
            {actor.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function FamilySelect({
  value,
  onChange,
  fullWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "grid gap-1.5" : "inline-flex items-center gap-2"}>
      <span className={fullWidth ? "text-xs font-medium text-[var(--admin-text-muted)]" : "sr-only"}>Action family</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
      >
        <option value="">All actions</option>
        {ACTION_FAMILY_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TargetTypeSelect({
  value,
  onChange,
  fullWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "grid gap-1.5" : "inline-flex items-center gap-2"}>
      <span className={fullWidth ? "text-xs font-medium text-[var(--admin-text-muted)]" : "sr-only"}>Target type</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
      >
        <option value="">All targets</option>
        {TARGET_TYPE_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateRangeChipStrip({
  value,
  from,
  to,
  onChange,
}: {
  value: DateRangePresetKey;
  from: string;
  to: string;
  onChange: (range: DateRangePresetKey, from?: string, to?: string) => void;
}) {
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1">
      {DATE_RANGE_PRESETS.map((preset) => {
        const active = value === preset.key;
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => onChange(preset.key, undefined, undefined)}
            aria-pressed={active}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--admin-primary)] px-3.5 text-sm font-medium text-[var(--admin-on-primary)] shadow-[0_0_0_2px_oklch(99.2%_0.004_88),0_0_0_3px_var(--admin-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                : "inline-flex h-9 shrink-0 items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            }
          >
            {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
            {preset.label}
          </button>
        );
      })}
      {value === "custom" ? (
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            defaultValue={from}
            onBlur={(e) => onChange("custom", e.target.value, to)}
            className="h-9 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          />
          <span aria-hidden="true" className="text-[var(--admin-text-muted)]">
            to
          </span>
          <input
            type="date"
            aria-label="To date"
            defaultValue={to}
            onBlur={(e) => onChange("custom", from, e.target.value)}
            className="h-9 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          />
        </div>
      ) : null}
    </div>
  );
}
