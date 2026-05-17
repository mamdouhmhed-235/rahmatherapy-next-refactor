"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  CalendarClock,
  ChevronDown,
  Download,
  Loader2,
  PoundSterling,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminSheet } from "../components/admin-ui-interactions";
import type { ReportFilters } from "../reports/reporting";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

type PresetKey = "today" | "this_week" | "this_month" | "last_30" | "custom";

interface PresetRange {
  key: PresetKey;
  label: string;
  from: string;
  to: string;
}

function buildPresets(todayISO: string): PresetRange[] {
  const today = parseDate(todayISO) ?? new Date();
  const day = today.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const thirtyAgo = new Date(today);
  thirtyAgo.setUTCDate(today.getUTCDate() - 29);
  return [
    { key: "today", label: "Today", from: isoDate(today), to: isoDate(today) },
    { key: "this_week", label: "This week", from: isoDate(weekStart), to: isoDate(weekEnd) },
    { key: "this_month", label: "This month", from: isoDate(monthStart), to: isoDate(monthEnd) },
    { key: "last_30", label: "Last 30 days", from: isoDate(thirtyAgo), to: isoDate(today) },
    { key: "custom", label: "Custom", from: "", to: "" },
  ];
}

function getActivePreset(presets: PresetRange[], filters: ReportFilters): PresetKey {
  if (filters.range === "custom") return "custom";
  for (const preset of presets) {
    if (preset.key === "custom") continue;
    if (preset.from === filters.from && preset.to === filters.to) return preset.key;
  }
  return "custom";
}

function CityCombobox({
  label,
  name,
  listId,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  listId: string;
  defaultValue?: string;
  options: string[];
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-[var(--admin-body)]">
      <span>{label}</span>
      <span className="relative block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
          aria-hidden="true"
        />
        <input
          name={name}
          list={listId}
          defaultValue={defaultValue}
          className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white pl-9 pr-3 text-sm font-medium normal-case tracking-normal text-[var(--admin-body)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          placeholder="All cities"
          autoComplete="off"
        />
      </span>
      <datalist id={listId}>
        {options.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
    </label>
  );
}

function DateInput({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-[var(--admin-body)]">
      <span>{label}</span>
      <input
        name={name}
        type="date"
        defaultValue={defaultValue}
        className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
      />
    </label>
  );
}

function FormSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-[var(--admin-body)]">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[var(--admin-body)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
      >
        {children}
      </select>
    </label>
  );
}

