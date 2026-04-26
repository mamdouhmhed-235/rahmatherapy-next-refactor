import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { ImageReference } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface SplitFeatureSectionProps {
  title: string;
  description: string;
  image: ImageReference<SiteImageKey>;
}

export function SplitFeatureSection({
  title,
  description,
  image,
}: SplitFeatureSectionProps) {
  return (
    <section className="section_about color-scheme-2">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="about_component">
              <div className="w-layout-grid about_content">
                <div className="about_image-wrapper">
                  <ResponsiveImage
                    image={image}
                    className="about_image"
                    sizes="(max-width: 1024px) 100vw, 1024px"
                  />
                </div>
                <div className="about_content-right">
                  <h2 className="heading-style-h2 max-width-medium">{title}</h2>
                  <div className="spacer-small" />
                  <p className="text-size-medium text-faded-75">{description}</p>
                  <div className="spacer-medium" />
                  <div className="button-group" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
