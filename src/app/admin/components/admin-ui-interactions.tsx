"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { CheckCircle, Loader2, MoreHorizontal, SlidersHorizontal, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── AdminActionMenu ──────────────────────────────────────────────────────────
// Proper `menu` / `menuitem` pattern with arrow-key navigation, outside-click
// close, Escape close, and focus return to the trigger. Replaces the earlier
// `<details>/<summary>` shape (no menu role, no arrow keys).

export function AdminActionMenu({
  label = "More actions",
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape — mirrors the previous <details> behaviour
  // while we own the open/close state explicitly.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Move keyboard focus to the first menuitem when the menu opens.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      first?.focus();
    });
  }, [open]);

  // Arrow keys cycle the focused menuitem; Home/End jump to first/last.
  const onMenuKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(
      menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
    );
    if (items.length === 0) return;
    const activeIndex = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = items[(activeIndex + 1 + items.length) % items.length];
      next?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = items[(activeIndex - 1 + items.length) % items.length];
      prev?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      // Tab closes the menu — focus naturally proceeds to the next document control.
      setOpen(false);
    }
  }, []);

  // ArrowDown / ArrowUp on the trigger also opens the menu and lands focus on
  // the first or last item respectively (standard menu-trigger keyboard model).
  const onTriggerKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => {
        const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        items?.[items.length - 1]?.focus();
      });
    }
  }, []);

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-30 mt-1.5 grid min-w-48 gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]"
        >
          {children}
        </div>
      ) : null}
    </div>
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
      role="menuitem"
      className={cn(
        "flex min-h-11 sm:min-h-9 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-sm font-medium outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
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
          Refine
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