function formatFilterLabel(str: string) {
  if (!str) return "";
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export interface ScopeSummary {
  bookings: number;
  attention: number;
  outstanding: number;
  clients: number;
  rangeLabel: string;
  revenueAllowed: boolean;
}

export function DashboardFiltersClient({
  staff,
  serviceOptions,
  sourceOptions = [],
  statusOptions = [],
  paymentOptions = [],
  cityOptions = [],
  today,
  filters,
  canExport = true,
  scopeSummary,
}: {
  staff: { id: string; name: string }[];
  serviceOptions: string[];
  sourceOptions?: string[];
  statusOptions?: string[];
  paymentOptions?: string[];
  cityOptions?: string[];
  today: string;
  filters: ReportFilters;
  canExport?: boolean;
  scopeSummary?: ScopeSummary;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const presets = useMemo(() => buildPresets(today), [today]);
  const activePreset = getActivePreset(presets, filters);
  const isCustom = activePreset === "custom";

  const activeAdvancedFilters = [
    filters.city,
    filters.service,
    filters.staffId,
    filters.source,
    filters.status,
    filters.paymentStatus,
  ].filter(Boolean).length;
  const showStaffFilter = staff.length > 0;

  function buildPresetHref(preset: PresetRange) {
    const params = new URLSearchParams(searchParams.toString());
    if (preset.key === "custom") {
      params.set("range", "custom");
    } else {
      params.set("range", preset.key);
      params.set("from", preset.from);
      params.set("to", preset.to);
    }
    return `/admin/dashboard?${params.toString()}`;
  }

  function buildExportHref() {
    const params = new URLSearchParams(searchParams.toString());
    return `/admin/reports/export?${params.toString()}`;
  }

  function handleSheetSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    const sheetNames = ["city", "service", "staffId", "source", "status", "paymentStatus"];
    for (const name of sheetNames) {
      const value = formData.get(name);
      if (typeof value === "string" && value.trim() !== "") {
        params.set(name, value);
      } else {
        params.delete(name);
      }
    }
    startTransition(() => {
      router.push(`/admin/dashboard?${params.toString()}`, { scroll: false });
    });
  }

  function handleClearAll() {
    const params = new URLSearchParams();
    if (filters.range && filters.range !== "custom") {
      params.set("range", filters.range);
    }
    startTransition(() => {
      router.push(`/admin/dashboard?${params.toString()}`, { scroll: false });
    });
  }

  const ADVANCED_FILTER_KEYS = ["city", "service", "staffId", "source", "status", "paymentStatus"] as const;
  const ADVANCED_FILTER_LABELS: Record<(typeof ADVANCED_FILTER_KEYS)[number], string> = {
    city: "City",
    service: "Service",
    staffId: "Therapist",
    source: "Source",
    status: "Status",
    paymentStatus: "Payment",
  };
  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const formatPillValue = (key: (typeof ADVANCED_FILTER_KEYS)[number], value: string) => {
    if (key === "staffId") return staffNameById.get(value) ?? value;
    return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const activePills = ADVANCED_FILTER_KEYS
    .map((key) => ({ key, value: (filters as ReportFilters)[key as keyof ReportFilters] as string | undefined }))
    .filter((p) => p.value && p.value.trim() !== "")
    .map((p) => ({ ...p, value: p.value as string }));

  function buildPillRemoveHref(key: (typeof ADVANCED_FILTER_KEYS)[number]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    return `/admin/dashboard?${params.toString()}`;
  }

  function handleCustomSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    const from = (formData.get("from") as string) || "";
    const to = (formData.get("to") as string) || "";
    if (from && to && from > to) return;
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("range", "custom");
    startTransition(() => {
      router.push(`/admin/dashboard?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <section
      className={cn(
        "sticky top-0 z-20 overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] shadow-[var(--admin-shadow-subtle)] backdrop-blur-md transition-opacity",
        "bg-gradient-to-b from-[var(--admin-panel)]/95 to-[var(--admin-panel-muted)]/85",
        isPending && "pointer-events-none opacity-60"
      )}
      aria-busy={isPending}
    >
      {/* Row 1: Date range segmented control + secondary actions */}
      <div className="flex flex-col gap-3 px-3 pt-3 pb-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
        <fieldset className="min-w-0 flex-1 border-0 p-0 m-0">
          <legend className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-text-muted)]">
            Date range
          </legend>
          <div
            role="group"
            aria-label="Date range presets"
            className="inline-flex min-w-0 max-w-full snap-x snap-mandatory items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
          >
            {presets.map((preset) => {
              const isActive = preset.key === activePreset;
              return (
                <Link
                  key={preset.key}
                  href={buildPresetHref(preset)}
                  aria-current={isActive ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "group inline-flex h-10 shrink-0 snap-start items-center justify-center rounded-full border px-4 text-[13px] font-semibold outline-none transition-all duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 active:scale-[0.97]",
                    isActive
                      ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-white shadow-[0_2px_6px_oklch(23%_0.073_155/0.28),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[var(--admin-primary-hover)]"
                      : "border-[var(--admin-border)] bg-white text-[var(--admin-body)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:-translate-y-px hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-panel-muted)]/60 hover:text-[var(--admin-heading)] hover:shadow-[0_2px_5px_rgba(0,0,0,0.04)]"
                  )}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>
        </fieldset>

        {isCustom ? (
          <form
            onSubmit={handleCustomSubmit}
            className="hidden flex-wrap items-end gap-2 sm:flex"
          >
            <DateInput label="From" name="from" defaultValue={filters.from} />
            <DateInput label="To" name="to" defaultValue={filters.to} />
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                buttonVariants({ size: "sm" }),
                "inline-flex h-10 items-center justify-center gap-2 bg-[var(--admin-primary)] px-4 text-white hover:bg-[var(--admin-primary-hover)] disabled:opacity-50"
              )}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Apply dates
            </button>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          <AdminSheet
            title="More filters"
            description="Narrow the dashboard to a specific staff member, service, source, status, or payment state."
            side="right"
            trigger={
              <button
                type="button"
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
                  activeAdvancedFilters > 0
                    ? "border-[var(--admin-warning-bg)] bg-[var(--admin-warning-bg)]/60 text-[var(--admin-heading)] hover:bg-[var(--admin-warning-bg)]/85"
                    : "border-[var(--admin-border)] bg-white text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]/70"
                )}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                <span>Filters</span>
                {activeAdvancedFilters > 0 ? (
                  <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-[var(--admin-warning)] text-[10px] font-bold text-white tabular-nums">
                    {activeAdvancedFilters}
                  </span>
                ) : null}
              </button>
            }
          >
            <form onSubmit={handleSheetSubmit} className="grid gap-3">
              <CityCombobox
                label="City"
                name="city"
                listId="dashboard-city-options-sheet"
                defaultValue={filters.city}
                options={cityOptions}
              />
              <FormSelect label="Service" name="service" defaultValue={filters.service}>
                <option value="">All services</option>
                {serviceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </FormSelect>
              {showStaffFilter ? (
                <FormSelect label="Therapist" name="staffId" defaultValue={filters.staffId}>
                  <option value="">All staff</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </FormSelect>
              ) : null}
              <FormSelect label="Source" name="source" defaultValue={filters.source}>
                <option value="">All sources</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {formatFilterLabel(source)}
                  </option>
                ))}
              </FormSelect>
              <FormSelect label="Status" name="status" defaultValue={filters.status}>
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatFilterLabel(status)}
                  </option>
                ))}
              </FormSelect>
              <FormSelect label="Payment" name="paymentStatus" defaultValue={filters.paymentStatus}>
                <option value="">All payments</option>
                {paymentOptions.map((payment) => (
                  <option key={payment} value={payment}>
                    {formatFilterLabel(payment)}
                  </option>
                ))}
              </FormSelect>
              <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--admin-border)] pt-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 bg-[var(--admin-primary)] px-4 text-white disabled:opacity-50"
                  )}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isPending}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "min-h-11 flex-1 bg-white text-[var(--admin-body)]"
                  )}
                >
                  Clear all
                </button>
              </div>
            </form>
          </AdminSheet>

          {canExport ? (
            <Link
              href={buildExportHref()}
              prefetch={false}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-transparent px-3 text-[13px] font-semibold text-[var(--admin-primary)] outline-none transition-all hover:border-[var(--admin-border)] hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              title="Download a CSV with current filters"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Export</span>
            </Link>
          ) : null}
        </div>
      </div>

      {isCustom ? (
        <form
          onSubmit={handleCustomSubmit}
          className="mt-1 grid grid-cols-2 gap-2 border-t border-[var(--admin-border)]/60 px-3 pb-3 pt-3 sm:hidden"
        >
          <DateInput label="From" name="from" defaultValue={filters.from} />
          <DateInput label="To" name="to" defaultValue={filters.to} />
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              buttonVariants({ size: "sm" }),
              "col-span-2 inline-flex h-11 items-center justify-center gap-2 bg-[var(--admin-primary)] px-4 text-white hover:bg-[var(--admin-primary-hover)] disabled:opacity-50"
            )}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Apply dates
          </button>
        </form>
      ) : null}

      {scopeSummary ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--admin-border)]/60 px-4 py-2.5 text-xs text-[var(--admin-text-muted)]">
          <ScopeStat icon={CalendarClock} value={scopeSummary.bookings.toLocaleString("en-GB")} label={`booking${scopeSummary.bookings === 1 ? "" : "s"}`} />
          <ScopeStat icon={ShieldAlert} value={scopeSummary.attention.toLocaleString("en-GB")} label="attention" />
          {scopeSummary.revenueAllowed ? (
            <ScopeStat icon={PoundSterling} value={formatPounds(scopeSummary.outstanding)} label="outstanding" />
          ) : null}
          <ScopeStat icon={Users} value={scopeSummary.clients.toLocaleString("en-GB")} label={`client${scopeSummary.clients === 1 ? "" : "s"}`} />
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-panel)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-heading)] shadow-[var(--admin-shadow-subtle)]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--admin-success)]" />
            {scopeSummary.rangeLabel}
          </span>
        </div>
      ) : null}

      {activePills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--admin-border)]/60 bg-[var(--admin-warning-bg)]/20 px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-text-muted)]">
            Filtered by
          </span>
          {activePills.map((pill) => (
            <Link
              key={pill.key}
              href={buildPillRemoveHref(pill.key)}
              scroll={false}
              aria-label={`Remove ${ADVANCED_FILTER_LABELS[pill.key]} filter (${formatPillValue(pill.key, pill.value)})`}
              className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-warning-bg)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--admin-body)] outline-none transition-all hover:border-[var(--admin-warning)]/50 hover:bg-[var(--admin-warning-bg)]/60 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              <span className="text-[var(--admin-text-muted)]">{ADVANCED_FILTER_LABELS[pill.key]}:</span>
              <span className="font-semibold text-[var(--admin-heading)]">{formatPillValue(pill.key, pill.value)}</span>
              <span
                aria-hidden="true"
                className="ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--admin-warning-bg)]/80 text-[var(--admin-text-muted)] transition-colors group-hover:bg-[var(--admin-warning)] group-hover:text-white"
              >
                <X className="size-2.5" />
              </span>
            </Link>
          ))}
          {activePills.length > 1 ? (
            <Link
              href={(() => {
                const params = new URLSearchParams(searchParams.toString());
                ADVANCED_FILTER_KEYS.forEach((k) => params.delete(k));
                return `/admin/dashboard?${params.toString()}`;
              })()}
              scroll={false}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              Clear all
              <X aria-hidden="true" className="size-3" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ScopeStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" className="size-3 text-[var(--admin-text-muted)]/60" />
      <span className="font-semibold text-[var(--admin-heading)] tabular-nums">{value}</span>
      <span className="text-[var(--admin-text-muted)]">{label}</span>
    </span>
  );
}

function formatPounds(pence: number) {
  if (!pence || pence === 0) return "£0";
  const pounds = pence;
  if (pounds >= 1000) return `£${(pounds / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pounds);
}

const DISCLOSURE_STORAGE_PREFIX = "rahmatherapy-business-overview-expanded-";
const DISCLOSURE_DURATION_MS = 240;

export function BusinessOverviewDisclosure({
  staffId,
  hasActivity,
  children,
}: {
  staffId: string;
  hasActivity: boolean;
  children: ReactNode;
}) {
  const storageKey = `${DISCLOSURE_STORAGE_PREFIX}${staffId}`;
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "1") setExpanded(true);
    } catch {
      // localStorage unavailable in private mode etc. - keep collapsed
    }
    if (typeof window.matchMedia === "function") {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mql.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mql.addEventListener?.("change", handler);
      return () => mql.removeEventListener?.("change", handler);
    }
  }, [storageKey]);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // ignore quota / privacy errors
    }
  }

  const headingLabel = hasActivity ? "Business overview" : "Business overview (no activity yet)";
  const buttonLabel = expanded ? "Hide business overview" : "Show business overview";
  const disabled = !hasActivity;
  const showChildren = hasActivity && hydrated && expanded;

  return (
    <section
      aria-labelledby="business-overview-heading"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] shadow-[var(--admin-shadow-subtle)]"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls="business-overview-panel"
        aria-label={buttonLabel}
        disabled={disabled}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-[var(--admin-radius-card)] px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 sm:px-5 sm:py-4",
          disabled
            ? "cursor-not-allowed opacity-70"
            : "hover:bg-[var(--admin-panel-muted)]/60"
        )}
      >
        <div className="min-w-0">
          <h2
            id="business-overview-heading"
            className="admin-display text-[1.05rem] font-bold leading-tight text-[var(--admin-heading)] sm:text-[1.15rem]"
          >
            {headingLabel}
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-text-muted)] sm:text-sm">
            {hasActivity
              ? "Staff capacity, payment health, operational signals, demand trend."
              : "Sub-tiles unlock as bookings, payments and operational events accumulate."}
          </p>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-5 shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 ease-out",
            expanded && "rotate-180"
          )}
        />
      </button>

      <div
        id="business-overview-panel"
        role="region"
        aria-labelledby="business-overview-heading"
        hidden={!showChildren}
        className={cn(
          "grid overflow-hidden border-t border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/40 transition-[grid-template-rows] ease-out",
          showChildren ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          prefersReducedMotion ? "duration-0" : "duration-[240ms]"
        )}
        style={{
          transitionDuration: prefersReducedMotion ? "0ms" : `${DISCLOSURE_DURATION_MS}ms`,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-4 p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </section>
  );
}
