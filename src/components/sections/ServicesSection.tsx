import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { ServiceSummary } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface ServicesSectionProps {
  title: string;
  items: readonly ServiceSummary<SiteImageKey>[];
}

export function ServicesSection({ title, items }: ServicesSectionProps) {
  return (
    <section className="section_services color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="max-width-large align-center text-align-center">
              <h2 className="heading-style-h1">{title}</h2>
              <div className="button-spacer-wrap">
                <div className="spacer-large" />
                <div className="button-group is-center" />
              </div>
            </div>

            <div className="spacer-huge" />

            <div className="services_component">
              <div className="services_list-wrapper">
                <div className="w-layout-grid services_list">
                  {items.map((item) => (
                    <div key={item.route} className="service_item">
                      <Link
                        href={item.route}
                        className="service_item-link w-inline-block"
                        aria-label={`View ${item.name} treatment, ${item.priceLabel}`}
                      >
                        <div className="service_image-wrapper">
                          <ResponsiveImage
                            image={{ ...item.image, alt: "" }}
                            className="service_image"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                          <div className="service_info_overlay text-color-white">
                            <div className="button is-secondary is-alternate is-small">
                              {item.ctaLabel}
                            </div>
                            <div className="service_card_info-wrap">
                              <div className="service_title-wrapper">
                                <div className="service_title">{item.name}</div>
                                <div className="spacer-small" />
                                <div className="text-size-small max-width-tiny text-faded-75">
                                  {item.summary}
                                </div>
                              </div>
                              <div className="service-card-price">
                                {item.priceLabel}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
