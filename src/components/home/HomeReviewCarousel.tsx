"use client";

import * as React from "react";
import Link from "next/link";
import { Quote } from "lucide-react";
import { SectionContainer, SectionHeading, StarsRating } from "@/components/shared";
import { ReviewerAvatar } from "@/components/reviews/ReviewerAvatar";
import { homeReviews } from "@/content/pages/home";
import { cn } from "@/lib/utils";

const AUTO_SCROLL_PIXELS_PER_MS = 0.045;
// The track renders this many back-to-back copies of the review list so there
// is always a full set of duplicate cards to scroll into on either side. A
// scroll listener silently shifts by exactly one set-width whenever the
// middle copy is left, which is imperceptible because the neighbouring copy
// is pixel-identical — that illusion is what makes it feel endless in both
// directions, whether the motion comes from autoplay or a manual drag/scroll.
const SET_COUNT = 3;

export function HomeReviewCarousel() {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStartXRef = React.useRef(0);
  const dragStartScrollRef = React.useRef(0);
  const wasDraggedRef = React.useRef(false);

  const [isHovering, setIsHovering] = React.useState(false);
  const [hasFocusWithin, setHasFocusWithin] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const shouldPause = isHovering || hasFocusWithin || isDragging || prefersReducedMotion;

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  // Start centred on the middle copy of the track, so there's a full set of
  // duplicate cards to scroll into whether the user (or autoplay) heads left
  // or right. Runs before paint so there's no visible flash of the first copy.
  React.useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    scroller.scrollLeft = scroller.scrollWidth / SET_COUNT;
  }, []);

  // Whenever the track's scroll position leaves the middle copy — from
  // autoplay, a manual drag, or native wheel/trackpad scrolling, all three
  // change scrollLeft and so all three fire this — silently shift by exactly
  // one set-width to land on the same visual position in the neighbouring
  // copy. That's what makes it loop endlessly in both directions instead of
  // hitting a hard stop at either end.
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const handleScroll = () => {
      const setWidth = scroller.scrollWidth / SET_COUNT;
      if (!setWidth) {
        return;
      }
      if (scroller.scrollLeft >= setWidth * 2) {
        scroller.scrollLeft -= setWidth;
      } else if (scroller.scrollLeft < setWidth) {
        scroller.scrollLeft += setWidth;
      }
    };

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, []);

  // Continuous left-to-right auto-scroll, via a direct scrollLeft write on
  // this element only. Two earlier versions broke this: (1) pairing per-frame
  // scrollLeft nudges with CSS scroll-snap — the browser kept correcting each
  // tiny nudge straight back to the current snap point, so it never visibly
  // moved; (2) switching to scrollIntoView, which walks up the DOM and can
  // drag ancestor scroll containers along with it — this site's html/body run
  // overflow-x:hidden with a live scroll position, so that escalation visibly
  // yanked the whole page sideways near the last card. Plain continuous
  // scrollLeft increments with no scroll-snap avoid both: nothing to fight
  // the motion, and nothing that can touch anything outside this track.
  React.useEffect(() => {
    if (shouldPause) {
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    let frameId = 0;
    let previousTime = performance.now();

    const tick = (time: number) => {
      const distance = Math.min(time - previousTime, 40) * AUTO_SCROLL_PIXELS_PER_MS;
      scroller.scrollLeft += distance;
      previousTime = time;
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [shouldPause]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    setIsDragging(true);
    wasDraggedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartScrollRef.current = scroller.scrollLeft;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;
    if (!isDragging || !scroller) {
      return;
    }

    const deltaX = event.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 4) {
      wasDraggedRef.current = true;
    }

    scroller.scrollLeft = dragStartScrollRef.current - deltaX;
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }

  function handleScrollerBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setHasFocusWithin(false);
    }
  }

  return (
    <SectionContainer tone="surface" width="full" className="overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          title="Trusted by clients across Luton"
          description="Five words our clients use most: professional, comfortable, on-time, explained, private."
        />
      </div>
      <div
        ref={scrollerRef}
        aria-label="Google review highlights"
        className={cn(
          "relative mt-10 flex max-w-full cursor-grab items-start gap-5 overflow-x-auto px-5 pb-4 pt-2 [scrollbar-width:none] sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2))]",
          isDragging && "cursor-grabbing select-none"
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onFocus={() => setHasFocusWithin(true)}
        onBlur={handleScrollerBlur}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {Array.from({ length: SET_COUNT }, (_, setIndex) =>
          homeReviews.map((review, index) => {
            const flatIndex = setIndex * homeReviews.length + index;
            const isActive = activeIndex === flatIndex;

            return (
              <div
                key={`${setIndex}-${review.reviewer}-${review.category}`}
                tabIndex={0}
                role="group"
                aria-label={`Review from ${review.reviewer}`}
                onMouseEnter={() => setActiveIndex(flatIndex)}
                onMouseLeave={() => setActiveIndex((current) => (current === flatIndex ? null : current))}
                onFocus={() => setActiveIndex(flatIndex)}
                onBlur={() => setActiveIndex((current) => (current === flatIndex ? null : current))}
                className={cn(
                  "flex w-[19rem] shrink-0 flex-col rounded-3xl border bg-white p-6 text-left shadow-sm outline-none transition-[transform,box-shadow,border-color] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:w-[23rem]",
                  isActive ? "-translate-y-1 border-rahma-gold shadow-elevated" : "border-rahma-border hover:-translate-y-1 hover:shadow-card"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <StarsRating rating={review.rating} label={`${review.rating} star review`} />
                  <span className="inline-flex shrink-0 rounded-full bg-rahma-ivory px-3 py-1 text-xs font-semibold text-rahma-green">
                    {review.category}
                  </span>
                </div>
                <Quote aria-hidden="true" size={22} className="mt-5 shrink-0 fill-rahma-gold/25 text-rahma-gold" />
                <div
                  className={cn(
                    "mt-3 min-h-24 overflow-hidden transition-[max-height] duration-300 ease-out",
                    isActive ? "max-h-96" : "max-h-24"
                  )}
                >
                  <p className="text-base leading-7 text-rahma-charcoal">
                    {isActive ? review.fullQuote : review.shortQuote}
                  </p>
                </div>
                <Quote
                  aria-hidden="true"
                  size={22}
                  className="mt-2 shrink-0 self-end rotate-180 fill-rahma-gold/25 text-rahma-gold"
                />
                <div className="mt-6 flex items-center gap-3 border-t border-rahma-border/70 pt-5">
                  <ReviewerAvatar name={review.reviewer} />
                  <div>
                    <p className="text-sm font-semibold text-rahma-charcoal">{review.reviewer}</p>
                    <p className="text-xs text-rahma-muted">Google Review</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="mx-auto mt-8 flex max-w-7xl flex-col items-center gap-4 px-5 text-center sm:px-6 lg:px-8">
        <p className="text-lg font-semibold text-rahma-charcoal">
          Want to see more client experiences?
        </p>
        <Link
          href="/reviews"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-rahma-green px-6 text-sm font-semibold !text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          Read more reviews
        </Link>
      </div>
    </SectionContainer>
  );
}
