import Link from "next/link";
import { useId } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type AdminTone =
  | "default"
  | "muted"
  | "warning"
  | "danger"
  | "success"
  | "info"
  | "restricted"
  | "gold";

type AdminDensity = "compact" | "comfortable";

const statusToneClasses: Record<AdminTone, string> = {
  default: "border-transparent bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]",
  muted: "border-transparent bg-gray-100 text-gray-600",
  warning: "border-transparent bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]",
  danger: "border-transparent bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]",
  success: "border-transparent bg-[var(--admin-success-bg)] text-[var(--admin-success)]",
  info: "border-transparent bg-[var(--admin-info-bg)] text-[var(--admin-info)]",
  restricted:
    "border-transparent bg-[var(--admin-restricted-bg)] text-[var(--admin-restricted)]",
  gold: "border-transparent bg-[var(--rahma-gold)]/18 text-[var(--admin-heading)]",
};

const panelToneClasses: Record<AdminTone, string> = {
  default: "border-[var(--admin-border)] bg-[var(--admin-surface)]",
  muted: "border-[var(--admin-border)] bg-[var(--admin-surface-muted)]",
  warning: "border-orange-200 bg-[var(--admin-warning-bg)]",
  danger: "border-red-200 bg-[var(--admin-danger-bg)]",
  success: "border-emerald-200 bg-[var(--admin-success-bg)]",
  info: "border-sky-200 bg-[var(--admin-info-bg)]",
  restricted: "border-violet-200 bg-[var(--admin-restricted-bg)]",
  gold: "border-[var(--rahma-gold)]/35 bg-[#fff8ec]",
};

const iconBadgeToneClasses: Record<AdminTone, string> = {
  default: "bg-[var(--admin-success-bg)] text-[var(--admin-primary)]",
  muted: "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]",
  warning: "bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]",
  danger: "bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]",
  success: "bg-[var(--admin-success-bg)] text-[var(--admin-success)]",
  info: "bg-[var(--admin-info-bg)] text-[var(--admin-info)]",
  restricted: "bg-[var(--admin-restricted-bg)] text-[var(--admin-restricted)]",
  gold: "bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]",
};

const progressToneClasses: Record<AdminTone, string> = {
  default: "bg-[var(--admin-primary)]",
  muted: "bg-[var(--admin-progress-neutral)]",
  warning: "bg-[var(--admin-warning)]",
  danger: "bg-[var(--admin-danger)]",
  success: "bg-[var(--admin-success)]",
  info: "bg-[var(--admin-info)]",
  restricted: "bg-[var(--admin-restricted)]",
  gold: "bg-[var(--admin-warning)]",
};

function formatBadgeValue(value: React.ReactNode) {
  return typeof value === "string" ? value.replace(/_/g, " ") : value;
}

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
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="admin-display text-2xl font-semibold leading-tight text-[var(--admin-heading)]">
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

export function AdminStat({
  label,
  value,
  note,
  icon: Icon,
  alert = false,
  tone,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  icon?: React.ElementType;
  alert?: boolean;
  tone?: AdminTone;
  footer?: React.ReactNode;
}) {
  const resolvedTone = tone ?? (alert ? "danger" : "default");

  return (
    <article
      className={cn(
        "rounded-[var(--admin-radius-card)] border px-4 py-4 shadow-[var(--admin-shadow-subtle)]",
        panelToneClasses[resolvedTone]
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--admin-text-muted)]">{label}</p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
                resolvedTone === "danger"
                ? "text-[var(--admin-danger)]"
                : "text-[var(--admin-primary)]"
            )}
          />
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--admin-heading)]">
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{note}</p> : null}
      {footer ? <div className="mt-3 border-t border-black/5 pt-3">{footer}</div> : null}
    </article>
  );
}

