import { SectionContainer, SectionHeading } from "@/components/shared";
import { beforeAppointmentItems } from "@/content/pages/faqsAftercare";
import { FaqsAftercareIcon } from "./FaqsAftercareIcon";
import { FaqsAftercareImage } from "./FaqsAftercareImage";

export function BeforeAppointment() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <SectionHeading
            title="Before your appointment"
            description="A little preparation helps your session feel smoother, calmer and more comfortable."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {beforeAppointmentItems.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-rahma-border bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-rahma-ivory text-rahma-green">
                  <FaqsAftercareIcon name={item.icon} />
                </div>
                <h3 className="text-lg font-semibold text-rahma-charcoal">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-rahma-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <FaqsAftercareImage
            src="/images/faqs-aftercare/before-appointment.webp"
            alt="Rahma Therapy therapist preparing for a private home appointment"
            imageType="Therapist preparing treatment setup or a calm checklist-style preparation image."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
          <span className="absolute bottom-6 left-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green shadow-sm">
            Before your session
          </span>
        </div>
      </div>
    </SectionContainer>
  );
}
