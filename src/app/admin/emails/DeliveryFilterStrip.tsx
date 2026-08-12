"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AdminSheet } from "../components/admin-ui-interactions";
import { cn } from "@/lib/utils";
import {
  DATE_RANGE_PRESETS,
  DELIVERY_STATUSES,
  EMAIL_EVENT_TYPES,
  RECIPIENT_ROLES,
  RECIPIENT_ROLE_LABEL,
  SEARCH_MIN_CHARS,
  hasAnyDeliveryFilter,
  labelForDeliveryStatus,
  labelForEventType,
  type DateRangePresetKey,
  type DeliveryFilters,
} from "./format";

interface DeliveryFilterStripProps {
  initialValues: DeliveryFilters;
  allowAdminRecipient: boolean;
}

function toUrl(values: DeliveryFilters): string {
  const params = new URLSearchParams();
  params.set("tab", "delivery");
  if (values.q) params.set("q", values.q);
  if (values.event_type) params.set("event_type", values.event_type);
  if (values.delivery_status) params.set("delivery_status", values.delivery_status);
  if (values.recipient_role) params.set("recipient_role", values.recipient_role);
  if (values.range && values.range !== "last_30_days") params.set("range", values.range);
  if (values.range === "custom") {
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
  }
  return `/admin/emails?${params.toString()}`;
}

