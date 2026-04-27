"use client";

import * as React from "react";
import type { FaqCategory, SearchableFaqItem } from "@/types/content";
import { cn } from "@/lib/utils";

interface FaqSearchSectionProps {
  title: string;
  description?: string;
  categories: readonly FaqCategory[];
  items: readonly SearchableFaqItem[];
}

export function FaqSearchSection({ title, description, categories, items }: FaqSearchSectionProps) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<FaqCategory>("All");
  const deferredQuery = React.useDeferredValue(query);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      `${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });

  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-8 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>

          <div className="mb-5">
            <label htmlFor="faq-search" className="sr-only">
              Search FAQs
            </label>
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search booking, treatments or aftercare"
              className="min-h-12 w-full rounded-[0.75rem] border border-border bg-white px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <div className="mb-8 flex flex-wrap gap-2" aria-label="FAQ categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors",
                  category === item ? "bg-primary text-white" : "bg-white hover:bg-muted"
                )}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {filteredItems.length > 0 ? (
            <div className="grid gap-3">
              {filteredItems.map((item) => (
                <details key={`${item.category}-${item.question}`} className="rounded-[0.5rem] border border-border bg-white p-5">
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-foreground/72">{item.answer}</p>
                </details>
              ))}
            </div>
          ) : (
            <p className="rounded-[0.5rem] border border-border bg-white p-6 text-sm text-foreground/72">
              No FAQs found. Try a different search or message Rahma Therapy before booking.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
