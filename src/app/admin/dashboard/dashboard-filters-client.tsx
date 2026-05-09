"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useTransition } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AdminSegmentedControl,
  AdminStatusBadge,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import type { ReportFilters } from "../reports/reporting";

const DATE_CHIP_PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
] as const;

function addBusinessDaysClient(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeDate(date: string | undefined) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function DateQuickChips({
  from,
  to,
  today,
  getHref,
}: {
  from?: string;
  to?: string;
  today: string;
  getHref: (from: string, to: string) => string;
}) {
  const normalizedFrom = normalizeDate(from);
  const normalizedTo = normalizeDate(to);
  const normalizedToday = normalizeDate(today);

  return (
    <AdminSegmentedControl
      className="hidden sm:inline-flex"
      items={DATE_CHIP_PRESETS.map((preset) => {
        const presetTo = addBusinessDaysClient(normalizedToday, preset.days);
        return {
          key: preset.label,
          label: preset.label,
          href: getHref(normalizedToday, presetTo),
          active: normalizedFrom === normalizedToday && normalizedTo === presetTo,
        };
      })}
    />
  );
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
      {label}
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
      {label}
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
      {label}
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

export function DashboardFiltersClient({
  staff,
  serviceOptions,
  sourceOptions = [],
  statusOptions = [],
  paymentOptions = [],
  cityOptions = [],
  today,
  filters,
  assignedOnly,
  revenueAllowed,
}: {
  staff: { id: string; name: string }[];
  serviceOptions: string[];
  sourceOptions?: string[];
  statusOptions?: string[];
  paymentOptions?: string[];
  cityOptions?: string[];
  today: string;
  filters: ReportFilters;
  assignedOnly: boolean;
  revenueAllowed: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeAdvancedFilters = [
    filters.source,
    filters.status,
    filters.paymentStatus,
  ].filter(Boolean).length;
  const showStaffFilter = staff.length > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim() !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    startTransition(() => {
      router.push(`/admin/dashboard?${params.toString()}`, { scroll: false });
    });
  }

  function getDateChipHref(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", from === today && to === today ? "today" : "custom");
    params.set("from", from);
    params.set("to", to);
    const query = params.toString();
    return query ? `/admin/dashboard?${query}` : "/admin/dashboard";
  }

  function formatFilterLabel(str: string) {
    if (!str) return "";
    return str
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return (
    <section
      className={cn(
        "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3.5 shadow-[var(--admin-shadow-subtle)] transition-opacity",
        isPending && "pointer-events-none opacity-60"
      )}
    >
      <form onSubmit={handleSubmit} className="hidden xl:block">
        <input type="hidden" name="range" value={filters.range} />
        <div className="flex flex-wrap items-end gap-2">
          <DateQuickChips
            from={filters.from}
            to={filters.to}
            today={today}
            getHref={getDateChipHref}
          />
          <DateInput label="From" name="from" defaultValue={filters.from} />
          <DateInput label="To" name="to" defaultValue={filters.to} />
          <CityCombobox
            label="City"
            name="city"
            listId="dashboard-city-options-desktop"
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
            <FormSelect label="Staff" name="staffId" defaultValue={filters.staffId}>
              <option value="">All staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </FormSelect>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              buttonVariants({ size: "sm" }),
              "inline-flex h-10 min-w-[4.75rem] items-center justify-center gap-2 bg-[var(--admin-primary)] px-4 text-white hover:bg-[var(--admin-primary-hover)] disabled:opacity-50"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Applying
              </>
            ) : (
              "Apply"
            )}
          </button>
          <Link
            href="/admin/dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-10 min-w-[4.75rem] bg-white px-4"
            )}
          >
            Reset
          </Link>
          <AdvancedFilterDetails
            activeAdvancedFilters={activeAdvancedFilters}
            filters={filters}
            sourceOptions={sourceOptions}
            statusOptions={statusOptions}
            paymentOptions={paymentOptions}
            formatFilterLabel={formatFilterLabel}
            isPending={isPending}
          />
        </div>
      </form>

      <div className="grid gap-3 xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <DateQuickChips
            from={filters.from}
            to={filters.to}
            today={today}
            getHref={getDateChipHref}
          />
          <div className="hidden min-w-0 text-sm text-[var(--admin-text-muted)] sm:block">
            {filters.from} to {filters.to}
          </div>
        </div>
        <div className="grid gap-2 rounded-[var(--admin-radius-card)] bg-[var(--admin-panel-muted)] px-3 py-3 text-sm sm:hidden">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
            Scope
          </span>
          <span className="font-semibold text-[var(--admin-heading)]">
            {filters.from} to {filters.to}
          </span>
          <span className="text-[var(--admin-text-muted)]">
            {assignedOnly ? "Assigned bookings only" : "Permitted records"}
            {!revenueAllowed ? " - revenue hidden" : ""}
          </span>
        </div>
      </div>

      <div className="mt-3 xl:hidden">
        <AdminSheet
          title="Filters"
          description="Refine dashboard scope."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)]/80 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              <SlidersHorizontal className="size-4 text-[var(--admin-primary)]" />
              Filters
              {activeAdvancedFilters > 0 ? (
                <AdminStatusBadge value={`${activeAdvancedFilters} advanced`} tone="info" />
              ) : null}
            </button>
          }
        >
          <form onSubmit={handleSubmit} className="grid gap-3">
            <input type="hidden" name="range" value={filters.range} />
            <DateInput label="From" name="from" defaultValue={filters.from} />
            <DateInput label="To" name="to" defaultValue={filters.to} />
            <CityCombobox
              label="City"
              name="city"
              listId="dashboard-city-options-mobile"
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
              <FormSelect label="Staff" name="staffId" defaultValue={filters.staffId}>
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
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 bg-[var(--admin-primary)] px-4 text-white disabled:opacity-50"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Applying
                  </>
                ) : (
                  "Apply"
                )}
              </button>
              <Link
                href="/admin/dashboard"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "min-h-11 flex-1 bg-white"
                )}
              >
                Reset
              </Link>
            </div>
          </form>
        </AdminSheet>
      </div>
    </section>
  );
}

function AdvancedFilterDetails({
  activeAdvancedFilters,
  filters,
  sourceOptions,
  statusOptions,
  paymentOptions,
  formatFilterLabel,
  isPending,
}: {
  activeAdvancedFilters: number;
  filters: ReportFilters;
  sourceOptions: string[];
  statusOptions: string[];
  paymentOptions: string[];
  formatFilterLabel: (value: string) => string;
  isPending: boolean;
}) {
  return (
    <details className="relative">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4 text-[var(--admin-primary)]" aria-hidden="true" />
        More
        {activeAdvancedFilters > 0 ? (
          <AdminStatusBadge value={`${activeAdvancedFilters}`} tone="info" />
        ) : null}
      </summary>
      <div className="absolute right-0 top-12 z-20 w-[30rem] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 shadow-elevated">
        <div className="grid gap-3 sm:grid-cols-3">
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
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--admin-text-muted)]">
          These filters are preserved from the existing dashboard and apply with the main Apply button.
          {isPending ? " Applying changes." : ""}
        </p>
      </div>
    </details>
  );
}
