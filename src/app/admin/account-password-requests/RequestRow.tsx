import Link from "next/link";
import { Clock, ExternalLink, Lock, UserCircle2 } from "lucide-react";
import { AdminPanel, AdminStatusBadge } from "../components/admin-ui";
import { ApproveModal } from "./ApproveModal";
import { RejectModal } from "./RejectModal";
import type { PasswordResetRequest } from "./page";

const BST_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

function formatAbsolute(iso: string): string {
  try {
    return `${BST_FORMATTER.format(new Date(iso))} BST`;
  } catch {
    return iso;
  }
}

function relativeFromNow(iso: string): { label: string; soon: boolean; passed: boolean } {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  let qty: number;
  let unit: string;
  if (absMs < hour) {
    qty = Math.max(1, Math.round(absMs / minute));
    unit = qty === 1 ? "minute" : "minutes";
  } else if (absMs < day) {
    qty = Math.max(1, Math.round(absMs / hour));
    unit = qty === 1 ? "hour" : "hours";
  } else {
    qty = Math.max(1, Math.round(absMs / day));
    unit = qty === 1 ? "day" : "days";
  }

  const passed = diffMs < 0;
  const soon = !passed && absMs < hour;
  const label = passed ? `${qty} ${unit} ago` : `${qty} ${unit}`;
  return { label, soon, passed };
}

function statusTone(status: PasswordResetRequest["status"]) {
  switch (status) {
    case "pending":
      return { tone: "warning" as const, value: "Pending review" };
    case "approved":
      return { tone: "success" as const, value: "Approved" };
    case "rejected":
      return { tone: "danger" as const, value: "Rejected" };
    case "expired":
      return { tone: "restricted" as const, value: "Expired" };
    case "used":
      return { tone: "default" as const, value: "Used" };
  }
}

