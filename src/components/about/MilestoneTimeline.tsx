"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { milestones } from "@/content/pages/about";
import { cn } from "@/lib/utils";

export function MilestoneTimeline() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const reduceMotion = useReducedMotion();
  const activeMilestone = milestones[activeIndex];

  return (
    <SectionContainer tone="green" width="wide">
      <SectionHeading
        title="Our journey so far"
        description="From a mobile therapy service in Luton to a trusted local team, Rahma Therapy has always been built around one idea: professional care that comes to you."
        inverse
      />
      <div className="mt-12 grid gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:items-start">
        <aside className="rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-[0_22px_70px_rgba(0,0,0,0.2)] lg:sticky lg:top-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-gold">
            Active milestone
          </p>
          <p className="mt-8 font-display text-4xl font-semibold">{activeMilestone.date}</p>
          <h3 className="mt-4 text-2xl font-semibold">{activeMilestone.title}</h3>
          <p className="mt-4 text-sm leading-7 text-white/76">
            Step {activeIndex + 1} of {milestones.length}
          </p>
        </aside>
        <div className="relative">
          <div className="absolute bottom-0 left-5 top-0 w-px bg-white/18" aria-hidden="true" />
          <div className="grid gap-5">
            {milestones.map((milestone, index) => {
              const isActive = activeIndex === index;

              return (
                <motion.button
                  key={`${milestone.date}-${milestone.title}`}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveIndex(index)}
                  onViewportEnter={() => setActiveIndex(index)}
                  initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ amount: 0.45, once: false }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={cn(
                    "relative ml-10 rounded-3xl border bg-white/10 p-5 text-left text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-gold sm:p-6",
                    isActive ? "border-rahma-gold" : "border-white/15 hover:border-white/35"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -left-[2.15rem] top-7 size-4 rounded-full border-2",
                      isActive
                        ? "border-rahma-gold bg-rahma-gold"
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
                  <h3 className="mt-4 text-xl font-semibold">{milestone.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/76">
                    {milestone.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
