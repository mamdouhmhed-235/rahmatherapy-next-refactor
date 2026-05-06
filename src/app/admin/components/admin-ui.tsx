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
  default: "border-transparent bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]",
  muted: "border-transparent bg-gray-100 text-gray-600",
  warning: "border-transparent bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]",
  danger: "border-transparent bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]",
  success: "border-transparent bg-[var(--admin-success-bg)] text-[var(--admin-success)]",
  info: "border-transparent bg-[var(--admin-info-bg)] text-[var(--admin-info)]",
  restricted:
    "border-transparent bg-[var(--admin-restricted-bg)] text-[var(--admin-restricted)]",
  gold: "border-transparent bg-[var(--rahma-gold)]/18 text-[var(--rahma-charcoal)]",
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
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-green)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--rahma-charcoal)]">
            {title}
          </h1>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--rahma-muted)]">
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
        "rounded-[var(--admin-radius-md)] border px-4 py-4 shadow-[var(--admin-shadow-card)]",
        panelToneClasses[resolvedTone]
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--rahma-muted)]">{label}</p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              resolvedTone === "danger"
                ? "text-[var(--admin-danger)]"
                : "text-[var(--rahma-green)]"
            )}
          />
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--rahma-charcoal)]">
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-[var(--rahma-muted)]">{note}</p> : null}
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
        "rounded-[var(--admin-radius-lg)] border shadow-[var(--admin-shadow-card)]",
        density === "compact" ? "p-4" : "p-4 sm:p-5",
        panelToneClasses[tone],
        className
      )}
    >
      {title || description || badge || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[var(--rahma-muted)]">{description}</p>
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
        <div className="mt-4 border-t border-[var(--rahma-border)] pt-4">{footer}</div>
      ) : null}
    </section>
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
        "mb-5 grid gap-3 rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-white p-3 shadow-[var(--admin-shadow-card)] lg:grid-cols-[1fr_auto] lg:items-center",
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
        "rounded-[var(--admin-radius-lg)] border-2 border-dashed px-5 py-14 text-center",
        tone === "muted"
          ? "border-[var(--rahma-border)] bg-white/60"
          : panelToneClasses[tone]
      )}
    >
      {Icon ? <Icon className="mx-auto mb-4 size-10 text-[var(--rahma-muted)]/35" /> : null}
      <h2 className="text-base font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--rahma-muted)]">{message}</p>
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
          <ShieldCheck className="size-9 text-[var(--rahma-muted)]" />
          <h1 className="font-display text-xl font-semibold text-[var(--rahma-charcoal)]">
            {inactive ? "Account inactive" : title}
          </h1>
          <p className="max-w-md text-sm leading-6 text-[var(--rahma-muted)]">
            {message ??
              (inactive
                ? "This staff account is inactive. Contact an owner or manager to restore access."
                : "You do not have permission to view this admin area.")}
          </p>
          {permission ? (
            <code className="rounded-md bg-[var(--rahma-ivory)] px-2 py-1 text-xs text-[var(--rahma-charcoal)]">
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
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[var(--rahma-border)] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
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
        "flex flex-col gap-3 rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between",
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
          <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
            {title}
          </h2>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--rahma-muted)]">
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
        "rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-white p-4 transition-colors hover:border-[var(--rahma-green)]/25",
        className
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-sm font-semibold text-[var(--rahma-charcoal)]">
              {title}
            </h3>
            {badges}
          </div>
          {meta ? <div className="mt-1 text-xs text-[var(--rahma-muted)]">{meta}</div> : null}
          {description ? (
            <div className="mt-2 text-sm leading-6 text-[var(--rahma-muted)]">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <AdminActionGroup className="sm:justify-end">{actions}</AdminActionGroup> : null}
      </div>
      {children ? (
        <div className="mt-4 border-t border-[var(--rahma-border)] pt-4">{children}</div>
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
      <div className="rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-white p-4">
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
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            {item.label}
          </dt>
          <dd className="mt-1 break-words font-medium text-[var(--rahma-charcoal)]">
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
          <code className="rounded-md bg-white/70 px-2 py-1 text-xs text-[var(--rahma-charcoal)]">
            {permission}
          </code>
        ) : null}
      </div>
      <p className="mt-2 leading-6 text-[var(--rahma-muted)]">{message}</p>
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
        "rounded-[var(--admin-radius-lg)] border border-[var(--rahma-border)] bg-white p-4 shadow-[var(--admin-shadow-card)]",
        className
      )}
      aria-label={typeof title === "string" ? title : undefined}
    >
      <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
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
        "animate-pulse rounded-[var(--admin-radius-sm)] bg-[var(--rahma-border)]/55",
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
          className="rounded-[var(--admin-radius-md)] border border-[var(--rahma-border)] bg-white p-4"
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
