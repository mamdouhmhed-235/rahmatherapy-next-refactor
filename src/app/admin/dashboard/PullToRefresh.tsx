"use client";

// Pull-to-refresh wrapper (B-5 brief §5.9 + plan step 6).
//
// Mobile-only: handlers no-op on viewports ≥ md, so desktop never traps mouse
// drags. Fires `router.refresh()` when the user pulls past 80px from
// scrollTop=0. A 2-second debounce (AUDIT G9) coalesces with R4's
// visibilitychange-driven refetch so the page can't be hammered.
//
// A11y: the indicator wrapper is `role="status" aria-live="polite"` so
// screen readers announce "Refreshing…" without interrupting focus. Honours
// `prefers-reduced-motion` (spinner static, no animate-spin) via the existing
// `useReducedMotion` hook.

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useReducedMotion } from "../components/use-reduced-motion";

export const PULL_THRESHOLD_PX = 80;
export const REFRESH_DEBOUNCE_MS = 2_000;
const PULL_DAMPING = 0.5;
const MAX_PULL_PX = PULL_THRESHOLD_PX * 1.5;
const REFRESH_VISUAL_MS = 600;

export interface PullToRefreshProps {
  children: ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const startY = useRef<number | null>(null);
  const lastFireAt = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 767.9px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

  function fireRefresh() {
    const now = Date.now();
    if (now - lastFireAt.current < REFRESH_DEBOUNCE_MS) {
      setPull(0);
      return;
    }
    lastFireAt.current = now;
    setRefreshing(true);
    try {
      router.refresh();
    } catch {
      // router.refresh is best-effort — swallow per SHARED-NOTES §2 (B-5 row).
    }
    window.setTimeout(() => {
      setRefreshing(false);
      setPull(0);
    }, REFRESH_VISUAL_MS);
  }

  function onTouchStart(e: ReactTouchEvent) {
    if (!isMobile) return;
    if (typeof window !== "undefined" && window.scrollY > 0) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0]?.clientY ?? null;
  }

  function onTouchMove(e: ReactTouchEvent) {
    if (!isMobile || startY.current === null) return;
    const currentY = e.touches[0]?.clientY ?? 0;
    const dy = currentY - startY.current;
    if (dy <= 0 || (typeof window !== "undefined" && window.scrollY > 0)) {
      setPull(0);
      return;
    }
    const damped = Math.min(dy * PULL_DAMPING, MAX_PULL_PX);
    setPull(damped);
  }

  function onTouchEnd() {
    if (!isMobile) {
      startY.current = null;
      return;
    }
    if (pull >= PULL_THRESHOLD_PX) {
      fireRefresh();
    } else {
      setPull(0);
    }
    startY.current = null;
  }

  function onTouchCancel() {
    startY.current = null;
    setPull(0);
  }

  const showIndicator = isMobile && (pull > 0 || refreshing);
  const indicatorHeight = refreshing
    ? 48
    : Math.min(Math.round(pull), MAX_PULL_PX);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {showIndicator ? (
        <div
          role="status"
          aria-live="polite"
          data-pull-state={
            refreshing
              ? "refreshing"
              : pull >= PULL_THRESHOLD_PX
                ? "ready"
                : "pulling"
          }
          className="pointer-events-none flex items-center justify-center overflow-hidden text-xs font-medium text-[var(--admin-text-muted)]"
          style={{ height: `${indicatorHeight}px` }}
        >
          {refreshing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2
                className={
                  reducedMotion ? "size-4" : "size-4 animate-spin"
                }
                aria-hidden="true"
              />
              Refreshing…
            </span>
          ) : pull >= PULL_THRESHOLD_PX ? (
            <span>Release to refresh</span>
          ) : (
            <span>Pull to refresh</span>
          )}
        </div>
      ) : null}
      {children}
    </div>
  );
}
