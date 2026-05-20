import Link from "next/link";
import { useId } from "react";
import {
  AlertCircle,
  CheckCircle,
  CheckSquare,
  Clock,
  HelpCircle,
  Loader2,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminTone =
  | "default"
  | "muted"
  | "warning"
  | "danger"
  | "success"
  | "info"
  | "restricted"
  | "gold";

type AdminDensity = "compact" | "comfortable";

// ─── Status family token maps ────────────────────────────────────────────────

const statusBgClasses: Record<AdminTone, string> = {
  default: "bg-[oklch(93.5%_0.038_155)]",
  muted: "bg-[var(--admin-panel-muted)]",
  warning: "bg-[oklch(95%_0.05_65)]",
  danger: "bg-[oklch(95.5%_0.028_20)]",
  success: "bg-[oklch(93.5%_0.038_155)]",
  info: "bg-[oklch(96%_0.038_75)]",
  restricted: "bg-[oklch(94%_0.008_280)]",
  gold: "bg-[var(--rahma-gold)]/15",
};

const statusTextClasses: Record<AdminTone, string> = {
  default: "text-[oklch(22%_0.085_155)]",
  muted: "text-[var(--admin-text-muted)]",
  warning: "text-[oklch(26%_0.13_55)]",
  danger: "text-[oklch(26%_0.14_25)]",
  success: "text-[oklch(22%_0.085_155)]",
  info: "text-[oklch(28%_0.12_55)]",
  restricted: "text-[oklch(30%_0.02_280)]",
  gold: "text-[var(--admin-heading)]",
};

const panelBorderClasses: Record<AdminTone, string> = {
  default: "border-[var(--admin-border)]",
  muted: "border-[var(--admin-border)]",
  warning: "border-[oklch(88%_0.06_65)]",
  danger: "border-[oklch(88%_0.045_20)]",
  success: "border-[oklch(88%_0.055_155)]",
  info: "border-[oklch(88%_0.055_75)]",
  restricted: "border-[oklch(88%_0.012_280)]",
  gold: "border-[var(--rahma-gold)]/30",
};

const panelBgClasses: Record<AdminTone, string> = {
  default: "bg-[var(--admin-panel)]",
  muted: "bg-[var(--admin-panel-muted)]",
  warning: "bg-[oklch(95%_0.05_65)]",
  danger: "bg-[oklch(95.5%_0.028_20)]",
  success: "bg-[oklch(93.5%_0.038_155)]",
  info: "bg-[oklch(96%_0.038_75)]",
  restricted: "bg-[oklch(94%_0.008_280)]",
  gold: "bg-[var(--brand-warm-surface)]",
};

const iconBgClasses: Record<AdminTone, string> = {
  default: "bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)]",
  muted: "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]",
  warning: "bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)]",
  danger: "bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)]",
  success: "bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)]",
  info: "bg-[oklch(96%_0.038_75)] text-[oklch(28%_0.12_55)]",
  restricted: "bg-[oklch(94%_0.008_280)] text-[oklch(30%_0.02_280)]",
  gold: "bg-[var(--rahma-gold)]/15 text-[var(--admin-heading)]",
};

const progressFillClasses: Record<AdminTone, string> = {
  default: "bg-[var(--admin-primary)]",
  muted: "bg-[var(--admin-progress-neutral)]",
  warning: "bg-[oklch(26%_0.13_55)]",
  danger: "bg-[oklch(26%_0.14_25)]",
  success: "bg-[var(--admin-primary)]",
  info: "bg-[oklch(28%_0.12_55)]",
  restricted: "bg-[oklch(30%_0.02_280)]",
  gold: "bg-[var(--admin-warning)]",
};

// Status badge icon per family
const statusIcons: Record<AdminTone, React.ElementType | null> = {
  default: CheckCircle,
  muted: null,
  warning: AlertCircle,
  danger: XCircle,
  success: CheckCircle,
  info: Clock,
  restricted: Lock,
  gold: null,
};

function formatBadgeValue(value: React.ReactNode) {
  return typeof value === "string" ? value.replace(/_/g, " ") : value;
}

// ─── AdminPageScaffold ────────────────────────────────────────────────────────

export function AdminPageScaffold({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "wide" | "narrow";
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-6",
        width === "wide" && "max-w-none",
        width === "narrow" && "mx-auto max-w-4xl",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── AdminPageHeader ──────────────────────────────────────────────────────────

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
  badge,
  secondaryActions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="font-display text-balance text-[clamp(1.778rem,2.5vw,2.369rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--admin-heading)]">
            {title}
          </h1>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--admin-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions || secondaryActions ? (
        <AdminActionGroup className="shrink-0">
          {secondaryActions}
          {actions}
        </AdminActionGroup>
      ) : null}
    </header>
  );
}

