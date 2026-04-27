import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { CtaSection as CtaSectionContent } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface CtaSectionProps {
  content: CtaSectionContent<SiteImageKey>;
  variant?: "home" | "service";
}

export function CtaSection({ content, variant = "service" }: CtaSectionProps) {
  const isHome = variant === "home";
  const primaryOpensBooking = content.primary.href.includes("book");
  const secondaryOpensBooking = content.secondary?.href.includes("book");

  return (
    <section
      className={`section_treatment_cta ${
        isHome ? "color-scheme-3" : "color-scheme-1"
      }`}
    >
      <div
        className={`service_cta_component${isHome ? "" : " color-scheme-3"}`}
      >
        <div className="padding-global">
          <div className="container-large">
            <div className="padding-section-large">
              <div className="text-align-center">
                <div className="max-width-large align-center">
                  <h2 className="heading-style-h2">{content.title}</h2>
                  <div className="spacer-small" />
                  <p
                    className={`text-size-medium${
                      isHome ? "" : " max-width-medium align-center"
                    }`}
                  >
                    {content.description}
                  </p>
                  <div className="spacer-medium" />
                  <div className="button-group is-center">
                    <Link
                      href={content.primary.href}
                      className="button is-alternate max-width-full-mobile-landscape w-button"
                      data-booking-trigger={primaryOpensBooking ? "true" : undefined}
                    >
                      {content.primary.label}
                    </Link>
                    {content.secondary ? (
                      <Link
                        href={content.secondary.href}
                        className="button is-secondary is-alternate max-width-full-mobile-landscape w-button"
                        data-booking-trigger={secondaryOpensBooking ? "true" : undefined}
                      >
                        {content.secondary.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {content.image ? (
          <div className="service_cta_image-wrapper">
            <ResponsiveImage
              image={content.image}
              className="service_cta_image"
              sizes="100vw"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
