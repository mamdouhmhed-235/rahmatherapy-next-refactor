"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogPortal = BaseDialog.Portal;
export const DialogClose = BaseDialog.Close;

export function DialogBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-sm transition-opacity duration-[var(--motion-duration-normal)] ease-gentle data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

export interface DialogContentProps
  extends React.ComponentProps<typeof BaseDialog.Popup> {
  showCloseButton?: boolean;
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <BaseDialog.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100vw-2rem),42rem)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-xl border border-border/70 bg-card p-6 text-card-foreground shadow-elevated transition-[opacity,transform] duration-[var(--motion-duration-normal)] ease-snappy data-[starting-style]:translate-y-[calc(-50%+1rem)] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-[calc(-50%+1rem)] data-[ending-style]:opacity-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogClose
            data-slot="dialog-close"
            className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            <X className="size-4" />
            <span className="sr-only">Close dialog</span>
          </DialogClose>
        ) : null}
      </BaseDialog.Popup>
    </DialogPortal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-3 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      data-slot="dialog-title"
      className={cn("font-display text-heading-2 text-foreground", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      data-slot="dialog-description"
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
