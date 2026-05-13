"use client";

import { useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { CheckCircle, Loader2, MoreHorizontal, SlidersHorizontal, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── AdminActionMenu ──────────────────────────────────────────────────────────

export function AdminActionMenu({
  label = "More actions",
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details className={cn("relative inline-block text-left", className)}>
      <summary className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="size-4" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-1.5 grid min-w-48 gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]">
        {children}
      </div>
    </details>
  );
}

// ─── AdminMenuItem ────────────────────────────────────────────────────────────

export function AdminMenuItem({
  children,
  destructive = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-9 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-sm font-medium outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
        destructive
          ? "text-[oklch(26%_0.14_25)] hover:bg-[oklch(95.5%_0.028_20)]"
          : "text-[var(--admin-body)] hover:text-[var(--admin-heading)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── AdminSheet ───────────────────────────────────────────────────────────────

export function AdminSheet({
  title,
  description,
  trigger,
  children,
  footer,
  side = "right",
}: {
  title: string;
  description?: string;
  trigger: React.ReactElement;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "bottom";
}) {
  return (
    <BaseDialog.Root>
      <BaseDialog.Trigger render={trigger} />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm" />
        <BaseDialog.Popup
          className={cn(
            "fixed z-50 grid min-w-0 max-h-[calc(100vh-1rem)] gap-5 overflow-x-hidden overflow-y-auto border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none",
            side === "right" &&
              "bottom-2 right-2 top-2 w-[min(calc(100vw-1rem),28rem)] rounded-[var(--admin-radius-card)]",
            side === "bottom" &&
              "inset-x-2 bottom-2 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[85vh] rounded-[var(--admin-radius-card)] sm:left-1/2 sm:w-[min(calc(100vw-1rem),36rem)] sm:-translate-x-1/2"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <BaseDialog.Title className="text-lg font-semibold text-[var(--admin-heading)]">
                {title}
              </BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="mt-1 text-sm leading-6 text-[var(--admin-text-muted)]">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
            <BaseDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </BaseDialog.Close>
          </div>
          <div className="min-w-0">{children}</div>
          {footer ? (
            <div className="border-t border-[var(--admin-border)] pt-4">{footer}</div>
          ) : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

// ─── AdminFilterSheet ─────────────────────────────────────────────────────────

export function AdminFilterSheet({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <AdminSheet
      title="Filters"
      description="Refine the current view."
      side="bottom"
      trigger={
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
        </button>
      }
      footer={footer}
    >
      {children}
    </AdminSheet>
  );
}

// ─── ConfirmActionModal ───────────────────────────────────────────────────────

export function ConfirmActionModal({
  title,
  description,
  trigger,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Keep it",
  destructive = true,
  onConfirm,
}: {
  title: string;
  description?: string;
  trigger: React.ReactElement;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: (() => void) | (() => Promise<void>);
}) {
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    if (!onConfirm) { setOpen(false); return; }
    setConfirming(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger render={trigger} />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm" />
        <BaseDialog.Popup className="fixed left-1/2 top-[30vh] z-50 w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
          <div className="flex items-start gap-3">
            {destructive ? (
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)]">
                <XCircle className="size-5 text-[oklch(26%_0.14_25)]" aria-hidden="true" />
              </span>
            ) : (
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(93.5%_0.038_155)]">
                <CheckCircle className="size-5 text-[oklch(22%_0.085_155)]" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                {title}
              </BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
            <BaseDialog.Close
              disabled={confirming}
              render={
                <button
                  type="button"
                  disabled={confirming}
                  className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {cancelLabel}
                </button>
              }
            />
            <button
              type="button"
              aria-busy={confirming || undefined}
              disabled={confirming}
              onClick={handleConfirm}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none",
                destructive
                  ? "bg-[oklch(40%_0.14_25)] hover:bg-[oklch(33%_0.14_25)]"
                  : "bg-[var(--admin-primary)] hover:bg-[var(--admin-primary-hover)]"
              )}
            >
              {confirming ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmLabel}
            </button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

// Backwards-compat alias
export const AdminConfirmationDialog = ConfirmActionModal;
