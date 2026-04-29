"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { milestones } from "@/content/pages/about";
import { cn } from "@/lib/utils";

export function MilestoneTimeline() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const reduceMotion = useReducedMotion();

  return (
    <SectionContainer tone="green" width="wide">
      <SectionHeading
        title="Our journey so far"
        description="From a mobile therapy service in Luton to a trusted local team, Rahma Therapy has always been built around one idea: professional care that comes to you."
        align="center"
        className="mx-auto"
        inverse
      />
      <ol className="relative mx-auto mt-14 max-w-5xl pr-4 md:pr-0">
        <span
          aria-hidden="true"
          className="absolute bottom-8 left-2 top-8 w-px bg-white/18 md:left-1/2 md:-translate-x-1/2"
        />
        {milestones.map((milestone, index) => {
          const isActive = activeIndex === index;
          const isLeft = index % 2 === 0;
          const entranceX = isLeft ? -34 : 34;

          return (
            <li
              key={`${milestone.date}-${milestone.title}`}
              className="relative pb-8 last:pb-0 md:grid md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:items-center md:gap-6"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-8 z-10 size-4 rounded-full border-2 transition duration-300 md:left-1/2 md:-translate-x-1/2",
                  isActive
                    ? "border-rahma-gold bg-rahma-gold shadow-[0_0_28px_rgba(245,176,0,0.62)]"
                    : "border-white/40 bg-rahma-green"
                )}
              />
              <motion.article
                aria-current={isActive ? "step" : undefined}
                onViewportEnter={() => setActiveIndex(index)}
                initial={reduceMotion ? false : { opacity: 0, x: entranceX, y: 18 }}
                animate={reduceMotion ? undefined : { scale: isActive ? 1.015 : 1 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, y: 0 }}
                viewport={{ amount: 0.55, once: false }}
                transition={{
                  duration: 0.46,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "ml-12 rounded-3xl border p-5 text-left text-white shadow-sm transition duration-300 sm:p-6 md:ml-0",
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
                  <span className="text-sm font-semibold text-white/70">
                    {milestone.date}
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
