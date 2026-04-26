import Link from "next/link";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { HeroSection as HeroSectionContent } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface HeroSectionProps {
  content: HeroSectionContent<SiteImageKey>;
}

export function HeroSection({ content }: HeroSectionProps) {
  if (!content.image) {
    return null;
  }

  return (
    <header className="section_home_hero color-scheme-1">
      <div className="padding-global">
        <div className="container-full-width">
          <div className="padding-section-hero">
            <div className="home_hero_component">
              <div className="home_hero_card text-color-white">
                <div className="home_hero_card-content">
                  <div className="max-width-large">
                    <p className="eyebrow-text">{content.title}</p>
                    <div className="spacer-xsmall" />
                    <h1 className="heading-style-h1">{content.subtitle}</h1>
                    <div className="spacer-small" />
                    <div className="max-width-medium">
                      <p className="text-size-medium text-faded-75">
                        {content.description}
                      </p>
                    </div>
                  </div>
                  <div className="spacer-medium" />
                  <div className="button-group">
                    <Link
                      href={content.primaryCta.href}
                      className="button is-alternate max-width-full-mobile-landscape w-inline-block"
                      data-booking-trigger="true"
                    >
                      <div className="button_text_icon_wrap">
                        {content.primaryCta.label}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="100%"
                          viewBox="0 0 13 14"
                          fill="none"
                          className="icon-1x1-xxsmall"
                          aria-hidden="true"
                        >
                          <path
                            d="M11.2902 3.801 1.69448 13.4028C1.52065 13.5726 1.32073 13.6575 1.09473 13.6575.868901 13.6575.670984 13.5706.500984 13.3968.327151 13.2228.240234 13.0228.240234 12.797.240234 12.5712.327151 12.3713.500984 12.1973L10.0967 2.60175H1.64773C1.4034 2.60175 1.1994 2.51942 1.03573 2.35475.872068 2.19025.790234 1.98717.790234 1.7455.790234 1.504.872068 1.30242 1.03573 1.14075 1.1994.979088 1.4034.898254 1.64773.898254H12.1477C12.3882.898254 12.5903.980171 12.754 1.144 12.9177 1.30767 12.9995 1.50967 12.9995 1.75V12.25C12.9995 12.4903 12.9172 12.6923 12.7527 12.856 12.5882 13.0198 12.3852 13.1018 12.1435 13.1018 11.8978 13.1018 11.6942 13.0198 11.5325 12.856 11.371 12.6923 11.2902 12.4903 11.2902 12.25V3.801Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                    </Link>
                  </div>
                </div>
                <div className="home_hero_background-image-wrapper">
                  <div className="image-overlay-layer" />
                  <ResponsiveImage
                    image={content.image}
                    fill
                    className="home_hero_background-image"
                    sizes="100vw"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