// ─── AdminStat ───────────────────────────────────────────────────────────────

export function AdminStat({
  label,
  value,
  note,
  icon: Icon,
  alert = false,
  tone,
  footer,
  numeral = false,
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  icon?: React.ElementType;
  alert?: boolean;
  tone?: AdminTone;
  footer?: React.ReactNode;
  numeral?: boolean;
  loading?: boolean;
}) {
  const resolvedTone = tone ?? (alert ? "danger" : "default");

  return (
    <article
      className={cn(
        "rounded-[var(--admin-radius-card)] border px-5 py-4",
        panelBorderClasses[resolvedTone],
        panelBgClasses[resolvedTone]
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[var(--admin-text-muted)]">{label}</p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              resolvedTone === "danger"
                ? "text-[oklch(26%_0.14_25)]"
                : "text-[var(--admin-primary)]"
            )}
            aria-hidden="true"
          />
        ) : null}
      </div>
      {loading ? (
        <AdminSkeleton className="mt-2 h-9 w-2/3" aria-hidden="true" />
      ) : numeral ? (
        <p
          className="mt-2 font-[var(--font-admin-serif),Georgia,serif] text-[3.157rem] font-bold leading-none tracking-[-0.02em] text-[var(--admin-cormorant-color)]"
          style={{ fontFamily: "var(--font-admin-serif), Georgia, serif" }}
        >
          {value}
        </p>
      ) : (
        <p className="font-display mt-2 line-clamp-2 text-[1.778rem] font-semibold leading-tight tracking-[-0.015em] text-[var(--admin-heading)]">{value}</p>
      )}
      {note ? <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{note}</p> : null}
      {footer ? (
        <div className="mt-3 border-t border-[var(--admin-border)] pt-3">{footer}</div>
      ) : null}
    </article>
  );
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────

export function AdminPanel({
  title,
  titleAs = "h2",
  description,
  helpText,
  helpLabel,
  badge,
  children,
  className,
  actions,
  footer,
  tone = "default",
  density = "comfortable",
  loading = false,
  error,
}: {
  title?: string;
  /** Heading level for the panel title. Defaults to h2; use h3 when the panel
   *  sits beneath a section h2 (e.g. staff-detail right-rail). */
  titleAs?: "h2" | "h3";
  description?: string;
  /** Optional "What's this?" disclosure rendered inline next to the title.
   *  Use for unfamiliar concepts (permission overrides, availability_mode,
   *  gender restriction). One short paragraph. */
  helpText?: React.ReactNode;
  /** Accessible label for the helpText trigger button (defaults to "What's this?"). */
  helpLabel?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: AdminTone;
  density?: AdminDensity;
  loading?: boolean;
  error?: string;
}) {
  const resolvedTone = error ? "danger" : tone;
  const TitleTag = titleAs;

  return (
    <section
      className={cn(
        "rounded-[var(--admin-radius-card)] border",
        density === "compact" ? "p-4" : "p-4 sm:p-5",
        panelBorderClasses[resolvedTone],
        panelBgClasses[resolvedTone],
        className
      )}
    >
      {title || description || badge || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <div className="flex items-center gap-1.5">
                <TitleTag className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
                  {title}
                </TitleTag>
                {helpText ? (
                  <AdminFieldHelp label={helpLabel}>{helpText}</AdminFieldHelp>
                ) : null}
              </div>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">{description}</p>
            ) : null}
          </div>
          {badge || actions ? (
            <AdminActionGroup className="shrink-0">
              {badge}
              {actions}
            </AdminActionGroup>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-3 text-sm text-[oklch(26%_0.14_25)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : loading ? (
        <div className="grid gap-3" aria-hidden="true">
          <AdminSkeleton className="h-4 w-2/3" />
          <AdminSkeleton className="h-3 w-full" />
          <AdminSkeleton className="h-3 w-4/5" />
        </div>
      ) : (
        children
      )}

      {footer && !loading && !error ? (
        <div className="mt-4 border-t border-[var(--admin-border)] pt-4">{footer}</div>
      ) : null}
    </section>
  );
}

// ─── AdminDashboardPanel ─────────────────────────────────────────────────────

export function AdminDashboardPanel({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "min-w-0 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 sm:p-5",
        className
      )}
    >
      {children}
    </section>
  );
}