export function RequestRow({
  row,
  currentReviewerName,
  canOpenAudit,
  currentTabStatus,
}: {
  row: PasswordResetRequest;
  currentReviewerName: string;
  canOpenAudit: boolean;
  /** The status filter the queue is currently on. Used to suppress redundant per-row pills (D1). */
  currentTabStatus: "pending" | "approved" | "rejected" | "expired" | "all";
}) {
  const status = statusTone(row.status);
  const submitted = relativeFromNow(row.created_at);
  const reviewed = row.reviewed_at ? relativeFromNow(row.reviewed_at) : null;
  const expires = relativeFromNow(row.expires_at);
  const expiredCreated = relativeFromNow(row.created_at);

  const isSelfReviewer = Boolean(
    row.reviewed_by_name &&
      currentReviewerName.localeCompare(row.reviewed_by_name, undefined, {
        sensitivity: "base",
      }) === 0
  );
  const reviewerLabel = isSelfReviewer ? "you" : (row.reviewed_by_name ?? "reviewer");
  // D2: use the same first-8 slice the audit query uses so operators can visually align
  // the row's ID label with the `?q=…` slug shown in /admin/audit.
  const auditIdSlug = row.id.slice(0, 8);
  const auditHref = `/admin/audit?q=${auditIdSlug}`;
  // D1: hide the per-row pill on the Pending tab (the tab title already carries that state).
  const showStatusPill = !(currentTabStatus === "pending" && row.status === "pending");

  return (
    <AdminPanel className="!p-0 overflow-hidden transition-colors duration-150 hover:bg-[var(--admin-panel-muted)] focus-within:bg-[var(--admin-panel-muted)]">
      <article
        className="flex min-w-0 flex-col gap-2.5 p-4 sm:gap-3 sm:p-5"
        aria-labelledby={`req-${row.id}-heading`}
      >
        <h2 id={`req-${row.id}-heading`} className="sr-only">
          Password-reset request from {row.email}, {status.value}.
        </h2>

        <header className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-hover-mist)]"
              aria-hidden="true"
            >
              <UserCircle2 className="size-5 text-[var(--admin-text-muted)]" />
            </span>
            <p
              className="font-display min-w-0 flex-1 truncate text-[1.125rem] font-medium leading-[1.35] tracking-[-0.01em] text-[var(--admin-heading)] sm:text-[1.333rem]"
              title={row.email}
            >
              {row.email}
            </p>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            {showStatusPill ? (
              <AdminStatusBadge value={status.value} tone={status.tone} compact />
            ) : null}
            <time
              dateTime={row.created_at}
              title={`Submitted ${formatAbsolute(row.created_at)}`}
              className="text-[0.7rem] font-medium text-[var(--admin-text-muted)]"
            >
              {submitted.passed ? submitted.label : `in ${submitted.label}`}
            </time>
            <span
              title={`Full id: ${row.id}`}
              className="font-mono text-[0.65rem] uppercase tracking-[0.04em] text-[var(--admin-text-muted)]"
            >
              ID {auditIdSlug}…
            </span>
          </div>
        </header>

        {row.status === "pending" ? (
          <p
            className={
              expires.soon
                ? "flex items-center gap-1.5 text-sm font-medium text-[var(--admin-status-pending-text)]"
                : "flex items-center gap-1.5 text-sm text-[var(--admin-text-muted)]"
            }
            title={
              expires.soon
                ? `Expires soon: less than ${expires.label} left.`
                : `Expires ${formatAbsolute(row.expires_at)}`
            }
            aria-live={expires.soon ? "polite" : undefined}
          >
            <Clock
              className={
                expires.soon
                  ? "size-3.5 shrink-0 motion-safe:animate-pulse"
                  : "size-3.5 shrink-0"
              }
              aria-hidden="true"
            />
            {expires.passed ? (
              <span>Already expired.</span>
            ) : expires.soon ? (
              <span>Expires soon. Less than {expires.label} left.</span>
            ) : (
              <span>Expires in {expires.label}.</span>
            )}
          </p>
        ) : null}

        {(row.status === "approved" || row.status === "rejected") && reviewed ? (
          <p className="text-sm text-[var(--admin-text-muted)]">
            {row.status === "approved" ? "Approved" : "Rejected"} by {reviewerLabel} {reviewed.label}.
          </p>
        ) : null}

        {row.status === "expired" ? (
          <p className="flex items-center gap-1.5 text-sm text-[var(--admin-text-muted)]">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Expired {expiredCreated.label} without review.</span>
          </p>
        ) : null}

        {row.reviewer_note &&
        (row.status === "approved" || row.status === "rejected") ? (
          <blockquote
            className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-canvas)] px-4 py-3"
            aria-label={`Reviewer note from ${reviewerLabel}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
              Note from {reviewerLabel}
            </p>
            <p className="mt-1.5 max-h-[12em] overflow-hidden whitespace-pre-wrap text-sm leading-6 text-[var(--admin-body)]">
              {row.reviewer_note}
            </p>
          </blockquote>
        ) : null}

        <footer className="-mx-1 -mb-1 mt-1 flex flex-col gap-2 border-t border-[var(--admin-border)]/60 px-1 pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
          {row.status === "pending" ? (
            <>
              <ApproveModal requestId={row.id} email={row.email} />
              <RejectModal requestId={row.id} email={row.email} />
              {canOpenAudit ? (
                <Link
                  href={auditHref}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  Open audit row
                </Link>
              ) : (
                <p className="px-3 text-xs italic text-[var(--admin-text-muted)] sm:text-right">
                  Audit details available to the owner only.
                </p>
              )}
            </>
          ) : canOpenAudit ? (
            <Link
              href={auditHref}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open audit row
            </Link>
          ) : (
            <p className="px-3 text-xs italic text-[var(--admin-text-muted)] sm:text-right">
              Audit details available to the owner only.
            </p>
          )}
        </footer>
      </article>
    </AdminPanel>
  );
}
