"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "../use-reduced-motion";

export interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

const defaultFormat = (n: number) => String(Math.round(n));

/**
 * Numeral animator. Ease-out cubic from previous → new value over `duration`
 * ms. Cancels on unmount. Falls back to instant render under reduced motion
 * (per WCAG SC 2.3.3). Tabular-nums so digit jitter doesn't shift layout.
 */
export function CountUp({
  value,
  duration = 400,
  format = defaultFormat,
  className,
}: CountUpProps) {
  const reduce = useReducedMotion();
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || duration <= 0 || prevRef.current === value) {
      setDisplayed(value);
      prevRef.current = value;
      return;
    }
    const start = prevRef.current;
    const delta = value - start;
    const startTime = performance.now();
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(start + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(value);
        prevRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduce]);

  return <span className={cn("tabular-nums", className)}>{format(displayed)}</span>;
}
