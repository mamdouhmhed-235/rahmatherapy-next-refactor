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
    "rounded-[var(--admin-radius-card)] border border-[var(--admin-status-pending-border-vivid)] bg-[var(--admin-status-pending-bg)] px-5 py-12",
};

const TONE_ICON_CLASSES: Record<EmptyStateTone, string> = {
  muted: "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]",
  warning: "bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-pending-text)]",
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
        "mx-auto flex max-w-[400px] flex-col items-center text-center",
        !isToned && (compact ? "py-10" : "py-16"),
        isToned && TONE_PANEL_CLASSES[tone!],
        className
      )}
    >
      {illustrationSrc ? (
        // Static SVG illustration served from /public; next/image's
        // optimisation adds no value here and forces width/height props
        // that defeat the responsive Tailwind classes below.
        // eslint-disable-next-line @next/next/no-img-element
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
              : "bg-[var(--admin-status-confirmed-bg)]",
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
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
