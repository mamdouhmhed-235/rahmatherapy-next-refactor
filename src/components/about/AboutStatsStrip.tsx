import { aboutStats } from "@/content/pages/about";

export function AboutStatsStrip() {
  return (
    <section className="bg-rahma-ivory px-5 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {aboutStats.map((stat) => (
          <article
            key={stat.value}
            className="rounded-3xl border border-rahma-border bg-white p-6 text-center shadow-sm"
          >
            <p className="font-display text-4xl font-semibold text-rahma-green">
              {stat.value}
            </p>
            <p className="mt-2 text-sm font-medium text-rahma-muted">{stat.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