// ─── AdminIconBadge ───────────────────────────────────────────────────────────

export function AdminIconBadge({
  icon: Icon,
  tone = "default",
  className,
}: {
  icon: React.ElementType;
  tone?: AdminTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
        iconBgClasses[tone],
        className
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

// ─── AdminPanelHeader ─────────────────────────────────────────────────────────

export function AdminPanelHeader({
  icon,
  title,
  description,
  action,
  tone = "default",
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: AdminTone;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <AdminIconBadge icon={icon} tone={tone} /> : null}
        <div className="min-w-0">
          <h2 className="font-display text-[1.333rem] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--admin-heading)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm leading-5 text-[var(--admin-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ─── AdminSegmentedControl ────────────────────────────────────────────────────

export function AdminSegmentedControl({
  items,
  className,
}: {
  items: {
    key: string;
    label: string;
    active?: boolean;
    href?: string;
    onClick?: () => void;
  }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-0.5",
        className
      )}
      role="group"
    >
      {items.map((item) => {
        const classNames = cn(
          "inline-flex h-9 min-w-[4.4rem] items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
          item.active
            ? "bg-[var(--admin-primary)] text-white"
            : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
        );
        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={classNames}
          >
            {item.label}
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            aria-pressed={Boolean(item.active)}
            onClick={item.onClick}
            className={classNames}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── AdminProgressBar ─────────────────────────────────────────────────────────

export function AdminProgressBar({
  value,
  label,
  tone = "default",
  className,
}: {
  value: number;
  label: string;
  tone?: AdminTone;
  className?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-[var(--admin-progress-neutral)]", className)}
      role="progressbar"
      aria-label={`${label}: ${safeValue}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <span
        className={cn("block h-full rounded-full", progressFillClasses[tone])}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

// ─── AdminStackedBar ──────────────────────────────────────────────────────────

export function AdminStackedBar({
  segments,
  label,
  className,
}: {
  label: string;
  segments: { label: string; value: number; className: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  return (
    <div
      className={cn("flex h-5 overflow-hidden rounded-[0.375rem] bg-[var(--admin-progress-neutral)]", className)}
      role="img"
      aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
    >
      {segments.map((segment) => {
        const width = total > 0 ? (segment.value / total) * 100 : 100 / Math.max(1, segments.length);
        return (
          <span
            key={segment.label}
            className={cn("block h-full border-r border-white/80 last:border-r-0", segment.className)}
            style={{ width: `${width}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        );
      })}
    </div>
  );
}

// ─── AdminSeverityMeter ───────────────────────────────────────────────────────

export function AdminSeverityMeter({
  value,
  tone = "muted",
  label,
}: {
  value: number;
  tone?: AdminTone;
  label: string;
}) {
  const active = Math.max(0, Math.min(5, value));
  return (
    <div className="inline-flex items-center gap-1" role="img" aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-4 rounded-full sm:w-5",
            index < active ? progressFillClasses[tone] : "bg-[var(--admin-progress-neutral)]"
          )}
        />
      ))}
    </div>
  );
}

// ─── AdminMiniTrend ───────────────────────────────────────────────────────────

export function AdminMiniTrend({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const gradientId = useId();
  const points = "0,38 18,30 36,40 54,18 72,35 90,31 108,22 126,37 144,25 162,34 180,20 198,32 216,24 234,31";
  return (
    <svg
      viewBox="0 0 234 56"
      role="img"
      aria-label={label}
      className={cn("h-20 w-full overflow-visible", className)}
      preserveAspectRatio="none"
    >
      <path
        d="M0 56H234V36C198 42 174 35 144 39C105 44 83 47 54 38C32 31 15 39 0 42V56Z"
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--admin-primary)"
        strokeDasharray="6 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(93.5% 0.038 155)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(93.5% 0.038 155)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── AdminHealthTile ──────────────────────────────────────────────────────────

export function AdminHealthTile({
  icon,
  label,
  value,
  status,
  tone = "muted",
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  status: string;
  tone?: AdminTone;
  href?: string | null;
}) {
  const content = (
    <div className="flex min-w-0 items-center gap-3">
      <AdminIconBadge icon={icon} tone={tone} className="size-9" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--admin-body)]">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold leading-none text-[var(--admin-heading)]">{value}</span>
          <span
            className={cn(
              "text-xs font-semibold",
              tone === "danger" && "text-[oklch(26%_0.14_25)]",
              tone === "warning" && "text-[oklch(26%_0.13_55)]",
              tone === "success" && "text-[oklch(22%_0.085_155)]",
              tone === "muted" && "text-[var(--admin-text-muted)]"
            )}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  );

  const baseClass =
    "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3";

  return href ? (
    <a
      href={href}
      className={cn(
        baseClass,
        "block outline-none transition-colors hover:border-[var(--admin-primary)]/30 hover:shadow-[var(--admin-shadow-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      )}
    >
      {content}
    </a>
  ) : (
    <div className={baseClass}>{content}</div>
  );
}

// ─── AdminStatusBadge (fully self-contained) ──────────────────────────────────

export function AdminStatusBadge({
  value,
  tone = "default",
  className,
  compact = false,
}: {
  value: React.ReactNode;
  tone?: AdminTone;
  className?: string;
  compact?: boolean;
}) {
  const Icon = statusIcons[tone];
  const size = compact ? "text-[0.6875rem] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium",
        size,
        statusBgClasses[tone],
        statusTextClasses[tone],
        className
      )}
    >
      {Icon ? (
        <Icon
          className={compact ? "size-3 shrink-0" : "size-3.5 shrink-0"}
          aria-hidden="true"
        />
      ) : null}
      <span>{formatBadgeValue(value)}</span>
    </span>
  );
}