export function AdminPanel({
  title,
  description,
  badge,
  children,
  className,
  actions,
  footer,
  tone = "default",
  density = "comfortable",
}: {
  title?: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: AdminTone;
  density?: AdminDensity;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--admin-radius-card)] border shadow-[var(--admin-shadow-subtle)]",
        density === "compact" ? "p-4" : "p-4 sm:p-5",
        panelToneClasses[tone],
        className
      )}
    >
      {title || description || badge || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="admin-display text-base font-semibold text-[var(--admin-heading)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{description}</p>
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
      {children}
      {footer ? (
        <div className="mt-4 border-t border-[var(--admin-border)] pt-4">{footer}</div>
      ) : null}
    </section>
  );
}

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
        "min-w-0 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 shadow-[var(--admin-shadow-subtle)] sm:p-5",
        className
      )}
    >
      {children}
    </section>
  );
}

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
        iconBadgeToneClasses[tone],
        className
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

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
          <h2 className="admin-display text-[1.45rem] font-bold leading-7 text-[var(--admin-heading)]">
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
        "inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white p-0.5 shadow-[var(--admin-shadow-subtle)]",
        className
      )}
      role="group"
    >
      {items.map((item) => {
        const classNames = cn(
          "inline-flex h-9 min-w-[4.4rem] items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
          item.active
            ? "bg-[var(--admin-primary)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
        );

        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "date" : undefined}
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
        className={cn("block h-full rounded-full", progressToneClasses[tone])}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

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
      aria-label={`${label}: ${segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`}
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
            index < active ? progressToneClasses[tone] : "bg-[var(--admin-progress-neutral)]"
          )}
        />
      ))}
    </div>
  );
}

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
      <path d="M0 56H234V36C198 42 174 35 144 39C105 44 83 47 54 38C32 31 15 39 0 42V56Z" fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke="var(--admin-success)"
        strokeDasharray="6 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--admin-success-bg)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--admin-success-bg)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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
              tone === "danger" && "text-[var(--admin-danger)]",
              tone === "warning" && "text-[var(--admin-warning)]",
              tone === "success" && "text-[var(--admin-success)]",
              tone === "muted" && "text-[var(--admin-text-muted)]"
            )}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  );

  const className =
    "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-3 shadow-[var(--admin-shadow-subtle)]";

  return href ? (
    <a href={href} className={cn(className, "block outline-none hover:border-[var(--admin-primary)]/30 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35")}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function AdminStatusBadge({
  value,
  tone = "default",
  className,
}: {
  value: React.ReactNode;
  tone?: AdminTone;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "max-w-full normal-case tracking-normal",
        typeof value === "string" && "capitalize",
        statusToneClasses[tone],
        className
      )}
    >
      {formatBadgeValue(value)}
    </Badge>
  );
}

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
        "mb-5 grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white p-3 shadow-[var(--admin-shadow-subtle)] lg:grid-cols-[1fr_auto] lg:items-center",
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
        "rounded-[var(--admin-radius-card)] border-2 border-dashed px-5 py-14 text-center",
        tone === "muted"
          ? "border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/60"
          : panelToneClasses[tone]
      )}
    >
      {Icon ? (
        <div className="mx-auto mb-4">
          <AdminIconBadge icon={Icon} tone={tone} />
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-[var(--admin-heading)]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{message}</p>
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminAccessDenied({
  title = "Access limited",
  message,
  permission,
  inactive = false,
  actions,
}: {
  title?: string;
  message?: string;
  permission?: string;
  inactive?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <AdminPanel tone={inactive ? "danger" : "restricted"}>
        <div className="grid justify-items-center gap-3 py-8 text-center">
          <ShieldCheck className="size-9 text-[var(--admin-text-muted)]" />
          <h1 className="admin-display text-xl font-semibold text-[var(--admin-heading)]">
            {inactive ? "Account inactive" : title}
          </h1>
          <p className="max-w-md text-sm leading-6 text-[var(--admin-text-muted)]">
            {message ??
              (inactive
                ? "This staff account is inactive. Contact an owner or manager to restore access."
                : "You do not have permission to view this admin area.")}
          </p>
          {permission ? (
            <code className="rounded-md bg-[var(--admin-panel-muted)] px-2 py-1 text-xs text-[var(--admin-heading)]">
              {permission}
            </code>
          ) : null}
          {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
        </div>
      </AdminPanel>
    </div>
  );
}

export function AdminMobileActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[var(--admin-border)] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex gap-2 overflow-x-auto">{children}</div>
    </div>
  );
}

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
        "flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

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
          <h2 className="admin-display text-base font-semibold text-[var(--admin-heading)]">
            {title}
          </h2>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--admin-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <AdminActionGroup className="shrink-0">{actions}</AdminActionGroup> : null}
    </div>
  );
}

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
        "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white p-4 transition-colors hover:border-[var(--admin-primary)]/25",
        className
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-sm font-semibold text-[var(--admin-heading)]">
              {title}
            </h3>
            {badges}
          </div>
          {meta ? <div className="mt-1 text-xs text-[var(--admin-text-muted)]">{meta}</div> : null}
          {description ? (
            <div className="mt-2 text-sm leading-6 text-[var(--admin-text-muted)]">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <AdminActionGroup className="sm:justify-end">{actions}</AdminActionGroup> : null}
      </div>
      {children ? (
        <div className="mt-4 border-t border-[var(--admin-border)] pt-4">{children}</div>
      ) : null}
    </article>
  );
}

