"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { packageFinderOptions } from "@/content/pages/services";
import { cn } from "@/lib/utils";
import { ServicesImage } from "./ServicesImage";

type PackageFinderOptionId = (typeof packageFinderOptions)[number]["id"];

export function PackageFinder() {
  const [selectedId, setSelectedId] = React.useState<PackageFinderOptionId>(
    packageFinderOptions[0].id
  );
  const reduceMotion = useReducedMotion();
  const selectedOption =
    packageFinderOptions.find((option) => option.id === selectedId) ??
    packageFinderOptions[0];

  return (
    <SectionContainer tone="surface" width="wide">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="relative order-2 min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card lg:order-1">
          <ServicesImage
            src="/images/services/package-finder.webp"
            alt="Rahma Therapy consultation for choosing a treatment package"
            imageType="Therapist consultation or treatment planning image."
            className="h-full min-h-full rounded-none border-0"
          />
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Package finder
          </p>
          <h2 className="mt-4 font-display text-3xl font-medium leading-tight text-rahma-charcoal sm:text-4xl lg:text-5xl">
            Not sure which package to choose?
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-rahma-muted sm:text-lg">
            Pick what sounds closest to you and we’ll point you towards the best
            starting option.
          </p>
          <div className="mt-7 flex flex-wrap gap-3" role="list" aria-label="Package needs">
            {packageFinderOptions.map((option) => {
              const isSelected = selectedOption.id === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(option.id)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue",
                    isSelected
                      ? "border-rahma-gold bg-rahma-gold text-rahma-green"
                      : "border-rahma-border bg-white text-rahma-charcoal hover:border-rahma-green"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <motion.article
            key={selectedOption.id}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mt-8 rounded-3xl border border-rahma-border bg-rahma-ivory p-6 shadow-sm"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-rahma-green">
              Recommended package
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-rahma-charcoal">
              {selectedOption.packageTitle}
            </h3>
            <p className="mt-3 text-sm leading-7 text-rahma-muted">{selectedOption.body}</p>
            <Link
              href={selectedOption.href}
              data-booking-trigger="true"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:w-auto"
            >
              {selectedOption.cta}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </motion.article>
        </div>
      </div>
    </SectionContainer>
  );
}
