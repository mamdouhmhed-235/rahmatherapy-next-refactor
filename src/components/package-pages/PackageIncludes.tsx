import { CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";
import { cn } from "@/lib/utils";

export function PackageIncludes({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="ivory">
      <SectionHeading
        title="What’s included"
        description="Each included part has a clear purpose, so you know what you are booking before the session starts."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-4">
        {page.includesDetailed.map((item, index) => (
          <article
            key={item.title}
            className={cn(
              "flex gap-4 rounded-3xl border border-rahma-border bg-white p-5 shadow-sm md:col-span-2",
              page.includesDetailed.length % 2 === 1 &&
                index === page.includesDetailed.length - 1 &&
                "md:col-start-2",
            )}
          >
            <CheckCircle2
              aria-hidden="true"
              size={22}
              className="mt-1 shrink-0 text-rahma-green"
            />
            <div>
              <h3 className="text-lg font-semibold text-rahma-charcoal">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-rahma-muted">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
