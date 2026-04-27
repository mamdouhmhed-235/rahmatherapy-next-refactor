import type { StoryCase } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface ServiceStoriesSectionProps {
  title: string;
  description: string;
  items: readonly StoryCase<SiteImageKey>[];
}

export function ServiceStoriesSection({
  title,
  description,
  items,
}: ServiceStoriesSectionProps) {
  return (
    <section className="section_service_results color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="service_results_component">
              <div className="text-align-center">
                <div className="max-width-large align-center">
                  <h2 className="heading-style-h2">{title}</h2>
                  <div className="spacer-small" />
                  <p className="text-size-medium">{description}</p>
                </div>
              </div>
              <div className="spacer-xxlarge" />
              <div className="service_results_story-grid">
                {items.map((item) => (
                  <article key={item.title} className="service_results_story-card">
                    <div className="service_results_story-content">
                      <h3 className="heading-style-h4">{item.title}</h3>
                      <div className="spacer-xsmall" />
                      <p>{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