export function AdminEntityCard(props: Parameters<typeof AdminEntityRow>[0]) {
  return <AdminEntityRow {...props} />;
}

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
      <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white p-4">
        {children}
      </div>
    </section>
  );
}

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
          className="rounded-[var(--admin-radius-sm)] bg-[var(--admin-surface-muted)] px-3 py-2"
        >
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
            {item.label}
          </dt>
          <dd className="mt-1 break-words font-medium text-[var(--admin-heading)]">
            {item.hidden ? <AdminStatusBadge value="Hidden" tone="restricted" /> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminHiddenDataState({
  title,
  message,
  permission,
  tone = "restricted",
}: {
  title: string;
  message: string;
  permission?: string;
  tone?: AdminTone;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--admin-radius-md)] border px-4 py-3 text-sm",
        panelToneClasses[tone]
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge value={title} tone={tone} />
        {permission ? (
            <code className="rounded-md bg-white/70 px-2 py-1 text-xs text-[var(--admin-heading)]">
            {permission}
          </code>
        ) : null}
      </div>
      <p className="mt-2 leading-6 text-[var(--admin-text-muted)]">{message}</p>
    </div>
  );
}

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
        "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white p-4 shadow-[var(--admin-shadow-subtle)]",
        className
      )}
      aria-label={typeof title === "string" ? title : undefined}
    >
      <h2 className="admin-display text-base font-semibold text-[var(--admin-heading)]">
        {title}
      </h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </aside>
  );
}

export function AdminSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
        aria-hidden="true"
      className={cn(
        "animate-pulse rounded-[var(--admin-radius-sm)] bg-[var(--admin-border)]/55",
        className
      )}
    />
  );
}

export function AdminLoadingState({
  rows = 3,
  title = "Loading admin data",
}: {
  rows?: number;
  title?: string;
}) {
  return (
    <div role="status" aria-label={title} className="grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white p-4"
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

export function AdminButton({
  children,
  variant = "primary",
  size = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--admin-radius-control)] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
        size === "default" && "min-h-10 px-4 text-sm",
        size === "sm" && "min-h-8 px-3 text-xs",
        variant === "primary" && "bg-[var(--admin-primary)] text-white hover:bg-[var(--admin-primary-hover)]",
        variant === "outline" && "border border-[var(--admin-border)] bg-white text-[var(--admin-heading)] hover:bg-[var(--admin-panel-muted)]",
        variant === "ghost" && "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const MetricCard = AdminStat;
export const DetailSectionCard = AdminDetailSection;
