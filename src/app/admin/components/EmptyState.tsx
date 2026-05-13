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
  compact?: boolean;
  illustrationSrc?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
  compact = false,
  illustrationSrc,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-[360px] flex-col items-center text-center",
        compact ? "py-8" : "py-14",
        className
      )}
    >
      {illustrationSrc ? (
        <img
          src={illustrationSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            "mb-5 object-contain",
            compact ? "h-16 w-16" : "h-24 w-24"
          )}
        />
      ) : (
        <span
          className={cn(
            "mb-5 inline-flex items-center justify-center rounded-full bg-[var(--admin-panel-muted)]",
            compact ? "size-12" : "size-16"
          )}
          aria-hidden="true"
        >
          <Icon
            className={cn(
              "text-[var(--admin-text-muted)]",
              compact ? "size-5" : "size-7"
            )}
          />
        </span>
      )}

      <p
        className={cn(
          "font-semibold tracking-tight text-[var(--admin-heading)]",
          compact ? "text-sm" : "text-base"
        )}
      >
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
        {message}
      </p>

      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
