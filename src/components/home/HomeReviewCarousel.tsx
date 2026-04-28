"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { SectionContainer, SectionHeading, StarsRating } from "@/components/shared";
import { homeReviews } from "@/content/pages/home";
import { cn } from "@/lib/utils";

export function HomeReviewCarousel() {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStartXRef = React.useRef(0);
  const dragStartScrollRef = React.useRef(0);
  const draggedRef = React.useRef(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [hasFocusWithin, setHasFocusWithin] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(0);

  const shouldPause =
    isManuallyPaused || isHovering || hasFocusWithin || isDragging || prefersReducedMotion;

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  React.useEffect(() => {
    if (shouldPause) {
      return;
    }

    let frameId = 0;
    let previousTime = performance.now();

    const tick = (time: number) => {
      const scroller = scrollerRef.current;
      if (scroller) {
        const distance = Math.min(time - previousTime, 40) * 0.025;
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;

        if (scroller.scrollLeft >= maxScroll - 1) {
          scroller.scrollLeft = 0;
        } else {
          scroller.scrollLeft += distance;
        }
      }

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
    draggedRef.current = false;
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
      draggedRef.current = true;
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

  function toggleCard(index: number) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }

    setExpandedIndex((current) => (current === index ? null : index));
  }

  function scrollReviews(direction: "previous" | "next") {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const firstCard = scroller.querySelector("button");
    const cardWidth = firstCard?.getBoundingClientRect().width ?? scroller.clientWidth * 0.85;
    const distance = cardWidth + 20;

    setIsManuallyPaused(true);
    scroller.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <SectionContainer tone="surface" width="full" className="overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            title="Trusted by clients across Luton"
            description="The same words come up again and again: professional, comfortable, on time, explained clearly and easy to book at home."
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-label="Previous review"
              onClick={() => scrollReviews("previous")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-rahma-border bg-white text-rahma-green transition hover:border-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              aria-label="Next review"
              onClick={() => scrollReviews("next")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-rahma-border bg-white text-rahma-green transition hover:border-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              aria-pressed={isManuallyPaused}
              onClick={() => setIsManuallyPaused((current) => !current)}
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-rahma-border bg-white px-4 text-sm font-semibold text-rahma-green transition hover:border-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              {isManuallyPaused || prefersReducedMotion ? (
                <>
                  <Play aria-hidden="true" size={16} />
                  Play reviews
                </>
              ) : (
                <>
                  <Pause aria-hidden="true" size={16} />
                  Pause reviews
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div
        ref={scrollerRef}
        aria-label="Google review highlights"
        className={cn(
          "mt-10 flex max-w-full cursor-grab gap-5 overflow-x-auto px-5 pb-4 pt-2 [contain:paint] [scrollbar-width:none] sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2))]",
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
        {homeReviews.map((review, index) => {
          const isExpanded = expandedIndex === index;

          return (
            <button
              key={`${review.reviewer}-${review.category}`}
              type="button"
              aria-expanded={isExpanded}
              onClick={() => toggleCard(index)}
              onMouseEnter={() => setExpandedIndex(index)}
              onFocus={() => setExpandedIndex(index)}
              className={cn(
                "min-h-[300px] shrink-0 rounded-3xl border border-rahma-border bg-white p-6 text-left shadow-sm transition-[width,transform,box-shadow,border-color] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue",
                isExpanded
                  ? "w-[21rem] border-rahma-gold shadow-card sm:w-[28rem]"
                  : "w-[18rem] hover:-translate-y-1 hover:shadow-card sm:w-[23rem]"
              )}
            >
              <StarsRating rating={review.rating} label={`${review.rating} star review`} />
              <span className="mt-5 inline-flex rounded-full bg-rahma-ivory px-3 py-1 text-xs font-semibold text-rahma-green">
                {review.category}
              </span>
              <blockquote className="mt-5 text-base font-medium leading-7 text-rahma-charcoal">
                “{isExpanded ? review.fullQuote : review.shortQuote}”
              </blockquote>
              <p className="mt-6 text-sm font-semibold text-rahma-green">
                {review.reviewer}
              </p>
            </button>
          );
        })}
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
