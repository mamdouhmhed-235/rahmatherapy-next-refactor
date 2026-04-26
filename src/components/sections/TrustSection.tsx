import type { NumberedFeature } from "@/types/content";

interface TrustSectionProps {
  title: string;
  items: readonly NumberedFeature[];
}

export function TrustSection({ title, items }: TrustSectionProps) {
  const rows = [items.slice(0, 2), items.slice(2, 4)];

  return (
    <section className="section_journey color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="journey_component">
              <div className="max-width-large">
                <h2 className="heading-style-h2">{title}</h2>
              </div>
              <div className="spacer-xxlarge" />
              <div className="journey_list">
                {rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="w-layout-grid journey_row">
                    {row.map((item, itemIndex) => (
                      <div
                        key={item.eyebrow}
                        id={
                          rowIndex === 0 && itemIndex === 0
                            ? "w-node-_4af9a415-6330-8a1b-b8a5-552172774269-7277425e"
                            : undefined
                        }
                        className="journey_item"
                        style={{ minHeight: "7.976rem" }}
                      >
                        <div className="journey_item-number-wrapper">
                          <h3 className="heading-style-h2">{item.eyebrow}</h3>
                        </div>
                        <div className="layout611_item-content">
                          <h3 className="heading-style-h4">{item.title}</h3>
                          <div className="spacer-xsmall" />
                          <p className="text-size-regular">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
