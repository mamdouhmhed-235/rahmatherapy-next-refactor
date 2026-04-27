import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { ActionLink, ImageReference } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface ImageTextSectionProps {
  title: string;
  description: string;
  image?: ImageReference<SiteImageKey>;
  caption?: string;
  cta?: ActionLink;
}

export function ImageTextSection({ title, description, image, caption, cta }: ImageTextSectionProps) {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="grid items-center gap-10 md:grid-cols-2">
            {image ? (
              <figure className="overflow-hidden rounded-[0.5rem] border border-border bg-white shadow-sm">
                <div className="relative h-80 overflow-hidden md:h-[32rem]">
                  <ResponsiveImage image={image} fill sizes="(max-width: 767px) 100vw, 50vw" />
                </div>
                {caption ? (
                  <figcaption className="px-6 py-4 text-sm font-medium text-foreground/70">
                    {caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
            <div>
              <h2 className="heading-style-h2">{title}</h2>
              <div className="mt-5 whitespace-pre-line text-size-medium">{description}</div>
              {cta ? (
                <Link href={cta.href} className="button w-button mt-8">
                  {cta.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
