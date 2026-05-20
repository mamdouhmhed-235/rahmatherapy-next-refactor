import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tinted-panel variants. Mirrors the legacy `AdminEmptyState` tones so that
 * dashboard "no data" callsites and the error-boundary warning surface can
 * migrate to this single primitive without visual regression.
 *
 * Leave undefined for the plain centered-column layout (the default in
 * Phase 6 redesigns where the parent `AdminPanel` already provides the
 * surface).
 */
type EmptyStateTone = "muted" | "warning";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  /**
   * Simple primary CTA. For complex CTAs (buttons with onClick, multiple
   * buttons, secondary actions) use `actions` with arbitrary JSX instead.
   */
  action?: {
    label: string;
    href: string;
  };
  /**
   * Arbitrary CTA content (one or more buttons, links, etc.). Rendered
   * underneath the message with the same spacing as `action`.
   */
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
  illustrationSrc?: string;
  /**
   * Render the title as a semantic heading element. Use "h1" on full-page
   * not-found / empty surfaces (so screen-reader heading nav has a landmark);
   * leave default "p" for in-panel empty states whose enclosing AdminPanel
   * already provides the H2.
   */
  titleAs?: "p" | "h1" | "h2";
  /**
   * Tinted-panel wrapper. Adds border + soft background tint matching the
   * status family. Leave undefined for the plain centered-column variant.
   */
  tone?: EmptyStateTone;
}

const TONE_PANEL_CLASSES: Record<EmptyStateTone, string> = {
  muted:
    "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/50 px-5 py-12",
  warning:
    "rounded-[var(--admin-radius-card)] border border-[oklch(82%_0.09_75)] bg-[oklch(96%_0.038_75)] px-5 py-12",
};

const TONE_ICON_CLASSES: Record<EmptyStateTone, string> = {
  muted: "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]",
  warning: "bg-[oklch(95%_0.05_65)] text-[oklch(28%_0.12_55)]",
};

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  actions,
  className,
  compact = false,
  illustrationSrc,
  titleAs = "p",
  tone,
}: EmptyStateProps) {
  const TitleTag = titleAs;
  const isToned = tone !== undefined;
  return (
    <div
      className={cn(
        "mx-auto flex max-w-[360px] flex-col items-center text-center",
        !isToned && (compact ? "py-8" : "py-14"),
        isToned && TONE_PANEL_CLASSES[tone!],
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
            isToned
              ? TONE_ICON_CLASSES[tone!]
              : "bg-[oklch(93.5%_0.038_155)]",
            compact ? "size-12" : "size-16"
          )}
          aria-hidden="true"
        >
          <Icon
            className={cn(
              !isToned && "text-[var(--admin-primary)]",
              compact ? "size-5" : "size-7"
            )}
          />
        </span>
      )}

      <TitleTag
        className={cn(
          "m-0 font-display font-semibold tracking-[-0.01em] text-[var(--admin-heading)]",
          compact ? "text-sm" : "text-[1.0625rem]"
        )}
      >
        {title}
      </TitleTag>
      <p className="mt-2 max-w-[38ch] text-sm leading-6 text-[var(--admin-text-muted)]">
        {message}
      </p>

      {actions ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
      ) : action ? (
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
