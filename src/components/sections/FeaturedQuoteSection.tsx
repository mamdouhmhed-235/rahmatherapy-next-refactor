import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import type { FeaturedQuote } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface FeaturedQuoteSectionProps {
  content: FeaturedQuote<SiteImageKey>;
}

function StarIcon() {
  return (
    <div className="large_testimonial_rating-icon">
      <div className="icon-embed-xsmall w-embed">
        <svg
          width="100%"
          viewBox="0 0 18 17"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M8.16379.551109C8.47316-.183704 9.52684-.183703 9.83621.551111L11.6621 4.88811C11.7926 5.19789 12.0875 5.40955 12.426 5.43636L17.1654 5.81173C17.9684 5.87533 18.294 6.86532 17.6822 7.38306L14.0713 10.4388C13.8134 10.6571 13.7007 10.9996 13.7795 11.3259L14.8827 15.8949C15.0696 16.669 14.2172 17.2809 13.5297 16.8661L9.47208 14.4176C9.18225 14.2427 8.81775 14.2427 8.52793 14.4176L4.47029 16.8661C3.7828 17.2809 2.93036 16.669 3.11727 15.8949L4.22048 11.3259C4.29928 10.9996 4.18664 10.6571 3.92873 10.4388L.317756 7.38306C-.294046 6.86532.0315611 5.87533.834562 5.81173L5.57402 5.43636C5.91255 5.40955 6.20744 5.19789 6.33786 4.88811L8.16379.551109Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}

export function FeaturedQuoteSection({ content }: FeaturedQuoteSectionProps) {
  if (content.author !== "Khayyam Butt") {
    return (
      <section className="section_testimonial1 color-scheme-1">
        <div className="padding-global">
          <div className="container-large">
            <div className="padding-section-x-large">
              <div className="max-width-xlarge align-center">
                <div className="testimonial1_component">
                  <div className="testimonial1_content">
                    <h3 className="heading-style-h3 text-balanced">
                      {content.quote}
                    </h3>
                    <div className="spacer-medium" />
                    <div className="testimonial1_client">
                      <div className="text-weight-semibold">{content.author}</div>
                      {content.role ? <div>{content.role}</div> : null}
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

  return (
    <section className="section_testimonial">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="large_testimonial_component">
              <div className="w-layout-grid large_testimonial_content">
                <div className="large_testimonial-image-wrapper">
                  <ResponsiveImage
                    image="homeLargeTestimonial"
                    width={600}
                    height={600}
                    className="large_testimonial_client-image"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <div className="large_testimonial_content-right">
                  <div className="large_testimonial_rating-wrapper">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <StarIcon key={index} />
                    ))}
                  </div>
                  <div className="spacer-medium" />
                  <h3 className="heading-style-h5">{content.quote}</h3>
                  <div className="spacer-medium" />
                  <div className="large_testimonial_client">
                    <div className="large_testimonial_client-info">
                      <div className="text-weight-semibold">
                        {content.author}
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
