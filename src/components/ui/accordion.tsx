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
  const [openIndex, setOpenIndex] = React.useState<number | null>(defaultOpenIndex);

  return (
    <div className={cn("divide-y divide-rahma-border rounded-3xl border border-rahma-border bg-white", className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const buttonId = `accordion-trigger-${index}`;
        const panelId = `accordion-panel-${index}`;

        return (
          <div key={item.question}>
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-base font-semibold text-rahma-charcoal outline-none transition-colors hover:bg-rahma-ivory/70 focus-visible:ring-2 focus-visible:ring-rahma-blue sm:px-6"
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{item.question}</span>
              <ChevronDown
                aria-hidden="true"
                size={20}
                className={cn("shrink-0 transition-transform", isOpen && "rotate-180")}
              />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 text-sm leading-7 text-rahma-muted sm:px-6"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
