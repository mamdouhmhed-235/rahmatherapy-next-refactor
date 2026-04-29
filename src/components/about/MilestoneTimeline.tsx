"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { milestones } from "@/content/pages/about";
import { cn } from "@/lib/utils";

function formatTimelineDate(date: string) {
  return date.replace(/^[A-Za-z]+\s+/, "");
}

export function MilestoneTimeline() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rowRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    let frameId: number | null = null;

    const updateActiveMilestone = () => {
      frameId = null;
      const focusY = window.innerHeight * 0.52;
      let closestIndex = -1;
      let closestDistance = Number.POSITIVE_INFINITY;
      let containingIndex = -1;

      rowRefs.current.forEach((row, index) => {
        if (!row) {
          return;
        }

        const rect = row.getBoundingClientRect();

        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          return;
        }

        if (rect.top <= focusY && rect.bottom >= focusY) {
          containingIndex = index;
          return;
        }

        const rowCenter = rect.top + rect.height / 2;
        const distance = Math.abs(rowCenter - focusY);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      const nextIndex = containingIndex >= 0 ? containingIndex : closestIndex;

      if (nextIndex >= 0) {
        setActiveIndex((currentIndex) =>
          currentIndex === nextIndex ? currentIndex : nextIndex
        );
      }
    };

    const requestUpdate = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(updateActiveMilestone);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <SectionContainer tone="green" width="wide">
      <SectionHeading
        title="Our journey so far"
        description="From a mobile therapy service in Luton to a trusted local team, Rahma Therapy has always been built around one idea: professional care that comes to you."
        align="center"
        className="mx-auto"
        inverse
      />
      <ol className="relative mx-auto mt-14 max-w-5xl list-none pl-0 pr-4 md:pr-0">
        <span
          aria-hidden="true"
          className="absolute bottom-8 left-2 top-8 w-px bg-white/18 md:left-1/2 md:-translate-x-1/2"
        />
        {milestones.map((milestone, index) => {
          const isActive = activeIndex === index;
          const isLeft = index % 2 === 0;
          const entranceX = isLeft ? -26 : 26;

          return (
            <li
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              key={`${milestone.date}-${milestone.title}`}
              className="relative pb-12 last:pb-0 md:grid md:min-h-[320px] md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:items-start md:gap-6 md:pb-16 md:last:min-h-0 md:last:pb-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-8 z-10 size-4 rounded-full border-2 transition duration-500 md:left-1/2 md:-translate-x-1/2",
                  isActive
                    ? "border-rahma-gold bg-rahma-gold shadow-[0_0_28px_rgba(245,176,0,0.62)]"
                    : "border-white/40 bg-rahma-green"
                )}
              />
              <span
                className={cn(
                  "relative z-20 mb-3 ml-12 inline-flex w-36 justify-center rounded-full border px-3 py-1 text-xs font-semibold transition duration-500 md:row-start-1 md:mt-6 md:mb-0 md:ml-0",
                  isLeft
                    ? "md:col-start-3 md:justify-self-start"
                    : "md:col-start-1 md:justify-self-end",
                  isActive
                    ? "border-rahma-gold bg-rahma-gold text-rahma-charcoal shadow-[0_0_24px_rgba(245,176,0,0.42)]"
                    : "border-white/20 bg-rahma-green text-white/78"
                )}
              >
                {formatTimelineDate(milestone.date)}
              </span>
              <motion.article
                aria-current={isActive ? "step" : undefined}
                initial={reduceMotion ? false : { opacity: 0, x: entranceX, y: 14 }}
                animate={reduceMotion ? undefined : { scale: isActive ? 1.015 : 1 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, y: 0 }}
                viewport={{ amount: 0.35, once: true }}
                transition={{
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "ml-12 rounded-3xl border p-5 text-left text-white shadow-sm transition duration-500 sm:p-6 md:row-start-1 md:ml-0",
                  isLeft ? "md:col-start-1" : "md:col-start-3",
                  isActive
                    ? "border-rahma-gold bg-white/[0.16] shadow-[0_24px_80px_rgba(0,0,0,0.28)] ring-1 ring-rahma-gold/55"
                    : "border-white/15 bg-white/10 hover:border-white/35"
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-rahma-gold px-3 py-1 text-xs font-semibold text-rahma-charcoal">
                    {milestone.category}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold">{milestone.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/76">
                  {milestone.description}
                </p>
              </motion.article>
            </li>
          );
        })}
      </ol>
    </SectionContainer>
  );
}
