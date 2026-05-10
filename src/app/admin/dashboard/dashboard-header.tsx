import Link from "next/link";
import { Clock, FileText, CalendarDays, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  lastChecked: string;
  showReports?: boolean;
  showCalendar?: boolean;
  showSettings?: boolean;
  notificationButton?: React.ReactNode;
}

export function DashboardHeader({
  title,
  subtitle,
  lastChecked,
  showReports,
  showCalendar,
  showSettings,
  notificationButton,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="admin-display text-xl font-bold leading-tight text-[var(--admin-heading)] sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1 text-sm leading-5 text-[var(--admin-text-muted)]">
          {subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <div className="hidden items-center gap-1.5 text-xs text-[var(--admin-text-muted)] sm:flex mr-2">
          <Clock className="size-3.5" aria-hidden="true" />
          <span>Last synced: {lastChecked}</span>
        </div>

        {showReports && (
          <Link
            href="/admin/reports"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            )}
          >
            <FileText className="size-4" />
            Reports
          </Link>
        )}

        {showCalendar && (
          <Link
            href="/admin/calendar"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            )}
          >
            <CalendarDays className="size-4" />
            Calendar
          </Link>
        )}

        {notificationButton}

        {showSettings && (
          <Link
            href="/admin/settings"
            className="inline-flex size-9 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
