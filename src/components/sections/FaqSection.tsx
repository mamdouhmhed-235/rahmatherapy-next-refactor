import type { FaqItem } from "@/types/content";

interface FaqSectionProps {
  title: string;
  items: readonly FaqItem[];
}

export function FaqSection({ title, items }: FaqSectionProps) {
  return (
    <section className="section_faq color-scheme-1">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="faq_component">
              <div className="max-width-large">
                <h2 className="heading-style-h2">{title}</h2>
              </div>
              <div className="spacer-xxlarge" />
              <div className="faq_list">
                {items.map((item) => (
                  <div
                    key={item.question}
                    className="faq_item"
                  >
                    <div className="faq_question">
                      <div className="text-size-medium text-weight-bold">
                        {item.question}
                      </div>
                    </div>
                    <p className="text-size-regular">{item.answer}</p>
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
