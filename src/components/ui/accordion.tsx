"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionProps {
  items: readonly {
    question: string;
    answer: string;
  }[];
  className?: string;
  defaultOpenIndex?: number | null;
}

export function Accordion({ items, className, defaultOpenIndex = 0 }: AccordionProps) {
  const accordionId = React.useId();
  const [openIndex, setOpenIndex] = React.useState<number | null>(defaultOpenIndex);

  return (
    <div className={cn("grid gap-3 sm:gap-4", className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const buttonId = `${accordionId}-trigger-${index}`;
        const panelId = `${accordionId}-panel-${index}`;

        return (
          <div
            key={item.question}
            className={cn(
              "overflow-hidden rounded-2xl border bg-white/95 shadow-[0_16px_42px_-34px_rgba(48,70,63,0.55)] transition duration-200",
              isOpen
                ? "border-rahma-green/25 ring-1 ring-rahma-green/10"
                : "border-rahma-border hover:border-rahma-green/25 hover:bg-white"
            )}
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="group flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold leading-6 text-rahma-charcoal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rahma-blue sm:min-h-[4.75rem] sm:px-6 sm:py-5 sm:text-lg"
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span className="min-w-0 pr-2">{item.question}</span>
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border transition",
                  isOpen
                    ? "border-rahma-gold bg-rahma-gold text-rahma-green"
                    : "border-rahma-border bg-rahma-ivory text-rahma-green group-hover:border-rahma-green/35 group-hover:bg-white"
                )}
              >
                <ChevronDown
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2.3}
                  className={cn("transition-transform duration-200", isOpen && "rotate-180")}
                />
              </span>
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 pt-0 text-sm leading-7 text-rahma-muted sm:px-6 sm:pb-6 sm:text-base"
            >
              <p className="max-w-3xl border-t border-rahma-border/70 pt-4">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
