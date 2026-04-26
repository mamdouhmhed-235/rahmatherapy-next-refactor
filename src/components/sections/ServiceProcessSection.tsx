import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { ActionLink, ImageReference, ProcessStep } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface ServiceProcessSectionProps {
  title: string;
  description: string;
  items: readonly ProcessStep<SiteImageKey>[];
  cta: ActionLink;
  image?: ImageReference<SiteImageKey>;
  contentMinHeight?: string;
}

export function ServiceProcessSection({
  title,
  description,
  items,
  cta,
  image,
  contentMinHeight,
}: ServiceProcessSectionProps) {
  return (
    <section className="section_visit-expectations color-scheme-4">
      <div className="visit_expectations_component">
        <div className="padding-global">
          <div className="container-large">
            <div className="padding-section-large">
              <div
                className="w-layout-grid layout584_content"
                style={
                  contentMinHeight
                    ? { minHeight: contentMinHeight }
                    : undefined
                }
              >
                <div className="layout584_content-left">
                  <h2 className="heading-style-h2">{title}</h2>
                </div>
                <div className="layout584_content-right">
                  <p className="text-size-medium">{description}</p>
                  <div className="spacer-medium" />
                  <div className="layout584_item-list">
                    {items.map((item) => (
                      <div key={item.description} className="layout584_item">
                        <div className="layout584_item-icon-wrapper">
                          <div className="icon-embed-xsmall w-embed">
                            <CheckCircle2 aria-hidden="true" />
                          </div>
                        </div>
                        <div className="layout584_item-text-wrapper">
                          <p>{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="spacer-medium" />
                  <div className="button-group">
                    <Link
                      href={cta.href}
                      className="button max-width-full-mobile-landscape w-button"
                      data-booking-trigger="true"
                    >
                      {cta.label}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {image ? (
          <div className="visit_expectations_image-wrapper">
            <ResponsiveImage
              image={image}
              className="visit_expectations_image"
              sizes="(max-width: 1728px) 100vw, 1728px"
              priority
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
