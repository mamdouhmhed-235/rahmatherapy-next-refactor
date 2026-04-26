import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { HeroSection } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface ServiceHeroSectionProps {
  content: HeroSection<SiteImageKey>;
  variant?: "physiotherapy" | "sports-massage" | "hijama";
}

export function ServiceHeroSection({
  content,
  variant = "physiotherapy",
}: ServiceHeroSectionProps) {
  const images = content.images ?? (content.image ? [content.image] : []);

  if (variant === "sports-massage") {
    return (
      <header className="section_service_hero_2 color-scheme-1">
        <div className="padding-global">
          <div className="container-large">
            <div className="padding-section-large-topper">
              <div className="service_hero_2_component">
                <div className="w-layout-grid service_hero_2_content-wrapper service-hero-content-lock">
                  <div className="service_hero_2_content-left">
                    <p className="eyebrow-text text-color-accent">
                      {content.title}
                    </p>
                    <div className="spacer-xsmall" />
                    {content.subtitle ? (
                      <h1 className="heading-style-h2">{content.subtitle}</h1>
                    ) : null}
                  </div>
                  <div className="service_hero_2_content-right">
                    <p className="text-size-medium">{content.description}</p>
                    <div className="spacer-medium" />
                    <div className="button-group">
                      <Link
                        href={content.primaryCta.href}
                        className="button max-width-full-mobile-landscape w-button"
                        data-booking-trigger="true"
                      >
                        {content.primaryCta.label}
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="spacer-xxlarge" />
                <div className="service_hero_2_image-group">
                  {images[0] ? (
                    <div className="service_hero_2_image-wrapper1">
                      <ResponsiveImage
                        image={images[0]}
                        className="service_hero_2_image1"
                        sizes="100vw"
                        priority
                      />
                    </div>
                  ) : null}
                  {images[1] ? (
                    <div className="service_hero_2_image-wrapper2">
                      <ResponsiveImage
                        image={images[1]}
                        className="service_hero_2_image2"
                        sizes="(max-width: 1728px) 100vw, 1728px"
                        priority
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (variant === "hijama") {
    return (
      <header className="section_service_hero_3 color-scheme-1">
        <div className="padding-global">
          <div className="container-large">
            <div className="padding-section-large-topper">
              <div className="header119_component">
                <div className="w-layout-grid header119_content-wrapper service-hero-content-lock">
                  <div className="header119_content-left">
                    <p className="eyebrow-text text-color-accent">
                      {content.title}
                    </p>
                    <div className="spacer-xsmall" />
                    {content.subtitle ? (
                      <h1 className="heading-style-h2">{content.subtitle}</h1>
                    ) : null}
                  </div>
                  <div
                    id="w-node-d6d014f0-6007-1142-85ca-dda07e699eef-7e699ee6"
                    className="header119_content-right"
                  >
                    <p className="text-size-medium">{content.description}</p>
                    <div className="spacer-medium" />
                    <div className="button-group">
                      <Link
                        href={content.primaryCta.href}
                        className="button max-width-full-mobile-landscape w-button"
                        data-booking-trigger="true"
                      >
                        {content.primaryCta.label}
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="spacer-xxlarge" />
                <div className="header119_image-group">
                  {images[0] ? (
                    <div className="header119_image-wrapper1">
                      <ResponsiveImage
                        image={images[0]}
                        className="header119_image1"
                        sizes="(max-width: 4000px) 100vw, 4000px"
                        priority
                      />
                    </div>
                  ) : null}
                  {images[1] ? (
                    <div className="header119_image-wrapper2">
                      <ResponsiveImage
                        image={images[1]}
                        className="header119_image2"
                        sizes="(max-width: 4000px) 100vw, 4000px"
                        priority
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="section_service_hero_1 color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large-topper">
            <div className="service_hero_component">
              <div className="service_hero_content">
                <div className="service_hero_content-left">
                  <div className="service_hero_content-top">
                    {content.title ? (
                      <p className="eyebrow-text text-color-accent">
                        {content.title}
                      </p>
                    ) : null}
                    <div className="spacer-xsmall" />
                    {content.subtitle ? (
                      <h1 className="heading-style-h2">{content.subtitle}</h1>
                    ) : null}
                    <div className="spacer-small" />
                  </div>
                  <div className="service_hero_content-bottom">
                    <p className="text-size-medium">{content.description}</p>
                    <div className="spacer-medium" />
                    <div className="button-group">
                      <Link
                        href={content.primaryCta.href}
                        className="button max-width-full-mobile-landscape w-button"
                        data-booking-trigger="true"
                      >
                        {content.primaryCta.label}
                      </Link>
                    </div>
                  </div>
                </div>

                {images.length > 0 ? (
                  <div className="service_hero_image-group">
                    {images[0] ? (
                      <div className="service_hero_image-wrapper">
                        <ResponsiveImage
                          image={images[0]}
                          className="service_hero_image1"
                          sizes="100vw"
                          priority
                        />
                      </div>
                    ) : null}
                    {images[1] ? (
                      <div className="service_hero_image-wrapper">
                        <ResponsiveImage
                          image={images[1]}
                          className="service_hero_image2"
                          sizes="100vw"
                          priority
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
