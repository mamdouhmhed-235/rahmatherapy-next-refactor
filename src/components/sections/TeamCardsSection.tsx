import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { TeamCard } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface TeamCardsSectionProps {
  title: string;
  description?: string;
  items: readonly TeamCard<SiteImageKey>[];
}

export function TeamCardsSection({ title, description, items }: TeamCardsSectionProps) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-10 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.name} className="overflow-hidden rounded-[0.5rem] border border-border bg-white">
                {item.image ? (
                  <div className="relative h-80 overflow-hidden">
                    <ResponsiveImage image={item.image} fill sizes="(max-width: 767px) 100vw, 50vw" />
                  </div>
                ) : null}
                <div className="p-6 md:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                    {item.role}
                  </p>
                  <h3 className="mt-3 text-3xl font-semibold">
                    {item.name}
                  </h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-foreground/72">{item.description}</p>
                  {item.badges?.length ? (
                    <ul className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      {item.badges.map((badge) => (
                        <li key={badge} className="rounded-full border border-border bg-background px-3 py-2">
                          {badge}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.notes?.length ? (
                    <ul className="mt-5 grid gap-2 text-sm text-foreground/70">
                      {item.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
