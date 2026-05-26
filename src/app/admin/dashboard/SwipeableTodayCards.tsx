"use client";

// Swipeable Today cards (B-5 brief §5.10 + plan step 7).
//
// Mobile (<md): horizontal scroll-snap strip; cards ~85vw wide; trailing
// "View all" link as the final scroll-snap target. Desktop (≥md): the
// wrapper passes through and children render in the parent's flow (vertical
// list per the existing TodayAtAGlanceCard layout).
//
// A11y: per SHARED-NOTES §3, keyboard ArrowLeft / ArrowRight scroll the strip
// when the wrapper has focus. The wrapper is `role="region"` with a labelled
// description so screen-reader users hear "Today's bookings carousel" before
// entering the strip.
//
// CSS approach: scroll-snap is layout, not motion — works identically with
// `prefers-reduced-motion: reduce` (which only affects animated transitions).
// Keyboard scroll uses `behavior: "auto"` when reduced motion is active.

import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "../components/use-reduced-motion";

export interface SwipeableTodayCardsProps {
  children: ReactNode;
  /** Optional trailing "View all" CTA rendered as the last snap card on mobile. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Optional aria-label override (default: "Today's bookings carousel"). */
  ariaLabel?: string;
}

const SCROLL_STEP_PX = 320;

export function SwipeableTodayCards({
  children,
  viewAllHref,
  viewAllLabel,
  ariaLabel = "Today's bookings carousel",
}: SwipeableTodayCardsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const delta = e.key === "ArrowRight" ? SCROLL_STEP_PX : -SCROLL_STEP_PX;
    ref.current?.scrollBy({
      left: delta,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    e.preventDefault();
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 md:mx-0 md:flex-col md:overflow-visible md:gap-2 md:px-0 md:pb-0 [&>*]:min-w-[85vw] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:min-w-[60vw] md:[&>*]:min-w-0 md:[&>*]:shrink"
    >
      {children}
      {viewAllHref ? (
        <a
          href={viewAllHref}
          className="inline-flex h-11 min-w-[55vw] items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-dashed border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/30 px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none md:hidden"
          style={{ scrollSnapAlign: "start" }}
        >
          {viewAllLabel ?? "View all →"}
        </a>
      ) : null}
    </div>
  );
}
