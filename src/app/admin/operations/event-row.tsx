"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Check, ChevronDown, ChevronUp, Clock, Copy, Info, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminStatusBadge } from "../components/admin-ui";
import { updateOperationalEventStatus } from "./actions";

export interface OperationalEventRow {
  id: string;
  event_type: string;
  severity: "info" | "warning" | "error";
  status: "open" | "acknowledged" | "resolved";
  summary: string;
  safe_context: Record<string, unknown>;
  booking_id: string | null;
  staff_id: string | null;
  created_at: string;
}

interface EventRowProps {
  event: OperationalEventRow;
  /** Column the row currently appears in (may differ from event.status during optimistic transitions). */
  column: "open" | "acknowledged" | "resolved";
  /** Called after a successful status transition so the parent can migrate the row. */
  onTransitioned: (eventId: string, nextStatus: "acknowledged" | "resolved") => void;
  /** Called when a transition fails so the parent can roll back the optimistic move. */
  onTransitionFailed: (eventId: string, prevColumn: "open" | "acknowledged" | "resolved") => void;
}

const severityCopy: Record<OperationalEventRow["severity"], { label: string; tone: "danger" | "warning" | "restricted"; icon: typeof AlertCircle; title: string }> = {
  error: {
    label: "Error",
    tone: "danger",
    icon: XCircle,
    title: "Error: needs attention soon",
  },
  warning: {
    label: "Warning",
    tone: "warning",
    icon: AlertCircle,
    title: "Warning: keep an eye on it",
  },
  info: {
    label: "Info",
    tone: "restricted",
    icon: Info,
    title: "Info: for the record",
  },
};

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatRelative(value: string) {
  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function formatAbsolute(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function truncateId(id: string) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function previewValue(value: unknown): string {
  if (value === null || value === undefined) return "(none)";
  if (typeof value === "string") {
    return value.length > 24 ? `${value.slice(0, 24)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "{…}";
}

export function EventRow({ event, column, onTransitioned, onTransitionFailed }: EventRowProps) {
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<"acknowledged" | "resolved" | null>(null);
  const [expanded, setExpanded] = useState(false);

  const severity = severityCopy[event.severity];
  const SeverityIcon = severity.icon;

  // Severity chip click → preserve existing filters, swap severity.
  function severityFilterUrl() {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("severity", event.severity);
    return `/admin/operations?${next.toString()}#operations-panel-open`;
  }
  const safeKeys = Object.keys(event.safe_context ?? {});
  const inlineKeys = safeKeys.slice(0, 4);
  const hiddenCount = Math.max(0, safeKeys.length - inlineKeys.length);

  const isOpenError = column === "open" && event.severity === "error";

  function submit(nextStatus: "acknowledged" | "resolved") {
    setPending(nextStatus);
    const previousColumn = column;
    onTransitioned(event.id, nextStatus);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("event_id", event.id);
        formData.set("status", nextStatus);
        await updateOperationalEventStatus(formData);
        toast.success(nextStatus === "acknowledged" ? "Acknowledged." : "Resolved.");
      } catch {
        onTransitionFailed(event.id, previousColumn);
        toast.error(
          nextStatus === "acknowledged"
            ? "Couldn't acknowledge that event. Try again."
            : "Couldn't resolve that event. Try again."
        );
      } finally {
        setPending(null);
      }
    });
  }

  function copySafeContextAsJson() {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    const formatted = JSON.stringify(event.safe_context ?? {}, null, 2);
    navigator.clipboard
      .writeText(formatted)
      .then(() => toast.success("Copied safe context."))
      .catch(() => toast.error("Couldn't copy. Select the JSON manually."));
  }

  const eventTypeLabel = formatLabel(event.event_type);

  return (
    <article
      aria-busy={pending !== null || undefined}
      data-severity={event.severity}
      data-status={column}
      className={cn(
        "relative rounded-[var(--admin-radius-card)] border p-4 transition-colors",
        isOpenError
          ? "border-[var(--admin-status-cancelled-border)] bg-[var(--admin-status-cancelled-bg)]"
          : "border-[var(--admin-border)] bg-[var(--admin-panel)]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Link
            href={severityFilterUrl()}
            title={`${severity.title}. Click to filter to ${severity.label.toLowerCase()}.`}
            data-redesign-fake="filter-query"
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
              severity.tone === "danger" && "bg-[var(--admin-status-cancelled-bg)] text-[var(--admin-status-cancelled-text)] hover:bg-[oklch(90%_0.05_20)]",
              severity.tone === "warning" && "bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)] hover:bg-[oklch(90%_0.07_65)]",
              severity.tone === "restricted" && "bg-[var(--admin-status-restricted-bg)] text-[var(--admin-status-restricted-text)] hover:bg-[oklch(90%_0.012_280)]"
            )}
          >
            <SeverityIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{severity.label}</span>
          </Link>
          <span
            title={event.event_type}
            className="inline-flex shrink-0 items-center rounded-full bg-[var(--admin-status-restricted-bg)] px-2.5 py-1 text-xs font-medium text-[var(--admin-status-restricted-text)]"
          >
            {eventTypeLabel}
          </span>
        </div>
        <time
          dateTime={event.created_at}
          title={formatAbsolute(event.created_at)}
          className="shrink-0 text-xs text-[var(--admin-text-muted)]"
        >
          {formatRelative(event.created_at)}
        </time>
      </div>

      <p
        title={event.summary}
        className="mt-2 text-[0.9375rem] font-medium leading-[1.45] text-[var(--admin-heading)] xl:line-clamp-1"
      >
        {event.summary}
      </p>

      {(event.booking_id || event.staff_id) ? (
        <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
          {event.booking_id ? (
            <Link
              href={`/admin/bookings/${event.booking_id}`}
              title="Open this booking"
              className="font-mono underline-offset-2 hover:text-[var(--admin-primary)] hover:underline"
            >
              Booking #{truncateId(event.booking_id)}
            </Link>
          ) : null}
          {event.booking_id && event.staff_id ? <span aria-hidden="true"> · </span> : null}
          {event.staff_id ? (
            <Link
              href={`/admin/staff/${event.staff_id}`}
              title="Open this staff member's record"
              className="underline-offset-2 hover:text-[var(--admin-primary)] hover:underline"
            >
              Staff: <span className="font-mono">{truncateId(event.staff_id)}</span>
            </Link>
          ) : null}
        </p>
      ) : null}

      {safeKeys.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {inlineKeys.map((key) => {
            const preview = previewValue(event.safe_context[key]);
            return (
              <span
                key={key}
                title={typeof event.safe_context[key] === "string" ? String(event.safe_context[key]) : preview}
                className="inline-flex max-w-[18rem] items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface-input)] px-2 py-0.5 font-mono text-[0.6875rem] text-[var(--admin-body)]"
              >
                <span className="text-[var(--admin-text-muted)]">{key}:</span>
                <span className="truncate">{preview}</span>
              </span>
            );
          })}
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              title="Show all safe-context fields"
              className="inline-flex items-center gap-1 rounded-[var(--admin-radius-control)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              +{hiddenCount} more
              {expanded ? (
                <ChevronUp className="size-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-3" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      {safeKeys.length > 0 ? (
        <details
          className="group mt-2 text-xs"
          open={expanded}
          onToggle={(event) => setExpanded((event.target as HTMLDetailsElement).open)}
        >
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-[var(--admin-radius-control)] px-1 py-0.5 text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-3 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            <span>Safe context</span>
          </summary>
          <div className="mt-2 grid gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface-input)] p-3">
            <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.6875rem] leading-relaxed text-[var(--admin-body)]">
              {JSON.stringify(event.safe_context ?? {}, null, 2)}
            </pre>
            <button
              type="button"
              onClick={copySafeContextAsJson}
              title="Click to copy as JSON"
              className="inline-flex h-7 w-fit items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-2 text-[0.6875rem] font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Copy className="size-3" aria-hidden="true" />
              Copy as JSON
            </button>
          </div>
        </details>
      ) : null}

      {column !== "resolved" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {column === "open" ? (
            <form
              action={updateOperationalEventStatus}
              onSubmit={(formEvent) => {
                formEvent.preventDefault();
                submit("acknowledged");
              }}
            >
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="status" value="acknowledged" />
              <button
                type="submit"
                disabled={pending !== null}
                aria-busy={pending === "acknowledged" || undefined}
                title="Mark this event as seen. Moves to Acknowledged."
                aria-label={`Acknowledge: ${event.summary}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending === "acknowledged" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                Acknowledge
              </button>
            </form>
          ) : null}
          <form
            action={updateOperationalEventStatus}
            onSubmit={(formEvent) => {
              formEvent.preventDefault();
              submit("resolved");
            }}
          >
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="status" value="resolved" />
            <button
              type="submit"
              disabled={pending !== null}
              aria-busy={pending === "resolved" || undefined}
              title="Mark this event resolved. Moves to Resolved."
              aria-label={`Resolve: ${event.summary}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === "resolved" ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              Resolve
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] text-[var(--admin-text-muted)]">
          <AdminStatusBadge value="Resolved" tone="success" compact />
        </p>
      )}
    </article>
  );
}
