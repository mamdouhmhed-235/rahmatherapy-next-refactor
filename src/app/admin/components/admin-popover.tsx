"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

function AdminPopover({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </PopoverPrimitive.Root>
  );
}

function AdminPopoverTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return (
    <PopoverPrimitive.Trigger
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35", className)}
      {...props}
    >
      {children}
    </PopoverPrimitive.Trigger>
  );
}

function AdminPopoverContent({
  children,
  className,
  align = "end",
  sideOffset = 8,
  mobileScrim = false,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  /**
   * Dim the page behind the panel below md, so a phone-sized popover reads as
   * modal instead of as an overlap. Opt-in and off by default: the other two
   * consumers (notification-bell, notification-card) are unchanged.
   */
  mobileScrim?: boolean;
}) {
  return (
    <>
      {/* ⛔ The scrim needs its OWN Portal, and it cannot live inside Content.
       *
       * Own Portal, because `PopoverPrimitive.Portal` renders through a Slot
       * (react-popover 1.1.15, index.mjs:110 — `PortalPrimitive asChild`), so it
       * accepts exactly one child; a second child beside Content throws at
       * `Children.only`. A separate Portal mounts and unmounts on the same
       * `open` state and lands earlier in <body>.
       *
       * Not inside Content, because Radix's popper wrapper carries an inline
       * `transform` (measured: `transform: translate(0px, 125.5px)` in
       * raw-final/owner/clients/320/menu-2-*.html), which makes it the
       * containing block for fixed-position children — `fixed inset-0` in there
       * would cover only the panel itself.
       *
       * z-[45] is deliberate and order-independent: above the in-flow z-40
       * bottom tab bar, below the z-50 the popper wrapper sets inline on itself,
       * so the panel always paints over its own scrim. Tapping it dismisses via
       * Radix's own outside-pointerdown, so no handler is needed here. */}
      {mobileScrim ? (
        <PopoverPrimitive.Portal>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[45] bg-[var(--admin-scrim)]/35 md:hidden"
          />
        </PopoverPrimitive.Portal>
      ) : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "z-50 w-[min(calc(100vw-1rem),26rem)] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-0 shadow-elevated outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </>
  );
}

export {
  AdminPopover as Root,
  AdminPopoverTrigger as Trigger,
  AdminPopoverContent as Content,
};
