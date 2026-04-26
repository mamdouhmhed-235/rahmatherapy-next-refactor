import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { FeatureCard } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface ServiceBenefitsSectionProps {
  title: string;
  items: readonly FeatureCard<SiteImageKey>[];
  variant?: "physiotherapy" | "sports-massage" | "hijama";
}

export function ServiceBenefitsSection({
  title,
  items,
  variant = "physiotherapy",
}: ServiceBenefitsSectionProps) {
  if (variant === "sports-massage") {
    const [largeCard, smallCardOne, smallCardTwo, lowerLargeCard] = items;

    return (
      <section className="section_benefits_4grid">
        <div className="padding-global">
          <div className="container-large">
            <div className="padding-section-large">
              <div className="layout525_component">
                <div className="text-align-center">
                  <div className="max-width-large align-center">
                    <h2 className="heading-style-h2">{title}</h2>
                  </div>
                </div>
                <div className="spacer-xxlarge" />
                <div className="w-layout-grid layout525_grid-list">
                  <div
                    id="w-node-c2beff65-80d5-f985-cc84-65ff666b7996-666b798b"
                    className="w-layout-grid layout525_row"
                  >
                    {largeCard ? (
                      <BenefitCard
                        item={largeCard}
                        cardClassName="layout525_card-large text-color-white"
                        contentClassName="layout525_card-large-content"
                        contentTopClassName="layout525_card-large-content-top"
                        imageWrapperClassName="layout525_background-image-wrapper"
                        imageClassName="layout525_background-image"
                        overlayClassName="image-overlay-layer-lighter"
                        headingClassName="heading-style-h3"
                        headingSpacerClassName="spacer-xsmall"
                        preHeadingSpacerClassName="spacer-xxsmall"
                      />
                    ) : null}
                    <div className="layout525_content-right">
                      <div className="layout525_content-right-top">
                        {[smallCardOne, smallCardTwo].map((item) =>
                          item ? (
                            <BenefitCard
                              key={item.title}
                              item={item}
                              cardClassName="layout525_card-small text-color-white"
                              contentClassName="layout525_card-small-content"
                              contentTopClassName="layout525_card-small-content-top"
                              imageWrapperClassName="layout525_background-image-wrapper"
                              imageClassName="layout525_background-image"
                              overlayClassName="image-overlay-layer-lighter"
                              headingClassName="heading-style-h4"
                              headingSpacerClassName="spacer-xxsmall"
                            />
                          ) : null
                        )}
                      </div>
                      {lowerLargeCard ? (
                        <BenefitCard
                          item={lowerLargeCard}
                          cardClassName="layout525_card-large text-color-white"
                          contentClassName="layout525_card-large-content"
                          contentTopClassName="layout525_card-large-content-top"
                          imageWrapperClassName="layout525_background-image-wrapper"
                          imageClassName="layout525_background-image"
                          overlayClassName="image-overlay-layer-lighter"
                          headingClassName="heading-style-h3"
                          headingSpacerClassName="spacer-xsmall"
                        />
                      ) : null}
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

  if (variant === "hijama") {
    const [largeCard, ...rightCards] = items;

    return (
      <section className="section_benefits_3grid color-scheme-1">
        <div className="padding-global">
          <div className="container-large">
            <div className="padding-section-large">
              <div className="benefits_3grid_component">
                <div className="text-align-center">
                  <div className="max-width-large align-center">
                    <h2 className="heading-style-h2">{title}</h2>
                  </div>
                </div>
                <div className="spacer-xxlarge" />
                <div className="w-layout-grid benefits_3grid_grid-list">
                  <div
                    id="w-node-_7cd72787-d872-bc33-4b0e-b6ececb6c8b3-ecb6c8a8"
                    className="w-layout-grid benefits_3grid_row"
                  >
                    {largeCard ? (
                      <BenefitCard
                        item={largeCard}
                        cardClassName="benefits_3grid_card text-color-white"
                        contentClassName="benefits_3grid_card-content"
                        contentTopClassName="benefits_3grid_card-content-wrap"
                        imageWrapperClassName="benefits_3grid_background-image-wrapper"
                        imageClassName="benefits_3grid_background-image"
                        overlayClassName="image-overlay-layer-semi-dark"
                        headingClassName="heading-style-h3"
                        headingSpacerClassName="spacer-xsmall"
                      />
                    ) : null}
                    <div className="benefits_3grid_content-right">
                      {rightCards.map((item) => (
                        <BenefitCard
                          key={item.title}
                          item={item}
                          cardClassName="benefits_3grid_card text-color-white"
                          contentClassName="benefits_3grid_card-content"
                          contentTopClassName="benefits_3grid_card-content-wrap"
                          imageWrapperClassName="benefits_3grid_background-image-wrapper"
                          imageClassName="benefits_3grid_background-image"
                          overlayClassName="image-overlay-layer-semi-dark"
                          headingClassName="heading-style-h3"
                          headingSpacerClassName="spacer-xsmall"
                        />
                      ))}
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

  const columns = [
    items.slice(0, 2),
    items.slice(2, 4),
    items.slice(4, 6),
  ];

  return (
    <section className="service_benefits_section_1 color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="service_benefits_component">
              <div className="text-align-center">
                <div className="max-width-large align-center">
                  <h2 className="heading-style-h2">{title}</h2>
                </div>
              </div>
              <div className="spacer-xxlarge" />
              <div className="w-layout-grid service_benefits_grid-list">
                <div
                  id="w-node-_15ef643e-20eb-7e52-4087-4f35be6f9250-be6f9245"
                  className="w-layout-grid service_benefits_row"
                >
                  {columns.map((column, columnIndex) => (
                    <div
                      key={columnIndex}
                      className="w-layout-grid service_benefits_column"
                    >
                      {column.map((item, itemIndex) => {
                        const isLarge =
                          (columnIndex === 0 && itemIndex === 0) ||
                          (columnIndex === 1 && itemIndex === 1) ||
                          (columnIndex === 2 && itemIndex === 0);
                        const cardClass = isLarge
                          ? "service_benefits_card-large text-color-white"
                          : "service_benefits_card-small text-color-white";
                        const contentClass = isLarge
                          ? "layout526_card-large-content"
                          : "layout526_card-small-content";
                        const contentTopClass = isLarge
                          ? "layout526_card-large-content-top"
                          : "layout526_card-small-content-top";

                        return (
                          <div key={item.title} className={cardClass}>
                            <div className="layout526_background-image-wrapper">
                              <div className="image-overlay-layer-semi-dark" />
                              {item.image ? (
                                <ResponsiveImage
                                  image={item.image}
                                  className="layout526_background-image"
                                  sizes="(max-width: 768px) 100vw, 33vw"
                                />
                              ) : null}
                            </div>
                            <div className={contentClass}>
                              <div className={contentTopClass}>
                                <h3 className="heading-style-h4">{item.title}</h3>
                                <div className="spacer-xsmall" />
                                <p className="text-size-regular">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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

interface BenefitCardProps {
  item: FeatureCard<SiteImageKey>;
  cardClassName: string;
  contentClassName: string;
  contentTopClassName: string;
  imageWrapperClassName: string;
  imageClassName: string;
  overlayClassName: string;
  headingClassName: string;
  headingSpacerClassName: string;
  preHeadingSpacerClassName?: string;
}

function BenefitCard({
  item,
  cardClassName,
  contentClassName,
  contentTopClassName,
  imageWrapperClassName,
  imageClassName,
  overlayClassName,
  headingClassName,
  headingSpacerClassName,
  preHeadingSpacerClassName,
}: BenefitCardProps) {
  return (
    <div className={cardClassName}>
      <div className={imageWrapperClassName}>
        <div className={overlayClassName} />
        {item.image ? (
          <ResponsiveImage
            image={item.image}
            className={imageClassName}
            sizes="100vw"
          />
        ) : null}
      </div>
      <div className={contentClassName}>
        <div className={contentTopClassName}>
          {preHeadingSpacerClassName ? (
            <div className={preHeadingSpacerClassName} />
          ) : null}
          <h3 className={headingClassName}>{item.title}</h3>
          <div className={headingSpacerClassName} />
          <p className="text-size-regular">{item.description}</p>
        </div>
      </div>
    </div>
  );
}