// ─── AdminInput ───────────────────────────────────────────────────────────────

export function AdminInput({
  label,
  required,
  error,
  hint,
  id,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input"> & {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <input
        id={inputId}
        required={required}
        aria-describedby={cn(error ? errorId : undefined, hint ? hintId : undefined) || undefined}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-[var(--admin-panel-muted)] read-only:cursor-default read-only:text-[var(--admin-text-muted)] read-only:focus-visible:border-[var(--admin-border-form)] read-only:focus-visible:ring-0",
          error
            ? "border-[oklch(26%_0.14_25)]"
            : "border-[var(--admin-border-form)]"
        )}
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-[var(--admin-text-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-1.5 text-xs text-[oklch(26%_0.14_25)]"
        >
          <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}
    </div>
  );
}

// ─── AdminFilterBar ───────────────────────────────────────────────────────────

export function AdminFilterBar({
  children,
  className,
  summary,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-5 grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 lg:grid-cols-[1fr_auto] lg:items-center",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {children}
      </div>
      {summary || actions ? (
        <AdminActionGroup className="justify-start lg:justify-end">
          {summary}
          {actions}
        </AdminActionGroup>
      ) : null}
    </div>
  );
}

// ─── AdminEmptyState (legacy — prefer EmptyState for new usage) ───────────────

