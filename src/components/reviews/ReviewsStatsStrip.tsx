import { reviewsPageStats } from "@/lib/content/reviews";
import { StarRating } from "./StarRating";

const stats = [
  {
    value: reviewsPageStats.googleAverageRating,
    stars: true,
    label: "Average Google rating",
    note: "Verified Google Business rating",
  },
  {
    value: reviewsPageStats.googleReviewCountAtExtraction,
    stars: false,
    label: "Google reviews",
    note: "On our Google Business listing",
  },
  {
    value: reviewsPageStats.clientsSupported,
    stars: false,
    label: "Clients supported",
    note: "Across Rahma Therapy services",
  },
  {
    value: reviewsPageStats.servingSince,
    stars: false,
    label: "Serving Luton since",
    note: "Mobile hijama, cupping and massage",
  },
] as const;

export function ReviewsStatsStrip() {
  return (
    <section className="bg-white px-5 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-3xl border border-rahma-border bg-rahma-ivory p-6 shadow-card"
          >
            <p className="font-display text-4xl font-semibold leading-none text-rahma-green">
              {stat.value}
            </p>
            {stat.stars ? <StarRating rating={5} className="mt-3" /> : null}
            <p className="mt-3 text-base font-semibold text-rahma-charcoal">{stat.label}</p>
            <p className="mt-2 text-sm leading-6 text-rahma-muted">{stat.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