export function DeliveryFilterStrip({
  initialValues,
  allowAdminRecipient,
}: DeliveryFilterStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<DeliveryFilters>(initialValues);
  const [searchError, setSearchError] = useState<string | null>(null);

  const submit = (next: DeliveryFilters) => {
    setValues(next);
    startTransition(() => router.push(toUrl(next)));
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = values.q.trim();
    if (raw.length > 0 && raw.length < SEARCH_MIN_CHARS) {
      setSearchError("Type at least 4 characters of an email or event ID.");
      return;
    }
    setSearchError(null);
    submit({ ...values, q: raw });
  };

  const activeRange = values.range || "last_30_days";
  const hasFilters = hasAnyDeliveryFilter(values);

  const activeChips: { key: string; label: string; clearTo: DeliveryFilters }[] = [];
  if (values.q) {
    activeChips.push({ key: "q", label: `“${values.q}”`, clearTo: { ...values, q: "" } });
  }
  if (values.event_type) {
    activeChips.push({
      key: "event_type",
      label: `Event: ${labelForEventType(values.event_type)}`,
      clearTo: { ...values, event_type: "" },
    });
  }
  if (values.delivery_status) {
    activeChips.push({
      key: "delivery_status",
      label: `Status: ${labelForDeliveryStatus(values.delivery_status)}`,
      clearTo: { ...values, delivery_status: "" },
    });
  }
  if (values.recipient_role) {
    activeChips.push({
      key: "recipient_role",
      label: `Recipient: ${RECIPIENT_ROLE_LABEL[values.recipient_role] ?? values.recipient_role}`,
      clearTo: { ...values, recipient_role: "" },
    });
  }
  if (activeRange !== "last_30_days") {
    // Suppress the chip when Custom is selected without any date set — the
    // applied filter is a no-op until from/to is filled in.
    const customWithoutDates =
      activeRange === "custom" && !values.from && !values.to;
    if (!customWithoutDates) {
      activeChips.push({
        key: "range",
        label:
          activeRange === "custom"
            ? `Range: ${values.from || "…"} → ${values.to || "…"}`
            : `Range: ${DATE_RANGE_PRESETS.find((p) => p.key === activeRange)?.label ?? activeRange}`,
        clearTo: { ...values, range: "last_30_days", from: "", to: "" },
      });
    }
  }

  const desktopForm = (
    <FilterInputs
      values={values}
      setValues={setValues}
      allowAdminRecipient={allowAdminRecipient}
      searchError={searchError}
      onSubmit={onSearchSubmit}
      submit={submit}
      mode="desktop"
    />
  );

  return (
    <div className="grid gap-3">
      {/* Tablet / desktop (≥768px) — visible inline; wraps to multiple rows on tablet, single row at `lg:` */}
      <div className="hidden md:block">
        <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3">
          {desktopForm}
        </div>
      </div>

      {/* Mobile (<768px) — collapsed behind an AdminSheet trigger */}
      <div className="flex items-center gap-2 md:hidden">
        <form onSubmit={onSearchSubmit} className="flex min-w-0 flex-1 items-center gap-2">
          <label htmlFor="emails-q-mobile" className="sr-only">
            Search
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
              aria-hidden="true"
            />
            <input
              id="emails-q-mobile"
              type="search"
              name="q"
              value={values.q}
              onChange={(event) =>
                setValues((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Email or event ID"
              aria-describedby={searchError ? "emails-q-mobile-error" : undefined}
              aria-invalid={searchError ? "true" : undefined}
              className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-8 pr-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
            />
          </div>
        </form>
        <AdminSheet
          title="Filters"
          description="Refine the delivery feed."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters
              {hasFilters ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--admin-status-attention-bg)] px-1.5 text-[0.6875rem] font-semibold text-[var(--admin-status-attention-text)]">
                  {activeChips.length || ""}
                </span>
              ) : null}
            </button>
          }
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                href="/admin/emails?tab=delivery"
                className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Clear filters
              </Link>
              <button
                type="button"
                onClick={() => submit(values)}
                disabled={isPending}
                className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60"
              >
                Apply filters
              </button>
            </div>
          }
        >
          <FilterInputs
            values={values}
            setValues={setValues}
            allowAdminRecipient={allowAdminRecipient}
            searchError={searchError}
            onSubmit={(event) => {
              event.preventDefault();
              submit(values);
            }}
            submit={submit}
            mode="mobile"
          />
        </AdminSheet>
      </div>
      {searchError ? (
        <p
          id="emails-q-mobile-error"
          role="alert"
          aria-live="polite"
          className="md:hidden text-xs text-[var(--admin-status-cancelled-text)]"
        >
          {searchError}
        </p>
      ) : null}

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--admin-text-muted)]">Filters:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => submit(chip.clearTo)}
              className="group inline-flex items-center gap-1 rounded-full border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-2.5 py-1 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors duration-150 hover:border-[oklch(70%_0.10_25)] hover:bg-[var(--admin-status-cancelled-bg)] hover:text-[var(--admin-status-cancelled-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <span>{chip.label}</span>
              <X className="size-3 shrink-0 transition-transform group-hover:rotate-90" aria-hidden="true" />
              <span className="sr-only">Clear filter</span>
            </button>
          ))}
          <Link
            href="/admin/emails?tab=delivery"
            className="ml-1 inline-flex min-h-8 items-center rounded-[var(--admin-radius-control)] px-2 text-xs font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Clear filters
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function FilterInputs({
  values,
  setValues,
  allowAdminRecipient,
  searchError,
  onSubmit,
  submit,
  mode,
}: {
  values: DeliveryFilters;
  setValues: React.Dispatch<React.SetStateAction<DeliveryFilters>>;
  allowAdminRecipient: boolean;
  searchError: string | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submit: (next: DeliveryFilters) => void;
  mode: "desktop" | "mobile";
}) {
  const qId = useId();
  const eventId = useId();
  const statusId = useId();
  const recipientId = useId();
  const fromId = useId();
  const toId = useId();

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "grid gap-3",
        mode === "desktop"
          ? "md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] lg:items-end"
          : "grid-cols-1"
      )}
    >
      <Field>
        <Label htmlFor={qId}>Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
            aria-hidden="true"
          />
          <input
            id={qId}
            name="q"
            type="search"
            placeholder="Email or event ID"
            value={values.q}
            onChange={(event) =>
              setValues((current) => ({ ...current, q: event.target.value }))
            }
            aria-describedby={searchError ? `${qId}-error` : undefined}
            aria-invalid={searchError ? "true" : undefined}
            className={cn(
              "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] pl-8 pr-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
              searchError ? "border-[oklch(70%_0.10_25)]" : "border-[var(--admin-border-form)]"
            )}
          />
        </div>
        {searchError ? (
          <p
            id={`${qId}-error`}
            role="alert"
            aria-live="polite"
            className="mt-1 text-xs text-[var(--admin-status-cancelled-text)]"
          >
            {searchError}
          </p>
        ) : null}
      </Field>

      <Field>
        <Label htmlFor={eventId}>Event type</Label>
        <Select
          id={eventId}
          name="event_type"
          value={values.event_type}
          onChange={(event) => {
            const next = { ...values, event_type: event.target.value };
            setValues(next);
          }}
        >
          <option value="">All events</option>
          {EMAIL_EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {labelForEventType(type)}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor={statusId}>Delivery status</Label>
        <Select
          id={statusId}
          name="delivery_status"
          value={values.delivery_status}
          onChange={(event) =>
            setValues((current) => ({ ...current, delivery_status: event.target.value }))
          }
        >
          <option value="">Any status</option>
          {DELIVERY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {labelForDeliveryStatus(status)}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor={recipientId}>Recipient</Label>
        <Select
          id={recipientId}
          name="recipient_role"
          value={values.recipient_role}
          onChange={(event) =>
            setValues((current) => ({ ...current, recipient_role: event.target.value }))
          }
        >
          <option value="">Any recipient</option>
          {RECIPIENT_ROLES.filter(
            (role) => role !== "admin" || allowAdminRecipient
          ).map((role) => (
            <option key={role} value={role}>
              {RECIPIENT_ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-wrap items-end gap-2">
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 hover:bg-[var(--admin-panel-muted)] hover:border-[var(--admin-primary)]/40 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Apply filters
        </button>
        {hasAnyDeliveryFilter(values) ? (
          <Link
            href="/admin/emails?tab=delivery"
            className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] px-2 text-sm font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      <fieldset className={cn("col-span-full grid gap-2", mode === "desktop" ? "lg:grid-cols-[auto_1fr] lg:items-center" : "")}>
        <legend className="sr-only">Range</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--admin-text-muted)]">Range:</span>
          {DATE_RANGE_PRESETS.map((preset) => {
            const isActive = (values.range || "last_30_days") === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  const next: DeliveryFilters = {
                    ...values,
                    range: preset.key as DateRangePresetKey,
                    from: preset.key === "custom" ? values.from : "",
                    to: preset.key === "custom" ? values.to : "",
                  };
                  // Brief §7: preset chips submit immediately; Custom opens the
                  // date inputs without submitting (the operator still picks the
                  // from/to before applying).
                  if (preset.key === "custom") {
                    setValues(next);
                  } else {
                    submit(next);
                  }
                }}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                  isActive
                    ? "border-[var(--admin-primary)] bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)]"
                    : "border-[var(--admin-border-form)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-panel-muted)]"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {values.range === "custom" ? (
          <div className="flex flex-wrap gap-3">
            <div className="grid gap-1">
              <Label htmlFor={fromId}>From</Label>
              <input
                id={fromId}
                type="date"
                name="from"
                value={values.from}
                onChange={(event) =>
                  setValues((current) => ({ ...current, from: event.target.value }))
                }
                className="flex h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={toId}>To</Label>
              <input
                id={toId}
                type="date"
                name="to"
                value={values.to}
                onChange={(event) =>
                  setValues((current) => ({ ...current, to: event.target.value }))
                }
                className="flex h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              />
            </div>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-1">{children}</div>;
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-medium text-[var(--admin-heading)]"
    >
      {children}
    </label>
  );
}

function Select({
  id,
  name,
  value,
  onChange,
  children,
}: {
  id: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-2 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
    >
      {children}
    </select>
  );
}
