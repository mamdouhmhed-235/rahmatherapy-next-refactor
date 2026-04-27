import { reviewsPageStats } from "@/lib/content/reviews";

const stats = [
  {
    value: "Loved",
    label: "by clients across Luton",
    note: "Live Google review count to be confirmed",
  },
  {
    value: reviewsPageStats.extractedReviewRecords,
    label: "Review records prepared",
    note: "From the supplied Google review dataset",
  },
  {
    value: reviewsPageStats.fiveStarReviewsInExtractedSet,
    label: "Five-star reviews extracted",
    note: "Within the extracted review set",
  },
  {
    value: reviewsPageStats.clientsSupported,
    label: "Clients supported",
    note: "Across Rahma Therapy services",
  },
] as const;

export function ReviewsStatsStrip() {
  return (
    <section className="bg-white px-5 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-3xl border border-rahma-border bg-rahma-ivory p-6 shadow-sm"
          >
            <p className="font-display text-4xl font-medium leading-none text-rahma-green">
              {stat.value}
            </p>
            <p className="mt-3 text-base font-semibold text-rahma-charcoal">{stat.label}</p>
            <p className="mt-2 text-sm leading-6 text-rahma-muted">{stat.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
