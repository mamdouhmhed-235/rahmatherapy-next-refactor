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
      <ol className="mx-auto mt-12 grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {milestones.map((milestone, index) => {
          const isActive = activeIndex === index;

          return (
            <motion.li
              key={`${milestone.date}-${milestone.title}`}
              aria-current={isActive ? "step" : undefined}
              onViewportEnter={() => setActiveIndex(index)}
              initial={reduceMotion ? false : { opacity: 0, x: -18, y: 10 }}
              animate={reduceMotion ? undefined : { scale: isActive ? 1.015 : 1 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, y: 0 }}
              viewport={{ amount: 0.45, once: false }}
              transition={{
                duration: 0.4,
                delay: reduceMotion ? 0 : (index % 4) * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                "relative flex h-full min-h-[270px] flex-col rounded-3xl border p-5 text-left text-white shadow-sm transition duration-300 sm:p-6",
                isActive
                  ? "border-rahma-gold bg-white/[0.16] shadow-[0_24px_80px_rgba(0,0,0,0.28)] ring-1 ring-rahma-gold/55"
                  : "border-white/15 bg-white/10 hover:border-white/35"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mb-5 inline-flex size-4 rounded-full border-2 transition duration-300",
                  isActive
                    ? "border-rahma-gold bg-rahma-gold shadow-[0_0_24px_rgba(245,176,0,0.55)]"
                    : "border-white/35 bg-rahma-green"
                )}
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-rahma-gold px-3 py-1 text-xs font-semibold text-rahma-charcoal">
                  {milestone.category}
                </span>
                <span className="text-sm font-semibold text-white/70">
                  {milestone.date}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold">{milestone.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/76">
                {milestone.description}
              </p>
            </motion.li>
          );
        })}
      </ol>
    </SectionContainer>
  );
}
