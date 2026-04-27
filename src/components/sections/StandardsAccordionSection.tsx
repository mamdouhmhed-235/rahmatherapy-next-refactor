import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { AccordionItem } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface StandardsAccordionSectionProps {
  title: string;
  description?: string;
  items: readonly AccordionItem[];
  image?: { image: SiteImageKey; alt?: string };
  caption?: string;
}

export function StandardsAccordionSection({ title, description, items, image, caption }: StandardsAccordionSectionProps) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-10 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div className="grid gap-3">
              {items.map((item) => (
                <details key={item.title} className="group rounded-[0.5rem] border border-border bg-white p-6">
                  <summary className="cursor-pointer list-none text-xl font-semibold marker:hidden">
                    {item.title}
                  </summary>
                  <p className="mt-4 text-sm leading-6 text-foreground/72">{item.description}</p>
                </details>
              ))}
            </div>
            {image ? (
              <figure className="overflow-hidden rounded-[0.5rem] border border-border bg-white shadow-sm">
                <div className="relative h-80 overflow-hidden lg:h-full lg:min-h-[34rem]">
                  <ResponsiveImage image={image} fill sizes="(max-width: 1023px) 100vw, 40vw" />
                </div>
                {caption ? (
                  <figcaption className="px-6 py-4 text-sm font-medium text-foreground/70">
                    {caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
