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
            "mb-5 inline-flex items-center justify-center rounded-full",
            "bg-[oklch(93.5%_0.038_155)] shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.08)]",
            compact ? "size-12" : "size-16"
          )}
          aria-hidden="true"
        >
          <Icon
            className={cn(
              "text-[var(--admin-primary)]",
              compact ? "size-5" : "size-7"
            )}
          />
        </span>
      )}

      <p
        className={cn(
          "font-display font-semibold tracking-[-0.01em] text-[var(--admin-heading)]",
          compact ? "text-sm" : "text-[1.0625rem]"
        )}
      >
        {title}
      </p>
      <p className="mt-2 max-w-[38ch] text-sm leading-6 text-[var(--admin-text-muted)]">
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
