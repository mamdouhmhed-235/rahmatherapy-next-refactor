import { Check } from "lucide-react";
import type { FeatureCard, ImageReference } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface ServiceOutcomesSectionProps {
  title: string;
  description: string;
  image?: ImageReference<SiteImageKey>;
  items: readonly FeatureCard<SiteImageKey>[];
}

export function ServiceOutcomesSection({
  title,
  description,
  items,
}: ServiceOutcomesSectionProps) {
  return (
    <section className="section_service_outcomes color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="service_outcomes_component">
              <div className="w-layout-grid service_outcomes_content is-text-only">
                <div
                  id="w-node-_46a05a7b-ea70-bc4f-7ee4-17a8fece68d4-fece68cc"
                  className="service_outcomes_content-right"
                >
                  <h2 className="heading-style-h2">{title}</h2>
                  <div className="spacer-small" />
                  <p className="text-size-medium">{description}</p>
                  <div className="spacer-small" />
                  <div className="outcomes_item-list">
                    {items.map((item) => (
                      <div key={item.title} className="outcome_item">
                        <div className="outcome_item-icon-wrapper">
                          <div className="icon w-embed">
                            <Check aria-hidden="true" strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className="outcome_item-text-wrapper">
                          <p>{item.title}</p>
                        </div>
                      </div>
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