export function AdminEmptyState({
  icon: Icon,
  title,
  message,
  actions,
  tone = "muted",
}: {
  icon?: React.ElementType;
  title: string;
  message: string;
  actions?: React.ReactNode;
  tone?: AdminTone;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--admin-radius-card)] border px-5 py-12 text-center",
        panelBorderClasses[tone],
        tone === "muted"
          ? "border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/50"
          : panelBgClasses[tone]
      )}
    >
      {Icon ? (
        <div className="mx-auto mb-4">
          <AdminIconBadge icon={Icon} tone={tone} />
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-[var(--admin-heading)]">{title}</h2>
      <p className="mx-auto mt-1 max-w-[45ch] text-sm leading-6 text-[var(--admin-text-muted)]">
        {message}
      </p>
      {actions ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

// ─── AdminAccessDenied ────────────────────────────────────────────────────────

// Pattern matching raw permission identifiers — never render these to the user.
const RAW_PERMISSION_PATTERN = /^[a-z_]+$/;

function sanitiseDeniedMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  // Guard: if the message looks like a raw permission string, discard it.
  if (RAW_PERMISSION_PATTERN.test(message.trim())) return undefined;
  return message;
}

export function AdminAccessDenied({
  title,
  message,
  // permission accepted for backwards-compat but never rendered — brief forbids raw permission strings
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  permission: _permission,
  inactive = false,
  variant,
  actions,
}: {
  title?: string;
  message?: string;
  permission?: string;
  inactive?: boolean;
  /** Shell variant — used to produce role-appropriate CTA copy. */
  variant?: "owner_admin" | "coordinator" | "therapist";
  actions?: React.ReactNode;
}) {
  const heading = inactive
    ? "Account inactive"
    : (title ?? "You don't have access to this section");
  const body = inactive
    ? "This staff account is inactive. Contact an owner or manager to restore access."
    : (sanitiseDeniedMessage(message) ?? "Contact the owner if you think this is a mistake.");
  const ctaLabel = variant === "therapist" ? "Back to My day" : "Back to dashboard";

  return (
    <div className="mx-auto max-w-2xl">
      <AdminPanel tone={inactive ? "danger" : "restricted"}>
        <div className="grid justify-items-center gap-4 py-10 text-center">
          <span
            className={cn(
              "inline-flex size-12 items-center justify-center rounded-full",
              inactive ? panelBgClasses["danger"] : panelBgClasses["restricted"]
            )}
          >
            <ShieldCheck
              className={cn(
                "size-6",
                inactive ? statusTextClasses["danger"] : statusTextClasses["restricted"]
              )}
              aria-hidden="true"
            />
          </span>
          <h1 className="font-display text-xl font-semibold text-[var(--admin-heading)]">
            {heading}
          </h1>
          <p className="max-w-[45ch] text-sm leading-6 text-[var(--admin-text-muted)]">
            {body}
          </p>
          {!inactive ? (
            <Link
              href="/admin/dashboard"
              className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              {ctaLabel}
            </Link>
          ) : null}
          {actions ? (
            <div className="flex flex-wrap justify-center gap-2">{actions}</div>
          ) : null}
        </div>
      </AdminPanel>
    </div>
  );
}

// ─── AdminMobileActionBar ─────────────────────────────────────────────────────

export function AdminMobileActionBar({
  children,
  submitting = false,
}: {
  children: React.ReactNode;
  submitting?: boolean;
}) {
  return (
    <div
      aria-busy={submitting || undefined}
      className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[var(--admin-border)] bg-[var(--admin-panel)]/95 px-4 py-3 backdrop-blur lg:hidden"
    >
      <div className="flex gap-2 overflow-x-auto">{children}</div>
    </div>
  );
}

// ─── AdminActionGroup ─────────────────────────────────────────────────────────

export function AdminActionGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

// ─── AdminToolbar ─────────────────────────────────────────────────────────────

export function AdminToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── AdminMetricGrid ──────────────────────────────────────────────────────────

export function AdminMetricGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

// ─── AdminResponsiveGrid ──────────────────────────────────────────────────────

export function AdminResponsiveGrid({
  children,
  className,
  columns = 2,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "lg:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── AdminSectionHeader ───────────────────────────────────────────────────────

export function AdminSectionHeader({
  title,
  description,
  actions,
  badge,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--admin-heading)]">{title}</h2>
          {badge}
        </div>
        {description ? (
          <p className="mt-0.5 text-sm leading-6 text-[var(--admin-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <AdminActionGroup className="shrink-0">{actions}</AdminActionGroup>
      ) : null}
    </div>
  );
}

// ─── AdminEntityRow ───────────────────────────────────────────────────────────

export function AdminEntityRow({
  title,
  meta,
  description,
  leading,
  badges,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors hover:border-[var(--admin-primary)]/35 hover:shadow-[var(--admin-shadow-hover)]",
        className
      )}
    >
      {/* Mobile: leading+content row, actions below. Desktop: 3-col grid */}
      <div className="flex min-w-0 items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-sm font-semibold text-[var(--admin-heading)]">
              {title}
            </h3>
            {badges}
          </div>
          {meta ? (
            <div className="mt-1 text-xs text-[var(--admin-text-muted)]">{meta}</div>
          ) : null}
          {description ? (
            <div className="mt-2 text-sm leading-6 text-[var(--admin-text-muted)]">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <AdminActionGroup className="hidden shrink-0 sm:flex sm:justify-end">
            {actions}
          </AdminActionGroup>
        ) : null}
      </div>
      {/* Mobile-only actions row — hidden on sm+ where they appear inline above */}
      {actions ? (
        <AdminActionGroup className="mt-3 sm:hidden">
          {actions}
        </AdminActionGroup>
      ) : null}
      {children ? (
        <div className="mt-4 border-t border-[var(--admin-border)] pt-4">{children}</div>
      ) : null}
    </article>
  );
}

export function AdminEntityCard(props: Parameters<typeof AdminEntityRow>[0]) {
  return <AdminEntityRow {...props} />;
}

// ─── AdminDetailSection ───────────────────────────────────────────────────────

export function AdminDetailSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3", className)}>
      <AdminSectionHeader title={title} description={description} actions={actions} />
      <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4">
        {children}
      </div>
    </section>
  );
}

// ─── AdminDescriptionList ─────────────────────────────────────────────────────

