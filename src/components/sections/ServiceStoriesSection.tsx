import { ResponsiveImage } from "@/components/media/ResponsiveImage";
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
              <div
                data-duration-in="400"
                data-duration-out="200"
                data-current="Tab 1"
                data-easing="ease"
                className="service_results_tabs w-tabs"
              >
                <div className="service_results_tabs-menu w-tab-menu">
                  {items.map((item, index) => (
                    <a
                      key={item.title}
                      data-w-tab={`Tab ${index + 1}`}
                      className={`result_tab-link w-inline-block w-tab-link${
                        index === 0 ? " w--current" : ""
                      }`}
                    >
                      <h3 className="heading-style-h4">{item.title}</h3>
                      <div className="result_paragraph">
                        <div className="spacer-xsmall" />
                        <p>{item.description}</p>
                      </div>
                    </a>
                  ))}
                </div>
                <div
                  id="w-node-_440181bf-2f21-8026-f9f4-9f3f4a0d9857-4a0d9833"
                  className="service_results_tabs-content w-tab-content"
                >
                  {items.map((item, index) => (
                    <div
                      key={item.title}
                      data-w-tab={`Tab ${index + 1}`}
                      className={`result_tab-pane w-tab-pane${
                        index === 0 ? " w--tab-active" : ""
                      }`}
                    >
                      {item.image ? (
                        <div className="result_image-wrapper">
                          <ResponsiveImage
                            image={item.image}
                            className="result_image"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        </div>
                      ) : null}
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
