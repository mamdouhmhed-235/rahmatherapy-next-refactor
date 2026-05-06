"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { MoreHorizontal, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
      <summary className="inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--rahma-border)] bg-white text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="size-4" />
        <span className="sr-only">{label}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 grid min-w-48 gap-1 rounded-xl border border-[var(--rahma-border)] bg-white p-2 shadow-elevated">
        {children}
      </div>
    </details>
  );
}

export function AdminMenuItem({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-[var(--rahma-charcoal)] outline-none hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

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
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <BaseDialog.Popup
          className={cn(
            "fixed z-50 grid max-h-[calc(100vh-1rem)] gap-4 overflow-y-auto border border-[var(--rahma-border)] bg-white p-5 shadow-elevated outline-none",
            side === "right" &&
              "bottom-2 right-2 top-2 w-[min(calc(100vw-1rem),28rem)] rounded-xl",
            side === "bottom" &&
              "inset-x-2 bottom-2 max-h-[85vh] rounded-t-2xl sm:left-1/2 sm:w-[min(calc(100vw-1rem),36rem)] sm:-translate-x-1/2"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <BaseDialog.Title className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
                {title}
              </BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="mt-1 text-sm leading-6 text-[var(--rahma-muted)]">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
            <BaseDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--rahma-muted)] outline-none hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30">
              <X className="size-4" />
              <span className="sr-only">Close panel</span>
            </BaseDialog.Close>
          </div>
          <div>{children}</div>
          {footer ? (
            <div className="border-t border-[var(--rahma-border)] pt-4">{footer}</div>
          ) : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

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
      description="Refine the current admin view without changing permission scope."
      side="bottom"
      trigger={
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
      }
      footer={footer}
    >
      {children}
    </AdminSheet>
  );
}

export function AdminConfirmationDialog({
  title,
  description,
  trigger,
  children,
  confirm,
  cancelLabel = "Cancel",
}: {
  title: string;
  description?: string;
  trigger: React.ReactElement;
  children?: React.ReactNode;
  confirm: React.ReactNode;
  cancelLabel?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">{cancelLabel}</Button>} />
          {confirm}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