export function AdminDescriptionList({
  items,
  className,
}: {
  items: readonly { label: React.ReactNode; value: React.ReactNode; hidden?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-3 text-sm sm:grid-cols-2", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2"
        >
          <dt className="text-xs font-medium text-[var(--admin-text-muted)]">{item.label}</dt>
          <dd className="mt-1 break-words font-medium text-[var(--admin-heading)]">
            {item.hidden ? (
              <AdminStatusBadge value="Hidden" tone="restricted" />
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── AdminHiddenDataState ─────────────────────────────────────────────────────

export function AdminHiddenDataState({
  title,
  message,
  tone = "restricted",
}: {
  title: string;
  message: string;
  tone?: AdminTone;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--admin-radius-card)] border px-4 py-3 text-sm",
        panelBorderClasses[tone],
        panelBgClasses[tone]
      )}
    >
      <AdminStatusBadge value={title} tone={tone} />
      <p className="mt-2 leading-6 text-[var(--admin-text-muted)]">{message}</p>
    </div>
  );
}

// ─── AdminAttentionRail ───────────────────────────────────────────────────────

export function AdminAttentionRail({
  title = "Attention",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)]/35 p-4",
        className
      )}
      aria-label={typeof title === "string" ? title : undefined}
    >
      <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-[oklch(26%_0.13_55)]">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </aside>
  );
}

// ─── AdminSkeleton ────────────────────────────────────────────────────────────

export function AdminSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[var(--admin-radius-control)] bg-[var(--admin-border)]/55 [animation:pulse_1.4s_ease-in-out_infinite] motion-reduce:animate-none",
        className
      )}
    />
  );
}

// ─── AdminLoadingState ────────────────────────────────────────────────────────

export function AdminLoadingState({
  rows = 3,
  title = "Loading",
}: {
  rows?: number;
  title?: string;
}) {
  return (
    <div role="status" aria-label={title} className="grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4"
        >
          <AdminSkeleton className="h-4 w-1/3" />
          <AdminSkeleton className="mt-3 h-3 w-2/3" />
          <AdminSkeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
      <span className="sr-only">{title}</span>
    </div>
  );
}

// ─── AdminButton ──────────────────────────────────────────────────────────────

export function AdminButton({
  children,
  variant = "primary",
  size = "default",
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
  size?: "default" | "sm";
  loading?: boolean;
  /**
   * Leading icon slot. When `loading` is true the spinner occupies this slot
   * instead of the icon — never alongside it (§12.6 fix).
   */
  icon?: React.ReactNode;
}) {
  // §12.6: spinner replaces leading icon when loading — never appends alongside.
  const leadingSlot = loading ? (
    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
  ) : icon ? (
    <>{icon}</>
  ) : null;

  return (
    <button
      type="button"
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none",
        size === "default" && "min-h-10 px-4 text-sm",
        size === "sm" && "min-h-8 px-3 text-xs",
        variant === "primary" &&
          "bg-[var(--admin-primary)] text-white hover:bg-[var(--admin-primary-hover)] active:bg-[oklch(28%_0.085_247)]",
        variant === "secondary" &&
          "border border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]",
        variant === "destructive" &&
          "bg-[oklch(40%_0.14_25)] text-white hover:bg-[oklch(33%_0.14_25)]",
        variant === "ghost" &&
          "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]",
        variant === "outline" &&
          "border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]",
        className
      )}
      {...props}
    >
      {leadingSlot}
      {children}
    </button>
  );
}

// ─── AdminFieldHelp ───────────────────────────────────────────────────────────
// Inline "What's this?" disclosure for unfamiliar form terms. Sits next to a
// field label as a small question-mark button; on click, reveals a
// plain-English one-sentence explanation below the field. Native `<details>`
// gives keyboard + AT support for free; the button-shaped summary is
// 44px-tall on mobile per WCAG 2.5.5.

export function AdminFieldHelp({
  label = "What's this?",
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details className={cn("group inline-block align-middle text-left", className)}>
      <summary
        aria-label={label}
        title={label}
        className="inline-flex size-6 cursor-pointer list-none items-center justify-center rounded-full text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden"
      >
        <HelpCircle className="size-3.5" aria-hidden="true" />
      </summary>
      <p
        className="mt-2 max-w-prose rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2 text-xs leading-5 text-[var(--admin-text-muted)]"
        role="note"
      >
        {children}
      </p>
    </details>
  );
}

// ─── Backwards-compat re-exports ──────────────────────────────────────────────
export const MetricCard = AdminStat;
export const DetailSectionCard = AdminDetailSection;
