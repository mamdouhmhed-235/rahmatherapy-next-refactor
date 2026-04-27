"use client";

import { Search } from "lucide-react";
import type { ReviewCategorySlug } from "@/lib/content/reviews";
import { reviewCategoryFilters } from "@/lib/content/reviews";
import { cn } from "@/lib/utils";

interface ReviewFiltersProps {
  selectedCategory: ReviewCategorySlug;
  searchQuery: string;
  onCategoryChange: (category: ReviewCategorySlug) => void;
  onSearchChange: (query: string) => void;
}

export function ReviewFilters({
  selectedCategory,
  searchQuery,
  onCategoryChange,
  onSearchChange,
}: ReviewFiltersProps) {
  return (
    <div className="sticky top-20 z-20 rounded-3xl border border-rahma-border bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rahma-muted"
          size={18}
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search reviews by keyword"
          placeholder="Search reviews by keyword…"
          className="min-h-12 w-full rounded-full border border-rahma-border bg-rahma-ivory pl-11 pr-4 text-sm text-rahma-charcoal outline-none transition placeholder:text-rahma-muted focus:border-rahma-green focus:bg-white focus:ring-2 focus:ring-rahma-blue/20"
        />
      </div>
      <p className="mt-2 px-2 text-xs text-rahma-muted">
        Try: female therapist, hijama, back pain, home visit
      </p>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max gap-2">
          {reviewCategoryFilters.map((filter) => {
            const active = selectedCategory === filter.slug;

            return (
              <button
                key={filter.slug}
                type="button"
                aria-pressed={active}
                onClick={() => onCategoryChange(filter.slug)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue",
                  active
                    ? "border-rahma-green bg-rahma-green !text-white"
                    : "border-rahma-border bg-white text-rahma-green hover:border-rahma-gold/60 hover:bg-rahma-gold/10"
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    active ? "bg-white/18 text-white" : "bg-rahma-ivory text-rahma-muted"
                  )}
                >
                  {filter.countHint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
