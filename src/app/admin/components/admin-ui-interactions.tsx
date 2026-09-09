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
      {/* Trigger: min-h-11/min-w-11 = 44px, WCAG 2.5.5 Target Size. Was size-9
          (36px), measured 35.99px and deferred out of Phase 6 because this file is
          the shared admin primitive set — redesign/per-page-deferrals/services-deferrals.md */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
      {open ? (
        <>
          {/* Phone scrim. Sits INSIDE containerRef on purpose: the
              outside-pointerdown effect above tests `contains()`, so a scrim
              outside it would close the menu on pointerdown and swallow the tap
              that was meant for the sheet. The onClick is what dismisses. */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-[var(--admin-scrim)]/35 md:hidden"
          />
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            /* ⛔ BELOW md THIS IS A SHEET, NOT A DROPDOWN — and it has to be.
             * An anchored `absolute` popup cannot survive down there: below md
             * `#admin-main` is the scroll container (AdminTopNav.tsx:376) and its
             * box STOPS where the in-flow bottom tab bar starts, so a popup that
             * dropped past that line was clipped by the scroller AND painted
             * under the z-40 bar. Measured on /admin/services at 320: the last
             * item, "Hide from website" (top 573, h 44), landed under a bar whose
             * top is ~583 and could not be scrolled out from under it.
             * `fixed` + z-50 clears both — it escapes the scroller's clip and
             * paints above the bar — and a capped, scrollable height means the
             * item count no longer decides whether the last action is reachable.
             * Safe because nothing on these pages establishes a containing block
             * for `fixed` (no transform / filter / backdrop-filter above it).
             *
             * ⛔ md: is the switch, not sm:, because the tab bar is `md:hidden` —
             * the constraint and the reset have to be the same breakpoint, or
             * 640–767px keeps the clipped dropdown. At md and above every
             * declaration below restores exactly what this menu rendered before. */
            className="fixed bottom-2 left-2 right-2 z-50 grid max-h-[70dvh] min-w-48 gap-0.5 overflow-y-auto overscroll-contain rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)] md:absolute md:bottom-auto md:left-auto md:right-0 md:z-30 md:mt-1.5 md:max-h-none md:max-w-[calc(100vw-1.5rem)] md:overflow-y-visible md:overscroll-auto"
          >
            {children}
          </div>
        </>
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
          ? "text-[var(--admin-status-cancelled-text)] hover:bg-[var(--admin-status-cancelled-bg)]"
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
  open,
  onOpenChange,
}: {
  title: string;
  description?: string;
  trigger: React.ReactElement;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "bottom";
  /**
   * Optional. Omit both and the sheet manages itself exactly as before — passing
   * `open={undefined}` to BaseDialog.Root leaves it uncontrolled, so none of the
   * other twelve callers change behaviour.
   *
   * Pass them when the sheet has to close itself after a successful action. The
   * assignment sheet needs this: it used to stay open after assigning, merely
   * re-titling itself "Reassign this booking", which read as "nothing happened"
   * and invited a second tap — and a second tap sends the client another email.
   */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Trigger render={trigger} />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[var(--admin-scrim)]/35 backdrop-blur-sm" />
        <BaseDialog.Popup
          className={cn(
            "fixed z-50 grid min-w-0 max-h-[calc(100vh-1rem)] gap-5 overflow-x-hidden overflow-y-auto border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none",
            side === "right" &&
              "bottom-2 right-2 top-2 w-[min(calc(100vw-1rem),28rem)] rounded-[var(--admin-radius-card)]",
            side === "bottom" &&
              "inset-x-2 bottom-2 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[85vh] rounded-[var(--admin-radius-card)] sm:left-1/2 sm:w-[min(calc(100vw-1rem),36rem)] sm:-translate-x-1/2"
          )}
        >
          {side === "bottom" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none -mb-2 mx-auto h-1.5 w-12 rounded-full bg-[var(--admin-border)] opacity-70"
            />
          ) : null}
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
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[var(--admin-scrim)]/35 backdrop-blur-sm" />
        <BaseDialog.Popup className="fixed left-1/2 top-[30vh] z-50 w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
          <div className="flex items-start gap-3">
            {destructive ? (
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-cancelled-bg)]">
                <XCircle className="size-5 text-[var(--admin-status-cancelled-text)]" aria-hidden="true" />
              </span>
            ) : (
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-confirmed-bg)]">
                <CheckCircle className="size-5 text-[var(--admin-status-confirmed-text)]" aria-hidden="true" />
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
                "inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none",
                destructive
                  ? "bg-[var(--admin-danger-solid)] hover:bg-[var(--admin-danger-solid-hover)]"
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
