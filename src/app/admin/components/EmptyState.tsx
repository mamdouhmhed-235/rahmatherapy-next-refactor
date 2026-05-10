// Shared empty-state component for admin list/table panels.
//
// Replaces ad-hoc <p>No data.</p> placeholders. Provides a consistent
// finish: a muted icon, a title, a one-line message, and an optional
// primary CTA. Use copy that's specific and useful — never just "No
// results."

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
  /** Use compact layout in panels with limited vertical space. */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "py-6" : "py-12",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]",
          compact ? "size-10" : "size-12"
        )}
        aria-hidden="true"
      >
        <Icon className={compact ? "size-5" : "size-6"} />
      </div>
      <p
        className={cn(
          "mt-3 font-semibold text-[var(--admin-heading)]",
          compact ? "text-sm" : "text-base"
        )}
      >
        {title}
      </p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--admin-text-muted)]">
        {message}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 text-sm font-semibold text-white outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
