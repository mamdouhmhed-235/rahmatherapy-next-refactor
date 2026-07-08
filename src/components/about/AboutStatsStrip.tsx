import { Fragment } from "react";
import { aboutStats } from "@/content/pages/about";

export function AboutStatsStrip() {
  return (
    <section className="bg-rahma-ivory px-5 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-10 lg:gap-x-12">
        {aboutStats.map((stat, index) => (
          <Fragment key={stat.value}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="hidden h-10 w-px bg-rahma-border sm:inline-block"
              />
            ) : null}
            <div className="text-center">
              <p className="font-display text-3xl font-semibold text-rahma-green sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-sm font-medium text-rahma-muted">{stat.label}</p>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
