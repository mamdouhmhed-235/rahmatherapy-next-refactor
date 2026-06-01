"use client";

import * as React from "react";

const MIN_THUMB = 40; // px — keep the thumb grabbable on long pages

/**
 * Custom overlay scrollbar for the public site.
 *
 * The native scrollbar is hidden (globals.css) so full-bleed sections like the
 * homepage hero video reach the true window edge with no reserved grey column.
 * This draws a thin scrollbar that FLOATS on top of the content instead — it
 * reserves no layout width, and it drives native window scrolling (so the
 * header's scroll detection keeps working). Decorative for AT (native keyboard
 * scrolling is unaffected), hence aria-hidden.
 */
export function PublicScrollbar() {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const thumbRef = React.useRef<HTMLDivElement | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<{ startY: number; startScroll: number } | null>(null);
  const [active, setActive] = React.useState(false);

  const sync = React.useCallback(() => {
    frameRef.current = null;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;

    const winH = window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    const maxScroll = docH - winH;
    const trackH = track.clientHeight;
    const bodyLocked = getComputedStyle(document.body).overflowY === "hidden";

    if (maxScroll <= 1 || trackH <= 0 || bodyLocked) {
      setActive(false);
      return;
    }

    setActive(true);
    const thumbH = Math.max(MIN_THUMB, (winH / docH) * trackH);
    const thumbTop = (window.scrollY / maxScroll) * (trackH - thumbH);
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translate3d(0, ${thumbTop}px, 0)`;
  }, []);

  const requestSync = React.useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(sync);
  }, [sync]);

  React.useEffect(() => {
    requestSync();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    const ro = new ResizeObserver(requestSync);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      ro.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [requestSync]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = { startY: event.clientY, startScroll: window.scrollY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture can throw for non-active pointers; drag still works.
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!drag || !track || !thumb) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const range = track.clientHeight - thumb.offsetHeight;
    if (range <= 0) return;
    const deltaY = event.clientY - drag.startY;
    window.scrollTo({ top: drag.startScroll + (deltaY * maxScroll) / range });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={trackRef}
      className="public-scrollbar"
      aria-hidden="true"
      data-active={active ? "" : undefined}
    >
      <div
        ref={thumbRef}
        className="public-scrollbar__thumb"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
