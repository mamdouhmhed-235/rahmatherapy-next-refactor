import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-green)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--rahma-charcoal)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--rahma-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function AdminStat({
  label,
  value,
  note,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  icon?: React.ElementType;
  alert?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-white px-4 py-4",
        alert ? "border-red-200" : "border-[var(--rahma-border)]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--rahma-muted)]">{label}</p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              alert ? "text-red-600" : "text-[var(--rahma-green)]"
            )}
          />
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--rahma-charcoal)]">
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-[var(--rahma-muted)]">{note}</p> : null}
    </article>
  );
}

export function AdminPanel({
  title,
  description,
  badge,
  children,
  className,
}: {
  title?: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--rahma-border)] bg-white p-4 sm:p-5",
        className
      )}
    >
      {title || description || badge ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[var(--rahma-muted)]">{description}</p>
            ) : null}
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminStatusBadge({
  value,
  tone = "default",
}: {
  value: string;
  tone?: "default" | "muted" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default: "border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]",
    muted: "border-none bg-gray-100 text-gray-600",
    warning: "border-none bg-orange-50 text-orange-700",
    danger: "border-none bg-red-50 text-red-700",
    success: "border-none bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <Badge variant="secondary" className={cn("capitalize", toneClass)}>
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

export function AdminFilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 rounded-lg border border-[var(--rahma-border)] bg-white p-3 sm:flex-row sm:items-center",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminEmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon?: React.ElementType;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-[var(--rahma-border)] bg-white/60 px-5 py-14 text-center">
      {Icon ? <Icon className="mx-auto mb-4 size-10 text-[var(--rahma-muted)]/35" /> : null}
      <h2 className="text-base font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--rahma-muted)]">{message}</p>
    </div>
  );
}

export function AdminAccessDenied({
  title = "Access limited",
  message,
  permission,
  inactive = false,
}: {
  title?: string;
  message?: string;
  permission?: string;
  inactive?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <AdminPanel>
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
