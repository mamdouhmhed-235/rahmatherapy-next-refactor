import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { IconFeature } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface BenefitsSectionProps {
  title: string;
  items: readonly IconFeature<SiteImageKey>[];
  asideTitle: string;
  asideDescription: string;
}

export function BenefitsSection({
  title,
  items,
  asideTitle,
  asideDescription,
}: BenefitsSectionProps) {
  const imageWrapperIds = [
    "w-node-fe0d52cb-9ab8-e2bf-3bfd-64e62353f6dd-2353f6d0",
    "w-node-fe0d52cb-9ab8-e2bf-3bfd-64e62353f6e7-2353f6d0",
    "w-node-fe0d52cb-9ab8-e2bf-3bfd-64e62353f6f1-2353f6d0",
    "w-node-fe0d52cb-9ab8-e2bf-3bfd-64e62353f6fb-2353f6d0",
  ];

  return (
    <section className="section_benefits">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="benefits_component">
              <div className="text-align-center">
                <div className="max-width-large align-center">
                  <h2 className="heading-style-h2">{title}</h2>
                </div>
              </div>
              <div className="spacer-xxlarge" />

              <div className="w-layout-grid benefits_grid-list">
                <div
                  id="w-node-fe0d52cb-9ab8-e2bf-3bfd-64e62353f6db-2353f6d0"
                  className="w-layout-grid benefits_row"
                >
                  {items.map((item, index) => (
                    <div key={item.title} className="benefit_card-small">
                      {item.image ? (
                        <div
                          id={imageWrapperIds[index]}
                          className="benefit_card-small-image-wrapper"
                        >
                          <ResponsiveImage
                            image={item.image}
                            className="benefit_card-small-image"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        </div>
                      ) : null}
                      <div className="benefit_card-small-content">
                        <div className="layout375_card-small-content-top">
                          <h3 className="heading-style-h4">{item.title}</h3>
                          <div className="spacer-xxsmall" />
                          <p>{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div
                    id="w-node-fe0d52cb-9ab8-e2bf-3bfd-64e62353f704-2353f6d0"
                    className="benefit_card-large"
                  >
                    <div
                      id="w-node-fe0d52cb-9ab8-e2bf-3bfd-64e62353f705-2353f6d0"
                      className="benefit_card-large-image-wrapper"
                    >
                      <ResponsiveImage
                        image="featuredHomeTestimonial"
                        className="benefit_card-large-image"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                    <div className="benefit_card-large-content">
                      <div className="benefit_card-large-content-top">
                        <h3 className="heading-style-h3 max-width-small">
                          {asideTitle}
                        </h3>
                        <div className="spacer-small" />
                        <p>{asideDescription}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
