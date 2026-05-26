// B-3 — synchronous server component. Reads pre-fetched audit events
// passed by the parent page so the page's single 100-row getAuditLogForStaff
// call serves both scorecard.admin (B-2) and this timeline (SHARED-NOTES §11
// ≤4 query budget). The fetch itself is Sentry-span-wrapped + index-backed
// (audit_logs_actor_recent_idx, B-2).

import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  Lock,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import type { AuditEventRow } from "@/app/admin/reports/reporting";
import {
  buildTargetHref,
  buildTargetLabel,
  describeAction,
  formatAbsolute,
  formatRelative,
  targetTypeLabel,
  truncateUuid,
  type ActionFamily,
} from "@/app/admin/audit/format";
import { AdminPanel } from "./admin-ui";
import { humanizeAuditAction } from "./performance-helpers";

interface ActivityTimelineProps {
  staffId: string;
  mode: "self" | "manager";
  viewerCanManageAudit: boolean;
  events: AuditEventRow[];
}

export function ActivityTimeline({
  staffId,
  mode,
  viewerCanManageAudit,
  events,
}: ActivityTimelineProps) {
  const footer = viewerCanManageAudit ? (
    <Link
      href={`/admin/audit?actor=${staffId}`}
      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 rounded-sm"
    >
      View full audit timeline
      <ChevronRight aria-hidden="true" className="size-4" />
    </Link>
  ) : null;

  if (events.length === 0) {
    return (
      <AdminPanel
        title="Recent activity"
        titleAs="h3"
        footer={footer}
      >
        <p className="text-sm text-[var(--admin-text-muted)]">
          No recent activity yet.
        </p>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
          {/*
           * Copy aligned 2026-05-25: this panel shows the last 100 audit
           * events regardless of the page period filter, so the empty-state
           * shouldn't claim period scope. The "Recent activity" title is
           * the canonical framing.
           */}
          Recent actions will appear here as you work.
        </p>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel
      title="Recent activity"
      titleAs="h3"
      badge={
        <span
          aria-label={`${events.length} recent ${events.length === 1 ? "event" : "events"}`}
          className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--admin-panel-muted)] px-2 text-xs font-medium text-[var(--admin-text-muted)] tabular-nums"
        >
          {events.length}
        </span>
      }
      footer={footer}
    >
      <ol role="list" className="-my-2 list-none divide-y divide-[var(--admin-border-subtle)]/60">
        {events.map((event) => (
          <li key={event.id} className="py-3">
            <ActivityRow event={event} mode={mode} />
          </li>
        ))}
      </ol>
    </AdminPanel>
  );
}

interface ActivityRowProps {
  event: AuditEventRow;
  mode: "self" | "manager";
}

function ActionIcon({ family }: { family: ActionFamily }) {
  // Static dispatch — React 19's react-hooks/static-components rule rejects
  // dynamic component instantiation, so we render each Lucide component as a
  // direct JSX usage.
  switch (family) {
    case "bookings_and_assignments":
      return <Calendar className="size-4" aria-hidden="true" />;
    case "clients_and_enquiries":
      return <MessageCircle className="size-4" aria-hidden="true" />;
    case "staff_and_roles":
      return <Users className="size-4" aria-hidden="true" />;
    case "services_and_settings":
      return <Settings className="size-4" aria-hidden="true" />;
    case "availability":
      return <Clock className="size-4" aria-hidden="true" />;
    case "operations_and_email":
      return <AlertCircle className="size-4" aria-hidden="true" />;
    case "reports_and_exports":
      return <BarChart3 className="size-4" aria-hidden="true" />;
    case "account_security":
      return <Lock className="size-4" aria-hidden="true" />;
  }
}

function ActivityRow({ event, mode }: ActivityRowProps) {
  const description = humanizeAuditAction(event.action_type, mode);
  const family = describeAction(event.action_type).family;
  const targetHref = buildTargetHref(event.target_type, event.target_id);
  const targetType = event.target_type ? targetTypeLabel(event.target_type) : null;
  const targetIdShort = event.target_id ? truncateUuid(event.target_id) : null;
  const relative = formatRelative(event.created_at);
  const absolute = formatAbsolute(event.created_at);

  const targetChip =
    targetType && targetIdShort ? (
      <span className="inline-flex items-center gap-0.5 text-xs text-[var(--admin-text-muted)] tabular-nums">
        {targetType} {targetIdShort}
      </span>
    ) : null;

  const targetSegment =
    targetChip != null ? (
      targetHref ? (
        <Link
          href={targetHref}
          aria-label={buildTargetLabel(event.target_type)}
          className="inline-flex items-center gap-1 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-1"
        >
          {targetChip}
        </Link>
      ) : (
        targetChip
      )
    ) : null;

  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]"
      >
        <ActionIcon family={family} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-[var(--admin-body)]">
          {description}
          {targetSegment ? <> · {targetSegment}</> : null}
        </p>
        <time
          dateTime={event.created_at}
          title={absolute}
          className="mt-0.5 block text-[0.6875rem] text-[var(--admin-text-muted)]"
        >
          {relative}
        </time>
      </div>
    </div>
  );
}

// Skeleton fallback for the Suspense boundary in the parent page.
// AdminPanel's built-in `loading` mode renders shimmer placeholders that
// preserve the panel chrome so resolution doesn't shift layout.
export function ActivityTimelineSkeleton() {
  return (
    <AdminPanel title="Recent activity" titleAs="h3" loading>
      {null}
    </AdminPanel>
  );
}
