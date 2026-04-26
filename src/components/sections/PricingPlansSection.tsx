import Link from "next/link";
import { Check } from "lucide-react";
import type { PricingPlan } from "@/types/content";

interface PricingPlansSectionProps {
  title: string;
  plans: readonly PricingPlan[];
}

export function PricingPlansSection({
  title,
  plans,
}: PricingPlansSectionProps) {
  return (
    <section className="section_pricing18 color-scheme-2">
      <div className="padding-global">
        <div className="container-large">
          <div className="padding-section-large">
            <div className="pricing18_component">
              <div className="text-align-center">
                <div className="max-width-large align-center">
                  <h2 className="heading-style-h2">{title}</h2>
                </div>
              </div>
              <div className="spacer-xxlarge" />
              <div
                className={`w-layout-grid pricing18_grid-list${
                  plans.length === 2 ? " _2-tiles" : ""
                }`}
              >
                {plans.map((plan) => (
                  <div
                    key={plan.title}
                    className="pricing18_plan"
                    style={{ minHeight: "29.25rem" }}
                  >
                    <div className="pricing18_content-top">
                      <div className="text-align-center">
                        <div className="heading-style-h6">{plan.title}</div>
                        <div className="spacer-xxsmall" />
                        <div className="heading-style-h1">{plan.priceLabel}</div>
                        <div className="spacer-xxsmall" />
                        <div>{plan.meta}</div>
                      </div>
                      <div className="spacer-medium" />
                      <div className="pricing18_feature-list">
                        {plan.includes.map((line) => (
                          <div key={line} className="pricing18_feature">
                            <div className="pricing18_icon-wrapper">
                              <div className="icon-embed-xsmall w-embed">
                                <Check aria-hidden="true" />
                              </div>
                            </div>
                            <div>{line}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pricing18_content-bottom">
                      <div className="spacer-medium" />
                      <Link
                        href={plan.cta.href}
                        className="button is-alternate w-button"
                        data-booking-trigger="true"
                      >
                        {plan.cta.label}
                      </Link>
                    </div>
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
